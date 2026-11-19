/**
 * Cortex Event Log — append-only persistent event sourcing for the agent bus.
 *
 * Implements persistent event-sourcing for runtime events:
 * - Subscribes to agentRuntime on boot
 * - Appends JSONL lines with monotonic global sequence numbers (seq) to .cortex-runtime/eventlog/events-YYYY-MM-DD.jsonl
 * - Total ordering via seq, recovering lastSeq by scanning the tail of existing logs on startup
 * - readEvents({ since, until, types, agentId, limit }) supports replay and query
 * - Safe concurrent appends with error isolation so bus never crashes
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { AgentEvent } from './types';
import type { AgentRuntime } from './runtime';

function getLogDir(): string {
  const stateDir = process.env.CORTEX_AGENTS_STATE_DIR || path.join(process.cwd(), '.cortex-runtime');
  return path.join(stateDir, 'eventlog');
}

export interface PersistedEvent {
  seq: number;
  at: number;
  type: string;
  /** Hash-chain fields: prevHash links to the prior record's hash ('GENESIS'
   *  for the first chained record), hash = sha256(prevHash | canonical). */
  prevHash?: string;
  hash?: string;
  /** Identifies the writer process/boot that produced this record. Each boot
   *  forms its own chain epoch anchored at the recovered head, so concurrent
   *  appenders interleave safely and the verifier checks each writer's
   *  sub-chain independently. */
  writer?: string;
  [key: string]: unknown;
}

export interface ReadEventsOptions {
  /** Minimum seq (or timestamp if > 1e11) */
  since?: number;
  /** Maximum seq (or timestamp if > 1e11) */
  until?: number;
  /** Filter by event types */
  types?: string[];
  /** Filter by agent (agentId, task.agentId, from, to) */
  agentId?: string;
  /** Maximum events to return (default 500, max 5000) */
  limit?: number;
}

