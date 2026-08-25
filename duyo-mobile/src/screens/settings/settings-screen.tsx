import { LinearGradient } from 'expo-linear-gradient';
import { router, useNavigation } from 'expo-router';
import {
  ArrowLeft,
  Bell,
  BrainCircuit,
  Camera,
  Check,
  ImagePlus,
  ChevronRight,
  Crown,
  Globe,
  HelpCircle,
  LogOut,
  Mic,
  Moon,
  PenLine,
  Shield,
  Sparkles,
  Trash2,
  X,
  type LucideIcon,
  // Users, // OTA-ONA BO'LIMI O'CHIRILGAN — qatori bilan birga kommentda
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { type ReactNode, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  deleteChildPhoto,
  updateChild,
  uploadChildPhoto,
} from '@/api/endpoints/children';
import { ActionSheet, type SheetAction } from '@/components/action-sheet';
import { Text, TextInput } from '@/components/text';
import { useNavClearance } from '@/components/v2/dark/bottom-nav';
import { ChildAvatar } from '@/components/child-avatar';
import { LANGUAGE_NAMES, useT } from '@/i18n';
import { glass, lift } from '@/lib/glass';
import { useAuthStore } from '@/store/auth';
import { useChildStore } from '@/store/child';
import { useLanguageStore } from '@/store/language';
import { useMascotStore } from '@/store/mascot';
import { useThemeStore } from '@/store/theme';

// ── The glass sky, the inner screens' cooler morning ─────────────────────────
// Same family as notifications and goal-mates: frosted panes on pale blue.
// The screen commits to the light look the way its siblings do — the theme
// toggle below still drives the screens that carry a dark variant.
const PRIMARY = '#2F6FE4';
const INK = '#22406F';
const MUTED = '#8CA3CB';
const DANGER = '#E0455E';
const BG_TOP = '#E3EFFF';
const BG_MID = '#EAF3FF';
const BG_BOTTOM = '#EDF2FD';
const HAIRLINE = 'rgba(47,111,228,0.10)';

/** The one column the server keeps is `name`, and it holds the whole thing.
 *
 *  Two inputs and one column round-trip exactly as long as the split is on
 *  the FIRST space: join("Ali", "Bek Valiyev") → "Ali Bek Valiyev" → split →
 *  ("Ali", "Bek Valiyev"). A child with one name simply has an empty surname,
 *  which is a legitimate state and not an error to correct. */
function splitName(full: string): { first: string; last: string } {
  const t = full.trim();
  const i = t.indexOf(' ');
  if (i === -1) return { first: t, last: '' };
  return { first: t.slice(0, i), last: t.slice(i + 1).trim() };
}

function joinName(first: string, last: string): string {
  return [first.trim(), last.trim()].filter(Boolean).join(' ');
}

/**
 * Sozlamalar — and, since the Profile page was folded into it, the one place
 * the child's own identity is edited.
 *
 * ## Why there is no separate profile screen any more
 *
 * The old one showed level, XP, streak, the week strip and the reward ledger.
 * Every one of those now has a better home: the dashboard leads with them and
 * Faollik goes deeper than the profile ever did. What was left once those
 * moved out was a name, a picture, and a gear icon pointing here — a page
 * whose only unique content was a doorway to another page.
 *
 * So the doorway is gone and the name and picture came here, where they sit
 * above the settings that change them. One screen, reached from the same
 * avatar in the dashboard header as before.
 *
 * ## `variant`
 *
 * The same screen is both a tab (reached from the dashboard) and a pushed
 * page (reached from a gear icon elsewhere). Only two things differ: what
 * "back" means, and whether the dock is floating over the bottom.
 */
export function SettingsScreen({ variant = 'page' }: { variant?: 'tab' | 'page' }) {
  const t = useT();
  const language = useLanguageStore((s) => s.language);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const child = useChildStore((s) => s.child);
  const setChild = useChildStore((s) => s.setChild);
  const clearChild = useChildStore((s) => s.clearChild);
  const mascot = useMascotStore((s) => s.variant);
  const setMascot = useMascotStore((s) => s.setVariant);
  const themeMode = useThemeStore((s) => s.mode);
  const toggleTheme = useThemeStore((s) => s.toggle);
  const [notifications, setNotifications] = useState(true);

  // Sibling tabs go through this screen's navigator; router.push into the
  // (tabs) group from inside it is a silent no-op on web.
  const navigation = useNavigation() as { navigate(name: string): void };
  const navClearance = useNavClearance();

  const [editing, setEditing] = useState(false);
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [confirmLogout, setConfirmLogout] = useState(false);

  const fullName = child?.name ?? '';
  const hasPhoto = Boolean(child?.photo_url);
  const parts = splitName(fullName);

  const beginEdit = () => {
    setFirst(parts.first);
    setLast(parts.last);
    setSaveError(null);
    setEditing(true);
  };

  const save = async () => {
    const name = joinName(first, last);
    // An empty name would leave the child nameless everywhere at once —
    // greetings, the mates list, the parent report. Refused here rather than
    // by a 422 the child cannot read.
    if (!child || !name) {
      setSaveError('Ism bo‘sh bo‘lishi mumkin emas');
      return;
    }
    if (name === fullName) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await updateChild(child.id, { name });
      setChild(updated);
      setEditing(false);
    } catch {
      setSaveError('Saqlanmadi — internetni tekshiring');
    } finally {
      setSaving(false);
    }
  };

  const logout = () => {
    clearAuth();
    clearChild();
    // The next child picks their own body during onboarding.
    setMascot('duyo');
    router.replace('/(onboarding)/language');
  };

  /**
   * Pick a photo and put it on the profile.
   *
   * `allowsEditing` gives the child the platform's own square cropper,
   * which is the only chance to frame a face before it is shown inside a
   * circle. The size caps are not decoration: the server refuses over
   * 2 MB, and an unresized phone photo is several times that.
   */
  const pickPhoto = async () => {
    setPickerOpen(false);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setPhotoError('Galereyaga ruxsat berilmadi');
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (picked.canceled || !child) return;

    const asset = picked.assets[0];
    if (!asset?.uri) return;
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      const updated = await uploadChildPhoto(
        child.id,
        asset.uri,
        asset.mimeType ?? 'image/jpeg',
      );
      setChild(updated);
    } catch {
      setPhotoError('Rasm yuklanmadi — boshqa rasm tanlab ko‘ring');
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePhoto = async () => {
    setPickerOpen(false);
    if (!child) return;
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      setChild(await deleteChildPhoto(child.id));
    } catch {
      setPhotoError('O‘chirilmadi — internetni tekshiring');
    } finally {
      setPhotoBusy(false);
    }
  };

  // Ordered by what the child most likely came here to do. Removing the
  // photo only appears when there IS one — an always-present "remove"
  // over nothing is a control that lies about the state.
  const pickerActions: SheetAction[] = [
    {
      label: hasPhoto ? 'Boshqa rasm tanlash' : 'Galereyadan rasm tanlash',
      icon: ImagePlus,
      onPress: () => void pickPhoto(),
    },
    {
      label: mascot === 'duyo' ? 'DUYO ✓' : 'DUYO',
      icon: Sparkles,
      onPress: () => setMascot('duyo'),
    },
    {
      label: mascot === 'raccoon' ? 'Yenot ✓' : 'Yenot',
      icon: Sparkles,
      onPress: () => setMascot('raccoon'),
    },
    {
      label: 'Ko‘rinishni tahrirlash',
      icon: PenLine,
      onPress: () => router.push('/(main)/avatar-customization'),
    },
    ...(hasPhoto
      ? [
          {
            label: 'Rasmni o‘chirish',
            icon: Trash2,
            destructive: true,
            onPress: () => void removePhoto(),
          },
        ]
      : []),
  ];

  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={[BG_TOP, BG_MID, BG_BOTTOM]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView
        style={{ flex: 1 }}
        edges={variant === 'tab' ? ['top'] : ['top', 'bottom']}
      >
        {/* ── Header: the inner-screen glass pattern ─────────────────── */}
        <View style={styles.header}>
          <Pressable
            onPress={() =>
              variant === 'tab' ? navigation.navigate('index') : router.back()
            }
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            style={[glass(24, 'sm'), styles.headerButton, styles.focusable]}
          >
            <ArrowLeft size={23} color={PRIMARY} strokeWidth={2} />
          </Pressable>
          <Text style={styles.title}>{t('settings.title')}</Text>
          {/* Keeps the title centred. */}
          <View style={styles.headerButton} />
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 6,
            paddingBottom: variant === 'tab' ? navClearance + 24 : 40,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Who this is ──────────────────────────────────────────── */}
          <View style={[glass(26, 'lg'), styles.identity]}>
            <Pressable
              onPress={() => setPickerOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Rasmni o‘zgartirish"
              style={styles.avatarWrap}
            >
              <ChildAvatar size={78} glow="soft" />
              {/* The badge is what says the picture is a control. Without it
                  an avatar is decoration and nobody taps it. */}
              <View style={styles.avatarBadge}>
                {photoBusy ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Camera size={13} color="#FFFFFF" strokeWidth={2.4} />
                )}
              </View>
            </Pressable>

            {editing ? (
              <View style={styles.editBody}>
                <TextInput
                  value={first}
                  onChangeText={setFirst}
                  placeholder="Ism"
                  placeholderTextColor={MUTED}
                  maxLength={40}
                  autoFocus
                  style={styles.input}
                />
                <TextInput
                  value={last}
                  onChangeText={setLast}
                  placeholder="Familiya"
                  placeholderTextColor={MUTED}
                  maxLength={40}
                  style={styles.input}
                />
                {saveError && <Text style={styles.error}>{saveError}</Text>}
                <View style={styles.editActions}>
                  <Pressable
                    onPress={() => setEditing(false)}
                    accessibilityRole="button"
                    accessibilityLabel="Bekor qilish"
                    style={[glass(16, 'sm', 0.6), styles.editButton, styles.focusable]}
                  >
                    <X size={16} color={MUTED} strokeWidth={2.4} />
                    <Text style={styles.editCancelText}>Bekor</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void save()}
                    disabled={saving}
                    accessibilityRole="button"
                    accessibilityLabel="Saqlash"
                    style={[styles.editButton, styles.editSave, styles.focusable]}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Check size={16} color="#FFFFFF" strokeWidth={2.6} />
                    )}
                    <Text style={styles.editSaveText}>Saqlash</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <>
                <View style={styles.identityBody}>
                  <Text style={styles.identityName} numberOfLines={1}>
                    {fullName || 'Ism kiritilmagan'}
                  </Text>
                  <Text style={styles.identityMeta}>
                    {child?.age !== undefined
                      ? `${child.age} yosh`
                      : 'Profil yuklanmoqda'}
                  </Text>
                  {photoError && (
                    <Text style={styles.error}>{photoError}</Text>
                  )}
                </View>
                <Pressable
                  onPress={beginEdit}
                  disabled={!child}
                  accessibilityRole="button"
                  accessibilityLabel="Ism va familiyani o‘zgartirish"
                  style={[glass(18, 'sm'), styles.editIcon, styles.focusable]}
                >
                  <PenLine size={17} color={PRIMARY} strokeWidth={2.2} />
                </Pressable>
              </>
            )}
          </View>

          <Section title={t('settings.section.general')}>
            <Row
              Icon={Globe}
              label={t('settings.language')}
              value={LANGUAGE_NAMES[language]}
              onPress={() => router.push('/(main)/settings-language')}
            />
            <Row
              Icon={Moon}
              label={t('settings.darkMode')}
              trailing={
                <Switch
                  value={themeMode === 'dark'}
                  onValueChange={toggleTheme}
                  trackColor={{ false: 'rgba(140,163,203,0.35)', true: PRIMARY }}
                  thumbColor="#FFFFFF"
                />
              }
            />
            <Row
              Icon={Bell}
              label={t('settings.notifications')}
              trailing={
                <Switch
                  value={notifications}
                  onValueChange={setNotifications}
                  trackColor={{ false: 'rgba(140,163,203,0.35)', true: PRIMARY }}
                  thumbColor="#FFFFFF"
                />
              }
            />
            <Row
              Icon={Mic}
              label={t('settings.voice')}
              onPress={() => router.push('/(main)/settings-voice')}
              isLast
            />
          </Section>

          <Section title={t('settings.section.safety')}>
            <Row
              Icon={BrainCircuit}
              label={t('settings.memory')}
              value={t('settings.memoryValue')}
              onPress={() => router.push('/(main)/memory')}
            />
            <Row
              Icon={Shield}
              label={t('settings.privacy')}
              onPress={() => router.push('/(main)/settings-privacy')}
              isLast
            />
            {/* OTA-ONA BO'LIMI O'CHIRILGAN — ilova hozircha faqat bola uchun.
                Qatorning asl kodi:
            <Row
              Icon={Users}
              label={t('settings.parentLink')}
              value={t('settings.parentLinkConnected')}
              onPress={() => router.push('/(main)/parent-connection')}
              isLast
            />
            */}
          </Section>

          <Section title={t('settings.section.subscription')}>
            <Row
              Icon={Crown}
              label={t('settings.plan')}
              value={t('settings.planValue')}
              onPress={() => router.push('/(main)/subscription')}
              isLast
            />
          </Section>

          <Section title={t('settings.section.help')}>
            <Row
              Icon={HelpCircle}
              label={t('settings.help')}
              onPress={() => router.push('/(main)/settings-help')}
              isLast
            />
          </Section>

          {/* Logout is its own pane — an exit should not sit inside a group
              of preferences a child taps casually. */}
          <Pressable
            onPress={() => setConfirmLogout(true)}
            accessibilityRole="button"
            accessibilityLabel={t('settings.logout')}
            style={[glass(22, 'md', 0.5), styles.logout, styles.focusable]}
          >
            <LogOut size={18} color={DANGER} strokeWidth={2.2} />
            <Text style={styles.logoutText}>{t('settings.logout')}</Text>
          </Pressable>

          <View style={styles.footer}>
            <Text style={styles.footerText}>DUYO v1.0.0</Text>
            <Text style={styles.footerText}>{t('common.copyright')}</Text>
          </View>
        </ScrollView>
      </SafeAreaView>

      <ActionSheet
        visible={pickerOpen}
        title="Profil rasmi"
        message="Profil rasmingizni tanlang"
        actions={pickerActions}
        onClose={() => setPickerOpen(false)}
      />

      {/* Not Alert.alert: react-native-web ships Alert as an empty function,
          so on web the old confirmation simply never appeared and logging out
          did nothing at all. */}
      <ActionSheet
        visible={confirmLogout}
        title={t('settings.logout')}
        message={t('settings.logoutConfirm')}
        actions={[
          { label: t('settings.logout'), onPress: logout, destructive: true, icon: LogOut },
        ]}
        onClose={() => setConfirmLogout(false)}
      />
    </View>
  );
}

