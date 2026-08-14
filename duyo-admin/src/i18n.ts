import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// Faza 0: navigatsiya + umumiy UI satrlari. Modul-ichki satrlar keyin qo'shiladi.
const uz = {
  nav: {
    dashboard: "Boshqaruv paneli",
    safety: "Xavfsizlik markazi",
    peerSafety: "Tengdoshlar xavfsizligi",
    users: "Foydalanuvchilar va oilalar",
    ai: "AI boshqaruvi",
    rag: "RAG bilim bazasi",
    content: "Kontent kutubxonasi",
    gamification: "Avatar va gamifikatsiya",
    parents: "Ota-ona monitoringi",
    monetization: "Monetizatsiya",
    notifications: "Bildirishnomalar",
    analytics: "Tahlil",
    settings: "Tizim sozlamalari",
  },
  common: {
    search: "Qidirish...",
    review: "Ko'rib chiqish",
    approve: "Tasdiqlash",
    reject: "Rad etish",
    publish: "Nashr qilish",
    riskLevel: "Xavf darajasi",
    parentNotified: "Ota-onaga xabar yuborildi",
    citation: "Manba citation",
    reviewStatus: "Review status",
    production: "Production",
    staging: "Staging",
  },
  section: { operations: "Operatsiyalar", safetyContent: "Xavfsizlik & Kontent", growth: "O'sish & Tizim" },
};

const ru = {
  nav: {
    dashboard: "Панель управления",
    safety: "Центр безопасности",
    peerSafety: "Безопасность сверстников",
    users: "Пользователи и семьи",
    ai: "Управление ИИ",
    rag: "База знаний RAG",
    content: "Библиотека контента",
    gamification: "Аватар и геймификация",
    parents: "Родительский мониторинг",
    monetization: "Монетизация",
    notifications: "Уведомления",
    analytics: "Аналитика",
    settings: "Настройки системы",
  },
  common: {
    search: "Поиск...",
    review: "Проверить",
    approve: "Утвердить",
    reject: "Отклонить",
    publish: "Опубликовать",
    riskLevel: "Уровень риска",
    parentNotified: "Родитель уведомлён",
    citation: "Источник",
    reviewStatus: "Статус проверки",
    production: "Production",
    staging: "Staging",
  },
  section: { operations: "Операции", safetyContent: "Безопасность и контент", growth: "Рост и система" },
};

const en = {
  nav: {
    dashboard: "Dashboard",
    safety: "Safety Center",
    peerSafety: "Peer Safety",
    users: "Users & Families",
    ai: "AI Management",
    rag: "RAG Knowledge Base",
    content: "Content Library",
    gamification: "Avatar & Gamification",
    parents: "Parent Monitoring",
    monetization: "Monetization",
    notifications: "Notifications",
    analytics: "Analytics",
    settings: "System Settings",
  },
  common: {
    search: "Search...",
    review: "Review",
    approve: "Approve",
    reject: "Reject",
    publish: "Publish",
    riskLevel: "Risk level",
    parentNotified: "Parent notified",
    citation: "Source citation",
    reviewStatus: "Review status",
    production: "Production",
    staging: "Staging",
  },
  section: { operations: "Operations", safetyContent: "Safety & Content", growth: "Growth & System" },
};

void i18n.use(initReactI18next).init({
  resources: { uz: { translation: uz }, ru: { translation: ru }, en: { translation: en } },
  lng: localStorage.getItem("duyo-admin-lng") || "uz",
  fallbackLng: "uz",
  interpolation: { escapeValue: false },
});

export default i18n;
