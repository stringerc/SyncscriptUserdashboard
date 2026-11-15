/**
 * Global Workspace — competitive access, fixed capacity, broadcast.
 *
 * Two distinct mechanisms live here, and conflating them is what broke this
 * file before. A previous cleanup pass renamed `consciousness-blackboard.ts`
 * onto this path, silently replacing the workspace with the ambient bus and
 * removing the protocol six consumers depend on.
 *
 *   1. Ambient bus (`write` / `read`) — a keyed board any module can poll.
 *      Useful, and genuinely just a Map. It is NOT Global Workspace Theory.
 *
 *   2. Global workspace (`registerSpecialist` / `cycle`) — specialists submit
 *      bids each cycle, bids compete on salience, a fixed number of slots
 *      admits a coalition, and the winning content is broadcast to every
 *      registered specialist. That is the GWT mechanism.
 *
 * On ignition: the broadcast event is recorded with a spread/salience
 * signature because it is a useful engineering observable for a
 * capacity-limited bus. It is NOT treated here as a consciousness marker.
 * The Cogitate Consortium's preregistered adversarial test (Nature 642:133-142,
 * 2025) failed to find the prefrontal ignition that GNWT predicted, so
 * "ignition occurred" is evidence about this bus and nothing more.
 *
 * On lesions: `'access'` is the scientifically useful mode. It performs every
 * step of a normal cycle — bid collection, scoring, coalition selection,
 * dispatch to every specialist — but the broadcast content is decoupled from
 * the current cycle. Compute is therefore matched, which is what rules out
 * "the lesioned arm simply did less work." `'off'` is not compute-matched and
 * exists only for the older callers that pass a boolean.
 */

// ── Ambient bus ────────────────────────────────────────────────────

export type BlackboardKey =
  | 'collapse'      // ActionGate latest state
  | 'coherence'     // SemanticGrid latest state
  | 'resonance'     // ResonanceCalculus latest score
  | 'metaAwareness' // Meta-awareness status
  | 'reality'       // Epistemic reality score
  | 'embodiment'    // Embodiment mastery score
  | 'identity'      // Identity resilience score
  | 'deployment'    // Deployment / environment posture
  | 'health';       // Overall metacognitive health

export interface BlackboardEntry {
  key: BlackboardKey;
  value: unknown;
  timestamp: number;
  source: string;
  confidence: number;
}

type BlackboardListener = (key: BlackboardKey, entry: BlackboardEntry) => void;

// ── Workspace protocol ─────────────────────────────────────────────

/** A bid for access to the workspace's limited broadcast slots. */
export interface WorkspaceBid {
  specialistId: string;
  content: unknown;
  /** How sure the specialist is of its content, 0-1. */
  confidence: number;
  /** How pertinent the specialist believes it is right now, 0-1. */
  relevance: number;
  /** How time-critical, 0-1. Urgency can win against higher confidence. */
  urgency: number;
  topic: string;
  timestamp: number;
}

/** A parallel processor that competes for, and receives, broadcasts. */
export interface WorkspaceSpecialist {
  id: string;
  name: string;
  /** Return null to abstain from this cycle. */
  submitBid(): WorkspaceBid | null;
  receiveBroadcast(broadcast: WorkspaceBroadcast): void;
  isActive(): boolean;
}

/** Observable signature of a broadcast event. Not a consciousness marker. */
export interface IgnitionSignature {
  cycleId: number;
  timestamp: number;
  /** Bids admitted to the coalition. */
  coalitionSize: number;
  /** Specialists the broadcast reached. */
  spread: number;
  peakSalience: number;
  latencyMs: number;
  /** Whether this cycle met the threshold for a widespread event. */
  isIgnition: boolean;
  /**
   * True when the event matches what GWT predicts of a broadcast: a
   * multi-specialist coalition, above the salience floor, delivered to every
   * active specialist, and carrying content from the current cycle.
   *
   * Read this as "conforms to the architectural prediction," not as evidence
   * of consciousness. The equivalent prediction in humans (prefrontal
   * ignition) was not confirmed by Cogitate's preregistered test.
   */
  isGwtConsistent: boolean;
}

