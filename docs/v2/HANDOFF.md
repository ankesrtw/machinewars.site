# Session Handoff — Machine Wars v2

**Rolling handoff. The next session reads this file first.**
Overwrite the "Current state" and "Next session" sections each time; append to the log at
the bottom. Keep it short — this is a baton, not a diary.

---

## Workflow (every session)

1. **Start:** read this file, then `docs/v2/TASKS.md` for the task you are on, then only
   the plan section that task links to.
2. **Work:** one task at a time. Tick its box in `TASKS.md` with the date when its
   **"Done when"** condition actually passes.
3. **End — always do these three, in order:**
   - Run the task's verification (usually `node tools/gen-pages.mjs --check` plus opening
     an arena in the browser).
   - **Commit.** Real message, `Co-Authored-By` trailer. Never commit `.env`,
     `tools/gis/cache/`, or `tools/tripo-out/`.
   - **Update this file** — rewrite "Current state" + "Next session", append one line to
     the log.

**Do not end a session with uncommitted work and no handoff note.** If a task is half
done, say exactly where it stopped and what breaks.

---

## Current state

**Phase:** P1 GIS pipeline (P1.1–P1.4 done) — **blocked on P0** for P1.5 onward.
**Status:** Heightmap ground engine code exists (`_buildHeightmapGround()` in
`src/scenes.js`) but is **unwired and unverified in the browser** — no scene config sets
`ground.type: 'heightmap'` yet, so nothing calls it. Wiring a real `ghats` scene (P1.5)
means adding a new site to `scenes-data.js`, which is exactly the authoring work
`TASKS.md` says can't happen before the **P0 gate** passes. P0 has not been started.
**Decision this session:** stop P1 here, start Phase 0 next.
**Last commit:** (this session) P1.4 `_buildHeightmapGround()` — additive, existing 8
arenas confirmed unaffected (`gen-pages.mjs --check` + `node --check src/scenes.js`).

`tools/gis/cache/` is gitignored (confirmed via `git check-ignore`). `assets/terrain/` is
**not** gitignored — baked outputs commit (confirmed via `git check-ignore -v`, exit 1).
Spike decoders are preserved in `docs/v2/spike/` — already ported, keep them as reference
only from here.

### What P1.4 built (code only — read before touching `_buildGround`)

- `src/scenes.js` `_buildGround()` gained one branch: `gc.type === 'heightmap'` dispatches
  to `_buildHeightmapGround(cfg)`, a new method. Every other `type` (`'procedural'`,
  `'texture'`) is byte-for-byte unchanged — confirmed via `gen-pages.mjs --check` and
  loading a couple of existing arenas' code paths by inspection (not yet re-opened live in
  a browser this session; do that before trusting this fully).
- `_buildHeightmapGround` mirrors the existing `type: 'texture'` branch's async pattern: a
  flat placeholder `PlaneGeometry` goes up synchronously (`build()` never blocks), then
  `fetch()` for `heightmap.json` + a new `loadHeightmapPixels()` helper (loads the PNG via
  `<img>` → canvas → `getImageData`, since a `THREE.Texture` alone is GPU-opaque and vertex
  displacement needs CPU-side samples) displace the mesh once loaded, and `_texLoader.load`
  swaps in `albedo.png` the same way the texture branch already swaps in ground textures.
- **The far-plane crop decision (asked of the user, chose "crop to fit"):** the bake covers
  `horizonExtentM` (2400m) but camera far plane is a hard 400 (`src/main.js`). Rather than
  touch the camera/quality system, added a new `ground.visibleRadiusM` config field — the
  actual mesh is sized `2 * visibleRadiusM` and only *samples* the 2400m bake's center crop
  via `heightmap.json`'s own `extentM`/texel math. The full-resolution bake still exists on
  disk for Unity later; only the web preview's visible footprint is cropped. **No ghats
  scene config exists yet to set this field** — whoever writes it (P1.5) should pick
  something safely under 400 (e.g. ~300–340m radius) with margin for perspective at
  oblique view angles.
- **Precision tradeoff, documented in code comments:** canvas `getImageData` is always
  8-bit/channel, so the 16-bit heightmap downsamples to 256 levels client-side — over
  ghats's ~85m elevation range that's ~0.33m/step. Fine for a horizon-only displaced mesh,
  **not** fine if this code path is ever reused for the hand-authored combat floor itself.
