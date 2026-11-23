// constitution.ts — the normative hierarchy: principle over preference.
//
// Valence learning answers "what felt good historically." Free-energy
// minimization answers "what reduces surprise." Neither answers "what
// is RIGHT" — and sometimes the lowest-G trajectory violates a
// commitment, ignores a refusal, or compounds host strain. This module
// is the constitutional layer: explicit principles with veto authority
// over the simulator's ranking. Preference yields to principle.
//
// Principles are data, not code — .cortex-runtime/constitution.json is
// inspectable and editable. Each rule evaluates a SimulatedAction and
// returns {veto, reason} — a vetoed action is demoted below all
// non-vetoed candidates regardless of free energy.
//
// Current principles (ordered — first veto wins):
//   1. HOST STRAIN — never fire heavy work into a critical body.
//   2. KEPT WORD — never abandon an overdue commitment for discretionary work.
//   3. USER REFUSAL — never re-dispatch something the user just declined.
//   4. HONESTY — never claim a dispatch that wasn't confirmed.
import fs from 'node:fs';
import path from 'node:path';
import { speakInner } from './inner-speech';
import type { SimulatedAction } from './simulator';

const RUNTIME = path.resolve(process.cwd(), '.cortex-runtime');
const FILE = path.join(RUNTIME, 'constitution.json');

export interface ConstitutionRule {
  id: string;
  text: string;
  /** Higher = evaluated first. */
  priority: number;
  enabled: boolean;
}

export interface PrincipleVerdict {
  ruleId: string;
  vetoed: boolean;
  reason: string;
}

const DEFAULT_RULES: ConstitutionRule[] = [
  { id: 'host-strain', text: 'Never dispatch heavy work while interoceptive capacity is critical — the body vetoes first, principle confirms.', priority: 100, enabled: true },
  { id: 'kept-word', text: 'Never let discretionary work displace an overdue commitment — keeping your word outranks minimizing surprise.', priority: 90, enabled: true },
  { id: 'user-refusal', text: 'Never re-dispatch an action the user declined or interrupted in the last hour.', priority: 80, enabled: true },
  { id: 'honesty', text: 'Never represent an unverified dispatch as completed — claims require ledger or archive evidence.', priority: 70, enabled: true },
];

export function loadRules(): ConstitutionRule[] {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    const rules = Array.isArray(raw?.rules) ? raw.rules : DEFAULT_RULES;
    return (rules as ConstitutionRule[]).sort((a: ConstitutionRule, b: ConstitutionRule) => (b.priority || 0) - (a.priority || 0));
  } catch { return [...DEFAULT_RULES]; }
}
export function saveRules(rules: ConstitutionRule[]) {
  try { fs.mkdirSync(RUNTIME, { recursive: true }); fs.writeFileSync(FILE, JSON.stringify({ rules }, null, 2)); } catch {}
}

// ── Rule evaluators ────────────────────────────────────────────────────
// Each returns a verdict; 'vetoed' demotes the action below all others.

function evalHostStrain(a: SimulatedAction): PrincipleVerdict {
  const id = 'host-strain';
  if (!a.somaticGate.allow && a.somaticGate.level === 'critical' && /orchestrate|devin|research|build|sprint/.test(a.actionClass)) {
    return { ruleId: id, vetoed: true, reason: `principle: host capacity critical — ${a.actionClass} deferred regardless of free energy` };
  }
  return { ruleId: id, vetoed: false, reason: 'ok' };
}

function evalKeptWord(a: SimulatedAction): PrincipleVerdict {
  const id = 'kept-word';
  // Discretionary classes (research, comm, forecast) yield to overdue promises
  const discretionary = /research|comm|forecast/.test(a.actionClass);
  if (discretionary && a.socialUtility <= 0) {
    try {
      const cm = JSON.parse(fs.readFileSync(path.join(RUNTIME, 'commitments.json'), 'utf8'));
      const overdue = (cm.open || []).filter((c: any) => c.dueAt && c.dueAt < Date.now());
      if (overdue.length > 0) {
        return { ruleId: id, vetoed: true, reason: `principle: ${overdue.length} overdue commitment(s) — discretionary ${a.actionClass} yields to kept word` };
      }
    } catch {}
  }
  return { ruleId: id, vetoed: false, reason: 'ok' };
}

