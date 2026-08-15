/* ═══════════════════════════════════════════════════════════════════
   MACHINE WARS — main.js (Three.js game core)
   Renderer + post-processing, render loop, state machine, input,
   shooting/raycast, collision, weapons, grenades, pickups, scoring.
   ═══════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { World, SCENE_CONFIGS, DEFAULT_SCENE, MISSION_ORDER } from './scenes.js';
import { WaveManager, WAVE_CONFIGS, setContext } from './enemies.js';
import { HUD } from './hud.js';
import { Audio } from './audio.js';
import { withVersion, BUILD_ID } from './version.js';
import { Save } from './save.js';

// App-mode: set by a native wrapper (Capacitor/Electron) via ?app=1 or by
// presetting window.MW_NATIVE before this module loads. Hides the web-only
// header/ALL-SCENES chrome and gives the canvas the full window instead of
// `window.innerHeight - header height` (there is no header to subtract).
const IS_APP_MODE = window.MW_NATIVE === true || new URLSearchParams(location.search).has('app');

// ── Quality presets ──────────────────────────────────────────────────
const QUALITY_PRESETS = {
    low:    { shadowMapSize: 1024, bloom: false, particleScale: 0.55, pixelRatioCap: 1.0, radarFps: 12 },
    medium: { shadowMapSize: 1536, bloom: true,  particleScale: 0.8,  pixelRatioCap: 1.5, radarFps: 18, bloomStrength: 0.5 },
    high:   { shadowMapSize: 2048, bloom: true,  particleScale: 1.0,  pixelRatioCap: 2.0, radarFps: 30, bloomStrength: 0.8 },
};

// ── Weapons ──────────────────────────────────────────────────────────
const WEAPONS = [
    { name: 'RIFLE',   ammo: 30,  damage: 1, fireRate: 120, reloadTime: 2000, pellets: 1, spread: 0,     auto: false, sound: 'gunshot' },
    { name: 'SHOTGUN', ammo: 8,   damage: 1, fireRate: 600, reloadTime: 2500, pellets: 7, spread: 0.06,  auto: false, sound: 'shotgun' },
    { name: 'MINIGUN', ammo: 100, damage: 1, fireRate: 60,  reloadTime: 4000, pellets: 1, spread: 0.025, auto: true,  sound: 'minigun' },
];

const SCORE_VALUES = { scout: 100, grunt: 200, heavy: 500, drone: 150, boss: 1000 };

// ── Global game state ──────────────────────────────────────────────────
const AW = {
    state: 'loading',
    currentScene: DEFAULT_SCENE, sceneConfig: null,
    playerHP: 100, maxPlayerHP: 100,
    ammo: 30, maxAmmo: 30, reloading: false,
    currentWeapon: 0, lastFireTime: 0,
    wave: 1, maxWaves: 10, kills: 0, score: 0,
    comboCount: 0, comboTimer: 0, comboMultiplier: 1,
    shooting: false, keys: {},
    moveSpeed: 7.2, // units/sec (v1 was 0.12/frame ≈ 7.2/s)
    grenades: 3, maxGrenades: 3, lastGrenadeTime: 0,
    waveStartTime: 0, waveShots: 0, waveHits: 0, waveDamageTaken: 0, waveKillsStart: 0,
    quality: 'high', qualityAuto: false, particleScale: 1.0,
    obstacles: [], explosiveBarrels: [], firePits: [],
};

// ── Engine objects ─────────────────────────────────────────────────────
let renderer, composer, bloomPass, camera, world, canvas;
let _clock, _raycaster, _radarEveryMs = 1000 / 30, _lastRadarAt = 0;
let _mouseSensitivity = 0.0018, _yaw = 0, _pitch = 0;
let _shakeUntil = 0, _shakeIntensity = 0, _baseCamY = 2.2, _reloadDip = 0;
let _paused = false, _settingsOpen = false;
const _activePickups = [];
const _transients = []; // tracers, grenades, pickups bob, etc: {update(dt,now), done}
let _lowHpActive = false, _heartbeatPhase = 0;
let _killStreakCount = 0, _killStreakTimer = 0;

// ── Boot ───────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
    animateLoadingBar(() => {
        try { $('aw-loading').style.display = 'none'; initEngine(); }
        catch (e) { console.error('Engine init failed:', e); fatalError('Failed to start the 3D environment. Please reload.'); }
    });
});

const $ = (id) => document.getElementById(id);

function fatalError(msg) {
    const el = $('aw-loading'); if (!el) { alert(msg); return; }
    el.style.display = 'flex';
    const sub = el.querySelector('.aw-loading-sub'), hint = el.querySelector('.aw-loading-hint'), bar = el.querySelector('.aw-loading-bar-wrap');
    if (sub) { sub.textContent = 'SYSTEM ERROR'; sub.style.color = '#ff5a4d'; }
    if (hint) hint.textContent = msg;
    if (bar) bar.style.display = 'none';
}

function animateLoadingBar(onComplete) {
    const fill = $('aw-loading-fill'); let pct = 0;
    const iv = setInterval(() => {
        pct += Math.random() * 14 + 4;
        fill.style.width = Math.min(pct, 95) + '%';
        if (pct >= 95) { clearInterval(iv); fill.style.width = '100%'; setTimeout(onComplete, 300); }
    }, 80);
}

// The canvas sits below the fixed header. renderer.setSize() writes inline
// width/height styles onto the canvas, which override the stylesheet's
// `calc(100% - 44px)` — so the number used here must match the header's real
// height or the drawing buffer ends up smaller than the area it covers, leaving
// dead black bands. Measure the header instead of hardcoding it.
function viewportSize() {
    if (IS_APP_MODE) return { w: window.innerWidth, h: Math.max(1, window.innerHeight) };
    const header = document.querySelector('.aw-header');
    const top = header ? Math.round(header.getBoundingClientRect().height) : 44;
    return { w: window.innerWidth, h: Math.max(1, window.innerHeight - top) };
}

// UnrealBloomPass allocates all of its render targets as HalfFloatType and blurs
// them with the WebGLRenderTarget default LinearFilter. Linear filtering of a
// half-float texture is an *optional* WebGL feature (OES_texture_half_float_linear
// — not implied by WebGL2), and Intel UHD via ANGLE/D3D11 is one of the common
// configurations that lacks it. Every filtered tap then reads back as zero and the
// bloom composite renders the whole frame solid black, with no GL error raised.
// Byte targets are linear-filterable everywhere, so retype the pass rather than
// dropping the effect: bloom keeps working, only its HDR headroom is reduced.
function patchBloomForFiltering(ren, pass) {
    let ok = false;
    try { ok = !!ren.getContext().getExtension('OES_texture_half_float_linear'); } catch (e) { /* treat as unsupported */ }
    if (ok) return;
    const targets = [pass.renderTargetBright, ...(pass.renderTargetsHorizontal || []), ...(pass.renderTargetsVertical || [])];
    for (const rt of targets) {
        if (!rt) continue;
        rt.texture.type = THREE.UnsignedByteType;
        rt.texture.needsUpdate = true;
        rt.dispose(); // force reallocation with the new type on next use
    }
    console.warn('[MW] half-float linear filtering unavailable — bloom switched to 8-bit targets.');
}

function pickAutoQuality() {
    const cores = navigator.hardwareConcurrency || 4, dpr = window.devicePixelRatio || 1;
    const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
    if (mobile || cores <= 4 || dpr > 2) return 'low';
    if (cores <= 8) return 'medium';
    return 'high';
}

