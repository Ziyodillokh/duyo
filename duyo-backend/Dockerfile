# syntax=docker/dockerfile:1.7
# DUYO Backend — FastAPI + google-genai
# Multi-stage build for slim runtime image.

FROM python:3.12-slim AS builder

WORKDIR /build

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONDONTWRITEBYTECODE=1

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential libpq-dev && \
    rm -rf /var/lib/apt/lists/*

COPY pyproject.toml README.md ./
COPY src ./src

RUN pip install --upgrade pip && \
    pip wheel --no-deps --wheel-dir /wheels -e . && \
    pip wheel --wheel-dir /wheels \
        fastapi 'uvicorn[standard]' pydantic pydantic-settings \
        sqlalchemy alembic asyncpg pgvector redis httpx \
        'python-jose[cryptography]' google-genai \
        phonenumbers python-multipart structlog greenlet minio


FROM python:3.12-slim AS runtime

ARG APP_USER=duyo
ARG APP_UID=1001

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

RUN groupadd -g $APP_UID $APP_USER && \
    useradd -u $APP_UID -g $APP_USER -m -s /bin/bash $APP_USER && \
    apt-get update && apt-get install -y --no-install-recommends \
        libpq5 curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /wheels /wheels
RUN pip install --no-deps /wheels/*.whl && rm -rf /wheels

COPY pyproject.toml README.md ./
COPY src ./src
COPY migrations ./migrations
COPY alembic.ini ./

RUN pip install --no-deps -e .

USER $APP_USER

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -fsS http://localhost:8000/health || exit 1

CMD ["uvicorn", "duyo.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2", "--proxy-headers", "--forwarded-allow-ips", "*"]
