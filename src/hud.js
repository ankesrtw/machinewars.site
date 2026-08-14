/* ═══════════════════════════════════════════════════════════════════
   MACHINE WARS — hud.js (DOM/CSS overlay)
   Reticle, HP bar, ammo, wave/score/kills, wave banner, combo,
   reload indicator, radar minimap, damage-direction arrow,
   muzzle + damage flash. All styled in css/style.css (#hud-*).
   ═══════════════════════════════════════════════════════════════════ */

const $ = (id) => document.getElementById(id);

export const HUD = {
    AW: null, WEAPONS: null,
    _radarCtx: null, _comboTimeout: null, _bannerTimeout: null, _dmgTimeout: null,

    init(AW, WEAPONS) {
        this.AW = AW; this.WEAPONS = WEAPONS;
        this._hpBar = $('hud-hp-fill');
        this._hpText = $('hud-hp-val');
        this._ammo = $('hud-ammo');
        this._wave = $('hud-wave');
        this._kills = $('hud-kills');
        this._score = $('hud-score');
        this._weapon = $('hud-weapon');
        this._banner = $('hud-banner');
        this._combo = $('hud-combo');
        this._reload = $('hud-reload');
        this._flash = $('hud-damage-flash');
        this._muzzle = $('hud-muzzle');
        this._dmgArrow = $('hud-damage-dir');
        const radar = $('hud-radar');
        this._radarCtx = radar ? radar.getContext('2d') : null;
        this.update();
    },

    update() {
        const AW = this.AW;
        if (!AW) return;
        const pct = Math.max(0, AW.playerHP / AW.maxPlayerHP);
        this._hpBar.style.width = `${Math.round(pct * 200)}px`;
        this._hpBar.style.background = pct > 0.5 ? 'rgba(0,255,100,0.85)' : pct > 0.25 ? 'rgba(255,200,0,0.9)' : 'rgba(255,40,0,0.92)';
        this._hpText.textContent = `${AW.playerHP}`;
        this._ammo.textContent = `${AW.ammo} / ${AW.maxAmmo}`;
        this._wave.textContent = `WAVE ${AW.wave} / ${AW.maxWaves}`;
        this._kills.textContent = `${AW.kills} KILLS`;
        this._score.textContent = `${AW.score} PTS`;
        const w = this.WEAPONS[AW.currentWeapon];
        if (w) this._weapon.textContent = `[ ${AW.currentWeapon + 1} ] ${w.name}  |  G: ${AW.grenades} GRENADES`;
    },

    _showBanner(text, color, ms) {
        this._banner.textContent = text;
        this._banner.style.color = color;
        this._banner.style.opacity = '1';
        clearTimeout(this._bannerTimeout);
        this._bannerTimeout = setTimeout(() => { this._banner.style.opacity = '0'; }, ms);
    },
    showWaveBanner(text) { this._showBanner(text, 'rgba(200,30,0,0.95)', 2500); },
    showWeaponSwitch(name) { this._showBanner(name, 'rgba(0,255,100,0.9)', 1000); },
    showKillStreak(text) { this._showBanner(text, 'rgba(255,200,0,0.95)', 1500); },

    showCombo(mult, points) {
        this._combo.textContent = `x${mult.toFixed(1)} COMBO  +${points}`;
        this._combo.style.opacity = '1';
        clearTimeout(this._comboTimeout);
        this._comboTimeout = setTimeout(() => { this._combo.style.opacity = '0'; }, 1200);
    },

    showReload(visible) { this._reload.style.opacity = visible ? '1' : '0'; },

    damageFlash() {
        this._flash.style.transition = 'opacity 0.08s ease-in';
        this._flash.style.opacity = '1';
        setTimeout(() => { this._flash.style.transition = 'opacity 0.5s ease-out'; this._flash.style.opacity = '0'; }, 120);
    },
    muzzleFlash() {
        this._muzzle.style.opacity = '1';
        setTimeout(() => { this._muzzle.style.opacity = '0'; }, 60);
    },

    showDamageDirection(rel) {
        const radius = 120;
        const ix = Math.sin(rel) * radius, iy = -Math.cos(rel) * radius;
        this._dmgArrow.style.left = `calc(50% + ${ix}px - 20px)`;
        this._dmgArrow.style.top = `calc(50% + ${iy}px - 20px)`;
        this._dmgArrow.style.transform = `rotate(${rel}rad)`;
        this._dmgArrow.style.opacity = '1';
        clearTimeout(this._dmgTimeout);
        this._dmgTimeout = setTimeout(() => { this._dmgArrow.style.opacity = '0'; }, 800);
    },

    // ── Radar minimap ───────────────────────────────────────────────
    drawRadar(now, enemies, pickups, barrels, cam) {
        const ctx = this._radarCtx;
        if (!ctx) return;
        const w = 120, h = 120, cx = 60, cy = 60, scale = 1.2;
        ctx.clearRect(0, 0, w, h);
        ctx.beginPath(); ctx.arc(cx, cy, 58, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,20,10,0.4)'; ctx.fill();
        const sweep = (now * 0.001) % (Math.PI * 2);
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(sweep) * 55, cy + Math.sin(sweep) * 55);
        ctx.strokeStyle = 'rgba(0,255,80,0.3)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.strokeStyle = 'rgba(0,255,80,0.12)';
        ctx.beginPath(); ctx.moveTo(cx, 4); ctx.lineTo(cx, h - 4); ctx.moveTo(4, cy); ctx.lineTo(w - 4, cy); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, 30, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(0,255,80,0.08)'; ctx.stroke();
        ctx.fillStyle = 'rgba(0,255,80,0.9)'; ctx.fillRect(cx - 2, cy - 2, 4, 4);
        for (const e of enemies) {
            if (e.dead || !e.root) continue;
            const dx = (e.root.position.x - cam.position.x) / scale;
            const dz = (e.root.position.z - cam.position.z) / scale;
            if (Math.abs(dx) > 55 || Math.abs(dz) > 55) continue;
            const t = e.typeName;
            ctx.fillStyle = t === 'boss' ? 'rgba(255,0,0,0.95)' : t === 'heavy' ? 'rgba(255,60,0,0.85)' :
                t === 'drone' ? 'rgba(160,0,255,0.85)' : t === 'grunt' ? 'rgba(255,140,0,0.8)' : 'rgba(0,200,255,0.8)';
            const s = t === 'boss' ? 4 : 2;
            ctx.fillRect(cx + dx - s / 2, cy - dz - s / 2, s, s);
        }
        for (const p of pickups) {
            const dx = (p.x - cam.position.x) / scale, dz = (p.z - cam.position.z) / scale;
            if (Math.abs(dx) > 55 || Math.abs(dz) > 55) continue;
            ctx.fillStyle = p.type === 'health' ? 'rgba(0,255,80,0.7)' : 'rgba(255,200,0,0.7)';
            ctx.fillRect(cx + dx - 1.5, cy - dz - 1.5, 3, 3);
        }
        for (const b of barrels) {
            if (b.exploded) continue;
            const dx = (b.x - cam.position.x) / scale, dz = (b.z - cam.position.z) / scale;
            if (Math.abs(dx) > 55 || Math.abs(dz) > 55) continue;
            ctx.fillStyle = 'rgba(255,80,0,0.4)';
            ctx.beginPath(); ctx.arc(cx + dx, cy - dz, 2, 0, Math.PI * 2); ctx.fill();
        }
    },
};
