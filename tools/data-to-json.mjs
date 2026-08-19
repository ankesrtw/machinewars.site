#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
   data-to-json.mjs — mirror every data/.../*.data.js file to real JSON.

   Why: data/ is kept as plain ESM (data/README.md's contract) so the
   web build can `import` it with no fetch, on Pages or under any
   wrapper/mount scheme — same reasoning as ASSET_BASE in
   src/scenes-data.js. But Unity's importer (P3.1) needs real .json,
   and any non-Node tool wants JSON too. This script is the one place
   that bridges the two: import each *.data.js's default export,
   JSON.stringify it, write the mirror to data/json/ preserving the
   directory structure under data/.

   Every data/*.data.js file must already be JSON-literal shaped (see
   data/README.md's contract — no functions, no imports, no computed
   values) so this round-trips exactly; if it doesn't serialize cleanly
   that's a contract violation in the source file, not a bug here.

   It also emits data/json/manifest.json — a content hash over every
   emitted file (ROADMAP-V2 4.6). data/json/ is a *checked-in copy* in
   the Unity repo, and copies drift silently; that is the entire failure
   mode. The manifest is what makes the drift mechanical to detect: the
   Unity importer re-hashes what it sees and refuses to import, loudly,
   when it disagrees. Refusing is the point -- a partial import is what
   tempts hand-patching the Unity side, and hand-patching is how the two
   copies begin to diverge for real.

   Usage:
       node tools/data-to-json.mjs            # (re)generate data/json/*.json
       node tools/data-to-json.mjs --check    # exit 1 if json/ is stale
       node tools/data-to-json.mjs --dry-run  # report without writing
   ═══════════════════════════════════════════════════════════════════ */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_ROOT = path.join(ROOT, 'data');
const JSON_ROOT = path.join(DATA_ROOT, 'json');

const argv = process.argv.slice(2);
const CHECK = argv.includes('--check');
const DRY = argv.includes('--dry-run');

function findDataFiles(dir) {
    if (!fs.existsSync(dir)) return [];
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        // data/json/ is generated output, never a source to re-read.
        if (entry.name === 'json') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...findDataFiles(full));
        else if (entry.isFile() && entry.name.endsWith('.data.js')) out.push(full);
    }
    return out;
}

// JSON.stringify silently *omits* functions/undefined rather than throwing,
// so it can't be used alone to catch a data/README.md contract violation —
// walk the value first and name the offending key path.
function findNonJsonLiteral(value, pathStr = '$') {
    if (value === null || typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') return null;
    if (typeof value === 'function' || typeof value === 'undefined' || typeof value === 'symbol' || typeof value === 'bigint') {
        return `${pathStr} is a ${typeof value}`;
    }
    if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
            const bad = findNonJsonLiteral(value[i], `${pathStr}[${i}]`);
            if (bad) return bad;
        }
        return null;
    }
    if (typeof value === 'object') {
        for (const [k, v] of Object.entries(value)) {
            const bad = findNonJsonLiteral(v, `${pathStr}.${k}`);
            if (bad) return bad;
        }
        return null;
    }
    return `${pathStr} is a ${typeof value}`;
}

async function loadDefault(file) {
    const mod = await import(pathToFileURL(file).href + `?t=${Date.now()}`);
    if (!('default' in mod)) {
        throw new Error(`${path.relative(ROOT, file)} has no default export`);
    }
    return mod.default;
}

const files = findDataFiles(DATA_ROOT).sort();

if (!files.length) {
    console.log('No data/*.data.js files found yet (data/ is empty or near-empty) — nothing to do.');
    process.exit(0);
}

// Every emitted file's text, keyed by its data/json-relative posix path.
// Collected during the pass so the manifest hashes exactly what was written
// (or, under --check, exactly what would have been).
const emitted = new Map();

