import type { Language } from '@/api/types';

/**
 * Every user-visible string in the app, keyed by `screen.element`.
 *
 * Uzbek is the source of truth: its keys define the shape, and `Record<Key,
 * string>` on the other two makes a missing Russian or English line a type
 * error rather than a screen that silently falls back to Uzbek.
 *
 * `{placeholder}` slots are filled by the translator in i18n/index.ts.
 */
const UZ = {
  // ── common ──────────────────────────────────────────────────────────────
  'common.continue': 'Davom etish',
  'common.back': 'Orqaga',
  'common.cancel': 'Bekor qilish',
  'common.save': 'Saqlash',
  'common.delete': "O'chirish",
  'common.close': 'Yopish',
  'common.error': 'Xatolik',
  'common.errorGeneric': 'Xatolik yuz berdi',
  'common.sending': 'Yuborilmoqda...',
  'common.saving': 'Saqlanmoqda...',
  'common.retry': 'Qayta urinish',
  'common.comingSoon': 'Tez orada',
  'common.tryLater': "Keyinroq urinib ko'ring.",
  'common.tooManyAttempts.title': "Juda ko'p urinish",
  'common.tooManyAttempts.body': "Bir necha daqiqadan keyin qayta urinib ko'ring.",
  'common.noInternet.title': 'Internet yo‘q',
  'common.noInternet.body': "Aloqani tekshiring va qayta urinib ko'ring.",
  'common.copyright': '© 2026 DUYO. Barcha huquqlar himoyalangan.',

  // ── splash ──────────────────────────────────────────────────────────────
  'splash.tagline': 'Sizning AI hamrohingiz',
  'splash.loadFailed': "Ma'lumotlarni yuklab bo'lmadi. Internetni tekshiring.",

  // ── onboarding: language ────────────────────────────────────────────────
  'onboarding.language.title': 'Tilni tanlang',

  // ── onboarding: user type ───────────────────────────────────────────────
  'onboarding.userType.greeting': 'Salom!',
  'onboarding.userType.question': 'Siz kimsiz?',
  'onboarding.userType.child': 'Men bola',
  'onboarding.userType.childA11y': 'Men bola — bolaning hisobi',
  'onboarding.userType.parent': 'Men ota-ona',
  'onboarding.userType.parentA11y': 'Men ota-ona — ota-onaning hisobi',

  // ── onboarding: phone ───────────────────────────────────────────────────
  'onboarding.phone.title': 'Telefon raqamingiz',
  'onboarding.phone.subtitle': 'Xavfsizlik uchun telefon raqamingizni tasdiqlang',
  'onboarding.phone.label': 'Telefon raqam',
  'onboarding.phone.send': 'SMS yuborish',

  // ── onboarding: otp ─────────────────────────────────────────────────────
  'onboarding.otp.titleDemo': 'Tasdiqlash kodi',
  'onboarding.otp.titleSms': 'SMS kodni kiriting',
  'onboarding.otp.subtitleDemo': '{phone} raqami uchun',
  'onboarding.otp.subtitleSms': '{phone} raqamiga yuborildi',
  'onboarding.otp.demoNotice': 'SMS xizmati hozircha ulanmagan. Kodni kiriting:',
  'onboarding.otp.codeLabel': 'Tasdiqlash kodi',
  'onboarding.otp.verify': 'Tasdiqlash',
  'onboarding.otp.verifying': 'Tekshirilmoqda...',
  'onboarding.otp.resend': 'Qayta yuborish',
  'onboarding.otp.resendIn': 'Qayta yuborish: {seconds} soniya',
  'onboarding.otp.resent': 'SMS qaytadan yuborildi',
  'onboarding.otp.resendFailed': "Qayta yuborib bo'lmadi",
  'onboarding.otp.wrongCode.title': "Noto'g'ri kod",
  'onboarding.otp.wrongCode.body': "Yana urinib ko'ring.",

  // ── onboarding: name ────────────────────────────────────────────────────
  'onboarding.name.title': 'Isming nima?',
  'onboarding.name.subtitle': 'Men seni ismingiz bilan chaqirishni xohlayman',
  'onboarding.name.label': 'Ismingiz',
  'onboarding.name.placeholder': 'Masalan: Aziza',
  'onboarding.name.helper':
    'Ismingiz faqat men bilan suhbatlarda ishlatiladi va xavfsiz saqlanadi',

  // ── onboarding: age ─────────────────────────────────────────────────────
  'onboarding.age.title': 'Necha yoshdasiz?',
  'onboarding.age.subtitle': 'Bu men sizga mos kontentni taqdim etishimga yordam beradi',
  'onboarding.age.decrease': 'Yoshni kamaytirish',
  'onboarding.age.increase': 'Yoshni oshirish',
  'onboarding.age.segment.junior': "Junior - Ko'proq vizual va o'yinlar",
  'onboarding.age.segment.explorer': 'Explorer - Maktab yordami va missiyalar',
  'onboarding.age.segment.companion': "Companion - O'quv va karyera maslahat",

  // ── onboarding: interests ───────────────────────────────────────────────
  'onboarding.interests.title': 'Sizni nima qiziqtiradi?',
  'onboarding.interests.subtitle': 'Kamida {count} ta tanlang',
  'onboarding.interests.selected': '{count} ta tanlandi',
  'onboarding.interests.ready': 'Ajoyib tanlov!',
  'onboarding.interests.drawing': 'Rasm chizish',
  'onboarding.interests.animals': 'Hayvonlar',
  'onboarding.interests.fairyTales': 'Ertaklar',
  'onboarding.interests.space': 'Kosmos',
  'onboarding.interests.superheroes': 'Super qahramonlar',
  'onboarding.interests.games': "O'yinlar",
  'onboarding.interests.music': 'Musiqa',
  'onboarding.interests.nature': 'Tabiat',

  // ── onboarding: avatar ──────────────────────────────────────────────────
  'onboarding.avatar.title': "DUYO'ingizni yarating",
  'onboarding.avatar.subtitle': "O'zingizga yoqqan ko'rinishni tanlang",
  'onboarding.avatar.pick': "O'z DUYO'yingni tanla",
  'onboarding.avatar.bodyDuyo': 'DUYO',
  'onboarding.avatar.bodyRaccoon': 'Yenot',
  'onboarding.avatar.done': "Mening DUYO'im tayyor",

  // ── onboarding: first conversation ──────────────────────────────────────
  'onboarding.firstChat.greeting':
    "Salom! Men DUYO. Endi birga o'rganamiz, suhbatlashamiz va o'samiz. Bugun nima qilmoqchisiz?",
  'onboarding.firstChat.prompt': "Tanlang yoki o'zingiz yozing:",
  'onboarding.firstChat.suggestionStart': 'Boshlaymiz',
  'onboarding.firstChat.suggestionPoem': "Menga she'r o'qib ber",
  'onboarding.firstChat.suggestionMission': "Bugungi missiyani ko'rsat",
  'onboarding.firstChat.suggestionTalk': 'Men bilan gaplash',
  'onboarding.firstChat.skip': "O'tkazib yuborish →",

  // ── settings: root ──────────────────────────────────────────────────────
  'settings.title': 'Sozlamalar',
  'settings.section.general': 'Umumiy',
  'settings.section.safety': 'Xavfsizlik',
  'settings.section.subscription': 'Obuna',
  'settings.section.help': 'Yordam',
  'settings.language': 'Til',
  'settings.darkMode': 'Qorongʻu rejim',
  'settings.notifications': 'Bildirishnomalar',
  'settings.voice': 'Ovoz sozlamalari',
  'settings.memory': 'Mening Xotiram',
  'settings.memoryValue': 'Shu qurilmada',
  'settings.privacy': 'Maxfiylik',
  'settings.parentLink': 'Ota-ona ulanishi',
  'settings.parentLinkConnected': 'Ulangan',
  'settings.plan': 'Obuna rejasi',
  'settings.planValue': "Do'st",
  'settings.help': 'Yordam',
  'settings.logout': 'Chiqish',
  'settings.logoutConfirm': 'Hisobdan chiqishni xohlaysizmi?',

  // ── settings: language ──────────────────────────────────────────────────
  'settings.languageScreen.subtitle': 'Ilova tilini tanlang',
  'settings.languageScreen.hintUz': 'Asosiy til',
  'settings.languageScreen.hintRu': 'Rus tili',
  'settings.languageScreen.hintEn': 'Ingliz tili',

  // ── settings: voice ─────────────────────────────────────────────────────
  'settings.voiceScreen.duyoVoice': 'DUYO ovozi',
  'settings.voiceScreen.speed': 'Gapirish tezligi',
  'settings.voiceScreen.speedSlow': 'Sekin',
  'settings.voiceScreen.speedNormal': 'Normal',
  'settings.voiceScreen.speedFast': 'Tez',
  'settings.voiceScreen.voiceKore': 'Iliq, samimiy ayol ovozi',
  'settings.voiceScreen.voiceAoede': "Yumshoq, o'rgatuvchi ovoz",
  'settings.voiceScreen.voiceCharon': 'Chuqur, jiddiy erkak ovozi',
  'settings.voiceScreen.voiceFenrir': 'Faol, hayajonli ovoz',
  'settings.voiceScreen.voiceLeda': 'Yengil, bolalarbop ovoz',
  'settings.voiceScreen.listen': 'Tinglash',
  'settings.voiceScreen.sampleSoon': "{voice} ovoz namunasi Faza 1'da qo'shiladi",
  'settings.voiceScreen.savedTitle': 'Saqlandi',
  'settings.voiceScreen.savedBody': 'Ovoz sozlamalari yangilandi',

  // ── settings: privacy ───────────────────────────────────────────────────
  'settings.privacyScreen.policyTitle': 'Maxfiylik siyosati',
  'settings.privacyScreen.policyBody':
    "DUYO sizning ma'lumotlaringizni qanday saqlaydi va himoya qilishi haqida ma'lumot.",
  'settings.privacyScreen.readFull': "To'liq matnni o'qish",
  'settings.privacyScreen.readFullA11y': 'Toliq matn',
  'settings.privacyScreen.policySoon': "Maxfiylik siyosati matni Faza 1'da qo'shiladi",
  'settings.privacyScreen.dataSection': "Ma'lumotlar boshqaruvi",
  'settings.privacyScreen.exportLabel': "Ma'lumotlarni eksport qilish",
  'settings.privacyScreen.exportDesc': "Barcha ma'lumotlarni JSON ko'rinishida yuklab oling",
  'settings.privacyScreen.exportBody':
    "Sizning barcha ma'lumotlaringiz JSON formatida emailingizga yuboriladi.",
  'settings.privacyScreen.exportConfirm': "So'rash",
  'settings.privacyScreen.exportSent': 'Yuborildi',
  'settings.privacyScreen.deleteChatsLabel': "Suhbat tarixini o'chirish",
  'settings.privacyScreen.deleteChatsDesc': 'Barcha suhbatlar va xabarlarni tozalash',
  'settings.privacyScreen.deleteChatsTitle': "Suhbatlarni o'chirish",
  'settings.privacyScreen.deleteChatsBody':
    "Barcha suhbatlar tarixi o'chiriladi. Bu amal ortga qaytarib bo'lmaydi.",
  'settings.privacyScreen.deleteChatsDone': 'Suhbatlar tozalandi',
  'settings.privacyScreen.closeAccountLabel': 'Hisobni yopish',
  'settings.privacyScreen.closeAccountDesc': "Hisob va barcha ma'lumotlarni o'chirish",
  'settings.privacyScreen.closeAccountBody':
    "Hisobingiz va barcha ma'lumotlar 30 kun ichida o'chiriladi.",
  'settings.privacyScreen.closeAccountSoon': "Faza 1'da to'liq integratsiya qo'shiladi",

  // ── settings: help ──────────────────────────────────────────────────────
  'settings.helpScreen.faqSection': "Ko'p so'raladigan",
  'settings.helpScreen.q1': 'DUYO nima?',
  'settings.helpScreen.a1':
    "DUYO — bu O'zbek tilida bola bilan suhbatlashadigan, o'rgatadigan va qo'llab-quvvatlaydigan AI hamroh. U mehribon kosmik kashshof sifatida ishlaydi.",
  'settings.helpScreen.q2': 'Suhbat xavfsizmi?',
  'settings.helpScreen.a2':
    "Ha. Suhbatlar shifrlangan, faqat sizning hisobingizdan ko'rish mumkin. Ota-ona ulanmasa, faqat siz va DUYO ko'radi.",
  'settings.helpScreen.q3': 'Kunlik limit qancha?',
  'settings.helpScreen.a3':
    "Bepul rejada kuniga 30 ta suhbat. Premium uchun cheksiz, kelajakda Click/Payme orqali to'lov qo'shiladi.",
  'settings.helpScreen.q4': 'Ovozli suhbat ishlaydimi?',
  'settings.helpScreen.a4':
    'Ha — Suhbat sahifasidagi mikrofon tugmasi ovozli rejimni ochadi. DUYO real vaqtda ovoz bilan javob beradi.',
  'settings.helpScreen.q5': "Ma'lumotlarimni qanday o'chirishim mumkin?",
  'settings.helpScreen.a5':
    "Sozlamalar → Maxfiylik bo'limidan suhbat tarixini yoki hisobni yopishingiz mumkin.",
  'settings.helpScreen.contact': "Bog'lanish",
  'settings.helpScreen.email': 'Email yuborish',
  'settings.helpScreen.emailBody': 'support@duyo.uz manziliga email yozing',
  'settings.helpScreen.telegram': "Telegram qo'llab-quvvatlash",
  'settings.helpScreen.telegramBody':
    "Tez orada Telegram bot qo'llab-quvvatlash qo'shiladi",
} as const;

