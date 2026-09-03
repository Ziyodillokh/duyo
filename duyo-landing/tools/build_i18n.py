"""Generate duyo-landing/assets/i18n.js from strings.json.

Translations are keyed here by a short, unique fragment of the Uzbek source
rather than by the whole string: the page mixes ' and ’ apostrophes, and one
mistyped character would produce a key that silently never matches at runtime.
The script resolves each fragment against the extracted strings and fails loudly
on a fragment that matches nothing or more than one string, so the emitted keys
are always byte-identical to what is in the HTML.
"""

import json
import sys
from pathlib import Path

SP = Path(__file__).resolve().parent
OUT = SP.parent / "assets" / "i18n.js"

# (unique fragment of the Uzbek string, Russian, English)
T = [
    # ---- head / skip link ----
    ("o'smirlar uchun xavfsiz AI hamroh | Ilovani",
     "DUYO — безопасный AI-друг для подростков | Скачать приложение",
     "DUYO — a safe AI companion for teenagers | Download the app"),
    ("Asosiy kontentga",
     "Перейти к основному содержимому",
     "Skip to main content"),

    # ---- platform cards: iOS is not shipped, Android is a direct download ----
    ("iPhone uchun versiya ustida",
     "Работаем над версией для iPhone. Когда будет готова — объявим здесь.",
     "We're working on an iPhone version. We'll announce it here when it's ready."),
    ("Saytimizdan bepul yuklab oling",
     "Скачайте бесплатно с нашего сайта. Подходит для всех Android-телефонов; в Google Play — скоро.",
     "Download it free from our site. Works on any Android phone; coming to Google Play soon."),
    ("Yuklab olish (APK)", "Скачать (APK)", "Download (APK)"),
    ("$Tez orada", "Скоро", "Coming soon"),

    # ---- navbar ----
    ("Imkoniyatlar", "Возможности", "Features"),
    ("Xavfsizlik", "Безопасность", "Safety"),
    ("Ota-onalar uchun", "Родителям", "For parents"),
    ("Narxlar", "Цены", "Pricing"),
    ("FAQ", "Вопросы", "FAQ"),
    ("Yuklab olish", "Скачать", "Download"),

    # ---- hero ----
    ("$13-16 yosh", "На узбекском языке · 13–16 лет", "In Uzbek · ages 13–16"),
    ("Bolangiz uchun xavfsiz AI hamroh",
     "Безопасный AI-друг для вашего ребёнка — общается, обучает и поддерживает. Начните бесплатно на Android.",
     "A safe AI companion for your child — it talks, teaches and supports. Start free on Android."),
    ("Download on the", "Загрузите в", "Download on the"),
    ("GET IT ON", "ДОСТУПНО В", "GET IT ON"),
    ("APK faylni yuklab olish", "Скачать APK-файл (Android)", "Download the APK file (Android)"),
    ("Reklama yo'q", "Без рекламы", "No ads"),
    ("Xavfsizlik filtri", "Фильтр безопасности", "Safety filter"),
    ("Ma'lumotlar himoyalangan", "Данные защищены", "Data protected"),

    # ---- platforms ----
    ("Mos keluvchi platformalar", "Поддерживаемые платформы", "Supported platforms"),
    ("Istagan qurilmangizga",
     "Установите DUYO на любое устройство через официальные магазины приложений",
     "Install DUYO on any device from the official app stores"),
    ("iPhone va iPad", "iPhone и iPad", "iPhone and iPad"),
    ("Sizning qurilmangiz uchun", "Рекомендуется для вашего устройства", "Recommended for your device"),
    ("ridan-to", "Прямая загрузка APK", "Direct APK download"),
    ("Google Play mavjud",
     "Официальный APK-файл для устройств без Google Play. Перед установкой разрешите «Неизвестные источники».",
     "The official APK for devices without Google Play. Allow “Unknown sources” before installing."),
    ("APK yuklab olish", "Скачать APK", "Download APK"),
    ("Faqat rasmiy sayt", "Скачивайте только с официального сайта", "Download only from the official site"),

    # ---- steps ----
    # Qadam tavsiflari va CSS-maket ichidagi matnlar 2026-08-14 da olib
    # tashlandi: bo'lim endi tayyor rasm-kartochkalardan iborat
    # (assets/img/qadam-1..3.png) — sarlavhalargina qoldi.
    ("3 oddiy qadamda", "Начните за 3 простых шага", "Start in 3 simple steps"),
    ("bir necha daqiqada",
     "Ваш ребёнок начнёт пользоваться DUYO за считаные минуты",
     "Your child can be up and running with DUYO in minutes"),
    ("Ilovani yuklab oling", "Скачайте приложение", "Download the app"),
    ("Telefon raqami bilan", "Зарегистрируйтесь по номеру телефона", "Sign up with your phone number"),
    ("DUYO avatarini yarating", "Создайте аватар DUYO для ребёнка", "Create a DUYO avatar for your child"),

    # ---- features ----
    ("Ilovada nima bor", "Что внутри приложения?", "What’s in the app?"),
    ("yin, o'quv va suhbat",
     "Игры, учёба и общение — всё в одном безопасном приложении",
     "Play, learning and conversation — all in one safe app"),
    ("Jonli suhbat", "Живое общение (AI-друг)", "Live chat (AI companion)"),
    ("mos suhbatdosh",
     "Собеседник по возрасту ребёнка: понимает настроение, отвечает на вопросы и всегда остаётся доброжелательным.",
     "A companion suited to your child: it reads their mood, answers their questions and stays warm every time."),
    ("ertaklar kutubxonasi", "Библиотека стихов и сказок", "A library of poems and folk tales"),
    ("mashhur she",
     "Узбекские народные сказки, известные стихи и аудиоверсии. Каждое произведение подбирается по возрасту подростка.",
     "Uzbek folk tales, well-known poems and audio versions. Every piece is chosen for the teenager’s age."),
    ("Dars yordami va til", "Помощь с уроками и языковые игры", "Homework help and language games"),
    ("Uy vazifalarini",
     "Помощь с домашними заданиями и увлекательные игры для изучения английского и русского.",
     "Help with homework, plus playful games for learning English and Russian."),
    ("Tamagochi holati", "Состояние тамагочи", "Tamagotchi status"),
    ("Energiya, o'rganish",
     "Показатели энергии, учёбы, радости и здоровья воспитывают у ребёнка чувство ответственности.",
     "Energy, learning, joy and health meters build a sense of responsibility in the child."),
    ("XP, level va kunlik", "XP, уровни и серия дней", "XP, levels and daily streak"),
    ("Kunlik vazifalarni",
     "За выполнение ежедневных заданий начисляется XP, открываются новые уровни и достижения.",
     "Daily tasks earn XP and unlock new levels and achievements."),
    ("aksessuarlar do", "Магазин аватаров и аксессуаров", "Avatar and accessory shop"),
    ("plangan ballarga",
     "За накопленные баллы для аватара DUYO можно купить шляпы, очки и фоны.",
     "Points earned buy hats, glasses and backgrounds for the DUYO avatar."),

    # ---- safety ----
    # Badge, KPI, grafik va mavzu satrlari 2026-08-14 da olib tashlandi:
    # o'ngdagi dashboard endi tayyor rasm (assets/img/ota-ona-panel.png),
    # maket: section-safety.png.
    ("Ota-onalar uchun tinchlik", "Спокойствие для родителей", "Peace of mind for parents"),
    ("Xavfsizlik ilovaning ichida",
     "Безопасность работает внутри приложения: разговор проверяется на признаки опасности, рекламы нет вообще, а каждое сообщение сверстникам просматривается до отправки.",
     "Safety works inside the app: conversations are screened for signs of risk, there are no ads at all, and every message to another teenager is reviewed before it is sent."),
    ("3 darajali xavfsizlik",
     "Трёхуровневая система безопасности и распознавание кризиса",
     "A three-layer safety system with crisis detection"),
    ("ishonch telefoni darhol",
     "При признаках опасности сразу показывается телефон доверия",
     "The helpline is shown the moment signs of risk appear"),
    ("ma'lumotlar reklama uchun",
     "Рекламы нет, и данные не используются для рекламы",
     "No ads, and no data used for advertising"),
    ("Suhbatlar maxfiy", "Разговоры конфиденциальны и защищены", "Conversations are private and protected"),
    ("Maxfiylik siyosatini o", "Читать политику конфиденциальности", "Read the privacy policy"),

    # ---- age groups ----
    ("Yosh guruhlari uchun moslangan", "Адаптировано под возрастные группы", "Tailored to each age group"),
    ("psixologik xususiyatlarini",
     "Общение разного уровня с учётом психологических особенностей каждого возраста",
     "Conversation pitched to the psychology of each stage of childhood"),
    # Chip'lar 2026-08-14 da olib tashlandi, tavsiflar maketdagi
    # (section-age-segments.png) yangi matnga almashdi.
    ("Explorer (13 yosh", "Explorer (13 лет)", "Explorer (age 13)"),
    ("Darslarga ko",
     "Помощь с уроками, увлекательные языковые игры и проекты для творческого развития.",
     "Help with lessons, engaging language games and projects for creative growth."),
    ("Companion (14-16 yosh", "Companion (14–16 лет)", "Companion (ages 14–16)"),
    ("Kattaroq yoshdagilar",
     "Для старших — надёжный собеседник, аналитическое обучение и практическая помощь с целями на будущее.",
     "For older teens — a trusted companion, analytical learning and hands-on help with future goals."),

    # ---- requirements ----
    ("Tizim talablari", "Системные требования", "System requirements"),
    ("muammosiz ishlashi",
     "Минимальные параметры для стабильной работы приложения DUYO",
     "The minimum a device needs to run DUYO smoothly"),
    ("platformalar bo", "Минимальные системные требования DUYO по платформам",
     "Minimum system requirements for DUYO by platform"),
    ("Platforma", "Платформа", "Platform"),
    ("Tizim talabi", "Требование к системе", "System requirement"),
    ("Xotira", "Память", "Storage"),
    ("Tarmoq", "Сеть", "Network"),
    ("iOS 15.0 yoki", "iOS 15.0 или новее", "iOS 15.0 or later"),
    ("180 MB bo", "~180 МБ свободного места", "~180 MB free space"),
    ("Internet zarur", "Нужен интернет", "Internet required"),
    ("Android 8.0 yoki", "Android 8.0 или новее", "Android 8.0 or later"),
    ("150 MB bo", "~150 МБ свободного места", "~150 MB free space"),
    ("Offline rejimda",
     "* В офлайн-режиме доступна часть функций — сохранённые стихи, сказки и прошлые разговоры.",
     "* Offline mode keeps a limited set of features — saved poems, tales and past conversations."),

    # ---- pricing ----
    ("Narxlar va obuna", "Цены и условия подписки", "Pricing and subscription terms"),
    ("qulay rejani tanlang",
     "Выберите удобный план — изменить или отменить можно в любой момент",
     "Pick the plan that suits you — change or cancel at any time"),
    ("Tanish", "Знакомство — бесплатно", "Discover — Free"),
    ("Sinab ko'rish uchun", "Основные функции, чтобы попробовать", "Core features to try it out"),
    ("so'm", "сум", "UZS"),
    ("doimiy bepul", "всегда бесплатно", "free forever"),
    ("1 til (o", "1 язык (узбекский)", "1 language (Uzbek)"),
    ("20 daqiqa muloqot", "20 минут общения в день", "20 minutes of chat a day"),
    ("Cheklangan kutubxona", "Ограниченная библиотека", "Limited library"),
    ("Boshlash", "Начать", "Get started"),
    ("Ommabop", "Популярный", "Popular"),
    ("Do'st", "Друг", "Friend"),
    ("Kundalik ta", "Оптимальный план для ежедневной учёбы", "The best plan for everyday learning"),
    ("/oy", "/мес", "/mo"),
    ("290 000", "или 290 000 сум/год — 2 месяца в подарок", "or 290,000 UZS/year — 2 months free"),
    ("3 til (o", "3 языка (узбекский, русский, английский)", "3 languages (Uzbek, Russian, English)"),
    ("30 ta AI suhbat", "30 AI-разговоров в день", "30 AI chats a day"),
    ("liq kutubxona va dars", "Полная библиотека и помощь с уроками", "Full library and homework help"),
    ("Gamifikatsiya va", "Геймификация и достижения", "Gamification and achievements"),
    ("Obuna bo", "Оформить подписку", "Subscribe"),
    ("Hamroh", "Спутник", "Companion"),
    ("Butun oila uchun", "Полные возможности для всей семьи", "Everything, for the whole family"),
    ("590 000", "или 590 000 сум/год", "or 590,000 UZS/year"),
    ("200 ta AI suhbat", "200 AI-разговоров в день", "200 AI chats a day"),
    ("Ovozli suhbat", "Голосовое общение", "Voice chat"),
    ("2 ta bola uchun", "Отдельные профили для двух детей", "Separate profiles for two children"),
    ("Premium kontent", "Премиум-контент и аксессуары", "Premium content and accessories"),

    # ---- FAQ ----
    ("so'raladigan savollar", "Часто задаваемые вопросы", "Frequently asked questions"),
    ("Sizni qiziqtirgan",
     "Подробные ответы на волнующие вас вопросы",
     "Detailed answers to the questions you’re asking"),
    ("DUYO bepulmi", "DUYO бесплатный?", "Is DUYO free?"),
    ("asosiy funksiyalari bepul",
     "Да, основные функции DUYO бесплатны. На бесплатном тарифе доступны 20 минут общения в день и часть библиотеки. Для более свободного общения, дополнительных языков и помощи с уроками выберите подписку «Друг» или «Спутник».",
     "Yes — DUYO’s core features are free. The free plan gives you 20 minutes of chat a day and part of the library. For longer conversations, extra languages and homework help, choose the “Friend” or “Companion” subscription."),
    ("Necha yoshdan", "С какого возраста можно пользоваться?", "What age is DUYO for?"),
    ("DUYO 13 yoshdan",
     "DUYO рассчитан на подростков от 13 до 16 лет. При регистрации указывается возраст, и возраст младше 13 не принимается. Приложение автоматически выбирает один из двух режимов: Explorer (13) или Companion (14–16).",
     "DUYO is built for teenagers aged 13 to 16. You give your age at sign-up and anything under 13 is refused. The app then picks one of two modes automatically: Explorer (13) or Companion (14–16)."),
    ("qayerda saqlanadi", "Где хранятся данные?", "Where is the data stored?"),
    ("shifrlangan aloqa orqali",
     "Данные передаются по зашифрованному соединению и хранятся на нашем собственном сервере. Чтобы DUYO мог ответить, текст разговора уходит в Google Gemini, а номер телефона — оператору Eskiz.uz для отправки SMS-кода; больше никому данные не передаются. Мы не продаём их и не используем для рекламы; рекламы в приложении нет вообще.",
     "Data travels over an encrypted connection and is stored on our own server. So that DUYO can reply, the text of the conversation goes to Google Gemini, and your phone number goes to the SMS provider Eskiz.uz for the sign-in code; nobody else receives it. We do not sell it and do not use it for advertising — there are no ads in the app at all."),
    ("Batafsil:", "Подробнее:", "More detail:"),
    ("maxfiylik siyosati", "политика конфиденциальности", "privacy policy"),
    ("Internetsiz ishlaydimi", "Работает ли без интернета?", "Does it work offline?"),
    ("AI suhbat uchun internet",
     "Для общения с AI нужен интернет. Но заранее загруженные стихи, сказки и история разговоров доступны и в офлайн-режиме.",
     "Chatting with the AI needs an internet connection. Poems, tales and conversation history you have already downloaded stay available offline."),
    ("qanday bekor qilaman", "Как отменить подписку?", "How do I cancel my subscription?"),
    ("bekor qilishingiz mumkin",
     "Подписку можно отменить в любой момент — напишите на info@duyo.uz. Все возможности сохраняются до конца оплаченного периода.",
     "You can cancel any time — write to info@duyo.uz. Everything stays available until the end of the paid period."),
    ("Javobini topa",
     "Не нашли ответ? Установите приложение бесплатно и попробуйте сами —",
     "Didn’t find your answer? Install the app free and try it yourself —"),
    ("$ni yuklab olish", "скачать DUYO", "download DUYO"),

    # ---- final CTA ----
    ("Bugun DUYO bilan", "Познакомьтесь с DUYO сегодня", "Meet DUYO today"),
    ("intellekt muhitini",
     "Попробуйте бесплатно безопасную AI-среду для вашего подростка.",
     "Try a safe AI environment for your teenager, free."),
    ("QR kodni telefon",
     "Отсканируйте QR-код камерой телефона и скачайте приложение DUYO",
     "Scan the QR code with your phone camera to download the DUYO app"),
    ("Foydalanish to",
     "Пользование полностью бесплатно, регистрация проста",
     "Completely free to use, signing up is simple"),

    # ---- footer ----
    ("Sayt osti", "Информация в подвале сайта", "Site footer information"),
    ("yoshdagi o'smirlar uchun xavfsiz AI hamroh. O",
     "Безопасный AI-друг для подростков 13–16 лет. Создан на узбекском языке, без рекламы.",
     "A safe AI companion for teenagers aged 13–16. Built in Uzbek, with no ads."),
    ("Mahsulot", "Продукт", "Product"),
    ("Yosh guruhlari", "Возрастные группы", "Age groups"),
    ("Xavfsizlik tizimi", "Система безопасности", "Safety system"),
    ("Maxfiylik siyosati", "Политика конфиденциальности", "Privacy policy"),
    ("Hisobni o'chirish", "Удаление аккаунта", "Delete your account"),
    ("Xavfsizlik va maxfiylik", "Безопасность и конфиденциальность", "Safety and privacy"),
    ("Kompaniya", "Компания", "Company"),
    ("Biz haqimizda", "О нас", "About us"),
    ("Yangiliklar", "Новости", "News"),
    ("Karyera", "Карьера", "Careers"),
    ("Hamkorlik", "Партнёрство", "Partnerships"),
    ("Yordam", "Поддержка", "Support"),
    ("Savol-javob", "Вопросы и ответы", "Q&A"),
    ("Aloqa markazi", "Контакт-центр", "Contact centre"),
    ("Texnik yordam", "Техническая поддержка", "Technical support"),
    ("llanma", "Руководство", "User guide"),
    ("Foydalanish shartlari", "Условия использования", "Terms of use"),
    ("Barcha huquqlar", "XRR. Все права защищены.", "XRR. All rights reserved."),

    # ---- meta / og ----
    ("yoshdagi o'smirlar uchun xavfsiz AI hamroh: suhbatlashadi",
     "DUYO — безопасный AI-друг для подростков 13–16 лет: общается, обучает и поддерживает. Скачайте бесплатно для Android.",
     "DUYO — a safe AI companion for teenagers aged 13–16: it talks, teaches and supports. Free download for Android."),
    ("$AI hamroh",
     "DUYO — безопасный AI-друг для подростков",
     "DUYO — a safe AI companion for teenagers"),
    ("uchun AI hamroh. Reklama",
     "AI-друг для подростков 13–16 лет. Никакой рекламы, на узбекском языке. Начните бесплатно на Android.",
     "An AI companion for teenagers aged 13–16. No ads, in Uzbek. Start free on Android."),

    # ---- aria-labels / alt ----
    ("asosiy navigatsiya", "DUYO — основная навигация", "DUYO — main navigation"),
    ("^DUYO — bosh sahifa", "DUYO — главная страница", "DUYO — home page"),
    ("Asosiy menyu", "Основное меню", "Main menu"),
    ("Interfeys tilini", "Выбор языка интерфейса", "Choose the interface language"),
    ("Menyuni ochish", "Открыть меню", "Open menu"),
    ("Mobil menyu", "Мобильное меню", "Mobile menu"),
    ("suhbat ekrani va bosh sahifa",
     "Приложение DUYO на Android: экран общения и главный экран",
     "The DUYO app on Android: the chat screen and the home screen"),
    
    ("ilovasini App Store", "Скачать приложение DUYO в App Store", "Get the DUYO app on the App Store"),
    ("ilovasini Google Play", "Скачать приложение DUYO в Google Play", "Get the DUYO app on Google Play"),
    ("bosh sahifaga qaytish", "DUYO — вернуться на главную", "DUYO — back to the home page"),
    ("Telegram kanali", "Телеграм-канал DUYO", "DUYO on Telegram"),
    ("Instagram sahifasi", "Инстаграм DUYO", "DUYO on Instagram"),
    ("YouTube kanali", "YouTube-канал DUYO", "DUYO on YouTube"),
    ("Facebook sahifasi", "Фейсбук DUYO", "DUYO on Facebook"),
]

