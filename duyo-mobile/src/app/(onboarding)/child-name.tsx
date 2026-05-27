import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createChild } from '@/api/endpoints/children';
import { DuyoAvatar } from '@/components/duyo-avatar';
import { useChildStore } from '@/store/child';
import { useLanguageStore } from '@/store/language';

const MIN_AGE = 7;
const MAX_AGE = 16;
const DEFAULT_AGE = 10;
const NAME_MAX_LENGTH = 80;

interface AxiosErrorShape {
  response?: { data?: { detail?: string } };
}

function ageSegmentLabel(age: number): string {
  if (age <= 10) return "Junior — Ko'proq vizual va o'yinlar";
  if (age <= 13) return 'Explorer — Maktab yordami va missiyalar';
  return "Companion — O'quv va karyera maslahat";
}

export default function ChildNameScreen() {
  const language = useLanguageStore((s) => s.language);
  const setChild = useChildStore((s) => s.setChild);
  const [name, setName] = useState('');
  const [age, setAge] = useState(DEFAULT_AGE);
  const [nameFocused, setNameFocused] = useState(false);

  const trimmedName = name.trim();
  const isValid = trimmedName.length > 0;

  const mutation = useMutation({
    mutationFn: () => createChild({ name: trimmedName, age, language }),
    onSuccess: (child) => {
      setChild(child);
      router.replace('/(main)/chat');
    },
    onError: (err) => {
      const detail =
        (err as AxiosErrorShape).response?.data?.detail ?? 'Xatolik yuz berdi';
      Alert.alert('Xatolik', detail);
    },
  });

  const canSubmit = isValid && !mutation.isPending;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 px-6 justify-center gap-8">
          <View className="items-center">
            <DuyoAvatar size="lg" state="happy" />
          </View>

          <View className="bg-card p-6 rounded-2xl gap-6">
            <View className="gap-2">
              <Text className="text-2xl font-bold text-foreground text-center">
                Isming va yoshing
              </Text>
              <Text className="text-sm text-muted-foreground text-center">
                Men seni qanday chaqirishimni va sen necha yoshda
                ekanligingni bilmoqchiman
              </Text>
            </View>

            <View className="gap-2">
              <Text className="text-sm font-semibold text-foreground">
                Ismingiz
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Masalan: Aziza"
                placeholderTextColor="#94A3B8"
                maxLength={NAME_MAX_LENGTH}
                autoFocus
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
                accessibilityLabel="Ismingiz"
                className={`px-4 py-4 rounded-xl bg-background text-base text-foreground border-2 ${
                  nameFocused ? 'border-primary' : 'border-transparent'
                }`}
              />
            </View>

            <View className="gap-3">
              <Text className="text-sm font-semibold text-foreground">
                Yoshingiz
              </Text>
              <View className="flex-row items-center justify-center gap-6">
                <Pressable
                  onPress={() => setAge((a) => Math.max(MIN_AGE, a - 1))}
                  disabled={age <= MIN_AGE}
                  accessibilityRole="button"
                  accessibilityLabel="Yoshni kamaytirish"
                  className={`w-12 h-12 rounded-xl items-center justify-center ${
                    age <= MIN_AGE ? 'bg-muted/40' : 'bg-primary/10'
                  }`}
                >
                  <Text className="text-2xl font-bold text-foreground">−</Text>
                </Pressable>
                <View className="min-w-[96px] items-center">
                  <Text className="text-6xl font-bold text-primary">{age}</Text>
                </View>
                <Pressable
                  onPress={() => setAge((a) => Math.min(MAX_AGE, a + 1))}
                  disabled={age >= MAX_AGE}
                  accessibilityRole="button"
                  accessibilityLabel="Yoshni oshirish"
                  className={`w-12 h-12 rounded-xl items-center justify-center ${
                    age >= MAX_AGE ? 'bg-muted/40' : 'bg-primary/10'
                  }`}
                >
                  <Text className="text-2xl font-bold text-foreground">+</Text>
                </Pressable>
              </View>
              <View className="bg-accent/20 px-4 py-3 rounded-xl">
                <Text className="text-sm text-foreground text-center">
                  {ageSegmentLabel(age)}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={() => mutation.mutate()}
              disabled={!canSubmit}
              accessibilityRole="button"
              className={`h-14 rounded-xl items-center justify-center ${
                canSubmit ? 'bg-primary' : 'bg-primary/40'
              }`}
            >
              <Text className="text-base font-semibold text-primary-foreground">
                {mutation.isPending ? 'Saqlanmoqda...' : 'Boshlash'}
              </Text>
            </Pressable>
          </View>

          <Text className="text-xs text-muted-foreground text-center px-4">
            Ismingiz faqat men bilan suhbatlarda ishlatiladi va xavfsiz
            saqlanadi
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
