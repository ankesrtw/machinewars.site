#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
   validate-missions.mjs — check every data/missions/<id>.data.js
   against the objective vocabulary and the campaign graph.

   Why: data-to-json.mjs only proves a mission file is JSON-literal
   shaped; it says nothing about whether the mission is internally
   consistent. Two mistakes are easy to make by hand and invisible
   until Unity's importer (or a future runtime) chokes on them: an
   objectives[].type outside the 11-type hard cap
   (data/objectives.schema.md), and a rewards.unlockNode naming a
   campaign node that does not exist (data/campaign.data.js). This
   script checks both, zero deps, same conventions as gen-pages.mjs /
   data-to-json.mjs.

   Usage:
       node tools/validate-missions.mjs    # exit 1 and list every violation
   ═══════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import campaign from '../data/campaign.data.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MISSIONS_DIR = path.join(ROOT, 'data', 'missions');

// Mirrors the 11-type table in data/objectives.schema.md — the hard cap.
const OBJECTIVE_TYPES = new Set([
    'survive_waves', 'kill_count', 'kill_type', 'protect', 'reach_zone',
    'time_limit', 'no_damage', 'weapon_restriction', 'destroy_targets',
    'rescue', 'escort',
]);

const campaignNodeIds = new Set(Object.keys(campaign.nodes));

if (!fs.existsSync(MISSIONS_DIR)) {
    console.log('No data/missions/ directory yet — nothing to validate.');
    process.exit(0);
}

const files = fs.readdirSync(MISSIONS_DIR)
    .filter((f) => f.endsWith('.data.js'))
    .sort();

if (!files.length) {
    console.log('No data/missions/*.data.js files yet — nothing to validate.');
    process.exit(0);
}

let ok = true;

for (const file of files) {
    const full = path.join(MISSIONS_DIR, file);
    const rel = path.relative(ROOT, full);
    const mod = await import(pathToFileURL(full).href + `?t=${Date.now()}`);
    const mission = mod.default;

    if (!mission || typeof mission !== 'object') {
        ok = false;
        console.log(`FAIL  ${rel}: no default export`);
        continue;
    }

    const errors = [];

    if (!mission.id) errors.push('missing id');
    if (!mission.node) errors.push('missing node');
    if (mission.node && !campaignNodeIds.has(mission.node)) {
        errors.push(`node '${mission.node}' does not exist in data/campaign.data.js`);
    }
    if (!Array.isArray(mission.objectives) || !mission.objectives.length) {
        errors.push('objectives must be a non-empty array');
    } else {
        mission.objectives.forEach((obj, i) => {
            if (!obj || typeof obj.type !== 'string') {
                errors.push(`objectives[${i}] has no type`);
            } else if (!OBJECTIVE_TYPES.has(obj.type)) {
                errors.push(`objectives[${i}].type '${obj.type}' is not one of the 11 in data/objectives.schema.md`);
            }
        });
    }

    const unlockNode = mission.rewards && mission.rewards.unlockNode;
    if (unlockNode != null && !campaignNodeIds.has(unlockNode)) {
        errors.push(`rewards.unlockNode '${unlockNode}' does not exist in data/campaign.data.js`);
    }

    if (mission.outcome === 'scripted_defeat' && !mission.finale) {
        errors.push("outcome 'scripted_defeat' requires a finale block (ROADMAP-V2 §4.4)");
    }

    if (errors.length) {
        ok = false;
        console.log(`FAIL  ${rel}:`);
        for (const e of errors) console.log(`        ${e}`);
    } else {
        console.log(`ok    ${rel}`);
    }
}

process.exit(ok ? 0 : 1);
