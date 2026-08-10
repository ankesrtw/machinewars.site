/* ═══════════════════════════════════════════════════════════════════
   AUTONOMOUS WAR V2 — fx.js
   Procedural textures, GPU particle pools, post-processing setup.

   Particle strategy (perf upgrade over Babylon v1):
   Instead of allocating a ParticleSystem per shot/explosion (v1 churned
   GC), we keep a handful of long-lived THREE.Points pools. Each "burst"
   grabs N free particles, seeds their position/velocity/life, and the
   pool's update() advects them on the GPU-friendly attribute buffers.
   ═══════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';

// ── Seeded RNG (deterministic environment) ──────────────────────────
export function seededRandom(seed) {
    let s = seed;
    return function () {
        s = (s * 1664525 + 1013904223) & 0xffffffff;
        return (s >>> 0) / 0xffffffff;
    };
}

// ── Canvas texture factories (no image files needed) ────────────────
function radialTexture(stops, size = 64) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(size / 2, size / 2, 1, size / 2, size / 2, size / 2);
    for (const [o, col] of stops) g.addColorStop(o, col);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

let _fireTex, _smokeTex, _sparkTex, _glowTex;
export function fireTexture() {
    return _fireTex || (_fireTex = radialTexture([
        [0, 'rgba(255,230,140,1)'],
        [0.35, 'rgba(255,120,20,0.85)'],
        [1, 'rgba(200,20,0,0)'],
    ]));
}
export function smokeTexture() {
    return _smokeTex || (_smokeTex = radialTexture([
        [0, 'rgba(170,160,150,0.9)'],
        [0.5, 'rgba(100,95,90,0.45)'],
        [1, 'rgba(60,55,50,0)'],
    ]));
}
export function sparkTexture() {
    return _sparkTex || (_sparkTex = radialTexture([
        [0, 'rgba(255,240,180,1)'],
        [0.5, 'rgba(255,200,90,0.7)'],
        [1, 'rgba(255,140,0,0)'],
    ], 32));
}
export function softGlowTexture() {
    return _glowTex || (_glowTex = radialTexture([
        [0, 'rgba(255,255,255,1)'],
        [0.4, 'rgba(255,255,255,0.5)'],
        [1, 'rgba(255,255,255,0)'],
    ]));
}

// ── Equirectangular sky from procedural canvas (warzone fallback) ───
export function proceduralSkyTexture(skyCfg) {
    const w = 1024, h = 512;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.fillStyle = skyCfg.baseColor || 'rgb(48,44,42)';
    ctx.fillRect(0, 0, w, h);
    const rng = seededRandom(88);
    for (let i = 0; i < 120; i++) {
        const cx = rng() * w, cy = rng() * h * 0.7;
        const r = 20 + rng() * 90;
        const v = Math.floor(25 + rng() * 30);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, `rgba(${v},${v - 2},${v - 3},0.55)`);
        g.addColorStop(1, `rgba(${v},${v},${v},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    if (skyCfg.horizonGlow !== false) {
        const hg = ctx.createLinearGradient(0, h * 0.62, 0, h);
        hg.addColorStop(0, 'rgba(80,40,10,0)');
        hg.addColorStop(0.6, 'rgba(80,35,8,0.3)');
        hg.addColorStop(1, 'rgba(100,40,10,0.5)');
        ctx.fillStyle = hg;
        ctx.fillRect(0, h * 0.62, w, h * 0.38);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

// ── Ground procedural texture (warzone) ─────────────────────────────
export function proceduralGroundTexture(gc) {
    const size = 512;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    ctx.fillStyle = gc.baseColor || 'rgb(72,62,52)';
    ctx.fillRect(0, 0, size, size);
    const rng = seededRandom(gc.textureSeed || 123);
    for (let i = 0; i < 400; i++) {
        const px = rng() * size, py = rng() * size;
        const pw = 4 + rng() * 35, ph = 4 + rng() * 35;
        const type = rng();
        let r, g, b;
        if (type < 0.3) { r = 65 + (rng() * 30 | 0); g = 50 + (rng() * 20 | 0); b = 35 + (rng() * 15 | 0); }
        else if (type < 0.5) { r = 80 + (rng() * 30 | 0); g = 40 + (rng() * 20 | 0); b = 25 + (rng() * 10 | 0); }
        else if (type < 0.7) { r = 30 + (rng() * 15 | 0); g = 28 + (rng() * 12 | 0); b = 25 + (rng() * 10 | 0); }
        else { const v = 50 + (rng() * 30 | 0); r = v; g = v - 2; b = v - 4; }
        ctx.fillStyle = `rgba(${r},${g},${b},0.5)`;
        ctx.fillRect(px, py, pw, ph);
    }
    ctx.strokeStyle = 'rgba(25,20,15,0.7)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 50; i++) {
        ctx.beginPath();
        let cx = rng() * size, cy = rng() * size;
        ctx.moveTo(cx, cy);
        for (let s = 0; s < 6; s++) { cx += (rng() - 0.5) * 45; cy += (rng() - 0.5) * 45; ctx.lineTo(cx, cy); }
        ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

/* ═══════════════════════════════════════════════════════════════════
   ParticlePool — one THREE.Points object, fixed capacity, reused.
   ═══════════════════════════════════════════════════════════════════ */
