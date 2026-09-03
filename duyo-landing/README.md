# DUYO — sotuv sayti (landing page)

DUYO ilovasini yuklab olish va sotish uchun bir sahifali marketing sayti.
Build tizimi, npm paketlari va framework ishlatilmagan — sof HTML + CSS + JS.

## Ishga tushirish

Hech narsa o'rnatish shart emas — `index.html` faylini brauzerda oching.

Lokal server bilan (tavsiya etiladi, `file://` cheklovlarisiz):

```bash
# Python
python -m http.server 5173

# yoki Node
npx serve .
```

So'ng brauzerda: http://localhost:5173

## Struktura

```
duyo-landing/
├── index.html          # butun sahifa (barcha bo'limlar shu yerda)
├── assets/
│   ├── base.css        # dizayn tokenlari, reset, umumiy komponentlar
│   ├── sections.css    # har bir bo'limning uslublari
│   ├── app.js          # navigatsiya, akkordeon, til, animatsiya
│   ├── i18n.js         # uz/ru/en tarjimalari (generatsiya qilinadi)
│   └── img/
│       ├── logo.png    # navbar/footer belgisi — DUYO roboti
│       └── make-logo.py
├── tools/              # i18n generatorlari (pastdagi "Til" bo'limiga qarang)
└── README.md
```

`base.css` — yagona haqiqat manbai. Brend rangi, radius, soya yoki
tipografiyani o'zgartirmoqchi bo'lsangiz, faqat `:root` bo'limidagi
tokenlarni tahrirlang — butun sayt bo'ylab avtomatik qo'llaniladi.

## Bo'limlar

| # | Bo'lim | Anchor |
|---|--------|--------|
| 1 | Navbar (sticky) | — |
| 2 | Hero — yuklab olish | `#yuklab-olish` |
| 3 | Mos keluvchi platformalar | `#platformalar` |
| 4 | 3 oddiy qadamda boshlang | `#qadamlar` |
| 5 | Ilovada nima bor? | `#imkoniyatlar` |
| 6 | Ota-onalar uchun tinchlik | `#xavfsizlik` |
| 7 | Yosh guruhlari | `#ota-onalar` |
| 8 | Tizim talablari | `#talablar` |
| 9 | Narxlar va obuna | `#narxlar` |
| 10 | Ko'p so'raladigan savollar | `#faq` |
| 11 | Yakuniy CTA | — |
| 12 | Footer | — |

## Ishga tushirishdan oldin almashtirilishi kerak

Quyidagilar hozircha placeholder — real ma'lumot bilan almashtiring:

