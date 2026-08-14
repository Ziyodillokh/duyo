# Rasmlar papkasi

Bu yerga fayl qo'ysangiz, sayt uni avtomatik ko'rsatadi. Fayl bo'lmasa —
kod bilan chizilgan maket ko'rinaveradi, sayt buzilmaydi.

## Hero bo'limidagi ikkita telefon

| Fayl nomi | Qayerda ko'rinadi | O'lcham |
|-----------|-------------------|---------|
| `screen-chat.png` | Chapdagi ko'k telefon | 390×844 (yoki 1170×2532) |
| `screen-home.png` | O'ngdagi sariq telefon | 390×844 (yoki 1170×2532) |

**Qanday qilish:**

1. Ilovadan skrinshot oling (iPhone'da yon tugma + ovoz balandligi tugmasi).
2. Faylni `screen-chat.png` va `screen-home.png` deb nomlang.
3. Shu papkaga (`assets/img/`) tashlang.
4. Brauzerda **Ctrl+F5** bosing.

Skrinshotning yuqori qismi ko'rinadi (`object-position: top`), pasti telefon
ramkasi ichida qirqiladi — shuning uchun eng muhim kontent yuqorida bo'lsin.

Status bar (soat, batareya) ko'rinib qolmasligi uchun skrinshotning yuqori
~50px'ini kesib tashlash tavsiya etiladi.

## Boshqa formatlar

`.png`, `.jpg`, `.webp` — hammasi ishlaydi. Faqat `index.html` dagi
`src="assets/img/screen-chat.png"` qatorida kengaytmani ham o'zgartiring.

## Qadamlar bo'limi (qadam-1..3.png)

"3 oddiy qadamda boshlang" bo'limidagi uchta kartochka shu papkadagi
`qadam-1.png`, `qadam-2.png`, `qadam-3.png` fayllaridan olinadi. Ular
maket renderidan (`section-steps.png`) piksel aniqligida kesilgan —
uchchalasi **bir xil o'lchamda** (395×239) bo'lishi shart, chunki karta
balandligini rasmning o'z nisbati belgilaydi va farq qilsa kartalar
turli balandlikda chiqadi.

Almashtirish uchun yangi rasmni xuddi shu nom bilan qo'ying (nisbatni
saqlang, kenglik 395px yoki undan katta) va **Ctrl+F5** bosing.

## OG rasm (ijtimoiy tarmoqlarda ulashish uchun)

`og-image.png` — 1200×630. Uni shu papkaga qo'yib, `index.html` dagi
`og:image` manzilini `assets/img/og-image.png` ga o'zgartiring.
