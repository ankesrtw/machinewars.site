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
**Status:** P1.1 + P1.2 done. Ghats DEM tiles fetch + decode; regression numbers hold.
**Last commit:** (this session) Port DEM fetch/decode tooling from the spike

`tools/gis/cache/` is gitignored (confirmed via `git check-ignore`). Spike decoders are
preserved in `docs/v2/spike/` — already ported, keep them as reference only from here.

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

**Task: P1.3** (see `docs/v2/TASKS.md`) — `build-heightmap.mjs` + `build-albedo.mjs`.

1. `tools/gis/build-heightmap.mjs` — import `loadMosaic`/`windowStats` from
   `tools/gis/decode-terrarium.mjs` (already exported for this). Crop the mosaic to
   `horizonExtentM` around the site center, resample to 1025² or 2049², write as a
   16-bit PNG to `assets/terrain/ghats/`. Write the metadata JSON alongside it — **get
   this right, it's what makes the file portable to Unity later**: m/px, min/max
   elevation (already computed by `windowStats`), origin lat/lon, the extent it covers.
2. `tools/gis/build-albedo.mjs` needs imagery this session doesn't have —
   `fetch-imagery.mjs` (Sentinel-2) was deliberately skipped in P1.2 (see note above). Two
   options: build `fetch-imagery.mjs` first, or ship P1.3 with a flat/graded procedural
   albedo keyed off the biome palette and defer real imagery. Decide before starting;
   don't let it block the heightmap half.
3. Test the output round-trips: read the metadata JSON back, confirm min/max elevation
   matches what `decode-terrarium.mjs --site=ghats` printed this session.

**Done when:** Ghats heightmap + albedo exist in `assets/terrain/ghats/` with metadata
that round-trips (per `TASKS.md`).

**Then P1.4** — the `ground.type: 'heightmap'` branch in `src/scenes.js:280`. Re-read
"Watch out for" below before touching it — far plane is 400, and this must be the
*only* engine change P1 requires.

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
