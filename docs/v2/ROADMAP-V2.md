# Machine Wars v2 — GIS Campaign, Unity Runtime

> **Status:** direction agreed, not yet started. This document **supersedes the
> sequencing** in [../ROADMAP.md](../ROADMAP.md), which stays for history. The
> supporting doc amendments are listed in §11.
>
> **To execute:** work from [TASKS.md](TASKS.md) — 50 session-sized tasks with gates.
> Read that file plus the plan section it links, not this whole document.

---

## 1. Context — why the direction changed

`docs/ROADMAP.md` is a **web-first, Unity-later** plan: fix the web game (Track A),
deepen its content (B), wrap it for Android via Capacitor, start Unity in parallel as
the eventual v2. Its own risk section names the failure mode exactly: *"Unity is more
fun than finishing the web campaign, and the Unity port reads its content from that
campaign."*

Four things changed that invalidate the **sequencing** but not the **architecture**:

1. **The quality bar moved to AAA-oriented, native Android first.** The web build
   cannot get there. Flat-AABB `checkCollision()` (`src/main.js`), the
   `_noProgress`/wall-follow pathfinder, the 400 far plane, and the DOM HUD are
   structural caps. Every hour making the web build *better* is spent on a runtime
   that gets discarded.
2. **Real-world GIS terrain became the content spine.** Track E was gated R&D behind
   Track B. The site roster is now the campaign.
3. **A concrete narrative arc exists** (Ghats → … → Creon Data Grid scripted defeat →
   space war). Previously the four acts were marketing copy in `index.html`. Narrative
   order constrains site order → save schema → data schema.
4. **The product milestone is a campaign across ~11 sites**, not a one-arena slice.

The roadmap's most durable idea survives and is **promoted from principle to hard rule**:

> **The web repo is the content authoring tool.** Everything is a data file Unity
> deserializes verbatim.

What changes: this is no longer a discipline applied to a shipping web game. The web
build is **explicitly a tool, not a product** — it (a) previews GIS terrain cheaply in a
browser and (b) authors/validates the data files. **Web gameplay is frozen.**

### Tension worth stating once

AAA quality + native Android + 11 sites + real GIS + branching hub + scripted-defeat
finale + space act + more/better robots, **solo at ~12h/week**, is not an 11-site plan.
It is a 3–5 site plan with a roster designed so sites 6–11 are additive content, not new
systems. Everything below is phased so that **a complete, shippable campaign exists at
the end of Phase 4** and the roster can truncate at any site boundary without the arc
becoming incoherent. Honest total in §8.

---

## 2. Reconciliation of Tracks A–F

| Track | Verdict | Detail |
|---|---|---|
| **A — Web fixes + Capacitor** | **Cancelled (mostly)** | A Capacitor wrapper is dead weight if Unity is the runtime. **Salvage:** the `detectSceneFromUrl()` fix (`src/main.js:244`) — the GIS preview tool needs reliable slug resolution. A 0.2 is already done (`src/save.js` exists). Play Console account + keystore **move to Phase 6**, still needed. |
| **B — Content as data** | **Phase 1 survives, promoted; Phase 2 splits** | B 1.2 (externalize to `data/*.data.js`) is now *the* critical path — the Unity import contract and the GIS generator's output target. **B 1.1 cancelled** — `tools/gen-pages.mjs` already generates the pages. Phase 2's **schemas** (mission/objective, Target/Entity, wave sets, boss phases) get authored as data; Phase 2's **web runtime** (`src/mission.js`, Entity class, follower AI, DOM briefings) is **cancelled** — Unity implements it. B 2.4 (music) and B 2.6 (web arena size) cancelled. |
| **C — Unity v2** | **Promoted to main line, re-sequenced** | Port order broadly right and reused in §6.3, but **step 1 becomes the terrain A/B spike** and the **hub map** is new. "Don't port pathfinding / don't port Web Audio" both stand. |
| **D — Robots** | **Survives, expands** | Pipeline is real and working. Now targets Unity quality: more types, LOD0/1/2, baked normals. |
| **E — GIS** | **Promoted to spine, and softened** | track-e chose "real cities, OSM footprints → `coverBlocks`". Now a **hybrid**: real DEM/satellite for terrain and biome, **hand-authored combat layout** on top (§5.4). Its core discipline — offline bake, no runtime streaming, no backend, no Google Photorealistic Tiles — is preserved absolutely. |
| **F — Steam** | **Unchanged, still last** | Gated on Android reception. The URP mobile/desktop split keeps the door open; no work now beyond not painting into a mobile-only corner. |

