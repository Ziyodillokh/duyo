import type { BillingPeriod, PaidTier } from '@/api/endpoints/subscription';
import { KeyboardAvoidingView } from '@/components/keyboard-avoiding-view';
import { Text, TextInput } from '@/components/text';
import { usePlans, useSubscribe } from '@/hooks/use-subscription';
import { glass, lift } from '@/lib/glass';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, CheckCircle2, CreditCard } from 'lucide-react-native';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// ── The glass sky, the inner screens' cooler morning ─────────────────────────
// Same family as settings and notifications: frosted panes on pale blue.
const PRIMARY = '#2F6FE4';
const TITLE = '#2A63DC';
const INK = '#22406F';
const MUTED = '#8CA3CB';
const GREEN = '#22B573';
const PLACEHOLDER = '#7693C2';
const BG_TOP = '#E3EFFF';
const BG_MID = '#EAF3FF';
const BG_BOTTOM = '#EDF2FD';
const HAIRLINE = 'rgba(47,111,228,0.10)';

type PaymentMethod = 'click' | 'payme' | 'card';

interface PaymentMethodOption {
  key: PaymentMethod;
  label: string;
  description: string;
  color: string;
}

const PAYMENT_METHODS: readonly PaymentMethodOption[] = [
  {
    key: 'click',
    label: 'Click',
    description: 'Click ilovasi orqali',
    color: '#0078FF',
  },
  {
    key: 'payme',
    label: 'Payme',
    description: 'Payme ilovasi orqali',
    color: '#36AF7E',
  },
  {
    key: 'card',
    label: 'Bank kartasi',
    description: 'Uzcard / Humo',
    color: '#60A5FA',
  },
];

