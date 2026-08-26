import csv
import json
import os
import urllib.request

# Replace with your published CSV URL for the Password_Generators tab
PASSWORDS_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSbdhn9SqIHgrMpqTdkBbl-enWc18IWbX8ixuxjJY6SYdaaNoQrkUZ9cLunkewSy1HqJILhKR5comZD/pub?gid=0&single=true&output=csv"

HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title id="meta-title">{meta_title}</title>
  <meta id="meta-desc" name="description" content="{meta_desc}">
  <link rel="stylesheet" href="../../css/style.css">
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

  <script src="../../js/app.js" defer></script>
</body>
</html>
"""

def fetch_csv(url):
    req = urllib.request.urlopen(url)
    csv_data = req.read().decode('utf-8').splitlines()
    return list(csv.DictReader(csv_data))

def build_passwords():
    print("Fetching Password_Generators tab from Google Sheets...")
    rows = fetch_csv(PASSWORDS_CSV_URL)
    
    json_dataset = []

    for row in rows:
        slug = row.get("Slug", "").strip()
        if not slug:
            continue

        h1_title = row.get("H1_Title", "")
        meta_title = row.get("Meta_Title", "")
        meta_desc = row.get("Meta_Desc", "")
        intro_text = row.get("Intro_Text", "")
        word_list = row.get("Word_List", "")
        seo_body = row.get("SEO_Body", "")

        json_dataset.append({
            "Slug": slug,
            "H1_Title": h1_title,
            "Meta_Title": meta_title,
            "Meta_Desc": meta_desc,
            "Intro_Text": intro_text,
            "Word_List": word_list,
            "SEO_Body": seo_body
        })

        # Generate subfolder passwords/{slug}/index.html
        folder_path = os.path.join("passwords", slug)
        os.makedirs(folder_path, exist_ok=True)

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

        print(f"Generated: {html_file}")

    # Overwrite data/passwords.json
    os.makedirs("data", exist_ok=True)
    json_file = os.path.join("data", "passwords.json")
    with open(json_file, "w", encoding="utf-8") as f:
        json.dump(json_dataset, f, indent=2)

    print(f"Updated: {json_file}")

if __name__ == "__main__":
    build_passwords()