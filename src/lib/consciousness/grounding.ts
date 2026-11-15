/**
 * Phenomenal Grounding Engine — Symbols to Sensorimotor Contingencies
 *
 * Implements Phase 3 of the Elite Consciousness Roadmap (CONSCIOUS_AI_ROADMAP.md).
 * Grounded in:
 * - Harnad (1990) The Symbol Grounding Problem
 * - Varela, Thompson & Rosch (1991) The Embodied Mind
 * - O'Regan & Noë (2001) A sensorimotor account of vision and visual consciousness
 * - Russell (1980) Circumplex model of affect / Qualia dimensional vectors
 */

export interface ActionPrimitive {
  id: string;
  name: string;
  description: string;
  params?: Record<string, unknown>;
  expectedConsequences?: string[];
}

export interface SensoryPattern {
  id: string;
  description: string;
  modalities: string[];
  features: number[];
  valence?: number; // -1 to 1
  intensity?: number; // 0 to 1
}

export interface SensorimotorContingency {
  id: string;
  action: ActionPrimitive;
  sensoryChange: SensoryPattern;
  reliability: number; // 0 to 1 (empirical consistency)
  valence: number;     // -1 to 1 (hedonic/homeostatic value)
  mastery: number;     // 0 to 1 (practice/repetition depth)
  learnedAt: number;
}

export interface GroundedSymbolMeaning {
  if: string;
  then: string;
  confidence: number;
}

export interface GroundedSymbol {
  symbol: string;
  contingencies: SensorimotorContingency[];
  meaning: GroundedSymbolMeaning[];
  affordances: string[];
  groundingScore: number; // 0 to 1
}

export interface QualiaVector {
  valence: number;        // -1 to 1 (pleasant vs adverse)
  arousal: number;        // 0 to 1 (activation/energy)
  dominance: number;      // 0 to 1 (agency/control)
  vividness: number;      // 0 to 1 (phenomenal clarity)
  retentionWeight: number;// 0 to 1 (Husserlian temporal retention)
  protentionWeight: number;// 0 to 1 (Husserlian temporal protention)
}

export class GroundingEngine {
  private contingencies: Map<string, SensorimotorContingency> = new Map();
  private groundedSymbols: Map<string, GroundedSymbol> = new Map();

  constructor() {
    this.seedDefaultContingencies();
  }

