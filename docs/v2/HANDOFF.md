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

**The re-plan is done (2026-08-17).** The direction change recorded last session
has been written into `docs/v2/ROADMAP-V2.md` and `docs/v2/TASKS.md`. **Those two
files are now current and authoritative** — the "stale Phase 1/2" warnings from
last session are resolved. No code changed this session; this was the planning
session the previous handoff called for.

**What the re-plan decided** (all with the user, via explicit questions):

1. **GIS is a closed research track.** Phase 1 ran, GATE P1 asked "does Ghats read
   as a real place?", the answer was **no**, and the plan's own stated fallback
   (hand-authored sites) was taken. ROADMAP-V2 gained a **§1.5 decision record**
   and an **Appendix A** preserving the two durable findings (DEM is flat under
   ~400m / real only past ~600m; the `mat.color` multiply bug). **P1.6 dropped** —
   no GIS artifact ships, so no attribution obligation. `tools/gis/`,
   `assets/terrain/ghats/`, `_buildHeightmapGround()` all **stay on disk**.
2. **Phase 2 rebuilt.** The terrain A/B spike is void (no DEM to import). Phase 2
   is now: Unity scaffold → **data importer (moved up from P3.1)** → build
   `warzone` as a static Unity scene from `data/` → profile on device. The gate is
   perf **plus** "a `data/` edit round-trips with zero hand-editing."
3. **Roster: 11 sites → 9.** `ghats`/`ghats_east` **retired**; **`jungle` becomes
   the campaign start node** (it was a finished arena orphaned from the graph by
   the old ghats split — see the P0.7 note below). `ocean` and `grid` are the two
   net-new hand-authored sites. `space` exists but with placeholder art.
4. **Per-site mechanical variation is now a stated requirement** (new ROADMAP-V2
   §3.1) — *"each scene should play differently, not just look different."* The
   key finding: **the existing schema already carries this.** Three unused levers —
   per-scene `waveSet` (P0.3 built it, nothing sets it), new enemy types
   (`data/enemies.data.js` is open-ended), and `flies`/`flyHeight` (already on
   `drone`). **Rule adopted:** variation must be expressible as `waveSet` + enemy
   types + layout; anything needing a new *system* is a phase decision, not a
   roster task.
5. **`space` is the one genuine new system** (new §3.2): the player **pilots a ship,
   6DOF**. Because it's a second movement model landing on the finale, it got
   **its own Phase 5 with its own cut-or-keep gate**, placed *after* the MSP gate.
   Phase 4 ships `space` as a **foot-soldier arena on a station hull** (the
   documented fallback) so the campaign is complete and shippable without 6DOF.
   `ocean` is an **ocean launch grid / rocket-launch station**, explicitly not an
   oil rig, with a drone-heavy waveSet.
6. **New Phase 1.9** (web repo, ~1 week, blocks the Unity importer): retire
   ghats nodes + promote `jungle` to start node + author its mission; wire
   per-scene `waveSet`; author `ocean` + `grid` scene data.

**Phase renumbering:** old P5 (roster) → **P6**; old P6 (Android) → **P7**; old P7
(assets) → **P8**. New **P5** is the 6DOF phase. P3.1 (importer) moved to **P2.2**;
P3's numbering is otherwise unchanged deliberately, so old log entries still read.

**Nothing was verified in a browser this session** — no code was touched. `git
status` is clean apart from the pre-existing untracked video/tool files.

**What P1.5 built:** `data/scenes/ghats.data.js` — new scene config, `ground.type:
'heightmap'` pointing at `assets/terrain/ghats/{heightmap,albedo}.{png,json}`
(P1.3's bake). `ground.visibleRadiusM: 200` (radius; mesh diameter 400 — right at
the camera's 400 far plane, no margin; if this pipeline is ever revived, tighten
this) crops the 2400m bake to a visible ring; `ground.flatZoneRadius: 68` is the
hand-authored combat floor inside it — coverBlocks/crates/barrels/sandbags/props
hand-placed inside that radius, same density/shape language as `jungle.data.js`.
Sky/CREON palette reused from `jungle.data.js` (no dedicated ghats skybox art
exists); fog and lighting were re-tuned away from jungle's values (see log)
because jungle's dense-canopy mood, copied verbatim, fogged out the real
ridgeline this scene exists to show. `lighting.sunDirection` is the one
genuinely site-specific value: derived from Agumbe's real latitude (13.5178N)
at near-overhead solar elevation (~76deg, equinox-local-noon approximation).
`src/scenes-data.js` imports `ghats` and adds it to `RAW_SCENE_CONFIGS` and to
the **front** of `MISSION_ORDER` (`['ghats', 'warzone', ...]`) — matches
`data/campaign.data.js`'s `startNode: 'ghats'`. `data/campaign.data.js`'s `ghats`
node flipped `implemented: false → true`. `tools/gen-pages.mjs` generated
`play/ghats/index.html` from the template (9th arena; sector count strings
bumped 8→9 across all 9 pages, mechanical). `tools/data-to-json.mjs` emits
`data/json/scenes/ghats.json` + a refreshed `campaign.json`.

