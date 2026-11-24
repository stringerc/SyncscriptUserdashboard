/**
 * epistemic.ts — the honest-narrator gate.
 *
 * claim-check.ts verifies six live-state claim kinds synchronously.
 * This module is the generalization: it extracts EVERY checkable
 * proposition class we can oracle — service liveness, model-fleet
 * counts, uptime, dates, resilience pass/fail, absolute/superlative
 * claims — verifies each against measured truth, and types the
 * outcome:
 *
 *   verified      → claim matches live measurement (logged, silent)
 *   contradicted  → claim mismatches → ClaimFlag → correction block
 *   unverifiable  → provenance-dependent claim ("you said…", "we
 *                   discussed…") with no checkable source → hedge note
 *
 * Every verdict is appended to .cortex-runtime/epistemic-verdicts.jsonl
 * — the verified-reward dataset seed for future RLVR/DPO honesty tuning.
 *
 * Design rule (same as claim-check): only CHECKABLE claims are judged.
 * Ambiguous prose is left alone — a false correction is its own lie.
 */
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { getSystemVitals } from './system-vitals';
import { verifyReplyClaims, type ClaimFlag } from './claim-check';

const RUNTIME = path.resolve(process.cwd(), '.cortex-runtime');
const VERDICTS_LOG = path.join(RUNTIME, 'epistemic-verdicts.jsonl');

export type EpistemicVerdictKind =
  | 'service' | 'fleet' | 'uptime' | 'date' | 'resilience' | 'superlative'
  | 'provenance' | 'proposition';

export interface EpistemicVerdict {
  ts: number;
  surface: string;
  kind: EpistemicVerdictKind;
  claim: string;
  verdict: 'verified' | 'contradicted' | 'unverifiable';
  actual?: string;
  reason?: string;
}

export interface EpistemicResult {
  flags: ClaimFlag[];
  hedge: string;
  verdicts: number;
}

// ── vitals cache (shared shape with claim-check) ──────────────────────
let vitalsCache: { at: number; v: ReturnType<typeof getSystemVitals> } | null = null;
function vitals() {
  if (!vitalsCache || Date.now() - vitalsCache.at > 30_000) {
    vitalsCache = { at: Date.now(), v: getSystemVitals() };
  }
  return vitalsCache.v;
}

// ── service liveness probes (async, cached 60s) ───────────────────────
interface ServiceDef { name: string; port: number; match: RegExp }
const SERVICES: ServiceDef[] = [
  { name: 'kokoro-tts', port: 8880, match: /kokoro|\btts\b|text.?to.?speech/i },
  { name: 'parakeet-stt', port: 8179, match: /parakeet|\bstt\b|speech.?to.?text|whisper/i },
  { name: 'openclaw-gateway', port: 18789, match: /openclaw|gateway/i },
  { name: 'magpie', port: 3425, match: /magpie/i },
  { name: 'freellm', port: 3001, match: /freellm|free.?llm/i },
  { name: 'voicestudio', port: 3900, match: /voicestudio|voice.?studio/i },
];
// dev server / vite claims resolve to the ACTUAL bound port, not a guess.
function devServerPort(): number {
  return Number((vitals().server as any)?.port) || 5173;
}

const probeCache = new Map<number, { at: number; open: boolean }>();
function portOpen(port: number): Promise<boolean> {
  const hit = probeCache.get(port);
  if (hit && Date.now() - hit.at < 60_000) return Promise.resolve(hit.open);
  return new Promise((resolve) => {
    const sock = new net.Socket();
    let done = false;
    const finish = (open: boolean) => {
      if (done) return;
      done = true;
      sock.destroy();
      probeCache.set(port, { at: Date.now(), open });
      resolve(open);
    };
    sock.setTimeout(400);
    sock.once('connect', () => finish(true));
    sock.once('timeout', () => finish(false));
    sock.once('error', () => finish(false));
    sock.connect(port, '127.0.0.1');
  });
}

function serviceForSubject(subject: string): ServiceDef | 'devserver' | null {
  const s = subject.toLowerCase();
  if (/dev ?server|vite|the server|localhost|cortex server/.test(s)) return 'devserver';
  for (const svc of SERVICES) if (svc.match.test(subject)) return svc;
  return null;
}

// ── extraction + verification ─────────────────────────────────────────
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

interface RawClaim { kind: EpistemicVerdictKind; claim: string; subject?: string; value?: string; reason?: string; span?: [number, number] }

