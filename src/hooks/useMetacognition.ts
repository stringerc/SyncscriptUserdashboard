/**
 * useMetacognition Hook
 *
 * React integration layer for the MetacognitiveState orchestrator.
 * Exposes all six Flavell components + Bentov Stack alignment to components.
 *
 * This is the "meta-level" from Nelson-Narens — components that use this hook
 * operate at the meta level, monitoring and controlling the object-level systems.
 *
 * Usage:
 *   const { snapshot, beginTask, endTask, recordObservation } = useMetacognition();
 *   <MetacognitionPanel snapshot={snapshot} />
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getMetacognitiveState,
  type MetacognitiveSnapshot,
  type MetacognitiveKnowledge,
  type MetacognitiveRegulation,
  type BentovStackAlignment,
  type TaskOutcome,
  type MetaAwarenessStatus,
} from '../lib/metacognitive-state';
import type { ActionValidationResult } from '../lib/action-gate';
import type { CollapsedResult, AgentSignal } from '../lib/semantic-grid';
import type { ResonanceScore, UserContext, TimeSlot } from '../utils/resonance-calculus';
// Task type — use inline definition matching resonance-calculus
type TaskLike = {
  id: string;
  title?: string;
  energyLevel?: 'high' | 'medium' | 'low';
  category?: string;
  scheduledTime?: string | Date | null;
  completed?: boolean;
  dueDate?: string | Date | null;
  estimatedDuration?: number;
  collaborators?: string[];
};

// ── Types ──────────────────────────────────────────────────────────

export interface MetacognitionHookResult {
  /** Full metacognitive snapshot (all knowledge + regulation + summary) */
  snapshot: MetacognitiveSnapshot | null;

  /** Flavell: Metacognitive Knowledge (self) */
  selfKnowledge: MetacognitiveKnowledge['self'] | null;

  /** Flavell: Metacognitive Knowledge (tasks) */
  taskKnowledge: MetacognitiveKnowledge['tasks'] | null;

  /** Flavell: Metacognitive Knowledge (strategies) */
  strategyKnowledge: MetacognitiveKnowledge['strategies'] | null;

  /** Flavell: Metacognitive Regulation — schooler meta-awareness */
  metaAwareness: MetaAwarenessStatus | null;

  /** Flavell: Metacognitive Regulation — overall health score (0-1) */
  overallHealth: number;

  /** Bentov Stack alignment (how well each layer is functioning) */
  bentovStack: BentovStackAlignment | null;

  /** Current dominant phase */
  dominantPhase: 'planning' | 'monitoring' | 'evaluating' | 'idle';

  /** Confidence calibration: +N = overconfident, -N = underconfident, 0 = calibrated */
  confidenceCalibration: number;

  /** Free energy estimate: lower = system is learning (predictions match reality) */
  freeEnergy: number;

  // ── Actions ──────────────────────────────────────────────────────

  /** Begin a task (enter planning phase) */
  beginTask: (params: { taskId: string; taskType: string; difficulty?: number; agent?: string }) => void;

  /** Collapse strategy superposition through the gate */
  collapseStrategy: (criteria: string[], verified: Record<string, boolean>) => ActionValidationResult;

  /** Record a monitoring observation during a task */
  recordObservation: (key: string, data: Record<string, unknown>) => void;

  /** Post an agent signal to the coherence grid */
  postAgentSignal: (signal: Omit<AgentSignal, 'timestamp'>) => CollapsedResult;

  /** Update resonance tracking during a task */
  updateResonance: (task: TaskLike, timeSlot: TimeSlot, context: UserContext) => ResonanceScore;

  /** End a task (enter evaluating phase) */
  endTask: (params: { success: boolean; strategyUsed: string; freeEnergyEstimate?: number }) => TaskOutcome;

  /** Record a collapse gate outcome */
  recordCollapseOutcome: (result: ActionValidationResult, actualOutcome: 'success' | 'failure') => void;

  /** Persist full identity to all five anchors (Damasio autobiographical self) */
  persistIdentity: () => void;

  /** Restore identity from persisted anchors on session start (Locke continuity) */
  restoreIdentity: () => {
    anchorsRestored: string[];
    anchorsMissing: string[];
    resilienceScore: number;
    narrative: unknown | null;
  };

  /** Get identity resilience score — how many anchors survive restart */
  identityResilience: { score: number; anchorsPresent: number; anchorsMissing: string[]; sessionCount: number; oldestAnchor: number | null };

  /** Force a snapshot refresh */
  refresh: () => void;
}