**Two real bugs found and fixed while chasing the "looks bad" feedback** (see
log for the full trail — this matters for whoever next touches
`_buildHeightmapGround` or `build-albedo.mjs`, GIS-revival or not):
1. `tools/gis/build-albedo.mjs`'s original hard-edged-rectangle speckle texture,
   stretched under 150–200m of real terrain, read as flat mud with no organic
   variation. Rewrote it to multi-octave value noise (`fractalNoise2D`) for
   close-up grain plus a macro elevation tint sampled across the *whole visible
   ring* (not per-texture-tile — an interim per-tile hillshade attempt hit the
   same "DEM is flat under ~400m" finding the P1 spike already made, just at
   texture-tile scale instead of combat-arena scale).
2. **The actual root cause of "flat and murky up close," found after the
   texture rewrite still didn't fix it in-browser:** `_buildHeightmapGround`
   (`src/scenes.js`) set `mat.color = col3(gc.fallbackColor)`
   *unconditionally* on the ground material, rather than only in the albedo
   texture's load-error callback (the pattern the sibling `'texture'` ground
   branch already uses correctly). Since `MeshStandardMaterial.map` multiplies
   against `.color`, this silently crushed the loaded albedo texture toward
   black (`fallbackColor: [0.15, 0.2, 0.11]`) even after it loaded
   successfully — no amount of texture-content tuning could have fixed that.
   Fixed: `mat.color` now starts white, and `fallbackColor` only applies in
   the texture loader's error callback, matching the texture branch. **This
   fix is real and worth keeping regardless of the GIS-pipeline decision above**
   — it's a latent bug in shared engine code, not GIS-specific, and would hit
   any future `ground.type: 'heightmap'` scene the same way.

