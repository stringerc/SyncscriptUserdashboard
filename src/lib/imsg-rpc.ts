/**
 * imsg-rpc client — talks to tools/imsg-rpc/server.mjs (HTTP bridge over
 * `imsg rpc` JSON-RPC). The daemon owns the single long-lived imsg child so
 * callers never spawn imsg inside the vite process (known hang).
 *
 * All functions fail soft: when the daemon isn't running they return
 * { ok:false } and callers fall back to the direct CLI path.
 */

function rpcBase(): string {
  // Lazy: this module is server-side only, but keep env reads inside
  // functions so nothing evaluates at import time.
  const envBase = typeof process !== 'undefined' ? process.env?.CORTEX_IMSG_RPC_URL : undefined;
  return (envBase || 'http://127.0.0.1:8930').replace(/\/$/, '');
}
const TIMEOUT_MS = 15000;

export interface ImsgChat {
  id: number;
  guid: string;
  identifier: string;
  name?: string;
  participants?: string[];
  is_group?: boolean;
  service?: string;
  last_message_at?: string;
}

export interface ImsgRpcResult<T = any> {
  ok: boolean;
  data?: T;
  error?: string;
}

async function call<T = any>(path: string, init?: RequestInit, timeoutMs = TIMEOUT_MS): Promise<ImsgRpcResult<T>> {
  try {
    const r = await fetch(`${rpcBase()}${path}`, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    });
    const j: any = await r.json().catch(() => null);
    if (!r.ok || j?.ok === false) return { ok: false, error: String(j?.error || `http ${r.status}`) };
    return { ok: true, data: j };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e).slice(0, 160) };
  }
}

export async function imsgRpcHealth(): Promise<ImsgRpcResult<{ childAlive: boolean; chats: number | null }>> {
  return call('/health');
}

export async function imsgRpcChats(limit = 20): Promise<ImsgRpcResult<ImsgChat[]>> {
  const r = await call<{ chats?: ImsgChat[] }>(`/chats?limit=${Math.min(limit, 100)}`);
  return r.ok ? { ok: true, data: r.data?.chats ?? [] } : r;
}

export async function imsgRpcHistory(chatId: number, limit = 20): Promise<ImsgRpcResult<any[]>> {
  const r = await call<{ messages?: any[] }>(`/history?chat_id=${chatId}&limit=${Math.min(limit, 100)}`);
  return r.ok ? { ok: true, data: r.data?.messages ?? [] } : r;
}

export interface ImsgSendParams {
  to?: string;
  chat_id?: number;
  chat_guid?: string;
  chat_identifier?: string;
  text?: string;
  file?: string;
  service?: 'imessage' | 'sms' | 'auto';
}

export async function imsgRpcSend(params: ImsgSendParams): Promise<ImsgRpcResult<{ ok?: boolean; id?: number; guid?: string }>> {
  return call('/send', { method: 'POST', body: JSON.stringify(params) }, 60000);
}

/** SSE URL for inbound message streaming (watch.subscribe under the hood). */
export function imsgRpcWatchUrl(): string {
  return `${rpcBase()}/watch`;
}
