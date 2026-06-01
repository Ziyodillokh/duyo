# DUYO Admin Panel — to'liq hujjat (spec + dizayn + backend-tayyorlik + yo'l xaritasi)

**Sana:** 2026-06-01
**Holat:** Hujjatlashtirildi (spec + Figma dizayn tayyor). Implementatsiya boshlanmagan.
**Manba:** Mahsulot egasi spec'i + Figma dizayn (`8oSKdeemDgzMQ0gDvkygja`) + backend-tayyorlik tahlili.

---

## 1. Maqsad va kontekst

DUYO — 7–16 yoshli bolalar uchun mustaqil AI companion + tutor. Admin panel — **ichki operatsiya paneli** (bolalar UI EMAS): admin, safety officer, content manager, support, finance, school admin uchun. Mahsulot operatsiyalari, xavfsizlik, kontent, AI, monetizatsiya, foydalanuvchilar, tahlil va ichki workflow'larni boshqaradi.

**Dizayn maqsadi:** jiddiy, premium, **xavfsizlik-birinchi** SaaS admin dashboard. Toza, professional, ishonchli. Light mode birinchi, dark mode ixtiyoriy.

---

## 2. Arxitektura qarori (xavfsizlik + struktura)

**Ikki qatlam:**
1. **Admin FRONTEND** — alohida yangi top-level app **`duyo-admin/`** (Vite+React yoki Next), `admin.duyo.uz`ga deploy. nginx'da `admin.duyo.uz` bloki ALLAQACHON bor. Bolalar mobil ilovasiga yoki `duyo-web-prototype`ga aralashtirilmaydi.
2. **Admin API** — `duyo-backend`'da alohida router (`/v1/admin/*`), **bolalar/ota-ona JWT'sidan butunlay ajratilgan** admin auth bilan.

