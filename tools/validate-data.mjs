#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
   validate-data.mjs — cross-file consistency checks over data/.

   Why: data-to-json.mjs only proves a file is JSON-literal shaped;
   validate-missions.mjs (folded into this file) only checked mission
   shape against the objective vocabulary and the campaign graph.
   Nothing checked *cross-file* references (ROADMAP-V2 risk 11): a
   scene's waveSet naming a real set, a wave set's enemies naming real
   enemy types, a campaign node's site resolving to a real scene, and
   the campaign graph itself being acyclic (previously only ever
   checked by a throwaway script, never committed). This is that
   checker, permanent, zero deps, same conventions as gen-pages.mjs /
   data-to-json.mjs.

   Usage:
       node tools/validate-data.mjs    # exit 1 and list every violation
   ═══════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import campaign from '../data/campaign.data.js';
import enemies from '../data/enemies.data.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_ROOT = path.join(ROOT, 'data');
const SCENES_DIR = path.join(DATA_ROOT, 'scenes');
const WAVES_DIR = path.join(DATA_ROOT, 'waves');
const MISSIONS_DIR = path.join(DATA_ROOT, 'missions');

// Mirrors the 11-type table in data/objectives.schema.md — the hard cap.
const OBJECTIVE_TYPES = new Set([
    'survive_waves', 'kill_count', 'kill_type', 'protect', 'reach_zone',
    'time_limit', 'no_damage', 'weapon_restriction', 'destroy_targets',
    'rescue', 'escort',
]);

let ok = true;
function fail(rel, msg) {
    ok = false;
    console.log(`FAIL  ${rel}: ${msg}`);
}

function loadDataDir(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
        .filter((f) => f.endsWith('.data.js'))
        .sort();
}

async function loadDefault(full) {
    const mod = await import(pathToFileURL(full).href + `?t=${Date.now()}`);
    return mod.default;
}

const enemyTypeIds = new Set(Object.keys(enemies));
const campaignNodeIds = new Set(Object.keys(campaign.nodes));

// ── waves: load all sets, check enemies[].type ─────────────────────
const waveSetIds = new Set();
{
    const files = loadDataDir(WAVES_DIR);
    for (const file of files) {
        const full = path.join(WAVES_DIR, file);
        const rel = path.relative(ROOT, full);
        const setId = file.replace(/\.data\.js$/, '');
        waveSetIds.add(setId);
        const waves = await loadDefault(full);
        if (!Array.isArray(waves)) {
            fail(rel, 'default export must be an array of wave configs');
            continue;
        }
        waves.forEach((w, i) => {
            if (!Array.isArray(w.enemies)) {
                fail(rel, `waves[${i}] has no enemies array`);
                return;
            }
            w.enemies.forEach((e, j) => {
                if (!enemyTypeIds.has(e.type)) {
                    fail(rel, `waves[${i}].enemies[${j}].type '${e.type}' is not in data/enemies.data.js`);
                }
            });
        });
    }
}

// ── scenes: check id matches filename, waveSet resolves ────────────
const sceneIds = new Set();
{
    const files = loadDataDir(SCENES_DIR);
    for (const file of files) {
        const full = path.join(SCENES_DIR, file);
        const rel = path.relative(ROOT, full);
        const slug = file.replace(/\.data\.js$/, '');
        const scene = await loadDefault(full);
        if (!scene || typeof scene !== 'object') {
            fail(rel, 'no default export');
            continue;
        }
        sceneIds.add(scene.id || slug);
        if (scene.id && scene.id !== slug) {
            fail(rel, `id '${scene.id}' does not match filename '${slug}'`);
        }
        if (scene.waveSet != null && !waveSetIds.has(scene.waveSet)) {
            fail(rel, `waveSet '${scene.waveSet}' does not exist in data/waves/`);
        }
    }
}

// ── campaign: every node's site resolves, requires/unlocks targets exist, acyclic ──
{
    const rel = 'data/campaign.data.js';
    for (const [nodeId, node] of Object.entries(campaign.nodes)) {
        if (node.implemented && node.site && !sceneIds.has(node.site)) {
            fail(rel, `node '${nodeId}': site '${node.site}' does not resolve to a data/scenes/*.data.js`);
        }
        for (const req of node.requires || []) {
            if (!campaignNodeIds.has(req)) {
                fail(rel, `node '${nodeId}': requires '${req}' does not exist`);
            }
        }
        for (const unl of node.unlocks || []) {
            if (!campaignNodeIds.has(unl)) {
                fail(rel, `node '${nodeId}': unlocks '${unl}' does not exist`);
            }
        }
    }
    if (campaign.startNode && !campaignNodeIds.has(campaign.startNode)) {
        fail(rel, `startNode '${campaign.startNode}' does not exist`);
    }

    // Cycle check via `requires` edges (child -> prerequisite); a valid
    // campaign DAG has no cycle in either requires or unlocks direction,
    // but requires is what actually gates unlocking, so that's the edge
    // set that matters for reachability.
    const WHITE = 0, GRAY = 1, BLACK = 2;
    const color = new Map(Object.keys(campaign.nodes).map((id) => [id, WHITE]));
    const stack = [];
    function visit(id) {
        if (color.get(id) === BLACK) return;
        if (color.get(id) === GRAY) {
            fail(rel, `cycle detected: ${stack.concat(id).join(' -> ')}`);
            return;
        }
        color.set(id, GRAY);
        stack.push(id);
        for (const req of campaign.nodes[id]?.requires || []) {
            if (campaignNodeIds.has(req)) visit(req);
        }
        stack.pop();
        color.set(id, BLACK);
    }
    for (const id of campaignNodeIds) visit(id);
}

// ── missions (folded in from validate-missions.mjs) ────────────────
{
    const files = loadDataDir(MISSIONS_DIR);
    for (const file of files) {
        const full = path.join(MISSIONS_DIR, file);
        const rel = path.relative(ROOT, full);
        const mission = await loadDefault(full);

        if (!mission || typeof mission !== 'object') {
            fail(rel, 'no default export');
            continue;
        }

        if (!mission.id) fail(rel, 'missing id');
        if (!mission.node) fail(rel, 'missing node');
        if (mission.node && !campaignNodeIds.has(mission.node)) {
            fail(rel, `node '${mission.node}' does not exist in data/campaign.data.js`);
        }
        if (!Array.isArray(mission.objectives) || !mission.objectives.length) {
            fail(rel, 'objectives must be a non-empty array');
        } else {
            mission.objectives.forEach((obj, i) => {
                if (!obj || typeof obj.type !== 'string') {
                    fail(rel, `objectives[${i}] has no type`);
                } else if (!OBJECTIVE_TYPES.has(obj.type)) {
                    fail(rel, `objectives[${i}].type '${obj.type}' is not one of the 11 in data/objectives.schema.md`);
                }
            });
        }

        const unlockNode = mission.rewards && mission.rewards.unlockNode;
        if (unlockNode != null && !campaignNodeIds.has(unlockNode)) {
            fail(rel, `rewards.unlockNode '${unlockNode}' does not exist in data/campaign.data.js`);
        }

        if (mission.outcome === 'scripted_defeat' && !mission.finale) {
            fail(rel, "outcome 'scripted_defeat' requires a finale block (ROADMAP-V2 §4.4)");
        }
    }
}

if (ok) console.log('ok    all data/ cross-file references check out');
process.exit(ok ? 0 : 1);
