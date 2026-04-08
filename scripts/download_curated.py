#!/usr/bin/env python3
"""
Download full-resolution images for curated selections.
Reads curation decisions from images/curation.json and gallery metadata
from images/gallery_meta.json. Outputs to images/curated/{slug}/.
Also generates site/data.json for the lookbook site.
"""

import json
import time
import sys
from pathlib import Path

import requests

CURATED_DIR = Path("/home/user/WTS-Ticket-Tracker/images/curated")
META_PATH = Path("/home/user/WTS-Ticket-Tracker/images/gallery_meta.json")
CURATION_PATH = Path("/home/user/WTS-Ticket-Tracker/images/curation.json")
SITE_DATA_PATH = Path("/home/user/WTS-Ticket-Tracker/site/data.json")
REQUEST_DELAY = 0.4

session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0",
    "Referer": "https://animationscreencaps.com/",
    "Accept": "image/webp,image/apng,image/*,*/*;q=0.8",
})


def main():
    meta = json.loads(META_PATH.read_text())
    curation = json.loads(CURATION_PATH.read_text())

    site_data = []

    for slug, decisions in curation.items():
        if slug not in meta:
            print(f"SKIP {slug}: not in gallery metadata")
            continue

        film_meta = meta[slug]
        keepers = decisions["keepers"]
        style_desc = decisions.get("style_desc", "")
        title = film_meta["title"]
        studio = film_meta["studio"]
        fullres_template = film_meta["fullres_template"]
        thumb_template = film_meta["thumb_template"]

        out_dir = CURATED_DIR / slug
        out_dir.mkdir(parents=True, exist_ok=True)

        print(f"\n{title} ({slug}): {len(keepers)} images")

        images = []
        for num in keepers:
            filepath = out_dir / f"{num:05d}.jpg"

            if not filepath.exists() or filepath.stat().st_size < 1000:
                url = fullres_template.replace("{N}", str(num))
                try:
                    resp = session.get(url, timeout=30)
                    if resp.status_code == 200 and len(resp.content) > 1000:
                        filepath.write_bytes(resp.content)
                        print(f"  Downloaded {num}")
                    else:
                        print(f"  FAILED {num}: {resp.status_code}")
                        continue
                    time.sleep(REQUEST_DELAY)
                except Exception as e:
                    print(f"  ERROR {num}: {e}")
                    continue
            else:
                print(f"  Cached {num}")

            images.append({
                "num": num,
                "thumb": thumb_template.replace("{N}", str(num)),
                "fullres": fullres_template.replace("{N}", str(num)),
                "local": f"../images/curated/{slug}/{num:05d}.jpg",
            })

        site_data.append({
            "title": title,
            "slug": slug,
            "studio": studio,
            "styleDesc": style_desc,
            "images": images,
        })

    # Sort by title
    site_data.sort(key=lambda x: x["title"])

    SITE_DATA_PATH.write_text(json.dumps(site_data, indent=2))
    print(f"\nSite data written to {SITE_DATA_PATH}")
    print(f"Total: {sum(len(f['images']) for f in site_data)} images across {len(site_data)} films")


if __name__ == "__main__":
    main()
