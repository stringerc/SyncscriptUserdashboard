/**
 * epistemic-audit.ts — the adversarial self (Layer 4).
 *
 * Every reply passes epistemicGate BEFORE the user sees it. This module
 * audits AFTER the fact — fire-and-forget, never blocks the reply:
 *
 *   1. Deterministic rescan — re-extract claims from the FINAL shipped
 *      text (post-correction) and check whether any contradicted claim
 *      survived the correction block. A survivor means the gate has a
 *      hole; it gets logged loudly.
 *
 *   2. LLM critic (rate-limited) — a skeptic pass through nexus-guest
 *      asks a second model to hunt for confabulated, stale, or
 *      overclaimed statements in the shipped reply. Different call
 *      path, different context — correlated confabulation is harder.
 *      Rate: CORTEX_CRITIC_RATE (default 0.15 = ~1 in 7 replies).
 *      Set 0 to disable, 1 to audit everything.
 *
 * Output: .cortex-runtime/epistemic-audit.jsonl — the audit trail that
 * feeds calibration and future RLVR pairs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { epistemicGate } from './epistemic';

const RUNTIME = path.resolve(process.cwd(), '.cortex-runtime');
const AUDIT_LOG = path.join(RUNTIME, 'epistemic-audit.jsonl');

function logAudit(entry: Record<string, unknown>) {
  try {
    fs.mkdirSync(RUNTIME, { recursive: true });
    fs.appendFileSync(AUDIT_LOG, JSON.stringify({ ts: Date.now(), ...entry }) + '\n', 'utf8');
  } catch {}
}

const CRITIC_PROMPT = `You are an adversarial fact-checker auditing an AI assistant's reply. The assistant has a known tendency to state stale or invented live-system facts (ports, file existence, SLO counts, service status, dates, model health) and to assert conversational history it cannot verify.

Read the reply below and list ONLY concrete problems:
- factual claims about live system state that look stale, invented, or inconsistent
- assertions about prior conversation ("you said", "we discussed") presented as fact
- absolute claims ("all", "everything", "never") about system health
- any number presented without sign it was measured

If the reply is clean, output exactly: CLEAN
Otherwise output one line per problem, each starting with "FLAG:".
Do not summarize. Do not praise. Do not add advice.`;

/** Collect a streamed nexus-guest completion (same SSE shape strategic-review uses). */
async function criticCall(port: number, replyText: string): Promise<string> {
  const res = await fetch(`http://127.0.0.1:${port}/api/ai/nexus-guest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      context: 'cortex',
      tier: 'deep',
      internal: true,
      systemPrompt: `${CRITIC_PROMPT}\n\n=== REPLY UNDER AUDIT ===\n${replyText.slice(0, 6000)}\n=== END REPLY ===`,
      messages: [{ role: 'user', content: 'Audit the reply now.' }],
      stream: true,
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok || !res.body) throw new Error(`critic HTTP ${res.status}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let out = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6).trim();
      if (payload === '[DONE]') continue;
      try {
        const ev = JSON.parse(payload);
        if (ev?.type === 'TEXT_MESSAGE_CONTENT' && typeof ev.token === 'string') out += ev.token;
        else if (typeof ev?.token === 'string' && !ev.type) out += ev.token;
      } catch {}
    }
  }
  return out.trim();
}

/**
 * Schedule a post-reply audit. Fire-and-forget — callers do NOT await.
 * `shippedText` must be the FINAL text the user saw (post-correction).
 */
export function scheduleEpistemicAudit(opts: {
  shippedText: string;
  ctx?: { channel?: string; sender?: string; surface?: string };
  port?: number;
}): void {
  const { shippedText, ctx = {}, port } = opts;
  if (!shippedText || shippedText.length < 40) return;
  const surface = ctx.surface || ctx.channel || 'unknown';

  setImmediate(() => {
    (async () => {
      // 1. Deterministic rescan — did contradicted claims survive?
      try {
        const rescan = await epistemicGate(shippedText, { ...ctx, surface: `${surface}:audit` });
        // A survivor = a claim flagged on rescan whose correction text
        // is absent from the shipped reply — the gate caught something
        // the first pass missed (drift between passes or a gate hole).
        const uncorrected = rescan.flags.filter((f) =>
          !shippedText.includes(f.actual.slice(0, 40)) &&
          !shippedText.includes(f.claim.slice(0, 30)),
        );
        if (uncorrected.length) {
          logAudit({
            surface, phase: 'rescan',
            survivedClaims: uncorrected.map((f) => `${f.kind}:${f.claim}`),
            note: 'claims flagged on post-correction rescan — gate hole or new drift',
          });
        } else {
          logAudit({ surface, phase: 'rescan', survivedClaims: [], clean: true });
        }
      } catch (e: any) {
        logAudit({ surface, phase: 'rescan', error: String(e?.message || e).slice(0, 160) });
      }

      // 2. LLM critic — rate-limited, different call path.
      const rate = Number(process.env.CORTEX_CRITIC_RATE ?? '0.15');
      if (!(rate > 0) || Math.random() >= rate) return;
      try {
        const selfPort = port || (process.env.PORT ? parseInt(process.env.PORT, 10) : 5173);
        const verdict = await criticCall(selfPort, shippedText);
        const flagged = verdict.split('\n').filter((l) => l.trim().startsWith('FLAG:'));
        logAudit({
          surface, phase: 'llm-critic',
          verdict: verdict === 'CLEAN' ? 'clean' : 'flagged',
          flags: flagged.slice(0, 10),
          rawPreview: verdict.slice(0, 500),
        });
      } catch (e: any) {
        logAudit({ surface, phase: 'llm-critic', error: String(e?.message || e).slice(0, 160) });
      }
    })();
  });
}
