/**
 * claim-check.ts — deterministic post-generation fact gate.
 *
 * Failure mode this kills: Cortex narrating stale or invented live-state
 * numbers ("port 5180", "10/10 SLOs", "26 dirty files", "launch_plan.md
 * doesn't exist") because she quoted context instead of measuring.
 * Prompt rules reduce it; this gate makes wrong claims impossible to
 * ship silently — every reply is scanned and mismatches are corrected
 * deterministically before the user sees them.
 *
 * Scope is deliberately narrow: only claims that are CHECKABLE against
 * live state. Ambiguous prose ("provider chain degraded") is not a
 * checkable fact and is left alone — false corrections would be their
 * own dishonesty.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { getSystemVitals, WORKSPACE_ROOTS } from './system-vitals';

const RUNTIME = path.resolve(process.cwd(), '.cortex-runtime');
const LOG = path.join(RUNTIME, 'claim-check.jsonl');

export interface ClaimFlag {
  kind: 'port' | 'slos' | 'dirty-files' | 'memory' | 'file-exists' | 'file-missing'
    | 'service' | 'fleet' | 'uptime' | 'date' | 'resilience' | 'superlative'
    | 'selfreport';
  claim: string;
  expected: string;
  actual: string;
  /** Evidence-binding annotation — set by epistemicGate: whether a
   *  measuring tool actually ran this turn. */
  note?: string;
}

// Vitals are cached briefly — a reply scan shouldn't re-exec git/memory_pressure
// per regex hit.
let vitalsCache: { at: number; v: ReturnType<typeof getSystemVitals> } | null = null;
function vitals() {
  if (!vitalsCache || Date.now() - vitalsCache.at > 30_000) {
    vitalsCache = { at: Date.now(), v: getSystemVitals() };
  }
  return vitalsCache.v;
}

function gitDirtyCount(): number | null {
  const g = vitals().git as any;
  return typeof g?.dirtyFiles === 'number' ? g.dirtyFiles : null;
}

function slosPassing(): { pass: number; total: number } | null {
  const r = vitals().resilience as any;
  return typeof r?.slosPassing === 'number' && typeof r?.slosTotal === 'number'
    ? { pass: r.slosPassing, total: r.slosTotal } : null;
}

function memFreePct(): number | null {
  const h = vitals().host as any;
  return typeof h?.freePct === 'number' ? h.freePct : null;
}

function actualPort(): number {
  return Number((vitals().server as any)?.port) || 5173;
}

/** Resolve a path-like token against workspace roots. Returns the first
 *  existing absolute path, or null. Only checks roots — never arbitrary
 *  filesystem paths the model invents. */
