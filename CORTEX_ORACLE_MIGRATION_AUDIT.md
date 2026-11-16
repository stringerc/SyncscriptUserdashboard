# CORTEX ORACLE MIGRATION — PHASE 0 AUDIT

> Generated 2026-11-16 per `CORTEX_ORACLE_MIGRATION_PROMPT.md` §1.
> All findings verified against live code/VM state. File:line evidence throughout.

## 0. HEADLINE FINDINGS

1. **Disk was a hidden blocker — now mitigated.** VM `/` hit 96% (1.9 GB free) after today's installs. Cleaned `uv cache` + `pip cache` + `apt clean` → **5.6 GB free**. Budget below is tight but feasible. pocket-tts venv alone is 5.6 GB — already installed, do not reinstall.
2. **Gmail live-inbox is Mac-only by mechanism** — `scripts/cortex-gmail-live.mjs` uses AppleScript (`Application("Google Chrome")`, reads Gmail tab titles). Cannot run on Linux. Needs VM-Chrome/CDP rework or honest degradation.
3. **All 17 `storefront/tools/*.mjs` import playwright-core from a Mac Cursor MCP path** — hard blocker until repointed to a real `node_modules` dep on VM.
4. **Native-module risk is LOW.** No better-sqlite3/sharp/bcrypt/canvas/onnxruntime-node in deps. Real risks: `esbuild` + `@swc/core` (arm64 prebuilds exist), `puppeteer`/`playwright` (arm64 linux supported), `electron`/`electron-builder` (devDeps — exclude from prod install if possible).
5. **TTS chain already anticipates Oracle** — `/api/cortex/tts` falls through VoiceStudio → Cortana Pocket (:8911) → F5 render (:8910) → Kokoro (:8880) → Pocket fallback (:8890, comment literally says "Runs on Oracle :8890"). Pocket TTS Cortana clone verified working on VM at 1.91× realtime.
6. **Voice is no longer degraded** — Pocket TTS with Cortana conditioning wav runs on VM CPU. F5+RVC+DSP render path (:8910, `cortana_h2|cortana_clone|cortana_holo` voices, ~60s broadcast renders) stays Mac-only unless RVC is ported — acceptable: conversational voice works, broadcast renders degrade.

---

## 1. MIDDLEWARE SURFACE — `/api/cortex/*` (44 routes) + `/api/ai/*` (5 routes)

All handlers live in `vite.config.ts` as `server.middlewares.use(...)`. Classification:

