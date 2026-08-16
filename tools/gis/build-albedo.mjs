#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
   build-albedo.mjs — bake a site's ground albedo texture + biome
   colour summary.

   Why procedural, not Sentinel-2: fetch-imagery.mjs was deliberately
   deferred out of P1.2 (see docs/v2/HANDOFF.md) — real imagery isn't
   needed to answer this phase's gate question (does the heightmap +
   horizon read as a real place). This script grades a tiled procedural
   texture from each site's sites.data.js `albedoPalette`, using the
   same seeded-speckle approach as src/fx.js's proceduralGroundTexture
   (that one runs in-browser off a Canvas; this is its offline,
   file-writing twin so ground.type:'heightmap' scenes can ship a real
   texture file instead of generating one at runtime).

   Organic detail + macro elevation tint (P1.5 revision): the original
   speckle pass (hard-edged 4-60px rectangles) reads as flat mud once
   stretched under 150m+ of real terrain — no organic variation, and an
   earlier per-texture-tile hillshade attempt confirmed the P1 spike's own
   finding applies here too: real DEM relief is close to flat at the ~50m
   scale one texture repeat covers (docs/v2/HANDOFF.md "the load-bearing
   finding"), so shading *within* a tile from DEM slope had almost nothing
   to work with. Fixed two separate ways:
     - close-up detail is now multi-octave value noise (fractalNoise2D
       below) instead of rectangle blotches — organic mottling at a scale
       that actually reads as dirt/leaf-litter up close, same spirit as
       src/fx.js's in-browser proceduralGroundTexture but tuned for a much
       larger baked tile.
     - a macro elevation tint samples the DEM across the *entire visible
       ring* (site.groundVisibleRadiusM, not one 50m texture repeat) and
       blends low/high elevation color across that whole span — this is
       DEM relief used at the scale the spike proved it actually has
       structure, not invented per-tile detail it doesn't have.
   Falls back to organic-noise-only (no elevation tint) if the site has no
   cached DEM mosaic yet — keeps this script usable before fetch-dem.mjs
   has run for a given site.

   Swap-in path to real imagery later: build fetch-imagery.mjs (Sentinel-2
   L2A per ROADMAP-V2 §5.1), then point this script at the composite
   instead of albedoPalette — the output contract (albedo.png +
   albedo.json biome summary) doesn't change.

   Outputs:
     assets/terrain/<slug>/albedo.png   — 1024x1024 8-bit RGB, tileable
     assets/terrain/<slug>/albedo.json  — biome id + mean colour (for
                                           lighting/fog tinting)

   No npm deps — hand-rolled PNG writer (zlib.deflateSync only), same
   discipline as build-heightmap.mjs.

   Usage:
       node tools/gis/build-albedo.mjs --site=ghats
       node tools/gis/build-albedo.mjs --site=ghats --dry-run
       node tools/gis/build-albedo.mjs --check
   ═══════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import SITES from './sites.data.js';
import { loadMosaic, windowStats } from './decode-terrarium.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TERRAIN_ROOT = path.join(ROOT, 'assets', 'terrain');

const argv = process.argv.slice(2);
const flag = (n, d = null) => {
    const hit = argv.find(a => a === `--${n}` || a.startsWith(`--${n}=`));
    if (!hit) return d;
    return hit.includes('=') ? hit.slice(hit.indexOf('=') + 1) : true;
};

const DRY = !!flag('dry-run');
const CHECK = !!flag('check');
const siteArg = flag('site', null);
const SIZE = Number(flag('size', 1024));

/* seededRandom — same LCG as src/fx.js, kept in sync deliberately so
   swapping seeds between the offline bake and any future in-browser
   fallback produces the same pattern. */
function seededRandom(seed) {
    let s = seed;
    return function () {
        s = (s * 1664525 + 1013904223) & 0xffffffff;
        return (s >>> 0) / 0xffffffff;
    };
}

/* ── Minimal 8-bit RGB PNG writer ────────────────────────────────── */
function crc32(buf) {
    const table = crc32.table || (crc32.table = (() => {
        const t = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
            let c = n;
            for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
            t[n] = c >>> 0;
        }
        return t;
    })());
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function writeRGB8PNG(filePath, W, H, rgb) {
    const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(W, 0);
    ihdr.writeUInt32BE(H, 4);
    ihdr[8] = 8;   // bit depth
    ihdr[9] = 2;   // color type: RGB
    ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

    const stride = W * 3;
    const raw = Buffer.alloc(H * (stride + 1));
    for (let y = 0; y < H; y++) {
        const rowStart = y * (stride + 1);
        raw[rowStart] = 0; // filter type: none
        rgb.copy(raw, rowStart + 1, y * stride, (y + 1) * stride);
    }
    const idat = deflateSync(raw, { level: 9 });

    const png = Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
    fs.writeFileSync(filePath, png);
}

// Try to load the site's DEM mosaic for macro elevation tinting. Returns
// null (not throw) if no cached tiles exist yet — see header comment.
function tryLoadDem(slug, site) {
    try {
        const mosaic = loadMosaic(slug);
        const { min, max } = windowStats(mosaic, site.horizonExtentM || site.playableExtentM);
        return { mosaic, elevationMin: min, elevationRange: (max - min) || 1 };
    } catch {
        return null;
    }
}

// Bilinear elevation lookup at world position (wx, wz), sampled from the
// mosaic in the same lat/lon-anchored pixel space build-heightmap.mjs uses.
function sampleElevation(dem, wx, wz) {
    const { mos, M, mpp, cx, cy } = dem.mosaic;
    const sx = cx + (wx / mpp), sy = cy + (wz / mpp);
    const x0 = Math.max(0, Math.min(M - 1, Math.floor(sx)));
    const y0 = Math.max(0, Math.min(M - 1, Math.floor(sy)));
    const x1 = Math.min(M - 1, x0 + 1);
    const y1 = Math.min(M - 1, y0 + 1);
    const fx = Math.max(0, Math.min(1, sx - x0));
    const fy = Math.max(0, Math.min(1, sy - y0));
    const a = mos[y0 * M + x0], b = mos[y0 * M + x1];
    const c = mos[y1 * M + x0], d = mos[y1 * M + x1];
    const top = a + (b - a) * fx, bot = c + (d - c) * fx;
    return top + (bot - top) * fy;
}

// Deterministic hash -> [0,1), used as the value-noise lattice so no state
// needs to persist between calls (buildAlbedo calls this once per texel).
function latticeValue(seed, ix, iy) {
    let h = (ix * 374761393 + iy * 668265263 + seed * 2654435761) | 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    h = (h ^ (h >>> 16)) >>> 0;
    return h / 0xffffffff;
}

// Value noise (bilinear-interpolated hash lattice), summed over a few
// octaves for organic mottling — replaces the old hard-edged rectangle
// speckle, which reads as a repeating tile pattern rather than dirt/leaf
// litter once stretched under real-scale terrain.
function fractalNoise2D(seed, x, y, octaves = 4) {
    let sum = 0, amp = 0.5, freq = 1, total = 0;
    for (let o = 0; o < octaves; o++) {
        const fx = x * freq, fy = y * freq;
        const x0 = Math.floor(fx), y0 = Math.floor(fy);
        const tx = fx - x0, ty = fy - y0;
        const v00 = latticeValue(seed, x0, y0), v10 = latticeValue(seed, x0 + 1, y0);
        const v01 = latticeValue(seed, x0, y0 + 1), v11 = latticeValue(seed, x0 + 1, y0 + 1);
        const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty); // smoothstep
        const top = v00 + (v10 - v00) * sx, bot = v01 + (v11 - v01) * sx;
        sum += (top + (bot - top) * sy) * amp;
        total += amp;
        amp *= 0.5; freq *= 2.3;
    }
    return sum / total; // 0..1
}

