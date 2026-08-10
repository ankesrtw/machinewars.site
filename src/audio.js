'use strict';

/* ═══════════════════════════════════════════════════════════════════
   AUTONOMOUS WAR — audio.js
   Web Audio API sound system: procedural SFX, ambient drone, music

   WHY PROCEDURAL AUDIO?
   ─────────────────────
   Instead of loading .mp3/.wav files (which add download size and
   S3 hosting cost), we synthesize all sounds at runtime using the
   Web Audio API's OscillatorNode, GainNode, and BiquadFilterNode.

   The Web Audio API works like a modular synth:
   - OscillatorNode = generates a waveform (sine, square, sawtooth)
   - GainNode = controls volume (0.0 = silent, 1.0 = full)
   - BiquadFilterNode = shapes frequency (lowpass = muffled, etc.)
   - AudioContext.destination = the speakers

   You connect nodes in a chain: Oscillator → Gain → Filter → Output
   ═══════════════════════════════════════════════════════════════════ */

const Audio = {
    ctx: null,          // AudioContext — the master audio graph
    masterGain: null,   // Master volume control
    _musicGain: null,   // Music sub-mix
    _sfxGain: null,     // SFX sub-mix
    _ambientGain: null, // Ambient sub-mix
    _ambientNodes: [],  // Active ambient oscillators (for cleanup)
    _musicNodes: [],    // Active music oscillators
    _initialized: false,
    _muted: false,

    // ── Initialize audio context (must be called from user gesture) ──
    init() {
        if (this._initialized) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('[Audio] Web Audio API not supported');
            return;
        }

        // Master gain → destination
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.7;
        this.masterGain.connect(this.ctx.destination);

        // Sub-mixes
        this._sfxGain = this.ctx.createGain();
        this._sfxGain.gain.value = 0.8;
        this._sfxGain.connect(this.masterGain);

        this._musicGain = this.ctx.createGain();
        this._musicGain.gain.value = 0.5;
        this._musicGain.connect(this.masterGain);

        this._ambientGain = this.ctx.createGain();
        this._ambientGain.gain.value = 0.6;
        this._ambientGain.connect(this.masterGain);

        this._initialized = true;
        console.log('[Audio] Initialized');
    },

    // ── Resume context (browsers suspend until user gesture) ─────────
    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    },

    // ── Toggle mute ──────────────────────────────────────────────────
    toggleMute() {
        if (!this._initialized) return;
        this._muted = !this._muted;
        this.masterGain.gain.setTargetAtTime(
            this._muted ? 0 : 0.7, this.ctx.currentTime, 0.05
        );
        return this._muted;
    },

    // ═══════════════════════════════════════════════════════════════════
    // SFX — Short one-shot sounds
    // ═══════════════════════════════════════════════════════════════════

    // ── Gunshot: sharp attack, filtered white noise + low thump ──────
    playGunshot() {
        if (!this._initialized) return;
        const ctx = this.ctx;
        const now = ctx.currentTime;

        // White noise burst (the "crack")
        const noiseLen = 0.08;
        const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * noiseLen, ctx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
        }
        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuffer;

        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.value = 3000;
        noiseFilter.Q.value = 0.8;

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.6, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + noiseLen);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this._sfxGain);
        noise.start(now);
        noise.stop(now + noiseLen);

        // Low-frequency thump (the "boom")
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.12);

        const thumpGain = ctx.createGain();
        thumpGain.gain.setValueAtTime(0.5, now);
        thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        osc.connect(thumpGain);
        thumpGain.connect(this._sfxGain);
        osc.start(now);
        osc.stop(now + 0.15);
    },

    // ── Hit impact: metallic ping ────────────────────────────────────
    playHit() {
        if (!this._initialized) return;
        const ctx = this.ctx;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(800 + Math.random() * 400, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.1);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        osc.connect(gain);
        gain.connect(this._sfxGain);
        osc.start(now);
        osc.stop(now + 0.12);
    },

    // ── Explosion: layered noise burst + sub-bass ────────────────────
    playExplosion() {
        if (!this._initialized) return;
        const ctx = this.ctx;
        const now = ctx.currentTime;

        // Noise burst
        const noiseLen = 0.5;
        const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * noiseLen, ctx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
            const env = Math.exp(-i / (ctx.sampleRate * 0.12));
            data[i] = (Math.random() * 2 - 1) * env;
        }
        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuffer;

        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.setValueAtTime(4000, now);
        noiseFilter.frequency.exponentialRampToValueAtTime(200, now + 0.4);

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.7, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + noiseLen);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this._sfxGain);
        noise.start(now);
        noise.stop(now + noiseLen);

        // Sub-bass thump
        const sub = ctx.createOscillator();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(60, now);
        sub.frequency.exponentialRampToValueAtTime(20, now + 0.4);

        const subGain = ctx.createGain();
        subGain.gain.setValueAtTime(0.6, now);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

        sub.connect(subGain);
        subGain.connect(this._sfxGain);
        sub.start(now);
        sub.stop(now + 0.5);
    },

    // ── Enemy footstep: dull thud ────────────────────────────────────
    playFootstep(distance, enemyType) {
        if (!this._initialized) return;
        const ctx = this.ctx;
        const now = ctx.currentTime;

        // Volume decreases with distance — closer = louder, more menacing
        const vol = Math.max(0.02, 0.3 * (1 - distance / 50));

        // Heavy/boss enemies have a deeper, louder stomp
        const isHeavy = enemyType === 'heavy' || enemyType === 'boss';
        const freq = isHeavy ? 40 + Math.random() * 10 : 60 + Math.random() * 20;
        const baseVol = isHeavy ? vol * 1.8 : vol;
        const dur = isHeavy ? 0.15 : 0.1;

        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.exponentialRampToValueAtTime(20, now + dur);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(Math.min(baseVol, 0.5), now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

        osc.connect(gain);
        gain.connect(this._sfxGain);
        osc.start(now);
        osc.stop(now + dur);
    },

    // ── Player damage: harsh buzz ────────────────────────────────────
    playDamage() {
        if (!this._initialized) return;
        const ctx = this.ctx;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.linearRampToValueAtTime(80, now + 0.2);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 600;

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this._sfxGain);
        osc.start(now);
        osc.stop(now + 0.3);
    },

    // ── Reload: mechanical ratchet ───────────────────────────────────
    playReload() {
        if (!this._initialized) return;
        const ctx = this.ctx;
        const now = ctx.currentTime;

        // Two clicks: eject + chamber
        for (let i = 0; i < 2; i++) {
            const t = now + i * 0.15;
            const osc = ctx.createOscillator();
            osc.type = 'square';
            osc.frequency.setValueAtTime(1200 - i * 400, t);
            osc.frequency.exponentialRampToValueAtTime(300, t + 0.04);

            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.2, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

            osc.connect(gain);
            gain.connect(this._sfxGain);
            osc.start(t);
            osc.stop(t + 0.06);
        }

        // Slide rack at end
        const slideT = now + 0.4;
        const noiseLen = 0.12;
        const buf = ctx.createBuffer(1, ctx.sampleRate * noiseLen, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) {
            d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) * 0.5;
        }
        const src = ctx.createBufferSource();
        src.buffer = buf;

        const f = ctx.createBiquadFilter();
        f.type = 'highpass';
        f.frequency.value = 2000;

        const g = ctx.createGain();
        g.gain.setValueAtTime(0.15, slideT);
        g.gain.exponentialRampToValueAtTime(0.001, slideT + noiseLen);

        src.connect(f);
        f.connect(g);
        g.connect(this._sfxGain);
        src.start(slideT);
        src.stop(slideT + noiseLen);
    },

    // ── Wave incoming: alarm siren ───────────────────────────────────
    playWaveAlarm() {
        if (!this._initialized) return;
        const ctx = this.ctx;
        const now = ctx.currentTime;

        // Two-tone siren sweep
        for (let i = 0; i < 3; i++) {
            const t = now + i * 0.3;
            const osc = ctx.createOscillator();
            osc.type = 'square';
            osc.frequency.setValueAtTime(600, t);
            osc.frequency.linearRampToValueAtTime(900, t + 0.15);
            osc.frequency.linearRampToValueAtTime(600, t + 0.3);

            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.12, t);
            gain.gain.setValueAtTime(0.12, t + 0.25);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

            osc.connect(gain);
            gain.connect(this._sfxGain);
            osc.start(t);
            osc.stop(t + 0.3);
        }
    },

    // ── Empty clip click ─────────────────────────────────────────────
    playEmptyClick() {
        if (!this._initialized) return;
        const ctx = this.ctx;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(1500, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.02);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

        osc.connect(gain);
        gain.connect(this._sfxGain);
        osc.start(now);
        osc.stop(now + 0.04);
    },

    // ── Shotgun: wide noise burst + heavy thump ──────────────────────
    playShotgun() {
        if (!this._initialized) return;
        const ctx = this.ctx;
        const now = ctx.currentTime;

        // Wide noise burst (louder, longer than rifle)
        const noiseLen = 0.15;
        const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * noiseLen, ctx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
        }
        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuffer;

        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.value = 2000;
        noiseFilter.Q.value = 0.5;

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.8, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + noiseLen);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this._sfxGain);
        noise.start(now);
        noise.stop(now + noiseLen);

        // Heavy low thump
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(80, now);
        osc.frequency.exponentialRampToValueAtTime(25, now + 0.2);

        const thumpGain = ctx.createGain();
        thumpGain.gain.setValueAtTime(0.7, now);
        thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

        osc.connect(thumpGain);
        thumpGain.connect(this._sfxGain);
        osc.start(now);
        osc.stop(now + 0.25);
    },

    // ── Minigun: rapid short bursts ────────────────────────────────
    playMinigun() {
        if (!this._initialized) return;
        const ctx = this.ctx;
        const now = ctx.currentTime;

        // Very short noise snap
        const noiseLen = 0.03;
        const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * noiseLen, ctx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) * 0.7;
        }
        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuffer;

        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.value = 2500;

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.4, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + noiseLen);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this._sfxGain);
        noise.start(now);
        noise.stop(now + noiseLen);

        // Quick metallic tick
        const osc = ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.04);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

        osc.connect(gain);
        gain.connect(this._sfxGain);
        osc.start(now);
        osc.stop(now + 0.05);
    },

    // ── Heavy robot fires back ───────────────────────────────────────
    playEnemyFire() {
        if (!this._initialized) return;
        const ctx = this.ctx;
        const now = ctx.currentTime;

        // Deeper, more menacing shot
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(60, now + 0.15);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 800;

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this._sfxGain);
        osc.start(now);
        osc.stop(now + 0.2);
    },

    // ═══════════════════════════════════════════════════════════════════
    // AMBIENT — Continuous industrial drone
    // ═══════════════════════════════════════════════════════════════════

    startAmbient() {
        if (!this._initialized || this._ambientNodes.length > 0) return;
        const ctx = this.ctx;

        // Deep industrial hum — two detuned oscillators for thickness
        const freqs = [55, 82.5]; // A1 + E2 — power hum feel
        for (const freq of freqs) {
            const osc = ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.value = freq;

            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 350;  // let more harmonics through
            filter.Q.value = 1;

            const gain = ctx.createGain();
            gain.gain.value = 0.25;

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this._ambientGain);
            osc.start();
            this._ambientNodes.push({ osc, gain, filter });
        }

        // Mid-range industrial grind — adds presence
        const grind = ctx.createOscillator();
        grind.type = 'square';
        grind.frequency.value = 110;

        const grindFilter = ctx.createBiquadFilter();
        grindFilter.type = 'bandpass';
        grindFilter.frequency.value = 250;
        grindFilter.Q.value = 3;

        const grindGain = ctx.createGain();
        grindGain.gain.value = 0.06;

        grind.connect(grindFilter);
        grindFilter.connect(grindGain);
        grindGain.connect(this._ambientGain);
        grind.start();
        this._ambientNodes.push({ osc: grind, gain: grindGain, filter: grindFilter });

        // Wind-like filtered noise — louder, wider band
        const windLen = 4.0;
        const windBuffer = ctx.createBuffer(1, ctx.sampleRate * windLen, ctx.sampleRate);
        const windData = windBuffer.getChannelData(0);
        for (let i = 0; i < windData.length; i++) {
            windData[i] = (Math.random() * 2 - 1) * 0.5;
        }
        const wind = ctx.createBufferSource();
        wind.buffer = windBuffer;
        wind.loop = true;

        const windFilter = ctx.createBiquadFilter();
        windFilter.type = 'bandpass';
        windFilter.frequency.value = 600;
        windFilter.Q.value = 0.3;

        const windGain = ctx.createGain();
        windGain.gain.value = 0.18;

        wind.connect(windFilter);
        windFilter.connect(windGain);
        windGain.connect(this._ambientGain);
        wind.start();
        this._ambientNodes.push({ osc: wind, gain: windGain, filter: windFilter });

        console.log('[Audio] Ambient started');
    },

    stopAmbient() {
        for (const node of this._ambientNodes) {
            node.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.5);
            setTimeout(() => {
                try { node.osc.stop(); } catch (_) {}
            }, 2000);
        }
        this._ambientNodes = [];
    },

    // ═══════════════════════════════════════════════════════════════════
    // MUSIC — Dark minimal synth loop (procedural)
    // ═══════════════════════════════════════════════════════════════════

    startMusic() {
        if (!this._initialized || this._musicNodes.length > 0) return;
        const ctx = this.ctx;

        // Pad drone: slow-moving filtered chord
        // D minor feel: D2(73.4), A2(110), F2(87.3)
        const padNotes = [73.4, 87.3, 110];
        for (const freq of padNotes) {
            const osc = ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.value = freq;

            // Slow LFO modulates filter cutoff for movement
            const lfo = ctx.createOscillator();
            lfo.type = 'sine';
            lfo.frequency.value = 0.06 + Math.random() * 0.04;

            const lfoGain = ctx.createGain();
            lfoGain.gain.value = 200;  // wider sweep

            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 500;  // higher base cutoff so harmonics are audible
            filter.Q.value = 2;

            lfo.connect(lfoGain);
            lfoGain.connect(filter.frequency);

            const gain = ctx.createGain();
            gain.gain.value = 0.18;  // louder pad

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this._musicGain);
            osc.start();
            lfo.start();
            this._musicNodes.push({ osc, gain, filter, lfo });
        }

        // Higher octave layer — thin, eerie, very quiet
        const highOsc = ctx.createOscillator();
        highOsc.type = 'sine';
        highOsc.frequency.value = 293.7; // D4

        const highFilter = ctx.createBiquadFilter();
        highFilter.type = 'lowpass';
        highFilter.frequency.value = 400;

        const highGain = ctx.createGain();
        highGain.gain.value = 0.04;

        highOsc.connect(highFilter);
        highFilter.connect(highGain);
        highGain.connect(this._musicGain);
        highOsc.start();
        this._musicNodes.push({ osc: highOsc, gain: highGain, filter: highFilter, lfo: { stop() {} } });

        // Rhythmic pulse — slow kick-like throb every 2 seconds
        this._pulseInterval = setInterval(() => {
            if (!this._initialized || this._muted) return;
            const now = ctx.currentTime;
            const kick = ctx.createOscillator();
            kick.type = 'sine';
            kick.frequency.setValueAtTime(80, now);
            kick.frequency.exponentialRampToValueAtTime(25, now + 0.4);

            const kickGain = ctx.createGain();
            kickGain.gain.setValueAtTime(0.25, now);  // louder pulse
            kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

            kick.connect(kickGain);
            kickGain.connect(this._musicGain);
            kick.start(now);
            kick.stop(now + 0.6);
        }, 2000);

        console.log('[Audio] Music started');
    },

    stopMusic() {
        for (const node of this._musicNodes) {
            node.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.5);
            setTimeout(() => {
                try { node.osc.stop(); node.lfo.stop(); } catch (_) {}
            }, 2000);
        }
        this._musicNodes = [];
        if (this._pulseInterval) {
            clearInterval(this._pulseInterval);
            this._pulseInterval = null;
        }
    },

    // ── Heartbeat (low HP warning) ──────────────────────────────────
    playHeartbeat() {
        if (!this._initialized) return;
        const ctx = this.ctx;
        const now = ctx.currentTime;

        // Deep thump — two-stage: attack + decay
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(60, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.15);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

        osc.connect(gain);
        gain.connect(this._sfxGain);
        osc.start(now);
        osc.stop(now + 0.2);
    },

    // ── Cleanup ──────────────────────────────────────────────────────
    stopAll() {
        this.stopAmbient();
        this.stopMusic();
    },
};

export { Audio };
