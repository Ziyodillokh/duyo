import { useDailyCheckin } from '@/hooks/use-gamification';
import { GlassHome } from '@/screens/home/glass-home';

export default function HomeScreen() {
  // Opening the home tab is the daily visit, whichever design renders.
  // Without it the streak never advances and every activity view stays empty.
  useDailyCheckin();

  // One dashboard for every age now — the glass-sky design. The age variants
  // (JuniorHome / ChildHome / CompanionHome) are parked in screens/home/ in
  // case a younger layout returns.
  return <GlassHome />;
}
