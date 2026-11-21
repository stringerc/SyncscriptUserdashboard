# Cortex Gap Analysis — Build-vs-Adopt Research

> Date: 2026-11-21. Status: IN PROGRESS — repo-landscape research agents
> running; this file holds the Cortex-side gap inventory (verified against
> the codebase) and will be completed with per-gap repo findings.
>
> Method: every gap below was checked against actual tool registrations
> (`vite.config.ts` CORTEX_TOOLS, ~60 tools), `src/lib/`, and `src/lib/cortex-agents/`.
> "Have" means a real working implementation exists, not a stub.

## What Cortex already has (so gaps are honest, not duplicated)

- **Voice**: unified `useVoiceStream`, gapless sentence-chunked streaming
  TTS (PcmQueue, 72ms tail-trim), barge-in, Silero VAD + smart-turn,
  speech arbiters (per-instance, turn-level, cross-tab mutex),
  parakeet-mlx ASR (:8179), whisper.cpp, speaches (:8932),
  mlx-audio/Chatterbox Turbo (:8920), Cartesia Sonic, Kokoro.
- **LLM**: magpie proxy groups cortex-fast/reason/deep (:3425),
  WebLLM browser fallback, mlx-lm (:8931), local intent fast-path.
- **Memory**: Hindsight substrate + Graphiti-lite fact store
  (bi-temporal, supersession, factsAsOf), MiniLM-L6-v2 semantic recall,
  Letta-style blocks, dream-consolidate script.
- **Generative UI**: A2UI surfaces + emit_surface tool, AG-UI SSE
  vocabulary, ~15 artifact kinds, governed button round-trips.
- **Governance**: Prompt Guard 2 (user msgs), indirect-injection
  screening (fetch_url/web_search/imessage_history), microsandbox
  egress+secret injection, blast-radius lane policy-as-data.
- **Media**: in-process Remotion renderer (cached bundles), ffmpeg
  postprocess, generate_image (fal), generate_splat, render_video,
  postprocess_video, create_document/spreadsheet.
- **Agents**: ~25 subsystem modules (strategist, forecaster, warden,
  sentinel, radar, instincts, debrief, prep, standup, counsel-*,
  evals, incidents, directives, distribution, handoff, mission,
  observability, self_heal, skill_discovery, dream_consolidate).
- **Channels**: iMessage RPC daemon (:8930) full duplex.
- **Ops**: healthz, in-process stall watchdog + external launchd
  watchdog, healthchecks pings, Inspect AI evals (6/6), promptfoo
  redteam baseline (17/18 plugin tests), nightly strategy rerun
  scheduled, DuckDB analytics.
- **Tools**: ~60 registered — exec/fs/search, chrome_control,
  web_search, fetch_url, render/postprocess video, imessage_*,
  remember/recall_facts, emit_surface/artifact, sandbox, generate_*,
  phone_call, weather, clipboard, env, launch_app, observability HUD.

## Verified gaps (checked against code, not assumed)

### Tier A — felt-difference gaps (user would notice)

| # | Gap | Evidence | Candidate fill |
|---|-----|----------|----------------|
| A1 | **No camera/screen understanding** — agent is blind to what user sees | No vision tool; `inspect_visual_canvas` reads Cortex artifacts only; no VLM anywhere | Local VLM (Qwen-VL/Moondream/Florence-2 via MLX) + screenshot tool |
| A2 | **No lip-sync / embodied presence** — visualizer is abstract particles/orb | No face/avatar pipeline; TTS audio never drives a face | MuseTalk/LatentSync/LivePortrait class repos, or keep abstract (design choice) |
| A3 | **No emotion→voice loop closed** — `cortex-emotional-intelligence.ts` exists but speech emotion (prosody, SER) is not wired to TTS expressiveness or memory affect | No SER model, no prosody→emotion path found | emotion2vec/wav2vec2 SER → drive Chatterbox exaggeration + affect tags in fact store |
| A4 | **No speaker identification** — can't tell user vs housemate/TV vs iMessage sender voice | No diarization/ECAPA anywhere | pyannote/SpeechBrain ECAPA via sherpa-onnx |
| A5 | **No music/audio generation** — TTS only; no soundscapes, briefing beds, notification chimes | No audio-gen tool | ACE-Step/YuE/Stable Audio Open (M1 feasibility TBD) |
| A6 | **No document/PDF *parsing* or slide generation** — can create docs but can't deeply read PDFs or make decks | create_document/spreadsheet only; fetch_url handles HTML | Docling/Marker/Surya for parse; Slidev/Marp/pptxgenjs for decks |
| A7 | **No real-time translation / interpretation mode** | Nothing | SeamlessStreaming/SimulStreaming/kyutai — probably SKIP (research-grade) |

