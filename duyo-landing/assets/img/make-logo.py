"""Write the landing page's logo.png from the mobile app's v2 mascot render.

The navbar/footer mark is a 44px transparent slot (background: none) that the
site fills with assets/img/logo.png, falling back to an inline SVG of a robot
head when the file is missing.

The whole mascot goes in, trimmed to its own alpha bounding box so no part of
it is cut and no empty padding shrinks it inside the 44px slot. An earlier
version cropped just the head; at logo size that read as a robot with its chin
sliced off.

Usage: uv run --no-project --with pillow python make-logo.py
"""

from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
SRC = HERE.parents[2] / "duyo-mobile" / "assets" / "duyo" / "v2" / "mascot-default.png"
DST = HERE / "logo.png"

TARGET_H = 320  # ~3x the tallest the mark reaches on a retina screen

im = Image.open(SRC).convert("RGBA")
im = im.crop(im.getchannel("A").getbbox())
w, h = im.size
im = im.resize((round(w * TARGET_H / h), TARGET_H), Image.LANCZOS)
im.save(DST, optimize=True)

print(f"wrote {DST}  {im.size[0]}x{im.size[1]}")
