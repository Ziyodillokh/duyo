import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Compass, Gamepad2, GraduationCap, Minus, Plus, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/text';

import { MascotImage } from '@/components/v2/mascot-image';
import { PrimaryButton } from '@/components/v2/primary-button';
import { useT, type TranslationKey } from '@/i18n';
import { glass } from '@/lib/glass';
import { useOnboardingStore } from '@/store/onboarding';

// ── The glass sky, the same pale morning the inner screens wake up to ────────
const INK = '#22406F';
const MUTED = '#8CA3CB';
const BG_TOP = '#E3EFFF';
const BG_MID = '#EAF3FF';
const BG_BOTTOM = '#EDF2FD';
/** The unpicked ticks on the ruler — quiet enough to read as "not this one". */
const TICK_OFF = '#94A3B8';

const MIN_AGE = 13;
const MAX_AGE = 16;
const DEFAULT_AGE = 14;
const AGES = Array.from({ length: MAX_AGE - MIN_AGE + 1 }, (_, i) => MIN_AGE + i);

interface Segment {
  key: 'junior' | 'explorer' | 'companion';
  from: number;
  to: number;
  nameKey: TranslationKey;
  descKey: TranslationKey;
  Icon: LucideIcon;
  /** Each age band owns a colour, so the whole screen re-tints as the child
   *  crosses into it — the number, the badge, the ruler — and the change of
   *  band is felt, not just read. */
  colour: string;
}

const SEGMENTS: readonly Segment[] = [
  // Two bands, not three. The junior band was 7-10 and the app is 13+ now;
  // the boundary matches the server's AgeSegment.from_age, which puts 13 in
  // EXPLORER and 14-16 in COMPANION.
  { key: 'explorer', from: 13, to: 13, nameKey: 'onboarding.age.segment.explorer', descKey: 'onboarding.age.segment.explorerDesc', Icon: Compass, colour: '#2563EB' },
  { key: 'companion', from: 14, to: 16, nameKey: 'onboarding.age.segment.companion', descKey: 'onboarding.age.segment.companionDesc', Icon: GraduationCap, colour: '#8B5CF6' },
];

function segmentOf(age: number): Segment {
  return SEGMENTS.find((s) => age >= s.from && age <= s.to) ?? SEGMENTS[0];
}

