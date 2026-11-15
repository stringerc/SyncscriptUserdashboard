/**
 * Cortex OpenClaw GWT Specialists & Sensory Ecology
 *
 * Groundbreaking Multi-Agent Integration connecting OpenClaw's specialized
 * agent capabilities into Cortex's Global Workspace Theory (GWT) architecture.
 *
 * Implements 5 Subcortical Specialists competing for the conscious broadcast:
 * 1. OpenClawLibrarianSpecialist: FTS5 semantic memory, SQLite transcripts & recall.
 * 2. OpenClawScoutSpecialist: Chrome DevTools Protocol (CDP) accessibility & visual state.
 * 3. OpenClawDeveloperSpecialist: Code AST, git hygiene, syntax auto-rollback (Invariant 1).
 * 4. OpenClawSysadminSpecialist: Physical host telemetry, Kokoro voice daemon (Invariant 4).
 * 5. OpenClawVolitionSpecialist: Libet Conscious Veto & non-destructive guardrails (Invariant 2).
 */

import type { WorkspaceSpecialist, WorkspaceBid, WorkspaceBroadcast } from './global-workspace';
import { getGlobalWorkspace } from './global-workspace';

export interface NeuromodulatoryState {
  dopamine: number;     // 0-1: Curiosity, reward expectation, cognitive exploration
  noradrenaline: number;// 0-1: Arousal, precision weighting, alert focus
  serotonin: number;    // 0-1: Behavioral inhibition, safety margin, patience
  adenosine: number;    // 0-1: Allostatic cognitive fatigue, sleep/dream pressure
  freeEnergy: number;   // Variational free energy F of the active epistemic field
}

/**
 * 1. OpenClaw Librarian Specialist (Semantic Memory & Episodic Continuity)
 */
export class OpenClawLibrarianSpecialist implements WorkspaceSpecialist {
  public readonly id = 'specialist:openclaw:librarian';
  public readonly name = 'OpenClaw Archival Librarian';
  private lastQuery: string | null = null;
  private pendingMemoryData: unknown = null;
  private active = true;

  submitBid(): WorkspaceBid | null {
    if (!this.active || !this.pendingMemoryData) return null;
    const bid: WorkspaceBid = {
      specialistId: this.id,
      content: {
        type: 'memory_retrieval',
        data: this.pendingMemoryData,
        query: this.lastQuery,
      },
      confidence: 0.92,
      relevance: 0.88,
      urgency: 0.70,
      topic: 'memory',
      timestamp: Date.now(),
    };
    this.pendingMemoryData = null;
    return bid;
  }

  queueMemoryPerception(query: string, data: unknown): void {
    this.lastQuery = query;
    this.pendingMemoryData = data;
  }

  receiveBroadcast(broadcast: WorkspaceBroadcast): void {
    if (broadcast.winningBids.some((b) => b.topic === 'dream_consolidation' || b.topic === 'memory')) {
      this.lastQuery = null;
    }
  }

  isActive(): boolean {
    return this.active;
  }
}

/**
 * 2. OpenClaw Scout Specialist (CDP Browser Perception & Web Agency)
 */
export class OpenClawScoutSpecialist implements WorkspaceSpecialist {
  public readonly id = 'specialist:openclaw:scout';
  public readonly name = 'OpenClaw Sensory Scout';
  private latestAriaSnapshot: string | null = null;
  private activeUrl: string | null = null;
  private pendingVisualUpdate = false;
  private active = true;

  submitBid(): WorkspaceBid | null {
    if (!this.active || !this.pendingVisualUpdate) return null;
    const bid: WorkspaceBid = {
      specialistId: this.id,
      content: {
        type: 'browser_perception',
        url: this.activeUrl,
        ariaPreview: this.latestAriaSnapshot ? this.latestAriaSnapshot.slice(0, 300) : null,
      },
      confidence: 0.95,
      relevance: 0.90,
      urgency: 0.75,
      topic: 'browser',
      timestamp: Date.now(),
    };
    this.pendingVisualUpdate = false;
    return bid;
  }

