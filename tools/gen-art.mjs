#!/usr/bin/env node
/**
 * gen-art.mjs — generate site art via the Replicate API.
 *
 * Reads REPLICATE_API_TOKENS (or REPLICATE_API_TOKEN) from .env — same loader
 * style as tools/deploy.mjs. The token is never logged.
 *
 * Usage:
 *   node tools/gen-art.mjs --list                 # show every job, no API calls
 *   node tools/gen-art.mjs --dry-run              # resolve prompts + cost, no API calls
 *   node tools/gen-art.mjs --set=zones            # generate the 7 warzone cards
 *   node tools/gen-art.mjs --set=zones --model=schnell   # cheap drafts ($0.003/img)
 *   node tools/gen-art.mjs --only=mars,arctic     # regenerate specific jobs
 *   node tools/gen-art.mjs --set=all --model=dev  # everything, final quality
 *
 * Flags:
 *   --model=schnell|dev|pro   default dev
 *   --seed=<int>              base seed; each job derives seed+index for a
 *                             consistent-looking set that is reproducible
 *   --force                   overwrite existing files (default: skip them)
 *   --concurrency=<n>         parallel requests, default 3
 *
 * Prompts and art direction live in art-prompts-v2.md — edit PROMPTS below to
 * match if you change that file.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* ── .env loader (mirrors tools/deploy.mjs) ───────────────────────────── */
function loadEnv() {
    const file = path.join(ROOT, '.env');
    if (!fs.existsSync(file)) return {};
    const out = {};
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
        const s = line.trim();
        if (!s || s.startsWith('#')) continue;
        const i = s.indexOf('=');
        if (i < 0) continue;
        out[s.slice(0, i).trim()] = s.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    }
    return out;
}

/* ── Models ───────────────────────────────────────────────────────────── */
const MODELS = {
    schnell: { id: 'black-forest-labs/flux-schnell', usd: 0.003, label: 'FLUX schnell (draft)' },
    dev:     { id: 'black-forest-labs/flux-dev',     usd: 0.025, label: 'FLUX dev (final)' },
    pro:     { id: 'black-forest-labs/flux-1.1-pro', usd: 0.04,  label: 'FLUX 1.1 pro' },
};

/* ── Shared style anchor — keep in sync with art-prompts-v2.md ─────────── */
/* NOTE: FLUX has no negative-prompt input — stating "not teal" does nothing, and the
   first schnell pass drifted cyan (arctic, warzone) and yellow-green (desert). The grade
   is therefore pinned POSITIVELY here, naming the neutral-ash target explicitly. */
const ANCHOR =
    'Dark cinematic military-industrial sci-fi, distant future, photoreal PBR rendering. ' +
    'STRICTLY NEUTRAL GREY COLOUR GRADE: shadows are pure neutral charcoal grey and ash, ' +
    'midtones are colourless desaturated concrete grey, the sky is flat achromatic grey haze. ' +
    'The ONLY colour anywhere in the frame is warm amber-orange firelight from small practical ' +
    'sources. Everything else is greyscale, as if the colour was drained out. ' +
    'Heavy volumetric atmosphere, anamorphic lens character, subtle film grain, ' +
    'shallow depth of field, high detail, 8k, no text, no watermark. ' +
    /* "cinematic still" made FLUX bake letterbox bars into the image, which show as
       black stripes once a card crops to fill — say "cinematic" without "still". */
    'Full bleed photograph filling the entire frame, no letterbox bars, no black borders.';

const NEGATIVE =
    'text, watermark, logo, letters, blurry, low quality, cartoon, anime, oversaturated, ' +
    'neon green, cyan teal grading, bright daylight, cheerful, HDR clipping, lens flare spam, ' +
    'clean pristine surfaces';

/* Warzone cards: subject in the upper two-thirds, lower third quiet — the card
   scrim and title sit over the bottom. */
const ZONE = (body) =>
    `${ANCHOR}. Wide establishing shot, no people, no characters. ${body} ` +
    'Composition keeps the subject in the upper two thirds of the frame; the lower third ' +
    'is visually quiet, darker and less detailed, empty ground or haze.';

