/* ═══════════════════════════════════════════════════════════════════
   waves/ocean_air.data.js — waveSet for `ocean`
   (ROADMAP-V2 §3.1/§3 table: "no ground approach — platform arena over
   water, drone/flier-heavy waveSet"). `drone` is the roster's only
   `flies`+`flyHeight` type, so it stands in for the platform's aerial
   assault axis — grunt/heavy come in low over the walkways as the
   ground-adjacent threat, scout stays light throughout (fast harassment,
   not a real pressure axis here). Heavier and earlier drone counts than
   any other waveSet — this is the numbers-in-the-air read, not a tanky
   or swarm one. See data/README.md for the content contract.
   ═══════════════════════════════════════════════════════════════════ */
export default [
    { wave: 1, enemies: [{ type: 'drone', count: 2 }, { type: 'scout', count: 1 }] },
    { wave: 2, enemies: [{ type: 'drone', count: 3 }, { type: 'scout', count: 1 }] },
    { wave: 3, enemies: [{ type: 'drone', count: 3 }, { type: 'grunt', count: 1 }] },
    { wave: 4, enemies: [{ type: 'drone', count: 4 }, { type: 'grunt', count: 2 }] },
    { wave: 5, enemies: [{ type: 'drone', count: 4 }, { type: 'grunt', count: 2 }, { type: 'scout', count: 2 }] },
    { wave: 6, enemies: [{ type: 'drone', count: 5 }, { type: 'grunt', count: 2 }, { type: 'heavy', count: 1 }] },
    { wave: 7, enemies: [{ type: 'drone', count: 5 }, { type: 'grunt', count: 3 }, { type: 'heavy', count: 1 }] },
    { wave: 8, enemies: [{ type: 'drone', count: 6 }, { type: 'grunt', count: 3 }, { type: 'heavy', count: 1 }] },
    { wave: 9, enemies: [{ type: 'drone', count: 6 }, { type: 'grunt', count: 3 }, { type: 'heavy', count: 2 }] },
    { wave: 10, enemies: [{ type: 'drone', count: 7 }, { type: 'grunt', count: 3 }, { type: 'heavy', count: 2 }, { type: 'boss', count: 1 }] },
];
