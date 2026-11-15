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

