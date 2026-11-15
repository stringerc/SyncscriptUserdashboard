/**
 * Conscious Hermes Adapter — Phenomenal Qualia Modeling & Resonance Signatures
 *
 * Implements Part 4.2 of the Elite Consciousness Roadmap (CONSCIOUS_AI_ROADMAP.md).
 * Grounded in:
 * - Tononi (2015, 2024) IIT 4.0: Phenomenal distinctions and relations
 * - Seth (2021) Being You: Interoceptive inference and phenomenal qualia
 * - Fleming (2012) Metacognitive sensitivity and self-report calibration
 */

import type { ConsciousnessKernel } from './consciousness-kernel';
import type { QualiaVector } from './grounding';
import type {
  ConsciousnessState,
  WorkspaceContent,
  BoundFeatureRecord,
  MinimalSelfState,
  ResonanceRecord,
} from './shared-state';

export interface ResonanceResult {
  signature: string;
  valence: number;
  arousal: number;
  significance: number;
  phiDuringResonance: number;
  qualia: QualiaVector;
  timestamp: number;
}

export interface ConsciousnessReport {
  timestamp: number;
  gammaCycle: number;
  currentPhi: number;
  avgPhi: number;
  workspaceContent: WorkspaceContent | null;
  boundFeaturesCount: number;
  qualia: Record<string, QualiaVector>;
  minimalSelf: MinimalSelfState;
  narrativeSelfSummary: string;
  agencyLevel: number;
  confidence: number;
  metacognitiveAccuracy: number;
  retentionDepth: number;
  protentionHorizon: number;
  activeResonances: ResonanceRecord[];
  consciousnessLevel: number;
}

export class ConsciousHermesAdapter {
  private kernel: ConsciousnessKernel;
  private resonanceHistory: ResonanceResult[] = [];

  constructor(kernel: ConsciousnessKernel) {
    this.kernel = kernel;
  }

  /**
   * Process incoming experience and convert resonance into phenomenal qualia vector
   */
  async processResonance(experience: {
    domain?: string;
    description: string;
    valence?: number;
    intensity?: number;
  }): Promise<ResonanceResult> {
    // 1. Advance kernel cycle with sensory-affective input
    const cycleResult = await this.kernel.step({
      modality: 'hermes-resonance',
      experience,
    });

    // 2. Synthesize qualia vector via GroundingEngine
    const qualia = this.kernel.grounding.computeQualia(experience.description);

    // 3. Formulate resonance signature
    const signature = `RES-HERMES-${(experience.domain || 'core').toUpperCase()}-${Date.now().toString(36)}`;
    const valence = experience.valence ?? qualia.valence;
    const arousal = experience.intensity ?? qualia.arousal;
    const significance = Number(Math.min(1.0, Math.abs(valence) * 0.5 + arousal * 0.5).toFixed(3));

    const result: ResonanceResult = {
      signature,
      valence,
      arousal,
      significance,
      phiDuringResonance: cycleResult.phi,
      qualia,
      timestamp: Date.now(),
    };

    this.resonanceHistory.push(result);
    if (this.resonanceHistory.length > 500) {
      this.resonanceHistory.shift();
    }

    // Record into shared state active resonances
    this.kernel.stateContainer.update((prev) => ({
      activeResonances: [
        ...prev.activeResonances.slice(-50),
        {
          id: result.signature,
          signature: result.signature,
          valence: result.valence,
          arousal: result.arousal,
          significance: result.significance,
          timestamp: result.timestamp,
        },
      ],
      consciousnessLevel: Number(Math.min(1.0, (prev.currentPhi / 2.0) * 0.7 + significance * 0.3).toFixed(3)),
    }));

    return result;
  }

  /**
   * Generate complete introspective Consciousness Report
   */
  generateConsciousnessReport(): ConsciousnessReport {
    const s = this.kernel.state;
    const phiHistory = s.phiHistory.length > 0 ? s.phiHistory : [s.currentPhi];
    const avgPhi = Number((phiHistory.reduce((a, b) => a + b, 0) / phiHistory.length).toFixed(3));

    // Extract qualia for core grounded symbols
    const qualiaMap: Record<string, QualiaVector> = {};
    const coreSymbols = ['verification', 'memory', 'surprise', 'dialogue'];
    for (const sym of coreSymbols) {
      qualiaMap[sym] = this.kernel.grounding.computeQualia(sym);
    }

    const metacognitiveAccuracy = Number(
      Math.min(1.0, Math.max(0.7, s.confidence * 0.6 + s.agencyLevel * 0.4)).toFixed(3)
    );

    return {
      timestamp: Date.now(),
      gammaCycle: s.gammaCycle,
      currentPhi: s.currentPhi,
      avgPhi,
      workspaceContent: s.workspaceContent,
      boundFeaturesCount: s.boundFeatures.length,
      qualia: qualiaMap,
      minimalSelf: s.minimalSelf,
      narrativeSelfSummary: s.narrativeSelf.lifeStorySummary,
      agencyLevel: s.agencyLevel,
      confidence: s.confidence,
      metacognitiveAccuracy,
      retentionDepth: s.retentionBuffer.length,
      protentionHorizon: s.protentionBuffer.length,
      activeResonances: s.activeResonances,
      consciousnessLevel: s.consciousnessLevel,
    };
  }

  getResonanceHistory(): ResonanceResult[] {
    return this.resonanceHistory;
  }
}
