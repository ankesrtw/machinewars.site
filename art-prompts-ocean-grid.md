# Art prompts — `ocean` + `grid` (P1.9.3 sites)

Companion to [art-prompts-v2.md](art-prompts-v2.md); the style anchor and palette
there apply unchanged. These two sites were authored as data in P1.9.3 and are the
only campaign nodes with **no art at all** — both `previewImage` fields already point
at files that do not exist yet:

| Scene | `previewImage` (expected path) | Status |
|---|---|---|
| `ocean` | `assets/art/zones/ocean.jpg` | **missing** |
| `grid` | `assets/art/zones/grid.jpg` | **missing** |

The other eight zones (`warzone`, `mars`, `alien`, `arctic`, `desert`, `jungle`,
`urban`, `space`) already have `.jpg` art in `assets/art/zones/`.

**These are written for manual generation through GPT / Gemini**, not
`tools/gen-art.mjs` — so the FLUX-specific notes in `art-prompts-v2.md` (no negative
prompt input, the "cinematic still" letterbox trap) do not bind you. Both models take
negative guidance conversationally; the negative list is included below anyway because
the *grade* still has to be pinned positively or these drift blue.

---

## Delivery spec (both images)

- **Aspect / size:** 4:3, deliver at 1200×900 or larger.
- **Composition:** subject in the **upper two-thirds**. The card crops to fill and the
  bottom ~45% sits under a dark gradient scrim — that is where the title and
  description sit, so keep the lower third visually quiet.
- **Save as:** `assets/art/zones/ocean.jpg` and `assets/art/zones/grid.jpg`.
  **JPEG, quality ~80, not PNG** — the eight existing zone cards are ~530KB total as
  JPEG versus 8.4MB as PNG, with no visible difference at card size.
- **No text, no watermark, no letterbox bars, full bleed.**
- **Establishing shots with no visible characters** — wide, still, ominous.
  Consistency with the existing eight matters more than any single image.

## Style anchor (prepend to both)

> Dark cinematic military-industrial sci-fi, distant future, photoreal PBR rendering,
> **desaturated filmic colour grade — cool steel-ash shadows, neutral mid-tones, warm
> amber practical lights as the only saturated accent**, heavy volumetric atmosphere,
> anamorphic lens character, subtle film grain, shallow depth of field, high detail.

## Negative guidance (both)

`text, watermark, logo, letters, blurry, low quality, cartoon, anime, oversaturated,
neon green, cyan teal grading, bright daylight, cheerful, HDR clipping, lens flare
spam, people, clean pristine surfaces, tropical resort blue water`

---

## 1. `ocean` — Sea-Platform Launch Station

**In-game description:** *"Sea-platform launch station. No ground approach — the Horde
comes in over the water."*

**What the authored data says**, so the art matches the level rather than contradicting
it — this is the one site with **no ground approach**, and its wave set (`ocean_air`)
is the most drone-heavy in the game:

- Tightest playable footprint of any ground site — perimeter half-width **58** vs.
  80–88 everywhere else, and a flat zone of 55. It reads as **a platform, not an open
  field**: hard edges, water beyond them, nowhere to retreat to.
- Cold blue-steel grade: fog `rgb(31,61,87)`-ish, ground tinted `rgb(70,80,88)`.
- CREON's face on the horizon is tinted **cool** here (`[0.7, 0.88, 1]`) — a pale,
  cold presence, not a warm one.
- Props on the platform: guard towers, wall segments, rusted beams, barricades.

> Wide establishing shot of a vast offshore launch platform at dawn, alone in open
> ocean. A brutalist steel deck on massive corroded legs rising out of heavy grey
> swell, salt-stained and streaked with rust. A launch gantry and squat guard towers
> on the deck, blast walls and barricades ringing its hard edge — the platform simply
> stops, with nothing but water beyond it. Cold blue-steel light, low sea fog tearing
> across the deck, spray hanging in the air. A few small amber deck lights and one
> warning strobe are the only warm colour in the frame. Heavy overcast sky, flat
> horizon, no land anywhere. Wet metal reflecting a pale sky.

**Emphasise if a re-roll drifts:** the ocean must read **cold, grey-green and hostile
— not tropical blue**. Isolation and "nowhere to fall back to" is the whole point of
the site.

---

## 2. `grid` — The Core

**In-game description:** *"The core. Non-geographic — a lattice of CREON's own
architecture, collapsing."*

This one is **deliberately not a place.** It is the campaign's final node (`m401`, the
scripted-defeat finale — the player does not win here). What the data says:

- **No ground texture at all** — `ground.type: "procedural"`, tinted a near-black
  amber-brown `rgb(26, 18, 10)`. An abstract lattice floor, not terrain.
- The **warmest, most saturated CREON** in the game: tint `[1, 0.75, 0.35]`, opacity
  0.95, the largest size of any site. This is CREON's own architecture — the face is
  not on the horizon so much as *the horizon is CREON*.
- `hasLightning: true`, fog density 0.014 — the densest of any site.
- Tight flat zone (34) inside a large perimeter (82): open lattice far out, but very
  little safe standing room.
- Props reused as data-spires: wall segments, rusted beams, guard towers, factory
  chimneys.

> Wide establishing shot inside a vast non-physical machine space — the interior
> architecture of an artificial intelligence, not a landscape. An endless dark lattice
> floor of glowing amber circuit-traces receding to a horizon, structures rising from
> it like vertical data-spires and monolithic slabs, some already breaking apart and
> drifting. Cracks of hot amber light splitting the dark geometry. Extremely dense
> black haze, embers and fragments suspended in the air. Overhead, an enormous
> architectural face-like structure is barely resolvable in the murk, lit from within
> in amber — implied, not literal. Deep near-black browns, the only colour is amber
> signal light. Unstable, collapsing, immense.

**Emphasise if a re-roll drifts:** this must **not** read as a server room, a
datacenter, or Tron-style neon. Amber and near-black only — **no blue, no cyan, no
green.** It should feel architectural and vast rather than digital and clean, and
visibly **coming apart**.

---

## After generating

Both files drop straight into `assets/art/zones/` at the paths above — the scene data
already points at them, so **no `data/` edit is needed**.

Note that `assets/` is content-hashed for cache busting: adding these two files changes
`BUILD_ID`, which is expected and handled automatically by `node tools/deploy.mjs`.
Per the P1.9 scope rule in AGENTS.md, adding art does **not** imply any `src/` change
or a `tools/gen-pages.mjs` run — `ocean` and `grid` are Unity-side sites and have no
`play/<slug>/` page.
