// Shared CDP endpoint resolution for storefront automation tools.
// Order: CDP_URL env → CORTEX_CDP_URL env → storefront/.cdp-url file →
// VM tunnel fallback (:9225 → Oracle automation Chrome).
// The .cdp-url file currently points at the sessioned openclaw Chrome
// (:18800) whose profile carries cookies synced from the user's real
// Chrome — required for Google/Reddit/Etsy/Amazon/Pinterest sessions.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_CDP = 'http://localhost:9225';
const CDP_URL_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.cdp-url');

export function cdpUrl() {
  if (process.env.CDP_URL) return process.env.CDP_URL;
  if (process.env.CORTEX_CDP_URL) return process.env.CORTEX_CDP_URL;
  try { if (fs.existsSync(CDP_URL_FILE)) return fs.readFileSync(CDP_URL_FILE, 'utf8').trim(); } catch {}
  return DEFAULT_CDP;
}
