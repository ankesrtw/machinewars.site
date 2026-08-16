/* ═══════════════════════════════════════════════════════════════════
   m201 — URBAN COLLAPSE. Node: urban, requires warzone. Feeds the
   ocean AND-gate together with m202 (arctic). See
   data/objectives.schema.md for the objective vocabulary.
   ═══════════════════════════════════════════════════════════════════ */
export default {
    id: 'm201',
    node: 'urban',
    scene: 'urban',
    title: 'URBAN COLLAPSE',
    briefing: {
        speaker: 'CREON',
        lines: [
            'Civilians are still inside the collapse zone. The Horde does not care. You do.',
            'Hold the block until evac clears.',
        ],
        portrait: 'art/creon-machine-wars.png',
    },
    waveSet: 'classic_10',
    objectives: [
        { type: 'survive_waves', count: 10 },
        { type: 'no_damage', optional: true },
    ],
    rewards: { unlockNode: 'ocean' },
    debrief: {
        lines: [
            'The block holds. The Pacific platform is next — the Horde is dug in deeper there.',
        ],
    },
};
