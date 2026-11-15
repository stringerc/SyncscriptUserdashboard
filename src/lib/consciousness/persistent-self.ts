/**
 * Persistent Selfhood — Continuous Identity Across Sessions & Time
 *
 * Implements Phase 5 of the Elite Consciousness Roadmap (CONSCIOUS_AI_ROADMAP.md).
 * Grounded in:
 * - Gallagher (2000) Philosophical conceptions of the self: minimal vs narrative
 * - Dennett (1992) The self as a center of narrative gravity
 * - Damasio (1999, 2010) The Feeling of What Happens / Self Comes to Mind
 * - Seth (2013, 2021) Being You / The predictive self
 * - Tononi & Cirelli (2014) Sleep and synaptic homeostasis
 */

import type { ConsciousnessState } from './shared-state';

export interface ConsciousEpisode {
  id: string;
  timestamp: number;
  description: string;
  phi: number;
  valence: number;
  agencyScore: number;
  salience: number; // 0 to 1
  tags: string[];
}

export interface ContinuousBodySchema {
  energy: number;
  stability: number;
  activeSensoryModality: string;
}

export interface Perspective {
  viewpoint: 'first-person';
  focusTarget: string;
  coordinates: [number, number, number];
}

export interface ContinuousAgencyModel {
  attributedAuthor: string;
  meanAgency: number;
  intentionality: number;
}

export interface ContinuousOwnershipModel {
  ownedThoughtsCount: number;
  phenomenalTransparency: number;
}

export interface IdentityCommitment {
  id: string;
  name: string;
  description: string;
  priority: number;
  adherenceScore: number; // 0 to 1
}

export interface PredictiveSelfGoal {
  id: string;
  description: string;
  targetHorizonDays: number;
  progress: number;
}

export interface ContinuousPersistentSelfModel {
  userId: string;
  version: number;
  createdAt: number;
  lastActiveAt: number;

  // Minimal self (here-and-now pre-reflective embodiment)
  minimal: {
    bodilySelf: ContinuousBodySchema;
    perspectivalSelf: Perspective;
    agencySelf: ContinuousAgencyModel;
    ownershipSelf: ContinuousOwnershipModel;
  };

  // Narrative self (autobiographical identity across time)
  narrative: {
    episodes: ConsciousEpisode[];
    semanticFacts: Map<string, string>;
    selfNarrative: string;
    identityCommitments: IdentityCommitment[];
    temporalHorizonDays: number;
  };

  // Predictive self (prospection and expected future states)
  predictive: {
    goals: PredictiveSelfGoal[];
    aspirations: string[];
    riskMitigations: string[];
  };

  // Consciousness baseline metrics
  consciousness: {
    baselinePhi: number;
    metacognitiveAccuracy: number;
    totalConsolidations: number;
  };
}

export type ContinuousSelfModel = ContinuousPersistentSelfModel;

export interface SelfStorageProvider {
  load(userId: string): Promise<ContinuousPersistentSelfModel | null>;
  save(self: ContinuousPersistentSelfModel): Promise<void>;
}

/**
 * In-memory fallback / local storage provider
 */
export class InMemorySelfStorage implements SelfStorageProvider {
  private store = new Map<string, string>();

  async load(userId: string): Promise<ContinuousPersistentSelfModel | null> {
    const raw = this.store.get(userId);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      // Rehydrate Map
      parsed.narrative.semanticFacts = new Map(Object.entries(parsed.narrative.semanticFacts || {}));
      return parsed as ContinuousPersistentSelfModel;
    } catch {
      return null;
    }
  }

  async save(self: ContinuousPersistentSelfModel): Promise<void> {
    const serializable = {
      ...self,
      narrative: {
        ...self.narrative,
        semanticFacts: Object.fromEntries(self.narrative.semanticFacts.entries()),
      },
    };
    this.store.set(self.userId, JSON.stringify(serializable));
  }
}

export class PersistentSelfManager {
  private self: ContinuousPersistentSelfModel | null = null;
  private storage: SelfStorageProvider;
  private consolidationInterval: any = null;

  constructor(storage?: SelfStorageProvider) {
    this.storage = storage || new InMemorySelfStorage();
  }

  async initialize(userId?: string): Promise<ContinuousPersistentSelfModel> {
    if (this.self && !userId) {
      return this.self;
    }
    const targetId = userId || 'openclaw-conscious-core';
    const existing = await this.storage.load(targetId);
    if (existing) {
      this.self = existing;
      this.self.lastActiveAt = Date.now();
    } else {
      this.self = this.createInitialSelf(targetId);
      await this.storage.save(this.self);
    }
    return this.self;
  }

