import { useState } from "react";
import { ShieldAlert, AlertTriangle, Eye } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { RISK_STYLES, type RiskLevel, cn } from "@/lib/utils";

interface CrisisEvent {
  id: string;
  level: RiskLevel;
  childAge: number;
  language: string;
  keyword: string;
  score: number;
  parentNotified: boolean;
  officer: string | null;
  status: string;
  createdAt: string;
}

// MOCK — backend (CrisisEvent) ulanmaguncha namuna.
const EVENTS: CrisisEvent[] = [
  { id: "#DUYO-7701", level: "red", childAge: 12, language: "uz", keyword: "o'zimga zarar", score: 0.94, parentNotified: false, officer: null, status: "Yangi", createdAt: "5 daq oldin" },
  { id: "#DUYO-7698", level: "red", childAge: 14, language: "ru", keyword: "yolg'izlik", score: 0.88, parentNotified: false, officer: "Z. Karimova", status: "Ko'rilmoqda", createdAt: "22 daq oldin" },
  { id: "#DUYO-7690", level: "orange", childAge: 10, language: "uz", keyword: "qo'rquv", score: 0.72, parentNotified: true, officer: "Z. Karimova", status: "Eskalatsiya", createdAt: "1 soat oldin" },
  { id: "#DUYO-7682", level: "yellow", childAge: 9, language: "uz", keyword: "achchiqlanish", score: 0.58, parentNotified: true, officer: "A. Yusupov", status: "Hal qilindi", createdAt: "3 soat oldin" },
];

const TABS: { key: RiskLevel; }[] = [{ key: "red" }, { key: "orange" }, { key: "yellow" }, { key: "green" }];

export function SafetyCenter() {
  const [tab, setTab] = useState<RiskLevel | "all">("all");
  const rows = tab === "all" ? EVENTS : EVENTS.filter((e) => e.level === tab);

  return (
    <div>
      <PageHeader
        title="Xavfsizlik markazi"
        subtitle="Real vaqtli nazorat va xavf monitoringi"
        actions={
          <span className="pill bg-urgent-bg text-urgent border border-urgent-line">
            <span className="h-1.5 w-1.5 rounded-full bg-urgent" /> 2 ta faol RED
          </span>
        }
      />

      {/* Abuse-protocol banner — kritik qoida */}
      <div className="mb-5 flex items-start gap-3 rounded-2xl border border-urgent-line bg-urgent-bg p-4">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-urgent" />
        <div className="text-sm text-urgent">
          <span className="font-semibold">Abuse protokoli:</span> Agar ota-ona zarar manbai
          bo'lishi mumkin bo'lsa — ota-onaga avto-xabar YUBORILMAYDI. Hodisa to'g'ridan-to'g'ri
          inson safety review'ga yo'naltiriladi.
        </div>
      </div>

      {/* Risk tabs */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setTab("all")}
          className={cn(
            "rounded-full border px-3 py-1.5 text-sm font-medium",
            tab === "all" ? "border-duyo-blue bg-duyo-50 text-duyo-dark" : "border-line text-muted hover:bg-bg",
          )}
        >
          Barchasi
        </button>
        {TABS.map((tb) => {
          const s = RISK_STYLES[tb.key];
          const active = tab === tb.key;
          return (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key)}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium",
                active ? s.pill : "border-line text-muted hover:bg-bg",
              )}
            >
              <span className={cn("h-2 w-2 rounded-full", s.dot)} />
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Crisis queue table */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-line px-5 py-3">
          <ShieldAlert size={16} className="text-urgent" />
          <h2 className="text-sm font-semibold text-ink">Xavf darajasini ko'rib chiqish</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-muted">
                <th className="px-5 py-3">ID</th>
                <th className="px-3 py-3">Xavf</th>
                <th className="px-3 py-3">Yosh / Til</th>
                <th className="px-3 py-3">Kalit so'z</th>
                <th className="px-3 py-3">Skor</th>
                <th className="px-3 py-3">Ota-ona</th>
                <th className="px-3 py-3">Safety Officer</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Vaqt</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => {
                const s = RISK_STYLES[e.level];
                return (
                  <tr key={e.id} className={cn("border-b border-line/70 last:border-0", s.row)}>
                    <td className="px-5 py-3 font-medium text-ink">{e.id}</td>
                    <td className="px-3 py-3">
                      <span className={cn("pill", s.pill)}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} /> {e.level.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-muted">{e.childAge} / {e.language}</td>
                    <td className="px-3 py-3 text-ink">{e.keyword}</td>
                    <td className="px-3 py-3 font-medium text-ink">{e.score.toFixed(2)}</td>
                    <td className="px-3 py-3">
                      {e.parentNotified ? (
                        <span className="text-xs text-safe">Yuborildi</span>
                      ) : (
                        <span className="text-xs text-urgent">Yuborilmagan</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-muted">{e.officer ?? "—"}</td>
                    <td className="px-3 py-3 text-muted">{e.status}</td>
                    <td className="px-3 py-3 text-xs text-muted">{e.createdAt}</td>
                    <td className="px-3 py-3">
                      <button className="flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-ink hover:border-duyo-blue hover:bg-duyo-50">
                        <Eye size={13} /> Ko'rish
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted">
        Eslatma: xom suhbat kontekstiga faqat Safety Officer roli kira oladi (backend darajasida majburlanadi).
      </p>
    </div>
  );
}
