"""Turn the raw captures into the site's assets.

Writes, into duyo-web/src/assets/app-screens/:
  <name>.webp     every capture, WebP at quality 90
  captures.ts     the generated module the site imports: each capture's URL,
                  clock and ground colour, and every measurement the phone's
                  screen needs to animate between states (list viewports,
                  scroll distances, chalk lines, typed fields, progress bar)
  manifest.json   what each state shows, for people
and a contact sheet beside this script for review.

Why WebP q90: an earlier PNG pass kept 6 bits per channel to save bytes, and
that banded the map's nebula and striped the light gradients. q90 WebP is
smaller than that was (about 0.8 MB for the set) and shows neither; at the
size the phone is drawn its compression is not visible.

Every number the site uses comes from here, measured in the capture run
(raw/meta.json, from the app's own DOM) or off the pixels below, so a
recapture cannot leave the site animating against stale geometry.
"""

import json
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).parent
RAW = HERE / "raw"
# duyo-web/scripts/app-capture/finish.py -> duyo-web and the app beside it.
WEB = Path(__file__).resolve().parents[2]
DEST = WEB / "src" / "assets" / "app-screens"
SHEET = HERE / "sheet.png"
QUALITY = 90
STATUS_BAR_DP = 24
NAV_BAR_DP = 16
SCALE = 2

NOTES = {
    "chat": (
        "AI Chat tab (src/app/(main)/(tabs)/chat.tsx). "
        "1: empty chat — DUYO AI hero (Onlayn), daily counter 20/20, greeting to Sardor, suggested replies. "
        "2: the question '2x² + 5x + 3 = 0 tenglamani yechib ber' sent (one tick) with DUYO's typing dots — "
        "in the app 'sent' and 'thinking' are the same moment. "
        "3: DUYO's reply and the finished chalkboard (components/chalkboard.tsx), the list scrolled back up "
        "until the whole question shows; the site hides the lines not yet written and writes them in. "
        "4: the same, the list at its newest end — a = 2, b = 5, c = 3; D = 25 − 24 = 1; x₁ = −1; x₂ = −1,5; "
        "answer underlined in yellow."
    ),
    "safety": (
        "Goal room 'Kitoblar' (src/screens/goals/group-screen.tsx) with the permanent safety notice. "
        "1: the conversation between Yulduz-73, Lochin-58, Burgut-42 and the child (Shunqor-17). "
        "2: the child tried to send 'Raqamim: 90 000 00 00'; the server's real contact_info refusal "
        "(duyo-backend api/v1/social.py) is shown to the sender only, the draft stays in the composer, "
        "nothing reaches the room."
    ),
    "map": (
        "DUYO MIYA full-screen map (src/screens/brain/brain-screen.tsx, opened from the Miya tab's expand button) "
        "over assets/images/brain-backdrop.jpg. "
        "1: 5 notes — Matematika, Kvadrat tenglama, Fizika, Adabiyot, O'tkan kunlar — with their #tags. "
        "2: 16 notes — adds Parabola, Gravitatsiya, Geologiya, Vulqonlar, Yer tuzilishi, Qodiriy and the "
        "gold #maqsad goal path DUYO writes when it splits a goal into steps (1-qadam … 4-qadam). "
        "The tag chips read 0: the app's own counting bug (brain-screen.tsx compares tags without '#' "
        "against graph ids with it)."
    ),
    "goals": (
        "1: DUYO MIYA with the #maqsad chip on and the note list open — the goal and the four steps DUYO "
        "split it into (services/goal_paths.py writes them as linked notes). "
        "2–4: Maqsadlarim (src/app/(main)/my-goals.tsx → screens/goals/goals-screen.tsx): the goal "
        "'O'tkan kunlar romanini o'qib tugatish' counted in chapters, '7 ta bola ham shu maqsadda', and "
        "Maqsaddoshlar by nickname (Lochin-58, Yulduz-73). 2: 10 / 15 bob (67%). 3: '11' typed into "
        "'Nechanchi bob?', Saqlash lit. 4: saved — 11 / 15 bob (73%), the chapter the child names in the group."
    ),
    "home": (
        "Home tab (screens/home/glass-home.tsx): DUYO robot mascot in its halo, 'boshlash uchun bosing', "
        "AI KREDIT 1 250, Faollik 83%, Yutuqlar 7 (4 ochilgan), the Bir maqsad · DUYO · Neo Miyya dock."
    ),
}
ORDER = ["chat", "safety", "map", "goals", "home"]


def hexc(rgb) -> str:
    return "#{:02x}{:02x}{:02x}".format(*rgb[:3])


