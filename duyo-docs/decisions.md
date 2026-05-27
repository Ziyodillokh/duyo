---
title: "DUYO — Strategik Qarorlar Logi"
type: decisions
status: all-decided
created: 2026-05-26
updated: 2026-05-26
note: "Bu hujjat Obsidian'dagi DUYO/Setup/08 — Decisions Log.md bilan sinxronlashtirilishi kerak (Obsidian offline edi qaror qabul qilingan vaqtda)."
---

# DUYO — Strategik Qarorlar Logi

> Concept §16 oxirida qoldirilgan 10 ta strategik savol. Hammasi 2026-05-26 da javob qabul qildi.

## Qarorlar matritsasi (xulosa)

| ID | Qaror | Tanlangan variant |
|----|-------|-------------------|
| D-001 | Pedagog byudjeti | $0 — universitet partnership ⚠️ |
| D-002 | 24/7 safety monitoring | Outsource (3rd party) ⚠️ |
| D-003 | Vazirlik partnership owner | Konsultant bilan delegation |
| D-004 | Litsenziya timeline | Faza 1 o'rtasidan (Sprint 6+) |
| D-005 | TTS provider | Gemini 2.5 Flash Preview TTS (REVISED 2026-05-27) — Yandex emas |
| D-006 | Backend hosting | Mahalliy (UCloud / Bestcloud) ⚠️ |
| D-007 | Co-founder strategy | Yakka founder + Product Lead |
| D-008 | Funding strategy | Bootstrap |
| D-009 | Maktab admin panel | Faza 2'da to'liq panel ⚠️ |
| D-010 | LLM provider | Gemini 2.5 Flash primary + Pro fallback (REVISED 2026-05-27) |

## Asosiy pattern

**Bootstrap + cost-conscious + ship-then-polish.**

Siz xavf-xatarlarni anglaysiz lekin budget cheklangan. Hammasini DIY qilasiz, kompromiss qilingan sohalarda (D-001, D-002) konsultantlar bilan mitigation talab qilinadi.

---

## D-001: Pedagog byudjeti 🟢 ⚠️

**Qaror:** $0 — universitet partnership (talaba asistent).

### Mandatory mitigation (aks holda safety past)

1. **Rasmiy university advisor** — TDPU / NUUz faculty member, kichik stipend ($100-200/oy yoki publication credit)
2. **Master-level talaba asistent** — pediatr psixologiya ixtisosligi, advisor nazoratida
3. **Pro bono pediatr psixiatr** — quarterly review (3 oyda 1 marta)
4. **Crisis keyword review** — advisor + asistent + pediatr psixiatr uchovi ko'rishi shart
5. **Vazirlik partnership** rasmiylashtirilsa, 1142 o'z pediatr psixologini sertifikatsiya qiladi

### Faza 0 oxirida qayta ko'rib chiqish
Agar university partnership ishlamasa → $15K/yil part-time consultant'ga o'tish.

---

## D-002: 24/7 Safety Monitoring 🟢 ⚠️

**Qaror:** Outsource (3rd party 24/7 service).

### Mandatory hozirlanish

1. **3rd party provider tanlash:**
   - Mahalliy: Bekzod's Mental Health, MHL Uzbekistan
   - Xalqaro: Crisis Text Line (US), 7 Cups
   - Direct: 1142 (Vazirlik) integration imkoniyati
2. **Workflow definition:** RED event → API call → 3rd party operator → response time SLA
3. **Privacy contract:** bola ma'lumotlari anonymize'd + encrypted
4. **DUYO-specific training:** har operator yoshga moslashish, til, Crisis Detection 4-qatlamli tizimni tushunadi
5. **Cost model:** per-event $5-15 × ~5-10 event/oy MVP'da = **$25-150/oy**

### Faza 2'da review
5,000+ user'da volume oshganda, own team hire arzonroq bo'lishi mumkin. ROI hisoblanadi.

---

## D-003: Vazirlik partnership 🟢

**Qaror:** Konsultant (eski vazirlik xodimi) bilan delegation.

