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
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { useT, type TranslationKey } from '@/i18n';
import { glass } from '@/lib/glass';

// ── The glass sky, the inner screens' cooler morning ─────────────────────────
// Same family as settings and notifications: frosted panes on pale blue. Like
// its parent screen this one commits to the light look, so there is no theme
// branch left to read here.
const PRIMARY = '#2F6FE4';
const INK = '#22406F';
const MUTED = '#8CA3CB';
const BG_TOP = '#E3EFFF';
const BG_MID = '#EAF3FF';
const BG_BOTTOM = '#EDF2FD';

interface FAQItem {
  id: string;
  questionKey: TranslationKey;
  answerKey: TranslationKey;
}

const FAQ_ITEMS: readonly FAQItem[] = [
  {
    id: 'q1',
    questionKey: 'settings.helpScreen.q1',
    answerKey: 'settings.helpScreen.a1',
  },
  {
    id: 'q2',
    questionKey: 'settings.helpScreen.q2',
    answerKey: 'settings.helpScreen.a2',
  },
  {
    id: 'q3',
    questionKey: 'settings.helpScreen.q3',
    answerKey: 'settings.helpScreen.a3',
  },
  {
    id: 'q4',
    questionKey: 'settings.helpScreen.q4',
    answerKey: 'settings.helpScreen.a4',
  },
  {
    id: 'q5',
    questionKey: 'settings.helpScreen.q5',
    answerKey: 'settings.helpScreen.a5',
  },
];

export default function HelpSettingsScreen() {
  const t = useT();
  const [openId, setOpenId] = useState<string | null>(null);

  const toggle = (id: string) =>
    setOpenId((current) => (current === id ? null : id));

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
          <Text style={styles.title}>{t('settings.help')}</Text>
          {/* Keeps the title centred. */}
          <View style={styles.headerButton} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('settings.helpScreen.faqSection')}
            </Text>
            {FAQ_ITEMS.map((f) => {
              const isOpen = openId === f.id;
              return (
                <Pressable
                  key={f.id}
                  onPress={() => toggle(f.id)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isOpen }}
                  accessibilityLabel={t(f.questionKey)}
                  // An open card lifts a step and frosts over, so the answer
                  // being read is the nearest thing on the page.
                  style={({ pressed }) => [
                    glass(20, isOpen ? 'lg' : 'md', isOpen ? 0.72 : 0.55),
                    styles.card,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.cardHead}>
                    <Text style={styles.question}>{t(f.questionKey)}</Text>
                    {isOpen ? (
                      <ChevronUp size={20} color={MUTED} strokeWidth={2.2} />
                    ) : (
                      <ChevronDown size={20} color={MUTED} strokeWidth={2.2} />
                    )}
                  </View>
                  {isOpen ? (
                    <Text style={styles.answer}>{t(f.answerKey)}</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('settings.helpScreen.contact')}
            </Text>
            <Pressable
              onPress={() =>
                Alert.alert(
                  t('settings.helpScreen.email'),
                  t('settings.helpScreen.emailBody'),
                )
              }
              accessibilityRole="button"
              accessibilityLabel="Email"
              style={({ pressed }) => [
                glass(20, 'md'),
                styles.card,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.contactRow}>
                <View style={styles.iconWell}>
                  <Mail size={18} color={PRIMARY} strokeWidth={2} />
                </View>
                <View style={styles.contactBody}>
                  <Text style={styles.contactLabel}>
                    {t('settings.helpScreen.email')}
                  </Text>
                  <Text style={styles.contactValue}>support@duyo.uz</Text>
                </View>
                <ExternalLink size={18} color={MUTED} strokeWidth={2.2} />
              </View>
            </Pressable>

            <Pressable
              onPress={() =>
                Alert.alert(
                  'Telegram',
                  t('settings.helpScreen.telegramBody'),
                )
              }
              accessibilityRole="button"
              accessibilityLabel="Telegram"
              style={({ pressed }) => [
                glass(20, 'md'),
                styles.card,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.contactRow}>
                <View style={styles.iconWell}>
                  <MessageSquare size={18} color={PRIMARY} strokeWidth={2} />
                </View>
                <View style={styles.contactBody}>
                  <Text style={styles.contactLabel}>
                    {t('settings.helpScreen.telegram')}
                  </Text>
                  <Text style={styles.contactValue}>@duyo_support</Text>
                </View>
                <ExternalLink size={18} color={MUTED} strokeWidth={2.2} />
              </View>
            </Pressable>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>DUYO v1.0.0</Text>
            <Text style={styles.footerFine}>{t('common.copyright')}</Text>
          </View>
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
    flex: 1,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: INK,
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 48,
    gap: 24,
  },
  section: { gap: 10 },
  sectionTitle: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: MUTED,
  },

  card: { padding: 16 },
  pressed: { opacity: 0.8 },
  focusable: { outlineStyle: 'none', outlineWidth: 0 } as unknown as ViewStyle,

  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  question: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: INK,
  },
  answer: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 22,
    color: MUTED,
  },

  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWell: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(47,111,228,0.10)',
  },
  contactBody: { flex: 1, gap: 2 },
  contactLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: INK,
  },
  contactValue: {
    fontSize: 13,
    color: MUTED,
  },

  footer: {
    alignItems: 'center',
    gap: 2,
    paddingTop: 8,
  },
  footerText: {
    fontSize: 13,
    color: MUTED,
  },
  footerFine: {
    fontSize: 12,
    color: MUTED,
  },
});
