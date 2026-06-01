import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  Percent,
  Check,
  X,
  CreditCard,
  AlertTriangle,
  RotateCcw,
  Ticket,
  Building2,
  School,
  Briefcase,
  Baby,
  type LucideIcon,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { PageHeader } from "@/components/PageHeader";
import { cn } from "@/lib/utils";

// MOCK — billing backend (Click/Payme) ulanmaguncha namuna ko'rsatkichlar.

// ---- Revenue KPI cards ----
interface Kpi {
  label: string;
  value: string;
  icon: LucideIcon;
  delta?: string;
  trend?: "up" | "down";
  hint?: string;
}

const KPIS: Kpi[] = [
  { label: "MRR (oylik takror daromad)", value: "$12,450", icon: DollarSign, delta: "+9.4%", trend: "up", hint: "157.2 mln so'm" },
  { label: "ARR (yillik takror daromad)", value: "$149,400", icon: TrendingUp, delta: "+12.1%", trend: "up" },
  { label: "ARPU (foydalanuvchi/oy)", value: "$8.40", icon: Users, delta: "+2.7%", trend: "up" },
  { label: "Konversiya (Free → Pulli)", value: "12.4%", icon: Percent, delta: "+1.1pp", trend: "up" },
  { label: "Churn (oylik)", value: "3.8%", icon: TrendingDown, delta: "-0.6pp", trend: "up", hint: "past = yaxshi" },
];

// ---- Revenue trend ----
const REVENUE_TREND: { month: string; mrr: number; newMrr: number }[] = [
  { month: "Dek", mrr: 7200, newMrr: 980 },
  { month: "Yan", mrr: 8350, newMrr: 1240 },
  { month: "Fev", mrr: 9180, newMrr: 1010 },
  { month: "Mar", mrr: 10240, newMrr: 1330 },
  { month: "Apr", mrr: 11380, newMrr: 1520 },
  { month: "May", mrr: 12450, newMrr: 1610 },
];

// ---- Plans + feature matrix ----
interface Plan {
  key: string;
  name: string;
  tagline: string;
  price: string;
  period: string;
  highlight?: boolean;
}

const PLANS: Plan[] = [
  { key: "free", name: "Tanish", tagline: "Free", price: "0 so'm", period: "doimiy" },
  { key: "standard", name: "Do'st", tagline: "Standard", price: "49 000 so'm", period: "oyiga", highlight: true },
  { key: "premium", name: "Hamroh", tagline: "Premium", price: "89 000 so'm", period: "oyiga" },
];

interface FeatureRow {
  label: string;
  free: string | boolean;
  standard: string | boolean;
  premium: string | boolean;
}

const FEATURE_MATRIX: FeatureRow[] = [
  { label: "Tillar soni", free: "1 (o'zbek)", standard: "2", premium: "4" },
  { label: "AI kunlik limit (xabar)", free: "30", standard: "200", premium: "Cheksiz" },
  { label: "Voice chat", free: false, standard: true, premium: true },
  { label: "Premium kontent", free: false, standard: "Qisman", premium: true },
  { label: "Bolalar soni", free: "1", standard: "2", premium: "5" },
  { label: "Priority qo'llab-quvvatlash", free: false, standard: false, premium: true },
];

// ---- Subscriptions ----
interface Subscription {
  id: string;
  parent: string;
  plan: string;
  status: "active" | "trial" | "past_due" | "canceled";
  startedAt: string;
  renewsAt: string;
  amount: string;
}

const SUBSCRIPTION_STATUS: Record<Subscription["status"], { label: string; cls: string }> = {
  active: { label: "Faol", cls: "bg-safe-bg text-safe border border-safe-line" },
  trial: { label: "Sinov", cls: "bg-duyo-50 text-duyo-dark border border-duyo-100" },
  past_due: { label: "Muddati o'tgan", cls: "bg-warn-bg text-warn border border-warn-line" },
  canceled: { label: "Bekor qilingan", cls: "bg-bg text-muted border border-line" },
};