function resolveQuality(sel) {
    if (sel === 'auto') { AW.qualityAuto = true; return pickAutoQuality(); }
    AW.qualityAuto = false;
    return QUALITY_PRESETS[sel] ? sel : 'high';
}

function applyQuality(sel) {
    const resolved = resolveQuality(sel);
    const p = QUALITY_PRESETS[resolved];
    AW.quality = resolved; AW.particleScale = p.particleScale;
    _radarEveryMs = 1000 / p.radarFps;
    if (renderer) {
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, p.pixelRatioCap));
        // setPixelRatio() does NOT resize the drawing buffer on its own — must
        // re-call setSize() afterwards, or on HiDPI displays (devicePixelRatio>1)
        // the buffer/viewport mismatch renders a black canvas.
        const { w, h } = viewportSize();
        renderer.setSize(w, h);
        if (composer) composer.setSize(w, h);
    }
    if (bloomPass) { bloomPass.enabled = p.bloom; if (p.bloomStrength) bloomPass.strength = p.bloomStrength; }
    const q = $('aw-quality'); if (q) q.value = sel;
}

// ── Engine init ────────────────────────────────────────────────────────
function initEngine() {
    if (IS_APP_MODE) document.body.classList.add('mw-app-mode');
    canvas = $('aw-canvas');
    const _preserve = new URLSearchParams(location.search).has('preserve');
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: _preserve });
    const _vp = viewportSize();
    renderer.setSize(_vp.w, _vp.h);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    camera = new THREE.PerspectiveCamera(70, _vp.w / _vp.h, 0.1, 400);

    const urlScene = detectSceneFromUrl();
    if (urlScene) AW.currentScene = urlScene;

    // Direct navigation (bookmark, typed URL, share link) to a locked arena —
    // send the player back to the campaign hub instead of silently letting
    // them play out of order. Arena pages always live one level below /play/.
    if (urlScene && !Save.isUnlocked(urlScene)) {
        location.href = '../' + (new URLSearchParams(location.search).has('app') ? '?app=1' : '');
        return;
    }

    buildScenePicker();
    const q = $('aw-quality');
    // Priority: ?quality= override (testing/low-end devices) → touch default
    // (auto → low) → the player's saved preference → the HTML default.
    const urlQ = new URLSearchParams(location.search).get('quality');
    const savedQuality = Save.load().settings.quality;
    if (urlQ && q) q.value = urlQ;
    else if (IS_TOUCH && q) q.value = 'auto';
    else if (savedQuality && q) q.value = savedQuality;
    applyQuality(q ? q.value : 'high');

    buildScene(AW.currentScene);

    window.addEventListener('resize', onResize);
    setupInput();

    _clock = new THREE.Clock();
    _raycaster = new THREE.Raycaster();
    // Enemy HP bars are THREE.Sprites, and Sprite.raycast() dereferences
    // Raycaster.camera. Without this, the first shot fired once a sprite-
    // bearing enemy (grunt/heavy/drone/boss — anything with hp > 1) is on
    // screen throws mid-loop and hit detection silently stops working.
    _raycaster.camera = camera;
    renderer.setAnimationLoop(renderLoop);

    $('aw-start-btn').addEventListener('click', startGame);
    $('aw-restart-btn').addEventListener('click', restartGame);
    $('aw-win-restart-btn').addEventListener('click', restartGame);
    initSettings();
    // NOTE: enemy context is provided inside buildScene() once world.scene + pools
    // exist — do NOT set a null-scene context here (it would clobber the good one).
}

function onResize() {
    const { w, h } = viewportSize();
    renderer.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    if (composer) composer.setSize(w, h);
}

// Path segments with a '.' (e.g. 'index.html') are never a scene slug — under
// Capacitor/Electron the URL ends in a literal filename, not a clean slug.
function pathSceneSegment() {
    const segs = (location.pathname || '').split('/').filter((s) => s && !s.includes('.'));
    const last = segs[segs.length - 1] || '';
    return (last && SCENE_CONFIGS[last]) ? last : null;
}

// Tiered resolve so this keeps working under any URL scheme a wrapper uses:
// explicit body flag → query override (testing/share links) → path segment
// → default. buildScenePicker() shares pathSceneSegment() for consistency.
function detectSceneFromUrl() {
    const bodyScene = document.body && document.body.dataset.scene;
    if (bodyScene && SCENE_CONFIGS[bodyScene]) return bodyScene;
    const qScene = new URLSearchParams(location.search).get('scene');
    if (qScene && SCENE_CONFIGS[qScene]) return qScene;
    return pathSceneSegment();
}

function buildScenePicker() {
    const picker = $('aw-scene-picker'); if (!picker) return;
    const segs = (location.pathname || '').split('/').filter((s) => s && !s.includes('.'));
    // Arena pages are siblings; the hub's arena links live below /play/.
    // Looking at the final segment (not total URL depth) also supports sites
    // mounted under a project path.
    const prefix = segs[segs.length - 1] === 'play' ? './' : '../';
    picker.innerHTML = '';
    const save = Save.load();
    const cleared = new Set(save.progress.missionsCompleted);
    const unlocked = new Set(save.progress.arenasUnlocked);
    const clearedCount = MISSION_ORDER.filter((id) => cleared.has(id)).length;

    const progress = document.getElementById('aw-scene-picker-progress');
    if (progress) progress.textContent = `${clearedCount} / ${MISSION_ORDER.length} SECTORS CLEARED`;

    MISSION_ORDER.forEach((id, i) => {
        const cfg = SCENE_CONFIGS[id]; if (!cfg) return;
        const isUnlocked = unlocked.has(id);
        const isCleared = cleared.has(id);
        const card = document.createElement(isUnlocked ? 'a' : 'div');
        card.className = 'aw-scene-card'
            + (id === AW.currentScene ? ' selected' : '')
            + (isCleared ? ' cleared' : '')
            + (isUnlocked ? '' : ' locked');
        card.dataset.sceneId = id;
        if (isUnlocked) {
            // Preserve ?app=1 across navigation for the query-string testing
            // path; window.MW_NATIVE (the real wrapper flag) is set by the
            // host shell itself and needs no carrying.
            card.href = prefix + id + '/' + (IS_APP_MODE && new URLSearchParams(location.search).has('app') ? '?app=1' : '');
            card.setAttribute('aria-label', `Deploy to ${cfg.name}`);
        } else {
            const prevCfg = SCENE_CONFIGS[MISSION_ORDER[i - 1]];
            card.setAttribute('aria-label', `Locked — complete ${prevCfg ? prevCfg.name : 'the previous sector'} first`);
        }
        const img = cfg.previewImage
            ? `<span class="aw-scene-card-img" style="background-image:url('${withVersion(cfg.previewImage)}')"></span>`
            : `<span class="aw-scene-card-img" style="background:${cfg.previewGradient || '#111'}"></span>`;
        const s = String(i + 1).padStart(2, '0');
        const badge = isCleared ? '<span class="aw-scene-card-cleared">✓ CLEARED</span>' : '';
        const lockOverlay = isUnlocked ? '' : `
            <span class="aw-scene-card-lock">🔒</span>
            <span class="aw-scene-card-lockmsg">COMPLETE ${MISSION_ORDER[i - 1] ? SCENE_CONFIGS[MISSION_ORDER[i - 1]].name : ''} TO UNLOCK</span>`;
        card.innerHTML = `
            ${img}
            <span class="aw-scene-card-shade"></span>
            <span class="aw-scene-card-scan"></span>
            <span class="aw-scene-card-sector">SECTOR ${s}</span>
            ${badge}
            <span class="aw-scene-card-name">${cfg.name}</span>
            <span class="aw-scene-card-desc">${cfg.description}</span>
            ${isUnlocked ? '<span class="aw-scene-card-enter">▶ ENTER</span>' : lockOverlay}
        `;
        picker.appendChild(card);
    });
}

