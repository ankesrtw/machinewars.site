# Track A — Web fixes & Android wrapper

Ships ~week 12. See [ROADMAP.md](ROADMAP.md) for how this fits the whole plan.

Capacitor packages the **existing JS game** into an APK. Unity is not involved.

---

## Phase 0 — Foundation (weeks 1–3)

Cheap, improves the live site immediately, and **both wrappers are broken
without it**.

### 0.1 Fix scene detection *(verified blocker)*

`src/main.js:209-213`:
```js
const segs = (location.pathname || '').split('/').filter(Boolean);
const last = segs[segs.length - 1] || '';
return (last && SCENE_CONFIGS[last]) ? last : null;
```

Under Capacitor or Electron the URL is `.../play/mars/index.html`, so the last
segment is `index.html`, not `mars` → **every arena silently loads `warzone`**.
`buildScenePicker()` (`src/main.js:215-221`) has the same defect: its
`segs[last] === 'play'` test never fires, so every scene card gets a wrong
relative path. Silent failure — exactly the mode `AGENTS.md` warns about.

**Fix:** tiered resolve —
`document.body.dataset.scene` → `?scene=` → path segment (filtering out any
segment containing `.`) → `DEFAULT_SCENE`. Add `data-scene="<slug>"` to each
`play/<slug>/index.html` `<body>` (currently all 8 are a bare `<body>` at
line 13). Share the filtered-segments helper with `buildScenePicker()`'s
`prefix`.

### 0.2 Save system *(verified blocker)*

`initSettings()` (`src/main.js:982-992`) only attaches `input` listeners — it
never reads a stored value and never applies anything at boot. There is zero
`localStorage` in the game.

New `src/save.js` (~80 LOC) — `Save.load()/save()/patch()` over one versioned
key `mw.save.v1`:

```js
{ v: 1,
  settings: { master, sfx, music, sensitivity, fog, quality, invertY, gamepadDeadzone },
  progress: { actsUnlocked, missionsCompleted: [], arenasUnlocked: [] },
  stats:    { bestScorePerArena: {}, totalKills, waveReached: {} } }
```

Rewrite `initSettings()` to hydrate controls from the save **and call the same
apply functions the listeners call** — currently the listeners are the only
apply path, so a restored value would sit in the DOM without taking effect.

**Keep this schema byte-identical in Unity.** It is the save format there too.

### 0.3 Gamepad support

~120 LOC beside `setupTouchControls()`. Poll `navigator.getGamepads()` at the
top of `renderLoop`:

| Input | Action |
|---|---|
| Left stick | the `mx/mz` vector `updateMovement()` already builds |
| Right stick | `_yaw`/`_pitch` — same math as the mouse handler, scaled by `dt` |
| RT | `AW.shooting` |
| LB / RB | `switchWeapon` |
| X | reload |
| Y | grenade |
| Start | `togglePause()` |

Plus deadzone and light aim assist reusing the existing `_raycaster`.

**This doubles as the spec for Unity's Input System asset** — design the
bindings once.

### 0.4 App-mode flag

`?app=1` / `window.MW_NATIVE` hides `.aw-header` and the ALL SCENES button, and
makes `viewportSize()` return the full window (the current `-44px` header math
is web-only). Route "all scenes" through an in-game menu instead.

### 0.5 Asset diet — 57MB → ~16MB

Do this **before** Capacitor. Everything downstream improves: APK size, update
size, and first-load time on the live site.

| Asset | Now | Action |
|---|---|---|
| `assets/video/teaser.mp4` | 10MB | **Exclude from packages** — landing page only |
| `assets/textures/**` | 22MB | PNG → WebP → ~4–6MB. Pure data change; `textureUrl` fields already exist |
| `assets/art/*.png` | 5MB | → WebP (~1MB). `creonFaceTexture()` re-crops and re-gains it in a canvas pass, so format is irrelevant to it |
| `assets/music/*.mp3` | 11MB | Re-encode to ~3MB (and actually wire them up — see Track B 2.4) |
| `assets/models/` | 6.7MB | Leave; Track D replaces these |

