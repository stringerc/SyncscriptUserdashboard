/**
 * Cortex Proactive Voice — the service that lets Cortex SPEAK FIRST.
 *
 * Wires the dormant machinery together:
 *   - Nudge engine tick (30s) → Cortana-voice nudges
 *   - announce() API → proactive audit insights, mission completions,
 *     system alerts routed from anywhere in the app
 *
 * Safety architecture:
 *   - cortex-voice-policy gates EVERY utterance (quiet hours, idle gate,
 *     cooldowns, hourly cap) — shared via localStorage across tabs
 *   - Leader election via localStorage heartbeat: when chat AND face
 *     pages are both open, exactly one ticks the nudge engine and
 *     originates proactive speech. announce() calls still work on any
 *     page because the shared cooldown dedupes across tabs.
 *   - isBusy() gate: never talk over the user or over ourselves.
 */

import { getCortexNudgeEngine, type CortexNudge } from './cortex-nudge-engine';
import {
  canSpeakProactively,
  markProactiveSpoken,
  getVoicePolicy,
  type ProactiveCategory,
} from './cortex-voice-policy';
import { cortexSignalBus } from '../components/cortex/CortexVisualizer';

export interface ProactiveVoiceDeps {
  /** Speak one utterance (page's TTS entry point). */
  speak: (text: string, category: ProactiveCategory) => void;
  /** True while Cortex is speaking/thinking or the user is mid-utterance. */
  isBusy?: () => boolean;
}

const TICK_MS = 30_000;
const HEARTBEAT_MS = 10_000;
const AMBIENT_POLL_MS = 60_000;
const LEADER_STALE_MS = 25_000;
const LEADER_KEY = 'cortex_voice_leader';
const AMBIENT_LAST_KEY = 'cortex_ambient_last_id';
const AMBIENT_SEEN_KEY = 'cortex_ambient_seen_ids';
const AMBIENT_SPOKEN_KEY = 'cortex_ambient_spoken_texts';
const TEXT_DEDUP_MS = 6 * 3600 * 1000;
const SEEN_MAX = 500;
const SPOKEN_MAX = 200;
// Routine agent-runtime completion notices ("SENTINEL completed: …") are
// written to the same queue for the inbox UI but are chatter, not speech.
const ROUTINE_NOTICE_RE = /\bcompleted:\s/i;

interface LeaderRecord { id: string; ts: number }

function readLeader(): LeaderRecord | null {
  try {
    const raw = localStorage.getItem(LEADER_KEY);
    if (!raw) return null;
    const rec = JSON.parse(raw) as LeaderRecord;
    return rec && typeof rec.ts === 'number' ? rec : null;
  } catch { return null; }
}

function writeLeader(rec: LeaderRecord): void {
  try { localStorage.setItem(LEADER_KEY, JSON.stringify(rec)); } catch {}
}

