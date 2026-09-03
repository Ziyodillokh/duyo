import { Text } from '@/components/text';
import { usePlans, useCurrentSubscription } from '@/hooks/use-subscription';
import { useT, type TranslationKey } from '@/i18n';
import { glass } from '@/lib/glass';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ArrowLeft, Check } from 'lucide-react-native';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// ── The glass sky, the inner screens' cooler morning ─────────────────────────
const PRIMARY = '#2F6FE4';
const TITLE = '#2A63DC';
const INK = '#22406F';
const MUTED = '#8CA3CB';
const DANGER = '#E0455E';
const BG_TOP = '#E3EFFF';
const BG_MID = '#EAF3FF';
const BG_BOTTOM = '#EDF2FD';
/** Premium keeps its gold — it is the tier's identity, not a theme colour. */
const GOLD = '#FDC700';

// Keys, not sentences: a module constant is frozen at import and would keep
// speaking Uzbek after the child switches language.
const ALL_PLAN_BENEFITS = [
  'subscription.benefit.cancel',
  'subscription.benefit.support',
] as const satisfies readonly TranslationKey[];

// The premium tier gets the gold "Premium" treatment.
const PREMIUM_KEY = 'premium';

/**
 * What the child is on, and what it includes. NOT a shop.
 *
 * Google Play requires Play Billing for a digital subscription consumed
 * inside the app, and separately forbids "leading users to other payment
 * methods" through in-app promotions, buttons, links or messaging. This
 * app sold one through Click/Payme, which was both at once. Prices, the
 * monthly/yearly toggle, the "choose" button and the payment screen
 * behind them are all gone; the plan and its benefits stay, because
 * telling a child what they have is not selling them anything.
 *
 * The gateways still exist server-side for duyo.uz. Nothing in the app
 * may mention that — saying where to buy is itself the violation.
 */
export default function SubscriptionScreen() {
  const t = useT();
  const plansQuery = usePlans();
  const currentQuery = useCurrentSubscription();
  const plans = plansQuery.data ?? [];
  const currentTier = currentQuery.data?.tier ?? 'free';

  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={[BG_TOP, BG_MID, BG_BOTTOM]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
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
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Heading */}
          <View style={styles.heading}>
            <Text style={styles.headingTitle}>{t('subscription.title')}</Text>
            <Text style={styles.headingBlurb}>{t('subscription.subtitle')}</Text>
          </View>

          {/* Pricing cards */}
          {plansQuery.isLoading && (
            <View style={styles.loading}>
              <ActivityIndicator color={PRIMARY} />
            </View>
          )}
          {plansQuery.isError && (
            <View style={[glass(20, 'md'), styles.errorCard]}>
              <Text style={styles.errorText}>
                {t('subscription.loadFailed')}
              </Text>
              <Pressable
                onPress={() => plansQuery.refetch()}
                accessibilityRole="button"
                accessibilityLabel={t('common.retry')}
                style={[styles.retry, styles.focusable]}
              >
                <Text style={styles.retryText}>{t('common.retry')}</Text>
              </Pressable>
            </View>
          )}
          {plans.map((tier) => {
            const isPremium = tier.key === PREMIUM_KEY;
            const isCurrent = tier.key === currentTier;

            return (
              // Premium sits one rung higher than the rest of the ladder —
              // it is the object the screen is selling.
              <View
                key={tier.key}
                style={[
                  glass(24, isPremium ? 'lg' : 'md', isPremium ? 0.72 : 0.55),
                  styles.plan,
                  isPremium && styles.planPremium,
                  isCurrent && styles.planCurrent,
                ]}
              >
                {isPremium && (
                  <View style={styles.premiumBadge}>
                    <Text style={styles.premiumBadgeText}>Premium</Text>
                  </View>
                )}

                <View style={styles.planHead}>
                  <Text style={styles.planName}>{tier.name}</Text>
                </View>

                {isCurrent && (
                  <View style={styles.currentNote}>
                    <Text style={styles.currentNoteText}>
                      {t('subscription.current')}
                    </Text>
                  </View>
                )}

                <View style={styles.featureList}>
                  {tier.features.map((f) => (
                    <View key={f} style={styles.featureRow}>
                      <Check size={15} color={PRIMARY} strokeWidth={2.4} />
                      <Text style={styles.featureText}>{f}</Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          })}

          {/* All plans include */}
          <View style={[glass(24, 'md'), styles.plan]}>
            <Text style={styles.includeTitle}>{t('subscription.allPlans')}</Text>
            <View style={styles.includeList}>
              {ALL_PLAN_BENEFITS.map((key) => (
                <View key={key} style={styles.featureRow}>
                  <Check size={15} color={PRIMARY} strokeWidth={2.4} />
                  <Text style={styles.featureText}>{t(key)}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // The browser's default focus ring is a black rectangle around a rounded
  // control. RN's ViewStyle has no outline, so this is a web-only escape;
  // native ignores unknown keys.
  focusable: { outlineStyle: 'none', outlineWidth: 0 } as unknown as ViewStyle,

  header: {
    height: 68,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  headerButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },

  scroll: {
    paddingHorizontal: 20,
    paddingTop: 2,
    paddingBottom: 40,
    gap: 20,
  },

  heading: { gap: 4 },
  headingTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.4,
    color: TITLE,
  },
  headingBlurb: { fontSize: 14, color: MUTED },

  loading: { alignItems: 'center', padding: 32 },

  errorCard: {
    padding: 16,
    borderColor: 'rgba(224,69,94,0.35)',
    backgroundColor: 'rgba(224,69,94,0.10)',
  },
  errorText: { fontSize: 14, fontWeight: '600', color: DANGER },
  retry: { alignSelf: 'flex-start', marginTop: 4, paddingVertical: 8 },
  retryText: { fontSize: 14, fontWeight: '700', color: PRIMARY },

  plan: { padding: 20 },
  planPremium: { borderColor: GOLD },
  planCurrent: { borderWidth: 2, borderColor: PRIMARY },
  premiumBadge: {
    alignSelf: 'center',
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: GOLD,
  },
  premiumBadgeText: { fontSize: 11, fontWeight: '800', color: INK },

  planHead: { alignItems: 'center', marginBottom: 16 },
  planName: { fontSize: 19, fontWeight: '700', color: INK },

  currentNote: { alignItems: 'center', marginBottom: 12 },
  currentNoteText: { fontSize: 12, color: MUTED },

  featureList: { gap: 8 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText: { flexGrow: 1, flexShrink: 1, fontSize: 14, lineHeight: 20, color: INK },

  includeTitle: {
    marginBottom: 16,
    fontSize: 16,
    fontWeight: '700',
    color: INK,
  },
  includeList: { gap: 12 },
});
