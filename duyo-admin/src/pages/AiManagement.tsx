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
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/api/admin";
import type { AiLogRow, AiSummary } from "@/api/admin";
import { PageHeader } from "@/components/PageHeader";
import { cn } from "@/lib/utils";

// AI jurnallari va yuqori KPI strip → real backend (adminApi.aiLogs / aiSummary).
// Skriptli javoblar, prompt shablonlari, model router, xavfsizlik filtrlari va
// cache trend hozircha MOCK (konfiguratsiya, backend yo'q).

// Taxminiy LLM narxi — backend price maydoni yo'qligi sababli rejasiy baho.
// $ / 1M token (kirish + chiqish birlashtirilgan o'rtacha).
const COST_PER_MILLION_TOKENS = 0.3;
const SLOW_LATENCY_MS = 1500;

function estimateCostUsd(tokens: number): number {
  return (tokens / 1_000_000) * COST_PER_MILLION_TOKENS;
}

function formatCompact(n: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

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

const LOADING_DASH = "…";

// Real `aiSummary()` dan KPI strip quriladi. summary undefined bo'lsa loading.
function buildKpis(summary: AiSummary | undefined): Kpi[] {
  const totalTokens =
    summary === undefined ? 0 : summary.tokens_in + summary.tokens_out;

  const latencyValue =
    summary === undefined
      ? LOADING_DASH
      : `${(summary.avg_latency_ms / 1000).toFixed(1)}s`;

  const tokensValue =
    summary === undefined ? LOADING_DASH : formatCompact(totalTokens);

  const costValue =
    summary === undefined
      ? LOADING_DASH
      : `$${estimateCostUsd(totalTokens).toFixed(2)}`;

  const messagesValue =
    summary === undefined
      ? LOADING_DASH
      : new Intl.NumberFormat("en-US").format(summary.messages);

  const latencyTone: Kpi["hintTone"] =
    summary !== undefined && summary.avg_latency_ms > SLOW_LATENCY_MS
      ? "warn"
      : "safe";

  return [
    {
      label: "O'rtacha kechikish",
      value: latencyValue,
      hint: "Barcha inferens chaqiruvlari",
      hintTone: latencyTone,
      icon: Gauge,
    },
    {
      label: "Tokenlar sarfi",
      value: tokensValue,
      hint: "Kirish + chiqish jami",
      hintTone: "muted",
      icon: Coins,
    },
    {
      label: "Taxminiy xarajat",
      value: costValue,
      hint: `Taxmin · $${COST_PER_MILLION_TOKENS}/1M token`,
      hintTone: "muted",
      icon: DollarSign,
    },
    {
      label: "Xabarlar soni",
      value: messagesValue,
      hint: "Jami inferens",
      hintTone: "muted",
      icon: GitBranch,
    },
  ];
}

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

  const { data: summary } = useQuery({
    queryKey: ["ai-summary"],
    queryFn: () => adminApi.aiSummary(),
  });

  const kpis = buildKpis(summary);

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
        {kpis.map((k) => {
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
      {tab === "logs" && <AiLogs byModel={summary?.by_model} />}
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
// AI jurnallari — real backend (adminApi.aiLogs)
// ════════════════════════════════════════════════════════════════════════
function shortId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}` : id;
}

function formatLogTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AiLogs({ byModel }: { byModel?: Record<string, number> }) {
  const { data: logs, isPending, isError } = useQuery({
    queryKey: ["ai-logs"],
    queryFn: () => adminApi.aiLogs(),
  });

  const modelEntries = byModel ? Object.entries(byModel) : [];

  return (
    <section>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-ink">AI jurnallari</h2>
        <p className="mt-1 text-sm text-muted">
          So'nggi inferens chaqiruvlari — model, kechikish va token tafsilotlari.
        </p>
      </div>

      {modelEntries.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {modelEntries.map(([model, count]) => (
            <span
              key={model}
              className="pill bg-bg text-muted border border-line"
            >
              <Cpu size={12} className="text-duyo-blue" /> {model}
              <span className="font-medium text-ink">
                {new Intl.NumberFormat("en-US").format(count)}
              </span>
            </span>
          ))}
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase text-muted">
                <th className="px-3 py-3">So'rov</th>
                <th className="px-3 py-3">Model</th>
                <th className="px-3 py-3">Kechikish</th>
                <th className="px-3 py-3">Tokenlar (kirish)</th>
                <th className="px-3 py-3">Tokenlar (chiqish)</th>
                <th className="px-3 py-3">Vaqt</th>
              </tr>
            </thead>
            <tbody>
              {isPending && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-sm text-muted">
                    {LOADING_DASH} Yuklanmoqda
                  </td>
                </tr>
              )}
              {isError && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-8 text-center text-sm text-serious"
                  >
                    Jurnallarni yuklab bo'lmadi.
                  </td>
                </tr>
              )}
              {!isPending && !isError && logs && logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-sm text-muted">
                    Hozircha jurnal yozuvlari yo'q.
                  </td>
                </tr>
              )}
              {!isPending &&
                !isError &&
                logs?.map((l: AiLogRow) => (
                  <tr key={l.id} className="border-b border-line/70 last:border-0">
                    <td className="px-3 py-3 font-mono text-xs text-ink">
                      {shortId(l.id)}
                    </td>
                    <td className="px-3 py-3 text-muted">{l.model ?? "—"}</td>
                    <td
                      className={cn(
                        "px-3 py-3 font-medium",
                        l.latency_ms !== null && l.latency_ms > SLOW_LATENCY_MS
                          ? "text-serious"
                          : "text-ink",
                      )}
                    >
                      {l.latency_ms !== null ? `${l.latency_ms}ms` : "—"}
                    </td>
                    <td className="px-3 py-3 text-muted">
                      {l.tokens_in !== null ? l.tokens_in.toLocaleString() : "—"}
                    </td>
                    <td className="px-3 py-3 text-muted">
                      {l.tokens_out !== null ? l.tokens_out.toLocaleString() : "—"}
                    </td>
                    <td className="px-3 py-3 text-xs text-muted">
                      {formatLogTime(l.created_at)}
                    </td>
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
