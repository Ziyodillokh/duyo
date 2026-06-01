import { useState } from "react";
import {
  CalendarDays,
  SlidersHorizontal,
  Download,
  TrendingUp,
  TrendingDown,
  Zap,
  Repeat,
  ShieldCheck,
  BookOpen,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { PageHeader } from "@/components/PageHeader";
import { cn } from "@/lib/utils";

// MOCK — backend analytics ulanmaguncha namuna ko'rsatkichlar.
// Barcha vaqt qatorlari realistik trend bilan generatsiya qilingan.

const BLUE = "#2563EB";
const BLUE_DARK = "#1D4ED8";
const SAFE = "#16A34A";
const SERIOUS = "#EA580C";
const URGENT = "#DC2626";
const LINE = "#E2E8F0";
const MUTED = "#64748B";

const CATEGORIES = [
  "Mahsulot",
  "AI",
  "Ovoz",
  "Xavfsizlik",
  "Kontent",
  "Daromad",
  "Retention",
] as const;
type Category = (typeof CATEGORIES)[number];

// ---- Mock time-series ----
const sessionTrend = [
  { d: "Du", min: 11.2 },
  { d: "Se", min: 12.6 },
  { d: "Ch", min: 12.1 },
  { d: "Pa", min: 14.8 },
  { d: "Ju", min: 13.9 },
  { d: "Sha", min: 16.4 },
  { d: "Yak", min: 15.1 },
];

const dauMau = [
  { d: "1-hafta", dau: 9800, mau: 71000 },
  { d: "2-hafta", dau: 10600, mau: 75400 },
  { d: "3-hafta", dau: 11200, mau: 79800 },
  { d: "4-hafta", dau: 12402, mau: 84910 },
];

const messagesVoice = [
  { name: "Xabarlar yuborilgan", value: 428291, color: BLUE },
  { name: "Ovozli sessiyalar", value: 120544, color: BLUE_DARK },
];
const maxMsg = Math.max(...messagesVoice.map((m) => m.value));

const engagementTrend = [
  { d: "Du", chat: 5200, levelUp: 410, completed: 980 },
  { d: "Se", chat: 5600, levelUp: 470, completed: 1040 },
  { d: "Ch", chat: 5350, levelUp: 440, completed: 1010 },
  { d: "Pa", chat: 6100, levelUp: 520, completed: 1180 },
  { d: "Ju", chat: 5980, levelUp: 505, completed: 1150 },
  { d: "Sha", chat: 6800, levelUp: 610, completed: 1320 },
  { d: "Yak", chat: 6450, levelUp: 580, completed: 1260 },
];

const latencyTrend = [
  { d: "Du", p50: 0.9, p95: 1.6 },
  { d: "Se", p50: 0.85, p95: 1.5 },
  { d: "Ch", p50: 0.95, p95: 1.7 },
  { d: "Pa", p50: 0.8, p95: 1.4 },
  { d: "Ju", p50: 0.82, p95: 1.45 },
  { d: "Sha", p50: 0.78, p95: 1.35 },
  { d: "Yak", p50: 0.84, p95: 1.4 },
];

const costCacheTrend = [
  { d: "Du", cost: 0.092, cache: 58, fallback: 3.1 },
  { d: "Se", cost: 0.088, cache: 60, fallback: 2.8 },
  { d: "Ch", cost: 0.085, cache: 61, fallback: 2.6 },
  { d: "Pa", cost: 0.082, cache: 63, fallback: 2.4 },
  { d: "Ju", cost: 0.08, cache: 64, fallback: 2.3 },
  { d: "Sha", cost: 0.079, cache: 64, fallback: 2.2 },
  { d: "Yak", cost: 0.08, cache: 64.2, fallback: 2.1 },
];

const responseSplit = [
  { name: "AI generatsiya", value: 75, color: BLUE },
  { name: "Ssenariy (scripted)", value: 25, color: "#CBD5E1" },
];

const safetyFilters = [
  { name: "Axloqsiz kontent", count: 142, trend: -12 },
  { name: "Shaxsiy ma'lumotlar", count: 89, trend: 5 },
  { name: "Taqiqlangan so'zlar", count: 314, trend: -24 },
];

const crisisPerDay = [
  { d: "Du", red: 1, orange: 3, yellow: 6 },
  { d: "Se", red: 0, orange: 2, yellow: 8 },
  { d: "Ch", red: 2, orange: 4, yellow: 5 },
  { d: "Pa", red: 1, orange: 3, yellow: 9 },
  { d: "Ju", red: 0, orange: 5, yellow: 7 },
  { d: "Sha", red: 1, orange: 2, yellow: 4 },
  { d: "Yak", red: 0, orange: 3, yellow: 6 },
];

const safetyStats = [
  { label: "False positive darajasi", value: "0.8%" },
  { label: "False negative (feedback)", value: "0.3%" },
  { label: "Ota-onalar javob vaqti", value: "4.2 daq" },
  { label: "Ofitser ko'rib chiqish vaqti", value: "1.5 daq" },
];

const topPoems = [
  { rank: 1, title: "Vatanim manim", reads: 12400 },
  { rank: 2, title: "Alifbe bayrami", reads: 10100 },
  { rank: 3, title: "Bahor keldi", reads: 8700 },
  { rank: 4, title: "Onajonim", reads: 7300 },
];
const maxReads = Math.max(...topPoems.map((p) => p.reads));

const ageSegments = [
  { age: "3-5 yosh", value: 28 },
  { age: "6-8 yosh", value: 46 },
  { age: "9-12 yosh", value: 39 },
];

const revenueTrend = [
  { d: "Yan", mrr: 8200, churn: 2.4 },
  { d: "Fev", mrr: 9100, churn: 2.2 },
  { d: "Mar", mrr: 10300, churn: 2.0 },
  { d: "Apr", mrr: 11600, churn: 1.9 },
  { d: "May", mrr: 12840, churn: 1.8 },
];

const conversionTrend = [
  { d: "Yan", rate: 2.4 },
  { d: "Fev", rate: 2.7 },
  { d: "Mar", rate: 2.9 },
  { d: "Apr", rate: 3.1 },
  { d: "May", rate: 3.2 },
];

const retentionCohorts = [
  { cohort: "1-7 May", size: 1240, d1: 45, d3: 38, d7: 30, d14: 22, d30: 18 },
  { cohort: "8-14 May", size: 1105, d1: 42, d3: 35, d7: 28, d14: 20, d30: null },
  { cohort: "15-21 May", size: 1380, d1: 48, d3: 39, d7: 32, d14: null, d30: null },
  { cohort: "22-28 May", size: 1190, d1: 44, d3: 37, d7: null, d14: null, d30: null },
];

// ---- Small presentational helpers ----

interface Kpi {
  label: string;
  value: string;
  delta?: number;
  accent?: "blue" | "safe" | "urgent";
}

function deltaTone(delta: number): { cls: string; Icon: LucideIcon } {
  return delta >= 0
    ? { cls: "text-safe", Icon: TrendingUp }
    : { cls: "text-urgent", Icon: TrendingDown };
}

function KpiCard({ label, value, delta, accent = "blue" }: Kpi) {
  const valueCls =
    accent === "urgent"
      ? "text-urgent"
      : accent === "safe"
        ? "text-safe"
        : "text-duyo-blue";
  return (
    <div className="card p-4">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted">
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className={cn("text-2xl font-bold", valueCls)}>{value}</span>
        {delta !== undefined && <DeltaBadge delta={delta} />}
      </div>
    </div>
  );
}

function DeltaBadge({ delta }: { delta: number }) {
  const { cls, Icon } = deltaTone(delta);
  return (
    <span className={cn("flex items-center gap-0.5 text-xs font-medium", cls)}>
      <Icon size={12} />
      {delta >= 0 ? "+" : ""}
      {delta}%
    </span>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <div className="mb-3 mt-8 flex items-center gap-2">
      <Icon size={18} className="text-duyo-blue" />
      <h2 className="text-base font-semibold text-ink">{title}</h2>
    </div>
  );
}

function ChartCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

const tooltipStyle = {
  borderRadius: 12,
  border: `1px solid ${LINE}`,
  fontSize: 12,
  boxShadow: "0 1px 3px rgba(15,23,42,0.08)",
};
const axisProps = {
  tick: { fontSize: 11, fill: MUTED },
  axisLine: false,
  tickLine: false,
};

function HBar({
  label,
  value,
  max,
  color = BLUE,
  suffix = "",
}: {
  label: string;
  value: number;
  max: number;
  color?: string;
  suffix?: string;
}) {
  const pct = Math.max(2, Math.round((value / max) * 100));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-ink">{label}</span>
        <span className="font-medium text-ink">
          {value.toLocaleString()}
          {suffix}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-bg">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function retentionCell(v: number | null) {
  if (v === null) return <span className="text-muted">—</span>;
  // duyo-blue tinted heatmap: higher value = stronger blue
  const alpha = Math.min(0.9, 0.15 + v / 100);
  const dark = v >= 35;
  return (
    <span
      className={cn(
        "inline-block min-w-[44px] rounded-md px-2 py-1 text-center text-xs font-semibold",
        dark ? "text-white" : "text-duyo-dark",
      )}
      style={{ backgroundColor: `rgba(37, 99, 235, ${alpha})` }}
    >
      {v}%
    </span>
  );
}

export function Analytics() {
  const [category, setCategory] = useState<Category>("Mahsulot");
  const [range, setRange] = useState("Oxirgi 30 kun");

  return (
    <div>
      <PageHeader
        title="Tahlil"
        subtitle="Mahsulot, AI, xavfsizlik va daromad bo'yicha ko'rsatkichlar (namuna ma'lumot)"
        actions={
          <button className="flex items-center gap-2 rounded-xl bg-duyo-blue px-4 py-2 text-sm font-medium text-white hover:bg-duyo-dark">
            <Download size={16} /> Eksport
          </button>
        }
      />

      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="appearance-none rounded-xl border border-line bg-surface py-2 pl-9 pr-8 text-sm font-medium text-ink hover:border-duyo-blue"
          >
            <option>Oxirgi 7 kun</option>
            <option>Oxirgi 30 kun</option>
            <option>Oxirgi 90 kun</option>
          </select>
          <CalendarDays
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
        </div>
        <button className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium text-ink hover:border-duyo-blue">
          <SlidersHorizontal size={15} /> Filtrlar
        </button>
      </div>

      {/* Category tabs */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm font-medium",
              category === c
                ? "border-duyo-blue bg-duyo-blue text-white"
                : "border-line bg-surface text-muted hover:bg-bg",
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {/* ===================== ENGAGEMENT / MAHSULOT ===================== */}
      <SectionTitle icon={TrendingUp} title="Mahsulot va jalblik" />

      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard label="DAU" value="12,402" delta={4.2} />
        <KpiCard label="MAU" value="84,910" delta={12.8} />
        <KpiCard label="Yangi foydalanuvchilar" value="3,120" delta={-2.1} />
        <KpiCard label="Faol bolalar" value="8,204" delta={6.5} />
        <KpiCard label="Faol ota-onalar" value="4,198" delta={1.8} />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard
          title="Sessiya davomiyligi (daqiqa)"
          action={
            <span className="pill bg-duyo-50 text-duyo-dark">Haftalik</span>
          }
        >
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={sessionTrend} margin={{ left: -18, right: 6 }}>
              <CartesianGrid vertical={false} stroke={LINE} />
              <XAxis dataKey="d" {...axisProps} />
              <YAxis {...axisProps} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#EFF6FF" }} />
              <Bar dataKey="min" name="Daqiqa" fill={BLUE} radius={[6, 6, 0, 0]} maxBarSize={42} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="DAU / MAU o'sishi">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={dauMau} margin={{ left: -8, right: 6 }}>
              <defs>
                <linearGradient id="gMau" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={BLUE} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={BLUE} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={LINE} />
              <XAxis dataKey="d" {...axisProps} />
              <YAxis {...axisProps} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="mau" name="MAU" stroke={BLUE} fill="url(#gMau)" strokeWidth={2} />
              <Area type="monotone" dataKey="dau" name="DAU" stroke={BLUE_DARK} fill="transparent" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Xabarlar vs Ovozli sessiyalar">
          <div className="space-y-5 py-6">
            {messagesVoice.map((m) => (
              <HBar key={m.name} label={m.name} value={m.value} max={maxMsg} color={m.color} />
            ))}
          </div>
        </ChartCard>

        <ChartCard title="Chat / Level up / Kontent yakunlandi">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={engagementTrend} margin={{ left: -10, right: 6 }}>
              <CartesianGrid vertical={false} stroke={LINE} />
              <XAxis dataKey="d" {...axisProps} />
              <YAxis {...axisProps} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="chat" name="Chat boshlandi" stroke={BLUE} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="completed" name="Kontent yakunlandi" stroke={SAFE} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="levelUp" name="Level up" stroke={SERIOUS} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ===================== AI & COST ===================== */}
      <SectionTitle icon={Zap} title="AI va xarajat" />

      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard label="Latency (p95)" value="1.4s" delta={-6.0} />
        <KpiCard label="Token usage" value="4.2M" delta={9.0} />
        <KpiCard label="Cost / user" value="$0.08" delta={-4.0} accent="safe" />
        <KpiCard label="Cache hit rate" value="64.2%" delta={3.0} accent="safe" />
        <KpiCard label="Fallback rate" value="2.1%" delta={-0.4} accent="urgent" />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartCard title="AI javob kechikishi (p50 / p95, soniya)">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={latencyTrend} margin={{ left: -18, right: 6 }}>
                <defs>
                  <linearGradient id="gP95" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={BLUE} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={BLUE} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={LINE} />
                <XAxis dataKey="d" {...axisProps} />
                <YAxis {...axisProps} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="p95" name="p95" stroke={BLUE} fill="url(#gP95)" strokeWidth={2} />
                <Area type="monotone" dataKey="p50" name="p50" stroke={BLUE_DARK} fill="transparent" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <ChartCard title="Javob nisbati">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={responseSplit}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={2}
                stroke="none"
              >
                {responseSplit.map((s) => (
                  <Cell key={s.name} fill={s.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${v}%`} />
              <Legend wrapperStyle={{ fontSize: 12 }} verticalAlign="bottom" />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Cost per user va Cache hit rate">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={costCacheTrend} margin={{ left: -10, right: 10 }}>
              <CartesianGrid vertical={false} stroke={LINE} />
              <XAxis dataKey="d" {...axisProps} />
              <YAxis yAxisId="l" {...axisProps} />
              <YAxis yAxisId="r" orientation="right" {...axisProps} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line yAxisId="l" type="monotone" dataKey="cache" name="Cache %" stroke={SAFE} strokeWidth={2} dot={false} />
              <Line yAxisId="r" type="monotone" dataKey="cost" name="Cost ($/user)" stroke={BLUE} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Xavfsizlik filtri bloklashlari">
          <div className="overflow-hidden rounded-xl border border-line">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-muted">
                  <th className="px-4 py-2.5">Toifa</th>
                  <th className="px-4 py-2.5">Soni</th>
                  <th className="px-4 py-2.5">Trend</th>
                </tr>
              </thead>
              <tbody>
                {safetyFilters.map((f) => (
                  <tr key={f.name} className="border-b border-line/70 last:border-0">
                    <td className="px-4 py-2.5 text-ink">{f.name}</td>
                    <td className="px-4 py-2.5 font-medium text-ink">{f.count}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          "text-xs font-medium",
                          f.trend <= 0 ? "text-safe" : "text-urgent",
                        )}
                      >
                        {f.trend > 0 ? "+" : ""}
                        {f.trend}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>

      {/* ===================== SAFETY ===================== */}
      <SectionTitle icon={ShieldCheck} title="Xavfsizlik (Safety)" />

      <div className="mb-4 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartCard title="Kunlik crisis hodisalari (daraja bo'yicha)">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={crisisPerDay} margin={{ left: -20, right: 6 }}>
                <CartesianGrid vertical={false} stroke={LINE} />
                <XAxis dataKey="d" {...axisProps} />
                <YAxis {...axisProps} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#F8FAFC" }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="red" name="RED" stackId="a" fill={URGENT} radius={[0, 0, 0, 0]} maxBarSize={40} />
                <Bar dataKey="orange" name="ORANGE" stackId="a" fill={SERIOUS} maxBarSize={40} />
                <Bar dataKey="yellow" name="YELLOW" stackId="a" fill="#CA8A04" radius={[6, 6, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <div className="card p-5">
          <h3 className="mb-4 text-sm font-semibold text-ink">Sifat ko'rsatkichlari</h3>
          <div className="space-y-3">
            {safetyStats.map((s) => (
              <div
                key={s.label}
                className="flex items-center justify-between rounded-xl border border-line px-4 py-2.5"
              >
                <span className="text-sm text-muted">{s.label}</span>
                <span className="text-sm font-semibold text-ink">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ===================== CONTENT ===================== */}
      <SectionTitle icon={BookOpen} title="Kontent samaradorligi" />

      <div className="mb-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Eng ko'p o'qilgan she'rlar">
          <div className="space-y-4 py-2">
            {topPoems.map((p) => (
              <div key={p.rank} className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-duyo-50 text-xs font-semibold text-duyo-dark">
                  {p.rank}
                </span>
                <div className="flex-1">
                  <HBar label={p.title} value={p.reads} max={maxReads} />
                </div>
              </div>
            ))}
          </div>
        </ChartCard>

        <ChartCard title="Yosh segmenti faolligi">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={ageSegments} margin={{ left: -20, right: 6 }}>
              <CartesianGrid vertical={false} stroke={LINE} />
              <XAxis dataKey="age" {...axisProps} />
              <YAxis {...axisProps} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#EFF6FF" }} formatter={(v) => `${v}%`} />
              <Bar dataKey="value" name="Faollik %" fill={BLUE} radius={[6, 6, 0, 0]} maxBarSize={56} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ===================== REVENUE ===================== */}
      <SectionTitle icon={Wallet} title="Daromad va monetizatsiya" />

      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="MRR" value="$12,840" delta={8.4} />
        <KpiCard label="Free → Paid konversiya" value="3.2%" delta={3.2} />
        <KpiCard label="Churn rate" value="1.8%" delta={-0.2} accent="urgent" />
        <KpiCard label="LTV" value="$245" delta={5.1} />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="MRR va Churn rate">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={revenueTrend} margin={{ left: -6, right: 10 }}>
              <defs>
                <linearGradient id="gMrr" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={BLUE} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={BLUE} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={LINE} />
              <XAxis dataKey="d" {...axisProps} />
              <YAxis yAxisId="l" {...axisProps} />
              <YAxis yAxisId="r" orientation="right" {...axisProps} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area yAxisId="l" type="monotone" dataKey="mrr" name="MRR ($)" stroke={BLUE} fill="url(#gMrr)" strokeWidth={2} />
              <Line yAxisId="r" type="monotone" dataKey="churn" name="Churn %" stroke={URGENT} strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Free → Paid konversiya (%)">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={conversionTrend} margin={{ left: -18, right: 10 }}>
              <CartesianGrid vertical={false} stroke={LINE} />
              <XAxis dataKey="d" {...axisProps} />
              <YAxis {...axisProps} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${v}%`} />
              <Line type="monotone" dataKey="rate" name="Konversiya %" stroke={BLUE} strokeWidth={2} dot={{ r: 3, fill: BLUE }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ===================== RETENTION ===================== */}
      <SectionTitle icon={Repeat} title="Retention (saqlab qolish)" />

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h3 className="text-sm font-semibold text-ink">Kohorta retention</h3>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted">
              D1 <span className="font-semibold text-duyo-blue">42%</span>
            </span>
            <span className="text-muted">
              D7 <span className="font-semibold text-duyo-blue">28%</span>
            </span>
            <span className="text-muted">
              D30 <span className="font-semibold text-duyo-blue">15%</span>
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-muted">
                <th className="px-5 py-3">Kohorta</th>
                <th className="px-3 py-3">Soni</th>
                <th className="px-3 py-3">D1</th>
                <th className="px-3 py-3">D3</th>
                <th className="px-3 py-3">D7</th>
                <th className="px-3 py-3">D14</th>
                <th className="px-3 py-3">D30</th>
              </tr>
            </thead>
            <tbody>
              {retentionCohorts.map((c) => (
                <tr key={c.cohort} className="border-b border-line/70 last:border-0">
                  <td className="px-5 py-3 font-medium text-ink">{c.cohort}</td>
                  <td className="px-3 py-3 text-muted">{c.size.toLocaleString()}</td>
                  <td className="px-3 py-3">{retentionCell(c.d1)}</td>
                  <td className="px-3 py-3">{retentionCell(c.d3)}</td>
                  <td className="px-3 py-3">{retentionCell(c.d7)}</td>
                  <td className="px-3 py-3">{retentionCell(c.d14)}</td>
                  <td className="px-3 py-3">{retentionCell(c.d30)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted">
        Eslatma: barcha ko'rsatkichlar namuna (mock) ma'lumot — backend analytics
        ulanmaguncha real vaqtli emas.
      </p>
    </div>
  );
}
