"""Gemini text-embedding-004 service for textbook chunks.

Task types:
  RETRIEVAL_DOCUMENT — for chunks stored in pgvector (ingestion time)
  RETRIEVAL_QUERY    — for search queries (retrieval time)

Dimensions: 768 (fixed for text-embedding-004).
Batch size: up to 100 texts per API call (Gemini limit).
"""

from __future__ import annotations

from functools import lru_cache

from google import genai
from google.genai import types

from duyo.core.config import get_settings

EMBEDDING_DIM = 768
_BATCH_SIZE = 100  # Gemini embed_content batch limit


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

    all_embeddings: list[list[float]] = []

    for i in range(0, len(texts), _BATCH_SIZE):
        batch = texts[i : i + _BATCH_SIZE]
        resp = await client.aio.models.embed_content(
            model=model,
            contents=batch,
            config=types.EmbedContentConfig(
                task_type="RETRIEVAL_DOCUMENT",
            ),
        )
        for emb in resp.embeddings:
            all_embeddings.append(emb.values)

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
        ),
    )
    return resp.embeddings[0].values
