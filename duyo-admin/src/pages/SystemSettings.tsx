import { useState } from "react";
import {
  Crown,
  ShieldAlert,
  FileCheck2,
  LifeBuoy,
  Wallet,
  School,
  UserCog,
  Eye,
  Check,
  X,
  Pencil,
  Server,
  Cpu,
  Database,
  ListChecks,
  Mic,
  Filter,
  Download,
  ShieldCheck,
  Lock,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────
// MOCK ma'lumotlar — backend ulanmaguncha namuna.
// ─────────────────────────────────────────────────────────────

type PermLevel = "full" | "view" | "edit" | "none";

interface AdminRole {
  key: string;
  name: string;
  desc: string;
  icon: LucideIcon;
  accent: string; // tailwind text color
  badge: string; // tailwind pill classes
  members: number;
}

const ROLES: AdminRole[] = [
  { key: "super", name: "Super Admin", desc: "To'liq tizim kirishi va sozlamalar", icon: Crown, accent: "text-duyo-blue", badge: "bg-duyo-50 text-duyo-dark border border-duyo-100", members: 2 },
  { key: "admin", name: "Admin", desc: "Operatsion boshqaruv", icon: UserCog, accent: "text-ink", badge: "bg-bg text-muted border border-line", members: 5 },
  { key: "safety", name: "Safety Officer", desc: "Inqiroz va xavfsizlik nazorati", icon: ShieldAlert, accent: "text-urgent", badge: "bg-urgent-bg text-urgent border border-urgent-line", members: 6 },
  { key: "content", name: "Content Manager", desc: "Kontent va o'quv materiallari", icon: FileCheck2, accent: "text-serious", badge: "bg-serious-bg text-serious border border-serious-line", members: 4 },
  { key: "support", name: "Support Agent", desc: "Foydalanuvchi qo'llab-quvvatlash", icon: LifeBuoy, accent: "text-warn", badge: "bg-warn-bg text-warn border border-warn-line", members: 9 },
  { key: "finance", name: "Finance Manager", desc: "To'lovlar va moliyaviy hisobot", icon: Wallet, accent: "text-safe", badge: "bg-safe-bg text-safe border border-safe-line", members: 2 },
  { key: "school", name: "School Admin", desc: "Maktab va sinflarni boshqarish", icon: School, accent: "text-duyo-dark", badge: "bg-duyo-50 text-duyo-dark border border-duyo-100", members: 11 },
  { key: "analyst", name: "Read-only Analyst", desc: "Faqat o'qish — tahlil va hisobot", icon: Eye, accent: "text-muted", badge: "bg-bg text-muted border border-line", members: 3 },
];

interface PermissionRow {
  module: string;
  // role.key -> level
  levels: Record<string, PermLevel>;
}

const f = "full" as const;
const v = "view" as const;
const e = "edit" as const;
const n = "none" as const;

const PERMISSIONS: PermissionRow[] = [
  { module: "Xavfsizlik markazi", levels: { super: f, admin: v, safety: f, content: n, support: v, finance: n, school: n, analyst: v } },
  { module: "Foydalanuvchilar", levels: { super: f, admin: e, safety: v, content: n, support: e, finance: v, school: e, analyst: v } },
  { module: "AI suhbatlar", levels: { super: f, admin: v, safety: f, content: v, support: v, finance: n, school: n, analyst: v } },
  { module: "Kontent / RAG", levels: { super: f, admin: e, safety: n, content: f, support: n, finance: n, school: v, analyst: v } },
  { module: "Moderatsiya", levels: { super: f, admin: e, safety: e, content: e, support: v, finance: n, school: n, analyst: v } },
  { module: "To'lovlar", levels: { super: f, admin: v, safety: n, content: n, support: v, finance: f, school: v, analyst: v } },
  { module: "Maktablar", levels: { super: f, admin: e, safety: n, content: v, support: n, finance: v, school: f, analyst: v } },
  { module: "Tizim sozlamalari", levels: { super: f, admin: n, safety: n, content: n, support: n, finance: n, school: n, analyst: n } },
  { module: "Audit jurnali", levels: { super: f, admin: v, safety: v, content: n, support: n, finance: v, school: n, analyst: v } },
];

const PERM_META: Record<PermLevel, { icon: LucideIcon; cls: string; title: string }> = {
  full: { icon: Check, cls: "text-duyo-blue", title: "To'liq" },
  edit: { icon: Pencil, cls: "text-serious", title: "Tahrirlash" },
  view: { icon: Eye, cls: "text-muted", title: "Ko'rish" },
  none: { icon: X, cls: "text-line", title: "Ruxsat yo'q" },
};

type RolloutStage = "1%" | "10%" | "50%" | "100%";
const ROLLOUT_STAGES: RolloutStage[] = ["1%", "10%", "50%", "100%"];

interface FeatureFlag {
  key: string;
  name: string;
  desc: string;
  enabled: boolean;
  rollout: RolloutStage;
}

const INITIAL_FLAGS: FeatureFlag[] = [
  { key: "voice-beta", name: "Voice Chat (Beta)", desc: "Ovozli muloqot — STT/TTS pipeline", enabled: true, rollout: "10%" },
  { key: "crisis-v2", name: "Crisis Detection v2", desc: "Yangilangan xavf aniqlash modeli", enabled: false, rollout: "1%" },
  { key: "parent-digest", name: "Ota-ona haftalik digest", desc: "Avtomatik haftalik elektron xat", enabled: true, rollout: "100%" },
  { key: "rag-textbook", name: "Darslik RAG qidiruvi", desc: "6-sinf darslik kontekstli javoblar", enabled: true, rollout: "50%" },
];

type ServiceState = "healthy" | "degraded" | "down";

interface ServiceHealth {
  name: string;
  icon: LucideIcon;
  state: ServiceState;
  latency: string;
  uptime: string;
}

const SERVICE_META: Record<ServiceState, { label: string; dot: string; pill: string }> = {
  healthy: { label: "Sog'lom", dot: "bg-safe", pill: "bg-safe-bg text-safe border border-safe-line" },
  degraded: { label: "Sekinlashgan", dot: "bg-warn", pill: "bg-warn-bg text-warn border border-warn-line" },
  down: { label: "Ishlamayapti", dot: "bg-urgent", pill: "bg-urgent-bg text-urgent border border-urgent-line" },
};

const SERVICES: ServiceHealth[] = [
  { name: "API Gateway", icon: Server, state: "healthy", latency: "p95 84ms", uptime: "99.98%" },
  { name: "AI Service (Gemini)", icon: Cpu, state: "degraded", latency: "p95 1.8s", uptime: "99.21%" },
  { name: "PostgreSQL", icon: Database, state: "healthy", latency: "p95 12ms", uptime: "99.99%" },
  { name: "Job Queue", icon: ListChecks, state: "healthy", latency: "3 ta kutilmoqda", uptime: "99.95%" },
  { name: "STT / TTS Worker", icon: Mic, state: "down", latency: "javob yo'q", uptime: "97.40%" },
];

interface AuditEntry {
  id: string;
  admin: string;
  email: string;
  role: string;
  action: string;
  module: string;
  ip: string;
  when: string;
  result: "ok" | "fail";
}

const AUDIT: AuditEntry[] = [
  { id: "a1", admin: "Bahtiyor Jalilov", email: "bahtiyor@duyo.uz", role: "Super Admin", action: "UPDATE_USER_ROLE", module: "Foydalanuvchilar", ip: "176.41.46.92", when: "2 daq oldin", result: "ok" },
  { id: "a2", admin: "Aziz Sobirov", email: "aziz@duyo.uz", role: "Admin", action: "DELETE_LOG_HISTORY", module: "Audit jurnali", ip: "37.110.214.7", when: "18 daq oldin", result: "fail" },
  { id: "a3", admin: "Nilufar Tosheva", email: "nilufar@duyo.uz", role: "Finance Manager", action: "EXPORT_FINANCE_REPORT", module: "To'lovlar", ip: "84.54.78.211", when: "1 soat oldin", result: "ok" },
  { id: "a4", admin: "Zilola Karimova", email: "zilola@duyo.uz", role: "Safety Officer", action: "RESOLVE_CRISIS_EVENT", module: "Xavfsizlik markazi", ip: "213.230.74.10", when: "2 soat oldin", result: "ok" },
  { id: "a5", admin: "Sardor Aliyev", email: "sardor@duyo.uz", role: "Content Manager", action: "PUBLISH_CONTENT", module: "Kontent / RAG", ip: "195.158.16.33", when: "4 soat oldin", result: "ok" },
];

const AUDIT_RESULT_META: Record<AuditEntry["result"], { label: string; cls: string }> = {
  ok: { label: "Muvaffaqiyat", cls: "bg-safe-bg text-safe border border-safe-line" },
  fail: { label: "Rad etildi", cls: "bg-urgent-bg text-urgent border border-urgent-line" },
};

// ─────────────────────────────────────────────────────────────
// Sub-komponentlar
// ─────────────────────────────────────────────────────────────

interface ToggleProps {
  on: boolean;
  onChange: (next: boolean) => void;
  label?: string;
}

function Toggle({ on, onChange, label }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
        on ? "bg-duyo-blue" : "bg-line",
      )}
    >
      <span
        className={cn(
          "inline-block h-5 w-5 transform rounded-full bg-surface shadow-card transition-transform",
          on ? "translate-x-5" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-4 text-base font-semibold text-ink">{children}</h2>;
}

// ─────────────────────────────────────────────────────────────
// Asosiy sahifa
// ─────────────────────────────────────────────────────────────

export function SystemSettings() {
  const [flags, setFlags] = useState<FeatureFlag[]>(INITIAL_FLAGS);
  const [twoFactor, setTwoFactor] = useState(true);
  const [ipAllowlist, setIpAllowlist] = useState(true);
  const [maskNames, setMaskNames] = useState(true);
  const [exportApprovals, setExportApprovals] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState("30");

  const toggleFlag = (key: string) =>
    setFlags((prev) => prev.map((fl) => (fl.key === key ? { ...fl, enabled: !fl.enabled } : fl)));

  const setRollout = (key: string, rollout: RolloutStage) =>
    setFlags((prev) => prev.map((fl) => (fl.key === key ? { ...fl, rollout } : fl)));

  return (
    <div>
      <PageHeader
        title="Tizim sozlamalari"
        subtitle="Rollar, ruxsatlar, feature flag'lar va xavfsizlik"
        actions={
          <span className="pill bg-serious-bg text-serious border border-serious-line">
            <span className="h-1.5 w-1.5 rounded-full bg-serious" /> Production muhiti
          </span>
        }
      />

      {/* ── Admin rollari ── */}
      <section className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <SectionTitle>Admin rollari</SectionTitle>
          <button className="rounded-xl bg-duyo-blue px-3.5 py-2 text-sm font-medium text-white hover:bg-duyo-dark">
            + Yangi rol qo'shish
          </button>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {ROLES.map((r) => {
            const Icon = r.icon;
            return (
              <div key={r.key} className="card p-4">
                <div className="flex items-start justify-between">
                  <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl bg-bg", r.accent)}>
                    <Icon size={18} />
                  </span>
                  <span className={cn("pill", r.badge)}>{r.members} a'zo</span>
                </div>
                <div className="mt-3 text-sm font-semibold text-ink">{r.name}</div>
                <p className="mt-1 text-xs leading-relaxed text-muted">{r.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Ruxsatnomalar matritsasi ── */}
      <section className="mb-8">
        <SectionTitle>Ruxsatnomalar matritsasi</SectionTitle>
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-4 border-b border-line px-5 py-3 text-xs text-muted">
            {(Object.keys(PERM_META) as PermLevel[]).map((lvl) => {
              const m = PERM_META[lvl];
              const Icon = m.icon;
              return (
                <span key={lvl} className="inline-flex items-center gap-1.5">
                  <Icon size={14} className={m.cls} /> {m.title}
                </span>
              );
            })}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-muted">
                  <th className="sticky left-0 bg-surface px-5 py-3">Modul</th>
                  {ROLES.map((r) => (
                    <th key={r.key} className="px-3 py-3 text-center font-medium">
                      {r.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSIONS.map((row, idx) => (
                  <tr key={row.module} className={cn("border-b border-line/70 last:border-0", idx % 2 === 1 && "bg-bg/50")}>
                    <td className="sticky left-0 bg-inherit px-5 py-3 font-medium text-ink">{row.module}</td>
                    {ROLES.map((r) => {
                      const lvl = row.levels[r.key];
                      const m = PERM_META[lvl];
                      const Icon = m.icon;
                      return (
                        <td key={r.key} className="px-3 py-3 text-center" title={`${r.name}: ${m.title}`}>
                          <Icon size={16} className={cn("inline", m.cls)} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Feature flags + Xizmatlar holati ── */}
      <section className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Feature flags */}
        <div className="lg:col-span-2">
          <SectionTitle>Feature Flag'lar</SectionTitle>
          <div className="space-y-3">
            {flags.map((fl) => (
              <div key={fl.key} className="card p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-ink">{fl.name}</div>
                    <p className="mt-0.5 text-xs text-muted">{fl.desc}</p>
                  </div>
                  <Toggle on={fl.enabled} onChange={() => toggleFlag(fl.key)} label={fl.name} />
                </div>

                {/* Bosqichma-bosqich rollout */}
                <div className="mt-4 flex items-center gap-3">
                  <span className="text-xs font-medium text-muted">Bosqichli rollout</span>
                  <div className="flex overflow-hidden rounded-lg border border-line">
                    {ROLLOUT_STAGES.map((stage) => {
                      const active = fl.rollout === stage;
                      return (
                        <button
                          key={stage}
                          disabled={!fl.enabled}
                          onClick={() => setRollout(fl.key, stage)}
                          className={cn(
                            "px-3 py-1.5 text-xs font-medium transition-colors",
                            active
                              ? "bg-duyo-blue text-white"
                              : "bg-surface text-muted hover:bg-bg",
                            !fl.enabled && "cursor-not-allowed opacity-40",
                          )}
                        >
                          {stage}
                        </button>
                      );
                    })}
                  </div>
                  <span className="ml-auto text-xs text-muted">
                    {fl.enabled ? `Faol — ${fl.rollout} foydalanuvchi` : "O'chirilgan"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Xizmatlar holati */}
        <div>
          <SectionTitle>Xizmatlar holati</SectionTitle>
          <div className="card divide-y divide-line">
            {SERVICES.map((s) => {
              const Icon = s.icon;
              const m = SERVICE_META[s.state];
              return (
                <div key={s.name} className="flex items-center gap-3 px-4 py-3">
                  <Icon size={18} className="shrink-0 text-muted" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-ink">{s.name}</div>
                    <div className="text-xs text-muted">
                      {s.latency} · uptime {s.uptime}
                    </div>
                  </div>
                  <span className={cn("pill ml-auto shrink-0", m.pill)}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", m.dot)} /> {m.label}
                  </span>
                </div>
              );
            })}
            <button className="flex w-full items-center justify-center gap-2 px-4 py-3 text-xs font-medium text-duyo-dark hover:bg-duyo-50">
              <Server size={14} /> Batafsil monitoring
            </button>
          </div>
        </div>
      </section>

      {/* ── Audit jurnali ── */}
      <section className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <SectionTitle>Audit jurnali</SectionTitle>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-bg">
              <Filter size={13} /> Filtr
            </button>
            <button className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-bg">
              <Download size={13} /> Eksport
            </button>
          </div>
        </div>
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-muted">
                  <th className="px-5 py-3">Admin</th>
                  <th className="px-3 py-3">Amal</th>
                  <th className="px-3 py-3">Modul</th>
                  <th className="px-3 py-3">IP manzil</th>
                  <th className="px-3 py-3">Vaqt</th>
                  <th className="px-3 py-3">Natija</th>
                </tr>
              </thead>
              <tbody>
                {AUDIT.map((row) => {
                  const rm = AUDIT_RESULT_META[row.result];
                  return (
                    <tr key={row.id} className="border-b border-line/70 last:border-0">
                      <td className="px-5 py-3">
                        <div className="text-sm font-medium text-ink">{row.admin}</div>
                        <div className="text-xs text-muted">
                          {row.email} · {row.role}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <code className="rounded bg-bg px-1.5 py-0.5 text-xs text-ink">{row.action}</code>
                      </td>
                      <td className="px-3 py-3 text-muted">{row.module}</td>
                      <td className="px-3 py-3 font-mono text-xs text-muted">{row.ip}</td>
                      <td className="px-3 py-3 text-xs text-muted">{row.when}</td>
                      <td className="px-3 py-3">
                        <span className={cn("pill", rm.cls)}>{rm.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button className="w-full border-t border-line py-3 text-center text-xs font-medium text-duyo-dark hover:bg-duyo-50">
            Barcha yozuvlarni ko'rish
          </button>
        </div>
      </section>

      {/* ── Xavfsizlik sozlamalari ── */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionTitle>Xavfsizlik sozlamalari</SectionTitle>
          <div className="card p-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-medium text-ink">
                    <Lock size={14} className="text-muted" /> 2FA Majburiy
                  </div>
                  <p className="mt-0.5 text-xs text-muted">Barcha admin hisoblar uchun</p>
                </div>
                <Toggle on={twoFactor} onChange={setTwoFactor} label="2FA Majburiy" />
              </div>

              <div>
                <label className="text-sm font-medium text-ink">Sessiya muddati</label>
                <select
                  value={sessionTimeout}
                  onChange={(ev) => setSessionTimeout(ev.target.value)}
                  className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-duyo-blue focus:outline-none"
                >
                  <option value="15">15 daqiqa</option>
                  <option value="30">30 daqiqa</option>
                  <option value="60">1 soat</option>
                  <option value="480">8 soat</option>
                </select>
              </div>

              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-ink">IP Allowlist (Admin)</div>
                  <p className="mt-0.5 text-xs text-muted">Faqat ishonchli tarmoqlardan kirish</p>
                </div>
                <Toggle on={ipAllowlist} onChange={setIpAllowlist} label="IP Allowlist" />
              </div>

              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-ink">Bola ismlarini niqoblash</div>
                  <p className="mt-0.5 text-xs text-muted">Admin panelida PII himoyasi</p>
                </div>
                <Toggle on={maskNames} onChange={setMaskNames} label="Bola ismlarini niqoblash" />
              </div>

              <div className="flex items-start justify-between gap-4 sm:col-span-2">
                <div>
                  <div className="text-sm font-medium text-ink">Eksport tasdiqlash</div>
                  <p className="mt-0.5 text-xs text-muted">
                    Ma'lumot eksporti uchun ikkinchi admin tasdiqlashini talab qilish
                  </p>
                </div>
                <Toggle on={exportApprovals} onChange={setExportApprovals} label="Eksport tasdiqlash" />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-line pt-5">
              <button className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-bg">
                Bekor qilish
              </button>
              <button className="rounded-xl bg-duyo-blue px-4 py-2 text-sm font-medium text-white hover:bg-duyo-dark">
                O'zgarishlarni saqlash
              </button>
            </div>
          </div>
        </div>

        {/* Xavfsizlik bo'yicha maslahatlar */}
        <div>
          <SectionTitle>Xavfsizlik holati</SectionTitle>
          <div className="card flex h-[calc(100%-2.5rem)] flex-col gap-4 bg-ink p-5 text-white">
            <ShieldCheck size={28} className="text-safe" />
            <div className="text-sm font-semibold">Xavfsizlik bo'yicha maslahatlar</div>
            <ul className="space-y-3 text-xs text-line">
              <li className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-safe" />
                Admin parollar kamida 12 belgi va har 90 kunda yangilanishi talab etiladi.
              </li>
              <li className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-warn" />
                STT/TTS worker ishlamayapti — xizmat holatini tekshiring.
              </li>
              <li className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-safe" />
                Bola ma'lumotlari ko'rinishi audit jurnalida to'liq yoziladi.
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
