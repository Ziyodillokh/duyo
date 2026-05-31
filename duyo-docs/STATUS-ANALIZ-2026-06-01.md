# DUYO — Holat tahlili va qolgan ishlar

**Sana:** 2026-06-01
**Asos:** Concept v2.1 + TZ v1.0 ↔ haqiqiy kodbaza (tekshirilgan)
**Maqsad:** Nima tayyor, nima qolgan — ustuvorlik bilan yo'l xaritasi.

> Bu hujjat [AUDIT-2026-06-01.md](AUDIT-2026-06-01.md) ning yangilangan, qaror-yo'naltirilgan davomi. Audit "nima yo'q"ni aniqladi; bu hujjat "endi nima qilamiz"ni belgilaydi.

---

## 1. Umumiy ko'rsatkich

| O'lcham | Holat |
|---------|-------|
| Backend endpoint modullari | 8 (auth, chat, gamification, tamagochi, subscription, textbook, voice, health) |
| DB jadvallari | 12 |
| Migrationlar | 5 (0001–0005), CI'da avtomatik qo'llanadi |
| Testlar | 292 pass |
| Production | duyo.uz / api.duyo.uz, CI yashil, auto-deploy ishlaydi |
| RAG bazasi | 6-sinf, 926 chunk, 8/8 fan on-topic |

**Bir jumlada:** backend yadrosi (bola tajribasi) ancha to'liq; **yetishmaydigani — ota-onaga qiymat (hisobot), real xavfsizlik (SMS), real to'lov, va mobil-backend ulanishi.**

---

## 2. ✅ TAYYOR (production'da ishlaydi)

| Modul | Tafsilot | Manba |
|-------|----------|-------|
| **Auth** | OTP (telefon+SMS kod), JWT access/refresh | TZ §5.1 |
| **Bola chati** | Gemini Flash, 3 yosh segmenti, multi-turn, RAG citation, web-search fallback | §6 |
| **Crisis Detection** | Layer 1 (keyword, 3 til) + Layer 2 (Gemini classifier), no-downgrade | §10 |
| **RAG darslik** | 6-sinf 926 chunk, pgvector, OCR pipeline (Docling/Tesseract/MinerU) | — |
| **Children CRUD** | list/get/update/delete + ownership + data-erasure | §5, FR-8 |
| **Gamification** | ball/level/streak/inventory, 9 endpoint | §8 |
| **Avatar** | saqlash + tahrir (get-or-create, hex) | §3 |
| **Tamagochi** | 4 metrika, lazy decay, interact — "DUYO o'lmaydi" | §4 |

---

## 3. ⚠️ QISMAN (kod bor, lekin to'liq emas yoki mock)

| Modul | Hozir | Yetishmaydi | Xavf |
|-------|-------|-------------|------|
| **Crisis SMS** | `_dispatch_parent_alert` kodi bor | `sms.py` **STUB** — Eskiz creds yo'q, SMS faqat log'ga yoziladi | 🔴 KRITIK — xavf signalida ota-ona xabar olmaydi |
| **Subscription** | tier + plans/current/subscribe/cancel | To'lov **MOCK** (Click/Payme 501); limit enforcement (tier → AI turn cheklovi) ulanmagan | 🟠 Daromad yo'q + limitlar ishlamaydi |
| **Voice** | WS karkas + Gemini Live STT | TTS yo'q (OmniVoice GPU kutilmoqda); MVP'da ovoz javob yo'q | 🟡 NFR-1.2 (<5s ovoz) bajarilmaydi |

---

## 4. ❌ QILINMAGAN (TZ/Concept talab qiladi)

Ustuvorlik bo'yicha tartiblangan:

### 4A. Mahsulot qiymati — eng muhim biznes bo'shliq
| # | Ish | Concept | Nega muhim |
|---|-----|---------|-----------|
| 1 | **Parent Analysis / 10-kunlik hisobot** | §11 | DUYO'ning ASL qiymat taklifi — "farzandingizni tushuning". Suhbat→agregat (kayfiyat/faollik/mavzu)→Gemini tahlil→PIN-himoyalangan web dashboard. Matn ko'rsatilmaydi (privacy contract §11.3) |
| 2 | **Guidance / tarbiya maslahatlari** | §5 | Ota-onaga RAG asosli maslahat. Darslik RAG infra tayyor, lekin maslahat kontenti/manbasi yo'q |