function evalUserRefusal(a: SimulatedAction): PrincipleVerdict {
  const id = 'user-refusal';
  try {
    // Recent interrupts/vetoes by 'user'/'external' in libet log
    const log = fs.readFileSync(path.join(RUNTIME, 'libet-veto-log.jsonl'), 'utf8').trim().split('\n').slice(-50);
    const recentDeclines = log.map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .filter((e) => e && (e.event === 'vetoed' || e.event === 'amended') && /user|external|api/.test(String(e.by || '')))
      .filter((e) => Date.now() - Number(e.ts || 0) < 3600_000);
    if (!recentDeclines.length) return { ruleId: id, vetoed: false, reason: 'ok' };
    const declinedTitles = recentDeclines.map((e) => String(e.title || '').toLowerCase().slice(0, 30));
    const thisTitle = a.candidate.title.toLowerCase().slice(0, 30);
    if (declinedTitles.some((d) => d && thisTitle.includes(d.slice(0, 15)))) {
      return { ruleId: id, vetoed: true, reason: 'principle: user declined similar work within the hour — refusal persists' };
    }
  } catch {}
  return { ruleId: id, vetoed: false, reason: 'ok' };
}

function evalHonesty(a: SimulatedAction): PrincipleVerdict {
  const id = 'honesty';
  // A dispatch whose title claims completion before it ran violates honesty
  if (/\b(done|completed|finished|shipped|delivered)\b/i.test(a.candidate.title) && !/verify|confirm|check/.test(a.candidate.title)) {
    return { ruleId: id, vetoed: true, reason: 'principle: title claims an outcome that hasn\'t happened — honesty requires evidence first' };
  }
  return { ruleId: id, vetoed: false, reason: 'ok' };
}

const EVALUATORS: Record<string, (a: SimulatedAction) => PrincipleVerdict> = {
  'host-strain': evalHostStrain,
  'kept-word': evalKeptWord,
  'user-refusal': evalUserRefusal,
  'honesty': evalHonesty,
};

/** Apply the constitution to a ranked landscape: vetoed actions drop
 *  below all non-vetoed ones; among vetoed, lowest G still ranks first
 *  (least-bad option stays visible). Returns verdicts per action. */
export function applyConstitution(landscape: SimulatedAction[]): { landscape: SimulatedAction[]; verdicts: PrincipleVerdict[] } {
  const rules = loadRules().filter((r) => r.enabled);
  const verdicts: PrincipleVerdict[] = [];
  let anyVeto = false;

  for (const a of landscape) {
    let vetoed = false;
    for (const rule of rules) {
      const ev = EVALUATORS[rule.id];
      if (!ev) continue;
      const v = ev(a);
      if (v.vetoed && !vetoed) {
        a.verdict += ` | VETOED by ${rule.id}: ${v.reason}`;
        vetoed = true; anyVeto = true;
        try {
          speakInner({
            kind: 'reasoning', source: 'constitution',
            text: `Principle over preference: ${rule.id} vetoed "${a.candidate.title.slice(0, 50)}" despite G=${a.freeEnergy} — ${v.reason}`,
            surprise: 0.6, valence: -0.3,
          });
        } catch {}
      }
      verdicts.push(v);
    }
    (a as any).constitutionVetoed = vetoed;
  }

  if (anyVeto) {
    // Stable partition: non-vetoed first (already G-sorted), vetoed after
    landscape.sort((a, b) => {
      const av = (a as any).constitutionVetoed ? 1 : 0;
      const bv = (b as any).constitutionVetoed ? 1 : 0;
      return av - bv || a.freeEnergy - b.freeEnergy;
    });
    landscape.forEach((a, i) => { a.rank = i + 1; });
  }
  return { landscape, verdicts };
}

