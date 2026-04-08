#!/usr/bin/env python3
"""
Download evenly-spaced thumbnail samples from AnimationScreencaps.com CDN.
CDN URLs were discovered via WebFetch probe of each film's gallery page.
"""

import os
import re
import sys
import time
import json
import subprocess
from pathlib import Path

import requests

RAW_DIR = Path("/home/user/WTS-Ticket-Tracker/images/raw")
CONTACT_DIR = Path("/home/user/WTS-Ticket-Tracker/images/contact_sheets")
SAMPLES_PER_FILM = 50
REQUEST_DELAY = 0.3
IMAGES_PER_PAGE = 60  # conservative estimate; 404s are handled gracefully

# Each entry: (title, slug, studio, thumb_url_template, total_pages)
# thumb_url_template uses {N} as placeholder for image number
FILMS = [
    ("The Incredibles", "the-incredibles", "Pixar",
     "https://caps2.b-cdn.net/200/4-incredibles/full/incredibles-disneyscreencaps.com-{N}.jpg?class=thumbnail", 72),
    ("Incredibles 2", "incredibles-2", "Pixar",
     "https://caps.b-cdn.net/201/8-incredibles2/full/incredibles2-animationscreencaps.com-{N}.jpg?class=thumbnail", 73),
    ("Big Hero 6", "big-hero-6", "Disney",
     "https://caps.b-cdn.net/201/4-big-hero-6/full/big-hero-6-disneyscreencaps.com-{N}.jpg?class=thumbnail", 62),
    ("Toy Story", "toy-story", "Pixar",
     "https://caps2.b-cdn.net/199/5-toy-story/full/toy-story-disneyscreencaps.com-{N}.jpg?class=thumbnail", 51),
    ("Toy Story 2", "toy-story-2", "Pixar",
     "https://caps2.b-cdn.net/199/9-toy-story2/full/toy-story2-disneyscreencaps.com-{N}.jpg?class=thumbnail", 60),
    ("Toy Story 3", "toy-story-3", "Pixar",
     "https://caps2.b-cdn.net/201/0-toy-story3/full/toy-story3-disneyscreencaps.com-{N}.jpg?class=thumbnail", 65),
    ("Toy Story 4", "toy-story-4", "Pixar",
     "https://caps.b-cdn.net/201/9-toystory4/full/toystory4-animationscreencaps.com-{N}.jpg?class=thumbnail", 61),
    ("Ratatouille", "ratatouille", "Pixar",
     "https://caps2.b-cdn.net/200/7-ratatouille/full/ratatouille-disneyscreencaps.com-{N}.jpg?class=thumbnail", 70),
    ("Soul", "soul", "Pixar",
     "https://caps.b-cdn.net/202/0-soul/full/soul-animationscreencaps.com-{N}.jpg?class=thumbnail", 65),
    ("Turning Red", "turning-red", "Pixar",
     "https://caps.b-cdn.net/202/2-turningred/full/turningred-animationscreencaps.com-{N}.jpg?class=thumbnail", 65),
    ("Luca", "luca", "Pixar",
     "https://caps.b-cdn.net/202/1-luca/full/luca-animationscreencaps.com-{N}.jpg?class=thumbnail", 61),
    ("Coco", "coco", "Pixar",
     "https://caps.b-cdn.net/201/7-coco/full/coco-disneyscreencaps.com-{N}.jpg?class=thumbnail", 63),
    ("Inside Out", "inside-out", "Pixar",
     "https://caps.b-cdn.net/201/5-insideout/full/insideout-animationscreencaps.com-{N}.jpg?class=thumbnail", 61),
    ("Inside Out 2", "inside-out-2", "Pixar",
     "https://caps.b-cdn.net/202/4-insideout2/full/insideout2-animationscreencaps.com-{N}.jpg?class=thumbnail", 63),
    ("Elemental", "elemental", "Pixar",
     "https://caps.b-cdn.net/202/3-elemental/full/elemental-animationscreencaps.com-{N}.jpg?class=thumbnail", 66),
    ("Onward", "onward", "Pixar",
     "https://caps.b-cdn.net/202/0-onward/full/onward-animationscreencaps.com-{N}.jpg?class=thumbnail", 62),
    ("Strange World", "strange-world", "Disney",
     "https://caps.b-cdn.net/202/2-strangeworld/full/strangeworld-animationscreencaps.com-{N}.jpg?class=thumbnail", 62),
    ("Encanto", "encanto", "Disney",
     "https://caps.b-cdn.net/202/1-encanto/full/encanto-animationscreencaps.com-{N}.jpg?class=thumbnail", 66),
    ("Frozen", "frozen", "Disney",
     "https://caps.b-cdn.net/201/3-frozenbr/full/frozen-disneyscreencaps.com-{N}.jpg?class=thumbnail", 61),
    ("Frozen II", "frozen-ii", "Disney",
     "https://caps.b-cdn.net/201/9-frozen2/full/frozen2-animationscreencaps.com-{N}.jpg?class=thumbnail", 61),
    ("Wreck-It Ralph", "wreck-it-ralph", "Disney",
     "https://caps.b-cdn.net/201/2-wreck-it-ralph/full/wreck-it-ralph-disneyscreencaps.com-{N}.jpg?class=thumbnail", 63),
    ("Ralph Breaks the Internet", "ralph-breaks-the-internet", "Disney",
     "https://caps.b-cdn.net/201/8-ralphbreaks/full/ralphbreaksinternet-animationscreencaps.com-{N}.jpg?class=thumbnail", 67),
    ("The Mitchells vs. the Machines", "mitchells-vs-machines", "Sony",
     "https://caps.b-cdn.net/202/1-mitchellmachine/full/mitchellsvsmachines-animationscreencaps.com-{N}.jpg?class=thumbnail", 73),
    ("Spider-Man: Into the Spider-Verse", "spider-man-into-spider-verse", "Sony",
     "https://caps.b-cdn.net/201/8-spidermaninto/full/into-spiderverse-animationscreencaps.com-{N}.jpg?class=thumbnail", 72),
    ("Despicable Me", "despicable-me", "Illumination",
     "https://caps2.b-cdn.net/201/0-despicable-me/full/despicable-me-disneyscreencaps.com-{N}.jpg?class=thumbnail", 60),
    ("Despicable Me 2", "despicable-me-2", "Illumination",
     "https://caps.b-cdn.net/201/4k-3-despicableme2/full/4k-despicableme2-animationscreencaps.com-{N}.jpg?class=thumbnail", 35),
    ("Despicable Me 3", "despicable-me-3", "Illumination",
     "https://caps.b-cdn.net/201/4k-7-despicableme3/full/4kdespicableme3-animationscreencaps.com-{N}.jpg?class=thumbnail", 46),
    ("Sing", "sing", "Illumination",
     "https://caps.b-cdn.net/201/6-sing/full/sing-animationscreencaps.com-{N}.jpg?class=thumbnail", 67),
    ("Sing 2", "sing-2", "Illumination",
     "https://caps.b-cdn.net/202/1-sing2/full/sing2-animationscreencaps.com-{N}.jpg?class=thumbnail", 74),
    ("The Secret Life of Pets", "secret-life-of-pets", "Illumination",
     "https://caps.b-cdn.net/201/6-secret-life-pets/full/secret-life-pets-disneyscreencaps.com-{N}.jpg?class=thumbnail", 54),
    ("The Secret Life of Pets 2", "secret-life-of-pets-2", "Illumination",
     "https://caps.b-cdn.net/201/9-secretlifepets2/full/secretlifeofpets2-animationscreencaps.com-{N}.jpg?class=thumbnail", 53),
    ("Ron's Gone Wrong", "rons-gone-wrong", "Locksmith",
     "https://caps.b-cdn.net/202/1-ronwrong/full/ronsgonewrong-animationscreencaps.com-{N}.jpg?class=thumbnail", 72),
    ("Hotel Transylvania", "hotel-transylvania", "Sony",
     "https://caps2.b-cdn.net/201/2-hotel-transylvania/full/hotel-transylvania-disneyscreencaps.com-{N}.jpg?class=thumbnail", 57),
    ("Hotel Transylvania 2", "hotel-transylvania-2", "Sony",
     "https://caps.b-cdn.net/201/5-hoteltransyl2/full/hotel2-disneyscreencaps.com-{N}.jpg?class=thumbnail", 55),
    ("Hotel Transylvania 3", "hotel-transylvania-3", "Sony",
     "https://caps.b-cdn.net/201/8-hoteltransylvania3/full/hotel3-animationscreencaps.com-{N}.jpg?class=thumbnail", 60),
    ("Hotel Transylvania: Transformania", "hotel-transylvania-transformania", "Sony",
     "https://caps.b-cdn.net/202/2-transformania/full/hoteltransformania-animationscreencaps.com-{N}.jpg?class=thumbnail", 58),
    ("Monsters University", "monsters-university", "Pixar",
     "https://caps.b-cdn.net/201/3-monsters-university/full/monsters-university-disneyscreencaps.com-{N}.jpg?class=thumbnail", 63),
    ("Monsters, Inc.", "monsters-inc", "Pixar",
     "https://caps2.b-cdn.net/200/1-monsters-inc/full/monsters-inc-disneyscreencaps.com-{N}.jpg?class=thumbnail", 57),
    ("Nimona", "nimona", "Netflix",
     "https://caps.b-cdn.net/202/3-nimona/full/nimona-animationscreencaps.com-{N}.jpg?class=thumbnail", 62),
    ("TMNT: Mutant Mayhem", "tmnt-mutant-mayhem", "Paramount",
     "https://caps.b-cdn.net/202/3-teenagemutantmayhem/full/mutantmayhem-animationscreencaps.com-{N}.jpg?class=thumbnail", 66),
    ("The Bad Guys", "the-bad-guys", "DreamWorks",
     "https://caps.b-cdn.net/202/4k-2-badguys/full/badguys-animationscreencaps.com-{N}.jpg?class=thumbnail", 70),
]

