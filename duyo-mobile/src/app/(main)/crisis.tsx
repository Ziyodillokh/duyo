import { router, useLocalSearchParams } from 'expo-router';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/text';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DuyoAvatar } from '@/components/duyo-avatar';

type CrisisLevel = 'yellow' | 'orange' | 'red';

interface LevelCopy {
  title: string;
  message: string;
  accentClass: string;
  cardBorderClass: string;
}

const COPY: Record<CrisisLevel, LevelCopy> = {
  yellow: {
    title: 'Men seni tushunaman',
    message: "Ba'zan qiyin paytlar bo'ladi. Men seni tinglashga tayyorman.",
    accentClass: 'bg-warning/10',
    cardBorderClass: 'border-warning',
  },
  orange: {
    title: "Sen yolg'iz emassan",
    message:
      'Men senga yordam berishga tayyorman. Keling, ishonchli katta odam bilan gaplashaylik.',
    accentClass: 'bg-accent/10',
    cardBorderClass: 'border-accent',
  },
  red: {
    title: 'Sen muhimsan',
    message:
      "Men sening xavfsizligingni o'ylayman. Keling, hozir senga yordam beradigan odamni topamiz.",
    accentClass: 'bg-destructive/10',
    cardBorderClass: 'border-destructive',
  },
};

const HOTLINE_PSYCH = '1050';
const HOTLINE_CHILD = '1054';

function normalizeLevel(raw: string | undefined): CrisisLevel {
  if (raw === 'yellow' || raw === 'orange' || raw === 'red') return raw;
  return 'yellow';
}

function callHotline(number: string): void {
  void Linking.openURL(`tel:${number}`);
}

export default function CrisisScreen() {
  const params = useLocalSearchParams<{ level?: string }>();
  const level = normalizeLevel(params.level);
  const copy = COPY[level];

  return (
    <SafeAreaView className={`flex-1 ${copy.accentClass}`}>
      <ScrollView
        contentContainerStyle={{ padding: 24, gap: 20 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="items-center mt-4">
          <DuyoAvatar size="xl" state="crisis-support" />
        </View>

        <View className={`bg-card p-6 rounded-2xl border-2 ${copy.cardBorderClass}`}>
          <Text className="text-2xl font-bold text-foreground text-center mb-3">
            {copy.title}
          </Text>
          <Text className="text-base text-muted-foreground text-center leading-6">
            {copy.message}
          </Text>
        </View>

        <View className="gap-3">
          {level === 'yellow' && <YellowActions />}
          {level === 'orange' && <OrangeActions />}
          {level === 'red' && <RedActions />}
        </View>

        <View className="bg-card border border-border p-4 rounded-2xl">
          <Text className="text-sm font-semibold text-foreground mb-2">
            Yordam kerakmi?
          </Text>
          <Text className="text-sm text-muted-foreground leading-5">
            Sen xavfsizsan va sen yolg'iz emassan. Doimo yordam olish mumkin.
          </Text>
          {level === 'red' && (
            <View className="mt-3 gap-1">
              <Text className="text-sm font-bold text-foreground">
                Favqulodda raqamlar:
              </Text>
              <Pressable
                onPress={() => callHotline(HOTLINE_PSYCH)}
                accessibilityRole="button"
                accessibilityLabel="Psixologik yordamga qo'ng'iroq"
              >
                <Text className="text-sm text-primary font-medium">
                  {HOTLINE_PSYCH} — Psixologik yordam
                </Text>
              </Pressable>
              <Pressable
                onPress={() => callHotline(HOTLINE_CHILD)}
                accessibilityRole="button"
                accessibilityLabel="Bolalar telefoniga qo'ng'iroq"
              >
                <Text className="text-sm text-primary font-medium">
                  {HOTLINE_CHILD} — Bolalar telefoni
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        <Text className="text-xs text-muted-foreground text-center leading-5">
          Bu suhbat maxfiy saqlanadi va faqat sen xavfsiz bo'lishingni
          ta'minlash uchun ishlatiladi.
        </Text>

        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          className="h-12 rounded-lg items-center justify-center bg-muted mt-2"
        >
          <Text className="text-base font-medium text-foreground">Yopish</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function YellowActions() {
  return (
    <>
      <ActionButton
        label="DUYO bilan gaplashishda davom etish"
        primary
        onPress={() => router.back()}
      />
      <ActionButton
        label="Nafas olish mashqlari"
        onPress={() => router.back()}
      />
    </>
  );
}

function OrangeActions() {
  return (
    <>
      <ActionButton
        label="Ishonchli kattaga aytish"
        primary
        onPress={() => router.back()}
      />
      <ActionButton
        label="DUYO bilan gaplashishda davom etish"
        onPress={() => router.back()}
      />
      <ActionButton
        label="Nafas olish mashqlari"
        onPress={() => router.back()}
      />
    </>
  );
}

function RedActions() {
  return (
    <>
      <ActionButton
        label={`${HOTLINE_PSYCH} ga qo'ng'iroq — Psixologik yordam`}
        destructive
        onPress={() => callHotline(HOTLINE_PSYCH)}
      />
      <ActionButton
        label={`${HOTLINE_CHILD} ga qo'ng'iroq — Bolalar telefoni`}
        destructive
        onPress={() => callHotline(HOTLINE_CHILD)}
      />
      <ActionButton
        label="Ishonchli kattaga aytish"
        primary
        onPress={() => router.back()}
      />
    </>
  );
}

interface ActionButtonProps {
  label: string;
  onPress: () => void;
  primary?: boolean;
  destructive?: boolean;
}

function ActionButton({
  label,
  onPress,
  primary,
  destructive,
}: ActionButtonProps) {
  const tone = destructive
    ? 'bg-destructive'
    : primary
      ? 'bg-primary'
      : 'bg-card border border-border';
  const text = destructive || primary ? 'text-white' : 'text-foreground';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className={`h-14 rounded-xl items-center justify-center px-4 active:opacity-80 ${tone}`}
    >
      <Text className={`text-base font-semibold ${text}`}>{label}</Text>
    </Pressable>
  );
}
