"""MinerU parser for formula-heavy PDFs (matematika, fizika, kimyo).

MinerU is a VLM+OCR document pipeline that extracts text, tables, AND
mathematical formulas as LaTeX in one pass. Unlike Tesseract, it produces
clean `$$...$$` LaTeX for equations — essential for math/physics textbooks.

Runs on Apple Silicon via MPS (verified on M4 Pro, torch.backends.mps).
Heavy: needs 16GB+ RAM and downloads ~1-2GB models on first run.

Pipeline:
  PDF → mineru CLI (subprocess) → content_list.json → RawChunks

content_list.json item types:
  text     (text_level=1 → heading)
  equation ($$...$$  LaTeX → has_formula)
  table    (HTML/markdown → has_table)
  image    (→ has_image)

Install (ingestion only): pip install "mineru[core]"
"""

from __future__ import annotations

import json
import logging
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

log = logging.getLogger(__name__)

# Group consecutive items under the current heading into one chunk until it
# reaches this size, then flush — keeps chunks semantically coherent.
_MAX_CHUNK_CHARS = 2000
_MIN_CHUNK_CHARS = 40

# Device for MinerU. MPS = Apple Silicon GPU; falls back to CPU if unavailable.
_DEVICE = os.environ.get("MINERU_DEVICE_MODE", "mps")

# Backend: 'pipeline' (classic OCR + formula detector) is ~25x faster than the
# VLM backend on Apple Silicon (10 pages: 19s vs 8min) with comparable LaTeX
# quality, so it's the default. Override with MINERU_BACKEND=vlm-auto-engine
# for maximum accuracy when speed doesn't matter.
_BACKEND = os.environ.get("MINERU_BACKEND", "pipeline")


def _mineru_cmd() -> str:
    """Locate the mineru CLI (installed in the active venv)."""
    cmd = shutil.which("mineru")
    if cmd:
        return cmd
    # Fall back to the venv bin next to the running interpreter
    import sys
    candidate = Path(sys.executable).parent / "mineru"
    if candidate.exists():
        return str(candidate)
    raise RuntimeError(
        'mineru is not installed. Run: pip install -e ".[ingestion]" '
        '(which includes mineru[core])'
    )


def _run_mineru(pdf_path: Path, out_dir: Path, lang: str) -> Path:
    """Run the mineru CLI; return the path to content_list.json.

    MinerU writes to {out_dir}/{stem}/{backend}/{stem}_content_list.json,
    where {backend} is 'auto' (pipeline) or 'hybrid_auto'/'vlm' (MinerU 3.x
    default). We glob for the file rather than hard-code the backend dir.
    """
    env = os.environ.copy()
    env.setdefault("MINERU_DEVICE_MODE", _DEVICE)

    result = subprocess.run(
        [_mineru_cmd(), "-p", str(pdf_path), "-o", str(out_dir),
         "-l", lang, "-b", _BACKEND],
        capture_output=True,
        timeout=3600,  # 60 min ceiling for a full textbook
        env=env,
    )
    if result.returncode != 0:
        stderr = result.stderr.decode("utf-8", errors="replace")
        raise RuntimeError(f"mineru failed (code {result.returncode}): {stderr[-300:]}")

    stem = pdf_path.stem
    matches = sorted((out_dir / stem).glob(f"*/{stem}_content_list.json"))
    if not matches:
        raise RuntimeError(
            f"mineru produced no content_list.json under {out_dir / stem}"
        )
    return matches[0]


def _items_to_text(items: list[dict]) -> str:
    """Render a group of content items into a single text block."""
    parts: list[str] = []
    for it in items:
        t = it.get("type")
        if t == "equation":
            parts.append(it.get("text", "").strip())
        elif t == "table":
            # MinerU may store table as 'table_body' (HTML) or 'text'
            parts.append(it.get("table_body") or it.get("text", ""))
        elif t == "image":
            cap = it.get("img_caption") or it.get("image_caption") or ""
            cap = " ".join(cap) if isinstance(cap, list) else cap
            parts.append(f"[RASM: {cap}]" if cap else "[RASM]")
        else:  # text
            parts.append(it.get("text", "").strip())
    return "\n\n".join(p for p in parts if p)


