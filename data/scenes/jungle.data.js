/* ═══════════════════════════════════════════════════════════════════
   jungle.data.js — scene config for "JUNGLE OUTPOST".
   Externalized from src/scenes-data.js SCENE_CONFIGS (P0.4). Paths
   (previewImage/textureUrl/sceneAssets[].file) are relative to
   ASSET_BASE/SCENE_MODEL_BASE/SCENE_TEXTURE_BASE, resolved by the
   src/scenes-data.js loader — not absolute here. See data/README.md.
   ═══════════════════════════════════════════════════════════════════ */
export default {
    id: "jungle",
    name: "JUNGLE OUTPOST",
    description: "Overgrown military base. Dense fog, ambush terrain.",
    previewGradient: "linear-gradient(135deg, #0a1a08 0%, #142810 50%, #061206 100%)",
    previewImage: "art/zones/jungle.jpg",
    sky: {
        type: "equirectangular",
        textureUrl: "skybox/jungle_sky.png",
        clearColor: [0.08, 0.12, 0.07, 1],
        fogColor: [0.08, 0.12, 0.07],
        fogDensity: 0.014,
        hasLightning: true,
        creon: {
            textureUrl: "art/creon-machine-wars.png",
            tint: [0.72, 0.9, 0.72],
            opacity: 0.82,
            size: 199,
            distance: 300,
            elevation: 0.4,
            azimuth: 3.15,
            crop: {
                x: 0.134,
                y: 0,
                w: 0.417,
                h: 0.508,
            },
        },
    },
    lighting: {
        ambientIntensity: 0.45,
        ambientDiffuse: [0.35, 0.5, 0.3],
        ambientGround: [0.08, 0.12, 0.06],
        sunIntensity: 0.45,
        sunDiffuse: [0.4, 0.55, 0.32],
        sunSpecular: [0.06, 0.08, 0.04],
        sunDirection: [-0.2, -1, -0.5],
        glowIntensity: 0.25,
    },
    ground: {
        type: "texture",
        textureUrl: "ground/jungle_ground.png",
        width: 320,
        height: 320,
        subdivisions: 110,
        displacementSeed: 66,
        displacementScale: 1.8,
        flatZoneRadius: 24,
        textureUScale: 8,
        textureVScale: 8,
        baseColor: "rgb(38, 52, 28)",
        fallbackColor: [0.15, 0.2, 0.11],
        specular: [0.04, 0.06, 0.03],
        specularPower: 16,
        slabPositions: [
            [0, 0],
            [-12, 8],
            [14, -6],
            [-6, -14],
            [8, 16],
            [-20, 4],
            [22, -12],
            [4, -20],
        ],
        slabColor: [0.22, 0.3, 0.16],
    },
    perimeter: {
        halfW: 80,
        halfD: 80,
    },
    gateHalfWidth: 8,
    wallColor: [0.2, 0.28, 0.14],
    pillarColor: [0.24, 0.32, 0.16],
    playerStart: {
        x: 0,
        y: 2.2,
        z: 8,
    },
    playerLookAt: {
        x: 0,
        y: 2.2,
        z: 0,
    },
    spawn: {
        arcAngle: 4.084070449666731,
        radiusMin: 32,
        radiusMax: 52,
        direction: -1,
    },
    sceneAssets: {
        rubble_pile: {
            file: "rubble_pile.glb",
            scale: 5,
            tint: {
                d: [0.25, 0.32, 0.18],
                e: [0.02, 0.04, 0.01],
            },
            placements: [
                {
                    x: -10,
                    z: -10,
                    ry: 0,
                },
                {
                    x: 12,
                    z: -14,
                    ry: 0.5,
                },
                {
                    x: -22,
                    z: -24,
                    ry: 1,
                },
                {
                    x: 20,
                    z: -18,
                    ry: 0.3,
                },
                {
                    x: -5,
                    z: -6,
                    ry: 0.8,
                },
                {
                    x: 16,
                    z: -4,
                    ry: 1.5,
                },
                {
                    x: -30,
                    z: -28,
                    ry: 0.2,
                },
                {
                    x: 8,
                    z: -34,
                    ry: 0.6,
                },
            ],
        },
        barricade: {
            file: "barricade.glb",
            scale: 4,
            tint: {
                d: [0.22, 0.3, 0.16],
                e: [0.02, 0.03, 0.01],
            },
            placements: [
                {
                    x: -6,
                    z: -4,
                    ry: 0,
                },
                {
                    x: 8,
                    z: -2,
                    ry: 0.2,
                },
                {
                    x: -14,
                    z: 3,
                    ry: 0.6,
                },
                {
                    x: 16,
                    z: 5,
                    ry: -0.4,
                },
                {
                    x: -20,
                    z: -10,
                    ry: 1,
                },
                {
                    x: 22,
                    z: -8,
                    ry: -0.7,
                },
            ],
        },
        wall_segment: {
            file: "wall_segment.glb",
            scale: 5.5,
            tint: {
                d: [0.2, 0.28, 0.14],
                e: [0.02, 0.03, 0.01],
            },
            placements: [
                {
                    x: -14,
                    z: -16,
                    ry: 0,
                },
                {
                    x: 16,
                    z: -14,
                    ry: 0.1,
                },
                {
                    x: -26,
                    z: -4,
                    ry: 0.5,
                },
                {
                    x: 24,
                    z: -2,
                    ry: -0.3,
                },
                {
                    x: -8,
                    z: -30,
                    ry: 0.15,
                },
                {
                    x: 10,
                    z: -32,
                    ry: -0.1,
                },
            ],
        },
        guard_tower: {
            file: "guard_tower.glb",
            scale: 10,
            tint: {
                d: [0.22, 0.3, 0.16],
                e: [0.02, 0.04, 0.01],
            },
            placements: [
                {
                    x: -35,
                    z: -30,
                    ry: 0,
                },
                {
                    x: 38,
                    z: -28,
                    ry: 0.3,
                },
                {
                    x: -40,
                    z: 15,
                    ry: 0.8,
                },
                {
                    x: 42,
                    z: 18,
                    ry: -0.5,
                },
            ],
        },
        burned_car: {
            file: "burned_car.glb",
            scale: 4.5,
            tint: {
                d: [0.2, 0.26, 0.14],
                e: [0.03, 0.04, 0.01],
            },
            placements: [
                {
                    x: -8,
                    z: -6,
                    ry: 0.4,
                },
                {
                    x: 12,
                    z: -10,
                    ry: -0.6,
                },
                {
                    x: -24,
                    z: -14,
                    ry: 1.9,
                },
                {
                    x: 26,
                    z: -20,
                    ry: -1.2,
                },
            ],
        },
        destroyed_apc: {
            file: "destroyed_apc.glb",
            scale: 6.5,
            tint: {
                d: [0.2, 0.28, 0.14],
                e: [0.02, 0.03, 0.01],
            },
            placements: [
                {
                    x: -14,
                    z: -22,
                    ry: 0.5,
                },
                {
                    x: 22,
                    z: -26,
                    ry: -0.7,
                },
            ],
        },
    },
    coverBlocks: [
        [-10, -34, 4, 1.5, 2.5, 0.2],
        [10, -34, 4, 1.5, 2.5, -0.2],
        [0, -26, 2, 5, 2, 0],
        [-18, -18, 5, 2, 3, 0],
        [16, -16, 3, 3, 2.5, 0.4],
        [-8, -8, 3, 2, 2, -0.2],
        [10, -6, 4, 1.5, 3, 0.4],
        [-24, -4, 3, 3, 2.5, 0],
        [22, -2, 4, 2, 2.5, -0.3],
        [-12, 6, 5, 1.5, 2.5, 0.5],
        [14, 8, 3, 3, 2, 0],
        [0, 18, 2, 4, 3, 0],
        [20, 20, 4, 2, 2.5, -0.4],
    ],
    coverColors: {
        light: [0.25, 0.34, 0.18],
        dark: [0.16, 0.22, 0.12],
    },
    cratePositions: [
        [-8, 2],
        [12, 5],
        [-20, -4],
        [22, -6],
        [-14, -12],
        [16, -10],
        [-28, 2],
        [32, 4],
        [-5, -24],
        [8, -28],
    ],
    barrelPositions: [
        [-6, -2],
        [10, 2],
        [-16, -8],
        [20, -2],
        [-10, -24],
        [14, -22],
        [-26, -12],
        [28, -10],
        [-8, -34],
        [10, -36],
    ],
    sandbagPositions: [
        [-4, 6, 0],
        [6, 8, 0.3],
        [-16, 3, 0.8],
        [18, 4, -0.5],
        [-10, -4, 1],
        [12, -2, -0.7],
    ],
    fenceLines: [
        {
            start: [-20, -40],
            end: [20, -40],
        },
        {
            start: [-40, -15],
            end: [-40, 15],
        },
        {
            start: [40, -12],
            end: [40, 16],
        },
    ],
    propColors: {
        crate: [0.25, 0.32, 0.18],
        crateDark: [0.16, 0.22, 0.12],
        barrel: [0.22, 0.28, 0.16],
        barrelRust: [0.35, 0.24, 0.1],
        barrelGreen: [0.18, 0.28, 0.12],
        sandbag: [0.3, 0.38, 0.2],
        pole: [0.22, 0.28, 0.14],
        wire: [0.24, 0.3, 0.16],
    },
    explosiveBarrelPositions: [
        [-10, -4],
        [14, -6],
        [-20, -14],
        [24, -10],
        [-8, -28],
        [16, -24],
        [-14, 6],
        [18, 10],
        [-26, -20],
        [30, -34],
    ],
    firePitPositions: [
        {
            x: -16,
            z: -16,
        },
        {
            x: 18,
            z: -20,
        },
        {
            x: 0,
            z: -32,
        },
    ],
    vehicleFirePositions: [
        {
            x: -8,
            z: -6,
        },
        {
            x: 12,
            z: -10,
        },
    ],
    smokeColumns: [
        {
            x: -28,
            z: -26,
        },
        {
            x: 24,
            z: -30,
        },
        {
            x: -5,
            z: -48,
        },
    ],
    background: {
        rocketPositions: [],
        radarPositions: [
            {
                x: -68,
                z: -24,
                ry: 0.3,
            },
            {
                x: 72,
                z: -20,
                ry: -0.5,
            },
        ],
        commPositions: [
            {
                x: -60,
                z: 12,
            },
            {
                x: 62,
                z: 10,
            },
            {
                x: 0,
                z: -82,
            },
        ],
        basePositions: [
            {
                x: -50,
                z: 18,
                ry: 0.1,
            },
            {
                x: 52,
                z: 16,
                ry: -0.2,
            },
        ],
        domePositions: [],
    },
};
