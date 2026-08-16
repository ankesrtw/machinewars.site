/* ═══════════════════════════════════════════════════════════════════
   waves/alien_unfamiliar.data.js — waveSet for `alien`
   (ROADMAP-V2 §3.1: "unfamiliar — spider/artillery types, alien
   movement feel"). No spider/artillery-type enemy exists yet (P7.4
   scope, out of bounds here); this expresses the same read with the
   existing roster's one erratic/flying type: drone-heavy throughout
   (drone is the only `flies`+`zigzag` type — the closest existing
   analogue to "moves unlike anything else on the roster"), backed by
   grunt/heavy rather than scout swarms so the fight reads as alien
   pressure, not a numbers flood. See data/README.md for the content
   contract.
   ═══════════════════════════════════════════════════════════════════ */
export default [
    { wave: 1, enemies: [{ type: 'drone', count: 3 }] },
    { wave: 2, enemies: [{ type: 'drone', count: 4 }, { type: 'grunt', count: 2 }] },
    { wave: 3, enemies: [{ type: 'drone', count: 5 }, { type: 'grunt', count: 2 }] },
    { wave: 4, enemies: [{ type: 'drone', count: 5 }, { type: 'grunt', count: 3 }, { type: 'heavy', count: 1 }] },
    { wave: 5, enemies: [{ type: 'drone', count: 6 }, { type: 'grunt', count: 3 }, { type: 'heavy', count: 1 }] },
    { wave: 6, enemies: [{ type: 'drone', count: 6 }, { type: 'grunt', count: 4 }, { type: 'heavy', count: 2 }] },
    { wave: 7, enemies: [{ type: 'drone', count: 7 }, { type: 'grunt', count: 4 }, { type: 'heavy', count: 2 }] },
    { wave: 8, enemies: [{ type: 'drone', count: 7 }, { type: 'grunt', count: 5 }, { type: 'heavy', count: 3 }] },
    { wave: 9, enemies: [{ type: 'drone', count: 8 }, { type: 'grunt', count: 5 }, { type: 'heavy', count: 3 }] },
    { wave: 10, enemies: [{ type: 'drone', count: 8 }, { type: 'grunt', count: 5 }, { type: 'heavy', count: 3 }, { type: 'boss', count: 1 }] },
];
