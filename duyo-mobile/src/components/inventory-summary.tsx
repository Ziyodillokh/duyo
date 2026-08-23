import { router } from 'expo-router';
import { ChevronRight, Sparkles } from 'lucide-react-native';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Text } from '@/components/text';

import { useBalls, useInventory } from '@/hooks/use-gamification';
import { INVENTORY_ITEMS } from '@/mocks/inventory';
import { useIsDark } from '@/store/theme';

const PREVIEW_LIMIT = 8;

/**
 * Inventar, folded into the profile: balance plus what the child actually owns.
 *
 * Owning is the part that belongs on a profile — it answers "what's mine".
 * Browsing and buying stay on the full inventory screen, reached from here,
 * because that is a shop and does not belong in the middle of a profile.
 */
export function InventorySummary() {
  const isDark = useIsDark();
  const balls = useBalls();
  const inventory = useInventory();

  const owned = useMemo(() => {
    const keys = new Set((inventory.data ?? []).map((i) => i.item_key));
    return INVENTORY_ITEMS.filter((item) => keys.has(item.id));
  }, [inventory.data]);

  const chipBg = isDark ? '#1E3A5F' : '#F1F5F9';

  return (
    <View
      className="rounded-xl border border-neon-blue/20"
      style={{ padding: 16, backgroundColor: isDark ? '#132340' : '#FFFFFF' }}
    >
      <View className="flex-row items-center gap-3">
        <Text style={{ fontSize: 26 }}>⭐</Text>
        <View className="flex-1">
          <Text className="text-sm text-muted-foreground dark:text-dark-muted">
            Balansim
          </Text>
          {balls.isLoading ? (
            <ActivityIndicator color={isDark ? '#E0E7FF' : '#102033'} />
          ) : (
            <Text className="text-[22px] leading-7 font-bold text-foreground dark:text-dark-text">
              {balls.data?.balance ?? 0}
            </Text>
          )}
        </View>
        <Pressable
          onPress={() => router.push('/(main)/avatar-customization')}
          accessibilityRole="button"
          accessibilityLabel="Avatar sozlash"
          className="rounded-md bg-neon-blue flex-row items-center gap-1.5 active:opacity-80"
          style={{ paddingHorizontal: 12, height: 34 }}
        >
          <Sparkles size={14} color="#0A1628" />
          <Text className="text-sm font-medium" style={{ color: '#0A1628' }}>
            Avatar
          </Text>
        </Pressable>
      </View>

      <View
        style={{
          height: 1,
          backgroundColor: 'rgba(96,165,250,0.15)',
          marginVertical: 14,
        }}
      />

      {owned.length > 0 ? (
        <View className="flex-row flex-wrap gap-2">
          {owned.slice(0, PREVIEW_LIMIT).map((item) => (
            <View
              key={item.id}
              className="rounded-md flex-row items-center gap-1.5"
              style={{ backgroundColor: chipBg, paddingHorizontal: 10, paddingVertical: 7 }}
              accessibilityLabel={item.name}
            >
              <Text style={{ fontSize: 15 }}>{item.emoji}</Text>
              <Text className="text-xs text-foreground dark:text-dark-text">
                {item.name}
              </Text>
            </View>
          ))}
          {owned.length > PREVIEW_LIMIT && (
            <View
              className="rounded-md items-center justify-center"
              style={{ backgroundColor: chipBg, paddingHorizontal: 10, paddingVertical: 7 }}
            >
              <Text className="text-xs text-muted-foreground dark:text-dark-muted">
                +{owned.length - PREVIEW_LIMIT}
              </Text>
            </View>
          )}
        </View>
      ) : (
        <Text className="text-sm text-muted-foreground dark:text-dark-muted">
          Hali buyum yo'q. Ball to'plab, do'kondan tanla.
        </Text>
      )}

      <Pressable
        onPress={() => router.push('/(main)/inventory')}
        accessibilityRole="button"
        accessibilityLabel="Do'konni ochish"
        className="flex-row items-center justify-center gap-1 active:opacity-80"
        style={{ marginTop: 14 }}
      >
        <Text className="text-sm font-medium text-neon-blue">
          Do'konga o'tish
        </Text>
        <ChevronRight size={16} color="#60A5FA" />
      </Pressable>
    </View>
  );
}
