import { useState } from "react";
import {
  Megaphone,
  Bell,
  MessageSquare,
  Mail,
  LayoutTemplate,
  ScrollText,
  AlertTriangle,
  Eye,
  Send,
  Rocket,
  Download,
  RefreshCw,
  Lock,
  Pencil,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  Hourglass,
  TrendingUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type ChannelKey = "campaigns" | "push" | "sms" | "email" | "templates" | "logs";
type DeliveryStatus = "sent" | "delivered" | "failed" | "queued";
type TemplateKind = "red" | "orange" | "daily" | "payment";

interface ChannelTab {
  key: ChannelKey;
  label: string;
  icon: LucideIcon;
}

interface DeliveryRow {
  id: string;
  recipient: string;
  channel: string;
  template: string;
  status: DeliveryStatus;
  provider: string;
  time: string;
}

interface NotificationTemplate {
  kind: TemplateKind;
  tag: string;
  title: string;
  body: string;
  superAdminOnly: boolean;
}

interface AudienceSegment {
  value: string;
  label: string;
  size: string;
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

const AUDIENCE_SEGMENTS: AudienceSegment[] = [
  { value: "all-children", label: "Barcha bolalar", size: "1,284" },
  { value: "active-children", label: "Faol bolalar (7 kun)", size: "962" },
  { value: "all-parents", label: "Barcha ota-onalar", size: "874" },
  { value: "premium-parents", label: "Premium ota-onalar", size: "318" },
  { value: "inactive", label: "Passiv (48 soat)", size: "147" },
];

const AGE_SEGMENTS = ["Barcha yoshlar", "6-9", "6-12", "10-13", "13-16"];

const LANGUAGES = ["O'zbek", "Rus", "Ingliz"];

const STATUS_STYLES: Record<
  DeliveryStatus,
  { label: string; pill: string; dot: string; icon: LucideIcon }
> = {
  sent: {
    label: "SENT",
    pill: "bg-duyo-50 text-duyo-dark border border-duyo-100",
    dot: "bg-duyo-blue",
    icon: Send,
  },
  delivered: {
    label: "DELIVERED",
    pill: "bg-safe-bg text-safe border border-safe-line",
    dot: "bg-safe",
    icon: CheckCircle2,
  },
  failed: {
    label: "FAILED",
    pill: "bg-urgent-bg text-urgent border border-urgent-line",
    dot: "bg-urgent",
    icon: XCircle,
  },
  queued: {
    label: "QUEUED",
    pill: "bg-warn-bg text-warn border border-warn-line",
    dot: "bg-warn",
    icon: Hourglass,
  },
};

const TEMPLATE_STYLES: Record<
  TemplateKind,
  { accent: string; chip: string }
> = {
  red: { accent: "border-l-urgent", chip: "bg-urgent-bg text-urgent border border-urgent-line" },
  orange: { accent: "border-l-serious", chip: "bg-serious-bg text-serious border border-serious-line" },
  daily: { accent: "border-l-safe", chip: "bg-safe-bg text-safe border border-safe-line" },
  payment: { accent: "border-l-duyo-blue", chip: "bg-duyo-50 text-duyo-dark border border-duyo-100" },
};

/* ------------------------------------------------------------------ */
/* MOCK data — backend (NotificationService) ulanmaguncha namuna.      */
/* ------------------------------------------------------------------ */

const DELIVERY_LOG: DeliveryRow[] = [
  { id: "#DLV-50231", recipient: "u***_882@mail.com", channel: "Email", template: "Daily Report", status: "sent", provider: "SendGrid", time: "12:45:01" },
  { id: "#DLV-50230", recipient: "+998 90 *** 12 34", channel: "SMS", template: "Payment Failed", status: "failed", provider: "Twilio", time: "12:44:30" },
  { id: "#DLV-50229", recipient: "dev_app_id_99", channel: "Push", template: "Content Rec", status: "delivered", provider: "Firebase", time: "12:42:15" },
  { id: "#DLV-50228", recipient: "a***_104@gmail.com", channel: "Email", template: "Subscription Renewal", status: "delivered", provider: "SendGrid", time: "12:40:58" },
  { id: "#DLV-50227", recipient: "+998 93 *** 88 01", channel: "SMS", template: "Quiet Hours Reminder", status: "queued", provider: "Twilio", time: "12:39:22" },
  { id: "#DLV-50226", recipient: "child_dev_2231", channel: "Push", template: "Daily Goal", status: "delivered", provider: "Firebase", time: "12:37:44" },
  { id: "#DLV-50225", recipient: "+998 91 *** 45 67", channel: "SMS", template: "RED Alert", status: "failed", provider: "Twilio", time: "12:35:10" },
];

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

const MONTHLY_STATS: { label: string; value: string; delta: string; positive: boolean }[] = [
  { label: "Push yuborildi", value: "1.2M", delta: "+12%", positive: true },
  { label: "Email ochildi", value: "38.4%", delta: "+3%", positive: true },
  { label: "SMS yetkazildi", value: "97.1%", delta: "-1%", positive: false },
  { label: "Yetkazilmadi", value: "2.4K", delta: "-8%", positive: true },
];

const CHANNEL_PREVIEW: Record<Exclude<ChannelKey, "campaigns" | "templates" | "logs">, { title: string; note: string }> = {
  push: { title: "Push bildirishnomalar", note: "Firebase Cloud Messaging orqali mobil qurilmalarga." },
  sms: { title: "SMS xabarlar", note: "Twilio orqali ota-ona raqamlariga (faqat muhim hodisalar)." },
  email: { title: "Email xabarlar", note: "SendGrid orqali kunlik hisobotlar va to'lov bildirishnomalari." },
};

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function Notifications() {
  const [activeTab, setActiveTab] = useState<ChannelKey>("campaigns");

  return (
    <div>
      <PageHeader
        title="Bildirishnomalar"
        subtitle="Kampaniyalar, shablonlar va yetkazib berish monitoringi"
        actions={
          <span className="pill bg-urgent-bg text-urgent border border-urgent-line">
            <AlertTriangle size={13} /> 2 ta xato yetkazib berish
          </span>
        }
      />

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
        activeTab === "email") && <CampaignTab activeTab={activeTab} />}

      {activeTab === "templates" && <TemplatesTab />}

      {activeTab === "logs" && <LogsTab />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Campaign builder + delivery log + stats                             */
/* ------------------------------------------------------------------ */

function CampaignTab({ activeTab }: { activeTab: ChannelKey }) {
  const channelNote =
    activeTab !== "campaigns" ? CHANNEL_PREVIEW[activeTab as keyof typeof CHANNEL_PREVIEW] : null;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      {/* Left + middle: builder & log */}
      <div className="space-y-6 xl:col-span-2">
        {channelNote && (
          <div className="card flex items-start gap-3 p-4">
            <Bell size={18} className="mt-0.5 shrink-0 text-duyo-blue" />
            <div className="text-sm text-muted">
              <span className="font-semibold text-ink">{channelNote.title}.</span> {channelNote.note}
            </div>
          </div>
        )}

        <CampaignBuilder />
        <DeliveryLogCard />
      </div>

      {/* Right: template gallery + stats */}
      <div className="space-y-6">
        <TemplateGallery />
        <MonthlyStatsCard />
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

function CampaignBuilder() {
  const [quietHours, setQuietHours] = useState(true);
  const [channel, setChannel] = useState<string>("Push");

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <div className="flex items-center gap-2">
          <Megaphone size={16} className="text-duyo-blue" />
          <h2 className="text-sm font-semibold text-ink">Yangi kampaniya yaratish</h2>
        </div>
        <span className="pill bg-bg text-muted border border-line">DRAFT ID: #9942</span>
      </div>

      <div className="space-y-4 p-5">
        <div>
          <FieldLabel>Kampaniya nomi</FieldLabel>
          <input className={INPUT_CLS} placeholder="Masalan: Yozgi tahrir kampaniyasi" />
        </div>

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
            </select>
          </div>
          <div>
            <FieldLabel>Yosh segmenti</FieldLabel>
            <select className={INPUT_CLS} defaultValue="6-12">
              {AGE_SEGMENTS.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel>Til</FieldLabel>
            <select className={INPUT_CLS} defaultValue="O'zbek">
              {LANGUAGES.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Audience segment selector */}
        <div>
          <FieldLabel>Auditoriya</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {AUDIENCE_SEGMENTS.map((seg, i) => (
              <button
                key={seg.value}
                type="button"
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium",
                  i === 0
                    ? "border-duyo-blue bg-duyo-50 text-duyo-dark"
                    : "border-line text-muted hover:bg-bg",
                )}
              >
                {seg.label}
                <span className="text-xs opacity-70">{seg.size}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <FieldLabel>Xabar sarlavhasi</FieldLabel>
          <input className={INPUT_CLS} placeholder="Qisqa va aniq sarlavha" maxLength={64} />
        </div>

        <div>
          <FieldLabel>Xabar matni</FieldLabel>
          <textarea
            rows={4}
            className={cn(INPUT_CLS, "resize-none")}
            placeholder="Foydalanuvchiga yuboriladigan asosiy matn..."
          />
          <p className="mt-1 text-xs text-muted">Maksimal 240 belgi. O'zgaruvchilar: {"{ism}, {yosh}"}</p>
        </div>

        {/* Schedule + quiet hours */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel>Rejalashtirish</FieldLabel>
            <div className="flex items-center gap-2">
              <Clock size={16} className="shrink-0 text-muted" />
              <input type="date" className={INPUT_CLS} />
              <input type="time" defaultValue="09:00" className={INPUT_CLS} />
            </div>
          </div>
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
          <button className="flex items-center gap-1.5 rounded-xl border border-line px-3.5 py-2 text-sm font-medium text-ink hover:bg-bg">
            <Eye size={15} /> Preview
          </button>
          <button className="flex items-center gap-1.5 rounded-xl border border-line px-3.5 py-2 text-sm font-medium text-ink hover:bg-bg">
            <Send size={15} /> Test yuborish
          </button>
          <button className="ml-auto flex items-center gap-1.5 rounded-xl bg-duyo-blue px-4 py-2 text-sm font-semibold text-white hover:bg-duyo-dark">
            <Rocket size={15} /> Kampaniyani nashr etish
          </button>
        </div>
      </div>
    </div>
  );
}

function DeliveryLogCard() {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <div className="flex items-center gap-2">
          <ScrollText size={16} className="text-muted" />
          <h2 className="text-sm font-semibold text-ink">Yetkazib berish jurnali</h2>
        </div>
        <button className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-ink hover:bg-bg">
          <Download size={13} /> Eksport qilish (CSV)
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-muted">
              <th className="px-5 py-3">Qabul qiluvchi</th>
              <th className="px-3 py-3">Kanal</th>
              <th className="px-3 py-3">Shablon</th>
              <th className="px-3 py-3">Holat</th>
              <th className="px-3 py-3">Provayder</th>
              <th className="px-3 py-3">Vaqt</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {DELIVERY_LOG.map((row) => {
              const s = STATUS_STYLES[row.status];
              return (
                <tr key={row.id} className="border-b border-line/70 last:border-0">
                  <td className="px-5 py-3 font-medium text-ink">{row.recipient}</td>
                  <td className="px-3 py-3 text-muted">{row.channel}</td>
                  <td className="px-3 py-3 text-ink">{row.template}</td>
                  <td className="px-3 py-3">
                    <span className={cn("pill", s.pill)}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} /> {s.label}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-muted">{row.provider}</td>
                  <td className="px-3 py-3 text-xs text-muted">{row.time}</td>
                  <td className="px-3 py-3">
                    {row.status === "failed" ? (
                      <button className="flex items-center gap-1 rounded-lg border border-urgent-line bg-urgent-bg px-2.5 py-1 text-xs font-medium text-urgent hover:bg-urgent-bg/70">
                        <RefreshCw size={13} /> Qayta urinish
                      </button>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TemplateGallery() {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <div className="flex items-center gap-2">
          <LayoutTemplate size={16} className="text-muted" />
          <h2 className="text-sm font-semibold text-ink">Shablonlar galereyasi</h2>
        </div>
        <button className="flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-ink hover:bg-bg">
          <Plus size={13} /> Yangi shablon
        </button>
      </div>

      <div className="p-4">
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-warn-line bg-warn-bg p-3 text-xs text-warn">
          <Lock size={14} className="mt-0.5 shrink-0" />
          <span>
            RED/ORANGE shablonlari faqat Super Admin tomonidan tahrirlanishi mumkin.
          </span>
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

function MonthlyStatsCard() {
  return (
    <div className="card overflow-hidden bg-ink text-white">
      <div className="flex items-center gap-2 border-b border-white/10 px-5 py-3">
        <TrendingUp size={16} className="text-white/70" />
        <h2 className="text-sm font-semibold">Oylik statistika</h2>
      </div>
      <div className="grid grid-cols-2 gap-px bg-white/10">
        {MONTHLY_STATS.map((s) => (
          <div key={s.label} className="bg-ink p-4">
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="mt-0.5 text-xs text-white/60">{s.label}</div>
            <div
              className={cn(
                "mt-1 text-xs font-medium",
                s.positive ? "text-safe" : "text-urgent",
              )}
            >
              {s.delta} {s.positive ? "↑" : "↓"}
            </div>
          </div>
        ))}
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

function LogsTab() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {MONTHLY_STATS.map((s) => (
          <div key={s.label} className="card p-4">
            <div className="text-xs font-medium text-muted">{s.label}</div>
            <div className="mt-1 text-2xl font-bold text-ink">{s.value}</div>
            <div className={cn("mt-1 text-xs font-medium", s.positive ? "text-safe" : "text-urgent")}>
              {s.delta} {s.positive ? "↑" : "↓"}
            </div>
          </div>
        ))}
      </div>
      <DeliveryLogCard />
    </div>
  );
}
