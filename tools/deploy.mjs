#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
   MACHINE WARS — deploy.mjs

   One command to ship: regenerate the asset build id, stamp it into the
   HTML, then push to Cloudflare Pages.

   The version step used to be manual, which meant a forgotten bump
   silently shipped assets that returning visitors would never fetch
   (see the Caching section of AGENTS.md). Routing every deploy through
   here makes that impossible to skip.

   Usage:
       node tools/deploy.mjs              deploy to Cloudflare Pages
       node tools/deploy.mjs --dry-run    version + stamp only, no upload

   Credentials come from .env (CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN),
   which is gitignored and never committed.
   ═══════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, execSync } from 'node:child_process';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dryRun = process.argv.includes('--dry-run');

function step(msg) { console.log(`\n\x1b[36m── ${msg}\x1b[0m`); }

// ── 1. Arena pages ──────────────────────────────────────────────────
// Before stamping: gen-version.mjs invokes stamp-assets.mjs, so the pages have
// to exist in final form first or they'd ship with the template's build id.
step('Generating arena pages');
execFileSync(process.execPath, [path.join(root, 'tools/gen-pages.mjs')], {
    stdio: 'inherit', cwd: root,
});

// ── 2. Build id + HTML stamping ─────────────────────────────────────
step('Generating asset build id');
execFileSync(process.execPath, [path.join(root, 'tools/gen-version.mjs')], {
    stdio: 'inherit', cwd: root,
});

if (dryRun) {
    console.log('\n--dry-run: stopping before upload.');
    process.exit(0);
}

// ── 3. Credentials ──────────────────────────────────────────────────
step('Loading credentials from .env');
const envPath = path.join(root, '.env');
if (!fs.existsSync(envPath)) {
    console.error('.env not found. It must define CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN.');
    process.exit(1);
}
const env = { ...process.env };
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/i);
    if (!m) continue;
    // Strip surrounding quotes and any trailing comment on unquoted values.
    let v = m[2].trim();
    if (/^"(.*)"$/.test(v) || /^'(.*)'$/.test(v)) v = v.slice(1, -1);
    env[m[1]] = v;
}
for (const k of ['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN']) {
    if (!env[k]) { console.error(`${k} missing from .env`); process.exit(1); }
}
console.log('account id + api token present');

// ── 4. Deploy ───────────────────────────────────────────────────────
step('Deploying to Cloudflare Pages');
const args = ['pages', 'deploy', '.', '--project-name', 'machinewars-site', '--commit-dirty=true'];

// Prefer running wrangler's JS entry point under this same node binary.
// Spawning the `npx`/`wrangler` shims directly is not portable: on Windows
// they are .cmd files, and Node >=20 refuses to spawnSync a .cmd without a
// shell (EINVAL). Resolving the package sidesteps the shim entirely.
let wranglerEntry = null;
try {
    const req = createRequire(path.join(root, 'noop.js'));
    const pkgPath = req.resolve('wrangler/package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const bin = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.wrangler;
    if (bin) wranglerEntry = path.join(path.dirname(pkgPath), bin);
} catch { /* not installed locally — fall back to npx below */ }

if (wranglerEntry && fs.existsSync(wranglerEntry)) {
    execFileSync(process.execPath, [wranglerEntry, ...args], { stdio: 'inherit', cwd: root, env });
} else {
    // No local install: go through npx, via the shell so Windows resolves
    // the .cmd shim correctly.
    execSync(`npx wrangler ${args.join(' ')}`, { stdio: 'inherit', cwd: root, env });
}
