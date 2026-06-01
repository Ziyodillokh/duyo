import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ShieldCheck,
  Users as UsersIcon,
  ScrollText,
  SlidersHorizontal,
  Plus,
  Pencil,
  KeyRound,
  Power,
  PowerOff,
  AlertTriangle,
  Loader2,
  X,
  Server,
  Cpu,
  Database,
  ListChecks,
  Mic,
  Lock,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { cn } from "@/lib/utils";
import { useAuth } from "@/auth/AuthContext";
import { ApiError } from "@/api/client";
import {
  adminApi,
  ROLE_LABELS,
  type AdminRole,
  type AdminUserRow,
  type CreateAdminBody,
} from "@/api/admin";

// ─────────────────────────────────────────────────────────────
// Yordamchilar
// ─────────────────────────────────────────────────────────────

const MIN_PASSWORD_LENGTH = 8;

const ALL_ROLES: AdminRole[] = [
  "super_admin",
  "admin",
  "safety_officer",
  "content_manager",
  "support_agent",
  "finance_manager",
  "school_admin",
  "analyst",
];

const ROLE_PILL: Record<AdminRole, string> = {
  super_admin: "bg-duyo-50 text-duyo-dark border border-duyo-100",
  admin: "bg-bg text-muted border border-line",
  safety_officer: "bg-urgent-bg text-urgent border border-urgent-line",
  content_manager: "bg-serious-bg text-serious border border-serious-line",
  support_agent: "bg-warn-bg text-warn border border-warn-line",
  finance_manager: "bg-safe-bg text-safe border border-safe-line",
  school_admin: "bg-duyo-50 text-duyo-dark border border-duyo-100",
  analyst: "bg-bg text-muted border border-line",
};

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.detail;
  if (error instanceof Error) return error.message;
  return "Kutilmagan xatolik";
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("uz-UZ", { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("uz-UZ", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─────────────────────────────────────────────────────────────
// Kichik UI bo'laklar
// ─────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-4 text-base font-semibold text-ink">{children}</h2>;
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center gap-2 px-4 py-16 text-sm text-muted">
      <Loader2 size={18} className="animate-spin text-duyo-blue" />
      Yuklanmoqda…
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center gap-2 px-4 py-16 text-sm text-urgent">
      <AlertTriangle size={18} />
      {message}
    </div>
  );
}

function EmptyState({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-muted">
        {label}
      </td>
    </tr>
  );
}

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="mb-5 flex items-start gap-3 rounded-2xl border border-urgent-line bg-urgent-bg p-4">
      <AlertTriangle size={18} className="mt-0.5 shrink-0 text-urgent" />
      <div className="flex-1 text-sm text-urgent">{message}</div>
      <button
        type="button"
        aria-label="Yopish"
        onClick={onDismiss}
        className="text-urgent hover:opacity-70"
      >
        <X size={16} />
      </button>
    </div>
  );
}

function RolePill({ role }: { role: AdminRole }) {
  return <span className={cn("pill", ROLE_PILL[role])}>{ROLE_LABELS[role]}</span>;
}

function ActivePill({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "pill",
        active
          ? "bg-safe-bg text-safe border border-safe-line"
          : "bg-urgent-bg text-urgent border border-urgent-line",
      )}
    >
      {active ? "Faol" : "O'chirilgan"}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// TAB 1 — Adminlar
// ─────────────────────────────────────────────────────────────

interface AdminsTabProps {
  canManage: boolean;
}

