import { BrainCircuit } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/text';

import type { InsightSummary } from '@/lib/brain-insights';
import { colourForTag } from '@/lib/galaxy-layout';

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

const ACCENT = '#C27AFF';

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
              <Text style={{ color: colourForTag(insight.a) }}>#{insight.a}</Text>
              {' '}va{' '}
              <Text style={{ color: colourForTag(insight.b) }}>#{insight.b}</Text>
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
    <View
      className="w-full rounded-2xl"
      style={{
        backgroundColor: 'rgba(11, 16, 32, 0.72)',
        borderColor: 'rgba(150, 180, 255, 0.18)',
        borderWidth: 1,
        padding: 16,
      }}
    >
      <View className="flex-row items-center gap-2 mb-2">
        <BrainCircuit size={14} color={ACCENT} />
        <Text
          className="font-bold"
          style={{ color: ACCENT, fontSize: 10, letterSpacing: 2 }}
        >
          TAHLIL
        </Text>
      </View>
      <Text style={{ color: '#E8EEFF', fontSize: 14, lineHeight: 21 }}>
        {body}
      </Text>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={action}
        className="self-start rounded-md px-3 py-2 mt-3 active:opacity-70"
        style={{ backgroundColor: 'rgba(194,122,255,0.16)' }}
      >
        <Text style={{ color: ACCENT, fontSize: 12 }}>{action}</Text>
      </Pressable>
    </View>
  );
}
