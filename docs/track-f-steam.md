# Track F — Steam

Final phase, ~1–2 months after the Android launch, **gated on how Android is
received**. See [ROADMAP.md](ROADMAP.md).

Nothing here begins until the Android build is live and you have read its
reviews and install numbers.

---

## Two possible routes — decide when you get there

### Route 1 — Electron wrapper of the web build (fast)

**Electron, not Tauri or NW.js.** Tauri uses the OS webview (WebView2 on
Windows, WebKitGTK on Linux, whose WebGL is notably weaker), which means the
`EffectComposer` + half-float bloom path would run on whatever the user happens
to have. Non-deterministic rendering is a support nightmare for a GPU-heavy
game. Electron ships a known Chromium version: you test one browser, you ship
one browser. The extra ~120MB of binary is irrelevant inside a Steam depot.

Structure: `packaging/desktop/` with its own `package.json` and
`electron-builder` (free).

**Register a custom `app://` protocol via `protocol.handle()` serving from
`www/`. Do NOT use `loadFile()`** — it yields a `file://` document, which breaks
`localStorage` (your saves) and Draco WASM streaming.

Desktop polish that separates a real game from a wrapped web page:
frameless fullscreen, `Menu.setApplicationMenu(null)`, no right-click context
menu, no devtools in production, `user-select: none`, hidden cursor in-game,
auto-pause on window `blur`, and real resolution / fullscreen / borderless
options in the settings panel.

### Route 2 — the Unity build (better)

Same project as Unity Android, no wrapper work at all. See
[track-c-unity.md](track-c-unity.md).

---

## Steamworks

- **`steamworks.js`** for Electron (Node native addon, actively maintained —
  `greenworks` is abandoned), or **Steamworks.NET** for Unity (free, MIT).
- **Achievements** — natural triggers already exist: wave milestones, per-arena
  clears, boss kills, no-damage waves, and accuracy thresholds from
  `AW.waveShots` / `AW.waveHits` (`src/main.js:44`). ~20 achievements is a
  weekend and materially helps reception.
- **Steam Cloud** — your save is one small JSON, so this is a config-only
  feature pointing at the save path. Free credibility; add it.
- **Steam Input** — coverage in `steamworks.js` is partial. Simpler to rely on
  the `navigator.getGamepads()` path from Track A 0.3, and declare "Full
  controller support" in the partner backend only after testing an Xbox pad
  end-to-end **including menu navigation**.

---

## What Steam actually costs and requires

| Item | Detail |
|---|---|
| **Steam Direct** | **$100 per app**, one-time, recouped after $1,000 adjusted gross revenue |
| Onboarding | Bank/tax setup (W-8BEN for a non-US individual) + identity verification — allow 1–2 weeks |
| **30-day wait** | **Mandatory** between the store page going live and the release date. Wishlists accumulate in this window — **publish the store page early**, well before the build is done |
| Build upload | SteamPipe: `steamcmd +login +run_app_build app_build_XXXX.vdf`. Two files (`app_build.vdf`, `depot_build.vdf`) pointing at the `electron-builder` output. Script it as `packaging/desktop/upload.ps1` |
| Store assets | Header capsule 460×215, small 231×87, main 616×353, vertical 374×448, page background, library 600×900 + 1920×620 hero + logo, 5+ screenshots, a trailer (**re-cut `assets/video/teaser.mp4`**) |
| Age rating | A content survey, not IARC. Robot violence, no gore → uncontroversial |
| Code signing | **Skip it.** Steam-delivered binaries don't trip SmartScreen the way direct downloads do. Don't buy a cert |

---

## Where a wrapped web build gets savaged — and the minimum bar

Steam users detect and punish "this is a browser game in a box" reliably.

| Tell | Minimum bar |
|---|---|
| No gamepad | Track A 0.3, **including menu navigation by D-pad** |
| Windowed with a titlebar / visible HTML header | Track A 0.4 + frameless fullscreen; the `.aw-header` with its "GRID ONLINE" and "THREE.JS" badges **must go** |
| Settings that don't stick | Track A 0.2 + real resolution/fullscreen/FOV options |
| No saves, no progress | Track B progression. A game that resets to wave 1 every launch reads as a demo |
| Alt-Tab breaks pointer lock, mouse escapes the window | Auto-pause on `blur`; use Electron's `setFullScreen`, not DOM fullscreen |
| Browser-tier UI (default scrollbars, selectable text) | `user-select: none`, restyle `#aw-settings` to look native |
| 20 minutes of content | **The real one** — see below |

---

## Pricing

**Steam review scores are permanent and follow the app ID**, including onto a
future Unity release that reuses it. There is no undo.

The safe default is a **free Demo/Prologue attached to the Unity game's store
page**: it validates the whole SteamPipe pipeline, gets the store page and the
30-day clock running, and builds wishlists at **zero reception risk** — for $100
and no downside.

Do not ship a paid wrapped build at 10 waves and 7 mechanically identical
arenas. Either go free-demo, or wait for the Track B campaign and ship the
content-complete game as a real paid v1.0.
