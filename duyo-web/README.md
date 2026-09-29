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
| `src/App.tsx` | uchta bo'lim — navbar va matnlar |
| `src/RobotStage.tsx` | robotni scroll va sichqonchaga ulaydi |
| `src/three/robot.ts` | robotning o'zi — primitivlardan qurilgan |
| `src/three/stage.ts` | renderer, kamera, yorug'lik |
| `src/Backdrop.tsx` | tugunlar to'ri, robot ortida |
| `src/index.css` | Tailwind + sahifa foni |

Bog'liqliklar: `react`, `react-dom`, `lucide-react`, `tailwindcss`, `three`.

## Uchta bo'lim

Robot scroll bilan **yig'iladi** — bu shunchaki bezak emas, hikoya:

| Bo'lim | Kadr | Robot | Mavzu |
|---|---|---|---|
| 1 | bosh | bosh | DUYO nima: suhbat, doskada qadamma-qadam javob |
| 2 | ko'krakdan pastda tugaydi | + tana | xavfsizlik: har bir xabar filtrdan o'tadi |
| 3 | to'liq gavda | + qo'l-oyoq | harakat: maqsadlar, bilim xaritasi, tengdoshlar |

**Bitta kadr.** Robot o'lchamini o'zgartirmaydi — **kamera orqaga chekinadi**.
Shuning uchun 1-bo'limda tana bor-yo'qligi *noma'lum* qoladi, 2-bo'limda esa
kadr ko'krakdan pastda tugagani uchun hali qo'shilmagan qo'llar **ko'rinmaydi**.
Yig'ilish va kadrlanish bitta voqea bo'ladi; aks holda qo'lsiz gavda g'alati
ko'rinardi.

Robot **rasm emas** — `three/robot.ts` da yumaloq qutilar va kapsulalardan
quriladi. Ikki sabab:

1. Eski maskot AI generatsiya qilgan va Google Play sentabrda aynan shuning
   uchun (Impersonation siyosati) do'kon sahifasini rad etgan. Koddan qurilgan
   personajning mualliflik huquqi git tarixi bilan isbotlanadi.
2. Tekis rasmni qismlarga ajratib bo'lmaydi. Yig'ilish g'oyasi 3D modelni
   talab qiladi.

## Fon nega video emas

Sahifa qurilgan brief `d8j0ntlcm91z4.cloudfront.net/...` dagi `.mp4` ni
ko'rsatgan edi. U **boshqa kompaniyaning mahsulot sahifasidagi fayl**, va DUYO
shu kunlarda Google Play'dan aynan uchinchi tomon materiali uchun
(Impersonation siyosati) rad javobi olgan. Uni qo'yish xatoni takrorlash
bo'lardi.

O'rniga fon `Backdrop.tsx` da qurilmaning o'zida chiziladi. **Muhimi:
briefning yorug' estetikasi saqlangan** — qog'oz-kulrang sahifa, och ranglar,
qora matn. Fon o'zgargan, dizayn emas.

- DUYO'ning o'z belgisi: logotip ichidagi tugun-bog'lanish figurasi, endi 3D
  bulut sifatida
- haqiqatan 3D va interaktiv: sichqoncha kamerani aylantiradi, telefonda
  qurilma qiyaligi (`deviceorientation`) shu vazifani bajaradi
- hech qanday tashqi so'rov yo'q, internetsiz ham ishlaydi
- litsenziya masalasi yo'q — kod repozitoriyada, git tarixi bilan

Kutubxonasiz va WebGL'siz: yuzta nuqtani proyeksiya qilish oddiy arifmetika,
canvas esa **yorug'** palitrani shader'dan aniqroq boshqaradi.

### Xavfsizlik choralari

- `prefers-reduced-motion: reduce` — aylanish to'xtaydi, figura qoladi
- yorliq ko'rinmasa (`visibilitychange`) animatsiya sikli to'xtaydi
- canvas ochilmasa sahifa ostidagi gradient bilan ishlayveradi
- `devicePixelRatio` 2 bilan cheklangan
- bog'lanishlar bir marta hisoblanadi: bulut faqat aylanadi, aylanish esa
  masofalarni o'zgartirmaydi

## Nimani qayerdan o'zgartirasiz

| Nima | Qayerda |
|---|---|
| Menyu bandlari | `App.tsx` → `NAV_LINKS` |
| Sarlavha, matn, badge | `App.tsx` → `<main>` ichida |
| Yuklab olish havolasi | `App.tsx` → `APK_URL` |
| Fon ranglari | `Backdrop.tsx` → `COLOURS` |
| Tugunlar soni va zichligi | `Backdrop.tsx` → `NODE_COUNT` / `LINK_DIST` |
| Fon joylashuvi va o'lchami | `Backdrop.tsx` → `cx` / `cy` / `scale` |
| Kamera burchagi | `Backdrop.tsx` → `yaw` / `pitch` |

## Tekshirilgan

- `npm run build` — TypeScript va Vite toza
- 390px va 1440px: gorizontal toshish yo'q (`scrollWidth === clientWidth`),
  navbarning to'rtala bandi sig'adi
- fon real brauzerda chiziladi, sichqonchaga javob beradi

## Deploy

`npm run build` → `dist/`. `base: './'` qo'yilgani uchun istalgan papkadan
ishlaydi — qayta yig'ish shart emas.
