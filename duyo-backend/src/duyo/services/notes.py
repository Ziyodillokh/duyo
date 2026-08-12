"""Wiki-link parsing and graph assembly for the child's notes.

Pure functions over note rows — no DB access, no LLM, so the graph costs one
query and is trivially testable.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# [[Kitoblar]] — the Obsidian form. Nested brackets and empty links are
# ignored rather than raising; a child's half-typed "[[" must not break
# the whole graph.
_LINK = re.compile(r"\[\[([^\[\]|]{1,120})\]\]")

# #teg — a tag runs to the first space or punctuation. Requires a leading
# boundary so a colour like #FF0000 mid-sentence, or a markdown "# heading",
# is not read as a tag. Digits alone don't make a tag either.
_TAG = re.compile(r"(?:^|(?<=\s))#([^\s#.,;:!?()\[\]{}'\"]{1,40})")

MAX_LINKS_PER_NOTE = 40
MAX_TAGS_PER_NOTE = 20


def extract_links(body: str) -> list[str]:
    """Distinct [[titles]] in `body`, in first-seen order, whitespace-trimmed."""
    seen: dict[str, None] = {}
    for raw in _LINK.findall(body or ""):
        title = raw.strip()
        if title:
            seen.setdefault(title, None)
        if len(seen) >= MAX_LINKS_PER_NOTE:
            break
    return list(seen)


def extract_tags(body: str) -> list[str]:
    """Distinct #tags, lowercased, in first-seen order.

    Lowercased because a child writes #Kosmos and #kosmos meaning the same
    thing; keeping both would split the filter in two.
    """
    seen: dict[str, None] = {}
    for raw in _TAG.findall(body or ""):
        tag = raw.strip().lower()
        # A bare number is a heading level or a quantity, not a tag.
        if tag and not tag.isdigit():
            seen.setdefault(tag, None)
        if len(seen) >= MAX_TAGS_PER_NOTE:
            break
    return list(seen)


@dataclass(frozen=True)
class GraphNode:
    # Note id, or None for a link whose note hasn't been written yet, and for
    # every tag node (a tag has no note behind it).
    id: str | None
    title: str
    # How many links point at it — the view scales the dot by this.
    links: int
    exists: bool
    # "note" | "unwritten" | "tag". Obsidian's graph gives each kind its own
    # colour (--graph-node, --graph-node-unresolved, --graph-node-tag), which
    # is most of what makes the map readable at a glance rather than a mass of
    # identical dots.
    kind: str = "note"
    # The note's own chosen colour, carried through untouched from the row —
    # None for unwritten/tag synthetic nodes, which have no note behind them.
    colour: str | None = None


@dataclass(frozen=True)
class GraphEdge:
    source: str  # title
    target: str  # title
    # "link"    — an explicit [[wiki-link]]
    # "tag"     — both ends carry the same #tag
    # "mention" — one note names the other in plain prose (see below)
    kind: str = "link"


# A title shorter than this is too common a word to treat as a mention —
# "Uy", "Men", "It" would wire the whole graph together and mean nothing.
MIN_MENTION_TITLE = 4

# Mentions are quadratic in note count; a child's notebook is small, but a
# cap keeps a pathological case from stalling the request.
MAX_MENTION_SCAN = 300


def _mention_pattern(title: str) -> re.Pattern[str]:
    """`title` as a whole word, case-insensitively.

    Word-bounded so "Suv" doesn't match inside "Suvenir". Uzbek and Russian
    both work here: Python's \\b is Unicode-aware for str patterns.
    """
    return re.compile(rf"\b{re.escape(title)}\b", re.IGNORECASE)


def mentions_without_link(body: str, title: str) -> bool:
    """Does `body` name `title` in prose without ever [[linking]] it?

    Obsidian calls these "unlinked mentions" and offers a one-click Link
    button. Same idea here, with the button doing the typing a child can't.
    """
    if len(title) < MIN_MENTION_TITLE:
        return False
    if any(link.casefold() == title.casefold() for link in extract_links(body)):
        return False
    return bool(_mention_pattern(title).search(_prose_only(body)))


def _prose_only(body: str) -> str:
    """`body` with [[links]] and #tags blanked out, length preserved.

    Both would otherwise read as prose: "[[Suv]]" is already a link, and
    "#kosmos" is a tag, not the child writing the word Kosmos in a sentence.
    Blanked rather than deleted so offsets still line up with the original.
    """
    text = _LINK.sub(lambda m: " " * len(m.group(0)), body or "")
    return _TAG.sub(lambda m: " " * len(m.group(0)), text)


def link_mention(body: str, title: str) -> str:
    """Wrap the first plain-prose occurrence of `title` in [[…]].

    Only the first: turning every mention into a link makes a paragraph
    unreadable, and one link is all the graph needs.
    """
    # Matched against the blanked copy so a hit can never land inside an
    # existing [[link]] or a #tag; offsets still index into the real body.
    m = _mention_pattern(title).search(_prose_only(body))
    if m is None:
        return body
    return f"{body[:m.start()]}[[{body[m.start():m.end()]}]]{body[m.end():]}"


def rename_tag(body: str, old: str, new: str) -> str:
    """Rename #old to #new everywhere in `body`.

    A child writes #kosmos on Monday and #kosmoss on Friday and means one
    thing; without a rename the two are separate nodes forever.
    """
    old_l, new_l = old.strip().lstrip("#").lower(), new.strip().lstrip("#").lower()
    if not old_l or not new_l or old_l == new_l:
        return body

    def swap(m: re.Match[str]) -> str:
        return m.group(0) if m.group(1).lower() != old_l else m.group(0).replace(
            f"#{m.group(1)}", f"#{new_l}", 1
        )

    return _TAG.sub(swap, body or "")


def build_graph(
    notes: list[tuple[str, str, str, str | None]],
) -> tuple[list[GraphNode], list[GraphEdge]]:
    """Assemble the graph from (id, title, body, colour) rows.

    Unresolved links become nodes too (`exists=False`): a child who writes
    "[[Kosmos]]" before the note exists should still see Kosmos appear, and
    tapping it is how the note gets created.

    Link titles are matched case-insensitively so "[[kosmos]]" and "Kosmos"
    are the same node — children do not keep capitals consistent.

    #tags are nodes too, as in Obsidian: a tag joins every note carrying it, so
    two notes that share #fizika are visibly related even when neither links to
    the other. Most of a graph's structure comes from tags rather than links,
    because tagging is cheaper to write than a link.

    Plain-prose MENTIONS are edges as well. Obsidian surfaces these in its
    backlinks pane as "unlinked mentions" and leaves them out of the graph,
    because an Obsidian user has already learnt to type [[…]]. A nine-year-old
    has not: they write "Yer haqida Suv ham bor" and expect the two notes to be
    related. Without this the map is a field of unconnected dots — technically
    correct and useless. Mentions are marked so the view can draw them fainter
    than a deliberate link.
    """
    by_key: dict[str, tuple[str | None, str, str, str | None]] = {}
    for note_id, title, _, colour in notes:
        by_key[title.casefold()] = (note_id, title, "note", colour)

    edges: list[GraphEdge] = []
    incoming: dict[str, int] = {}
    # An explicit link outranks a mention between the same pair — checked
    # unordered, since "A mentions B" and "B links A" describe one relationship.
    seen_pairs: set[frozenset[str]] = set()

    def connect(source_title: str, key: str, kind: str = "link") -> None:
        target_title = by_key[key][1]
        pair = frozenset({source_title.casefold(), key})
        if pair in seen_pairs:
            return
        seen_pairs.add(pair)
        edges.append(GraphEdge(source=source_title, target=target_title, kind=kind))
        incoming[key] = incoming.get(key, 0) + 1

    for _, title, body, _ in notes:
        for link in extract_links(body):
            key = link.casefold()
            if key == title.casefold():
                continue  # a note linking to itself adds no structure
            if key not in by_key:
                by_key[key] = (None, link, "unwritten", None)
            connect(title, key)

        for tag in extract_tags(body):
            # Namespaced so a tag can never collide with a note of the same
            # name — "#kosmos" and the note "Kosmos" stay separate dots.
            key = f"#{tag}"
            if key not in by_key:
                by_key[key] = (None, f"#{tag}", "tag", None)
            connect(title, key, kind="tag")

    # Mentions last, so an explicit [[link]] always claims the pair first.
    scanned = 0
    for _, title, body, _ in notes:
        # Same reason as mentions_without_link: "#kosmos" is a tag and
        # "[[Kosmos]]" is already an edge — neither is prose naming Kosmos.
        text = _prose_only(body)
        for _, other_title, _, _ in notes:
            if scanned >= MAX_MENTION_SCAN:
                break
            if other_title.casefold() == title.casefold():
                continue
            if len(other_title) < MIN_MENTION_TITLE:
                continue
            scanned += 1
            if _mention_pattern(other_title).search(text):
                connect(title, other_title.casefold(), kind="mention")

    nodes = [
        GraphNode(
            id=note_id,
            title=title,
            links=incoming.get(key, 0),
            exists=kind == "note",
            kind=kind,
            colour=colour,
        )
        for key, (note_id, title, kind, colour) in by_key.items()
    ]
    # Most-linked first: the view draws them at the centre.
    nodes.sort(key=lambda n: (-n.links, n.title.casefold()))
    return nodes, edges