# Blocks whose word order changes with the language, so the whole element is
# swapped rather than the text node inside it. Keyed by data-i18n on the element.
HTML_BLOCKS = {
    "hero.title": {
        "uz": '<span class="sec-hero__brand">DUYO</span>\'ni yuklab oling',
        "ru": 'Скачайте <span class="sec-hero__brand">DUYO</span>',
        "en": 'Download <span class="sec-hero__brand">DUYO</span>',
    },
}

rows = json.loads((SP / "strings.json").read_text(encoding="utf-8"))
texts = [r["text"] for r in rows]


def resolve(frag):
    """A fragment -> the one string it means. '^' anchors the start, '$' the end."""
    if frag.startswith("^"):
        core, hits = frag[1:], [t for t in texts if t.startswith(frag[1:])]
    elif frag.startswith("$"):
        core, hits = frag[1:], [t for t in texts if t.endswith(frag[1:])]
    else:
        core, hits = frag, [t for t in texts if frag in t]
    if len(hits) == 1:
        return hits[0], None
    # Several strings contain the fragment; an exact equality still pins it down.
    exact = [t for t in hits if t == core]
    if len(exact) == 1:
        return exact[0], None
    return None, [h[:60] for h in hits]


ru, en, used, problems = {}, {}, set(), []
for frag, r_ru, r_en in T:
    key, bad = resolve(frag)
    if bad is not None:
        problems.append((frag, bad))
        continue
    if key in used:
        problems.append((frag, ["duplicate mapping for: " + key[:60]]))
        continue
    used.add(key)
    ru[key], en[key] = r_ru, r_en