---

## 3. Site roster

**Earth GIS core → off-world finale.** 11 sites. GIS sites use real DEM + satellite for
terrain silhouette and biome palette; layout is hand-authored.

| # | ID | Name | Region | Build | Reuses | Narrative role |
|---|---|---|---|---|---|---|
| 1 | `ghats` | WESTERN GHATS | Agumbe/Kudremukh ~13.5N 75.1E | GIS | jungle assets | **Opening.** GHOST AI's hidden base. |
| 2 | `ghats_east` | EASTERN GHATS | Araku Valley ~18.3N 82.9E | GIS | jungle | War spreads; shares biome pipeline. |
| 3 | `warzone` | INDUSTRIAL WARZONE | Jamshedpur belt ~22.8N 86.2E | GIS + existing props | **warzone** | Human industrial base falling. |
| 4 | `urban` | URBAN COLLAPSE | Chennai/Mumbai coastal ~13.0N 80.2E | GIS | **urban** | Ghost reaches population centres. |
| 5 | `desert` | THAR RELAY | Thar Desert ~27.0N 71.5E | GIS | **desert** | Relay array. Long sightlines. |
| 6 | `arctic` | ARCTIC BASE | Svalbard ~78.2N 15.6E | GIS | **arctic** | Human command bunker. |
| 7 | `ocean` | PACIFIC PLATFORM | Pacific rig ~15.0N 145.0E | GIS (bathymetry) | **new** | Ocean base. See risk 7. |
| 8 | `alien` | XENO SITE | Atacama ~24.5S 69.3W, or hand | Hybrid | **alien** | Ghost's non-human tech origin. |
| 9 | `grid` | CREON DATA GRID | non-geographic | **Hand-authored** | **new** | **Scripted defeat.** Last Earth site. |
| 10 | `space` | ORBITAL WAR | non-geographic | Hand-authored | **space** | Grid vs humans. Post-defeat act. |
| 11 | `mars` | MARS | — | Hand-authored | **mars** | **LOCKED.** Visible future content. |

`jungle` is re-themed into `ghats`/`ghats_east`; its assets and lighting transfer
directly. Net new: `ocean`, `grid`.

### Branch structure — a graph, not a chain

```
              ghats (start)
                 │
             ghats_east
              ╱      ╲
        warzone       desert
           │             │
         urban ─────── arctic
              ╲      ╱
               ocean          ← AND-gate: requires urban AND arctic
                 │
               alien
                 │
               grid           ← SCRIPTED DEFEAT
                 │
               space          ← finale
                 ┊
               mars           (locked, visible)
```

**Truncation points if scope forces it:** after `arctic` (7 total), or after `ocean`
(10). **`grid` and `space` are never cut** — they are the arc.

---

## 4. Data schema work (web repo — the authoring tool)

New top-level `data/` directory.

### 4.1 Externalize

| From | To |
|---|---|
| `SCENE_CONFIGS` (`src/scenes-data.js:22`, 1,501 LOC) | `data/scenes/<slug>.data.js` ×11 |
| `ENEMY_TYPES` (`src/enemies.js:165`) | `data/enemies.data.js` |
| `WAVE_CONFIGS` (`src/enemies.js:194`) | `data/waves/<setId>.data.js` — **named sets, not one global array**, so missions pick their own. The most important change here. |
| `WEAPONS` (`src/main.js:40`) | `data/weapons.data.js` |
| `SCORE_VALUES` | fold into `data/enemies.data.js` as per-type `score` |
| `MISSION_ORDER` (`src/scenes-data.js:1499`) | replaced by `data/campaign.data.js` (§4.2); keep a derived flat array for `buildScenePicker()` / `gen-pages.mjs` |

`src/scenes-data.js` becomes a thin loader applying the existing
`ASSET_BASE = new URL('../assets/', import.meta.url)` resolution
(`src/scenes-data.js:13`). **Preserve that pattern exactly** — AGENTS.md flags it as the
wrapper-proof, page-depth-proof path resolution.

**Keep `.data.js`, not `.json`** — plain `import` needs no fetch, so it behaves
identically on Pages and under any wrapper scheme. `tools/data-to-json.mjs` (~20 LOC)
emits real JSON for Unity.

### 4.2 Campaign graph — `data/campaign.data.js`

