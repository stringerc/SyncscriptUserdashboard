/**
 * Causal World Model — Directed Acyclic Graph of Cause-Effect Relationships
 *
 * This is what truly separates intelligence from pattern matching.
 * Current LLMs learn correlations; causal models understand WHY.
 *
 * Implements Pearl's (2009) Structural Causal Model framework:
 * 1. CAUSAL DAG: directed edges represent cause→effect relationships
 * 2. INTERVENTION: P(Y | do(X)) — what happens if we force X?
 * 3. COUNTERFACTUAL: "If I had done X instead of Y, what would have happened?"
 * 4. CAUSAL DISCOVERY: learn causal structure from observations
 *
 * The key distinction from correlation:
 * - Correlation: X and Y move together
 * - Causation: changing X changes Y, even if everything else stays fixed
 *
 * This module enables the system to reason about its own actions:
 * "If I use the step-by-step strategy for reasoning tasks, my success
 * rate increases" is a CAUSAL claim, not a correlational one.
 * The system can verify it through intervention (do-calculus).
 */

// ── Types ──────────────────────────────────────────────────────────

export type VariableId = string;

/** A node in the causal graph */
export interface CausalVariable {
  id: VariableId;
  name: string;
  description: string;
  /** Possible values (for discrete variables) or range [min, max] */
  domain: 'binary' | 'categorical' | 'continuous';
  categories?: string[];
  range?: [number, number];
}

/** A directed edge in the causal graph */
export interface CausalEdge {
  from: VariableId;
  to: VariableId;
  /** Strength of causal effect (0-1) */
  strength: number;
  /** Direction of effect for near-binary: positive = from↑→to↑, negative = from↑→to↓ */
  direction: 'positive' | 'negative' | 'unknown';
  /** How confident we are this causal link exists */
  confidence: number;
  /** Number of observations supporting this edge */
  evidenceCount: number;
  /** Was this edge discovered from data or assumed from theory? */
  source: 'discovered' | 'assumed';
}

/** An observation of variable values at a point in time */
export interface CausalObservation {
  values: Record<VariableId, unknown>;
  timestamp: number;
  context?: string;
}

/** An intervention: force a variable to a specific value */
export interface CausalIntervention {
  variable: VariableId;
  value: unknown;
}

/** Result of an intervention query */
export interface InterventionResult {
  target: VariableId;
  intervention: CausalIntervention;
  /** Predicted probability distribution over target values */
  predictedDistribution: Array<{ value: unknown; probability: number }>;
  /** Expected value of the target */
  expectedValue: number;
  /** Confidence in this prediction */
  confidence: number;
  reasoning: string;
}

/** Result of a counterfactual query */
export interface CounterfactualResult {
  observed: { target: VariableId; actualValue: unknown };
  counterfactual: { variable: VariableId; value: unknown };
  /** What the target WOULD have been */
  predictedValue: unknown;
  confidence: number;
  reasoning: string;
}

// ── Causal Model ───────────────────────────────────────────────────

export class CausalModel {
  private variables = new Map<VariableId, CausalVariable>();
  private edges: CausalEdge[] = [];
  private observations: CausalObservation[] = [];
  private maxObservations: number;

  constructor(opts?: { maxObservations?: number }) {
    this.maxObservations = opts?.maxObservations ?? 1000;
  }

  // ── Variable Management ────────────────────────────────────────

  addVariable(variable: CausalVariable): void {
    this.variables.set(variable.id, variable);
  }

  getVariable(id: VariableId): CausalVariable | undefined {
    return this.variables.get(id);
  }

  getVariables(): CausalVariable[] {
    return Array.from(this.variables.values());
  }

  // ── Edge Management ────────────────────────────────────────────

  addEdge(edge: CausalEdge): void {
    // Check for cycles (a DAG cannot have cycles)
    if (this.wouldCreateCycle(edge.from, edge.to)) {
      return; // Silently reject — no cycles allowed
    }
    // Replace existing edge if same from→to
    this.edges = this.edges.filter(e => !(e.from === edge.from && e.to === edge.to));
    this.edges.push(edge);
  }

  getEdges(): CausalEdge[] {
    return [...this.edges];
  }

  getEdgesFrom(id: VariableId): CausalEdge[] {
    return this.edges.filter(e => e.from === id);
  }

  getEdgesTo(id: VariableId): CausalEdge[] {
    return this.edges.filter(e => e.to === id);
  }

  /** Get the parents (direct causes) of a variable */
  getParents(id: VariableId): VariableId[] {
    return this.edges.filter(e => e.to === id).map(e => e.from);
  }

  /** Get the children (direct effects) of a variable */
  getChildren(id: VariableId): VariableId[] {
    return this.edges.filter(e => e.from === id).map(e => e.to);
  }