// ── The glass settings vocabulary ────────────────────────────────────────────

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={[glass(22, 'md', 0.6), styles.pane]}>{children}</View>
    </View>
  );
}

function Row({
  Icon,
  label,
  value,
  trailing,
  onPress,
  isLast,
}: {
  Icon: LucideIcon;
  label: string;
  value?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  isLast?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={label}
      style={[styles.row, !isLast && styles.rowDivider, styles.focusable]}
    >
      <View style={styles.iconWell}>
        <Icon size={19} color={PRIMARY} strokeWidth={2} />
      </View>
      <Text style={styles.rowLabel}>{label}</Text>
      {!!value && <Text style={styles.rowValue}>{value}</Text>}
      {trailing}
      {onPress && <ChevronRight size={18} color={MUTED} strokeWidth={2.2} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // The browser's default focus ring is a black rectangle around a round
  // control. RN's ViewStyle has no outline, so this is a web-only escape;
  // native ignores unknown keys.
  focusable: {
    outlineStyle: 'none',
    outlineWidth: 0,
    WebkitTapHighlightColor: 'transparent',
  } as unknown as ViewStyle,

  header: {
    height: 68,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 14,
  },
  headerButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: INK,
  },

  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    marginBottom: 18,
  },
  avatarWrap: { width: 78, height: 78 },
  avatarBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PRIMARY,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  identityBody: { flex: 1, gap: 3 },
  identityName: { fontSize: 20, fontWeight: '700', color: INK },
  identityMeta: { fontSize: 13, color: MUTED },
  editIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  editBody: { flex: 1, gap: 8 },
  // Flat rather than glass(): the helper returns a ViewStyle and a
  // TextInput takes a TextStyle. Same look, built the way the app's
  // other inputs are (components/goals/handle-editor.tsx).
  input: {
    height: 42,
    paddingHorizontal: 12,
    borderRadius: 14,
    fontSize: 15,
    fontWeight: '600',
    color: INK,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1.5,
    borderColor: 'rgba(47,111,228,0.12)',
    boxShadow: lift('sm'),
    outlineStyle: 'none',
    outlineWidth: 0,
  } as unknown as TextStyle,
  error: { fontSize: 12.5, color: DANGER },
  editActions: { flexDirection: 'row', gap: 8, marginTop: 2 },
  editButton: {
    flex: 1,
    height: 38,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  editCancelText: { fontSize: 14, fontWeight: '700', color: MUTED },
  editSave: { backgroundColor: PRIMARY },
  editSaveText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  section: { marginBottom: 18 },
  sectionTitle: {
    marginLeft: 6,
    marginBottom: 8,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: MUTED,
  },
  pane: { paddingHorizontal: 14 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
  },
  iconWell: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(47,111,228,0.10)',
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: INK,
  },
  rowValue: {
    fontSize: 13,
    color: MUTED,
  },

  logout: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '700',
    color: DANGER,
  },

  footer: {
    alignItems: 'center',
    gap: 2,
    paddingTop: 22,
  },
  footerText: {
    fontSize: 12,
    color: MUTED,
  },
});
