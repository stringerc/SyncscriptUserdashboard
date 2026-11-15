import { useSyncExternalStore } from 'react';
import type { ChatMessage } from '../components/cortex/cortex-demo-helpers';

/**
 * Shared Cortex transcript store — single client-side source of truth for the
 * conversation across /cortex/chat and the /cortex/visualizer chat drawer.
 * Module-level so it survives SPA navigation between the two surfaces.
 *
 * Persistence tiers:
 *  Tier 1 — localStorage (`cortex_chat_store_v1`): synchronous hydrate at
 *           module load + debounced write on every change. Survives proxy /
 *           dev-server restarts and full reloads instantly.
 *  Tier 2 — server disk (`/api/cortex/chat-history`): merged by id on drawer
 *           mount for cross-device / cleared-storage recovery.
 */

const LS_KEY = 'cortex_chat_store_v1';
const LS_MAX = 200;

interface CortexChatState {
  messages: ChatMessage[];
}

function loadPersisted(): ChatMessage[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((m: any) => m && typeof m === 'object' && (m.role === 'user' || m.role === 'ai' || m.role === 'cortex' || m.role === 'system' || m.role === 'tool') && typeof m.content === 'string')
      .slice(-LS_MAX)
      .map((m: any) => ({ ...m, streaming: false }));
  } catch {
    return [];
  }
}

let state: CortexChatState = { messages: loadPersisted() };
const listeners = new Set<() => void>();

let persistTimer: ReturnType<typeof setTimeout> | null = null;
function persist() {
  if (typeof localStorage === 'undefined') return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    try {
      const clean = state.messages
        .filter((m) => m.content || m.role === 'tool')
        .slice(-LS_MAX)
        .map((m) => (m.streaming ? { ...m, streaming: false } : m));
      localStorage.setItem(LS_KEY, JSON.stringify(clean));
    } catch { /* quota / privacy mode — non-fatal */ }
  }, 400);
}

function emit() {
  listeners.forEach((l) => l());
  persist();
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
