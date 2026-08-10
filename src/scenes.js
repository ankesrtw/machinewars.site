/* ═══════════════════════════════════════════════════════════════════
   AUTONOMOUS WAR V2 — scenes.js (environment builder, Three.js + PBR)
   Consumes SCENE_CONFIGS data and builds the 3D world. Ported from the
   Babylon buildScene()/buildGround()/buildPerimeterWalls()/... family.
   ═══════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { dracoLoader } from './gltf.js';
import { SCENE_CONFIGS, DEFAULT_SCENE, SCENE_MODEL_BASE, SCENE_TEXTURE_BASE } from './scenes-data.js';
import {
    seededRandom, proceduralGroundTexture, proceduralSkyTexture,
    fireTexture, smokeTexture, ParticlePool, ContinuousEmitter,
} from './fx.js';

export { SCENE_CONFIGS, DEFAULT_SCENE };

const _gltfLoader = new GLTFLoader().setDRACOLoader(dracoLoader);
const _texLoader = new THREE.TextureLoader();
const _glbCache = {}; // file -> gltf scene (cloned per placement)

function col3(a) { return new THREE.Color(a[0], a[1], a[2]); }

/* The World holds everything built for the active scene + per-frame updaters. */
export class World {
    constructor(renderer) {
        this.renderer = renderer;
        this.scene = new THREE.Scene();
        this.updaters = [];        // [{update(dt, now)}]
        this.obstacles = [];       // {x,z,hw,hd}
        this.firePits = [];        // {x,z,light}
        this.explosiveBarrels = [];// {mesh,stripe,x,z,exploded}
        this.pools = {};           // particle pools
        this.sun = null;
        this.cfg = null;
        this._disposables = [];
    }

    _track(obj) { this._disposables.push(obj); return obj; }

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
        this._buildCoverBlocks(cfg);
        this._buildProceduralProps(cfg);
        this._buildExplosiveBarrels(cfg);
        this._buildBackgroundStructures(cfg);
        this._buildFirePits(cfg);
        this._buildSmokeColumns(cfg);
        this._buildSky(cfg);
        this._buildSceneSpecificEffects(cfg);
        this._loadSceneGLBs(cfg); // async; populates as it resolves

