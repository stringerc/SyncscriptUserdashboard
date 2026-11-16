# CORTEX — Master Document

> The single source of truth for what Cortex is, what it consists of, and how the pieces fit.
> Detail lives in the spec/research docs indexed at the bottom — this file is the map, not the territory.
> Update this file when architecture or capabilities change; keep spec docs for depth.

**Last updated:** 2026-11-15 · **Repos:** `syncscript` (this repo, branch `security-hardening`) + `gods-eye-view` (private, `main`)

---

## 1. What Cortex Is

Cortex is SyncScript's cognitive layer — a local-first, voice-driven mission-control system that perceives (sensors, calendar, inbox, host telemetry), deliberates (matrix-routed LLM tiers), remembers (Obsidian vault + episodic memory), and acts (governed tools, agent fleet, globe, distribution pipeline) under explicit human gates.

Design contract, non-negotiable:

- **Evidence or silence.** No claim, forecast, or brief ships without cited sources. Empty results are reported honestly, never padded.
- **Governed action.** Every mutating path passes a blast-radius lane: `contained` → `reversible` → `hard` (proposal-only, typed human approval).
- **Visible work.** Agent activity, forecasts, and map lookups render on the visualizer/globe — the user sees things happening, not inferred status.
- **Local-first.** Keys stay server-side; models are swappable infrastructure; personal data stays on-device where possible.

---

## 2. The Four Pillars

### 2.1 Visualizer (`src/components/cortex/`)

The face of Cortex — a Three.js scene (`CortexCoreScene`, `CortexAgentsScene`) with agent "moons" orbiting a core (regular agents) and satellites (enterprise/spawned). Right rail shows fleet state; mission log + event ticker stream live `AgentEvent`s over SSE (`/api/cortex/agents/stream`).

- Entry: `CortexVisualizerPage.tsx` — hosts voice loop, globe iframe, surface panels, forecast-marker poller
- Voice: `useVisualizerVoice.ts` — STT → command parser (`cortex-globe.ts` map intents) → LLM/tool dispatch → TTS
- Surfaces: `cortex-surfaces.ts` — draggable pinned panels (chat, agents, maps, checklist)
- Speech: `cortex-speech.ts`, Kokoro local TTS (port 8880) → Cartesia fallback

### 2.2 Globe / Maps (GEV bridge)

God's Eye View (`/Users/Apple/src/gods-eye-view`, port 5180, `?embed=1`) is the live 3D globe, embedded via iframe and driven over `postMessage`.

**Bridge verbs** (`src/lib/cortex-globe.ts`):

| Verb | Purpose |
|---|---|
| `gev:view` | Camera fly + layer set + annotations (full view replace) |
| `gev:time` | World clock seek/play/pause |
| `gev:cctv` | Camera layer control |
| `gev:places` | Google Places text-search pins + place-details/reviews |
| `gev:forecast` | Ambient annotation markers — no camera/layer changes (Tier-1 forecasts) |

**Place intelligence:** voice "popular burger places in Duluth" → geocode anchor → `gev:places` search → Google Text Search pins in the `osm-places` layer → click any pin for the Google reviews card (rating, review count, price, hours, review excerpts). OSM↔Google **entity resolution** scores candidates on name similarity + proximity + address + category; low confidence → honest "OSM data only," never a wrong Google identity.

**Layers:** flights, AIS vessels, satellites, earthquakes, weather (GOES clouds/radar/wind), NASA FIRMS fires, local ADS-B, CCTV, OSM places. Session layers persist across fly-tos; `gev:view` no longer kills non-registered layers.

### 2.3 Agent Fleet (`src/lib/cortex-agents/`)

Runtime: `runtime.ts` — registry, queues, budgets, SSE events, persistence (`.cortex-runtime/agents-state.json`), routines scheduler, spawn-proposal gate.

**Built-in roster** (`AGENT_SPECS`):

| Agent | Role | Tier/model |
|---|---|---|
| SENTINEL | Model/provider health probe | fast |
| SCOUT | Research operative + repo-scan + agent-ideation + social_scan (Agent Reach) | reason |
| LIBRARIAN | Memory distillation → rules | reason |
| BUILDER | Code/repo work | reason |
| REVIEWER | Verification pass | reason |
| RUNNER | Script/command execution | fast |
| DISTRIBUTOR | Gumroad/Pinterest/Reddit queue | reason |
| WARDEN | Guardrails/audit | fast |
| FORECASTER | Evidence-first prediction engine | reason |
| PREP | Cited meeting briefs | reason |

