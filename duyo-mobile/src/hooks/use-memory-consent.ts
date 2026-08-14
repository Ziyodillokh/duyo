import { useCallback } from 'react';

import { type MemoryCandidate } from '@/api/endpoints/chat';
import { screenMemoryContent } from '@/lib/memory-guard';
import { useChildStore } from '@/store/child';
import { useMemoryConsentStore } from '@/store/memory-consent';

/**
 * Raise the "Buni eslab qolaymi?" offer.
 *
 * Both surfaces call this — a child who says "men shaxmatni yaxshi ko'raman"
 * out loud gets exactly the same prompt as one who types it. The sheet itself
 * is mounted once in the (main) layout (components/memory/memory-consent-sheet
 * .tsx), so the two can never drift apart in look or behaviour.
 *
 * Nothing here can break the surface that calls it: every step is guarded,
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
      try {
        if (screenMemoryContent(candidate.content).verdict !== 'safe') return;
      } catch (err) {
        console.warn('memory guard failed; not offering to remember', err);
        return;
      }

      useMemoryConsentStore.getState().ask(candidate);
    },
    [child],
  );
}
