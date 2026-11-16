# CORTEX ORACLE MIGRATION — SPEC (Phase 1)

> Approved-direction spec per `CORTEX_ORACLE_MIGRATION_PROMPT.md` §2, grounded in `CORTEX_ORACLE_MIGRATION_AUDIT.md`.
> Every decision below answers an audit finding with evidence.

---

## 0. DECISIONS (the open questions, answered)

### D1 — Runtime root: **fresh `/opt/cortex-runtime`** (not reuse, not cortex-app)

- `/opt/cortex-app` is a **stale Nov-11 snapshot** ("User Dashboard 0.1.0") with **zero agent runtime** (`src/lib/cortex-agents/` absent, 0 route matches). It serves old cortex endpoints behind auth. **Leave it running untouched during migration** — it may be serving something (voice bridge depends on :8790 not :5173; the trycloudflare tunnel points at it). Retire decision deferred to post-soak cleanup (frees 3.1 GB).
- `/opt/syncscript` is a source-only rsync (4.1 GB, no node_modules/.git) — **do not build on it**; it's a stale snapshot too and mixing refresh+npm ci muddies rollback. Fresh dir is cleaner and only costs ~1.8 GB source.
- Fresh `/opt/cortex-runtime` = current `security-hardening` branch rsync, excluding `node_modules`, `.git`, `archive/`, `graphify-out/`, `storefront/browser/*.png` history.

### D2 — Server mode: **Vite dev server under systemd** (not production build)

The entire Cortex surface — all 49 middleware routes, agent runtime, Discord handlers — lives inside `vite.config.ts` `configureServer`. `vite preview`/`vite build` output **does not include it**. A custom node entry would be a rewrite, not a migration. `vite dev` is what runs on the Mac today and is proven. Run it with `NODE_ENV=production`-equivalent env where safe; optimize later if resource pressure appears (24 GB RAM is ample).

### D3 — Ingress: **Tailscale Funnel on the VM**

- VM already has `cloudflared` but only **ephemeral trycloudflare quick tunnels** (`cortex-tunnel.service` → :5173, `voice-tunnel.service` → :8790) — URLs rotate on restart, **unacceptable for Discord**.
- Named cloudflared tunnel needs a domain on Cloudflare — syncscript.app is on Porkbun; moving DNS is a bigger change than needed now.
- **Tailscale Funnel on VM**: install tailscale (linux-arm64 ✅), join existing tailnet, `tailscale funnel 443` → `127.0.0.1:5174`. Stable MagicDNS name `syncscript-a1-retry-2.tailc088d4.ts.net` (or set a friendly machine name). Same proven pattern as the Mac endpoint, free, survives reboots via systemd.
- Discord portal URL changes **once** at cutover — the single planned user-visible moment. Old Mac funnel stays live until soak passes.

### D4 — Port: **5174** on VM

5173 is occupied by cortex-app. 5174 avoids all conflict; ingress maps to it explicitly.

### D5 — Gmail: **degrade honestly in v1, rework as follow-up**

`/api/cortex/gmail/*` uses AppleScript+Mac Chrome — impossible on Linux. v1 returns `{ ok:false, error:'unavailable on oracle host — gmail requires Mac bridge' }`. Follow-up: rewrite `cortex-gmail-live.mjs` against VM Chrome CDP :9222 (the infrastructure already exists). Not a cutover blocker — Gmail triage is not revenue-path.

### D6 — Voice: **Pocket TTS on VM, already half-deployed**

- `pocket-tts.service` already runs :8890 (healthy) — the generic fallback voice.
- I installed pocket-tts CLI + cortana yaml + voice wav at `~/.cortex/` — **needs one more systemd unit** `pocket-tts-cortana.service` on :8911 with `--config ~/.cortex/pocket-tts-cortana.yaml --default-voice ~/.cortex/cortana_voice.wav` (verified 1.91× realtime).
- Env on VM: `CORTANA_POCKET_URL=http://127.0.0.1:8911`, `POCKET_TTS_URL=http://127.0.0.1:8890`. Leave `CORTANA_TTS_URL` (:8910 F5/RVC), `VOICESTUDIO_URL` (:3900), `KOKORO_TTS_URL` (:8880) **unset** → TTS chain skips them honestly. Broadcast render voices (`cortana_h2|clone|holo`) degrade; conversational `cortana*` voices work via Pocket.
- Optional :8912 emotion instance — defer.

### D7 — agent-reach social_scan: **works on VM as-is**

Verified: `~/.local/bin/agent-reach` v1.6.1, 5/5 default channels. `social_scan` worker shells it — must ensure PATH includes `~/.local/bin` in the systemd unit environment.

