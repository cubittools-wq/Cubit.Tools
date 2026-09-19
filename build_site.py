#!/usr/bin/env python3
"""
Cubit.Tools static site builder.

Reads the published Google Sheet tabs (Passwords, Calculators, Date_Time) and generates:

  * one page per tool row                      <slug>/index.html
  * one browse page per category               <category-path>/index.html   (Omni-style hubs)
  * the homepage                               index.html
  * navigation + search data for the browser   data/nav.json, data/search-index.json
  * per-tab tool data                          data/passwords.json, data/calculators.json, data/date_time.json
  * sitemap.xml

Categories are inferred from the Category column, e.g. "Passwords/Sports/Football" becomes
/passwords/, /passwords/sports/ and /passwords/sports/football/ browse pages. No extra Sheet
tab is needed.

When a tool's Slug changes in the Sheet, the old page becomes a redirect to the new one (matched by H1_Title);
pages for tools that were deleted from the Sheet are removed.

Optional Sheet columns (ignored if absent):
  Short_Desc  one-line description shown in category lists (falls back to the first sentence of Meta_Desc)
  Featured    put Y to show the tool in "Popular tools" on the homepage
"""

import csv
import html
import io
import json
import os
import re
import sys
import urllib.request
from urllib.parse import quote

BASE_URL = "https://cubittools-wq.github.io/Cubit.Tools/"
SITE_NAME = "Cubit.tools"

TABS = {
    "passwords": "https://docs.google.com/spreadsheets/d/e/2PACX-1vSbdhn9SqIHgrMpqTdkBbl-enWc18IWbX8ixuxjJY6SYdaaNoQrkUZ9cLunkewSy1HqJILhKR5comZD/pub?gid=0&single=true&output=csv",
    "calculators": "https://docs.google.com/spreadsheets/d/e/2PACX-1vSbdhn9SqIHgrMpqTdkBbl-enWc18IWbX8ixuxjJY6SYdaaNoQrkUZ9cLunkewSy1HqJILhKR5comZD/pub?gid=1797593927&single=true&output=csv",
    "date_time": "https://docs.google.com/spreadsheets/d/e/2PACX-1vSbdhn9SqIHgrMpqTdkBbl-enWc18IWbX8ixuxjJY6SYdaaNoQrkUZ9cLunkewSy1HqJILhKR5comZD/pub?gid=1763227083&single=true&output=csv",
}

# Category display names that can't be inferred from the Sheet text (key = slugified Category part).
DISPLAY_NAMES = {
    "date-time": "Date & Time",
    "tv-film": "TV & Film",
}

# Shorter URLs for top-level categories (key = slugified Category text, value = folder name used in URLs).
# Tool slugs in the Sheet should start with the same folder, e.g. /passwords/arsenal-password-generator/.
SLUG_ALIASES = {
    "passwords-and-security": "passwords",
    "finance-and-money": "finance",
    "business-and-e-commerce": "business",
    "home-and-diy": "home-diy",
    "health-and-fitness": "health",
    "maths-and-statistics": "maths",
    "science-and-engineering": "science",
    "date-and-time": "date-time",
    "text-and-writing": "text",
    "generators-and-random": "generators",
    "sports-and-games": "sports",
}

# Folders that already exist at the site root and must never be replaced by a category page.
RESERVED_TOP = {"about", "contact", "privacy", "terms", "css", "js", "data", "components", "assets"}

SUB_PREVIEW_LIMIT = 8     # tools shown per sub-category section on a parent browse page
COMPACT_ABOVE = 24        # lists longer than this drop descriptions and use a multi-column grid
AZ_ABOVE = 60             # lists longer than this get A-Z jump links
POPULAR_COUNT = 9         # homepage "Popular tools" fallback size
RELATED_COUNT = 8         # "More in <category>" links on each tool page
HOME_SUBCATEGORY_LINKS = 6

