#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
   MACHINE WARS — stamp-assets.mjs

   Rewrites every assets/ URL in the static HTML to carry the current
   BUILD_ID from src/version.js as a ?v= query string.

   Why: /assets/* is served `immutable, max-age=1y` (see _headers), so a
   returning visitor never refetches an asset that was overwritten in
   place at the same path. The query string changes the cache key
   without renaming files.

   JS asset loads are versioned at runtime by withVersion() in
   src/version.js; this script covers the URLs baked into HTML, which
   that code never sees.

   Usage — after bumping BUILD_ID in src/version.js, before deploying:
       node tools/stamp-assets.mjs

   Idempotent: an existing ?v= is replaced rather than appended, so it
   is safe to run repeatedly.
   ═══════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const versionSrc = fs.readFileSync(path.join(root, 'src/version.js'), 'utf8');
const m = versionSrc.match(/BUILD_ID\s*=\s*'([^']+)'/);
if (!m) {
    console.error('Could not read BUILD_ID from src/version.js');
    process.exit(1);
}
const BUILD_ID = m[1];

// Every page that references assets/. Arena pages are hardcoded copies
// (see AGENTS.md), so each one has to be stamped individually.
const files = [
    'index.html',
    'play/index.html',
    ...['warzone', 'urban', 'desert', 'jungle', 'arctic', 'mars', 'alien']
        .map((s) => `play/${s}/index.html`),
];

// Matches an assets/ URL in href=""/src=""/content=""/url('') form, with any
// existing ?v= consumed so re-runs replace instead of stacking query params.
const RE = /((?:\.\.\/)*assets\/[A-Za-z0-9._\/-]+?)(?:\?v=[^"')\s]*)?(?=["')])/g;

let total = 0;
let missing = 0;
for (const f of files) {
    const p = path.join(root, f);
    if (!fs.existsSync(p)) { console.warn(`skip (missing): ${f}`); missing++; continue; }
    const src = fs.readFileSync(p, 'utf8');
    let n = 0;
    const out = src.replace(RE, (_full, url) => { n++; return `${url}?v=${BUILD_ID}`; });
    if (out !== src) fs.writeFileSync(p, out);
    total += n;
    console.log(`${String(n).padStart(3)} refs  ${f}`);
}
console.log(`\nBUILD_ID=${BUILD_ID}  ${total} refs stamped${missing ? `, ${missing} file(s) missing` : ''}`);
