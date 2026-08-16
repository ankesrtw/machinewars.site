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

**Phase:** P1 — GIS pipeline + first site (web preview)
**Status:** P1.1 + P1.2 + P1.3 done. Ghats heightmap + albedo baked to
`assets/terrain/ghats/`, metadata round-trips against the live decoder.
**Last commit:** (this session) P1.3 build-heightmap.mjs + build-albedo.mjs

`tools/gis/cache/` is gitignored (confirmed via `git check-ignore`). `assets/terrain/` is
**not** gitignored — baked outputs commit (confirmed via `git check-ignore -v`, exit 1).
Spike decoders are preserved in `docs/v2/spike/` — already ported, keep them as reference
only from here.

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

**Task: P1.4** (see `docs/v2/TASKS.md`) — the `ground.type: 'heightmap'` branch in
`src/scenes.js:280` (`_buildGround()`). Re-read "Watch out for" below before touching it —
far plane is 400, and this must be the *only* engine change P1 requires.

1. Read `assets/terrain/ghats/heightmap.json` + `albedo.json` — both exist now, written
   this session. `heightmap.json.notes` spells out the denormalization formula
   (`meters = elevationMin + (texel/65535) * elevationRange`); `metersPerTexel *
   (size-1) === extentM`, the square ground footprint centered on `originLatLon`.
2. New branch in `_buildGround()`: when `gc.type === 'heightmap'`, load
   `heightmap.png`/`heightmap.json` for the site instead of the seeded-noise
   displacement, size the `PlaneGeometry` to `extentM`, displace vertices from the
   16-bit texel values (denormalized per the formula above), and use `albedo.png` as
   the texture map (same texture-load path already used for `gc.type === 'texture'`).
3. **Watch the far-plane mismatch**: `horizonExtentM` is 2400 but camera far plane is
   400 (`src/main.js`) — per plan §5.4/HANDOFF's own prior note, the visible heightmap
   ring must be clipped to fit inside 400, or the far plane becomes a quality-preset
   field first. Decide which before wiring the scene; don't let terrain silently vanish
   past the far plane like the CREON billboard bug.
4. Verify: existing 8 arenas unaffected (`node tools/gen-pages.mjs --check` + open one
   arena), and a heightmap ground renders in a throwaway test scene or a minimal
   `data/scenes/ghats` stub (full stub is P1.5's job — don't build it early here).

**Done when:** the existing 8 arenas are unaffected and a heightmap ground renders (per
`TASKS.md`).

**Then P1.5** — `emit-scene.mjs` → `data/scenes/ghats.data.js`, hand-authored playable box.

### Watch out for

- `tools/gis/cache/` must be gitignored **before** the first fetch, or tiles land in git.
- Camera far plane is **400** (`src/main.js`). Terrain beyond it is silently clipped —
  this is exactly what made the first CREON billboard invisible. The "real horizon" ring
  must sit inside 400, or the far plane must become a quality-preset field first.
- `_buildGround()` (`src/scenes.js:280`) currently displaces a `PlaneGeometry` with
  seeded random noise. The heightmap branch replaces the *displacement source*, not the
  mesh strategy — keep it that contained (plan §5.5: the heightmap branch must be the
  **only** engine change P1 requires).

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
