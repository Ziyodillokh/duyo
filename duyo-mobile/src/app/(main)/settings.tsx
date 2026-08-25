import { SettingsScreen } from '@/screens/settings/settings-screen';

/**
 * The pushed route — the same screen the Profile tab shows.
 *
 * Kept because gear icons all over the app push `/(main)/settings`, and
 * because as a pushed page "back" means back to wherever you came from,
 * which is not what it means on the tab.
 */
export default function SettingsRoute() {
  return <SettingsScreen variant="page" />;
}
