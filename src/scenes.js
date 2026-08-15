/* ═══════════════════════════════════════════════════════════════════
   MACHINE WARS — scenes.js (environment builder, Three.js + PBR)
   Consumes SCENE_CONFIGS data and builds the 3D world. Ported from the
   Babylon buildScene()/buildGround()/buildPerimeterWalls()/... family.
   ═══════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { loadGLB } from './gltf.js';
import { SCENE_CONFIGS, DEFAULT_SCENE, MISSION_ORDER, SCENE_MODEL_BASE, SCENE_TEXTURE_BASE, ASSET_BASE } from './scenes-data.js';
import { withVersion } from './version.js';
import {
    seededRandom, proceduralGroundTexture, proceduralSkyTexture,
    fireTexture, smokeTexture, ParticlePool, ContinuousEmitter, creonFaceTexture,
    concreteTexture,
} from './fx.js';

export { SCENE_CONFIGS, DEFAULT_SCENE, MISSION_ORDER };

const _texLoader = new THREE.TextureLoader();

// Small scattered clutter (crates, barrels) registers a slightly tightened
// footprint. Crates spawn 1-3 deep per position with jitter, so full-size boxes
// fuse neighbours into one impassable blob; pulling each in leaves the gaps a
// player can actually squeeze through.
const CLUTTER_SHRINK = 0.75;

// Scale a BoxGeometry's UVs by each face's world size so a tiling texture keeps
// an even texel density regardless of how large the box is. Without this a big
// slab and a small one show wildly different grain from the same map.
function scaleBoxUVs(geo, w, h, d, density = 0.35) {
    const uv = geo.attributes.uv;
    const spans = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]; // +X,-X,+Y,-Y,+Z,-Z
    for (let f = 0; f < 6; f++) {
        const [su, sv] = spans[f];
        for (let i = f * 4; i < f * 4 + 4; i++) {
            uv.setXY(i, uv.getX(i) * su * density, uv.getY(i) * sv * density);
        }
    }
    uv.needsUpdate = true;
    return geo;
}
const _glbCache = {}; // file -> gltf scene (cloned per placement)
const _fallbackCache = {}; // name -> procedural template Group (cloned per placement)
// Geometry owned by the caches above. Clones share it by reference, so it must
// survive World.dispose() — see the note there.
const _templateGeos = new Set();
function registerTemplate(root) {
    root.traverse((o) => { if (o.isMesh && o.geometry) _templateGeos.add(o.geometry); });
    return root;
}

function _fbBox(w, h, d, x, y, z, m, rx = 0, ry = 0, rz = 0) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    return mesh;
}
function _fbCyl(rTop, rBot, h, x, y, z, m, rx = 0, ry = 0, rz = 0, seg = 8) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg), m);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    return mesh;
}

// ── Procedural GLB fallbacks ────────────────────────────────────────
// If a scene GLB fails to load (offline, Draco down, 404) we build a
// low-poly silhouette of the same profile from the asset's tint/scale
// data, so the arena never looks empty. Templates are cached per name
// and deep-cloned per placement (each clone owns its geometry, so the
// normal dispose() path stays safe).
function _buildFallbackTemplate(name, tint) {
    const mat = new THREE.MeshStandardMaterial({ color: col3(tint.d), emissive: col3(tint.e || [0, 0, 0]), roughness: 0.85, metalness: 0.1 });
    const dark = new THREE.MeshStandardMaterial({ color: col3(tint.d).multiplyScalar(0.55), roughness: 0.9, metalness: 0.05 });
    const glow = new THREE.MeshStandardMaterial({ color: col3(tint.e || [0.05, 0.05, 0.05]), emissive: col3(tint.e || [0.05, 0.05, 0.05]), emissiveIntensity: 0.6 });

    // All silhouettes are authored ~1 unit; the caller scales by ac.scale.
    const root = new THREE.Group();

    if (name === 'factory_ruin' || name === 'warehouse_ruin') {
        const w = name === 'warehouse_ruin' ? 1.5 : 1.2, h = 0.75, d = 1.0;
        root.add(_fbBox(w, 0.5, d, 0, 0.25, 0, dark));
        root.add(_fbBox(w * 0.55, h, d * 0.55, -w * 0.22, 0.28 + h / 2, d * 0.18, mat));
        root.add(_fbBox(w * 0.5, h * 0.8, d * 0.5, w * 0.25, 0.2 + h * 0.4, -d * 0.2, mat));
        root.add(_fbBox(w * 0.9, 0.08, d * 1.02, 0, 0.62, 0, mat, 0, 0, 0.12)); // fallen girder
        for (const side of [-1, 1]) {
            root.add(_fbBox(0.06, h * 1.1, 0.06, side * (w / 2 - 0.03), h * 0.55, side * (d / 2 - 0.03), dark));
            root.add(_fbBox(0.06, h * 1.1, 0.06, side * (w / 2 - 0.03), h * 0.55, -side * (d / 2 - 0.03), dark));
        }
    } else if (name === 'factory_chimney') {
        root.add(_fbCyl(0.1, 0.1, 1.0, 0, 0.5, 0, mat));
        root.add(_fbCyl(0.18, 0.22, 0.1, 0, 0.05, 0, dark));
        root.add(_fbCyl(0.06, 0.06, 0.06, 0, 1.02, 0, glow));
        root.add(_fbBox(0.3, 0.08, 0.3, 0, 1.05, 0, dark)); // cap
    } else if (name === 'guard_tower') {
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
            root.add(_fbCyl(0.035, 0.05, 0.62, sx * 0.28, 0.31, sz * 0.28, dark));
        }
        root.add(_fbBox(0.72, 0.07, 0.72, 0, 0.64, 0, mat));
        root.add(_fbBox(0.3, 0.4, 0.3, 0, 0.88, 0, dark)); // cabin
        root.add(_fbBox(0.8, 0.06, 0.8, 0, 1.1, 0, mat));  // roof
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
            root.add(_fbBox(0.05, 0.12, 0.05, sx * 0.36, 1.18, sz * 0.36, dark));
        }
    } else if (name === 'wall_segment') {
        root.add(_fbBox(1.0, 0.34, 0.09, 0, 0.17, 0, mat));
        root.add(_fbBox(0.16, 0.12, 0.11, -0.35, 0.4, 0, dark));
        root.add(_fbBox(0.16, 0.12, 0.11, 0.35, 0.4, 0, dark));
        root.add(_fbBox(0.18, 0.04, 0.1, 0, 0.42, 0, glow)); // scorch line
    } else if (name === 'burned_car' || name === 'burned_truck' || name === 'destroyed_apc') {
        const truck = name === 'burned_truck', apc = name === 'destroyed_apc';
        const L = truck ? 1.0 : apc ? 0.7 : 0.55, W = 0.32, H = 0.2;
        root.add(_fbBox(L, H, W, 0, 0.14, 0, dark));
        if (truck) {
            root.add(_fbBox(0.32, 0.2, W * 0.9, 0.3, 0.34, 0, mat)); // cab
            root.add(_fbBox(L * 0.55, 0.08, W * 0.7, -0.05, 0.4, 0.06, mat, 0, 0, 0.1)); // load bed
        } else {
            root.add(_fbBox(L * 0.5, 0.16, W * 0.85, apc ? 0 : 0.12, apc ? 0.38 : 0.3, 0, mat)); // cabin/turret
            if (apc) root.add(_fbCyl(0.05, 0.05, 0.3, 0, 0.48, 0.14, glow, Math.PI / 2));
        }
        for (const sx of [-1, 1]) {
            if (truck) {
                for (const ax of [-0.3, 0, 0.3]) root.add(_fbCyl(0.07, 0.07, 0.07, ax, 0.07, sx * (W / 2), dark, 0, 0, Math.PI / 2, 10));
            } else {
                const cx = apc ? 0 : 0.12;
                root.add(_fbCyl(0.08, 0.08, 0.08, cx - L * 0.25, 0.07, sx * (W / 2), dark, 0, 0, Math.PI / 2, 10));
                root.add(_fbCyl(0.08, 0.08, 0.08, cx + L * 0.25, 0.07, sx * (W / 2), dark, 0, 0, Math.PI / 2, 10));
            }
        }
        if (!truck) root.add(_fbBox(L * 0.8, 0.05, W * 1.1, 0, 0.03, 0, dark)); // chassis
    } else if (name === 'rubble_pile') {
        const r0 = 0.22, r1 = 0.14;
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2, rr = r0 + (i % 3) * 0.12;
            root.add(_fbBox(rr, rr * (0.6 + (i % 2) * 0.3), rr * 0.8,
                Math.cos(a) * 0.22, rr * 0.28, Math.sin(a) * 0.22, i % 2 ? mat : dark, 0.4, a, 0.2));
        }
        root.add(_fbBox(0.14, 0.2, 0.14, 0, 0.22, 0, mat, 0.5, 0.4, 0.2));
    } else if (name === 'rusted_beam') {
        root.add(_fbBox(1.4, 0.05, 0.06, 0, 0.05, 0, mat, 0, 0.2, 0.08));
        root.add(_fbBox(0.16, 0.16, 0.16, 0.55, 0.05, 0.02, dark, 0, 0.3, 0.4));
        root.add(_fbBox(0.04, 0.09, 0.04, -0.55, 0.09, 0, dark, 0.2, 0, 0.1));
    } else if (name === 'barricade') {
        root.add(_fbBox(0.8, 0.24, 0.1, 0, 0.18, 0, mat, 0, 0.15, 0.06));
        root.add(_fbBox(0.8, 0.1, 0.08, 0, 0.48, 0, dark, 0, -0.1, -0.08));
        for (const s of [-0.3, 0.3]) {
            root.add(_fbBox(0.08, 0.6, 0.06, s, 0.34, 0, dark, 0, 0.5, 0.2));
            root.add(_fbBox(0.08, 0.6, 0.06, -s, 0.34, 0, dark, 0, -0.5, -0.2));
        }
    } else {
        // Generic debris mound
        root.add(_fbBox(0.6, 0.3, 0.5, 0, 0.15, 0, mat));
        root.add(_fbBox(0.35, 0.22, 0.35, 0.15, 0.32, 0.1, dark));
        root.add(_fbBox(0.2, 0.16, 0.2, -0.18, 0.42, -0.1, mat, 0.3, 0, 0.15));
    }

    root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return root;
}

function col3(a) { return new THREE.Color(a[0], a[1], a[2]); }

/* The World holds everything built for the active scene + per-frame updaters. */
export class World {
    constructor(renderer, camera) {
        this.renderer = renderer;
        this.camera = camera || null; // needed by camera-locked sky elements (CREON)
        this.scene = new THREE.Scene();
        this.updaters = [];        // [{update(dt, now)}]
        this.obstacles = [];       // {x,z,hw,hd,h}
        this.firePits = [];        // {x,z,light}
        this.explosiveBarrels = [];// {mesh,stripe,x,z,exploded}
        this.pools = {};           // particle pools
        this.sun = null;
        this.cfg = null;
        this._disposables = [];
        this._ownMaterials = [];
    }

