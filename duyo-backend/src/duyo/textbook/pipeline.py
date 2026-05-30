"""Orchestrates the two-stage classification pipeline.

Stage 1 — Rule-based:
  confidence >= 0.90 → accept, skip LLM
  confidence 0.70-0.89 → pass as hint to LLM
  confidence < 0.70 → LLM classifies without hint

Stage 2 — LLM (Gemini Flash):
  Runs when rule confidence < 0.90.
  Merges has_formula/table/image from rule stage (more reliable).

Supported input formats:
  .txt          → paragraph-based text splitter
  .pdf, .docx,
  .html, .pptx  → Docling parser (heading-based, structured metadata)
"""

from __future__ import annotations

import hashlib
import re
from pathlib import Path

import structlog

from duyo.textbook import llm_classifier, rule_classifier
from duyo.textbook.docling_parser import OcrStrategy, RawChunk, is_supported, parse as docling_parse
from duyo.textbook.schema import (
    ChunkMetadata,
    ClassifiedChunk,
    Confidence,
    ContentType,
    DocumentMeta,
    Language,
    Script,
)

log = structlog.get_logger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

RULE_AUTO_ACCEPT_THRESHOLD = 0.90
RULE_HINT_THRESHOLD = 0.70

MIN_CHUNK_CHARS = 60    # shorter chunks are likely noise / headers
MAX_CHUNK_CHARS = 2000  # split longer chunks

# ---------------------------------------------------------------------------
# Path → DocumentMeta
# ---------------------------------------------------------------------------

_SUBJECT_ALIASES: dict[str, str] = {
    "math": "matematika", "matematika": "matematika", "maths": "matematika",
    "uz": "ona-tili", "ona-tili": "ona-tili", "uzbek": "ona-tili",
    "history": "tarix", "tarix": "tarix",
    "biology": "biologiya", "biologiya": "biologiya", "bio": "biologiya",
    "physics": "fizika", "fizika": "fizika",
    "chemistry": "kimyo", "kimyo": "kimyo",
    "geography": "geografiya", "geografiya": "geografiya",
}

_GRADE_RE = re.compile(r"(\d+)[-_]?sinf|grade[-_]?(\d+)|(\d+)[-_]?class", re.IGNORECASE)
_LANG_RE = re.compile(r"\b(uz|ru|en)\b", re.IGNORECASE)
_CYRILLIC_RE = re.compile(r"[а-яёА-ЯЁ]{4,}")


def extract_doc_meta(path: Path | str) -> DocumentMeta:
    """Derive DocumentMeta from a file path.

    Expected patterns (any segment of the path):
        uz/matematika/6-sinf/kasrlar.txt
        matematika-6-sinf-uz.txt
        math_grade6_latin.txt

    Falls back to sensible defaults when patterns are not found.
    """
    p = Path(path)
    parts = [s.lower() for s in p.parts] + [p.stem.lower()]
    full = " ".join(parts)

    # Subject
    subject = "unknown"
    for alias, canonical in _SUBJECT_ALIASES.items():
        if alias in full:
            subject = canonical
            break

    # Grade
    grade = 1
    match = _GRADE_RE.search(full)
    if match:
        raw = match.group(1) or match.group(2) or match.group(3)
        grade = int(raw)

    # Language
    language = Language.UZ
    lang_match = _LANG_RE.search(full)
    if lang_match:
        language = Language(lang_match.group(1).lower())

    # Script — try to peek at first 200 bytes of the file
    script = Script.LATIN
    try:
        sample = p.read_text(encoding="utf-8", errors="replace")[:500]
        if _CYRILLIC_RE.search(sample):
            latin_density = len(re.findall(r"[a-zA-Z]", sample))
            cyrillic_density = len(_CYRILLIC_RE.findall(sample))
            script = Script.CYRILLIC if cyrillic_density > latin_density else Script.MIXED
    except OSError:
        pass

    return DocumentMeta(
        subject=subject,
        grade=grade,
        language=language,
        script=script,
        source_path=str(path),
    )


# ---------------------------------------------------------------------------
# Text chunker
# ---------------------------------------------------------------------------

def chunk_text(text: str) -> list[str]:
    """Split text into chunks on blank lines (paragraph-based).

    - Merges short consecutive paragraphs (< MIN_CHUNK_CHARS) into one.
    - Splits paragraphs that exceed MAX_CHUNK_CHARS on sentence boundaries.
    """
    raw_paragraphs = re.split(r"\n{2,}", text.strip())
    merged: list[str] = []
    buffer = ""

    for para in raw_paragraphs:
        para = para.strip()
        if not para:
            continue
        if len(buffer) + len(para) < MIN_CHUNK_CHARS:
            buffer = (buffer + "\n" + para).strip() if buffer else para
        else:
            if buffer:
                merged.append(buffer)
            buffer = para

    if buffer:
        merged.append(buffer)

    # Split oversized chunks on sentence boundaries
    result: list[str] = []
    for chunk in merged:
        if len(chunk) <= MAX_CHUNK_CHARS:
            result.append(chunk)
        else:
            sentences = re.split(r"(?<=[.!?])\s+", chunk)
            sub = ""
            for sent in sentences:
                if len(sub) + len(sent) > MAX_CHUNK_CHARS and sub:
                    result.append(sub.strip())
                    sub = sent
                else:
                    sub = (sub + " " + sent).strip()
            if sub:
                result.append(sub)

    return [c for c in result if len(c) >= MIN_CHUNK_CHARS]


# ---------------------------------------------------------------------------
# Single-chunk pipeline
# ---------------------------------------------------------------------------

