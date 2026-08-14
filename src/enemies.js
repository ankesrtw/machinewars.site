/* ═══════════════════════════════════════════════════════════════════
   MACHINE WARS — enemies.js (Three.js)
   GLB robot models, wave spawner, seek AI, hit logic.
   Decoupled from the game core via an injected `ctx` (see setContext):
     ctx.scene, ctx.camera, ctx.pools, ctx.audio, ctx.AW,
     ctx.onPlayerDamage, ctx.addScore, ctx.checkKillStreak,
     ctx.spawnExplosion, ctx.checkCollision, ctx.spawnEnemyTracer
   ═══════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { loadGLB } from './gltf.js';
import { SCENE_MODEL_BASE } from './scenes-data.js';
import { withVersion } from './version.js';

const _modelCache = {}; // type -> gltf.scene template
const ENEMY_UP = new THREE.Vector3(0, 1, 0);

// Procedural robot fallbacks — merged per type so every instance is just
// one shared geometry + two meshes (body + glow). Shared geos are never
// disposed per-enemy (see dispose()).
const _fbRobotGeo = {};   // type -> merged BufferGeometry (solid body)
const _fbRobotGlow = {};  // type -> merged BufferGeometry (visors/eyes)
const _sharedGeos = new Set();
// Object3D.clone() shares BufferGeometry by reference, so every enemy cloned
// from a GLB template points at the template's geometry. Disposing it with the
// first corpse would blank out every robot spawned afterwards.
const _templateGeos = new Set();

let ctx = null;
export function setContext(c) { ctx = c; }

function col(a) { return new THREE.Color(a[0], a[1], a[2]); }

// ── Procedural robot geometry builders ─────────────────────────────
// Low-poly primitives per type, merged into ONE BufferGeometry per type
// (body) plus one for glowing visors/eyes. Every enemy instance of a type
// shares the same geometry, so the fallback costs only 2 draw calls and
// one small allocation per enemy. No textures, flat materials only.
const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();

function _place(geo, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    _e.set(rx, ry, rz); _q.setFromEuler(_e);
    _v.set(x, y, z);
    const g = geo.clone();
    g.applyMatrix4(_m4.compose(_v, _q, new THREE.Vector3(sx, sy, sz)));
    return g;
}

function _mergeParts(parts) {
    const arr = [];
    for (const p of parts) arr.push(_place(p.geo, p.x, p.y, p.z, p.rx, p.ry, p.rz, p.sx, p.sy, p.sz));
    const merged = mergeGeometries(arr, false);
    for (const g of arr) g.dispose();
    return merged;
}

function _box(w, h, d) { return new THREE.BoxGeometry(w, h, d); }
function _cyl(rT, rB, h, seg = 6) { return new THREE.CylinderGeometry(rT, rB, h, seg); }
function _cone(r, h, seg = 6) { return new THREE.ConeGeometry(r, h, seg); }
function _sph(r, ws = 8, hs = 6) { return new THREE.SphereGeometry(r, ws, hs); }

// Biped ground walker — shared base, per-type proportions. Total height
// lands ~1.25–1.4 × hitboxH so the silhouette matches the GLB scale.
function _walkerGeo(cfg, opts) {
    const H = cfg.hitboxH;
    const o = Object.assign({ torsoScale: 1, gun: false, shoulder: false, quad: false }, opts);
    const parts = [], glow = [];
    // legs
    const legL = H * 0.42, legW = H * (o.quad ? 0.1 : 0.075);
    const legX = H * (o.quad ? 0.2 : 0.11), hipY = H * 0.46;
    for (const s of [-1, 1]) {
        // foot
        parts.push({ geo: _box(legW * 0.9, H * 0.06, legW * 1.6), x: s * legX, y: H * 0.03, z: 0 });
        if (o.quad) {
            const l2x = s > 0 ? 1 : -1;
            parts.push({ geo: _cyl(legW * 0.7, legW, legL, 5), x: s * legX, y: hipY - legL / 2, z: l2x * H * 0.1, rx: l2x * 0.18 });
            parts.push({ geo: _cyl(legW * 0.7, legW, legL, 5), x: s * legX, y: hipY - legL / 2, z: -l2x * H * 0.1, rx: -l2x * 0.18 });
        } else {
            parts.push({ geo: _cyl(legW * 0.8, legW, legL, 5), x: s * legX, y: hipY - legL / 2, z: 0 });
            parts.push({ geo: _box(legW * 1.1, H * 0.07, legW * 1.1), x: s * legX, y: H * 0.12, z: 0 }); // knee
        }
    }
    // pelvis + chest
    const bodyW = H * 0.34 * o.torsoScale, chestH = H * 0.3 * (o.quad ? 0.9 : 1);
    const bodyY = hipY + chestH / 2 + H * 0.03;
    parts.push({ geo: _box(H * 0.3 * o.torsoScale, H * 0.14, H * 0.22), x: 0, y: hipY - H * 0.03, z: 0 }); // pelvis
    parts.push({ geo: _box(bodyW, chestH, H * 0.24), x: 0, y: bodyY, z: 0 }); // chest
    parts.push({ geo: _box(bodyW * 0.92, chestH * 0.5, H * 0.04), x: 0, y: bodyY + chestH * 0.26, z: H * 0.12 }); // front plate
    if (o.shoulder) {
        for (const s of [-1, 1]) parts.push({ geo: _box(H * 0.18 * o.torsoScale, H * 0.1, H * 0.15), x: s * bodyW * 0.72, y: bodyY + chestH * 0.28, z: 0 });
    }
    // arms
    const armL = H * 0.42, armW = H * (o.quad ? 0.09 : 0.06);
    if (!o.quad) {
        for (const s of [-1, 1]) {
            parts.push({ geo: _cyl(armW, armW * 0.8, armL, 5), x: s * bodyW * 0.85, y: bodyY + chestH * 0.2 - armL / 2 + H * 0.08, z: 0, rx: s * 0.18 });
            parts.push({ geo: _box(H * 0.05, H * 0.16, H * 0.1), x: s * bodyW * 0.95, y: bodyY - chestH * 0.2 - H * 0.08, z: 0 }); // claw
        }
    }
    // head + visor
    const headW = H * 0.18 * o.torsoScale, headH = H * 0.16;
    const headY = bodyY + chestH / 2 + headH / 2 + H * 0.02;
    parts.push({ geo: _box(headW, headH, headW), x: 0, y: headY, z: 0 });
    parts.push({ geo: _box(headW * 0.72, headH * 0.4, headW * 0.6), x: 0, y: headY, z: 0 }); // helmet
    glow.push({ geo: _box(headW * 1.15, H * 0.05, H * 0.015), x: 0, y: headY - H * 0.03, z: headW * 0.52 }); // visor
    // weapons
    if (o.gun) {
        const len = H * (o.quad ? 0.32 : 0.55);
        parts.push({ geo: _cyl(H * 0.035, H * 0.04, len, 5), x: bodyW * 0.3, y: bodyY + chestH * 0.22, z: H * 0.28, rx: Math.PI / 2 });
        parts.push({ geo: _cone(H * 0.038, H * 0.1, 5), x: bodyW * 0.3, y: bodyY + chestH * 0.22, z: H * 0.28 + len / 2 + H * 0.05, rx: Math.PI / 2 });
    }
    if (o.twinGun) {
        for (const s of [-1, 1]) {
            const len = H * 0.45;
            parts.push({ geo: _cyl(H * 0.04, H * 0.045, len, 5), x: s * bodyW * 0.34, y: bodyY + chestH * 0.26, z: H * 0.3, rx: Math.PI / 2 });
        }
    }
    return { body: _mergeParts(parts), glow: _mergeParts(glow) };
}

function _buildRobotGeometries(type, cfg) {
    switch (type) {
        case 'scout':
            return _walkerGeo(cfg, { torsoScale: 1, gun: true });
        case 'grunt':
            return _walkerGeo(cfg, { torsoScale: 1.25, gun: true, shoulder: true });
        case 'heavy':
            return _walkerGeo(cfg, { torsoScale: 1.55, quad: true, shoulder: true, twinGun: true });
        case 'drone': {
            const R = cfg.hitboxH / 2;
            const parts = [], glow = [];
            parts.push({ geo: _cyl(R * 0.95, R * 0.95, R * 0.32, 6), x: 0, y: 0, z: 0 }); // core
            parts.push({ geo: _sph(R * 0.5, 8, 5), x: 0, y: R * 0.3, z: 0 }); // dome
            for (let i = 0; i < 4; i++) {
                const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
                parts.push({ geo: _box(R * 1.6, R * 0.1, R * 0.16), x: Math.cos(a) * R * 0.75, y: -R * 0.05, z: Math.sin(a) * R * 0.75, ry: a });
                parts.push({ geo: _cyl(R * 0.2, R * 0.2, R * 0.1, 5), x: Math.cos(a) * R * 1.25, y: 0, z: Math.sin(a) * R * 1.25 });
            }
            glow.push({ geo: _cyl(R * 0.7, R * 0.7, R * 0.08, 6), x: 0, y: R * 0.05, z: 0 });
            return { body: _mergeParts(parts), glow: _mergeParts(glow) };
        }
        case 'boss': {
            return _walkerGeo(cfg, { torsoScale: 2.1, quad: true, shoulder: true, twinGun: true });
        }
        default:
            return { body: null, glow: null };
    }
}

// ── Enemy type configs (colors as [r,g,b] arrays → THREE.Color) ─────
export const ENEMY_TYPES = {
    scout: { name: 'SCOUT', hp: 1, speed: 3.0, damage: 15, modelScale: 5.0, eyeHeight: 1.6,
        eyeColor: [0, 0.8, 1.0], eyeIntensity: 1.4, eyeRange: 5, tintColor: [0.15, 0.35, 0.4], emissiveAccent: [0, 0.3, 0.5],
        hitboxH: 5.0, hitboxW: 2.5, zigzag: true },
    grunt: { name: 'GRUNT', hp: 3, speed: 4.5, damage: 20, modelScale: 4.0, eyeHeight: 2.0,
        eyeColor: [1.0, 0.5, 0], eyeIntensity: 1.8, eyeRange: 6, tintColor: [0.35, 0.22, 0.12], emissiveAccent: [0.4, 0.15, 0],
        hitboxH: 5.0, hitboxW: 2.5, zigzag: false },
    heavy: { name: 'HEAVY', hp: 6, speed: 1.56, damage: 30, modelScale: 6.0, eyeHeight: 2.4,
        eyeColor: [1.0, 0, 0], eyeIntensity: 2.2, eyeRange: 7, tintColor: [0.4, 0.08, 0.05], emissiveAccent: [0.5, 0, 0],
        hitboxH: 6.0, hitboxW: 3.0, zigzag: false, firesBack: true, fireInterval: 4000 },
    drone: { name: 'DRONE', hp: 2, speed: 5.4, damage: 10, modelScale: 2.5, eyeHeight: 3.5,
        eyeColor: [0.6, 0, 1.0], eyeIntensity: 1.6, eyeRange: 5, tintColor: [0.2, 0.1, 0.3], emissiveAccent: [0.3, 0, 0.5],
        hitboxH: 2.5, hitboxW: 2.0, zigzag: true, flies: true, flyHeight: 4.0, firesBack: true, fireInterval: 3000 },
    boss: { name: 'BOSS', hp: 25, speed: 1.2, damage: 50, modelScale: 10.0, eyeHeight: 3.5,
        eyeColor: [1.0, 0, 0], eyeIntensity: 3.0, eyeRange: 10, tintColor: [0.5, 0.05, 0], emissiveAccent: [0.8, 0.1, 0],
        hitboxH: 9.0, hitboxW: 5.0, zigzag: false, firesBack: true, fireInterval: 2000 },
};
// NOTE: v1 speeds were per-frame (~60fps). V2 is dt-based, so speeds are ×60.
// NOTE: modelScale is retained for the procedural fallback silhouettes only.
// GLB bodies are scaled from their measured height to hitboxH (see _build), so
// the visible robot and its raycast hitbox always agree.

export const WAVE_CONFIGS = [
    { wave: 1, enemies: [{ type: 'scout', count: 3 }] },
    { wave: 2, enemies: [{ type: 'scout', count: 3 }, { type: 'grunt', count: 2 }] },
    { wave: 3, enemies: [{ type: 'scout', count: 3 }, { type: 'grunt', count: 3 }, { type: 'heavy', count: 1 }] },
    { wave: 4, enemies: [{ type: 'scout', count: 2 }, { type: 'grunt', count: 3 }, { type: 'heavy', count: 1 }, { type: 'drone', count: 2 }] },
    { wave: 5, enemies: [{ type: 'scout', count: 3 }, { type: 'grunt', count: 4 }, { type: 'heavy', count: 2 }, { type: 'drone', count: 2 }] },
    { wave: 6, enemies: [{ type: 'grunt', count: 5 }, { type: 'heavy', count: 2 }, { type: 'drone', count: 3 }] },
    { wave: 7, enemies: [{ type: 'scout', count: 4 }, { type: 'grunt', count: 5 }, { type: 'heavy', count: 3 }, { type: 'drone', count: 3 }] },
    { wave: 8, enemies: [{ type: 'grunt', count: 6 }, { type: 'heavy', count: 3 }, { type: 'drone', count: 4 }] },
    { wave: 9, enemies: [{ type: 'scout', count: 5 }, { type: 'grunt', count: 5 }, { type: 'heavy', count: 4 }, { type: 'drone', count: 3 }] },
    { wave: 10, enemies: [{ type: 'grunt', count: 5 }, { type: 'heavy', count: 3 }, { type: 'drone', count: 3 }, { type: 'boss', count: 1 }] },
];

function withTimeout(promise, ms, label) {
    return Promise.race([
        promise,
        new Promise((_, rej) => setTimeout(() => rej(new Error(`${label} timed out after ${ms}ms`)), ms)),
    ]);
}

async function preloadModels() {
    const types = ['scout', 'grunt', 'heavy'];
    // Load in order through the shared high-priority queue. Parallel Draco
    // decodes were timing out as a group even though each GLB is valid.
    for (const t of types) {
        if (_modelCache[t]) continue;
        try {
            const g = await withTimeout(loadGLB(withVersion(SCENE_MODEL_BASE + `${t}.glb`), 'high'), 30000, `${t}.glb`);
            _modelCache[t] = g.scene;
            g.scene.traverse((o) => { if (o.isMesh && o.geometry) _templateGeos.add(o.geometry); });
        } catch (e) { console.warn(`[V2] ${t}.glb load failed — fallback primitives:`, e.message); }
    }
}

export const WaveManager = {
    activeEnemies: [],
    spawnQueue: [],
    lastSpawnTime: 0,
    spawnInterval: 1400,
    waveActive: false,
    _modelsReady: false,

    async init() {
        this._modelsReady = false;
        await preloadModels();
        this._modelsReady = true;
    },

    startWave(waveNum) {
        this.waveActive = true;
        this.lastSpawnTime = performance.now();
        const config = WAVE_CONFIGS[Math.min(waveNum - 1, WAVE_CONFIGS.length - 1)];
        const list = [];
        for (const { type, count } of config.enemies) for (let i = 0; i < count; i++) list.push(type);
        for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
        this.spawnQueue = list;
    },

    tick(dt) {
        const now = performance.now();
        // Spawn regardless of model preload state — Enemy._build() substitutes a
        // procedural body until the GLB arrives, so waves never wait on the net.
        if (this.spawnQueue.length > 0 && now - this.lastSpawnTime >= this.spawnInterval) {
            this._spawn(this.spawnQueue.shift());
            this.lastSpawnTime = now;
        }
        for (let i = this.activeEnemies.length - 1; i >= 0; i--) {
            const e = this.activeEnemies[i];
            // A dead enemy still needs ticking until its collapse animation has
            // run and disposed the body — retire it only once the root is gone,
            // otherwise the corpse is unparented from the update loop and stays
            // frozen in the scene forever.
            if (e.dead && !e.root) { this.activeEnemies.splice(i, 1); continue; }
            try { e.tick(dt, now); } catch (err) { console.error('[V2] enemy.tick', err); }
        }
        if (this.waveActive && this.spawnQueue.length === 0 && this.activeEnemies.length === 0) {
            this.waveActive = false;
            ctx.onWaveComplete();
        }
    },

    _spawn(type) {
        const sp = (ctx.AW.sceneConfig && ctx.AW.sceneConfig.spawn) || {};
        const arc = sp.arcAngle || Math.PI * 1.1, rMin = sp.radiusMin || 25, rMax = sp.radiusMax || 35, dir = sp.direction || -1;
        const angle = (Math.random() - 0.5) * arc;
        const radius = rMin + Math.random() * (rMax - rMin);
        const x = Math.sin(angle) * radius;
        const z = dir * Math.abs(Math.cos(angle)) * radius;
        try { this.activeEnemies.push(new Enemy(type, new THREE.Vector3(x, 0, z))); }
        catch (e) { console.error('[V2] spawn failed', type, e); }
    },

    reset() {
        for (const e of this.activeEnemies) e.dispose();
        this.activeEnemies = [];
        this.spawnQueue = [];
        this.waveActive = false;
    },
};

export class Enemy {
    constructor(typeName, startPos) {
        this.typeName = typeName;
        this.cfg = ENEMY_TYPES[typeName];
        this.hp = this.cfg.hp;
        this.dead = false;
        this._walkT = Math.random() * Math.PI * 2;
        this.zigzagPhase = Math.random() * Math.PI * 2;
        this.zigzagFreq = 1.5 + Math.random();
        this.nextFireTime = performance.now() + (this.cfg.fireInterval || 99999) + Math.random() * 2000;
        this._startPos = startPos.clone();
        this._flashMeshes = [];
        this._meshMats = [];   // per-instance clones, disposed with the enemy
        this._flashTimer = null;
        this._stuckFor = 0;    // seconds spent unable to advance
        this._avoidDir = 0;    // +1/-1 wall-follow direction while unsticking
        this._avoidUntil = 0;
        this._climb = 0;       // height gained stepping over low cover
        this._bestDist = Infinity; // closest approach so far (progress metric)
        this._noProgress = 0;      // seconds without getting closer
        this._eyeOffset = Math.random() * Math.PI * 2;
        this._collapse = null;
        this._tmpDir = new THREE.Vector3();
        this._tmpRight = new THREE.Vector3();
        this._build();
    }

    _build() {
        const cfg = this.cfg;
        const root = new THREE.Group();
        root.position.copy(this._startPos);
        this.root = root;

        const tpl = _modelCache[this.typeName];
        if (tpl) {
            const model = tpl.clone(true);
            // The GLBs are authored Y-up and gltf.js has already dropped their
            // feet onto y = 0, so no corrective rotation belongs here. The old
            // rotation.y = -PI/2 tipped every robot a quarter turn off its
            // heading — that is why they all appeared to face left.
            //
            // Scale from the model's real height to the type's hitbox height so
            // the visible body and the raycast target always agree, instead of
            // trusting a hand-tuned modelScale against a ~1-unit model.
            const mb = new THREE.Box3().setFromObject(model);
            const mh = Math.max(1e-3, mb.max.y - mb.min.y);
            model.scale.setScalar(cfg.hitboxH / mh);

            // Keep each GLB's own baseColor texture — overwriting every mesh
            // with a flat tint material was what made the real models read as
            // untextured procedural blobs. Tint the existing material instead.
            model.traverse((o) => {
                if (!o.isMesh) return;
                o.material = o.material.clone();
                if (o.material.map) o.material.color.lerp(col(cfg.tintColor), 0.35);
                else o.material.color.copy(col(cfg.tintColor));
                o.material.emissive = col(cfg.emissiveAccent);
                o.material.emissiveIntensity = 0.6;
                o.castShadow = true;
                this._meshMats.push(o.material);
                this._flashMeshes.push(o);
            });
            root.add(model);
            if (this.typeName !== 'drone' && this.typeName !== 'boss') this._attachWeapon(root, cfg);
        } else {
            this._buildFallback(root);
        }

        // Hitbox (invisible, raycast target)
        const hitbox = new THREE.Mesh(new THREE.BoxGeometry(cfg.hitboxW, cfg.hitboxH, cfg.hitboxW),
            new THREE.MeshBasicMaterial({ visible: false }));
        hitbox.position.y = cfg.hitboxH / 2;
        hitbox.userData = { isEnemy: true, enemyRef: this };
        root.add(hitbox);
        this.hitbox = hitbox;

        // Eye light
        const eye = new THREE.PointLight(col(cfg.eyeColor), cfg.eyeIntensity * 2, cfg.eyeRange);
        eye.position.set(0, cfg.eyeHeight, 0.3);
        root.add(eye);
        this.eye = eye;
        this._eyeBase = cfg.eyeIntensity * 2;

        // HP bar (sprite billboard) for multi-hit enemies
        if (cfg.hp > 1) {
            const barW = this.typeName === 'boss' ? 3 : 1.5;
            this._hpBarWidth = barW;
            // HP bars are UI overlays: they must never intercept a bullet, and
            // skipping them keeps Sprite.raycast() out of the shooting hot path.
            const bgMat = new THREE.SpriteMaterial({ color: 0x262626, depthTest: false });
            const bg = new THREE.Sprite(bgMat); bg.scale.set(barW, 0.15, 1); bg.position.y = cfg.hitboxH + 0.8;
            bg.raycast = () => {};
            root.add(bg); this._hpBg = bg;
            const fgMat = new THREE.SpriteMaterial({ color: 0xcc2610, depthTest: false });
            const fg = new THREE.Sprite(fgMat); fg.scale.set(barW, 0.12, 1); fg.position.set(0, cfg.hitboxH + 0.8, 0);
            fg.center.set(0.5, 0.5);
            fg.raycast = () => {};
            root.add(fg); this._hpBar = fg;
        }

        ctx.scene.add(root);
    }

    _attachWeapon(root, cfg) {
        const wMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.12, 0.12, 0.14), metalness: 0.8, roughness: 0.3 });
        const len = this.typeName === 'heavy' ? 0.9 : 0.6;
        const w = this.typeName === 'heavy' ? 0.12 : 0.07;
        const barrel = new THREE.Mesh(new THREE.BoxGeometry(w, w, len), wMat);
        barrel.position.set(0.15, cfg.hitboxH * 0.5, 0.55); barrel.castShadow = true; root.add(barrel); this._flashMeshes.push(barrel);
        if (this.typeName === 'heavy') {
            const b2 = barrel.clone(); b2.position.x = -0.15; root.add(b2); this._flashMeshes.push(b2);
        }
        const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.8, 0.2, 0) }));
        muzzle.position.set(0.15, cfg.hitboxH * 0.5, 0.55 + len / 2); root.add(muzzle); this._flashMeshes.push(muzzle);
    }

    _buildFallback(root) {
        const cfg = this.cfg;
        if (!_fbRobotGeo[this.typeName]) {
            const { body, glow } = _buildRobotGeometries(this.typeName, cfg);
            if (body) { _fbRobotGeo[this.typeName] = body; if (!_sharedGeos.has(body)) _sharedGeos.add(body); }
            if (glow) { _fbRobotGlow[this.typeName] = glow; if (!_sharedGeos.has(glow)) _sharedGeos.add(glow); }
        }
        if (_fbRobotGeo[this.typeName]) {
            this._tintMat = new THREE.MeshStandardMaterial({
                color: col(cfg.tintColor), emissive: col(cfg.emissiveAccent),
                roughness: 0.6, metalness: 0.4,
            });
            this._tintMat.emissiveIntensity = 0.6;
            this._meshMats.push(this._tintMat);
            const body = new THREE.Mesh(_fbRobotGeo[this.typeName], this._tintMat);
            body.castShadow = true;
            root.add(body);
            this._flashMeshes.push(body);
            if (_fbRobotGlow[this.typeName]) {
                const glowMat = new THREE.MeshBasicMaterial({ color: col(cfg.eyeColor) });
                const glow = new THREE.Mesh(_fbRobotGlow[this.typeName], glowMat);
                root.add(glow);
                this._flashMeshes.push(glow);
            }
            return;
        }
        // last-resort box stack (should never reach here)
        const s = cfg.hitboxH / 3;
        const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.2, 0.2, 0.22), emissive: new THREE.Color(0.02, 0.02, 0.03) });
        const body = new THREE.Mesh(new THREE.BoxGeometry(s * 0.8, s * 1.6, s * 0.6), mat); body.position.y = s * 0.9; body.castShadow = true; root.add(body); this._flashMeshes.push(body);
        const head = new THREE.Mesh(new THREE.BoxGeometry(s * 0.6, s * 0.6, s * 0.5), mat); head.position.y = s * 1.9; root.add(head); this._flashMeshes.push(head);
    }

    tick(dt, now) {
        if (!this.root) return;
        // Collapse runs *after* death, so it must be checked before the dead
        // guard below, not after it.
        if (this._collapse) { this._collapse(dt); return; }
        if (this.dead) return;
        const cam = ctx.camera;
        const dx = cam.position.x - this.root.position.x;
        const dz = cam.position.z - this.root.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist < 2.2) {
            ctx.onPlayerDamage(this.cfg.damage, this.root.position.x, this.root.position.z);
            this._die();
            return;
        }

        this._tmpDir.set(dx / dist, 0, dz / dist);
        this._tmpRight.crossVectors(this._tmpDir, ENEMY_UP).normalize();

        if (this.cfg.zigzag) {
            this.zigzagPhase += 2.4 * this.zigzagFreq * dt;
            const strafe = Math.sin(this.zigzagPhase) * 2.1 * dt;
            this.root.position.x += this._tmpRight.x * strafe;
            this.root.position.z += this._tmpRight.z * strafe;
        }

        const step = this.cfg.speed * dt;
        const px = this.root.position.x, pz = this.root.position.z;
        const R = this.cfg.hitboxW * 0.4;

        // Flying units ignore ground obstacles entirely.
        let moveX = this._tmpDir.x, moveZ = this._tmpDir.z;

        if (this.cfg.flies) {
            this.root.position.x = px + moveX * step;
            this.root.position.z = pz + moveZ * step;
        } else {
            // While unsticking, steer along the obstacle instead of into it.
            if (now < this._avoidUntil) {
                const s = this._avoidDir;
                moveX = this._tmpDir.x * 0.35 + this._tmpRight.x * s;
                moveZ = this._tmpDir.z * 0.35 + this._tmpRight.z * s;
                const l = Math.hypot(moveX, moveZ) || 1;
                moveX /= l; moveZ /= l;
            }

            // Try the desired heading, then progressively wider deflections to
            // either side. Sliding on a single axis (the old behaviour) fails
            // whenever an enemy meets a wall head-on — both axis retries are
            // blocked and it stalls there forever, which is why so many robots
            // stood frozen against cover.
            const cosA = Math.cos, sinA = Math.sin;
            for (const a of [0, 0.5, -0.5, 1.0, -1.0, 1.6, -1.6, 2.3, -2.3]) {
                const dx = moveX * cosA(a) - moveZ * sinA(a);
                const dz = moveX * sinA(a) + moveZ * cosA(a);
                const nx = px + dx * step, nz = pz + dz * step;
                if (!ctx.checkCollision(nx, nz, R)) {
                    this.root.position.x = nx; this.root.position.z = nz;
                    moveX = dx; moveZ = dz;
                    break;
                }
            }
        }

        // Stuck detection is based on *progress toward the player*, not on
        // whether a step was possible. An enemy pacing sideways along a wall
        // always finds some free direction, so a "could not move" test never
        // fires and it patrols that wall forever — which is what left robots
        // hovering at a fixed distance, alive but never arriving.
        if (dist < this._bestDist - 0.5) {
            this._bestDist = dist;
            this._noProgress = 0;
        } else {
            this._noProgress += dt;
        }
        this._stuckFor = this._noProgress;

        // Phase 1 — steer around the obstruction. Commit to one direction long
        // enough to actually round it; re-rolling every few hundred ms just
        // oscillates in place.
        if (this._noProgress > 1.0 && now >= this._avoidUntil) {
            this._avoidDir = this._avoidDir === 0
                ? (Math.random() < 0.5 ? -1 : 1)
                : -this._avoidDir; // try the other way if this side didn't work
            this._avoidUntil = now + 2000 + Math.random() * 1000;
        }

        // Phase 2 — wall-following failed for a sustained stretch, so step up
        // and over. This is a brief, self-cancelling hop: holding a permanent
        // climb leaves robots hovering above the arena.
        const wantClimb = this._noProgress > 4.0 && this._noProgress < 7.0;
        if (wantClimb) {
            this._climb = Math.min(3.2, this._climb + 3.0 * dt);
            if (this._climb >= 1.5) {
                const nx = px + this._tmpDir.x * step, nz = pz + this._tmpDir.z * step;
                this.root.position.x = nx; this.root.position.z = nz;
                moveX = this._tmpDir.x; moveZ = this._tmpDir.z;
            }
        } else {
            this._climb = Math.max(0, this._climb - 3.0 * dt);
        }

        // Give up on the old best distance and re-baseline, so a robot that has
        // been rerouted doesn't stay latched in escape mode forever.
        if (this._noProgress > 7.0 && this._climb <= 0) {
            this._noProgress = 0;
            this._bestDist = dist;
            this._avoidDir = 0;
            this._avoidUntil = 0;
        }

        // Face the direction of travel. The GLBs are normalized to Y-up facing
        // +Z, so the yaw is the heading itself — the old -PI/2 offset here was
        // the other half of the "robots face left" bug.
        this.root.rotation.y = Math.atan2(moveX, moveZ);

        if (this.eye) {
            const t = now * 0.003 + this._eyeOffset;
            this.eye.intensity = this._eyeBase + Math.sin(t * 5) * 0.6 + Math.sin(t * 11) * 0.24;
        }

        const prevWalk = this._walkT;
        this._walkT += 4.8 * dt;
        if (this.cfg.flies) {
            this.root.position.y = this.cfg.flyHeight + Math.sin(this._walkT * 0.5) * 0.3;
        } else {
            this.root.position.y = this._climb + Math.abs(Math.sin(this._walkT)) * 0.12;
            if (Math.sin(prevWalk) > 0 && Math.sin(this._walkT) <= 0) ctx.audio.playFootstep(dist, this.typeName);
        }

        if (this.cfg.firesBack && dist < 40 && now > this.nextFireTime) {
            this._fireAtPlayer(dist);
            this.nextFireTime = now + this.cfg.fireInterval + Math.random() * 1500;
        }
    }

    _fireAtPlayer(dist) {
        ctx.audio.playEnemyFire();
        if (this.root) {
            const from = this.root.position.clone(); from.y += 2;
            ctx.spawnEnemyTracer(from, ctx.camera.position.clone());
        }
        const hitChance = Math.max(0.1, 1 - dist / 45);
        if (Math.random() < hitChance) ctx.onPlayerDamage(8, this.root.position.x, this.root.position.z);
    }

    takeDamage(amount) {
        if (this.dead) return;
        this.hp -= amount;
        this._flashHit();
        if (this._hpBar && this.hp > 0) {
            const pct = Math.max(0, this.hp / this.cfg.hp);
            this._hpBar.scale.x = this._hpBarWidth * pct;
            this._hpBar.position.x = -(this._hpBarWidth * (1 - pct)) / 2;
            const c = this._hpBar.material.color;
            if (pct > 0.5) c.setRGB(0.2, 0.7, 0.1); else if (pct > 0.25) c.setRGB(0.8, 0.6, 0); else c.setRGB(0.8, 0.15, 0.05);
        }
        if (this.hp <= 0) this._die();
    }

    // Flash by toggling emissive, not visibility. Hiding the meshes meant a
    // burst of hits could leave an enemy invisible (each hit re-armed its own
    // timer, and a kill in between cancelled the restore), and an invisible
    // body reads as an enemy that refuses to die.
    _flashHit() {
        if (this._flashTimer) clearTimeout(this._flashTimer);
        for (const m of this._meshMats) m.emissiveIntensity = 4.0;
        this._flashTimer = setTimeout(() => {
            this._flashTimer = null;
            if (this.dead) return;
            for (const m of this._meshMats) m.emissiveIntensity = 0.6;
        }, 80);
    }

    _die() {
        if (this.dead) return;
        this.dead = true;
        ctx.AW.kills++;
        ctx.addScore(this.typeName);
        ctx.checkKillStreak();
        if (this.hitbox) { this.root.remove(this.hitbox); this.hitbox = null; }
        if (this._hpBar) { this.root.remove(this._hpBar); this._hpBar = null; }
        if (this._hpBg) { this.root.remove(this._hpBg); this._hpBg = null; }

        if (this.root) {
            ctx.spawnExplosion(new THREE.Vector3(this.root.position.x, 1.2, this.root.position.z));
            const root = this.root;
            let t = 0; const dur = 0.6;
            this._collapse = (dt) => {
                t = Math.min(t + dt, dur);
                const e = (t / dur) * (t / dur);
                root.rotation.x = e * (Math.PI / 3);
                root.position.y = -e * 1.5;
                if (t >= dur) { this._collapse = null; this.dispose(); }
            };
        } else {
            this.dispose();
        }
    }

    dispose() {
        if (this._flashTimer) { clearTimeout(this._flashTimer); this._flashTimer = null; }
        if (this.eye) { this.root.remove(this.eye); this.eye = null; }
        if (this.root) {
            ctx.scene.remove(this.root);
            const seen = new Set();
            this.root.traverse((o) => {
                // Geometry from the shared GLB template is cloned by reference —
                // only per-enemy geometry (the hitbox, weapons) may be freed.
                if (o.geometry && !_sharedGeos.has(o.geometry) && !_templateGeos.has(o.geometry)) o.geometry.dispose();
                if (o.material) {
                    for (const mm of (Array.isArray(o.material) ? o.material : [o.material])) {
                        if (mm && !seen.has(mm)) { seen.add(mm); mm.dispose(); }
                    }
                }
            });
            this.root = null;
        }
        this._flashMeshes = [];
        this._meshMats = [];
    }
}
