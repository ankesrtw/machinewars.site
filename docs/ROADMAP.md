# Machine Wars — Roadmap

Web → Android → Unity v2 (+ Steam, + GIS).

This is the index. Each track has its own doc and is meant to be started as its
own working session — read this file plus the one track doc, not everything.

| Track | Doc | What | Target |
|---|---|---|---|
| **A** | [track-a-web-android.md](track-a-web-android.md) | Fix the web game, wrap it to Android via Capacitor | ~wk 12 |
| **B** | [track-b-content.md](track-b-content.md) | Content depth **as data**: campaign, missions, enemies, bosses | continuous |
| **C** | [track-c-unity.md](track-c-unity.md) | Unity v2 — native Android **and** Steam from one project | ~wk 50+ |
| **D** | [track-d-robots.md](track-d-robots.md) | Robot asset pipeline (Tripo3D + Blender) — feeds A **and** C | continuous |
| **E** | [track-e-gis.md](track-e-gis.md) | Real-world GIS arenas — prototype on web, ship in Unity | gated on B |
| **F** | [track-f-steam.md](track-f-steam.md) | Steam release | post-Android |

## Where the project stands

A static, no-build Three.js wave shooter on Cloudflare Pages: ~5,278 LOC in
`src/`, 7 visually distinct but **mechanically identical** arenas, 10 waves,
5 enemy types, 3 weapons. See [AGENTS.md](../AGENTS.md) for how it runs.

What it does **not** have today, all of which this roadmap adds:

- no save system or progression of any kind (zero `localStorage` in the game)
- no story in-game — the four-act narrative (THE CONSORTIUM / THE ROGUE /
  THE GHOST / THE WAR) exists only as marketing copy in `index.html`
- no gamepad support
- no mission types — every arena is "survive 10 waves"
- `drone` and `boss` have no GLB and render as procedural primitives

## The organizing principle

**The web repo is the content authoring tool.** Everything in Track B must be a
**data file** that Unity deserializes verbatim. Content written as JavaScript
`if`-chains is content you pay for twice.

Unity runs in parallel from the start, which makes this *more* critical, not
less — it is the contract that stops the two codebases from diverging.

## Clarification worth repeating

**Unity is not needed for the Android app.** Capacitor packages the *existing JS
game* into an APK with no Unity involvement. Unity's value is that **one project
produces native Android and Steam builds** — it is the v2 product, not a
dependency of v1.

## The one hard ordering constraint

**Track B Phase 1 (data externalization) must finish by ~week 5**, before
Unity's data importer is written and before any GIS work starts. Everything
downstream reads the schema it produces.

## Two verified blockers

Confirmed by reading the source. Both must be fixed before any packaging work —
details and fixes in [track-a-web-android.md](track-a-web-android.md).

1. **Scene detection breaks in any wrapper.** `detectSceneFromUrl()`
   (`src/main.js:209`) reads the last path segment, which is `index.html` under
   Capacitor/Electron → **every arena silently loads `warzone`**.
   `buildScenePicker()` (`src/main.js:215`) has the same defect.
2. **Settings never persist.** `initSettings()` (`src/main.js:982`) only
   attaches `input` listeners — it never reads a stored value and never applies
   anything at boot.

## Timeline (solo, ~12h/week)

| Track | Weeks | Milestone |
|---|---|---|
| A — Foundation | 1–3 | Loads 3× faster, remembers settings, plays with a gamepad; Play account + 12 testers |
| B — Collapse & data | 2–5 | 8 HTML files → 1 template; **all content in `data/*.data.js`** ← hard deadline |
| D — Robots | 2–10 | scout/grunt/heavy retopo'd with baked normals + LODs; `drone` + `boss` GLBs exist |
| A — Android | 8–12 | Signed AAB on a real phone, all 7 arenas, 60fps at `low` |
| B — Campaign | 4–20 | Target/Entity primitives (~wk 8); Act 01 (~wk 10); 4 acts, ~20 missions, 2.5+ hrs (~wk 20) |
| C — Unity slice | 3–16 | One arena, 30fps mid-range Android, content from the shared data files |
| E — GIS spike | after wk 5 | One real location playable, **judged fun or not** |
| C — Unity systems | 16–46 | Full campaign parity |
| F — Steam | post-Android | Store page live, build uploaded |

## Cost

**$125 total cash.** Google Play $25 (week 1), Steam Direct $100 (Track F).

Free: Unity Personal ($0 under $200k revenue; the 2023 runtime-fee scheme was
cancelled), Capacitor, Electron, steamworks.js, Steamworks.NET, glTFast,
Cesium for Unity, Cloudflare Pages, Blender, OSM/Copernicus/Sentinel data.

**Skip Windows code signing** — Steam-delivered binaries don't trip SmartScreen.
Optional: Tripo3D + AI generation credits ~$20–40/mo, cancellable once the robot
pass is done.

**Back up the Android upload keystore in two places** — losing it is
near-unrecoverable.

## What NOT to do

1. **No bundler in the web repo.** No Vite, no webpack, no TypeScript migration.
   The no-build property is why iteration is fast and deploy is one command;
   packaging needs a ~40-line copy script, nothing more.
2. **Don't let Unity delay Track B Phase 1.** Week 5 is the contract.
3. **Don't port the enemy pathfinding or the Web Audio synthesis to Unity.**
4. **Don't build verticality in Three.js** — that's Unity's differentiator.
5. **Don't do runtime GIS tile streaming.** Offline generation keeps the game
   backend-free and license-clean.
6. **Don't build the GIS pipeline before proving one location is fun.**
7. **Don't charge for a build while an identical free version is one click away.**
8. **Don't revive `vendor/music/music-player.js`** — 20 lines in `audio.js` instead.
9. **Don't replace `o.material` on loaded GLBs** — both loaders tint via
   `color.lerp(...)` precisely to preserve baked textures.

## The risk, stated once

Unity starting in parallel is a deliberate choice, but it is the documented way
this project shape dies: **Unity is more fun than finishing the web campaign,
and the Unity port reads its content from that campaign.** If Track B stalls,
Unity has nothing to import and quietly becomes a from-scratch redesign — a
multi-year project instead of a one-year one.
