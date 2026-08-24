import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
  BookOpen,
  Check,
  Gamepad2,
  Leaf,
  Music,
  Palette,
  PawPrint,
  Rocket,
  Shield,
  type LucideIcon,
} from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/text';

import { MascotImage } from '@/components/v2/mascot-image';
import { PrimaryButton } from '@/components/v2/primary-button';
import { useT, type TranslationKey } from '@/i18n';
import { glass } from '@/lib/glass';
import { useOnboardingStore } from '@/store/onboarding';

// ── The glass sky, the same pale morning the inner screens wake up to ────────
const PRIMARY = '#2F6FE4';
const INK = '#22406F';
const MUTED = '#8CA3CB';
const BG_TOP = '#E3EFFF';
const BG_MID = '#EAF3FF';
const BG_BOTTOM = '#EDF2FD';

interface InterestOption {
  /** Stored on the child profile — never translated. */
  key: string;
  labelKey: TranslationKey;
  Icon: LucideIcon;
  /** Each interest owns a colour, so the grid reads as eight things and not
      one blue wall. Tuned to sit alongside the brand blue without shouting. */
  color: string;
}

const INTEREST_OPTIONS: readonly InterestOption[] = [
  { key: 'drawing', labelKey: 'onboarding.interests.drawing', Icon: Palette, color: '#EC4899' },
  { key: 'animals', labelKey: 'onboarding.interests.animals', Icon: PawPrint, color: '#10B981' },
  { key: 'fairy_tales', labelKey: 'onboarding.interests.fairyTales', Icon: BookOpen, color: '#8B5CF6' },
  { key: 'space', labelKey: 'onboarding.interests.space', Icon: Rocket, color: '#2563EB' },
  { key: 'superheroes', labelKey: 'onboarding.interests.superheroes', Icon: Shield, color: '#F97316' },
  { key: 'games', labelKey: 'onboarding.interests.games', Icon: Gamepad2, color: '#0EA5E9' },
  { key: 'music', labelKey: 'onboarding.interests.music', Icon: Music, color: '#EAB308' },
  { key: 'nature', labelKey: 'onboarding.interests.nature', Icon: Leaf, color: '#22C55E' },
];

const MIN_SELECTED = 3;

/** rgba() from a #rrggbb literal — used for the soft icon wells. */
function tint(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export default function InterestsScreen() {
  const t = useT();
  const setPendingInterests = useOnboardingStore((s) => s.setPendingInterests);
  const persistedInterests = useOnboardingStore((s) => s.pendingInterests);
  const [selected, setSelected] = useState<readonly string[]>(
    persistedInterests,
  );

  const toggle = (key: string) => {
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const canContinue = selected.length >= MIN_SELECTED;

  const handleContinue = () => {
    setPendingInterests(selected);
    router.push('/(onboarding)/avatar');
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[BG_TOP, BG_MID, BG_BOTTOM]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* Eight tiles do not fit a short phone under the mascot, so the column
            centres when there is room and scrolls when there is not. */}
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.column}>
            <MascotImage size={132} glow="cosmic" />

            <Text style={styles.title}>{t('onboarding.interests.title')}</Text>
            <Text style={styles.subtitle}>
              {t('onboarding.interests.subtitle', { count: MIN_SELECTED })}
            </Text>

            <View style={styles.grid}>
              {INTEREST_OPTIONS.map((option) => {
                const isSelected = selected.includes(option.key);
                const label = t(option.labelKey);
                return (
                  <Pressable
                    key={option.key}
                    onPress={() => toggle(option.key)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected }}
                    accessibilityLabel={label}
                    style={({ pressed }) => [
                      glass(20, 'md'),
                      styles.tile,
                      isSelected && styles.tileOn,
                      pressed && styles.tilePressed,
                    ]}
                  >
                    {/* The well fills in on selection, so the choice is legible
                        from the icon alone rather than only from the border. */}
                    <View
                      style={[
                        styles.well,
                        {
                          backgroundColor: isSelected
                            ? option.color
                            : tint(option.color, 0.12),
                        },
                      ]}
                    >
                      <option.Icon
                        size={24}
                        color={isSelected ? '#FFFFFF' : option.color}
                        strokeWidth={2}
                      />
                    </View>

                    <Text
                      style={[styles.tileLabel, isSelected && styles.tileLabelOn]}
                      numberOfLines={2}
                    >
                      {label}
                    </Text>

                    {isSelected && (
                      <View style={styles.tick}>
                        <Check size={12} color="#FFFFFF" strokeWidth={3} />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>

            {/* How far off the minimum is, without making the child count tiles. */}
            <View style={styles.meter}>
              {Array.from({ length: MIN_SELECTED }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.meterDash,
                    i < selected.length
                      ? styles.meterDashOn
                      : styles.meterDashOff,
                  ]}
                />
              ))}
            </View>
            <Text style={[styles.status, canContinue && styles.statusReady]}>
              {canContinue
                ? t('onboarding.interests.ready')
                : t('onboarding.interests.selected', { count: selected.length })}
            </Text>

            <View style={styles.cta}>
              <PrimaryButton
                onPress={handleContinue}
                disabled={!canContinue}
                accessibilityLabel={t('common.continue')}
              >
                {t('common.continue')}
              </PrimaryButton>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  column: { alignItems: 'center', width: '100%', maxWidth: 345 },

  title: {
    marginTop: 20,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
    color: INK,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 16,
    color: MUTED,
    textAlign: 'center',
  },

  // ── The grid of eight ──────────────────────────────────────────────────
  grid: {
    marginTop: 24,
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  tile: {
    width: '48%',
    paddingHorizontal: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  // Selection reads twice over: a heavier edge and a faint wash of the brand
  // blue, so the picked tiles survive a glance at the whole grid.
  tileOn: {
    borderWidth: 2,
    borderColor: PRIMARY,
    backgroundColor: 'rgba(47,111,228,0.08)',
  },
  tilePressed: { opacity: 0.8 },
  well: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '500',
    color: INK,
    textAlign: 'center',
  },
  tileLabelOn: { fontWeight: '600', color: PRIMARY },
  tick: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Progress towards the minimum ───────────────────────────────────────
  meter: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  meterDash: { height: 6, borderRadius: 3 },
  meterDashOn: { width: 24, backgroundColor: PRIMARY },
  meterDashOff: { width: 12, backgroundColor: 'rgba(47,111,228,0.15)' },
  status: {
    marginTop: 8,
    fontSize: 14,
    color: MUTED,
    textAlign: 'center',
  },
  statusReady: { fontWeight: '500', color: PRIMARY },

  cta: { marginTop: 20, width: '100%' },
});
