#!/usr/bin/env python3
"""CLI: seed the psychology knowledge base (psychology_chunks) from taxonomy.py.

Unlike ingest_textbook.py, there is no parsing/classification step — the
content is already hand-authored structured data in `psychology/taxonomy.py`.
This script just upserts it and (optionally) embeds it.

Usage:
    # Store rows only (no embedding)
    python scripts/seed_psychology.py

    # Store + generate embeddings (full pipeline)
    python scripts/seed_psychology.py --embed

Environment:
    DATABASE_URL must be set. GOOGLE_API_KEY must be set for --embed.
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from duyo.core.database import get_session_factory
from duyo.psychology import store as chunk_store
from duyo.psychology.taxonomy import TAXONOMY


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Seed the DUYO psychology knowledge base.")
    parser.add_argument("--embed", action="store_true", help="Also generate embeddings after upsert")
    parser.add_argument("--language", default="uz", choices=["uz", "ru", "en"])
    return parser.parse_args()


async def _run(embed: bool, language: str) -> None:
    session_factory = get_session_factory()
    async with session_factory() as session:
        written = await chunk_store.upsert_topics(session, language=language)
        await session.commit()
        print(f"Upserted {written} psychology topic(s) ({len(TAXONOMY)} in taxonomy.py).")

        if embed:
            embedded = await chunk_store.embed_pending(session)
            await session.commit()
            print(f"Embedded {embedded} pending chunk(s).")


def main() -> None:
    args = _parse_args()
    asyncio.run(_run(embed=args.embed, language=args.language))


if __name__ == "__main__":
    main()
