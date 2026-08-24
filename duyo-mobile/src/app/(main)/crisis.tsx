import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DuyoAvatar } from '@/components/duyo-avatar';
import { Text } from '@/components/text';
import { glass, lift } from '@/lib/glass';

// ── The glass sky, the inner screens' cooler morning ─────────────────────────
const PRIMARY = '#2F6FE4';
const INK = '#22406F';
const MUTED = '#8CA3CB';
const DANGER = '#E0455E';
const BG_TOP = '#E3EFFF';
const BG_MID = '#EAF3FF';
const BG_BOTTOM = '#EDF2FD';

type CrisisLevel = 'yellow' | 'orange' | 'red';

interface LevelCopy {
  title: string;
  message: string;
  /** The level's colour, on the card edge and nowhere else. */
  accent: string;
  /** The same colour washed over the sky, so the whole page carries the tone. */
  wash: string;
}

// The escalation has to stay readable AS escalation, so each level keeps its
// own hue. The yellow is darkened from the token's #FACC15: on a white pane a
// true yellow line disappears, and the one thing this screen may not do is
// look like nothing is being said.
const COPY: Record<CrisisLevel, LevelCopy> = {
  yellow: {
    title: 'Men seni tushunaman',
    message: "Ba'zan qiyin paytlar bo'ladi. Men seni tinglashga tayyorman.",
    accent: '#D9A200',
    wash: 'rgba(250,204,21,0.20)',
  },
  orange: {
    title: "Sen yolg'iz emassan",
    message:
      'Men senga yordam berishga tayyorman. Keling, ishonchli katta odam bilan gaplashaylik.',
    accent: '#E07B39',
    wash: 'rgba(224,123,57,0.18)',
  },
  red: {
    title: 'Sen muhimsan',
    message:
      "Men sening xavfsizligingni o'ylayman. Keling, hozir senga yordam beradigan odamni topamiz.",
    accent: DANGER,
    wash: 'rgba(224,69,94,0.16)',
  },
};

const HOTLINE_PSYCH = '1050';
const HOTLINE_CHILD = '1054';

function normalizeLevel(raw: string | undefined): CrisisLevel {
  if (raw === 'yellow' || raw === 'orange' || raw === 'red') return raw;
  return 'yellow';
}

function callHotline(number: string): void {
  void Linking.openURL(`tel:${number}`);
}

