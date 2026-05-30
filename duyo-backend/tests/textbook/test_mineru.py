"""Tests for MinerU parser — parse_content_list grouping logic.

parse_content_list is a pure function over MinerU's content_list.json, so it's
fully unit-testable without running MinerU or downloading models.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest


def _write_content_list(tmp_path: Path, items: list[dict]) -> Path:
    p = tmp_path / "cl.json"
    p.write_text(json.dumps(items, ensure_ascii=False), encoding="utf-8")
    return p


class TestParseContentList:
    def test_equation_sets_has_formula(self, tmp_path: Path) -> None:
        from duyo.textbook.mineru_parser import parse_content_list

        items = [
            {"type": "text", "text": "Bir xil maxrajli kasrlarni qo'shish qoidasi."},
            {"type": "equation", "text": "$$\\frac{1}{4}+\\frac{2}{4}=\\frac{3}{4}$$"},
        ]
        chunks = parse_content_list(_write_content_list(tmp_path, items))
        assert len(chunks) == 1
        assert chunks[0]["has_formula"] is True
        assert "\\frac" in chunks[0]["text"]

    def test_heading_starts_new_chunk(self, tmp_path: Path) -> None:
        from duyo.textbook.mineru_parser import parse_content_list

        items = [
            {"type": "text", "text": "I BOB. Natural sonlar", "text_level": 1},
            {"type": "text", "text": "Natural sonlar haqida uzun tushuntirish matni."},
            {"type": "text", "text": "II BOB. Kasrlar", "text_level": 1},
            {"type": "text", "text": "Kasrlar haqida boshqa uzun tushuntirish matni."},
        ]
        chunks = parse_content_list(_write_content_list(tmp_path, items))
        assert len(chunks) == 2
        assert chunks[0]["chapter"] == "I BOB. Natural sonlar"
        assert chunks[1]["chapter"] == "II BOB. Kasrlar"

    def test_table_sets_has_table(self, tmp_path: Path) -> None:
        from duyo.textbook.mineru_parser import parse_content_list

        items = [
            {"type": "text", "text": "Quyidagi jadvalni to'ldiring va tahlil qiling."},
            {"type": "table", "table_body": "<table><tr><td>1</td></tr></table>"},
        ]
        chunks = parse_content_list(_write_content_list(tmp_path, items))
        assert chunks[0]["has_table"] is True

    def test_image_sets_has_image_with_caption(self, tmp_path: Path) -> None:
        from duyo.textbook.mineru_parser import parse_content_list

        items = [
            {"type": "text", "text": "Quyidagi rasmga qarab savollarga javob bering."},
            {"type": "image", "img_caption": ["11-rasm"]},
        ]
        chunks = parse_content_list(_write_content_list(tmp_path, items))
        assert chunks[0]["has_image"] is True
        assert "11-rasm" in chunks[0]["text"]

    def test_short_noise_dropped(self, tmp_path: Path) -> None:
        from duyo.textbook.mineru_parser import parse_content_list

        items = [{"type": "text", "text": "5"}]
        chunks = parse_content_list(_write_content_list(tmp_path, items))
        assert chunks == []

    def test_empty_list(self, tmp_path: Path) -> None:
        from duyo.textbook.mineru_parser import parse_content_list

        chunks = parse_content_list(_write_content_list(tmp_path, []))
        assert chunks == []

    def test_equation_text_preserved_verbatim(self, tmp_path: Path) -> None:
        from duyo.textbook.mineru_parser import parse_content_list

        latex = "$$x - 2 = 18 \\Rightarrow x = 20$$"
        items = [
            {"type": "text", "text": "Namuna yechim quyidagicha bajariladi va tekshiriladi."},
            {"type": "equation", "text": latex},
        ]
        chunks = parse_content_list(_write_content_list(tmp_path, items))
        assert latex in chunks[0]["text"]


class TestMineruCmd:
    def test_raises_when_not_installed(self) -> None:
        import shutil
        from unittest.mock import patch

        from duyo.textbook import mineru_parser as mod

        with patch.object(shutil, "which", return_value=None), \
             patch("pathlib.Path.exists", return_value=False), \
             pytest.raises(RuntimeError, match="mineru is not installed"):
            mod._mineru_cmd()
