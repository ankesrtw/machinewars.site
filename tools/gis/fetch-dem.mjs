#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
   fetch-dem.mjs — download the AWS Terrarium DEM tile mosaic for a site.

   Why: tools/gis/sites.data.js defines each site's center + zoom; this
   script does the lat/lon -> tile math and downloads the tileGrid
   (default 3x3) of terrarium PNGs to tools/gis/cache/<slug>/. Nothing
   fetches at runtime in the game — this is an offline bake step, run
   manually, same principle as tools/gen-art.mjs.

   Idempotent like gen-art.mjs: skips tiles already on disk unless
   --force. No API key, no auth, no rate limit observed in the P1
   spike (docs/v2/spike/README.md).

   Usage:
       node tools/gis/fetch-dem.mjs --site=ghats
       node tools/gis/fetch-dem.mjs --site=ghats --force
       node tools/gis/fetch-dem.mjs --site=ghats --dry-run
       node tools/gis/fetch-dem.mjs --check          # cache complete for every site?
   ═══════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import SITES from './sites.data.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CACHE_ROOT = path.join(ROOT, 'tools', 'gis', 'cache');

const argv = process.argv.slice(2);
const flag = (n, d = null) => {
    const hit = argv.find(a => a === `--${n}` || a.startsWith(`--${n}=`));
    if (!hit) return d;
    return hit.includes('=') ? hit.slice(hit.indexOf('=') + 1) : true;
};

const FORCE = !!flag('force');
const DRY = !!flag('dry-run');
const CHECK = !!flag('check');
const siteArg = flag('site', null);

/* Standard slippy-map tile math (Web Mercator). */
function latLonToTile(lat, lon, z) {
    const n = 2 ** z;
    const x = ((lon + 180) / 360) * n;
    const latRad = (lat * Math.PI) / 180;
    const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
    return { x: Math.floor(x), y: Math.floor(y) };
}

function tileUrl(template, z, x, y) {
    return template.replace('{z}', z).replace('{x}', x).replace('{y}', y);
}

async function fetchTile(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
}

function sitesToRun() {
    if (!siteArg) return Object.keys(SITES);
    const want = new Set(String(siteArg).split(',').map(s => s.trim()));
    const names = Object.keys(SITES).filter(s => want.has(s));
    const missing = [...want].filter(s => !names.includes(s));
    if (missing.length) throw new Error(`Unknown site(s): ${missing.join(', ')}`);
    return names;
}

function tileJobs(site) {
    const { x: cx, y: cy } = latLonToTile(site.centerLatLon[0], site.centerLatLon[1], site.zoom);
    const { cols, rows } = site.tileGrid;
    const halfCols = Math.floor(cols / 2);
    const halfRows = Math.floor(rows / 2);
    const jobs = [];
    for (let dy = -halfRows; dy <= halfRows; dy++) {
        for (let dx = -halfCols; dx <= halfCols; dx++) {
            const x = cx + dx, y = cy + dy;
            jobs.push({
                dx, dy,
                url: tileUrl(site.source.url, site.zoom, x, y),
                file: `t_${dx}_${dy}.png`,
            });
        }
    }
    return jobs;
}

if (CHECK) {
    let ok = true;
    for (const slug of Object.keys(SITES)) {
        const site = SITES[slug];
        const dir = path.join(CACHE_ROOT, slug);
        const jobs = tileJobs(site);
        const missing = jobs.filter(j => !fs.existsSync(path.join(dir, j.file)));
        if (missing.length) {
            ok = false;
            console.log(`MISSING  ${slug}: ${missing.length}/${jobs.length} tiles not cached`);
        } else {
            console.log(`ok       ${slug}: ${jobs.length}/${jobs.length} tiles cached`);
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
    const site = SITES[slug];
    const dir = path.join(CACHE_ROOT, slug);
    const jobs = tileJobs(site);

    console.log(`\n${slug}: ${jobs.length} tiles (${site.tileGrid.cols}x${site.tileGrid.rows}) @ z${site.zoom}`);

    if (DRY) {
        for (const j of jobs) console.log(`  ${j.file} <- ${j.url}`);
        continue;
    }

    fs.mkdirSync(dir, { recursive: true });

    let ok = 0, skipped = 0, fail = 0;
    for (const j of jobs) {
        const dest = path.join(dir, j.file);
        if (!FORCE && fs.existsSync(dest)) { skipped++; continue; }
        try {
            const buf = await fetchTile(j.url);
            fs.writeFileSync(dest, buf);
            ok++;
            console.log(`  ok      ${j.file}  ${(buf.length / 1024).toFixed(0)} KB`);
        } catch (e) {
            fail++;
            console.log(`  FAIL    ${j.file}  ${e.message}`);
        }
    }
    console.log(`  ${ok} downloaded, ${skipped} skipped (cached), ${fail} failed`);
    if (fail > 0) process.exitCode = 1;
}