/** rgba() from a #rrggbb literal. */
function tint(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export default function AgeScreen() {
  const t = useT();
  const setPendingAge = useOnboardingStore((s) => s.setPendingAge);
  const persistedAge = useOnboardingStore((s) => s.pendingAge);
  const [age, setAge] = useState(persistedAge ?? DEFAULT_AGE);
  const seg = segmentOf(age);

  const handleContinue = () => {
    setPendingAge(age);
    router.push('/(onboarding)/interests');
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[BG_TOP, BG_MID, BG_BOTTOM]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.column}>
            <MascotImage size={132} glow="cosmic" />

            <Text style={styles.title}>{t('onboarding.age.title')}</Text>
            <Text style={styles.subtitle}>{t('onboarding.age.subtitle')}</Text>

            {/* The number, flanked by steppers. Big and coloured by band. */}
            <View style={styles.stepperRow}>
              <StepButton
                Icon={Minus}
                disabled={age <= MIN_AGE}
                onPress={() => setAge((a) => Math.max(MIN_AGE, a - 1))}
                label={t('onboarding.age.decrease')}
                colour={seg.colour}
              />
              <View style={styles.ageWell}>
                <Text style={[styles.ageNumber, { color: seg.colour }]}>{age}</Text>
                <Text style={[styles.ageUnit, { color: seg.colour }]}>
                  {t('onboarding.age.years')}
                </Text>
              </View>
              <StepButton
                Icon={Plus}
                disabled={age >= MAX_AGE}
                onPress={() => setAge((a) => Math.min(MAX_AGE, a + 1))}
                label={t('onboarding.age.increase')}
                colour={seg.colour}
              />
            </View>

            {/* A ruler of every age, one tap each. Bands are readable from the
                tick colours alone, and the chosen age stands proud. */}
            <View style={styles.ruler} accessibilityRole="radiogroup">
              {AGES.map((a) => {
                const s = segmentOf(a);
                const active = a === age;
                return (
                  <Pressable
                    key={a}
                    onPress={() => setAge(a)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${a} ${t('onboarding.age.years')}`}
                    hitSlop={6}
                    style={[styles.tickColumn, styles.focusable]}
                  >
                    <View
                      style={{
                        width: active ? 12 : 8,
                        height: active ? 12 : 8,
                        borderRadius: active ? 6 : 4,
                        backgroundColor: active ? s.colour : tint(s.colour, 0.28),
                        borderWidth: active ? 2 : 0,
                        borderColor: '#FFFFFF',
                      }}
                    />
                    <Text
                      style={[
                        active ? styles.tickLabelOn : styles.tickLabel,
                        { color: active ? s.colour : TICK_OFF },
                      ]}
                    >
                      {a}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Band card — what this age unlocks. The pane stays glass and the
                band speaks through its edge, its disc and its badge. */}
            <View
              style={[
                glass(22, 'md'),
                styles.bandCard,
                { borderColor: tint(seg.colour, 0.35) },
              ]}
            >
              <View style={[styles.bandDisc, { backgroundColor: seg.colour }]}>
                <seg.Icon size={22} color="#FFFFFF" strokeWidth={2.2} />
              </View>
              <View style={styles.bandBody}>
                <View style={styles.bandHeading}>
                  <Text style={styles.bandName}>{t(seg.nameKey)}</Text>
                  <View
                    style={[styles.bandBadge, { backgroundColor: tint(seg.colour, 0.18) }]}
                  >
                    <Text style={[styles.bandBadgeText, { color: seg.colour }]}>
                      {seg.from}–{seg.to}
                    </Text>
                  </View>
                </View>
                <Text style={styles.bandDesc}>{t(seg.descKey)}</Text>
              </View>
            </View>

            <View style={styles.cta}>
              <PrimaryButton
                onPress={handleContinue}
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

function StepButton({
  Icon,
  disabled,
  onPress,
  label,
  colour,
}: {
  Icon: LucideIcon;
  disabled: boolean;
  onPress: () => void;
  label: string;
  colour: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        glass(26, 'sm'),
        styles.step,
        styles.focusable,
        {
          backgroundColor: disabled ? 'rgba(148, 163, 184, 0.12)' : tint(colour, 0.12),
          borderColor: disabled ? 'rgba(148, 163, 184, 0.25)' : tint(colour, 0.35),
          // What `active:opacity-70` used to do, plus the disabled dim.
          opacity: disabled ? 0.55 : pressed ? 0.7 : 1,
        },
      ]}
    >
      <Icon size={22} color={disabled ? TICK_OFF : colour} strokeWidth={2.4} />
    </Pressable>
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

  // ── Steppers and the number ────────────────────────────────────────────
  stepperRow: {
    marginTop: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
  },
  step: {
    width: 52,
    height: 52,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The browser's default focus ring is a black rectangle around a round
  // control. RN's ViewStyle has no outline, so this is a web-only escape;
  // native ignores unknown keys.
  focusable: { outlineStyle: 'none', outlineWidth: 0 } as unknown as ViewStyle,
  ageWell: { alignItems: 'center', minWidth: 118 },
  ageNumber: {
    fontSize: 84,
    lineHeight: 92,
    fontWeight: '700',
    // Tabular figures: 7 and 11 must not shuffle the steppers sideways.
    fontVariant: ['tabular-nums'],
  },
  ageUnit: { marginTop: -4, fontSize: 14, fontWeight: '500' },

  // ── The ruler ──────────────────────────────────────────────────────────
  ruler: {
    marginTop: 24,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  // 30 wide and padded to ~43 tall: hitSlop does not enlarge the element on
  // web, so the tap target has to be real.
  tickColumn: { width: 30, alignItems: 'center', paddingVertical: 5 },
  tickLabel: { marginTop: 6, fontSize: 11 },
  tickLabelOn: { marginTop: 6, fontSize: 12, fontWeight: '700' },

  // ── Band card ──────────────────────────────────────────────────────────
  bandCard: {
    marginTop: 20,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  bandDisc: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bandBody: { flex: 1 },
  bandHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bandName: { fontSize: 16, fontWeight: '700', color: INK },
  bandBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  bandBadgeText: { fontSize: 11, fontWeight: '600' },
  bandDesc: { marginTop: 2, fontSize: 13, color: MUTED },

  cta: { marginTop: 24, width: '100%' },
});