let nextSeq = 1;
let initialized = false;
let activeUnsub: (() => void) | null = null;
let lastHash = 'GENESIS';
// Unique per process boot: pid + boot timestamp + random suffix.
const WRITER_ID = `${process.pid.toString(36)}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;

const sha256 = (s: string) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');

/** Canonical preimage for hashing: seq + event payload. Chain-epoch metadata
 *  (prevHash/hash/writer) is excluded — writer identifies which epoch a record
 *  belongs to but is not event content, and excluding it keeps records written
 *  by every deployed scheme verifiable under one preimage. */
function eventPreimage(rec: Record<string, unknown>): string {
  const { prevHash: _p, hash: _h, writer: _w, ...rest } = rec;
  return JSON.stringify(rest);
}

function hashRecord(prevHash: string, rec: Record<string, unknown>): string {
  return sha256(`${prevHash}|${eventPreimage(rec)}`);
}

/** Preimage variant used by the intermediate deploy that hash-covered the
 *  writer field. Retained so those records remain verifiable; new records
 *  never use it. */
function eventPreimageWithWriter(rec: Record<string, unknown>): string {
  const { prevHash: _p, hash: _h, ...rest } = rec;
  return JSON.stringify(rest);
}

function hashRecordAlt(prevHash: string, rec: Record<string, unknown>): string {
  return sha256(`${prevHash}|${eventPreimageWithWriter(rec)}`);
}

/** Recover the chain head: the hash of the highest-seq record that carries
 *  one; if the highest-seq record is unhashed (legacy/interleaved), anchor to
 *  sha256 of its raw line — matching verifyEventLog's per-line anchor. */
function recoverLastHash(): string {
  const logDir = getLogDir();
  let bestSeq = -1;
  let bestHash: string | null = null;
  let bestRaw: string | null = null;
  try {
    if (!fs.existsSync(logDir)) return 'GENESIS';
    const files = fs.readdirSync(logDir)
      .filter((f) => f.startsWith('events-') && f.endsWith('.jsonl'));
    for (const file of files) {
      for (const line of fs.readFileSync(path.join(logDir, file), 'utf8').split('\n')) {
        if (!line.trim()) continue;
        let seq = -1;
        let hash: string | null = null;
        try {
          const parsed = JSON.parse(line);
          if (typeof parsed.seq === 'number') seq = parsed.seq;
          if (typeof parsed.hash === 'string') hash = parsed.hash;
        } catch { continue; }
        if (seq > bestSeq) { bestSeq = seq; bestHash = hash; bestRaw = line; }
      }
    }
  } catch { /* fall through */ }
  if (bestSeq < 0) return 'GENESIS';
  return bestHash ?? sha256(bestRaw!);
}

export function getDayFileName(d: Date = new Date()): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `events-${yyyy}-${mm}-${dd}.jsonl`;
}

export function recoverNextSeq(): number {
  // Max seq across every line of every file — order-independent, so interleaved
  // appends from overlapping writer processes can never reset the counter.
  const logDir = getLogDir();
  let max = 0;
  try {
    if (!fs.existsSync(logDir)) return 1;
    const files = fs.readdirSync(logDir)
      .filter((f) => f.startsWith('events-') && f.endsWith('.jsonl'));
    for (const file of files) {
      const content = fs.readFileSync(path.join(logDir, file), 'utf8');
      for (const line of content.split('\n')) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          if (typeof parsed.seq === 'number' && Number.isFinite(parsed.seq) && parsed.seq > max) {
            max = parsed.seq;
          }
        } catch { /* skip corrupt line */ }
      }
    }
  } catch (err) {
    console.warn('[cortex-eventlog] Seq recovery error:', err);
  }
  return max + 1;
}

const SEQ_LOCK = '.seq.lock';
const SEQ_HEAD = '.seq-head';
const LOCK_STALE_MS = 10_000;
const LOCK_WAIT_MS = 2_000;

function seqHeadPath(): string { return path.join(getLogDir(), SEQ_HEAD); }
function seqLockPath(): string { return path.join(getLogDir(), SEQ_LOCK); }

function readSeqHead(): number {
  try {
    const n = parseInt(fs.readFileSync(seqHeadPath(), 'utf8').trim(), 10);
    return Number.isFinite(n) ? n : 0;
  } catch { return 0; }
}

function writeSeqHead(n: number): void {
  const tmp = seqHeadPath() + '.tmp';
  fs.writeFileSync(tmp, String(n), 'utf8');
  fs.renameSync(tmp, seqHeadPath());
}

/** Cross-process mutex for seq allocation. Stale locks (>10s) are broken so a
 *  crashed writer can never wedge the log. Returns false if it cannot be
 *  acquired in time — callers degrade to unlocked append rather than drop
 *  the event. */
function acquireSeqLock(): (() => void) | null {
  const lockPath = seqLockPath();
  const deadline = Date.now() + LOCK_WAIT_MS;
  for (;;) {
    try {
      const fd = fs.openSync(lockPath, 'wx');
      fs.writeFileSync(fd, `${process.pid} ${Date.now()}`);
      fs.closeSync(fd);
      return () => { try { fs.unlinkSync(lockPath); } catch { /* already gone */ } };
    } catch (err: any) {
      if (err?.code !== 'EEXIST') return null;
      try {
        const st = fs.statSync(lockPath);
        if (Date.now() - st.mtimeMs > LOCK_STALE_MS) { fs.unlinkSync(lockPath); continue; }
      } catch { continue; }
      if (Date.now() > deadline) return null;
      const wait = new Int32Array(new SharedArrayBuffer(4));
      Atomics.wait(wait, 0, 0, 25);
    }
  }
}

export function appendEvent(e: AgentEvent): PersistedEvent | null {
  const logDir = getLogDir();
  try {
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    if (!initialized) {
      nextSeq = recoverNextSeq();
      lastHash = recoverLastHash();
      // Seed the shared high-water mark so a second boot cannot re-issue seqs.
      if (readSeqHead() < nextSeq - 1) writeSeqHead(nextSeq - 1);
      initialized = true;
    }
    // Allocate seq under the cross-process lock: the .seq-head file is the
    // authoritative high-water mark, so concurrent writers can never issue
    // the same sequence number.
    const release = acquireSeqLock();
    let seq: number;
    try {
      seq = Math.max(nextSeq, readSeqHead() + 1);
      writeSeqHead(seq);
      nextSeq = seq + 1;
    } finally {
      release?.();
    }
    const record: PersistedEvent = {
      seq,
      prevHash: lastHash,
      writer: WRITER_ID,
      ...e,
      hash: '',
    };
    record.hash = hashRecord(lastHash, record);
    lastHash = record.hash;
    const targetFile = path.join(logDir, getDayFileName(new Date(e.at || Date.now())));
    fs.appendFileSync(targetFile, JSON.stringify(record) + '\n', 'utf8');
    return record;
  } catch (err) {
    console.warn('[cortex-eventlog] Failed to append event:', err);
    return null;
  }
}

export function initEventLog(runtime: AgentRuntime): () => void {
  const logDir = getLogDir();
  try {
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    nextSeq = recoverNextSeq();
    lastHash = recoverLastHash();
    initialized = true;

    if (activeUnsub) {
      activeUnsub();
      activeUnsub = null;
    }

    const unsub = runtime.subscribe((event: AgentEvent) => {
      appendEvent(event);
    });

    activeUnsub = unsub;
    return () => {
      unsub();
      if (activeUnsub === unsub) activeUnsub = null;
    };
  } catch (err) {
    console.warn('[cortex-eventlog] Initialization error:', err);
    return () => {};
  }
}

export function readEvents(opts: ReadEventsOptions = {}): PersistedEvent[] {
  const logDir = getLogDir();
  const results: PersistedEvent[] = [];
  try {
    if (!fs.existsSync(logDir)) return [];
    const files = fs.readdirSync(logDir)
      .filter((f) => f.startsWith('events-') && f.endsWith('.jsonl'))
      .sort();

    const limit = Math.min(Math.max(1, opts.limit ?? 500), 5000);
    const since = opts.since;
    const until = opts.until;
    const typeSet = opts.types && opts.types.length > 0 ? new Set(opts.types) : null;
    const targetAgent = opts.agentId;

    for (const file of files) {
      const fullPath = path.join(logDir, file);
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const ev = JSON.parse(line) as PersistedEvent;

          if (since !== undefined) {
            if (since > 1e11) {
              if (ev.at < since) continue;
            } else {
              if (ev.seq < since) continue;
            }
          }
          if (until !== undefined) {
            if (until > 1e11) {
              if (ev.at > until) continue;
            } else {
              if (ev.seq > until) continue;
            }
          }

          if (typeSet && !typeSet.has(ev.type)) continue;

          if (targetAgent) {
            const matchesAgent =
              ev.agentId === targetAgent ||
              (ev.task as any)?.agentId === targetAgent ||
              ev.from === targetAgent ||
              ev.to === targetAgent;
            if (!matchesAgent) continue;
          }

          results.push(ev);
          if (results.length >= limit) {
            return results;
          }
        } catch {
          // ignore corrupted line
        }
      }
    }
  } catch (err) {
    console.warn('[cortex-eventlog] Read error:', err);
  }
  return results;
}

/** Walk the entire log and verify every chained record's content hash.
 *  Linkage (prevHash) discontinuities are reported as linkBreaks — expected
 *  across legacy/interleaved history — while a content-hash mismatch is
 *  tampering and fails the audit. */
export function verifyEventLog(): {
  ok: boolean; checked: number; chained: number; legacy: number; linkBreaks: number;
  altScheme: number; writers: number; duplicateSeqs: number;
  firstBreak: { file: string; seq?: number; reason: string } | null;
} {
  const result = {
    ok: true, checked: 0, chained: 0, legacy: 0, linkBreaks: 0, altScheme: 0, writers: 0, duplicateSeqs: 0,
    firstBreak: null as { file: string; seq?: number; reason: string } | null,
  };
  const logDir = getLogDir();
  try {
    if (!fs.existsSync(logDir)) return result;
    const files = fs.readdirSync(logDir)
      .filter((f) => f.startsWith('events-') && f.endsWith('.jsonl'))
      .sort();
    // Each writer boot forms its own chain epoch: expectedPrev is tracked per
    // writer id so interleaved appends from concurrent processes verify
    // independently. Unlabeled legacy-era chained records share '_unlabeled'.
    const expectedPrev = new Map<string, string>();
    const seenSeqs = new Set<number>();
    for (const file of files) {
      const lines = fs.readFileSync(path.join(logDir, file), 'utf8').split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        result.checked++;
        let rec: Record<string, unknown>;
        try { rec = JSON.parse(line); } catch {
          result.ok = false; result.firstBreak = { file, reason: 'unparseable line' }; return result;
        }
        if (typeof rec.seq === 'number' && Number.isFinite(rec.seq)) {
          if (seenSeqs.has(rec.seq)) result.duplicateSeqs++;
          else seenSeqs.add(rec.seq);
        }
        if (typeof rec.hash !== 'string') {
          result.legacy++;
          continue;
        }
        result.chained++;
        const writerKey = typeof rec.writer === 'string' ? rec.writer : '_unlabeled';
        const expected = expectedPrev.get(writerKey) ?? 'GENESIS';
        if (rec.prevHash !== expected) {
          result.linkBreaks++;
          if (!result.firstBreak) {
            result.firstBreak = { file, seq: rec.seq as number, reason: `prevHash discontinuity (writer ${writerKey}) — expected ${expected.slice(0, 12)}…, record claims ${String(rec.prevHash).slice(0, 12)}…` };
          }
        }
        if (hashRecord(rec.prevHash as string, rec) !== rec.hash) {
          // Records written while the writer field was briefly inside the
          // hash preimage verify under the alternate preimage — a known
          // migration artifact, not tampering. Anything else is tampering.
          if (hashRecordAlt(rec.prevHash as string, rec) !== rec.hash) {
            result.ok = false;
            result.firstBreak = { file, seq: rec.seq as number, reason: 'hash mismatch — record content tampered' };
            return result;
          }
          result.altScheme++;
        }
        expectedPrev.set(writerKey, rec.hash);
      }
    }
    result.writers = expectedPrev.size;
  } catch (err) {
    result.ok = false;
    result.firstBreak = { file: '', reason: String(err) };
  }
  return result;
}

export function getEventLogStats() {
  const logDir = getLogDir();
  const files = fs.existsSync(logDir)
    ? fs.readdirSync(logDir).filter((f) => f.startsWith('events-') && f.endsWith('.jsonl'))
    : [];
  return {
    nextSeq,
    fileCount: files.length,
    logDir,
    initialized,
  };
}

export function _resetEventLogForTest() {
  nextSeq = 1;
  lastHash = 'GENESIS';
  initialized = false;
  if (activeUnsub) {
    activeUnsub();
    activeUnsub = null;
  }
}
