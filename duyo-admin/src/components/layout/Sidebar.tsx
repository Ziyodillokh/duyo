import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ShieldCheck } from "lucide-react";
import { NAV } from "@/config/nav";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const { t } = useTranslation();
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-line bg-surface">
      {/* Brand */}
      <div className="flex h-16 items-center gap-2 border-b border-line px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-duyo-blue text-white">
          <ShieldCheck size={18} />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-bold text-ink">DUYO</div>
          <div className="text-[11px] text-muted">Admin Panel</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV.map((section) => (
          <div key={section.titleKey} className="mb-5">
            <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
              {t(`section.${section.titleKey}`)}
            </div>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isSafety = item.key === "safety";
                return (
                  <li key={item.key}>
                    <NavLink
                      to={item.path}
                      end={item.path === "/"}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                          isActive
                            ? "bg-duyo-50 text-duyo-dark"
                            : "text-ink/70 hover:bg-bg hover:text-ink",
                        )
                      }
                    >
                      <Icon size={18} className={cn(isSafety && "text-urgent")} />
                      <span className="flex-1">{t(`nav.${item.key}`)}</span>
                      {isSafety && (
                        <span className="h-2 w-2 rounded-full bg-urgent" aria-hidden />
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-line px-4 py-3 text-[11px] text-muted">
        v0.1 · Faza 0 (shell)
      </div>
    </aside>
  );
}