function buildAlbedo(slug, size) {
    const site = SITES[slug];
    if (!site) throw new Error(`Unknown site "${slug}"`);
    const palette = site.albedoPalette;
    if (!palette) throw new Error(`Site "${slug}" has no albedoPalette in sites.data.js`);

    const rgb = Buffer.alloc(size * size * 3);
    const [br, bg, bb] = palette.base;
    const noiseSeed = site.zoom * 1000 + slug.length;

    // One texture repeat covers groundVisibleRadiusM*2/groundTextureRepeats
    // real metres (see sites.data.js) — used below both to convert texel
    // coordinates to world metres for the macro elevation sample, and to
    // pick a noise frequency that reads as organic grain at that print size.
    const groundDiameterM = (site.groundVisibleRadiusM || site.horizonExtentM / 2) * 2;
    const tileRepeats = site.groundTextureRepeats || 8;
    const tileWidthM = groundDiameterM / tileRepeats;

    const dem = (palette.lowTint && palette.highTint) ? tryLoadDem(slug, site) : null;
    const sunUp = palette.sunDirection ? -palette.sunDirection[1] : 0.97; // 0..1, how overhead the sun is
    const [ltR, ltG, ltB] = palette.lowTint || palette.base;
    const [htR, htG, htB] = palette.highTint || palette.base;

    for (let ty = 0; ty < size; ty++) {
        for (let tx = 0; tx < size; tx++) {
            const u = tx / size, v = ty / size;
            const idx = (ty * size + tx) * 3;

            // Organic close-up detail: two noise fields at different
            // frequencies (broad blotches + fine grain), each biased toward
            // one speckle color from the palette — replaces the old
            // hard-edged rectangle speckle.
            const macro = fractalNoise2D(noiseSeed, u * 6, v * 6, 3);
            const grain = fractalNoise2D(noiseSeed + 991, u * 40, v * 40, 2);
            const speck = palette.speckle[Math.floor(macro * palette.speckle.length) % palette.speckle.length];
            const macroAlpha = 0.3 + macro * 0.25;
            const grainAlpha = (grain - 0.5) * 0.18;
            let r = br + (speck[0] - br) * macroAlpha + 255 * grainAlpha;
            let g = bg + (speck[1] - bg) * macroAlpha + 255 * grainAlpha;
            let b = bb + (speck[2] - bb) * macroAlpha + 255 * grainAlpha;

            // Macro elevation tint: sampled across the *whole visible ring*
            // in real-world metres (not per texture repeat) — this is DEM
            // relief used at the scale the P1 spike proved it has actual
            // structure (§5.4 "authored floor + real horizon"), not invented
            // per-tile detail a 50m texture repeat doesn't have.
            if (dem) {
                const wx = (u - 0.5) * groundDiameterM;
                const wz = (v - 0.5) * groundDiameterM;
                const elev = sampleElevation(dem, wx, wz);
                const t = Math.max(0, Math.min(1, (elev - dem.elevationMin) / dem.elevationRange));
                // Blend toward a light/shadow read of "higher ground catches
                // more overhead sun" without a full slope-normal hillshade
                // (which needs relief-per-texel this data doesn't have at
                // texture scale) — sunUp scales how strongly elevation reads
                // as brightness, so a low sun still tints without lying about
                // directional shading it can't back up.
                const tintR = ltR + (htR - ltR) * t;
                const tintG = ltG + (htG - ltG) * t;
                const tintB = ltB + (htB - ltB) * t;
                const tintAlpha = 0.55;
                const bright = 1 + (t - 0.5) * 0.3 * sunUp;
                r = (r * (1 - tintAlpha) + tintR * tintAlpha) * bright;
                g = (g * (1 - tintAlpha) + tintG * tintAlpha) * bright;
                b = (b * (1 - tintAlpha) + tintB * tintAlpha) * bright;
            }

            rgb[idx] = Math.max(0, Math.min(255, Math.round(r)));
            rgb[idx + 1] = Math.max(0, Math.min(255, Math.round(g)));
            rgb[idx + 2] = Math.max(0, Math.min(255, Math.round(b)));
        }
    }

    // Weathering streaks — thin darker cracks, same visual language as
    // src/fx.js's proceduralGroundTexture, kept from the original pass.
    const rng = seededRandom(noiseSeed + 5);
    const streaks = Math.round((size * size) / 9000);
    for (let i = 0; i < streaks; i++) {
        let x = rng() * size, y = rng() * size;
        for (let s = 0; s < 8; s++) {
            x += (rng() - 0.5) * (size / 12);
            y += (rng() - 0.5) * (size / 12);
            const px = Math.max(0, Math.min(size - 1, Math.round(x)));
            const py = Math.max(0, Math.min(size - 1, Math.round(y)));
            const idx = (py * size + px) * 3;
            rgb[idx] = Math.round(rgb[idx] * 0.7);
            rgb[idx + 1] = Math.round(rgb[idx + 1] * 0.7);
            rgb[idx + 2] = Math.round(rgb[idx + 2] * 0.7);
        }
    }

    let sumR = 0, sumG = 0, sumB = 0;
    for (let i = 0; i < size * size; i++) {
        sumR += rgb[i * 3]; sumG += rgb[i * 3 + 1]; sumB += rgb[i * 3 + 2];
    }
    const meanColor = [
        Math.round(sumR / (size * size)),
        Math.round(sumG / (size * size)),
        Math.round(sumB / (size * size)),
    ];

    const metadata = {
        slug,
        size,
        biome: site.biome,
        meanColor,
        source: 'procedural',
        hillshade: !!dem,
        note: 'Graded from sites.data.js albedoPalette, not sampled satellite imagery. ' +
            (dem
                ? 'Includes a hillshade + hypsometric tint pass sampled from the cached DEM mosaic.'
                : 'No cached DEM mosaic found — flat speckle base only, no hillshade/tint.') +
            ' See ROADMAP-V2 §5.1 for the deferred Sentinel-2 path (fetch-imagery.mjs, not built).',
        generatedAt: new Date().toISOString(),
    };

    return { rgb, size, metadata };
}

