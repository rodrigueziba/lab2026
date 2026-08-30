import * as THREE from "three";

// Shared uniform objects: mutated by Prism.tsx every frame, read by
// ExperienceDome panels and dome shell via direct object reference.
// Module-level singletons — Three.js sends the current .value to the GPU
// each render, so all 60+ shader instances stay in sync without React state.
export const PRISM_POS_UNIFORM     = { value: new THREE.Vector3(0, 22, 0) };
export const PRISM_RAINBOW_UNIFORM = { value: 0 };
