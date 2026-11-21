/**
 * cortex-obsidian-rest — bridge to the Obsidian "Local REST API" plugin.
 *
 * When OBSIDIAN_REST_API_KEY is set, Cortex can read/write/search the
 * user's *actual* Obsidian vault over HTTPS (default https://127.0.0.1:27124)
 * instead of only the ~/.cortex/vault filesystem store. This is strictly
 * opt-in: no env → every function reports disabled and callers fail soft.
 *
 * Only imported by vite.config.ts (Node context) — never the browser bundle.
 */

import https from 'node:https';

const REST_URL = (process.env.OBSIDIAN_REST_URL || 'https://127.0.0.1:27124').replace(/\/+$/, '');
const API_KEY = process.env.OBSIDIAN_REST_API_KEY || '';
const TIMEOUT_MS = 8000;

export function obsidianRestEnabled(): boolean {
  return API_KEY.length > 0;
}

interface RestResponse {
  status: number;
  body: string;
  json: any;
}

function request(method: 'GET' | 'PUT' | 'POST' | 'DELETE', apiPath: string, body?: string): Promise<RestResponse> {
  return new Promise((resolve, reject) => {
    const u = new URL(REST_URL + apiPath);
    const req = https.request({
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      method,
      rejectUnauthorized: false, // Obsidian serves a self-signed cert on LAN
      timeout: TIMEOUT_MS,
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Accept': 'application/json, text/markdown, */*',
        ...(body !== undefined ? { 'Content-Type': 'text/markdown', 'Content-Length': Buffer.byteLength(body) } : {}),
      },
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json: any = null;
        try { json = JSON.parse(text); } catch { /* non-JSON body (raw markdown) */ }
        resolve({ status: res.statusCode || 0, body: text, json });
      });
    });
    req.on('timeout', () => { req.destroy(new Error('obsidian rest timeout')); });
    req.on('error', reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

/** GET /vault/ — list all file paths in the vault (JSON array of strings). */
export async function obsidianRestList(): Promise<{ ok: boolean; files?: string[]; error?: string }> {
  if (!obsidianRestEnabled()) return { ok: false, error: 'OBSIDIAN_REST_API_KEY not set' };
  try {
    const r = await request('GET', '/vault/');
    if (r.status === 200 && Array.isArray(r.json)) return { ok: true, files: r.json };
    return { ok: false, error: `vault list HTTP ${r.status}` };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'obsidian unreachable — is Obsidian running with Local REST API plugin?' };
  }
}

/** GET /vault/{path} — read a note's raw markdown. */
export async function obsidianRestRead(notePath: string): Promise<{ ok: boolean; content?: string; error?: string }> {
  if (!obsidianRestEnabled()) return { ok: false, error: 'OBSIDIAN_REST_API_KEY not set' };
  const clean = notePath.replace(/^\/+/, '');
  try {
    const r = await request('GET', `/vault/${encodeURI(clean)}`);
    if (r.status === 200) return { ok: true, content: r.body };
    return { ok: false, error: `read HTTP ${r.status}` };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'obsidian unreachable' };
  }
}

/** PUT /vault/{path} — create or overwrite a note. */
export async function obsidianRestWrite(notePath: string, content: string): Promise<{ ok: boolean; error?: string }> {
  if (!obsidianRestEnabled()) return { ok: false, error: 'OBSIDIAN_REST_API_KEY not set' };
  const clean = notePath.replace(/^\/+/, '');
  try {
    const r = await request('PUT', `/vault/${encodeURI(clean)}`, content);
    if (r.status === 200 || r.status === 204) return { ok: true };
    return { ok: false, error: `write HTTP ${r.status}: ${r.body.slice(0, 200)}` };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'obsidian unreachable' };
  }
}

/** GET /search/simple/?query= — Obsidian's own search across the vault. */
export async function obsidianRestSearch(
  query: string,
  contextLength = 120,
): Promise<{ ok: boolean; results?: any[]; error?: string }> {
  if (!obsidianRestEnabled()) return { ok: false, error: 'OBSIDIAN_REST_API_KEY not set' };
  try {
    const r = await request('GET', `/search/simple/?query=${encodeURIComponent(query)}&contextLength=${contextLength}`);
    if (r.status === 200 && Array.isArray(r.json)) return { ok: true, results: r.json };
    return { ok: false, error: `search HTTP ${r.status}` };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'obsidian unreachable' };
  }
}

/** Liveness probe — GET /vault/ with a short timeout. */
export async function obsidianRestStatus(): Promise<{ enabled: boolean; reachable: boolean; vaultSize?: number; error?: string }> {
  if (!obsidianRestEnabled()) return { enabled: false, reachable: false };
  const r = await obsidianRestList();
  return r.ok
    ? { enabled: true, reachable: true, vaultSize: r.files?.length }
    : { enabled: true, reachable: false, error: r.error };
}
