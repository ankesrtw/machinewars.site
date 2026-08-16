# Heavy robot — duplicate arm + flicker: root cause found

**Date:** 2026-08-16 · **Status:** **FIXED** (asset + code + pipeline) · Related: [track-d-robots.md](track-d-robots.md)

> **Resolution (2026-08-16).** All three fixes are in:
> 1. **Code** — `src/enemies.js` selects the clip by name, not index.
> 2. **Asset** — `assets/models/heavy.glb` now reports `animations: 1`, and its
>    surviving clip is byte-identical to the old clip 0 (the intended static
>    gun-forward pose), verified channel-by-channel.
> 3. **Pipeline** — both `tools/transplant-walk.py` and `tools/tripo-pose-blend.py`
>    are idempotent and now *fail loudly* if an export carries ≠1 clip.
>
> **The "run twice" theory below was wrong.** See
> [Corrected root cause](#corrected-root-cause-what-actually-created-the-duplicate).

The `heavy` enemy renders with what looks like a **second arm on one side** and
**flickers frame-to-frame**. Reproduced in 4 of 8 arenas by two independent
playtest passes. Root cause is now confirmed by direct GLB inspection.

---

## TL;DR — the actual cause

`assets/models/heavy.glb` contains **two animation clips**. `grunt.glb` contains one.

| file | animations |
|---|---|
| `grunt.glb` | 1 — `preset:walk` |
| `heavy.glb` | 2 — `preset:walk` **and** `preset:walk.001` |

`.001` is Blender's duplicate-name suffix. The original theory — that
`tools/transplant-walk.py` was run **twice** — turned out to be wrong; a single
run was always enough. See
[Corrected root cause](#corrected-root-cause-what-actually-created-the-duplicate).

The two clips are identical on 122 of 126 channels. They differ on **exactly
four**, and they are precisely the four the artifact appears on:

```
('L_Upperarm', 'rotation')   clip0: 2 keys (static)   clip1: 57 keys (animated)
('R_Upperarm', 'rotation')   clip0: 2 keys (static)   clip1: 57 keys (animated)
('L_Forearm',  'rotation')   clip0: 2 keys (static)   clip1: 57 keys (animated)
('R_Forearm',  'rotation')   clip0: 2 keys (static)   clip1: 57 keys (animated)
```

- **clip 0 (`preset:walk`)** pins the arms in a fixed gun-forward pose — 2
  keyframes with identical values, i.e. a held pose. This is the intended one:
  it matches the comment at `src/enemies.js:373` ("Arms are baked into a static
  gun-forward pose for the whole clip").
- **clip 1 (`preset:walk.001`)** *swings* the arms through a full 57-key walk
  cycle at markedly different rotations.

Sample values (quaternions) show how far apart the two poses are:

```
L_Upperarm  clip0 (0.726, -0.064, -0.664, 0.169)   clip1 (0.472, 0.314, -0.549, 0.615)
R_Forearm   clip0 (0.169,  0.000,  0.000, 0.986)   clip1 (0.758, -0.231, 0.079, 0.604)
```

Both clips span the same time range (0.0417–2.375s) and target the same 42 nodes.

### Why it looks like a *duplicate* arm and why it flickers

Two clips driving the **same four arm bones** to **two very different poses**.
Whichever wins per frame decides where the arm is drawn, so the arm snaps
between a raised gun-forward pose and a swinging walk pose. Perceptually that
reads as (a) an extra limb — you catch both positions across adjacent frames —
and (b) flicker, since the geometry occupies a different place each frame.

This matches the playtest evidence exactly: three **consecutive** frames from a
**static camera** in mars, ~120ms apart, showed arm geometry present → absent →
present. Not z-fighting; the limb is genuinely moving.

---

## What is NOT wrong (ruled out by inspection)

Both files are structurally clean and near-identical otherwise:

- **Bone lists are identical** — same 41 joints, same names, same order.
  `set(heavy) - set(grunt)` is empty in both directions. No stray/duplicate bone chain.
- **One mesh, one skin, one material** in each file. **No duplicate arm geometry
  exists in the file.** The "second arm" is a rendering artifact, not extra mesh data.
- 43 nodes in each file.
- No missing/extra nodes; no `Icosphere` stray in the shipped GLBs (that one is
  already stripped, see `src/enemies.js:359`).

The earlier hypothesis that a stray untinted mesh node was to blame is
**disproved** — there is only one mesh node (`node[41]`, skinned, 1 primitive).
The cyan "floating hand" observed in warzone is the same single mesh caught
mid-snap, not a separate object.

> Note: heavy clip0 vs grunt clip0 differ on 59 channels (legs, hips, clavicles).
> That is **expected and fine** — the transplant intentionally retargets grunt's
> walk onto heavy's proportions. Not a bug.

---

## Why the game picks the wrong clip

`src/enemies.js:375` takes the first clip unconditionally:

```js
const clip = _modelAnimCache[this.typeName][0];
```

`_modelAnimCache[t] = g.animations` (`src/enemies.js:227`) stores the whole array.
With one clip this was unambiguous. With two, index `[0]` is whichever order the
GLTF loader returns — and only one clip is ever played, so a naive reading says
there should be no conflict.

**Answered:** candidate 2 — clip order is not guaranteed. `[0]` is whatever the
loader returns, so nothing pinned the intended clip. Selecting by name removes
the ambiguity entirely; candidate 1 (shared mixer bindings) was not needed to
explain it and was not the cause.

---

## Corrected root cause — what actually created the duplicate

The "ran it twice" theory is **disproved**. A single run always produced two
clips, via two separate Blender behaviours that both had to be fixed:

1. **`transplant-walk.py` — orphaned donor action.** Removing the donor
   *objects* does not remove the donor *action*: it survives as a zero-user
   orphan data-block, and the glTF exporter still writes unassigned actions
   out. Because the recipient's new action had already claimed the base name,
   Blender uniquified the orphan to `preset:walk.001`.

   Verified directly:

   ```
   AFTER DONOR import      actions: [('preset:walk', 2 users)]
   AFTER RECIPIENT import  actions: [('preset:walk', 2 users)]
   AFTER DONOR REMOVAL     actions: [('preset:walk', 0 users)]   ← orphan survives
   ```

2. **`tripo-pose-blend.py` — NLA stash on import.** The glTF *importer* both
   assigns the action **and** stashes a copy in an NLA track, so importing a
   **1-clip** GLB yields **2** action data-blocks. The exporter writes
   NLA-stashed actions too, so the duplicate reappeared even from a clean input:

   ```
   PROBE after import actions: [('preset:walk', 2), ('preset:walk.001', 1)]
   PROBE nla tracks: [('preset:walk.001', [...]), ('preset:walk', [...])]
   ```

`grunt` escaped only because its `combined/` was built from `walk/` (one action
in, one out), while `heavy`'s was built from `walk_transplanted/` — which the
orphan bug had already contaminated.

### Why the pose-blend step matters for the fix

Re-running `transplant-walk.py` alone is **not** sufficient and actively
regresses the model: the transplant copies the donor's full walk cycle,
including the 57-key arm swing. The static gun-forward pose is authored *later*
by `tripo-pose-blend.py`. A transplant-only re-export produced a file matching
old **clip 1** exactly (0/126 channels differing) — i.e. the swinging arms, with
the intended pose lost. The correct chain is
**transplant → pose-blend → `assets/models/`**.

---

## The fix as applied

**1. Code — select the clip by name** (`src/enemies.js`), so ordering can never
decide behaviour:

```js
const clips = _modelAnimCache[this.typeName];
const clip = clips.find((c) => c.name === 'preset:walk') || clips[0];
```

Confirmed end-to-end *against the old 2-clip asset*: the game bound
`preset:walk` with 2-key (static) arm tracks and never touched
`preset:walk.001`. This one line resolves the visible bug on its own.

**2. Asset — regenerated through the full pipeline.**

```
blender --background --python tools/transplant-walk.py  -- heavy
blender --background --python tools/tripo-pose-blend.py -- heavy walk_transplanted
cp tools/tripo-out/heavy/combined/heavy_combat.glb assets/models/heavy.glb
node tools/gen-version.mjs
```

`heavy.glb` now reports `animations: 1`. The surviving clip differs from the old
clip 0 on **0 of 126 channels** — the intended pose is preserved exactly — and
differs from old clip 1 on the expected 4 arm channels. Structure is unchanged:
43 nodes, 41 joints, identical node names, `NORMAL` present, baseColor
texture/material intact. Accessors drop 176 → 134 (the removed clip's samplers).

**3. Pipeline — both tools made idempotent and self-checking.**

- `transplant-walk.py`: purges the orphaned donor action, then reclaims the
  canonical `preset:walk` name (the loader matches it exactly, so a `.001`
  would silently fall through to `clips[0]`).
- `tripo-pose-blend.py`: clears NLA tracks on import and purges non-kept actions
  before export. Its `find_glb()` also now falls back past `*_model.glb`, since
  the transplant writes `<robot>_walk.glb`.
- Both **raise** if the exported GLB does not carry exactly one clip, so this
  class of defect fails the build instead of shipping.

Verified idempotent: three consecutive transplant runs each produced exactly one
clip named `preset:walk`.

⚠️ Do not "fix" this by deleting arm keyframes from clip 0; the static
gun-forward arm pose is intentional per `src/enemies.js:373`. The fix above
removes the *duplicate clip*, never clip 0's keyframes.

---

## How to re-verify

Stdlib-only inspector scripts (no Blender, no numpy) live in `tools/` and parse
the GLB JSON chunk directly. Re-run after any re-export:

```bash
python tools/glb-inspect.py assets/models/grunt.glb assets/models/heavy.glb
```

**Success criterion:** `heavy.glb` reports `animations: 1`. ✅ **Met.**

> Note: `tools/glb-cmp-clips.py` hard-codes two clips and now raises
> `IndexError: list index out of range` on the fixed `heavy.glb`. That crash is
> itself proof the duplicate is gone — it is not a regression.

To reproduce in-game, unlock all arenas first (direct navigation to a locked
arena redirects to the hub). **`v: 1` is required** — `save.js` rejects a save
whose `v !== 1` and silently falls back to defaults, which still redirects:

```js
localStorage.setItem('mw.save.v1', JSON.stringify({
  v: 1,
  progress: {
    arenasUnlocked: ['warzone','urban','desert','jungle','arctic','alien','space','mars'],
    missionsCompleted: []
  }
}));
```

`heavy` first spawns at **wave 3**. Rather than play three waves, force-spawn
them deterministically through the debug global:

```js
const wm = window.AWDebug.WaveManager;
for (let i = 0; i < 3; i++) wm.spawnQueue.push('heavy');
wm.lastSpawnTime = 0;
```

Then assert on what the game actually bound, by wrapping
`THREE.AnimationMixer.prototype.clipAction` and recording `clip.name` plus the
`(L_|R_)(Upperarm|Forearm).quaternion` track key counts. **Expected: only
`preset:walk`, with 2-key arm tracks.** Confirmed in mars and desert, with zero
console errors and zero failed requests.

---

## Playtest context (8/8 arenas, ~4 min each, real GPU via Playwright + system Chrome)

Everything else came back clean, so this is the only known outstanding defect:

- Zero console errors, zero 404s, no GLB load failures, no procedural fallbacks.
- All controls verified: WASD + diagonals, mouse look (no gimbal roll —
  `camera.rotation.z` stayed 0.000 at pitch extremes), sprint stamina
  drain/lockout/regen, crouch (camera 2.20→1.21), no double-jump,
  fire/reload/weapon-switch/grenade, pause freezing enemies.
- No collision holes, no fall-through-map, no enemies stuck or firing through walls.
- FPS 21–41 across arenas; heap flat 21–39MB over ~4 min (no leak).
- Benign recurring warning, pre-existing and unrelated:
  `[MW] half-float linear filtering unavailable — bloom switched to 8-bit targets.`

### Still unverified (not verified-clean)

- **`grunt`** — a curved cable/loop element near the shoulder. May be intentional
  design or another artifact; needs a human eyeball against the source rig.
  `grunt.glb` itself has only one clip, so it does not share the heavy's defect.
- **`alien` arena** — too dark for close-up model inspection; the heavy was only a
  faint glow in captures.
