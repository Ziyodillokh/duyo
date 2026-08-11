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
