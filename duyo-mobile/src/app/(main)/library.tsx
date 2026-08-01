// Kutubxona — moved out of (tabs) so the Maqsadlar tab could take its slot.
// The screen itself is untouched and fully alive; it is now pushed from the
// home cards instead of living in the tab bar. To restore it as a tab: move
// this file back to (tabs)/library.tsx, re-add `library` to ROUTE_TO_TAB and
// TABS in the two files below, and point the four home hrefs back at
// '/(main)/(tabs)/library'.
//   - src/app/(main)/(tabs)/_layout.tsx
//   - src/components/v2/dark/bottom-nav.tsx
export { default } from '@/screens/library/library-screen';
