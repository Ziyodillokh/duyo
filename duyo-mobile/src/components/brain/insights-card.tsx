import { BrainCircuit } from 'lucide-react-native';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { Text } from '@/components/text';

import type { InsightSummary } from '@/lib/brain-insights';
import { colourForTag } from '@/lib/galaxy-layout';
import { glass, lift } from '@/lib/glass';

/**
 * The "AI insights" card of the mock, kept honest: every sentence it shows is
 * a fact lib/brain-insights.ts computed from the child's real graph, never a
 * generated claim. Tag names are tinted with their map colour so the card and
 * the galaxy speak about the same clusters in the same voice.
 */

export interface InsightsCardProps {
  summary: InsightSummary;
  onExplore: () => void;
  onStartNote: (title: string) => void;
  onNewNote: () => void;
}

const INK = '#22406F';
/** The card's own voice. The map's #C27AFF is mixed for the dark sky and turns
 *  to pastel on a white pane, so the eyebrow and the button take the same hue
 *  several steps deeper. */
const ACCENT = '#7A4BD6';

export function InsightsCard({
  summary,
  onExplore,
  onStartNote,
  onNewNote,
}: InsightsCardProps) {
  const { insight } = summary;

  const { body, action, onPress } = (() => {
    switch (insight.kind) {
      case 'start':
        return {
          body: 'Birinchi qaydingizni yozing — bilim xaritangiz shu yerdan boshlanadi.',
          action: 'Yangi qayd',
          onPress: onNewNote,
        };
      case 'bridge':
        return {
          body: (
            <>
              G'oyalaringiz {summary.clusters} ta to'plamga bog'langan.{' '}
              <Text style={[styles.tag, { color: colourForTag(insight.a) }]}>#{insight.a}</Text>
              {' '}va{' '}
              <Text style={[styles.tag, { color: colourForTag(insight.b) }]}>#{insight.b}</Text>
              {' '}orasida hali bog'lanish yo'q — ularni bog'lab ko'ring.
            </>
          ),
          action: "Xaritada ko'rish",
          onPress: onExplore,
        };
      case 'unwritten':
        return {
          body: `"${insight.title}" ga boshqa qaydlardan havola bor, lekin u hali yozilmagan.`,
          action: 'Yozishni boshlash',
          onPress: () => onStartNote(insight.title),
        };
      case 'hub':
        return {
          body: `"${insight.title}" — xaritangiz markazi: ${insight.links} ta bog'lanish shu qaydga keladi.`,
          action: "Xaritada ko'rish",
          onPress: onExplore,
        };
      // The fallback doubles as default so the switch always yields a card.
      default:
        return {
          body: `${summary.notes} ta qayd va ${summary.links} ta bog'lanish — xaritangiz o'sib bormoqda.`,
          action: "Xaritada ko'rish",
          onPress: onExplore,
        };
    }
  })();

  return (
    <View style={[glass(22, 'md'), styles.card]}>
      <View style={styles.header}>
        <BrainCircuit size={14} color={ACCENT} />
        <Text style={styles.eyebrow}>TAHLIL</Text>
      </View>
      <Text style={styles.body}>{body}</Text>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={action}
        style={({ pressed }) => [
          styles.action,
          pressed && styles.pressed,
          styles.focusable,
        ]}
      >
        <Text style={styles.actionLabel}>{action}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  focusable: { outlineStyle: 'none', outlineWidth: 0 } as unknown as ViewStyle,

  card: { width: '100%', padding: 16 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: ACCENT },

  body: { fontSize: 14, lineHeight: 21, color: INK },
  // A map colour is mixed to glow on deep space; carried onto glass it needs
  // the extra weight to stay legible while keeping the tag's identity.
  tag: { fontWeight: '600' },

  // The button is tinted rather than frosted: it speaks with the card's accent,
  // so it takes its own fill and borrows only the light — 'sm', because it sits
  // ON the card and must not cast the card's shadow.
  action: {
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(122,75,214,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(122,75,214,0.22)',
    boxShadow: lift('sm'),
  },
  actionLabel: { fontSize: 12, fontWeight: '600', color: ACCENT },
  pressed: { opacity: 0.7 },
});
