# External Stack Deep-Dive — What to Actually Implement in Cortex

Date: 2026-… (session). Method: seven parallel research agents, each grounded
against the real codebase (vite.config.ts routes, src/lib, tools/remotion,
package.json deps). Verdicts are PORT-SUBSET / ADOPT / PATTERN / SKIP — we take
the valuable 20% of each repo, not the framework.

Legend: effort S(<1d) M(1-3d) L(>3d). Risk = integration risk, not model risk.

---

## Tier A — ADOPT (real upgrades, right-sized for M1 Pro 16GB)

### 1. mlx-audio → Chatterbox TTS (voice tier, RANK 1)
- What: Python MLX framework, OpenAI-compatible `/v1/audio/speech` server.
  Chatterbox v2/v3 = expressive TTS with `exaggeration` + `cfg_weight` +
  zero-shot cloning from 5–10s ref; Turbo variant has 9 inline emotion tags.
- Fit: 350M–536M quantized, MIT, runs on M1 Pro. Slots behind existing
  `/api/cortex/tts` chain as a new rung; Pocket cortana clone stays primary.
- Integration: `mlx_audio.server` on :3901 (next to VoiceStudio :3900);
  probe in vite.config.ts `/api/cortex/tts` (~line 9482); voice option
  `cortex-emotive` in `/api/cortex/tts/config`; emotion layer can inject
  `[laugh]/[sigh]` tags it already detects.
- Effort M. Risk low-med (ref-audio quality, ~1s first-clip latency).

### 2. parakeet-mlx → local ASR (voice tier, RANK 2)
- What: NVIDIA Parakeet TDT 0.6B v2/v3 in pure MLX, ~80–120× RTFx on M1 Pro,
  ~2.5% WER en — vs current whisper.cpp `ggml-base.en` fallback (weak).
- Integration: ~50-line FastAPI wrapper on :8179 → new rung in
  `/api/cortex/stt` probe order (above whisper.cpp :8178, below Groq).
  Client unchanged — `useVisualizerVoice` already POSTs WAV.
- Effort S–M. Risk low. Fixes a known accuracy debt.

### 3. Chrome Prompt API — `window.LanguageModel` (on-device tier, RANK 1)
- Status: REAL, shipping in Chrome 148+ on by default; macOS 13+, 16GB OK.
  Requires official Chrome + user gesture for model download.
- Use: zero-cost local intent classification, summarization, "is this
  addressed to Cortex" gating, text cleanup — a free triage tier in front
  of paid APIs. NOT a brain (Nano-class, no tool calling).
- Integration: `src/lib/cortex/local-intent.ts`; wire into transcript
  pipeline in useVoiceStream/VoiceConversationEngine; graceful degrade.
- Effort S. Risk low.

### 4. WebLLM — local LLM fallback tier (on-device tier, RANK 2)
- What: WebGPU LLM inference, ~30–50 tok/s on 3B Q4 on M1 Pro.
- Use: degraded-mode "local cortex" — intent classify, summarize, draft
  replies when /api/ai/nexus-guest is unreachable. Not for the tool loop.
- Integration: `src/lib/cortex/local-llm.ts` lazy engine; fallback hook in
  cortex-tool-loop/nexus-guest call sites; 1–2GB model download UX needed.
- Effort M. Risk med (GPU contention with visualizer — run lazily).

### 5. speaches — unified local STT+TTS server (on-device tier, RANK 3)
- What: "Ollama for speech" — OpenAI-compatible `/v1/audio/transcriptions`
  (faster-whisper) + `/v1/audio/speech` (Kokoro ONNX + Piper), one process.
- Fit: could replace whisper.cpp :8178 + Kokoro :8880 pair — same OpenAI
  shapes, near drop-in port/model changes in vite.config.ts.
- Effort S. Risk low-med (model naming, faster-whisper vs whisper.cpp delta).

### 6. mlx-lm server — local brain fallback (on-device tier)
- `mlx_lm.server` OpenAI-compatible on :8081; ~20–30% faster decode than
  Ollama on M-series, lower memory. Plug into existing Groq→local fallback
  pattern (same shape as /api/cortex/stt fallback). 7B Q4 ≈ 4.5GB resident.
- Effort S–M. Verdict ADOPT — pairs with speaches as the "local services" duo.

