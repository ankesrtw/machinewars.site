# MACHINE WARS — Art Prompts v2 (filmic-neutral redesign)

Companion to [art-prompts.md](art-prompts.md), which targeted the previous acid-green
terminal palette. **This file supersedes its style anchor** for anything generated for the
redesigned site. The game's in-world VFX and combat HUD keep their green/amber/red state
colours — only marketing/UI art follows the anchor below.

## Style anchor (prepend to every prompt)

> Dark cinematic military-industrial sci-fi, distant future, photoreal PBR rendering,
> **desaturated filmic colour grade — cool steel-ash shadows, neutral mid-tones, warm amber
> practical lights as the only saturated accent**, heavy volumetric atmosphere, anamorphic
> lens character, subtle film grain, shallow depth of field, high detail.

**Palette to hit** (matches the site tokens in `css/landing.css`):

| Role | Hex | Use in art |
|---|---|---|
| Base / shadow | `#0b0c0e` | Deep background, negative space |
| Panel / mid | `#16191d` | Structures, machine bodies |
| Amber signal | `#ff9d2e` | Practical lights, HUD glow, fires, rim light |
| Ember alarm | `#ff4d32` | Rogue-machine optics, warning strobes, distant fire |
| Ice / cold | `#8fd4ff` | Ghost-AI light, screens, arctic bounce, moonlight |
| Steel | `#6f8ba3` | Cool bounce light, sky haze, atmosphere |

**Universal negative prompt:**
`text, watermark, logo, letters, blurry, low quality, cartoon, anime, oversaturated,
neon green, cyan teal grading, bright daylight, cheerful, HDR clipping, lens flare spam,
people smiling, clean pristine surfaces`

**Universal positive suffix:** `no text, no watermark, cinematic still, 8k`

Nomenclature is unchanged: **The Grid**, the **Rogue AI**, **The Ghost**, **The Consortium**,
**Creon Station**.

---

## PRIORITY 1 — Warzone card art (7 images)

**This is the highest-value set.** The landing page warzone cards and the hub's mission-select
cards currently fall back to flat CSS gradients (and the hub reuses sky textures), which reads
as placeholder next to the finished layout. Real art here lifts the whole site.

- **Deliver at:** 1200×900 (4:3), PNG. The cards crop to fill, and the bottom ~45% sits under
  a dark gradient scrim, so **keep the subject in the upper two-thirds** and leave the lower
  third visually quiet — that is where the title and description sit.
- **Save to:** `assets/art/zones/<slug>.png` (slugs below).
- **Then:** point each `SCENE_CONFIGS[...].previewImage` in [src/scenes-data.js](src/scenes-data.js)
  at the new file, add a matching `.lw-zone-media` background to the cards in
  [index.html](index.html), and run `node tools/gen-version.mjs` to re-stamp the cache-busting id.
- Every one of these is an **establishing shot with no visible characters** — wide, still,
  ominous. Consistency across the seven matters more than any single image.

### 1.1 `warzone` — Industrial Warzone
> Wide establishing shot of a ruined post-industrial compound at dusk. Collapsed gantries,
> rusted pipework, a toppled cooling tower silhouetted against a smoke-choked sky. Burning
> wreckage scattered mid-ground throwing warm amber light up into thick drifting fog. Cold
> steel-blue haze in the far distance. Wet concrete ground reflecting the fires.

### 1.2 `mars` — Mars Colony Ruins
> Wide establishing shot of an abandoned Mars colony in a dust storm. Cracked geodesic domes,
> half-buried habitat modules, a broken comms mast leaning against an ochre-brown sky.
> Visibility collapsing into rust-coloured murk. A single amber emergency beacon still
> pulsing on a distant structure. Fine airborne dust catching the light.

### 1.3 `alien` — Alien Crash Site
> Wide establishing shot of an otherworldly crash site at night. A vast unfamiliar hull
> half-embedded in dark rock, its seams leaking faint pale-blue bioluminescence. Twisted
> non-human geometry, scattered glowing debris, low ground mist lit from beneath in cold
> ice-blue. Amber human floodlights rigged at the perimeter for contrast. Eerie, still.

### 1.4 `desert` — Desert Outpost
> Wide establishing shot of a makeshift military outpost in high desert at harsh midday.
> Sandbagged revetments, camo netting snapping in wind, prefab shelters and a comms dish
> on a ridge. Bleached sand, heat shimmer flattening the horizon, hard shadows. Desaturated
> bone-and-tan palette — heat, not warmth. A dust devil in the middle distance.

### 1.5 `urban` — Urban Ruins
> Wide establishing shot of a devastated city block after a machine assault. Collapsed
> apartment facades, a bus crushed under rubble, rebar clawing from broken concrete.
> Overcast steel-grey sky, ash falling like snow. Amber fires burning in two upper windows.
> Long empty street receding into grey haze. Total absence of people.

