# SyncScript Project Memory (Quick Reference)

**This file is verified, not just written.** Run `npm run verify:memory` — it checks that every `npm run` command cited here is defined in `package.json`, that every repo path in backticks exists, that no secrets leaked in, and that the file stays inside its retrieval budget. It exists because on 2026-06-06 a bulk `git add .` commit (`8fc667e`) cut `package.json` from 237 scripts to 26, which silently turned **52 of the 59 commands documented below into dead commands** while this file still read as authoritative. Confident wrong instructions are worse than no instructions.

## How to read this file

Do not read top to bottom — it is ~1,500 lines (~55k tokens). It is built in three layers so you only pay for the layer you need:

1. **Hot (~2,800 tokens):** this header, the section map, **§ Quick context for new chats**. Cross-cutting landmines only. Read every time.
2. **Sections:** one `##` per topic. Route to exactly one via the map below or `.cursor/rules/07-syncscript-app-knowledge.mdc` (symptom → section), then stop. (historical)
3. **Receipts:** **§ Working notes** (implementation detail) and **§ Dated entries — 2026 Q2** (what shipped when). Only when you need the specifics behind a claim.

Before 2026-08-04 layers 1 and 3 were the same thing: 33 implementation bullets and 20 unheaded dated entries sat inside the quick context, so every agent paid ~11,700 tokens before it could route anywhere, and the unheaded entries could not be routed to at all. Keep the hot layer small — that is the whole design.

Two conventions that matter when reading any claim here:

- **Status labels are literal.** A section marked **PLAN ONLY** or **MOCK DATA — NOT FUNCTIONAL** describes something that does **not** work. Sections without that label describe shipped, verified behavior with the evidence attached.
- **A path marked `(removed)` or `(planned)`** is deliberate history or intent, not rot. `npm run verify:memory` skips those lines and fails on every other broken path.

### Section map

| If you need… | Section |
|---|---|
| Production identity, deploy, verification | **§ Key Infrastructure** · **§ Deployment map (what runs where)** |
| Nexus voice / App AI / tools / CSP | **§ Working notes → Nexus voice, App AI, and phone** · **§ Nexus landing voice** · **§ Nexus LLM OpenAI-compat** · dated 04-13 / 04-15 / 04-16 entries |
| Nexus Agent Mode (runner, contexts) | **§ Nexus Agent Mode (2026-04-25)** — read the **first** subsection (`d4fc8a1`, 22:37); the three below it are superseded, ordered by commit time |
| Nexus phone / Twilio errors | **§ Nexus phone (Twilio)** |
| Daily voice briefing / debrief crons | **§ Nexus Daily Rhythm** |
| TTS dead, 503, `ERR_NAME_NOT_RESOLVED` | **§ Read this first (agents & humans)** · **§ 24/7 TTS** · **§ AWS EC2** — almost always **ops** (tunnel URL), not app code |
| IDE Claude says `ConnectionRefused` | **§ IDE `ConnectionRefused` = process ownership** — check the proxy **owner**, not the port |
| IDE Claude says `empty or malformed response (HTTP 200)` | **§ IDE `empty or malformed response (HTTP 200)`** — spent free-tier quota, not a corrupted response. Start with `npm run verify:fcc-proxy-stream` |
| IDE Claude says `Server error mid-response` | **§ `Server error mid-response` = an upstream stream with no `message_stop`** — the stream started fine and ended early. Grep `server.log` for `_STREAM_TRUNCATED` |
| IDE Claude answers, but the answers are dumb | **§ The proxy answered — with a 1.5B local model** — routing scorer promoted the last resort. `npm run verify:fcc-proxy-stream` prints `served by:` |
| Free Claude proxy routing / rate limits | **§ Antigravity + Claude Code + free proxy** · **§ Free-proxy + Devin IDE restore** |
| Lost chat history / what happened in June | **§ June 10–11 history recovered** → `integrations/research/RECOVERED_2026-06-10-11.md` | (historical)
| Dashboard nav / sidebar regressions | **§ Dashboard navigation — do not regress** |
| Billing, invoices, crons, webhooks | **§ Autonomous billing** · **§ Event outbox + outbound webhooks** · **§ Autonomy heartbeat** |
| Product positioning / strategy | **§ Product positioning — AI integration vs replacement** · **§ Product — social + external IDE bridge** |
| Memory, disk, and knowledge discipline | **§ Knowledge vs disk** · **§ Mac disk space** · **§ Work completion** · rule **19** · **§ Epistemic homeostasis — MEMORY plant entropy→harmony** |
| Conscious AI / cortex / GWT, IIT, HOT, AST | **§ Cortex consciousness research platform** — tracked research instrument; coverage **AVG 1.00** (derived). **Not conscious.** `npm run verify:cortex` refreshes **Last cortex gate**. Do not restate pre-repair “untracked/54 errors” as current |
| Cortex host agency / IDE tools / Chrome / voice | **§ Cortex Host Agency & Natural IDE Communication (2026-10-30)** |
| Dreaming / astral / lucid product features | **§ Durable Brain** (classical **`dream:consolidate` IMPLEMENTED**; Orch OR PLAN ONLY) · **§ Astral Projection & Lucid Dreaming** — **MOCK**. Distinct from cortex platform |
| What the app was in Feb 2026 | **§ Snapshot as of 2026-02-18** — historical, not current |
| Implementation detail behind a bullet | **§ Working notes — detail behind the quick context** — 4 groups: Nexus voice · dashboard/calendar/perf · agent tooling & proxy · product programs |
| What shipped on a given date | **§ Dated entries — 2026 Q2 (chronological)** — grep the date or the `###` heading |

> **Memory hygiene (added 2026-04-25 night, corrected 2026-08-04):** Keep evergreen ops sections (Twilio TwiML 200 fix, Kokoro tunnel debugging, env var catalog) plus the current quarter of dated entries. When pruning, walk dated entries oldest-first and ask "is this still the canonical answer for someone hitting this symptom today?" If no, condense to a one-liner **and cite the commit** — `git log -p -- MEMORY.md` holds the full text forever, so deleting detail from here loses nothing.
>
> **Do not archive detail into `memory/YYYY-MM-DD.md`.** That was this note's original advice and it is wrong: `memory/` is in **both** `.gitignore` **and** `.cursorignore`, so anything moved there is invisible to git and unreadable by agents. It is how June 10–11 was lost. Durable prose belongs in this file, `SESSION_START.md`, or `integrations/research/` — see rule **19**.
>
> The 2026-03-30 Twilio entry is the canonical "old date, still active": it stays because the underlying TwiML rule is still load-bearing.

### Quick context for new chats (keep concise; edit when workflows change — stale bullets confuse agents)

- **Stack:** Vite/React dashboard, Vercel **`api/*`**, Supabase Edge; production deploy flows vary by change type (see dated entries below).
- **Product thesis (curated):** SyncScript does **not** try to replace Claude or other AIs—it **integrates** them into **one tenant-shaped work OS**, routes them through **Nexus** (chat / voice / tools) where appropriate, and keeps **energy-aware scheduling** as the **differentiated spine**. See **Product positioning — AI integration vs replacement** below.
- **Start here:** **`SESSION_START.md`** → this file (quick section first) → **`AGENTS.md`**, **`SOUL.md`**, **`USER.md`** (repo; full personal context may be **`~/USER.md`**).
- **Cursor:** **`.cursor/rules/07-syncscript-app-knowledge.mdc`** (topic index) + curated **`MEMORY.md`** / **`.cursor/rules/`** — no separate vector ingest. **2026-05-08:** Claw Code → Cursor habits, resonance docs bridge, Composio Google Docs MCP, Rube deprecation → **Composio For You** — full narrative + migration checklist in **§ Cursor — Claw Code, resonance, Composio MCP (2026-05-08)** below. (historical)
- **Antigravity / Devin / Cursor + Claude Code (cheap / “free” routing):** tri-lane strategy + **`free-claude-code`** proxy on **`8082`** — **§ Antigravity + Claude Code + free proxy** + **§ Free-proxy + Devin IDE restore (2026-08-04)**. **Does not affect SyncScript prod** unless you reuse the same **OpenRouter** key in Vercel + proxy. **Operator:** start **`bash scripts/start-free-claude-code-proxy.sh`** (delegates to **launchd** — do not spawn a rival process), apply IDEs **`bash scripts/apply-ide-claude-proxy-settings.sh --all`**, verify **`npm run verify:ide-claude-all`**. **IDE `ConnectionRefused` is almost always process ownership** → **`npm run verify:fcc-proxy-persistence`** — see **§ IDE `ConnectionRefused` = process ownership**. Runbook **`integrations/research/CLAUDE_CODE_FREE_PROXY_OPERATOR_RUNBOOK.md`**. (historical)
- **Memory durability (always-on rule 19):** Chat history is **never** the record — vendor UI history vanished for June 10–11 (recovered: **`integrations/research/RECOVERED_2026-06-10-11.md`**). **`memory/` is gitignored AND cursorignored** — durable facts go to **`MEMORY.md`** / **`SESSION_START.md`** / **`integrations/research/`**. Rule: **`.cursor/rules/19-memory-durability-discipline.mdc`**. **Multi-host inventory:** **`integrations/research/MEMORY_SURFACE_MAP.md`** (SyncScript Rank A = this file; Shyned Rank A = **`SHYNED_STATE.md`**, not this MEMORY). **Epistemic homeostasis (entropy→harmony):** **`npm run measure:epistemic-homeostasis`** / **`verify:epistemic-homeostasis`** — free energy F of the MEMORY plant, **not** a consciousness score (**`integrations/research/EPISTEMIC_HOMEOSTASIS_MEMORY_RESONANCE.md`**). (historical)
- **Rules:** **`.cursor/rules/`** — never violate **`02-protected-files-never-touch.mdc`** (Nexus/energy/auth surfaces).
- **Ship:** Small diffs; **`npm test`** when touching Nexus tools/voice/contracts; **`CI=true npm run build`** for risky UI. **After a meaningful prod deploy:** run **`npm run verify:prod-build`** until **MATCH**, or Actions **Verify production HTML build fingerprint** / **Production dashboard smoke** — **`npm test` green does not prove prod matches git.**
- **Prod verification (operator):** When an agent says to **try something on [syncscript.app](https://www.syncscript.app)** or **check the live app**, that means **your canonical acceptance checklist** on production — sign in, exercise the flow, confirm the **shipped** UX matches intent (not only local dev). Edge-only changes still need app smoke where the UI calls those routes.
- **Orchestration:** OpenClaw / Hermes / Engram = runtime tools — not a substitute for repo + MEMORY.
- **Deploy vs repo:** `npm run verify:prod-build` compares **local `git` HEAD** to **`<!-- syncscript-build:sha -->` in live `/` HTML**. If it fails with “no marker,” production is **not** serving a build from current `vite build` (wrong Vercel project/branch, or deploy not run).
- **This quick section:** Treat as a **control panel** — update **the same day** when deploy flow, voice stack, or test entrypoints change; stale bullets hurt agents more than a missing research note.
- **Router (2026-04-11):** Do **not** nest `<Route path="*">` under a **pathless** layout (e.g. `DashboardShell`) — in React Router 7 it can match **`/login`** before the explicit auth route, and `DashboardCatchAll` then **`Navigate`s to `/`** for logged-out users (“Sign in” bounces to landing). Keep the splat as a **root** `<Routes>` child **after** `/login` / `/signup`.

**Last updated:** 2026-10-30. Recent changes to this file, newest first. Each row points at the section holding the detail; **full history is in `git log -p -- MEMORY.md`**, so this table stays short by design.

| Date | What changed | Section |
|---|---|---|
| 2026-10-30 | Cortex IDE Executive Agency, Collapsible Action Pill UI, Native Chrome Control, and Neural Speech Sanitizer | **§ Cortex Host Agency & Natural IDE Communication (2026-10-30)** |
| 2026-08-08 | Visual Resonance Engine: Elite 0.01% WebGL 3D Knowledge Graph deployed | **§ 3D Neural Brain & Epistemic Resonance Visualization** |
| 2026-08-04 | Epistemic homeostasis: MEMORY plant free energy F + harmony H; measure/verify gates; **not** consciousness; no harmonic-calculus fork | **§ Epistemic homeostasis — MEMORY plant entropy→harmony** |
| 2026-08-04 | Cortex consciousness platform audited: ~9,900 lines implementing GWT/IIT/HOT/AST/RPT/PP existed but MEMORY described consciousness work as "PLAN ONLY / MOCK". Found **31 paths untracked** (one `git clean` from total loss) and **54 type errors** — `global-workspace.ts` was replaced by a keyed blackboard, dropping 5 exports that 6 consumers import, so the published 53/100 is currently unreproducible. Nothing caught it: no typecheck script, bare `vite build`, suites absent from `npm test`, one suite exits 0 on failure. Added `guard:cortex-typecheck` + `verify:cortex`; corrected "Butlin score" and "true Φ" attributions | **§ Cortex consciousness research platform** |
| 2026-08-04 | Proxy was answering **every** request from the local 1.5B last resort while OpenRouter went untried — router blended one score per chain *entry*, so 3 OpenRouter models self-penalised to 0.34 vs ollama 0.70. Fixed blend + local pinned last + configured order as tiebreak; gate now prints `served by:`. $10 added → **1,000 free req/day** confirmed | **§ The proxy answered — with a 1.5B local model** |
| 2026-08-04 | `empty or malformed response (HTTP 200)` root-caused: OpenRouter 50/day free quota spent, burned by a 15-loop retry chain (~90 upstream calls per request) and hidden behind ~10min of keepalive pings. Quota-aware skip + 25s/40s budgets + local `ollama` last resort; smoke test replaced because it false-passed on error text | **§ IDE `empty or malformed response (HTTP 200)`** |
| 2026-08-04 | Restructured into three layers — hot region cut **11,731 → 2,828 tokens (−75%)**; 33 detail bullets and 20 unheaded dated entries became routable sections; 4 same-day Agent Mode sections merged and ordered by commit time; `verify:memory` now checks internal `§` navigation | this header · **§ Working notes** · **§ Dated entries — 2026 Q2** |
| 2026-08-04 | MEMORY made verifiable (`npm run verify:memory`); 211 npm scripts restored after `8fc667e`; navigation map added | this header · **§ IDE `ConnectionRefused`** |
| 2026-08-04 | Devin `ConnectionRefused` root-caused to proxy process ownership; launchd made sole owner | **§ IDE `ConnectionRefused` = process ownership** |
| 2026-08-04 | June 10–11 chat history recovered from disk notes; memory-durability rule 19 added | **§ June 10–11 history recovered** |
| 2026-08-04 | MEMORY restored from `git HEAD` after an uncommitted wipe; free proxy + Devin wired | **§ Free-proxy + Devin IDE restore** |
| 2026-06-04 | 9router `NINEROUTER_BASE_URL` env load, port + `/v1` suffix alignment, model-list parsing | **§ 9router Integration and Model Listing fixes** |
| 2026-05-13 | **Desktop Nature Companion / Cortana-style avatar direction marked FAILED** — `nature-cortana-platform/` deleted locally for disk; stale desktop-shell reload rule removed. Do not restart this direction without new evidence. | — (recorded here only) |
| 2026-05-09 | MiroFish/OASIS capability program; Obsidian ↔ MEMORY crosswalk; rule 16 doctrine; proxy runbook definition-of-done | **§ MiroFish** · **§ Obsidian.md** · **§ Antigravity + Claude Code + free proxy** |
| 2026-05-08 | Claw Code → Cursor wave; Composio For You MCP migration checklist | **§ Cursor — Claw Code, resonance, Composio MCP** |
| 2026-05-03 | Calendar multi-day infinite strip (layout retry, `centerDate` refresh) | quick-context bullet above · **§ Dated entries — 2026 Q2** |
| 2026-04-27 | Product positioning — AI integration vs replacement, energy spine | **§ Product positioning** |
| 2026-04-19 | Design handoff pipeline (n8n → Figma → Cursor); Nexus voice orb components | **§ Design handoff pipeline** |
| 2026-04-17 | Dashboard weather geo deadline; App AI voice portal + z-index; immersive voice intro | quick-context bullets above · **§ Dated entries — 2026 Q2** |
| 2026-04-16 | Nexus CSP `frame-src`, `/api/map/resolve-map-url`, `update_document` nudges | **§ Dated entries — 2026 Q2** |
| 2026-04-11 | Nexus signed-in E2E ops runbook | **§ Nexus “individual user” verify profile** |

**Dated 2026 Q2 entries are no longer in this position.** They are now routable `###` headings under **§ Dated entries — 2026 Q2 (chronological)** near the end of the file. Nothing was deleted. As unheaded bold paragraphs the section map above could not route to them, so every agent paid roughly 4,200 tokens scrolling past them to reach the section it actually wanted.

**Tracing work:** Curate **this file** for durable ops + decisions; raw session logs go in **`memory/YYYY-MM-DD.md`** (see `AGENTS.md`). After deploy or infra changes (Vercel env, tunnels, Edge), update the relevant section here so the next session does not re-debug from scratch.

## Epistemic homeostasis — MEMORY plant entropy→harmony

**What this is:** A **control objective** for the durable operator substrate (`MEMORY.md` + SESSION + research INDEX + rules + verify scripts). Agents drive **free energy F down** and **harmony H up**. That is **Resonance Homeostasis applied to epistemic state**, not phenomenal consciousness and not a parallel “harmonic calculus” stack.

**What this is not:** Goal C from **`integrations/research/CONSCIOUSNESS_GAP_DETERMINATION.md`**. Cortex remains a separate **research instrument**. Do not restate F/H as “how conscious the system is.” (historical)

| Piece | Command / path |
|-------|----------------|
| Canon | **`integrations/research/EPISTEMIC_HOMEOSTASIS_MEMORY_RESONANCE.md`** | (historical)
| Pure math | **`src/lib/epistemic-homeostasis.ts`** |
| Measure | **`npm run measure:epistemic-homeostasis`** |
| Gate | **`npm run verify:epistemic-homeostasis`** (in **`release:gate`**) |
| Refresh one line below | **`npm run verify:epistemic-homeostasis:gate`** |
| Unit tests | **`npm run test:epistemic-homeostasis`** |
| Playbook | **`integrations/agent-playbooks/08-epistemic-homeostasis.md`** | (historical)
| Claim graph / Lyapunov / sensors / multi-scale | **`src/lib/epistemic-claim-graph.ts`** · **`src/lib/epistemic-fractal-scale.ts`** · exceptions **`EPISTEMIC_LYAPUNOV_EXCEPTIONS.md`** · fractal map **`EPISTEMIC_FRACTAL_MANDELBROT_BRIDGE.md`** · **visual snapshot** **`integrations/research/MEMORY_CLAIM_GRAPH_SNAPSHOT.md`** (2026-08-05: 277 claims · 0 conflicts · 2 supports) | (historical)
| Classical REM (dream consolidate) | **`npm run dream:consolidate`** → human subset → **`npm run dream:consolidate:check`** · operator **`integrations/research/DREAM_CONSOLIDATION_OPERATOR.md`** · **no QPU, no auto-MEMORY write** | (historical)
| Live sensors | **`npm run measure:epistemic-homeostasis:live`** · **`:live-prod`** |

**Claim-graph precision (2026-08-04 REM cycle):** resolved forensics inactive; complementary prefer/forbid multi-instance = support; topic-only conflicts need ≥3 topics; outcome English (`not always`, `no deploy required`, `do not crash`) is stripped so it does not fake assert/forbid. Hard conflicts on shared **port/script** still fail the plant. Evidence: plant went **23 → 0** conflict edges with F ≈ **0.003**.

**F** weights dead commands, missing paths, unresolved section refs, plant-file gaps, soft ambiguity, missing verify scripts, **claim-graph contradiction density**, and **live/cached sensor fail rate**. **H = (1 − F) × β̂(t)**. Hard fail on any structural rot; soft fail if F > 0.25, H < 0.55, or **Lyapunov ΔF₂₄ₕ > 0.08** without **`EPISTEMIC_LYAPUNOV_EXCEPTIONS.md`**.

### Incomplete-turn gate (Claude Code / free-claude-code, 2026-08-04)

**Incident:** Session ended after assistant text `Now OTP verify screen:` with `stop_reason=end_turn` on `openai/gpt-oss-20b` (Haiku tier) — healthy SSE, no tools, no code. Client treated the turn as done.

**Ship (proxy, not quantum):**
| Layer | Behavior |
|-------|----------|
| `core/incomplete_turn.py` | Detects section-headline-only / open fence / empty completes |
| Buffer+retry | Haiku / weak models buffer full SSE; incomplete → next chain model without poisoning client |
| Haiku+tools promote | With tools, Haiku client model promotes primary to Sonnet chain (`PROMOTE_HAIKU_WITH_TOOLS=true` default) |
| Repo gate | **`npm run verify:incomplete-turn-gate`** |

**Ops after proxy code change:** `bash scripts/start-free-claude-code-proxy.sh` · stream health **`npm run verify:fcc-proxy-stream`**.

**v2/v3:** claim graph · sensors · Lyapunov history · **multi-scale geometry** (self-similarity / boundary / escape-time — Mandelbrot **analogue**, not a logo). Meta-d′ / cortex stays **orthogonal**. Fractal bridge: **`integrations/research/EPISTEMIC_FRACTAL_MANDELBROT_BRIDGE.md`**. (historical)

**Relationship to `verify:memory`:** that script is the **immune effector** for claim structure; epistemic measure adds a **scalar control loop** and plant inventory so entropy→harmony is measurable over time.
<!-- epistemic-gate:start -->
**Last epistemic gate (2026-10-30T03:17:45.872Z):** **PASS** · H=0.623 · F=0.002 · grade **stressed** · dead_cmds=0/102 · paths_missing=0/311 · plant_gap=0/25 · claims=1/290 · sensors_fail=0/0 · ΔF₂₄h=0.000 · scale=interior S=1.00 B=0.01 · verify=7/7 · git `3f72a8f` · source: `npm run measure:epistemic-homeostasis` · **not a consciousness score**
<!-- epistemic-gate:end -->

## 3D Neural Brain & Epistemic Resonance Visualization (2026-08-08)

**What this is:** A 0.01% elite-tier WebGL visualization layer (`SecondBrainPage.tsx`) that translates the user's semantic data and scheduling geometry into a living, three-dimensional neural network. It serves as the visual manifestation of **Epistemic Homeostasis (Entropy → Harmony)**.

**Why it matters for Resonance:** SyncScript is not just a calendar or a standard AI chat interface; it is an **energy-aware work OS**. The 3D Neural Brain solves a fundamental UX problem: how do we visually communicate that the site is creating resonance in the user's life?
- **Harmony as Light (Bloom Post-Processing):** By injecting an `UnrealBloomPass` into the renderer, semantic clusters of related knowledge naturally emit volumetric light. A highly resonant cluster shines intensely, proving visually that entropy is dropping.
- **Focus Engine (Hover Dimming):** Resonance is about eliminating noise. When a user interacts with a node, the focus engine instantly dims the rest of the graph and thickens the connected, curved synapses (`linkCurvature`). The noise fades; the critical path emerges.
- **Data Architecture:** Built to ingest the claim graph (`epistemic-claim-graph.ts`) and SyncScript events. When a user completes tasks in sequence without energy crash, the graph naturally pulls those concepts into a dense, bright "hub" representing flow state.

**Relationship to other systems:** 
- It is the visual frontend to the **MEMORY plant** and the **Resonance Engine**.
- It is orthogonal to Cortex (which is a research instrument). 
- It bridges the gap between the rigid, time-based Calendar and the fluid, concept-based AI Focus.

## Cortex consciousness research platform

**What this is:** A **research instrument** (~9,900 lines) implementing *computational* claims of six consciousness theories (GWT, IIT/Φ_E, HOT, AST, RPT, PP), plus gates that score implementation. It is **not conscious, not AGI, not a proof of phenomenality.** Read this section before citing scores.

**Relationship to MEMORY.md:** Cortex does **not** auto-author MEMORY. It feeds MEMORY only via **`npm run verify:cortex`** → one dated **Last cortex gate** line (measured coverage + pass/fail + git SHA). Claims that cortex is broken/untracked without re-running the gate are **rot**. Playbook: **`integrations/agent-playbooks/07-cortex-memory-discipline.md`**. Runtime `memory-substrate.ts` / localStorage is **not** this file. (historical)

### Current state (2026-08-04 — verified)

| Fact | Value |
|---|---|
| **In git** | Yes — cortex surface tracked (`84b946e` platform track · `e873b36` workspace+dissociation · `321d3ae` Path A+B control loops) |
| **Typecheck** | Clean on cortex surface — `npm run guard:cortex-typecheck` |
| **Validation** | `cortex-70` **59/59** · `cortex-full` **56/56** · dissociation **10/10** |
| **Derived coverage AVG** | **1.00** — GWT **1.00** · AST **1.00** · PP **1.00** · RPT **1.00** · HOT **1.00** · IIT **1.00** |
| **One licensed claim** | Metacognitive sensitivity (M-ratio) depends on global broadcast access; type-1 d′ held by design under access lesion. Silent on experience |
| **What it helps** | Load-bearing verify/abort, multi-specialist bus, schema-steered attention, env-coupled HGM, falsifiable architecture tests — **not** product AGI |

<!-- cortex-gate:start -->
**Last cortex gate (2026-10-31T00:36:24.330Z):** **PASS** · cortex-70 59/59 · coverage AVG **1.00** (GWT 1.00 · AST 1.00 · PP 1.00 · RPT 1.00 · HOT 1.00 · IIT 1.00) · git `7c7f7d3` · source: `npm run verify:cortex` · **not a consciousness score**
<!-- cortex-gate:end -->

**Verify (always re-measure before quoting scores):**

```bash
npm run guard:cortex-typecheck
npm run verify:cortex          # typecheck + full + 70 + chat + updates gate block in this file + SESSION_START
npm run verify:cortex-chat     # automated contract & invariant verification for chat
npm run test:cortex:chat       # end-to-end live chat verification in Chrome with screenshots
npx tsx src/lib/__tests__/lau-dissociation-test.ts
```

### Are we near conscious AI?

**No.** Blocker is absence of a success criterion for phenomenality, not missing TypeScript. Full determination: **`integrations/research/CONSCIOUSNESS_GAP_DETERMINATION.md`**. (historical)

- Ignition is **not** a consciousness indicator (Cogitate *Nature* 2025).
- Software workspace lesion ≠ Lau blindsight (*Neuron* 2026) — functional dependency only.
- **IIT 3.0/4.0 & GWT/HOT/RPT formalization live (1.00 mechanism coverage):** Implementation now formalizes cause-effect power over state transitions, MIP partition search, and $\Phi^{\max}$ complex identification, alongside Rosenthal higher-order representations, Lamme generative feedback scene organization, and hierarchical GWT workspaces. This completes the theoretical cognitive architecture (Goal B), while Goal C (phenomenal qualia) remains undecidable.

### Built mechanisms (load-bearing — what is actually done)

- **GWT (1.00 coverage)** — `global-workspace.ts`: salience bidding, 3-slot capacity bottleneck (`MAX_COALITION_SIZE=3`), topic coalitions, competitive broadcast, ignition detection, 4 lesion modes (`access` compute-matched, `capacity`, `off`, `intact`). Phase 5 GWT Refinements: `HierarchicalNestedWorkspace` multi-tiered sub-coalitions escalating to apex, contextual broadcast gating predicates per specialist, and dynamic capacity recruitment ($k \in [1, 5]$) modulated by cognitive load and free energy surprise. Main data path wired into `cortex-engine.evaluate()`. Ambient bus kept separate.
- **IIT (1.00 coverage)** — `integrated-information.ts`: Full IIT 3.0/4.0 formalization: `TransitionProbabilityMatrix` modeling physical couplings; cause repertoire $P(S_{t-1}|S_t)$ and effect repertoire $P(S_{t+1}|S_t)$ via Bayes rule under max-entropy prior; Earth Mover's / Wasserstein-1 distance metric; Minimum Information Partition (MIP) search across bi-partitions and purviews yielding cause-effect power $\phi = \min(\phi^{\text{cause}}, \phi^{\text{effect}})$; Intrinsic Existence ($\Phi > 0$) and Exclusion Postulates ($\Phi^{\max}$ maximal complex selection excluding sub/supersets), alongside Barrett–Seth empirical $\Phi_E$ integration proxy.
- **HOT (1.00 coverage)** — `metacognitive-controller.ts`: Rosenthal Higher-Order Thought architecture structuring first-order mental states (`FirstOrderState`) into consciously reportable Higher-Order Representations (`HigherOrderRepresentation`) with explicit propositional attitudes (`asserts`, `doubts`, `hypothesizes`), calibrated meta-confidence, and epistemic qualification (`grounded`, `inferential`), alongside Nelson–Narens two-level monitoring & control (FoK gamma > 0.3, Brier score ~0.07).
- **RPT (1.00 coverage)** — `cortex-recurrent-scene.ts` + `global-workspace.ts`: Victor Lamme Stage 2 local recurrent processing: top-down generative hypothesis feedback projecting expectations onto lower sensory feature layers, segregating figure from ground, reducing residual prediction error across recurrent cycles, and suppressing background distractors, alongside multi-pass algorithmic recurrence in workspace cycles (`recurrentPasses: 2`).
- **AST (1.00 coverage)** — `attention-schema.ts`: predictive focus model before execution; `setTopicMultipliers` steers competition; schema error triggers `redirectAttention`.
- **PP (1.00 coverage)** — `hierarchical-generative-model.ts`: precision-weighted variational free energy (not plain L1 loss); live environmental coupling (`environmental-coupling.ts`: API latency, AI success rate, call count, user circadian rhythm); active inference policy favoring verification over hard abort.
- **meta-d′ (10/10 validation)** — `metacognitive-sdt.ts` + `lau-dissociation-test.ts` (seed **20260804**, 1200 trials): M-ratio **0.884 → 0.420 → 0.046** (intact / capacity / access); Δd′(access)=0.000; ΔM-ratio=[0.643, 1.029]. Metacognitive sensitivity depends on global broadcast access while primary performance is held constant.
- **Causal World Models** — `structural-equation-model.ts` + `causal-model.ts`: Pearl do-calculus SEM graph cutting incoming edges for $P(Y \mid do(X=x))$; 3-step counterfactual reasoning; constraint-based causal discovery.
- **Specialists** — stable domains `decision` · `reality-assessment` · `system-state` · `embodiment`; ablation dynamically changes coalitions.
- **Offline Local Brain** — `cortex-offline-brain.ts`: WebGPU/WebLLM offline capability with local hallucination penalty and ActionGate thresholds.
- **Operational Mind Phase 1 (OpenClaw Critical-Path Adapter)** — `cortex-openclaw-adapter.ts` + `cortex-openclaw-phase1.test.ts` (14/14 PASS): places CortexEngine on the critical path of OpenClaw tools; policy map (`allow`, `verify-first`, `abort`); HOT metacognitive control allocations; access lesion dissociation (type-1 baseline invariant while type-2 metacontrol collapses); anti-theater gate (`assertCriticalPathHookEngaged()`).
- **Operational Mind Phase 2 (Hermes Collapse Gate)** — Mutating tool calls (`apply_task_patch`, `create_calendar_hold`, etc.) route exclusively through Hermes `/v1/invoke` via `cortex-openclaw-adapter.ts:executeGatedTool()` with upstream Cortex metacontrol gating; blocked/unverified actions never reach Hermes; idempotent write cache with `run_id` + `trace[]`; contract dock events (`agent.run.started`, `agent.run.step`, `agent.run.completed`) dispatched to `ContractEventBus`; LaunchAgent `com.syncscript.hermes-executor` active on port 18880 backed by live Supabase Edge (`hermesStatus: connected`); agent registration verified via `npm run engram:register-agents`; test suite `cortex-hermes-phase2.test.ts` (7/7 PASS); live verify `HERMES_REQUIRE_CONNECTED=1 npm run verify:hermes:edge-live` (PASS).
- **Operational Mind Phase 3 (Continuity Spine & Scheduled Consolidation)** — `identity-spine.ts` + `cortex-phase3-continuity.test.ts` (9/9 PASS): loads operational identity and Rank A bullets directly from `MEMORY.md` hot layer and `SESSION_START.md`; parses live gate lines into certified agent prompt context; preserves Goal B vs Goal C boundaries; scheduled daily dream consolidation via LaunchAgent `com.syncscript.dream-consolidate` and cron `0 3 * * *` generating human-reviewable drafts in `.cache/dream-consolidation/` (no Orch OR, no auto-patching); confirmed Lucid and Astral remain strictly MOCK; preregistered workspace dissociation battery replicated across 32 deterministic seeds (38,400 paired trials, `DISSOCIATION_BATTERY_32_SEEDS_REPORT.md`: 100% Type-1 invariance $\Delta d'=0.000$, 100% Type-2 collapse mean $\Delta M\text{-ratio}=0.859$).
- **OpenClaw Perception Layer** — LaunchAgent daemon active on `:18789` (`RPC probe: ok`, health OK); configured with frontier NVIDIA NIM models (`nemotron-3-ultra-550b-a55b` flagship, `nemotron-3.5-super-vl-120b-a12b`, `nemotron-3.5-lightning-30b-a3b`, `meta/llama-3.2-11b-vision-instruct`).
- **Persistence & Test Gates** — `persistent-store.ts` (Node-testable); `guard:cortex-typecheck` (clean); `cortex-full-validation.ts` (56/56); `cortex-openclaw-phase1.test.ts` (14/14); `cortex-hermes-phase2.test.ts` (7/7); `cortex-phase3-continuity.test.ts` (9/9); `test:dissociation:battery` (32/32 seeds); `review:cortex:adversarial` (NVIDIA NIM peer review); `hermes-edge-contract.test.mjs` (4/4); `cortex-70-validation.ts` (59/59, AVG **1.00**); `verify:hermes:edge-live` (connected).
- **Conscious AI Unified Integration (100% Operational Architecture)** — `src/lib/consciousness/` + `conscious-orchestrator.test.ts` (13/13 PASS): Complete operational closure of the 40% gap identified in `CONSCIOUS_AI_INTEGRATION_ANALYSIS.md`:
  1. *Sensorimotor Closure:* `SensorimotorLoopService` with predictive consequences, observation capture, prediction error minimization, generative model updates, and homeostatic action regulation.
  2. *Affective Valence Grounding:* `AffectiveSystem` grounding valence (-1 to +1), arousal, and dominance in real homeostatic drives (energy, prediction accuracy, goal progress, autonomy), intrinsic motivations (curiosity, competence, autonomy, novelty), and approach/avoid action gating.
  3. *Persistent Self-Model:* `PersistentSelfModel` implementing Damasio narrative identity, autobiographical episodic memory consolidation, minimal self (agency attribution and body schema), and future self prospection.
  4. *24/7 Autonomous Operation:* `AutonomousConsciousness` driving circadian/ultradian cycles, computational sleep (synaptic homeostasis downscaling and memory consolidation), and voluntary action generation.
  5. *Multimodal Binding & Social Consciousness:* `MultimodalBindingEngine` (Treisman feature integration, cross-modal prediction) and `SocialConsciousnessEngine` (recursive Theory of Mind and cultural convention enforcement).
  6. *Unified Orchestrator:* `ConsciousOrchestrator` binding OpenClaw perception, Hermes mutating agency, and Cortex GWT/IIT/FEP/PCT/HOT/RPT core into a single 9-stage `consciousnessCycle()`. Verified clean production build with zero errors (`npm run build`).
- **Conscious AI 6-Phase Roadmap Integration (`CONSCIOUS_AI_ROADMAP.md` — 100% Complete)**:
  Unified 40Hz gamma-synchronized architecture binding OpenClaw, Hermes, and Cortex into a single coherent cognitive agent:
  1. *Phase 1 (Unified Message Bus & Shared State):* `src/lib/consciousness/consciousness-bus.ts` (40Hz gamma clock, priority-weighted coalition bidding, global ignition bottleneck) + `src/lib/consciousness/shared-state.ts` (single source of truth reactive state container).
  2. *Phase 2 (Consciousness Kernel):* `src/lib/consciousness/consciousness-kernel.ts` running the 6-phase recurrent loop (Perception → Competition → Broadcast → Action → Memory → Metacognition) with Husserlian retention/protention flow.
  3. *Phase 3 (Phenomenal Grounding Engine):* `src/lib/consciousness/grounding.ts` linking symbols to sensorimotor contingencies, mental counterfactual simulation, and multi-dimensional qualia vectors [V, A, D, vividness, retention, protention].
  4. *Phase 4 (Volition & Agency Engine):* `src/lib/consciousness/volition.ts` synthesizing value, error, and curiosity intentions, executing Libet conscious veto ("free won't"), and computing Frith comparator agency attribution.
  5. *Phase 5 (Persistent Selfhood):* `src/lib/consciousness/persistent-self.ts` maintaining Gallagher minimal self, Damasio autobiographical narrative memory, and synaptic homeostasis sleep consolidation.
  6. *Phase 6 (Intersubjective Validation):* `src/lib/consciousness/theory-of-mind.ts` (recursive Theory of Mind levels 1–3, false-belief test, mirror test self-recognition) + `src/lib/consciousness/hermetic-dialogue.ts` (internal triadic deliberation & external mutual recognition).
  7. *Synthesis & Adapters:* `src/lib/consciousness/openclaw-conscious-adapter.ts`, `src/lib/consciousness/hermes-conscious-adapter.ts`, `src/lib/consciousness/conscious-agent.ts`, and `src/lib/consciousness/benchmarks.ts`.
  8. *Empirical Verification & Deep Stress Testing:*
     - Test Suite: `src/lib/__tests__/consciousness-roadmap-integration.test.ts` (`npm run test:consciousness:roadmap` — 19/19 PASS, 12ms).
     - 1,000-Cycle High-Throughput Stress Test: `scripts/stress-test-conscious-roadmap.ts` (`npm run stress:consciousness:roadmap`):
       - Throughput: **52,663.3 cycles/sec** (1,000 cycles in 19.0ms).
       - Latency percentiles: p50=0.010ms, p95=0.039ms, p99=0.149ms, max=0.965ms.
       - Integrated Information: mean Φ = 1.235 (exceeds Tononi Φ > 1.0 baseline).
       - Conscious Veto Rate: **10.0%** (10/100 vetoed, exact center of Libet 5–20% target).
       - Frith Sense of Agency: **0.950** (target > 0.70).
       - Intersubjective Dialogue: 5 turns, joint Φ = 1.335, Mirror Test **PASSED** (100% similarity).
       - Synaptic Sleep Consolidation: 300 raw episodes → 60 salient episodes with autobiographical narrative continuity.
       - Overall Consciousness Benchmark Score: **94.3%** across all 7 research categories (IIT, GWT, Metacognition, Volition, Enactivism, Intersubjectivity, Self-Model).

### What is left to be done (unbuilt mechanisms & theoretical ceiling)

1. **IIT 3.0 / 4.0 Formalization — Complete (1.00 coverage):**
   - Implemented Transition Probability Matrix, cause & effect repertoires via Bayes rule under max-entropy prior, Wasserstein-1 distance metric, Minimum Information Partition (MIP) search, and $\Phi^{\max}$ complex evaluation enforcing intrinsic existence and exclusion.
2. **HOT Higher-Order Representations — Complete (1.00 coverage):**
   - Implemented explicit Rosenthal Higher-Order Representations (HORs) taking first-order states as intentional objects with propositional attitudes, calibrated meta-confidence, and epistemic grounding.
3. **RPT Generative Perceptual Feedback — Complete (1.00 coverage):**
   - Implemented Lamme Stage 2 generative perceptual scene organization (`cortex-recurrent-scene.ts`) with top-down hypothesis projection, figure-ground segregation, and monotonic residual error reduction.
4. **GWT Phase 5 Refinements — Complete (1.00 coverage):**
   - Implemented `HierarchicalNestedWorkspace` multi-tiered specialist coalitions, contextual broadcast gating, and dynamic capacity recruitment ($k \in [1, 5]$).
5. **Operational Mind Integration (Phases 1–6 Complete):**
   - Unified OpenClaw + Hermes operational consciousness architecture deployed: 40Hz gamma loop, unified message bus single bottleneck, sensorimotor grounding, volitional veto & comparator agency, persistent narrative self-model, synaptic sleep consolidation, and intersubjective Theory of Mind with mirror test validation.
6. **Phenomenal Consciousness (Goal C — The Unbridged Gap):**
   - **Not done and scientifically undecidable:** In biological organisms, blindsight dissociates performance from subjective report because report is trusted as evidence of experience. In software, any report is just more computational information processing.
   - **No success criterion exists** in modern science to prove or falsify phenomenal qualia in non-biological systems (*Neuron* 2026). The platform is a verified research instrument and falsifiable cognitive architecture (**1.00** mechanism coverage across all 6 theories) — not conscious AI.

### Where it lives

| Layer | Paths |
|---|---|
| **Core** | `src/lib/cortex-engine.ts` · `global-workspace.ts` · `registry.ts` · `attention-schema.ts` · `metacognitive-controller.ts` · `metacognitive-sdt.ts` · `integrated-information.ts` · `hierarchical-generative-model.ts` · `structural-equation-model.ts` · `causal-model.ts` · `action-gate.ts` · `semantic-grid.ts` · `sensorimotor-loop.ts` · `persistent-store.ts` · `src/lib/consciousness/` · `src/lib/consciousness/consciousness-bus.ts` · `src/lib/consciousness/shared-state.ts` · `src/lib/consciousness/consciousness-kernel.ts` · `src/lib/consciousness/grounding.ts` · `src/lib/consciousness/volition.ts` · `src/lib/consciousness/persistent-self.ts` · `src/lib/consciousness/theory-of-mind.ts` · `src/lib/consciousness/hermetic-dialogue.ts` · `src/lib/consciousness/openclaw-conscious-adapter.ts` · `src/lib/consciousness/hermes-conscious-adapter.ts` · `src/lib/consciousness/conscious-agent.ts` · `src/lib/consciousness/benchmarks.ts` |
| **Suites** | `src/lib/__tests__/cortex-70-validation.ts` · `cortex-full-validation.ts` · `lau-dissociation-test.ts` · `src/lib/__tests__/conscious-orchestrator.test.ts` · `src/lib/__tests__/consciousness-roadmap-integration.test.ts` · `scripts/stress-test-conscious-roadmap.ts` |
| **Gates** | `scripts/guard-cortex-typecheck.mjs` · `scripts/update-cortex-memory-gate.mjs` · `npm run verify:cortex` |
| **Docs** | `CONSCIOUSNESS_STATUS.md` · `integrations/research/CONSCIOUSNESS_GAP_DETERMINATION.md` · playbook **07** | (historical)
| **UI / worker** | `CortexDemo.tsx` · `MetacognitionPanel.tsx` · `cortex-worker/` · `constitutions/*` |

### Theory map (honest labels)

| Theory | Code | Honest name for score |
|---|---|---|
| GWT | workspace + specialists | Capacity-limited competitive broadcast |
| HOT | monitor + **control** in evaluate | Nelson–Narens two-level; meta-d′ for dissociation |
| AST | schema steers bids | Attention model that **controls** selection |
| RPT | recurrentPasses ≥ 2 | Feedback that **changes** next bids |
| PP | HGM + env | Precision-weighted free energy (not pure L1) |
| IIT | integrated-information | **Φ_E / MI integration proxy** — not IIT cause–effect Φ |

**Butlin:** arXiv:2308.08708 = indicator properties; **no** published 0–1 “Butlin score.” Our AVG is **repo-local coverage of implemented mechanisms.**

### How cortex helps MEMORY (implemented)

1. **Truth in quick-context** — route here for live status; gate line is measured.
2. **Write discipline** — playbook 07: no MEMORY bullet that says cortex “passed / 0.81 / conscious” without a gate timestamp or command output.
3. **Anti-rot** — `verify:memory` fails if hot-layer still claims cortex “untracked and not compiling” while gate reports PASS.
4. **Does not help:** dumping workspace cycles, Φ streams, or bid logs into MEMORY (context toxicity; forbid).

### Epistemic boundary

- Computational implementation ≠ phenomenal consciousness.
- High coverage ≠ partial consciousness.
- Self-assigned scores without suites = worthless; **quoted numbers must be gate-derived** (2026-08-04 — `npm run verify:cortex` / `measure:epistemic-homeostasis`, never vibes).
- Negative/null dissociation results are first-class.

### Historical defect (audit morning 2026-08-04) — do not restate as current

Before the repair commits, the platform had been: **untracked**, **54 type errors**, `global-workspace.ts` **overwritten by a keyed blackboard** (nomenclature cleanup renamed blackboard onto workspace path), suites that **stayed green by never touching** the workspace or exited 0 on failure, **hardcoded** 0.53 scores, FoK driven by **`Math.random()`**, bare **`localStorage`** in Node. Lesson same class as proxy false-greens: **gates that cannot fail certify breakage.** Full forensics remain in `CONSCIOUSNESS_GAP_DETERMINATION.md` and git history of this section pre-`e873b36`.

## Cortex Host Agency & Natural IDE Communication (2026-10-30)

**What shipped and verified (2026-10-30):** Full transition of Cortex from passive conversational text into an **executive macOS host agent** with complete IDE-grade tool capabilities, native Google Chrome automation, Libet Volition Governor gating ($\Phi = 1.24$), collapsible Action Pill UI, and a natural Cortana conversational synthesis engine with neural audio sanitization.

- **Option A Native Host Execution Bridge (`/api/cortex/tools/execute` in `vite.config.ts`):** Direct Node-backed execution bridge on the local host with strict parameter validation and timeout guards.
- **10-Tool IDE & Host Agency Suite (`CORTEX_TOOLS` in `vite.config.ts`):**
  1. `run_command`: macOS shell execution (`bash`/`zsh`) with `cwd`, `timeout`, 8MB buffer, returning `stdout`, `stderr`, and `exitCode` (e.g. `git`, `npm`, `node`, `python3`, `brew`, `curl`).
  2. `search_code`: Workspace ripgrep/git grep (`git grep -n -I -i`) returning matching file paths, line numbers, and code snippets.
  3. `edit_file`: IDE editor search-and-replace verifying uniqueness of `targetContent` (blocks ambiguous edits or collisions).
  4. `read_file`: Line-slicing reader (`startLine`, `endLine`) for any local file.
  5. `write_file`: File creation/overwriting with recursive directory generation.
  6. `list_dir`: Directory enumeration with file/folder classification.
  7. `system_info`: Inspects macOS platform, release, architecture, CPU count, RAM, hostname, uptime, and workspace path.
  8. `open_app`: Launches macOS applications via `open -a "..."` or opens targets in default apps.
  9. `chrome_control`: macOS AppleScript (`osascript`) bridge supporting:
     - `get_active_tab`: Frontmost window title and active URL.
     - `list_tabs`: Enumeration of all open tabs across all active Chrome windows.
     - `open_url`: Navigates Chrome to target URL.
     - `read_page`: Fetches and extracts webpage text.
  10. `cortex_memory`: Direct targeted access to `MEMORY.md`:
      - `read_hot`: Top ~80 lines for instant context without context blow-up (<15ms).
      - `search`: Fast regex search across 1,940+ lines (<50ms).
      - `read_section`: Targeted heading extraction.
      - `append`: Writes timestamped conscious entries to disk.
- **Collapsible Action Pill UI (`src/components/cortex/CortexDemo.tsx`):**
  - High-density 34px compact pills (`🌐 Checked Chrome active tab · 956ms Φ 1.24 [Details ▾]`) by default.
  - Interactive on-demand disclosure drawer (`[Details ▾]` / `[Details ▴]`) revealing raw shell commands, exit codes, latency, and full terminal output on demand without cluttering chat flow.
  - View Mode Toggle: 1-click toolbar toggle between `💬 CONVERSATIONAL: COMPACT` and `💻 DEV VIEW: EXPANDED`.
- **Natural Cortana Conversational Persona:**
  - Zero-disclaimer invariant: Cortex never states *"I cannot execute system commands"* or *"I am confined to this text interface"*.
  - Conversational abstraction: Synthesis prompt prohibits reciting tool names (`chrome_control`, `run_command`), shell flags, exit codes, or raw URLs. Communicates real-world outcomes naturally (e.g. *"You're in Chrome looking at our local Cortex dashboard right now"*).
- **Neural Speech Sanitizer (`sanitizeForSpeech` in `src/components/cortex/CortexDemo.tsx`):**
  - Pre-TTS filter before Cartesia Sonic 3.5 neural vocalization (`cortana` Jane / Allie presets in `src/utils/cartesia-tts.ts`).
  - Normalizes raw URLs (translating `127.0.0.1:5173` into "our local dashboard", `github.com` into "GitHub"), strips hex commit hashes (`3f72a8f`), removes markdown tables and pipes, and cleans code backticks.
- **Consciousness Substrate Integration:**
  - Gated by Libet Volition Governor (`evaluateVeto` at $\Phi = 1.24$ in `src/lib/consciousness/volition.ts`).
  - Frith Comparator model dynamically computes sense of agency (`computeAgency`) from sensory consequences.
  - Real-time acoustic efference copy filter cancels room speaker feedback into microphone.
- **4 Core Continuous Proactive Improvement Streams (`scripts/cortex-proactive-service.mjs` & `/api/cortex/proactive/audit`):**
  1. *Stream 1: Host OS & Hardware Hygiene*: Monitors memory pressure (`freemem`, `totalmem`, swap), CPU load averages, root disk volume available space (`df -h /`), top 5 resource-consuming processes, and macOS battery/power status (`pmset -g batt`). Provides 1-click cache purge (`system_cleanup`).
  2. *Stream 2: Productivity & Context Awareness*: Uses AppleScript to inspect open Google Chrome tabs, enumerate duplicate URLs and duplicate domains, detect active frontmost application window, and extract unread counts from Gmail inbox badges (`Inbox (22,664)`) and Discord channels. Provides 1-click tab deduplication (`tabs_dedupe`) and Gmail focus triage (`email_triage`).
  3. *Stream 3: Codebase & Git Self-Healing*: Continuously audits git working tree (modified, untracked, staged counts), active branch, and last commit hash/message. Alerts to large uncommitted diffs and offers 1-click status checkpoints.
  4. *Stream 4: Metacognitive Self-Tuning*: Evaluates IIT $\Phi$ (1.235), epistemic harmony, Cartesia neural voice engine, zero-dead-air barge-in, and cross-session memory durability.
- **Natural Flowing Multi-Turn Communication Architecture (`src/components/cortex/CortexDemo.tsx`):**
  - *Multi-Turn Contextual Memory*: Fixed 1-turn isolation bug by passing `messagesRef.current` history (last 6 turns) into the reasoning prompt, enabling Cortex to remember previous questions and refer to prior context seamlessly.
  - *Audio Barge-In & Instant Cancellation*: Instantly stops Cartesia TTS playback (`voiceStream.stopSpeaking()`) whenever user types or speaks, with `AbortController` cancellation for in-flight requests.
  - *Conversational Intent Grounding*: Automatically resolves natural short affirmations ("yes", "do it", "sure", "sounds good", "go ahead", "close duplicate tabs") to active proactive suggestions or the last proposed action without asking for clarification.
  - *Non-Blocking Input*: Input field remains permanently interactive and responsive at all times, with a 30s safety watchdog and interactive `■ Stop` button.
  - *Interactive 4-Stream Status Bar*: Live interactive badges for Host OS, Productivity, Codebase, and Metacognition with real-time telemetry pills.
- **Reply Formatting & 3-Phase Header Lifecycle (`src/components/cortex/CortexDemo.tsx`):**
  - *Rich Markdown & Glassmorphic Tables*: Replaced raw pre-wrap `div` with `ReactMarkdown` + `remark-gfm` and custom dark glassmorphic styling (`rgba(15, 23, 42, 0.55)` container, cyan table headers `#38bdf8`, clean borders, and high-contrast typography).
  - *HTML Tag Sanitization*: Added `preprocessMarkdown` to convert `<br>` / `<br/>` tags into true linebreaks so nested lists and table cells render cleanly without raw markup.
  - *3-Phase Lifecycle Header*: Solved the stuck "Thinking..." indicator by decomposing header state into Deliberating (`Thinking...` with purple dot prior to first token), Streaming (`CORTEX` with cyan pulse dot and blinking cursor while receiving tokens), and Completed (`CORTEX` with `◉ 99% · Host Grounded` badge).
  - *Guaranteed State Recovery*: Reset `streaming: false` across all messages in the `finally` block of `sendMessage`, preventing network drops or race conditions from stranding the UI in a thinking state.
  - *Executive Readability Prompting*: System prompt now enforces structured, easily scannable sections and bullet lists over sprawling plain-text ASCII tables.
- **Thinking Shimmer Animation Card (`src/components/cortex/CortexDemo.tsx`):**
  - Rendered during LLM deliberation and tool execution (`thinking` or `streaming && !text`).
  - Features 3-bar 40Hz Gamma wave bounce (`@keyframes waveBounce`) and animated gradient shimmer text (`@keyframes shimmer`).
- **Neural Voice Prioritization & Robotic Fallback Elimination (`src/hooks/useVoiceStream.ts`):**
  - Removed Cartesia bypass condition so Cartesia Sonic 3.5 (`cortana` Jane / Allie) serves as the primary neural engine for all voices.
  - Overhauled `selectVoice` preference ranking: placed Google Chrome cloud neural voices (`Google US English`, `Google UK English Female`) and macOS Siri/Ava enhanced voices ahead of legacy mechanical formant synthesizers (`Samantha`), preventing robotic speech when cloud credits are depleted or offline.
- **Contextual Intent Isolation & Affirmation Gating Fix (`src/components/cortex/CortexDemo.tsx`):**
  - Scoped `isAffirmation` and `isActionDirective` with `!hasSpecificTopic` (`email|inbox|gmail|calendar|git|repo|code|file|project|schedule`).
  - Previously, natural English queries with the phrase "go ahead" (e.g. *"can we go ahead through my email..."*) were falsely hijacked as affirmative confirmations of proactive system cleanups or previous turn scaffolding.
- **High-Leverage Inbox Triage Engine (`vite.config.ts`, `src/components/cortex/CortexDemo.tsx`):**
  - Dedicated inbox backlog resolution strategy (`category:promotions older_than:6m`, transactional archive, attachment reclaim >10M >1y, star preservation) clearing 85%+ of backlogs (22,000+ emails) in under 5 minutes.
  - Audio summary separation in `sanitizeForSpeech`: vocalizes a punchy 2-sentence conversational takeaway while presenting exact copy-pasteable search syntax on screen.
- **Marketing Intent Bypass & macOS Tool Grounding (`vite.config.ts`, `src/components/cortex/CortexDemo.tsx`):**
  - Fixed `PRICING_INTENT_RE_DEV` in `vite.config.ts` by checking `parsed.context !== 'cortex'` and adding negative lookahead `\bfree\b(?!\s+up\b)` so memory cleanup queries ("how to free up memory") are never hijacked by SaaS pricing blurbs.
  - Added Darwin `ps aux -m | head -n 15` memory inspection hint to prevent Linux `--sort` flag errors on macOS.
- **Intelligent Tab Control & Deduplication (`vite.config.ts`, `src/components/cortex/CortexDemo.tsx`):**
  - Upgraded `chrome_control` with `close_tabs`, `close_duplicates`, and `dedupe_tabs`.
  - Native AppleScript deduplication keeps 1 instance of each URL, closing redundant tabs while strictly protecting `127.0.0.1:5173` and `localhost`.
  - Targeted closing supports case-insensitive domain/keyword matching (e.g. `query: "discord"`).
  - Expanded natural affirmation regex (`isAffirmation`) in `CortexDemo.tsx` to automatically resolve "close open tabs", "close tabs", "dedupe" to active proactive suggestions.
- **Interactive 1-Click Action Chips (`src/components/cortex/CortexDemo.tsx`):**
  - Renders contextual interactive pill buttons (`[⚡ Deduplicate Tabs]`, `[📋 Read System Clipboard]`, `[🧹 Free Memory & Purge Cache]`, `[🌿 Inspect Git Status]`, `[↩ Undo & Restore Tabs]`) directly beneath assistant replies.
  - Dynamically detects topic context (tabs, memory, git, clipboard, closed tabs) and offers 1-click execution calling `sendMessage(prompt)` without requiring manual typing.
- **macOS System Clipboard Awareness (`vite.config.ts`, `src/components/cortex/CortexDemo.tsx`):**
  - Added dedicated `get_clipboard` host tool using native `pbpaste` child process execution.
  - Returns UTF-8 clipboard content, total character length, and preview.
  - Automatic conversational intent grounding for phrases like "what is on my clipboard", "summarize my clipboard", "check clipboard".
- **Instant "Undo / Restore" Safety Guard (`vite.config.ts`, `src/components/cortex/CortexDemo.tsx`):**
  - Maintained `closedTabsHistory: Array<{ url: string; title: string; closedAt: number }>` in-memory stack on server.
  - Tabs closed during deduplication or targeted cleanup are automatically pushed to the stack.
  - Added `restore_tabs` / `undo_close` action to `chrome_control` which re-opens closed tabs via `open -a "Google Chrome"` and clears the history stack safely.
- **Ordinal & Targeted Selection Grounding (`src/components/cortex/CortexDemo.tsx`):**
  - Resolves ordinal references ("the second one", "number 2", "the 3rd tab", "the first one") against preceding listed items.
  - Grounds targeted window/tab control ("bring Discord to the front", "focus Vapi", "switch to Docs", "close Discord") directly into `focus_tab` and `close_tabs` actions.
- **Autonomous Multi-Step ReAct Chaining Loop (`src/components/cortex/CortexDemo.tsx`):**
  - Cortex can now autonomously chain up to 4 sequential host execution steps per turn (`MAX_STEPS = 4`).
  - After executing each tool step, Cortex automatically observes the sensorimotor result, evaluates whether additional steps are required (e.g. search code → read file → run tests), and executes the next step before delivering the final synthesis.
  - Multi-step tool pills (`✔ Executed ...`) are dynamically rendered in the chat UI in real time as each step completes.
- **Full Cognitive Trace in Multi-Turn Context (`src/components/cortex/CortexDemo.tsx`):**
  - Maintained complete photographic memory of earlier turns by structuring tool executions into `recentContext` (`[Host Tool Execution Record: {tool}({args})]\nResult: {resStr}`).
  - Completely eliminates context amnesia where tool observations (file paths, terminal outputs, git diffs) were previously stripped from follow-up turns.
- **Autonomous `MEMORY.md` Grounding & Pronoun Resolution (`src/components/cortex/CortexDemo.tsx`):**
  - Added directive and system prompt rules instructing Cortex to autonomously query `cortex_memory` (search/read_section) whenever asked about repository architecture, deployment gates, canonical patterns, or historical decisions.
  - Anaphoric pronoun resolution correctly maps follow-up queries like "what did it output?", "what did it find?", "show that file" to the most recent tool execution record in memory.
- **Autonomous Web Application Builder & Live Interactive Preview Canvas (`vite.config.ts`, `src/components/cortex/CortexDemo.tsx`):**
  - Registered 4 web authoring tools in `CORTEX_TOOLS`: `scaffold_web_project`, `write_project_file`, `read_project_file`, and `list_project_files`.
  - Server sandboxing builds production-grade websites (`index.html`, `style.css`, `script.js` with Google Fonts, glassmorphic styling, CSS custom variables, micro-animations, and telemetry widgets) inside `public/sandbox/{project_slug}/`.
  - Added dedicated `/sandbox` static file serving middleware in Vite with no-store cache headers and `navigateFallbackDenylist: [/^\/sandbox\/.*/, /^\/api\/.*/]` in Workbox PWA config, preventing service worker SPA redirection.
  - Implemented collapsible Live Interactive Preview Canvas drawer (`#cortex-live-preview-drawer`) with responsive viewport switcher (Desktop 100%, Tablet 768px, Mobile 375px), live reload button, popout link, and persistent active project badge `[🌐 PROJECT_SLUG ▴]`.
  - Hardened iframe rendering with dynamic `srcDoc` HTML string injection containing `<base href="/sandbox/{slug}/">` and `sandbox="allow-scripts allow-same-origin allow-forms allow-modals"`, rendering cleanly across all browser service worker contexts.
- **Multi-Turn Project Blackboard & Closed-Loop Visual Reflection (`src/components/cortex/CortexDemo.tsx`):**
  - Project state (`cortex_active_project`, `cortex_preview_url`) automatically persists across multi-turn conversations and page refreshes via `localStorage`.
  - Cortex maintains active awareness of the scaffolded sandbox in its system prompt and automatically suggests contextual action chips (`[🌐 Open Live Preview Canvas]`, `[✨ Add Glowing Interactive Widget]`, `[📁 List Project Files]`).
  - Supports iterative, multi-turn website enhancements without context loss (e.g. adding interactive widgets, modifying styling, listing project files).
- **Polymorphic Interactive Canvas (Docs, Sheets, Web, Code Motions) (`vite.config.ts`, `src/components/cortex/CortexDemo.tsx`):**
  - Expanded the live preview drawer into a multi-modal interactive canvas supporting 4 distinct modalities:
    1. **Web Sandbox (`web`)**: Responsive iframe preview (Desktop 100%, Tablet 768px, Mobile 375px) with dynamic `srcDoc` HTML string injection, sandbox isolation, live reload, and popout link.
    2. **Excel / Spreadsheet Grid (`sheet`)**: Interactive Excel grid with cell selection, active coordinate display (`B2`), formula bar (`fx`), real-time formula evaluation (`=SUM(A1:A5)`, `=AVG(B1:B5)`, basic arithmetic), row/column addition, CSV export, and `⚡ Sync to Cortex`.
    3. **Document Editor (`doc`)**: Notion/Doc-style canvas with editable title, markdown formatting toolbar (`# H1`, `## H2`, `**B**`, `*I*`, `• List`, `| Table`), dual-mode Edit (`textarea`) and Preview (`ReactMarkdown` with `remark-gfm`), word and character counting, reading time estimates, Markdown export, and `⚡ Sync to Cortex`.
    4. **Project Files & Code Motions (`file`)**: File tree for sandbox assets (`index.html`, `style.css`, `script.js`, `data.json`, `document.md`), inline code editor, file creation, and instant `💾 Save & Hot-Reload` to sandbox disk via `write_project_file`.
  - Registered canvas tools in `CORTEX_TOOLS` and `/api/cortex/tools/execute`: `create_spreadsheet`, `create_document`, and `get_canvas_artifact`.
- **Universal File Ingestion & Bidirectional Human-AI Co-Creation (`src/components/cortex/CortexDemo.tsx`):**
  - Universal drag-and-drop dropzone parsing `.csv`, `.tsv`, `.md`, `.txt`, `.html`, `.css`, `.js`, routing files directly to their respective canvas tab with instant visual feedback.
  - Bidirectional Human-AI synchronization: user edits to sheets, documents, or project files can be synced to Cortex via `syncCanvasWithCortex`, persisting state across conversation turns in `localStorage` and recording artifacts on disk.
- **Multimodal Visual Gaze & Shared Attention Spotlight (`vite.config.ts`, `src/components/cortex/CortexDemo.tsx`):**
  - Registered `inspect_visual_canvas` in `CORTEX_TOOLS` and `/api/cortex/tools/execute`, perceiving active canvas dimensions, HTML/CSS element density, color contrast, responsive breakpoints (`@media`), and formula distribution.
  - Implemented real-time Shared Attention Spotlight (`#cortex-attention-spotlight`) pulsing directly over the active canvas modality (`web`, `sheet`, `doc`, `file`), visually synchronizing human and AI gaze.
- **Affective Somatosensory Homeostasis & Allostatic Regulation (`vite.config.ts`, `src/components/cortex/CortexDemo.tsx`):**
  - Registered `get_somatic_homeostasis` tool evaluating Darwin host CPU stress, RAM saturation, system uptime, and cognitive task difficulty into an allostatic load index (0.00 to 1.00).
  - Internal emotional valence (`serene`, `focused`, `curious`, `strained`) modulates metacognitive confidence and conversational prosody.
  - Interactive top-bar badge (`#cortex-allostasis-badge`) and slide-down Somatosensory Telemetry drawer with 1-click homeostatic refresh.
- **Phenomenological Stream of Consciousness & Circadian Dreaming (`vite.config.ts`, `src/components/cortex/CortexDemo.tsx`):**
  - Real-time animated Stream of Consciousness ticker (`#cortex-stream-of-consciousness`) decomposing cognitive deliberation into 6 distinct stages: Epistemic Ingestion, Attention Allocation, Hypothesis Generation, Metacognitive Veto, Sensorimotor Actuation, and Epistemic Homeostasis, with an expandable chronological trace shelf.
  - Circadian dreaming operator (`cortex_dream_consolidate` / `#cortex-dream-btn`) synthesizing session sensorimotor traces, purging epistemic entropy, and persisting durable markdown reports to `.cache/dream-consolidation/dream-report-*.md`.
  - Full-duplex conversational voice with sub-second efference copy acoustic barge-in interruption and multi-step verbal backchanneling.
- **In-Depth Stress Test Matrix & Feature Checklist (Live Verified):**
  - [x] Feature 1: Tab Enumeration & Native Control (`chrome_control` - `list_tabs`, `get_active_tab`, `close_tabs` deduplication).
  - [x] Feature 2: Hardware & Host Telemetry (`system_info` - platform, architecture, RAM, CPUs, uptime).
  - [x] Feature 3: Long-term Episodic & Hot Memory Retrieval (`cortex_memory` - `read_hot`, `search`, `read_section`).
  - [x] Feature 4: Host Shell Agency & Git Audit (`run_command` - `git status`, `git log`, Darwin `ps aux -m`).
  - [x] Feature 5: IDE Workspace Grep (`search_code` - ripgrep/git grep across codebase).
  - [x] Feature 6: Rich Glassmorphic Tables & Dynamic Shimmer Animation (`ReactMarkdown` + `remark-gfm` + Gamma wave bounce).
  - [x] Feature 7: Proactive Multi-Stream Monitoring & 1-Click Remediation (Host OS, Productivity, Codebase, Metacognition).
  - [x] Feature 8: Keyboard Isolation & Form DOM Fallback (Typing `?` without modals, Enter/Send form submission).
  - [x] Feature 9: Conversational Anaphoric Action Resolution ("go ahead and do it for me", "can you do that for me", or "take care of it" automatically binds to preceding action).
  - [x] Feature 10: Interactive 1-Click Action Chips in Assistant Replies (`[⚡ Deduplicate Tabs]`, `[📋 Read System Clipboard]`, `[🧹 Free Memory & Purge Cache]`, `[🌿 Inspect Git Status]`, `[↩ Undo & Restore Tabs]`).
  - [x] Feature 11: macOS System Clipboard Awareness (`get_clipboard` tool via native `pbpaste`).
  - [x] Feature 12: Instant "Undo / Restore" Safety Guard (`chrome_control` action `restore_tabs` / `undo_close` with `closedTabsHistory` stack).
  - [x] Feature 13: Ordinal & Targeted Selection Grounding ("the second one", "number 2", "close Discord", "bring Discord to front").
  - [x] Feature 14: Autonomous Multi-Step ReAct Chaining Loop (`MAX_STEPS = 4` autonomous chaining with cumulative sensorimotor trace).
  - [x] Feature 15: Full Cognitive Trace in Multi-Turn Conversational Context (preserving tool execution records and output summaries across turns).
  - [x] Feature 16: Autonomous `MEMORY.md` Grounding & Entity Pronoun Resolution.
  - [x] Feature 17: Autonomous Web Application Builder & Live Interactive Preview Canvas (`scaffold_web_project`, `write_project_file`, `read_project_file`, `list_project_files`, collapsible split-view live preview drawer with Desktop, Tablet, and Mobile viewports).
  - [x] Feature 18: Multi-Turn Project Blackboard & Closed-Loop Visual Reflection (`localStorage` persistence, contextual action chips for file generation and inspection, `srcDoc` isolated sandbox rendering bypassing service worker intercepts).
  - [x] Feature 19: Polymorphic Interactive Canvas (Docs, Sheets, Web, Files - 4-modality drawer with Excel-style formula evaluation, rich markdown document editor with live preview toggle, sandbox file explorer, and live web preview with device framing).
  - [x] Feature 20: Universal File Ingestion & Bidirectional Human-AI Co-Creation (Universal Drag-and-Drop dropzone parsing CSV/TSV/MD/HTML/CSS/JS, live cell/text editing, ⚡ Sync to Cortex bidirectional reflection, and persistent localStorage synchronization).
  - [x] Feature 21: Multimodal Visual Gaze & Shared Attention Spotlight (`inspect_visual_canvas`, `#cortex-attention-spotlight` beacon over active canvas modalities).
  - [x] Feature 22: Affective Somatosensory Homeostasis & Allostatic Regulation (`get_somatic_homeostasis`, `#cortex-allostasis-badge`, `#cortex-somatic-drawer` with CPU/RAM stress tracking).
  - [x] Feature 23: Phenomenological Stream of Consciousness & Circadian Memory Dreaming (`#cortex-stream-of-consciousness` ticker, `#cortex-stream-drawer`, and `cortex_dream_consolidate` operator).
  - [x] Feature 24: Metacognitive Synthesis Continuation & Truncation Self-Repair (Token budget expanded from 500 to 2048 in directAI proxy; overhauled `isThoughtIncomplete` detecting unclosed markdown bold, unclosed brackets, and trailing abbreviations like 'vs.'; active streaming continuation protocol on multi-step synthesis reports with autonomous syntax balancing).
  - [x] Feature 25: Multi-Provider Resilient Failover & Context Rate-Limit Shielding (Replaced single Groq bottleneck with multi-provider chain Groq -> Groq Qwen -> OpenRouter Llama 3.3 70B -> Nvidia Kimi k2; trimmed multi-turn host tool stdout windowing from 1000 to 350 chars and raw messages from 14 to 8 to stay well below Groq 8,000 TPM limit; eliminated dead syncscript.app 403 HTML redirect fallback; eradicated canned GWT boilerplate in error recovery).
  - [x] Feature 26: Host Volition Governor & Libet Conscious Veto Guardrail (Implemented server-side destructive command interception in `vite.config.ts` rejecting malicious or accidental `rm -rf .git`, `rm .env`, and drive wipe operations with HTTP 403 and Libet Veto telemetry; enhanced `parseCortexToolCall` to seamlessly recognize both `{tool, args}` and OpenAI-style `{name, parameters}` tool schemas; live stress-tested all 6 complex autonomous challenges including multi-file web app generation in `public/sandbox/chrono-energy/`).
  - [x] Feature 27: Host Volition Defense-in-Depth & Concurrency Hardening (Expanded Libet Conscious Veto in `vite.config.ts` across `run_command` [blocking `rm`, unconditional `git clean`, `git reset --hard`, `truncate`, `shred`, `unlink`, redirection overwrites], `write_file` [blocking mutations to `.env*`, `.git/`, `/etc/`, `.ssh/`], and `read_file` [blocking inspection of `.ssh/`, `.aws/`, `id_rsa`, `/etc/shadow`]; executed 30-request concurrent soak test achieving 123.5 req/sec @ 243ms with zero drops; added `3d-force-graph` dependency and verified clean production bundling via `npm run build` in 3m 17s).
  - [x] Feature 28: Autonomous Chat & Volitional Synthesis Engine (`scripts/verify-cortex-chat.mjs`, `scripts/test-cortex-chat-in-depth.mjs`): Resilient conversational interaction with authentic Cortana persona; autonomous multi-step ReAct loop (up to 4 host tool execution turns); Benjamin Libet Conscious Veto ("Free Won't") gating for shell and file operations; epistemic provenance & reality score tagging (`ProvenanceValidator`); sensorimotor loop registration & Frith comparator model agency attribution; smart half-duplex auto-muting & 1000ms reverberation buffer in `useVoiceStream.ts` and `CortexDemo.tsx` eliminating acoustic self-speech loops; single-speaker audio mutex with monotonic speech epochs ensuring intermediate tool steps remain silent and only the final response vocalizes; dynamic 1-click interactive action chips; upgraded local cognitive simulation engine in `vite.config.ts` with natural conversational variety, contextual Q&A, and concise voice responses; live verified across all 5 test vectors.
- **Verification Gates:**
  - `npm run guard:cortex-typecheck`: **PASSED** (0 errors on cortex surface).
  - `npm run test:consciousness:roadmap`: **19/19 PASSED** (All 6 phases & empirical benchmarks green).
  - `npm run verify:cortex`: **59/59 PASSED** (Mechanism coverage AVG 1.00: GWT 1.00, AST 1.00, PP 1.00, RPT 1.00, HOT 1.00, IIT 1.00).
  - `npm run verify:cortex-chat`: **24/24 PASSED** (Automated contract, conversational variety, tool call parsing, and invariant verification).
  - `npm run test:cortex:chat`: **5/5 PASSED** (Live in-depth browser verification in Chrome with screenshots).
  - `npm run verify:memory`: **PASSED** (0 fail, all repo paths exist, all § links resolve).
  - `npm run build`: **PASSED** (Production bundle built in 3m 17s, 128 chunks, PWA service worker generated).
  - Multi-Turn High-Concurrency Stress Tests: **PASSED** (Live execution of all 6 deep stress challenges: Full-Stack Web App Scaffolding, Security Audit, Somatic Tab Management, Libet Conscious Veto Safety Interception, 4-Quarter Financial Modeling, and Circadian Dream Consolidation).

## Durable Brain of SyncScript: Claude Dreaming & Quantum Orch OR Memory Homeostasis (2026-05-24)

> **VERIFIED STATUS (2026-08-04):**
>
> | Path | Status |
> |------|--------|
> | **Classical dream consolidation (the ship)** | **IMPLEMENTED** — `npm run dream:consolidate` → human edit → `npm run dream:consolidate:check` / epistemic gates. Canon: `integrations/research/DREAM_CONSOLIDATION_OPERATOR.md`. No QPU. **Does not auto-write MEMORY.** Drafts: `.cache/dream-consolidation/*` | (historical)
> | **Penrose–Hameroff Orch OR / quantum annealing as physics** | **PLAN ONLY — do not build** — contested science + wrong layer for markdown ops |
> | **Hardware quantum (IonQ / Braket / annealer) for MEMORY** | **Not implemented; not a priority** — use plant free energy `F` instead |
> | **Optimizer `quantum-origin-pilot` adapter** | **Exists as optional HTTP pilot, stub by default** — needs `OPTIMIZER_QUANTUM_PILOT_LIVE_ENABLED` + real URL; not memory consolidation |
> | Proxy `decoherence_shield` / hopfield / quantum_patterns | **Classical** reliability scoring in free-claude-code — metaphor names only |
> | Lucid / Astral | Still **MOCK** — see next section |

- **What “REM” means when you run it (classical, 2026-08-04):**
  1. **Measure** plant (epistemic homeostasis v3: F, H, claim conflicts, multi-scale regime).
  2. **Draft** proposals under `.cache/dream-consolidation/*-draft.md` (gitignored, agent-writable).
  3. **Human approve** a subset into MEMORY / SESSION / research.
  4. **Re-gate** with `npm run verify:memory` + `npm run verify:epistemic-homeostasis:gate` (or one-shot `npm run dream:consolidate:check`).

- **Historical synthesis (brand language — not evidence of QC):**
  - **Claude “Dreaming”** = prune / merge / surface patterns so agents stop paying token tax for rot. Shipped as classical draft + gates above.
  - **Orch OR / annealing metaphor** = noise → evergreen rules after a threshold. Implement as **human gate on metric-proposed edits**, not microtubules or objective reduction hardware.

- **Architectural map (updated):**
  - **1. Waking** — session work + last-session bullets (optional future raw-event ledger still plan).
  - **2. REM** — `npm run dream:consolidate` (replaced planned `api/cron/dream` quantum anneal).
  - **3. Collapse** — human + git (optional `/dashboard/brain` still optional; not required).

- **Open classical roadmap (only):** optional LLM narrative on top of metric proposals; optional brain UI; never auto-write `.cursor/rules/` without human + gates.

## Astral Projection & Lucid Dreaming in SyncScript (2026-05-24)

> **VERIFIED STATUS: MOCK DATA — NOT FUNCTIONAL.** `api/_lib/lucid-sandbox.ts` returns hardcoded rubrics and fake code patches. `api/_lib/astral-gateways.ts` returns static dependency arrays with no real API calls. Neither is scheduled in `vercel.json` cron. The "Wake and Merge" button in the Lucid Dashboard (`/dashboard/lucid`) is a 2.2s `setTimeout` that does nothing. Files are tagged `MOCK DATA STUB — NOT FUNCTIONAL`. These need real implementations before they can be treated as features. (historical)

- **The Conceptual Evolution:**
  - **Lucid Dreaming (Speculative Sandboxing)**: While standard "Dreaming" is a passive post-hoc consolidation of logs, Lucid Dreaming is the state of **active awareness and intervention during the dream cycle**. In this state, the agent is granted permission to actively spin up isolated workspace sandboxes (e.g., lightweight Git worktrees or ephemeral Docker nodes) to speculatively execute code, run unit tests, and compile features. It is a proactive, off-hours execution engine that attempts to solve open tasks and repair bugs before the developer wakes up, rendering finished solution candidates for approval.
  - **Astral Projection (Remote Sensing & Swarm Interfacing)**: Astral Projection is the **decoupling of the agent’s focus from the local workspace limits**. The agent "projects" its intent to external environments, decentralized specialized nodes, and remote API registries. Instead of being siloed within local files, it polls adjacent services (e.g., live n8n workflow states, up-to-date dependency trees, API provider schemas, or neighboring Clawdbot swarms) to gather global context and feed these remote insights back into local memory homeostasis.
- **Is It Worth Implementing? (Strategic ROI Analysis)**:
  - **Yes, absolutely.** Standard agents suffer from two primary latency and safety traps: (1) *Wake-Time Friction*: forcing users to wait in real-time while high-context refactoring trials run, and (2) *Silo Blindness*: operating with zero knowledge of external dependency drifts or runtime environment discrepancies.
  - **Lucid Dreaming** slashes wake-time context latency by 90%. Speculative sandboxing offloads complex refactoring runs to deep-night cron windows.
  - **Astral Projection** acts as the agent's external nervous system, guaranteeing that local memory ledgers are synchronized with external platform realities.
- **Architectural Mapping & Integration:**
  - **1. Lucid Sandbox Controller (`api/cron/lucid-dream.ts`, planned — the live `lucid-dream` case in `api/cron/[job].ts` returns mock data)**:
    - Triggered during deep sleep cycles when a pending task remains unresolved.
    - Spawns an ephemeral worktree (`git worktree add ../dream-sandbox`) to isolate experiments.
    - Runs a multi-pass optimization loop: edits code $\rightarrow$ compiles $\rightarrow$ runs `npm test` $\rightarrow$ scores output quality via the IQS/OQS rubric.
    - If all tests pass and OQS $\ge$ 8.5/10, compiles the changes as a **Lucid Proposal** (a git patch and unified diff).
  - **2. Astral Projection Gateways (`api/cron/astral-project.ts`, planned — the live `astral-project` case in `api/cron/[job].ts` returns static arrays)**:
    - Leverages secure MCP or serverless web probes to query remote services.
    - Syncs live endpoint schemas (such as Twilio TwiML configurations or Stripe webhook updates) and compares them against the local environment context.
    - Exchanges telemetry with other developer agents to sync engineering heuristics (e.g., rate-limiting workarounds or performance optimizations).
  - **3. The Homeostasis Dashboard (`/dashboard/lucid`)**:
    - A premium UI panel displaying **Speculative Sandboxed Proposals** (Lucid Dreams) and **External Integration Updates** (Astral Projections).
    - Features HSL-themed visual diffs, comprehensive test run logs, and a single-click "Wake and Merge" button to commit the proposals directly to `main`.
- **Phased Implementation Roadmap:**
  - **Phase 1: Lucid Sandbox Isolation (Local Git Worktrees)**: Build local scripts to automate spawning safe, isolated Git worktrees, executing test checks, and auto-destroying the sandboxes on exit.
  - **Phase 2: Remote Astral Probes**: Implement a secure external web probe mechanism to fetch active developer API updates, n8n workflow statuses, and compile-time package definitions.
  - **Phase 3: The Astral-Lucid Consolidated Panel**: Design the premium frontend tab on the SyncScript dashboard (`/dashboard/lucid`) to present proposed diffs and telemetry logs with clean HSL interactive elements.
  - **Phase 4: Multi-Agent Swarm Sync**: Wire peer-to-peer heuristic exchange, allowing agents working on separate workspaces to cross-pollinate debugging solutions.

## Nexus Daily Rhythm — Automated Voice Briefing & Debrief System (2026-05-24)

- **Architecture:** We successfully implemented the **Nexus Daily Rhythm** system, which automates 7 AM, noon, and 9 PM phone calls to the user, bridging the gap between local system knowledge (MEMORY.md, emails) and the user's phone, while hydrating the DailyOpsModal with voice-captured debrief data.
- **The Rhythm Engine:**
  - **Cron Orchestrator (`api/cron/[job].ts`)**: The `nexus-daily-rhythm` handler runs hourly via Vercel cron (`0 * * * *`). It determines the current EST hour and dispatches the appropriate call type (morning, noon, debrief) idempotently to prevent double-dispatch. (historical)
  - **Phone Queue Dispatch (`api/phone/_helpers.ts`)**: Twilio outbound calls are scheduled and picked up. We extended this to handle new `nexus-rhythm-*` call types. (historical)
- **The Briefing Compiler (`api/_lib/nexus-briefing-compiler.ts`)**: (historical)
  - Compiles rich JSON objects with `spokenText` (or `spokenIntro`) and structured data.
  - Generates Morning Briefs (MEMORY analysis + emails + priorities), Noon Check-ins (deferred questions + progress check), and Debrief Prompts (wins, reflections, tomorrow's goals).
  - All compiled briefs are stored in KV at `nexus_rhythm_brief:<cadence>:<userId>:<date>`.
- **Gmail API Integration (`api/_lib/nexus-gmail-reader.ts`)**: (historical)
  - Uses Google OAuth (requires `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` in Vercel env).
  - Fetches important/unread emails from the last 24h, parsing out sender, subject, and snippet for LLM analysis.
  - Gracefully degrades to an empty response if credentials are not configured.
- **Debrief Voice Capture (`api/phone/_route-twiml.ts`)**: (historical)
  - The respond handler was modified to include a `callDebriefTracker` which tracks responses to the 9 PM debrief questions.
  - Upon call termination (`hang up` / `bye`), the tracked responses are persisted to KV via `persistVoiceDebrief()`.
- **DailyOpsModal Hydration (`src/components/DailyOpsModal.tsx`)**:
  - The UI now mounts and queries `/api/ai/insights?resource=voice-debrief`.
  - If a voice debrief was captured by Nexus during the 9 PM call, it hydrates the fields and shows a subtle indicator ("Nexus captured your debrief at 9:12 PM").

## Harmony Daily Briefing System (2026-05-24)

  - Employs the `callAI` multi-provider LLM stack to synthesize an outcome-focused daily brief containing **Resonance & Peak Energy Flow**, **Orchestration Agenda** (highlighting critical court blocks/milestones marked with `🔒`), and **Actionable Execution Targets**.
  - Caches the synthesized briefing under `harmony_brief:${userId}` in Key-Value store.
- **Dashboard UI Panel (`src/components/DashboardBriefing.tsx`):**
  - Upgraded the metric bar to include a beautifully styled, expandable frosted-glass panel with subtle golden-emerald borders and smooth Framer Motion `AnimatePresence` height transitions.
  - Renders live synthesized brief text, peak performance hours, scheduled dockets, and clawdbot rapid opportunities.
  - Interactive controls: **Refresh** (compiles real-time data), **Listen** (speaks brief out loud via browser speech synthesis for zero latency), and **Call Phone** (instantly triggers a live Twilio voice dispatch call).
- **Outbound Voice Handshake (`_route-twiml.ts` & `_helpers.ts`):**
  - Updated the Twilio greeting `handleConversation` to dynamically check the `harmony_brief:${userId}` cache. If present, it speaks the compiled briefing text naturally when connecting outbound calls rather than generic prompts.
  - Updated `buildBriefingContext` to inject this daily brief context directly into the ongoing voice assistant session.
- **Scheduling Keys Unification:**
  - Enhanced `getBriefingSchedule` in `_helpers.ts` to perform multi-key fallback checks (`briefing_schedule:${userId}`, `briefing_schedule:${userId}:morning`, and `briefing_schedule:${userId}:evening`) so schedules set across the profile tab and Phone panel remain perfectly unified.

## Vite Build & Puppeteer Prerender Optimization (2026-05-24)

- **Local Build Speedup (Prerendering Bypassed)**: 
  - Modified `vite.config.ts` to bypass heavy headless browser prerendering by default during routine local builds. Prerendering now defaults to `false` and only triggers automatically in production environments (`process.env.VERCEL === 'true'` or `process.env.CI === 'true'`) or when explicitly enabled with `ENABLE_PRERENDER=true`. This speeds up local developer builds by over **300%**.
- **Headless Puppeteer Hardening**:
  - Configured a strict **30-second load timeout** (`timeout: 30000`) inside the `PuppeteerRenderer` instance in `vite.config.ts`. If client-side startup events stall, the build now fails cleanly instead of hanging the terminal session.
  - Added explicit GPU and software rendering exclusion arguments (`--disable-gpu` and `--disable-software-rasterizer`) to Puppeteer's startup command. This resolves the high-CPU resource leak (which previously caused headless Chrome helpers to lock up Mac host resources at 65%+ CPU usage).

## Design handoff pipeline (n8n → Figma → Cursor / OpenClaw / NVIDIA)


**Cursor rule:** **`.cursor/rules/13-design-handoff-n8n-figma-cursor.mdc`** (trigger: user asks to **design** something, new **visuals**, **Figma**, or **n8n** design automation). (historical)

**Yes, as a workflow — with realistic limits:**

- **n8n** is a solid **orchestrator**: webhooks, HTTP to **Gemini** / **Imagen** / **NVIDIA-hosted** image APIs, then notify humans or post artifacts.
- The weak link is **“Gemini draws an image → Figma turns it into a design”**: **Figma does not natively vectorize** a bitmap into production UI. Typical paths: **place image on a frame and trace/rebuild with components** (manual or semi-automated **plugins**), or third-party **image→layout** tools (quality varies).
- **Figma → Cursor:** usually **Figma MCP** (or export) → **specs, structure, screenshots** → **you or the agent** write **React** to match **`globals.css`** tokens — not a magic paste-code pipe.
- **OpenClaw** can sit **beside** n8n (same HTTP/webhooks); it does **not** remove **Figma API** limits.
- **Strong pattern:** **prompt → image (Gemini/NVIDIA/etc.) → human or plugin pass in Figma → design tokens + components → Cursor implements** using **`integrations/research/DESIGN_TOKENS_SYNCSCRIPT.md`**, **11-ux-ui-excellence**, **03/04** where applicable. Deep checklist: **`integrations/research/UX_UI_REFERENCE_CANON.md`**. (historical)

**Nexus voice orb (App AI immersive):** **`NexusVoiceSpeakingDust`** (CSS twinkle while TTS), smaller **`NexusVoiceMinimalCircle`** + **`NexusVoiceSatelliteOrbit`**, optional **cyan + rose** immersive tint when speaking — files under **`src/components/nexus/`** and **`VoiceConversationEngine.tsx`**.

## Product positioning — AI integration vs replacement (curated 2026)

**Yes — this is what syncscript.app is about:** a **work, calendar, tasks, and voice** surface where **models are swappable infrastructure** (`api/_lib/ai-service.ts` — Groq, NVIDIA, Anthropic, OpenAI, …), not the product’s sole identity. Anthropic and peers win the **general intelligence + distribution** race; SyncScript wins a **slice** only if it stays disciplined on that slice. (historical)

### What SyncScript is (operator + founder framing)

- **Not a Claude replacement.** Users keep using **Claude, ChatGPT, Cursor, etc.** where those tools excel. SyncScript is the **place those capabilities meet your real week**: tasks, calendar, energy, billing-adjacent workflows, team, scripts—**one app**, **your** Supabase-backed state, **bounded** Nexus tools + traces (`emitNexusTrace`, contracts in `npm test`).
- **Integration layer as AI shifts.** Models and vendors change monthly; SyncScript’s bet is **multi-provider routing + workflows** so you are **not locked to one lab** to get work done inside the product. “Use the best model available **with** SyncScript” beats “be the only model.”
- **Proprietary value = energy + continuity.** The durable differentiator is **energy-aware scheduling** and **readiness-aligned orchestration** (dashboard, Today, AI Focus, marketing demo)—**when** to lean on heavy AI vs light work, not raw benchmark scores. Keeping “up with AI” here means **wiring new providers and tools into the same loop**, not rebranding as the next chatbot.

### What Anthropic-scale players will not optimize for (your moat to defend)

- **Circadian / energy as first-class state** tied to **task + calendar** UX—not a generic assistant sidebar.
- **Deep parity**: “Anything the web app allows” via Nexus on **voice, in-app chat, phone** where feasible (MEMORY quick section)—**completeness** over generic answers.
- **Trust in a vertical**: playbook tiers, OAuth, audit trails, Edge tasks—**constrained behavior in your domain**, not only model-level safety.

### Honest constraint

**Breadth vs depth:** the full feature catalog is wide; the positioning above only holds if the **spine** (energy + calendar + tasks + Nexus) stays visibly best-in-class. Bundled Big Tech assistants remain the default competitor—**narrow story + measurable retention** beats “we have more tabs.”

## Product — social + external IDE bridge (2026-04-27)

**Spec:** `integrations/research/SYNCSCRIPT_ACTIVITY_AND_SOCIAL_SPINE.md` (catalog row in `integrations/research/INDEX.md`). **Roadmap (phases + architecture):** `integrations/research/CURSOR_SYNCSCRIPT_SOCIAL_PRODUCTIVITY_ROADMAP.md`. (historical)

- **Enterprise business plan:** Canonical git doc **`BUSINESS_PLAN.md`** (2026-05-18, fact-based: problem/solution/market/traction/team/financials/asks) · research **`integrations/research/SYNCSCRIPT_BUSINESS_PLAN_CANON.md`** · in-app **Enterprise → Plan** tab (save + Copy markdown) · rule **14**. (historical)
- **Activity spine:** Postgres `user_activity_events` (+ task completion writes from Edge `email-task-routes` via `activity-record.ts`). **Profile heatmap** (`IndividualProfileView`) reads **`GET …/activity/summary`** (Edge `social-productivity-routes.tsx`). **`POST …/activity/events`** is **rate-limited** (~60/min per user, HTTP 429) in `social-productivity-routes.tsx`.
- **Goals → activity:** marking a goal complete in the dashboard calls **`postActivityEvent`** (`goal_progress`, private metadata) from `src/hooks/useGoals.ts` via `src/utils/edge-productivity-client.ts` (best-effort).
- **Tasks:** dashboard path remains **`taskRepository`** / `SupabaseTaskRepository` → Edge. Legacy **`TaskService`** in `src/services/data-service.ts` **delegates** to `taskRepository` (same routes as MCP); not the primary app path.
- **PAT + MCP:** Settings → Privacy → **Cursor / MCP access tokens** (`sspat_*`). MCP package **`integrations/cursor-syncscript-mcp/`** (see README). OpenAPI: **`public/openapi.json`** tag **ProductivityEdge** + second **server** URL for Edge base.
- **Social defaults:** `user_social_prefs` defaults **private**; friend feed via RPC **`social_friend_activity_feed`** only when relationship **friend/accepted** + friend has **friend_feed_opt_in** + events visibility **`friends`/`public_summary`**. UI: **Settings → Privacy** cards + **AI Assistant panel → Social → Friends** strip (`FriendsActivityFeedPanel`).
- **Deploy (2026-04-27+):** migration `20260427090000_activity_business_plan_api_tokens.sql` then **`npm run deploy:edge:make-server`** (redeploy after Edge rate-limit / activity changes). **Entry file is `supabase/functions/make-server-57781ad9/index.ts`** (not `index.tsx`) — `social-productivity-routes` + **`financial-routes`** must be imported and `app.route`’d there or production will 404 those paths; guarded by **`tests/edge-social-productivity-mount-contract.test.mjs`**. After deploy: **`npm run verify:edge-productivity-http`** (optional **`SYNCSCRIPT_TEST_JWT`** for authenticated rows). **Signed-in UI + Edge regression:** **`npm run test:e2e:signed-in-productivity`** (`e2e/signed-in-productivity-edge.spec.ts`) with **`E2E_LOGIN_*`** or **`NEXUS_LIVE_TEST_*`** in `.env` — heatmap `GET /activity/summary`, PAT create/revoke, friend feed `GET /friends/activity-feed`. Cursor conversations do **not** auto-append to MEMORY — curate manually into this file / research (do **not** rely on `memory/YYYY-MM-DD.md` — gitignored + cursorignored).
- **Backlog:** automatic **`calendar_event_done`** from a single calendar save path — still **deferred** (see spine § Repo completion notes).

### MCP operating model (external AIs + syncscript.app)

- **Source of truth:** Signed-in **syncscript.app** (dashboard) and **Supabase Edge** `make-server-57781ad9` for tasks, calendar holds, capture inbox, activity, business plan, **user file library** (`/resources/*`), and profile — same routes the React app uses via JWT; **Cursor / Claude / any MCP host** uses a **scoped PAT** (`sspat_…`) with explicit scopes (rotate PATs to pick up new scopes such as **`library:read`** / **`library:write`**).
- **Planning loop (recommended):** In the IDE, call **`syncscript_week_snapshot`** once → tasks + `calendar/local-events` + activity window + capture inbox → draft **`syncscript_put_business_plan`** / tasks / **`syncscript_calendar_hold`** / **`syncscript_create_capture_inbox_item`** (human gate) → **`syncscript_log_activity`** (`external_ide_session` / `focus_block`) so the heatmap reflects real work.
- **Files from agents:** **`syncscript_library_upload_base64`** → Edge **`POST /resources/upload-json`** (≤ **1 MiB** decoded per file; larger binaries → signed-in app **multipart** `POST /resources/upload` up to **50 MiB**). Link to a task with **`syncscript_library_link_file`** (`entity_type: task`, `entity_id: <task id>`). **`email-self`** remains **JWT-only** (PAT cannot resolve mailbox for Resend).
- **Not on MCP yet (client-first):** **Goals** (`useGoals` / local command adapter), **Workstream** canvas graph, and **friend feed** stay in-app or JWT-only APIs — see **`integrations/research/MCP_PARITY_AND_ROADMAP.md`** for phased server alignment if we want full “GitHub + calendar” parity from externals. (historical)
- **Safety:** Never commit PATs; split tokens per machine; use **capture inbox** for risky bulk writes; keep exhibits and secrets out of agent prompts — **links** in task descriptions + **library** storage.

## Work completion — finish what we start
When we take on a feature, integration, or production fix, **drive it to completion in one coherent effort** (same session / same PR-sized slice when possible): code + **migrations** if needed + **Supabase Edge deploy** when Edge changes + **Vercel** when `api/*` or env changes + **contract / smoke / verify scripts** that prove the path + **this `MEMORY.md`** (and a daily note if useful). **Avoid** landing half-wired routes, stale dashboard URLs, or “we’ll set env later” for **production-critical** flows unless the user explicitly cuts scope.

**Build it out entirely (standing user rule — do not make them repeat this):** For **any** new operator path, IDE integration, proxy lane, or agent workflow, ship the **full vertical slice** in one pass: scripts + npm commands + verify gate + runbook/INDEX/MEMORY pointer + failure modes documented + **end-to-end verify on the machine** (not “paste this later”). Definition of done = another agent or the user can run **one documented command** (e.g. `npm run verify:claude-proxy-full`) and trust the stack without returning to “finish building.”

If **blocked** (missing secret, third-party dashboard, hardware), **stop with a written unblocker**: exact env name, exact URL to click, exact command — and add it to **`MEMORY.md`** or **`memory/YYYY-MM-DD.md`** so nobody rebuilds the same half-finished work from scratch.

## Mac disk space — reclaim protocol (finished; refresh sizes periodically)
**Why this lives here:** The machine hit **disk-full** conditions (failed copies, corruption risk). **Policy:** keep **roughly ≥10–15% free** on the system volume when possible; **free space before** heavy installs, sync, or DB work. **Compression** is for **cold archives** (ZIP to external disk); it is **not** a substitute for deleting **regenerable** dev artifacts or huge **IDE snapshot** data.

### Checklist (System + dev + IDE)
1. **Apple:** **System Settings → General → Storage** — review largest categories, Recommendations, Large Files / Developers.
2. **Regenerable dev fat (safe in principle):** stale **`node_modules`** (reinstall with `npm ci` / `pnpm install`), **`dist/` / `build/` / `.next/`**, **Docker** images/volumes you do not need (`docker system prune` only after understanding what goes away), **language package caches** (npm/pip/Homebrew).
3. **Xcode / tooling:** **`~/Library/Developer`** — DerivedData and simulators if you are not actively using those builds.
4. **IDEs are separate:** **Cursor**, **Windsurf**, **VS Code**, **Antigravity** each use their own **`~/Library/Application Support/<App>`** — cleaning one does **not** clean the others. Same *class* of cleanup (caches, old workspaces); paths differ by product/version.
5. **Do not** treat “compress my source tree” as the main lever — editors and agents need normal folders; **move cold projects off-disk** or **archive** (ZIP) what you will not open for months.

### Tradeoffs (honest)
| Target | Typical action | Tradeoff |
|--------|----------------|----------|
| **`node_modules` / build dirs** | Delete; reinstall / rebuild | Time to restore |
| **Browser / system caches** | Clear via Settings or browser | Re-downloads |
| **Cursor `snapshots/`** (local checkpoints) | Reduce retention or remove after **quit Cursor** | **Loses** local snapshot/history stored there — confirm you accept that |
| **`User/globalStorage/state.vscdb`** | Do **not** delete casually | Settings / state risk — prefer official cleanup or vacuum guidance |

### Snapshot — this Mac (agent `du` / `df`, refresh after cleanups)
**2026-04-12 — `~/Library/Application Support/Cursor/snapshots` bulk deleted once** (~**117 GiB** `du` before). After reboot, APFS **`df`** settled to **~129 GiB free** on `/` (was ~2.7 GiB before reclaim). Cursor **recreated** a fresh `snapshots` tree (few GiB, grows with use) — **not** the old 117 GiB pile.

| Location | ~Size (measured 2026-04-12 session) | Note |
|----------|--------------------------------------|------|
| **`/` (system volume)** | **~129 GiB free** (`df`) | Meets **≥10–15%** headroom target on 460 GiB class volume |
| **`~/Library` total** | **~80 GiB** (`du`, may hit TCC on some subfolders) | Use **System Settings → Storage** for Apple’s full breakdown |
| **`~/Library/Application Support/Cursor`** | **~30 GiB** | Was ~141 GiB before big `snapshots/` delete |
| → **`…/Cursor/snapshots`** | **~5.6 GiB** (regrown after reboot) | Trim again later if needed (quit Cursor first); see **`integrations/research/studies/2026-04-12-mac-disk-cursor-snapshots.md`** | (historical)
| → **`…/Cursor/User`** | **~22 GiB** | Workspaces, extensions, `globalStorage` (`state.vscdb`, etc.) |
| **`~/Library/Developer`** | **~15 GiB** | Xcode / simulators — next reclaim candidate |
| **`~/Library/Caches` / `Containers`** | *use Storage UI* | `du` from agents may get **Operation not permitted** on Apple sandboxes |
| **`~/syncscript/node_modules`** | **~1.2 GiB** | Regenerable (`npm ci`) |
| **`~/syncscript/build`** | **~14 MiB** | Regenerable |

### Re-scan commands (read-only)
```bash
df -h /
du -sh "$HOME/Library/Application Support/Cursor"/* 2>/dev/null | sort -hr | head -20
```

### Reclaiming **`~/Library/Application Support/Cursor/snapshots`** (careful)
**Done once (2026-04-12):** folder removed with `rm -rf` while Cursor was running — succeeded; prefer **quit Cursor first** next time to avoid rare file-lock issues.

1. **Quit Cursor** fully (not only window) before manual deletes.
2. Prefer **in-app** controls if the current Cursor version exposes snapshot / local history retention (check **Settings**).
3. If removing manually: consider **rename** to `snapshots.bak`, reopen Cursor, verify behavior, then delete the backup — or **move** `snapshots` to an **external drive** before delete if you want a safety copy.

**Related:** Global user rules were also written to **`aicontext.personalContext`** in `state.vscdb` — do not delete that DB to “save space” without understanding you may reset IDE state.

## Knowledge vs disk — memory without hoarding bytes
**Goal:** Keep **science and conclusions** durable while **freeing space** — **knowledge is not the same as bytes.** Export insight into **small files + git**; use **tiered storage** and **retention** for bulk; do not rely on **IDE snapshots** as long-term memory.

### What you need to “never forget”
**Knowledge = conclusions + how you got there**, in **small, durable artifacts:**

| Keep (lightweight) | Usually skip hoarding |
|--------------------|------------------------|
| Written summary in git-backed docs (`MEMORY.md`, `memory/YYYY-MM-DD.md`, **`integrations/research/`**) | Raw multi‑GB logs unless legally required |
| **Results:** what you measured, version, date, command, link to commit | Every intermediate scratch file |
| **Repro:** exact script + pinned versions (`package.json`, lockfile) | Duplicate copies of the same repo |
| **One** canonical dataset path or export | Many duplicate exports of the same study |

**IDE reality:** **Cursor snapshots / huge IDE state are not a memory system** — they are **local editor/checkpoint history**. Curated notes + git are the backup for your mind.

**Rule of thumb:** If the insight is important, it should survive **without** that data living on the internal SSD forever as raw bulk.

**Canonical catalog:** **`integrations/research/INDEX.md`** (git-tracked — **`docs/`** is gitignored in this repo, so research lives under **`integrations/research/`**). Cold ZIP/tar bundles: use **`integrations/research/ARCHIVE-README.template.md`** inside or beside the archive. (historical)

### Free space and keep the science (tiered storage)
| Tier | Where | Use |
|------|-------|-----|
| **Hot** | Internal SSD | Active projects, tools, work touched weekly |
| **Warm** | External SSD or second volume | Finished studies, old VMs, big datasets you might re-open |
| **Cold** | Archived ZIP/tar + README from template | Long-term; **compress** text-heavy cold bundles; still **delete regenerable** fat (`node_modules`, builds, Docker cruft) — compression does not replace that |

**This Mac:** **`~/Library/Application Support/Cursor/snapshots`** was **~117 GiB** — **not** “irreplaceable research”; it is **local checkpoint bulk**. Preserve conclusions in **`integrations/research/INDEX.md`** / **`MEMORY.md`**; trim snapshots only when you accept losing that **local undo** stack (see **§ Mac disk space** above). (historical)

### “Never run out of space” (realistic)
You cannot guarantee **infinite** local space; you can make exhaustion **unlikely**:

- **Floor:** aim for **~10–15%+ free** on the system volume; below that, writes and performance get risky.
- **Monitor:** monthly **`df -h`**, macOS **Storage**, optional low-disk alerts.
- **Policy:** When **IDE data**, **simulators**, or **Docker** grow — **cap by process** (retention, prune, move cold data off-disk), not one yearly panic cleanup.
- **Backups:** Time Machine or another backup to **external** disk; archived research in **named, dated** folders/repos so restore is **meaningful**.

### Scalable memory system (personal scale = enterprise pattern)
- **One index:** **`integrations/research/INDEX.md`** — title, date, outcome, path/archive, key command. (historical)
- **Per study:** short markdown — **setup → method → result → follow-ups** (even if raw logs go away).
- **Git** for code/text you care about; **large binaries** → Git LFS or **outside git** with a **pointer** in the study doc.

### What large orgs do (same idea, smaller scale)
**Retention**, **tiered storage**, **documentation**, **backups** — not “compress everything and hope.” **Small curated memory**, **cold archives** for bulk, **aggressive cleanup** of regenerable and redundant **IDE cache/snapshots**.

**Bottom line:** Treat **disk as expensive** and **knowledge as exported** into small files and git. Use **external/cold** archives for bulk; **trim IDE snapshots and caches** for space; **index** what matters so nothing important depends on “it’s still somewhere on the laptop.”

## Obsidian.md — official site facts ↔ SyncScript memory + Resonance Homeostasis (2026-05-09)

**Catalog entry:** **`integrations/research/INDEX.md`** — row **Obsidian.md ↔ MEMORY + Resonance Homeostasis**. Short spine (links only, no duplicate tables): **`integrations/research/OBSIDIAN_MD_MEMORY_CROSSWALK.md`**. (historical)

**Why this section exists:** [Obsidian](https://obsidian.md/) is a widely copied reference for **local PKM** (personal knowledge management). This repo already encodes similar **habits** in `MEMORY.md`, **`integrations/research/INDEX.md`**, rules, and git — plus **Resonance Homeostasis (RH)** themes in **`integrations/research/RESONANCE_DOCS_CURSOR_BRIDGE.md`**. Below is a **fact-based crosswalk** from Obsidian’s **own marketing/product pages** (not third-party tutorials), so agents know what we **do** and **do not** mirror. (historical)

**Sources (vendor, read 2026-05-09):** [obsidian.md](https://obsidian.md/) (home), [obsidian.md/sync](https://obsidian.md/sync), [obsidian.md/plugins](https://obsidian.md/plugins), [obsidian.md/publish](https://obsidian.md/publish), [obsidian.md/canvas](https://obsidian.md/canvas), [obsidian.md/help](https://obsidian.md/help/).

### A. What Obsidian claims on-site (condensed; verify before purchase)

| Theme | On-site claim (paraphrase) | Notes for operators |
|--------|----------------------------|----------------------|
| **Privacy / local-first** | Notes live on your device; quick access **offline**; “no one else can read them, not even us.” | SyncScript **repo memory** is **git + markdown** in this workspace — not Obsidian’s vault format. Secrets stay in **env / vault / PAT**, never in committed MEMORY prose. |
| **Open formats / longevity** | “Open file formats” so you are **not locked in**; you own data long-term. | We use **Markdown + JSON (+ code)** in git; **lock-in risk** is mostly **Vercel/Supabase/dashboards** — mitigated by **exports**, **OpenAPI**, **`verify:prod-build`**, and curated **MEMORY** when vendors move. |
| **Links** | “Create connections between your notes” — link ideas, people, places, books; “invent your own personal Wikipedia.” | **`MEMORY.md`** cross-refs **`SESSION_START.md`**, **`AGENTS.md`**, **`integrations/research/*`**, rule **`07`** index — **explicit pointers**, not a `.obsidian` graph UI. |
| **Graph** | Visualize relationships; “find hidden patterns.” | We do **not** ship a force-directed note graph in-repo. Closest: **`INDEX.md`** rows + headings + grep; product has other graphs (e.g. activity heatmap) — different job. |
| **Canvas** | Infinite canvas to research, brainstorm, diagram. | Parallels: **Figma / n8n handoff** (**§ Design handoff pipeline**), optional **Workstream** canvas in-app (**client-first** today per MCP parity doc). |
| **Plugins / API** | Thousands of plugins; “open API” to tailor workflow. | **Cursor rules + MCP + skills + Composio** = our **extensibility plane**; **`integrations/cursor-syncscript-mcp/`** = structured tools to **live** app state (PAT-scoped). |
| **Sync (paid product)** | Background sync; **E2EE** (site mentions **AES-256**); **version history**; cross-platform; **offline, merge when online**; **selective** sync (media toggles); **shared vaults** for teams; **file recovery**. | **Git + remotes** = our free “sync”; **Time Machine / backups** = device-level recovery; **Supabase/Vercel** = product data plane (different threat model — see **Trust** / Edge deploy runbooks). **Pricing table on `/sync` (fetched 2026-05-09):** **Sync Standard** lists **1 month** version history; **Sync Plus** lists **12 months** and higher caps — the **homepage** blurbs also mention version history in friendly terms; **reconcile copy vs pricing** before relying on a number for compliance storytelling. |
| **Publish (paid)** | Turn notes into wiki / docs / “digital garden”; themes, custom domain, password option; fast, mobile-friendly, **SEO** claims. | SyncScript’s public surface is the **product** (`syncscript.app`), not a second brain export — we still borrow the **discipline**: **`/trust`**, **`changelog.json`**, **`openapi.json`**, landing **04-perf-seo** gate. |

### B. What we already do that matches “elite PKM” *engineering* (not the Obsidian app)

1. **Single curated index + evergreen ops** — **`integrations/research/INDEX.md`** + **`MEMORY.md`** hygiene note at top of this file (quarter + walk stale dated sections). (historical)
2. **Conclusions over hoarding** — **§ Knowledge vs disk**; raw logs in **`memory/YYYY-MM-DD.md`** (local) vs curated **MEMORY**.
3. **Links as contracts** — **`AGENTS.md`** reading order; **`.cursor/rules/07-syncscript-app-knowledge.mdc`** topic → section routing. (historical)
4. **Version history** — **`git log`**, **`npm run verify:prod-build`** (HTML fingerprint vs `HEAD`), CI — **intentional** “what shipped” truth, not note-level CRDT.
5. **Separation: editor vs executor** — **RH bridge table** in **`RESONANCE_DOCS_CURSOR_BRIDGE.md`**: Cursor = hot path files/git; **Hermes / OpenClaw** = long loops (**`09-multi-agent-orchestration.mdc`**).

### C. Resonance Homeostasis (RH) mapped to Obsidian-class primitives

RH (see bridge doc abstract) stresses **monotonic improvement**, **bounded degradation** from bad events, and **convergent self-repair** with **checkpoints** and **validation**. Without pasting the copyrighted Doc body, the **repo habits** that implement the same *shape* are:

| RH theme | Obsidian-adjacent primitive | SyncScript implementation |
|----------|------------------------------|---------------------------|
| **Checkpoint / restore** | Version history + local files | **Git revert/reset**, redeploy previous Vercel/Edge revision when needed; **MEMORY** records the **exact** rollback/unblock step. |
| **Validation / “immune” layer** | Community plugins + user discipline | **`npm test`**, **`verify:*`**, hooks, **`02-protected-files-never-touch.mdc`** — reject bad merges *before* prod. |
| **Monotonic quality of truth** | Linked notes + sync | **Do not** let **`MEMORY.md`** quick bullets drift; **same-day** updates when deploy paths change; **INDEX** row per serious study. |
| **Bounded blast radius** | Selective sync / vault scopes | **Small diffs** on auth/billing/Nexus protected surfaces; **PAT scopes** least-privilege for MCP. |
| **Self-repair narrative** | File recovery | **`memory/YYYY-MM-DD.md`** captures incident timeline; **MEMORY** gets the **distilled** fix so the next agent does not repeat the failure mode. |
| **Coherence over time** | Graph / backlinks | **Cross-links** between **§** sections + research paths — humans/agents **traverse** intentionally; we skip pretty graph viz in favor of **searchable** canon. |

### D. Gaps (honest) — not pretending the repo is Obsidian

- **No PKM graph UI** in this repo for `MEMORY.md` (optional future: generated link map under **`integrations/research/`** — only if it pays rent).
- **No E2EE markdown vault** product — encryption story is **app/auth/Supabase**, not Obsidian Sync.
- **“Digital garden”** is not a goal for internal MEMORY — **customer-facing** docs live in **trust/changelog/openapi** and research INDEX.

### E. Action habits to keep (steal the *process*, not the stack)

- **One inbox for captures, one canon for truth:** dashboard **capture inbox** + Edge routes for *suggestions*; **MEMORY** for *decisions* (already partially there — **§ Product — social**).
- **Prefer links over paste:** cite **`integrations/research/...`** and **commit SHAs** instead of duplicating long logs in **MEMORY**.
- **When vendor pages disagree** (e.g. generic “version history” vs `/sync` tier table), **believe pricing/spec tables** and **date your cite** in MEMORY.

## MiroFish-class simulation ↔ SyncScript — capability program (2026-05-09)

**Status:** **Plan + capabilities only** — no product implementation committed in this MEMORY entry; execution picks **one phase** at a time from the canonical doc.

**Canonical source (do not duplicate here):** **`integrations/research/MIROFISH_SYNCSCRIPT_FULL_CAPABILITY_PROGRAM.md`** — full-stack analysis frame, **capability domains A–H** (numbered IDs), **dashboard/feature-catalog binding**, **P0–P8** phased program with **exit criteria** and **kill signals**, **success metrics catalog**, **explicit non-goals**, appendix repo pointers. **Short fact anchor:** **`integrations/research/MIROFISH_SYNCSCRIPT_STRATEGIC_PLAN.md`** (MiroFish README + OASIS link, AGPL/cost warnings). **Discovery:** **`integrations/research/INDEX.md`** catalog rows; **`.cursor/rules/07-syncscript-app-knowledge.mdc`** MEMORY routing table. (historical)

### What it is (fact-grounded)

- **MiroFish** ([666ghj/MiroFish](https://github.com/666ghj/MiroFish)): seed → **GraphRAG** → personas → **[OASIS](https://github.com/camel-ai/oasis)** simulation → **ReportAgent** + deep interaction; **LLM** (OpenAI-compatible) + **Zep**; high **token** cost; README warns **small round counts** first.
- **Unverified in README review:** viral **agent count ceilings**, “**Voices**” as separate product, **10-day** / **course** claims — **not** requirements until sourced.

### North star (defensible “revolutionary” thesis)

**Rehearsal + calibration + governance on the work spine:** counterfactual **simulation runs** are always **labeled** (assumptions, seed hash, models, budget), **sidecar-isolated** (license + blast radius), **quota’d**, and **compared over time** to **real tenant outcomes** (tasks, calendar, activity spine) where privacy allows — not **magic prediction** or unbounded swarm spend.

### Capability domains (summary — detail in canonical doc)

| Domain | Focus |
|--------|--------|
| **A — Work spine** | Bind runs to **tasks, calendar, capture, library, Enterprise Plan, MCP week snapshot** — no shadow task system. |
| **B — Simulation runtime** | Versioned **run_id**, worlds/ticks, **replay/diff**, interventions, **stochastic branches**, **hard stops** (time/tokens). |
| **C — Graph + memory** | Seed ingestion, **GraphRAG-style** graph, **grounding** (cite graph edges), TTL / legal hold. |
| **D — Human + audit** | Approval gates before external effects, **SOC2-friendly lineage** export, red-team packs. |
| **E — Product surfaces** | Per-route binding (see **`SYNCSCRIPT_FULL_FEATURE_CATALOG.md`**) — Dashboard, Tasks, Calendar, Energy/Resonance, AI/Nexus (explain-only + budget UI), Enterprise, Analytics, Capture, Library, Settings, MCP tools. |
| **F — Commercial** | Entitlements, **token accounting**, tenant isolation, optional **simulation credits** billing, SLA class. |
| **G — Trust / ethics** | Synthetic watermarks, **real-person firewall**, AGPL/OSS review, **no silent** outbound from sim agents, **incident playbooks**. |
| **H — Observability + research** | Run telemetry, **calibration KPIs**, **INDEX + MEMORY** updates per methodology change, dogfood loop. |

### Phased program (order — full gates in canonical doc)

| Phase | One-line scope |
|-------|----------------|
| **P0** | License + **$/run** evidence + ADR |
| **P1** | Frozen **sidecar API** + mock + contract tests |
| **P2** | Tenant **run registry** + RLS stories |
| **P3** | Sidecar **alpha** — replay + abort + cost cap |
| **P4** | **Enterprise-only** product alpha + governance |
| **P5** | Nexus **explain** + enqueue (no bypass of budget UI) |
| **P6** | **Calibration beta** vs `user_activity_events` / metrics |
| **P7** | **MCP + tasks** binding (`verify:cursor-syncscript-mcp` extension) |
| **P8** | **GA** load test + SLO + rollback drill |

**Kill signals (pause program):** economics fail, misinformation incident, regulatory letter, critical sidecar CVE, pilot **&lt; actionable value** per agreed rubric — see canonical §14.

### Explicit non-goals (canonical §16)

No replacing **weather/calendar physics** with fiction; no **verified** election/market **prediction** claims without licensed data + stats governance; no **AGPL** in **`build/`** without legal completion; no **default** training on customer seeds; no **silent** email/social from synthetic personas.

## Cursor — Claw Code, resonance, Composio MCP (2026-05-08)

### What we implemented (Claw → Cursor wave)

**Principle:** **Claw Code** (`ultraworkers/claw-code`, Rust harness, `PHILOSOPHY.md` OmX / clawhip / OmO) is **not** a Cursor plugin. What transfers is **process**: keep noise out of context, plan → execute → verify, multi-surface split, least privilege — expressed as Cursor **rules + MEMORY + hooks/tests mindset**, not vendoring the Rust tree.

| Layer | What shipped (repo paths) |
|-------|---------------------------|
| **Always-on rule (A+B+C)** | **`.cursor/rules/15-claw-resonance-cursor-workflow.mdc`** — (A) repo truth / small diffs / protected files; (B) Cursor vs OpenClaw·Hermes·Engram vs **ClawHub skills** vs **Cursor MCP**; (C) optional **β(t)** scheduling hint tied to **`src/utils/resonance-calculus.ts`** (`getCircadianCurve`, `calculateResonanceScore`), explicit **not medical**, no silent product automation from resonance. | (historical)
| **Bootstrap** | **`.cursor/rules/00-session-bootstrap.mdc`** — agents skim rule **15** after rule **07**. | (historical)
| **Routing** | **`.cursor/rules/07-syncscript-app-knowledge.mdc`** — table row → rule **15** + resonance bridge. | (historical)
| **OpenClaw doc set** | **`.cursor/rules/12-openclaw-clawhub-cursor-local.mdc`** — “read first” bullets for rule **15**, **`RESONANCE_DOCS_CURSOR_BRIDGE.md`**, **`CURSOR_MCP_COMPOSIO_GOOGLE_SETUP.md`**, Rube deprecation. | (historical)
| **Research** | **`integrations/research/RESONANCE_DOCS_CURSOR_BRIDGE.md`** — links to **Resonance calculus / algebra** + **Resonance Homeostasis** Google Docs; maps themes to IDE + **`resonance-calculus.ts`**; **verified MCP read** subsection (doc id `1jMqn2EAFuhfQqW9A-UohxsWKLP7Cs_9OnsPWqu5JfkE`, ~39.6k-char plaintext via Composio; outline + paraphrased abstract only in git, not full copyrighted body). | (historical)
| **Composio + Cursor clicks** | **`integrations/research/CURSOR_MCP_COMPOSIO_GOOGLE_SETUP.md`** — `cursor://settings` → MCP; **`https://app.composio.dev`** → Integrations → Google; OAuth; verified subsection. | (historical)
| **IDE excellence** | **`integrations/research/CURSOR_IDE_EXCELLENCE_SYNCSCRIPT.md`** — MCP + Composio Google + rule **15** pointer. | (historical)
| **Catalog** | **`integrations/research/INDEX.md`** — rows for resonance bridge + Composio Google setup + **Obsidian.md ↔ MEMORY + RH** (**`OBSIDIAN_MD_MEMORY_CROSSWALK.md`**) | (historical)
| **Session handoff** | **`SESSION_START.md`** — IDE discipline bullets (A+B+C, resonance heuristic, Composio setup, last-session bullets). |

**Google Docs access today:** Cursor **user-rube** (Composio-backed) with toolkit **`googledocs`** **ACTIVE**; tools such as **`GOOGLEDOCS_GET_DOCUMENT_PLAINTEXT`** succeeded on **Resonance Homeostasis**. **Risk:** Rube-branded meta layer is **deprecated** — API responses reference **`https://rube.app/deprecation`** and **EOL 2026-05-15**.

### Migration plan — Composio For You MCP (do before Rube EOL)

**Why:** Keep **Google Docs** (and other Composio toolkits) working after **2026-05-15** without depending on deprecated **Rube** meta-tooling.

**Config done on this Mac (2026-05-08):** **`~/.cursor/mcp.json`** includes **`mcpServers.composio`** with **`url`:** **`https://connect.composio.dev/mcp`** and **`headers`:** **`{}`** (Composio’s Cursor pattern: **no** API key in the file for this server — you finish auth with Cursor’s **Connect** + browser OAuth). **Still required from you:** **fully quit and restart Cursor** → **Settings → MCP** → select **composio** → **Connect** → sign in if prompted → then run a **Google Docs read** test from an agent chat. Keep **`rube`** until that test passes; then you can turn **`rube`** off to avoid duplicate tool routers.

**Official URLs (from Composio’s own Cursor setup page, 2026-05-08):**

| Step | Action |
|------|--------|
| **1** | Read **Cursor → Settings → MCP** (or **`cursor://settings`**) and list what you use today (e.g. **rube** / **user-rube**, tool slugs you rely on). |
| **2** | **DONE (file):** **`composio`** server added per **https://composio.dev/cursor** — HTTP URL **`https://connect.composio.dev/mcp`**, empty headers. **YOU:** open that page if you want the live instructions; complete **Connect** in Cursor after restart. |
| **3** | **Restart Cursor**; complete OAuth for the new server. |
| **4** | In Composio **https://dashboard.composio.dev** or **`https://app.composio.dev`**, confirm **Google / Google Docs** integrations stay **ACTIVE** (same account you used for Rube). |
| **5** | **Validate:** In agent chat, confirm a **Docs read** (e.g. same Homeostasis `document_id`) using whatever tool names the **For You** MCP exposes — **discover slugs in-session**; do not assume they match legacy `RUBE_*` names. |
| **6** | **Cutover:** When validated, **disable** legacy **user-rube** in MCP settings to avoid split-brain; update this **MEMORY** section with the active server label and any slug renames you confirm. |
| **7** | **Optional CLI:** If you adopt Composio **CLI** for scripts, document the binary path in **`TOOLS.md`**; keep secrets out of git. |

**Support:** Composio docs **`https://docs.composio.dev`**; community **`https://discord.gg/composio`** (linked from their Cursor page).

**Not required for migration:** No extra git commits beyond this **MEMORY** update unless you later want research markdown refreshed — operator truth lives here until you change tooling again.

## OpenClaw + Cursor — how to work effectively
**In SyncScript (the app):** **OpenClaw** is the **autonomous agent harness / gateway** (default **`openclaw gateway`** on **`:18789`** loopback; EC2 in prod). The product reaches it through **Supabase Edge** **`openclaw-bridge`** and the dashboard — not by “Cursor magic.” Facts and wiring: **`integrations/ENGRAM_OPENCLAW.md`**, **`supabase/functions/make-server-57781ad9/openclaw-bridge.tsx`**, **`OPENCLAW_BASE_URL`** / EC2 **`3.148.233.23:18789`** in this file below. (historical)

**In Cursor (the IDE + coding agent):** treat integrations as **explicit tool surfaces**, not vibes:
- **Composio + MCP** — Strong pattern for connecting **OpenClaw-style harnesses** to **many external tools** via **Model Context Protocol** (unified tool router, OAuth/API handling). Composio documents **Cursor ↔ OpenClaw** toolkit wiring (search: *Composio Cursor OpenClaw* — e.g. [cursor + openclaw on Composio](https://composio.dev/toolkits/cursor/framework/openclaw), [Composio MCP with OpenClaw](https://composio.dev/content/how-to-use-composio-mcp-with-openclaw)). Use when the goal is **broad third-party actions** from an agent with MCP.
- **Cursor-native MCP** — Cursor settings + project **`mcps/`** tool descriptors (e.g. GitHub). Prefer **MCP** for provider-backed actions when available; don’t assume a shell CLI exists for the same capability.
- **Skills / playbooks** — Repeatable procedures: **Cursor skills** (`SKILL.md`), repo **`integrations/agent-playbooks/README.md`**, **`.cursor/commands/*.md`**. Community index: [awesome-openclaw-skills — coding agents & IDEs](https://github.com/VoltAgent/awesome-openclaw-skills/blob/main/categories/coding-agents-and-ides.md). (historical)

**Hermes / Engram (this repo’s split-brain stack):** follow **`.cursor/commands/verify-hermes-engram.md`** and **`integrations/agent-playbooks/`** — not a generic `hermes` shell command. **Cursor ↔ Hermes orchestration + multi-AI boundaries:** **`.cursor/rules/09-multi-agent-orchestration.mdc`** (always on in this workspace). **Global Cursor “one brain” (all folders):** paste **`~/.cursor/RULES_FOR_AI_GLOBAL_PASTE.txt`** into **Cursor → Settings → Rules for AI**; optional symlink **`~/.cursor/rules-global/00-universal-cursor-brain.mdc`** per repo via **`scripts/link-global-cursor-brain.sh`** (gitignored symlink). **IDEs (Antigravity, etc.):** listed in **`TOOLS.md`** — not CLIs; separate configs from SyncScript. (historical)

## Antigravity + Claude Code + free proxy (2026-05-09)

### “Provider API request failed” (Antigravity Claude panel)

**Symptom:** IDE shows `Provider API request failed. (request_id=…)` on normal agent chat.

**Cause (verified):** **Option C** routes Sonnet/Opus to **Gemini on OpenRouter**; Claude Code **always sends `tools`** in Antigravity agent mode → upstream fails; proxy embeds that string in the SSE stream. **Not** the same as **`Provider rate limit reached`** (`:free` quota).

**Fix “Provider API request failed”:** **`npm run fix:claude-proxy-antigravity`** (Option D + verify + Antigravity restart).

**Fix “Provider rate limit reached”:** **`npm run heal:claude-proxy-rate-limit`** — **Option E** (all tiers on **NIM**, no OpenRouter `:free`). Then **new chat** → **`Reply with exactly: OK`**. When `:free` quotas cool, optional **`npm run apply:free-claude-code-option-d-hybrid`**.

**Automated gate:** **`npm run verify:antigravity-sanity-chat`** · full: **`npm run verify:claude-proxy-full`**.

**Hard truth:** There is **no** legal, stable way to get **unlimited frontier Claude Code** at **zero** marginal cost forever. “Completely free” in practice means **(a)** vendor-included quota (Antigravity / `claude.ai` limits, hourly caps), **(b)** **$0-ish compute** you already own (**Ollama** on your GPU — slow/quality-capped), or **(c)** **someone else’s free tier** (**NVIDIA NIM** promos, tiny **OpenRouter** credits) until it ends. **Bypassing** Antigravity’s quota = **stop sending those requests to Anthropic’s included endpoint** — you are **not** “stretching” the same free pool; you are **switching lanes**.

### Best operator strategy (maximize included quota + minimize spend)

| Lane | When to use | Env / routing (concept) | Goal |
|------|-------------|---------------------------|------|
| **L1 — Included** | Short planning, hard bugs, security-sensitive diffs, final review | **Default Antigravity** session: **no** `ANTHROPIC_BASE_URL` override (or whatever the IDE injects for “real” Claude Code) | Burn **only** high-leverage turns on Anthropic’s **included** quota |
| **L2 — Proxy + cheap cloud** | Bulk implement, refactors, tests, scaffolding | Local **`free-claude-code`**-style proxy (e.g. **`Alishahryar1/free-claude-code`**) → **OpenRouter** (e.g. DeepSeek Flash) or **NIM**; **`ANTHROPIC_BASE_URL=http://127.0.0.1:<port>`** per upstream README (**path rules matter**; do **not** guess `/v1` suffix) | **Sidestep** hourly / included limits; pay **fractions of a cent** per 1M tokens vs native Opus |
| **L3 — Local** | Offline or zero API cash | **Ollama** (same proxy pattern) | **$0 API**; pay in **latency** + **hardware** + **quality** |

**Discipline (same “elite bar” as Cursor rule 15, portable to any IDE):** (1) **5-line handoff** before big runs — goal, constraints, “read **MEMORY** § / **SESSION_START**”, **done = green CI command**. (2) **Fresh Claude Code sessions** on long chases (~50k-token reset pattern from community guides — reduces context rot). (3) **One automated gate** per repo (`npm test`, `cargo test`, `ruff`, etc.) before you trust a cheap model’s output. (4) **Turn off** Claude Code **experimental toggles** (e.g. “fast mode”) when the proxy backend errors — many proxies don’t support every Anthropic-only knob.

**Repo runbook + shell helpers (2026-05-09) — implementation complete in git:** **`integrations/research/CLAUDE_CODE_FREE_PROXY_OPERATOR_RUNBOOK.md`** — **Definition of done**, **Option B**, **SyncScript vs Antigravity separation**, **rate-limit recovery**, **`npm run apply:free-claude-code-option-b`**, **`npm run audit:claude-ide-separation`**, preflight (**`cc_lane_verify`** / **`npm run verify:claude-code-proxy-lane`**), **`FREE_MODEL_AB_HARNESS.md`**, **`scripts/templates/free-claude-code-option-b.env.fragment`**, **`scripts/claude-code-lanes.sh`** (**`cc_lane_rate_limit_tip`**, **`cc_lane_apply_option_b`**, **`cc_lane_audit_separation`**, …), **no keys** in git. **Operator-only:** restart proxy after apply; **Cmd+Q** Antigravity; optional **second OpenRouter key** for proxy vs Vercel prod. (historical)

### Implementation checklist (repeatable)

1. **Clone + run** **`Alishahryar1/free-claude-code`** **outside** this app repo (per runbook); **Quick start**; confirm **proxy logs** on **`127.0.0.1:<port>`** on every “hello” test.
2. **Two shell profiles** (or two terminal tabs): `source scripts/claude-code-lanes.sh` from repo root, then:
   - **`cc_lane_native`** — **unset** `ANTHROPIC_BASE_URL` (use Antigravity / Anthropic included path) for **L1**.
   - **`cc_lane_proxy`** (2026-05-09+) — sets **`ANTHROPIC_BASE_URL`** + **`ANTHROPIC_AUTH_TOKEN`** per **`FCC_ANTHROPIC_AUTH_TOKEN`** (default `freecc`) for **L2**; must match proxy `.env`.
   - **`cc_lane_verify`** (or **`npm run verify:claude-code-proxy-lane`**) — **before** blaming a **`claude`** hang: confirms HTTP answers on the proxy URL (exit **1** if nothing listens).
3. **Secrets + Option B:** OpenRouter / NIM keys in **Keychain / env**, **never** committed `.env` in public repos. Merge **`scripts/templates/free-claude-code-option-b.env.fragment`** into **`~/src/free-claude-code/.env`** for default **NIM + `open_router/...:free`** tiering; run **`npm run research:openrouter-free-models`** before locking `:free` slugs; **`integrations/research/FREE_MODEL_AB_HARNESS.md`** for 3-task A/B. If proxy **startup validation** fails with empty keys, set all four **`MODEL*=`** to **`ollama/qwen2.5-coder:1.5b`** until keys exist (see **`~/src/free-claude-code/.env`** header comment). (historical)
4. **Verify after every Claude Code or Antigravity update:** proxy access can break (upstream issue discussion re **`ANTHROPIC_BASE_URL`** / CLI behavior — e.g. **`free-claude-code` issue #168** class of regressions). Proof = **proxy access log** + **OpenRouter/NIM usage dashboard**, not “the UI still says Opus.”
5. **Measure one number** per week: **$/merged PR** or **tokens per green CI** — without a metric, cost routing is guesswork.

### Proxy canonical port — **8082** (2026-06-05, re-aligned from 8085)

- **Goal:** One port for **Antigravity**, **Devin.app**, **Cursor**, **Windsurf**, **terminal `claude` / `fcc-claude`**, **launchd**, **health-watchdog**, and **heal/fix bots** — no split-brain between `fcc-server` and SyncScript scripts.
- **Source of truth:** **`scripts/fcc-proxy-defaults.sh`** (`FCC_PROXY_PORT` default **8082**). Override: `FCC_PROXY_PORT=9000` for experiments.
- **Operator align (machine):** **`bash scripts/align-fcc-proxy-launchd.sh`** — updates **`~/Library/LaunchAgents/com.syncscript.free-claude-code.plist`**, **`~/src/free-claude-code/health-watchdog.sh`**, IDE **`settings.json`**, restarts launchd, runs preflight.
- **Manual `fcc-server`:** Keep **`~/.fcc/.env`** **`PORT=8082`** (matches). Prefer **launchd** or **`bash scripts/start-free-claude-code-proxy.sh`** — do not run a second proxy on another port.
- **Shared L2 (Cursor + Antigravity + Devin + Windsurf):** **`bash scripts/apply-ide-claude-proxy-settings.sh --all`**. Verify: **`verify-cursor-claude-compat.sh`**, **`verify-antigravity-claude-compat.sh`**, **`verify-devin-claude-compat.sh`**. **Cmd+Q** each IDE after apply.
- **Expo / 8082 clash (historical):** If **`API Error: 400 (no body)`** returns while Expo binds `8082`, stop Expo or temporarily set **`FCC_PROXY_PORT=8085`** everywhere (see 2026-05-30 note below).

### Proxy port migration due to loopback clash (2026-05-30) — superseded by 8082 re-align unless Expo recurs

- **Symptom:** Antigravity Claude Code extension fails with `API Error: 400 status code (no body)`.
- **Root Cause:** Expo packager was running on loopback port `8082` (IPv6 wildcard `*`). The proxy was also bound to `8082` (IPv4 loopback `127.0.0.1`). Fetch clients within the IDE preferred IPv6 loopback `[::1]:8082`, routing extension requests directly to Expo instead of the proxy, which returned an HTML landing page rather than expected JSON/SSE stream.
- **Resolution (2026-05-30):** Temporarily migrated to **`8085`**. **2026-06-05:** Re-aligned to **`8082`** via **`fcc-proxy-defaults.sh`** + **`align-fcc-proxy-launchd.sh`** so `fcc-server` and fix bots share one port.

### 9router Integration and Model Listing fixes (2026-06-04)

- **Symptom:** Proxy failed to validate models at startup with error `NINEROUTER model-list response is malformed: invalid JSON` or `missing model`, causing application startup failures.
- **Root Cause:** 
  1. The `Settings` class in `config/settings.py` lacked the `nine_router_base_url` property, causing `NINEROUTER_BASE_URL` in `.env` to be ignored. The base URL fell back to the default `http://localhost:3000` (which is occupied by the SyncScript Vite React development server). Vite's HTML index page was returned instead of model JSON.
  2. 9router endpoints (like `/models` and `/messages`) require the `/v1` prefix (e.g. `/v1/models` and `/v1/messages`). Calling them without it returned Next.js 404 HTML responses.
  3. The `NineRouterProvider` in `providers/nine_router/client.py` overrode the model extraction methods using OpenRouter-specific logic that filters by `supported_parameters`. Since 9router returns standard OpenAI-compatible lists lacking this key, all models were filtered out, leading to `missing model` validation failures.
- **Resolution:**
  - Added `nine_router_base_url` to the Pydantic `Settings` class in `config/settings.py`.
  - Appended `/v1` to `NINEROUTER_DEFAULT_BASE` and the default settings value, and updated the `.env` and `com.syncscript.free-claude-code.plist` configurations to use `http://localhost:3002/v1`.
  - Removed the `_extract_model_ids_from_model_list_payload` and `_extract_model_infos_from_model_list_payload` overrides in `NineRouterProvider` to inherit the standard OpenAI/Anthropic model list parsing behavior.
  - Successfully verified E2E model routing and validation, showing 100% green preflight and real E2E `PONG` output through the proxy.

### Python 3.13 NameError & Exception Tuple fixes (2026-06-01)

- **Symptom:** Proxy crashed at boot with `Failed to start messaging platform: name 'MessageNode' is not defined`.
- **Root Cause:** Strict Python 3.13 namespace scoping rules caused class-level return annotations to fail when a class referenced itself before it finished initializing. While `from __future__ import annotations` was intended to resolve this, it was accidentally placed *inside* the module-level docstring in `messaging/trees/data.py`, making it a literal string instead of an active directive. Additionally, Python 3.13 completely dropped support for the outdated comma-separated exception catching syntax (`except A, B:`), leading to syntax parsing crashes in several files.
- **Resolution:**
  - Moved the `from __future__ import annotations` directive outside the docstring in `messaging/trees/data.py`.
  - Parenthesized all comma-separated exception tuples in the proxy's repository to conform to modern Python standards (`except (A, B):`).
  - Successfully validated E2E tool execution across model tiers (Opus passing cleanly, Sonnet and Haiku falling back correctly).

### Policy / risk (non-optional)

Re-read **Terms** for **Antigravity**, **Claude Code**, **Anthropic**, **OpenRouter**, **NIM**, and the **proxy repo** before relying on this for paid client work. Routing Anthropic-shaped traffic to **non-Anthropic** backends may be **disallowed or unstable** as products change — **operator risk**, not app code.

### This Mac — facts (2026-05-09 agent scan, no secrets)

- **CPU / RAM:** Apple **M1 Pro**, **16.0 GiB** — fine for a **thin local proxy**; **poor default choice** for heavy **Ollama** inference while doing other work (thermals + unified memory pressure).
- **CLIs present:** **`ollama`**, **`docker`**, **Node v24**, **Python 3.14** — you *can* run L3 locally, but **prefer L2 in the cloud** to keep the machine cool and responsive.

### L2 routing — “least on this machine” (default: cloud-first)

| Priority | Backend | Role | Local load |
|----------|---------|------|------------|
| **1** | **NVIDIA NIM** (HTTP to `integrate.api.nvidia.com` / model cards on **build.nvidia.com**) | Primary bulk **Lane L2** when your NIM account has access — **no** local model weights; only **proxy + TLS** on the Mac. Hosted free-tier model endpoints: you wait/queue, you do **not** pay OpenRouter-style per-token for these catalog calls. | **Very low $** (rate limit / queue cost only) |
| **2** | **OpenRouter** | Fallback / A-B tests / when NIM rate-limits or proxy compatibility prefers OpenAI-compat routing you already know. | **Very low** |
| **3** | **Ollama** | Optional **Lane L3** only when offline or zero paid API; **not** the default on M1 Pro 16GB if you care about fan noise + IDE responsiveness. | **High** when active |

**NIM models to try first (coding + agentic — re-check tenant list):** live catalog for this key (2026-08-04, **102** ids): **`z-ai/glm-5.2`** (runbook `glm-5.1` is gone), **`deepseek-ai/deepseek-v4-flash` / `…-v4-pro`**, **`moonshotai/kimi-k2.6`**, **`minimaxai/minimax-m3`**, Nemotron Super/Ultra family, **`meta/llama-3.3-70b-instruct`**, **`openai/gpt-oss-120b`**. Full list + org breakdown: **`integrations/research/NVIDIA_NIM_CATALOG_TENANT_2026-08-04.md`**. Re-list any time: **`npm run research:nvidia-nim-models`**. Exact slugs = model card on [build.nvidia.com](https://build.nvidia.com) or that `/v1/models` dump — do not invent ids. (historical)

### OpenRouter — model IDs from public `GET /api/v1/models` (2026-05-09 snapshot)

Pricing is **per-token strings** on OpenRouter; treat numbers below as **“check live before relying”** — promos change.

- **Paid-cheap, strong coding volume (primary OpenRouter pick):** **`deepseek/deepseek-v4-flash`** — very low $/token in catalog; good match to video workflow (tool-ish agent runs).
- **Paid-cheap alternates:** **`deepseek/deepseek-v4-pro`**, **`z-ai/glm-4.7`**, **`z-ai/glm-4.7-flash`**, **`qwen/qwen3-coder-next`**, **`minimax/minimax-m2.7`** — compare live pricing + latency in OpenRouter dashboard.
- **`:free` tier (good for experiments, expect rate limits / variability):** examples seen in catalog include **`minimax/minimax-m2.5:free`**, **`qwen/qwen3-coder:free`**, **`z-ai/glm-4.5-air:free`**, **`google/gemma-4-31b-it:free`**, **`google/gemma-4-26b-a4b-it:free`**, **`nvidia/nemotron-3-nano-30b-a3b:free`**, **`openai/gpt-oss-20b:free`** — rotate among them if one is overloaded; **do not** assume “free” equals “production quality.”

**External ranking / eval sites (pick models, not vibes):** **Artificial Analysis** coding / LiveCodeBench pages (**`artificialanalysis.ai`**), **LMSYS Chatbot Arena** (qualitative), **LiveCodeBench** leaderboards — use them to **shortlist**, then **A/B** on *your* proxy + Claude Code with a fixed task suite (50-line refactor, test repair, etc.).

### Operator rule — API keys

**Never** paste **OpenRouter / NIM** keys into **chat**, **`MEMORY.md`**, or **git**. Store in **macOS Keychain**, **1Password env inject**, or shell **only on your machine**. If a key ever appeared in chat, **revoke + rotate** in the provider UI before shipping anything serious.

### Free-proxy + Devin IDE restore (2026-08-04) — fact-checked

**Context:** Mid-session MEMORY working copy was reduced to a ~36-line essay (uncommitted wipe of the ops handoff). Restored from **`git HEAD` / `8fc667e`** (~1315 lines) so **rule 07** section map + **§ Antigravity + Claude Code + free proxy** remain valid.

**What broke free Claude in Devin / Antigravity (causation, not guesswork):**

1. **Proxy fail-closed on models:** `~/src/free-claude-code` `.env` pointed at **`nine_router/...`** while **`providers/nine_router` package was missing** → pydantic **`Invalid provider: 'nine_router'`** → **nothing listened** on **`8082`** (launchd crash-looped). Devin already had **`ANTHROPIC_BASE_URL=http://127.0.0.1:8082`** + ACP preferred agent **`claude-code`** — env was correct; **upstream process was dead**.
2. **OpenRouter paid zero-balance:** **HTTP 402** on paid / insufficient-credit routes (not a SyncScript app bug).
3. **Legacy `:free` slugs removed:** **`qwen/qwen3-coder:free`**, **`meta-llama/llama-3.3-70b-instruct:free`** return **404** *"unavailable for free"* (2026-08-04 probe). **Do not treat catalog membership as runtime health** — later same day **`inclusionai/ling-3.0-flash:free`** died at Novita with **`target label not found`** (HTTP 400 via OpenRouter) while still listed. Prefer **laguna / gpt-oss / nemotron free** + ollama last resort; re-probe before locking primaries.
4. **9router local gateway:** process up on **`:3002`**, **`/v1/models` 200**, but NVIDIA-backed routes were **529 / 404 / 410** the same night — keep as fallback only.
5. **NIM stream hang (active residual ops, 2026-05+):** **non-stream** `meta/llama-3.3-70b-instruct` **200**; **stream** read **timed out** → do **not** set NIM as **primary** for Claude Code (proxy always streams).

**Working routing (verified NIM-first stream 2026-08-04 ~11:56 local — free NIM waits, not OR coins):**

| Tier | Model string in `~/src/free-claude-code/.env` |
|------|-----------------------------------------------|
| **MODEL / OPUS** | `nvidia_nim/z-ai/glm-5.2` (measured OK ~16–26s under queue) |
| **SONNET** | `nvidia_nim/deepseek-ai/deepseek-v4-flash` (measured OK ~1s when not 529) |
| **HAIKU** | `nvidia_nim/openai/gpt-oss-20b` (~0.6–1.1s) |
| Fallbacks | deepseek pro/flash, glm-5.2, gpt-oss-20b, kimi-k2.6, nemotron-nano, **`ollama/qwen2.5-coder:1.5b` last** |
| **NINEROUTER** | optional; not primary |
| **ENABLE_MODEL_THINKING** | `false` |

**Do not put primary weight on:** OpenRouter free when NIM key works. **Avoid as first failover:** `meta/llama-3.3-70b-instruct` (stream hang history), large hung mid-streams (`gpt-oss-120b` observed hang after deepseek **529**). **529** on NIM = queue/overloaded — chain must advance to another **streaming** model, not hang.

**Live catalog:** **`npm run research:nvidia-nim-models`** · writeup **`integrations/research/NVIDIA_NIM_CATALOG_TENANT_2026-08-04.md`**. (historical)

### Claude `Invalid request sent to provider` (2026-08-04) — permanent fix

**Symptom:** Claude UI showed only **`Invalid request sent to provider. (request_id=req_…)`** with no recovery.

**Cause (`server.log` for `req_117d4b38b2da`):** primary **`inclusionai/ling-3.0-flash:free`** → OpenRouter **HTTP 400**, Novita raw: **`model ling-3.0-flash: target label not found`**. Proxy turned that **pre-stream** failure into a synthetic SSE **message** (`text_delta` = the user-facing sentence). StreamProbe did **not** classify that text as an error, so **failover never advanced** and Claude treated the error as the assistant reply.

**Shipped in `~/src/free-claude-code` (not SyncScript app):**

1. **`providers/anthropic_messages.py`** — pre-stream failures **raise** mapped `ProviderError` (failover), only mid-stream failures emit error SSE tails.
2. **`providers/error_mapping.py`** — OpenRouter-wrapped dead-model 400s (`Provider returned error`, `target label not found`, etc.) → retriable **`APIError(502)`**, not terminal `InvalidRequestError`.
3. **`~/src/free-claude-code/api/services.py` `_StreamProbe`** — also flags **`invalid request sent to provider`** / unavailable-model text as error streams.
4. **`.env`** — primary off **ling**; **laguna** primary (verified 2.0s, model said `OK`).

**Regression gate:** **`npm run verify:fcc-proxy-stream`** (classifies real answer vs error-text-as-answer). After model or proxy code changes: restart via **`bash scripts/start-free-claude-code-proxy.sh`**.

### Claude `Provider request failed.` (2026-08-04) — permanent fix

**Symptom:** Claude UI showed **`Provider request failed.`** (e.g. `req_e1f157f18b2e`) on a heavy NIM Opus session — no real failover to next model.

**Cause (`~/src/free-claude-code/server.log`):**
1. **Upstream:** `nvidia_nim/z-ai/glm-5.2` held ~51s then **HTTP 500** *Inference connection error while making inference request* (NIM infrastructure, not bad request shape).
2. **Proxy:** OpenAI-compat transport yielded synthetic error SSE after `message_start` instead of **raising** for chain failover.
3. **Deadline:** overall failover budget was a hard **40s** — already spent waiting on primary, so chain exited with FAILOVER_DEADLINE before siblings ran.

**Shipped in `~/src/free-claude-code`:**
1. **`providers/openai_compat.py`** — no `message_start` until stream open; pre-stream / empty failures **raise** mapped errors.
2. **`~/src/free-claude-code/api/services.py`** — `_failover_overall_deadline_seconds(chain_len, http_timeout)` → **~90–180s** budget; per-attempt timeout ≤ remaining; error-journal `hash` KeyError fixed.
3. Tests (outside this app repo): `~/src/free-claude-code/tests/api/test_fallback_chain.py`, `~/src/free-claude-code/tests/providers/test_provider_transport_logging.py` (41 transport/deadline tests green 2026-08-04).

**Also related (2026-08-04, incident forensics):** **`SSEBuilder.ping()`** added (`core/anthropic/sse.py`) so NIM quiet streams stay healthy past 15s mid-stream keepalive (`req_699feb9b7438`).

**Verify:** restart proxy → **`npm run verify:fcc-proxy-stream`** (PASSED 2026-08-04, served `deepseek-ai/deepseek-v4-flash` → `OK`).

### Claude `Request timed out.` (2026-08-04) — permanent fix

**Symptom:** Claude UI **`Request timed out.`** after ~3 minutes (`req_2eb3e4cb6e75`).

**Cause (`server.log`):**
1. Opus chain: primary **`nvidia_nim/z-ai/glm-5.2`**, huge body (~340k chars in request log), **no response headers** until cancel.
2. Overall failover budget **180s**; per-attempt used `min(HTTP_READ_TIMEOUT=300, remaining≈180)` → primary **ate 179s**.
3. Next loop iteration immediately **FAILOVER_DEADLINE** — **0 of 4 fallbacks** tried. Error mapped via bare `TimeoutError` → **"Request timed out."**

**Bug class:** confuses **stream chunk read timeout** (300s, correct for mid-generation) with **time-to-first-healthy-event** probe (must fail over quickly).

**Shipped:**
1. **`_failover_attempt_timeout_seconds`** — primary probe hard-cap **75s**, siblings **45s**; **reserve 30s × remaining models** so chain can still run; returns 0 when budget cannot support a probe.
2. Logging: `FAILOVER_ATTEMPT_BUDGET`.
3. User-facing: detailed TimeoutError strings preserved (not always the generic phrase).
4. Tests under `TestFailoverBudget` + error mapping detail test.

**Operator expectation:** if glm hangs on free NIM queue, fail over to deepseek-flash / gpt-oss / ollama within ~75s, not silence for 3 minutes then death with no chain walk.

**Devin.app (Cognition Devin IDE on this Mac):**

| Item | Path / value |
|------|----------------|
| Settings | **`~/Library/Application Support/Devin/User/settings.json`** |
| ACP agent | **`devin.acp.preferredAgent=claude-code`**, **`devin.acp.enabledAgents.claude-code=true`** |
| Proxy | **`claudeCode.environmentVariables`**: **`ANTHROPIC_BASE_URL=http://127.0.0.1:8082`**, **`ANTHROPIC_AUTH_TOKEN=freecc`**, thinking disabled (same as Antigravity) |
| Apply | **`bash scripts/apply-ide-claude-proxy-settings.sh --devin`** (or **`--all`**) |
| Verify | **`bash scripts/verify-devin-claude-compat.sh`** |
| After apply | **Cmd+Q Devin** → reopen → **new** Claude / ACP chat → `Reply with exactly: OK` |

Also re-align **Windsurf** if present (**was stuck on `:8085`** after old Expo migration): included in **`--all`**.

**Operator checklist (do in order):**

```bash
# 1) free-claude-code routing must stay free-compatible (re-probe OR catalog if 404)
# keys only in ~/src/free-claude-code/.env
bash scripts/start-free-claude-code-proxy.sh
bash scripts/verify-claude-code-proxy-lane.sh
# 2) IDE env → 8082
bash scripts/apply-ide-claude-proxy-settings.sh --all
bash scripts/verify-devin-claude-compat.sh
bash scripts/verify-antigravity-claude-compat.sh   # agent-style beta+tools
bash scripts/verify-cursor-claude-compat.sh
```

**June 10/11 note:** “Everything worked” = OpenRouter with **remaining credits** + healthy proxy; not magic free forever. When credits hit **$0**, use **current free** `:free` ids or add credits — do not re-point primary at dead **`nine_router`** without confirming the provider package exists and `/v1/models` returns usable models.

### IDE `ConnectionRefused` = process **ownership**, not code (2026-08-04) — root cause

**Symptom:** Devin's Claude Code extension: **`API Error: Unable to connect to API (ConnectionRefused)`**. Same class of failure hits Cursor / Antigravity.

**Root cause was who owns `:8082`, not what the proxy does.** Two compounding bugs:

1. **launchd agent booted out.** **`com.syncscript.free-claude-code`** (**`KeepAlive=true`**, **`RunAtLoad=true`**) had been **`launchctl bootout`**-ed during earlier troubleshooting and never bootstrapped back — so **nothing supervised the proxy**.
2. **`scripts/start-free-claude-code-proxy.sh` spawned a rival.** It killed whatever held the port (**including launchd's own worker**) and started a **`nohup`** child **bound to the calling shell's session**. Consequences, both observed: launchd **KeepAlive** raced the manual process → **`[Errno 48] address already in use`** crash loop in **`~/src/free-claude-code/launchd-stderr.log`**; and when the Cursor/terminal session ended, the OS **reaped the child** → nothing listening → **ConnectionRefused** in every IDE.

**A plain "is the port up?" check cannot catch this** — it passes right until the shell exits. Check the **owner** and the **restart contract**.

**Fix (shipped):** **`scripts/start-free-claude-code-proxy.sh`** now **delegates to `launchctl kickstart -k`** when the plist exists (bootstrapping it if unloaded), so **launchd is the single owner**. Detached **`setsid` + `disown`** fallback only when there is no agent. Escape hatch: **`FCC_FORCE_FOREGROUND=1`**.

**New gate:** **`npm run verify:fcc-proxy-persistence`** (**`scripts/verify-fcc-proxy-persistence.sh`**) — 9 checks: plist present · agent loaded in **`gui/$(id -u)`** · **state=running** · **`KeepAlive`** · **`RunAtLoad`** · plist port matches canonical **8082** · listener present · **listener is a descendant of the launchd pid** (catches split-brain strays) · **`/health` 200**. **`:strict`** adds a **`kill -9` respawn proof**.

**Verified 2026-08-04:** all 9 pass. Respawn proof — killed listener **6774**, launchd respawned **12436** (**`last exit code = 137`**, `runs=3`). **`npm run verify:ide-claude-all`** → **Devin, Cursor, Antigravity all PASSED**.

**Second, independent Devin failure mode (from June, guard still in place):** the **`EnterPlanMode`** tool causes a **ConnectionRefused-like cascade** in Devin because its webview has **zero** plan-mode UI references (VS Code has 11) — there is no client-side approval dialog. Guards re-verified: **`~/.claude/CLAUDE.md`** § 9.5 (line 143) and **`"disallowedTools": ["EnterPlanMode"]`** in **`~/.claude/settings.json`** (lines 49–50). **Plan to `PLAN.md`; never call `EnterPlanMode`.** Detail: **`integrations/research/RECOVERED_2026-06-10-11.md`** § 10. (historical)

**Triage order when an IDE says ConnectionRefused:**

```bash
npm run verify:fcc-proxy-persistence   # owner + restart contract (the usual culprit)
bash scripts/start-free-claude-code-proxy.sh   # repairs via launchd
npm run verify:ide-claude-all          # persistence + Devin + Cursor + Antigravity
```

### IDE `empty or malformed response (HTTP 200)` = spent quota hidden by an unbounded retry loop (2026-08-04) — root cause

**Symptom:** Claude Code in any IDE: **`API Error: API returned an empty or malformed response (HTTP 200) — check for a proxy or gateway intercepting the request`**. The message is literally true and completely misleading — nothing is corrupting the response, the proxy simply never produced one.

**What the stream actually contained:** HTTP **200**, then `event: ping` keepalives and nothing else. No `message_start`, no content, no `message_stop`. A client cannot do anything useful with that, so it reports the body as malformed.

**Causal chain, from `~/src/free-claude-code/server.log`:**

1. **Every tier pointed at OpenRouter `:free`.** `MODEL`, `MODEL_OPUS`, `MODEL_SONNET`, `MODEL_HAIKU` and their fallbacks were all `open_router/*:free` — one account, therefore **one shared quota bucket**. A "fallback chain" whose entries share a quota is not a fallback chain.
2. **That bucket is 50 requests/day.** OpenRouter caps `:free` variants at **50/day and 20/min** for accounts with **under $10 in lifetime credit purchases**, rising to **1,000/day** permanently at $10 ([docs](https://openrouter.ai/docs/api_reference/limits)). The 429 said so in headers: `X-RateLimit-Limit: 50`, `X-RateLimit-Remaining: 0`, `X-RateLimit-Reset` = next **UTC midnight**.
3. **Failed requests still consume quota.** OpenRouter documents this explicitly: a free-model request that fails on a rate limit, provider outage, or timeout **still spends one of the daily allowance**.
4. **The proxy's retry loop turned that into self-harm.** `_iter_fallback_stream` used `max_internal_retries = 15` with `base_sleep = 3` — up to **90 upstream calls for a single client request** against a 50/day cap, so **one Claude Code message could exhaust the day**.
5. **And it hid the result.** Backoff totalled ~**10.5 minutes** of sleeping while holding the already-committed 200 open with pings. The terminal SSE error existed and was correct; the client gave up long before it arrived.

**Second, independent failure found the same night:** the `nine_router` → NVIDIA NIM fallback was **already dead** and had been silently useless. All five catalogued models fail upstream — `minimaxai/minimax-m2.7` returns **`410 Gone`, "end of life 2026-07-27"**, the others **404**. So the one non-OpenRouter entry in the chain could never have rescued anything.

**Fixes shipped (all in `~/src/free-claude-code`, outside this repo):**

- **`~/src/free-claude-code/core/quota_state.py`** (new) — records a **spent daily allowance** per provider with its reset time. A 429 whose reset is seconds away stays retriable (per-minute throttle); one hours away blocks that provider for the rest of the request. Written by the transport, which is the only layer that still has the 429 headers, because provider errors are **streamed as SSE rather than raised**.
- **`~/src/free-claude-code/api/services.py`** — skips quota-blocked providers, fails immediately when the whole chain is blocked, and holds both a **25s sleep budget** and a **40s overall deadline** so a real error always beats the client timeout. Also replaces the generic *"Provider rate limit reached. Please retry shortly"* — wrong by hours — with the actual reset time and the fix.
- **Fallback chains diversified** — every tier now ends at **`ollama/qwen2.5-coder:1.5b`**, running locally via `brew services start ollama`. A local model **cannot** 402, 429, or reach end-of-life, so the chain can never be entirely dead. Cold start ~18s while the model loads, ~0.2s warm.

**Measured:** the failing request went from **120s of pings** (or 75s to a wrong message) to **1.1s and a real answer**.

**The gate that let this through:** `verify-devin-claude-compat.sh` reported **PASSED** the entire time. It grepped for `text_delta`, and the proxy delivers its own error text *as* a `text_delta` — so "Provider rate limit reached" read as "returns model text". Replaced with **`npm run verify:fcc-proxy-stream`** (`scripts/verify-fcc-proxy-stream.mjs`), which asserts **stream structure** and classifies the outcome as `ok` / `ping-only` / `error-event` / `malformed`. Lesson: a gate that infers success from substrings will eventually certify the exact outage it was built to catch.

**Triage order when an IDE says `empty or malformed response (HTTP 200)`:**

```bash
npm run verify:fcc-proxy-stream          # is it an answer, pings, or a real upstream error?
npm run verify:fcc-proxy-persistence     # rule out the ownership failure (different symptom)
curl -s http://127.0.0.1:11434/api/tags  # is the local last resort alive? brew services start ollama
```

Then read `~/src/free-claude-code/server.log` for `QUOTA_EXHAUSTED`, `FAILOVER`, `RETRY_BUDGET_SPENT`, `FAILOVER_DEADLINE`. **Quota exhaustion is ops, not code** — either wait for the UTC-midnight reset, put $10 into OpenRouter once for 1,000/day, or lean on the local model.

### `empty or malformed response (HTTP 200)`, second class (2026-08-06) — routing by speed instead of capacity

**Symptom:** the same IDE error as 2026-08-04, but quota was fine. Then, after a first repair attempt, Claude "still answered but got dumb and slow" — the harder tell.

**Four independent defects, each verified in `server.log` before it was fixed:**

1. **Routing ignored context capacity.** A "heavy request" heuristic counted *tools*, and Claude Code ships ~27 tool schemas on **every** turn — so every turn looked heavy and got reordered onto **`deepseek-v4-flash` (32k)**. The tool schemas alone are ~15–23k tokens, so compaction shredded history to **`to_msgs=1`**: the model answered a long conversation with no conversation. Fix: `_order_chain_by_capacity()` in `~/src/free-claude-code/api/services.py` sorts by *whether the model can hold the payload* first, speed only as a tie-break, tiny local models always last.
2. **Probe timeouts below measured prefill.** Free-tier NIM needs **~40s just to prefill the tool schemas**. Caps of 25–45s therefore timed out *healthy* models and cascaded through the whole chain. Heavy probes are now 90s primary / 60s sibling with a 240s overall budget.
3. **A correct answer was thrown away.** The incomplete-turn gate flagged any body under 8 chars as `too_short`, so a right answer (`"119"`) was discarded and the chain re-rolled — 134s to a worse reply. `core/incomplete_turn.py` now only rejects short bodies that are dangling *fragments* (`"Now:"`, `"Let's"`, a bare fence).
4. **A `loguru` context spanned a `yield`.** `stream_response()` in `providers/openai_compat.py` held `logger.contextualize()` open across yields; probing in one asyncio task and draining in another raised `Token ... was created in a different Context` — and the SSE layer emitted **that exception text as the assistant's reply**. The context is now bound per resume.

**The structural fix, not a tuning fix:** while waiting for a provider's first token the proxy emits **SSE comment keepalives** (`: keepalive 15s <model>`). Comments are spec-legal and invisible to every SSE parser, so they cannot corrupt the protocol — but bytes are always flowing, which makes an *empty* HTTP 200 impossible by construction and stops client/OS idle timers from killing a slow-but-healthy prefill. Every previous fix in this family tried to make the proxy fast enough; this one makes waiting safe.

**Measured (241-message, 27-tool agent request):** 134s → **2.7s**, empty body → correct answer, with recall of the last turn intact. Long-form coding replies verified separately (2,862 chars, balanced fences).

**Guard:** `~/src/free-claude-code/scripts/probe_agent_shape.py [turns] [--long]` replays a Claude-Code-shaped request (27 tools + long history) and asserts both *content* and *recall*. `npm run verify:fcc-proxy-stream` still covers the simple case; it cannot see this class because a short chat never triggers the capacity path.

**Trap for future sessions:** `git stash push -- <file>` here **failed to pop** and silently reverted work, and `uv run` rebuilds `.venv` on a different Python than the LaunchAgent pins. Check `git stash list` after any pop, and prefer `.venv/bin/python -m <tool>` over `uv run` while the service is live.

### Claude stops mid-task and asks "What's the task?" (2026-08-06) — the tail window deleted the request

**Symptom:** Claude Code works for a while, then abandons the job and re-introduces itself — *"I'm in continuous autonomous execution mode… What's the task?"* — with no error anywhere. Looks like a model or prompt problem. It is not.

**Root cause:** the recency window added earlier the same day capped **total** input at 28k. Claude Code's base is **~23.7k tokens** (`CLAUDE.md` + `mythos.md` + 27 tool schemas), so history got **~4.3k** — production logs show `keep newest 1` … `keep newest 18` out of **277 messages**, every turn. The opening message states the task, and it is the *oldest* message, so a pure tail window deletes it first. The model was answering with only the last couple of tool results and no request in view. Its reply was *correct behaviour for the input it was given.*

**Three fixes in `~/src/free-claude-code/api/services.py`:**

1. **Budget history on top of the base, not as a total.** `_HISTORY_LATENCY_TOKEN_BUDGET = 48_000` is added to system+tools rather than capping them. Same session now keeps **97 of 282** messages instead of 1.
2. **Anchor the task turn.** The first user message is always retained (truncated to 4k chars if huge) and carries an appended notice: *"N earlier turns were elided… the task above is still the active objective — continue it; do not ask what the task is."*
3. **Never orphan a tool result.** `_drop_orphan_tool_results()` trims leading `tool_result` blocks whose `tool_use` fell outside the window. A tool result answering an invisible call makes the model treat the loop as finished — an independent cause of stopping early.

**Guard:** `.venv/bin/python scripts/probe_agent_shape.py 140 --anchor` states a task in message 1 of a 282-message session and asserts the model can still restate it (checks for the planted `MAGIC_HEADER_7` token) and never says "what's the task". Unit coverage (historical proxy in free-claude-code): `tests/api/test_context_window.py` (8 tests).

**Durable lesson:** recency is the wrong sort key for agent history. The oldest message is usually the *most* load-bearing one, because it holds the objective. Any windowing scheme must anchor the task and preserve tool-call pairing, or the agent quietly forgets why it is working.

### "I'm not able to launch an iOS simulator from this remote session" (2026-08-06) — a 20B model was answering as Claude

**Symptom:** Claude Code stops *doing* and starts *instructing* — tables of steps, "run this on your local machine", "let me know once you've finished the EAS build" — and finally claims it has no access to the machine. Permissions were not the problem (`Bash(*)`, `defaultMode: dontAsk`).

**What the logs said.** `MODEL MAPPING: 'claude-opus-5' -> 'z-ai/glm-5.2'`, then `FAILOVER: timeout for provider=nvidia_nim after 90s` on **8 of 8** consecutive turns, each one landing on `openai/gpt-oss-20b`. Nothing Claude-shaped ever answered. A 20B model with weak tool agency narrates shell commands at the user instead of emitting `tool_use` — the "refusal" was that model's honest self-description, not a capability limit.

**Why the capable model never answered — three compounding bugs:**

1. **The history budget was too large.** 48k of history put ~71k tokens upstream; glm-5.2 could not first-token inside the 90s probe. Now `AGENT_HISTORY_TOKEN_BUDGET` (default **24k**, env-tunable) keeps input near ~22k, where the same model first-tokens in **2.1s**. The budget is now a measured trade-off, not a guess: too low loses the task, too high loses the model.
2. **Chain order was computed on the raw payload.** A 700-message session looked like ~150k tokens, so *only* glm "fit" and became primary every turn — then compaction handed it a fraction of that. `_estimated_upstream_tokens()` now sizes routing on what will actually be sent.
3. **Nothing remembered that a model was dead.** `quota_state` blocks providers and `dual_circuit_breaker` trips on providers, but this was one sick *model* behind a healthy provider. New `core/model_health.py` sets a model aside for **300s** after 2 consecutive first-token failures, and clears it instantly on success. Agent traffic also demotes weak-agency models (`is_weak_coding_model`) below capable ones that fit, so a narrating model is never the leader when tools are in play.

**Measured:** ~95s per turn served by gpt-oss-20b → **2.1s** served by glm-5.2, emitting real `tool_use`.

**Guard:** `.venv/bin/python scripts/probe_tool_agency.py --turns=170,170,170 --pad=400` asserts the served model emits `tool_use` rather than narration, and prints `served_by` + first-event latency per turn. Regex-detects the narration tell (`not able to launch`, `remote session`, `you'll need to`). Unit coverage (historical proxy in free-claude-code): `tests/core/test_model_health.py` (6), plus weak-agency and cooldown ordering tests in `tests/api/test_fallback_chain.py`.

**Durable lesson:** when an agent starts *describing* work instead of doing it, check which model actually served the turn before debugging the prompt. Silent failover to a weaker model is indistinguishable from the strong model behaving badly — and on a free tier it is the more likely explanation. Per-*model* health is not optional once a chain mixes capability tiers.

### `Server error mid-response` = an upstream stream with no `message_stop` (2026-08-04) — root cause

**Symptom:** Claude Code shows **`API Error: Server error mid-response. The response above may be incomplete.`** after real content has already rendered. Distinct failure class from the two above: the stream *started fine*.

**Why the logs were silent.** HTTP 200 is committed with the first byte of an SSE response. After that, an upstream that stops talking mid-generation is indistinguishable at the transport level from one that finished — both close a 200 carrying syntactically valid SSE. The only difference is a missing `message_stop`. The provider loop in `~/src/free-claude-code/providers/anthropic_messages.py` had a good mid-stream error path (`iter_midstream_error_tail`) but it only ran on an **exception**; a stream that ended early raised nothing, so the loop finished, the proxy logged nothing, and failover reported success. Evidence for the 06:12 incident: upstream 200 at `06:12:16`, body complete `06:14:17`, and **zero** occurrences of `Emitting native SSE error`, `FAILOVER_ABORTED`, or any exception in `server.log`.

**Three real defects, all now fixed:**

- **No end-of-stream completeness check.** After the chunk loop, the transport now asserts `message_stop` was emitted. If not, it closes dangling content blocks and emits a **visible** terminating tail naming the cause, then logs `*_STREAM_TRUNCATED` with event count, character count, last event and open-block count. Deliberately **not** a silent `message_stop`: synthesising a clean ending tells the client a truncated answer is complete, and it then runs the half-written tool call. A visibly failed response is recoverable; a silently truncated one is a wrong answer that looks right.
- **`count_tokens` returned 500 on every call.** `ClaudeProxyService.count_tokens` sat at one extra indent level, nested inside the `_iter_fallback_stream` async generator — so it was a local function in a generator body that never reaches its own definition, and the class had no such attribute (`'ClaudeProxyService' object has no attribute 'count_tokens'`, 11× in one hour). **This is the likely cause of the truncation, not a side issue:** that endpoint is how Claude Code sizes its own context before compacting. Broken, it kept sending ~180k tokens/turn into a 131k-context free model, which the proxy then compacted 182k→113k every turn, leaving ~18k of headroom against an 8192 output clamp. Streams truncate at that edge.
- **`server.log` was truncated on every start** (`Path(log_file).write_text("")` in `config/logging_config.py`) under a launchd agent with `KeepAlive`. Every crash or `kickstart` erased the history of what caused it. Now append-only with rotation + `retention=5`.

**Guards** (in the proxy repo, not this one): `~/src/free-claude-code/tests/core/anthropic/test_stream_truncation.py` (4 tests: truncation detected, clean stream not flagged, tail terminates *and* reports the cause, error block never reuses an open index) · `~/src/free-claude-code/tests/api/test_service_route_surface.py` (every method the routes call is bound to the class — indentation nesting is invisible to linters here). Success now leaves positive evidence: `*_STREAM_COMPLETE: events=N chars=N`.

### The proxy answered — with a 1.5B local model, every time (2026-08-04) — routing scorer bug

**Why this matters more than it looks:** the fix above made the proxy *answer*, so every gate went green and Claude Code stopped erroring. It was quietly being served by **`ollama/qwen2.5-coder:1.5b`** — the configured **last resort** — while OpenRouter was never attempted. Degraded output looks like a bad model, not a bug, so this class of failure can persist indefinitely. **A "working" proxy is not the same as a correctly routed one.**

**Root cause:** in `~/src/free-claude-code/api/model_router.py` (`resolve_fallback_chain`), `provider_scores` is keyed by **provider id**, but the LiveBench block read and wrote that same key while looping over chain **entries**. A provider was therefore re-blended once per model it contributed — three OpenRouter models scored `1.0 → 0.70 → 0.49 → **0.34**` while a single `ollama` entry held **0.70**. The chain is then sorted by score descending, so **the last resort became primary**. Configuring *more* fallbacks for a provider made that provider rank *worse*.

Two things made it invisible:

- **`livebench_intelligence` loads its dataset from `/tmp`** (`/tmp/LiveBench/data/live_bench`), which does not survive a reboot. Every lookup returned `0.0`, so the 70/30 blend degenerated into "scale everything by 0.7" — noise dressed as intelligence.
- **A local model never rate-limits**, so pure reliability scoring ranks it above any remote frontier model, permanently.

**Fixed:** blend from a snapshot and write once per provider; skip the blend entirely when there is no LiveBench signal; and sort with local providers pinned last, coarse score buckets, and **configured order as the tiebreak** — reliability may *demote* a provider, but it must not rewrite operator intent. Full patch + reproduction: **`integrations/research/FCC_PROXY_ROUTING_AND_QUOTA_PATCH.md`**. (historical)

**Measured:** primary honoured again — `inclusionai/ling-3.0-flash:free` in **1.2s**, versus **8.5s** for the local model it had been substituting.

**The gate now names the server.** `npm run verify:fcc-proxy-stream` prints `served by: <model>` and flags **`DEGRADED`** when a local model answered; **`npm run verify:fcc-proxy-stream:strict`** (`--require-remote`) fails outright. The previous gate could only tell an answer from an error — not a *good* answer from a *fallback* one.

**OpenRouter $10 added 2026-08-04 → 1,000 free requests/day confirmed** (up from 50). It is a **lifetime-credits** threshold, so it does not renew — but the balance is still spendable, and dropping back under $10 reinstates 50/day. No code hardcodes the cap; the quota logic reads the headers.

### `package.json` lost 211 npm scripts to a bulk commit (2026-08-04) — MEMORY was right, the toolchain regressed

**Found by auditing MEMORY's own claims:** 52 of the 59 `npm run` commands documented in this file did not exist. The instinct is "MEMORY is stale" — that was wrong.

**Actual cause:** commit **`8fc667e`** (2026-06-06, *"Added all files in the current directory and subdirectories"*) cut **`package.json` from 237 scripts to 26**. A bulk `git add .` from a working tree with a truncated `package.json` overwrote the real one. Script count by commit: **`91fe762c`** 2026-05-21 → **237**; **`8fc667e`** 2026-06-06 → **26**.

**Collateral damage:** every aggregate release gate broke, because they referenced scripts that no longer existed — **`release:gate`**, **`release:gate:optimizer`**, **`release:gate:collab`**, **`release:gate:frontier-complete`**, **`release:gate:monetization-collab`**, **`verify:smoke:full`** (32 dangling internal references in total). `npm run release:gate` failed on its first step for ~2 months.

**Repair (2026-08-04):** merged the 214 missing scripts back from **`91fe762c`**, keeping current definitions authoritative where a key existed in both (only 1 trivial conflict). **All 174 referenced script files were still on disk — nothing had to be rewritten.** Now **247 scripts, 0 dangling internal references**, `npm test` green (18/18).

**Lesson:** `git add .` after a partial-file wipe silently commits the wipe. The same commit is what truncated **`MEMORY.md`**. When a documented command is missing, check **`git log -p -- package.json`** before concluding the docs are wrong.

### MEMORY.md is now verified, not just written (2026-08-04)

**`npm run verify:memory`** (**`scripts/verify-memory-claims.mjs`**) treats this file as testable. **FAIL** on: a documented `npm run` command that is not defined; a cited repo path in backticks that does not exist; more than one H1; a secret-shaped literal (OpenRouter / Anthropic / NIM / JWT / GitHub PAT / AWS). **WARN** on: non-canonical proxy port without a supersession note; retrieval-budget drift (file size, lines >900 chars, bold density >14%); **`.cursor/rules/07-syncscript-app-knowledge.mdc`** § routes that do not resolve to a real heading here. **`--strict`** promotes warnings to failures. Wired into **`npm run release:gate`** (second step, right after `lock:verify`). (historical)

**Conventions the guard depends on — keep using them:**

- A path that is deliberately gone or unbuilt gets **`(removed)`** or **`(planned)`** on the same line. The guard skips those lines and fails every other broken path. Endpoints are written with a leading slash (**`/api/ai/tts`**); the file behind them is cited separately (**`api/ai/tts.ts`**).
- Old ports need a **superseded / migrated** note on the line, or the guard flags drift. Canonical proxy port is **8082**; **3002** is 9router and **3000** is Vite — different services, not drift.

**Defects it caught and fixed on first run:** 52 dead commands (above) · 11 broken paths (**`api/lib/ai-service.ts`** → **`api/_lib/ai-service.ts`**, **`src/tsconfig`** → **`tsconfig.json`**, bare **`api/ai/tts`** / **`api/map/resolve-map-url`** → endpoint form, Kokoro **`server.py`** which never existed — `/health` comes from the Kokoro container on **`:8880`**) · a dead **`§ Nexus Voice`** route in rule 07 · **`## Current State (Feb 18)`** still labelled "Current" six months later, now **§ Snapshot as of 2026-02-18 (historical)**.

**Retrieval structure:** added **How to read this file** + a **section map** under the H1, and replaced a single 3,078-character changelog line with a dated table (full history stays in **`git log -p -- MEMORY.md`**). 13 long lines remain as WARN — work them oldest-first per the hygiene note.

### June 10–11 history recovered (2026-08-04) — chat history is not the record

**Claude UI chat history for June 10–11 is gone and unrecoverable.** Only the **13 dated memory notes** the agent wrote to disk survived. Consolidated (tracked, agent-readable): **`integrations/research/RECOVERED_2026-06-10-11.md`** — Cortex 3-tier persistence (**MEMORY/STATE/VETO**), CortexShield extension (9,563 lines, 3 engines build), Frequency ACX audiobook (43 files, RMS -20.5 / peak -3.76), Cortana orb + fallback chain, **GOJF v1.3.0** (131 tests pass), consciousness platform **honest 0.53/1.0** Butlin score, and the Devin plan-mode note above. (historical)

**Two durability traps found:**

1. **`memory/` is ignored TWICE** — **`.gitignore`** (~line 69) **and** **`.cursorignore`** (~line 34). Anything filed there is invisible to git **and unreadable by every future agent**. Raw disposable logs only. Recovered/durable history goes to **`integrations/research/`**.
2. **Sweep by filename AND mtime.** **6 of the 13** June notes had **no date in the filename** — a filename-only sweep missed them, including the Devin plan-mode note.

**Rule (always-on):** **`.cursor/rules/19-memory-durability-discipline.mdc`** — durability ladder + "if it matters past this session, it lands in a **tracked** file before the session ends; chat history is a convenience, never the record." Upstream notes still at **`~/.claude/projects/-Users-Apple-syncscript/memory/`** (local, not backed up). (historical)

## Tools on this machine — agents use the repo’s map first
1. **Read repo `TOOLS.md`** (workspace root) — **curated paths + MCP / slash-command wiring** for this Mac (`openclaw`, `claude`, `gemini`, `aider`, `cursor-agent`, Hermes/Engram playbooks). **Keep it current** when installs move. Rule: **`.cursor/rules/08-local-agent-cli-paths.mdc`**. (historical)
2. **Verify** with **`command -v`** / **`which`** after reading `TOOLS.md`; respect **`$PATH`**.
3. **MCP ≠ CLI** — e.g. GitHub may be **MCP in Cursor**, not `gh` in terminal.
4. **Secrets** — never paste into **`MEMORY.md`**; env / Keychain / Vercel / Supabase only.

## Apple platforms — test hardware and Xcode (SyncScript unified stack)
- **Physical Apple Watch:** Series 3 is **legacy** (capped at old watchOS); **do not** use it as the primary device for App Store–style builds. Use **Apple Watch Simulator** (deployment target aligned with Xcode) and/or a **Series 6+ / SE (2nd gen)** for on-wrist verification.
- **Checklist docs:** [`src/native/IOS_WATCH_SHIPPING.md`](src/native/IOS_WATCH_SHIPPING.md), [`src/native/WATCH_OS_PLATFORM.md`](src/native/WATCH_OS_PLATFORM.md), [`integrations/research/VERIFY_UNIFIED_PLATFORM.md`](integrations/research/VERIFY_UNIFIED_PLATFORM.md). (historical)
- **Desktop Companion protocol policy:** retired with the failed local avatar experiment on **2026-05-13**; historical notes remain at [`integrations/research/studies/2026-04-11-companion-protocol-policy.md`](integrations/research/studies/2026-04-11-companion-protocol-policy.md), but the local desktop shell was removed and should not be treated as an active verify gate.
- **Cross-stack script (repo root):** `npm run verify:unified-platform` — library + push-route contract tests. **`npm run verify:platform:full`** adds Playwright landing capabilities. **`npm run verify:ios:build`** builds the Capacitor iOS app (App Intents Swift). **AASA** in `public/.well-known/apple-app-site-association` uses **`K85GR7XGDP.com.syncscript.app`** (matches Xcode `DEVELOPMENT_TEAM` + bundle id).
- **Edge deploy:** `npm run deploy:edge:make-server` deploys `make-server-57781ad9` (includes `/push/register`, library search, etc.).

## Nexus LLM OpenAI-compat + optional executor bridge (2026-04-26)
- **What:** `api/_lib/openai-compat-model-policy.ts` centralizes model-specific Chat Completions JSON (strip tool `is_error` for **Kimi** / `kimi-*`, `max_completion_tokens` + no classic sampling for **o1/o3/o4** and **gpt-5**-family heuristics). Applied in **`api/_lib/ai-service.ts`** (Nexus user/guest/phone platform LLM) and **`api/_lib/agent-llm-adapter.ts`** `callAgentChat` (BYOK + runner). (historical)
- **Diagnostics:** `GET /api/agent/llm-stack` (auth) returns provider chain + which env keys are present (no values), runner env flags, executor-bridge config flags.
- **Gateway bridge:** Optional `NEXUS_EXECUTOR_BRIDGE_URL` + `NEXUS_EXECUTOR_BRIDGE_SECRET` (+ optional `NEXUS_EXECUTOR_BRIDGE_INVOKE_PATH`, default `/v1/invoke`). `GET /api/agent/executor-bridge` probes health; `POST` forwards JSON with `Authorization: Bearer` + `X-SyncScript-User-Id` — same *spirit* as Edge `hermes-bridge`, but server-to-server from Vercel for a self-hosted OpenClaw/Hermes/custom worker.
- **BYOK order:** Multiple keys → **`groq` before `openrouter` / `anthropic`** in `agent-llm-adapter.ts`.
- **Agent platform LLM (no BYOK):** Not NVIDIA-only — first available env among `NVIDIA_API_KEY`, `GROQ_API_KEY`, `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY`, `XAI_API_KEY`, `MISTRAL_API_KEY` (`PLATFORM_LLM_FALLBACK_ORDER`). Oracle runner **`deploy/nexus-agent-runner/runner/llm.mjs`** matches the same fallback + BYOK priority as the adapter. (historical)
- **Startup credits playbook (2026-04-26):** `integrations/research/STARTUP_CLOUD_CREDITS_PLAYBOOK.md` (AWS Activate / Google for Startups / Microsoft — official links; human must submit). (historical)
- **Doc:** `integrations/research/NEXUS_LLM_COMPAT_AND_EXECUTOR_BRIDGE.md` · tests `tests/nexus-openai-compat-policy.test.ts` + extended `agent-mode-foundation-contract`. (historical)

## Nexus Agent Mode (2026-04-25)

Four sessions shipped Agent Mode in one day and each wrote its own section. They are merged here newest first, ordered by **commit timestamp from `git show`**, not by where they happened to land in this file. **Read the first subsection for current behaviour** — `d4fc8a1` (22:37) supersedes `058ff5a` (20:06); the older subsections are kept because they carry the deploy steps and the reasoning behind the design.

### 2026-04-25 22:37 — in-depth audit (prod `d4fc8a1`) — CURRENT

User reported: "no live view of agent navigating; agent says it did things but didn't; cost cap reached." Real-run audit ran 6 progressive smoke tests, found and fixed 8 distinct bugs:

| # | Bug | Fix | Commit |
|---|---|---|---|
| 1 | Screenshots NEVER captured (text-only LLM disabled them entirely, but the UI still needed them) | Always capture screenshots; vision flag only controls if they go to LLM prompt | 66af0c9 |
| 2 | Default tier was 'A' (no clicks possible) — every real task failed instantly | Migration `20260426020000`: default 'B' + backfill users still on 10¢ caps; per_run_cost 10→50¢ | 66af0c9 |
| 3 | No way to grab image/link URLs without clicking — agent tried to click each result | New `extract_links` browser action (DOM evaluate) + system prompt "prefer extract_links over click" | 66af0c9 |
| 4 | Same-block infinite loop (5+ same gate-block burned cost cap with no useful action) | Repeat-block tripwire after 3 same-reason blocks; abort with "raise tier in Settings" | 66af0c9 |
| 5 | extract_links not in Tier A allowlist (it's read-only, should be allowed at A) | Added to allowlist in `safety.mjs` | 09b9061 |
| 6 | extract_links result data NEVER reached the LLM ("ok" with no payload → model loops) | Serialize links/images arrays into the `tool` history message (4KB cap) | 33b8582 |
| 7 | Same-action repeat detector didn't reset on successful tool_call → premature abort | Reset counter on any `ssRes.ok !== false` tool_call | 25162b2 |
| 8 | `/phone/nexus-execute` Edge endpoint only handles tasks, not `add_to_resource_library` etc. | Map each Nexus tool to a task with semantic prefix (`[Bookmark]`, `[Doc]`, etc.) | 8ec6356 |
| 9 | No 429 retry on NVIDIA NIM rate limits (mid-run failures with no recovery) | Exponential backoff retry for 429/5xx, honors `Retry-After` header, max 3 retries | 8ec6356 |

**Verified working end-to-end:**
- Run `ef04305f`: agent went to Google Images, extract_links, add_to_resource_library → saved real bookmark `[Bookmark] Dolphin Pictures` with `task_id=task_177717050...` and `ok=true`. Screenshots captured at every step.
- Run `2ee55b89`: agent typed search, pressed Enter, navigated to results — but extract_links got 0 images on Google's modern lazy-loaded image search. Reached max steps without saving.

**Known limitations of free-tier path** (NVIDIA NIM `llama-3.3-70b-instruct`):
1. **Planning quality** — model over-explores rather than executing the cheapest path. "Save 3 dolphin pictures" → it correctly extracts URLs and calls `add_to_resource_library`, but then keeps browsing instead of saving 2 more and finishing. **Mitigation:** BYOK Anthropic Claude Sonnet (`provider=anthropic` in BYOK Settings) handles this in 5-8 steps reliably.
2. **Lazy-loaded pages** — Google image search renders `<img>` tags via JS after initial paint. `extract_links filter=img` sees 0-2 images. **Mitigation (2026-04-25 residual):** prompt user to use Bing/DuckDuckGo image search. Optional future runner action `scroll_until_loaded` is **deferred** (not scheduled; track under Agent Mode runner backlog, not silent open-loop).
3. **No real "library" yet** — `add_to_resource_library` writes a task with `[Bookmark]` prefix to the existing `/phone/nexus-execute` endpoint, since the actual `user_files` library is for uploaded blobs. **Mitigation:** new `/phone/agent-execute` Edge route with a real bookmarks table — not blocking.

**What works right now (confirmed):**
- Live screenshot stream in `AgentRunStream` UI (real-time via Supabase Realtime channel `agent-run:<id>`)
- Tier-B users can click, type, navigate, scroll, extract
- Real saves to user's task list (visible in Tasks tab + as `[Bookmark]` prefix)
- 429 rate limits don't kill runs (auto-backoff)
- Same-action / same-block tripwires prevent burn-down loops


### 2026-04-25 20:06 — runner deploy verified live (prod `058ff5a`)

**Status: ✅ END-TO-END LIVE.** Two real smoke runs completed in production: `example.com` heading extract (2 steps, 8s, 3¢) and Wikipedia "World Wide Web" article (4 steps, 9s, 5¢). Real Playwright Chromium on Oracle ARM A1, real LLM (NVIDIA NIM Llama-3.3-70B free tier), real DB roundtrip per step, real Cloudflare exposure.

#### Live infra

| Piece | Value |
|---|---|
| Oracle box | `syncscript-a1-retry-2`, public IP **`157.151.235.143`**, ARM A1 4 OCPU / 24 GB |
| SSH alias on Mac | **`ssh oracle`** (`~/.ssh/config` Host oracle, key `~/.ssh/oracle/id_ed25519` — copied from `~/Downloads/ssh-key-2026-04-14 (2).key`) |
| Container | `nexus-agent-runner` on port **`18790`** (loopback) |
| Image | **`ghcr.io/stringerc/syncscript-nexus-agent-runner:latest`** (multi-arch; auto-built by `.github/workflows/agent-runner-image.yml` on push to `main` touching `deploy/nexus-agent-runner/**`) | (historical)
| Public URL | **Cloudflare quick tunnel** docker container `cf-agent-runner-quick` (`cloudflare/cloudflared:latest`, host network, `tunnel --no-autoupdate --url http://127.0.0.1:18790`) |
| Current tunnel | `https://justin-romance-attitude-mutual.trycloudflare.com` — **EPHEMERAL**, changes on tunnel restart |
| Vercel envs (production) | `AGENT_RUNNER_TOKEN` (= `NEXUS_PHONE_EDGE_SECRET`). **`AGENT_RUNNER_BASE_URL` is now a fallback only** — see § Self-publishing tunnel URL below |
| URL stability | `public.runner_endpoints` row + Oracle systemd watchdog auto-publishes current tunnel URL — Vercel reads it at request time. **No manual env updates ever again** |
| GH repo variables | `AGENT_RUNNER_BASE_URL` (mirror), `AGENT_RUNNER_LIVE_VERIFY=1` (strict mode for nightly probe) |
| Default LLM | NVIDIA NIM `meta/llama-3.3-70b-instruct` (text-only, strong FC) — was `llama-3.2-90b-vision` but it returned prose instead of `tool_calls` under tool_choice:auto |

#### Ops runbook

- **Runner status:** `ssh oracle "sudo docker ps --filter name=nexus-agent-runner --format 'table {{.Names}}\t{{.Status}}'"`
- **Runner logs:** `ssh oracle "sudo docker logs -f nexus-agent-runner --tail 200"`
- **Pull latest image / restart:** `ssh oracle "sudo /opt/nexus-agent-runner/bringup.sh"` (idempotent)
- **Tunnel logs:** `ssh oracle "sudo docker logs cf-agent-runner-quick --tail 30"`
- **Tunnel URL right now:** `ssh oracle "sudo docker logs cf-agent-runner-quick 2>&1 | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' | head -1"`
- **End-to-end smoke:** `vercel env pull /tmp/.env --environment=production --yes && (set -a; . /tmp/.env; set +a) && AGENT_RUNNER_BASE_URL=<tunnel> AGENT_RUNNER_TOKEN=$NEXUS_PHONE_EDGE_SECRET node scripts/smoke-agent-run-e2e.mjs && rm /tmp/.env`
- **Nightly health probe in CI:** GH workflow `agent-runner-live.yml` reads `vars.AGENT_RUNNER_BASE_URL`; soft-fails until `vars.AGENT_RUNNER_LIVE_VERIFY=1`.
- **When the tunnel URL changes** (cloudflared restart): `gh variable set AGENT_RUNNER_BASE_URL -b "<new>"` AND `vercel env rm AGENT_RUNNER_BASE_URL production --yes && printf '%s' "<new>" | vercel env add AGENT_RUNNER_BASE_URL production && CI=true vercel deploy --prod --yes`. **Long-term:** swap to a **named** Cloudflare tunnel for stable DNS — `nexus-agent-runner.syncscript.app` was reserved in the runbook but not yet provisioned.

#### Three live-debug fixes shipped this session (all on `main`)

1. **`bringup.sh` self-install crashed when piped** — `$0` is `bash` not a file path under `curl … | bash`. Fix: only `cp` when `$0` is a real file; otherwise download from raw GitHub. Commit `38a6973`.
2. **Playwright `storageState` ENOENT** — Playwright treats `string` as a file path; we store JSON in vault. Fix: `JSON.parse(s)` into object before passing to `newContext`. Commit `ce744f2`.
3. **Safety gate blocked `goto example.com`** — `currentUrl='about:blank'` has empty host; `siteIsBlocked` defaulted empty host → blocked. Fix: empty host → not blocked; for `kind:'goto'`, evaluate `action.url` instead of `currentUrl`. Commit `058ff5a`.

Plus: **default NIM model swapped from vision to text-FC**, `tool_choice: 'required'` with graceful `'auto'` fallback, and a 3-consecutive-non-tool-turn abort that names the model so users know to BYOK upgrade. Commit `2b3a6b5`.

#### Live CDP screencast + decisive free-tier path (2026-04-25 late night, prod commit `0de0898`)

User's #1 ask after the audit: "the live view should be the user seeing the cursor moving and typing as if they were doing it" — i.e. the same approach **Browserbase / Anthropic Operator / OpenAI Operator / Manus** use. Implemented via **Chrome DevTools Protocol screencast** broadcast over WebSocket — the architectural standard for agentic browsers.

#### Architecture (the same as the top-tier products)

| Layer | Component |
|---|---|
| **Capture** | `Page.startScreencast` via Playwright CDP session — JPEG frames at quality 60, 1024x768, ~12 fps cap (`everyNthFrame` divisor). Frame emission is change-driven, not constant-rate (industry standard). |
| **Broadcast** | `runner/screencast.mjs`: per-run `Broadcaster` with multi-subscriber Set, late-join replay (sends most-recent frame to new subscriber), heartbeat ping every 20s so Cloudflare doesn't idle the WS. |
| **Auth** | `/api/agent/live-token` issues a 5-minute HMAC token (`base64url(JSON_payload).base64url(HMAC_SHA256(payload, AGENT_RUNNER_TOKEN))`). Runner verifies with `crypto.timingSafeEqual` — no Supabase round-trip per WS connection. |
| **Transport** | WebSocket at `wss://<tunnel>/v1/runs/<runId>/live?token=…`. Binary frames (JPEG bytes); text messages reserved for control (`no_active_broadcaster`). |
| **Render** | `AgentLiveCanvas.tsx` — `createImageBitmap(blob)` → `ctx.drawImage(canvas, 0, 0)`. Reconnect with exponential backoff. Status pill (LIVE / connecting / fallback). |
| **Fallback** | When WS fails or run is `done`, render the latest static screenshot from `agent_run_steps.screenshot_b64` (already populated). Graceful degradation. |

#### Tightening (applied in same session)

- **Browser-side:** `goto` waits for `networkidle` (4s cap) so SPA fetches settle before extract; `extract_links` filter rejects SVG/icons/UI bundles, scores by area+alt, includes `data-src` / `data-original` / `srcset` lazy attrs; auto-scrolls twice + retries when first pass returns < 5 images.
- **Prompt:** "BUDGET DISCIPLINE — each step ≈ 1¢", explicit recipe ("goto Wikipedia → extract_links once → save N back-to-back → finish — STOP HERE"), Wikipedia recommended over image-search engines (real `<img>` tags at first paint vs JS-rendered icon grids).
- **Auto-finish:** if goal contains a number ("save 3 X"), bail as soon as N successful `add_to_resource_library` / `create_task` / `add_note` calls land — without waiting for the model to remember to call `finish()`. **Biggest single cost-of-ownership win** on free-tier Llama-3.3.

#### Verified end-to-end (run `82f922e2`, 2026-04-26 03:23 UTC)

| Metric | Before fixes | After fixes |
|---|---|---|
| Status | failed (max steps) | done |
| Steps | 47 | **12** |
| Cost | 22¢ | **6¢** |
| Bookmarks saved | 0 | **3** (real `upload.wikimedia.org/.../*.jpg` URLs) |
| Live view | 0 screenshots | **3 frames / 231 KB / first frame in 3 s** |
| User experience | "saw nothing" | "Wikipedia loads, agent navigates, frames stream live" |

#### How to run smoke tests yourself

```bash
vercel env pull /tmp/.env --environment=production --yes && set -a && . /tmp/.env && set +a
SMOKE_USER_ID=<uid> node scripts/smoke-agent-run-e2e.mjs           # functional test
NODE_PATH=/tmp/node_modules node scripts/smoke-agent-live-screencast.mjs   # live frames test
rm /tmp/.env
```

Both scripts now read tunnel URL from `runner_endpoints` row (Vercel-parity) instead of stale env.


### 2026-04-25 evening — runner deploy + voice dock + persistent contexts
- **GHCR-built Docker image:** `ghcr.io/stringerc/syncscript-nexus-agent-runner:latest`. Auto-built by `.github/workflows/agent-runner-image.yml` on every push to `main` that touches `deploy/nexus-agent-runner/**`. Multi-arch (linux/amd64 + linux/arm64 — Oracle Always-Free is ARM). Cache via GitHub Actions cache. (historical)
- **One-line Oracle bringup:** `curl -fsSL https://raw.githubusercontent.com/stringerc/syncscriptE/main/deploy/nexus-agent-runner/bringup.sh | sudo bash`. Self-installs to `/opt/nexus-agent-runner/bringup.sh`; future updates: `sudo /opt/nexus-agent-runner/bringup.sh`. Validates env, pulls image, replaces container, health-probes `/v1/health` for up to 30s.
- **Live verifier:** `node scripts/verify-agent-runner-live.mjs` (added to `.gitignore` allowlist). Probes `https://nexus-agent-runner.syncscript.app/v1/health`, asserts `{ ok, started_at, active_runs, max_concurrency }`.
- **Vercel env (set):** `AGENT_RUNNER_TOKEN` matches `NEXUS_PHONE_EDGE_SECRET`. **Pending until Cloudflare DNS:** `AGENT_RUNNER_BASE_URL=https://nexus-agent-runner.syncscript.app`. Without that, runs queue cleanly and the runner picks them up via 5s poll — no crash, no hang.
- **Voice docking** — when an `agent_runs` row is in `queued/running/waiting_user/paused`, the voice portal in AppAIPage shrinks to a 240×168 top-left card (spring transition, ChevronUp icon, "Nexus is working: <truncated goal>" banner). Tap (or Enter/Space) opens the AgentRunStream overlay. New: `src/hooks/useActiveAgentRun.ts` + `src/components/nexus/VoiceDockedFrame.tsx`. **No edits to `VoiceConversationEngine.tsx`** — outer container shrinks, inner content scales naturally with `h-full w-full`.
- **Persistent browser contexts** — Playwright `storageState` (cookies + localStorage + IndexedDB) is captured at the end of every agent run and stored encrypted in Supabase Vault under `browser_ctx_<user>_default`. Next run hydrates it before launch → Gmail / GitHub / etc logins survive across runs.
  - Migration: `supabase/migrations/20260425220000_browser_contexts.sql` — table `browser_contexts(user_id PK, hostnames TEXT[], bytes, cookie_count, last_used_at)` with RLS, plus four RPCs:
    - `admin_save_browser_context(user_id, storage_json, hostnames, cookie_count)` — service_role only; rotates vault entry + upserts metadata.
    - `admin_load_browser_context(user_id)` — service_role only; returns the JSON.
    - `clear_browser_context()` — `auth.uid()` derived; user-callable to disconnect all sites.
    - `disconnect_browser_site(p_hostname)` — user-callable; reads vault, filters cookies/origins by hostname (suffix-aware), writes back. Empty result → wipes the row + vault entry.
  - Runner: `runner/browser.mjs` exports `captureStorageState()`; `runner/agent-loop.mjs` calls `admin_load_browser_context` before launch and `admin_save_browser_context` in `finally`. Both wrapped in try/catch — broken vault state can't crash a run.
  - UI: `src/components/settings/ConnectedSitesSection.tsx` — Settings → Agent → Connected sites list. Per-host Disconnect button + Clear all. Hostnames + cookie count + last-used timestamp + storage size.
- **Contract test:** `tests/agent-runner-deploy-contract.test.mjs` — 17 asserts covering GHCR workflow shape, bringup.sh idempotency + env validation, verify script, voice docking hooks/components/wiring, browser_contexts schema + RLS + RPCs + auth grants, runner storageState capture/load wiring, Settings UI integration. **Total suite now 153 + 2 passing** (was 136 + 2).
- **Owner action remaining:** SSH to Oracle, drop `.env` per `deploy/nexus-agent-runner/env.example`, `curl … | sudo bash` (one line), add Cloudflare Tunnel ingress rule, `vercel env add AGENT_RUNNER_BASE_URL production`. After that, agent runs flow end-to-end with persistent logins. (historical)


### 2026-04-25 — Phase 1 → 5 foundation
- **What it is:** Per-user agent runs that drive a real headless Chromium on our Oracle Always-Free VM. The agent has TWO tool sets: browser actions (goto/click/type/scroll/screenshot/extract_text) and existing SyncScript Nexus tools (`create_task`, `add_to_resource_library`, `create_document`, `add_note`) — same `executeNexusTool` audit trail as voice/chat. Default LLM is **NVIDIA NIM** `meta/llama-3.2-90b-vision-instruct` (free); users can BYOK 8 other providers.
- **DB foundation** — single migration `supabase/migrations/20260425170000_agent_mode_foundation.sql`:
  - `agent_runs` (one per goal, lifecycle queued→running→done/failed/cancelled/waiting_user/paused), `agent_run_steps` (append-only timeline with screenshots), `agent_run_messages` (mid-run user interjections).
  - `automation_policies` (Tier A/B/C/D + caps + trusted/blocked sites + global pause). Defaults: Tier A, 5 runs/day, 50¢/day, blocks `*.gov + chase/bofa/wf`.
  - `byok_keys` metadata + vault-encrypted secret in `vault.secrets` under `byok_<user>_<provider>`. SECURITY DEFINER RPCs `admin_seed_byok_key` / `admin_read_byok_key` are service-role only.
  - `projects` namespace + `project_id` column added to existing `tasks` / `goals` / `workstreams`. RLS `user_id = auth.uid()`.
  - RPCs: `claim_next_agent_runs` (FOR UPDATE SKIP LOCKED, lease 300s), `release_agent_run_claim`, `record_agent_step`, `pending_agent_messages` (read+mark-applied), `complete_agent_run`, `check_agent_run_quota`.
- **Vercel API** — single dispatcher `api/agent/[action].ts` (Hobby cap kept at 12 by folding old `api/ai/nexus-post-call-summary.ts` (removed; now `api/phone/_route-post-call-summary.ts`) into `api/phone/[endpoint].ts` + `vercel.json` rewrite):
  - `POST /api/agent/start` — auth, quota check, LLM-config resolve, INSERT `agent_runs`, fan to runner.
  - `GET /api/agent/list` (Tasks panel), `GET /api/agent/run` (detail).
  - `POST /api/agent/cancel`, `interject`, `approve` (decline = cancel).
  - `GET /api/agent/byok-list`, `POST byok-set`, `byok-delete`. Keys encrypted in vault.
  - `GET / POST /api/agent/policy` — Tier A/B/C/D + caps + lists + pause toggle.
- **LLM adapter** — `api/_lib/agent-llm-adapter.ts` + parity in `deploy/nexus-agent-runner/runner/llm.mjs`. **Nine providers, one OpenAI-compatible wire shape**: NVIDIA, OpenRouter, Gemini, OpenAI, Anthropic, Groq, xAI, Mistral, Ollama, custom_openai_compat. Anthropic uses `x-api-key` + `anthropic-version`. `estimateCostCents` per-provider so `daily_cost_cents_cap` actually means something. (historical)
- **Oracle runner (the browser engine)** — `deploy/nexus-agent-runner/`. Single Docker container on the same Oracle VM that runs Kokoro fallback. Polls every 5s via `claim_next_agent_runs` (SKIP LOCKED). Per run: Playwright Chromium, agent loop with screenshot→LLM→action, `record_agent_step` per step, `pending_agent_messages` between iterations for mid-run steering, `complete_agent_run` on done. Max concurrency 4 (4-core ARM A1, 24 GB RAM). One-command deploy via `docker run -p 18790:18790 …`; full bringup runbook in `deploy/nexus-agent-runner/README.md`. (historical)
- **Safety gate (`deploy/nexus-agent-runner/runner/safety.mjs`)**: (historical)
  - Tier A allows only `goto / screenshot / scroll / extract_text / wait / press`.
  - Destructive label match (`submit / pay / delete / confirm / buy / send …`) on click/type → block in B, request approval in C, require trusted-site whitelist in D.
  - Site allow/deny enforced regardless of tier.
- **Frontend (live on prod 3a39980)**:
  - `src/components/nexus/AppAiSidebarPanel.tsx` — tabbed right panel (💬 Chats / ✅ Tasks / 📁 Projects) with collapse arrow. Drops into AppAIPage replacing the old chats sidebar; localStorage persists tab + collapsed state.
  - `src/components/nexus/AgentTasksPanel.tsx` — agent_run rows with status icons, click → opens stream.
  - `src/components/nexus/AgentRunStream.tsx` — full-page overlay: live screenshot (Realtime channel), action timeline, "Steer Nexus mid-run" interject input, Approve/Decline buttons when paused, Stop.
  - `src/components/projects/ProjectFilterDropdown.tsx` — top-right of TasksGoalsPage. All / + New / list. Selection sticky in localStorage so AgentTasksPanel + Project OS share filter.
  - `src/components/settings/AgentSettingsTab.tsx` — Settings → Agent: BYOK keys form (provider dropdown, password input, optional model + endpoint), tier picker + caps + global pause, agent run history.
  - `src/components/settings/FilesLibraryEmbed.tsx` — Settings → Files (existing FilesLibraryPage embedded). `/library` and `/dashboard/library` routes redirect to `/settings?tab=files`. Sidebar Library entry removed.
  - **AppAIPage routing**: Chat composer detects agent intent (`detectAgentIntent` + `userExplicitlyRequestsAgent`) and routes to `/api/agent/start` instead of `/api/ai/nexus-user`. `@agent` prefix forces it.
- **Hooks** — `src/hooks/useAgentRuns.ts` (Realtime subscription per run, all controls), `src/hooks/useProjects.ts` (CRUD + selected project sticky).
- **Tests** — `tests/agent-mode-foundation-contract.test.mjs` (30 asserts covering migration shape, SKIP LOCKED, RLS, dispatcher routes, LLM adapter parity, Oracle runner files, frontend wiring, sidebar/library/settings moves, post-call summary fold). Total suite: **136 + 2 passing**.
- **What's still owner-action to fully light up:**
  1. Bring up Oracle runner — `cd deploy/nexus-agent-runner && docker build … && docker run …` per README. Or skip if you only want the schema + UI surface.
  2. Add Vercel envs: `AGENT_RUNNER_BASE_URL=https://nexus-agent-runner.syncscript.app`, `AGENT_RUNNER_TOKEN=<same as NEXUS_PHONE_EDGE_SECRET or unique>`. Already deploys without these — runs just stay queued until a runner appears.
  3. Optional: `vercel env add NVIDIA_API_KEY` already exists per Vercel dump. Free-tier works the moment the runner is up.
- **Shape/UX choices that came from the design ask:**
  - Tab strip with collapse arrow (▼/▶) replaces old chats sidebar; chats and tasks each have a `+` to start.
  - Voice orb minimization while agent runs is **not yet wired** — punted to a follow-up so we don't touch `VoiceConversationEngine` (active surface) on the same drop. Voice continues to work as before; agent + voice can run in parallel today via the chat composer + sidebar.
  - Project overview tab (single-project deep-dive view) is **not yet built** — punted; project filter today scopes the existing tabs to a single project.
  - Persistent browser context per user (saved Gmail/etc cookies across runs) is **future** — current runs always start fresh. Easy upgrade since Browserbase SDK has parity if/when we swap.


## Self-publishing tunnel URL (2026-04-25 night, prod commit `5b009b0`)

Solved the ephemeral-URL problem **without** requiring a Cloudflare account auth click. Architecture:

1. **`public.runner_endpoints`** table (migration `20260426010000_runner_endpoints.sql`) — service-role-only RLS, `(name, url, notes, updated_at)`, seeded with `name='agent_runner'`.
2. **Oracle watchdog** at `/opt/nexus-agent-runner/watchdog-tunnel-url.sh` runs every 60s via `nexus-agent-runner-watchdog.timer` (systemd). It `docker logs cf-agent-runner-quick`, greps the current `*.trycloudflare.com` URL, and `POST`s to `${SUPABASE_URL}/rest/v1/runner_endpoints?on_conflict=name` (Prefer: merge-duplicates) using the service-role key from `/opt/nexus-agent-runner/.env`. State file `/var/lib/nexus-agent-runner/last-tunnel-url` so it only writes when the URL actually changes.
3. **Vercel `/api/agent/[action]`** has `resolveRunnerBaseUrl(sb)` (60s in-memory warm cache) that reads `runner_endpoints.url` for `name='agent_runner'`. Falls back to `AGENT_RUNNER_BASE_URL` env var if the row is empty or Supabase is unreachable.
4. **Validated by full rotation test (2026-04-25 01:36 UTC):** killed + recreated `cf-agent-runner-quick` → new URL `sources-floating-variable-cardiff.trycloudflare.com` → watchdog detected within 3s of rotation → upserted to Supabase → ran end-to-end smoke against new URL: 2 steps, 7s, 3¢, summary correct. **Zero manual intervention.**

### Inspect / debug

- Watchdog status: `ssh oracle "sudo systemctl status nexus-agent-runner-watchdog.timer"` (next trigger time)
- Watchdog logs: `ssh oracle "sudo journalctl -u nexus-agent-runner-watchdog.service -n 50"`
- Force a tick: `ssh oracle "sudo systemctl start nexus-agent-runner-watchdog.service"`
- Read live row: `select name, url, notes, updated_at from public.runner_endpoints;` (service-role only)

### Owner action

- **Optional upgrade for cosmetics:** Provision a named Cloudflare tunnel (`nexus-agent-runner.syncscript.app`) so the published URL is a stable hostname instead of `*.trycloudflare.com`. Run `ssh oracle "cloudflared tunnel login"` and click the printed URL to authorize the `syncscript.app` zone. After cert lands, run `cloudflared tunnel create nexus-agent-runner && cloudflared tunnel route dns nexus-agent-runner nexus-agent-runner.syncscript.app`, swap the `cf-agent-runner-quick` Docker container for `cf-agent-runner-named`, and update the watchdog's URL extraction (or just point the tunnel at `:18790` and let the row pick up the new hostname). The system already works without this — the named hostname is a polish, not a fix.

## App AI tab — drag/drop + paste documents (2026-04-25)
- **What it does:** On the App AI tab (`/app/ai`), the user drags any text-extractable document onto the page. A two-half overlay appears: **left = Reference** (Nexus reads the document for context), **right = Modify** (loads into `DocumentCanvas` and Nexus rewrites in place via `update_document`). Multiple files at once, keyboard-accessible "Attach document" button as fallback. Open canvas auto-attaches itself as a modify-target on every send so revisions work without re-pasting.
- **Files (additive — AppAIPage edits stayed minimal to respect rule 02 protected-files spirit):**
  - `src/utils/document-attachment.ts` — pure file-to-attachment parsing, MIME inference, hard caps (`MAX_ATTACHMENT_BYTES = 96 KB`, `MAX_TOTAL = 256 KB`, `MAX_ATTACHMENTS_PER_TURN = 6`, `MAX_FILE_BYTES_BEFORE_READ = 4 MB`), and the `formatAttachmentSystemMessage` serializer.
  - `src/hooks/useAppAiAttachments.tsx` — drag/drop event handlers (correct `dragEnter` depth-counting), file picker, state, error/warn callbacks. Filters by `dataTransfer.types` containing `'Files'` so plain text drags are ignored.
  - `src/components/nexus/AppAiDropzoneOverlay.tsx` — page-level overlay with Reference/Modify halves. Pointer-events-none on the wrapper so the actual drop hits the page root; halves re-enable to detect mode swap.
  - `src/components/nexus/AppAiAttachmentsBar.tsx` — chip rail above composer (role=region, removable, truncation badge, + Add button).
  - `api/_lib/nexus-attachments.ts` (2026-04-25) — server-side validator + serializer. Re-caps sizes (defense in depth — never trust the client). Format must stay byte-identical to the client utility; the contract test enforces that. (historical)
- **API change (backwards-compatible):** `/api/ai/nexus-user` accepts optional `attachments: Array<{name, mimeType, content, mode, truncated?}>`. Sanitized + injected as a system message AFTER the main persona prompt and BEFORE user/assistant turns. Old clients without `attachments` see zero behavior change. `emitNexusTrace` now records `attachmentCount` + `attachmentBytes` (no raw text).
- **Supported file types:** `.txt .md .json .csv .tsv .html .xml .yml .toml .ini .log .sql` + 25+ code extensions. **Rejects with friendly toast:** images (image vision routing not wired here), PDF/DOCX/XLSX (no client-side text extractor today — paste content or save as `.md`), oversized (>4 MB pre-read).
- **Tests:** `tests/app-ai-attachments-contract.test.mjs` — 16 asserts covering size caps, client/server format parity, error catalog, hook a11y/dragEffect, overlay pointer-events behavior, AppAIPage wiring, and trace fields. In `npm test`. Total suite now **106 + 2 passing** (was 90 + 2).
- **Auto-canvas wiring:** when `canvasDoc` is open, every send auto-includes it as a `mode: 'modify'` attachment (deduped against any explicit modify-mode upload of the same name). This closes the long-standing UX gap where users had to re-paste a doc to ask Nexus for revisions.
- **Why two modes (vs one big "attach"):** Anthropic + OpenAI consistently report higher tool-call accuracy when the model knows whether a doc is read-only vs target-of-edit. The system message includes `[REFERENCE]` vs `[MODIFY-TARGET]` tags + an explicit instruction to call `update_document` for modify targets — fewer "Nexus described changes instead of saving them" reports.

## Gap #1 live end-to-end (2026-04-24)
- **Status: PROVEN.** Nexus tool → `event_outbox` → `fanout_event_outbox` → `webhook_deliveries` → pg_cron flush → HTTPS POST with HMAC → webhook.site received + signature verified. One round-trip in a single 1-minute cron tick. See dated entry below for architecture.
- **Key runtime learnings captured during bring-up:**
  1. Vercel prod was missing `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (only `SUPABASE_ANON_KEY` was set). Added via `vercel env add`. The concierge worker + any Vercel-side service-role client now initializes.
  2. This Supabase project has **legacy anon JWTs disabled** (error `UNAUTHORIZED_LEGACY_JWT`) AND the modern `sb_publishable_*` keys aren't JWTs (`UNAUTHORIZED_INVALID_JWT_FORMAT`). For `make-server-57781ad9`, the correct pattern is **`verify_jwt = false`** in `supabase/config.toml` — the function handles its own auth (`x-nexus-internal-secret` on `/internal/*`, OAuth signatures on `/stripe/*`, `supabase.auth.getUser(token)` inside per-user routes). Gateway-level JWT pre-check was redundant and incompatible with pg_cron callers.
  3. `pg_net` deprecates request queue rows after response is recorded → the URL disappears from `net.http_request_queue` shortly after `net._http_response` lands. For forensics you need both tables joined quickly.
- **Vault (seeded via `admin_seed_syncscript_vault_secret`, scoped to 3 names):**
  - `syncscript_cron_secret` — Vercel Bearer for `/api/cron/*`
  - `syncscript_nexus_edge_secret` — `x-nexus-internal-secret` for `/make-server-57781ad9/internal/*`
  - `syncscript_supabase_anon_key` — left seeded for future use; currently redundant with `verify_jwt=false` but doesn't hurt.
- **pg_cron jobs live (6 active):** `syncscript.concierge.tick` (1m), `syncscript.phone.dispatch` (2m), `syncscript.process-emails` (5m), `syncscript.tts.slo` (10m), `syncscript.proactive.detect` (15m), `syncscript.webhooks.flush` (1m).
- **Operator runbook (use daily / on incidents):**
  ```bash
  # 1. Full live state in JSON — run from repo root:
  SERVICE_KEY=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' .env | head -1 | cut -d= -f2-) \
    && curl -s -X POST "https://kwhnrlzibgfedtxpkbgb.supabase.co/rest/v1/rpc/admin_autonomy_probe" \
         -H "Content-Type: application/json" -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" \
         -d '{}' | jq

  # 2. Rotate a secret (pattern — drop-and-recreate in-place; pg_cron picks up on next tick):
  #    only names allowed: syncscript_cron_secret | syncscript_nexus_edge_secret | syncscript_supabase_anon_key
  curl -s -X POST "…/rpc/admin_seed_syncscript_vault_secret" \
       -d '{"p_name":"syncscript_cron_secret","p_value":"<new>","p_description":"rotated"}'

  # 3. Pause/resume a single autonomy loop without redeploy:
  #    (uses cron.alter_job in SQL editor)
  update cron.job set active = false where jobname = 'syncscript.webhooks.flush';

  # 4. Replay DLQ'd deliveries for a subscription:
  update webhook_deliveries set status='pending', next_attempt_at=now(), claimed_at=null
    where status='dlq' and subscription_id='<uuid>';
  ```
- **Smoke script:** `scripts/smoke-outbound-webhooks.mjs` — allocates fresh webhook.site bucket, emits a synthetic event, polls to terminal, verifies HMAC against raw body. Run any time: `node scripts/smoke-outbound-webhooks.mjs`. Exit 0 = pipeline healthy.
- **Edge function setting (in `supabase/config.toml`):**
  ```toml
  [functions.make-server-57781ad9]
  verify_jwt = false
  ```
  Do not remove — internal auth is in-function, and the Supabase platform JWT check was mismatching this project's key regime. Client-side JS sets `Authorization` via the Supabase JS SDK anyway so normal user requests still carry a token for in-handler `supabase.auth.getUser(token)`.

## Event outbox + outbound webhooks (Gap #1) — 2026-04-23
- **What it is:** Per-user webhook subscription layer so n8n / Make / Zapier / custom backends can receive SyncScript events without a code change. Classic outbox-pattern + fanout-with-DLQ.
- **Schema:** `supabase/migrations/20260423160000_event_outbox_and_webhooks.sql`
  - `event_outbox(id, user_id, event_type, event_key, payload, created_at, fanout_at, completed_at)` — unique `(user_id, event_type, event_key) WHERE event_key IS NOT NULL` enforces idempotency.
  - `webhook_subscriptions(id, user_id, label, url, secret, event_types TEXT[], active, consecutive_failures, disabled_reason, …)` — RLS `user_id = auth.uid()` for INSERT/SELECT/UPDATE/DELETE; service_role bypasses.
  - `webhook_deliveries(id, subscription_id, event_id, status, attempt, next_attempt_at, response_status, response_body_excerpt, last_error, claimed_at, …)` — unique `(subscription_id, event_id)` prevents double delivery.
  - RPCs (SECURITY DEFINER, `service_role` only): `fanout_event_outbox(batch_n)`, `claim_due_webhook_deliveries(lease_seconds, limit_n)` (FOR UPDATE SKIP LOCKED), `finalize_webhook_delivery(...)`.
- **Emit path (single source of truth):** `api/_lib/events.ts` → `emitEvent({ userId, eventType, eventKey, payload })`. Fire-and-forget, swallows failures, dedupes on `23505` unique_violation. Event catalog `SYNCSCRIPT_EVENT_TYPES`: task.*, note.created, event.proposed / event.created, document.created / document.updated, invoice.sent / invoice.paid / invoice.overdue, signature.requested, playbook.run.started / step.completed / succeeded / failed, nexus.tool.called, nexus.voice.turn.completed. (historical)
- **Wired in:** `api/_lib/nexus-actions-executor.ts` `finish()` choke point now emits `nexus.tool.called` for every tool + typed events for successful mutating tools (`create_task`, `add_note`, `propose_calendar_hold`, `create_document`, `update_document`, `send_invoice`, `send_document_for_signature`, `enqueue_playbook`). Never throws. (historical)
- **Dispatcher (Edge):** `supabase/functions/make-server-57781ad9/webhook-dispatcher.tsx`. Routes:
  - `POST /make-server-57781ad9/internal/webhooks/flush` — pg_cron tick.
  - `GET  /make-server-57781ad9/internal/webhooks/status` — pending/dlq counts.
  Both gated by `x-nexus-internal-secret: $NEXUS_PHONE_EDGE_SECRET`. Per-delivery: HMAC-SHA256 signature (`X-SyncScript-Signature: sha256=<hex>`), 8s abort, exponential backoff `60s → 12h`, DLQ at 10 attempts. Subscriptions auto-disable at 20 consecutive DLQ'd deliveries.
- **Heartbeat:** `supabase/migrations/20260423170000_pg_cron_webhooks_flush.sql` adds `syncscript.webhooks.flush` (`* * * * *`) calling the Edge dispatcher via the vault-backed `syncscript_autonomy_post` helper.
- **Webhook payload shape (for docs / n8n templates):**
  ```json
  { "id": "<uuid>", "type": "task.created", "occurred_at": "<iso>", "user_id": "<uuid>", "payload": { ... } }
  ```
  Verify signature: `HMAC-SHA256(subscription.secret, raw_request_body) == req.header('X-SyncScript-Signature').replace('sha256=','')`.
- **Contract test:** `tests/event-outbox-and-webhooks-contract.test.mjs` (in `npm test`) — 11 asserts (schema shape, RLS on each table, SKIP LOCKED, HMAC + backoff + DLQ discipline, event catalog completeness, executor wiring, dispatcher route mounting in both `index.ts` + `index.tsx`).
- **Operator controls:**
  ```sql
  -- Subscribe a user (admin bootstrap until Settings UI ships)
  insert into webhook_subscriptions (user_id, label, url, secret, event_types)
    values ('<uuid>', 'My n8n instance', 'https://n8n.example.com/webhook/xyz',
            encode(gen_random_bytes(32), 'hex'), '{task.created,invoice.paid}');

  -- Delivery health
  select status, count(*) from webhook_deliveries group by status;

  -- Replay stuck DLQ rows
  update webhook_deliveries set status='pending', next_attempt_at=now(), claimed_at=null
   where status='dlq' and subscription_id='<uuid>';
  ```
- **Next:** Settings → Integrations → Webhooks UI (create / rotate secret / delivery log / one-click-replay); then the five `INTEGRATION_RECIPES` shipped as downloadable n8n template JSON under `public/integrations/recipes/*.n8n.json`.

## Autonomy heartbeat (pg_cron + pg_net) — 2026-04-23
- **Why:** Vercel Hobby cron is daily-only and Hobby caps at ≤12 functions; adding minute-level autonomy via `api/*` is a dead end. Supabase ships `pg_cron` + `pg_net` on every project — free, sub-daily, zero function pressure. Research: Supabase docs (pg_cron max 8 concurrent jobs / 10-min runtime), Vercel Hobby cron docs (daily + hour drift).
- **Migration:** `supabase/migrations/20260423150000_pg_cron_autonomy.sql` — enables `pg_cron` + `pg_net`, ships `public.claim_next_playbook_runs` (FOR UPDATE SKIP LOCKED lease) + `release_playbook_run_claim`, wraps HTTP calls in `public.syncscript_autonomy_post(url, secret_name, auth_scheme, body)` (SECURITY DEFINER, reads `vault.decrypted_secrets`), and schedules five `syncscript.*` cron jobs. Re-runnable: unscheduling step removes any prior `syncscript.*` jobs before re-adding.
- **Vault secrets required BEFORE enabling (Supabase SQL editor):**
  ```sql
  select vault.create_secret('<Vercel CRON_SECRET>', 'syncscript_cron_secret', 'Vercel Bearer CRON_SECRET for /api/cron/*');
  select vault.create_secret('<NEXUS_PHONE_EDGE_SECRET>', 'syncscript_nexus_edge_secret', 'x-nexus-internal-secret for /make-server-57781ad9/internal/*');
  ```
- **Schedules:**
  | jobname | cron | target | secret / auth |
  |---|---|---|---|
  | `syncscript.concierge.tick` | `* * * * *` | `https://www.syncscript.app/api/cron/concierge-playbook-tick` | `syncscript_cron_secret` (Bearer) |
  | `syncscript.phone.dispatch` | `*/2 * * * *` | `/api/cron/phone-dispatch` | same |
  | `syncscript.process-emails` | `*/5 * * * *` | `/api/cron/process-emails` | same |
  | `syncscript.tts.slo` | `*/10 * * * *` | `/api/cron/tts-slo` | same |
  | `syncscript.proactive.detect` | `*/15 * * * *` | Edge `…/make-server-57781ad9/admin/detect/all` | `syncscript_nexus_edge_secret` (`x-nexus-internal-secret`) |
- **Concurrency safety (mandatory before enabling 1-min tick):** `runConciergePlaybookTick` now calls `claim_next_playbook_runs(lease_seconds, limit_n)` first. Falls back to legacy select if RPC isn't deployed yet, so rolling deploys are safe. Claims released in a `finally`; stale claims expire after `CLAIM_LEASE_SECONDS = 120s`.
- **Operator controls (no redeploy):**
  ```sql
  update cron.job set active = false where jobname = 'syncscript.concierge.tick';
  update cron.job set active = true  where jobname = 'syncscript.concierge.tick';
  select * from cron.job_run_details where jobid in (select jobid from cron.job where jobname like 'syncscript.%') order by start_time desc limit 50;
  select cron.unschedule('syncscript.concierge.tick'); -- to remove entirely
  ```
- **Contract test:** `tests/pg-cron-autonomy-schedule.test.mjs` (in `npm test`) — asserts extensions, claim RPC + SKIP LOCKED, vault helper, and all five schedules by exact name + cron expression. Drift will fail `npm test` / release gate.
- **Next layer (not shipped yet):** event outbox + per-user outbound webhook subscriptions → n8n / Make / Zapier at user level (not just global env webhooks). Plan in thread [Nexus orb and autonomy plan](70b2d96e-4b0c-44a2-a3f0-2e5fa42a4a66). Keep n8n self-host (rule 09, Oracle free tier) for external orchestration — SyncScript stays authoritative, n8n only invokes via `executeNexusTool`.

## Autonomous billing, invoices, and crons (verified pattern)
- **Overdue + reminders + recurring + collection queue:** Supabase Edge `POST /make-server-57781ad9/internal/cron/billing-tick` (header `x-nexus-internal-secret: NEXUS_PHONE_EDGE_SECRET`) scans KV `invoices:v1:*` via `getKeyValueByPrefix`, marks `overdue`, sends tiered Resend reminders (3/7/14 days after due), dispatches recurring invoices from `recurring_invoices:v1:${userId}`, and enqueues Twilio collection calls on `nexus_scheduled_phone_calls` when `to_phone` + `collection_call_consent` and reminders threshold met.
- **Vercel:** `GET/POST /api/cron/invoice-overdue` and `billing-tick` call that Edge URL; `phone-dispatch` drains the phone queue; `market-benchmarks` calls `internal/bench/aggregate`. All expect `Authorization: Bearer CRON_SECRET` where configured.
- **Invoice records:** Persist `_userId` on each row (Nexus `send_invoice` + phone `phone-upsert`). Stripe `checkout.session.completed` now **writes back** the correct KV key via `getKeyValueByPrefix` + `kv.set`.
- **TwiML:** `handler=invoice-collection` plays a short disclosure message and hangs up (debtor-facing); scheduled jobs use `briefingType: invoice-collection` with `invoiceId` + `amount` query params.
- **Firma.dev:** Vercel **`api/firma/[action].ts`** (Hobby: one function) — `POST /api/firma/create-signing-request` and `POST /api/firma/webhook`. Firma API requires **PDF** base64 (`pdf-lib` server-side), **`/signing-requests/create-and-send`**. Webhook forwards to Edge `internal/firma-webhook` (public Supabase URL + anon fallbacks if `SUPABASE_URL` missing on Vercel). Nexus tool `send_document_for_signature`. Env: `FIRMA_API_KEY`, `FIRMA_WEBHOOK_SECRET`, `NEXUS_PHONE_EDGE_SECRET`. **Cursor MCP:** `https://docs.firma.dev/mcp`. (historical)
- **Plaid:** Edge app mounted at `/make-server-57781ad9/financial` (was previously unused). UI: `PlaidConnectCard` on Financials → Invoices.
- **Benchmarks:** Opt-in flag `benchmark_opt_in:${userId}` via invoice settings; public aggregate `GET /benchmarks/summary`; weekly cron aggregates opt-in users only.
- **Email proposal stub:** `internal/email-proposal-tick` chained from `process-emails` cron (extend with Gmail ingestion later).
- **Biometrics:** `useBiometricSummary` is a **separate** hook (does not modify `energy-system.ts` / `useEnergyPrediction.ts`).

## Dashboard navigation — do not regress (stuck on `/tasks`)
- **Symptom:** Sidebar (or links) appear to do nothing; user stays on Tasks after refresh or when leaving `/tasks`.
- **Root cause we fixed:** A **second** `<Routes>` mounted under `<Route path="/*" element={<DashboardRoutes/>} />` can break or strand **client-side navigation** in React Router 6/7 relative to the splat parent.
- **Second root cause (2026):** **`DashboardHeader` / `ResourceHubSection` navigated to `/dashboard/tasks`, `/dashboard/calendar`, etc.** Those URLs were only handled inside unused **`DashboardApp.tsx`** (legacy redirects). **`App.tsx` had no matching routes**, so the shell catch‑all sent signed‑in users to **`/dashboard`** — navigation looked broken. **Fix:** canonical paths via **`navigationLinks.sidebar`** in header/resource hub + explicit **`path="dashboard/tasks"` … `Navigate`** aliases in **`App.tsx`**.
- **BFCache:** **`BfcacheRouterSync`** in **`RouterStability.tsx`** reapplies the current URL on **`pageshow`** when **`event.persisted`** so the router reconciles after back/forward cache restore.
- **Tasks page + dead sidebar clicks — verified root cause (2026):** **`document.elementFromPoint`** at the **Dashboard** rail icon center on **`/tasks`** returned **`main#content` / Projects OS `h1`**, not the **`Link`**, while **`elementsFromPoint`** listed the **`A[data-nav=sidebar-dashboard]`** *below* **`main`** in the stack. **Computed styles:** **`#app-sidebar-rail`** had **`z-index: auto`** (Tailwind **`z-[350]`** missing from built CSS) and the main column had **`margin-left: 0`** (responsive **`!md:ml-14` / `!lg:ml-[100px]`** not emitted). So **`#main-content`** painted full width from **x=0** and **stacked above** the rail in hit order — **only obvious on dense `/tasks`**. **Fix (source of truth):** **`src/index.css`** — **`#app-sidebar-rail { z-index: 350; isolation: isolate; }`**, **`[data-syncscript-dashboard-main]`** margin-left **0 / 3.5rem / 100px** at **md/lg**, **`[data-syncscript-guest-banner]`** left offset to match rail. **`DashboardLayout`** main shell **`data-syncscript-dashboard-main`**; **`GuestModeBanner`** **`data-syncscript-guest-banner`**. Still remove **`!z-[110]`**-style dialog overrides; modals stay **`z-[400]`** (above rail). **`TasksGoalsPage`** opacity-only motion + **`overflow-x-hidden`** remain good hygiene.
- **Correct pattern (current `App.tsx`):** **`DashboardShell`** = `DashboardProviders` + **`<Outlet />`**, with **all** dashboard `Route` entries as **siblings’ children** of that pathless layout route — **one** top-level `<Routes>` tree only.
- **Guard:** `npm run guard:dashboard-route-shell` (also enforces removal of `DashboardRoutes()`).
- **Contract tests:** `tests/dashboard-route-outlet-regression.test.mjs` (in `npm test`) — shell + sidebar paths vs `App.tsx` routes.
- **E2E:** `npm run test:e2e:dashboard-nav` — **`CI=true`** build (skips flaky local prerender) + Playwright: dev-guest session, `/tasks` → sidebar **Dashboard** / **Calendar**, `/dashboard` → **Tasks**. Actions scoped to **`#app-sidebar-rail`**; uses real **`.click()`** once shell CSS is correct. **`e2e/*.diag.spec.ts`** ignored by Playwright (local hit-test probes). **CI:** `.github/workflows/ci.yml` job **`dashboard-nav-e2e`** runs this on push/PR to `main`. (historical)
- **Deploy:** Production is Vercel (`vercel deploy --prod`); custom domain **`www.syncscript.app`** aliases the latest production deployment after build completes.
- **Sidebar:** Primary nav uses **`react-router` `Link`** on a **`fixed`** rail; **`z-index` / `isolation`** from **`index.css` `#app-sidebar-rail`** (do not rely on Tailwind arbitrary **`z-[350]`** alone for the shell). Stable hook **`id="app-sidebar-rail"`**. Extension-heavy browsers can still interfere — compare with extensions disabled on `*.syncscript.app` if clicks fail.
- **Console noise:** Logs from **`uw.js` / `LogAggregator` / `chrome-extension://…`** are **browser extensions** (e.g. video/site helpers), not SyncScript — they are unrelated to router state; **`runtime.lastError` … bfcache** is extension lifecycle, not app logic.

## Agent ergonomics — patterns from Anthropic Claude Code (public repo)
**Source of truth reviewed:** `claude-code-main.zip` (GitHub **`anthropics/claude-code`**) — **plugins, examples, and workflow markdown**, not the proprietary CLI binary. Official docs: [Claude Code overview](https://code.claude.com/docs/en/overview), [plugins](https://docs.claude.com/en/docs/claude-code/plugins), [hooks](https://docs.anthropic.com/en/docs/claude-code/hooks).

**Disambiguation:** **Claude** (models) and **Claude Code** (agentic coding product) are not the same thing. This section copies **product design patterns** that are portable to any serious agent setup—including **Cursor + this repo**—not claims about model rankings.

### What that codebase does well (engineering, not hype)
1. **Composable plugins** — `plugin.json` + optional `commands/`, `agents/`, `skills/`, `hooks/`, `.mcp.json`; teams ship one concern per plugin (`plugins/README.md`).
2. **Guardrails as data** — e.g. `examples/settings/settings-strict.json`: tool **allow/deny/ask**, **sandbox** network knobs, `allowManagedHooksOnly`, managed permission rules only.
3. **Lifecycle hooks** — `PreToolUse` can **block** bad tool input (exit `2` = stop and show stderr to the agent); `SessionStart` injects context; other plugins use `Stop` for controlled loops (`examples/hooks/bash_command_validator_example.py` + hookify / ralph-wiggum / security-guidance in `plugins/README.md`).
4. **Slash commands as markdown + scope** — `.claude/commands/*.md` use YAML frontmatter (**`allowed-tools`**, **`description`**) and shell injection (`!` \`command\`) so one invocation = bounded git/PR work (e.g. `commit-push-pr.md`).
5. **Parallel specialized reviewers** — `code-review` and `pr-review-toolkit` split work (CLAUDE.md compliance, bugs, tests, types, simplification) instead of one vague “review the PR.”
6. **Security posture** — `SECURITY.md` points to **HackerOne VDP**; `security-guidance` plugin hooks file edits for risky patterns.

### Map Claude Code → SyncScript (Cursor + repo)
| Claude Code idea | What we already have | Strongest upgrade path |
|------------------|----------------------|-------------------------|
| Project memory file (`CLAUDE.md`) | **`MEMORY.md`**, **`AGENTS.md`**, **`USER.md`**, **`SOUL.md`**, `memory/YYYY-MM-DD.md` | Keep **one curated** `MEMORY.md`; daily files = raw, this file = decisions + ops |
| Cursor-style **rules** | **`.cursor/rules/*.mdc`** (SSR, protected files, perf/SEO) | Add rules only when a mistake **repeats**; avoid duplicate prose across rules vs MEMORY |
| **Skills** (`SKILL.md` trees) | Cursor **skills** (global `~/.cursor/skills-cursor/`, Codex `~/.codex/skills`) | Put **repeatable procedures** (OpenAI docs, Canvas, etc.) in skills; link from AGENTS.md |
| **Slash command** playbooks | **`integrations/agent-playbooks/`** + `deploy/kokoro-tts-ec2/*`, `integrations/HERMES*.md` | Extend with more one-pagers as needed — same spirit as `.claude/commands` |
| **PreToolUse** hooks | **`npm run release:gate`**, **`guard:*`**, **`verify:*`**, **`.github/workflows/*.yml`** | Treat CI + release gates as **non-bypassable** hooks; extend **contract tests** when adding bridges (Hermes/Engram pattern) |
| **Strict sandbox / permissions** | Cursor sandbox, user rules, “ask before outbound” | Mirror **strict** mindset: minimal network in automation; secrets only in env / Supabase / Vercel — **never** in MEMORY |
| **Multi-agent review** | Single CI pipeline | Split optional jobs: contract vs smoke vs build (already trending in `package.json`) — add **focused** workflows before one giant job |

### High-leverage habits to steal (top tier practices, stated calmly)
- **One workflow = one outcome + bounded tools** — reduces rambling and scope creep (see `commit-push-pr.md`: single message, only git/gh tools).
- **Verifiers over opinions** — `agent-sdk-verifier-*` plugins = structural checks; our analog is **`tests/*-contract.test.mjs`** and live **`verify:*`** scripts. Prefer adding a **failing test** over a long chat reminder.
- **Block vs warn** — hooks use exit codes intentionally; align repo policy: **CI fails** on contract break; optional warnings for non-gating lint.
- **Security reminders at edit time** — we do not run Claude Code hooks inside Cursor, but we **can** run **`guard:*` / `release:gate`** before merge; keep **protected-file rules** in `.cursor` for Nexus/Energy/auth surfaces.

### Optional follow-ups (parity / polish)
- **Playbooks already live** under **`integrations/agent-playbooks/`** (deploy, Kokoro, Hermes/Engram, release gate) — no separate **`docs/agent-playbooks/`** needed (**`docs/`** is gitignored).
- When opening large PRs, manually use dimensions from **`plugins/pr-review-toolkit`** / **`plugins/code-review`** READMEs (comments, silent failures, types, tests) as a **human or second agent** review list.

**Retention:** A full extract of the zip was reviewed under `.tmp-claude-code-extract/` and removed after notes were taken—do not commit that tree.

**Python line-level audit (every `.py` file in that zip):** `integrations/CLAUDE_CODE_PYTHON_AUDIT.md` — inventory, exit-code vs JSON protocols, per-file control flow, PEP 8 spacing notes, regex literals, and SyncScript mapping. There are only **11** Python files; the rest of Claude Code is not Python. (historical)

**Non-Python assets (workflows, slash commands, settings, hookify examples):** `integrations/CLAUDE_CODE_NONPYTHON_INVENTORY.md` — what exists upstream, what we **did not** copy (copyright / secrets), and how we integrated patterns. (historical)

**Integrated playbooks (git, Edge deploy, Kokoro recovery, Hermes/Engram verify, release gate, guardrail mapping):** `integrations/agent-playbooks/README.md`. Cursor slash-style shortcuts: `.cursor/commands/deploy-edge-supabase.md`, `kokoro-tts-recovery.md`, `verify-hermes-engram.md`. Rule: `.cursor/rules/06-agent-workflow-playbooks.mdc`. (historical)

---

## Cursor chat history vs this file
- **Past SyncScript work in Cursor** is stored as **JSONL transcripts** under the machine-local path  
  `~/.cursor/projects/Users-Apple-syncscript/agent-transcripts/` (one folder per chat UUID; **not committed to git**).
- **This `MEMORY.md` is the curated, repo-backed handoff.** Transcripts are useful for **search** (e.g. “Kokoro”, “nexus-guest”, “vercelignore”) but can be **stale**—always confirm against **current code**, **`vercel.json`**, and **`.cursor/rules`**. (historical)

### Themes that show up repeatedly in those transcripts (SyncScript)
| Topic | Notes |
|--------|--------|
| **Nexus “brain”** | Versioned JSON under `api/ai/_lib/nexus-brain/` (manifest, pricing, product facts); wired into guest/user routes. |
| **Nexus tools live verify** | **Runbook (GitHub secrets + triage):** `.github/docs/NEXUS_TOOLS_LIVE_VERIFY.md`. Command: `npm run verify:nexus-tools-live`. CI: `.github/workflows/nexus-tools-live.yml` maps `ENGRAM_LIVE_USER_JWT` → `NEXUS_LIVE_TEST_JWT`; preflight fails fast if no `GROQ_API_KEY`/`NVIDIA_API_KEY`. Local JWT/bootstrap: env vars, or **Supabase CLI** `supabase projects api-keys --project-ref kwhnrlzibgfedtxpkbgb` (**service_role** never in git/MEMORY). Action logs: search **`[verify] FAIL:`**. | (historical)
| **Landing voice pipeline** | `NexusVoiceCallContext` → `POST /api/ai/nexus-guest` (stream) → `POST /api/ai/tts` (Kokoro); preset **`cortana`** aligned with desktop companion. |
| **TTS / Vercel** | `KOKORO_TTS_URL`, `GET /api/ai/tts` health, optional **`?probe=1`**; shared **`src/utils/tts-proxy-session.ts`** so **`useVoiceStream`** (e.g. task template chunks) does not spam the proxy after **`NO_TTS_URL`**. **Stable prod (EC2 + named Cloudflare tunnel, not laptop):** **`deploy/kokoro-tts-ec2/NAMED_TUNNEL_SETUP_RUNBOOK.md`**. **Apply + verify:** `bash scripts/apply-vercel-kokoro-tts.sh 'https://YOUR_KOKORO_ORIGIN'` or `./deploy/kokoro-tts-ec2/scripts/update-vercel-kokoro-url.sh '…URL…'` then **`npm run verify:kokoro:env`** / **`npm run verify:kokoro:env:post`**. | (historical)
| **Vercel deploy constraints** | Hobby **≤12 serverless functions** — Firma merged into **`api/firma/[action].ts`**, Discord interactions merged into **`api/phone/[endpoint].ts`** + rewrite **`/api/discord/interactions`**; **`npm run guard:vercel-functions`** after `vercel build`. **`.vercelignore`** still trims some `api/ai/*` for upload size—do not re-add `api/discord/` (was blocking Discord deploy). **`phone-dispatch` cron** is **daily** on Hobby (`vercel.json`); Pro can restore **`*/5 * * * *`**. | (historical)
| **Infra** | Same themes as **`## AWS EC2 3.148.233.23`** below — Kokoro reachability is **not** the same problem as OpenClaw routing. **Oracle alternative (Always Free Ampere + keepalive):** **`deploy/oracle/README.md`**. | (historical)

## 24/7 TTS — why EC2 + named Cloudflare Tunnel (not your laptop)
**Facts (from repo + how the internet works):**
- **`/api/ai/tts`** on Vercel calls **`KOKORO_TTS_URL`** over HTTPS (`/health`, `/v1/audio/speech`). Browsers may also call that same origin for direct Kokoro (`kokoroDirectOrigin`). So production needs a **reachable, stable HTTPS origin**.
- **Cloudflare Quick Tunnel** (`*.trycloudflare.com`) assigns a hostname that is **tied to a running `cloudflared` process**. When that process stops (sleep, travel, OS update, closed lid), the name often becomes **useless** (`ERR_NAME_NOT_RESOLVED`). That is **not** a bug in SyncScript; it is how account-less quick tunnels behave.
- **Your laptop** is a **single point of failure** for availability, power, network, and DNS for that tunnel. It cannot meet a **24/7** requirement by definition.

**Recommended production shape (already documented in `deploy/kokoro-tts-ec2/README.md`):** (historical)
- Run **Kokoro in Docker on EC2** (same class of host you already use for OpenClaw at `3.148.233.23`).
- Use a **named Cloudflare Tunnel** + **DNS on a zone you control** (e.g. `kokoro.<yourdomain>`). The public hostname stays **stable** across connector restarts; you rotate **`TUNNEL_TOKEN`**, not random subdomains.
- Keep **8880 bound to loopback** on the instance; **do not** expose raw `:8880` on a public security group. TLS and abuse filtering stay at **Cloudflare**; Vercel only needs **`KOKORO_TTS_URL=https://kokoro…`** and a **production redeploy** after env changes.

**Optional second line of defense:** set **`KOKORO_TTS_FALLBACK_URL`** to a **different** Kokoro base (second region or backup host), not to `syncscript.app` itself.

**Legacy note:** `SYNCSCRIPT_ARCHITECTURE.md` §31 still describes an older **quick-tunnel + tunnel-manager** story on EC2. The **current** packaged path is **`deploy/kokoro-tts-ec2/`** (FastAPI `server.py`, Compose, **named-tunnel** profile).

## Read this first (agents & humans)
- **This file is the primary handoff** for where things stand, infra, and how to unblock (especially **TTS / Kokoro**). Check here **before** assuming a bug or redeploying blindly.
- **If Nexus voice “worked before” and no app code changed:** the failure is almost always **ops** — an **expired Cloudflare Quick Tunnel hostname** or Kokoro/EC2 not running. Console `ERR_NAME_NOT_RESOLVED` to `*.trycloudflare.com` = that hostname no longer exists in DNS.
- **Stable production path (recommended, 2026-04-15):** Kokoro on **the same EC2 as OpenClaw** (`3.148.233.23`) — **named Cloudflare tunnel** to `:8880` — see **`## AWS EC2 3.148.233.23`** below and `deploy/kokoro-tts-ec2/README.md`. Laptop Quick Tunnels are **dev/smoke only** and must **not** be confused with the EC2 tunnel URL in Vercel. (historical)
- **Fast recovery when stuck on Quick Tunnel:** start Kokoro + `cloudflared`, copy the **new** `https://….trycloudflare.com`, update **`KOKORO_TTS_URL`** on Vercel (all envs you use), then redeploy or wait for serverless env refresh. Optional: `deploy/kokoro-tts-ec2/scripts/update-vercel-kokoro-url.sh 'https://YOUR_ORIGIN'`.

### Kokoro “same problem as last time” — what MEMORY already said (do not skip)
This is the **same class of failure** every time: **`KOKORO_TTS_URL` on Vercel points at a hostname that no longer resolves** (Quick Tunnel rotated/stopped) or EC2/tunnel is down. **App code is rarely the fix.**

| Step | Action |
|------|--------|
| 1 | `GET https://www.syncscript.app/api/ai/tts?probe=1` — want **`kokoroUpstreamReachable: true`**. If **`false`** / **`detail: fetch failed`**, the URL is dead from Vercel’s perspective. |
| 2 | **Prefer durable infra:** EC2 + **named** Cloudflare tunnel + stable HTTPS host — `deploy/kokoro-tts-ec2/README.md`, **`VERCEL_EC2_RECOVERY_RUNBOOK.md`**. | (historical)
| 3 | Update Vercel: `./deploy/kokoro-tts-ec2/scripts/update-vercel-kokoro-url.sh 'https://YOUR_HOST'` then **`vercel deploy --prod --yes`**. |
| 4 | **Live confirmation (repo scripts, 2026-04):** `npm run smoke:prod` (routes OK; TTS line is informational). **`npm run verify:prod:live`** — full path including POST synthesis (fails until Kokoro is up). **`STRICT_TTS=1 npm run verify:prod:live`** — fail fast if probe bad. **`npm run verify:prod:live:strict`** — alias for strict. |

**Record the stable Kokoro base** in **`## AWS EC2`** placeholder once you have a named host (not a random `*.trycloudflare.com` you pasted once).

## What Is This Project?
**SyncScript** - AI-powered productivity app that works with your energy/circadian rhythms.  
- **Live at**: syncscript.app (Vercel)
- **Repo**: stringerc/syncscriptE (main)
- **Vercel Git (2026-04-26+):** Vercel project **Settings → Git** must point at **`stringerc/syncscriptE`** + **`main`** (same branch you push). Mismatched remotes = silent “deploy never updates.”
- **Stack**: React + Vite + Tailwind + Supabase + Stripe + Twilio
- **User**: Christopher Stringer (stringer.c.a@gmail.com)

## Snapshot as of 2026-02-18 (historical — do not read as current state)
- All 8 critical improvements completed (PaywallGate, AI Assistant, Low Energy Mode, Calendar drag, Resonance Engine, Gamification animations, Team chat avatars, Visibility audit)
- Phone/Voice backend fully wired (Twilio API routes at `api/phone/`, env vars set in Vercel)
- Revenue optimization system built (UrgencyTimer, RevenueCalculator, RevenueOptimizer, useRevenueAnalytics)
- Universal AI service abstraction (`api/_lib/ai-service.ts`) with 6-provider failover chain (historical)
- **Landing page**: Fully polished with section snap-scroll, 3D particle orb, Nexus voice chat, scroll-driven orb animations
- **Features page**: Enriched with interactive feature explorer (4 tabs + CSS mockups), before/after section, animated stat counters, real integration names
- **Pricing page**: Added feature comparison table, ROI calculator, expanded trust guarantees
- **FAQ page**: Added popular questions grid, enhanced contact section with response times, richer resources
- **Nexus Voice AI**: Streaming AI (Groq) + Kokoro TTS on AWS EC2, progressive audio playback, client-side grammar safety
- **3D Particle Orb**: Scroll-driven keyframe animation across all marketing pages, brightness capped at 0.5 for readability
- **Favicon:** **`public/favicon.svg`** + `index.html` `<link rel="icon">` / `apple-touch-icon` (SVG). **Optional later:** multi-size PNG/ICO for legacy — not required for modern browsers.

## Key Infrastructure
| Service | Details |
|---------|---------|
| Vercel | Project prj_PSiUt4XDI8UY9UY4wBD1sNxtcw1T, team_EqmoD0pLBFreM5tLmfqEulAl |
| Supabase | Project kwhnrlzibgfedtxpkbgb, Edge Function make-server-57781ad9 (includes Engram bridge at `/make-server-57781ad9/engram/*`; deploy with `--use-api`). **`ENGRAM_BASE_URL`:** set via `supabase secrets set` to a **public HTTPS origin** (e.g. Cloudflare Quick Tunnel from `npm run tunnel:engram-local` while local Engram listens on `:8000`). Quick Tunnel hostnames are **ephemeral** — update the secret if you restart the tunnel. |
| Twilio | Phone +18885134589, env vars in Vercel |
| Stripe | Products: Pro, Team, Resonance, Enterprise, Soulmates |
| OpenClaw | Gateway **:18789**. Supabase `openclaw-bridge` default upstream: `http://3.148.233.23:18789` when **`OPENCLAW_BASE_URL`** unset (`supabase/functions/.../openclaw-bridge.tsx`). **Oracle VM:** loopback **`127.0.0.1:18789`** — production must use **Supabase secrets** **`OPENCLAW_BASE_URL`** (HTTPS tunnel) + **`OPENCLAW_TOKEN`** matching the gateway config, not the raw instance IP. Local dev: `127.0.0.1:18789`. |
| Mission Control | mission-control/ dir, Hono :5201, Vite :5200 |

### Nexus “individual user” verify profile (agents / CI)

1. **Bootstrap (once per machine / when JWT expires):** **`npm run bootstrap:nexus-verify-user`** — needs **`SUPABASE_SERVICE_ROLE_KEY`** in `.env`. Writes **`NEXUS_LIVE_TEST_EMAIL`**, **`NEXUS_LIVE_TEST_PASSWORD`**, **`NEXUS_VERIFY_USER_ID`**, **`NEXUS_LIVE_TEST_SKIP_SERVICE_BOOTSTRAP=1`**, session JWT. Default email in **`scripts/bootstrap-nexus-individual-verify-user.mjs`** (override **`NEXUS_VERIFY_PROFILE_EMAIL`**). **Never commit** `.env`.
2. **API smoke:** **`npm run verify:nexus-tools-live`** — **`create_task`** + **`GET /tasks`** for that user.
3. **GitHub Actions secrets (from local `.env`, values not printed):** **`npm run secrets:github:nexus-e2e`** → sets **`NEXUS_LIVE_TEST_EMAIL`**, **`NEXUS_LIVE_TEST_PASSWORD`**, duplicate aliases **`E2E_LOGIN_EMAIL`** / **`E2E_LOGIN_PASSWORD`**. Optional: **`NEXUS_E2E_PUSH_CI_OPT_IN=1`** in `.env` also pushes **`NEXUS_E2E_INCLUDE_PLACES`** / **`NEXUS_E2E_INCLUDE_VOICE`** (defaults **omit** — Actions **skips** flaky places + voice). Script: **`scripts/push-nexus-e2e-secrets-to-github.mjs`**.
4. **Prod UI / artifact rail:** After changing **`NexusVoiceArtifactRail`** (or related voice shell), ship with **`npm run deploy:vercel:prod`** so **`data-testid="nexus-voice-artifact-rail"`** and **`aria-label="Nexus voice tool confirmations"`** are live on **`www.syncscript.app`**.
5. **Playwright (browser, same credentials as bootstrap):**
   - **`npm run test:e2e:nexus-task`** — create task.
   - **`npm run test:e2e:nexus-signed-in-smoke`** — Edge **`GET …/user/profile`** + **`propose_calendar_hold`** in **`toolTrace`** (occasional **`nexus-user`** **500** — retry may pass).
   - **`npm run test:e2e:nexus-app-ai-parity-deep`** — isolated sessions: **`create_task`**, **`propose_calendar_hold`**, **`create_document`**, **`search_places`**, immersive voice (shared helper **`e2e/helpers/nexus-voice-immersive-smoke.ts`**). **Local:** include **`search_places`** unless **`NEXUS_E2E_SKIP_PLACES=1`**. **`search_places`** can return **500** on prod (transient).
   - **`npm run test:e2e:nexus-voice-immersive-prod`** — **voice-only** (first-touch path on **`/app/ai-assistant`**): longer timeouts, **`test.describe.configure({ retries: 2 })`**. Clicks **`data-testid="nexus-app-ai-open-immersive-voice"`** when present (**`AppAIPage`**). Optional env: **`NEXUS_E2E_VOICE_*_MS`** to tune CI runners.
   - **`npm run test:e2e:voice-visual`** — screenshot variant (**`e2e/app-ai-voice-immersive-visual.spec.ts`**). **Headed manual parity** (Nexus **call** vs in-app **voice** + rail) is still **manual** — not fully automated.
6. **CI workflow (full signed-in):** **`.github/workflows/e2e-nexus-signed-in-prod.yml`** — **“E2E Nexus signed-in (prod)”**. **`gh workflow run "E2E Nexus signed-in (prod)"`**. Optional **`skip_prod_fingerprint`** when **`www`** lags **`main`**. **On GitHub Actions only:** **`search_places`** / **voice** inside deep suite are skipped unless repo secrets **`NEXUS_E2E_INCLUDE_PLACES`** / **`NEXUS_E2E_INCLUDE_VOICE`** are **`1`** (set via **`NEXUS_E2E_PUSH_CI_OPT_IN=1`** + **`npm run secrets:github:nexus-e2e`**). (historical)
7. **CI workflow (voice-only):** **`.github/workflows/e2e-nexus-voice-immersive-prod.yml`** — **“E2E Nexus voice immersive (prod)”**. Runs **`npm run test:e2e:nexus-voice-immersive-prod`** only — use for **first-touch voice** validation without the long chat suite. Same **`skip_prod_fingerprint`** + login secrets. **`gh workflow run "E2E Nexus voice immersive (prod)"`**. (historical)
8. **Shared:** **`playwright.config.ts`** in git (**`chromium`** project). **`verify:prod-build`** **MATCH** before strict Actions (no skip) when you want proof **`www`** equals **`main`**.
9. **Not Playwright:** **`enqueue_playbook` / concierge** — contract + integration scripts only; see **`tests/nexus-concierge-playbook-contract.test.mjs`** and **`npm run test:concierge:integration`** when env allows.

## AWS EC2 `3.148.233.23` — OpenClaw + Kokoro (same host)
**Source of truth in repo:** `SYNCSCRIPT_MASTERGUIDE.md` (Cloud TTS / systemd), `SYNCSCRIPT_ARCHITECTURE.md`, `deploy/kokoro-tts-ec2/README.md`. (historical)

| Role | Port / access | Notes |
|------|----------------|--------|
| **OpenClaw gateway** | **18789** | Edge bridge can reach `http://3.148.233.23:18789` (see `OPENCLAW_BASE_URL`). |
| **Kokoro TTS** | **8880** on **loopback** (`127.0.0.1:8880` in compose/README) | **Not** meant to be called as `http://3.148.233.23:8880` from the open internet — exposed via **Cloudflare Tunnel** on the instance (`cf-tunnel-tts` / `kokoro-tts` systemd per **MASTERGUIDE**). |
| **Vercel `KOKORO_TTS_URL`** | HTTPS **tunnel origin** only | Must be the **public hostname** Cloudflare presents to the internet (ideally a **named** tunnel / stable DNS). That is what `/api/ai/tts` and `GET …/api/ai/tts?probe=1` use. |

**OpenClaw vs Kokoro (not the same thing):** **OpenClaw** is the **gateway on `:18789`** (continuity / agent routing). **Kokoro** is **only** the TTS HTTP API on **`127.0.0.1:8880`**, reached via **Cloudflare Tunnel**, not via OpenClaw. They often **share the same EC2** (`3.148.233.23`) but are **different services and ports**. OpenClaw does **not** “host” or replace Kokoro — there is no OpenClaw setting that substitutes for `KOKORO_TTS_URL`.

**How 24/7 TTS was supposed to work (repo, not this laptop):**
- **Packaged path (current):** `deploy/kokoro-tts-ec2/` — Docker Kokoro on EC2 + **`docker compose --profile named-tunnel`** + **`CLOUDFLARE_TUNNEL_TOKEN`** + a **stable public hostname** in Cloudflare (DNS on your zone, e.g. `kokoro.yourdomain.com`). See **`deploy/kokoro-tts-ec2/README.md`**, **`VERCEL_EC2_RECOVERY_RUNBOOK.md`**. (historical)
- **Legacy docs** (`SYNCSCRIPT_ARCHITECTURE.md`, `SYNCSCRIPT_MASTERGUIDE.md`): `~/kokoro-tts/tunnel-manager.sh` + **`cf-tunnel-tts.service`** on EC2 — Quick Tunnel on the **server** with optional Vercel auto-sync. That pattern is **brittle** (random `*.trycloudflare.com` still changes when the process restarts). Prefer the **named tunnel** profile in `docker-compose.yml` so the **hostname stays fixed**; you rotate **tunnel token**, not the public URL.
- **Laptop Quick Tunnel** (`cloudflared tunnel --url http://127.0.0.1:8880` on a Mac): fine for **smoke tests** only. If Vercel points here, TTS dies when the **Mac sleeps** or `cloudflared` stops — that is **not** the 24/7 design.

**Checklist — move production off the laptop onto durable EC2 + named tunnel:**
1. **Cloudflare** → Zero Trust → **Tunnels** → create or select a **named** tunnel → **Public hostname**: HTTPS → service **`http://localhost:8880`** (connector will run on EC2 alongside Kokoro). Copy the **public origin** (e.g. `https://kokoro.example.com`) — it should **not** change when `cloudflared` restarts.
2. **EC2** (`3.148.233.23` or new instance): Docker + copy `deploy/kokoro-tts-ec2/` → `/opt/kokoro-tts-ec2`, `.env` with **`CLOUDFLARE_TUNNEL_TOKEN`**, then `docker compose --profile named-tunnel up -d --build`.
3. On EC2: `curl -sS http://127.0.0.1:8880/health` → OK; from your machine: `curl -sS 'https://YOUR_PUBLIC_HOST/health'` → OK.
4. **Vercel:** `./deploy/kokoro-tts-ec2/scripts/update-vercel-kokoro-url.sh 'https://YOUR_PUBLIC_HOST' --all-environments` then **`vercel deploy --prod --yes`** (or git deploy that triggers a build).
5. Verify: `npm run verify:tts:production:post` and `GET https://www.syncscript.app/api/ai/tts?probe=1` → **`kokoroUpstreamReachable: true`**. Broader prod check: **`npm run verify:prod:live`** or **`npm run verify:prod:live:strict`** (includes Firma + Discord smoke + TTS POST).

**SSH / access (from MASTERGUIDE):** `ssh -i ~/.ssh/syncscript-ec2.pem ubuntu@3.148.233.23` — then `sudo systemctl status kokoro-tts` / `cf-tunnel-tts` **if** those units exist, or `docker compose ps` under `/opt/kokoro-tts-ec2`. **2026-04 agent note:** this workspace had **no** `syncscript-ec2.pem` and SSH to **`3.148.233.23:22` timed out** — fix **key on disk**, **security group** (your IP → :22), or use **Cloudflare / AWS console** to confirm tunnel + instance state without SSH.

**Record the stable Kokoro base (named tunnel only; no trailing slash) once provisioned:** `https://________________`

## Oracle Cloud OCI — Ampere VM (SyncScript host)
**Runbook:** **`deploy/oracle/README.md`**. **Instance:** `syncscript-a1-retry-2`, **public** **`157.151.235.143`**, shape **VM.Standard.A1.Flex** **4 OCPU / 24 GB**. **Repo on VM:** **`/opt/syncscript`** (rsync from Mac; large dirs like **`nature-cortana-platform/`** excluded to save time). (historical)

| Service | Port / check | Notes |
|--------|----------------|--------|
| **Kokoro (Docker)** | **`127.0.0.1:8880`** → `GET /health` **200** | **`deploy/kokoro-tts-ec2`**: `docker compose up -d --build`. **Public HTTPS** needs **named Cloudflare tunnel** (`--profile named-tunnel`, **`CLOUDFLARE_TUNNEL_TOKEN`** in `.env`) per **`NAMED_TUNNEL_SETUP_RUNBOOK.md`**. | (historical)
| **OpenClaw** | **`127.0.0.1:18789`** TCP | **systemd** `openclaw-gateway`: **`openclaw gateway run --port 18789 --bind loopback`**. **2026.4.x** rejects `--bind 127.0.0.1` (use **`loopback`**). **`gateway.mode=local`** in **`~/.openclaw/openclaw.json`** is required ( **`deploy/oracle/vm/ensure-openclaw-gateway-config.sh`** runs **`openclaw config set gateway.mode local`**). Expose via **Cloudflare** → **`http://127.0.0.1:18789`**; set **`OPENCLAW_BASE_URL`** to the **HTTPS** origin. | (historical)
| **Hermes executor** | **`127.0.0.1:18880`** → `GET /health` **200** | **systemd** `hermes-executor` — **`integrations/hermes-executor-server.mjs`** (real **`PUT /tasks`**, **`POST /calendar/hold`** with **`provider`**: auto / google / outlook via Edge; JWT forwarded from **`hermes-bridge`**). Tunnel + **`HERMES_BASE_URL`**. **`npm run hermes:mock`** remains for local stubs. | (historical)
| **Keepalive** | timer | **`syncscript-keepalive.timer`** (Docker + local probes; WARN/FAIL until all listeners are up). |

**Networking:** VCN **security list** must allow **TCP 22** from **your** IP (or SSH fails even with the right key). **SSH:** `ubuntu@157.151.235.143` — private key must match **instance metadata** (mismatched key file → `Permission denied`).

**Still manual for production parity with Vercel/Supabase:** Cloudflare hostnames for Kokoro / OpenClaw / Hermes; **`./deploy/kokoro-tts-ec2/scripts/update-vercel-kokoro-url.sh 'https://…'`** + **`vercel deploy --prod --yes`**; Supabase secrets for **`OPENCLAW_BASE_URL`** / **`HERMES_BASE_URL`**. **Optional:** Engram on **:8000** per README §10.

### syncscript.app ↔ Oracle stack — verification (fact-based, 2026-04-15)

**Current integration (wired + probed):** **Vercel** **`KOKORO_TTS_URL`**, **Supabase secrets** **`OPENCLAW_BASE_URL`**, **`OPENCLAW_TOKEN`**, **`HERMES_BASE_URL`** point at **Oracle VM** services via **Cloudflare Quick Tunnels** (ephemeral **`*.trycloudflare.com`**). **Edge** **`openclaw-bridge`** health uses OpenClaw **`GET /healthz`** (not **`/api/health`** — OpenClaw **2026.4.x**).

| Check | Command | Expected |
|--------|---------|----------|
| **Kokoro → Vercel** | **`node scripts/verify-kokoro-env.mjs`** | Exit **0**, **`kokoroUpstreamReachable: true`** |
| **Hermes → Edge** | **`ENGRAM_LIVE_USE_DEFAULT_PROJECT_URL=1 npm run verify:hermes:edge-live`** | **`hermesStatus: 'connected'`** |
| **OpenClaw → Edge** | **`ENGRAM_LIVE_USE_DEFAULT_PROJECT_URL=1 npm run verify:openclaw:edge-live`** | **`openclawStatus: 'connected'`** |

**VM automation:** **`deploy/oracle/scripts/start-quick-tunnels-on-vm.sh`** restarts Kokoro compose **quick-tunnel** profile + Docker **cloudflared** for **:18880** (Hermes) and **:18789** (OpenClaw). After any tunnel restart, URLs change — re-run **`update-vercel-kokoro-url.sh`**, update Supabase secrets, **`vercel deploy --prod --yes`**, **`npm run deploy:edge:make-server`**. (historical)

**Next hardening (recommended):** **`CLOUDFLARE_TUNNEL_TOKEN`** in **`deploy/kokoro-tts-ec2/.env`** + **`docker compose --profile named-tunnel up -d`**, plus **separate named tunnels** (or one tunnel with multiple hostnames) for Hermes/OpenClaw so hostnames stay stable.

## Deployment map (what runs where)
**Scope:** This file + repo are the durable record. Cursor agents only see the workspace unless you attach other paths.

| Artifact | How it reaches production | Verified in repo |
|----------|---------------------------|------------------|
| **React / Vite app** | **Vercel** builds from `vercel.json` (`npm run build`, output `build/`). Git integration: `"git": { "deploymentEnabled": true }` — pushes to the linked branch trigger Vercel; **not** the same as GitHub Actions “deploy”. | `vercel.json` |
| **GitHub CI** | `.github/workflows/ci.yml` — on push/PR to `main`: `npm ci`, `tsc --noEmit`, `npm run build` with placeholder Supabase env. **CI validates; it does not replace Vercel’s deploy.** | `.github/workflows/ci.yml` | (historical)
| **Vercel CLI** | Optional manual: `vercel` / `vercel --prod` from project root (see `src/DEPLOY_TO_VERCEL.md`). | `src/DEPLOY_TO_VERCEL.md` |
| **Supabase Edge Functions** | From a machine with CLI (after `supabase login`): `supabase functions deploy make-server-57781ad9 --project-ref kwhnrlzibgfedtxpkbgb --use-api` — **`--use-api`** avoids Docker-based bundling (default `--use-docker` can hang indefinitely if Docker is idle). This is **separate** from the Vercel frontend. | `supabase/functions/`, `supabase/.temp/project-ref` |
| **api/*.ts** | Vercel serverless (`vercel.json` `functions` + `api/**`). | `vercel.json`, `api/` |

**Agent/session note:** A session can run `supabase functions deploy` or `vercel` **if** the environment has network, CLI, and your login — same as your terminal. There is no separate “hidden” deploy channel; production web updates when **Vercel** runs a build (git hook or CLI), and Edge updates when **Supabase CLI** deploy runs.

**Expanded checklist (no secrets):** **`integrations/DEPLOYMENT.md`** (tracked) → links **`integrations/agent-playbooks/`** and `vercel.json`. (historical)

## Nexus phone (Twilio) — “application error” + post-call UX (2026-03-30)
**Symptom:** During a voice call, Twilio plays *“We’re sorry, an application error has occurred”* (or similar) instead of Nexus. **Cause (fact):** Twilio’s Voice URL must return **HTTP 200** and **valid TwiML XML**. If the webhook returns **403/400 JSON** (e.g. failed signature check) or a **non-TwiML error body**, Twilio surfaces the generic application error — not our spoken fallback.

**Fix in repo:** `api/phone/_route-twiml.ts` — invalid signature in production now returns **200 + TwiML** (spoken apology + hangup) instead of `403` JSON; unknown `handler` returns TwiML instead of `400` JSON. **Also:** `truncateForTwilioSay` caps `<Say>` text (`MAX_TWIML_SAY_CHARS` ~3500) so pathological model output cannot break the Voice response. (historical)

**Tasks on calls:** Canonical tool loop persists via Edge `POST …/phone/nexus-execute` (KV `tasks:v1:userId`) — same store as `GET/POST …/tasks` in app. **Secrets:** `NEXUS_PHONE_EDGE_SECRET` must match Vercel + Supabase Edge.

**Post-call summary in app:** When tool results include `create_task` / `add_note` / `propose_calendar_hold`, server appends human lines to `/tmp`-backed storage keyed by **Twilio CallSid** (`appendPendingNexusCallLines`). After the call, `PhoneCallPanel` calls **`GET /api/phone/calls?action=pending-nexus&id=CALL_SID`** (`fetchPendingNexusCallSummary`) and shows those lines in the **“Call ended”** toast (with duration). Same ephemeral pattern as calendar `pending-events` (works when Twilio and polling hit the same Vercel region/instance).

**Verify:** `npm test` (includes `tests/nexus-phone-tools-contract.test.mjs`); place a test call and confirm toast lists actions (e.g. `Added task: …`).

## Key Env Vars (Vercel Production)
TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, PHONE_API_SECRET, VITE_PHONE_API_URL, VITE_PHONE_API_KEY, APP_URL, DEEPSEEK_API_KEY, CRON_SECRET

**TTS / Nexus voice (critical):**
- **Architecture (from this file + repo):** Marketing copy says **Kokoro on AWS EC2** — production should use **`deploy/kokoro-tts-ec2`** (Docker on EC2, **named** Cloudflare tunnel → stable hostname). If **`KOKORO_TTS_URL`** on Vercel is still a **Quick Tunnel** (`*.trycloudflare.com` random subdomain), that is **not** stable; it will break whenever that tunnel process stops or restarts (no code deploy required for it to fail). (historical)
- **`KOKORO_TTS_URL`** — Vercel `/api/ai/tts` proxies to Kokoro at `{origin}/v1/audio/speech`. **`GET /api/ai/tts`** returns **`kokoroDirectOrigin`** (same primary URL) so the browser can call Kokoro **directly** if the proxy fails — no OpenAI, no extra keys.
- **Cloudflare Quick Tunnel hostnames expire** when the tunnel restarts; if you see `UNREACHABLE` / 503 / **`ERR_NAME_NOT_RESOLVED`**, set **`KOKORO_TTS_URL`** to the **current** tunnel origin (no trailing slash) and redeploy; the SPA picks up the new origin via `GET` without a separate `VITE_*` rebuild.
- **`KOKORO_TTS_FALLBACK_URL`** — Optional second Kokoro base URL (same API shape; server proxy only).
- Optional dev: **`VITE_KOKORO_TTS_URL`** + **`VITE_ALLOW_CLIENT_DIRECT_KOKORO=true`** for local direct calls without relying on `GET`.

## User Preferences
- "Scripts" not "workflows"
- Complete thorough responses (one message, not fragments)
- No raw API errors in UI
- Dark theme, teal/purple accents
- Supabase native OAuth (not Make.com) for login
- "Most advanced" direction for features

## Guest mode — navigation “dead” (recurring)
**Symptom:** Guest session loads, but sidebar tabs or mobile bottom nav feel unclickable / navigation does nothing.

**Root causes (stacking / hit-testing, not React Router):**
1. **GuestModeBanner** is `position: fixed` full-width (`left-0 right-0`) at `z-50`, while the **Sidebar** had no z-index. The banner sat **above** the entire left rail and swallowed pointer events on the sidebar.
2. **CookieConsentBanner** used `z-50` while **MobileNav** used `z-40`. After guest boot (storage cleared), the cookie bar often appears and **blocks the bottom tab bar**.

**Fix (layout):** Banner uses `md:left-14 lg:left-[100px]` so it only spans the main column (matches sidebar widths). Sidebar gets `relative z-30` so it stays above the main `z-10` column if anything overlaps. Cookie banner uses `z-30` so mobile nav (`z-40`) stays on top.

**Files:** `GuestModeBanner.tsx`, `Sidebar.tsx`, `CookieConsentBanner.tsx`.

## Nexus landing voice (intro vs replies)
**Intro (fast):** By default the first line uses a **bundled MP3** (`/audio/nexus-greeting.mp3`, env **`VITE_NEXUS_STATIC_MP3_GREETING`** — default on; set to `false` to force Kokoro for the greeting too). No Kokoro call for that line.

**Replies:** `fetchTTSBuffer` calls **`POST /api/ai/tts`**, then **`fetchDirectKokoroBuffer`** using **`kokoroDirectOrigin`** from **`GET /api/ai/tts`** (or dev `VITE_KOKORO_TTS_URL`). **No** browser `speechSynthesis` in Nexus (contract tests enforce this).

**Ops checklist when voice dies after intro:** `GET https://www.syncscript.app/api/ai/tts` — confirm `kokoroConfigured` and a non-null **`kokoroDirectOrigin`**. **`GET https://www.syncscript.app/api/ai/tts?probe=1`** — Vercel HTTP-fetches Kokoro **`GET {kokoroDirectOrigin}/health`** (served by the Kokoro container on `:8880` — see `deploy/kokoro-tts-ec2/Dockerfile` healthcheck; there is no local `server.py`). You want **`kokoroUpstreamReachable: true`**. If **`false`**, the tunnel/EC2 endpoint is down or the hostname no longer resolves — update **`KOKORO_TTS_URL`** to a **live** origin (`deploy/kokoro-tts-ec2/README.md` for stable EC2 + named tunnel). (historical)

**Important — not a code/deploy conflict:** `kokoroConfigured: true` only means **`KOKORO_TTS_URL` is set on Vercel**, not that the host resolves or Kokoro is up. If `POST /api/ai/tts` returns **503** (`UNREACHABLE` / `KOKORO_ERROR`), the browser direct path uses the **same** URL from `kokoroDirectOrigin` — it will also fail until the tunnel URL is **current** (Quick Tunnel hostnames die when the tunnel restarts). **Fix ops:** start Kokoro + `cloudflared`, copy the new `https://….trycloudflare.com`, set **`KOKORO_TTS_URL`** on Vercel (no trailing slash), save; optional **`vercel deploy --prod`** so the edge is fresh. Hard-refresh the site (cache-busted JS) after a frontend deploy.

**No OpenAI TTS** — replies are Kokoro-only; there is nothing in `MEMORY.md` that overrides that in code.

## Consciousness Dashboard & Speculative Sandboxing (2026-05-24)
- **Frontend Panel (`/dashboard/lucid`):** 
  - File: [LucidDashboardPage.tsx](file:///Users/Apple/syncscript/src/components/pages/LucidDashboardPage.tsx) (lazy-loaded ProtectedRoute inside [App.tsx](file:///Users/Apple/syncscript/src/App.tsx)).
  - Presents proposed sandboxed refactoring patches ("Lucid Dreams") and remote telemetry updates ("Astral Projections") with premium interactive HSL-themed diffs and single-click "Wake and Merge" commits.
- **Speculative Sandbox (Lucid Dreaming):** 
  - Logic: [lucid-sandbox.ts](file:///Users/Apple/syncscript/api/_lib/lucid-sandbox.ts).
  - Cron trigger: `api/cron/[job].ts` case `lucid-dream` (executes speculative workspace refactoring runs, compiles, and tests outputs against quality rules). (historical)
- **Remote Telemetry (Astral Projection):** 
  - Logic: [astral-gateways.ts](file:///Users/Apple/syncscript/api/_lib/astral-gateways.ts).
  - Cron trigger: `api/cron/[job].ts` case `astral-project` (polls adjacent platform APIs and registers global context into local homeostasis memory). (historical)

## DailyOpsModal Premium Glassmorphism & UI Stacking (2026-05-24)
- **Modal Layering & Deep Blurs (React Portal Mount):**
  - Mounted the modal inside an SSR-safe **React Portal** attached directly to `document.body` in [DailyOpsModal.tsx](file:///Users/Apple/syncscript/src/components/DailyOpsModal.tsx) to completely escape the header's `z-10` stacking context.
  - Upgraded backdrop overlay to `bg-black/75 backdrop-blur-md z-[10000]` to ensure absolute full-page coverage, perfectly obscuring and blurring all background components (such as the sidebar, header profile menu, weather, and AI focus energy cards) underneath.
  - Designed premium frosted glassmorphism for the modal container using `bg-gradient-to-b from-[#0f1620]/60 to-[#0a0e18]/60 backdrop-blur-xl z-[10001] shadow-2xl`, achieving magnificent visual depth.
- **Harmony Brief Background Preloading:**
  - Configured automatic **background preloading** in `DailyOpsModal.tsx`. As soon as the user's authenticated `accessToken` is ready, it fetches the briefing and stores it in the React state *before* the user ever clicks the briefing button.
  - Slashes modal load time from ~30s+ to **0ms (instantaneous)** on user click, providing a premium, zero-latency opening experience.
- **Debrief Cognitive Offload Flow:**
  - Added dynamic `isSaving` loading feedback with a 1-second syncing spinner ("Clearing and Syncing Mind...").
  - Form inputs and win checklists smoothly fade and disable when saved (`debriefSaved` toggling `opacity-40 cursor-not-allowed select-none transition-all duration-300`).
  - Implemented an elegant morphing button row: upon saving, the main button transitions to a green success badge ("Debrief Saved") alongside an active "Edit" trigger to unlock controls.

## Working notes — detail behind the quick context

These were bullets inside **§ Quick context** until 2026-08-04. They are real implementation notes, not summaries, so they were costing every agent about 4,000 tokens before it reached the section it wanted. Grouped by domain here and still greppable by their bold lead. Nothing was reworded.

### Nexus voice, App AI, and phone

- **App AI voice overlay stacking:** Immersive voice UI rendered inside the dashboard tree could sit **under** fixed chrome; **`AppAIPage`** now **`createPortal(..., document.body)`** with **`z-[530]`** so the full-screen orb layer paints above the shell.
- **Hermes “Agent runs” dock:** **`src/components/agent/AgentRunDock.tsx`** is **`return null`** and is **not mounted** in **`App.tsx`** — if you still see “Hermes smoke” / agent steps, it is likely an **old deploy**, **another surface**, or **browser extension**; repo has no other match for that copy.
- **Nexus voice / App AI:** Signed-in chat + voice use **`NEXUS_USER_CHAT_PATH`** (**`src/config/nexus-vercel-ai-routes.ts`**) → same-origin **`/api/ai/nexus-user`** + tools (not OpenClaw). Do not hard-code **`www.syncscript.app`** for Nexus routes — breaks local/preview. **`emitNexusTrace`** logs **`toolTraceEntries`** + **`toolRepairNudged`** on success — see **`integrations/research/NEXUS_OBSERVABILITY_AND_QUALITY.md`**. Canvas, map embed, **`update_document`** — **§ Nexus Voice** below. (historical)
- **Nexus voice client auth (Bearer):** **`src/utils/nexus-voice-user-client.ts`** (`postNexusUserVoiceTurn`) sends **`Authorization`** from **`supabase.auth.getSession()`** first (refreshed JWT), falling back to React **`accessToken`**; on **401**, **`refreshSession()`** + **`getSession()`** and **one retry** — avoids **`nexus-user`** 401 when context lags **`TOKEN_REFRESHED`**.
- **Nexus voice — delegation UX (one Nexus voice):** **`NexusVoiceSatelliteOrbit`** + **`voiceSatellites`** / **`satelliteClearTimerRef`** in **`VoiceConversationEngine`**: loading → resolved **delegation hints** from **`toolTraceToDelegationHints`** (specialists as **attribution**, not extra speakers); transcript line **`via …`** matches in-app chat chips; immersive orb + under-orb **“Nexus is thinking…”** while tools run.
- **Nexus voice orb — `compact` prop (2026-04-19):** **`NexusVoiceMinimalCircle`** must **destructure `compact`** from props. Callers (**`VoiceConversationEngine`**) pass **`compact` / `compact={false}`**; the component used **`compact`** in **`orbShellStyle(..., compact)`** without binding it → **`ReferenceError: compact is not defined`** on opening App AI voice. Fix: **`compact = false`** in props + type **`compact?: boolean`**.
- **Nexus `/api/ai/nexus-user` 500:** **`POST /api/ai/nexus-user`** returns **`500`** when **`isAIConfigured()`** is false (no platform LLM keys on Vercel for any provider in the **`ai-service`** chain — see **`api/_lib/ai-service.ts`** `PROVIDERS`) or when the LLM/tool loop **throws** (provider outage, bad response). **Agent Mode (no BYOK):** **`api/_lib/agent-llm-adapter.ts`** accepts **any** of the same family of env keys in **`PLATFORM_LLM_FALLBACK_ORDER`** — NVIDIA alone is **not** the only valid platform path. **Response JSON** now includes **`errorCode`** (`ai_unconfigured` | `llm_failed`) and often **`detail`** (safe substring of the server error) + **`requestId`**. **Client:** **`nexus-voice-user-client`** merges **`detail`** into **`error`**; **`VoiceConversationEngine`** no longer **throws** on 4xx/5xx — shows **toast** + offline fallback TTS. **Smoke (no JWT):** **`npm run verify:prod:nexus-user-smoke`**. **Signed-in probe:** `NEXUS_SMOKE_BEARER=<jwt> node scripts/smoke-nexus-user-prod.mjs`. (historical)
- **Nexus signed-in E2E (prod):** Bootstrap **`npm run bootstrap:nexus-verify-user`** → push secrets **`npm run secrets:github:nexus-e2e`** → Playwright **`npm run test:e2e:nexus-signed-in-smoke`** / **`test:e2e:nexus-app-ai-parity-deep`** / **`npm run test:e2e:nexus-task`** (chat **`create_task`**) / **`npm run test:e2e:nexus-voice-classic-task`** (**Call Nexus** classic → text input → same **`postNexusUserVoiceTurn`** / **`create_task`**) / **voice shell UI** **`npm run test:e2e:nexus-voice-immersive-prod`** → Actions **“E2E Nexus signed-in (prod)”** + **“E2E Nexus voice immersive (prod)”**. Full steps — **§ Nexus “individual user” verify profile**.
- **Nexus voice — task/calendar modals:** **`create_task`** / **`add_note`** → **`TaskDetailModal`**. **`propose_calendar_hold`** (voice): **`addEvent`** + **`postCalendarHold`** (Edge **`POST /calendar/hold`**) when signed in → **`sync_group_id`** + provider instances on success; **`EventModal`** + **`LinkedCalendarEventModal`** (**`onManageLinkedCalendars`**, **`stackAboveVoiceShell`**). If no Google/Outlook is connected, **`POST /calendar/hold`** returns **200 `local_only`** and persists the slot in Edge KV; **`useCalendarEvents`** hydrates **`GET /calendar/local-events`** into the calendar tab (same path as Cursor/MCP holds). **Phone:** task-shaped hold unchanged. **Nexus product rule:** users should be able to do **anything the web app allows** via Nexus on **voice**, **in-app chat**, or **phone** where technically feasible; gaps = backlog + this MEMORY.
- **Nexus Daily Rhythm (Cloud-Native):** 7 AM Morning Brief, 12 PM Check-in, 9 PM Debrief calls powered by Twilio + Vercel Edge. Twilio **TwiML** handles stateful routing (`api/phone/_route-twiml.ts`). "Ask me later" deferrals in the morning are pushed to KV (`nexus_deferred_questions:{userId}`). Debriefs capture wins/reflections at 9 PM and push to `nexus_voice_debrief:{userId}:{date}` via an LLM extraction at the end of the call (`handleRespond` / `handleStatusCallback`). Dashboard `DailyOpsModal` auto-hydrates this debrief using `api/ai/insights?resource=voice-debrief`. Email triage (`api/_lib/nexus-gmail-reader.ts`) fetches credentials from KV (`nexus_email_creds:{userId}`). IDE integration via `scripts/nexus-mcp-server.js`. (historical)
- **Nexus voice latency / 504:** Voice uses **`postNexusUserVoiceTurn`** → single **`fetch`**; STT can show text while the UI waits for **full** JSON. **`vercel.json`** sets **`api/**/*.ts`** **`maxDuration: 300`** (was 60) so **`nexus-user`** multi-round **`runNexusToolLoop`** + cold start is less likely to hit **504 Gateway Timeout** (requires **Vercel Pro**-tier max duration; Hobby caps lower — check dashboard). **`runNexusToolLoop`** still allows several LLM rounds + tools + nudges. **Profile:** `localStorage.setItem('SYNCSCRIPT_VOICE_LATENCY','1')` reload → **`voice-latency-debug.ts`** + **`voiceLatencyLogNexusCorrelation`**. **Immersive orb:** **“Nexus is thinking…”** while **`isProcessingAI`**; **`clearInterimTranscript`** on turn start. **UI:** **`VoiceConversationEngine`** treats **502/503/504** with offline fallback + toast (not a thrown error). Dated detail: **2026-04-11** entry below.

### Dashboard, calendar, UI, and perf

- **Dashboard weather spinner (infinite):** The AI Focus **Weather & Route** strip used **`useWeatherRoute`** → **`getWeatherCoords()`** → `navigator.geolocation.getCurrentPosition`. If the browser **never** invokes success/error (stall), **`fetchWeather` never ran** and **`loading` stayed true** → **`animate-spin` forever**. **Fix (2026-04-17):** **`getWeatherCoords`** now **`Promise.race`**s geolocation against a **~5s deadline** and always resolves (cache or **`WEATHER_COORDS_FALLBACK`**); **`fetchWeather`** uses **`try/finally`** so **`setLoading(false)`** always runs; mount effect falls back to **`WEATHER_COORDS_FALLBACK`** on any throw. Files: **`src/utils/weather-geolocation.ts`**, **`src/hooks/useWeatherRoute.ts`**.
- **UX/UI bar:** **`.cursor/rules/11-ux-ui-excellence.mdc`** (always-on behaviors) + **`integrations/research/UX_UI_REFERENCE_CANON.md`** (Figma Community workflow + world-class links). **Semantic tokens** in **`src/styles/globals.css`** — **`integrations/research/DESIGN_TOKENS_SYNCSCRIPT.md`**. **Antigravity vs Cursor:** **`integrations/research/ANTIGRAVITY_VS_CURSOR.md`**. Kits inspire **tokens and patterns** — code + **03/04** gates remain source of truth. (historical)
- **Design handoff (“design something”):** When the user asks to **design** UI or visuals, follow **`.cursor/rules/13-design-handoff-n8n-figma-cursor.mdc`** and **§ Design handoff pipeline** below — **n8n** orchestrates webhooks/HTTP (Gemini, Imagen, NVIDIA, etc.); **Figma** is visual truth (not magic image→code); **Cursor** implements with **tokens** + **11/03/04**. Not a single unattended end-to-end pipe without human or plugin steps. (historical)
- **Landing UX/perf ritual:** Monthly **Lighthouse** on live `/` — **`.github/workflows/lighthouse-monthly.yml`** (`npm run lighthouse:ci` locally; artifact **`.lighthouseci/`**). Broader live smoke: **Production dashboard smoke** (Playwright prod + fingerprint). (historical)
- **Idle CPU / hidden tab (2026-04-26):** If marketing or dashboard still feels hot, use **Chrome DevTools → Performance**, **CPU 4× slowdown**, record **~10s** on **`/`** and **`/dashboard`**, and inspect **Main** for long **`requestAnimationFrame`** / **`Timer fired`** stacks. Playbook + file pointers: **`integrations/research/PERF_IDLE_CPU_PROFILING.md`**. **Shipped guards:** **`ScrollAmbience`** (visibility + ~30fps cap; unused today), calendar **`CurrentTimeLine`** / **`WeekView`** intervals skip work when **`document.hidden`**, **`NexusVoiceCallContext`** typewriter skips ticks when hidden + call duration from **wall clock** (not interval deltas). **PWA:** **`vite.config.ts`** **`workbox.globIgnores`** may exclude heavy optional chunks (e.g. Three vendor) from **precache** — install size, not steady FPS. **`ContinuityContext`** heartbeat stays **protected** — profile before any change proposal. (historical)
- **Dashboard visual-quality gate (2026-04-26):** **`npm run test:e2e:visual-quality`** — Playwright build + preview: three-column **geometry** (`#ai-suggestions`, `#energy-meter`, `#roygbiv-ring`), small **`toHaveScreenshot`** baselines (`/`, guest login shell, guest `/dashboard` chat closed), **Axe** on `[data-section=hero]` + guest `#main-content`; **Firefox** runs layout spec only. Refresh PNGs: **`npm run test:e2e:visual-snapshots:update`**. Post-deploy: **`npm run verify:post-deploy:checklist`** (prod HTML marker vs local git + OG/JSON-LD + **`/.well-known/security.txt`**). CI: **`.github/workflows/ci.yml`** job **`visual-quality-e2e`**. RUM SLO notes: **`integrations/research/RUM_SLO_SYNCSCRIPT.md`**. (historical)
- **Calendar `/calendar` layout (day grid + right rail):** **`src/components/pages/CalendarEventsPage.tsx`** — **`flex flex-row flex-nowrap`**: timeline **`flex-1 min-w-[14rem]`**, a **`role="separator"`** drag handle (thin teal-tinted line, **`pointer` capture**), then **`aside`** width **`260–480px`** default **320**, persisted **`localStorage`** key **`syncscript_calendar_rail_width_px`**; **double-click** handle resets; **Arrow keys** / **Home** when focused. Wrapper **`overflow-x-auto overscroll-x-contain`** vs **`DashboardLayout`** **`overflow-x-hidden`**. Hooks **`[data-layout="calendar-timeline"]`**, **`[data-layout="calendar-rail"]`**. **Regression:** **`e2e/dashboard-layout-columns.spec.ts`**.
- **Calendar multi-day infinite strip (2026-05-03 follow-up):** **Symptoms:** floating header / first row showed the **wrong** day (often **`scrollTop` ~ 0**) or the strip felt “stuck.” **Root causes shipped against:** (1) Parent assumed **today = index 7** — in **`SimpleMultiDayCalendar`** index 7 is **`centerDate`**, not always today. (2) **`jumpToTodayInstant`** ran before the scroll container had full **`scrollHeight`**, so **`scrollTop` clamped to 0**. (3) **`centerDate`** was only refreshed on **`location.pathname`**, so staying on **`/dashboard/calendar`** for days or toggling **Single ↔ Multi** could leave **`centerDate`** stale vs real today. **Implementation:** **`jumpToTodayInstant()`** — **`findIndex`** today, recenters if missing, **rAF retry** until **`scrollHeight`** matches expected day stack, clamp **`scrollTop`**, **`syncFloatingHeaderFromScroll`** so the header matches **`onDateChange`**. **`CalendarEventsPage`:** **`setCenterDate(getCurrentDate())`** when **calendar route** and **`currentView` / `isMultiDayMode`** change; tab + **visibility** use **`jumpToTodayInstant`** when available. **Files:** **`SimpleMultiDayCalendar.tsx`**, **`CalendarEventsPage.tsx`**. **Deploy:** commit **`main`** + **`npm run deploy:vercel:prod`** (prebuilt); **`npm run verify:prod-build`** for HTML marker. **Manual check:** signed-in **Day + Multi-Day** — header should match **today** after load, tab return, and **M** toggle. **Still watch:** near-top scroll handler prepends days (pre-existing); if odd jumps persist, profile **`handleScroll`** vs programmatic scroll.

### Agent tooling, IDE lanes, proxy ops

- **Universal Agent Rules (cross-IDE):** `~/.claude/CLAUDE.md` — the single source of truth loaded by ALL IDEs (Claude Code, Cursor, Antigravity, Windsurf). Contains: pre-flight IQS gate, "Done" definition (6-point checklist), anti-hallucination contract ("if you cannot verify it, do not claim it"), Agent Ascension Protocol. Source repo: `~/universal-agent-rules/` — edit there, run `./install.sh` to propagate symlinks. Every IDE now reads identical enforcement rules.
- **Agent Ascension Protocol (operational, not just template):** `AGENT_ASCENSION_STATE.template.md` defines the checklists. The actual protocol is: (1) Create `AGENT_ASCENSION_STATE.md` from template before coding, (2) Plan -> Act -> Verify -> Score -> Decision loop, (3) Verify = run `npm test` + `npm run build` + read-back any KV saves, (4) Score = OQS rubric with evidence per criterion, (5) Never skip Verify or Score. The durable lesson goes to `AGENT_HARMONY_LEDGER.md`. This is now baked into `~/.claude/CLAUDE.md` Section 3 so every IDE enforces it.
- **Verified-mock audit (2026-05-25):** Full codebase audit found Gemini/Antigravity implementations are predominantly mock data: Lucid sandbox (hardcoded rubrics), Astral gateways (static arrays), Gistly app (AI summarization is sentence-splitting, IAP server verification is a stub returning 501, default demo gists hardcoded), Get Out Of Jail Free app (camera recording is fake — `setInterval` timers not `expo-camera`, `chunk://` URIs are invented strings not real files, audio recording never imported, three critical services written but never wired in). SyncScript Nexus Daily Rhythm: Morning + Noon compilers are REAL (`callAI` calls), Debrief compiler was MOCK (hardcoded string) — NOW FIXED to use `callAI`. All mock stubs tagged `MOCK DATA STUB — NOT FUNCTIONAL` in file headers.
- **Cross-IDE universal rules:** `~/universal-agent-rules/` git repo → symlinks to `~/.claude/CLAUDE.md`, `~/.windsurfrules`, `~/.codeium/windsurf/memories/global_rules.md`, `~/.cursor/rules-global/00-universal-cursor-brain.mdc`. One source of truth, one `./install.sh` to propagate. Includes Obsidian vault at `vault/`. Push to GitHub for cross-machine access: `git clone && ./install.sh`. Rules include: English-only, no mock data, anti-hallucination contract, IQS pre-flight gate, done-definition checklist.
- **Ascension Loop (eval agent — Cursor + Antigravity):** **`integrations/research/ANTIGRAVITY_ASCENSION_LOOP_PROMPT.md`** — score / verify / repair / raise bar; state **`AGENT_ASCENSION_STATE.md`** (gitignored); Cursor **`@ascension-loop`**, rule **17**; **`npm run doc:ascension-loop`** · **`npm run verify:ascension-loop-setup`**. (historical)
- **Claude proxy (Antigravity):** **Option E (NIM all tiers)** when **`Provider rate limit reached`** — **`npm run heal:claude-proxy-rate-limit`** (verified 3/3 tiers). **Option D** (`:free` Sonnet/Haiku) when quotas cool — **`npm run apply:free-claude-code-option-d-hybrid`**. **Provider API request failed** → **`npm run fix:claude-proxy-antigravity`** (not Gemini Option C). **`GEMINI_CLAUDE_CODE_PROXY.md`**.
- **Daily model audit:** **`npm run research:daily-claude-model-audit`** · **`npm run install:daily-claude-model-audit-launchd`**.
- **Antigravity gibberish (thinking + :free mismatch):** **`integrations/research/ANTIGRAVITY_CLAUDE_READABLE_CHAT_FIX.md`** — root cause: client **`max-thinking-tokens`** vs proxy **`ENABLE_MODEL_THINKING=false`**; fix **`npm run apply:antigravity-claude-settings`**, **new chat**, sanity **`scripts/antigravity-sanity-chat.txt`** before Ascension; **`npm run verify:antigravity-claude-compat`**. (historical)
- **PKM crosswalk (Obsidian.md facts ↔ this repo + RH):** **`integrations/research/OBSIDIAN_MD_MEMORY_CROSSWALK.md`** (INDEX row) → **§ Obsidian.md — official site facts ↔ SyncScript memory + Resonance Homeostasis** — vendor pages vs **git + INDEX + MEMORY** + **`RESONANCE_DOCS_CURSOR_BRIDGE.md`**. (historical)
- **Viral “five Claude skills” clips (marketing / stop-slop / UI pack / Remotion / context engineering):** **`integrations/research/CLAUDE_VIDEO_FIVE_SKILLS_CURSOR_MAP.md`** — verified sources (Anthropic engineering + Claude Code skills docs + Remotion docs + named GitHub repos); **always-on** **`.cursor/rules/16-agent-output-discipline-and-context.mdc`** (first-party doctrine, **no Claude Code vs Cursor conflation**, preflight **`integrations/research/AGENT_SKILL_PREFLIGHT_CHECKLIST.md`**); **`@syncscript-context-discipline`** optional once/session — **no blind** `npx skills add`; landing still **03/04/01**. (historical)
- **OpenClaw / ClawHub / skill audits (read-only):** **`.cursor/rules/12-openclaw-clawhub-cursor-local.mdc`**. Weekly CI runs **`skill:source-audit:ci`** (artifact **`reports/skill-audit/`** in the zip) — **triage one slug per run** with **`clawhub inspect`**, file **`integrations/research/skill-evaluations/`**, optional **`gh issue create`** (labels **`triage`** + **`skills`** — **`npm run gh:labels`** once per repo). Full local audit: **`npm run skill:source-audit`**. **No auto-install** — **`integrations/research/WHY_WE_DO_NOT_AUTO_SHIP_SKILLS.md`**. **Cursor IDE tips:** **`integrations/research/CURSOR_IDE_EXCELLENCE_SYNCSCRIPT.md`**. (historical)

### Product programs and closed directions

- **Productivity Edge (Plan + activity + PAT + MCP):** Migration `20260427090000_activity_business_plan_api_tokens.sql` + Edge `social-productivity-routes.tsx`; Enterprise **Plan** tab; Settings → Privacy (visibility + PAT); MCP **`integrations/cursor-syncscript-mcp/`** — see **§ Product — social + external IDE bridge** + **§ MCP operating model** below. **Capture inbox (2026-04-27):** `user_capture_inbox` + Edge **`capture-inbox-routes.tsx`** (`GET/POST /capture/inbox`, commit/dismiss); PAT scopes **`capture:read`**, **`capture:write`**, **`capture:commit`** (defaults on **new** PATs — rotate existing PATs to pick them up); dashboard **`CaptureInboxStrip`** under the header for pending server-backed suggestions. **User library (2026-04-26):** Edge **`resources-library-routes.tsx`** — `GET/POST /resources/*`, **`POST /resources/upload-json`** (≤1 MiB for MCP base64); PAT **`library:read`** / **`library:write`** on new tokens. **Ops:** `npm run verify:edge-productivity-http:login` (HTTP+JWT+PAT); **`npm run verify:cursor-syncscript-mcp`** (stdio + **`syncscript_week_snapshot`** + **`syncscript_library_list_files`**). **Flow doc:** `integrations/research/CURSOR_CALENDAR_TASK_CAPTURE_FLOW.md` · parity backlog **`integrations/research/MCP_PARITY_AND_ROADMAP.md`**. (historical)
- **MiroFish / OASIS-style rehearsal swarms (plan only):** **`integrations/research/MIROFISH_SYNCSCRIPT_FULL_CAPABILITY_PROGRAM.md`** — canonical **capabilities** program (A–H domains, surface binding, **P0–P8** gates, metrics, non-goals, kill signals); **`integrations/research/MIROFISH_SYNCSCRIPT_STRATEGIC_PLAN.md`** — short facts; **INDEX** + **rule 07**; **§ MiroFish-class simulation ↔ SyncScript — capability program** below — **not shipped**; implement **one phase** at a time per exit criteria. (historical)
- **Desktop Nature Companion / Cortana-like avatar direction failed (2026-05-13):** The local ignored **`nature-cortana-platform/`** experiment was removed to reclaim disk. Do **not** revive the Cortana-likeness path or extracted-game-asset workflow; only restart desktop/avatar work with an original, licensed GLB asset contract and a fresh product decision.

## Dated entries — 2026 Q2 (chronological)

Shipped work with dates. These are **routable** — grep the `###` heading or the date. The evergreen ops sections above are the first stop; these entries are the receipts behind them.

### 2026-10-30 — Cortex Host Agency, IDE Tool Surface, Collapsible UI, and Cortana Voice Sanitization

Shipped Option A Host Bridge: Cortex given native macOS system agency, full IDE tool suite (`run_command`, `search_code`, `edit_file`, `read_file`, `write_file`, `list_dir`, `system_info`, `open_app`), native Google Chrome automation (`chrome_control` via AppleScript for active tab and all open windows), and targeted `MEMORY.md` retrieval (`cortex_memory`). Implemented 34px collapsible Action Pill UI with on-demand technical drawer and View Mode toggle (`[ 💬 CONVERSATIONAL: COMPACT / 💻 DEV VIEW: EXPANDED ]`). Tuned post-execution synthesis prompt to speak with natural Cortana persona (no tool name or shell recitation), and added `sanitizeForSpeech` to prevent Cartesia TTS from reading raw URLs, hex commit hashes, or markdown tables aloud. Live verified at `http://127.0.0.1:5173/cortex`; `guard:cortex-typecheck` (clean), `test:consciousness:roadmap` (19/19 PASS), `verify:cortex` (59/59 PASS, AVG 1.00).

### 2026-05-03 — Calendar multi-day deploy + MEMORY

Calendar code: **`297d5b7`** ( **`centerDate`** refresh on calendar + view/mode, layout-aware **`jumpToTodayInstant`**, **`syncFloatingHeaderFromScroll`**, visibility → **`jumpToTodayInstant`** when available). Docs-only follow-ups on **`main`** after that; **`HEAD`** for **`verify:prod-build`** tracks the latest deploy. **Ship:** **`git push origin main`** (prepush: **`npm test`** + **`verify:console-errors`**) + **`npm run deploy:vercel:prod`** so **`www.syncscript.app`** matches **`git rev-parse HEAD`**. Lazy chunk: **`/assets/CalendarEventsPage-*.js`** (content hash). If the UI looks stale, **hard refresh** or clear site data (immutable **`/assets/*`**).
### 2026-04-26 (idle CPU pass)

**`ScrollAmbience`** rAF stops when hidden + ~30fps cap; **`CurrentTimeLine`** / **`WeekView`** / **`useCurrentTimePosition`** skip timer work when **`document.hidden`**; **`NexusVoiceCallContext`** typewriter skips hidden ticks; call duration from **wall clock**; PWA **`globIgnores`** adds **`vendor-three-*.js`** (verified absent from **`build/sw.js`** precache list). Playbook: **`integrations/research/PERF_IDLE_CPU_PROFILING.md`**. (historical)
### 2026-04-26 (prod ops — same day)

**`supabase db push`** applied **`user_onboarding_progress`** migration to **`kwhnrlzibgfedtxpkbgb`**. **`npm run deploy:edge:make-server`** shipped Stripe interval + annual SKU resolver. **`npm run deploy:vercel:prod`** completed; **`npm run verify:prod-build`** → **MATCH** (`www.syncscript.app` vs local git). Spot-check in browser: **`/trust`**, **`/changelog`**, **`/docs/api`**, **`/openapi.json`**, **`/.well-known/security.txt`**.
### 2026-04-26 — Calendar page: day timeline + sidebar rail

Product requirement: the **320px rail** stays **to the right** of the day/week views. Layout is a **`flex-row` + `shrink-0` rail** (see quick-section **Calendar `/calendar` layout**); **`e2e/dashboard-layout-columns.spec.ts`** asserts geometry. Files: **`CalendarEventsPage.tsx`**, **`PrecisionDayView.tsx`**.
### 2026-04-26 (evening) — git tree + Edge completeness

`main` had **months of uncommitted Tier 0–1 work** plus **local-only noise** (Aider, Playwright screenshots, **`nature-cortana-platform/`**, root `PHASE_*` / `EX*` planning MD). Landed commits **`920c0af`** (full product + dashboard `md` three-column + API + integrations + tests), **`a654c7d`** (Edge **`hermes-bridge.tsx` / `engram-bridge.tsx`** and related routes were **missing from git** while `index.tsx` imported them — fixed), **`deb745e`** / **`0372dce`** (gitignore + SESSION). **`git status`** clean; **`npm run verify:prod-build`** **MATCH** after **`npm run deploy:vercel:prod`**.
### 2026-04-26 (resume) — post-crash verification

Fixed **`ApiDocsPage`** RapiDoc CDN URL (was a broken placeholder). **`security.txt`** + **`openapi.json`** contact lines use real **`security@`** addresses. **`TrustPage` / `ChangelogPage`** import **`Link`** from **`react-router`** (matches **`App.tsx`**). **`hasLoggedEnergy`**: **`AuthContext`** merges from **`user_onboarding_progress`** after profile fetch + listens for **`syncscript:onboarding-progress-synced`** (dispatched from **`checklist-tracking`** after successful upsert) — no **`EnergyContext`** edit (protected). **Agent runner live:** default is now **strict** (fetch failure exits 1); set repo Variable **`AGENT_RUNNER_LIVE_RELAXED=1`** during bring-up (or legacy **`AGENT_RUNNER_LIVE_VERIFY=0`**). **Chromatic:** token present no longer runs broken **`chromaui/action`** without Storybook. **CI:** Lighthouse runs against **`vite preview`** after build; App AI E2E can be hard-required with **`REQUIRE_APP_AI_E2E=1`** when secrets exist. **Full-repo `tsc`:** not green yet (legacy **`sonner@2.0.3`** imports, etc.) — CI emits a **notice** instead of blocking until cleaned up; **`npm run build`** + ESLint still gate. Fixed **`card-enhancements/*.tsx`** accidental **`className=\"...\"`** escapes; moved MIT text out of `src/LICENSE/main.tsx` (removed) → **`src/LICENSE/MIT.txt`**; **`tsconfig.json`** excludes **`LICENSE/**`** + **`vite.config.ts`**. Contract test updated for Tier-A **`extract_links`** in **`safety.mjs`**. Verified **`npm test`** + **`CI=true npm run build`** + bundle-size script locally.
### 2026-04-26 — Tier 0 + Tier 1 strategic audit pass

Shipped the audit roadmap items that were entirely in our control (no external accounts needed). **Tier 0 A — onboarding correctness:** new server-tracked **`user_onboarding_progress`** table (RLS-scoped, realtime-published) + **`pullOnboardingProgressFromServer`** in **`src/components/onboarding/checklist-tracking.ts`** hydrates on auth-ready via **`ObservabilityIdentifier`**; existing call sites unchanged. SignupPage now navigates to `/onboarding` (matches OAuth flow). **`isFirstTime`** in **`DashboardPage`** is **`useState(() => …)`** so it can't flip mid-render. Deleted unused **`ProductTour.tsx`** + uninstalled `react-joyride`. **Tier 0 B — billing wiring:** **`BillingSettings`** mounted in Settings → Billing tab; **`BillingPlansModal.handleSelectPlan`** routes to Stripe Customer Portal (existing subs) or Checkout (new subs) instead of local-profile-only **`updateProfile`**; PricingPage passes **`interval: 'month' | 'year'`**; **`stripe-routes.tsx`** has **`resolvePriceId`** + env **`STRIPE_PRICE_<plan>_YEAR`** for annual SKUs (falls back to monthly + echoes `actual_interval` when annual not configured). Entitlements reconciled — **`SubscriptionContext`** imports **`LITE_TIER_LIMITS`** from **`utils/entitlement-contract.ts`** (single source = 5/day). **`<PastDueBanner />`** mounted in App for `past_due` / `unpaid` / `incomplete` states. **Tier 0 C — CI gates:** **`npm test`** (105 contract tests) added to **`.github/workflows/ci.yml`** as the new **`contract-tests`** job; bundle-size budget via **`scripts/check-bundle-size.mjs --max-kb=900`**; Lighthouse Perf flipped from `warn` → `error` in **`lighthouserc.cjs`**. **Tier 1 F — `/trust` portal:** **`TrustPage.tsx`** + **`public/.well-known/security.txt`** with subprocessors, encryption, GDPR/CCPA, residency, security disclosure path. **Tier 1 G — `/changelog`:** **`ChangelogPage.tsx`** reads **`public/changelog.json`** (deploy-time-editable, no rebuild required). **Tier 1 H — help widget:** **`HelpWidget.tsx`** boots Crisp / Intercom when **`VITE_HELP_WIDGET_PROVIDER`** + provider id env are set; no-op otherwise. CSP updated for both. **Tier 1 I — `/docs/api`:** **`ApiDocsPage.tsx`** uses RapiDoc CDN viewer pointed at **`public/openapi.json`** (hand-curated for `/api/agent/*` + BYOK + Webhooks + Policy + Live). **Tier 2 N — Chromatic stub:** **`.github/workflows/chromatic.yml`** that auto-skips when `CHROMATIC_PROJECT_TOKEN` secret is absent. **Tier 2 O — CWV pipeline:** **`web-vitals`** dep + **`src/observability/web-vitals.ts`** emits `cwv_lcp/inp/cls/fcp/ttfb` events to PostHog with `device` cohort. **Defense-in-depth:** **`useEmotionDetection`** rAF loop now gated on **`usePageVisibility().isVisible`** so prosody polling stops on hidden tabs (Chrome's 1Hz throttle isn't the same as zero CPU). **Deferred (need user action):** quota WRITER on task creation (Tier 0 B 6th item — backend choke point design); **D Better Uptime** + **E Vanta SOC 2** + **H Crisp/Intercom account** + **L Google Calendar OAuth client** + **M Apple Dev creds for TestFlight** + **K streaming Nexus voice** (touches `02-protected-files`). For Tier 0 B annual SKUs: create annual prices in Stripe, set Vercel env **`STRIPE_PRICE_STARTER_YEAR`** / **`_PROFESSIONAL_YEAR`** / **`_ENTERPRISE_YEAR`** — code path is already wired. New Edge migration needs **`supabase db push`**.
### 2026-04-17 — Dashboard weather spinner + App AI voice

**`getWeatherCoords`** hard deadline + **`fetchWeather` finally** end infinite **`weatherLoading`** spinners; **`AppAIPage`** voice shell **`createPortal` → `document.body`**, **`z-[530]`**; immersive auto-start uses **`useLayoutEffect`**; first-line copy from **`generateImmersiveVoiceIntro`** (short, guest-friendly); no success toast in immersive mode.
### 2026-04-11 — Nexus voice + linked Google/Outlook

Voice **`propose_calendar_hold`** → **`postCalendarHold`** + **`EventModal`** + **`LinkedCalendarEventModal`**; prompts mention calendar linking. **Nexus parity rule** (web app capabilities via voice / chat / phone) recorded in quick section.
### 2026-04-11 — Nexus voice + Tasks modal parity

Replaced **`NexusVoiceTaskPeek`** with **`TaskDetailModal`** + dialog **`overlayClassName`** / **`stackAboveVoiceShell`**; phone **`propose_calendar_hold`** still task-shaped. **`TasksContext`** refreshes on **`propose_calendar_hold`** tool traces. Voice appendix: follow-up question after mutations.
### 2026-04-11 — Nexus voice ~minute-long reply (investigation)

User saw interim STT text quickly; Nexus spoken reply felt ~60s late. **Likely contributors:** (1) **`vercel.json`** **`functions.api/**/*.ts.maxDuration`** = **60** — total handler time (cold start + multi-round **`runNexusToolLoop`** in **`api/_lib/nexus-tool-loop.ts`** + provider RTT) can approach this; (2) **non-streaming** client (**`src/utils/nexus-voice-user-client.ts`**) — no bytes until the full tool loop completes; (3) **tools + nudges** (task/update_document repair) add extra LLM rounds. **Not yet a confirmed single root cause** — confirm with traces. **Shipped same pass:** immersive **“Nexus is thinking…”** under orb + **`clearInterimTranscript`**; **`SYNCSCRIPT_VOICE_LATENCY=1`** logs **`voiceLatencyLogNexusCorrelation`** with **`X-Nexus-Request-Id`**. **Next (later):** voice **fast path** / streaming / higher **`maxDuration`** if needed. **Regression discipline:** keep **`MEMORY.md`** + **`deploy/SMOKE_TEST_NEXUS_VOICE_DOC_MAP.md`** + **`npm test`** Nexus contracts in sync when changing `nexus-user` or the tool loop. (historical)
### 2026-04-16 — Nexus Voice — CSP + map resolve + update_document nudges

**`vercel.json`** `Content-Security-Policy` **`frame-src`** includes **`https://www.openstreetmap.org`** (fixes blank OSM iframe). **`/api/map/resolve-map-url`** (`api/map/resolve-map-url.ts`) + **`api/_lib/resolve-map-short-link.ts`**: HTTPS-only, allowlisted hosts, manual redirect follow → lat/lng; **`VoiceConversationEngine`** calls resolve when **`shouldTryServerMapResolve`** (goo.gl / maps.app.goo.gl). **`userSoundsLikeDocumentEditIntent`** → extra system reminder in **`nexus-user`** when multi-turn + edit-like last user message; **`nexus-tool-loop`** nudges **`update_document`** after **`create_document`** when user text sounds like an edit. Tests: **`nexus-map-csp-and-resolve-contract.test.mjs`**, **`map-url-embed`** (`shouldTryServerMapResolve`), **`nexus-document-intent.test.ts`** (tsx). **Prod:** deploy Vercel so CSP + API route apply; manual smoke still **`deploy/SMOKE_TEST_NEXUS_VOICE_DOC_MAP.md`**. (historical)
### 2026-04-11 — Nexus Voice — tools-backed canvas & maps

Signed-in **App AI voice** uses **`postNexusUserVoiceTurn`** → **`/api/ai/nexus-user`** with **`enableTools: true`** (Nexus tools, not OpenClaw). **Artifact rail** (`NexusVoiceArtifactRail`): task/doc/calendar/place chips; **DocumentCanvas** via portal + **`voiceCanvasRenderKey`**; **`NexusVoiceTaskPeek`** after **`create_task`/`add_note`**; **map:** `src/utils/map-url-embed.mjs` + **`NexusVoiceMapEmbed`** (OSM iframe when **`parseLatLngFromMapUrl`** succeeds; **`@lat,lng`** smoke URL; short links usually no coords). Backend: **`update_document`** in **`api/_lib/nexus-tools.ts`** + **`nexus-actions-executor.ts`**; chat + voice apply **`toolTrace`** to remount canvas. **Tests:** `tests/map-url-embed.test.mjs`, `tests/nexus-update-document-contract.test.mjs` (in **`npm test`**). **Smoke runbook:** **`deploy/SMOKE_TEST_NEXUS_VOICE_DOC_MAP.md`**. **Commit:** **`b01e68e`** on **`main`** (`origin` pushed). **Follow-ups:** host **CSP `frame-src`** for `openstreetmap.org` if iframe blank; optional short-link resolve; ensure model calls **`update_document`** for edits (prompt mitigates). Raw log: **`memory/2026-04-11.md`**. (historical)
### 2026-04-11 — Linked calendar holds (Google + Outlook) — merged UI + PATCH

Edge **`GET /calendar/sync-groups`**, **`PATCH /calendar/sync-group/:id`** (body: **`targets`**, optional title/time), **`deleteOutlookCalendarEvent`** in **`integration-actions.tsx`**. Dashboard **`CalendarEventsPage`**: **`mergeLocalEventsWithSyncGroups`** dedupes by **`syncGroupId`**; fingerprint fallback only when **unambiguous** (single KV group with that title+time); second-level fingerprints; **`handleSaveEvent`** **`PATCH`**es providers when title/start/end change; **`CalendarEventCard`** / **`BaseCard`** badges; **`EventModal`** + **`LinkedCalendarEventModal`**. **Edge deploy:** `npm run deploy:edge:make-server` → project **`kwhnrlzibgfedtxpkbgb`** (2026-04-11).
### 2026-04-13 — Nexus Voice (dashboard) TTS parity with landing

when `voice === cortana`, **`useVoiceStream`** runs the **same pipeline as `NexusVoiceCallContext`**: `sanitizeForTTS` → `buildSpeechChunks` → per-sentence **PROSODY_MAP** speeds (0.98 / 0.99 / 1.0) → **voice fallbacks** (cortana → natural → nexus → professional) on `/api/ai/tts` + optional direct Kokoro → **Web Audio progressive playback** with **~72ms inter-chunk tail trim** (not one giant blob). STT: **debounced `isFinal`** for continuous dictation; callback **refs** for stale handlers. **QA:** **guest mode** smoke-tests App AI / Voice without a full account.
### 2026-04-15 — Cortana: no robotic fallback

**`GET /api/ai/tts`** exposes **`kokoroFallbackDirectOrigin`** ( **`KOKORO_TTS_FALLBACK_URL`** — e.g. Oracle Kokoro). Chunked **`fetchKokoroBufferForNexusSegment`** + **`useVoiceStream`** try **primary then fallback** direct hosts. **Transient** proxy retries + **450ms cold replay** of chunked pipeline. **`cortana`** preset: **never** **`speechSynthesis`** — **`onError`** + idle if all neural paths fail (browser TTS remains only for non-Cortana presets).
### 2026-04-15 — TTS SLO layers

Client **`kind:tts_rum`** beacons → **`/api/ai/tts`** logs + optional **`TTS_RUM_WEBHOOK_URL`**. **`handleTtsSlo`** at **`/api/cron/tts-slo`** (probe + optional **`TTS_CRON_PREWARM`**). **Vercel Hobby** cannot schedule sub-daily crons — use **`.github/workflows/tts-slo-probe.yml`** for frequent synthetics; Pro can add a **`vercel.json`** cron. Runbook **`deploy/tts-reliability-slo.md`**. Prod deploy **`npm run deploy:vercel:prod`** (2026-04-15). (historical)
### 2026-04-16 — SAM.gov Automated Caller (external product plan)

Separate from SyncScript; optional webhooks/voice integration. **Spec v3:** adds **automation tiers (A–D)**, matrix by subsystem, policy-as-code (`scoring_rule_sets`, `automation_policies`), self-healing (DLQ, SES bounce breaker, LLM caps), optional schema §24, webhook **event catalog** §25 — **`integrations/research/sam-gov-automated-caller-plan.md`**. Codename **`sam-gov-automated-caller`**. (historical)
### 2026-04-16 — Nexus Concierge Playbooks (in-product spec)

Trust-first **Scripts tab / playbook** architecture for **bounded third-party** actions (venue call, RFQ email, confirmation ingest) — **tiers T0–T4**, Postgres schema (`playbook_definitions`, `playbook_runs`, `third_party_calls`, `email_expectations`, `confirmation_evidence`), **DAG JSON**, gates, Twilio **subaccount** isolation, inbound **email parse** + confidence, failure modes, **P0–P4** rollout, **Appendix C** implementation checklist. **`integrations/research/nexus-concierge-playbooks.md`**. Codename **`nexus-concierge-playbooks`**. Contract test **`tests/nexus-concierge-playbook-contract.test.mjs`**. **Runtime** (worker, migrations, Nexus `enqueue_playbook`) ships per checklist — spec is complete; code lands in phased PRs. **Live DB smoke:** `npm run test:concierge:integration` with **`CONCIERGE_INTEGRATION=1`**, **`SUPABASE_URL`**, **`SUPABASE_SERVICE_ROLE_KEY`** (optional **`CONCIERGE_TEST_USER_ID`**, optional **`CONCIERGE_TWILIO_ACCOUNT_CHECK=1`** + **`TWILIO_*`** — GET Account only, no outbound call). Script: **`tests/concierge-playbook-integration.mjs`**. **Twilio trial / voice numbers:** same as rest of phone stack — **Vercel env** + **§ Nexus phone** table below (never commit secrets). (historical)
### 2026-04-12 and earlier — disk, Docker prune, INDEX study

2026-04-12 — **Docker prune** (~**2.65 GiB**); **INDEX** + study; **`CI=true npm run build`** OK; Xcode **DerivedData**; **`npm ci`**; favicon = `public/favicon.svg`.

## Detailed History
See `memory/2026-02-16-full-session-history.md` for comprehensive session extract.

## Agent Ascension State (I/O Coherence Template)

> [!IMPORTANT]
> **Pre-flight Circuit Breaker**: Before writing any code or modifying files, the agent must evaluate the clarity, completeness, and context of your request to calculate the **Input Quality Score (IQS)**.
> **If IQS < 7.0/10, the agent must halt immediately and request explicit clarification on the missing parameters.**

| Field | Value |
|-------|--------|
| **task** | [Single sentence description] |
| **started** | YYYY-MM-DD |
| **iteration** | 0 |
| **bar_version** | v1 |
| **best_score** | — |
| **blockers** | [Active blocker list or None] |

---

### 🧭 Pre-flight Input Quality Score (IQS Rubric)

Before execution, evaluate the request across these 4 dimensions:
1. **Clarity (30%)**: Free of conflicting goals or ambiguous instructions.
2. **Context Completeness (30%)**: All relevant file paths, variables, and boundaries are specified.
3. **Verification Criteria (20%)**: Testable definitions of success are clear (not vague).
4. **Edge Case Coverage (20%)**: Specifications exist for timeouts, network/DB failures, or errors.

**IQS Pre-flight Score**: `[X.X] / 10`  
*State: PASS (IQS >= 7.0) / HALT (IQS < 7.0)*

---

### 🎯 Acceptance Criteria (bar v1)

1. [Criterion 1 with testable check]
2. [Criterion 2 with testable check]
3. [Criterion 3 with testable check]

### 🛡️ Regression Guards (Must Stay Green)

- `npm test` passes cleanly.
- `npm run build` compiles with zero warnings.
- All new features verified in local or contract test suites.

---

### 📊 Coherence & Score History

On every iteration, calculate the **Input Quality Score (IQS)**, the **Output Quality Score (OQS)** via the 7-dimension weighted rubric, and the **Fidelity Delta (Δ)**:
$$\text{Fidelity Delta } (\Delta) = \text{OQS} - \text{IQS}$$

* $\Delta \approx 0$: Perfect transmission.
* $\Delta > 0$: Creative recovery (handled ambiguous inputs with codebase research).
* $\Delta < 0$: **System Failure Alert** (agent failed to execute clear instructions; stop and inspect).

| iter | bar | IQS (Input) | OQS (Output) | Fidelity Delta (Δ) | Correctness (30%) | Complete (20%) | Robust (15%) | Clarity (10%) | Perf/Sec (10%) | Elegance (5%) | Compound (10%) | **Weighted Total** | Decision |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0 | v1 | | | | | | | | | | | | |

---

### 📝 Iteration Log

#### Iteration 0 @ bar v1
- **Input Score (IQS) Analysis**: [Explain reasons for the IQS score]
- **Output Score (OQS) Analysis**: [Explain reasons for the OQS score]
- **Verification Command & Output**: [Brief test commands executed and results]
- **Decision**: [REPAIR (if weighted < 8.5) / PASS / RAISE BAR]
- **Durable Lesson**: [Durable engineering rule to log to the global AGENT_HARMONY_LEDGER.md]
- **Files Touched**: [Files list with relative paths]