    _track(obj) { this._disposables.push(obj); return obj; }

    _trackMaterial(m) { this._ownMaterials.push(m); return m; }

    build(sceneId, quality) {
        const cfg = SCENE_CONFIGS[sceneId] || SCENE_CONFIGS[DEFAULT_SCENE];
        this.cfg = cfg;
        const scene = this.scene;

        // Fog (exp2)
        const fc = cfg.sky.fogColor;
        scene.fog = new THREE.FogExp2(new THREE.Color(fc[0], fc[1], fc[2]), cfg.sky.fogDensity);
        scene.background = new THREE.Color(cfg.sky.clearColor[0], cfg.sky.clearColor[1], cfg.sky.clearColor[2]);

        // Particle pools (shared)
        this.pools.fire = new ParticlePool(scene, { capacity: Math.round(900 * quality.particleScale), texture: fireTexture(), size: 2.2 });
        this.pools.smoke = new ParticlePool(scene, { capacity: Math.round(600 * quality.particleScale), texture: smokeTexture(), blending: THREE.NormalBlending, size: 3.5, depthWrite: false });
        this.pools.spark = new ParticlePool(scene, { capacity: Math.round(500 * quality.particleScale), texture: fireTexture(), size: 0.9 });

        this._buildLighting(cfg, quality);
        this._buildGround(cfg);
        this._buildPerimeterWalls(cfg);
        this._buildExplosiveBarrels(cfg);
        this._buildBackgroundStructures(cfg);
        this._buildFirePits(cfg);
        this._buildSmokeColumns(cfg);
        this._buildSky(cfg);
        this._buildSceneSpecificEffects(cfg);
        // Cover and clutter are built from the scene's GLBs, so they have to
        // wait for the cache to fill. Collision is registered up front, before
        // the await, so the arena is solid from the first frame even while the
        // models are still decoding.
        this._registerCoverObstacles(cfg);
        this._loadSceneGLBs(cfg).then(() => {
            if (this._disposed) return;
            this._buildCoverBlocks(cfg);
            this._buildProceduralProps(cfg);
        });

        return cfg;
    }

    // Single registration point for every solid thing in the arena. A rotated
    // footprint is stored as its axis-aligned bounding box, since collision is
    // a cheap AABB test; `shrink` pulls that box in for irregular props whose
    // AABB overstates their solid core.
    //
    // `h` is the obstacle's height. Movement collision ignores it (it is purely
    // 2D), but line-of-sight and crouch need to know whether a given block is
    // tall enough to hide behind — a knee-high crate must not break a standing
    // enemy's sightline the way a ruin wall does.
    _pushObstacle(x, z, w, d, ry = 0, h = 2, shrink = 1) {
        const cosR = Math.abs(Math.cos(ry)), sinR = Math.abs(Math.sin(ry));
        this.obstacles.push({
            x, z,
            hw: (w * cosR + d * sinR) / 2 * shrink,
            hd: (w * sinR + d * cosR) / 2 * shrink,
            h,
        });
    }

    // Cover collision, independent of what ends up representing it visually.
    // _buildCoverBlocks() runs after an await; without this the player could
    // walk through every cover position until the GLBs finished decoding.
    _registerCoverObstacles(cfg) {
        for (const [x, z, w, d, h, ry] of (cfg.coverBlocks || [])) {
            this._pushObstacle(x, z, w, d, ry, h);
        }
    }