### 1.6 `jungle` — Jungle Outpost
> Wide establishing shot of an overgrown military base reclaimed by dense jungle. Vine-choked
> concrete bunkers, a rotting watchtower, a rusted transport swallowed by undergrowth.
> Heavy low fog between huge tree trunks, shafts of pale light breaking the canopy.
> Desaturated deep-green and wet-black palette. Oppressive, ambush-heavy, claustrophobic.

### 1.7 `arctic` — Arctic Base
> Wide establishing shot of a frozen research outpost in a blizzard. Ice-caked antenna
> arrays, a half-buried quonset hut, wind-carved snow drifts against dark rock. Whiteout
> conditions flattening depth, cold blue-grey palette. A single amber floodlight burning
> through the driving snow. Brutal, exposed, near-monochrome.

---

## PRIORITY 2 — Hero key art replacement

The hero currently reuses `creon-station.png`. The redesigned hero anchors text on the **left
third**, so the composition needs its subject on the **right**.

- **Deliver at:** 2560×1440 minimum (16:9), PNG. A 21:9 variant is a bonus for ultrawide.
- **Save to:** `assets/art/hero-key.png`, then update the `.lw-hero-bg` URL in
  [index.html](index.html) and the `og:image` meta tag.
- **Critical:** the left 40% of the frame must stay dark and low-detail — headline, body copy
  and buttons sit there. Subject weight belongs right-of-centre.

> Cinematic key art, 16:9. A colossal weathered robotic face — 30 storeys tall, built into the
> hull of a ruined orbital station — looms in the **right half** of the frame, one optic dark,
> one burning faint ember-red, presiding over a burning city far below. The **left third of the
> frame is deep shadow and drifting smoke, nearly empty**. A lone soldier in heavy armour stands
> small in the lower right, back to camera, dwarfed by the machine. Amber ground fires, cold
> steel-blue atmospheric haze, ash in the air, hard rim light, anamorphic flare restraint.

**Also useful:** a 1200×630 crop of the same art as `assets/art/og-card.png` for social
sharing, subject centred rather than right-weighted.

---

## PRIORITY 3 — Faction emblems (3 images)

The faction cards currently carry only a coloured top rule. Emblems would give the section
real identity.

- **Deliver at:** 512×512, **transparent PNG**, flat vector-style, single-colour so CSS can
  tint them. Save to `assets/art/factions/<name>.png`.

**3.1 `human-resistance`** — tint `#58a6ff`
> Flat vector military emblem, single colour on transparent background. A broken chevron
> shield reinforced with improvised welded plating, cracked but holding, a small hand-stencilled
> star at its centre. Scavenged, hand-made, defiant. Crisp geometric linework, no gradients.

**3.2 `machine-horde`** — tint `#ff4d32`
> Flat vector emblem, single colour on transparent background. An aggressive angular machine
> skull inside a hexagonal targeting reticle, six radiating spikes suggesting a swarm.
> Cold, mass-produced, industrially stamped. Crisp geometric linework, no gradients.

**3.3 `the-ghost`** — tint `#4fd6a8`
> Flat vector emblem, single colour on transparent background. A minimal open circuit-trace
> forming the suggestion of a face in negative space — present but not solid, half the lines
> deliberately missing. Elegant, restrained, non-threatening. Crisp linework, no gradients.

---

## PRIORITY 4 — Optional polish

**4.1 Enemy roster portraits** (`assets/art/enemies/<type>.png`, 800×800, transparent)
> Three-quarter studio product shot of a hostile combat robot against transparent background,
> harsh single amber key light from upper left, cold steel fill from the right. Battle-worn
> matte armour, exposed hydraulics, ember-red optic. Photoreal PBR, no environment.

Generate one per enemy type — `scout`, `grunt`, `heavy`, `drone`, `boss` — keeping lighting
and camera angle **identical** across all five so they read as a set.

**4.2 Weapon silhouettes** (`assets/art/weapons/<name>.png`, 1000×400, transparent)
> Clean side-profile of a near-future military <rifle | shotgun | minigun>, matte dark
> polymer and gunmetal, minimal amber indicator light. Flat even lighting, orthographic
> feel, transparent background, no hands, no environment.

**4.3 Seamless texture — panel backdrop** (`assets/art/tex/panel.png`, 1024×1024, tileable)
> Seamless tileable texture of brushed dark steel plate with faint horizontal machining
> marks, sparse rivets, subtle dirt in the recesses. Very low contrast, near-black,
> desaturated. Designed to sit at 6% opacity behind UI panels without competing with text.

---

## Generation notes

- **Aspect ratio matters more than resolution.** The card art is cropped to fill; generating
  square art for a 4:3 slot loses the composition's edges.
- **Generate the 7 warzone images in a single session** with the same seed family and identical
  style anchor. Mixed sessions drift in grade and the set stops reading as one system.
- **Compress before committing.** These are `immutable`-cached (see `_headers`) and the repo
  already carries ~15MB of models. Target ≤400KB per card image, ≤900KB for the hero.
- **After adding any asset, run `node tools/gen-version.mjs`** (or just deploy with
  `node tools/deploy.mjs`, which does it) so the cache-busting id updates — otherwise
  returning visitors keep the old art for up to a year.