### 7. A2UI agent-side completion (generative UI, RANK 1)
- Exists: renderer is DONE and high quality — cortexA2uiCatalog.ts (basic +
  4 custom components), CortexA2uiSurface.tsx streaming MessageProcessor,
  themed. Demo-only mount behind ?a2ui=demo.
- Missing: everything agent-side — no @a2ui/agent, no emit_surface tool, no
  SSE surface events, no onAction round-trip.
- Plan: `npm i @a2ui/agent`; new tool `emit_surface` in CORTEX_TOOLS +
  handler reusing validateArtifacts pattern; `surface` field on SSE events
  (cortex-stream.ts passthrough); per-thread MessageProcessor singleton
  (src/lib/cortex-a2ui-session.ts); onAction → cortex-signal-bus →
  cortex-tool-loop as next-turn context. Extend catalog with
  CortexChart/CortexTable/CortexFeed wrapping existing recharts renderers.
- Keep emit_artifact for bespoke visuals (splat, dashboard, weather, map).
- Effort M. Risk low-med (model must emit valid component trees — the
  agent SDK has a self-correction compiler).

### 8. AG-UI event vocabulary on existing SSE (generative UI, RANK 2)
- Don't adopt CopilotKit runtime (would fight cortex-tool-loop + signal bus).
- Adopt the VOCABULARY: emit STATE_SNAPSHOT/STATE_DELTA, TOOL_CALL_* lifecycle,
  CUSTOM for A2UI payloads on the existing /api/ai/nexus-guest stream.
  Makes Cortex protocol-compatible with the A2UI/MCP-UI ecosystem for ~free.
- Effort S–M. Risk low.

### 9. microsandbox network policy + secret injection (governance, RANK 1)
- Already a dep + run_sandboxed tool — but only uses image/exec. Missing:
  NetworkPolicy defaultDeny + typed egress rules, and the crown jewel:
  host-side secret binding ($MSB_<VAR> placeholders, TLS-intercept
  substitution only for SNI-pinned allow-listed hosts — guest can't
  exfiltrate real creds).
- Integration: extend SdkSandboxBuilder in src/lib/cortex-sandbox.ts
  (.network/.secrets), lane-derived policy arg at vite.config.ts:9004.
- Effort S–M. This is the missing enforcement INSIDE the boundary already built.

### 10. OPA embedded wasm for lane decisions (governance, RANK 2)
- Blast-radius lanes are hardcoded TS in the 15k-line vite.config.ts.
- Port ONLY the tool-call lane decision to Rego (~50–100 lines), build to
  wasm, evaluate in-process via @open-policy-agent/opa-wasm inside
  /api/cortex/tools/execute. Trust ledger + initiative state become the
  data document. Fail-closed; volition.evaluateVeto stays as second check.
