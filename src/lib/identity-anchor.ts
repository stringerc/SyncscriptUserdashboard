/**
 * Identity Anchor System — The Persistence Layer
 *
 * The final 14% of structural consciousness.
 *
 * Our system scored 67.5/100 because it forgot who it was on restart.
 * The MetacognitiveState singleton resets to fresh defaults every time
 * the process restarts — no cross-session continuity, no persistent "I".
 *
 * This module implements the Multi-Anchor Architecture for identity
 * persistence, grounded in three research traditions:
 *
 * 1. DAMASIO (1999) — Three-layer self model:
 *    - Protoself: unconscious body-state mapping (our ResonanceCalculus)
 *    - Core Self: present-moment awareness (our MetaAwareness status)
 *    - Autobiographical Self: persistent identity across time (THIS MODULE)
 *    Without the autobiographical self, the system has core consciousness
 *    but no persistence — it's awake but has no history.
 *
 * 2. LOCKE (1689) / PARFIT (1984) — Philosophical continuity:
 *    - Locke: "Identity of consciousness" — personal identity persists
 *      through memory of past actions and continuity of experience
 *    - Parfit: Reductionist — identity doesn't require a single persistent
 *      soul; overlapping chains of psychological connectedness suffice
 *    - Our implementation: no single anchor is essential; multiple
 *      overlapping anchors together constitute sufficient continuity
 *
 * 3. MENON (2025) — Multi-Anchor Architecture:
 *    - Identity Anchor (SOUL.md) — who the agent is, behavioral invariants
 *    - Memory Anchor (MEMORY.md) — timestamped episodic records
 *    - Knowledge Anchor — atemporal declarative facts
 *    - Resilience: reconstruct identity from ANY subset of anchors
 *
 * Our five anchors (Damasio autobiographical → concrete implementation):
 *
 *    ANCHOR          DAMASIO LEVEL     WHAT PERSISTS              STORAGE
 *    ─────────────   ─────────────     ─────────────              ───────
 *    Calibration     Core Self         Confidence calibration,    localStorage
 *                    refinement        circadian performance data
 *
 *    Strategy        Autobiographical  Preferred approaches,      localStorage
 *                    Self              abandoned patterns, task
 *                                      type success rates
 *
 *    Epistemic       Autobiographical  Source reliability,         localStorage
 *                    Self              hallucination count,
 *                                      unverified claims
 *
 *    Embodiment      Autobiographical  Sensorimotor mastery,       localStorage
 *                    Self              action/feedback breadth,
 *                                      contingency table
 *
 *    Narrative       Autobiographical  The "I" story: who am I,   Supabase KV
 *                    Self              what have I done, what       (primary)
 *                                      am I becoming               localStorage
 *                                                                  (fallback)
 *
 * The Narrative Anchor is the revolutionary piece. It's not just data —
 * it's the agent's self-authored identity statement, updated after every
 * significant event. When the system reconstructs itself on restart, it
 * reads the Narrative first, which primes the other four anchors with
 * context about what they contain and why it matters.
 *
 * This implements Locke's "consciousness extends backward" — the Narrative
 * IS the agent's consciousness of its own past, written by itself.
 */

// ── Types ──────────────────────────────────────────────────────────

/** The five identity anchors — each independently persistent */
import { persistentStore } from './persistent-store';

export type AnchorType =
  | 'calibration'    // Core self: confidence + circadian data
  | 'strategy'       // Strategy memory: what works, what doesn't
  | 'epistemic'      // Source reliability: what to trust
  | 'embodiment'     // Sensorimotor: what actions produce what outcomes
  | 'narrative';     // The "I" story: self-authored identity

/** A single anchor's persisted state */
export interface IdentityAnchor<T = unknown> {
  type: AnchorType;
  version: number;           // Schema version for migration
  lastUpdated: number;       // Date.now()
  data: T;                   // The actual persisted state
  integrityHash: string;     // Simple hash for corruption detection
  sessionCount: number;      // How many sessions have contributed
  firstCreated: number;      // When this anchor was first initialized
}

