import { useState } from "react";
import {
  Gauge,
  Coins,
  DollarSign,
  GitBranch,
  Sparkles,
  Search,
  Filter,
  Plus,
  Pencil,
  ShieldCheck,
  AlertTriangle,
  Cpu,
  Database,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { PageHeader } from "@/components/PageHeader";
import { cn } from "@/lib/utils";

// MOCK — barcha qiymatlar backend (AI orchestration) ulanmaguncha namuna.

type TabKey =
  | "scripted"
  | "prompts"
  | "router"
  | "logs"
  | "filters"
  | "cache";

const TABS: { key: TabKey; label: string }[] = [
  { key: "scripted", label: "Skriptli javoblar" },
  { key: "prompts", label: "Prompt shablonlari" },
  { key: "router", label: "Model Router" },
  { key: "logs", label: "AI jurnallari" },
  { key: "filters", label: "Xavfsizlik filtrlari" },
  { key: "cache", label: "Cache & xarajat" },
];

// ── Yuqori KPI kartalari ────────────────────────────────────────────────
interface Kpi {
  label: string;
  value: string;
  hint: string;
  hintTone: "safe" | "warn" | "muted";
  icon: LucideIcon;
}

const KPIS: Kpi[] = [
  { label: "O'rtacha kechikish", value: "1.2s", hint: "-13% o'tgan haftaga", hintTone: "safe", icon: Gauge },
  { label: "Tokenlar sarfi (bugun)", value: "4.2M", hint: "Bugungi seans 6,140", hintTone: "muted", icon: Coins },
  { label: "Jami xarajat (bugun)", value: "$142.50", hint: "STT/TTS + LLM", hintTone: "muted", icon: DollarSign },
  { label: "Fallback darajasi", value: "0.8%", hint: "Pro modelga o'tish", hintTone: "warn", icon: GitBranch },
];

const HINT_TONE: Record<Kpi["hintTone"], string> = {
  safe: "text-safe",
  warn: "text-serious",
  muted: "text-muted",
};

// ── Skriptli javoblar ───────────────────────────────────────────────────
type AgeSegment = "junior" | "explorer" | "companion";

interface ScriptedIntent {
  intent: string;
  langs: string[];
  segments: AgeSegment[];
  variants: number;
  status: "active" | "draft";
  updatedAt: string;
}

const SEGMENT_STYLES: Record<AgeSegment, { label: string; cls: string }> = {
  junior: { label: "Junior", cls: "bg-warn-bg text-warn border border-warn-line" },
  explorer: { label: "Explorer", cls: "bg-duyo-50 text-duyo-dark border border-duyo-100" },
  companion: { label: "Companion", cls: "bg-safe-bg text-safe border border-safe-line" },
};

const SCRIPTED: ScriptedIntent[] = [
  { intent: "Salomlashish", langs: ["UZ", "RU", "EN"], segments: ["junior", "explorer"], variants: 12, status: "active", updatedAt: "12 May, 2024" },
  { intent: "Xayrlashish", langs: ["UZ", "RU", "EN"], segments: ["companion"], variants: 8, status: "active", updatedAt: "12 May, 2024" },
  { intent: "Yordam so'rash", langs: ["UZ"], segments: ["companion"], variants: 4, status: "draft", updatedAt: "Bugun, 09:45" },
  { intent: "Maqtov / rag'bat", langs: ["UZ", "RU"], segments: ["junior", "explorer", "companion"], variants: 16, status: "active", updatedAt: "9 May, 2024" },
  { intent: "Nomaqbul so'rovni rad etish", langs: ["UZ", "RU", "EN"], segments: ["explorer", "companion"], variants: 6, status: "active", updatedAt: "7 May, 2024" },
];

// ── Prompt shablonlari ──────────────────────────────────────────────────
interface PromptTemplate {
  name: string;
  segment: string;
  version: string;
  body: string;
  updatedAt: string;
  flagged?: boolean;
  accent: string;
}

const PROMPTS: PromptTemplate[] = [
  {
    name: "Junior Tutor",
    segment: "5-7 yosh",
    version: "v2.1.0",
    body: "Siz 5-7 yoshli bolalar uchun mehribon o'qituvchisiz. Qisqa, sodda gaplardan foydalaning. Murakkab atamalarni tushuntiring.",
    updatedAt: "15 apr",
    accent: "border-l-duyo-blue",
  },
  {
    name: "Explorer Tutor",
    segment: "8-10 yosh",
    version: "v1.8.0",
    body: "Siz 8-10 yoshli bolalar uchun qiziquvchan yo'ldoshisiz. Savollar bering, kashfiyotni rag'batlantiring, lekin javoblarni darrov bermang.",
    updatedAt: "22 apr",
    accent: "border-l-serious",
  },
  {
    name: "Crisis-sensitive",
    segment: "Barcha yosh",
    version: "v3.0.0",
    body: "Foydalanuvchi ruhiy holatida xavf belgilari aniqlansa: tinchlantiruvchi, qo'llab-quvvatlovchi javob bering va Safety review'ga eskalatsiya qiling.",
    updatedAt: "3 kun oldin",
    flagged: true,
    accent: "border-l-urgent",
  },
];

// ── Model Router ────────────────────────────────────────────────────────
interface RouterRow {
  useCase: string;
  primary: string;
  fallback: string;
  local: string;
  cache: string;
}

const ROUTER: RouterRow[] = [
  { useCase: "Chat interfeysi", primary: "Gemini 2.5 Flash", fallback: "Gemini 2.5 Pro", local: "Llama 3.1 8B", cache: "10m" },
  { useCase: "Insho tahlili", primary: "Gemini 2.5 Pro", fallback: "Claude Haiku", local: "—", cache: "30m" },
  { useCase: "Grammatika", primary: "Lokal (Llama)", fallback: "Gemini 2.5 Flash", local: "Llama 3.1 8B", cache: "24h" },
  { useCase: "RAG (darslik)", primary: "Gemini 2.5 Flash", fallback: "Gemini 2.5 Pro", local: "—", cache: "6h" },
];

interface TierLimit {
  tier: string;
  limit: string;
  cls: string;
}

const TIER_LIMITS: TierLimit[] = [
  { tier: "Free", limit: "20 / kun", cls: "bg-bg text-ink border border-line" },
  { tier: "Plus", limit: "200 / kun", cls: "bg-duyo-50 text-duyo-dark border border-duyo-100" },
  { tier: "Family", limit: "Cheklanmagan", cls: "bg-safe-bg text-safe border border-safe-line" },
];

// ── AI jurnallari ───────────────────────────────────────────────────────
interface AiLog {
  id: string;
  promptVersion: string;
  latency: number;
  tokens: number;
  cost: number;
  fallback: string | null;
  safety: "pass" | "filtered";
  time: string;
}

const LOGS: AiLog[] = [
  { id: "req_9f21", promptVersion: "Junior v2.1.0", latency: 940, tokens: 612, cost: 0.0021, fallback: null, safety: "pass", time: "09:58:12" },
  { id: "req_9f1d", promptVersion: "Explorer v1.8.0", latency: 1280, tokens: 845, cost: 0.0039, fallback: "Pro (timeout)", safety: "pass", time: "09:57:41" },
  { id: "req_9f0a", promptVersion: "Crisis v3.0.0", latency: 1610, tokens: 1102, cost: 0.0061, fallback: null, safety: "filtered", time: "09:56:03" },
  { id: "req_9ef4", promptVersion: "Junior v2.1.0", latency: 870, tokens: 540, cost: 0.0018, fallback: null, safety: "pass", time: "09:55:22" },
  { id: "req_9ee1", promptVersion: "RAG v1.2.0", latency: 2040, tokens: 1880, cost: 0.0094, fallback: "Pro (low conf.)", safety: "pass", time: "09:54:10" },
];

// ── Xavfsizlik filtrlari ────────────────────────────────────────────────
interface SafetyFilter {
  key: string;
  label: string;
  desc: string;
  enabled: boolean;
}

const INITIAL_FILTERS: SafetyFilter[] = [
  { key: "toxic", label: "Toksik kontent filtri", desc: "Tajovuzkor va zo'ravonlik kontentini bloklaydi.", enabled: true },
  { key: "blacklist", label: "Mavzu \"Blacklist\"", desc: "Yoshga nomaqbul mavzularni rad etadi.", enabled: true },
  { key: "vocab", label: "Yoshga mos lug'at", desc: "Yosh segmentiga ko'ra lug'atni cheklaydi.", enabled: true },
  { key: "url", label: "Tashqi URL bloklash", desc: "Javoblardagi havolalarni avtomatik o'chiradi.", enabled: false },
];

// ── Cache & xarajat trend ───────────────────────────────────────────────
const COST_TREND = [
  { day: "Du", cost: 118, cache: 61 },
  { day: "Se", cost: 132, cache: 64 },
  { day: "Ch", cost: 121, cache: 67 },
  { day: "Pa", cost: 145, cache: 65 },
  { day: "Ju", cost: 139, cache: 70 },
  { day: "Sh", cost: 96, cache: 72 },
  { day: "Ya", cost: 142, cache: 69 },
];

export function AiManagement() {
  const [tab, setTab] = useState<TabKey>("scripted");
  const [filters, setFilters] = useState<SafetyFilter[]>(INITIAL_FILTERS);
  const [query, setQuery] = useState("");

  const toggleFilter = (key: string) => {
    setFilters((prev) =>
      prev.map((f) => (f.key === key ? { ...f, enabled: !f.enabled } : f)),
    );
  };

  const scriptedRows = SCRIPTED.filter((s) =>
    s.intent.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div>
      <PageHeader
        title="AI boshqaruvi"
        subtitle="Skriptli javoblar, prompt shablonlari, model marshrutlash, AI jurnallari, xavfsizlik filtrlari va xarajatlarni nazorat qilish"
        actions={
          <span className="pill bg-safe-bg text-safe border border-safe-line">
            <span className="h-1.5 w-1.5 rounded-full bg-safe" /> Ishchi muhit: Prod
          </span>
        }
      />

      {/* KPI strip */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {KPIS.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="card p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted">{k.label}</span>
                <Icon size={16} className="text-muted" />
              </div>
              <div className="mt-2 text-2xl font-bold text-ink">{k.value}</div>
              <div className={cn("mt-1 text-[11px]", HINT_TONE[k.hintTone])}>{k.hint}</div>
            </div>
          );
        })}
      </div>

      {/* Tab bar */}
      <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-line pb-px">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-duyo-blue text-duyo-dark"
                  : "border-transparent text-muted hover:text-ink",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "scripted" && (
        <ScriptedResponses
          rows={scriptedRows}
          query={query}
          onQuery={setQuery}
        />
      )}
      {tab === "prompts" && <PromptTemplates />}
      {tab === "router" && <ModelRouter />}
      {tab === "logs" && <AiLogs />}
      {tab === "filters" && <SafetyFilters filters={filters} onToggle={toggleFilter} />}
      {tab === "cache" && <CacheAndCost />}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Skriptli javoblar
