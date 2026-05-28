import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Mail,
  MessageSquare,
} from 'lucide-react-native';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

const FAQ_ITEMS: ReadonlyArray<FAQItem> = [
  {
    id: 'q1',
    question: 'DUYO nima?',
    answer:
      "DUYO — bu O'zbek tilida bola bilan suhbatlashadigan, o'rgatadigan va qo'llab-quvvatlaydigan AI hamroh. U mehribon kosmik kashshof sifatida ishlaydi.",
  },
  {
    id: 'q2',
    question: 'Suhbat xavfsizmi?',
    answer:
      "Ha. Suhbatlar shifrlangan, faqat sizning hisobingizdan ko'rish mumkin. Ota-ona ulanmasa, faqat siz va DUYO ko'radi.",
  },
  {
    id: 'q3',
    question: "Kunlik limit qancha?",
    answer:
      "Bepul rejada kuniga 30 ta suhbat. Premium uchun cheksiz, kelajakda Click/Payme orqali to'lov qo'shiladi.",
  },
  {
    id: 'q4',
    question: "Ovozli suhbat ishlaydimi?",
    answer:
      "Ha — Suhbat sahifasidagi mikrofon tugmasi ovozli rejimni ochadi. DUYO real vaqtda ovoz bilan javob beradi.",
  },
  {
    id: 'q5',
    question: "Ma'lumotlarimni qanday o'chirishim mumkin?",
    answer:
      "Sozlamalar → Maxfiylik bo'limidan suhbat tarixini yoki hisobni yopishingiz mumkin.",
  },
];

export default function HelpSettingsScreen() {
  const [openId, setOpenId] = useState<string | null>(null);

  const toggle = (id: string) =>
    setOpenId((current) => (current === id ? null : id));

  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0A1628' }]} />
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
            <ArrowLeft size={20} color="#E0E7FF" />
          </Pressable>
          <Text className="text-xl font-bold text-dark-text">Yordam</Text>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 24, gap: 24, paddingBottom: 48 }}
        >
          <View className="gap-3">
            <Text className="text-sm text-dark-muted">Ko'p so'raladigan</Text>
            {FAQ_ITEMS.map((f) => {
              const isOpen = openId === f.id;
              return (
                <Pressable
                  key={f.id}
                  onPress={() => toggle(f.id)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isOpen }}
                  accessibilityLabel={f.question}
                  className="rounded-xl bg-dark-surface border border-neon-blue/20 active:opacity-80"
                  style={{ padding: 16 }}
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="text-base font-medium text-dark-text flex-1 mr-2">
                      {f.question}
                    </Text>
                    {isOpen ? (
                      <ChevronUp size={20} color="#94A3B8" />
                    ) : (
                      <ChevronDown size={20} color="#94A3B8" />
                    )}
                  </View>
                  {isOpen && (
                    <Text className="text-sm text-dark-muted leading-6 mt-3">
                      {f.answer}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>

          <View className="gap-3">
            <Text className="text-sm text-dark-muted">Bog'lanish</Text>
            <Pressable
              onPress={() =>
                Alert.alert(
                  'Email yuborish',
                  'support@duyo.uz manziliga email yozing',
                )
              }
              accessibilityRole="button"
              accessibilityLabel="Email"
              className="rounded-xl bg-dark-surface border border-neon-blue/20 active:opacity-80"
              style={{ padding: 16 }}
            >
              <View className="flex-row items-center gap-3">
                <View
                  className="w-10 h-10 items-center justify-center rounded-md"
                  style={{ backgroundColor: 'rgba(96, 165, 250, 0.10)' }}
                >
                  <Mail size={18} color="#60A5FA" />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-medium text-dark-text">
                    Email yuborish
                  </Text>
                  <Text className="text-sm text-dark-muted mt-1">
                    support@duyo.uz
                  </Text>
                </View>
                <ExternalLink size={18} color="#94A3B8" />
              </View>
            </Pressable>

            <Pressable
              onPress={() =>
                Alert.alert(
                  'Telegram',
                  "Tez orada Telegram bot qo'llab-quvvatlash qo'shiladi",
                )
              }
              accessibilityRole="button"
              accessibilityLabel="Telegram"
              className="rounded-xl bg-dark-surface border border-neon-blue/20 active:opacity-80"
              style={{ padding: 16 }}
            >
              <View className="flex-row items-center gap-3">
                <View
                  className="w-10 h-10 items-center justify-center rounded-md"
                  style={{ backgroundColor: 'rgba(96, 165, 250, 0.10)' }}
                >
                  <MessageSquare size={18} color="#60A5FA" />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-medium text-dark-text">
                    Telegram qo'llab-quvvatlash
                  </Text>
                  <Text className="text-sm text-dark-muted mt-1">
                    @duyo_support
                  </Text>
                </View>
                <ExternalLink size={18} color="#94A3B8" />
              </View>
            </Pressable>
          </View>

          <View className="items-center gap-1 pt-4">
            <Text className="text-sm text-dark-muted">DUYO v1.0.0</Text>
            <Text className="text-xs text-dark-muted">
              © 2026 DUYO. Barcha huquqlar himoyalangan.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
