// =============================================================================
// OTA-ONA BO'LIMI O'CHIRILGAN — ilova hozircha faqat bola uchun.
// Ekranning asl kodi quyida to'liq kommentda saqlangan. Qayta yoqish uchun:
// stub'ni o'chiring va pastdagi qatorlardan "// " prefiksini oling.
// =============================================================================
import { Redirect } from 'expo-router';

// ─── ASL KOD (o'chirilgan) ───────────────────────────────────────────────────
// import { useQuery } from '@tanstack/react-query';
// import { router } from 'expo-router';
// import { useEffect } from 'react';
// import { ActivityIndicator, Alert, Pressable, View } from 'react-native';

export default function FamilyWaitingScreen() {
  return <Redirect href="/" />;
}
//
// import { listChildren } from '@/api/endpoints/children';
// import { getFamilyInvite } from '@/api/endpoints/family';
// import { Card } from '@/components/v2/card';
// import { MascotImage } from '@/components/v2/mascot-image';
// import { ScreenGradient } from '@/components/v2/screen-gradient';
// import { useT } from '@/i18n';
// import { useAuthStore } from '@/store/auth';
// import { useChildStore } from '@/store/child';
// import { useMascotStore } from '@/store/mascot';
// import { useOnboardingStore } from '@/store/onboarding';
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
//     <ScreenGradient>
//       <View className="flex-1 px-6 items-center justify-center">
//         <View className="w-full max-w-[345px] items-center">
//           <MascotImage size={150} glow="cosmic" />
//
//           <View className="w-full mt-6">
//             <Card>
//               <View className="gap-3 items-center">
//                 {!ended && <ActivityIndicator size="large" color="#2563EB" />}
//                 <Text className="text-[20px] leading-7 font-bold text-foreground text-center mt-1">
//                   {ended
//                     ? t('onboarding.familyWaiting.endedTitle')
//                     : t('onboarding.familyWaiting.title')}
//                 </Text>
//                 <Text className="text-base text-muted-foreground text-center">
//                   {statusText}
//                 </Text>
//
//                 {/* The number being waited on — without it a parent cannot
//                     spot their own typo, which is the likeliest reason
//                     nothing is happening. */}
//                 {!!data?.child_phone && (
//                   <Text className="text-base font-bold text-primary mt-1">
//                     {data.child_phone}
//                   </Text>
//                 )}
//               </View>
//
//               <View className="mt-6 gap-1">
//                 <Pressable
//                   onPress={() => router.replace('/(onboarding)/child-phone')}
//                   accessibilityRole="button"
//                   accessibilityLabel={t('onboarding.familyWaiting.changeNumber')}
//                   className="items-center py-3 rounded-xl bg-secondary border border-primary/10 active:opacity-80"
//                 >
//                   <Text className="text-sm font-medium text-foreground">
//                     {t('onboarding.familyWaiting.changeNumber')}
//                   </Text>
//                 </Pressable>
//
//                 <Pressable
//                   onPress={handleLogout}
//                   accessibilityRole="button"
//                   accessibilityLabel={t('settings.logout')}
//                   className="items-center py-3 active:opacity-70"
//                 >
//                   <Text className="text-sm text-muted-foreground">
//                     {t('settings.logout')}
//                   </Text>
//                 </Pressable>
//               </View>
//             </Card>
//           </View>
//
//           <Text className="text-xs text-muted-foreground text-center mt-5 px-2 leading-4">
//             {t('onboarding.familyWaiting.helper')}
//           </Text>
//         </View>
//       </View>
//     </ScreenGradient>
//   );
// }
//
