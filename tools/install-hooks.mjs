#!/usr/bin/env node
/* Installs the repo's git hooks into .git/hooks.
   Hooks are not versioned by git itself, so this copies them in.
   Run once per clone:  node tools/install-hooks.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hooksDir = path.join(root, '.git/hooks');

if (!fs.existsSync(hooksDir)) {
    console.error('.git/hooks not found — run this from inside the repo.');
    process.exit(1);
}

for (const name of ['pre-commit']) {
    const src = path.join(root, 'tools', name);
    const dest = path.join(hooksDir, name);
    fs.copyFileSync(src, dest);
    try { fs.chmodSync(dest, 0o755); } catch { /* no-op on Windows */ }
    console.log(`installed ${name} -> .git/hooks/${name}`);
}
