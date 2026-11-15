# CORTEX × GOOGLE MAPS — RESEARCH FINDINGS

Verified 2026-11 (prices/SKUs checked against developers.google.com pricing pages — they change, re-verify before billing decisions).

## 1. Google Places API (New) — SKU map relevant to Cortex

| Capability | Endpoint | SKU tier | Free/mo | Notes |
|---|---|---|---|---|
| Text Search — IDs only | `places:searchText` mask `places.id,places.name` | Essentials (IDs Only) | **Unlimited** | Cheapest resolve |
| Text Search — basic fields | + displayName, formattedAddress, location, types | Essentials | 10,000 | Current `/api/google/text-search` mask lives here |
| Text Search — ratings | + rating, userRatingCount, priceLevel, businessStatus, googleMapsUri | **Pro** | **5,000** | "$32/100k" beyond — irrelevant at personal volume |
| Place Details — reviews/hours | `places/{id}` mask incl. `reviews` | **Pro** | 5,000 | Already implemented, 6h cache |
| Place Photos | photo name → media | Enterprise | 1,000 | Deferred — attribution + cost complexity |
| Nearby Search — ratings | `places:searchNearby` + Pro fields | Pro | 5,000 | Alternative for radius queries |

**Cost verdict**: Cortex place lookups are user-driven (a search, a click) — dozens/day max. Pro tier at 5,000 free calls/month means **$0 steady-state**. The binding constraint is the per-IP rate limiter already in `google.js` (120/min default), not Google billing.

**ToS**: server-side caching allowed within limits — existing code caches place-details 6h (Google allows up to 30 days for place content; we stay well inside). Place IDs may be stored indefinitely. Photos/reviews need Google attribution when displayed.

## 2. Entity resolution OSM ↔ Google

Google Text Search returns `id` (place_id) directly — no fuzzy matching needed when we search Google first. For OSM-sourced records (Overpass results), resolution = text search `"<name> <city>"` biased to the record's coordinates, accept top hit only if within ~500m. Confidence gate: distance + name token overlap; below threshold → show OSM data only, label "no Google listing". Deferred to v2 — v1 searches Google directly so every result already carries place_id.

## 3. Frontier survey — what exists vs what Cortex can uniquely do

- **Google/Apple Maps**: rich place data but trapped in their apps, no agent integration, no personal mission-control context.
- **Foursquare City Guide**: good taste data, no API for individuals anymore.
- **Nobody ships**: a live-globe agent surface where place search results are *spatial* (pins you fly to), *tappable for live reviews*, *voice-addressable*, and *feeding demand signals back to autonomous agents*. That last one is the differentiator — place intelligence as an input to the money-making agents, not just a map feature.

**Kill list (deferred with reason)**: Place Photos (Enterprise SKU + attribution complexity, low marginal value over review text), popular-times (Pro+ fields, sparse coverage), isochrones (needs OSRM/Valhalla infra — separate project), review sentiment timeline (needs storage + NLP pipeline — v2), demand radar (needs the place_search primitive working first — natural v2 on top).

## 4. Gap matrix (v1 scope)

| Intent | v1 answer |
|---|---|
| "burger places in Duluth" | Google Text Search (Pro fields) → pins + spoken top-3 |
| "is X any good / reviews for X" | place-details via bridge → spoken summary + card if on globe |
| "pin Duluth" | existing pin-place (unchanged) |
| "turn on map search results" | osm-places layer alias |
| Click any result pin | existing Google reviews card (place_id exact-match upgrade) |
| No key / quota / offline | keyless capability response, honest spoken error |

## 5. Architecture decision

**Search lives in GEV, not Cortex.** Rationale: the osm-places layer already renders arbitrary records as clickable pins with the reviews card — feeding Google results into `setResults` gives pins + click-for-reviews for free, keeps the API key in one server, and any future embed parent gets `gev:places` for free. Cortex stays a thin command/voice layer that parses intent, geocodes the anchor, posts the search, and speaks the results.

New postMessage verb: `{type:'gev:places', id, action:'search'|'details', ...}` → replies `gev:places-applied`. Mirrors the existing `gev:cctv`/`gev:time` command pattern.
