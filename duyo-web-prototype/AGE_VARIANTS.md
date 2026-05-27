# DUYO - Yoshga qarab variantlar

## 🎯 Uchta alohida Home sahifa

DUYO ilovasi bolaning yoshiga qarab 3 xil Home sahifani ko'rsatadi:

---

## 1️⃣ Junior Home (7-10 yosh) 🎨

**Maqsad:** Ko'proq vizual, oson va qiziqarli

### Dizayn xususiyatlari:
- ✅ **Rangli gradient fonlar** (purple, pink, blue)
- ✅ **Katta emojilar** (👋 🎨 📚 🎵 🎮)
- ✅ **Juda katta tugmalar** (h-16, text-xl)
- ✅ **4 xil rang'li tamagochi ko'rsatkichlar**
- ✅ **Oddiy til** va kam matn
- ✅ **Katta DUYO avatar** (xl size)
- ✅ **Animatsiyalar** (bounce, pulse)
- ✅ **Rangli kartalar** (border-4, gradient backgrounds)

### Asosiy elementlar:
- 👋 Katta salomlashish emoji
- ⚡ Tamagochi holati (emoji + rang'li progress bar)
- 🔥 Seriya (katta raqamlar va emojilar)
- 🎯 Bugungi vazifa (oddiy, bir marta)
- 🎨 4 ta katta faoliyat tugmalari
- ⭐ XP progress (katta va rangli)
- 🌟 Motivatsion xabar

### Rang palitrasi:
- Purple: `from-purple-400 to-pink-400`
- Blue: `from-blue-400 to-cyan-400`
- Green: `from-green-400 to-emerald-400`
- Orange: `from-orange-400 to-red-400`

---

## 2️⃣ Explorer Home (11-13 yosh) 📚

**Maqsad:** Muvozanatli, asosiy dizayn

### Dizayn xususiyatlari:
- ✅ **Muvozanatli vizual + matn**
- ✅ **O'rtacha o'lchamli komponentlar**
- ✅ **Gamifikatsiya fokus** (XP, level, streak)
- ✅ **Missiyalar va topshiriqlar**
- ✅ **4 ta tamagochi holat**
- ✅ **Tez harakatlar** (quick actions)

### Asosiy elementlar:
- Salom xabari
- DUYO avatar (xl size)
- Tamagochi holatlari (4 ta)
- XP/Level kartasi
- Seriya kartasi
- Bugungi missiya
- 4 ta tez harakat

### Bu asosiy/default dizayn!

---

## 3️⃣ Companion Home (14-16 yosh) 🎓

**Maqsad:** Professional, maqsadga yo'naltirilgan

### Dizayn xususiyatlari:
- ✅ **Minimal va professional**
- ✅ **DTM/IELTS fokus**
- ✅ **Statistika va progress tracking**
- ✅ **Maqsadlar va reja**
- ✅ **Fokus rejimi**
- ✅ **Haftalik progress**
- ✅ **Kamroq rang, ko'proq ma'lumot**

### Asosiy elementlar:
- 📊 4 ta statistika (DTM, IELTS, Fokus, Streak)
- 🎯 Bugungi maqsadlar (progress bars)
- 📈 Haftalik fokus (soatlar)
- 🚀 4 ta quick action (DTM, IELTS, Dars, Karyera)
- ⏰ Fokus timer (25 min)
- 📅 Haftalik calendar
- 🧠 Motivatsion quote

### Professional elementlar:
- Grid layoutlar
- Progress tracking
- Time management
- Study statistics
- Career guidance

### Rang palitrasi:
- Slate-50 to blue-50 (minimal fon)
- Blue, Green, Purple, Orange (accent ranglar)
- Professional iconlar (Target, Globe, Briefcase, Brain)

---

## 🔄 Avtomatik tanlash

ChildHome komponenti avtomatik ravishda yoshni aniqlaydi va to'g'ri variantni yuklaydi:

```typescript
const ageSegment = localStorage.getItem('ageSegment');

if (ageSegment === 'junior') return <JuniorHome />;
if (ageSegment === 'companion') return <CompanionHome />;
// Default: Explorer Home
```

---

## 📊 Taqqoslash jadvali

| Xususiyat | Junior (7-10) | Explorer (11-13) | Companion (14-16) |
|-----------|---------------|------------------|-------------------|
| **Emojilar** | Juda ko'p (6+) | O'rtacha (2-3) | Kam (1-2) |
| **Tugma o'lchami** | Juda katta (h-16) | Katta (h-14) | O'rtacha (h-12) |
| **Matn** | Minimal | Muvozanatli | Ko'proq |
| **Ranglar** | Juda rangli | Rangli | Minimal |
| **Fokus** | O'yin va qiziqish | Gamifikatsiya | Maqsad va natija |
| **Tamagochi** | Katta, rangli | O'rtacha | Yo'q |
| **DTM/IELTS** | Yo'q | Yo'q | Asosiy |
| **Karyera** | Yo'q | Yo'q | Ha |
| **Fokus timer** | Yo'q | Yo'q | Ha |
| **Statistika** | Oddiy | O'rtacha | Batafsil |

---

## 🎨 Dizayn qoidalari

### Junior uchun:
- Har doim emojilardan foydalaning
- Katta tugmalar va matnlar
- Ko'p ranglar va gradientlar
- Animatsiyalar qo'shing
- Oddiy til ishlatting
- Vizual feedback ko'rsating

### Explorer uchun:
- Muvozanatli dizayn
- Gamifikatsiyaga e'tibor
- Missiya va topshiriqlar
- XP va level tizimi
- Qiziqarli lekin struktura

### Companion uchun:
- Professional va tozaroq
- Maqsadga yo'naltirilgan
- Statistika va progress
- DTM/IELTS fokus
- Time management
- Karyera maslahat

---

## 📱 Routing

```
/child/home → Avtomatik age detection
/child/home/junior → Junior variant (to'g'ridan-to'g'ri)
/child/home/companion → Companion variant (to'g'ridan-to'g'ri)
```

---

## ✅ Tayyor holat

Barcha 3 ta variant to'liq yaratildi va ishlaydi!

- ✅ JuniorHome.tsx (7-10 yosh)
- ✅ ChildHome.tsx (11-13 yosh, default)
- ✅ CompanionHome.tsx (14-16 yosh)

**Yaratilgan:** 2026-05-26  
**Holat:** ✅ Production-ready
