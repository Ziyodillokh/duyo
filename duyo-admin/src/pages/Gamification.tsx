import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Shirt,
  Coins,
  Trophy,
  Heart,
  Flame,
  PlusCircle,
  Pencil,
  Trash2,
  Search,
  SlidersHorizontal,
  CalendarCheck,
  MessageCircle,
  BookOpen,
  Gamepad2,
  Footprints,
  GraduationCap,
  Battery,
  Brain,
  Smile,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/api/admin";
import type { GamificationOverview } from "@/api/admin";
import { PageHeader } from "@/components/PageHeader";
import { cn } from "@/lib/utils";

// ───────────────────────────────────────────────────────────────────────────
// MOCK ma'lumotlar — backend (Gamification config) ulanmaguncha namuna.
// ───────────────────────────────────────────────────────────────────────────

type TabKey =
  | "avatar"
  | "inventory"
  | "points"
  | "levels"
  | "streaks"
  | "tamagochi";

const TABS: { key: TabKey; label: string }[] = [
  { key: "avatar", label: "Avatar sozlamalari" },
  { key: "inventory", label: "Inventar" },
  { key: "points", label: "Ballar qoidalari" },
  { key: "levels", label: "Darajalar" },
  { key: "streaks", label: "Yutuqlar (Streaks)" },
  { key: "tamagochi", label: "Tamagochi metrikalari" },
];

// Avatar — body types
interface BodyType {
  id: string;
  name: string;
  note: string;
  emoji: string;
}

const BODY_TYPES: BodyType[] = [
  { id: "oddiy", name: "Oddiy DUYO", note: "Asosiy model", emoji: "🧸" },
  { id: "astro", name: "Astro DUYO", note: "Daraja 10+ ochiladi", emoji: "🤖" },
  { id: "tabiat", name: "Tabiat DUYO", note: "Epik item", emoji: "🌿" },
];

// Avatar — body colors
const BODY_COLORS: { name: string; hex: string }[] = [
  { name: "Osmon", hex: "#60A5FA" },
  { name: "Yashil", hex: "#34D399" },
  { name: "Quyosh", hex: "#FBBF24" },
  { name: "Marjon", hex: "#FB7185" },
  { name: "Siyoh", hex: "#1E293B" },
  { name: "Lavanda", hex: "#A78BFA" },
];

// Avatar — accent colors
const ACCENT_COLORS: { name: string; hex: string }[] = [
  { name: "Duyo ko'k", hex: "#2563EB" },
  { name: "Mandarin", hex: "#F97316" },
  { name: "Pushti", hex: "#EC4899" },
  { name: "Zumrad", hex: "#10B981" },
];

// Avatar — face expressions
const EXPRESSIONS: { name: string; emoji: string }[] = [
  { name: "Tabassum", emoji: "😊" },
  { name: "Hayajon", emoji: "🤩" },
  { name: "O'ylanish", emoji: "🤔" },
  { name: "Quvonch", emoji: "😄" },
  { name: "Tinch", emoji: "😌" },
];

// Avatar — animations
interface Animation {
  name: string;
  note: string;
  icon: LucideIcon;
}

const ANIMATIONS: Animation[] = [
  { name: "Idle (Kutish)", note: "Yumshoq nafas", icon: Heart },
  { name: "Talking (Gapirish)", note: "Lablar tez harakati", icon: MessageCircle },
  { name: "Sleeping (Uxlash)", note: "Zzz bubbllari", icon: Smile },
];

// Inventory — accessories
interface Accessory {
  id: string;
  name: string;
  category: string;
  ageRange: string;
  price: number;
  rarity: "Oddiy" | "Noyob" | "Epik";
  icon: LucideIcon;
}

const RARITY_STYLES: Record<Accessory["rarity"], string> = {
  Oddiy: "bg-bg text-muted border border-line",
  Noyob: "bg-duyo-50 text-duyo-dark border border-duyo-100",
  Epik: "bg-serious-bg text-serious border border-serious-line",
};

