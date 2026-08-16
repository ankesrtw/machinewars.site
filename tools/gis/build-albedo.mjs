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

function buildAlbedo(slug, size) {
    const site = SITES[slug];
    if (!site) throw new Error(`Unknown site "${slug}"`);
    const palette = site.albedoPalette;
    if (!palette) throw new Error(`Site "${slug}" has no albedoPalette in sites.data.js`);

    const rgb = Buffer.alloc(size * size * 3);
    const [br, bg, bb] = palette.base;
    for (let i = 0; i < size * size; i++) {
        rgb[i * 3] = br; rgb[i * 3 + 1] = bg; rgb[i * 3 + 2] = bb;
    }

    const rng = seededRandom(site.zoom * 1000 + slug.length);
    const speckleCount = Math.round((size * size) / 1600); // density scaled to canvas area
    for (let i = 0; i < speckleCount; i++) {
        const [sr, sg, sb] = palette.speckle[Math.floor(rng() * palette.speckle.length)];
        const px = Math.floor(rng() * size), py = Math.floor(rng() * size);
        const pw = 4 + Math.floor(rng() * 60), ph = 4 + Math.floor(rng() * 60);
        const alpha = 0.35 + rng() * 0.3;
        for (let y = Math.max(0, py); y < Math.min(size, py + ph); y++) {
            for (let x = Math.max(0, px); x < Math.min(size, px + pw); x++) {
                const idx = (y * size + x) * 3;
                rgb[idx] = Math.round(rgb[idx] * (1 - alpha) + sr * alpha);
                rgb[idx + 1] = Math.round(rgb[idx + 1] * (1 - alpha) + sg * alpha);
                rgb[idx + 2] = Math.round(rgb[idx + 2] * (1 - alpha) + sb * alpha);
            }
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
        note: 'Graded from sites.data.js albedoPalette, not sampled satellite imagery. ' +
            'See ROADMAP-V2 §5.1 for the deferred Sentinel-2 path (fetch-imagery.mjs, not built).',
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
