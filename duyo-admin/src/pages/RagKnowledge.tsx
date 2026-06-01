import { useState } from "react";
import {
  UploadCloud,
  Filter,
  Download,
  Pencil,
  Eye,
  CheckCircle2,
  Check,
  RefreshCw,
  Share2,
  Image as ImageIcon,
  Rocket,
  Smile,
  AlertTriangle,
  ShieldAlert,
  FileText,
  ListTree,
  SquarePen,
  Search,
  X,
  CheckCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { cn } from "@/lib/utils";

/**
 * RAG bilim bazasi — darslik hujjatlarini yuklash, parsing/embedding pipeline'ini
 * kuzatish, chunk'larni ko'rib chiqish va retrieval test qilish ekrani.
 *
 * MOCK ma'lumotlar — real backend (textbook_chunks jadvali) ulanmaguncha namuna.
 * Real jadval ustunlari bilan moslangan: subject, grade, language, publisher,
 * license_status, parse_status, chunk_count, approved_chunks, quality_score,
 * content_type, topic, difficulty, citation, review_status.
 */

// ----- Pipeline stepper -----

type StepState = "done" | "active" | "pending";

interface PipelineStep {
  key: string;
  label: string;
  icon: LucideIcon;
  state: StepState;
}

const PIPELINE_STEPS: PipelineStep[] = [
  { key: "uploaded", label: "Yuklangan", icon: UploadCloud, state: "done" },
  { key: "parsing", label: "Parsing", icon: FileText, state: "done" },
  { key: "ocr", label: "OCR", icon: ImageIcon, state: "done" },
  { key: "chunking", label: "Chunking", icon: RefreshCw, state: "active" },
  { key: "classification", label: "Metadata", icon: Smile, state: "pending" },
  { key: "embedding", label: "Embedding", icon: Share2, state: "pending" },
  { key: "review", label: "Review", icon: ImageIcon, state: "pending" },
  { key: "published", label: "Nashr etildi", icon: Rocket, state: "pending" },
];

// ----- License / parse status -----

type LicenseStatus = "approved" | "pending" | "rejected";
type ParseStatus = "completed" | "processing" | "failed" | "queued";

const LICENSE_STYLES: Record<LicenseStatus, { label: string; pill: string }> = {
  approved: { label: "APPROVED", pill: "bg-safe-bg text-safe border border-safe-line" },
  pending: { label: "PENDING", pill: "bg-warn-bg text-warn border border-warn-line" },
  rejected: { label: "REJECTED", pill: "bg-urgent-bg text-urgent border border-urgent-line" },
};

const PARSE_STYLES: Record<ParseStatus, { label: string; pill: string }> = {
  completed: { label: "COMPLETED", pill: "bg-duyo-50 text-duyo-dark border border-duyo-100" },
  processing: { label: "PROCESSING", pill: "bg-duyo-50 text-duyo-blue border border-duyo-100" },
  failed: { label: "FAILED", pill: "bg-urgent-bg text-urgent border border-urgent-line" },
  queued: { label: "QUEUED", pill: "bg-bg text-muted border border-line" },
};

// ----- Documents (textbook_chunks manbasi) -----

interface RagDocument {
  id: string;
  title: string;
  size: string;
  pages: number;
  subject: string;
  grade: number;
  language: string;
  publisher: string;
  year: number;
  license: LicenseStatus;
  parse: ParseStatus;
  chunks: number;
  approvedChunks: number;
  quality: number;
}

const DOCUMENTS: RagDocument[] = [
  {
    id: "doc-alg-9",
    title: "Algebra 9-sinf darslik",
    size: "42.5 MB",
    pages: 256,
    subject: "Matematika",
    grade: 9,
    language: "Uz",
    publisher: "O'qituvchi",
    year: 2022,
    license: "approved",
    parse: "completed",
    chunks: 1240,
    approvedChunks: 1240,
    quality: 94,
  },
  {
    id: "doc-phys-11",
    title: "Fizika 11-sinf",
    size: "18.2 MB",
    pages: 180,
    subject: "Fizika",
    grade: 11,
    language: "Ru",
    publisher: "Zamin",
    year: 2023,
    license: "pending",
    parse: "processing",
    chunks: 890,
    approvedChunks: 450,
    quality: 60,
  },
  {
    id: "doc-bio-7",
    title: "Biologiya 7-sinf",
    size: "12.0 MB",
    pages: 144,
    subject: "Biologiya",
    grade: 7,
    language: "Uz",
    publisher: "Sharq",
    year: 2021,
    license: "pending",
    parse: "queued",
    chunks: 0,
    approvedChunks: 0,
    quality: 0,
  },
];

// ----- Chunk viewer / editor -----

type ReviewStatus = "approved" | "pending" | "rejected";

interface RagChunk {
  id: string;
  number: number;
  preview: string;
  text: string;
  pageStart: number;
  pageEnd: number;
  contentType: string;
  contentTypeLabel: string;
  subject: string;
  topic: string;
  difficulty: string;
  language: string;
  citation: string;
  review: ReviewStatus;
}

const CHUNK_TYPE_PILL: Record<string, string> = {
  Formula: "bg-bg text-muted border border-line",
  Rule: "bg-duyo-50 text-duyo-blue border border-duyo-100",
  Example: "bg-duyo-50 text-duyo-dark border border-duyo-100",
};

const CHUNKS: RagChunk[] = [
  {
    id: "chunk-124",
    number: 124,
    preview: "Algebraik ifodalar ustida amallar bajarishda koeffitsientlar va darajalar...",
    text:
      "Algebraik ifodalar ustida amallar bajarishda koeffitsientlar va darajalar bir xil bo'lgan hadlar - o'xshash hadlar deb ataladi. O'xshash hadlarni ixchamlash uchun ularning koeffitsientlari qo'shiladi va umumiy harfiy qism yoziladi. Masalan: 2x + 3x = (2+3)x = 5x. Agar koeffitsientlar qarama-qarshi sonlar bo'lsa, ularning yig'indisi nolga teng bo'ladi.",
    pageStart: 42,
    pageEnd: 43,
    contentType: "example",
    contentTypeLabel: "Example (Misol)",
    subject: "Matematika",
    topic: "Algebraik ifodalar",
    difficulty: "O'rta",
    language: "Uz",
    citation: "Algebra 9, P. 42-43",
    review: "approved",
  },
  {
    id: "chunk-125",
    number: 125,
    preview: "Kvadrat tenglamaning diskriminanti nolga teng bo'lganda, ildizlar yagona...",
    text:
      "Kvadrat tenglamaning diskriminanti nolga teng bo'lganda, ildizlar yagona bo'ladi va u x = -b / 2a formula bilan topiladi. Diskriminant D = b² - 4ac ko'rinishida hisoblanadi.",
    pageStart: 44,
    pageEnd: 44,
    contentType: "rule",
    contentTypeLabel: "Rule (Qoida)",
    subject: "Matematika",
    topic: "Kvadrat tenglamalar",
    difficulty: "Yuqori",
    language: "Uz",
    citation: "Algebra 9, P. 44",
    review: "pending",
  },
  {
    id: "chunk-126",
    number: 126,
    preview: "Viyet teoremasidan foydalanib, berilgan tenglamaning koeffitsientlarini...",
    text:
      "Viyet teoremasidan foydalanib, berilgan tenglamaning koeffitsientlarini topish mumkin. Ildizlar yig'indisi -b/a ga, ko'paytmasi esa c/a ga teng bo'ladi.",
    pageStart: 46,
    pageEnd: 46,
    contentType: "example",
    contentTypeLabel: "Example (Misol)",
    subject: "Matematika",
    topic: "Viyet teoremasi",
    difficulty: "Yuqori",
    language: "Uz",
    citation: "Algebra 9, P. 46",
    review: "pending",
  },
];

// ----- Retrieval test -----

interface RetrievedChunk {
  score: number;
  citation: string;
  text: string;
}

const RETRIEVED: RetrievedChunk[] = [
  {
    score: 0.942,
    citation: "Algebra 9, P. 42",
    text:
      "\"O'xshash hadlarni ixchamlash uchun ularning koeffitsientlari qo'shiladi va umumiy harfiy qism yoziladi...\"",
  },
  {
    score: 0.718,
    citation: "Algebra 8, P. 112",
    text:
      "\"Ko'phadni birhadga ko'paytirishda taqsimot qonunidan foydalaniladi, so'ngra o'xshash hadlar bo'lsa...\"",
  },
];

const GRADE_OPTIONS = ["Sinf: Barchasi", "7-sinf", "8-sinf", "9-sinf", "10-sinf", "11-sinf"];
const SUBJECT_OPTIONS = ["Fan: Barchasi", "Matematika", "Fizika", "Biologiya", "Kimyo"];
const TOPIC_OPTIONS = ["Mavzu: Barchasi", "Algebraik ifodalar", "Kvadrat tenglamalar", "Viyet teoremasi"];

// ----- Sub-components -----

function PipelineStatus() {
  return (
    <div className="card mb-6 p-6">
      <h2 className="mb-5 text-lg font-semibold text-ink">Pipeline statusi</h2>
      <div className="flex items-start justify-between gap-1 overflow-x-auto">
        {PIPELINE_STEPS.map((step, idx) => {
          const Icon = step.icon;
          const isLast = idx === PIPELINE_STEPS.length - 1;
          const circle =
            step.state === "done"
              ? "bg-duyo-blue text-white"
              : step.state === "active"
                ? "bg-duyo-blue text-white"
                : "bg-bg text-muted border border-line";
          const connector = step.state === "done" ? "bg-duyo-blue" : "bg-line";
          return (
            <div key={step.key} className="flex min-w-[88px] flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                <div className={cn("hidden h-0.5 flex-1 sm:block", idx === 0 ? "opacity-0" : connector)} />
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                    circle,
                  )}
                >
                  {step.state === "done" ? (
                    <Check size={18} />
                  ) : (
                    <Icon size={18} className={cn(step.state === "active" && "animate-spin")} />
                  )}
                </div>
                <div
                  className={cn(
                    "hidden h-0.5 flex-1 sm:block",
                    isLast ? "opacity-0" : step.state === "done" ? "bg-duyo-blue" : "bg-line",
                  )}
                />
              </div>
              <span
                className={cn(
                  "mt-2 text-center text-xs font-semibold",
                  step.state === "pending" ? "text-muted" : "text-ink",
                )}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DocumentsTable() {
  return (
    <div className="card mb-6 overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-line px-5 py-4">
        <h2 className="text-lg font-semibold text-ink">Hujjatlar jadvali</h2>
        <div className="flex items-center gap-2 text-muted">
          <button className="rounded-lg border border-line p-2 hover:bg-bg" title="Filtr">
            <Filter size={15} />
          </button>
          <button className="rounded-lg border border-line p-2 hover:bg-bg" title="Eksport">
            <Download size={15} />
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-medium">Hujjat nomi</th>
              <th className="px-3 py-3 font-medium">Fan</th>
              <th className="px-3 py-3 font-medium">Sinf</th>
              <th className="px-3 py-3 font-medium">Til</th>
              <th className="px-3 py-3 font-medium">Nashriyot/Yil</th>
              <th className="px-3 py-3 font-medium">Litsenziya</th>
              <th className="px-3 py-3 font-medium">Parsing</th>
              <th className="px-3 py-3 font-medium">Chunk</th>
              <th className="px-3 py-3 font-medium">Sifat</th>
              <th className="px-3 py-3 font-medium">Amallar</th>
            </tr>
          </thead>
          <tbody>
            {DOCUMENTS.map((doc) => {
              const lic = LICENSE_STYLES[doc.license];
              const parse = PARSE_STYLES[doc.parse];
              const qualityColor =
                doc.quality >= 80 ? "bg-safe" : doc.quality >= 50 ? "bg-serious" : "bg-line";
              return (
                <tr key={doc.id} className="border-b border-line/70 align-top last:border-0">
                  <td className="px-5 py-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg text-muted">
                        <FileText size={16} />
                      </span>
                      <div>
                        <div className="font-semibold text-ink">{doc.title}</div>
                        <div className="mt-0.5 text-xs text-muted">
                          {doc.size} • {doc.pages} bet
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-4 text-ink">{doc.subject}</td>
                  <td className="px-3 py-4 text-ink">{doc.grade}</td>
                  <td className="px-3 py-4 text-ink">{doc.language}</td>
                  <td className="px-3 py-4 text-muted">
                    {doc.publisher}, {doc.year}
                  </td>
                  <td className="px-3 py-4">
                    <span className={cn("pill", lic.pill)}>{lic.label}</span>
                  </td>
                  <td className="px-3 py-4">
                    <span className={cn("pill", parse.pill)}>{parse.label}</span>
                    <div className="mt-1 text-[11px] text-muted">
                      {doc.approvedChunks.toLocaleString()} / {doc.chunks.toLocaleString()} chunks
                    </div>
                  </td>
                  <td className="px-3 py-4">
                    <div className="text-xs text-muted">
                      {doc.approvedChunks.toLocaleString()} tasdiqlangan
                    </div>
                  </td>
                  <td className="px-3 py-4">
                    {doc.quality > 0 ? (
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-line">
                          <div
                            className={cn("h-full rounded-full", qualityColor)}
                            style={{ width: `${doc.quality}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-ink">{doc.quality}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                  <td className="px-3 py-4">
                    <div className="flex items-center gap-3 text-muted">
                      <button className="hover:text-duyo-blue" title="Tahrirlash">
                        <Pencil size={15} />
                      </button>
                      <button className="hover:text-duyo-blue" title="Ko'rish">
                        <Eye size={15} />
                      </button>
                    </div>
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

function ChunkList({
  selectedId,
  onSelect,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="card flex flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-line px-5 py-4">
        <div className="flex items-center gap-2">
          <ListTree size={16} className="text-duyo-blue" />
          <h2 className="text-base font-semibold text-ink">Chunk ro'yxati</h2>
        </div>
        <span className="pill bg-bg text-muted">854 jami</span>
      </div>
      <div className="space-y-3 p-4">
        {CHUNKS.map((chunk) => {
          const active = chunk.id === selectedId;
          const typePill = CHUNK_TYPE_PILL[chunk.contentTypeLabel.split(" ")[0]] ?? CHUNK_TYPE_PILL.Formula;
          return (
            <button
              key={chunk.id}
              onClick={() => onSelect(chunk.id)}
              className={cn(
                "w-full rounded-xl border p-3 text-left transition-colors",
                active
                  ? "border-duyo-blue bg-duyo-50"
                  : "border-line bg-surface hover:border-duyo-blue/40 hover:bg-bg",
              )}
            >
              <div className="flex items-center justify-between">
                <span className={cn("text-xs font-semibold", active ? "text-duyo-blue" : "text-muted")}>
                  CHUNK #{chunk.number}
                </span>
                {chunk.review === "approved" ? (
                  <CheckCircle2 size={15} className="text-safe" />
                ) : chunk.review === "rejected" ? (
                  <X size={15} className="text-urgent" />
                ) : (
                  <Smile size={15} className="text-serious" />
                )}
              </div>
              <p className="mt-1.5 text-sm leading-snug text-ink line-clamp-2">{chunk.preview}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="pill bg-bg text-muted">
                  P. {chunk.pageStart}
                  {chunk.pageEnd !== chunk.pageStart ? `-${chunk.pageEnd}` : ""}
                </span>
                <span className={cn("pill", typePill)}>{chunk.contentTypeLabel.split(" ")[0]}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ChunkEditor({ chunk }: { chunk: RagChunk }) {
  const reviewPill =
    chunk.review === "approved"
      ? "bg-safe-bg text-safe border border-safe-line"
      : chunk.review === "rejected"
        ? "bg-urgent-bg text-urgent border border-urgent-line"
        : "bg-warn-bg text-warn border border-warn-line";
  const reviewLabel =
    chunk.review === "approved" ? "Approved" : chunk.review === "rejected" ? "Rejected" : "Pending";

  return (
    <div className="card flex flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-line px-5 py-4">
        <div className="flex items-center gap-2">
          <SquarePen size={16} className="text-duyo-blue" />
          <h2 className="text-base font-semibold text-ink">Chunk tahrirlash</h2>
        </div>
        <span className="text-sm text-muted">
          Sifat ko'rsatkichi: <span className="font-semibold text-safe">92/100</span>
        </span>
      </div>

      <div className="flex-1 space-y-5 p-5">
        {/* Chunk matni */}
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">
            Chunk matni
          </label>
          <textarea
            defaultValue={chunk.text}
            rows={6}
            className="w-full resize-none rounded-xl border border-line bg-surface p-3 text-sm leading-relaxed text-ink focus:border-duyo-blue focus:outline-none focus:ring-2 focus:ring-duyo-100"
          />
        </div>

        {/* Bet raqami + Tarkib turi */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">
              Bet raqami
            </label>
            <input
              defaultValue={
                chunk.pageEnd !== chunk.pageStart
                  ? `${chunk.pageStart}-${chunk.pageEnd}`
                  : `${chunk.pageStart}`
              }
              className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-duyo-blue focus:outline-none focus:ring-2 focus:ring-duyo-100"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">
              Tarkib turi
            </label>
            <select
              defaultValue={chunk.contentTypeLabel}
              className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-duyo-blue focus:outline-none focus:ring-2 focus:ring-duyo-100"
            >
              <option>Example (Misol)</option>
              <option>Rule (Qoida)</option>
              <option>Formula (Formula)</option>
              <option>Definition (Ta'rif)</option>
            </select>
          </div>
        </div>

        {/* Fan + Mavzu + Litsenziya */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">
              Fan
            </label>
            <input
              defaultValue={chunk.subject}
              className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-duyo-blue focus:outline-none focus:ring-2 focus:ring-duyo-100"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">
              Mavzu
            </label>
            <input
              defaultValue={chunk.topic}
              className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-duyo-blue focus:outline-none focus:ring-2 focus:ring-duyo-100"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">
              Litsenziya
            </label>
            <div className={cn("flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium", reviewPill)}>
              <CheckCircle2 size={15} /> {reviewLabel}
            </div>
          </div>
        </div>

        {/* Qiyinlik + Til + Iqtibos */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">
              Qiyinlik
            </label>
            <select
              defaultValue={chunk.difficulty}
              className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-duyo-blue focus:outline-none focus:ring-2 focus:ring-duyo-100"
            >
              <option>Boshlang'ich</option>
              <option>O'rta</option>
              <option>Yuqori</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">
              Til
            </label>
            <select
              defaultValue={chunk.language}
              className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-duyo-blue focus:outline-none focus:ring-2 focus:ring-duyo-100"
            >
              <option>Uz</option>
              <option>Ru</option>
              <option>En</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">
              Iqtibos (citation)
            </label>
            <input
              defaultValue={chunk.citation}
              readOnly
              className="w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-sm text-muted"
            />
          </div>
        </div>
      </div>

      {/* Action footer */}
      <div className="flex items-center justify-between gap-3 border-t border-line bg-bg px-5 py-4">
        <button className="flex items-center gap-2 rounded-xl bg-urgent px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90">
          <X size={16} /> Reject
        </button>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink hover:bg-bg">
            Smeta qoralama
          </button>
          <button className="flex items-center gap-2 rounded-xl bg-duyo-blue px-4 py-2.5 text-sm font-semibold text-white hover:bg-duyo-dark">
            <CheckCheck size={16} /> Approve
          </button>
        </div>
      </div>
    </div>
  );
}

function RetrievalTest() {
  return (
    <div className="rounded-2xl bg-ink p-6 text-white shadow-card">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-duyo-blue">
          <Search size={18} />
        </span>
        <div>
          <h2 className="text-lg font-semibold">Retrieval Test (Qidiruv sinovi)</h2>
          <p className="text-sm text-white/60">RAG model qanday natija berishini real vaqtda tekshiring</p>
        </div>
      </div>

      <div className="rounded-2xl bg-white/5 p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex flex-1 items-center gap-2 rounded-xl bg-white/10 px-4 py-3">
            <Search size={16} className="text-white/50" />
            <input
              placeholder="Savol kiriting: Masalan, o'xshash hadlarni ixchamlash qanday bo'ladi?"
              className="w-full bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
            />
          </div>
          <button className="flex items-center justify-center gap-2 rounded-xl bg-duyo-blue px-6 py-3 text-sm font-semibold text-white hover:bg-duyo-dark">
            Testlash
          </button>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[GRADE_OPTIONS, SUBJECT_OPTIONS, TOPIC_OPTIONS].map((opts, i) => (
            <select
              key={i}
              className="w-full rounded-xl bg-white/10 px-4 py-2.5 text-sm text-white focus:outline-none"
            >
              {opts.map((o) => (
                <option key={o} className="text-ink">
                  {o}
                </option>
              ))}
            </select>
          ))}
        </div>
      </div>

      {/* Retrieved chunks + citation */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {RETRIEVED.map((r, i) => {
          const strong = r.score >= 0.8;
          return (
            <div
              key={i}
              className={cn(
                "rounded-2xl border-l-4 p-4",
                strong ? "border-safe bg-white text-ink" : "border-warn bg-white/85 text-ink",
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "pill",
                    strong
                      ? "bg-safe-bg text-safe border border-safe-line"
                      : "bg-warn-bg text-warn border border-warn-line",
                  )}
                >
                  SCORE: {r.score.toFixed(3)}
                </span>
                <span className="text-xs text-muted">Citation: {r.citation}</span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-ink">{r.text}</p>
            </div>
          );
        })}
      </div>

      {/* Answer preview */}
      <div className="mt-4 rounded-2xl bg-white/5 p-4">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/60">
          <CheckCircle2 size={14} className="text-safe" /> Javob namunasi (answer preview)
        </div>
        <p className="text-sm leading-relaxed text-white/90">
          O'xshash hadlarni ixchamlash uchun ularning koeffitsientlari qo'shiladi va umumiy harfiy qism
          o'zgarmaydi. Masalan: 2x + 3x = 5x.
          <span className="ml-1 text-white/50">[Algebra 9, P. 42]</span>
        </p>
      </div>
    </div>
  );
}

// ----- Page -----

export function RagKnowledge() {
  const [selectedChunkId, setSelectedChunkId] = useState<string>(CHUNKS[0].id);
  const selectedChunk = CHUNKS.find((c) => c.id === selectedChunkId) ?? CHUNKS[0];

  return (
    <div>
      <PageHeader
        title="RAG bilim bazasi"
        subtitle="Darslik hujjatlari, parsing pipeline va chunk sifat nazorati"
        actions={
          <button className="flex items-center gap-2 rounded-xl bg-duyo-blue px-4 py-2.5 text-sm font-semibold text-white hover:bg-duyo-dark">
            <UploadCloud size={16} /> PDF yuklash
          </button>
        }
      />

      {/* Warning banners — litsenziyasiz / ko'rib chiqilmagan kontent */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex items-start gap-3 rounded-2xl border border-urgent-line bg-urgent-bg p-4">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-urgent" />
          <p className="text-sm text-urgent">
            <span className="font-semibold">Review status = approved</span> bo'lmagan chunk'lar
            production RAG'da ishlatilmaydi.
          </p>
        </div>
        <div className="flex items-start gap-3 rounded-2xl border border-warn-line bg-warn-bg p-4">
          <ShieldAlert size={18} className="mt-0.5 shrink-0 text-warn" />
          <p className="text-sm text-warn">
            <span className="font-semibold">License status = approved</span> bo'lmagan hujjat nashr
            qilinmaydi.
          </p>
        </div>
      </div>

      <PipelineStatus />

      <DocumentsTable />

      {/* Chunk list + editor */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(280px,1fr)_2fr]">
        <ChunkList selectedId={selectedChunkId} onSelect={setSelectedChunkId} />
        <ChunkEditor chunk={selectedChunk} />
      </div>

      <RetrievalTest />
    </div>
  );
}