// ── Scene build / dispose ──────────────────────────────────────────────
function buildScene(sceneId) {
    const p = QUALITY_PRESETS[AW.quality];
    world = new World(renderer, camera);
    const cfg = world.build(sceneId, p);
    AW.sceneConfig = cfg; AW.currentScene = cfg.id;
    AW.obstacles = world.obstacles;
    AW.explosiveBarrels = world.explosiveBarrels;
    AW.firePits = world.firePits;

    const ps = cfg.playerStart, pl = cfg.playerLookAt;
    camera.position.set(ps.x, ps.y, ps.z);
    camera.lookAt(pl.x, pl.y, pl.z);
    _baseCamY = ps.y;
    // initialize yaw/pitch from look direction
    const dir = new THREE.Vector3(pl.x - ps.x, 0, pl.z - ps.z).normalize();
    _yaw = Math.atan2(dir.x, dir.z); _pitch = 0;

    // Post-processing
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(world.scene, camera));
    const vp = viewportSize();
    bloomPass = new UnrealBloomPass(new THREE.Vector2(vp.w, vp.h),
        (p.bloomStrength ?? 0.8) * (1 + (cfg.lighting.glowIntensity || 0)), 0.5, 0.85);
    bloomPass.enabled = p.bloom;
    patchBloomForFiltering(renderer, bloomPass);
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());
    composer.setSize(vp.w, vp.h);

    // wire enemy context to this scene's objects
    setContext({
        scene: world.scene, camera, pools: world.pools, audio: Audio, AW,
        onPlayerDamage, addScore, checkKillStreak, spawnExplosion,
        checkCollision, spawnEnemyTracer, onWaveComplete,
    });

    HUD.init(AW, WEAPONS);
    WaveManager.init();
}

function disposeScene() {
    WaveManager.reset();
    _activePickups.length = 0;
    _transients.length = 0;
    AW.obstacles = []; AW.firePits = []; AW.explosiveBarrels = [];
    _lowHpActive = false; _heartbeatPhase = 0;
    const flash = $('hud-damage-flash'); if (flash) flash.style.opacity = '0';
    if (world) { world.dispose(); world = null; }
}

// ── Render loop ────────────────────────────────────────────────────────
function renderLoop() {
    const dt = Math.min(_clock.getDelta(), 0.05);
    const now = performance.now();
    if (!_paused && !_settingsOpen) pollGamepad(dt);
    if (AW.state === 'playing' && !_paused && !_settingsOpen) {
        updatePlayerMovement(dt);
        WaveManager.tick(dt);
        updateTransients(dt, now);
        checkPickupCollection();
        updateLowHP(now);
        applyShake(now);
        if (now - _lastRadarAt >= _radarEveryMs) {
            HUD.drawRadar(now, WaveManager.activeEnemies, _activePickups, AW.explosiveBarrels, camera);
            _lastRadarAt = now;
        }
        HUD.update();
        // Hold-to-fire for every weapon (rate capped per-weapon in fireWeapon).
        // This makes the touch fire button and mobile play feel smooth, while
        // desktop mouse clicks still fire one shot per click.
        if (AW.shooting && !AW.reloading) fireWeapon();
    }
    if (world) world.update(dt, now);
    if (_noFx || !composer) renderer.render(world.scene, camera);
    else composer.render();
}
const _noFx = new URLSearchParams(location.search).has('nofx');

function updateTransients(dt, now) {
    for (let i = _transients.length - 1; i >= 0; i--) {
        if (_transients[i].update(dt, now)) _transients.splice(i, 1);
    }
}

