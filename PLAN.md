# Cortex Intention Kernel — Plan

> Goal: Cortex stops asking permission. Declared intent becomes a first-class,
> governed, resumable object. Multi-turn tool use happens server-side in one
> request — no "go ahead" tax, on every surface.

## Diagnosis (verified in code)

1. Chat routes through `/api/ai/nexus-guest` → fast-tier models that prefer
   prose offers over `tool_call` emission.
2. `parseCortexToolCall` Format-5 interceptor catches "I will/let me…" but NOT
   offers: "I suggest you use X", "want me to…", "just let me know".
3. No pending-intent state across turns — every "go ahead" re-derives intent.
4. The ReAct loop (`runCortexToolLoop`, max 4 steps) is client-side, exists only
   in `CortexDemo`; voice/face/drawer each re-implemented fragments. The
   between-step "what next?" call has no tool schemas and no history.
5. First-call `maxTokens: 1200` can truncate fenced tool_call JSON.

## Architecture

### Module A — `src/lib/cortex-agent/intentions.ts` (pure, testable)

- `AFFIRMATION_RE` — yes/yeah/go ahead/do it/proceed/confirm/sounds good…
- `detectOffer(text)` → `{tool, args, confidence} | null`
  - Tool-name mentions: fetch_url, web_search, run_command, search_code,
    read_file, write_file, cortex_memory, chrome_control, cortex_agents,
    cortex_skill_discovery, generate_splat, compose_dashboard, etc.
  - Offer/deferral frames: "I suggest you use…", "I can pull…",
    "want me to…", "should I…", "just let me know", "if you need me to…".
  - Args extraction when obvious: URLs, quoted commands, file paths.
    Otherwise args = {} and the agentic loop's first LLM step completes them
    (deterministic seed + model fill — never a dangling promise).
- Ledger persisted at `.cortex-runtime/intentions.json`, keyed by sessionId,
  TTL 15 min, statuses: pending → consumed | expired | declined.
- `recordOffer`, `takeAffirmed(sessionId)`, `decline(sessionId)`, `sweep()`.

### Module B — `src/lib/cortex-agent/loop.ts` (server ReAct loop)

`runAgenticTurn(deps)`:

- deps injected from vite.config.ts: `providers` (activeChain),
  `executeTool(name,args)` → self-fetch `/api/cortex/tools/execute`,
  `emit(event)` → SSE writer, `toolsDef` = CORTEX_TOOLS.
- Up to `MAX_STEPS = 6` iterations:
  1. `callLLMOnce` — non-streaming provider call across the chain (first OK
     wins; per-provider timeout). Handles OpenAI-protocol (`tool_calls` on
     message) and Anthropic (`tool_use` content blocks); falls back to fenced
     ` ```tool_call ` parsing via `repairJsonArgs`.
  2. No tool calls → return final content.
  3. Tool calls → emit `tool_step` SSE event + visible status token; execute
     each (cap 2/step); append proper role messages:
     - OpenAI: `{role:'assistant', tool_calls:[…]}` + `{role:'tool', tool_call_id, content}`
     - Anthropic: assistant `tool_use` blocks + user `tool_result` blocks.
- `initialToolCall` seed: executes a pending-intention tool deterministically
  BEFORE the first LLM call (affirmation path — zero model compliance needed).
- Returns `{content, steps, provider}`.

### Wiring — `vite.config.ts` `/api/ai/nexus-guest`

- New branch BEFORE the existing single-shot path:
  `if (parsed.context === 'cortex' && parsed.agentic === true)` → agentic path
  (opt-in per request; CortexDemo sends `agentic:true` + stable sessionId).
  Legacy path untouched for every other consumer.
- Legacy path ALSO gets the ledger: affirmation injects a
  "[Pending Intention Affirmed]" instruction into chatMessages (model emits
  the call, existing client loops execute it); offers in final streamed text
  are recorded via accumulated `forwardedText` → `detectOffer` → `recordOffer`.
  So voice/face/drawer get the "go ahead" fix even without the server loop.
- Agentic path flow:
  1. `isAffirmation(latestUserMessage)` → `takeAffirmed(sessionId)` →
     `initialToolCall` seed (deterministic execution, then LLM synthesis).
  2. `runAgenticTurn` streams: preamble tokens live? v1 emits per-step
     `tool_step` events + a visible `*⚡ <tool>*` status token, then the final
     answer as chunked SSE tokens (fast-type). DONE.
  3. Post-answer: `detectOffer(finalContent)` → `recordOffer(sessionId)` so the
     NEXT affirmation auto-resumes. Also record offers detected in the legacy
     path's final text (cheap hook before `res.end()`).
- Response header `X-Cortex-Agentic: loop` + `agentic` SSE meta event.
- Self-execution uses `x-cortex-key: sovereign-local` header (same as client).

### Client — `CortexDemo.tsx`

- sendMessage body += `agentic: true`, `sessionId` (sessionStorage-stable id).
- Server suppresses tool_call SSE in agentic mode → client's
  `runCortexToolLoop` finds nothing → no double execution. No other client
  change required v1 (tool_step events ignored gracefully by strict parser).
- `cortex-stream.ts`: add optional `toolStep` field + `onToolStep` callback
  (forward-compatible; UI badge can come later).

## Verification

- `guard-cortex-typecheck` clean.
- Live: "search the web for X" → tool executes server-side, answer streams,
  no tool_call fence leaks into chat content.
- Live: Cortex offers → user says "go ahead" → pending intention executes
  deterministically.
- Regression: non-cortex nexus-guest consumers unchanged (agentic is opt-in
  per-request flag + context gate).

## Explicit non-goals (v1)

- Voice/face/drawer agentic parity (they keep legacy path until validated).
- Native Anthropic streaming tool_use (non-stream parse only).
- Mid-stream failover inside agentic iterations (first-OK provider wins).
