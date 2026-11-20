import { useSyncExternalStore } from 'react';
import type { ChatMessage } from '../components/cortex/cortex-demo-helpers';

/**
 * Shared Cortex transcript store — single client-side source of truth for the
 * conversation across /cortex/chat and the /cortex/visualizer chat drawer.
 * Module-level so it survives SPA navigation between the two surfaces.
 *
 * Cross-tab sync: every mutation persists an envelope
 * `{ v: 1, epoch, messages }` to localStorage. Other tabs receive the
 * `storage` event, union-merge by message id, and re-emit — so all open
 * tabs converge on one live conversation within ~400ms (persist debounce).
 *
 * Epoch semantics: `epoch` increments whenever a write removes ids that
 * were previously present (clear / history edit). A remote epoch newer
 * than local means "authoritative replace" — deletions propagate instead
 * of being resurrected by union-merge.
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
  epoch: number;
}

interface PersistedEnvelope {
  v: 1;
  epoch: number;
  messages: ChatMessage[];
}

function isChatMessage(m: any): m is ChatMessage {
  return !!m && typeof m === 'object' && typeof m.content === 'string'
    && (m.role === 'user' || m.role === 'ai' || m.role === 'cortex' || m.role === 'system' || m.role === 'tool');
}

function cleanMessages(list: any[]): ChatMessage[] {
  return list
    .filter(isChatMessage)
    .slice(-LS_MAX)
    .map((m) => ({ ...m, streaming: false }));
}

function parsePersisted(raw: string | null): { epoch: number; messages: ChatMessage[] } {
  if (!raw) return { epoch: 0, messages: [] };
  try {
    const parsed = JSON.parse(raw);
    // Current envelope
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Array.isArray(parsed.messages)) {
      return { epoch: typeof parsed.epoch === 'number' ? parsed.epoch : 0, messages: cleanMessages(parsed.messages) };
    }
    // Legacy bare-array format
    if (Array.isArray(parsed)) {
      return { epoch: 0, messages: cleanMessages(parsed) };
    }
  } catch { /* corrupt — treat as empty */ }
  return { epoch: 0, messages: [] };
}

function loadPersisted(): { epoch: number; messages: ChatMessage[] } {
  if (typeof localStorage === 'undefined') return { epoch: 0, messages: [] };
  return parsePersisted(localStorage.getItem(LS_KEY));
}

const initial = loadPersisted();
let state: CortexChatState = { messages: initial.messages, epoch: initial.epoch };
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
      const envelope: PersistedEnvelope = { v: 1, epoch: state.epoch, messages: clean };
      const serialized = JSON.stringify(envelope);
      // Skip no-op writes — prevents storage-event ping-pong between tabs.
      if (localStorage.getItem(LS_KEY) === serialized) return;
      localStorage.setItem(LS_KEY, serialized);
    } catch { /* quota / privacy mode — non-fatal */ }
  }, 400);
}

function emit() {
  listeners.forEach((l) => l());
  persist();
}

function messageKey(m: ChatMessage): string {
  return m.id || `${m.role}:${m.timestamp}:${m.content.slice(0, 40)}`;
}

/**
 * Union-merge two message lists by id. On conflict the richer message wins
 * (longer content — in-flight streaming outgrows stale snapshots; then
 * newer timestamp). Result sorted by timestamp ascending.
 */
export function mergeChatMessages(base: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const map = new Map<string, ChatMessage>();
  for (const m of base) map.set(messageKey(m), m);
  for (const m of incoming) {
    const k = messageKey(m);
    const prev = map.get(k);
    if (!prev) { map.set(k, m); continue; }
    const prevScore = (prev.content?.length ?? 0) * 2 + (prev.timestamp ?? 0) / 1e15;
    const nextScore = (m.content?.length ?? 0) * 2 + (m.timestamp ?? 0) / 1e15;
    if (nextScore > prevScore) map.set(k, m);
  }
  return [...map.values()].sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
}

function idsOf(list: ChatMessage[]): Set<string> {
  return new Set(list.map(messageKey));
}

export function getCortexChatSnapshot(): CortexChatState {
  return state;
}

export function subscribeCortexChat(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setCortexChatMessages(messages: ChatMessage[]) {
  // Epoch bump when ids disappear — propagates clears/edits to other tabs
  // instead of letting union-merge resurrect them.
  const prevIds = idsOf(state.messages);
  const nextIds = idsOf(messages);
  const removed = [...prevIds].some((id) => !nextIds.has(id));
  state = {
    messages,
    epoch: removed ? state.epoch + 1 : state.epoch,
  };
  emit();
}

export function appendCortexChatMessage(msg: ChatMessage) {
  state = { messages: [...state.messages, msg], epoch: state.epoch };
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
  state = { messages: next, epoch: state.epoch };
  emit();
}

// ── Cross-tab sync ─────────────────────────────────────────────────

function onStorageEvent(e: StorageEvent) {
  if (e.key !== LS_KEY || e.newValue == null) return;
  const remote = parsePersisted(e.newValue);
  if (remote.epoch > state.epoch) {
    // Authoritative replace — a clear/edit happened elsewhere.
    state = { messages: remote.messages, epoch: remote.epoch };
    emit();
    return;
  }
  const merged = mergeChatMessages(state.messages, remote.messages).slice(-LS_MAX);
  const sameMessage = (a?: ChatMessage, b?: ChatMessage) =>
    !!a && !!b && a.id === b.id && a.content === b.content
    && a.timestamp === b.timestamp && a.role === b.role && !!a.streaming === !!b.streaming;
  const changed = merged.length !== state.messages.length
    || merged.some((m, i) => !sameMessage(m, state.messages[i]));
  if (changed) {
    state = { messages: merged, epoch: Math.max(state.epoch, remote.epoch) };
    emit();
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', onStorageEvent);
}

export function useCortexChatMessages(): ChatMessage[] {
  return useSyncExternalStore(subscribeCortexChat, () => state.messages);
}

export function useCortexChatSnapshot(): CortexChatState {
  return useSyncExternalStore(subscribeCortexChat, () => state);
}
