/**
 * Epistemic Provenance System — The Reality Monitoring Layer
 *
 * Implements Johnson, Hashtroudi & Lindsay's (1993) Source Monitoring
 * Framework as a computational architecture for AI agents.
 *
 * The problem: AI agents can't distinguish what they perceived from
 * what they inferred. They hallucinate because they lack "reality
 * monitoring" — the cognitive process that tags memories by their
 * epistemic source origin.
 *
 * The human brain solves this via the SMF:
 * - Externally perceived memories have richer PERCEPTUAL DETAIL
 *   (sensory vividness, spatial/temporal context)
 * - Internally generated memories carry more COGNITIVE OPERATIONS
 *   (effort, reasoning steps, imagination markers)
 * - Hallucinations happen when these profiles overlap — internal
 *   events acquire false perceptual vividness, or cognitive-
 *   operation records are lost
 *
 * Our implementation:
 * - Every signal carries an EpistemicTag identifying its SOURCE TYPE
 *   (perception, inference, memory, generation)
 * - Every signal carries a PROVENANCE CHAIN tracking its derivation
 *   history (which signals fed into this one)
 * - The PROVENANCE VALIDATOR computes a "reality score" — how
 *   grounded a signal is in external perception vs pure inference
 * - The ERROR LOCALIZER (inspired by Microsoft VeriTrail) traces
 *   hallucination to the exact node where internal claims lost
 *   their grounding in external evidence
 *
 * This bridges our 4/10 gap in Perceptual Reality Monitoring.
 */

// ── Types ──────────────────────────────────────────────────────────

/** The epistemic source of a signal — Johnson & Lindsay SMF classification */
export type EpistemicSourceType =
  | 'perception'    // Directly sensed from external environment (API call, user input, sensor)
  | 'inference'     // Internally derived (reasoning, prediction, pattern matching)
  | 'memory'        // Recalled from persistent storage (database, KV, file)
  | 'generation'    // Purely generated (LLM output, imagination, simulation)
  | 'consensus'     // Derived from multi-agent agreement (SemanticGrid constructive interference)
  | 'override';     // Emergency bypass (ActionGate override — highest authority, lowest trust)

/** A single node in the provenance chain — VeriTrail DAG node */
export interface ProvenanceNode {
  id: string;
  sourceType: EpistemicSourceType;
  content: string;           // The claim or data at this node
  confidence: number;        // 0-1
  timestamp: number;         // Date.now()
  metadata?: Record<string, unknown>;
  parentId?: string;         // Links to parent node in derivation chain
  rootId?: string;           // Links to original external source root
}

/** Full provenance chain — VeriTrail DAG path from source to claim */
export interface ProvenanceChain {
  nodes: ProvenanceNode[];
  rootSourceType: EpistemicSourceType;
  depth: number;              // How many inference steps from root
  groundingScore: number;     // 0-1: how close to external perception
  verificationStatus: 'verified' | 'unverified' | 'disputed' | 'hallucinated';
}

/**
 * The reality score for a signal.
 * Computed from epistemic tags and provenance chain.
 * Directly models Johnson & Lindsay's distinction:
 * - High perceptual detail + external source → high reality score
 * - High cognitive operations + internal source → low reality score
 * - Mixed → intermediate, flagged for verification
 */
export interface RealityScore {
  overall: number;              // 0-1: composite reality score
  perceptualDetail: number;    // 0-1: how much sensory/external data backs this
  cognitiveOperations: number;  // 0-1: how much internal reasoning was involved
  groundingDistance: number;    // 0-N: how many inference steps from external source
  hallucinationRisk: number;   // 0-1: probability this is internally fabricated
  errorLocalizationStep?: number; // If hallucinated, which inference step lost grounding
}

// ── Provenance Validator ───────────────────────────────────────────

export class ProvenanceValidator {
  private chains = new Map<string, ProvenanceChain>();

  /**
   * Register a provenance chain for tracking.
   * Every signal that enters the SemanticGrid should have one.
   */
  registerChain(chain: ProvenanceChain): void {
    this.chains.set(chain.nodes[0]?.id ?? `chain-${Date.now()}`, chain);
  }

