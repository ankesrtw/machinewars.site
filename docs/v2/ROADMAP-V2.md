# Machine Wars v2 — Hand-Authored Campaign, Unity Runtime

> **Status:** Phase 0 complete and gated. **Phase 1 (GIS) ran, answered its gate
> question "no", and is now a closed research track** — see §1.5. Phases 2+ were
> re-planned on 2026-08-17 around hand-authored arenas; that revision is what the
> phase table in §8 and [TASKS.md](TASKS.md) now describe.
>
> This document **supersedes the sequencing** in [../ROADMAP.md](../ROADMAP.md), which
> stays for history. The supporting doc amendments are listed in §11.
>
> **To execute:** work from [TASKS.md](TASKS.md) — session-sized tasks with gates.
> Read that file plus the plan section it links, not this whole document.

---

## 1.5 Direction change — GIS is not the terrain source (2026-08-17)

**Decided after `/play/ghats/` rendered, with real evidence rather than a guess.**
Phase 1 built the full GIS pipeline (`tools/gis/*.mjs`, `assets/terrain/ghats/`, the
`ground.type: 'heightmap'` engine branch) and shipped a playable site. Two rounds of
real bug fixes later — including a genuine engine bug where `_buildHeightmapGround`
crushed the loaded albedo to near-black — **the hand-authored arenas still look and
play better.**

GATE P1 asked: *"does Ghats read as a real, specific place in the browser?"* The plan
said to be prepared for "no." **The answer was no.** The gate worked exactly as
designed: one site, ~two weeks, decision made before three months of pipeline.

**What this changes:**

- **The hand-authored arena style (`data/scenes/*.data.js` — `warzone`, `jungle`,
  `arctic`, …) is what carries into Unity.** Sites are `coverBlocks` + GLB props +
  a lighting/sky palette, all already expressed in the existing schema.
- **Phase 2's terrain A/B spike is void.** It asked "which way do we import a DEM
  heightmap into Unity" — there is no DEM heightmap to import. Phase 2 is now
  scaffold + data importer + a real perf gate on an imported hand-authored arena.
- **The data importer (was P3.1) moves up to Phase 2.** With the terrain question
  gone, the importer is the first real Unity task, and it makes the perf gate cheap
  to reach: import `warzone`, add enemy stand-ins, profile.

**What this does NOT change** — none of it assumed GIS terrain:
`data/`'s authoring contract, `save.js` v2 + migration, the campaign graph, the
mission/objective schema, the Unity port order for everything downstream of terrain
(player, enemies, waves, audio, HUD, missions, hub map, the `grid` defeat).

