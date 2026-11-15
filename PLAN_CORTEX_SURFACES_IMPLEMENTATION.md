# Cortex Generative Surfaces — Implementation Plan

> Implements `PLAN_CORTEX_GENERATIVE_SURFACES.md` (the spec — read it first).
> Phases 1–3 in one plan; each phase ends in a demoable, verified state.

**Goal:** Agent-emitted typed artifacts render as HUD instrument cards in the
transcript (chat + visualizer drawer), expand into surfaces, and Phase 2–3 add
a dockable multi-panel workspace with voice control and live data.

**Architecture:** JSON-schema artifacts (`CortexArtifact`) ride on
`ChatMessage.meta.artifacts`; one `ArtifactRenderer` registry renders them in
both surfaces; `emit_artifact`/`generate_image` tools feed them; a
`CortexSurfaceLayer` hosts panels on the visualizer; `live` artifacts subscribe
to the telemetry bus.

**Tech:** React + TS, recharts (installed), motion (installed), lucide icons,
existing `/api/cortex/tools/execute` plumbing, Pollinations default image gen.

## Global Constraints

- Max 3 artifacts per message, 6 visible panels — enforced in
  `cortex-artifacts.ts` constants `MAX_ARTIFACTS_PER_MESSAGE`,
  `MAX_VISIBLE_PANELS`.
- Every artifact: `id` (crypto.randomUUID), `createdAt` (Date.now()),
  `source` (tool name), optional `live`.
- Malformed artifact JSON → dropped by validator, tool still returns ok with
  `accepted`/`rejected` counts; never crashes render.
- Image gen: `generate_image` uses Pollinations
  (`https://image.pollinations.ai/prompt/{enc}?width=W&height=H&nologo=true&seed=S`)
  unless `FAL_KEY` or `REPLICATE_API_KEY` env exists (then use that provider —
  implement Pollinations only in P1; paid providers are a follow-up stub that
  returns `provider_unavailable` honestly).
- No new npm dependencies.
- Artifact renderer is `React.lazy` — keep initial bundle flat.
- English only; HUD design tokens from `cortex-demo-helpers` (`C` palette).

## Review Focus

- Voice path: `execTool` in `useVisualizerVoice.ts` currently returns only a
  string — artifacts would be silently dropped. Task 5 must return
  `{ text, artifacts }` and lift them onto the AI message.
- Chat path: `cortex-tool-loop.ts` records `toolExecution` meta — artifacts
  must merge there too or chat-page cards never appear.
