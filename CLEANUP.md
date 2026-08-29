# MVP tozalash — nima o'chirildi va qanday qaytariladi

2026-08-29. 1-qadam: ilovani toza MVP holatiga keltirish.

Hech narsa yo'qolmagan — hammasi git tarixida. Bu hujjat **qaysi commit'da nima
borligini** va **qanday qaytarishni** aytadi, shunda chigal vaziyatda qidirib
o'tirmaysiz.

## Tozalashdan oldingi holat

Oxirgi "eski" commit: **`ca67cb7`** (`docs(badges): the six image-generation prompts`)

Hamma narsani ko'rish uchun:

```bash
git show ca67cb7:duyo-mobile/src/screens/home/companion-home.tsx
git diff ca67cb7..HEAD --stat
```

Bitta faylni qaytarish uchun:

```bash
git checkout ca67cb7 -- duyo-mobile/src/app/\(main\)/dtm.tsx
```

Butun bir commit'ni bekor qilish uchun:

```bash
git revert <commit-hash>
```

---

## Commit'lar

| Commit | Nima ketdi |
|---|---|
| `c45ad4c` | O'lik orollar (mobil) |
| `f5f8dac` | DTM, Til mashqi, Inventar; Kutubxona va Dars yordami eshiklari qaytdi |
| `e6bb26d` | Ota-ona tarafi (mobil) |
| `d59ca87` | Ota-ona tarafi (backend) + translate/hint |
| keyingisi | Repo gigienasi, web-prototype, ishlatilmagan bog'liqliklar |

---

## 1. O'lik orollar — `c45ad4c`

Hech narsa ularga yetib bormasdi.

- `screens/home/companion-home.tsx` — ikkinchi dashboard (609 qator),
  `glass-home` bilan almashtirilgan
- `components/gamification/` — 4 ta karta, faqat companion-home ishlatardi
- `components/brain/{focus-timer,knowledge-pulse,insights}-card.tsx` +
  `lib/brain-insights.ts` — hech qachon chiqmagan Miya maketi uchun
- `hooks/use-mood.ts` + `api/endpoints/mood.ts`
- `components/v2/{chip,form-input,helper-text,select-card,tabs,country-chip,user-type-icon}.tsx`
- `assets/onboarding/{child,parent}.png` — **2.28 MB**, har bir APK'da yuklanardi
- 11 ta o'lik eksport, shablon `README.md`, `scripts/reset-project.js`

**Qaytarish:** `git checkout c45ad4c~1 -- duyo-mobile/src/screens/home/companion-home.tsx`

---

## 2. Olib tashlangan funksiyalar — `f5f8dac`

Siz "faqat Dars yordami qolsin" dedingiz. Kutubxonani ham qoldirdim, chunki
admin panelga yuklagan kitoblaringizni ilovada ochadigan yagona joy o'sha.

**Ketdi:**

| Funksiya | Fayllar |
|---|---|
| DTM testi | `(main)/dtm.tsx`, `hooks/use-dtm.ts`, `api/endpoints/dtm.ts` |
| Til mashqi | `(main)/language-practice.tsx`, `api/endpoints/language.ts` |
| Inventar | `(main)/inventory.tsx`, `screens/inventory/`, `mocks/inventory.ts` |

**Qoldi va eshigi qaytarildi:** Kutubxona, Dars yordami — Sozlamalar
sahifasining tepasida, "O'RGANISH" bo'limida.

`src/mocks/dtm.ts` → `src/lib/subjects.ts` ga ko'chdi (fan ro'yxati; Dars
yordami unga tayanadi, u hech qachon mock ham, DTM'ga oid ham bo'lmagan).

**Diqqat:** Til mashqi Kutubxona ichidan ochilardi — o'sha tugma ham olib
tashlandi (`screens/library/library-screen.tsx`).

**Qaytarish (masalan DTM):**

```bash
git checkout f5f8dac~1 -- duyo-mobile/src/app/\(main\)/dtm.tsx \
  duyo-mobile/src/hooks/use-dtm.ts duyo-mobile/src/api/endpoints/dtm.ts
```
Keyin `(main)/_layout.tsx` ga `<Stack.Screen name="dtm" />` qo'shing va biror
joydan `router.push('/(main)/dtm')` qiling — aks holda ekran yana eshiksiz
qoladi.

---

## 3. Ota-ona tarafi, mobil — `e6bb26d`

