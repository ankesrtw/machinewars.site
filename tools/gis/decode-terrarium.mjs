#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
   decode-terrarium.mjs — decode a site's cached Terrarium tile mosaic
   to elevation and preview it.

   Ported from docs/v2/spike/terrarium-decode-spike.mjs (kept working,
   don't rewrite — see docs/v2/spike/README.md). Uses only Node's
   built-in zlib to inflate the PNG IDAT stream and undo the PNG
   filters — no GDAL, no npm deps, per the P1 spike finding that this
   is sufficient for 8-bit RGB non-interlaced terrarium tiles.

   Elevation formula: (R*256 + G + B/256) - 32768 meters.

   Usage:
       node tools/gis/decode-terrarium.mjs --site=ghats
       node tools/gis/decode-terrarium.mjs --site=ghats --extents=400,1200

   Prints relief (max-min) for each requested metre extent plus an
   ASCII heightmap preview. The default extents (400, 1200) are the
   spike's regression test: relief must print 27.9m and 50.3m for
   ghats — same input, same numbers (docs/v2/spike/README.md).
   ═══════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import SITES from './sites.data.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CACHE_ROOT = path.join(ROOT, 'tools', 'gis', 'cache');

/* Minimal PNG decoder for 8-bit RGB non-interlaced (what terrarium tiles are). */
function decodePNG(filePath) {
    const buf = fs.readFileSync(filePath);
    let off = 8, idat = [], W = 0, H = 0;
    while (off < buf.length) {
        const len = buf.readUInt32BE(off);
        const type = buf.toString('ascii', off + 4, off + 8);
        const data = buf.subarray(off + 8, off + 8 + len);
        if (type === 'IHDR') { W = data.readUInt32BE(0); H = data.readUInt32BE(4); }
        else if (type === 'IDAT') idat.push(data);
        else if (type === 'IEND') break;
        off += 12 + len;
    }
    const raw = inflateSync(Buffer.concat(idat)), bpp = 3, stride = W * bpp;
    const out = Buffer.alloc(H * stride);
    let p = 0;
    for (let y = 0; y < H; y++) {
        const ft = raw[p++], line = raw.subarray(p, p + stride); p += stride;
        const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride);
        const cur = out.subarray(y * stride, (y + 1) * stride);
        for (let i = 0; i < stride; i++) {
            const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
            let v = line[i];
            switch (ft) {
                case 1: v += a; break;
                case 2: v += b; break;
                case 3: v += (a + b) >> 1; break;
                case 4: {
                    const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
                    v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
                    break;
                }
            }
            cur[i] = v & 0xff;
        }
    }
    return { W, H, px: out };
}

export function loadMosaic(slug) {
    const s = SITES[slug];
    if (!s) throw new Error(`Unknown site "${slug}"`);
    const dir = path.join(CACHE_ROOT, slug);
    const { cols, rows } = s.tileGrid;
    const tileSize = 256;
    const M = cols * tileSize; // assumes cols === rows, true for the current roster
    const mos = new Float32Array(M * M);
    const halfCols = Math.floor(cols / 2);
    const halfRows = Math.floor(rows / 2);

    for (let dy = -halfRows; dy <= halfRows; dy++) {
        for (let dx = -halfCols; dx <= halfCols; dx++) {
            const file = path.join(dir, `t_${dx}_${dy}.png`);
            if (!fs.existsSync(file)) {
                throw new Error(`Missing cached tile ${file} — run fetch-dem.mjs --site=${slug} first`);
            }
            const { W, px } = decodePNG(file);
            const ox = (dx + halfCols) * tileSize, oy = (dy + halfRows) * tileSize;
            for (let y = 0; y < tileSize; y++) {
                for (let x = 0; x < tileSize; x++) {
                    const i = (y * W + x) * 3;
                    mos[(oy + y) * M + (ox + x)] = (px[i] * 256 + px[i + 1] + px[i + 2] / 256) - 32768;
                }
            }
        }
    }

    const mpp = 156543.03392 * Math.cos((s.centerLatLon[0] * Math.PI) / 180) / (2 ** s.zoom);
    // Center tile occupies [halfCols*256, (halfCols+1)*256); fractional offset
    // of the center lat/lon within that tile.
    const n = 2 ** s.zoom;
    const exactX = ((s.centerLatLon[1] + 180) / 360) * n;
    const latRad = (s.centerLatLon[0] * Math.PI) / 180;
    const exactY = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
    const fracX = exactX - Math.floor(exactX), fracY = exactY - Math.floor(exactY);
    const cx = halfCols * tileSize + fracX * tileSize;
    const cy = halfRows * tileSize + fracY * tileSize;

    return { mos, M, mpp, cx, cy };
}

export function windowStats(mosaic, extentM, { cols = 56, rows = 22, ramp = ' .:-=+*#%@' } = {}) {
    const { mos, M, mpp, cx, cy } = mosaic;
    const half = (extentM / mpp) / 2;
    let min = Infinity, max = -Infinity;
    const sample = (r, c) => {
        const sx = Math.round(cx - half + (c / (cols - 1)) * 2 * half);
        const sy = Math.round(cy - half + (r / (rows - 1)) * 2 * half);
        return mos[Math.min(M - 1, Math.max(0, sy)) * M + Math.min(M - 1, Math.max(0, sx))];
    };
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const e = sample(r, c);
        if (e < min) min = e;
        if (e > max) max = e;
    }
    let art = '';
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const e = sample(r, c);
            const t = (e - min) / (max - min || 1);
            art += ramp[Math.min(ramp.length - 1, Math.floor(t * ramp.length))];
        }
        art += '\n';
    }
    return { min, max, relief: max - min, mpp, sourcePx: 2 * half, art };
}

/* CLI entry point — only runs when invoked directly, so build-heightmap.mjs
   (P1.3) can import loadMosaic/windowStats without triggering argv parsing. */
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
    const argv = process.argv.slice(2);
    const flag = (n, d = null) => {
        const hit = argv.find(a => a === `--${n}` || a.startsWith(`--${n}=`));
        if (!hit) return d;
        return hit.includes('=') ? hit.slice(hit.indexOf('=') + 1) : true;
    };
    const siteArg = flag('site', null);
    const extentsArg = flag('extents', '400,1200');

    if (!siteArg) {
        console.error('Usage: node tools/gis/decode-terrarium.mjs --site=<slug> [--extents=400,1200]');
        process.exit(1);
    }
    if (!SITES[siteArg]) {
        console.error(`Unknown site "${siteArg}". Available: ${Object.keys(SITES).join(', ')}`);
        process.exit(1);
    }

    const mosaic = loadMosaic(siteArg);
    const extents = String(extentsArg).split(',').map(Number);
    for (const extent of extents) {
        const { min, max, relief, mpp, sourcePx, art } = windowStats(mosaic, extent);
        console.log(`\n=== ${extent}m window @ ${mpp.toFixed(1)} m/px (${sourcePx.toFixed(0)} source px) ===`);
        console.log(`relief: ${relief.toFixed(1)}m  (min ${min.toFixed(0)} -> max ${max.toFixed(0)})`);
        console.log(art);
    }
}
