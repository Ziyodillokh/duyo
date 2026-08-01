import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Flag, Send, ShieldAlert } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { PeerMessage } from '@/api/endpoints/social';
import {
  useBlockFriend,
  usePeerMessages,
  useReportFriend,
  useSendPeerMessage,
} from '@/hooks/use-social';
import { useChildStore } from '@/store/child';
import { useIsDark } from '@/store/theme';

const MAX_LEN = 500;

function Bubble({ message }: { message: PeerMessage }) {
  const mine = message.mine;
  return (
    <View
      className={`max-w-[80%] rounded-xl px-4 py-3 ${
        mine ? 'self-end' : 'self-start'
      }`}
      style={{
        backgroundColor: mine ? '#60A5FA' : 'rgba(148,163,184,0.18)',
      }}
    >
      <Text
        className="text-base"
        style={{ color: mine ? '#0A1628' : undefined }}
        // Peer text is untrusted; selectable so a child can copy it into a
        // report conversation with an adult if they need to.
        selectable
      >
        {message.body}
      </Text>
    </View>
  );
}

export default function PeerChatScreen() {
  const isDark = useIsDark();
  const params = useLocalSearchParams<{
    friendshipId: string;
    peerName: string;
  }>();
  const friendshipId = params.friendshipId;
  const peerName = params.peerName ?? 'Do‘st';

  const child = useChildStore((s) => s.child);
  const childId = child?.id;

  const messagesQuery = usePeerMessages(childId, friendshipId);
  const sendMutation = useSendPeerMessage(childId, friendshipId);
  const blockMutation = useBlockFriend(childId);
  const reportMutation = useReportFriend(childId);

  const [draft, setDraft] = useState('');
  const [refusal, setRefusal] = useState<string | null>(null);

  // Newest last; the list is inverted so it opens at the newest message.
  const data = useMemo(
    () => [...(messagesQuery.data ?? [])].reverse(),
    [messagesQuery.data],
  );

  const canSend = draft.trim().length > 0 && !sendMutation.isPending;

  const handleSend = () => {
    const body = draft.trim();
    if (!body) return;
    setRefusal(null);
    sendMutation.mutate(body, {
      onSuccess: (result) => {
        if (result.rejected) {
          // An expected outcome, not a crash: explain it in place.
          setRefusal(result.rejected);
          return;
        }
        setDraft('');
      },
      onError: () =>
        Alert.alert('Yuborilmadi', "Internetni tekshirib, qayta urinib ko'ring."),
    });
  };

  const confirmReport = () =>
    Alert.alert(
      'Shikoyat qilish',
      "Bu suhbat to'xtatiladi va tekshiruvga yuboriladi. Davom etaylikmi?",
      [
        { text: 'Bekor qilish', style: 'cancel' },
        {
          text: 'Shikoyat qilish',
          style: 'destructive',
          onPress: () =>
            reportMutation.mutate(
              { friendshipId },
              { onSuccess: () => router.back() },
            ),
        },
      ],
    );

  const confirmBlock = () =>
    Alert.alert('Bloklash', `${peerName} bloklansinmi?`, [
      { text: 'Bekor qilish', style: 'cancel' },
      {
        text: 'Bloklash',
        style: 'destructive',
        onPress: () =>
          blockMutation.mutate(friendshipId, { onSuccess: () => router.back() }),
      },
    ]);

  return (
    <View style={StyleSheet.absoluteFill}>
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: isDark ? '#0A1628' : '#F4F8FF' },
        ]}
      />
      <LinearGradient
        colors={['rgba(96, 165, 250, 0.20)', 'rgba(252, 211, 77, 0.20)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.96, y: 0.2 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View className="h-16 px-4 flex-row items-center justify-between">
          <View className="flex-row items-center gap-2 flex-1">
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Orqaga"
              hitSlop={10}
              className="p-1"
            >
              <ArrowLeft size={24} color={isDark ? '#E0E7FF' : '#102033'} />
            </Pressable>
            <Text
              className="text-lg font-bold text-foreground dark:text-dark-text"
              numberOfLines={1}
            >
              {peerName}
            </Text>
          </View>
          {/* Block and report are always visible and never buried in a menu. */}
          <View className="flex-row gap-1">
            <Pressable
              onPress={confirmBlock}
              accessibilityRole="button"
              accessibilityLabel="Bloklash"
              hitSlop={8}
              className="p-2"
            >
              <ShieldAlert size={20} color="#94A3B8" />
            </Pressable>
            <Pressable
              onPress={confirmReport}
              accessibilityRole="button"
              accessibilityLabel="Shikoyat qilish"
              hitSlop={8}
              className="p-2"
            >
              <Flag size={20} color="#94A3B8" />
            </Pressable>
          </View>
        </View>

        {/* Never dismissible — the rule has to be present, not read once. */}
        <View
          className="mx-4 mb-2 rounded-md px-3 py-2"
          style={{ backgroundColor: 'rgba(251,146,60,0.15)' }}
        >
          <Text className="text-xs" style={{ color: '#FB923C' }}>
            Xavfsizlik uchun xabarlar tekshiriladi. Telefon raqam, manzil yoki
            maktabingni yozma.
          </Text>
        </View>

        <KeyboardAvoidingView
          behavior="translate-with-padding"
          className="flex-1"
        >
          {messagesQuery.isLoading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator color="#60A5FA" />
            </View>
          ) : (
            <FlatList
              data={data}
              inverted
              keyExtractor={(m) => m.id}
              contentContainerStyle={{ padding: 16, gap: 10 }}
              renderItem={({ item }) => <Bubble message={item} />}
              ListEmptyComponent={
                <View className="items-center" style={{ paddingTop: 40 }}>
                  <Text className="text-4xl">👋</Text>
                  <Text className="text-base font-bold text-foreground dark:text-dark-text mt-2">
                    Suhbatni boshlang
                  </Text>
                  <Text className="text-sm text-muted-foreground dark:text-dark-muted mt-1 text-center px-6">
                    Sizni bir maqsad birlashtirdi — shu haqda gaplashsangiz
                    bo'ladi
                  </Text>
                </View>
              }
            />
          )}

          {refusal && (
            <View
              className="mx-4 mb-2 rounded-md px-3 py-2"
              style={{ backgroundColor: 'rgba(239,68,68,0.15)' }}
            >
              <Text className="text-xs" style={{ color: '#F87171' }}>
                {refusal}
              </Text>
            </View>
          )}

          <View
            className="flex-row items-end gap-2 px-3 py-3 border-t"
            style={{ borderColor: 'rgba(148,163,184,0.2)' }}
          >
            <TextInput
              value={draft}
              onChangeText={(t) => setDraft(t.slice(0, MAX_LEN))}
              placeholder="Xabar yozing..."
              placeholderTextColor="#94A3B8"
              multiline
              maxLength={MAX_LEN}
              accessibilityLabel="Xabar"
              className="flex-1 max-h-28 px-4 py-3 rounded-md text-base text-foreground dark:text-dark-text"
              style={{ backgroundColor: isDark ? '#1E3A5F' : '#FFFFFF' }}
            />
            <Pressable
              onPress={handleSend}
              disabled={!canSend}
              accessibilityRole="button"
              accessibilityLabel="Yuborish"
              className="rounded-md items-center justify-center"
              style={{
                width: 44,
                height: 44,
                backgroundColor: canSend ? '#60A5FA' : 'rgba(148,163,184,0.2)',
              }}
            >
              {sendMutation.isPending ? (
                <ActivityIndicator color="#0A1628" />
              ) : (
                <Send size={20} color={canSend ? '#0A1628' : '#94A3B8'} />
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
