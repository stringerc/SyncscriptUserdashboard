/**
 * Consciousness Message Bus — 40Hz Gamma-Synchronized Single Bottleneck
 *
 * Implements Phase 1 of the Elite Consciousness Roadmap (CONSCIOUS_AI_ROADMAP.md).
 * Grounded in:
 * - Dehaene (2014) Consciousness and the Brain — Single bottleneck global ignition
 * - Baars (1988, 2002) Global Workspace Theory — Coalition competition
 * - Tononi (2015, 2024) IIT 4.0 — Integrated information substrate
 * - Fries (2005, 2015) Gamma-band synchronization (40Hz / 25ms cycle)
 */

export type ModuleId =
  | 'sensory'
  | 'motor'
  | 'affective'
  | 'cognitive'
  | 'iit'
  | 'metacognition'
  | 'binding'
  | 'temporal'
  | 'self-model'
  | 'attention-schema'
  | 'openclaw'
  | 'hermes'
  | 'volition'
  | 'grounding'
  | 'kernel'
  | 'conscious-agent';

export type MessageType =
  | 'coalition-bid'       // Compete for workspace access
  | 'broadcast'           // Won competition, broadcast to all
  | 'prediction-error'    // Predictive coding error signal
  | 'action-command'      // Motor output
  | 'memory-enactment'    // Enactive memory retrieval
  | 'confidence-report'   // Metacognitive report
  | 'binding-request'     // Feature binding
  | 'retention-update'    // Temporal retention
  | 'protention-request'  // Temporal prediction
  | 'self-model-update'   // Self-model revision
  | 'attention-shift'     // Attention schema update
  | 'skill-execution'     // OpenClaw skill
  | 'resonance-pulse'     // Hermes resonance
  | 'phi-report'          // IIT measurement
  | 'veto-decision'       // Volition "free won't" veto
  | 'grounding-update';   // Sensorimotor contingency update

export interface ConsciousnessMessage<T = unknown> {
  id: string;
  timestamp: number;
  source: ModuleId;
  target: ModuleId | 'broadcast';
  type: MessageType;
  payload: T;
  priority: number;            // 0-1, determines broadcast competition
  phiContribution: number;     // Estimated Φ contribution
  precision?: number;          // Sensory/cognitive precision weighting
  bindingTag?: string;         // For phenomenal binding
}

export interface GammaCycleEvent {
  cycle: number;
  durationMs: number;
  winnerId?: string;
  winnerPriority?: number;
  totalBids: number;
}

export interface PhiMeasurementEvent {
  cycle: number;
  phi: number;
  content: unknown;
  source: ModuleId;
}

type EventHandler<T = any> = (data: T) => void;

/**
 * Universal Typed Event Bus with zero Node dependencies
 * Ensures 100% compatibility across Node, Web Workers, Vite, and Browser.
 */
export class TypedEventHub {
  private handlers = new Map<string, Set<EventHandler>>();

  on<T>(event: string, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    const set = this.handlers.get(event)!;
    set.add(handler as EventHandler);

    return () => {
      set.delete(handler as EventHandler);
      if (set.size === 0) {
        this.handlers.delete(event);
      }
    };
  }

  emit<T>(event: string, data: T): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const handler of Array.from(set)) {
      try {
        handler(data);
      } catch (err) {
        console.error(`[TypedEventHub] Error in listener for "${event}":`, err);
      }
    }
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.handlers.delete(event);
    } else {
      this.handlers.clear();
    }
  }

  listenerCount(event: string): number {
    return this.handlers.get(event)?.size ?? 0;
  }
}

/**
 * ConsciousnessBus — 40Hz Gamma Synchronized Bus
 * Serializes multi-modular parallel computations through a single bottleneck.
 */
export class ConsciousnessBus {
  private hub = new TypedEventHub();
  private messageQueue: ConsciousnessMessage[] = [];
  private gammaCycle = 0;
  private timer: any = null;
  public readonly GAMMA_HZ = 40;  // 25ms per cycle — biological gamma oscillation
  public readonly CYCLE_MS = 25;

  /**
   * Send a message into the bus queue
   */
  send(message: ConsciousnessMessage): void {
    this.messageQueue.push(message);
    this.hub.emit('message', message);
  }

