import { Hash } from 'lucide-react-native';
import { Pressable, Text, View, type ViewStyle } from 'react-native';

/**
 * A #tag as a card floating over the map — the landmark for one cluster of
 * notes, showing how much is filed under it and how tightly it is linked.
 *
 * Anchored to the canvas edges rather than to the tag's star: the stars drift
 * (see lib/graph-physics.ts), and a label that chased one around would be
 * unreadable and untappable. The edges are also where the sky is emptiest,
 * because gravity keeps the notes gathered in the middle.
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
  /** Which edge of the map this card is pinned to. */
  position: ViewStyle;
}

export function BrainClusterCard({
  cluster,
  active,
  onPress,
  onLongPress,
  position,
}: ClusterCardProps) {
  const { tag, colour, notes, links } = cluster;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`#${tag} to'plami — ${notes} qayd, ${links} bog'lam`}
      style={[
        position,
        {
          position: 'absolute',
          width: 132,
          borderRadius: 14,
          paddingHorizontal: 10,
          paddingVertical: 9,
          borderWidth: 1,
          // Dark enough to read a label on, sheer enough that the sky behind
          // it still shows through.
          backgroundColor: active ? `${colour}1F` : 'rgba(11, 16, 32, 0.72)',
          borderColor: active ? colour : 'rgba(150, 180, 255, 0.18)',
        },
      ]}
      className="active:opacity-80"
    >
      <View className="flex-row items-center gap-2">
        <View
          className="w-6 h-6 rounded-md items-center justify-center"
          style={{ backgroundColor: `${colour}26` }}
        >
          <Hash size={13} color={colour} strokeWidth={2.5} />
        </View>
        <Text
          numberOfLines={1}
          className="flex-1 text-[13px] font-semibold"
          style={{ color: active ? colour : '#DCE6FA' }}
        >
          {tag}
        </Text>
      </View>

      <Text className="text-[11px] mt-1.5" style={{ color: '#8FA3C8' }}>
        {notes} qayd
      </Text>
      <Text className="text-[11px]" style={{ color: '#8FA3C8' }}>
        {links} bog'lam
      </Text>
    </Pressable>
  );
}

