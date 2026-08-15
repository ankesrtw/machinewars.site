/* ═══════════════════════════════════════════════════════════════════
   MACHINE WARS — projectiles.js (enemy fire that actually travels)

   Replaces the old spawnEnemyTracer(): that drew a purely decorative bolt
   while _fireAtPlayer() applied damage instantly on a dice roll, so a shot
   could not be dodged, could not be blocked, and hit the player before the
   visual arrived. Here the projectile *is* the shot — it moves, it tests
   the world each step, and it deals its damage on impact.

   Meshes are pooled. The old code allocated a CylinderGeometry and a
   material per shot and disposed both on expiry, which at boss-wave fire
   rates is a lot of per-second churn.
   ═══════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';

// One geometry + one material shared by every bolt in flight. Built lazily so
// importing this module never touches the GPU. The bolt points down +Y so a
// quaternion from (0,1,0) aims it, matching the old tracer's orientation.
let _geo = null, _mat = null;
const _pool = [];

function acquire(scene, color) {
    if (!_geo) {
        _geo = new THREE.CylinderGeometry(0.06, 0.06, 1.6, 5);
        _mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.35, 0.05) });
    }
    const m = _pool.pop() || new THREE.Mesh(_geo, _mat);
    m.visible = true;
    scene.add(m);
    return m;
}

function release(scene, mesh) {
    scene.remove(mesh);
    mesh.visible = false;
    if (_pool.length < 64) _pool.push(mesh);
}

/* Geometry owned by this module. World.dispose() must not free it — clones
   share it by reference, exactly like the scene/enemy template caches. */
export function projectileGeometries() {
    return _geo ? [_geo] : [];
}

/**
 * Fire a travelling bolt from `from` toward `to`.
 *
 * ctx supplies: scene, camera, transients, checkCollision, onPlayerDamage,
 * onWallHit, playerRadius() — injected from main.js so this module stays free
 * of engine globals.
 */
export function spawnProjectile(ctx, from, to, { speed = 55, damage = 8, life = 4 } = {}) {
    const dir = to.clone().sub(from);
    const flightLen = dir.length();
    if (!(flightLen > 0.0001)) return;
    dir.divideScalar(flightLen);

    const mesh = acquire(ctx.scene);
    mesh.position.copy(from);
    mesh.quaternion.setFromUnitVectors(UP, dir);

    let age = 0;
    const pos = mesh.position;

    ctx.transients.push({
        update: (dt) => {
            age += dt;
            // Cap the per-frame step: a 55 u/s bolt in a 50ms frame moves 2.75
            // units, which is wide enough to tunnel straight through a crate or
            // past the player. Substep so every metre of flight is tested.
            const travel = speed * dt;
            const steps = Math.max(1, Math.ceil(travel / 0.9));
            const inc = travel / steps;

            for (let s = 0; s < steps; s++) {
                pos.addScaledVector(dir, inc);

                // Player hit: cylinder test, so a bolt passing overhead misses.
                // The horizontal radius widens/narrows with stance, which is what
                // makes crouching behind cover worth doing.
                const cam = ctx.camera.position;
                const dx = pos.x - cam.x, dz = pos.z - cam.z;
                const pr = ctx.playerRadius();
                if (dx * dx + dz * dz < pr * pr && Math.abs(pos.y - cam.y) < ctx.playerHalfHeight()) {
                    ctx.onPlayerDamage(damage, pos.x, pos.z);
                    release(ctx.scene, mesh);
                    return true;
                }

                // World hit. checkCollision is 2D, so pair it with a height test
                // against the tallest thing at that spot — otherwise a bolt is
                // stopped in mid-air by a knee-high crate it should sail over.
                if (pos.y <= 0.05 || ctx.blockedAt(pos.x, pos.z, pos.y, 0.06)) {
                    ctx.onWallHit(pos.clone());
                    release(ctx.scene, mesh);
                    return true;
                }
            }

            if (age > life) { release(ctx.scene, mesh); return true; }
            return false;
        },
    });
}

const UP = new THREE.Vector3(0, 1, 0);
