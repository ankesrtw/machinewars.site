# Machine Wars

Autonomous War V2 — Three.js wave-survival shooter. Defend your position
against ten waves of war machines across seven arenas: PBR materials,
bloom & post-processing, soft shadows, GPU particles.

Extracted from the SIGNAL standalone playground repo (2026-08-10) into its
own repo. The Babylon V1 build stays in the standalone repo.

## What's here

| Path | What |
|---|---|
| `index.html` | Game page (importmap → self-hosted Three.js r17x ES modules, no build step, no CDN) |
| `src/` | App modules — `main.js`, `scenes.js`/`scenes-data.js`, `enemies.js`, `hud.js`, `fx.js`, `audio.js`, `gltf.js` |
| `assets/` | 14 GLBs (KHR_draco) + 6 ground/skybox texture pairs, copied from the Babylon V1 build |
| `vendor/three/` | Self-hosted Three.js core + addons (postprocessing, GLTF/DRACO loaders) |
| `vendor/music/` | Copied music-player (js + css) + no-auth stub from the SIGNAL music app |
| `_headers` | Pages cache rules — GLBs/textures immutable, index.html never cached |

## Local dev

```bash
python3 -m http.server 8931
# open http://localhost:8931/
```

## Deploy (Cloudflare Pages)

```bash
source ~/.nvm/nvm.sh
wrangler pages deploy . --project-name machinewars-site --commit-dirty=true
```

`src/scenes-data.js` sets `ASSET_BASE = './assets/'` — keep it relative; the
site deploys from the repo root.