| Route | Coupling | State dep | External dep | Mac-only? | Migration action |
|---|---|---|---|---|---|
| `/api/cortex/agents/state` `task` `task/cancel` `stream` `spec` `spawn/propose` `routines` `llm` | agentRuntime | `.cortex-runtime/` | LLM providers | No | move |
| `/api/cortex/discord/interactions` `state` `sync-commands` | Discord surface | `.cortex-runtime` | Discord API | No | move (ingress repoint) |
| `/api/cortex/distribution/status` | distributor | `distribution-queue.json` | — | No | move |
| `/api/cortex/bus/state` `viz/state` `viz/config` | viz/bus | `.cortex/bus/state.json` | — | No | move |
| `/api/cortex/ambient/pending` `ambient/context` | ambient | state files | — | No | move |
| `/api/cortex/proactive/execute` `proactive/audit` | initiative engine | state | LLM | No | move |
| `/api/cortex/initiative/sense` `somatic` | sensors | state | — | No | move |
| `/api/cortex/vigilance/status` | warden | — | — | No | move |
| `/api/cortex/models/health` | sentinel | — | LLM catalog | No | move |
| `/api/cortex/forecast/feedback` | forecaster | `.cortex-runtime` | LLM | No | move |
| `/api/cortex/vault/graph` | librarian/memory | `OBSIDIAN_VAULT_PATH` | — | No (vault portable) | move + rsync vault |
| `/api/cortex/trust/policy` `escalate` | trust | state | — | No | move |
| `/api/cortex/drill/reset` `drill/connections` | drills | state | — | No | move |
| `/api/cortex/chat-history` `chat-append` | chat | state | — | No | move |
| `/api/cortex/call` `call-pending` | voice calls | state | — | verify | audit in spec |
| `/api/cortex/tts` `/api/ai/tts` | TTS chain | env URLs | local TTS svcs | partially | move; repoint env URLs |
| `/api/cortex/stt` `/api/ai/stt` | STT | env | Groq API + :8178 | No (Groq primary) | move |
| `/api/ai/nexus-guest` `cartesia-tts` `google-tts` | misc AI | env keys | provider APIs | No | move (cartesia dead key) |
| `/api/cortex/browser-shot.png` | browser shot | CDP :9222 | VM Chrome | **No — improves** | move (local CDP, no tunnel) |
| `/api/cortex/mobile/pairing` | phone bridge | state | — | verify | spec |
| `/api/cortex/lights/sync` | Govee | env `GOVEE_API_KEY` | Govee API | No | move |
| `/api/cortex/geo/watch` | NWS geo | `CORTEX_WATCH_ZONES` | NWS API | No | move |
| `/api/cortex/calendar/upcoming` | calendar | ? | verify mechanism | **verify** | spec — check if Apple Calendar |
| `/api/cortex/gmail/live-inbox` `gmail/triage` | gmail | AppleScript Chrome | **Mac Chrome** | **YES — Mac-only** | rework to VM CDP or degrade |
| `/api/cortex/gev-url` | globe viz | `GEV_URL`/`CORTEX_GEV_URL` | sibling app :5180 | Mac-only sibling | degrade or move GEV later |
| `/api/cortex/daemon/keep-warm` | keepalive | — | — | No | move |
| `/api/cortex/accomplishments/log` `tools` `ping` | misc | state | — | No | move |

**Route count: 49 total** (44 cortex + 5 ai). ~46 portable, 3 Mac-bound (gmail ×2, gev-url).

## 2. ENV VAR INVENTORY (~60 unique)

`grep process.env` across `vite.config.ts` + `src/lib/`:

**Secrets — transfer via scp only, chmod 600:**
`STRIPE_SECRET_KEY`, `GUMROAD_EMAIL`/`GUMROAD_PASSWORD`, `SUPABASE_ANON_KEY`/`VITE_SUPABASE_ANON_KEY`, `OPENROUTER_API_KEY`, `GROQ_API_KEY`, `GEMINI_API_KEY`/`GOOGLE_API_KEY`, `GITHUB_TOKEN`/`GH_TOKEN`, `FIRECRAWL_API_KEY`, `GOVEE_API_KEY`, `CORTEX_EDGE_TOKEN`, `CORTEX_BARK_KEY`, `HERMES_AUTH_TOKEN`, `R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`/`R2_ACCOUNT_ID`/`R2_BUCKET_NAME`, `SENTRY_AUTH_TOKEN`, `CORTANA_BRIDGE_TOKEN`/`VITE_CORTANA_BRIDGE_TOKEN`, `CARTESIA_API_KEY` (dead — user retired it), `POCKET_TTS` HF token (already on VM at `~/.cortex/pocket-tts.env`).

**Config — transfer:**
`PORT`, `CORTEX_AGENTS_STATE_DIR`, `OBSIDIAN_VAULT_PATH`, `CORTEX_TZ`, `STOREFRONT_URL`, `CORTEX_TTS_ENDPOINTS`, `CORTEX_WARDEN_INTERVAL_MS`, `CORTEX_SELFTEST_HOUR`, `CORTEX_CONSOLIDATE_HOUR`, `CORTEX_BRIEF_HOUR`, `CORTEX_OVERNIGHT_SELFTEST`/`FULL_TEST`, `CORTEX_KEEP_WARM`, `CORTEX_AMBIENT`, `CORTEX_TRUST_ENABLED`/`VITE_CORTEX_TRUST`, `CORTEX_WATCH_ZONES`, `HERMES_EXECUTOR_URL`/`HERMES_BASE_URL_TARGET`, `CORTANA_BRIDGE_URL`, `GEV_URL`/`CORTEX_GEV_URL`, `VERCEL`/`CI`/`GITHUB_ACTIONS` (build-time only).