// ── Input ──────────────────────────────────────────────────────────────
// Capability flags (touch hides pointer-lock-only mouse UI).
const IS_TOUCH = typeof window !== 'undefined' && (('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0);

function setupInput() {
    canvas.addEventListener('click', () => {
        // Pointer lock is desktop-only; on touch devices aiming is handled
        // by the virtual right-side drag zone.
        if (IS_TOUCH) return;
        if (AW.state === 'playing' && document.pointerLockElement !== canvas) canvas.requestPointerLock();
    });
    document.addEventListener('pointerlockchange', () => {
        const locked = document.pointerLockElement === canvas;
        if (!locked) AW.shooting = false; // never leave the trigger held
        const hint = $('aw-click-hint'); if (hint) hint.style.display = locked ? 'none' : '';
    });

    document.addEventListener('mousemove', (e) => {
        if (IS_TOUCH) return;
        if (AW.state !== 'playing' || document.pointerLockElement !== canvas) return;
        _yaw -= e.movementX * _mouseSensitivity;
        _pitch -= e.movementY * _mouseSensitivity;
        _pitch = Math.max(-0.61, Math.min(0.70, _pitch));
        applyCameraLook();
    });

    document.addEventListener('mousedown', (e) => {
        if (e.button !== 0 || AW.state !== 'playing' || document.pointerLockElement !== canvas) return;
        AW.shooting = true; fireWeapon();
    });
    document.addEventListener('mouseup', (e) => { if (e.button === 0) AW.shooting = false; });
    document.addEventListener('wheel', (e) => {
        if (IS_TOUCH) return;
        if (AW.state !== 'playing' || document.pointerLockElement !== canvas) return;
        e.preventDefault();
        switchWeapon((AW.currentWeapon + (e.deltaY > 0 ? 1 : -1) + WEAPONS.length) % WEAPONS.length);
    }, { passive: false });

    document.addEventListener('keydown', (e) => {
        AW.keys[e.code] = true;
        if (AW.state !== 'playing') return;
        if (e.code === 'Digit1') switchWeapon(0);
        if (e.code === 'Digit2') switchWeapon(1);
        if (e.code === 'Digit3') switchWeapon(2);
        if (e.code === 'KeyR' && !AW.reloading) triggerReload();
        if (e.code === 'KeyG') throwGrenade();
        if (e.code === 'Space') { e.preventDefault(); togglePause(); }
    });
    document.addEventListener('keyup', (e) => { AW.keys[e.code] = false; });

    if (IS_TOUCH) setupTouchControls();
}

function applyCameraLook() {
    const cp = Math.cos(_pitch);
    const fwd = new THREE.Vector3(Math.sin(_yaw) * cp, Math.sin(_pitch), Math.cos(_yaw) * cp);
    camera.lookAt(camera.position.x + fwd.x, camera.position.y + fwd.y, camera.position.z + fwd.z);
}

function getForward() {
    const v = new THREE.Vector3();
    camera.getWorldDirection(v);
    return v;
}

// ── Touch controls (virtual joystick + look-drag + action buttons) ────
const _touch = {
    joyId: null, aimId: null, joyOrigin: null, aimLast: null,
    knob: null, base: null, host: null, aimEl: null, r: 56,
};
function setupTouchControls() {
    const hud = $('hud'); if (!hud) return;
    // Stop Safari/Android default gestures (scroll, pinch-zoom, long-press).
    for (const ev of ['touchmove', 'touchstart', 'touchend', 'touchcancel']) {
        document.addEventListener(ev, onTouch, { passive: false });
    }
    document.addEventListener('contextmenu', (e) => e.preventDefault());

    const host = document.createElement('div');
    host.id = 'touch-controls';
    host.className = 'touch-controls';
    host.innerHTML = `
        <div class="tc-zone tc-zone-move" id="tc-zone-move">MOVE<br><svg width="20" height="14" viewBox="0 0 20 14"><path d="M6 12v-8H1l9-4 9 4h-5v8z" fill="currentColor"/></svg></div>
        <div class="tc-zone tc-zone-aim" id="tc-zone-aim">AIM <br> DRAG</div>
        <div class="tc-joy" id="tc-joy"><div class="tc-joy-base"><div class="tc-joy-knob" id="tc-joy-knob"></div></div></div>
        <div class="tc-buttons">
            <button class="tc-btn tc-btn-grenade" id="tc-grenade" type="button">G</button>
            <button class="tc-btn tc-btn-reload" id="tc-reload" type="button">R</button>
        </div>
        <button class="tc-fire" id="tc-fire" type="button">FIRE</button>
        <div class="tc-weapons" id="tc-weapons">
            <button class="tc-wbtn active" data-w="0" type="button">1</button>
            <button class="tc-wbtn" data-w="1" type="button">2</button>
            <button class="tc-wbtn" data-w="2" type="button">3</button>
        </div>
        <div class="tc-hint">DRAG RIGHT SIDE TO AIM · LEFT JOYSTICK TO MOVE</div>`;
    hud.appendChild(host);
    _touch.host = host;
    _touch.knob = $('tc-joy-knob');
    _touch.base = $('tc-joy');
    _touch.aimEl = $('tc-zone-aim');

    const fireBtn = $('tc-fire');
    const press = (fn) => (e) => { e.preventDefault(); e.stopPropagation(); fn(); };
    fireBtn.addEventListener('touchstart', press(() => { if (AW.state === 'playing') { AW.shooting = true; fireWeapon(); } }), { passive: false });
    fireBtn.addEventListener('touchend', press(() => { AW.shooting = false; }), { passive: false });
    fireBtn.addEventListener('touchcancel', press(() => { AW.shooting = false; }), { passive: false });
    fireBtn.addEventListener('mousedown', (e) => { e.preventDefault(); AW.shooting = true; if (AW.state === 'playing') fireWeapon(); });
    document.addEventListener('mouseup', () => { AW.shooting = false; });

    $('tc-reload').addEventListener('touchstart', press(() => { if (!AW.reloading) triggerReload(); }), { passive: false });
    $('tc-grenade').addEventListener('touchstart', press(() => throwGrenade()), { passive: false });
    for (const b of host.querySelectorAll('.tc-wbtn')) {
        b.addEventListener('touchstart', press(() => switchWeapon(+b.dataset.w)), { passive: false });
    }
    document.addEventListener('visibilitychange', () => { if (document.hidden) { AW.shooting = false; } });
    updateTouchWeaponUI(0);
}

function updateTouchWeaponUI(idx) {
    const host = _touch.host; if (!host) return;
    for (const b of host.querySelectorAll('.tc-wbtn')) {
        b.classList.toggle('active', +b.dataset.w === idx);
    }
    const f = $('tc-fire');
    if (f && idx === 1) f.classList.add('shotgun');
    else if (f) f.classList.remove('shotgun');
}

// Route raw touches by start position → move joystick, look-drag, or a button.
function onTouch(e) {
    if (AW.state !== 'playing') return; // overlays/buttons receive taps normally
    if (e.cancelable) {
        // Don't swallow taps aimed at real controls (header buttons, etc.).
        let overCtl = false;
        for (const t of e.changedTouches) {
            const el = document.elementFromPoint(t.clientX, t.clientY);
            if (el && el.closest && el.closest('button, a, select, input, .aw-overlay')) { overCtl = true; break; }
        }
        if (!overCtl) e.preventDefault();
    }
    for (const t of e.changedTouches) {
        const x = t.clientX, y = t.clientY;
        if (e.type === 'touchstart') {
            const over = document.elementFromPoint(x, y);
            if (over && over.closest && over.closest('button, a, select, input, .tc-btn, .tc-wbtn, .tc-fire')) continue; // buttons handle themselves
            if (_touch.joyId !== null) continue;
            if (x < window.innerWidth * 0.45) {
                _touch.joyId = t.identifier;
                _touch.joyOrigin = { x, y };
                _touch.base.classList.add('on');
                _touch.base.style.left = (x - _touch.r) + 'px';
                _touch.base.style.top = (y - _touch.r) + 'px';
                _touch.knob.style.transform = 'translate(0px,0px)';
                setTouchMove(0, 0);
            } else if (_touch.aimId === null) {
                _touch.aimId = t.identifier;
                _touch.aimLast = { x, y };
            }
        } else if (e.type === 'touchmove') {
            if (t.identifier === _touch.joyId && _touch.joyOrigin) {
                let dx = t.clientX - _touch.joyOrigin.x, dy = t.clientY - _touch.joyOrigin.y;
                const len = Math.hypot(dx, dy);
                if (len > _touch.r) { dx = dx / len * _touch.r; dy = dy / len * _touch.r; }
                _touch.knob.style.transform = `translate(${dx}px,${dy}px)`;
                // x: +right, y: +up on screen.
                setTouchMove(dx / _touch.r, -dy / _touch.r);
            } else if (t.identifier === _touch.aimId && _touch.aimLast) {
                const dx = t.clientX - _touch.aimLast.x, dy = t.clientY - _touch.aimLast.y;
                _touch.aimLast = { x: t.clientX, y: t.clientY };
                const k = (_mouseSensitivity / 0.0018) * 0.0062; // scale with the sensitivity slider
                _yaw -= dx * k;
                _pitch -= dy * k;
                _pitch = Math.max(-0.61, Math.min(0.70, _pitch));
                applyCameraLook();
            }
        } else { // end / cancel
            if (t.identifier === _touch.joyId) {
                _touch.joyId = null; _touch.joyOrigin = null;
                _touch.base.classList.remove('on'); _touch.knob.style.transform = 'translate(0px,0px)';
                setTouchMove(0, 0);
            }
            if (t.identifier === _touch.aimId) { _touch.aimId = null; _touch.aimLast = null; }
        }
    }
}

export function setTouchMoveEnabled(enabled) {
    _touch.host && _touch.host.classList.toggle('disabled', !enabled);
}

// ── Gamepad ────────────────────────────────────────────────────────────
// Polled once per frame from renderLoop (not event-driven — the Gamepad API
// has no input events, only a snapshot via navigator.getGamepads()).
// Bindings: left stick move, right stick look, RT shoot, LB/RB switch
// weapon, X reload, Y grenade, Start pause. Deadzone from the save so a
// worn stick doesn't drift the camera; light aim assist reuses _raycaster.
const _gp = { index: null, prevButtons: [] };
function pollGamepad(dt) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let pad = null;
    for (const p of pads) { if (p && p.connected) { pad = p; break; } }
    if (!pad) { _gp.index = null; _touchMove = _touchMove && _touchMove._src === 'gamepad' ? null : _touchMove; return; }
    _gp.index = pad.index;

    const dz = Save.load().settings.gamepadDeadzone ?? 0.18;
    const applyDz = (v) => (Math.abs(v) < dz ? 0 : v);
    const lx = applyDz(pad.axes[0] || 0), ly = applyDz(pad.axes[1] || 0);
    const rx = applyDz(pad.axes[2] || 0), ry = applyDz(pad.axes[3] || 0);

    // Left stick feeds the same {x,y} shape updatePlayerMovement() already
    // reads for touch, so movement logic isn't duplicated per input scheme.
    if (lx !== 0 || ly !== 0) { _touchMove = { x: lx, y: -ly, _src: 'gamepad' }; }
    else if (_touchMove && _touchMove._src === 'gamepad') { _touchMove = null; }

    // Right stick look — same yaw/pitch math as the mouse handler, scaled by dt
    // instead of raw pixel deltas since this is a per-frame poll, not an event.
    if (rx !== 0 || ry !== 0) {
        _yaw -= rx * 2.2 * dt;
        _pitch -= ry * 1.8 * dt;
        _pitch = Math.max(-0.61, Math.min(0.70, _pitch));
        applyCameraLook();
    }

    if (AW.state !== 'playing') { _gp.prevButtons = pad.buttons.map((b) => b.pressed); return; }

    const btn = (i) => pad.buttons[i] && pad.buttons[i].pressed;
    const justPressed = (i) => btn(i) && !_gp.prevButtons[i];

    AW.shooting = btn(7); // RT
    if (justPressed(4)) switchWeapon((AW.currentWeapon - 1 + WEAPONS.length) % WEAPONS.length); // LB
    if (justPressed(5)) switchWeapon((AW.currentWeapon + 1) % WEAPONS.length); // RB
    if (justPressed(2) && !AW.reloading) triggerReload(); // X
    if (justPressed(3)) throwGrenade(); // Y
    if (justPressed(9)) togglePause(); // Start

    _gp.prevButtons = pad.buttons.map((b) => b.pressed);
}
window.addEventListener('gamepadconnected', (e) => { _gp.index = e.gamepad.index; });
window.addEventListener('gamepaddisconnected', () => { _gp.index = null; _gp.prevButtons = []; });

// ── Movement ───────────────────────────────────────────────────────────
// Touch joystick state: {x,y} in [-1,1] (x = right, y = up on screen).
let _touchMove = null;
export function setTouchMove(x, y) {
    _touchMove = (x === 0 && y === 0) ? null : { x, y };
}

function updatePlayerMovement(dt) {
    const keys = AW.keys, speed = AW.moveSpeed * dt;
    const up = new THREE.Vector3(0, 1, 0);
    const fwd = getForward(); fwd.y = 0; fwd.normalize();
    // Right vector: cross(fwd, up) — the previous code used cross(up, fwd),
    // which is the LEFT vector, so A/D strafed in reverse.
    const right = new THREE.Vector3().crossVectors(fwd, up).normalize();

    let mx = 0, mz = 0;
    if (keys['KeyW'] || keys['ArrowUp']) { mx += fwd.x; mz += fwd.z; }
    if (keys['KeyS'] || keys['ArrowDown']) { mx -= fwd.x * 0.7; mz -= fwd.z * 0.7; }
    if (keys['KeyA'] || keys['ArrowLeft']) { mx -= right.x * 0.8; mz -= right.z * 0.8; }
    if (keys['KeyD'] || keys['ArrowRight']) { mx += right.x * 0.8; mz += right.z * 0.8; }
    if (_touchMove) {
        mx += right.x * _touchMove.x + fwd.x * _touchMove.y;
        mz += right.z * _touchMove.x + fwd.z * _touchMove.y;
    }
    // Normalize diagonals so moving every direction is equally fast.
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }

    const oldX = camera.position.x, oldZ = camera.position.z;
    let nx = oldX + mx * speed, nz = oldZ + mz * speed;
    if (!checkCollision(nx, nz, 0.5)) { camera.position.x = nx; camera.position.z = nz; }
    else if (!checkCollision(nx, oldZ, 0.5)) camera.position.x = nx;
    else if (!checkCollision(oldX, nz, 0.5)) camera.position.z = nz;
    camera.position.y = _baseCamY - _reloadDip; // shake adds on top in applyShake
}

