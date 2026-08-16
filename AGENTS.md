# AGENTS.md

This file describes the project **as it is today**. For where it's going, see
[docs/v2/ROADMAP-V2.md](docs/v2/ROADMAP-V2.md) — the current plan — plus
[docs/v2/TASKS.md](docs/v2/TASKS.md) (the session checklist) and
[docs/v2/HANDOFF.md](docs/v2/HANDOFF.md) (start here every session: current
state, next task). The older [docs/ROADMAP.md](docs/ROADMAP.md) and per-track
docs beside it are superseded — kept for historical detail, not the plan to
follow.

**Web gameplay is frozen — and `data/` is not.** These freeze differently, and
conflating them wastes work (see ROADMAP-V2 §4.7):

- **`data/` is live.** It is the authoring source the Unity game imports. New
  enemies, sites, missions, wave sets and weapons are authored **here**, as data.
- **The web runtime (`src/`, `play/`, the arenas) is finished as a game.** It
  shipped and it stays, but it is **not** kept in lockstep with `data/` and **is
  allowed to drift.**

**So a `data/` edit stops at `data/`:** no `src/` changes, no `tools/gen-pages.mjs`
run, no new `play/<slug>/` page, no sector-count copy chasing. **If the hub or an
arena looks stale after a data edit, that is expected drift, not a bug.** New
sites are proven in Unity, not in a browser. `tools/data-to-json.mjs --check` and
`tools/validate-missions.mjs` are now the *only* guards on content validity — keep
them green.

The actual game ships from a separate Unity project (ROADMAP-V2 Phase 2+) that
imports `data/` verbatim; that is where the game gets larger and more featureful.
**Do not start Android/Capacitor packaging or add new gameplay systems (weapons,
enemy types, mission runtime, etc.) directly in `src/`.**

Still in scope on the web side, because "frozen" means no new features rather than
"unmaintained": **bug fixes and asset/robot-quality improvements** (better GLBs,
LODs, baked normals — those are needed for Unity anyway).

Machine Wars — a **static, no-build** Three.js wave-survival shooter deployed to Cloudflare Pages. There is **no package.json, no bundler, no tests, no linter**. ES modules run directly in the browser via an inline `<script type="importmap">` that maps `three` / `three/addons/` to self-hosted files in `vendor/three/` (no CDN). Verify changes by opening the site in a browser.

## Run / deploy

- Local: `npx http-server -p 8931` from the repo **root** (no `python3` on this box), then `http://localhost:8931/` (landing), `/play/` (hub), `/play/<scene>/` (arena). Serve from root — JS derives asset paths from `location.pathname`, so `file://` or a non-root base breaks loading.
- **Dev box has a real GPU (NVIDIA T1200 + Intel UHD) and 16 cores** — not software-rendered. Playwright driving the system's installed Chrome (`chromium.launch({ channel: 'chrome' })`, no bundled-Chromium download needed) gets real WebGL, so bloom/shadows/quality presets behave as they would for a real player; no more ~3fps SwiftShader tax. Since the repo has no `package.json` (no-build static site — don't add one), install Playwright in the session scratchpad (`npm init -y && npm install --no-save playwright`), never in the repo.
- `window.AWDebug` (`src/main.js`) exposes `AW`, `WaveManager`, `camera`, `world`, `scene`, a live `enemies` count, plus `hasLineOfSight`, `blockedAt`, `tryJump`, `transientCount` and `disposeScene` — the way to drive/inspect the game from a headless browser. Note `AW.state` goes straight from `'loading'` to `'playing'` inside `startGame()`; there is no ready state to wait on — wait for `#aw-loading` to reach `display: none` (boot complete), then click `#aw-start-btn` and wait for `'playing'`.
- Multiple Playwright browser contexts (`browser.newContext()`) in one process are isolated per-origin storage but **share the GPU process** — a heavier viewport (e.g. 1400×900 with post-processing) measurably slows boot under concurrent contexts. Wait on a real readiness signal (`#aw-loading` display, or `waitForFunction` on a DOM value) rather than a fixed `waitForTimeout`, especially when parallelizing multiple pages/contexts at once.
- Deploy (Cloudflare Pages): **`node tools/deploy.mjs`** — regenerates the asset cache-busting id, stamps it into the HTML, then uploads. Use this rather than calling wrangler directly, or returning visitors may keep stale cached assets (see Caching). `--dry-run` stops before upload. It reads `.env` itself; `.env` holds `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN` (gitignored, never commit). The underlying command is `wrangler pages deploy . --project-name machinewars-site --commit-dirty=true`.
- `?quality=low|medium|high|auto` and `?preserve` are supported game URLs (testing / screenshots).
- **Direct navigation to a locked arena redirects to the hub** (`src/main.js`, `Save.isUnlocked`) — that is the campaign lock working, not a broken page. When testing a specific arena headlessly, seed `localStorage['mw.save.v1']` with every slug in `progress.arenasUnlocked` first, or you will silently be measuring `warzone` eight times.

