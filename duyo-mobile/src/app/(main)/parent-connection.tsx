// =============================================================================
// OTA-ONA BO'LIMI O'CHIRILGAN — ilova hozircha faqat bola uchun.
// Ekranning asl kodi quyida to'liq kommentda saqlangan. Qayta yoqish uchun:
// stub'ni o'chiring va pastdagi qatorlardan "// " prefiksini oling.
// =============================================================================
import { Redirect } from 'expo-router';

export default function ParentConnectionScreen() {
  return <Redirect href="/settings" />;
}

// ─── ASL KOD (o'chirilgan) ───────────────────────────────────────────────────
// import { router } from 'expo-router';
// import { ArrowLeft, Check, QrCode, Send } from 'lucide-react-native';
// import { useState } from 'react';
// import {
//   Alert,
//   Pressable,
//   ScrollView,
//   Text,
//   TextInput,
//   View,
// } from 'react-native';
// import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
// 
// import { Card } from '@/components/v2/card';
// import { CountryChip } from '@/components/v2/country-chip';
// import { MascotImage } from '@/components/v2/mascot-image';
// import { PrimaryButton } from '@/components/v2/primary-button';
// import { ScreenGradient } from '@/components/v2/screen-gradient';
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
//     <ScreenGradient>
//       <KeyboardAvoidingView behavior="padding" className="flex-1">
//         <ScrollView
//           contentContainerStyle={{
//             paddingHorizontal: 24,
//             paddingVertical: 24,
//             gap: 24,
//           }}
//           showsVerticalScrollIndicator={false}
//         >
//           <View className="flex-row items-center">
//             <Pressable
//               onPress={() => router.back()}
//               accessibilityRole="button"
//               accessibilityLabel="Orqaga"
//               className="w-10 h-10 items-center justify-center"
//             >
//               <ArrowLeft size={20} color="#102033" />
//             </Pressable>
//           </View>
// 
//           <View className="items-center">
//             <MascotImage size={176} glow="cosmic" />
//           </View>
// 
//           <Card>
//             <View className="gap-2 items-center">
//               <Text className="text-[24px] leading-8 font-bold text-foreground text-center tracking-tight">
//                 Ota-onangizni ulang
//               </Text>
//               <Text className="text-base text-muted-foreground text-center">
//                 Xavfsizlik uchun ota-onangizni ulash tavsiya etiladi
//               </Text>
//             </View>
// 
//             <View className="flex-row gap-2 mt-6">
//               <Pressable
//                 onPress={() => setMode('qr')}
//                 accessibilityRole="button"
//                 accessibilityState={{ selected: mode === 'qr' }}
//                 accessibilityLabel="QR kod"
//                 className={`flex-1 rounded-md flex-row items-center justify-center gap-2 ${
//                   mode === 'qr'
//                     ? 'bg-primary'
//                     : 'bg-secondary border border-primary/10'
//                 }`}
//                 style={{ height: 36 }}
//               >
//                 <QrCode
//                   size={16}
//                   color={mode === 'qr' ? '#FFFFFF' : '#102033'}
//                 />
//                 <Text
//                   className={`text-sm font-medium ${
//                     mode === 'qr' ? 'text-primary-foreground' : 'text-foreground'
//                   }`}
//                 >
//                   QR kod
//                 </Text>
//               </Pressable>
//               <Pressable
//                 onPress={() => setMode('sms')}
//                 accessibilityRole="button"
//                 accessibilityState={{ selected: mode === 'sms' }}
//                 accessibilityLabel="SMS"
//                 className={`flex-1 rounded-md flex-row items-center justify-center gap-2 ${
//                   mode === 'sms'
//                     ? 'bg-primary'
//                     : 'bg-secondary border border-primary/10'
//                 }`}
//                 style={{ height: 36 }}
//               >
//                 <Send
//                   size={16}
//                   color={mode === 'sms' ? '#FFFFFF' : '#102033'}
//                 />
//                 <Text
//                   className={`text-sm font-medium ${
//                     mode === 'sms' ? 'text-primary-foreground' : 'text-foreground'
//                   }`}
//                 >
//                   SMS
//                 </Text>
//               </Pressable>
//             </View>
// 
//             {mode === 'sms' ? (
//               <View className="gap-2 mt-6">
//                 <Text className="text-sm font-medium text-foreground">
//                   Ota-ona telefon raqami
//                 </Text>
//                 <View className="flex-row gap-2 items-center">
//                   <CountryChip code="+998" />
//                   <TextInput
//                     value={phone}
//                     onChangeText={(t) =>
//                       setPhone(t.replace(/\D/g, '').slice(0, NATIONAL_DIGITS))
//                     }
//                     placeholder="901234567"
//                     placeholderTextColor="#94A3B8"
//                     keyboardType="phone-pad"
//                     accessibilityLabel="Ota-ona telefon raqami"
//                     className="flex-1 px-4 rounded-md bg-white text-base text-foreground border-2 border-primary/10"
//                     style={{ height: 42 }}
//                   />
//                 </View>
//                 <View className="mt-4">
//                   <PrimaryButton
//                     onPress={handleSend}
//                     disabled={!isValid}
//                     accessibilityLabel="SMS yuborish"
//                   >
//                     SMS yuborish
//                   </PrimaryButton>
//                 </View>
//               </View>
//             ) : (
//               <View className="items-center mt-6 gap-3">
//                 <View
//                   className="rounded-md items-center justify-center"
//                   style={{
//                     width: 200,
//                     height: 200,
//                     backgroundColor: '#F4F8FF',
//                     borderWidth: 2,
//                     borderColor: 'rgba(37, 99, 235, 0.10)',
//                   }}
//                 >
//                   <QrCode size={120} color="#102033" />
//                 </View>
//                 <Text className="text-sm text-muted-foreground text-center">
//                   Ota-onangizdan ushbu kodni{'\n'}skanerlashini so'rang
//                 </Text>
//               </View>
//             )}
//           </Card>
// 
//           <View
//             className="rounded-xl border"
//             style={{
//               padding: 20,
//               backgroundColor: '#EFF6FF',
//               borderColor: '#BEDBFF',
//             }}
//           >
//             <View className="flex-row items-center gap-2 mb-5">
//               <Check size={20} color="#2563EB" />
//               <Text className="text-lg font-bold text-foreground tracking-tight">
//                 Nima uchun kerak?
//               </Text>
//             </View>
//             <View className="gap-2">
//               {BENEFITS.map((b) => (
//                 <View key={b} className="flex-row gap-2 items-start">
//                   <Text className="text-sm text-primary">✓</Text>
//                   <Text className="text-sm text-muted-foreground flex-1 leading-5">
//                     {b}
//                   </Text>
//                 </View>
//               ))}
//             </View>
//           </View>
// 
//           <View className="items-center gap-2">
//             <Pressable
//               onPress={() => router.back()}
//               accessibilityRole="button"
//               accessibilityLabel="Keyinroq"
//               className="rounded-md active:opacity-80"
//               style={{ paddingHorizontal: 16, paddingVertical: 8 }}
//             >
//               <Text className="text-sm font-medium text-foreground">
//                 Keyinroq
//               </Text>
//             </Pressable>
//             <Text className="text-xs text-muted-foreground text-center">
//               Sozlamalarda ham ulashingiz mumkin
//             </Text>
//           </View>
//         </ScrollView>
//       </KeyboardAvoidingView>
//     </ScreenGradient>
//   );
// }
//
