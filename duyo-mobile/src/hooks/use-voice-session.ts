import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuthStore } from '@/store/auth';

// Mirrors duyo-backend/src/duyo/api/v1/voice.py protocol.

const DEFAULT_VOICE_WS_URL = 'wss://api-staging.duyo.uz/v1/chat/voice';
const END_TURN_FRAME = 'END_TURN';

export type VoiceSessionState =
  | 'idle'
  | 'connecting'
  | 'open'
  | 'closed'
  | 'error';

export interface TurnCompleteInfo {
  conversationId: string;
  childMessageId: string;
  assistantMessageId: string;
}

export interface VoiceSessionHandlers {
  onReady?: (conversationId: string) => void;
  onInputTranscript?: (text: string) => void;
  onOutputTranscript?: (text: string) => void;
  onAudioChunk?: (pcm: ArrayBuffer) => void;
  onCrisis?: (level: 'orange' | 'red') => void;
  onTurnComplete?: (info: TurnCompleteInfo) => void;
  onError?: (message: string) => void;
  onClose?: (code: number) => void;
}

interface ConnectArgs {
  childId: string;
  conversationId?: string | null;
}

export interface UseVoiceSessionResult {
  state: VoiceSessionState;
  connect: (args: ConnectArgs) => void;
  sendAudio: (pcm: ArrayBuffer) => void;
  endTurn: () => void;
  close: () => void;
}

interface ServerEnvelope {
  type: string;
  [key: string]: unknown;
}

export function useVoiceSession(
  handlers?: VoiceSessionHandlers,
): UseVoiceSessionResult {
  const [state, setState] = useState<VoiceSessionState>('idle');
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const close = useCallback(() => {
    const ws = wsRef.current;
    if (
      ws &&
      (ws.readyState === WebSocket.OPEN ||
        ws.readyState === WebSocket.CONNECTING)
    ) {
      ws.close();
    }
    wsRef.current = null;
  }, []);

  // Close on unmount — never leak a socket.
  useEffect(() => close, [close]);

  const connect = useCallback(({ childId, conversationId }: ConnectArgs) => {
    const token = useAuthStore.getState().tokens?.accessToken;
    if (!token) {
      setState('error');
      handlersRef.current?.onError?.('No auth token');
      return;
    }

    // Replace any in-flight session.
    const existing = wsRef.current;
    if (existing) existing.close();

    const url = buildUrl(childId, conversationId, token);
    const ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;
    setState('connecting');

    ws.onopen = () => setState('open');

    ws.onmessage = (event: WebSocketMessageEvent) => {
      if (event.data instanceof ArrayBuffer) {
        handlersRef.current?.onAudioChunk?.(event.data);
        return;
      }
      if (typeof event.data === 'string') {
        try {
          handleJson(JSON.parse(event.data), handlersRef.current);
        } catch {
          // Swallow malformed JSON — log only for development debugging.
        }
      }
    };

    ws.onerror = () => {
      setState('error');
      handlersRef.current?.onError?.('socket error');
    };

    ws.onclose = (event: WebSocketCloseEvent) => {
      if (wsRef.current === ws) wsRef.current = null;
      setState('closed');
      handlersRef.current?.onClose?.(event.code ?? 0);
    };
  }, []);

  const sendAudio = useCallback((pcm: ArrayBuffer) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(pcm);
    }
  }, []);

  const endTurn = useCallback(() => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(END_TURN_FRAME);
    }
  }, []);

  return { state, connect, sendAudio, endTurn, close };
}

function buildUrl(
  childId: string,
  conversationId: string | null | undefined,
  token: string,
): string {
  const base = process.env.EXPO_PUBLIC_WS_BASE_URL ?? DEFAULT_VOICE_WS_URL;
  const params = new URLSearchParams({ token, child_id: childId });
  if (conversationId) params.set('conversation_id', conversationId);
  return `${base}?${params.toString()}`;
}

function normalizeCrisisLevel(raw: unknown): 'orange' | 'red' | null {
  const level = typeof raw === 'string' ? raw.toLowerCase() : '';
  return level === 'orange' || level === 'red' ? level : null;
}

function handleJson(
  msg: ServerEnvelope,
  handlers: VoiceSessionHandlers | undefined,
): void {
  if (!handlers) return;
  switch (msg.type) {
    case 'ready':
      if (typeof msg.conversation_id === 'string') {
        handlers.onReady?.(msg.conversation_id);
      }
      break;
    case 'input_transcript':
      if (typeof msg.text === 'string') {
        handlers.onInputTranscript?.(msg.text);
      }
      break;
    case 'output_transcript':
      if (typeof msg.text === 'string') {
        handlers.onOutputTranscript?.(msg.text);
      }
      break;
    case 'crisis': {
      const level = normalizeCrisisLevel(msg.level);
      if (level) handlers.onCrisis?.(level);
      break;
    }
    case 'turn_complete':
      if (
        typeof msg.conversation_id === 'string' &&
        typeof msg.child_message_id === 'string' &&
        typeof msg.assistant_message_id === 'string'
      ) {
        handlers.onTurnComplete?.({
          conversationId: msg.conversation_id,
          childMessageId: msg.child_message_id,
          assistantMessageId: msg.assistant_message_id,
        });
      }
      break;
    case 'error':
      if (typeof msg.message === 'string') {
        handlers.onError?.(msg.message);
      }
      break;
  }
}
