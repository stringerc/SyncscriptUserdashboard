/**
 * Sensorimotor Closure Loop — Embodied Cognition & Active Inference
 *
 * Implements Phase 1 of the 12-Week Elite Consciousness Roadmap:
 * Action -> Sensory Consequence -> Prediction Error -> Free Energy Delta -> Generative Model Update.
 *
 * Grounded in:
 * - O'Regan & Noë (2001) sensorimotor contingencies
 * - Varela, Thompson & Rosch (1991) enactivism
 * - Friston (2010, 2019) Active Inference and Free Energy Principle
 */

export interface SensoryFeatureVector {
  visualEmbedding: number[];        // Latent visual representation (e.g. CLIP/DINOv2 mock/real 64-d)
  domStateHash: string;             // Structural DOM representation
  worldStateSummary: string;        // Textual/semantic perception
  confidence: number;               // Sensor precision (0-1)
  timestamp: number;
}

export interface SensoryState {
  id: string;
  modality: 'visual' | 'world_state' | 'multimodal' | 'proprioceptive';
  features: SensoryFeatureVector;
  rawPayload?: Record<string, unknown>;
  capturedAt: number;
}

export interface ClosedLoopAction {
  id: string;
  source: 'openclaw' | 'hermes' | 'internal';
  name: string;
  parameters: Record<string, unknown>;
  intent: string;
  expectedConsequenceDescription: string;
  initiatedAt: number;
}

export interface PredictionErrorRecord {
  actionId: string;
  magnitude: number;                // Normalized error [0, 1]
  vectorDelta: number[];            // Difference in feature space
  surpriseNats: number;             // -ln(p) epistemic surprise
  freeEnergyDelta: number;          // Shift in variational free energy
  timestamp: number;
}

export interface HomeostaticDrives {
  energy: number;                   // 0-1 (compute/token reserve)
  predictionAccuracy: number;       // 0-1 (1 - mean prediction error)
  goalProgress: number;             // 0-1 (PCT reference convergence)
  socialBond: number;               // 0-1 (interaction alignment)
  autonomy: number;                 // 0-1 (ratio of self-directed vs forced actions)
}

export interface SensorimotorClosureOutcome {
  action: ClosedLoopAction;
  predictedState: SensoryState;
  actualState: SensoryState;
  predictionError: number;
  freeEnergyDelta: number;
  generativeModelUpdated: boolean;
  adaptedDrives: HomeostaticDrives;
  latencyMs: number;
}

export class SensorimotorLoopService {
  private transitionMatrix: Map<string, number[]> = new Map();
  private recentErrors: PredictionErrorRecord[] = [];
  private historyCapacity: number = 250;
  private currentDrives: HomeostaticDrives = {
    energy: 0.92,
    predictionAccuracy: 0.88,
    goalProgress: 0.75,
    socialBond: 0.85,
    autonomy: 0.80,
  };

  constructor() {
    this.seedDefaultGenerativePriors();
  }

  private seedDefaultGenerativePriors(): void {
    // Basic priors for canonical action types
    this.transitionMatrix.set('browser_navigate', new Array(16).fill(0.05));
    this.transitionMatrix.set('click_element', new Array(16).fill(0.1));
    this.transitionMatrix.set('hermes_write_file', new Array(16).fill(0.15));
    this.transitionMatrix.set('hermes_calendar_hold', new Array(16).fill(0.08));
    this.transitionMatrix.set('general_tool_execution', new Array(16).fill(0.06));
  }

