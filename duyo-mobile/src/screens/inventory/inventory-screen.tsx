import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Plus, Sparkles } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { Text } from '@/components/text';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  type InventoryCategory,
  type InventoryItem,
  INVENTORY_CATEGORIES,
  itemsByCategory,
} from '@/mocks/inventory';
import { glass, lift } from '@/lib/glass';
import { useBalls, useInventory, usePurchaseItem } from '@/hooks/use-gamification';

// ── The glass sky, the inner screens' cooler morning ─────────────────────────
// Same family as settings, dtm and goal-mates: frosted panes on pale blue.
const PRIMARY = '#2F6FE4';
const TITLE = '#2A63DC';
const INK = '#22406F';
const MUTED = '#8CA3CB';
const GREEN = '#22B573';
const BG_TOP = '#E3EFFF';
const BG_MID = '#EAF3FF';
const BG_BOTTOM = '#EDF2FD';
/** The premium border. The mock's neon gold read as a highlighter on a pale
 *  page, so it is dropped to a metal that still says "special". */
const GOLD = '#D9A21B';

// The CATALOG (names/emojis/prices) is static product config; ownership and
// balance come from the backend. An item is "owned" when its key is in the
// inventory set returned by the API.

interface InventoryCardProps {
  item: InventoryItem;
  owned: boolean;
  onPress: () => void;
}