export class ParticlePool {
    constructor(scene, { capacity, texture, blending = THREE.AdditiveBlending, size = 1, depthWrite = false }) {
        this.capacity = capacity;
        this.scene = scene;
        const pos = new Float32Array(capacity * 3);
        const col = new Float32Array(capacity * 4);
        const psize = new Float32Array(capacity);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('pcolor', new THREE.BufferAttribute(col, 4));
        geo.setAttribute('psize', new THREE.BufferAttribute(psize, 1));
        geo.setDrawRange(0, capacity);

        const mat = new THREE.ShaderMaterial({
            uniforms: { map: { value: texture } },
            transparent: true,
            depthWrite,
            blending,
            vertexShader: `
                attribute vec4 pcolor; attribute float psize; varying vec4 vColor;
                void main(){
                    vColor = pcolor;
                    vec4 mv = modelViewMatrix * vec4(position,1.0);
                    gl_PointSize = psize * (300.0 / -mv.z);
                    gl_Position = projectionMatrix * mv;
                }`,
            fragmentShader: `
                uniform sampler2D map; varying vec4 vColor;
                void main(){
                    vec4 t = texture2D(map, gl_PointCoord);
                    gl_FragColor = vec4(vColor.rgb, vColor.a) * t;
                    if (gl_FragColor.a < 0.01) discard;
                }`,
        });

        this.points = new THREE.Points(geo, mat);
        this.points.frustumCulled = false;
        this.points.renderOrder = 10;
        scene.add(this.points);

        // CPU-side particle state
        this.px = pos; this.pc = col; this.ps = psize;
        this.vx = new Float32Array(capacity);
        this.vy = new Float32Array(capacity);
        this.vz = new Float32Array(capacity);
        this.life = new Float32Array(capacity);
        this.maxLife = new Float32Array(capacity);
        this.c0 = new Array(capacity);   // start color [r,g,b,a]
        this.c1 = new Array(capacity);   // end color
        this.s0 = new Float32Array(capacity);
        this.s1 = new Float32Array(capacity);
        this.grav = new Float32Array(capacity);
        this._cursor = 0;
        // hide all initially
        for (let i = 0; i < capacity; i++) { this.ps[i] = 0; this.pc[i * 4 + 3] = 0; }
    }

    // Emit one burst of `count` particles from a point
    emit(count, { x, y, z, spread, speed, up = 1, life, size0, size1, color0, color1, gravity = 0 }) {
        for (let i = 0; i < count; i++) {
            const idx = this._cursor;
            this._cursor = (this._cursor + 1) % this.capacity;
            this.px[idx * 3] = x; this.px[idx * 3 + 1] = y; this.px[idx * 3 + 2] = z;
            const a = Math.random() * Math.PI * 2;
            const r = Math.random();
            this.vx[idx] = Math.cos(a) * spread * r;
            this.vz[idx] = Math.sin(a) * spread * r;
            this.vy[idx] = (Math.random() * up) * speed;
            this.vx[idx] *= speed; this.vz[idx] *= speed;
            this.maxLife[idx] = this.life[idx] = life[0] + Math.random() * (life[1] - life[0]);
            this.s0[idx] = size0; this.s1[idx] = size1;
            this.c0[idx] = color0; this.c1[idx] = color1;
            this.grav[idx] = gravity;
        }
    }

    update(dt) {
        const { px, pc, ps, vx, vy, vz, life, maxLife, c0, c1, s0, s1, grav } = this;
        for (let i = 0; i < this.capacity; i++) {
            if (life[i] <= 0) { if (ps[i] !== 0) { ps[i] = 0; pc[i * 4 + 3] = 0; } continue; }
            life[i] -= dt;
            const t = 1 - life[i] / maxLife[i]; // 0..1
            vy[i] -= grav[i] * dt;
            px[i * 3] += vx[i] * dt;
            px[i * 3 + 1] += vy[i] * dt;
            px[i * 3 + 2] += vz[i] * dt;
            const a = c0[i], b = c1[i];
            pc[i * 4] = a[0] + (b[0] - a[0]) * t;
            pc[i * 4 + 1] = a[1] + (b[1] - a[1]) * t;
            pc[i * 4 + 2] = a[2] + (b[2] - a[2]) * t;
            pc[i * 4 + 3] = a[3] + (b[3] - a[3]) * t;
            ps[i] = s0[i] + (s1[i] - s0[i]) * t;
        }
        this.points.geometry.attributes.position.needsUpdate = true;
        this.points.geometry.attributes.pcolor.needsUpdate = true;
        this.points.geometry.attributes.psize.needsUpdate = true;
    }

    dispose() {
        this.scene.remove(this.points);
        this.points.geometry.dispose();
        this.points.material.dispose();
    }
}

/* ═══════════════════════════════════════════════════════════════════
   Continuous emitter — fixed-location fire/smoke/dust columns that
   spawn at a steady rate (drives the scene's fire pits, smoke, etc).
   ═══════════════════════════════════════════════════════════════════ */
export class ContinuousEmitter {
    constructor(pool, opts) {
        this.pool = pool;
        this.opts = opts;          // { x,y,z, rate, perEmit, ...emitParams }
        this._acc = 0;
    }
    update(dt) {
        this._acc += dt * this.opts.rate;
        while (this._acc >= 1) {
            this._acc -= 1;
            const o = this.opts;
            this.pool.emit(o.perEmit || 1, {
                x: o.x + (Math.random() - 0.5) * (o.jitter || 0),
                y: o.y,
                z: o.z + (Math.random() - 0.5) * (o.jitter || 0),
                spread: o.spread, speed: o.speed, up: o.up,
                life: o.life, size0: o.size0, size1: o.size1,
                color0: o.color0, color1: o.color1, gravity: o.gravity || 0,
            });
        }
    }
}
