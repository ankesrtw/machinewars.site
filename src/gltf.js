/* Shared GLTF/DRACO loading — the AW GLBs use KHR_draco_mesh_compression.
   Decoding every model at once overwhelms lower-powered GPUs and can leave
   every request stuck behind the decoder worker. Keep a single, prioritized
   queue so models always arrive instead of falling back permanently. */
import * as THREE from 'three';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const dracoLoader = new DRACOLoader();
// Default decoder config auto-selects the WASM decoder (fastest, most
// reliable) and falls back to JS if unsupported.
// Resolve from this module rather than the page URL so the game also works
// when deployed under a project subdirectory (for example /machinewars/).
dracoLoader.setDecoderPath(new URL('../vendor/three/addons/libs/draco/gltf/', import.meta.url).href);

const gltfLoader = new GLTFLoader().setDRACOLoader(dracoLoader);
let loading = false;
const pending = [];

// These GLBs were Draco-compressed without a normal attribute, so their
// geometries decode with only position/uv. Every lit material (the scene tints
// and enemy skins are all MeshStandardMaterial) then shades them pure black —
// the models load fine and are simply invisible as solid silhouettes. Rebuild
// the normals once at load time, before the geometry is cloned per placement.
function ensureNormals(root) {
    root.traverse((o) => {
        const g = o.isMesh && o.geometry;
        if (g && g.attributes.position && !g.attributes.normal) g.computeVertexNormals();
    });
    return root;
}

// ── Pivot normalization ─────────────────────────────────────────────
// The models are authored Y-up (verified by rendering each one), so no
// corrective rotation is wanted here — applying one lays them on their side.
// What they do need is a pivot fix: they are centered on the origin, while the
// game places every model with its root at ground level (y = 0), which sank
// half of each prop and robot into the terrain.
//
// Re-center on X/Z and drop the base onto y = 0, baking the translation into
// the geometry so callers can clone the result and set position/rotation.y/
// scale freely. After this a placement's (x, z) is the model's footprint
// center and its feet rest exactly on the ground.
// Returns a NEW root: the model is re-parented under a wrapper that carries the
// centering offset. The offset has to live on an inner node — callers set
// position/rotation.y/scale on the clone's own root, which would otherwise
// overwrite it.
function groundPivot(scene) {
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene);
    if (box.isEmpty()) return scene;
    const c = box.getCenter(new THREE.Vector3());
    const wrapper = new THREE.Group();
    // Offset the inner node rather than baking into geometry: the shift is
    // measured in the model's space, and baking would be wrong for any asset
    // whose meshes carry their own transform.
    scene.position.set(-c.x, -box.min.y, -c.z);
    wrapper.add(scene);
    wrapper.updateMatrixWorld(true);
    return wrapper;
}

function pumpGLBQueue() {
    if (loading || pending.length === 0) return;
    loading = true;
    const job = pending.shift();
    gltfLoader.loadAsync(job.url)
        .then((gltf) => { ensureNormals(gltf.scene); gltf.scene = groundPivot(gltf.scene); return gltf; })
        .then(job.resolve, job.reject)
        .finally(() => {
            loading = false;
            pumpGLBQueue();
        });
}

// Enemy models take priority over scenery. Scene loaders enqueue their next
// prop only after the current prop resolves, giving wave models a chance to
// jump ahead while the arena is filling in.
export function loadGLB(url, priority = 'normal') {
    return new Promise((resolve, reject) => {
        const job = { url, resolve, reject };
        if (priority === 'high') {
            const firstNormal = pending.findIndex((item) => item.priority !== 'high');
            job.priority = 'high';
            if (firstNormal === -1) pending.push(job);
            else pending.splice(firstNormal, 0, job);
        } else {
            job.priority = 'normal';
            pending.push(job);
        }
        pumpGLBQueue();
    });
}