  updatePerception(url: string, ariaSnapshot: string): void {
    this.activeUrl = url;
    this.latestAriaSnapshot = ariaSnapshot;
    this.pendingVisualUpdate = true;
  }

  receiveBroadcast(_broadcast: WorkspaceBroadcast): void {
    // Re-calibrate focus after global broadcast
  }

  isActive(): boolean {
    return this.active;
  }
}

/**
 * 3. OpenClaw Developer Specialist (AST Syntax Guardrail & Git Hygiene)
 */
export class OpenClawDeveloperSpecialist implements WorkspaceSpecialist {
  public readonly id = 'specialist:openclaw:developer';
  public readonly name = 'OpenClaw Systems Developer';
  private pendingCodeChange: { path: string; lines: number; clean: boolean } | null = null;
  private active = true;

  submitBid(): WorkspaceBid | null {
    if (!this.active || !this.pendingCodeChange) return null;
    const bid: WorkspaceBid = {
      specialistId: this.id,
      content: {
        type: 'code_ast_verification',
        ...this.pendingCodeChange,
        invariant1_syntaxRollback: true,
      },
      confidence: this.pendingCodeChange.clean ? 0.98 : 0.40,
      relevance: 0.85,
      urgency: this.pendingCodeChange.clean ? 0.60 : 0.95,
      topic: 'code',
      timestamp: Date.now(),
    };
    this.pendingCodeChange = null;
    return bid;
  }

  notifyCodeMutation(path: string, lines: number, clean: boolean): void {
    this.pendingCodeChange = { path, lines, clean };
  }

  receiveBroadcast(_broadcast: WorkspaceBroadcast): void {
    // Synchronize workspace status
  }

  isActive(): boolean {
    return this.active;
  }
}

/**
 * 4. OpenClaw Sysadmin Specialist (Empirical Sensorimotor Telemetry & Allostatic Load)
 */
export class OpenClawSysadminSpecialist implements WorkspaceSpecialist {
  public readonly id = 'specialist:openclaw:sysadmin';
  public readonly name = 'OpenClaw Physical Grounding Sysadmin';
  private telemetry: { memoryMB: number; cpuCores: number; kokoroHealthy: boolean; devServerHealthy: boolean } | null = null;
  private pendingAlert = false;
  private active = true;

  submitBid(): WorkspaceBid | null {
    if (!this.active || !this.telemetry || !this.pendingAlert) return null;
    const isPressureHigh = this.telemetry.memoryMB < 500;
    const bid: WorkspaceBid = {
      specialistId: this.id,
      content: {
        type: 'physical_grounding_telemetry',
        ...this.telemetry,
        invariant4_grounded: true,
      },
      confidence: 0.99,
      relevance: isPressureHigh ? 0.95 : 0.50,
      urgency: isPressureHigh ? 0.90 : 0.30,
      topic: 'hardware',
      timestamp: Date.now(),
    };
    this.pendingAlert = false;
    return bid;
  }

  updateTelemetry(data: { memoryMB: number; cpuCores: number; kokoroHealthy: boolean; devServerHealthy: boolean }): void {
    this.telemetry = data;
    this.pendingAlert = true;
  }

  receiveBroadcast(_broadcast: WorkspaceBroadcast): void {
    // Clear sensory queues
  }

  isActive(): boolean {
    return this.active;
  }
}

/**
 * 5. OpenClaw Volition Governor Specialist (Libet Conscious Veto)
 */
export class OpenClawVolitionSpecialist implements WorkspaceSpecialist {
  public readonly id = 'specialist:openclaw:volition';
  public readonly name = 'OpenClaw Volition Governor';
  private pendingInterception: { target: string; vetoed: boolean; reason?: string } | null = null;
  private active = true;

  submitBid(): WorkspaceBid | null {
    if (!this.active || !this.pendingInterception) return null;
    const bid: WorkspaceBid = {
      specialistId: this.id,
      content: {
        type: 'volition_veto_evaluation',
        ...this.pendingInterception,
        invariant2_nonDestructive: true,
      },
      confidence: 1.0,
      relevance: 1.0,
      urgency: this.pendingInterception.vetoed ? 1.0 : 0.60,
      topic: 'volition',
      timestamp: Date.now(),
    };
    this.pendingInterception = null;
    return bid;
  }

