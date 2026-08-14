import {
  BookOpen,
  Compass,
  FileText,
  GraduationCap,
  Heart,
  User,
} from 'lucide-react-native';

import { type MemoryCategory } from '@/lib/memory-db';

// Matches the `typeof Download`-style icon typing already used in
// settings-privacy.tsx — lucide-react-native does not export a standalone
// `LucideIcon` type from its public entry point.
type IconType = typeof User;

export const MEMORY_CATEGORY_LABELS: Record<MemoryCategory, string> = {
  profile: 'Profil',
  preferences: 'Yoqtirganlarim',
  interests: 'Qiziqishlarim',
  learning: "O'qish",
  research: 'Ilmiy ish',
  notes: 'Boshqa',
};

export const MEMORY_CATEGORY_ICONS: Record<MemoryCategory, IconType> = {
  profile: User,
  preferences: Heart,
  interests: Compass,
  learning: GraduationCap,
  research: BookOpen,
  notes: FileText,
};

/**
 * One accent per category, from the app's neon palette (tailwind.config.js).
 *
 * Colour is what makes a list of memories scannable — a child recognises
 * "the pink ones are things I like" long before they read the labels.
 */
export const MEMORY_CATEGORY_COLOURS: Record<MemoryCategory, string> = {
  profile: '#60A5FA',      // neon-blue
  preferences: '#FB64B6',  // neon-pink
  interests: '#05DF72',    // neon-green
  learning: '#FDC700',     // neon-yellow
  research: '#C27AFF',     // dark-heading purple
  notes: '#94A3B8',        // dark-muted
};

/** A short line telling the child WHY this kind of thing is worth keeping. */
export const MEMORY_CATEGORY_HINTS: Record<MemoryCategory, string> = {
  profile: 'Sen haqingda',
  preferences: 'Yoqtirgan narsang',
  interests: 'Qiziqishing',
  learning: "O'qishing haqida",
  research: 'Ilmiy ishing',
  notes: 'Eslatma',
};