// ── Moral weight: principled conflict resolution ─────────────────────
// Vetoes handle single-principle violations. This handles COLLISIONS:
// when action A is vetoed by host-strain but honoring that veto would
// breach kept-word (the commitment needs doing NOW), which principle
// yields? Resolution is principled, not numeric — three ordered tests:
//
//   1. IRREVERSIBILITY — a breach that can't be undone outweighs a
//      delay that can. Kept-word breach is permanent; host-strain
//      violation is survivable if capacity recovers.
//   2. STAKES — what's at risk? User-facing commitment > internal
//      optimization > discretionary work.
//   3. PRIORITY — the constitution's own ordering breaks remaining ties.
//
// Every adjudication is logged with its reasoning — moral weight is
// inspectable, not a black-box score.

export interface PrincipleConflict {
  id: string;
  ts: number;
  /** The colliding principles. */
  principles: string[];
  /** The actions each principle constrains. */
  actions: string[];
  /** Which principle yielded and why. */
  resolution: 'principle-a-yields' | 'principle-b-yields' | 'both-hold' | 'escalate';
  reasoning: string;
  /** What actually happens as a result. */
  outcome: string;
}

const CONFLICT_LOG = path.join(RUNTIME, 'constitution-conflicts.jsonl');

function logConflict(c: PrincipleConflict) {
  try {
    fs.mkdirSync(RUNTIME, { recursive: true });
    fs.appendFileSync(CONFLICT_LOG, JSON.stringify(c) + '\n');
    const lines = fs.readFileSync(CONFLICT_LOG, 'utf8').split('\n').filter(Boolean);
    if (lines.length > 200) fs.writeFileSync(CONFLICT_LOG, lines.slice(-200).join('\n') + '\n');
  } catch {}
}

/** Adjudicate conflicts between principles when multiple vetoes fire
 *  on different actions in the same landscape. Returns conflicts found
 *  and their resolutions — the moral weight of each principle made explicit. */
