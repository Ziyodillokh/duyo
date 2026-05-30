"""Tesseract OCR service for scanned PDFs, Uzbek Cyrillic, and broken-encoding PDFs.

Tesseract is the most stable OCR engine on Apple Silicon (PaddlePaddle's
detection model silently fails on macOS ARM). Free, local, offline.

Calls the `tesseract` CLI via subprocess, piping the PNG image through stdin.
We avoid pytesseract (its error handler crashes with UnicodeDecodeError when
tesseract writes non-UTF-8 bytes to stderr) and avoid temp files (stdin piping
sidesteps sandbox temp-dir access issues).

Pipeline:
  PDF → pymupdf page render (300 DPI, PNG bytes) → tesseract stdin → text → markdown

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
import os
import re
import shutil
import subprocess
from pathlib import Path

log = logging.getLogger(__name__)

# Tesseract page segmentation mode 6 = assume a single uniform block of text.
# Works better than psm 3 (auto) on textbook pages with mixed exercises.
_PSM = 6
# OCR engine mode 1 = LSTM neural net only (best accuracy).
_OEM = 1
# DPI for PDF→image rendering.
_RENDER_DPI = 300
_DPI_SCALE = _RENDER_DPI / 72

# Common Homebrew tessdata location (Apple Silicon).
_DEFAULT_TESSDATA = "/opt/homebrew/share/tessdata"


def _tesseract_cmd() -> str:
    """Locate the tesseract binary."""
    cmd = shutil.which("tesseract") or "/opt/homebrew/bin/tesseract"
    if not Path(cmd).exists():
        raise RuntimeError(
            "tesseract binary not found. Run: brew install tesseract tesseract-lang"
        )
    return cmd


def _detect_lang(sample: str) -> str:
    """Pick Tesseract lang string from the PDF's extracted text sample."""
    cyrillic = len(re.findall(r"[а-яёА-ЯЁ]", sample))
    latin = len(re.findall(r"[a-zA-Z]", sample))
    if cyrillic > latin:
        return "uzb_cyrl+rus"
    return "uzb+eng"


def _available_langs() -> set[str]:
    """Return the set of installed Tesseract language packs."""
    try:
        result = subprocess.run(
            [_tesseract_cmd(), "--list-langs"],
            capture_output=True, text=True, errors="replace", timeout=30,
        )
        return {ln.strip() for ln in result.stdout.splitlines()[1:] if ln.strip()}
    except Exception:
        return set()


def _resolve_lang(requested: str) -> str:
    """Drop language codes that aren't installed; fall back to 'eng'."""
    available = _available_langs()
    if not available:
        return requested
    wanted = [code for code in requested.split("+") if code in available]
    return "+".join(wanted) if wanted else "eng"


def _ocr_png_bytes(png_bytes: bytes, lang: str) -> str:
    """Run tesseract on PNG bytes via stdin. Returns recognised text.

    stderr is decoded with errors='replace' so tesseract's resolution
    warnings (which may contain non-UTF-8 bytes) never crash us.
    """
    env = os.environ.copy()
    if "TESSDATA_PREFIX" not in env and Path(_DEFAULT_TESSDATA).exists():
        env["TESSDATA_PREFIX"] = _DEFAULT_TESSDATA

    result = subprocess.run(
        [
            _tesseract_cmd(), "stdin", "stdout",
            "-l", lang,
            "--oem", str(_OEM),
            "--psm", str(_PSM),
            "--dpi", str(_RENDER_DPI),
        ],
        input=png_bytes,
        capture_output=True,
        timeout=120,
        env=env,
    )
    if result.returncode != 0:
        stderr = result.stderr.decode("utf-8", errors="replace")
        raise RuntimeError(f"tesseract failed (code {result.returncode}): {stderr[:200]}")

    return result.stdout.decode("utf-8", errors="replace")


def _render_page_to_png_bytes(page) -> bytes:  # type: ignore[no-untyped-def]
    """Render a pymupdf page to PNG bytes at _RENDER_DPI."""
    import fitz  # pymupdf

    mat = fitz.Matrix(_DPI_SCALE, _DPI_SCALE)
    pix = page.get_pixmap(matrix=mat, alpha=False)
    return pix.tobytes("png")


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
        RuntimeError: If pymupdf or the tesseract binary is missing.
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
        png_bytes = _render_page_to_png_bytes(doc[i])
        text = _ocr_png_bytes(png_bytes, resolved_lang)
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
