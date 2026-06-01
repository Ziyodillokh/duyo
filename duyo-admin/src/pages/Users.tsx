import { useState } from "react";
import {
  Eye,
  UserPlus,
  SlidersHorizontal,
  ShieldCheck,
  Link2,
  ScrollText,
  MessageSquare,
  Snowflake,
  Trophy,
  Flame,
  MessageCircle,
  Mic,
  Lock,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// MOCK — backend (User/Family) ulanmaguncha namuna ma'lumotlar.
// ─────────────────────────────────────────────────────────────────────────────

type AccountStatus = "active" | "suspended" | "deleted";
type AgeSegment = "junior" | "explorer" | "companion";
type Language = "uz" | "ru" | "en";
type Tier = "free" | "premium";

interface Child {
  id: string;
  name: string;
  age: number;
  segment: AgeSegment;
  language: Language;
  tier: Tier;
  status: AccountStatus;
  risk: "green" | "yellow" | "orange";
  activity: string;
  guardian: string;
  guardianRelation: string;
  level: number;
  streak: number;
  aiMessages: number;
  voiceUsage: string;
  interests: string[];
  topics: string;
}

interface Parent {
  id: string;
  name: string;
  relation: string;
  language: Language;
  tier: Tier;
  status: AccountStatus;
  children: string[];
  lastActive: string;
}

const SEGMENT_LABELS: Record<AgeSegment, string> = {
  junior: "Junior",
  explorer: "Explorer",
  companion: "Companion",
};

const SEGMENT_STYLES: Record<AgeSegment, string> = {
  junior: "bg-duyo-50 text-duyo-dark border border-duyo-100",
  explorer: "bg-warn-bg text-warn border border-warn-line",
  companion: "bg-serious-bg text-serious border border-serious-line",
};

const STATUS_META: Record<AccountStatus, { label: string; cls: string }> = {
  active: { label: "Faol", cls: "bg-safe-bg text-safe border border-safe-line" },
  suspended: { label: "Muzlatilgan", cls: "bg-warn-bg text-warn border border-warn-line" },
  deleted: { label: "O'chirilgan", cls: "bg-urgent-bg text-urgent border border-urgent-line" },
};

const RISK_PILL: Record<Child["risk"], { label: string; cls: string; dot: string }> = {
  green: { label: "LOW", cls: "bg-safe-bg text-safe border border-safe-line", dot: "bg-safe" },
  yellow: { label: "YELLOW", cls: "bg-warn-bg text-warn border border-warn-line", dot: "bg-warn" },
  orange: { label: "ORANGE", cls: "bg-serious-bg text-serious border border-serious-line", dot: "bg-serious" },
};

const LANG_LABELS: Record<Language, string> = { uz: "O'ZBEK", ru: "РУССКИЙ", en: "ENGLISH" };
const TIER_LABELS: Record<Tier, string> = { free: "Free", premium: "Premium" };

const CHILDREN: Child[] = [
  {
    id: "48291",
    name: "Azizbek",
    age: 9,
    segment: "explorer",
    language: "uz",
    tier: "premium",
    status: "active",
    risk: "green",
    activity: "5 daq oldin",
    guardian: "Nilufar Karimova",
    guardianRelation: "Ona",
    level: 14,
    streak: 12,
    aiMessages: 42,
    voiceUsage: "18m",
    interests: ["Kosmos", "Matematika", "Lego"],
    topics: "Maktab, Do'stlar, O'yinlar (oxirgi 24s)",
  },
  {
    id: "48295",
    name: "Madina",
    age: 7,
    segment: "junior",
    language: "uz",
    tier: "free",
    status: "active",
    risk: "orange",
    activity: "Offlayn",
    guardian: "Nilufar Karimova",
    guardianRelation: "Ona",
    level: 6,
    streak: 3,
    aiMessages: 11,
    voiceUsage: "5m",
    interests: ["Hayvonlar", "Rasm chizish"],
    topics: "Hayvonlar, Ertaklar (oxirgi 24s)",
  },
  {
    id: "48301",
    name: "Sardor",
    age: 11,
    segment: "companion",
    language: "ru",
    tier: "premium",
    status: "active",
    risk: "yellow",
    activity: "Faol",
    guardian: "Olim Toshev",
    guardianRelation: "Ota",
    level: 22,
    streak: 28,
    aiMessages: 67,
    voiceUsage: "34m",
    interests: ["Futbol", "Robototexnika"],
    topics: "Sport, Maktab (oxirgi 24s)",
  },
  {
    id: "48310",
    name: "Laylo",
    age: 8,
    segment: "explorer",
    language: "uz",
    tier: "premium",
    status: "suspended",
    risk: "green",
    activity: "2 kun oldin",
    guardian: "Nilufar Karimova",
    guardianRelation: "Ona",
    level: 9,
    streak: 0,
    aiMessages: 24,
    voiceUsage: "9m",
    interests: ["Musiqa", "Tabiat"],
    topics: "Musiqa, Tabiat (oxirgi 24s)",
  },
  {
    id: "48322",
    name: "Umar",
    age: 13,
    segment: "companion",
    language: "en",
    tier: "free",
    status: "active",
    risk: "green",
    activity: "1 soat oldin",
    guardian: "Olim Toshev",
    guardianRelation: "Ota",
    level: 31,
    streak: 41,
    aiMessages: 89,
    voiceUsage: "52m",
    interests: ["Astronomiya", "Dasturlash"],
    topics: "Texnologiya, Kosmos (oxirgi 24s)",
  },
];

const PARENTS: Parent[] = [
  {
    id: "P-1042",
    name: "Nilufar Karimova",
    relation: "Ona",
    language: "uz",
    tier: "premium",
    status: "active",
    children: ["Azizbek", "Madina", "Laylo"],
    lastActive: "10 daq oldin",
  },
  {
    id: "P-1058",
    name: "Olim Toshev",
    relation: "Ota",
    language: "ru",
    tier: "premium",
    status: "active",
    children: ["Sardor", "Umar"],
    lastActive: "1 soat oldin",
  },
  {
    id: "P-1071",
    name: "Dilnoza Rahimova",
    relation: "Ona",
    language: "uz",
    tier: "free",
    status: "suspended",
    children: ["—"],
    lastActive: "3 kun oldin",
  },
];

const TABS = [
  { key: "children", label: "Bolalar" },
  { key: "parents", label: "Ota-onalar" },
  { key: "links", label: "Oilaviy bog'lanishlar" },
  { key: "support", label: "Support cases" },
  { key: "blocked", label: "Bloklangan akkauntlar" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

// ─────────────────────────────────────────────────────────────────────────────

export function Users() {
  const [tab, setTab] = useState<TabKey>("children");
  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState<AgeSegment | "all">("all");
  const [selected, setSelected] = useState<Child | null>(CHILDREN[0]);

  const filteredChildren = CHILDREN.filter((c) => {
    const matchesQuery =
      query.trim() === "" ||
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      c.id.includes(query.trim());
    const matchesSegment = segment === "all" || c.segment === segment;
    return matchesQuery && matchesSegment;
  });

  return (
    <div>
      <PageHeader
        title="Foydalanuvchilar va oilalar"
        subtitle="Bolalar, ota-onalar va oilaviy bog'lanishlarni boshqarish"
        actions={
          <>
            <button className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-bg">
              <SlidersHorizontal size={15} /> Saralash
            </button>
            <button className="flex items-center gap-2 rounded-xl bg-duyo-blue px-3 py-2 text-sm font-medium text-white hover:bg-duyo-dark">
              <UserPlus size={15} /> Yangi qo'shish
            </button>
          </>
        }
      />

      {/* Tabs */}
      <div className="mb-5 flex flex-wrap items-center gap-2 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
              tab === t.key
                ? "border-duyo-blue text-duyo-dark"
                : "border-transparent text-muted hover:text-ink",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_360px]">
        <div className="min-w-0">
          {tab === "children" && (
            <ChildrenTab
              rows={filteredChildren}
              query={query}
              onQuery={setQuery}
              segment={segment}
              onSegment={setSegment}
              selectedId={selected?.id ?? null}
              onSelect={setSelected}
            />
          )}
          {tab === "parents" && <ParentsTab />}
          {tab === "links" && <FamilyLinks />}
          {tab === "support" && <SupportCases />}
          {tab === "blocked" && <BlockedAccounts />}
        </div>

        {/* Right detail panel */}
        <ChildDetail child={selected} onClose={() => setSelected(null)} />
      </div>

      {/* Privacy rule — kritik */}
      <div className="mt-5 flex items-start gap-3 rounded-2xl border border-duyo-100 bg-duyo-50 p-4">
        <Lock size={18} className="mt-0.5 shrink-0 text-duyo-blue" />
        <div className="text-sm text-duyo-dark">
          <span className="font-semibold">Maxfiylik qoidasi:</span> Oddiy adminlar faqat
          <span className="font-medium"> maxfiylik-xavfsiz suhbat xulosasini</span> ko'radi —
          XOM suhbat matni EMAS. Xom suhbat kontekstiga faqat Safety Officer roli kira oladi
          (backend darajasida majburlanadi).
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

interface ChildrenTabProps {
  rows: Child[];
  query: string;
  onQuery: (v: string) => void;
  segment: AgeSegment | "all";
  onSegment: (v: AgeSegment | "all") => void;
  selectedId: string | null;
  onSelect: (c: Child) => void;
}

function ChildrenTab({ rows, query, onQuery, segment, onSegment, selectedId, onSelect }: ChildrenTabProps) {
  return (
    <div className="card overflow-hidden">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 border-b border-line p-4">
        <label className="flex min-w-[200px] flex-1 flex-col gap-1">
          <span className="text-xs font-medium text-muted">Qidiruv</span>
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Ism yoki ID bo'yicha..."
            className="rounded-xl border border-line bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-duyo-blue"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">Segment</span>
          <select
            value={segment}
            onChange={(e) => onSegment(e.target.value as AgeSegment | "all")}
            className="rounded-xl border border-line bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-duyo-blue"
          >
            <option value="all">Barcha</option>
            <option value="junior">Junior</option>
            <option value="explorer">Explorer</option>
            <option value="companion">Companion</option>
          </select>
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-muted">
              <th className="px-5 py-3">Bola ismi</th>
              <th className="px-3 py-3">Yosh</th>
              <th className="px-3 py-3">Segment</th>
              <th className="px-3 py-3">Til</th>
              <th className="px-3 py-3">Obuna</th>
              <th className="px-3 py-3">Risk</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Faollik</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-5 py-8 text-center text-sm text-muted">
                  Mos foydalanuvchi topilmadi.
                </td>
              </tr>
            )}
            {rows.map((c) => {
              const risk = RISK_PILL[c.risk];
              const active = c.id === selectedId;
              return (
                <tr
                  key={c.id}
                  onClick={() => onSelect(c)}
                  className={cn(
                    "cursor-pointer border-b border-line/70 last:border-0 hover:bg-bg",
                    active && "bg-duyo-50/60",
                  )}
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-duyo-100 text-xs font-semibold text-duyo-dark">
                        {c.name.charAt(0)}
                      </span>
                      <div>
                        <div className="font-medium text-ink">{c.name}</div>
                        <div className="text-xs text-muted">ID: {c.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-muted">{c.age}</td>
                  <td className="px-3 py-3">
                    <span className={cn("pill", SEGMENT_STYLES[c.segment])}>{SEGMENT_LABELS[c.segment]}</span>
                  </td>
                  <td className="px-3 py-3 text-xs font-medium text-muted">{LANG_LABELS[c.language]}</td>
                  <td className="px-3 py-3 text-muted">{TIER_LABELS[c.tier]}</td>
                  <td className="px-3 py-3">
                    <span className={cn("pill", risk.cls)}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", risk.dot)} /> {risk.label}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span className={cn("pill", STATUS_META[c.status].cls)}>{STATUS_META[c.status].label}</span>
                  </td>
                  <td className="px-3 py-3 text-xs text-muted">{c.activity}</td>
                  <td className="px-3 py-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(c);
                      }}
                      className="flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-ink hover:border-duyo-blue hover:bg-duyo-50"
                    >
                      <Eye size={13} /> Ko'rish
                    </button>
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

// ─────────────────────────────────────────────────────────────────────────────

function ParentsTab() {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-muted">
              <th className="px-5 py-3">Ota-ona</th>
              <th className="px-3 py-3">Aloqa</th>
              <th className="px-3 py-3">Til</th>
              <th className="px-3 py-3">Obuna</th>
              <th className="px-3 py-3">Bog'langan bolalar</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Faollik</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {PARENTS.map((p) => (
              <tr key={p.id} className="border-b border-line/70 last:border-0 hover:bg-bg">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-duyo-100 text-xs font-semibold text-duyo-dark">
                      {p.name.charAt(0)}
                    </span>
                    <div>
                      <div className="font-medium text-ink">{p.name}</div>
                      <div className="text-xs text-muted">ID: {p.id}</div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 text-muted">{p.relation}</td>
                <td className="px-3 py-3 text-xs font-medium text-muted">{LANG_LABELS[p.language]}</td>
                <td className="px-3 py-3 text-muted">{TIER_LABELS[p.tier]}</td>
                <td className="px-3 py-3 text-ink">{p.children.join(", ")}</td>
                <td className="px-3 py-3">
                  <span className={cn("pill", STATUS_META[p.status].cls)}>{STATUS_META[p.status].label}</span>
                </td>
                <td className="px-3 py-3 text-xs text-muted">{p.lastActive}</td>
                <td className="px-3 py-3">
                  <button className="flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-ink hover:border-duyo-blue hover:bg-duyo-50">
                    <Eye size={13} /> Ko'rish
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function FamilyLinks() {
  return (
    <div className="card p-6">
      <div className="mb-1 flex items-center gap-2">
        <Link2 size={16} className="text-duyo-blue" />
        <h2 className="text-sm font-semibold text-ink">Oilaviy bog'lanishlar (Topshiriq)</h2>
      </div>
      <p className="mb-8 text-xs text-muted">Karimova oilasi — vasiy va bolalar o'rtasidagi bog'lanish.</p>

      <div className="flex flex-col items-center">
        {/* Parent node */}
        <div className="flex flex-col items-center rounded-2xl border-2 border-duyo-blue bg-duyo-50 px-5 py-3 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-duyo-100 text-sm font-semibold text-duyo-dark">
            N
          </span>
          <div className="mt-2 text-sm font-semibold text-ink">Nilufar K.</div>
          <div className="text-[11px] uppercase tracking-wide text-muted">Ota-ona</div>
        </div>

        {/* Connector */}
        <div className="h-8 w-px bg-line" />
        <div className="flex w-full max-w-md items-start justify-between gap-4 border-t border-line pt-8">
          {["Azizbek", "Laylo", "Umar"].map((name) => (
            <div key={name} className="flex flex-1 flex-col items-center">
              <div className="-mt-[2.1rem] mb-2 h-8 w-px bg-line" />
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-bg text-xs font-semibold text-ink">
                {name.charAt(0)}
              </span>
              <div className="mt-2 text-xs font-medium text-ink">{name}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const SUPPORT_CASES = [
  { id: "#SUP-3201", user: "Nilufar Karimova", subject: "Obunani tiklash", status: "Ochiq", updated: "12 daq oldin" },
  { id: "#SUP-3198", user: "Olim Toshev", subject: "Parol tiklash", status: "Javob berildi", updated: "2 soat oldin" },
  { id: "#SUP-3190", user: "Dilnoza Rahimova", subject: "Akkauntni o'chirish", status: "Yopilgan", updated: "1 kun oldin" },
];

function SupportCases() {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-muted">
              <th className="px-5 py-3">ID</th>
              <th className="px-3 py-3">Foydalanuvchi</th>
              <th className="px-3 py-3">Mavzu</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Yangilangan</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {SUPPORT_CASES.map((s) => (
              <tr key={s.id} className="border-b border-line/70 last:border-0 hover:bg-bg">
                <td className="px-5 py-3 font-medium text-ink">{s.id}</td>
                <td className="px-3 py-3 text-ink">{s.user}</td>
                <td className="px-3 py-3 text-muted">{s.subject}</td>
                <td className="px-3 py-3 text-muted">{s.status}</td>
                <td className="px-3 py-3 text-xs text-muted">{s.updated}</td>
                <td className="px-3 py-3">
                  <button className="flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-ink hover:border-duyo-blue hover:bg-duyo-50">
                    <Eye size={13} /> Ko'rish
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const BLOCKED = [
  { id: "48310", name: "Laylo", type: "Bola", reason: "Ota-ona so'rovi bo'yicha vaqtincha to'xtatilgan", by: "Nilufar Karimova", date: "29-may 2026" },
  { id: "P-1071", name: "Dilnoza Rahimova", type: "Ota-ona", reason: "To'lov firibgarligi shubhasi", by: "Tizim", date: "27-may 2026" },
];

function BlockedAccounts() {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-muted">
              <th className="px-5 py-3">Akkaunt</th>
              <th className="px-3 py-3">Tur</th>
              <th className="px-3 py-3">Sabab</th>
              <th className="px-3 py-3">Kim tomonidan</th>
              <th className="px-3 py-3">Sana</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {BLOCKED.map((b) => (
              <tr key={b.id} className="border-b border-line/70 last:border-0 hover:bg-bg">
                <td className="px-5 py-3">
                  <div className="font-medium text-ink">{b.name}</div>
                  <div className="text-xs text-muted">ID: {b.id}</div>
                </td>
                <td className="px-3 py-3 text-muted">{b.type}</td>
                <td className="px-3 py-3 text-ink">{b.reason}</td>
                <td className="px-3 py-3 text-muted">{b.by}</td>
                <td className="px-3 py-3 text-xs text-muted">{b.date}</td>
                <td className="px-3 py-3">
                  <button className="rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-ink hover:border-duyo-blue hover:bg-duyo-50">
                    Tiklash
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function StatBox({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-bg p-3">
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 flex items-center gap-1.5 text-base font-bold text-ink">
        {icon}
        {value}
      </div>
    </div>
  );
}

function ChildDetail({ child, onClose }: { child: Child | null; onClose: () => void }) {
  if (!child) {
    return (
      <div className="card flex h-fit items-center justify-center p-8 text-center text-sm text-muted">
        Tafsilotlarni ko'rish uchun bolani tanlang.
      </div>
    );
  }

  return (
    <aside className="card h-fit overflow-hidden">
      {/* Header */}
      <div className="relative bg-duyo-50 p-5 text-center">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg p-1 text-muted hover:bg-surface hover:text-ink"
          aria-label="Yopish"
        >
          <X size={16} />
        </button>
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-duyo-100 text-xl font-bold text-duyo-dark">
          {child.name.charAt(0)}
        </div>
        <h2 className="mt-3 text-lg font-bold text-ink">{child.name}</h2>
        <div className="mt-2 flex flex-wrap justify-center gap-1.5">
          <span className="pill bg-surface text-duyo-dark border border-duyo-100">{child.age} yosh</span>
          <span className={cn("pill", SEGMENT_STYLES[child.segment])}>{SEGMENT_LABELS[child.segment]}</span>
          <span className="pill bg-surface text-muted border border-line">{LANG_LABELS[child.language]}</span>
        </div>
      </div>

      <div className="space-y-5 p-5">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <StatBox label="DUYO Level" value={String(child.level)} icon={<Trophy size={14} className="text-duyo-blue" />} />
          <StatBox label="Streak" value={`${child.streak} kun`} icon={<Flame size={14} className="text-serious" />} />
          <StatBox label="AI Messages" value={String(child.aiMessages)} icon={<MessageCircle size={14} className="text-muted" />} />
          <StatBox label="Voice usage" value={child.voiceUsage} icon={<Mic size={14} className="text-muted" />} />
        </div>

        {/* Linked guardian */}
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Bog'langan vasiy</div>
          <div className="flex items-center justify-between rounded-xl border border-line bg-bg p-3">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-duyo-100 text-xs font-semibold text-duyo-dark">
                {child.guardian.charAt(0)}
              </span>
              <div>
                <div className="text-sm font-medium text-ink">{child.guardian}</div>
                <div className="text-xs text-muted">{child.guardianRelation}</div>
              </div>
            </div>
            <Link2 size={16} className="text-duyo-blue" />
          </div>
        </div>

        {/* Interests */}
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Qiziqishlari</div>
          <div className="flex flex-wrap gap-1.5">
            {child.interests.map((i) => (
              <span key={i} className="pill bg-bg text-ink border border-line">{i}</span>
            ))}
          </div>
        </div>

        {/* Safety status */}
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
            <ShieldCheck size={13} className="text-safe" /> Xavfsizlik
          </div>
          <p className="text-sm text-ink">
            Barcha AI filtrlar faol holatda. Ota-ona nazorati 100%.
          </p>
        </div>

        {/* Privacy-safe chat summary (NOT raw chat) */}
        <div className="rounded-xl border border-duyo-100 bg-duyo-50 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-duyo-dark">
            <Lock size={13} /> Suhbat xulosasi (maxfiylik-xavfsiz)
          </div>
          <p className="text-sm text-duyo-dark">Muloqot mavzulari: {child.topics}</p>
          <p className="mt-1 text-[11px] text-muted">
            Faqat AI yaratgan xulosa ko'rsatiladi — xom suhbat matni admin uchun ko'rinmaydi.
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-2 border-t border-line pt-4">
          <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-ink hover:bg-bg">
            <ScrollText size={15} /> Audit logini ko'rish
          </button>
          <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-duyo-blue px-4 py-2.5 text-sm font-medium text-duyo-dark hover:bg-duyo-50">
            <MessageSquare size={15} /> Support SMS yuborish
          </button>
          <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-urgent px-4 py-2.5 text-sm font-medium text-white hover:bg-urgent/90">
            <Snowflake size={15} /> Akkauntni muzlatish
          </button>
        </div>
      </div>
    </aside>
  );
}
