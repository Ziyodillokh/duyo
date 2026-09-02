import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ArrowLeft, Coins } from 'lucide-react-native';
import { useState } from 'react';
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

import { MascotImage } from '@/components/v2/mascot-image';
import { useAvatar, useUpdateAvatar } from '@/hooks/use-gamification';
import { useT, type TranslationKey } from '@/i18n';
import { glass, lift } from '@/lib/glass';

// ── The glass sky, the inner screens' cooler morning ─────────────────────────
// Same family as settings and notifications: frosted panes on pale blue. The
// screen commits to the light look the way its siblings do.
const PRIMARY = '#2F6FE4';
const INK = '#22406F';
const MUTED = '#8CA3CB';
const BG_TOP = '#E3EFFF';
const BG_MID = '#EAF3FF';
const BG_BOTTOM = '#EDF2FD';
/** The price coin, deepened from the neon gold that only worked on navy. */
const GOLD = '#E0A21C';

// Each customizer tab maps 1:1 to a backend avatar field (body→body_shape,
// color→primary_color, accent→accent, face→face_style) and the option keys
// share the same vocabulary, so no translation is needed.
type TabKey = 'body' | 'color' | 'accent' | 'face';

interface AvatarOption {
  key: string;
  emoji: string;
  /** A key, not a word — these tables are built once, at import. */
  label: TranslationKey;
  price?: number;
  isOwned?: boolean;
}

const TABS: readonly { key: TabKey; label: TranslationKey }[] = [
  { key: 'body', label: 'avatarEditor.tab.body' },
  { key: 'color', label: 'avatarEditor.tab.colour' },
  { key: 'accent', label: 'avatarEditor.tab.accent' },
  { key: 'face', label: 'avatarEditor.tab.face' },
];

const OPTIONS: Record<TabKey, readonly AvatarOption[]> = {
  body: [
    { key: 'sphere', emoji: '⚪', label: 'avatarEditor.body.sphere', isOwned: true },
    { key: 'cube', emoji: '🟦', label: 'avatarEditor.body.cube', isOwned: true },
    { key: 'vertical', emoji: '⬜', label: 'avatarEditor.body.vertical', price: 100 },
    { key: 'mini', emoji: '🔵', label: 'avatarEditor.body.mini', price: 150 },
  ],
  color: [
    { key: 'blue', emoji: '🔵', label: 'avatarEditor.colour.blue', isOwned: true },
    { key: 'purple', emoji: '🟣', label: 'avatarEditor.colour.purple', price: 80 },
    { key: 'green', emoji: '🟢', label: 'avatarEditor.colour.green', price: 80 },
    { key: 'red', emoji: '🔴', label: 'avatarEditor.colour.red', price: 80 },
  ],
  accent: [
    { key: 'none', emoji: '⚪', label: 'avatarEditor.accent.none', isOwned: true },
    { key: 'star', emoji: '⭐', label: 'avatarEditor.accent.star', isOwned: true },
    { key: 'cap', emoji: '🧢', label: 'avatarEditor.accent.cap', price: 120 },
    { key: 'glasses', emoji: '🤓', label: 'avatarEditor.accent.glasses', price: 150 },
  ],
  face: [
    { key: 'smile', emoji: '😊', label: 'avatarEditor.face.smile', isOwned: true },
    { key: 'curious', emoji: '🤔', label: 'avatarEditor.face.curious', isOwned: true },
    { key: 'sunny', emoji: '😄', label: 'avatarEditor.face.sunny', price: 100 },
    { key: 'wink', emoji: '😉', label: 'avatarEditor.face.wink', price: 100 },
  ],
};

const DEFAULTS: Record<TabKey, string> = {
  body: 'sphere',
  color: 'blue',
  accent: 'star',
  face: 'smile',
};

