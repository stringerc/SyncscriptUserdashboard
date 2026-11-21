/**
 * local-intent — zero-dependency on-device intent classification for Cortex.
 *
 * Tier 1: Chrome Prompt API (`LanguageModel`, built into Chrome 138+) — a
 *   small on-device model classifies the utterance into a fixed intent set.
 * Tier 0: deterministic heuristic regexes — always available, no model.
 *
 * `runLocalIntent` executes the subset of intents that need no LLM:
 * open_app (via /api/cortex/tools `open`), time, date. Everything else
 * returns handled:false so the caller proceeds to the full voice pipeline.
 *
 * This is the degraded-mode path: it keeps working when every cloud API
 * and local model server is down.
 */

export type LocalIntentKind =
  | 'open_app'
  | 'screenshot'
  | 'time'
  | 'date'
  | 'volume_up'
  | 'volume_down'
  | 'unknown';

export interface LocalIntentResult {
  intent: LocalIntentKind;
  /** free-form parameter, e.g. app name for open_app */
  param?: string;
  confidence: number;
  engine: 'prompt-api' | 'heuristic' | 'none';
}

const INTENT_LABELS: LocalIntentKind[] = [
  'open_app', 'screenshot', 'time', 'date', 'volume_up', 'volume_down', 'unknown',
];