const SUBSCRIPTIONS: Subscription[] = [
  { id: "#SUB-4821", parent: "Aziza Karimova", plan: "Hamroh Premium", status: "active", startedAt: "12.01.2026", renewsAt: "12.06.2026", amount: "89 000 so'm" },
  { id: "#SUB-4799", parent: "Bobur Aliyev", plan: "Do'st Standard", status: "active", startedAt: "03.02.2026", renewsAt: "03.06.2026", amount: "49 000 so'm" },
  { id: "#SUB-4760", parent: "Dilnoza Yusupova", plan: "Do'st Standard", status: "trial", startedAt: "28.05.2026", renewsAt: "11.06.2026", amount: "0 so'm" },
  { id: "#SUB-4712", parent: "Eldor Tursunov", plan: "Hamroh Premium", status: "past_due", startedAt: "15.11.2025", renewsAt: "15.05.2026", amount: "89 000 so'm" },
  { id: "#SUB-4688", parent: "Feruza Salimova", plan: "Do'st Standard", status: "canceled", startedAt: "20.10.2025", renewsAt: "—", amount: "—" },
];

// ---- Payment transactions ----
type ProviderKey = "Click" | "Payme" | "Uzcard" | "Humo" | "Visa/MC";
type TxStatus = "success" | "pending" | "failed" | "refunded";

const TX_STATUS: Record<TxStatus, { label: string; cls: string }> = {
  success: { label: "Muvaffaqiyatli", cls: "bg-safe-bg text-safe border border-safe-line" },
  pending: { label: "Kutilmoqda", cls: "bg-warn-bg text-warn border border-warn-line" },
  failed: { label: "Xato", cls: "bg-urgent-bg text-urgent border border-urgent-line" },
  refunded: { label: "Qaytarilgan", cls: "bg-serious-bg text-serious border border-serious-line" },
};

interface Transaction {
  id: string;
  parent: string;
  provider: ProviderKey;
  amount: string;
  status: TxStatus;
  date: string;
}

const TRANSACTIONS: Transaction[] = [
  { id: "#TX-90213", parent: "Aziza Karimova", provider: "Payme", amount: "89 000 so'm", status: "success", date: "01.06.2026 09:14" },
  { id: "#TX-90208", parent: "Bobur Aliyev", provider: "Click", amount: "49 000 so'm", status: "success", date: "01.06.2026 08:02" },
  { id: "#TX-90201", parent: "Eldor Tursunov", provider: "Uzcard", amount: "89 000 so'm", status: "failed", date: "31.05.2026 21:47" },
  { id: "#TX-90197", parent: "Gulnora Rashidova", provider: "Humo", amount: "49 000 so'm", status: "pending", date: "31.05.2026 19:30" },
  { id: "#TX-90188", parent: "Hasan Mirzayev", provider: "Visa/MC", amount: "$7.99", status: "refunded", date: "30.05.2026 14:10" },
  { id: "#TX-90175", parent: "Iroda Komilova", provider: "Click", amount: "49 000 so'm", status: "failed", date: "30.05.2026 11:55" },
];

// ---- Failed payments (highlight) ----
interface FailedPayment {
  id: string;
  parent: string;
  provider: ProviderKey;
  amount: string;
  reason: string;
  attempts: number;
  lastTry: string;
}

const FAILED_PAYMENTS: FailedPayment[] = [
  { id: "#TX-90201", parent: "Eldor Tursunov", provider: "Uzcard", amount: "89 000 so'm", reason: "Mablag' yetarli emas", attempts: 3, lastTry: "31.05 21:47" },
  { id: "#TX-90175", parent: "Iroda Komilova", provider: "Click", amount: "49 000 so'm", reason: "Karta bloklangan", attempts: 2, lastTry: "30.05 11:55" },
  { id: "#TX-90120", parent: "Jasur Toshmatov", provider: "Payme", amount: "89 000 so'm", reason: "Vaqt tugadi (timeout)", attempts: 1, lastTry: "29.05 17:21" },
];

// ---- Refund requests ----
type RefundStatus = "pending" | "approved" | "rejected";

const REFUND_STATUS: Record<RefundStatus, { label: string; cls: string }> = {
  pending: { label: "Ko'rilmoqda", cls: "bg-warn-bg text-warn border border-warn-line" },
  approved: { label: "Tasdiqlangan", cls: "bg-safe-bg text-safe border border-safe-line" },
  rejected: { label: "Rad etilgan", cls: "bg-urgent-bg text-urgent border border-urgent-line" },
};

interface RefundRequest {
  id: string;
  parent: string;
  amount: string;
  reason: string;
  status: RefundStatus;
  requestedAt: string;
}

