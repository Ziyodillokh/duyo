import { useCallback } from 'react';
import { Alert } from 'react-native';

import { type MemoryCandidate } from '@/api/endpoints/chat';
import { MEMORY_CATEGORY_LABELS } from '@/lib/memory-categories';
import { screenMemoryContent } from '@/lib/memory-guard';
import { useChildStore } from '@/store/child';
import { MemoryGuardError, useMemoryStore } from '@/store/memory';

/**
 * "Buni eslab qolaymi?" — the one consent flow, shared by text chat and voice.
 *
 * Both surfaces must behave identically: a child who says "men shaxmatni
 * yaxshi ko'raman" out loud should get exactly the same prompt, guard and
 * storage as a child who typed it. Keeping this in one hook is what makes
 * that true by construction rather than by two screens being kept in sync —
 * an earlier revision had the logic inline in the chat screen only, and
 * voice silently remembered nothing at all.
 *
 * Nothing here can break the surface that calls it: every step is wrapped,
 * because a memory prompt failing must never take down a conversation.
 */
export function useMemoryConsent() {
  const child = useChildStore((s) => s.child);

  return useCallback(
    (candidate: MemoryCandidate | null | undefined) => {
      if (!candidate || !child) return;

      // The device Guard is authoritative, whatever the server suggested —
      // see memory-guard.ts. A sensitive candidate is dropped silently: the
      // child asked DUYO a question, not for a lecture about privacy.
      let guard;
      try {
        guard = screenMemoryContent(candidate.content);
      } catch (err) {
        console.warn('memory guard failed; not offering to remember', err);
        return;
      }
      if (guard.verdict !== 'safe') return;

      const label = MEMORY_CATEGORY_LABELS[candidate.category] ?? candidate.category;

      Alert.alert(
        'Buni eslab qolaymi?',
        `"${candidate.content}"\n\nKategoriya: ${label}`,
        [
          { text: "Yo'q", style: 'cancel' },
          {
            text: 'Ha, eslab qol',
            onPress: () => {
              useMemoryStore
                .getState()
                .addMemory(candidate.category, candidate.content, 'chat_confirmed')
                .catch((err) => {
                  // A guard rejection here means the store disagreed with the
                  // pre-check above — that is a successful block, not a
                  // failure worth alarming the child about.
                  if (err instanceof MemoryGuardError) return;
                  Alert.alert(
                    'Xatolik',
                    "Eslab qololmadim. Keyinroq \"Mening Xotiram\" bo'limidan qo'lda qo'shib ko'ring.",
                  );
                });
            },
          },
        ],
      );
    },
    [child],
  );
}
