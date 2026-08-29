import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { type ChatSource, type QuickReply } from '@/api/endpoints/chat';
import { listConversationMessages } from '@/api/endpoints/conversations';
import { type CrisisLevel } from '@/api/types';
import { asyncStorage } from '@/lib/async-storage';

export interface ChatMessage {
  id: string;
  role: 'child' | 'assistant';
  content: string;
  timestamp: number;
  crisisLevel?: CrisisLevel;
  source?: ChatSource | null;
  quickReplies?: QuickReply[];
}

interface ChatState {
  // Active child this conversation belongs to. When the active child
  // changes (rare in Bosqich B beta) the conversation is reset.
  childId: string | null;
  conversationId: string | null;
  /** Project a NEW conversation should be filed into, if started from one. */
  projectId: string | null;
  messages: ChatMessage[];
  /** True while a conversation opened from the history list is loading. */
  loadingHistory: boolean;
  /**
   * A spoken turn was saved on the server that this device has not read back.
   *
   * The voice screen talks to the same conversation and the server writes both
   * sides of it as messages (api/v1/voice.py) — but it writes them THERE, and
   * this store is a local copy. Without a nudge, a child could talk for five
   * minutes, return to the chat, and find none of it: the words exist, the
   * device just never asked again.
   */
  voiceDirty: boolean;
  hydrated: boolean;
  setActiveChild: (id: string) => void;
  setConversationId: (id: string) => void;
  appendMessage: (message: ChatMessage) => void;
  clearQuickReplies: (messageId: string) => void;
  /** Begin a fresh chat, optionally inside a project. */
  startNewConversation: (projectId?: string | null) => void;
  /** Resume a conversation from the history list. */
  openConversation: (conversationId: string) => void;
  /** A spoken turn landed on the server; the chat should re-read on focus. */
  markVoiceTurn: () => void;
  /** Fetch the opened conversation's messages from the server. */
  loadConversation: (childId: string, conversationId: string) => Promise<void>;
  setHydrated: (hydrated: boolean) => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      childId: null,
      conversationId: null,
      projectId: null,
      messages: [],
      loadingHistory: false,
      voiceDirty: false,
      hydrated: false,
      setActiveChild: (id) => {
        if (get().childId === id) return;
        set({ childId: id, conversationId: null, projectId: null, messages: [] });
      },
      setConversationId: (id) => set({ conversationId: id }),
      appendMessage: (message) =>
        set((state) => ({ messages: [...state.messages, message] })),
      clearQuickReplies: (messageId) =>
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === messageId ? { ...m, quickReplies: [] } : m,
          ),
        })),
      startNewConversation: (projectId = null) =>
        set({ conversationId: null, projectId, messages: [] }),

      // Two steps on purpose: this clears the screen synchronously so the
      // previous conversation is never briefly visible under the new title,
      // and the chat screen then calls loadConversation to fill it.
      markVoiceTurn: () => set({ voiceDirty: true }),
      openConversation: (conversationId) =>
        set({
          conversationId,
          projectId: null,
          messages: [],
          loadingHistory: true,
        }),

      loadConversation: async (childId, conversationId) => {
        set({ loadingHistory: true });
        try {
          const rows = await listConversationMessages(childId, conversationId);
          // Ignore a slow load whose conversation is no longer the open one —
          // a child who taps two rows quickly must not end up with the first
          // one's messages under the second one's title.
          if (get().conversationId !== conversationId) return;
          set({
            voiceDirty: false,
            messages: rows.map((m) => ({
              id: m.id,
              role: m.role === 'child' ? 'child' : 'assistant',
              content: m.content,
              timestamp: new Date(m.created_at).getTime(),
            })),
          });
        } finally {
          if (get().conversationId === conversationId) {
            set({ loadingHistory: false });
          }
        }
      },

      setHydrated: (hydrated) => set({ hydrated }),
    }),
    {
      name: 'duyo-chat',
      storage: createJSONStorage(() => asyncStorage),
      partialize: (state) => ({
        childId: state.childId,
        conversationId: state.conversationId,
        projectId: state.projectId,
        messages: state.messages,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);