- Inside `gc.flatZoneRadius`, elevation is forced flat (blended over 8m at the seam) — this
  is the plan §5.4 hard split: authored combat floor inside, real DEM relief outside.
- **Not yet done:** no visual verification. No test scene, no screenshot, no confirmation
  the displacement math or the flat/relief blend actually looks right. Treat this as
  "compiles and doesn't break other arenas," not "works."

### What P1.3 built

- `tools/gis/build-heightmap.mjs` — imports `loadMosaic`/`windowStats` from
  `decode-terrarium.mjs` (P1.2 built these exports for exactly this). Crops the mosaic to
  `horizonExtentM` around the site center, bilinear-resamples to 1025² (default) or 2049²,
  normalizes elevation min..max into a 16-bit grayscale range, writes a **hand-rolled PNG**
  (zlib `deflateSync` only, no npm deps — same discipline as `decode-terrarium.mjs`'s
  hand-rolled reader) to `assets/terrain/<slug>/heightmap.png`, plus `heightmap.json`:
  `metersPerTexel`, `elevationMin/Max/Range`, `originLatLon`, `extentM`, the source block —
  **this is the file Unity's `TerrainData.SetHeights` will consume later**, so the
  denormalization formula is spelled out in the JSON itself (`notes` field).
  `--check` re-derives min/max live from the mosaic and diffs against the saved JSON —
  catches silent drift if `sites.data.js` or the decoder changes later. Verified for ghats:
  elevation 619.5..704.1m (range 84.6m) over the 2400m horizon window — `--check` passes.
- `tools/gis/build-albedo.mjs` — **procedural, not Sentinel-2** (see decision below). Grades
  a tiled 1024² albedo from a new `sites.data.js` field, `albedoPalette` (`base` colour +
  4 `speckle` colours), using the same seeded-rectangle-speckle approach as
  `src/fx.js`'s in-browser `proceduralGroundTexture`, but as an offline file-writing PNG
  encoder instead of a Canvas. Writes `albedo.png` + `albedo.json` (biome id, mean colour
  for lighting/fog tinting). Added `ghats: { biome: 'jungle', albedoPalette: {...} }` to
  `sites.data.js`, graded from reference photos (damp laterite soil + leaf litter), not
  sampled imagery.
- Both scripts follow existing `tools/gis/*.mjs` conventions exactly: `--site=`, `--dry-run`,
  `--check` (no network, diffs against live state), zero deps, header comment stating *why*.

**Decision this session (deliberate, matches the HANDOFF's own "decide before starting"
flag):** shipped **procedural albedo**, deferred `fetch-imagery.mjs` again. Reasoning
unchanged from P1.2's note — ground albedo doesn't gate the question P1 is actually asking
(does the heightmap + horizon read as a real place); it's orthogonal to whether DEM relief
sells the site. If the procedural grade reads as flat/fake once P1.4/P1.5 put a camera in
the scene, that's the signal to build `fetch-imagery.mjs` — not before.

### What P1.1/P1.2 built

- `tools/gis/sites.data.js` — roster as data. `ghats` seeded: bbox, `centerLatLon`,
  `zoom: 15`, `tileGrid: 3x3`, `playableExtentM: 400`, `horizonExtentM: 2400`, source
  metadata (AWS Terrarium, not Copernicus — see note below).
- `tools/gis/fetch-dem.mjs` — lat/lon → tile math → downloads the site's tile grid to
  `tools/gis/cache/<slug>/t_<dx>_<dy>.png`. Idempotent (`--force` to overwrite),
  `--dry-run`, `--check` (reports cache completeness for every site, no network).
  Verified: fresh fetch downloads 9/9 tiles for ghats; re-run downloads 0/9 (skipped).
- `tools/gis/decode-terrarium.mjs` — ported from
  `docs/v2/spike/terrarium-decode-spike.mjs`. Exports `loadMosaic(slug)` and
  `windowStats(mosaic, extentM)` for **P1.3 to import** (`build-heightmap.mjs`), plus a
  CLI printout when run directly. **Regression test passes:** ghats prints relief
  `27.8m` @ 400m window and `50.3m` @ 1200m window — matches the spike's 27.9m/50.3m to
  float precision (spike hardcoded an approximate tile-center fraction; this version
  computes it exactly from lat/lon, hence the 0.1m drift on the smaller window only).

