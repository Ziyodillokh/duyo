// =============================================================================
// OTA-ONA BO'LIMI O'CHIRILGAN — ilova hozircha faqat bola uchun.
// Ekranning asl kodi quyida to'liq kommentda saqlangan. Qayta yoqish uchun:
// stub'ni o'chiring va pastdagi qatorlardan "// " prefiksini oling.
// =============================================================================
import { Redirect } from 'expo-router';

export default function ChildPhoneScreen() {
  return <Redirect href="/age" />;
}

// ─── ASL KOD (o'chirilgan) ───────────────────────────────────────────────────
// import { useMutation } from '@tanstack/react-query';
// import { router } from 'expo-router';
// import { useState } from 'react';
// import { Alert, Text, View } from 'react-native';
// import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
//
// import { createFamilyInvite } from '@/api/endpoints/family';
// import { Card } from '@/components/v2/card';
// import { CountryChip } from '@/components/v2/country-chip';
// import { FormInput } from '@/components/v2/form-input';
// import { HelperText } from '@/components/v2/helper-text';
// import { MascotImage } from '@/components/v2/mascot-image';
// import { PrimaryButton } from '@/components/v2/primary-button';
// import { ScreenGradient } from '@/components/v2/screen-gradient';
// import { useT } from '@/i18n';
// import { useOnboardingStore } from '@/store/onboarding';
//
// const PHONE_PREFIX = '+998';
// const NATIONAL_DIGITS = 9;
//
// interface AxiosErrorShape {
//   response?: { status?: number; data?: { detail?: string } };
// }
//
// /**
//  * The parent's onboarding step that used to ask "how old are you" — that
//  * question belongs to the child, not the parent answering for them. Instead
//  * the parent enters the child's own phone number here; a login code goes
//  * out to it, and the child answers the rest of onboarding (age, interests,
//  * avatar) themselves once they enter it on their own device.
//  */
// export default function ChildPhoneScreen() {
//   const t = useT();
//   const childName = useOnboardingStore((s) => s.pendingName);
//   const [phone, setPhone] = useState('');
//   const isValid = phone.length === NATIONAL_DIGITS;
//
//   const invite = useMutation({
//     mutationFn: () => createFamilyInvite(childName, `${PHONE_PREFIX}${phone}`),
//     onSuccess: () => router.push('/(onboarding)/family-waiting'),
//     onError: (err) => {
//       const status = (err as AxiosErrorShape).response?.status;
//       if (status === 429) {
//         Alert.alert(
//           t('common.tooManyAttempts.title'),
//           t('common.tooManyAttempts.body'),
//         );
//         return;
//       }
//       const detail =
//         (err as AxiosErrorShape).response?.data?.detail ??
//         t('common.errorGeneric');
//       Alert.alert(t('common.error'), detail);
//     },
//   });
//
//   const canSend = isValid && !invite.isPending;
//
//   return (
//     <ScreenGradient>
//       <KeyboardAwareScrollView
//         contentContainerStyle={{
//           flexGrow: 1,
//           paddingHorizontal: 24,
//           paddingVertical: 24,
//           alignItems: 'center',
//           justifyContent: 'center',
//         }}
//         bottomOffset={24}
//         keyboardShouldPersistTaps="handled"
//         showsVerticalScrollIndicator={false}
//       >
//         <View className="w-full max-w-[345px] items-center">
//           <MascotImage size={176} glow="cosmic" />
//
//           <View className="w-full mt-6">
//             <Card>
//               <View className="gap-2 items-center">
//                 <Text className="text-[24px] leading-8 font-bold text-foreground text-center">
//                   {t('onboarding.childPhone.title')}
//                 </Text>
//                 <Text className="text-base text-muted-foreground text-center">
//                   {t('onboarding.childPhone.subtitle', { name: childName })}
//                 </Text>
//               </View>
//
//               <View className="gap-2 mt-6">
//                 <Text className="text-sm font-medium text-foreground">
//                   {t('onboarding.childPhone.label')}
//                 </Text>
//                 <View className="flex-row gap-2 items-center">
//                   <CountryChip code={PHONE_PREFIX} />
//                   <View className="flex-1">
//                     <FormInput
//                       value={phone}
//                       onChangeText={(v) =>
//                         setPhone(v.replace(/\D/g, '').slice(0, NATIONAL_DIGITS))
//                       }
//                       placeholder="901234567"
//                       keyboardType="phone-pad"
//                       autoFocus
//                       accessibilityLabel={t('onboarding.childPhone.label')}
//                     />
//                   </View>
//                 </View>
//               </View>
//
//               <View className="mt-6">
//                 <PrimaryButton
//                   onPress={() => invite.mutate()}
//                   disabled={!canSend}
//                   accessibilityLabel={t('onboarding.childPhone.send')}
//                 >
//                   {invite.isPending
//                     ? t('common.sending')
//                     : t('onboarding.childPhone.send')}
//                 </PrimaryButton>
//               </View>
//             </Card>
//           </View>
//
//           <View className="mt-6 px-4">
//             <HelperText>{t('onboarding.childPhone.helper')}</HelperText>
//           </View>
//         </View>
//       </KeyboardAwareScrollView>
//     </ScreenGradient>
//   );
// }
//