export interface WorkspaceBroadcast {
  cycleId: number;
  winningBids: WorkspaceBid[];
  /** Winning content keyed by topic — what a read-out module can consume. */
  content: Record<string, unknown>;
  recipientCount: number;
  ignitionLatencyMs: number;
  ignitionSpread: number;
  timestamp: number;
  ignition: IgnitionSignature;
  /** True when this content was decoupled from the current cycle. */
  decoupled: boolean;
}

export interface SpecialistRegistration {
  specialist: WorkspaceSpecialist;
  registeredAt: number;
  lastActiveAt: number;
  bidsSubmitted: number;
  bidsWon: number;
  broadcastsReceived: number;
}

export type LesionMode = 'none' | 'access' | 'capacity' | 'off';

const DEFAULT_CAPACITY = 3;
const MIN_SALIENCE_TO_COMPETE = 0.15;
const IGNITION_SALIENCE_THRESHOLD = 0.45;
const MAX_HISTORY = 200;

/**
 * Salience is what bids compete on. Base weights are fixed and declared
 * here. An optional topic multiplier (from the attention schema) scales
 * the result — that is the pathway by which the schema steers competition
 * without rewriting specialist code.
 */
export function bidSalience(bid: WorkspaceBid, topicMultiplier = 1): number {
  const base = 0.4 * bid.confidence + 0.35 * bid.relevance + 0.25 * bid.urgency;
  const mult = Math.max(0.1, Math.min(3, topicMultiplier));
  return Math.max(0, Math.min(1, base * mult));
}

export interface CycleOptions {
  /**
   * Number of competition→broadcast passes within this call. Default 1.
   * Passes > 1 implement recurrent processing: after each broadcast,
   * specialists update internal state and re-bid, so pass 2 is not a
   * feedforward re-execution of the same inputs — it is feedback that can
   * alter who wins. Count is capped to 4 so tests cannot spin forever.
   */
  recurrentPasses?: number;
}

export class GlobalWorkspace {
  // Ambient bus
  private board = new Map<BlackboardKey, BlackboardEntry>();
  private listeners = new Set<BlackboardListener>();

  // Workspace
  private specialists = new Map<string, SpecialistRegistration>();
  private broadcastHistory: WorkspaceBroadcast[] = [];
  private ignitionHistory: IgnitionSignature[] = [];
  private cycleCounter = 0;
  private capacity = DEFAULT_CAPACITY;
  private lesion: LesionMode = 'none';
  /** Retained so an access lesion can deliver content from a prior cycle. */
  private lastCoalition: WorkspaceBid[] = [];
  /**
   * Topic → salience multiplier for the next cycle(s). Set by the attention
   * schema so its model of attention can steer actual competition. Defaults
   * mean "no bias" (every topic multiplies by 1).
   */
  private topicMultipliers: Record<string, number> = {};
  /** Contextual broadcast gating predicates per specialist (Phase 5 GWT refinement) */
  private contextualGates = new Map<string, (broadcast: WorkspaceBroadcast) => boolean>();

  // ── Ambient bus ──────────────────────────────────────────────────

  write(key: BlackboardKey, value: unknown, source: string, confidence = 0.8): void {
    const entry: BlackboardEntry = { key, value, timestamp: Date.now(), source, confidence };
    this.board.set(key, entry);
    for (const listener of Array.from(this.listeners)) {
      try { listener(key, entry); } catch { /* a bad listener must not stop the bus */ }
    }
  }

  read(key: BlackboardKey): BlackboardEntry | undefined {
    return this.board.get(key);
  }

  readWithDefault<T>(key: BlackboardKey, defaultValue: T): T {
    const entry = this.board.get(key);
    return entry ? (entry.value as T) : defaultValue;
  }

  getAll(): Map<BlackboardKey, BlackboardEntry> {
    return new Map(this.board);
  }