**Deviation from the roadmap, deliberate:** §5.1/P1.2 names Copernicus DEM GLO-30 +
Sentinel-2 as the intended sources. This session built against **AWS Terrarium tiles**
instead, because that's what the P1 spike proved end-to-end with zero deps and the
HANDOFF explicitly said to port from the spike. `fetch-imagery.mjs` (Sentinel-2 albedo)
was **not built** — not needed to answer the P1 gate question (does the heightmap +
horizon read as a real place), and can be added whenever `build-albedo.mjs` needs it.
If Copernicus turns out to matter (resolution, licensing for shipped attribution),
swapping `sites.data.js.ghats.source` is the only place that changes — `fetch-dem.mjs`'s
tile-math approach would need a different fetch strategy for Copernicus's format, but
`decode-terrarium.mjs`'s `loadMosaic`/`windowStats` split isolates the reusable half.

### What the spike established (2026-08-16)

Ran against Agumbe, Western Ghats (13.5178N, 75.0906E) using AWS terrain tiles
(`s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`).

**Feasibility — all green:**
- Terrarium PNG tiles: **HTTP 200, no auth, no API key, no rate limit hit.**
- Decodable with **Node's built-in `zlib` alone** — no GDAL, no numpy, no PIL, no npm
  deps. A ~40-line PNG decoder handles 8-bit RGB non-interlaced, which is what these are.
  (Verified: this box has Node v24.19.0, Python 3.12 bare, **no GDAL, no geo stack**.)
- Elevation formula: `(R*256 + G + B/256) - 32768` meters.
- Resolution at this latitude: **4.64 m/px at z15**, 9.29 at z14, 18.58 at z13.

**The load-bearing finding — real DEM is useless at combat scale:**

| Window | Relief | Reads as |
|---|---|---|
| 400m (arena) | **27.9m** | A single smooth tilted plane. No cover, no ridges, no features. |
| 1200m (horizon) | **50.3m** | Real structure — ridges, valleys, recognizable landscape. |

At 4.6 m/px a 200m firefight box contains **~43 real samples**; everything a player
fights around would be interpolation regardless. **Real data is worthless inside ~400m
and valuable beyond ~600m.**

**Decision (user, this session):** build the site as **authored floor + real horizon**.
Combat area fully hand-authored; real DEM drives the visible terrain ring and skyline out
to the camera's 400 far plane. This sharpens plan §5.4 — it is not "real terrain, place
cover on top," it is a hard split at ~400-600m.

**Unity: not yet.** The P2 A/B spike is a decision *about this heightmap*; making it
before knowing whether the horizon sells the place is backwards. The heightmap + metadata
pair is engine-agnostic — Three.js displaces a `PlaneGeometry`, Unity uses the same two
files via `TerrainData.SetHeights` or a baked mesh. The web arena is the cheap viewer,
not throwaway work.

---

## Next session — start here