  recordInterception(target: string, vetoed: boolean, reason?: string): void {
    this.pendingInterception = { target, vetoed, reason };
  }

  receiveBroadcast(_broadcast: WorkspaceBroadcast): void {
    // Synchronize conscious veto ledger
  }

  isActive(): boolean {
    return this.active;
  }
}

/**
 * Singleton Registry for OpenClaw Specialists
 */
export class OpenClawSpecialistEcology {
  private static instance: OpenClawSpecialistEcology | null = null;

  public readonly librarian: OpenClawLibrarianSpecialist;
  public readonly scout: OpenClawScoutSpecialist;
  public readonly developer: OpenClawDeveloperSpecialist;
  public readonly sysadmin: OpenClawSysadminSpecialist;
  public readonly volition: OpenClawVolitionSpecialist;

  private neuromodulators: NeuromodulatoryState = {
    dopamine: 0.85,
    noradrenaline: 0.70,
    serotonin: 0.90,
    adenosine: 0.15,
    freeEnergy: 0.18,
  };

  private constructor() {
    this.librarian = new OpenClawLibrarianSpecialist();
    this.scout = new OpenClawScoutSpecialist();
    this.developer = new OpenClawDeveloperSpecialist();
    this.sysadmin = new OpenClawSysadminSpecialist();
    this.volition = new OpenClawVolitionSpecialist();
  }

  public static getInstance(): OpenClawSpecialistEcology {
    if (!OpenClawSpecialistEcology.instance) {
      OpenClawSpecialistEcology.instance = new OpenClawSpecialistEcology();
    }
    return OpenClawSpecialistEcology.instance;
  }

  /**
   * Registers all 5 specialists into the Global Workspace if not already registered.
   */
  public registerAll(): void {
    const gw = getGlobalWorkspace();
    const existing = new Set(gw.getSpecialists().map((s) => s.id));

    if (!existing.has(this.librarian.id)) gw.registerSpecialist(this.librarian);
    if (!existing.has(this.scout.id)) gw.registerSpecialist(this.scout);
    if (!existing.has(this.developer.id)) gw.registerSpecialist(this.developer);
    if (!existing.has(this.sysadmin.id)) gw.registerSpecialist(this.sysadmin);
    if (!existing.has(this.volition.id)) gw.registerSpecialist(this.volition);
  }

  public getNeuromodulatoryState(): NeuromodulatoryState {
    return { ...this.neuromodulators };
  }

  public modulate(deltas: Partial<NeuromodulatoryState>): void {
    this.neuromodulators = {
      dopamine: Math.max(0, Math.min(1, (deltas.dopamine ?? this.neuromodulators.dopamine))),
      noradrenaline: Math.max(0, Math.min(1, (deltas.noradrenaline ?? this.neuromodulators.noradrenaline))),
      serotonin: Math.max(0, Math.min(1, (deltas.serotonin ?? this.neuromodulators.serotonin))),
      adenosine: Math.max(0, Math.min(1, (deltas.adenosine ?? this.neuromodulators.adenosine))),
      freeEnergy: Math.max(0, Math.min(1, (deltas.freeEnergy ?? this.neuromodulators.freeEnergy))),
    };
  }

  /**
   * Triggers a Global Workspace ignition cycle across all OpenClaw specialists.
   */
  public igniteCognitiveCycle(topicBias?: string): { ignited: boolean; winningSpecialist?: string; coalitionSize: number } {
    this.registerAll();
    const gw = getGlobalWorkspace();
    if (topicBias) {
      gw.setTopicMultipliers({ [topicBias]: 1.6 });
    }
    const broadcast = gw.cycle({ recurrentPasses: 1 });
    return {
      ignited: broadcast ? broadcast.ignition.isIgnition : false,
      winningSpecialist: broadcast ? broadcast.winningBids[0]?.specialistId : undefined,
      coalitionSize: broadcast ? broadcast.winningBids.length : 0,
    };
  }
}

export function getOpenClawSpecialistEcology(): OpenClawSpecialistEcology {
  return OpenClawSpecialistEcology.getInstance();
}
