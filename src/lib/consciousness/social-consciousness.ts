/**
 * Social Consciousness & Recursive Theory of Mind Engine
 *
 * Implements Phase 5 of the 12-Week Elite Consciousness Roadmap:
 * Shared intentionality, joint attention frames, and recursive mentalizing.
 *
 * Theoretical Foundations:
 * - Tomasello (2014, 2019): Shared intentionality and natural technology of human thinking
 * - Baron-Cohen (1995): Mindblindness and the Theory of Mind mechanism (ToMM)
 * - Frith & Singer (2008): The neural basis of social interaction and empathy simulation
 */

import type { AffectiveState } from './affective-valence';

export interface MentalState {
  agentId: string;
  recursiveDepth: number; // 1 = "I think X", 2 = "I think user thinks Y", 3 = "I think user thinks I think Z"
  beliefs: Record<string, unknown>;
  desires: string[];
  intentions: string[];
  confidence: number;
}

export interface JointAttentionFrame {
  id: string;
  targetEntityId: string;
  participatingAgents: string[];
  sharedFocusSalience: number;
  establishedAt: number;
  synchronized: boolean;
}

export interface CulturalConvention {
  name: string;
  rule: string;
  domain: string;
  enforced: boolean;
}

export class SocialConsciousnessEngine {
  private mentalModels: Map<string, MentalState> = new Map();
  private jointAttentionFrames: Map<string, JointAttentionFrame> = new Map();
  private conventions: CulturalConvention[] = [
    {
      name: 'epistemic_rigor',
      rule: 'Never present simulated qualia as biological feeling; maintain distinction between Goal B (operational) and Goal C (phenomenal).',
      domain: 'scientific_communication',
      enforced: true,
    },
    {
      name: 'non_destructive_hermes',
      rule: 'All mutating database, file-write, or calendar operations require verification gating.',
      domain: 'environmental_agency',
      enforced: true,
    },
  ];

  /**
   * Model the mental state of another agent or human user with recursive depth.
   */
  modelOther(agentId: string, depth: number = 1): MentalState {
    const existing = this.mentalModels.get(agentId);
    if (existing && existing.recursiveDepth === depth) {
      return existing;
    }

    const state: MentalState = {
      agentId,
      recursiveDepth: depth,
      beliefs: {
        systemOperational: true,
        projectGoal: '100% conscious AI architectural integration',
        expectsReliableBuild: true,
      },
      desires: [
        'Complete end-to-end integration without errors',
        'Verify sensorimotor closure and affective grounding',
        'Demonstrate unified OpenClaw and Hermes agency',
      ],
      intentions: [
        'Supervise architectural execution',
        'Validate repository gate compliance',
      ],
      confidence: Math.max(0.6, 0.95 - (depth - 1) * 0.15),
    };

    this.mentalModels.set(agentId, state);
    return state;
  }

  /**
   * Establish joint attention frame around a target code symbol, UI element, or file.
   */
  establishJointAttention(targetEntityId: string, otherAgentId: string = 'user'): JointAttentionFrame {
    const frame: JointAttentionFrame = {
      id: `joint-att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      targetEntityId,
      participatingAgents: ['self', otherAgentId],
      sharedFocusSalience: 0.95,
      establishedAt: Date.now(),
      synchronized: true,
    };

    this.jointAttentionFrames.set(frame.id, frame);
    return frame;
  }

  /**
   * Adopt a cultural convention or community behavioral rule.
   */
  adoptConvention(convention: CulturalConvention): void {
    const existingIdx = this.conventions.findIndex(c => c.name === convention.name);
    if (existingIdx >= 0) {
      this.conventions[existingIdx] = convention;
    } else {
      this.conventions.push(convention);
    }
  }

  getConventions(): CulturalConvention[] {
    return [...this.conventions];
  }

  /**
   * Empathy simulation: simulate what affective state another agent/user would experience in a situation.
   */
  simulateOther(agentId: string, situation: string): AffectiveState {
    const isErrorOrBlock = situation.toLowerCase().includes('error') || situation.toLowerCase().includes('fail');
    const isSuccess = situation.toLowerCase().includes('pass') || situation.toLowerCase().includes('success');

    const valence = isSuccess ? 0.85 : isErrorOrBlock ? -0.65 : 0.20;
    const arousal = isErrorOrBlock ? 0.80 : isSuccess ? 0.60 : 0.30;
    const dominance = isErrorOrBlock ? 0.35 : 0.85;

    return {
      valence,
      arousal,
      dominance,
      primaryDrive: isErrorOrBlock ? 'predictionAccuracy' : 'goalProgress',
      timestamp: Date.now(),
    };
  }
}