FEATURED_VALUES = {"y", "yes", "true", "1", "x", "featured"}
HUB_MARKER = "<!-- cubit:generated-browse-page -->"
REDIRECT_MARKER = "<!-- cubit:generated-redirect -->"
HUBS_MANIFEST = os.path.join("data", "hubs.json")
REDIRECTS_MANIFEST = os.path.join("data", "redirects.json")
MAX_SAFE_DELETIONS = 20   # if more pages than this (and over 30% of the site) would vanish, assume a Sheet problem and keep them


def esc(text):
    return html.escape(str(text), quote=True)


def slugify(text):
    t = str(text).lower().replace("&", " and ")
    t = re.sub(r"[^a-z0-9]+", "-", t).strip("-")
    return t or "other"


def tidy_name(part):
    key = slugify(part)
    if key in DISPLAY_NAMES:
        return DISPLAY_NAMES[key]
    name = re.sub(r"\s+", " ", part.replace("_", " ")).strip()
    if name == name.lower():
        name = name.title()
    return name


def url_path(slug):
    """Percent-encode a slug for use in URLs (spaces, ampersands etc.)."""
    return quote(slug, safe="/_-.~")


def plural(n, word):
    return f"{n:,} {word}" if n == 1 else f"{n:,} {word}s"


# ---------------------------------------------------------------------------
# Category tree
# ---------------------------------------------------------------------------

class Node:
    def __init__(self, key, name, parent=None):
        self.key = key
        self.name = name
        self.parent = parent
        self.children = {}
        self.items = []
        self._total = None

    @property
    def path(self):
        parts, n = [], self
        while n is not None and n.key:
            parts.append(n.key)
            n = n.parent
        return "/".join(reversed(parts))

    @property
    def url(self):
        return f"{BASE_URL}{self.path}/" if self.path else BASE_URL

    def ancestors(self):
        chain, n = [], self
        while n is not None and n.key:
            chain.append(n)
            n = n.parent
        return list(reversed(chain))

    @property
    def total(self):
        if self._total is None:
            self._total = len(self.items) + sum(c.total for c in self.children.values())
        return self._total

    def sorted_children(self):
        return sorted(self.children.values(), key=lambda n: n.name.lower())

    def sorted_items(self):
        return sorted(self.items, key=lambda t: natural_key(t["title"]))

    def label(self):
        return " › ".join(n.name for n in self.ancestors())


def natural_key(text):
    return [int(p) if p.isdigit() else p.lower() for p in re.split(r"(\d+)", text)]


def get_node(root, parts):
    node = root
    for part in parts:
        base = slugify(part)
        key = SLUG_ALIASES.get(base, base) if node is root else base
        if key not in node.children:
            node.children[key] = Node(key, tidy_name(part), node)
        node = node.children[key]
    return node


# ---------------------------------------------------------------------------
# Reading the Sheet
# ---------------------------------------------------------------------------

def fetch_csv(url):
    with urllib.request.urlopen(url, timeout=60) as resp:
        text = resp.read().decode("utf-8-sig")
    rows = list(csv.DictReader(io.StringIO(text, newline="")))
    if not rows or "Slug" not in rows[0]:
        raise ValueError("response was empty or had no Slug column (Sheet unpublished or an error page?)")
    return rows


def load_rows(tab_name, url):
    """Fetch a tab. If the fetch fails, fall back to the last good copy so the site never loses a section."""
    try:
        rows = fetch_csv(url)
        print(f"  {tab_name}: {len(rows)} rows from the Sheet")
        return rows, True
    except Exception as exc:  # network error, Sheet unpublished, etc.
        cache = os.path.join("data", f"{tab_name}.json")
        if os.path.exists(cache):
            with open(cache, encoding="utf-8") as f:
                rows = json.load(f)
            print(f"  {tab_name}: FETCH FAILED ({exc}); using the last good copy ({len(rows)} rows)")
            return rows, False
        print(f"  {tab_name}: FETCH FAILED ({exc}) and no saved copy exists; skipping")
        return [], False


