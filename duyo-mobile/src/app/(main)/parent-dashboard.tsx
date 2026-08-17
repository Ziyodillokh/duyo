// =============================================================================
// OTA-ONA BO'LIMI O'CHIRILGAN — ilova hozircha faqat bola uchun.
// Ekranning asl kodi quyida to'liq kommentda saqlangan. Qayta yoqish uchun:
// stub'ni o'chiring va pastdagi qatorlardan "// " prefiksini oling.
// =============================================================================
import { Redirect } from 'expo-router';

export default function ParentDashboardScreen() {
  return <Redirect href="/" />;
}

// ─── ASL KOD (o'chirilgan) ───────────────────────────────────────────────────
// import { LinearGradient } from 'expo-linear-gradient';
// import { router } from 'expo-router';
// import {
//   Activity,
//   AlertTriangle,
//   ArrowLeft,
//   Brain,
//   CheckCircle,
//   Heart,
//   Lightbulb,
//   MessageCircle,
//   Sparkles,
//   TrendingUp,
// } from 'lucide-react-native';
// import {
//   ActivityIndicator,
//   Pressable,
//   ScrollView,
//   StyleSheet,
//   Text,
//   View,
// } from 'react-native';
// import { SafeAreaView } from 'react-native-safe-area-context';
//
// import { type TrendPoint } from '@/api/endpoints/reports';
// import { MascotImage } from '@/components/v2/mascot-image';
// import { useReport, useTrends } from '@/hooks/use-report';
// import { useChildStore } from '@/store/child';
// import { useIsDark } from '@/store/theme';
//
// const SERIES_COLOR = '#60A5FA'; // single series → one hue, no legend needed
//
// /**
//  * Active days per reporting period. One series, so the title carries identity
//  * and only the newest bar is labelled — a number on every bar would be noise.
//  */
// function ActiveDaysTrend({
//   points,
//   isDark,
// }: {
//   points: TrendPoint[];
//   isDark: boolean;
// }) {
//   const latest = points[points.length - 1];
//   // window_days isn't in the series; 10 is the report window (Concept §11.2).
//   const scaleMax = Math.max(10, ...points.map((p) => p.active_days));
//   const trackColor = isDark ? '#1E3A5F' : '#E7EEF9';
//
//   return (
//     <View
//       accessibilityLabel={`Faol kunlar dinamikasi, ${points.length} davr, oxirgisi ${latest.active_days} kun`}
//     >
//       <View className="flex-row items-end" style={{ height: 56, gap: 2 }}>
//         {points.map((p, i) => {
//           const isLatest = i === points.length - 1;
//           const ratio = scaleMax > 0 ? p.active_days / scaleMax : 0;
//           return (
//             <View key={p.period_end} className="flex-1 justify-end" style={{ height: '100%' }}>
//               <View
//                 style={{
//                   height: `${Math.max(ratio * 100, 3)}%`,
//                   borderTopLeftRadius: 4,
//                   borderTopRightRadius: 4,
//                   backgroundColor: isLatest ? SERIES_COLOR : trackColor,
//                 }}
//               />
//             </View>
//           );
//         })}
//       </View>
//       <View className="flex-row justify-between mt-2">
//         <Text className="text-xs text-muted-foreground dark:text-dark-muted">
//           eski
//         </Text>
//         <Text className="text-xs font-medium" style={{ color: SERIES_COLOR }}>
//           {latest.active_days} faol kun
//         </Text>
//       </View>
//     </View>
//   );
// }
//
// export default function ParentDashboardScreen() {
//   const isDark = useIsDark();
//   const child = useChildStore((s) => s.child);
//   const childName = child?.name ?? 'Farzand';
//   const childAge = child?.age;
//
//   const report = useReport();
//   const trends = useTrends();
//   const sections = report.data?.sections;
//   const trendPoints = trends.data?.points ?? [];
//   const cardBg = isDark ? '#132340' : '#FFFFFF';
//
//   return (
//     <View style={StyleSheet.absoluteFill}>
//       <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? '#0A1628' : '#F4F8FF' }]} />
//       <LinearGradient
//         colors={['rgba(96, 165, 250, 0.20)', 'rgba(252, 211, 77, 0.15)']}
//         start={{ x: 0, y: 0 }}
//         end={{ x: 0.97, y: 0.4 }}
//         style={StyleSheet.absoluteFill}
//       />
//
//       <SafeAreaView style={{ flex: 1 }} edges={['top']}>
//         <View className="flex-row items-center gap-3 px-6 py-4">
//           <Pressable
//             onPress={() => router.back()}
//             accessibilityRole="button"
//             accessibilityLabel="Orqaga"
//             className="w-10 h-10 items-center justify-center"
//           >
//             <ArrowLeft size={20} color={isDark ? '#E0E7FF' : '#102033'} />
//           </Pressable>
//           <Text className="text-xl font-bold text-foreground dark:text-dark-text">
//             Ota-ona paneli
//           </Text>
//         </View>
//
//         <ScrollView
//           contentContainerStyle={{ padding: 24, gap: 16, paddingBottom: 48 }}
//           showsVerticalScrollIndicator={false}
//         >
//           {/* Child header */}
//           <View
//             className="rounded-xl border border-neon-blue/20"
//             style={{ padding: 20, backgroundColor: cardBg }}
//           >
//             <View className="flex-row items-center gap-4">
//               <View style={{ width: 72, height: 72 }}>
//                 <MascotImage size={72} glow="soft" />
//               </View>
//               <View className="flex-1">
//                 <Text className="text-xl font-bold text-foreground dark:text-dark-text">
//                   {childName}
//                 </Text>
//                 {childAge !== undefined && (
//                   <Text className="text-sm text-muted-foreground dark:text-dark-muted">
//                     {childAge} yosh
//                   </Text>
//                 )}
//                 {sections && (
//                   <Text className="text-xs text-muted-foreground dark:text-dark-muted mt-2">
//                     Oxirgi {sections.activity.window_days} kun
//                   </Text>
//                 )}
//               </View>
//             </View>
//           </View>
//
//           {/* Loading / error */}
//           {report.isLoading && (
//             <View className="items-center" style={{ padding: 32 }}>
//               <ActivityIndicator color={isDark ? '#60A5FA' : '#102033'} />
//               <Text className="text-sm text-muted-foreground dark:text-dark-muted mt-3">
//                 Hisobot tayyorlanmoqda…
//               </Text>
//             </View>
//           )}
//           {report.isError && (
//             <View
//               className="rounded-xl border"
//               style={{
//                 padding: 16,
//                 borderColor: 'rgba(251, 100, 182, 0.40)',
//                 backgroundColor: 'rgba(251, 100, 182, 0.10)',
//               }}
//             >
//               <Text className="text-sm font-medium text-neon-pink">
//                 Hisobotni yuklab bo'lmadi
//               </Text>
//               <Pressable
//                 onPress={() => report.refetch()}
//                 accessibilityRole="button"
//                 accessibilityLabel="Qayta urinish"
//                 className="mt-2"
//               >
//                 <Text className="text-sm font-semibold text-neon-blue">
//                   Qayta urinish
//                 </Text>
//               </Pressable>
//             </View>
//           )}
//
//           {sections && (
//             <>
//               {/* Safety */}
//               {sections.safety.concerning_count > 0 ? (
//                 <View
//                   className="rounded-xl border"
//                   style={{
//                     padding: 16,
//                     borderColor: 'rgba(251, 100, 182, 0.40)',
//                     backgroundColor: 'rgba(251, 100, 182, 0.10)',
//                   }}
//                 >
//                   <View className="flex-row items-center gap-3">
//                     <AlertTriangle size={20} color="#FB64B6" />
//                     <View className="flex-1">
//                       <Text className="text-sm font-medium text-neon-pink">
//                         {sections.safety.concerning_count} ta diqqat talab qiluvchi mavzu
//                       </Text>
//                       <Text className="text-xs text-muted-foreground dark:text-dark-muted mt-1">
//                         {sections.safety.had_red
//                           ? 'Jiddiy signal aniqlandi — suhbatlashing'
//                           : 'Hissiy qiyinchilik belgilari'}
//                       </Text>
//                     </View>
//                   </View>
//                 </View>
//               ) : (
//                 <View
//                   className="rounded-xl border"
//                   style={{
//                     padding: 16,
//                     borderColor: 'rgba(5, 223, 114, 0.30)',
//                     backgroundColor: 'rgba(5, 223, 114, 0.10)',
//                   }}
//                 >
//                   <View className="flex-row items-center gap-3">
//                     <CheckCircle size={20} color="#05DF72" />
//                     <Text className="text-sm font-medium" style={{ color: '#05DF72' }}>
//                       Xavfsizlik signallari aniqlanmadi
//                     </Text>
//                   </View>
//                 </View>
//               )}
//
//               {/* Activity stats */}
//               <View className="flex-row gap-3">
//                 <View
//                   className="flex-1 rounded-xl border border-neon-blue/20"
//                   style={{ padding: 16, backgroundColor: cardBg }}
//                 >
//                   <Activity size={18} color="#60A5FA" />
//                   <Text className="text-2xl font-bold text-foreground dark:text-dark-text mt-2">
//                     {sections.activity.active_days}
//                   </Text>
//                   <Text className="text-xs text-muted-foreground dark:text-dark-muted">
//                     faol kun
//                   </Text>
//                 </View>
//                 <View
//                   className="flex-1 rounded-xl border border-neon-blue/20"
//                   style={{ padding: 16, backgroundColor: cardBg }}
//                 >
//                   <MessageCircle size={18} color="#FDC700" />
//                   <Text className="text-2xl font-bold text-foreground dark:text-dark-text mt-2">
//                     {sections.activity.conversations}
//                   </Text>
//                   <Text className="text-xs text-muted-foreground dark:text-dark-muted">
//                     suhbat
//                   </Text>
//                 </View>
//                 <View
//                   className="flex-1 rounded-xl border border-neon-blue/20"
//                   style={{ padding: 16, backgroundColor: cardBg }}
//                 >
//                   <Sparkles size={18} color="#05DF72" />
//                   <Text className="text-2xl font-bold text-foreground dark:text-dark-text mt-2">
//                     {sections.activity.total_messages}
//                   </Text>
//                   <Text className="text-xs text-muted-foreground dark:text-dark-muted">
//                     xabar
//                   </Text>
//                 </View>
//               </View>
//
//               {/* Mood summary */}
//               <View
//                 className="rounded-xl border border-neon-blue/20"
//                 style={{ padding: 20, backgroundColor: cardBg }}
//               >
//                 <View className="flex-row items-center gap-2 mb-3">
//                   <Heart size={18} color="#FB64B6" />
//                   <Text className="text-base font-bold text-foreground dark:text-dark-text">
//                     Kayfiyat
//                   </Text>
//                   <View
//                     className="rounded-full ml-auto"
//                     style={{
//                       backgroundColor: 'rgba(96,165,250,0.15)',
//                       paddingHorizontal: 10,
//                       paddingVertical: 3,
//                     }}
//                   >
//                     <Text className="text-xs font-medium text-neon-blue">
//                       {sections.mood.mood_trend}
//                     </Text>
//                   </View>
//                 </View>
//                 <Text className="text-sm text-foreground dark:text-dark-text leading-5">
//                   {sections.mood.mood_summary}
//                 </Text>
//                 {sections.mood.highlight !== '' && (
//                   <Text className="text-sm text-muted-foreground dark:text-dark-muted mt-3 leading-5">
//                     ⭐ {sections.mood.highlight}
//                   </Text>
//                 )}
//                 {sections.mood.topics.length > 0 && (
//                   <View className="flex-row flex-wrap gap-2 mt-4">
//                     {sections.mood.topics.map((t) => (
//                       <View
//                         key={t}
//                         className="rounded-md"
//                         style={{
//                           backgroundColor: isDark ? '#1E3A5F' : '#F1F5F9',
//                           paddingHorizontal: 10,
//                           paddingVertical: 4,
//                         }}
//                       >
//                         <Text className="text-xs text-foreground dark:text-dark-text">
//                           {t}
//                         </Text>
//                       </View>
//                     ))}
//                   </View>
//                 )}
//               </View>
//
//               {/* Cognitive development — an observation, never a clinical
//                   score. Copy stays deliberately non-diagnostic (no "IQ"). */}
//               {sections.cognitive &&
//                 (sections.cognitive.note !== '' ||
//                   sections.cognitive.vocabulary_level !== '' ||
//                   sections.cognitive.reasoning_band !== '' ||
//                   sections.cognitive.curiosity_signals.length > 0) && (
//                   <View
//                     className="rounded-xl border border-neon-blue/20"
//                     style={{ padding: 20, backgroundColor: cardBg }}
//                   >
//                     <View className="flex-row items-center gap-2 mb-3">
//                       <Brain size={18} color="#60A5FA" />
//                       <Text className="text-base font-bold text-foreground dark:text-dark-text">
//                         Rivojlanish
//                       </Text>
//                       {sections.cognitive.vocabulary_level !== '' && (
//                         <View
//                           className="rounded-full ml-auto"
//                           style={{
//                             backgroundColor: 'rgba(96,165,250,0.15)',
//                             paddingHorizontal: 10,
//                             paddingVertical: 3,
//                           }}
//                         >
//                           <Text className="text-xs font-medium text-neon-blue">
//                             lug'at: {sections.cognitive.vocabulary_level}
//                           </Text>
//                         </View>
//                       )}
//                     </View>
//                     {sections.cognitive.note !== '' && (
//                       <Text className="text-sm text-foreground dark:text-dark-text leading-5">
//                         {sections.cognitive.note}
//                       </Text>
//                     )}
//                     {sections.cognitive.curiosity_signals.length > 0 && (
//                       <View className="flex-row flex-wrap gap-2 mt-4">
//                         {sections.cognitive.curiosity_signals.map((s) => (
//                           <View
//                             key={s}
//                             className="rounded-md"
//                             style={{
//                               backgroundColor: isDark ? '#1E3A5F' : '#F1F5F9',
//                               paddingHorizontal: 10,
//                               paddingVertical: 4,
//                             }}
//                           >
//                             <Text className="text-xs text-foreground dark:text-dark-text">
//                               {s}
//                             </Text>
//                           </View>
//                         ))}
//                       </View>
//                     )}
//                     {sections.cognitive.reasoning_band !== '' && (
//                       <View
//                         className="rounded-md mt-4"
//                         style={{
//                           padding: 12,
//                           backgroundColor: isDark ? '#1E3A5F' : '#F1F5F9',
//                         }}
//                       >
//                         <Text className="text-sm font-medium text-foreground dark:text-dark-text">
//                           Mantiqiy fikrlash: {sections.cognitive.reasoning_band}
//                         </Text>
//                         <Text className="text-xs text-muted-foreground dark:text-dark-muted mt-1">
//                           Doskadagi jumboqlar: {sections.cognitive.puzzles_correct}/
//                           {sections.cognitive.puzzles_answered} to'g'ri
//                         </Text>
//                       </View>
//                     )}
//                     <Text className="text-xs text-muted-foreground dark:text-dark-muted mt-4 leading-4">
//                       Bu — suhbat uslubidan olingan kuzatuv, tibbiy yoki
//                       psixologik baho emas.
//                     </Text>
//                   </View>
//                 )}
//
//               {/* Trend over past reports. Needs at least two periods to mean
//                   anything — a single bar is not a trend. */}
//               {trendPoints.length >= 2 && (
//                 <View
//                   className="rounded-xl border border-neon-blue/20"
//                   style={{ padding: 20, backgroundColor: cardBg }}
//                 >
//                   <View className="flex-row items-center gap-2 mb-4">
//                     <TrendingUp size={18} color={SERIES_COLOR} />
//                     <Text className="text-base font-bold text-foreground dark:text-dark-text">
//                       Dinamika
//                     </Text>
//                     <Text className="text-xs text-muted-foreground dark:text-dark-muted ml-auto">
//                       {trendPoints.length} ta davr
//                     </Text>
//                   </View>
//                   <ActiveDaysTrend points={trendPoints} isDark={isDark} />
//                 </View>
//               )}
//
//               {/* Guidance */}
//               {sections.guidance && (
//                 <View
//                   className="rounded-xl border border-neon-blue/20"
//                   style={{ padding: 20, backgroundColor: cardBg }}
//                 >
//                   <View className="flex-row items-center gap-2 mb-3">
//                     <Lightbulb size={18} color="#FDC700" />
//                     <Text className="text-base font-bold text-foreground dark:text-dark-text">
//                       Maslahatlar
//                     </Text>
//                   </View>
//                   {sections.guidance.focus !== '' && (
//                     <Text className="text-sm font-medium text-foreground dark:text-dark-text mb-3">
//                       {sections.guidance.focus}
//                     </Text>
//                   )}
//                   <View className="gap-3">
//                     {sections.guidance.tips.map((tip, i) => (
//                       <View key={i} className="flex-row gap-2">
//                         <Text className="text-sm text-neon-yellow">•</Text>
//                         <Text className="text-sm flex-1 text-foreground dark:text-dark-text leading-5">
//                           {tip}
//                         </Text>
//                       </View>
//                     ))}
//                   </View>
//                 </View>
//               )}
//             </>
//           )}
//
//           <Text className="text-xs text-muted-foreground dark:text-dark-muted text-center mt-4">
//             Bola va ota-ona o'rtasidagi maxfiylik DUYO uchun muhim. Faqat
//             umumlashtirilgan ko'rsatkichlar ko'rsatiladi — suhbat matni hech
//             qachon ulashilmaydi.
//           </Text>
//         </ScrollView>
//       </SafeAreaView>
//     </View>
//   );
// }
//