## Page depths & relative paths (critical)

Pages live at three URL depths: root `/`, hub `/play/`, and arenas `/play/<slug>/`. Every relative path (importmap in each HTML, `ASSET_BASE` in `src/scenes-data.js`, Draco decoder path in `src/gltf.js`) must match its page's depth. `src/scenes-data.js:15` and `src/gltf.js:12` derive their bases from `location.pathname`, but the HTML importmaps are hardcoded per page — `../` at `/play/`, `../../` at `/play/<slug>/`. A wrong prefix silently 404s GLBs, which then drop to procedural fallbacks (arena looks empty-ish) — no console error other than the failed fetch.

## Adding a wavezone

A scene exists as (1) a data object in `SCENE_CONFIGS` in `src/scenes-data.js` keyed by its URL slug, plus (2) a page at `play/<slug>/index.html` (scene is auto-detected from the last URL path segment in `detectSceneFromUrl()`, `src/main.js:169`; the hub's scene picker auto-links each config as `../<slug>/`). `warzone` is `DEFAULT_SCENE`.

**The arena pages are generated — don't hand-edit them.** `node tools/gen-pages.mjs` renders all of them from `play/warzone/index.html` (the template) plus each scene's `name`/`description`. Edit the template, run the tool, and the rest follow; `--check` exits non-zero if any page is stale, `--dry-run` reports without writing. `tools/deploy.mjs` runs it automatically before the version step. Only five values vary per page (meta description, title, `data-scene`, the `ARENA — <LABEL>` caption, and the description repeated in the overlay); the label is the uppercased slug except for the overrides in `ARENA_LABEL_OVERRIDES`. A round-trip guard refuses to write if the template's markup drifts out from under the anchors.

This replaced 8 hand-maintained copies that were ~95% byte-identical. They had already drifted: `play/space/index.html` served its icon and logo from a stale cache key because `tools/stamp-assets.mjs` carried a hardcoded slug list that never had `space` added. Both tools now derive their file lists from `SCENE_CONFIGS`, so a new arena can't be missed.

## Game modules (`src/`)

- `main.js` — engine: renderer, post-processing (EffectComposer + UnrealBloom), render loop, input, player movement/stance, weapons, quality presets.
- `scenes.js`/`scenes-data.js` — `World` builds the 3D environment from per-scene config; `scenes-data.js` holds all data (sky, lighting, ground, layout, spawn, GLB placements).
- `enemies.js` — `WaveManager` + wave configs; takes its `context` (scene/camera/pools) via `setContext()` called from `main.js` during `buildScene()`. Pursuit tries the direct heading then progressively wider deflections; "stuck" is measured as **seconds without getting closer to the player** (`_noProgress`), not as a failed step — an enemy pacing along a wall always finds a free direction, so a can't-move test never fires and it patrols forever. Sustained no-progress escalates to a committed wall-follow, then a brief step-over hop (`_climb`, self-cancelling so robots don't end up hovering).
- `projectiles.js` — pooled enemy bolts. The projectile *carries* the damage and applies it on impact; it substeps its motion so a fast round can't tunnel through thin cover in a long frame.
- `fx.js`, `hud.js`, `audio.js`, `gltf.js`, `math.js` — particles/VFX, DOM HUD, procedural audio, shared DRACOLoader, shared numeric/colour helpers.

## Content data (`data/`)