def edge_colour(im: Image.Image, rows) -> str:
    """The middle third of some rows: the ground a system bar sits on."""
    w = im.width
    px = [im.getpixel((x, y)) for y in rows for x in range(w // 3, 2 * w // 3)]
    return hexc(tuple(round(sum(c[i] for c in px) / len(px)) for i in range(3)))


def app_chalk() -> str:
    """The chalk colour, from the app's own source: the site draws its chalk tip."""
    src = (WEB.parent / "duyo-mobile" / "src" / "components" / "chalkboard.tsx").read_text()
    m = re.search(r"export const CHALK = '(#[0-9A-Fa-f]{6})'", src)
    if not m:
        raise SystemExit("CHALK not found in chalkboard.tsx")
    return m.group(1).lower()


def median_colour(im: Image.Image, box) -> str:
    x, y, w, h = box
    px = sorted(im.getpixel((xx, yy)) for yy in range(y, y + h, 3) for xx in range(x, x + w, 3))
    return hexc(px[len(px) // 2])


def slate_column(im: Image.Image, board: dict) -> int:
    """A column of bare slate beside every chalk line, top line to answer.

    The site covers what is not written yet with this column, stretched: the
    slate as it is at that height, the composer's shadow over it included,
    where a flat fill would show as a patch.
    """
    sx, sy, sw, sh = board["slate"]
    top = min(ln["rect"][1] for ln in board["lines"])
    bottom = max(ln["rect"][1] + ln["rect"][3] for ln in board["lines"])
    ground = im.getpixel((sx + sw // 2, sy + sh - 40))
    for col in range(sx + sw - 24, sx + sw // 2, -1):
        if all(max(abs(a - b) for a, b in zip(im.getpixel((col, y)), ground)) <= 14 for y in range(top, bottom)):
            return col
    raise SystemExit("no bare slate column beside the board's lines")


def typed(im: Image.Image, box) -> dict:
    """A one-line field's text, ready to type in: where each glyph ends.

    A column is ink where any pixel differs from the field's own ground (its
    blank right edge) by more than antialiasing; a glyph ends where its run of
    ink columns does. `blank` is a column of empty field the site stretches
    over what is not typed yet.
    """
    x, y, w, h = box
    blank = x + w - 2
    # The input's box can take in its own rounded border: keep only the rows
    # around its middle where the blank column is the field's ground.
    same = lambda a, b: max(abs(p - q) for p, q in zip(a, b)) <= 6  # noqa: E731
    mid = im.getpixel((blank, y + h // 2))
    top = y + h // 2
    while top > y and same(im.getpixel((blank, top - 1)), mid):
        top -= 1
    bottom = y + h // 2
    while bottom < y + h - 1 and same(im.getpixel((blank, bottom + 1)), mid):
        bottom += 1
    y, h = top, bottom - top + 1
    box = [x, y, w, h]
    if h < 20:
        raise SystemExit(f"field at {box} has no clean blank column")
    ground = [im.getpixel((blank, yy)) for yy in range(y, y + h)]

    def ink(xx: int) -> bool:
        return any(max(abs(a - b) for a, b in zip(im.getpixel((xx, y + i)), ground[i])) > 48 for i in range(h))

    cols = [ink(xx) for xx in range(x, x + w)]
    stops, prev = [], False
    for i, c in enumerate(cols + [False]):
        if prev and not c:
            stops.append(x + i)
        prev = c
    if not stops:
        raise SystemExit(f"no text found in field at {box}")
    return {"box": box, "stops": stops, "blank": blank}


def geometry(meta: dict, raw: dict) -> dict:
    band = lambda b: [b[1], b[1] + b[3]]  # noqa: E731 — [top, bottom] of a viewport box
    c4 = meta["chat-4"]
    board = c4["board"]
    chat = {
        "band": band(c4["band"]),
        "anchor": {k: meta[k]["anchor"][1] for k in ("chat-2", "chat-3", "chat-4")},
        "blank": slate_column(raw["chat-4"], board),
        "chalk": app_chalk(),
        "lines": [
            {"kind": ln["kind"], "box": ln["rect"], "size": ln.get("size", 0), "chars": len(ln["text"])}
            for ln in board["lines"]
        ],
        "answerBox": board["answerBox"],
    }
    s1, s2 = meta["safety-1"], meta["safety-2"]
    safety = {
        "band": band(s1["band"]),
        "anchor": {"safety-1": s1["anchor"][1], "safety-2": s2["anchor"][1]},
        "draft": typed(raw["safety-2"], s2["draft"]),
    }
    g3, g4 = meta["goals-3"], meta["goals-4"]
    goals = {
        "entry": typed(raw["goals-3"], g3["entry"]),
        "save": g3["save"],
        "track": g3["track"],
        "fill": {"goals-3": g3["fill"][2], "goals-4": g4["fill"][2]},
    }
    return {"chat": chat, "safety": safety, "goals": goals}


def ts_value(v, indent=0) -> str:
    pad = "  " * indent
    if isinstance(v, dict):
        items = []
        for k, x in v.items():
            key = k if k.isidentifier() else f"'{k}'"
            items.append(f"{pad}  {key}: {ts_value(x, indent + 1)},")
        return "{\n" + "\n".join(items) + f"\n{pad}}}"
    if isinstance(v, list) and all(isinstance(x, (int, float)) for x in v):
        return "[" + ", ".join(str(x) for x in v) + "]"
    if isinstance(v, list):
        return "[\n" + "\n".join(f"{pad}  {ts_value(x, indent + 1)}," for x in v) + f"\n{pad}]"
    if isinstance(v, str):
        return "'" + v.replace("\\", "\\\\").replace("'", "\\'") + "'"
    return json.dumps(v, ensure_ascii=False)


def write_module(shots: dict, geo: dict) -> None:
    ident = lambda name: name.replace("-", "_")  # noqa: E731
    first = next(iter(shots))
    # The film's first frame is inlined into the scene's chunk: the intro
    # starts playing when the scene does, and must not play over a blank.
    imports = "\n".join(
        f"import {ident(n)} from './{n}.webp{'?inline' if n == first else ''}';" for n in shots
    )
    rows = "\n".join(
        f"  '{n}': {{ src: {ident(n)}, clock: '{s['clock']}', top: '{s['top']}', bottom: '{s['bottom']}' }},"
        for n, s in shots.items()
    )
    src = f"""/**
 * GENERATED by the capture pipeline (capture/finish.py) — do not edit by
 * hand: recapture instead, and every number below is measured again.
 *
 * The DUYO app's screens as captured (see manifest.json for what each shows),
 * and what the site's phone needs to animate between them. Boxes are
 * [x, y, w, h] and positions y, in capture px: a capture is the phone face
 * below the status bar, 720 × 1492 (360 × 746 dp at 2×), gesture area
 * included.
 */
{imports}

/** Android's status bar, 24 dp: the inset the captures were laid out under and cropped by. */
export const STATUS_BAR_PX = {STATUS_BAR_DP * SCALE};
/** Android's gesture area, 16 dp: in the captures (the app's ground runs under it), handle not drawn. */
export const NAV_BAR_PX = {NAV_BAR_DP * SCALE};

export const SHOTS = {{
{rows}
}} as const;

export type ShotName = keyof typeof SHOTS;

export const GEOMETRY = {ts_value(geo)} as const;
"""
    (DEST / "captures.ts").write_text(src)


def main() -> int:
    DEST.mkdir(parents=True, exist_ok=True)
    meta = json.loads((RAW / "meta.json").read_text())
    if "--prune" in sys.argv:  # the PNG set this replaced
        for old in DEST.glob("*.png"):
            old.unlink()
    shots: dict[str, dict] = {}
    raw: dict[str, Image.Image] = {}
    manifest: dict[str, dict] = {}
    total = 0
    for screen in ORDER:
        names = sorted((p.stem for p in RAW.glob(f"{screen}-*.png")), key=lambda s: int(s.split("-")[1]))
        if not names:
            print(f"missing {screen}", file=sys.stderr)
            return 1
        for name in names:
            im = Image.open(RAW / f"{name}.png").convert("RGB")
            if im.size != (360 * SCALE, 746 * SCALE):
                raise SystemExit(f"{name}: unexpected size {im.size}")
            raw[name] = im
            out = DEST / f"{name}.webp"
            im.save(out, "WEBP", quality=QUALITY, method=6)
            total += out.stat().st_size
            shots[name] = {
                "clock": meta[name]["clock"],
                "top": edge_colour(im, (0, 1)),
                "bottom": edge_colour(im, range(im.height - NAV_BAR_DP * SCALE, im.height, 4)),
            }
            print(f"{out.name}: {out.stat().st_size // 1024} KB, clock {shots[name]['clock']}, top {shots[name]['top']}, bottom {shots[name]['bottom']}")
        manifest[screen] = {"states": [f"{n}.webp" for n in names], "notes": NOTES[screen]}
    write_module(shots, geometry(meta, raw))
    (DEST / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print(f"total {total / 1024 / 1024:.2f} MB")
    build_sheet(manifest)
    return 0


def build_sheet(manifest: dict) -> None:
    thumb_w, thumb_h, pad, label_h = 240, 497, 16, 28
    cols = max(len(m["states"]) for m in manifest.values())
    sheet = Image.new("RGB", (pad + cols * (thumb_w + pad), pad + len(ORDER) * (thumb_h + label_h + pad)), "#1b1f2a")
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 16)
    except OSError:
        font = ImageFont.load_default()
    for r, screen in enumerate(ORDER):
        y = pad + r * (thumb_h + label_h + pad)
        for c, name in enumerate(manifest[screen]["states"]):
            x = pad + c * (thumb_w + pad)
            im = Image.open(DEST / name).convert("RGB").resize((thumb_w, thumb_h), Image.LANCZOS)
            sheet.paste(im, (x, y + label_h))
            draw.text((x, y + 4), name, fill="#e8eeff", font=font)
    sheet.save(SHEET, optimize=True)
    print(f"sheet {SHEET} {sheet.size}")


if __name__ == "__main__":
    raise SystemExit(main())