const ACCESSORIES: Accessory[] = [
  { id: "a1", name: "Uchar qalpoq", category: "Bosh kiyim", ageRange: "7–10", price: 200, rarity: "Epik", icon: Sparkles },
  { id: "a2", name: "Bilimdon shlyapa", category: "Bosh kiyim", ageRange: "5–12", price: 150, rarity: "Noyob", icon: GraduationCap },
  { id: "a3", name: "Aqlli ko'zoynak", category: "Ko'zoynak", ageRange: "8–14", price: 120, rarity: "Oddiy", icon: Shirt },
  { id: "a4", name: "Yulduz antenna", category: "Antenna", ageRange: "6–10", price: 180, rarity: "Noyob", icon: Sparkles },
  { id: "a5", name: "Kosmik fon", category: "Fon", ageRange: "5–14", price: 250, rarity: "Epik", icon: Trophy },
  { id: "a6", name: "Qishki bayram to'plami", category: "Mavsumiy", ageRange: "5–14", price: 300, rarity: "Epik", icon: Sparkles },
];

// Points — ball rules
interface PointRule {
  action: string;
  points: number;
  note: string;
  icon: LucideIcon;
}

const POINT_RULES: PointRule[] = [
  { action: "Kundalik kirish", points: 5, note: "Har kuni 1 marta", icon: CalendarCheck },
  { action: "5 daqiqalik suhbat", points: 10, note: "Kuniga 3 martagacha", icon: MessageCircle },
  { action: "She'r yodlash", points: 15, note: "To'liq yod olinganda", icon: BookOpen },
  { action: "Darsga yordam", points: 12, note: "Bajarilgan topshiriq", icon: GraduationCap },
  { action: "Til o'yini", points: 8, note: "G'alaba bilan tugaganda", icon: Gamepad2 },
  { action: "Sport / sayr", points: 10, note: "Kuniga 1 marta (ota-ona tasdiqi)", icon: Footprints },
  { action: "Streak bonusi", points: 20, note: "7 kunlik ketma-ketlik", icon: Flame },
];

// Levels
interface Level {
  rank: number;
  name: string;
  points: number;
  perk: string;
}

const LEVELS: Level[] = [
  { rank: 1, name: "Tanish", points: 0, perk: "Boshlang'ich holat" },
  { rank: 2, name: "Do'st", points: 300, perk: "+1 rang ochiladi" },
  { rank: 3, name: "Sirdosh", points: 800, perk: "Ovoz aksenti" },
  { rank: 4, name: "Hamroh", points: 1500, perk: "Maxsus ranglar" },
  { rank: 5, name: "Hamfikr", points: 3000, perk: "Animatsiya to'plami" },
  { rank: 6, name: "Yulduz", points: 6000, perk: "VIP nishonlar" },
];

// Streak milestones
interface Milestone {
  days: number;
  reward: string;
  bonus: number;
}

const MILESTONES: Milestone[] = [
  { days: 3, reward: "Kichik nishon", bonus: 10 },
  { days: 7, reward: "Haftalik bonus", bonus: 20 },
  { days: 14, reward: "Noyob aksessuar", bonus: 50 },
  { days: 30, reward: "Epik fon", bonus: 120 },
];

// Tamagochi metrics — config
interface TamagochiMetric {
  key: string;
  label: string;
  decayPerDay: number; // foiz / kun
  icon: LucideIcon;
  color: string;
}

const TAMAGOCHI_METRICS: TamagochiMetric[] = [
  { key: "energy", label: "Energy (Quvvat)", decayPerDay: 5, icon: Battery, color: "bg-serious" },
  { key: "learning", label: "Learning (Bilim)", decayPerDay: 3, icon: Brain, color: "bg-duyo-blue" },
  { key: "joy", label: "Joy (Quvonch)", decayPerDay: 6, icon: Smile, color: "bg-warn" },
  { key: "health", label: "Health (Salomatlik)", decayPerDay: 2, icon: Heart, color: "bg-safe" },
];

// ───────────────────────────────────────────────────────────────────────────

