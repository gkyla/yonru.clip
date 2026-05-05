import os
import requests
import json
import re

# Configuration
FONT_DIR = "frontend/app/assets/fonts"
CSS_FILE = "frontend/app/assets/css/fonts.css"
API_BASE = "https://gwfh.mranftl.com/api/fonts"

FONTS = [
    {"name": "Montserrat", "id": "montserrat"},
    {"name": "Inter", "id": "inter"},
    {"name": "Bebas Neue", "id": "bebas-neue"},
    {"name": "Oswald", "id": "oswald"},
    {"name": "Poppins", "id": "poppins"},
    {"name": "Outfit", "id": "outfit"},
    {"name": "Noto Sans", "id": "noto-sans"},
    {"name": "Roboto Condensed", "id": "roboto-condensed"},
    {"name": "Playfair Display", "id": "playfair-display"},
    {"name": "Anton", "id": "anton"},
    {"name": "Bangers", "id": "bangers"},
    {"name": "Permanent Marker", "id": "permanent-marker"},
    {"name": "Russo One", "id": "russo-one"},
    {"name": "Teko", "id": "teko"},
    {"name": "Luckiest Guy", "id": "luckiest-guy"},
    {"name": "Titan One", "id": "titan-one"},
    {"name": "Lilita One", "id": "lilita-one"},
    {"name": "Passion One", "id": "passion-one"},
]

def download_file(url, dest):
    print(f"Downloading {url} to {dest}...")
    response = requests.get(url, stream=True)
    if response.status_code == 200:
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with open(dest, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
    else:
        print(f"Failed to download {url}")

def main():
    if not os.path.exists(os.path.dirname(CSS_FILE)):
        os.makedirs(os.path.dirname(CSS_FILE), exist_ok=True)
    
    css_content = []

    for font in FONTS:
        print(f"\nProcessing {font['name']}...")
        font_id = font['id']
        url = f"{API_BASE}/{font_id}?subsets=latin"
        
        try:
            res = requests.get(url)
            if res.status_code != 200:
                print(f"Font {font_id} not found on GWFH")
                continue
            
            data = res.json()
            variants = data.get('variants', [])
            
            for variant in variants:
                weight = variant.get('fontWeight')
                style = variant.get('fontStyle')
                
                # We prioritize woff2
                woff2_url = variant.get('woff2')
                if not woff2_url:
                    print(f"No woff2 for {font_id} {weight} {style}")
                    continue
                
                filename = f"{font_id}-{weight}-{style}.woff2"
                dest_path = os.path.join(FONT_DIR, font_id, filename)
                
                # Download
                download_file(woff2_url, dest_path)
                
                # Relative path for CSS
                rel_path = f"../fonts/{font_id}/{filename}"
                
                # Build @font-face
                css_content.append(f"""
@font-face {{
  font-family: '{font['name']}';
  font-style: {style};
  font-weight: {weight};
  font-display: swap;
  src: url('{rel_path}') format('woff2');
}}""")
                
        except Exception as e:
            print(f"Error processing {font_id}: {e}")

    with open(CSS_FILE, 'w') as f:
        f.write("\n".join(css_content))
    
    print(f"\nDone! CSS generated at {CSS_FILE}")

if __name__ == "__main__":
    main()