### Implikatsiya
- Cost: $1-3K/oy konsultant kontract
- Tezroq door ochilishi (network'i bor)
- Siz strategic level'da qatnashasiz, konsultant operatsion

### Hozirlanish
- [ ] 3 ta nomzod ro'yxat (eski vazirlik / sog'liqni saqlash sektoridan)
- [ ] Founder + konsultant birga birinchi suhbat
- [ ] MOU draft tayyorlash (huquqshunos bilan)

---

## D-004: Litsenziya timeline 🟢

**Qaror:** Faza 1 o'rtasidan (Sprint 6+).

### Implikatsiya
- Beta launch (500 user) **faqat public domain + DUYO original content** bilan
- Faza 1 davomida licensing negotiating
- Faza 2 boshida licensed content qo'shiladi

### Faza 1 content strategy
- 50 ta o'zbek she'r — public domain (xalq, anonim)
- 20 ta ertak — folklore (anonim)
- 10-20 ta original DUYO content (yozuvchilar bilan kontract)
- **Erkin Vohidov, Abdulla Oripov, Quddus Muhammadiy** — Faza 2'da

---

## D-005: TTS provider 🟢 (REVISED 2026-05-27)

**Yangi qaror:** Gemini 2.5 Flash Preview TTS (`gemini-2.5-flash-preview-tts`).

### Trigger natija
- 2026-05-27 quick POC: 3 ta yosh segmentida audio sample (Leda/Kore/Charon voice)
- User baho: 4/5 — yaxshi, production'ga mos
- Latency: gen 0.5-0.7x audio length (chat app uchun maqbul)

### Yangi voice strategy
- **Junior (7-10):** Leda voice (youthful)
- **Explorer (11-13):** Kore voice (firm/balanced)
- **Companion (14-16):** Charon voice (informative)
- **30+ alternative voices** mavjud — fine-tuning kelajakda
- Custom voice clone (ElevenLabs) Faza 2'da brand differentiation uchun saqlanadi