const PROMPTS = [
    /* ── PRIORITY 1: warzone cards (4:3) ── */
    { name: 'warzone', set: 'zones', ar: '4:3', out: 'assets/art/zones/warzone.jpg', prompt: ZONE(
        'A ruined post-industrial compound at dusk. Collapsed gantries, rusted pipework, a toppled ' +
        'cooling tower silhouetted against a smoke-choked flat grey sky. Burning wreckage mid-ground ' +
        'throwing warm amber light up into thick drifting grey fog. Neutral grey haze in the far ' +
        'distance. Wet grey concrete ground reflecting the fires.') },

    { name: 'mars', set: 'zones', ar: '4:3', out: 'assets/art/zones/mars.jpg', prompt: ZONE(
        'An abandoned Mars colony in a dust storm. Cracked geodesic domes, half-buried habitat ' +
        'modules, a broken comms mast leaning against a dim dust-choked sky. Visibility collapsing ' +
        'into desaturated grey-brown murk, muted and almost colourless. A single amber emergency ' +
        'beacon still pulsing on a distant structure. Fine airborne dust catching the light.') },

    { name: 'alien', set: 'zones', ar: '4:3', out: 'assets/art/zones/alien.jpg', prompt: ZONE(
        'An otherworldly crash site at night. A vast unfamiliar hull half-embedded in dark rock, its ' +
        'seams leaking faint pale-blue bioluminescence. Twisted non-human geometry, scattered glowing ' +
        'debris, low ground mist lit from beneath in cold ice-blue. Amber human floodlights rigged at ' +
        'the perimeter for contrast. Eerie and still.') },

    { name: 'desert', set: 'zones', ar: '4:3', out: 'assets/art/zones/desert.jpg', prompt: ZONE(
        'A makeshift military outpost in high desert at harsh midday. Sandbagged revetments, camo ' +
        'netting snapping in wind, prefab shelters and a comms dish on a ridge. Sun-bleached pale ' +
        'grey-tan sand, heat shimmer flattening the horizon, hard shadows, hazy pale sky. Muted ' +
        'low-saturation palette. Warm amber floodlights and a lit doorway glow on the shelters. ' +
        'A dust devil in the middle distance.') },

    { name: 'urban', set: 'zones', ar: '4:3', out: 'assets/art/zones/urban.jpg', prompt: ZONE(
        'A devastated city block after a machine assault. Collapsed apartment facades, a bus crushed ' +
        'under rubble, rebar clawing from broken concrete. Overcast steel-grey sky, ash falling like ' +
        'snow. Amber fires burning in two upper windows. A long empty street receding into grey haze. ' +
        'Total absence of people.') },

    { name: 'jungle', set: 'zones', ar: '4:3', out: 'assets/art/zones/jungle.jpg', prompt: ZONE(
        'An overgrown military base reclaimed by dense jungle. Vine-choked concrete bunkers, a rotting ' +
        'watchtower, a rusted transport swallowed by undergrowth. Heavy low fog between huge tree ' +
        'trunks, shafts of pale grey light breaking the canopy. Heavily desaturated near-monochrome ' +
        'palette, the foliage drained almost to grey-black, wet and dark. Oppressive, claustrophobic.') },

    { name: 'arctic', set: 'zones', ar: '4:3', out: 'assets/art/zones/arctic.jpg', prompt: ZONE(
        'A frozen research outpost in a blizzard. Ice-caked antenna arrays, a half-buried quonset hut, ' +
        'wind-carved snow drifts against dark rock. Whiteout conditions flattening depth. The snow ' +
        'and sky are neutral white and pale grey, completely colourless, like black and white film. ' +
        'A single amber floodlight burning through driving snow is the only colour. Brutal, exposed.') },

    /* ── SPACE WARS — next wavezone. Card art + a wider hero-style banner. ── */
    { name: 'space', set: 'space', ar: '4:3', out: 'assets/art/zones/space.jpg', prompt: ZONE(
        'A colossal derelict orbital battle station hanging in deep space above a dark planet, its ' +
        'hull torn open along one flank, exposed decks and severed structural spars drifting in a ' +
        'debris field of shattered hull plating. Airless, absolute stillness. The scene is lit by ' +
        'hard raking sunlight from one side leaving the other half in pure black shadow. Warm amber ' +
        'emergency lighting glows from inside the breached compartments and along a docking spine. ' +
        'Starfield deep black, no nebula colour, no blue or purple space clouds. ' +
        'Full bleed edge to edge image, no letterbox bars, no black borders.') },

    { name: 'space-banner', set: 'space', ar: '16:9', out: 'assets/art/space-wars-banner.jpg', prompt:
        `${ANCHOR}. Cinematic key art, wide. The interior of a breached space station hangar, ` +
        'looking out through a shattered bay door into black space where a wrecked warship drifts. ' +
        'Foreground is a dark silhouetted deck strewn with debris and severed cabling. Hard sunlight ' +
        'rakes in through the opening; warm amber emergency strip lighting runs along the deck edges. ' +
        'Weightless debris hangs motionless in the vacuum. Deep black starfield, no coloured nebula. ' +
        'Vast, silent, hostile.' },

    /* ── PRIORITY 2: hero key art (16:9) — subject RIGHT, left third empty ── */
    { name: 'hero', set: 'hero', ar: '16:9', out: 'assets/art/hero-key.jpg', prompt:
        `${ANCHOR}. Cinematic key art. A colossal weathered robotic face, thirty storeys tall, built ` +
        'into the hull of a ruined orbital station, looms in the RIGHT half of the frame, one optic ' +
        'dark and one burning faint ember-red, presiding over a burning city far below. The LEFT ' +
        'THIRD of the frame is deep shadow and drifting smoke, nearly empty negative space with no ' +
        'subject. A lone soldier in heavy armour stands small in the lower right, back to camera, ' +
        'dwarfed by the machine. Amber ground fires, cold steel-blue atmospheric haze, ash in the air.' },

    /* ── PRIORITY 3: faction emblems (1:1) ── */
    { name: 'fac-human', set: 'factions', ar: '1:1', out: 'assets/art/factions/human-resistance.png', prompt:
        'Flat vector military emblem, single flat colour on pure black background, crisp geometric ' +
        'linework, no gradients, no text. A broken chevron shield reinforced with improvised welded ' +
        'plating, cracked but holding, a small hand-stencilled star at its centre. Scavenged, ' +
        'hand-made, defiant. Centered, symmetrical, high contrast.' },

    { name: 'fac-rogue', set: 'factions', ar: '1:1', out: 'assets/art/factions/machine-horde.png', prompt:
        'Flat vector emblem, single flat colour on pure black background, crisp geometric linework, ' +
        'no gradients, no text. An aggressive angular machine skull inside a hexagonal targeting ' +
        'reticle, six radiating spikes suggesting a swarm. Cold, mass-produced, industrially stamped. ' +
        'Centered, symmetrical, high contrast.' },

    { name: 'fac-ghost', set: 'factions', ar: '1:1', out: 'assets/art/factions/the-ghost.png', prompt:
        'Flat vector emblem, single flat colour on pure black background, crisp geometric linework, ' +
        'no gradients, no text. A minimal open circuit-trace forming the suggestion of a face in ' +
        'negative space, present but not solid, half the lines deliberately missing. Elegant and ' +
        'restrained. Centered, symmetrical, high contrast.' },
];