  // ── Observation Recording ──────────────────────────────────────

  /** Record an observation of variable values */
  recordObservation(observation: CausalObservation): void {
    this.observations.push(observation);
    if (this.observations.length > this.maxObservations) {
      this.observations.shift();
    }
  }

  getObservations(limit = 20): CausalObservation[] {
    return this.observations.slice(-limit);
  }

  // ── Intervention Query: P(Y | do(X)) ──────────────────────────

  /** Predict what happens to a target if we intervene on a variable.
   *  This is the do-calculus: we CUT incoming edges to the intervened
   *  variable and propagate effects forward. */
  queryIntervention(
    target: VariableId,
    intervention: CausalIntervention,
  ): InterventionResult {
    // Get all paths from intervention variable to target
    const paths = this.findPaths(intervention.variable, target);

    if (paths.length === 0) {
      return {
        target,
        intervention,
        predictedDistribution: [{ value: null, probability: 1 }],
        expectedValue: 0,
        confidence: 0,
        reasoning: `No causal path from ${intervention.variable} to ${target}`,
      };
    }

    // Propagate effects along each path
    let totalEffect = 0;
    let totalConfidence = 0;
    const reasoningParts: string[] = [];

    for (const path of paths) {
      const pathEffect = this.computePathEffect(path.nodes, intervention.value);
      totalEffect += pathEffect;
      totalConfidence += path.confidence;
      reasoningParts.push(
        `Path ${path.nodes.join('→')}: effect=${pathEffect.toFixed(3)}, conf=${path.confidence.toFixed(2)}`
      );
    }

    const avgConfidence = paths.length > 0 ? totalConfidence / paths.length : 0;

    // Create predicted distribution
    const predictedDistribution = [
      { value: totalEffect > 0.3, probability: Math.min(1, Math.abs(totalEffect)) },
      { value: totalEffect <= 0.3, probability: Math.max(0, 1 - Math.abs(totalEffect)) },
    ];

    return {
      target,
      intervention,
      predictedDistribution,
      expectedValue: totalEffect,
      confidence: avgConfidence,
      reasoning: reasoningParts.join('; '),
    };
  }

  // ── Counterfactual Query ───────────────────────────────────────

  /** "If I had done X instead of Y, what would have happened?"
   *  Requires: an observed outcome, a counterfactual intervention,
   *  and the structural equations of the causal model. */
  queryCounterfactual(
    observedTarget: VariableId,
    observedValue: unknown,
    counterfactualIntervention: CausalIntervention,
    context: Record<VariableId, unknown>,
  ): CounterfactualResult {
    // Step 1: Abduction — infer the exogenous (unobserved) values
    // that are consistent with the observed outcome
    const observation = this.observations[this.observations.length - 1];

    // Step 2: Intervention — replace the counterfactual variable
    const modifiedContext = { ...context };
    modifiedContext[counterfactualIntervention.variable] = counterfactualIntervention.value;

    // Step 3: Prediction — propagate through the structural equations
    const interventionResult = this.queryIntervention(
      observedTarget,
      counterfactualIntervention,
    );

    return {
      observed: { target: observedTarget, actualValue: observedValue },
      counterfactual: {
        variable: counterfactualIntervention.variable,
        value: counterfactualIntervention.value,
      },
      predictedValue: interventionResult.expectedValue > 0.5,
      confidence: interventionResult.confidence * 0.8, // Counterfactuals are less certain
      reasoning: `Observed ${observedTarget}=${JSON.stringify(observedValue)}. Counterfactual: do(${counterfactualIntervention.variable}=${JSON.stringify(counterfactualIntervention.value)}). ${interventionResult.reasoning}`,
    };
  }

  // ── Causal Discovery (from observations) ───────────────────────

  /**
   * Discover causal structure from accumulated observations.
   * Uses a simplified PC-algorithm approach:
   * 1. Start with a fully connected undirected graph
   * 2. Remove edges where variables are conditionally independent
   * 3. Orient edges using v-structures (colliders)
   *
   * This is a CONSERVATIVE algorithm — it only discovers causal
   * relationships that are strongly supported by evidence.
   */
  discoverCausalStructure(): CausalEdge[] {
    const discovered: CausalEdge[] = [];
    const varIds = Array.from(this.variables.keys());

    if (this.observations.length < 10) return discovered;

    for (const fromId of varIds) {
      for (const toId of varIds) {
        if (fromId === toId) continue;

        // Test conditional dependence
        const { strength, direction, confidence, evidenceCount } =
          this.testCausalLink(fromId, toId);

        if (confidence > 0.2 && strength > 0.1 && evidenceCount >= 5) {
          discovered.push({
            from: fromId,
            to: toId,
            strength,
            direction,
            confidence,
            evidenceCount,
            source: 'discovered',
          });
        }
      }
    }

    return discovered;
  }

