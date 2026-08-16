/* ═══════════════════════════════════════════════════════════════════
   ghats.data.js — scene config for "WESTERN GHATS".
   First GIS site (P1.5, ROADMAP-V2 §5). ground.type "heightmap" is new
   (P1.4, src/scenes.js _buildHeightmapGround) — a ~68m-radius hand-authored
   combat floor (flatZoneRadius) sitting inside a real-DEM displaced mesh
   (visibleRadiusM) sampled from assets/terrain/ghats/{heightmap,albedo}.
   Sky/CREON/lighting palette reused from jungle.data.js (same biome, no
   dedicated ghats skybox art yet) except sunDirection, which is derived
   from ghats's real latitude (13.5178N) at near-overhead solar elevation
   (~76deg, equinox local-noon approximation) — see docs/v2/HANDOFF.md P1.5.
   Paths (previewImage/textureUrl/sceneAssets[].file/ground.*Url) are
   relative to ASSET_BASE/SCENE_MODEL_BASE/SCENE_TEXTURE_BASE, resolved by
   src/scenes-data.js / src/scenes.js — not absolute here. See data/README.md.
   ═══════════════════════════════════════════════════════════════════ */
export default {
    id: "ghats",
    name: "WESTERN GHATS",
    description: "Real terrain, Agumbe rainforest ridge. Authored combat floor, real DEM horizon.",
    previewGradient: "linear-gradient(135deg, #0a1a08 0%, #142810 50%, #061206 100%)",
    previewImage: "art/zones/jungle.jpg",
    sky: {
        type: "equirectangular",
        textureUrl: "skybox/jungle_sky.png",
        clearColor: [0.42, 0.5, 0.4, 1],
        fogColor: [0.42, 0.5, 0.4],
        // jungle.data.js's 0.014 was tuned for an 80m-halfW arena; at ghats's
        // much larger visibleRadiusM (P1.5, see ground below) that density
        // fogs the real-DEM ridgeline into flat grey mush before it can read
        // as terrain. Lowered so the hillshaded horizon stays visible.
        fogDensity: 0.004,
        hasLightning: false,
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
        // Brighter than jungle.data.js's dense-canopy values (0.45/0.08) —
        // near-overhead tropical sun at this latitude, in the open over real
        // terrain rather than under a jungle canopy, and the hillshade pass
        // baked into albedo.png (build-albedo.mjs, tools/gis/sites.data.js
        // albedoPalette.lowTint/highTint) needs real light to read.
        ambientIntensity: 0.65,
        ambientDiffuse: [0.55, 0.62, 0.48],
        ambientGround: [0.22, 0.26, 0.16],
        sunIntensity: 0.85,
        sunDiffuse: [0.85, 0.88, 0.72],
        sunSpecular: [0.1, 0.1, 0.08],
        sunDirection: [0, -0.97, 0.23],
        glowIntensity: 0.15,
    },
    ground: {
        type: "heightmap",
        visibleRadiusM: 200,
        subdivisions: 110,
        flatZoneRadius: 68,
        metadataUrl: "terrain/ghats/heightmap.json",
        heightmapUrl: "terrain/ghats/heightmap.png",
        albedoUrl: "terrain/ghats/albedo.png",
        textureUScale: 8,
        textureVScale: 8,
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
        halfW: 66,
        halfD: 66,
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
                { x: -10, z: -10, ry: 0 },
                { x: 12, z: -14, ry: 0.5 },
                { x: -18, z: -20, ry: 1 },
                { x: 16, z: -16, ry: 0.3 },
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
                { x: -6, z: -4, ry: 0 },
                { x: 8, z: -2, ry: 0.2 },
                { x: -14, z: 3, ry: 0.6 },
                { x: 16, z: 5, ry: -0.4 },
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
                { x: -14, z: -16, ry: 0 },
                { x: 16, z: -14, ry: 0.1 },
                { x: -22, z: -4, ry: 0.5 },
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
                { x: -30, z: -26, ry: 0 },
                { x: 32, z: -24, ry: 0.3 },
            ],
        },
    },
    coverBlocks: [
        [-10, -30, 4, 1.5, 2.5, 0.2],
        [10, -30, 4, 1.5, 2.5, -0.2],
        [0, -24, 2, 5, 2, 0],
        [-16, -16, 5, 2, 3, 0],
        [14, -14, 3, 3, 2.5, 0.4],
        [-8, -8, 3, 2, 2, -0.2],
        [10, -6, 4, 1.5, 3, 0.4],
        [-20, -4, 3, 3, 2.5, 0],
        [18, -2, 4, 2, 2.5, -0.3],
        [-10, 6, 5, 1.5, 2.5, 0.5],
        [12, 8, 3, 3, 2, 0],
        [0, 16, 2, 4, 3, 0],
    ],
    coverColors: {
        light: [0.25, 0.34, 0.18],
        dark: [0.16, 0.22, 0.12],
    },
    cratePositions: [
        [-8, 2],
        [12, 5],
        [-18, -4],
        [20, -6],
        [-12, -10],
        [14, -8],
    ],
    barrelPositions: [
        [-6, -2],
        [10, 2],
        [-14, -8],
        [16, -2],
        [-8, -20],
        [12, -18],
    ],
    sandbagPositions: [
        [-4, 6, 0],
        [6, 8, 0.3],
        [-14, 3, 0.8],
        [16, 4, -0.5],
    ],
    fenceLines: [
        {
            start: [-16, -32],
            end: [16, -32],
        },
        {
            start: [-32, -12],
            end: [-32, 12],
        },
        {
            start: [32, -10],
            end: [32, 12],
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
        [-16, -12],
        [18, -10],
    ],
    firePitPositions: [
        { x: -14, z: -14 },
        { x: 16, z: -18 },
    ],
    vehicleFirePositions: [],
    smokeColumns: [
        { x: -24, z: -22 },
        { x: 22, z: -26 },
    ],
    background: {
        rocketPositions: [],
        radarPositions: [
            { x: -56, z: -20, ry: 0.3 },
            { x: 58, z: -18, ry: -0.5 },
        ],
        commPositions: [
            { x: -50, z: 10, ry: 0 },
            { x: 52, z: 8, ry: 0 },
        ],
        basePositions: [],
        domePositions: [],
    },
};