export default function AvatarCustomizationScreen() {
  const t = useT();
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
      Alert.alert(
        t('avatarEditor.buy.title'),
        t('avatarEditor.buy.body', { price: price ?? 0 }),
      );
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
          Alert.alert(t('avatarEditor.saved.title'), t('avatarEditor.saved.body'));
          router.back();
        },
        onError: () =>
          Alert.alert(t('common.error'), t('common.saveFailedRetry')),
      },
    );
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={[BG_TOP, BG_MID, BG_BOTTOM]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        {/* ── Header: the inner-screen glass pattern ─────────────────── */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            style={[glass(22, 'sm'), styles.headerButton, styles.focusable]}
          >
            <ArrowLeft size={22} color={PRIMARY} strokeWidth={2} />
          </Pressable>
          <Text style={styles.title}>{t('avatarEditor.title')}</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* ── The stage: the one hero object on the screen ──────────── */}
          <View style={[glass(30, 'lg'), styles.stage]}>
            {/* A sheen down the pane, so the mascot reads as lit from the same
                sky the page is. */}
            <LinearGradient
              colors={['rgba(255,255,255,0.85)', 'rgba(214,232,255,0.35)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFill, styles.stageSheen]}
            />
            <MascotImage size={240} glow="cosmic" />
          </View>

          {/* ── Segmented control ─────────────────────────────────────── */}
          <View style={[glass(20, 'sm'), styles.tabs]}>
            {TABS.map((tab) => {
              const isActive = tab.key === activeTab;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => setActiveTab(tab.key)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isActive }}
                  accessibilityLabel={t(tab.label)}
                  style={[styles.tab, isActive && styles.tabOn, styles.focusable]}
                >
                  <Text style={[styles.tabText, isActive && styles.tabTextOn]}>
                    {t(tab.label)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.grid}>
            {OPTIONS[activeTab].map((opt) => {
              const isSelected = config[activeTab] === opt.key;
              const owned = opt.isOwned ?? false;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => setOption(opt.key, opt.isOwned, opt.price)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={t(opt.label)}
                  style={({ pressed }) => [
                    glass(20, 'md'),
                    styles.option,
                    isSelected && styles.optionOn,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.optionEmoji}>{opt.emoji}</Text>
                  <Text style={styles.optionLabel}>{t(opt.label)}</Text>
                  {!owned ? (
                    <View style={styles.price}>
                      <Coins size={12} color={GOLD} strokeWidth={2.2} />
                      <Text style={styles.priceText}>{opt.price}</Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={handleSave}
            disabled={updateAvatar.isPending}
            accessibilityRole="button"
            accessibilityLabel={t('common.save')}
            accessibilityState={{ disabled: updateAvatar.isPending }}
            style={({ pressed }) => [
              styles.save,
              styles.focusable,
              { opacity: updateAvatar.isPending ? 0.6 : 1 },
              pressed && styles.pressed,
            ]}
          >
            {updateAvatar.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveText}>{t('common.save')}</Text>
            )}
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 68,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 14,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The browser's default focus ring is a black rectangle around a round
  // control. RN's ViewStyle has no outline, so this is a web-only escape;
  // native ignores unknown keys.
  focusable: { outlineStyle: 'none', outlineWidth: 0 } as unknown as ViewStyle,
  pressed: { opacity: 0.8 },
  title: { fontSize: 22, fontWeight: '700', color: INK },

  scroll: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 32, gap: 18 },

  stage: {
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  stageSheen: { borderRadius: 30, opacity: 0.5 },

  tabs: { flexDirection: 'row', padding: 4 },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabOn: { backgroundColor: PRIMARY },
  tabText: { fontSize: 14, fontWeight: '600', color: INK },
  tabTextOn: { color: '#FFFFFF', fontWeight: '700' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  option: {
    width: '47%',
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  optionOn: {
    backgroundColor: 'rgba(47,111,228,0.14)',
    borderColor: PRIMARY,
  },
  optionEmoji: { fontSize: 34, lineHeight: 42 },
  optionLabel: { fontSize: 14, fontWeight: '600', color: INK },
  price: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(47,111,228,0.10)',
  },
  priceText: { fontSize: 12, fontWeight: '600', color: MUTED },

  save: {
    height: 56,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PRIMARY,
    boxShadow: lift('md'),
  },
  saveText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