### Tier B — capability-depth gaps (agent gets smarter/safer)

| # | Gap | Evidence | Candidate fill |
|---|-----|----------|----------------|
| B1 | **No durable execution** — long agent tasks die with the process; cron+scripts are fire-and-forget | No workflow engine; mission.ts is in-memory oriented | DBOS/Restate/Hatchet or build thin durable-job layer on eventlog |
| B2 | **No intelligent model routing** — magpie groups exist but selection is manual/static; no per-query fast/reason/deep escalation | `group/*` called directly | RouteLLM-style cascade router (own thin version likely — see build-own list) |
| B3 | **No context compression tier** — long sessions rely on truncation/summarization ad hoc | No LLMLingua/AutoCompressor; memory blocks help facts not context | LLMLingua-2 or own extractive compressor |
| B4 | **Constrained decoding not guaranteed** — tool calls rely on prompt+parse; JSON failures possible under weak local models | No Outlines/XGrammar/GBNF enforcement found | llama.cpp GBNF (speaches/mlx-lm support varies), xgrammar, or BAML |
| B5 | **Memory consolidation is shallow** — dream-consolidate exists but no contradiction-resolution scoring, no episodic/semantic/procedural tiering, no sleep-time agent | One script; fact store is flat-ish | Generative-Agents retrieval scoring (recency×relevance×importance), Zep-style temporal edges already have, Letta sleep-time patterns |
| B6 | **No procedural memory** — agent doesn't learn *how* to do repeated tasks better | Facts are declarative only | Skill-discovery exists (cortex_skill_discovery) — deepen into learned-procedure store |
| B7 | **No user-model/goal graph** — preferences exist as facts, not a structured trait/goal/preference model | Flat fact store | Own build likely (user-model graph on fact store) |
| B8 | **Proactivity timing/relevance unlearned** — initiative fires on rules, doesn't learn from accept/dismiss feedback | initiative ledger exists, no feedback loop found | Own build: feedback-weighted initiative scorer |

### Tier C — integration/reach gaps

| # | Gap | Evidence | Candidate fill |
|---|-----|----------|----------------|
| C1 | **No calendar/tasks/reminders/email tools** — cortex-email-helpers is a legal-pin feature, not mail access; no Cal/Reminders/Contacts tools | Tool list has none | AppleScript/EventKit bridge (own, macOS-native) or Nango/Composio |
| C2 | **No OAuth integration platform** — Gmail/Discord/Notion/Obsidian backlog documented | No Nango/Composio/Pipedream | Nango (self-host) or Composio |
| C3 | **No phone-number/SMS channel** — iMessage only; no Twilio-style number for non-iMessage contacts | imsg daemon only | Twilio/Telnyx/SignalWire or keep iMessage-only (product decision) |
| C4 | **No rich push notifications** — healthchecks ping is dead-man only; no ntfy/Bark actionable alerts | No notification tool | ntfy or Bark (iOS) — trivial add |
| C5 | **No ambient desktop awareness** — can't see screen/activity unless chrome_control invoked | No ScreenPipe/OpenAdapt feed | ScreenPipe (open) or skip for privacy |
| C6 | **No second-brain write target** — memory is internal; can't push curated knowledge to Obsidian/Logseq etc | No PKM export | Obsidian Local REST API (trivial) |

### Tier D — depth/proof gaps

