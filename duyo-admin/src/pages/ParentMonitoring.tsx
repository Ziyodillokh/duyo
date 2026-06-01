import { useState } from "react";
import {
  ShieldCheck,
  FileDown,
  Plus,
  FileBarChart2,
  MailCheck,
  MailOpen,
  AlertTriangle,
  Clock,
  Bell,
  MessageSquare,
  Smartphone,
  Mail,
  Link2,
  Lock,
  Eye,
  RefreshCw,
  FileText,
  MoreVertical,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { cn } from "@/lib/utils";

/**
 * Ota-ona monitoringi — 10-kunlik hisobot dashboardi.
 * MOCK data — backend (reports / alerts / SMS delivery) ulanmaguncha namuna.
 * Maxfiylik qoidasi: ota-onalar faqat aggregatsiyalangan faollik + xavfsizlik
 * alertlarini ko'radi, xom suhbat matnini EMAS.
 */

type KpiTone = "blue" | "safe" | "warn" | "urgent" | "muted";

interface Kpi {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tone: KpiTone;
}

const KPI_TONE: Record<KpiTone, { icon: string; value: string }> = {
  blue: { icon: "text-duyo-blue", value: "text-ink" },
  safe: { icon: "text-safe", value: "text-ink" },
  warn: { icon: "text-warn", value: "text-ink" },
  urgent: { icon: "text-urgent", value: "text-urgent" },
  muted: { icon: "text-muted", value: "text-ink" },
};

const KPIS: Kpi[] = [
  { label: "Generatsiya qilingan", value: "1,198", hint: "So'nggi 10 kun", icon: FileBarChart2, tone: "blue" },
  { label: "Yuborilgan hisobotlar", value: "1,142", hint: "96.6% muvaffaqiyat", icon: MailCheck, tone: "safe" },
  { label: "Ochilgan hisobotlar", value: "854", hint: "74.8% ochildi", icon: MailOpen, tone: "muted" },
  { label: "Muvaffaqiyatsiz SMSlar", value: "12", hint: "Qayta yuborish kerak", icon: AlertTriangle, tone: "urgent" },
  { label: "O'rtacha javob vaqti", value: "42 min", hint: "Standart: 60 min", icon: Clock, tone: "muted" },
  { label: "Xavfsizlik signallari", value: "8", hint: "Arxivlanmagan: 2", icon: Bell, tone: "warn" },
];

// 10 kunlik hisobot trendi (generatsiya / yuborilgan / ochilgan).
const TREND: { day: string; gen: number; sent: number; opened: number }[] = [
  { day: "22-May", gen: 118, sent: 114, opened: 86 },
  { day: "23-May", gen: 121, sent: 117, opened: 90 },
  { day: "24-May", gen: 109, sent: 104, opened: 78 },
  { day: "25-May", gen: 126, sent: 122, opened: 95 },
  { day: "26-May", gen: 131, sent: 124, opened: 88 },
  { day: "27-May", gen: 114, sent: 110, opened: 81 },
  { day: "28-May", gen: 122, sent: 119, opened: 92 },
  { day: "29-May", gen: 128, sent: 121, opened: 87 },
  { day: "30-May", gen: 116, sent: 112, opened: 79 },
  { day: "31-May", gen: 113, sent: 99, opened: 78 },
];

type ReportStatus = "sent" | "opened" | "pending" | "failed";

interface Report {
  child: string;
  initials: string;
  age: number;
  period: string;
  status: ReportStatus;
  opened: boolean;
  risk: { label: string; tone: "safe" | "warn" | "serious" };
}

const REPORT_STATUS: Record<ReportStatus, { label: string; cls: string }> = {
  sent: { label: "Yuborildi", cls: "text-safe" },
  opened: { label: "Ochildi", cls: "text-duyo-blue" },
  pending: { label: "Kutilmoqda", cls: "text-muted" },
  failed: { label: "Xato", cls: "text-urgent" },
};

const REPORTS: Report[] = [
  { child: "Azizbek A.", initials: "AA", age: 8, period: "10–20 May", status: "opened", opened: true, risk: { label: "Low Risk", tone: "safe" } },
  { child: "Shahlo H.", initials: "SH", age: 11, period: "10–20 May", status: "pending", opened: false, risk: { label: "Analyzing", tone: "warn" } },
  { child: "Jasur B.", initials: "JB", age: 9, period: "10–20 May", status: "sent", opened: false, risk: { label: "Med Risk", tone: "serious" } },
  { child: "Malika R.", initials: "MR", age: 7, period: "10–20 May", status: "opened", opened: true, risk: { label: "Low Risk", tone: "safe" } },
  { child: "Bobur T.", initials: "BT", age: 12, period: "10–20 May", status: "failed", opened: false, risk: { label: "Low Risk", tone: "safe" } },
];

const RISK_BADGE: Record<Report["risk"]["tone"], string> = {
  safe: "bg-safe-bg text-safe border border-safe-line",
  warn: "bg-warn-bg text-warn border border-warn-line",
  serious: "bg-serious-bg text-serious border border-serious-line",
};

interface ParentAlert {
  level: "RED" | "ORANGE" | "YELLOW";
  child: string;
  parent: string;
  channels: { sms: boolean; push: boolean; call: boolean };
  sentAt: string;
  state: "Faol" | "Yopildi" | "Kutilmoqda";
}

const ALERT_LEVEL: Record<ParentAlert["level"], string> = {
  RED: "bg-urgent-bg text-urgent border border-urgent-line",
  ORANGE: "bg-serious-bg text-serious border border-serious-line",
  YELLOW: "bg-warn-bg text-warn border border-warn-line",
};

const ALERTS: ParentAlert[] = [
  { level: "RED", child: "Jasur B.", parent: "Ota: Murod B.", channels: { sms: true, push: true, call: true }, sentAt: "Bugun, 14:22", state: "Faol" },
  { level: "ORANGE", child: "Malika R.", parent: "Ona: Sevara R.", channels: { sms: true, push: true, call: false }, sentAt: "Kecha, 09:10", state: "Yopildi" },
  { level: "YELLOW", child: "Bobur T.", parent: "Ota: Tohir T.", channels: { sms: true, push: false, call: false }, sentAt: "30-May, 18:40", state: "Kutilmoqda" },
];

type SmsStatus = "delivered" | "pending" | "failed";

interface SmsLog {
  phone: string;
  message: string;
  status: SmsStatus;
  time: string;
  error?: string;
}

const SMS_STATUS: Record<SmsStatus, { label: string; cls: string }> = {
  delivered: { label: "Yetkazildi", cls: "bg-safe-bg text-safe border border-safe-line" },
  pending: { label: "Kutilmoqda", cls: "bg-warn-bg text-warn border border-warn-line" },
  failed: { label: "Xato", cls: "bg-urgent-bg text-urgent border border-urgent-line" },
};

const SMS_LOGS: SmsLog[] = [
  { phone: "+998 90 *** 45 67", message: "Haftalik hisobot yetkazildi", status: "delivered", time: "14:05" },
  { phone: "+998 93 *** 12 34", message: "RED alert yuborildi", status: "failed", time: "13:48", error: "Network Timeout Error" },
  { phone: "+998 94 *** 90 55", message: "Hisobot havolasi", status: "failed", time: "13:30", error: "Storage error detected" },
  { phone: "+998 91 *** 77 02", message: "PIN tiklash kodi", status: "delivered", time: "12:58" },
  { phone: "+998 99 *** 31 18", message: "Haftalik hisobot yetkazildi", status: "pending", time: "12:40" },
];

interface Template {
  name: string;
  channel: "SMS" | "Push" | "Email";
  body: string;
  icon: LucideIcon;
}

const TEMPLATES: Template[] = [
  { name: "SMS hisobot shabloni", channel: "SMS", icon: MessageSquare, body: "DUYO: {bola} bo'yicha haftalik hisobot tayyor. Ochish: {havola}" },
  { name: "RED alert shabloni", channel: "SMS", icon: AlertTriangle, body: "DIQQAT: {bola} suhbatida xavfli signal aniqlandi. Zudlik bilan aloqaga chiqing: {tel}" },
  { name: "Push xush kelibsiz", channel: "Push", icon: Smartphone, body: "{bola} bugun DUYO bilan {daqiqa} daqiqa faol bo'ldi." },
  { name: "Email oylik xulosa", channel: "Email", icon: Mail, body: "{bola} oylik faollik va kayfiyat xulosasi ilova qilindi." },
];

const TEMPLATE_LANGS = ["UZ", "RU", "EN"] as const;

interface DashboardLink {
  parent: string;
  child: string;
  pinSet: boolean;
  lastOpened: string;
}

const DASHBOARD_LINKS: DashboardLink[] = [
  { parent: "Murod B.", child: "Jasur B.", pinSet: true, lastOpened: "Bugun, 14:25" },
  { parent: "Sevara R.", child: "Malika R.", pinSet: true, lastOpened: "Kecha, 09:12" },
  { parent: "Tohir T.", child: "Bobur T.", pinSet: false, lastOpened: "Hech qachon" },
];

const TOPICS = ["Koinot", "Lego", "Robototexnika", "Matematika"];

function ChannelDot({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      title={label}
      className={cn(
        "inline-flex h-5 w-6 items-center justify-center rounded-md text-[10px] font-semibold",
        on ? "bg-safe-bg text-safe" : "bg-bg text-muted",
      )}
    >
      {label}
    </span>
  );
}

export function ParentMonitoring() {
  const [lang, setLang] = useState<(typeof TEMPLATE_LANGS)[number]>("UZ");

  return (
    <div>
      <PageHeader
        title="Ota-ona monitoringi"
        subtitle="Hisobotlar, ogohlantirishlar va ota-onalar bilan aloqa boshqaruvi"
        actions={
          <>
            <button className="flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm font-medium text-ink hover:border-duyo-blue hover:bg-duyo-50">
              <FileDown size={15} /> PDF Hisobot Yuklash
            </button>
            <button className="flex items-center gap-1.5 rounded-xl bg-duyo-blue px-3 py-2 text-sm font-medium text-white hover:bg-duyo-dark">
              <Plus size={15} /> Yangi Alert Yaratish
            </button>
          </>
        }
      />

      {/* Maxfiylik banneri — kritik qoida */}
      <div className="mb-5 flex items-start gap-3 rounded-2xl border border-safe-line bg-safe-bg p-4">
        <ShieldCheck size={18} className="mt-0.5 shrink-0 text-safe" />
        <div className="text-sm text-ink">
          <span className="font-semibold">Maxfiylik:</span> Ota-onalar aggregatsiyalangan
          faollik va xavfsizlik ogohlantirishlarini ko'radi, xom suhbatni EMAS.
        </div>
      </div>

      {/* KPI grid — 10-kunlik report ko'rsatkichlari */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {KPIS.map((k) => {
          const Icon = k.icon;
          const tone = KPI_TONE[k.tone];
          return (
            <div key={k.label} className="card p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted">{k.label}</span>
                <Icon size={16} className={tone.icon} />
              </div>
              <div className={cn("mt-2 text-2xl font-bold", tone.value)}>{k.value}</div>
              {k.hint && <div className="mt-1 text-[11px] text-muted">{k.hint}</div>}
            </div>
          );
        })}
      </div>

      {/* Trend chart */}
      <div className="card mb-6 p-5">
        <div className="mb-4 flex items-center gap-2">
          <FileBarChart2 size={16} className="text-duyo-blue" />
          <h2 className="text-sm font-semibold text-ink">10 kunlik hisobot oqimi</h2>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={TREND} barGap={2} barCategoryGap="22%">
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} width={32} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0", fontSize: 12 }}
                cursor={{ fill: "rgba(37,99,235,0.06)" }}
              />
              <Bar dataKey="gen" name="Generatsiya" fill="#DBEAFE" radius={[4, 4, 0, 0]} />
              <Bar dataKey="sent" name="Yuborilgan" fill="#2563EB" radius={[4, 4, 0, 0]} />
              <Bar dataKey="opened" name="Ochilgan" fill="#16A34A" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Generatsiya qilingan hisobotlar jadvali */}
        <div className="card overflow-hidden xl:col-span-2">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-duyo-blue" />
              <h2 className="text-sm font-semibold text-ink">10 kunlik hisobotlar</h2>
            </div>
            <button className="text-xs font-medium text-duyo-blue hover:underline">Hammasini ko'rish</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-muted">
                  <th className="px-5 py-3">Bola</th>
                  <th className="px-3 py-3">Davr</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Ochilgan</th>
                  <th className="px-3 py-3">Xavf xulosasi</th>
                  <th className="px-3 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {REPORTS.map((r) => {
                  const st = REPORT_STATUS[r.status];
                  return (
                    <tr key={r.child} className="border-b border-line/70 last:border-0 hover:bg-bg">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-duyo-50 text-xs font-semibold text-duyo-dark">
                            {r.initials}
                          </span>
                          <div>
                            <div className="font-medium text-ink">{r.child}</div>
                            <div className="text-xs text-muted">{r.age} yosh</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-muted">{r.period}</td>
                      <td className={cn("px-3 py-3 font-medium", st.cls)}>{st.label}</td>
                      <td className="px-3 py-3">
                        {r.opened ? (
                          <Eye size={15} className="text-safe" />
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span className={cn("pill", RISK_BADGE[r.risk.tone])}>{r.risk.label}</span>
                      </td>
                      <td className="px-3 py-3">
                        <button className="rounded-lg p-1 text-muted hover:bg-bg hover:text-ink">
                          <MoreVertical size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Hisobot ko'rinishi — PREVIEW */}
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Hisobot ko'rinishi</h2>
            <span className="pill bg-ink text-white">PREVIEW</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-duyo-50 text-sm font-semibold text-duyo-dark">
              AA
            </span>
            <div>
              <div className="font-semibold text-ink">Azizbek</div>
              <div className="text-xs text-muted">10 – 20 May hisoboti</div>
            </div>
          </div>

          <div className="mt-4 space-y-3 text-sm">
            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-muted">
                <span>Faollik darajasi</span>
                <span className="font-medium text-ink">Yuqori</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-bg">
                <div className="h-full w-4/5 rounded-full bg-duyo-blue" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-line p-3">
                <div className="text-[11px] uppercase tracking-wide text-muted">Kayfiyat</div>
                <div className="mt-0.5 font-medium text-safe">Pozitiv</div>
              </div>
              <div className="rounded-xl border border-line p-3">
                <div className="text-[11px] uppercase tracking-wide text-muted">Xavf</div>
                <div className="mt-0.5 font-medium text-ink">Past</div>
              </div>
            </div>
            <div>
              <div className="mb-1.5 text-[11px] uppercase tracking-wide text-muted">Asosiy mavzular</div>
              <div className="flex flex-wrap gap-1.5">
                {TOPICS.map((t) => (
                  <span key={t} className="pill bg-duyo-50 text-duyo-dark">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <button className="mt-4 w-full rounded-xl bg-duyo-blue py-2.5 text-sm font-medium text-white hover:bg-duyo-dark">
            To'liq hisobotni yuborish
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Ota-ona ogohlantirishlari */}
        <div className="card overflow-hidden xl:col-span-2">
          <div className="flex items-center gap-2 border-b border-line px-5 py-3">
            <Bell size={16} className="text-serious" />
            <h2 className="text-sm font-semibold text-ink">Ota-ona ogohlantirishlari (Alerts)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-muted">
                  <th className="px-5 py-3">Daraja</th>
                  <th className="px-3 py-3">Bola / Ota-ona</th>
                  <th className="px-3 py-3">Kanallar (S/P/Q)</th>
                  <th className="px-3 py-3">Yuborilgan</th>
                  <th className="px-3 py-3">Holat</th>
                </tr>
              </thead>
              <tbody>
                {ALERTS.map((a) => (
                  <tr key={a.child} className="border-b border-line/70 last:border-0 hover:bg-bg">
                    <td className="px-5 py-3">
                      <span className={cn("pill", ALERT_LEVEL[a.level])}>{a.level}</span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-medium text-ink">{a.child}</div>
                      <div className="text-xs text-muted">{a.parent}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <ChannelDot on={a.channels.sms} label="S" />
                        <ChannelDot on={a.channels.push} label="P" />
                        <ChannelDot on={a.channels.call} label="Q" />
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs text-muted">{a.sentAt}</td>
                    <td className="px-3 py-3">
                      <span
                        className={cn(
                          "text-xs font-medium",
                          a.state === "Faol" ? "text-urgent" : a.state === "Yopildi" ? "text-safe" : "text-muted",
                        )}
                      >
                        {a.state}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Oxirgi SMS loglar */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <div className="flex items-center gap-2">
              <MessageSquare size={16} className="text-duyo-blue" />
              <h2 className="text-sm font-semibold text-ink">Oxirgi SMS loglar</h2>
            </div>
            <button className="flex items-center gap-1 text-xs font-medium text-duyo-blue hover:underline">
              <RefreshCw size={12} /> Yangilash
            </button>
          </div>
          <ul className="divide-y divide-line">
            {SMS_LOGS.map((s, i) => {
              const st = SMS_STATUS[s.status];
              return (
                <li key={`${s.phone}-${i}`} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-ink">{s.phone}</span>
                    <span className="text-xs text-muted">{s.time}</span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-muted">{s.message}</span>
                    <span className={cn("pill shrink-0", st.cls)}>{st.label}</span>
                  </div>
                  {s.error && <div className="mt-1 text-[11px] text-urgent">{s.error}</div>}
                </li>
              );
            })}
          </ul>
          <div className="border-t border-line px-5 py-3">
            <button className="text-xs font-medium text-duyo-blue hover:underline">
              Barcha loglarni ko'rish
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Shablonlar boshqaruvi */}
        <div className="card p-5 xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-duyo-blue" />
              <h2 className="text-sm font-semibold text-ink">Shablonlar boshqaruvi</h2>
            </div>
            <div className="flex items-center gap-1 rounded-full border border-line p-0.5">
              {TEMPLATE_LANGS.map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium",
                    lang === l ? "bg-duyo-blue text-white" : "text-muted hover:text-ink",
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {TEMPLATES.map((t) => {
              const Icon = t.icon;
              return (
                <div key={t.name} className="rounded-xl border border-line p-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon size={15} className="text-duyo-blue" />
                      <span className="text-sm font-medium text-ink">{t.name}</span>
                    </div>
                    <span className="pill bg-bg text-muted">{t.channel}</span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-muted">{t.body}</p>
                  <div className="mt-2 text-[11px] text-muted">Til: {lang}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* PIN-himoyalangan web dashboard havolalari */}
        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Link2 size={16} className="text-duyo-blue" />
            <h2 className="text-sm font-semibold text-ink">Web dashboard havolalari</h2>
          </div>
          <ul className="space-y-3">
            {DASHBOARD_LINKS.map((d) => (
              <li key={d.parent} className="rounded-xl border border-line p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-ink">{d.parent}</div>
                    <div className="text-xs text-muted">Bola: {d.child}</div>
                  </div>
                  <span
                    className={cn(
                      "pill",
                      d.pinSet
                        ? "bg-safe-bg text-safe border border-safe-line"
                        : "bg-warn-bg text-warn border border-warn-line",
                    )}
                  >
                    <Lock size={11} /> {d.pinSet ? "PIN o'rnatilgan" : "PIN yo'q"}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
                  <span>Oxirgi kirish: {d.lastOpened}</span>
                  <button className="font-medium text-duyo-blue hover:underline">Havolani nusxalash</button>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] leading-relaxed text-muted">
            Havolalar 4-xonali PIN bilan himoyalanadi. PIN tiklash kodi faqat ro'yxatdan
            o'tgan ota-ona raqamiga yuboriladi.
          </p>
        </div>
      </div>

      <p className="mt-4 text-xs text-muted">
        Eslatma: ota-onalarga ko'rsatiladigan barcha ma'lumotlar aggregatsiyalangan —
        xom suhbat matni hech qachon eksport qilinmaydi.
      </p>
    </div>
  );
}