export type TranslationKey = keyof typeof UZ;

const RU: Record<TranslationKey, string> = {
  // ── common ──────────────────────────────────────────────────────────────
  'common.continue': 'Продолжить',
  'common.back': 'Назад',
  'common.cancel': 'Отмена',
  'common.save': 'Сохранить',
  'common.delete': 'Удалить',
  'common.close': 'Закрыть',
  'common.error': 'Ошибка',
  'common.errorGeneric': 'Произошла ошибка',
  'common.sending': 'Отправка...',
  'common.saving': 'Сохранение...',
  'common.retry': 'Повторить',
  'common.comingSoon': 'Скоро',
  'common.tryLater': 'Попробуйте позже.',
  'common.tooManyAttempts.title': 'Слишком много попыток',
  'common.tooManyAttempts.body': 'Повторите попытку через несколько минут.',
  'common.noInternet.title': 'Нет интернета',
  'common.noInternet.body': 'Проверьте соединение и попробуйте снова.',
  'common.copyright': '© 2026 DUYO. Все права защищены.',

  // ── splash ──────────────────────────────────────────────────────────────
  'splash.tagline': 'Ваш AI-компаньон',
  'splash.loadFailed': 'Не удалось загрузить данные. Проверьте интернет.',

  // ── onboarding: language ────────────────────────────────────────────────
  'onboarding.language.title': 'Выберите язык',

  // ── onboarding: user type ───────────────────────────────────────────────
  'onboarding.userType.greeting': 'Привет!',
  'onboarding.userType.question': 'Кто вы?',
  'onboarding.userType.child': 'Я ребёнок',
  'onboarding.userType.childA11y': 'Я ребёнок — детский аккаунт',
  'onboarding.userType.parent': 'Я родитель',
  'onboarding.userType.parentA11y': 'Я родитель — родительский аккаунт',

  // ── onboarding: phone ───────────────────────────────────────────────────
  'onboarding.phone.title': 'Ваш номер телефона',
  'onboarding.phone.subtitle': 'Подтвердите номер телефона для безопасности',
  'onboarding.phone.label': 'Номер телефона',
  'onboarding.phone.send': 'Отправить SMS',

  // ── onboarding: otp ─────────────────────────────────────────────────────
  'onboarding.otp.titleDemo': 'Код подтверждения',
  'onboarding.otp.titleSms': 'Введите код из SMS',
  'onboarding.otp.subtitleDemo': 'для номера {phone}',
  'onboarding.otp.subtitleSms': 'Отправлено на {phone}',
  'onboarding.otp.demoNotice': 'SMS-сервис пока не подключён. Введите код:',
  'onboarding.otp.codeLabel': 'Код подтверждения',
  'onboarding.otp.verify': 'Подтвердить',
  'onboarding.otp.verifying': 'Проверка...',
  'onboarding.otp.resend': 'Отправить снова',
  'onboarding.otp.resendIn': 'Отправить снова через {seconds} сек',
  'onboarding.otp.resent': 'SMS отправлено повторно',
  'onboarding.otp.resendFailed': 'Не удалось отправить снова',
  'onboarding.otp.wrongCode.title': 'Неверный код',
  'onboarding.otp.wrongCode.body': 'Попробуйте ещё раз.',

  // ── onboarding: name ────────────────────────────────────────────────────
  'onboarding.name.title': 'Как тебя зовут?',
  'onboarding.name.subtitle': 'Я хочу обращаться к тебе по имени',
  'onboarding.name.label': 'Твоё имя',
  'onboarding.name.placeholder': 'Например: Азиза',
  'onboarding.name.helper':
    'Твоё имя используется только в разговорах со мной и хранится безопасно',

  // ── onboarding: age ─────────────────────────────────────────────────────
  'onboarding.age.title': 'Сколько тебе лет?',
  'onboarding.age.subtitle': 'Это поможет мне подобрать подходящий контент',
  'onboarding.age.decrease': 'Уменьшить возраст',
  'onboarding.age.increase': 'Увеличить возраст',
  'onboarding.age.segment.junior': 'Junior — больше картинок и игр',
  'onboarding.age.segment.explorer': 'Explorer — помощь со школой и миссии',
  'onboarding.age.segment.companion': 'Companion — учёба и выбор профессии',

  // ── onboarding: interests ───────────────────────────────────────────────
  'onboarding.interests.title': 'Что тебе интересно?',
  'onboarding.interests.subtitle': 'Выберите минимум {count}',
  'onboarding.interests.selected': 'Выбрано: {count}',
  'onboarding.interests.ready': 'Отличный выбор!',
  'onboarding.interests.drawing': 'Рисование',
  'onboarding.interests.animals': 'Животные',
  'onboarding.interests.fairyTales': 'Сказки',
  'onboarding.interests.space': 'Космос',
  'onboarding.interests.superheroes': 'Супергерои',
  'onboarding.interests.games': 'Игры',
  'onboarding.interests.music': 'Музыка',
  'onboarding.interests.nature': 'Природа',

  // ── onboarding: avatar ──────────────────────────────────────────────────
  'onboarding.avatar.title': 'Создайте своего DUYO',
  'onboarding.avatar.subtitle': 'Выберите внешность, которая вам нравится',
  'onboarding.avatar.pick': 'Выбери своего DUYO',
  'onboarding.avatar.bodyDuyo': 'DUYO',
  'onboarding.avatar.bodyRaccoon': 'Енот',
  'onboarding.avatar.done': 'Мой DUYO готов',

  // ── onboarding: first conversation ──────────────────────────────────────
  'onboarding.firstChat.greeting':
    'Привет! Я DUYO. Теперь мы вместе будем учиться, общаться и расти. Чем займёмся сегодня?',
  'onboarding.firstChat.prompt': 'Выберите или напишите своё:',
  'onboarding.firstChat.suggestionStart': 'Начнём',
  'onboarding.firstChat.suggestionPoem': 'Прочитай мне стихотворение',
  'onboarding.firstChat.suggestionMission': 'Покажи миссию на сегодня',
  'onboarding.firstChat.suggestionTalk': 'Поговори со мной',
  'onboarding.firstChat.skip': 'Пропустить →',

  // ── settings: root ──────────────────────────────────────────────────────
  'settings.title': 'Настройки',
  'settings.section.general': 'Основное',
  'settings.section.safety': 'Безопасность',
  'settings.section.subscription': 'Подписка',
  'settings.section.help': 'Помощь',
  'settings.language': 'Язык',
  'settings.darkMode': 'Тёмная тема',
  'settings.notifications': 'Уведомления',
  'settings.voice': 'Настройки голоса',
  'settings.memory': 'Моя память',
  'settings.memoryValue': 'На этом устройстве',
  'settings.privacy': 'Приватность',
  'settings.parentLink': 'Связь с родителем',
  'settings.parentLinkConnected': 'Подключено',
  'settings.plan': 'Тарифный план',
  'settings.planValue': 'Друг',
  'settings.help': 'Помощь',
  'settings.logout': 'Выйти',
  'settings.logoutConfirm': 'Выйти из аккаунта?',

  // ── settings: language ──────────────────────────────────────────────────
  'settings.languageScreen.subtitle': 'Выберите язык приложения',
  'settings.languageScreen.hintUz': 'Узбекский',
  'settings.languageScreen.hintRu': 'Русский язык',
  'settings.languageScreen.hintEn': 'Английский',

  // ── settings: voice ─────────────────────────────────────────────────────
  'settings.voiceScreen.duyoVoice': 'Голос DUYO',
  'settings.voiceScreen.speed': 'Скорость речи',
  'settings.voiceScreen.speedSlow': 'Медленно',
  'settings.voiceScreen.speedNormal': 'Обычно',
  'settings.voiceScreen.speedFast': 'Быстро',
  'settings.voiceScreen.voiceKore': 'Тёплый, дружелюбный женский голос',
  'settings.voiceScreen.voiceAoede': 'Мягкий, обучающий голос',
  'settings.voiceScreen.voiceCharon': 'Низкий, серьёзный мужской голос',
  'settings.voiceScreen.voiceFenrir': 'Активный, энергичный голос',
  'settings.voiceScreen.voiceLeda': 'Лёгкий, детский голос',
  'settings.voiceScreen.listen': 'Прослушать',
  'settings.voiceScreen.sampleSoon': 'Образец голоса {voice} появится в Фазе 1',
  'settings.voiceScreen.savedTitle': 'Сохранено',
  'settings.voiceScreen.savedBody': 'Настройки голоса обновлены',

  // ── settings: privacy ───────────────────────────────────────────────────
  'settings.privacyScreen.policyTitle': 'Политика конфиденциальности',
  'settings.privacyScreen.policyBody':
    'О том, как DUYO хранит и защищает ваши данные.',
  'settings.privacyScreen.readFull': 'Читать полностью',
  'settings.privacyScreen.readFullA11y': 'Полный текст',
  'settings.privacyScreen.policySoon':
    'Текст политики конфиденциальности появится в Фазе 1',
  'settings.privacyScreen.dataSection': 'Управление данными',
  'settings.privacyScreen.exportLabel': 'Экспорт данных',
  'settings.privacyScreen.exportDesc': 'Скачайте все свои данные в формате JSON',
  'settings.privacyScreen.exportBody':
    'Все ваши данные будут отправлены на вашу почту в формате JSON.',
  'settings.privacyScreen.exportConfirm': 'Запросить',
  'settings.privacyScreen.exportSent': 'Отправлено',
  'settings.privacyScreen.deleteChatsLabel': 'Удалить историю разговоров',
  'settings.privacyScreen.deleteChatsDesc': 'Очистить все разговоры и сообщения',
  'settings.privacyScreen.deleteChatsTitle': 'Удаление разговоров',
  'settings.privacyScreen.deleteChatsBody':
    'Вся история разговоров будет удалена. Это действие необратимо.',
  'settings.privacyScreen.deleteChatsDone': 'Разговоры очищены',
  'settings.privacyScreen.closeAccountLabel': 'Закрыть аккаунт',
  'settings.privacyScreen.closeAccountDesc': 'Удалить аккаунт и все данные',
  'settings.privacyScreen.closeAccountBody':
    'Ваш аккаунт и все данные будут удалены в течение 30 дней.',
  'settings.privacyScreen.closeAccountSoon':
    'Полная интеграция появится в Фазе 1',

  // ── settings: help ──────────────────────────────────────────────────────
  'settings.helpScreen.faqSection': 'Частые вопросы',
  'settings.helpScreen.q1': 'Что такое DUYO?',
  'settings.helpScreen.a1':
    'DUYO — это AI-компаньон, который общается с ребёнком, учит и поддерживает его на узбекском, русском и английском языках. Он ведёт себя как добрый космический исследователь.',
  'settings.helpScreen.q2': 'Безопасны ли разговоры?',
  'settings.helpScreen.a2':
    'Да. Разговоры зашифрованы и доступны только с вашего аккаунта. Пока родитель не подключён, их видите только вы и DUYO.',
  'settings.helpScreen.q3': 'Какой дневной лимит?',
  'settings.helpScreen.a3':
    'На бесплатном тарифе — 30 разговоров в день. На Premium без ограничений, оплата через Click/Payme появится позже.',
  'settings.helpScreen.q4': 'Работает ли голосовой разговор?',
  'settings.helpScreen.a4':
    'Да — кнопка микрофона на странице разговора открывает голосовой режим. DUYO отвечает голосом в реальном времени.',
  'settings.helpScreen.q5': 'Как удалить мои данные?',
  'settings.helpScreen.a5':
    'В разделе Настройки → Приватность можно удалить историю разговоров или закрыть аккаунт.',
  'settings.helpScreen.contact': 'Связаться с нами',
  'settings.helpScreen.email': 'Написать на email',
  'settings.helpScreen.emailBody': 'Напишите на адрес support@duyo.uz',
  'settings.helpScreen.telegram': 'Поддержка в Telegram',
  'settings.helpScreen.telegramBody':
    'Поддержка через Telegram-бота появится совсем скоро',
};

