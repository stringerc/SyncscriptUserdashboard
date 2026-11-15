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


