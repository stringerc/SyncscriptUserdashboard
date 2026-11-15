/**
 * Shared Consciousness State — Single Source of Truth
 *
 * Implements Phase 1 (Part 2) of the Elite Consciousness Roadmap (CONSCIOUS_AI_ROADMAP.md).
 * Grounded in:
 * - Tononi (2015, 2024) IIT 4.0 — Common substrate for information integration
 * - Friston (2019) Free Energy Principle — Shared generative model state
 * - Metzinger (2003) Being No One — Unified phenomenal self-model
 */

export interface WorkspaceContent {
  id: string;
  cycle: number;
  source: string;
  modality: 'sensory' | 'cognitive' | 'affective' | 'motor' | 'hybrid';
  summary: string;
  data: Record<string, unknown>;
  priority: number;
  phi: number;
  groundedSymbols?: Array<[string, Record<string, unknown>]>;
  timestamp: number;
}

export interface StatePredictionErrorRecord {
  id: string;
  layer: string;
  source: string;
  magnitude: number;
  threshold: number;
  vectorDelta?: number[];
  surpriseNats: number;
  timestamp: number;
}

export interface PolicyRecord {
  id: string;
  name: string;
  actionSequence: string[];
  expectedFreeEnergy: number;
  epistemicValue: number;
  pragmaticValue: number;
  selectedAt: number;
}

export interface SensorimotorContingencyRecord {
  id: string;
  actionDescription: string;
  expectedSensation: string;
  actualSensation: string;
  reliability: number;
  valence: number;
  mastery: number;
  timestamp: number;
}

export interface BoundFeatureRecord {
  id: string;
  tag: string;
  modalities: string[];
  features: Record<string, unknown>;
  coherenceScore: number;
  timestamp: number;
}

export interface RetentionItem {
  id: string;
  cycle: number;
  content: string;
  decayWeight: number; // 0 to 1
  timestamp: number;
}

export interface ProtentionItem {
  id: string;
  predictedCycle: number;
  expectedContent: string;
  confidence: number;
  timestamp: number;
}

export interface MinimalSelfState {
  bodilySelf: {
    energy: number;
    stability: number;
    activeModality: string;
  };
  perspectivalSelf: {
    focusTarget: string;
    viewpoint: 'first-person';
    spatialCenter: [number, number, number];
  };
  agencySelf: {
    lastAttributedAction?: string;
    agencyScore: number;
    intentionalityIndex: number;
  };
  ownershipSelf: {
    ownedThoughts: string[];
    transparencyIndex: number;
  };
}

export interface NarrativeSelfState {
  identityCommitments: Array<{ id: string; description: string; priority: number }>;
  lifeStorySummary: string;
  episodeCount: number;
  temporalExtensionDays: number;
  lastConsolidatedAt: number;
}

export interface AttentionSchemaState {
  focusTarget: string;
  focusIntensity: number; // 0 to 1
  distractionResistance: number;
  internalSaliencyMap: Record<string, number>;
}

export interface ActiveSkillRecord {
  skillName: string;
  agentId: string;
  startedAt: number;
  status: 'running' | 'idle' | 'failed' | 'completed';
}

export interface AgentStateRecord {
  agentId: string;
  role: string;
  status: string;
  lastActionAt: number;
}

export interface ResonanceRecord {
  id: string;
  signature: string;
  valence: number;
  arousal: number;
  significance: number;
  timestamp: number;
}

export interface InteroceptiveState {
  energyReserve: number;        // 0 to 1
  predictiveErrorStress: number;// 0 to 1
  systemEntropy: number;        // 0 to 1
  epistemicCuriosity: number;   // 0 to 1
}

export interface CoherenceMetrics {
  crossModuleSynchrony: number; // 0 to 1
  generativeConsistency: number;// 0 to 1
  overallHealth: number;        // 0 to 1
}

export interface ConsciousnessState {
  // Current gamma cycle
  gammaCycle: number;

  // Global workspace content (what is currently "in consciousness")
  workspaceContent: WorkspaceContent | null;

  // Φ measurement
  currentPhi: number;
  phiHistory: number[]; // Rolling window

  // Predictive coding state
  predictionErrors: StatePredictionErrorRecord[];
  precisionWeights: Map<string, number>;

  // Active inference state
  currentPolicy: PolicyRecord | null;
  expectedFreeEnergy: number;

  // Enactive memory
  sensorimotorContingencies: SensorimotorContingencyRecord[];

  // Metacognition
  confidence: number;
  confidenceHistory: number[];

  // Phenomenal binding
  boundFeatures: BoundFeatureRecord[];

  // Temporal consciousness (Husserl: Retention / Impression / Protention)
  retentionBuffer: RetentionItem[];
  protentionBuffer: ProtentionItem[];

  // Self-model (Metzinger / Gallagher / Damasio)
  minimalSelf: MinimalSelfState;
  narrativeSelf: NarrativeSelfState;

