/**
 * calibration.ts — measured self-reliability for the narrator.
 *
 * Reads the two verification ledgers — claim-check.jsonl (the original
 * six live-state kinds) and epistemic-verdicts.jsonl (service/fleet/
 * uptime/date/resilience/superlative/provenance) — and produces a
 * per-kind contradicted-rate digest injected into Cortex's system
 * prompt. This is Layer-2 calibration: her hedging strength is driven
 * by MEASURED historical accuracy per claim type, not model vibes.
 *
 * "port: 0/5 contradicted" is a fact she can cite about herself.
 */
import fs from 'node:fs';
import path from 'node:path';

const RUNTIME = path.resolve(process.cwd(), '.cortex-runtime');
const CLAIM_LOG = path.join(RUNTIME, 'claim-check.jsonl');
const VERDICTS_LOG = path.join(RUNTIME, 'epistemic-verdicts.jsonl');

interface KindStats { checked: number; contradicted: number; unverifiable: number }

function tailLines(file: string, maxBytes = 256 * 1024): string[] {
  try {
    const st = fs.statSync(file);
    const start = Math.max(0, st.size - maxBytes);
    const fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(st.size - start);
    fs.readSync(fd, buf, 0, buf.length, start);
    fs.closeSync(fd);
    return buf.toString('utf8').split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

let digestCache: { at: number; text: string } | null = null;

/** Per-kind reliability stats across both ledgers. */
export function claimReliabilityStats(): Record<string, KindStats> {
  const byKind: Record<string, KindStats> = {};
  const bump = (kind: string, field: 'checked' | 'contradicted' | 'unverifiable') => {
    byKind[kind] = byKind[kind] || { checked: 0, contradicted: 0, unverifiable: 0 };
    byKind[kind][field]++;
  };

  // claim-check.jsonl: { flagged, flags: ['kind:claim', ...] }
  for (const line of tailLines(CLAIM_LOG)) {
    try {
      const rec = JSON.parse(line);
      const flags: string[] = Array.isArray(rec?.flags) ? rec.flags : [];
      if (!flags.length) continue;
      for (const f of flags) {
        const kind = String(f).split(':')[0] || 'unknown';
        bump(kind, 'checked');
        bump(kind, 'contradicted');
      }
    } catch {}
  }

  // epistemic-verdicts.jsonl: { kind, verdict }
  for (const line of tailLines(VERDICTS_LOG)) {
    try {
      const v = JSON.parse(line);
      const kind = String(v?.kind || 'unknown');
      bump(kind, 'checked');
      if (v?.verdict === 'contradicted') bump(kind, 'contradicted');
      if (v?.verdict === 'unverifiable') bump(kind, 'unverifiable');
    } catch {}
  }
  return byKind;
}

/** One-line digest for the system prompt. Empty string when there is
 *  not yet enough measured history to say anything honest. */
export function selfReliabilityDigest(): string {
  if (digestCache && Date.now() - digestCache.at < 60_000) return digestCache.text;
  const stats = claimReliabilityStats();
  const parts = Object.entries(stats)
    .filter(([, s]) => s.checked >= 3)
    .map(([k, s]) => `${k}: ${s.contradicted}/${s.checked} contradicted${s.unverifiable ? `, ${s.unverifiable} unverifiable` : ''}`)
    .sort();
  const text = parts.length
    ? `[SELF-RELIABILITY] Measured claim-verification record: ${parts.join('; ')}. Kinds with nonzero contradicted rates REQUIRE a tool check before you state them — your own history says you get these wrong.`
    : '';
  digestCache = { at: Date.now(), text };
  return text;
}
