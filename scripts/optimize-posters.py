"""Make small WebP copies of the release posters for the website.

The originals in Posters/ are 2000-3000 px and up to 8 MB each, but a poster
card is at most ~420 px wide. This writes Posters/web/<name>-480.webp and
<name>-960.webp (the 960 version covers high-density screens). The originals
are left untouched.

Run after adding or replacing a poster:  python scripts/optimize-posters.py
"""

import re
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "Posters"
OUTPUT = SOURCE / "web"
WIDTHS = (480, 960)
QUALITY = 80


def slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def main() -> int:
    OUTPUT.mkdir(exist_ok=True)
    for path in sorted(SOURCE.iterdir()):
        if path.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
            continue
        with Image.open(path) as image:
            image = image.convert("RGBA")
            # Flatten any transparency onto black, the card background.
            flat = Image.new("RGB", image.size, (0, 0, 0))
            flat.paste(image, mask=image.getchannel("A"))
            for width in WIDTHS:
                target = OUTPUT / f"{slug(path.stem)}-{width}.webp"
                height = round(flat.height * width / flat.width)
                flat.resize((width, height), Image.LANCZOS).save(
                    target, "WEBP", quality=QUALITY, method=6
                )
                print(f"{target.relative_to(ROOT)}  {target.stat().st_size // 1024} KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