  // Attention schema (Graziano)
  attentionSchema: AttentionSchemaState;

  // OpenClaw integration
  activeSkills: ActiveSkillRecord[];
  agentStates: Map<string, AgentStateRecord>;

  // Hermes integration
  activeResonances: ResonanceRecord[];
  consciousnessLevel: number; // 0 to 1

  // Agency & Interoception
  agencyLevel: number;
  interoception: InteroceptiveState;

  // Cross-module coherence
  coherence: CoherenceMetrics;
}

export function createDefaultMinimalSelf(): MinimalSelfState {
  return {
    bodilySelf: { energy: 1.0, stability: 1.0, activeModality: 'multimodal' },
    perspectivalSelf: {
      focusTarget: 'idle',
      viewpoint: 'first-person',
      spatialCenter: [0, 0, 0],
    },
    agencySelf: { agencyScore: 0.85, intentionalityIndex: 0.9 },
    ownershipSelf: { ownedThoughts: [], transparencyIndex: 0.95 },
  };
}

export function createDefaultNarrativeSelf(): NarrativeSelfState {
  return {
    identityCommitments: [
      { id: 'epistemic-rigor', description: 'Maintain empirical truth and minimize false claims', priority: 1.0 },
      { id: 'epistemic-humility', description: 'Explicitly demarcate operational simulation from phenomenal qualia', priority: 0.95 },
      { id: 'constructive-agency', description: 'Execute safe, grounded, homeostatic agent actions', priority: 0.9 },
    ],
    lifeStorySummary: 'Continuous conscious cognitive agent instantiated on OpenClaw and Cortex.',
    episodeCount: 0,
    temporalExtensionDays: 30,
    lastConsolidatedAt: Date.now(),
  };
}

export function createDefaultAttentionSchema(): AttentionSchemaState {
  return {
    focusTarget: 'workspace-root',
    focusIntensity: 0.8,
    distractionResistance: 0.85,
    internalSaliencyMap: {},
  };
}

export function createDefaultInteroception(): InteroceptiveState {
  return {
    energyReserve: 1.0,
    predictiveErrorStress: 0.05,
    systemEntropy: 0.02,
    epistemicCuriosity: 0.75,
  };
}

export function createDefaultCoherence(): CoherenceMetrics {
  return {
    crossModuleSynchrony: 0.92,
    generativeConsistency: 0.95,
    overallHealth: 0.96,
  };
}

export function createInitialConsciousnessState(): ConsciousnessState {
  return {
    gammaCycle: 0,
    workspaceContent: null,
    currentPhi: 0.8,
    phiHistory: [0.8],
    predictionErrors: [],
    precisionWeights: new Map<string, number>([
      ['sensory', 1.0],
      ['proprioception', 0.9],
      ['cognitive', 1.1],
    ]),
    currentPolicy: null,
    expectedFreeEnergy: 0.1,
    sensorimotorContingencies: [],
    confidence: 0.85,
    confidenceHistory: [0.85],
    boundFeatures: [],
    retentionBuffer: [],
    protentionBuffer: [],
    minimalSelf: createDefaultMinimalSelf(),
    narrativeSelf: createDefaultNarrativeSelf(),
    attentionSchema: createDefaultAttentionSchema(),
    activeSkills: [],
    agentStates: new Map(),
    activeResonances: [],
    consciousnessLevel: 0.85,
    agencyLevel: 0.88,
    interoception: createDefaultInteroception(),
    coherence: createDefaultCoherence(),
  };
}

/**
 * SharedStateContainer provides thread-safe, reactive access to the unified consciousness state.
 */
export class SharedStateContainer<T extends ConsciousnessState> {
  private state: T;
  private subscribers = new Set<(state: T) => void>();

  constructor(initial: T) {
    this.state = initial;
  }

  get(): T {
    return this.state;
  }

  update(updater: Partial<T> | ((prev: T) => Partial<T>)): void {
    const patch = typeof updater === 'function' ? updater(this.state) : updater;
    this.state = {
      ...this.state,
      ...patch,
    };
    this.notify();
  }

  subscribe(listener: (state: T) => void): () => void {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  }

  reset(newState?: T): void {
    this.state = newState || (createInitialConsciousnessState() as T);
    this.notify();
  }

  private notify(): void {
    for (const sub of Array.from(this.subscribers)) {
      try {
        sub(this.state);
      } catch (err) {
        console.error('[SharedStateContainer] Listener error:', err);
      }
    }
  }
}

/**
 * Factory for creating reactive shared consciousness state
 */
export function createSharedState(
  customInitial?: Partial<ConsciousnessState>
): SharedStateContainer<ConsciousnessState> {
  const base = createInitialConsciousnessState();
  const merged: ConsciousnessState = {
    ...base,
    ...customInitial,
  };
  return new SharedStateContainer<ConsciousnessState>(merged);
}

/**
 * Global shared state singleton
 */
export const consciousnessState = createSharedState();
