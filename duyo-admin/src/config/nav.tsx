import {
  LayoutDashboard,
  ShieldAlert,
  MessagesSquare,
  Users,
  Bot,
  Database,
  Library,
  Gamepad2,
  HeartHandshake,
  CreditCard,
  Bell,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  key: string; // i18n nav.<key>
  path: string;
  icon: LucideIcon;
}

export interface NavSection {
  titleKey: string; // i18n section.<key>
  items: NavItem[];
}

export const NAV: NavSection[] = [
  {
    titleKey: "operations",
    items: [
      { key: "dashboard", path: "/", icon: LayoutDashboard },
      { key: "safety", path: "/safety", icon: ShieldAlert },
      { key: "peerSafety", path: "/peer-safety", icon: MessagesSquare },
      { key: "users", path: "/users", icon: Users },
    ],
  },
  {
    titleKey: "safetyContent",
    items: [
      { key: "ai", path: "/ai", icon: Bot },
      { key: "rag", path: "/rag", icon: Database },
      { key: "content", path: "/content", icon: Library },
      { key: "gamification", path: "/gamification", icon: Gamepad2 },
      { key: "parents", path: "/parents", icon: HeartHandshake },
    ],
  },
  {
    titleKey: "growth",
    items: [
      { key: "monetization", path: "/monetization", icon: CreditCard },
      { key: "notifications", path: "/notifications", icon: Bell },
      { key: "analytics", path: "/analytics", icon: BarChart3 },
      { key: "settings", path: "/settings", icon: Settings },
    ],
  },
];
