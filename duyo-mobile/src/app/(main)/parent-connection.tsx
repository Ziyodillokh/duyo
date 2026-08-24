// =============================================================================
// OTA-ONA BO'LIMI O'CHIRILGAN — ilova hozircha faqat bola uchun.
// Ekranning asl kodi quyida to'liq kommentda saqlangan. Qayta yoqish uchun:
// stub'ni o'chiring va pastdagi qatorlardan "// " prefiksini oling.
// Kod ilovaning "glass" dizayn tizimiga o'tkazilgan (className ishlatilmaydi),
// shuning uchun qayta yoqilganda ekran boshqa ekranlar bilan bir xil ko'rinadi.
// =============================================================================
import { Redirect } from 'expo-router';

export default function ParentConnectionScreen() {
  return <Redirect href="/settings" />;
}

// ─── ASL KOD (o'chirilgan) ───────────────────────────────────────────────────
// import { LinearGradient } from 'expo-linear-gradient';
// import { router } from 'expo-router';
// import { ArrowLeft, Check, QrCode, Send } from 'lucide-react-native';
// import { useState } from 'react';
// import {
//   Alert,
//   Pressable,
//   ScrollView,
//   StyleSheet,
//   View,
//   type ViewStyle,
// } from 'react-native';
// import { SafeAreaView } from 'react-native-safe-area-context';
//
// import { KeyboardAvoidingView } from '@/components/keyboard-avoiding-view';
// import { Text, TextInput } from '@/components/text';
// import { CountryChip } from '@/components/v2/country-chip';
// import { MascotImage } from '@/components/v2/mascot-image';
// import { PrimaryButton } from '@/components/v2/primary-button';
// import { glass, lift } from '@/lib/glass';
//
// // ── The glass sky, the inner screens' cooler morning ──────────────────────
// const PRIMARY = '#2F6FE4';
// const TITLE = '#2A63DC';
// const INK = '#22406F';
// const MUTED = '#8CA3CB';
// const PLACEHOLDER = '#7693C2';
// const BG_TOP = '#E3EFFF';
// const BG_MID = '#EAF3FF';
// const BG_BOTTOM = '#EDF2FD';
// const HAIRLINE = 'rgba(47,111,228,0.10)';
//
// type Mode = 'sms' | 'qr';
//
// const NATIONAL_DIGITS = 9;
// const BENEFITS: ReadonlyArray<string> = [
//   'Ota-onangiz faolligingizni kuzatib boradi',
//   "Xavfsizlik holati haqida xabardor bo'ladi",
//   'Suhbatlaringiz maxfiy qoladi',
// ];
//
// export default function ParentConnectionScreen() {
//   const [mode, setMode] = useState<Mode>('sms');
//   const [phone, setPhone] = useState('');
//
//   const isValid = phone.length === NATIONAL_DIGITS;
//
//   // Linking a parent to a child across two accounts is a real feature —
//   // invite codes, a guardian record, an acceptance step — and none of it
//   // exists yet. This screen used to claim it had sent an SMS while making no
//   // network call at all, which is worse than saying nothing.
//   const handleSend = () => {
//     if (!isValid) return;
//     Alert.alert(
//       'Tez orada',
//       "Ota-onani ulash imkoniyati tayyorlanmoqda. Hozircha ota-ona o'z telefonida ro'yxatdan o'tishi mumkin.",
//     );
//   };
//
//   return (
//     <View style={StyleSheet.absoluteFill}>
//       <LinearGradient
//         colors={[BG_TOP, BG_MID, BG_BOTTOM]}
//         locations={[0, 0.55, 1]}
//         style={StyleSheet.absoluteFill}
//       />
//
//       <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
//         <KeyboardAvoidingView behavior="padding" style={styles.flex}>
//           <ScrollView
//             contentContainerStyle={styles.scroll}
//             showsVerticalScrollIndicator={false}
//           >
//             <View style={styles.headerRow}>
//               <Pressable
//                 onPress={() => router.back()}
//                 accessibilityRole="button"
//                 accessibilityLabel="Orqaga"
//                 style={[glass(24, 'sm'), styles.headerButton, styles.focusable]}
//               >
//                 <ArrowLeft size={23} color={PRIMARY} strokeWidth={2} />
//               </Pressable>
//             </View>
//
//             <View style={styles.mascot}>
//               <MascotImage size={176} glow="cosmic" />
//             </View>
//
//             {/* The one pane the screen leads with, so it sits a rung above
//                 the explainer below it and carries a sheet's radius. */}
//             <View style={[glass(28, 'lg'), styles.card]}>
//               <View style={styles.cardHead}>
//                 <Text style={styles.cardTitle}>Ota-onangizni ulang</Text>
//                 <Text style={styles.cardBlurb}>
//                   Xavfsizlik uchun ota-onangizni ulash tavsiya etiladi
//                 </Text>
//               </View>
//
//               {/* The track is a well cut into the card; only the chosen
//                   mode lifts off it. */}
//               <View style={styles.modes}>
//                 <Pressable
//                   onPress={() => setMode('qr')}
//                   accessibilityRole="button"
//                   accessibilityState={{ selected: mode === 'qr' }}
//                   accessibilityLabel="QR kod"
//                   style={[
//                     styles.mode,
//                     mode === 'qr' && styles.modeOn,
//                     styles.focusable,
//                   ]}
//                 >
//                   <QrCode
//                     size={16}
//                     color={mode === 'qr' ? '#FFFFFF' : PRIMARY}
//                     strokeWidth={2.2}
//                   />
//                   <Text
//                     style={[styles.modeText, mode === 'qr' && styles.modeTextOn]}
//                   >
//                     QR kod
//                   </Text>
//                 </Pressable>
//                 <Pressable
//                   onPress={() => setMode('sms')}
//                   accessibilityRole="button"
//                   accessibilityState={{ selected: mode === 'sms' }}
//                   accessibilityLabel="SMS"
//                   style={[
//                     styles.mode,
//                     mode === 'sms' && styles.modeOn,
//                     styles.focusable,
//                   ]}
//                 >
//                   <Send
//                     size={16}
//                     color={mode === 'sms' ? '#FFFFFF' : PRIMARY}
//                     strokeWidth={2.2}
//                   />
//                   <Text
//                     style={[styles.modeText, mode === 'sms' && styles.modeTextOn]}
//                   >
//                     SMS
//                   </Text>
//                 </Pressable>
//               </View>
//
//               {mode === 'sms' ? (
//                 <View style={styles.form}>
//                   <Text style={styles.fieldLabel}>Ota-ona telefon raqami</Text>
//                   <View style={styles.fieldRow}>
//                     <CountryChip code="+998" />
//                     <TextInput
//                       value={phone}
//                       onChangeText={(t) =>
//                         setPhone(t.replace(/\D/g, '').slice(0, NATIONAL_DIGITS))
//                       }
//                       placeholder="901234567"
//                       placeholderTextColor={PLACEHOLDER}
//                       keyboardType="phone-pad"
//                       accessibilityLabel="Ota-ona telefon raqami"
//                       style={styles.field}
//                     />
//                   </View>
//                   <View style={styles.submit}>
//                     <PrimaryButton
//                       onPress={handleSend}
//                       disabled={!isValid}
//                       accessibilityLabel="SMS yuborish"
//                     >
//                       SMS yuborish
//                     </PrimaryButton>
//                   </View>
//                 </View>
//               ) : (
//                 <View style={styles.qrWrap}>
//                   <View style={[glass(24, 'md', 0.72), styles.qrBox]}>
//                     <QrCode size={120} color={PRIMARY} strokeWidth={1.6} />
//                   </View>
//                   <Text style={styles.qrCaption}>
//                     Ota-onangizdan ushbu kodni{'\n'}skanerlashini so'rang
//                   </Text>
//                 </View>
//               )}
//             </View>
//
//             <View style={[glass(24, 'md', 0.6), styles.why]}>
//               <View style={styles.whyHead}>
//                 <Check size={20} color={PRIMARY} strokeWidth={2.4} />
//                 <Text style={styles.whyTitle}>Nima uchun kerak?</Text>
//               </View>
//               <View style={styles.whyList}>
//                 {BENEFITS.map((b) => (
//                   <View key={b} style={styles.whyRow}>
//                     <Text style={styles.whyTick}>✓</Text>
//                     <Text style={styles.whyText}>{b}</Text>
//                   </View>
//                 ))}
//               </View>
//             </View>
//
//             <View style={styles.footer}>
//               <Pressable
//                 onPress={() => router.back()}
//                 accessibilityRole="button"
//                 accessibilityLabel="Keyinroq"
//                 style={[styles.later, styles.focusable]}
//               >
//                 <Text style={styles.laterText}>Keyinroq</Text>
//               </Pressable>
//               <Text style={styles.footerNote}>
//                 Sozlamalarda ham ulashingiz mumkin
//               </Text>
//             </View>
//           </ScrollView>
//         </KeyboardAvoidingView>
//       </SafeAreaView>
//     </View>
//   );
// }
//
// const styles = StyleSheet.create({
//   flex: { flex: 1 },
//   // The browser's default focus ring is a black rectangle around a rounded
//   // control. RN's ViewStyle has no outline, so this is a web-only escape;
//   // native ignores unknown keys.
//   focusable: { outlineStyle: 'none', outlineWidth: 0 } as unknown as ViewStyle,
//
//   scroll: {
//     paddingHorizontal: 20,
//     paddingVertical: 20,
//     gap: 24,
//   },
//   headerRow: { flexDirection: 'row', alignItems: 'center' },
//   headerButton: {
//     width: 48,
//     height: 48,
//     alignItems: 'center',
//     justifyContent: 'center',
//   },
//   mascot: { alignItems: 'center' },
//
//   card: { padding: 24 },
//   cardHead: { alignItems: 'center', gap: 8 },
//   cardTitle: {
//     fontSize: 24,
//     lineHeight: 32,
//     fontWeight: '700',
//     letterSpacing: -0.4,
//     color: TITLE,
//     textAlign: 'center',
//   },
//   cardBlurb: {
//     fontSize: 15,
//     lineHeight: 21,
//     color: MUTED,
//     textAlign: 'center',
//   },
//
//   modes: {
//     flexDirection: 'row',
//     gap: 4,
//     marginTop: 24,
//     padding: 3,
//     borderRadius: 17,
//     backgroundColor: 'rgba(47,111,228,0.10)',
//   },
//   mode: {
//     flex: 1,
//     height: 38,
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'center',
//     gap: 8,
//     borderRadius: 14,
//   },
//   modeOn: { backgroundColor: PRIMARY, boxShadow: lift('sm') },
//   modeText: { fontSize: 14, fontWeight: '600', color: INK },
//   modeTextOn: { color: '#FFFFFF' },
//
//   form: { gap: 8, marginTop: 24 },
//   fieldLabel: { fontSize: 13, fontWeight: '600', color: INK },
//   fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
//   // Flush by design: a field is cut INTO the card it sits on, so it casts
//   // no shadow of its own — see the `flush` note in lib/glass.
//   field: {
//     flex: 1,
//     height: 46,
//     paddingHorizontal: 14,
//     borderRadius: 14,
//     borderWidth: 1,
//     borderColor: HAIRLINE,
//     backgroundColor: 'rgba(255,255,255,0.75)',
//     fontSize: 15,
//     color: INK,
//   },
//   submit: { marginTop: 16 },
//
//   qrWrap: { alignItems: 'center', gap: 12, marginTop: 24 },
//   qrBox: {
//     width: 200,
//     height: 200,
//     alignItems: 'center',
//     justifyContent: 'center',
//   },
//   qrCaption: {
//     fontSize: 13,
//     lineHeight: 19,
//     color: MUTED,
//     textAlign: 'center',
//   },
//
//   why: { padding: 20 },
//   whyHead: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 8,
//     marginBottom: 16,
//   },
//   whyTitle: {
//     fontSize: 18,
//     fontWeight: '700',
//     letterSpacing: -0.3,
//     color: INK,
//   },
//   whyList: { gap: 8 },
//   whyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
//   whyTick: { fontSize: 14, lineHeight: 20, color: PRIMARY },
//   whyText: { flex: 1, fontSize: 14, lineHeight: 20, color: MUTED },
//
//   footer: { alignItems: 'center', gap: 8 },
//   later: {
//     paddingHorizontal: 16,
//     paddingVertical: 10,
//     borderRadius: 14,
//   },
//   laterText: { fontSize: 14, fontWeight: '600', color: INK },
//   footerNote: { fontSize: 12, color: MUTED, textAlign: 'center' },
// });
//
