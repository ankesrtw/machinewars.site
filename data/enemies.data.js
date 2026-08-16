/* ═══════════════════════════════════════════════════════════════════
   enemies.data.js — per-type score values.
   Externalized from src/main.js's SCORE_VALUES (P0.2). Keys must match
   ENEMY_TYPES in src/enemies.js. P0.3 will add the full enemy type
   definitions here; this seeds just the score field per the roadmap's
   §4.1 table. See data/README.md for the content contract.
   ═══════════════════════════════════════════════════════════════════ */
export default {
    scout: { score: 100 },
    grunt: { score: 200 },
    heavy: { score: 500 },
    drone: { score: 150 },
    boss:  { score: 1000 },
};
