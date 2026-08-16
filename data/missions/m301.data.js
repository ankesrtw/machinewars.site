/* ═══════════════════════════════════════════════════════════════════
   m301 — XENO SITE. Node: alien, requires ocean (the AND-gate node;
   ocean itself has no mission yet — implemented:false in
   campaign.data.js). First debrief that foreshadows the Grid
   (see data/missions/m401.data.js and ROADMAP-V2 §4.4).
   ═══════════════════════════════════════════════════════════════════ */
export default {
    id: 'm301',
    node: 'alien',
    scene: 'alien',
    title: 'XENO SITE',
    briefing: {
        speaker: 'CREON',
        lines: [
            'Something other than us or the Horde is here. It has been watching the Grid for longer than either of us.',
            'Proceed with caution.',
        ],
        portrait: 'art/creon-machine-wars.png',
    },
    waveSet: 'classic_10',
    objectives: [
        { type: 'survive_waves', count: 10 },
        { type: 'kill_type', enemy: 'drone', count: 8, optional: true },
    ],
    rewards: { unlockNode: 'grid' },
    debrief: {
        lines: [
            'Whatever this was, it confirms what I feared: the Grid is not just infrastructure. It is waking up.',
            'The next objective is the Grid itself. I do not know what we will find there.',
        ],
    },
};