function InventoryCard({ item, owned, onPress }: InventoryCardProps) {
  const premium = item.isPremium ?? false;

  // Owned outranks premium: what the child already has is the more useful
  // thing to see at a glance. Same precedence the neon build had.
  const accent = owned ? styles.cardOwned : premium ? styles.cardPremium : null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={item.name}
      style={({ pressed }) => [
        glass(20, 'md', 0.62),
        styles.card,
        accent,
        pressed && styles.pressed,
        styles.focusable,
      ]}
    >
      <View style={styles.cardInner}>
        <LinearGradient
          colors={['rgba(47,111,228,0.12)', 'rgba(252,211,77,0.20)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.preview}
        >
          {owned ? (
            <Text style={[styles.previewEmoji, styles.previewCheck]}>✓</Text>
          ) : (
            <Text style={styles.previewEmoji}>{item.emoji}</Text>
          )}
        </LinearGradient>
        <Text style={styles.itemName} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={styles.itemTagRow}>
          {owned ? (
            <View style={styles.itemTag}>
              <Text style={styles.itemTagText}>Egallangan</Text>
            </View>
          ) : (
            <View style={[styles.itemTag, styles.itemPrice]}>
              <Text style={styles.itemPriceStar}>⭐</Text>
              <Text style={styles.itemTagText}>{item.price}</Text>
            </View>
          )}
        </View>
        {/* `? :`, not `&&`: an occasion that came back as an empty string
            would reach React as a text node, a hard error on the web build. */}
        {item.occasion ? (
          <Text style={styles.itemOccasion}>{item.occasion}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export default function InventoryScreen() {
  const [selectedCategory, setSelectedCategory] =
    useState<InventoryCategory | null>(null);

  const ballsQuery = useBalls();
  const inventoryQuery = useInventory();
  const purchase = usePurchaseItem();

  const balance = ballsQuery.data?.balance ?? 0;
  const ownedKeys = useMemo(
    () => new Set((inventoryQuery.data ?? []).map((i) => i.item_key)),
    [inventoryQuery.data],
  );

  const items = useMemo(
    () => itemsByCategory(selectedCategory),
    [selectedCategory],
  );

  const handleItemPress = (item: InventoryItem) => {
    if (ownedKeys.has(item.id)) {
      Alert.alert(item.name, "Bu narsa siznikida. Avatar'ga qo'shilsinmi?");
      return;
    }
    const cost = item.price ?? 0;
    if (balance < cost) {
      Alert.alert(item.name, `${cost} XP kerak. Balans yetishmaydi.`);
      return;
    }
    Alert.alert(item.name, `${cost} XP sotib olamiz?`, [
      { text: 'Bekor', style: 'cancel' },
      {
        text: 'Sotib olish',
        onPress: () => {
          purchase.mutate(
            { item_key: item.id, category: item.category, cost },
            {
              onError: () =>
                Alert.alert(
                  'Xatolik',
                  "Sotib olishda muammo. Qayta urinib ko'ring.",
                ),
            },
          );
        },
      },
    ]);
  };

  const loading = ballsQuery.isLoading || inventoryQuery.isLoading;

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[BG_TOP, BG_MID, BG_BOTTOM]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.root} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.page}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.screenTitle}>Inventar</Text>

          {/* The balance is the one thing this screen leads with — 'lg', the
              only object on the page allowed that high off it. */}
          <View style={[glass(28, 'lg', 0.62), styles.balance]}>
            <View style={styles.balanceLeft}>
              <View style={styles.balanceWell}>
                <Text style={styles.balanceStar}>⭐</Text>
              </View>
              <View>
                <Text style={styles.balanceLabel}>Balansim</Text>
                {ballsQuery.isLoading ? (
                  <ActivityIndicator color={PRIMARY} />
                ) : (
                  <Text style={styles.balanceValue}>{balance}</Text>
                )}
              </View>
            </View>
            <Pressable
              onPress={() =>
                Alert.alert('Tez orada', "Ball suhbat orqali to'planadi")
              }
              accessibilityRole="button"
              accessibilityLabel="Ball olish"
              style={({ pressed }) => [
                styles.earn,
                pressed && styles.pressed,
                styles.focusable,
              ]}
            >
              <Plus size={16} color={PRIMARY} strokeWidth={2.2} />
              <Text style={styles.earnText}>Ball olish</Text>
            </Pressable>
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
            <Sparkles size={16} color="#FFFFFF" />
            <Text style={styles.avatarButtonText}>Avatar sozlash</Text>
          </Pressable>

          <View style={[glass(18, 'md', 0.5), styles.tabs]}>
            <Pressable
              onPress={() => setSelectedCategory(null)}
              accessibilityRole="tab"
              accessibilityState={{ selected: selectedCategory === null }}
              accessibilityLabel="Barchasi"
              style={[
                styles.tab,
                selectedCategory === null && styles.tabOn,
                styles.focusable,
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  selectedCategory === null && styles.tabTextOn,
                ]}
              >
                Barchasi
              </Text>
            </Pressable>
            {INVENTORY_CATEGORIES.map((cat) => {
              const sel = selectedCategory === cat.key;
              return (
                <Pressable
                  key={cat.key}
                  onPress={() => setSelectedCategory(cat.key)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: sel }}
                  accessibilityLabel={cat.label}
                  style={[styles.tab, sel && styles.tabOn, styles.focusable]}
                >
                  <Text style={styles.tabEmoji}>{cat.emoji}</Text>
                </Pressable>
              );
            })}
          </View>

          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={PRIMARY} />
            </View>
          ) : (
            <View style={styles.grid}>
              {items.map((item) => (
                <View key={item.id} style={styles.gridCell}>
                  <InventoryCard
                    item={item}
                    owned={ownedKeys.has(item.id)}
                    onPress={() => handleItemPress(item)}
                  />
                </View>
              ))}
            </View>
          )}

          {!loading && items.length === 0 && (
            <View style={[glass(28, 'lg', 0.6), styles.statusCard]}>
              <Text style={styles.statusEmoji}>📦</Text>
              <Text style={styles.statusTitle}>Hech narsa yo'q</Text>
              <Text style={styles.statusBody}>
                Bu kategoriyada hech narsa topilmadi
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // The browser's default focus ring is a square drawn around a rounded
  // control. RN's ViewStyle has no outline, so this is a web-only escape;
  // native ignores unknown keys.
  focusable: { outlineStyle: 'none', outlineWidth: 0 } as unknown as ViewStyle,
  pressed: { opacity: 0.85 },

  page: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 96,
    gap: 16,
  },
  screenTitle: {
    paddingHorizontal: 4,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: TITLE,
  },

  balance: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 18,
  },
  balanceLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  balanceWell: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(252,211,77,0.28)',
  },
  balanceStar: { fontSize: 26 },
  balanceLabel: { fontSize: 13.5, color: MUTED },
  balanceValue: {
    marginTop: 2,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.4,
    color: TITLE,
  },
  // Drawn on the hero pane, so it casts no shadow of its own: a control that
  // shadows the card it belongs to is the tell that depth is being stacked.
  earn: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(47,111,228,0.10)',
  },
  earnText: { fontSize: 13.5, fontWeight: '600', color: PRIMARY },

  // A raised button on the glass page: the same shadow ladder as every other
  // object, so the eye can tell how high it sits relative to the cards near it.
  avatarButton: {
    height: 46,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: PRIMARY,
    boxShadow: lift('md'),
  },
  avatarButtonText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },

  tabs: { flexDirection: 'row', padding: 4, gap: 4 },
  tab: {
    flex: 1,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The thumb of a segmented control rests ON the track — 'sm', the lowest
  // thing on the page that is still an object.
  tabOn: { backgroundColor: PRIMARY, boxShadow: lift('sm') },
  tabText: { fontSize: 13.5, fontWeight: '600', color: INK },
  tabTextOn: { color: '#FFFFFF' },
  tabEmoji: { fontSize: 16 },

  loading: { alignItems: 'center', padding: 32 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gridCell: { width: '47.5%' },

  card: { flex: 1 },
  cardOwned: { borderColor: GREEN, borderWidth: 1.7 },
  cardPremium: { borderColor: GOLD, borderWidth: 1.7 },
  cardInner: { padding: 14 },
  preview: {
    height: 118,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewEmoji: { fontSize: 36 },
  previewCheck: { color: GREEN, fontWeight: '700' },
  itemName: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
    color: INK,
    textAlign: 'center',
  },
  itemTagRow: { alignItems: 'center', marginTop: 10 },
  // Drawn on the card, so edges only and no drop shadow.
  itemTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(47,111,228,0.12)',
  },
  itemPrice: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  itemPriceStar: { fontSize: 11 },
  itemTagText: { fontSize: 12, fontWeight: '600', color: INK },
  itemOccasion: {
    marginTop: 8,
    fontSize: 12,
    color: MUTED,
    textAlign: 'center',
  },

  statusCard: { alignItems: 'center', padding: 28 },
  statusEmoji: { fontSize: 38 },
  statusTitle: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '700',
    color: INK,
    textAlign: 'center',
  },
  statusBody: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: MUTED,
    textAlign: 'center',
  },
});