### Implikatsiya
- ✅ **Bitta vendor stack** — Gemini LLM + TTS (D-010 bilan birga). Bitta API key, bitta billing
- ✅ Yandex SpeechKit budget olib tashlanadi (Faza 0 budget — qo'shimcha $0)
- ✅ ElevenLabs Faza 2'ga qoldiriladi (custom DUYO ovoz)
- ⚠️ Preview model — GA emas, SLA va narx o'zgarishi mumkin (Yandex backup sifatida e'tiborda)
- ⚠️ D-006 risk — audio chet elga (LLM bilan bir xil ta'sir)

### Eski qaror (history)
~~MVP'da Yandex TTS default, custom voice Faza 2'da~~ — 2026-05-27 da qayta ko'rib chiqildi, Gemini TTS sifati yaxshi.

### Faza 0 + 1 hozirlanish
- [x] Gemini TTS POC 3 segment'da tugatildi
- [ ] STT (ovoz → matn) circular test — Gemini bilan
- [ ] System bilan integratsiya (backend skeleton'da)
- [ ] 10-20 namuna ona tili speaker'lar bilan blind test (Faza 1 boshida)

---

## D-006: Backend hosting 🟢 ⚠️

**Qaror:** Mahalliy — UCloud yoki Bestcloud.

### Implikatsiya (muhim)

**Foydalari:**
- ✅ Data sovereignty avtomatik (Uzbekistan PII qonun bilan compliance)
- ✅ Eng past latency O'zbekiston'dan (10-30ms vs Mumbai 80-120ms)
- ✅ Mahalliy support va lokal valyutada to'lov

**Risk va challenge'lar:**
- ⚠️ AWS/GCP managed service'lari yo'q (RDS, ElastiCache, EKS) — hammasini manual o'rnatish kerak
- ⚠️ AI API call latency Claude/OpenAI ga balki yuqori (Tashkent → Anthropic US)
- ⚠️ Mahalliy DevOps tajriba kam — hire qiyin
- ⚠️ Kubernetes managed yo'q (yoki bor lekin past sifat)

### Architecture o'zgarishi (TZ §3.2 dan)

Original TZ stack:
```
AWS EKS Kubernetes + RDS PostgreSQL + ElastiCache Redis + S3
```

Mahalliy stack (yangi):
```
UCloud VPS + self-managed Docker Swarm + PostgreSQL container + Redis container + MinIO
```

### Mitigation
- [ ] **POC** — UCloud'da 1 oylik test (latency, uptime, support)
- [ ] **Hybrid plan** — sensitive PII mahalliy, AI orchestration (stateless) AWS/Cloudflare Workers
- [ ] **CDN** — Cloudflare ham mahalliy, ham global edge

---

## D-007: Co-founder strategy 🟢

**Qaror:** Yakka founder (CEO + Product) + Product Lead hire (Faza 0 oxiri).

### Implikatsiya
- Faza 0 davomida hammasi sizda
- Product Lead hire Faza 0 oxirida (3 oy ichida) — yakka qolish davri cheklangan
- Burnout risk yuqori — vaqt management kritik

### Mitigation
- 2-3 ta advisor (pediatr psixolog, B2B sales) yarim-rasmiy
- Haftalik refleksiya (mental health uchun ham)
- [[06 — 30 Kunlik Reja]] Hafta 4'da Product Lead hire boshlanadi

---

## D-008: Funding 🟢

**Qaror:** Bootstrap (yakka kapital).

### Implikatsiya
- Faza 0 budget $30-50K — sizning hisobingizdan
- MVP $88-143K — bu bootstrap uchun og'ir, lekin mumkin
- **6 oy oxirida revenue boshlanishi shart** (subscription)
- Aks holda angel round Faza 1 o'rtasida kerak

### Faza 0 budget kamaytirilgan
| Item | TZ original | Bootstrap |
|------|-------------|-----------|
| Pedagog | $15-30K | $0-2K (university) |
| Huquqshunos | $5K | $3-5K |
| Brand | $5K | $3K (DIY + jr designer) |
| Voice | $5-10K | $0 (Faza 2'ga kechiktirildi) |
| Insurance | $5-15K | $5K minimal |
| Vazirlik consultant | — | $3-9K (3-mo kontract) |
| **TOTAL** | **$30-50K** | **~$15-25K** |

---

## D-009: Maktab admin panel 🟢 ⚠️

**Qaror:** Faza 2'da to'liq panel (alohida team).

### ⚠️ Risk va flag

Bu qaror **D-008 bootstrap bilan ziddiyatda**. Bootstrap'da early revenue kerak, lekin B2B'siz faqat B2C subscription. B2C conversion %15 (TZ goal) bilan:

- 500 beta user × 15% = 75 paying user × $3/oy = **$225/oy revenue**
- Bu Faza 1 davom etishi uchun yetarli emas

### Mitigation
1. **B2B pilot manual** — Faza 1'da 1-2 maktab bilan Telegram bot + manual contract (panel kerak emas)
2. **Korporativ kanal** — banklar, telekom xodimlariga (Concept §12.3) — Faza 1'da boshlash
3. **Premium tier upsell** — Premium tier konversiyasini oshirish (59,000 so'm/oy = $5/oy)

---

## D-010: LLM provider 🟢 (REVISED 2026-05-27)

**Yangi qaror:** Google Gemini 2.5 Flash primary + Gemini 2.5 Pro fallback.

### Trigger natija
- **2026-05-27** `validate_claude_uzbek.py` 16 scenario:
  - Claude Haiku 4.5 — halucinatsiya so'zlar ("cho'xtalarni", "gora", "shonadi", "ehtirosingni", "Tilmaa", "liceylashing", "huzurni yo'qotish"), kalka jumlalar, gap qurilishi xatolari
  - User baho: "juda yomon" (mening tahlilim ~3.6/5)
  - D-010 trigger activated
- **2026-05-27** `validate_gemini_uzbek.py` 16 × 2 model:
  - Gemini 2.5 Flash — sof o'zbek, hech qanday halucinatsiya so'z yo'q, refleksiv savollar, empatik (4/5+)
  - Gemini 2.5 Pro — sifat eng yuqori (4.5/5), lekin latency 14s va Pro narx Flash'dan 4x qimmat
  - Flash tanlandi production'ga

### Yangi LLM strategy
- **Primary:** Gemini 2.5 Flash — barcha standart suhbat
  - Narx: $0.30 input / $2.50 output per 1M tokens
  - Latency: ~3.6s avg, 7.4s p95
  - SDK: `google-genai` >=2.6.0
- **Fallback:** Gemini 2.5 Pro — maxsus murakkab so'rovlar (DTM chuqur matematika, IELTS strategiya, refleksiv ota-onam mavzular)
  - Narx: $1.25 / $10 per 1M tokens
  - Latency: ~14s (reasoning-heavy)
- **Regression test (legacy):** Claude Haiku 4.5
  - Har Faza 1 boshida re-validation (Anthropic model yangilanishi mumkin)
  - `validate_claude_uzbek.py` saqlanadi
- **Olib tashlandi:** Anthropic SDK production'dan (faqat scripts/ ichida regression uchun)

### Implikatsiya
- ✅ **Cost 3x past** — 5K user/oy taxminan $15-30 (Haiku'da $50-90 edi)
- ✅ **Til sifati sezilarli yaxshi** — sof o'zbek, halucinatsiya yo'q
- ✅ **Output 2x batafsil** — 1018 chars vs 461 chars (Companion segmenti uchun muhim)
- ⚠️ **Google Cloud billing yoqilgan** — kreditka kerak (Pay-as-you-go), mahalliy to'lov emas
- ⚠️ **D-006 ta'sir** — API call US/EU regionga (Q-001 latency risk Claude'dan farq qilmaydi)
- ⚠️ **Anthropic key REVOKE qilinadi** — `.env.example` leak xavfsizlik voqeasi sababli

### Hozirlanish
- [x] Gemini validation 16 scenario tugatildi
- [x] Tech strategy memory update (Primary = Gemini Flash)
- [ ] Anthropic key revoke (user darhol)
- [ ] Backend skeleton `google-genai` bilan
- [ ] Crisis Detection Layer 2 Gemini bilan (Haiku o'rniga)
- [ ] System prompts qayta tekshiriladi (Gemini Flash thinking off default)

---

## Yangi paydo bo'lgan savollar

Qarorlar qabul qilingach, ba'zi yangi muammolar paydo bo'ldi:

### Q-001: D-006 (mahalliy hosting) bilan AI latency
Claude API call'lari Tashkent'dan AS-East'gacha ~300-500ms latency bo'lishi mumkin.
**Hozirlanish:** POC sinash, agar TZ talabini (P95 <2s) bajara olmasa — hybrid arxitektura.

### Q-002: D-009 (Faza 2 panel) + D-008 (bootstrap) revenue gap
B2C subscription Faza 1'da $225-500/oy. Faza 1 to'liq 6 oy davomida bu yetarli emas.
**Hozirlanish:** B2B manual pilot Faza 1'da boshlanishi shart. Yoki angel round o'rtasida (Sprint 6+).

### Q-003: D-001 + D-002 kombinatsiyasi kafolatlanmaydi
$0 pedagog + outsource safety = klinik validatsiya zaif.
**Hozirlanish:** mandatory mitigation steps (D-001'da yozildi). Faza 0 acceptance criteria'ga qo'shildi.

## Change log

| Sana | O'zgarish |
|------|-----------|
| 2026-05-26 | D-001..D-010 yaratildi, hammasi javob qabul qildi |
| 2026-05-26 | Bootstrap pattern aniqlandi |
| 2026-05-26 | Q-001..Q-003 yangi savollar — Faza 0 davomida hal qilinadi |

## Bog'langan hujjatlar

- Obsidian: [[Setup/08 — Decisions Log]] (sync kutmoqda — Obsidian offline edi)
- [[Setup/00 — MOC (Setup va Boshlash)]]
- [[Setup/01 — Boshlash Rejasi]]
- [[Setup/04 — Faza 0 Safety Checklist]]
- [[Setup/06 — 30 Kunlik Reja]]
