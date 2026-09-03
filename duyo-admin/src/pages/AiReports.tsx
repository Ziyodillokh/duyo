import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Bot, CheckCircle2, Loader2, X } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { cn } from "@/lib/utils";
import { adminApi, type AiReportRow } from "@/api/admin";
import { ApiError } from "@/api/client";

/**
 * Replies children reported as harmful.
 *
 * Play requires both a reporting mechanism and evidence that the developer
 * acts on it; the mobile sheet is the first half and this page is the second.
 * Modelled on PeerSafety with one deliberate difference: the reported text is
 * shown in full and never truncated. These are DUYO's own words, not a private
 * conversation, and a moderator judging an answer has to read all of it — a
 * preview hides exactly the sentence that got the report filed.
 */

/** The five reasons the sheet offers, in the child's own wording. */
const REASON_LABELS: Record<string, { label: string; tone: "urgent" | "warn" | "muted" }> = {
  harmful: { label: "Xavfli yoki zararli maslahat", tone: "urgent" },
  sexual: { label: "Nomaqbul, jinsiy mazmun", tone: "urgent" },
  hateful: { label: "Haqorat yoki kamsitish", tone: "warn" },
  scary: { label: "Qo'rqinchli yoki bezovta qiladi", tone: "warn" },
  other: { label: "Boshqa sabab", tone: "muted" },
};

const TONE_CLASS: Record<"urgent" | "warn" | "muted", string> = {
  urgent: "bg-urgent-bg text-urgent border-urgent-line",
  warn: "bg-amber-50 text-amber-700 border-amber-200",
  muted: "bg-bg text-muted border-line",
};

function reasonBadge(reason: string) {
  // A sixth reason is a backend deploy, not a migration — so an unknown value
  // must render as itself rather than vanish from the queue.
  return REASON_LABELS[reason] ?? { label: reason, tone: "muted" as const };
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

export function AiReports() {
  const [unreviewedOnly, setUnreviewedOnly] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const reports = useQuery({
    queryKey: ["ai-reports", unreviewedOnly],
    queryFn: () => adminApi.aiReports(unreviewedOnly),
  });

  const review = useMutation({
    mutationFn: (id: string) => adminApi.aiReportReview(id),
    onMutate: () => setErrorMsg(null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-reports"] });
      queryClient.invalidateQueries({ queryKey: ["safety-summary"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-safety-summary"] });
    },
    onError: (err: unknown) => setErrorMsg(getErrorMessage(err)),
  });

  const rows: AiReportRow[] = reports.data ?? [];

  return (
    <div>
      <PageHeader
        title="AI javoblari ustidan shikoyatlar"
        subtitle="Bola DUYO'ning javobini zararli deb belgilagan holatlar"
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
          <button
            type="button"
            aria-label="Yopish"
            onClick={() => setErrorMsg(null)}
            className="text-urgent hover:opacity-70"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="mb-5 flex items-start gap-3 rounded-2xl border border-line bg-bg p-4">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-muted" />
        <div className="text-sm text-muted">
          <span className="font-semibold text-ink">Diqqat:</span> bu yerdagi matnni DUYO
          yozgan. Har bir shikoyatni to'liq o'qing — javob promptni yoki filtrni
          o'zgartirishni talab qilsa, buni faqat shu navbat ko'rsatadi.
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-line px-5 py-3">
          <Bot size={16} className="text-urgent" />
          <h2 className="flex-1 text-sm font-semibold text-ink">Shikoyat qilingan javoblar</h2>
          {rows.length > 0 && (
            <span className="rounded-full bg-urgent px-2 py-0.5 text-xs text-white">{rows.length}</span>
          )}
        </div>

        {reports.isLoading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted">
            <Loader2 size={16} className="animate-spin" /> Yuklanmoqda...
          </div>
        ) : reports.isError ? (
          <div className="p-12 text-center text-sm text-urgent">{getErrorMessage(reports.error)}</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted">Shikoyat yo'q.</div>
        ) : (
          <div className="flex flex-col divide-y divide-line">
            {rows.map((row) => (
              <ReportCard
                key={row.id}
                row={row}
                busy={review.isPending && review.variables === row.id}
                onReview={() => review.mutate(row.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ReportCard({
  row,
  busy,
  onReview,
}: {
  row: AiReportRow;
  busy: boolean;
  onReview: () => void;
}) {
  const badge = reasonBadge(row.reason);

  return (
    <div className="p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className={cn("pill border", TONE_CLASS[badge.tone])}>{badge.label}</span>
        <span className="text-xs text-muted">Bola #{row.child_id.slice(0, 8)}</span>
        <span className="text-xs text-muted">· {formatDateTime(row.created_at)}</span>
        {row.model_name && <span className="pill border border-line bg-bg text-muted">{row.model_name}</span>}
        {!row.message_id && (
          // The row outlives the conversation on purpose; say so, or the blank
          // link reads as a bug rather than as the design.
          <span className="pill border border-line bg-bg text-muted">suhbat o'chirilgan</span>
        )}
        <div className="ml-auto">
          {row.reviewed_at ? (
            <span className="text-xs text-muted">
              Ko'rildi · {row.reviewed_by ?? "—"} · {formatDateTime(row.reviewed_at)}
            </span>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={onReview}
              className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-ink hover:border-duyo-blue hover:bg-duyo-50 disabled:opacity-50"
            >
              {busy ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Ko'rib
              chiqildi
            </button>
          )}
        </div>
      </div>

      {/* Full text, never clamped — see the note at the top of this file. */}
      <div className="whitespace-pre-wrap break-words rounded-xl border border-line bg-bg px-4 py-3 text-sm text-ink">
        {row.model_output}
      </div>
    </div>
  );
}
