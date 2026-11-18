/**
 * Counsel reliability scorecard — calibration tracking per console.
 *
 * Counsel sessions produce positions; verdicts produce outcomes. This
 * module joins them: for every CLEARED session, did each member's final
 * stance match the human verdict? Rejected positions (Evidence or
 * Silence violations) count against evidence discipline. The result is
 * a per-console grade the Crew can see — marking chronic poor performers
 * is a Crew decision, not an automatic demotion.
 *
 * Read-only computation over counsel/sessions + counsel/positions/rejected.
 * Nothing here mutates sessions, weights votes, or blocks anyone.
 */

import fs from 'node:fs';
import path from 'node:path';
import { COUNSEL_CONSOLES, listCounselSessions, type CounselSession } from '../cortex-counsel';

const STATE_DIR = process.env.CORTEX_AGENTS_STATE_DIR || path.join(process.cwd(), '.cortex-runtime');
const REJECTED_DIR = path.join(STATE_DIR, 'counsel', 'positions', 'rejected');

/** Minimum cleared sessions before a grade means anything. */
export const SCORECARD_MIN_SESSIONS = 3;

export interface MemberScore {
  id: string;
  callSign: string;
  /** Cleared sessions where this member was seated. */
  sessions: number;
  /** Total positions filed (round 1 + rebuttals, all sessions). */
  positions: number;
  /** Positions rejected at intake (uncited/invalid). */
  rejected: number;
  /** Sessions with a decisive stance used for alignment. */
  scored: number;
  /** Sessions where final stance matched the verdict (go↔go, no-go↔no-go). */
  aligned: number;
  /** aligned / scored — 0..1, null when nothing decisive to score. */
  alignment: number | null;
  /** Mean confidence across scored positions. */
  avgConfidence: number | null;
  /** 'A'|'B'|'C'|'D'|null — null until MIN_SESSIONS cleared sessions. */
  grade: 'A' | 'B' | 'C' | 'D' | null;
  flags: string[];
}

function latestPosition(s: CounselSession, member: string) {
  let best = null as CounselSession['positions'][number] | null;
  for (const p of s.positions) {
    if (p.member !== member) continue;
    if (!best || p.round >= best.round) best = p;
  }
  return best;
}

function stanceMatchesVerdict(stance: string, decision: string): boolean | null {
  // 'conditional' is neither go nor no-go — excluded from scoring.
  if (stance === 'conditional' || stance === 'no-response') return null;
  return stance === decision;
}

function countRejected(member: string): number {
  try {
    if (!fs.existsSync(REJECTED_DIR)) return 0;
    let n = 0;
    for (const f of fs.readdirSync(REJECTED_DIR)) {
      if (!f.endsWith('.json')) continue;
      try {
        const d = JSON.parse(fs.readFileSync(path.join(REJECTED_DIR, f), 'utf-8'));
        if ((d?.member || f) === member || f.includes(`-${member}.json`)) n++;
      } catch { /* skip unreadable */ }
    }
    return n;
  } catch { return 0; }
}

/** Compute the scorecard across all sessions. Pure read — no mutation. */
export function computeCounselScorecard(): MemberScore[] {
  const sessions = listCounselSessions();
  const cleared = sessions.filter((s) => s.status === 'cleared' && s.verdict);
  const allPositions = sessions.flatMap((s) => s.positions);

  return COUNSEL_CONSOLES.map((c) => {
    const seatedCleared = cleared.filter((s) => s.members.includes(c.id));
    const myPositions = allPositions.filter((p) => p.member === c.id);
    const rejected = countRejected(c.id);

    let aligned = 0, scored = 0;
    let confSum = 0, confN = 0;
    for (const s of seatedCleared) {
      const p = latestPosition(s, c.id);
      if (!p) continue;
      const match = stanceMatchesVerdict(p.stance, s.verdict!.decision);
      if (match === null) continue;
      scored++;
      confSum += p.confidence;
      confN++;
      if (match) aligned++;
    }

    const alignment = scored ? aligned / scored : null;
    const avgConfidence = confN ? confSum / confN : null;
    const flags: string[] = [];

    let grade: MemberScore['grade'] = null;
    if (seatedCleared.length >= SCORECARD_MIN_SESSIONS && alignment !== null) {
      const rejectionRate = myPositions.length + rejected > 0 ? rejected / (myPositions.length + rejected) : 0;
      // Grade: alignment primary, rejection rate + participation secondary.
      let score = alignment * 100 - rejectionRate * 40;
      if (myPositions.length === 0) score -= 20; // seated but silent
      if (score >= 80) grade = 'A';
      else if (score >= 60) grade = 'B';
      else if (score >= 40) grade = 'C';
      else grade = 'D';
      if (alignment < 0.5) flags.push('below-coin-flip alignment');
      if (rejectionRate > 0.25) flags.push('evidence-discipline failures');
      if (myPositions.length === 0) flags.push('no positions filed');
    } else if (seatedCleared.length > 0) {
      flags.push(`insufficient sample (${seatedCleared.length}/${SCORECARD_MIN_SESSIONS} cleared)`);
    }

    return {
      id: c.id,
      callSign: c.callSign,
      sessions: seatedCleared.length,
      positions: myPositions.length,
      rejected,
      scored,
      aligned,
      alignment,
      avgConfidence,
      grade,
      flags,
    };
  });
}
