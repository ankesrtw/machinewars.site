# Track B — Content depth as data

Weeks 2–20+. See [ROADMAP.md](ROADMAP.md) for how this fits the whole plan.

**This is the most important track.** Everything here must be a **data file**
Unity deserializes verbatim. Content written as JavaScript `if`-chains is
content you pay for twice.

---

## Phase 1 — Collapse duplication & externalize (weeks 2–5) ← hard deadline

### 1.1 Collapse the 8 near-identical HTML pages

`play/mars/index.html` and `play/urban/index.html` differ by **4 lines** (title,
meta description, 2 lines of arena blurb). `AGENTS.md` documents that every HUD
change must be hand-synced 7×. **Every Track B hour costs 7× until this is
fixed**, which is why it comes first.

Keep the 7 URLs (SEO, share links, Cloudflare) but reduce each page to a
~20-line shell:

```html
<body data-scene="mars">
  <!-- title/meta only -->
  <script type="importmap"> ...unchanged, ../../... </script>
  <script type="module" src="../../src/main.js"></script>
</body>
```

Move the ~120 lines of HUD markup into a new **`src/ui/hud-template.js`** that
injects it into `document.body` at boot — a template literal, not a fetched
partial, so it works under every URL scheme. Same for the touch-control markup
currently generated inline in `main.js`. Pull title/meta text from
`SCENE_CONFIGS[slug].name/description`, which already exists.

**~840 lines of duplicated HTML → ~140 lines in one module.**

Add `packaging/gen-arenas.mjs` (~30 LOC) to regenerate the 7 shells from scene
data, so arena #8 is a data edit plus one script run. This is the *only* build
step worth adding, and it stays optional and manual.

### 1.2 Externalize all content to `data/*.data.js`

Each file is a single `export default { ... }` of a JSON-literal object —
**not `.json`**. Plain `import` needs no fetch, so it behaves identically on
Cloudflare Pages, in Capacitor (`https://localhost`), and in Electron under any
scheme. A 20-line Node script converts them to real JSON for Unity. All of the
migration benefit, none of the loading risk.

| From | To |
|---|---|
| `SCENE_CONFIGS` (`src/scenes-data.js`, 1332 LOC) | `data/scenes/<slug>.data.js` ×7 |
| `ENEMY_TYPES` (`src/enemies.js:153`) | `data/enemies.data.js` |
| `WAVE_CONFIGS` (`src/enemies.js:175`) | `data/waves/<setId>.data.js` — **named sets**, not one global array, so missions pick their own |
| `WEAPONS` (`src/main.js:25`) | `data/weapons.data.js` |
| `SCORE_VALUES` (`src/main.js:31`) | fold into `data/enemies.data.js` as a per-type `score` |

`src/scenes-data.js` becomes a thin loader that merges the data and applies the
existing `ASSET_BASE` / `import.meta.url` resolution (`src/scenes-data.js:14`) —
that pattern is wrapper-proof and must be preserved.

**With Unity running in parallel, this is the contract between the two
codebases.** Finish it before Unity's data importer is written.

---

## Phase 2 — Campaign & content (weeks 4–20)

### 2.1 Story system

The four acts (THE CONSORTIUM / THE ROGUE / THE GHOST / THE WAR) and three
factions (Human Resistance / Machine Horde / The Ghost) currently exist only as
marketing copy in `index.html`. Promote them to a schema.

`data/campaign.data.js` — acts as
`{ id, title, faction, unlockedBy, missions: [...] }`.

`data/missions/<id>.data.js`:
```js
{ id: 'm101', act: 'act01', scene: 'warzone', title: 'FIRST CONTACT',
  briefing: { speaker: 'CREON', lines: [...], portrait: 'art/creon-machine-wars.png' },
  waveSet: 'act01_intro',
  objectives: [ { type: 'survive_waves', count: 5 },
                { type: 'kill_type', enemy: 'heavy', count: 3, optional: true },
                { type: 'protect', targetId: 'relay', hp: 200 } ],
  rewards: { unlockArena: 'mars', unlockWeapon: 'railgun', unlockMission: 'm102' },
  debrief: { lines: [...] } }
```

New **`src/mission.js`** (~200 LOC): a `MissionRunner` using the same
dependency-injection shape as `WaveManager.setContext()` (`src/enemies.js:29`) —
the cleanest pattern in the codebase, copy it. It subscribes to events the game
already produces; add ~6 event emit points to `main.js`/`enemies.js`.

**Objective vocabulary — hard cap of 11 types.** Start with `survive_waves`,
`kill_count`, `kill_type`, `protect`, `reach_zone`, `time_limit`, `no_damage`,
`weapon_restriction`; add exactly three more in 2.5 (`destroy_targets`,
`rescue`, `escort`). These compose into far more than 30 missions, and in Unity
they become 11 small C# classes with the mission data porting unchanged.

Briefing/debrief screens are DOM overlays styled off the existing `#aw-loading`
and win-screen CSS. The objective tracker slots in beside `#hud-wave`; reuse
`HUD._showBanner()` for objective-complete pops.

### 2.2 Enemies & bosses

New types are pure `data/enemies.data.js` edits as long as they compose existing
flags (`zigzag`, `flies`, `flyHeight`, `firesBack`, `fireInterval`). Add **at
most 3 new flags** — `preferredRange`, `damageMultiplierByAngle`,
`spawnsOnDeath` — and you unlock `sniper`, `swarm`, `shield`, `spider`,
`artillery`.

