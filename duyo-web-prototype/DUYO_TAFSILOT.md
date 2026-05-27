# DUYO - AI Companion for Children

## Umumiy ma'lumot

DUYO - 7-16 yoshdagi bolalar uchun AI virtual hamroh ilovasi. Ilova do'stona suhbat sherigi, o'qituvchi, hissiy yordam beruvchi va tamagochi uslubidagi xarakter sifatida ishlaydi.

## Yaratilgan komponentlar va sahifalar

### 1. Dizayn tizimi
- ✅ DUYO rang palitrasi (ko'k, sariq, yashil ranglar)
- ✅ Tailwind CSS v4 konfiguratsiyasi
- ✅ CSS o'zgaruvchilar va tokenlar
- ✅ Radix UI komponentlari (Button, Card, Badge, va boshqalar)

### 2. DUYO Avatar komponenti
- ✅ Turli holatlar: idle, talking, thinking, sleeping, happy, sad, celebrating, crisis-support
- ✅ 3 xil tana shakli: sharsimon, kubik, vertikal
- ✅ 12 ta asosiy rang
- ✅ 8 ta aksent rang
- ✅ Animatsiya va o'tishlar

### 3. Onboarding oqimi (8 ta sahifa)
1. ✅ Splash Screen - kirish sahifasi
2. ✅ Til tanlash (O'zbek, Русский, English)
3. ✅ Foydalanuvchi turi (Bola / Ota-ona)
4. ✅ Telefon autentifikatsiyasi (SMS kod)
5. ✅ Bolaning ismini kiritish
6. ✅ Yosh tanlash (7-16, avtomatik segment)
7. ✅ Qiziqishlarni tanlash (yoshga moslashtirilgan)
8. ✅ Avatar yaratish (sozlamalari bilan)

### 4. Bolalar ilovasi (asosiy 5 ta bo'lim)

#### Home (Bosh sahifa)
- ✅ Salom xabari
- ✅ DUYO avatar katta ko'rinishda
- ✅ 4 ta tamagochi holat ko'rsatkichlari (Energiya, O'rganish, Quvonch, Sog'liq)
- ✅ XP/level kartasi
- ✅ Seriya kartasi
- ✅ Bugungi missiya
- ✅ Tez harakatlar (4 ta tugma)

#### Chat (Suhbat)
- ✅ DUYO bilan jonli suhbat
- ✅ Xabar yozish va yuborish
- ✅ Ovozli kirish tugmasi
- ✅ Kunlik limit ko'rsatkichi (18/30)
- ✅ DUYO "o'ylayapti" holati
- ✅ Tavsiya etilgan javoblar

#### Library (Kutubxona)
- ✅ She'rlar bo'limi (audio bilan)
- ✅ Ertaklar bo'limi
- ✅ Dars yordami bo'limi
- ✅ Til o'yinlari
- ✅ Qidiruv funksiyasi
- ✅ Yoshga moslashtirilgan kontent

#### Profile (Profil)
- ✅ Foydalanuvchi ma'lumotlari
- ✅ Level va XP progressi
- ✅ Seriya ko'rsatkichi
- ✅ Haftalik faollik grafigi
- ✅ Yutuqlar (achievements)
- ✅ Premium'ga o'tish tugmasi

#### Inventory (Inventar)
- ✅ Ball balansi
- ✅ Aksessuarlar do'koni (shlyapa, ko'zoynak, antenna, fon)
- ✅ Egallik holati
- ✅ Mavsumiy buyumlar (Navro'z, Yangi yil)
- ✅ Premium buyumlar

### 5. Qo'shimcha bolalar sahifalari
- ✅ Subscription (Obuna) - 3 ta reja bilan (Free, Standard, Premium)
- ✅ Settings (Sozlamalar) - til, bildirishnomalar, maxfiylik
- ✅ Streak Screen - seriya tafsilotlari va milestone'lar
- ✅ Poem Detail - she'r matni, audio, mashq qilish

### 6. Krizis va xavfsizlik
- ✅ 3 darajali krizis UI (Yellow, Orange, Red)
- ✅ Tinch va qo'rqitmaydigan dizayn
- ✅ Yordam tugmalari
- ✅ Favqulodda raqamlar
- ✅ Maxfiylik eslatmalari

### 7. Maxsus holatlar
- ✅ Offline rejimi (internet yo'q)
- ✅ Tungi rejim (22:00-06:00 DUYO uxlaydi)
- ✅ Yuklanish holatlari
- ✅ Xato holatlari

### 8. Ota-ona veb paneli
- ✅ 10 kunlik hisobot dashboard
- ✅ Bola faolligi statistikasi
- ✅ Kayfiyat tendensiyasi
- ✅ Muhokama qilingan mavzular
- ✅ O'rganish jarayoni
- ✅ Xavfsizlik holati
- ✅ Maxfiylik haqida eslatma

### 9. Admin veb paneli
- ✅ Admin dashboard (DAU, MAU, revenue)
- ✅ Krizis hodisalar ro'yxati (ustuvor)
- ✅ Foydalanuvchilar ro'yxati
- ✅ Tizim salomatligi
- ✅ Crisis Event Detail sahifasi
  - Voqea tarixi
  - AI baholash
  - Kalit so'zlar
  - Xavfsizlik xodimi izohlari
  - Qaror qabul qilish tugmalari

### 10. Navigatsiya
- ✅ React Router 7 integratsiyasi
- ✅ Pastki navigatsiya (5 ta tab)
- ✅ Barcha routing yo'llar sozlangan
- ✅ UserContext provider

## Texnik xususiyatlar

### Ishlatilgan texnologiyalar
- React 18.3.1
- TypeScript
- React Router 7
- Tailwind CSS v4
- Radix UI komponentlari
- Lucide React (ikonlar)
- Motion (animatsiyalar)

### Rang palitrasi
- Asosiy ko'k: #2563EB
- Chuqur havo rangi: #102033
- Yulduz sariq: #FFC700
- Yumshoq osmon: #F4F8FF
- Muvaffaqiyat yashil: #22C55E
- Ogohlantirish sariq: #FACC15
- Krizis qizil: #EF4444

### Yoshga moslashgan variantlar
1. **Junior (7-10 yosh)**
   - Ko'proq vizual va audio
   - Katta tugmalar
   - Oddiy so'zlar
   - Rangli, do'stona UI

2. **Explorer (11-13 yosh)** ⭐ Asosiy dizayn uslubi
   - Muvozanatli vizual + matn
   - Maktab yordam, missiyalar
   - Gamifikatsiya
   - Til o'yinlari

3. **Companion (14-16 yosh)**
   - Yetuk va o'quv-murabbiy uslubida
   - Kamroq bolalarcha, kamroq emojilar
   - DTM, IELTS/TOEFL tayyorgarlik
   - Tozaroq va professional vizual ohang

## Xavfsizlik xususiyatlari

1. ✅ 3 darajali krizis aniqlash (Yellow, Orange, Red)
2. ✅ Tinch, qo'rqitmaydigan krizis UI
3. ✅ Ota-onaga avtomatik xabar
4. ✅ Favqulodda yordam raqamlari
5. ✅ Maxfiylik kafolatlari
6. ✅ Suhbatlarning maxfiy saqlanishi

## Gamifikatsiya

- ✅ XP tizimi
- ✅ 6 ta level (Tanish, Do'st, Sirdosh, Hamroh, Hamfikr, Yulduz)
- ✅ Kunlik seriya (streak)
- ✅ Yutuqlar (achievements)
- ✅ Inventar va aksessuarlar
- ✅ Kunlik missiyalar
- ✅ Ball tizimi

## Obuna rejalari

1. **Tanish (Free)**
   - 1 til
   - Faqat skript javoblar
   - 20 daqiqa/kun
   - Cheklangan kontent

2. **Do'st (Standard)**
   - 29,000 so'm/oy yoki 290,000 so'm/yil
   - 3 til
   - AI 30 suhbat/kun
   - To'liq gamifikatsiya

3. **Hamroh (Premium)**
   - 59,000 so'm/oy yoki 590,000 so'm/yil
   - AI suhbat - kuniga 200 ta
   - Ovozli suhbat
   - 2 ta bola
   - Premium kontent

## To'lov usullari
- Click
- Payme
- Uzcard
- Humo
- Visa/Mastercard

## Yaratilgan fayllar soni

Jami **35+** komponent va sahifa yaratildi:
- 8 ta onboarding sahifa
- 15+ bolalar ilovasi sahifasi
- 2 ta ota-ona sahifasi
- 2 ta admin sahifasi
- 5+ umumiy komponent va holatlar
- 3+ xavfsizlik sahifasi

## Keyingi bosqichlar (majburiy emas)

Quyidagi qo'shimcha sahifalar va funksiyalarni qo'shish mumkin:
- DTM/IELTS practice sahifalari
- Ovozli suhbat funksiyasi
- Ota-ona sozlamalari sahifasi
- Admin kontent boshqaruv sahifalari
- Analytics dashboard
- Bildirishnomalar tizimi
- Real-time suhbat (WebSocket)
- Backend integratsiyasi

## Muhim eslatmalar

1. **Barcha sahifalar mobil-birinchi** dizaynga ega (390×844)
2. **Accessibility** e'tiborga olingan (katta tugmalar, yaxshi kontrast)
3. **Xavfsizlik** ustuvor (tinch krizis UI, maxfiylik)
4. **Manipulyativ emas** (seriya yo'qotish ayblov bermayd)
5. **Foydalanuvchi tajaribasi** optimallashtirilgan
6. **O'zbek tili** asosiy til sifatida qo'llanilgan

---

**Yaratildi:** 2026-05-26
**Versiya:** 1.0.0
**Holat:** To'liq prototype tayyor
