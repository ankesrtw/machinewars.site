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
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dryRun = process.argv.includes('--dry-run');

function step(msg) { console.log(`\n\x1b[36m── ${msg}\x1b[0m`); }

// ── 1. Build id + HTML stamping ─────────────────────────────────────
step('Generating asset build id');
execFileSync(process.execPath, [path.join(root, 'tools/gen-version.mjs')], {
    stdio: 'inherit', cwd: root,
});

if (dryRun) {
    console.log('\n--dry-run: stopping before upload.');
    process.exit(0);
}

// ── 2. Credentials ──────────────────────────────────────────────────
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

// ── 3. Deploy ───────────────────────────────────────────────────────
step('Deploying to Cloudflare Pages');
execFileSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['wrangler', 'pages', 'deploy', '.', '--project-name', 'machinewars-site', '--commit-dirty=true'],
    { stdio: 'inherit', cwd: root, env },
);
