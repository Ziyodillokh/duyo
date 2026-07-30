import * as Application from 'expo-application';
import { useEffect, useState } from 'react';
import { Linking, Modal, Platform, Pressable, Text, View } from 'react-native';

import { Card } from '@/components/v2/card';
import { PrimaryButton } from '@/components/v2/primary-button';

// Statik fayl — build-apk.yml har APK chiqarganda yangilab turadi.
const VERSION_URL = 'https://admin.duyo.uz/apk/version.json';
const FETCH_TIMEOUT_MS = 8000;

interface AndroidVersionInfo {
  versionCode: number;
  version: string;
  url: string;
  notes?: string;
}

function parseVersionInfo(data: unknown): AndroidVersionInfo | null {
  if (typeof data !== 'object' || data === null) return null;
  const android = (data as { android?: unknown }).android;
  if (typeof android !== 'object' || android === null) return null;
  const info = android as Partial<AndroidVersionInfo>;
  if (
    typeof info.versionCode !== 'number' ||
    typeof info.version !== 'string' ||
    typeof info.url !== 'string' ||
    !info.url.startsWith('https://')
  ) {
    return null;
  }
  return info as AndroidVersionInfo;
}

/**
 * Ilova ochilganda serverdagi oxirgi APK versiyasini tekshiradi; o'rnatilgan
 * versiyadan yangi bo'lsa, yangilash oynasini ko'rsatadi. Internet bo'lmasa
 * yoki server javob bermasa — jim o'tib ketadi (ilova ishlashiga ta'sir yo'q).
 */
export function UpdatePrompt() {
  const [info, setInfo] = useState<AndroidVersionInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const installed = Number(Application.nativeBuildVersion);
    if (!Number.isFinite(installed)) return;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    fetch(VERSION_URL, {
      signal: controller.signal,
      headers: { 'Cache-Control': 'no-cache' },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const latest = parseVersionInfo(data);
        if (latest && latest.versionCode > installed) setInfo(latest);
      })
      .catch(() => {
        // Offlayn yoki server vaqtincha ishlamayapti — indamay o'tamiz.
      })
      .finally(() => clearTimeout(timer));

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, []);

  if (!info || dismissed) return null;

  return (
    <Modal
      transparent
      animationType="fade"
      onRequestClose={() => setDismissed(true)}
    >
      <View className="flex-1 bg-black/60 justify-center px-6">
        <View className="w-full max-w-[345px] self-center">
          <Card>
            <View className="gap-2 items-center">
              <Text className="text-[24px] leading-8 font-bold text-foreground text-center">
                Yangi versiya chiqdi! 🎉
              </Text>
              <Text className="text-base text-muted-foreground text-center">
                DUYO {info.version} tayyor. Yangilab olsangiz, eng so'nggi
                imkoniyatlar va tuzatishlar qo'shiladi.
              </Text>
              {info.notes ? (
                <Text className="text-sm text-muted-foreground text-center mt-1">
                  {info.notes}
                </Text>
              ) : null}
            </View>

            <View className="mt-6">
              <PrimaryButton
                onPress={() => Linking.openURL(info.url)}
                accessibilityLabel="Yangilash"
              >
                Yangilash
              </PrimaryButton>
            </View>

            <Pressable
              onPress={() => setDismissed(true)}
              accessibilityRole="button"
              accessibilityLabel="Keyinroq"
              className="items-center mt-4"
            >
              <Text className="text-sm text-muted-foreground">Keyinroq</Text>
            </Pressable>
          </Card>
        </View>
      </View>
    </Modal>
  );
}
