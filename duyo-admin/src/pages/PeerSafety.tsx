import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  Flag,
  Loader2,
  MessageSquareWarning,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { cn } from "@/lib/utils";
import {
  adminApi,
  type PeerContextMessage,
  type PeerFlagRow,
  type PeerReportRow,
} from "@/api/admin";
import { ApiError } from "@/api/client";

/**
 * The two peer-safety queues.
 *
 * These exist because the backend was already recording why it blocked every
 * message and nobody was reading it, and because a child who filed a report
 * reached no one at all. A queue nobody opens is the same as no queue, so this
 * page leads with the counts and defaults to unreviewed.
 */

/** `peer_harm_grooming` -> what a reviewer actually needs to see. */
const REASON_LABELS: Record<string, { label: string; tone: "urgent" | "warn" | "muted" }> = {
  peer_harm_sexual: { label: "Jinsiy mazmun", tone: "urgent" },
  peer_harm_grooming: { label: "Grooming belgilari", tone: "urgent" },
  peer_harm_threat: { label: "Tahdid", tone: "warn" },
  peer_harm_degradation: { label: "Haqorat", tone: "warn" },
  peer_harm_meeting: { label: "Uchrashuv so'rovi", tone: "muted" },
  contact_info: { label: "Kontakt ma'lumoti", tone: "muted" },
};

const TONE_CLASS: Record<"urgent" | "warn" | "muted", string> = {
  urgent: "bg-urgent-bg text-urgent border-urgent-line",
  warn: "bg-amber-50 text-amber-700 border-amber-200",
  muted: "bg-bg text-muted border-line",
};

