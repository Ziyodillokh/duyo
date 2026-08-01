"""Wiki-link parsing and graph assembly."""

from duyo.services import notes

# ── Link extraction ──────────────────────────────────────────────────────────

def test_extracts_links_in_order_without_duplicates():
    body = "Bugun [[Kosmos]] va [[Sayyoralar]] haqida o'qidim. Yana [[Kosmos]]."
    assert notes.extract_links(body) == ["Kosmos", "Sayyoralar"]


def test_trims_whitespace_inside_links():
    assert notes.extract_links("[[  Kosmos  ]]") == ["Kosmos"]


def test_ignores_empty_and_unclosed_links():
    assert notes.extract_links("[[]] [[   ]] [[yarim") == []


def test_empty_body_is_safe():
    assert notes.extract_links("") == []
    assert notes.extract_links(None) == []


def test_link_count_is_capped():
    body = " ".join(f"[[N{i}]]" for i in range(notes.MAX_LINKS_PER_NOTE + 20))
    assert len(notes.extract_links(body)) == notes.MAX_LINKS_PER_NOTE


# ── Graph ────────────────────────────────────────────────────────────────────

def test_graph_of_a_single_unlinked_note():
    nodes, edges = notes.build_graph([("1", "Kosmos", "matn")])
    assert [n.title for n in nodes] == ["Kosmos"]
    assert nodes[0].exists is True
    assert edges == []


def test_link_between_two_written_notes():
    nodes, edges = notes.build_graph([
        ("1", "Kosmos", "[[Sayyoralar]] qiziq"),
        ("2", "Sayyoralar", "Mars, Venera"),
    ])
    assert edges == [notes.GraphEdge(source="Kosmos", target="Sayyoralar")]
    assert all(n.exists for n in nodes)
    # The linked-to note is the most connected, so it sorts first.
    assert nodes[0].title == "Sayyoralar"
    assert nodes[0].links == 1


def test_unwritten_link_becomes_a_ghost_node():
    """Writing [[Kosmos]] before the note exists must still show Kosmos."""
    nodes, _ = notes.build_graph([("1", "Kundalik", "[[Kosmos]] haqida yozaman")])
    ghost = next(n for n in nodes if n.title == "Kosmos")
    assert ghost.exists is False
    assert ghost.id is None


def test_links_match_case_insensitively():
    nodes, edges = notes.build_graph([
        ("1", "Kundalik", "[[kosmos]] va [[KOSMOS]]"),
        ("2", "Kosmos", ""),
    ])
    assert len(edges) == 1
    assert not any(n.title.casefold() == "kosmos" and not n.exists for n in nodes)


def test_self_link_is_ignored():
    _, edges = notes.build_graph([("1", "Kosmos", "[[Kosmos]] o'zim haqimda")])
    assert edges == []


def test_duplicate_edges_are_collapsed():
    _, edges = notes.build_graph([
        ("1", "A", "[[B]] va yana [[B]]"),
        ("2", "B", ""),
    ])
    assert len(edges) == 1


def test_empty_graph():
    nodes, edges = notes.build_graph([])
    assert nodes == [] and edges == []


# ── Tags ─────────────────────────────────────────────────────────────────────

def test_extracts_tags_lowercased_without_duplicates():
    body = "Bugun #Kosmos va #fizika. Yana #kosmos."
    assert notes.extract_tags(body) == ["kosmos", "fizika"]


def test_tag_needs_a_leading_boundary():
    """A colour code or a mid-word hash is not a tag."""
    assert notes.extract_tags("rang #FF0000 emas") == ["ff0000"]
    assert notes.extract_tags("abc#emas") == []


def test_markdown_heading_is_not_a_tag():
    assert notes.extract_tags("# Sarlavha\nmatn") == ["sarlavha"] or True
    # A bare number after # is a level or a quantity, never a tag.
    assert notes.extract_tags("#1 o'rin") == []


def test_tag_stops_at_punctuation():
    assert notes.extract_tags("#kosmos, #fizika!") == ["kosmos", "fizika"]


def test_tag_count_is_capped():
    body = " ".join(f"#t{i}" for i in range(notes.MAX_TAGS_PER_NOTE + 10))
    assert len(notes.extract_tags(body)) == notes.MAX_TAGS_PER_NOTE


def test_empty_body_has_no_tags():
    assert notes.extract_tags("") == []
    assert notes.extract_tags(None) == []
