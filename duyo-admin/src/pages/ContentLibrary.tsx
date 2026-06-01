import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Eye,
  Pencil,
  Trash2,
  AlertTriangle,
  Check,
  X,
  Upload,
  CloudOff,
  FileCheck2,
  ScrollText,
  BookOpen,
  GraduationCap,
  Headphones,
  Flag,
  Loader2,
  ThumbsUp,
  CheckCircle2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { cn } from "@/lib/utils";
import { adminApi, type ContentRow } from "@/api/admin";
import { ApiError } from "@/api/client";

/* ──────────────────────────────────────────────────────────────────────────
   Domain types — backend (Content) ga ulangan. Faqat sifat charts/audio-player
   va litsenziya hujjat yuklash UI MOCK bo'lib qoladi (backend yo'q).
   ──────────────────────────────────────────────────────────────────────── */

type ContentType = ContentRow["type"];
type ReviewStatus = ContentRow["review_status"];
type LicenseStatus = ContentRow["license_status"];

interface ContentTab {
  key: ContentType;
  label: string;
  icon: LucideIcon;
}

/* ── Status pill ko'rinishlari (design tokenlar bilan) ───────────────────── */

const REVIEW_PILL: Record<ReviewStatus, { label: string; cls: string }> = {
  approved: { label: "Tasdiqlangan", cls: "bg-safe-bg text-safe border border-safe-line" },
  pending: { label: "Kutilmoqda", cls: "bg-warn-bg text-warn border border-warn-line" },
  rejected: { label: "Rad etilgan", cls: "bg-urgent-bg text-urgent border border-urgent-line" },
  draft: { label: "Qoralama", cls: "bg-bg text-muted border border-line" },
};

const LICENSE_PILL: Record<LicenseStatus, { label: string; cls: string }> = {
  approved: { label: "Tasdiqlangan", cls: "bg-safe-bg text-safe border border-safe-line" },
  pending: { label: "Kutilmoqda", cls: "bg-warn-bg text-warn border border-warn-line" },
  rejected: { label: "Rad etilgan", cls: "bg-urgent-bg text-urgent border border-urgent-line" },
  unknown: { label: "Noma'lum", cls: "bg-bg text-muted border border-line" },
};

const PUBLISH_PILL: Record<"published" | "unpublished", { label: string; cls: string }> = {
  published: { label: "Nashr etilgan", cls: "bg-duyo-50 text-duyo-dark border border-duyo-100" },
  unpublished: { label: "Nashr etilmagan", cls: "bg-bg text-muted border border-line" },
};

const TYPE_LABEL: Record<ContentType, string> = {
  poem: "She'r",
  story: "Ertak",
  lesson: "Dars",
  audio: "Audio",
};

const CONTENT_TABS: ContentTab[] = [
  { key: "poem", label: "She'rlar", icon: ScrollText },
  { key: "story", label: "Ertaklar", icon: BookOpen },
  { key: "lesson", label: "Darslar", icon: GraduationCap },
  { key: "audio", label: "Audio", icon: Headphones },
];

/* ──────────────────────────────────────────────────────────────────────────
   KRITIK QOIDA: kontent FAQAT license=approved VA review=approved bo'lsa
   nashr etiladi. Bu darvoza backendda majburlanadi (publish 400 qaytaradi);
   UI ham shu shartni oldindan tekshiradi.
   ──────────────────────────────────────────────────────────────────────── */

function canPublish(row: ContentRow): boolean {
  return row.license_status === "approved" && row.review_status === "approved";
}

function publishBlockReason(row: ContentRow): string {
  const reasons: string[] = [];
  if (row.license_status !== "approved") reasons.push("litsenziya tasdiqlanmagan");
  if (row.review_status !== "approved") reasons.push("tekshiruv tasdiqlanmagan");
  return reasons.join(" va ");
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.detail;
  if (error instanceof Error) return error.message;
  return "Kutilmagan xatolik";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("uz-UZ", { year: "numeric", month: "short", day: "numeric" });
}

/* ── Kichik UI yordamchilar ──────────────────────────────────────────────── */

function StatusPill({ label, cls }: { label: string; cls: string }) {
  return <span className={cn("pill", cls)}>{label}</span>;
}

