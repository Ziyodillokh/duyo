"""PaddleOCR service for scanned PDFs, Uzbek Cyrillic, and formula-heavy documents.

Pipeline:
  PDF → pymupdf page rendering (300 DPI) → PaddleOCR → per-page text → markdown

Language auto-detection:
  Cyrillic char density > Latin → lang='ru'  (Uzbek Cyrillic, Russian)
  Otherwise                    → lang='en'  (Uzbek Latin, English)

Formula support:
  PaddleOCR recognises inline math operators; for dedicated LaTeX extraction
  upgrade to PP-FormulaNet (available in paddleocr>=2.8.0 with extra model).

Install (ingestion only — NOT in production container):
  pip install -e ".[ingestion]"
  which installs: paddlepaddle paddleocr pymupdf
"""

from __future__ import annotations

import logging
import re
from functools import lru_cache
from pathlib import Path

log = logging.getLogger(__name__)

# Minimum OCR confidence to include a text line
_MIN_CONFIDENCE = 0.5
# DPI for PDF→image rendering — 300 gives good OCR quality
_RENDER_DPI = 300
_DPI_SCALE = _RENDER_DPI / 72


def _detect_lang(sample: str) -> str:
    """Return PaddleOCR lang code based on character frequency."""
    cyrillic = len(re.findall(r"[а-яёА-ЯЁ]", sample))
    latin = len(re.findall(r"[a-zA-Z]", sample))
    return "ru" if cyrillic > latin else "en"


@lru_cache(maxsize=4)
def _get_ocr(lang: str):  # type: ignore[return]
    """Return a cached PaddleOCR instance for the given language."""
    try:
        from paddleocr import PaddleOCR
    except ImportError as exc:
        raise RuntimeError(
            "paddleocr is not installed. Run: pip install -e '.[ingestion]'"
        ) from exc

    log.info("paddleocr_init", lang=lang)
    return PaddleOCR(
        lang=lang,
        use_angle_cls=True,
        show_log=False,
        use_gpu=False,     # CPU mode — set True if GPU available
    )


def _render_page_to_bytes(page) -> bytes:  # type: ignore[return]
    """Render a pymupdf page to PNG bytes at _RENDER_DPI."""
    import fitz  # pymupdf

    mat = fitz.Matrix(_DPI_SCALE, _DPI_SCALE)
    pix = page.get_pixmap(matrix=mat, alpha=False)
    return pix.tobytes("png")


def _ocr_image_bytes(img_bytes: bytes, lang: str) -> str:
    """Run PaddleOCR on raw PNG bytes. Returns concatenated text lines."""
    ocr = _get_ocr(lang)
    result = ocr.ocr(img_bytes, cls=True)
    if not result or not result[0]:
        return ""
    lines = [
        line[1][0]
        for line in result[0]
        if line and len(line) >= 2 and line[1][1] >= _MIN_CONFIDENCE
    ]
    return "\n".join(lines)


def ocr_pdf(
    path: Path,
    *,
    lang: str | None = None,
    max_pages: int | None = None,
) -> list[str]:
    """Run PaddleOCR on a PDF file.

    Args:
        path:      Path to the PDF.
        lang:      PaddleOCR language code. Auto-detected from first page if None.
                   'en' for Uzbek Latin/English, 'ru' for Uzbek Cyrillic.
        max_pages: Process only first N pages (None = all pages).

    Returns:
        List of per-page text strings.

    Raises:
        RuntimeError: If paddleocr or pymupdf is not installed.
    """
    try:
        import fitz  # pymupdf
    except ImportError as exc:
        raise RuntimeError(
            "pymupdf is not installed. Run: pip install -e '.[ingestion]'"
        ) from exc

    log.info("paddle_ocr_start", path=str(path))
    doc = fitz.open(str(path))
    n_pages = min(len(doc), max_pages) if max_pages else len(doc)

    # Auto-detect language from a sample of first page text
    detected_lang = lang
    if detected_lang is None:
        first_page = doc[0]
        sample_text = first_page.get_text()
        detected_lang = _detect_lang(sample_text)
        log.info("paddle_ocr_lang_detected", lang=detected_lang, path=str(path))

    pages_text: list[str] = []
    for i in range(n_pages):
        img_bytes = _render_page_to_bytes(doc[i])
        text = _ocr_image_bytes(img_bytes, detected_lang)
        pages_text.append(text)
        log.debug("paddle_ocr_page", page=i + 1, chars=len(text))

    doc.close()
    log.info("paddle_ocr_done", path=str(path), pages=n_pages)
    return pages_text


def ocr_pdf_as_markdown(
    path: Path,
    *,
    lang: str | None = None,
    max_pages: int | None = None,
) -> str:
    """Run PaddleOCR on a PDF and join all pages as a single markdown string.

    Pages are separated by `---` so the downstream parser can detect boundaries.
    """
    pages = ocr_pdf(path, lang=lang, max_pages=max_pages)
    return "\n\n---\n\n".join(p.strip() for p in pages if p.strip())
