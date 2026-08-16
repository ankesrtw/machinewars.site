/* ═══════════════════════════════════════════════════════════════════
   waves/arctic_shielded.data.js — waveSet for `arctic`
   (ROADMAP-V2 §3.1: "low visibility — shorter fog, shield-type
   pushing through it"). No shield-type enemy exists yet (P7.4 scope,
   out of bounds here); this expresses the same read with the existing
   roster: heavy-weighted from wave 1, so short-fog encounters open
   with slow, high-hp targets that keep closing rather than scouts to
   pick off at range. Scout/drone stay light throughout — this set is
   about tanky pressure, not numbers. See data/README.md for the
   content contract.
   ═══════════════════════════════════════════════════════════════════ */
export default [
    { wave: 1, enemies: [{ type: 'heavy', count: 1 }, { type: 'scout', count: 2 }] },
    { wave: 2, enemies: [{ type: 'heavy', count: 2 }, { type: 'scout', count: 2 }] },
    { wave: 3, enemies: [{ type: 'heavy', count: 2 }, { type: 'grunt', count: 2 } ] },
    { wave: 4, enemies: [{ type: 'heavy', count: 3 }, { type: 'grunt', count: 2 }] },
    { wave: 5, enemies: [{ type: 'heavy', count: 3 }, { type: 'grunt', count: 3 }, { type: 'drone', count: 1 }] },
    { wave: 6, enemies: [{ type: 'heavy', count: 4 }, { type: 'grunt', count: 3 }, { type: 'drone', count: 1 }] },
    { wave: 7, enemies: [{ type: 'heavy', count: 4 }, { type: 'grunt', count: 4 }, { type: 'drone', count: 2 }] },
    { wave: 8, enemies: [{ type: 'heavy', count: 5 }, { type: 'grunt', count: 4 }, { type: 'drone', count: 2 }] },
    { wave: 9, enemies: [{ type: 'heavy', count: 5 }, { type: 'grunt', count: 5 }, { type: 'drone', count: 2 }] },
    { wave: 10, enemies: [{ type: 'heavy', count: 5 }, { type: 'grunt', count: 5 }, { type: 'drone', count: 2 }, { type: 'boss', count: 1 }] },
];