let ok = true;
for (const file of files) {
    const rel = path.relative(DATA_ROOT, file);
    const outRel = rel.replace(/\.data\.js$/, '.json');
    const outFile = path.join(JSON_ROOT, outRel);

    let value;
    try {
        value = await loadDefault(file);
    } catch (e) {
        ok = false;
        console.log(`FAIL     ${rel}: ${e.message}`);
        continue;
    }

    const badPath = findNonJsonLiteral(value);
    if (badPath) {
        ok = false;
        console.log(`FAIL     ${rel}: ${badPath} — not JSON-literal, see data/README.md's contract`);
        continue;
    }

    const text = JSON.stringify(value, null, 2) + '\n';
    emitted.set(outRel.split(path.sep).join('/'), text);

    if (CHECK) {
        const existing = fs.existsSync(outFile) ? fs.readFileSync(outFile, 'utf8') : null;
        if (existing !== text) {
            ok = false;
            console.log(`STALE    ${outRel}`);
        } else {
            console.log(`ok       ${outRel}`);
        }
        continue;
    }

    console.log(`${DRY ? 'would write' : 'wrote      '} ${outRel}`);
    if (!DRY) {
        fs.mkdirSync(path.dirname(outFile), { recursive: true });
        fs.writeFileSync(outFile, text);
    }
}

// - manifest ---------------------------------------------------------
// A sha256 over path + bytes of every emitted JSON file, in sorted path
// order, mirroring gen-version.mjs's BUILD_ID discipline: it changes if
// and only if the data changes. JSON is text, so CRLF is normalized to
// LF before hashing -- otherwise the same logical data hashes differently
// on a Windows checkout than on the Linux one Unity may sit on, and the
// importer would reject a copy that is in fact identical.
function hashEmitted(map) {
    const h = crypto.createHash('sha256');
    for (const rel of [...map.keys()].sort()) {
        // Path first, so a rename or delete moves the digest even when the
        // bytes themselves repeat elsewhere.
        h.update(rel);
        h.update('\0');
        h.update(map.get(rel).replace(/\r\n/g, '\n'), 'utf8');
        h.update('\0');
    }
    return h.digest('hex');
}

function hashOne(text) {
    return crypto.createHash('sha256')
        .update(text.replace(/\r\n/g, '\n'), 'utf8')
        .digest('hex');
}

const MANIFEST_REL = 'manifest.json';
const manifestFile = path.join(JSON_ROOT, MANIFEST_REL);

if (ok) {
    const manifest = {
        // Bump only on a breaking change to the manifest's own shape; the
        // Unity importer checks this before trusting any other field.
        manifestVersion: 1,
        // Deliberately no timestamp: one would change the file on every run
        // and make "did the data actually change?" unanswerable by diff.
        // Every field here is content-derived.
        fileCount: emitted.size,
        hash: hashEmitted(emitted),
        // Per-file digests so a rejecting importer can name *which* files
        // disagree, rather than only that the copy is stale.
        files: Object.fromEntries(
            [...emitted.keys()].sort().map((rel) => [rel, hashOne(emitted.get(rel))]),
        ),
    };
    const manifestText = JSON.stringify(manifest, null, 2) + '\n';

    if (CHECK) {
        const existing = fs.existsSync(manifestFile) ? fs.readFileSync(manifestFile, 'utf8') : null;
        if (existing !== manifestText) {
            ok = false;
            console.log(`STALE    ${MANIFEST_REL}`);
        } else {
            console.log(`ok       ${MANIFEST_REL}`);
        }
    } else {
        console.log(`${DRY ? 'would write' : 'wrote      '} ${MANIFEST_REL}  (${manifest.fileCount} files, ${manifest.hash.slice(0, 12)})`);
        if (!DRY) {
            fs.mkdirSync(path.dirname(manifestFile), { recursive: true });
            fs.writeFileSync(manifestFile, manifestText);
        }
    }
}

process.exit(ok ? 0 : 1);
