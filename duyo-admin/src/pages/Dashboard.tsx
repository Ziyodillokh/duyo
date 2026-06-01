import { useQuery } from "@tanstack/react-query";
import {
  Users,
  UserCog,
  MessageSquare,
  Mic,
  ShieldAlert,
  FileCheck2,
  CreditCard,
  Database,
  Activity,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { adminApi } from "@/api/admin";

const SERVICES = [
  { name: "API", status: "Sog'lom", icon: Activity },
  { name: "Ma'lumotlar bazasi", status: "Sog'lom", icon: Database },
  { name: "Crisis Detection", status: "Sog'lom", icon: ShieldCheck },
];

const QUICK = ["RED hodisalarni ko'rish", "Kontentni tasdiqlash", "Xato to'lovlar", "RAG test"];

const nf = new Intl.NumberFormat("uz");

export function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => adminApi.dashboardSummary(),
  });

  const val = (n: number | undefined) => (isLoading || n === undefined ? "…" : nf.format(n));
  const crisis = data?.crisis ?? {};

  const crisisCards = [
    { level: "RED", label: "Shoshilinch", count: crisis.RED, cls: "bg-urgent-bg text-urgent border-urgent-line" },
    { level: "ORANGE", label: "Jiddiy", count: crisis.ORANGE, cls: "bg-serious-bg text-serious border-serious-line" },
    { level: "YELLOW", label: "Ogohlantirish", count: crisis.YELLOW, cls: "bg-warn-bg text-warn border-warn-line" },
  ];

  // real = backenddan; mock = backend hali yo'q (namuna).
  const kpis: { label: string; value: string; icon: LucideIcon; real: boolean }[] = [
    { label: "Bolalar (jami)", value: val(data?.children), icon: Users, real: true },
    { label: "Ota-onalar (jami)", value: val(data?.parents), icon: UserCog, real: true },
    { label: "AI xabarlar (jami)", value: val(data?.messages_total), icon: MessageSquare, real: true },
    { label: "RAG chunklar", value: val(data?.textbook_chunks), icon: Database, real: true },
    { label: "Voice so'rovlar (bugun)", value: "3,021", icon: Mic, real: false },
    { label: "Kutilayotgan safety review", value: "—", icon: ShieldAlert, real: false },
    { label: "To'lov xatolari", value: "—", icon: CreditCard, real: false },
    { label: "Kutilayotgan kontent", value: "—", icon: FileCheck2, real: false },
  ];

  return (
    <div>
      <PageHeader
        title="Boshqaruv paneli"
        subtitle="Operatsiyalar bo'yicha umumiy holat — real vaqtli ko'rsatkichlar"
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {crisisCards.map((c) => (
          <div key={c.level} className={`card flex items-center justify-between border p-4 ${c.cls}`}>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide">{c.level}</div>
              <div className="text-sm opacity-80">{c.label} crisis</div>
            </div>
            <div className="text-3xl font-bold">{val(c.count)}</div>
          </div>
        ))}
      </div>

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
              <div className="mt-1 text-[11px] text-muted">{k.real ? "Jonli" : "namuna"}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
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