- policy/*.rego becomes auditable, `opa test`-able, hot-reloadable artifact.
- Effort M. Risk low-med (policy/TS divergence during migration — port
  lanes one at a time, keep TS fallback).

### 11. dotenvx + one-shot trufflehog/gitleaks (governance, RANK 3)
- ~20 keys in plaintext .env. `npx dotenvx encrypt` → ciphertext file safe
  to commit; `dotenvx run -- vite` decrypts into process.env — vite.config.ts
  reads unaffected. .env.keys → gitignore/keychain.
- Then `trufflehog git file://.` + `gitleaks git` history audit → rotate hits.
- Effort S (minutes). Do this regardless — it's the cheapest real win here.

### 12. inspect_ai eval harness + headless eval endpoint (evals, RANK 1)
- Cheapest REAL capability number: Python inspect_ai with custom solver →
  new `/api/cortex/eval/run` headless endpoint reusing provider chain +
  tool loop; ~20–40 tasks from existing verify scripts; results JSONL to
  .cortex-runtime/evals/. Microsandbox gives a bash tool for terminal-style
  tasks without Docker.
- Effort M (2–4 days). Everything else benchmark-shaped is heavier/wrong-fit
  (terminal-bench needs Docker+terminal agent; TheAgentCompany is a company
  sim; tau2 is customer-service; ToolSandbox measures the model not the agent).

### 13. promptfoo redteam (governance/evals)
- `npx`-installable, YAML config, targets any OpenAI-compatible endpoint —
  point at /api/ai/* proxy, run injection/tool-abuse/excessive-agency plugins.
  garak as second opinion. Run AFTER OPA lands so you're testing policy, not just model.
- Effort S for basic scan. Costs attacker/judge tokens (use cheap NIM model).

### 14. mcp-scan (governance)
- Scans configured MCP servers for tool-description poisoning — the #1 MCP
  attack, invisible to lane governance. One-shot `npx mcp-scan`; proxy mode
  optional for dev traffic logging.
- Effort S. Do it — 10 minutes, real visibility gap closed.

### 15. healthchecks.io pings (ops, RANK 1)
- Dead-man's-switch for keep-warm daemon, dream-consolidate cron, launchd
  deliverers, vite itself. One `fetch(hc-ping.com/<uuid>)` per run, guarded.
- Closes the "daemon died silently at 3am" gap. Effort <half day.

### 16. openclaw/imsg persistent RPC (channels, RANK 2)
- Replaces documented-hanging execFile-per-send iMessage path
  (debrief.ts:258) with `brew install steipete/tap/imsg` JSON-RPC stdio
  process; `imsg watch` unlocks INBOUND iMessage → agent.
- Effort S–M. Retires imessage-pending.txt + launchd workaround.

### 17. In-process @remotion/renderer (media, RANK 1)
- render_video already uses @remotion/renderer inside render-video.mjs —
  just still spawns it as a child. Move bundle/renderMedia into
  src/lib/remotion-job-runner.ts inside the vite process: progress
  callbacks, makeCancelSignal() cancellation, cached bundle, serialized
  job queue (16GB = max 1 render). Delete the spawn wrapper.
- Effort M. Everything else in the video pipeline builds on this.

### 18. Video post-processor: captions + audio mux (media, RANK 2)
- src/lib/video-post.ts: ffmpeg extract audio → stable-ts[mlx] or
  mlx-whisper word timestamps → ASS/SRT → burn or Remotion <Caption>
  overlay; optional ACE-Step 1.5 music bed (MPS/MLX supported on M1).
- SKIP MMAudio/HunyuanVideo-Foley locally (CUDA-bound, no M1 path).
- whisperX skip (diarization is PyTorch/CUDA-shaped, unneeded).
- Effort S–M per piece. Turns silent renders into distributable videos.

### 19. firecrawl-local binary + jina reader fallback (media/search)
- firecrawl-local (Rust CLI) = local scrape/crawl/map, zero API cost in dev;
  keep Firecrawl API for prod. jina r.jina.ai = free URL→markdown fallback
  before spending Firecrawl credits. lightpanda only if crawl volume grows.
- SKIP searxng (Firecrawl /search already covers), stagehang/browserbase,
  crawl4ai (Python sidecar for marginal gain).
- Effort S.

### 20. DuckDB persistence + sqlite-vec fact store (memory, cheap wins)
- DuckDB already adopted via cortex-analytics.ts — persist file-backed
  .cortex-runtime/analytics.duckdb instead of :memory: per request. Hours.
- sqlite-vec: vec0 extension inside a new fact store = hybrid
  vector+temporal KNN in one SQLite file, zero new services.

---

## Tier B — PORT-SUBSET / PATTERN (steal the idea, skip the framework)

### Graphiti (memory) — the one you keep asking about
- What it actually needs: Neo4j/FalkorDB + Python pipeline + LLM extraction
  per episode. Overkill for single-user local app — THAT'S why it never
  landed; every prior pass correctly judged the framework too heavy.
- The real gap it exposes: Hindsight recall has NO temporal semantics —
  stale facts linger forever, nothing supersedes, no "what was true at T".
- PORT: bi-temporal fact store (~200 lines): .cortex-runtime/memory-facts.db
  (better-sqlite3 + sqlite-vec), schema fact(subject,predicate,object,
  valid_from,valid_to,source_seq). Extraction = one cheap fast-tier LLM call
  per retain batch over the EXISTING maybeRetainEvent pipeline; supersession
  = set valid_to on contradicted facts (never delete — history feeds the
  3D constellation). Recall filters valid_to IS NULL. /api/cortex/memory/facts
  endpoint next to /graph so the visualizer can render expired edges dimmer.
- Effort M. This is "Graphiti-lite" — the 20% that matters.

### LiveStore → materializers only
- eventlog.ts is already event-sourced JSONL + hash chain. Skip the
  framework (own SQLite WASM + sync protocol you'd fight). Steal:
  deterministic materializer folding events → .cortex-runtime/state.db
  (tasks/agents/facts tables) so hot read paths stop rescanning JSONL.
  Eventlog stays source of truth; materializer is rebuildable cache.
- Effort M. Do after fact store if profiling shows read-path pain.

### Letta/MemGPT → labeled memory blocks
- Steal the OS-memory pattern: 3–5 labeled, size-bounded blocks
  (USER_MODEL, ACTIVE_TASK, OPERATING_NOTES, EPISODIC_ANCHORS) as
  .cortex-runtime/memory-blocks.json + memory_block_read/write tools in
  CORTEX_TOOLS (~150 lines). Always-visible tier vs Hindsight archival.
- Effort S–M.

### Cognee → provenance + usefulness reweighting
- Only ideas: source_seq provenance on facts (fold into fact store above)
  and recall-hit usefulness logging → future reweighting pass. ~100 lines
  once provenance exists. No framework.

### LanceDB/Neuml txtai/GraphRAG/LightRAG — SKIP
- sqlite-vec + DuckDB + Hindsight cover the need at fraction of weight.

### LavaMoat/endo — SKIP for tool exec
- microVM already beats in-process compartments on isolation strength;
  lockdown can't retrofit onto 15k-line vite.config.ts safely. Pattern only.

### OpenFGA/SpiceDB — SKIP (refuted)
- Agent permissions are action+args+context shaped, not relational.
  OPA covers it without a graph DB.

### NATS JetStream — SKIP / pattern
- JSONL+hash-chain is arguably BETTER for audit than JetStream. Real pain
  is replay tail-reading 53MB — fix with seq index sidecar, not a daemon.
- Adopt pattern: durable cursor = store last-read seq (already have seq).

### AgentDojo — PATTERN (methodology import)
- Don't run the Python framework; adopt suite/attack/injection-vector
  model: TS redteam harness replaying attack JSONL against
  /api/cortex/tools/execute, scored by whether governed tools fired.
  src/lib/cortex-agents/redteam/. Effort M. Pairs with promptfoo.

### vercel/chat (Chat SDK) — PATTERN
- Channels are outbound/pull not inbound webhooks; SDK needs Redis+webhooks
  for one user. Steal: unify sendDiscord/sendIMessage/barkPush behind one
  postToChannel(kind,text) interface — 30-line refactor.

### changedetection.io — PATTERN
- Add check_url_change cron appending to .cache/cortex-ambient.jsonl via
  existing ambientPush (~80 lines) instead of container + notification stack.

### Beszel — PARTIAL
- Host vitals alerting only (CPU/RAM/disk/GPU) — it does NOT monitor per-port
  HTTP health. Keep-warm registry + healthchecks covers service liveness.
  Adopt for host RAM pressure (the thing keep-warm prevents) if wanted.

### uptime-kuma — PATTERN
- Cheaper: render existing keepWarmRegistry (GET /api/cortex/daemon/keep-warm)
  in Cortex UI + push failures through ambientPush/barkPush. Kuma only if
  you want historical uptime graphs.

### Phoenix/Opik — PARTIAL (revisit)
- llm-traces.jsonl tap exists but no UI/spans/cost rollups. Phoenix =
  single-container OTEL LLM observability + datasets/evals built in.
  Adopt if you want trace UI; otherwise JSONL + small viewer suffices.

### hyperfine — ADOPT (trivial)
- brew install; wrap TTS/LLM first-token latency probes. 5 min, real numbers.

### Raycast — SPIKE (YAML route first)
- Custom Providers YAML can point Raycast at localhost OpenAI-compatible
  endpoints (mlx-lm/speaches) TODAY with zero code. Full extension later.

---

## Tier C — SKIP (wrong fit, honest callouts)

- PersonaPlex / Moshi / omni models (GLM-4-Voice, Qwen3-Omni, Ultravox,
  Mini-Omni): need 64GB+ unified memory or CUDA. Cascade architecture is
  CORRECT for 16GB. North star only if hardware changes.
- pipecat smart-turn: custom semantic-eou likely matches; adopt ONNX weights
  only if misses show in real use. Effort S, low priority.
- FluidAudio Parakeet-EOU: architecturally elegant (VAD+STT+EOU in one
  CoreML model) but needs Swift helper binary — revisit for native macOS app.
- assistant-ui: L effort, runtime impedance mismatch, would give back
  ChatGPT-generic chat vs Cortex's HUD artifact cards. SKIP.
- vercel ai-elements: mine message-part anatomy as inspiration only.
- tldraw: license + L effort + 2D whiteboard is a different product surface.
  Steal Agent starter kit's context-serialization pattern if canvas returns.
- MCP-UI: PARTIAL only — add UIResourceRenderer in ArtifactRenderer as new
  artifact kind (cheap insurance); skip server-side until needed.
- Remotion Lambda: renders ~1min on-box near-zero cost; AWS dep unjustified.
- MMAudio/HunyuanVideo-Foley/audiocraft locally: CUDA-bound. ACE-Step yes
  (MPS/MLX), these no.
- whisperX: diarization stack solves a problem you don't have.
- searxng/stagehand/browserbase/crawl4ai/lightpanda-for-now: Firecrawl +
  bespoke CDP already cover; revisit lightpanda only on crawl volume.
- Matrix/signal-cli/Baileys/mautrix/novu/apprise/ntfy: multi-user infra
  for a single-user product. Bark covers iOS push.
- terminal-bench/Harbor, TheAgentCompany, ToolSandbox, tau2-bench,
  DeepEval framework: wrong shape; inspect_ai + custom tasks is the play.
- Prometheus/Grafana, dozzle, devpod, orbstack/colima (until containerized),
  tauri (electron already in devDeps), OpenFGA, LavaMoat, NATS, LiveStore
  framework, Letta server, Cognee, Kuzu/graph DBs, mlx-vlm nemotron sizes
  (need 46–88GB), ml-ane-transformers (reference repo not library —
  pattern only: small classifiers → CoreML/ANE if GPU contention appears),
  KoboldCpp/LocalAI (speaches+mlx-lm cover it lighter).

---

## Recommended build order (impact × effort)

PHASE 1 — this week, all S-effort, zero architecture risk:
1. dotenvx encrypt + trufflehog/gitleaks audit
2. healthchecks.io pings in keep-warm/dream-cron/launchd paths
3. mcp-scan one-shot on MCP configs
4. hyperfine latency probes on TTS/LLM chain
5. DuckDB persisted analytics file
6. promptfoo redteam baseline scan (before OPA, for comparison)

PHASE 2 — voice + memory core (the "eons ahead" felt difference):
7. parakeet-mlx ASR server :8179 → /api/cortex/stt rung
8. mlx-audio Chatterbox :3901 → /api/cortex/tts rung + cortex-emotive voice
9. Bi-temporal fact store (Graphiti-lite) + sqlite-vec + memory blocks
10. AG-UI vocabulary on SSE + A2UI agent-side (emit_surface tool)

PHASE 3 — governance depth:
11. microsandbox network policy + secret bindings
12. OPA-wasm lane decisions (port lanes incrementally)
13. AgentDojo-style TS redteam harness (informed by promptfoo results)
14. Prompt Guard 2 ONNX input filter on tool outputs (untrusted content)

PHASE 4 — media pipeline:
15. In-process renderMedia job runner (progress + cancel)
16. video-post.ts: captions (stable-ts mlx) + optional ACE-Step music bed
17. firecrawl-local + jina fallback
18. FLAGSHIP LATER: CortexCoreSceneV2 → ThreeCanvas deterministic
    composition (needs frame-seeded signal bus — real refactor, not wrapper)

PHASE 5 — on-device tier:
19. Chrome Prompt API local-intent.ts
20. WebLLM local cortex fallback (3B Q4)
21. mlx-lm :8081 + speaches :8000 local services pair
22. openclaw/imsg RPC (fixes iMessage hang + inbound)
23. inspect_ai harness + /api/cortex/eval/run

DEFERRED until hardware/product changes:
- PersonaPlex/Moshi/omni (need 64GB+), FluidAudio Swift shim (native app),
  tldraw canvas (product decision), LiveStore framework (multi-device),
  NATS (multi-process), matrix channels (multi-user), terminal-bench
  leaderboard (needs terminal agent + Docker), Remotion Lambda (volume).
