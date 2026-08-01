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


# ── Tag nodes in the graph ───────────────────────────────────────────────────

def test_tag_becomes_a_node_joining_the_notes_that_carry_it():
    """Two notes sharing #fizika are related even without a [[link]]."""
    nodes, edges = notes.build_graph([
        ("1", "Tortishish", "Nyuton #fizika"),
        ("2", "Yoruglik", "tezlik #fizika"),
    ])
    tag = next(n for n in nodes if n.title == "#fizika")
    assert tag.kind == "tag"
    assert tag.exists is False and tag.id is None
    assert tag.links == 2
    assert notes.GraphEdge("Tortishish", "#fizika", kind="tag") in edges
    assert notes.GraphEdge("Yoruglik", "#fizika", kind="tag") in edges


def test_tag_and_note_of_the_same_name_stay_separate():
    nodes, _ = notes.build_graph([
        ("1", "Kundalik", "[[Kosmos]] va #kosmos"),
        ("2", "Kosmos", ""),
    ])
    kinds = {n.title: n.kind for n in nodes}
    assert kinds["Kosmos"] == "note"
    assert kinds["#kosmos"] == "tag"


def test_node_kinds_cover_all_three_cases():
    nodes, _ = notes.build_graph([
        ("1", "Yozilgan", "[[Yozilmagan]] #teg"),
    ])
    assert {n.kind for n in nodes} == {"note", "unwritten", "tag"}


def test_plain_prose_mention_becomes_an_edge():
    """A child writes a title in prose, not as [[…]] — still a relationship.

    This is the whole reason the graph isn't a field of unconnected dots for a
    child who has never typed a wiki-link.
    """
    _, edges = notes.build_graph([
        ("1", "Vulqon", "Lava juda issiq va Dinozavr uni ko'rgan."),
        ("2", "Dinozavr", "Katta hayvon."),
    ])
    assert notes.GraphEdge("Vulqon", "Dinozavr", kind="mention") in edges


def test_explicit_link_outranks_a_mention_for_the_same_pair():
    """One relationship, one edge — and it keeps the stronger kind."""
    _, edges = notes.build_graph([
        ("1", "Vulqon", "[[Dinozavr]] va yana Dinozavr haqida."),
        ("2", "Dinozavr", "Vulqon yonida yashagan."),
    ])
    pair = [e for e in edges if {e.source, e.target} == {"Vulqon", "Dinozavr"}]
    assert len(pair) == 1
    assert pair[0].kind == "link"


def test_mention_needs_a_whole_word():
    """"Suv" must not match inside "Suvenir" — substring hits are noise."""
    _, edges = notes.build_graph([
        ("1", "Sovga", "Menga Suvenir olib kelishdi."),
        ("2", "Suvv", "H2O."),
    ])
    assert edges == []


def test_short_titles_are_never_mentions():
    """"Uy" appears in half of everything; it would wire the graph to mush."""
    _, edges = notes.build_graph([
        ("1", "Maktab", "Uy vazifasi ko'p edi."),
        ("2", "Uy", "Men yashaydigan joy."),
    ])
    assert edges == []
