import { create } from 'zustand';

import { type MemoryCandidate } from '@/api/endpoints/chat';

/**
 * The one pending "shall I remember this?" offer.
 *
 * A store rather than local screen state because the offer is raised from two
 * places (text chat and voice) and answered by one piece of UI mounted once,
 * in the (main) layout. Screens that raise it never own the sheet, so the two
 * surfaces cannot drift apart in look or behaviour.
 *
 * Deliberately holds ONE candidate, not a queue: a child who has just been
 * asked and has not answered should not have a second question stack up
 * behind the first. A later candidate simply replaces an unanswered one.
 */
interface MemoryConsentState {
  pending: MemoryCandidate | null;
  ask: (candidate: MemoryCandidate) => void;
  dismiss: () => void;
}

export const useMemoryConsentStore = create<MemoryConsentState>()((set) => ({
  pending: null,
  ask: (candidate) => set({ pending: candidate }),
  dismiss: () => set({ pending: null }),
}));
