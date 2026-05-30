import { useIsDark } from '@/store/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, CheckCircle2, CreditCard } from 'lucide-react-native';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type PaymentMethod = 'click' | 'payme' | 'card';

interface PaymentMethodOption {
  key: PaymentMethod;
  label: string;
  description: string;
  color: string;
}

const PAYMENT_METHODS: ReadonlyArray<PaymentMethodOption> = [
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

const TIER_PRICE: Record<string, { name: string; price: number }> = {
  premium: { name: 'Premium', price: 49000 },
  friend: { name: "Do'st", price: 29000 },
};

export default function PaymentScreen() {
  const isDark = useIsDark();
  const params = useLocalSearchParams<{ tier?: string }>();
  const tier = TIER_PRICE[params.tier ?? 'premium'] ?? TIER_PRICE.premium;
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
    setTimeout(() => setSuccess(true), 800);
  };

  if (success) {
    return (
      <View style={StyleSheet.absoluteFill}>
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? '#0A1628' : '#F4F8FF' }]}
        />
        <LinearGradient
          colors={['rgba(5, 223, 114, 0.20)', 'rgba(96, 165, 250, 0.10)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          <View className="flex-1 items-center justify-center px-6 gap-4">
            <View
              className="rounded-full items-center justify-center"
              style={{
                width: 100,
                height: 100,
                backgroundColor: 'rgba(5, 223, 114, 0.20)',
              }}
            >
              <CheckCircle2 size={56} color="#05DF72" />
            </View>
            <Text className="text-2xl font-bold text-foreground dark:text-dark-text text-center">
              To'lov muvaffaqiyatli
            </Text>
            <Text className="text-base text-muted-foreground dark:text-dark-muted text-center">
              {tier.name} rejasi faollashdi.{'\n'}DUYO bilan o'rganishda davom
              eting!
            </Text>
            <Pressable
              onPress={() => router.replace('/(main)/(tabs)')}
              accessibilityRole="button"
              accessibilityLabel="Bosh sahifaga"
              className="rounded-md bg-neon-blue items-center justify-center active:opacity-80 mt-4"
              style={{ height: 56, paddingHorizontal: 32 }}
            >
              <Text
                className="text-base font-medium"
                style={{ color: '#0A1628' }}
              >
                Bosh sahifaga
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? '#0A1628' : '#F4F8FF' }]} />
      <LinearGradient
        colors={['rgba(96, 165, 250, 0.20)', 'rgba(252, 211, 77, 0.15)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.97, y: 1 }}
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
          <Text className="text-xl font-bold text-foreground dark:text-dark-text">To'lov</Text>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1"
        >
          <ScrollView
            contentContainerStyle={{ padding: 24, gap: 20, paddingBottom: 48 }}
          >
            <View
              className="rounded-xl border border-neon-blue/20"
              style={{ padding: 16, backgroundColor: isDark ? '#132340' : '#FFFFFF' }}
            >
              <Text className="text-sm text-muted-foreground dark:text-dark-muted">Tanlangan reja</Text>
              <View className="flex-row items-center justify-between mt-2">
                <Text className="text-lg font-bold text-foreground dark:text-dark-text">
                  {tier.name}
                </Text>
                <Text className="text-lg font-bold text-neon-cyan">
                  {tier.price.toLocaleString('uz-UZ')} so'm/oy
                </Text>
              </View>
            </View>

            <View className="gap-3">
              <Text className="text-sm text-muted-foreground dark:text-dark-muted">To'lov usuli</Text>
              {PAYMENT_METHODS.map((m) => {
                const isSel = m.key === method;
                return (
                  <Pressable
                    key={m.key}
                    onPress={() => setMethod(m.key)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSel }}
                    accessibilityLabel={m.label}
                    className={`rounded-xl border active:opacity-80 ${
                      isSel
                        ? 'bg-neon-blue/10 border-neon-blue'
                        : 'border-neon-blue/20'
                    }`}
                    style={{
                      padding: 16,
                      backgroundColor: isSel ? undefined : '#132340',
                    }}
                  >
                    <View className="flex-row items-center gap-3">
                      <View
                        className="w-12 h-12 items-center justify-center rounded-md"
                        style={{ backgroundColor: `${m.color}30` }}
                      >
                        <CreditCard size={20} color={m.color} />
                      </View>
                      <View className="flex-1">
                        <Text className="text-base font-medium text-foreground dark:text-dark-text">
                          {m.label}
                        </Text>
                        <Text className="text-sm text-muted-foreground dark:text-dark-muted mt-1">
                          {m.description}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {method === 'card' && (
              <View
                className="rounded-xl border border-neon-blue/20"
                style={{ padding: 16, backgroundColor: isDark ? '#132340' : '#FFFFFF', gap: 12 }}
              >
                <View>
                  <Text className="text-sm font-medium text-foreground dark:text-dark-text mb-2">
                    Karta raqami
                  </Text>
                  <TextInput
                    value={cardNumber}
                    onChangeText={(t) =>
                      setCardNumber(t.replace(/\D/g, '').slice(0, 16))
                    }
                    placeholder="1234 5678 9012 3456"
                    placeholderTextColor="#94A3B8"
                    keyboardType="number-pad"
                    className="text-base text-foreground dark:text-dark-text"
                    style={{
                      borderWidth: 1,
                      borderColor: 'rgba(96, 165, 250, 0.20)',
                      borderRadius: 8,
                      paddingHorizontal: 12,
                      height: 44,
                    }}
                    accessibilityLabel="Karta raqami"
                  />
                </View>
                <View>
                  <Text className="text-sm font-medium text-foreground dark:text-dark-text mb-2">
                    Amal qilish muddati
                  </Text>
                  <TextInput
                    value={cardExpiry}
                    onChangeText={(t) =>
                      setCardExpiry(t.replace(/\D/g, '').slice(0, 4))
                    }
                    placeholder="MM/YY"
                    placeholderTextColor="#94A3B8"
                    keyboardType="number-pad"
                    className="text-base text-foreground dark:text-dark-text"
                    style={{
                      borderWidth: 1,
                      borderColor: 'rgba(96, 165, 250, 0.20)',
                      borderRadius: 8,
                      paddingHorizontal: 12,
                      height: 44,
                    }}
                    accessibilityLabel="Amal qilish muddati"
                  />
                </View>
              </View>
            )}

            <View
              className="rounded-xl border border-neon-blue/20"
              style={{ padding: 16, backgroundColor: 'rgba(252, 211, 77, 0.10)' }}
            >
              <View className="flex-row justify-between">
                <Text className="text-base text-foreground dark:text-dark-text">Jami</Text>
                <Text className="text-xl font-bold text-neon-yellow">
                  {tier.price.toLocaleString('uz-UZ')} so'm
                </Text>
              </View>
            </View>

            <Pressable
              onPress={handlePay}
              accessibilityRole="button"
              accessibilityLabel="To'lashga o'tish"
              className="rounded-md bg-neon-blue items-center justify-center active:opacity-80"
              style={{ height: 56 }}
            >
              <Text
                className="text-base font-medium"
                style={{ color: '#0A1628' }}
              >
                To'lashga o'tish
              </Text>
            </Pressable>

            <Text className="text-xs text-muted-foreground dark:text-dark-muted text-center">
              To'lovni ortga qaytarib bo'lmaydi. 7 kun bepul sinov ulanmaydi.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
