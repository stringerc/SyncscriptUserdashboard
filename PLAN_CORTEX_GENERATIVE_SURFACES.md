# Cortex Generative Surfaces — Design & Plan

Date: 2026-11-11
Status: proposed — awaiting approval before implementation

## Intent

Cortex should not only *say* things — it should *show* things. The agent
generates typed visual artifacts (charts, images, tables, documents, map
cards, live telemetry) that render inline in the transcript and expand into
dockable surfaces. The destination is a multi-window ambient workspace —
the "Carter feel" — achieved with web-native React inside our existing
design system, not Unity.

Why now: the visualizer transcript is text-only; the chat page canvas is a
web-builder preview, not an agent-addressable artifact system. All
primitives exist (tool loop, shared chat store, canvas, recharts, motion,
GEV bridge). This is composition, not invention.

## Goals

- Agent emits structured artifacts via a first-class `emit_artifact` tool;
  they persist in the shared transcript (`ChatMessage.meta.artifacts`) and
  hydrate with chat history.
- Rich inline cards render in BOTH `/cortex/chat` and the visualizer chat
  drawer from one registry — one component, two surfaces.
- Clicking an artifact opens an expanded surface (evolves the Live Preview
  Canvas into a typed artifact viewer).
- Visualizer gains a dockable surface layer (Phase 2): panels the agent or
  user can open, arrange, pin, and close — including the globe as a panel.
- Voice commands manage surfaces: "pin that graph", "open the chart beside
  the map", "close the panels", "focus mode".
- Every artifact carries provenance: source tool, timestamp, freshness.

## Non-goals

- No freeform HTML/JS artifact generation (XSS, unbounded surface).
- No uncontrolled window spawning — caps enforced; user can always dismiss.
- No Unity/WebXR now (immersive-web-sdk noted as future direction only).
- No realtime collaborative editing.

## Anti-goals (failure modes)

- Artifact spam: cap 3 artifacts/message, 6 visible panels.
- Generic SaaS-card look — must feel like Cortex instrumentation: HUD
  borders, mono labels, state colors, spring motion.
- Silent fake data — charts/tables render only real tool output; images
  mark provider + prompt.

## Constraints

- Sovereign/self-hosted first: zero-config image default (Pollinations),
  optional `FAL_KEY`/`REPLICATE_API_KEY` upgrade — provider-agnostic
  `generate_image` tool.
- Works identically through voice (`cortex-viz-turn`) and text paths.
- recharts + motion already installed — no new heavy Phase-1 deps.
- Oracle deployment parity (Vite dev/preview + static build).

## Approaches considered

- **A. Inline cards only** — lowest risk, caps the workspace ambition.
  Kept as the Phase-1 rendering layer, rejected as the destination.
- **B. Window manager first** — biggest wow, highest risk before any
  artifact types exist. Becomes Phase 2.
- **C. Staged hybrid (chosen)** — artifact registry + cards first (proves
  schema + design language), surface layer consumes the same registry in
  Phase 2. Every phase ships a real demoable feature.

## Architecture

### Artifact schema (`src/lib/cortex-artifacts.ts`)

```ts
type CortexArtifact =
  | { kind: 'stat';      title; value; unit?; delta?; spark?: number[] }
  | { kind: 'chart';     title; chartType: 'line'|'bar'|'area'|'pie';
                         series: { name; points: {x,y}[] }[]; xLabel?; yLabel? }
  | { kind: 'table';     title; columns: string[]; rows: (string|number)[][] }
  | { kind: 'image';     title; url; prompt?; provider?; aspect?: '16:9'|'1:1'|'4:3' }
  | { kind: 'document';  title; format: 'markdown'|'code'; content; lang? }
  | { kind: 'map';       title; view: GlobeView; summary?: string }
  | { kind: 'feed';      title; items: { label; value; tone? }[] };
```

Each artifact: `id`, `createdAt`, `source` (tool), optional `live: true`.

### Emission paths

1. `emit_artifact` tool — `/api/cortex/tools` registry + tool-loop
   allowlist; args `{ artifacts: CortexArtifact[] }`; validated, capped.
2. Tool-result enrichment — existing tools attach `artifacts` to result
   meta; tool loop lifts them onto the AI message.
3. Deterministic commands — globe results can emit `map` summary cards.

### Rendering

- `ArtifactRenderer` registry (`src/components/cortex/artifacts/`) — one
  switch per kind, shared by message list + drawer.
- `ArtifactSurface` — expanded view; Phase 1 reuses canvas panel mechanics.
- Design: 1px `rgba(148,233,255,0.14)` borders, corner ticks, 9px mono
  uppercase labels, state-color accents, `motion` spring entrance
  (0.98→1 scale, 200ms), live pulse on `live` artifacts.

### Phase 2 — Surface layer (visualizer)

- `CortexSurfaceLayer`: panels over the visualizer alongside core scene /
  globe iframe, never blocking the face.
- Panel types: artifact viewers, globe viewport, CCTV tile, telemetry.
- v1 layout: preset slots (left rail, right rail, bottom strip) —
  elegance through constraint; free drag/resize later.
- Voice grammar: "pin this", "open chart", "close panels", "focus mode".
- Caps: max 6 panels; agent can't spawn panels without artifact/surface
  tool or explicit user ask.

### Phase 3 — Living artifacts

- `live` artifacts subscribe to telemetry bus `/api/cortex/bus/state` and
  ambient queue; update in place.
- Obsidian provenance on demand ("save this to memory").

## Files (Phase 1)

- `src/lib/cortex-artifacts.ts` — schema, validation, caps, provenance
- `src/components/cortex/artifacts/ArtifactRenderer.tsx` + `cards/*.tsx`
- `cortex-demo-helpers.tsx` — `ChatMessage.meta.artifacts`
- `vite.config.ts` — `emit_artifact` + `generate_image` tools, image proxy
- `CortexMessageList.tsx` + `CortexChatDrawer.tsx` — render cards
- `CortexDemo.tsx` — canvas accepts artifact tabs
- `useVisualizerVoice.ts` + `cortex-globe.ts` — surface grammar (P2)

## Verification

- `tsc` clean; existing tests pass.
- Puppeteer live: prompt → `emit_artifact` → card in drawer AND chat page;
  image prompt → real generated image; voice "pin that" (P2).
- Oracle parity; screenshot review of card aesthetics.

## Risks

- Malformed artifact JSON → validator rejects, text fallback, no crash.
- Image latency 5–30s → generation-state card resolves or fails honestly.
- recharts weight → already a dep; lazy-load renderer via React.lazy.
