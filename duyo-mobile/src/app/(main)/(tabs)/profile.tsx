import { SettingsScreen } from '@/screens/settings/settings-screen';

/**
 * The Profile tab IS the settings screen.
 *
 * What used to live here — level, XP, streak, the week strip, the reward
 * ledger, the Kutubxona and Dars-yordami doorways — either moved to the
 * dashboard and Faollik, where it is the main content, or is one tap from
 * them. What remained was a name, a picture, and a gear icon pointing at
 * settings. The name and picture now sit at the top of settings itself, so
 * this route shows that page directly instead of a lobby in front of it.
 *
 * The dashboard's header avatar still opens it, unchanged.
 */
export default function ProfileTab() {
  return <SettingsScreen variant="tab" />;
}