**Bosses:** the current boss is a scaled-up procedural grunt. Give bosses a
`phases: [{ hpThreshold, speed, fireInterval, spawns }]` array — ~40 LOC in
`Enemy.tick`. Three distinct phased bosses, one per act, with CREON as the
act-04 finale.

### 2.3 Weapons

`data/weapons.data.js` already parameterizes ammo/damage/fireRate/pellets/
spread/auto/sound. Add one field — `projectileSpeed` (0 = hitscan) — and
`railgun` (pierce), `plasma` (projectile + splash, reusing the grenade transient
path in `_transients`), and `sticky` are mostly data.

### 2.4 Music — highest perceived quality per hour available

11MB of Suno tracks sit unused, and `vendor/music/music-player.js` +
`game-music.js` are dead code referenced by no HTML page. **Don't revive the
player.** Add `Audio.playTrack(url, { loop, fadeIn })` (~20 LOC) to
`src/audio.js`, routed through the existing `Audio._musicGain` node already
wired to the settings slider at `src/main.js:986`. Per-scene track selection is
a `music:` field in scene data; crossfade combat/ambient by wave state.

### 2.5 Mission archetypes — and the one change they all need

Target archetypes: *Defend the Grid*, *Destroy CREON's Grid*, *Rescue the
Hostages*, *Save the Assets*. Mission variety — not arena count — is what makes
7 environments feel like a game instead of 7 skins.

**They share one dependency, and it must be built first.** Today the game has
exactly one relationship: **enemies always seek the player.** `Enemy.tick` seeks
`ctx.camera`'s position unconditionally. Every archetype breaks that assumption.

Build these three primitives once (~250 LOC total):

1. **`Target` abstraction** — replace the hardcoded camera-seek with
   `enemy.target`, resolving to the player *or* a world entity. Enemies pick by
   mission-defined priority (`nearest`, `player`, `objective`, `weakest`). This
   is the keystone; nothing else works without it.
2. **`Entity` class for non-enemies** — position, HP, model, and a state
   (`intact` / `damaged` / `destroyed` / `rescued`). Covers generators, relays,
   hostages, crates, allied units. Reuse the `_registerCoverObstacles` pattern
   (`src/scenes.js:216`) so entities are solid before their GLB decodes.
3. **`reach_zone` + escort movement** — a marked volume the player or a follower
   must reach. The simplest follower AI (move toward the player, stop at a
   radius) is enough. **Do not build sophisticated companion AI on web** — that
   is Unity NavMesh work.

Then the archetypes are mission data:

| Archetype | Objectives | New mechanic |
|---|---|---|
| **Defend the Grid** | `protect` (relay HP) + `survive_waves` | Target priority `objective` — enemies attack the relay, not you. Forces real positioning instead of backpedalling. |
| **Destroy CREON's Grid** | `destroy_targets` (n nodes) + `time_limit` | Player-damageable entities. Inverts the loop: *you* are the aggressor, under pressure. |
| **Rescue Hostages** | `rescue` (n) + `escort` to `reach_zone` | Follower movement + a fail state on hostage death — the first loss condition beyond your own HP. |
| **Save the Assets** | `protect` ×n, partial credit | Scored on how many survived, not binary pass/fail. Best replay hook of the four. |
| *(free)* | `no_damage`, `weapon_restriction`, `time_limit` layered on any of the above | none — pure data |

**Web vs Unity fidelity.** Build all of it on web as data — that is what Unity
imports. But be realistic: escort and rescue need genuine pathfinding to not
feel janky, and the web build's `_noProgress`/wall-follow heuristic will make
followers look stupid. Ship the web versions as simple, readable, arena-scale
encounters; let Unity's NavMesh and verticality make them properly good. **The
mission data is identical in both** — only the fidelity differs. That is the
whole payoff of the data-first architecture.

### 2.6 Bigger arenas — within the real ceiling

`perimeter.halfW/halfD` (currently ~55) can reach ~120 before far-plane clipping
shows. Make camera `far` a quality-preset field and raise it to 600–800 on
`high` only (`src/main.js:167`) — the shadow map and fog are the real cost, not
the far plane.

**Do not retrofit verticality on web.** Flat-AABB `checkCollision()`
(`src/main.js:562`) plus the `_noProgress`/wall-follow/`_climb` pathfinder is
exactly the work Unity discards. Verticality is a Unity feature.

Cheap instead: **arena variants** — same geometry, different
lighting/fog/spawn/hazards per mission via a `sceneOverrides` block in mission
data. Night Mars, sandstorm Desert, flooded Urban. 7 arenas × 3 variants = 21
environments for near-zero cost, all as portable data.

---

## Verification

- **Phase 1:** all 7 arenas load an identical HUD from the single template; edit
  one HUD element and confirm it changes on all 7. `window.AWDebug.world`
  reports the right scene.
- **Phase 2:** complete Act 01, close the tab, reopen — unlocks persist. Every
  new enemy and weapon added **without touching `enemies.js`/`main.js` logic**.
  Each archetype end-to-end: enemies actually attack the relay instead of you in
  *Defend the Grid*; a hostage death fails the mission; *Save the Assets* scores
  partial survival correctly.
