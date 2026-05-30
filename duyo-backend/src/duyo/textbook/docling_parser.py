"""Hybrid document parser: Docling (digital PDFs) + PaddleOCR (scanned PDFs).

Routing strategy:
  auto    — Docling first; if extracted text < threshold → PaddleOCR fallback.
  docling — Always Docling (fast, free, offline). Good for digital PDFs/DOCX/HTML.
  paddle  — Always PaddleOCR. Good for scanned PDFs, Uzbek Cyrillic, formulas.

Non-PDF formats (.docx/.html/.pptx) always use Docling regardless of strategy.

Output: list of RawChunk with heading, formula, table, image metadata.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal

log = logging.getLogger(__name__)

# Docling is an optional dependency — only needed for local ingestion.
# Install with: pip install -e ".[ingestion]"
# Production API container does NOT include docling.
try:
    import docling as _docling_available  # noqa: F401
    _HAS_DOCLING = True
except ImportError:
    _HAS_DOCLING = False

# Supported extensions (Docling handles all of these)
DOCLING_EXTENSIONS = {".pdf", ".docx", ".doc", ".html", ".htm", ".pptx", ".md"}

# Min chars per chunk — same as text pipeline
_MIN_CHUNK_CHARS = 60
_MAX_CHUNK_CHARS = 2000


@dataclass
class RawChunk:
    """A section of text extracted from a structured document."""

    text: str
    chapter: str | None = None       # H1/H2 heading that started this section
    section: str | None = None       # H3/H4 sub-heading
    has_formula: bool = False
    has_table: bool = False
    has_image: bool = False
    page_number: int | None = None


OcrStrategy = Literal["auto", "docling", "paddle"]

# Minimum total chars from Docling before we decide a PDF is "scanned"
_SCANNED_THRESHOLD_CHARS = 200

def is_supported(path: Path) -> bool:
    return path.suffix.lower() in DOCLING_EXTENSIONS


async def parse(
    path: Path,
    *,
    strategy: OcrStrategy = "auto",
) -> list[RawChunk]:
    """Convert a document file to RawChunks.

    Strategies:
      "auto"    — Docling first; if extracted text < threshold → Mistral OCR fallback.
                  Best for mixed collections (digital + scanned).
      "docling" — Always use Docling. Fast, free, offline.
                  Use for digital PDFs and non-PDF formats (DOCX, HTML, PPTX).
      "mistral" — Always use Mistral OCR.
                  Use for scanned PDFs, Cyrillic, or formula-heavy documents.

    Raises:
        RuntimeError: If docling not installed when strategy requires it.
        RuntimeError: If MISTRAL_API_KEY not set when strategy requires it.
    """
    suffix = path.suffix.lower()

    # Non-PDF formats → always Docling (Mistral OCR only handles PDFs)
    if suffix != ".pdf":
        return _docling_parse(path)

    # PDF routing
    if strategy == "paddle":
        return await _paddle_parse(path)

    if strategy == "docling":
        return _docling_parse(path)

    # strategy == "auto"
    log.info("parse_auto_start", path=str(path))
    try:
        chunks = _docling_parse(path)
        total_chars = sum(len(c.text) for c in chunks)
        if total_chars >= _SCANNED_THRESHOLD_CHARS:
            log.info(
                "parse_auto_docling_ok",
                path=str(path),
                chunks=len(chunks),
                total_chars=total_chars,
            )
            return chunks
        log.info(
            "parse_auto_scanned_detected",
            path=str(path),
            total_chars=total_chars,
            threshold=_SCANNED_THRESHOLD_CHARS,
        )
    except Exception as exc:
        log.warning("parse_auto_docling_failed", path=str(path), error=str(exc))

    # Fall back to Mistral OCR
    log.info("parse_auto_paddle_fallback", path=str(path))
    return await _paddle_parse(path)


def _docling_parse(path: Path) -> list[RawChunk]:
    """Parse with Docling (sync). For digital PDFs, DOCX, HTML, PPTX."""
    if not _HAS_DOCLING:
        raise RuntimeError(
            "docling is not installed. Run: pip install -e '.[ingestion]'\n"
            "docling is an optional dependency — not included in the production container."
        )
    from docling.datamodel.base_models import InputFormat
    from docling.datamodel.pipeline_options import PdfPipelineOptions
    from docling.document_converter import DocumentConverter, PdfFormatOption

    # do_ocr=False: selectable-text PDFs only (faster, no ML model loading)
    pipeline_options = PdfPipelineOptions()
    pipeline_options.do_ocr = False
    pipeline_options.do_table_structure = True

    converter = DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options),
        }
    )

    log.info("docling_convert_start", path=str(path))
    result = converter.convert(str(path))
    doc = result.document
    log.info("docling_convert_done", path=str(path))

    return _extract_chunks(doc)


def _extract_chunks(doc: Any) -> list[RawChunk]:
    """Walk Docling document items and group them into RawChunks by heading."""
    chunks: list[RawChunk] = []

    current_chapter: str | None = None
    current_section: str | None = None
    buffer_parts: list[str] = []
    buffer_has_formula = False
    buffer_has_table = False
    buffer_has_image = False
    buffer_page: int | None = None

    def _flush() -> None:
        nonlocal buffer_parts, buffer_has_formula, buffer_has_table, buffer_has_image, buffer_page
        text = "\n\n".join(p.strip() for p in buffer_parts if p.strip())
        if len(text) >= _MIN_CHUNK_CHARS:
            # Split oversized chunks on sentence boundaries
            for sub in _split_large(text):
                chunks.append(RawChunk(
                    text=sub,
                    chapter=current_chapter,
                    section=current_section,
                    has_formula=buffer_has_formula,
                    has_table=buffer_has_table,
                    has_image=buffer_has_image,
                    page_number=buffer_page,
                ))
        buffer_parts = []
        buffer_has_formula = False
        buffer_has_table = False
        buffer_has_image = False
        buffer_page = None

    try:
        items = list(doc.iterate_items())
    except AttributeError:
        # Fallback: export to markdown and split by headings
        return _parse_from_markdown(doc.export_to_markdown())

    for item, _level in items:
        item_type = type(item).__name__

        # Page tracking
        try:
            prov = item.prov[0] if item.prov else None
            if prov:
                buffer_page = buffer_page or prov.page_no
        except (AttributeError, IndexError):
            pass

        if item_type in ("SectionHeaderItem", "HeadingItem"):
            _flush()
            label = _clean(item.text)
            if not label:
                continue
            # Distinguish H1/H2 (chapter) from H3+ (section)
            level = getattr(item, "level", None) or getattr(item, "heading_level", 3)
            if isinstance(level, int) and level <= 2:
                current_chapter = label
                current_section = None
            else:
                current_section = label

        elif item_type == "TextItem":
            text = _clean(item.text)
            if text:
                if _is_formula(text):
                    buffer_has_formula = True
                buffer_parts.append(text)

        elif item_type == "TableItem":
            buffer_has_table = True
            try:
                table_md = item.export_to_markdown()
                if table_md:
                    buffer_parts.append(table_md)
            except Exception:
                buffer_parts.append("[TABLE]")

        elif item_type == "PictureItem":
            buffer_has_image = True
            caption = _clean(getattr(item, "caption", "") or "")
            if caption:
                buffer_parts.append(f"[RASM: {caption}]")
            else:
                buffer_parts.append("[RASM]")

        elif item_type == "FormulaItem":
            buffer_has_formula = True
            formula_text = _clean(getattr(item, "text", "") or "")
            if formula_text:
                buffer_parts.append(formula_text)

    _flush()
    return chunks


def _parse_from_markdown(md: str) -> list[RawChunk]:
    """Fallback: split markdown by heading lines when iterate_items is unavailable."""
    chunks: list[RawChunk] = []
    current_chapter: str | None = None
    current_section: str | None = None
    buffer: list[str] = []
    has_formula = False
    has_table = False
    has_image = False

    heading_re = re.compile(r"^(#{1,6})\s+(.+)$")
    table_re = re.compile(r"^\|.+\|")
    formula_re = re.compile(r"\$[^$]+\$|\\\(.+?\\\)|\\begin\{")
    image_re = re.compile(r"!\[.*?\]\(.*?\)|\[RASM")

    def flush() -> None:
        nonlocal buffer, has_formula, has_table, has_image
        text = "\n".join(buffer).strip()
        if len(text) >= _MIN_CHUNK_CHARS:
            for sub in _split_large(text):
                chunks.append(RawChunk(
                    text=sub,
                    chapter=current_chapter,
                    section=current_section,
                    has_formula=has_formula,
                    has_table=has_table,
                    has_image=has_image,
                ))
        buffer, has_formula, has_table, has_image = [], False, False, False

    for line in md.splitlines():
        m = heading_re.match(line)
        if m:
            flush()
            level = len(m.group(1))
            title = m.group(2).strip()
            if level <= 2:
                current_chapter = title
                current_section = None
            else:
                current_section = title
            continue

        if table_re.match(line):
            has_table = True
        if formula_re.search(line):
            has_formula = True
        if image_re.search(line):
            has_image = True
        buffer.append(line)

    flush()
    return chunks


async def _paddle_parse(path: Path) -> list[RawChunk]:
    """Parse a scanned/complex PDF with PaddleOCR → markdown → RawChunks.

    PaddleOCR runs locally (no API key needed).
    Install: pip install -e '.[ingestion]'
    """
    from duyo.textbook.paddle_ocr import ocr_pdf_as_markdown

    # PaddleOCR is synchronous — run in thread to keep the async chain intact
    import asyncio
    md = await asyncio.get_event_loop().run_in_executor(
        None, lambda: ocr_pdf_as_markdown(path)
    )
    chunks = _parse_from_markdown(md)
    log.info("paddle_parse_done", path=str(path), chunks=len(chunks))
    return chunks


# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------

_FORMULA_RE = re.compile(
    r"\$[^$]+\$|\\\(.+?\\\)|\\begin\{"
    r"|[=+\-*/^√∫∑∏]{2,}"
    r"|\b(?:sin|cos|tan|log|sqrt)\b"
)


def _is_formula(text: str) -> bool:
    return bool(_FORMULA_RE.search(text))


def _clean(text: str | None) -> str:
    if not text:
        return ""
    return re.sub(r"\s+", " ", text).strip()


def _split_large(text: str) -> list[str]:
    """Split text that exceeds MAX_CHUNK_CHARS on sentence boundaries."""
    if len(text) <= _MAX_CHUNK_CHARS:
        return [text]
    sentences = re.split(r"(?<=[.!?])\s+", text)
    parts: list[str] = []
    buf = ""
    for sent in sentences:
        if len(buf) + len(sent) > _MAX_CHUNK_CHARS and buf:
            parts.append(buf.strip())
            buf = sent
        else:
            buf = (buf + " " + sent).strip()
    if buf:
        parts.append(buf)
    return [p for p in parts if len(p) >= _MIN_CHUNK_CHARS]