/* ── CLI ──────────────────────────────────────────────────────────────── */
const argv = process.argv.slice(2);
const flag = (n, d = null) => {
    const hit = argv.find(a => a === `--${n}` || a.startsWith(`--${n}=`));
    if (!hit) return d;
    return hit.includes('=') ? hit.slice(hit.indexOf('=') + 1) : true;
};

const DRY = !!flag('dry-run');
const LIST = !!flag('list');
const FORCE = !!flag('force');
const SEED = parseInt(flag('seed', '20870704'), 10);
const CONC = Math.max(1, parseInt(flag('concurrency', '3'), 10));
const modelKey = String(flag('model', 'dev'));
const MODEL = MODELS[modelKey];

if (!MODEL) {
    console.error(`Unknown --model=${modelKey}. Options: ${Object.keys(MODELS).join(', ')}`);
    process.exit(1);
}

const setArg = flag('set', null);
const onlyArg = flag('only', null);
let jobs = PROMPTS;
if (onlyArg) {
    const want = new Set(String(onlyArg).split(',').map(s => s.trim()));
    jobs = jobs.filter(j => want.has(j.name));
} else if (setArg && setArg !== 'all') {
    const want = new Set(String(setArg).split(',').map(s => s.trim()));
    jobs = jobs.filter(j => want.has(j.set));
}

if (LIST) {
    console.log('Available jobs:\n');
    for (const j of PROMPTS) console.log(`  ${j.name.padEnd(12)} set=${j.set.padEnd(9)} ${j.ar.padEnd(5)} -> ${j.out}`);
    console.log(`\nSets: ${[...new Set(PROMPTS.map(j => j.set))].join(', ')}, or --set=all`);
    process.exit(0);
}

if (!jobs.length) {
    console.error('No jobs matched. Try --list to see available names/sets.');
    process.exit(1);
}

/* Skip files that already exist unless --force. */
const skipped = [];
if (!FORCE) {
    jobs = jobs.filter(j => {
        if (fs.existsSync(path.join(ROOT, j.out))) { skipped.push(j.name); return false; }
        return true;
    });
}

