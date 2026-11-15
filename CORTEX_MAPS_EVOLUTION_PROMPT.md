# CORTEX × GOOGLE MAPS — RESEARCH & BUILD PROMPT

> Mission: make Cortex the most capable place-intelligence layer ever shipped inside a personal mission-control surface — grounded in real APIs, honest about coverage and cost, and architected so every capability compounds. Research first, then produce a file-level implementation plan, then build.

You are working across TWO repos:

- **SyncScript / Cortex** — `/Users/Apple/syncscript` (React+TS visualizer, vite :5173, `src/lib/cortex-globe.ts` is the postMessage bridge to GEV)
- **God's Eye View (GEV)** — `/Users/Apple/src/gods-eye-view` (Cesium globe app, vite :5180, embedded via `?embed=1`, NOT a git repo — treat file edits carefully)

---

## 1. CURRENT STATE (verified — do not re-derive, verify deltas only)

### What exists today

- **Globe embed**: Cortex iframe → GEV `?embed=1`. Contract: parent posts `{type:'gev:view', id, view}` (camera, layers, style, map, annotations), child replies `gev:view-applied`. Also `gev:time`, `gev:cctv` commands.
- **Layer bridge**: `cortex-globe.ts` — `parseMapCommand` (voice → open/layers/pin-place/annotate/arrow/cctv/fx/zoom), `geocodePlace` (Photon + Nominatim fallback, point geocoding ONLY), `buildFlyView`, `flyGlobe`, `globeAnnotate` (pin/highlight/area/label/arrow), `activeLayers` merge (fixed: views no longer wipe user-enabled layers).
- **GEV layers**: 38 registered layers (flights, AIS, satellites, military, earthquakes, weather×5, cctv, radio, transit, bikeshare, osm-places, local-firms, etc.). Session-only layers (osm-places, local-adsb) survive views after the embed.js fix.
- **OSM Places layer** (`src/layers/osmPlaces/index.js`): displays Overpass search results as points+labels; click → geometric pick → floating card → fetches `/api/google/place-details` → renders rating, review count, price level, open-now, hours, up to 3 review excerpts, Google Maps/website links.
- **Google Places provider** (`server/providers/places/google.js`): server-side Place Details (New) — field mask rating, userRatingCount, reviews, priceLevel, regularOpeningHours + identity/contact fields. Normalized response, rate-limited, cached, key never reaches browser. Key in GEV `.env` (server-side only).
- **Verified working**: Urth Caffe lookup returned ★4.5, 5,879 ratings, hours, real review text. Click→card verified end-to-end in headless Chrome.

### Known gaps (the build surface)

1. Cortex voice CANNOT trigger a place search — GEV `osm_query` is internal-only, not on the postMessage contract.
2. No `place_search` concept anywhere: "popular burger places in Duluth" geocodes Duluth at best.
3. Cortex doesn't know reviews exist — no layer alias, no tool, no spoken capability.
4. No entity resolution between OSM results and Google place_ids.
5. No photos, no atmosphere/business-status depth, no review pagination, no Q&A, no popular-times.
6. No list/surface rendering of search results — only map pins.
7. Google key is unrestricted-ish (server-side); no per-route quota tiers, no spend ceiling.
8. GEV is not under version control — changes are unversioned.

---

## 2. RESEARCH QUESTIONS (answer with sources before planning)

### A. Google Places API (New) — full capability map
- Enumerate every SKU relevant to a globe app: Text Search, Nearby Search, Place Details (fields: rating, reviews, photos, regularOpeningHours, currentOpeningHours, priceLevel, businessStatus, accessibility, paymentOptions, parkingOptions, editorialSummary, reviews with name masking), Place Photos, Place Autocomplete (New), Address Validation.
- For EACH: current pricing, free-tier monthly allowance, required field-mask SKU tier (Essentials/Pro/Enterprise), rate limits, caching/ToS constraints (Google requires caching restrictions — what exactly may be stored and for how long?).
- Which SKUs give "popularity" signals: rating, userRatingCount, review count recency, popular_times? Is there any legitimate "trending" or "busy now" signal?
- Photos: Place Photos SKU pricing per photo, max resolution strategy, attribution requirements.

### B. Entity resolution OSM ↔ Google
- Techniques to match an OSM feature (name + lat/lon + osm_type) to a Google place_id: proximity radius, name fuzzy match, address agreement, category agreement. False-positive risks and mitigations.
- When to skip resolution (no match → show OSM data only, honest "no Google listing").

