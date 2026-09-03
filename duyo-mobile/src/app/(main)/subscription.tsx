import {
  classifyCheckoutError,
  type BillingPeriod,
  type CheckoutFailure,
  type PaidTier,
  type PaymentProvider,
  type TierInfo,
} from '@/api/endpoints/subscription';
import { ActionSheet } from '@/components/action-sheet';
import { Text } from '@/components/text';
import {
  useCheckout,
  useCancelSubscription,
  useCurrentSubscription,
  usePaymentSettlement,
  usePlans,
  useRefreshSubscription,
} from '@/hooks/use-subscription';
import { useT, type TranslateFn, type TranslationKey } from '@/i18n';
import { glass } from '@/lib/glass';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { ArrowLeft, Check } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Linking,
  Platform,
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
const OK = '#1E9E6A';
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
 * Where the purchase path exists at all.
 *
 * Checkout here leaves the app for Click or Payme, which Apple treats as an
 * external purchase link and rejects under App Store Review 3.1.1 — reliably,
 * not occasionally. Parvoz can ship the same Android flow only because its
 * iOS build sells the same tiers through Apple IAP with StoreKit 2; DUYO has
 * no StoreKit implementation of any kind, so on iOS there is nothing lawful
 * to offer and the affordance must not exist — no button, no price, no
 * gateway name, nothing that reads as "buy it over there". Adding IAP is
 * what would unlock this flag for iOS; until then the screen is a statement
 * of what the child has.
 */
const CAN_BUY_IN_APP = Platform.OS === 'android';

const MONTHS_IN_YEAR = 12;

/** The server's `PaidTier` literals, checked rather than assumed. */
function toPaidTier(key: string): PaidTier | null {
  return key === 'standart' || key === 'premium' ? key : null;
}

