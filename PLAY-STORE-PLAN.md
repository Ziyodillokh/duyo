# 3-qadam — Google Play rejasi

Sana: 2026-08-29. Manbalar quyida havolalar bilan.

## Xulosa

Ilova **hozirgi holatida production review'dan o'tmaydi**. Uchta to'siq bor,
va uchalasi ham mahsulot qarori. Texnik tayyorgarlik — build, listing,
hujjatlar — bir-ikki kunlik ish; to'siqlar esa nima sotishimizni va kimga
sotishimizni qayta hal qilishni talab qiladi.

Yaxshi xabar: **internal testing** trekiga yuklash uchun to'liq muvofiqlik
shart emas. Build ishlashini erta bilib olish mumkin.

---

## TO'SIQLAR (production uchun, tartib bo'yicha)

### 1. Bolalar o'rtasidagi chat — Maqsaddoshlar

Play Families siyosati ikki narsani aytadi:

> "Adults must approve before children can exchange personal information."

> "Social apps where the main focus of the app is to chat with people they
> do not know or to chat with people anonymously must not target children."

Maqsaddoshlar bolani **notanish bola** bilan umumiy maqsad bo'yicha
juftlashtiradi va taxallus ostida yozishishga ruxsat beradi. Uch kun oldin
ota-ona tarafini olib tashladik — ya'ni **tasdiqlaydigan kattalar yo'q**.

Variantlar:
- **A.** Maqsaddoshlar chatini 13+ ga cheklash va yosh ekrani qo'shish
- **B.** Ota-ona tasdig'ini qaytarish (faqat shu funksiya uchun)
- **C.** Chatni olib tashlash, faqat "bir xil maqsaddagilar" ro'yxatini
  ko'rsatish (yozishuvsiz)
- **D.** Ilovani 13+ deb e'lon qilish — lekin bu butun mahsulot pozitsiyasini
  o'zgartiradi (hozir 7–16)

### 2. To'lovlar Play Billing'dan tashqarida

Play Payments siyosati:

> Ilova ichida iste'mol qilinadigan raqamli obunalar Google Play billing
> tizimidan foydalanishi **shart**, va "leading users to other payment
> methods" — havola, webview, tugma orqali — **taqiqlangan**.

Hozir: `payment.tsx` → backend `checkout` → Click/Payme URL.

"Billing choice" dasturi 2026-yil 30-iyundan boshlab **AQSh, Buyuk Britaniya
va EEA** uchun ochildi — O'zbekiston ro'yxatda yo'q.

Variantlar:
- **A.** Google Play Billing'ni qo'shish (Play'dagi obunalar uchun), Click/Payme
  ni faqat veb-saytda qoldirish
- **B.** Ilovani bepul qilish, obunani faqat duyo.uz da sotish va ilovada
  **umuman eslatmaslik**
- **C.** Play'ga chiqmaslik, APK'ni o'zingiz tarqatish (hozirgi holat)

### 3. Ota-ona roziligi (COPPA)

Families siyosati COPPA'ga muvofiqlikni talab qiladi. COPPA 13 yoshgacha
bo'lgan boladan shaxsiy ma'lumot yig'ishdan oldin **tekshiriladigan ota-ona
roziligini** talab qiladi.

DUYO 7 yoshli boladan yig'adi: telefon raqami, ism, yosh, suhbat matni,
ovoz yozuvi, profil rasmi. Rozilik oqimi yo'q.

Variantlar:
- **A.** Ota-ona rozilik oqimini qaytarish (o'chirgan kodimiz git tarixida bor)
- **B.** Minimal yoshni 13 ga ko'tarish
- **C.** Yosh ekrani: 13 dan kichiklar uchun ota-ona telefoni + tasdiq

---

## BAJARILADIGAN ISHLAR

### 0-bosqich — qarorlar
Yuqoridagi uchta to'siq. Mensiz hal bo'lmaydi.

### 1-bosqich — build (men)
- `bundleRelease` → AAB (hozir `assembleRelease` → APK)
- Alohida **upload keystore**, haqiqiy parollar bilan
  (hozir doimiy kalit `debug.keystore` nomi ostida, Android'ning **ommaviy**
  debug paroli bilan)
- versionCode strategiyasini bittaga keltirish (hozir `run_number` va
  eas.json'dagi `appVersionSource: remote` qarama-qarshi)
- Crash reporting (hozir umuman yo'q)
- Bundle hajmini kamaytirish: ikona 1.16 MB, mascot PNG'lari ~1.5 MB

**Tayyor:** GitHub Actions imzolangan AAB chiqaradi va uni artifact qiladi.

### 2-bosqich — yuridik (men yozaman, siz joylashtirasiz)
- **Maxfiylik siyosati** — hozir `duyo.uz` da havolalar `href="#"`, ya'ni yo'q.
  Bolalar uchun alohida bo'lim shart.
- **Foydalanish shartlari**
- **Akkauntni o'chirish** — Play ikkalasini ham talab qiladi:
  ilova ichida yo'l **va** veb URL. Hozir ikkalasi ham yo'q.
- Landing'dan "Ota-ona paneli" va'dasini olib tashlash — ilovada yo'q
  funksiyani do'kon sahifasida va'da qilish o'z-o'zidan qoida buzilishi

**Tayyor:** uchta URL jonli va Play Console formasiga kiritish mumkin.

### 3-bosqich — Data safety (men javoblarni tayyorlayman)
Har bir maydon kod bo'yicha inventarizatsiya qilinadi: nima yig'iladi, kimga
uzatiladi (Gemini — suhbat va ovoz; Eskiz — SMS; Click/Payme; MinIO),
shifrlanadimi, o'chirish mumkinmi.

**Tayyor:** siz nusxa ko'chirib kiritadigan to'liq javoblar jadvali.

### 4-bosqich — listing (men)
Nom, qisqa va to'liq tavsif (uz/ru/en), skrinshotlar, feature graphic.

### 5-bosqich — internal testing (siz yuklaysiz)
To'liq muvofiqlikni kutmasdan. Build ishlashini bilish uchun.

### 6-bosqich — production review (siz)
Content rating (IARC), target audience deklaratsiyasi, 0-bosqich qarorlari
amalga oshirilgandan keyin.

---

## ALLAQACHON YAXSHI

- **Target API 36** — Expo SDK 56 sukut bo'yicha shuni beradi.
  31-avgustdan yangi ilovalar uchun Android 16 (API 36) talab qilinadi,
  ya'ni ikki kundan keyin. Bizda tayyor.
- Ruxsatlar minimal va oqlangan: `RECORD_AUDIO` (ovozli suhbat),
  `MODIFY_AUDIO_SETTINGS`, `INTERNET`, galereya (profil rasmi).
- Reklama SDK'lari yo'q, reklama identifikatori yo'q — bolalar ilovasi uchun
  bu katta ustunlik.

---

## Manbalar

- [Google Play Families Policies](https://support.google.com/googleplay/android-developer/answer/9893335)
- [Play Payments policy](https://support.google.com/googleplay/android-developer/answer/9858738)
- [Billing choice program](https://support.google.com/googleplay/android-developer/answer/17161464)
- [Target API level requirements](https://support.google.com/googleplay/android-developer/answer/11926878)
- [App account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111)
- [Expo SDK 56 reference](https://docs.expo.dev/versions/v56.0.0/)