Authored content lives here as `.data.js` files (plain ESM default-exports,
JSON-literal shaped — no functions/imports/computed values, see
`data/README.md` for the exact contract) so the same files drive the web
preview **and** `tools/data-to-json.mjs`'s `data/json/*.json` mirror, which is
what Unity's importer (ROADMAP-V2 §4.6, not built yet) will read. This is the
authoring-tool half of the "web gameplay is frozen" split above — new content
goes here, not as inline literals in `src/`.

- `weapons.data.js`, `enemies.data.js` — the 3 weapons; per-type enemy stats
  with `score` folded in.
- `waves/<setId>.data.js` — named wave sets (`classic_10` is the only one
  today), not one global array, so future missions can pick their own.
- `scenes/<slug>.data.js` ×8 — full per-arena config (sky/lighting/ground/
  perimeter/spawn/sceneAssets/coverBlocks/props/background). Loaded and
  merged by `src/scenes-data.js`, which re-exports the same `SCENE_CONFIGS`/
  `DEFAULT_SCENE`/`MISSION_ORDER`/`ASSET_BASE` surface it always did — nothing
  downstream needed to change when this was externalized.
- `campaign.data.js` — the 11-node campaign graph (`requires` AND-list,
  advisory `unlocks` for map edges, `act`, `map:{x,y,label}`); consumed by
  `src/save.js`'s graph-aware `completeNode()`.
- `missions/<id>.data.js` — one mission per implemented campaign node, plus
  the scripted-defeat finale (`m401`/grid). `objectives[].type` is drawn from
  the 11-type hard cap documented in `data/objectives.schema.md` — **do not
  add a 12th type without deleting one.** No runtime consumes these yet
  (Unity implements the mission runner); `tools/validate-missions.mjs` checks
  shape against the vocabulary and the campaign graph.
- `json/` — generated by `tools/data-to-json.mjs`, committed (Unity pulls it
  without running Node). Never hand-edit; run the tool after any `.data.js`
  change and `--check` before committing.

## Combat model

Enemy fire is **not hitscan**. `_updateWeapon()` (`src/enemies.js`) gates on line of sight, then telegraphs (eye flare + the robot planting for ~0.4–0.6s), then re-checks LOS at fire time — so breaking cover during the wind-up genuinely saves the player. Damage lands when the bolt hits. Contact damage is on a cooldown; enemies no longer destroy themselves on touch.

`hasLineOfSight()` and `blockedAt()` (`src/main.js`) march the flat `AW.obstacles` array rather than raycasting the scene graph. `fireWeapon()` already pays for a full `intersectObjects(scene.children, true)` traversal **per pellet**, so adding a per-enemy-per-frame traversal would dominate the frame; LOS results are cached ~180ms per enemy.

Obstacle records are `{x, z, hw, hd, h}`. **Movement collision (`checkCollision`) is deliberately 2D and ignores `h`** — a player on the ground is blocked by any footprint they overlap. `h` exists for things that pass *over* cover: sightlines and projectiles. Register every solid via `World._pushObstacle()`, which handles the rotated-AABB expansion; don't push raw records.

Player movement has a real vertical axis (gravity, jump, crouch, sprint with stamina). Crouching shrinks the player's projectile hit radius, so it is mechanically meaningful. **Space is jump; pause is Escape / P.**

## Assets

- 14 GLBs in `assets/models/` use **KHR_draco** — always route loading through the shared `dracoLoader` (`src/gltf.js`); decoder WASM is self-hosted under `vendor/three/addons/libs/draco/gltf/`.
- If a scene GLB fails to load, `scenes.js` builds a low-poly procedural silhouette from the config's tint/scale data so the arena never looks empty. Don't mistake these fallbacks for real models in screenshots.
- The GLBs are **already Y-up** — do NOT add a corrective rotation. They are, however, authored centered on the origin, so `loadGLB()` re-centers each one on X/Z and drops its base to `y = 0` (`groundPivot()` in `src/gltf.js`) before caching. Callers therefore set only position / `rotation.y` / scale. Their bounding boxes are misleading: a robot's longest axis is its outstretched arms, not its height, so "longest axis = up" heuristics get it wrong.
- Both loaders **tint** each model's own materials (`color.lerp(...)`) rather than assigning a flat replacement material. Overwriting `o.material` throws away the baked baseColor texture and makes real assets look like untextured procedural boxes.
- `Object3D.clone()` shares geometry and materials by reference. Template geometry from `_glbCache`/`_fallbackCache`/`_modelCache` is registered in a `_templateGeos` set and skipped by both `World.dispose()` and `Enemy.dispose()`; freeing it blanks every later clone.
- Enemy GLB bodies are scaled from their measured height to the type's `hitboxH`, so the visible robot always matches its raycast hitbox. `ENEMY_TYPES.modelScale` now only affects the procedural fallbacks.

