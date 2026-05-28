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
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface PrivacyAction {
  key: string;
  Icon: typeof Download;
  label: string;
  description: string;
  destructive?: boolean;
  onPress: () => void;
}

export default function PrivacySettingsScreen() {
  const isDark = useIsDark();
  const handleExport = () => {
    Alert.alert(
      "Ma'lumotlarni eksport qilish",
      "Sizning barcha ma'lumotlaringiz JSON formatida emailingizga yuboriladi.",
      [
        { text: 'Bekor qilish', style: 'cancel' },
        { text: "So'rash", onPress: () => Alert.alert('Yuborildi') },
      ],
    );
  };

  const handleDelete = () => {
    Alert.alert(
      "Suhbatlarni o'chirish",
      "Barcha suhbatlar tarixi o'chiriladi. Bu amal ortga qaytarib bo'lmaydi.",
      [
        { text: 'Bekor qilish', style: 'cancel' },
        {
          text: "O'chirish",
          style: 'destructive',
          onPress: () => Alert.alert('Suhbatlar tozalandi'),
        },
      ],
    );
  };

  const handleCloseAccount = () => {
    Alert.alert(
      'Hisobni yopish',
      'Hisobingiz va barcha ma\'lumotlar 30 kun ichida o\'chiriladi.',
      [
        { text: 'Bekor qilish', style: 'cancel' },
        {
          text: 'Yopish',
          style: 'destructive',
          onPress: () =>
            Alert.alert("Tez orada", "Faza 1'da to'liq integratsiya qo'shiladi"),
        },
      ],
    );
  };

  const ACTIONS: ReadonlyArray<PrivacyAction> = [
    {
      key: 'export',
      Icon: Download,
      label: "Ma'lumotlarni eksport qilish",
      description: "Barcha ma'lumotlarni JSON ko'rinishida yuklab oling",
      onPress: handleExport,
    },
    {
      key: 'delete-chats',
      Icon: Trash2,
      label: "Suhbat tarixini o'chirish",
      description: 'Barcha suhbatlar va xabarlarni tozalash',
      destructive: true,
      onPress: handleDelete,
    },
    {
      key: 'close',
      Icon: UserX,
      label: 'Hisobni yopish',
      description: 'Hisob va barcha ma\'lumotlarni o\'chirish',
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
            accessibilityLabel="Orqaga"
            className="w-10 h-10 items-center justify-center"
          >
            <ArrowLeft size={20} color={isDark ? '#E0E7FF' : '#102033'} />
          </Pressable>
          <Text className="text-xl font-bold text-foreground dark:text-dark-text">Maxfiylik</Text>
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
                Maxfiylik siyosati
              </Text>
            </View>
            <Text className="text-sm text-muted-foreground dark:text-dark-muted leading-5 mb-3">
              DUYO sizning ma'lumotlaringizni qanday saqlaydi va himoya qilishi
              haqida ma'lumot.
            </Text>
            <Pressable
              onPress={() =>
                Alert.alert(
                  'Tez orada',
                  "Maxfiylik siyosati matni Faza 1'da qo'shiladi",
                )
              }
              accessibilityRole="link"
              accessibilityLabel="Toliq matn"
              className="flex-row items-center gap-1 active:opacity-80"
            >
              <Text className="text-sm font-medium text-neon-blue">
                To'liq matnni o'qish
              </Text>
              <ExternalLink size={14} color="#60A5FA" />
            </Pressable>
          </View>

          <View className="gap-3">
            <Text className="text-sm text-muted-foreground dark:text-dark-muted">
              Ma'lumotlar boshqaruvi
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
