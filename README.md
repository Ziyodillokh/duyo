# DUYO — bolalar uchun AI hamroh

7–16 yoshli bolalar uchun AI suhbatdosh: gaplashadi, uy vazifasiga yordam
beradi, maqsad qo'yishga o'rgatadi. O'zbek · Rus · Ingliz. Inqiroz aniqlash
(crisis detection) bilan.

**Holat:** ishlab turibdi. Backend `api.duyo.uz` da, sayt `duyo.uz` da,
mobil ilova Play Store'ga tayyorlanmoqda.

## Monorepo

| Papka | Nima | Holati |
|-------|------|--------|
| [duyo-mobile/](./duyo-mobile) | Expo SDK 56 / React Native ilova | asosiy mahsulot |
| [duyo-backend/](./duyo-backend) | FastAPI + Postgres + Gemini | `api.duyo.uz` |
| [duyo-admin/](./duyo-admin) | Vite + React xodimlar paneli | `admin.duyo.uz` |
| [duyo-landing/](./duyo-landing) | Marketing sayti | `duyo.uz` |
| [duyo-docs/](./duyo-docs) | Runbook'lar, qarorlar, audit | — |

## Ishga tushirish

**Mobil** — telefon va kompyuter bitta WiFi'da bo'lsin:

```bash
cd duyo-mobile
npm install
npx expo start --host lan
```

`.env` ichida `EXPO_PUBLIC_API_BASE_URL` backend manzilini ko'rsatadi.

**Backend:**

```bash
cd duyo-backend
docker compose up -d          # postgres + redis + minio
alembic upgrade head
uvicorn duyo.main:app --reload
```

## Tekshiruv darvozalari

CI shu to'rttasini ishlatadi — push qilishdan oldin lokalda ham ishlating:

```bash
cd duyo-mobile  && npx tsc --noEmit -p tsconfig.json
cd duyo-mobile  && npx expo lint
cd duyo-backend && ./.venv-test/Scripts/python.exe -m pytest tests -q
cd duyo-backend && ./.venv-test/Scripts/python.exe -m ruff check src tests
```

Backend testlari **`.venv-test`** da ishlaydi, `.venv` da emas — ikkinchisida
ilovaning bog'liqliklari yo'q.

## Deploy

`main` ga push avtomatik deploy qiladi, papkaga qarab:

| O'zgargan papka | Nima bo'ladi |
|---|---|
| `duyo-backend/**` | pytest → migratsiya → konteyner qayta yaratiladi (~3 daqiqa) |
| `duyo-landing/**` | `duyo.uz` yangilanadi |
| `duyo-admin/**` | `admin.duyo.uz` yangilanadi |

Backend deploy tugaganini tekshirish: `curl https://api.duyo.uz/openapi.json`

## Ilova nimalardan iborat

**Bola ko'radigan qismlar:** AI suhbat (matn va ovoz), Neo Miyya (bilim
grafi), Bir maqsad (maqsadlar va maqsaddoshlar), Kutubxona, Dars yordami,
Faollik statistikasi, Yutuqlar, Sozlamalar.

**Ota-ona bo'limi yo'q** — 2026-08-29 da olib tashlandi. Batafsil va qaytarish
yo'riqnomasi: [CLEANUP.md](./CLEANUP.md).

## Xavfsizlik

Inqiroz aniqlash uch qatlamli: kalit so'zlar (`crisis/detector.py`), semantik
(`crisis/semantic.py`), va model bahosi. Qizil daraja SMS bilan akkaunt
egasiga xabar yuboradi (`_dispatch_parent_alert`). Bu kodga tegishdan oldin
`duyo-docs/` dagi qarorlarni o'qing.
