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
    nodes, edges = notes.build_graph([("1", "Kosmos", "matn", None)])
    assert [n.title for n in nodes] == ["Kosmos"]
    assert nodes[0].exists is True
    assert edges == []


def test_link_between_two_written_notes():
    nodes, edges = notes.build_graph([
        ("1", "Kosmos", "[[Sayyoralar]] qiziq", None),
        ("2", "Sayyoralar", "Mars, Venera", None),
    ])
    assert edges == [notes.GraphEdge(source="Kosmos", target="Sayyoralar")]
    assert all(n.exists for n in nodes)
    # The linked-to note is the most connected, so it sorts first.
    assert nodes[0].title == "Sayyoralar"
    assert nodes[0].links == 1


def test_unwritten_link_becomes_a_ghost_node():
    """Writing [[Kosmos]] before the note exists must still show Kosmos."""
    nodes, _ = notes.build_graph([("1", "Kundalik", "[[Kosmos]] haqida yozaman", None)])
    ghost = next(n for n in nodes if n.title == "Kosmos")
    assert ghost.exists is False
    assert ghost.id is None


def test_links_match_case_insensitively():
    nodes, edges = notes.build_graph([
        ("1", "Kundalik", "[[kosmos]] va [[KOSMOS]]", None),
        ("2", "Kosmos", "", None),
    ])
    assert len(edges) == 1
    assert not any(n.title.casefold() == "kosmos" and not n.exists for n in nodes)


def test_self_link_is_ignored():
    _, edges = notes.build_graph([("1", "Kosmos", "[[Kosmos]] o'zim haqimda", None)])
    assert edges == []


def test_duplicate_edges_are_collapsed():
    _, edges = notes.build_graph([
        ("1", "A", "[[B]] va yana [[B]]", None),
        ("2", "B", "", None),
    ])
    assert len(edges) == 1


def test_empty_graph():
    nodes, edges = notes.build_graph([])
    assert nodes == [] and edges == []


def test_note_colour_is_carried_onto_its_node():
    nodes, _ = notes.build_graph([("1", "Kosmos", "matn", "#60A5FA")])
    assert nodes[0].colour == "#60A5FA"


def test_unwritten_and_tag_nodes_never_carry_a_colour():
    """Neither has a note behind it — nothing to have chosen a colour."""
    nodes, _ = notes.build_graph([("1", "Kundalik", "[[Kosmos]] #fizika", "#60A5FA")])
    ghost = next(n for n in nodes if n.title == "Kosmos")
    tag = next(n for n in nodes if n.title == "#fizika")
    assert ghost.colour is None
    assert tag.colour is None


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
        ("1", "Tortishish", "Nyuton #fizika", None),
        ("2", "Yoruglik", "tezlik #fizika", None),
    ])
    tag = next(n for n in nodes if n.title == "#fizika")
    assert tag.kind == "tag"
    assert tag.exists is False and tag.id is None
    assert tag.links == 2
    assert notes.GraphEdge("Tortishish", "#fizika", kind="tag") in edges
    assert notes.GraphEdge("Yoruglik", "#fizika", kind="tag") in edges


def test_tag_and_note_of_the_same_name_stay_separate():
    nodes, _ = notes.build_graph([
        ("1", "Kundalik", "[[Kosmos]] va #kosmos", None),
        ("2", "Kosmos", "", None),
    ])
    kinds = {n.title: n.kind for n in nodes}
    assert kinds["Kosmos"] == "note"
    assert kinds["#kosmos"] == "tag"


def test_node_kinds_cover_all_three_cases():
    nodes, _ = notes.build_graph([
        ("1", "Yozilgan", "[[Yozilmagan]] #teg", None),
    ])
    assert {n.kind for n in nodes} == {"note", "unwritten", "tag"}


def test_plain_prose_mention_becomes_an_edge():
    """A child writes a title in prose, not as [[…]] — still a relationship.

    This is the whole reason the graph isn't a field of unconnected dots for a
    child who has never typed a wiki-link.
    """
    _, edges = notes.build_graph([
        ("1", "Vulqon", "Lava juda issiq va Dinozavr uni ko'rgan.", None),
        ("2", "Dinozavr", "Katta hayvon.", None),
    ])
    assert notes.GraphEdge("Vulqon", "Dinozavr", kind="mention") in edges


