import { useIsDark } from '@/store/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ArrowLeft, Check, Crown, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface PricingTier {
  key: string;
  name: string;
  priceMonthly: number;
  description: string;
  features: ReadonlyArray<{ text: string; included: boolean }>;
  highlight?: boolean;
}

const TIERS: ReadonlyArray<PricingTier> = [
  {
    key: 'kid',
    name: 'Bolalardosh',
    priceMonthly: 0,
    description: 'Bepul, 10 oygacha',
    features: [
      { text: '30 ta suhbat/kun', included: true },
      { text: 'Asosiy mavzular', included: true },
      { text: 'Standart ovoz', included: true },
      { text: 'Kutubxona (kichik)', included: true },
      { text: 'DTM tayyorgarlik', included: false },
      { text: 'Premium avatar', included: false },
    ],
  },
  {
    key: 'friend',
    name: "Do'st",
    priceMonthly: 29000,
    description: 'Hozirgi rejangiz',
    highlight: true,
    features: [
      { text: 'Cheksiz suhbat', included: true },
      { text: 'Barcha mavzular', included: true },
      { text: '5 ta DUYO ovozi', included: true },
      { text: 'To\'liq kutubxona', included: true },
      { text: 'DTM tayyorgarlik', included: true },
      { text: 'Premium avatar', included: false },
    ],
  },
  {
    key: 'premium',
    name: 'Premium',
    priceMonthly: 49000,
    description: "Eng to'liq imkoniyat",
    features: [
      { text: 'Cheksiz suhbat', included: true },
      { text: 'Barcha mavzular', included: true },
      { text: '10+ DUYO ovozi', included: true },
      { text: 'To\'liq kutubxona', included: true },
      { text: 'DTM + IELTS', included: true },
      { text: 'Premium avatar', included: true },
    ],
  },
];

export default function SubscriptionScreen() {
  const isDark = useIsDark();
  const [selected, setSelected] = useState<string>('friend');

  const selectedTier = TIERS.find((t) => t.key === selected);

  const handleContinue = () => {
    if (selectedTier && selectedTier.key !== 'friend') {
      router.push({
        pathname: '/(main)/payment',
        params: { tier: selectedTier.key },
      });
    } else {
      router.back();
    }
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? '#0A1628' : '#F4F8FF' }]} />
      <LinearGradient
        colors={['rgba(252, 211, 77, 0.20)', 'rgba(96, 165, 250, 0.20)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View className="flex-row items-center gap-3 px-6 py-4">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Orqaga"
            className="w-10 h-10 items-center justify-center"
          >
            <ArrowLeft size={20} color={isDark ? '#E0E7FF' : '#102033'} />
          </Pressable>
          <Text className="text-xl font-bold text-foreground dark:text-dark-text">
            DUYO Premium
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 24, gap: 16, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          <View
            className="rounded-xl overflow-hidden"
            style={{ borderWidth: 1, borderColor: 'rgba(252, 211, 77, 0.40)' }}
          >
            <LinearGradient
              colors={['#FDC700', '#FF8904']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ padding: 24, alignItems: 'center' }}
            >
              <Crown size={48} color="#0A1628" />
              <Text
                className="text-[24px] leading-8 font-bold text-center mt-2 tracking-tight"
                style={{ color: '#0A1628' }}
              >
                DUYO Premium
              </Text>
              <Text
                className="text-base text-center mt-1"
                style={{ color: '#0A1628' }}
              >
                Cheksiz o'rganish, cheksiz imkoniyatlar
              </Text>
            </LinearGradient>
          </View>

          <View className="gap-3">
            {TIERS.map((t) => {
              const isSel = t.key === selected;
              const isCurrent = t.key === 'friend';
              return (
                <Pressable
                  key={t.key}
                  onPress={() => setSelected(t.key)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSel }}
                  accessibilityLabel={t.name}
                  className={`rounded-xl border active:opacity-80 ${
                    isSel
                      ? 'bg-neon-blue/10 border-neon-blue border-2'
                      : 'border-neon-blue/20'
                  }`}
                  style={{
                    padding: 20,
                    backgroundColor: isSel ? undefined : '#132340',
                  }}
                >
                  <View className="flex-row items-start justify-between mb-3">
                    <View className="flex-1">
                      <View className="flex-row items-center gap-2">
                        <Text className="text-lg font-bold text-foreground dark:text-dark-text">
                          {t.name}
                        </Text>
                        {t.highlight && (
                          <View
                            className="rounded-md"
                            style={{
                              paddingHorizontal: 8,
                              paddingVertical: 2,
                              backgroundColor: '#60A5FA',
                            }}
                          >
                            <Text
                              className="text-xs font-medium"
                              style={{ color: '#0A1628' }}
                            >
                              Hozirgi
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text className="text-sm text-muted-foreground dark:text-dark-muted mt-1">
                        {t.description}
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-xl font-bold text-foreground dark:text-dark-text">
                        {t.priceMonthly === 0
                          ? "Bepul"
                          : `${t.priceMonthly.toLocaleString('uz-UZ')} so'm`}
                      </Text>
                      {t.priceMonthly > 0 && (
                        <Text className="text-xs text-muted-foreground dark:text-dark-muted">/ oy</Text>
                      )}
                    </View>
                  </View>
                  <View className="gap-2">
                    {t.features.map((f) => (
                      <View
                        key={f.text}
                        className="flex-row items-center gap-2"
                      >
                        {f.included ? (
                          <Check size={16} color="#05DF72" />
                        ) : (
                          <X size={16} color="#94A3B8" />
                        )}
                        <Text
                          className="text-sm"
                          style={{
                            color: f.included ? '#E0E7FF' : '#94A3B8',
                          }}
                        >
                          {f.text}
                        </Text>
                      </View>
                    ))}
                  </View>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={handleContinue}
            accessibilityRole="button"
            accessibilityLabel={
              selectedTier?.key === 'friend'
                ? 'Hozirgi rejani saqlash'
                : 'Faollashtirish'
            }
            className="rounded-md bg-neon-blue items-center justify-center active:opacity-80 mt-2"
            style={{ height: 56 }}
          >
            <Text
              className="text-base font-medium"
              style={{ color: '#0A1628' }}
            >
              {selectedTier?.key === 'friend'
                ? 'Hozirgi rejani saqlash'
                : 'Faollashtirish'}
            </Text>
          </Pressable>

          <Text className="text-xs text-muted-foreground dark:text-dark-muted text-center">
            Istalgan vaqtda bekor qilishingiz mumkin. Avtoulanish yo'q.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