def short_desc(row):
    custom = (row.get("Short_Desc") or "").strip()
    if custom:
        return custom
    text = re.sub(r"<[^>]+>", "", row.get("Meta_Desc") or row.get("Intro_Text") or "")
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= 120:
        return text
    m = re.match(r"(.{40,120}?[.!?])(\s|$)", text)
    if m:
        return m.group(1)
    return text[:117].rsplit(" ", 1)[0].rstrip(",;:- ") + "…"


# ---------------------------------------------------------------------------
# HTML building blocks
# ---------------------------------------------------------------------------

SHELL = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title id="meta-title">{title}</title>
  <meta id="meta-desc" name="description" content="{desc}">
  <link rel="canonical" href="{canonical}">
  <link rel="stylesheet" href="{base}css/style.css">
  <link rel="stylesheet" href="{base}css/mega-nav.css">
  <link rel="stylesheet" href="{base}css/sidebar-nav.css">
  <link rel="stylesheet" href="{base}css/hub.css">
{jsonld}
</head>
<body>
{marker}
  <div id="site-header"></div>

  <div class="usp-bar">
    <div class="usp-container">
      <div class="usp-item"><span>✓</span> 100% Free &amp; Open</div>
      <div class="usp-item"><span>⚡</span> Client-Side Speed</div>
      <div class="usp-item"><span>🔒</span> Zero Data Stored</div>
    </div>
  </div>

  <div class="main-wrapper">
    <div class="content-grid">
      <main>
{main}
      </main>

      <aside>
        <div class="ad-placeholder ad-sidebar">
          <span>Advertisement</span>
        </div>
      </aside>
    </div>
  </div>

  <div id="site-footer"></div>

  <script src="{base}js/app.js" type="module" defer></script>
