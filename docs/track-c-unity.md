# Track C — Unity v2

Starts now, in parallel. Ships ~week 50+. See [ROADMAP.md](ROADMAP.md).

One Unity project produces **native Android and Steam builds**. This is the v2
product — it is *not* a dependency of the Android wrapper in Track A.

---

## The risk, stated once

Starting Unity immediately rather than waiting for a demand signal is a
deliberate choice. But it is the documented way this project shape dies:
**Unity is more fun than finishing the web campaign, and the Unity port reads
its content from that campaign.** If Track B stalls, Unity has nothing to import
and quietly becomes a from-scratch redesign — a multi-year project instead of a
one-year one.

**Concretely: do not let Unity work push Track B Phase 1 (data externalization)
past week 5.** That is the one hard ordering constraint in the whole roadmap.

---

## Setup

**Unity 6 LTS + URP.** The only pipeline that serves mid-range Android *and*
Steam from one project. Not HDRP (kills Android), not Built-in (deprecated).

Start from the URP 3D template, then build **two URP Asset variants**:

| | Mobile | Desktop |
|---|---|---|
| Shadow cascades | 1 | 4 |
| Post | cheap bloom only | full stack |
| Rendering | Forward | Forward+ |
| MSAA | off | on |
| Render scale | 0.7–0.85 | 1.0 |

The existing `QUALITY_PRESETS` (`src/main.js:18`) map onto URP quality levels —
port the **semantics**, not the numbers.

Graphics APIs: **Vulkan first, GLES3 fallback** on Android; DX11/DX12 on
Windows. Linear color space. Texture compression **ASTC** on Android,
**BC7** (albedo) / **BC5** (normals) on Windows.

---

## What ports directly

| Web | Unity | Notes |
|---|---|---|
| 14 Draco GLBs | **glTFast** (`com.unity.cloud.gltfast`) | Unity-maintained, supports KHR_draco. Import at **edit time as prefabs** — never runtime-load glTF on mobile |
| `data/scenes/*.data.js` | `SceneConfigSO` | via a `[MenuItem]` editor importer |
| `data/enemies.data.js` | `EnemyTypeSO` | same importer |
| `data/waves/*.data.js` | `WaveSetSO` | same importer |
| `data/missions/*.data.js` | `MissionSO` + 11 `ObjectiveSO` subclasses | the payoff for Track B 2.1 |
| `data/weapons.data.js` | `WeaponSO` | same importer |
| Ground/sky textures | ASTC/BC7 re-import | re-export at 2048 or 1024; the current PNGs are overkill |
| Suno MP3s | `.ogg`/Vorbis, streaming load | |
| `art-prompts.md` | content pipeline doc | keep generating with the same conventions |

**Write the data importer early** (~150 LOC, step 2 below). It is the thing that
makes all later content free.

---

## Two things NOT to port

### The enemy pathfinding

`enemies.js`'s pursuit is a *sophisticated workaround for not having
pathfinding*: try the direct heading, then progressively wider deflections,
track `_noProgress` in seconds, escalate to a committed wall-follow, then a
self-cancelling `_climb` step-over hop. It exists because Three.js gives you
nothing.

Unity's `NavMeshAgent` + baked NavMesh gives real path avoidance,
`NavMeshObstacle` carving for destructibles, `OffMeshLink` for the step-over
`_climb` approximates, and crowd avoidance for the pile-ups you get at wave 9's
17 simultaneous enemies. Porting the deflection heuristic means shipping a worse
system *and* maintaining a workaround for a problem you no longer have.

**Port the tuning data** (hp/speed/damage/fireInterval/zigzag/flyHeight) **and
the feel** — zigzag becomes an agent velocity offset; flying enemies leave the
NavMesh and steer directly at `flyHeight`.

### The procedural audio

`src/audio.js` is 689 LOC of Web Audio synthesis — there is no equivalent to
port, and reimplementing it as Unity DSP is weeks of work for a worse result.

