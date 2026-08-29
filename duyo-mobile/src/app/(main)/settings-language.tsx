import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ArrowLeft, Check } from 'lucide-react-native';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { updateChild } from '@/api/endpoints/children';
import { Text } from '@/components/text';
import { FlagIcon } from '@/components/v2/flag-icon';
import { LANGUAGE_NAMES, useT, type TranslationKey } from '@/i18n';
import { glass } from '@/lib/glass';
import { useChildStore } from '@/store/child';
import { type Language, useLanguageStore } from '@/store/language';

// ── The glass sky, the inner screens' cooler morning ─────────────────────────
// Same family as settings and notifications: frosted panes on pale blue.
const PRIMARY = '#2F6FE4';
const INK = '#22406F';
const MUTED = '#8CA3CB';
const BG_TOP = '#E3EFFF';
const BG_MID = '#EAF3FF';
const BG_BOTTOM = '#EDF2FD';

interface LanguageOption {
  code: Language;
  hintKey: TranslationKey;
}

const OPTIONS: readonly LanguageOption[] = [
  { code: 'uz', hintKey: 'settings.languageScreen.hintUz' },
  { code: 'ru', hintKey: 'settings.languageScreen.hintRu' },
  { code: 'en', hintKey: 'settings.languageScreen.hintEn' },
];

export default function LanguageSettingsScreen() {
  const t = useT();
  const language = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);
  const child = useChildStore((s) => s.child);
  const setChild = useChildStore((s) => s.setChild);

  const handleSelect = (code: Language) => {
    if (code === language) return;
    setLanguage(code);

    // The profile carries the language the server reasons about — DUYO's
    // replies and generated content follow it. Best-effort: the UI has
    // already switched, and a failed sync must not block that.
    if (child) {
      setChild({ ...child, language: code });
      void updateChild(child.id, { language: code }).catch(() => undefined);
    }
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={[BG_TOP, BG_MID, BG_BOTTOM]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        {/* ── Header: 48pt glass round, the inner-screen pattern ─────── */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            style={[glass(24, 'sm'), styles.headerButton, styles.focusable]}
          >
            <ArrowLeft size={23} color={PRIMARY} strokeWidth={2} />
          </Pressable>
          <Text style={styles.title}>{t('settings.language')}</Text>
          {/* Keeps the title centred. */}
          <View style={styles.headerButton} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.subtitle}>
            {t('settings.languageScreen.subtitle')}
          </Text>
          {OPTIONS.map((opt) => {
            const isSel = opt.code === language;
            return (
              <Pressable
                key={opt.code}
                onPress={() => handleSelect(opt.code)}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSel }}
                accessibilityLabel={LANGUAGE_NAMES[opt.code]}
                // The chosen language sits a step nearer the reader and takes
                // the primary edge — the tick alone is easy to miss at a glance.
                style={({ pressed }) => [
                  glass(20, isSel ? 'lg' : 'md', isSel ? 0.75 : 0.55),
                  styles.option,
                  isSel && styles.optionSelected,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.optionRow}>
                  <FlagIcon code={opt.code} width={32} />
                  <View style={styles.optionBody}>
                    <Text style={styles.optionLabel}>
                      {LANGUAGE_NAMES[opt.code]}
                    </Text>
                    <Text style={styles.optionHint}>{t(opt.hintKey)}</Text>
                  </View>
                  {isSel ? (
                    <Check size={20} color={PRIMARY} strokeWidth={2.4} />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
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
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flexGrow: 1, flexShrink: 1,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: INK,
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 48,
    gap: 12,
  },
  subtitle: {
    marginLeft: 6,
    marginBottom: 2,
    fontSize: 14,
    lineHeight: 20,
    color: MUTED,
  },

  option: { padding: 16 },
  optionSelected: { borderColor: 'rgba(47,111,228,0.45)' },
  pressed: { opacity: 0.8 },
  focusable: { outlineStyle: 'none', outlineWidth: 0 } as unknown as ViewStyle,

  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionBody: { flex: 1, gap: 2 },
  optionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: INK,
  },
  optionHint: {
    fontSize: 13,
    color: MUTED,
  },
});