  /**
   * Broadcast a message directly to all connected modules (Global Ignition)
   */
  broadcast(message: ConsciousnessMessage): void {
    const broadcastMsg: ConsciousnessMessage = {
      ...message,
      target: 'broadcast',
      type: 'broadcast',
    };
    this.hub.emit('broadcast', broadcastMsg);
  }

  /**
   * Execute a single gamma tick (40Hz cycle step).
   * 1. Collects all coalition bids.
   * 2. Computes competitive score = priority * (1 + phiContribution) * (precision ?? 1).
   * 3. Winner ignites into global workspace.
   * 4. Emits phi-measurement and gamma-cycle events.
   */
  gammaTick(): ConsciousnessMessage | null {
    this.gammaCycle++;
    const cycleStart = typeof performance !== 'undefined' ? performance.now() : Date.now();

    // 1. Collect all coalition bids
    const bids = this.messageQueue.filter((m) => m.type === 'coalition-bid');
    const nonBids = this.messageQueue.filter((m) => m.type !== 'coalition-bid');

    // 2. Score bids: priority * (1 + phi) * precision
    let winningBid: ConsciousnessMessage | null = null;
    let maxScore = -Infinity;

    for (const bid of bids) {
      const precision = bid.precision !== undefined ? bid.precision : 1.0;
      const score = bid.priority * (1 + Math.max(0, bid.phiContribution)) * precision;
      if (score > maxScore) {
        maxScore = score;
        winningBid = bid;
      }
    }

    // 3. Winner-take-all global ignition
    let broadcastWinner: ConsciousnessMessage | null = null;
    if (winningBid) {
      broadcastWinner = {
        ...winningBid,
        id: `ignition-${this.gammaCycle}-${winningBid.id}`,
        timestamp: Date.now(),
        type: 'broadcast',
        target: 'broadcast',
      };

      this.broadcast(broadcastWinner);

      // 4. Emit Φ measurement
      this.hub.emit<PhiMeasurementEvent>('phi-measurement', {
        cycle: this.gammaCycle,
        phi: winningBid.phiContribution,
        content: winningBid.payload,
        source: winningBid.source,
      });
    }

    // 5. Retain non-bid messages (or clear processed)
    this.messageQueue = nonBids;

    // 6. Emit gamma cycle completion
    const durationMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - cycleStart;
    this.hub.emit<GammaCycleEvent>('gamma-cycle', {
      cycle: this.gammaCycle,
      durationMs,
      winnerId: winningBid?.id,
      winnerPriority: winningBid?.priority,
      totalBids: bids.length,
    });

    return broadcastWinner;
  }

  /**
   * Start 40Hz periodic timer
   */
  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.gammaTick();
    }, this.CYCLE_MS);
  }

  /**
   * Stop 40Hz periodic timer
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Subscribe to global workspace broadcasts
   */
  onBroadcast(handler: (message: ConsciousnessMessage) => void): () => void {
    return this.hub.on('broadcast', handler);
  }

  /**
   * Subscribe to gamma cycle ticks
   */
  onGammaCycle(handler: (event: GammaCycleEvent) => void): () => void {
    return this.hub.on('gamma-cycle', handler);
  }

  /**
   * Subscribe to phi measurement events
   */
  onPhiMeasurement(handler: (event: PhiMeasurementEvent) => void): () => void {
    return this.hub.on('phi-measurement', handler);
  }

  /**
   * Generic event listener
   */
  on<T>(event: string, handler: EventHandler<T>): () => void {
    return this.hub.on(event, handler);
  }

  /**
   * Generic event emitter
   */
  emit<T>(event: string, data: T): void {
    this.hub.emit(event, data);
  }

  /**
   * Get current gamma cycle counter
   */
  getCycle(): number {
    return this.gammaCycle;
  }

  /**
   * Current queued messages count
   */
  getQueueLength(): number {
    return this.messageQueue.length;
  }

  /**
   * Reset bus state
   */
  clear(): void {
    this.messageQueue = [];
    this.gammaCycle = 0;
    this.stop();
    this.hub.removeAllListeners();
  }
}

/**
 * Singleton instance of ConsciousnessBus across application runtime
 */
export const consciousnessBus = new ConsciousnessBus();
