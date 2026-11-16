# CORTEX ORACLE MIGRATION — ELITE SPEC PROMPT

> **Mission:** Migrate the SyncScript Cortex runtime from the Mac (Vite dev server, `agentRuntime`, Discord surface, agent workers, proactive engine) to the Oracle Cloud Ampere VM (`syncscript-a1-retry-2`, aarch64 Ubuntu 24.04, 4 OCPU / 24 GB RAM / ~8.8 GB free disk) **without breaking anything that currently works** — then retire the Mac-side services so Cortex keeps running when the laptop sleeps, dies, or travels.
>
> **Business context:** distribution pipelines (Gumroad, Pinterest, Reddit, Dreamina) and agent work must not halt when the Mac is off. Revenue infrastructure cannot have a single point of failure on a laptop.

---

## 0. KNOWN GROUND TRUTH (verified 2026-11-16 — do not re-derive, verify only if stale)

### Current topology

| Component | Location | Persistence |
|---|---|---|
| Agent runtime, task queues, workers, LLM matrix | Mac: Vite middleware in `vite.config.ts` (`agentRuntime`) | Mac launchd `com.syncscript.vite` — dies on sleep |
| Discord interactions endpoint | Tailscale Funnel `cortex.tailc088d4.ts.net` → Mac `localhost:5173` | launchd `com.tailscale.cortex` + `com.syncscript.vite` |
| Automation Chrome (CDP :9222) | **Oracle VM** — systemd `cortex-xvfb` + `cortex-chrome`, profile `/opt/cortex-chrome/profile`, x11vnc :5900 | already always-on |
| Mac→Oracle CDP | SSH tunnel `localhost:9222`→oracle via launchd `com.cortex.cdp-tunnel` | survives reboot, dies on sleep |
| Agent Reach | Mac `~/.local/bin/agent-reach` (uv tool) + `~/.agent-reach/` | Mac-local |
| Cortex vault | `~/.cortex/vault` — 19 MB markdown, zero-dep (`OBSIDIAN_VAULT_PATH` overridable) | Mac-local, trivially portable |
| Agent state | `.cortex-runtime/` — 352 KB JSON (tasks, threads, routines, proposals, spawn specs) | Mac-local, portable |
| Repo | `/Users/Apple/syncscript` — 4.3 GB total, ~1.8 GB source, 2.5 GB `node_modules` | git `security-hardening` branch |
| Oracle disk | `/` 45 GB, **8.8 GB free**; `/opt/syncscript` already rsync'd (4.1 GB), `/opt/cortex-app` 3.1 GB | tight — budget carefully |
| Oracle node | v22.22.2, npm present, passwordless sudo via `ssh oracle` | — |

### Mac-only dependencies that CANNOT migrate (must be replaced, proxied, or explicitly descoped)

- **Kokoro TTS / voice pipeline** (`cortana_tts_server.py`, pocket-tts, Whisper/STT) — local GPU/ML models; stays Mac. Cortex voice features degrade gracefully when Mac is off — spec must define the degraded-mode contract.
- **`textutil` / macOS PDF-DOCX conversions** in `create_document` — already degrade gracefully on Linux (writes .md+.html only) per MEMORY.md.
- **Hardcoded Mac paths**: `storefront/tools/*.mjs` import playwright-core from `/Users/Apple/.cursor/mcp-servers/google-flow-browser-mcp/node_modules/...` — must become a real dependency or env-configured path on the VM.
- **Gmail scrape** (`/api/cortex/gmail/live-inbox`) — verify mechanism; if it drives local Chrome session it needs rework on Oracle Chrome.
- **Calendar mirror, geo-watch (NWS), ambient queue** — verify external deps; likely portable HTTP.
- **Supabase Edge functions** — already deployed, unaffected.
- **Gumroad/Pinterest/Reddit/Dreamina tools** (`storefront/tools/*.mjs`) — run under `sh()` cwd=STOREFRONT; must run on VM against **local** CDP :9222 (no tunnel needed once colocated — actually *simpler*).

### Services to retire on Mac after cutover (do NOT delete until verified)

- `com.syncscript.vite` launchd job
- `com.cortex.cdp-tunnel` launchd job (VM-local CDP needs no tunnel)
- `com.tailscale.cortex` + Tailscale Funnel — **repoint or retire**: Discord Interactions Endpoint URL changes to the VM's public endpoint (Tailscale Funnel on VM, or cloudflared named tunnel, or syncscript.app reverse proxy — DECIDE in spec)
- ngrok config on Mac (unused leftover)

### Secrets handling (non-negotiable)

- `.env` contains live keys (Discord bot token, Supabase service-role, provider keys, Google creds). Transfer via `scp`/`rsync` over SSH **only** — never git, never chat, never logs. VM copy at `/opt/cortex-app/.env` pattern exists; create `/opt/cortex-runtime/.env` with `chmod 600`.
- GitGuardian token + Discord bot token + ngrok authtoken were exposed in chat historically — flag rotation as optional follow-up, not a blocker.

