'use strict';

/* ═══════════════════════════════════════════════════════════════════
   MACHINE WARS — save.js
   Single versioned localStorage key. Schema matches docs/track-a-web-android.md
   0.2 so it can grow into settings/stats without a migration.
   ═══════════════════════════════════════════════════════════════════ */

import { MISSION_ORDER, DEFAULT_SCENE } from './scenes-data.js';

const KEY = 'mw.save.v1';

function defaults() {
    return {
        v: 1,
        settings: { master: 70, sfx: 80, music: 50, sensitivity: 36, fog: 40, quality: 'high', invertY: false, gamepadDeadzone: 0.18 },
        progress: { arenasUnlocked: [DEFAULT_SCENE], missionsCompleted: [] },
        stats: { bestScorePerArena: {}, totalKills: 0, waveReached: {} },
    };
}

function load() {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return defaults();
        const parsed = JSON.parse(raw);
        if (!parsed || parsed.v !== 1) return defaults();
        // Shallow-merge onto defaults so a save written before a field existed
        // (e.g. an older client) still has every key the game reads.
        const d = defaults();
        return {
            v: 1,
            settings: { ...d.settings, ...parsed.settings },
            progress: { ...d.progress, ...parsed.progress },
            stats: { ...d.stats, ...parsed.stats },
        };
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
        v: 1,
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

// Marks sceneId completed and unlocks whatever follows it in MISSION_ORDER.
// Safe to call more than once (replaying an already-cleared mission).
function unlockNext(completedSceneId) {
    const cur = load();
    const missions = new Set(cur.progress.missionsCompleted);
    missions.add(completedSceneId);
    const unlocked = new Set(cur.progress.arenasUnlocked);
    const idx = MISSION_ORDER.indexOf(completedSceneId);
    if (idx !== -1 && idx + 1 < MISSION_ORDER.length) unlocked.add(MISSION_ORDER[idx + 1]);
    return patch({ progress: { missionsCompleted: [...missions], arenasUnlocked: [...unlocked] } });
}

// First arena in MISSION_ORDER that isn't unlocked yet — where a locked
// direct-navigation should send the player back to.
function firstLockedScene() {
    const cur = load();
    return MISSION_ORDER.find((id) => !cur.progress.arenasUnlocked.includes(id)) || null;
}

const Save = { load, save, patch, isUnlocked, unlockNext, firstLockedScene, KEY };
export { Save };
