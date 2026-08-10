/* Shared DRACOLoader — the AW GLBs use KHR_draco_mesh_compression, so both the
   scene-prop loader and the enemy-model loader need a Draco decoder.
   Decoder WASM is self-hosted under vendor/three/addons/libs/draco/gltf/. */
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

export const dracoLoader = new DRACOLoader();
// Path is relative to the page (/game-v2/). Default decoder config auto-selects
// the WASM decoder (fastest, most reliable) and falls back to JS if unsupported.
dracoLoader.setDecoderPath('vendor/three/addons/libs/draco/gltf/');