**Nega (xavfsizlik):** admin panel eng nozik ma'lumotга kiradi (bolalar PII, chat transkriptlari, crisis/ruhiy-salomatlik, ota-ona kontaktlari). Shuning uchun:
- Alohida frontend → admin UI hech qachon bolalar ilovasida ship bo'lmaydi.
- Alohida auth (`admin_users` jadval + admin login + admin-scope token + `get_current_admin` dependency, har route'da rol tekshiruvi) → bola/ota-ona tokeni admin'ga yeta olmaydi.
- nginx host-cheklov (`admin.duyo.uz`) + IP allowlist + MFA + audit log + rate limiting.

**Nega (struktura):** backend model/service/DB qayta ishlatiladi (DRY). Alohida admin servisi solo-founder uchun ortiqcha (kelajak hardening). Mavjud "har sirt = alohida app" naqshiga mos.

---

## 3. Vizual stil va layout

- Modern SaaS admin dashboard; toza, professional, calm. Light-first, dark ixtiyoriy. White/soft-gray fon.
- **DUYO blue** primary. **Xavfsizlik ranglari:** GREEN=safe, YELLOW=warning, ORANGE=serious, RED=urgent crisis.
- Rounded cards, toza jadvallar, kuchli ierarxiya. Zich, lekin tartibli.
- **Layout:** chap sidebar nav; top bar (search, environment badge, notifications, admin profile, role badge); asosiy content (cards, tables, filters, charts, detail drawers).
- **i18n:** UZ (asosiy) + RU + EN locale switch.

---

## 4. Figma dizayn inventari

Fayl: `https://www.figma.com/design/8oSKdeemDgzMQ0gDvkygja` (Page 1, 1280px desktop ekranlar). Barcha 12 modul dizayn qilingan.

| Ekran | Node ID | O'lcham |
|-------|---------|---------|
| Boshqaruv paneli (Dashboard) | 19:7600 | 1280×1239 |
| Xavfsizlik markazi | 19:7942 | 1280×1198 |
| Foydalanuvchilar va oilalar | 19:8592 | 1280×1271 |
| AI boshqaruvi | 19:9185 | 1280×2112 |
| RAG bilim bazasi | 19:9576 | 1280×2035 |
| Kontent kutubxonasi | 19:10009 | 1280×1024 |
| Avatar va gamifikatsiya | 19:10262 | 1280×2010 |
| Ota-ona monitoringi | 19:10712 | 1280×1436 |
| Monetizatsiya | 19:11133 | 1280×1741 |
| Bildirishnomalar | 19:11590 | 1280×1024 |
| Tahlil | 19:11941 | 1280×2385 |
| Tizim sozlamalari | 19:12475 | 1280×2598 |

(Erta iteratsiyalar: Dashboard 19:6830, Safety 19:7182, "Kontent va RAG" 19:8939 ham bor.)

---

## 5. Modullar va funksiyalari

### 5.1 Boshqaruv paneli (Dashboard)
Yuqori-darajali ops ko'rsatkichlari: bugungi faol bolalar/ota-onalar, AI xabarlar, voice so'rovlar, crisis (RED/ORANGE/YELLOW), kutilayotgan safety review, kutilayotgan kontent tasdiqlash, to'lov xatolari, bugungi AI cost, STT/TTS latency, API/DB/Crisis-service holati. Quick-action: "RED hodisalarni ko'rish", "Kontentni tasdiqlash", "Xato to'lovlar", "RAG test".

### 5.2 Xavfsizlik markazi (ENG MUHIM)
Crisis event queue; risk tabs RED/ORANGE/YELLOW/GREEN. Jadval: child, age, language, detected keyword, AI assessment, classifier score, parent notified, safety officer, status, created time. Detail drawer: risk level, timeline, oxirgi xabarlar konteksti, keyword match, AI assessment JSON, classifier score, parent notification status, SMS/call log, safety officer notes, resolution (false positive/resolved/escalated/abuse protocol/model feedback). **Abuse-protocol banner:** "Agar ota-ona zarar manbai bo'lishi mumkin bo'lsa — avto-xabar YO'Q, inson safety review'ga." Audit panel.

### 5.3 Foydalanuvchilar va oilalar
Bolalar/ota-onalar ro'yxati, parent-child linklar, detail sahifalar. Account status (active/suspended/deleted), age segment (Junior/Explorer/Companion), til, subscription tier, faollik. Family graph, support notes, **privacy-safe chat summary (xom chat EMAS)**, admin action log.

### 5.4 AI boshqaruvi
Scripted responses (intent + variantlar, age/til teglari), prompt template manager (Junior/Explorer/Companion), model router (primary/fallback/local, cache TTL, tier rate limits), AI loglar (prompt versiya, latency, token, cost, fallback sababi, safety filter natijasi), safety filters (toxic, topic blacklist, age vocabulary, URL blocking).

### 5.5 RAG bilim bazasi
PDF upload; document jadval (title, subject, grade, language, publisher, license, parsing status, chunks, approved chunks, quality score). Pipeline: uploaded→parsing→OCR→chunking→classification→embedding→review→published. Chunk viewer (text, page_start/end, content_type, topic, difficulty, language, citation, review status). Retrieval test panel (savol, grade/subject/language, retrieved chunks, citation, javob preview). Litsenziyasiz/ko'rilmagan kontent uchun ogohlantirish.

### 5.6 Kontent kutubxonasi
She'rlar, hikoyalar, darslar, audio. Review queue, license management. Maydonlar: title, age segment, til, type, audio status, license status, review status, published. Actions: create/edit/preview/approve/reject/publish/unpublish. Sifat metrikalari: completions, likes, reports, engagement.

### 5.7 Avatar va gamifikatsiya
Avatar komponent kutubxonasi (body, ranglar, accent, yuz ifodalari), aksessuarlar (shlyapa, ko'zoynak, antenna, fon, mavsumiy). Ball qoidalari (daily check-in, 5-daq chat, she'r, dars yordami, til o'yini, sport, streak bonus). Level tizimi: **Tanish→Do'st→Sirdosh→Hamroh→Hamfikr→Yulduz**. Streak milestones, tamagochi config (energy/learning/joy/health). **Ogohlantirish:** "Aybdorlik yoki bosim mexanikasini yaratma."

### 5.8 Ota-ona monitoringi
10-kunlik report dashboard (generated/sent/opened), parent alerts, SMS delivery log, report templates, PIN-himoyalangan web dashboard linklar, parent response time. **Privacy banner:** "Ota-onalar aggregatsiya + safety alert ko'radi, xom suhbat EMAS."

### 5.9 Monetizatsiya
Planlar: **Tanish Free / Do'st Standard / Hamroh Premium**. Feature matritsa (til soni, AI kunlik limit, voice, premium kontent, bolalar soni, priority). Subscriptions, transactions (Click/Payme/Uzcard/Humo/Visa-MC), failed payments, refund requests, promo codes, B2B (maktab/bog'cha/korporativ). Revenue: MRR, ARR, conversion, churn, ARPU.

### 5.10 Bildirishnomalar
Push/SMS/email/parent report/crisis alert templates. Campaign builder, audience segment, schedule, delivery log, failed retry, quiet hours.

### 5.11 Tahlil
DAU/MAU, retention D1/D7/D30, session length, chat started, messages, level up, content completed, free→paid, churn, AI latency, AI cost/user, cache hit rate, fallback rate, crisis/day, false positive rate, false negative feedback, parent response time, safety officer review time.

### 5.12 Tizim sozlamalari
Admin roles & permissions, feature flags, gradual rollout (1/10/50/100%), service health, API/DB/queue/STT-TTS-worker status, audit logs, environment (staging/prod), security settings.

---

## 6. Role-based access (8 rol)

| Rol | Ruxsat |
|-----|--------|
| Super Admin | To'liq |
| Admin | Users, analytics, payments |
| Safety Officer | Faqat crisis events + safety review (yagona crisis kontekstiga kiruvchi) |
| Content Manager | Kontent + RAG review |
| Support Agent | User support + cheklangan payment ko'rinish |
| Finance Manager | Payments, refunds, revenue |
| School Admin | Faqat maktab bolalari progressi |
| Read-only Analyst | Faqat analytics |

---

## 7. Kritik UX/xavfsizlik/maxfiylik qoidalari

1. Xavfsizlik markazi vizual jihatdan eng yuqori ustuvorlik; **RED crisis o'tkazib bo'lmas**.
2. Oddiy adminlar **xom bolalar suhbatini ko'rmaydi**; faqat Safety Officer crisis kontekstiga kiradi (backend darajasida majburlanishi shart, UI yashirishi yetarli emas).
3. Kontent faqat `license_status=approved AND review_status=approved` bo'lsa nashr qilinadi.
4. RAG chunk faqat reviewed+approved bo'lsa production'ga.
5. To'lov xatolari, AI cost, fallback rate ko'rinadigan bo'lishi shart.
6. **Har admin amali audit log'da.**
7. UZ/RU/EN.

---

## 8. Backend-tayyorlik tahlili (KRITIK)

Dizayn backend'dan ancha oldinda. Funksiyalarni bugungi `duyo-backend` bilan solishtirish:

| Modul | Backend holati | Izoh |
|-------|----------------|------|
| Xavfsizlik markazi | ✅ Bor | `CrisisEvent`, crisis pipeline, GREEN/YELLOW/ORANGE/RED darajalar, parent-notify mantig'i (TZ §9.6) |
| Foydalanuvchilar/oilalar | ✅ Bor | `User`, `ChildProfile`, `Conversation`, `Message`, age segments |
| RAG bilim bazasi | ✅ Bor | `textbook_chunks`, ingest pipeline (upload→...→publish), `/v1/textbook` search/review/approve/reject/stats |
| AI boshqaruvi (loglar/cost) | 🟡 Qisman | `Message.tokens_in/out` bor (cost hisoblanadi); prompt-versiya/router-config/scripted-responses YO'Q |
| Ota-ona monitoringi | 🟡 Qisman | SMS (Eskiz/stub) bor; 10-kunlik report tizimi YO'Q |
| Kontent kutubxonasi | 🟡 Qisman | license/review/audio modeli YO'Q |
| Monetizatsiya | ❌ YO'Q | Click/Payme/Uzcard integratsiyasi, planlar, subscriptions umuman qurilmagan |
| Tahlil | ❌ YO'Q | DAU/retention/churn aggregatsiyasi, events pipeline YO'Q; ba'zi metrikalar (cache hit, fallback, false-negative) instrumentatsiya talab qiladi |
| Avatar/gamifikatsiya | ❌ Asosan yo'q | Level konsepti bor, config-backend YO'Q |
| Bildirishnomalar (campaign) | ❌ YO'Q | SMS yuborish bor; campaign builder/segment/scheduler YO'Q |
| Tizim (RBAC/flags/audit) | ❌ YO'Q | Admin rollar, feature flags, audit log umuman YO'Q |

---

## 9. Fundament (birinchi qurilishi shart)

Butun dizayn bularsiz ishlamaydi:
1. **Admin auth + RBAC** — `admin_users` jadval, admin login, admin-scope token, `get_current_admin`, 8 rol + per-route ruxsat. "Oddiy admin xom chat ko'rmaydi" / "faqat Safety Officer crisis kontekstiga kiradi" qoidalari **endpoint darajasida** majburlanishi shart.
2. **Audit log** — har admin amalini yozuvchi tizim (who/what/when), barcha modullarda ishlatiladi.
3. **Admin API skeleton** — `/v1/admin` router, host-cheklov (`admin.duyo.uz`), nginx allowlist.

---

## 10. Fazalashtirilgan yo'l xaritasi

Bu **6–12 oylik yo'l xaritasi**, bitta build emas. Backend-tayyorlikka qarab:

- **Faza 0 — Fundament:** Admin auth + RBAC + audit log + admin API skeleton + `duyo-admin` frontend shell (sidebar/topbar/layout/i18n).
- **Faza 1 — Real-backend modullar (eng yuqori qiymat):** Xavfsizlik markazi → Foydalanuvchilar va oilalar → RAG bilim bazasi. (Backend allaqachon bor.)
- **Faza 2 — Backend kengaytirish:** AI loglar/cost, Kontent kutubxonasi (license/review), Ota-ona monitoringi (10-kunlik report).
- **Faza 3 — Yangi katta backend:** Monetizatsiya (Click/Payme), Tahlil (events pipeline), Avatar/gamifikatsiya config, Campaign bildirishnomalar, B2B/maktab.

---

## 11. Ochiq qarorlar / aniqlanmagan nuqtalar

- Frontend stack: Vite+React vs Next (admin uchun SSR shart emas → Vite+React yetarli).
- Admin auth: alohida `admin_users` jadval (tavsiya) vs `User`ga rol qo'shish.
- Safety Center'da crisis + RAG review aralashgan (Figma) — RBAC bo'yicha **ajratish** kerak (Safety Officer vs Content Manager turli rollar).
- Qaysi metrikalar bugun backing-data'ga ega vs instrumentatsiya kerak (Tahlil moduli uchun aniqlash).
- Audit log saqlash muddati / compliance (bolalar ma'lumoti — GDPR/local talablar).

---

## 12. Manbalar
- Mahsulot egasi spec'i (ushbu hujjatga jamlangan).
- Figma: `8oSKdeemDgzMQ0gDvkygja` (Page 1, 12 ekran — §4).
- Backend: `duyo-backend/src/duyo/` (models, crisis, textbook, services).
- Bog'liq: [[project_duyo_rag_ocr]] (RAG pipeline), [[reference_duyo_server]] (infra/nginx admin.duyo.uz).