function reasonBadge(reason: string | null) {
  if (!reason) return { label: "Noma'lum", tone: "muted" as const };
  const known = REASON_LABELS[reason];
  if (known) return known;
  // Crisis reasons (`crisis_RED`) can still land here — the author was the one
  // in trouble, which is a different queue's problem but must not render blank.
  if (reason.startsWith("crisis_")) {
    return { label: `Krizis · ${reason.slice(7)}`, tone: "warn" as const };
  }
  return { label: reason, tone: "muted" as const };
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("uz-UZ", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.detail;
  if (error instanceof Error) return error.message;
  return "Kutilmagan xatolik";
}

export function PeerSafety() {
  const [tab, setTab] = useState<"flags" | "reports">("flags");
  const [unreviewedOnly, setUnreviewedOnly] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [openReport, setOpenReport] = useState<PeerReportRow | null>(null);

  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["peer-flags"] });
    queryClient.invalidateQueries({ queryKey: ["peer-reports"] });
    queryClient.invalidateQueries({ queryKey: ["safety-summary"] });
  };

  const flags = useQuery({
    queryKey: ["peer-flags", unreviewedOnly],
    queryFn: () => adminApi.peerFlags(unreviewedOnly),
  });
  const reports = useQuery({
    queryKey: ["peer-reports", unreviewedOnly],
    queryFn: () => adminApi.peerReports(unreviewedOnly),
  });

  const reviewFlag = useMutation({
    mutationFn: (id: string) => adminApi.peerFlagReview(id),
    onMutate: () => setErrorMsg(null),
    onSuccess: invalidate,
    onError: (err: unknown) => setErrorMsg(getErrorMessage(err)),
  });
  const reviewReport = useMutation({
    mutationFn: (id: string) => adminApi.peerReportReview(id),
    onMutate: () => setErrorMsg(null),
    onSuccess: invalidate,
    onError: (err: unknown) => setErrorMsg(getErrorMessage(err)),
  });

  const flagRows: PeerFlagRow[] = flags.data ?? [];
  const reportRows: PeerReportRow[] = reports.data ?? [];

  return (
    <div>
      <PageHeader
        title="Tengdoshlar xavfsizligi"
        subtitle="Filtr to'xtatgan xabarlar va bolalar yuborgan shikoyatlar"
        actions={
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={unreviewedOnly}
              onChange={(e) => setUnreviewedOnly(e.target.checked)}
              className="h-4 w-4 rounded border-line"
            />
            Faqat ko'rilmaganlar
          </label>
        }
      />

      {errorMsg && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-urgent-line bg-urgent-bg p-4">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-urgent" />
          <div className="flex-1 text-sm text-urgent">{errorMsg}</div>
          <button type="button" aria-label="Yopish" onClick={() => setErrorMsg(null)} className="text-urgent hover:opacity-70">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="mb-5 flex items-start gap-3 rounded-2xl border border-line bg-bg p-4">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-muted" />
        <div className="text-sm text-muted">
          <span className="font-semibold text-ink">Diqqat:</span> avtomatik filtr faqat
          poldir. U bir necha hafta davom etadigan, oddiy ko'rinadigan grooming'ni topa
          olmaydi — buni faqat shu navbatni o'qigan odam topadi.
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setTab("flags")}
          className={cn(
            "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium",
            tab === "flags" ? "border-duyo-blue bg-duyo-50 text-duyo-dark" : "border-line text-muted hover:bg-bg",
          )}
        >
          <MessageSquareWarning size={14} />
          Bloklangan xabarlar
          {flagRows.length > 0 && <span className="rounded-full bg-urgent px-1.5 text-xs text-white">{flagRows.length}</span>}
        </button>
        <button
          onClick={() => setTab("reports")}
          className={cn(
            "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium",
            tab === "reports" ? "border-duyo-blue bg-duyo-50 text-duyo-dark" : "border-line text-muted hover:bg-bg",
          )}
        >
          <Flag size={14} />
          Bolalar shikoyatlari
          {reportRows.length > 0 && <span className="rounded-full bg-urgent px-1.5 text-xs text-white">{reportRows.length}</span>}
        </button>
      </div>

      {tab === "flags" ? (
        <QueueCard
          title="Yetkazilmagan xabarlar"
          icon={<MessageSquareWarning size={16} className="text-urgent" />}
          query={flags}
          empty="Bloklangan xabar yo'q."
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-muted">
                <th className="px-5 py-3">Sabab</th>
                <th className="px-3 py-3">Xabar matni</th>
                <th className="px-3 py-3">Vaqt</th>
                <th className="px-3 py-3 text-right">Amal</th>
              </tr>
            </thead>
            <tbody>
              {flagRows.map((row) => {
                const badge = reasonBadge(row.moderation_reason);
                const busy = reviewFlag.isPending && reviewFlag.variables === row.id;
                return (
                  <tr key={row.id} className="border-b border-line/70 last:border-0">
                    <td className="px-5 py-3">
                      <span className={cn("pill border", TONE_CLASS[badge.tone])}>{badge.label}</span>
                    </td>
                    {/* Shown because this message was never delivered. */}
                    <td className="max-w-md px-3 py-3 text-ink">{row.body}</td>
                    <td className="px-3 py-3 text-xs text-muted">{formatDateTime(row.created_at)}</td>
                    <td className="px-3 py-3 text-right">
                      {row.reviewed_at ? (
                        <span className="text-xs text-muted">
                          Ko'rildi · {row.reviewed_by ?? "—"}
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => reviewFlag.mutate(row.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-ink hover:border-duyo-blue hover:bg-duyo-50 disabled:opacity-50"
                        >
                          {busy ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Ko'rib chiqildi
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </QueueCard>
      ) : (
        <QueueCard
          title="Bola yuborgan shikoyatlar"
          icon={<Flag size={16} className="text-urgent" />}
          query={reports}
          empty="Shikoyat yo'q."
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-muted">
                <th className="px-5 py-3">Shikoyatchi</th>
                <th className="px-3 py-3">Kim haqida</th>
                <th className="px-3 py-3">Sabab</th>
                <th className="px-3 py-3">Vaqt</th>
                <th className="px-3 py-3 text-right">Amallar</th>
              </tr>
            </thead>
            <tbody>
              {reportRows.map((row) => {
                const busy = reviewReport.isPending && reviewReport.variables === row.id;
                return (
                  <tr key={row.id} className="border-b border-line/70 last:border-0">
                    <td className="px-5 py-3 font-medium text-ink">#{row.reporter_child_id.slice(0, 8)}</td>
                    <td className="px-3 py-3 text-ink">#{row.reported_child_id.slice(0, 8)}</td>
                    <td className="px-3 py-3 text-muted">{row.reason ?? "Sabab yozilmagan"}</td>
                    <td className="px-3 py-3 text-xs text-muted">{formatDateTime(row.created_at)}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          disabled={!row.friendship_id}
                          onClick={() => setOpenReport(row)}
                          title={row.friendship_id ? "Suhbatni o'qish (audit qilinadi)" : "Do'stlik o'chirilgan — suhbat yo'q"}
                          className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-ink hover:border-duyo-blue hover:bg-duyo-50 disabled:opacity-40"
                        >
                          <Eye size={13} /> Suhbatni ko'rish
                        </button>
                        {row.reviewed_at ? (
                          <span className="text-xs text-muted">Ko'rildi · {row.reviewed_by ?? "—"}</span>
                        ) : (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => reviewReport.mutate(row.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-ink hover:border-duyo-blue hover:bg-duyo-50 disabled:opacity-50"
                          >
                            {busy ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Ko'rib chiqildi
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </QueueCard>
      )}

      {openReport && <ContextModal report={openReport} onClose={() => setOpenReport(null)} />}
    </div>
  );
}

function QueueCard({
  title,
  icon,
  query,
  empty,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  query: { isLoading: boolean; isError: boolean; error: unknown; data?: unknown[] };
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-line px-5 py-3">
        {icon}
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
      </div>
      {query.isLoading ? (
        <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted">
          <Loader2 size={16} className="animate-spin" /> Yuklanmoqda...
        </div>
      ) : query.isError ? (
        <div className="p-12 text-center text-sm text-urgent">{getErrorMessage(query.error)}</div>
      ) : (query.data ?? []).length === 0 ? (
        <div className="p-12 text-center text-sm text-muted">{empty}</div>
      ) : (
        <div className="overflow-x-auto">{children}</div>
      )}
    </div>
  );
}

/**
 * Reading the reported conversation.
 *
 * A modal rather than an inline expansion, because the backend logs this call
 * as `read_conversation` against a named admin — opening it should feel like a
 * deliberate act, which is what it is.
 */
function ContextModal({ report, onClose }: { report: PeerReportRow; onClose: () => void }) {
  const context = useQuery({
    queryKey: ["peer-report-context", report.id],
    queryFn: () => adminApi.peerReportContext(report.id),
  });
  const rows: PeerContextMessage[] = context.data ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-line px-5 py-3">
          <Eye size={16} className="text-muted" />
          <h2 className="flex-1 text-sm font-semibold text-ink">
            Shikoyat #{report.id.slice(0, 8)} — so'nggi xabarlar
          </h2>
          <button type="button" aria-label="Yopish" onClick={onClose} className="text-muted hover:text-ink">
            <X size={16} />
          </button>
        </div>

        <div className="border-b border-line bg-bg px-5 py-2 text-xs text-muted">
          Bu ikki bolaning shaxsiy yozishmasi. Ochilgani audit jurnaliga sizning
          nomingiz bilan yozildi.
        </div>

        <div className="max-h-[55vh] overflow-y-auto p-5">
          {context.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted">
              <Loader2 size={16} className="animate-spin" /> Yuklanmoqda...
            </div>
          ) : context.isError ? (
            <div className="py-12 text-center text-sm text-urgent">{getErrorMessage(context.error)}</div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted">Suhbat topilmadi.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {rows.map((m, i) => {
                // The reported child's messages are the ones under review, so
                // they are the ones marked — the reporter's side is context.
                const fromReported = m.sender_child_id === report.reported_child_id;
                return (
                  <div
                    key={`${m.created_at}-${i}`}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-sm",
                      fromReported ? "border-urgent-line bg-urgent-bg" : "border-line bg-bg",
                      m.moderation_state === "blocked" && "opacity-60",
                    )}
                  >
                    <div className="mb-0.5 flex items-center gap-2 text-xs text-muted">
                      <span className="font-medium">
                        {fromReported ? "Shikoyat qilingan bola" : "Shikoyatchi"}
                      </span>
                      <span>· {formatDateTime(m.created_at)}</span>
                      {m.moderation_state !== "delivered" && (
                        <span className="pill border border-line bg-white text-muted">
                          {m.moderation_state === "blocked" ? "yetkazilmagan" : "qaytarilgan"}
                        </span>
                      )}
                    </div>
                    <div className="text-ink">{m.body}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