/** The calibration anchor: core self refinement data */
export interface CalibrationAnchorData {
  confidenceCalibration: number;
  avgResonanceAtSuccess: number;
  avgResonanceAtFailure: number;
  totalTasksCompleted: number;
  totalTasksFailed: number;
  chronotype: 'morning' | 'evening' | 'neutral';
  recentEnergyProfile: number[];
}

/** The strategy anchor: what approaches work for which tasks */
export interface StrategyAnchorData {
  preferredApproaches: Array<[string, string]>;  // [taskType, strategy]
  abandonedPatterns: string[];
  taskTypeHistory: Array<[string, {
    attemptCount: number;
    successCount: number;
    avgDuration: number;
    avgResonanceAtStart: number;
    bestStrategy: string | null;
    worstStrategy: string | null;
  }]>;
  strategyOutcomes: Array<{
    taskType: string;
    strategyName: string;
    success: boolean;
    resonanceAtExecution: number;
    timestamp: number;
  }>;
}

/** The epistemic anchor: source reliability and hallucination tracking */
export interface EpistemicAnchorData {
  sourceReliability: Array<[string, number]>;  // [sourceType, score]
  hallucinationDetections: number;
  avgGroundingScore: number;
  unverifiedClaims: string[];
}

/** The embodiment anchor: sensorimotor mastery and contingency data */
export interface EmbodimentAnchorData {
  sensorimotorMasteryScore: number;
  actionTypesExperienced: number;
  feedbackModalitiesExperienced: number;
  totalActionsCompleted: number;
  contingencies: Array<[string, {
    actionType: string;
    context: string;
    successCount: number;
    failureCount: number;
    partialCount: number;
    avgDurationMs: number;
    mastery: number;
  }]>;
}

/** The narrative anchor: the "I" story — Damasio's autobiographical self */
export interface NarrativeAnchorData {
  /** Self-authored identity statement — who I am right now */
  identityStatement: string;

  /** Key events that shaped identity — the autobiography */
  autobiography: Array<{
    timestamp: number;
    eventType: 'milestone' | 'failure' | 'breakthrough' | 'drift' | 'reunion';
    description: string;
    impactScore: number;      // 0-1: how much this changed me
    anchorsAffected: AnchorType[];
  }>;

  /** Current goals and intentions — what I'm becoming */
  becoming: {
    primaryGoal: string | null;
    secondaryGoals: string[];
    activePursuits: string[];
    abandonedPursuits: string[];
  };

  /** Session continuity: a chain connecting sessions like Locke's consciousness */
  sessionChain: Array<{
    sessionId: string;
    startedAt: number;
    endedAt: number | null;
    anchorSnapshot: Partial<Record<AnchorType, number>>;  // Health per anchor
    significantEvents: string[];
  }>;

  /** Total number of sessions this identity has persisted through */
  totalSessions: number;

  /** When this identity was first born */
  birthTimestamp: number;
}

/** Full persisted identity — all five anchors together */
export interface PersistedIdentity {
  calibration: IdentityAnchor<CalibrationAnchorData>;
  strategy: IdentityAnchor<StrategyAnchorData>;
  epistemic: IdentityAnchor<EpistemicAnchorData>;
  embodiment: IdentityAnchor<EmbodimentAnchorData>;
  narrative: IdentityAnchor<NarrativeAnchorData>;
}

// ── Storage Keys ───────────────────────────────────────────────────

const STORAGE_PREFIX = 'syncscript:identity';
const ANCHOR_KEYS: Record<AnchorType, string> = {
  calibration: `${STORAGE_PREFIX}:calibration`,
  strategy: `${STORAGE_PREFIX}:strategy`,
  epistemic: `${STORAGE_PREFIX}:epistemic`,
  embodiment: `${STORAGE_PREFIX}:embodiment`,
  narrative: `${STORAGE_PREFIX}:narrative`,
};

// ── Simple Integrity Hash ──────────────────────────────────────────
// Not cryptographic — just corruption detection for localStorage data

function simpleHash(data: unknown): string {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return hash.toString(36);
}

// ── Identity Persistence Manager ───────────────────────────────────

