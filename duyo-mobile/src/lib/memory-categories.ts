import {
  BookOpen,
  Compass,
  FileText,
  GraduationCap,
  Heart,
  User,
} from 'lucide-react-native';

import type { TranslationKey } from '@/i18n';
import { type MemoryCategory } from '@/lib/memory-db';

// Matches the `typeof Download`-style icon typing already used in
// settings-privacy.tsx — lucide-react-native does not export a standalone
// `LucideIcon` type from its public entry point.
type IconType = typeof User;

/**
 * Keys, not finished text. This table is built once when the module is
 * evaluated, so a resolved label could never follow a language switch —
 * every screen calls `t()` on it at render instead.
 */
export const MEMORY_CATEGORY_LABELS: Record<MemoryCategory, TranslationKey> = {
  profile: 'memory.cat.profile',
  preferences: 'memory.cat.preferences',
  interests: 'memory.cat.interests',
  learning: 'memory.cat.learning',
  research: 'memory.cat.research',
  notes: 'memory.cat.notes',
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
export const MEMORY_CATEGORY_HINTS: Record<MemoryCategory, TranslationKey> = {
  profile: 'memory.hint.profile',
  preferences: 'memory.hint.preferences',
  interests: 'memory.hint.interests',
  learning: 'memory.hint.learning',
  research: 'memory.hint.research',
  notes: 'memory.hint.notes',
};
