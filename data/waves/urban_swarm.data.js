/* ═══════════════════════════════════════════════════════════════════
   waves/urban_swarm.data.js — tight-lane waveSet for `urban`
   (ROADMAP-V2 §3.1: "verticality + ambush — tight lanes, swarm-type").
   No dedicated swarm-type enemy exists yet (P7.4 scope, out of bounds
   here); this expresses the same read with the existing roster: scout
   and drone counts pushed well above classic_10's pacing (both are the
   fastest, lowest-hp types — a flood rather than a fight), heavy kept
   rare so the pressure stays about numbers, not tankiness. See
   data/README.md for the content contract.
   ═══════════════════════════════════════════════════════════════════ */
export default [
    { wave: 1, enemies: [{ type: 'scout', count: 5 }] },
    { wave: 2, enemies: [{ type: 'scout', count: 6 }, { type: 'drone', count: 2 }] },
    { wave: 3, enemies: [{ type: 'scout', count: 7 }, { type: 'drone', count: 3 }] },
    { wave: 4, enemies: [{ type: 'scout', count: 7 }, { type: 'drone', count: 4 }, { type: 'grunt', count: 2 }] },
    { wave: 5, enemies: [{ type: 'scout', count: 8 }, { type: 'drone', count: 4 }, { type: 'grunt', count: 2 }] },
    { wave: 6, enemies: [{ type: 'scout', count: 8 }, { type: 'drone', count: 5 }, { type: 'grunt', count: 3 } ] },
    { wave: 7, enemies: [{ type: 'scout', count: 9 }, { type: 'drone', count: 5 }, { type: 'grunt', count: 3 }, { type: 'heavy', count: 1 }] },
    { wave: 8, enemies: [{ type: 'scout', count: 9 }, { type: 'drone', count: 6 }, { type: 'grunt', count: 4 }, { type: 'heavy', count: 1 }] },
    { wave: 9, enemies: [{ type: 'scout', count: 10 }, { type: 'drone', count: 6 }, { type: 'grunt', count: 4 }, { type: 'heavy', count: 2 }] },
    { wave: 10, enemies: [{ type: 'scout', count: 10 }, { type: 'drone', count: 6 }, { type: 'grunt', count: 4 }, { type: 'heavy', count: 2 }, { type: 'boss', count: 1 }] },
];
