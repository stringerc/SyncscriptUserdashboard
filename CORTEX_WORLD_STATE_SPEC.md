# Cortex World-State & Ambient Ingestion Spec

Status: SPEC — not yet implemented.
Origin: Antigravity proposal, fact-checked against the codebase on 2026-11-16.

## 1. What already exists (do not rebuild)

| Capability | Where | Cadence |
|---|---|---|
| Frontmost app + window title (macOS JXA/AppleScript) | `scripts/cortex-proactive-service.mjs` (~line 219), `/api/cortex/ambient/context` in `vite.config.ts` (~line 1913) | proactive poll + 2s endpoint cache; UI polls 4s |
| Somatic vitals (CPU/GPU/battery/network) | `ambientVitals()` | ~10min ambient notice loop |
| Ambient notice queue → optional spoken heads-up | `vite.config.ts` ~line 1431 | ~10min |
| Continuous fleet routines | WARDEN ~10min, SENTINEL, FORECASTER, DISTRIBUTOR | scheduled/queued |

What does NOT exist:
- A persistent world-state store (state is scattered `.cortex-runtime/*.json`)
- FSEvents / filesystem-change watching of the repo
- Focused editor line / active document tracking
- Pre-turn `[WORLD-STATE]` injection into LLM prompts (the ambient endpoint feeds the *UI*, not the model)
- Fleet topology awareness (Mac vs Oracle runtime, which is authoritative)
- Any `cortex-fep` / Active Inference engine — confirmed absent; see §6

## 2. Goal

When the user talks to Cortex, the model already knows — without tool calls —
what app/window/file is frontmost, repo state (branch/dirty/tests), host
vitals, and fleet health. And when invariants break, the proactive queue can
speak up. "Turn-gated blindness" ends; "omniscience" remains an aspiration we
earn sensor-by-sensor (Evidence or Silence applies to awareness too).

## 3. Architecture

```
┌─ SENSORS (existing + new) ─────────────────────────────┐
│ frontmost app/window   JXA probe (exists)              │
│ somatic vitals         ambientVitals (exists)          │
│ git state              spawnSync git status (new, cheap)│
│ last test result       read vitest/jest cache or run   │
│                        hook (new)                      │
│ fleet heartbeats       Mac + Oracle .cortex-runtime    │
│                        state mtimes/health endpoints   │
│                        (new)                           │
│ focused file/line      AXSelectedText / editor probe   │
│                        (P2 — needs Accessibility perm) │
└──────────────┬────────────────────────────────────────┘
               ▼ every ~15s (configurable)
┌─ WORLD STATE WRITER ───────────────────────────────────┐
│ scripts/cortex-world-state.mjs → writes                │
│ .cortex-runtime/world-state.json (atomic tmp+rename)   │
│ Each field carries {value, observedAt, source, stale}. │
└──────────────┬────────────────────────────────────────┘
               ▼ read at prompt-assembly time
┌─ INJECTION ────────────────────────────────────────────┐
│ server-side: serialize ≤80-token header into the       │
│ system/context message of voice + agent chat turns.    │
│ NEVER into Discord/iMessage external surfaces unless    │
│ the channel is private to the user.                    │
└────────────────────────────────────────────────────────┘
```

### 3.1 Sensor cadence and cost budget

- Single daemon loop, not N processes. Target <1% CPU, <50MB RSS.
- Poll sensors on staggered intervals: frontmost app 5s, git 30s,
  vitals 60s, fleet heartbeat 60s, tests on-change only.
- Every field stamped `observedAt`; consumers MUST treat fields older
  than 3× their interval as `stale: true` and the injector drops or
  marks them ("git: stale") — no silent freshness lies.

### 3.2 World-state schema (v1)

