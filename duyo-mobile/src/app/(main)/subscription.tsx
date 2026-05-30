import { useIsDark } from '@/store/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ArrowLeft, Check } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface PricingTier {
  key: string;
  name: string;
  priceMonthly: number;
  priceYearly?: number;
  features: ReadonlyArray<string>;
  isCurrent?: boolean;
  isPremium?: boolean;
}

const TIERS: ReadonlyArray<PricingTier> = [
  {
    key: 'tanish',
    name: 'Tanish',
    priceMonthly: 0,
    features: [
      '1 ta til',
      'Faqat skript javoblar',
      'Kuniga 20 daqiqa',
      'Cheklangan kontent',
    ],
    isCurrent: true,
  },
  {
    key: 'dost',
    name: "Do'st",
    priceMonthly: 29000,
    features: [
      '3 ta til',
      'AI suhbat - kuniga 30 ta',
      "To'liq gamifikatsiya",
      'Barcha oddiy kontent',
      'Ota-ona hisoboti',
    ],
  },
  {
    key: 'hamroh',
    name: 'Hamroh',
    priceMonthly: 59000,
    features: [
      'Cheklanmagan AI suhbat',
      'Ovozli suhbat',
      '2 ta bola uchun',
      'Premium kontent',
      'Ustuvor yordam',
    ],
    isPremium: true,
  },
];

const ALL_PLAN_BENEFITS: ReadonlyArray<string> = [
  '7 kun bepul sinov',
  'Istalgan vaqt bekor qilish',
  'Xavfsiz to\'lov',
  '24/7 yordam',
];

const PAYMENT_METHODS = ['Click', 'Payme', 'Uzcard', 'Humo', 'Visa/Mastercard'];

