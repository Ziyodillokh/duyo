import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Megaphone,
  Bell,
  MessageSquare,
  Mail,
  Smartphone,
  LayoutTemplate,
  ScrollText,
  AlertTriangle,
  Eye,
  Send,
  Rocket,
  Download,
  Lock,
  Pencil,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  Hourglass,
  FileText,
  Loader2,
  X,
  Ban,
  CalendarClock,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { cn } from "@/lib/utils";
import {
  adminApi,
  type CampaignRow,
  type CampaignChannel,
  type CampaignStatus,
  type CampaignCreate,
} from "@/api/admin";
import { ApiError } from "@/api/client";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type ChannelKey = "campaigns" | "push" | "sms" | "email" | "templates" | "logs";
type TemplateKind = "red" | "orange" | "daily" | "payment";

interface ChannelTab {
  key: ChannelKey;
  label: string;
  icon: LucideIcon;
}

interface NotificationTemplate {
  kind: TemplateKind;
  tag: string;
  title: string;
  body: string;
  superAdminOnly: boolean;
}

/* ------------------------------------------------------------------ */
/* Constants — design tokens & options                                 */
/* ------------------------------------------------------------------ */

const CHANNEL_TABS: ChannelTab[] = [
  { key: "campaigns", label: "Kampaniyalar", icon: Megaphone },
  { key: "push", label: "Push", icon: Bell },
  { key: "sms", label: "SMS", icon: MessageSquare },
  { key: "email", label: "Email", icon: Mail },
  { key: "templates", label: "Shablonlar", icon: LayoutTemplate },
  { key: "logs", label: "Yetkazib berish jurnali", icon: ScrollText },
];

/* MOCK — auditoriya o'lchami baholari (backend yo'q) */
const AUDIENCE_SEGMENTS: { value: string; label: string; size: string }[] = [
  { value: "all-children", label: "Barcha bolalar", size: "1,284" },
  { value: "active-children", label: "Faol bolalar (7 kun)", size: "962" },
  { value: "all-parents", label: "Barcha ota-onalar", size: "874" },
  { value: "premium-parents", label: "Premium ota-onalar", size: "318" },
  { value: "inactive", label: "Passiv (48 soat)", size: "147" },
];

const AGE_SEGMENTS = ["Barcha yoshlar", "6-9", "6-12", "10-13", "13-16"];

const LANGUAGES = ["O'zbek", "Rus", "Ingliz"];

/* Backend kanal ↔ UI yorlig'i */
const CHANNEL_LABEL: Record<CampaignChannel, string> = {
  push: "Push",
  sms: "SMS",
  email: "Email",
  in_app: "In-App",
};

const CHANNEL_PILL: Record<CampaignChannel, { cls: string; icon: LucideIcon }> = {
  push: { cls: "bg-duyo-50 text-duyo-dark border border-duyo-100", icon: Bell },
  sms: { cls: "bg-warn-bg text-warn border border-warn-line", icon: MessageSquare },
  email: { cls: "bg-safe-bg text-safe border border-safe-line", icon: Mail },
  in_app: { cls: "bg-bg text-muted border border-line", icon: Smartphone },
};

const STATUS_PILL: Record<
  CampaignStatus,
  { label: string; pill: string; dot: string; icon: LucideIcon }
> = {
  draft: {
    label: "QORALAMA",
    pill: "bg-bg text-muted border border-line",
    dot: "bg-line",
    icon: FileText,
  },
  scheduled: {
    label: "REJALASHTIRILGAN",
    pill: "bg-warn-bg text-warn border border-warn-line",
    dot: "bg-warn",
    icon: Hourglass,
  },
  sent: {
    label: "YUBORILGAN",
    pill: "bg-safe-bg text-safe border border-safe-line",
    dot: "bg-safe",
    icon: CheckCircle2,
  },
  canceled: {
    label: "BEKOR QILINGAN",
    pill: "bg-urgent-bg text-urgent border border-urgent-line",
    dot: "bg-urgent",
    icon: XCircle,
  },
};

const TEMPLATE_STYLES: Record<TemplateKind, { accent: string; chip: string }> = {
  red: { accent: "border-l-urgent", chip: "bg-urgent-bg text-urgent border border-urgent-line" },
  orange: { accent: "border-l-serious", chip: "bg-serious-bg text-serious border border-serious-line" },
  daily: { accent: "border-l-safe", chip: "bg-safe-bg text-safe border border-safe-line" },
  payment: { accent: "border-l-duyo-blue", chip: "bg-duyo-50 text-duyo-dark border border-duyo-100" },
};