## CREON sky billboard

Each scene's `sky.creon` block puts the CREON face on the horizon: a camera-locked `PlaneGeometry` built in `World._buildCreon()` (`src/scenes.js`), textured by `creonFaceTexture()` (`src/fx.js`) which crops the head out of `assets/art/creon-machine-wars.png`, feathers it elliptically, and knocks the near-black background out to alpha. It is repositioned relative to the camera each frame, so it can't be approached or shot, and `fog: false` keeps the scene fog off it.

**The camera's far plane is 400** (`src/main.js:167`). Anything placed past it is clipped and silently never drawn — this is what made the first version invisible. `_buildCreon()` clamps `distance` to `far * 0.8`; keep configured distances well inside 400.

The source art is dark (mean luminance ~0.12), so the texture pass lifts RGB via `gain`/`gamma`. Dark-sky scenes want gain > 1 (the face lit against night); **bright-sky scenes (arctic, desert) want gain < 1**, reading CREON as a dark silhouette instead — a bright face on a pale sky washes out to nothing.

## Design system (filmic-neutral)

The site was redesigned away from the original acid-green terminal look to a **filmic-neutral**
palette: desaturated steel/ash base (`#0b0c0e` → `#16191d`), **amber `#ff9d2e` as the single
signal accent**, ember `#ff4d32` for alarm, ice `#8fd4ff` for the Ghost/cleared states. Tokens
are defined as CSS custom properties at the top of both `css/landing.css` and `css/style.css`
(duplicated deliberately — the two pages share no stylesheet and there is no build step to
dedupe them). Change a colour in both places or they drift.

**The green survives in exactly one place, on purpose:** the live combat HUD (`#hud-*`) and
touch controls (`.tc-*`) in `css/style.css`, plus the canvas-drawn radar and HP bar in
`src/hud.js`. Those greens/ambers/reds encode *state* — healthy / warning / critical — not
brand, so recolouring them would cost the player readable information mid-fight. Everything
outside those selectors is chrome and follows the neutral palette.

Typography is a two-family split: `--mw-sans` (Inter/system) for headlines and card names,
`--mw-mono` (Courier) retained for kickers, labels, buttons and HUD readouts — the mono is what
keeps the military-terminal character now that the green is gone. Panels use a clipped-corner
`clip-path` polygon rather than border-radius; that bevel is the repeated shape across buttons,
cards, consoles and the media frame.

Landing-page scroll reveals (`.lw-reveal`) are driven by an IntersectionObserver in
`index.html` and are **fully bypassed under `prefers-reduced-motion`** — if you add a section,
give it the class or it will simply always be visible (a safe default, not a bug).

Art direction for new image assets lives in `art-prompts-v2.md`, which supersedes the style
anchor in the older `art-prompts.md` (that file targets the retired green palette).

## Generating art (`tools/gen-art.mjs`)

`node tools/gen-art.mjs` generates site art through the Replicate API, reading
`REPLICATE_API_TOKEN` from `.env` (the plural `REPLICATE_API_TOKENS` is also accepted; the
token is never logged). Jobs are declared in the `PROMPTS` array in that file — keep them in
sync with `art-prompts-v2.md`.

- `--list` shows every job; `--dry-run` resolves prompts and cost without calling the API.
- `--set=zones|space|hero|factions|all`, or `--only=mars,arctic` for specific jobs.
- `--model=schnell` ($0.003/img) for drafts, `--model=dev` ($0.025) for finals, `pro` ($0.04).
- Existing files are **skipped unless `--force`**, so a re-run won't silently redo paid work.
- `--seed=<n>` — jobs derive `seed + index`, so a set is reproducible.

Two prompt lessons worth keeping, both learned by burning generations:

