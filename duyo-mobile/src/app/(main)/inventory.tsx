// Inventar — moved out of (tabs) and folded under Profil: it answers "what do
// I have", which is the same question the profile answers, and the freed slot
// went to the Miya note graph. Reached from the Profil screen and the home
// cards; the screen itself is unchanged.
// To restore it as a tab: move the screen back to (tabs)/inventory.tsx, re-add
// `inventory` to ROUTE_TO_TAB and TABS, and point the home hrefs back at
// '/(main)/(tabs)/inventory'.
//   - src/app/(main)/(tabs)/_layout.tsx
//   - src/components/v2/dark/bottom-nav.tsx
export { default } from '@/screens/inventory/inventory-screen';