// ── Hook Implementation ────────────────────────────────────────────

export function useMetacognition(refreshInterval: number = 5000): MetacognitionHookResult {
  const metaRef = useRef(getMetacognitiveState());
  const [snapshot, setSnapshot] = useState<MetacognitiveSnapshot | null>(null);

  // Periodic snapshot refresh
  useEffect(() => {
    const update = () => setSnapshot(metaRef.current.getSnapshot());

    // Initial
    update();

    if (refreshInterval > 0) {
      const interval = setInterval(update, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [refreshInterval]);

  const beginTask = useCallback((params: { taskId: string; taskType: string; difficulty?: number; agent?: string }) => {
    metaRef.current.beginTask(params);
    setSnapshot(metaRef.current.getSnapshot());
  }, []);

  const collapseStrategy = useCallback((criteria: string[], verified: Record<string, boolean>): ActionValidationResult => {
    const result = metaRef.current.collapseStrategy(criteria, verified);
    setSnapshot(metaRef.current.getSnapshot());
    return result;
  }, []);

  const recordObservation = useCallback((key: string, data: Record<string, unknown>) => {
    metaRef.current.recordObservation(key, data);
    // Don't update snapshot on every observation (too frequent)
  }, []);

  const postAgentSignal = useCallback((signal: Omit<AgentSignal, 'timestamp'>): CollapsedResult => {
    const result = metaRef.current.postAgentSignal(signal);
    setSnapshot(metaRef.current.getSnapshot());
    return result;
  }, []);

  const updateResonance = useCallback((task: TaskLike, timeSlot: TimeSlot, context: UserContext): ResonanceScore => {
    const score = metaRef.current.updateResonance(task, timeSlot, context);
    // Don't update snapshot on every resonance update (frequent in polling)
    return score;
  }, []);

  const endTask = useCallback((params: { success: boolean; strategyUsed: string; freeEnergyEstimate?: number }): TaskOutcome => {
    const outcome = metaRef.current.endTask(params);
    setSnapshot(metaRef.current.getSnapshot());
    return outcome;
  }, []);

  const recordCollapseOutcome = useCallback((result: ActionValidationResult, actualOutcome: 'success' | 'failure') => {
    metaRef.current.recordCollapseOutcome(result, actualOutcome);
    setSnapshot(metaRef.current.getSnapshot());
  }, []);

  const persistIdentity = useCallback(() => {
    metaRef.current.persistIdentity();
  }, []);

  const restoreIdentity = useCallback(() => {
    const result = metaRef.current.restoreIdentity();
    setSnapshot(metaRef.current.getSnapshot());
    return result;
  }, []);

  const identityResilience = metaRef.current.getIdentityResilience();

  // Auto-persist every 30 seconds during active sessions
  useEffect(() => {
    const interval = setInterval(() => {
      metaRef.current.persistIdentity();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Persist on unmount (session end)
  useEffect(() => {
    return () => {
      metaRef.current.persistIdentity();
    };
  }, []);

  const refresh = useCallback(() => {
    setSnapshot(metaRef.current.getSnapshot());
  }, []);

  return {
    snapshot,
    selfKnowledge: snapshot?.knowledge.self ?? null,
    taskKnowledge: snapshot?.knowledge.tasks ?? null,
    strategyKnowledge: snapshot?.knowledge.strategies ?? null,
    metaAwareness: snapshot?.regulation.monitoring.metaAwarenessStatus ?? null,
    overallHealth: snapshot?.summary.overallMetacognitiveHealth ?? 0.5,
    bentovStack: snapshot?.summary.bentovStackAlignment ?? null,
    dominantPhase: snapshot?.summary.dominantPhase ?? 'idle',
    confidenceCalibration: snapshot?.knowledge.self.confidenceCalibration ?? 0,
    freeEnergy: snapshot?.regulation.evaluating.lastFreeEnergyEstimate ?? 0.5,
    identityResilience,

    beginTask,
    collapseStrategy,
    recordObservation,
    postAgentSignal,
    updateResonance,
    endTask,
    recordCollapseOutcome,
    persistIdentity,
    restoreIdentity,
    refresh,
  };
}