```js
export default {
  id: 'mw_campaign_01',
  startNode: 'ghats',
  nodes: {
    ghats:      { site:'ghats', act:'act01', title:'GHOST SIGNAL',
                  requires:[], unlocks:['ghats_east'],
                  map:{ x:0.62, y:0.58, label:'WESTERN GHATS' } },
    ghats_east: { site:'ghats_east', act:'act01',
                  requires:['ghats'], unlocks:['warzone','desert'] },
    ocean:      { site:'ocean', act:'act03',
                  requires:['urban','arctic'], unlocks:['alien'] },   // AND-gate
    grid:       { site:'grid', act:'act04', requires:['alien'],
                  unlocks:['space'], outcome:'scripted_defeat' },
    space:      { site:'space', act:'act05', requires:['grid'], unlocks:['mars'] },
    mars:       { site:'mars', act:'act06', requires:['space'], locked:true,
                  lockedReason:'CLASSIFIED — FUTURE OPERATION' },
  },
};
```

`requires` is an **AND** list — a node unlocks when every entry is in
`nodesCompleted`. `unlocks` is advisory, so the hub map draws edges without inverting
the graph. Deliberate two-way encoding.

### 4.3 Mission + objective schema

Reuse `docs/track-b-content.md` §2.1's shape verbatim — it holds up.
`data/missions/<id>.data.js`, with `rewards.unlockNode` replacing `unlockArena`.

**Objective vocabulary — hard cap of 11 types**, unchanged from track-b:
`survive_waves`, `kill_count`, `kill_type`, `protect`, `reach_zone`, `time_limit`,
`no_damage`, `weapon_restriction`, `destroy_targets`, `rescue`, `escort`. In Unity these
become 11 small `ObjectiveSO` subclasses. **Do not add a 12th without deleting one.**

### 4.4 The scripted-defeat mission — the one genuinely new schema

Do **not** model it as "a mission you fail." Model it as a mission whose success
condition is **narrative, not survival**:

```js
{ id:'m401', node:'grid', scene:'grid', title:'THE DATA GRID',
  outcome:'scripted_defeat',
  objectives:[ { type:'survive_waves', count:4 },
               { type:'destroy_targets', targetGroup:'grid_pylons', count:6 } ],
  finale:{ trigger:'objectives_complete',   // the player WINS the fight…
           script:'grid_collapse',          // …then the sequence takes over
           playerAgency:'retained',         // still shooting during the collapse
           defeatAfterMs:45000 },
  rewards:{ unlockNode:'space' } }          // defeat still progresses
```

**Design rules that stop it feeling cheap** — this is the hard part, not the schema:

- **The player must win the fight they were given.** Objectives complete normally. The
  loss comes from what the Grid does *after*, never from an unwinnable HP race.
- **Keep agency during the collapse** — the player keeps shooting and moving for the
  final 45s. Nothing is more insulting than an unskippable cutscene defeat.
- **No fail screen, no retry prompt.** Transition straight to the `space` debrief.
  `save.js` records it in `nodesCompleted` exactly like any win.
- **Foreshadow in at least two prior debriefs** (`ocean`, `alien`) so it reads as
  inevitable, not arbitrary.
- **Change the hub map afterwards** (§6.4) — Earth is lost, the map goes orbital. This
  makes the defeat land structurally rather than through dialogue.

Total schema cost: one `outcome` enum value and one `finale` block.

### 4.5 Save schema — extend `src/save.js`, do not replace

It already versions correctly, shallow-merges onto defaults for forward-compat
(`src/save.js:44-51`), and has `arenasUnlocked`/`missionsCompleted`.

- Bump to `v: 2` **with a migration** — the current `parsed.v !== 1 → defaults()`
  discard at `src/save.js:42` would wipe progress. v1 `arenasUnlocked` maps cleanly onto
  node IDs since site slugs are preserved.
- Add `progress.nodesUnlocked` / `nodesCompleted` / `currentNode` alongside the existing
  arena fields (kept for the web preview tool).
- Replace `unlockNext()` (`src/save.js:92`) with graph-aware `completeNode(nodeId)` that
  unions in every node whose `requires` are now satisfied. Keep `unlockNext` as a thin
  shim so existing `main.js` callers don't break.
- **`UNLOCK_ALL_ARENAS = true` (`src/save.js:22`) is a live playtest flag.** Carry it
  forward as `UNLOCK_ALL_NODES`, keep it **on** for the authoring tool, and ensure Unity
  ships it **off** via a build flag, not a source constant.