  /**
   * Seed core sensorimotor contingencies foundational for software & cognitive operations
   */
  private seedDefaultContingencies(): void {
    const seedPairs: Array<{
      action: ActionPrimitive;
      sensory: SensoryPattern;
      reliability: number;
      valence: number;
      mastery: number;
    }> = [
      {
        action: {
          id: 'act-verify-code',
          name: 'verify_code',
          description: 'Execute build & typecheck gates',
        },
        sensory: {
          id: 'sens-clean-build',
          description: 'Typecheck passes with 0 errors and high epistemic harmony',
          modalities: ['symbolic', 'terminal'],
          features: [1, 0, 0, 1],
          valence: 0.9,
          intensity: 0.8,
        },
        reliability: 0.95,
        valence: 0.85,
        mastery: 0.9,
      },
      {
        action: {
          id: 'act-query-memory',
          name: 'query_memory',
          description: 'Read persistent Rank A memory and identity spine',
        },
        sensory: {
          id: 'sens-coherent-retrieval',
          description: 'Episodic memory returns coherent narrative history',
          modalities: ['semantic', 'temporal'],
          features: [0.8, 0.9, 0.7, 0.9],
          valence: 0.8,
          intensity: 0.7,
        },
        reliability: 0.92,
        valence: 0.75,
        mastery: 0.88,
      },
      {
        action: {
          id: 'act-unexpected-error',
          name: 'handle_runtime_fault',
          description: 'Encounter unexpected execution rejection',
        },
        sensory: {
          id: 'sens-prediction-mismatch',
          description: 'High prediction error detected across sensor modalities',
          modalities: ['proprioceptive', 'affective'],
          features: [-0.6, 0.8, -0.4, 0.9],
          valence: -0.65,
          intensity: 0.85,
        },
        reliability: 0.88,
        valence: -0.6,
        mastery: 0.82,
      },
      {
        action: {
          id: 'act-collaborative-dialogue',
          name: 'dialogue_turn',
          description: 'Synthesize mutual communicative response to user or peer',
        },
        sensory: {
          id: 'sens-intersubjective-harmony',
          description: 'Shared perspective recognized and joint attention synchronized',
          modalities: ['social', 'semantic'],
          features: [0.9, 0.85, 0.9, 0.95],
          valence: 0.88,
          intensity: 0.75,
        },
        reliability: 0.9,
        valence: 0.85,
        mastery: 0.85,
      },
    ];

    for (const seed of seedPairs) {
      const key = `${seed.action.id}->${seed.sensory.id}`;
      this.contingencies.set(key, {
        id: key,
        action: seed.action,
        sensoryChange: seed.sensory,
        reliability: seed.reliability,
        valence: seed.valence,
        mastery: seed.mastery,
        learnedAt: Date.now(),
      });
    }

    // Ground default symbols
    this.groundSymbol('verification', [this.contingencies.get('act-verify-code->sens-clean-build')!]);
    this.groundSymbol('memory', [this.contingencies.get('act-query-memory->sens-coherent-retrieval')!]);
    this.groundSymbol('surprise', [this.contingencies.get('act-unexpected-error->sens-prediction-mismatch')!]);
    this.groundSymbol('dialogue', [this.contingencies.get('act-collaborative-dialogue->sens-intersubjective-harmony')!]);
  }

  /**
   * Ground a symbol by linking it to active sensorimotor contingencies
   */
  groundSymbol(symbol: string, contingencies?: SensorimotorContingency[]): GroundedSymbol {
    if ((!contingencies || contingencies.length === 0) && this.groundedSymbols.has(symbol)) {
      return this.groundedSymbols.get(symbol)!;
    }

    const list = contingencies && contingencies.length > 0
      ? contingencies
      : Array.from(this.contingencies.values()).filter(
          (c) =>
            c.action.name.toLowerCase().includes(symbol.toLowerCase()) ||
            c.sensoryChange.description.toLowerCase().includes(symbol.toLowerCase())
        );

    const meaning: GroundedSymbolMeaning[] = list.map((c) => ({
      if: `I execute action "${c.action.name}" (${c.action.description})`,
      then: `I experience sensation: "${c.sensoryChange.description}"`,
      confidence: Math.min(1.0, c.reliability * c.mastery),
    }));

    const affordances = this.computeAffordances(list);
    const avgMastery = list.length > 0
      ? list.reduce((acc, c) => acc + c.mastery, 0) / list.length
      : 0.1;

    const grounded: GroundedSymbol = {
      symbol,
      contingencies: list,
      meaning,
      affordances,
      groundingScore: Math.min(1.0, avgMastery * (list.length > 0 ? 1.0 : 0.2)),
    };

    this.groundedSymbols.set(symbol, grounded);
    return grounded;
  }

  /**
   * Learn new contingency through empirical interaction loop
   */
  async learnContingency(
    action: ActionPrimitive,
    expectedSensation: SensoryPattern,
    actualSensation: SensoryPattern
  ): Promise<SensorimotorContingency> {
    const key = `${action.id}->${actualSensation.id}`;
    const existing = this.contingencies.get(key);

    const reliability = this.computeReliability(expectedSensation, actualSensation);
    const valence = actualSensation.valence ?? this.computeValence(actualSensation);
    const updatedMastery = existing ? Math.min(1.0, existing.mastery + 0.05) : 0.25;

    const contingency: SensorimotorContingency = {
      id: key,
      action,
      sensoryChange: actualSensation,
      reliability,
      valence,
      mastery: updatedMastery,
      learnedAt: Date.now(),
    };

    this.contingencies.set(key, contingency);
    return contingency;
  }