**The GIS track is kept, not deleted.** `tools/gis/`, `assets/terrain/ghats/`, and
`_buildHeightmapGround()` stay in the repo as working reference. Its two durable
findings are recorded in [Appendix A](#appendix-a--gis-research-track-closed). Do not
build on it; do not delete it.

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
build is **explicitly a tool, not a product** — it authors and validates the data files.
**Web gameplay is frozen.**

> **Sharpened 2026-08-17 — see [§4.7](#47-the-webunity-split--what-frozen-actually-means).**
> "Frozen" applies to the web **runtime**, not to `data/`. `data/` stays live and keeps
> growing as the authoring source Unity imports; the web build is finished as a game and
> **may drift from it.** The GIS-preview half of this tool's original job is also gone
> (§1.5) — previewing terrain in a browser is no longer something anyone needs.

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

> **Revised 2026-08-17** (§1.5). Every site is **hand-authored** — the GIS column is
> gone. `ghats`/`ghats_east` are **retired**; `jungle` (a finished arena that the
> ghats split had orphaned from the campaign graph) takes the opening slot.

**9 sites.** Six already exist as finished `data/scenes/*.data.js`; two are net new;
one is locked future content.

| # | ID | Name | Build state | Narrative role | Variation lever (§3.1) |
|---|---|---|---|---|---|
| 1 | `jungle` | JUNGLE — GHOST BASE | **exists** | **Opening.** GHOST AI's hidden base. | Baseline. Close sightlines, dense cover. |
| 2 | `warzone` | INDUSTRIAL WARZONE | **exists** | Human industrial base falling. | Baseline mixed arena — the reference site. |
| 3 | `desert` | THAR RELAY | **exists** | Relay array. | **Long sightlines** — sniper-type, ranged-heavy waveSet. |
| 4 | `urban` | URBAN COLLAPSE | **exists** | Ghost reaches population centres. | **Verticality + ambush** — tight lanes, swarm-type. |
| 5 | `arctic` | ARCTIC BASE | **exists** | Human command bunker. | **Low visibility** — shorter fog, shield-type pushing through it. |
| 6 | `ocean` | OCEAN LAUNCH GRID | **NEW** — hand-author | Ocean base. AND-gated. | **No ground approach** — platform arena over water, drone/flier-heavy waveSet, fall-off-edge danger. |
| 7 | `alien` | XENO SITE | **exists** | Ghost's non-human tech origin. | **Unfamiliar** — spider/artillery types, alien movement feel. |
| 8 | `grid` | CREON DATA GRID | **NEW** — hand-author | **Scripted defeat.** Last Earth site. | Non-geographic. Waves you *win* before the scripted collapse. |
| 9 | `space` | ORBITAL WAR | **exists (placeholder art)** | Grid vs humans. Post-defeat act. | **Ship combat — 6DOF.** See §3.2; own phase, own gate. |
| — | `mars` | MARS | exists | **LOCKED.** Visible future content. | — |

**Net new authoring: `ocean`, `grid`.** `space` exists but is a placeholder (reuses the
alien skybox and urban ground) and gets a full rework in §3.2.

**Retired:** `ghats`, `ghats_east` — remove their `data/campaign.data.js` nodes.
`data/scenes/ghats.data.js` and `assets/terrain/ghats/` stay on disk as the GIS
research artifact (Appendix A); the scene simply leaves `MISSION_ORDER`.

### 3.1 Per-site mechanical variation — the roster's real requirement

**Every site must play differently, not just look different.** This is a stated product
requirement, and it is what keeps an 8-mission campaign from feeling like one arena
reskinned eight times.

The good news: **the existing schema already carries most of it.** Three levers exist
and are currently unused —

1. **`waveSet` per scene.** P0.3 built named wave sets and `WaveManager.waveSet`, but
   every arena still plays `classic_10`. Wiring is one line
   (`WaveManager.waveSet = sceneConfig.waveSet || 'classic_10'`), and after that a
   site's enemy mix, pacing, and difficulty curve are **pure data**. This is the single
   highest-leverage unused feature in the codebase.
2. **New enemy types** in `data/enemies.data.js` — open-ended, already planned as P7.4
   (`sniper`, `swarm`, `shield`, `spider`, `artillery`) under a **hard cap of 3 new
   behavioural flags**.
3. **`flies` / `flyHeight`** — already exists on `drone`; it is the primitive `ocean`
   needs, and the reason a flier-heavy platform arena costs no new systems.

**Rule: a site's variation should be expressible as `waveSet` + enemy types + layout.**
If a site needs a new *system*, that is a phase-level decision (only `space` qualifies —
§3.2), not a roster task. This keeps Phase 5 as content work that truncates safely.

### 3.2 `space` — the one genuine new system

`space` is **ship-to-ship combat: the player pilots a ship, 6DOF**, fighting CREON
machine vessels alongside human ships. This is not a scene variant — it is a **second
movement and combat model** (flight controls, 3D dogfighting, no ground, no cover, no
NavMesh).

**Consequences, stated plainly:**

- It gets **its own phase and its own gate** (Phase 5), not a roster row.
- It sits on the **campaign finale**, so slipping it slips the ending. That is the risk.
- **Fallback if the 6DOF gate fails:** `space` reverts to a **foot-soldier arena on a
  station hull or capital-ship exterior** — same controller as every other site, low-gravity
  tuning, with the fleet battle as skybox spectacle and large moving cover. The scene data
  and narrative beat survive intact; only the movement model degrades. **Decide at the
  gate, not later.**

### Branch structure — a graph, not a chain

```
             jungle (start)
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
               space          ← finale (6DOF — §3.2)
                 ┊
               mars           (locked, visible)
```

`jungle` replaces the two-node `ghats`/`ghats_east` opening with a single-node one. The
branch, the AND-gate, and the arc are otherwise unchanged.

**Truncation points if scope forces it:** after `arctic` (5 total), or after `ocean`
(6). **`grid` and `space` are never cut** — they are the arc.

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
`MissionSO`, `CampaignSO`, and 11 `ObjectiveSO` subclasses. **Write this as the first
Unity task, before any content work** — it is what makes all later content free.

**Repo split and sync mechanism — decided 2026-08-17.**

`machinewars-unity` is a **fresh Unity repo, not a fork of this one.** A fork would
carry `src/`, `play/`, and `vendor/three/` into a repo that never runs them, and imply
a merge relationship nobody would ever use. §6.1's "separate repo" rule stands for its
original reason: a Unity project inside this repo (≈1GB `Library/`, `.meta` files
everywhere, Git LFS) destroys the no-build property.

**`data/json/` is copied into the Unity repo and checked in** — 22 files, ~160KB, text
only. No submodule: the payload is too small to justify the friction (forgotten
`--recursive`, detached pointers), and it must work offline.

**The staleness guard — this is what makes risk 10 mechanical instead of a discipline
problem.** Copies drift silently; that is the entire failure mode. So:

- `tools/data-to-json.mjs` also emits **`data/json/manifest.json`** — a content hash
  over every emitted JSON file, plus the generating commit. Same content-hash
  discipline as `tools/gen-version.mjs`'s `BUILD_ID` (§ AGENTS.md Caching): it changes
  **if and only if** the data changes.
- The Unity importer **records the manifest hash it last imported**, and **refuses to
  import — loudly — when the hash it sees disagrees with what the JSON actually
  hashes to.** A refusal is the point: **partial imports are what create the
  "just hand-patch it in Unity" temptation**, and hand-patching is how the two copies
  begin to diverge for real.
- Updating the Unity side is therefore one deliberate step: run the exporter here,
  copy `data/json/` across, commit. The hash tells you unambiguously whether you did.

**The rule that follows, and it is not negotiable:** when the importer rejects
something, **fix `data/` and re-import.** Never hand-edit the generated
ScriptableObject. If a Unity-only concept genuinely cannot be expressed in `data/`,
that is a **schema gap to close in `data/`** (§4.7), not a reason to author it
Unity-side.

### 4.7 The web/Unity split — what "frozen" actually means

**Decided 2026-08-17.** §1 already said web gameplay is frozen. This sharpens it,
because the earlier phrasing left an ambiguity that cost a task's worth of misplanning:
**`data/` and the web *runtime* are not the same thing, and they freeze differently.**

| | Status | Meaning |
|---|---|---|
| **`data/`** | **Live — keeps growing** | The authoring source Unity imports. New enemies, sites, missions, wave sets, weapons are authored **here**, as data. This is what Phase 0's eight tasks bought. |
| **Web runtime** (`src/`, `play/`, pages) | **Finished as a game** | It shipped, it works, it stays. It is **not** kept in lockstep with `data/` and **is allowed to drift.** |

**The rule that follows:** a `data/` edit does **not** oblige a web-side change. No
`gen-pages.mjs` run, no new `play/<slug>/` page, no sector-count copy, no making a new
site playable in a browser. **If the hub or a page looks stale after a data edit, that
is expected drift, not a bug.** New sites are proven in Unity, not in the browser.

**Still explicitly allowed on the web side**, because "frozen" means *no new features*,
not *unmaintained*: bug fixes, and asset/robot-quality improvements (better GLBs, LODs,
baked normals — Phase 8) that improve the preview and are needed for Unity anyway.

**Where new content goes** — decided with the user, and it is the reason `data/` stays
live rather than becoming a one-time seed: **new content is authored in `data/` and
imported**, keeping one source of truth. Genuinely Unity-only concepts (6DOF ship
handling, anything the web engine cannot express) are still authored as data the web
build simply ignores. **Unity is where the game becomes larger and more featureful**;
the base theme — wave-survival shooting, the CREON arc — stays intact.

**The consequence to watch (risk 10):** the web build stops being a check on `data/`'s
correctness. `tools/data-to-json.mjs --check` and `tools/validate-missions.mjs` become
the *only* guards on content validity, so **they must stay green** — for anything they
cannot check, Unity's importer is the next line of defence.

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

### 6.2 Terrain A/B spike — ⛔ VOID (2026-08-17)

> **This spike no longer applies.** It asked "which way do we import a DEM heightmap
> into Unity" — and after §1.5 there is no DEM heightmap to import. **Phase 2 is now
> scaffold + data importer + a perf gate on an imported hand-authored arena** (see §8
> and TASKS.md Phase 2). `bake-mesh.mjs` (Path A) was never built and is not needed.
>
> **What survives from this section:** the *gate criteria*, which carried over
> verbatim to GATE P2 — ≥30fps sustained with 12+ enemies, measured on a **real
> mid-range Android device** (~3-year-old ~$250 phone), with **thermal behaviour over
> 10 minutes**, because throttle is what actually kills mobile. And its rule: if the
> gate fails, **reduce scope now, not "optimize later."**
>
> Kept below for history only.

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

> **Step 1 revised 2026-08-17** (§1.5): the terrain A/B spike is void. **The data
> importer (step 2) is now the first Unity task**, followed by building `warzone`
> statically from `data/` as the perf-gate scene. Steps 3–14 are unchanged — none of
> them assumed GIS terrain.

1. ~~**Terrain A/B spike + `ghats` static**~~ → **`warzone` static from `data/`** ← **gate**
2. **Data importer** — SOs + editor importer. Early, ~200 LOC. **← now step 1.**
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

> **Revised 2026-08-17** (§1.5). Phase 1 is closed as research (Appendix A); Phase 2
> is rebuilt around the data importer; a new Phase 5 isolates `space`'s 6DOF risk.

| Phase | Work | Est. | Gate (kill/continue) |
|---|---|---|---|
| **0 — Data foundation** (web repo) ✅ | Externalize `data/*`; `campaign.data.js` graph; `save.js` v2 + migration; `data-to-json.mjs`; mission/objective + scripted-defeat schemas | done | **PASSED 2026-08-17.** All 8 arenas load unchanged from `data/`; `gen-pages.mjs --check` passes; JSON round-trips; v1 save migrates; AND-gate resolves. |
| **1 — GIS pipeline** ⛔ | `tools/gis/`; `ghats` heightmap + albedo; `ground.type:'heightmap'` | done | **ANSWERED "NO" 2026-08-17 — closed as a research track.** Real DEM did not read as a more real place than the hand-authored arenas. Fallback taken as written: hand-authored sites. See §1.5 + Appendix A. |
| **2 — Unity foundation + perf gate** | Unity 6 URP scaffold; **data importer** (moved up from P3.1); import `warzone` as a static scene from `data/`; profile on real mid-range Android with enemy stand-ins | 6–8 wk | **≥30fps sustained, 12+ enemies, 10-min thermal soak** on a ~$250 3-year-old phone — *and* a `data/` edit round-trips into Unity with zero hand-editing. If perf fails, reduce scope **now**, not later. |
| **3 — Unity vertical slice** | Player controller, enemies + NavMesh, WaveManager, baked audio, HUD, mission/objective system + `Target`/`Entity`. One site, one full mission, touch + gamepad | 12–16 wk | **Is it fun on a phone — judged by someone other than you?** If touch controls make a cover shooter miserable, solve it here, not after the roster exists. |
| **4 — Campaign spine (MSP)** | Hub map; per-scene `waveSet` wiring (§3.1); `jungle`, `warzone`, `arctic` (proves the branch); **`grid` + the scripted defeat**; `space` **as a foot-soldier arena** (the §3.2 fallback) | 12–16 wk | Start at jungle → real branch choice → lose at the Grid → fight in space. **This is the minimum shippable product.** Ship it if you must stop here — and note it ships *without* 6DOF. |
| **5 — `space` 6DOF ship combat** | Second movement/combat model: flight controller, 3D dogfighting, CREON + human vessels (§3.2) | 6–10 wk | **Is piloting fun on touch, and does it beat the Phase 4 foot-soldier version?** If no on either count, **keep the Phase 4 version and cut this phase.** The campaign already ships without it. |
| **6 — Roster fill** | `ocean` (new), `desert`, `urban`, `alien` — layout + `waveSet` + enemy types per §3.1. No new systems. | 2–4 wk/site | **Truncates at any site boundary.** A site needing a new *system* is out of scope by definition. |
| **7 — Android release** | Play Console, keystore (**backed up twice**), listing, closed testing, ASTC budget | 4–6 wk | Play Asset Delivery only if >200MB — likely 60–120MB; don't pre-build packs. |
| **8 — Steam** | Track F unchanged; `mars` is a natural post-launch drop | gated | On Android reception. |

**Why Phase 5 sits after the MSP gate, not before it:** 6DOF is the only genuinely new
system left, it lands on the finale, and it is the most likely thing to slip. Phasing it
*after* a complete shippable campaign means the ending exists either way — Phase 5 is an
upgrade to a shipped beat, not a dependency of it. This is the same structural trick that
keeps `grid`+`space` inside Phase 4 rather than the roster.

**Honest totals: Phases 2–4 ≈ 30–40 weeks to a shippable campaign.** Phase 5 adds 6–10;
the roster adds 2–4 per site. At ~12h/week this remains a multi-year project — the phasing
exists so a complete game lands at the end of Phase 4 and everything after is additive.
Retiring `ghats`/`ghats_east` and dropping the GIS pipeline took roughly 8–12 weeks of
projected work out of the plan.

---

## 9. Risks

1. **AAA quality on mobile, solo, is the dominant risk and it is not close.** AAA is a
   headcount, not a technique. What *is* achievable solo is **coherent art direction
   executed consistently** — which this project already demonstrates (filmic-neutral
   palette, amber-signal discipline, the CREON billboard). **Redefine the bar as "reads
   as premium and consistent," not "matches a 200-person studio."** Baked normals + LODs
   + one strong lighting model per biome buys more perceived quality than any feature.
2. **9 sites is still a lot** — mitigated structurally: the roster truncates at site
   boundaries, six sites already exist as finished data, and `grid`+`space` are built in
   Phase 4 so the arc is never hostage to the roster.
3. **Scripted defeat is easy to make feel cheap.** Mitigations in §4.4. If it still feels
   cheap in playtest, the fallback is a **pyrrhic win** (objectives met, Grid escapes to
   orbit) — preserves the space act at lower narrative risk.
4. ~~**The GIS hypothesis may be false.**~~ **RESOLVED 2026-08-17 — it was false.**
   Phase 1's gate killed it cheaply, exactly as designed: one site, ~two weeks, real
   evidence. See §1.5 and Appendix A. *Keep this entry — it is the plan's best proof
   that the gate structure works.*
5. **NEW — `space` 6DOF is the largest remaining unknown.** A second movement model,
   on the finale, with touch controls as the hard part. **Mitigated by Phase 5's
   position**: the campaign ships complete at the end of Phase 4 with `space` as a
   foot-soldier arena, so 6DOF can slip or be cut without costing the ending (§3.2).
   **Do not move Phase 5 earlier** — that would put the ending behind the riskiest work.
6. **NEW — "every site plays differently" can quietly become "every site needs a new
   system."** That is how a roster phase turns into six unplanned feature phases.
   **Mitigated by §3.1's rule**: variation must be expressible as `waveSet` + enemy
   types + layout. A site that needs more is a phase-level decision, and only `space`
   has earned one.
7. **Unity is more fun than finishing the data layer** — the old roadmap's stated death
   mode. The Phase 0 gate was the defence and it **held**: `data/` was finished and
   gated before any Unity work started.
8. **Web repo bit-rot** once gameplay is frozen — and after §4.7 this is **expected and
   accepted**, not merely tolerated. The web runtime will fall behind `data/` as new
   sites and enemy types land, and **nobody should spend time re-syncing it.**
   Mitigation: `data/`'s validity is guarded by `data-to-json.mjs --check` and
   `validate-missions.mjs` (which must stay green), not by the browser.
9. **`ocean` is the hardest new site** — platform geometry over water, no ground
   approach, fall-off-edge rules. No longer a *GIS* problem (no bathymetry needed), but
   still the roster's highest-effort row. Its flier-heavy design leans on `flies`/
   `flyHeight`, which already exist.
10. **Two repos will diverge** — §4.7 removes the web build as a correctness check on
    `data/`, so the export is the whole contract. **Mitigation is now mechanical, not
    a matter of discipline** (§4.6): `data/json/` is a checked-in copy guarded by a
    content-hash `manifest.json`, and the Unity importer **refuses to import** when the
    hash disagrees rather than importing partially. Plus: keep `data-to-json.mjs
    --check` and the data validator green, and **fix importer failures in `data/`,
    never by hand-editing the generated ScriptableObject.**

    **Severity, stated plainly:** this is a *rework and confusion* risk, **not a
    runtime one.** Data is baked into ScriptableObjects at Unity **edit time**, so bad
    data cannot reach a player as a crash — it fails on the developer's machine,
    before a build exists. What it actually costs is silently overwritten Unity-side
    fixes and a `data/` that has quietly stopped being the source of truth.

11. **Referential integrity across `data/` files is only partly checked.**
    `data-to-json.mjs` catches shape violations (functions/`undefined`, with a precise
    key path — importantly catching what `JSON.stringify` would silently *drop*), and
    `validate-missions.mjs` catches objective types outside the 11-type cap and
    `unlockNode`s naming nonexistent nodes. **Not yet checked:** that a scene's
    `waveSet` names a set that exists, that a wave set's `enemies[].type` names a real
    enemy type, that a campaign node's `scene` resolves, and that the graph stays
    acyclic (that last check has only ever run as a throwaway script).
    **This is exactly the class of bug P1.9.2 introduces** — it is the task that starts
    naming per-site `waveSet`s. Close the gap in that task, before the content that
    needs it is authored.

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

---

## Appendix A — GIS research track (closed)

**Status: closed 2026-08-17.** Ran as Phase 1, answered its gate question "no", and is
retained as reference. See §1.5 for the decision. **Do not build on this; do not delete
it.** Two findings are worth keeping.

### A.1 Real DEM is useless at combat scale — the load-bearing finding

Measured against Agumbe, Western Ghats (13.5178N, 75.0906E), AWS Terrarium tiles at z15
(4.64 m/px at that latitude):

| Window | Relief | Reads as |
|---|---|---|
| 400m (arena) | **27.9m** | A single smooth tilted plane. No cover, no ridges, no features. |
| 1200m (horizon) | **50.3m** | Real structure — ridges, valleys, recognizable landscape. |

At 4.6 m/px a 200m firefight box contains **~43 real samples**; everything a player
fights around is interpolation. **Real elevation data is worthless inside ~400m and only
becomes interesting beyond ~600m.** This held at every scale it was retested, including
at texture-tile scale during the albedo rewrite.

This is why the hybrid ("authored floor + real horizon") was adopted mid-phase, and
ultimately why the whole track was closed: once the only value is a distant silhouette,
a hand-authored skybox or backdrop mesh buys the same thing for far less machinery.

**If real terrain is ever revisited, revisit it as horizon/backdrop art only** — never
as the surface the player fights on.

### A.2 The `mat.color` bug — a real engine bug, fixed and kept

`_buildHeightmapGround()` (`src/scenes.js`) set `mat.color = col3(gc.fallbackColor)`
**unconditionally**, rather than only inside the albedo texture's load-error callback
(the pattern the sibling `'texture'` ground branch uses correctly). Because
`MeshStandardMaterial.map` multiplies against `.color`, this silently crushed a
successfully-loaded albedo toward near-black.

It cost two rounds of chasing the wrong thing (fog/lighting, then a full texture-generator
rewrite) before the actual cause surfaced. **This is not GIS-specific** — it would hit any
future `ground.type: 'heightmap'` scene identically, which is why the fix is committed on
its own merit regardless of the pipeline decision.

**Transferable lesson:** when a material looks wrong and the texture *loaded fine*, check
what multiplies against it before rewriting the texture.

### A.3 What exists on disk

| Path | What it is |
|---|---|
| `tools/gis/*.mjs` | Working, zero-dep pipeline: fetch → decode → heightmap + albedo bake. `--check`/`--dry-run` throughout. |
| `assets/terrain/ghats/` | Baked 16-bit heightmap PNG + metadata JSON + albedo. Elevation 619.5–704.1m over a 2400m window. |
| `data/scenes/ghats.data.js` | The playable ghats scene. Leaves `MISSION_ORDER` when the roster change lands; the file stays. |
| `_buildHeightmapGround()` (`src/scenes.js`) | The `ground.type: 'heightmap'` engine branch. Working, bug-fixed. |
| `docs/v2/spike/` | Original feasibility spike decoders. |
| `docs/track-e-gis.md` | The original GIS track doc. |

**Not built, deliberately:** `fetch-imagery.mjs` (Sentinel-2 albedo) and
`bake-mesh.mjs` (Path A of the void terrain A/B spike). Neither is needed now.

**`docs/v2/gis-attribution.md` (was P1.6) is not required** — no GIS-derived artifact
ships in the game. If any baked terrain output is ever shipped, the attribution
obligations in §5.1 apply and that doc must be written first.