Unity reuses this schema verbatim via `JsonUtility`/Newtonsoft to
`Application.persistentDataPath`.

### 4.6 Unity import

`tools/data-to-json.mjs` → `data/json/*.json` → a Unity `[MenuItem]` editor importer
(~200 LOC) producing `SceneConfigSO`, `EnemyTypeSO`, `WaveSetSO`, `WeaponSO`,
`MissionSO`, `CampaignSO`, and 11 `ObjectiveSO` subclasses. **Write this at Unity step
2, before any content work** — it is what makes all later content free.

---

## 5. GIS terrain pipeline

New `tools/gis/`, following existing `tools/*.mjs` conventions (Node ESM, zero npm deps,
`--check`/`--dry-run`, reads `.env`, header comment explaining *why*). Model it on
`tools/gen-pages.mjs`.

### 5.1 Sources and licensing

| Source | Use | License | Obligation |
|---|---|---|---|
| **Copernicus DEM GLO-30** | Primary terrain, all Earth sites | Free, attribution | "Contains modified Copernicus data" |
| **Sentinel-2 L2A** (10m) | Ground albedo / biome palette | Free (ESA terms) | "Contains modified Copernicus Sentinel data [year]" |
| **GEBCO** bathymetry | `ocean` seafloor + coastal profile | Free, attribution | GEBCO credit line |
| **OpenStreetMap** | **Reference only** — tracing roads/coastline to inform hand layout | ODbL | Prefer reference-only so **no OSM-derived database ships**; if geometry ships, ODbL attribution required |
| ~~Google Photorealistic 3D Tiles~~ | **Do not use** — requires runtime streaming, forbids baking, kills the offline property |
| ~~Mapbox Unity SDK~~ | **Do not use** — unmaintained |
| USGS 3DEP | Not used — no US sites in the roster |

Attribution ships in a CREDITS screen and `docs/v2/gis-attribution.md`. Cheap and
non-negotiable.

### 5.2 Scripts

```
tools/gis/
  sites.data.js        # roster: slug → { bbox, centerLatLon, playableExtentM, source }
  fetch-dem.mjs        # bbox → Copernicus tiles → tools/gis/cache/ (gitignored)
  fetch-imagery.mjs    # bbox → Sentinel-2 RGB composite → cache
  build-heightmap.mjs  # GeoTIFF → 1025²/2049² 16-bit PNG + metadata JSON
                       #   (m/px, min/max elevation, origin lat/lon)
  build-albedo.mjs     # composite → tiled ground albedo, graded to site palette
  bake-mesh.mjs        # heightmap → decimated .glb terrain (path A of the A/B spike)
  emit-scene.mjs       # metadata → data/scenes/<slug>.data.js stub: ground/perimeter/
                       #   lighting seeded from real sun angle + biome
```

`sites.data.js` is the single source of truth for every site's geography — itself a data
file, same discipline as everything else.

### 5.3 Offline-bake principle (inherited from track-e, preserved absolutely)

- **Nothing fetches at runtime.** Scripts are run manually; the game ships baked
  artifacts only. No backend, no tile streaming, no API key in the client.
- Downloads cache in `tools/gis/cache/` — **gitignored**, like `tools/tripo-out/`.
- Baked outputs commit to `assets/terrain/<slug>/`. **Caching gotcha:** `/assets/*` is
  `immutable`, max-age 1y — ship new/renamed files, never overwrite in place, and let
  `node tools/deploy.mjs` regenerate the cache-bust id.

### 5.4 "Terrain real, layout authored" — concretely

The explicit change from track-e Option 1: **do not generate `coverBlocks` from OSM
footprints.** Instead:

1. **GIS produces** the heightmap, ground albedo, real sun angle/elevation for the
   site's latitude, the biome colour palette, and the far silhouette (ridgelines,
   coastline) as distant static geometry.
2. **A human authors the playable box** — a ~200×200m combat area placed on the real
   terrain, cover/structures/spawn arcs/objectives hand-placed, using the existing
   `coverBlocks: [x, z, w, d, h, rot]` format which already expresses everything needed.
3. Real terrain does what it is good at: **silhouette, scale, biome authenticity,
   horizon.** The hand-authored layout does what terrain is bad at: **fun.**

Justified by track-e's own warning: *"Real cities are mostly flat, dense, and
repetitive; there is a real risk they play worse than the hand-tuned arenas."* This
hybrid takes the authenticity and refuses the flatness.

### 5.5 Web preview role