```ts
interface WorldState {
  ts: string;                    // writer clock
  user: {
    activeApp?: string;          // "Cursor"
    frontmostWindow?: string;    // "CortexCoreScene.tsx — syncscript"
    focusedFile?: string;        // P2
    cursorLine?: number;         // P2
  };
  host: {
    cpuPct?: number; memPct?: number;
    batteryPct?: number; charging?: boolean;
    thermalThrottled?: boolean;
  };
  codebase: {
    repo: string;                // "syncscript"
    branch?: string;
    dirtyFiles?: number;         // count, not list (list = P2)
    lastTest?: { status: 'pass'|'fail'|'unknown'; at?: string; failing?: string[] };
  };
  fleet: {
    macRuntime: { alive: boolean; lastSeen?: string };
    oracleRuntime: { alive: boolean; lastSeen?: string; utc?: boolean };
    activeAgentTasks?: number;
    splitBrainRisk?: boolean;    // both runtimes writing same state dir
  };
}
```

Each leaf may carry `{v, at, src}`; v1 may use flat fields + a parallel
`meta` map if simpler — but freshness MUST be representable.

### 3.3 Injection contract

- Function `buildWorldStateHeader(state): string | null` → pure,
  unit-testable. Returns e.g.
  `[WORLD-STATE 07:05 EDT | App: Cursor — CortexCoreScene.tsx | git: main, 3 dirty | tests: pass 12m ago | oracle: alive | battery: 91%]`
- Hard cap ~80 tokens; drop lowest-priority fields first
  (priority: activeApp/window > fleet health > git > tests > vitals).
- Injected ONLY into private user-facing turns (voice session, chat).
  NOT into Discord channel replies, agent-to-agent calls, or briefs —
  external surfaces get summaries, not telemetry.
- If world-state.json missing/stale >60s → inject nothing (silence >
  stale awareness).

### 3.4 Proactive engine hook (P2)

World-state diffing feeds the existing ambient notice queue: e.g.
branch switch + dirty files during a build, oracle heartbeat lost,
test transition pass→fail. Reuse the 10-min loop; do NOT add a second
proactive path.

## 4. Build order

- **P0 — writer + schema + header builder + unit tests** (pure TS, no
  permissions needed). Daemon as launchd `com.cortex.world-state` every
  15s via `StartInterval`, or a `setInterval` inside the vite plugin —
  prefer launchd so it survives vite restarts.
- **P1 — injection into voice/chat turn path** + freshness gating.
  Verify by asking Cortex "what am I looking at?" with a known window
  frontmost.
- **P2 — focused file/line (Accessibility), FSEvents repo watcher,
  test-status hook, proactive diffs.** Each gated on its own permission
  or infra; ship independently.

## 5. Explicit non-goals (v1)

- NO ScreenCaptureKit / screen OCR — window titles only. Screen content
  is a privacy and complexity cliff; revisit only if titles prove
  insufficient.
- NO microphone/audio presence sensing.
- NO Active Inference / POMDP engine — see §6.
- NO injection into external channels.
- NO claim of "omniscience" in docs or prompts — the header lists only
  fields with fresh `observedAt`.

## 6. On the Active Inference proposal (fact-checked)

The FEP math in the proposal is broadly correct ($F$ decomposition,
expected free energy). But "mathematically forbids mutation until
uncertainty drops" is FALSE — softmax over $-\gamma G$ is a preference,
not a constraint. Cortex already HAS hard gates (blast-radius lanes,
budgets, proposal approvals) that do what he claims FEP would do.

Decision: do NOT build `cortex-fep` now. If agent triage ever needs a
scoring layer for observe-vs-mutate, revisit with real transition data.
The deterministic gates are stronger and already tested.

## 7. Verification

- Unit tests: `buildWorldStateHeader` field priority, token cap,
  stale-drop behavior, missing-file → null.
- Live: frontmost app changes → world-state.json updates ≤15s;
  voice turn prompt contains header; kill daemon → header absent
  (not stale).
- Fleet: stop Oracle service → `fleet.oracleRuntime.alive=false`
  within 2 intervals; header reflects it.

## 8. Risks

- JXA probe requires Accessibility permission for the host process —
  already granted for proactive service; world-state reuses the same
  mechanism, no new prompt expected.
- launchd on Mac only — Oracle runtime gets its own minimal writer
  (host vitals + service health) or reports via heartbeat file; do not
  run macOS sensors on Oracle.
- Prompt injection surface: window titles are user-controlled text.
  Sanitize to ≤120 chars, strip newlines/control chars before header.
