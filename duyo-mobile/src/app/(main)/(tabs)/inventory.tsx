import { useIsDark } from '@/store/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Coins, Plus, Sparkles } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  type InventoryCategory,
  type InventoryItem,
  INVENTORY_CATEGORIES,
  isOwned,
  itemsByCategory,
  MOCK_BALANCE,
} from '@/mocks/inventory';

interface InventoryCardProps {
  item: InventoryItem;
  onPress: () => void;
}

function InventoryCard({ item, onPress }: InventoryCardProps) {
  const isDark = useIsDark();
  const owned = isOwned(item);
  const premium = item.isPremium ?? false;

  const cardClassName = owned
    ? ''
    : premium
      ? ''
      : 'bg-card dark:bg-dark-surface border-neon-blue/20';
  const cardStyle = owned
    ? {
        backgroundColor: 'rgba(52, 211, 153, 0.10)',
        borderColor: '#34D399',
        borderWidth: 1.7,
      }
    : premium
      ? {
          backgroundColor: 'rgba(252, 211, 77, 0.10)',
          borderColor: '#FCD34D',
          borderWidth: 1.7,
        }
      : { borderWidth: 1 };

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={item.name}
      className={`rounded-xl active:opacity-80 ${cardClassName}`}
      style={[{ flex: 1 }, cardStyle]}
    >
      <View style={{ padding: 16 }}>
        <LinearGradient
          colors={['rgba(96, 165, 250, 0.20)', 'rgba(252, 211, 77, 0.20)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            height: 118,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {owned ? (
            <Text className="text-4xl" style={{ color: isDark ? '#E0E7FF' : '#102033' }}>
              ✓
            </Text>
          ) : (
            <Text className="text-4xl">{item.emoji}</Text>
          )}
        </LinearGradient>
        <Text
          className="text-sm font-medium text-foreground dark:text-dark-text text-center mt-3"
          numberOfLines={1}
        >
          {item.name}
        </Text>
        <View className="items-center mt-3">
          {owned ? (
            <View
              className="rounded-md"
              style={{
                backgroundColor: isDark ? '#1E3A5F' : '#FFFFFF',
                paddingHorizontal: 9,
                paddingVertical: 3,
              }}
            >
              <Text className="text-xs font-medium text-foreground dark:text-dark-text">
                Egallangan
              </Text>
            </View>
          ) : (
            <View
              className="flex-row items-center gap-1 rounded-md border border-neon-blue/20"
              style={{ paddingHorizontal: 9, paddingVertical: 3 }}
            >
              <Coins size={12} color="#FCD34D" />
              <Text className="text-xs font-medium text-foreground dark:text-dark-text">
                {item.price}
              </Text>
            </View>
          )}
        </View>
        {item.occasion && (
          <Text className="text-xs text-muted-foreground dark:text-dark-muted text-center mt-2">
            {item.occasion}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

export default function InventoryScreen() {
  const isDark = useIsDark();
  const [selectedCategory, setSelectedCategory] =
    useState<InventoryCategory | null>(null);
  const items = useMemo(
    () => itemsByCategory(selectedCategory),
    [selectedCategory],
  );

  const handleItemPress = (item: InventoryItem) => {
    if (isOwned(item)) {
      Alert.alert(item.name, "Bu narsa siznikida. Avatar'ga qo'shilsinmi?");
    } else {
      const canAfford = MOCK_BALANCE >= (item.price ?? 0);
      Alert.alert(
        item.name,
        canAfford
          ? `${item.price} XP sotib olamiz?`
          : `${item.price} XP kerak. Balans yetishmaydi.`,
      );
    }
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? '#0A1628' : '#F4F8FF' }]} />
      <LinearGradient
        colors={['rgba(96, 165, 250, 0.20)', 'rgba(252, 211, 77, 0.20)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.96, y: 0.2 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          contentContainerStyle={{ padding: 24, gap: 16, paddingBottom: 96 }}
          showsVerticalScrollIndicator={false}
        >
          <Text className="text-[24px] leading-8 font-bold text-foreground dark:text-dark-text tracking-tight">
            Inventar
          </Text>

          <View
            className="rounded-xl border border-neon-blue/20 overflow-hidden"
          >
            <LinearGradient
              colors={['rgba(70, 25, 1, 0.50)', 'rgba(67, 32, 4, 0.50)']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={{ padding: 16 }}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-3">
                  <View
                    className="rounded-full items-center justify-center"
                    style={{
                      width: 48,
                      height: 48,
                      backgroundColor: '#FCD34D',
                    }}
                  >
                    <Coins size={24} color="#0A1628" />
                  </View>
                  <View>
                    <Text className="text-sm text-muted-foreground dark:text-dark-muted">Balansim</Text>
                    <Text className="text-[24px] leading-8 font-bold text-foreground dark:text-dark-text tracking-tight">
                      {MOCK_BALANCE}
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={() =>
                    Alert.alert('Tez orada', "Ball olish Faza 1'da qo'shiladi")
                  }
                  accessibilityRole="button"
                  accessibilityLabel="Ball olish"
                  className="rounded-md flex-row items-center gap-1 active:opacity-80"
                  style={{ paddingHorizontal: 12, paddingVertical: 8 }}
                >
                  <Plus size={16} color={isDark ? '#E0E7FF' : '#102033'} />
                  <Text className="text-sm font-medium text-foreground dark:text-dark-text">
                    Ball olish
                  </Text>
                </Pressable>
              </View>
            </LinearGradient>
          </View>

          <Pressable
            onPress={() => router.push('/(main)/avatar-customization')}
            accessibilityRole="button"
            accessibilityLabel="Avatar sozlash"
            className="rounded-md bg-neon-blue items-center justify-center flex-row gap-2 active:opacity-80"
            style={{ height: 36 }}
          >
            <Sparkles size={16} color="#0A1628" />
            <Text
              className="text-sm font-medium"
              style={{ color: '#0A1628' }}
            >
              Avatar sozlash
            </Text>
          </Pressable>

          <View
            className="flex-row rounded-2xl"
            style={{ backgroundColor: isDark ? '#1E3A5F' : '#FFFFFF', padding: 3 }}
          >
            <Pressable
              onPress={() => setSelectedCategory(null)}
              accessibilityRole="tab"
              accessibilityState={{ selected: selectedCategory === null }}
              accessibilityLabel="Barchasi"
              className={`flex-1 rounded-2xl items-center justify-center ${
                selectedCategory === null ? 'bg-neon-blue' : ''
              }`}
              style={{ paddingVertical: 5 }}
            >
              <Text
                className="text-sm font-medium"
                style={{
                  color: selectedCategory === null ? '#0A1628' : isDark ? '#E0E7FF' : '#102033',
                }}
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
                  className={`flex-1 rounded-2xl items-center justify-center ${
                    sel ? 'bg-neon-blue' : ''
                  }`}
                  style={{ paddingVertical: 5 }}
                >
                  <Text className="text-base">{cat.emoji}</Text>
                </Pressable>
              );
            })}
          </View>

          <View className="flex-row flex-wrap" style={{ gap: 12 }}>
            {items.map((item) => (
              <View key={item.id} style={{ width: '47.5%' }}>
                <InventoryCard
                  item={item}
                  onPress={() => handleItemPress(item)}
                />
              </View>
            ))}
          </View>

          {items.length === 0 && (
            <View
              className="rounded-xl border border-neon-blue/20 items-center"
              style={{ padding: 32 }}
            >
              <Text className="text-4xl">📦</Text>
              <Text className="text-base font-medium text-foreground dark:text-dark-text mt-2">
                Hech narsa yo'q
              </Text>
              <Text className="text-sm text-muted-foreground dark:text-dark-muted mt-1 text-center">
                Bu kategoriyada hech narsa topilmadi
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