The web build loads a generated `data/scenes/ghats.data.js` with **one** engine change:
a `ground.type: 'heightmap'` branch in `src/scenes.js`. That is track-e's stated test —
if the generated file needs more than that, the schema is wrong. The preview answers
*"does this terrain read as a place?"* in seconds instead of a Unity rebuild.

---

## 6. Unity project

### 6.1 Setup

Unity 6 LTS + URP from the URP 3D template. Two URP Asset variants — **Mobile** (1
shadow cascade, cheap bloom, Forward, no MSAA, 0.7–0.85 render scale) and **Desktop**
(4 cascades, full post, Forward+, MSAA, 1.0). Vulkan first + GLES3 fallback; DX11/12 on
Windows. Linear colour. ASTC on Android, BC7/BC5 on Windows. Port `QUALITY_PRESETS`
(`src/main.js:33`) as **semantics, not numbers**.

**Repo layout: a separate `machinewars-unity` repo**, consuming `data/` via a checked-in
export or submodule. Do **not** put a Unity project inside this repo — it destroys the
no-build property AGENTS.md protects.

### 6.2 Terrain A/B spike — the first gate

Build `ghats` **both ways** and measure. Unity step 1, before any gameplay systems.

| | **Path A — baked DEM mesh** | **Path B — Unity Terrain** |
|---|---|---|
| Source | `bake-mesh.mjs` → decimated `.glb` → prefab via glTFast at edit time | heightmap PNG → `TerrainData.SetHeights` via editor script |
| Pros | Tri-budget control; static batching; same asset feeds the web preview; no Terrain overhead | Free LOD, detail/tree instancing (Ghats canopy), terrain layers, in-editor sculpting |
| Cons | No auto-LOD; manual texturing; sculpting means re-running the pipeline | Historically heavy on mobile; splatmap shader cost; harder to share with web |

**Gate (kill/continue):**
- Measured on a **real mid-range Android device** (~3-year-old ~$250 phone, Snapdragon
  6-series / Dimensity 900 class) — not the editor, not a flagship.
- **Continue: ≥30fps sustained with 12+ enemies visible.** Record frame time, draw
  calls, tri count, and **thermal behaviour over 10 minutes** — throttle is what
  actually kills mobile.
- **If neither path clears 30fps:** reduce scope now — smaller playable extent, lower-res
  heightmap, fewer simultaneous enemies, cheaper URP tier. **Not "optimize later."**
- Record the decision and the numbers in `docs/v2/terrain-decision.md`. Do not
  re-litigate.

**Prediction, stated so it can be checked:** Path A likely wins for a 200×200m playable
area — Unity Terrain's advantages (streaming, huge extents) are for scales this game
does not use. Measure it anyway.

### 6.3 Port order (adapted from track-c)

1. **Terrain A/B spike + `ghats` static** ← **gate**
2. **Data importer** — SOs + editor importer. Early, ~200 LOC.
3. **Player controller + Input System** — touch first, then gamepad, then KBM.
4. **Enemies + NavMesh.** **Do not port `enemies.js` pathfinding** — the
   `_noProgress`/wall-follow/`_climb` stack exists only because Three.js gives you
   nothing. Port the *tuning data* and the *feel*: zigzag → agent velocity offset;
   `flies`/`flyHeight` → off-NavMesh direct steering.
5. **WaveManager** — near-mechanical port. Keep the `setContext()` DI shape
   (`src/enemies.js`) as C# constructor injection; it is the cleanest design in the
   codebase.
6. **Audio** — bake `src/audio.js` (689 LOC of Web Audio) through an
   `OfflineAudioContext` to WAV: 12 sounds × 3–5 pitch/timbre variants. One afternoon of
   web-side work, and **strictly better** than the web version, which regenerates an
   identical waveform on every shot. AudioMixer with Master/SFX/Music matching the three
   existing sliders.
7. **HUD in UI Toolkit** — largest single cost, **budget 2–3 weeks, ship it
   ugly-but-functional first.** `hud.js` (151 LOC) + `css/style.css` translate near
   concept-for-concept to UXML/USS. Radar as a small `RenderTexture` from an orthographic
   top-down camera rather than reimplementing `HUD.drawRadar()`. **Preserve the AGENTS.md
   rule:** combat-HUD greens/ambers/reds encode *state*, not brand — keep them.
