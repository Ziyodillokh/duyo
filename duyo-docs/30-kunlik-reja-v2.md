---
title: "Birinchi 30 Kunlik Reja — v2 (Bootstrap)"
type: plan
status: active
created: 2026-05-26
updated: 2026-05-26
version: 2
start_date: 2026-05-27
end_date: 2026-06-25
context: "10 ta strategik qarorga asoslangan bootstrap strategy"
related: ["[[decisions.md]]", "[[Setup/04 — Faza 0 Safety Checklist]]"]
note: "v1 (Obsidian) versiyasi decisions'siz edi. Bu v2 — bootstrap strategiyasi va D-001..D-010 javoblari asosida qayta yozilgan."
---

# 30 Kunlik Reja v2 — Bootstrap Strategy

> Strategik qarorlar ([[duyo-docs/decisions.md]]) qabul qilingach, reja sezilarli o'zgardi:
> - **Pedagog $0** → university partnership boshlanishi prioritetdir
> - **Bootstrap** → konsultant + DIY parallel ish
> - **Mahalliy hosting** → POC sinov kerak
> - **Faza 2'da admin panel** → B2B manual pilot Faza 1'ga ko'chiriladi

## Kun-kunlik fokus (qarorlar nuqtai nazaridan)

| Hafta | Eski (v1) | Yangi (v2 bootstrap) |
|-------|-----------|----------------------|
| 1 | Tadqiqot + intervyu | + **University partnership** (D-001), Claude validation (D-010) |
| 2 | Brand + designer | + **Vazirlik konsultant** (D-003), 3rd party safety provider (D-002) |
| 3 | Texnik prototip | + **Mahalliy hosting POC** (D-006), B2B manual pilot strategy (Q-002) |
| 4 | Content + MVP team | + **Product Lead hiring** (D-007), B2B kanal launch |

---

## Hafta 1 (27 may — 2 iyun) — Foundations

**Tema:** Hammasi parallel boshlanishi — eng kritik tasklarda kalit harakatlar.

### Yuqori prioritet
- [ ] **University partnership boshlanishi** (D-001 mitigation)
  - TDPU pediatr psixologiya kafedra deansi bilan suhbat
  - NUUz va Westminster — qo'shimcha nomzodlar
  - **Maqsad:** university advisor (faculty) + 1 master talaba asistent
- [ ] **Claude o'zbek validation** (D-010 trigger)
  - Anthropic API key olish
  - `scripts/validate_claude_uzbek.py` ishga tushirish
  - 15 scenario manual rating (1-5)
  - **Decision point:** agar o'rtacha <4/5 → Yandex GPT kontakt darhol
- [ ] **5-10 ota-ona deep interview**
  - Interview protokoli yozish
  - Telegram orqali kontakt
  - **Maqsad:** real ehtiyojlar va xavfsizlik ehtiyojlari

### O'rta prioritet
- [ ] Raqobat tahlili (Khan Kids, Replika, Character.ai, Bilim.uz)
- [ ] Pro bono pediatr psixiatr bilan kontakt (D-001 mitigation)
- [ ] Vazirlik konsultant nomzodlari ro'yxat (D-003)

### Hafta 1 yakuniy natija
- ✅ TDPU/NUUz advisor kontract draft
- ✅ Claude validation natijalari (decision: stay / switch)
- ✅ 5+ ota-ona interview qaydlari
- ✅ 3 ta vazirlik konsultant nomzod

### Vaqt: ~40 soat (full-time)

---

## Hafta 2 (3 — 9 iyun) — Brand + Partnerships

**Tema:** Brand identity + qo'llab-quvvatlash strukturasi.