### C. What "eons ahead" looks like — survey the frontier
- How do Google Maps, Apple Maps, Foursquare City Guide, Placer.ai, SafeGraph-type products present place intelligence? What do they NOT do that a live-globe mission-control could?
- Ideas to evaluate (pick winners, kill weak ones):
  - **Review heat on the globe**: pins colored/shaded by rating — "red = avoid" at a glance while flying over a city.
  - **Demand radar for the money agents**: the DISTRIBUTOR/SCOUT agents query place data to find underserved demand (e.g., "DMV-area detailing shops with <4.0★ and <50 reviews" = content/product opportunity). This is the commercial compounding play — place intelligence feeding the revenue engine.
  - **Temporal layers**: open-now state, popular times, "how busy is this block right now" for route planning.
  - **Review sentiment timeline**: recent reviews vs old — is the place declining or improving?
  - **Photo strips** on click cards (Place Photos, attribution-compliant).
  - **Proactive alerts**: "a place you bookmarked just dropped below 4.0★" or "competitor opened 0.4mi away".
  - **Walking/driving-time isochrones** around a dropped pin (OSRM/Valhalla/ORS — free, self-hostable).
  - **Street-level**: existing `street-level` layer + Google Street View Static API as click-through.
- For each surviving idea: data source, cost, latency, honesty constraints (never fabricate "popular" — must come from real rating/review-count signals).

### D. Gap analysis — no gaps allowed
Produce a matrix: every user intent ("find X near Y", "is X any good", "what's open now", "compare A vs B", "how do I get there", "pin this for later", "alert me if X changes") × current capability × required build × verification method. Every cell must be IMPLEMENTED or explicitly DEFERRED with reason — no silent holes.

### E. Forward-thinking architecture
- Where does place search live: Cortex server route vs GEV provider vs new service? Consider the Cortex↔GEV boundary — should the postMessage contract grow a `gev:places` command family (search/query/details/photo) so ANY embed parent gets it, or should Cortex proxy Google directly?
- Caching strategy honoring Google ToS (place_id → details cache TTL, what may persist).
- Rate-limit & budget governor: per-route quotas, monthly call counters surfaced in Cortex ("places API: 143/5000 free calls used").
- Offline/degraded behavior: no key → capability response not error (already the pattern); quota exhausted → honest message.
- Observability: every places call should appear in Cortex telemetry (agent/task or signal) so the user SEES lookups happening — consistent with the visual-observability requirement.

---

## 3. DELIVERABLES

### Phase 1 — `CORTEX_MAPS_RESEARCH.md`
Research findings: SKU/pricing/ToS table, entity-resolution recommendation, frontier survey with kill/win verdicts, gap matrix, architecture recommendation with rationale.

### Phase 2 — `CORTEX_MAPS_PLAN.md`
File-level plan: every file to touch in BOTH repos, new endpoints, new postMessage verbs, UI surfaces, telemetry hooks, migration/rollback notes, test plan.

### Phase 3 — Implementation (in priority order)
1. **`place_search` tool** — "popular burger places in Duluth" → provider query → pins+labels on globe + spoken/surface list. Google Text Search preferred (ratings = "popular"); Overpass fallback.
2. **Reviews awareness** — Cortex knows osm-places results are clickable-for-reviews; layer alias `map search results`; voice flow "look up reviews for X" → fly to X → trigger details.
3. **Entity resolution** — OSM record → Google place_id matching with confidence threshold.
4. **Rich cards** — photos (if budget allows), hours, popular-times, price, atmosphere summary where available.
5. **Demand radar** (if research supports it) — agent-facing place-intelligence queries feeding SCOUT/DISTRIBUTOR.
6. **Budget governor + telemetry** — call counters, Cortex-visible usage.

### Phase 4 — Verification (mandatory, no claims without evidence)
- Unit/contract tests for parsing, entity resolution, response normalization.
- Live browser verification: voice/text command → results on globe → click → reviews card → surface list. Screenshot or DOM evidence.
- Cost verification: confirm calls stay within free tiers; document actual usage.
- GEV test suite (`node --test` on touched areas) + SyncScript cortex typecheck guard.
- Commit SyncScript changes; GEV has no git — note that explicitly.

---

## 4. CONSTRAINTS & HONESTY RULES

- **No mock data.** Every rating, review, photo, hour must come from a real API response. If a place has no Google listing, say so — do not synthesize.
- **API keys server-side only.** Never expose Google keys to the browser or commits. GEV `.env` already holds the key — reuse the existing provider pattern.
- **Google ToS**: respect caching restrictions and attribution requirements ("Google" logo/attribution on photo/review surfaces as required).
- **Cost ceiling**: design so steady-state usage stays inside free monthly tiers; add a hard governor before any paid SKU volume.
- **Visual observability**: the user must SEE place lookups happening — pins appearing, cards opening, result lists populating, call counters ticking.
- **Don't break the globe**: session-layer survival, view contract, and existing 38 layers must keep working. Run embed/view/osmPlaces tests after every GEV change.
- **English only**, match existing code style, compact diffs, no comments unless needed.

## 5. FIRST ACTION

Start with Phase 1 research. Use web_search/webfetch for current Google Places pricing and SKU details (they change — do not rely on memory). Then write `CORTEX_MAPS_RESEARCH.md` and stop for review before planning/implementation.