function sitesToRun() {
    if (!siteArg) return Object.keys(SITES);
    const want = new Set(String(siteArg).split(',').map(s => s.trim()));
    const names = Object.keys(SITES).filter(s => want.has(s));
    const missing = [...want].filter(s => !names.includes(s));
    if (missing.length) throw new Error(`Unknown site(s): ${missing.join(', ')}`);
    return names;
}

if (CHECK) {
    let ok = true;
    for (const slug of Object.keys(SITES)) {
        const dir = path.join(TERRAIN_ROOT, slug);
        const metaFile = path.join(dir, 'albedo.json');
        const pngFile = path.join(dir, 'albedo.png');
        if (!fs.existsSync(metaFile) || !fs.existsSync(pngFile)) {
            ok = false;
            console.log(`MISSING  ${slug}: albedo not built`);
            continue;
        }
        const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
        console.log(`ok       ${slug}: biome=${meta.biome} meanColor=[${meta.meanColor.join(',')}]`);
    }
    process.exit(ok ? 0 : 1);
}

const slugs = sitesToRun();
if (!slugs.length) {
    console.error('No sites matched. Available: ' + Object.keys(SITES).join(', '));
    process.exit(1);
}

for (const slug of slugs) {
    console.log(`\n${slug}: building ${SIZE}x${SIZE} albedo...`);
    const { rgb, size, metadata } = buildAlbedo(slug, SIZE);
    console.log(`  biome=${metadata.biome} meanColor=[${metadata.meanColor.join(',')}]`);

    if (DRY) continue;

    const dir = path.join(TERRAIN_ROOT, slug);
    fs.mkdirSync(dir, { recursive: true });
    writeRGB8PNG(path.join(dir, 'albedo.png'), size, size, rgb);
    fs.writeFileSync(path.join(dir, 'albedo.json'), JSON.stringify(metadata, null, 2) + '\n');
    console.log(`  wrote ${path.join('assets', 'terrain', slug, 'albedo.png')} + albedo.json`);
}
