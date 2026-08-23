import { router } from 'expo-router';
import {
  Check,
  Clock,
  MessageSquare,
  Pencil,
  UserPlus,
  Users,
  X,
} from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import { Text } from '@/components/text';

import {
  friendRequestErrorMessage,
  type Friendship,
  type GoalMate,
} from '@/api/endpoints/social';
import { HandleEditor } from '@/components/goals/handle-editor';
import { DarkCard } from '@/components/v2/dark/dark-card';
import {
  useAcceptFriend,
  useDeclineFriend,
  useFriends,
  useGoalMates,
  useSendFriendRequest,
  useSocialSettings,
  useUpdateSocialSettings,
} from '@/hooks/use-social';

/** Avatar stand-in — peers are pseudonymous, so there is no photo to show. */
function PeerAvatar({ name }: { name: string }) {
  return (
    <View
      className="rounded-full items-center justify-center"
      style={{ width: 44, height: 44, backgroundColor: 'rgba(96,165,250,0.18)' }}
    >
      <Text className="text-base font-bold" style={{ color: '#60A5FA' }}>
        {name.slice(0, 1).toUpperCase()}
      </Text>
    </View>
  );
}

function Row({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <View className="flex-row items-center gap-3">
      <PeerAvatar name={title} />
      <View className="flex-1">
        <Text
          className="text-base font-bold text-foreground dark:text-dark-text"
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text
          className="text-sm text-muted-foreground dark:text-dark-muted"
          numberOfLines={1}
        >
          {subtitle}
        </Text>
      </View>
      {children}
    </View>
  );
}