export default function SubscriptionScreen() {
  const isDark = useIsDark();
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');
  const [selected, setSelected] = useState<string>('dost');

  const selectedTier = TIERS.find((t) => t.key === selected);

  const handleSelect = (key: string) => {
    const tier = TIERS.find((t) => t.key === key);
    if (!tier || tier.priceMonthly === 0) return;
    router.push({ pathname: '/(main)/payment', params: { tier: key } });
  };

  const bgColor = isDark ? '#0A1628' : '#F4F8FF';

  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: bgColor }]} />
      <LinearGradient
        colors={['rgba(96, 165, 250, 0.15)', 'rgba(252, 211, 77, 0.10)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.95, y: 1 }}
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
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40, gap: 20 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Heading */}
          <View className="gap-1">
            <Text
              className="text-[28px] font-bold tracking-tight"
              style={{ color: isDark ? '#E0E7FF' : '#102033' }}
            >
              Premium'ga o'ting
            </Text>
            <Text
              className="text-sm"
              style={{ color: isDark ? '#94A3B8' : '#64748B' }}
            >
              DUYO bilan ko'proq o'rganing va o'sing
            </Text>
          </View>

          {/* Trial banner */}
          <View
            className="rounded-xl flex-row items-center gap-3"
            style={{
              backgroundColor: 'rgba(5, 223, 114, 0.12)',
              borderWidth: 1,
              borderColor: 'rgba(5, 223, 114, 0.30)',
              padding: 14,
            }}
          >
            <Text className="text-base">⭐</Text>
            <Text
              className="text-sm font-medium flex-1"
              style={{ color: '#05DF72' }}
            >
              7 kun bepul sinov — kredit karta talab qilinmaydi
            </Text>
          </View>

          {/* Billing toggle */}
          <View
            className="flex-row rounded-xl self-center"
            style={{
              backgroundColor: isDark ? '#1E3A5F' : '#E2EAF4',
              padding: 3,
            }}
          >
            {(['monthly', 'yearly'] as const).map((b) => (
              <Pressable
                key={b}
                onPress={() => setBilling(b)}
                accessibilityRole="tab"
                accessibilityState={{ selected: billing === b }}
                className="rounded-xl items-center justify-center flex-row gap-2"
                style={{
                  paddingHorizontal: 20,
                  paddingVertical: 8,
                  backgroundColor: billing === b ? '#2563EB' : 'transparent',
                }}
              >
                <Text
                  className="text-sm font-medium"
                  style={{ color: billing === b ? '#FFFFFF' : isDark ? '#94A3B8' : '#64748B' }}
                >
                  {b === 'monthly' ? 'Oylik' : 'Yillik'}
                </Text>
                {b === 'yearly' && (
                  <View
                    className="rounded-md"
                    style={{ backgroundColor: '#05DF72', paddingHorizontal: 5, paddingVertical: 1 }}
                  >
                    <Text className="text-xs font-bold" style={{ color: '#0A1628' }}>
                      -17%
                    </Text>
                  </View>
                )}
              </Pressable>
            ))}
          </View>

          {/* Pricing cards */}
          {TIERS.map((tier) => {
            const isSel = selected === tier.key;
            const price =
              billing === 'yearly' && tier.priceMonthly > 0
                ? Math.round(tier.priceMonthly * 0.83)
                : tier.priceMonthly;

            return (
              <Pressable
                key={tier.key}
                onPress={() => setSelected(tier.key)}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSel }}
                accessibilityLabel={tier.name}
                className="rounded-2xl active:opacity-90"
                style={{
                  backgroundColor: isDark ? '#132340' : '#FFFFFF',
                  borderWidth: isSel ? 2 : 1,
                  borderColor: tier.isPremium
                    ? '#FDC700'
                    : isSel
                      ? '#2563EB'
                      : isDark ? 'rgba(96,165,250,0.20)' : '#E2EAF4',
                  padding: 20,
                }}
              >
                {tier.isPremium && (
                  <View
                    className="self-center rounded-full mb-3"
                    style={{
                      backgroundColor: '#FDC700',
                      paddingHorizontal: 12,
                      paddingVertical: 3,
                    }}
                  >
                    <Text className="text-xs font-bold" style={{ color: '#0A1628' }}>
                      Premium
                    </Text>
                  </View>
                )}

                <View className="items-center mb-4">
                  <Text
                    className="text-xl font-bold"
                    style={{ color: isDark ? '#E0E7FF' : '#102033' }}
                  >
                    {tier.name}
                  </Text>
                  <Text
                    className="text-3xl font-bold mt-1"
                    style={{ color: isDark ? '#E0E7FF' : '#102033' }}
                  >
                    {price === 0
                      ? 'Bepul'
                      : `${price.toLocaleString('ru-RU')} so'm`}
                  </Text>
                  {price > 0 && (
                    <Text className="text-sm" style={{ color: isDark ? '#94A3B8' : '#64748B' }}>
                      / oy
                    </Text>
                  )}
                </View>

                {tier.isCurrent && (
                  <View className="items-center mb-3">
                    <Text
                      className="text-xs"
                      style={{ color: isDark ? '#94A3B8' : '#64748B' }}
                    >
                      Joriy reja
                    </Text>
                  </View>
                )}

                <View className="gap-2">
                  {tier.features.map((f) => (
                    <View key={f} className="flex-row items-center gap-2">
                      <Check size={15} color="#2563EB" />
                      <Text
                        className="text-sm flex-1"
                        style={{ color: isDark ? '#CBD5E1' : '#334155' }}
                      >
                        {f}
                      </Text>
                    </View>
                  ))}
                </View>

                {!tier.isCurrent && (
                  <Pressable
                    onPress={() => handleSelect(tier.key)}
                    accessibilityRole="button"
                    accessibilityLabel="Tanlash"
                    className="rounded-xl mt-5 items-center justify-center active:opacity-80"
                    style={{ height: 44, backgroundColor: '#2563EB' }}
                  >
                    <Text className="text-sm font-semibold" style={{ color: '#FFFFFF' }}>
                      Tanlash
                    </Text>
                  </Pressable>
                )}
              </Pressable>
            );
          })}

          {/* All plans include */}
          <View
            className="rounded-2xl"
            style={{
              backgroundColor: isDark ? '#132340' : '#FFFFFF',
              borderWidth: 1,
              borderColor: isDark ? 'rgba(96,165,250,0.20)' : '#E2EAF4',
              padding: 20,
            }}
          >
            <Text
              className="text-base font-bold mb-4"
              style={{ color: isDark ? '#E0E7FF' : '#102033' }}
            >
              Barcha rejalarda:
            </Text>
            <View className="gap-3">
              {ALL_PLAN_BENEFITS.map((b) => (
                <View key={b} className="flex-row items-center gap-2">
                  <Check size={15} color="#2563EB" />
                  <Text
                    className="text-sm"
                    style={{ color: isDark ? '#CBD5E1' : '#334155' }}
                  >
                    {b}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Payment methods */}
          <View className="gap-3">
            <Text
              className="text-sm font-medium text-center"
              style={{ color: isDark ? '#94A3B8' : '#64748B' }}
            >
              To'lov usullari
            </Text>
            <View className="flex-row flex-wrap justify-center gap-3">
              {PAYMENT_METHODS.map((m) => (
                <View
                  key={m}
                  className="rounded-lg items-center justify-center"
                  style={{
                    backgroundColor: isDark ? '#1E3A5F' : '#F1F5F9',
                    paddingHorizontal: 14,
                    paddingVertical: 7,
                  }}
                >
                  <Text
                    className="text-xs font-medium"
                    style={{ color: isDark ? '#94A3B8' : '#64748B' }}
                  >
                    {m}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
