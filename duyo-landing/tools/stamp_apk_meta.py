"""Stamp the live APK's version and size into index.html.

The download links point at a stable URL (admin.duyo.uz/apk/duyo.apk) that
build-apk.yml overwrites on every main push, so the LINK is always current — but
the "v1.0.0 · 125 MB" labels beside it are plain text and would drift. This reads
the published version.json plus the APK's Content-Length and rewrites the labels
marked with data-apk-meta.

Cross-origin fetch from the browser is not an option: admin.duyo.uz sends no
CORS headers, so the value is baked in at deploy time instead.

Run from anywhere:
    uv run --no-project python duyo-landing/tools/stamp_apk_meta.py [--check]

--check exits non-zero if the file would change (useful in CI to notice drift
without rewriting).
"""

import argparse
import json
import re
import sys
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
INDEX = HERE.parent / "index.html"
VERSION_URL = "https://admin.duyo.uz/apk/version.json"
UA = {"User-Agent": "duyo-landing-stamper/1.0"}

# data-apk-meta value -> how that label reads, given version and size
LABELS = {
    "hero": "v{version} &middot; {size} &middot; Android 8.0+",
    "card": "v{version} · {size}",
    "android": "Android 8.0+ · {size}",
}


def fetch_meta():
    req = urllib.request.Request(VERSION_URL, headers=UA)
    with urllib.request.urlopen(req, timeout=20) as r:
        android = json.load(r)["android"]

    # HEAD the APK for its real size; version.json does not carry one.
    head = urllib.request.Request(android["url"], method="HEAD", headers=UA)
    with urllib.request.urlopen(head, timeout=20) as r:
        length = int(r.headers["Content-Length"])

    return android["version"], f"{round(length / 1024 / 1024)} MB"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="fail if a rewrite is needed")
    args = ap.parse_args()

    version, size = fetch_meta()
    print(f"live APK: v{version}, {size}")

    html = INDEX.read_text(encoding="utf-8")
    out = html
    for key, template in LABELS.items():
        text = template.format(version=version, size=size)
        pattern = re.compile(
            r'(data-apk-meta="' + key + r'"[^>]*>)(.*?)(</)',
            re.S,
        )
        if not pattern.search(out):
            sys.exit(f"no element carries data-apk-meta=\"{key}\"")
        out = pattern.sub(lambda m: m.group(1) + text + m.group(3), out, count=1)

    if out == html:
        print("labels already current")
        return

    if args.check:
        sys.exit("index.html APK labels are stale — run without --check to fix")

    INDEX.write_text(out, encoding="utf-8")
    print(f"stamped {INDEX.name}")


if __name__ == "__main__":
    main()
