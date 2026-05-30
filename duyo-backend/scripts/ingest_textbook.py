#!/usr/bin/env python3
"""CLI: ingest a textbook file or directory → JSONL output for review.

Usage:
    python scripts/ingest_textbook.py path/to/file.txt
    python scripts/ingest_textbook.py path/to/dir/ --subject matematika --grade 6
    python scripts/ingest_textbook.py file.txt --out reviewed/output.jsonl --dry-run

Output:
    Newline-delimited JSON, one ClassifiedChunk per line.
    Fields marked needs_review=true should be checked by a human
    before being inserted into pgvector.

Environment:
    GOOGLE_API_KEY must be set (reads from .env via pydantic-settings).
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
from duyo.textbook.schema import DocumentMeta, Language, Script


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Ingest textbook text files into DUYO RAG metadata pipeline."
    )
    parser.add_argument("path", type=Path, help="File (.txt) or directory to ingest")
    parser.add_argument("--out", type=Path, default=None,
                        help="Output JSONL file (default: stdout)")
    parser.add_argument("--subject", default=None,
                        help="Override subject (e.g. matematika, ona-tili)")
    parser.add_argument("--grade", type=int, default=None,
                        help="Override grade (1-12)")
    parser.add_argument("--language", choices=["uz", "ru", "en"], default=None)
    parser.add_argument("--script", choices=["latin", "cyrillic", "mixed"], default=None)
    parser.add_argument("--dry-run", action="store_true",
                        help="Chunk and show rule-only results, skip LLM calls")
    parser.add_argument("--review-only", action="store_true",
                        help="Only output chunks marked needs_review=true")
    return parser.parse_args()


def _collect_files(path: Path) -> list[Path]:
    if path.is_file():
        return [path]
    return sorted(path.rglob("*.txt"))


async def _run(args: argparse.Namespace) -> None:
    files = _collect_files(args.path)
    if not files:
        print(f"No .txt files found in {args.path}", file=sys.stderr)
        sys.exit(1)

    print(f"Found {len(files)} file(s) to ingest.", file=sys.stderr)

    out_file = open(args.out, "w", encoding="utf-8") if args.out else None
    total = 0
    review = 0

    try:
        for f in files:
            # Build doc_meta with optional overrides
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

            if args.dry_run:
                # Rule-only — no LLM calls
                from duyo.textbook.pipeline import chunk_text
                from duyo.textbook.rule_classifier import classify as rule_classify

                text = f.read_text(encoding="utf-8", errors="replace")
                chunks = chunk_text(text)
                for i, chunk in enumerate(chunks):
                    result = rule_classify(chunk)
                    row = {
                        "chunk_index": i,
                        "content_type": result.content_type,
                        "confidence": result.confidence,
                        "has_formula": result.has_formula,
                        "has_table": result.has_table,
                        "text_preview": chunk[:120],
                    }
                    line = json.dumps(row, ensure_ascii=False)
                    if out_file:
                        out_file.write(line + "\n")
                    else:
                        print(line)
                    total += 1
                continue

            classified = await process_file(f, doc_meta=doc_meta)

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
                if out_file:
                    out_file.write(line + "\n")
                else:
                    print(line)
                total += 1
                if chunk.metadata.needs_review:
                    review += 1

    finally:
        if out_file:
            out_file.close()

    print(
        f"\nDone. {total} chunks written"
        + (f", {review} need review ({review*100//total if total else 0}%)" if not args.dry_run else "")
        + (f" → {args.out}" if args.out else " → stdout"),
        file=sys.stderr,
    )


def main() -> None:
    args = _parse_args()
    asyncio.run(_run(args))


if __name__ == "__main__":
    main()
