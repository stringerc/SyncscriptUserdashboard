# Active task — answer cache (semantic-ish turn cache) (2026-11-23)
STATUS: DONE — pending commit.

src/lib/cortex-agent/answer-cache.ts — the "semantic cache" pattern from
the WeBeeld reel, implemented with honest boundaries:
- Only ZERO-TOOL, error-free agentic turns are cached — anything that
  touched the host is context-bound and never replayed.
- Key = scope + normalized question (lowercase, alnum tokens). Matching:
  exact-normalized first, then token-Jaccard >= 0.85 for near-dupes.
- TTL 15min, 500-entry bound, oldest-first eviction, hit counters.
- Store: .cortex-runtime/answer-cache.json; expired entries dropped on load.

Wired at both agentic call sites:
- Inbound bridge: scope `inbound:<channel>:<sender>` — per-sender isolation,
  response carries cached:true + cacheAgeMs, audit logs provider=answer-cache.
- Voice/chat SSE: scope 'voice', cache hit replays reply as token stream +
  finishReason agentic.cached — client cannot tell the difference.

Verified live E2E: first inbound call hit real provider
(magpie#cortex-reason, reply "pineapple"), identical second call served
provider=answer-cache in 1ms. Unit-verified: scope isolation, short-q
rejection, hit counting, Jaccard strictness (only near-identical phrasing
matches — honest, not oversold).

Honest limits: matching is lexical not embedding-semantic; 15min TTL means
fast-changing facts (deadlines, prices) can serve stale answers — mitigated
by the tool-free-only rule since dynamic questions route through tools.
Resilience 13/13 (one adjudication p95 flake on first run, clean on rerun).

updated: 2026-11-23T20:40:00Z
cwd: /Users/Apple/syncscript