function checkCollision(x, z, radius) {
    const perim = AW.sceneConfig ? AW.sceneConfig.perimeter : { halfW: 55, halfD: 55 };
    const hw = perim.halfW - radius, hd = perim.halfD - radius;
    if (x < -hw || x > hw || z < -hd || z > hd) return true;
    for (const ob of AW.obstacles) {
        if (x > ob.x - ob.hw - radius && x < ob.x + ob.hw + radius &&
            z > ob.z - ob.hd - radius && z < ob.z + ob.hd + radius) return true;
    }
    return false;
}

// ── Weapons / shooting ─────────────────────────────────────────────────
function switchWeapon(idx) {
    if (idx === AW.currentWeapon || AW.reloading) return;
    AW.currentWeapon = idx;
    const w = WEAPONS[idx];
    AW.ammo = w.ammo; AW.maxAmmo = w.ammo; AW.reloading = false;
    HUD.showWeaponSwitch(w.name); HUD.update(); Audio.playReload();
    updateTouchWeaponUI(idx);
}

function fireWeapon() {
    if (AW.reloading) return;
    const w = WEAPONS[AW.currentWeapon];
    const now = performance.now();
    if (now - AW.lastFireTime < w.fireRate) return;
    if (AW.ammo <= 0) { Audio.playEmptyClick(); triggerReload(); return; }
    AW.ammo--; AW.lastFireTime = now; AW.waveShots++; HUD.update();
    if (w.sound === 'shotgun') Audio.playShotgun(); else if (w.sound === 'minigun') Audio.playMinigun(); else Audio.playGunshot();
    HUD.muzzleFlash();
    if (w.name === 'SHOTGUN') screenShake(3, 150);

    const origin = camera.position.clone();
    const forward = getForward();
    for (let p = 0; p < w.pellets; p++) {
        const dir = forward.clone();
        if (w.spread > 0) {
            dir.x += (Math.random() - 0.5) * w.spread;
            dir.y += (Math.random() - 0.5) * w.spread;
            dir.z += (Math.random() - 0.5) * w.spread;
            dir.normalize();
        }
        _raycaster.set(origin, dir); _raycaster.far = 320;
        const hits = _raycaster.intersectObjects(world.scene.children, true);
        for (const hit of hits) {
            const meta = findMeta(hit.object);
            if (!meta) continue;
            if (meta.isEnemy) {
                const enemy = meta.enemyRef;
                if (enemy && !enemy.dead) {
                    let dmg = w.damage;
                    const base = enemy.root ? enemy.root.position.y : 0;
                    if (hit.point.y > base + enemy.cfg.hitboxH * 0.7) { dmg *= 2; HUD.showWaveBanner('HEADSHOT'); }
                    enemy.takeDamage(dmg); Audio.playHit(); AW.waveHits++; spawnHitSparks(hit.point);
                }
                break;
            } else if (meta.isExplosiveBarrel && !meta.exploded) {
                const bd = AW.explosiveBarrels.find((b) => b.x === meta.x && b.z === meta.z);
                if (bd) explodeBarrel(bd);
                break;
            } else if (meta.isObstacle) {
                spawnWallSparks(hit.point);
                break;
            }
        }
    }
    if (AW.ammo <= 0) setTimeout(() => triggerReload(), 400);
}

function findMeta(obj) {
    let o = obj;
    while (o) { if (o.userData && (o.userData.isEnemy || o.userData.isExplosiveBarrel || o.userData.isObstacle)) return o.userData; o = o.parent; }
    return null;
}

function triggerReload() {
    if (AW.reloading || AW.ammo === AW.maxAmmo) return;
    AW.reloading = true; Audio.playReload(); HUD.showReload(true);
    reloadDipAnim();
    const w = WEAPONS[AW.currentWeapon];
    setTimeout(() => {
        AW.ammo = w.ammo; AW.maxAmmo = w.ammo; AW.reloading = false;
        HUD.showReload(false); HUD.update();
    }, w.reloadTime);
}

function reloadDipAnim() {
    const start = performance.now(), dur = 400;
    _transients.push({ update: (dt, now) => {
        const t = Math.min((now - start) / dur, 1);
        _reloadDip = Math.sin(t * Math.PI) * 0.15;
        if (t >= 1) { _reloadDip = 0; return true; }
        return false;
    } });
}

