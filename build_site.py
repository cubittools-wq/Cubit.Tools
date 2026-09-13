import csv
import json
import os
import shutil
import urllib.request

TABS = {
    "passwords": "https://docs.google.com/spreadsheets/d/e/2PACX-1vSbdhn9SqIHgrMpqTdkBbl-enWc18IWbX8ixuxjJY6SYdaaNoQrkUZ9cLunkewSy1HqJILhKR5comZD/pub?gid=0&single=true&output=csv",
    "calculators": "https://docs.google.com/spreadsheets/d/e/2PACX-1vSbdhn9SqIHgrMpqTdkBbl-enWc18IWbX8ixuxjJY6SYdaaNoQrkUZ9cLunkewSy1HqJILhKR5comZD/pub?gid=1797593927&single=true&output=csv",
    "date_time": "https://docs.google.com/spreadsheets/d/e/2PACX-1vSbdhn9SqIHgrMpqTdkBbl-enWc18IWbX8ixuxjJY6SYdaaNoQrkUZ9cLunkewSy1HqJILhKR5comZD/pub?gid=1763227083&single=true&output=csv"
}

HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title id="meta-title">{meta_title}</title>
  <meta id="meta-desc" name="description" content="{meta_desc}">
  <link rel="stylesheet" href="{rel_prefix}css/style.css">
  <link rel="stylesheet" href="{rel_prefix}css/mega-nav.css">
  <link rel="stylesheet" href="{rel_prefix}css/sidebar-nav.css">
</head>
<body>

  <div id="site-header"></div>

  <div class="usp-bar">
    <div class="usp-container">
      <div class="usp-item"><span>✓</span> 100% Free & Open</div>
      <div class="usp-item"><span>⚡</span> Client-Side Speed</div>
      <div class="usp-item"><span>🔒</span> Zero Data Stored</div>
    </div>
  </div>

  <div class="main-wrapper">
    <div class="content-grid">
      <main>
        <div id="breadcrumb-container"></div>

        <h1 id="page-h1">{h1_title}</h1>
        <p id="page-intro" class="intro-text">{intro_text}</p>

        <section class="tool-card" 
                 id="tool-container" 
                 data-widget="{widget_type}" 
                 data-config='{config_json}' 
                 data-list='{data_list}'>
        </section>

        <div class="ad-placeholder">
          <span>Advertisement</span>
        </div>

        <article id="seo-body" class="seo-article">{seo_body}</article>
      </main>

      <aside>
        <div class="ad-placeholder ad-sidebar">
          <span>Advertisement</span>
        </div>
      </aside>
    </div>
  </div>

  <div id="site-footer"></div>

  <script src="{rel_prefix}js/app.js" type="module" defer></script>
</body>
</html>
"""

def fetch_csv(url):
    req = urllib.request.urlopen(url)
    csv_data = req.read().decode('utf-8').splitlines()
    return list(csv.DictReader(csv_data))

def insert_into_tree(tree, path_parts, item):
    current = path_parts[0]
    if current not in tree:
        tree[current] = {"_items": [], "_sub": {}}

    if len(path_parts) == 1:
        tree[current]["_items"].append(item)
    else:
        insert_into_tree(tree[current]["_sub"], path_parts[1:], item)

def build_site():
    print("Fetching sheet data across all tabs...")
    nav_tree = {}
    
    os.makedirs("data", exist_ok=True)

    for tab_name, url in TABS.items():
        try:
            rows = fetch_csv(url)
        except Exception as e:
            print(f"Skipping tab {tab_name} due to fetch error: {e}")
            continue

        json_dataset = []

        for row in rows:
            category = row.get("Category", "General").strip()
            raw_slug = row.get("Slug", "").strip().strip('/')
            h1_title = row.get("H1_Title", "").strip()
            
            if not raw_slug:
                continue

            meta_title = row.get("Meta_Title", "")
            meta_desc = row.get("Meta_Desc", "")
            intro_text = row.get("Intro_Text", "")
            widget_type = row.get("Widget_Type", "").strip()
            config_json = row.get("Config_JSON", "{}").strip()
            data_list = row.get("Data_List", "").strip()
            seo_body = row.get("SEO_Body", "")

            # Fallback empty JSON config if blank
            if not config_json:
                config_json = "{}"

            nav_item = {
                "title": h1_title,
                "url": f"/Cubit.Tools/{raw_slug}/"
            }

            # Store dataset item matching schema
            json_dataset.append({
                "Category": category,
                "Slug": raw_slug,
                "H1_Title": h1_title,
                "Meta_Title": meta_title,
                "Meta_Desc": meta_desc,
                "Intro_Text": intro_text,
                "Widget_Type": widget_type,
                "Config_JSON": config_json,
                "Data_List": data_list,
                "SEO_Body": seo_body
            })

            # Build navigation tree
            path_parts = [p.strip() for p in category.split('/') if p.strip()]
            if path_parts:
                insert_into_tree(nav_tree, path_parts, nav_item)

            # Create folder structure based on URL slug
            folder_path = os.path.join(*raw_slug.split('/'))
            os.makedirs(folder_path, exist_ok=True)

            # Calculate relative prefix based on depth of the slug
            path_segments = [s for s in raw_slug.split('/') if s]
            rel_prefix = "../" * (len(path_segments) - 1) if len(path_segments) > 1 else "./"

            # Write individual static HTML file
            html_file = os.path.join(folder_path, "index.html")
            content = HTML_TEMPLATE.format(
                rel_prefix=rel_prefix,
                meta_title=meta_title,
                meta_desc=meta_desc,
                h1_title=h1_title,
                intro_text=intro_text,
                widget_type=widget_type,
                config_json=config_json.replace("'", "&apos;"),
                data_list=data_list,
                seo_body=seo_body
            )
            with open(html_file, "w", encoding="utf-8") as f:
                f.write(content)

        # Save individual tab JSON files for dynamic router lookups if needed
        with open(os.path.join("data", f"{tab_name}.json"), "w", encoding="utf-8") as f:
            json.dump(json_dataset, f, indent=2)

    # Save unified navigation tree
    with open(os.path.join("data", "nav.json"), "w", encoding="utf-8") as f:
        json.dump(nav_tree, f, indent=2)

    print("Successfully built all pages, tool JSON files, and navigation tree!")

if __name__ == "__main__":
    build_site()