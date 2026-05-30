"""Tests for Mistral OCR service — all HTTP calls mocked with httpx."""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from duyo.textbook.mistral_ocr import ocr_pdf, ocr_pdf_as_markdown


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_response(pages: list[dict], status: int = 200) -> MagicMock:
    """Build a fake httpx.Response with the Mistral OCR response shape."""
    mock_resp = MagicMock()
    mock_resp.status_code = status
    mock_resp.json.return_value = {
        "pages": pages,
        "model": "mistral-ocr-latest",
        "usage_info": {"pages_processed": len(pages)},
    }
    if status >= 400:
        from httpx import HTTPStatusError, Request, Response
        mock_resp.raise_for_status.side_effect = HTTPStatusError(
            message=f"HTTP {status}",
            request=MagicMock(),
            response=MagicMock(),
        )
    else:
        mock_resp.raise_for_status.return_value = None
    return mock_resp


def _fake_pdf(tmp_path: Path) -> Path:
    """Create a tiny placeholder 'PDF' file (just bytes, not real PDF)."""
    f = tmp_path / "test.pdf"
    f.write_bytes(b"%PDF-1.4 fake content for testing")
    return f


# ---------------------------------------------------------------------------
# ocr_pdf
# ---------------------------------------------------------------------------

class TestOcrPdf:
    @pytest.mark.asyncio
    async def test_returns_per_page_markdown(self, tmp_path: Path) -> None:
        pdf = _fake_pdf(tmp_path)
        pages = [
            {"index": 0, "markdown": "# Kasrlar\n\nKasrlar haqida."},
            {"index": 1, "markdown": "## Misol\n\n$3/4 + 1/4 = 1$"},
        ]
        mock_resp = _make_response(pages)

        with patch("duyo.textbook.mistral_ocr.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = AsyncMock(return_value=mock_resp)
            mock_client_cls.return_value = mock_client

            result = await ocr_pdf(pdf, api_key="test-key")

        assert len(result) == 2
        assert "Kasrlar" in result[0]
        assert "3/4" in result[1]

    @pytest.mark.asyncio
    async def test_raises_when_no_api_key(self, tmp_path: Path) -> None:
        pdf = _fake_pdf(tmp_path)

        with patch("duyo.textbook.mistral_ocr.get_settings") as mock_settings:
            mock_settings.return_value.mistral_api_key = ""
            mock_settings.return_value.mistral_ocr_model = "mistral-ocr-latest"

            with pytest.raises(RuntimeError, match="MISTRAL_API_KEY"):
                await ocr_pdf(pdf)

    @pytest.mark.asyncio
    async def test_sends_correct_model(self, tmp_path: Path) -> None:
        pdf = _fake_pdf(tmp_path)
        mock_resp = _make_response([{"index": 0, "markdown": "text"}])

        with patch("duyo.textbook.mistral_ocr.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = AsyncMock(return_value=mock_resp)
            mock_client_cls.return_value = mock_client

            await ocr_pdf(pdf, api_key="test-key", model="mistral-ocr-latest")

        call_kwargs = mock_client.post.call_args.kwargs
        assert call_kwargs["json"]["model"] == "mistral-ocr-latest"

    @pytest.mark.asyncio
    async def test_sends_base64_pdf(self, tmp_path: Path) -> None:
        pdf = _fake_pdf(tmp_path)
        mock_resp = _make_response([{"index": 0, "markdown": ""}])

        with patch("duyo.textbook.mistral_ocr.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = AsyncMock(return_value=mock_resp)
            mock_client_cls.return_value = mock_client

            await ocr_pdf(pdf, api_key="test-key")

        body = mock_client.post.call_args.kwargs["json"]
        doc_url = body["document"]["document_url"]
        assert doc_url.startswith("data:application/pdf;base64,")

    @pytest.mark.asyncio
    async def test_empty_pages_returns_empty_list(self, tmp_path: Path) -> None:
        pdf = _fake_pdf(tmp_path)
        mock_resp = _make_response([])

        with patch("duyo.textbook.mistral_ocr.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = AsyncMock(return_value=mock_resp)
            mock_client_cls.return_value = mock_client

            result = await ocr_pdf(pdf, api_key="test-key")

        assert result == []


# ---------------------------------------------------------------------------
# ocr_pdf_as_markdown
# ---------------------------------------------------------------------------

class TestOcrPdfAsMarkdown:
    @pytest.mark.asyncio
    async def test_joins_pages_with_separator(self, tmp_path: Path) -> None:
        pdf = _fake_pdf(tmp_path)

        with patch("duyo.textbook.mistral_ocr.ocr_pdf", new_callable=AsyncMock) as mock_ocr:
            mock_ocr.return_value = ["# Sahifa 1\n\nMatn.", "# Sahifa 2\n\nBoshqa matn."]
            result = await ocr_pdf_as_markdown(pdf, api_key="key")

        assert "---" in result
        assert "Sahifa 1" in result
        assert "Sahifa 2" in result

    @pytest.mark.asyncio
    async def test_empty_pages_filtered(self, tmp_path: Path) -> None:
        pdf = _fake_pdf(tmp_path)

        with patch("duyo.textbook.mistral_ocr.ocr_pdf", new_callable=AsyncMock) as mock_ocr:
            mock_ocr.return_value = ["# Matn bor.", "", "  "]
            result = await ocr_pdf_as_markdown(pdf, api_key="key")

        assert "---" not in result  # only one real page
        assert "Matn bor" in result


# ---------------------------------------------------------------------------
# Hybrid routing in docling_parser
# ---------------------------------------------------------------------------

class TestHybridParsing:
    @pytest.mark.asyncio
    async def test_auto_uses_docling_for_digital_pdf(self, tmp_path: Path) -> None:
        from duyo.textbook.docling_parser import parse

        pdf = _fake_pdf(tmp_path)

        with patch("duyo.textbook.docling_parser._docling_parse") as mock_docling, \
             patch("duyo.textbook.docling_parser._mistral_parse") as mock_mistral:

            from duyo.textbook.docling_parser import RawChunk
            # Docling returns enough text
            rich_chunk = RawChunk(text="A" * 300, chapter="Kasrlar")
            mock_docling.return_value = [rich_chunk]

            result = await parse(pdf, strategy="auto")

        mock_docling.assert_called_once_with(pdf)
        mock_mistral.assert_not_called()
        assert len(result) == 1

    @pytest.mark.asyncio
    async def test_auto_falls_back_to_mistral_when_scanned(self, tmp_path: Path) -> None:
        from duyo.textbook.docling_parser import parse, RawChunk

        pdf = _fake_pdf(tmp_path)

        with patch("duyo.textbook.docling_parser._docling_parse") as mock_docling, \
             patch("duyo.textbook.docling_parser._mistral_parse", new_callable=AsyncMock) as mock_mistral:

            # Docling extracts almost nothing → scanned PDF
            mock_docling.return_value = [RawChunk(text="ab")]  # 2 chars < 200 threshold
            mistral_chunk = RawChunk(text="B" * 400, chapter="Skanerlangan")
            mock_mistral.return_value = [mistral_chunk]

            result = await parse(pdf, strategy="auto")

        mock_docling.assert_called_once()
        mock_mistral.assert_called_once()
        assert result[0].chapter == "Skanerlangan"

    @pytest.mark.asyncio
    async def test_mistral_strategy_skips_docling(self, tmp_path: Path) -> None:
        from duyo.textbook.docling_parser import parse, RawChunk

        pdf = _fake_pdf(tmp_path)

        with patch("duyo.textbook.docling_parser._docling_parse") as mock_docling, \
             patch("duyo.textbook.docling_parser._mistral_parse", new_callable=AsyncMock) as mock_mistral:

            mock_mistral.return_value = [RawChunk(text="C" * 200)]

            result = await parse(pdf, strategy="mistral")

        mock_docling.assert_not_called()
        mock_mistral.assert_called_once()

    @pytest.mark.asyncio
    async def test_docling_strategy_skips_mistral(self, tmp_path: Path) -> None:
        from duyo.textbook.docling_parser import parse, RawChunk

        pdf = _fake_pdf(tmp_path)

        with patch("duyo.textbook.docling_parser._docling_parse") as mock_docling, \
             patch("duyo.textbook.docling_parser._mistral_parse", new_callable=AsyncMock) as mock_mistral:

            mock_docling.return_value = [RawChunk(text="D" * 200)]

            result = await parse(pdf, strategy="docling")

        mock_mistral.assert_not_called()
        mock_docling.assert_called_once()

    @pytest.mark.asyncio
    async def test_non_pdf_always_uses_docling(self, tmp_path: Path) -> None:
        from duyo.textbook.docling_parser import parse, RawChunk

        docx = tmp_path / "test.docx"
        docx.write_bytes(b"fake docx")

        with patch("duyo.textbook.docling_parser._docling_parse") as mock_docling, \
             patch("duyo.textbook.docling_parser._mistral_parse", new_callable=AsyncMock) as mock_mistral:

            mock_docling.return_value = [RawChunk(text="E" * 200)]
            # Even with strategy="mistral", DOCX → Docling
            result = await parse(docx, strategy="mistral")

        mock_mistral.assert_not_called()
        mock_docling.assert_called_once()