// ── Tier 0: heuristics ────────────────────────────────────────────────────
const OPEN_RE = /^(?:please\s+)?(?:open|launch|start|fire up|bring up|pull up)\s+(?:the\s+)?(.+?)(?:\s+(?:app|application))?\.?$/i;
const SCREENSHOT_RE = /^(?:take|capture|snap)\s+(?:a\s+)?screenshot|screenshot\s+(?:please|now)?$/i;
const TIME_RE = /^(?:what(?:'s| is)|tell me|whats)\s+(?:the\s+)?time\b|^time\??$/i;
const DATE_RE = /^(?:what(?:'s| is)|tell me|whats)\s+(?:the\s+)?(?:date|day|today)\b|^date\??$/i;
const VOL_UP_RE = /^(?:turn|crank|raise|increase|volume up|louder)\b.*\b(?:volume|sound)\b|^volume up\b/i;
const VOL_DOWN_RE = /^(?:turn|lower|decrease|deafen|volume down|quieter)\b.*\b(?:volume|sound)\b|^volume down\b/i;

const KNOWN_APPS = new Set([
  'safari', 'chrome', 'firefox', 'edge', 'arc', 'brave',
  'notes', 'mail', 'messages', 'facetime', 'calendar', 'reminders',
  'music', 'spotify', 'podcasts', 'tv', 'photos', 'preview',
  'terminal', 'iterm', 'vs code', 'code', 'xcode', 'finder', 'settings',
  'system preferences', 'system settings', 'activity monitor', 'calculator',
  'maps', 'weather', 'stocks', 'books', 'app store',
]);

export function heuristicIntent(text: string): LocalIntentResult {
  const t = text.trim().replace(/[.!?]+$/, '');
  if (!t) return { intent: 'unknown', confidence: 0, engine: 'heuristic' };

  let m = t.match(OPEN_RE);
  if (m) {
    const param = m[1].trim().toLowerCase();
    // "open the pod bay doors" is not an app request — require a plausible
    // app token: known app, single word, or ≤3 words without verbs.
    const plausible = KNOWN_APPS.has(param)
      || /^[a-z0-9 .&'-]{2,30}$/.test(param)
      && !/\b(the|a|an|to|for|and|or|of|in|on|at)\b/i.test(param);
    if (plausible && !/^(the\s+)?(door|pod bay)/i.test(param)) {
      return { intent: 'open_app', param, confidence: KNOWN_APPS.has(param) ? 0.95 : 0.7, engine: 'heuristic' };
    }
  }
  if (SCREENSHOT_RE.test(t)) return { intent: 'screenshot', confidence: 0.9, engine: 'heuristic' };
  if (TIME_RE.test(t)) return { intent: 'time', confidence: 0.95, engine: 'heuristic' };
  if (DATE_RE.test(t)) return { intent: 'date', confidence: 0.9, engine: 'heuristic' };
  if (VOL_UP_RE.test(t)) return { intent: 'volume_up', confidence: 0.75, engine: 'heuristic' };
  if (VOL_DOWN_RE.test(t)) return { intent: 'volume_down', confidence: 0.75, engine: 'heuristic' };
  return { intent: 'unknown', confidence: 0, engine: 'heuristic' };
}

// ── Tier 1: Chrome Prompt API ─────────────────────────────────────────────
interface LanguageModelLike {
  availability?: () => Promise<string>;
  create?: (opts?: any) => Promise<{ prompt: (s: string) => Promise<string>; destroy?: () => void }>;
}

function getPromptAPI(): LanguageModelLike | null {
  if (typeof self === 'undefined') return null;
  const w = self as any;
  return w.LanguageModel || w.languageModel || null;
}

let __lmSession: { prompt: (s: string) => Promise<string>; destroy?: () => void } | null = null;
let __lmChecked = false;

async function promptApiSession() {
  if (__lmChecked) return __lmSession;
  __lmChecked = true;
  const lm = getPromptAPI();
  if (!lm?.create) return null;
  try {
    if (lm.availability) {
      const avail = await Promise.race([
        lm.availability(),
        new Promise<string>((r) => setTimeout(() => r('unknown'), 1500)),
      ]);
      if (avail !== 'available' && avail !== 'downloadable') return null;
    }
    __lmSession = await lm.create({
      monitor(m: any) {
        m.addEventListener?.('downloadprogress', () => {});
      },
    });
  } catch {
    __lmSession = null;
  }
  return __lmSession;
}

/**
 * Classify an utterance. Uses the Prompt API when the browser ships it and
 * the model is available; otherwise falls back to heuristics. Never throws.
 */
export async function classifyLocalIntent(text: string): Promise<LocalIntentResult> {
  const fallback = heuristicIntent(text);
  if (fallback.intent !== 'unknown' && fallback.confidence >= 0.9) return fallback;

  const session = await promptApiSession();
  if (!session) return fallback;

  try {
    const prompt = [
      'Classify this voice-command text into exactly one label.',
      `Labels: ${INTENT_LABELS.join(', ')}`,
      'open_app = open/launch an application (param is the app name)',
      'screenshot = take a screenshot', 'time = current time', 'date = current date',
      'volume_up / volume_down = change system volume', 'unknown = anything else',
      'Reply with ONLY the label, then a space, then the parameter if any.',
      `Text: "${text.slice(0, 300)}"`,
    ].join('\n');
    const raw = await Promise.race([
      session.prompt(prompt),
      new Promise<string>((_, rej) => setTimeout(() => rej(new Error('prompt timeout')), 8000)),
    ]);
    const label = String(raw).trim().split(/[\s,]+/)[0]?.toLowerCase() as LocalIntentKind;
    if (!INTENT_LABELS.includes(label) || label === 'unknown') return fallback;
    const param = String(raw).trim().split(/\s+/).slice(1).join(' ') || undefined;
    return { intent: label, param: param || fallback.param, confidence: 0.8, engine: 'prompt-api' };
  } catch {
    return fallback;
  }
}

// ── Execution: intents that need no LLM ───────────────────────────────────
export interface LocalIntentExecution {
  handled: boolean;
  /** Short confirmation text the caller may speak/display. */
  reply?: string;
  error?: string;
}

function execOsascript(script: string): Promise<{ ok: boolean; error?: string }> {
  return fetch('/api/cortex/tools', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tool: 'run_command', args: { command: script, timeout: 15000 } }),
  })
    .then((r) => r.json())
    .then((j: any) => (j?.ok ? { ok: true } : { ok: false, error: j?.error || j?.stderr || 'run_command failed' }))
    .catch((e: any) => ({ ok: false, error: String(e?.message || e) }));
}

export async function runLocalIntent(result: LocalIntentResult): Promise<LocalIntentExecution> {
  switch (result.intent) {
    case 'time': {
      const t = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      return { handled: true, reply: `It's ${t}.` };
    }
    case 'date': {
      const d = new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
      return { handled: true, reply: `Today is ${d}.` };
    }
    case 'open_app': {
      const app = result.param?.trim();
      if (!app) return { handled: false };
      // `open` with `name` maps to `open -a "<name>"` server-side — app-name
      // launch goes through the governed tool surface, no client shell.
      try {
        const r = await fetch('/api/cortex/tools', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tool: 'open', args: { name: app } }),
        });
        const j: any = await r.json().catch(() => null);
        if (j?.ok) return { handled: true, reply: `Opening ${app}.` };
        return { handled: false, error: j?.error || 'open failed' };
      } catch (e: any) {
        return { handled: false, error: String(e?.message || e) };
      }
    }
    case 'screenshot': {
      // screencapture is a real local binary; go through run_local so the
      // command stays inside the governed executor.
      const r = await execOsascript('screencapture -x "$HOME/Desktop/cortex-screenshot.png"');
      return r.ok
        ? { handled: true, reply: 'Screenshot saved to your Desktop.' }
        : { handled: false, error: r.error };
    }
    case 'volume_up':
    case 'volume_down': {
      const delta = result.intent === 'volume_up' ? 10 : -10;
      const r = await execOsascript(
        `V=$(osascript -e 'output volume of (get volume settings)' 2>/dev/null || echo 50); ` +
        `osascript -e "set volume output volume ($V + (${delta}))"`,
      );
      return r.ok
        ? { handled: true, reply: result.intent === 'volume_up' ? 'Volume up.' : 'Volume down.' }
        : { handled: false, error: r.error };
    }
    default:
      return { handled: false };
  }
}