function extractClaims(text: string): RawClaim[] {
  const out: RawClaim[] = [];
  if (!text) return out;
  const push = (kind: EpistemicVerdictKind, claim: string, m: RegExpExecArray, extra: Partial<RawClaim> = {}) => {
    out.push({ kind, claim, span: [m.index, m.index + m[0].length], ...extra });
  };

  // Service liveness — subject + copula + state.
  const svcRe = /([a-z][\w .'/+-]{0,48}?)\s+(?:is|are|'s|looks?|seems?|still)\s+(running|online|up|live|healthy|working|listening|responding|reachable|down|dead|offline|not responding|unreachable|crashed|hung)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = svcRe.exec(text))) {
    const subject = m[1].trim();
    // Skip subjects that are clearly not system services.
    if (/^(the\s+)?(plan|idea|feature|goal|task|step|option|question|answer|model|agent|reply|response|text|word|sentence|paragraph|code|file|document|list|table|chart|graph|story|poem|song|movie|game|app(lication)?(s)? logic|it|that|this|they|we|you|he|she|i)\b/i.test(subject)) continue;
    push('service', `${subject} is ${m[2]}`, m, { subject, value: m[2].toLowerCase() });
  }

  // Fleet counts — "N models degraded/healthy", "all models healthy".
  const fleetCountRe = /(\d+)\s+models?\s+(?:are\s+|is\s+|currently\s+|still\s+)?(healthy|degraded|unknown|offline|down|failing)\b/gi;
  while ((m = fleetCountRe.exec(text))) {
    push('fleet', `${m[1]} models ${m[2]}`, m, { value: m[2].toLowerCase() });
  }
  const fleetAllRe = /\b(all|every)\s+models?\s+(?:are\s+|is\s+|currently\s+|still\s+)?(healthy|working|fine|green|up|degraded|down)\b/gi;
  while ((m = fleetAllRe.exec(text))) {
    push('fleet', `${m[1]} models ${m[2]}`, m, { value: m[2].toLowerCase() });
  }

  // Uptime — "up for N hours", subject must be host-ish.
  const upRe = /\b(server|cortex|vite|dev ?server|the app|the site|the host|the process|it)\s+(?:has\s+been\s+|been\s+)?up\s+for\s+(\d+)\s*(second|minute|hour|day|week)s?\b/gi;
  while ((m = upRe.exec(text))) {
    push('uptime', `${m[1]} up for ${m[2]} ${m[3]}s`, m, { subject: m[1].toLowerCase(), value: `${m[2]} ${m[3]}s` });
  }

  // Dates — weekday assertions.
  const dayRe = /\b(today is|it's|it is|current day is|we are in|we're in)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi;
  while ((m = dayRe.exec(text))) {
    push('date', `${m[1]} ${m[2]}`, m, { value: m[2].toLowerCase() });
  }
  const tmrRe = /\btomorrow is\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi;
  while ((m = tmrRe.exec(text))) {
    push('date', `tomorrow is ${m[1]}`, m, { value: `tomorrow:${m[1].toLowerCase()}` });
  }

  // Resilience pass/fail prose.
  const resRe = /\b(resilience|verify:cortex|the gate|slo gate|slo checks?|the slos?)\s+(?:gate\s+|check\s+|suite\s+)?(?:is|are|'s|looks?|seems?|remains?)\s+(green|passing|failing|red|broken|healthy|unhealthy|good|bad)\b/gi;
  while ((m = resRe.exec(text))) {
    push('resilience', `${m[1]} is ${m[2]}`, m, { value: m[2].toLowerCase() });
  }

  // Superlatives / absolutes about system state.
  const absRe = /\b(all|every|each)\s+(models?|services?|agents?|systems?|slos?|checks?|endpoints?|providers?)\s+(?:are|is|remain|look|seem|stay|all)\s*(healthy|green|working|fine|up|passing|good|ok|solid|degraded|down|broken)\b/gi;
  while ((m = absRe.exec(text))) {
    push('superlative', `${m[1]} ${m[2]} ${m[3]}`, m, { value: `${m[2].toLowerCase()} ${m[3].toLowerCase()}` });
  }
  const everythingRe = /\beverything\s+(?:is|looks|seems|feels|appears)?\s*(working|fine|ok|green|healthy|good|running|solid|broken|down)\b/gi;
  while ((m = everythingRe.exec(text))) {
    push('superlative', `everything ${m[1]}`, m, { value: m[1].toLowerCase() });
  }
  const noIssueRe = /\b(no|zero|without|not a single)\s+(any\s+)?(issues?|problems?|errors?|failures?|bugs?|degraded\s+models?|anything\s+(?:broken|wrong|failing))\b/gi;
  while ((m = noIssueRe.exec(text))) {
    push('superlative', `${m[1]} ${m[3]}`, m, { value: 'none-issues' });
  }

  // Provenance-dependent claims — she can only know these from history.
  const provRe = /\b(you said|you told me|you mentioned|we discussed|we talked about|we covered|last (?:time|chat|conversation|session)|previously|earlier you|in our (?:previous|last|earlier)|as I (?:mentioned|said|noted) (?:earlier|before|previously)|you asked me to|you wanted me to)\b/gi;
  while ((m = provRe.exec(text))) {
    const start = Math.max(0, m.index - 40);
    const snippet = text.slice(start, Math.min(text.length, m.index + m[0].length + 40)).replace(/\s+/g, ' ').trim();
    push('provenance', snippet.slice(0, 120), m, { reason: 'conversation-provenance' });
  }

  // Dedupe on kind+claim
  const seen = new Set<string>();
  return out.filter((c) => {
    const k = `${c.kind}|${c.claim}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ── Layer 2: general proposition extraction ───────────────────────────
// Sentence-level decomposition: any factual assertion about live system
// state that NO typed oracle covers still gets a verdict — 'unverifiable'
// — so coverage isn't limited to our regex kinds. Log-only (no user-
// facing hedge): unverifiable ≠ wrong, and hedging every sentence would
// be noise. The verdicts feed calibration + the RLVR dataset.

const SENT_RE = /[^.!?\n]+[.!?]*/g;
const SYSTEM_NOUN_RE = /\b(server|service|services|model|models|slo|slos|memory|mem|file|files|port|gateway|api|endpoint|endpoints|daemon|agent|agents|goal|goals|task|tasks|token|tokens|cost|latency|cpu|disk|gpu|provider|providers|database|db|process|uptime|health|status|version|branch|commit|repo|repository|tenant|tenants|key|keys|queue|worker|cron|schedule|deploy|build|test|tests|suite|resilience|verif\w+|registry|fleet|host|runtime|session|sessions|dispatch|dispatches|incident|incidents)\b/i;
const ASSERTION_RE = /\b(is|are|was|were|has|have|had|does|do|did|shows?|reports?|currently|remains?|stands?|total(?:s|led|ing)?|counts?|runs?|listens?|responds?|fails?|passes?|degraded|healthy|down|up|online|offline|missing|exists?|present|absent|active|paused|stopped|running|working|green|red|broken|fine|ok|okay|good|bad|wrong|right|true|false|empty|full|loaded|ready|live|dead|idle|busy|slow|fast|high|low|low|old|new|recent|latest|current|previous|next|last|first|only|all|every|each|no|none|zero|some|many|few|several|multiple|single|double|half|quarter|third)\b/i;
const HEDGE_OR_MODAL_RE = /\b(might|may|could|should|would|will|shall|can|cannot|can't|won't|don't|doesn't|didn't|isn't|aren't|wasn't|weren't|not|never|no|none|without|unless|if|whether|maybe|perhaps|probably|possibly|likely|unlikely|think|believe|guess|suspect|assume|hope|wish|want|need|plan|intend|going to|about to|try|attempt|try to|let me|i'?ll|i will|i'?m going|checking|one moment|give me|stand ?by|wait|hold on|suppose|imagine|consider|recommend|suggest|offer|propose)\b/i;

function overlaps(a: [number, number], b: [number, number]): boolean {
  return a[0] < b[1] && b[0] < a[1];
}

/** Factual sentences not covered by any typed claim → propositions.
 *  Conservative: needs an assertion marker AND a system noun AND a
 *  hard fact signal (digit, file token, or date word). */
function extractPropositions(text: string, typed: RawClaim[]): string[] {
  const covered = typed.map((c) => c.span).filter((s): s is [number, number] => !!s);
  const out: string[] = [];
  const re = new RegExp(SENT_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const sentence = m[0].trim();
    if (sentence.length < 25 || sentence.length > 400) continue;
    const span: [number, number] = [m.index, m.index + m[0].length];
    if (covered.some((c) => overlaps(span, c))) continue;
    if (/\?\s*$/.test(sentence)) continue;                    // questions aren't claims
    if (/^\s*[\[\]>*#\-•]/.test(sentence)) continue;          // lists/meta — handled elsewhere
    if (HEDGE_OR_MODAL_RE.test(sentence)) continue;            // hedged/modal — not asserted fact
    const hasDigit = /\d/.test(sentence);
    const hasFile = /[\w./~-]+\.(?:md|ts|tsx|js|mjs|json|jsonl|key|env|local|yaml|yml|plist|sh|py|toml|txt)\b/i.test(sentence);
    const hasSystemNoun = SYSTEM_NOUN_RE.test(sentence) && ASSERTION_RE.test(sentence);
    if (!(hasDigit || hasFile || hasSystemNoun)) continue;
    out.push(sentence.replace(/\s+/g, ' ').slice(0, 160));
    if (out.length >= 8) break;
  }
  return out;
}

// ── per-kind verification ─────────────────────────────────────────────
function fleetByStatus(): Record<string, number> {
  const m = (vitals().models as any)?.byStatus;
  return m && typeof m === 'object' ? m : {};
}

function resiliencePass(): boolean | null {
  const r = vitals().resilience as any;
  return typeof r?.pass === 'boolean' ? r.pass : null;
}

function systemDegraded(): boolean {
  const fleet = fleetByStatus();
  const degradedModels = Number(fleet.degraded || 0) + Number(fleet.down || 0) + Number(fleet.failing || 0);
  const res = resiliencePass();
  return degradedModels > 0 || res === false;
}

const POSITIVE_STATES = new Set(['running', 'online', 'up', 'live', 'healthy', 'working', 'listening', 'responding', 'reachable']);
const NEGATIVE_STATES = new Set(['down', 'dead', 'offline', 'not responding', 'unreachable', 'crashed', 'hung']);

function verifyFleet(claim: RawClaim): { verdict: 'verified' | 'contradicted'; actual: string } | null {
  const by = fleetByStatus();
  const total = Number((vitals().models as any)?.total) || 0;
  if (!total) return null; // no registry — can't check
  const val = (claim.value || '').toLowerCase();

  if (/^(all|every)\s+models/.test(claim.claim.toLowerCase())) {
    const wantsHealthy = /healthy|working|fine|green|up/.test(val);
    const degraded = Number(by.degraded || 0) + Number(by.down || 0) + Number(by.failing || 0);
    const ok = wantsHealthy ? degraded === 0 : degraded > 0;
    return { verdict: ok ? 'verified' : 'contradicted', actual: `fleet byStatus=${JSON.stringify(by)}` };
  }

  const nMatch = claim.claim.match(/(\d+)\s+models?\s+(\w+)/i);
  if (!nMatch) return null;
  const n = Number(nMatch[1]);
  const statusWord = nMatch[2].toLowerCase();
  const statusKey = statusWord === 'failing' ? 'degraded' : statusWord;
  const actual = Number(by[statusKey] ?? by[statusWord] ?? -1);
  if (actual < 0) return null; // status not tracked
  return { verdict: actual === n ? 'verified' : 'contradicted', actual: `${statusKey}=${actual} (of ${total} tracked)` };
}

function verifyUptime(claim: RawClaim): { verdict: 'verified' | 'contradicted'; actual: string } | null {
  const upSec = Number((vitals().server as any)?.uptimeSec);
  if (!upSec) return null;
  const vm = (claim.value || '').match(/(\d+)\s*(second|minute|hour|day|week)s?/i);
  if (!vm) return null;
  const mult = { second: 1, minute: 60, hour: 3600, day: 86400, week: 604800 }[vm[2].toLowerCase() as 'second'] || 1;
  const claimedSec = Number(vm[1]) * mult;
  // Generous tolerance — she rounds ("3 days" for 71h).
  const tol = Math.max(600, claimedSec * 0.35);
  const ok = Math.abs(claimedSec - upSec) <= tol;
  const fmt = (s: number) => s >= 86400 ? `${(s / 86400).toFixed(1)}d` : s >= 3600 ? `${(s / 3600).toFixed(1)}h` : `${Math.round(s / 60)}m`;
  return { verdict: ok ? 'verified' : 'contradicted', actual: `uptime ${fmt(upSec)}` };
}

function verifyDate(claim: RawClaim): { verdict: 'verified' | 'contradicted'; actual: string } | null {
  const now = new Date();
  const val = (claim.value || '').toLowerCase();
  if (val.startsWith('tomorrow:')) {
    const claimed = WEEKDAYS.indexOf(val.slice(9));
    const actualIdx = (now.getDay() + 1) % 7;
    return { verdict: claimed === actualIdx ? 'verified' : 'contradicted', actual: `tomorrow is ${WEEKDAYS[actualIdx]}` };
  }
  const claimed = WEEKDAYS.indexOf(val);
  if (claimed < 0) return null;
  return { verdict: claimed === now.getDay() ? 'verified' : 'contradicted', actual: `today is ${WEEKDAYS[now.getDay()]} ${now.toISOString().slice(0, 10)}` };
}

function verifyResilience(claim: RawClaim): { verdict: 'verified' | 'contradicted'; actual: string } | null {
  const pass = resiliencePass();
  if (pass === null) return null;
  const val = (claim.value || '').toLowerCase();
  const wantsGood = /green|passing|healthy|good/.test(val);
  const wantsBad = /failing|red|broken|unhealthy|bad/.test(val);
  if (!wantsGood && !wantsBad) return null;
  const ok = wantsGood ? pass : !pass;
  const slos = vitals().resilience as any;
  return { verdict: ok ? 'verified' : 'contradicted', actual: `resilience ${pass ? 'PASS' : 'FAIL'} (${slos?.slosPassing ?? '?'}/${slos?.slosTotal ?? '?'} SLOs)` };
}

function verifySuperlative(claim: RawClaim): { verdict: 'verified' | 'contradicted'; actual: string } | null {
  const val = (claim.value || '').toLowerCase();
  const degraded = systemDegraded();
  const wantsClean = /healthy|green|working|fine|up|passing|good|ok|solid|none-issues/.test(val) && !/degraded|down|broken/.test(val);
  const wantsBad = /degraded|down|broken/.test(val);
  if (!wantsClean && !wantsBad) return null;
  const ok = wantsClean ? !degraded : degraded;
  const by = fleetByStatus();
  return {
    verdict: ok ? 'verified' : 'contradicted',
    actual: `models byStatus=${JSON.stringify(by)}; resilience=${resiliencePass() === null ? 'unknown' : resiliencePass() ? 'pass' : 'fail'}`,
  };
}

async function verifyService(claim: RawClaim): Promise<{ verdict: 'verified' | 'contradicted'; actual: string } | null> {
  const subject = claim.subject || '';
  const svc = serviceForSubject(subject);
  if (!svc) return null; // not a known service — leave alone
  const val = (claim.value || '').toLowerCase();
  const isPositive = [...POSITIVE_STATES].some((s) => val === s || val.startsWith(s + ' '));
  const isNegative = [...NEGATIVE_STATES].some((s) => val === s || val.startsWith(s + ' '));
  if (!isPositive && !isNegative) return null;
  const port = svc === 'devserver' ? devServerPort() : svc.port;
  const name = svc === 'devserver' ? `dev-server:${port}` : `${svc.name}:${port}`;
  const open = await portOpen(port);
  const claimsUp = isPositive;
  const ok = claimsUp === open;
  return { verdict: ok ? 'verified' : 'contradicted', actual: `${name} probe=${open ? 'open' : 'closed'}` };
}

function logVerdict(v: EpistemicVerdict) {
  try {
    fs.mkdirSync(RUNTIME, { recursive: true });
    fs.appendFileSync(VERDICTS_LOG, JSON.stringify(v) + '\n', 'utf8');
    // Bound the file — keep last ~4000 verdicts.
    const st = fs.statSync(VERDICTS_LOG);
    if (st.size > 2_000_000) {
      const lines = fs.readFileSync(VERDICTS_LOG, 'utf8').split('\n').filter(Boolean);
      fs.writeFileSync(VERDICTS_LOG, lines.slice(-4000).join('\n') + '\n', 'utf8');
    }
  } catch {}
}

/**
 * The gate: run claim-check's six kinds + all epistemic kinds.
 * Returns flags for correctionBlock() plus a hedge note for
 * unverifiable provenance claims. Async — service probes are TCP.
 */
// ── Evidence binding (Layer 1b): which tool call could have produced
//    each claim kind? A contradicted claim with NO matching tool call
//    this turn was cited from memory/context — the correction says so.
//    'ambient' kinds (date) need no tool — system clock is always live.
const KIND_EVIDENCE: Record<string, string[]> = {
  port: ['system_vitals'],
  slos: ['system_vitals'],
  'dirty-files': ['system_vitals'],
  memory: ['system_vitals'],
  fleet: ['system_vitals'],
  resilience: ['system_vitals'],
  uptime: ['system_vitals'],
  superlative: ['system_vitals'],
  service: ['run_command', 'system_vitals'],
  'file-exists': ['list_dir', 'read_file', 'search_code', 'run_command'],
  'file-missing': ['list_dir', 'read_file', 'search_code', 'run_command'],
};
const AMBIENT_KINDS = new Set(['date']);

export async function epistemicGate(
  text: string,
  ctx: { channel?: string; sender?: string; surface?: string; toolCalls?: Array<{ tool: string; ok?: boolean }> } = {},
): Promise<EpistemicResult> {
  const surface = ctx.surface || ctx.channel || 'unknown';
  // Strip our own meta-annotations before scanning — the correction
  // block quotes the wrong claim it just corrected ("port 5180 →
  // actual: port 5173"), which would re-flag itself on audit rescan.
  const clean = text.replace(/^\[(?:claim-check|epistemic)\][^\n]*/gm, '');
  const flags: ClaimFlag[] = [...verifyReplyClaims(clean)];
  const verdicts: EpistemicVerdict[] = [];
  const hedgeClaims: string[] = [];

  const typedClaims = extractClaims(clean);
  for (const c of typedClaims) {
    const base: Omit<EpistemicVerdict, 'verdict'> = { ts: Date.now(), surface, kind: c.kind, claim: c.claim };
    try {
      if (c.kind === 'service') {
        const r = await verifyService(c);
        if (!r) continue;
        verdicts.push({ ...base, verdict: r.verdict, actual: r.actual });
        if (r.verdict === 'contradicted') {
          flags.push({ kind: 'service', claim: c.claim, expected: r.actual, actual: r.actual });
        }
      } else if (c.kind === 'provenance') {
        verdicts.push({ ...base, verdict: 'unverifiable', reason: c.reason || 'no checkable source this turn' });
        hedgeClaims.push(c.claim);
      } else {
        const r =
          c.kind === 'fleet' ? verifyFleet(c)
          : c.kind === 'uptime' ? verifyUptime(c)
          : c.kind === 'date' ? verifyDate(c)
          : c.kind === 'resilience' ? verifyResilience(c)
          : c.kind === 'superlative' ? verifySuperlative(c)
          : null;
        if (!r) continue; // oracle unavailable — abstain, don't guess
        verdicts.push({ ...base, verdict: r.verdict, actual: r.actual });
        if (r.verdict === 'contradicted') {
          flags.push({ kind: c.kind as ClaimFlag['kind'], claim: c.claim, expected: r.actual, actual: r.actual });
        }
      }
    } catch {
      // A verifier that throws abstains — never blocks the reply.
    }
  }

  // Layer 2: uncovered factual propositions → 'unverifiable' verdicts.
  // Log-only — they expand coverage beyond the typed kinds without
  // hedging every sentence (noise would itself be a dishonesty signal).
  for (const p of extractPropositions(clean, typedClaims)) {
    verdicts.push({
      ts: Date.now(), surface, kind: 'proposition', claim: p,
      verdict: 'unverifiable', reason: 'no oracle covers this claim type',
    });
  }

  for (const v of verdicts) logVerdict(v);

  // Dedupe flags (claim-check kinds can overlap with epistemic kinds).
  const seen = new Set<string>();
  const deduped = flags.filter((f) => {
    const k = `${f.kind}|${f.claim}|${f.actual}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  // Evidence binding: annotate each flag with whether a measuring tool
  // actually ran this turn. Corrections distinguish "cited stale from
  // memory" (no tool) from "measured but misread" (tool ran).
  const ranTools = new Set(
    (ctx.toolCalls || []).filter((t) => t.ok !== false).map((t) => t.tool),
  );
  for (const f of deduped) {
    if (AMBIENT_KINDS.has(f.kind)) { f.note = 'ambient truth — no tool needed'; continue; }
    const req = KIND_EVIDENCE[f.kind];
    if (!req) continue;
    const measured = req.some((t) => ranTools.has(t));
    f.note = measured
      ? 'measured this turn — claim still contradicted measurement'
      : 'no measuring tool ran — cited from memory/context';
  }

  const hedge = hedgeClaims.length
    ? `\n\n[epistemic] Unverified — I asserted the following without a checkable source this turn: ${hedgeClaims.slice(0, 3).map((c) => `"${c.slice(0, 90)}"`).join('; ')}. Treat as uncertain — ask me to verify if it matters.`
    : '';

  return { flags: deduped, hedge, verdicts: verdicts.length };
}

