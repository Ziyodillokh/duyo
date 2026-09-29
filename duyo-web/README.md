# duyo-web

DUYO'ning bitta ekranli hero sahifasi — React + TypeScript + Tailwind, Vite ustida.

`duyo-landing/` ga tegmaydi: u alohida, mavjud sayt. Bu papka mustaqil.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc -b && vite build  ->  dist/
npm run preview    # yig'ilgan versiyani ko'rish
npm run typecheck
```

## Fayllar

| Fayl | Nima |
|---|---|
| `src/App.tsx` | butun sahifa — navbar, hero, matnlar |
| `src/GalaxyCanvas.tsx` | 3D fon: WebGL shader'da chizilgan spiral galaktika |
| `src/index.css` | Tailwind + sahifa foni |
| `index.html` | qobiq, `<title>` va meta |

Bog'liqliklar: `react`, `react-dom`, `lucide-react`, `tailwindcss`. Boshqa yo'q.

## Fon nega video emas

Sahifa qurilgan brief `d8j0ntlcm91z4.cloudfront.net/...` dagi `.mp4` ni
ko'rsatgan edi. U **boshqa kompaniyaning mahsulot sahifasidagi fayl**, va DUYO
shu kunlarda Google Play'dan aynan uchinchi tomon materiali uchun
(Impersonation siyosati) rad javobi olgan. Uni qo'yish xatoni takrorlash
bo'lardi.

O'rniga fon qurilmaning o'zida, `GalaxyCanvas.tsx` dagi shader'dan chiziladi:

- hech qanday tashqi so'rov yo'q, internetsiz ham ishlaydi
- litsenziya masalasi yo'q — kod repozitoriyada, git tarixi bilan
- haqiqatan 3D va interaktiv: sichqoncha kamerani aylantiradi, telefonda
  qurilma qiyaligi (`deviceorientation`) shu vazifani bajaradi
- bu ilovadagi miya xaritasi ortidagi galaktikaning o'zi — sayt va mahsulot
  bir xil ko'rinadi

Kutubxona ishlatilmagan: to'liq ekranli fragment shader uchun xom WebGL ~60
qator sozlash, three.js esa bu sahifa ishlatmaydigan geometriya uchun ~150 KB.

### Xavfsizlik choralari

- `prefers-reduced-motion: reduce` — harakat to'xtaydi, rasm qoladi
- yorliq ko'rinmasa (`visibilitychange`) sikl to'xtaydi, GPU bo'shaydi
- `failIfMajorPerformanceCaveat` — dasturiy rasterizatorda shader ishga
  tushmaydi; ostidagi CSS gradient ko'rinadi
- `devicePixelRatio` 2 bilan cheklangan

## Nimani qayerdan o'zgartirasiz

| Nima | Qayerda |
|---|---|
| Menyu bandlari | `App.tsx` → `NAV_LINKS` |
| Sarlavha, matn, badge | `App.tsx` → `<main>` ichida |
| Yuklab olish havolasi | `App.tsx` → `APK_URL` |
| Galaktika rangi | `GalaxyCanvas.tsx` → `BLUE` / `VIOLET` / `WARM` / `DEEP` |
| Galaktika joylashuvi | `GalaxyCanvas.tsx` → `main()` dagi `uv` markazi |
| Kamera burchagi | `GalaxyCanvas.tsx` → `yaw` / `pitch` |

## Tekshirilgan

- `npm run build` — TypeScript va Vite toza
- 390px va 1440px: gorizontal toshish yo'q (`scrollWidth === clientWidth`),
  navbarning to'rtala bandi sig'adi
- shader real brauzerda chiziladi (swiftshader ostida ham)

## Deploy

`npm run build` → `dist/`. `base: './'` qo'yilgani uchun istalgan papkadan
ishlaydi — qayta yig'ish shart emas.
