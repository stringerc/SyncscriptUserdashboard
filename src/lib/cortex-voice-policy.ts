/**
 * Cortex Voice Policy — the gatekeeper for proactive (unprompted) speech.
 *
 * Cortex computes constantly (nudge engine, proactive audits, mission
 * completions) but may only SPEAK when this policy says so. Without it,
 * proactive voice is just an interruption engine.
 *
 * Rules, in order:
 *   1. Master switch (proactiveEnabled)
 *   2. Quiet hours (optional, wraps midnight)
 *   3. User must be idle ≥ minUserIdleMs (don't talk over a live human)
 *   4. Per-category cooldown (shared via localStorage → cross-tab dedupe)
 *   5. Hourly cap (maxProactivePerHour)
 *
 * All state lives in localStorage so the chat page and face page — and
 * multiple tabs — share one coherent policy.
 */

export type ProactiveCategory = 'nudge' | 'insight' | 'mission' | 'system' | 'ambient' | 'wake-ack';

/**
 * Confidence gate modes (Cortex Home plan v3):
 *   strict   — requires ≥2 independent evidence signals, else suppressed
 *   balanced — default; normal gates only (current behaviour)
 *   soft     — bypasses the idle gate for more proactive presence
 */
export type ProactiveMode = 'strict' | 'balanced' | 'soft';

export interface CortexVoicePolicySettings {
  /** Master switch for ALL unprompted speech. Default true. */
  proactiveEnabled: boolean;
  /** Enable quiet hours. Default false. */
  quietHoursEnabled: boolean;
  /** Quiet window start hour (0-23, local time). Default 22. */
  quietStartHour: number;
  /** Quiet window end hour (0-23, local time). Default 8. */
  quietEndHour: number;
  /** Don't speak proactively until the user has been idle this long. Default 45s. */
  minUserIdleMs: number;
  /** Max proactive utterances per rolling hour. Default 6. */
  maxProactivePerHour: number;
  /** Require wake word before ANY speech (proactive + responses). Default false. */
  wakeWordRequired: boolean;
  /** Wake word phrase. Default 'cortex'. */
  wakeWord: string;
  /** Speak a short "Yes?" ack when the wake word is heard alone. Default true. */
  wakeWordAck: boolean;
  /** Confidence-gate mode for proactive speech. Default 'balanced'. */
  proactiveMode: ProactiveMode;
}

const SETTINGS_KEY = 'cortex_voice_policy';
const ACTIVITY_KEY = 'cortex_last_user_activity';
const COOLDOWN_PREFIX = 'cortex_voice_cd_';
const SPOKEN_KEY = 'cortex_voice_spoken_log';
const DECISIONS_KEY = 'cortex_voice_decisions';
const DECISIONS_MAX = 50;

const CATEGORY_DEFAULT_COOLDOWN_MS: Record<ProactiveCategory, number> = {
  nudge: 8 * 60 * 1000,     // metacognitive nudges — sparse by nature
  insight: 15 * 60 * 1000,  // proactive audit suggestions
  mission: 2 * 60 * 1000,   // mission completions — more urgent
  system: 10 * 60 * 1000,   // guardian blocks / system alerts
  ambient: 5 * 60 * 1000,   // server-side ambient notices (always-on host)
  'wake-ack': 0,            // acks are user-initiated; no cooldown
};

export const DEFAULT_VOICE_POLICY: CortexVoicePolicySettings = {
  proactiveEnabled: true,
  quietHoursEnabled: false,
  quietStartHour: 22,
  quietEndHour: 8,
  minUserIdleMs: 45_000,
  maxProactivePerHour: 6,
  wakeWordRequired: false,
  wakeWord: 'cortex',
  wakeWordAck: true,
  proactiveMode: 'balanced',
};

function safeGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch {}
}

export function getVoicePolicy(): CortexVoicePolicySettings {
  const raw = safeGet(SETTINGS_KEY);
  if (!raw) return { ...DEFAULT_VOICE_POLICY };
  try {
    return { ...DEFAULT_VOICE_POLICY, ...(JSON.parse(raw) as Partial<CortexVoicePolicySettings>) };
  } catch {
    return { ...DEFAULT_VOICE_POLICY };
  }
}

export function updateVoicePolicy(patch: Partial<CortexVoicePolicySettings>): CortexVoicePolicySettings {
  const next = { ...getVoicePolicy(), ...patch };
  safeSet(SETTINGS_KEY, JSON.stringify(next));
  // Broadcast so other tabs/pages re-read policy without a reload.
  try { window.dispatchEvent(new CustomEvent('cortex-voice-policy-change', { detail: next })); } catch {}
  return next;
}

// ── User activity tracking ──────────────────────────────────────────

/** Call on every genuine user interaction (PTT, transcript, key, click). */
export function recordUserActivity(): void {
  safeSet(ACTIVITY_KEY, String(Date.now()));
}

export function getLastUserActivity(): number {
  const raw = safeGet(ACTIVITY_KEY);
  const ts = raw ? parseInt(raw, 10) : 0;
  // If never recorded, treat page load as activity so Cortex doesn't
  // immediately start talking the second the app opens.
  return Number.isFinite(ts) && ts > 0 ? ts : Date.now();
}