**Not independently re-verified in-browser after the `mat.color` fix** — the
user is testing manually and has decided to stop iterating on this pipeline
regardless of outcome (see the direction-change note above), so this session
did not spend another verification round-trip on it. `node --check
src/scenes.js` and `gen-pages.mjs --check` both pass; the fix is mechanically
correct (matches the working `'texture'` branch's own pattern exactly) even if
unconfirmed pixel-for-pixel.

**Not done / deliberately left as-is (moot now, but accurate):**
- No dedicated ghats skybox texture — reuses `jungle_sky.png`.
- No `emit-scene.mjs` generator script — hand-authored `ghats.data.js` directly
  instead; `heightmap.json`'s fields don't map mechanically onto
  `lighting`/`perimeter`/`coverBlocks`, those needed human judgment.

**Gate verification, done this session:**
- All 8 arenas load and play unchanged from `data/`: verified live via Playwright
  (real Chrome, `channel: 'chrome'`) — warzone/space/mars/alien/desert/urban/jungle/
  arctic all boot, reach `AW.state === 'playing'`, zero console errors,
  `AWDebug.world.cfg.name` matches each scene's `data/scenes/*.data.js` definition.
  (Earlier sessions had only spot-checked 4/8 after P0.4; this is the first full
  8/8 pass, done after P0.5–P0.7 also landed.)
- `node tools/gen-pages.mjs --check` exits 0.
- `node tools/data-to-json.mjs --check` round-trips clean (20 files: weapons,
  enemies, campaign, 8 scenes, 1 wave set, 8 missions).
- v1 save migrates with unlocks intact, graph AND-gate resolves correctly — both
  verified in P0.6 (throwaway Node scripts + live browser, see that log entry;
  not re-run this session since P0.7/P0.8 didn't touch `save.js` or the graph).

**Status (P0.8):** Docs amended to match reality: `docs/ROADMAP.md` now points to
`docs/v2/ROADMAP-V2.md` as the current plan (old doc kept for historical detail).
`docs/track-a-web-android.md` marked cancelled — Capacitor/Android packaging never
starts, Unity's own Android build (ROADMAP-V2 Phase 6) replaces it — noting the two
items already salvaged into `src/main.js` before the pivot: scene detection
(`detectSceneFromUrl()`) and the save system (superseded again by v2, see P0.6).
Gamepad support (`pollGamepad()`) also already exists but was independent of this
salvage decision, noted separately so it doesn't read as open work.
`docs/track-e-gis.md` records the Option 1 → hybrid softening from the P1 spike:
real DEM relief is imperceptible at combat-arena scale (27.9m/400m) but reads real
at horizon scale (50.3m/1200m), so the revised plan is authored floor + real
horizon, not full real-terrain-with-cover — building-footprint extrusion (OSM) is
deferred, not part of the default site pipeline. `AGENTS.md` gained a **"web
gameplay is frozen"** paragraph up top (repo is now a content-authoring tool; new
gameplay systems belong in `data/` + Unity, not `src/`) and a new `## Content data
(data/)` module-map section describing every `data/` subpath and what consumes it.
**Status (P0.7):** `data/objectives.schema.md` documents the 11-type objective
vocabulary hard cap (`survive_waves`, `kill_count`, `kill_type`, `protect`,
`reach_zone`, `time_limit`, `no_damage`, `weapon_restriction`, `destroy_targets`,
`rescue`, `escort`) with each type's fields and meaning, per ROADMAP-V2 §4.3.
`data/missions/<id>.data.js` ×8: `m101` (warzone), `m102` (desert), `m201` (urban),
`m202` (arctic), `m301` (alien), `m401` (grid — the scripted-defeat mission, `outcome:
'scripted_defeat'` + `finale` block matching §4.4's example exactly), `m501` (space),
`m601` (mars). Each has `node` (campaign graph id), `scene`, `briefing`/`debrief`
(CREON-voiced, short), `waveSet: 'classic_10'` (the only wave set that exists),
`objectives` (one required `survive_waves:10` + one `optional:true` flavor objective
per site mission — kept intentionally simple since `protect`/`destroy_targets`/
`rescue`/`escort` all depend on the `Target`/`Entity` primitives from track-b §2.5,
**not built**; this task only authors shape), and `rewards.unlockNode` pointing at
the next campaign node. Missions map 1:1 to the 7 `implemented:true` nodes in
`data/campaign.data.js` (warzone/desert/urban/arctic/alien/grid/space) plus `mars`
(implemented:true but `locked:true` in the graph — mission authored anyway so the
reward chain is complete; the lock is a presentation gate, not a missing mission).
`jungle` (`data/scenes/jungle.data.js`) has **no** mission — it has no campaign node
(superseded by the `ghats`/`ghats_east` split, both still `implemented:false`); see
P0.4's note below, unchanged. `tools/validate-missions.mjs` (new, zero-dep, same
conventions as `gen-pages.mjs`/`data-to-json.mjs`) checks every mission's
`objectives[].type` against the 11-type table and every `rewards.unlockNode` /
`node` against `data/campaign.data.js`'s node ids, plus that any `outcome:
'scripted_defeat'` mission has a `finale` block. All 8 pass. `node
tools/data-to-json.mjs` emits `data/json/missions/*.json` for all 8 (`m601`'s
`rewards.unlockNode: null` — mars has no next node — round-trips fine, `null` is a
valid JSON literal). `--check` on both `data-to-json.mjs` and `gen-pages.mjs` still
exit 0 (this task touched no scene/page files).
**Last commit:** (this session) P0.8 docs amendment + GATE P0 verification.

### What P0.2–P0.6 built (prior sessions)

`WEAPONS`, `SCORE_VALUES`, `ENEMY_TYPES`, `WAVE_CONFIGS`, and
`SCENE_CONFIGS` are all externalized. `data/enemies.data.js` holds the full per-type
enemy definitions (hp/speed/damage/etc.) with `score` folded in as one more field per
type — no separate lookup. `data/waves/classic_10.data.js` holds the original 10-wave
array; `WaveManager` gained a `waveSet` field (defaults `'classic_10'`) and a
`getWaveConfig(n)` method that looks it up from a `WAVE_SETS` map in `src/enemies.js`.
`data/scenes/<slug>.data.js` ×8 (warzone, space, mars, alien, desert, urban, jungle,
arctic) hold the full per-arena config (sky/lighting/ground/perimeter/spawn/sceneAssets/
coverBlocks/props/background) as JSON-literals; `src/scenes-data.js` is now a ~55-line
loader that imports all 8, resolves `previewImage` against `ASSET_BASE` (the only field
that needed absolute-URL resolution — `textureUrl`/`sceneAssets[].file` stay relative,
resolved later by `src/scenes.js`), and re-exports the same
`SCENE_CONFIGS`/`DEFAULT_SCENE`/`MISSION_ORDER`/`SCENE_MODEL_BASE`/`SCENE_TEXTURE_BASE`/
`ASSET_BASE` surface it always did.
`data/campaign.data.js` now holds the 11-node campaign graph (§4.2) — `ghats`,
`ghats_east`, `warzone`, `desert`, `urban`, `arctic`, `ocean`, `alien`, `grid`, `space`,
`mars` — each with `requires`/`unlocks`/`act`/`map:{x,y,label}`, plus `implemented:false`
on the 4 sites with no `data/scenes/` entry yet (`ghats`, `ghats_east`, `ocean`, `grid`),
`outcome:'scripted_defeat'` on `grid`, and `locked:true`+`lockedReason` on `mars`.
`src/save.js` is now `v:2` — added `progress.nodesUnlocked`/`nodesCompleted`/`currentNode`
alongside the untouched v1 `arenasUnlocked`/`missionsCompleted` fields (which
`buildScenePicker()` in `src/main.js` still reads directly — graph-driven hub UI is P4.1,
not this file). `migrateV1()` derives the new fields from a v1 blob's
`missionsCompleted`/`arenasUnlocked` instead of discarding it (the old `parsed.v !== 1 →
defaults()` wipe is gone). `completeNode(nodeId)` marks a node completed then unions in
every node whose `requires` (AND-list) are now satisfied by `nodesCompleted` — this is the
graph-aware unlock, distinct from `nodesUnlocked` which the `UNLOCK_ALL_NODES` testing
flag can pre-seed independent of real completion. `unlockNext()` (the old v1 API,
`src/main.js:1197` still calls it on `gameWin()`) is kept as a shim — does exactly what it
always did to the v1 fields, and additionally calls `completeNode()` so the graph fields
advance too when the completed scene is also a campaign node (true for all 8 today).
`UNLOCK_ALL_ARENAS` renamed `UNLOCK_ALL_NODES`, still `true` (left on for authoring),
now also blanket-unlocks every campaign node, not just arenas.

P1's heightmap ground engine code (`_buildHeightmapGround()` in `src/scenes.js`, P1.4)
still exists and is still **unwired and unverified in the browser** — no scene config sets
`ground.type: 'heightmap'` yet. That's P1.5, blocked until P0.4 gives `ghats` a proper
`data/scenes/` slot instead of hand-adding it to today's `scenes-data.js`.

`tools/gis/cache/` is gitignored (confirmed via `git check-ignore`). `assets/terrain/` is
**not** gitignored — baked outputs commit (confirmed via `git check-ignore -v`, exit 1).
Spike decoders are preserved in `docs/v2/spike/` — already ported, keep them as reference
only from here.

### What P0.1 built

- `data/README.md` — the contract: one `export default {...}` per file, JSON-literal
  shape only (no functions/imports/computed values), kept as `.data.js` not `.json` so a
  plain `import` needs no fetch (same reasoning as `ASSET_BASE`).
- `tools/data-to-json.mjs` — recursively finds `data/**/*.data.js` (skipping `data/json/`
  itself), imports each default export, and mirrors it to `data/json/<same path>.json`.
  Follows `gen-pages.mjs` conventions: `--check` (diffs against what's on disk, no
  writes), `--dry-run`. **Catches contract violations with a precise key path** —
  `findNonJsonLiteral()` walks the value looking for functions/`undefined`/symbols/bigints
  before serializing, because `JSON.stringify` alone silently *omits* those instead of
  erroring, which would have made a violation invisible. Smoke-tested against a throwaway
  `data/_smoketest/*.data.js` (good value round-trips, bad value fails with
  `$.fn is a function`, edited value shows `STALE` under `--check`) — removed after
  verifying, `data/` is genuinely empty again.
- **Bug caught while testing**: the header comment's own usage line originally wrote the
  glob `data/**/*.data.js` — inside a `/* */` block that `**/*` sequence contains a literal
  `*/`, closing the comment early and breaking as a syntax error. Reworded to
  `data/.../*.data.js`. Worth remembering for any future header comment that wants to
  write a real double-star glob.

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

**The plan is current. Build, don't re-plan.** Read `docs/v2/TASKS.md` Phase 1.9,
then start **P1.9.1**.

**P1.9.1 — retire ghats, promote `jungle` to start node** (·S, web repo):
- `data/campaign.data.js`: delete the `ghats` and `ghats_east` nodes; add a
  `jungle` node — `implemented: true`, `unlocks: ['warzone', 'desert']`,
  `startNode: 'jungle'`. Check `requires` on `warzone`/`desert` still resolve
  (they currently point at `ghats_east`).
- `src/scenes-data.js`: drop `ghats` from `MISSION_ORDER`, lead with `jungle`.
  **Keep the `ghats` import and its scene config** — the scene stays playable at
  `/play/ghats/`, it just leaves the campaign (Appendix A).
- Author `data/missions/m001.data.js` for `jungle` — it has never had a mission
  (see the P0.7 note below; that orphan is exactly why `jungle` is now the opener).
- **Sector-count copy is hardcoded in all HTML pages** (`8 SECTORS`, currently
  bumped to 9 by P1.5) — recount and update by hand, per AGENTS.md.
- Verify: `node tools/validate-missions.mjs`, `node tools/data-to-json.mjs
  --check`, `node tools/gen-pages.mjs --check`, and open the hub to confirm
  `jungle` leads.

Then **P1.9.2** (wire per-scene `waveSet` — the one-line change P0.3 left ready,
see its note below) and **P1.9.3** (author `ocean` + `grid`). The user offered to
**generate AI concept art for `ocean` and `space`** — worth taking up before the
`ocean` layout pass, via `tools/gen-art.mjs`.

**Do not start Unity (Phase 2) until P1.9 lands** — P2.2 is the data importer, and
importing a stale campaign graph would mean redoing it.

**Untouched by the re-plan:** `data/`'s content-authoring contract (P0),
`save.js` v2, the campaign graph *mechanism* (only its node list changes), and the
mission schema — none of that assumed GIS terrain.

### P0.8 note for whoever starts P1.5 or any future doc-facing session

`AGENTS.md` now opens with a "web gameplay is frozen" paragraph — P1.5 is
explicitly-scoped `docs/v2/` task work (wiring a GIS site preview), which that
paragraph carves out as still in scope; don't read it as blocking this task.
`docs/ROADMAP.md`/`docs/track-a-web-android.md`/`docs/track-e-gis.md` were amended
to point at ROADMAP-V2 and record decisions already made in this file's log — no
new decisions were made in P0.8 itself, just documentation catching up to state.

### P0.7 note for whoever writes P0.8 (docs) or later touches missions

`data/missions/*.data.js` ×8 map 1:1 to the 7 `implemented:true` campaign nodes
(warzone/desert/urban/arctic/alien/grid/space) plus `mars` (implemented but
`locked:true` — mission written anyway). **`jungle` has no mission** — it has no
campaign node (superseded by the unsplit `ghats`/`ghats_east`, both
`implemented:false`); don't be surprised `data/scenes/jungle.data.js` is orphaned from
the mission/campaign layer, that's expected until P1.5 or a future ghats task retires
it properly. Only `m301` (alien)'s debrief foreshadows the Grid's scripted defeat —
§4.4 asks for **two** prior foreshadows (ocean + alien) but `ocean` has no mission yet
(`implemented:false`), so the second foreshadow is a TODO for whoever authors `ocean`'s
mission once that site ships. `objectives`/`rewards`/`finale` shapes match
`docs/track-b-content.md` §2.1 and ROADMAP-V2 §4.4 verbatim, including `m401`'s finale
block (`trigger`/`script`/`playerAgency`/`defeatAfterMs`) copied as given. **No mission
runtime exists** — `protect`/`destroy_targets`/`rescue`/`escort` objectives are
authored as data only; they depend on the `Target`/`Entity` primitives from
track-b §2.5, which is Unity/Phase-3 work (P3.7), not this repo today.
`tools/validate-missions.mjs` is the new checker — run it after editing any mission or
`data/campaign.data.js`'s node list.

### P0.6 note for whoever writes P0.7

`completeNode()`'s unlock scan is O(nodes), fine at 11 nodes — don't worry about it at
this scale. If P0.7's missions want to call `Save.completeNode()` on mission-complete
(via `rewards.unlockNode`), note `completeNode(nodeId)` takes the **node id being
completed**, not the node it unlocks — `rewards.unlockNode` in a mission file names what
*should* become reachable, but the actual unlock still flows through completing the
node the mission belongs to, same AND-gate-checked way. Don't wire a mission to directly
force-unlock a node — let `completeNode()`'s requires-scan do it, or the AND-gate on
nodes like `ocean` breaks.

`src/save.js`'s `campaign.nodes[completedSceneId]` check in `unlockNext()` assumes every
scene id equals a campaign node id — true today (all 8 implemented arenas share their id
with a `data/campaign.data.js` node) but worth re-checking if a future scene/node ever
diverge (e.g. one scene reused across two narrative nodes).

### P0.5 note (still relevant)

`data/campaign.data.js` graph validated with a throwaway Node script (no cycles, all
`requires`/`unlocks` targets exist, `ocean`'s AND-gate correctly stays locked with only
`urban` complete and unlocks with `urban`+`arctic`) — script was deleted after, not
committed. `act` values are `act01`..`act06` (six acts, not one per node). `map:{x,y,label}`
coordinates are placeholders — P4.1 (hub map UI) is free to override them wholesale.

### P0.4 note for whoever writes `ghats.data.js` (P0.5/P1.5)

`data/scenes/` didn't get a `ghats.data.js` slot in P0.4 itself — P0.4 only split the 8
arenas that already existed in the old `SCENE_CONFIGS`. `ghats` doesn't exist as a scene
config yet; it's P0.5's job to add the graph node (`implemented:false`), and P1.5's job
to `emit-scene.mjs` a real `data/scenes/ghats.data.js` once P1.4's heightmap ground code
gets its first live render. Nothing about the P0.4 split changes that plan.

### P0.3 wiring note for whoever touches enemies.js next

`WaveManager.waveSet` is a plain field, not yet settable from scene config — every arena
still plays `classic_10`. If a future task (P0.4/scenes or later) wants a per-arena wave
set, set `WaveManager.waveSet = sceneConfig.waveSet || 'classic_10'` before
`startWave()`; `getWaveConfig()` already falls back to `classic_10` if the id is missing
from `WAVE_SETS`, so this is additive, not a schema break.

**P0.4 note relevant to P1**: when this splits `SCENE_CONFIGS`, the split should produce a
`data/scenes/ghats.data.js` slot even though `ghats` doesn't exist as a playable site yet
(`implemented:false` per P0.5's node-graph task) — that's the natural point to resume
P1.5 instead of hand-editing `scenes-data.js` directly.

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
- **2026-08-17** — P0.1: `data/README.md` (the content contract) + `tools/data-to-json.mjs`
  (recursive `.data.js` → `data/json/*.json` mirror, `--check`/`--dry-run`, precise
  contract-violation errors via a hand-rolled JSON-literal walk since `JSON.stringify`
  silently drops functions/`undefined` instead of erroring). `--check` passes clean on
  empty `data/`. Smoke-tested with a throwaway file, removed after — `data/` still empty,
  which is correct for this task (P0.2 is what actually externalizes anything).
- **2026-08-17** — P0.2: `WEAPONS` → `data/weapons.data.js`; `SCORE_VALUES` → derived at
  import time from a new `data/enemies.data.js` (score-only stub, `{scout:{score:100},
  ...}` — P0.3 fills in the rest of `ENEMY_TYPES`). `src/main.js` imports both;
  `HUD.init(AW, WEAPONS)` needed no change (already takes `WEAPONS` by injection).
  `data-to-json.mjs --check` and `gen-pages.mjs --check` both pass. Verified live in
  `/play/warzone/` via Playwright (installed to the session scratchpad, not the repo):
  entered the arena, confirmed weapon switch via mouse wheel **and** number keys
  (RIFLE→SHOTGUN→MINIGUN→...), ammo counts match `weapons.data.js` (30/8/100), shotgun
  fire-to-empty→auto-reload→`R`-reload all correct, zero console errors throughout.
  Did not land a kill on a moving enemy (blind Playwright aim vs. cover-seeking AI), so
  score-increment-on-kill was verified by static derivation check instead (`SCORE_VALUES`
  computed from the new file matches the original literal exactly) plus reading
  `addScore()` — no behavior change there, only where `SCORE_VALUES` comes from.
- **2026-08-17** — P0.4: `SCENE_CONFIGS` (1,501 LOC) split into `data/scenes/<slug>.data.js`
  ×8 (warzone, space, mars, alien, desert, urban, jungle, arctic), one `export default`
  JSON-literal per arena. Used a throwaway extraction script (imported the live
  `SCENE_CONFIGS`, walked it to a literal-syntax string, wrote each file, deleted the
  script after) rather than hand-copying 1,500 lines — lower risk of transcription
  errors. `previewImage` was the only field that needed un-resolving back to an
  `ASSET_BASE`-relative path (it was the sole field pre-resolved to an absolute URL in
  the old inline object; `textureUrl`/`sceneAssets[].file` were already relative,
  unchanged). `spawn.arcAngle`'s `Math.PI * 1.1`-style expressions bake to plain float
  literals in the data files — contract-compliant, and `src/enemies.js` only ever reads
  `arcAngle` as a number so this is not a behavior change. `src/scenes-data.js` is now a
  ~55-line loader: imports the 8 files, resolves `previewImage`, re-exports the exact
  same surface. **Verified byte-identical**: a structural diff of the old file's live
  `SCENE_CONFIGS` against the new loader's merged output matched on every field except
  `previewImage`'s absolute URL prefix (an artifact of the verification script's own file
  location changing `import.meta.url`, not a real difference — confirmed by checking the
  relative-path suffix matched). `gen-pages.mjs --check` exits 0, `data-to-json.mjs`
  round-trips (new `data/json/scenes/*.json` written and re-checked clean),
  `stamp-assets.mjs --dry-run` resolves all 9 pages. Live-verified in-browser via a
  subagent driving real Chrome through Playwright: warzone/space/mars/alien all boot,
  start, reach `'playing'`, zero console errors, and `AWDebug.world.cfg` shows correct
  per-arena data (ground type, spawn config, sceneAssets count, name) for each. Did not
  re-verify all 8 in-browser (4 of 8, spanning `procedural`/`texture` ground types and
  different sceneAssets counts, was enough given the structural diff already proved
  byte-identical data). No `ghats.data.js` added — P0.4 only covers the 8 arenas that
  existed in the old `SCENE_CONFIGS`; adding `ghats` is P0.5/P1.5's job.
- **2026-08-17** — P0.3: `ENEMY_TYPES` folded into `data/enemies.data.js` alongside the
  `score` field added in P0.2 (one object per type, not two lookups). `WAVE_CONFIGS` →
  `data/waves/classic_10.data.js`, byte-identical to the original array (diffed via
  `JSON.stringify` equality in Node). `src/enemies.js` gained a `WAVE_SETS` map (currently
  just `{ classic_10 }`) and `WaveManager.getWaveConfig(n)` / `.waveSet` (defaults
  `'classic_10'`); `startWave()` and `src/main.js`'s `showWavePreview()` both call the new
  method instead of indexing the old exported array. Verified live in `/play/warzone/`:
  `WaveManager.getWaveConfig(n)` for all 10 waves matches the original table exactly (boss
  only on wave 10), `ENEMY_TYPES` has all 5 keys with correct score/hp, and — the actual
  gameplay check — wave 1 spawned exactly 3 scouts (`activeEnemies` inspected directly),
  zero console errors. Did not run a full real-time 10-wave clear (would take many
  minutes per wave with no dev fast-forward available); confidence instead comes from
  every wave's config matching byte-for-byte plus wave 1's actual spawn behavior
  confirming the wiring executes correctly, not just that the data is well-formed.
- **2026-08-17** — P0.5: `data/campaign.data.js` — the 11-node campaign graph from
  ROADMAP-V2 §4.2/§3 (ghats → ghats_east → {warzone, desert} → {urban, arctic} → ocean
  [AND-gate] → alien → grid [scripted defeat] → space → mars [locked]). `implemented:false`
  on the 4 sites with no `data/scenes/` slot yet (ghats, ghats_east, ocean, grid); the 7
  existing arenas (warzone/desert/urban/arctic/alien/space/mars) marked `implemented:true`.
  Verified with a throwaway Node script: no cycles, every `requires`/`unlocks` target
  resolves, and the `ocean` AND-gate behaves correctly (locked with only `urban` complete,
  unlocks with `urban`+`arctic`) — script deleted after, not committed. `node
  tools/data-to-json.mjs` and `--check` both pass (new `data/json/campaign.json`
  generated and round-trips clean); `gen-pages.mjs --check` unaffected (still 0, this task
  didn't touch scenes). Nothing in `src/` consumes the graph yet — that's P0.6.
- **2026-08-17** — P0.6: `src/save.js` bumped to `v:2`. Added `migrateV1()` — a v1 blob's
  `missionsCompleted`/`arenasUnlocked` now derive `nodesCompleted`/`nodesUnlocked`/
  `currentNode` instead of being discarded (old code did `parsed.v !== 1 → defaults()`,
  which would have wiped real progress on every future version bump). Added
  `completeNode(nodeId)`, the graph-aware unlock: marks a node completed, then unions in
  every node whose `requires` are now fully satisfied by `nodesCompleted`. Kept
  `unlockNext()` as a back-compat shim for `src/main.js`'s `gameWin()` — untouched v1
  behavior, plus now also calls `completeNode()` so graph fields advance in lockstep.
  Renamed `UNLOCK_ALL_ARENAS` → `UNLOCK_ALL_NODES` (still `true`), now blanket-unlocks
  campaign nodes too. Tested with two isolated Node scripts using a `localStorage` shim
  (deleted after, not committed): a hand-seeded v1 blob migrates correctly with real
  settings/stats/progress preserved (both with the unlock flag on and off), and
  `completeNode('urban')` then `completeNode('arctic')` unlocks `ocean` while
  `completeNode('urban')` alone does not — the AND-gate, exercised both through
  `nodesUnlocked` state and independently via `campaign.nodes[id].requires.every(...)`
  math. Live-verified in a real browser via Playwright: hub picker renders all 8 cards,
  `/play/warzone/` boots to `AW.state === 'playing'` with zero console errors throughout,
  and a forced settings-patch write round-trips valid `v:2` JSON in `localStorage` with
  `nodesUnlocked`/`nodesCompleted`/`currentNode` all present and correctly populated.
  `gen-pages.mjs --check` and `data-to-json.mjs --check` both still pass (this task
  touched no `data/` files). `buildScenePicker()`/hub UI unchanged — still reads the v1
  fields directly, as intended; graph-driven hub UI is P4.1.
- **2026-08-17** — P0.7: `data/objectives.schema.md` (11-type objective vocabulary
  table, ROADMAP-V2 §4.3, hard cap). `data/missions/<id>.data.js` ×8 — `m101`(warzone),
  `m102`(desert), `m201`(urban), `m202`(arctic), `m301`(alien), `m401`(grid, the
  scripted-defeat mission with `outcome`+`finale` matching §4.4's example verbatim),
  `m501`(space), `m601`(mars) — each with `node`/`scene`/`briefing`/`waveSet:
  'classic_10'`/`objectives`/`rewards.unlockNode`/`debrief`. New
  `tools/validate-missions.mjs` (zero-dep, same conventions as `gen-pages.mjs`) checks
  every `objectives[].type` against the 11-type table and every `node`/
  `rewards.unlockNode` against `data/campaign.data.js`'s node ids, plus that
  `scripted_defeat` missions carry a `finale` block — all 8 pass. `data-to-json.mjs`
  and its `--check` both pass (8 new `data/json/missions/*.json`, including `m601`'s
  `rewards.unlockNode: null` round-tripping as valid JSON). `gen-pages.mjs --check`
  unaffected (0, no scene/page files touched). `jungle` deliberately has no mission —
  no campaign node exists for it yet. Only one of the two §4.4-requested prior
  foreshadows landed (`m301`/alien) since `ocean` has no mission yet
  (`implemented:false`) — flagged as a TODO in "Next session" for whoever authors
  `ocean`. No runtime wiring — Unity implements missions later (P3.1/P3.7); this task
  is data + validation only, consistent with the task's own scope.
- **2026-08-17** — P0.8 + **GATE P0 verified and passed**. Docs: `docs/ROADMAP.md`
  now points to `docs/v2/ROADMAP-V2.md` as the current plan.
  `docs/track-a-web-android.md` marked cancelled (Capacitor/Android replaced by
  Unity's own Android build), noting the two items already salvaged into
  `src/main.js` pre-pivot (scene detection, save system — the latter superseded
  again by v2) and separately noting gamepad support already exists too.
  `docs/track-e-gis.md` records the authored-floor + real-horizon hybrid decision
  from the P1 feasibility spike (already in this log under 2026-08-16), replacing
  the original "Option 1" full-real-terrain framing; OSM building-footprint
  extrusion deferred, not default. `AGENTS.md` gained a "web gameplay is frozen"
  paragraph (repo is now a content-authoring tool; new gameplay work goes in
  `data/` + Unity) and a `## Content data (data/)` module-map section. Gate
  verification: a subagent drove real Chrome via Playwright through all 8 arenas
  (warzone/space/mars/alien/desert/urban/jungle/arctic) with a seeded
  `mw.save.v1` unlocking all slugs — all 8 reach `AW.state === 'playing'` with
  zero console errors and `AWDebug.world.cfg.name` matching each scene's `data/`
  definition (first full 8/8 pass; earlier sessions only spot-checked 4/8).
  `gen-pages.mjs --check` and `data-to-json.mjs --check` both exit 0 (20 files).
  v1 save migration and the AND-gate were verified in P0.6 and not re-run here
  since nothing touched `save.js`/`campaign.data.js` since. **All four GATE P0
  conditions hold — Phase 1 is unblocked.**
- **2026-08-17** — P1.5: `data/scenes/ghats.data.js` authored by hand (no
  `emit-scene.mjs` generator built — see "Not done" above for why). `ground.type:
  'heightmap'` wired to P1.3's `assets/terrain/ghats/` bake,
  `visibleRadiusM: 200`/`flatZoneRadius: 68`, hand-placed cover/props inside the
  authored floor per plan §5.4. Sky/lighting/palette reused from
  `jungle.data.js` except `sunDirection`, derived from ghats's real latitude.
  `src/scenes-data.js` gained the `ghats` import and put it first in
  `MISSION_ORDER` (matches `campaign.data.js`'s `startNode`).
  `campaign.data.js`'s `ghats` node flipped to `implemented: true`.
  `gen-pages.mjs` generated `play/ghats/index.html` (9th arena; sector counts
  8→9 across all pages, mechanical). `data-to-json.mjs`/`--check`,
  `gen-pages.mjs --check`, and `stamp-assets.mjs` all clean. **First live
  render of P1.4's heightmap ground code**, verified via Playwright/real
  Chrome: reaches `playing` state with zero console errors, all three terrain
  files fetch 200, and direct mesh inspection confirms genuine per-vertex
  displacement (Y range 0–48.4m) with the albedo texture loaded — not a flat
  placeholder. Screenshot shows a real ridgeline silhouette on both horizons
  above a playable, hand-authored combat floor.
- **2026-08-17 (continued)** — User on the P1.5 screenshot: "that actually
  looks pretty bad." Two real fix rounds, each re-verified live via
  Playwright: (1) fog density 0.014→0.004 + brighter `lighting` (jungle's
  values were tuned for an 80m arena, not a 150–200m visible ring — fixed
  sky/horizon visibility, ground still looked flat/muddy); (2) rewrote
  `build-albedo.mjs`'s texture from hard-edged rectangle speckle to
  `fractalNoise2D` organic noise + a macro elevation tint correctly scaled to
  the ground mesh's real tile size (new `sites.data.js` fields
  `groundVisibleRadiusM`/`groundTextureRepeats` — an interim per-tile
  hillshade attempt got the scale wrong by ~6x and separately hit "DEM is flat
  under ~400m" at texture-tile scale, same finding as the original P1 spike).
  The rewritten texture looked correct in a static preview but **still looked
  flat/murky in-browser**, which surfaced the actual bug: `_buildHeightmapGround`
  (`src/scenes.js`) set `mat.color = fallbackColor` unconditionally instead of
  only in the texture load's error callback (unlike the sibling `'texture'`
  branch) — `MeshStandardMaterial.map` multiplies against `.color`, so the
  loaded albedo was being crushed toward near-black (`fallbackColor: [0.15,
  0.2, 0.11]`) regardless of what the texture actually contained. Fixed to
  match the working branch's pattern. This fix is a real, general engine bug
  (not GIS-specific) and is committed on that basis; it was not independently
  re-verified in-browser this session (see below). `visibleRadiusM` also
  raised 150→200 as part of round (1). User then decided — independent of
  whether this last fix looks good, and reasoning that the GIS pipeline was
  always meant to be evaluated as "does real terrain data make the game look
  more modern," not pursued as an end in itself — that the **hand-authored
  (v1) arena style is the real path forward into Unity**, and to stop
  iterating on the GIS/DEM terrain pipeline here; it stays in the repo as a
  working research track. Session ends with the `mat.color` fix committed but
  unconfirmed pixel-for-pixel, and `docs/v2/TASKS.md`/ROADMAP-V2's Phase 1
  (P1.6, GATE P1) and Phase 2 rows flagged stale pending a re-plan — see the
  "⚠️ Direction change" note in "Current state" and "Next session" above.
- **2026-08-17 (planning session)** — **Re-planned Phase 2+ around hand-authored
  arenas.** No code touched; this was the planning session the previous handoff
  called for. `docs/v2/ROADMAP-V2.md`: new **§1.5** decision record (GIS is not
  the terrain source — GATE P1 answered "no", fallback taken as written), new
  **Appendix A** preserving the GIS track's two durable findings (DEM flat under
  ~400m; the `mat.color` multiply bug) and an inventory of what stays on disk;
  **§3 roster** rewritten 11 sites → 9 (`ghats`/`ghats_east` retired, `jungle`
  promoted to start node, `ocean`+`grid` net-new, `space` reworked); new **§3.1**
  making per-site mechanical variation a stated requirement with the rule that it
  must be expressible as `waveSet` + enemy types + layout; new **§3.2** scoping
  `space` as 6DOF ship combat with an explicit foot-soldier fallback; **§8 phase
  table** rebuilt (Phase 2 = scaffold + importer + perf gate, importer moved up
  from P3.1; new cuttable Phase 5 for 6DOF placed *after* the MSP gate so the
  ending ships either way; old P5→P6, P6→P7, P7→P8); **§9 risks** updated — risk 4
  (GIS hypothesis) marked RESOLVED-and-false as evidence the gate structure works,
  two new risks added (6DOF on the finale; "plays differently" quietly becoming
  "needs new systems"). `docs/v2/TASKS.md`: Phase 1 marked closed with P1.6
  **dropped** (no GIS artifact ships → no attribution obligation), new **Phase
  1.9** added (retire ghats + promote jungle + author its mission; wire per-scene
  `waveSet`; author `ocean`+`grid`) as the immediate next work and a blocker on
  the Unity importer, Phases 2–8 rewritten/renumbered, progress table updated.
  Estimate: retiring GIS + two sites took ~8–12 weeks out of the plan. Decisions
  were made interactively with the user, not unilaterally — the roster, the
  `space` movement model, and the ocean-base framing (launch grid, not oil rig)
  are all as specified by them.
