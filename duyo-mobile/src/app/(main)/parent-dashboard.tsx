// =============================================================================
// OTA-ONA BO'LIMI O'CHIRILGAN — ilova hozircha faqat bola uchun.
// Ekranning asl kodi quyida to'liq kommentda saqlangan. Qayta yoqish uchun:
// stub'ni o'chiring va pastdagi qatorlardan "// " prefiksini oling.
// Kod ilovaning "glass" dizayn tizimiga o'tkazilgan (className ishlatilmaydi),
// shuning uchun qayta yoqilganda ekran boshqa ekranlar bilan bir xil ko'rinadi.
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
//   View,
//   type ViewStyle,
// } from 'react-native';
// import { SafeAreaView } from 'react-native-safe-area-context';
//
// import { type TrendPoint } from '@/api/endpoints/reports';
// import { Text } from '@/components/text';
// import { MascotImage } from '@/components/v2/mascot-image';
// import { useReport, useTrends } from '@/hooks/use-report';
// import { glass } from '@/lib/glass';
// import { useChildStore } from '@/store/child';
//
// // ── The glass sky, the inner screens' cooler morning ──────────────────────
// const PRIMARY = '#2F6FE4';
// const TITLE = '#2A63DC';
// const INK = '#22406F';
// const MUTED = '#8CA3CB';
// const GREEN = '#22B573';
// const DANGER = '#E0455E';
// const GOLD = '#E8A21C';
// const BG_TOP = '#E3EFFF';
// const BG_MID = '#EAF3FF';
// const BG_BOTTOM = '#EDF2FD';
//
// const SERIES_COLOR = PRIMARY; // single series → one hue, no legend needed
// /** The unfilled part of a bar: the page's own tint, not a grey. */
// const TRACK_COLOR = 'rgba(47,111,228,0.14)';
//
// /**
//  * Active days per reporting period. One series, so the title carries identity
//  * and only the newest bar is labelled — a number on every bar would be noise.
//  */
// function ActiveDaysTrend({ points }: { points: TrendPoint[] }) {
//   const latest = points[points.length - 1];
//   // window_days isn't in the series; 10 is the report window (Concept §11.2).
//   const scaleMax = Math.max(10, ...points.map((p) => p.active_days));
//
//   return (
//     <View
//       accessibilityLabel={`Faol kunlar dinamikasi, ${points.length} davr, oxirgisi ${latest.active_days} kun`}
//     >
//       <View style={styles.bars}>
//         {points.map((p, i) => {
//           const isLatest = i === points.length - 1;
//           const ratio = scaleMax > 0 ? p.active_days / scaleMax : 0;
//           return (
//             <View key={p.period_end} style={styles.barSlot}>
//               <View
//                 style={[
//                   styles.bar,
//                   {
//                     height: `${Math.max(ratio * 100, 3)}%`,
//                     backgroundColor: isLatest ? SERIES_COLOR : TRACK_COLOR,
//                   },
//                 ]}
//               />
//             </View>
//           );
//         })}
//       </View>
//       <View style={styles.barsLegend}>
//         <Text style={styles.caption}>eski</Text>
//         <Text style={styles.barsLatest}>{latest.active_days} faol kun</Text>
//       </View>
//     </View>
//   );
// }
//
// export default function ParentDashboardScreen() {
//   const child = useChildStore((s) => s.child);
//   const childName = child?.name ?? 'Farzand';
//   const childAge = child?.age;
//
//   const report = useReport();
//   const trends = useTrends();
//   const sections = report.data?.sections;
//   const trendPoints = trends.data?.points ?? [];
//
//   return (
//     <View style={StyleSheet.absoluteFill}>
//       <LinearGradient
//         colors={[BG_TOP, BG_MID, BG_BOTTOM]}
//         locations={[0, 0.55, 1]}
//         style={StyleSheet.absoluteFill}
//       />
//
//       <SafeAreaView style={styles.flex} edges={['top']}>
//         {/* ── Header: 48pt glass round, the inner-screen pattern ────── */}
//         <View style={styles.header}>
//           <Pressable
//             onPress={() => router.back()}
//             accessibilityRole="button"
//             accessibilityLabel="Orqaga"
//             style={[glass(24, 'sm'), styles.headerButton, styles.focusable]}
//           >
//             <ArrowLeft size={23} color={PRIMARY} strokeWidth={2} />
//           </Pressable>
//           <Text style={styles.title}>Ota-ona paneli</Text>
//         </View>
//
//         <ScrollView
//           contentContainerStyle={styles.scroll}
//           showsVerticalScrollIndicator={false}
//         >
//           {/* Child header — the one hero object of the screen */}
//           <View style={[glass(28, 'lg'), styles.hero]}>
//             <View style={styles.heroRow}>
//               <View style={styles.heroMascot}>
//                 <MascotImage size={72} glow="soft" />
//               </View>
//               <View style={styles.flex}>
//                 <Text style={styles.heroName}>{childName}</Text>
//                 {childAge !== undefined && (
//                   <Text style={styles.heroMeta}>{childAge} yosh</Text>
//                 )}
//                 {sections && (
//                   <Text style={styles.heroWindow}>
//                     Oxirgi {sections.activity.window_days} kun
//                   </Text>
//                 )}
//               </View>
//             </View>
//           </View>
//
//           {/* Loading / error */}
//           {report.isLoading && (
//             <View style={styles.loading}>
//               <ActivityIndicator color={PRIMARY} />
//               <Text style={styles.loadingText}>Hisobot tayyorlanmoqda…</Text>
//             </View>
//           )}
//           {report.isError && (
//             <View style={[glass(22, 'md'), styles.alertCard, styles.alertBad]}>
//               <Text style={styles.alertBadText}>Hisobotni yuklab bo'lmadi</Text>
//               <Pressable
//                 onPress={() => report.refetch()}
//                 accessibilityRole="button"
//                 accessibilityLabel="Qayta urinish"
//                 style={[styles.retry, styles.focusable]}
//               >
//                 <Text style={styles.retryText}>Qayta urinish</Text>
//               </Pressable>
//             </View>
//           )}
//
//           {sections && (
//             <>
//               {/* Safety */}
//               {sections.safety.concerning_count > 0 ? (
//                 <View style={[glass(22, 'md'), styles.alertCard, styles.alertBad]}>
//                   <View style={styles.alertRow}>
//                     <AlertTriangle size={20} color={DANGER} strokeWidth={2.2} />
//                     <View style={styles.flex}>
//                       <Text style={styles.alertBadText}>
//                         {sections.safety.concerning_count} ta diqqat talab qiluvchi mavzu
//                       </Text>
//                       <Text style={styles.alertBlurb}>
//                         {sections.safety.had_red
//                           ? 'Jiddiy signal aniqlandi — suhbatlashing'
//                           : 'Hissiy qiyinchilik belgilari'}
//                       </Text>
//                     </View>
//                   </View>
//                 </View>
//               ) : (
//                 <View style={[glass(22, 'md'), styles.alertCard, styles.alertGood]}>
//                   <View style={styles.alertRow}>
//                     <CheckCircle size={20} color={GREEN} strokeWidth={2.2} />
//                     <Text style={styles.alertGoodText}>
//                       Xavfsizlik signallari aniqlanmadi
//                     </Text>
//                   </View>
//                 </View>
//               )}
//
//               {/* Activity stats */}
//               <View style={styles.stats}>
//                 <View style={[glass(20, 'md'), styles.stat]}>
//                   <Activity size={18} color={PRIMARY} strokeWidth={2.2} />
//                   <Text style={styles.statValue}>
//                     {sections.activity.active_days}
//                   </Text>
//                   <Text style={styles.caption}>faol kun</Text>
//                 </View>
//                 <View style={[glass(20, 'md'), styles.stat]}>
//                   <MessageCircle size={18} color={GOLD} strokeWidth={2.2} />
//                   <Text style={styles.statValue}>
//                     {sections.activity.conversations}
//                   </Text>
//                   <Text style={styles.caption}>suhbat</Text>
//                 </View>
//                 <View style={[glass(20, 'md'), styles.stat]}>
//                   <Sparkles size={18} color={GREEN} strokeWidth={2.2} />
//                   <Text style={styles.statValue}>
//                     {sections.activity.total_messages}
//                   </Text>
//                   <Text style={styles.caption}>xabar</Text>
//                 </View>
//               </View>
//
//               {/* Mood summary */}
//               <View style={[glass(24, 'md'), styles.card]}>
//                 <View style={styles.cardHead}>
//                   <Heart size={18} color={DANGER} strokeWidth={2.2} />
//                   <Text style={styles.cardTitle}>Kayfiyat</Text>
//                   <View style={styles.badge}>
//                     <Text style={styles.badgeText}>
//                       {sections.mood.mood_trend}
//                     </Text>
//                   </View>
//                 </View>
//                 <Text style={styles.body}>{sections.mood.mood_summary}</Text>
//                 {sections.mood.highlight !== '' && (
//                   <Text style={styles.bodyMuted}>
//                     ⭐ {sections.mood.highlight}
//                   </Text>
//                 )}
//                 {sections.mood.topics.length > 0 && (
//                   <View style={styles.chips}>
//                     {sections.mood.topics.map((t) => (
//                       <View key={t} style={styles.chip}>
//                         <Text style={styles.chipText}>{t}</Text>
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
//                   <View style={[glass(24, 'md'), styles.card]}>
//                     <View style={styles.cardHead}>
//                       <Brain size={18} color={PRIMARY} strokeWidth={2.2} />
//                       <Text style={styles.cardTitle}>Rivojlanish</Text>
//                       {sections.cognitive.vocabulary_level !== '' && (
//                         <View style={styles.badge}>
//                           <Text style={styles.badgeText}>
//                             lug'at: {sections.cognitive.vocabulary_level}
//                           </Text>
//                         </View>
//                       )}
//                     </View>
//                     {sections.cognitive.note !== '' && (
//                       <Text style={styles.body}>{sections.cognitive.note}</Text>
//                     )}
//                     {sections.cognitive.curiosity_signals.length > 0 && (
//                       <View style={styles.chips}>
//                         {sections.cognitive.curiosity_signals.map((s) => (
//                           <View key={s} style={styles.chip}>
//                             <Text style={styles.chipText}>{s}</Text>
//                           </View>
//                         ))}
//                       </View>
//                     )}
//                     {sections.cognitive.reasoning_band !== '' && (
//                       <View style={styles.well}>
//                         <Text style={styles.wellTitle}>
//                           Mantiqiy fikrlash: {sections.cognitive.reasoning_band}
//                         </Text>
//                         <Text style={styles.wellMeta}>
//                           Doskadagi jumboqlar: {sections.cognitive.puzzles_correct}/
//                           {sections.cognitive.puzzles_answered} to'g'ri
//                         </Text>
//                       </View>
//                     )}
//                     <Text style={styles.disclaimer}>
//                       Bu — suhbat uslubidan olingan kuzatuv, tibbiy yoki
//                       psixologik baho emas.
//                     </Text>
//                   </View>
//                 )}
//
//               {/* Trend over past reports. Needs at least two periods to mean
//                   anything — a single bar is not a trend. */}
//               {trendPoints.length >= 2 && (
//                 <View style={[glass(24, 'md'), styles.card]}>
//                   <View style={[styles.cardHead, styles.cardHeadWide]}>
//                     <TrendingUp size={18} color={SERIES_COLOR} strokeWidth={2.2} />
//                     <Text style={styles.cardTitle}>Dinamika</Text>
//                     <Text style={styles.cardHeadMeta}>
//                       {trendPoints.length} ta davr
//                     </Text>
//                   </View>
//                   <ActiveDaysTrend points={trendPoints} />
//                 </View>
//               )}
//
//               {/* Guidance */}
//               {sections.guidance && (
//                 <View style={[glass(24, 'md'), styles.card]}>
//                   <View style={styles.cardHead}>
//                     <Lightbulb size={18} color={GOLD} strokeWidth={2.2} />
//                     <Text style={styles.cardTitle}>Maslahatlar</Text>
//                   </View>
//                   {sections.guidance.focus !== '' && (
//                     <Text style={styles.focusText}>
//                       {sections.guidance.focus}
//                     </Text>
//                   )}
//                   <View style={styles.tips}>
//                     {sections.guidance.tips.map((tip, i) => (
//                       <View key={i} style={styles.tipRow}>
//                         <Text style={styles.tipBullet}>•</Text>
//                         <Text style={styles.tipText}>{tip}</Text>
//                       </View>
//                     ))}
//                   </View>
//                 </View>
//               )}
//             </>
//           )}
//
//           <Text style={styles.privacyNote}>
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
// const styles = StyleSheet.create({
//   flex: { flex: 1 },
//   // The browser's default focus ring is a black rectangle around a rounded
//   // control. RN's ViewStyle has no outline, so this is a web-only escape;
//   // native ignores unknown keys.
//   focusable: { outlineStyle: 'none', outlineWidth: 0 } as unknown as ViewStyle,
//
//   header: {
//     height: 68,
//     flexDirection: 'row',
//     alignItems: 'center',
//     paddingHorizontal: 20,
//     gap: 14,
//   },
//   headerButton: {
//     width: 48,
//     height: 48,
//     alignItems: 'center',
//     justifyContent: 'center',
//   },
//   title: { fontSize: 22, fontWeight: '700', color: INK },
//
//   scroll: {
//     paddingHorizontal: 20,
//     paddingTop: 6,
//     paddingBottom: 48,
//     gap: 16,
//   },
//   caption: { fontSize: 12, color: MUTED },
//
//   hero: { padding: 20 },
//   heroRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
//   heroMascot: { width: 72, height: 72 },
//   heroName: { fontSize: 20, fontWeight: '700', color: TITLE },
//   heroMeta: { fontSize: 14, color: MUTED },
//   heroWindow: { marginTop: 8, fontSize: 12, color: MUTED },
//
//   loading: { alignItems: 'center', padding: 32 },
//   loadingText: { marginTop: 12, fontSize: 14, color: MUTED },
//
//   alertCard: { padding: 16 },
//   alertRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
//   alertBad: {
//     borderColor: 'rgba(224,69,94,0.35)',
//     backgroundColor: 'rgba(224,69,94,0.10)',
//   },
//   alertBadText: { fontSize: 14, fontWeight: '600', color: DANGER },
//   alertGood: {
//     borderColor: 'rgba(34,181,115,0.35)',
//     backgroundColor: 'rgba(34,181,115,0.12)',
//   },
//   alertGoodText: { flex: 1, fontSize: 14, fontWeight: '600', color: GREEN },
//   alertBlurb: { marginTop: 4, fontSize: 12, lineHeight: 17, color: MUTED },
//   retry: { alignSelf: 'flex-start', marginTop: 4, paddingVertical: 8 },
//   retryText: { fontSize: 14, fontWeight: '700', color: PRIMARY },
//
//   stats: { flexDirection: 'row', gap: 12 },
//   stat: { flex: 1, padding: 16 },
//   statValue: { marginTop: 8, fontSize: 24, fontWeight: '800', color: INK },
//
//   card: { padding: 20 },
//   cardHead: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 8,
//     marginBottom: 12,
//   },
//   cardHeadWide: { marginBottom: 16 },
//   cardTitle: { fontSize: 16, fontWeight: '700', color: INK },
//   cardHeadMeta: { marginLeft: 'auto', fontSize: 12, color: MUTED },
//   badge: {
//     marginLeft: 'auto',
//     paddingHorizontal: 10,
//     paddingVertical: 4,
//     borderRadius: 999,
//     backgroundColor: 'rgba(47,111,228,0.12)',
//   },
//   badgeText: { fontSize: 12, fontWeight: '600', color: PRIMARY },
//
//   body: { fontSize: 14, lineHeight: 20, color: INK },
//   bodyMuted: { marginTop: 12, fontSize: 14, lineHeight: 20, color: MUTED },
//
//   chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
//   // A chip inside a card is flush with it: a pane that casts a shadow onto
//   // the pane it belongs to is the tell that depth is being faked.
//   chip: {
//     paddingHorizontal: 10,
//     paddingVertical: 5,
//     borderRadius: 12,
//     backgroundColor: 'rgba(47,111,228,0.10)',
//   },
//   chipText: { fontSize: 12, color: INK },
//
//   well: {
//     marginTop: 16,
//     padding: 12,
//     borderRadius: 14,
//     backgroundColor: 'rgba(47,111,228,0.08)',
//   },
//   wellTitle: { fontSize: 14, fontWeight: '600', color: INK },
//   wellMeta: { marginTop: 4, fontSize: 12, lineHeight: 17, color: MUTED },
//   disclaimer: { marginTop: 16, fontSize: 12, lineHeight: 17, color: MUTED },
//
//   bars: { flexDirection: 'row', alignItems: 'flex-end', height: 56, gap: 2 },
//   barSlot: { flex: 1, justifyContent: 'flex-end', height: '100%' },
//   bar: { borderTopLeftRadius: 4, borderTopRightRadius: 4 },
//   barsLegend: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     marginTop: 8,
//   },
//   barsLatest: { fontSize: 12, fontWeight: '600', color: SERIES_COLOR },
//
//   focusText: { marginBottom: 12, fontSize: 14, fontWeight: '600', color: INK },
//   tips: { gap: 12 },
//   tipRow: { flexDirection: 'row', gap: 8 },
//   tipBullet: { fontSize: 14, lineHeight: 20, color: GOLD },
//   tipText: { flex: 1, fontSize: 14, lineHeight: 20, color: INK },
//
//   privacyNote: {
//     marginTop: 16,
//     fontSize: 12,
//     lineHeight: 17,
//     color: MUTED,
//     textAlign: 'center',
//   },
// });
//
