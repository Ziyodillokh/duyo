import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldAlert, AlertTriangle, Eye, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { RISK_STYLES, type RiskLevel, cn } from "@/lib/utils";
import { adminApi, type CrisisEventRow, type CrisisLevel } from "@/api/admin";

const TABS: { key: RiskLevel }[] = [{ key: "red" }, { key: "orange" }, { key: "yellow" }, { key: "green" }];

function timeAgo(iso: string): string {
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return "hozir";
  if (diffMin < 60) return `${diffMin} daq oldin`;
  const h = Math.round(diffMin / 60);
  if (h < 24) return `${h} soat oldin`;
  return `${Math.round(h / 24)} kun oldin`;
}

export function SafetyCenter() {
  const [tab, setTab] = useState<RiskLevel | "all">("all");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["safety-events", tab],
    queryFn: () => adminApi.safetyEvents(tab === "all" ? undefined : (tab.toUpperCase() as CrisisLevel)),
  });
  const rows: CrisisEventRow[] = data ?? [];
  const activeRed = rows.filter((r) => r.level === "RED").length;

  return (
    <div>
      <PageHeader
        title="Xavfsizlik markazi"
        subtitle="Real vaqtli nazorat va xavf monitoringi"
        actions={
          activeRed > 0 ? (
            <span className="pill bg-urgent-bg text-urgent border border-urgent-line">
              <span className="h-1.5 w-1.5 rounded-full bg-urgent" /> {activeRed} ta faol RED
            </span>
          ) : undefined
        }
      />

      {/* Abuse-protocol banner */}
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

      {/* Crisis queue */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-line px-5 py-3">
          <ShieldAlert size={16} className="text-urgent" />
          <h2 className="text-sm font-semibold text-ink">Xavf darajasini ko'rib chiqish</h2>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted">
            <Loader2 size={16} className="animate-spin" /> Yuklanmoqda...
          </div>
        ) : isError ? (
          <div className="p-12 text-center text-sm text-urgent">
            {(error as Error).message}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted">Hodisalar topilmadi.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-muted">
                  <th className="px-5 py-3">ID</th>
                  <th className="px-3 py-3">Xavf</th>
                  <th className="px-3 py-3">Manba</th>
                  <th className="px-3 py-3">Kalit so'z</th>
                  <th className="px-3 py-3">Til</th>
                  <th className="px-3 py-3">Ota-ona</th>
                  <th className="px-3 py-3">Vaqt</th>
                  <th className="px-3 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => {
                  const level = e.level.toLowerCase() as RiskLevel;
                  const s = RISK_STYLES[level];
                  const match = e.matches?.[0];
                  return (
                    <tr key={e.id} className={cn("border-b border-line/70 last:border-0", s.row)}>
                      <td className="px-5 py-3 font-medium text-ink">#{e.id.slice(0, 8)}</td>
                      <td className="px-3 py-3">
                        <span className={cn("pill", s.pill)}>
                          <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} /> {e.level}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-muted">L{e.layer}</td>
                      <td className="px-3 py-3 text-ink">{match?.keyword ?? "—"}</td>
                      <td className="px-3 py-3 text-muted">{match?.language ?? "—"}</td>
                      <td className="px-3 py-3">
                        {e.parent_notified ? (
                          <span className="text-xs text-safe">Yuborildi</span>
                        ) : (
                          <span className="text-xs text-urgent">Yuborilmagan</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs text-muted">{timeAgo(e.created_at)}</td>
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
        )}
      </div>

      <p className="mt-3 text-xs text-muted">
        Eslatma: xom suhbat kontekstiga faqat Safety Officer roli kira oladi (backend darajasida majburlanadi).
      </p>
    </div>
  );
}
