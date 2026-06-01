import { Routes, Route } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { Dashboard } from "@/pages/Dashboard";
import { SafetyCenter } from "@/pages/SafetyCenter";
import { Placeholder } from "@/pages/Placeholder";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/safety" element={<SafetyCenter />} />
        <Route path="/users" element={<Placeholder navKey="users" phase="Faza 1" />} />
        <Route path="/ai" element={<Placeholder navKey="ai" phase="Faza 2" />} />
        <Route path="/rag" element={<Placeholder navKey="rag" phase="Faza 1" />} />
        <Route path="/content" element={<Placeholder navKey="content" phase="Faza 2" />} />
        <Route path="/gamification" element={<Placeholder navKey="gamification" phase="Faza 3" />} />
        <Route path="/parents" element={<Placeholder navKey="parents" phase="Faza 2" />} />
        <Route path="/monetization" element={<Placeholder navKey="monetization" phase="Faza 3" />} />
        <Route path="/notifications" element={<Placeholder navKey="notifications" phase="Faza 3" />} />
        <Route path="/analytics" element={<Placeholder navKey="analytics" phase="Faza 3" />} />
        <Route path="/settings" element={<Placeholder navKey="settings" phase="Faza 0/3" />} />
      </Route>
    </Routes>
  );
}
