import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  BookOpen,
  FileText,
  Heart,
  Music,
  Share2,
} from 'lucide-react-native';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { isContentNotFound } from '@/api/endpoints/content';
import { Text } from '@/components/text';
import { useContentItem } from '@/hooks/use-content';
import { useT } from '@/i18n';
import { glass, lift } from '@/lib/glass';

// ── The glass sky, the inner screens' cooler morning ─────────────────────────
// The old navy build predated the glass system; the screen now reads as the
// same app as the library it was opened from.
const PRIMARY = '#2F6FE4';
const INK = '#22406F';
const MUTED = '#8CA3CB';
const DANGER = '#E0455E';
const BG_TOP = '#E3EFFF';
const BG_MID = '#EAF3FF';
const BG_BOTTOM = '#EDF2FD';

/** The page sky, drawn behind every state this screen can be in. */
function Sky() {
  return (
    <LinearGradient
      colors={[BG_TOP, BG_MID, BG_BOTTOM]}
      locations={[0, 0.55, 1]}
      style={StyleSheet.absoluteFill}
    />
  );
}

export default function LibraryItemScreen() {
  const t = useT();
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id ?? '';

  const { data: item, isLoading, isError, error } = useContentItem(id);

  const renderMessage = (emoji: string, message: string) => (
    <View style={StyleSheet.absoluteFill}>
      <Sky />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centered}>
          <Text style={styles.messageEmoji}>{emoji}</Text>
          <Text style={styles.messageText}>{message}</Text>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            style={({ pressed }) => [
              styles.messageButton,
              styles.focusable,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.filledLabel}>{t('common.back')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );

  if (isLoading) {
    return (
      <View style={StyleSheet.absoluteFill}>
        <Sky />
        <SafeAreaView style={styles.safe} edges={['top']}>
          <View style={styles.centered}>
            <Text style={styles.loadingText}>{t('common.loading')}</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (isError) {
    return isContentNotFound(error)
      ? renderMessage('🔍', t('libraryItem.notFound'))
      : renderMessage('⚠️', t('libraryItem.loadFailed'));
  }

  if (!item) {
    return renderMessage('🔍', t('libraryItem.notFound'));
  }

  const author = item.author ?? '';
  const isPhoto = item.type === 'photo';
  const isPdf = item.type === 'pdf';
  const hasBody = (item.body ?? '').trim() !== '';
  const body = hasBody ? item.body : t('libraryItem.bodySoon');
  // `likes` is a real counter on the item. There is no per-child like endpoint
  // yet, so this is a readout, not a button — a heart that only changed colour
  // locally promised a save that never happened.
  const likes = item.likes;

  const openPdf = () => {
    if (item.pdf_url) {
      void Linking.openURL(item.pdf_url);
    }
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      <Sky />

      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            style={[glass(24, 'sm'), styles.headerButton, styles.focusable]}
          >
            <ArrowLeft size={22} color={PRIMARY} strokeWidth={2} />
          </Pressable>
          <View style={styles.headerRight}>
            {likes > 0 && (
              <View
                accessibilityLabel={t('libraryItem.a11yLikes', { count: likes })}
                style={[glass(18, 'sm', 0.6), styles.likes]}
              >
                <Heart size={16} color={DANGER} fill={DANGER} />
                <Text style={styles.likesCount}>{likes}</Text>
              </View>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.share')}
              style={[glass(24, 'sm'), styles.headerButton, styles.focusable]}
            >
              <Share2 size={19} color={MUTED} strokeWidth={2} />
            </Pressable>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* The image sits in its own frame so the corner radius can clip it
              while the shadow stays outside the clip. */}
          {item.image_url ? (
            <View style={[styles.cover, isPhoto && styles.coverPhoto]}>
              <Image
                source={{ uri: item.image_url }}
                style={styles.coverImage}
                contentFit="cover"
                accessibilityLabel={item.title}
              />
            </View>
          ) : null}

          <View style={[glass(26, 'lg', 0.62), styles.titleCard]}>
            {!item.image_url && <Text style={styles.titleEmoji}>📖</Text>}
            <Text style={styles.title}>{item.title}</Text>
            {author !== '' && <Text style={styles.author}>{author}</Text>}
            {item.audio_url ? (
              <View style={styles.audioRow}>
                <Music size={14} color={PRIMARY} strokeWidth={2.2} />
                <Text style={styles.audioText}>{t('libraryItem.hasAudio')}</Text>
              </View>
            ) : null}
          </View>

          {item.pdf_url ? (
            <Pressable
              onPress={openPdf}
              accessibilityRole="button"
              accessibilityLabel={t('libraryItem.openPdf')}
              style={({ pressed }) => [
                styles.filled,
                styles.filledRow,
                styles.focusable,
                pressed && styles.pressed,
              ]}
            >
              <FileText size={18} color="#FFFFFF" strokeWidth={2.2} />
              <Text style={styles.filledLabel}>{t('libraryItem.openPdf')}</Text>
            </Pressable>
          ) : null}

          {!(isPdf && !hasBody) && (
            <View style={[glass(24, 'md', 0.55), styles.bodyCard]}>
              <View style={styles.bodyHead}>
                <BookOpen size={18} color={PRIMARY} strokeWidth={2.2} />
                <Text style={styles.bodyHeadText}>
                  {t('libraryItem.content')}
                </Text>
              </View>
              <Text style={styles.bodyText}>{body}</Text>
            </View>
          )}

          <Pressable
            onPress={() => router.push('/(main)/(tabs)/chat')}
            accessibilityRole="button"
            accessibilityLabel={t('libraryItem.discuss')}
            style={({ pressed }) => [
              styles.filled,
              styles.focusable,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.filledLabel}>{t('libraryItem.discuss')}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  messageEmoji: { fontSize: 48, lineHeight: 56 },
  messageText: {
    fontSize: 18,
    fontWeight: '500',
    color: INK,
    textAlign: 'center',
  },
  messageButton: {
    marginTop: 16,
    minHeight: 44,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PRIMARY,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.30)',
    boxShadow: lift('md'),
  },
  loadingText: { fontSize: 16, fontWeight: '500', color: INK },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  headerButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  likes: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  likesCount: { fontSize: 14, fontWeight: '600', color: INK },

  scroll: { padding: 24, gap: 24, paddingBottom: 48 },

  cover: {
    width: '100%',
    height: 200,
    borderRadius: 20,
    overflow: 'hidden',
    boxShadow: lift('md'),
  },
  coverPhoto: { height: 360 },
  coverImage: { width: '100%', height: '100%' },

  titleCard: { padding: 32, alignItems: 'center' },
  titleEmoji: { marginBottom: 12, fontSize: 72, lineHeight: 84 },
  title: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
    color: INK,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  author: { marginTop: 4, fontSize: 16, color: MUTED },
  audioRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  audioText: { fontSize: 14, color: MUTED },

  bodyCard: { padding: 20 },
  bodyHead: {
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bodyHeadText: { fontSize: 16, fontWeight: '700', color: INK },
  bodyText: { fontSize: 22, lineHeight: 32, color: INK },

  // A filled button styles its own surface, so it takes the light on its own
  // (`lift`) rather than the whole glass material.
  filled: {
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PRIMARY,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.30)',
    boxShadow: lift('md'),
  },
  filledRow: { flexDirection: 'row', gap: 8 },
  filledLabel: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },

  pressed: { opacity: 0.8 },
  // The browser's default focus ring is a black rectangle around a rounded
  // control. RN's ViewStyle has no outline, so this is a web-only escape;
  // native ignores unknown keys.
  focusable: { outlineStyle: 'none', outlineWidth: 0 } as unknown as ViewStyle,
});