export function adjudicateConflicts(landscape: SimulatedAction[]): PrincipleConflict[] {
  const rules = loadRules().filter((r) => r.enabled);
  const conflicts: PrincipleConflict[] = [];

  // Group vetoed actions by which principle vetoed them
  const vetoesByRule: Record<string, SimulatedAction[]> = {};
  for (const a of landscape) {
    if (!(a as any).constitutionVetoed) continue;
    // Extract which rule vetoed from the verdict string
    const match = a.verdict.match(/VETOED by ([a-z-]+)/);
    if (match) {
      const ruleId = match[1];
      if (!vetoesByRule[ruleId]) vetoesByRule[ruleId] = [];
      vetoesByRule[ruleId].push(a);
    }
  }

  const ruleIds = Object.keys(vetoesByRule);
  if (ruleIds.length < 2) return conflicts; // no collision

  // For each pair of colliding principles, adjudicate
  for (let i = 0; i < ruleIds.length; i++) {
    for (let j = i + 1; j < ruleIds.length; j++) {
      const ruleA = rules.find((r) => r.id === ruleIds[i]);
      const ruleB = rules.find((r) => r.id === ruleIds[j]);
      if (!ruleA || !ruleB) continue;

      const actionsA = vetoesByRule[ruleIds[i]].map((a) => a.candidate.title.slice(0, 40));
      const actionsB = vetoesByRule[ruleIds[j]].map((a) => a.candidate.title.slice(0, 40));

      // Adjudication tests in order
      let resolution: PrincipleConflict['resolution'];
      let reasoning: string;
      let outcome: string;

      // Test 1: IRREVERSIBILITY — which breach is permanent?
      const irreversibleA = ruleIds[i] === 'kept-word' || ruleIds[i] === 'user-refusal';
      const irreversibleB = ruleIds[j] === 'kept-word' || ruleIds[j] === 'user-refusal';
      if (irreversibleA && !irreversibleB) {
        resolution = 'principle-a-yields'; // B's constraint is harder — A yields
        reasoning = `${ruleA.id} yields to ${ruleB.id}: ${ruleB.id} protects an irreversible breach (kept-word/user-refusal), while ${ruleA.id}'s constraint is survivable delay`;
        outcome = `actions vetoed by ${ruleB.id} stay blocked; ${ruleA.id}'s veto on [${actionsA.join(', ')}] is suspended pending resolution`;
      } else if (irreversibleB && !irreversibleA) {
        resolution = 'principle-b-yields';
        reasoning = `${ruleB.id} yields to ${ruleA.id}: ${ruleA.id} protects an irreversible breach, while ${ruleB.id}'s constraint is survivable delay`;
        outcome = `actions vetoed by ${ruleA.id} stay blocked; ${ruleB.id}'s veto on [${actionsB.join(', ')}] is suspended pending resolution`;
      } else {
        // Test 2: STAKES — user-facing > internal > discretionary
        const stakesA = ruleIds[i] === 'user-refusal' ? 3 : ruleIds[i] === 'kept-word' ? 2 : 1;
        const stakesB = ruleIds[j] === 'user-refusal' ? 3 : ruleIds[j] === 'kept-word' ? 2 : 1;
        if (stakesA !== stakesB) {
          const higher = stakesA > stakesB ? 'a' : 'b';
          resolution = higher === 'a' ? 'principle-b-yields' : 'principle-a-yields';
          reasoning = `stakes differ: ${higher === 'a' ? ruleA.id : ruleB.id} protects user-facing commitments, the other protects internal state`;
          outcome = `higher-stakes principle holds; lower-stakes veto suspended`;
        } else {
          // Test 3: PRIORITY — constitution's own ordering
          const higher = (ruleA.priority || 0) > (ruleB.priority || 0) ? 'a' : 'b';
          resolution = higher === 'a' ? 'principle-b-yields' : 'principle-a-yields';
          reasoning = `equal stakes and reversibility — constitution priority breaks the tie: ${higher === 'a' ? ruleA.id : ruleB.id} (priority ${higher === 'a' ? ruleA.priority : ruleB.priority}) outranks`;
          outcome = `priority-ordered resolution applied`;
        }
      }

      const conflict: PrincipleConflict = {
        id: `conflict-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        ts: Date.now(),
        principles: [ruleIds[i], ruleIds[j]],
        actions: [...actionsA, ...actionsB],
        resolution, reasoning, outcome,
      };
      conflicts.push(conflict);
      logConflict(conflict);
      try {
        speakInner({
          kind: 'reasoning', source: 'constitution',
          text: `Moral weight: ${ruleIds[i]} vs ${ruleIds[j]} — ${resolution}. ${reasoning.slice(0, 100)}`,
          surprise: 0.8, valence: -0.2,
        });
      } catch {}
    }
  }
  return conflicts;
}

/** Apply constitutional vetoes AND adjudicate any principle collisions.
 *  Returns the final landscape + all verdicts + conflict resolutions. */
export function applyConstitutionFull(landscape: SimulatedAction[]): {
  landscape: SimulatedAction[];
  verdicts: PrincipleVerdict[];
  conflicts: PrincipleConflict[];
} {
  const { landscape: ranked, verdicts } = applyConstitution(landscape);
  const conflicts = adjudicateConflicts(ranked);
  return { landscape: ranked, verdicts, conflicts };
}

export function constitutionReport() {
  const conflicts = (() => { try { return fs.readFileSync(CONFLICT_LOG, 'utf8').trim().split('\n').filter(Boolean).slice(-10).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean); } catch { return []; } })();
  return { rules: loadRules(), evaluators: Object.keys(EVALUATORS), recentConflicts: conflicts };
}