session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0",
    "Referer": "https://animationscreencaps.com/",
    "Accept": "image/webp,image/apng,image/*,*/*;q=0.8",
})


def download_samples(title, slug, thumb_template, total_pages):
    """Download evenly-spaced thumbnail samples for one film."""
    out_dir = RAW_DIR / slug
    out_dir.mkdir(parents=True, exist_ok=True)

    total_images = total_pages * IMAGES_PER_PAGE
    step = max(1, total_images // SAMPLES_PER_FILM)
    sample_numbers = list(range(1, total_images + 1, step))[:SAMPLES_PER_FILM]

    downloaded = []
    skipped = 0
    for num in sample_numbers:
        filepath = out_dir / f"{num:05d}.jpg"
        if filepath.exists() and filepath.stat().st_size > 500:
            downloaded.append(num)
            continue

        url = thumb_template.replace("{N}", str(num))
        try:
            resp = session.get(url, timeout=15)
            if resp.status_code == 200 and len(resp.content) > 500:
                filepath.write_bytes(resp.content)
                downloaded.append(num)
            else:
                skipped += 1
            time.sleep(REQUEST_DELAY)
        except Exception as e:
            skipped += 1

    return downloaded, skipped


def make_contact_sheets(slug):
    """Create contact sheet montages using ImageMagick."""
    raw_dir = RAW_DIR / slug
    images = sorted(raw_dir.glob("*.jpg"))
    if not images:
        return []

    CONTACT_DIR.mkdir(parents=True, exist_ok=True)
    sheets = []

    for i in range(0, len(images), 25):
        batch = images[i:i+25]
        sheet_path = CONTACT_DIR / f"{slug}_sheet{i//25 + 1}.jpg"

        # Determine grid dimensions
        cols = 5
        rows = (len(batch) + cols - 1) // cols

        cmd = [
            "montage",
            *[str(p) for p in batch],
            "-tile", f"{cols}x{rows}",
            "-geometry", "320x180+4+4",
            "-background", "#1a1a1a",
            str(sheet_path),
        ]
        try:
            subprocess.run(cmd, check=True, capture_output=True, timeout=60)
            sheets.append(str(sheet_path))
        except subprocess.CalledProcessError as e:
            print(f"    Montage error: {e.stderr.decode()[:200]}")

    return sheets


def build_fullres_template(thumb_template):
    """Convert thumbnail CDN URL to full-resolution URL."""
    fullres = thumb_template.replace("caps2.b-cdn.net", "i0.wp.com/img.screencaps.us")
    fullres = fullres.replace("caps.b-cdn.net", "i0.wp.com/img.screencaps.us")
    fullres = re.sub(r'\?class=thumbnail$', '?ssl=1', fullres)
    if '?' not in fullres:
        fullres += '?ssl=1'
    return fullres


def main():
    start_idx = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    end_idx = int(sys.argv[2]) if len(sys.argv) > 2 else len(FILMS)

    results = {}
    failed = []

    for idx, (title, slug, studio, thumb_template, total_pages) in enumerate(FILMS[start_idx:end_idx], start=start_idx):
        print(f"\n[{idx+1}/{len(FILMS)}] {title}")

        downloaded, skipped = download_samples(title, slug, thumb_template, total_pages)
        print(f"  Downloaded: {len(downloaded)}, Skipped: {skipped}")

        sheets = make_contact_sheets(slug)
        print(f"  Contact sheets: {len(sheets)}")

        fullres_template = build_fullres_template(thumb_template)

        results[slug] = {
            "title": title,
            "studio": studio,
            "slug": slug,
            "total_pages": total_pages,
            "thumb_template": thumb_template,
            "fullres_template": fullres_template,
            "sample_numbers": downloaded,
            "contact_sheets": sheets,
        }

    # Save metadata
    meta_path = Path("/home/user/WTS-Ticket-Tracker/images/gallery_meta.json")
    existing = {}
    if meta_path.exists():
        existing = json.loads(meta_path.read_text())
    existing.update(results)
    meta_path.write_text(json.dumps(existing, indent=2))

    print(f"\n{'='*50}")
    print(f"Done! {len(results)} films processed.")
    if failed:
        print(f"Failed: {', '.join(f[0] for f in failed)}")


if __name__ == "__main__":
    main()
