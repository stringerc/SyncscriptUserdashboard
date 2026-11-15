# CORTEX × GOOGLE MAPS — IMPLEMENTATION PLAN (v1)

## GEV (`/Users/Apple/src/gods-eye-view` — not under git; edits are live via vite)

### `src/data/placeProviderPayloads.js`
- `projectTextSearchPlaces`: pass through `rating`, `userRatingCount`→`ratingCount`, `priceLevel`, `businessStatus`, `googleMapsUri` when present (fields absent in Essentials mask → null, backward compatible).

### `server/providers/places/google.js`
- `/api/google/text-search`: new optional `rich=1` param → field mask adds `rating,userRatingCount,priceLevel,businessStatus,googleMapsUri` (Pro SKU) and `maxResultCount` 20 (default stays 5). Same same-site gate, keyless path, rate limiter, error contract.

### `src/app/embed.js`
- New message `gev:places`: `{action:'search', query, lat?, lon?, radiusM?}` → GET `/api/google/text-search?q=&lat=&lon=&radiusM=&rich=1` → map places to osm-places records → `dataManager` osm-places module `setResults(records, meta)` + `setEnabled(true)` → reply `gev:places-applied {ok, count, places:[{name,address,rating,ratingCount,priceLevel,businessStatus,lat,lon}]}`.
- `{action:'details', q?|id?, lat?, lon?}` → GET `/api/google/place-details` → reply `{ok, place}` (full normalized details payload).

### `src/layers/osmPlaces/index.js`
- Record gains `googlePlaceId`/`address`; `onSceneClick` prefers `place-details?id=` when present (exact match, skips fuzzy re-resolve); card address line uses `record.address`.

## SyncScript (`/Users/Apple/syncscript`)

### `src/lib/cortex-globe.ts`
- `postGlobeCommand` already generic — add `globePlacesSearch(query,{lat,lon,radiusM})` and `globePlaceDetails({q|id,lat,lon})` posting `gev:places` / awaiting `gev:places-applied`.
- `parseMapCommand`: new intents —
  - `place-search`: "(popular|top|best|good)? <what> places/restaurants/food in|near|around <place>" → `{type:'place-search', query, place}`.
  - `place-details`: "reviews? for <name> (in|near <place>)?" → `{type:'place-details', query, place?}`.
- Guard ordering: place-search BEFORE pin-place/open so "burger places in Duluth" isn't geocoded as a place; keep isNonGeoPlace filters.

### `src/components/cortex/useVisualizerVoice.ts`
- Handle `place-search`: geocode anchor → `globePlacesSearch` → flyGlobe to result bounds (or anchor) → speak top 3 ("Found 14 burger places in Duluth — top rated: X 4.6★, Y 4.4★…").
- Handle `place-details`: geocode if place given → `globePlaceDetails` → speak rating/count/hours summary.

## Deferred (documented, not built)
Place Photos, popular-times, isochrones, sentiment timeline, demand radar, OSM↔Google fuzzy resolution (v1 searches Google directly so place_id is always exact).

## Verification
- GEV: `node --test` embed/view/osmPlaces/provider tests.
- Live headless: `gev:places search "burger restaurants in Duluth GA"` → pins appear, stats count>0, click pin → reviews card.
- Cortex: typecheck guard on touched files; voice parse unit sanity via node eval of parseMapCommand.
