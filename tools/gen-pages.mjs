#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
   MACHINE WARS — gen-pages.mjs

   Generates every play/<slug>/index.html from one template plus the
   scene data already in src/scenes-data.js.

   Why: the arena pages were 8 hand-maintained copies of the same 186
   lines, ~95% byte-identical, differing only in a title, a description,
   the data-scene attribute and the overlay caption. Any change to the
   game page or HUD had to be applied eight times by hand, and the
   inevitable happened — play/space/index.html drifted to a stale
   cache-busting id and served its icon and logo from a different cache
   key than every other page.

   The template is play/<TEMPLATE_SLUG>/index.html, so the page is still
   editable as a real, runnable page rather than a string in this file.
   Edit any arena page, run this, and the rest follow.

   Usage:
       node tools/gen-pages.mjs            # write all arena pages
       node tools/gen-pages.mjs --check    # exit 1 if any page is stale
       node tools/gen-pages.mjs --dry-run  # report without writing

   Cache-busting ids are NOT handled here — tools/stamp-assets.mjs owns
   those and runs over the generated files afterwards (see deploy.mjs).
   ═══════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCENE_CONFIGS, MISSION_ORDER } from '../src/scenes-data.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE_SLUG = 'warzone';
const args = process.argv.slice(2);
const check = args.includes('--check');
const dryRun = args.includes('--dry-run');

// The title and overlay use a short arena label, deliberately not cfg.name:
// the pages read "ARENA — WARZONE", not "INDUSTRIAL WARZONE". For every scene
// but one that label is just the uppercased slug, so derive it and keep the
// table for the exceptions only.
const ARENA_LABEL_OVERRIDES = { space: 'ORBITAL STATION' };
const arenaLabel = (slug) => ARENA_LABEL_OVERRIDES[slug] || slug.toUpperCase();

const templatePath = path.join(root, 'play', TEMPLATE_SLUG, 'index.html');
const template = fs.readFileSync(templatePath, 'utf8');

const tpl = SCENE_CONFIGS[TEMPLATE_SLUG];
const tplLabel = arenaLabel(TEMPLATE_SLUG);
const sectors = MISSION_ORDER.length;

/* Each replacement is anchored to surrounding markup rather than to the bare
   scene text, so a description that happens to contain a common word can't
   match somewhere unintended. */
function render(slug) {
    const cfg = SCENE_CONFIGS[slug];
    const label = arenaLabel(slug);
    if (!cfg) throw new Error(`No SCENE_CONFIGS entry for "${slug}"`);

    let out = template;
    // Verify the anchor *matched*, not that the text changed — rendering the
    // template's own slug legitimately produces identical output.
    const sub = (pattern, replacement, what) => {
        if (!pattern.test(out)) {
            throw new Error(`gen-pages: could not substitute ${what} for "${slug}" — template markup changed?`);
        }
        out = out.replace(pattern, replacement);
    };

    sub(
        /(<meta name="description" content="[^"]*?shooter\. )[^"]*?(">)/,
        (_m, head, tail) => `${head}${cfg.description}${tail}`,
        'meta description',
    );
    sub(
        /(<title>MACHINE WARS \/\/ )[^<]*?( — [^<]*<\/title>)/,
        (_m, head, tail) => `${head}${label}${tail}`,
        'title',
    );
    sub(/(<body data-scene=")[^"]*(")/, `$1${slug}$2`, 'data-scene');
    // The caption's trailing segment must stop at the line break: [^<]* would
    // otherwise swallow the newline and indentation before </div> and collapse
    // the block onto one line.
    sub(
        /(<div class="aw-overlay-sub">\s*\n\s*ARENA — )[^<\n]*(<br>\s*\n[ \t]*)[^<\n]*/,
        (_m, head, mid) => `${head}${label}${mid}${cfg.description}`,
        'overlay caption',
    );
    // Sector count is derived, so adding a scene to MISSION_ORDER updates the
    // copy instead of leaving eight hardcoded "8 SECTORS" strings behind.
    out = out.replace(/\b\d+ SECTORS\b/g, `${sectors} SECTORS`);
    out = out.replace(/\b(\d+) \/ \d+ SECTORS CLEARED\b/g, `$1 / ${sectors} SECTORS CLEARED`);
    return out;
}

// Guard: rendering the template's own slug must reproduce the template. If an
// anchor above has drifted it will match the wrong span (or nothing), and this
// catches that before eight pages get rewritten from a bad substitution.
// Sector counts are excluded — those are derived, so the template legitimately
// changes if a scene was added to MISSION_ORDER.
const stripSectors = (s) => s
    .replace(/\b\d+ SECTORS\b/g, 'N SECTORS')
    .replace(/\b(\d+) \/ \d+ SECTORS CLEARED\b/g, '$1 / N SECTORS CLEARED');
if (stripSectors(render(TEMPLATE_SLUG)) !== stripSectors(template)) {
    console.error('gen-pages: template does not round-trip — refusing to write.');
    console.error(`Check that play/${TEMPLATE_SLUG}/index.html still matches the expected markup.`);
    process.exit(1);
}

const slugs = Object.keys(SCENE_CONFIGS);
let stale = 0, written = 0;

for (const slug of slugs) {
    const file = path.join(root, 'play', slug, 'index.html');
    const next = render(slug);
    const prev = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    // Compare ignoring cache-bust ids: stamp-assets.mjs owns those, and the
    // template carries whatever id it was last stamped with.
    const norm = (s) => s.replace(/\?v=[\w.-]+/g, '?v=');
    if (prev !== null && norm(prev) === norm(next)) continue;

    stale++;
    if (check) { console.error(`stale: play/${slug}/index.html`); continue; }
    if (dryRun) { console.log(`would write: play/${slug}/index.html`); continue; }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, next);
    written++;
    console.log(`wrote play/${slug}/index.html`);
}

if (check) {
    if (stale) { console.error(`\n${stale} arena page(s) out of date — run: node tools/gen-pages.mjs`); process.exit(1); }
    console.log(`All ${slugs.length} arena pages up to date.`);
} else if (!dryRun) {
    console.log(written ? `\nGenerated ${written} of ${slugs.length} arena pages.` : `All ${slugs.length} arena pages already up to date.`);
}
