import { Hash } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/text';

/**
 * A #tag as a compact chip — the landmark for one cluster of notes, with how
 * much is filed under it.
 *
 * ## Why this is a chip in a strip and no longer a card over the map
 *
 * These used to be six 132px cards pinned to the canvas edges, on the theory
 * that gravity keeps the notes gathered in the middle so the edges are empty.
 * On a real phone with real notes that theory does not hold: the cards landed
 * squarely on top of planets AND on top of the map's own tag labels, so the
 * thing meant to help you find a cluster was hiding the cluster.
 *
 * A single scrolling strip costs one line of height, covers nothing, and has
 * no six-item limit — every tag gets a chip instead of the first six.
 */

export interface ClusterStats {
  tag: string;
  colour: string;
  notes: number;
  links: number;
}

interface ClusterCardProps {
  cluster: ClusterStats;
  active: boolean;
  onPress: () => void;
  onLongPress: () => void;
}

export function BrainClusterCard({
  cluster,
  active,
  onPress,
  onLongPress,
}: ClusterCardProps) {
  const { tag, colour, notes, links } = cluster;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`#${tag} to'plami — ${notes} qayd, ${links} bog'lam`}
      className="flex-row items-center gap-1.5 active:opacity-80"
      style={{
        borderRadius: 999,
        paddingLeft: 7,
        paddingRight: 11,
        paddingVertical: 6,
        borderWidth: 1,
        // Dark enough to read a label on, sheer enough that the sky behind it
        // still shows through.
        backgroundColor: active ? `${colour}26` : 'rgba(11, 16, 32, 0.72)',
        borderColor: active ? colour : 'rgba(150, 180, 255, 0.18)',
      }}
    >
      <View
        className="items-center justify-center"
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          backgroundColor: `${colour}2E`,
        }}
      >
        <Hash size={11} color={colour} strokeWidth={2.6} />
      </View>

      <Text
        numberOfLines={1}
        className="text-[13px] font-semibold"
        style={{ color: active ? colour : '#DCE6FA', maxWidth: 120 }}
      >
        {tag}
      </Text>

      {/* The count only — "0 qayd / 0 bog'lam" on two lines was most of the
          old card's height for information a single number carries. */}
      <Text
        className="text-[11px]"
        style={{ color: '#8FA3C8', fontVariant: ['tabular-nums'] }}
      >
        {notes}
      </Text>
    </Pressable>
  );
}
