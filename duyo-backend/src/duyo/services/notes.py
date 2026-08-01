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
    # Note id, or None for a link whose note hasn't been written yet.
    id: str | None
    title: str
    # How many links point at it — the view scales the dot by this.
    links: int
    exists: bool


@dataclass(frozen=True)
class GraphEdge:
    source: str  # title
    target: str  # title


def build_graph(notes: list[tuple[str, str, str]]) -> tuple[list[GraphNode], list[GraphEdge]]:
    """Assemble the graph from (id, title, body) rows.

    Unresolved links become nodes too (`exists=False`): a child who writes
    "[[Kosmos]]" before the note exists should still see Kosmos appear, and
    tapping it is how the note gets created.

    Link titles are matched case-insensitively so "[[kosmos]]" and "Kosmos"
    are the same node — children do not keep capitals consistent.
    """
    by_key: dict[str, tuple[str | None, str]] = {}
    for note_id, title, _ in notes:
        by_key[title.casefold()] = (note_id, title)

    edges: list[GraphEdge] = []
    incoming: dict[str, int] = {}

    for _, title, body in notes:
        for link in extract_links(body):
            key = link.casefold()
            if key == title.casefold():
                continue  # a note linking to itself adds no structure
            if key not in by_key:
                by_key[key] = (None, link)  # unwritten note
            target_title = by_key[key][1]
            edge = GraphEdge(source=title, target=target_title)
            if edge not in edges:
                edges.append(edge)
                incoming[key] = incoming.get(key, 0) + 1

    nodes = [
        GraphNode(
            id=note_id,
            title=title,
            links=incoming.get(key, 0),
            exists=note_id is not None,
        )
        for key, (note_id, title) in by_key.items()
    ]
    # Most-linked first: the view draws them at the centre.
    nodes.sort(key=lambda n: (-n.links, n.title.casefold()))
    return nodes, edges