| Nima | Qayerda | Hozirgi qiymat |
|------|---------|----------------|
| App Store havolasi | `data-store="ios"` bo'lgan barcha havolalar | `#` |
| Google Play havolasi | `data-store="android"` | `#` |
| QR kodlar | hero va CTA bo'limidagi inline SVG | soxta naqsh |
| Aloqa | footer | `support@duyo.uz`, `@duyo_uz` |
| Telefon ekranlari | `assets/img/screen-chat.png`, `screen-home.png` | chizilgan maket |
| OG rasm | `<head>` dagi `og:image` | `assets/og-image.png` (hali yo'q) |
| Domen | `<head>` dagi `og:url` va `canonical` | `https://duyo.uz/` |

### Telefon ekranlariga skrinshot qo'yish

Hero bo'limidagi ikkala telefonda tayyor rasm sloti bor. `assets/img/` papkasiga
`screen-chat.png` va `screen-home.png` fayllarini qo'ysangiz, ular avtomatik
ko'rinadi; fayl bo'lmasa kod bilan chizilgan maket qoladi va sayt buzilmaydi.
Batafsil: [assets/img/README.md](assets/img/README.md).

### Do'kon belgilari haqida

App Store va Google Play ikonkalari rasmiy shakllarda chizilgan. Ishga
tushirishda Apple va Google o'z brend qoidalariga muvofiq **rasmiy badge
fayllarini** ishlatishni talab qiladi:
- Apple: https://developer.apple.com/app-store/marketing/guidelines/
- Google: https://play.google.com/intl/en_us/badges/

Barcha havolalarni bir joydan almashtirish uchun:

```bash
# App Store havolasini almashtirish (misol)
sed -i 's|href="#" data-store="ios"|href="https://apps.apple.com/app/idXXXX" data-store="ios"|g' index.html
```

QR kodni haqiqiy qilish uchun `assets/qr-ios.svg` va `assets/qr-android.svg`
generatsiya qilib, hero va CTA bo'limlaridagi inline SVG'ni almashtiring.

## Til — uz / ru / en

Sayt uch tilda, lekin **bitta `index.html`** da: alohida `/ru` va `/en`
nusxalari yo'q, shuning uchun bo'lim qo'shganda uni bir joyda tahrirlaysiz.

Navbardagi tanlagich tilni almashtiradi, tanlov `localStorage` da saqlanadi
(keyingi tashrifda o'sha tilda ochiladi), va havola orqali ham beriladi:

```
https://duyo.uz/?lang=ru      # reklama havolalari uchun
https://duyo.uz/?lang=en
```

### Qanday ishlaydi

`app.js` sahifadagi barcha matn tugunlarini bir marta yig'adi va til
almashganda joyida almashtiradi. **Lug'at kaliti — o'zbekcha matnning o'zi**
(`assets/i18n.js`), shuning uchun `index.html` ga hech qanday `data-i18n`
kaliti yozish shart emas. Lug'atda topilmagan satr o'zbekcha qolaveradi —
sayt hech qachon buzilmaydi yoki bo'sh joy ko'rsatmaydi.

Bitta istisno: hero sarlavhasi. Unda so'z tartibi tilga qarab o'zgaradi
(`DUYO'ni yuklab oling` → `Скачайте DUYO`), shuning uchun `<h1>` da
`data-i18n="hero.title"` bor va butun ichki HTML almashadi.

Tarjima qilinmaydigan narsalar (shunday bo'lishi kerak): `DUYO`, `App Store`,
`Google Play`, versiya raqamlari, `Click / Payme / Uzcard / Humo / Visa /
Mastercard`, aloqa manzillari va tanlagichdagi til nomlari.

### Matn qo'shganda / o'zgartirganda

`assets/i18n.js` **qo'lda tahrirlanmaydi** — u generatsiya qilinadi:

```bash
cd tools
uv run --no-project python extract_strings.py   # index.html -> strings.json
# build_i18n.py ichidagi T ro'yxatiga yangi satr uchun tarjima qo'shing
uv run --no-project python build_i18n.py        # -> assets/i18n.js
```

`build_i18n.py` dagi kalit — o'zbekcha satrning qisqa, **yagona** bo'lagi
(`^` boshiga, `$` oxiriga bog'laydi). Bo'lak hech nimaga yoki bir nechta
satrga to'g'ri kelsa, skript xato bilan to'xtaydi — bu ataylab: sahifada
`'` va `’` apostroflari aralash, va noto'g'ri terilgan kalit jimgina
ishlamay qo'yardi.

Skript oxirida tarjimasiz qolgan satrlarni sanab beradi — yangi bo'lim
qo'shgandan keyin shu ro'yxatni ko'rib chiqing.

### Hali o'zbekcha qoladigan joy

Hero'dagi QR kartochkasidagi "Telefon kamerasi bilan skanerlang" yozuvi
`assets/img/hero-right.png` rasmiga chizib qo'yilgan — u matn emas, shuning
uchun tarjima qilinmaydi. Ko'p tilli qilish uchun rasmning ru/en
variantlarini tayyorlab, `<img srcset>` yoki `app.js` da `src` almashtirish
kerak bo'ladi.

## APK — "eng oxirgi versiya" havolasi

`data-store="apk"` havolalari **doimiy** manzilga qaraydi:

```
https://admin.duyo.uz/apk/duyo.apk
```

Bu faylni `.github/workflows/build-apk.yml` har bir `duyo-mobile/**` push'ida
qayta quradi va shu manzilga chiqaradi — ya'ni havola hech qachon eskirmaydi va
qo'lda yangilash kerak emas.

Yonidagi `v1.0.0 · 125 MB` yozuvi esa oddiy matn, u eskirishi mumkin edi.
Shuning uchun `data-apk-meta` atributi bilan belgilangan va har deployda
jonli `version.json` dan yangilanadi:

```bash
uv run --no-project python tools/stamp_apk_meta.py           # yangilaydi
uv run --no-project python tools/stamp_apk_meta.py --check   # eskirgan bo'lsa xato beradi
```

Brauzerdan `version.json` ni to'g'ridan-to'g'ri o'qib bo'lmaydi (admin.duyo.uz
CORS sarlavhalarini bermaydi), shuning uchun qiymat deploy paytida muhrlanadi.

## Deploy

`main` ga push → `.github/workflows/deploy-landing.yml` avtomatik ishga tushadi:
APK versiyasini muhrlaydi, so'ng papkani serverdagi `/opt/duyo/landing` ga
rsync qiladi va `https://duyo.uz` ni tekshiradi.

> **Birinchi marta:** nginx `duyo.uz` uchun hali placeholder qaytaradi —
> [duyo-docs/runbooks/landing-nginx.md](../duyo-docs/runbooks/landing-nginx.md)
> dagi bir martalik qadamlarni bajaring.

## Brauzer qo'llab-quvvatlashi

Chrome, Edge, Safari, Firefox — oxirgi 2 versiya. `grid-template-rows: 0fr`
animatsiyasi va `IntersectionObserver` ishlatilgan; eski brauzerlarda
kontent baribir ko'rinadi (animatsiyasiz).

`prefers-reduced-motion` hurmat qilinadi.
