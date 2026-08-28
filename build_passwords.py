

import csv
import json
import os
import urllib.request

PASSWORDS_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSbdhn9SqIHgrMpqTdkBbl-enWc18IWbX8ixuxjJY6SYdaaNoQrkUZ9cLunkewSy1HqJILhKR5comZD/pub?gid=0&single=true&output=csv"

def fetch_csv(url):
    req = urllib.request.urlopen(url)
    csv_data = req.read().decode('utf-8').splitlines()
    return list(csv.DictReader(csv_data))

def build_passwords():
    print("Fetching sheet data...")
    rows = fetch_csv(PASSWORDS_CSV_URL)
    
    json_dataset = []
    nav_links = []

    for row in rows:
        slug = row.get("Slug", "").strip()
        h1_title = row.get("H1_Title", "").strip()
        
        if not slug:
            continue

        # Add to full dataset
        json_dataset.append({
            "Slug": slug,
            "H1_Title": h1_title,
            "Meta_Title": row.get("Meta_Title", ""),
            "Meta_Desc": row.get("Meta_Desc", ""),
            "Intro_Text": row.get("Intro_Text", ""),
            "Word_List": row.get("Word_List", ""),
            "SEO_Body": row.get("SEO_Body", "")
        })

        # Add to Navigation structure
        nav_links.append({
            "title": h1_title,
            "url": f"/Cubit.Tools/passwords/{slug}/"
        })

    # Save data/passwords.json
    os.makedirs("data", exist_ok=True)
    with open(os.path.join("data", "passwords.json"), "w", encoding="utf-8") as f:
        json.dump(json_dataset, f, indent=2)

    # Save data/nav.json for dynamic header/footer navigation
    with open(os.path.join("data", "nav.json"), "w", encoding="utf-8") as f:
        json.dump(nav_links, f, indent=2)

    print("Successfully updated passwords.json and nav.json!")

if __name__ == "__main__":
    build_passwords()