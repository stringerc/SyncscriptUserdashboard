import { useSyncExternalStore } from 'react';
import type { ChatMessage } from '../components/cortex/cortex-demo-helpers';

/**
 * Shared Cortex transcript store — single client-side source of truth for the
 * conversation across /cortex/chat and the /cortex/visualizer chat drawer.
 * Module-level so it survives SPA navigation between the two surfaces.
 */

interface CortexChatState {
  messages: ChatMessage[];
}

let state: CortexChatState = { messages: [] };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function getCortexChatSnapshot(): CortexChatState {
  return state;
}

export function subscribeCortexChat(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setCortexChatMessages(messages: ChatMessage[]) {
  state = { messages };
  emit();
}

export function appendCortexChatMessage(msg: ChatMessage) {
  state = { messages: [...state.messages, msg] };
  emit();
}

export function upsertCortexChatMessage(msg: ChatMessage) {
  const idx = state.messages.findIndex((m) => m.id === msg.id);
  if (idx === -1) {
    appendCortexChatMessage(msg);
    return;
  }
  const next = state.messages.slice();
  next[idx] = { ...next[idx], ...msg };
  state = { messages: next };
  emit();
}

export function useCortexChatMessages(): ChatMessage[] {
  return useSyncExternalStore(subscribeCortexChat, () => state.messages);
}
