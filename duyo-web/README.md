# duyo-web

DUYO'ning sayti: bitta scroll-film, oltita bo'lim, hammasi qora, jonli
koinot ichida. Bosh sahifada **ilovadagi DUYO mascoti**ning 3D modeli
yolg'iz turadi — boshini sichqonchaga buradi, sudrasa aylanadi, bossangiz
o'zi haqida gapiradi. Keyingi bo'limlarda kamera koinot bo'ylab uchib,
galaktika ichidagi telefonga boradi: uning ekranida **ilovaning haqiqiy
ekranlari**.

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

| # | Bo'lim | Sahnada |
| --- | --- | --- |
| 0 | boshlash | DUYO robot; «DUYO'ni tinglang» — o'zi haqida gapiradi |
| 1 | savol | AI Chat: savol, doskada bosqichma-bosqich yechim |
| 2 | xavfsizlik | «Kitoblar» guruhi: raqamli xabar yetkazilmaydi |
| 3 | miya | DUYO MIYA; tugunlar ekrandan chiqib galaktikaga aylanadi |
| 4 | maqsad | Maqsadlarim: maqsad qadamlarga bo'lingan |
| 5 | yuklab | ilovaning bosh sahifasi |

Robot ham, telefon ham o'z joyidan qimirlamaydi — faqat kamera harakat
qiladi. Telefon bo'limlari orasida telefon bir marta aylanadi, ekran esa
uning orqasi kameraga qaraganda almashadi.

## DUYO'ning ovozi

Yozuvni `public/audio/duyo-salom.mp3` ga qo'ying (mp3 yoki m4a, ~1 MB gacha).
Fayl paydo bo'lishi bilan bosh sahifada «DUYO'ni tinglang» tugmasi chiqadi;
robotning o'zini bosish ham ishlaydi. Gapirganda DUYO bir marta qo'l
silkitadi, og'zi ovoz balandligiga qarab ochiladi, ko'zlari porlaydi.
Matnini `src/content.ts` → `DUYO_VOICE.transcript` ga yozsangiz, gapirish
paytida subtitr bo'lib chiqadi. Fayl bo'lmasa tugma ko'rinmaydi.

## Fayllar

| Fayl | Nima |
| --- | --- |
| `src/content.ts` | sahifadagi har bir so'z va havola |
| `src/App.tsx`, `src/ui/*` | sahifa: navbar, bo'limlar, fon rangi, footer |
| `src/scene/director.ts` | scroll → kamera va telefon (sof funksiya) |
| `src/scene/runtime.ts` | sahnani quradi va har kadrda director'ni qo'llaydi |
| `src/scene/robotLife.ts` | DUYO'ning hayoti: qarash, nafas, ko'z qisish, gapirish |
| `src/scene/cosmos*.ts` | koinot: yulduzlar, tumanlik, meteorlar, sichqonchaga javob |
| `src/scene/pointer.ts` | sichqoncha, telefon qiyaligi, reduced motion |
| `src/ui/duyoVoice.ts`, `VoiceButton.tsx` | ovoz: fayl bor-yo'qligi, ijro, balandlik |
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
| Tumanlik yorqinligi | `src/scene/cosmos.ts` → `NEBULA_GAIN` |
| Sichqoncha ortidagi yulduz turkumi | `src/scene/cosmosWeb.ts` |
| Shriftlar | sarlavhalar — Sora (Google Fonts); matn — Inter, `src/assets/fonts/` da o'zimizda (Google'dagi Inter'da `cv08` yo'q: «AI» «Al» bo'lib o'qilardi) |
| DUYO'ning ovozi va subtitri | `public/audio/duyo-salom.mp3`, `content.ts` → `DUYO_VOICE` |
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
- `prefers-reduced-motion` — aylanish, parallaks, meteorlar va animatsiya
  to'xtaydi
- ko'rinmay qolgan matn bosilmaydi; klaviatura fokusi uni ko'rinadigan joyga
  olib keladi

## Huquqiy sahifalar

`public/privacy.html`, `terms.html`, `account-deletion.html` — Google Play aynan
shu manzillarga havola beradi, shuning uchun nomlari o'zgarmasin. Ularda matn
uch tilda (`<article lang="uz|ru|en">`), til almashtirgich `public/legal/legal.js`,
ko'rinishi `public/legal/legal.css`. Matnni o'zgartirsangiz — uchala tilda.
`legal.css`/`legal.js` nomida hash yo'q, nginx esa ularni 30 kun keshlaydi:
ularni o'zgartirganda sahifalardagi `?v=` sanasini ham yangilang.

## Deploy

`main` ga push (faqat `duyo-web/**` o'zgarsa) → GitHub Actions
`.github/workflows/deploy-landing.yml`: `npm ci && npm run build`, bundle'da
huquqiy sahifalar borligini tekshiradi, serverdagi joriy saytni
`/opt/duyo/landing.prev-<vaqt>` ga zaxiralaydi, `dist/` ni `/opt/duyo/landing`
ga chiqaradi va duyo.uz ni tekshiradi. Qo'lda ham ishga tushirsa bo'ladi
(Actions → Deploy landing → Run workflow).

Orqaga qaytarish (serverda):

```bash
ls -d /opt/duyo/landing.prev-*            # oxirgi uchtasi saqlanadi
rsync -a --delete /opt/duyo/landing.prev-<vaqt>/ /opt/duyo/landing/
```

duyo.uz nginx'i qat'iy CSP yuboradi (`default-src 'self'`): sayt hech qanday
tashqi manbadan shrift, skript yoki stil yuklamasligi kerak — hammasi o'zimizda.