### D8 — Code changes required BEFORE VM boot (Phase 2 pre-work)

Mechanical, done on Mac branch first, verified, then rsynced:

1. **Repoint playwright imports** — all 17 `storefront/tools/*.mjs` import from `/Users/Apple/.cursor/mcp-servers/google-flow-browser-mcp/node_modules/playwright-core/index.mjs`. Add `playwright-core` to package.json (match installed version), replace import with bare specifier `'playwright-core'` (Node resolves from node_modules). All tools then `cd` into storefront and `node tools/x.mjs` — resolution works if run with cwd inside repo.
2. **Env-ize hardcoded paths**:
   - `src/lib/cortex-morning-trajectory.ts:47` `workspaceRoot` → `process.env.SYNCSPACE_ROOT || process.cwd()`
   - `src/lib/cortex-native-phone.ts:53` same
   - `src/lib/cortex-tool-synthesis.ts:828` `/Users/Apple/.openclaw/skills` → `process.env.OPENCLAW_SKILLS_DIR || path.join(os.homedir(), '.openclaw/skills')`
   - `src/lib/storefront/build-catalog.ts:135-136` → repo-relative/env paths
   - `vite.config.ts:950` fccEnvPath → gate: only load if file exists (it won't on VM — must not crash)
3. **Gmail honest-degrade** — wrap `cortex-gmail-live.mjs` import in platform check (`process.platform === 'darwin'`) returning the unavailable error on Linux.
4. **CDP preflight already correct** — `browser-shot.mjs` hits `localhost:9222`; on VM that's the local cortex-chrome. No tunnel needed — delete `com.cortex.cdp-tunnel` dependency post-cutover.

---

## 1. TARGET ARCHITECTURE

```
                        ┌─────────────────────────── ORACLE VM (always-on) ───────────────────────────┐
 Discord ──HTTPS──▶ Tailscale Funnel (VM, :443) ──▶ cortex-runtime.service ──▶ vite :5174           │
                        │                              │                                            │
                        │                              ├─ agentRuntime (queues/workers/LLM matrix)    │
                        │                              ├─ /api/cortex/* (46 routes)                  │
                        │                              ├─ storefront/tools/*.mjs ──▶ CDP :9222       │
                        │                              │      ▲                                     │
                        │                              ├─ agent-reach (social_scan)                  │
                        │                              ├─ .cortex-runtime state + vault               │
                        │                              └─ TTS chain: Pocket :8911/:8890, Groq STT     │
                        │                                                                            │
                        │   cortex-chrome.service (Xvfb :99 + Chromium CDP :9222 + x11vnc :5900)     │
                        │   pocket-tts.service :8890 │ pocket-tts-cortana.service :8911 (NEW)        │
                        │   whisper-server.service   │ gev.service (already there)                  │
                        │   cortex-app.service :5173 (STALE — untouched during migration)           │
                        └────────────────────────────────────────────────────────────────────────────┘
                                                        │
                              Mac (post-cutover): visualizer UI, Devin sessions, F5/RVC render (:8910),
                              VoiceStudio (:3900), Kokoro (:8880), Gmail AppleScript, GEZ :5180 — all optional/residual
```

**Mac's residual role after cutover**: dev workstation + optional premium-voice render farm + Gmail bridge (if reworked). Business-critical path has zero Mac dependency.

## 2. FILE MANIFEST

**Rsync Mac → VM** (over `ssh oracle`, exclude-heavy):

```
/Users/Apple/syncscript/  →  /opt/cortex-runtime/
  INCLUDE: src/, scripts/, storefront/, public/, index.html, package.json,
           package-lock.json, vite.config.ts, tsconfig*.json, tailwind.config.ts,
           .env (→ /opt/cortex-runtime/.env chmod 600 separately),
           CORTEX*.md docs, tests/
  EXCLUDE: node_modules/, .git/, archive/, graphify-out/, dist/, .cortex-runtime/
           (seeded separately), storefront/browser/*.png (except latest.png if needed),
           *.backup*, .DS_Store
```

**State seed** (rsync, preserve):
- `/Users/Apple/syncscript/.cortex-runtime/` → `/opt/cortex-runtime/.cortex-runtime/` (or `CORTEX_AGENTS_STATE_DIR` target)
- `/Users/Apple/.cortex/vault` → `/opt/cortex-runtime/vault` → set `OBSIDIAN_VAULT_PATH=/opt/cortex-runtime/vault`
- `~/.cortex/pocket-tts.env` + `pocket-tts-cortana.yaml` + `cortana_voice.wav` — **already on VM** ✅

**Secrets**: `.env` scp → `/opt/cortex-runtime/.env`, `chmod 600`, `chown ubuntu`. VM env additions: `CORTANA_POCKET_URL`, `POCKET_TTS_URL`, `SYNCSPACE_ROOT=/opt/cortex-runtime`, `CORTEX_AGENTS_STATE_DIR=/opt/cortex-runtime/.cortex-runtime`, `PATH` incl `~/.local/bin`.

## 3. CUTOVER SEQUENCE

| Phase | Action | Gate |
|---|---|---|
| 2a | Code changes (D8) on Mac branch, tests pass, commit | `npm test` green |
| 2b | Provision `/opt/cortex-runtime`, rsync source+state+env | dirs exist, .env 600 |
| 2c | `npm ci` on VM (arm64) | exit 0, no native failures |
| 2d | systemd units: `cortex-runtime.service` (:5174), `pocket-tts-cortana.service` (:8911) | both active |
| 2e | Install+join tailscale on VM, `tailscale funnel` → :5174 | public URL live |
| 2f | **Smoke gates** (below) — all must pass | artifacts |
| 3 | **24h parallel soak** — Discord still on Mac funnel; VM runs live, agents work, WARDEN patrols | zero unexplained failures |
| 4 | **Cutover**: update Discord portal URL → VM funnel URL; verify signed PING + `/cortex status`; keep Mac Vite running (visualizer) | Discord live on VM |
| 5 | **Rollback window 7 days**: Mac launchd jobs disabled-not-deleted; rollback = portal URL back to `cortex.tailc088d4.ts.net` + `launchctl load` Mac jobs | rehearsed BEFORE step 4 |
| 6 | Post-soak cleanup: disable Mac `com.syncscript.vite`/`com.cortex.cdp-tunnel`/`com.tailscale.cortex`; decide `/opt/cortex-app` fate (frees 3.1 GB) | CORTEX.md updated |

**Smoke gates (all required, evidence or silence):**
- `curl :5174/api/cortex/discord/state` → `configured:true`
- unsigned POST interactions → `invalid signature`
- `/api/cortex/agents/state` → 12 agents
- scout `social_scan` task → completes via VM agent-reach
- distributor `browser_shot` → SHOT via local :9222 (no tunnel)
- librarian recall + forecaster status + warden patrol → complete
- `/api/cortex/tts` voice=`cortana` → RIFF wav from :8911 Pocket
- Tailscale funnel URL → Discord PING `sig=ok`

## 4. HARD RULES (carried from prompt, sharpened)

- Parallel-run mandatory; Mac instance untouched until soak passes.
- Evidence-or-silence: every gate needs a curl/task-log artifact.
- Secrets: scp only, chmod 600, never git/chat/logs.
- ARM64 first: `npm ci` failure = stop, fix, don't workaround.
- Discord portal URL swap is the ONLY user-visible cutover — rehearse rollback before it.
- Gmail/gev/render-voices degrade loudly-honest, never hang/fabricate.
- Disk: 5.6 GB free — monitor `df -h` through npm ci; abort if <1 GB headroom.
- Update `CORTEX.md` §4.1 + this spec's status header when topology changes.

## 5. RESIDUAL RISKS

| Risk | Likelihood | Mitigation |
|---|---|---|
| `npm ci` native failure on arm64 | low-medium | gate 2c; puppeteer may need `PUPPETEER_SKIP_DOWNLOAD`+executable path |
| Disk exhaustion mid-install | medium | monitor; fallback = retire `/opt/cortex-app` (3.1 GB) early |
| pocket-tts :8911 stability under load | low | systemd Restart=always; Kokoro/ Pocket :8890 fallback chain intact |
| Tailscale Funnel on VM auth | low | auth key or interactive login once; document node name |
| Gmail/calendar degrade surprises user | low | announced in cutover notes; rework is follow-up |
| Two vite instances write-conflict on shared state | none | separate disks — Mac and VM states diverge post-cutover by design; Mac state frozen at cutover snapshot |

## 6. DEFINITION OF DONE

- [ ] D8 code changes merged, tests green
- [ ] `/opt/cortex-runtime` provisioned, `npm ci` clean on arm64
- [ ] All systemd units active: cortex-runtime, pocket-tts-cortana (+existing)
- [ ] Tailscale funnel live on VM
- [ ] All smoke gates pass with artifacts
- [ ] 24h soak clean
- [ ] Discord portal → VM URL; verified live
- [ ] Rollback rehearsed and documented
- [ ] Mac jobs disabled (7-day window), CORTEX.md §4.1 updated