</body>
</html>
"""


def render_page(title, desc, canonical, main, crumb_pairs=None, marker=""):
    jsonld = ""
    if crumb_pairs:
        data = {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
                {"@type": "ListItem", "position": i + 1, "name": name, "item": url}
                for i, (name, url) in enumerate(crumb_pairs)
            ],
        }
        blob = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
        jsonld = f'  <script type="application/ld+json">{blob}</script>'
    return SHELL.format(
        title=esc(title), desc=esc(desc), canonical=esc(canonical), base=BASE_URL,
        jsonld=jsonld, marker=marker, main=main,
    )


def breadcrumb_html(nodes, current_label):
    parts = [f'<a href="{BASE_URL}">Home</a>']
    for n in nodes:
        parts.append(f'<a href="{esc(n.url)}">{esc(n.name)}</a>')
    parts.append(f"<span>{esc(current_label)}</span>")
    return '<nav class="breadcrumbs" aria-label="Breadcrumb">' + " &gt; ".join(parts) + "</nav>"


def breadcrumb_pairs(nodes, current_label, current_url):
    pairs = [("Home", BASE_URL)] + [(n.name, n.url) for n in nodes]
    pairs.append((current_label, current_url))
    return pairs


def tool_list(items, compact=False):
    cls = "tool-list compact" if compact else "tool-list"
    rows = []
    for t in items:
        if compact:
            rows.append(f'<li class="tool-row"><a href="{esc(t["url"])}">{esc(t["title"])}</a></li>')
        else:
            desc = f'<span class="tool-desc">{esc(t["desc"])}</span>' if t["desc"] else ""
            rows.append(f'<li class="tool-row"><a href="{esc(t["url"])}">{esc(t["title"])}</a>{desc}</li>')
    return f'<ul class="{cls}">' + "".join(rows) + "</ul>"


def chips(nodes):
    return '<ul class="chip-list">' + "".join(
        f'<li><a class="chip" href="{esc(n.url)}">{esc(n.name)} <small>{n.total:,}</small></a></li>'
        for n in nodes
    ) + "</ul>"


def az_list(items):
    """Full alphabetical list with A-Z jump links (for long lists)."""
    groups = {}
    for t in items:
        first = t["title"][:1].upper()
        first = first if first.isalpha() else "#"
        groups.setdefault(first, []).append(t)
    letters = sorted(groups, key=lambda c: (c == "#", c))
    jump = '<nav class="az-jump" aria-label="Jump to letter">' + "".join(
        f'<a href="#letter-{"num" if c == "#" else c}">{c}</a>' for c in letters
    ) + "</nav>"
    body = "".join(
        f'<h3 class="az-heading" id="letter-{"num" if c == "#" else c}">{c}</h3>'
        + tool_list(groups[c], compact=True)
        for c in letters
    )
    return jump + body


def search_box(scope_path, scope_name):
    label = f"Search {scope_name} tools" if scope_name else "Search all tools"
    return (
        '<div class="search-container hub-search">'
        f'<input id="hub-search-input" type="search" placeholder="{esc(label)}…" '
        f'autocomplete="off" data-scope="{esc(scope_path)}" aria-label="{esc(label)}">'
        '<div id="hub-search-results" class="search-results" hidden></div>'
        "</div>"
    )


# ---------------------------------------------------------------------------
# Tool pages
# ---------------------------------------------------------------------------

def render_related(tool):
    node = tool["node"]
    sibs = node.sorted_items()
    picks = []
    if len(sibs) > 1:
        idx = next((i for i, s in enumerate(sibs) if s["slug"] == tool["slug"]), 0)
        for i in range(1, min(RELATED_COUNT, len(sibs) - 1) + 1):
            picks.append(sibs[(idx + i) % len(sibs)])
    peers = [n for n in node.parent.sorted_children() if n is not node][:10]

    parts = ['<section class="related-tools">', f'<h2>More in <a href="{esc(node.url)}">{esc(node.name)}</a></h2>']
    if picks:
        parts.append(tool_list(picks, compact=True))
    parts.append(f'<p class="see-all"><a href="{esc(node.url)}">Browse all {node.total:,} {esc(node.name)} tools &rarr;</a></p>')
    if peers:
        parent_label = node.parent.name if node.parent.key else "categories"
        parts.append(f'<div class="peer-cats"><span>Also browse {esc(parent_label)}:</span>{chips(peers)}</div>')
    parts.append("</section>")
    return "".join(parts)


def render_tool_page(tool):
    row = tool["row"]
    nodes = tool["node"].ancestors()
    canonical = tool["url"]
    main = f"""        <div id="breadcrumb-container">{breadcrumb_html(nodes, tool["title"])}</div>

        <h1 id="page-h1">{esc(tool["title"])}</h1>
        <p id="page-intro" class="intro-text">{esc(row.get("Intro_Text", ""))}</p>

        <section class="tool-card"
                 id="tool-container"
                 data-baked="1"
                 data-widget="{esc(row.get("Widget_Type", "").strip())}"
                 data-config="{esc(row.get("Config_JSON", "") or "{}")}"
                 data-list="{esc(row.get("Data_List", ""))}">
        </section>

        {render_related(tool)}

        <div class="ad-placeholder">
          <span>Advertisement</span>
        </div>

        <article id="seo-body" class="seo-article">{row.get("SEO_Body", "")}</article>"""
    return render_page(
        row.get("Meta_Title", "") or tool["title"], row.get("Meta_Desc", ""), canonical, main,
        breadcrumb_pairs(nodes, tool["title"], canonical),
    )


# ---------------------------------------------------------------------------
# Category (browse) pages
# ---------------------------------------------------------------------------

def hub_intro(node):
    subs = node.sorted_children()
    n = node.total
    if subs:
        names = [s.name for s in subs]
        if len(names) == 1:
            listing = names[0]
        elif len(names) <= 4:
            listing = ", ".join(names[:-1]) + " and " + names[-1]
        else:
            listing = ", ".join(names[:3]) + f" and {len(names) - 3} more categories"
        text = f"Browse {plural(n, 'free tool')} in {node.label()}, from {listing}."
    else:
        text = f"Browse {plural(n, 'free tool')} in {node.label()}."
    return text + " Every tool runs in your browser and nothing you enter is stored."


def render_hub_main(node):
    subs = node.sorted_children()
    direct = node.sorted_items()
    out = [
        breadcrumb_html(node.ancestors()[:-1], node.name),
        f"<h1>{esc(node.name)}</h1>",
        f'<p class="hub-total">{plural(node.total, "free tool")}</p>',
        f'<p class="intro-text">{esc(hub_intro(node))}</p>',
        search_box(node.path, node.name),
    ]

    if len(subs) >= 4:
        out.append('<nav class="hub-jump" aria-label="Categories in this section">' + chips(subs) + "</nav>")

    for sub in subs:
        sub_direct = sub.sorted_items()
        shown = sub_direct[:SUB_PREVIEW_LIMIT]
        sec = [f'<section class="hub-section" id="{esc(sub.key)}">',
               f'<h2><a href="{esc(sub.url)}">{esc(sub.name)}</a> <span class="count">{sub.total:,}</span></h2>']
        if sub.children:
            sec.append(chips(sub.sorted_children()))
        if shown:
            sec.append(tool_list(shown, compact=len(shown) > COMPACT_ABOVE))
        if sub.total > len(shown):
            sec.append(f'<p class="see-all"><a href="{esc(sub.url)}">See all {sub.total:,} {esc(sub.name)} tools &rarr;</a></p>')
        sec.append("</section>")
        out.append("".join(sec))

    if direct:
        if subs:
            heading = f"Other {esc(node.name)} tools"
            out.append(f'<section class="hub-section"><h2>{heading} <span class="count">{len(direct):,}</span></h2>'
                       + tool_list(direct, compact=len(direct) > COMPACT_ABOVE) + "</section>")
        elif len(direct) > AZ_ABOVE:
            out.append('<section class="hub-section">' + az_list(direct) + "</section>")
        else:
            out.append('<section class="hub-section">'
                       + tool_list(direct, compact=len(direct) > COMPACT_ABOVE) + "</section>")

    return "\n".join("        " + line for line in out)


def render_hub_page(node):
    nodes = node.ancestors()
    ctx = [n.name for n in reversed(nodes[:-1])]
    title = f"{node.name} – {', '.join(ctx)}" if ctx else f"{node.name} – Free Online Tools"
    title = f"{title} | {SITE_NAME}"
    desc = hub_intro(node)
    return render_page(title, desc, node.url, render_hub_main(node),
                       breadcrumb_pairs(nodes[:-1], node.name, node.url), marker=HUB_MARKER)


# ---------------------------------------------------------------------------
# Homepage
# ---------------------------------------------------------------------------

def pick_popular(tools, root):
    """Homepage 'Popular tools'. Tools marked Featured in the Sheet win; otherwise show one tool per widget type
    (so the list is varied), preferring tools from small categories over mass-generated ones like the football pages."""
    featured = [t for t in tools if t["featured"]]
    if featured:
        return featured[:12]
    lanes = {}
    for t in sorted(tools, key=lambda t: (len(t["node"].items) > 20, natural_key(t["title"]))):
        lanes.setdefault((t["row"].get("Widget_Type") or "").strip(), []).append(t)
    order = sorted(lanes)
    picked = []
    while len(picked) < POPULAR_COUNT and any(lanes.values()):
        for key in order:
            if lanes[key] and len(picked) < POPULAR_COUNT:
                picked.append(lanes[key].pop(0))
    return picked


def tools_in(node):
    out = list(node.items)
    for c in node.children.values():
        out.extend(tools_in(c))
    return out


def render_home(root, tools):
    cards = []
    for top in root.sorted_children():
        subs = top.sorted_children()
        if subs:
            links = "".join(
                f'<li><a href="{esc(s.url)}">{esc(s.name)}</a><span>{s.total:,}</span></li>'
                for s in subs[:HOME_SUBCATEGORY_LINKS]
            )
            more = len(subs) - HOME_SUBCATEGORY_LINKS
            if more > 0:
                links += f'<li class="more"><a href="{esc(top.url)}">+ {more} more categories</a></li>'
        else:
            links = "".join(
                f'<li><a href="{esc(t["url"])}">{esc(t["title"])}</a></li>' for t in top.sorted_items()[:HOME_SUBCATEGORY_LINKS]
            )
        cards.append(
            '<div class="category-card">'
            f'<h3><a href="{esc(top.url)}">{esc(top.name)}</a> <span class="count">{top.total:,}</span></h3>'
            f'<ul class="category-links">{links}</ul>'
            f'<a class="view-all" href="{esc(top.url)}">View all {top.total:,} &rarr;</a>'
            "</div>"
        )

    pop = []
    for t in pick_popular(tools, root):
        pop.append(
            f'<a href="{esc(t["url"])}" class="feature-card"><div>'
            f'<h3>{esc(t["title"])}</h3><p>{esc(t["desc"])}</p></div>'
            '<span class="feature-link-text">Launch Tool &rarr;</span></a>'
        )

    main = f"""        <div class="home-hero">
          <h1>Web Tools &amp; Utilities</h1>
          <p class="intro-text">Fast, private, free online tools that run directly in your browser. Search {plural(len(tools), "tool")} or browse by category.</p>
        </div>

        {search_box("", "")}

        <section>
          <h2>Browse by category</h2>
          <div class="category-grid">
            {"".join(cards)}
          </div>
        </section>

        <section>
          <h2>Popular tools</h2>
          <div class="featured-grid">
            {"".join(pop)}
          </div>
        </section>

        <div class="ad-placeholder" style="margin-top: 2rem;">
          <span>Advertisement</span>
        </div>"""
    return render_page(
        f"{SITE_NAME} | Free Client-Side Web Utilities",
        "Fast, private, and free client-side generators, calculators, and date tools. Zero data stored.",
        BASE_URL, main,
    )


# ---------------------------------------------------------------------------
# Data files for the browser
# ---------------------------------------------------------------------------

def build_nav(root):
    def brief(n):
        return {"name": n.name, "url": n.url, "count": n.total}
    cats = []
    for top in root.sorted_children():
        entry = brief(top)
        entry["children"] = [brief(s) for s in top.sorted_children()]
        cats.append(entry)
    return {"categories": cats}


def build_search_index(root, tools):
    index = []
    for t in tools:
        index.append({"t": t["title"], "u": url_path(t["slug"]) + "/", "c": t["node"].label(), "p": t["node"].path, "d": t["desc"]})

    def walk(n):
        for c in n.sorted_children():
            parent = n.label() if n.key else ""
            index.append({"t": c.name, "u": c.path + "/", "c": parent or "Category", "p": c.path, "d": plural(c.total, "tool"), "k": 1})
            walk(c)
    walk(root)
    return index


def write_sitemap(root, tools):
    urls = [BASE_URL]
    def walk(n):
        for c in n.sorted_children():
            urls.append(c.url)
            walk(c)
    walk(root)
    urls += [BASE_URL + url_path(t["slug"]) + "/" for t in tools]
    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    lines += [f"  <url><loc>{html.escape(u)}</loc></url>" for u in urls]
    lines.append("</urlset>")
    with open("sitemap.xml", "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


def write_file(path, content):
    folder = os.path.dirname(path)
    if folder:
        os.makedirs(folder, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)


# ---------------------------------------------------------------------------
# Pages whose Slug changed or was deleted
# ---------------------------------------------------------------------------

def previous_pages():
    """Slug -> H1_Title for every tool page in the last build (read from data/*.json before it is overwritten)."""
    prev = {}
    for tab in TABS:
        path = os.path.join("data", f"{tab}.json")
        if not os.path.exists(path):
            continue
        try:
            with open(path, encoding="utf-8") as f:
                rows = json.load(f)
        except Exception:
            continue
        for r in rows:
            slug = (r.get("Slug") or "").strip().strip("/")
            if slug:
                prev[slug] = (r.get("H1_Title") or "").strip()
    return prev


def read_json(path, default):
    if os.path.exists(path):
        try:
            with open(path, encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return default


def slug_from_url(url):
    from urllib.parse import unquote
    return unquote(url[len(BASE_URL):]).strip("/")


def page_file(slug):
    return os.path.join(*slug.split("/"), "index.html")


def file_text(path):
    try:
        with open(path, encoding="utf-8") as f:
            return f.read()
    except OSError:
        return ""


def remove_page(slug):
    path = page_file(slug)
    if os.path.exists(path):
        os.remove(path)
        try:
            os.removedirs(os.path.dirname(path))
        except OSError:
            pass


def write_redirect(slug, target):
    body = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  {REDIRECT_MARKER}
  <title>Page moved | {SITE_NAME}</title>
  <link rel="canonical" href="{esc(target)}">
  <meta http-equiv="refresh" content="0; url={esc(target)}">
</head>
<body>
  <p>This page has moved to <a href="{esc(target)}">{esc(target)}</a>.</p>
</body>
</html>
"""
    write_file(page_file(slug), body)


def handle_moved_pages(previous, tools, hub_paths):
    """Old URLs whose Slug changed get a redirect page; pages for deleted tools are removed."""
    new_slugs = {t["slug"] for t in tools}
    by_title = {t["title"].strip().lower(): t["url"] for t in tools}
    occupied = new_slugs | set(hub_paths)
    old_redirects = read_json(REDIRECTS_MANIFEST, {})
    redirects = {}

    gone = {s: title for s, title in previous.items() if s not in occupied}
    moved = {s: by_title[title.lower()] for s, title in gone.items() if title and title.lower() in by_title}
    deleted = [s for s in gone if s not in moved and "tool-container" in file_text(page_file(s))]

    if len(deleted) > MAX_SAFE_DELETIONS and len(deleted) > 0.3 * max(len(previous), 1):
        print(f"  WARNING: {len(deleted)} pages would be deleted and {len(moved)} redirected; that looks like a Sheet "
              "problem, so no old pages were touched.")
        redirects = old_redirects
        write_file(REDIRECTS_MANIFEST, json.dumps(redirects, indent=2, sort_keys=True))
        return

    for slug, target in moved.items():
        text = file_text(page_file(slug))
        if "tool-container" in text or REDIRECT_MARKER in text:
            write_redirect(slug, target)
            redirects[slug] = target
            print(f"  redirect /{slug}/ -> {target}")
    for slug in deleted:
        remove_page(slug)
        print(f"  removed page /{slug}/ (no longer in the Sheet)")

    # stubs from earlier builds: keep them pointed at a live page, follow one hop if the target moved again
    live_urls = {t["url"] for t in tools}
    for slug, target in old_redirects.items():
        if slug in occupied or slug in redirects:
            continue
        if target not in live_urls:
            hop = redirects.get(slug_from_url(target))
            target = hop if hop else None
        path = page_file(slug)
        if target and REDIRECT_MARKER in file_text(path):
            if target != old_redirects[slug]:
                write_redirect(slug, target)
            redirects[slug] = target
        elif REDIRECT_MARKER in file_text(path):
            remove_page(slug)
            print(f"  removed redirect /{slug}/ (its target no longer exists)")
    write_file(REDIRECTS_MANIFEST, json.dumps(redirects, indent=2, sort_keys=True))


# ---------------------------------------------------------------------------
# Main build
# ---------------------------------------------------------------------------

def build_site():
    print("Fetching sheet data across all tabs...")
    os.makedirs("data", exist_ok=True)

    previous = previous_pages()   # must be read before data/*.json is rewritten below

    root = Node("", "Home")
    tools, seen_slugs = [], set()
    any_live = False

    for tab_name, url in TABS.items():
        rows, live = load_rows(tab_name, url)
        any_live = any_live or live
        dataset = []

        for row in rows:
            raw_slug = (row.get("Slug") or "").strip().strip("/")
            if not raw_slug:
                continue
            if raw_slug in seen_slugs:
                print(f"  WARNING: duplicate Slug '{raw_slug}' ignored")
                continue
            seen_slugs.add(raw_slug)

            category = (row.get("Category") or "").strip() or "Other"
            title = (row.get("H1_Title") or "").strip() or raw_slug.split("/")[-1].replace("_", " ").replace("-", " ").title()
            config = (row.get("Config_JSON") or "").strip() or "{}"
            parts = [p.strip() for p in category.split("/") if p.strip()] or ["Other"]

            row = dict(row)
            row["Config_JSON"] = config
            node = get_node(root, parts)
            tool = {
                "title": title,
                "slug": raw_slug,
                "url": BASE_URL + url_path(raw_slug) + "/",
                "desc": short_desc(row),
                "node": node,
                "featured": (row.get("Featured") or "").strip().lower() in FEATURED_VALUES,
                "row": row,
            }
            node.items.append(tool)
            tools.append(tool)

            dataset.append({
                "Category": category,
                "Slug": raw_slug,
                "H1_Title": title,
                "Meta_Title": row.get("Meta_Title", ""),
                "Meta_Desc": row.get("Meta_Desc", ""),
                "Intro_Text": row.get("Intro_Text", ""),
                "Widget_Type": (row.get("Widget_Type") or "").strip(),
                "Config_JSON": config,
                "Data_List": (row.get("Data_List") or "").strip(),
                "SEO_Body": row.get("SEO_Body", ""),
                "Short_Desc": (row.get("Short_Desc") or "").strip(),
                "Featured": (row.get("Featured") or "").strip(),
            })

        write_file(os.path.join("data", f"{tab_name}.json"), json.dumps(dataset, indent=2, ensure_ascii=False))

    if not tools:
        print("No tools found and nothing to fall back on; stopping without changing the site.")
        sys.exit(1)
    if not any_live:
        print("WARNING: every tab used a saved copy; the site was rebuilt from the last good data.")

    # ---- tool pages
    tool_paths = set()
    for tool in tools:
        tool_paths.add(tool["slug"].lower())
        write_file(os.path.join(*tool["slug"].split("/"), "index.html"), render_tool_page(tool))

    # ---- category browse pages
    hub_paths = []

    def walk(n):
        for c in n.sorted_children():
            path = c.path
            top = path.split("/")[0]
            if top in RESERVED_TOP or path.lower() in tool_paths:
                print(f"  WARNING: category page '/{path}/' clashes with an existing page or folder; skipped")
            else:
                write_file(os.path.join(*path.split("/"), "index.html"), render_hub_page(c))
                hub_paths.append(path)
            walk(c)
    walk(root)

    # remove browse pages for categories that no longer exist (only files we generated)
    old = []
    if os.path.exists(HUBS_MANIFEST):
        try:
            with open(HUBS_MANIFEST, encoding="utf-8") as f:
                old = json.load(f)
        except Exception:
            old = []
    for path in old:
        if path in hub_paths:
            continue
        f = os.path.join(*path.split("/"), "index.html")
        if os.path.exists(f):
            with open(f, encoding="utf-8") as fh:
                if HUB_MARKER in fh.read():
                    os.remove(f)
                    try:
                        os.removedirs(os.path.dirname(f))
                    except OSError:
                        pass
                    print(f"  removed old category page /{path}/")
    write_file(HUBS_MANIFEST, json.dumps(sorted(hub_paths), indent=2))

    # ---- redirects for changed slugs, removal of deleted tools
    handle_moved_pages(previous, tools, hub_paths)

    # ---- homepage, nav, search, sitemap
    write_file("index.html", render_home(root, tools))
    write_file(os.path.join("data", "nav.json"), json.dumps(build_nav(root), indent=2, ensure_ascii=False))
    write_file(os.path.join("data", "search-index.json"),
               json.dumps(build_search_index(root, tools), separators=(",", ":"), ensure_ascii=False))
    write_sitemap(root, tools)

    print(f"Built {len(tools)} tool pages, {len(hub_paths)} category pages, the homepage, "
          "navigation, search index and sitemap.")


if __name__ == "__main__":
    build_site()
