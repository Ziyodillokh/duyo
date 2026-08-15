import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { listChildren } from '@/api/endpoints/children';
import { getFamilyInvite } from '@/api/endpoints/family';
import { Card } from '@/components/v2/card';
import { MascotImage } from '@/components/v2/mascot-image';
import { ScreenGradient } from '@/components/v2/screen-gradient';
import { useT } from '@/i18n';
import { useChildStore } from '@/store/child';
import { useMascotStore } from '@/store/mascot';
import { useOnboardingStore } from '@/store/onboarding';

const POLL_MS = 4000;

/**
 * The parent waits here after sending a link code. Nothing to do but poll:
 * the child claims the code and finishes their own onboarding (age,
 * interests, avatar) on their own device — this screen ends the moment
 * `listChildren` proves that happened, and takes the parent to their report.
 */
export default function FamilyWaitingScreen() {
  const t = useT();
  const setChild = useChildStore((s) => s.setChild);
  const setMascotVariant = useMascotStore((s) => s.setVariant);
  const resetOnboarding = useOnboardingStore((s) => s.reset);

  const invite = useQuery({
    queryKey: ['family-invite-status'],
    queryFn: getFamilyInvite,
    refetchInterval: POLL_MS,
  });

  const children = useQuery({
    queryKey: ['family-waiting-children'],
    queryFn: listChildren,
    refetchInterval: POLL_MS,
  });

  useEffect(() => {
    const child = children.data?.[0];
    if (!child) return;
    setChild(child);
    if (child.mascot === 'raccoon' || child.mascot === 'duyo') {
      setMascotVariant(child.mascot);
    }
    resetOnboarding();
    router.replace('/(main)/parent-dashboard');
  }, [children.data, setChild, setMascotVariant, resetOnboarding]);

  const claimed = invite.data?.claimed ?? false;

  return (
    <ScreenGradient>
      <View className="flex-1 px-6 items-center justify-center">
        <View className="w-full max-w-[345px] items-center">
          <MascotImage size={176} glow="cosmic" />

          <View className="w-full mt-6">
            <Card>
              <View className="gap-3 items-center">
                <ActivityIndicator size="large" color="#2563EB" />
                <Text className="text-[20px] leading-7 font-bold text-foreground text-center mt-2">
                  {t('onboarding.familyWaiting.title')}
                </Text>
                <Text className="text-base text-muted-foreground text-center">
                  {claimed
                    ? t('onboarding.familyWaiting.claimed', {
                        name: invite.data?.child_name ?? '',
                      })
                    : t('onboarding.familyWaiting.subtitle', {
                        name: invite.data?.child_name ?? '',
                      })}
                </Text>
              </View>
            </Card>
          </View>
        </View>
      </View>
    </ScreenGradient>
  );
}
