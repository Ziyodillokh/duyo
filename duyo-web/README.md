# duyo-web

DUYO'ning sayti: bitta scroll-film, beshta bo'lim. Orqada 3D sahna turadi:
Android telefon, uning ekranida **ilovaning haqiqiy ekranlari**; yonida
**ilovadagi DUYO mascoti**ning 3D modeli; atrofda galaktika. Sahifa oq
qog'ozdan koinotga kiradi va yana yorug'likka chiqadi.

React 18 + TypeScript + Tailwind v4 + three.js, Vite ustida. `duyo-landing/`
ga tegmaydi.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc -b && vite build  ->  dist/
npm run preview
npm run typecheck
```

## Bo'limlar

| # | Bo'lim | Fon | Telefonda |
| --- | --- | --- | --- |
| 0 | boshlash | yorug' | AI Chat: savol, doskada bosqichma-bosqich yechim |
| 1 | xavfsizlik | koinot | «Kitoblar» guruhi: raqamli xabar yetkazilmaydi |
| 2 | miya | koinot | DUYO MIYA; tugunlar ekrandan chiqib galaktikaga aylanadi |
| 3 | maqsad | koinot | Maqsadlarim: maqsad qadamlarga bo'lingan |
| 4 | yuklab | yorug' | bosh sahifa; robot qo'l silkitadi |

Bo'limlar orasida telefon bir marta aylanadi, ekran esa telefonning orqasi
kameraga qaraganda almashadi. Robot har safar matnning qarama-qarshi tomoniga
o'tadi.

## Fayllar

| Fayl | Nima |
| --- | --- |
| `src/content.ts` | sahifadagi har bir so'z va havola |
| `src/App.tsx`, `src/ui/*` | sahifa: navbar, bo'limlar, fon rangi, footer |
| `src/scene/director.ts` | scroll → kamera, telefon, robot (sof funksiya) |
| `src/scene/runtime.ts` | sahnani quradi va har kadrda director'ni qo'llaydi |
| `src/scene/measure.ts` | matn egallagan joyni o'lchaydi — sahna bo'sh joyga sig'adi |
| `src/scene/phone.ts` | telefon modeli |
| `src/scene/phoneScreen*.ts` | telefon ekrani: ilova skrinshotlarini o'ynatadi |
| `src/assets/app-screens/` | ilovadan olingan ekranlar (`.webp`) va `captures.ts` |
| `src/three/robot*.ts` | DUYO mascotining 3D modeli |
| `src/scene/galaxy.ts` | galaktika va miya xaritasi tugunlari |
| `src/scene/contract.ts` | ranglar, o'lchamlar, modullar orasidagi interfeyslar |
| `harness/*.html` | har bir modulni alohida ko'rish: `/harness/robot.html` va h.k. |

## Nimani qayerdan o'zgartirasiz

| Nima | Qayerda |
| --- | --- |
| Matn, sarlavha, tugma, havola | `src/content.ts` |
| Kamera kadrlari | `src/scene/director.ts` → `KEYS` |
| Brend ranglari | `src/scene/contract.ts` → `PALETTE` |
| Robot ranglari va shakli | `src/three/robotSkin.ts`, `robot.ts` |
| Telefon ekranlari | quyidagi «Ekranlarni yangilash» |

**Matnlar haqiqatga mos bo'lishi shart** — bu bolalar ilovasi. `content.ts`
boshidagi izohda har bir da'vo kodning qaysi joyi bilan tekshirilgani yozilgan.
Backend'da limit yoki xavfsizlik o'zgarsa, avval o'sha yerni o'qing.

## Ekranlarni yangilash

Telefondagi ekranlar ilovaning hozirgi kodidan olingan: ilova brauzerda
(Expo web) **lokal soxta API** bilan ishga tushiriladi, `api.duyo.uz`ga
birorta ham so'rov ketmaydi (`browser.mjs` boshqa hamma manzilni bloklaydi va
yozib boradi). Ilova kodi o'zgartirilmaydi.

```bash
cd scripts/app-capture
rsync -a --exclude node_modules ../../../duyo-mobile/ app/ && (cd app && npm ci)
sh start.sh                 # soxta API + ilova, 127.0.0.1:9911 ga bog'langanini tekshiradi
node capture.mjs            # yoki: node capture.mjs map goals
python3 finish.py           # webp + src/assets/app-screens/captures.ts
sh stop.sh
```

Demo ma'lumotlar `mock-data.mjs` da — faqat taxalluslar, haqiqiy odam yo'q.

## Robot

`src/three/robot.ts` — ilovadagi mascot
(`duyo-mobile/assets/duyo/v2/mascot-default.png`, `happy.png`) asosida
primitivlardan qurilgan. Google Play'dagi Impersonation muammosi uchun mascot
almashtirilsa, bu model ham yangilanishi kerak.

## Tekshirilgan

- `npm run typecheck`, `npm run build` — toza
- 320–1920px: gorizontal toshish yo'q, har bir qator o'z ustuniga sig'adi,
  har bir havola jonli, faqat bitta `h1`
- 3D bo'lak yuklanmasa yoki WebGL yo'q bo'lsa — sahifa to'liq qoladi, faqat
  sahna chiqmaydi
- `prefers-reduced-motion` — aylanish, parallaks va animatsiya to'xtaydi
- ko'rinmay qolgan matn bosilmaydi; klaviatura fokusi uni ko'rinadigan joyga
  olib keladi

## Deploy

`npm run build` → `dist/`. `base: './'` bo'lgani uchun istalgan papkadan
ishlaydi. Ijtimoiy tarmoq uchun rasm (`og:image`) hali yo'q — deploy manzili
aniq bo'lgach, mutlaq URL bilan qo'shing va `twitter:card` ni
`summary_large_image` ga qaytaring.
