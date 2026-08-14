#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
   MACHINE WARS — gen-version.mjs

   Generates src/version.js with a BUILD_ID derived from the *content*
   of everything under assets/, then stamps that id onto the asset URLs
   baked into the HTML (via stamp-assets.mjs).

   Why content-hash rather than the git SHA: the build id only needs to
   change when an asset changes. Hashing the commit would bust every
   client's cache on a code-only deploy, throwing away ~15MB of valid
   cached models and textures for nothing. Hashing the bytes means a
   code-only deploy keeps the same id and clients keep their cache,
   while any asset edit — in place or not — changes it automatically.

   The hash covers each file's repo-relative path and its bytes, so a
   rename, add, or delete moves the id too.

   Usage: node tools/gen-version.mjs  (run automatically by tools/deploy.mjs)
   Add --check to verify the committed version.js is current without
   writing — used to catch a stale id before deploying.
   ═══════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const versionPath = path.join(root, 'src/version.js');
const checkOnly = process.argv.includes('--check');

// ── Collect asset files, deterministically ──────────────────────────
function walk(dir, out = []) {
    if (!fs.existsSync(dir)) return out;
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : 1)) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p, out);
        else out.push(p);
    }
    return out;
}

const files = walk(path.join(root, 'assets'));
if (!files.length) {
    console.error('No files found under assets/ — refusing to generate a build id.');
    process.exit(1);
}

// Text assets (SVG, JSON) are subject to git's line-ending normalization, so
// the same logical file can hash differently on a CRLF checkout than on LF.
// Normalize CRLF -> LF for those so the id is reproducible across machines.
// Binary assets (GLB, PNG, MP4, MP3) are hashed byte-for-byte — rewriting
// bytes inside them would corrupt the hash's meaning.
const TEXT_EXT = new Set(['.svg', '.json', '.txt', '.md', '.xml']);

const h = crypto.createHash('sha256');
for (const f of files) {
    // Path first, so renames/deletes change the digest even if bytes repeat.
    h.update(path.relative(root, f).split(path.sep).join('/'));
    h.update('\0');
    let buf = fs.readFileSync(f);
    if (TEXT_EXT.has(path.extname(f).toLowerCase())) {
        buf = Buffer.from(buf.toString('utf8').replace(/\r\n/g, '\n'), 'utf8');
    }
    h.update(buf);
    h.update('\0');
}
const hash = h.digest('hex').slice(0, 12);

// Human-readable date prefix, so the id is legible in DevTools while the
// hash is what actually guarantees uniqueness.
const stamp = new Date().toISOString().slice(0, 10);
const BUILD_ID = `${stamp}-${hash}`;

// ── Preserve an existing id when the assets have not changed ────────
// Regenerating on every deploy would otherwise change the date prefix and
// needlessly bust caches. Only the hash half is authoritative.
let existing = null;
if (fs.existsSync(versionPath)) {
    const m = fs.readFileSync(versionPath, 'utf8').match(/BUILD_ID\s*=\s*'([^']+)'/);
    if (m) existing = m[1];
}
const unchanged = existing && existing.endsWith(`-${hash}`);
const finalId = unchanged ? existing : BUILD_ID;

if (checkOnly) {
    if (unchanged) {
        console.log(`BUILD_ID is current (${finalId}), ${files.length} asset files.`);
        process.exit(0);
    }
    console.error(`BUILD_ID is STALE.\n  committed: ${existing ?? '(none)'}\n  expected:  ...-${hash}\nRun: node tools/gen-version.mjs`);
    process.exit(1);
}

const out = `/* ═══════════════════════════════════════════════════════════════════
   MACHINE WARS — version.js (cache busting)

   ⚠ GENERATED FILE — do not edit by hand.
   Regenerate with: node tools/gen-version.mjs
   (tools/deploy.mjs runs it automatically before every deploy.)

   /assets/* is served \`immutable, max-age=1y\` (see _headers). That is
   the right policy for bandwidth, but it means a returning visitor keeps
   whatever copy their browser already has — overwriting a model or
   texture in place ships an update those visitors never see, because a
   browser does not even revalidate an immutable response until it
   expires.

   So asset URLs carry this build id as a ?v= query string. The bytes are
   identical but the URL is a distinct cache key, so a changed id makes
   clients refetch while unchanged deploys keep hitting cache.

   BUILD_ID is a sha256 over the path + bytes of every file under
   assets/, so it changes if and only if the assets change. A code-only
   deploy keeps the same id and clients keep their cached models.

   HTML and JS are \`no-cache\`, so a fresh page load always sees the
   current id and therefore the current assets.
   ═══════════════════════════════════════════════════════════════════ */
export const BUILD_ID = '${finalId}';

// Append the build id to an asset URL, preserving any existing query.
export function withVersion(url) {
    if (!url) return url;
    // Leave data:/blob: URLs alone — they carry their own payload and a
    // query string would corrupt them.
    if (/^(data|blob):/i.test(url)) return url;
    const sep = url.includes('?') ? '&' : '?';
    return \`\${url}\${sep}v=\${encodeURIComponent(BUILD_ID)}\`;
}
`;

const prev = fs.existsSync(versionPath) ? fs.readFileSync(versionPath, 'utf8') : '';
if (prev !== out) fs.writeFileSync(versionPath, out);

console.log(`${files.length} asset files hashed`);
console.log(`BUILD_ID = ${finalId}${unchanged ? '  (unchanged — assets identical, caches preserved)' : '  (NEW — assets changed)'}`);

// Keep the HTML in step; there is no build step to do it later.
execFileSync(process.execPath, [path.join(root, 'tools/stamp-assets.mjs')], { stdio: 'inherit' });