  onWrite(listener: BlackboardListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  prune(maxAgeMs = 60000): void {
    const cutoff = Date.now() - maxAgeMs;
    for (const [key, entry] of this.board) {
      if (entry.timestamp < cutoff) this.board.delete(key);
    }
  }

  // ── Specialists ──────────────────────────────────────────────────

  registerSpecialist(specialist: WorkspaceSpecialist): void {
    const now = Date.now();
    const existing = this.specialists.get(specialist.id);
    this.specialists.set(specialist.id, {
      specialist,
      registeredAt: existing?.registeredAt ?? now,
      lastActiveAt: now,
      bidsSubmitted: existing?.bidsSubmitted ?? 0,
      bidsWon: existing?.bidsWon ?? 0,
      broadcastsReceived: existing?.broadcastsReceived ?? 0,
    });
  }

  unregisterSpecialist(id: string): boolean {
    return this.specialists.delete(id);
  }

  getSpecialist(id: string): WorkspaceSpecialist | undefined {
    return this.specialists.get(id)?.specialist;
  }

  getSpecialists(): WorkspaceSpecialist[] {
    return Array.from(this.specialists.values()).map((r) => r.specialist);
  }

  getRegistrations(): SpecialistRegistration[] {
    return Array.from(this.specialists.values());
  }

  // ── Capacity and lesioning ───────────────────────────────────────

  /** Number of broadcast slots. This is the attentional bottleneck. */
  setCapacity(slots: number): void {
    this.capacity = Math.max(1, Math.floor(slots));
  }

  getCapacity(): number {
    return this.lesion === 'capacity' ? 1 : this.capacity;
  }

  /**
   * `true` maps to `'off'` for backward compatibility with callers that pass
   * a boolean. Prefer `'access'` for experiments: it holds compute constant.
   */
  setLesioned(mode: boolean | LesionMode): void {
    if (mode === true) this.lesion = 'off';
    else if (mode === false) this.lesion = 'none';
    else this.lesion = mode;
  }

  getLesionMode(): LesionMode {
    return this.lesion;
  }

  isLesioned(): boolean {
    return this.lesion !== 'none';
  }

  /**
   * Bias the next competition by topic. Multipliers outside [0.1, 3] are
   * clamped at evaluation time. Passing `{}` clears the bias.
   */
  setTopicMultipliers(multipliers: Record<string, number>): void {
    this.topicMultipliers = { ...multipliers };
  }

  getTopicMultipliers(): Record<string, number> {
    return { ...this.topicMultipliers };
  }

  clearTopicMultipliers(): void {
    this.topicMultipliers = {};
  }

  private topicMultiplierFor(topic: string): number {
    const m = this.topicMultipliers[topic];
    return typeof m === 'number' && Number.isFinite(m) ? m : 1;
  }

  // ── The cycle ────────────────────────────────────────────────────

  /**
   * One or more competitions. Collects bids from every active specialist,
   * admits a coalition up to capacity, and broadcasts to all specialists.
   *
   * With `recurrentPasses > 1`, after each broadcast specialists update and
   * re-bid; later passes therefore reflect feedback, not a re-run of the
   * initial evidence alone. That is the RPT requirement this bus can host.
   *
   * Returns null only when no bid cleared the salience floor on any pass,
   * or when the workspace is fully off.
   */
  cycle(options?: CycleOptions): WorkspaceBroadcast | null {
    const passes = Math.max(1, Math.min(4, Math.floor(options?.recurrentPasses ?? 1)));
    let last: WorkspaceBroadcast | null = null;
    for (let p = 0; p < passes; p++) {
      const b = this.runCompetitionPass();
      if (b) last = b;
    }
    return last;
  }

  /** Single bid→compete→broadcast pass. */
  private runCompetitionPass(): WorkspaceBroadcast | null {
    const startedAt = Date.now();
    const cycleId = ++this.cycleCounter;

    // 1. Collect bids. Runs in every lesion mode so compute stays matched.
    const bids: WorkspaceBid[] = [];
    for (const reg of this.specialists.values()) {
      let active = false;
      try { active = reg.specialist.isActive(); } catch { active = false; }
      if (!active) continue;

      let bid: WorkspaceBid | null = null;
      try { bid = reg.specialist.submitBid(); } catch { bid = null; }
      if (!bid) continue;

      reg.bidsSubmitted++;
      reg.lastActiveAt = startedAt;
      bids.push(bid);
    }

    // 2. Compete on salience — multiply by any attention-schema bias.
    const eligible = bids
      .map((bid) => ({
        bid,
        salience: bidSalience(bid, this.topicMultiplierFor(bid.topic)),
      }))
      .filter((x) => x.salience >= MIN_SALIENCE_TO_COMPETE)
      .sort((a, b) => b.salience - a.salience);

    // 3. Form a coalition: distinct topics first, so the winning set carries
    //    complementary rather than redundant information.
    const slots = this.getCapacity();
    const coalition: WorkspaceBid[] = [];
    const admittedTopics = new Set<string>();
    for (const { bid } of eligible) {
      if (coalition.length >= slots) break;
      if (admittedTopics.has(bid.topic)) continue;
      coalition.push(bid);
      admittedTopics.add(bid.topic);
    }
    for (const { bid } of eligible) {
      if (coalition.length >= slots) break;
      if (!coalition.includes(bid)) coalition.push(bid);
    }

    if (this.lesion === 'off') {
      this.lastCoalition = coalition;
      return null;
    }
    if (coalition.length === 0) return null;

    // 4. An access lesion delivers the previous cycle's coalition: every
    //    step above still ran, but the content no longer corresponds to now.
    const decoupled = this.lesion === 'access';
    const delivered = decoupled ? this.lastCoalition : coalition;
    this.lastCoalition = coalition;

    if (delivered.length === 0) {
      // First cycle under an access lesion has no prior content to deliver.
      // Report an empty broadcast rather than silently falling through to
      // the intact path, which would understate the lesion.
      const emptySig: IgnitionSignature = {
        cycleId,
        timestamp: startedAt,
        coalitionSize: 0,
        spread: 0,
        peakSalience: 0,
        latencyMs: Date.now() - startedAt,
        isIgnition: false,
        isGwtConsistent: false,
      };
      const emptyBroadcast: WorkspaceBroadcast = {
        cycleId,
        winningBids: [],
        content: {},
        recipientCount: 0,
        ignitionLatencyMs: emptySig.latencyMs,
        ignitionSpread: 0,
        timestamp: startedAt,
        ignition: emptySig,
        decoupled: true,
      };
      this.record(emptyBroadcast, emptySig);
      return emptyBroadcast;
    }

    for (const bid of coalition) {
      const reg = this.specialists.get(bid.specialistId);
      if (reg) reg.bidsWon++;
    }

    const content: Record<string, unknown> = {};
    for (const bid of delivered) content[bid.topic] = bid.content;

    const peakSalience = delivered.reduce(
      (m, b) => Math.max(m, bidSalience(b, this.topicMultiplierFor(b.topic))),
      0,
    );
    const recipients = Array.from(this.specialists.values()).filter((r) => {
      try { return r.specialist.isActive(); } catch { return false; }
    });

    const isIgnition =
      delivered.length >= 2 &&
      recipients.length >= 2 &&
      peakSalience >= IGNITION_SALIENCE_THRESHOLD;

    const signature: IgnitionSignature = {
      cycleId,
      timestamp: startedAt,
      coalitionSize: delivered.length,
      spread: recipients.length,
      peakSalience,
      latencyMs: 0,
      isIgnition,
      isGwtConsistent: isIgnition && !decoupled && recipients.length === this.countActive(),
    };

    const broadcast: WorkspaceBroadcast = {
      cycleId,
      winningBids: delivered,
      content,
      recipientCount: recipients.length,
      ignitionLatencyMs: 0,
      ignitionSpread: recipients.length,
      timestamp: startedAt,
      ignition: signature,
      decoupled,
    };

    // 5. Broadcast to everyone, winners included (gated contextually if configured).
    for (const reg of recipients) {
      const gate = this.contextualGates.get(reg.specialist.id);
      if (gate) {
        try {
          if (!gate(broadcast)) continue; // Gated out by contextual filter
        } catch { /* gate error does not abort */ }
      }
      try {
        reg.specialist.receiveBroadcast(broadcast);
        reg.broadcastsReceived++;
      } catch { /* a failing specialist must not abort the broadcast */ }
    }

    const latency = Date.now() - startedAt;
    signature.latencyMs = latency;
    broadcast.ignitionLatencyMs = latency;

    this.record(broadcast, signature);
    return broadcast;
  }

  private countActive(): number {
    let n = 0;
    for (const reg of this.specialists.values()) {
      try { if (reg.specialist.isActive()) n++; } catch { /* inactive */ }
    }
    return n;
  }

  private record(broadcast: WorkspaceBroadcast, signature: IgnitionSignature): void {
    this.broadcastHistory.push(broadcast);
    if (this.broadcastHistory.length > MAX_HISTORY) this.broadcastHistory.shift();
    this.ignitionHistory.push(signature);
    if (this.ignitionHistory.length > MAX_HISTORY) this.ignitionHistory.shift();
  }

  // ── History ──────────────────────────────────────────────────────

  getBroadcastHistory(limit = 50): WorkspaceBroadcast[] {
    return this.broadcastHistory.slice(-limit);
  }

  getIgnitionHistory(limit = 50): IgnitionSignature[] {
    return this.ignitionHistory.slice(-limit);
  }

  getCycleCount(): number {
    return this.cycleCounter;
  }

  // ── Integration proxy ────────────────────────────────────────────

  /**
   * A participation-weighted integration proxy in [0,1]. It is NOT IIT's Φ,
   * and it is not the mutual-information measure in `integrated-information.ts`
   * either. It answers one narrow question: across recent broadcasts, what
   * fraction of the registered specialists actually got into the coalition,
   * scaled by how many specialists exist to integrate at all.
   *
   * A single specialist yields 0 because there is nothing to integrate.
   */
  computePhiApproximation(): number {
    const n = this.specialists.size;
    if (n < 2) return 0;

    const recent = this.broadcastHistory.slice(-20);
    if (recent.length === 0) return 0;

    let participationSum = 0;
    for (const b of recent) {
      const distinct = new Set(b.winningBids.map((x) => x.specialistId)).size;
      participationSum += Math.min(1, distinct / n);
    }
    const participation = participationSum / recent.length;

    // (1 − 1/n) caps the proxy below 1 and rewards having more parts.
    return Math.max(0, Math.min(1, (1 - 1 / n) * participation));
  }

  // ── Phase 5 GWT Refinements ──────────────────────────────────────

  /**
   * Sets a contextual broadcast filter for a specialist (Phase 5 GWT refinement).
   * Suppresses irrelevant broadcasts to conserve specialist attention bandwidth.
   */
  setContextualGate(
    specialistId: string,
    filter: (broadcast: WorkspaceBroadcast) => boolean
  ): void {
    this.contextualGates.set(specialistId, filter);
  }

  removeContextualGate(specialistId: string): boolean {
    return this.contextualGates.delete(specialistId);
  }

  clearContextualGates(): void {
    this.contextualGates.clear();
  }

  getContextualGateCount(): number {
    return this.contextualGates.size;
  }

  /**
   * Dynamic Capacity Recruitment (Phase 5 GWT refinement):
   * Modulates workspace capacity k dynamically based on cognitive load,
   * free energy (unpredicted surprise), or task complexity.
   * Routine execution narrows k to conserve attention; high surprise widens k (up to 5)
   * to recruit diverse specialist coalitions.
   */
  adjustCapacityDynamically(options: {
    cognitiveLoad?: number;
    freeEnergy?: number;
    taskComplexity?: number;
  }): number {
    const load = options.cognitiveLoad ?? 0.5;
    const fe = options.freeEnergy ?? 0.1;
    const complexity = options.taskComplexity ?? 0.5;
    const demand = (fe * 0.4) + (complexity * 0.4) + (load * 0.2);

    let target = DEFAULT_CAPACITY;
    if (demand > 0.7) target = 5;
    else if (demand > 0.5) target = 4;
    else if (demand > 0.3) target = 3;
    else if (demand > 0.15) target = 2;
    else target = 1;

    this.setCapacity(target);
    return target;
  }

  // ── Lifecycle ────────────────────────────────────────────────────

  reset(): void {
    this.board.clear();
    this.listeners.clear();
    this.specialists.clear();
    this.contextualGates.clear();
    this.broadcastHistory = [];
    this.ignitionHistory = [];
    this.lastCoalition = [];
    this.topicMultipliers = {};
    this.cycleCounter = 0;
    this.capacity = DEFAULT_CAPACITY;
    this.lesion = 'none';
  }
}

// ── Phase 5 GWT: Hierarchical Nested Workspace ─────────────────────

/**
 * Hierarchical Nested Workspace (Phase 5 GWT Refinement):
 * Coordinates multi-tiered specialist coalitions (local sub-workspaces)
 * whose winning bids propagate upward into the apex global workspace.
 */
export class HierarchicalNestedWorkspace {
  private localWorkspaces = new Map<string, GlobalWorkspace>();
  private apexWorkspace: GlobalWorkspace;

