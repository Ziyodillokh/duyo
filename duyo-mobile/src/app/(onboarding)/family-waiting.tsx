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
// import { useQuery } from '@tanstack/react-query';
// import { LinearGradient } from 'expo-linear-gradient';
// import { router } from 'expo-router';
// import { useEffect } from 'react';
// import {
//   ActivityIndicator,
//   Alert,
//   Pressable,
//   StyleSheet,
//   View,
//   type ViewStyle,
// } from 'react-native';
// import { SafeAreaView } from 'react-native-safe-area-context';

export default function FamilyWaitingScreen() {
  return <Redirect href="/" />;
}
//
// import { listChildren } from '@/api/endpoints/children';
// import { getFamilyInvite } from '@/api/endpoints/family';
// import { Text } from '@/components/text';
// import { MascotImage } from '@/components/v2/mascot-image';
// import { useT } from '@/i18n';
// import { glass } from '@/lib/glass';
// import { useAuthStore } from '@/store/auth';
// import { useChildStore } from '@/store/child';
// import { useMascotStore } from '@/store/mascot';
// import { useOnboardingStore } from '@/store/onboarding';
//
// // ── The glass sky, the same morning as the rest of onboarding ─────────────
// const PRIMARY = '#2F6FE4';
// const INK = '#22406F';
// const MUTED = '#8CA3CB';
// const HAIRLINE = 'rgba(47,111,228,0.10)';
// const BG_TOP = '#E3EFFF';
// const BG_MID = '#EAF3FF';
// const BG_BOTTOM = '#EDF2FD';
//
// const POLL_MS = 4000;
//
// /**
//  * The parent waits here after sending a link code.
//  *
//  * Everything below the spinner exists because waiting can END BADLY and the
//  * screen has to say so. The number is unverified — one wrong digit sends the
//  * code to a stranger who will never install the app — and the invitee can
//  * refuse or simply let the offer expire. A screen that only ever spins would
//  * strand the parent on a dead invite with no way to correct it, and this
//  * route is re-entered on every app launch, so "kill the app" is not an exit.
//  */
// export default function FamilyWaitingScreen() {
//   const t = useT();
//   const setChild = useChildStore((s) => s.setChild);
//   const setMascotVariant = useMascotStore((s) => s.setVariant);
//   const resetOnboarding = useOnboardingStore((s) => s.reset);
//   const clearAuth = useAuthStore((s) => s.clearAuth);
//   const clearChild = useChildStore((s) => s.clearChild);
//
//   const invite = useQuery({
//     queryKey: ['family-invite-status'],
//     queryFn: getFamilyInvite,
//     refetchInterval: POLL_MS,
//   });
//
//   const children = useQuery({
//     queryKey: ['family-waiting-children'],
//     queryFn: listChildren,
//     refetchInterval: POLL_MS,
//   });
//
//   useEffect(() => {
//     const child = children.data?.[0];
//     if (!child) return;
//     setChild(child);
//     if (child.mascot === 'raccoon' || child.mascot === 'duyo') {
//       setMascotVariant(child.mascot);
//     }
//     resetOnboarding();
//     router.replace('/(main)/parent-dashboard');
//   }, [children.data, setChild, setMascotVariant, resetOnboarding]);
//
//   const data = invite.data;
//   const declined = data?.declined_at != null;
//   const expired =
//     !!data && !data.claimed && !declined && new Date(data.expires_at) < new Date();
//   const claimed = data?.claimed ?? false;
//   const ended = declined || expired;
//
//   const handleLogout = () => {
//     Alert.alert(t('settings.logout'), t('settings.logoutConfirm'), [
//       { text: t('common.cancel'), style: 'cancel' },
//       {
//         text: t('settings.logout'),
//         style: 'destructive',
//         onPress: () => {
//           clearAuth();
//           clearChild();
//           resetOnboarding();
//           router.replace('/(onboarding)/language');
//         },
//       },
//     ]);
//   };
//
//   const statusText = declined
//     ? t('onboarding.familyWaiting.declined', { name: data?.child_name ?? '' })
//     : expired
//       ? t('onboarding.familyWaiting.expired')
//       : claimed
//         ? t('onboarding.familyWaiting.claimed', { name: data?.child_name ?? '' })
//         : t('onboarding.familyWaiting.subtitle', { name: data?.child_name ?? '' });
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
//             {/* The status card is the one thing on the page, so it is the
//                 pane lifted to `lg`; the button inside it is `flush`,
//                 because a pane cannot cast a shadow onto its own card. */}
//             <View style={[glass(24, 'lg'), styles.card]}>
//               <View style={styles.head}>
//                 {!ended && <ActivityIndicator size="large" color={PRIMARY} />}
//                 <Text style={styles.title}>
//                   {ended
//                     ? t('onboarding.familyWaiting.endedTitle')
//                     : t('onboarding.familyWaiting.title')}
//                 </Text>
//                 <Text style={styles.status}>{statusText}</Text>
//
//                 {/* The number being waited on — without it a parent cannot
//                     spot their own typo, which is the likeliest reason
//                     nothing is happening. */}
//                 {!!data?.child_phone && (
//                   <Text style={styles.phone}>{data.child_phone}</Text>
//                 )}
//               </View>
//
//               <View style={styles.actions}>
//                 <Pressable
//                   onPress={() => router.replace('/(onboarding)/child-phone')}
//                   accessibilityRole="button"
//                   accessibilityLabel={t('onboarding.familyWaiting.changeNumber')}
//                   style={[glass(16, 'flush', 0.7), styles.change, styles.focusable]}
//                 >
//                   <Text style={styles.changeText}>
//                     {t('onboarding.familyWaiting.changeNumber')}
//                   </Text>
//                 </Pressable>
//
//                 <Pressable
//                   onPress={handleLogout}
//                   accessibilityRole="button"
//                   accessibilityLabel={t('settings.logout')}
//                   style={[styles.logout, styles.focusable]}
//                 >
//                   <Text style={styles.logoutText}>{t('settings.logout')}</Text>
//                 </Pressable>
//               </View>
//             </View>
//
//             <Text style={styles.helper}>
//               {t('onboarding.familyWaiting.helper')}
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
//   head: { alignItems: 'center', gap: 12 },
//   title: {
//     marginTop: 4,
//     fontSize: 20,
//     lineHeight: 28,
//     fontWeight: '700',
//     color: INK,
//     textAlign: 'center',
//   },
//   status: { fontSize: 16, color: MUTED, textAlign: 'center' },
//   phone: { marginTop: 4, fontSize: 16, fontWeight: '700', color: PRIMARY },
//
//   actions: { marginTop: 24, gap: 4 },
//   change: {
//     minHeight: 48,
//     paddingVertical: 12,
//     paddingHorizontal: 16,
//     alignItems: 'center',
//     justifyContent: 'center',
//     borderColor: HAIRLINE,
//   },
//   changeText: { fontSize: 14, fontWeight: '500', color: INK },
//
//   // Padded to a real 40pt row: the label alone was a ~20pt tap target.
//   logout: {
//     minHeight: 40,
//     paddingVertical: 12,
//     paddingHorizontal: 16,
//     alignItems: 'center',
//     justifyContent: 'center',
//   },
//   logoutText: { fontSize: 14, color: MUTED },
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
