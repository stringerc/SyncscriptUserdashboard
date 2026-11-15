/**
 * Epistemic claim graph — structural support/conflict edges on MEMORY-class prose.
 *
 * Not an LLM judge. Lexical polarity + topic/script/port co-mention only.
 * Feeds contradictionDensity ∈ [0,1] into free energy (see epistemic-homeostasis.ts).
 *
 * Meta-d′ / cortex type-2 sensitivity is **orthogonal** and must never be folded
 * into this graph (CONSCIOUSNESS_GAP_DETERMINATION.md Goal A/B vs Goal H).
 */

import { clamp01, rate } from './epistemic-homeostasis';

export type ClaimPolarity = 'assert' | 'forbid' | 'neutral';

export interface ClaimNode {
  id: string;
  source: string;
  line: number;
  text: string;
  polarity: ClaimPolarity;
  topics: string[];
  scripts: string[];
  ports: string[];
  historical: boolean;
}

export type ClaimEdgeKind = 'support' | 'conflict';

export interface ClaimEdge {
  from: string;
  to: string;
  kind: ClaimEdgeKind;
  reason: string;
}

export interface ClaimGraph {
  nodes: ClaimNode[];
  edges: ClaimEdge[];
  claimCount: number;
  supportCount: number;
  conflictCount: number;
  /** clamp01(2 * conflicts / max(1, claims)) — few real conflicts hurt; mass claims low weight */
  contradictionDensity: number;
  conflictSamples: Array<{ a: string; b: string; reason: string }>;
}

/**
 * Inactive / non-live claims — excluded from edge formation.
 * Includes true history labels **and** resolved incident forensics (post-mortems).
 * Do not use as makeup for *current* false doctrine — only for dead defects & receipts.
 */
export const HISTORICAL =
  /\b(?:removed|historical|deleted|folded|superseded|planned|not built|legacy|was stuck|previous|migrat|old port|root-caused|root caused|and fixed|was fixed|crash fix|\*\*fixed:\*\*|fixed:|resolved the|pre-repair|historical defect|incident forensics)\b/i;

/** Ops topics worth aligning; closed set limits combinatorial noise. */
export const CLAIM_TOPIC_LEXICON = [
  'proxy',
  'port',
  'launchd',
  'fcc',
  'claude',
  'kokoro',
  'tts',
  'twilio',
  'phone',
  'vercel',
  'supabase',
  'cortex',
  'workspace',
  'memory',
  'resonance',
  'nim',
  'openrouter',
  'ollama',
  'nexus',
  'dashboard',
  'billing',
  'deploy',
  'tunnel',
  'csrf',
  'auth',
  'websocket',
  'stream',
  'failover',
  'quota',
  'canonical',
] as const;