export default function CrisisScreen() {
  const params = useLocalSearchParams<{ level?: string }>();
  const level = normalizeLevel(params.level);
  const copy = COPY[level];

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[BG_TOP, BG_MID, BG_BOTTOM]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* The level's tone over the sky — what the old accent background said. */}
      <LinearGradient
        colors={[copy.wash, 'rgba(255,255,255,0)']}
        locations={[0, 0.7]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.avatar}>
            <DuyoAvatar size="xl" state="crisis-support" />
          </View>

          {/* The one hero object of the screen, and the only pane whose edge
              carries the level instead of the glass's own white. */}
          <View
            style={[
              glass(28, 'lg', 0.62),
              styles.hero,
              { borderWidth: 2, borderColor: copy.accent },
            ]}
          >
            <Text style={styles.heroTitle}>{copy.title}</Text>
            <Text style={styles.heroMessage}>{copy.message}</Text>
          </View>

          <View style={styles.actions}>
            {level === 'yellow' && <YellowActions />}
            {level === 'orange' && <OrangeActions />}
            {level === 'red' && <RedActions />}
          </View>

          <View style={[glass(24, 'md', 0.55), styles.help]}>
            <Text style={styles.helpTitle}>Yordam kerakmi?</Text>
            <Text style={styles.helpBody}>
              Sen xavfsizsan va sen yolg'iz emassan. Doimo yordam olish mumkin.
            </Text>
            {level === 'red' && (
              <View style={styles.hotlines}>
                <Text style={styles.hotlinesHeading}>Favqulodda raqamlar:</Text>
                <Pressable
                  onPress={() => callHotline(HOTLINE_PSYCH)}
                  accessibilityRole="button"
                  accessibilityLabel="Psixologik yordamga qo'ng'iroq"
                  style={[styles.hotline, styles.focusable]}
                >
                  <Text style={styles.hotlineText}>
                    {HOTLINE_PSYCH} — Psixologik yordam
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => callHotline(HOTLINE_CHILD)}
                  accessibilityRole="button"
                  accessibilityLabel="Bolalar telefoniga qo'ng'iroq"
                  style={[styles.hotline, styles.focusable]}
                >
                  <Text style={styles.hotlineText}>
                    {HOTLINE_CHILD} — Bolalar telefoni
                  </Text>
                </Pressable>
              </View>
            )}
          </View>

          <Text style={styles.disclaimer}>
            Bu suhbat maxfiy saqlanadi va faqat sen xavfsiz bo'lishingni
            ta'minlash uchun ishlatiladi.
          </Text>

          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            style={({ pressed }) => [
              glass(18, 'sm', 0.5),
              styles.close,
              styles.focusable,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.closeText}>Yopish</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function YellowActions() {
  return (
    <>
      <ActionButton
        label="DUYO bilan gaplashishda davom etish"
        primary
        onPress={() => router.back()}
      />
      <ActionButton
        label="Nafas olish mashqlari"
        onPress={() => router.back()}
      />
    </>
  );
}

function OrangeActions() {
  return (
    <>
      <ActionButton
        label="Ishonchli kattaga aytish"
        primary
        onPress={() => router.back()}
      />
      <ActionButton
        label="DUYO bilan gaplashishda davom etish"
        onPress={() => router.back()}
      />
      <ActionButton
        label="Nafas olish mashqlari"
        onPress={() => router.back()}
      />
    </>
  );
}

function RedActions() {
  return (
    <>
      <ActionButton
        label={`${HOTLINE_PSYCH} ga qo'ng'iroq — Psixologik yordam`}
        destructive
        onPress={() => callHotline(HOTLINE_PSYCH)}
      />
      <ActionButton
        label={`${HOTLINE_CHILD} ga qo'ng'iroq — Bolalar telefoni`}
        destructive
        onPress={() => callHotline(HOTLINE_CHILD)}
      />
      <ActionButton
        label="Ishonchli kattaga aytish"
        primary
        onPress={() => router.back()}
      />
    </>
  );
}

interface ActionButtonProps {
  label: string;
  onPress: () => void;
  primary?: boolean;
  destructive?: boolean;
}

function ActionButton({
  label,
  onPress,
  primary,
  destructive,
}: ActionButtonProps) {
  const filled = destructive === true || primary === true;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.action,
        styles.focusable,
        destructive
          ? styles.actionDanger
          : primary
            ? styles.actionPrimary
            : glass(18, 'md', 0.55),
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.actionLabel, filled && styles.actionLabelFilled]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  scroll: { padding: 24, gap: 20 },

  avatar: { alignItems: 'center', marginTop: 16 },

  hero: { padding: 24 },
  heroTitle: {
    marginBottom: 12,
    fontSize: 24,
    fontWeight: '700',
    color: INK,
    textAlign: 'center',
  },
  heroMessage: {
    fontSize: 16,
    lineHeight: 24,
    color: INK,
    textAlign: 'center',
  },

  actions: { gap: 12 },
  action: {
    height: 56,
    borderRadius: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // A filled button styles its own surface, so it takes the light on its own
  // (`lift`) rather than the whole glass material.
  actionPrimary: {
    backgroundColor: PRIMARY,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.30)',
    boxShadow: lift('md'),
  },
  actionDanger: {
    backgroundColor: DANGER,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.30)',
    boxShadow: lift('md'),
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: INK,
    textAlign: 'center',
  },
  actionLabelFilled: { color: '#FFFFFF' },

  help: { padding: 18 },
  helpTitle: {
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '700',
    color: INK,
  },
  helpBody: { fontSize: 14, lineHeight: 20, color: MUTED },
  hotlines: { marginTop: 12, gap: 6 },
  hotlinesHeading: { fontSize: 14, fontWeight: '700', color: INK },
  // A number a child in crisis has to hit is not a line of text: 40pt tall,
  // tinted, and obviously tappable.
  hotline: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: 'rgba(47,111,228,0.10)',
  },
  hotlineText: { fontSize: 14, fontWeight: '600', color: PRIMARY },

  disclaimer: {
    fontSize: 12,
    lineHeight: 18,
    color: MUTED,
    textAlign: 'center',
  },

  close: {
    marginTop: 4,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { fontSize: 15, fontWeight: '600', color: INK },

  pressed: { opacity: 0.8 },
  // The browser's default focus ring is a black rectangle around a rounded
  // control. RN's ViewStyle has no outline, so this is a web-only escape;
  // native ignores unknown keys.
  focusable: { outlineStyle: 'none', outlineWidth: 0 } as unknown as ViewStyle,
});
