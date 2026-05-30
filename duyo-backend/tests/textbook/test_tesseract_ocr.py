"""Tests for Tesseract OCR service and hybrid routing.

pytesseract and pymupdf are mocked — no real OCR or PDF needed.
"""

from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest


def _fake_pdf(tmp_path: Path, name: str = "test.pdf") -> Path:
    f = tmp_path / name
    f.write_bytes(b"%PDF-1.4 fake")
    return f


# ---------------------------------------------------------------------------
# _detect_lang
# ---------------------------------------------------------------------------

class TestDetectLang:
    def test_cyrillic_returns_uzb_cyrl(self) -> None:
        from duyo.textbook.tesseract_ocr import _detect_lang
        assert _detect_lang("Математика дарслиги") == "uzb_cyrl+rus"

    def test_latin_returns_uzb(self) -> None:
        from duyo.textbook.tesseract_ocr import _detect_lang
        assert _detect_lang("Matematika darsligi") == "uzb+eng"

    def test_empty_returns_latin(self) -> None:
        from duyo.textbook.tesseract_ocr import _detect_lang
        assert _detect_lang("") == "uzb+eng"


# ---------------------------------------------------------------------------
# _resolve_lang — drops uninstalled packs
# ---------------------------------------------------------------------------

class TestResolveLang:
    def test_keeps_installed_langs(self) -> None:
        from duyo.textbook.tesseract_ocr import _resolve_lang
        with patch("duyo.textbook.tesseract_ocr._available_langs",
                   return_value={"uzb", "eng", "rus"}):
            assert _resolve_lang("uzb+eng") == "uzb+eng"

    def test_drops_missing_langs(self) -> None:
        from duyo.textbook.tesseract_ocr import _resolve_lang
        with patch("duyo.textbook.tesseract_ocr._available_langs",
                   return_value={"eng"}):
            assert _resolve_lang("uzb+eng") == "eng"

    def test_falls_back_to_eng_when_none_match(self) -> None:
        from duyo.textbook.tesseract_ocr import _resolve_lang
        with patch("duyo.textbook.tesseract_ocr._available_langs",
                   return_value={"eng"}):
            assert _resolve_lang("uzb_cyrl+rus") == "eng"

    def test_passthrough_when_no_langs_detected(self) -> None:
        from duyo.textbook.tesseract_ocr import _resolve_lang
        with patch("duyo.textbook.tesseract_ocr._available_langs",
                   return_value=set()):
            assert _resolve_lang("uzb+eng") == "uzb+eng"


# ---------------------------------------------------------------------------
# _ocr_image
# ---------------------------------------------------------------------------

class TestOcrImage:
    def test_calls_pytesseract(self) -> None:
        from duyo.textbook import tesseract_ocr as mod

        mock_pt = MagicMock()
        mock_pt.image_to_string.return_value = "Ta'rif: kasrlar."
        with patch.dict("sys.modules", {"pytesseract": mock_pt}):
            result = mod._ocr_image(object(), "uzb+eng")

        assert result == "Ta'rif: kasrlar."
        mock_pt.image_to_string.assert_called_once()

    def test_raises_without_pytesseract(self) -> None:
        import builtins

        from duyo.textbook import tesseract_ocr as mod

        real_import = builtins.__import__

        def fake_import(name, *args, **kwargs):
            if name == "pytesseract":
                raise ImportError("simulated missing pytesseract")
            return real_import(name, *args, **kwargs)

        with patch("builtins.__import__", side_effect=fake_import):
            with pytest.raises(RuntimeError, match="pytesseract"):
                mod._ocr_image(object(), "eng")


# ---------------------------------------------------------------------------
# ocr_pdf_as_markdown
# ---------------------------------------------------------------------------

class TestOcrPdfAsMarkdown:
    def test_joins_pages(self, tmp_path: Path) -> None:
        from duyo.textbook.tesseract_ocr import ocr_pdf_as_markdown
        pdf = _fake_pdf(tmp_path)
        with patch("duyo.textbook.tesseract_ocr.ocr_pdf") as mock:
            mock.return_value = ["Sahifa bir matni.", "Sahifa ikki matni."]
            result = ocr_pdf_as_markdown(pdf, lang="uzb+eng")
        assert "---" in result
        assert "Sahifa bir" in result
        assert "Sahifa ikki" in result

    def test_skips_empty_pages(self, tmp_path: Path) -> None:
        from duyo.textbook.tesseract_ocr import ocr_pdf_as_markdown
        pdf = _fake_pdf(tmp_path)
        with patch("duyo.textbook.tesseract_ocr.ocr_pdf") as mock:
            mock.return_value = ["Matn bor.", "", "   "]
            result = ocr_pdf_as_markdown(pdf, lang="uzb+eng")
        assert "---" not in result
        assert "Matn bor" in result


# ---------------------------------------------------------------------------
# Hybrid routing in docling_parser
# ---------------------------------------------------------------------------

