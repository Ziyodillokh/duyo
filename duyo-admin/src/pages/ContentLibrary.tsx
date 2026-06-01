import { useMemo, useState } from "react";
import {
  Plus,
  Eye,
  Pencil,
  Trash2,
  Star,
  AlertTriangle,
  Check,
  X,
  Upload,
  CloudOff,
  FileCheck2,
  ScrollText,
  BookOpen,
  GraduationCap,
  Headphones,
  Flag,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { cn } from "@/lib/utils";

/* ──────────────────────────────────────────────────────────────────────────
   Domain types — backend (Content) ulanmaguncha MOCK ma'lumotlar ishlatiladi.
   ──────────────────────────────────────────────────────────────────────── */

type ContentType = "poem" | "story" | "lesson" | "audio";
type AgeSegment = "4-6" | "7-9" | "10-12";
type Language = "uz" | "ru" | "en";
type AudioStatus = "generated" | "processing" | "missing";
type ApprovalStatus = "approved" | "pending" | "rejected";
type PublishStatus = "published" | "unpublished";

interface ContentItem {
  id: string;
  title: string;
  subtitle: string;
  type: ContentType;
  age: AgeSegment;
  language: Language;
  audio: AudioStatus;
  license: ApprovalStatus;
  review: ApprovalStatus;
  publish: PublishStatus;
  rating: number | null;
  reads: string;
  completions: number;
  likes: number;
  reports: number;
  engagement: number; // 0..1 — completion / open nisbati
}

interface ContentTab {
  key: ContentType;
  label: string;
  icon: LucideIcon;
}

/* ── Status pill ko'rinishlari (design tokenlar bilan) ───────────────────── */

const APPROVAL_PILL: Record<ApprovalStatus, { label: string; cls: string }> = {
  approved: { label: "Tasdiqlangan", cls: "bg-safe-bg text-safe border border-safe-line" },
  pending: { label: "Kutilmoqda", cls: "bg-warn-bg text-warn border border-warn-line" },
  rejected: { label: "Rad etilgan", cls: "bg-urgent-bg text-urgent border border-urgent-line" },
};

const AUDIO_PILL: Record<AudioStatus, { label: string; cls: string }> = {
  generated: { label: "Tayyor", cls: "bg-safe-bg text-safe border border-safe-line" },
  processing: { label: "Ishlanmoqda", cls: "bg-warn-bg text-warn border border-warn-line" },
  missing: { label: "Yo'q", cls: "bg-bg text-muted border border-line" },
};

const PUBLISH_PILL: Record<PublishStatus, { label: string; cls: string }> = {
  published: { label: "Nashr etilgan", cls: "bg-duyo-50 text-duyo-dark border border-duyo-100" },
  unpublished: { label: "Nashr etilmagan", cls: "bg-bg text-muted border border-line" },
};

const TYPE_LABEL: Record<ContentType, string> = {
  poem: "She'r",
  story: "Ertak",
  lesson: "Dars",
  audio: "Audio",
};

const LANGUAGE_LABEL: Record<Language, string> = { uz: "O'z", ru: "Ru", en: "En" };

const CONTENT_TABS: ContentTab[] = [
  { key: "poem", label: "She'rlar", icon: ScrollText },
  { key: "story", label: "Ertaklar", icon: BookOpen },
  { key: "lesson", label: "Darslar", icon: GraduationCap },
  { key: "audio", label: "Audio", icon: Headphones },
];

/* ── MOCK kontent — namuna kutubxona ─────────────────────────────────────── */

const CONTENT: ContentItem[] = [
  { id: "c-2041", title: "Zukko Alisher", subtitle: "Adabiyot", type: "story", age: "7-9", language: "uz", audio: "generated", license: "approved", review: "approved", publish: "published", rating: 4.8, reads: "1.2k", completions: 1184, likes: 320, reports: 0, engagement: 0.91 },
  { id: "c-2039", title: "Oltin baliqcha", subtitle: "Ma'naviyat", type: "story", age: "10-12", language: "uz", audio: "missing", license: "pending", review: "pending", publish: "unpublished", rating: null, reads: "—", completions: 0, likes: 0, reports: 0, engagement: 0 },
  { id: "c-2036", title: "Bahor keldi", subtitle: "Tabiat", type: "poem", age: "4-6", language: "uz", audio: "generated", license: "approved", review: "approved", publish: "published", rating: 4.6, reads: "880", completions: 742, likes: 198, reports: 1, engagement: 0.84 },
  { id: "c-2034", title: "Vatan haqida", subtitle: "Vatanparvarlik", type: "poem", age: "7-9", language: "uz", audio: "processing", license: "approved", review: "pending", publish: "unpublished", rating: null, reads: "—", completions: 0, likes: 0, reports: 0, engagement: 0 },
  { id: "c-2031", title: "Sonlar bilan tanishuv", subtitle: "Matematika 1-bosqich", type: "lesson", age: "4-6", language: "uz", audio: "generated", license: "approved", review: "approved", publish: "published", rating: 4.4, reads: "2.1k", completions: 1890, likes: 410, reports: 2, engagement: 0.78 },
  { id: "c-2028", title: "Hayvonlar dunyosi", subtitle: "Tabiatshunoslik", type: "lesson", age: "7-9", language: "ru", audio: "generated", license: "approved", review: "approved", publish: "unpublished", rating: 4.2, reads: "640", completions: 510, likes: 130, reports: 4, engagement: 0.71 },
  { id: "c-2025", title: "Kechki ertak — Uyqu vaqti", subtitle: "Audio to'plam", type: "audio", age: "4-6", language: "uz", audio: "generated", license: "rejected", review: "approved", publish: "unpublished", rating: null, reads: "—", completions: 0, likes: 0, reports: 0, engagement: 0 },
  { id: "c-2022", title: "Dono tulki", subtitle: "Ertak audio", type: "audio", age: "7-9", language: "en", audio: "generated", license: "approved", review: "approved", publish: "published", rating: 4.9, reads: "3.0k", completions: 2780, likes: 690, reports: 0, engagement: 0.93 },
];

/* ── Sifat metrikalari (header kartalar) ─────────────────────────────────── */

interface MetricCard {
  label: string;
  value: string;
  hint?: string;
  alert?: boolean;
  icon?: LucideIcon;
}

const METRICS: MetricCard[] = [
  { label: "Tugallanish darajasi", value: "84%", hint: "O'rtacha engagement" },
  { label: "Yoqtirishlar", value: "12.5k", hint: "Jami like" },
  { label: "Shikoyatlar", value: "2", hint: "Ko'rib chiqish kerak", alert: true, icon: Flag },
  { label: "O'rtacha reyting", value: "4.7", hint: "Bolalar bahosi" },
  { label: "Faol kontent", value: "142", hint: "Nashr etilgan" },
];

const PAGE_SIZE = 10;
const TOTAL_ITEMS = 142;
const REVIEW_QUEUE_COUNT = 12;

/* ──────────────────────────────────────────────────────────────────────────
   KRITIK QOIDA: kontent FAQAT license=approved VA review=approved bo'lsa
   nashr etiladi. Quyidagi yagona funksiya UI bo'ylab shu darvozani majburlaydi.
   ──────────────────────────────────────────────────────────────────────── */

function canPublish(item: ContentItem): boolean {
  return item.license === "approved" && item.review === "approved";
}

function publishBlockReason(item: ContentItem): string {
  const reasons: string[] = [];
  if (item.license !== "approved") reasons.push("litsenziya tasdiqlanmagan");
  if (item.review !== "approved") reasons.push("tekshiruv tasdiqlanmagan");
  return reasons.join(" va ");
}

/* ── Kichik UI yordamchilar ──────────────────────────────────────────────── */

function StatusPill({ label, cls }: { label: string; cls: string }) {
  return <span className={cn("pill", cls)}>{label}</span>;
}

function IconAction({
  icon: Icon,
  label,
  tone = "neutral",
  disabled = false,
  title,
}: {
  icon: LucideIcon;
  label: string;
  tone?: "neutral" | "danger";
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title ?? label}
      aria-label={label}
      className={cn(
        "rounded-lg border p-1.5 transition-colors",
        disabled
          ? "cursor-not-allowed border-line text-line"
          : tone === "danger"
            ? "border-line text-muted hover:border-urgent-line hover:bg-urgent-bg hover:text-urgent"
            : "border-line text-muted hover:border-duyo-blue hover:bg-duyo-50 hover:text-duyo-dark",
      )}
    >
      <Icon size={14} />
    </button>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   View — uchta rejim: kontent jadvali / review queue / licensing
   ──────────────────────────────────────────────────────────────────────── */

type ViewMode = ContentType | "review" | "licensing";

export function ContentLibrary() {
  const [view, setView] = useState<ViewMode>("story");
  const [page] = useState(1);

  const isContentView = view !== "review" && view !== "licensing";

  const rows = useMemo(
    () => (isContentView ? CONTENT.filter((c) => c.type === view) : []),
    [view, isContentView],
  );

  const reviewItems = useMemo(
    () => CONTENT.filter((c) => c.review === "pending" || c.review === "rejected"),
    [],
  );

  const licenseItems = useMemo(
    () => CONTENT.filter((c) => c.license !== "approved"),
    [],
  );

  return (
    <div>
      <PageHeader
        title="Kontent kutubxonasi"
        subtitle="She'rlar, ertaklar, darslar va audio — tekshiruv, litsenziya va nashr boshqaruvi"
        actions={
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-xl bg-duyo-blue px-3.5 py-2 text-sm font-semibold text-white hover:bg-duyo-dark"
          >
            <Plus size={16} /> Yangi qo'shish
          </button>
        }
      />

      {/* KRITIK darvoza banneri — har doim ko'rinadi */}
      <div className="mb-5 flex items-start gap-3 rounded-2xl border border-urgent-line bg-urgent-bg p-4">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-urgent" />
        <div className="text-sm text-urgent">
          <span className="font-semibold">Nashr darvozasi:</span> Kontent FAQAT litsenziya holati{" "}
          <span className="font-semibold">Tasdiqlangan</span> VA tekshiruv holati{" "}
          <span className="font-semibold">Tasdiqlangan</span> bo'lganda nashr etiladi. Aks holda
          "Nashr etish" tugmasi o'chiriladi.
        </div>
      </div>

      {/* Sifat metrikalari */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {METRICS.map((m) => {
          const Icon = m.icon;
          return (
            <div
              key={m.label}
              className={cn(
                "card p-4",
                m.alert && "border-urgent-line bg-urgent-bg",
              )}
            >
              <div className="flex items-center justify-between">
                <span className={cn("text-xs font-medium", m.alert ? "text-urgent" : "text-muted")}>
                  {m.label}
                </span>
                {Icon && <Icon size={14} className={m.alert ? "text-urgent" : "text-muted"} />}
              </div>
              <div className={cn("mt-2 text-2xl font-bold", m.alert ? "text-urgent" : "text-ink")}>
                {m.value}
              </div>
              {m.hint && (
                <div className={cn("mt-1 text-[11px]", m.alert ? "text-urgent/80" : "text-muted")}>
                  {m.hint}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-1 border-b border-line px-3 pt-2">
          {CONTENT_TABS.map((t) => {
            const Icon = t.icon;
            const active = view === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setView(t.key)}
                className={cn(
                  "flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium",
                  active
                    ? "border-duyo-blue text-duyo-dark"
                    : "border-transparent text-muted hover:text-ink",
                )}
              >
                <Icon size={15} /> {t.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setView("review")}
            className={cn(
              "flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium",
              view === "review"
                ? "border-duyo-blue text-duyo-dark"
                : "border-transparent text-muted hover:text-ink",
            )}
          >
            Tekshiruv navbati
            <span className="pill bg-warn-bg text-warn border border-warn-line">
              {REVIEW_QUEUE_COUNT}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setView("licensing")}
            className={cn(
              "flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium",
              view === "licensing"
                ? "border-duyo-blue text-duyo-dark"
                : "border-transparent text-muted hover:text-ink",
            )}
          >
            Litsenziya
          </button>
        </div>

        {isContentView && <ContentTable rows={rows} page={page} />}
        {view === "review" && <ReviewQueue items={reviewItems} />}
        {view === "licensing" && <LicensingTable items={licenseItems} />}
      </div>
    </div>
  );
}

/* ── Kontent jadvali ─────────────────────────────────────────────────────── */

function ContentTable({ rows, page }: { rows: ContentItem[]; page: number }) {
  return (
    <>
      {/* Filtrlar */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <FilterPill label="Hamma tillar" />
        <FilterPill label="Yosh toifasi" />
        <FilterPill label="Audio holati" />
        <span className="ml-auto text-xs text-muted">{rows.length} ta natija (joriy turda)</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-muted">
              <th className="px-4 py-3">Sarlavha</th>
              <th className="px-3 py-3">Tur</th>
              <th className="px-3 py-3">Yosh</th>
              <th className="px-3 py-3">Til</th>
              <th className="px-3 py-3">Audio</th>
              <th className="px-3 py-3">Litsenziya</th>
              <th className="px-3 py-3">Tekshiruv</th>
              <th className="px-3 py-3">Nashr</th>
              <th className="px-3 py-3">Reyting</th>
              <th className="px-3 py-3 text-right">Amallar</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-sm text-muted">
                  Bu turda kontent topilmadi.
                </td>
              </tr>
            ) : (
              rows.map((c) => <ContentRow key={c.id} item={c} />)
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} count={rows.length} />
    </>
  );
}

function ContentRow({ item }: { item: ContentItem }) {
  const publishable = canPublish(item);
  const isPublished = item.publish === "published";

  return (
    <tr className="border-b border-line/70 last:border-0 hover:bg-bg/60">
      <td className="px-4 py-3">
        <div className="font-medium text-ink">{item.title}</div>
        <div className="text-xs text-muted">{item.subtitle}</div>
      </td>
      <td className="px-3 py-3 text-muted">{TYPE_LABEL[item.type]}</td>
      <td className="px-3 py-3 text-muted">{item.age}</td>
      <td className="px-3 py-3 text-muted">{LANGUAGE_LABEL[item.language]}</td>
      <td className="px-3 py-3">
        <StatusPill {...AUDIO_PILL[item.audio]} />
      </td>
      <td className="px-3 py-3">
        <StatusPill {...APPROVAL_PILL[item.license]} />
      </td>
      <td className="px-3 py-3">
        <StatusPill {...APPROVAL_PILL[item.review]} />
      </td>
      <td className="px-3 py-3">
        <StatusPill {...PUBLISH_PILL[item.publish]} />
      </td>
      <td className="px-3 py-3">
        {item.rating !== null ? (
          <div className="flex items-center gap-1 text-ink">
            <Star size={13} className="fill-warn text-warn" />
            <span className="font-medium">{item.rating.toFixed(1)}</span>
            <span className="text-xs text-muted">({item.reads})</span>
          </div>
        ) : (
          <span className="text-muted">—</span>
        )}
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center justify-end gap-1.5">
          <IconAction icon={Eye} label="Ko'rib chiqish" />
          <IconAction icon={Pencil} label="Tahrirlash" />
          {isPublished ? (
            <IconAction icon={CloudOff} label="Nashrdan olish" tone="danger" />
          ) : (
            <IconAction
              icon={Upload}
              label="Nashr etish"
              disabled={!publishable}
              title={
                publishable
                  ? "Nashr etish"
                  : `Nashr etib bo'lmaydi: ${publishBlockReason(item)}`
              }
            />
          )}
          <IconAction icon={Trash2} label="O'chirish" tone="danger" />
        </div>
      </td>
    </tr>
  );
}

/* ── Tekshiruv navbati (approve / reject amallari bilan) ─────────────────── */

function ReviewQueue({ items }: { items: ContentItem[] }) {
  return (
    <>
      <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted">
        <FileCheck2 size={15} className="text-duyo-blue" />
        Inson tomonidan tekshirilishi kerak bo'lgan kontent
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-muted">
              <th className="px-4 py-3">Sarlavha</th>
              <th className="px-3 py-3">Tur</th>
              <th className="px-3 py-3">Yosh / Til</th>
              <th className="px-3 py-3">Tekshiruv</th>
              <th className="px-3 py-3 text-right">Amallar</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-b border-line/70 last:border-0 hover:bg-bg/60">
                <td className="px-4 py-3">
                  <div className="font-medium text-ink">{c.title}</div>
                  <div className="text-xs text-muted">{c.subtitle}</div>
                </td>
                <td className="px-3 py-3 text-muted">{TYPE_LABEL[c.type]}</td>
                <td className="px-3 py-3 text-muted">
                  {c.age} / {LANGUAGE_LABEL[c.language]}
                </td>
                <td className="px-3 py-3">
                  <StatusPill {...APPROVAL_PILL[c.review]} />
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      className="flex items-center gap-1 rounded-lg border border-safe-line bg-safe-bg px-2.5 py-1 text-xs font-medium text-safe hover:bg-safe/10"
                    >
                      <Check size={13} /> Tasdiqlash
                    </button>
                    <button
                      type="button"
                      className="flex items-center gap-1 rounded-lg border border-urgent-line bg-urgent-bg px-2.5 py-1 text-xs font-medium text-urgent hover:bg-urgent/10"
                    >
                      <X size={13} /> Rad etish
                    </button>
                    <IconAction icon={Eye} label="Ko'rib chiqish" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ── Litsenziya boshqaruvi ───────────────────────────────────────────────── */

function LicensingTable({ items }: { items: ContentItem[] }) {
  return (
    <>
      <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted">
        <ScrollText size={15} className="text-duyo-blue" />
        Litsenziya tasdiqlanmagan kontent — nashr darvozasini ochish uchun zarur
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-muted">
              <th className="px-4 py-3">Sarlavha</th>
              <th className="px-3 py-3">Tur</th>
              <th className="px-3 py-3">Litsenziya holati</th>
              <th className="px-3 py-3">Tekshiruv holati</th>
              <th className="px-3 py-3">Nashrga tayyor</th>
              <th className="px-3 py-3 text-right">Amallar</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => {
              const ready = canPublish(c);
              return (
                <tr key={c.id} className="border-b border-line/70 last:border-0 hover:bg-bg/60">
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink">{c.title}</div>
                    <div className="text-xs text-muted">{c.subtitle}</div>
                  </td>
                  <td className="px-3 py-3 text-muted">{TYPE_LABEL[c.type]}</td>
                  <td className="px-3 py-3">
                    <StatusPill {...APPROVAL_PILL[c.license]} />
                  </td>
                  <td className="px-3 py-3">
                    <StatusPill {...APPROVAL_PILL[c.review]} />
                  </td>
                  <td className="px-3 py-3">
                    {ready ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-safe">
                        <Check size={13} /> Tayyor
                      </span>
                    ) : (
                      <span className="text-xs text-muted">{publishBlockReason(c)}</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        className="flex items-center gap-1 rounded-lg border border-safe-line bg-safe-bg px-2.5 py-1 text-xs font-medium text-safe hover:bg-safe/10"
                      >
                        <Check size={13} /> Litsenziyani tasdiqlash
                      </button>
                      <IconAction icon={Eye} label="Hujjatni ko'rish" />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ── Kichik bo'laklar ────────────────────────────────────────────────────── */

function FilterPill({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="rounded-xl border border-line px-3 py-1.5 text-sm font-medium text-muted hover:border-duyo-blue hover:bg-duyo-50 hover:text-duyo-dark"
    >
      {label}
    </button>
  );
}

function Pagination({ page, count }: { page: number; count: number }) {
  const from = count === 0 ? 0 : 1;
  const to = Math.min(PAGE_SIZE, count);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
      <span className="text-xs text-muted">
        Ko'rsatilmoqda {from}-{to} (jami {TOTAL_ITEMS} ta kontentdan)
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled
          className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-line"
        >
          Oldingi
        </button>
        <button
          type="button"
          className="rounded-lg border border-duyo-blue bg-duyo-blue px-3 py-1.5 text-sm font-medium text-white"
        >
          {page}
        </button>
        <button
          type="button"
          className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-muted hover:border-duyo-blue hover:bg-duyo-50"
        >
          {page + 1}
        </button>
        <button
          type="button"
          className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink hover:border-duyo-blue hover:bg-duyo-50"
        >
          Keyingi
        </button>
      </div>
    </div>
  );
}