export function Gamification() {
  const [tab, setTab] = useState<TabKey>("avatar");
  const [selectedBody, setSelectedBody] = useState<string>("oddiy");
  const [search, setSearch] = useState<string>("");

  const { data: overview } = useQuery({
    queryKey: ["gamif-overview"],
    queryFn: () => adminApi.gamificationOverview(),
  });

  const filteredAccessories = ACCESSORIES.filter((a) =>
    a.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <div>
      <PageHeader
        title="Avatar va gamifikatsiya"
        subtitle="Avatar kutubxonasi, ball qoidalari, darajalar va tamagochi holati"
        actions={
          <button className="flex items-center gap-2 rounded-xl bg-duyo-blue px-3.5 py-2 text-sm font-semibold text-white hover:bg-duyo-dark">
            <PlusCircle size={16} /> Yangi model qo'shish
          </button>
        }
      />

      {/* KRITIK QOIDA — psixologik xavfsizlik bayrog'i */}
      <div className="mb-5 flex items-start gap-3 rounded-2xl border border-serious-line bg-serious-bg p-4">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-serious" />
        <div className="text-sm text-serious">
          <span className="font-semibold">Muhim ogohlantirish:</span> Aybdorlik yoki bosim
          mexanikasini yaratma. Gamifikatsiya bolani rag'batlantirishi kerak — jazolamasligi
          yoki majburlamasligi shart. Hech qachon streak yo'qolishini "yo'qotish" sifatida
          ko'rsatma.
        </div>
      </div>

      {/* KPI overview — real backend ma'lumotlari */}
      <OverviewStats data={overview} />

      {/* Tabs */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm font-medium",
                active
                  ? "border-duyo-blue bg-duyo-50 text-duyo-dark"
                  : "border-line text-muted hover:bg-bg",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "avatar" && (
        <AvatarPanel selectedBody={selectedBody} onSelectBody={setSelectedBody} />
      )}
      {tab === "inventory" && (
        <InventoryPanel
          accessories={filteredAccessories}
          search={search}
          onSearch={setSearch}
        />
      )}
      {tab === "points" && <PointsPanel />}
      {tab === "levels" && <LevelsPanel />}
      {tab === "streaks" && <StreaksPanel />}
      {tab === "tamagochi" && <TamagochiPanel />}
    </div>
  );
}

// ── Overview KPI stats (real backend) ────────────────────────────────────────

interface KpiCard {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
}

function formatNumber(n: number | undefined): string {
  if (n === undefined) return "…";
  return n.toLocaleString("en-US");
}

