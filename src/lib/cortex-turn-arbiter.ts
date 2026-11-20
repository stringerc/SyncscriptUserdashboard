/**
 * cortex-turn-arbiter — cross-tab turn dedupe.
 *
 * The speech mutex (cortex-tts-arbiter) guarantees one VOICE, but two
 * tabs could still both GENERATE replies to the same input — duplicate
 * answers in the shared conversation (and double LLM cost). This board
 * in localStorage lets exactly one surface own a given user turn:
 *
 *   claimTurn(text) — if a fresh claim exists for the same normalized
 *   text, the caller is a duplicate (e.g. two tabs' mics heard the same
 *   utterance) and must skip generation entirely — the owner's reply
 *   propagates through the shared chat store.
 *
 * The board is a map keyed by normalized text so DIFFERENT concurrent
 * turns in different tabs coexist. Each claim heartbeats every 5s
 * (auto-stops ~150s, past the 90s turn deadline); release() removes the
 * entry so an identical resend after completion is never blocked.
 */

const KEY = 'cortex_active_turns_v1';
const FRESH_MS = 25000;
const HEARTBEAT_MS = 5000;
const MAX_HEARTBEATS = 30; // ~150s cap

interface TurnBoard {
  turns?: Record<string, { owner: string; ts: number }>;
}

export interface TurnClaim {
  claimed: boolean;
  release(): void;
}

const NOOP: TurnClaim = { claimed: false, release: () => {} };
const OPEN: TurnClaim = { claimed: true, release: () => {} };

export function normalizeTurnText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

function readBoard(): TurnBoard {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function prune(board: TurnBoard): TurnBoard {
  const now = Date.now();
  const turns: Record<string, { owner: string; ts: number }> = {};
  for (const [k, v] of Object.entries(board.turns || {})) {
    if (v && typeof v.ts === 'number' && now - v.ts < FRESH_MS) turns[k] = v;
  }
  return { turns };
}

export function claimTurn(text: string, ownerId?: string): TurnClaim {
  const key = normalizeTurnText(text);
  if (!key) return OPEN;
  const owner =
    ownerId ??
    `turn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

  try {
    const board = prune(readBoard());
    board.turns = board.turns || {};
    const existing = board.turns[key];
    if (existing && existing.owner !== owner) return NOOP;

    board.turns[key] = { owner, ts: Date.now() };
    localStorage.setItem(KEY, JSON.stringify(board));

    // Verify-after-write resolves the simultaneous-claim race.
    const check = readBoard();
    if (check.turns?.[key]?.owner !== owner) return NOOP;

    let beats = 0;
    const hb = setInterval(() => {
      beats += 1;
      if (beats > MAX_HEARTBEATS) { clearInterval(hb); return; }
      try {
        const b = prune(readBoard());
        b.turns = b.turns || {};
        const cur = b.turns[key];
        if (cur && cur.owner === owner) {
          cur.ts = Date.now();
          localStorage.setItem(KEY, JSON.stringify(b));
        }
      } catch { /* ignore */ }
    }, HEARTBEAT_MS);

    return {
      claimed: true,
      release: () => {
        clearInterval(hb);
        try {
          const b = readBoard();
          if (b.turns?.[key]?.owner === owner) {
            delete b.turns[key];
            localStorage.setItem(KEY, JSON.stringify(b));
          }
        } catch { /* ignore */ }
      },
    };
  } catch {
    return OPEN; // no localStorage — fail open
  }
}