const REFUNDS: RefundRequest[] = [
  { id: "#RF-312", parent: "Hasan Mirzayev", amount: "$7.99", reason: "Tasodifan obuna bo'lindi", status: "approved", requestedAt: "30.05.2026" },
  { id: "#RF-309", parent: "Kamola Ergasheva", amount: "89 000 so'm", reason: "Xizmatdan norozi", status: "pending", requestedAt: "31.05.2026" },
  { id: "#RF-305", parent: "Laziz Abdullayev", amount: "49 000 so'm", reason: "Ikki marta yechildi", status: "pending", requestedAt: "01.06.2026" },
];

// ---- Promo codes ----
interface PromoCode {
  code: string;
  discount: string;
  used: number;
  limit: number;
  expiresAt: string;
  active: boolean;
}

const PROMOS: PromoCode[] = [
  { code: "DUYO2026", discount: "20% chegirma", used: 142, limit: 500, expiresAt: "30.06.2026", active: true },
  { code: "WELCOME10", discount: "10% chegirma", used: 318, limit: 1000, expiresAt: "31.12.2026", active: true },
  { code: "MAKTAB50", discount: "50% (B2B)", used: 12, limit: 50, expiresAt: "01.09.2026", active: true },
  { code: "YANGIYIL", discount: "1 oy bepul", used: 500, limit: 500, expiresAt: "15.01.2026", active: false },
];

// ---- B2B packages ----
interface B2bPackage {
  name: string;
  segment: string;
  icon: LucideIcon;
  seats: string;
  price: string;
  clients: number;
}

const B2B_PACKAGES: B2bPackage[] = [
  { name: "Maktab", segment: "Ta'lim", icon: School, seats: "100–1000 o'quvchi", price: "Murojaat asosida", clients: 8 },
  { name: "Bog'cha", segment: "Maktabgacha", icon: Baby, seats: "20–200 bola", price: "1.2 mln so'm/oy", clients: 5 },
  { name: "Korporativ", segment: "Xodimlar farzandlari", icon: Briefcase, seats: "50–500 oila", price: "Murojaat asosida", clients: 3 },
];

function formatUsd(n: number): string {
  return `$${n.toLocaleString("en-US")}`;
}

function MatrixCell({ value }: { value: string | boolean }) {
  if (value === true) return <Check size={16} className="mx-auto text-safe" />;
  if (value === false) return <X size={16} className="mx-auto text-muted/50" />;
  return <span className="text-ink">{value}</span>;
}

