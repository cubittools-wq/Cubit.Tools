import csv
import json
import os
import urllib.request

PASSWORDS_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSbdhn9SqIHgrMpqTdkBbl-enWc18IWbX8ixuxjJY6SYdaaNoQrkUZ9cLunkewSy1HqJILhKR5comZD/pub?gid=0&single=true&output=csv"

HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title id="meta-title">{meta_title}</title>
  <meta id="meta-desc" name="description" content="{meta_desc}">
  <link rel="stylesheet" href="/Cubit.Tools/css/style.css">
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

        <header>
          <h1 id="page-h1">{h1_title}</h1>
          <p id="page-intro" class="intro-text">{intro_text}</p>
        </header>

        <section class="tool-card" id="tool-container"></section>

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

  <script src="/Cubit.Tools/js/app.js" defer></script>
</body>
</html>
"""

def fetch_csv(url):
    req = urllib.request.urlopen(url)
    csv_data = req.read().decode('utf-8').splitlines()
    return list(csv.DictReader(csv_data))

def insert_into_tree(tree, path_parts, item):
    """Recursively builds the navigation tree for N-levels of subcategories."""
    current = path_parts[0]
    
    if current not in tree:
        tree[current] = {"_items": [], "_sub": {}}

    if len(path_parts) == 1:
        tree[current]["_items"].append(item)
    else:
        insert_into_tree(tree[current]["_sub"], path_parts[1:], item)

def build_passwords():
    print("Fetching sheet data...")
    rows = fetch_csv(PASSWORDS_CSV_URL)
    
    json_dataset = []
    nav_tree = {}

    for row in rows:
        category_path = row.get("Category_Path", "General").strip()
        raw_slug = row.get("Slug", "").strip().strip('/')
        h1_title = row.get("H1_Title", "").strip()
        
        if not raw_slug:
            continue

        meta_title = row.get("Meta_Title", "")
        meta_desc = row.get("Meta_Desc", "")
        intro_text = row.get("Intro_Text", "")
        word_list = row.get("Word_List", "")
        seo_body = row.get("SEO_Body", "")

        item = {
            "title": h1_title,
            "url": f"/Cubit.Tools/passwords/{raw_slug}/"
        }

        # 1. Store full dataset item
        json_dataset.append({
            "Category_Path": category_path,
            "Slug": raw_slug,
            "H1_Title": h1_title,
            "Meta_Title": meta_title,
            "Meta_Desc": meta_desc,
            "Intro_Text": intro_text,
            "Word_List": word_list,
            "SEO_Body": seo_body
        })

        # 2. Build Category Navigation Tree for nav.json
        path_parts = [p.strip() for p in category_path.split('/') if p.strip()]
        if path_parts:
            insert_into_tree(nav_tree, path_parts, item)

        # 3. Create subfolders dynamically
        folder_path = os.path.join("passwords", *raw_slug.split('/'))
        os.makedirs(folder_path, exist_ok=True)

        # 4. Write index.html file
        html_file = os.path.join(folder_path, "index.html")
        content = HTML_TEMPLATE.format(
            meta_title=meta_title,
            meta_desc=meta_desc,
            h1_title=h1_title,
            intro_text=intro_text,
            seo_body=seo_body
        )
        with open(html_file, "w", encoding="utf-8") as f:
            f.write(content)

    # Save output JSON files
    os.makedirs("data", exist_ok=True)
    with open(os.path.join("data", "passwords.json"), "w", encoding="utf-8") as f:
        json.dump(json_dataset, f, indent=2)

    with open(os.path.join("data", "nav.json"), "w", encoding="utf-8") as f:
        json.dump(nav_tree, f, indent=2)

    print("Successfully updated pages, passwords.json, and hierarchical nav.json!")

if __name__ == "__main__":
    build_passwords()