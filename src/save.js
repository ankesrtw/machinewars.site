'use strict';

/* ═══════════════════════════════════════════════════════════════════
   MACHINE WARS — save.js
   Single versioned localStorage key. v2 adds the campaign graph
   (data/campaign.data.js) alongside the v1 linear-arena fields, which
   the hub picker (buildScenePicker() in main.js) still reads directly
   and unchanged — graph-driven hub UI is P4.1, not this file.
   ═══════════════════════════════════════════════════════════════════ */

import { MISSION_ORDER, DEFAULT_SCENE } from './scenes-data.js';
import campaign from '../data/campaign.data.js';

const KEY = 'mw.save.v1';
const CAMPAIGN_START = campaign.startNode;

// ── TEMPORARY: all arenas/nodes unlocked for manual playtesting ─────
// Normal progression unlocks one arena/node at a time via completeMission()
// / completeNode(). While this flag is true every arena and campaign node
// is reachable immediately, so a tester can jump straight to any scene
// instead of clearing missions first.
//
// TO REVERT: set to false. That restores progression for new saves and for
// anyone who has not already been granted the full list; saves written while
// the flag was on keep their unlocks (they look like ordinary progress).
const UNLOCK_ALL_NODES = true;

function unlockedAtStart() {
    return UNLOCK_ALL_NODES ? [...MISSION_ORDER] : [DEFAULT_SCENE];
}

function nodesUnlockedAtStart() {
    return UNLOCK_ALL_NODES ? Object.keys(campaign.nodes) : [CAMPAIGN_START];
}

function defaults() {
    return {
        v: 2,
        settings: { master: 70, sfx: 80, music: 50, sensitivity: 36, fog: 40, quality: 'high', invertY: false, gamepadDeadzone: 0.18 },
        progress: {
            arenasUnlocked: unlockedAtStart(),
            missionsCompleted: [],
            nodesUnlocked: nodesUnlockedAtStart(),
            nodesCompleted: [],
            currentNode: CAMPAIGN_START,
        },
        stats: { bestScorePerArena: {}, totalKills: 0, waveReached: {} },
    };
}

// v1 had no nodesUnlocked/nodesCompleted/currentNode — derive them from the
// v1 progress instead of discarding it, so upgrading the client never wipes
// real playtesting progress. Best-effort: v1's arenasUnlocked/missionsCompleted
// map onto graph node ids 1:1 today (every node id already equals a scene id),
// so this is a rename, not a reinterpretation.
function migrateV1(parsed) {
    const p = parsed.progress || {};
    const nodesCompleted = [...new Set(p.missionsCompleted || [])].filter((id) => campaign.nodes[id]);
    const nodesUnlocked = [...new Set([CAMPAIGN_START, ...(p.arenasUnlocked || [])])].filter((id) => campaign.nodes[id]);
    return {
        ...parsed,
        v: 2,
        progress: {
            ...p,
            nodesUnlocked,
            nodesCompleted,
            currentNode: nodesCompleted[nodesCompleted.length - 1] || CAMPAIGN_START,
        },
    };
}

function load() {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return defaults();
        let parsed = JSON.parse(raw);
        if (!parsed || typeof parsed.v !== 'number') return defaults();
        if (parsed.v === 1) parsed = migrateV1(parsed);
        if (parsed.v !== 2) return defaults();
        // Shallow-merge onto defaults so a save written before a field existed
        // (e.g. an older client) still has every key the game reads.
        const d = defaults();
        const merged = {
            v: 2,
            settings: { ...d.settings, ...parsed.settings },
            progress: { ...d.progress, ...parsed.progress },
            stats: { ...d.stats, ...parsed.stats },
        };
        // The shallow merge lets a stored arenasUnlocked/nodesUnlocked win
        // outright, so an existing save would stay locked while
        // UNLOCK_ALL_NODES is on. Union the two instead — testers with prior
        // progress get every arena/node, and no real progress is ever discarded.
        if (UNLOCK_ALL_NODES) {
            merged.progress.arenasUnlocked = [
                ...new Set([...MISSION_ORDER, ...(merged.progress.arenasUnlocked || [])]),
            ];
            merged.progress.nodesUnlocked = [
                ...new Set([...Object.keys(campaign.nodes), ...(merged.progress.nodesUnlocked || [])]),
            ];
        }
        return merged;
    } catch (e) {
        console.warn('[MW] save load failed, using defaults:', e);
        return defaults();
    }
}

function save(data) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); }
    catch (e) { console.warn('[MW] save write failed:', e); }
}

function patch(partial) {
    const cur = load();
    const next = {
        v: 2,
        settings: { ...cur.settings, ...(partial.settings || {}) },
        progress: { ...cur.progress, ...(partial.progress || {}) },
        stats: { ...cur.stats, ...(partial.stats || {}) },
    };
    save(next);
    return next;
}

function isUnlocked(sceneId) {
    const cur = load();
    return cur.progress.arenasUnlocked.includes(sceneId);
}

// Marks nodeId completed, then unions in every node whose `requires` (an AND
// list) are now fully satisfied by nodesCompleted — including nodes several
// steps away if their prerequisites all happened to already be done (e.g.
// completing arctic after urban was already done unlocks ocean directly).
function completeNode(nodeId) {
    const cur = load();
    const completed = new Set(cur.progress.nodesCompleted);
    completed.add(nodeId);
    const unlocked = new Set(cur.progress.nodesUnlocked);
    unlocked.add(nodeId);
    for (const [id, node] of Object.entries(campaign.nodes)) {
        if (node.requires.length && node.requires.every((r) => completed.has(r))) unlocked.add(id);
    }
    return patch({
        progress: {
            nodesCompleted: [...completed],
            nodesUnlocked: [...unlocked],
            currentNode: nodeId,
        },
    });
}

// Back-compat shim for src/main.js's linear-arena flow (buildScenePicker(),
// gameWin()) — still the only thing driving the hub UI until P4.1. Keeps the
// v1 arenasUnlocked/missionsCompleted fields working exactly as before, and
// additionally advances the graph fields via completeNode() when the scene
// being completed is also a campaign node (true for every arena today).
function unlockNext(completedSceneId) {
    const cur = load();
    const missions = new Set(cur.progress.missionsCompleted);
    missions.add(completedSceneId);
    const unlocked = new Set(cur.progress.arenasUnlocked);
    const idx = MISSION_ORDER.indexOf(completedSceneId);
    if (idx !== -1 && idx + 1 < MISSION_ORDER.length) unlocked.add(MISSION_ORDER[idx + 1]);
    const next = patch({ progress: { missionsCompleted: [...missions], arenasUnlocked: [...unlocked] } });
    return campaign.nodes[completedSceneId] ? completeNode(completedSceneId) : next;
}

// First arena in MISSION_ORDER that isn't unlocked yet — where a locked
// direct-navigation should send the player back to.
function firstLockedScene() {
    const cur = load();
    return MISSION_ORDER.find((id) => !cur.progress.arenasUnlocked.includes(id)) || null;
}

const Save = { load, save, patch, isUnlocked, unlockNext, completeNode, firstLockedScene, KEY };
export { Save };
