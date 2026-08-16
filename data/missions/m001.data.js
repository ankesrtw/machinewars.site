/* ═══════════════════════════════════════════════════════════════════
   m001 — JUNGLE OUTPOST. Opening mission of the campaign (node: jungle),
   promoted from an orphaned scene after ghats/ghats_east retired (P1.9.1).
   See data/objectives.schema.md for the objective vocabulary and
   data/README.md for the content contract.
   ═══════════════════════════════════════════════════════════════════ */
export default {
    id: 'm001',
    node: 'jungle',
    scene: 'jungle',
    title: 'JUNGLE OUTPOST',
    briefing: {
        speaker: 'CREON',
        lines: [
            'Signal traced to an overgrown outpost. The Horde is already dug in.',
            'Fog and cover favor an ambush. Stay sharp — this is where it starts.',
        ],
        portrait: 'art/creon-machine-wars.png',
    },
    waveSet: 'classic_10',
    objectives: [
        { type: 'survive_waves', count: 10 },
        { type: 'kill_type', enemy: 'scout', count: 5, optional: true },
    ],
    rewards: { unlockNode: 'warzone' },
    debrief: {
        lines: [
            'Outpost cleared. The Horde knows we are moving now.',
        ],
    },
};