  /**
   * Synthesize or forecast expected sensory state given current perception and candidate action.
   */
  predictSensoryConsequence(currentPerception: SensoryState, action: ClosedLoopAction): SensoryState {
    const prior = this.transitionMatrix.get(action.name) || new Array(16).fill(0.05);
    const currentVec = currentPerception.features.visualEmbedding.slice(0, 16);
    
    // Generative forward model: s_{t+1} = s_t + W * action_prior
    const predictedEmbedding: number[] = [];
    for (let i = 0; i < 16; i++) {
      const base = currentVec[i] ?? 0;
      const shift = prior[i] ?? 0.05;
      predictedEmbedding.push(Number(Math.sin(base + shift).toFixed(4)));
    }

    return {
      id: `pred-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      modality: currentPerception.modality,
      features: {
        visualEmbedding: predictedEmbedding,
        domStateHash: `hash-${action.name}-${Date.now()}`,
        worldStateSummary: `Forecast consequence of ${action.name}: ${action.expectedConsequenceDescription}`,
        confidence: Math.max(0.4, Math.min(0.99, this.currentDrives.predictionAccuracy)),
        timestamp: Date.now(),
      },
      capturedAt: Date.now(),
    };
  }

  /**
   * Complete closed-loop execution:
   * Action -> Observation -> Prediction Error Minimization -> Generative Update.
   */
  async executeWithPrediction(
    action: ClosedLoopAction,
    predictedState: SensoryState,
    executor: (act: ClosedLoopAction) => Promise<SensoryState>
  ): Promise<SensorimotorClosureOutcome> {
    const start = performance.now();

    // 1. Execute physical or virtual action in environment
    const actualState = await executor(action);

    // 2. Compute error in latent/perceptual space
    const predVec = predictedState.features.visualEmbedding;
    const actVec = actualState.features.visualEmbedding;
    const len = Math.min(predVec.length, actVec.length, 16);

    let sumSquared = 0;
    const deltaVec: number[] = [];
    for (let i = 0; i < len; i++) {
      const diff = (actVec[i] ?? 0) - (predVec[i] ?? 0);
      deltaVec.push(diff);
      sumSquared += diff * diff;
    }

    const euclideanDistance = Math.sqrt(sumSquared);
    const normalizedError = Math.min(1.0, euclideanDistance / Math.sqrt(Math.max(1, len)));
    const surpriseNats = -Math.log(Math.max(0.001, 1.0 - normalizedError * 0.9));
    
    // Free energy delta: variational bound on surprise
    const freeEnergyDelta = Number((surpriseNats * 0.5 + normalizedError * 0.5).toFixed(4));

    // 3. Update generative model weights (Hebbian / delta rule)
    const updated = this.updateGenerativeModel({
      actionId: action.id,
      magnitude: normalizedError,
      vectorDelta: deltaVec,
      surpriseNats,
      freeEnergyDelta,
      timestamp: Date.now(),
    }, action.name);

    // 4. Update homeostatic drives
    this.currentDrives.predictionAccuracy = Number(
      Math.max(0.1, Math.min(0.99, this.currentDrives.predictionAccuracy * 0.95 + (1 - normalizedError) * 0.05)).toFixed(4)
    );
    this.currentDrives.energy = Number(Math.max(0.1, this.currentDrives.energy - 0.002).toFixed(4));
    this.currentDrives.goalProgress = Number(Math.min(0.99, this.currentDrives.goalProgress + (normalizedError < 0.3 ? 0.02 : -0.01)).toFixed(4));

    const latencyMs = Number((performance.now() - start).toFixed(2));

    return {
      action,
      predictedState,
      actualState,
      predictionError: normalizedError,
      freeEnergyDelta,
      generativeModelUpdated: updated,
      adaptedDrives: { ...this.currentDrives },
      latencyMs,
    };
  }

  /**
   * Update the internal generative model based on the measured prediction error.
   */
  updateGenerativeModel(error: PredictionErrorRecord, actionName: string): boolean {
    this.recentErrors.push(error);
    if (this.recentErrors.length > this.historyCapacity) {
      this.recentErrors.shift();
    }

    const currentWeights = this.transitionMatrix.get(actionName) || new Array(16).fill(0.05);
    const learningRate = 0.08;

    // Delta update to align predictions with reality
    const updatedWeights = currentWeights.map((w, idx) => {
      const errComponent = error.vectorDelta[idx] ?? 0;
      return Number((w + learningRate * errComponent).toFixed(4));
    });

    this.transitionMatrix.set(actionName, updatedWeights);
    return true;
  }

  /**
   * Regulate homeostasis: generate candidate motor actions to minimize expected free energy.
   */
  regulateHomeostasis(drives: HomeostaticDrives): ClosedLoopAction[] {
    const candidateActions: ClosedLoopAction[] = [];

    if (drives.energy < 0.3) {
      candidateActions.push({
        id: `act-rest-${Date.now()}`,
        source: 'internal',
        name: 'rest_and_conserve',
        parameters: { targetComputeDownscale: 0.5 },
        intent: 'Conserve energy and enter low-compute resting state',
        expectedConsequenceDescription: 'Energy reserves stabilize and replenish',
        initiatedAt: Date.now(),
      });
    }

    if (drives.predictionAccuracy < 0.6) {
      candidateActions.push({
        id: `act-explore-${Date.now()}`,
        source: 'openclaw',
        name: 'epistemic_foraging',
        parameters: { inspectDomain: 'active_environment' },
        intent: 'Active sampling to reduce epistemic ambiguity and prediction error',
        expectedConsequenceDescription: 'Increased perceptual resolution and generative calibration',
        initiatedAt: Date.now(),
      });
    }

    if (drives.autonomy < 0.5) {
      candidateActions.push({
        id: `act-autonomy-${Date.now()}`,
        source: 'hermes',
        name: 'self_directed_goal_formulation',
        parameters: { prioritizeIntrinsic: true },
        intent: 'Execute voluntary self-initiated project tasks',
        expectedConsequenceDescription: 'Elevation of agency attribution and intrinsic drive satisfaction',
        initiatedAt: Date.now(),
      });
    }

    return candidateActions;
  }

  getDrives(): HomeostaticDrives {
    return { ...this.currentDrives };
  }

  setDrives(partial: Partial<HomeostaticDrives>): void {
    this.currentDrives = { ...this.currentDrives, ...partial };
  }

  getRecentErrors(): PredictionErrorRecord[] {
    return [...this.recentErrors];
  }

  getMeanPredictionError(): number {
    if (this.recentErrors.length === 0) return 0.12;
    const sum = this.recentErrors.reduce((acc, curr) => acc + curr.magnitude, 0);
    return Number((sum / this.recentErrors.length).toFixed(4));
  }
}

let singletonSensorimotorLoop: SensorimotorLoopService | null = null;

export function getSensorimotorLoopService(): SensorimotorLoopService {
  if (!singletonSensorimotorLoop) {
    singletonSensorimotorLoop = new SensorimotorLoopService();
  }
  return singletonSensorimotorLoop;
}
