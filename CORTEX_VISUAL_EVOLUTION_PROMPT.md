# CORTEX VISUAL EVOLUTION — RESEARCH & PLANNING PROMPT

> Run this prompt against a deep-research agent. Output: a concrete,
> file-level implementation plan for evolving the Nexus Foundry visual
> system. Constraint: every visual state must trace to real runtime data —
> the honesty invariant in `src/lib/cortex-agents/types.ts` applies to
> pixels exactly as it applies to status strings.

## CONTEXT

Cortex is a cognitive mission-control product. The Agents tab
(`src/components/cortex/CortexAgentsScene.tsx`) renders the agent fleet as
"vessels" orbiting a reactor core on a Canvas2D command deck — nebula
backdrop, perspective grid, starfield, shooting stars, model
constellation, HUD chrome, task windows, agent dossier. Agents get
snapshots/events from `agentsClient` → `/api/cortex/agents/state` + SSE
`/stream`.

We are about to split the fleet into two tiers:

- **Regular agents** (sentinel, scout, librarian, builder, reviewer,
  runner, warden, spawned ephemerals): internal ops — research, memory,
  code, patrols.
- **Enterprise agents** (the revenue engine: `distributor` today, future
  sales/finance/support agents): customer-facing, revenue-linked work.

## THE VISION TO RESEARCH AND PLAN

1. **Moons vs satellites.** Regular agents render as moons orbiting the
   core (they already read as orbiting bodies). Enterprise agents render
   as satellites — visually distinct: maybe tighter orbit, solar-panel
   silhouette, signal-beacon pulse, different HUD colour language. The
   user should be able to tell "revenue work" from "internal work" at a
   glance. Research: how do elite space sims / strategy games
   (EVE, Stellaris, Into the Breach, classic Zelda-adjacent top-down
   readability) distinguish unit classes without clutter? Deliver a
   concrete Canvas2D rendering spec: shape vocabulary, orbit mechanics,
   colour/token assignments, transition animations when an agent is
   re-tiered.

2. **The war planet.** One planet in the system represents the user's
   real-life legal battles (active matters: Stringer v. Anders CAFN
   25-A-05494-5, bench trial Division 5 week of Nov 30, emory past-due,
   barbers certificate). Design a planet with capital ships (battle
   cruisers = active cases/motions). When an important legal email or
   court event arrives, a cruiser should visibly take a hit — explosion,
   shield-flare, listing — so the user "knows a battle just happened"
   without reading anything. Research: how to bind this to REAL signals
   (initiative proposals, Gmail legal-thread detection, calendar court
   dates) honestly — no fake battles. Deliver the event→visual mapping
   table and the Canvas2D/Sprite approach (prerendered vs procedural).

3. **Enterprise agent org.** Should enterprise agents get a separate
   command surface (their own "deck") or share the foundry with a tier
   filter? Should they have different governance (customer-facing =
   stricter proposal gates)? Should spawned agents be able to declare a
   tier at spawn time? Review `SpawnSpec`/`proposeSpawn` and propose the
   minimal schema change.

4. **Free-canvas panels (already shipped — verify & extend).** Panels now
   support ⌥-drag free placement (`free` coords in cortex-surfaces.ts)
   and the cap is 14. Research whether a full free-form canvas (panels as
   objects on a plane, zoom/pan, minimap) is worth it vs the zone+free
   hybrid — deliver a recommendation, not just options.

5. **Animation budget.** User preference: MORE visible work animation,
   tasteful not maximal. Inventory every animated element in
   CortexAgentsScene + CortexCoreScene + CortexSurfaceLayer. Propose a
   "work visibility" pass: idle agents should feel alive (thruster
   flicker, docking pulses), working agents should show typed progress
   (scan lines, data streams), completed tasks should leave a fading
   contrail. Respect `prefers-reduced-motion`.

6. **Zelda-style 2D office (deferred earlier).** User floated an
   "AI agents office" with original-Nintendo 2D graphics as an
   alternative/complement to the space theme. Research which metaphor
   serves the product better long-term — space command deck vs pixel
   office — or whether a hybrid (space outside, office interior cutaway)
   is feasible in Canvas2D without a game engine. Deliver a verdict with
   reasoning, mood boards described in words, and a sprite/asset pipeline
   plan (Aseprite vs generated vs procedural).

## DELIVERABLES

- `CORTEX_VISUAL_EVOLUTION_PLAN.md`: phased plan (P0 quick wins → P3
  war planet), file-by-file changes, verification steps per phase,
  risks (perf on Canvas2D, reduced-motion, mobile), and what NOT to do.
- A tier-schema diff proposal for `AgentState`/`SpawnSpec`.
- An event-signal inventory: every real signal available today that can
  drive the war planet honestly (initiative engine, Gmail search tool,
  agents SSE, calendar holds).
- Animation inventory table with effort/impact scores.
- Explicit answers to: moons-vs-satellites rendering spec, office-vs-space
  verdict, free-canvas verdict.

## FILES TO READ FIRST

- `src/components/cortex/CortexAgentsScene.tsx` (859 lines — the deck)
- `src/components/cortex/CortexCoreScene.tsx`, `CortexCoreScene` core orb
- `src/lib/cortex-agents/{types,runtime,workers,distribution}.ts`
- `src/lib/cortex-surfaces.ts`, `src/components/cortex/CortexSurfaceLayer.tsx`
- `src/lib/cortex-proactive-initiative.ts` (initiative proposals = war signals)
- `vite.config.ts` `/api/cortex/agents/*` + `/api/cortex/distribution/*` routes
- `CORTEX_VISION.md`, `CORTEX_VISION_SPEC.md`, `CORTEX_AGENTS_SELF.md`
