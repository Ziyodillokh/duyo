"""Compose the CTA banner's circular artwork: the DUYO robot and the raccoon.

The mockup (section-cta-banner.png) puts a bright circular scene on the right of
the blue banner. This builds that disc from the app's own two mascots instead of
a stock render, so the banner shows the characters a child actually meets.

Both source renders are 1024x1024 with a soft baked glow, so placement is driven
by the OPAQUE bounds, not the alpha bbox — otherwise the glow acts as invisible
padding and the two characters end up standing at different heights.

Usage: uv run --no-project --with pillow python make-cta-art.py
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

HERE = Path(__file__).resolve().parent
SRC = HERE.parents[2] / "duyo-mobile" / "assets" / "duyo" / "v2"
DST = HERE / "cta-art.png"

SIZE = 1100          # disc rendered at ~320px, so ~3x for retina
# The mockup's disc is a full-bleed illustration; at these heights the pair
# fills ~72% of the diameter instead of floating in the middle of it.
ROBOT_H = 720        # character heights inside the disc
RACCOON_H = 575      # the raccoon reads as the smaller sidekick
BASELINE = 0.86      # feet sit here, as a fraction of the disc

# Raccoon LEFT, robot RIGHT. Each render raises a hand on its own outer side
# (the raccoon's on image-left, the robot's on image-right), so this order is
# the one where both waves stay visible instead of being buried in the overlap.
RACCOON_X = 0.28
ROBOT_X = 0.66


def opaque_box(im, threshold=200):
    """Bounds of the solidly-drawn character, ignoring the baked glow."""
    a = im.getchannel("A")
    px = a.load()
    w, h = im.size
    xs, ys = [], []
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            if px[x, y] > threshold:
                xs.append(x)
                ys.append(y)
    return min(xs), min(ys), max(xs) + 1, max(ys) + 1


def load(name, target_h):
    im = Image.open(SRC / name).convert("RGBA")
    box = opaque_box(im)
    # Crop to the glow bbox but scale by the OPAQUE height, so both characters
    # are sized by their bodies and keep their glow.
    glow = im.getchannel("A").getbbox()
    im = im.crop(glow)
    scale = target_h / (box[3] - box[1])
    im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    # Where the feet sit inside the scaled crop.
    feet = (box[3] - glow[1]) * scale
    return im, feet


canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))

# Bright disc so the characters read against the blue banner, tinted with the
# brand sky rather than plain white.
disc = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
d = ImageDraw.Draw(disc)
for i in range(SIZE // 2, 0, -1):
    t = i / (SIZE / 2)
    # #DCE8FF edge -> #FFFFFF centre: tinted enough to read as its own object
    # against the blue banner rather than washing into it.
    c = (round(255 - 35 * t), round(255 - 23 * t), 255, 255)
    d.ellipse([SIZE // 2 - i, SIZE // 2 - i, SIZE // 2 + i, SIZE // 2 + i], fill=c)
canvas.alpha_composite(disc)

# Soft ground shadow under both characters.
shadow = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
sd = ImageDraw.Draw(shadow)
by = round(SIZE * BASELINE)
sd.ellipse([SIZE * 0.20, by - 34, SIZE * 0.82, by + 34], fill=(37, 99, 235, 38))
canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(26)))

robot, r_feet = load("mascot-default.png", ROBOT_H)
raccoon, c_feet = load("mascot-raccoon.png", RACCOON_H)

# Raccoon first so the robot, the larger character, sits in front where they meet.
cx = round(SIZE * RACCOON_X)
canvas.alpha_composite(raccoon, (cx - raccoon.width // 2, by - round(c_feet)))

rx = round(SIZE * ROBOT_X)
canvas.alpha_composite(robot, (rx - robot.width // 2, by - round(r_feet)))

# Clip everything to the disc.
mask = Image.new("L", (SIZE, SIZE), 0)
ImageDraw.Draw(mask).ellipse([0, 0, SIZE - 1, SIZE - 1], fill=255)
out = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
out.paste(canvas, (0, 0), mask)
out.save(DST, optimize=True)

print(f"wrote {DST.name}  {out.size}  {DST.stat().st_size // 1024} KB")