**Task: P0.1** (see `docs/v2/TASKS.md` Phase 0) — scaffold `data/` + the JSON exporter.
P1.5 (wiring an actual `ghats` scene so P1.4's code can be seen/verified) needs a new site
added to scene config, and `TASKS.md` is explicit: *"Nothing in Phase 1+ may start until
the P0 gate passes."* P1.1–P1.4 already happened before this was caught — see the log
below — but P1.5 is where it would bite: P0.4 splits `SCENE_CONFIGS` into
`data/scenes/<slug>.data.js` ×8, and a `ghats` site added straight into today's
`scenes-data.js` would just be more of the exact thing P0.4 has to migrate away from.

1. Read `docs/v2/TASKS.md` Phase 0 section in full before starting — 8 tasks, do them in
   order, P0.4 (`SCENE_CONFIGS` split, **L**, 1,501 LOC) is the big one.
2. **P0.1** first: `data/README.md` (contract: one `export default {...}` per file,
   JSON-literal only, no functions/imports/computed values) + `tools/data-to-json.mjs`
   (~20 LOC + `--check`), following `tools/gen-pages.mjs` conventions.
3. Work the list in order: P0.2 (weapons/score, smallest blast radius) → P0.3 (enemies/
   waves) → P0.4 (scenes, the big one — **this is what unblocks wiring up ghats**) → P0.5
   (campaign graph) → P0.6 (save v2 migration) → P0.7 (missions) → P0.8 (docs).
4. **P0.4 note relevant to P1**: when this splits `SCENE_CONFIGS`, the split should
   produce a `data/scenes/ghats.data.js` slot even though `ghats` doesn't exist as a site
   yet (`implemented:false` per P0.5's node-graph task) — that's the natural point to
   resume P1.5 instead of hand-editing `scenes-data.js` directly.

**Done when P0 gate passes** (`TASKS.md` "GATE P0"): all 8 arenas load/play unchanged from
`data/`, `gen-pages.mjs --check` exits 0, `data-to-json.mjs` round-trips, v1 save migrates,
graph AND-gate resolves correctly.

**Then resume P1.5** — `emit-scene.mjs` → `data/scenes/ghats.data.js`, hand-authored
playable box, first live look at P1.4's heightmap ground code actually rendering.

### Watch out for

- `tools/gis/cache/` must be gitignored **before** the first fetch, or tiles land in git.
- Camera far plane is **400** (`src/main.js`), unchanged. P1.4 resolved the
  `horizonExtentM` (2400) vs. far-plane (400) mismatch by cropping the *visible* mesh to a
  new `ground.visibleRadiusM` field rather than touching the camera — pick a value safely
  under 400 (radius, not diameter) when writing the ghats scene config, with margin for
  oblique view angles.
- `_buildHeightmapGround()` (`src/scenes.js`, added P1.4) is a **new method**, not a
  rewrite of the existing displacement loop in `_buildGround()` — the seeded-noise path
  for `'procedural'`/`'texture'` types is untouched. Strictly speaking this added one new
  config field (`visibleRadiusM`) beyond a pure "swap the displacement source" change;
  flagging it here since plan §5.5 calls the heightmap branch out as the *only* engine
  change P1 should require — this stayed inside `_buildGround()`'s existing call site and
  didn't touch any other system, but it's not literally zero-schema-growth either.
- **P1.4's code has never been run.** No scene sets `ground.type: 'heightmap'` yet. Don't
  trust the displacement math, the flat/relief blend, or the far-plane crop until you've
  actually seen it render.

---

## Log

- **2026-08-16** — Wrote `docs/v2/ROADMAP-V2.md`, `TASKS.md`, this file. Ran the GIS
  feasibility spike: terrarium tiles fetch + decode with zero deps; established the
  400m/1200m relief split that reframes plan §5.4. Decided authored-floor + real-horizon,
  Unity deferred until after the web preview. No source code changed yet.
- **2026-08-16** — P1.1 + P1.2: `tools/gis/sites.data.js`, `fetch-dem.mjs`,
  `decode-terrarium.mjs` ported from the spike. Ghats DEM cached and decoded; regression
  relief numbers hold (27.8m/50.3m). Used AWS Terrarium instead of roadmap-specified
  Copernicus/Sentinel — deliberate, see "Deviation from the roadmap" above.
  `fetch-imagery.mjs` deferred to P1.3.
- **2026-08-16** — P1.3: `tools/gis/build-heightmap.mjs` (crop/resample/normalize the
  mosaic to a 16-bit PNG + metadata JSON, hand-rolled PNG writer, zero deps) and
  `tools/gis/build-albedo.mjs` (procedural tiled albedo from a new `albedoPalette` field
  on `sites.data.js`, `fetch-imagery.mjs`/Sentinel-2 deferred again — deliberate, doesn't
  gate the P1 relief question). Ghats heightmap (619.5–704.1m over 2400m) + albedo
  (jungle biome) baked to `assets/terrain/ghats/`; both `--check` flags pass, round-trips
  verified against the live decoder.
- **2026-08-17** — P1.4: `_buildHeightmapGround()` added to `src/scenes.js` — new
  `ground.type: 'heightmap'` branch, async displacement + albedo load, new
  `ground.visibleRadiusM` field to crop the 2400m bake to fit inside the 400 far plane
  (user chose crop-the-mesh over touching the camera). Code compiles, existing 8 arenas
  confirmed unaffected, **but never actually rendered** — no scene wires it up yet.
  Started P1.5 (wiring an actual `ghats` scene) and caught that `TASKS.md` blocks all of
  Phase 1+ until the **P0 gate** passes; P0 was never started. User chose to stop and do
  P0 properly rather than route around the gate. P1.1–P1.4 already happened pre-gate —
  left as-is (not worth unwinding), but P1.5 is paused until P0.4 gives `ghats` a proper
  `data/scenes/` slot to land in.