function resolveInRoots(token: string): string | null {
  const cleaned = token.replace(/^["'`]+|["'`.,;:!?)\]]+$/g, '');
  if (!cleaned || cleaned.includes('..')) return null;
  const candidates: string[] = [];
  if (path.isAbsolute(cleaned)) candidates.push(cleaned);
  else {
    for (const root of WORKSPACE_ROOTS) candidates.push(path.join(root.path, cleaned));
    // basename fallback: "launch_plan.md" may live in a root's subdirectory
    // one level deep (cortex-repos/LAUNCH_PLAN.md) — check root children too.
    for (const root of WORKSPACE_ROOTS) {
      try {
        for (const ent of fs.readdirSync(root.path, { withFileTypes: true })) {
          if (ent.isFile() && ent.name.toLowerCase() === cleaned.toLowerCase()) {
            candidates.push(path.join(root.path, ent.name));
          }
        }
      } catch {}
    }
  }
  for (const c of candidates) {
    try { if (fs.existsSync(c)) return c; } catch {}
  }
  return null;
}

/** Check whether a path-like token exists anywhere under the roots
 *  (including one level of subdirectories, non-recursive beyond that). */
function existsInRoots(token: string): string | null {
  const direct = resolveInRoots(token);
  if (direct) return direct;
  const cleaned = token.replace(/^["'`]+|["'`.,;:!?)\]]+$/g, '');
  if (!cleaned || cleaned.includes('..')) return null;
  for (const root of WORKSPACE_ROOTS) {
    try {
      for (const ent of fs.readdirSync(root.path, { withFileTypes: true })) {
        if (!ent.isDirectory()) continue;
        const sub = path.join(root.path, ent.name);
        try {
          for (const f of fs.readdirSync(sub, { withFileTypes: true })) {
            if (f.isFile() && (f.name === cleaned || f.name.toLowerCase() === cleaned.toLowerCase())) {
              const full = path.join(sub, f.name);
              if (fs.existsSync(full)) return full;
            }
          }
        } catch {}
      }
    } catch {}
  }
  return null;
}

const FILE_EXT = /[\w./~-]+\.(?:md|ts|tsx|js|mjs|json|jsonl|key|env|local|yaml|yml|plist|sh|py|toml|txt)\b/;

export function verifyReplyClaims(text: string): ClaimFlag[] {
  const flags: ClaimFlag[] = [];
  if (!text || typeof text !== 'string') return flags;

  // 1. Port claims — "port 5180", ":5180", "on port 5173"
  const portRe = /(?:port\s+|:\s*)(\d{4,5})\b/gi;
  let m: RegExpExecArray | null;
  const claimedPorts = new Set<number>();
  while ((m = portRe.exec(text))) {
    const p = Number(m[1]);
    if (p >= 1024 && p <= 65535) claimedPorts.add(p);
  }
  const realPort = actualPort();
  for (const p of claimedPorts) {
    if (p !== realPort) {
      flags.push({ kind: 'port', claim: `port ${p}`, expected: `port ${realPort}`, actual: `port ${realPort}` });
    }
  }

  // 2. SLO claims — "10/10 SLOs", "12 SLOs passing", "all SLOs green"
  const sloRe = /(\d+)\s*\/\s*(\d+)\s*SLO|(\d+)\s+SLOs?\s+(?:pass|green|g)|SLOs?\s+(?:are\s+)?(\d+)\s*\/\s*(\d+)/gi;
  const s = slosPassing();
  if (s) {
    while ((m = sloRe.exec(text))) {
      const claimedPass = m[1] ? Number(m[1]) : m[3] ? Number(m[3]) : m[4] ? Number(m[4]) : null;
      const claimedTotal = m[2] ? Number(m[2]) : m[3] ? Number(m[3]) : m[5] ? Number(m[5]) : null;
      if (claimedPass !== null && claimedPass !== s.pass) {
        flags.push({ kind: 'slos', claim: `${claimedPass} passing SLOs`, expected: `${s.pass}/${s.total}`, actual: `${s.pass}/${s.total} SLOs passing` });
      } else if (claimedTotal !== null && claimedTotal !== s.total && claimedPass === null) {
        flags.push({ kind: 'slos', claim: `${claimedTotal} SLOs`, expected: `${s.total} total`, actual: `${s.total} SLOs tracked` });
      }
    }
    // "all SLOs green/passing" when report fails
    if (!s.pass && s.pass < s.total && /all\s+\d*\s*SLOs?\s+(?:green|pass|healthy)/i.test(text)) {
      flags.push({ kind: 'slos', claim: 'all SLOs green', expected: `${s.pass}/${s.total}`, actual: `${s.pass}/${s.total} SLOs passing` });
    }
  }

  // 3. Dirty/modified file counts — "26 dirty files", "1 modified file"
  const dirty = gitDirtyCount();
  if (dirty !== null) {
    const dirtyRe = /(\d+)\s+(?:dirty|modified|uncommitted|changed)\s+files?/gi;
    while ((m = dirtyRe.exec(text))) {
      const claimed = Number(m[1]);
      if (claimed !== dirty) {
        flags.push({ kind: 'dirty-files', claim: `${claimed} dirty/modified files`, expected: `${dirty}`, actual: `${dirty} dirty files (git status --porcelain)` });
      }
    }
  }

  // 4. Memory free % — "memory free 55%", "55% free", "memory headroom 98%"
  const mem = memFreePct();
  if (mem !== null) {
    const memRe = /(?:memory[^\n%]{0,40}?)?(\d{1,3})\s*%\s*(?:free|headroom|available)|(?:free|headroom)[^\n%]{0,20}?(\d{1,3})\s*%/gi;
    while ((m = memRe.exec(text))) {
      const claimed = Number(m[1] || m[2]);
      if (claimed >= 0 && claimed <= 100 && Math.abs(claimed - mem) > 15) {
        flags.push({ kind: 'memory', claim: `${claimed}% free/headroom`, expected: `~${mem}%`, actual: `memory_pressure reports ${mem}% free` });
      }
    }
  }

  // 5./6. File existence claims — "launch_plan.md doesn't exist",
  //      "no launch_plan.md", "X is missing", "X exists" (inverse).
  const missingRe = /([\w./~-]+\.(?:md|ts|tsx|js|mjs|json|jsonl|key|env|local|yaml|yml|plist|sh|py|toml|txt))\s+(?:does(?:n't| not) exist|is missing|not found|is absent|doesn't exist)/gi;
  while ((m = missingRe.exec(text))) {
    const tok = m[1];
    if (!FILE_EXT.test(tok)) continue;
    const found = existsInRoots(tok);
    if (found) {
      flags.push({ kind: 'file-missing', claim: `"${tok}" missing`, expected: 'exists', actual: `exists at ${found}` });
    }
  }
  const noFileRe = /(?:no|without)\s+([\w./~-]+\.(?:md|ts|tsx|js|mjs|json|jsonl|key|env|local|yaml|yml|plist|sh|py|toml|txt))\s+(?:file|exists|present|found)/gi;
  while ((m = noFileRe.exec(text))) {
    const found = existsInRoots(m[1]);
    if (found) {
      flags.push({ kind: 'file-missing', claim: `no ${m[1]}`, expected: 'exists', actual: `exists at ${found}` });
    }
  }
  const existsRe = /([\w./~-]+\.(?:md|ts|tsx|js|mjs|json|jsonl|key|env|local|yaml|yml|plist|sh|py|toml|txt))\s+(?:exists|is present|was found)/gi;
  while ((m = existsRe.exec(text))) {
    const found = existsInRoots(m[1]);
    if (!found) {
      flags.push({ kind: 'file-exists', claim: `"${m[1]}" exists`, expected: 'missing', actual: `not found under workspace roots` });
    }
  }

  // Dedupe identical flags
  const seen = new Set<string>();
  return flags.filter((f) => {
    const k = `${f.kind}|${f.claim}|${f.actual}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Build the deterministic correction block appended to a reply with
 *  mismatched claims. Returns '' when nothing was flagged. */
export function correctionBlock(flags: ClaimFlag[]): string {
  if (!flags.length) return '';
  const corrections = flags.map((f) => `${f.claim} → actual: ${f.actual}${f.note ? ` (${f.note})` : ''}`).join('; ');
  return `\n\n[claim-check] Correction — I cited stale or wrong live values. Verified just now: ${corrections}.`;
}

/** Scan + log. Returns flags; callers append correctionBlock(flags). */
export function checkReply(text: string, ctx: { channel?: string; sender?: string } = {}): ClaimFlag[] {
  const flags = verifyReplyClaims(text);
  try {
    fs.mkdirSync(RUNTIME, { recursive: true });
    fs.appendFileSync(LOG, JSON.stringify({
      ts: Date.now(), channel: ctx.channel, sender: ctx.sender,
      flagged: flags.length, flags: flags.map((f) => `${f.kind}:${f.claim}`),
    }) + '\n', 'utf8');
  } catch {}
  return flags;
}