8. **Mission/objective system** — `MissionSO` + 11 `ObjectiveSO`. Build track-b 2.5's
   keystone here: replace unconditional player-seek with `enemy.target` resolving to
   player *or* world `Entity`, priority `nearest|player|objective|weakest`.
9. **Hub map** (§6.4).
10. **The `grid` scripted-defeat sequence** — immediately after 8+9, **not at the end**.
11. **Save/settings/menus** — schema from `src/save.js` v2.
12. **VFX** — `fx.js` procedural textures → VFX Graph/Shuriken; Unity 6 `ObjectPool<T>`.
13. **World builder from scene data** — automate placement so remaining sites are data edits.
14. **Platform** — Android + Play Console, **keystore backed up in two places.**

### 6.4 Hub map (new — track-c had none)

- **Stylized Earth, not a real basemap** — avoids another licensing question entirely.
  Sites plot at `map.x/y` from `campaign.data.js`, roughly matching real geography.
- **Node states:** locked / available / completed / current. Edges from `unlocks`, dimmed
  until traversable. AND-gated nodes (`ocean`) show both incoming edges and a
  "2 OF 2 REQUIRED" indicator.
- **The choice moment:** after clearing a branching node, 2–3 destinations light up with
  brief intel blurbs. This is the entire point of branching — make the choice legible.
- **`mars` renders visible-but-locked** with its `lockedReason`. Visible future content
  is a feature.
- **Act transition:** after `grid`, the map itself changes — Earth is lost, the map goes
  orbital. Highest-value narrative beat available for the cost.
