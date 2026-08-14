# AGENTS.md

Machine Wars — a **static, no-build** Three.js wave-survival shooter deployed to Cloudflare Pages. There is **no package.json, no bundler, no tests, no linter**. ES modules run directly in the browser via an inline `<script type="importmap">` that maps `three` / `three/addons/` to self-hosted files in `vendor/three/` (no CDN). Verify changes by opening the site in a browser.

## Run / deploy

- Local: `python3 -m http.server 8931` from the repo **root**, then `http://localhost:8931/` (landing), `/play/` (hub), `/play/<scene>/` (arena). Serve from root — JS derives asset paths from `location.pathname`, so `file://` or a non-root base breaks loading. (No `python3` on the current Windows box; `npx http-server -p 8931` works the same.)
- `window.AWDebug` (`src/main.js`) exposes `AW`, `WaveManager`, `camera`, `world`, `scene`, and a live `enemies` count — the way to drive/inspect the game from a headless browser. Note `AW.state` goes straight from `'loading'` to `'playing'` inside `startGame()`; there is no ready state to wait on, so click `#aw-start-btn` and then wait for `'playing'`. Under software GL (SwiftShader) the loop runs ~3 fps, so anything frame-timed needs seconds of real wall time, not milliseconds.
- Deploy (Cloudflare Pages): `source ~/.nvm/nvm.sh && source .env && wrangler pages deploy . --project-name machinewars-site --commit-dirty=true`. `.env` holds `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN` (gitignored, never commit).
- `?quality=low|medium|high|auto` and `?preserve` are supported game URLs (testing / screenshots).

## Page depths & relative paths (critical)

Pages live at three URL depths: root `/`, hub `/play/`, and arenas `/play/<slug>/`. Every relative path (importmap in each HTML, `ASSET_BASE` in `src/scenes-data.js`, Draco decoder path in `src/gltf.js`) must match its page's depth. `src/scenes-data.js:15` and `src/gltf.js:12` derive their bases from `location.pathname`, but the HTML importmaps are hardcoded per page — `../` at `/play/`, `../../` at `/play/<slug>/`. A wrong prefix silently 404s GLBs, which then drop to procedural fallbacks (arena looks empty-ish) — no console error other than the failed fetch.

## Adding a wavezone

A scene exists as (1) a data object in `SCENE_CONFIGS` in `src/scenes-data.js` keyed by its URL slug, plus (2) a **full copy** of the game page at `play/<slug>/index.html` (scene is auto-detected from the last URL path segment in `detectSceneFromUrl()`, `src/main.js:169`; the hub's scene picker auto-links each config as `../<slug>/`). The per-arena pages are duplicated, hardcoded HTML — any change to the game page/HUD must be manually synced across all `play/*/index.html` copies. `warzone` is `DEFAULT_SCENE`.

## Game modules (`src/`)

- `main.js` — engine: renderer, post-processing (EffectComposer + UnrealBloom), render loop, input, weapons, quality presets. Exports game audio as `window.AWAudio`.
- `scenes.js`/`scenes-data.js` — `World` builds the 3D environment from per-scene config; `scenes-data.js` holds all data (sky, lighting, ground, layout, spawn, GLB placements).
- `enemies.js` — `WaveManager` + wave configs; takes its `context` (scene/camera/pools) via `setContext()` called from `main.js` during `buildScene()`. Pursuit tries the direct heading then progressively wider deflections; "stuck" is measured as **seconds without getting closer to the player** (`_noProgress`), not as a failed step — an enemy pacing along a wall always finds a free direction, so a can't-move test never fires and it patrols forever. Sustained no-progress escalates to a committed wall-follow, then a brief step-over hop (`_climb`, self-cancelling so robots don't end up hovering).
- `fx.js`, `hud.js`, `audio.js`, `gltf.js` — particles/VFX, DOM HUD, procedural audio, shared DRACOLoader.

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

## Caching (`_headers`)

`/assets/*` and `/vendor/*` are `immutable`, max-age 1y; `index.html` and `/play*` are never cached. New or renamed assets therefore serve correctly on a new deploy, but reusing a path expects the file to be permanent — don't overwrite an existing asset in place expecting clients to refetch.

## Music player (currently unwired)

`vendor/music/music-player.js` + `music/data/tracks-default.json` provide the soundtrack player (catalog fetched from `./music/data/tracks-default.json`, `API_BASE` relative to deploy root), and `game-music.js` is glue that injects a MUSIC button and pins the track. None of these are referenced by any HTML page yet — the game currently uses only procedural audio.

## Repo state

`main` is the only branch. The working tree contains a large in-progress refactor (landing page split into `index.html` + `play/` hub + per-arena pages); much of it is uncommitted. Don't assume `git status` clean.
