# Track D — Robot assets

Continuous, weeks 2–10. See [ROADMAP.md](ROADMAP.md).

**Do this early.** Better robots improve the live web game, the Android build,
*and* become the Unity asset library. It is the one track that pays into all
three.

---

## Current state

14 Draco GLBs in `assets/models/`, 6.7MB total. Only **`scout`, `grunt`, and
`heavy` have real models** — **`drone` and `boss` have no GLB at all** and
always render as procedural primitives from `_walkerGeo()` (`src/enemies.js:66`).

The GLBs were Draco-compressed **without normal attributes**, so they would
shade pure black; `ensureNormals()` (`src/gltf.js:25`) recomputes them at load.
That is a symptom of a rough export pipeline, and fixing it at the source
removes a load-bearing workaround.

---

## Pipeline

**Tripo3D (generate + retopo + segmentation) → Blender (cleanup, LODs, UVs,
export).**

### 1. Regenerate rather than repair

Where topology is bad, Tripo3D's retopo output is a better starting point than
hand-fixing AI mesh soup. Extend `art-prompts.md` with the model prompts so the
pipeline stays reproducible.

### 2. Blender pass, per robot

Five things, all of which the existing loader depends on:

- **Verify scale.** Enemy GLB bodies are auto-scaled from their measured height
  to the type's `hitboxH`, so the visible robot always matches its raycast
  hitbox. New models slot in without touching hitboxes.
- **Y-up, no corrective rotation.** `AGENTS.md` is explicit — the GLBs are
  already Y-up. Do not add one.
- **Keep the model centered on the origin.** `groundPivot()` (`src/gltf.js:48`)
  re-centers each model on X/Z and drops its base to `y = 0` before caching.
  Callers set only position / `rotation.y` / scale.
- **Export normals explicitly**, so `ensureNormals()` stops being load-bearing.
- **Bake a real baseColor texture.** Both loaders *tint* each model's own
  materials via `color.lerp(...)` rather than assigning a replacement material —
  overwriting `o.material` throws away the baked texture and makes real assets
  look like untextured procedural boxes.

### 3. Budgets and LODs

~3–8k tris for web/mobile, plus a higher-detail variant for Unity desktop.
Generate LOD0/1/2 in Blender while you are already in there — Unity uses them
directly, and the web build can pick by quality preset.

### 4. Fill the two gaps

Author real **`drone`** and **`boss`** GLBs. The boss especially — it is the act
finale and is currently a scaled-up procedural grunt.

### 5. Re-Draco on export

Keep normals retained, and keep routing through the shared `dracoLoader`
(`src/gltf.js`) — the decoder WASM is self-hosted under
`vendor/three/addons/libs/draco/gltf/`.

---

## Caching gotcha

`_headers` marks `/assets/*` as `immutable`, max-age 1 year. **Do not overwrite
an existing asset path expecting clients to refetch** — ship new or renamed
files instead.

---

## Verification

- New GLBs load **without `ensureNormals()` having to fix anything**.
- Models sit on the ground — not floating, not sunk.
- baseColor textures survive tinting (the model is not a flat-shaded box).
- The hitbox matches the visible robot (auto-scaled from `hitboxH`).
- Confirm you are looking at real GLBs, not fallbacks: if a scene GLB fails to
  load, `scenes.js` builds a low-poly procedural silhouette so the arena never
  looks empty. **`AGENTS.md` warns these look plausible in screenshots.**