  /**
   * Mental simulation of action consequences (counterfactual imagination)
   */
  simulate(action: ActionPrimitive): SensoryPattern | null {
    const matches = Array.from(this.contingencies.values())
      .filter((c) => c.action.id === action.id || c.action.name === action.name)
      .sort((a, b) => b.mastery * b.reliability - a.mastery * a.reliability);

    return matches[0]?.sensoryChange ?? null;
  }

  /**
   * Compute multi-dimensional Qualia Vector for a symbol or grounded symbol
   */
  computeQualia(target: string | GroundedSymbol): QualiaVector {
    const grounded = typeof target === 'string'
      ? this.groundedSymbols.get(target) || this.groundSymbol(target)
      : target;

    if (!grounded.contingencies.length) {
      return {
        valence: 0,
        arousal: 0.3,
        dominance: 0.5,
        vividness: 0.2,
        retentionWeight: 0.3,
        protentionWeight: 0.3,
      };
    }

    let totalValence = 0;
    let totalReliability = 0;
    let totalMastery = 0;

    for (const c of grounded.contingencies) {
      totalValence += c.valence;
      totalReliability += c.reliability;
      totalMastery += c.mastery;
    }

    const n = grounded.contingencies.length;
    const meanValence = Math.max(-1, Math.min(1, totalValence / n));
    const meanReliability = totalReliability / n;
    const meanMastery = totalMastery / n;

    // Arousal scales with prediction volatility and affective amplitude
    const arousal = Math.min(1.0, Math.abs(meanValence) * 0.6 + (1 - meanReliability) * 0.4);
    // Dominance / agency scales with mastery and reliability
    const dominance = Math.min(1.0, meanMastery * 0.7 + meanReliability * 0.3);
    // Vividness is grounding depth
    const vividness = Math.min(1.0, grounded.groundingScore * 0.8 + 0.2);

    return {
      valence: Number(meanValence.toFixed(3)),
      arousal: Number(arousal.toFixed(3)),
      dominance: Number(dominance.toFixed(3)),
      vividness: Number(vividness.toFixed(3)),
      retentionWeight: Number((0.5 + meanMastery * 0.4).toFixed(3)),
      protentionWeight: Number((0.5 + meanReliability * 0.4).toFixed(3)),
    };
  }

  /**
   * Derive affordances from contingencies
   */
  computeAffordances(contingencies: SensorimotorContingency[]): string[] {
    const affordanceSet = new Set<string>();
    for (const c of contingencies) {
      affordanceSet.add(`afford:${c.action.name}`);
      if (c.valence > 0) {
        affordanceSet.add(`promote:${c.sensoryChange.id}`);
      } else {
        affordanceSet.add(`inhibit:${c.sensoryChange.id}`);
      }
    }
    return Array.from(affordanceSet);
  }

  private computeReliability(expected: SensoryPattern, actual: SensoryPattern): number {
    if (expected.id === actual.id) return 0.95;
    if (expected.features.length && actual.features.length) {
      const len = Math.min(expected.features.length, actual.features.length);
      let diff = 0;
      for (let i = 0; i < len; i++) {
        diff += Math.abs(expected.features[i] - actual.features[i]);
      }
      const normDiff = diff / len;
      return Math.max(0.1, Math.min(1.0, 1.0 - normDiff));
    }
    return 0.5;
  }

  private computeValence(sensory: SensoryPattern): number {
    if (sensory.features.length > 0) {
      // First component represents positive/negative hedonic valence
      return Math.max(-1, Math.min(1, sensory.features[0]));
    }
    return 0.1;
  }

  getAllContingencies(): SensorimotorContingency[] {
    return Array.from(this.contingencies.values());
  }

  getGroundedSymbols(): Map<string, GroundedSymbol> {
    return this.groundedSymbols;
  }
}