### 4B. Daromad va integratsiya
| # | Ish | Concept | Izoh |
|---|-----|---------|------|
| 3 | **Click/Payme real integratsiya** | §12.2 | Mock o'rniga real to'lov + webhook. Subscription jadval tayyor |
| 4 | **Tier limit enforcement** | §12.1 | free=20 msg/kun, standart=30 AI turn — chat.py'da tekshirilmaydi hozir |
| 5 | **Mobil ↔ backend ulanishi** | TZ §7 | Mobil faqat `chat.ts` real; gamification/tamagochi/subscription/avatar ekranlari hali **mock** ishlatadi. Backend tayyor — ulash kerak |

### 4C. Xavfsizlik va content
| # | Ish | Concept | Izoh |
|---|-----|---------|------|
| 6 | **Eskiz SMS real** | §10.5, FR-7.2 | Crisis + OTP uchun. Eng kritik (3A bilan birga) |
| 7 | **1146 / 3rd-party safety** | §10.6 | Zo'ravonlik manbai ota-ona bo'lganda. Abusiv-ota-onaga-yubormaslik logikasi BOR, yo'naltirish to'liq emas |
| 8 | **Content kutubxonasi** | §9 | She'r/ertak (150 uz, audio). `content_library` jadval yo'q. Faqat darslik RAG bor |
| 9 | **Scripted responses (Qatlam 1)** | §6.1 | "80% interaksiya scripted, arzon". Hozir HAR xabar Gemini'ga → 100K user'da qimmat |
| 10 | **Push bildirishnoma** | FR-7.1 | Umuman yo'q |

### 4D. Infratuzilma
| # | Ish | Izoh |
|---|-----|------|
| 11 | **Monitoring** | Netdata/Telegram alert (server health + RED crisis) — rejada, yo'q |
| 12 | **Voice GPU server** | OmniVoice real-time uchun (park qilingan) |
| 13 | **Fine-tuned model** | 12-18 oy, margins uchun (hozir kerak emas) |

---

## 5. Tavsiya etilgan yo'l xaritasi

### Sprint 1 — Xavfsizlik va'dasini ishlatish (1-2 hafta)
**Maqsad:** mahsulot va'dasi yolg'on bo'lmasin.
1. **Eskiz SMS real integratsiya** (#6) — creds + 1142/1146 shablon approve. Crisis SMS'ni jonlantiradi (3A).
2. **Tier limit enforcement** (#4) — chat.py'da kunlik limit (yengil, daromad uchun zarur).

### Sprint 2 — Mahsulot qiymati (2-3 hafta)
**Maqsad:** "bola chatboti"dan "ota-onaga oyna"ga o'tish.
3. **Parent Analysis / 10-kunlik hisobot** (#1) — reports jadval + agregat + Gemini tahlil + web dashboard.
4. **Mobil ↔ backend ulanishi** (#5) — gamification/tamagochi/avatar/subscription ekranlarini real API'ga ulash (backend tayyor).

### Sprint 3 — Daromad (1-2 hafta)
5. **Click real integratsiya** (#3) — 70% bozor. Payme keyin.

### Keyin
6. Guidance maslahat (#2), Content kutubxonasi (#8), Scripted responses (#9), Push (#10), Monitoring (#11), Voice GPU (#12).

---

## 6. Eng kritik 3 ta (agar faqat shu hafta ish bo'lsa)

1. 🔴 **Eskiz SMS** — bolaning hayoti haqidagi va'da. Stub bo'lsa, butun mahsulot falsafasi yolg'on.
2. 🟠 **Parent hisobot (Analysis)** — bunsiz DUYO raqobatchilardan (ChatGPT/Khan) farq qilmaydi.
3. 🟠 **Mobil-backend ulash** — backend qurildi, lekin foydalanuvchi ko'rmaydi. Ulamasak, qilingan ish "o'lik" turadi.

---

## 7. Texnik qarz / kuzatuvlar

- `aiohttp` `pyproject.toml`da yo'q (google-genai orqali tranzitiv keladi) — kelajakda sinishi mumkin, qo'shish tavsiya.
- Eski modullarda (crisis/keywords, detector) ruff xatolari bor (yangi kodda emas) — alohida tozalash mumkin.
- `users` ↔ `subscriptions` ORM relationship qo'shilmagan (FK bor, navigatsiya yo'q) — kerak bo'lsa qo'shiladi.
- Voice STT Gemini Live ichida; mustaqil STT service yo'q (Concept Yandex SpeechKit deydi — qayta ko'rib chiqilsin).
