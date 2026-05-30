#!/usr/bin/env python3
"""CLI: ingest a textbook file or directory into the DUYO RAG pipeline.

Modes:
  (default)  classify → JSONL stdout/file
  --store    classify → save to PostgreSQL (textbook_chunks)
  --embed    classify → save to DB → generate embeddings (full pipeline)
  --dry-run  rule-only preview, no LLM or DB

Usage:
    # Preview what would be classified (no LLM, no DB)
    python scripts/ingest_textbook.py file.txt --dry-run

    # Classify with LLM → review JSONL
    python scripts/ingest_textbook.py file.txt --out output.jsonl

    # Full pipeline: classify → store → embed
    python scripts/ingest_textbook.py textbooks/ --subject matematika --grade 6 --embed

    # Classify → store (skip embedding for now)
    python scripts/ingest_textbook.py file.txt --store

Environment:
    GOOGLE_API_KEY must be set (reads from .env via pydantic-settings).
    DATABASE_URL must be set when using --store or --embed.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

# Allow running from repo root without installing the package
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from duyo.textbook.pipeline import extract_doc_meta, process_file
from duyo.textbook.schema import Language, Script


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Ingest textbook files (.txt/.pdf/.docx/…) into DUYO RAG pipeline."
    )
    parser.add_argument("path", type=Path, help="File or directory to ingest")
    parser.add_argument("--out", type=Path, default=None,
                        help="Output JSONL file (default: stdout). Ignored with --store/--embed.")
    parser.add_argument("--subject", default=None)
    parser.add_argument("--grade", type=int, default=None)
    parser.add_argument("--language", choices=["uz", "ru", "en"], default=None)
    parser.add_argument("--script", choices=["latin", "cyrillic", "mixed"], default=None)
    parser.add_argument(
        "--ocr-strategy",
        choices=["auto", "docling", "paddle"],
        default="auto",
        help=(
            "auto    — Docling first; PaddleOCR fallback for scanned/low-text PDFs (default)\n"
            "docling — Always Docling (fast, digital PDFs / DOCX / HTML)\n"
            "paddle  — Always PaddleOCR (scanned, Uzbek Cyrillic, formulas)"
        ),
    )

    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true",
                      help="Rule-only preview; no LLM or DB calls")
    mode.add_argument("--store", action="store_true",
                      help="Classify and save to PostgreSQL (no embedding)")
    mode.add_argument("--embed", action="store_true",
                      help="Classify, save to PostgreSQL, and generate embeddings")

    parser.add_argument("--review-only", action="store_true",
                        help="Output only chunks marked needs_review=true")
    parser.add_argument("--skip-existing", action="store_true",
                        help="Skip files already fully ingested+embedded in the DB "
                             "(resume a batch run). Only effective with --store/--embed.")
    return parser.parse_args()


_SUPPORTED_EXTENSIONS = {".txt", ".pdf", ".docx", ".doc", ".html", ".htm", ".pptx"}


def _collect_files(path: Path) -> list[Path]:
    if path.is_file():
        return [path]
    return sorted(
        f for f in path.rglob("*") if f.suffix.lower() in _SUPPORTED_EXTENSIONS
    )


async def _run(args: argparse.Namespace) -> None:
    files = _collect_files(args.path)
    if not files:
        print(f"No .txt files found in {args.path}", file=sys.stderr)
        sys.exit(1)

    use_db = args.store or args.embed
    print(f"Found {len(files)} file(s). Mode: "
          f"{'dry-run' if args.dry_run else 'store+embed' if args.embed else 'store' if args.store else 'jsonl'}",
          file=sys.stderr)

    # Lazy import DB deps only when needed
    session_factory = None
    if use_db:
        from duyo.core.database import get_session_factory
        from duyo.textbook import store as chunk_store
        session_factory = get_session_factory()

    out_file = open(args.out, "w", encoding="utf-8") if (args.out and not use_db) else None
    total = 0
    review_count = 0
    stored = 0
    skipped = 0

    try:
        for f in files:
            doc_meta = extract_doc_meta(f)
            if args.subject:
                doc_meta = doc_meta.model_copy(update={"subject": args.subject})
            if args.grade:
                doc_meta = doc_meta.model_copy(update={"grade": args.grade})
            if args.language:
                doc_meta = doc_meta.model_copy(update={"language": Language(args.language)})
            if args.script:
                doc_meta = doc_meta.model_copy(update={"script": Script(args.script)})

            print(f"  [{f.name}] subject={doc_meta.subject} grade={doc_meta.grade} "
                  f"lang={doc_meta.language}", file=sys.stderr)

            # Resume support: skip files already fully ingested + embedded.
            if args.skip_existing and use_db and session_factory:
                from duyo.textbook.pipeline import compute_doc_id
                doc_id = compute_doc_id(f)
                async with session_factory() as session:
                    if await chunk_store.doc_is_ingested(session, doc_id):
                        print("    ↳ skip (already ingested)", file=sys.stderr)
                        skipped += 1
                        continue

            if args.dry_run:
                from duyo.textbook.docling_parser import is_supported
                from duyo.textbook.pipeline import chunk_text
                from duyo.textbook.rule_classifier import classify as rule_classify

                if is_supported(f):
                    from duyo.textbook.docling_parser import parse as docling_parse
                    raw_chunks = await docling_parse(f, strategy=args.ocr_strategy)
                    chunk_texts = [(r.text, r.chapter) for r in raw_chunks]
                else:
                    text = f.read_text(encoding="utf-8", errors="replace")
                    chunk_texts = [(c, None) for c in chunk_text(text)]

                for i, (chunk, chapter) in enumerate(chunk_texts):
                    r = rule_classify(chunk)
                    row = {
                        "chunk_index": i,
                        "chapter": chapter,
                        "content_type": r.content_type,
                        "confidence": round(r.confidence, 2),
                        "has_formula": r.has_formula,
                        "text_preview": chunk[:120],
                    }
                    line = json.dumps(row, ensure_ascii=False)
                    print(line, file=out_file or sys.stdout)
                    total += 1
                continue

            classified = await process_file(
                f, doc_meta=doc_meta, ocr_strategy=args.ocr_strategy
            )

            if use_db and session_factory:
                async with session_factory() as session:
                    written = await chunk_store.upsert_chunks(session, classified)
                    stored += written

                    if args.embed:
                        doc_id = classified[0].doc_id if classified else None
                        embedded = await chunk_store.embed_pending(session, doc_id=doc_id)
                        print(f"    embedded {embedded} chunks", file=sys.stderr)

                    await session.commit()
            else:
                for chunk in classified:
                    if args.review_only and not chunk.metadata.needs_review:
                        continue
                    row = {
                        "doc_id": chunk.doc_id,
                        "chunk_index": chunk.chunk_index,
                        "text": chunk.text,
                        "metadata": chunk.metadata.model_dump(),
                    }
                    line = json.dumps(row, ensure_ascii=False)
                    print(line, file=out_file or sys.stdout)

            total += len(classified)
            review_count += sum(1 for c in classified if c.metadata.needs_review)

    finally:
        if out_file:
            out_file.close()

    if use_db:
        print(f"\nDone. {total} chunks classified, {stored} upserted to DB.", file=sys.stderr)
    else:
        suffix = f" → {args.out}" if args.out else " → stdout"
        pct = f", {review_count*100//total if total else 0}% need review" if not args.dry_run else ""
        print(f"\nDone. {total} chunks{pct}{suffix}", file=sys.stderr)


def main() -> None:
    args = _parse_args()
    asyncio.run(_run(args))


if __name__ == "__main__":
    main()
