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
    ("bolalar uchun xavfsiz AI hamroh | Ilovani",
     "DUYO — безопасный AI-друг для детей | Скачать приложение",
     "DUYO — a safe AI companion for kids | Download the app"),
    ("Asosiy kontentga",
     "Перейти к основному содержимому",
     "Skip to main content"),

    # ---- navbar ----
    ("Imkoniyatlar", "Возможности", "Features"),
    ("Xavfsizlik", "Безопасность", "Safety"),
    ("Ota-onalar uchun", "Родителям", "For parents"),
    ("Narxlar", "Цены", "Pricing"),
    ("FAQ", "Вопросы", "FAQ"),
    ("Yuklab olish", "Скачать", "Download"),

    # ---- hero ----
    ("$7-16 yosh", "На узбекском языке · 7–16 лет", "In Uzbek · ages 7–16"),
    ("Bolangiz uchun xavfsiz AI hamroh",
     "Безопасный AI-друг для вашего ребёнка — общается, обучает и поддерживает. Начните бесплатно на iPhone и Android.",
     "A safe AI companion for your child — it talks, teaches and supports. Start free on iPhone and Android."),
    ("Download on the", "Загрузите в", "Download on the"),
    ("GET IT ON", "ДОСТУПНО В", "GET IT ON"),
    ("APK faylni yuklab olish", "Скачать APK-файл (Android)", "Download the APK file (Android)"),
    ("Reklama yo", "Без рекламы", "No ads"),
    ("Ota-ona nazorati", "Родительский контроль", "Parental controls"),
    ("Ma'lumotlar himoyalangan", "Данные защищены", "Data protected"),

    # ---- platforms ----
    ("Mos keluvchi platformalar", "Поддерживаемые платформы", "Supported platforms"),
    ("Istagan qurilmangizga",
     "Установите DUYO на любое устройство через официальные магазины приложений",
     "Install DUYO on any device from the official app stores"),
    ("iPhone va iPad", "iPhone и iPad", "iPhone and iPad"),
    ("Apple smartfonlari",
     "Полностью оптимизировано для смартфонов и планшетов Apple. Поддерживаются все функции, включая голосовое общение.",
     "Fully optimised for Apple phones and tablets. Every feature, including voice chat, is supported."),
    ("^App Store’dan", "Скачать в App Store", "Download on the App Store"),
    ("Sizning qurilmangiz uchun", "Рекомендуется для вашего устройства", "Recommended for your device"),
    ("Google Play do",
     "Бесплатная и безопасная установка из Google Play. Совместимо со всеми телефонами и планшетами на Android.",
     "A free, safe install from Google Play. Works with every Android phone and tablet."),
    ("^Google Play’dan olish", "Установить из Google Play", "Get it on Google Play"),
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
     "Узбекские народные сказки, известные стихи и аудиоверсии. Каждое произведение подбирается по возрасту ребёнка.",
     "Uzbek folk tales, well-known poems and audio versions. Every piece is chosen for the child’s age."),
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
    ("Biz bolalarning virtual",
     "Мы обеспечиваем полную безопасность ребёнка в цифровом мире. DUYO обеспечивает контроль и высокий уровень защиты с помощью специальных модулей.",
     "We keep children completely safe online. DUYO provides oversight and a high level of protection through dedicated safety modules."),
    ("3 darajali xavfsizlik",
     "Трёхуровневая система безопасности и распознавание кризиса",
     "A three-layer safety system with crisis detection"),
    ("10 kunlik ota-ona", "Родительский отчёт каждые 10 дней", "A parent report every 10 days"),
    ("Reklama va begonalar", "Никакой рекламы и общения с посторонними", "No ads and no contact with strangers"),
    ("Suhbatlar maxfiy", "Разговоры конфиденциальны и защищены", "Conversations are private and protected"),
    ("Ota-ona panelini ko", "Посмотреть родительскую панель", "See the parent dashboard"),
    ("Ota-ona paneli", "Родительская панель", "Parent dashboard"),

    # ---- age groups ----
    ("Yosh guruhlari uchun moslangan", "Адаптировано под возрастные группы", "Tailored to each age group"),
    ("psixologik xususiyatlarini",
     "Общение разного уровня с учётом психологических особенностей каждого возраста",
     "Conversation pitched to the psychology of each stage of childhood"),
    # Chip'lar 2026-08-14 da olib tashlandi, tavsiflar maketdagi
    # (section-age-segments.png) yangi matnga almashdi.
    ("Junior (7-10 yosh", "Junior (7–10 лет)", "Junior (ages 7–10)"),
    ("Kichik yoshdagi bolalar",
     "Для самых младших — простые и наглядные игровые беседы, сказки и безопасная поддержка.",
     "For younger children — simple, visual play-conversations, fairy tales and safe support."),
    ("Explorer (11-13 yosh", "Explorer (11–13 лет)", "Explorer (ages 11–13)"),
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
    ("Qulay to", "Удобные способы оплаты", "Convenient payment methods"),

    # ---- FAQ ----
    ("so'raladigan savollar", "Часто задаваемые вопросы", "Frequently asked questions"),
    ("Sizni qiziqtirgan",
     "Подробные ответы на волнующие вас вопросы",
     "Detailed answers to the questions you’re asking"),
    ("DUYO bepulmi", "DUYO бесплатный?", "Is DUYO free?"),
    ("asosiy funksiyalari bepul",
     "Да, основные функции DUYO бесплатны. На бесплатном тарифе доступны 20 минут общения в день и часть библиотеки. Для более свободного общения, дополнительных языков и помощи с уроками выберите подписку «Друг» или «Спутник».",
     "Yes — DUYO’s core features are free. The free plan gives you 20 minutes of chat a day and part of the library. For longer conversations, extra languages and homework help, choose the “Friend” or “Companion” subscription."),
    ("necha yoshdan", "С какого возраста ребёнок может пользоваться?", "What age is DUYO for?"),
    ("DUYO 7 yoshdan",
     "DUYO рассчитан на детей от 7 до 16 лет. При регистрации указывается возраст, и приложение автоматически выбирает один из трёх режимов: Junior (7–10), Explorer (11–13) или Companion (14–16).",
     "DUYO is designed for children aged 7 to 16. You give the child’s age at sign-up and the app picks one of three modes automatically: Junior (7–10), Explorer (11–13) or Companion (14–16)."),
    ("qayerda saqlanadi", "Где хранятся данные?", "Where is the data stored?"),
    ("Barcha ma'lumotlar shifrlangan",
     "Все данные хранятся в зашифрованном виде и не передаются третьим лицам. Мы не используем детские данные в рекламных целях — рекламы в приложении нет вообще.",
     "All data is stored encrypted and never passed to third parties. We do not use children’s data for advertising — there are no ads in the app at all."),
    ("suhbatlarni ko", "Может ли родитель видеть разговоры?", "Can a parent read the conversations?"),
    ("umumlashtirilgan hisobot",
     "В родительской панели каждые 10 дней показывается сводный отчёт: активность, динамика настроения и обсуждавшиеся темы. Чтобы сохранить доверие ребёнка, разговоры не показываются дословно, но при обнаружении тревожных признаков родитель уведомляется сразу.",
     "The parent dashboard shows a summary every 10 days: activity, mood trend and the topics discussed. To keep the child’s trust, conversations are not shown word for word — but if warning signs appear, the parent is told immediately."),
    ("Internetsiz ishlaydimi", "Работает ли без интернета?", "Does it work offline?"),
    ("AI suhbat uchun internet",
     "Для общения с AI нужен интернет. Но заранее загруженные стихи, сказки и история разговоров доступны и в офлайн-режиме.",
     "Chatting with the AI needs an internet connection. Poems, tales and conversation history you have already downloaded stay available offline."),
    ("qanday bekor qilaman", "Как отменить подписку?", "How do I cancel my subscription?"),
    ("bir marta bosish bilan",
     "Подписку можно отменить в любой момент одним нажатием в разделе «Подписка» в приложении. Все возможности сохраняются до конца оплаченного периода.",
     "You can cancel any time with a single tap in the app’s “Subscription” section. Everything stays available until the end of the paid period."),
    ("Javobini topa",
     "Не нашли ответ? Установите приложение бесплатно и попробуйте сами —",
     "Didn’t find your answer? Install the app free and try it yourself —"),
    ("$ni yuklab olish", "скачать DUYO", "download DUYO"),

    # ---- final CTA ----
    ("Bugun DUYO bilan", "Познакомьтесь с DUYO сегодня", "Meet DUYO today"),
    ("intellekt muhitini",
     "Попробуйте бесплатно безопасную AI-среду для ребёнка и следите за результатами первые 10 дней.",
     "Try a safe AI environment for your child free and follow the results over the first 10 days."),
    ("QR kodni telefon",
     "Отсканируйте QR-код камерой телефона и скачайте приложение DUYO",
     "Scan the QR code with your phone camera to download the DUYO app"),
    ("Foydalanish to",
     "Пользование полностью бесплатно, регистрация проста",
     "Completely free to use, signing up is simple"),

    # ---- footer ----
    ("Sayt osti", "Информация в подвале сайта", "Site footer information"),
    ("yoshdagi bolalar uchun xavfsiz AI hamroh. O",
     "Безопасный AI-друг для детей 7–16 лет. Создан на узбекском языке, под родительским контролем.",
     "A safe AI companion for children aged 7–16. Built in Uzbek, under parental supervision."),
    ("Mahsulot", "Продукт", "Product"),
    ("Yosh guruhlari", "Возрастные группы", "Age groups"),
    ("Xavfsizlik tizimi", "Система безопасности", "Safety system"),
    ("Maxfiylik siyosati", "Политика конфиденциальности", "Privacy policy"),
    ("Foydali maslahatlar", "Полезные советы", "Useful tips"),
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
    ("yoshdagi bolalar uchun xavfsiz AI hamroh: suhbatlashadi",
     "DUYO — безопасный AI-друг для детей 7–16 лет: общается, обучает и поддерживает. Скачайте бесплатно для iPhone и Android.",
     "DUYO — a safe AI companion for children aged 7–16: it talks, teaches and supports. Free download for iPhone and Android."),
    ("$AI hamroh",
     "DUYO — безопасный AI-друг для детей",
     "DUYO — a safe AI companion for kids"),
    ("Ota-ona nazorati, reklama",
     "AI-друг для детей 7–16 лет. Родительский контроль, никакой рекламы, на узбекском языке. Начните бесплатно на iPhone и Android.",
     "An AI companion for children aged 7–16. Parental controls, no ads, in Uzbek. Start free on iPhone and Android."),

    # ---- aria-labels / alt ----
    ("asosiy navigatsiya", "DUYO — основная навигация", "DUYO — main navigation"),
    ("^DUYO — bosh sahifa", "DUYO — главная страница", "DUYO — home page"),
    ("Asosiy menyu", "Основное меню", "Main menu"),
    ("Interfeys tilini", "Выбор языка интерфейса", "Choose the interface language"),
    ("Menyuni ochish", "Открыть меню", "Open menu"),
    ("Mobil menyu", "Мобильное меню", "Mobile menu"),
    ("suhbat ekrani va bosh sahifa",
     "Приложение DUYO на телефонах iPhone и Android: экран общения и главный экран",
     "The DUYO app on iPhone and Android phones: the chat screen and the home screen"),
    ("bolalar faoliyati tahlili",
     "Родительская панель — анализ активности ребёнка",
     "Parent dashboard — a child activity overview"),
    ("Qabul qilinadigan to", "Принимаемые способы оплаты", "Accepted payment methods"),
    ("ilovasini App Store", "Скачать приложение DUYO в App Store", "Download the DUYO app on the App Store"),
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
