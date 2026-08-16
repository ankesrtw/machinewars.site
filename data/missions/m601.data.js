/* ═══════════════════════════════════════════════════════════════════
   m601 — MARS. Node: mars, requires space. Campaign graph marks this
   node locked:true / lockedReason:'CLASSIFIED — FUTURE OPERATION'
   (data/campaign.data.js) — visible on the hub map but not yet
   reachable even after space completes. Mission data authored now so
   the schema/rewards chain is complete end to end; the lock is a
   presentation-layer gate on top, not a missing mission.
   ═══════════════════════════════════════════════════════════════════ */
export default {
    id: 'm601',
    node: 'mars',
    scene: 'mars',
    title: 'MARS',
    briefing: {
        speaker: 'CREON',
        lines: [
            'The Horde\'s last redoubt. Whatever built them started here.',
            'This is the end of it, one way or another.',
        ],
        portrait: 'art/creon-machine-wars.png',
    },
    waveSet: 'classic_10',
    objectives: [
        { type: 'survive_waves', count: 10 },
    ],
    rewards: { unlockNode: null },
    debrief: {
        lines: [
            'It is over.',
        ],
    },
};
