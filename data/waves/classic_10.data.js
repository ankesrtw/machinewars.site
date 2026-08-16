/* ═══════════════════════════════════════════════════════════════════
   waves/classic_10.data.js — the original 10-wave set, reproduced
   exactly from src/enemies.js's WAVE_CONFIGS (P0.3). Named sets, not
   one global array — WaveManager takes a waveSet id, defaulting to
   this one. See data/README.md for the content contract.
   ═══════════════════════════════════════════════════════════════════ */
export default [
    { wave: 1, enemies: [{ type: 'scout', count: 3 }] },
    { wave: 2, enemies: [{ type: 'scout', count: 3 }, { type: 'grunt', count: 2 }] },
    { wave: 3, enemies: [{ type: 'scout', count: 3 }, { type: 'grunt', count: 3 }, { type: 'heavy', count: 1 }] },
    { wave: 4, enemies: [{ type: 'scout', count: 2 }, { type: 'grunt', count: 3 }, { type: 'heavy', count: 1 }, { type: 'drone', count: 2 }] },
    { wave: 5, enemies: [{ type: 'scout', count: 3 }, { type: 'grunt', count: 4 }, { type: 'heavy', count: 2 }, { type: 'drone', count: 2 }] },
    { wave: 6, enemies: [{ type: 'grunt', count: 5 }, { type: 'heavy', count: 2 }, { type: 'drone', count: 3 }] },
    { wave: 7, enemies: [{ type: 'scout', count: 4 }, { type: 'grunt', count: 5 }, { type: 'heavy', count: 3 }, { type: 'drone', count: 3 }] },
    { wave: 8, enemies: [{ type: 'grunt', count: 6 }, { type: 'heavy', count: 3 }, { type: 'drone', count: 4 }] },
    { wave: 9, enemies: [{ type: 'scout', count: 5 }, { type: 'grunt', count: 5 }, { type: 'heavy', count: 4 }, { type: 'drone', count: 3 }] },
    { wave: 10, enemies: [{ type: 'grunt', count: 5 }, { type: 'heavy', count: 3 }, { type: 'drone', count: 3 }, { type: 'boss', count: 1 }] },
];
