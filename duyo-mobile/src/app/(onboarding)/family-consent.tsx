// =============================================================================
// OTA-ONA BO'LIMI O'CHIRILGAN — ilova hozircha faqat bola uchun.
// Ekranning asl kodi quyida to'liq kommentda saqlangan. Qayta yoqish uchun:
// stub'ni o'chiring va pastdagi qatorlardan "// " prefiksini oling.
// =============================================================================
import { Redirect } from 'expo-router';

export default function FamilyConsentScreen() {
  return <Redirect href="/" />;
}

// ─── ASL KOD (o'chirilgan) ───────────────────────────────────────────────────
// import { useMutation } from '@tanstack/react-query';
// import { router, useLocalSearchParams } from 'expo-router';
// import { useState } from 'react';
// import { Alert, Pressable, Text, View } from 'react-native';
//
// import {
//   acceptFamilyInvite,
//   declineFamilyInvite,
// } from '@/api/endpoints/family';
// import { Card } from '@/components/v2/card';
// import { MascotImage } from '@/components/v2/mascot-image';
// import { PrimaryButton } from '@/components/v2/primary-button';
// import { ScreenGradient } from '@/components/v2/screen-gradient';
// import { useT } from '@/i18n';
// import { useOnboardingStore } from '@/store/onboarding';
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
//     <ScreenGradient>
//       <View className="flex-1 px-6 items-center justify-center">
//         <View className="w-full max-w-[345px] items-center">
//           <MascotImage size={150} glow="cosmic" />
//
//           <View className="w-full mt-6">
//             <Card>
//               <View className="gap-2 items-center">
//                 <Text className="text-[22px] leading-7 font-bold text-foreground text-center">
//                   {t('onboarding.familyConsent.title')}
//                 </Text>
//                 <Text className="text-base text-muted-foreground text-center">
//                   {t('onboarding.familyConsent.subtitle')}
//                 </Text>
//               </View>
//
//               {/* The number is the whole decision — show it, not a summary. */}
//               <View className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-4 mt-5 items-center gap-1">
//                 <Text className="text-sm text-muted-foreground">
//                   {t('onboarding.familyConsent.fromLabel')}
//                 </Text>
//                 <Text className="text-xl font-bold text-primary">
//                   {fromPhone}
//                 </Text>
//                 {!!childName && (
//                   <Text className="text-sm text-muted-foreground text-center mt-1">
//                     {t('onboarding.familyConsent.willCallYou', {
//                       name: childName,
//                     })}
//                   </Text>
//                 )}
//               </View>
//
//               <View className="bg-accent/20 rounded-lg px-4 py-3 mt-4">
//                 <Text className="text-sm text-foreground text-center leading-5">
//                   {t('onboarding.familyConsent.whatItMeans')}
//                 </Text>
//               </View>
//
//               <View className="mt-6">
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
//                 className="items-center mt-4 py-2 active:opacity-70"
//               >
//                 <Text className="text-sm font-medium text-red-500">
//                   {t('onboarding.familyConsent.decline')}
//                 </Text>
//               </Pressable>
//             </Card>
//           </View>
//
//           <Text className="text-xs text-muted-foreground text-center mt-5 px-2 leading-4">
//             {t('onboarding.familyConsent.helper')}
//           </Text>
//         </View>
//       </View>
//     </ScreenGradient>
//   );
// }
//
