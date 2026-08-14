"""List every translatable string on the landing page.

Text nodes plus the attributes a reader actually sees (aria-label, alt,
placeholder, title, and the <head> meta/OG copy). Skips script/style. Output is
one string per line, deduped, in document order, so it can be handed straight
to translation.
"""

import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

HERE = Path(__file__).resolve().parent
SRC = HERE.parent / "index.html"

SKIP = {"script", "style", "noscript", "svg", "path", "defs", "lineargradient", "stop"}
ATTRS = ("aria-label", "alt", "placeholder", "title")
META_NAMES = {"description", "og:title", "og:description", "twitter:title", "twitter:description"}


class Extract(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []
        self.out = []
        self.attr_hits = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag not in ("br", "img", "meta", "link", "input", "hr", "source"):
            self.stack.append(tag)
        if tag in SKIP:
            return
        for key in ATTRS:
            if a.get(key, "").strip():
                self.attr_hits.append((f"@{key}", a[key].strip()))
        if tag == "meta":
            name = a.get("name") or a.get("property") or ""
            if name in META_NAMES and a.get("content", "").strip():
                self.attr_hits.append((f"@meta:{name}", a["content"].strip()))

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag):
        if tag in self.stack:
            while self.stack and self.stack.pop() != tag:
                pass

    def handle_data(self, data):
        if any(t in SKIP for t in self.stack):
            return
        text = re.sub(r"\s+", " ", data).strip()
        if text and re.search(r"[A-Za-zА-Яа-яЎўҚқҒғҲҳ]", text):
            self.out.append(("/".join(self.stack[-2:]), text))


p = Extract()
p.feed(SRC.read_text(encoding="utf-8"))

seen, rows = set(), []
for where, text in p.out + p.attr_hits:
    if text not in seen:
        seen.add(text)
        rows.append({"where": where, "text": text})

print(f"unique strings: {len(rows)}", file=sys.stderr)
out = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "strings.json"
out.write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
print(f"wrote {out}")
