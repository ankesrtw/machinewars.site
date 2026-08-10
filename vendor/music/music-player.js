/**
 * MarsMusic — Global persistent mini-player
 * Loaded on every page. Saves/restores state via localStorage.
 *
 * UI: permanent SVG indicator (bottom-right) + slide-up bar on click.
 * Indicator shows headphones icon — gold when playing, dim when paused.
 * Click indicator = toggle bar. Play/pause via bar controls.
 */
(function () {
    'use strict';

    var LS_TRACK  = 'signal_music_track';
    var LS_TIME   = 'signal_music_time';
    var LS_PLAY   = 'signal_music_playing';
    var LS_VOL    = 'signal_music_volume';
    var LS_QUEUE  = 'signal_music_queue';
    var LS_QIDX   = 'signal_music_queue_index';
    var LS_SHUF   = 'signal_music_shuffle';

    // Absolute (deploy-root) path so the persistent player works from any page
    // — the hub (/), the game (/game/), and the listening app (/music/).
    var API_BASE  = '/music/data';

    var audio     = null;
    var bar       = null;
    var indicator = null;
    var els       = {}; // cached DOM elements
    var state     = {
        track:      null,
        playing:    false,
        time:       0,
        volume:     0.7,
        queue:      [],
        queueIndex: 0,
        shuffle:    false,
    };
    var listeners = [];
    var saveTimer = null;
    var barVisible = false;
    var hideTimer  = null;

    // ── Helpers ──────────────────────────────────────────────────────────────

    function _fmt(sec) {
        sec = Math.floor(sec || 0);
        var m = Math.floor(sec / 60);
        var s = sec % 60;
        return m + ':' + (s < 10 ? '0' : '') + s;
    }

    function _el(tag, cls, attrs) {
        var e = document.createElement(tag);
        if (cls) e.className = cls;
        if (attrs) {
            for (var k in attrs) {
                if (k === 'text') e.textContent = attrs[k];
                else e.setAttribute(k, attrs[k]);
            }
        }
        return e;
    }

    function _svgEl(tag, attrs) {
        var e = document.createElementNS('http://www.w3.org/2000/svg', tag);
        if (attrs) {
            for (var k in attrs) e.setAttribute(k, attrs[k]);
        }
        return e;
    }

    function _notify() {
        for (var i = 0; i < listeners.length; i++) {
            try { listeners[i](state); } catch (e) { /* skip */ }
        }
    }

    function _save() {
        try {
            if (state.track) localStorage.setItem(LS_TRACK, JSON.stringify(state.track));
            else localStorage.removeItem(LS_TRACK);
            localStorage.setItem(LS_TIME, String(audio ? audio.currentTime : 0));
            localStorage.setItem(LS_PLAY, state.playing ? '1' : '0');
            localStorage.setItem(LS_VOL, String(state.volume));
            if (state.queue.length) localStorage.setItem(LS_QUEUE, JSON.stringify(state.queue));
            localStorage.setItem(LS_QIDX, String(state.queueIndex));
            localStorage.setItem(LS_SHUF, state.shuffle ? '1' : '0');
        } catch (e) { /* quota */ }
    }

    function _restore() {
        try {
            var t = localStorage.getItem(LS_TRACK);
            if (t) state.track = JSON.parse(t);
            state.time      = parseFloat(localStorage.getItem(LS_TIME) || '0');
            state.playing   = localStorage.getItem(LS_PLAY) === '1';
            state.volume    = parseFloat(localStorage.getItem(LS_VOL) || '0.7');
            var q = localStorage.getItem(LS_QUEUE);
            if (q) state.queue = JSON.parse(q);
            state.queueIndex = parseInt(localStorage.getItem(LS_QIDX) || '0', 10);
            state.shuffle    = localStorage.getItem(LS_SHUF) === '1';
        } catch (e) { /* parse error */ }
    }

    // ── Audio ────────────────────────────────────────────────────────────────

    function _createAudio() {
        audio = document.createElement('audio');
        audio.preload = 'auto';
        audio.volume = state.volume;

        audio.addEventListener('timeupdate', function () {
            state.time = audio.currentTime;
            _updateProgress();
            if (!saveTimer) {
                saveTimer = setTimeout(function () {
                    _save();
                    saveTimer = null;
                }, 2000);
            }
        });

        audio.addEventListener('ended', function () { _doNext(); });
        audio.addEventListener('play', function () {
            state.playing = true;
            _updatePlayBtn();
            _updateIndicator();
            _notify();
        });
        audio.addEventListener('pause', function () {
            state.playing = false;
            _updatePlayBtn();
            _updateIndicator();
            _notify();
        });
    }

    function _loadTrack(track, autoplay) {
        if (!track || !track.url) return;
        state.track = track;
        audio.src = track.url;
        audio.load();
        _updateUI();
        _updateIndicator();
        if (autoplay) {
            audio.play().catch(function () { /* autoplay blocked */ });
        }
    }

    // ── Bar show/hide ────────────────────────────────────────────────────────

    function _showBar() {
        if (barVisible) return;
        barVisible = true;
        bar.setAttribute('data-bar-visible', 'true');
        indicator.setAttribute('data-bar-open', 'true');
        clearTimeout(hideTimer);
    }

    function _hideBar() {
        barVisible = false;
        bar.setAttribute('data-bar-visible', 'false');
        indicator.setAttribute('data-bar-open', 'false');
        clearTimeout(hideTimer);
    }

    // ── Indicator (permanent SVG equalizer) ──────────────────────────────────

    function _buildIndicator() {
        indicator = _el('div', 'music-indicator');
        indicator.setAttribute('data-playing', 'false');
        indicator.setAttribute('data-bar-open', 'false');
        indicator.title = 'Music';

        // SVG headphones icon
        var svg = _svgEl('svg', {
            viewBox: '0 0 24 24', fill: 'none',
            stroke: 'currentColor', 'stroke-width': '2',
            'stroke-linecap': 'round', 'stroke-linejoin': 'round',
        });
        svg.appendChild(_svgEl('path', { d: 'M3 18v-6a9 9 0 0 1 18 0v6' }));
        svg.appendChild(_svgEl('path', { d: 'M3 18a3 3 0 0 0 3 3h0a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1h0a3 3 0 0 0-3 3z' }));
        svg.appendChild(_svgEl('path', { d: 'M21 18a3 3 0 0 1-3 3h0a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h0a3 3 0 0 1 3 3z' }));
        indicator.appendChild(svg);

        // Click = toggle bar visibility
        indicator.addEventListener('click', function (e) {
            e.stopPropagation();
            if (barVisible) {
                _hideBar();
            } else {
                _showBar();
            }
        });

        document.body.appendChild(indicator);
    }

    function _updateIndicator() {
        if (!indicator) return;
        indicator.setAttribute('data-playing', state.playing ? 'true' : 'false');
    }

    // ── UI Build (DOM methods only — no innerHTML) ───────────────────────────

    function _buildBar() {
        bar = _el('div', 'music-mini-player');
        bar.setAttribute('data-bar-visible', 'false');

        // Progress bar
        var progress = _el('div', 'music-mini-player__progress');
        els.progressBar = _el('div', 'music-mini-player__progress-bar');
        progress.appendChild(els.progressBar);
        bar.appendChild(progress);

        progress.addEventListener('click', function (e) {
            if (!audio.duration) return;
            var rect = progress.getBoundingClientRect();
            var pct = (e.clientX - rect.left) / rect.width;
            audio.currentTime = pct * audio.duration;
        });

        // Controls — leftmost
        var controls = _el('div', 'music-mini-player__controls');

        var prevBtn = _el('button', 'music-mini-player__btn', { title: 'Previous', text: '\u23EE' });
        prevBtn.addEventListener('click', function () { window.MarsMusic.prev(); });
        controls.appendChild(prevBtn);

        els.playBtn = _el('button', 'music-mini-player__btn music-mini-player__btn--play', { title: 'Play/Pause', text: '\u25B6' });
        els.playBtn.addEventListener('click', function () { window.MarsMusic.toggle(); });
        controls.appendChild(els.playBtn);

        var nextBtn = _el('button', 'music-mini-player__btn', { title: 'Next', text: '\u23ED' });
        nextBtn.addEventListener('click', function () { window.MarsMusic.next(); });
        controls.appendChild(nextBtn);

        bar.appendChild(controls);

        // Cover art
        var cover = _el('div', 'music-mini-player__cover');
        els.coverIcon = _el('span', 'music-mini-player__cover-icon', { text: '\u266B' });
        els.coverImg = _el('img', null, { alt: '' });
        els.coverImg.style.display = 'none';
        cover.appendChild(els.coverIcon);
        cover.appendChild(els.coverImg);
        bar.appendChild(cover);

        // Info
        var info = _el('div', 'music-mini-player__info');
        els.title = _el('div', 'music-mini-player__title', { text: 'No track loaded' });
        els.artist = _el('div', 'music-mini-player__artist', { text: '\u2014' });
        info.appendChild(els.title);
        info.appendChild(els.artist);
        bar.appendChild(info);

        // Time
        els.time = _el('div', 'music-mini-player__time', { text: '0:00 / 0:00' });
        bar.appendChild(els.time);

        // Volume
        var volWrap = _el('div', 'music-mini-player__volume');

        var volBtn = _el('button', 'music-mini-player__btn', { title: 'Mute', text: '\uD83D\uDD0A' });
        volBtn.style.fontSize = '14px';
        volBtn.addEventListener('click', function () {
            if (audio.volume > 0) {
                state._prevVol = audio.volume;
                audio.volume = 0;
                state.volume = 0;
            } else {
                audio.volume = state._prevVol || 0.7;
                state.volume = audio.volume;
            }
            els.volSlider.value = state.volume;
            _save();
        });
        volWrap.appendChild(volBtn);

        els.volSlider = _el('input', 'music-mini-player__volume-slider', {
            type: 'range', min: '0', max: '1', step: '0.05', value: String(state.volume)
        });
        els.volSlider.addEventListener('input', function (e) {
            state.volume = parseFloat(e.target.value);
            audio.volume = state.volume;
            _save();
        });
        volWrap.appendChild(els.volSlider);
        bar.appendChild(volWrap);

        // Shuffle button
        els.shuffleBtn = _el('button', 'music-mini-player__shuffle', { title: 'Shuffle', text: '\u21C4' });
        els.shuffleBtn.setAttribute('data-active', 'false');
        els.shuffleBtn.addEventListener('click', function () {
            state.shuffle = !state.shuffle;
            _updateShuffleBtn();
            _save();
        });
        bar.appendChild(els.shuffleBtn);

        // Expand link (full player) — pushed to far right via margin-left: auto in CSS
        var expandLink = _el('a', 'music-mini-player__expand', { title: 'Full player', text: '\u2630' });
        // Standalone: full-player/manage page doesn't exist; navigate to the
        // listening page itself. (Real build gated this behind auth.)
        expandLink.addEventListener('click', function (e) {
            e.preventDefault();
            window.location.href = './';
        });
        bar.appendChild(expandLink);

        document.body.appendChild(bar);
    }

    function _updateUI() {
        if (!bar) return;
        var track = state.track;
        els.title.textContent = track ? track.title : 'No track loaded';
        els.artist.textContent = track ? (track.artist || '\u2014') : '\u2014';

        if (track && track.cover_url) {
            els.coverImg.src = track.cover_url;
            els.coverImg.style.display = '';
            els.coverIcon.style.display = 'none';
        } else {
            els.coverImg.style.display = 'none';
            els.coverIcon.style.display = '';
        }

        _updatePlayBtn();
        _updateShuffleBtn();
    }

    function _updatePlayBtn() {
        if (els.playBtn) els.playBtn.textContent = state.playing ? '\u23F8' : '\u25B6';
    }

    function _updateShuffleBtn() {
        if (els.shuffleBtn) els.shuffleBtn.setAttribute('data-active', state.shuffle ? 'true' : 'false');
    }

    function _updateProgress() {
        if (!bar || !audio) return;
        var dur = audio.duration || 0;
        var cur = audio.currentTime || 0;
        var pct = dur > 0 ? (cur / dur * 100) : 0;
        els.progressBar.style.width = pct + '%';
        els.time.textContent = _fmt(cur) + ' / ' + _fmt(dur);
    }

    // ── Queue ────────────────────────────────────────────────────────────────

    function _doNext() {
        if (state.queue.length === 0) {
            state.playing = false;
            _updatePlayBtn();
            _updateIndicator();
            _save();
            return;
        }
        if (state.shuffle && state.queue.length > 1) {
            var next;
            do { next = Math.floor(Math.random() * state.queue.length); }
            while (next === state.queueIndex);
            state.queueIndex = next;
        } else {
            state.queueIndex = (state.queueIndex + 1) % state.queue.length;
        }
        _loadTrack(state.queue[state.queueIndex], true);
        _save();
        _notify();
    }

    function _doPrev() {
        if (state.queue.length === 0) return;
        if (audio && audio.currentTime > 3) {
            audio.currentTime = 0;
            return;
        }
        state.queueIndex = (state.queueIndex - 1 + state.queue.length) % state.queue.length;
        _loadTrack(state.queue[state.queueIndex], true);
        _save();
        _notify();
    }

    // ── Public API ───────────────────────────────────────────────────────────

    window.MarsMusic = {
        play: function (track) {
            if (!track) return;
            _loadTrack(track, true);
            _save();
            _notify();
        },

        queue: function (tracks, startIndex) {
            state.queue = tracks || [];
            state.queueIndex = startIndex || 0;
            if (state.queue.length > 0) {
                _loadTrack(state.queue[state.queueIndex], true);
            }
            _save();
            _notify();
        },

        next: function () { _doNext(); },
        prev: function () { _doPrev(); },

        seek: function (pct) {
            if (audio && audio.duration) audio.currentTime = pct * audio.duration;
        },

        pause: function () {
            if (audio) audio.pause();
            _save();
        },

        toggle: function () {
            if (!audio) return;
            if (state.playing) {
                audio.pause();
            } else {
                audio.play().catch(function () {});
            }
            _save();
        },

        getState: function () {
            return {
                track:      state.track,
                playing:    state.playing,
                time:       state.time,
                volume:     state.volume,
                queue:      state.queue,
                queueIndex: state.queueIndex,
                shuffle:    state.shuffle,
            };
        },

        onStateChange: function (cb) {
            if (typeof cb === 'function') listeners.push(cb);
        },

        loadDefaults: function (autoplay, force) {
            if (!force && state.queue.length > 0) return;
            fetch(API_BASE + '/tracks-default.json')
                .then(function (r) { return r.json(); })
                .then(function (data) {
                    var tracks = (data.tracks || []).filter(function (t) { return t.url; });
                    if (tracks.length === 0) return;
                    // Pin an opening track. A page can override the default via
                    // window.MUSIC_PIN_TITLE (e.g. the game pins "The Machine War").
                    var pinTitle = window.MUSIC_PIN_TITLE || "ATHENA's Lullaby (v1)";
                    var pinIdx = tracks.findIndex(function (t) { return t.title === pinTitle; });
                    if (pinIdx > 0) tracks.unshift(tracks.splice(pinIdx, 1)[0]);
                    state.queue = tracks;
                    // Don't reset index or load track[0] if already playing something
                    if (!state.playing && !state.track) {
                        state.queueIndex = 0;
                        if (autoplay) {
                            _loadTrack(tracks[0], true);
                        }
                    }
                    _save();
                    _notify();
                })
                .catch(function () { /* network error */ });
        },
    };

    // ── Init ─────────────────────────────────────────────────────────────────

    function _init() {
        _restore();
        _createAudio();
        _buildBar();
        _buildIndicator();

        // Click outside bar/indicator closes bar
        document.addEventListener('click', function (e) {
            if (!barVisible) return;
            if (bar.contains(e.target) || indicator.contains(e.target)) return;
            _hideBar();
        });

        // Always pre-fetch default tracks so queue is fresh
        window.MarsMusic.loadDefaults(false, true);

        if (state.track && state.track.url) {
            audio.src = state.track.url;
            audio.volume = state.volume;
            audio.load();
            _updateUI();
            _updateIndicator();

            // Detect broken URLs — if audio errors, reload defaults on next click
            audio.addEventListener('error', function _onErr() {
                audio.removeEventListener('error', _onErr);
                state.track = null;
                state.queue = [];
                _save();
                _updateUI();
                _updateIndicator();
            }, { once: true });

            if (state.time > 0) {
                audio.currentTime = state.time;
            }
            if (state.playing) {
                audio.play().catch(function () {
                    state.playing = false;
                    _updatePlayBtn();
                    _updateIndicator();
                });
            }
        } else {
            // No saved track — autoplay defaults on first user interaction
            var _autoplayOnce = function () {
                document.removeEventListener('click', _autoplayOnce);
                document.removeEventListener('keydown', _autoplayOnce);
                // If queue already loaded by the init fetch, just play index 0
                if (state.queue.length > 0) {
                    _loadTrack(state.queue[0], true);
                    _save();
                    _notify();
                } else {
                    window.MarsMusic.loadDefaults(true, true);
                }
            };
            document.addEventListener('click', _autoplayOnce);
            document.addEventListener('keydown', _autoplayOnce);
        }

        window.addEventListener('beforeunload', function () {
            if (audio) state.time = audio.currentTime;
            _save();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _init);
    } else {
        _init();
    }

})();
