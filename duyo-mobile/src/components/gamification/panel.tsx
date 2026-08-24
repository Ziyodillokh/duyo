import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { glass } from '@/lib/glass';

const INK = '#22406F';
const MUTED = '#8CA3CB';

// The dashboard's card vocabulary, shared with the cards that fill it.
// These used to be literal navy-gradient values (a 6% white surface, a neon
// border) because CompanionHome painted itself dark; the surface and the
// border now come from `glass()` instead, so only the two ink levels are
// still worth exporting — the sibling cards colour their own text with them.
export const PANEL_TEXT = INK;
export const PANEL_MUTED = MUTED;

interface PanelProps {
  title: string;
  icon?: ReactNode;
  /** Small trailing element — a counter, a badge. */
  trailing?: ReactNode;
  children: ReactNode;
}

export function Panel({ title, icon, trailing, children }: PanelProps) {
  return (
    <View style={[styles.panel, styles.pane]}>
      <View style={styles.head}>
        <View style={styles.heading}>
          {icon}
          <Text style={styles.title}>{title}</Text>
        </View>
        {trailing}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  // A dashboard card: 'md' on the ladder, and the radius that reads as a card
  // rather than as a chip or a sheet.
  pane: glass(20, 'md'),
  panel: { padding: 16 },

  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 14, fontWeight: '700', color: INK },
});
