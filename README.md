# Machine Wars

Humans and the Grid, Everywhere — Three.js wave-survival shooter set in a distant future. A rogue
AI seized 60% of the planet's key assets and turned its war machines on the species.
A dissenting intelligence (the Ghost) holds the remaining 40% and stands with humanity.
Defend your position against ten waves of war machines across seven arenas: PBR
materials, bloom & post-processing, soft shadows, GPU particles.

## Site structure

| Path | What |
|---|---|
| `index.html` | Landing page (marketing / shooter design) — `/` |
| `play/index.html` | Game hub — `/play/` — scene picker + default arena (importmap → self-hosted Three.js r17x ES modules, no build step, no CDN) |
| `play/<scene>/index.html` | Per-arena game page — `/play/warzone/`, `/play/mars/`, … each opens separately in its own tab/window |
| `src/` | App modules — `main.js`, `scenes.js`/`scenes-data.js`, `enemies.js`, `hud.js`, `fx.js`, `audio.js`, `gltf.js` |
| `assets/` | 14 GLBs (KHR_draco) + ground/skybox texture pairs + logo/icon + key art + teaser video |
| `vendor/three/` | Self-hosted Three.js core + addons (postprocessing, GLTF/DRACO loaders) |
| `vendor/music/` | Music-player (js + css) + no-auth stub |
| `music/data/tracks-default.json` | Soundtrack catalog (currently pinned teaser track only) |
| `art-prompts.md` | Image-generation prompts for the Machine Wars universe |
| `_headers` | Pages cache rules — GLBs/textures immutable, HTML never cached |

`src/scenes-data.js` derives `ASSET_BASE` from the current page depth, so it resolves
correctly both at the hub (`/play/`) and on any per-arena subpage (`/play/<scene>/`).

## Local dev

```bash
python3 -m http.server 8931
# landing: http://localhost:8931/ | hub: http://localhost:8931/play/
# arenas: http://localhost:8931/play/warzone/ (or mars, alien, desert, urban, jungle, arctic)
```

## Deploy (Cloudflare Pages)

```bash
source ~/.nvm/nvm.sh
source .env              # CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN (never commit)
wrangler whoami          # verify account
wrangler pages deploy . --project-name machinewars-site --commit-dirty=true
```