'use strict';

/* ═══════════════════════════════════════════════════════════════════
   MACHINE WARS — scenes-data.js
   Thin loader: imports each arena's JSON-literal config from
   data/scenes/<slug>.data.js (P0.4), resolves ASSET_BASE-relative
   paths (previewImage only — textureUrl/file fields stay relative,
   resolved later by src/scenes.js via SCENE_TEXTURE_BASE/SCENE_MODEL_BASE),
   and re-exports the same surface this module has always exported.
   ═══════════════════════════════════════════════════════════════════ */

import ghats from '../data/scenes/ghats.data.js';
import warzone from '../data/scenes/warzone.data.js';
import space from '../data/scenes/space.data.js';
import mars from '../data/scenes/mars.data.js';
import alien from '../data/scenes/alien.data.js';
import desert from '../data/scenes/desert.data.js';
import urban from '../data/scenes/urban.data.js';
import jungle from '../data/scenes/jungle.data.js';
import arctic from '../data/scenes/arctic.data.js';

// ── Asset base path ─────────────────────────────────────────────────
// Resolve assets from this module rather than from the page URL. This remains
// correct from /play/, /play/<arena>/, and deployments mounted below a path.
const ASSET_BASE = new URL('../assets/', import.meta.url).href;

const SCENE_MODEL_BASE = ASSET_BASE + 'models/';
const SCENE_TEXTURE_BASE = ASSET_BASE + 'textures/';

// ═════════════════════════════════════════════════════════════════════
// SCENE CONFIGS
// ═════════════════════════════════════════════════════════════════════

const RAW_SCENE_CONFIGS = { ghats, warzone, space, mars, alien, desert, urban, jungle, arctic };

// previewImage in data/scenes/*.data.js is ASSET_BASE-relative (JSON-literal
// contract forbids baking in the resolved absolute URL); resolve it here,
// once, same as the old inline `ASSET_BASE + '...'` did.
const SCENE_CONFIGS = {};
for (const [slug, cfg] of Object.entries(RAW_SCENE_CONFIGS)) {
    SCENE_CONFIGS[slug] = cfg.previewImage
        ? { ...cfg, previewImage: ASSET_BASE + cfg.previewImage }
        : cfg;
}

// ── Default scene ───────────────────────────────────────────────────
const DEFAULT_SCENE = 'warzone';

// ── Mission order ───────────────────────────────────────────────────
// Campaign sequence: each arena unlocks on completion of the previous one.
// mars is last — the eventual Space Wars arena (orbital sats vs. CREON's
// grid) picks up after it; not built yet, so mars stays the finale for now.
const MISSION_ORDER = ['jungle', 'warzone', 'urban', 'desert', 'arctic', 'alien', 'space', 'mars'];

export { SCENE_CONFIGS, DEFAULT_SCENE, MISSION_ORDER, SCENE_MODEL_BASE, SCENE_TEXTURE_BASE, ASSET_BASE };
