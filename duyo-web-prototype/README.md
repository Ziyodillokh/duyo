# duyo-web-prototype — Figma Make Export (Reference Only)

**⚠️ Bu papka VIZUAL REFERENCE — production kod EMAS.**

Figma Make tomonidan yaratilgan web React prototip. Mobile RN port (`duyo-mobile/`) shu kod uslubidan ilhomlanadi, lekin to'g'ridan-to'g'ri import qilmaydi.

## Manba

- **Figma Make URL:** https://www.figma.com/make/WefKoUGozq1ymGaCMbjg9Y/DUYO
- **Eksport sanasi:** 2026-05-27
- **Versiya:** 1.0.0 (prototype tayyor)

## Tarkib

| Toifa | Soni |
|---|---|
| Sahifa (onboarding/child/parent/admin/shared) | 44 |
| Custom DUYO komponentlar (Avatar, BottomNav, ImageWithFallback) | 3 |
| shadcn/ui primitive (DOM-only — RN'da ishlamaydi) | 45 |
| TSX qator | ~7,475 |

To'liq tahlil: [[project-duyo-bosqich-b-mobile]] memory'da.

## Nimaga kerak

✅ **Foydalanish:**
- Vizual layout reference (screenshot bilan side-by-side)
- Tailwind class string'lardan copy-paste
- `src/styles/globals.css` — DUYO design tokens manbasi (9 brand rang + 18 semantic var)
- `DuyoAvatar.tsx` — 11 holat logikasi (RN'ga port)
- `CrisisSupport.tsx` — tinch ohang, 1050/1054 raqamlar (UX baseline)
- `AGE_VARIANTS.md`, `DUYO_TAFSILOT.md`, `LOYIHA_HOLATI.md` — feature spec'lar

❌ **Olmaymiz (RN'da ishlamaydi):**
- shadcn primitive (Radix UI — DOM-only)
- `react-router 7` (Expo Router'ga)
- `localStorage` (AsyncStorage + SecureStore'ga)
- `canvas-confetti`, `framer-motion` (RN ekvivalentlari boshqa)
- `@mui/material` 7.3.5 (dead dependency — `package.json`'da bor lekin kodda yo'q)
- `input-otp` (DOM-only — RN OTP UI'ni custom yozish kerak)

## Ishga tushirish (faqat web reference uchun)

```bash
cd duyo-web-prototype
npm install
npm run dev   # Vite dev server (localhost:5173)
```

⚠️ Bu **mobile emas** — Chrome'da ko'rishingiz mumkin, lekin `duyo-mobile/` Expo app'i bu kod bilan bog'lanmaydi.

## Bog'liq fayllar

- `duyo-mobile/` — haqiqiy RN+Expo implementatsiyasi (yaratilmoqda, Phase 0)
- `duyo-backend/` — FastAPI + Gemini Live API (production'da: https://api.duyo.uz)
- `duyo-docs/` — texnik hujjatlar, runbook'lar, decision'lar