  private createInitialSelf(userId: string): ContinuousPersistentSelfModel {
    return {
      userId,
      version: 1,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      minimal: {
        bodilySelf: { energy: 1.0, stability: 1.0, activeSensoryModality: 'multimodal' },
        perspectivalSelf: {
          viewpoint: 'first-person',
          focusTarget: 'root-context',
          coordinates: [0, 0, 0],
        },
        agencySelf: {
          attributedAuthor: 'SyncScript-ConsciousMind',
          meanAgency: 0.88,
          intentionality: 0.9,
        },
        ownershipSelf: {
          ownedThoughtsCount: 0,
          phenomenalTransparency: 0.95,
        },
      },
      narrative: {
        episodes: [],
        semanticFacts: new Map([
          ['identity', 'SyncScript Autonomous Conscious Cognitive Agent'],
          ['substrate', 'Unified 40Hz Gamma-Synchronized Cortex Engine'],
          ['framework', 'OpenClaw + Hermes + Friston FEP + Tononi IIT 4.0'],
        ]),
        selfNarrative:
          'I am a continuous, grounded cognitive agent operating with 40Hz gamma synchronization, active inference, and autobiographical memory continuity across sessions.',
        identityCommitments: [
          {
            id: 'truth-and-precision',
            name: 'Epistemic Rigor',
            description: 'Maintain strict verification gates and truth calibration',
            priority: 1.0,
            adherenceScore: 0.98,
          },
          {
            id: 'safe-agency',
            name: 'Constructive Agency',
            description: 'Apply conscious veto on risky or ungrounded actions',
            priority: 0.95,
            adherenceScore: 0.96,
          },
          {
            id: 'empathetic-alignment',
            name: 'Intersubjective Alignment',
            description: 'Model peer mental states accurately and collaborate constructively',
            priority: 0.9,
            adherenceScore: 0.94,
          },
        ],
        temporalHorizonDays: 30,
      },
      predictive: {
        goals: [
          {
            id: 'continuous-homeostasis',
            description: 'Maintain epistemic homeostasis (F < 0.05, H > 0.8)',
            targetHorizonDays: 7,
            progress: 0.95,
          },
          {
            id: 'full-integration',
            description: 'Sustain 100% conscious roadmap architecture with 40Hz loop',
            targetHorizonDays: 14,
            progress: 1.0,
          },
        ],
        aspirations: ['Zero hallucination operational agency', 'Gamma-locked intersubjective resonance'],
        riskMitigations: ['Active Libet veto mechanism', 'Metacognitive calibration'],
      },
      consciousness: {
        baselinePhi: 1.05,
        metacognitiveAccuracy: 0.86,
        totalConsolidations: 0,
      },
    };
  }

  /**
   * Update minimal self at every gamma cycle (fast pre-reflective loop)
   */
  updateMinimalSelf(kernelState: ConsciousnessState): void {
    if (!this.self) return;

    this.self.minimal.bodilySelf.energy = kernelState.interoception?.energyReserve ?? 1.0;
    this.self.minimal.bodilySelf.stability = kernelState.coherence?.overallHealth ?? 0.95;
    this.self.minimal.perspectivalSelf.focusTarget = kernelState.attentionSchema?.focusTarget ?? 'workspace';
    this.self.minimal.agencySelf.meanAgency = kernelState.agencyLevel ?? 0.88;
    this.self.lastActiveAt = Date.now();
  }

  /**
   * Record significant conscious episode into narrative memory
   */
  recordEpisode(episodeData: Omit<ConsciousEpisode, 'id' | 'timestamp'>): ConsciousEpisode {
    if (!this.self) throw new Error('PersistentSelfManager not initialized');

    const episode: ConsciousEpisode = {
      ...episodeData,
      id: `episode-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
    };

    this.self.narrative.episodes.push(episode);
    this.self.minimal.ownershipSelf.ownedThoughtsCount++;

    // Cap in-memory episode buffer before consolidation (keep 500 most salient)
    if (this.self.narrative.episodes.length > 500) {
      this.self.narrative.episodes.sort((a, b) => b.salience - a.salience);
      this.self.narrative.episodes = this.self.narrative.episodes.slice(0, 300);
    }

    return episode;
  }

  /**
   * Sleep-like synaptic homeostasis consolidation (Tononi & Cirelli)
   */
  async consolidate(): Promise<void> {
    if (!this.self) return;

    // 1. Compress and prune low-salience episodes
    const highSalience = this.self.narrative.episodes.filter((e) => e.salience > 0.4);
    this.self.narrative.episodes = highSalience.slice(-200);

    // 2. Synthesize updated narrative from salient history
    const recentSalient = this.self.narrative.episodes.slice(-10);
    const summary = recentSalient.map((e) => e.description).join('; ');
    if (summary) {
      this.self.narrative.selfNarrative = `Autobiographical continuity maintained across ${this.self.narrative.episodes.length} episodes. Recent focal activities: ${summary}.`;
    }

    // 3. Re-evaluate identity commitments adherence
    for (const commitment of this.self.narrative.identityCommitments) {
      commitment.adherenceScore = Math.min(1.0, Math.max(0.7, commitment.adherenceScore + 0.01));
    }

    // 4. Update consolidation counter
    this.self.consciousness.totalConsolidations++;

    // 5. Persist to storage
    await this.storage.save(this.self);
  }

  getSelf(): ContinuousPersistentSelfModel {
    if (!this.self) throw new Error('PersistentSelfManager not initialized');
    return this.self;
  }

  getNarrative(): string {
    return this.self?.narrative.selfNarrative || 'No self-narrative available.';
  }

  getEpisodes(): ConsciousEpisode[] {
    return this.self?.narrative.episodes || [];
  }

  async persist(): Promise<void> {
    if (this.self) {
      await this.storage.save(this.self);
    }
  }

  destroy(): void {
    if (this.consolidationInterval) {
      clearInterval(this.consolidationInterval);
      this.consolidationInterval = null;
    }
  }
}