const FORBID =
  /\b(do not|don't|must not|must never|should not|shouldn't|cannot|can't)\b/i;
const ASSERT =
  /\b(must |always |required |canonical is|is the sole|is the only|prefer )\b/i;

/**
 * Strip English *outcome* phrasing that is not an operator forbid
 * ("so streams do not crash", "do not rewrite operator intent").
 * Also strip non-ops modals that false-trigger assert ("not always", "no deploy required").
 */
export function stripOutcomeNegations(text: string): string {
  return text
    .replace(/\bso\b[^.]{0,100}?\b(do not|don't)\b/gi, ' so ')
    .replace(/\b(do not|don't)\s+(crash|kill|die|rewrite operator|make them|treat “|treat ")/gi, ' ')
    .replace(/\b(may|might)\s+\*?[a-z]+\*?\b[^.]{0,40}\b(do not|don't|must not)\b/gi, ' ')
    .replace(/\bnot always\b/gi, 'sometimes-not')
    .replace(/\bno\s+(?:code\s+)?deploy\s+required\b/gi, 'no-deploy-needed')
    .replace(/\brequired\s+for\s+it\s+to\b/gi, 'needed-for-it-to')
    .replace(/\b(cannot|can't)\s+(schedule|meet|be)\b/gi, 'is-unable-to-$2');
}

export function claimPolarity(text: string): ClaimPolarity {
  const cleaned = stripOutcomeNegations(text);
  const f = FORBID.test(cleaned);
  const a = ASSERT.test(cleaned);
  if (f && !a) return 'forbid';
  if (a && !f) return 'assert';
  // Complementary single sentence: preferred path + anti multi-instance
  if (
    f &&
    a &&
    /\b(prefer |must |required |keep |canonical is|is the sole)\b/i.test(cleaned) &&
    /\b(do not|don't|must not).{0,80}(rival|second|another port|spawn|extra process|another process)\b/i.test(
      cleaned,
    )
  ) {
    return 'assert';
  }
  // both: treat forbid as stronger (ops "never do X")
  if (f && a) return 'forbid';
  return 'neutral';
}

/** Assert path vs forbid multi-instance — same doctrine, not opposite. */
export function isComplementaryDoctrine(a: ClaimNode, b: ClaimNode): boolean {
  const pair = `${a.text}\n${b.text}`.toLowerCase();
  const ownerOrMatch = /\b(launchd|owner|sole|must match|prefer\b|canonical|port=8082|port 8082)\b/.test(
    pair,
  );
  const antiMulti =
    /\b(do not|don't|must not).{0,90}(rival|second|another port|spawn|manual fcc|extra process|another process)\b/i.test(
      pair,
    ) || /\b(do not|don't).{0,40}spawn\b/i.test(pair);
  if (ownerOrMatch && antiMulti) return true;
  return false;
}

export function extractTopics(text: string): string[] {
  const lower = text.toLowerCase();
  return CLAIM_TOPIC_LEXICON.filter((t) => {
    // Word boundary — "port" must not match important/support/report/export
    const re = new RegExp(`(^|[^a-z0-9])${t}([^a-z0-9]|$)`, 'i');
    return re.test(lower);
  });
}

export function extractScripts(text: string): string[] {
  return [...new Set([...text.matchAll(/npm run ([a-zA-Z0-9:_-]+)/g)].map((m) => m[1]))];
}

export function extractPorts(text: string): string[] {
  return [...new Set([...text.matchAll(/\b(80[89]\d)\b/g)].map((m) => m[1]))];
}

function isClaimishLine(line: string): boolean {
  const t = line.trim();
  if (t.length < 48) return false;
  if (/^#{1,6}\s/.test(t)) return false;
  if (/^\|/.test(t)) return false;
  if (/^```/.test(t)) return false;
  // bullets, numbered, or bold lead-ins that carry ops force
  if (/^[-*]\s+/.test(t)) return true;
  if (/^\d+\.\s+/.test(t)) return true;
  if (/\b(must|never|do not|canonical|npm run)\b/i.test(t) && t.length > 60) return true;
  return false;
}

export function extractClaimNodes(source: string, text: string): ClaimNode[] {
  const nodes: ClaimNode[] = [];
  const lines = text.split('\n');
  let n = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!isClaimishLine(line)) continue;
    const textBody = line.replace(/^\s*[-*]\s+/, '').replace(/^\s*\d+\.\s+/, '').trim();
    const historical = HISTORICAL.test(line);
    const polarity = claimPolarity(textBody);
    const scripts = extractScripts(textBody);
    const ports = extractPorts(textBody);
    const topics = extractTopics(textBody);
    // Need something alignable or we create noise-only nodes
    if (polarity === 'neutral' && scripts.length === 0 && ports.length === 0 && topics.length < 2) {
      continue;
    }
    n += 1;
    nodes.push({
      id: `${source}:${i + 1}:${n}`,
      source,
      line: i + 1,
      text: textBody.slice(0, 220),
      polarity,
      topics,
      scripts,
      ports,
      historical,
    });
  }
  return nodes;
}

function subjectOverlap(a: ClaimNode, b: ClaimNode): { ok: boolean; reason: string } {
  const sharedScripts = a.scripts.filter((s) => b.scripts.includes(s));
  if (sharedScripts.length) return { ok: true, reason: `script:${sharedScripts[0]}` };
  const sharedPorts = a.ports.filter((p) => b.ports.includes(p));
  if (sharedPorts.length) return { ok: true, reason: `port:${sharedPorts[0]}` };
  const sharedTopics = a.topics.filter((t) => b.topics.includes(t));
  // Require ≥2 shared ops topics — single-topic (proxy, memory, nexus) floods false conflicts.
  if (sharedTopics.length >= 2) return { ok: true, reason: `topics:${sharedTopics.slice(0, 3).join('+')}` };
  return { ok: false, reason: '' };
}

export function buildClaimEdges(nodes: ClaimNode[]): ClaimEdge[] {
  const edges: ClaimEdge[] = [];
  const active = nodes.filter((n) => !n.historical);
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i];
      const b = active[j];
      const sub = subjectOverlap(a, b);
      if (!sub.ok) continue;

      // Opposite polarity = conflict (unless complementary process-ownership doctrine)
      if (
        (a.polarity === 'assert' && b.polarity === 'forbid') ||
        (a.polarity === 'forbid' && b.polarity === 'assert')
      ) {
        if (isComplementaryDoctrine(a, b)) {
          edges.push({
            from: a.id,
            to: b.id,
            kind: 'support',
            reason: `complementary ${sub.reason}`,
          });
          continue;
        }
        // Topic-only edges are noisy on long MEMORY receipts; require hard subject
        // (port/script) or ≥3 shared topics for true claim friction.
        if (sub.reason.startsWith('topics:')) {
          const shared = a.topics.filter((t) => b.topics.includes(t));
          if (shared.length < 3) continue;
        }
        edges.push({
          from: a.id,
          to: b.id,
          kind: 'conflict',
          reason: `polarity↔ on ${sub.reason}`,
        });
        continue;
      }

      // Same port, both assert different "canonical" narrative — if both mention
      // canonical-ish and different other ports, soft conflict is already via polarity.
      // Support: same polarity + shared subject
      if (
        a.polarity === b.polarity &&
        a.polarity !== 'neutral' &&
        a.scripts.some((s) => b.scripts.includes(s))
      ) {
        edges.push({
          from: a.id,
          to: b.id,
          kind: 'support',
          reason: `aligned ${sub.reason}`,
        });
      }
    }
  }
  return edges;
}

export function contradictionDensityFromCounts(conflictCount: number, claimCount: number): number {
  // Two conflicts among 100 claims ≈ 0.04; scale so 5% conflict density ≈ 0.5
  if (claimCount <= 0) return 0;
  return clamp01((2 * conflictCount) / claimCount);
}

export function buildClaimGraph(
  docs: Array<{ source: string; text: string }>,
): ClaimGraph {
  const nodes = docs.flatMap((d) => extractClaimNodes(d.source, d.text));
  const edges = buildClaimEdges(nodes);
  const supportCount = edges.filter((e) => e.kind === 'support').length;
  const conflictCount = edges.filter((e) => e.kind === 'conflict').length;
  const claimCount = nodes.filter((n) => !n.historical).length;
  const density = contradictionDensityFromCounts(conflictCount, claimCount);
  const conflictSamples = edges
    .filter((e) => e.kind === 'conflict')
    .slice(0, 12)
    .map((e) => {
      const a = nodes.find((n) => n.id === e.from);
      const b = nodes.find((n) => n.id === e.to);
      return {
        a: a ? `L${a.line}: ${a.text.slice(0, 80)}` : e.from,
        b: b ? `L${b.line}: ${b.text.slice(0, 80)}` : e.to,
        reason: e.reason,
      };
    });
  return {
    nodes,
    edges,
    claimCount,
    supportCount,
    conflictCount,
    contradictionDensity: density,
    conflictSamples,
  };
}

/** Lyapunov / monotone-improvement helper: max upward ΔF in a rolling window. */
export function maxUpwardDeltaF(
  samples: Array<{ t: number; F: number }>,
  windowMs: number,
): { maxUp: number; pair: { from: number; to: number; dF: number } | null } {
  let maxUp = 0;
  let pair: { from: number; to: number; dF: number } | null = null;
  const sorted = [...samples].sort((a, b) => a.t - b.t);
  for (let i = 0; i < sorted.length; i++) {
    for (let j = 0; j < i; j++) {
      const dt = sorted[i].t - sorted[j].t;
      if (dt < 0 || dt > windowMs) continue;
      const dF = sorted[i].F - sorted[j].F;
      if (dF > maxUp) {
        maxUp = dF;
        pair = { from: sorted[j].t, to: sorted[i].t, dF };
      }
    }
  }
  return { maxUp, pair };
}

export function evaluateLyapunovWindow(
  history: Array<{ t: number; F: number }>,
  nowF: number,
  nowT: number,
  options?: {
    windowMs?: number;
    maxUpDelta?: number;
    exceptionActive?: boolean;
  },
): {
  maxUpDelta: number;
  breach: boolean;
  samples: number;
  exceptionActive: boolean;
  pair: { from: number; to: number; dF: number } | null;
} {
  const windowMs = options?.windowMs ?? 24 * 60 * 60 * 1000;
  const maxAllowed = options?.maxUpDelta ?? 0.08;
  const exceptionActive = Boolean(options?.exceptionActive);
  const points = [...history, { t: nowT, F: nowF }];
  // Keep only window
  const inWindow = points.filter((p) => nowT - p.t <= windowMs && nowT - p.t >= 0);
  const { maxUp, pair } = maxUpwardDeltaF(inWindow, windowMs);
  const breach = maxUp > maxAllowed && !exceptionActive;
  return {
    maxUpDelta: maxUp,
    breach,
    samples: inWindow.length,
    exceptionActive,
    pair,
  };
}

/**
 * Live operator sensors free energy contribution.
 * unknown/missing sensors contribute 0 (do not punish cold start).
 * fail sensors contribute fully; error/timeout count as fail.
 */
export function sensorFailRate(
  sensors: Array<{ id: string; status: 'pass' | 'fail' | 'error' | 'skip' | 'unknown' }>,
): number {
  const known = sensors.filter((s) => s.status !== 'skip' && s.status !== 'unknown');
  if (!known.length) return 0;
  const bad = known.filter((s) => s.status === 'fail' || s.status === 'error').length;
  return rate(bad, known.length);
}

export function parseLyapunovExceptions(
  md: string,
  nowMs: number,
): { active: boolean; rows: Array<{ until: string; note: string }> } {
  /**
   * Table rows: | ISO-date | maxΔF | reason | valid-until-ISO |
   * Or HTML comment: <!-- epistemic-lyapunov-exception until=2026-08-11 reason="…" -->
   */
  const rows: Array<{ until: string; note: string }> = [];
  for (const m of md.matchAll(
    /<!--\s*epistemic-lyapunov-exception\s+until=([0-9T:\-+.Z]+)\s+reason="([^"]*)"\s*-->/gi,
  )) {
    rows.push({ until: m[1], note: m[2] });
  }
  for (const line of md.split('\n')) {
    if (!/^\|/.test(line) || /Valid until/i.test(line) || /^\|\s*-+/.test(line)) continue;
    const cells = line
      .split('|')
      .map((c) => c.trim())
      .filter(Boolean);
    if (cells.length < 4) continue;
    const until = cells[3];
    if (!/^\d{4}-\d{2}-\d{2}/.test(until)) continue;
    rows.push({ until, note: cells[2] || '' });
  }
  const active = rows.some((r) => {
    const t = Date.parse(r.until);
    return Number.isFinite(t) && t >= nowMs;
  });
  return { active, rows };
}