/** 29000 → "29 000". Grouped by hand: Intl is not guaranteed on Hermes. */
function groupThousands(amount: number): string {
  return String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** What a year costs against twelve months of the same plan, as a percent. */
function yearlySavingPercent(tier: TierInfo): number {
  const full = tier.price_monthly * MONTHS_IN_YEAR;
  if (full <= 0 || tier.price_yearly <= 0) return 0;
  return Math.round((1 - tier.price_yearly / full) * 100);
}

function failureMessage(t: TranslateFn, failure: CheckoutFailure): string {
  // The server's own sentence beats ours: until the owner sets the gateway
  // credentials, "not configured yet" IS the truth, and a generic "something
  // went wrong" would send someone hunting for a bug in working code.
  if (failure.kind === 'unconfigured') {
    return failure.detail ?? t('subscription.providerUnavailable');
  }
  if (failure.kind === 'offline') return t('subscription.checkoutOffline');
  return t('subscription.checkoutFailed');
}

/**
 * What the child is on, what it includes, and — on Android — how to buy it.
 *
 * Prices, the monthly/yearly toggle and the choose buttons all come from
 * GET /subscriptions/plans; nothing about money is written into this file.
 * Choosing calls POST /payments/checkout, which opens a pending order and
 * returns a Click/Payme URL that we hand to the system browser. The app never
 * activates anything: the gateway's webhook does that server-side, so after
 * the browser closes this screen's only honest move is to ask again — see
 * {@link usePaymentSettlement} for the window where the answer is "checking",
 * not "free".
 *
 * iOS renders the same screen with the whole purchase half absent; see
 * {@link CAN_BUY_IN_APP}.
 */
export default function SubscriptionScreen() {
  const t = useT();
  const plansQuery = usePlans();
  const currentQuery = useCurrentSubscription();
  const cancel = useCancelSubscription();
  const checkout = useCheckout();
  const refresh = useRefreshSubscription();
  const settlement = usePaymentSettlement(currentQuery.data);

  const [period, setPeriod] = useState<BillingPeriod>('monthly');
  const [pickerTier, setPickerTier] = useState<PaidTier | null>(null);
  const [failure, setFailure] = useState<CheckoutFailure | null>(null);

  const plans = plansQuery.data ?? [];
  const currentTier = currentQuery.data?.tier ?? 'free';
  const currentName =
    plans.find((p) => p.key === currentTier)?.name ?? currentTier;

  // Coming back from Click is not a navigation event: this screen never
  // blurred, the whole app went to the background. useFocusEffect alone would
  // never fire, and refetchOnWindowFocus is off in query-client.ts, so
  // AppState is the only signal that the child has returned from paying.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  // And this covers the ordinary case: arriving here from another screen.
  useFocusEffect(refresh);

  const startCheckout = (tier: PaidTier, provider: PaymentProvider) => {
    setFailure(null);
    const expiresBefore = currentQuery.data?.expires_at ?? null;
    checkout.mutate(
      { tier, period, provider },
      {
        onSuccess: (order) => {
          void Linking.openURL(order.checkout_url)
            // Only once the browser has actually taken it: a purchase we could
            // not hand off is not in flight, and must not say "checking".
            .then(() => settlement.begin(tier, expiresBefore))
            .catch(() => setFailure({ kind: 'unknown' }));
        },
        onError: (err) => setFailure(classifyCheckoutError(err)),
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

          {/* The plans have always promised "cancel any time"; until now the
              only way to do it was an email address. Paid users only — there
              is nothing to cancel on free, and offering it there reads as a
              way to lose something. */}
          {CAN_BUY_IN_APP && currentTier !== 'free' && (
            <Pressable
              onPress={() =>
                Alert.alert(
                  t('subscription.cancelTitle'),
                  t('subscription.cancelBody', { plan: currentName }),
                  [
                    { text: t('common.cancel'), style: 'cancel' },
                    {
                      text: t('subscription.cancelConfirm'),
                      style: 'destructive',
                      onPress: () => cancel.mutate(),
                    },
                  ],
                )
              }
              disabled={cancel.isPending}
              accessibilityRole="button"
              accessibilityLabel={t('subscription.cancelTitle')}
              style={({ pressed }) => [
                styles.cancelRow,
                styles.focusable,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.cancelText}>
                {cancel.isPending
                  ? t('common.sending')
                  : t('subscription.cancelTitle')}
              </Text>
            </Pressable>
          )}

          {/* ── The window between paying and owning ─────────────────── */}
          {settlement.isChecking && (
            <View style={[glass(20, 'md'), styles.noticeCard]}>
              <ActivityIndicator color={PRIMARY} />
              <View style={styles.noticeBody}>
                <Text style={styles.noticeTitle}>
                  {t('subscription.checking')}
                </Text>
                <Text style={styles.noticeText}>
                  {t('subscription.checkingHint')}
                </Text>
              </View>
            </View>
          )}
          {settlement.isSettled && (
            <View style={[glass(20, 'md'), styles.noticeCard, styles.noticeOk]}>
              <Check size={20} color={OK} strokeWidth={2.4} />
              <View style={styles.noticeBody}>
                <Text style={[styles.noticeTitle, styles.noticeTitleOk]}>
                  {t('subscription.activated', { plan: currentName })}
                </Text>
              </View>
            </View>
          )}
          {settlement.hasGivenUp && (
            <View style={[glass(20, 'md'), styles.noticeCard]}>
              <View style={styles.noticeBody}>
                <Text style={styles.noticeTitle}>
                  {t('subscription.notConfirmed')}
                </Text>
                <Text style={styles.noticeText}>
                  {t('subscription.notConfirmedHint')}
                </Text>
                <Pressable
                  onPress={settlement.checkAgain}
                  accessibilityRole="button"
                  accessibilityLabel={t('subscription.checkAgain')}
                  style={[styles.retry, styles.focusable]}
                >
                  <Text style={styles.retryText}>
                    {t('subscription.checkAgain')}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* ── Monthly / yearly ─────────────────────────────────────── */}
          {CAN_BUY_IN_APP && plans.length > 0 && (
            <View style={[glass(999, 'flush', 0.5), styles.periodBar]}>
              {(['monthly', 'yearly'] as const).map((option) => {
                const active = period === option;
                return (
                  <Pressable
                    key={option}
                    onPress={() => setPeriod(option)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={t(
                      option === 'monthly'
                        ? 'subscription.monthly'
                        : 'subscription.yearly',
                    )}
                    style={[
                      styles.periodChip,
                      active && styles.periodChipActive,
                      styles.focusable,
                    ]}
                  >
                    <Text
                      style={[
                        styles.periodChipText,
                        active && styles.periodChipTextActive,
                      ]}
                    >
                      {t(
                        option === 'monthly'
                          ? 'subscription.monthly'
                          : 'subscription.yearly',
                      )}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

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
            const paidTier = toPaidTier(tier.key);
            const price =
              period === 'yearly' ? tier.price_yearly : tier.price_monthly;
            const saving = yearlySavingPercent(tier);
            // Only the plan actually in flight says "opening"; the rest
            // merely go quiet, so a second tap cannot open a second order.
            const busy = checkout.isPending && checkout.variables?.tier === tier.key;

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
                  {CAN_BUY_IN_APP && price > 0 && (
                    <Text style={styles.planPrice}>
                      {t(
                        period === 'yearly'
                          ? 'subscription.priceYearly'
                          : 'subscription.priceMonthly',
                        { amount: groupThousands(price) },
                      )}
                    </Text>
                  )}
                  {CAN_BUY_IN_APP && period === 'yearly' && saving > 0 && (
                    <Text style={styles.planSaving}>
                      {t('subscription.yearlySave', { percent: saving })}
                    </Text>
                  )}
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

                {CAN_BUY_IN_APP && paidTier !== null && (
                  <Pressable
                    onPress={() => {
                      setFailure(null);
                      setPickerTier(paidTier);
                    }}
                    disabled={checkout.isPending}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: checkout.isPending }}
                    accessibilityLabel={t('subscription.choose')}
                    style={({ pressed }) => [
                      styles.choose,
                      isPremium && styles.choosePremium,
                      (pressed || checkout.isPending) && styles.choosePressed,
                      styles.focusable,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chooseText,
                        isPremium && styles.chooseTextPremium,
                      ]}
                    >
                      {busy ? t('subscription.opening') : t('subscription.choose')}
                    </Text>
                  </Pressable>
                )}
              </View>
            );
          })}

          {/* One message, under the plans: a failed checkout is about the
              gateway, not about the tier the child happened to tap. */}
          {CAN_BUY_IN_APP && failure !== null && (
            <View style={[glass(20, 'md'), styles.errorCard]}>
              <Text style={styles.errorText}>{failureMessage(t, failure)}</Text>
            </View>
          )}

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

      {/* Both gateways are configured independently server-side, so the choice
          is the child's and an unconfigured one answers for itself. */}
      <ActionSheet
        visible={CAN_BUY_IN_APP && pickerTier !== null}
        title={t('subscription.payWith')}
        message={t('subscription.payWithHint')}
        actions={PROVIDERS.map((provider) => ({
          label: PROVIDER_NAMES[provider],
          onPress: () => {
            if (pickerTier !== null) startCheckout(pickerTier, provider);
          },
        }))}
        onClose={() => setPickerTier(null)}
      />
    </View>
  );
}

const PROVIDERS = ['click', 'payme'] as const satisfies readonly PaymentProvider[];
/** Brand names, never translated. */
const PROVIDER_NAMES: Record<PaymentProvider, string> = {
  click: 'Click',
  payme: 'Payme',
};

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

  cancelRow: { paddingVertical: 14, alignItems: 'center' },
  cancelText: { fontSize: 14, fontWeight: '500', color: MUTED },
  noticeCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  noticeOk: {
    borderColor: 'rgba(30,158,106,0.35)',
    backgroundColor: 'rgba(30,158,106,0.10)',
  },
  noticeBody: { flexGrow: 1, flexShrink: 1, gap: 4 },
  noticeTitle: { fontSize: 14.5, fontWeight: '700', color: INK },
  noticeTitleOk: { color: OK },
  noticeText: { fontSize: 13, lineHeight: 18, color: MUTED },

  periodBar: { flexDirection: 'row', padding: 4, gap: 4 },
  periodChip: {
    flexGrow: 1,
    flexBasis: 0,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  periodChipActive: { backgroundColor: PRIMARY },
  periodChipText: { fontSize: 14, fontWeight: '700', color: MUTED },
  periodChipTextActive: { color: '#FFFFFF' },

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

  planHead: { alignItems: 'center', marginBottom: 16, gap: 4 },
  planName: { fontSize: 19, fontWeight: '700', color: INK },
  planPrice: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3, color: TITLE },
  planSaving: { fontSize: 12.5, fontWeight: '700', color: OK },

  currentNote: { alignItems: 'center', marginBottom: 12 },
  currentNoteText: { fontSize: 12, color: MUTED },

  featureList: { gap: 8 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText: { flexGrow: 1, flexShrink: 1, fontSize: 14, lineHeight: 20, color: INK },

  choose: {
    marginTop: 18,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: PRIMARY,
  },
  choosePremium: { backgroundColor: GOLD },
  choosePressed: { opacity: 0.75 },
  chooseText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  chooseTextPremium: { color: INK },

  includeTitle: {
    marginBottom: 16,
    fontSize: 16,
    fontWeight: '700',
    color: INK,
  },
  includeList: { gap: 12 },
});
