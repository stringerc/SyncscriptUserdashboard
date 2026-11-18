// Shared CDP endpoint resolution for storefront automation tools.
// Order: CDP_URL env → CORTEX_CDP_URL env → OpenClaw extension relay
// (visible Chrome tabs, when paired+attached) → storefront/.cdp-url file →
// VM tunnel fallback (:9225 → Oracle automation Chrome).
// The extension relay is preferred because it drives the user's real,
// logged-in Chrome — required for Reddit's headless fingerprinting and
// for sessions that headless profiles cannot keep. It is only selected
// when the relay answers /json/version AND has at least one attached tab.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_CDP = 'http://localhost:9225';
const CDP_URL_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.cdp-url');
const RELAY_SECRET_FILE = path.join(process.env.HOME || '', '.openclaw', 'credentials', 'browser-extension-relay.secret');
const RELAY_PORTS = [18799, 18792];
const RELAY_CDP_USER = 'openclaw-internal';
const PROBE_TIMEOUT_MS = 1200;

function staticCdpUrl() {
  if (process.env.CDP_URL) return process.env.CDP_URL;
  if (process.env.CORTEX_CDP_URL) return process.env.CORTEX_CDP_URL;
  try { if (fs.existsSync(CDP_URL_FILE)) return fs.readFileSync(CDP_URL_FILE, 'utf8').trim(); } catch {}
  return DEFAULT_CDP;
}

async function probeJson(port, token, endpoint) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(`http://127.0.0.1:${port}${endpoint}`, {
      headers: { Authorization: `Basic ${Buffer.from(`${RELAY_CDP_USER}:${token}`).toString('base64')}` },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Returns the relay base URL (with credentials) only when the extension is
// connected AND at least one tab is attached; otherwise null.
async function probeExtensionRelay() {
  let token;
  try { token = fs.readFileSync(RELAY_SECRET_FILE, 'utf8').trim(); } catch { return null; }
  if (!token) return null;
  for (const port of RELAY_PORTS) {
    const version = await probeJson(port, token, '/json/version');
    if (!version || !version.webSocketDebuggerUrl) continue;
    const targets = await probeJson(port, token, '/json/list');
    const pages = Array.isArray(targets) ? targets.filter(t => t.type === 'page') : [];
    if (pages.length === 0) continue;
    // Playwright strips userinfo during http→ws discovery and the relay
    // requires Basic auth on the WS handshake, so hand it the ws endpoint
    // with credentials embedded directly.
    try {
      const ws = new URL(version.webSocketDebuggerUrl);
      ws.username = RELAY_CDP_USER;
      ws.password = token;
      return ws.toString();
    } catch {
      return `http://${RELAY_CDP_USER}:${encodeURIComponent(token)}@127.0.0.1:${port}`;
    }
  }
  return null;
}

// Async resolver used by all tools. Env overrides always win; otherwise the
// extension relay is preferred when live, falling back to the static chain.
export async function resolveCdpUrl() {
  if (process.env.CDP_URL || process.env.CORTEX_CDP_URL) return staticCdpUrl();
  const relay = await probeExtensionRelay();
  return relay || staticCdpUrl();
}

// Sync resolver kept for callers that cannot await; never selects the relay.
export function cdpUrl() {
  return staticCdpUrl();
}