function OverviewStats({ data }: { data: GamificationOverview | undefined }) {
  const tamagochiAvg = data
    ? Math.round(
        (data.tamagochi_avg.energy +
          data.tamagochi_avg.joy +
          data.tamagochi_avg.learning +
          data.tamagochi_avg.health) /
          4,
      )
    : undefined;

  const cards: KpiCard[] = [
    {
      label: "Faol avatarlar",
      value: formatNumber(data?.avatars),
      hint: "Yaratilgan DUYO avatarlari",
      icon: Sparkles,
    },
    {
      label: "Inventar buyumlari",
      value: formatNumber(data?.inventory_items),
      hint: "Egallangan aksessuarlar",
      icon: Shirt,
    },
    {
      label: "Berilgan ballar",
      value: formatNumber(data?.balls_issued),
      hint: "Jami tarqatilgan ball",
      icon: Coins,
    },
    {
      label: "Eng uzun streak",
      value: data === undefined ? "…" : `${data.longest_streak} kun`,
      hint: "Rekord ketma-ketlik",
      icon: Flame,
    },
  ];

  const tamagochiMetrics: { label: string; value: number | undefined; icon: LucideIcon; color: string }[] = [
    { label: "Energy", value: data?.tamagochi_avg.energy, icon: Battery, color: "bg-serious" },
    { label: "Joy", value: data?.tamagochi_avg.joy, icon: Smile, color: "bg-warn" },
    { label: "Learning", value: data?.tamagochi_avg.learning, icon: Brain, color: "bg-duyo-blue" },
    { label: "Health", value: data?.tamagochi_avg.health, icon: Heart, color: "bg-safe" },
  ];

  const ballsByReason = data ? Object.entries(data.balls_by_reason) : [];
  const inventoryByCategory = data ? Object.entries(data.inventory_by_category) : [];

  return (
    <div className="mb-6 space-y-4">
      {/* KPI tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="card flex items-center gap-4 p-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-duyo-50 text-duyo-blue">
                <Icon size={20} />
              </span>
              <div>
                <div className="text-xl font-bold text-ink">{c.value}</div>
                <div className="text-sm font-medium text-ink">{c.label}</div>
                <div className="text-[11px] text-muted">{c.hint}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tamagochi o'rtacha + balls-by-reason + inventory-by-category */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Tamagochi average */}
        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Heart size={15} className="text-safe" /> Tamagochi o'rtacha
            </h3>
            <span className="pill bg-bg text-muted">
              {tamagochiAvg === undefined ? "…" : `${tamagochiAvg}%`}
            </span>
          </div>
          <div className="space-y-3">
            {tamagochiMetrics.map((m) => {
              const Icon = m.icon;
              const pct = m.value === undefined ? 0 : Math.round(m.value);
              return (
                <div key={m.label}>
                  <div className="mb-1 flex items-center justify-between text-[11px] text-muted">
                    <span className="flex items-center gap-1.5">
                      <Icon size={13} className="text-muted" /> {m.label}
                    </span>
                    <span className="font-semibold text-ink">
                      {m.value === undefined ? "…" : `${pct}%`}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-bg">
                    <div className={cn("h-full rounded-full", m.color)} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Balls by reason */}
        <div className="card p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
            <Coins size={15} className="text-duyo-blue" /> Ballar (sabab bo'yicha)
          </h3>
          {data === undefined ? (
            <div className="text-sm text-muted">…</div>
          ) : ballsByReason.length === 0 ? (
            <div className="text-sm text-muted">Ma'lumot yo'q</div>
          ) : (
            <div className="space-y-2">
              {ballsByReason.map(([reason, count]) => (
                <div key={reason} className="flex items-center justify-between text-sm">
                  <span className="text-muted">{reason}</span>
                  <span className="pill bg-safe-bg text-safe border border-safe-line">
                    {formatNumber(count)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Inventory by category */}
        <div className="card p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
            <Shirt size={15} className="text-duyo-blue" /> Inventar (kategoriya bo'yicha)
          </h3>
          {data === undefined ? (
            <div className="text-sm text-muted">…</div>
          ) : inventoryByCategory.length === 0 ? (
            <div className="text-sm text-muted">Ma'lumot yo'q</div>
          ) : (
            <div className="space-y-2">
              {inventoryByCategory.map(([category, count]) => (
                <div key={category} className="flex items-center justify-between text-sm">
                  <span className="text-muted">{category}</span>
                  <span className="pill bg-duyo-50 text-duyo-dark border border-duyo-100">
                    {formatNumber(count)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Avatar panel ─────────────────────────────────────────────────────────────

function AvatarPanel({
  selectedBody,
  onSelectBody,
}: {
  selectedBody: string;
  onSelectBody: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Body types + palettes */}
      <div className="space-y-6 lg:col-span-2">
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Sparkles size={16} className="text-duyo-blue" /> Tana ko'rinishlari (Body Types)
            </h2>
            <span className="pill bg-bg text-muted">3 ta faol variant</span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {BODY_TYPES.map((b) => {
              const active = selectedBody === b.id;
              return (
                <button
                  key={b.id}
                  onClick={() => onSelectBody(b.id)}
                  className={cn(
                    "flex flex-col items-center rounded-2xl border p-4 text-center transition",
                    active
                      ? "border-duyo-blue bg-duyo-50 ring-1 ring-duyo-blue"
                      : "border-line bg-surface hover:bg-bg",
                  )}
                >
                  <span className="mb-2 flex h-16 w-16 items-center justify-center rounded-2xl bg-bg text-3xl">
                    {b.emoji}
                  </span>
                  <span className="text-sm font-semibold text-ink">{b.name}</span>
                  <span className="mt-0.5 text-[11px] text-muted">{b.note}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Color swatches */}
        <div className="card p-5">
          <h2 className="mb-4 text-sm font-semibold text-ink">Tana ranglari</h2>
          <SwatchGrid items={BODY_COLORS} />

          <h3 className="mb-3 mt-6 text-sm font-semibold text-ink">Aksent ranglari</h3>
          <SwatchGrid items={ACCENT_COLORS} />
        </div>

        {/* Face expressions */}
        <div className="card p-5">
          <h2 className="mb-4 text-sm font-semibold text-ink">Yuz ifodalari</h2>
          <div className="flex flex-wrap gap-3">
            {EXPRESSIONS.map((e) => (
              <div
                key={e.name}
                className="flex flex-col items-center gap-1 rounded-2xl border border-line bg-surface px-4 py-3"
              >
                <span className="text-3xl">{e.emoji}</span>
                <span className="text-xs text-muted">{e.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Animations */}
      <div className="card h-fit p-5">
        <h2 className="mb-4 text-sm font-semibold text-ink">Animatsiyalar</h2>
        <div className="space-y-3">
          {ANIMATIONS.map((a) => {
            const Icon = a.icon;
            return (
              <div
                key={a.name}
                className="flex items-center gap-3 rounded-xl border border-line p-3"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-duyo-50 text-duyo-blue">
                  <Icon size={16} />
                </span>
                <div className="flex-1">
                  <div className="text-sm font-medium text-ink">{a.name}</div>
                  <div className="text-[11px] text-muted">{a.note}</div>
                </div>
                <CheckCircle2 size={16} className="text-safe" />
              </div>
            );
          })}
        </div>
        <div className="mt-4 rounded-xl border border-line bg-bg p-3 text-xs text-muted">
          O'rtacha kadr tezligi (FPS): <span className="font-semibold text-ink">24–60</span>
        </div>
      </div>
    </div>
  );
}

function SwatchGrid({ items }: { items: { name: string; hex: string }[] }) {
  return (
    <div className="flex flex-wrap gap-3">
      {items.map((c) => (
        <div key={c.name} className="flex flex-col items-center gap-1.5">
          <span
            className="h-12 w-12 rounded-2xl border border-line"
            style={{ backgroundColor: c.hex }}
          />
          <span className="text-[11px] text-muted">{c.name}</span>
        </div>
      ))}
    </div>
  );
}

// ── Inventory panel ──────────────────────────────────────────────────────────

function InventoryPanel({
  accessories,
  search,
  onSearch,
}: {
  accessories: Accessory[];
  search: string;
  onSearch: (v: string) => void;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Shirt size={16} className="text-duyo-blue" /> Inventar ro'yxati
        </h2>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5">
            <Search size={14} className="text-muted" />
            <input
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Qidirish..."
              className="w-32 bg-transparent text-sm text-ink outline-none placeholder:text-muted"
            />
          </div>
          <button className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-sm font-medium text-ink hover:border-duyo-blue hover:bg-duyo-50">
            <SlidersHorizontal size={14} /> Filtr
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-muted">
              <th className="px-5 py-3">Nomi</th>
              <th className="px-3 py-3">Kategoriya</th>
              <th className="px-3 py-3">Yosh oralig'i</th>
              <th className="px-3 py-3">Narxi</th>
              <th className="px-3 py-3">Rarity</th>
              <th className="px-3 py-3">Amallar</th>
            </tr>
          </thead>
          <tbody>
            {accessories.map((a) => {
              const Icon = a.icon;
              return (
                <tr key={a.id} className="border-b border-line/70 last:border-0">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-bg text-muted">
                        <Icon size={15} />
                      </span>
                      <span className="font-medium text-ink">{a.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-muted">{a.category}</td>
                  <td className="px-3 py-3 text-muted">{a.ageRange}</td>
                  <td className="px-3 py-3">
                    <span className="inline-flex items-center gap-1 font-semibold text-duyo-blue">
                      <Coins size={13} /> {a.price} pts
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span className={cn("pill", RARITY_STYLES[a.rarity])}>{a.rarity}</span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1.5">
                      <button className="rounded-lg border border-line p-1.5 text-muted hover:border-duyo-blue hover:text-duyo-blue">
                        <Pencil size={13} />
                      </button>
                      <button className="rounded-lg border border-line p-1.5 text-muted hover:border-urgent-line hover:text-urgent">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {accessories.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-sm text-muted">
                  Hech narsa topilmadi.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Points panel ─────────────────────────────────────────────────────────────

function PointsPanel() {
  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Coins size={16} className="text-duyo-blue" /> Ballarni hisoblash qoidalari
        </h2>
        <button className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-sm font-medium text-ink hover:border-duyo-blue hover:bg-duyo-50">
          <Pencil size={14} /> Qoidalarni boshqarish
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {POINT_RULES.map((r) => {
          const Icon = r.icon;
          return (
            <div
              key={r.action}
              className="flex items-center gap-3 rounded-xl border border-line p-3"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-duyo-50 text-duyo-blue">
                <Icon size={16} />
              </span>
              <div className="flex-1">
                <div className="text-sm font-medium text-ink">{r.action}</div>
                <div className="text-[11px] text-muted">{r.note}</div>
              </div>
              <span className="pill bg-safe-bg text-safe border border-safe-line">
                +{r.points} pts
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Levels panel ─────────────────────────────────────────────────────────────

function LevelsPanel() {
  return (
    <div className="card p-5">
      <h2 className="mb-5 flex items-center gap-2 text-sm font-semibold text-ink">
        <Trophy size={16} className="text-duyo-blue" /> Darajalar ierarxiyasi
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {LEVELS.map((l) => {
          const top = l.rank === LEVELS.length;
          return (
            <div
              key={l.rank}
              className={cn(
                "relative flex flex-col items-center rounded-2xl border p-4 text-center",
                top ? "border-duyo-blue bg-duyo-50" : "border-line bg-surface",
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold",
                  top ? "bg-duyo-blue text-white" : "bg-bg text-muted",
                )}
              >
                {l.rank}
              </span>
              <span className="mt-2 text-sm font-semibold text-ink">{l.name}</span>
              <span className="mt-0.5 text-[11px] text-muted">{l.points} ball</span>
              <span className="mt-2 text-[11px] text-duyo-dark">{l.perk}</span>
              {top && (
                <Sparkles
                  size={14}
                  className="absolute right-2 top-2 text-duyo-blue"
                />
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-muted">
        Daraja pasaymaydi — bolaning yutuqlari hech qachon olib qo'yilmaydi.
      </p>
    </div>
  );
}

// ── Streaks panel ────────────────────────────────────────────────────────────

function StreaksPanel() {
  return (
    <div className="card p-5">
      <h2 className="mb-5 flex items-center gap-2 text-sm font-semibold text-ink">
        <Flame size={16} className="text-serious" /> Streak bosqichlari
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {MILESTONES.map((m) => (
          <div
            key={m.days}
            className="flex flex-col rounded-2xl border border-line bg-surface p-4"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-serious-bg text-serious">
                <Flame size={18} />
              </span>
              <div>
                <div className="text-lg font-bold text-ink">{m.days} kun</div>
                <div className="text-[11px] text-muted">ketma-ket faollik</div>
              </div>
            </div>
            <div className="mt-3 border-t border-line pt-3 text-sm text-ink">
              {m.reward}
            </div>
            <span className="mt-2 self-start pill bg-safe-bg text-safe border border-safe-line">
              +{m.bonus} bonus
            </span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-start gap-2 rounded-xl border border-line bg-bg p-3 text-xs text-muted">
        <Heart size={14} className="mt-0.5 shrink-0 text-safe" />
        Streak uzilsa — bola "muvaffaqiyatsiz" deb belgilanmaydi. Faqat yangi boshlash
        taklif qilinadi, salbiy til ishlatilmaydi.
      </div>
    </div>
  );
}

// ── Tamagochi panel ──────────────────────────────────────────────────────────

function TamagochiPanel() {
  return (
    <div className="card p-5">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-ink">
        <Heart size={16} className="text-safe" /> Tamagochi holati konfiguratsiyasi
      </h2>
      <p className="mb-5 text-xs text-muted">
        Har bir metrika kuniga sekin pasayadi — faollik orqali tiklanadi. Pasayish
        bolani tashvishga solmaydigan darajada yumshoq bo'lishi shart.
      </p>
      <div className="space-y-5">
        {TAMAGOCHI_METRICS.map((m) => {
          const Icon = m.icon;
          // Boshlang'ich namuna holat (mock)
          const startValue = 100 - m.decayPerDay * 3;
          return (
            <div key={m.key}>
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-medium text-ink">
                  <Icon size={15} className="text-muted" /> {m.label}
                </span>
                <span className="text-xs text-muted">
                  pasayish:{" "}
                  <span className="font-semibold text-ink">−{m.decayPerDay}% / kun</span>
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-bg">
                <div
                  className={cn("h-full rounded-full", m.color)}
                  style={{ width: `${startValue}%` }}
                />
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-muted">
                <span>Joriy: {startValue}%</span>
                <input
                  type="range"
                  min={1}
                  max={10}
                  defaultValue={m.decayPerDay}
                  className="w-32 accent-duyo-blue"
                  aria-label={`${m.label} pasayish tezligi`}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-5 flex items-center justify-end gap-2">
        <button className="rounded-xl border border-line px-3.5 py-2 text-sm font-medium text-ink hover:bg-bg">
          Bekor qilish
        </button>
        <button className="flex items-center gap-2 rounded-xl bg-duyo-blue px-3.5 py-2 text-sm font-semibold text-white hover:bg-duyo-dark">
          <CheckCircle2 size={16} /> O'zgarishlarni saqlash
        </button>
      </div>
    </div>
  );
}