console.log(`Model:   ${MODEL.label}  [${MODEL.id}]`);
console.log(`Jobs:    ${jobs.length}${skipped.length ? `  (skipping ${skipped.length} existing: ${skipped.join(', ')} — use --force to overwrite)` : ''}`);
console.log(`Est.:    $${(jobs.length * MODEL.usd).toFixed(3)}  (${jobs.length} x $${MODEL.usd})`);
console.log(`Seed:    ${SEED} (per-job: seed + index)\n`);

if (!jobs.length) { console.log('Nothing to do.'); process.exit(0); }

if (DRY) {
    for (const j of jobs) {
        console.log(`── ${j.name} (${j.ar}) -> ${j.out}`);
        console.log(`   ${j.prompt.slice(0, 160)}...\n`);
    }
    console.log('Dry run — no API calls made, no files written.');
    process.exit(0);
}

/* ── Generate ─────────────────────────────────────────────────────────── */
const env = loadEnv();
// Accepts the plural spelling too — .env used REPLICATE_API_TOKENS historically.
const TOKEN = env.REPLICATE_API_TOKEN || env.REPLICATE_API_TOKENS
    || process.env.REPLICATE_API_TOKEN || process.env.REPLICATE_API_TOKENS;

if (!TOKEN) {
    console.error('No REPLICATE_API_TOKEN found in .env or environment.');
    process.exit(1);
}

async function generate(job, idx) {
    const input = {
        prompt: job.prompt,
        aspect_ratio: job.ar,
        // Photographic art ships as JPEG (an 8x-10x size win, immutable-cached);
        // emblems keep PNG for transparency.
        output_format: job.out.endsWith('.jpg') ? 'jpg' : 'png',
        num_outputs: 1,
        seed: SEED + idx,
        disable_safety_checker: false,
    };
    // schnell has no guidance/steps knobs worth setting; dev/pro take quality hints.
    if (modelKey !== 'schnell') {
        input.output_quality = 95;
        input.go_fast = false;
    }

    const res = await fetch(`https://api.replicate.com/v1/models/${MODEL.id}/predictions`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${TOKEN}`,
            'Content-Type': 'application/json',
            // Max accepted by the API is 60; longer runs fall through to polling below.
            Prefer: 'wait=60',
        },
        body: JSON.stringify({ input }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);

    let pred = await res.json();

    // Prefer:wait usually returns terminal, but poll if it timed out mid-flight.
    const started = Date.now();
    while (!['succeeded', 'failed', 'canceled'].includes(pred.status)) {
        if (Date.now() - started > 300000) throw new Error('timed out after 5 min');
        await new Promise(r => setTimeout(r, 2500));
        const p = await fetch(`https://api.replicate.com/v1/predictions/${pred.id}`, {
            headers: { Authorization: `Bearer ${TOKEN}` },
        });
        pred = await p.json();
    }

    if (pred.status !== 'succeeded') throw new Error(`${pred.status}: ${pred.error || 'unknown'}`);

    const url = Array.isArray(pred.output) ? pred.output[0] : pred.output;
    if (!url) throw new Error('no output url returned');

    const img = await fetch(url);
    if (!img.ok) throw new Error(`download HTTP ${img.status}`);
    const buf = Buffer.from(await img.arrayBuffer());

    const dest = path.join(ROOT, job.out);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, buf);
    return { kb: Math.round(buf.length / 1024) };
}

/* Simple concurrency pool. */
let cursor = 0, ok = 0, fail = 0;
const failures = [];

async function worker() {
    while (cursor < jobs.length) {
        const idx = cursor++;
        const job = jobs[idx];
        const t0 = Date.now();
        try {
            const { kb } = await generate(job, idx);
            ok++;
            console.log(`  ok    ${job.name.padEnd(12)} ${String(kb).padStart(5)} KB  ${((Date.now() - t0) / 1000).toFixed(1)}s  -> ${job.out}`);
        } catch (e) {
            fail++;
            failures.push(`${job.name}: ${e.message}`);
            console.log(`  FAIL  ${job.name.padEnd(12)} ${e.message}`);
        }
    }
}

console.log('Generating...\n');
await Promise.all(Array.from({ length: Math.min(CONC, jobs.length) }, worker));

console.log(`\nDone. ${ok} succeeded, ${fail} failed.  Actual spend ~$${(ok * MODEL.usd).toFixed(3)}`);
if (failures.length) {
    console.log('\nFailures:');
    failures.forEach(f => console.log('  ' + f));
}
if (ok > 0) {
    console.log('\nNext: review the images, then run `node tools/gen-version.mjs` to re-stamp');
    console.log('the cache-busting id before deploying (assets are immutable-cached for 1y).');
}
process.exit(fail > 0 && ok === 0 ? 1 : 0);