def parse_content_list(content_list_path: Path) -> list[dict]:
    """Read content_list.json and group items into chunk dicts.

    A new chunk starts at each heading (text_level set). Within a heading,
    items accumulate until _MAX_CHUNK_CHARS, then flush.

    Returns list of dicts: {text, chapter, has_formula, has_table, has_image}.
    Pure function — no MinerU dependency — so it's unit-testable.
    """
    items = json.loads(content_list_path.read_text(encoding="utf-8"))

    chunks: list[dict] = []
    current_chapter: str | None = None
    buffer: list[dict] = []

    def flush() -> None:
        nonlocal buffer
        if not buffer:
            return
        text = _items_to_text(buffer)
        if len(text) >= _MIN_CHUNK_CHARS:
            # MinerU often emits inline math as $...$ inside text items rather
            # than a separate 'equation' item, so detect LaTeX in the text too.
            has_formula = (
                any(i.get("type") == "equation" for i in buffer)
                or "\\frac" in text
                or "$" in text
            )
            chunks.append({
                "text": text,
                "chapter": current_chapter,
                "has_formula": has_formula,
                "has_table": any(i.get("type") == "table" for i in buffer),
                "has_image": any(i.get("type") == "image" for i in buffer),
            })
        buffer = []

    for item in items:
        # A heading (text_level set on a text item) starts a new section.
        if item.get("type") == "text" and item.get("text_level"):
            flush()
            current_chapter = item.get("text", "").strip()
            buffer = [item]
            continue

        buffer.append(item)
        if len(_items_to_text(buffer)) >= _MAX_CHUNK_CHARS:
            flush()

    flush()
    return chunks


# Pages per MinerU invocation. MinerU's 64-page window loads all formula crops
# at once; on Apple Silicon MPS (≈1GB usable) a 240-page book OOMs during MFR
# (formula recognition). Slicing into small batches caps peak memory; each
# slice reloads the model (~6s) but reliably completes.
_PAGES_PER_BATCH = int(os.environ.get("MINERU_PAGES_PER_BATCH", "20"))


def _page_count(pdf_path: Path) -> int:
    import fitz
    doc = fitz.open(str(pdf_path))
    n = len(doc)
    doc.close()
    return n


def parse(pdf_path: Path, *, lang: str = "latin") -> list[dict]:
    """Run MinerU on a PDF (sliced into page batches) → grouped chunk dicts.

    Each dict: {text, chapter, has_formula, has_table, has_image}.
    Caller wraps these into RawChunk.

    The PDF is split into _PAGES_PER_BATCH-page slices and MinerU runs on each
    slice separately so peak memory stays bounded (MPS OOMs on large batches).

    lang: MinerU OCR language. NOT ISO codes — one of MinerU's script names:
      latin     — Uzbek Latin, English (default; most UZ textbooks)
      cyrillic  — Uzbek Cyrillic, Russian
      east_slavic, arabic, devanagari, en, ch, …
    """
    import fitz

    n_pages = _page_count(pdf_path)
    all_chunks: list[dict] = []

    with tempfile.TemporaryDirectory() as tmp:
        out_dir = Path(tmp)
        src = fitz.open(str(pdf_path))

        for start in range(0, n_pages, _PAGES_PER_BATCH):
            end = min(start + _PAGES_PER_BATCH, n_pages)
            slice_pdf = out_dir / f"slice_{start:04d}.pdf"
            sub = fitz.open()
            sub.insert_pdf(src, from_page=start, to_page=end - 1)
            sub.save(str(slice_pdf))
            sub.close()

            log.info("mineru_slice_start", path=str(pdf_path),
                     pages=f"{start + 1}-{end}/{n_pages}", device=_DEVICE)
            content_list = _run_mineru(slice_pdf, out_dir, lang)
            all_chunks.extend(parse_content_list(content_list))

        src.close()

    log.info("mineru_done", path=str(pdf_path), chunks=len(all_chunks))
    return all_chunks
