import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ArrowLeft, Coins } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '@/components/text';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MascotImage } from '@/components/v2/mascot-image';
import { useAvatar, useUpdateAvatar } from '@/hooks/use-gamification';
import { useIsDark } from '@/store/theme';

// Each customizer tab maps 1:1 to a backend avatar field (body→body_shape,
// color→primary_color, accent→accent, face→face_style) and the option keys
// share the same vocabulary, so no translation is needed.
type TabKey = 'body' | 'color' | 'accent' | 'face';

interface AvatarOption {
  key: string;
  emoji: string;
  label: string;
  price?: number;
  isOwned?: boolean;
}

const TABS: readonly { key: TabKey; label: string }[] = [
  { key: 'body', label: 'Tana' },
  { key: 'color', label: 'Rang' },
  { key: 'accent', label: 'Aksent' },
  { key: 'face', label: 'Yuz' },
];

const OPTIONS: Record<TabKey, readonly AvatarOption[]> = {
  body: [
    { key: 'sphere', emoji: '⚪', label: 'Sharsimon', isOwned: true },
    { key: 'cube', emoji: '🟦', label: 'Kubik', isOwned: true },
    { key: 'vertical', emoji: '⬜', label: 'Vertikal', price: 100 },
    { key: 'mini', emoji: '🔵', label: 'Mini', price: 150 },
  ],
  color: [
    { key: 'blue', emoji: '🔵', label: 'Ko‘k', isOwned: true },
    { key: 'purple', emoji: '🟣', label: 'Binafsha', price: 80 },
    { key: 'green', emoji: '🟢', label: 'Yashil', price: 80 },
    { key: 'red', emoji: '🔴', label: 'Qizil', price: 80 },
  ],
  accent: [
    { key: 'none', emoji: '⚪', label: 'Yo‘q', isOwned: true },
    { key: 'star', emoji: '⭐', label: 'Yulduz', isOwned: true },
    { key: 'cap', emoji: '🧢', label: 'Shapka', price: 120 },
    { key: 'glasses', emoji: '🤓', label: 'Ko‘zoynak', price: 150 },
  ],
  face: [
    { key: 'smile', emoji: '😊', label: 'Tabassum', isOwned: true },
    { key: 'curious', emoji: '🤔', label: 'Qiziqish', isOwned: true },
    { key: 'sunny', emoji: '😄', label: 'Quvonchli', price: 100 },
    { key: 'wink', emoji: '😉', label: "Ko'z qisish", price: 100 },
  ],
};

const DEFAULTS: Record<TabKey, string> = {
  body: 'sphere',
  color: 'blue',
  accent: 'star',
  face: 'smile',
};

export default function AvatarCustomizationScreen() {
  const isDark = useIsDark();
  const [activeTab, setActiveTab] = useState<TabKey>('body');
  const [config, setConfig] = useState<Record<TabKey, string>>({ ...DEFAULTS });

  const avatar = useAvatar();
  const updateAvatar = useUpdateAvatar();

  // Seed the editor from the saved avatar once it loads (and re-seed when a
  // save refetches it). Render-phase adjustment rather than an effect: the
  // seeded values appear in the same render the data arrives in, with no
  // one-frame flash of the defaults.
  const [seededFrom, setSeededFrom] = useState<typeof avatar.data>(undefined);
  if (avatar.data && avatar.data !== seededFrom) {
    setSeededFrom(avatar.data);
    setConfig({
      body: avatar.data.body_shape,
      color: avatar.data.primary_color,
      accent: avatar.data.accent,
      face: avatar.data.face_style,
    });
  }

  const setOption = (key: string, isOwned: boolean | undefined, price?: number) => {
    if (isOwned) {
      setConfig((prev) => ({ ...prev, [activeTab]: key }));
    } else {
      Alert.alert('Sotib olish', `${price} XP evaziga sotib olamiz?`);
    }
  };

  const handleSave = () => {
    updateAvatar.mutate(
      {
        body_shape: config.body,
        primary_color: config.color,
        accent: config.accent,
        face_style: config.face,
      },
      {
        onSuccess: () => {
          Alert.alert('Saqlandi', 'Avatar yangilandi!');
          router.back();
        },
        onError: () =>
          Alert.alert('Xatolik', "Saqlab bo'lmadi. Qayta urinib ko'ring."),
      },
    );
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? '#0A1628' : '#F4F8FF' }]} />
      <LinearGradient
        colors={['rgba(96, 165, 250, 0.20)', 'rgba(252, 211, 77, 0.15)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.97, y: 0.3 }}
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
            Avatar sozlash
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 24, gap: 20, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          <View
            className="rounded-2xl items-center justify-center"
            style={{ height: 280 }}
          >
            <LinearGradient
              colors={['#FFFFFF', 'rgba(255, 199, 0, 0.20)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                StyleSheet.absoluteFill,
                { borderRadius: 16, opacity: 0.1 },
              ]}
            />
            <MascotImage size={240} glow="cosmic" />
          </View>

          <View
            className="flex-row rounded-2xl"
            style={{ backgroundColor: isDark ? '#1E3A5F' : '#FFFFFF', padding: 3 }}
          >
            {TABS.map((t) => {
              const isActive = t.key === activeTab;
              return (
                <Pressable
                  key={t.key}
                  onPress={() => setActiveTab(t.key)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isActive }}
                  accessibilityLabel={t.label}
                  className={`flex-1 rounded-2xl items-center justify-center ${
                    isActive ? 'bg-neon-blue' : ''
                  }`}
                  style={{ paddingVertical: 8 }}
                >
                  <Text
                    className="text-sm font-medium"
                    style={{ color: isActive ? '#FFFFFF' : isDark ? '#E0E7FF' : '#102033' }}
                  >
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View className="flex-row flex-wrap" style={{ gap: 12 }}>
            {OPTIONS[activeTab].map((opt) => {
              const isSelected = config[activeTab] === opt.key;
              const owned = opt.isOwned ?? false;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => setOption(opt.key, opt.isOwned, opt.price)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={opt.label}
                  className={`rounded-xl border active:opacity-80 ${
                    isSelected
                      ? 'bg-neon-blue/20 border-neon-blue'
                      : owned
                        ? 'bg-card dark:bg-dark-surface border-neon-blue/20'
                        : 'bg-card dark:bg-dark-surface border-neon-blue/20'
                  }`}
                  style={{
                    width: '47%',
                    padding: 16,
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Text className="text-4xl">{opt.emoji}</Text>
                  <Text className="text-sm font-medium text-foreground dark:text-dark-text">
                    {opt.label}
                  </Text>
                  {!owned && (
                    <View
                      className="flex-row items-center gap-1 rounded-md border border-neon-blue/20"
                      style={{ paddingHorizontal: 9, paddingVertical: 3 }}
                    >
                      <Coins size={12} color="#FCD34D" />
                      <Text className="text-xs text-foreground dark:text-dark-text">{opt.price}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={handleSave}
            disabled={updateAvatar.isPending}
            accessibilityRole="button"
            accessibilityLabel="Saqlash"
            accessibilityState={{ disabled: updateAvatar.isPending }}
            className="rounded-md bg-neon-blue items-center justify-center active:opacity-80"
            style={{ height: 56, opacity: updateAvatar.isPending ? 0.6 : 1 }}
          >
            {updateAvatar.isPending ? (
              <ActivityIndicator color="#0A1628" />
            ) : (
              <Text
                className="text-base font-medium"
                style={{ color: '#0A1628' }}
              >
                Saqlash
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
