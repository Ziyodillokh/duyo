import { useTranslation } from "react-i18next";
import { Search, Bell, LogOut } from "lucide-react";
import i18n from "@/i18n";
import { useAuth } from "@/auth/AuthContext";
import { ROLE_LABELS } from "@/api/admin";

const LOCALES = ["uz", "ru", "en"] as const;

export function Topbar() {
  const { t } = useTranslation();
  const { admin, logout } = useAuth();
  const name = admin?.full_name || admin?.email?.split("@")[0] || "Admin";
  const roleLabel = admin ? ROLE_LABELS[admin.role] : "";

  const setLng = (lng: string) => {
    localStorage.setItem("duyo-admin-lng", lng);
    void i18n.changeLanguage(lng);
  };

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-line bg-surface px-6">
      {/* Search */}
      <div className="relative max-w-md flex-1">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="search"
          placeholder={t("common.search")}
          className="w-full rounded-xl border border-line bg-bg py-2 pl-9 pr-3 text-sm outline-none focus:border-duyo-blue"
        />
      </div>

      <div className="flex items-center gap-3">
        {/* Environment badge */}
        <span className="pill bg-warn-bg text-warn border border-warn-line">
          {t("common.staging")}
        </span>

        {/* Locale switch */}
        <div className="flex overflow-hidden rounded-lg border border-line text-xs">
          {LOCALES.map((lng) => (
            <button
              key={lng}
              onClick={() => setLng(lng)}
              className={
                "px-2 py-1 uppercase " +
                (i18n.language === lng ? "bg-duyo-blue text-white" : "text-muted hover:bg-bg")
              }
            >
              {lng}
            </button>
          ))}
        </div>

        {/* Notifications */}
        <button className="relative rounded-lg p-2 text-muted hover:bg-bg" aria-label="Bildirishnomalar">
          <Bell size={18} />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-urgent" />
        </button>

        {/* Profile + role */}
        <div className="flex items-center gap-2 border-l border-line pl-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-duyo-100 text-sm font-semibold uppercase text-duyo-dark">
            {name.charAt(0)}
          </div>
          <div className="leading-tight">
            <div className="text-sm font-medium text-ink">{name}</div>
            <div className="text-[11px] text-muted">{roleLabel}</div>
          </div>
          <button
            onClick={logout}
            className="ml-1 rounded-lg p-2 text-muted hover:bg-bg hover:text-urgent"
            aria-label="Chiqish"
            title="Chiqish"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
