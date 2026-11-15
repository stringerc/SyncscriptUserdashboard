/**
 * Cortana local bridge client.
 * Prefer same-origin `/api/cortana/*` (Vite proxy). If Vite is down, fall back to loopback :5212
 * so a dead HMR process does not kill companion TTS/health while the tab is still open.
 */

const TOKEN_KEY = 'cortanaBridgeToken';
const DEFAULT_DIRECT = 'http://127.0.0.1:5212';

function env(key: string): string | undefined {
  if (typeof import.meta === 'undefined') return undefined;
  return (import.meta as ImportMeta & { env?: Record<string, string> }).env?.[key];
}

/** Base URL with no trailing slash. Empty string = same-origin (Vite proxy). */
export function getBridgeBaseUrl(): string {
  const fromEnv = env('VITE_CORTANA_BRIDGE_URL');
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  if (typeof window !== 'undefined') {
    if (window.location.protocol === 'file:') {
      return DEFAULT_DIRECT;
    }
    return '';
  }

  return DEFAULT_DIRECT;
}

export function getDirectBridgeUrl(): string {
  return env('VITE_CORTANA_BRIDGE_URL')?.replace(/\/$/, '') || DEFAULT_DIRECT;
}

export function getBridgeToken(): string {
  const envToken = env('VITE_CORTANA_BRIDGE_TOKEN');
  if (envToken) return envToken;
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored) return stored;
  }
  return 'cortana-local-dev';
}

export function bridgeHeaders(extra: Record<string, string> = {}): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'X-Cortana-Token': getBridgeToken(),
    ...extra,
  };
}

function resolveUrl(base: string, path: string): string {
  if (path.startsWith('http')) return path;
  return `${base}${path}`;
}

async function fetchOnce(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: {
      ...bridgeHeaders(),
      ...(init.headers as Record<string, string> | undefined),
    },
    signal: init.signal ?? AbortSignal.timeout(timeoutMs),
  });
}

export async function bridgeFetch(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const { timeoutMs = 30000, headers, ...rest } = init;
  const reqInit: RequestInit = { ...rest, headers };
  const primary = getBridgeBaseUrl();
  const primaryUrl = resolveUrl(primary, path);

  try {
    return await fetchOnce(primaryUrl, reqInit, timeoutMs);
  } catch (err) {
    // Same-origin failed (Vite dead) → direct loopback bridge
    if (primary === '' || primary.includes('localhost') || primary.includes('127.0.0.1')) {
      const direct = getDirectBridgeUrl();
      if (resolveUrl(direct, path) !== primaryUrl) {
        return fetchOnce(resolveUrl(direct, path), reqInit, timeoutMs);
      }
    }
    throw err;
  }
}