export function GoalMatesSection({ childId }: { childId: string | undefined }) {
  const settingsQuery = useSocialSettings(childId);
  const updateSettings = useUpdateSocialSettings(childId);
  const discoverable = settingsQuery.data?.discoverable ?? false;
  const [editingHandle, setEditingHandle] = useState(false);

  const matesQuery = useGoalMates(childId, discoverable);
  const friendsQuery = useFriends(childId);
  const sendRequest = useSendFriendRequest(childId);
  const acceptRequest = useAcceptFriend(childId);
  const declineRequest = useDeclineFriend(childId);

  const friends = friendsQuery.data ?? [];
  const incoming = friends.filter((f) => f.status === 'pending' && f.incoming);
  const outgoing = friends.filter((f) => f.status === 'pending' && !f.incoming);
  const accepted = friends.filter((f) => f.status === 'accepted');
  const mates = matesQuery.data ?? [];

  const openThread = (friendship: Friendship) =>
    router.push({
      pathname: '/(main)/peer-chat',
      params: {
        friendshipId: friendship.id,
        peerName: friendship.peer.display_name,
      },
    });

  const handleConnect = (mate: GoalMate) =>
    sendRequest.mutate(mate.peer.child_id, {
      // The server distinguishes a connection cap, a pending-request cap, a
      // suspension and a stale suggestion; collapsing all four into "try
      // again later" told a child to keep retrying something that cannot
      // succeed. See friendRequestErrorMessage.
      onError: (err) => Alert.alert('Yuborilmadi', friendRequestErrorMessage(err)),
    });

  const handleStopBeingDiscoverable = () =>
    Alert.alert(
      "Ko'rinishni o'chirish",
      "Yangi maqsaddoshlar seni topa olmaydi. Hozirgi do'stlaring va suhbatlaring saqlanib qoladi.",
      [
        { text: 'Bekor qilish', style: 'cancel' },
        {
          text: "O'chirish",
          style: 'destructive',
          onPress: () => updateSettings.mutate({ discoverable: false }),
        },
      ],
    );

  return (
    <>
      <View className="flex-row items-center justify-between mt-2">
        <Text className="text-base font-bold text-foreground dark:text-dark-text">
          Maqsaddoshlar
        </Text>
        {discoverable && !!settingsQuery.data && (
          <Pressable
            onPress={() => setEditingHandle(true)}
            accessibilityRole="button"
            accessibilityLabel="Taxallusni o'zgartirish"
            hitSlop={8}
            className="flex-row items-center gap-1.5"
          >
            <Text className="text-sm font-medium" style={{ color: '#60A5FA' }}>
              {settingsQuery.data.display_name}
            </Text>
            <Pencil size={13} color="#60A5FA" />
          </Pressable>
        )}
      </View>

      <HandleEditor
        visible={editingHandle}
        childId={childId}
        current={settingsQuery.data?.display_name ?? ''}
        onClose={() => setEditingHandle(false)}
      />

      {/* Opt-in. Off by default: a child is never discoverable by accident. */}
      {!discoverable && (
        <DarkCard>
          <View className="items-center">
            <View
              className="rounded-full items-center justify-center"
              style={{
                width: 56,
                height: 56,
                backgroundColor: 'rgba(96,165,250,0.15)',
              }}
            >
              <Users size={26} color="#60A5FA" />
            </View>
            <Text className="text-base font-bold text-foreground dark:text-dark-text mt-3 text-center">
              Bir maqsaddagi bolalar bilan tanish
            </Text>
            <Text className="text-sm text-muted-foreground dark:text-dark-muted mt-1 text-center">
              Ular sening ismingni ko'rmaydi — faqat taxallusing. Xohlagan
              paytda o'chirib qo'yasan.
            </Text>
            {!!settingsQuery.data && (
              <Pressable
                onPress={() => setEditingHandle(true)}
                accessibilityRole="button"
                accessibilityLabel="Taxallusni o'zgartirish"
                className="flex-row items-center gap-2 rounded-full px-4 py-2 mt-3"
                style={{ backgroundColor: 'rgba(96,165,250,0.15)' }}
              >
                <Text className="text-sm font-bold" style={{ color: '#60A5FA' }}>
                  {settingsQuery.data.display_name}
                </Text>
                <Pencil size={14} color="#60A5FA" />
              </Pressable>
            )}
            <Pressable
              onPress={() => updateSettings.mutate({ discoverable: true })}
              disabled={updateSettings.isPending}
              accessibilityRole="button"
              accessibilityLabel="Maqsaddoshlarni yoqish"
              className="bg-neon-blue rounded-md items-center justify-center mt-4 px-6"
              style={{ height: 44 }}
            >
              {updateSettings.isPending ? (
                <ActivityIndicator color="#0A1628" />
              ) : (
                <Text className="text-sm font-bold" style={{ color: '#0A1628' }}>
                  Yoqish
                </Text>
              )}
            </Pressable>
          </View>
        </DarkCard>
      )}

      {/* Incoming requests first — this is the one thing needing a decision. */}
      {incoming.map((f) => (
        <DarkCard key={f.id} glow="pink">
          <Row
            title={f.peer.display_name}
            subtitle="Sen bilan do'stlashmoqchi"
          >
            <View className="flex-row gap-2">
              <Pressable
                onPress={() => acceptRequest.mutate(f.id)}
                accessibilityRole="button"
                accessibilityLabel="Qabul qilish"
                className="rounded-md items-center justify-center bg-neon-blue"
                style={{ width: 40, height: 40 }}
              >
                <Check size={20} color="#0A1628" />
              </Pressable>
              <Pressable
                onPress={() => declineRequest.mutate(f.id)}
                accessibilityRole="button"
                accessibilityLabel="Rad etish"
                className="rounded-md items-center justify-center"
                style={{
                  width: 40,
                  height: 40,
                  backgroundColor: 'rgba(148,163,184,0.15)',
                }}
              >
                <X size={20} color="#94A3B8" />
              </Pressable>
            </View>
          </Row>
        </DarkCard>
      ))}

      {/* Friends */}
      {accepted.map((f) => (
        <DarkCard key={f.id}>
          <Row title={f.peer.display_name} subtitle="Do'stingiz">
            <Pressable
              onPress={() => openThread(f)}
              accessibilityRole="button"
              accessibilityLabel={`${f.peer.display_name} bilan suhbat`}
              className="rounded-md items-center justify-center bg-neon-blue flex-row gap-2 px-4"
              style={{ height: 40 }}
            >
              <MessageSquare size={16} color="#0A1628" />
              <Text className="text-sm font-bold" style={{ color: '#0A1628' }}>
                Yozish
              </Text>
            </Pressable>
          </Row>
        </DarkCard>
      ))}

      {/* Requests this child has SENT and is waiting on.
          Without this the child taps "Do'stlashish", the suggestion card
          vanishes — the backend drops anyone with an edge from the
          suggestions — and nothing anywhere says a request went out. The
          "Yuborildi" pill on the suggestion card could never be reached for
          the same reason. */}
      {outgoing.map((f) => (
        <DarkCard key={f.id}>
          <Row title={f.peer.display_name} subtitle="Javobini kutyapmiz">
            <View
              className="rounded-md items-center justify-center flex-row gap-2 px-4"
              style={{ height: 40, backgroundColor: 'rgba(148,163,184,0.15)' }}
            >
              <Clock size={15} color="#94A3B8" />
              <Text className="text-sm font-medium" style={{ color: '#94A3B8' }}>
                Yuborildi
              </Text>
            </View>
          </Row>
        </DarkCard>
      ))}

      {/* Suggestions */}
      {discoverable && matesQuery.isLoading && (
        <View className="items-center" style={{ padding: 20 }}>
          <ActivityIndicator color="#60A5FA" />
        </View>
      )}

      {discoverable &&
        mates.map((mate) => {
          const pending = outgoing.some(
            (f) => f.peer.child_id === mate.peer.child_id,
          );
          return (
            <DarkCard key={mate.peer.child_id}>
              <Row
                title={mate.peer.display_name}
                subtitle={`Umumiy maqsad: ${mate.shared_goal}`}
              >
                <Pressable
                  onPress={() => handleConnect(mate)}
                  disabled={pending || sendRequest.isPending}
                  accessibilityRole="button"
                  accessibilityLabel="Do'stlashish"
                  className="rounded-md items-center justify-center flex-row gap-2 px-4"
                  style={{
                    height: 40,
                    backgroundColor: pending
                      ? 'rgba(148,163,184,0.15)'
                      : 'rgba(96,165,250,0.18)',
                  }}
                >
                  {!pending && <UserPlus size={16} color="#60A5FA" />}
                  <Text
                    className="text-sm font-medium"
                    style={{ color: pending ? '#94A3B8' : '#60A5FA' }}
                  >
                    {pending ? 'Yuborildi' : "Do'stlashish"}
                  </Text>
                </Pressable>
              </Row>
            </DarkCard>
          );
        })}

      {discoverable &&
        !matesQuery.isLoading &&
        mates.length === 0 &&
        !accepted.length &&
        !outgoing.length &&
        !incoming.length && (
          <DarkCard className="items-center">
            <Text className="text-4xl">🔍</Text>
            <Text className="text-base font-bold text-foreground dark:text-dark-text mt-2 text-center">
              Hozircha maqsaddosh topilmadi
            </Text>
            <Text className="text-sm text-muted-foreground dark:text-dark-muted mt-1 text-center">
              Maqsad qo'shsang, xuddi shu maqsaddagi tengdoshlaring bu yerda
              paydo bo'ladi
            </Text>
          </DarkCard>
        )}

      {/* The opt-in card promises "Xohlagan paytda o'chirib qo'yasan", and
          that card disappears the moment the child opts in — so until now the
          app made a promise it gave no way to keep. */}
      {discoverable && (
        <Pressable
          onPress={handleStopBeingDiscoverable}
          disabled={updateSettings.isPending}
          accessibilityRole="button"
          accessibilityLabel="Maqsaddoshlarga ko'rinishni o'chirish"
          className="items-center py-3"
        >
          <Text className="text-sm text-muted-foreground dark:text-dark-muted">
            Maqsaddoshlarga ko'rinishni o'chirish
          </Text>
        </Pressable>
      )}
    </>
  );
}
