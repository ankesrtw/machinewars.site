/* ═══════════════════════════════════════════════════════════════════
   MACHINE WARS — fx.js
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

// ── CREON face crop ─────────────────────────────────────────────────
// The source art is a full battle scene; CREON's head occupies its upper-left
// quadrant. Crop to just the head and feather the edges to transparency so the
// billboard dissolves into the sky instead of showing a rectangular seam.
// Crop rect is expressed in 0..1 fractions of the source so re-cropping a
// different piece of art needs only config, not code.
export function creonFaceTexture(srcTex, cfg) {
    const img = srcTex.image;
    const S = 1024;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const ctx = c.getContext('2d');

    const cr = (cfg && cfg.crop) || { x: 0.13, y: 0.0, w: 0.42, h: 0.62 };
    const sx = cr.x * img.width, sy = cr.y * img.height;
    const sw = cr.w * img.width, sh = cr.h * img.height;
    // Fit the crop into the square canvas without distorting the face.
    const scale = Math.min(S / sw, S / sh);
    const dw = sw * scale, dh = sh * scale;
    ctx.drawImage(img, sx, sy, sw, sh, (S - dw) / 2, (S - dh) / 2, dw, dh);

    // Feather: radial alpha falloff, and knock out the near-black background
    // so the dark sky of the art doesn't sit as a grey box over the game sky.
    const id = ctx.getImageData(0, 0, S, S);
    const px = id.data;
    const cxp = S / 2, cyp = S / 2;
    const halfW = dw / 2, halfH = dh / 2;
    const inner = (cfg && cfg.feather != null) ? cfg.feather : 0.48;
    const gain = (cfg && cfg.gain != null) ? cfg.gain : 1.5;
    const invG = 1 / ((cfg && cfg.gamma != null) ? cfg.gamma : 1.25);
    for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
            const i = (y * S + x) * 4;
            // Normalise against the drawn image's own half-extents, not the
            // square canvas: a non-square crop otherwise runs out of canvas
            // before the fade completes and leaves a hard straight edge.
            const dx = (x - cxp) / halfW, dy = (y - cyp) / halfH;
            const r = Math.sqrt(dx * dx + dy * dy);
            let a = 1;
            // Smoothstep rather than a linear ramp: a straight falloff still
            // ends on a visible circular seam against the sky.
            if (r > inner) {
                const u = Math.min(1, (r - inner) / (1 - inner));
                a = 1 - (u * u * (3 - 2 * u));
            }
            // Knock out only the true near-black background. The art has a low
            // mean luminance (~0.12) and the face reads by contrast rather than
            // brightness, so this curve must stay gentle — an aggressive
            // threshold erases the face along with the sky behind it.
            const lum = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) / 255;
            const lumA = Math.min(1, Math.max(0, (lum - 0.015) / 0.06));
            px[i + 3] = Math.round(px[i + 3] * a * lumA);

            // Lift the RGB itself. Alpha-blending near-black pixels (~20/255)
            // over a dark sky yields nothing visible, so the face must be
            // brightened here — gain plus gamma keeps the panel detail and the
            // red eyes intact instead of flattening them to grey.
            px[i]     = Math.min(255, Math.round(255 * Math.pow(px[i] / 255, invG) * gain));
            px[i + 1] = Math.min(255, Math.round(255 * Math.pow(px[i + 1] / 255, invG) * gain));
            px[i + 2] = Math.min(255, Math.round(255 * Math.pow(px[i + 2] / 255, invG) * gain));
        }
    }
    ctx.putImageData(id, 0, 0);

    const tex = new THREE.CanvasTexture(c);
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

// ── Cover-block surface (weathered concrete slab) ───────────────────
// Cover blocks were flat-coloured MeshStandard boxes, which read as untextured
// grey primitives next to the GLB props. This gives them a poured-concrete
// face: aggregate speckle, form-panel seams, edge chipping and grime streaks.
export function concreteTexture(baseRGB, seed) {
    const size = 512;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const b = baseRGB || [0.32, 0.28, 0.22];
    const B = b.map((v) => Math.round(v * 255));
    ctx.fillStyle = `rgb(${B[0]},${B[1]},${B[2]})`;
    ctx.fillRect(0, 0, size, size);
    const rng = seededRandom(seed || 7);

    // Aggregate speckle
    for (let i = 0; i < 2600; i++) {
        const px = rng() * size, py = rng() * size;
        const r = 0.6 + rng() * 2.6;
        const d = (rng() - 0.5) * 60;
        ctx.fillStyle = `rgba(${B[0] + d | 0},${B[1] + d | 0},${B[2] + d | 0},0.5)`;
        ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
    }
    // Broad blotching so it isn't uniform noise
    for (let i = 0; i < 26; i++) {
        const px = rng() * size, py = rng() * size, r = 30 + rng() * 110;
        const d = (rng() - 0.5) * 34;
        const g = ctx.createRadialGradient(px, py, 0, px, py, r);
        g.addColorStop(0, `rgba(${B[0] + d | 0},${B[1] + d | 0},${B[2] + d | 0},0.4)`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.fillRect(px - r, py - r, r * 2, r * 2);
    }
    // Form-panel seams
    ctx.strokeStyle = `rgba(${B[0] * 0.55 | 0},${B[1] * 0.55 | 0},${B[2] * 0.55 | 0},0.75)`;
    ctx.lineWidth = 2;
    for (const f of [0.5]) {
        ctx.beginPath(); ctx.moveTo(0, size * f); ctx.lineTo(size, size * f); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(size * f, 0); ctx.lineTo(size * f, size); ctx.stroke();
    }
    // Grime streaks running down the face
    for (let i = 0; i < 22; i++) {
        const px = rng() * size, w = 3 + rng() * 16, h = 40 + rng() * 260;
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, 'rgba(20,16,12,0.30)');
        g.addColorStop(1, 'rgba(20,16,12,0)');
        ctx.fillStyle = g; ctx.fillRect(px, rng() * size * 0.5, w, h);
    }
    // Chipped edges / exposed corners
    ctx.fillStyle = `rgba(${B[0] + 40 | 0},${B[1] + 36 | 0},${B[2] + 30 | 0},0.55)`;
    for (let i = 0; i < 30; i++) {
        const edge = rng();
        const px = edge < 0.5 ? (rng() < 0.5 ? rng() * 26 : size - rng() * 26) : rng() * size;
        const py = edge < 0.5 ? rng() * size : (rng() < 0.5 ? rng() * 26 : size - rng() * 26);
        ctx.beginPath(); ctx.arc(px, py, 1.5 + rng() * 5, 0, Math.PI * 2); ctx.fill();
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
