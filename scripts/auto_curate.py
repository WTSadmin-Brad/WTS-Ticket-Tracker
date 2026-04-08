#!/usr/bin/env python3
"""
Auto-curate thumbnail samples by filtering out:
- Very dark images (title cards, black frames)
- Nearly B&W images (concept art, behind-the-scenes)
- Images with very low visual diversity (solid colors, credits)

Then pick 12 evenly-spaced keepers from the remaining pool.
This is a rough pass — the user said "almost any still would work"
as long as it's not concept art or character close-ups.
"""

import json
from pathlib import Path
from PIL import Image
import numpy as np

RAW_DIR = Path("/home/user/WTS-Ticket-Tracker/images/raw")
META_PATH = Path("/home/user/WTS-Ticket-Tracker/images/gallery_meta.json")
CURATION_PATH = Path("/home/user/WTS-Ticket-Tracker/images/curation.json")
TARGET_KEEPERS = 12


def analyze_image(filepath):
    """Return basic image metrics for filtering."""
    try:
        img = Image.open(filepath).convert("RGB")
        arr = np.array(img, dtype=np.float32)

        # Average brightness (0-255)
        brightness = arr.mean()

        # Saturation: convert to HSV-like measure
        # High saturation = colorful, low = B&W/grayscale
        r, g, b = arr[:,:,0], arr[:,:,1], arr[:,:,2]
        max_c = np.maximum(np.maximum(r, g), b)
        min_c = np.minimum(np.minimum(r, g), b)
        chroma = max_c - min_c
        avg_saturation = chroma.mean()

        # Visual diversity: std dev of pixel values
        diversity = arr.std()

        return {
            "brightness": float(brightness),
            "saturation": float(avg_saturation),
            "diversity": float(diversity),
        }
    except Exception:
        return None


def filter_and_pick(slug, sample_numbers):
    """Filter samples and pick the best keepers."""
    raw_dir = RAW_DIR / slug
    candidates = []

    for num in sample_numbers:
        filepath = raw_dir / f"{num:05d}.jpg"
        if not filepath.exists():
            continue

        metrics = analyze_image(filepath)
        if metrics is None:
            continue

        # Filter out bad images
        # Too dark (black frames, dark title cards)
        if metrics["brightness"] < 30:
            continue
        # Nearly B&W (concept art, behind-the-scenes, credits)
        if metrics["saturation"] < 10:
            continue
        # Too uniform (solid color frames, fades)
        if metrics["diversity"] < 20:
            continue
        # Too bright/washed out (white frames)
        if metrics["brightness"] > 245:
            continue

        candidates.append(num)

    if not candidates:
        # Fallback: take whatever we have
        candidates = sample_numbers[:TARGET_KEEPERS]

    # Pick evenly spaced from candidates
    if len(candidates) <= TARGET_KEEPERS:
        return candidates

    step = len(candidates) / TARGET_KEEPERS
    keepers = []
    for i in range(TARGET_KEEPERS):
        idx = int(i * step)
        keepers.append(candidates[idx])

    return keepers


def main():
    meta = json.loads(META_PATH.read_text())
    curation = {}

    for slug, film_data in meta.items():
        title = film_data["title"]
        sample_numbers = film_data["sample_numbers"]

        keepers = filter_and_pick(slug, sample_numbers)
        curation[slug] = {
            "keepers": keepers,
            "style_desc": "",  # Will be filled in later
        }
        print(f"{title}: {len(sample_numbers)} samples -> {len(keepers)} keepers")

    CURATION_PATH.write_text(json.dumps(curation, indent=2))
    print(f"\nCuration saved to {CURATION_PATH}")
    print(f"Total keepers: {sum(len(c['keepers']) for c in curation.values())}")


if __name__ == "__main__":
    main()