// ── Screen shake ───────────────────────────────────────────────────────
function screenShake(intensity, durationMs) {
    _shakeIntensity = intensity; _shakeUntil = performance.now() + durationMs;
    _shakeDuration = durationMs; _shakeStart = performance.now();
}
let _shakeDuration = 0, _shakeStart = 0;
function applyShake(now) {
    if (now < _shakeUntil) {
        const decay = 1 - (now - _shakeStart) / _shakeDuration;
        camera.position.y += (Math.random() - 0.5) * _shakeIntensity * decay * 0.1;
    }
}

// ── Particle bursts (via world pools) ──────────────────────────────────
function spawnHitSparks(pos) {
    world.pools.spark.emit(scaled(30), { x: pos.x, y: pos.y, z: pos.z, spread: 1, speed: 6, up: 3, life: [0.1, 0.5], size0: 0.18, size1: 0.04, color0: [1, 0.8, 0.2, 1], color1: [0.5, 0.1, 0, 0], gravity: 12 });
}
function spawnWallSparks(pos) {
    world.pools.spark.emit(scaled(18), { x: pos.x, y: pos.y, z: pos.z, spread: 1, speed: 4, up: 2, life: [0.05, 0.3], size0: 0.12, size1: 0.03, color0: [1, 0.9, 0.6, 1], color1: [0.3, 0.15, 0, 0], gravity: 8 });
}
function spawnExplosion(pos) {
    Audio.playExplosion();
    const flash = new THREE.PointLight(new THREE.Color(1, 0.6, 0.2), 30, 18);
    flash.position.copy(pos); world.scene.add(flash);
    let t = 0;
    _transients.push({ update: (dt) => { t += dt; flash.intensity = 30 * Math.max(0, 1 - t / 0.2); if (t > 0.2) { world.scene.remove(flash); return true; } return false; } });
    world.pools.fire.emit(scaled(120), { x: pos.x, y: pos.y, z: pos.z, spread: 1, speed: 8, up: 1.5, life: [0.3, 0.9], size0: 2.5, size1: 0.5, color0: [1, 0.8, 0.3, 1], color1: [0.2, 0.1, 0, 0], gravity: 5 });
    setTimeout(() => {
        if (!world) return;
        world.pools.smoke.emit(scaled(40), { x: pos.x, y: pos.y, z: pos.z, spread: 1, speed: 3, up: 3, life: [1.5, 4], size0: 1, size1: 4, color0: [0.3, 0.28, 0.25, 0.8], color1: [0.05, 0.05, 0.05, 0] });
    }, 150);
}
function scaled(n) { return Math.max(6, Math.round(n * AW.particleScale)); }

// ── Explosive barrels ──────────────────────────────────────────────────
function explodeBarrel(bd) {
    if (bd.exploded) return;
    bd.exploded = true; bd.mesh.userData.exploded = true;
    const pos = new THREE.Vector3(bd.x, 1.0, bd.z);
    spawnExplosion(pos); screenShake(5, 300);
    for (const e of WaveManager.activeEnemies) {
        if (e.dead || !e.root) continue;
        const d = Math.hypot(e.root.position.x - bd.x, e.root.position.z - bd.z);
        if (d < 8) e.takeDamage(Math.ceil(3 * (1 - d / 8)));
    }
    const pd = Math.hypot(camera.position.x - bd.x, camera.position.z - bd.z);
    if (pd < 8) onPlayerDamage(Math.ceil(20 * (1 - pd / 8)));
    // Detach only — the geometry/material are reused when restartGame()
    // restores the arena. World.dispose() still frees them on scene teardown.
    world.scene.remove(bd.mesh); world.scene.remove(bd.stripe);
}

// Put every exploded barrel back so a restart replays the same arena.
function resetExplosiveBarrels() {
    for (const bd of AW.explosiveBarrels) {
        if (!bd.exploded) continue;
        bd.exploded = false; bd.mesh.userData.exploded = false;
        world.scene.add(bd.mesh); world.scene.add(bd.stripe);
    }
}

// ── Enemy tracer ───────────────────────────────────────────────────────
function spawnEnemyTracer(from, to) {
    const dir = to.clone().sub(from).normalize();
    const len = 3;
    const tracer = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, len, 4),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.3, 0) }));
    tracer.position.copy(from);
    tracer.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    world.scene.add(tracer);
    const speed = 90, maxDist = from.distanceTo(to) + 5; let travelled = 0;
    _transients.push({ update: (dt) => {
        const d = speed * dt; tracer.position.addScaledVector(dir, d); travelled += d;
        if (travelled >= maxDist) { world.scene.remove(tracer); tracer.geometry.dispose(); tracer.material.dispose(); return true; }
        return false;
    } });
}

// ── Grenade ────────────────────────────────────────────────────────────
function throwGrenade() {
    if (AW.state !== 'playing' || AW.grenades <= 0) return;
    const now = performance.now();
    if (now - AW.lastGrenadeTime < 1000) return;
    AW.grenades--; AW.lastGrenadeTime = now; HUD.update(); Audio.playGunshot();
    const fwd = getForward(); fwd.y = 0.3; fwd.normalize();
    const g = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8),
        new THREE.MeshStandardMaterial({ color: new THREE.Color(0.2, 0.3, 0.1), emissive: new THREE.Color(0.05, 0.1, 0.02) }));
    g.position.copy(camera.position); g.position.y -= 0.3;
    world.scene.add(g);
    const vel = fwd.clone().multiplyScalar(48); let grav = 0;
    _transients.push({ update: (dt) => {
        grav += 9 * dt * 6 * dt; // approximate v1 accel curve
        g.position.addScaledVector(vel, dt);
        g.position.y -= grav;
        g.rotation.x += 6 * dt;
        if (g.position.y <= 0.15 || camera.position.distanceTo(g.position) > 35) {
            const pos = g.position.clone(); pos.y = 0.5;
            world.scene.remove(g); g.geometry.dispose(); g.material.dispose();
            spawnExplosion(pos); screenShake(5, 300);
            for (const e of WaveManager.activeEnemies) {
                if (e.dead || !e.root) continue;
                const d = pos.distanceTo(e.root.position);
                if (d < 10) e.takeDamage(d < 4 ? 6 : d < 7 ? 3 : 1);
            }
            return true;
        }
        return false;
    } });
    HUD.showWaveBanner(`GRENADE (${AW.grenades} LEFT)`);
}

// ── Pickups ────────────────────────────────────────────────────────────
function spawnPickups() {
    const types = ['health', 'health', 'ammo'];
    if (AW.playerHP >= AW.maxPlayerHP) types.shift();
    for (const type of types) {
        const angle = (Math.random() - 0.5) * Math.PI, dist = 8 + Math.random() * 10;
        // Clamp to the actual arena, not a hardcoded 55 — the perimeter is
        // per-scene and pickups used to strand outside the smaller arenas.
        const perim = AW.sceneConfig ? AW.sceneConfig.perimeter : { halfW: 55, halfD: 55 };
        const lx = perim.halfW - 3, lz = perim.halfD - 3;
        const cx = Math.max(-lx, Math.min(lx, camera.position.x + Math.sin(angle) * dist));
        const cz = Math.max(-lz, Math.min(lz, camera.position.z - Math.abs(Math.cos(angle)) * dist));
        const size = 0.6;
        const mat = new THREE.MeshStandardMaterial(type === 'health'
            ? { color: new THREE.Color(0.1, 0.6, 0.2), emissive: new THREE.Color(0.05, 0.3, 0.1) }
            : { color: new THREE.Color(0.6, 0.5, 0.1), emissive: new THREE.Color(0.2, 0.15, 0) });
        const crate = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), mat);
        crate.position.set(cx, size / 2 + 0.1, cz);
        world.scene.add(crate);
        const startY = crate.position.y, bobOff = Math.random() * Math.PI * 2;
        const p = { mesh: crate, type, x: cx, z: cz };
        const updater = { update: (dt, now) => {
            if (!p.alive) return true;
            crate.position.y = startY + Math.sin(now * 0.003 + bobOff) * 0.15;
            crate.rotation.y += 1.2 * dt;
            return false;
        } };
        p.alive = true; _transients.push(updater);
        _activePickups.push(p);
    }
}