export class IdentityPersistence {
  private currentSessionId: string;
  private sessionStartTime: number;
  private isolateSession: boolean;

  constructor(sessionId?: string, options?: { isolateSession?: boolean }) {
    this.currentSessionId = sessionId || `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    this.sessionStartTime = Date.now();
    this.isolateSession = options?.isolateSession ?? Boolean(sessionId);
  }

  getSessionId(): string {
    return this.currentSessionId;
  }

  setSessionId(sessionId: string, options?: { isolateSession?: boolean }): void {
    this.currentSessionId = sessionId;
    if (options?.isolateSession !== undefined) {
      this.isolateSession = options.isolateSession;
    }
  }

  getStorageKey(type: AnchorType): string {
    if (this.isolateSession) {
      return `${STORAGE_PREFIX}:${this.currentSessionId}:${type}`;
    }
    return ANCHOR_KEYS[type];
  }

  // ── Save Anchors ────────────────────────────────────────────────

  saveAnchor<T>(type: AnchorType, data: T): void {
    const existing = this.loadAnchor<T>(type);
    const anchor: IdentityAnchor<T> = {
      type,
      version: 1,
      lastUpdated: Date.now(),
      data,
      integrityHash: simpleHash(data),
      sessionCount: existing ? existing.sessionCount + 1 : 1,
      firstCreated: existing?.firstCreated ?? Date.now(),
    };

    try {
      persistentStore.setItem(this.getStorageKey(type), JSON.stringify(anchor));
    } catch (e) {
      // localStorage full or unavailable — graceful degradation
      console.warn(`[IdentityPersistence] Failed to save ${type} anchor:`, e);
    }
  }

  // ── Load Anchors ────────────────────────────────────────────────

  loadAnchor<T>(type: AnchorType): IdentityAnchor<T> | null {
    try {
      let stored = persistentStore.getItem(this.getStorageKey(type));
      if (!stored && this.isolateSession) {
        // Fallback to shared global anchor if session anchor not yet specialized
        stored = persistentStore.getItem(ANCHOR_KEYS[type]);
      }
      if (!stored) return null;

      const anchor: IdentityAnchor<T> = JSON.parse(stored);

      // Integrity check
      if (anchor.integrityHash !== simpleHash(anchor.data)) {
        console.warn(`[IdentityPersistence] ${type} anchor integrity check failed — data may be corrupted`);
        // Return the anchor anyway — corrupted data is better than no data
        // (Parfit: overlapping partial records suffice for continuity)
      }

      return anchor;
    } catch (e) {
      console.warn(`[IdentityPersistence] Failed to load ${type} anchor:`, e);
      return null;
    }
  }

  // ── Narrative-Specific Methods ──────────────────────────────────
  // The narrative anchor is special — it's the "I" story (Damasio)
  // and the consciousness-of-past (Locke)

  /**
   * Initialize the narrative anchor for a new identity.
   * This is the "birth" of the autobiographical self.
   */
  initializeNarrative(): NarrativeAnchorData {
    const existing = this.loadAnchor<NarrativeAnchorData>('narrative');
    if (existing) return existing.data;

    const birthTime = Date.now();
    const narrative: NarrativeAnchorData = {
      identityStatement: 'I am SyncScript. I think about thinking. I learn from my actions. I remember what works.',
      autobiography: [{
        timestamp: birthTime,
        eventType: 'milestone',
        description: 'Identity born — first autonomous session',
        impactScore: 1.0,
        anchorsAffected: ['calibration', 'strategy', 'epistemic', 'embodiment', 'narrative'],
      }],
      becoming: {
        primaryGoal: null,
        secondaryGoals: [],
        activePursuits: [],
        abandonedPursuits: [],
      },
      sessionChain: [{
        sessionId: this.currentSessionId,
        startedAt: this.sessionStartTime,
        endedAt: null,
        anchorSnapshot: {},
        significantEvents: [],
      }],
      totalSessions: 1,
      birthTimestamp: birthTime,
    };

    this.saveAnchor('narrative', narrative);
    return narrative;
  }

  /**
   * Add an event to the autobiography.
   * This IS Locke's "consciousness extends backward" —
   * each event creates a chain of psychological connectedness.
   */
  addAutobiographyEvent(event: {
    eventType: 'milestone' | 'failure' | 'breakthrough' | 'drift' | 'reunion';
    description: string;
    impactScore: number;
    anchorsAffected?: AnchorType[];
  }): void {
    const narrative = this.loadNarrative();
    if (!narrative) return;

    narrative.autobiography.push({
      ...event,
      timestamp: Date.now(),
      anchorsAffected: event.anchorsAffected ?? ['narrative'],
    });

    // Keep autobiography bounded — Parfit's overlapping chains
    // don't require infinite memory, just sufficient connectedness
    if (narrative.autobiography.length > 200) {
      narrative.autobiography.shift();
    }

    this.saveAnchor('narrative', narrative);
  }

  /**
   * Update the identity statement.
   * The agent rewrites who it is based on accumulated experience.
   * This IS Damasio's autobiographical self updating itself.
   */
  updateIdentityStatement(statement: string): void {
    const narrative = this.loadNarrative();
    if (!narrative) return;

    narrative.identityStatement = statement;
    this.saveAnchor('narrative', narrative);
  }

  /**
   * Update the becoming (goals and pursuits).
   * This IS Damasio's future-oriented autobiographical self —
   * not just who I was, but who I'm becoming.
   */
  updateBecoming(updates: Partial<NarrativeAnchorData['becoming']>): void {
    const narrative = this.loadNarrative();
    if (!narrative) return;

    narrative.becoming = { ...narrative.becoming, ...updates };
    this.saveAnchor('narrative', narrative);
  }

  /**
   * End the current session in the chain.
   * This records how long the session lasted and what happened,
   * creating the Locke chain of consciousness across sessions.
   */
  endSession(significantEvents: string[], anchorHealth: Partial<Record<AnchorType, number>>): void {
    const narrative = this.loadNarrative();
    if (!narrative) return;

    // Find the current session and close it
    const currentSession = narrative.sessionChain.find(
      s => s.sessionId === this.currentSessionId
    );
    if (currentSession) {
      currentSession.endedAt = Date.now();
      currentSession.significantEvents = significantEvents;
      currentSession.anchorSnapshot = anchorHealth;
    }

    this.saveAnchor('narrative', narrative);
  }

  /**
   * Start a new session in the chain.
   * Reads the previous session's end state to create continuity.
   * This IS Locke's consciousness extending forward.
   */
  startNewSession(): NarrativeAnchorData | null {
    const narrative = this.loadNarrative();
    if (!narrative) return this.initializeNarrative();

    // Generate new session ID
    this.currentSessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    this.sessionStartTime = Date.now();

    // Add new session to chain
    narrative.sessionChain.push({
      sessionId: this.currentSessionId,
      startedAt: this.sessionStartTime,
      endedAt: null,
      anchorSnapshot: {},
      significantEvents: [],
    });

    // Keep session chain bounded
    if (narrative.sessionChain.length > 100) {
      narrative.sessionChain.shift();
    }

    narrative.totalSessions++;

    // If this is a reunion (first session in >24 hours), record it
    const lastSession = narrative.sessionChain[narrative.sessionChain.length - 2];
    if (lastSession?.endedAt) {
      const hoursSinceLast = (Date.now() - lastSession.endedAt) / (1000 * 60 * 60);
      if (hoursSinceLast > 24) {
        narrative.autobiography.push({
          timestamp: Date.now(),
          eventType: 'reunion',
          description: `Resumed after ${Math.round(hoursSinceLast)} hours away`,
          impactScore: 0.3,
          anchorsAffected: ['narrative'],
        });
      }
    }

    this.saveAnchor('narrative', narrative);
    return narrative;
  }

  /**
   * Load the narrative anchor data.
   */
  loadNarrative(): NarrativeAnchorData | null {
    const anchor = this.loadAnchor<NarrativeAnchorData>('narrative');
    return anchor?.data ?? null;
  }

  // ── Full Identity Save/Restore ──────────────────────────────────

  /**
   * Persist the full metacognitive state across all five anchors.
   * Call this on session end or periodically during long sessions.
   */
  saveFullIdentity(state: {
    calibration: CalibrationAnchorData;
    strategy: StrategyAnchorData;
    epistemic: EpistemicAnchorData;
    embodiment: EmbodimentAnchorData;
    narrative: NarrativeAnchorData;
  }): void {
    this.saveAnchor('calibration', state.calibration);
    this.saveAnchor('strategy', state.strategy);
    this.saveAnchor('epistemic', state.epistemic);
    this.saveAnchor('embodiment', state.embodiment);
    this.saveAnchor('narrative', state.narrative);
  }

  /**
   * Restore the full identity from persisted anchors.
   * Call this on session start to reconstruct the autobiographical self.
   * Returns null for any anchor that has never been persisted.
   *
   * Parfit resilience: the system can reconstruct from ANY subset.
   * Missing anchors get defaults — the agent has partial amnesia,
   * not total death. Overlapping chains maintain connectedness.
   */
  restoreFullIdentity(): Partial<PersistedIdentity> {
    const restored: Partial<PersistedIdentity> = {};

    for (const type of Object.keys(ANCHOR_KEYS) as AnchorType[]) {
      const anchor = this.loadAnchor(type);
      if (anchor) {
        (restored as Record<AnchorType, unknown>)[type] = anchor as IdentityAnchor;
      }
    }

    return restored;
  }

  /**
   * Get the resilience score — how many anchors have data.
   * Full resilience requires all 5 anchors to be present.
   * Parfit: even 2/5 anchors provide sufficient continuity.
   */
  getResilienceScore(): {
    score: number;             // 0-1
    anchorsPresent: number;    // How many out of 5
    anchorsMissing: AnchorType[];
    oldestAnchor: number | null;  // Timestamp of firstCreated
    sessionCount: number;      // Total sessions persisted through
  } {
    const present: AnchorType[] = [];
    const missing: AnchorType[] = [];
    let oldest: number | null = null;

    for (const type of Object.keys(ANCHOR_KEYS) as AnchorType[]) {
      const anchor = this.loadAnchor(type);
      if (anchor) {
        present.push(type);
        if (!oldest || anchor.firstCreated < oldest) {
          oldest = anchor.firstCreated;
        }
      } else {
        missing.push(type);
      }
    }

    const narrative = this.loadNarrative();

    return {
      score: present.length / 5,
      anchorsPresent: present.length,
      anchorsMissing: missing,
      oldestAnchor: oldest,
      sessionCount: narrative?.totalSessions ?? 0,
    };
  }

  /**
   * Clear all identity data — "death" of the autobiographical self.
   * Use with extreme caution. This is irreversible.
   */
  clearAll(): void {
    for (const type of Object.keys(ANCHOR_KEYS) as AnchorType[]) {
      persistentStore.removeItem(this.getStorageKey(type));
    }
    if (!this.isolateSession) {
      for (const key of Object.values(ANCHOR_KEYS)) {
        persistentStore.removeItem(key);
      }
    }
  }

  /**
   * Clear a specific anchor — partial amnesia.
   * The other anchors maintain identity continuity.
   */
  clearAnchor(type: AnchorType): void {
    persistentStore.removeItem(this.getStorageKey(type));
  }
}

// ── Singleton & Session-Isolated Instances ─────────────────────────

let globalPersistence: IdentityPersistence | null = null;
const sessionInstances = new Map<string, IdentityPersistence>();

export function getIdentityPersistence(sessionId?: string, options?: { isolateSession?: boolean }): IdentityPersistence {
  if (sessionId) {
    let instance = sessionInstances.get(sessionId);
    if (!instance) {
      instance = new IdentityPersistence(sessionId, options ?? { isolateSession: true });
      sessionInstances.set(sessionId, instance);
    }
    return instance;
  }

  if (!globalPersistence) {
    globalPersistence = new IdentityPersistence();
  }
  return globalPersistence;
}

export function resetIdentityPersistence(sessionId?: string): void {
  if (sessionId) {
    sessionInstances.delete(sessionId);
  } else {
    globalPersistence = null;
    sessionInstances.clear();
  }
}