- Built in UI Toolkit alongside the HUD (step 7's tooling amortizes). Reuse the
  clipped-corner `clip-path` bevel and amber/ember/ice tokens from `css/landing.css` —
  the design language already exists.

---

## 7. Robot / asset scale-up

Existing pipeline is real and working: `tools/tripo-rig.py`, `tools/tripo-pose-blend.py`,
`tools/transplant-walk.py`, `tools/glb-inspect.py`, `tools/glb-cmp-clips.py`;
`tools/tripo-out/` is untracked working space.

**7.1 Fill the gaps first** — `drone` and `boss` GLBs. The boss especially: it is an act
finale currently rendering as a scaled-up procedural grunt. Helps the web preview
immediately and is required for Unity regardless.

**7.2 Scale up**

- **~10–12 robot types:** existing 5 + `sniper`, `swarm`, `shield`, `spider`,
  `artillery` (track-b 2.2), plus 2–3 act-boss uniques. Most are pure
  `data/enemies.data.js` edits given at most 3 new flags — `preferredRange`,
  `damageMultiplierByAngle`, `spawnsOnDeath`.
- **LOD chain per robot:** LOD0 desktop ~15–25k tris / LOD1 mobile hero ~5–8k / LOD2
  crowd ~2k. Generate all three in one Blender session.
- **Baked normal maps** from the Tripo high-poly onto the retopo'd low-poly. **This is
  the single highest-value quality lever** — it is what makes a 5k-tri mobile robot read
  as a 200k-tri asset. Add `tools/bake-normals.py` following existing script conventions.
- **Material discipline carried forward:** models stay Y-up with **no** corrective
  rotation; `groundPivot()` (`src/gltf.js`) expects origin-centred authoring; both
  loaders **tint via `color.lerp()` rather than replacing `o.material`** — replacing it
  discards the baked baseColor and makes real assets look like untextured boxes. Unity's
  importer must respect the same convention.
- **Export normals explicitly** so `ensureNormals()` (`src/gltf.js`) stops being
  load-bearing. Verify with `python tools/glb-inspect.py` — `docs/track-d-robots.md`
  already records that the shipped GLBs are *not* Draco-compressed and *do* carry NORMAL,
  contrary to AGENTS.md:52. **Run the tool, don't trust either doc.**
- **Beware the fallback trap:** a failed GLB load makes `scenes.js` build a plausible
  procedural silhouette that looks convincing in screenshots. Always confirm you are
  looking at a real GLB.
- **Idempotency guard, from the `heavy.glb` bug:** Blender's glTF exporter writes
  orphaned and NLA-stashed actions, so one transplant run produced two `walk` clips
  driving conflicting arm poses. `transplant-walk.py` and `tripo-pose-blend.py` now fail
  loudly on ≠1 clip — **every new Blender script needs the same guard**
  (`docs/heavy-arm-bug-investigation.md`).

**7.3 Site props** — ~8–12 per biome, but **biomes share** (Ghats ↔ jungle, arctic ↔
space, both hard-surface). Budget ~5 distinct kits for 11 sites.

---

## 8. Phasing with gates

Cadence: **solo, ~12h/week ≈ 50h/month.** This is the binding constraint.

| Phase | Work | Est. | Gate (kill/continue) |
|---|---|---|---|
| **0 — Data foundation** (web repo) | Externalize `data/*`; `campaign.data.js` graph; `save.js` v2 + migration; `data-to-json.mjs`; mission/objective + scripted-defeat schemas | 4–6 wk | All 8 arenas load unchanged from `data/`; `gen-pages.mjs --check` passes; JSON round-trips. **Nothing downstream is safe to start until this is done** — the old roadmap's "week 5 hard deadline", still the one hard ordering constraint. |
| **1 — GIS pipeline + first site (web preview)** | `tools/gis/`; `sites.data.js`; `ghats` heightmap + albedo; `ground.type:'heightmap'` in `src/scenes.js` | 4–6 wk | **Does Ghats read as a real, specific place in the browser? Be prepared for "no."** If real DEM is indistinguishable from good procedural noise, the GIS spine is not worth its cost — fall back to hand-authored sites with GIS for lighting/palette only. Find out with one site and two weeks, not a pipeline and three months. |
| **2 — Unity + terrain A/B spike** | Unity 6 URP setup; import `ghats` both ways; profile on real mid-range Android | 6–8 wk | **≥30fps sustained, 12+ enemies, 10-min thermal soak.** If neither path clears it, reduce scope **now**. |
| **3 — Unity vertical slice** | Port steps 2–8: importer, player, enemies+NavMesh, waves, baked audio, HUD, missions. One site, one full mission, touch + gamepad | 12–16 wk | **Is it fun on a phone — judged by someone other than you?** If touch controls make a cover shooter miserable, solve it here, not after 11 sites exist. |
| **4 — Campaign spine** | Hub map; `ghats`, `warzone`, `arctic` (proves the branch); then **`grid` + `space`** | 12–16 wk | Start at Ghats → real branch choice → lose at the Grid → fight in space. **This is the minimum shippable product** — a campaign with a beginning, middle, and ending. Ship it if you must stop here. |
| **5 — Roster fill** | `ghats_east`, `urban`, `desert`, `ocean`, `alien` — data + GIS bake + prop kit, no new systems | 2–4 wk/site | **Truncates at any site boundary.** |
| **6 — Android release** | Play Console, keystore (**backed up twice**), listing, closed testing, ASTC budget | 4–6 wk | Play Asset Delivery only if >200MB — likely 60–120MB; don't pre-build packs. |
| **7 — Steam** | Track F unchanged; `mars` is a natural post-launch drop | gated | On Android reception. |

**Honest totals: Phases 0–4 ≈ 40–55 weeks. Phases 0–6 ≈ 60–75 weeks.** The original
roadmap's "~week 50+" was the right order of magnitude for a *slice*; a full 11-site
AAA-oriented campaign at this cadence is a **2+ year project**. The phasing above exists
so a shippable game lands at the end of Phase 4 and everything after is additive.

---

## 9. Risks

1. **AAA quality on mobile, solo, is the dominant risk and it is not close.** AAA is a
   headcount, not a technique. What *is* achievable solo is **coherent art direction
   executed consistently** — which this project already demonstrates (filmic-neutral
   palette, amber-signal discipline, the CREON billboard). **Redefine the bar as "reads
   as premium and consistent," not "matches a 200-person studio."** Baked normals + LODs
   + one strong lighting model per biome buys more perceived quality than any feature.
2. **11 sites is a lot** — the back half is 4–6 months. Mitigated structurally: the
   roster truncates at site boundaries, biomes share prop kits, and `grid`+`space` are
   built in Phase 4 so the arc is never hostage to the roster.
3. **Scripted defeat is easy to make feel cheap.** Mitigations in §4.4. If it still feels
   cheap in playtest, the fallback is a **pyrrhic win** (objectives met, Grid escapes to
   orbit) — preserves the space act at lower narrative risk.
4. **The GIS hypothesis may be false.** Players may not perceive real terrain as real.
   Phase 1's gate exists to kill this cheaply.
5. **Unity is more fun than finishing the data layer** — the old roadmap's stated death
   mode. The Phase 0 gate is the defence: **do not open Unity before `data/` is done.**
6. **Web repo bit-rot** once gameplay is frozen. Mitigation: only two things must keep
   passing — `gen-pages.mjs --check`, and "a generated scene loads in the unmodified
   engine." Let everything else drift.
7. **`ocean` is the hardest GIS site** — bathymetry, water rendering, platform geometry,
   and no terrain to fight on. It is the **first candidate for reclassification** to
   hand-authored, with GIS supplying only sea state and horizon.
8. **Two repos will diverge.** The `data/` export is the contract — give it a `--check`
   mode that fails when the Unity-side JSON is stale, in `tools/deploy.mjs`'s style.

---

## 10. Verification

**Phase 0 — data**
- All 8 existing arenas load and play identically from `data/scenes/*.data.js` with no
  engine change beyond the loader indirection.
- `node tools/gen-pages.mjs --check` exits 0.
- `node tools/data-to-json.mjs` emits valid JSON for every data file; a hand edit in
  `data/enemies.data.js` appears in the JSON.
- A v1 `mw.save.v1` blob migrates to v2 with unlocks preserved — test with
  `UNLOCK_ALL_NODES` both on and off.
- Graph resolves: `ocean` stays locked with only `urban` complete; unlocks with both
  `urban` and `arctic`.

**Phase 1 — GIS**
- `data/scenes/ghats.data.js` is generated by `emit-scene.mjs` and loads with **only**
  the `ground.type:'heightmap'` branch added. If it needs more, the schema is wrong.
- Heightmap metadata (m/px, elevation range, origin lat/lon) round-trips so the same
  file drives Unity.
- Attribution present in `docs/v2/gis-attribution.md` for every source used.
- **Nothing in the shipped build makes a network request** — verify on a cold load in
  the devtools network tab.

**Phase 2 — Unity spike**
- Both paths built and profiled on the **same physical** mid-range Android device;
  numbers recorded in `docs/v2/terrain-decision.md`.
- Winning path holds ≥30fps with 12+ enemies over a 10-minute thermal soak.

**Phase 3 — slice**
- A scene/enemy/mission/wave-set edit in `data/*.data.js` round-trips into Unity with
  **zero hand-editing** — the whole payoff; test it explicitly.
- Enemies attack a mission-designated `Entity` instead of the player when target
  priority is `objective` — the `Target` primitive working.
- Touch, gamepad, and KBM all complete the same mission.
- Robot GLBs load without `ensureNormals()` fixing anything; models sit on the ground;
  baseColor survives tinting; hitbox matches the visible robot. **Confirm real GLBs, not
  procedural fallbacks.**

**Phase 4 — campaign spine**
- Full playthrough: Ghats → branch choice → Grid defeat → space. Close app, reopen,
  progress persists.
- The Grid mission's objectives complete **successfully** before the defeat sequence; no
  fail screen; `nodesCompleted` includes `grid`.
- Hub map shows `mars` visible-and-locked with its reason string.
- **Someone who is not you plays it and reports whether the defeat felt earned or
  cheap.**

---

## 11. Files this plan creates or changes

**First action on approval — write this document to `docs/v2/ROADMAP-V2.md`.**

| Path | Action |
|---|---|
| `docs/v2/ROADMAP-V2.md` | **new** — this document |
| `docs/v2/gis-attribution.md` | new — source credit lines (Phase 1) |
| `docs/v2/terrain-decision.md` | new — A/B result + numbers (Phase 2) |
| `docs/ROADMAP.md` | amend — header pointing to `docs/v2/`, plus the §2 track reconciliation |
| `docs/track-e-gis.md` | amend — record the Option 1 → hybrid softening (§5.4) |
| `docs/track-a-web-android.md` | amend — mark cancelled, note the two salvaged items |
| `AGENTS.md` | amend — note that web gameplay is frozen and the repo is now an authoring tool |
| `data/**` | new — the externalized content (Phase 0) |
| `tools/gis/**` | new — the GIS pipeline (Phase 1) |
| `tools/data-to-json.mjs` | new — Unity export (Phase 0) |
| `tools/bake-normals.py` | new — robot normal baking (Phase 7 work) |
| `src/scenes-data.js` | becomes a thin loader over `data/`; keep the `ASSET_BASE` pattern |
| `src/save.js` | v2 schema + migration + `completeNode()` |
| `src/scenes.js` | one new branch: `ground.type: 'heightmap'` |
| `src/enemies.js` | `ENEMY_TYPES`/`WAVE_CONFIGS` move out to `data/` |
| *(separate repo)* `machinewars-unity` | new Unity 6 URP project (Phase 2) |