  constructor(apexWorkspace?: GlobalWorkspace) {
    this.apexWorkspace = apexWorkspace ?? new GlobalWorkspace();
  }

  getApexWorkspace(): GlobalWorkspace {
    return this.apexWorkspace;
  }

  createLocalWorkspace(clusterId: string, capacity = 2): GlobalWorkspace {
    const local = new GlobalWorkspace();
    local.setCapacity(capacity);
    this.localWorkspaces.set(clusterId, local);
    return local;
  }

  getLocalWorkspace(clusterId: string): GlobalWorkspace | undefined {
    return this.localWorkspaces.get(clusterId);
  }

  getAllLocalWorkspaces(): Map<string, GlobalWorkspace> {
    return new Map(this.localWorkspaces);
  }

  /**
   * Executes a hierarchical cycle:
   * 1. Runs local workspace cycles across all clusters.
   * 2. Takes winning bids from local workspaces and submits them as apex bids.
   * 3. Executes apex workspace broadcast.
   */
  executeHierarchicalCycle(): {
    localBroadcasts: Map<string, WorkspaceBroadcast | null>;
    apexBroadcast: WorkspaceBroadcast | null;
  } {
    const localBroadcasts = new Map<string, WorkspaceBroadcast | null>();

    for (const [clusterId, localWs] of this.localWorkspaces) {
      const b = localWs.cycle();
      localBroadcasts.set(clusterId, b);

      if (b && b.winningBids.length > 0) {
        const topBid = b.winningBids[0];
        const proxySpecialist: WorkspaceSpecialist = {
          id: `cluster-proxy-${clusterId}`,
          name: `Cluster Proxy: ${clusterId}`,
          submitBid: () => ({
            specialistId: `cluster-proxy-${clusterId}`,
            content: topBid.content,
            confidence: topBid.confidence,
            relevance: topBid.relevance,
            urgency: topBid.urgency,
            topic: `hierarchical-${topBid.topic}`,
            timestamp: Date.now(),
          }),
          receiveBroadcast: (apexB) => {
            localWs.write('metaAwareness', apexB.content, `apex-relay-${clusterId}`, 0.9);
          },
          isActive: () => true,
        };
        this.apexWorkspace.registerSpecialist(proxySpecialist);
      }
    }

    const apexBroadcast = this.apexWorkspace.cycle();
    return { localBroadcasts, apexBroadcast };
  }
}

// ── Singleton ──────────────────────────────────────────────────────

let globalWorkspace: GlobalWorkspace | null = null;

export function getGlobalWorkspace(): GlobalWorkspace {
  if (!globalWorkspace) globalWorkspace = new GlobalWorkspace();
  return globalWorkspace;
}

export function resetGlobalWorkspace(): void {
  if (globalWorkspace) {
    globalWorkspace.reset();
  }
  globalWorkspace = null;
}