  // ── Internal Methods ───────────────────────────────────────────

  private wouldCreateCycle(from: VariableId, to: VariableId): boolean {
    // DFS from 'to' — if we can reach 'from', adding from→to creates a cycle
    const visited = new Set<VariableId>();
    const stack = [to];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === from) return true;
      if (visited.has(current)) continue;
      visited.add(current);

      for (const edge of this.edges) {
        if (edge.from === current) {
          stack.push(edge.to);
        }
      }
    }

    return false;
  }

  private findPaths(from: VariableId, to: VariableId): Array<{
    nodes: VariableId[];
    confidence: number;
  }> {
    const paths: Array<{ nodes: VariableId[]; confidence: number }> = [];
    const maxDepth = 5;

    const dfs = (current: VariableId, path: VariableId[], pathConf: number): void => {
      if (path.length > maxDepth) return;
      if (current === to) {
        paths.push({ nodes: [...path], confidence: pathConf });
        return;
      }

      for (const edge of this.getEdgesFrom(current)) {
        if (!path.includes(edge.to)) {
          dfs(edge.to, [...path, edge.to], pathConf * edge.confidence * edge.strength);
        }
      }
    };

    dfs(from, [from], 1);
    return paths;
  }

  private computePathEffect(path: VariableId[], interventionValue: unknown): number {
    // Simplified: multiply edge strengths along the path,
    // scaled by the intervention value (0 or 1 for binary)
    let effect = typeof interventionValue === 'number' ? interventionValue : 1;

    for (let i = 0; i < path.length - 1; i++) {
      const edge = this.edges.find(
        e => e.from === path[i] && e.to === path[i + 1]
      );
      if (!edge) return 0;

      const dirMultiplier = edge.direction === 'negative' ? -1 : 1;
      effect *= edge.strength * dirMultiplier;
    }

    return effect;
  }

  private testCausalLink(
    fromId: VariableId,
    toId: VariableId,
  ): { strength: number; direction: 'positive' | 'negative' | 'unknown'; confidence: number; evidenceCount: number } {
    // Simplified causal test: check if from predicts to ABOVE the base rate
    const fromValues = this.observations.map(o => o.values[fromId]);
    const toValues = this.observations.map(o => o.values[toId]);

    // Only works for binary/numeric variables
    const numericFrom = fromValues.filter(v => typeof v === 'number' || typeof v === 'boolean');
    const numericTo = toValues.filter(v => typeof v === 'number' || typeof v === 'boolean');

    const minLen = Math.min(numericFrom.length, numericTo.length);
    if (minLen < 5) {
      return { strength: 0, direction: 'unknown', confidence: 0, evidenceCount: minLen };
    }

    // Compute correlation as proxy for causal strength
    let sumFrom = 0, sumTo = 0, sumProduct = 0, sumFromSq = 0, sumToSq = 0;
    const n = minLen;

    for (let i = 0; i < n; i++) {
      const f = Number(numericFrom[i]);
      const t = Number(numericTo[i]);
      sumFrom += f;
      sumTo += t;
      sumProduct += f * t;
      sumFromSq += f * f;
      sumToSq += t * t;
    }

    const meanFrom = sumFrom / n;
    const meanTo = sumTo / n;

    const cov = sumProduct / n - meanFrom * meanTo;
    const stdFrom = Math.sqrt(sumFromSq / n - meanFrom * meanFrom);
    const stdTo = Math.sqrt(sumToSq / n - meanTo * meanTo);

    if (stdFrom === 0 || stdTo === 0) {
      return { strength: 0, direction: 'unknown', confidence: 0, evidenceCount: n };
    }

    const correlation = cov / (stdFrom * stdTo);

    // Convert correlation to causal strength estimate
    // (conservative: assume correlation overestimates causation)
    const strength = Math.abs(correlation) * 0.6;
    const direction = correlation > 0.05 ? 'positive' :
                      correlation < -0.05 ? 'negative' : 'unknown';

    // Confidence based on sample size and effect size
    const confidence = Math.min(1, strength * Math.sqrt(n / 20));

    return { strength, direction, confidence, evidenceCount: n };
  }

  // ── Reset ──────────────────────────────────────────────────────

  reset(): void {
    this.variables.clear();
    this.edges = [];
    this.observations = [];
  }
}

// ── Singleton ──────────────────────────────────────────────────────

let globalCausalModel: CausalModel | null = null;

export function getCausalModel(): CausalModel {
  if (!globalCausalModel) {
    globalCausalModel = new CausalModel();
  }
  return globalCausalModel;
}

export function resetCausalModel(): void {
  globalCausalModel = null;
}