export function Monetization() {
  return (
    <div>
      <PageHeader
        title="Monetizatsiya"
        subtitle="Obunalar, to'lovlar va daromad ko'rsatkichlari"
        actions={
          <span className="pill bg-safe-bg text-safe border border-safe-line">
            <span className="h-1.5 w-1.5 rounded-full bg-safe" /> Billing sog'lom
          </span>
        }
      />

      {/* Revenue KPI cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {KPIS.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="card p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted">{k.label}</span>
                <Icon size={16} className="text-muted" />
              </div>
              <div className="mt-2 text-2xl font-bold text-ink">{k.value}</div>
              <div className="mt-1 flex items-center gap-2">
                {k.delta && (
                  <span className={cn("text-[11px] font-semibold", k.trend === "down" ? "text-urgent" : "text-safe")}>
                    {k.delta}
                  </span>
                )}
                {k.hint && <span className="text-[11px] text-muted">{k.hint}</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Revenue trend + plan cards */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Daromad tendentsiyasi (MRR)</h2>
            <span className="text-xs text-muted">So'nggi 6 oy · USD</span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={REVENUE_TREND} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="mrrFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563EB" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="newMrrFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#16A34A" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="#16A34A" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#64748B" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "#64748B" }} axisLine={false} tickLine={false} tickFormatter={formatUsd} />
                <Tooltip
                  formatter={(value) => formatUsd(Number(value))}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #E2E8F0",
                    boxShadow: "0 1px 3px 0 rgba(15,23,42,0.06)",
                    fontSize: 12,
                  }}
                />
                <Area type="monotone" dataKey="mrr" name="MRR" stroke="#2563EB" strokeWidth={2} fill="url(#mrrFill)" />
                <Area type="monotone" dataKey="newMrr" name="Yangi MRR" stroke="#16A34A" strokeWidth={2} fill="url(#newMrrFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Promo codes panel */}
        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Ticket size={16} className="text-duyo-blue" />
            <h2 className="text-sm font-semibold text-ink">Promo kodlar</h2>
          </div>
          <div className="space-y-3">
            {PROMOS.map((p) => (
              <div key={p.code} className="rounded-xl border border-line p-3">
                <div className="flex items-center justify-between">
                  <code className="rounded-md bg-bg px-2 py-0.5 text-sm font-semibold text-ink">{p.code}</code>
                  <span
                    className={cn(
                      "pill",
                      p.active ? "bg-safe-bg text-safe border border-safe-line" : "bg-bg text-muted border border-line",
                    )}
                  >
                    {p.active ? "Faol" : "Tugagan"}
                  </span>
                </div>
                <div className="mt-1.5 text-xs text-muted">{p.discount} · {p.expiresAt} gacha</div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-bg">
                  <div
                    className={cn("h-full rounded-full", p.active ? "bg-duyo-blue" : "bg-line")}
                    style={{ width: `${Math.min(100, Math.round((p.used / p.limit) * 100))}%` }}
                  />
                </div>
                <div className="mt-1 text-[11px] text-muted">{p.used} / {p.limit} ishlatilgan</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Plans + feature matrix */}
      <div className="card mb-6 overflow-hidden">
        <div className="border-b border-line px-5 py-3">
          <h2 className="text-sm font-semibold text-ink">Tariflar va imkoniyatlar</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="px-5 py-4 text-xs font-medium uppercase tracking-wide text-muted">Imkoniyat</th>
                {PLANS.map((plan) => (
                  <th key={plan.key} className="px-4 py-4 text-center">
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-[11px] font-medium uppercase tracking-wide text-muted">{plan.tagline}</span>
                      <span
                        className={cn(
                          "text-base font-bold",
                          plan.highlight ? "text-duyo-dark" : "text-ink",
                        )}
                      >
                        {plan.name}
                      </span>
                      <span className="text-xs font-semibold text-ink">{plan.price}</span>
                      <span className="text-[11px] text-muted">{plan.period}</span>
                      {plan.highlight && (
                        <span className="pill mt-1 bg-duyo-50 text-duyo-dark border border-duyo-100">Mashhur</span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURE_MATRIX.map((row) => (
                <tr key={row.label} className="border-b border-line/70 last:border-0">
                  <td className="px-5 py-3 font-medium text-ink">{row.label}</td>
                  <td className="px-4 py-3 text-center text-muted"><MatrixCell value={row.free} /></td>
                  <td className="bg-duyo-50/40 px-4 py-3 text-center"><MatrixCell value={row.standard} /></td>
                  <td className="px-4 py-3 text-center"><MatrixCell value={row.premium} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Subscriptions table */}
      <div className="card mb-6 overflow-hidden">
        <div className="flex items-center gap-2 border-b border-line px-5 py-3">
          <Users size={16} className="text-duyo-blue" />
          <h2 className="text-sm font-semibold text-ink">Obunalar</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-muted">
                <th className="px-5 py-3">ID</th>
                <th className="px-3 py-3">Ota-ona</th>
                <th className="px-3 py-3">Tarif</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Boshlangan</th>
                <th className="px-3 py-3">Yangilanadi</th>
                <th className="px-3 py-3">Summa</th>
              </tr>
            </thead>
            <tbody>
              {SUBSCRIPTIONS.map((s) => {
                const st = SUBSCRIPTION_STATUS[s.status];
                return (
                  <tr key={s.id} className="border-b border-line/70 last:border-0">
                    <td className="px-5 py-3 font-medium text-ink">{s.id}</td>
                    <td className="px-3 py-3 text-ink">{s.parent}</td>
                    <td className="px-3 py-3 text-muted">{s.plan}</td>
                    <td className="px-3 py-3"><span className={cn("pill", st.cls)}>{st.label}</span></td>
                    <td className="px-3 py-3 text-muted">{s.startedAt}</td>
                    <td className="px-3 py-3 text-muted">{s.renewsAt}</td>
                    <td className="px-3 py-3 font-medium text-ink">{s.amount}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment transactions */}
      <div className="card mb-6 overflow-hidden">
        <div className="flex items-center gap-2 border-b border-line px-5 py-3">
          <CreditCard size={16} className="text-duyo-blue" />
          <h2 className="text-sm font-semibold text-ink">To'lov tranzaksiyalari</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-muted">
                <th className="px-5 py-3">ID</th>
                <th className="px-3 py-3">Ota-ona</th>
                <th className="px-3 py-3">Provayder</th>
                <th className="px-3 py-3">Summa</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Vaqt</th>
              </tr>
            </thead>
            <tbody>
              {TRANSACTIONS.map((t) => {
                const st = TX_STATUS[t.status];
                return (
                  <tr key={t.id} className="border-b border-line/70 last:border-0">
                    <td className="px-5 py-3 font-medium text-ink">{t.id}</td>
                    <td className="px-3 py-3 text-ink">{t.parent}</td>
                    <td className="px-3 py-3">
                      <span className="pill bg-bg text-muted border border-line">{t.provider}</span>
                    </td>
                    <td className="px-3 py-3 font-medium text-ink">{t.amount}</td>
                    <td className="px-3 py-3"><span className={cn("pill", st.cls)}>{st.label}</span></td>
                    <td className="px-3 py-3 text-xs text-muted">{t.date}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Failed payments (highlight) + refunds */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-urgent-line bg-urgent-bg px-5 py-3">
            <AlertTriangle size={16} className="text-urgent" />
            <h2 className="text-sm font-semibold text-urgent">Xato to'lovlar — diqqat talab</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-muted">
                  <th className="px-5 py-3">Ota-ona</th>
                  <th className="px-3 py-3">Sabab</th>
                  <th className="px-3 py-3">Urinish</th>
                  <th className="px-3 py-3">Summa</th>
                </tr>
              </thead>
              <tbody>
                {FAILED_PAYMENTS.map((f) => (
                  <tr key={f.id} className="border-b border-line/70 bg-urgent-bg/40 last:border-0">
                    <td className="px-5 py-3">
                      <div className="font-medium text-ink">{f.parent}</div>
                      <div className="text-[11px] text-muted">{f.provider} · {f.lastTry}</div>
                    </td>
                    <td className="px-3 py-3 text-urgent">{f.reason}</td>
                    <td className="px-3 py-3 text-muted">{f.attempts}x</td>
                    <td className="px-3 py-3 font-medium text-ink">{f.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line px-5 py-3">
            <RotateCcw size={16} className="text-serious" />
            <h2 className="text-sm font-semibold text-ink">Qaytarish so'rovlari</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-muted">
                  <th className="px-5 py-3">ID</th>
                  <th className="px-3 py-3">Ota-ona</th>
                  <th className="px-3 py-3">Sabab</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Summa</th>
                </tr>
              </thead>
              <tbody>
                {REFUNDS.map((r) => {
                  const st = REFUND_STATUS[r.status];
                  return (
                    <tr key={r.id} className="border-b border-line/70 last:border-0">
                      <td className="px-5 py-3 font-medium text-ink">{r.id}</td>
                      <td className="px-3 py-3 text-ink">{r.parent}</td>
                      <td className="px-3 py-3 text-muted">{r.reason}</td>
                      <td className="px-3 py-3"><span className={cn("pill", st.cls)}>{st.label}</span></td>
                      <td className="px-3 py-3 font-medium text-ink">{r.amount}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* B2B packages */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-line px-5 py-3">
          <Building2 size={16} className="text-duyo-blue" />
          <h2 className="text-sm font-semibold text-ink">B2B paketlar</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
          {B2B_PACKAGES.map((b) => {
            const Icon = b.icon;
            return (
              <div key={b.name} className="rounded-xl border border-line p-4">
                <div className="flex items-center justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-duyo-50">
                    <Icon size={18} className="text-duyo-blue" />
                  </div>
                  <span className="pill bg-bg text-muted border border-line">{b.clients} mijoz</span>
                </div>
                <div className="mt-3 text-base font-semibold text-ink">{b.name}</div>
                <div className="text-xs text-muted">{b.segment}</div>
                <div className="mt-3 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted">Hajm</span>
                    <span className="text-ink">{b.seats}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Narx</span>
                    <span className="font-medium text-ink">{b.price}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-3 text-xs text-muted">
        MOCK ma'lumotlar — to'lov shlyuzlari (Click / Payme) backendga ulanganda real vaqtli yangilanadi.
      </p>
    </div>
  );
}
