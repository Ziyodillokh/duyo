"""solve_on_board — chalkboard layout for a mid-conversation problem."""

from types import SimpleNamespace

import pytest

from duyo.models.child import AgeSegment
from duyo.services import gemini


def _client(payload: str):
    class _Models:
        async def generate_content(self, **_kwargs):
            return SimpleNamespace(text=payload)

    return SimpleNamespace(aio=SimpleNamespace(models=_Models()))


@pytest.mark.asyncio
async def test_solves_and_caps_line_lengths(monkeypatch):
    monkeypatch.setattr(
        gemini,
        "get_client",
        lambda: _client(
            '{"is_problem": true, "title": "Tenglama", "problem": "2x + 5 = 13",'
            ' "steps": [{"expr": "2x = 13 - 5", "note": "5 ni o\'ng tomonga"},'
            ' {"expr": "' + "9" * 60 + '", "note": "' + "u" * 200 + '"}],'
            ' "answer": "x = 4"}'
        ),
    )
    out = await gemini.solve_on_board(
        question="2x + 5 = 13 ni yech", age_segment=AgeSegment.EXPLORER
    )
    assert out["is_problem"] is True
    assert out["problem"] == "2x + 5 = 13"
    assert out["answer"] == "x = 4"
    # Over-long lines must be truncated or they overflow the board.
    assert len(out["steps"][1]["expr"]) == gemini._BOARD_EXPR_MAX
    assert len(out["steps"][1]["note"]) == gemini._BOARD_NOTE_MAX


@pytest.mark.asyncio
async def test_repeated_line_is_written_once(monkeypatch):
    """Chemistry answers came back with the balanced equation twice in a row."""
    monkeypatch.setattr(
        gemini,
        "get_client",
        lambda: _client(
            '{"is_problem": true, "title": "Reaksiya", "problem": "H₂ + O₂ → ?",'
            ' "steps": [{"expr": "2H₂ + O₂ → 2H₂O", "note": "tenglashtiramiz"},'
            ' {"expr": "2H₂ + O₂ → 2H₂O", "note": ""},'
            ' {"expr": "Suv hosil bo\'ladi", "note": ""}],'
            ' "answer": "H₂O"}'
        ),
    )
    out = await gemini.solve_on_board(
        question="vodorod va kislorod", age_segment=AgeSegment.EXPLORER
    )
    exprs = [s["expr"] for s in out["steps"]]
    assert exprs == ["2H₂ + O₂ → 2H₂O", "Suv hosil bo'ladi"]


@pytest.mark.asyncio
async def test_figure_is_kept_and_sanitised(monkeypatch):
    monkeypatch.setattr(
        gemini,
        "get_client",
        lambda: _client(
            '{"is_problem": true, "title": "Parabola", "problem": "y = x²",'
            ' "steps": [{"expr": "x=2 → y=4", "note": ""}], "answer": "Parabola",'
            ' "figure": {"caption": "y = x²", "axes": true, "items": ['
            '  {"type": "curve", "points": [[-2,4],[0,0],[2,4]]},'
            '  {"type": "circle", "cx": 0, "cy": 0, "r": 3},'
            '  {"type": "arrow", "points": [[0,0],[1,1]], "label": "v"},'
            '  {"type": "label", "points": [[2,4]], "label": "A"},'
            '  {"type": "wormhole", "points": [[0,0],[1,1]]},'
            '  {"type": "arrow", "points": [[0,0]]},'
            '  {"type": "curve", "points": [[0,"x"],[1,null],[2,2],[3,3]]}'
            ']}}'
        ),
    )
    out = await gemini.solve_on_board(question="y = x²", age_segment=AgeSegment.EXPLORER)
    fig = out["figure"]
    assert fig is not None
    kinds = [i["type"] for i in fig["items"]]
    # Unknown type and the one-point arrow are dropped; the curve with junk
    # coordinates survives with only its valid pairs.
    assert kinds == ["curve", "circle", "arrow", "label", "curve"]
    assert fig["items"][-1]["points"] == [[2.0, 2.0], [3.0, 3.0]]
    assert fig["axes"] is True


@pytest.mark.asyncio
async def test_broken_figure_does_not_sink_the_board(monkeypatch):
    """A bad diagram must cost the diagram, never the working."""
    monkeypatch.setattr(
        gemini,
        "get_client",
        lambda: _client(
            '{"is_problem": true, "title": "T", "problem": "2+2",'
            ' "steps": [{"expr": "2+2 = 4", "note": ""}], "answer": "4",'
            ' "figure": {"axes": true, "items": [{"type": "curve", "points": "nope"}]}}'
        ),
    )
    out = await gemini.solve_on_board(question="2+2", age_segment=AgeSegment.JUNIOR)
    assert out["is_problem"] is True
    assert out["answer"] == "4"
    assert out["figure"] is None


@pytest.mark.asyncio
async def test_plain_chat_shows_no_board(monkeypatch):
    monkeypatch.setattr(gemini, "get_client", lambda: _client('{"is_problem": false}'))
    out = await gemini.solve_on_board(
        question="Salom, qalaysan?", age_segment=AgeSegment.JUNIOR
    )
    assert out["is_problem"] is False
    assert out["steps"] == []


@pytest.mark.asyncio
async def test_steps_without_problem_show_no_board(monkeypatch):
    """A board with a heading but nothing written on it is worse than none."""
    monkeypatch.setattr(
        gemini,
        "get_client",
        lambda: _client('{"is_problem": true, "title": "Masala", "problem": "", "steps": []}'),
    )
    out = await gemini.solve_on_board(question="hisobla", age_segment=AgeSegment.JUNIOR)
    assert out["is_problem"] is False


@pytest.mark.asyncio
async def test_model_error_fails_closed(monkeypatch):
    class _Boom:
        async def generate_content(self, **_kwargs):
            raise RuntimeError("gemini down")

    monkeypatch.setattr(
        gemini,
        "get_client",
        lambda: SimpleNamespace(aio=SimpleNamespace(models=_Boom())),
    )
    out = await gemini.solve_on_board(question="2+2", age_segment=AgeSegment.JUNIOR)
    assert out["is_problem"] is False


@pytest.mark.asyncio
async def test_empty_question_skips_the_model(monkeypatch):
    def _explode():
        raise AssertionError("model must not be called for an empty utterance")

    monkeypatch.setattr(gemini, "get_client", _explode)
    out = await gemini.solve_on_board(question="   ", age_segment=AgeSegment.JUNIOR)
    assert out["is_problem"] is False