/* ------------------------------------------------------------------ */
/* MOCK data — backend (NotificationService) ulanmaguncha namuna.      */
/* Shablon galereyasi + sokin vaqt qoidasi + oylik statistika.         */
/* ------------------------------------------------------------------ */

const TEMPLATES: NotificationTemplate[] = [
  {
    kind: "red",
    tag: "RED ALERT",
    title: "Xavfsizlik buzilishi",
    body: "Bolaning qurilmasidan ruxsat etilmagan kontent aniqlandi. Zudlik bilan ko'rib chiqing.",
    superAdminOnly: true,
  },
  {
    kind: "orange",
    tag: "ORANGE ALERT",
    title: "Passivlik ogohlantirishi",
    body: "Bolangiz oxirgi 48 soat ichida tizimga kirmadi. Maqsadlarni eslating.",
    superAdminOnly: true,
  },
  {
    kind: "daily",
    tag: "DAILY",
    title: "Daily DUYO report",
    body: "Bugun bolangiz 45 daqiqa matematika va 20 daqiqa ingliz tilini o'rgandi.",
    superAdminOnly: false,
  },
  {
    kind: "payment",
    tag: "PAYMENT",
    title: "Subscription Renewal",
    body: "Duyo Premium obunangiz 3 kundan keyin tugaydi. Avtomatik yangilanadi.",
    superAdminOnly: false,
  },
];

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.detail;
  if (error instanceof Error) return error.message;
  return "Kutilmagan xatolik";
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