| # | Gap | Evidence | Candidate fill |
|---|-----|----------|----------------|
| D1 | **Trajectory evals missing** — Inspect evals probe endpoints, not multi-step agent runs | 6 capability probes only | τ-bench/AgentBench-style or own trajectory scorer on eventlog |
| D2 | **No LLM tracing/observability backend** — cortex_observability is an in-app HUD, not a trace store | HUD only | Langfuse/Phoenix/Opik self-host, or extend eventlog into trace viewer |
| D3 | **Redteam coverage thin** — 17 plugin tests pass but 32 strategy tests deferred nightly; no tool-abuse/agentic redteam | promptfoo baseline | AgentDojo-style tool-abuse suite (own, on governed executor) |
| D4 | **No cost/latency budget tracking** — per-session token spend unmeasured | — | Thin ledger on magpie proxy logs or own middleware counter |
| D5 | **No A/B or regression gate on model/prompt changes** — promptfoo nightly helps attacks, not quality regression | — | promptfoo eval suite for quality (own test set) |

## Build-own candidates (preliminary — pending repo research)

Gaps where nothing off-the-shelf likely exists *for this exact shape*
(local-first, single-user, voice-first, governed-autonomy):

1. **Cortex Router** — per-query escalation across cortex-fast/reason/deep
   with learned routing (own signals: query complexity, tool needs,
   user tier, time-of-day). RouteLLM exists but is train-a-router;
   a rule+bandit hybrid tailored to magpie groups is likely build-own.
2. **Proactive Timing Engine** — learn accept/dismiss/interrupt patterns
   → score *when* to speak. No repo does voice-agent initiative timing.
3. **Affect Bridge** — SER/prosody → TTS expressiveness + memory affect
   tags. The glue is custom even if SER models exist.
4. **Voice Memory Index** — speaker-aware episodic recall
   ("what did Sarah say about X last week") needs diarization +
   memory join — custom pipeline on top of pyannote/sherpa-onnx.
5. **Agent Trajectory Recorder/Scorer** — eventlog already captures
   everything; a scorer that grades tool-choice efficiency, lane
   compliance, and outcome success is custom.
6. **Durable Job Layer (thin)** — before adopting DBOS/Restate, a
   SQLite-backed durable queue on the existing eventlog may be 200
   lines and zero new infra. Evaluate after repo research returns.


---

# Part 2 — Repo Landscape Findings (6 parallel research agents, verified)

Verdicts: **ADOPT** = integrate the repo/model · **STEAL** = borrow the
pattern, don't take the dependency · **BUILD-OWN** = nothing fits, write it ·
**SKIP** = wrong shape for local-first single-user 16GB M1.

## Tier A — felt difference

### A1 Vision / screen understanding → **ADOPT: mlx-vlm + Qwen3-VL-4B (or Qwen2.5-VL-3B)**
- `mlx-vlm` (JetBrains fork) is the runtime; Qwen3-VL-4B-4bit ≈ 3–4GB,
  proven ~35 tok/s on M1 Pro. Moondream2 (~2B) and SmolVLM2-256M/500M as
  cheap always-on tiers; Florence-2/dots.ocr for OCR tasks.
- GUI grounding later: ShowUI-2B or UI-TARS-1.5-7B-4bit.
- ScreenPipe is **source-available, NOT OSS** — its capture→OCR→MCP
  architecture is the blueprint for a build-own ambient layer (C8 below).

### A2 Lip-sync / avatar → **STEAL + license-gated ADOPT**
- LivePortrait (KlingAIResearch, ~16k★): only model plausibly runnable on
  M1 (12.8ms/frame on 4090, CPU/MPS workable). Needs a TTS→viseme bridge.
- MuseTalk-via-CoreML (`fast-lipsync` pattern) proven ~21fps on M4 Pro.
- **License caution:** InsightFace/MuseTalk/LivePortrait weights have
  non-commercial research terms — verify before shipping in a product.
- LatentSync/Wav2Lip/SadTalker/Hallo/EchoMimic: CUDA-only or dated → SKIP.

### A3 Emotion→voice loop → **ADOPT: emotion2vec+ (via FunASR) + BUILD-OWN bridge**
- emotion2vec+ ~300M, utterance+frame granularity, CPU-fine, MIT-ish.
- SenseVoice Small has built-in emotion/event tags (sherpa-onnx).
- The *bridge* (SER→Chatterbox exaggeration + memory affect tags) is custom —
  nobody ships it. See Build-Own #3.

### A4 Speaker ID → **ADOPT: sherpa-onnx diarization + WeSpeaker ECAPA**
- sherpa-onnx ships pyannote-segmentation-3.0 + WeSpeaker ECAPA-TDNN in
  ONNX — best Mac fit by far. pyannote.audio needs gated HF weights.