**Mac-only endpoint URLs — repoint or leave unset on VM:**
`VOICESTUDIO_URL` (:3900 MLX), `KOKORO_TTS_URL` (:8880 Mac server), `CORTANA_TTS_URL` (:8910 F5/RVC render), `CORTANA_POCKET_URL` (:8911), `CORTANA_EMOTION_URL` (:8912), `POCKET_TTS_URL` (:8890), `PUPPETEER_EXECUTABLE_PATH`, `CORTEX_BARK_URL`.

## 3. HARDCODED MAC PATHS (must fix before VM boot)

| File:line | Path | Fix |
|---|---|---|
| `vite.config.ts:941` | `process.env.HOME \|\| '/Users/Apple'` | env HOME works on Linux — fine, but verify fallback never triggers |
| `vite.config.ts:950` | `'/Users/Apple/src/free-claude-code/.env'` | FCC proxy env — gate behind env var or skip on VM |
| `vite.config.ts:2928,3047,5260` | Mail.app sandbox errors | already honest-error — Mac-only mail features, leave as-is |
| `src/lib/cortex-morning-trajectory.ts:47` | `workspaceRoot = '/Users/Apple/syncscript'` | → env `SYNCSPACE_ROOT` or `process.cwd()` |
| `src/lib/cortex-native-phone.ts:53` | same | same |
| `src/lib/cortex-tool-synthesis.ts:828` | `'/Users/Apple/.openclaw/skills'` | → env or `~/.openclaw/skills` |
| `src/lib/cortex-globe.ts:4` | GEV sibling `/Users/Apple/src/gods-eye-view` :5180 | Mac-only viz — degrade |
| `src/lib/storefront/build-catalog.ts:135-136` | `/Users/Apple/projects/income/...` + `/Users/Apple/syncscript/...` | → repo-relative/env |
| **`storefront/tools/*.mjs` ×17** | `import { chromium } from '/Users/Apple/.cursor/mcp-servers/google-flow-browser-mcp/node_modules/playwright-core/index.mjs'` | **all 17 files** — repoint to `playwright-core` package dep |

## 4. PORT / PROCESS MAP — what runtime expects listening

| Port | Service | VM status | Action |
|---|---|---|---|
| 5173 | self (vite) | free? check | VM runtime port |
| 9222 | automation Chrome CDP | ✅ already on VM | local — delete Mac tunnel need |
| 8880 | Kokoro TTS server | ❌ not installed as service | install kokoro-onnx serve OR leave unset (chain skips) |
| 8890 | Pocket TTS fallback | ✅ binary installed | **needs systemd unit** `pocket-tts serve` |
| 8910 | Cortana F5/RVC render | ❌ Mac-only | degrade — render voices unavailable |
| 8911 | Cortana Pocket conversational | ✅ binary works | **needs systemd unit** with cortana yaml+voice |
| 8912 | Cortana emotion Pocket | ✅ binary works | optional second unit |
| 3900 | VoiceStudio (MLX CSM) | ❌ Mac-only | leave unset — chain skips |
| 8178 | whisper.cpp local STT | optional | Groq primary covers; skip or install later |
| 5180 | gods-eye-view sibling | ❌ Mac app | degrade `gev-url` |
| 8082 | epistemic-claim-graph? | verify | spec |
| 11434 | Ollama | not present | check if actually called at runtime |
| 18789 | persistent-self-model | verify | spec |
| 18880 | Hermes executor | verify | spec |
| 5212 | cortana bridge proxy target | verify | spec |

## 5. ARM64 NATIVE-MODULE SWEEP

`package.json` deps are ~95% pure JS/TS. Native-bearing deps:

