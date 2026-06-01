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

export interface DashboardSummary {
  children: number;
  parents: number;
  messages_total: number;
  textbook_chunks: number;
  textbook_subjects: number;
  crisis: Record<string, number>;
}

export interface RagDocument {
  subject: string;
  grade: number | null;
  language: string | null;
  chunks: number;
  embedded: number;
}

export interface GamificationOverview {
  avatars: number;
  inventory_items: number;
  balls_issued: number;
  longest_streak: number;
  tamagochi_avg: { energy: number; joy: number; learning: number; health: number };
  balls_by_reason: Record<string, number>;
  inventory_by_category: Record<string, number>;
}

export interface ReportRow {
  id: string;
  child_id: string;
  period_start: string;
  period_end: string;
  llm_ok: boolean;
  created_at: string;
}

export interface SubscriptionRow {
  id: string;
  user_id: string;
  tier: string;
  status: string;
  provider: string | null;
  started_at: string | null;
  expires_at: string | null;
}

export interface AiLogRow {
  id: string;
  model: string | null;
  latency_ms: number | null;
  tokens_in: number | null;
  tokens_out: number | null;
  created_at: string;
}

export interface AiSummary {
  messages: number;
  avg_latency_ms: number;
  tokens_in: number;
  tokens_out: number;
  by_model: Record<string, number>;
}

export interface AnalyticsOverview {
  children: number;
  parents: number;
  messages: number;
  messages_per_day: { day: string; count: number }[];
}

export const adminApi = {
  login: (email: string, password: string) =>
    api.post<LoginResponse>("/admin/auth/login", { email, password }),
  me: () => api.get<AdminInfo>("/admin/me"),
  safetyEvents: (level?: CrisisLevel) =>
    api.get<CrisisEventRow[]>(`/admin/safety/events${level ? `?level=${level}` : ""}`),
  safetySummary: () => api.get<Record<string, number>>("/admin/safety/summary"),
  dashboardSummary: () => api.get<DashboardSummary>("/admin/dashboard/summary"),
  ragDocuments: () => api.get<RagDocument[]>("/admin/rag/documents"),
  ragStats: () => api.get<Record<string, number>>("/admin/rag/stats"),
  gamificationOverview: () => api.get<GamificationOverview>("/admin/gamification/overview"),
  parentReports: () => api.get<ReportRow[]>("/admin/parents/reports"),
  parentSummary: () => api.get<Record<string, number>>("/admin/parents/summary"),
  subscriptions: () => api.get<SubscriptionRow[]>("/admin/monetization/subscriptions"),
  monetizationSummary: () =>
    api.get<{ by_tier: Record<string, number>; by_status: Record<string, number> }>(
      "/admin/monetization/summary",
    ),
  aiLogs: () => api.get<AiLogRow[]>("/admin/ai/logs"),
  aiSummary: () => api.get<AiSummary>("/admin/ai/summary"),
  analyticsOverview: () => api.get<AnalyticsOverview>("/admin/analytics/overview"),
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
