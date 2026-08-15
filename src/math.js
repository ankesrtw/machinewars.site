/* ═══════════════════════════════════════════════════════════════════
   MACHINE WARS — math.js (small shared numeric + colour helpers)

   These were inlined at every call site: the clamp idiom
   `Math.max(a, Math.min(b, x))` appeared seven times, the 2D distance
   `Math.sqrt(dx*dx + dz*dz)` four, and `col`/`col3` existed as the same
   function under two names in two modules.
   ═══════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';

export const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
export const lerp = (a, b, t) => a + (b - a) * t;

/* Horizontal distance. The game is effectively 2D for movement, targeting and
   audio falloff, so nearly every distance in the codebase ignores Y. */
export const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

export const randRange = (lo, hi) => lo + Math.random() * (hi - lo);
/* Bipolar [-1, 1). Written as `Math.random() * 2 - 1` six times in audio.js. */
export const randSigned = () => Math.random() * 2 - 1;

/* [r,g,b] array → THREE.Color. Scene and enemy configs store colours as plain
   arrays so they stay JSON-shaped and serialisable. */
export const col3 = (a) => new THREE.Color(a[0], a[1], a[2]);

/* How far the camera may look up/down, in radians. Clamped identically at three
   separate input sites (mouse, touch drag, gamepad); a literal in each meant
   changing the look limit required finding all three. */
export const PITCH_MIN = -0.61;
export const PITCH_MAX = 0.70;
export const clampPitch = (p) => clamp(p, PITCH_MIN, PITCH_MAX);