### Yuqori prioritet
- [ ] **DUYO logo + brand identity v1** (DIY + junior designer 1 hafta)
  - 3 ta logo variant
  - Color palette (yosh segmentiga ko'ra)
  - Brand voice guide
- [ ] **Vazirlik konsultant kontract** (D-003)
  - Nomzodlardan biri bilan kontract ($1-3K/oy)
  - 1142 partnership birinchi suhbat (founder + konsultant)
- [ ] **3rd party safety provider tanlash** (D-002)
  - Mahalliy: Bekzod's MH, MHL Uzbekistan
  - Xalqaro: Crisis Text Line, 7 Cups
  - 3 ta provider'ga RFI yuborish

### O'rta prioritet
- [ ] Avatar sketch'lari (3 gabarit)
- [ ] University advisor kontract imzolash (D-001)
- [ ] Crisis Detection keyword'lar advisor review boshlanishi
- [ ] Yandex SpeechKit o'zbek TTS sifat sinovi (D-005 validation)

### Hafta 2 yakuniy natija
- ✅ DUYO brand identity v1 (logo, color, voice)
- ✅ Vazirlik konsultant ish boshlangan
- ✅ Safety provider tanlangan
- ✅ University advisor kontract

### Vaqt: ~40 soat

---

## Hafta 3 (10 — 16 iyun) — Mahalliy infra + Onboarding

**Tema:** Texnik fokus — mahalliy hosting POC va onboarding dizayn.

### Yuqori prioritet
- [ ] **Mahalliy hosting POC** (D-006 + Q-001)
  - UCloud va Bestcloud account'lari
  - PostgreSQL + Redis + Docker test deploy
  - **Latency benchmark:** Claude API → mahalliy → mobile
  - **Decision point:** P95 <2s SLA bajarilishi (TZ §13.1)
- [ ] **Onboarding 8 ekran Figma mockup** (qaytadan, designer bilan)
- [ ] **B2B manual pilot strategy** (Q-002 mitigation)
  - 5-10 maktab kontakt (Toshkent xususiy maktablar)
  - Telegram bot prototip (admin panel'siz)
  - Pilot proposal hujjati

### O'rta prioritet
- [ ] **Crisis Detection Layer 2 prototip** (Claude classifier)
- [ ] Bola bilan suhbat scenario'lari (50 ta)
- [ ] Huquqshunos topish (D-001 + D-002 mitigations huquqiy review)

### Hafta 3 yakuniy natija
- ✅ Mahalliy hosting POC natijasi (Plan A: davom / Plan B: hybrid AWS)
- ✅ Onboarding Figma mockup'lari
- ✅ B2B pilot proposal + 3-5 maktab kontakt
- ✅ Crisis Detection Layer 2 demo

### Vaqt: ~50 soat (intensive — texnik + B2B parallel)

---

## Hafta 4 (17 — 23 iyun) — Hiring + Faza 1 prep

**Tema:** Faza 1'ga to'liq tayyorgarlik.

### Yuqori prioritet
- [ ] **Product Lead hiring boshlanishi** (D-007)
  - Job description (mahalliy + remote-friendly)
  - LinkedIn, IT Park, Habr.ru postlar
  - 5-10 nomzod intervyu
- [ ] **B2B pilot launch** (Q-002 mitigation)
  - 1-2 maktab bilan manual contract
  - Telegram bot rasmiy launch
  - **Maqsad:** Faza 1 davomida $1-3K/oy B2B revenue
- [ ] **Backend engineer hiring** (1-2 ta)
  - Python/FastAPI tajriba kerak
  - Mahalliy DevOps tajriba afzal (D-006 sababli)

### O'rta prioritet
- [ ] 1146 (bola himoyasi) bilan rasmiy kontakt
- [ ] Insurance polis tanlash (minimal coverage)
- [ ] Content production planning
  - Public domain o'zbek she'rlar ro'yxati
  - 5-10 yozuvchi kontaktga chiqish (DUYO original)
- [ ] Faza 1 sprint plan v1 (TZ §18.2 asosida + decisions)

### Hafta 4 yakuniy natija
- ✅ Product Lead nomzod ro'yxat
- ✅ Backend engineer nomzod ro'yxat
- ✅ B2B pilot launch (1-2 maktab)
- ✅ Insurance polis
- ✅ Faza 1 sprint plan tayyor

### Vaqt: ~45 soat

---

## 30 kun oxirida — yutuqlar va Faza 1 boshlanishi

### Tugatilgan
- [x] University partnership + advisor (D-001 mitigation)
- [x] Vazirlik konsultant kontract (D-003)
- [x] 3rd party safety provider tanlangan (D-002)
- [x] Brand identity v1 (logo, color, voice)
- [x] Onboarding Figma mockup'lari
- [x] Mahalliy hosting POC natijasi
- [x] Crisis Detection Layer 1 + Layer 2 prototip
- [x] B2B pilot launch (1-2 maktab — early revenue!)
- [x] Insurance polis
- [x] Faza 1 sprint plan tayyor

### Devom etadigan
- [ ] Content production (parallel Faza 1 davomida)
- [ ] Crisis dataset yig'ish (6-12 oy)
- [ ] Vazirlik MOU rasmiylashtirish

### Faza 1 boshlanishi
**24 iyun 2026** — MVP development official boshlanish.

---

## Bootstrap risk register

Yangi qarorlardan kelib chiqqan risklar:

| Risk | Mitigation | Vaqt |
|------|------------|------|
| University partnership ishlamasligi | Fallback: $15K/yil part-time consultant ($1.5K/oy) | Hafta 2 |
| Mahalliy hosting AI latency past | Hybrid: PII mahalliy, AI orchestration global | Hafta 3 POC |
| B2B pilot maktablari topilmaslik | Korporativ kanal (banklar, telekom) parallel | Hafta 4 |
| Product Lead hire sekin | Outsource (Toptal, Upwork) yoki part-time | Hafta 4 |
| 3rd party safety provider qimmat | 1142 direct integration (vazirlik orqali) | Hafta 2-3 |

## Vaqt taqsimoti (haftalik)

Bootstrap yakka founder:
- Insoniy (hiring, partnerships, B2B): 20 soat/hafta
- Tadqiqot va interview: 8 soat/hafta
- Brand/dizayn (designer bilan): 5 soat/hafta
- Texnik (prototyping, POC): 12 soat/hafta

**Total:** ~45 soat/hafta (full-time intensive)

## Budget tracking (Faza 0 — 3 oy total)

| Item | Budget | 30-kunlik consumption |
|------|--------|----------------------|
| Pedagog (university stipend) | $200 × 3 = $600 | $200 |
| Vazirlik konsultant | $2K × 3 = $6K | $2K |
| Junior designer | $1K (1-mo contract) | $1K |
| Safety provider | $200/oy × 3 = $600 | $200 |
| Hosting POC + production | $200/oy × 3 = $600 | $200 |
| Insurance (yillik) | $5K (yearly) | $0 (Hafta 4'da) |
| Huquqshunos | $3K (one-time setup) | $1K (Hafta 3) |
| Content writers (10 ta original) | $5K (Faza 1 davomida) | $0 |
| Pediatr psixiatr (pro bono) | $0 | $0 |
| **TOTAL Faza 0** | **~$20K** | **~$4.4K (30 kun)** |

Bu TZ original $30-50K dan ancha tejamkor (~$10-30K tejash).

## Acceptance criteria — Faza 0 → Faza 1 transition

- [ ] Crisis Detection keyword'lar pediatr review (advisor + asistent + pro bono pediatr psixiatr)
- [ ] Claude o'zbek validation 4/5+ yoki Yandex hybrid plan
- [ ] Mahalliy hosting P95 latency <2s yoki hybrid arxitektura
- [ ] Vazirlik konsultant orqali 1142 birinchi rasmiy aloqa
- [ ] Onboarding Figma mockup approved (designer + UX review)
- [ ] B2B pilot 1+ maktab rasmiy kontract
- [ ] Product Lead candidate(s) — final round
- [ ] Insurance polis active
- [ ] 3rd party safety provider kontract

Faqat bundan keyin Faza 1 (MVP development) boshlanadi.

## Bog'langan hujjatlar

- [[duyo-docs/decisions.md]] (filesystem) — 10 ta strategik qaror
- Obsidian: [[Setup/04 — Faza 0 Safety Checklist]] (sync kutilmoqda)
- Obsidian: [[Setup/06 — 30 Kunlik Reja]] v1 (eski versiya, almashtiriladi)

## Change log

| Sana | O'zgarish |
|------|-----------|
| 2026-05-26 | v1 yaratildi (decisions'siz, generic) |
| 2026-05-26 | v2 — bootstrap strategy va 10 ta qarorga asoslangan |
