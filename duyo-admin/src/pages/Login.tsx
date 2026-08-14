import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { useAuth } from "@/auth/AuthContext";
import { ApiError } from "@/api/client";

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Kirib bo'lmadi. Qayta urinib ko'ring.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="card w-full max-w-md p-8">
        <div className="mb-6 flex items-center gap-3">
          <BrandMark className="h-12 w-12" />
          <div>
            <div className="text-lg font-bold text-ink">DUYO Admin</div>
            <div className="text-xs text-muted">Ichki boshqaruv paneli</div>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
              className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-duyo-blue"
              placeholder="admin@duyo.uz"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">Parol</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-duyo-blue"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-urgent-line bg-urgent-bg px-3 py-2 text-sm text-urgent">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-duyo-blue py-2.5 text-sm font-semibold text-white hover:bg-duyo-dark disabled:opacity-60"
          >
            {busy && <Loader2 size={16} className="animate-spin" />}
            Kirish
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-muted">
          Faqat vakolatli xodimlar uchun. Barcha amallar audit qilinadi.
        </p>
      </div>
    </div>
  );
}