export default function PaymentScreen() {
  const params = useLocalSearchParams<{ tier?: string; period?: string }>();
  const tierKey = (params.tier ?? 'standart') as PaidTier;
  const period: BillingPeriod = params.period === 'yearly' ? 'yearly' : 'monthly';

  const plans = usePlans();
  const subscribeMutation = useSubscribe();

  const tierInfo = plans.data?.find((t) => t.key === tierKey);
  const tierName = tierInfo?.name ?? tierKey;
  const price = tierInfo
    ? period === 'yearly'
      ? tierInfo.price_yearly
      : tierInfo.price_monthly
    : 0;
  const priceUnit = period === 'yearly' ? 'so\'m/yil' : 'so\'m/oy';

  const [method, setMethod] = useState<PaymentMethod>('click');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [success, setSuccess] = useState(false);

  const handlePay = () => {
    if (method === 'card') {
      if (cardNumber.length < 16 || cardExpiry.length < 4) {
        Alert.alert('Xatolik', "Karta ma'lumotlarini to'liq kiriting");
        return;
      }
    }
    // MVP: payment is mocked server-side — only provider 'mock' activates the
    // tier. The method picker above is cosmetic until Click/Payme integrate.
    subscribeMutation.mutate(
      { tier: tierKey, period, provider: 'mock' },
      {
        onSuccess: () => setSuccess(true),
        onError: () =>
          Alert.alert('Xatolik', "To'lovni amalga oshirib bo'lmadi. Qayta urinib ko'ring."),
      },
    );
  };

  if (success) {
    return (
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={[BG_TOP, BG_MID, BG_BOTTOM]}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
        />
        {/* The confirmation keeps its green wash: on the plain sky a paid
            receipt would look like any other step of the flow. */}
        <LinearGradient
          colors={['rgba(34,181,115,0.18)', 'rgba(34,181,115,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
          <View style={styles.successBody}>
            <View style={[glass(50, 'lg'), styles.successMark]}>
              <CheckCircle2 size={56} color={GREEN} strokeWidth={2} />
            </View>
            <Text style={styles.successTitle}>To'lov muvaffaqiyatli</Text>
            <Text style={styles.successBlurb}>
              {tierName} rejasi faollashdi.{'\n'}DUYO bilan o'rganishda davom
              eting!
            </Text>
            <Pressable
              onPress={() => router.replace('/(main)/(tabs)')}
              accessibilityRole="button"
              accessibilityLabel="Bosh sahifaga"
              style={[styles.cta, styles.successCta, styles.focusable]}
            >
              <Text style={styles.ctaText}>Bosh sahifaga</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={[BG_TOP, BG_MID, BG_BOTTOM]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
        {/* ── Header: 48pt glass round, the inner-screen pattern ─────── */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Orqaga"
            style={[glass(24, 'sm'), styles.headerButton, styles.focusable]}
          >
            <ArrowLeft size={23} color={PRIMARY} strokeWidth={2} />
          </Pressable>
          <Text style={styles.title}>To'lov</Text>
        </View>

        <KeyboardAvoidingView behavior="padding" style={styles.flex}>
          <ScrollView contentContainerStyle={styles.scroll}>
            <View style={[glass(22, 'md'), styles.planCard]}>
              <Text style={styles.caption}>Tanlangan reja</Text>
              <View style={styles.planRow}>
                <Text style={styles.planName}>{tierName}</Text>
                <Text style={styles.planPrice}>
                  {price.toLocaleString('uz-UZ')} {priceUnit}
                </Text>
              </View>
            </View>

            <View style={styles.methods}>
              <Text style={styles.caption}>To'lov usuli</Text>
              {PAYMENT_METHODS.map((m) => {
                const isSel = m.key === method;
                return (
                  <Pressable
                    key={m.key}
                    onPress={() => setMethod(m.key)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSel }}
                    accessibilityLabel={m.label}
                    style={[
                      glass(20, 'md', isSel ? 0.78 : 0.5),
                      styles.method,
                      isSel && styles.methodOn,
                      styles.focusable,
                    ]}
                  >
                    <View style={styles.methodRow}>
                      {/* The provider's own colour — a brand mark is the one
                          place this page borrows a hue from outside. */}
                      <View
                        style={[styles.methodWell, { backgroundColor: `${m.color}22` }]}
                      >
                        <CreditCard size={20} color={m.color} strokeWidth={2} />
                      </View>
                      <View style={styles.flex}>
                        <Text style={styles.methodLabel}>{m.label}</Text>
                        <Text style={styles.methodBlurb}>{m.description}</Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {method === 'card' && (
              <View style={[glass(22, 'md'), styles.cardForm]}>
                <View>
                  <Text style={styles.fieldLabel}>Karta raqami</Text>
                  <TextInput
                    value={cardNumber}
                    onChangeText={(t) =>
                      setCardNumber(t.replace(/\D/g, '').slice(0, 16))
                    }
                    placeholder="1234 5678 9012 3456"
                    placeholderTextColor={PLACEHOLDER}
                    keyboardType="number-pad"
                    style={styles.field}
                    accessibilityLabel="Karta raqami"
                  />
                </View>
                <View>
                  <Text style={styles.fieldLabel}>Amal qilish muddati</Text>
                  <TextInput
                    value={cardExpiry}
                    onChangeText={(t) =>
                      setCardExpiry(t.replace(/\D/g, '').slice(0, 4))
                    }
                    placeholder="MM/YY"
                    placeholderTextColor={PLACEHOLDER}
                    keyboardType="number-pad"
                    style={styles.field}
                    accessibilityLabel="Amal qilish muddati"
                  />
                </View>
              </View>
            )}

            {/* The total is the one figure the page is about, so its pane is
                the brightest and highest thing on it rather than a second
                accent hue. */}
            <View style={[glass(24, 'lg', 0.75), styles.totalCard]}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Jami</Text>
                <Text style={styles.totalValue}>
                  {price.toLocaleString('uz-UZ')} so'm
                </Text>
              </View>
            </View>

            <Pressable
              onPress={handlePay}
              disabled={subscribeMutation.isPending}
              accessibilityRole="button"
              accessibilityLabel="To'lashga o'tish"
              accessibilityState={{ disabled: subscribeMutation.isPending }}
              style={[
                styles.cta,
                subscribeMutation.isPending && styles.ctaBusy,
                styles.focusable,
              ]}
            >
              <Text style={styles.ctaText}>
                {subscribeMutation.isPending ? 'Yuborilmoqda…' : "To'lashga o'tish"}
              </Text>
            </Pressable>

            <Text style={styles.finePrint}>
              To'lovni ortga qaytarib bo'lmaydi. 7 kun bepul sinov ulanmaydi.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // The browser's default focus ring is a black rectangle around a rounded
  // control. RN's ViewStyle has no outline, so this is a web-only escape;
  // native ignores unknown keys.
  focusable: { outlineStyle: 'none', outlineWidth: 0 } as unknown as ViewStyle,

  header: {
    height: 68,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 14,
  },
  headerButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 22, fontWeight: '700', color: INK },

  scroll: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 48,
    gap: 18,
  },
  caption: { fontSize: 13, color: MUTED },

  planCard: { padding: 16 },
  planRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  planName: { fontSize: 17, fontWeight: '700', color: INK },
  planPrice: { fontSize: 17, fontWeight: '700', color: PRIMARY },

  methods: { gap: 12 },
  method: { padding: 16 },
  methodOn: { borderColor: PRIMARY },
  methodRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  methodWell: {
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodLabel: { fontSize: 15, fontWeight: '600', color: INK },
  methodBlurb: { marginTop: 2, fontSize: 13, color: MUTED },

  cardForm: { padding: 16, gap: 12 },
  fieldLabel: {
    marginBottom: 6,
    fontSize: 13,
    fontWeight: '600',
    color: INK,
  },
  // Flush by design: a field is cut INTO the card it sits on, so it casts no
  // shadow of its own — see the `flush` note in lib/glass.
  field: {
    height: 46,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: HAIRLINE,
    backgroundColor: 'rgba(255,255,255,0.75)',
    fontSize: 15,
    color: INK,
  },

  totalCard: { padding: 18 },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  totalLabel: { fontSize: 15, color: INK },
  totalValue: { fontSize: 21, fontWeight: '800', color: TITLE },

  cta: {
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PRIMARY,
    boxShadow: lift('md'),
  },
  ctaBusy: { opacity: 0.6 },
  ctaText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },

  successBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 16,
  },
  successMark: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(34,181,115,0.16)',
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: TITLE,
    textAlign: 'center',
  },
  successBlurb: {
    fontSize: 15,
    lineHeight: 22,
    color: MUTED,
    textAlign: 'center',
  },
  successCta: { marginTop: 8, paddingHorizontal: 32 },

  finePrint: {
    fontSize: 12,
    lineHeight: 17,
    color: MUTED,
    textAlign: 'center',
  },
});