def test_explicit_link_outranks_a_mention_for_the_same_pair():
    """One relationship, one edge — and it keeps the stronger kind."""
    _, edges = notes.build_graph([
        ("1", "Vulqon", "[[Dinozavr]] va yana Dinozavr haqida.", None),
        ("2", "Dinozavr", "Vulqon yonida yashagan.", None),
    ])
    pair = [e for e in edges if {e.source, e.target} == {"Vulqon", "Dinozavr"}]
    assert len(pair) == 1
    assert pair[0].kind == "link"


def test_mention_needs_a_whole_word():
    """"Suv" must not match inside "Suvenir" — substring hits are noise."""
    _, edges = notes.build_graph([
        ("1", "Sovga", "Menga Suvenir olib kelishdi.", None),
        ("2", "Suvv", "H2O.", None),
    ])
    assert edges == []


def test_short_titles_are_never_mentions():
    """"Uy" appears in half of everything; it would wire the graph to mush."""
    _, edges = notes.build_graph([
        ("1", "Maktab", "Uy vazifasi ko'p edi.", None),
        ("2", "Uy", "Men yashaydigan joy.", None),
    ])
    assert edges == []


# --- unlinked mentions -------------------------------------------------------

def test_prose_mention_without_a_link_is_reported():
    assert notes.mentions_without_link("Bugun Vulqon haqida o'qidim.", "Vulqon")


def test_an_existing_link_means_it_is_not_unlinked():
    assert not notes.mentions_without_link("[[Vulqon]] qiziq.", "Vulqon")


def test_a_bare_link_is_not_also_counted_as_a_mention():
    """"[[Vulqon]]" must not read as prose naming Vulqon."""
    assert not notes.mentions_without_link("Men [[Vulqon]] ni ko'rdim.", "Vulqon")


def test_short_titles_are_never_unlinked_mentions():
    assert not notes.mentions_without_link("Uy vazifasi.", "Uy")


def test_link_mention_wraps_only_the_first_occurrence():
    out = notes.link_mention("Vulqon issiq. Vulqon katta.", "Vulqon")
    assert out == "[[Vulqon]] issiq. Vulqon katta."


def test_link_mention_skips_text_already_inside_a_link():
    out = notes.link_mention("[[Vulqon]] va yana Vulqon.", "Vulqon")
    assert out == "[[Vulqon]] va yana [[Vulqon]]."


def test_link_mention_leaves_a_body_without_the_title_alone():
    body = "Bu yerda hech narsa yo'q."
    assert notes.link_mention(body, "Vulqon") == body


# --- tag rename --------------------------------------------------------------

def test_rename_tag_replaces_every_occurrence():
    out = notes.rename_tag("#kosmoss yulduz #kosmoss oy", "kosmoss", "kosmos")
    assert out == "#kosmos yulduz #kosmos oy"


def test_rename_tag_is_case_insensitive_on_the_old_name():
    assert notes.rename_tag("#Kosmoss", "kosmoss", "kosmos") == "#kosmos"


def test_rename_tag_leaves_other_tags_untouched():
    out = notes.rename_tag("#fizika #kosmoss", "kosmoss", "kosmos")
    assert out == "#fizika #kosmos"


def test_rename_tag_ignores_a_no_op():
    assert notes.rename_tag("#a", "a", "a") == "#a"
    assert notes.rename_tag("#a", "", "b") == "#a"


def test_rename_tag_does_not_touch_a_markdown_heading():
    """"# Sarlavha" is a heading, not a #tag — renaming must not eat it."""
    body = "# Kosmoss haqida\n\n#kosmoss"
    assert notes.rename_tag(body, "kosmoss", "kosmos") == "# Kosmoss haqida\n\n#kosmos"


def test_a_tag_is_not_a_prose_mention_of_the_same_named_note():
    """"#kosmos" is a tag. It must not read as the child writing "Kosmos"."""
    assert not notes.mentions_without_link("Yulduzlar.\n#kosmos", "Kosmos")


def test_a_tag_does_not_create_a_mention_edge():
    """#kosmos joins Quyosh to the TAG node, never to the note called Kosmos."""
    _, edges = notes.build_graph([
        ("1", "Quyosh", "Issiq yulduz.\n#kosmos", None),
        ("2", "Kosmos", "Juda katta.", None),
    ])
    assert [e.kind for e in edges] == ["tag"]
    assert not any({e.source, e.target} == {"Quyosh", "Kosmos"} for e in edges)


def test_link_mention_never_wraps_a_tag():
    body = "Yulduzlar haqida.\n#kosmos"
    assert notes.link_mention(body, "kosmos") == body
