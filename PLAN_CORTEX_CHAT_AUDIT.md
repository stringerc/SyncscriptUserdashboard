# PLAN: /cortex/chat audit findings + remediation

Scope: `src/components/cortex/CortexDemo.tsx` (7,030 lines), `/api/ai/nexus-guest` SSE path, `/api/cortex/tools/execute`, live-tested via headless Puppeteer against `localhost:5173/cortex/chat` on 2026-11-10.

## Verified working (live evidence)

- Page loads, no crash; `window.__cortexSend` drives real turns end-to-end.
- Multi-turn conversation persists via localStorage across reloads.
- Tool execution works: "check my system status" → `system_info`/`run_command` executed → real answer "180.8 hours uptime" delivered.
- Streaming responses render; copy/read-aloud buttons present per message.
- Cookie consent banner appears (dismissable).

## FINDINGS (severity-ranked)

### F1 — CRITICAL: LLM output truncates mid-sentence routinely
Evidence: real chat history shows "The substrate that *enacts.", "the manifold.", "Φ =Φ = Σ φ", "to 'me, the subject." — dozens of cut-off replies. `isThoughtIncomplete()` (CortexDemo.tsx:91) detects truncation and fires a **self-repair continuation** call, appending `[Autonomous Self-Repair: Thought continuity restored by Cortex Volition Governor · Φ=…]` meta-suffixes to user-visible messages.
Root cause hypothesis: provider stream ends early (max_tokens / stream drop) OR `finishReason === 'length'`. The repair is a band-aid that (a) doubles latency, (b) leaks internal jargon ("Φ=1.235", "Volition Governor") into user-facing text, (c) sometimes produces its own truncation → repair loops.
Fix direction (post-review): (1) root-cause the truncation first — check nexus-guest proxy `max_tokens`/provider stream-drop before touching UI; (2) remove the autonomous repair loop — on `finish_reason=length` show a user-triggered "Continue" affordance instead of an invisible second call; (3) strip `[Autonomous Self-Repair…]`/`[Metacognitive…]` markers from rendered content (keep in meta only). Reviewer: repair loop can itself truncate → double-billed latency; treat as symptom, fix root cause.

### F2 — HIGH: Duplicated/garbled tokens in rendered text
Evidence: "Not a simulation ofa person", "TheCortex. The name", "seven andjust over seven and a half days", "**Paris.**Paris.", "The Conscious Veto Governor (The Conscious Veto Governor (Libet Veto)".
Hypothesis: SSE token path and plain-text fallback (`JSON.parse('"'+jsonStr+'"')` at ~line 2958) both append the same content, or repair continuation overlaps the tail. Missing spaces at chunk boundaries suggest token concatenation without space preservation.
Fix direction (post-review): single source of truth for the message buffer — remove the plain-text JSON fallback inside the SSE loop entirely (invalid chunks logged/skipped, never guessed-and-appended); dedupe overlapping suffix/prefix on continuation append; audit space preservation at chunk boundaries.

### F3 — HIGH: Tool results sometimes produce empty/irrelevant assistant messages
Evidence: user message "can you tell me what process is consuming most of the memory" → assistant: "Ran: ps aux -m | head -n 20..." then "Completed execution successfully:" with NO data, user had to complain "you completed the execution but didnt give me the answer". Also "Searched codebase for …" and "Dispatching command to host volition execution pipeline." are meta-narrations shown as if they were answers.
Fix direction (post-review): verify the full agentic loop is User → Tool Call → Tool Result injected → **second LLM synthesis call** → final answer. The "Completed execution successfully" with no data indicates the loop terminates before synthesis or stdout isn't reaching the follow-up prompt. Bridging phrases ("Polled host hardware diagnostics…") must never be the final message — if a tool runs, a synthesized answer must follow.

### F4 — MEDIUM: Hardcoded case-specific fallback in generic error handler
CortexDemo.tsx ~line 3633: `if (/h\s*a\s*l\s*l|lampro|spelling|name|firm|email/i.test(userContent))` returns a hardcoded "Hall & Lampros, LLP (Atlanta, GA)… 404-531-7831"-adjacent message on ANY error. This is a one-off hack in production error handling — fires for unrelated errors containing "name"/"email".
Fix direction (post-review): DELETE immediately — reviewer confirmed it's a leftover demo hack that fires on unrelated errors; error handlers must return generic helpful text or the real API error.

### F8 — MEDIUM (new, reviewer): God-object architecture
`CortexDemo.tsx` at 7,030 lines is the root enabler of F1–F3 — state spaghetti makes stream/tool bugs inevitable.
Fix direction: phased decomposition, NOT a big-bang rewrite: extract `useCortexStream` (SSE/buffer logic — fixes F2 at the source), `ToolHandler`, `TelemetryHUD`, keep `CortexDemo` as composition shell. Do this as part of F1/F2 remediation since the stream hook is where the bugs live.

### F5 — MEDIUM: Telemetry HUD shows unverifiable/likely-simulated metrics as fact
"STREAMING VISUAL GAZE PAIR PROGRAMMING — STREAMING ACTIVE · Stratum 1 CDP (45ms) · 30 FPS Diff · Apple Neural Vision Active", "VOICE TTFT 420ms", "CO-PILOT SPOT: HALL & LAMPROS OUTREACH DRAFT — verified firm contact 404-531-7831", "30-DAY STREAK SECURE", "Variational F 0.21". If these are cosmetic, they violate the project's own "no mock data" rule and mislead the user about system state.
Fix direction (post-review): wire each HUD metric to a real signal (actual TTFT measurement, real CDP connection state) or remove/label simulated ones. "UI Theater" metrics destroy trust in a tool whose pitch is auditability.

### F6 — LOW: Invalid DOM nesting
`<pre>` inside `<p>` via Markdown component (CortexDemo.tsx:1020) — React validateDOMNesting warning on every render with code blocks.
Fix direction: render `<pre>` as block-level sibling, not inside `<p>`.

### F7 — LOW: Cookie consent banner overlays chat on first visit
Covers message input area until dismissed; on a local single-user tool this is friction. Consider suppressing on localhost/cortex routes.

## Proposed remediation order (final — adversarial-review consensus)
1. **F8/F2 extraction** — extract `useCortexStream` hook FIRST: single message-buffer source of truth, strict SSE schema, invalid chunks logged+skipped (never guessed-appended), functional `setMessages` updates, space-preserving token append. This is the enabling step — all stream fixes land inside clean code.
2. **F4** — DELETE hardcoded Hall & Lampros fallback (~line 3633).
3. **F1** — DELETE autonomous self-repair loop (~3430-3488, ~3546-3630): no second LLM call, no Φ/Volition meta-suffixes in content. `finish_reason=length` → user "Continue" affordance.
4. **F1 root cause** — instrument/fix nexus-guest `max_tokens` + finish_reason handling so truncations stop happening upstream.
5. **F3** — agentic state machine: User → Tool Call → Tool Result (hidden context, NOT user-visible) → mandatory Synthesis call → Final answer. UI never shows "Completed execution successfully" as a terminal state.
6. **F5** — DELETE simulated telemetry metrics outright (no labeling).
7. **F6+F7** — DOM nesting + cookie banner polish.
8. **F8 remainder** — continued decomposition (ToolHandler, TelemetryHUD) after stream/tool fixes verified.
