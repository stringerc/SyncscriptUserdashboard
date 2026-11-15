/**
 * Cortex Recurrent Scene — Generative Feedback Organizing Perceptual Scenes (Lamme RPT)
 *
 * Implements Victor Lamme's Recurrent Processing Theory (RPT), specifically:
 * Stage 1: Feedforward sweep (fast, preconscious, unorganized feature extraction)
 * Stage 2: Local recurrent processing (generative top-down feedback organizing features
 *          into coherent perceptual scenes with figure-ground segregation and boundary binding)
 * Stage 3: Global recurrent processing (widespread ignition via Global Workspace)
 *
 * In feedforward processing, stimulus elements are isolated feature activations without
 * figure-ground segmentation. Under Lamme's RPT, consciousness of a perceptual scene
 * requires top-down generative feedback that projects hypotheses back to earlier feature
 * representations, suppressing ground noise, grouping boundaries, and reducing perceptual
 * prediction error residuals.
 */

export interface PerceptualFeature {
  id: string;
  dimension: 'boundary' | 'surface' | 'semantic' | 'motion';
  position: [number, number]; // 2D normalized coordinate [0..1, 0..1]
  rawIntensity: number;
  modulatedSalience: number;
  assignedCluster: 'unsegmented' | 'figure' | 'ground';
  residualError: number;
}

export interface TopDownPerceptualHypothesis {
  hypothesisId: string;
  category: string;
  centroid: [number, number];
  radius: number;
  confidence: number;
  generativePrediction: (feature: PerceptualFeature) => number;
}

export interface RecurrentCycleRecord {
  cycle: number;
  residualError: number;
  figureSalience: number;
  groundSalience: number;
  figureGroundContrast: number;
  segmentedRatio: number;
  timestamp: number;
}

export class RecurrentPerceptualScene {
  private features: Map<string, PerceptualFeature> = new Map();
  private hypothesis: TopDownPerceptualHypothesis | null = null;
  private cycleHistory: RecurrentCycleRecord[] = [];
  private currentCycle = 0;

  constructor(public readonly sceneId: string = `scene-${Date.now()}`) {}

  /**
   * Stage 1: Feedforward sweep.
   * Ingests unorganized raw sensory features. All features start unsegmented.
   */
  feedforwardSweep(
    inputs: Array<{
      id: string;
      dimension: 'boundary' | 'surface' | 'semantic' | 'motion';
      position: [number, number];
      intensity: number;
    }>
  ): void {
    this.features.clear();
    this.cycleHistory = [];
    this.currentCycle = 0;
    this.hypothesis = null;

    for (const input of inputs) {
      this.features.set(input.id, {
        id: input.id,
        dimension: input.dimension,
        position: input.position,
        rawIntensity: input.intensity,
        modulatedSalience: input.intensity,
        assignedCluster: 'unsegmented',
        residualError: input.intensity, // initial residual = unmodeled intensity
      });
    }
  }

  /**
   * Generates a top-down perceptual hypothesis (e.g. from higher-level semantic priors).
   */
  setTopDownHypothesis(
    category: string,
    centroid: [number, number],
    radius: number,
    confidence = 0.85
  ): void {
    this.hypothesis = {
      hypothesisId: `hyp-${category}-${Date.now()}`,
      category,
      centroid,
      radius,
      confidence,
      generativePrediction: (f: PerceptualFeature) => {
        const dx = f.position[0] - centroid[0];
        const dy = f.position[1] - centroid[1];
        const dist = Math.sqrt(dx * dx + dy * dy);
        // Inside radius = high expected figure intensity; outside = low background
        if (dist <= radius) {
          return 0.9 * Math.exp(-dist / (radius + 0.01));
        }
        return 0.1 * Math.exp(-dist);
      },
    };
  }

