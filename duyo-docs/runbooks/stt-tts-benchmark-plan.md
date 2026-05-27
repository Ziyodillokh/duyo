---
title: "STT/TTS Provider Benchmark Plan"
type: runbook
status: draft
created: 2026-05-27
related: ["[[decisions.md]] D-005", "[[project-duyo-tech-strategy]]"]
note: "Faza 0 Bosqich B yoki Bosqich C boshlanishidan oldin bajariladi. Hozircha Bosqich A — text only."
---

# STT/TTS Provider Benchmark

## Maqsad

DUYO uchun eng yaxshi o'zbek tilda STT (speech-to-text) va TTS (text-to-speech) provayder tanlash. Sifat, narx, latency, va compliance (D-006 mahalliy PII) balansi.

**Decision impact:** D-005 (Yandex TTS MVP, custom voice Faza 2) — agar boshqa provider sifati ancha yaxshi bo'lsa, qaytarib ko'rib chiqamiz.

## Provayderlar ro'yxati

### Mahalliy (D-006 compliance ✅)

| Provider | STT | TTS | Source |
|----------|-----|-----|--------|
| **Muxlisa.uz** | ✅ | ✅ | UZINFOCOM (davlat). Lotin+kirill. Uz-Ru mixed support. Contact center fokusda. |
| **UzbekVoiceAI** | ❓ | ❓ | uzbekvoice.ai — ehtimol Mozilla Common Voice asosida. Open source ehtimoli. |
| **Lynx AI** | ✅ | ❓ | lynx-ai.uz — call/voice notes uchun STT. |
| **Yandex SpeechKit** | ✅ | ✅ | Mahalliy emas (RU), lekin uz tilini qo'llab quvvatlaydi. D-006 — Yandex Cloud RU emas, UZ region mavjud bo'lsa OK. |

### Global (D-006 compliance — qo'shimcha audit kerak)

| Provider | STT | TTS | Source |
|----------|-----|-----|--------|
| **Google Cloud Speech** | ✅ | ✅ | uz tilini qo'llab quvvatlaydi. Ovoz hech qaerda saqlanmaydi (no-storage option). |
| **Azure AI Speech** | ✅ | ✅ | uz neural voices bor. EU region. |
| **ElevenLabs** | ✅ | ✅ | Voice clone (Faza 2 uchun rejada). Free tier mavjud. |
| **CAMB.AI** | — | ✅ | Free AI voice generator, uz qo'llab quvvatlaydi. |
| **SpeechGen.io** | — | ✅ | Web-based uz TTS. |
| **OpenAI Whisper** | ✅ | — | Self-hosted variant. uz support. |

## Test methodology

### Test corpus (10 ovoz/matn juftligi)

Har yosh segmenti uchun 3-4 namuna:

**Junior (7-10):**
- "Salom DUYO!"
- "Bugun maktabda 5 oldim!"
- "Ertak aytib ber."
- "Tinch oyim bilan urishdim."

**Explorer (11-13):**
- "Matematikadan kontrolnaya bor, qo'rqyapman."
- "Do'stim meni ranjitdi."
- "Pythagor teoremasini tushuntir."

**Companion (14-16):**
- "DTM'ga matematika qanday tayyorlanish kerak?"
- "Kasb tanlashda qanday yondashish kerak?"
- "Ota-onam meni tushunmaydi."

### STT test (ovoz → matn)

1. 10 ta namuna ovozini yozib olish (real bolalar ovozi yoki sintetik testset)
2. Har provider'ga upload + transkripsiya
3. WER (Word Error Rate) hisoblash — ground truth bilan farq
4. Dialekt accuracy — Toshkent, Andijon, Farg'ona variantlari (agar bolalar turli mintaqalardan)
5. Real-time latency: streaming STT support va p95 chunk delay

### TTS test (matn → ovoz)

1. 10 ta namuna matnini har provider'da audio generatsiya
2. Sifat baholash kriteriylari:
   - **Naturalness** (1-5): tabiiy o'zbek talaffuzi
   - **Prosody** (1-5): emotsiya, urg'u, sur'at
   - **Age-appropriate** (1-5): bolalarga mos ohang (Junior — yumshoq, Companion — neytral)
   - **Pronunciation accuracy** (1-5): xorijiy so'zlar, sonlar, akronimlar
3. 3-5 ta o'zbek tilini ona tili sifatida bilgan kishidan blind test (provider nomini bilmasdan)
4. Latency: tugmasi bosilgandan birinchi audio chunk'gacha p95

### Cost benchmark

Har provider'ning narxini hisoblash:
- **STT:** $/daqiqa ovoz
- **TTS:** $/character yoki $/min audio
- DUYO modeling: 1 bola/oy ~30 daqiqa audio in + 60 daqiqa out (chat tutuvi)
- 5K beta user × 30 kun → oylik xarajat baholash

## Kelajakdagi qadamlar

1. Har provider account ochish (free tier yoki minimal balance)
2. API key olish va `.env` ga qo'shish (alohida key'lar har provider uchun)
3. Test script — `duyo-backend/scripts/validate_stt_tts.py` (validate_claude_uzbek.py shabloni asosida)
4. Audio test corpus yig'ish:
   - Ona tili speaker'larga $50 fee 10-15 daqiqa yozish
   - Yoki tayyor o'zbek bolalar speech corpus topish (Mozilla Common Voice — Uzbek subset)
5. Blind quality review — 3-5 native speaker (xolisroq baho)
6. Decision matrix: sifat × narx × compliance × latency

## Faza bog'lanishi

| Bosqich | Voice layer holati |
|---------|-------------------|
| Faza 0 Bosqich A (hozir) | TEXT only — voice kerak emas |
| Faza 0 Bosqich B | TTS prototip — 1 ta provider tanlash kifoya (POC) |
| Faza 0 Bosqich C / Faza 1 | STT + TTS — full integration, A/B test |
| Faza 2 | Voice clone (ElevenLabs) custom DUYO ovoz |

**Hozircha:** benchmark Bosqich B oldidan o'tkaziladi (Hafta 4-6 atrofida). Hozir reja sifatida saqlanadi.

## Acceptance criteria

Provider qabul qilinishi uchun:
- STT WER <15% Junior accent uchun, <10% Explorer/Companion
- TTS naturalness >=4/5 blind test
- Latency p95 <500ms (STT first chunk), <1s (TTS first audio)
- Cost <$0.10/bola/oy (oylik 90 daqiqa audio uchun)
- D-006 compliance: PII mahalliy regiyonda yoki encrypted-in-transit
