# CORTEX VISUALIZER + SYSTEM VERIFICATION CHECKLIST

> Manual audit prompt — verify every visible surface and data source on **both** hosts:
> - **Mac (authoritative):** `http://localhost:5173` / `https://cortex.tailc088d4.ts.net`
> - **Oracle (parallel-run):** `http://localhost:5174` on VM / `https://cortex-oracle.tailc088d4.ts.net`
>
> Rule: **evidence or silence.** Every box needs a curl output, screenshot, or task-log artifact — "looks right" doesn't count.

---

## KNOWN ISSUE FOUND DURING THIS AUDIT (2026-11-16)

**Core scene drops spawned agents — satellite count bug.**

`src/components/cortex/CortexCoreScene.tsx:565` — `const SAT_COUNT = 10` and line 770 `.slice(0, SAT_COUNT)`. The fleet has **12 agents**; sort order puts the 8 named agents first (`SAT_AGENT_ORDER`, line 569 — note `prep` and `forecaster` are NOT in it), then alphabetical: `forecaster`, `prep`, `spawn-ledger-7-1`, `spawn-pulse-2`. Slice(0,10) keeps forecaster+prep and **drops both spawn agents entirely** — they never render on the core page.

- Expected satellites (enterprise tier OR `spawnSpec` present — `CortexCoreScene.tsx:586`): **3** → `distributor` (tier:enterprise) + `spawn-ledger-7-1` + `spawn-pulse-2` (spawnSpec present)
- Actual rendered: **1** (distributor only)
- WARDEN is standard tier and IS in `SAT_AGENT_ORDER` — it should appear as an inner moon. If it's missing too, that's a second bug (check `agentsClient` SSE feed).

**Fix direction:** raise `SAT_COUNT` to ≥12 (or remove the cap and let slots = agent count), and add `prep`/`forecaster` to `SAT_AGENT_ORDER` + `SAT_AGENT_COLORS` so all 10 built-ins get role colors instead of falling back to grey `#94a3b8`.

---

## 1. AGENT FLEET — expected state (identical on both hosts post-seed)

| Agent | Tier | spawnSpec | Orbit class | Status |
|---|---|---|---|---|
| sentinel | standard | — | moon (inner) | idle |
| scout | standard | — | moon | idle |
| librarian | standard | — | moon | idle |
| builder | standard | — | moon | idle |
| reviewer | standard | — | moon | idle |
| runner | standard | — | moon | idle |
| distributor | **enterprise** | — | **satellite** | idle |
| prep | standard | — | moon | idle |
| forecaster | standard | — | moon | idle |
| warden | standard | — | moon | idle |
| spawn-ledger-7-1 (LEDGER-7) | standard* | ✅ TTL 72h | **satellite** (outer orbit ×1.38) | idle |
| spawn-pulse-2 (PULSE) | standard* | ✅ TTL 168h | **satellite** (outer orbit ×1.38) | idle |

*spawn agents store tier:null but render enterprise via `!!a.spawnSpec`.

**Verify:** `curl -s localhost:PORT/api/cortex/agents/state | python3 -c "import json,sys; [print(a['id'],a.get('tier'),bool(a.get('spawnSpec'))) for a in json.load(sys.stdin)['agents']]"` — expect 12 rows, 3 with satellite class.

## 2. VISUAL SURFACES — what should be visible

### Cortex Core page (`faceMode='core'` → `CortexCoreScene`)
- [ ] Saturn core with gyroscopic orbit rings + flowing energy shaders
- [ ] **10 moon slots** — first 10 sorted agents as role-colored motes (BUG: currently capped, see above)
- [ ] **3 enterprise satellite hulls** — real 3D spacecraft geometry on outer deck (BUG: only 1 renders)
- [ ] Spawn agents on **wider outer orbit** (radius ×1.38, `CortexCoreScene.tsx:808`)
- [ ] Working agents pulse; idle dim; error red; retired ghosted
- [ ] Agent inspect card rides orbit anchor (`agentScreenAnchors`)
- [ ] WARDEN visible as moon (indigo `#818cf8`)

### Nexus Foundry (`faceMode='agents'` → `CortexAgentsScene`)
- [ ] All **12 agents** listed — this is where user sees full fleet ✅ (already confirmed working)
- [ ] Enterprise deck ring (gold) vs standard moon orbit — distinct visuals
- [ ] Per-agent stats: tasksCompleted/tasksFailed/TSR/dailyBudget/modelPin/class
- [ ] matrix.changed / task.transition events stream live via SSE

### Viz faces (`/api/cortex/viz/config` + `/viz/state`)
- [ ] `face: 'board'` + faces list non-empty (`public/viz/faces/*/index.html` + `face.json`)
- [ ] state maps idle/listening/thinking/speaking/working; 64-sample waveform when speaking

### Other surfaces
- [ ] Globe/GEV embed (`/api/cortex/gev-url`) — Mac-only sibling :5180; on VM expect honest degrade
- [ ] Browser shot (`/api/cortex/browser-shot.png`) — VM: local CDP ✅ verified; Mac: via tunnel
- [ ] Distribution status queue counts match `storefront/distribution-queue.json`

## 3. DATA ENDPOINTS — curl checklist (run on BOTH hosts)

