import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { UserProvider } from './contexts/UserContext';

// Onboarding
import { SplashScreen } from './pages/onboarding/SplashScreen';
import { LanguageSelection } from './pages/onboarding/LanguageSelection';
import { UserTypeSelection } from './pages/onboarding/UserTypeSelection';
import { PhoneAuth } from './pages/onboarding/PhoneAuth';
import { ChildName } from './pages/onboarding/ChildName';
import { AgeSelection } from './pages/onboarding/AgeSelection';
import { InterestsSelection } from './pages/onboarding/InterestsSelection';
import { AvatarBuilder } from './pages/onboarding/AvatarBuilder';

// Child App
import { ChildHome } from './pages/child/ChildHome';
import { ChildChat } from './pages/child/ChildChat';
import { ChildLibrary } from './pages/child/ChildLibrary';
import { ChildProfile } from './pages/child/ChildProfile';
import { ChildInventory } from './pages/child/ChildInventory';
import { Subscription } from './pages/child/Subscription';
import { Settings } from './pages/child/Settings';
import { StreakScreen } from './pages/child/StreakScreen';
import { PoemDetail } from './pages/child/PoemDetail';
import { VoiceChat } from './pages/child/VoiceChat';
import { ConversationHistory } from './pages/child/ConversationHistory';
import { StoryDetail } from './pages/child/StoryDetail';
import { LessonHelp } from './pages/child/LessonHelp';
import { DTMPractice } from './pages/child/DTMPractice';
import { DailyMission } from './pages/child/DailyMission';
import { DailySummary } from './pages/child/DailySummary';
import { Payment } from './pages/child/Payment';
import { ParentConnection } from './pages/child/ParentConnection';
import { DailyLimitReached } from './pages/child/DailyLimitReached';
import { JuniorHome } from './pages/child/JuniorHome';
import { CompanionHome } from './pages/child/CompanionHome';

// Shared
import { CrisisSupport } from './pages/shared/CrisisSupport';
import { OfflineState } from './pages/shared/OfflineState';
import { NightMode } from './pages/shared/NightMode';

// Parent
import { ParentDashboard } from './pages/parent/ParentDashboard';

// Admin
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { CrisisEventDetail } from './pages/admin/CrisisEventDetail';

export default function App() {
  return (
    <UserProvider>
      <BrowserRouter>
        <div className="size-full bg-background">
          <Routes>
            {/* Default redirect to splash */}
            <Route path="/" element={<Navigate to="/splash" replace />} />

            {/* Onboarding Flow */}
            <Route path="/splash" element={<SplashScreen />} />
            <Route path="/language" element={<LanguageSelection />} />
            <Route path="/user-type" element={<UserTypeSelection />} />
            <Route path="/phone-auth" element={<PhoneAuth />} />
            <Route path="/child-name" element={<ChildName />} />
            <Route path="/age-selection" element={<AgeSelection />} />
            <Route path="/interests-selection" element={<InterestsSelection />} />
            <Route path="/avatar-builder" element={<AvatarBuilder />} />
            <Route path="/first-conversation" element={<Navigate to="/child/home" replace />} />

            {/* Child App */}
            <Route path="/child/home" element={<ChildHome />} />
            <Route path="/child/home/junior" element={<JuniorHome />} />
            <Route path="/child/home/companion" element={<CompanionHome />} />
            <Route path="/child/chat" element={<ChildChat />} />
            <Route path="/child/library" element={<ChildLibrary />} />
            <Route path="/child/profile" element={<ChildProfile />} />
            <Route path="/child/inventory" element={<ChildInventory />} />
            <Route path="/child/subscription" element={<Subscription />} />
            <Route path="/child/settings" element={<Settings />} />
            <Route path="/child/streak" element={<StreakScreen />} />
            <Route path="/child/poem/:id" element={<PoemDetail />} />
            <Route path="/child/voice-chat" element={<VoiceChat />} />
            <Route path="/child/conversation-history" element={<ConversationHistory />} />
            <Route path="/child/story/:id" element={<StoryDetail />} />
            <Route path="/child/lesson-help" element={<LessonHelp />} />
            <Route path="/child/dtm-practice" element={<DTMPractice />} />
            <Route path="/child/daily-mission" element={<DailyMission />} />
            <Route path="/child/daily-summary" element={<DailySummary />} />
            <Route path="/child/payment" element={<Payment />} />
            <Route path="/child/parent-connection" element={<ParentConnection />} />
            <Route path="/child/daily-limit" element={<DailyLimitReached />} />

            {/* Shared States */}
            <Route path="/crisis/yellow" element={<CrisisSupport level="yellow" />} />
            <Route path="/crisis/orange" element={<CrisisSupport level="orange" />} />
            <Route path="/crisis/red" element={<CrisisSupport level="red" />} />
            <Route path="/offline" element={<OfflineState />} />
            <Route path="/night-mode" element={<NightMode />} />

            {/* Parent */}
            <Route path="/parent/dashboard" element={<ParentDashboard />} />
            <Route path="/parent/login" element={<ParentDashboard />} />

            {/* Admin */}
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/crisis/:id" element={<CrisisEventDetail />} />

            {/* Catch all */}
            <Route path="*" element={<Navigate to="/splash" replace />} />
          </Routes>
        </div>
      </BrowserRouter>
    </UserProvider>
  );
}