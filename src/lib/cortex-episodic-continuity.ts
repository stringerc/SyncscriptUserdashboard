/**
 * Cortex Cross-Session Episodic Continuity Engine (cortex-episodic-continuity.ts)
 *
 * Preserves episodic memory threads, operator intent context, and unresolved open loops
 * across application restarts, tab reloads, and multi-session deployments.
 *
 * Core Capabilities:
 * 1. Open Loop Tracking: Registers, monitors, and resolves cross-session tasks and pending goals.
 * 2. Multi-Session Checkpoint Synthesis: Generates compact contextual envelopes of recent accomplishments
 *    and operational state for immediate warm restart.
 * 3. Durable Storage: Integrates with persistentStore with transparent IndexedDB backing.
 */

import { persistentStore } from './persistent-store';

// ── Types ──────────────────────────────────────────────────────────

export type LoopPriority = 'high' | 'normal' | 'low';

export interface ThreadOpenLoop {
  id: string;
  title: string;
  priority: LoopPriority;
  status: 'active' | 'resolved';
  context: Record<string, any>;
  createdAt: number;
  resolvedAt?: number;
  resolutionSummary?: string;
}

export interface EpisodicCheckpoint {
  id: string;
  sessionId: string;
  timestamp: number;
  dominantTopic: string;
  activeOpenLoops: ThreadOpenLoop[];
  recentAccomplishments: string[];
  resonanceScore: number;
  freeEnergy: number;
}

const STORAGE_KEY = 'cortex:episodic:continuity:v1';

// ── Engine Implementation ──────────────────────────────────────────

export class CortexEpisodicContinuityEngine {
  private openLoops: Map<string, ThreadOpenLoop> = new Map();
  private checkpoints: EpisodicCheckpoint[] = [];
  private maxCheckpoints: number;

  constructor(options?: { maxCheckpoints?: number }) {
    this.maxCheckpoints = options?.maxCheckpoints || 50;
    this.loadState();
  }

  private loadState(): void {
    try {
      const raw = persistentStore.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.openLoops)) {
          for (const loop of parsed.openLoops) {
            this.openLoops.set(loop.id, loop);
          }
        }
        if (Array.isArray(parsed.checkpoints)) {
          this.checkpoints = parsed.checkpoints;
        }
      }
    } catch {}
  }

  private saveState(): void {
    try {
      const payload = {
        openLoops: Array.from(this.openLoops.values()),
        checkpoints: this.checkpoints.slice(-this.maxCheckpoints),
        updatedAt: Date.now(),
      };
      persistentStore.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {}
  }

  /**
   * Registers a new open loop or unresolved goal that spans cross-session boundaries.
   */
  public registerOpenLoop(
    title: string,
    priority: LoopPriority = 'normal',
    context: Record<string, any> = {}
  ): ThreadOpenLoop {
    const loopId = `loop-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const loop: ThreadOpenLoop = {
      id: loopId,
      title: title.trim(),
      priority,
      status: 'active',
      context,
      createdAt: Date.now(),
    };

    this.openLoops.set(loopId, loop);
    this.saveState();
    return loop;
  }

  /**
   * Resolves an open loop with an epistemic summary of what was accomplished.
   */
  public resolveOpenLoop(loopId: string, resolutionSummary: string): boolean {
    const loop = this.openLoops.get(loopId);
    if (!loop) return false;

    loop.status = 'resolved';
    loop.resolvedAt = Date.now();
    loop.resolutionSummary = resolutionSummary.trim();

    this.saveState();
    return true;
  }

  /**
   * Retrieves all currently active open loops.
   */
  public getActiveOpenLoops(): ThreadOpenLoop[] {
    return Array.from(this.openLoops.values()).filter(l => l.status === 'active');
  }

  /**
   * Captures an episodic checkpoint representing the operational gestalt of the current session.
   */
  public captureCheckpoint(options?: {
    sessionId?: string;
    dominantTopic?: string;
    recentAccomplishments?: string[];
    resonanceScore?: number;
    freeEnergy?: number;
  }): EpisodicCheckpoint {
    const checkpoint: EpisodicCheckpoint = {
      id: `ckpt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sessionId: options?.sessionId || 'default-session',
      timestamp: Date.now(),
      dominantTopic: options?.dominantTopic || 'General operations',
      activeOpenLoops: this.getActiveOpenLoops(),
      recentAccomplishments: options?.recentAccomplishments || [],
      resonanceScore: options?.resonanceScore ?? 0,
      freeEnergy: options?.freeEnergy ?? 0,
    };

    this.checkpoints.push(checkpoint);
    if (this.checkpoints.length > this.maxCheckpoints) {
      this.checkpoints.shift();
    }

    this.saveState();
    return checkpoint;
  }

  /**
   * Restores recent continuity state to warm-start a fresh session or chat.
   */
  public restoreContinuity(sessionId?: string): EpisodicCheckpoint | null {
    if (this.checkpoints.length === 0) {
      return this.captureCheckpoint({ sessionId });
    }

    if (sessionId) {
      const match = [...this.checkpoints].reverse().find(c => c.sessionId === sessionId);
      if (match) return match;
    }

    return this.checkpoints[this.checkpoints.length - 1];
  }

  public clear(): void {
    this.openLoops.clear();
    this.checkpoints = [];
    this.saveState();
  }
}

// ── Global Singleton ───────────────────────────────────────────────

let globalContinuityEngine: CortexEpisodicContinuityEngine | null = null;

export function getCortexEpisodicContinuity(): CortexEpisodicContinuityEngine {
  if (!globalContinuityEngine) {
    globalContinuityEngine = new CortexEpisodicContinuityEngine();
  }
  return globalContinuityEngine;
}