- `parseToolCalls` regex must not break on artifact JSON containing ``` or
  nested braces — validator runs server-side anyway; client just forwards.
- Image latency: card must show generating state then resolve — never a
  blank box.
- Panel cap: 7th panel request is refused with spoken/UI notice, not queued.

---

### Task 1: Artifact schema + validator

**Files:**
- Create: `src/lib/cortex-artifacts.ts`
- Test: `src/lib/__tests__/cortex-artifacts.test.ts`

**Interfaces:**
- Produces:
  - `type CortexArtifact` (union per spec: stat|chart|table|image|document|map|feed)
  - `interface CortexArtifactBase { id: string; createdAt: number; source: string; live?: boolean }`
  - `validateArtifacts(input: unknown, source: string): { accepted: CortexArtifact[]; rejected: number }`
  - `MAX_ARTIFACTS_PER_MESSAGE = 3`, `MAX_VISIBLE_PANELS = 6`
  - `artifactTitle(a: CortexArtifact): string`

- [ ] Write failing test: valid stat/chart/table/image/document/map/feed pass; wrong kind, missing required fields, >3 items truncated+counted rejected, non-object dropped.
- [ ] Run: `npx vitest run src/lib/__tests__/cortex-artifacts.test.ts` → FAIL
- [ ] Implement schema types + `validateArtifacts` (per-kind required-field checks, sanitize strings to ≤2000 chars, assign id/createdAt/source, cap at MAX_ARTIFACTS_PER_MESSAGE counting overflow as rejected).
- [ ] Run test → PASS

### Task 2: Server tools `emit_artifact` + `generate_image`

**Files:**
- Modify: `vite.config.ts` — CORTEX_TOOLS array (~line 71+, append two entries); execution dispatch inside `cortexToolsHandler` (pattern: `if (tool === 'name') { ... return res.end(JSON.stringify({...})) }`, see `web_search` ~line 3084 and `get_canvas_artifact` ~line 5807)

**Interfaces:**
- Consumes: `validateArtifacts` is client-side; server does lightweight shape check (kind string + object) and echoes `artifacts` back in result JSON.
- Produces tool result shapes:
  - `emit_artifact` → `{ ok:true, tool:'emit_artifact', accepted:N, rejected:N, artifacts:[...] }`
  - `generate_image` args `{prompt, aspect?:'16:9'|'1:1'|'4:3'}` → `{ ok:true, tool:'generate_image', artifact:{kind:'image', title, url, prompt, provider:'pollinations', aspect} }`

- [ ] Add `emit_artifact` to CORTEX_TOOLS (function def: `artifacts` array of objects, description telling model the schema kinds).
- [ ] Add `generate_image` to CORTEX_TOOLS (`prompt` required, `aspect` enum).
- [ ] Implement dispatch: `emit_artifact` validates args.artifacts is array, caps 3, returns them; `generate_image` builds Pollinations URL (aspect→width/height: 16:9=1280x720, 1:1=1024x1024, 4:3=1152x864), HEAD-checks reachability with 8s timeout, returns image artifact or `{ok:false, error}`.
- [ ] Verify: `curl -X POST localhost:PORT/api/cortex/tools/execute -d '{"tool":"emit_artifact","args":{"artifacts":[{"kind":"stat","title":"CPU","value":"42%"}]}}'` → ok:true, artifacts echoed. Same for generate_image → returns pollinations URL.

### Task 3: Artifact card components

**Files:**
- Create: `src/components/cortex/artifacts/ArtifactRenderer.tsx`
- Create: `src/components/cortex/artifacts/cards/StatCard.tsx`, `ChartCard.tsx`, `TableCard.tsx`, `ImageCard.tsx`, `DocumentCard.tsx`, `MapCard.tsx`, `FeedCard.tsx`
- Create: `src/components/cortex/artifacts/cortex-artifact.css.ts` (or inline styles matching drawer CSS-in-JS convention — check `CortexChatDrawer.tsx` DRAWER_CSS pattern; prefer a shared `ARTIFACT_CSS` string + inline styles, consistent with codebase)

**Interfaces:**
- Consumes: `CortexArtifact` types from Task 1; `C` palette from `cortex-demo-helpers`.
- Produces: `export function ArtifactRenderer({ artifact, onExpand }: { artifact: CortexArtifact; onExpand?: (a: CortexArtifact) => void })` — switches on `kind`, wraps each card in shared chrome: corner ticks, 9px mono uppercase title, source+timestamp footer, spring entrance via `motion` (`initial={{opacity:0, scale:0.98}} animate={{opacity:1, scale:1}} transition={{duration:0.2}}`), `live` → pulsing dot.

- [ ] Implement shared `ArtifactShell` + all 7 cards. Chart uses recharts (`LineChart`/`BarChart`/`AreaChart`/`PieChart` minimal config, C.cyan/C.violet series colors). Image card: `<img>` with loading skeleton + error fallback card. Map card: summary text + "View on globe" button dispatching `cortex-viz-turn` event `{type:'globe-view', view}` (reuse existing event bus pattern from `CortexVisualizerPage`).
- [ ] Verify: `npx tsc --noEmit` clean on new files.

### Task 4: Render artifacts in both transcript surfaces

**Files:**
- Modify: `src/components/cortex/cortex-demo-helpers.tsx` (~line 855 `ChatMessage` — add `artifacts?: CortexArtifact[]` to `meta`)
- Modify: `src/components/cortex/CortexMessageList.tsx` — render `<ArtifactRenderer>` list under AI message content when `msg.meta?.artifacts?.length`
- Modify: `src/components/cortex/CortexChatDrawer.tsx` — same under AI bubble (~line 105-111)

**Interfaces:**
- Consumes: `ArtifactRenderer` (lazy: `const ArtifactRenderer = lazy(() => import('./artifacts/ArtifactRenderer'))` + `<Suspense>`)
- Produces: cards visible in both surfaces from `msg.meta.artifacts`

- [ ] Add type + render blocks (max 3, horizontal scroll row on narrow drawer, grid in message list).
- [ ] Verify: seed a message with artifacts via devtools/`setCortexChatMessages` in puppeteer → cards visible in drawer and `/cortex/chat`.

### Task 5: Lift artifacts through both tool paths

**Files:**
- Modify: `src/components/cortex/useVisualizerVoice.ts` — `execTool` (~line 164) return type → `{ text: string; artifacts?: CortexArtifact[] }`; extract `data.result.artifacts`/`data.artifacts` before stringifying; tool loop (~line 405-415) collects artifacts and attaches to the AI message via `upsertCortexChatMessage`/`appendCortexChatMessage` meta.
- Modify: `src/components/cortex/cortex-tool-loop.ts` — where `toolExecution` meta is set (~lines 373, 403), merge `artifacts` from tool result into the same meta.
- Modify: `src/components/cortex/useVisualizerVoice.ts` VOICE_SYSTEM_PROMPT — add `emit_artifact` + `generate_image` to the tools list with one-line schema hint each.

**Interfaces:**
- Consumes: tool result JSON from Task 2; `validateArtifacts` client-side before attaching.
- Produces: `ChatMessage.meta.artifacts` populated on both paths.

- [ ] Update execTool signature + all call sites; accumulate `collectedArtifacts` in the hop loop; attach to final AI message meta.
- [ ] Update cortex-tool-loop toolExecution meta merge.
- [ ] Update voice prompt tool list.
- [ ] Verify live (puppeteer, visible browser): dispatch `cortex-viz-turn` "show me a chart of my CPU usage" won't have data — instead "generate an image of a neon cortex core" → image card appears in drawer; "make a table comparing …" via emit_artifact.

### Task 6: Expand-to-surface (canvas accepts artifacts)

**Files:**
- Modify: `src/components/cortex/CortexDemo.tsx` — canvas tab type `CanvasTab` (~line 269) add `'artifact'`; state `activeArtifact`; `ArtifactRenderer` expanded mode (larger chart, full image, doc rendered markdown).
- Modify: `src/components/cortex/artifacts/ArtifactRenderer.tsx` — `onExpand` opens artifact surface.

**Interfaces:**
- Consumes: `ArtifactRenderer`, `CanvasTab` mechanics, `previewVisible`/`setPreviewVisible`.
- Produces: clicking a card opens it in the canvas panel as an `artifact` tab.

- [ ] Add tab + render branch; wire `onExpand` from message list/drawer → needs cross-component event: dispatch `window.dispatchEvent(new CustomEvent('cortex-open-artifact', {detail: artifact}))`; CortexDemo listens and opens canvas.
- [ ] Verify: click card in `/cortex/chat` → canvas opens with artifact; same from drawer.

### Task 7: Phase 2 — Surface layer on visualizer

**Files:**
- Create: `src/lib/cortex-surfaces.ts` — panel store (module-level, like chat store): `SurfacePanel { id, kind: 'artifact'|'globe'|'cctv'|'telemetry'|'doc', title, payload?, slot, pinned }`, `openPanel/closePanel/pinPanel/focusMode`, caps at MAX_VISIBLE_PANELS.
- Create: `src/components/cortex/CortexSurfaceLayer.tsx` — absolute-positioned panel host over visualizer; preset slots: left rail (320px), right rail (320px), bottom strip (180px); panel chrome = ArtifactShell styling; close/pin/expand buttons.
- Modify: `src/components/cortex/CortexVisualizerPage.tsx` — mount `<CortexSurfaceLayer/>`; listen for `cortex-open-artifact` → opens artifact panel.
- Modify: `src/components/cortex/useVisualizerVoice.ts` — voice grammar: "pin this/that", "open panels", "close panels", "focus mode", "show panels" → call surface store; confirm spoken.

**Interfaces:**
- Consumes: `CortexArtifact`, ArtifactRenderer, surface store.
- Produces: dockable panels; artifact cards' expand opens a panel (not just canvas) when on visualizer.

- [ ] Implement store + layer + slot layout + panel chrome + voice commands.
- [ ] Verify: puppeteer — trigger artifact via tool, "pin that" → panel persists; "close panels" → all close; 7th panel refused.

### Task 8: Globe + CCTV as panel types

**Files:**
- Modify: `src/lib/cortex-surfaces.ts` — kinds 'globe'|'cctv'
- Modify: `src/components/cortex/CortexSurfaceLayer.tsx` — globe panel embeds second GEV iframe? NO — single GEV instance constraint: globe panel = picture-in-picture is not feasible cheaply. Instead: 'globe' panel kind shows a **snapshot card** (static map image via GEV static API or last-view summary) and 'cctv' panel embeds the active camera's stream URL if GEV exposes one via `gev:cctv` reply (check embed.js cctv-applied payload for stream URL; if none, CCTV panel shows camera metadata card + "focus" button that recenters main globe). Decide at implementation; document choice in code comment.
- Modify: `src/components/cortex/useVisualizerVoice.ts` — "open the map in a panel" → surface panel with map summary + button to expand globe main view.

- [ ] Implement pragmatic versions; verify each renders real data, no fake feeds.

### Task 9: Phase 3 — Live artifacts + Obsidian provenance

**Files:**
- Modify: `src/lib/cortex-artifacts.ts` — `live` artifact refresh contract: `LiveArtifactSource` registry mapping source→subscribe fn.
- Create: `src/components/cortex/artifacts/useLiveArtifact.ts` — subscribes to `/api/cortex/bus/state` SSE/poll for telemetry-tagged artifacts; updates `points`/`value` in place (throttled 1/s).
- Modify: `ArtifactRenderer` — live artifacts use hook; stale (>30s no update) → dimmed + "STALE" tag.
- Modify: `src/components/cortex/useVisualizerVoice.ts` — "save this to memory" / "remember this chart" → `cortex_memory` append with artifact title+summary+timestamp.
- Modify: `vite.config.ts` — `emit_artifact` accepts `live:true` + `source:'telemetry'` passthrough (already generic).

- [ ] Implement live subscription for `source:'telemetry'` artifacts (chart/stat kinds only); staleness UI.
- [ ] Wire memory-save voice command → cortex_memory.
- [ ] Verify: emit live stat artifact → value updates from bus; "save this to memory" → note appears (check via cortex_memory read_hot).

### Task 10: Full verification + deploy

- [ ] `npx tsc --noEmit` clean
- [ ] `npm run build` succeeds
- [ ] Puppeteer visible-browser suite: emit_artifact (chat+voice), generate_image, expand-to-canvas, pin/close/focus panels, live artifact update, memory save
- [ ] Screenshot review of card + panel aesthetics (the "beautiful" gate)
- [ ] rsync changed files to Oracle `/opt/cortex-app`, restart `cortex-app`, verify active + parity md5
- [ ] Update `MEMORY.md` + this plan's status