class TestHybridRouting:
    @pytest.mark.asyncio
    async def test_auto_uses_docling_when_clean(self, tmp_path: Path) -> None:
        from duyo.textbook.docling_parser import RawChunk, parse
        pdf = _fake_pdf(tmp_path)
        with patch("duyo.textbook.docling_parser._docling_parse") as md, \
             patch("duyo.textbook.docling_parser._tesseract_parse") as mt:
            md.return_value = [RawChunk(text="A" * 300, chapter="Bob")]
            result = await parse(pdf, strategy="auto")
        md.assert_called_once()
        mt.assert_not_called()
        assert len(result) == 1

    @pytest.mark.asyncio
    async def test_auto_falls_back_when_short(self, tmp_path: Path) -> None:
        from duyo.textbook.docling_parser import RawChunk, parse
        pdf = _fake_pdf(tmp_path)

        async def fake_tess(path):
            return [RawChunk(text="B" * 300, chapter="Scanned")]

        with patch("duyo.textbook.docling_parser._docling_parse") as md, \
             patch("duyo.textbook.docling_parser._tesseract_parse", side_effect=fake_tess) as mt:
            md.return_value = [RawChunk(text="ab")]  # < 200
            result = await parse(pdf, strategy="auto")
        md.assert_called_once()
        mt.assert_called_once()
        assert result[0].chapter == "Scanned"

    @pytest.mark.asyncio
    async def test_auto_falls_back_on_glyph_garbage(self, tmp_path: Path) -> None:
        from duyo.textbook.docling_parser import RawChunk, parse
        pdf = _fake_pdf(tmp_path)
        garbage = "/G31/G2E/G20 /G53/G6F/G6E " * 30

        async def fake_tess(path):
            return [RawChunk(text="Haqiqiy matn " * 30, chapter="OCR")]

        with patch("duyo.textbook.docling_parser._docling_parse") as md, \
             patch("duyo.textbook.docling_parser._tesseract_parse", side_effect=fake_tess) as mt:
            md.return_value = [RawChunk(text=garbage)]
            result = await parse(pdf, strategy="auto")
        md.assert_called_once()
        mt.assert_called_once()
        assert result[0].chapter == "OCR"

    @pytest.mark.asyncio
    async def test_tesseract_strategy_skips_docling(self, tmp_path: Path) -> None:
        from duyo.textbook.docling_parser import RawChunk, parse
        pdf = _fake_pdf(tmp_path)

        async def fake_tess(path):
            return [RawChunk(text="C" * 200)]

        with patch("duyo.textbook.docling_parser._docling_parse") as md, \
             patch("duyo.textbook.docling_parser._tesseract_parse", side_effect=fake_tess):
            result = await parse(pdf, strategy="tesseract")
        md.assert_not_called()
        assert len(result) == 1

    @pytest.mark.asyncio
    async def test_docling_strategy_skips_tesseract(self, tmp_path: Path) -> None:
        from duyo.textbook.docling_parser import RawChunk, parse
        pdf = _fake_pdf(tmp_path)

        async def fake_tess(path):
            return [RawChunk(text="D" * 200)]

        with patch("duyo.textbook.docling_parser._docling_parse") as md, \
             patch("duyo.textbook.docling_parser._tesseract_parse", side_effect=fake_tess) as mt:
            md.return_value = [RawChunk(text="E" * 200)]
            result = await parse(pdf, strategy="docling")
        mt.assert_not_called()
        md.assert_called_once()

    @pytest.mark.asyncio
    async def test_non_pdf_always_docling(self, tmp_path: Path) -> None:
        from duyo.textbook.docling_parser import RawChunk, parse
        docx = tmp_path / "test.docx"
        docx.write_bytes(b"fake")

        async def fake_tess(path):
            return [RawChunk(text="F" * 200)]

        with patch("duyo.textbook.docling_parser._docling_parse") as md, \
             patch("duyo.textbook.docling_parser._tesseract_parse", side_effect=fake_tess) as mt:
            md.return_value = [RawChunk(text="G" * 200)]
            result = await parse(docx, strategy="tesseract")
        mt.assert_not_called()
        md.assert_called_once()


# ---------------------------------------------------------------------------
# Glyph garbage detection
# ---------------------------------------------------------------------------

class TestGlyphGarbageDetection:
    def test_detects_glyph_ids(self) -> None:
        from duyo.textbook.docling_parser import _is_glyph_garbage
        assert _is_glyph_garbage("/G31/G2E/G20/G53/G6F/G6E/G6C/G61/G72") is True

    def test_clean_text_not_garbage(self) -> None:
        from duyo.textbook.docling_parser import _is_glyph_garbage
        assert _is_glyph_garbage("Kasrlar haqida bilim. Muhim mavzu.") is False

    def test_empty_not_garbage(self) -> None:
        from duyo.textbook.docling_parser import _is_glyph_garbage
        assert _is_glyph_garbage("") is False
