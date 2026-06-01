import { Routes, Route } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { Dashboard } from "@/pages/Dashboard";
import { SafetyCenter } from "@/pages/SafetyCenter";
import { Users } from "@/pages/Users";
import { AiManagement } from "@/pages/AiManagement";
import { RagKnowledge } from "@/pages/RagKnowledge";
import { ContentLibrary } from "@/pages/ContentLibrary";
import { Gamification } from "@/pages/Gamification";
import { ParentMonitoring } from "@/pages/ParentMonitoring";
import { Monetization } from "@/pages/Monetization";
import { Notifications } from "@/pages/Notifications";
import { Analytics } from "@/pages/Analytics";
import { SystemSettings } from "@/pages/SystemSettings";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/safety" element={<SafetyCenter />} />
        <Route path="/users" element={<Users />} />
        <Route path="/ai" element={<AiManagement />} />
        <Route path="/rag" element={<RagKnowledge />} />
        <Route path="/content" element={<ContentLibrary />} />
        <Route path="/gamification" element={<Gamification />} />
        <Route path="/parents" element={<ParentMonitoring />} />
        <Route path="/monetization" element={<Monetization />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/settings" element={<SystemSettings />} />
      </Route>
    </Routes>
  );
}
