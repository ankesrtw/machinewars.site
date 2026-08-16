/* ═══════════════════════════════════════════════════════════════════
   m203 — OCEAN LAUNCH GRID. Node: ocean, requires urban AND arctic
   (the AND-gate — m201/m202 both feed it). Second Grid foreshadow
   (ROADMAP-V2 §4.4 wants two prior debriefs; m401's header noted this
   one as a TODO before ocean shipped — m301/alien was the first).
   ═══════════════════════════════════════════════════════════════════ */
export default {
    id: 'm203',
    node: 'ocean',
    scene: 'ocean',
    title: 'OCEAN LAUNCH GRID',
    briefing: {
        speaker: 'CREON',
        lines: [
            'This platform launches what is left of the evacuation fleet. No ground approach — the Horde comes in over the water, and it will not stop coming.',
            'Hold the launch grid.',
        ],
        portrait: 'art/creon-machine-wars.png',
    },
    waveSet: 'ocean_air',
    objectives: [
        { type: 'survive_waves', count: 10 },
        { type: 'kill_type', enemy: 'drone', count: 12, optional: true },
    ],
    rewards: { unlockNode: 'alien' },
    debrief: {
        lines: [
            'The fleet is away. I felt something else while you fought — a signal from the Grid itself, watching this. It is not passive infrastructure anymore.',
            'I do not think it will let the rest of Earth go quietly.',
        ],
    },
};
