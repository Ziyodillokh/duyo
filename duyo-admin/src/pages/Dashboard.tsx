import {
  Users,
  UserCog,
  MessageSquare,
  Mic,
  ShieldAlert,
  FileCheck2,
  CreditCard,
  DollarSign,
  Activity,
  Database,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

// MOCK data — backend ulanmaguncha namuna ko'rsatkichlar.
const KPIS: { label: string; value: string; icon: LucideIcon; hint?: string }[] = [
  { label: "Bugun faol bolalar", value: "1,284", icon: Users, hint: "+8% kechaga nisbatan" },
  { label: "Bugun faol ota-onalar", value: "412", icon: UserCog },
  { label: "AI xabarlar (bugun)", value: "18,930", icon: MessageSquare },
  { label: "Voice so'rovlar (bugun)", value: "3,021", icon: Mic },
  { label: "Kutilayotgan safety review", value: "7", icon: ShieldAlert, hint: "2 ta RED" },
  { label: "Kutilayotgan kontent tasdiqlash", value: "12", icon: FileCheck2 },
  { label: "To'lov xatolari", value: "5", icon: CreditCard },
  { label: "AI cost (bugun)", value: "$42.10", icon: DollarSign, hint: "STT/TTS p95: 820ms" },
];

const CRISIS = [
  { level: "RED", label: "Shoshilinch", count: 2, cls: "bg-urgent-bg text-urgent border-urgent-line" },
  { level: "ORANGE", label: "Jiddiy", count: 4, cls: "bg-serious-bg text-serious border-serious-line" },
  { level: "YELLOW", label: "Ogohlantirish", count: 9, cls: "bg-warn-bg text-warn border-warn-line" },
];

const SERVICES = [
  { name: "API", status: "Sog'lom", ok: true, icon: Activity },
  { name: "Ma'lumotlar bazasi", status: "Sog'lom", ok: true, icon: Database },
  { name: "Crisis Detection", status: "Sog'lom", ok: true, icon: ShieldCheck },
];

const QUICK = [
  "RED hodisalarni ko'rish",
  "Kontentni tasdiqlash",
  "Xato to'lovlar",
  "RAG test",
];

export function Dashboard() {
  return (
    <div>
      <PageHeader
        title="Boshqaruv paneli"
        subtitle="Operatsiyalar bo'yicha umumiy holat — real vaqtli ko'rsatkichlar"
      />

      {/* Crisis summary — eng yuqori ko'rinish */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {CRISIS.map((c) => (
          <div key={c.level} className={`card flex items-center justify-between border p-4 ${c.cls}`}>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide">{c.level}</div>
              <div className="text-sm opacity-80">{c.label} crisis</div>
            </div>
            <div className="text-3xl font-bold">{c.count}</div>
          </div>
        ))}
      </div>

      {/* KPI grid */}
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
              {k.hint && <div className="mt-1 text-[11px] text-muted">{k.hint}</div>}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Service health */}
        <div className="card p-5 lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-ink">Tizim holati</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {SERVICES.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.name} className="flex items-center gap-3 rounded-xl border border-line p-3">
                  <Icon size={18} className="text-muted" />
                  <div>
                    <div className="text-sm font-medium text-ink">{s.name}</div>
                    <div className="flex items-center gap-1.5 text-xs text-safe">
                      <span className="h-1.5 w-1.5 rounded-full bg-safe" /> {s.status}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick actions */}
        <div className="card p-5">
          <h2 className="mb-4 text-sm font-semibold text-ink">Tezkor amallar</h2>
          <div className="space-y-2">
            {QUICK.map((q) => (
              <button
                key={q}
                className="flex w-full items-center justify-between rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-ink hover:border-duyo-blue hover:bg-duyo-50"
              >
                {q}
                <ArrowRight size={16} className="text-muted" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
