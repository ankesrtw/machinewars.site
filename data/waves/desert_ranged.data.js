/* ═══════════════════════════════════════════════════════════════════
   waves/desert_ranged.data.js — long-sightline waveSet for `desert`
   (ROADMAP-V2 §3.1: "long sightlines — sniper-type, ranged-heavy").
   No sniper-type enemy exists yet (P7.4, hard-capped at 3 new
   behavioural flags — out of scope here); this expresses the same
   read with the existing roster: fewer, higher-eyeRange/higher-hp
   grunt/heavy pairs and no drones (drones read as close-range
   harassment, wrong for an open relay array), pushing fights toward
   longer engagement distance and heavier per-kill investment instead
   of scout swarm-clearing. See data/README.md for the content
   contract.
   ═══════════════════════════════════════════════════════════════════ */
export default [
    { wave: 1, enemies: [{ type: 'grunt', count: 2 }] },
    { wave: 2, enemies: [{ type: 'grunt', count: 3 }] },
    { wave: 3, enemies: [{ type: 'grunt', count: 3 }, { type: 'heavy', count: 1 }] },
    { wave: 4, enemies: [{ type: 'grunt', count: 4 }, { type: 'heavy', count: 1 }] },
    { wave: 5, enemies: [{ type: 'grunt', count: 4 }, { type: 'heavy', count: 2 }] },
    { wave: 6, enemies: [{ type: 'grunt', count: 5 }, { type: 'heavy', count: 2 }] },
    { wave: 7, enemies: [{ type: 'grunt', count: 5 }, { type: 'heavy', count: 3 }] },
    { wave: 8, enemies: [{ type: 'grunt', count: 6 }, { type: 'heavy', count: 3 }] },
    { wave: 9, enemies: [{ type: 'grunt', count: 6 }, { type: 'heavy', count: 4 }] },
    { wave: 10, enemies: [{ type: 'grunt', count: 6 }, { type: 'heavy', count: 4 }, { type: 'boss', count: 1 }] },
];