/* UI select qiymatini backend kanaliga o'giradi */
function channelFromLabel(label: string): CampaignChannel {
  switch (label) {
    case "SMS":
      return "sms";
    case "Email":
      return "email";
    case "In-App":
      return "in_app";
    default:
      return "push";
  }
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function Notifications() {
  const [activeTab, setActiveTab] = useState<ChannelKey>("campaigns");

  const queryClient = useQueryClient();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const campaignsQuery = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => adminApi.campaigns(),
  });

  const summaryQuery = useQuery({
    queryKey: ["campaigns", "summary"],
    queryFn: () => adminApi.campaignSummary(),
  });

  const createMutation = useMutation({
    mutationFn: (body: CampaignCreate) => adminApi.campaignCreate(body),
    onMutate: () => setErrorMsg(null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    },
    onError: (err: unknown) => setErrorMsg(getErrorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: { status?: CampaignStatus; scheduled_at?: string | null };
    }) => adminApi.campaignUpdate(id, patch),
    onMutate: () => setErrorMsg(null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    },
    onError: (err: unknown) => setErrorMsg(getErrorMessage(err)),
  });

  const allCampaigns = campaignsQuery.data ?? [];
  const summary = summaryQuery.data;
  const failedTotal = (summary?.by_status?.canceled ?? 0) || 0;

  const pendingId =
    updateMutation.isPending && updateMutation.variables ? updateMutation.variables.id : null;

  const rowHandlers: RowHandlers = {
    onSend: (row) => updateMutation.mutate({ id: row.id, patch: { status: "sent" } }),
    onCancel: (row) => updateMutation.mutate({ id: row.id, patch: { status: "canceled" } }),
    onSchedule: (row) => updateMutation.mutate({ id: row.id, patch: { status: "scheduled" } }),
  };

  return (
    <div>
      <PageHeader
        title="Bildirishnomalar"
        subtitle="Kampaniyalar, shablonlar va yetkazib berish monitoringi"
        actions={
          failedTotal > 0 ? (
            <span className="pill bg-urgent-bg text-urgent border border-urgent-line">
              <Ban size={13} /> {failedTotal} ta bekor qilingan
            </span>
          ) : undefined
        }
      />

      {/* Mutatsiya xatosi */}
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

      {/* Summary KPI tiles — backend campaignSummary */}
      <SummaryStrip summary={summary} loading={summaryQuery.isLoading} />

      {/* Channel tabs */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {CHANNEL_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "border-duyo-blue bg-duyo-50 text-duyo-dark"
                  : "border-line text-muted hover:bg-bg",
              )}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {(activeTab === "campaigns" ||
        activeTab === "push" ||
        activeTab === "sms" ||
        activeTab === "email") && (
        <CampaignTab
          activeTab={activeTab}
          campaigns={allCampaigns}
          query={campaignsQuery}
          summary={summary}
          createMutation={createMutation}
          handlers={rowHandlers}
          pendingId={pendingId}
        />
      )}

      {activeTab === "templates" && <TemplatesTab />}

      {activeTab === "logs" && (
        <LogsTab
          campaigns={allCampaigns}
          query={campaignsQuery}
          summary={summary}
          handlers={rowHandlers}
          pendingId={pendingId}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared handler/query types                                          */
/* ------------------------------------------------------------------ */

interface RowHandlers {
  onSend: (row: CampaignRow) => void;
  onCancel: (row: CampaignRow) => void;
  onSchedule: (row: CampaignRow) => void;
}

type CampaignsQuery = ReturnType<typeof useQuery<CampaignRow[]>>;
type CreateMutation = ReturnType<
  typeof useMutation<CampaignRow, unknown, CampaignCreate>
>;
type CampaignSummary = { by_status: Record<string, number>; by_channel: Record<string, number> };

/* ------------------------------------------------------------------ */
/* Summary KPI tiles                                                   */
/* ------------------------------------------------------------------ */

function SummaryStrip({
  summary,
  loading,
}: {
  summary: CampaignSummary | undefined;
  loading: boolean;
}) {
  const cards = useMemo(() => {
    const byStatus = summary?.by_status ?? {};
    const byChannel = summary?.by_channel ?? {};
    const total = Object.values(byStatus).reduce((s, n) => s + n, 0);
    return [
      { label: "Jami kampaniyalar", value: total, icon: Megaphone },
      { label: "Yuborilgan", value: byStatus.sent ?? 0, icon: CheckCircle2, tone: "safe" as const },
      {
        label: "Rejalashtirilgan",
        value: byStatus.scheduled ?? 0,
        icon: Hourglass,
        tone: "warn" as const,
      },
      { label: "Qoralama", value: byStatus.draft ?? 0, icon: FileText },
      {
        label: "Push / SMS / Email",
        value: `${byChannel.push ?? 0} / ${byChannel.sms ?? 0} / ${byChannel.email ?? 0}`,
        icon: Bell,
      },
    ];
  }, [summary]);

  return (
    <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((m) => {
        const Icon = m.icon;
        return (
          <div key={m.label} className="card p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted">{m.label}</span>
              <Icon size={14} className="text-muted" />
            </div>
            <div
              className={cn(
                "mt-2 text-2xl font-bold",
                m.tone === "safe" ? "text-safe" : m.tone === "warn" ? "text-warn" : "text-ink",
              )}
            >
              {loading ? "…" : m.value}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Campaign builder + delivery list + templates                       */
/* ------------------------------------------------------------------ */

function CampaignTab({
  activeTab,
  campaigns,
  query,
  summary,
  createMutation,
  handlers,
  pendingId,
}: {
  activeTab: ChannelKey;
  campaigns: CampaignRow[];
  query: CampaignsQuery;
  summary: CampaignSummary | undefined;
  createMutation: CreateMutation;
  handlers: RowHandlers;
  pendingId: string | null;
}) {
  /* Kanal tab tanlangan bo'lsa jadvalni shu kanal bo'yicha filtrlash */
  const channelFilter: CampaignChannel | null =
    activeTab === "push" ? "push" : activeTab === "sms" ? "sms" : activeTab === "email" ? "email" : null;

  const rows = useMemo(
    () => (channelFilter ? campaigns.filter((c) => c.channel === channelFilter) : campaigns),
    [campaigns, channelFilter],
  );

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      {/* Left + middle: builder & list */}
      <div className="space-y-6 xl:col-span-2">
        <CampaignBuilder createMutation={createMutation} defaultChannel={channelFilter} />
        <CampaignListCard
          rows={rows}
          query={query}
          handlers={handlers}
          pendingId={pendingId}
        />
      </div>

      {/* Right: template gallery + channel breakdown */}
      <div className="space-y-6">
        <TemplateGallery />
        <ChannelBreakdownCard summary={summary} />
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">
      {children}
    </label>
  );
}

const INPUT_CLS =
  "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-duyo-blue focus:outline-none focus:ring-2 focus:ring-duyo-100";

const MAX_BODY = 240;

function CampaignBuilder({
  createMutation,
  defaultChannel,
}: {
  createMutation: CreateMutation;
  defaultChannel: CampaignChannel | null;
}) {
  const [quietHours, setQuietHours] = useState(true);
  const [channel, setChannel] = useState<string>(
    defaultChannel ? CHANNEL_LABEL[defaultChannel] : "Push",
  );
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<string>(AUDIENCE_SEGMENTS[0].value);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("09:00");

  const canSubmit = title.trim().length > 0 && body.trim().length > 0 && !createMutation.isPending;

  function resetForm() {
    setTitle("");
    setBody("");
    setScheduleDate("");
    setScheduleTime("09:00");
    setAudience(AUDIENCE_SEGMENTS[0].value);
  }

  function buildScheduledAt(): string | null {
    if (!scheduleDate) return null;
    const local = new Date(`${scheduleDate}T${scheduleTime || "00:00"}`);
    if (Number.isNaN(local.getTime())) return null;
    return local.toISOString();
  }

  function handleSubmit() {
    if (!canSubmit) return;
    const scheduled_at = buildScheduledAt();
    const payload: CampaignCreate = {
      channel: channelFromLabel(channel),
      title: title.trim(),
      body: body.trim(),
      audience,
      ...(scheduled_at ? { scheduled_at } : {}),
    };
    createMutation.mutate(payload, { onSuccess: resetForm });
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <div className="flex items-center gap-2">
          <Megaphone size={16} className="text-duyo-blue" />
          <h2 className="text-sm font-semibold text-ink">Yangi kampaniya yaratish</h2>
        </div>
        <span className="pill bg-bg text-muted border border-line">DRAFT</span>
      </div>

      <div className="space-y-4 p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <FieldLabel>Kanal</FieldLabel>
            <select
              className={INPUT_CLS}
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
            >
              <option>Push</option>
              <option>SMS</option>
              <option>Email</option>
              <option>In-App</option>
            </select>
          </div>
          {/* MOCK — yosh segmenti backendga yuborilmaydi */}
          <div>
            <FieldLabel>Yosh segmenti</FieldLabel>
            <select className={INPUT_CLS} defaultValue="6-12">
              {AGE_SEGMENTS.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </div>
          {/* MOCK — til backendga yuborilmaydi */}
          <div>
            <FieldLabel>Til</FieldLabel>
            <select className={INPUT_CLS} defaultValue="O'zbek">
              {LANGUAGES.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Audience segment selector — tanlangan qiymat backendga `audience` */}
        <div>
          <FieldLabel>Auditoriya</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {AUDIENCE_SEGMENTS.map((seg) => {
              const active = audience === seg.value;
              return (
                <button
                  key={seg.value}
                  type="button"
                  onClick={() => setAudience(seg.value)}
                  className={cn(
                    "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium",
                    active
                      ? "border-duyo-blue bg-duyo-50 text-duyo-dark"
                      : "border-line text-muted hover:bg-bg",
                  )}
                >
                  {seg.label}
                  <span className="text-xs opacity-70">{seg.size}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <FieldLabel>Xabar sarlavhasi</FieldLabel>
          <input
            className={INPUT_CLS}
            placeholder="Qisqa va aniq sarlavha"
            maxLength={64}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div>
          <FieldLabel>Xabar matni</FieldLabel>
          <textarea
            rows={4}
            className={cn(INPUT_CLS, "resize-none")}
            placeholder="Foydalanuvchiga yuboriladigan asosiy matn..."
            maxLength={MAX_BODY}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <p className="mt-1 text-xs text-muted">
            {body.length}/{MAX_BODY} belgi. O'zgaruvchilar: {"{ism}, {yosh}"}
          </p>
        </div>

        {/* Schedule + quiet hours */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel>Rejalashtirish (ixtiyoriy)</FieldLabel>
            <div className="flex items-center gap-2">
              <Clock size={16} className="shrink-0 text-muted" />
              <input
                type="date"
                className={INPUT_CLS}
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
              />
              <input
                type="time"
                className={INPUT_CLS}
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
              />
            </div>
          </div>
          {/* MOCK — sokin vaqt qoidasi (backend yo'q) */}
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => setQuietHours((q) => !q)}
              className={cn(
                "flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-sm font-medium",
                quietHours
                  ? "border-duyo-blue bg-duyo-50 text-duyo-dark"
                  : "border-line text-muted hover:bg-bg",
              )}
            >
              <span className="flex items-center gap-2">
                <Clock size={15} />
                Sokin vaqt qoidasi (Quiet hours)
              </span>
              <span
                className={cn(
                  "relative h-5 w-9 rounded-full transition-colors",
                  quietHours ? "bg-duyo-blue" : "bg-line",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-4 w-4 rounded-full bg-surface transition-all",
                    quietHours ? "left-4" : "left-0.5",
                  )}
                />
              </span>
            </button>
          </div>
        </div>
        {quietHours && (
          <p className="-mt-2 text-xs text-muted">
            22:00 — 07:00 oralig'ida bildirishnomalar yuborilmaydi (mahalliy vaqt bo'yicha).
          </p>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-xl border border-line px-3.5 py-2 text-sm font-medium text-ink hover:bg-bg"
          >
            <Eye size={15} /> Preview
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="ml-auto flex items-center gap-1.5 rounded-xl bg-duyo-blue px-4 py-2 text-sm font-semibold text-white hover:bg-duyo-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {createMutation.isPending ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Rocket size={15} />
            )}
            Kampaniya yaratish
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Campaign list / delivery log (real rows + mutations)               */
/* ------------------------------------------------------------------ */

function CampaignListCard({
  rows,
  query,
  handlers,
  pendingId,
}: {
  rows: CampaignRow[];
  query: CampaignsQuery;
  handlers: RowHandlers;
  pendingId: string | null;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <div className="flex items-center gap-2">
          <ScrollText size={16} className="text-muted" />
          <h2 className="text-sm font-semibold text-ink">Yetkazib berish jurnali</h2>
        </div>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-ink hover:bg-bg"
        >
          <Download size={13} /> Eksport qilish (CSV)
        </button>
      </div>

      {query.isLoading ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState message={getErrorMessage(query.error)} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-muted">
                <th className="px-5 py-3">Kampaniya</th>
                <th className="px-3 py-3">Kanal</th>
                <th className="px-3 py-3">Auditoriya</th>
                <th className="px-3 py-3">Holat</th>
                <th className="px-3 py-3">Yuborildi / Xato</th>
                <th className="px-3 py-3">Vaqt</th>
                <th className="px-3 py-3 text-right">Amallar</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-muted">
                    Kampaniyalar yo'q
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <CampaignRowItem
                    key={row.id}
                    row={row}
                    busy={pendingId === row.id}
                    handlers={handlers}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CampaignRowItem({
  row,
  busy,
  handlers,
}: {
  row: CampaignRow;
  busy: boolean;
  handlers: RowHandlers;
}) {
  const s = STATUS_PILL[row.status];
  const ch = CHANNEL_PILL[row.channel];
  const ChannelIcon = ch.icon;
  const isTerminal = row.status === "sent" || row.status === "canceled";
  const timeLabel = row.sent_at
    ? `Yuborildi: ${formatDateTime(row.sent_at)}`
    : row.scheduled_at
      ? `Reja: ${formatDateTime(row.scheduled_at)}`
      : `Yaratilgan: ${formatDateTime(row.created_at)}`;

  return (
    <tr className="border-b border-line/70 last:border-0 hover:bg-bg/60">
      <td className="px-5 py-3">
        <div className="font-medium text-ink">{row.title}</div>
        <div className="line-clamp-1 text-xs text-muted">{row.body}</div>
      </td>
      <td className="px-3 py-3">
        <span className={cn("pill", ch.cls)}>
          <ChannelIcon size={12} /> {CHANNEL_LABEL[row.channel]}
        </span>
      </td>
      <td className="px-3 py-3 text-muted">{row.audience || "—"}</td>
      <td className="px-3 py-3">
        <span className={cn("pill", s.pill)}>
          <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} /> {s.label}
        </span>
      </td>
      <td className="px-3 py-3 text-xs">
        <span className="font-medium text-ink">{row.sent_count.toLocaleString("uz-UZ")}</span>
        {row.failed_count > 0 && (
          <span className="text-urgent"> / {row.failed_count.toLocaleString("uz-UZ")}</span>
        )}
      </td>
      <td className="px-3 py-3 text-xs text-muted">{timeLabel}</td>
      <td className="px-3 py-3">
        <div className="flex items-center justify-end gap-1.5">
          {isTerminal ? (
            <span className="text-xs text-muted">—</span>
          ) : (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => handlers.onSend(row)}
                className="flex items-center gap-1 rounded-lg border border-safe-line bg-safe-bg px-2.5 py-1 text-xs font-medium text-safe hover:bg-safe/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Yuborish
              </button>
              {row.status === "draft" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handlers.onSchedule(row)}
                  className="flex items-center gap-1 rounded-lg border border-warn-line bg-warn-bg px-2.5 py-1 text-xs font-medium text-warn hover:bg-warn/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CalendarClock size={13} /> Rejalashtirish
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => handlers.onCancel(row)}
                className="flex items-center gap-1 rounded-lg border border-urgent-line bg-urgent-bg px-2.5 py-1 text-xs font-medium text-urgent hover:bg-urgent/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Ban size={13} /> Bekor qilish
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

/* ── Holat ko'rinishlari ─────────────────────────────────────────── */

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

/* ------------------------------------------------------------------ */
/* Template gallery (MOCK)                                             */
/* ------------------------------------------------------------------ */

function TemplateGallery() {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <div className="flex items-center gap-2">
          <LayoutTemplate size={16} className="text-muted" />
          <h2 className="text-sm font-semibold text-ink">Shablonlar galereyasi</h2>
        </div>
        <button
          type="button"
          className="flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-ink hover:bg-bg"
        >
          <Plus size={13} /> Yangi shablon
        </button>
      </div>

      <div className="p-4">
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-warn-line bg-warn-bg p-3 text-xs text-warn">
          <Lock size={14} className="mt-0.5 shrink-0" />
          <span>RED/ORANGE shablonlari faqat Super Admin tomonidan tahrirlanishi mumkin.</span>
        </div>

        <div className="space-y-3">
          {TEMPLATES.map((t) => {
            const st = TEMPLATE_STYLES[t.kind];
            return (
              <div
                key={t.tag}
                className={cn(
                  "rounded-xl border border-line border-l-4 bg-surface p-3.5",
                  st.accent,
                )}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className={cn("pill", st.chip)}>{t.tag}</span>
                  {t.superAdminOnly ? (
                    <span className="flex items-center gap-1 text-[11px] font-medium text-muted">
                      <Lock size={11} /> SUPER ADMIN ONLY
                    </span>
                  ) : (
                    <button className="flex items-center gap-1 text-[11px] font-medium text-duyo-blue hover:text-duyo-dark">
                      <Pencil size={11} /> Edit
                    </button>
                  )}
                </div>
                <div className="text-sm font-semibold text-ink">{t.title}</div>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted">{t.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Channel breakdown — backend summary.by_channel                      */
/* ------------------------------------------------------------------ */

function ChannelBreakdownCard({ summary }: { summary: CampaignSummary | undefined }) {
  const byChannel = summary?.by_channel ?? {};
  const channels: CampaignChannel[] = ["push", "sms", "email", "in_app"];
  const total = channels.reduce((s, c) => s + (byChannel[c] ?? 0), 0);

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-line px-5 py-3">
        <Bell size={16} className="text-muted" />
        <h2 className="text-sm font-semibold text-ink">Kanal bo'yicha taqsimot</h2>
      </div>
      <div className="space-y-3 p-5">
        {channels.map((c) => {
          const count = byChannel[c] ?? 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const Icon = CHANNEL_PILL[c].icon;
          return (
            <div key={c}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-ink">
                  <Icon size={14} className="text-muted" /> {CHANNEL_LABEL[c]}
                </span>
                <span className="text-muted">{count}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-bg">
                <div className="h-full rounded-full bg-duyo-blue" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Templates-only tab                                                  */
/* ------------------------------------------------------------------ */

function TemplatesTab() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <TemplateGallery />
      <div className="card p-5">
        <h2 className="mb-3 text-sm font-semibold text-ink">Shablon qoidalari</h2>
        <ul className="space-y-2.5 text-sm text-muted">
          <li className="flex items-start gap-2">
            <Lock size={15} className="mt-0.5 shrink-0 text-urgent" />
            RED va ORANGE shablonlar — faqat Super Admin tahrirlay oladi (audit log'ga yoziladi).
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-safe" />
            DAILY va PAYMENT shablonlar — kontent jamoasi tahrirlashi mumkin.
          </li>
          <li className="flex items-start gap-2">
            <Clock size={15} className="mt-0.5 shrink-0 text-muted" />
            Barcha shablonlar Sokin vaqt qoidasiga bo'ysunadi (RED bundan mustasno).
          </li>
        </ul>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Logs-only tab                                                       */
/* ------------------------------------------------------------------ */

function LogsTab({
  campaigns,
  query,
  summary,
  handlers,
  pendingId,
}: {
  campaigns: CampaignRow[];
  query: CampaignsQuery;
  summary: CampaignSummary | undefined;
  handlers: RowHandlers;
  pendingId: string | null;
}) {
  return (
    <div className="space-y-6">
      <SummaryStrip summary={summary} loading={query.isLoading} />
      <CampaignListCard
        rows={campaigns}
        query={query}
        handlers={handlers}
        pendingId={pendingId}
      />
    </div>
  );
}
