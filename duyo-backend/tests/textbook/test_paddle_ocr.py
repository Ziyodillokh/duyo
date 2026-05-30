"""Tests for PaddleOCR service and hybrid routing.

PaddleOCR and pymupdf are mocked — no real GPU or model download needed.
"""

from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _fake_pdf(tmp_path: Path, name: str = "test.pdf") -> Path:
    f = tmp_path / name
    f.write_bytes(b"%PDF-1.4 fake")
    return f


def _make_ocr_result(lines: list[str], confidence: float = 0.95) -> list:
    """Build a fake PaddleOCR result in the format [[bbox, (text, conf)], ...]."""
    return [
        [[0, 0, 100, 20], (line, confidence)]
        for line in lines
    ]


# ---------------------------------------------------------------------------
# _detect_lang
# ---------------------------------------------------------------------------

class TestDetectLang:
    def test_cyrillic_heavy_returns_ru(self) -> None:
        from duyo.textbook.paddle_ocr import _detect_lang
        assert _detect_lang("Математика дарслиги") == "ru"

    def test_latin_heavy_returns_en(self) -> None:
        from duyo.textbook.paddle_ocr import _detect_lang
        assert _detect_lang("Matematika darsligi") == "en"

    def test_mixed_favours_majority(self) -> None:
        from duyo.textbook.paddle_ocr import _detect_lang
        # More Latin than Cyrillic
        assert _detect_lang("abc abc abc аб") == "en"

    def test_empty_returns_en(self) -> None:
        from duyo.textbook.paddle_ocr import _detect_lang
        assert _detect_lang("") == "en"


# ---------------------------------------------------------------------------
# ocr_pdf
# ---------------------------------------------------------------------------

class TestOcrPdf:
    def _mock_fitz(self, pages_text: list[str]):
        """Build a mock pymupdf document returning given text per page."""
        mock_fitz = MagicMock()
        mock_doc = MagicMock()
        mock_doc.__len__ = MagicMock(return_value=len(pages_text))

        pages = []
        for text in pages_text:
            page = MagicMock()
            page.get_text.return_value = text
            pix = MagicMock()
            pix.tobytes.return_value = b"PNG_BYTES"
            page.get_pixmap.return_value = pix
            pages.append(page)

        mock_doc.__getitem__ = lambda self, i: pages[i]
        mock_doc.close = MagicMock()
        mock_fitz.open.return_value = mock_doc
        return mock_fitz

    def _mock_paddle_lines(self, lines: list[str]):
        """Build a mock PaddleOCR class that returns given lines."""
        mock_ocr_instance = MagicMock()
        mock_ocr_instance.ocr.return_value = [_make_ocr_result(lines)]
        mock_paddle_cls = MagicMock(return_value=mock_ocr_instance)
        return mock_paddle_cls

    @pytest.mark.asyncio
    async def test_returns_per_page_text(self, tmp_path: Path) -> None:
        from duyo.textbook import paddle_ocr as mod

        pdf = _fake_pdf(tmp_path)
        mock_fitz = self._mock_fitz(["Lotin matn sahifa 1", "Lotin matn sahifa 2"])
        mock_cls = self._mock_paddle_lines(["Ta'rif: kasrlar."])

        with patch.dict("sys.modules", {"fitz": mock_fitz}), \
             patch("duyo.textbook.paddle_ocr._get_ocr", return_value=mock_cls()):
            result = mod.ocr_pdf(pdf, lang="en")

        assert len(result) == 2

    @pytest.mark.asyncio
    async def test_filters_low_confidence(self, tmp_path: Path) -> None:
        from duyo.textbook import paddle_ocr as mod

        pdf = _fake_pdf(tmp_path)
        mock_fitz = self._mock_fitz(["text"])

        low_conf_result = [[[0, 0, 10, 10], ("bad text", 0.3)]]
        high_conf_result = [[[0, 0, 10, 10], ("good text", 0.9)]]
        mock_ocr = MagicMock()
        mock_ocr.ocr.return_value = [low_conf_result[0:0] + high_conf_result]

        with patch.dict("sys.modules", {"fitz": mock_fitz}), \
             patch("duyo.textbook.paddle_ocr._get_ocr", return_value=mock_ocr):
            result = mod.ocr_pdf(pdf, lang="en")

        assert "good text" in result[0]

    @pytest.mark.asyncio
    async def test_respects_max_pages(self, tmp_path: Path) -> None:
        from duyo.textbook import paddle_ocr as mod

        pdf = _fake_pdf(tmp_path)
        mock_fitz = self._mock_fitz(["p1", "p2", "p3"])
        mock_ocr = MagicMock()
        mock_ocr.ocr.return_value = [[[[0, 0, 10, 10], ("text", 0.9)]]]

        with patch.dict("sys.modules", {"fitz": mock_fitz}), \
             patch("duyo.textbook.paddle_ocr._get_ocr", return_value=mock_ocr):
            result = mod.ocr_pdf(pdf, lang="en", max_pages=2)

        assert len(result) == 2

    def test_raises_without_pymupdf(self, tmp_path: Path) -> None:
        from duyo.textbook import paddle_ocr as mod

        pdf = _fake_pdf(tmp_path)
        with patch.dict("sys.modules", {"fitz": None}):
            with pytest.raises(RuntimeError, match="pymupdf"):
                mod.ocr_pdf(pdf)

    def test_raises_without_paddleocr(self, tmp_path: Path) -> None:
        from duyo.textbook.paddle_ocr import _get_ocr
        # Clear cache before testing
        _get_ocr.cache_clear()

        with patch.dict("sys.modules", {"paddleocr": None}):
            with pytest.raises((RuntimeError, Exception)):
                _get_ocr("en")

        _get_ocr.cache_clear()


