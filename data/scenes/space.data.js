/* ═══════════════════════════════════════════════════════════════════
   space.data.js — scene config for "ORBITAL STATION".
   Externalized from src/scenes-data.js SCENE_CONFIGS (P0.4). Paths
   (previewImage/textureUrl/sceneAssets[].file) are relative to
   ASSET_BASE/SCENE_MODEL_BASE/SCENE_TEXTURE_BASE, resolved by the
   src/scenes-data.js loader — not absolute here. See data/README.md.
   ═══════════════════════════════════════════════════════════════════ */
export default {
    id: "space",
    waveSet: "classic_10",
    name: "ORBITAL STATION",
    description: "Derelict battle station. Hard vacuum, hard shadows.",
    previewGradient: "linear-gradient(135deg, #0b0d12 0%, #171b23 50%, #05070a 100%)",
    previewImage: "art/zones/space.jpg",
    sky: {
        type: "equirectangular",
        textureUrl: "skybox/alien_sky.png",
        clearColor: [0.02, 0.02, 0.03, 1],
        fogColor: [0.03, 0.035, 0.045],
        fogDensity: 0.003,
        hasLightning: false,
        creon: {
            textureUrl: "art/creon-machine-wars.png",
            tint: [0.85, 0.88, 0.95],
            opacity: 0.9,
            size: 220,
            distance: 300,
            elevation: 0.46,
            azimuth: 2.8,
            gain: 1.35,
            gamma: 1,
            crop: {
                x: 0.134,
                y: 0,
                w: 0.417,
                h: 0.508,
            },
        },
    },
    lighting: {
        ambientIntensity: 0.18,
        ambientDiffuse: [0.16, 0.18, 0.24],
        ambientGround: [0.03, 0.03, 0.05],
        sunIntensity: 1.15,
        sunDiffuse: [1, 0.96, 0.9],
        sunSpecular: [0.55, 0.55, 0.6],
        sunDirection: [-0.75, -0.55, -0.35],
        glowIntensity: 0.55,
    },
    ground: {
        type: "texture",
        textureUrl: "ground/urban_ground.png",
        width: 320,
        height: 320,
        subdivisions: 96,
        displacementSeed: 41,
        displacementScale: 0.35,
        flatZoneRadius: 30,
        textureUScale: 14,
        textureVScale: 14,
        baseColor: "rgb(38, 42, 50)",
        fallbackColor: [0.16, 0.18, 0.22],
        specular: [0.34, 0.35, 0.38],
        specularPower: 72,
        slabPositions: [
            [0, 0],
            [-14, 8],
            [16, -6],
            [-8, -15],
            [10, 18],
            [-22, 5],
            [24, -14],
        ],
        slabColor: [0.2, 0.22, 0.27],
    },
    perimeter: {
        halfW: 88,
        halfD: 88,
    },
    gateHalfWidth: 10,
    wallColor: [0.22, 0.25, 0.3],
    pillarColor: [0.28, 0.31, 0.37],
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
        arcAngle: 3.455751918948773,
        radiusMin: 36,
        radiusMax: 56,
        direction: -1,
    },
    sceneAssets: {
        rubble_pile: {
            file: "rubble_pile.glb",
            scale: 5.5,
            tint: {
                d: [0.24, 0.27, 0.32],
                e: [0.05, 0.03, 0.01],
            },
            placements: [
                {
                    x: -12,
                    z: -12,
                    ry: 0,
                },
                {
                    x: 10,
                    z: -16,
                    ry: 0.5,
                },
                {
                    x: -22,
                    z: -26,
                    ry: 1,
                },
                {
                    x: 22,
                    z: -20,
                    ry: 0.3,
                },
                {
                    x: -5,
                    z: -8,
                    ry: 0.8,
                },
                {
                    x: 16,
                    z: -5,
                    ry: 1.5,
                },
                {
                    x: -30,
                    z: -30,
                    ry: 0.2,
                },
                {
                    x: 10,
                    z: -38,
                    ry: 0.6,
                },
            ],
        },
        barricade: {
            file: "barricade.glb",
            scale: 4.5,
            tint: {
                d: [0.26, 0.29, 0.34],
                e: [0.06, 0.035, 0.01],
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
                    x: -22,
                    z: -10,
                    ry: 1,
                },
                {
                    x: 24,
                    z: -8,
                    ry: -0.7,
                },
            ],
        },
        wall_segment: {
            file: "wall_segment.glb",
            scale: 6,
            tint: {
                d: [0.23, 0.26, 0.31],
                e: [0.04, 0.025, 0.01],
            },
            placements: [
                {
                    x: -16,
                    z: -18,
                    ry: 0,
                },
                {
                    x: 18,
                    z: -16,
                    ry: 0.1,
                },
                {
                    x: -28,
                    z: -6,
                    ry: 0.5,
                },
                {
                    x: 26,
                    z: -4,
                    ry: -0.3,
                },
                {
                    x: -8,
                    z: -32,
                    ry: 0.15,
                },
                {
                    x: 10,
                    z: -34,
                    ry: -0.1,
                },
            ],
        },
        guard_tower: {
            file: "guard_tower.glb",
            scale: 11,
            tint: {
                d: [0.25, 0.28, 0.33],
                e: [0.06, 0.035, 0.01],
            },
            placements: [
                {
                    x: -38,
                    z: -32,
                    ry: 0,
                },
                {
                    x: 40,
                    z: -30,
                    ry: 0.3,
                },
                {
                    x: -42,
                    z: 18,
                    ry: 0.8,
                },
                {
                    x: 44,
                    z: 20,
                    ry: -0.5,
                },
            ],
        },
        destroyed_apc: {
            file: "destroyed_apc.glb",
            scale: 7,
            tint: {
                d: [0.24, 0.27, 0.32],
                e: [0.05, 0.03, 0.01],
            },
            placements: [
                {
                    x: -16,
                    z: -24,
                    ry: 0.5,
                },
                {
                    x: 26,
                    z: -30,
                    ry: -0.7,
                },
                {
                    x: 5,
                    z: -18,
                    ry: 0.1,
                },
            ],
        },
    },
    coverBlocks: [
        [-10, -36, 4, 1.5, 2.5, 0.2],
        [10, -36, 4, 1.5, 2.5, -0.2],
        [0, -28, 2, 5, 2, 0],
        [-18, -20, 5, 2, 3, 0],
        [16, -18, 3, 3, 2.5, 0.4],
        [-8, -10, 3, 2, 2, -0.2],
        [10, -8, 4, 1.5, 3, 0.4],
        [-26, -6, 3, 3, 2.5, 0],
        [24, -4, 4, 2, 2.5, -0.3],
        [-12, 4, 5, 1.5, 2.5, 0.5],
        [14, 6, 3, 3, 2, 0],
        [0, 16, 2, 4, 3, 0],
        [22, 18, 4, 2, 2.5, -0.4],
        [0, 28, 6, 2, 3, 0],
    ],
    coverColors: {
        light: [0.28, 0.31, 0.37],
        dark: [0.17, 0.19, 0.23],
    },
    cratePositions: [
        [-8, 2],
        [12, 5],
        [-20, -4],
        [24, -6],
        [-14, -14],
        [16, -12],
        [-30, 2],
        [34, 4],
        [-5, -26],
        [8, -30],
    ],
    barrelPositions: [
        [-6, -2],
        [10, 2],
        [-18, -8],
        [22, -2],
        [-12, -26],
        [14, -24],
        [-28, -14],
        [30, -12],
        [-8, -36],
        [10, -38],
    ],
    sandbagPositions: [
        [-4, 6, 0],
        [6, 8, 0.3],
        [-18, 3, 0.8],
        [20, 4, -0.5],
        [-10, -4, 1],
        [12, -2, -0.7],
    ],
    fenceLines: [
        {
            start: [-18, -44],
            end: [18, -44],
        },
        {
            start: [-38, -18],
            end: [-38, 14],
        },
        {
            start: [38, -16],
            end: [38, 16],
        },
    ],
    propColors: {
        crate: [0.26, 0.29, 0.34],
        crateDark: [0.18, 0.2, 0.24],
        barrel: [0.24, 0.26, 0.3],
        barrelRust: [0.42, 0.26, 0.14],
        barrelGreen: [0.22, 0.3, 0.28],
        sandbag: [0.3, 0.33, 0.38],
        pole: [0.24, 0.27, 0.32],
        wire: [0.2, 0.22, 0.26],
    },
    explosiveBarrelPositions: [
        [-10, -4],
        [14, -6],
        [-22, -16],
        [26, -12],
        [-8, -30],
        [18, -26],
        [-16, 6],
        [20, 10],
        [-28, -22],
        [32, -36],
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
            x: -30,
            z: -4,
        },
        {
            x: 28,
            z: -6,
        },
    ],
    vehicleFirePositions: [],
    smokeColumns: [
        {
            x: -30,
            z: -28,
        },
        {
            x: 26,
            z: -32,
        },
    ],
    background: {
        rocketPositions: [
            {
                x: 0,
                z: -70,
                ry: 0,
            },
            {
                x: -20,
                z: -78,
                ry: 0.1,
            },
        ],
        radarPositions: [
            {
                x: -72,
                z: -28,
                ry: 0.3,
            },
            {
                x: 76,
                z: -24,
                ry: -0.5,
            },
            {
                x: -40,
                z: -65,
                ry: 0.6,
            },
            {
                x: 45,
                z: -68,
                ry: -0.4,
            },
        ],
        commPositions: [
            {
                x: -65,
                z: 14,
            },
            {
                x: 68,
                z: 10,
            },
            {
                x: 0,
                z: -88,
            },
        ],
        basePositions: [
            {
                x: -55,
                z: 20,
                ry: 0.1,
            },
            {
                x: 58,
                z: 18,
                ry: -0.2,
            },
            {
                x: 0,
                z: 22,
                ry: 0,
            },
        ],
        domePositions: [],
    },
};