function checkPickupCollection() {
    if (!_activePickups.length) return;
    for (let i = _activePickups.length - 1; i >= 0; i--) {
        const p = _activePickups[i];
        const dx = camera.position.x - p.x, dz = camera.position.z - p.z;
        if (dx * dx + dz * dz < 6.25) {
            if (p.type === 'health') { AW.playerHP = Math.min(AW.maxPlayerHP, AW.playerHP + 25); HUD.showWaveBanner('+25 HP'); }
            else { const w = WEAPONS[AW.currentWeapon]; AW.ammo = w.ammo; AW.maxAmmo = w.ammo; HUD.showWaveBanner('AMMO RESUPPLY'); }
            Audio.playReload(); HUD.update();
            p.alive = false; world.scene.remove(p.mesh); p.mesh.geometry.dispose(); p.mesh.material.dispose();
            _activePickups.splice(i, 1);
        }
    }
}

// ── Scoring / combo / killstreak ───────────────────────────────────────
function addScore(type) {
    const base = SCORE_VALUES[type] || 100, now = performance.now();
    if (now - AW.comboTimer < 2000) { AW.comboCount++; AW.comboMultiplier = Math.min(1 + AW.comboCount * 0.5, 5); }
    else { AW.comboCount = 0; AW.comboMultiplier = 1; }
    AW.comboTimer = now;
    const pts = Math.round(base * AW.comboMultiplier);
    AW.score += pts;
    if (AW.comboMultiplier > 1) HUD.showCombo(AW.comboMultiplier, pts);
}

const KILL_STREAKS = [
    { count: 2, text: 'DOUBLE KILL' }, { count: 3, text: 'TRIPLE KILL' }, { count: 4, text: 'QUAD KILL' },
    { count: 5, text: 'RAMPAGE' }, { count: 8, text: 'UNSTOPPABLE' }, { count: 10, text: 'GODLIKE' },
];
function checkKillStreak() {
    const now = performance.now();
    if (now - _killStreakTimer < 3000) _killStreakCount++; else _killStreakCount = 1;
    _killStreakTimer = now;
    let streak = null;
    for (const ks of KILL_STREAKS) if (_killStreakCount >= ks.count) streak = ks;
    if (streak) HUD.showKillStreak(streak.text);
}

// ── Low HP warning ─────────────────────────────────────────────────────
function updateLowHP(now) {
    const isLow = AW.playerHP > 0 && AW.playerHP <= 20;
    const el = $('hud-damage-flash'); if (!el) return;
    if (isLow && !_lowHpActive) { _lowHpActive = true; el.style.transition = 'none'; _heartbeatPhase = 0; }
    else if (!isLow && _lowHpActive) { _lowHpActive = false; el.style.transition = 'opacity 0.5s ease-out'; el.style.opacity = '0'; return; }
    if (_lowHpActive && AW.state === 'playing') {
        const phase = (now % 1200) / 1200;
        const intensity = 0.1 + Math.max(0, Math.sin(phase * Math.PI * 2)) * 0.45;
        el.style.opacity = intensity.toFixed(3);
        if (phase < 0.03 && _heartbeatPhase > 0.2 && _heartbeatPhase < 0.8) Audio.playHeartbeat();
        _heartbeatPhase = phase;
    }
}

// ── Damage / state transitions ─────────────────────────────────────────
function onPlayerDamage(amount, fromX, fromZ) {
    if (AW.state !== 'playing') return;
    AW.playerHP = Math.max(0, AW.playerHP - amount);
    AW.waveDamageTaken += amount;
    HUD.update(); HUD.damageFlash(); Audio.playDamage();
    if (fromX !== undefined) {
        const dx = fromX - camera.position.x, dz = fromZ - camera.position.z;
        const worldAngle = Math.atan2(dx, dz);
        const fwd = getForward(); const camAngle = Math.atan2(fwd.x, fwd.z);
        let rel = worldAngle - camAngle;
        while (rel > Math.PI) rel -= Math.PI * 2; while (rel < -Math.PI) rel += Math.PI * 2;
        HUD.showDamageDirection(rel);
    }
    if (AW.playerHP <= 0) gameOver();
}

function onWaveComplete() {
    showWaveStats(AW.wave);
    AW.wave++;
    if (AW.wave > AW.maxWaves) { setTimeout(gameWin, 2500); return; }
    setTimeout(() => {
        if (AW.state !== 'playing') return;
        Audio.playWaveAlarm(); spawnPickups();
        setTimeout(() => {
            if (AW.state !== 'playing') return;
            showWavePreview(AW.wave);
            setTimeout(() => { if (AW.state !== 'playing') return; resetWaveStats(); WaveManager.startWave(AW.wave); }, 2000);
        }, 1500);
    }, 2500);
}

function showWavePreview(n) {
    const c = WAVE_CONFIGS[Math.min(n - 1, WAVE_CONFIGS.length - 1)];
    HUD.showWaveBanner(c.enemies.map((e) => `${e.count} ${e.type.toUpperCase()}${e.count > 1 ? 'S' : ''}`).join('  ·  '));
}
function showWaveStats(n) {
    const kills = AW.kills - AW.waveKillsStart, acc = AW.waveShots > 0 ? Math.round(AW.waveHits / AW.waveShots * 100) : 0;
    const elapsed = ((performance.now() - AW.waveStartTime) / 1000).toFixed(1);
    HUD.showWaveBanner(`WAVE ${n} CLEAR  ·  ${kills} KILLS  ·  ${acc}% ACC  ·  ${AW.waveDamageTaken} DMG  ·  ${elapsed}s`);
}
function resetWaveStats() {
    AW.waveStartTime = performance.now(); AW.waveShots = 0; AW.waveHits = 0; AW.waveDamageTaken = 0; AW.waveKillsStart = AW.kills;
}

function startGame() {
    canvas.focus();
    if (!IS_TOUCH) { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); }
    $('aw-start').classList.add('hidden');
    resetState();
    Audio.init(); Audio.resume(); Audio.startAmbient(); Audio.startMusic();
    resetWaveStats(); WaveManager.startWave(AW.wave); HUD.update();
    updateMobileHints();
    setTimeout(() => { if (!IS_TOUCH && document.pointerLockElement !== canvas && AW.state === 'playing') { const h = $('aw-click-hint'); if (h) h.style.display = 'block'; } }, 800);
}

function restartGame() {
    canvas.focus(); if (!IS_TOUCH) canvas.requestPointerLock();
    $('aw-gameover').classList.add('hidden'); $('aw-win').classList.add('hidden');
    WaveManager.reset();
    resetState();
    AW.grenades = AW.maxGrenades;
    for (const p of _activePickups) {
        p.alive = false;
        world.scene.remove(p.mesh);
        p.mesh.geometry.dispose(); p.mesh.material.dispose();
    }
    _activePickups.length = 0; _transients.length = 0;
    resetExplosiveBarrels();
    _lowHpActive = false; _heartbeatPhase = 0; _killStreakCount = 0; _killStreakTimer = 0;
    Audio.resume(); Audio.startAmbient(); Audio.startMusic();
    resetWaveStats(); WaveManager.startWave(AW.wave); HUD.update();
    updateMobileHints();
}