### 0.6 Google Play registration — do this in week 1

**$25 one-time.** Personal accounts need **12 testers × 14 days of closed
testing** before production access. That is a calendar constraint you cannot buy
your way out of — **start the clock and recruit testers in week 1**, not when
the build is ready.

---

## Phase 3 — Capacitor Android (weeks 8–12)

**Capacitor, not TWA or Cordova.** TWA requires the game to be online and gives
no offline packaging; Cordova is legacy.

### Keeping the no-build property

Put Capacitor in a sibling `packaging/android/` with its own `package.json`, so
the deployed root stays bundler-free. Point `webDir` at a staged copy:

```json
{ "appId": "site.machinewars.game", "appName": "Machine Wars",
  "webDir": "www",
  "server": { "androidScheme": "https", "hostname": "localhost" } }
```

**Keep `androidScheme: "https"` (the default).** Capacitor serves through
`WebViewAssetLoader` at `https://localhost/`. Under `file://` you lose a real
origin: `WebAssembly.instantiateStreaming` for `draco_decoder.wasm` falls back
to the slow JS decoder, and `localStorage` (your saves) gets unreliable. At
`https://localhost` everything in `src/gltf.js` works untouched — and
`scenes-data.js`'s `import.meta.url` base resolution (`src/scenes-data.js:14`)
already survives any scheme change.

`packaging/android/stage.mjs` (~40 LOC, run manually) copies `play/ src/ css/
vendor/ assets/` minus `assets/video/` into `www/`. **No bundler** — importmaps
plus raw ES modules run as-is in Chromium WebView (needs Chrome 89+; set
`minSdkVersion 26`).

### Plugins (all free/official)

- `@capacitor/screen-orientation` — lock landscape
- `@capacitor/status-bar` + `windowFullscreen` theme — the touch joystick needs
  the whole screen
- `@capacitor/app` — hardware back button → `togglePause()`, not exit
- **Skip `@capacitor/preferences`** — `localStorage` persists fine at
  `https://localhost`; only add it if WebView data-clearing becomes a complaint

### Already handled — verified, don't re-solve

- `pickAutoQuality()` (`src/main.js:122`) forces `low` on the Android UA, and
  Capacitor's WebView still reports Android.
- Pointer Lock doesn't exist in WebView, but every `requestPointerLock` call is
  already gated behind `IS_TOUCH`.
- The half-float-linear bloom fallback (`src/main.js:108`) is the exact
  Mali/Adreno failure you will hit. Keep it.

### Verify before shipping

**Via `chrome://inspect`, confirm no DRACOLoader JS-fallback warning appears.**
A JS Draco decode of 14 GLBs on a mid-range phone blows past the
`withTimeout(..., 30000)` in `src/enemies.js:202`.

### Size and store listing

~20–30MB AAB after the asset diet — well under the 200MB limit, so **no Play
Asset Delivery needed**.

Listing needs: privacy policy URL (host at `machinewars.site/privacy`),
data-safety form (truthfully "no data collected" — there is no analytics and no
backend), IARC content rating (robot violence, no gore → Teen/PEGI 12), 1024×500
feature graphic, 2–8 screenshots, 512×512 icon. Derive art from
`assets/logo-v2.svg` and the `art-prompts.md` conventions so it matches the game.

### Ship free

A paid wrapper with an identical free version one click away at
`machinewars.site` generates bad reviews. The Android build is the funnel.

---

## Verification

- **Phase 0:** serve the root (`npx http-server -p 8931`), load `/play/mars/`
  **and** `/play/mars/index.html` — both must load Mars, not warzone. Change
  settings, reload, confirm they persist **and apply** (check
  `world.scene.fog.density`, not just slider position). Plug in a controller:
  move, look, fire, reload, switch weapon, pause.
- **Android:** install the AAB on a real device. Via `chrome://inspect`: no
  DRACOLoader JS-fallback warning, real GLBs load (**not procedural
  silhouettes** — `AGENTS.md` warns these look plausible in screenshots), all 7
  arenas reachable, 60fps at `low`, landscape locked, back button pauses,
  settings survive an app restart.
