/* ═══════════════════════════════════════════════════════════════════
   m501 — ORBITAL WAR. Node: space, requires grid. Picks up
   immediately after the Grid's scripted defeat (m401) — the hub map
   has gone orbital by this point (ROADMAP-V2 §4.4/§6.4).
   ═══════════════════════════════════════════════════════════════════ */
export default {
    id: 'm501',
    node: 'space',
    scene: 'space',
    title: 'ORBITAL WAR',
    briefing: {
        speaker: 'CREON',
        lines: [
            'Earth is theirs. This station is what is left of us.',
            'If we lose orbit, we lose the war. Hold it.',
        ],
        portrait: 'art/creon-machine-wars.png',
    },
    waveSet: 'classic_10',
    objectives: [
        { type: 'survive_waves', count: 10 },
        { type: 'kill_type', enemy: 'boss', count: 1, optional: true },
    ],
    rewards: { unlockNode: 'mars' },
    debrief: {
        lines: [
            'The station holds. But the Horde is already burning for Mars.',
            'One front left.',
        ],
    },
};
