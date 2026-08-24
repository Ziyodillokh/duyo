// =============================================================================
// OTA-ONA BO'LIMI O'CHIRILGAN — ilova hozircha faqat bola uchun.
// Ekranning asl kodi quyida to'liq kommentda saqlangan. Qayta yoqish uchun:
// stub'ni o'chiring va pastdagi qatorlardan "// " prefiksini oling.
//
// Kommentdagi kod nativewind'dan glass dizayn tizimiga ko'chirildi, shuning
// uchun qayta yoqilganda ekran boshqa ekranlar bilan bir xil ko'rinadi.
// =============================================================================
import { Redirect } from 'expo-router';

// ─── ASL KOD (o'chirilgan) ───────────────────────────────────────────────────
// import { useMutation } from '@tanstack/react-query';
// import { LinearGradient } from 'expo-linear-gradient';
// import { router, useLocalSearchParams } from 'expo-router';
// import { useState } from 'react';
// import {
//   Alert,
//   Pressable,
//   StyleSheet,
//   View,
//   type ViewStyle,
// } from 'react-native';
// import { SafeAreaView } from 'react-native-safe-area-context';

export default function FamilyConsentScreen() {
  return <Redirect href="/" />;
}
//
// import {
//   acceptFamilyInvite,
//   declineFamilyInvite,
// } from '@/api/endpoints/family';
// import { Text } from '@/components/text';
// import { MascotImage } from '@/components/v2/mascot-image';
// import { PrimaryButton } from '@/components/v2/primary-button';
// import { useT } from '@/i18n';
// import { glass } from '@/lib/glass';
// import { useOnboardingStore } from '@/store/onboarding';
//
// // ── The glass sky, the same morning as the rest of onboarding ─────────────
// const PRIMARY = '#2F6FE4';
// const INK = '#22406F';
// const MUTED = '#8CA3CB';
// const DANGER = '#E0455E';
// const BG_TOP = '#E3EFFF';
// const BG_MID = '#EAF3FF';
// const BG_BOTTOM = '#EDF2FD';
//
// /**
//  * "Someone wants to add you to their family — is that them?"
//  *
//  * This screen is the security boundary of the whole invite feature. The
//  * number a parent types is unverified: nothing proves they know its owner,
//  * and a single mistyped digit reaches a stranger. Signing in used to link
//  * the accounts by itself, which meant typing someone's number was enough to
//  * become the recorded parent of their profile — reading their chats and
//  * safety reports, and receiving the crisis alerts meant for the real parent.
//  *
//  * So the inviter's phone number is shown, prominently, and nothing is linked
//  * until the person holding this phone says yes.
//  */
// export default function FamilyConsentScreen() {
//   const t = useT();
//   const params = useLocalSearchParams<{
//     childName: string;
//     fromPhone: string;
//   }>();
//   const childName = params.childName ?? '';
//   const fromPhone = params.fromPhone ?? '';
//   const setPendingName = useOnboardingStore((s) => s.setPendingName);
//   const [decided, setDecided] = useState(false);
//
//   const accept = useMutation({
//     mutationFn: acceptFamilyInvite,
//     onSuccess: () => {
//       setDecided(true);
//       // The parent already gave the name; the child answers the rest.
//       setPendingName(childName);
//       router.replace('/(onboarding)/age');
//     },
//     onError: () => Alert.alert(t('common.error'), t('common.tryLater')),
//   });
//
//   const decline = useMutation({
//     mutationFn: declineFamilyInvite,
//     onSuccess: () => {
//       setDecided(true);
//       // Refusing is not an error — it just means a normal, solo account.
//       router.replace('/(onboarding)/child-name');
//     },
//     onError: () => Alert.alert(t('common.error'), t('common.tryLater')),
//   });
//
//   const busy = accept.isPending || decline.isPending || decided;
//
//   const confirmDecline = () =>
//     Alert.alert(
//       t('onboarding.familyConsent.declineTitle'),
//       t('onboarding.familyConsent.declineBody'),
//       [
//         { text: t('common.cancel'), style: 'cancel' },
//         {
//           text: t('onboarding.familyConsent.decline'),
//           style: 'destructive',
//           onPress: () => decline.mutate(),
//         },
//       ],
//     );
//
//   return (
//     <View style={styles.root}>
//       <LinearGradient
//         colors={[BG_TOP, BG_MID, BG_BOTTOM]}
//         locations={[0, 0.55, 1]}
//         style={StyleSheet.absoluteFill}
//       />
//
//       <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
//         <View style={styles.page}>
//           <View style={styles.column}>
//             <MascotImage size={150} glow="cosmic" />
//
//             {/* The decision card is the one thing on the page, so it is the
//                 pane lifted to `lg`; the two wells inside it are `flush`,
//                 because a pane cannot cast a shadow onto its own card. */}
//             <View style={[glass(24, 'lg'), styles.card]}>
//               <View style={styles.head}>
//                 <Text style={styles.title}>
//                   {t('onboarding.familyConsent.title')}
//                 </Text>
//                 <Text style={styles.subtitle}>
//                   {t('onboarding.familyConsent.subtitle')}
//                 </Text>
//               </View>
//
//               {/* The number is the whole decision — show it, not a summary. */}
//               <View style={[glass(16, 'flush'), styles.phoneWell]}>
//                 <Text style={styles.phoneLabel}>
//                   {t('onboarding.familyConsent.fromLabel')}
//                 </Text>
//                 <Text style={styles.phone}>{fromPhone}</Text>
//                 {!!childName && (
//                   <Text style={styles.phoneNote}>
//                     {t('onboarding.familyConsent.willCallYou', {
//                       name: childName,
//                     })}
//                   </Text>
//                 )}
//               </View>
//
//               <View style={[glass(14, 'flush', 0.62), styles.meansWell]}>
//                 <Text style={styles.meansText}>
//                   {t('onboarding.familyConsent.whatItMeans')}
//                 </Text>
//               </View>
//
//               <View style={styles.accept}>
//                 <PrimaryButton
//                   onPress={() => accept.mutate()}
//                   disabled={busy}
//                   accessibilityLabel={t('onboarding.familyConsent.accept')}
//                 >
//                   {accept.isPending
//                     ? t('common.saving')
//                     : t('onboarding.familyConsent.accept')}
//                 </PrimaryButton>
//               </View>
//
//               <Pressable
//                 onPress={confirmDecline}
//                 disabled={busy}
//                 accessibilityRole="button"
//                 accessibilityLabel={t('onboarding.familyConsent.decline')}
//                 style={[styles.decline, styles.focusable]}
//               >
//                 <Text style={styles.declineText}>
//                   {t('onboarding.familyConsent.decline')}
//                 </Text>
//               </Pressable>
//             </View>
//
//             <Text style={styles.helper}>
//               {t('onboarding.familyConsent.helper')}
//             </Text>
//           </View>
//         </View>
//       </SafeAreaView>
//     </View>
//   );
// }
//
// const styles = StyleSheet.create({
//   root: { flex: 1 },
//   safe: { flex: 1 },
//   page: {
//     flex: 1,
//     paddingHorizontal: 24,
//     alignItems: 'center',
//     justifyContent: 'center',
//   },
//   // The column the whole onboarding flow is set in: never wider than 345,
//   // centred on a tablet.
//   column: { width: '100%', maxWidth: 345, alignItems: 'center' },
//
//   card: { width: '100%', marginTop: 24, padding: 24 },
//   head: { alignItems: 'center', gap: 8 },
//   title: {
//     fontSize: 22,
//     lineHeight: 28,
//     fontWeight: '700',
//     color: INK,
//     textAlign: 'center',
//   },
//   subtitle: { fontSize: 16, color: MUTED, textAlign: 'center' },
//
//   // Tinted rather than white: this well is the claim being weighed, not
//   // another sheet of the same glass.
//   phoneWell: {
//     marginTop: 20,
//     paddingHorizontal: 16,
//     paddingVertical: 16,
//     alignItems: 'center',
//     gap: 4,
//     backgroundColor: 'rgba(47,111,228,0.06)',
//     borderColor: 'rgba(47,111,228,0.20)',
//   },
//   phoneLabel: { fontSize: 14, color: MUTED },
//   phone: { fontSize: 20, fontWeight: '700', color: PRIMARY },
//   phoneNote: {
//     marginTop: 4,
//     fontSize: 14,
//     color: MUTED,
//     textAlign: 'center',
//   },
//
//   meansWell: {
//     marginTop: 16,
//     paddingHorizontal: 16,
//     paddingVertical: 12,
//   },
//   meansText: {
//     fontSize: 14,
//     lineHeight: 20,
//     color: INK,
//     textAlign: 'center',
//   },
//
//   accept: { marginTop: 24 },
//
//   // Padded to a real 40pt row: the label alone was a ~20pt tap target.
//   decline: {
//     marginTop: 16,
//     minHeight: 40,
//     paddingVertical: 10,
//     paddingHorizontal: 16,
//     alignItems: 'center',
//     justifyContent: 'center',
//   },
//   declineText: { fontSize: 14, fontWeight: '500', color: DANGER },
//   // The browser's default focus ring is a black rectangle around a rounded
//   // control. RN's ViewStyle has no outline, so this is a web-only escape;
//   // native ignores unknown keys.
//   focusable: { outlineStyle: 'none', outlineWidth: 0 } as unknown as ViewStyle,
//
//   helper: {
//     marginTop: 20,
//     paddingHorizontal: 8,
//     fontSize: 12,
//     lineHeight: 16,
//     color: MUTED,
//     textAlign: 'center',
//   },
// });
//
