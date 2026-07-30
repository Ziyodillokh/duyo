import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { adminApi, type AdminInfo } from "@/api/admin";
import { clearToken, getToken, setToken } from "@/api/client";

interface AuthState {
  admin: AdminInfo | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminInfo | null>(null);
  // No token → nothing to resolve, start settled; token → loading until me() resolves.
  const [loading, setLoading] = useState(() => Boolean(getToken()));

  // On mount: if a token exists, resolve the current admin (validates it too).
  useEffect(() => {
    if (!getToken()) return;
    adminApi
      .me()
      .then(setAdmin)
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const res = await adminApi.login(email, password);
    setToken(res.token);
    setAdmin(res.admin);
  };

  const logout = () => {
    clearToken();
    setAdmin(null);
  };

  return (
    <AuthContext.Provider value={{ admin, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