async def classify_chunk(
    chunk: str,
    doc_meta: DocumentMeta,
    *,
    docling_hints: RawChunk | None = None,
) -> ChunkMetadata:
    """Classify a single chunk through rule → LLM stages.

    Args:
        chunk: Raw text of the chunk.
        doc_meta: Document-level metadata.
        docling_hints: Optional structural hints from Docling (heading, tables, images).
                       When provided, has_table/has_image/chapter are pre-filled.
    """
    rule = rule_classifier.classify(chunk)

    log.debug(
        "rule_classifier",
        content_type=rule.content_type,
        confidence=rule.confidence,
        has_formula=rule.has_formula,
    )

    if rule.confidence >= RULE_AUTO_ACCEPT_THRESHOLD:
        # Rule is confident — build metadata without calling LLM
        return ChunkMetadata(
            subject=doc_meta.subject,
            grade=doc_meta.grade,
            language=doc_meta.language,
            script=doc_meta.script,
            source_path=doc_meta.source_path,
            content_type=rule.content_type,
            has_formula=rule.has_formula,
            has_table=rule.has_table,
            has_image=rule.has_image,
            confidence=Confidence(
                content_type=rule.confidence,
                topic=0.0,
                difficulty=0.0,
            ),
            classified_by="rule",
            needs_review=False,
        )

    # LLM stage
    hint: str | None = None
    if rule.confidence >= RULE_HINT_THRESHOLD:
        hint = f"{rule.content_type} (confidence {rule.confidence:.2f})"

    try:
        meta = await llm_classifier.classify(chunk, doc_meta, rule_hint=hint)
    except (ValueError, Exception) as exc:
        log.warning("llm_classifier_failed", error=str(exc), chunk_preview=chunk[:80])
        # Fallback to rule result with low confidence
        meta = ChunkMetadata(
            subject=doc_meta.subject,
            grade=doc_meta.grade,
            language=doc_meta.language,
            script=doc_meta.script,
            source_path=doc_meta.source_path,
            content_type=rule.content_type,
            has_formula=rule.has_formula,
            has_table=rule.has_table,
            has_image=rule.has_image,
            confidence=Confidence(
                content_type=rule.confidence,
                topic=0.0,
                difficulty=0.0,
            ),
            classified_by="rule",
            needs_review=True,
        )
        return meta

    # Merge structural signals: rule + LLM + Docling (Docling most reliable)
    docling_has_formula = docling_hints.has_formula if docling_hints else False
    docling_has_table = docling_hints.has_table if docling_hints else False
    docling_has_image = docling_hints.has_image if docling_hints else False
    docling_chapter = docling_hints.chapter if docling_hints else None

    meta = meta.model_copy(update={
        "has_formula": rule.has_formula or meta.has_formula or docling_has_formula,
        "has_table": rule.has_table or meta.has_table or docling_has_table,
        "has_image": rule.has_image or meta.has_image or docling_has_image,
        # Use Docling chapter heading if LLM didn't detect one
        "chapter": meta.chapter or docling_chapter,
        "classified_by": "llm+rule" if hint else "llm",
    })
    return meta


# ---------------------------------------------------------------------------
# Full document pipeline
# ---------------------------------------------------------------------------

def compute_doc_id(path: Path | str) -> str:
    """Deterministic 16-char document id from the file path.

    Same path → same doc_id, which lets --skip-existing detect already-ingested
    files. Exposed publicly so the CLI can check the DB before processing.
    """
    return hashlib.sha256(str(path).encode()).hexdigest()[:16]


# Backwards-compatible internal alias.
_doc_id = compute_doc_id


async def process_file(
    path: Path | str,
    *,
    doc_meta: DocumentMeta | None = None,
    ocr_strategy: OcrStrategy = "auto",
) -> list[ClassifiedChunk]:
    """Read and classify a textbook file.

    Routes by extension and OCR strategy:
      .txt          → paragraph splitter (always)
      .pdf/.docx/… → Docling / Mistral OCR / auto (see OcrStrategy)

    Args:
        path: Path to the file (.txt, .pdf, .docx, .html, etc.).
        doc_meta: Optional override. If None, extracted from `path`.

    Returns:
        List of ClassifiedChunk, one per chunk.
    """
    p = Path(path)

    if doc_meta is None:
        doc_meta = extract_doc_meta(p)

    log.info("processing_file", path=str(p), subject=doc_meta.subject, grade=doc_meta.grade)

    doc_hash = _doc_id(p)
    results: list[ClassifiedChunk] = []

    if is_supported(p):
        # Structured path: PDF/DOCX/HTML via Docling ± Mistral OCR
        raw_chunks = await docling_parse(p, strategy=ocr_strategy)
        for i, raw in enumerate(raw_chunks):
            meta = await classify_chunk(raw.text, doc_meta, docling_hints=raw)
            results.append(ClassifiedChunk(
                text=raw.text,
                metadata=meta,
                chunk_index=i,
                doc_id=doc_hash,
            ))
            log.debug(
                "chunk_classified",
                index=i,
                content_type=meta.content_type,
                classified_by=meta.classified_by,
                chapter=raw.chapter,
            )
    else:
        # Plain text path
        text = p.read_text(encoding="utf-8", errors="replace")
        chunks = chunk_text(text)
        for i, chunk in enumerate(chunks):
            meta = await classify_chunk(chunk, doc_meta)
            results.append(ClassifiedChunk(
                text=chunk,
                metadata=meta,
                chunk_index=i,
                doc_id=doc_hash,
            ))
            log.debug(
                "chunk_classified",
                index=i,
                content_type=meta.content_type,
                classified_by=meta.classified_by,
                confidence=meta.confidence.content_type,
                needs_review=meta.needs_review,
            )

    review_count = sum(1 for r in results if r.metadata.needs_review)
    log.info(
        "file_processed",
        path=str(p),
        total_chunks=len(results),
        needs_review=review_count,
    )
    return results