        return cfg;
    }

    // ── Lighting ────────────────────────────────────────────────────
    _buildLighting(cfg, quality) {
        const lc = cfg.lighting;
        const hemi = new THREE.HemisphereLight(
            col3(lc.ambientDiffuse), col3(lc.ambientGround), lc.ambientIntensity * 1.4);
        this.scene.add(hemi);

        const sun = new THREE.DirectionalLight(col3(lc.sunDiffuse), lc.sunIntensity * 1.6);
        const sd = lc.sunDirection;
        sun.position.set(-sd[0] * 60, -sd[1] * 60, -sd[2] * 60);
        sun.castShadow = true;
        sun.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
        const cam = sun.shadow.camera;
        cam.near = 1; cam.far = 200;
        cam.left = -70; cam.right = 70; cam.top = 70; cam.bottom = -70;
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
            _texLoader.load(SCENE_TEXTURE_BASE + gc.textureUrl, (tex) => {
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

        // Slab patches
        const slabColor = gc.slabColor || [0.35, 0.28, 0.22];
        const slabMat = new THREE.MeshStandardMaterial({ color: col3(slabColor), roughness: 0.9 });
        for (const [x, z] of (gc.slabPositions || [])) {
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
        const wallMat = new THREE.MeshStandardMaterial({ color: col3(cfg.wallColor || [0.25, 0.22, 0.18]), roughness: 0.85 });
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
            const wall = new THREE.Mesh(new THREE.BoxGeometry(s.w, wallH, s.d), wallMat);
            wall.position.set(s.cx, wallH / 2, s.cz);
            wall.castShadow = wall.receiveShadow = true;
            wall.userData = { isObstacle: true };
            this.scene.add(wall);
            this.obstacles.push({ x: s.cx, z: s.cz, hw: s.w / 2, hd: s.d / 2 });
        }
        // Gate pillars + warning lights
        const pillarMat = new THREE.MeshStandardMaterial({ color: col3(cfg.pillarColor || [0.3, 0.25, 0.2]), roughness: 0.8, emissive: new THREE.Color(0.03, 0.02, 0.01) });
        for (const gx of [-gateHalf, gateHalf]) {
            const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.5, wallH + 1.5, 1.5), pillarMat);
            pillar.position.set(gx, (wallH + 1.5) / 2, -hd);
            pillar.castShadow = pillar.receiveShadow = true;
            pillar.userData = { isObstacle: true };
            this.scene.add(pillar);
            const light = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8),
                new THREE.MeshBasicMaterial({ color: new THREE.Color(0.8, 0.2, 0.0) }));
            light.position.set(gx, wallH + 1.8, -hd);
            this.scene.add(light);
        }
    }

    // ── Cover blocks (solid obstacles) ──────────────────────────────
    _buildCoverBlocks(cfg) {
        const cc = cfg.coverColors || { light: [0.32, 0.28, 0.22], dark: [0.2, 0.18, 0.15] };
        const matL = new THREE.MeshStandardMaterial({ color: col3(cc.light), roughness: 0.85 });
        const matD = new THREE.MeshStandardMaterial({ color: col3(cc.dark), roughness: 0.9 });
        for (const [x, z, w, d, h, ry] of (cfg.coverBlocks || [])) {
            const block = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), Math.random() > 0.5 ? matL : matD);
            block.position.set(x, h / 2, z);
            block.rotation.y = ry;
            block.castShadow = block.receiveShadow = true;
            block.userData = { isObstacle: true };
            this.scene.add(block);
            const cosR = Math.abs(Math.cos(ry)), sinR = Math.abs(Math.sin(ry));
            this.obstacles.push({ x, z, hw: (w * cosR + d * sinR) / 2, hd: (w * sinR + d * cosR) / 2 });
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

        for (const [x, z] of (cfg.cratePositions || [])) {
            const count = 1 + (rng() * 3 | 0);
            for (let i = 0; i < count; i++) {
                const w = 0.6 + rng() * 0.6, h = 0.5 + rng() * 0.8, d = 0.6 + rng() * 0.6;
                const crate = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), rng() > 0.5 ? crateMat : crateMatDk);
                crate.position.set(x + (rng() - 0.5) * 3, h / 2, z + (rng() - 0.5) * 3);
                crate.rotation.y = rng() * Math.PI;
                crate.castShadow = crate.receiveShadow = true;
                this.scene.add(crate);
            }
        }
        for (const [x, z] of (cfg.barrelPositions || [])) {
            const count = 1 + (rng() * 2 | 0);
            for (let i = 0; i < count; i++) {
                const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.27 + rng() * 0.1, 0.27 + rng() * 0.1, 0.9 + rng() * 0.3, 10), barrelMats[rng() * barrelMats.length | 0]);
                barrel.position.set(x + (rng() - 0.5) * 2.5, 0.5, z + (rng() - 0.5) * 2.5);
                if (rng() > 0.7) { barrel.rotation.x = Math.PI / 2; barrel.position.y = 0.3; }
                barrel.rotation.y = rng() * Math.PI;
                barrel.castShadow = true;
                this.scene.add(barrel);
            }
        }
        for (const [x, z, ry] of (cfg.sandbagPositions || [])) {
            const wall = new THREE.Mesh(new THREE.BoxGeometry(3 + rng() * 2, 0.8 + rng() * 0.4, 0.6), sandbagMat);
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
        const darkMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.12, 0.11, 0.10), roughness: 0.7 });
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
            const bunker = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), darkMat); bunker.position.y = bh / 2; bunker.castShadow = true; root.add(bunker);
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
            _texLoader.load(SCENE_TEXTURE_BASE + sky.textureUrl, (tex) => {
                tex.mapping = THREE.EquirectangularReflectionMapping;
                tex.colorSpace = THREE.SRGBColorSpace;
                apply(tex);
            }, undefined, () => { apply(proceduralSkyTexture(sky)); });
        } else {
            apply(proceduralSkyTexture(sky));
        }
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

    // ── GLB scene assets (async, cloned per placement) ──────────────
    async _loadSceneGLBs(cfg) {
        const sceneAssets = cfg.sceneAssets || {};
        const names = Object.keys(sceneAssets);
        await Promise.all(names.map(async (name) => {
            const ac = sceneAssets[name];
            if (_glbCache[ac.file]) return;
            try {
                const gltf = await _gltfLoader.loadAsync(SCENE_MODEL_BASE + ac.file);
                _glbCache[ac.file] = gltf.scene;
            } catch (e) { console.warn('[V2] GLB load failed', ac.file, e.message); }
        }));
        if (this._disposed) return;
        for (const name of names) {
            const ac = sceneAssets[name];
            const src = _glbCache[ac.file];
            if (!src) continue;
            const tint = ac.tint || { d: [0.3, 0.28, 0.25], e: [0.02, 0.01, 0] };
            const tintMat = new THREE.MeshStandardMaterial({ color: col3(tint.d), emissive: col3(tint.e), roughness: 0.85, metalness: 0.1 });
            for (const p of ac.placements) {
                const root = src.clone(true);
                root.position.set(p.x, 0, p.z);
                root.rotation.y = p.ry || 0;
                root.scale.setScalar(ac.scale);
                root.traverse((o) => { if (o.isMesh) { o.material = tintMat; o.castShadow = true; o.receiveShadow = true; } });
                this.scene.add(root);
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
        this.scene.traverse((o) => {
            if (o.geometry) o.geometry.dispose();
            if (o.material) { const m = o.material; (Array.isArray(m) ? m : [m]).forEach((mm) => mm.dispose()); }
        });
        for (const k in this.pools) this.pools[k].dispose();
        this.updaters = []; this.obstacles = []; this.firePits = []; this.explosiveBarrels = [];
    }
}
