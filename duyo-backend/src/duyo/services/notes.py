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


def build_graph(notes: list[tuple[str, str, str]]) -> tuple[list[GraphNode], list[GraphEdge]]:
    """Assemble the graph from (id, title, body) rows.

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
    by_key: dict[str, tuple[str | None, str, str]] = {}
    for note_id, title, _ in notes:
        by_key[title.casefold()] = (note_id, title, "note")

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

    for _, title, body in notes:
        for link in extract_links(body):
            key = link.casefold()
            if key == title.casefold():
                continue  # a note linking to itself adds no structure
            if key not in by_key:
                by_key[key] = (None, link, "unwritten")
            connect(title, key)

        for tag in extract_tags(body):
            # Namespaced so a tag can never collide with a note of the same
            # name — "#kosmos" and the note "Kosmos" stay separate dots.
            key = f"#{tag}"
            if key not in by_key:
                by_key[key] = (None, f"#{tag}", "tag")
            connect(title, key, kind="tag")

    # Mentions last, so an explicit [[link]] always claims the pair first.
    scanned = 0
    for _, title, body in notes:
        text = body or ""
        for _, other_title, _ in notes:
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
        )
        for key, (note_id, title, kind) in by_key.items()
    ]
    # Most-linked first: the view draws them at the centre.
    nodes.sort(key=lambda n: (-n.links, n.title.casefold()))
    return nodes, edges
