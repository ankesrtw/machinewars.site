#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
   build-heightmap.mjs — bake a site's cached Terrarium mosaic into a
   16-bit grayscale PNG heightmap + a metadata JSON.

   Why: decode-terrarium.mjs (P1.2) already exposes loadMosaic/windowStats
   for exactly this. This script crops the mosaic to horizonExtentM around
   the site center, resamples it to a square power-of-two-plus-one grid
   (1025 or 2049, Unity TerrainData's preferred sizes), and writes:

     assets/terrain/<slug>/heightmap.png   — 16-bit grayscale, 0 = min
                                              elevation, 65535 = max
     assets/terrain/<slug>/heightmap.json  — the metadata that makes the
                                              PNG portable: m/px, min/max
                                              elevation, origin lat/lon,
                                              extent, resolution.

   Elevation is normalized min..max into the 16-bit range rather than
   using the raw terrarium encoding — this is a *display/displacement*
   heightmap, not a re-encoding of the source data. The metadata JSON
   is what lets a consumer (Three.js today, Unity TerrainData.SetHeights
   later) turn normalized texel values back into meters.

   No npm deps — hand-rolled PNG writer (zlib.deflateSync only), same
   discipline as decode-terrarium.mjs's hand-rolled reader.

   Usage:
       node tools/gis/build-heightmap.mjs --site=ghats
       node tools/gis/build-heightmap.mjs --site=ghats --size=2049
       node tools/gis/build-heightmap.mjs --site=ghats --dry-run
       node tools/gis/build-heightmap.mjs --check          # metadata round-trips?
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
const SIZE = Number(flag('size', 1025));

if (SIZE !== 1025 && SIZE !== 2049) {
    console.error(`--size must be 1025 or 2049 (got ${SIZE})`);
    process.exit(1);
}

/* ── Minimal 16-bit grayscale PNG writer ─────────────────────────────
   Mirrors decode-terrarium.mjs's reader: no filtering (filter type 0
   per scanline), single zlib deflate of the whole IDAT payload. */
function crc32(buf) {
    let c;
    const table = crc32.table || (crc32.table = (() => {
        const t = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
            c = n;
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

function writeGray16PNG(filePath, W, H, u16) {
    const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(W, 0);
    ihdr.writeUInt32BE(H, 4);
    ihdr[8] = 16;  // bit depth
    ihdr[9] = 0;   // color type: grayscale
    ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

    const stride = W * 2;
    const raw = Buffer.alloc(H * (stride + 1));
    for (let y = 0; y < H; y++) {
        const rowStart = y * (stride + 1);
        raw[rowStart] = 0; // filter type: none
        for (let x = 0; x < W; x++) {
            raw.writeUInt16BE(u16[y * W + x], rowStart + 1 + x * 2);
        }
    }
    const idat = deflateSync(raw, { level: 9 });

    const png = Buffer.concat([
        sig,
        chunk('IHDR', ihdr),
        chunk('IDAT', idat),
        chunk('IEND', Buffer.alloc(0)),
    ]);
    fs.writeFileSync(filePath, png);
}

/* Bilinear sample of the source mosaic at fractional pixel (sx, sy). */
function bilinear(mos, M, sx, sy) {
    const x0 = Math.max(0, Math.min(M - 1, Math.floor(sx)));
    const y0 = Math.max(0, Math.min(M - 1, Math.floor(sy)));
    const x1 = Math.min(M - 1, x0 + 1);
    const y1 = Math.min(M - 1, y0 + 1);
    const fx = sx - x0, fy = sy - y0;
    const a = mos[y0 * M + x0], b = mos[y0 * M + x1];
    const c = mos[y1 * M + x0], d = mos[y1 * M + x1];
    const top = a + (b - a) * fx;
    const bot = c + (d - c) * fx;
    return top + (bot - top) * fy;
}

function buildHeightmap(slug, size) {
    const site = SITES[slug];
    if (!site) throw new Error(`Unknown site "${slug}"`);

    const mosaic = loadMosaic(slug);
    const { mos, M, mpp, cx, cy } = mosaic;
    const extentM = site.horizonExtentM;
    const half = (extentM / mpp) / 2;

    if (half * 2 > M) {
        throw new Error(
            `horizonExtentM ${extentM}m needs a ${(half * 2).toFixed(0)}px window but the ` +
            `mosaic is only ${M}px — widen tileGrid in sites.data.js for "${slug}".`
        );
    }

    // Elevation range from the exact same window stats used by decode-terrarium.mjs,
    // so build-heightmap's min/max match the regression numbers exactly.
    const { min, max } = windowStats(mosaic, extentM);
    const relief = max - min || 1;

    const u16 = new Uint16Array(size * size);
    for (let ry = 0; ry < size; ry++) {
        for (let rx = 0; rx < size; rx++) {
            const sx = cx - half + (rx / (size - 1)) * 2 * half;
            const sy = cy - half + (ry / (size - 1)) * 2 * half;
            const e = bilinear(mos, M, sx, sy);
            const t = (e - min) / relief;
            u16[ry * size + rx] = Math.max(0, Math.min(65535, Math.round(t * 65535)));
        }
    }

    const metersPerTexel = extentM / (size - 1);
    const metadata = {
        slug,
        size,
        extentM,
        metersPerTexel,
        elevationMin: min,
        elevationMax: max,
        elevationRange: relief,
        originLatLon: site.centerLatLon,
        sourceMppAtCenter: mpp,
        source: site.source,
        generatedAt: new Date().toISOString(),
        notes: 'heightmap.png is a 16-bit grayscale PNG, texel 0 = elevationMin meters, ' +
            '65535 = elevationMax meters. meters = elevationMin + (texel/65535) * elevationRange. ' +
            'metersPerTexel * (size-1) = extentM, the square ground footprint this heightmap covers, ' +
            'centered on originLatLon.',
    };

    return { u16, size, metadata };
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
        const metaFile = path.join(dir, 'heightmap.json');
        const pngFile = path.join(dir, 'heightmap.png');
        if (!fs.existsSync(metaFile) || !fs.existsSync(pngFile)) {
            ok = false;
            console.log(`MISSING  ${slug}: heightmap not built`);
            continue;
        }
        const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
        try {
            const { min, max } = windowStats(loadMosaic(slug), SITES[slug].horizonExtentM);
            const okMatch = Math.abs(min - meta.elevationMin) < 0.01 && Math.abs(max - meta.elevationMax) < 0.01;
            console.log(`${okMatch ? 'ok      ' : 'MISMATCH'} ${slug}: meta min/max ${meta.elevationMin.toFixed(1)}/` +
                `${meta.elevationMax.toFixed(1)} vs live ${min.toFixed(1)}/${max.toFixed(1)}`);
            if (!okMatch) ok = false;
        } catch (e) {
            ok = false;
            console.log(`FAIL     ${slug}: ${e.message}`);
        }
    }
    process.exit(ok ? 0 : 1);
}

const slugs = sitesToRun();
if (!slugs.length) {
    console.error('No sites matched. Available: ' + Object.keys(SITES).join(', '));
    process.exit(1);
}

for (const slug of slugs) {
    console.log(`\n${slug}: building ${SIZE}x${SIZE} heightmap...`);
    const { u16, size, metadata } = buildHeightmap(slug, SIZE);
    console.log(`  extent ${metadata.extentM}m, ${metadata.metersPerTexel.toFixed(3)} m/texel, ` +
        `elevation ${metadata.elevationMin.toFixed(1)}..${metadata.elevationMax.toFixed(1)}m ` +
        `(range ${metadata.elevationRange.toFixed(1)}m)`);

    if (DRY) continue;

    const dir = path.join(TERRAIN_ROOT, slug);
    fs.mkdirSync(dir, { recursive: true });
    writeGray16PNG(path.join(dir, 'heightmap.png'), size, size, u16);
    fs.writeFileSync(path.join(dir, 'heightmap.json'), JSON.stringify(metadata, null, 2) + '\n');
    console.log(`  wrote ${path.join('assets', 'terrain', slug, 'heightmap.png')} + heightmap.json`);
}
