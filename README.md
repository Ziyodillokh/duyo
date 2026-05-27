# DUYO — AI Companion for Children

7-16 yoshli bolalar uchun AI virtual do'st (suhbatdosh + o'qituvchi + tamagochi).
O'zbek · Rus · Ingliz. Crisis Detection bilan.

> Status: **Pre-development (Faza 0 — Safety Foundation)**
> Versiya: TZ v1.0 / Concept v2.1

## Monorepo strukturasi

| Papka | Tavsif |
|-------|--------|
| [duyo-backend/](./duyo-backend) | Python FastAPI backend + Crisis Detection service |
| [duyo-mobile/](./duyo-mobile) | React Native mobile app (iOS + Android) |
| [duyo-docs/](./duyo-docs) | TZ, Concept, ADR'lar, API spec'lari |
| [duyo-content/](./duyo-content) | She'r, ertak, dars yordami kutubxonasi |

## Roadmap (yuqori daraja)

- **Faza 0 (0-3 oy)** — Safety Foundation, pedagogik kengash, huquqiy ramka
- **Faza 1 — MVP (3-9 oy)** — 11-13 yosh, o'zbek tili, 500 beta foydalanuvchi
- **Faza 2 (9-15 oy)** — 3 yosh segmenti, 3 til, B2B pilot
- **Faza 3 — Scale (15-21 oy)** — 25,000+ user, fizik mahsulot

## Hozir nimaga e'tibor qaratiladi

1. **Crisis Detection Layer 1** — keyword matcher prototip (3 tilda). Ko'ring: [duyo-backend/src/duyo/crisis/](./duyo-backend/src/duyo/crisis/)
2. **Claude o'zbek tilida validation** — `scripts/validate_claude_uzbek.py`
3. **Pedagog/huquqshunos hiring** — Faza 0 kritik task

## Quick start

```bash
# Backend
cd duyo-backend
docker-compose up -d        # postgres + redis
uv sync                     # install dependencies
uv run uvicorn duyo.main:app --reload

# Tests
uv run pytest
```

## Hujjatlar

Asosiy spec'lar:
- [DUYO_Concept_v2.1.docx](./DUYO_Concept_v2.1.docx) — mahsulot konseptsiyasi
- [DUYO_TZ_v1.0.docx](./DUYO_TZ_v1.0.docx) — texnik topshiriq

## Litsenziya

Proprietary. © XRR · 2026

