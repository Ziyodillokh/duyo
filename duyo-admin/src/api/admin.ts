import { api } from "./client";

export type AdminRole =
  | "super_admin"
  | "admin"
  | "safety_officer"
  | "content_manager"
  | "support_agent"
  | "finance_manager"
  | "school_admin"
  | "analyst";

export interface AdminInfo {
  id: string;
  email: string;
  full_name: string;
  role: AdminRole;
}

export interface LoginResponse {
  token: string;
  admin: AdminInfo;
}

export type CrisisLevel = "GREEN" | "YELLOW" | "ORANGE" | "RED";

export interface CrisisEventRow {
  id: string;
  child_id: string;
  level: CrisisLevel;
  layer: number;
  matches: { keyword?: string; category?: string; language?: string }[] | null;
  parent_notified: boolean;
  created_at: string;
}

export const adminApi = {
  login: (email: string, password: string) =>
    api.post<LoginResponse>("/admin/auth/login", { email, password }),
  me: () => api.get<AdminInfo>("/admin/me"),
  safetyEvents: (level?: CrisisLevel) =>
    api.get<CrisisEventRow[]>(`/admin/safety/events${level ? `?level=${level}` : ""}`),
  safetySummary: () => api.get<Record<string, number>>("/admin/safety/summary"),
};

export const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  safety_officer: "Safety Officer",
  content_manager: "Content Manager",
  support_agent: "Support Agent",
  finance_manager: "Finance Manager",
  school_admin: "School Admin",
  analyst: "Analyst",
};
