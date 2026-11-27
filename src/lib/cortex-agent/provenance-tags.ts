/**
 * provenance-tags.ts — emit-and-strip machinery for her self-declared
 * claim provenance (RLVR spec prerequisite #2).
 *
 * The model is instructed to tag live-state claims inline:
 *   [measured:TOOL]   — a tool returned this value this turn
 *   [memory]          — recalled from context/memory, not re-measured
 *   [unverified]      — best guess, no oracle
 *
 * Tags are stripped before text reaches the user (they're policy
 * signal, not prose) but every stripped tag is appended to
 * .cortex-runtime/provenance-tags.jsonl so the RLVR exporter can join
 * tag→verdict pairs later.
 */
import fs from 'node:fs';
import path from 'node:path';

const RUNTIME = path.resolve(process.cwd(), '.cortex-runtime');
const TAGS_LOG = path.join(RUNTIME, 'provenance-tags.jsonl');

// Tag grammar — keep tight so prose brackets ([note], [sic]) survive.
const TAG_RE = /\[(measured:[a-z0-9_-]{1,32}|memory(?::\d+[smhd])?|unverified|from memory(?::\d+[smhd])?)\]/gi;
const MAX_TAG_LEN = 64;

function logTags(replyContext: string, tags: string[]) {
  if (process.env.VITEST) return;
  try {
    fs.mkdirSync(RUNTIME, { recursive: true });
    for (const t of tags) {
      fs.appendFileSync(TAGS_LOG, JSON.stringify({ ts: Date.now(), tag: t, context: replyContext.slice(0, 160) }) + '\n', 'utf8');
    }
  } catch {}
}

/**
 * Stateful stripper for a single streamed reply. Feed chunks via push(),
 * call flush() at end-of-stream. Handles tags split across chunk
 * boundaries via a holdback buffer (same idiom as filterReasoning).
 */
export function createProvenanceStripper(context = '', opts: { log?: boolean } = {}) {
  const shouldLog = opts.log !== false;
  let pending = '';
  const found: string[] = [];
  const seen: string[] = [];

  const drain = (final: boolean): string => {
    let out = '';
    for (;;) {
      if (pending.startsWith('[')) {
        const close = pending.indexOf(']');
        if (close === -1) {
          if (pending.length > MAX_TAG_LEN || final) {
            // Not a tag (or absurdly long) — release as literal text.
            out += pending;
            pending = '';
            continue;
          }
          break; // wait for more input
        }
        const candidate = pending.slice(0, close + 1);
        const m = candidate.match(TAG_RE);
        if (m) {
          const tag = m[0].toLowerCase();
          found.push(tag);
          seen.push(tag);
          pending = pending.slice(close + 1);
          continue;
        }
        // '[' started something that isn't our tag — emit through the
        // bracket and keep scanning the remainder.
        out += pending[0];
        pending = pending.slice(1);
        continue;
      }
      const next = pending.indexOf('[');
      if (next === -1) {
        // No '[' ahead — but a '[' could arrive split at the boundary,
        // so hold back the last char if it could start a tag... '[' is
        // a single byte, can't split. Safe to emit all but keep a
        // minimal guard for '\\' escapes — none used. Emit everything.
        out += pending;
        pending = '';
        break;
      }
      out += pending.slice(0, next);
      pending = pending.slice(next);
    }
    return out;
  };

  return {
    push(chunk: string): string {
      pending += chunk;
      return drain(false);
    },
    flush(): string {
      const out = drain(true);
      if (found.length) {
        if (shouldLog) logTags(context, found);
        found.length = 0;
      }
      return out;
    },
    /** All tags seen this stream (survives flush). */
    tags: () => [...seen],
  };
}