**Bake instead.** Write a throwaway HTML page that runs each `Audio.play*()`
method through an `OfflineAudioContext` and downloads the rendered buffer as
WAV: `gunshot`, `shotgun`, `minigun`, `hit`, `explosion`, `footstep`, `damage`,
`reload`, `wave_alarm`, `empty_click`, `enemy_fire`, `heartbeat`. Twelve files,
an afternoon.

Then render 3–5 pitch/timbre variants of each by varying the synth params before
rendering, so Unity can randomize. **This is strictly better than the web
version**, which regenerates an identical waveform on every shot.

Import into Unity behind an AudioMixer with Master/SFX/Music groups matching the
existing three sliders.

---

## What must be built fresh

- **HUD — the largest single cost.** `hud.js` (129 LOC) + `css/style.css` (384)
  + injected markup + the Canvas2D radar. Rebuild in **UI Toolkit** (UXML/USS
  translate near concept-for-concept from the existing HTML/CSS, and it is the
  future-facing choice). Radar as a small `RenderTexture` from an orthographic
  top-down camera — that beats reimplementing `HUD.drawRadar()`. **Budget 2–3
  weeks, do it at step 7 not step 2, and ship it ugly-but-functional first.**
- **Input System** `InputActionAsset` with KBM / Gamepad / Touch schemes. Track A
  0.3's gamepad mapping is the spec — the bindings get designed once.
- **Saves** — the identical JSON schema from `src/save.js`, via
  `JsonUtility`/Newtonsoft to `Application.persistentDataPath`. Same schema means
  a web save can even be imported.
- **Steamworks.NET** (free, MIT), mirroring the achievement IDs from Track F.
  Steam Cloud points at `persistentDataPath`.
- **Verticality / multi-level arenas** — the thing the web build structurally
  cannot do, and the clearest reason v2 exists.
- **Object pooling** — Unity 6's `ObjectPool<T>`; `fx.js`'s pool design ports
  conceptually.
- **Play Asset Delivery** — *only* if the Android build exceeds ~200MB. With
  ASTC textures you will likely land at 60–120MB. Plan for install-time packs;
  don't build them until the limit forces it.

---

## Port order

1. **Empty URP project + one arena, static.** Import `warzone` GLBs via
   glTFast, hand-place from scene data. Prove the look on a real phone.
   **Gate: if a mid-range Android can't hold 30fps here, everything downstream
   is wrong.**
2. **Data importer** — ScriptableObject types + the editor importer. Early.
3. **Player controller + Input System** (KBM, gamepad, touch). Weapons from
   `WeaponSO`, hitscan raycast, no enemies yet.
4. **Enemies + NavMesh.** One type, then all from `EnemyTypeSO`.
5. **WaveManager** — a near-mechanical port of the spawn/queue logic, minus the
   pathfinding.
6. **Audio** — baked WAVs + AudioMixer.
7. **HUD in UI Toolkit** — the big one.
8. **Mission/objective system** from `MissionSO` — where the Track B campaign
   lights up.
9. **Save/settings/menus.**
10. **VFX** — `fx.js`'s procedural textures → VFX Graph / Shuriken.
11. **World builder from scene data** — automate placement so all 7 arenas exist.
12. **Platform** — Steamworks.NET + achievements, then Android + Play.

Steps 1–5 are ~40% of the code and 25% of the calendar. **Step 7 alone can be
20%.**

---

## Verification

- **Step 1 gate:** the vertical slice holds 30fps on a mid-range Android
  *before* any further systems work. If it doesn't, the answer is scope
  reduction (fewer enemies, simpler URP tier), not "optimize later."
- **Step 2:** a scene/enemy/mission edit in `data/*.data.js` round-trips into
  Unity with no hand-editing.
- **Full slice:** one arena, one mission, gamepad + touch, 30fps on mid-range
  Android and 60+ on desktop, all content loaded from the same data files the
  web build uses.
