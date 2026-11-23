/**
 * jsonl-tail.ts — byte-tail reader for append-only JSONL stores.
 *
 * Every consumer of the episodic stores used to readFileSync the WHOLE
 * file then slice(-limit) — a 36MB task-archive meant a ~200MB transient
 * string + split per call, per consumer, per request. On a memory-
 * pressured host that's real RSS. This reads only the last ~4MB (≈15k
 * events) when the file is large, which always covers the tail limits
 * callers use (≤800 lines).
 */
import fs from 'node:fs';

const TAIL_BYTES = 4 * 1024 * 1024;

/** Read last `limit` parsed JSON lines of a JSONL file. */
export function readJsonlTail<T = any>(file: string, limit = 800): T[] {
  try {
    const size = fs.statSync(file).size;
    let lines: string[];
    if (size <= TAIL_BYTES) {
      lines = fs.readFileSync(file, 'utf8').split('\n');
    } else {
      const fd = fs.openSync(file, 'r');
      try {
        const buf = Buffer.alloc(TAIL_BYTES);
        fs.readSync(fd, buf, 0, TAIL_BYTES, size - TAIL_BYTES);
        const text = buf.toString('utf8');
        const nl = text.indexOf('\n');
        lines = text.slice(nl >= 0 ? nl + 1 : 0).split('\n'); // drop partial first line
      } finally {
        fs.closeSync(fd);
      }
    }
    return lines.filter(Boolean).slice(-limit)
      .map((l) => { try { return JSON.parse(l) as T; } catch { return null; } })
      .filter((x): x is T => x !== null);
  } catch { return []; }
}
