// =============================================================================
// OTA-ONA BO'LIMI O'CHIRILGAN — ilova hozircha faqat bola uchun.
// Ekranning asl kodi quyida to'liq kommentda saqlangan. Qayta yoqish uchun:
// stub'ni o'chiring va pastdagi qatorlardan "// " prefiksini oling.
// =============================================================================
import { Redirect } from 'expo-router';

// ─── ASL KOD (o'chirilgan) ───────────────────────────────────────────────────
// import { LinearGradient } from 'expo-linear-gradient';
// import { router } from 'expo-router';
// import {
//   Pressable,
//   ScrollView,
//   StyleSheet,
//   View,
//   type ViewStyle,
// } from 'react-native';
// import { SafeAreaView } from 'react-native-safe-area-context';

export default function UserTypeScreen() {
  return <Redirect href="/phone" />;
}
// import { Text } from '@/components/text';
//
// import { MascotImage } from '@/components/v2/mascot-image';
// import { UserTypeIcon } from '@/components/v2/user-type-icon';
// import { useT, type TranslationKey } from '@/i18n';
// import { glass } from '@/lib/glass';
// import { type UserType, useOnboardingStore } from '@/store/onboarding';
//
// // ── The glass sky, the same morning the inner screens wake up to ──────────
// const TITLE = '#2A63DC';
// const INK = '#22406F';
// const MUTED = '#8CA3CB';
// const BG_TOP = '#E3EFFF';
// const BG_MID = '#EAF3FF';
// const BG_BOTTOM = '#EDF2FD';
//
// interface TypeOption {
//   type: UserType;
//   labelKey: TranslationKey;
//   a11yKey: TranslationKey;
// }
//
// const TYPE_OPTIONS: readonly TypeOption[] = [
//   {
//     type: 'child',
//     labelKey: 'onboarding.userType.child',
//     a11yKey: 'onboarding.userType.childA11y',
//   },
//   {
//     type: 'parent',
//     labelKey: 'onboarding.userType.parent',
//     a11yKey: 'onboarding.userType.parentA11y',
//   },
// ];
//
// export default function UserTypeScreen() {
//   const t = useT();
//   const setUserType = useOnboardingStore((s) => s.setUserType);
//
//   const handleSelect = (type: UserType) => {
//     setUserType(type);
//     router.push('/(onboarding)/phone');
//   };
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
//         {/* Card-sized artwork does not fit a short phone alongside the
//             mascot, so the column centres when there is room and scrolls when
//             there is not, instead of clipping off both ends. */}
//         <ScrollView
//           contentContainerStyle={styles.scroll}
//           showsVerticalScrollIndicator={false}
//         >
//           <View style={styles.column}>
//             <MascotImage size={176} glow="cosmic" />
//
//             <View style={styles.heading}>
//               <Text style={styles.title}>
//                 {t('onboarding.userType.greeting')}
//               </Text>
//               <Text style={styles.subtitle}>
//                 {t('onboarding.userType.question')}
//               </Text>
//             </View>
//
//             <View style={styles.options}>
//               {TYPE_OPTIONS.map((option) => (
//                 <Pressable
//                   key={option.type}
//                   onPress={() => handleSelect(option.type)}
//                   accessibilityRole="button"
//                   accessibilityLabel={t(option.a11yKey)}
//                   style={({ pressed }) => [
//                     glass(22, 'md'),
//                     styles.option,
//                     styles.focusable,
//                     pressed && styles.pressed,
//                   ]}
//                 >
//                   <UserTypeIcon type={option.type} />
//                   <Text style={styles.optionLabel}>{t(option.labelKey)}</Text>
//                 </Pressable>
//               ))}
//             </View>
//           </View>
//         </ScrollView>
//       </SafeAreaView>
//     </View>
//   );
// }
//
// const styles = StyleSheet.create({
//   root: { flex: 1 },
//   safe: { flex: 1 },
//   scroll: {
//     flexGrow: 1,
//     paddingHorizontal: 24,
//     paddingVertical: 24,
//     alignItems: 'center',
//     justifyContent: 'center',
//   },
//   column: {
//     width: '100%',
//     maxWidth: 345,
//     alignItems: 'center',
//   },
//
//   heading: { alignItems: 'center', marginTop: 24, gap: 8 },
//   title: {
//     fontSize: 24,
//     lineHeight: 32,
//     fontWeight: '700',
//     color: TITLE,
//   },
//   subtitle: {
//     fontSize: 16,
//     lineHeight: 22,
//     color: MUTED,
//   },
//
//   options: {
//     width: '100%',
//     marginTop: 32,
//     gap: 16,
//   },
//   option: {
//     width: '100%',
//     alignItems: 'center',
//     paddingHorizontal: 16,
//     paddingTop: 16,
//     paddingBottom: 20,
//   },
//   optionLabel: {
//     marginTop: 8,
//     fontSize: 20,
//     fontWeight: '500',
//     color: INK,
//   },
//   pressed: { opacity: 0.8 },
//   // The browser's default focus ring is a black rectangle around a rounded
//   // control. RN's ViewStyle has no outline, so this is a web-only escape;
//   // native ignores unknown keys.
//   focusable: { outlineStyle: 'none', outlineWidth: 0 } as unknown as ViewStyle,
// });
//