function generateId(): string {
  try { return crypto.randomUUID(); } catch { return `pv-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
}

class CortexProactiveVoiceService {
  private deps: ProactiveVoiceDeps | null = null;
  private id = generateId();
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private hbTimer: ReturnType<typeof setInterval> | null = null;
  private ambientTimer: ReturnType<typeof setInterval> | null = null;
  private ambientLastId = (() => {
    try { return localStorage.getItem(AMBIENT_LAST_KEY) || ''; } catch { return ''; }
  })();
  private ambientSeenIds = (() => {
    try {
      const raw = localStorage.getItem(AMBIENT_SEEN_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return new Set<string>(Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : []);
    } catch { return new Set<string>(); }
  })();
  private ambientSpokenTexts = (() => {
    try {
      const raw = localStorage.getItem(AMBIENT_SPOKEN_KEY);
      const obj = raw ? JSON.parse(raw) : {};
      return (obj && typeof obj === 'object' ? obj : {}) as Record<string, number>;
    } catch { return {} as Record<string, number>; }
  })();
  private storageHandler: ((e: StorageEvent) => void) | null = null;
  private started = false;
  private isLeader = false;
  private lastNudgeSignature = '';

  /** Attach page capabilities. Safe to call again to swap deps. */
  start(deps: ProactiveVoiceDeps): void {
    this.deps = deps;
    if (this.started) return;
    this.started = true;

    const beat = () => {
      const leader = readLeader();
      const now = Date.now();
      if (!leader || now - leader.ts > LEADER_STALE_MS || leader.id === this.id) {
        // Claim or renew leadership
        writeLeader({ id: this.id, ts: now });
        const wasLeader = this.isLeader;
        this.isLeader = true;
        if (!wasLeader) this.armTick();
      } else {
        const wasLeader = this.isLeader;
        this.isLeader = false;
        if (wasLeader) this.disarmTick();
      }
    };

    beat();
    this.hbTimer = setInterval(beat, HEARTBEAT_MS);

    // React to other tabs claiming/releasing leadership
    this.storageHandler = (e: StorageEvent) => {
      if (e.key === LEADER_KEY) beat();
    };
    window.addEventListener('storage', this.storageHandler);

    // Immediate first tick so a freshly opened page doesn't wait 30s
    this.maybeTick();
  }

  stop(): void {
    if (this.tickTimer) { clearInterval(this.tickTimer); this.tickTimer = null; }
    if (this.hbTimer) { clearInterval(this.hbTimer); this.hbTimer = null; }
    if (this.ambientTimer) { clearInterval(this.ambientTimer); this.ambientTimer = null; }
    if (this.storageHandler) { window.removeEventListener('storage', this.storageHandler); this.storageHandler = null; }
    if (this.isLeader) writeLeader({ id: '', ts: 0 });
    this.isLeader = false;
    this.started = false;
    this.deps = null;
  }

  private armTick(): void {
    if (this.tickTimer) return;
    this.tickTimer = setInterval(() => this.maybeTick(), TICK_MS);
    // Ambient queue polling is leader-only: exactly one open page drains the
    // server-side notice queue, and the shared last-id + policy cooldowns
    // dedupe across tabs and leadership changes.
    this.ambientTimer = setInterval(() => { this.pollAmbient().catch(() => {}); }, AMBIENT_POLL_MS);
    this.pollAmbient().catch(() => {});
  }

  private disarmTick(): void {
    if (this.tickTimer) { clearInterval(this.tickTimer); this.tickTimer = null; }
    if (this.ambientTimer) { clearInterval(this.ambientTimer); this.ambientTimer = null; }
  }

  private persistAmbientState(): void {
    try {
      localStorage.setItem(AMBIENT_LAST_KEY, this.ambientLastId);
      localStorage.setItem(AMBIENT_SEEN_KEY, JSON.stringify([...this.ambientSeenIds].slice(-SEEN_MAX)));
      const now = Date.now();
      const fresh = Object.fromEntries(
        Object.entries(this.ambientSpokenTexts).filter(([, ts]) => now - ts < TEXT_DEDUP_MS),
      );
      const keys = Object.keys(fresh);
      if (keys.length > SPOKEN_MAX) {
        keys.sort((a, b) => fresh[a] - fresh[b]);
        for (const k of keys.slice(0, keys.length - SPOKEN_MAX)) delete fresh[k];
      }
      this.ambientSpokenTexts = fresh;
      localStorage.setItem(AMBIENT_SPOKEN_KEY, JSON.stringify(fresh));
    } catch {}
  }

  private normalizeNoticeText(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 160);
  }

  /**
   * Drain the server-side ambient notice queue (always-on host generates,
   * this client decides whether it's an appropriate moment to speak).
   * Items are marked seen regardless of policy outcome — notices are
   * ephemeral and the next server tick produces fresh ones.
   *
   * Speech gates (in order):
   *   1. seen-id set — mixed id formats ('notice-task-*' vs '<ts>-*') break
   *      lexicographic max-id comparison, so dedupe by membership instead.
   *   2. routine agent-completion notices are queued for the inbox UI but
   *      never spoken — they were drowning out every real notice.
   *   3. content dedupe — identical text within 6h is never re-spoken.
   *   4. at most ONE announcement per poll — a backlog burst must not
   *      queue a wall of utterances into the voice stream.
   */
  private async pollAmbient(): Promise<void> {
    try {
      const res = await fetch('/api/cortex/ambient/pending', { cache: 'no-store' });
      if (!res.ok) return;
      const data: any = await res.json();
      const items = Array.isArray(data?.items) ? data.items : [];
      let newest = this.ambientLastId;
      let announceCandidate: { text: string; kind: string } | null = null;
      for (const item of items) {
        if (!item || typeof item.id !== 'string' || typeof item.text !== 'string') continue;
        if (this.ambientSeenIds.has(item.id)) continue;
        this.ambientSeenIds.add(item.id);
        if (item.id > newest) newest = item.id;
        const text = String(item.text).trim();
        if (!text || ROUTINE_NOTICE_RE.test(text.slice(0, 120))) continue;
        const norm = this.normalizeNoticeText(text);
        const lastSpoken = this.ambientSpokenTexts[norm];
        if (lastSpoken && Date.now() - lastSpoken < TEXT_DEDUP_MS) continue;
        // Keep the newest eligible item — earlier backlog stays silent.
        announceCandidate = {
          text,
          kind: item.kind === 'system' ? 'system' : 'ambient',
        };
      }
      if (announceCandidate) {
        const spoken = this.announce(announceCandidate.text, announceCandidate.kind as ProactiveCategory, {
          signals: ['ambient-queue'],
        });
        if (spoken) {
          const norm = this.normalizeNoticeText(announceCandidate.text);
          this.ambientSpokenTexts[norm] = Date.now();
        }
      }
      if (newest !== this.ambientLastId) this.ambientLastId = newest;
      this.persistAmbientState();
    } catch {}
  }

  /** Called by the leader on each tick AND once on leadership gain. */
  private maybeTick(): void {
    if (!this.isLeader || !this.deps) return;
    if (this.deps.isBusy?.()) return;

    try {
      const nudgeEngine = getCortexNudgeEngine();
      // Silent mode computes but never speaks — tick anyway so the
      // whisper/metrics stay live, then bail before announcing.
      const nudge: CortexNudge | null = nudgeEngine.tick({});
      if (!nudge) return;
      if (nudgeEngine.getMode() === 'silent') return;

      // Dedupe identical consecutive nudges (engine cooldowns help, but
      // identical content shouldn't re-fire across leadership changes)
      const sig = `${nudge.type}:${nudge.message.slice(0, 60)}`;
      if (sig === this.lastNudgeSignature) return;
      this.lastNudgeSignature = sig;

      this.announce(nudge.message, 'nudge', { signals: ['nudge-engine', nudge.type] });
    } catch (err) {
      console.warn('[ProactiveVoice] nudge tick failed:', err);
    }
  }

  /**
   * Speak a proactive utterance if policy allows. Works on any page —
   * the shared localStorage cooldown dedupes across tabs. Returns true
   * if the utterance was spoken.
   */
  announce(text: string, category: ProactiveCategory, opts?: { bypassIdle?: boolean; signals?: string[] }): boolean {
    if (!this.deps) return false;
    const clean = text?.trim();
    if (!clean) return false;
    if (this.deps.isBusy?.()) return false;

    const decision = canSpeakProactively(category, opts);
    if (!decision.allow) {
      console.log(`[ProactiveVoice] suppressed ${category}: ${decision.reason}`);
      return false;
    }

    markProactiveSpoken(category);
    this.deps.speak(clean, category);
    // Surface "why it spoke" on the signal bus — the visualizer pulses on
    // the event edge and shows the utterance in the live caption.
    cortexSignalBus.emit(`proactive:${category}`, clean);
    return true;
  }

  /** Force-speak regardless of proactive policy (user-initiated context). */
  announceUserInitiated(text: string): boolean {
    if (!this.deps) return false;
    const clean = text?.trim();
    if (!clean || this.deps.isBusy?.()) return false;
    this.deps.speak(clean, 'wake-ack');
    return true;
  }

  isWakeWordRequired(): boolean {
    return getVoicePolicy().wakeWordRequired;
  }
}

export const cortexProactiveVoice = new CortexProactiveVoiceService();