const EN: Record<TranslationKey, string> = {
  // ── common ──────────────────────────────────────────────────────────────
  'common.continue': 'Continue',
  'common.back': 'Back',
  'common.cancel': 'Cancel',
  'common.save': 'Save',
  'common.delete': 'Delete',
  'common.close': 'Close',
  'common.error': 'Error',
  'common.errorGeneric': 'Something went wrong',
  'common.sending': 'Sending...',
  'common.saving': 'Saving...',
  'common.retry': 'Try again',
  'common.comingSoon': 'Coming soon',
  'common.tryLater': 'Please try again later.',
  'common.tooManyAttempts.title': 'Too many attempts',
  'common.tooManyAttempts.body': 'Please try again in a few minutes.',
  'common.noInternet.title': 'No internet',
  'common.noInternet.body': 'Check your connection and try again.',
  'common.copyright': '© 2026 DUYO. All rights reserved.',

  // ── splash ──────────────────────────────────────────────────────────────
  'splash.tagline': 'Your AI companion',
  'splash.loadFailed': "Couldn't load your data. Check your internet.",

  // ── onboarding: language ────────────────────────────────────────────────
  'onboarding.language.title': 'Choose your language',

  // ── onboarding: user type ───────────────────────────────────────────────
  'onboarding.userType.greeting': 'Hi!',
  'onboarding.userType.question': 'Who are you?',
  'onboarding.userType.child': "I'm a kid",
  'onboarding.userType.childA11y': "I'm a kid — a child account",
  'onboarding.userType.parent': "I'm a parent",
  'onboarding.userType.parentA11y': "I'm a parent — a parent account",

  // ── onboarding: phone ───────────────────────────────────────────────────
  'onboarding.phone.title': 'Your phone number',
  'onboarding.phone.subtitle': 'Confirm your phone number to keep the account safe',
  'onboarding.phone.label': 'Phone number',
  'onboarding.phone.send': 'Send SMS',

  // ── onboarding: otp ─────────────────────────────────────────────────────
  'onboarding.otp.titleDemo': 'Verification code',
  'onboarding.otp.titleSms': 'Enter the SMS code',
  'onboarding.otp.subtitleDemo': 'for {phone}',
  'onboarding.otp.subtitleSms': 'Sent to {phone}',
  'onboarding.otp.demoNotice': 'SMS is not connected yet. Enter this code:',
  'onboarding.otp.codeLabel': 'Verification code',
  'onboarding.otp.verify': 'Verify',
  'onboarding.otp.verifying': 'Checking...',
  'onboarding.otp.resend': 'Resend',
  'onboarding.otp.resendIn': 'Resend in {seconds} s',
  'onboarding.otp.resent': 'SMS sent again',
  'onboarding.otp.resendFailed': "Couldn't resend",
  'onboarding.otp.wrongCode.title': 'Wrong code',
  'onboarding.otp.wrongCode.body': 'Please try again.',

  // ── onboarding: name ────────────────────────────────────────────────────
  'onboarding.name.title': "What's your name?",
  'onboarding.name.subtitle': "I'd love to call you by your name",
  'onboarding.name.label': 'Your name',
  'onboarding.name.placeholder': 'For example: Aziza',
  'onboarding.name.helper':
    'Your name is only used in conversations with me and is stored securely',

  // ── onboarding: age ─────────────────────────────────────────────────────
  'onboarding.age.title': 'How old are you?',
  'onboarding.age.subtitle': 'This helps me pick content that fits you',
  'onboarding.age.decrease': 'Decrease age',
  'onboarding.age.increase': 'Increase age',
  'onboarding.age.segment.junior': 'Junior - more visuals and games',
  'onboarding.age.segment.explorer': 'Explorer - school help and missions',
  'onboarding.age.segment.companion': 'Companion - study and career advice',

  // ── onboarding: interests ───────────────────────────────────────────────
  'onboarding.interests.title': 'What are you into?',
  'onboarding.interests.subtitle': 'Pick at least {count}',
  'onboarding.interests.selected': '{count} selected',
  'onboarding.interests.ready': 'Great picks!',
  'onboarding.interests.drawing': 'Drawing',
  'onboarding.interests.animals': 'Animals',
  'onboarding.interests.fairyTales': 'Fairy tales',
  'onboarding.interests.space': 'Space',
  'onboarding.interests.superheroes': 'Superheroes',
  'onboarding.interests.games': 'Games',
  'onboarding.interests.music': 'Music',
  'onboarding.interests.nature': 'Nature',

  // ── onboarding: avatar ──────────────────────────────────────────────────
  'onboarding.avatar.title': 'Create your DUYO',
  'onboarding.avatar.subtitle': 'Pick the look you like',
  'onboarding.avatar.pick': 'Choose your DUYO',
  'onboarding.avatar.bodyDuyo': 'DUYO',
  'onboarding.avatar.bodyRaccoon': 'Raccoon',
  'onboarding.avatar.done': 'My DUYO is ready',

  // ── onboarding: first conversation ──────────────────────────────────────
  'onboarding.firstChat.greeting':
    "Hi! I'm DUYO. From now on we'll learn, talk and grow together. What would you like to do today?",
  'onboarding.firstChat.prompt': 'Pick one or write your own:',
  'onboarding.firstChat.suggestionStart': "Let's start",
  'onboarding.firstChat.suggestionPoem': 'Read me a poem',
  'onboarding.firstChat.suggestionMission': "Show today's mission",
  'onboarding.firstChat.suggestionTalk': 'Talk with me',
  'onboarding.firstChat.skip': 'Skip →',

  // ── settings: root ──────────────────────────────────────────────────────
  'settings.title': 'Settings',
  'settings.section.general': 'General',
  'settings.section.safety': 'Safety',
  'settings.section.subscription': 'Subscription',
  'settings.section.help': 'Help',
  'settings.language': 'Language',
  'settings.darkMode': 'Dark mode',
  'settings.notifications': 'Notifications',
  'settings.voice': 'Voice settings',
  'settings.memory': 'My Memory',
  'settings.memoryValue': 'On this device',
  'settings.privacy': 'Privacy',
  'settings.parentLink': 'Parent connection',
  'settings.parentLinkConnected': 'Connected',
  'settings.plan': 'Subscription plan',
  'settings.planValue': 'Friend',
  'settings.help': 'Help',
  'settings.logout': 'Log out',
  'settings.logoutConfirm': 'Log out of your account?',

  // ── settings: language ──────────────────────────────────────────────────
  'settings.languageScreen.subtitle': 'Choose the app language',
  'settings.languageScreen.hintUz': 'Uzbek',
  'settings.languageScreen.hintRu': 'Russian',
  'settings.languageScreen.hintEn': 'English',

  // ── settings: voice ─────────────────────────────────────────────────────
  'settings.voiceScreen.duyoVoice': "DUYO's voice",
  'settings.voiceScreen.speed': 'Speech speed',
  'settings.voiceScreen.speedSlow': 'Slow',
  'settings.voiceScreen.speedNormal': 'Normal',
  'settings.voiceScreen.speedFast': 'Fast',
  'settings.voiceScreen.voiceKore': 'Warm, friendly female voice',
  'settings.voiceScreen.voiceAoede': 'Soft, teacherly voice',
  'settings.voiceScreen.voiceCharon': 'Deep, serious male voice',
  'settings.voiceScreen.voiceFenrir': 'Lively, energetic voice',
  'settings.voiceScreen.voiceLeda': 'Light voice, great for kids',
  'settings.voiceScreen.listen': 'Play sample',
  'settings.voiceScreen.sampleSoon': 'A {voice} voice sample arrives in Phase 1',
  'settings.voiceScreen.savedTitle': 'Saved',
  'settings.voiceScreen.savedBody': 'Voice settings updated',

  // ── settings: privacy ───────────────────────────────────────────────────
  'settings.privacyScreen.policyTitle': 'Privacy policy',
  'settings.privacyScreen.policyBody':
    'How DUYO stores and protects your data.',
  'settings.privacyScreen.readFull': 'Read the full text',
  'settings.privacyScreen.readFullA11y': 'Full text',
  'settings.privacyScreen.policySoon': 'The privacy policy text arrives in Phase 1',
  'settings.privacyScreen.dataSection': 'Data controls',
  'settings.privacyScreen.exportLabel': 'Export my data',
  'settings.privacyScreen.exportDesc': 'Download all of your data as JSON',
  'settings.privacyScreen.exportBody':
    'All of your data will be emailed to you as JSON.',
  'settings.privacyScreen.exportConfirm': 'Request',
  'settings.privacyScreen.exportSent': 'Sent',
  'settings.privacyScreen.deleteChatsLabel': 'Delete conversation history',
  'settings.privacyScreen.deleteChatsDesc': 'Clear every conversation and message',
  'settings.privacyScreen.deleteChatsTitle': 'Delete conversations',
  'settings.privacyScreen.deleteChatsBody':
    'All conversation history will be deleted. This cannot be undone.',
  'settings.privacyScreen.deleteChatsDone': 'Conversations cleared',
  'settings.privacyScreen.closeAccountLabel': 'Close account',
  'settings.privacyScreen.closeAccountDesc': 'Delete the account and all data',
  'settings.privacyScreen.closeAccountBody':
    'Your account and all data will be deleted within 30 days.',
  'settings.privacyScreen.closeAccountSoon': 'Full integration arrives in Phase 1',

  // ── settings: help ──────────────────────────────────────────────────────
  'settings.helpScreen.faqSection': 'Frequently asked',
  'settings.helpScreen.q1': 'What is DUYO?',
  'settings.helpScreen.a1':
    'DUYO is an AI companion that talks with your child, teaches and supports them in Uzbek, Russian and English. It behaves like a kind cosmic explorer.',
  'settings.helpScreen.q2': 'Are conversations safe?',
  'settings.helpScreen.a2':
    'Yes. Conversations are encrypted and only visible from your account. Until a parent is connected, only you and DUYO can see them.',
  'settings.helpScreen.q3': 'What is the daily limit?',
  'settings.helpScreen.a3':
    'The free plan allows 30 conversations a day. Premium is unlimited; Click/Payme payments arrive later.',
  'settings.helpScreen.q4': 'Does voice chat work?',
  'settings.helpScreen.a4':
    'Yes — the microphone button on the chat screen opens voice mode. DUYO answers out loud in real time.',
  'settings.helpScreen.q5': 'How do I delete my data?',
  'settings.helpScreen.a5':
    'Settings → Privacy lets you clear conversation history or close your account.',
  'settings.helpScreen.contact': 'Contact us',
  'settings.helpScreen.email': 'Send an email',
  'settings.helpScreen.emailBody': 'Write to support@duyo.uz',
  'settings.helpScreen.telegram': 'Telegram support',
  'settings.helpScreen.telegramBody': 'Telegram bot support arrives soon',
};

export const TRANSLATIONS: Record<Language, Record<TranslationKey, string>> = {
  uz: UZ,
  ru: RU,
  en: EN,
};
