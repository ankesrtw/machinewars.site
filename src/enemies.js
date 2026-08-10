/* ═══════════════════════════════════════════════════════════════════
   AUTONOMOUS WAR V2 — enemies.js (Three.js)
   GLB robot models, wave spawner, seek AI, hit logic.
   Decoupled from the game core via an injected `ctx` (see setContext):
     ctx.scene, ctx.camera, ctx.pools, ctx.audio, ctx.AW,
     ctx.onPlayerDamage, ctx.addScore, ctx.checkKillStreak,
     ctx.spawnExplosion, ctx.checkCollision, ctx.spawnEnemyTracer
   ═══════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { dracoLoader } from './gltf.js';
import { SCENE_MODEL_BASE } from './scenes-data.js';

const _loader = new GLTFLoader().setDRACOLoader(dracoLoader);
const _modelCache = {}; // type -> gltf.scene template
const ENEMY_UP = new THREE.Vector3(0, 1, 0);

let ctx = null;
export function setContext(c) { ctx = c; }

function col(a) { return new THREE.Color(a[0], a[1], a[2]); }

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
    // Guard each load so a stalled Draco decode can never block wave spawning —
    // on failure the enemy uses its procedural fallback mesh.
    await Promise.all(types.map(async (t) => {
        if (_modelCache[t]) return;
        try {
            const g = await withTimeout(_loader.loadAsync(SCENE_MODEL_BASE + `${t}.glb`), 8000, `${t}.glb`);
            _modelCache[t] = g.scene;
        } catch (e) { console.warn(`[V2] ${t}.glb load failed — fallback primitives:`, e.message); }
    }));
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
        if (this.spawnQueue.length > 0 && this._modelsReady && now - this.lastSpawnTime >= this.spawnInterval) {
            this._spawn(this.spawnQueue.shift());
            this.lastSpawnTime = now;
        }
        for (let i = this.activeEnemies.length - 1; i >= 0; i--) {
            const e = this.activeEnemies[i];
            if (e.dead) { this.activeEnemies.splice(i, 1); continue; }
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
            const tintMat = new THREE.MeshStandardMaterial({ color: col(cfg.tintColor), emissive: col(cfg.emissiveAccent), roughness: 0.6, metalness: 0.4 });
            const model = tpl.clone(true);
            model.rotation.y = -Math.PI / 2;
            model.scale.setScalar(cfg.modelScale);
            model.traverse((o) => { if (o.isMesh) { o.material = tintMat; o.castShadow = true; this._flashMeshes.push(o); } });
            root.add(model);
            this._tintMat = tintMat;
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
            const bgMat = new THREE.SpriteMaterial({ color: 0x262626, depthTest: false });
            const bg = new THREE.Sprite(bgMat); bg.scale.set(barW, 0.15, 1); bg.position.y = cfg.hitboxH + 0.8;
            root.add(bg); this._hpBg = bg;
            const fgMat = new THREE.SpriteMaterial({ color: 0xcc2610, depthTest: false });
            const fg = new THREE.Sprite(fgMat); fg.scale.set(barW, 0.12, 1); fg.position.set(0, cfg.hitboxH + 0.8, 0);
            fg.center.set(0.5, 0.5);
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
        if (this.typeName === 'drone') {
            const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.15, 0.1, 0.25), emissive: new THREE.Color(0.15, 0, 0.3) });
            const body = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.4, 12), mat); root.add(body); this._flashMeshes.push(body);
            const dome = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 8), new THREE.MeshStandardMaterial({ color: new THREE.Color(0.1, 0.05, 0.15), emissive: new THREE.Color(0.3, 0, 0.5) }));
            dome.position.y = 0.3; root.add(dome); this._flashMeshes.push(dome);
            for (let i = 0; i < 4; i++) {
                const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
                const arm = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 0.15), mat);
                arm.position.set(Math.cos(a) * 0.8, 0, Math.sin(a) * 0.8); arm.rotation.y = a; root.add(arm); this._flashMeshes.push(arm);
            }
            return;
        }
        if (this.typeName === 'boss') {
            const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.5, 0.05, 0), emissive: new THREE.Color(0.3, 0.02, 0), metalness: 0.4, roughness: 0.5 });
            const body = new THREE.Mesh(new THREE.BoxGeometry(3.5, 6, 2.5), mat); body.position.y = 3; body.castShadow = true; root.add(body); this._flashMeshes.push(body);
            const head = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 1.8), mat); head.position.y = 7; root.add(head); this._flashMeshes.push(head);
            for (const side of [-1, 1]) {
                const sh = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 1.5), mat); sh.position.set(side * 2.5, 5.5, 0); root.add(sh); this._flashMeshes.push(sh);
                const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 3, 8), new THREE.MeshStandardMaterial({ color: new THREE.Color(0.12, 0.12, 0.14), metalness: 0.8 }));
                cannon.rotation.x = Math.PI / 2; cannon.position.set(side * 1.5, 4, 2); root.add(cannon); this._flashMeshes.push(cannon);
            }
            return;
        }
        // ground unit box stack
        const s = cfg.hitboxH / 3;
        const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.2, 0.2, 0.22), emissive: new THREE.Color(0.02, 0.02, 0.03) });
        const body = new THREE.Mesh(new THREE.BoxGeometry(s * 0.8, s * 1.6, s * 0.6), mat); body.position.y = s * 0.9; body.castShadow = true; root.add(body); this._flashMeshes.push(body);
        const head = new THREE.Mesh(new THREE.BoxGeometry(s * 0.6, s * 0.6, s * 0.5), mat); head.position.y = s * 1.9; root.add(head); this._flashMeshes.push(head);
    }

    tick(dt, now) {
        if (this.dead || !this.root) return;
        if (this._collapse) { this._collapse(dt); return; }
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
        const nextX = this.root.position.x + this._tmpDir.x * step;
        const nextZ = this.root.position.z + this._tmpDir.z * step;
        if (ctx.checkCollision(nextX, nextZ, 0.8)) {
            if (!ctx.checkCollision(nextX, this.root.position.z, 0.8)) this.root.position.x = nextX;
            else if (!ctx.checkCollision(this.root.position.x, nextZ, 0.8)) this.root.position.z = nextZ;
        } else {
            this.root.position.x = nextX; this.root.position.z = nextZ;
        }

        this.root.rotation.y = Math.atan2(this._tmpDir.x, this._tmpDir.z) - Math.PI / 2;

        if (this.eye) {
            const t = now * 0.003 + this._eyeOffset;
            this.eye.intensity = this._eyeBase + Math.sin(t * 5) * 0.6 + Math.sin(t * 11) * 0.24;
        }

        const prevWalk = this._walkT;
        this._walkT += 4.8 * dt;
        if (this.cfg.flies) {
            this.root.position.y = this.cfg.flyHeight + Math.sin(this._walkT * 0.5) * 0.3;
        } else {
            this.root.position.y = Math.abs(Math.sin(this._walkT)) * 0.12;
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

    _flashHit() {
        for (const m of this._flashMeshes) {
            m.visible = false;
            setTimeout(() => { if (!this.dead && m) m.visible = true; }, 80);
        }
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
        if (this.eye) { this.root.remove(this.eye); this.eye = null; }
        if (this.root) {
            ctx.scene.remove(this.root);
            this.root.traverse((o) => {
                if (o.geometry) o.geometry.dispose();
                if (o.material && o.material !== this._tintMat) { const m = o.material; (Array.isArray(m) ? m : [m]).forEach((mm) => mm.dispose()); }
            });
            if (this._tintMat) this._tintMat.dispose();
            this.root = null;
        }
        this._flashMeshes = [];
    }
}