function AdminsTab({ canManage }: AdminsTabProps) {
  const queryClient = useQueryClient();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUserRow | null>(null);
  const [resetting, setResetting] = useState<AdminUserRow | null>(null);

  const adminsQuery = useQuery({
    queryKey: ["admin", "admins"],
    queryFn: () => adminApi.listAdmins(),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["admin", "admins"] });

  const createMutation = useMutation({
    mutationFn: (body: CreateAdminBody) => adminApi.createAdmin(body),
    onMutate: () => setErrorMsg(null),
    onSuccess: () => {
      invalidate();
      setCreateOpen(false);
    },
    onError: (err: unknown) => setErrorMsg(getErrorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof adminApi.updateAdmin>[1] }) =>
      adminApi.updateAdmin(id, body),
    onMutate: () => setErrorMsg(null),
    onSuccess: () => {
      invalidate();
      setEditing(null);
    },
    onError: (err: unknown) => setErrorMsg(getErrorMessage(err)),
  });

  const resetMutation = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      adminApi.resetAdminPassword(id, password),
    onMutate: () => setErrorMsg(null),
    onSuccess: () => setResetting(null),
    onError: (err: unknown) => setErrorMsg(getErrorMessage(err)),
  });

  const handleToggleActive = (row: AdminUserRow) => {
    if (row.is_active) {
      const ok = window.confirm(
        `"${row.email}" hisobini o'chirib qo'yasizmi? U tizimga kira olmaydi.`,
      );
      if (!ok) return;
    }
    updateMutation.mutate({ id: row.id, body: { is_active: !row.is_active } });
  };

  const rows = adminsQuery.data ?? [];
  const pendingId =
    updateMutation.isPending && updateMutation.variables ? updateMutation.variables.id : null;

  return (
    <div className="p-1">
      {errorMsg && <ErrorBanner message={errorMsg} onDismiss={() => setErrorMsg(null)} />}

      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="text-sm text-muted">
          Admin hisoblari va rollari (RBAC).{" "}
          {!canManage && (
            <span className="text-warn">Boshqarish faqat Super Admin uchun — faqat ko'rish.</span>
          )}
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => {
              setErrorMsg(null);
              setCreateOpen(true);
            }}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-duyo-blue px-3.5 py-2 text-sm font-semibold text-white hover:bg-duyo-dark"
          >
            <Plus size={16} /> Yangi admin
          </button>
        )}
      </div>

      <div className="card overflow-hidden">
        {adminsQuery.isLoading ? (
          <LoadingState />
        ) : adminsQuery.isError ? (
          <ErrorState message={getErrorMessage(adminsQuery.error)} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-muted">
                  <th className="px-5 py-3">Email</th>
                  <th className="px-3 py-3">Ism</th>
                  <th className="px-3 py-3">Rol</th>
                  <th className="px-3 py-3">Holat</th>
                  <th className="px-3 py-3">Oxirgi kirish</th>
                  <th className="px-3 py-3">Yaratilgan</th>
                  {canManage && <th className="px-3 py-3 text-right">Amallar</th>}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <EmptyState colSpan={canManage ? 7 : 6} label="Ma'lumot yo'q" />
                ) : (
                  rows.map((row) => {
                    const busy = pendingId === row.id;
                    return (
                      <tr
                        key={row.id}
                        className="border-b border-line/70 last:border-0 hover:bg-bg/60"
                      >
                        <td className="px-5 py-3 font-medium text-ink">{row.email}</td>
                        <td className="px-3 py-3 text-muted">{row.full_name || "—"}</td>
                        <td className="px-3 py-3">
                          <RolePill role={row.role} />
                        </td>
                        <td className="px-3 py-3">
                          <ActivePill active={row.is_active} />
                        </td>
                        <td className="px-3 py-3 text-xs text-muted">
                          {row.last_login_at ? formatDateTime(row.last_login_at) : "hech qachon"}
                        </td>
                        <td className="px-3 py-3 text-xs text-muted">
                          {formatDate(row.created_at)}
                        </td>
                        {canManage && (
                          <td className="px-3 py-3">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                aria-label="Rolni o'zgartirish"
                                title="Rolni o'zgartirish"
                                onClick={() => {
                                  setErrorMsg(null);
                                  setEditing(row);
                                }}
                                className="rounded-lg border border-line p-1.5 text-muted transition-colors hover:border-duyo-blue hover:bg-duyo-50 hover:text-duyo-dark"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                type="button"
                                aria-label="Parolni tiklash"
                                title="Parolni tiklash"
                                onClick={() => {
                                  setErrorMsg(null);
                                  setResetting(row);
                                }}
                                className="rounded-lg border border-line p-1.5 text-muted transition-colors hover:border-duyo-blue hover:bg-duyo-50 hover:text-duyo-dark"
                              >
                                <KeyRound size={14} />
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                aria-label={row.is_active ? "O'chirish" : "Faollashtirish"}
                                title={row.is_active ? "O'chirish" : "Faollashtirish"}
                                onClick={() => handleToggleActive(row)}
                                className={cn(
                                  "rounded-lg border p-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                                  row.is_active
                                    ? "border-line text-muted hover:border-urgent-line hover:bg-urgent-bg hover:text-urgent"
                                    : "border-line text-muted hover:border-safe-line hover:bg-safe-bg hover:text-safe",
                                )}
                              >
                                {busy ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : row.is_active ? (
                                  <PowerOff size={14} />
                                ) : (
                                  <Power size={14} />
                                )}
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {createOpen && (
        <CreateAdminModal
          busy={createMutation.isPending}
          onClose={() => setCreateOpen(false)}
          onSubmit={(body) => createMutation.mutate(body)}
        />
      )}

      {editing && (
        <EditRoleModal
          admin={editing}
          busy={updateMutation.isPending}
          onClose={() => setEditing(null)}
          onSubmit={(role) => updateMutation.mutate({ id: editing.id, body: { role } })}
        />
      )}

      {resetting && (
        <ResetPasswordModal
          admin={resetting}
          busy={resetMutation.isPending}
          onClose={() => setResetting(null)}
          onSubmit={(password) => resetMutation.mutate({ id: resetting.id, password })}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Modallar
// ─────────────────────────────────────────────────────────────

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-ink">{title}</h3>
          <button
            type="button"
            aria-label="Yopish"
            onClick={onClose}
            className="text-muted hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const inputCls =
  "mt-1.5 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-duyo-blue focus:outline-none";
const labelCls = "block text-sm font-medium text-ink";
const primaryBtn =
  "flex items-center justify-center gap-1.5 rounded-xl bg-duyo-blue px-4 py-2 text-sm font-semibold text-white hover:bg-duyo-dark disabled:cursor-not-allowed disabled:opacity-50";
const ghostBtn =
  "rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-bg";

function CreateAdminModal({
  busy,
  onClose,
  onSubmit,
}: {
  busy: boolean;
  onClose: () => void;
  onSubmit: (body: CreateAdminBody) => void;
}) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<AdminRole>("support_agent");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setLocalError("Email majburiy.");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setLocalError(`Parol kamida ${MIN_PASSWORD_LENGTH} belgidan iborat bo'lishi kerak.`);
      return;
    }
    setLocalError(null);
    onSubmit({
      email: trimmedEmail,
      full_name: fullName.trim() || undefined,
      role,
      password,
    });
  };

  return (
    <ModalShell title="Yangi admin qo'shish" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelCls} htmlFor="new-admin-email">
            Email
          </label>
          <input
            id="new-admin-email"
            type="email"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            className={inputCls}
            placeholder="admin@duyo.uz"
            autoFocus
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="new-admin-name">
            To'liq ism (ixtiyoriy)
          </label>
          <input
            id="new-admin-name"
            type="text"
            value={fullName}
            onChange={(ev) => setFullName(ev.target.value)}
            className={inputCls}
            placeholder="Ism Familiya"
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="new-admin-role">
            Rol
          </label>
          <select
            id="new-admin-role"
            value={role}
            onChange={(ev) => setRole(ev.target.value as AdminRole)}
            className={inputCls}
          >
            {ALL_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls} htmlFor="new-admin-password">
            Parol
          </label>
          <input
            id="new-admin-password"
            type="password"
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
            className={inputCls}
            placeholder="••••••••"
          />
          <p className="mt-1 text-xs text-muted">
            Kamida {MIN_PASSWORD_LENGTH} belgi.
          </p>
        </div>

        {localError && <p className="text-sm text-urgent">{localError}</p>}

        <div className="flex items-center justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className={ghostBtn}>
            Bekor qilish
          </button>
          <button type="submit" disabled={busy} className={primaryBtn}>
            {busy && <Loader2 size={15} className="animate-spin" />} Qo'shish
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function EditRoleModal({
  admin,
  busy,
  onClose,
  onSubmit,
}: {
  admin: AdminUserRow;
  busy: boolean;
  onClose: () => void;
  onSubmit: (role: AdminRole) => void;
}) {
  const [role, setRole] = useState<AdminRole>(admin.role);

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    onSubmit(role);
  };

  return (
    <ModalShell title="Rolni o'zgartirish" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-muted">{admin.email}</p>
        <div>
          <label className={labelCls} htmlFor="edit-admin-role">
            Rol
          </label>
          <select
            id="edit-admin-role"
            value={role}
            onChange={(ev) => setRole(ev.target.value as AdminRole)}
            className={inputCls}
          >
            {ALL_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className={ghostBtn}>
            Bekor qilish
          </button>
          <button type="submit" disabled={busy || role === admin.role} className={primaryBtn}>
            {busy && <Loader2 size={15} className="animate-spin" />} Saqlash
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function ResetPasswordModal({
  admin,
  busy,
  onClose,
  onSubmit,
}: {
  admin: AdminUserRow;
  busy: boolean;
  onClose: () => void;
  onSubmit: (password: string) => void;
}) {
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) {
      setLocalError(`Parol kamida ${MIN_PASSWORD_LENGTH} belgidan iborat bo'lishi kerak.`);
      return;
    }
    setLocalError(null);
    onSubmit(password);
  };

  return (
    <ModalShell title="Parolni tiklash" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-muted">{admin.email}</p>
        <div>
          <label className={labelCls} htmlFor="reset-admin-password">
            Yangi parol
          </label>
          <input
            id="reset-admin-password"
            type="password"
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
            className={inputCls}
            placeholder="••••••••"
            autoFocus
          />
          <p className="mt-1 text-xs text-muted">
            Kamida {MIN_PASSWORD_LENGTH} belgi.
          </p>
        </div>

        {localError && <p className="text-sm text-urgent">{localError}</p>}

        <div className="flex items-center justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className={ghostBtn}>
            Bekor qilish
          </button>
          <button type="submit" disabled={busy} className={primaryBtn}>
            {busy && <Loader2 size={15} className="animate-spin" />} Tiklash
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ─────────────────────────────────────────────────────────────
// TAB 2 — Audit jurnali
// ─────────────────────────────────────────────────────────────

function AuditTab() {
  const auditQuery = useQuery({
    queryKey: ["admin", "audit"],
    queryFn: () => adminApi.auditLog(100),
  });

  const rows = auditQuery.data ?? [];

  return (
    <div className="p-1">
      <div className="mb-4 text-sm text-muted">
        So'nggi 100 ta admin amali — eng yangisi yuqorida.
      </div>
      <div className="card overflow-hidden">
        {auditQuery.isLoading ? (
          <LoadingState />
        ) : auditQuery.isError ? (
          <ErrorState message={getErrorMessage(auditQuery.error)} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-muted">
                  <th className="px-5 py-3">Vaqt</th>
                  <th className="px-3 py-3">Admin</th>
                  <th className="px-3 py-3">Amal</th>
                  <th className="px-3 py-3">Modul</th>
                  <th className="px-3 py-3">Nishon</th>
                  <th className="px-3 py-3">IP manzil</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <EmptyState colSpan={6} label="Ma'lumot yo'q" />
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="border-b border-line/70 last:border-0">
                      <td className="px-5 py-3 text-xs text-muted">
                        {formatDateTime(row.created_at)}
                      </td>
                      <td className="px-3 py-3 text-ink">{row.admin_email}</td>
                      <td className="px-3 py-3">
                        <code className="rounded bg-bg px-1.5 py-0.5 text-xs text-ink">
                          {row.action}
                        </code>
                      </td>
                      <td className="px-3 py-3 text-muted">{row.module}</td>
                      <td className="px-3 py-3 text-muted">{row.target ?? "—"}</td>
                      <td className="px-3 py-3 font-mono text-xs text-muted">{row.ip ?? "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TAB 3 — Sozlamalar (MOCK — backend yo'q, namuna sifatida)
// ─────────────────────────────────────────────────────────────

type ServiceState = "healthy" | "degraded" | "down";

interface ServiceHealth {
  name: string;
  icon: LucideIcon;
  state: ServiceState;
  latency: string;
  uptime: string;
}

const SERVICE_META: Record<ServiceState, { label: string; dot: string; pill: string }> = {
  healthy: { label: "Sog'lom", dot: "bg-safe", pill: "bg-safe-bg text-safe border border-safe-line" },
  degraded: { label: "Sekinlashgan", dot: "bg-warn", pill: "bg-warn-bg text-warn border border-warn-line" },
  down: { label: "Ishlamayapti", dot: "bg-urgent", pill: "bg-urgent-bg text-urgent border border-urgent-line" },
};

const SERVICES: ServiceHealth[] = [
  { name: "API Gateway", icon: Server, state: "healthy", latency: "p95 84ms", uptime: "99.98%" },
  { name: "AI Service (Gemini)", icon: Cpu, state: "degraded", latency: "p95 1.8s", uptime: "99.21%" },
  { name: "PostgreSQL", icon: Database, state: "healthy", latency: "p95 12ms", uptime: "99.99%" },
  { name: "Job Queue", icon: ListChecks, state: "healthy", latency: "3 ta kutilmoqda", uptime: "99.95%" },
  { name: "STT / TTS Worker", icon: Mic, state: "down", latency: "javob yo'q", uptime: "97.40%" },
];

function SettingsTab() {
  return (
    <div className="p-1">
      <div className="mb-5 flex items-start gap-3 rounded-2xl border border-line bg-bg p-4">
        <Lock size={18} className="mt-0.5 shrink-0 text-muted" />
        <div className="text-sm text-muted">
          <span className="font-semibold text-ink">Namuna ma'lumotlar.</span> Xizmatlar holati va
          xavfsizlik sozlamalari uchun backend hali ulanmagan — quyidagilar faqat ko'rgazma uchun.
        </div>
      </div>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionTitle>Xizmatlar holati (namuna)</SectionTitle>
          <div className="card divide-y divide-line">
            {SERVICES.map((s) => {
              const Icon = s.icon;
              const m = SERVICE_META[s.state];
              return (
                <div key={s.name} className="flex items-center gap-3 px-4 py-3">
                  <Icon size={18} className="shrink-0 text-muted" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-ink">{s.name}</div>
                    <div className="text-xs text-muted">
                      {s.latency} · uptime {s.uptime}
                    </div>
                  </div>
                  <span className={cn("pill ml-auto shrink-0", m.pill)}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", m.dot)} /> {m.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <SectionTitle>Xavfsizlik holati (namuna)</SectionTitle>
          <div className="card flex h-[calc(100%-2.5rem)] flex-col gap-4 bg-ink p-5 text-white">
            <ShieldCheck size={28} className="text-safe" />
            <div className="text-sm font-semibold">Xavfsizlik bo'yicha maslahatlar</div>
            <ul className="space-y-3 text-xs text-line">
              <li className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-safe" />
                Admin parollar kamida 12 belgi va har 90 kunda yangilanishi talab etiladi.
              </li>
              <li className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-warn" />
                STT/TTS worker ishlamayapti — xizmat holatini tekshiring.
              </li>
              <li className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-safe" />
                Bola ma'lumotlari ko'rinishi audit jurnalida to'liq yoziladi.
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Asosiy sahifa
// ─────────────────────────────────────────────────────────────

type TabKey = "admins" | "audit" | "settings";

interface TabDef {
  key: TabKey;
  label: string;
  icon: LucideIcon;
}

const TABS: TabDef[] = [
  { key: "admins", label: "Adminlar", icon: UsersIcon },
  { key: "audit", label: "Audit jurnali", icon: ScrollText },
  { key: "settings", label: "Sozlamalar", icon: SlidersHorizontal },
];

export function SystemSettings() {
  const { admin } = useAuth();
  const [tab, setTab] = useState<TabKey>("admins");

  const canManageAdmins = admin?.role === "super_admin";

  return (
    <div>
      <PageHeader
        title="Tizim sozlamalari"
        subtitle="Admin hisoblari (RBAC), audit jurnali va tizim sozlamalari"
        actions={
          <span className="pill bg-serious-bg text-serious border border-serious-line">
            <span className="h-1.5 w-1.5 rounded-full bg-serious" /> Production muhiti
          </span>
        }
      />

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-1 border-b border-line px-3 pt-2">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
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
        </div>

        <div className="p-4">
          {tab === "admins" && <AdminsTab canManage={canManageAdmins} />}
          {tab === "audit" && <AuditTab />}
          {tab === "settings" && <SettingsTab />}
        </div>
      </div>
    </div>
  );
}
