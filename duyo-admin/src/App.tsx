import { Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/auth/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { Login } from "@/pages/Login";
import { Dashboard } from "@/pages/Dashboard";
import { SafetyCenter } from "@/pages/SafetyCenter";
import { PeerSafety } from "@/pages/PeerSafety";
import { AiReports } from "@/pages/AiReports";
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
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/safety" element={<SafetyCenter />} />
          <Route path="/peer-safety" element={<PeerSafety />} />
          <Route path="/ai-reports" element={<AiReports />} />
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
      </Route>
    </Routes>
  );
}
