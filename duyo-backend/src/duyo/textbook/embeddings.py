"""Gemini embedding service for textbook chunks.

Model: gemini-embedding-001 (text-embedding-004 retired).
Native output is 3072-dim; we truncate to 768 via MRL (output_dimensionality)
to match the vector(768) DB column. Truncated MRL vectors must be L2-normalised.

Task types:
  RETRIEVAL_DOCUMENT — for chunks stored in pgvector (ingestion time)
  RETRIEVAL_QUERY    — for search queries (retrieval time)

Batch size: gemini-embedding-001 accepts ONE text per call, so we loop.
"""

from __future__ import annotations

import math
from functools import lru_cache

from google import genai
from google.genai import types

from duyo.core.config import get_settings

EMBEDDING_DIM = 768


def _normalize(vec: list[float]) -> list[float]:
    """L2-normalise a vector. Required for MRL-truncated embeddings."""
    norm = math.sqrt(sum(x * x for x in vec))
    if norm == 0:
        return vec
    return [x / norm for x in vec]


@lru_cache
def _get_client() -> genai.Client:
    settings = get_settings()
    if not settings.google_api_key:
        raise RuntimeError("GOOGLE_API_KEY is not set")
    return genai.Client(api_key=settings.google_api_key)


async def embed_documents(texts: list[str]) -> list[list[float]]:
    """Embed a list of document texts for storage in pgvector.

    Batches requests to stay within Gemini's per-call limit.
    Returns a list of 768-dimensional float vectors, one per input text.
    """
    if not texts:
        return []

    settings = get_settings()
    client = _get_client()
    model = settings.gemini_embedding_model
    dim = settings.gemini_embedding_dim

    all_embeddings: list[list[float]] = []

    # gemini-embedding-001 processes one text per call.
    for text in texts:
        resp = await client.aio.models.embed_content(
            model=model,
            contents=[text],
            config=types.EmbedContentConfig(
                task_type="RETRIEVAL_DOCUMENT",
                output_dimensionality=dim,
            ),
        )
        all_embeddings.append(_normalize(resp.embeddings[0].values))

    return all_embeddings


async def embed_query(query: str) -> list[float]:
    """Embed a single search query for ANN retrieval.

    Uses RETRIEVAL_QUERY task type so the model optimises for similarity
    against RETRIEVAL_DOCUMENT vectors.
    """
    settings = get_settings()
    client = _get_client()

    resp = await client.aio.models.embed_content(
        model=settings.gemini_embedding_model,
        contents=[query],
        config=types.EmbedContentConfig(
            task_type="RETRIEVAL_QUERY",
            output_dimensionality=settings.gemini_embedding_dim,
        ),
    )
    return _normalize(resp.embeddings[0].values)