---

## 1. PHASE 0 — COMPLETE DEPENDENCY AUDIT (read-only, produce `CORTEX_ORACLE_MIGRATION_AUDIT.md`)

Enumerate **every** runtime dependency with file:line evidence. Minimum coverage:

1. **vite.config.ts middleware surface** — all `/api/cortex/*` routes (~55 handlers): which are agent-runtime-coupled vs standalone. For each: state deps (`.cortex-runtime`, `.env`, local files), external deps (HTTP APIs, local services), Mac-only calls.
2. **Agent runtime** (`src/lib/cortex-agents/*`) — runtime.ts, workers.ts, registry, forecaster, prep, warden, distribution, sentinel — every `toolExecute`, `fetch`, `fs`, `child_process`, hardcoded path, localhost URL, env var read.
3. **storefront/tools/*.mjs** — every script the distributor runs: CDP usage, playwright import paths, file outputs (`storefront/browser/`, `distribution-queue.json`), external CLIs (bili-cli? node only?).
4. **cortex-proactive-initiative, cortex-obsidian-memory, ambient, vigilance, bus/viz state** — file paths, ports, schedules.
5. **Env var inventory** — `grep -rhoE "process\.env\.[A-Z_]+"` across runtime files → classify: secret (transfer), config (transfer), Mac-only ( Kokoro URLs etc.).
6. **Port/process map** — everything the runtime expects listening locally (Kokoro :8880? VoiceStudio? Ollama? keep-warm daemon? edge-token?).
7. **ARM64 compatibility sweep** — `npm ls` for native modules (better-sqlite3, sharp, esbuild, bcrypt, canvas, playwright, onnxruntime-node, whisper.cpp bindings). For each: confirm linux-arm64 prebuilt exists or plan build-from-source. `npm ci --ignore-scripts` test on VM is the verification.
8. **Disk budget** — compute exact footprint: source rsync (exclude node_modules, .git objects optional, archive/, graphify-out/, *.png heavy assets) + `npm ci` prod+dev size + vault 19MB + `.cortex-runtime` + Chrome profile already present. Must stay under ~6 GB to leave headroom.

**Output:** audit doc with a table per dependency: `component | file:line | state-dep | external-dep | mac-only? | migration-action (move/proxy/descop)`.

---

## 2. PHASE 1 — MIGRATION SPEC (`CORTEX_ORACLE_MIGRATION_SPEC.md`)

Write the contract. Must include:

- **Target architecture diagram**: VM services (cortex-runtime systemd unit running `vite` or a dedicated node server — DECIDE: keep Vite dev server vs `vite preview`/custom node entry; recommend whatever is most robust for always-on), public ingress choice (Tailscale Funnel on VM vs cloudflared named tunnel vs syncscript.app path — evaluate all three, pick one, justify), Mac's residual role (visualizer UI? voice? Devin sessions?).
- **File manifest**: exact rsync/include-exclude list, destination paths (`/opt/cortex-runtime/` proposed), `.env` placement, vault path (`OBSIDIAN_VAULT_PATH=/opt/cortex-runtime/vault`), state dir (`CORTEX_AGENTS_STATE_DIR` or cwd-relative `.cortex-runtime`).
- **Cutover sequence**: parallel-run strategy — VM instance runs alongside Mac on a *different port*; Discord endpoint stays on Mac until VM verified; then atomic-ish switch (Discord portal URL update is the only user-visible cutover); rollback = repoint URL back + restart Mac services.
- **Degraded-mode contract**: explicit list of features that require Mac (voice/TTS/STT, pdf conversions, anything Kokoro) — each must return honest "unavailable — host offline" not hang or fabricate.
- **Health surface**: `/api/cortex/discord/state`-style endpoint or extend `/api/cortex/agents/state` with `host: oracle|mac`, uptime, last-seen; WARDEN patrol checks.
- **Verification gates**: per-phase checklist (below) — nothing proceeds on assertion, only on evidence.

---

## 3. PHASE 2 — BUILD (only after spec approved)

Order matters — each step independently verifiable:

1. **Provision**: `/opt/cortex-runtime` dir structure, `.env` (chmod 600), rsync repo (exclude `node_modules`, `.git` optional keep for provenance, `archive/`, `graphify-out/`, `storefront/browser/*.png` unless needed, `*.backup*`).
2. **Deps**: `npm ci` on VM (aarch64) — fix native-module failures; patch hardcoded `/Users/Apple/...` import paths in `storefront/tools/*.mjs` to resolve playwright-core from VM `node_modules` (add `playwright-core` as real dep or copy the pinned version — match Mac's version for CDP compat).
3. **State seed**: rsync `.cortex-runtime/` + `~/.cortex/vault` → VM paths; env vars for paths.
4. **Boot**: systemd unit `cortex-runtime.service` (User=ubuntu, WorkingDirectory=/opt/cortex-runtime, EnvironmentFile=/opt/cortex-runtime/.env, Restart=always, After=network.target cortex-chrome.service). Port: pick non-conflicting (e.g. 5173 if free on VM — CHECK; else 5174 and ingress maps accordingly).
5. **Smoke gates** (ALL must pass before proceeding):
   - `curl /api/cortex/discord/state` → `configured:true`
   - POST unsigned interaction → `invalid signature` (proves signature path live)
   - `/api/cortex/agents/state` → 12 agents registered
   - Submit scout `social_scan` task → completes (proves agent-reach path — **NOTE: agent-reach is Mac-local; either install it on VM too (`uv tool install` works on arm64? VERIFY — if not, social_scan degrades honestly or stays Mac-proxied — DECIDE in spec) or accept temporary degradation**)
   - Submit distributor `browser_shot` → SHOT via **local** :9222 (no tunnel)
   - librarian recall, forecaster forecast_status, warden patrol → all complete
   - Discord PING through new public URL → `sig=ok`
6. **Public ingress**: stand up chosen tunnel/Funnel on VM; update Discord portal URL; verify signed PING + `/cortex status` live.
7. **Soak**: 24h parallel-run with Mac instance still up but Discord pointed at VM; monitor `.cortex-runtime` writes, task completions, WARDEN patrols, memory/disk.
8. **Cutover**: declare VM authoritative; Mac Vite stops serving Discord (keep running for visualizer/voice if desired — DECIDE); retire/disable Mac launchd jobs **only after** soak passes; keep them disabled-not-deleted for 1 week rollback window.
9. **Cleanup**: remove CDP tunnel need on Mac (VM tools use local :9222); document rollback in CORTEX.md §4.1.

---

## 4. HARD RULES

- **No breaking changes to the Mac instance during migration** — it stays the fallback until soak completes. Parallel-run is mandatory.
- **Evidence-or-silence**: every migration claim requires a curl/task-log artifact. "Should work" is not a status.
- **Secrets**: `.env` via scp only, chmod 600, never in git/chat/logs. Audit `git status` before every commit on VM copy too.
- **ARM64 first**: verify every native dep BEFORE writing migration code — a failed `npm ci` found on cutover day is a business outage.
- **Discord is the only user-visible cutover** — everything else is invisible infrastructure. The portal URL swap is the moment of truth; have rollback rehearsed BEFORE doing it.
- **Degradation honesty**: any feature that can't migrate (voice, pdf conversions) must fail loudly-honest, never silently.
- **Disk discipline**: 8.8 GB free is the binding constraint — no `npm ci` experiments on VM without measuring; clean `node_modules` caches, don't duplicate `/opt/syncscript` and `/opt/cortex-runtime` node_modules unnecessarily (DECIDE: reuse `/opt/syncscript` checkout vs fresh `/opt/cortex-runtime` — fresh is cleaner, costs ~2 GB).
- **Update `CORTEX.md` §4.1** when topology changes — it is the authoritative map.

---

## 5. OPEN QUESTIONS THE SPEC MUST ANSWER

1. Vite dev server vs production build (`vite build` + `vite preview` or custom node entry) on VM — which is more robust for 24/7?
2. Public ingress: Tailscale Funnel on VM (needs tailscale on VM — ARM64 supported) vs cloudflared named tunnel (needs domain on Cloudflare or trycloudflare ephemeral — REJECT ephemeral) vs syncscript.app reverse proxy on existing web host — pick ONE.
3. Agent Reach on VM: does `uv tool install` + channels work on aarch64 Linux? OpenCLI needs Node+Chrome — Chrome exists on VM already. If agent-reach can't run headless-server-side, spec the fallback (social_scan stays Mac-routed through a small proxy, or degrades).
4. Gmail/calendar/geo-watch: do they depend on Mac-local browser sessions or pure HTTP+env creds?
5. Does anything else on the Mac poll `localhost:5173` that would break (visualizer UI open in browser, mobile pairing, keep-warm daemon, netwatch)?
6. Rollback rehearsal: exact command sequence to repoint Discord back to Mac Funnel and restart Mac services — written BEFORE cutover, tested.

---

## 6. DEFINITION OF DONE

- [ ] Audit doc complete with file:line evidence for every dependency
- [ ] Spec approved (all open questions answered)
- [ ] VM instance passes ALL smoke gates with artifacts
- [ ] Discord live on VM endpoint; Mac services disabled (not deleted)
- [ ] 24h soak clean: zero unexplained task failures, WARDEN patrols healthy
- [ ] Rollback procedure documented and rehearsed
- [ ] CORTEX.md §4.1 updated to reflect new topology
- [ ] Mac launchd jobs remain installed-but-disabled for 7-day rollback window