// ── Policy evaluation ───────────────────────────────────────────────

function isQuietHours(now: Date, s: CortexVoicePolicySettings): boolean {
  if (!s.quietHoursEnabled) return false;
  const h = now.getHours();
  const { quietStartHour: start, quietEndHour: end } = s;
  if (start === end) return false;
  return start < end ? (h >= start && h < end) : (h >= start || h < end);
}

function cooldownRemainingMs(category: ProactiveCategory): number {
  const raw = safeGet(COOLDOWN_PREFIX + category);
  if (!raw) return 0;
  const last = parseInt(raw, 10);
  if (!Number.isFinite(last)) return 0;
  const cd = CATEGORY_DEFAULT_COOLDOWN_MS[category] ?? 10 * 60 * 1000;
  return Math.max(0, last + cd - Date.now());
}

function spokenLastHour(): number {
  const raw = safeGet(SPOKEN_KEY);
  if (!raw) return 0;
  try {
    const arr = JSON.parse(raw) as number[];
    const cutoff = Date.now() - 60 * 60 * 1000;
    return arr.filter(t => t > cutoff).length;
  } catch { return 0; }
}

export interface PolicyDecision {
  allow: boolean;
  reason: string;
  /** 'low' when the utterance passed on thin evidence (soft mode). */
  confidence?: 'normal' | 'low';
}

export interface VoiceDecisionRecord {
  ts: number;
  category: ProactiveCategory;
  allow: boolean;
  reason: string;
  signals: string[];
  mode: ProactiveMode;
  confidence?: 'normal' | 'low';
}

function logDecision(rec: VoiceDecisionRecord): void {
  try {
    const raw = safeGet(DECISIONS_KEY);
    let arr: VoiceDecisionRecord[] = [];
    try { arr = raw ? (JSON.parse(raw) as VoiceDecisionRecord[]) : []; } catch {}
    arr.push(rec);
    safeSet(DECISIONS_KEY, JSON.stringify(arr.slice(-DECISIONS_MAX)));
  } catch {}
}

/** Recent proactive-speech decisions, newest last. Powers the "why it didn't act" log. */
export function getVoiceDecisions(): VoiceDecisionRecord[] {
  try {
    const raw = safeGet(DECISIONS_KEY);
    return raw ? (JSON.parse(raw) as VoiceDecisionRecord[]) : [];
  } catch { return []; }
}

/**
 * Decide whether Cortex may speak PROACTIVELY right now.
 * User-initiated speech (direct responses, wake acks) bypasses this —
 * call sites should only consult this for unprompted utterances.
 */
export function canSpeakProactively(
  category: ProactiveCategory,
  opts?: { bypassIdle?: boolean; signals?: string[]; log?: boolean },
): PolicyDecision {
  const s = getVoicePolicy();
  const signals = opts?.signals ?? [];
  const mode = s.proactiveMode ?? 'balanced';
  const finish = (d: PolicyDecision): PolicyDecision => {
    if (opts?.log !== false) {
      logDecision({ ts: Date.now(), category, allow: d.allow, reason: d.reason, signals, mode, confidence: d.confidence });
    }
    return d;
  };

  if (!s.proactiveEnabled) return finish({ allow: false, reason: 'proactive speech disabled' });
  if (isQuietHours(new Date(), s)) return finish({ allow: false, reason: 'quiet hours' });

  // Confidence gate: strict mode requires ≥2 independent evidence signals.
  // The category itself counts as one; callers should pass real evidence
  // (e.g. ['calendar-conflict','device-state']) for high-stakes speech.
  if (mode === 'strict' && signals.length + 1 < 2) {
    return finish({ allow: false, reason: `insufficient signals (${signals.length + 1}/2) in strict mode` });
  }

  const softBypassIdle = mode === 'soft' || !!opts?.bypassIdle;
  if (!softBypassIdle) {
    const idleMs = Date.now() - getLastUserActivity();
    if (idleMs < s.minUserIdleMs) {
      return finish({ allow: false, reason: `user active ${Math.round(idleMs / 1000)}s ago` });
    }
  }

  const cd = cooldownRemainingMs(category);
  if (cd > 0) return finish({ allow: false, reason: `${category} cooldown ${Math.ceil(cd / 1000)}s` });

  if (spokenLastHour() >= s.maxProactivePerHour) {
    return finish({ allow: false, reason: 'hourly proactive cap reached' });
  }

  // Soft mode marks thin-evidence utterances as low-confidence for the UI.
  const confidence = mode === 'soft' && signals.length + 1 < 2 ? 'low' : 'normal';
  return finish({ allow: true, reason: 'ok', confidence });
}

/** Record that a proactive utterance was actually spoken. */
export function markProactiveSpoken(category: ProactiveCategory): void {
  safeSet(COOLDOWN_PREFIX + category, String(Date.now()));
  const raw = safeGet(SPOKEN_KEY);
  let arr: number[] = [];
  try { arr = raw ? (JSON.parse(raw) as number[]) : []; } catch {}
  arr.push(Date.now());
  const cutoff = Date.now() - 60 * 60 * 1000;
  safeSet(SPOKEN_KEY, JSON.stringify(arr.filter(t => t > cutoff)));
}