    // ── Lighting ────────────────────────────────────────────────────
    _buildLighting(cfg, quality) {
        const lc = cfg.lighting;
        // Multipliers deliberately >1: the authored configs are tuned for the
        // Babylon renderer's brighter default. Three.js ACES tone mapping is
        // dimmer, so these keep every arena readable instead of near-black.
        const hemi = new THREE.HemisphereLight(
            col3(lc.ambientDiffuse), col3(lc.ambientGround), lc.ambientIntensity * 1.75);
        this.scene.add(hemi);

        const sun = new THREE.DirectionalLight(col3(lc.sunDiffuse), lc.sunIntensity * 2.0);
        const sd = lc.sunDirection;
        const sunDist = Math.max(cfg.perimeter.halfW, cfg.perimeter.halfD) + 40;
        sun.position.set(-sd[0] * sunDist, -sd[1] * sunDist, -sd[2] * sunDist);
        sun.castShadow = true;
        sun.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
        // Cover the whole (now larger) play area, or props near the perimeter
        // cast no shadow and pop as the sun frustum clips them.
        const cam = sun.shadow.camera;
        const reach = Math.max(cfg.perimeter.halfW, cfg.perimeter.halfD) + 15;
        cam.near = 1; cam.far = reach * 3;
        cam.left = -reach; cam.right = reach; cam.top = reach; cam.bottom = -reach;
        sun.shadow.bias = -0.0006;
        sun.shadow.normalBias = 0.04;
        this.scene.add(sun);
        this.scene.add(sun.target);
        this.sun = sun;
        this._glowIntensity = lc.glowIntensity;
    }

