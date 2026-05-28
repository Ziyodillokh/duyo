import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Clock,
  Eye,
  Heart,
  Lock,
  TrendingUp,
} from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MascotImage } from '@/components/v2/mascot-image';
import { useIsDark } from '@/store/theme';

// Static mock — Faza 2 brings real parent dashboard data
const MOCK_CHILD = {
  name: 'Dunyo',
  age: 10,
  status: 'online' as const,
  activityScore: 8,
  activityMax: 10,
  todayMinutes: 23,
  weekMinutes: 184,
};

const MOCK_MOOD: ReadonlyArray<{ day: string; value: number }> = [
  { day: 'Du', value: 7 },
  { day: 'Se', value: 8 },
  { day: 'Ch', value: 6 },
  { day: 'Pa', value: 9 },
  { day: 'Ju', value: 8 },
  { day: 'Sh', value: 9 },
  { day: 'Ya', value: 7 },
];

const MOCK_ALERTS = 1;

export default function ParentDashboardScreen() {
  const isDark = useIsDark();
  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? '#0A1628' : '#F4F8FF' }]} />
      <LinearGradient
        colors={['rgba(96, 165, 250, 0.20)', 'rgba(252, 211, 77, 0.15)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.97, y: 0.4 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
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
            Ota-ona paneli
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 24, gap: 16, paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
        >
          <View
            className="rounded-xl border border-neon-blue/20"
            style={{ padding: 20, backgroundColor: isDark ? '#132340' : '#FFFFFF' }}
          >
            <View className="flex-row items-center gap-4">
              <View style={{ width: 72, height: 72 }}>
                <MascotImage size={72} glow="soft" />
              </View>
              <View className="flex-1">
                <Text className="text-xl font-bold text-foreground dark:text-dark-text">
                  {MOCK_CHILD.name}
                </Text>
                <Text className="text-sm text-muted-foreground dark:text-dark-muted">
                  {MOCK_CHILD.age} yosh
                </Text>
                <View className="flex-row items-center gap-2 mt-2">
                  <View
                    className="rounded-full"
                    style={{
                      width: 8,
                      height: 8,
                      backgroundColor: '#05DF72',
                    }}
                  />
                  <Text className="text-xs text-neon-green">Onlayn</Text>
                </View>
              </View>
            </View>
          </View>

          {MOCK_ALERTS > 0 && (
            <View
              className="rounded-xl border"
              style={{
                padding: 16,
                borderColor: 'rgba(251, 100, 182, 0.40)',
                backgroundColor: 'rgba(251, 100, 182, 0.10)',
              }}
            >
              <View className="flex-row items-center gap-3">
                <AlertTriangle size={20} color="#FB64B6" />
                <View className="flex-1">
                  <Text className="text-sm font-medium text-neon-pink">
                    {MOCK_ALERTS} ta diqqat talab qiluvchi mavzu
                  </Text>
                  <Text className="text-xs text-muted-foreground dark:text-dark-muted mt-1">
                    Suhbatda hissiy qiyinchilik aniqlandi
                  </Text>
                </View>
                <Eye size={18} color="#FB64B6" />
              </View>
            </View>
          )}

          <View className="flex-row gap-3">
            <View
              className="flex-1 rounded-xl border border-neon-blue/20"
              style={{ padding: 16, backgroundColor: isDark ? '#132340' : '#FFFFFF' }}
            >
              <Activity size={18} color="#60A5FA" />
              <Text className="text-2xl font-bold text-foreground dark:text-dark-text mt-2">
                {MOCK_CHILD.activityScore}/{MOCK_CHILD.activityMax}
              </Text>
              <Text className="text-xs text-muted-foreground dark:text-dark-muted">Faollik</Text>
            </View>
            <View
              className="flex-1 rounded-xl border border-neon-blue/20"
              style={{ padding: 16, backgroundColor: isDark ? '#132340' : '#FFFFFF' }}
            >
              <Clock size={18} color="#FDC700" />
              <Text className="text-2xl font-bold text-foreground dark:text-dark-text mt-2">
                {MOCK_CHILD.todayMinutes}
              </Text>
              <Text className="text-xs text-muted-foreground dark:text-dark-muted">daqiqa bugun</Text>
            </View>
            <View
              className="flex-1 rounded-xl border border-neon-blue/20"
              style={{ padding: 16, backgroundColor: isDark ? '#132340' : '#FFFFFF' }}
            >
              <TrendingUp size={18} color="#05DF72" />
              <Text className="text-2xl font-bold text-foreground dark:text-dark-text mt-2">
                {MOCK_CHILD.weekMinutes}
              </Text>
              <Text className="text-xs text-muted-foreground dark:text-dark-muted">hafta</Text>
            </View>
          </View>

          <View
            className="rounded-xl border border-neon-blue/20"
            style={{ padding: 20, backgroundColor: isDark ? '#132340' : '#FFFFFF' }}
          >
            <View className="flex-row items-center gap-2 mb-4">
              <Heart size={18} color="#FB64B6" />
              <Text className="text-base font-bold text-foreground dark:text-dark-text">
                Haftalik kayfiyat
              </Text>
            </View>
            <View className="flex-row justify-between items-end" style={{ height: 100 }}>
              {MOCK_MOOD.map((m) => (
                <View key={m.day} className="items-center gap-2 flex-1">
                  <View
                    className="rounded-md"
                    style={{
                      width: 16,
                      height: `${m.value * 10}%`,
                      backgroundColor: '#60A5FA',
                    }}
                  />
                  <Text className="text-xs text-muted-foreground dark:text-dark-muted">{m.day}</Text>
                </View>
              ))}
            </View>
          </View>

          <Pressable
            onPress={() => router.push('/(main)/(tabs)/chat')}
            accessibilityRole="button"
            accessibilityLabel="Suhbat tahlili"
            className="rounded-xl border border-neon-blue/20 active:opacity-80"
            style={{ padding: 16, backgroundColor: isDark ? '#132340' : '#FFFFFF' }}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-3 flex-1">
                <View
                  className="w-10 h-10 items-center justify-center rounded-md"
                  style={{ backgroundColor: 'rgba(96, 165, 250, 0.10)' }}
                >
                  <Eye size={18} color="#60A5FA" />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-medium text-foreground dark:text-dark-text">
                    Suhbat tahlili
                  </Text>
                  <Text className="text-sm text-muted-foreground dark:text-dark-muted">
                    AI tomonidan tahlil qilingan asosiy mavzular
                  </Text>
                </View>
              </View>
            </View>
          </Pressable>

          <Pressable
            onPress={() => router.push('/(main)/settings-privacy')}
            accessibilityRole="button"
            accessibilityLabel="Ozod vaqt"
            className="rounded-xl border border-neon-blue/20 active:opacity-80"
            style={{ padding: 16, backgroundColor: isDark ? '#132340' : '#FFFFFF' }}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-3 flex-1">
                <View
                  className="w-10 h-10 items-center justify-center rounded-md"
                  style={{ backgroundColor: 'rgba(252, 211, 77, 0.10)' }}
                >
                  <Lock size={18} color="#FDC700" />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-medium text-foreground dark:text-dark-text">
                    Vaqt cheklash
                  </Text>
                  <Text className="text-sm text-muted-foreground dark:text-dark-muted">
                    Kunlik foydalanish vaqtini sozlash
                  </Text>
                </View>
              </View>
            </View>
          </Pressable>

          <Text className="text-xs text-muted-foreground dark:text-dark-muted text-center mt-4">
            Bola va ota-ona o'rtasidagi maxfiylik DUYO uchun muhim. Faqat
            xavfsizlik ko'rsatkichlari ko'rsatiladi.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
