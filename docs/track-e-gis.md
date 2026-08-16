# Track E — Real-world GIS arenas

R&D. **Gated: do not start until Track B Phase 1 (data externalization) is
complete.** See [ROADMAP.md](ROADMAP.md) — superseded by
[docs/v2/ROADMAP-V2.md](v2/ROADMAP-V2.md) Phase 1/§5, which is now the current
plan for this track; the gate condition still holds (renamed the **P0 gate**).

**Softened from "Option 1" to a hybrid, based on the P1 feasibility spike
(2026-08-16, `docs/v2/HANDOFF.md`):** real DEM relief measured **27.9m over a
400m combat-arena window** but **50.3m over a 1200m horizon window** — at
combat scale, real elevation data is indistinguishable from a smooth tilted
plane; it only reads as a real place once you're seeing 600m+ of it. Pure
"real terrain, place cover on top" (as Option 1 originally implied) would have
spent the whole GIS pipeline on relief the player can't perceive while
fighting.

**Revised decision: authored floor + real horizon**, not full Option 1.
Combat area is entirely hand-authored (cover, spawns, player start — same as
today's arenas); real DEM/imagery drives only the visible terrain ring and
skyline out to the camera's far plane, blended to flat at the authored
combat floor's edge. Building-footprint extrusion (the original §"Options
considered" plan for OSM data) is **deferred** — the spike only exercised
elevation tiles, not OSM footprints; revisit footprint extrusion only if a
site's real skyline needs recognizable structures, not as a default for every
site. See ROADMAP-V2 §5.4 for the authored/relief split this produced.

---

## Data sources

Licensing is what kills GIS game projects, so it is the first column.

| Source | What | License | Cost |
|---|---|---|---|
| **OpenStreetMap** | Building footprints + heights, roads, land use | **ODbL** — attribution required; derived *works* fine, derived *databases* share-alike | $0 |
| **Copernicus DEM** (30m global) | Terrain elevation | Free, attribution | $0 |
| **USGS 3DEP** (1–10m, US only) | High-res terrain | Public domain | $0 |
| **Sentinel-2** (10m) | Satellite imagery for ground textures | Free, attribution | $0 |
| **Google Photorealistic 3D Tiles** (Cesium ion) | Photogrammetry of whole cities | **Restrictive** — must stream at runtime, no caching or baking, attribution always visible, commercial terms apply | free tier, then paid |
| **Mapbox Unity SDK** | Turnkey Unity integration | — | **Effectively unmaintained — do not build on it** |

---

## The options considered

**Option 1 — Real cities as arenas. ← chosen.** Preprocess OSM footprints +
heights + DEM **offline** into the existing scene-data schema. "Defend Delhi /
New York / your hometown" is a genuinely strong hook, and because you bake
offline the game keeps its greatest asset: **no backend, no network, no runtime
tile streaming, no licensing entanglement** beyond an ODbL attribution line in
the credits.

**Option 2 — Real terrain, fictional sites.** DEM heightmaps with hand-placed
bases. Cheaper and no attribution questions, but a much weaker hook — players
cannot tell real terrain from good procedural terrain, so you would be paying
for authenticity nobody perceives.

**Option 3 — Player's own location.** Highest novelty and virality, but requires
runtime tile streaming and a network connection. **This would destroy the
offline, backend-free property that makes both the Capacitor and Unity builds
simple.** Park it as a possible post-launch feature, not a v2 requirement.

---

## Implementation

`tools/gis/build-arena.mjs` — Node, run manually, **never at runtime**:

1. Take a bounding box.
2. Query the Overpass API for `building` ways with `height` /
   `building:levels`.
3. Fetch DEM tiles for the same box.
4. Emit `data/scenes/<slug>.data.js` **in the schema you already have** —
   populating `coverBlocks` from footprints and `ground` from the heightmap.

Building footprints become extruded blocks, which is *exactly* what the existing
`coverBlocks` format `[x, z, w, d, h, rot]` already expresses. The generator's
output is a scene data file and nothing more.

The web game then loads it with **zero engine changes** — which is precisely the
test of whether Track B's data externalization was done right. If the generated
file needs engine changes to load, the schema is wrong.

If the web prototype proves fun, Unity's version reads the same generated file.
**The generator is written once and serves both engines.**

---

## Gates

- **Do not start before Track B Phase 1.** The generator's entire value is that
  it emits your scene schema; without a clean schema there is nothing to emit
  into.
- **Prototype ONE real location before generalizing.** Pick somewhere you know
  well, so you can judge whether it actually feels good to fight in.
- **Be prepared for the answer to be no.** Real cities are mostly flat, dense,
  and repetitive; there is a real risk they play *worse* than the hand-tuned
  arenas. Find that out with one location and a weekend — not with a pipeline
  and a month.

---

## Verification

The generated scene file loads in the **unmodified** web engine, and the arena
is playable end-to-end. Then the real test: is it more fun than `urban`?