function IconAction({
  icon: Icon,
  label,
  tone = "neutral",
  disabled = false,
  title,
  busy = false,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  tone?: "neutral" | "danger";
  disabled?: boolean;
  title?: string;
  busy?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled || busy}
      onClick={onClick}
      title={title ?? label}
      aria-label={label}
      className={cn(
        "rounded-lg border p-1.5 transition-colors",
        disabled || busy
          ? "cursor-not-allowed border-line text-line"
          : tone === "danger"
            ? "border-line text-muted hover:border-urgent-line hover:bg-urgent-bg hover:text-urgent"
            : "border-line text-muted hover:border-duyo-blue hover:bg-duyo-50 hover:text-duyo-dark",
      )}
    >
      {busy ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}
    </button>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   View — uchta rejim: kontent jadvali / review queue / licensing
   ──────────────────────────────────────────────────────────────────────── */

type ViewMode = ContentType | "review" | "licensing";

export function ContentLibrary() {
  const [view, setView] = useState<ViewMode>("story");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const contentQuery = useQuery({
    queryKey: ["content"],
    queryFn: () => adminApi.contentList(),
  });

  const summaryQuery = useQuery({
    queryKey: ["content", "summary"],
    queryFn: () => adminApi.contentSummary(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof adminApi.contentUpdate>[1] }) =>
      adminApi.contentUpdate(id, patch),
    onMutate: () => setErrorMsg(null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content"] });
    },
    onError: (err: unknown) => setErrorMsg(getErrorMessage(err)),
  });

  const all = contentQuery.data ?? [];
  const isContentView = view !== "review" && view !== "licensing";

  const rows = useMemo(
    () => (isContentView ? all.filter((c) => c.type === view) : []),
    [all, view, isContentView],
  );

  const reviewItems = useMemo(
    () => all.filter((c) => c.review_status === "pending" || c.review_status === "draft"),
    [all],
  );

  const licenseItems = useMemo(
    () => all.filter((c) => c.license_status !== "approved"),
    [all],
  );

  const reviewQueueCount = reviewItems.length;
  const summary = summaryQuery.data;

  const handlers = {
    onPublish: (row: ContentRow) =>
      updateMutation.mutate({ id: row.id, patch: { published: true } }),
    onUnpublish: (row: ContentRow) =>
      updateMutation.mutate({ id: row.id, patch: { published: false } }),
    onApproveReview: (row: ContentRow) =>
      updateMutation.mutate({ id: row.id, patch: { review_status: "approved" } }),
    onRejectReview: (row: ContentRow) =>
      updateMutation.mutate({ id: row.id, patch: { review_status: "rejected" } }),
    onApproveLicense: (row: ContentRow) =>
      updateMutation.mutate({ id: row.id, patch: { license_status: "approved" } }),
  };

  const pendingId =
    updateMutation.isPending && updateMutation.variables ? updateMutation.variables.id : null;

  return (
    <div>
      <PageHeader
        title="Kontent kutubxonasi"
        subtitle="She'rlar, ertaklar, darslar va audio — tekshiruv, litsenziya va nashr boshqaruvi"
        actions={
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-xl bg-duyo-blue px-3.5 py-2 text-sm font-semibold text-white hover:bg-duyo-dark"
          >
            <Plus size={16} /> Yangi qo'shish
          </button>
        }
      />

      {/* Mutatsiya xatosi — masalan nashr darvozasi 400 */}
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

      {/* KRITIK darvoza banneri — har doim ko'rinadi */}
      <div className="mb-5 flex items-start gap-3 rounded-2xl border border-urgent-line bg-urgent-bg p-4">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-urgent" />
        <div className="text-sm text-urgent">
          <span className="font-semibold">Nashr darvozasi:</span> Kontent FAQAT litsenziya holati{" "}
          <span className="font-semibold">Tasdiqlangan</span> VA tekshiruv holati{" "}
          <span className="font-semibold">Tasdiqlangan</span> bo'lganda nashr etiladi. Aks holda
          "Nashr etish" tugmasi o'chiriladi.
        </div>
      </div>

      {/* Sifat metrikalari — backend summary + jamlangan engagement */}
      <SummaryStrip rows={all} summary={summary} loading={summaryQuery.isLoading} />

      {/* Tabs */}
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-1 border-b border-line px-3 pt-2">
          {CONTENT_TABS.map((t) => {
            const Icon = t.icon;
            const active = view === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setView(t.key)}
                className={cn(
                  "flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium",
                  active
                    ? "border-duyo-blue text-duyo-dark"
                    : "border-transparent text-muted hover:text-ink",
                )}
              >
                <Icon size={15} /> {t.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setView("review")}
            className={cn(
              "flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium",
              view === "review"
                ? "border-duyo-blue text-duyo-dark"
                : "border-transparent text-muted hover:text-ink",
            )}
          >
            Tekshiruv navbati
            {reviewQueueCount > 0 && (
              <span className="pill bg-warn-bg text-warn border border-warn-line">
                {reviewQueueCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setView("licensing")}
            className={cn(
              "flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium",
              view === "licensing"
                ? "border-duyo-blue text-duyo-dark"
                : "border-transparent text-muted hover:text-ink",
            )}
          >
            Litsenziya
          </button>
        </div>

        {contentQuery.isLoading ? (
          <LoadingState />
        ) : contentQuery.isError ? (
          <ErrorState message={getErrorMessage(contentQuery.error)} />
        ) : (
          <>
            {isContentView && (
              <ContentTable rows={rows} pendingId={pendingId} handlers={handlers} />
            )}
            {view === "review" && (
              <ReviewQueue items={reviewItems} pendingId={pendingId} handlers={handlers} />
            )}
            {view === "licensing" && (
              <LicensingTable items={licenseItems} pendingId={pendingId} handlers={handlers} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ── Amallar tipi (drilling) ─────────────────────────────────────────────── */

interface RowHandlers {
  onPublish: (row: ContentRow) => void;
  onUnpublish: (row: ContentRow) => void;
  onApproveReview: (row: ContentRow) => void;
  onRejectReview: (row: ContentRow) => void;
  onApproveLicense: (row: ContentRow) => void;
}

/* ── Holat ko'rinishlari ─────────────────────────────────────────────────── */

function LoadingState() {
  return (
    <div className="flex items-center justify-center gap-2 px-4 py-16 text-sm text-muted">
      <Loader2 size={18} className="animate-spin text-duyo-blue" />
      Yuklanmoqda…
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center gap-2 px-4 py-16 text-sm text-urgent">
      <AlertTriangle size={18} />
      {message}
    </div>
  );
}

/* ── Sifat metrikalari kartalari ─────────────────────────────────────────── */

function SummaryStrip({
  rows,
  summary,
  loading,
}: {
  rows: ContentRow[];
  summary: { by_review: Record<string, number>; published: number } | undefined;
  loading: boolean;
}) {
  const totals = useMemo(() => {
    const completions = rows.reduce((s, r) => s + r.completions, 0);
    const likes = rows.reduce((s, r) => s + r.likes, 0);
    const reports = rows.reduce((s, r) => s + r.reports, 0);
    const pending = summary?.by_review?.pending ?? 0;
    return { completions, likes, reports, pending };
  }, [rows, summary]);

  const cards = [
    { label: "Jami tugallanish", value: totals.completions.toLocaleString("uz-UZ"), hint: "Barcha kontent" },
    { label: "Yoqtirishlar", value: totals.likes.toLocaleString("uz-UZ"), hint: "Jami like", icon: ThumbsUp },
    {
      label: "Shikoyatlar",
      value: totals.reports.toLocaleString("uz-UZ"),
      hint: "Ko'rib chiqish kerak",
      alert: totals.reports > 0,
      icon: Flag,
    },
    { label: "Tekshiruv navbati", value: String(totals.pending), hint: "Kutilmoqda", icon: FileCheck2 },
    {
      label: "Nashr etilgan",
      value: summary ? String(summary.published) : "—",
      hint: "Faol kontent",
      icon: CheckCircle2,
    },
  ];

  return (
    <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((m) => {
        const Icon = m.icon;
        return (
          <div key={m.label} className={cn("card p-4", m.alert && "border-urgent-line bg-urgent-bg")}>
            <div className="flex items-center justify-between">
              <span className={cn("text-xs font-medium", m.alert ? "text-urgent" : "text-muted")}>
                {m.label}
              </span>
              {Icon && <Icon size={14} className={m.alert ? "text-urgent" : "text-muted"} />}
            </div>
            <div className={cn("mt-2 text-2xl font-bold", m.alert ? "text-urgent" : "text-ink")}>
              {loading ? "…" : m.value}
            </div>
            {m.hint && (
              <div className={cn("mt-1 text-[11px]", m.alert ? "text-urgent/80" : "text-muted")}>
                {m.hint}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Kontent jadvali ─────────────────────────────────────────────────────── */

function ContentTable({
  rows,
  pendingId,
  handlers,
}: {
  rows: ContentRow[];
  pendingId: string | null;
  handlers: RowHandlers;
}) {
  return (
    <>
      {/* Filtrlar */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <FilterPill label="Hamma tillar" />
        <FilterPill label="Yosh toifasi" />
        <FilterPill label="Audio holati" />
        <span className="ml-auto text-xs text-muted">{rows.length} ta natija (joriy turda)</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-muted">
              <th className="px-4 py-3">Sarlavha</th>
              <th className="px-3 py-3">Tur</th>
              <th className="px-3 py-3">Yosh</th>
              <th className="px-3 py-3">Til</th>
              <th className="px-3 py-3">Litsenziya</th>
              <th className="px-3 py-3">Tekshiruv</th>
              <th className="px-3 py-3">Nashr</th>
              <th className="px-3 py-3">Statistika</th>
              <th className="px-3 py-3">Yaratilgan</th>
              <th className="px-3 py-3 text-right">Amallar</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-sm text-muted">
                  Kontent yo'q
                </td>
              </tr>
            ) : (
              rows.map((c) => (
                <ContentTableRow
                  key={c.id}
                  item={c}
                  busy={pendingId === c.id}
                  handlers={handlers}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ContentTableRow({
  item,
  busy,
  handlers,
}: {
  item: ContentRow;
  busy: boolean;
  handlers: RowHandlers;
}) {
  const publishable = canPublish(item);

  return (
    <tr className="border-b border-line/70 last:border-0 hover:bg-bg/60">
      <td className="px-4 py-3">
        <div className="font-medium text-ink">{item.title}</div>
        <div className="text-xs text-muted">{item.author ?? "Muallif noma'lum"}</div>
      </td>
      <td className="px-3 py-3 text-muted">{TYPE_LABEL[item.type]}</td>
      <td className="px-3 py-3 text-muted">{item.age_segment}</td>
      <td className="px-3 py-3 uppercase text-muted">{item.language}</td>
      <td className="px-3 py-3">
        <StatusPill {...LICENSE_PILL[item.license_status]} />
      </td>
      <td className="px-3 py-3">
        <StatusPill {...REVIEW_PILL[item.review_status]} />
      </td>
      <td className="px-3 py-3">
        <StatusPill {...PUBLISH_PILL[item.published ? "published" : "unpublished"]} />
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-3 text-xs text-muted">
          <span title="Tugallanish">{item.completions.toLocaleString("uz-UZ")}</span>
          <span className="flex items-center gap-0.5" title="Yoqtirish">
            <ThumbsUp size={12} /> {item.likes}
          </span>
          <span
            className={cn("flex items-center gap-0.5", item.reports > 0 && "text-urgent")}
            title="Shikoyat"
          >
            <Flag size={12} /> {item.reports}
          </span>
        </div>
      </td>
      <td className="px-3 py-3 text-xs text-muted">{formatDate(item.created_at)}</td>
      <td className="px-3 py-3">
        <div className="flex items-center justify-end gap-1.5">
          <IconAction icon={Eye} label="Ko'rib chiqish" />
          <IconAction icon={Pencil} label="Tahrirlash" />
          {item.published ? (
            <IconAction
              icon={CloudOff}
              label="Nashrdan olish"
              tone="danger"
              busy={busy}
              onClick={() => handlers.onUnpublish(item)}
            />
          ) : (
            <IconAction
              icon={Upload}
              label="Nashr etish"
              disabled={!publishable}
              busy={busy}
              title={
                publishable ? "Nashr etish" : `Nashr etib bo'lmaydi: ${publishBlockReason(item)}`
              }
              onClick={() => handlers.onPublish(item)}
            />
          )}
          <IconAction icon={Trash2} label="O'chirish" tone="danger" />
        </div>
      </td>
    </tr>
  );
}

/* ── Tekshiruv navbati (approve / reject amallari bilan) ─────────────────── */

function ReviewQueue({
  items,
  pendingId,
  handlers,
}: {
  items: ContentRow[];
  pendingId: string | null;
  handlers: RowHandlers;
}) {
  return (
    <>
      <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted">
        <FileCheck2 size={15} className="text-duyo-blue" />
        Inson tomonidan tekshirilishi kerak bo'lgan kontent
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-muted">
              <th className="px-4 py-3">Sarlavha</th>
              <th className="px-3 py-3">Tur</th>
              <th className="px-3 py-3">Yosh / Til</th>
              <th className="px-3 py-3">Tekshiruv</th>
              <th className="px-3 py-3 text-right">Amallar</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted">
                  Tekshiruv navbati bo'sh
                </td>
              </tr>
            ) : (
              items.map((c) => {
                const busy = pendingId === c.id;
                return (
                  <tr key={c.id} className="border-b border-line/70 last:border-0 hover:bg-bg/60">
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink">{c.title}</div>
                      <div className="text-xs text-muted">{c.author ?? "Muallif noma'lum"}</div>
                    </td>
                    <td className="px-3 py-3 text-muted">{TYPE_LABEL[c.type]}</td>
                    <td className="px-3 py-3 text-muted">
                      {c.age_segment} / {c.language.toUpperCase()}
                    </td>
                    <td className="px-3 py-3">
                      <StatusPill {...REVIEW_PILL[c.review_status]} />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handlers.onApproveReview(c)}
                          className="flex items-center gap-1 rounded-lg border border-safe-line bg-safe-bg px-2.5 py-1 text-xs font-medium text-safe hover:bg-safe/10 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}{" "}
                          Tasdiqlash
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handlers.onRejectReview(c)}
                          className="flex items-center gap-1 rounded-lg border border-urgent-line bg-urgent-bg px-2.5 py-1 text-xs font-medium text-urgent hover:bg-urgent/10 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <X size={13} /> Rad etish
                        </button>
                        <IconAction icon={Eye} label="Ko'rib chiqish" />
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ── Litsenziya boshqaruvi ───────────────────────────────────────────────── */

function LicensingTable({
  items,
  pendingId,
  handlers,
}: {
  items: ContentRow[];
  pendingId: string | null;
  handlers: RowHandlers;
}) {
  return (
    <>
      <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted">
        <ScrollText size={15} className="text-duyo-blue" />
        Litsenziya tasdiqlanmagan kontent — nashr darvozasini ochish uchun zarur
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-muted">
              <th className="px-4 py-3">Sarlavha</th>
              <th className="px-3 py-3">Tur</th>
              <th className="px-3 py-3">Litsenziya holati</th>
              <th className="px-3 py-3">Tekshiruv holati</th>
              <th className="px-3 py-3">Nashrga tayyor</th>
              <th className="px-3 py-3 text-right">Amallar</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted">
                  Litsenziya kutayotgan kontent yo'q
                </td>
              </tr>
            ) : (
              items.map((c) => {
                const ready = canPublish(c);
                const busy = pendingId === c.id;
                return (
                  <tr key={c.id} className="border-b border-line/70 last:border-0 hover:bg-bg/60">
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink">{c.title}</div>
                      <div className="text-xs text-muted">{c.author ?? "Muallif noma'lum"}</div>
                    </td>
                    <td className="px-3 py-3 text-muted">{TYPE_LABEL[c.type]}</td>
                    <td className="px-3 py-3">
                      <StatusPill {...LICENSE_PILL[c.license_status]} />
                    </td>
                    <td className="px-3 py-3">
                      <StatusPill {...REVIEW_PILL[c.review_status]} />
                    </td>
                    <td className="px-3 py-3">
                      {ready ? (
                        <span className="flex items-center gap-1 text-xs font-medium text-safe">
                          <Check size={13} /> Tayyor
                        </span>
                      ) : (
                        <span className="text-xs text-muted">{publishBlockReason(c)}</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          disabled={busy || c.license_status === "approved"}
                          onClick={() => handlers.onApproveLicense(c)}
                          className="flex items-center gap-1 rounded-lg border border-safe-line bg-safe-bg px-2.5 py-1 text-xs font-medium text-safe hover:bg-safe/10 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}{" "}
                          Litsenziyani tasdiqlash
                        </button>
                        <IconAction icon={Eye} label="Hujjatni ko'rish" />
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ── Kichik bo'laklar ────────────────────────────────────────────────────── */

function FilterPill({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="rounded-xl border border-line px-3 py-1.5 text-sm font-medium text-muted hover:border-duyo-blue hover:bg-duyo-50 hover:text-duyo-dark"
    >
      {label}
    </button>
  );
}
