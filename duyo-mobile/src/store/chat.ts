import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { type ChatSource, type QuickReply } from '@/api/endpoints/chat';
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
  messages: ChatMessage[];
  hydrated: boolean;
  setActiveChild: (id: string) => void;
  setConversationId: (id: string) => void;
  appendMessage: (message: ChatMessage) => void;
  clearQuickReplies: (messageId: string) => void;
  clearConversation: () => void;
  setHydrated: (hydrated: boolean) => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      childId: null,
      conversationId: null,
      messages: [],
      hydrated: false,
      setActiveChild: (id) => {
        if (get().childId === id) return;
        set({ childId: id, conversationId: null, messages: [] });
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
      clearConversation: () =>
        set({ conversationId: null, messages: [] }),
      setHydrated: (hydrated) => set({ hydrated }),
    }),
    {
      name: 'duyo-chat',
      storage: createJSONStorage(() => asyncStorage),
      partialize: (state) => ({
        childId: state.childId,
        conversationId: state.conversationId,
        messages: state.messages,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);