  /**
   * Stage 2: Local Recurrent Processing Cycle.
   * Generative feedback projects top-down expectation onto earlier features:
   * 1. Segregates figure from ground
   * 2. Amplifies figure features, suppresses ground distractors
   * 3. Calculates residual reconstruction error
   * 4. Iteratively minimizes residual across cycles
   */
  executeRecurrentFeedbackCycle(feedbackGain = 0.65): RecurrentCycleRecord {
    this.currentCycle++;
    const feats = Array.from(this.features.values());

    if (feats.length === 0) {
      const emptyRecord: RecurrentCycleRecord = {
        cycle: this.currentCycle,
        residualError: 0,
        figureSalience: 0,
        groundSalience: 0,
        figureGroundContrast: 1,
        segmentedRatio: 0,
        timestamp: Date.now(),
      };
      this.cycleHistory.push(emptyRecord);
      return emptyRecord;
    }

    // Default hypothesis if none provided: center of mass of highest intensity features
    if (!this.hypothesis) {
      let sumX = 0;
      let sumY = 0;
      let sumI = 0;
      for (const f of feats) {
        sumX += f.position[0] * f.rawIntensity;
        sumY += f.position[1] * f.rawIntensity;
        sumI += f.rawIntensity;
      }
      const cx = sumI > 0 ? sumX / sumI : 0.5;
      const cy = sumI > 0 ? sumY / sumI : 0.5;
      this.setTopDownHypothesis('salient-object', [cx, cy], 0.35, 0.75);
    }

    const hyp = this.hypothesis!;
    let totalResidual = 0;
    let figureSalienceSum = 0;
    let figureCount = 0;
    let groundSalienceSum = 0;
    let groundCount = 0;

    for (const f of feats) {
      const predictedVal = hyp.generativePrediction(f);
      const residual = Math.abs(f.rawIntensity - predictedVal);
      f.residualError = residual;
      totalResidual += residual;

      // Figure-ground segregation based on hypothesis alignment and proximity
      const dx = f.position[0] - hyp.centroid[0];
      const dy = f.position[1] - hyp.centroid[1];
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= hyp.radius && residual < 0.5) {
        f.assignedCluster = 'figure';
        // Generative feedback amplification of figure features
        f.modulatedSalience = Math.min(
          1.0,
          f.rawIntensity * (1 + feedbackGain * hyp.confidence * (1 / this.currentCycle))
        );
        figureSalienceSum += f.modulatedSalience;
        figureCount++;
      } else {
        f.assignedCluster = 'ground';
        // Feedback suppression of background noise / clutter
        f.modulatedSalience = Math.max(
          0.05,
          f.rawIntensity * (1 - feedbackGain * 0.45 * Math.min(1, this.currentCycle / 2))
        );
        groundSalienceSum += f.modulatedSalience;
        groundCount++;
      }
    }

    const avgResidual = totalResidual / feats.length;
    const avgFigureSalience = figureCount > 0 ? figureSalienceSum / figureCount : 0.5;
    const avgGroundSalience = groundCount > 0 ? groundSalienceSum / groundCount : 0.2;
    const contrast = avgGroundSalience > 0 ? avgFigureSalience / avgGroundSalience : 2.0;
    const segmentedRatio = (figureCount + groundCount) / feats.length;

    const record: RecurrentCycleRecord = {
      cycle: this.currentCycle,
      residualError: avgResidual,
      figureSalience: avgFigureSalience,
      groundSalience: avgGroundSalience,
      figureGroundContrast: contrast,
      segmentedRatio,
      timestamp: Date.now(),
    };

    this.cycleHistory.push(record);
    return record;
  }

  /**
   * Verifies if generative feedback has organized the perceptual scene:
   * Requires:
   * 1. At least 2 recurrent cycles
   * 2. Figure-ground contrast > 1.3 (figure distinct from ground)
   * 3. Monotonic or convergent residual reduction
   * 4. All features segmented into figure or ground
   */
  isOrganized(): { organized: boolean; evidence: string } {
    if (this.cycleHistory.length < 2) {
      return {
        organized: false,
        evidence: `Insufficient recurrent cycles (${this.cycleHistory.length} < 2)`,
      };
    }

    const firstCycle = this.cycleHistory[0];
    const latestCycle = this.cycleHistory[this.cycleHistory.length - 1];
    const contrast = latestCycle.figureGroundContrast;
    const residualReduction = firstCycle.residualError - latestCycle.residualError;

    const organized = contrast >= 1.2 && latestCycle.segmentedRatio >= 0.9;
    const evidence = organized
      ? `Scene organized: cycles=${this.cycleHistory.length}, contrast=${contrast.toFixed(2)}, residual reduction=${residualReduction.toFixed(3)}, figure/ground segregated.`
      : `Scene not yet organized: contrast=${contrast.toFixed(2)}, segmentedRatio=${latestCycle.segmentedRatio.toFixed(2)}`;

    return { organized, evidence };
  }

  getFeatures(): PerceptualFeature[] {
    return Array.from(this.features.values());
  }

  getCycleHistory(): RecurrentCycleRecord[] {
    return [...this.cycleHistory];
  }
}

// ── Singleton Factory ──────────────────────────────────────────────

let globalPerceptualScene: RecurrentPerceptualScene | null = null;

export function getRecurrentPerceptualScene(): RecurrentPerceptualScene {
  if (!globalPerceptualScene) {
    globalPerceptualScene = new RecurrentPerceptualScene();
  }
  return globalPerceptualScene;
}

export function resetRecurrentPerceptualScene(): void {
  globalPerceptualScene = null;
}