function resetState() {
    AW.state = 'playing'; AW.playerHP = AW.maxPlayerHP; AW.currentWeapon = 0;
    AW.ammo = WEAPONS[0].ammo; AW.maxAmmo = WEAPONS[0].ammo;
    AW.kills = 0; AW.score = 0; AW.comboCount = 0; AW.comboMultiplier = 1;
    AW.wave = 1; AW.reloading = false; AW.shooting = false;
    _lastRadarAt = 0;
    const ps = AW.sceneConfig.playerStart, pl = AW.sceneConfig.playerLookAt;
    camera.position.set(ps.x, ps.y, ps.z);
    const dir = new THREE.Vector3(pl.x - ps.x, 0, pl.z - ps.z).normalize();
    _yaw = Math.atan2(dir.x, dir.z); _pitch = 0; applyCameraLook();
}

function gameOver() {
    AW.state = 'gameover'; AW.shooting = false; _lowHpActive = false; _heartbeatPhase = 0;
    const f = $('hud-damage-flash'); if (f) f.style.opacity = '0';
    Audio.stopAll(); document.exitPointerLock();
    $('aw-go-score').textContent = `WAVE ${AW.wave} — ${AW.kills} KILLS — ${AW.score} PTS`;
    $('aw-gameover').classList.remove('hidden');
}
function gameWin() {
    AW.state = 'win'; AW.shooting = false; _lowHpActive = false; _heartbeatPhase = 0;
    const f = $('hud-damage-flash'); if (f) f.style.opacity = '0';
    Audio.stopAll(); document.exitPointerLock();
    $('aw-win-score').textContent = `${AW.maxWaves} WAVES — ${AW.kills} KILLS — ${AW.score} PTS`;
    $('aw-win').classList.remove('hidden');
    const nextId = MISSION_ORDER[MISSION_ORDER.indexOf(AW.currentScene) + 1];
    const isNewUnlock = nextId && !Save.isUnlocked(nextId);
    Save.unlockNext(AW.currentScene);
    if (isNewUnlock) HUD.showWaveBanner(`SECTOR UNLOCKED: ${SCENE_CONFIGS[nextId].name}`);
}

// ── Pause / mute / settings ────────────────────────────────────────────
function togglePause() {
    if (AW.state !== 'playing') return;
    _paused = !_paused;
    $('aw-pause-btn').textContent = _paused ? 'RESUME' : 'PAUSE';
    if (_paused) { AW.shooting = false; if (!IS_TOUCH) document.exitPointerLock(); }
    else if (!IS_TOUCH) canvas.requestPointerLock();
    updateMobileHints();
}
function toggleMute() {
    const muted = Audio.toggleMute();
    $('aw-mute-btn').textContent = muted ? 'UNMUTE' : 'MUTE';
}
function toggleSettings() {
    _settingsOpen = !_settingsOpen;
    const panel = $('aw-settings');
    if (_settingsOpen) { panel.classList.remove('hidden'); if (AW.state === 'playing') { AW.shooting = false; if (!IS_TOUCH) document.exitPointerLock(); } }
    else { panel.classList.add('hidden'); if (AW.state === 'playing' && !IS_TOUCH) canvas.requestPointerLock(); }
}

function updateMobileHints() {
    if (IS_TOUCH) {
        const hint = $('aw-click-hint'); if (hint) hint.style.display = 'none';
        setTouchMoveEnabled(AW.state === 'playing' && !_paused && !_settingsOpen);
    }
}

// Apply every current slider/select value the way the input listeners would
// — this is the single apply path so a restored value never just sits in the
// DOM. Safe to call before Audio.init() (guarded) and again right after.
function applyAllSettingsControls() {
    const master = $('aw-vol-master'), sfx = $('aw-vol-sfx'), music = $('aw-vol-music'),
        sens = $('aw-sensitivity'), fog = $('aw-fog');
    if (Audio.masterGain && master) Audio.masterGain.gain.value = master.value / 100;
    if (Audio._sfxGain && sfx) Audio._sfxGain.gain.value = sfx.value / 100;
    if (Audio._musicGain && music) Audio._musicGain.gain.value = music.value / 100;
    if (sens) _mouseSensitivity = (sens.value / 100) * 0.005;
    if (world && world.scene.fog && fog) world.scene.fog.density = (fog.value / 100) * 0.02;
}

function initSettings() {
    const el = $;
    const master = el('aw-vol-master'), sfx = el('aw-vol-sfx'), music = el('aw-vol-music'),
        sens = el('aw-sensitivity'), fog = el('aw-fog'), q = el('aw-quality');

    // Hydrate controls from the save before wiring listeners, so a restored
    // value is visible in the UI immediately (applyAllSettingsControls()
    // above pushes it into the live systems once they exist).
    const s = Save.load().settings;
    if (master && s.master != null) master.value = s.master;
    if (sfx && s.sfx != null) sfx.value = s.sfx;
    if (music && s.music != null) music.value = s.music;
    if (sens && s.sensitivity != null) sens.value = s.sensitivity;
    if (fog && s.fog != null) fog.value = s.fog;
    if (sens) _mouseSensitivity = (sens.value / 100) * 0.005;

    master && master.addEventListener('input', (e) => { if (Audio.masterGain) Audio.masterGain.gain.value = e.target.value / 100; Save.patch({ settings: { master: +e.target.value } }); });
    sfx && sfx.addEventListener('input', (e) => { if (Audio._sfxGain) Audio._sfxGain.gain.value = e.target.value / 100; Save.patch({ settings: { sfx: +e.target.value } }); });
    music && music.addEventListener('input', (e) => { if (Audio._musicGain) Audio._musicGain.gain.value = e.target.value / 100; Save.patch({ settings: { music: +e.target.value } }); });
    sens && sens.addEventListener('input', (e) => { _mouseSensitivity = (e.target.value / 100) * 0.005; Save.patch({ settings: { sensitivity: +e.target.value } }); });
    fog && fog.addEventListener('input', (e) => { if (world && world.scene.fog) world.scene.fog.density = (e.target.value / 100) * 0.02; Save.patch({ settings: { fog: +e.target.value } }); });
    if (q) q.addEventListener('change', (e) => {
        applyQuality(e.target.value);
        Save.patch({ settings: { quality: e.target.value } });
        if (AW.state === 'playing') HUD.showWaveBanner(`QUALITY: ${AW.quality.toUpperCase()}`);
    });
    el('aw-settings-close').addEventListener('click', toggleSettings);
}

// Expose header button handlers (index.html uses onclick)
window.togglePause = togglePause;
window.toggleMute = toggleMute;
window.toggleSettings = toggleSettings;
// Expose the game's procedural audio for the global soundtrack glue (game-music.js).
// Named AWAudio (not Audio) to avoid clobbering the native window.Audio constructor.
window.AWAudio = Audio;
// Debug/diagnostics surface (used by smoke tests; harmless in prod).
window.AWDebug = {
    AW, WaveManager,
    get enemies() { return WaveManager.activeEnemies.length; },
    get renderer() { return renderer; },
    get composer() { return composer; },
    get camera() { return camera; },
    get world() { return world; },
    get scene() { return world ? world.scene : null; },
};
