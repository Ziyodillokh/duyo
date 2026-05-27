# DUYO Backend

FastAPI + PostgreSQL + Redis backend for DUYO AI Companion.

## Servislar (planned)

| Service | Status | Tavsif |
|---------|--------|--------|
| `core/` | skeleton | Auth, users, profiles |
| `chat/` | skeleton | WebSocket suhbat, AI orchestration |
| `crisis/` | **prototype** | Crisis Detection — Layer 1 keyword matcher tayyor |
| `content/` | skeleton | She'r, ertak, dars yordami catalog |
| `gamification/` | skeleton | Ball, level, streak, inventory |

## Quick start

```bash
# Dependencies (uv tavsiya etiladi)
uv sync --all-extras

# Local services
docker-compose up -d

# Migrations (kelajak)
uv run alembic upgrade head

# Run server
uv run uvicorn duyo.main:app --reload --port 8000

# Tests
uv run pytest

# Linting
uv run ruff check src tests
uv run mypy src
```

## Endi tayyor

`/health` endpoint — service alive check
`/api/v1/crisis/check` endpoint — Layer 1 keyword matcher

## Crisis Detection Layer 1 (prototype)

3 tilda (uz, ru, en) keyword detector. Bu Faza 0'ning eng kritik
texnik artefakti. To'liq ML classifier (Layer 3) kelajakda
pediatr psixologlar tomonidan labeled dataset bilan trening qilinadi.

Sinash:

```bash
uv run pytest tests/test_crisis_detector.py -v
```

## Hujjatlar

- [TZ §6 Backend spec](../duyo-docs/) — service responsibility matrix
- [TZ §10 Database schema](../duyo-docs/) — PostgreSQL DDL
- [TZ §11 API spec](../duyo-docs/) — endpoint ro'yxati