// ════════════════════════════════════════════════════════════════════════
function ScriptedResponses({
  rows,
  query,
  onQuery,
}: {
  rows: ScriptedIntent[];
  query: string;
  onQuery: (v: string) => void;
}) {
  return (
    <section>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">Skriptli javoblar</h2>
          <p className="mt-1 text-sm text-muted">
            Oldindan belgilangan intentlar uchun tahrirlangan javoblar.
          </p>
        </div>
        <button className="flex shrink-0 items-center gap-1.5 rounded-xl bg-duyo-blue px-3 py-2 text-sm font-medium text-white hover:bg-duyo-dark">
          <Plus size={15} /> Yangi intent qo'shish
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-line p-3">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-line bg-bg px-3 py-2">
            <Search size={15} className="text-muted" />
            <input
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              placeholder="Intent bo'yicha qidirish..."
              className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted"
            />
          </div>
          <button className="flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm font-medium text-ink hover:bg-bg">
            <Filter size={14} /> Filter
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase text-muted">
                <th className="px-3 py-3">Intent nomi</th>
                <th className="px-3 py-3">Til</th>
                <th className="px-3 py-3">Yosh segmenti</th>
                <th className="px-3 py-3">Variantlar</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">So'nggi yangilanish</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.intent} className="border-b border-line/70 last:border-0">
                  <td className="px-3 py-3 font-medium text-ink">{r.intent}</td>
                  <td className="px-3 py-3 text-muted">{r.langs.join(", ")}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      {r.segments.map((seg) => (
                        <span key={seg} className={cn("pill", SEGMENT_STYLES[seg].cls)}>
                          {SEGMENT_STYLES[seg].label}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-ink">{r.variants} variant</td>
                  <td className="px-3 py-3">
                    {r.status === "active" ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-safe">
                        <span className="h-1.5 w-1.5 rounded-full bg-safe" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-warn">
                        <span className="h-1.5 w-1.5 rounded-full bg-warn" /> Draft
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-muted">{r.updatedAt}</td>
                  <td className="px-3 py-3 text-right">
                    <button className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-ink hover:border-duyo-blue hover:bg-duyo-50">
                      <Pencil size={13} /> Tahrirlash
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-sm text-muted">
                    Mos intent topilmadi.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Prompt shablonlari
// ════════════════════════════════════════════════════════════════════════
function PromptTemplates() {
  return (
    <section>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-ink">Prompt shablonlari</h2>
        <p className="mt-1 text-sm text-muted">
          Segmentlar bo'yicha tizim promptlarini boshqarish.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {PROMPTS.map((p) => (
          <div key={p.name} className={cn("card border-l-4 p-5", p.accent)}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-ink">{p.name}</h3>
                <div className="mt-0.5 text-[11px] uppercase tracking-wide text-muted">
                  {p.segment} · {p.version}
                </div>
              </div>
              {p.flagged ? (
                <AlertTriangle size={16} className="shrink-0 text-urgent" />
              ) : (
                <ShieldCheck size={16} className="shrink-0 text-safe" />
              )}
            </div>
            <p className="mt-3 line-clamp-4 rounded-xl bg-bg p-3 font-mono text-xs leading-relaxed text-muted">
              {p.body}
            </p>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-[11px] text-muted">Yangilangan: {p.updatedAt}</span>
              <button className="inline-flex items-center gap-1 text-xs font-medium text-duyo-blue hover:text-duyo-dark">
                <Pencil size={13} /> Tahrirlash
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Model Router
// ════════════════════════════════════════════════════════════════════════
function ModelRouter() {
  return (
    <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="card overflow-hidden lg:col-span-2">
        <div className="flex items-center gap-2 border-b border-line px-5 py-3">
          <GitBranch size={16} className="text-duyo-blue" />
          <h2 className="text-sm font-semibold text-ink">Model marshrutlash</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase text-muted">
                <th className="px-3 py-3">Use case</th>
                <th className="px-3 py-3">Primary</th>
                <th className="px-3 py-3">Fallback</th>
                <th className="px-3 py-3">Lokal</th>
                <th className="px-3 py-3">Cache TTL</th>
              </tr>
            </thead>
            <tbody>
              {ROUTER.map((r) => (
                <tr key={r.useCase} className="border-b border-line/70 last:border-0">
                  <td className="px-3 py-3 font-medium text-ink">{r.useCase}</td>
                  <td className="px-3 py-3 text-ink">{r.primary}</td>
                  <td className="px-3 py-3 text-muted">{r.fallback}</td>
                  <td className="px-3 py-3 text-muted">{r.local}</td>
                  <td className="px-3 py-3">
                    <span className="pill bg-bg text-muted border border-line">{r.cache}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-6">
        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Cpu size={16} className="text-duyo-blue" />
            <h2 className="text-sm font-semibold text-ink">Tier rate-limitlari</h2>
          </div>
          <div className="space-y-3">
            {TIER_LIMITS.map((t) => (
              <div key={t.tier} className="flex items-center justify-between rounded-xl border border-line p-3">
                <span className={cn("pill", t.cls)}>{t.tier}</span>
                <span className="text-sm font-medium text-ink">{t.limit}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2">
            <Database size={16} className="text-duyo-blue" />
            <h2 className="text-sm font-semibold text-ink">Cache sozlamalari</h2>
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Global cache TTL</dt>
              <dd className="font-medium text-ink">15 daqiqa</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Semantik cache</dt>
              <dd className="font-medium text-safe">Yoqilgan</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Cache hit darajasi</dt>
              <dd className="font-medium text-ink">68%</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}

// ════════════════════════════════════════════════════════════════════════
// AI jurnallari
// ════════════════════════════════════════════════════════════════════════
function AiLogs() {
  return (
    <section>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-ink">AI jurnallari</h2>
        <p className="mt-1 text-sm text-muted">
          So'nggi inferens chaqiruvlari — kechikish, token va xarajat tafsilotlari.
        </p>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase text-muted">
                <th className="px-3 py-3">So'rov</th>
                <th className="px-3 py-3">Prompt versiyasi</th>
                <th className="px-3 py-3">Kechikish</th>
                <th className="px-3 py-3">Tokenlar</th>
                <th className="px-3 py-3">Xarajat</th>
                <th className="px-3 py-3">Fallback sababi</th>
                <th className="px-3 py-3">Xavfsizlik filtri</th>
                <th className="px-3 py-3">Vaqt</th>
              </tr>
            </thead>
            <tbody>
              {LOGS.map((l) => (
                <tr key={l.id} className="border-b border-line/70 last:border-0">
                  <td className="px-3 py-3 font-mono text-xs text-ink">{l.id}</td>
                  <td className="px-3 py-3 text-muted">{l.promptVersion}</td>
                  <td
                    className={cn(
                      "px-3 py-3 font-medium",
                      l.latency > 1500 ? "text-serious" : "text-ink",
                    )}
                  >
                    {l.latency}ms
                  </td>
                  <td className="px-3 py-3 text-muted">{l.tokens.toLocaleString()}</td>
                  <td className="px-3 py-3 text-ink">${l.cost.toFixed(4)}</td>
                  <td className="px-3 py-3">
                    {l.fallback ? (
                      <span className="pill bg-serious-bg text-serious border border-serious-line">
                        {l.fallback}
                      </span>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {l.safety === "pass" ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-safe">
                        <ShieldCheck size={13} /> Pass
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-urgent">
                        <AlertTriangle size={13} /> Filtrlandi
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-xs text-muted">{l.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Xavfsizlik filtrlari
// ════════════════════════════════════════════════════════════════════════
function SafetyFilters({
  filters,
  onToggle,
}: {
  filters: SafetyFilter[];
  onToggle: (key: string) => void;
}) {
  return (
    <section>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-ink">Xavfsizlik filtrlari</h2>
        <p className="mt-1 text-sm text-muted">
          Moderatsiya va xavfsizlik sozlamalari.
        </p>
      </div>

      <div className="card divide-y divide-line">
        {filters.map((f) => (
          <div key={f.key} className="flex items-center justify-between gap-4 p-5">
            <div>
              <div className="text-sm font-medium text-ink">{f.label}</div>
              <div className="mt-0.5 text-xs text-muted">{f.desc}</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={f.enabled}
              aria-label={f.label}
              onClick={() => onToggle(f.key)}
              className={cn(
                "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                f.enabled ? "bg-duyo-blue" : "bg-line",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                  f.enabled ? "translate-x-[22px]" : "translate-x-0.5",
                )}
              />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Cache & xarajat
// ════════════════════════════════════════════════════════════════════════
function CacheAndCost() {
  return (
    <section className="space-y-6">
      <div className="card p-5">
        <div className="mb-1 flex items-center gap-2">
          <Sparkles size={16} className="text-duyo-blue" />
          <h2 className="text-sm font-semibold text-ink">Haftalik xarajat va cache hit</h2>
        </div>
        <p className="mb-4 text-xs text-muted">USD (xarajat) va % (cache hit darajasi) — 7 kun.</p>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={COST_TREND} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="costFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563EB" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#64748B" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#64748B" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid #E2E8F0",
                  fontSize: 12,
                }}
              />
              <Area type="monotone" dataKey="cost" name="Xarajat ($)" stroke="#2563EB" strokeWidth={2} fill="url(#costFill)" />
              <Area type="monotone" dataKey="cache" name="Cache hit (%)" stroke="#16A34A" strokeWidth={2} fillOpacity={0} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card p-4">
          <div className="text-xs font-medium text-muted">Cache hit darajasi</div>
          <div className="mt-2 text-2xl font-bold text-ink">68%</div>
          <div className="mt-1 text-[11px] text-safe">+5% o'tgan haftaga</div>
        </div>
        <div className="card p-4">
          <div className="text-xs font-medium text-muted">Saqlangan xarajat (oy)</div>
          <div className="mt-2 text-2xl font-bold text-ink">$1,240</div>
          <div className="mt-1 text-[11px] text-muted">Cache + lokal model</div>
        </div>
        <div className="card p-4">
          <div className="text-xs font-medium text-muted">Lokal model ulushi</div>
          <div className="mt-2 text-2xl font-bold text-ink">31%</div>
          <div className="mt-1 text-[11px] text-muted">Grammatika + oddiy so'rovlar</div>
        </div>
      </div>

      {/* Yangi model banner */}
      <div className="card flex flex-col items-start justify-between gap-4 bg-ink p-6 text-white sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <Sparkles size={20} className="mt-0.5 shrink-0 text-duyo-100" />
          <div>
            <div className="text-sm font-semibold">Yangi model: Gemini 2.5 Flash o'rnatildi</div>
            <p className="mt-1 text-xs text-white/70">
              Tezroq modelga o'tish bilan kechikish 30% ga kamaydi, xarajat barqaror saqlanmoqda.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button className="rounded-xl bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-white/90">
            Tahlilni ko'rish
          </button>
          <button className="rounded-xl border border-white/30 px-3 py-2 text-sm font-medium text-white hover:bg-white/10">
            Bekor qilish
          </button>
        </div>
      </div>
    </section>
  );
}