| Endpoint | Expected | Mac :5173 | VM :5174 |
|---|---|---|---|
| `/api/cortex/discord/state` | `configured:true` | ☐ | ☐ verified |
| `/api/cortex/agents/state` | 12 agents, 3 spawnSpec | ☐ | ☐ verified |
| `/api/cortex/agents/stream` | SSE live (agentsClient) | ☐ | ☐ |
| `/api/cortex/bus/state` | bus JSON from `.cortex/bus/state.json` | ☐ | ☐ |
| `/api/cortex/viz/state` | `{state, level, samples[64]}` | ☐ | ☐ |
| `/api/cortex/viz/config` | faces[] non-empty | ☐ | ☐ |
| `/api/cortex/models/health` | matrix lanes status | ☐ | ☐ |
| `/api/cortex/distribution/status` | queue counts | ☐ | ☐ |
| `/api/cortex/vault/graph` | vault nodes/edges | ☐ | ☐ |
| `/api/cortex/forecast/*` + forecaster-state | forecasts.jsonl present | ☐ | ☐ |
| `/api/cortex/calendar/upcoming` | events or honest empty | ☐ | ☐ verify mechanism |
| `/api/cortex/geo/watch` | NWS zones active | ☐ | ☐ |
| `/api/cortex/gmail/*` | Mac: works / VM: 503 honest | ☐ | ☐ verified 503 path exists |
| `/api/cortex/tts` voice=cortana | RIFF wav | ☐ Mac :8911 | ☐ VM :8911 verified |
| `/api/cortex/stt` | Groq whisper primary | ☐ | ☐ |
| `/api/cortex/mobile/pairing` | pairing state | ☐ | ☐ |
| `/api/cortex/lights/sync` | Govee (POST only) | ☐ | ☐ |
| `/api/cortex/proactive/audit` | initiative audit | ☐ | ☐ |
| `/api/cortex/vigilance/status` | warden patrol health | ☐ | ☐ |
| `/api/cortex/trust/policy` | trust policy | ☐ | ☐ |
| `/api/cortex/chat-history` | chat log | ☐ | ☐ |
| `/api/cortex/ambient/*` | ambient context | ☐ | ☐ |

## 4. STATE FILES — must exist and be non-empty on each host

| Path (relative to runtime root) | Expected |
|---|---|
| `.cortex-runtime/agents-state.json` | 12 agents, recentTaskIds populated |
| `.cortex-runtime/forecaster-state.json` + `forecasts.jsonl` | forecast history |
| `.cortex-runtime/discord-threads.json` | active ask threads |
| `.cortex-runtime/discord-push.json` | push budget/day counter |
| `.cortex-runtime/model-registry.json` | model matrix lanes |
| `.cortex-runtime/calendar-upcoming.json` `watch-zones.json` | schedules |
| `.cortex/bus/state.json` | viz bus state (repo-relative!) |
| `storefront/distribution-queue.json` | pending/done counts |
| `public/viz/faces/*/face.json` | viz face metadata |
| vault (`OBSIDIAN_VAULT_PATH`) | ~19 MB markdown |

**VM check:** `ssh oracle 'ls -la /opt/cortex-runtime/.cortex-runtime/ /opt/cortex-runtime/.cortex/bus/ /opt/cortex-runtime/storefront/distribution-queue.json'`

## 5. AUTONOMOUS LOOPS — verify they're actually firing (not just registered)

- [ ] WARDEN patrols completing (check `recentTasks` for warden entries with fresh timestamps — on VM already saw 4 patrols post-boot ✅)
- [ ] FORECASTER probes reporting (forecast_status task → all 5 probes)
- [ ] SENTINEL catalog scans on interval
| Routines firing per schedule (check `.cortex-runtime` task createdAt times vs routine cron)
- [ ] DISTRIBUTOR queue draining (pending count decreasing over time)
- [ ] Proactive initiative budget (5/day) not exhausted silently

## 6. PARITY CHECK — Mac vs VM diff

Run the same curls on both, diff outputs. Expected differences (by design):
- `host` identity if exposed; uptime; task IDs/timestamps (separate state post-seed)
- gmail: Mac works, VM 503
- gev-url: Mac resolves, VM degrade
- TTS voice chain: both should return RIFF (different backends OK — Mac :8911 pocket, VM :8911 pocket)

**Everything else should be identical.** Any other diff = investigate.

## 7. SIGNATURE VERIFICATION

- [ ] Unsigned POST `/api/cortex/discord/interactions` → `{"ok":false,"error":"invalid signature"}` on BOTH hosts
- [ ] Signed Discord PING through each funnel URL → `sig=ok` in logs

---

## KNOWN-ISSUE FIX LIST (from this audit)

1. **`CortexCoreScene.tsx:565,770`** — `SAT_COUNT=10` slices off spawn agents → raise cap / dynamic count; add `prep`,`forecaster` to `SAT_AGENT_ORDER`+`SAT_AGENT_COLORS`.
2. Spawn agents persist `tier:null` — cosmetic; render path already handles via `spawnSpec`, but consider backfilling `tier:'enterprise'` in `agents-state.json` for API cleanliness.
3. TTL watch: LEDGER-7 ttl 72h from `spawnedAt:1794688835570` — retires ~2026-11-19; PULSE 168h ~2026-11-23. Verify retirement path works (ghosted, not vanished) when they expire.
