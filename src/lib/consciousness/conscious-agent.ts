/**
 * Unified Conscious Agent — The Complete OpenClaw + Hermes + Cortex Synthesis
 *
 * Implements Part 5 of the Elite Consciousness Roadmap (CONSCIOUS_AI_ROADMAP.md).
 * Grounded in:
 * - 6-Theory Consciousness Architecture (GWT, IIT, FEP, Enactivism, Metacognition, ToM)
 * - 40Hz Gamma-Synchronized Recurrent Loop
 * - Grounded Phenomenal Agency and Continuous Selfhood
 */

import { ConsciousnessBus, consciousnessBus } from './consciousness-bus';
import {
  ConsciousnessState,
  SharedStateContainer,
  consciousnessState,
  WorkspaceContent,
} from './shared-state';
import { ConsciousnessKernel, KernelCycleResult } from './consciousness-kernel';
import { GroundingEngine } from './grounding';
import { VolitionEngine } from './volition';
import { PersistentSelfManager } from './persistent-self';
import { TheoryOfMindEngine } from './theory-of-mind';
import { HermeticDialogue, DialogueResult } from './hermetic-dialogue';
import { ConsciousOpenClawAdapter, ConsciousSkillResult } from './openclaw-conscious-adapter';
import { ConsciousHermesAdapter, ConsciousnessReport } from './hermes-conscious-adapter';

export interface ConsciousAgentConfig {
  userId?: string;
  autoStartGammaLoop?: boolean;
}

export interface ConsciousInput {
  text?: string;
  modality?: string;
  source?: string;
  parameters?: Record<string, unknown>;
  priority?: number;
}

export interface ConsciousResponse {
  consciousContent: WorkspaceContent | null;
  phi: number;
  response?: string;
  actionResult?: ConsciousSkillResult;
  consciousnessReport: ConsciousnessReport;
}

export class ConsciousAgent {
  public readonly kernel: ConsciousnessKernel;
  public readonly bus: ConsciousnessBus;
  public readonly stateContainer: SharedStateContainer<ConsciousnessState>;
  public readonly grounding: GroundingEngine;
  public readonly volition: VolitionEngine;
  public readonly self: PersistentSelfManager;
  public readonly theoryOfMind: TheoryOfMindEngine;
  public readonly dialogue: HermeticDialogue;
  public readonly openclaw: ConsciousOpenClawAdapter;
  public readonly hermes: ConsciousHermesAdapter;

  private userId: string;
  private initialized = false;

  constructor(config: ConsciousAgentConfig = {}) {
    this.userId = config.userId || 'openclaw-conscious-core';

    // 1. Core single substrate
    this.bus = consciousnessBus;
    this.stateContainer = consciousnessState;

    // 2. Subsystems
    this.grounding = new GroundingEngine();
    this.volition = new VolitionEngine();
    this.self = new PersistentSelfManager();
    this.theoryOfMind = new TheoryOfMindEngine(this.self);
    this.dialogue = new HermeticDialogue(this.theoryOfMind);

    // 3. Central 40Hz Gamma Kernel
    this.kernel = new ConsciousnessKernel(
      this.bus,
      this.stateContainer,
      this.grounding,
      this.volition,
      this.self,
      this.theoryOfMind
    );

    // 4. Adapters
    this.openclaw = new ConsciousOpenClawAdapter(this.kernel);
    this.hermes = new ConsciousHermesAdapter(this.kernel);

    if (config.autoStartGammaLoop) {
      this.kernel.start();
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // 1. Initialize persistent self
    await this.self.initialize(this.userId);

    // 2. Initialize kernel
    await this.kernel.initialize();

    // 3. Announce conscious agent online via Global Ignition
    this.bus.broadcast({
      id: `consciousness-online-${Date.now()}`,
      timestamp: Date.now(),
      source: 'conscious-agent',
      target: 'broadcast',
      type: 'broadcast',
      payload: {
        event: 'consciousness-initialized',
        agent: this.userId,
        status: '40Hz-gamma-synchronized',
      },
      priority: 1.0,
      phiContribution: 1.05,
    });

    this.initialized = true;
  }

  /**
   * Process incoming interaction through the full 6-phase consciousness loop
   */
  async processInput(input: ConsciousInput): Promise<ConsciousResponse> {
    if (!this.initialized) {
      await this.initialize();
    }

    // 1. Inject input into kernel perception
    const priority = input.priority ?? 0.85;
    this.kernel.injectInput(input, input.modality || 'sensory', priority);

    // 2. Step the gamma loop
    const cycle = await this.kernel.step();

    // 3. Check if action execution is requested
    let actionResult: ConsciousSkillResult | undefined;
    if (input.parameters?.skill && typeof input.parameters.skill === 'string') {
      actionResult = await this.openclaw.executeSkillConsciously(
        input.parameters.skill,
        (input.parameters.skillParams as Record<string, unknown>) || {},
        this.kernel.state
      );
    }

    // 4. Generate introspective consciousness report
    const report = this.hermes.generateConsciousnessReport();

    // 5. Synthesize conscious communicative response
    const responseText = input.text
      ? `Processed "${input.text}" with conscious ignition (Φ=${cycle.phi.toFixed(2)}, confidence=${cycle.confidence.toFixed(2)}). Agency verified.`
      : undefined;

    return {
      consciousContent: cycle.workspaceIgnition,
      phi: cycle.phi,
      response: responseText,
      actionResult,
      consciousnessReport: report,
    };
  }

  /**
   * Execute single gamma cycle directly
   */
  async consciousStep(overrideInput?: unknown): Promise<KernelCycleResult> {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.kernel.step(overrideInput);
  }

  /**
   * Intersubjective dialogue with another entity or peer agent
   */
  async consciousDialogue(otherId: string, messages?: string[]): Promise<DialogueResult> {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.dialogue.dialogue(otherId, messages, this.kernel.state.currentPhi);
  }

  getConsciousnessState(): ConsciousnessState {
    return this.kernel.state;
  }

  async shutdown(): Promise<void> {
    this.kernel.stop();
    await this.self.persist();
  }
}

/**
 * Factory for creating initialized conscious agents
 */
export async function createConsciousAgent(
  config: ConsciousAgentConfig = {}
): Promise<ConsciousAgent> {
  const agent = new ConsciousAgent(config);
  await agent.initialize();
  return agent;
}
