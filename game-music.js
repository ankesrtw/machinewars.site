/*
 * game-music.js — V2 (Three.js) build, game page only.
 * Same behaviour as the V1 glue, but targets window.AWAudio (the V2 game's
 * procedural audio object, exported by src/main.js) instead of window.Audio —
 * V2 keeps the native window.Audio constructor intact.
 *
 *   • Game's own procedural SFX/music start MUTED (toggle: header "SFX:" button).
 *   • Global soundtrack (MarsMusic) is pinned to "The Machine War (v1)" and starts
 *     on the first user gesture. Toggle via the injected "MUSIC:" button.
 */
(function () {
  'use strict';

  window.MUSIC_PIN_TITLE = 'The Machine War (v1)';

  var wantMusic = true;
  var started = false;

  function muteGameAudio() {
    var A = window.AWAudio;
    if (typeof A !== 'object' || !A) return;
    A._muted = true;
    if (A.masterGain && A.ctx) {
      try { A.masterGain.gain.setTargetAtTime(0, A.ctx.currentTime, 0.01); }
      catch (e) { A.masterGain.gain.value = 0; }
    }
    syncSfxBtn();
  }
  function syncSfxBtn() {
    var btn = document.getElementById('aw-mute-btn');
    if (btn) btn.textContent = (window.AWAudio && window.AWAudio._muted) ? 'SFX: OFF' : 'SFX: ON';
  }

  function syncMusicBtn() {
    var btn = document.getElementById('aw-music-btn');
    if (!btn || !window.MarsMusic) return;
    btn.textContent = window.MarsMusic.getState().playing ? 'MUSIC: ON' : 'MUSIC: OFF';
  }

  function startSoundtrack() {
    if (started || !window.MarsMusic) return;
    started = true;
    var st = window.MarsMusic.getState();
    if (st.queue && st.queue.length) window.MarsMusic.queue(st.queue, 0);
    else window.MarsMusic.loadDefaults(true, true);
    setTimeout(syncMusicBtn, 80);
  }

  function injectMusicBtn() {
    var mute = document.getElementById('aw-mute-btn');
    if (!mute || document.getElementById('aw-music-btn')) return;
    var b = document.createElement('button');
    b.className = 'aw-btn'; b.id = 'aw-music-btn'; b.textContent = 'MUSIC: ON';
    b.addEventListener('click', function () {
      if (!started) { wantMusic = true; startSoundtrack(); return; }
      window.MarsMusic.toggle();
      setTimeout(syncMusicBtn, 80);
    });
    mute.parentNode.insertBefore(b, mute.nextSibling);
  }

  window.addEventListener('DOMContentLoaded', function () {
    injectMusicBtn();
    syncSfxBtn();
    var sfx = document.getElementById('aw-mute-btn');
    if (sfx) sfx.addEventListener('click', function () { setTimeout(syncSfxBtn, 30); });
    if (window.MarsMusic) window.MarsMusic.onStateChange(syncMusicBtn);
  });

  function onFirstGesture() {
    setTimeout(function () {
      muteGameAudio();
      if (wantMusic) startSoundtrack();
    }, 120);
    window.removeEventListener('pointerdown', onFirstGesture, true);
    window.removeEventListener('keydown', onFirstGesture, true);
  }
  window.addEventListener('pointerdown', onFirstGesture, true);
  window.addEventListener('keydown', onFirstGesture, true);
})();
