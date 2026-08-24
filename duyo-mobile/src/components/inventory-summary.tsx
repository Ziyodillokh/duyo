import { router } from 'expo-router';
import { ChevronRight, Sparkles } from 'lucide-react-native';
import { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

import { Text } from '@/components/text';
import { useBalls, useInventory } from '@/hooks/use-gamification';
import { glass, lift } from '@/lib/glass';
import { INVENTORY_ITEMS } from '@/mocks/inventory';

const PRIMARY = '#2F6FE4';
const INK = '#22406F';
const MUTED = '#8CA3CB';
const HAIRLINE = 'rgba(47,111,228,0.10)';

const PREVIEW_LIMIT = 8;

/**
 * Inventar, folded into the profile: balance plus what the child actually owns.
 *
 * Owning is the part that belongs on a profile — it answers "what's mine".
 * Browsing and buying stay on the full inventory screen, reached from here,
 * because that is a shop and does not belong in the middle of a profile.
 */
export function InventorySummary() {
  const balls = useBalls();
  const inventory = useInventory();

  const owned = useMemo(() => {
    const keys = new Set((inventory.data ?? []).map((i) => i.item_key));
    return INVENTORY_ITEMS.filter((item) => keys.has(item.id));
  }, [inventory.data]);

  return (
    <View style={[styles.card, styles.cardPane]}>
      <View style={styles.balanceRow}>
        <Text style={styles.star}>⭐</Text>
        <View style={styles.balanceText}>
          <Text style={styles.balanceLabel}>Balansim</Text>
          {balls.isLoading ? (
            <ActivityIndicator color={PRIMARY} />
          ) : (
            <Text style={styles.balanceValue}>{balls.data?.balance ?? 0}</Text>
          )}
        </View>
        <Pressable
          onPress={() => router.push('/(main)/avatar-customization')}
          accessibilityRole="button"
          accessibilityLabel="Avatar sozlash"
          style={({ pressed }) => [
            styles.avatarButton,
            pressed && styles.pressed,
            styles.focusable,
          ]}
        >
          <Sparkles size={14} color="#FFFFFF" />
          <Text style={styles.avatarLabel}>Avatar</Text>
        </Pressable>
      </View>

      <View style={styles.divider} />

      {owned.length > 0 ? (
        <View style={styles.chips}>
          {owned.slice(0, PREVIEW_LIMIT).map((item) => (
            <View
              key={item.id}
              style={[styles.chip, styles.chipPane]}
              accessibilityLabel={item.name}
            >
              <Text style={styles.chipEmoji}>{item.emoji}</Text>
              <Text style={styles.chipLabel}>{item.name}</Text>
            </View>
          ))}
          {owned.length > PREVIEW_LIMIT ? (
            <View style={[styles.chip, styles.chipPane, styles.chipMore]}>
              <Text style={styles.chipMoreLabel}>
                +{owned.length - PREVIEW_LIMIT}
              </Text>
            </View>
          ) : null}
        </View>
      ) : (
        <Text style={styles.empty}>
          Hali buyum yo'q. Ball to'plab, do'kondan tanla.
        </Text>
      )}

      <Pressable
        onPress={() => router.push('/(main)/inventory')}
        accessibilityRole="button"
        accessibilityLabel="Do'konni ochish"
        style={({ pressed }) => [
          styles.shopLink,
          pressed && styles.pressed,
          styles.focusable,
        ]}
      >
        <Text style={styles.shopLabel}>Do'konga o'tish</Text>
        <ChevronRight size={16} color={PRIMARY} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  focusable: { outlineStyle: 'none', outlineWidth: 0 } as unknown as ViewStyle,
  pressed: { opacity: 0.8 },

  // A card among the profile's other cards — same radius and same rung on the
  // ladder, so the profile reads as one surface family.
  cardPane: glass(22, 'md'),
  card: { padding: 16 },

  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  star: { fontSize: 26 },
  balanceText: { flex: 1 },
  balanceLabel: { fontSize: 14, lineHeight: 20, color: MUTED },
  balanceValue: { fontSize: 22, lineHeight: 28, fontWeight: '700', color: INK },

  // A solid button, not a pane — it takes the light from `lift` alone.
  avatarButton: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: PRIMARY,
    boxShadow: lift('sm'),
  },
  avatarLabel: { fontSize: 14, fontWeight: '500', color: '#FFFFFF' },

  divider: { height: 1, marginVertical: 14, backgroundColor: HAIRLINE },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  // The owned items are drawn on the card, so they sit flush against it.
  chipPane: glass(14, 'flush', 0.5),
  chipMore: { justifyContent: 'center' },
  chipEmoji: { fontSize: 15 },
  chipLabel: { fontSize: 12, lineHeight: 16, color: INK },
  chipMoreLabel: { fontSize: 12, lineHeight: 16, color: MUTED },

  empty: { fontSize: 14, lineHeight: 20, color: MUTED },

  shopLink: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  shopLabel: { fontSize: 14, fontWeight: '500', color: PRIMARY },
});