| Dep | Native? | arm64 linux status |
|---|---|---|
| `esbuild` (via vite) | yes | ✅ official linux-arm64 prebuilds |
| `@swc/core` (vite-plugin-react-swc) | yes | ✅ linux-arm64-gnu prebuilds |
| `playwright` / `@playwright/test` | browser dl | ✅ arm64 chromium already on VM (`~/.cache/ms-playwright` 698M) |
| `puppeteer` | chrome dl | ⚠️ verify arm64 chrome-for-testing or set `PUPPETEER_EXECUTABLE_PATH` to VM chromium |
| `@sentry/node` | optional native | ✅ pure-JS fallback exists |
| `electron`, `electron-builder` | yes | devDeps — **exclude via `npm ci --omit=dev`? NO — vite/plugins are devDeps too. Keep full `npm ci`; electron has linux-arm64 builds** |
| `@capacitor/*` | iOS-only | inert on server |
| `sharp`, `better-sqlite3`, `bcrypt`, `canvas`, `onnxruntime-node` | — | **NOT PRESENT** ✅ |

**Verdict: LOW risk.** `npm ci` on VM is the verification gate — expect success, watch for `puppeteer` postinstall chrome download (may need `PUPPETEER_SKIP_DOWNLOAD` + executable path to existing chromium).

## 6. DISK BUDGET (VM `/` — 45 GB total)

Current: **5.6 GB free** (post-cleanup).

| Item | Size | Notes |
|---|---|---|
| `/opt/syncscript` existing | 4.1 GB | source-only rsync, **no node_modules/.git** — candidate to BE the runtime dir (saves duplicate source copy) |
| `/opt/cortex-app` | 3.1 GB | pre-existing cortex app — clarify if still needed |
| pocket-tts venv | 5.6 GB | already installed — sunk cost, keep |
| uv/pip/apt caches | ~0 | cleaned |
| Chrome profile+playwright | ~760 MB | already there |
| **Needed for runtime**: source (~1.8 GB excl node_modules) + `npm ci` (~2.5 GB) + vault 19 MB + `.cortex-runtime` <1 MB + kokoro models 340 MB (optional) | **~4.7 GB** | fits in 5.6 GB with ~0.9 GB headroom — **TIGHT, no room for error** |

**Recommendation:** reuse `/opt/syncscript` as runtime root (already rsync'd, just needs refresh + `npm ci`), OR free more space first (audit `/opt/cortex-app` necessity, old docker images, journal logs). Do NOT create a third copy.

## 7. OTHER MAC-ONLY SURFACE

- `scripts/cortex-gmail-live.mjs` — AppleScript Chrome automation (**rework or degrade**)
- `~/.cortex/bin/` scripts: `aiqou-inject.sh`, `aiqou-probe.py`, `netwatch.sh` — Mac-local utilities, not runtime-critical
- `cortex-globe.ts` GEV :5180 — sibling app stays Mac
- LaunchAgents to retire post-cutover: `com.syncscript.vite`, `com.cortex.cdp-tunnel`, `com.tailscale.cortex` (funnel repoint decision pending)
- Mac pollers of :5173: visualizer UI in browser, mobile pairing, keep-warm daemon — verify none are business-critical

## 8. MIGRATION-ACTION SUMMARY

| Count | Action |
|---|---|
| ~46 routes | move as-is |
| 17 `storefront/tools/*.mjs` | repoint playwright-core import → package dep |
| 5 hardcoded paths in `src/lib` | env-ize (`SYNCSPACE_ROOT`, `OPENCLAW_SKILLS_DIR`, etc.) |
| 2 gmail routes | rework to VM Chrome CDP **or** degrade honestly |
| 1 gev-url | degrade (sibling app stays Mac) |
| ~10 env endpoint URLs | repoint to VM-local services (pocket-tts :8890/:8911 systemd units) |
| ~25 secrets | scp to `/opt/cortex-runtime/.env` chmod 600 |
| vault 19 MB + `.cortex-runtime` | rsync |
| pocket-tts | 2 systemd units (8890 fallback + 8911 cortana) |
| kokoro | optional — install serve or leave unset |
| Discord ingress | Tailscale Funnel on VM **or** cloudflared **or** syncscript.app proxy — DECIDE in spec |

**Phase 0 verdict: MIGRATION IS FEASIBLE.** No architectural blockers. Binding constraints: disk headroom (~0.9 GB), gmail rework decision, playwright import repoint (mechanical), npm ci verification.