### A5 Music/SFX generation → **ADOPT: ACE-Step 1.5**
- MIT, official MLX backend, <4GB, ~20s per song on M4-16GB class.
  YuE2-3B (mlx-Yue) for lyric songs. MusicGen weights are CC-BY-NC → SKIP.
  Stable Audio 3 MLX port exists (license OK under $1M rev).

### A6 Document parse + decks → **ADOPT: Docling + dots.ocr + Typst/pptxgenjs**
- Docling (IBM, MIT, ~70k★) CPU-friendly first parser; dots.ocr (MIT,
  MLX-VLM) for layout/charts→SVG; PaddleOCR for pure OCR.
- Generation: Typst (Apache, 40MB binary, ms compiles) for PDFs;
  pptxgenjs/python-pptx for editable decks; reveal.js in-app.
- PyMuPDF is AGPL — prefer pymupdf4llm or isolate.

### A7 Real-time translation → **SKIP** (SeamlessStreaming non-commercial,
research-grade; nothing else local on 16GB)

## Tier B — capability depth

### B1 Durable execution → **ADOPT: DBOS Transact (TS+Py)**
- MIT, Postgres-only durability, decorators on both languages — matches
  Cortex's polyglot stack. Hatchet = runner-up (queue/DAG heavier).
  Temporal/n8n/Windmill/Kestra = too heavy or license-wrong.
  Restate = cleanest DX but adds a server binary → STEAL pattern.
  **Pre-check:** does Cortex already run Postgres? If not, a thin
  SQLite durable-queue on eventlog (~200 lines) may suffice — decide at
  implementation time. (See Build-Own #6.)

### B2 Model routing → **BUILD-OWN (steal patterns)**
- RouteLLM/cascadeflow/weave-os-router/LLMRouter are all training-or-
  proxy-shaped; none drop into magpie's group model. The winning pattern
  (per research): heuristic pre-classifier + optional small-model
  "can-I-answer" probe + threshold calibration + per-lane telemetry.
  This is Cortex Router — Build-Own #1.

### B3 Context compression → **STEAL: sqz / headroom / LLMLingua-2**
- Prefer deterministic tool-output compression (sqz, claw-compactor,
  headroom) before model-coupled methods. Loss-tolerant routing
  (leanctx): compress logs/tool output hard, keep facts verbatim.

### B4 Constrained decoding → **ADOPT: GBNF/llguidance + BAML or Instructor**
- llama.cpp GBNF already in inference path; mlx-lm supports
  outlines/llguidance/xgrammar backends. Middleware belt: BAML (TS+Py
  typed schemas) or Instructor (Py) for validate-and-repair.
  Eliminates the largest agent-failure class (malformed tool calls).

### B5/B6/B7 Memory depth → **BUILD-OWN on existing store (steal patterns)**
- Nobody ships episodic/semantic/procedural/profile tiers on SQLite for
  a voice agent — Cortex already has the substrate; this is the biggest
  build-own opportunity. Patterns to steal:
  - **Generative Agents**: recency×relevance×importance retrieval scoring
    + reflection triggers (canonical, BUILD-OWN).
  - **MIRIX**: six-tier taxonomy (Core/Episodic/Semantic/Procedural/
    Resource/Vault) — target model.
  - **Letta/letta-code dreaming**: background reflection agent,
    review-before-apply, MemFS auditability → upgrade dream-consolidate.
  - **Graphiti**: episode→entity→temporal-edge + hybrid retrieval
    (have valid_from/valid_to already; add relation edges).
  - **Nemori**: topic-consistent episode segmentation.
  - **AssoMem**: PPR + temporal decay over associative graph.
  - **mnemo / agent-memory / engram**: SQLite-native episodic+semantic+
    procedural designs closest to Cortex's stack — read before building.
  - **hermes-dreaming/tigerless-agent-memory**: deterministic-first
    consolidation, LLM only for ambiguous merges.
- User-model: PersonaMem-v2/v3 + PersonalLLM + PRISM datasets for eval;
  compact preference vector/profile block (VARS/DEP/TAP-PER patterns).

### B8 Proactivity learning → **BUILD-OWN: Proactive Timing Engine**
- No repo does voice-agent initiative timing. Learn from
  accept/dismiss/interrupt events in the initiative ledger; score
  relevance×timing×user-state. (Build-Own #2)

## Tier C — integrations

### C1 Calendar/email/tasks → **BUILD-OWN thin layer**
- No self-hostable integration platform is light enough (Nango paid
  self-host, Composio cloud-gated, Pipedream not self-hostable,
  Activepieces ~2GB optional). Pattern: direct per-provider OAuth +
  thin token vault (Keychain) + gcalcli-style Google Calendar +
  imapflow/PostalMime IMAP + nodemailer send. inbox-zero is the
  feature-spec reference (AGPL — steal ideas only).
- AppleScript/EventKit bridge for macOS-native Reminders/Calendar/Contacts
  is the cheapest first cut — zero OAuth.

### C2 OAuth platform → **SKIP platforms; BUILD-OWN auth vault**
- Composio's session→meta-tools→MCP pattern is worth stealing for the
  tool layer; for ≤10 services a 300-line token vault wins.

### C3 SMS/phone → **ADOPT one provider only if needed**
- Keep `imsg` primary; **BlueBubbles Server** (~1.1k★, Apache-2.0) is
  the canonical upgrade — tapbacks, groups, read state, attachments.
- SMS fallback: Telnyx/Bandwidth (~$0.004/msg) + 10DLC registration.
- LoopMessage (~$120/mo assembled) only if a hosted iMessage identity
  is required. WhatsApp via Seven/Twilio later.

### C4 Push notifications → **ADOPT: ntfy + Apprise (+ Bark if iOS)**
- ntfy (~35k★): single Go binary, rich actions/priority, self-host or
  ntfy.sh. Apprise (MIT): one call → 183 services. Bark for iOS-native
  critical alerts; Pushcut for actionable iOS notifications.

### C5 Ambient desktop awareness → **BUILD-OWN (ScreenPipe is source-available)**
- ScreenCaptureKit + SmolVLM2/Moondream ambient vision + ActivityWatch
  (MPL, ~20k★) for app-usage context. ScreenPipe/OpenAdapt are design
  blueprints, not dependencies.

### C6 PKM write target → **ADOPT: Obsidian Local REST API (if vault) else memos**
- Obsidian Local REST API plugin (MIT) has a built-in MCP server —
  surgical note CRUD + SSE events, best agent↔vault bridge extant.
- memos (~64k★, MIT, SQLite) = dead-simple agent-writable store.

## Tier D — proof/evals

### D1 Trajectory evals → **BUILD-OWN scorer + STEAL AgentDojo/τ²-bench**
- AgentDojo (~1.5k★, MIT): 97 tool-use tasks + 629 injection cases —
  port tasks to Cortex's governed executor. τ²-bench pass^k metric =
  the reliability-over-trials measure that makes safety claims credible.
- inspect_evals (UK AISI) has packaged AgentDojo/AgentHarm evals —
  extend existing Inspect suite, don't add tooling.
- **The trajectory scorer itself is build-own** — grade tool-choice
  efficiency, lane compliance, outcome success per run (Build-Own #5).

### D2 Tracing/observability → **ADOPT: Phoenix (light) or Langfuse (rich)**
- Arize Phoenix: `pip install arize-phoenix`, zero infra, OTel-native —
  best fit for single Mac. Langfuse if you want prompt-mgmt/evals and
  accept the ClickHouse stack. cortex_observability HUD stays as UI.

### D3 Agentic redteam → **ADOPT: garak + snyk/agent-scan + PyRIT (periodic)**
- garak (~10k★): second scanner, different probe corpus, REST target.
- snyk/agent-scan (ex-mcp-scan): scans MCP/tool configs for poisoning.
- PyRIT: Crescendo/multi-turn attacks — quarterly deep audits, not CI.
- StackOneHQ/defender or protectai deberta-v3-prompt-injection-v2 as a
  second-layer tool-output classifier (llm-guard toolkit is ARCHIVED —
  use the model, not the repo).

### D4 Cost tracking → **ADOPT pattern: LiteLLM proxy or costhelm**
- LiteLLM gives spend logs + budgets if Cortex ever routes through it;
  otherwise a thin middleware counter on magpie logs (~100 lines).

### D5 Quality regression → **BUILD-OWN promptfoo quality suite**
- Own golden test-set eval (promptfoo eval, not redteam) run nightly
  alongside the redteam rerun.

## Cross-cutting ADOPTs not tied to one gap

| Repo | Why |
|---|---|
| **DBOS Transact** | durable execution, MIT, TS+Py |
| **XGrammar/llguidance + BAML** | guaranteed-valid tool calls |
| **MLX speculative decoding** | 1.5–3× decode, free if on mlx-lm/llama.cpp — enable draft model |
| **ACE-Step 1.5** | MIT music gen, MLX-native |
| **mlx-vlm + Qwen3-VL-4B** | the agent's eyes |
| **emotion2vec+** | SER features for affect bridge |
| **sherpa-onnx** | streaming ASR + diarization + TTS in one ONNX runtime |
| **Moonshine (mlx-audio)** | fastest low-latency English STT |
| **Kyutai STT/TTS (MLX)** | streaming pair w/ semantic VAD — eval as cascade alternative |
| **Moshi_mlx q4 / MiniCPM-o GGUF** | eval-only: true full-duplex on 16GB — benchmark vs cascade |
| **mlx-audio TTS expansion** | Qwen3-TTS-0.6B, CSM-1B, Dia2 — Apache-2.0, already in stack |
| **Easy-Turn / LiveKit turn-detector v1-mini** | complementary EOU signals (Easy-Turn adds backchannel state) |
| **MaAI** | only CPU backchannel predictor — agent "mm-hmm" insertion |
| **ACE (Agentic Context Engineering)** | Generator/Reflector/Curator delta-updates — steal for skill/memory self-improvement |
| **smolagents code-action + OpenAI Agents SDK handoffs** | code-exec tool calls beat JSON tool calls; steal patterns |
| **LangGraph checkpoint/interrupt semantics** | steal state-graph + durable-checkpoint + HITL model |
| **A2A Agent Card format** | cheap capability-manifest format for Cortex's own registry |
| **Tauri 2** | product path for Cortex.app menu-bar agent (SwiftBar/Hammerspoon as zero-effort interim) |
| **Tailscale Funnel / cloudflared** | secure inbound webhook exposure |
| **ntfy + Apprise + Bark** | agent→phone push stack |
| **Uptime Kuma + Beszel (+Dozzle)** | daemon-fleet health + host metrics |
| **Obsidian Local REST API / memos** | agent-writable PKM |
| **BlueBubbles** | iMessage upgrade path (tapbacks/groups/read state) |
| **gcalcli-pattern + imapflow + nodemailer** | build-own calendar/email thin layer |
| **Docling + dots.ocr + Typst/pptxgenjs** | document parse + generation |
| **stable-diffusion.cpp / mflux** | local image gen (Metal/MLX) |
| **Wan2.1-1.3B via mlx-video** | only honest local video gen on 16GB |

---

# Part 3 — BUILD-OWN REPO CANDIDATES (the real answer to your question)

These are gaps where **no repo exists** for Cortex's exact shape
(local-first, single-user, voice-first, governed autonomy, 16GB M1).
Each is a candidate for its own repo/module.

| # | Candidate | What it is | Why nothing exists | Effort |
|---|-----------|-----------|--------------------|--------|
| 1 | **cortex-router** | Per-query/per-step escalation across magpie groups (fast→reason→deep) with heuristic pre-classifier, optional small-model probe, threshold calibration, per-lane telemetry | Routers are train-a-model or proxy-shaped; none do in-group cascade with bandit tuning on a local proxy | M |
| 2 | **cortex-proactivity** | Initiative timing/relevance engine — learns accept/dismiss/interrupt from ledger, scores when-to-speak vs user state (call, focus, night mode) | Proactive-agent timing is an open research problem; every repo is rules-based | M |
| 3 | **cortex-affect** | SER/prosody → TTS expressiveness + memory affect tags + emotional-state tracking over time | The glue between emotion2vec and Chatterbox/memory is custom; nobody ships the loop | S-M |
| 4 | **cortex-voice-memory** | Speaker-aware episodic recall — diarization × fact-store join ("what did Sarah say about X") | Needs sherpa-onnx diarization + custom memory pipeline; no product does voice-native memory | M |
| 5 | **cortex-trajectory** | Agent run recorder/scorer — grades tool-choice efficiency, lane compliance, plan quality, outcome success; feeds evals + proactivity | agentevals/strands have scorers but no voice-agent trajectory product | M |
| 6 | **cortex-durable** (maybe) | Thin SQLite durable-job layer on eventlog — survives restarts, retries, scheduled agent tasks | DBOS needs Postgres; a 200-line eventlog-backed queue may be enough — evaluate first | S |
| 7 | **cortex-screen** | Ambient screen context — ScreenCaptureKit + SmolVLM2/Moondream + ActivityWatch, privacy-gated, feeds "what was I looking at" recall | ScreenPipe is source-available; OpenAdapt pivoted; no OSS ambient-vision memory for agents | L |
| 8 | **cortex-memory-tiers** | Formalise episodic/semantic/procedural/profile/resource tiers + entity edges + Generative-Agents scoring + phased sleep-time consolidation on existing SQLite | MIRIX/mnemo/etc prove the design but none are a drop-in for Cortex's store; this IS the flagship build | L |
| 9 | **cortex-integrations** | Direct-OAuth auth vault + per-provider thin clients (gcalcli-pattern calendar, imapflow email, AppleScript EventKit) + Composio-style meta-tool discovery | Every platform is cloud-gated or too heavy; single-user OAuth is unsolved as a product | M |
| 10 | **cortex-webhooks** | Durable inbound webhook queue (persist-before-process, replay on wake) + Tailscale/CF tunnel config | holloway proves the pattern but it's a relay, not an agent queue | S |
| 11 | **cortex-context** | Loss-tolerant context compiler — classifies segments verbatim/compressible, applies sqz-style deterministic compression to tool output, preserves facts | headroom/sqz/claw-compactor are generic; none know Cortex's memory/fact boundaries | M |
| 12 | **cortex-registry** | A2A Agent Card–style capability manifest for Cortex's own tools/skills/agents — discoverability + lane-scoped exposure | MCP registries exist but nothing for a personal agent's internal tool surface | S |

## Recommended sequencing (highest leverage first)

**Wave 1 — cheap, felt, low-risk:**
- emotion2vec+ affect bridge (Build-Own #3) — closes the emotion loop
- ntfy+Apprise notifications — agent can reach your phone today
- Uptime Kuma+Beszel — see the whole daemon fleet
- MLX speculative decoding flag — free speed
- GBNF/llguidance on tool calls — fewer malformed calls
- BlueBubbles eval — richer iMessage

**Wave 2 — the flagship builds:**
- cortex-memory-tiers (#8) — the "eons ahead" memory story
- cortex-router (#1) — cost/latency intelligence
- cortex-trajectory (#5) — provable safety/quality
- Vision stack: mlx-vlm + Qwen3-VL — the agent opens its eyes
- ACE-Step — Cortex can make music

**Wave 3 — reach & presence:**
- cortex-integrations (#9) — calendar/email/tasks
- cortex-screen (#7) — ambient awareness (privacy-gated)
- cortex-proactivity (#2) — initiative that learns
- Tauri app / SwiftBar interim — desktop presence
- cortex-voice-memory (#4) — "what did X say" recall
- Durable exec decision: DBOS vs cortex-durable (#6)

**Explicitly deferred/killed:** full-duplex S2S (Moshi eval only —
cascade is correct for 16GB), PersonaPlex/Qwen3-Omni (don't fit),
LatentSync/lip-sync diffusion (CUDA), Temporal/n8n/Windmill (weight),
Nango/Composio/Pipedream self-host (cloud-gated), ScreenPipe code
(source-available), MusicGen (NC weights), GraphRAG/Graphiti+Neo4j/
Mem0-server/MemOS (framework weight — steal patterns instead),
Khoj/Reor/Tolaria (AGPL/overlap), Oura API (ToS restricts LLM use).

*Caveats: star counts are ~late-2026 snapshots and drift; licenses
marked "verify" (IndexTTS-2.5, EAGLE-3, Restate server terms, WildGuard/
Aegis weights, PersonaMem-v3 data) must be checked before shipping
derived artifacts. Several 2026 repos are tiny — treat as pattern
sources, not dependencies.*