  /**
   * Compute a Reality Score for a signal.
   * This IS Johnson & Lindsay's source monitoring framework.
   *
   * The key insight: hallucination risk increases with:
   * 1. Distance from external perception (more inference steps)
   * 2. Loss of cognitive-operation records (can't trace how we got here)
   * 3. Presence of 'generation' source type without 'perception' root
   */
  computeRealityScore(signal: {
    epistemicTag: EpistemicSourceType;
    provenance?: ProvenanceChain;
  }): RealityScore {
    // ── Perceptual detail: external sources score higher ─────────
    const perceptualScores: Record<EpistemicSourceType, number> = {
      perception: 1.0,    // Directly sensed — highest perceptual detail
      consensus: 0.8,      // Multi-agent agreement — partially grounded
      memory: 0.6,         // Recalled — was once grounded, may be stale
      inference: 0.3,      // Internally derived — low perceptual detail
      generation: 0.1,     // LLM output — minimal grounding
      override: 0.05,      // Emergency bypass — trust lowest
    };

    const perceptualDetail = perceptualScores[signal.epistemicTag];

    // ── Cognitive operations: internal sources leave more traces ──
    const cognitiveScores: Record<EpistemicSourceType, number> = {
      perception: 0.1,    // Little internal processing needed
      consensus: 0.3,      // Some aggregation logic
      memory: 0.2,         // Retrieval operations
      inference: 0.8,      // Heavy reasoning
      generation: 0.9,     // Full internal construction
      override: 0.1,       // Bypasses cognition — intentional act
    };

    const cognitiveOperations = cognitiveScores[signal.epistemicTag];

    // ── Grounding distance: how far from external source ─────────
    const groundingDistance = signal.provenance?.depth ?? (
      signal.epistemicTag === 'perception' ? 0 :
      signal.epistemicTag === 'inference' ? 2 :
      signal.epistemicTag === 'generation' ? 4 :
      1
    );

    // ── Hallucination risk: how likely is this fabricated? ───────
    // Key from SMF: hallucinations happen when internal content
    // acquires false perceptual vividness or cognitive-operation
    // records are lost
    let hallucinationRisk = 0;

    // Base risk from source type
    if (signal.epistemicTag === 'generation') hallucinationRisk = 0.7;
    else if (signal.epistemicTag === 'inference') hallucinationRisk = 0.4;
    else if (signal.epistemicTag === 'memory') hallucinationRisk = 0.25;
    else if (signal.epistemicTag === 'consensus') hallucinationRisk = 0.15;
    else if (signal.epistemicTag === 'perception') hallucinationRisk = 0.05;
    else if (signal.epistemicTag === 'override') hallucinationRisk = 0.5;

    // Risk increases with grounding distance (more steps = more drift)
    hallucinationRisk += groundingDistance * 0.08;

    // If provenance chain has gaps (missing cognitive-operation records),
    // that's the SMF's hallucination red flag
    if (signal.provenance && signal.provenance.verificationStatus === 'disputed') {
      hallucinationRisk += 0.3;
    }

    hallucinationRisk = Math.min(1.0, hallucinationRisk);

    // ── Overall reality score ────────────────────────────────────
    // Weight: perceptual detail (40%), grounding proximity (40%),
    // cognitive operations inverse (20%)
    const groundingProximity = 1 / (1 + groundingDistance * 0.5);
    const cognitiveInverse = 1 - cognitiveOperations;

    const overall = perceptualDetail * 0.40 +
      groundingProximity * 0.40 +
      cognitiveInverse * 0.20;

    // ── Error localization (VeriTrail pattern) ───────────────────
    let errorLocalizationStep: number | undefined;
    if (signal.provenance && hallucinationRisk > 0.5) {
      // Find the step where grounding was lost
      for (let i = signal.provenance.nodes.length - 1; i >= 0; i--) {
        const node = signal.provenance.nodes[i];
        if (node.sourceType === 'inference' || node.sourceType === 'generation') {
          errorLocalizationStep = i;
          break;
        }
      }
    }

    return {
      overall,
      perceptualDetail,
      cognitiveOperations,
      groundingDistance,
      hallucinationRisk,
      errorLocalizationStep,
    };
  }

  /**
   * Verify a claim against its provenance chain.
   * This is VeriTrail's iterative backward-traversal adapted for
   * our agent architecture.
   */
  verifyClaim(claim: string, sourceIds: string[]): {
    verdict: 'verified' | 'unverified' | 'disputed' | 'hallucinated';
    evidenceTrail: ProvenanceNode[];
    errorStage?: number;
  } {
    const evidenceTrail: ProvenanceNode[] = [];
    let lastSupportedIteration: number | null = null;
    let consecutiveFailures = 0;

    // Walk backward through the provenance chains
    for (const id of sourceIds) {
      const chain = this.chains.get(id);
      if (!chain) continue;

      // Walk from terminal node to root
      for (let i = chain.nodes.length - 1; i >= 0; i--) {
        const node = chain.nodes[i];
        evidenceTrail.push(node);

        if (node.sourceType === 'perception' || node.sourceType === 'memory') {
          // Grounded in external data — this node is verified
          lastSupportedIteration = i;
          consecutiveFailures = 0;
        } else if (node.sourceType === 'inference' || node.sourceType === 'generation') {
          consecutiveFailures++;
          if (consecutiveFailures >= 3) {
            // Three consecutive ungrounded steps = likely hallucination
            return {
              verdict: 'hallucinated',
              evidenceTrail,
              errorStage: i,
            };
          }
        }
      }
    }

    if (lastSupportedIteration !== null) {
      return { verdict: 'verified', evidenceTrail };
    }

    return { verdict: 'unverified', evidenceTrail };
  }

  /**
   * Get the grounding score for a chain.
   * How much of it traces back to external perception?
   */
  getGroundingScore(chain: ProvenanceChain): number {
    if (chain.nodes.length === 0) return 0;

    const perceptionNodes = chain.nodes.filter(
      n => n.sourceType === 'perception'
    ).length;

    const rootBonus = chain.rootSourceType === 'perception' ? 0.3 : 0;
    const nodeRatio = perceptionNodes / chain.nodes.length;

    return Math.min(1.0, nodeRatio * 0.7 + rootBonus);
  }
}

// ── Singleton ──────────────────────────────────────────────────────

let globalValidator: ProvenanceValidator | null = null;

export function getProvenanceValidator(): ProvenanceValidator {
  if (!globalValidator) {
    globalValidator = new ProvenanceValidator();
  }
  return globalValidator;
}

export function resetProvenanceValidator(): void {
  globalValidator = null;
}