Har bir havola allaqachon kommentda edi — ya'ni ilovada ishlamasdi.

- 6 ta marshrut: `parent-dashboard`, `parent-connection`, `user-type`,
  `child-phone`, `family-consent`, `family-waiting`
- `api/endpoints/{family,reports}.ts`, `hooks/use-report.ts`
- `store/onboarding.ts` dagi `UserType`
- 5 ta ekrandagi kommentga olingan shoxlar
- 45 ta i18n kaliti × 3 til = 135 qator

---

## 4. Ota-ona tarafi, backend — `d59ca87`

- `api/v1/family.py`, `schemas/family.py`
- `api/v1/report.py`, `analysis/reports.py`, `analysis/guidance.py`,
  `schemas/report.py`
- `prompts.py`: `PARENT_REPORT_PROMPT`, `PARENT_GUIDANCE_PROMPT`
- `psychology/retriever.py`: `retrieve_for_guidance`, `build_guidance_context`
- `auth.py` dagi taklif qidiruvi, `chat.py` dagi qayta biriktirish
- `/chat/translate`, `/chat/hint` va ularning Gemini funksiyalari
- Bo'sh skeleton paketlar: `auth/`, `chat/`, `content/`, `users/`

---

## ⚠️ TEGILMAGAN — o'likka o'xshaydi, lekin tirik

Bu ro'yxat keyingi tozalash ilovani buzmasligi uchun.

| Nima | Nega |
|---|---|
| `child_profiles.family_invites` jadvali va `models/family_invite.py` | Modelni o'chirsangiz, Alembic keyingi migratsiyada `DROP TABLE` taklif qiladi. Siz jadval qolsin dedingiz. |
| `ChildProfile.parent_id` | Akkaunt egasiga FK. **Har bir** bola marshruti shunga tayanadi. |
| `ChildProfile.child_user_id` va uni o'qiydigan **8 ta** egalik tekshiruvi | Faqat taklif oqimi uni **yozardi**, ya'ni yangi qiymat paydo bo'lmaydi. Lekin production'da shu yo'l bilan bog'langan bola bo'lsa, u faqat shu `OR` shartlari orqali o'z akkauntiga kira oladi. |
| `_dispatch_parent_alert` (`chat.py`) | Inqiroz SMS'i — xavfsizlik funksiyasi. |
| `AccountRole.PARENT` | Postgres enum qiymati; o'chirish migratsiya talab qiladi. |
| `/admin/users/parents` | Xodimlar uchun akkaunt ro'yxati, ota-ona ilovasi emas. |
| `duyo/textbook/` butun paketi | Asosiy chat RAG grounding va inqiroz embeddings shunga tayanadi. Parserlari (docling/mineru/tesseract) offline quvur — testlar ularni qamramaydi, lekin ular o'lik emas. |
| `expo-constants`, `expo-linking` | `expo-router` ning peer dependency'lari. |
| `duyo-docs/` | Runbook'lar: server-setup, nginx, RAG ingest. |
| `duyo-admin` ParentMonitoring | Siz qoldirishni aytdingiz. |

---

## Coverage darvozasi 80 → 79

Ota-ona modullari repodagi eng yaxshi testlangan qismlar edi. Ularning ~450
qatorini olib tashlash **o'rtachani** tushirdi, lekin biror qator ham
kamroq testlangan bo'lib qolmadi: 80.55% → 79.77%, manbasi qolgan birorta test
o'chirilmadi.

Qolgan farq — offline darslik ingestion quvuri, u hech qachon unit test bilan
qamralmagan va hech qanday so'rov yo'lida turmaydi. 80 ga qaytarish uchun
`services/otp.py` (70%) va `psychology/store.py` (27%) ni testlash kerak —
bu 2-qadam (performance) ishi.

Sabab `duyo-backend/pyproject.toml` ichida ham yozilgan.

---

## Tekshiruv

Har bir bosqichdan keyin ishlatilgan darvozalar:

```bash
cd duyo-mobile  && npx tsc --noEmit -p tsconfig.json     # 0 xato
cd duyo-mobile  && npx expo lint                          # 16 muammo (hammasi eski)
cd duyo-backend && ./.venv-test/Scripts/python.exe -m pytest tests -q
cd duyo-backend && ./.venv-test/Scripts/python.exe -m ruff check src tests
```

**Diqqat:** backend testlari `.venv-test` da ishlaydi, `.venv` da emas —
`.venv` da ilovaning bog'liqliklari yo'q.