    // ── Ground ──────────────────────────────────────────────────────
    _buildGround(cfg) {
        const gc = cfg.ground;
        const geo = new THREE.PlaneGeometry(gc.width, gc.height, gc.subdivisions, gc.subdivisions);
        geo.rotateX(-Math.PI / 2);
        // Vertex displacement — rough terrain, flat play zone
        const pos = geo.attributes.position;
        const rng = seededRandom(gc.displacementSeed);
        const flatR = gc.flatZoneRadius || 18;
        const dScale = gc.displacementScale || 1.6;
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i), z = pos.getZ(i);
            const dist = Math.sqrt(x * x + z * z);
            const flat = Math.max(0, 1 - dist / flatR);
            pos.setY(i, (rng() - 0.5) * dScale * (1 - flat));
        }
        geo.computeVertexNormals();

        const mat = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0.0 });
        const sp = gc.specular || [0.06, 0.05, 0.04];
        mat.roughness = 1 - Math.min(0.5, (sp[0] + sp[1] + sp[2]));

        if (gc.type === 'texture' && gc.textureUrl) {
            _texLoader.load(withVersion(SCENE_TEXTURE_BASE + gc.textureUrl), (tex) => {
                tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
                tex.repeat.set(gc.textureUScale || 8, gc.textureVScale || 8);
                tex.colorSpace = THREE.SRGBColorSpace;
                mat.map = tex; mat.needsUpdate = true;
            }, undefined, () => {
                if (gc.fallbackColor) mat.color = col3(gc.fallbackColor);
            });
        } else {
            const tex = proceduralGroundTexture(gc);
            tex.repeat.set(gc.textureUScale || 8, gc.textureVScale || 8);
            mat.map = tex;
        }

        const ground = new THREE.Mesh(geo, mat);
        ground.receiveShadow = true;
        this.scene.add(this._track(ground));

        // Slab patches. Keep the deployment area uncluttered: a floor-sized
        // patch right in front of the camera read as a dark wall/obstacle.
        const slabColor = gc.slabColor || [0.35, 0.28, 0.22];
        const slabMat = new THREE.MeshStandardMaterial({ color: col3(slabColor), roughness: 0.9 });
        for (const [x, z] of (gc.slabPositions || [])) {
            const start = cfg.playerStart;
            if (start && Math.hypot(x - start.x, z - start.z) < 18) continue;
            const w = 4 + Math.random() * 8, d = 4 + Math.random() * 8;
            const slab = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), slabMat);
            slab.position.set(x, 0.03, z);
            slab.rotation.y = Math.random() * Math.PI;
            slab.receiveShadow = true;
            this.scene.add(slab);
        }
    }

    // ── Perimeter walls + gate ──────────────────────────────────────
    _buildPerimeterWalls(cfg) {
        // The perimeter walls are the largest flat surfaces in every arena, so
        // an untextured material reads as a plain primitive slab from anywhere
        // on the map.
        const wallMat = this._trackMaterial(new THREE.MeshStandardMaterial({
            map: this._track(concreteTexture(cfg.wallColor || [0.25, 0.22, 0.18], 91)),
            color: new THREE.Color(0.95, 0.95, 0.95), roughness: 0.9,
            emissive: new THREE.Color(0.02, 0.018, 0.015),
        }));
        const wallH = 5, wallThick = 1.2;
        const hw = cfg.perimeter.halfW, hd = cfg.perimeter.halfD;
        const gateHalf = cfg.gateHalfWidth || 8;
        const segments = [
            { cx: -(hw / 2 + gateHalf / 2), cz: -hd, w: hw - gateHalf, d: wallThick },
            { cx: (hw / 2 + gateHalf / 2), cz: -hd, w: hw - gateHalf, d: wallThick },
            { cx: 0, cz: hd, w: hw * 2, d: wallThick },
            { cx: hw, cz: 0, w: wallThick, d: hd * 2 },
            { cx: -hw, cz: 0, w: wallThick, d: hd * 2 },
        ];
        for (const s of segments) {
            const wall = new THREE.Mesh(scaleBoxUVs(new THREE.BoxGeometry(s.w, wallH, s.d), s.w, wallH, s.d), wallMat);
            wall.position.set(s.cx, wallH / 2, s.cz);
            wall.castShadow = wall.receiveShadow = true;
            wall.userData = { isObstacle: true };
            this.scene.add(wall);
            this._pushObstacle(s.cx, s.cz, s.w, s.d, 0, wallH);
        }
        // Gate pillars + warning lights
        const pillarMat = new THREE.MeshStandardMaterial({ color: col3(cfg.pillarColor || [0.3, 0.25, 0.2]), roughness: 0.8, emissive: new THREE.Color(0.03, 0.02, 0.01) });
        for (const gx of [-gateHalf, gateHalf]) {
            const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.5, wallH + 1.5, 1.5), pillarMat);
            pillar.position.set(gx, (wallH + 1.5) / 2, -hd);
            pillar.castShadow = pillar.receiveShadow = true;
            pillar.userData = { isObstacle: true };
            this.scene.add(pillar);
            // Pillars were tagged for the bullet raycast but never registered as
            // obstacles, so the player walked straight through the gate posts.
            this._pushObstacle(gx, -hd, 1.5, 1.5, 0, wallH + 1.5);
            const light = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8),
                new THREE.MeshBasicMaterial({ color: new THREE.Color(0.8, 0.2, 0.0) }));
            light.position.set(gx, wallH + 1.8, -hd);
            this.scene.add(light);
        }
    }

    // ── Model instancing helper ─────────────────────────────────────
    // Returns a clone of a loaded scene GLB, tinted like the rest of that
    // asset's placements and scaled so its footprint matches the requested
    // box. Everything that used to be a bare BoxGeometry (cover slabs,
    // crates, barrels, sandbags) goes through this, so the arena is built
    // from the real assets instead of primitives. Returns null when the GLB
    // isn't loaded — callers then fall back to their old procedural shape.
    _instanceProp(cfg, name, { w, h, d, fit = 'height' }) {
        const ac = (cfg.sceneAssets || {})[name];
        const src = ac && _glbCache[ac.file];
        if (!src) return null;

        const root = src.clone(true);
        const size = new THREE.Box3().setFromObject(src).getSize(new THREE.Vector3());
        if (!(size.x > 0 && size.y > 0 && size.z > 0)) return null;
        // Uniform scale, so no model is ever stretched out of proportion.
        // 'height' fits stature (crates, barrels). 'footprint' fits cover to
        // its blocking box — using the *smaller* of the two horizontal ratios
        // and clamping against height, since taking the larger one scales the
        // model until it swallows the arena.
        // Cover is chest-high shooting cover, so height drives the fit and the
        // horizontal ratios only cap it — a block that reads at the right
        // stature but spills past its collision box is worse than a short one.
        const s = fit === 'height'
            ? h / size.y
            : Math.min(h / size.y, Math.max(w / size.x, d / size.z));
        if (!(s > 0 && isFinite(s))) return null;
        root.scale.setScalar(s);

        const tint = ac.tint || { d: [0.3, 0.28, 0.25], e: [0.02, 0.01, 0] };
        const cache = (this._propMatCache ||= new Map());
        root.traverse((o) => {
            if (!o.isMesh) return;
            let m = cache.get(o.material);
            if (!m) {
                m = o.material.clone();
                // Tint the model's own material — replacing it outright would
                // discard the baked baseColor map and put us right back to
                // untextured-looking boxes.
                if (m.map) m.color.lerp(col3(tint.d), 0.35);
                else m.color = col3(tint.d);
                m.emissive = col3(tint.e);
                cache.set(o.material, m);
                this._trackMaterial(m);
            }
            o.material = m;
            o.castShadow = o.receiveShadow = true;
        });
        return root;
    }

    // Names of scene assets suitable for standing in as cover / clutter,
    // in preference order, filtered to what this scene actually declares.
    _propCandidates(cfg, names) {
        const sa = cfg.sceneAssets || {};
        return names.filter((n) => sa[n] && _glbCache[sa[n].file]);
    }

    // ── Cover blocks (solid obstacles) ──────────────────────────────
    _buildCoverBlocks(cfg) {
        const cc = cfg.coverColors || { light: [0.32, 0.28, 0.22], dark: [0.2, 0.18, 0.15] };
        // Textured concrete rather than flat colour — these are the big grey
        // slabs that otherwise read as untextured primitives beside the GLBs.
        const texL = this._track(concreteTexture(cc.light, 11));
        const texD = this._track(concreteTexture(cc.dark, 29));
        const lift = new THREE.Color(0.03, 0.028, 0.025); // keeps shadowed faces from crushing to black
        const matL = this._trackMaterial(new THREE.MeshStandardMaterial({ map: texL, color: col3(cc.light), roughness: 0.95, metalness: 0.02, emissive: lift }));
        const matD = this._trackMaterial(new THREE.MeshStandardMaterial({ map: texD, color: col3(cc.dark), roughness: 0.97, metalness: 0.02, emissive: lift }));
        const rng = seededRandom(517);
        // Cover reads as barricades/rubble/wall chunks rather than grey slabs.
        // Chosen per block from whatever this scene declares, so each arena
        // stays in its own material vocabulary.
        const models = this._propCandidates(cfg, ['barricade', 'rubble_pile', 'wall_segment', 'rusted_beam']);
        for (const [x, z, w, d, h, ry] of (cfg.coverBlocks || [])) {
            const yaw = ry + (rng() - 0.5) * 0.05;
            const pick = models.length ? models[(rng() * models.length) | 0] : null;
            const model = pick && this._instanceProp(cfg, pick, { w, h, d, fit: 'footprint' });
            if (model) {
                model.position.set(x, 0, z);
                model.rotation.y = yaw;
                model.userData = { isObstacle: true };
                this.scene.add(model);
            } else {
                const geo = scaleBoxUVs(new THREE.BoxGeometry(w, h, d), w, h, d);
                const block = new THREE.Mesh(geo, rng() > 0.5 ? matL : matD);
                block.position.set(x, h / 2, z);
                // Slight settle/tilt so the slabs don't all sit perfectly plumb.
                block.rotation.y = yaw;
                block.rotation.z = (rng() - 0.5) * 0.02;
                block.castShadow = block.receiveShadow = true;
                block.userData = { isObstacle: true };
                this.scene.add(block);
            }
            // Collision is not registered here — _registerCoverObstacles()
            // already did it synchronously from the same authored footprint,
            // so swapping the visual never changes how the arena plays.
        }
    }

    // ── Procedural fill props ───────────────────────────────────────
    _buildProceduralProps(cfg) {
        const rng = seededRandom(42);
        const pc = cfg.propColors || {};
        const m = (arr, ex) => new THREE.MeshStandardMaterial({ color: col3(arr), roughness: 0.9, emissive: ex ? col3(ex) : new THREE.Color(0, 0, 0) });
        const crateMat = m(pc.crate || [0.35, 0.25, 0.15]);
        const crateMatDk = m(pc.crateDark || [0.22, 0.18, 0.12]);
        const barrelMats = [
            m(pc.barrel || [0.28, 0.22, 0.15], [0.03, 0.01, 0]),
            m(pc.barrelRust || [0.45, 0.2, 0.08], [0.05, 0.02, 0]),
            m(pc.barrelGreen || [0.12, 0.2, 0.1]),
        ];
        const sandbagMat = m(pc.sandbag || [0.45, 0.38, 0.25]);
        const poleMat = m(pc.pole || [0.25, 0.2, 0.15]);
        const wireMat = new THREE.MeshStandardMaterial({ color: col3(pc.wire || [0.3, 0.28, 0.25]), wireframe: true });

        // Small clutter uses the scene's own debris models where available;
        // the primitives below remain only for a failed GLB load.
        const crateModels = this._propCandidates(cfg, ['barricade', 'rubble_pile']);
        const debrisModels = this._propCandidates(cfg, ['rubble_pile', 'rusted_beam', 'barricade']);
        const sandbagModels = this._propCandidates(cfg, ['barricade', 'wall_segment', 'rubble_pile']);

        for (const [x, z] of (cfg.cratePositions || [])) {
            const count = 1 + (rng() * 3 | 0);
            for (let i = 0; i < count; i++) {
                const w = 0.6 + rng() * 0.6, h = 0.5 + rng() * 0.8, d = 0.6 + rng() * 0.6;
                const px = x + (rng() - 0.5) * 3, pz = z + (rng() - 0.5) * 3, yaw = rng() * Math.PI;
                const pick = crateModels.length ? crateModels[(rng() * crateModels.length) | 0] : null;
                const model = pick && this._instanceProp(cfg, pick, { w, h, d });
                // Solid either way. Nothing in this method registered collision,
                // so every crate, barrel and sandbag wall in every arena was
                // walk-through — including the plain boxes below, which are the
                // "procedural blocks you can pass through". Each instance is
                // registered at its own jittered position, not the authored one.
                this._pushObstacle(px, pz, w, d, yaw, h, CLUTTER_SHRINK);
                if (model) {
                    model.position.set(px, 0, pz);
                    model.rotation.y = yaw;
                    this.scene.add(model);
                    continue;
                }
                const crate = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), rng() > 0.5 ? crateMat : crateMatDk);
                crate.position.set(px, h / 2, pz);
                crate.rotation.y = yaw;
                crate.castShadow = crate.receiveShadow = true;
                this.scene.add(crate);
            }
        }
        for (const [x, z] of (cfg.barrelPositions || [])) {
            const count = 1 + (rng() * 2 | 0);
            for (let i = 0; i < count; i++) {
                const h = 0.9 + rng() * 0.3, r = 0.27 + rng() * 0.1;
                const px = x + (rng() - 0.5) * 2.5, pz = z + (rng() - 0.5) * 2.5;
                const toppled = rng() > 0.7, yaw = rng() * Math.PI;
                const pick = debrisModels.length ? debrisModels[(rng() * debrisModels.length) | 0] : null;
                const model = pick && this._instanceProp(cfg, pick, { w: r * 2, h, d: r * 2 });
                // A toppled barrel lies on its side: its footprint is the barrel's
                // length, and it is only as tall as its diameter.
                if (toppled) this._pushObstacle(px, pz, h, r * 2, yaw, r * 2, CLUTTER_SHRINK);
                else this._pushObstacle(px, pz, r * 2, r * 2, 0, h, CLUTTER_SHRINK);
                if (model) {
                    model.position.set(px, 0, pz);
                    model.rotation.y = yaw;
                    this.scene.add(model);
                    continue;
                }
                const barrel = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 10), barrelMats[rng() * barrelMats.length | 0]);
                barrel.position.set(px, 0.5, pz);
                if (toppled) { barrel.rotation.x = Math.PI / 2; barrel.position.y = 0.3; }
                barrel.rotation.y = yaw;
                barrel.castShadow = true;
                this.scene.add(barrel);
            }
        }
        for (const [x, z, ry] of (cfg.sandbagPositions || [])) {
            const w = 3 + rng() * 2, h = 0.8 + rng() * 0.4;
            const pick = sandbagModels.length ? sandbagModels[(rng() * sandbagModels.length) | 0] : null;
            const model = pick && this._instanceProp(cfg, pick, { w, h, d: 0.6, fit: 'footprint' });
            // Full footprint, no shrink — a sandbag wall is deliberate cover and
            // should block exactly where it looks like it blocks.
            this._pushObstacle(x, z, w, 0.6, ry, h);
            if (model) {
                model.position.set(x, 0, z);
                model.rotation.y = ry;
                this.scene.add(model);
                continue;
            }
            const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.6), sandbagMat);
            wall.position.set(x, 0.4, z); wall.rotation.y = ry;
            wall.castShadow = wall.receiveShadow = true;
            this.scene.add(wall);
        }
        for (const line of (cfg.fenceLines || [])) {
            // Support both {sx,sz,ex,ez,count} and {start:[x,z],end:[x,z]} schemas
            const sx = line.sx ?? line.start?.[0], sz = line.sz ?? line.start?.[1];
            const ex = line.ex ?? line.end?.[0], ez = line.ez ?? line.end?.[1];
            const count = line.count || 6;
            if (sx === undefined) continue;
            for (let i = 0; i < count; i++) {
                const t = i / (count - 1);
                const px = sx + (ex - sx) * t, pz = sz + (ez - sz) * t;
                const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.8, 6), poleMat);
                post.position.set(px, 0.9, pz); post.castShadow = true;
                this.scene.add(post);
                if (i < count - 1) {
                    const nx = sx + (ex - sx) * ((i + 1) / (count - 1));
                    const nz = sz + (ez - sz) * ((i + 1) / (count - 1));
                    const dx = nx - px, dz = nz - pz, len = Math.sqrt(dx * dx + dz * dz);
                    const wire = new THREE.Mesh(new THREE.BoxGeometry(len, 1.4, 0.02), wireMat);
                    wire.position.set((px + nx) / 2, 0.8, (pz + nz) / 2);
                    wire.rotation.y = Math.atan2(dx, dz);
                    this.scene.add(wire);
                }
            }
        }
    }

    // ── Explosive barrels (red, AOE on hit) ─────────────────────────
    _buildExplosiveBarrels(cfg) {
        const barrelMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.7, 0.15, 0.05), emissive: new THREE.Color(0.15, 0.02, 0), roughness: 0.6, metalness: 0.3 });
        const warnMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.8, 0.6, 0), emissive: new THREE.Color(0.1, 0.08, 0) });
        for (const [x, z] of (cfg.explosiveBarrelPositions || [])) {
            const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.325, 0.325, 1.0, 12), barrelMat);
            barrel.position.set(x, 0.5, z);
            barrel.castShadow = barrel.receiveShadow = true;
            barrel.userData = { isExplosiveBarrel: true, exploded: false, x, z };
            this.scene.add(barrel);
            const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.335, 0.335, 0.12, 12), warnMat);
            stripe.position.set(x, 0.55, z);
            this.scene.add(stripe);
            this.explosiveBarrels.push({ mesh: barrel, stripe, x, z, exploded: false });
        }
    }

    // ── Background structures ────────────────────────────────────────
    _buildBackgroundStructures(cfg) {
        const bg = cfg.background || {};
        const metalMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.2, 0.18, 0.16), metalness: 0.6, roughness: 0.5 });
        // Textured: the bunkers built from this material are large enough to
        // read as flat black primitives otherwise.
        const darkMat = this._trackMaterial(new THREE.MeshStandardMaterial({
            map: this._track(concreteTexture([0.19, 0.17, 0.15], 63)),
            color: new THREE.Color(0.62, 0.6, 0.58), roughness: 0.85,
            // These structures sit far back in shadow where almost no light
            // reaches them; without a faint self-lit floor they silhouette as
            // flat black boxes and the concrete detail is invisible.
            emissive: new THREE.Color(0.055, 0.05, 0.045), emissiveIntensity: 1,
        }));
        const redMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.5, 0.1, 0.05), emissive: new THREE.Color(0.1, 0.02, 0) });
        const warnMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.6, 0.5, 0.1), emissive: new THREE.Color(0.08, 0.06, 0) });

        for (const rp of (bg.rocketPositions || [])) {
            const root = new THREE.Group();
            root.position.set(rp.x, 0, rp.z); root.rotation.y = rp.ry || 0;
            const tower = new THREE.Mesh(new THREE.BoxGeometry(3, 28, 3), metalMat); tower.position.y = 14; root.add(tower);
            for (let h = 4; h < 26; h += 6) {
                const brace = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.2, 0.2), metalMat);
                brace.position.set(0, h, 0); brace.rotation.z = 0.4; root.add(brace);
            }
            const rocket = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 18, 10), darkMat); rocket.position.set(2.5, 12, 0); root.add(rocket);
            const nose = new THREE.Mesh(new THREE.ConeGeometry(1.1, 5, 10), redMat); nose.position.set(2.5, 23.5, 0); root.add(nose);
            for (let s = 0; s < 3; s++) {
                const stripe = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.3, 10), warnMat);
                stripe.position.set(2.5, 6 + s * 5, 0); root.add(stripe);
            }
            const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.4, 1.5, 10), darkMat); nozzle.position.set(2.5, 2.5, 0); root.add(nozzle);
            this.scene.add(root);
        }
        for (const bp of (bg.basePositions || [])) {
            const root = new THREE.Group(); root.position.set(bp.x, 0, bp.z); root.rotation.y = bp.ry || 0;
            const bw = 8 + Math.random() * 4, bh = 3 + Math.random() * 2, bd = 6 + Math.random() * 3;
            const bunkerGeo = new THREE.BoxGeometry(bw, bh, bd);
            scaleBoxUVs(bunkerGeo, bw, bh, bd);
            const bunker = new THREE.Mesh(bunkerGeo, darkMat); bunker.position.y = bh / 2; bunker.castShadow = true; root.add(bunker);
            const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3, 6), metalMat); antenna.position.y = bh + 1.5; root.add(antenna);
            const warn = new THREE.Mesh(new THREE.SphereGeometry(0.125, 6, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.1, 0) })); warn.position.y = bh + 3.1; root.add(warn);
            this.scene.add(root);
        }
        for (const rdp of (bg.radarPositions || [])) {
            const root = new THREE.Group(); root.position.set(rdp.x, 0, rdp.z);
            const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 8, 8), metalMat); ped.position.y = 4; root.add(ped);
            const dish = new THREE.Mesh(new THREE.SphereGeometry(3, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), metalMat);
            dish.position.y = 9; dish.rotation.x = -0.5; root.add(dish);
            this.scene.add(root);
            const offset = Math.random() * Math.PI * 2;
            this.updaters.push({ update: (dt, now) => { root.rotation.y = (rdp.ry || 0) + Math.sin(now * 0.0003 + offset) * 0.8; } });
        }
        for (const cp of (bg.commPositions || [])) {
            const root = new THREE.Group(); root.position.set(cp.x, 0, cp.z);
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.4, 22, 6), metalMat); pole.position.y = 11; root.add(pole);
            const topLight = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0, 0) })); topLight.position.y = 22.2; root.add(topLight);
            this.scene.add(root);
            const blinkOffset = Math.random() * 4000;
            this.updaters.push({ update: (dt, now) => { topLight.visible = ((now + blinkOffset) % 2000) < 300; } });
        }
        // Mars colony domes
        for (const dp of (bg.domePositions || [])) {
            const dome = new THREE.Mesh(new THREE.SphereGeometry(dp.r, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
                new THREE.MeshStandardMaterial({ color: new THREE.Color(0.4, 0.22, 0.12), emissive: new THREE.Color(0.03, 0.01, 0), transparent: true, opacity: 0.85, roughness: 0.4 }));
            dome.position.set(dp.x, 0, dp.z); this.scene.add(dome);
        }
        // Alien hull segments
        for (const hs of (bg.hullSegments || [])) {
            const hull = new THREE.Mesh(new THREE.BoxGeometry(12 * hs.scale, 6 * hs.scale, 20 * hs.scale),
                new THREE.MeshStandardMaterial({ color: new THREE.Color(0.08, 0.15, 0.12), emissive: new THREE.Color(0, 0.04, 0.02), roughness: 0.5, metalness: 0.4 }));
            hull.position.set(hs.x, 3 * hs.scale, hs.z); hull.rotation.set(0, hs.ry, 0.15); this.scene.add(hull);
        }
        // Alien crystals
        for (const cp of (bg.crystalPositions || [])) {
            const h = 8 + Math.random() * 12;
            const crystal = new THREE.Mesh(new THREE.ConeGeometry(0.75 + Math.random() * 0.5, h, 5),
                new THREE.MeshStandardMaterial({ color: new THREE.Color(0.05, 0.3, 0.2), emissive: new THREE.Color(0, 0.25, 0.15), transparent: true, opacity: 0.8 }));
            crystal.position.set(cp.x, h / 2, cp.z); crystal.rotation.z = (Math.random() - 0.5) * 0.3; this.scene.add(crystal);
        }
        // Desert dunes
        for (const dp of (bg.dunePositions || [])) {
            const dune = new THREE.Mesh(new THREE.SphereGeometry(15 * dp.scale, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.35),
                new THREE.MeshStandardMaterial({ color: new THREE.Color(0.6, 0.5, 0.3), roughness: 1 }));
            dune.position.set(dp.x, -2, dp.z); dune.scale.y = 0.3; this.scene.add(dune);
        }
    }

    // ── Fire pits (light + fire/smoke emitter) ──────────────────────
    _buildFirePits(cfg) {
        for (const pos of (cfg.firePitPositions || [])) {
            const x = Array.isArray(pos) ? pos[0] : pos.x;
            const z = Array.isArray(pos) ? pos[1] : pos.z;
            const rim = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.15, 12),
                new THREE.MeshStandardMaterial({ color: new THREE.Color(0.08, 0.07, 0.06), emissive: new THREE.Color(0.04, 0.02, 0) }));
            rim.position.set(x, 0.07, z); this.scene.add(rim);

            const fireLight = new THREE.PointLight(new THREE.Color(1.0, 0.45, 0.1), 6, 12, 2);
            fireLight.position.set(x, 1.5, z);
            this.scene.add(fireLight);
            const base = 4 + Math.random() * 2, off = Math.random() * Math.PI * 2;
            this.updaters.push({ update: (dt, now) => { const t = now * 0.003 + off; fireLight.intensity = base + Math.sin(t * 4.3) * 1.5 + Math.sin(t * 7.1) * 0.8; } });

            this.updaters.push(new ContinuousEmitter(this.pools.fire, {
                x, y: 0.2, z, rate: 60, perEmit: 1, jitter: 0.8, spread: 0.6, speed: 1.6, up: 1.5,
                life: [0.4, 1.0], size0: 1.4, size1: 0.2, color0: [1, 0.6, 0.1, 1], color1: [0.3, 0.1, 0, 0],
            }));
            this.updaters.push(new ContinuousEmitter(this.pools.smoke, {
                x, y: 2.0, z, rate: 8, perEmit: 1, jitter: 0.5, spread: 0.5, speed: 1.2, up: 2,
                life: [2, 5], size0: 1.5, size1: 5, color0: [0.25, 0.22, 0.2, 0.6], color1: [0.1, 0.1, 0.1, 0],
            }));
            this.firePits.push({ x, z, light: fireLight });
        }
    }

    // ── Heavy smoke columns ─────────────────────────────────────────
    _buildSmokeColumns(cfg) {
        for (const pos of (cfg.smokeColumns || [])) {
            const x = Array.isArray(pos) ? pos[0] : pos.x;
            const z = Array.isArray(pos) ? pos[1] : pos.z;
            const scale = Array.isArray(pos) ? (pos[2] ?? 1) : (pos.scale ?? 1);
            this.updaters.push(new ContinuousEmitter(this.pools.smoke, {
                x, y: 2, z, rate: 8 * scale, perEmit: 1, jitter: 1.5 * scale, spread: 0.3, speed: 2, up: 2.5,
                life: [5, 14], size0: 3 * scale, size1: 10 * scale, color0: [0.15, 0.14, 0.13, 0.8], color1: [0.05, 0.05, 0.05, 0],
            }));
        }
    }

    // ── Sky (equirect texture or procedural) ────────────────────────
    _buildSky(cfg) {
        const sky = cfg.sky;
        const apply = (tex) => { this.scene.background = tex; };
        if (sky.type === 'equirectangular' && sky.textureUrl) {
            _texLoader.load(withVersion(SCENE_TEXTURE_BASE + sky.textureUrl), (tex) => {
                tex.mapping = THREE.EquirectangularReflectionMapping;
                tex.colorSpace = THREE.SRGBColorSpace;
                apply(tex);
            }, undefined, () => { apply(proceduralSkyTexture(sky)); });
        } else {
            apply(proceduralSkyTexture(sky));
        }
        if (sky.creon) this._buildCreon(sky.creon);
        if (sky.hasLightning) {
            let nextFlash = performance.now() + 8000 + Math.random() * 15000;
            const flashLight = new THREE.PointLight(new THREE.Color(0.9, 0.9, 1.0), 0, 80);
            flashLight.position.set(0, 30, -50);
            this.scene.add(flashLight);
            let flashUntil = 0;
            this.updaters.push({ update: (dt, now) => {
                const realNow = performance.now();
                if (realNow > nextFlash) {
                    nextFlash = realNow + 12000 + Math.random() * 20000;
                    flashLight.position.set((Math.random() - 0.5) * 120, 30, -40 - Math.random() * 40);
                    flashLight.intensity = 6 + Math.random() * 6;
                    flashUntil = realNow + 80 + Math.random() * 60;
                }
                if (flashLight.intensity > 0 && realNow > flashUntil) flashLight.intensity = 0;
            } });
        }
    }

    // ── CREON — the orbital relay watching the arena ────────────────
    // A camera-locked billboard, not world geometry: it sits at a fixed offset
    // from the player so it always reads as far away on the horizon and can
    // never be walked up to, clipped through, or shot. fog:false keeps it from
    // being dissolved by the scene's FogExp2 at that apparent distance.
    _buildCreon(cc) {
        const url = (cc.textureUrl && cc.textureUrl.startsWith('http')) ? cc.textureUrl : ASSET_BASE + (cc.textureUrl || 'art/creon-machine-wars.png');
        const size = cc.size || 260;
        const mat = new THREE.MeshBasicMaterial({
            transparent: true, opacity: 0, depthWrite: false, depthTest: false,
            fog: false, color: col3(cc.tint || [1, 1, 1]), blending: THREE.NormalBlending,
        });
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
        plane.renderOrder = -1;          // behind everything, above the sky
        plane.frustumCulled = false;
        this.scene.add(plane);
        this._disposables.push(plane.geometry, mat);

        _texLoader.load(withVersion(url), (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            const cropped = creonFaceTexture(tex, cc);
            mat.map = cropped;
            mat.opacity = cc.opacity != null ? cc.opacity : 0.85;
            mat.needsUpdate = true;
            this._disposables.push(cropped);
            tex.dispose(); // the crop owns its own canvas texture now
        }, undefined, () => { /* art missing: leave the sky untouched */ });

        // Keep it pinned relative to the camera each frame.
        const az = cc.azimuth != null ? cc.azimuth : Math.PI;   // default: behind spawn, ahead of the player's view
        const el = cc.elevation != null ? cc.elevation : 0.42;  // radians above horizon
        // Must stay inside the camera's far plane or it is clipped and never
        // drawn — keep a margin rather than trusting the configured value.
        const far = (this.camera && this.camera.far) || 400;
        const dist = Math.min(cc.distance || 300, far * 0.8);
        const sway = cc.sway != null ? cc.sway : 0.015;
        const cam = this.camera;
        this.updaters.push({ update: (dt, now) => {
            if (!cam) return;
            const t = now * 0.001;
            const a = az + Math.sin(t * 0.05) * sway;
            const horiz = Math.cos(el) * dist;
            plane.position.set(
                cam.position.x + Math.sin(a) * horiz,
                cam.position.y + Math.sin(el) * dist + Math.sin(t * 0.11) * (size * 0.006),
                cam.position.z + Math.cos(a) * horiz,
            );
            plane.lookAt(cam.position);
            // Slow pulse so it reads as a live presence rather than a pasted decal.
            if (mat.map) mat.opacity = (cc.opacity != null ? cc.opacity : 0.85) * (0.92 + Math.sin(t * 0.7) * 0.08);
        } });
    }

    // ── Scene-specific particle effects ─────────────────────────────
    _buildSceneSpecificEffects(cfg) {
        for (const dd of (cfg.dustDevils || [])) {
            this.updaters.push(new ContinuousEmitter(this.pools.smoke, {
                x: dd.x, y: 0.5, z: dd.z, rate: 12 * dd.scale, perEmit: 1, jitter: 2 * dd.scale, spread: 1, speed: 3, up: 3,
                life: [2, 6], size0: 1.5 * dd.scale, size1: 5 * dd.scale, color0: [0.55, 0.35, 0.18, 0.6], color1: [0.35, 0.2, 0.1, 0],
            }));
        }
        for (const bs of (cfg.bioSpores || [])) {
            this.updaters.push(new ContinuousEmitter(this.pools.fire, {
                x: bs.x, y: 0.5, z: bs.z, rate: 8 * bs.scale, perEmit: 1, jitter: 3 * bs.scale, spread: 0.3, speed: 0.8, up: 1.5,
                life: [3, 8], size0: 0.1, size1: 0.5, color0: [0, 0.8, 0.4, 0.6], color1: [0, 0.2, 0.1, 0],
            }));
        }
        for (const gp of (cfg.glowPools || [])) {
            const pool = new THREE.Mesh(new THREE.CircleGeometry(gp.r, 16),
                new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 0.2, 0.12), transparent: true, opacity: 0.6 }));
            pool.rotation.x = -Math.PI / 2; pool.position.set(gp.x, 0.05, gp.z); this.scene.add(pool);
            const off = Math.random() * Math.PI * 2;
            this.updaters.push({ update: (dt, now) => { const t = now * 0.001 + off; pool.material.color.setRGB(0, 0.15 + Math.sin(t) * 0.08, 0.08 + Math.sin(t) * 0.05); } });
        }
        if (cfg.sandParticles && cfg.sandParticles.enabled) {
            const wd = cfg.sandParticles.windDirection || [1.5, 0.1, 0.3];
            const sc = cfg.sandParticles.color || [0.6, 0.5, 0.3];
            this.updaters.push({ update: (dt) => {
                this.pools.smoke.emit(2, {
                    x: -60 + Math.random() * 120, y: Math.random() * 8, z: -60 + Math.random() * 120,
                    spread: 0.3, speed: 2 + wd[0], up: 0.3, life: [3, 8], size0: 0.5, size1: 2,
                    color0: [sc[0], sc[1], sc[2], 0.15], color1: [sc[0], sc[1], sc[2], 0],
                });
            } });
        }
    }

    // ── Outer-ring fill ─────────────────────────────────────────────
    // The authored placements were laid out for a much smaller arena. Now that
    // the perimeter reaches further, the band between the old layout and the
    // wall would read as bare ground, so scatter more of the scene's own assets
    // out there. Deterministic (seeded) so an arena looks the same every load,
    // and kept clear of the player's start and the spawn approach.
    _outerRingPlacements(cfg, sceneAssets) {
        const out = new Map();
        const names = Object.keys(sceneAssets);
        if (!names.length) return out;

        const hw = cfg.perimeter.halfW, hd = cfg.perimeter.halfD;
        // Where the authored layout actually ends, measured rather than assumed.
        // A hardcoded 46 leaves a gap in any scene whose hand-placed props stop
        // short of it, and overlaps the layout in any scene that reaches past.
        const inner = this._authoredExtent(cfg);
        const outerW = hw - 8, outerD = hd - 8; // stay off the wall
        if (outerW <= inner) return out;

        const rng = seededRandom((cfg.ground && cfg.ground.displacementSeed) || 7);
        const start = cfg.playerStart || { x: 0, z: 0 };
        // Prefer big silhouettes further out; they read as skyline, not clutter.
        const big = names.filter((n) => (sceneAssets[n].scale || 0) >= 10);
        const small = names.filter((n) => (sceneAssets[n].scale || 0) < 10);

        const taken = [];
        // Ring area is the full annulus, not one quadrant. `outerW`/`outerD`/
        // `inner` are all half-extents, so the previous
        // `outerW*outerD - inner*inner` was a quarter of the real area — warzone
        // asked for 5 props to fill 17,136 sq units, which is what left the
        // enlarged arena looking bare.
        const ringArea = 4 * ((outerW * outerD) - (inner * inner));
        // Two passes: sparse large silhouettes that read as skyline, then denser
        // small cover so the outer band is somewhere to fight, not just scenery.
        const passes = [
            { count: Math.round(ringArea / 950), pool: big.length ? big : names, spacing: 14 },
            { count: Math.round(ringArea / 420), pool: small.length ? small : names, spacing: 7 },
        ];

        for (const pass of passes) {
            // Retry on rejection instead of skipping. Rejections used to consume
            // an iteration outright, so the realized count fell well below target.
            let placed = 0;
            for (let attempt = 0; placed < pass.count && attempt < pass.count * 8; attempt++) {
                // Sample the ring directly. Sampling the whole square and pushing
                // strays outward scattered props thinly across the entire arena
                // instead of concentrating them in the empty band.
                let x, z;
                if (rng() < 0.5) {
                    x = (rng() < 0.5 ? -1 : 1) * (inner + rng() * (outerW - inner));
                    z = (rng() * 2 - 1) * outerD;
                } else {
                    x = (rng() * 2 - 1) * outerW;
                    z = (rng() < 0.5 ? -1 : 1) * (inner + rng() * (outerD - inner));
                }
                if (Math.hypot(x - start.x, z - start.z) < 30) continue;
                let clash = false;
                for (const t of taken) { if (Math.hypot(x - t[0], z - t[1]) < pass.spacing) { clash = true; break; } }
                if (clash) continue;
                taken.push([x, z]);
                placed++;

                const name = pass.pool[(rng() * pass.pool.length) | 0];
                if (!out.has(name)) out.set(name, []);
                out.get(name).push({ x, z, ry: rng() * Math.PI * 2 });
            }
        }
        return out;
    }

    // Where the scene's hand-authored content effectively ends, so the outer
    // fill knows where to start.
    //
    // This is a high percentile, not the maximum. Most scenes place a handful of
    // large silhouettes far out on one side (warzone has 7 of 73 past radius 50,
    // all in the north) while the other ~90% of the layout stops well short.
    // Taking the max lets those outliers speak for the whole arena and collapses
    // the ring to nothing; the percentile tracks where the bulk actually ends.
    _authoredExtent(cfg) {
        const radii = [];
        const add = (x, z) => radii.push(Math.max(Math.abs(x), Math.abs(z)));
        for (const ac of Object.values(cfg.sceneAssets || {})) {
            for (const p of (ac.placements || [])) add(p.x, p.z);
        }
        for (const [x, z] of (cfg.coverBlocks || [])) add(x, z);
        for (const [x, z] of (cfg.cratePositions || [])) add(x, z);
        for (const [x, z] of (cfg.barrelPositions || [])) add(x, z);
        if (!radii.length) return 46;
        radii.sort((a, b) => a - b);
        const p85 = radii[Math.min(radii.length - 1, Math.floor(radii.length * 0.85))];
        return p85 + 6;
    }

    // ── GLB scene assets (async, cloned per placement) ──────────────
    async _loadSceneGLBs(cfg) {
        const sceneAssets = cfg.sceneAssets || {};
        const names = Object.keys(sceneAssets);
        // One decode at a time. Starting every Draco decode together causes
        // renderer stalls on phones and made the whole set fall back to boxes.
        for (const name of names) {
            const ac = sceneAssets[name];
            if (_glbCache[ac.file]) continue;
            try {
                // Cache keys stay keyed on the bare filename (_glbCache above);
                // only the fetch URL carries the build id.
                const gltf = await loadGLB(withVersion(SCENE_MODEL_BASE + ac.file));
                _glbCache[ac.file] = registerTemplate(gltf.scene);
            } catch (e) {
                console.warn('[V2] GLB load failed — procedural fallback:', ac.file, e.message);
            }
        }
        if (this._disposed) return;
        const outer = this._outerRingPlacements(cfg, sceneAssets);
        for (const name of names) {
            const ac = sceneAssets[name];
            const tint = ac.tint || { d: [0.3, 0.28, 0.25], e: [0.02, 0.01, 0] };
            let src = _glbCache[ac.file];
            if (!src) {
                // Build a low-poly silhouette so the arena stays populated.
                if (!_fallbackCache[name]) _fallbackCache[name] = registerTemplate(_buildFallbackTemplate(name, tint));
                src = _fallbackCache[name];
            }
            // Footprint of the unrotated, unscaled model — measured once per asset
            // so each placement only has to apply its own scale/rotation.
            const baseBox = new THREE.Box3().setFromObject(src);
            const baseSize = baseBox.getSize(new THREE.Vector3());
            // Tint the GLB's own materials rather than replacing them: the old
            // code assigned a flat MeshStandardMaterial to every mesh, throwing
            // away each model's baked baseColor texture, which is what made the
            // real assets look like untextured procedural boxes. Materials are
            // shared across this asset's placements (one clone per asset).
            const isGLB = !!_glbCache[ac.file];
            const matCache = new Map();
            const tintOf = (src0) => {
                let m = matCache.get(src0);
                if (m) return m;
                m = src0.clone();
                if (m.map) m.color.lerp(col3(tint.d), 0.35);
                else m.color = col3(tint.d);
                m.emissive = col3(tint.e);
                matCache.set(src0, m);
                this._trackMaterial(m);
                return m;
            };
            const flatMat = new THREE.MeshStandardMaterial({ color: col3(tint.d), emissive: col3(tint.e), roughness: 0.85, metalness: 0.1 });
            this._trackMaterial(flatMat);
            const placements = ac.placements.concat(outer.get(name) || []);
            for (const p of placements) {
                const root = src.clone(true);
                root.position.set(p.x, 0, p.z);
                root.rotation.y = p.ry || 0;
                root.scale.setScalar(ac.scale);
                root.traverse((o) => {
                    if (!o.isMesh) return;
                    o.material = isGLB ? tintOf(o.material) : flatMat;
                    o.castShadow = true; o.receiveShadow = true;
                });
                this.scene.add(root);
                // These props are solid geometry, but nothing here registered them
                // as obstacles — the player walked straight through every ruin,
                // wreck and barricade. Register the rotated AABB footprint, matching
                // how _buildCoverBlocks() derives its own.
                if (ac.noCollide) continue;
                // Shrink slightly: the AABB of an irregular ruin overstates its
                // solid core, and an oversized box blocks doorways and gaps.
                this._pushObstacle(
                    p.x, p.z,
                    baseSize.x * ac.scale, baseSize.z * ac.scale,
                    p.ry || 0,
                    baseSize.y * ac.scale,
                    ac.collideScale ?? 0.8,
                );
            }
        }
        // Vehicle fires
        for (const vf of (cfg.vehicleFirePositions || [])) {
            this.updaters.push(new ContinuousEmitter(this.pools.fire, {
                x: vf.x, y: 2.0, z: vf.z, rate: 25, perEmit: 1, jitter: 1, spread: 0.4, speed: 1.5, up: 1.5,
                life: [0.3, 0.8], size0: 1, size1: 0.3, color0: [1, 0.5, 0.1, 0.9], color1: [0.2, 0.05, 0, 0],
            }));
        }
    }

    update(dt, now) {
        for (const u of this.updaters) u.update(dt, now);
        this.pools.fire.update(dt);
        this.pools.smoke.update(dt);
        this.pools.spark.update(dt);
    }

    dispose() {
        this._disposed = true;
        // _glbCache / _fallbackCache templates are module-level and reused by
        // the next World; Object3D.clone() shares their geometry and materials
        // by reference, so freeing everything reachable from the scene graph
        // would blank out every prop after a scene switch. Dispose only what
        // this World allocated.
        this.scene.traverse((o) => {
            if (o.geometry && !_templateGeos.has(o.geometry)) o.geometry.dispose();
        });
        for (const m of this._ownMaterials) m.dispose();
        this._ownMaterials = [];
        // Keyed by template material, valued by this World's disposed clones —
        // holding it would hand the next World dead materials.
        this._propMatCache = null;
        // Textures/geometry/materials registered via _track() are this World's
        // own (canvas textures, the CREON billboard) — nothing shares them.
        for (const d of this._disposables) { if (d && typeof d.dispose === 'function') d.dispose(); }
        this._disposables = [];
        for (const k in this.pools) this.pools[k].dispose();
        this.updaters = []; this.obstacles = []; this.firePits = []; this.explosiveBarrels = [];
    }
}
