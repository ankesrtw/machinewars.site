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
**Status:** Spike complete, feasibility proven. No code written yet.
**Last commit:** `f42655a` Add Ocean Base and The Creon Grid as locked placeholder tiles

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

**Task: P1.1 + P1.2** (see `docs/v2/TASKS.md`). Goal for the session: tiles fetched and
decoded to elevation by committed tooling.

1. `tools/gis/sites.data.js` — roster as data. Seed `ghats` with the verified bbox around
   13.5178N / 75.0906E. Include `playableExtentM` and a `horizonExtentM` (the split above
   means these are two different numbers — ~400 and ~2400).
2. `tools/gis/cache/` + **add to `.gitignore`** before the first fetch.
3. `tools/gis/fetch-dem.mjs` — lat/lon/zoom → tile math → download 3×3 (or NxN) mosaic to
   cache. Idempotent: skip existing unless `--force`, like `tools/gen-art.mjs`. Follow
   `tools/gen-pages.mjs` conventions — Node ESM, zero deps, shebang, `--dry-run`/`--check`,
   header comment explaining *why*.
4. `tools/gis/decode-terrarium.mjs` — the PNG→elevation decoder. **A working version
   exists** in the scratchpad from the spike; port it rather than rewriting:
   `C:\Users\Thinkpad\AppData\Local\Temp\claude\d--ai-projects-machinewars-site\bd036325-1045-4db4-83af-2356fe948f1a\scratchpad\window.mjs`
   (has tile mosaicking + the ASCII preview, which is genuinely useful for eyeballing a
   new site before rendering it). **Copy it out before the scratchpad is cleaned.**

**Done when:** `node tools/gis/fetch-dem.mjs --site=ghats` populates the cache, a re-run
downloads nothing, and the decoder prints the same `relief: 27.9m` for the 400m window
and `50.3m` for 1200m. Those two numbers are the regression test.

**Then P1.3** (heightmap + metadata emit) — and get the metadata right: m/px, min/max
elevation, origin lat/lon. **That JSON is what makes the artifact portable to Unity**, so
it is not a detail to defer.

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
