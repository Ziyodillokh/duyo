"""Tesseract OCR service for scanned PDFs, Uzbek Cyrillic, and broken-encoding PDFs.

Tesseract is the most stable OCR engine on Apple Silicon (PaddlePaddle's
detection model silently fails on macOS ARM). Free, local, offline.

Pipeline:
  PDF → pymupdf page render (300 DPI) → Tesseract → per-page text → markdown

Language packs (install via: brew install tesseract-lang):
  uzb       — Uzbek Latin
  uzb_cyrl  — Uzbek Cyrillic
  eng       — English (math symbols, mixed content)
  rus       — Russian

Language auto-detection from the PDF's own (possibly broken) text layer:
  Cyrillic-heavy  → "uzb_cyrl+rus"
  Latin-heavy     → "uzb+eng"
"""

from __future__ import annotations

import logging
import re
from pathlib import Path

log = logging.getLogger(__name__)

# Tesseract page segmentation mode 3 = fully automatic, no OSD (good for pages).
_PSM = 3
# OCR engine mode 1 = LSTM neural net only (best accuracy).
_OEM = 1
# DPI for PDF→image rendering.
_RENDER_DPI = 300
_DPI_SCALE = _RENDER_DPI / 72


def _detect_lang(sample: str) -> str:
    """Pick Tesseract lang string from the PDF's extracted text sample."""
    cyrillic = len(re.findall(r"[а-яёА-ЯЁ]", sample))
    latin = len(re.findall(r"[a-zA-Z]", sample))
    if cyrillic > latin:
        return "uzb_cyrl+rus"
    return "uzb+eng"


def _available_langs() -> set[str]:
    """Return the set of Tesseract language packs installed locally."""
    try:
        import pytesseract
        return set(pytesseract.get_languages(config=""))
    except Exception:
        return set()


def _resolve_lang(requested: str) -> str:
    """Drop language codes that aren't installed; fall back to 'eng'.

    e.g. "uzb+eng" with only eng installed → "eng".
    """
    available = _available_langs()
    if not available:
        return requested  # let pytesseract raise a clear error later
    wanted = [code for code in requested.split("+") if code in available]
    return "+".join(wanted) if wanted else "eng"


def _render_page_to_image(page):  # type: ignore[no-untyped-def]
    """Render a pymupdf page to a PIL Image at _RENDER_DPI."""
    import fitz  # pymupdf
    from PIL import Image

    mat = fitz.Matrix(_DPI_SCALE, _DPI_SCALE)
    pix = page.get_pixmap(matrix=mat, alpha=False)
    return Image.frombytes("RGB", (pix.width, pix.height), pix.samples)


def _ocr_image(image, lang: str) -> str:  # type: ignore[no-untyped-def]
    """Run Tesseract on a PIL image. Returns extracted text."""
    try:
        import pytesseract
    except ImportError as exc:
        raise RuntimeError(
            "pytesseract is not installed. Run: pip install -e '.[ingestion]'"
        ) from exc

    config = f"--oem {_OEM} --psm {_PSM}"
    return pytesseract.image_to_string(image, lang=lang, config=config)


def ocr_pdf(
    path: Path,
    *,
    lang: str | None = None,
    max_pages: int | None = None,
) -> list[str]:
    """Run Tesseract OCR on a PDF file.

    Args:
        path:      Path to the PDF.
        lang:      Tesseract lang string (e.g. "uzb+eng"). Auto-detected if None.
        max_pages: Process only first N pages (None = all).

    Returns:
        List of per-page text strings.

    Raises:
        RuntimeError: If pymupdf or pytesseract is not installed.
    """
    try:
        import fitz  # pymupdf
    except ImportError as exc:
        raise RuntimeError(
            "pymupdf is not installed. Run: pip install -e '.[ingestion]'"
        ) from exc

    log.info("tesseract_ocr_start", path=str(path))
    doc = fitz.open(str(path))
    n_pages = min(len(doc), max_pages) if max_pages else len(doc)

    detected_lang = lang
    if detected_lang is None:
        sample = doc[0].get_text() if len(doc) else ""
        detected_lang = _detect_lang(sample)
    resolved_lang = _resolve_lang(detected_lang)
    log.info("tesseract_lang", requested=detected_lang, resolved=resolved_lang)

    pages_text: list[str] = []
    for i in range(n_pages):
        image = _render_page_to_image(doc[i])
        text = _ocr_image(image, resolved_lang)
        pages_text.append(text)
        log.debug("tesseract_page", page=i + 1, chars=len(text))

    doc.close()
    log.info("tesseract_ocr_done", path=str(path), pages=n_pages)
    return pages_text


def ocr_pdf_as_markdown(
    path: Path,
    *,
    lang: str | None = None,
    max_pages: int | None = None,
) -> str:
    """Run Tesseract OCR and join all pages as one markdown string.

    Pages separated by `---` for downstream page-boundary detection.
    """
    pages = ocr_pdf(path, lang=lang, max_pages=max_pages)
    return "\n\n---\n\n".join(p.strip() for p in pages if p.strip())
