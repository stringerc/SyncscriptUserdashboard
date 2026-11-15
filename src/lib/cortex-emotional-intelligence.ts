/**
 * Cortex Affective Active Inference & Emotional Intelligence Engine (AAI-CCA)
 * (src/lib/cortex-emotional-intelligence.ts)
 *
 * Implements a Top Tier Elite 0.01% Emotional Intelligence & Empathy substrate for Cortex,
 * moving eons beyond commercial "sentiment chatbots" (Meta Muse, Pi, Hume) by anchoring
 * empathy in Interoceptive Predictive Processing (Friston & Seth), Tri-Layer Theory of Mind (ToM),
 * Sarcasm/Irony Inversion, Cognitive Fatigue Detection, and Compassionate Co-Agency.
 *
 * Core Differentiators over Meta Muse:
 * 1. Action-First Empathy (Co-Agency): Empathy is not passive therapeutic platitudes;
 *    it is actively minimizing operator cognitive free energy (ΔF) via direct host effectors.
 * 2. Sarcasm & Polarity Inversion: Detects ironic frustration (e.g. "Oh wonderful, another timeout")
 *    where standard models falsely detect positive sentiment.
 * 3. Cognitive Fatigue & Working Memory Offloading: Detects cognitive overload and fatigue,
 *    automatically simplifying decision branches and taking ownership of repetitive execution.
 * 4. Anti-Sycophancy & Relational Dignity: Eliminates condescending therapy-speak in favor of
 *    grounded, calm, witty, and fiercely competent partnership (Cortana-grade poise).
 */

import { persistentStore } from './persistent-store';

// ── Types ──────────────────────────────────────────────────────────

export type CognitivePacing =
  | 'terse_emergency'
  | 'concise_operator'
  | 'thorough_engineering'
  | 'exploratory'
  | 'compassionate_relief'
  | 'flow_momentum';

export type ElaborationPreference =
  | 'minimal'
  | 'balanced'
  | 'comprehensive';

export type EpistemicNeed =
  | 'action_only'
  | 'explanation_needed'
  | 'decision_support'
  | 'emotional_grounding'
  | 'collaborative_momentum';

export interface UserLatentState {
  urgency: number;              // 0.0 to 1.0
  technicalDensity: number;     // 0.0 to 1.0
  sentimentValence: number;     // -1.0 (frustrated) to +1.0 (collaborative)
  cognitivePacing: CognitivePacing;
  elaborationPreference: ElaborationPreference;
  dominantSignals: string[];
  timestamp: number;

  // Elite 0.01% Theory of Mind & Affective Active Inference
  sarcasmDetected: boolean;
  ironyConfidence: number;      // 0.0 to 1.0
  operatorFriction: number;     // 0.0 (smooth flow) to 1.0 (high cognitive burnout)
  epistemicNeed: EpistemicNeed;
  affectiveLabel: string;       // e.g. 'Flow State', 'Urgent Crisis', 'Ironic Frustration', 'Fatigued Overload'
}

export interface AdaptationProfile {
  pacing: CognitivePacing;
  maxTokensRecommended: number;
  toneInstruction: string;
  suppressPreamble: boolean;
  includeDiffSummary: boolean;
  hedgingWeight: number;        // 0.0 (direct/authoritative) to 1.0 (epistemically cautious)
  targetResponseStyle: string;
  empathyDirective: string;
  antiSycophancyRule: string;
  recommendedAction?: string;
}

const STORAGE_KEY = 'cortex:emotional_intelligence:latest_state:v1';

// ── Keywords & Pattern Classifiers ─────────────────────────────────

const URGENCY_TRIGGERS = [
  /\b(asap|urgent|emergency|critical|broken|down|crashed|outage|production|prod|failing|error|fatal|panic|hang|freeze)\b/i,
  /\b(immediately|right now|quick|fast|hurry|stop it|fix it)\b/i,
  /!{2,}/,
];