if problems:
    for frag, hits in problems:
        print(f"AMBIGUOUS/UNMATCHED: {frag!r} -> {len(hits)} hits {hits}", file=sys.stderr)
    sys.exit(1)

missing = [t for t in texts if t not in used]
print(f"translated {len(used)} / {len(texts)}; left as-is: {len(missing)}", file=sys.stderr)
for m in missing:
    print(f"  untranslated: {m[:70]}", file=sys.stderr)

payload = {
    "ru": {"text": ru, "html": {k: v["ru"] for k, v in HTML_BLOCKS.items()}},
    "en": {"text": en, "html": {k: v["en"] for k, v in HTML_BLOCKS.items()}},
    "uz": {"text": {}, "html": {k: v["uz"] for k, v in HTML_BLOCKS.items()}},
}

header = """/* ==========================================================================
   DUYO — sotuv sayti: uz / ru / en tarjimalari
   Bu fayl QO'LDA tahrirlanmaydi — skript bilan generatsiya qilinadi.
   Kalit = index.html dagi o'zbekcha matnning o'zi (aynan, apostrofigacha).
   Kalit topilmasa, matn o'zbekcha qoladi — sayt buzilmaydi.
   ========================================================================== */
window.DUYO_I18N = """

OUT.write_text(
    header + json.dumps(payload, ensure_ascii=False, indent=1) + ";\n",
    encoding="utf-8",
)
print(f"wrote {OUT} ({OUT.stat().st_size // 1024} KB)")