1. **FLUX has no negative-prompt input.** Writing "not teal" does nothing — the first pass
   drifted cyan and yellow-green anyway. The grade has to be pinned *positively* ("strictly
   neutral grey, the only colour is amber firelight").
2. **"cinematic still" makes FLUX bake letterbox bars into the image**, which show as black
   stripes once a card crops to fill. The anchor now says "full bleed … no letterbox bars".

**Photographic art ships as JPEG, not PNG.** The first pass wrote PNGs and the 8 zone cards
came to 8.4MB; the same images at `-quality 80` JPEG are ~530KB total with no visible
difference at card size. `gen-art.mjs` now requests `output_format: 'jpg'` for any job whose
output path ends in `.jpg` (emblems stay PNG for transparency). If you add a photographic job,
give it a `.jpg` path.

## Wavezones

Eight arenas; `MISSION_ORDER` in `src/scenes-data.js` is the campaign chain and ends on
`mars`. `space` (ORBITAL STATION) sits second-to-last. **`MISSION_ORDER` drives the hub's
lock/unlock UI and the `N / M SECTORS CLEARED` counter**, so adding a scene there is what
makes it appear. The sector-count copy across the HTML pages (`N SECTORS`, the landing
hero stat, the story paragraph) is **generated** — `tools/gen-pages.mjs` derives it from
`MISSION_ORDER.length` and rewrites every page, so re-run that tool rather than editing
the numbers by hand. *(This paragraph previously claimed the copy was hand-maintained;
that was wrong, corrected 2026-08-17.)*

`play/space/index.html` was cloned from `play/arctic/index.html`; its scene config reuses the
alien skybox and urban ground textures as placeholders. Both are fine to replace when the
real Space Wars art/level work happens.

## Caching (`_headers`)

`/assets/*` and `/vendor/*` are `immutable`, max-age 1y; `index.html` and `/play*` are never cached.

Overwriting an asset in place at the same path would therefore never reach returning visitors — an `immutable` response isn't even revalidated until it expires. **Cache busting solves this**: every asset URL carries a `?v=<BUILD_ID>` query string, which changes the cache key without renaming files.

**This is fully automatic — deploy with `node tools/deploy.mjs` and there is nothing to remember.**

- `src/version.js` is **generated** (don't hand-edit). It holds `BUILD_ID` and the `withVersion()` helper. All runtime asset loads (GLBs in `scenes.js`/`enemies.js`, textures, scene preview images) are wrapped in `withVersion()`.
- `tools/gen-version.mjs` derives `BUILD_ID` from a sha256 over the path + bytes of every file under `assets/`, then invokes `tools/stamp-assets.mjs` to rewrite the URLs baked into the 9 HTML pages. Both are idempotent.
- `tools/deploy.mjs` runs the version step and then `wrangler pages deploy`, so the id can't be forgotten. `--dry-run` versions and stamps without uploading.
- `tools/pre-commit` (install once per clone: `node tools/install-hooks.mjs`) regenerates the id whenever a commit touches `assets/`, and folds `version.js` + the HTML into that same commit.

**Content-hash, not commit SHA — deliberately.** The id changes if and only if the assets change, so a code-only deploy keeps the same id and clients keep ~15MB of valid cached models. Hashing the commit would bust every cache on every deploy. It's also content-addressed rather than monotonic: reverting an asset returns to its previous id. Text assets (`.svg`, `.json`, …) are CRLF-normalized before hashing so the id is reproducible across Windows and Linux checkouts; binaries are hashed byte-for-byte.

`node tools/gen-version.mjs --check` exits non-zero if the committed id is stale — useful in CI.

The Draco decoder path in `src/gltf.js` is deliberately *not* versioned — it's a directory prefix DRACOLoader concatenates filenames onto, so a query string there would land mid-URL and 404. Those are pinned Three.js binaries; update them by bumping the vendored Three.js version instead. Same reasoning for the `/vendor/three/*` importmap entries.

## Music (removed)

The dead soundtrack player (`vendor/music/*`, `game-music.js`, and the `window.AWAudio` global that existed only to serve it) has been deleted — none of it was referenced by any HTML page, and `docs/track-b-content.md` says not to revive it. The Suno tracks under `music/` are untouched; the intended route is `Audio.playTrack()` in `src/audio.js` through the existing `_musicGain` node, not the old player.

## Repo state

`main` is the only branch. The working tree contains a large in-progress refactor (landing page split into `index.html` + `play/` hub + per-arena pages); much of it is uncommitted. Don't assume `git status` clean.