**FORECASTER** (`forecaster.ts`): probe-registry architecture — each domain is a small evidence-emitting probe; router scores confidence × relevance × urgency into three tiers: **T1** ambient globe markers, **T2** initiative proposals (approval-required), **T3** spoken via ambient queue (hard 3/day budget). Probes: fleet, calendar, comms (Gmail backlog), build (git debt), distribution (queue health), weather (NWS alerts → watch zones), energy (circadian). Calibration loop adjusts per-domain confidence from recorded outcomes (`/api/cortex/forecast/feedback`).

**PREP** (`prep.ts`): gathers memory + Gmail + calendar context → reason-tier brief → **citation validator drops every uncited claim** → local markdown in `.cortex-runtime/prep-briefs/`. Honest empty when no sources. FORECASTER's calendar `noprep` signals auto-dispatch `prep_brief` tasks via `signal.handoff`.

**Spawned agents** (`CORTEX_AGENTS_SELF.md`): any built-in can propose a `SpawnSpec` — deterministic gate (evidence re-derived from real task IDs, Jaccard overlap check, fleet caps) → Inbox approval → ephemeral agent (≤168h TTL, ≤32 tasks/day, concurrency 1). SCOUT's daily `agent_ideas` routine feeds this pipeline.

**SCOUT `social_scan`**: read-only platform access via [Agent Reach](https://github.com/Panniantong/Agent-Reach) (`~/.local/bin/agent-reach`, uv-installed). Channels: github/youtube/web/v2ex/bilibili active; reddit/twitter/linkedin/etc. available via `agent-reach add` + login. Discord `/cortex ask` routes social keywords → `social_scan` with channel detection. Whitelisted channels/actions only, `execFile` (no shell), 90s cap; `ok:false` errors (NEED_LOGIN/RATE_LIMITED) surface honestly.

**Workers** (`workers.ts`): all execution through `ctx.llm()` (matrix-routed `/api/cortex/agents/llm`) and `/api/cortex/tools/execute` (sovereign key). Telemetry per task: LLM calls, tokens, tool calls/failures, duration, failure class.

### 2.4 Memory & Initiative

- **Obsidian vault** (`cortex-obsidian-memory.ts`): `00-Inbox` → `04-Rules`; agents read/write notes as artifacts
- **Initiative engine** (`cortex-proactive-initiative.ts`): proposal inbox — sensors file proposals, human approves/executes; categories incl. `forecast`, `agent_spawn`
- **Ambient queue** (`.cache/cortex-ambient.jsonl`): server-generated notices; clients drain via `/api/cortex/ambient/pending` and speak under voice policy — the Tier-3 forecast channel
- **Calendar feed**: client pushes next-48h events to `/api/cortex/calendar/upcoming`; `/api/cortex/geo/watch` resolves NWS zones from device location

---

## 3. Architecture Map

```
Voice/STT ──► useVisualizerVoice ──► cortex-globe (map cmds) ──► GEV iframe :5180
                │                        │ gev:view/time/cctv/places/forecast
                ▼                        ▼
        /api/cortex/*  ◄────────── postMessage bridge
                │
     ┌──────────┼─────────────────┬──────────────────┐
     ▼          ▼                 ▼                  ▼
  Agents    Initiative      Calendar/Gmail      Distribution
  runtime   proposals       feeds               queue (storefront/)
  :5173     (Inbox)         (local JSON)        Gumroad/Pinterest/Reddit
     │
     ├─ FORECASTER probes ─► signals ─► T1 globe / T2 proposals / T3 ambient
     ├─ PREP ◄── handoff ── calendar noprep signals
     └─ SCOUT ──► repo_scan + agent_ideas (daily routines)
```

**Ports:** 5173 SyncScript vite+API · 5180 GEV · 8880 Kokoro TTS · 8082 NIM proxy
**State dirs:** `.cortex-runtime/` (agents, forecaster ledger/state, calibration, calendar, watch-zones, prep-briefs) · `.cache/` (ambient queue, images) · `storefront/` (distribution queue, launch log)

---

## 4. Key Endpoints

| Endpoint | Purpose |
|---|---|
| `/api/cortex/agents/state` | Fleet snapshot + forecast ledger tail |
| `/api/cortex/agents/task` | Submit agent task |
| `/api/cortex/agents/routines` | Recurring assignments |
| `/api/cortex/agents/spawn/propose` | SpawnSpec gate |
| `/api/cortex/agents/stream` | SSE event feed |
| `/api/cortex/agents/llm` | Matrix-routed model calls |
| `/api/cortex/tools/execute` | Governed tool execution |
| `/api/cortex/initiative/sense` | Sensor bus snapshot |
| `/api/cortex/calendar/upcoming` | Calendar mirror (GET/POST) |
| `/api/cortex/geo/watch` | Location → NWS zones |
| `/api/cortex/forecast/feedback` | Calibration verdicts |
| `/api/cortex/gmail/live-inbox` | Gmail scrape (read-only) |
| `/api/cortex/distribution/status` | Queue + launch state |
| `/api/cortex/ambient/pending` | Notice queue drain |
| `/api/cortex/bus/state` | Visualizer signal bus |

### 4.1 Runtime & Infrastructure Topology

- **Agent runtime — PARALLEL-RUN on Oracle (migration in progress)**: full Cortex runtime now live on `syncscript-a1-retry-2` at `/opt/cortex-runtime` (systemd `cortex-runtime.service`, vite :5174, arm64 `npm install` clean). Public endpoint `https://cortex-oracle.tailc088d4.ts.net` (Tailscale Funnel → :5174) verified: discord/state configured, signature checks, 12 agents, all smoke gates pass (scout social_scan, librarian recall, distributor browser_shot via local CDP :9222, TTS cortana via `pocket-tts-cortana.service` :8911). Mac instance remains authoritative for Discord until 24h soak + portal cutover. See `CORTEX_ORACLE_MIGRATION_{PROMPT,AUDIT,SPEC}.md`.
- **Discord surface (current/authoritative)**: `https://cortex.tailc088d4.ts.net` (Tailscale Funnel → Mac `localhost:5173`). `tailscaled` + Vite run under launchd (`com.tailscale.cortex`, `com.syncscript.vite`) — survive reboots. **Planned cutover**: portal URL → `cortex-oracle.tailc088d4.ts.net` after soak.
- **Automation Chrome lives on Oracle** (`syncscript-a1-retry-2`, ARM64 Ubuntu): systemd `cortex-xvfb` (display :99) + `cortex-chrome` (Chrome 159, CDP `127.0.0.1:9222`, profile `/opt/cortex-chrome/profile`, x11vnc :5900 for logins). Mac reaches it via launchd SSH tunnel `com.cortex.cdp-tunnel` (`localhost:9222` → oracle). All `storefront/tools/*.mjs` scripts work unchanged.
- **Agent Reach** (`~/.local/bin/agent-reach`, uv tool): SCOUT `social_scan` read-only platform access — github/youtube/web/v2ex/bilibili/reddit/xueqiu live; twitter/linkedin/etc. installed, need `agent-reach login`.

---

## 5. Spec & Research Index

| Doc | Contents |
|---|---|
| `MEMORY.md` | Product hot layer — running log of decisions, fixes, deploys (2.5k lines, append-style) |
| `SESSION_START.md` | Session bootstrap context |
| `CORTEX_SYSTEM_ARCHITECTURE.md` | Theoretical consciousness-substrate framing (GWT/IIT/AST) |
| `CORTEX_VISION.md` / `CORTEX_VISION_SPEC.md` | Product vision + spec |
| `CORTEX_AGENTS_SELF.md` | Spawned-agent lifecycle spec (evidence gate, overlap check, tier-2) |
| `CORTEX_FORECASTER_SPEC.md` | FORECASTER probe/tier/calibration design |
| `CORTEX_PREP_SPEC.md` | PREP cited-brief contract |
| `CORTEX_AGENTS_RESEARCH.md` | Forecasting/prep agent landscape research |
| `CORTEX_MAPS_*.md` | Maps evolution prompt/research/plan |
| `CORTEX_WARDEN.md`, `CORTEX_DIPLOMACY.md`, `CORTEX_FRONTIER.md` | Subsystem specs |
| `CORTEX_VISUALIZER_AUDIT*.md` | Visualizer audit reports |
| `PLAN_*.md` | Feature plans (surfaces, chat audit, generative surfaces) |

---

## 6. Working Rules for This Document

- **This file is the map.** When architecture changes, update the relevant section here first, then the detail spec.
- **MEMORY.md is the log.** Append-style history lives there; don't duplicate it here.
- **Specs are contracts.** `CORTEX_*_SPEC.md` files hold design rationale; code is truth — when they disagree, fix the doc.
- **Honesty invariant.** Anything documented here must be verifiable in code or marked as planned/spec-only.
