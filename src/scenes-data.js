'use strict';

/* ═══════════════════════════════════════════════════════════════════
   MACHINE WARS — scenes.js
   Scene configuration module — all scene-specific data lives here.
   Each scene config captures sky, lighting, ground, layout, props,
   particles, and spawn parameters.
   ═══════════════════════════════════════════════════════════════════ */

// ── Asset base path ─────────────────────────────────────────────────
// Resolve assets from this module rather than from the page URL. This remains
// correct from /play/, /play/<arena>/, and deployments mounted below a path.
const ASSET_BASE = new URL('../assets/', import.meta.url).href;

const SCENE_MODEL_BASE = ASSET_BASE + 'models/';
const SCENE_TEXTURE_BASE = ASSET_BASE + 'textures/';

// ═════════════════════════════════════════════════════════════════════
// SCENE CONFIGS
// ═════════════════════════════════════════════════════════════════════

const SCENE_CONFIGS = {

    // ─────────────────────────────────────────────────────────────────
    // SCENE 1: INDUSTRIAL WARZONE (original, enhanced with AI textures)
    // ─────────────────────────────────────────────────────────────────
    warzone: {
        id: 'warzone',
        name: 'INDUSTRIAL WARZONE',
        description: 'Post-industrial compound. Heavy fog, burning wreckage.',
        previewGradient: 'linear-gradient(135deg, #1a1510 0%, #3a2510 50%, #0a0a08 100%)',
        previewImage: ASSET_BASE + 'art/creon-station.png',

        // Sky
        sky: {
            type: 'procedural', // 'procedural' | 'equirectangular'
            textureUrl: null,   // set after generation
            clearColor: [0.18, 0.17, 0.15, 1],
            fogColor: [0.18, 0.17, 0.15],
            fogDensity: 0.008,
            hasLightning: true,
            // CREON — the orbital relay looming over the horizon.
            creon: {
                textureUrl: 'art/creon-machine-wars.png',
                tint: [1.0, 0.86, 0.72],
                opacity: 0.9,
                size: 213,
                distance: 300,
                elevation: 0.4,
                azimuth: 3.14159,
                crop: { x: 0.134, y: 0.0, w: 0.417, h: 0.508 },
            },
            // Procedural sky params (used when type === 'procedural')
            baseColor: 'rgb(78, 70, 62)',
            horizonGlow: true,
        },

        // Lighting
        lighting: {
            ambientIntensity: 0.52,
            ambientDiffuse: [0.66, 0.60, 0.56],
            ambientGround: [0.18, 0.15, 0.13],
            sunIntensity: 1.0,
            sunDiffuse: [0.80, 0.72, 0.64],
            sunSpecular: [0.12, 0.10, 0.08],
            sunDirection: [-0.3, -1, -0.5],
            glowIntensity: 0.35,
        },

        // Ground
        ground: {
            type: 'procedural', // 'procedural' | 'texture'
            textureUrl: null,
            width: 320, height: 320, subdivisions: 110,
            displacementSeed: 77,
            displacementScale: 1.6,
            flatZoneRadius: 26,
            textureSeed: 123,
            textureUScale: 8, textureVScale: 8,
            baseColor: 'rgb(72, 62, 52)',
            specular: [0.06, 0.05, 0.04],
            specularPower: 24,
            // Slab patches
            slabPositions: [
                [0, 0], [-12, 8], [15, -5], [-6, -14], [8, 16], [-20, 4],
                [22, -12], [4, -20], [-16, -18], [18, 14],
            ],
            slabColor: [0.35, 0.28, 0.22],
        },

        // Perimeter
        perimeter: { halfW: 88, halfD: 88 },
        gateDirection: 'south',
        gateHalfWidth: 8,
        wallColor: [0.25, 0.22, 0.18],
        pillarColor: [0.3, 0.25, 0.2],

        // Player
        playerStart: { x: 0, y: 2.2, z: 8 },
        playerLookAt: { x: 0, y: 2.2, z: 0 },

        // Spawn
        spawn: {
            arcAngle: Math.PI * 1.1,
            radiusMin: 38,
            radiusMax: 58,
            direction: -1, // negative Z = south
        },

        // GLB scene assets
        sceneAssets: {
            'factory_ruin':     { file: 'factory_ruin.glb', scale: 18.0, tint: { d: [0.45, 0.35, 0.28], e: [0.03, 0.01, 0.0] }, placements: [
                { x: -42, z: -40, ry: 0 },    { x: 40, z: -38, ry: 0.3 },
                { x: -5, z: -65, ry: 0 },     { x: 60, z: -55, ry: 0.8 },
                { x: -65, z: -60, ry: 0.5 },  { x: 55, z: -65, ry: -0.4 },
            ]},
            'warehouse_ruin':   { file: 'warehouse_ruin.glb', scale: 15.0, tint: { d: [0.38, 0.32, 0.25], e: [0.02, 0.01, 0.0] }, placements: [
                { x: -35, z: -15, ry: 0.1 },  { x: 35, z: -10, ry: -0.2 },
                { x: -55, z: -35, ry: 0.4 },  { x: 50, z: -20, ry: -0.5 },
                { x: -45, z: 10, ry: 0.7 },   { x: 48, z: 12, ry: -0.6 },
            ]},
            'factory_chimney':  { file: 'factory_chimney.glb', scale: 14.0, tint: { d: [0.35, 0.30, 0.25], e: [0.04, 0.02, 0.0] }, placements: [
                { x: -48, z: -45, ry: 0 },    { x: 45, z: -42, ry: 0 },
                { x: -60, z: -55, ry: 0.3 },  { x: 0, z: -70, ry: 0.1 },
            ]},
            'guard_tower':      { file: 'guard_tower.glb', scale: 12.0, tint: { d: [0.30, 0.28, 0.22], e: [0.02, 0.02, 0.01] }, placements: [
                { x: -28, z: 5, ry: 0.3 },    { x: 32, z: 8, ry: -0.2 },
                { x: -50, z: -10, ry: 0.6 },
            ]},
            'wall_segment':     { file: 'wall_segment.glb', scale: 7.0, tint: { d: [0.40, 0.35, 0.28], e: [0.02, 0.01, 0.0] }, placements: [
                { x: -18, z: -20, ry: 0 },     { x: 20, z: -18, ry: 0.1 },
                { x: -8, z: -35, ry: 0.15 },   { x: 10, z: -38, ry: -0.1 },
                { x: -30, z: -8, ry: 0.5 },    { x: 28, z: -5, ry: -0.3 },
                { x: -40, z: -30, ry: 0.8 },   { x: 38, z: -28, ry: -0.6 },
                { x: -12, z: 8, ry: 1.2 },     { x: 14, z: 10, ry: -0.8 },
            ]},
            'burned_car':       { file: 'burned_car.glb', scale: 5.5, tint: { d: [0.25, 0.20, 0.15], e: [0.05, 0.02, 0.0] }, placements: [
                { x: -10, z: -8, ry: 0.3 },    { x: 14, z: -12, ry: -0.5 },
                { x: 24, z: 15, ry: 0.6 },     { x: -28, z: -18, ry: 1.8 },
                { x: 30, z: -25, ry: -1.0 },   { x: -38, z: 5, ry: 2.1 },
                { x: 42, z: -8, ry: -0.3 },    { x: -5, z: -45, ry: 0.9 },
            ]},
            'burned_truck':     { file: 'burned_truck.glb', scale: 7.5, tint: { d: [0.28, 0.22, 0.15], e: [0.04, 0.02, 0.0] }, placements: [
                { x: -22, z: -28, ry: 1.2 },   { x: 18, z: -30, ry: 0.8 },
                { x: -40, z: -22, ry: 0.3 },   { x: 35, z: -40, ry: -0.5 },
                { x: -15, z: -50, ry: 1.0 },
            ]},
            'destroyed_apc':    { file: 'destroyed_apc.glb', scale: 8.0, tint: { d: [0.22, 0.22, 0.18], e: [0.02, 0.02, 0.01] }, placements: [
                { x: -15, z: -25, ry: 0.5 },   { x: 25, z: -35, ry: -0.7 },
                { x: -35, z: -45, ry: 0.9 },
            ]},
            'rubble_pile':      { file: 'rubble_pile.glb', scale: 5.0, tint: { d: [0.42, 0.36, 0.28], e: [0.01, 0.01, 0.0] }, placements: [
                { x: -12, z: -14, ry: 0 },     { x: 8, z: -18, ry: 0.5 },
                { x: -20, z: -28, ry: 1.0 },   { x: 22, z: -22, ry: 0.3 },
                { x: -5, z: -10, ry: 0.8 },    { x: 15, z: -5, ry: 1.5 },
                { x: -35, z: -32, ry: 0.2 },   { x: 10, z: -42, ry: 0.6 },
                { x: -25, z: 3, ry: 1.1 },     { x: 30, z: 5, ry: -0.4 },
                { x: -42, z: -15, ry: 0.7 },   { x: 40, z: -15, ry: -0.2 },
            ]},
            'rusted_beam':      { file: 'rusted_beam.glb', scale: 5.0, tint: { d: [0.50, 0.28, 0.12], e: [0.06, 0.02, 0.0] }, placements: [
                { x: -14, z: -22, ry: 0.7 },   { x: 16, z: -26, ry: -0.3 },
                { x: -25, z: -15, ry: 1.2 },   { x: 5, z: -28, ry: 0.4 },
                { x: -32, z: -5, ry: 2.0 },    { x: 20, z: 3, ry: -1.1 },
                { x: -8, z: -48, ry: 0.5 },    { x: 28, z: -45, ry: -0.8 },
            ]},
            'barricade':        { file: 'barricade.glb', scale: 4.0, tint: { d: [0.35, 0.30, 0.20], e: [0.02, 0.01, 0.0] }, placements: [
                { x: -6, z: -5, ry: 0 },       { x: 8, z: -3, ry: 0.2 },
                { x: -16, z: 2, ry: 0.6 },     { x: 18, z: 4, ry: -0.4 },
                { x: -22, z: -12, ry: 1.0 },   { x: 24, z: -10, ry: -0.7 },
                { x: -3, z: -22, ry: 0.3 },    { x: 5, z: -24, ry: -0.1 },
            ]},
        },

        // Cover blocks: [x, z, width, depth, height, rotation]
        coverBlocks: [
            [-12, -42, 4, 1.5, 2.5, 0.3], [12, -42, 4, 1.5, 2.5, -0.3], [0, -35, 2, 5, 2, 0],
            [-20, -25, 5, 2, 3, 0], [18, -22, 3, 3, 2.5, 0.5], [-8, -15, 3, 2, 2, -0.2],
            [10, -12, 4, 1.5, 3, 0.4], [-30, -10, 3, 3, 2.5, 0], [28, -8, 4, 2, 2.5, -0.3],
            [-15, 0, 5, 1.5, 2.5, 0.6], [15, 5, 3, 3, 2, 0], [-5, 10, 2, 4, 3, 0],
            [25, 15, 4, 2, 2.5, -0.4], [-25, 20, 3, 3, 2, 0.3],
            [0, 30, 6, 2, 3, 0], [-18, 35, 4, 2, 2.5, 0.5], [20, 38, 3, 3, 2, -0.2],
            [-35, 25, 3, 2, 2.5, 0], [35, 28, 3, 2, 2, 0.4],
            [-40, -30, 2, 5, 3, 0], [40, -25, 2, 4, 2.5, 0], [-42, 10, 3, 3, 2.5, 0], [42, 5, 3, 2, 2, 0],
        ],
        coverColors: { light: [0.32, 0.28, 0.22], dark: [0.2, 0.18, 0.15] },

        // Procedural props
        cratePositions: [
            [-8, 2], [12, 5], [-22, -5], [26, -8], [-15, -18],
            [18, -15], [-33, 0], [38, 2], [-5, -32], [8, -35],
            [-28, -25], [32, -20], [-45, -12], [44, -5], [0, -15],
            [-18, 8], [22, 12], [-38, -38], [36, -38], [5, -52],
        ],
        barrelPositions: [
            [-6, -2], [10, 0], [-20, -10], [24, -3], [-14, -30],
            [16, -28], [-30, -18], [34, -15], [-10, -42], [12, -45],
            [-35, 8], [40, 10], [-48, -20], [46, -18], [-25, -42],
            [28, -48], [-3, -8], [6, -20], [-40, -5], [42, -28],
        ],
        sandbagPositions: [
            [-4, 6, 0], [6, 7, 0.3], [-20, 2, 0.8], [22, 3, -0.5],
            [-12, -6, 1.0], [14, -4, -0.7], [-30, -2, 0.4], [32, 0, -0.3],
            [-8, -20, 0.5], [10, -22, -0.2], [0, -8, 0.9],
        ],
        fenceLines: [
            { sx: -25, sz: 12, ex: -10, ez: 12, count: 6 },
            { sx: 10, sz: 14, ex: 28, ez: 14, count: 7 },
            { sx: -35, sz: -2, ex: -35, ez: -18, count: 5 },
            { sx: 36, sz: 0, ex: 36, ez: -16, count: 5 },
        ],
        propColors: {
            crate: [0.35, 0.25, 0.15], crateDark: [0.22, 0.18, 0.12],
            barrel: [0.28, 0.22, 0.15], barrelRust: [0.45, 0.2, 0.08], barrelGreen: [0.12, 0.2, 0.1],
            sandbag: [0.45, 0.38, 0.25], pole: [0.25, 0.2, 0.15], wire: [0.3, 0.28, 0.25],
        },

        // Explosive barrels
        explosiveBarrelPositions: [
            [-12, -5], [15, -10], [-25, -20], [28, -15], [-8, -35],
            [20, -32], [-18, 5], [22, 8], [-32, -28], [35, -42],
            [5, -18], [-20, -45], [30, 2], [-40, -8],
        ],

        // Fire pits
        firePitPositions: [[-14, -10], [16, -8], [-8, -30], [22, 0]],

        // Vehicle fires (spawned after GLB placement)
        vehicleFirePositions: [
            { x: -10, z: -8 }, { x: 14, z: -12 }, { x: -22, z: -28 },
            { x: -38, z: 5 }, { x: 42, z: -8 }, { x: 35, z: -40 },
        ],

        // Smoke columns: [x, z, scale]
        smokeColumns: [
            [-42, -42, 1.0], [45, -40, 1.0], [-30, -55, 0.8],
            [30, -52, 0.8], [0, -60, 1.2], [-55, -50, 0.7],
            [55, -48, 0.7], [-20, -20, 0.5], [20, -18, 0.5],
            [-10, -35, 0.6], [12, -40, 0.6],
        ],

        // Background structures
        background: {
            rocketPositions: [
                { x: -75, z: -70, ry: 0.2 }, { x: 80, z: -75, ry: -0.3 },
                { x: -40, z: -85, ry: 0.1 }, { x: 50, z: -90, ry: -0.15 },
            ],
            basePositions: [
                { x: -60, z: 20, ry: 0.1 }, { x: 65, z: 18, ry: -0.2 },
                { x: 0, z: 25, ry: 0 }, { x: -30, z: 22, ry: 0.4 },
                { x: 35, z: 25, ry: -0.3 },
            ],
            radarPositions: [
                { x: -85, z: -30, ry: 0.3 }, { x: 90, z: -25, ry: -0.5 },
                { x: -50, z: 30, ry: 0.8 },
            ],
            commPositions: [
                { x: -70, z: 15 }, { x: 75, z: 10 }, { x: -90, z: -50 },
                { x: 95, z: -55 }, { x: 0, z: -95 },
            ],
        },
    },

    // ─────────────────────────────────────────────────────────────────
    // SCENE 2: MARS COLONY RUINS
    // ─────────────────────────────────────────────────────────────────
    mars: {
        id: 'mars',
        name: 'MARS COLONY RUINS',
        description: 'Abandoned colony on the red planet. Dust storms, low visibility.',
        previewGradient: 'linear-gradient(135deg, #3a1508 0%, #5a2010 50%, #1a0804 100%)',
        previewImage: ASSET_BASE + 'textures/skybox/mars_sky.png',

        sky: {
            type: 'equirectangular',
            textureUrl: 'skybox/mars_sky.png',
            clearColor: [0.35, 0.12, 0.05, 1],
            fogColor: [0.35, 0.12, 0.05],
            fogDensity: 0.012,
            hasLightning: false,
            // CREON — the orbital relay looming over the horizon.
            creon: {
                textureUrl: 'art/creon-machine-wars.png',
                tint: [1.0, 0.78, 0.62],
                opacity: 0.85,
                size: 213,
                distance: 300,
                elevation: 0.36,
                azimuth: 3.4,
                crop: { x: 0.134, y: 0.0, w: 0.417, h: 0.508 },
            },
        },

        lighting: {
            ambientIntensity: 0.40,
            ambientDiffuse: [0.6, 0.35, 0.25],
            ambientGround: [0.15, 0.06, 0.03],
            sunIntensity: 0.6,
            sunDiffuse: [0.7, 0.4, 0.25],
            sunSpecular: [0.08, 0.04, 0.02],
            sunDirection: [-0.2, -1, -0.4],
            glowIntensity: 0.25,
        },

        ground: {
            type: 'texture',
            textureUrl: 'ground/mars_ground.png',
            width: 320, height: 320, subdivisions: 90,
            displacementSeed: 101,
            displacementScale: 2.0,
            flatZoneRadius: 24,
            textureUScale: 10, textureVScale: 10,
            baseColor: 'rgb(128, 52, 26)',
            fallbackColor: [0.5, 0.2, 0.1],
            specular: [0.04, 0.03, 0.02],
            specularPower: 16,
            slabPositions: [
                [0, 0], [-10, 6], [14, -8], [-8, -12], [6, 14],
            ],
            slabColor: [0.5, 0.25, 0.12],
        },

        perimeter: { halfW: 80, halfD: 80 },
        gateDirection: 'south',
        gateHalfWidth: 10,
        wallColor: [0.4, 0.2, 0.12],
        pillarColor: [0.5, 0.25, 0.15],

        playerStart: { x: 0, y: 2.2, z: 10 },
        playerLookAt: { x: 0, y: 2.2, z: 0 },

        spawn: {
            arcAngle: Math.PI * 1.1,
            radiusMin: 34,
            radiusMax: 52,
            direction: -1,
        },

        // Reuse existing GLBs with Mars-appropriate tints
        sceneAssets: {
            'rubble_pile':    { file: 'rubble_pile.glb', scale: 6.0, tint: { d: [0.55, 0.28, 0.15], e: [0.04, 0.01, 0.0] }, placements: [
                { x: -12, z: -14, ry: 0 },   { x: 8, z: -18, ry: 0.5 },
                { x: -20, z: -28, ry: 1.0 },  { x: 22, z: -22, ry: 0.3 },
                { x: -5, z: -10, ry: 0.8 },   { x: 15, z: -5, ry: 1.5 },
                { x: -30, z: -32, ry: 0.2 },  { x: 10, z: -38, ry: 0.6 },
                { x: -22, z: 3, ry: 1.1 },    { x: 28, z: 5, ry: -0.4 },
                { x: -38, z: -15, ry: 0.7 },  { x: 36, z: -15, ry: -0.2 },
                { x: 0, z: -45, ry: 0.9 },    { x: -15, z: -40, ry: 0.3 },
            ]},
            'barricade':      { file: 'barricade.glb', scale: 4.5, tint: { d: [0.45, 0.25, 0.12], e: [0.03, 0.01, 0.0] }, placements: [
                { x: -6, z: -5, ry: 0 },     { x: 8, z: -3, ry: 0.2 },
                { x: -14, z: 2, ry: 0.6 },   { x: 16, z: 4, ry: -0.4 },
                { x: -20, z: -12, ry: 1.0 }, { x: 22, z: -10, ry: -0.7 },
            ]},
            'wall_segment':   { file: 'wall_segment.glb', scale: 6.0, tint: { d: [0.45, 0.22, 0.10], e: [0.03, 0.01, 0.0] }, placements: [
                { x: -16, z: -18, ry: 0 },    { x: 18, z: -16, ry: 0.1 },
                { x: -28, z: -6, ry: 0.5 },   { x: 26, z: -4, ry: -0.3 },
                { x: -8, z: -32, ry: 0.15 },  { x: 10, z: -34, ry: -0.1 },
            ]},
            'burned_car':     { file: 'burned_car.glb', scale: 5.0, tint: { d: [0.35, 0.18, 0.08], e: [0.04, 0.02, 0.0] }, placements: [
                { x: -10, z: -8, ry: 0.3 },  { x: 14, z: -12, ry: -0.5 },
                { x: -28, z: -18, ry: 1.8 }, { x: 30, z: -25, ry: -1.0 },
            ]},
            'destroyed_apc':  { file: 'destroyed_apc.glb', scale: 7.0, tint: { d: [0.35, 0.18, 0.10], e: [0.03, 0.02, 0.0] }, placements: [
                { x: -15, z: -25, ry: 0.5 }, { x: 25, z: -30, ry: -0.7 },
            ]},
        },

        coverBlocks: [
            [-10, -38, 4, 1.5, 2.5, 0.3], [10, -38, 4, 1.5, 2.5, -0.3], [0, -30, 2, 5, 2, 0],
            [-18, -22, 5, 2, 3, 0], [16, -20, 3, 3, 2.5, 0.5],
            [-8, -12, 3, 2, 2, -0.2], [10, -10, 4, 1.5, 3, 0.4],
            [-26, -8, 3, 3, 2.5, 0], [24, -6, 4, 2, 2.5, -0.3],
            [-12, 2, 5, 1.5, 2.5, 0.6], [14, 5, 3, 3, 2, 0],
            [-5, 12, 2, 4, 3, 0], [22, 14, 4, 2, 2.5, -0.4],
            [0, 25, 6, 2, 3, 0], [-16, 30, 4, 2, 2.5, 0.5],
            [18, 32, 3, 3, 2, -0.2],
            [-36, -26, 2, 5, 3, 0], [36, -22, 2, 4, 2.5, 0],
        ],
        coverColors: { light: [0.45, 0.25, 0.15], dark: [0.3, 0.15, 0.08] },

        cratePositions: [
            [-8, 2], [12, 5], [-20, -5], [24, -8], [-14, -16],
            [16, -14], [-30, 0], [34, 2], [-5, -28], [8, -32],
        ],
        barrelPositions: [
            [-6, -2], [10, 0], [-18, -10], [22, -3], [-12, -28],
            [14, -26], [-28, -16], [30, -14], [-8, -38], [10, -40],
        ],
        sandbagPositions: [
            [-4, 6, 0], [6, 7, 0.3], [-18, 2, 0.8], [20, 3, -0.5],
            [-10, -6, 1.0], [12, -4, -0.7],
        ],
        fenceLines: [],
        propColors: {
            crate: [0.45, 0.25, 0.12], crateDark: [0.32, 0.18, 0.08],
            barrel: [0.38, 0.20, 0.10], barrelRust: [0.55, 0.25, 0.08], barrelGreen: [0.2, 0.22, 0.1],
            sandbag: [0.5, 0.30, 0.18], pole: [0.35, 0.2, 0.1], wire: [0.4, 0.22, 0.12],
        },

        explosiveBarrelPositions: [
            [-10, -5], [14, -8], [-22, -18], [26, -14], [-8, -32],
            [18, -28], [-16, 5], [20, 8], [-28, -24], [32, -38],
        ],

        firePitPositions: [],  // no fire on Mars — no oxygen
        vehicleFirePositions: [],
        smokeColumns: [],  // replaced by dust devils

        // Mars-specific: dust devil particle config
        dustDevils: [
            { x: -20, z: -20, scale: 1.0 }, { x: 25, z: -30, scale: 0.8 },
            { x: -10, z: 10, scale: 1.2 }, { x: 30, z: 5, scale: 0.6 },
            { x: 0, z: -40, scale: 0.9 },
        ],

        background: {
            // Mars colony domes (procedural half-spheres)
            domePositions: [
                { x: -60, z: -50, r: 12, damage: 0.6 },
                { x: 55, z: -60, r: 15, damage: 0.4 },
                { x: -40, z: 25, r: 10, damage: 0.8 },
                { x: 50, z: 20, r: 8, damage: 0.5 },
                { x: 0, z: -75, r: 18, damage: 0.3 },
            ],
            // Comm towers still present
            commPositions: [
                { x: -65, z: 10 }, { x: 70, z: 8 }, { x: 0, z: -85 },
            ],
            rocketPositions: [],
            basePositions: [],
            radarPositions: [
                { x: -70, z: -25, ry: 0.3 }, { x: 75, z: -20, ry: -0.5 },
            ],
        },
    },

    // ─────────────────────────────────────────────────────────────────
    // SCENE 3: ALIEN CRASH SITE
    // ─────────────────────────────────────────────────────────────────
    alien: {
        id: 'alien',
        name: 'ALIEN CRASH SITE',
        description: 'Otherworldly terrain. Bioluminescent debris, eerie atmosphere.',
        previewGradient: 'linear-gradient(135deg, #0a1a12 0%, #102820 50%, #051510 100%)',
        previewImage: ASSET_BASE + 'textures/skybox/alien_sky.png',

        sky: {
            type: 'equirectangular',
            textureUrl: 'skybox/alien_sky.png',
            clearColor: [0.05, 0.10, 0.08, 1],
            fogColor: [0.05, 0.10, 0.08],
            fogDensity: 0.010,
            hasLightning: false,
            // CREON — the orbital relay looming over the horizon.
            creon: {
                textureUrl: 'art/creon-machine-wars.png',
                tint: [0.7, 1.0, 0.85],
                opacity: 0.85,
                size: 206,
                distance: 300,
                elevation: 0.44,
                azimuth: 3,
                crop: { x: 0.134, y: 0.0, w: 0.417, h: 0.508 },
            },
        },

        lighting: {
            ambientIntensity: 0.30,
            ambientDiffuse: [0.2, 0.45, 0.35],
            ambientGround: [0.05, 0.12, 0.08],
            sunIntensity: 0.4,
            sunDiffuse: [0.3, 0.5, 0.4],
            sunSpecular: [0.05, 0.1, 0.08],
            sunDirection: [-0.2, -1, -0.3],
            glowIntensity: 0.6, // high glow for bioluminescent elements
        },

        ground: {
            type: 'texture',
            textureUrl: 'ground/alien_ground.png',
            width: 320, height: 320, subdivisions: 90,
            displacementSeed: 202,
            displacementScale: 1.8,
            flatZoneRadius: 24,
            textureUScale: 8, textureVScale: 8,
            baseColor: 'rgb(20, 35, 28)',
            fallbackColor: [0.08, 0.14, 0.10],
            specular: [0.08, 0.12, 0.10],
            specularPower: 32,
            slabPositions: [
                [0, 0], [-8, 6], [10, -6], [-4, -10], [6, 10],
            ],
            slabColor: [0.06, 0.15, 0.10],
        },

        perimeter: { halfW: 80, halfD: 80 },
        gateDirection: 'south',
        gateHalfWidth: 10,
        wallColor: [0.10, 0.18, 0.14],
        pillarColor: [0.08, 0.22, 0.15],

        playerStart: { x: 0, y: 2.2, z: 10 },
        playerLookAt: { x: 0, y: 2.2, z: 0 },

        spawn: {
            arcAngle: Math.PI * 1.2,
            radiusMin: 34,
            radiusMax: 52,
            direction: -1,
        },

        sceneAssets: {
            'rubble_pile':    { file: 'rubble_pile.glb', scale: 5.5, tint: { d: [0.12, 0.22, 0.16], e: [0.0, 0.08, 0.04] }, placements: [
                { x: -12, z: -14, ry: 0 },   { x: 8, z: -18, ry: 0.5 },
                { x: -18, z: -26, ry: 1.0 },  { x: 20, z: -20, ry: 0.3 },
                { x: -5, z: -10, ry: 0.8 },   { x: 13, z: -5, ry: 1.5 },
                { x: -28, z: -30, ry: 0.2 },  { x: 10, z: -36, ry: 0.6 },
                { x: -20, z: 3, ry: 1.1 },    { x: 26, z: 5, ry: -0.4 },
            ]},
            'rusted_beam':    { file: 'rusted_beam.glb', scale: 5.0, tint: { d: [0.10, 0.20, 0.15], e: [0.0, 0.06, 0.03] }, placements: [
                { x: -14, z: -20, ry: 0.7 },  { x: 16, z: -24, ry: -0.3 },
                { x: -24, z: -14, ry: 1.2 },  { x: 5, z: -26, ry: 0.4 },
                { x: -30, z: -5, ry: 2.0 },   { x: 18, z: 3, ry: -1.1 },
            ]},
            'barricade':      { file: 'barricade.glb', scale: 4.0, tint: { d: [0.08, 0.18, 0.12], e: [0.0, 0.05, 0.02] }, placements: [
                { x: -6, z: -5, ry: 0 },     { x: 8, z: -3, ry: 0.2 },
                { x: -14, z: 2, ry: 0.6 },   { x: 16, z: 4, ry: -0.4 },
            ]},
        },

        coverBlocks: [
            [-10, -36, 4, 1.5, 2.5, 0.3], [10, -36, 4, 1.5, 2.5, -0.3], [0, -28, 2, 5, 2, 0],
            [-16, -20, 5, 2, 3, 0], [14, -18, 3, 3, 2.5, 0.5],
            [-8, -10, 3, 2, 2, -0.2], [10, -8, 4, 1.5, 3, 0.4],
            [-24, -6, 3, 3, 2.5, 0], [22, -4, 4, 2, 2.5, -0.3],
            [-12, 4, 5, 1.5, 2.5, 0.6], [14, 6, 3, 3, 2, 0],
            [0, 22, 6, 2, 3, 0], [-14, 28, 4, 2, 2.5, 0.5],
            [16, 30, 3, 3, 2, -0.2],
            [-34, -24, 2, 5, 3, 0], [34, -20, 2, 4, 2.5, 0],
        ],
        coverColors: { light: [0.10, 0.20, 0.14], dark: [0.06, 0.14, 0.10] },

        cratePositions: [
            [-8, 2], [12, 5], [-18, -5], [22, -8], [-12, -16],
            [14, -14], [-28, 0], [32, 2],
        ],
        barrelPositions: [
            [-6, -2], [10, 0], [-16, -10], [20, -3], [-10, -26],
            [12, -24], [-24, -14], [28, -12],
        ],
        sandbagPositions: [],
        fenceLines: [],
        propColors: {
            crate: [0.12, 0.20, 0.15], crateDark: [0.06, 0.14, 0.10],
            barrel: [0.10, 0.18, 0.13], barrelRust: [0.15, 0.25, 0.12], barrelGreen: [0.05, 0.20, 0.08],
            sandbag: [0.15, 0.22, 0.16], pole: [0.08, 0.16, 0.12], wire: [0.10, 0.18, 0.14],
        },

        explosiveBarrelPositions: [
            [-10, -5], [14, -8], [-20, -16], [24, -12],
            [-8, -30], [18, -26], [-14, 5], [18, 8],
        ],

        firePitPositions: [],  // replaced by bioluminescent pools
        vehicleFirePositions: [],
        smokeColumns: [],

        // Alien-specific: bioluminescent spore particles
        bioSpores: [
            { x: -15, z: -15, scale: 1.0 }, { x: 20, z: -25, scale: 0.8 },
            { x: -8, z: 8, scale: 1.2 }, { x: 25, z: 3, scale: 0.7 },
            { x: 0, z: -35, scale: 0.9 }, { x: -25, z: -5, scale: 0.6 },
            { x: 12, z: 12, scale: 1.1 }, { x: -30, z: -28, scale: 0.8 },
        ],

        // Glowing pools on ground
        glowPools: [
            { x: -12, z: -10, r: 3 }, { x: 18, z: -20, r: 2.5 },
            { x: -5, z: 5, r: 4 }, { x: 22, z: 10, r: 2 },
            { x: 0, z: -30, r: 3.5 }, { x: -20, z: -22, r: 2 },
        ],

        background: {
            // Crashed alien ship hull segments
            hullSegments: [
                { x: -50, z: -50, ry: 0.4, scale: 1.2 },
                { x: 45, z: -55, ry: -0.3, scale: 1.5 },
                { x: 0, z: -70, ry: 0.1, scale: 2.0 },
                { x: -60, z: 15, ry: 0.8, scale: 0.8 },
            ],
            // Glowing crystal spires
            crystalPositions: [
                { x: -70, z: -30 }, { x: 65, z: -35 },
                { x: -55, z: 20 }, { x: 60, z: 15 },
                { x: -35, z: -60 }, { x: 40, z: -65 },
                { x: 0, z: -80 },
            ],
            rocketPositions: [],
            basePositions: [],
            radarPositions: [],
            commPositions: [],
            domePositions: [],
        },
    },

    // ─────────────────────────────────────────────────────────────────
    // SCENE 4: DESERT OUTPOST
    // ─────────────────────────────────────────────────────────────────
    desert: {
        id: 'desert',
        name: 'DESERT OUTPOST',
        description: 'Harsh sun, sand terrain, makeshift military camp.',
        previewGradient: 'linear-gradient(135deg, #3a3018 0%, #5a4820 50%, #2a2010 100%)',
        previewImage: ASSET_BASE + 'textures/skybox/desert_sky.png',

        sky: {
            type: 'equirectangular',
            textureUrl: 'skybox/desert_sky.png',
            clearColor: [0.45, 0.38, 0.28, 1],
            fogColor: [0.45, 0.38, 0.28],
            fogDensity: 0.004, // low fog = long sightlines
            hasLightning: false,
            // CREON — the orbital relay looming over the horizon.
            creon: {
                textureUrl: 'art/creon-machine-wars.png',
                tint: [1.0, 0.92, 0.78],
                opacity: 0.78,
                size: 213,
                distance: 300,
                elevation: 0.3,
                azimuth: 2.9,
                gain: 0.75,
                gamma: 1,
                crop: { x: 0.134, y: 0.0, w: 0.417, h: 0.508 },
            },
        },

        lighting: {
            ambientIntensity: 0.50,
            ambientDiffuse: [0.65, 0.55, 0.40],
            ambientGround: [0.20, 0.15, 0.08],
            sunIntensity: 1.0,
            sunDiffuse: [0.9, 0.8, 0.6],
            sunSpecular: [0.15, 0.12, 0.08],
            sunDirection: [-0.2, -1, -0.3],
            glowIntensity: 0.2,
        },

        ground: {
            type: 'texture',
            textureUrl: 'ground/desert_ground.png',
            width: 320, height: 320, subdivisions: 90,
            displacementSeed: 303,
            displacementScale: 0.8, // flatter terrain
            flatZoneRadius: 28,
            textureUScale: 10, textureVScale: 10,
            baseColor: 'rgb(160, 130, 80)',
            fallbackColor: [0.6, 0.5, 0.3],
            specular: [0.08, 0.06, 0.04],
            specularPower: 16,
            slabPositions: [],
            slabColor: [0.5, 0.42, 0.28],
        },

        perimeter: { halfW: 88, halfD: 88 },
        gateDirection: 'south',
        gateHalfWidth: 10,
        wallColor: [0.5, 0.42, 0.28],
        pillarColor: [0.55, 0.45, 0.30],

        playerStart: { x: 0, y: 2.2, z: 10 },
        playerLookAt: { x: 0, y: 2.2, z: 0 },

        spawn: {
            arcAngle: Math.PI * 1.2,
            radiusMin: 42,
            radiusMax: 62, // longer sightlines = further spawns
            direction: -1,
        },

        sceneAssets: {
            'barricade':      { file: 'barricade.glb', scale: 4.5, tint: { d: [0.55, 0.45, 0.28], e: [0.03, 0.02, 0.0] }, placements: [
                { x: -6, z: -5, ry: 0 },     { x: 8, z: -3, ry: 0.2 },
                { x: -16, z: 2, ry: 0.6 },   { x: 18, z: 4, ry: -0.4 },
                { x: -22, z: -12, ry: 1.0 }, { x: 24, z: -10, ry: -0.7 },
                { x: -3, z: -22, ry: 0.3 },  { x: 5, z: -24, ry: -0.1 },
                { x: -30, z: -20, ry: 0.5 }, { x: 32, z: -18, ry: -0.3 },
            ]},
            'burned_car':     { file: 'burned_car.glb', scale: 5.5, tint: { d: [0.45, 0.35, 0.22], e: [0.04, 0.03, 0.0] }, placements: [
                { x: -10, z: -8, ry: 0.3 },  { x: 14, z: -12, ry: -0.5 },
                { x: 24, z: 15, ry: 0.6 },   { x: -28, z: -18, ry: 1.8 },
                { x: 30, z: -25, ry: -1.0 }, { x: -38, z: 5, ry: 2.1 },
            ]},
            'burned_truck':   { file: 'burned_truck.glb', scale: 7.5, tint: { d: [0.42, 0.32, 0.18], e: [0.03, 0.02, 0.0] }, placements: [
                { x: -20, z: -26, ry: 1.2 }, { x: 16, z: -28, ry: 0.8 },
                { x: -38, z: -20, ry: 0.3 }, { x: 33, z: -38, ry: -0.5 },
            ]},
            'destroyed_apc':  { file: 'destroyed_apc.glb', scale: 8.0, tint: { d: [0.40, 0.32, 0.20], e: [0.03, 0.02, 0.01] }, placements: [
                { x: -15, z: -25, ry: 0.5 }, { x: 25, z: -35, ry: -0.7 },
                { x: -35, z: -42, ry: 0.9 },
            ]},
            'rubble_pile':    { file: 'rubble_pile.glb', scale: 5.0, tint: { d: [0.50, 0.42, 0.28], e: [0.02, 0.01, 0.0] }, placements: [
                { x: -12, z: -14, ry: 0 },   { x: 8, z: -18, ry: 0.5 },
                { x: -20, z: -28, ry: 1.0 },  { x: 22, z: -22, ry: 0.3 },
                { x: -5, z: -10, ry: 0.8 },   { x: 15, z: -5, ry: 1.5 },
                { x: -32, z: -30, ry: 0.2 },  { x: 10, z: -40, ry: 0.6 },
            ]},
            'wall_segment':   { file: 'wall_segment.glb', scale: 7.0, tint: { d: [0.50, 0.40, 0.25], e: [0.02, 0.01, 0.0] }, placements: [
                { x: -18, z: -20, ry: 0 },   { x: 20, z: -18, ry: 0.1 },
                { x: -8, z: -35, ry: 0.15 }, { x: 10, z: -38, ry: -0.1 },
                { x: -30, z: -8, ry: 0.5 },  { x: 28, z: -5, ry: -0.3 },
            ]},
            'guard_tower':    { file: 'guard_tower.glb', scale: 12.0, tint: { d: [0.45, 0.35, 0.22], e: [0.02, 0.02, 0.01] }, placements: [
                { x: -28, z: 5, ry: 0.3 },  { x: 32, z: 8, ry: -0.2 },
                { x: -45, z: -10, ry: 0.6 }, { x: 44, z: -12, ry: -0.4 },
            ]},
        },

        coverBlocks: [
            [-12, -42, 4, 1.5, 2.5, 0.3], [12, -42, 4, 1.5, 2.5, -0.3], [0, -35, 2, 5, 2, 0],
            [-20, -25, 5, 2, 3, 0], [18, -22, 3, 3, 2.5, 0.5],
            [-8, -15, 3, 2, 2, -0.2], [10, -12, 4, 1.5, 3, 0.4],
            [-30, -10, 3, 3, 2.5, 0], [28, -8, 4, 2, 2.5, -0.3],
            [-15, 0, 5, 1.5, 2.5, 0.6], [15, 5, 3, 3, 2, 0],
            [-5, 10, 2, 4, 3, 0], [25, 15, 4, 2, 2.5, -0.4], [-25, 20, 3, 3, 2, 0.3],
            [0, 30, 6, 2, 3, 0], [-18, 35, 4, 2, 2.5, 0.5], [20, 38, 3, 3, 2, -0.2],
            [-35, 25, 3, 2, 2.5, 0], [35, 28, 3, 2, 2, 0.4],
            [-40, -30, 2, 5, 3, 0], [40, -25, 2, 4, 2.5, 0],
            [-42, 10, 3, 3, 2.5, 0], [42, 5, 3, 2, 2, 0],
            // Extra cover for long sightlines
            [-10, -50, 4, 2, 2.5, 0], [10, -48, 3, 3, 2, 0.3],
        ],
        coverColors: { light: [0.50, 0.42, 0.28], dark: [0.35, 0.28, 0.18] },

        cratePositions: [
            [-8, 2], [12, 5], [-22, -5], [26, -8], [-15, -18],
            [18, -15], [-33, 0], [38, 2], [-5, -32], [8, -35],
            [-28, -25], [32, -20], [-45, -12], [44, -5],
        ],
        barrelPositions: [
            [-6, -2], [10, 0], [-20, -10], [24, -3], [-14, -30],
            [16, -28], [-30, -18], [34, -15], [-10, -42], [12, -45],
            [-35, 8], [40, 10],
        ],
        sandbagPositions: [
            [-4, 6, 0], [6, 7, 0.3], [-20, 2, 0.8], [22, 3, -0.5],
            [-12, -6, 1.0], [14, -4, -0.7], [-30, -2, 0.4], [32, 0, -0.3],
            [-8, -20, 0.5], [10, -22, -0.2], [0, -8, 0.9],
            // Extra sandbag walls for desert outpost feel
            [-16, 12, 0.2], [18, 14, -0.1], [-24, -14, 0.7], [26, -12, -0.5],
        ],
        fenceLines: [
            { sx: -25, sz: 12, ex: -10, ez: 12, count: 6 },
            { sx: 10, sz: 14, ex: 28, ez: 14, count: 7 },
        ],
        propColors: {
            crate: [0.50, 0.40, 0.25], crateDark: [0.35, 0.28, 0.18],
            barrel: [0.42, 0.32, 0.20], barrelRust: [0.55, 0.35, 0.15], barrelGreen: [0.25, 0.30, 0.15],
            sandbag: [0.55, 0.45, 0.30], pole: [0.40, 0.32, 0.20], wire: [0.38, 0.30, 0.22],
        },

        explosiveBarrelPositions: [
            [-12, -5], [15, -10], [-25, -20], [28, -15], [-8, -35],
            [20, -32], [-18, 5], [22, 8], [-32, -28], [35, -42],
            [5, -18], [-20, -45],
        ],

        firePitPositions: [[-14, -10], [16, -8], [-8, -30], [22, 0]],
        vehicleFirePositions: [
            { x: -10, z: -8 }, { x: 14, z: -12 },
            { x: -28, z: -18 }, { x: 30, z: -25 },
        ],
        smokeColumns: [
            [-40, -40, 0.6], [42, -38, 0.6], [-25, -50, 0.5],
            [28, -48, 0.5], [0, -55, 0.7],
        ],

        // Desert-specific: sand particles blowing horizontally
        sandParticles: {
            enabled: true,
            color: [0.6, 0.5, 0.3],
            windDirection: [1.5, 0.1, 0.3],
        },

        background: {
            // Sand dunes at edges
            dunePositions: [
                { x: -70, z: -60, scale: 1.5 }, { x: 75, z: -55, scale: 1.2 },
                { x: -60, z: 25, scale: 1.0 }, { x: 65, z: 20, scale: 0.8 },
                { x: 0, z: -80, scale: 1.8 }, { x: -80, z: -20, scale: 1.0 },
                { x: 85, z: -15, scale: 1.3 },
            ],
            commPositions: [
                { x: -65, z: 12 }, { x: 70, z: 8 }, { x: 0, z: -85 },
            ],
            basePositions: [
                { x: -55, z: 18, ry: 0.1 }, { x: 60, z: 16, ry: -0.2 },
                { x: 0, z: 22, ry: 0 },
            ],
            rocketPositions: [],
            radarPositions: [
                { x: -75, z: -28, ry: 0.3 }, { x: 80, z: -22, ry: -0.5 },
            ],
            domePositions: [],
        },
    },
    // ─────────────────────────────────────────────────────────────────
    // SCENE 5: URBAN RUINS
    // ─────────────────────────────────────────────────────────────────
    urban: {
        id: 'urban',
        name: 'URBAN RUINS',
        description: 'Collapsed city blocks. Robot assault on devastated streets.',
        previewGradient: 'linear-gradient(135deg, #1a1a1a 0%, #2a2218 50%, #0e0e0e 100%)',
        previewImage: ASSET_BASE + 'textures/skybox/urban_sky.png',

        sky: {
            type: 'equirectangular',
            textureUrl: 'skybox/urban_sky.png',
            clearColor: [0.14, 0.13, 0.12, 1],
            fogColor: [0.14, 0.13, 0.12],
            fogDensity: 0.009,
            hasLightning: true,
            // CREON — the orbital relay looming over the horizon.
            creon: {
                textureUrl: 'art/creon-machine-wars.png',
                tint: [0.95, 0.85, 0.8],
                opacity: 0.86,
                size: 213,
                distance: 300,
                elevation: 0.38,
                azimuth: 3.3,
                crop: { x: 0.134, y: 0.0, w: 0.417, h: 0.508 },
            },
        },

        lighting: {
            ambientIntensity: 0.30,
            ambientDiffuse: [0.45, 0.42, 0.38],
            ambientGround: [0.10, 0.09, 0.08],
            sunIntensity: 0.5,
            sunDiffuse: [0.55, 0.50, 0.44],
            sunSpecular: [0.08, 0.07, 0.06],
            sunDirection: [-0.4, -1, -0.3],
            glowIntensity: 0.35,
        },

        ground: {
            type: 'texture',
            textureUrl: 'ground/urban_ground.png',
            width: 320, height: 320, subdivisions: 110,
            displacementSeed: 55,
            displacementScale: 1.2,
            flatZoneRadius: 26,
            textureUScale: 10, textureVScale: 10,
            baseColor: 'rgb(60, 55, 48)',
            fallbackColor: [0.24, 0.22, 0.19],
            specular: [0.08, 0.07, 0.06],
            specularPower: 28,
            slabPositions: [
                [0, 0], [-14, 8], [16, -6], [-8, -15], [10, 18],
                [-22, 5], [24, -14], [6, -22], [-18, -20], [20, 16],
            ],
            slabColor: [0.30, 0.27, 0.22],
        },

        perimeter: { halfW: 88, halfD: 88 },
        gateDirection: 'south',
        gateHalfWidth: 9,
        wallColor: [0.22, 0.20, 0.17],
        pillarColor: [0.28, 0.24, 0.20],

        playerStart: { x: 0, y: 2.2, z: 8 },
        playerLookAt: { x: 0, y: 2.2, z: 0 },

        spawn: {
            arcAngle: Math.PI * 1.2,
            radiusMin: 36,
            radiusMax: 56,
            direction: -1,
        },

        sceneAssets: {
            'factory_ruin':   { file: 'factory_ruin.glb', scale: 16.0, tint: { d: [0.35, 0.30, 0.25], e: [0.04, 0.02, 0.0] }, placements: [
                { x: -40, z: -38, ry: 0 },   { x: 42, z: -36, ry: 0.2 },
                { x: -8, z: -62, ry: 0 },    { x: 58, z: -52, ry: 0.6 },
                { x: -62, z: -58, ry: 0.4 },
            ]},
            'warehouse_ruin': { file: 'warehouse_ruin.glb', scale: 14.0, tint: { d: [0.32, 0.28, 0.22], e: [0.03, 0.01, 0.0] }, placements: [
                { x: -32, z: -14, ry: 0.1 }, { x: 34, z: -12, ry: -0.2 },
                { x: -55, z: -32, ry: 0.8 }, { x: 52, z: -28, ry: -0.6 },
            ]},
            'rubble_pile':    { file: 'rubble_pile.glb', scale: 5.5, tint: { d: [0.30, 0.26, 0.20], e: [0.02, 0.01, 0.0] }, placements: [
                { x: -10, z: -12, ry: 0 },   { x: 10, z: -16, ry: 0.5 },
                { x: -22, z: -26, ry: 1.0 }, { x: 24, z: -20, ry: 0.3 },
                { x: -5, z: -8, ry: 0.8 },   { x: 18, z: -5, ry: 1.5 },
                { x: -32, z: -30, ry: 0.2 }, { x: 12, z: -36, ry: 0.6 },
            ]},
            'burned_car':     { file: 'burned_car.glb', scale: 5.0, tint: { d: [0.28, 0.24, 0.18], e: [0.05, 0.02, 0.0] }, placements: [
                { x: -8, z: -6, ry: 0.4 },  { x: 12, z: -10, ry: -0.6 },
                { x: -26, z: -16, ry: 1.9 },{ x: 28, z: -22, ry: -1.2 },
                { x: -18, z: 5, ry: 0.8 },  { x: 20, z: 8, ry: -0.3 },
            ]},
            'burned_truck':   { file: 'burned_truck.glb', scale: 6.0, tint: { d: [0.28, 0.22, 0.16], e: [0.04, 0.02, 0.0] }, placements: [
                { x: -12, z: -22, ry: 0.5 },{ x: 22, z: -28, ry: -0.8 },
                { x: 0, z: -42, ry: 0.2 },
            ]},
            'destroyed_apc':  { file: 'destroyed_apc.glb', scale: 7.0, tint: { d: [0.30, 0.26, 0.20], e: [0.03, 0.02, 0.0] }, placements: [
                { x: -16, z: -28, ry: 0.5 },{ x: 26, z: -32, ry: -0.7 },
                { x: 5, z: -18, ry: 0.1 },
            ]},
            'barricade':      { file: 'barricade.glb', scale: 4.5, tint: { d: [0.32, 0.28, 0.22], e: [0.02, 0.01, 0.0] }, placements: [
                { x: -6, z: -4, ry: 0 },    { x: 8, z: -2, ry: 0.2 },
                { x: -14, z: 3, ry: 0.6 },  { x: 16, z: 5, ry: -0.4 },
                { x: -22, z: -10, ry: 1.0 },{ x: 24, z: -8, ry: -0.7 },
            ]},
        },

        coverBlocks: [
            [-10, -36, 4, 1.5, 2.5, 0.2], [10, -36, 4, 1.5, 2.5, -0.2], [0, -28, 2, 5, 2, 0],
            [-18, -20, 5, 2, 3, 0], [16, -18, 3, 3, 2.5, 0.4],
            [-8, -10, 3, 2, 2, -0.2], [10, -8, 4, 1.5, 3, 0.4],
            [-26, -6, 3, 3, 2.5, 0], [24, -4, 4, 2, 2.5, -0.3],
            [-12, 4, 5, 1.5, 2.5, 0.5], [14, 6, 3, 3, 2, 0],
            [-5, 14, 2, 4, 3, 0], [22, 16, 4, 2, 2.5, -0.4],
            [0, 26, 6, 2, 3, 0], [-16, 32, 4, 2, 2.5, 0.5],
            [18, 34, 3, 3, 2, -0.2],
        ],
        coverColors: { light: [0.35, 0.30, 0.24], dark: [0.22, 0.18, 0.14] },

        cratePositions: [
            [-8, 2], [12, 5], [-20, -4], [24, -6], [-14, -14],
            [16, -12], [-30, 2], [34, 4], [-5, -26], [8, -30],
        ],
        barrelPositions: [
            [-6, -2], [10, 2], [-18, -8], [22, -2], [-12, -26],
            [14, -24], [-28, -14], [30, -12], [-8, -36], [10, -38],
        ],
        sandbagPositions: [
            [-4, 6, 0], [6, 8, 0.3], [-18, 3, 0.8], [20, 4, -0.5],
            [-10, -5, 1.0], [12, -3, -0.7], [-24, 10, 0.4], [26, 12, -0.3],
        ],
        fenceLines: [
            { start: [-15, -45], end: [15, -45] },
            { start: [-35, -20], end: [-35, 10] },
            { start: [35, -18], end: [35, 12] },
        ],
        propColors: {
            crate: [0.32, 0.28, 0.22], crateDark: [0.22, 0.18, 0.14],
            barrel: [0.28, 0.24, 0.18], barrelRust: [0.40, 0.22, 0.10], barrelGreen: [0.18, 0.22, 0.14],
            sandbag: [0.38, 0.32, 0.24], pole: [0.28, 0.24, 0.18], wire: [0.30, 0.24, 0.16],
        },

        explosiveBarrelPositions: [
            [-10, -4], [14, -6], [-22, -16], [26, -12], [-8, -30],
            [18, -26], [-16, 6], [20, 10], [-28, -22], [32, -36],
            [-40, -10], [38, -8], [5, -50], [-5, 18],
        ],

        firePitPositions: [
            { x: -18, z: -18 }, { x: 20, z: -22 }, { x: 0, z: -35 },
            { x: -32, z: -5 }, { x: 30, z: -8 },
        ],
        vehicleFirePositions: [
            { x: -8, z: -6 }, { x: 12, z: -10 }, { x: -26, z: -16 },
        ],
        smokeColumns: [
            { x: -30, z: -30 }, { x: 28, z: -35 }, { x: -5, z: -55 },
            { x: 42, z: -45 }, { x: -48, z: -20 },
        ],

        background: {
            rocketPositions: [],
            radarPositions: [
                { x: -72, z: -28, ry: 0.3 }, { x: 75, z: -24, ry: -0.5 },
            ],
            commPositions: [
                { x: -62, z: 14 }, { x: 65, z: 10 }, { x: 0, z: -88 },
            ],
            basePositions: [
                { x: -52, z: 20, ry: 0.1 }, { x: 55, z: 18, ry: -0.2 },
            ],
            domePositions: [],
        },
    },

    // ─────────────────────────────────────────────────────────────────
    // SCENE 6: JUNGLE OUTPOST
    // ─────────────────────────────────────────────────────────────────
    jungle: {
        id: 'jungle',
        name: 'JUNGLE OUTPOST',
        description: 'Overgrown military base. Dense fog, ambush terrain.',
        previewGradient: 'linear-gradient(135deg, #0a1a08 0%, #142810 50%, #061206 100%)',
        previewImage: ASSET_BASE + 'textures/skybox/jungle_sky.png',

        sky: {
            type: 'equirectangular',
            textureUrl: 'skybox/jungle_sky.png',
            clearColor: [0.08, 0.12, 0.07, 1],
            fogColor: [0.08, 0.12, 0.07],
            fogDensity: 0.014,
            hasLightning: true,
            // CREON — the orbital relay looming over the horizon.
            creon: {
                textureUrl: 'art/creon-machine-wars.png',
                tint: [0.72, 0.9, 0.72],
                opacity: 0.82,
                size: 199,
                distance: 300,
                elevation: 0.4,
                azimuth: 3.15,
                crop: { x: 0.134, y: 0.0, w: 0.417, h: 0.508 },
            },
        },

        lighting: {
            ambientIntensity: 0.45,
            ambientDiffuse: [0.35, 0.50, 0.30],
            ambientGround: [0.08, 0.12, 0.06],
            sunIntensity: 0.45,
            sunDiffuse: [0.40, 0.55, 0.32],
            sunSpecular: [0.06, 0.08, 0.04],
            sunDirection: [-0.2, -1, -0.5],
            glowIntensity: 0.25,
        },

        ground: {
            type: 'texture',
            textureUrl: 'ground/jungle_ground.png',
            width: 320, height: 320, subdivisions: 110,
            displacementSeed: 66,
            displacementScale: 1.8,
            flatZoneRadius: 24,
            textureUScale: 8, textureVScale: 8,
            baseColor: 'rgb(38, 52, 28)',
            fallbackColor: [0.15, 0.20, 0.11],
            specular: [0.04, 0.06, 0.03],
            specularPower: 16,
            slabPositions: [
                [0, 0], [-12, 8], [14, -6], [-6, -14], [8, 16],
                [-20, 4], [22, -12], [4, -20],
            ],
            slabColor: [0.22, 0.30, 0.16],
        },

        perimeter: { halfW: 80, halfD: 80 },
        gateDirection: 'south',
        gateHalfWidth: 8,
        wallColor: [0.20, 0.28, 0.14],
        pillarColor: [0.24, 0.32, 0.16],

        playerStart: { x: 0, y: 2.2, z: 8 },
        playerLookAt: { x: 0, y: 2.2, z: 0 },

        spawn: {
            arcAngle: Math.PI * 1.3,
            radiusMin: 32,
            radiusMax: 52,
            direction: -1,
        },

        sceneAssets: {
            'rubble_pile':    { file: 'rubble_pile.glb', scale: 5.0, tint: { d: [0.25, 0.32, 0.18], e: [0.02, 0.04, 0.01] }, placements: [
                { x: -10, z: -10, ry: 0 },  { x: 12, z: -14, ry: 0.5 },
                { x: -22, z: -24, ry: 1.0 },{ x: 20, z: -18, ry: 0.3 },
                { x: -5, z: -6, ry: 0.8 },  { x: 16, z: -4, ry: 1.5 },
                { x: -30, z: -28, ry: 0.2 },{ x: 8, z: -34, ry: 0.6 },
            ]},
            'barricade':      { file: 'barricade.glb', scale: 4.0, tint: { d: [0.22, 0.30, 0.16], e: [0.02, 0.03, 0.01] }, placements: [
                { x: -6, z: -4, ry: 0 },    { x: 8, z: -2, ry: 0.2 },
                { x: -14, z: 3, ry: 0.6 },  { x: 16, z: 5, ry: -0.4 },
                { x: -20, z: -10, ry: 1.0 },{ x: 22, z: -8, ry: -0.7 },
            ]},
            'wall_segment':   { file: 'wall_segment.glb', scale: 5.5, tint: { d: [0.20, 0.28, 0.14], e: [0.02, 0.03, 0.01] }, placements: [
                { x: -14, z: -16, ry: 0 },  { x: 16, z: -14, ry: 0.1 },
                { x: -26, z: -4, ry: 0.5 }, { x: 24, z: -2, ry: -0.3 },
                { x: -8, z: -30, ry: 0.15 },{ x: 10, z: -32, ry: -0.1 },
            ]},
            'guard_tower':    { file: 'guard_tower.glb', scale: 10.0, tint: { d: [0.22, 0.30, 0.16], e: [0.02, 0.04, 0.01] }, placements: [
                { x: -35, z: -30, ry: 0 },  { x: 38, z: -28, ry: 0.3 },
                { x: -40, z: 15, ry: 0.8 }, { x: 42, z: 18, ry: -0.5 },
            ]},
            'burned_car':     { file: 'burned_car.glb', scale: 4.5, tint: { d: [0.20, 0.26, 0.14], e: [0.03, 0.04, 0.01] }, placements: [
                { x: -8, z: -6, ry: 0.4 },  { x: 12, z: -10, ry: -0.6 },
                { x: -24, z: -14, ry: 1.9 },{ x: 26, z: -20, ry: -1.2 },
            ]},
            'destroyed_apc':  { file: 'destroyed_apc.glb', scale: 6.5, tint: { d: [0.20, 0.28, 0.14], e: [0.02, 0.03, 0.01] }, placements: [
                { x: -14, z: -22, ry: 0.5 },{ x: 22, z: -26, ry: -0.7 },
            ]},
        },

        coverBlocks: [
            [-10, -34, 4, 1.5, 2.5, 0.2], [10, -34, 4, 1.5, 2.5, -0.2], [0, -26, 2, 5, 2, 0],
            [-18, -18, 5, 2, 3, 0], [16, -16, 3, 3, 2.5, 0.4],
            [-8, -8, 3, 2, 2, -0.2], [10, -6, 4, 1.5, 3, 0.4],
            [-24, -4, 3, 3, 2.5, 0], [22, -2, 4, 2, 2.5, -0.3],
            [-12, 6, 5, 1.5, 2.5, 0.5], [14, 8, 3, 3, 2, 0],
            [0, 18, 2, 4, 3, 0], [20, 20, 4, 2, 2.5, -0.4],
        ],
        coverColors: { light: [0.25, 0.34, 0.18], dark: [0.16, 0.22, 0.12] },

        cratePositions: [
            [-8, 2], [12, 5], [-20, -4], [22, -6], [-14, -12],
            [16, -10], [-28, 2], [32, 4], [-5, -24], [8, -28],
        ],
        barrelPositions: [
            [-6, -2], [10, 2], [-16, -8], [20, -2], [-10, -24],
            [14, -22], [-26, -12], [28, -10], [-8, -34], [10, -36],
        ],
        sandbagPositions: [
            [-4, 6, 0], [6, 8, 0.3], [-16, 3, 0.8], [18, 4, -0.5],
            [-10, -4, 1.0], [12, -2, -0.7],
        ],
        fenceLines: [
            { start: [-20, -40], end: [20, -40] },
            { start: [-40, -15], end: [-40, 15] },
            { start: [40, -12], end: [40, 16] },
        ],
        propColors: {
            crate: [0.25, 0.32, 0.18], crateDark: [0.16, 0.22, 0.12],
            barrel: [0.22, 0.28, 0.16], barrelRust: [0.35, 0.24, 0.10], barrelGreen: [0.18, 0.28, 0.12],
            sandbag: [0.30, 0.38, 0.20], pole: [0.22, 0.28, 0.14], wire: [0.24, 0.30, 0.16],
        },

        explosiveBarrelPositions: [
            [-10, -4], [14, -6], [-20, -14], [24, -10], [-8, -28],
            [16, -24], [-14, 6], [18, 10], [-26, -20], [30, -34],
        ],

        firePitPositions: [
            { x: -16, z: -16 }, { x: 18, z: -20 }, { x: 0, z: -32 },
        ],
        vehicleFirePositions: [
            { x: -8, z: -6 }, { x: 12, z: -10 },
        ],
        smokeColumns: [
            { x: -28, z: -26 }, { x: 24, z: -30 }, { x: -5, z: -48 },
        ],

        background: {
            rocketPositions: [],
            radarPositions: [
                { x: -68, z: -24, ry: 0.3 }, { x: 72, z: -20, ry: -0.5 },
            ],
            commPositions: [
                { x: -60, z: 12 }, { x: 62, z: 10 }, { x: 0, z: -82 },
            ],
            basePositions: [
                { x: -50, z: 18, ry: 0.1 }, { x: 52, z: 16, ry: -0.2 },
            ],
            domePositions: [],
        },
    },

    // ─────────────────────────────────────────────────────────────────
    // SCENE 7: ARCTIC BASE
    // ─────────────────────────────────────────────────────────────────
    arctic: {
        id: 'arctic',
        name: 'ARCTIC BASE',
        description: 'Frozen tundra outpost. Blizzard conditions, icy ground.',
        previewGradient: 'linear-gradient(135deg, #0e1820 0%, #182530 50%, #080e14 100%)',
        previewImage: ASSET_BASE + 'textures/skybox/arctic_sky.png',

        sky: {
            type: 'equirectangular',
            textureUrl: 'skybox/arctic_sky.png',
            clearColor: [0.55, 0.62, 0.70, 1],
            fogColor: [0.55, 0.62, 0.70],
            fogDensity: 0.016,
            hasLightning: false,
            // CREON — the orbital relay looming over the horizon.
            creon: {
                textureUrl: 'art/creon-machine-wars.png',
                tint: [0.82, 0.88, 1.0],
                opacity: 0.8,
                size: 213,
                distance: 300,
                elevation: 0.42,
                azimuth: 3.25,
                gain: 0.7,
                gamma: 1,
                crop: { x: 0.134, y: 0.0, w: 0.417, h: 0.508 },
            },
        },

        lighting: {
            ambientIntensity: 0.55,
            ambientDiffuse: [0.70, 0.75, 0.82],
            ambientGround: [0.45, 0.50, 0.58],
            sunIntensity: 0.50,
            sunDiffuse: [0.80, 0.85, 0.90],
            sunSpecular: [0.15, 0.16, 0.18],
            sunDirection: [-0.1, -1, -0.8],
            glowIntensity: 0.20,
        },

        ground: {
            type: 'texture',
            textureUrl: 'ground/arctic_ground.png',
            width: 320, height: 320, subdivisions: 110,
            displacementSeed: 77,
            displacementScale: 1.0,
            flatZoneRadius: 28,
            textureUScale: 10, textureVScale: 10,
            baseColor: 'rgb(210, 220, 232)',
            fallbackColor: [0.82, 0.86, 0.91],
            specular: [0.20, 0.22, 0.24],
            specularPower: 48,
            slabPositions: [
                [0, 0], [-14, 8], [16, -6], [-8, -15], [10, 18],
                [-22, 5], [24, -14],
            ],
            slabColor: [0.75, 0.80, 0.86],
        },

        perimeter: { halfW: 88, halfD: 88 },
        gateDirection: 'south',
        gateHalfWidth: 10,
        wallColor: [0.62, 0.68, 0.74],
        pillarColor: [0.70, 0.76, 0.82],

        playerStart: { x: 0, y: 2.2, z: 8 },
        playerLookAt: { x: 0, y: 2.2, z: 0 },

        spawn: {
            arcAngle: Math.PI * 1.1,
            radiusMin: 36,
            radiusMax: 56,
            direction: -1,
        },

        sceneAssets: {
            'rubble_pile':    { file: 'rubble_pile.glb', scale: 5.5, tint: { d: [0.70, 0.76, 0.82], e: [0.04, 0.04, 0.05] }, placements: [
                { x: -12, z: -12, ry: 0 },  { x: 10, z: -16, ry: 0.5 },
                { x: -22, z: -26, ry: 1.0 },{ x: 22, z: -20, ry: 0.3 },
                { x: -5, z: -8, ry: 0.8 },  { x: 16, z: -5, ry: 1.5 },
                { x: -30, z: -30, ry: 0.2 },{ x: 10, z: -38, ry: 0.6 },
            ]},
            'barricade':      { file: 'barricade.glb', scale: 4.5, tint: { d: [0.55, 0.62, 0.68], e: [0.03, 0.03, 0.04] }, placements: [
                { x: -6, z: -4, ry: 0 },    { x: 8, z: -2, ry: 0.2 },
                { x: -14, z: 3, ry: 0.6 },  { x: 16, z: 5, ry: -0.4 },
                { x: -22, z: -10, ry: 1.0 },{ x: 24, z: -8, ry: -0.7 },
            ]},
            'wall_segment':   { file: 'wall_segment.glb', scale: 6.0, tint: { d: [0.58, 0.65, 0.72], e: [0.03, 0.03, 0.04] }, placements: [
                { x: -16, z: -18, ry: 0 },  { x: 18, z: -16, ry: 0.1 },
                { x: -28, z: -6, ry: 0.5 }, { x: 26, z: -4, ry: -0.3 },
                { x: -8, z: -32, ry: 0.15 },{ x: 10, z: -34, ry: -0.1 },
            ]},
            'guard_tower':    { file: 'guard_tower.glb', scale: 11.0, tint: { d: [0.55, 0.62, 0.68], e: [0.04, 0.04, 0.05] }, placements: [
                { x: -38, z: -32, ry: 0 },  { x: 40, z: -30, ry: 0.3 },
                { x: -42, z: 18, ry: 0.8 }, { x: 44, z: 20, ry: -0.5 },
            ]},
            'destroyed_apc':  { file: 'destroyed_apc.glb', scale: 7.0, tint: { d: [0.58, 0.64, 0.70], e: [0.03, 0.03, 0.04] }, placements: [
                { x: -16, z: -24, ry: 0.5 },{ x: 26, z: -30, ry: -0.7 },
                { x: 5, z: -18, ry: 0.1 },
            ]},
        },

        coverBlocks: [
            [-10, -36, 4, 1.5, 2.5, 0.2], [10, -36, 4, 1.5, 2.5, -0.2], [0, -28, 2, 5, 2, 0],
            [-18, -20, 5, 2, 3, 0], [16, -18, 3, 3, 2.5, 0.4],
            [-8, -10, 3, 2, 2, -0.2], [10, -8, 4, 1.5, 3, 0.4],
            [-26, -6, 3, 3, 2.5, 0], [24, -4, 4, 2, 2.5, -0.3],
            [-12, 4, 5, 1.5, 2.5, 0.5], [14, 6, 3, 3, 2, 0],
            [0, 16, 2, 4, 3, 0], [22, 18, 4, 2, 2.5, -0.4],
            [0, 28, 6, 2, 3, 0],
        ],
        coverColors: { light: [0.72, 0.78, 0.84], dark: [0.55, 0.62, 0.68] },

        cratePositions: [
            [-8, 2], [12, 5], [-20, -4], [24, -6], [-14, -14],
            [16, -12], [-30, 2], [34, 4], [-5, -26], [8, -30],
        ],
        barrelPositions: [
            [-6, -2], [10, 2], [-18, -8], [22, -2], [-12, -26],
            [14, -24], [-28, -14], [30, -12], [-8, -36], [10, -38],
        ],
        sandbagPositions: [
            [-4, 6, 0], [6, 8, 0.3], [-18, 3, 0.8], [20, 4, -0.5],
            [-10, -4, 1.0], [12, -2, -0.7],
        ],
        fenceLines: [
            { start: [-18, -44], end: [18, -44] },
            { start: [-38, -18], end: [-38, 14] },
            { start: [38, -16], end: [38, 16] },
        ],
        propColors: {
            crate: [0.58, 0.65, 0.72], crateDark: [0.45, 0.52, 0.58],
            barrel: [0.50, 0.56, 0.62], barrelRust: [0.55, 0.42, 0.32], barrelGreen: [0.42, 0.52, 0.45],
            sandbag: [0.65, 0.70, 0.76], pole: [0.50, 0.56, 0.62], wire: [0.45, 0.50, 0.55],
        },

        explosiveBarrelPositions: [
            [-10, -4], [14, -6], [-22, -16], [26, -12], [-8, -30],
            [18, -26], [-16, 6], [20, 10], [-28, -22], [32, -36],
        ],

        firePitPositions: [
            { x: -16, z: -16 }, { x: 18, z: -20 }, { x: -30, z: -4 }, { x: 28, z: -6 },
        ],
        vehicleFirePositions: [],
        smokeColumns: [
            { x: -30, z: -28 }, { x: 26, z: -32 }, { x: 0, z: -50 },
        ],

        background: {
            rocketPositions: [
                { x: 0, z: -70, ry: 0 }, { x: -20, z: -78, ry: 0.1 },
            ],
            radarPositions: [
                { x: -72, z: -28, ry: 0.3 }, { x: 76, z: -24, ry: -0.5 },
                { x: -40, z: -65, ry: 0.6 }, { x: 45, z: -68, ry: -0.4 },
            ],
            commPositions: [
                { x: -65, z: 14 }, { x: 68, z: 10 }, { x: 0, z: -88 },
            ],
            basePositions: [
                { x: -55, z: 20, ry: 0.1 }, { x: 58, z: 18, ry: -0.2 },
                { x: 0, z: 22, ry: 0 },
            ],
            domePositions: [],
        },
    },

};

// ── Default scene ───────────────────────────────────────────────────
const DEFAULT_SCENE = 'warzone';

export { SCENE_CONFIGS, DEFAULT_SCENE, SCENE_MODEL_BASE, SCENE_TEXTURE_BASE, ASSET_BASE };
