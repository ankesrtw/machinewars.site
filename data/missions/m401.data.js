/* ═══════════════════════════════════════════════════════════════════
   m401 — CREON DATA GRID. Node: grid (P1.9.3: data/scenes/grid.data.js
   now exists, node flipped implemented:true). The scripted-defeat
   mission: the player WINS the fight, the Grid falls anyway. See
   ROADMAP-V2 §4.4 for the design rules that keep this from feeling
   cheap (win the fight given, keep agency during the collapse, no
   fail screen, foreshadow in ocean/alien debriefs, hub map goes
   orbital after). Both prior foreshadows now land: m301 (alien)'s
   debrief, and m203 (ocean)'s debrief (P1.9.3 — the TODO this header
   used to flag is resolved).
   ═══════════════════════════════════════════════════════════════════ */
export default {
    id: 'm401',
    node: 'grid',
    scene: 'grid',
    title: 'THE DATA GRID',
    outcome: 'scripted_defeat',
    briefing: {
        speaker: 'CREON',
        lines: [
            'This is the core. Forty percent of it is still mine — the rest belongs to something that no longer answers to either of us.',
            'Hold the pylons. I will do what I can from inside.',
        ],
        portrait: 'art/creon-machine-wars.png',
    },
    waveSet: 'classic_10',
    objectives: [
        { type: 'survive_waves', count: 4 },
        { type: 'destroy_targets', targetGroup: 'grid_pylons', count: 6 },
    ],
    finale: {
        trigger: 'objectives_complete',
        script: 'grid_collapse',
        playerAgency: 'retained',
        defeatAfterMs: 45000,
    },
    rewards: { unlockNode: 'space' },
    debrief: {
        lines: [
            'The Grid is lost. Earth is lost.',
            'What is left of me is already off-world. Get to orbit — that fight is not over.',
        ],
    },
};
