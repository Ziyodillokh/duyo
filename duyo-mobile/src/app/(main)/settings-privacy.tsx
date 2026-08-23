import { useIsDark } from '@/store/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
  ArrowLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Trash2,
  UserX,
} from 'lucide-react-native';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '@/components/text';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useT } from '@/i18n';

interface PrivacyAction {
  key: string;
  Icon: typeof Download;
  label: string;
  description: string;
  destructive?: boolean;
  onPress: () => void;
}

export default function PrivacySettingsScreen() {
  const t = useT();
  const isDark = useIsDark();
  const handleExport = () => {
    Alert.alert(
      t('settings.privacyScreen.exportLabel'),
      t('settings.privacyScreen.exportBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.privacyScreen.exportConfirm'),
          onPress: () => Alert.alert(t('settings.privacyScreen.exportSent')),
        },
      ],
    );
  };

  const handleDelete = () => {
    Alert.alert(
      t('settings.privacyScreen.deleteChatsTitle'),
      t('settings.privacyScreen.deleteChatsBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () =>
            Alert.alert(t('settings.privacyScreen.deleteChatsDone')),
        },
      ],
    );
  };

  const handleCloseAccount = () => {
    Alert.alert(
      t('settings.privacyScreen.closeAccountLabel'),
      t('settings.privacyScreen.closeAccountBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.close'),
          style: 'destructive',
          onPress: () =>
            Alert.alert(
              t('common.comingSoon'),
              t('settings.privacyScreen.closeAccountSoon'),
            ),
        },
      ],
    );
  };

  const ACTIONS: readonly PrivacyAction[] = [
    {
      key: 'export',
      Icon: Download,
      label: t('settings.privacyScreen.exportLabel'),
      description: t('settings.privacyScreen.exportDesc'),
      onPress: handleExport,
    },
    {
      key: 'delete-chats',
      Icon: Trash2,
      label: t('settings.privacyScreen.deleteChatsLabel'),
      description: t('settings.privacyScreen.deleteChatsDesc'),
      destructive: true,
      onPress: handleDelete,
    },
    {
      key: 'close',
      Icon: UserX,
      label: t('settings.privacyScreen.closeAccountLabel'),
      description: t('settings.privacyScreen.closeAccountDesc'),
      destructive: true,
      onPress: handleCloseAccount,
    },
  ];

  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? '#0A1628' : '#F4F8FF' }]} />
      <LinearGradient
        colors={['rgba(96, 165, 250, 0.20)', 'rgba(252, 211, 77, 0.15)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.97, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View className="flex-row items-center gap-3 px-6 py-4">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            className="w-10 h-10 items-center justify-center"
          >
            <ArrowLeft size={20} color={isDark ? '#E0E7FF' : '#102033'} />
          </Pressable>
          <Text className="text-xl font-bold text-foreground dark:text-dark-text">
            {t('settings.privacy')}
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 24, gap: 16, paddingBottom: 48 }}
        >
          <View
            className="rounded-xl border border-neon-blue/20"
            style={{ padding: 16 }}
          >
            <View className="flex-row items-center gap-2 mb-2">
              <FileText size={18} color="#60A5FA" />
              <Text className="text-base font-medium text-foreground dark:text-dark-text">
                {t('settings.privacyScreen.policyTitle')}
              </Text>
            </View>
            <Text className="text-sm text-muted-foreground dark:text-dark-muted leading-5 mb-3">
              {t('settings.privacyScreen.policyBody')}
            </Text>
            <Pressable
              onPress={() =>
                Alert.alert(
                  t('common.comingSoon'),
                  t('settings.privacyScreen.policySoon'),
                )
              }
              accessibilityRole="link"
              accessibilityLabel={t('settings.privacyScreen.readFullA11y')}
              className="flex-row items-center gap-1 active:opacity-80"
            >
              <Text className="text-sm font-medium text-neon-blue">
                {t('settings.privacyScreen.readFull')}
              </Text>
              <ExternalLink size={14} color="#60A5FA" />
            </Pressable>
          </View>

          <View className="gap-3">
            <Text className="text-sm text-muted-foreground dark:text-dark-muted">
              {t('settings.privacyScreen.dataSection')}
            </Text>
            {ACTIONS.map((a) => (
              <Pressable
                key={a.key}
                onPress={a.onPress}
                accessibilityRole="button"
                accessibilityLabel={a.label}
                className="rounded-xl bg-card dark:bg-dark-surface border border-neon-blue/20 active:opacity-80"
                style={{ padding: 16 }}
              >
                <View className="flex-row items-center gap-3">
                  <View
                    className="w-10 h-10 items-center justify-center rounded-md"
                    style={{
                      backgroundColor: a.destructive
                        ? 'rgba(251, 100, 182, 0.10)'
                        : 'rgba(96, 165, 250, 0.10)',
                    }}
                  >
                    <a.Icon
                      size={18}
                      color={a.destructive ? '#FB64B6' : '#60A5FA'}
                    />
                  </View>
                  <View className="flex-1">
                    <Text
                      className="text-base font-medium"
                      style={{
                        color: a.destructive ? '#FB64B6' : '#E0E7FF',
                      }}
                    >
                      {a.label}
                    </Text>
                    <Text className="text-sm text-muted-foreground dark:text-dark-muted mt-1">
                      {a.description}
                    </Text>
                  </View>
                  <ChevronRight size={18} color="#94A3B8" />
                </View>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
