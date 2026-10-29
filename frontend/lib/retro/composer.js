import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RetroCRTShader } from './shaders/retroCRT.js';

/**
 * RenderPass -> Bloom -> RetroCRT -> OutputPass
 * Devuelve { composer, crt, bloomPass, resize(w, h), update(t), dispose() }
 */
export function createRetroComposer(renderer, scene, camera, opts = {}) {
  const { bloom = { strength: 0.6, radius: 0.5, threshold: 0.85 } } = opts;

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(1, 1),
    bloom.strength,
    bloom.radius,
    bloom.threshold
  );
  composer.addPass(bloomPass);

  const crt = new ShaderPass(RetroCRTShader);
  composer.addPass(crt);
  composer.addPass(new OutputPass());

  const resize = (w, h) => {
    composer.setSize(w, h);
    const pr = renderer.getPixelRatio();
    crt.uniforms.uRes.value.set(w * pr, h * pr);
  };
  const update = (t) => {
    crt.uniforms.uTime.value = t;
  };
  const dispose = () => {
    if (typeof composer.dispose === 'function') composer.dispose();
  };

  return { composer, crt, bloomPass, resize, update, dispose };
}