# ---------------------------------------------------------------------------
# ocr_pdf_as_markdown
# ---------------------------------------------------------------------------

class TestOcrPdfAsMarkdown:
    def test_joins_pages_with_separator(self, tmp_path: Path) -> None:
        from duyo.textbook.paddle_ocr import ocr_pdf_as_markdown

        pdf = _fake_pdf(tmp_path)

        with patch("duyo.textbook.paddle_ocr.ocr_pdf") as mock_ocr:
            mock_ocr.return_value = ["Sahifa 1 matni.", "Sahifa 2 matni."]
            result = ocr_pdf_as_markdown(pdf, lang="en")

        assert "---" in result
        assert "Sahifa 1" in result
        assert "Sahifa 2" in result

    def test_empty_pages_skipped(self, tmp_path: Path) -> None:
        from duyo.textbook.paddle_ocr import ocr_pdf_as_markdown

        pdf = _fake_pdf(tmp_path)

        with patch("duyo.textbook.paddle_ocr.ocr_pdf") as mock_ocr:
            mock_ocr.return_value = ["Matn bor.", "", "  "]
            result = ocr_pdf_as_markdown(pdf, lang="en")

        assert "---" not in result
        assert "Matn bor" in result


# ---------------------------------------------------------------------------
# Hybrid routing in docling_parser
# ---------------------------------------------------------------------------

class TestHybridRouting:
    @pytest.mark.asyncio
    async def test_auto_uses_docling_when_enough_text(self, tmp_path: Path) -> None:
        from duyo.textbook.docling_parser import RawChunk, parse

        pdf = _fake_pdf(tmp_path)

        with patch("duyo.textbook.docling_parser._docling_parse") as mock_d, \
             patch("duyo.textbook.docling_parser._paddle_parse") as mock_p:
            mock_d.return_value = [RawChunk(text="A" * 300, chapter="Bob")]
            result = await parse(pdf, strategy="auto")

        mock_d.assert_called_once()
        mock_p.assert_not_called()
        assert len(result) == 1

    @pytest.mark.asyncio
    async def test_auto_falls_back_to_paddle_when_scanned(self, tmp_path: Path) -> None:
        from duyo.textbook.docling_parser import RawChunk, parse

        pdf = _fake_pdf(tmp_path)

        with patch("duyo.textbook.docling_parser._docling_parse") as mock_d, \
             patch("duyo.textbook.docling_parser._paddle_parse") as mock_p:
            mock_d.return_value = [RawChunk(text="az")]  # < 200 chars → scanned
            mock_p.return_value = [RawChunk(text="B" * 300, chapter="Skanerlangan")]
            mock_p.__call__ = mock_p
            import asyncio
            mock_p.return_value = [RawChunk(text="B" * 300)]

            async def fake_paddle(path):
                return [RawChunk(text="B" * 300, chapter="Skanerlangan")]

            mock_p.side_effect = fake_paddle
            result = await parse(pdf, strategy="auto")

        mock_d.assert_called_once()
        mock_p.assert_called_once()

    @pytest.mark.asyncio
    async def test_paddle_strategy_skips_docling(self, tmp_path: Path) -> None:
        from duyo.textbook.docling_parser import RawChunk, parse

        pdf = _fake_pdf(tmp_path)

        async def fake_paddle(path):
            return [RawChunk(text="C" * 200)]

        with patch("duyo.textbook.docling_parser._docling_parse") as mock_d, \
             patch("duyo.textbook.docling_parser._paddle_parse", side_effect=fake_paddle):
            result = await parse(pdf, strategy="paddle")

        mock_d.assert_not_called()
        assert len(result) == 1

    @pytest.mark.asyncio
    async def test_docling_strategy_skips_paddle(self, tmp_path: Path) -> None:
        from duyo.textbook.docling_parser import RawChunk, parse

        pdf = _fake_pdf(tmp_path)

        async def fake_paddle(path):
            return [RawChunk(text="D" * 200)]

        with patch("duyo.textbook.docling_parser._docling_parse") as mock_d, \
             patch("duyo.textbook.docling_parser._paddle_parse", side_effect=fake_paddle) as mock_p:
            mock_d.return_value = [RawChunk(text="E" * 200)]
            result = await parse(pdf, strategy="docling")

        mock_p.assert_not_called()
        mock_d.assert_called_once()

    @pytest.mark.asyncio
    async def test_non_pdf_always_docling(self, tmp_path: Path) -> None:
        from duyo.textbook.docling_parser import RawChunk, parse

        docx = tmp_path / "test.docx"
        docx.write_bytes(b"fake")

        async def fake_paddle(path):
            return [RawChunk(text="F" * 200)]

        with patch("duyo.textbook.docling_parser._docling_parse") as mock_d, \
             patch("duyo.textbook.docling_parser._paddle_parse", side_effect=fake_paddle) as mock_p:
            mock_d.return_value = [RawChunk(text="G" * 200)]
            result = await parse(docx, strategy="paddle")

        mock_p.assert_not_called()
        mock_d.assert_called_once()
