import { Hash } from 'lucide-react-native';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { Text } from '@/components/text';

import { lift } from '@/lib/glass';

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
 *
 * ## Why this one chip is still dark
 *
 * Its siblings on the Miya page are frosted white, but this strip floats over
 * the map, and the map is deep space in both themes. A white pane there would
 * punch holes in the sky. So the chip keeps a dark ground and takes only the
 * light from the shared ladder — `lift('sm')`, the height of a chip, so it
 * sits at the same distance off the page as every other chip in the app.
 */

/** Dark enough to read a label on, sheer enough that the sky behind it still
 *  shows through. */
const SHEER_DARK = 'rgba(11, 16, 32, 0.72)';
const HAIRLINE = 'rgba(150, 180, 255, 0.18)';
const LABEL = '#DCE6FA';
const MUTED = '#8FA3C8';

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
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: active ? `${colour}26` : SHEER_DARK,
          borderColor: active ? colour : HAIRLINE,
        },
        pressed && styles.pressed,
        styles.focusable,
      ]}
    >
      {/* The well is part of the chip, so it carries no shadow of its own — a
          surface that casts a shadow onto the thing it sits in reads as loose. */}
      <View style={[styles.well, { backgroundColor: `${colour}2E` }]}>
        <Hash size={11} color={colour} strokeWidth={2.6} />
      </View>

      <Text
        numberOfLines={1}
        style={[styles.label, { color: active ? colour : LABEL }]}
      >
        {tag}
      </Text>

      {/* The count only — "0 qayd / 0 bog'lam" on two lines was most of the
          old card's height for information a single number carries. */}
      <Text style={styles.count}>{notes}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  focusable: { outlineStyle: 'none', outlineWidth: 0 } as unknown as ViewStyle,

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingLeft: 7,
    paddingRight: 11,
    paddingVertical: 6,
    borderWidth: 1,
    boxShadow: lift('sm'),
  },
  pressed: { opacity: 0.8 },

  well: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  label: { fontSize: 13, fontWeight: '600', maxWidth: 120 },
  count: { fontSize: 11, color: MUTED, fontVariant: ['tabular-nums'] },
});
