# Cortex Satellite Realism — Implementation Prompt

> Goal: enterprise-tier agents on the Cortex core page should read as
> *real spacecraft*, not neon icons — matching the fidelity bar of the
> map tab's orbital assets. Reference: realistic satellite photography
> (bus + deployed solar arrays + dish + appendages).

## Visual target

A satellite at ~2–4 units on screen must show, at a glance:

1. **Bus** — elongated box with gold multi-layer-insulation (MLI) foil
   texture: warm amber, specular streaks, subtle crinkle noise. NOT flat
   color. Slightly tapered equipment bays fore/aft.
2. **Solar arrays** — two wings, each 2–3 panel segments in-span with
   visible photovoltaic cell grid (dark blue-black cells, silver bus
   lines), thin yellow Kapton border frames, hinge gaps between segments.
   Wings cant ~10–15° for realism.
3. **High-gain dish** — parabolic antenna on a mast, offset from bus
   centerline; dish face catches a specular glint.
4. **Appendages** — comms mast(s), RCS thruster blocks (4 small boxes at
   corners), omni antennas (thin whips), radiator panels (dark flat
   plates), star trackers (small angled plates).
5. **Lights** — red port / green starboard navigation lights at wing
   tips (steady, dim); white strobe beacon on mast (blinks ~1Hz);
   engine glow only while `working`.

## Technical approach (three.js / R3F, zero new deps)

- **Materials**: `MeshStandardMaterial` + `MeshPhysicalMaterial` for
  realism — requires adding scene lights (currently the core scene has
  NONE; everything is unlit sprites). Add: dim ambient, one warm
  directional key light, one cyan point light at the core (acts as
  earthshine/rim). Basic-material sprites are unaffected — safe.
- **Textures**: canvas-generated, cached singletons (existing pattern
  in `getGlowTexture`/`getWingPanelTexture`):
  - `mliFoilTex` — 256² amber noise + diagonal specular streaks.
  - `pvCellTex` — upgrade existing wing texture: darker cells, finer
    grid, silver interconnect lines.
- **Geometry**: primitives only — `boxGeometry`, `cylinderGeometry`,
  `sphereGeometry`, `coneGeometry`, `latheGeometry`/`circleGeometry` for
  dish, `planeGeometry`. Bevel illusion via second inset darker box.
- **Orientation**: keep existing basis-matrix quaternion (nose = orbit
  tangent, top = radial outward). Add ultra-slow roll drift
  (`sin(t*0.1)` ±3°) so panels don't look frozen.
- **Animation budget**: beacon blink + nav-light shimmer + working
  thruster flare + panel glint sweep (a thin additive sprite sliding
  along each wing every ~6s). Nothing else moves — real sats are rigid.
- **Status mapping (honesty invariant)**: colors come from the agent's
  real `AgentClient` state — working = thruster glow + wing brighten;
  error = beacon strobe red + nav lights flash; offline/retired =
  desaturate materials 60%, lights off. Never animate fake activity.

## File targets

- `src/components/cortex/CortexCoreScene.tsx` — replace the simple
  wireframe hull JSX (~line 1020) with `<SatelliteHull>` sub-component;
  add lights + texture generators; extend per-frame material updates.
- Optional later: `CortexAgentsScene.tsx` 2D vessel gets the same part
  list drawn in canvas for parity.

## Verification

- `npx tsc --noEmit` — zero new errors in edited ranges.
- Visual: distributor satellite must show foil bus, cell-grid wings,
  dish glint, nav lights at distance; wings readable at orbit radius.
- Perf: ≤ ~40 draw calls per satellite, shared geometries/materials
  where possible; satellites only mounted for enterprise agents.