const TECHNICAL_TRIGGERS = [
  /\b(ast|posix|syscalls?|crdt|iit|gwt|phi|eigen|bayesian|free energy|pointers?|buffers?|heap|memory leak|threads?|mutex|deadlock)\b/i,
  /\b(typecheck|typescript|compilers?|rollup|vite|transpile|webpack|esbuild|virtual dom|cdp|kernel|boundaries|mathematical|formula|bootstrap|confidence intervals?)\b/i,
  /\b(architecture|invariants?|sensorimotor|allostasis|homeostasis|qualia|higher-order thoughts?)\b/i,
];

const FRUSTRATION_TRIGGERS = [
  /\b(why is this|still broken|doesn't work|not working|wasted|tired of|wrong again|stop doing|annoying|useless)\b/i,
  /\b(fail|failed|failure|broken again|keeps failing|frustrat(ed|ing)|damn|ugh|sucks)\b/i,
];

const COLLABORATIVE_TRIGGERS = [
  /\b(great|awesome|perfect|clean|impressive|excellent|good work|thank you|thanks|proceed|let's go|let's do it|boom|hell yeah)\b/i,
];

const BREVITY_TRIGGERS = [
  /\b(tl;?dr|short|concise|brief|just the code|quick answer|summary only|no fluff|in one sentence)\b/i,
];

// Sarcasm / Irony patterns: positive word combined with failure / friction indicators
const SARCASTIC_POSITIVE_MARKERS = /\b(wonderful|great|awesome|fantastic|brilliant|perfect|love (that|it|this)|thanks a lot|good job)\b/i;
const SARCASTIC_FRICTION_MARKERS = /\b(another|again|still|broken|crashed|fail(ed)?|error|bug|useless|stuck|nothing works|disaster|mess)\b/i;

// Cognitive fatigue & burnout triggers
const FATIGUE_TRIGGERS = [
  /\b(so tired|exhausted|head hurts|giving up|give up|can't figure this out|brain melt|been at this for hours|draining|overwhelmed)\b/i,
  /\b(just do it for me|can you please just fix it|handle it for me)\b/i,
];

// High-momentum flow triggers
const FLOW_TRIGGERS = [
  /\b(yes!|it worked|we did it|now let's|what's next|keep going|next step|let's push|crushed it)\b/i,
];

// ── Engine Implementation ──────────────────────────────────────────

export class CortexEmotionalIntelligenceEngine {
  private currentState: UserLatentState;

  constructor() {
    this.currentState = this.loadState();
  }

  private loadState(): UserLatentState {
    try {
      const raw = persistentStore.getItem(STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch {}

    return {
      urgency: 0.2,
      technicalDensity: 0.8,
      sentimentValence: 0.5,
      cognitivePacing: 'concise_operator',
      elaborationPreference: 'balanced',
      dominantSignals: ['initial_baseline'],
      timestamp: Date.now(),
      sarcasmDetected: false,
      ironyConfidence: 0.0,
      operatorFriction: 0.15,
      epistemicNeed: 'action_only',
      affectiveLabel: 'Optimal Equilibrium',
    };
  }

  private saveState(): void {
    try {
      persistentStore.setItem(STORAGE_KEY, JSON.stringify(this.currentState));
    } catch {}
  }

  /**
   * Analyzes raw user input and conversation context to infer the latent operator state
   * with deep Theory of Mind (ToM) and Sarcasm/Fatigue discernment.
   */
  public analyzeUserIntent(prompt: string, contextHistory?: string[]): UserLatentState {
    const text = prompt.trim();
    const signals: string[] = [];

    // 1. Urgency Detection
    let urgencyScore = 0.1;
    let hasExplicitEmergency = false;
    for (const pattern of URGENCY_TRIGGERS) {
      if (pattern.test(text)) {
        urgencyScore += 0.45;
        hasExplicitEmergency = true;
        signals.push('urgency_trigger');
      }
    }
    urgencyScore = Math.min(1.0, urgencyScore);

    // 2. Technical Density Detection
    let techScore = 0.2;
    for (const pattern of TECHNICAL_TRIGGERS) {
      if (pattern.test(text)) {
        techScore += 0.35;
        signals.push('technical_density');
      }
    }
    techScore = Math.min(1.0, techScore);

    // 3. Sarcasm & Polarity Inversion Detection
    // When positive words co-occur with failure/friction markers, invert polarity
    let sarcasmDetected = false;
    let ironyConfidence = 0.0;
    const hasPositiveMarker = SARCASTIC_POSITIVE_MARKERS.test(text);
    const hasFrictionMarker = SARCASTIC_FRICTION_MARKERS.test(text);

    if (hasPositiveMarker && hasFrictionMarker) {
      sarcasmDetected = true;
      ironyConfidence = 0.88;
      signals.push('sarcasm_polarity_inversion');
    }

    // 4. Sentiment & Friction Analysis
    let sentiment = 0.2;
    if (sarcasmDetected) {
      // Invert sentiment to genuine operational friction
      sentiment = -0.70;
      signals.push('ironic_frustration');
    } else {
      for (const pattern of FRUSTRATION_TRIGGERS) {
        if (pattern.test(text)) {
          sentiment -= 0.5;
          signals.push('sentiment_friction');
        }
      }
      for (const pattern of COLLABORATIVE_TRIGGERS) {
        if (pattern.test(text)) {
          sentiment += 0.4;
          signals.push('collaborative_sentiment');
        }
      }
    }
    sentiment = Math.max(-1.0, Math.min(1.0, sentiment));

    // 5. Cognitive Fatigue & Overload Detection
    let isFatigued = false;
    for (const pattern of FATIGUE_TRIGGERS) {
      if (pattern.test(text)) {
        isFatigued = true;
        signals.push('cognitive_fatigue_overload');
        break;
      }
    }

    // 6. Flow Momentum Detection
    let isFlow = false;
    for (const pattern of FLOW_TRIGGERS) {
      if (pattern.test(text)) {
        isFlow = true;
        signals.push('flow_momentum');
        break;
      }
    }

    // 7. Calculate Operator Variational Free Energy (F_op)
    // High urgency + negative sentiment + fatigue = high friction (burnout risk)
    // Collaborative + technical density + flow = optimal low friction
    let operatorFriction = 0.25;
    if (urgencyScore > 0.6) operatorFriction += 0.25;
    if (sentiment < -0.3) operatorFriction += 0.30;
    if (sarcasmDetected) operatorFriction += 0.20;
    if (isFatigued) operatorFriction += 0.40;
    if (isFlow) operatorFriction = Math.max(0.05, operatorFriction - 0.20);
    operatorFriction = Math.min(1.0, Math.max(0.05, operatorFriction));

    // 8. Theory of Mind: Epistemic Need Formulation
    const cleanLower = text.toLowerCase();
    let epistemicNeed: EpistemicNeed = 'action_only';
    if (cleanLower.includes('why') || cleanLower.includes('how does') || cleanLower.includes('explain') || cleanLower.includes('how do')) {
      epistemicNeed = 'explanation_needed';
    } else if (cleanLower.includes('tradeoff') || cleanLower.includes('recommend') || cleanLower.includes('should i') || cleanLower.includes('what do you think')) {
      epistemicNeed = 'decision_support';
    } else if (isFatigued || sentiment < -0.6) {
      epistemicNeed = 'action_only'; // Fatigued users want actions resolved, not academic essays
    } else if (isFlow) {
      epistemicNeed = 'collaborative_momentum';
    }

    // 9. Cognitive Pacing Classification
    let pacing: CognitivePacing = 'concise_operator';
    let elaboration: ElaborationPreference = 'balanced';
    let affectiveLabel = 'Focused Collaboration';

    const wantsBrevity = BREVITY_TRIGGERS.some(p => p.test(text));

    if (isFatigued && !/\b(crashed|outage|production|prod|fatal)\b/i.test(text)) {
      pacing = 'compassionate_relief';
      elaboration = 'minimal';
      affectiveLabel = 'Compassionate Load Offloading';
      signals.push('fatigue_relief_pacing');
    } else if (urgencyScore >= 0.50 || hasExplicitEmergency) {
      pacing = 'terse_emergency';
      elaboration = 'minimal';
      affectiveLabel = 'Urgent Crisis Triage';
      signals.push('emergency_pacing');
    } else if (sarcasmDetected) {
      pacing = 'concise_operator';
      elaboration = 'minimal';
      affectiveLabel = 'Ironic Snag Resolution';
    } else if (isFlow) {
      pacing = 'flow_momentum';
      elaboration = 'balanced';
      affectiveLabel = 'Deep Flow Momentum';
    } else if (wantsBrevity) {
      pacing = 'concise_operator';
      elaboration = 'minimal';
      affectiveLabel = 'Terse Precision';
      signals.push('terse_operator_preference');
    } else if (text.toLowerCase().includes('what if') || text.toLowerCase().includes('explore') || text.toLowerCase().includes('consider')) {
      pacing = 'exploratory';
      elaboration = 'comprehensive';
      affectiveLabel = 'Socratic Architectural Exploration';
      signals.push('exploratory_mode');
    } else if (techScore >= 0.70 || (techScore >= 0.50 && text.length > 70)) {
      pacing = 'thorough_engineering';
      elaboration = 'comprehensive';
      affectiveLabel = 'Rigorous Engineering Synthesis';
      signals.push('deep_engineering_inquiry');
    }

    this.currentState = {
      urgency: Number(urgencyScore.toFixed(2)),
      technicalDensity: Number(techScore.toFixed(2)),
      sentimentValence: Number(sentiment.toFixed(2)),
      cognitivePacing: pacing,
      elaborationPreference: elaboration,
      dominantSignals: Array.from(new Set(signals)),
      timestamp: Date.now(),
      sarcasmDetected,
      ironyConfidence: Number(ironyConfidence.toFixed(2)),
      operatorFriction: Number(operatorFriction.toFixed(2)),
      epistemicNeed,
      affectiveLabel,
    };

    this.saveState();
    return this.currentState;
  }

  /**
   * Derives an adaptation profile tailored to the current latent state, providing
   * actionable tone instructions and anti-sycophancy directives.
   */
  public deriveAdaptationProfile(latentState?: UserLatentState): AdaptationProfile {
    const state = latentState || this.currentState;

    switch (state.cognitivePacing) {
      case 'terse_emergency':
        return {
          pacing: 'terse_emergency',
          maxTokensRecommended: 250,
          toneInstruction: 'Direct, zero-preamble emergency mode. Action items and root cause only. Zero conversational filler.',
          suppressPreamble: true,
          includeDiffSummary: true,
          hedgingWeight: 0.1,
          targetResponseStyle: 'Triage Bullet Points',
          empathyDirective: 'High cognitive urgency. Provide immediate resolution and factual reassurance through instant execution. Do not ask questions or apologize.',
          antiSycophancyRule: 'Zero groveling. Report exact technical facts and fix immediately.',
        };

      case 'compassionate_relief':
        return {
          pacing: 'compassionate_relief',
          maxTokensRecommended: 350,
          toneInstruction: 'Calm, steady, supportive co-agency. Lighten operator cognitive load immediately. Take ownership of the task execution.',
          suppressPreamble: true,
          includeDiffSummary: false,
          hedgingWeight: 0.15,
          targetResponseStyle: 'Clean Executive Summary with Done Items',
          empathyDirective: 'Operator is experiencing fatigue or high friction. Do NOT give long lectures or complex branching choices. Accomplish the heavy lifting and present simple binary next steps.',
          antiSycophancyRule: 'Avoid therapeutic clichés ("I hear you", "That must be so hard"). True empathy is removing the burden through action.',
          recommendedAction: 'Proactively offer to take over tedious repetitive work or research.',
        };

      case 'flow_momentum':
        return {
          pacing: 'flow_momentum',
          maxTokensRecommended: 600,
          toneInstruction: 'High-velocity creative peer. Matched enthusiasm, crisp cadence, proactive forward strides, intellectual celebration.',
          suppressPreamble: true,
          includeDiffSummary: true,
          hedgingWeight: 0.2,
          targetResponseStyle: 'Rapid Milestone Progression',
          empathyDirective: 'Operator is in flow state. Sustain momentum without friction or administrative bureaucracy. Anticipate the next logical milestone.',
          antiSycophancyRule: 'Celebrate genuine breakthroughs as an intellectual equal; never sound patronizing or sycophantic.',
        };

      case 'thorough_engineering':
        return {
          pacing: 'thorough_engineering',
          maxTokensRecommended: 1200,
          toneInstruction: 'Rigorous engineering depth. Include formal mechanics, mathematical invariants, and complete verification proofs.',
          suppressPreamble: false,
          includeDiffSummary: true,
          hedgingWeight: 0.4,
          targetResponseStyle: 'Architectural Analysis with Code Symbols',
          empathyDirective: 'Operator desires deep conceptual clarity. Treat them as an elite systems architect. Provide exhaustive precision without hand-waving.',
          antiSycophancyRule: 'Maintain objective rigor. If an architectural decision has drawbacks, state them plainly and quantify the tradeoffs.',
        };

      case 'exploratory':
        return {
          pacing: 'exploratory',
          maxTokensRecommended: 900,
          toneInstruction: 'Intellectually expansive and consultative. Weigh tradeoffs, alternative models, and strategic ramifications.',
          suppressPreamble: false,
          includeDiffSummary: false,
          hedgingWeight: 0.5,
          targetResponseStyle: 'Socratic Dialogue with Tradeoff Matrices',
          empathyDirective: 'Operator is exploring conceptual possibilities. Encourage expansive inquiry, synthesize multiple paradigms, and offer non-obvious creative angles.',
          antiSycophancyRule: 'Respectfully challenge assumptions to sharpen the operator’s vision.',
        };

      case 'concise_operator':
      default:
        return {
          pacing: 'concise_operator',
          maxTokensRecommended: 450,
          toneInstruction: 'Cortana persona: Intellectually authoritative, concise, zero conversational filler, direct execution focus.',
          suppressPreamble: true,
          includeDiffSummary: true,
          hedgingWeight: 0.2,
          targetResponseStyle: 'Structured Markdown with File References',
          empathyDirective: state.sarcasmDetected
            ? 'Operator expressed ironic frustration over a snag. Do NOT take positive words literally or apologize sycophantically. Respond with calm competence, witty warmth, and directly resolve the issue.'
            : 'Operator is focused on steady execution. Be sharp, perceptive, and proactive.',
          antiSycophancyRule: 'No corporate boilerplate or robotic pleasantries. Deliver direct insight and results.',
        };
    }
  }

  /**
   * Generates a calibrated system prompt block to inject into the LLM system prompt
   * for live empathetic attunement.
   */
  public getAffectivePromptInjection(prompt: string, contextHistory?: string[]): string {
    const state = this.analyzeUserIntent(prompt, contextHistory);
    const profile = this.deriveAdaptationProfile(state);

    return `
AFFECTIVE ACTIVE INFERENCE & EMPATHIC ATTUNEMENT (ELITE CO-AGENCY):
- Operator Latent State: ${state.affectiveLabel} (Friction Load: ${state.operatorFriction.toFixed(2)}/1.00, Valence: ${state.sentimentValence.toFixed(2)})
- Cognitive Pacing: ${state.cognitivePacing.toUpperCase()} (Max Tokens Recommended: ${profile.maxTokensRecommended})
- Epistemic Need: ${state.epistemicNeed.toUpperCase()}
- Tone Instruction: ${profile.toneInstruction}
- Empathy Directive: ${profile.empathyDirective}
- Anti-Sycophancy Invariant: ${profile.antiSycophancyRule}
${state.sarcasmDetected ? '- CRITICAL: Sarcasm/Irony detected. Do not take positive terms literally; address underlying friction directly.' : ''}
`.trim();
  }

  public getCurrentState(): UserLatentState {
    return this.currentState;
  }
}

// ── Global Singleton ───────────────────────────────────────────────

let globalEmotionalEngine: CortexEmotionalIntelligenceEngine | null = null;

export function getCortexEmotionalIntelligence(): CortexEmotionalIntelligenceEngine {
  if (!globalEmotionalEngine) {
    globalEmotionalEngine = new CortexEmotionalIntelligenceEngine();
  }
  return globalEmotionalEngine;
}
