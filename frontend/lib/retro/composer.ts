// R4: Global retro post-processing for the /alight Canvas.
// Uses three/addons EffectComposer (already bundled with three.js).
// Integrates with R3F by overriding gl.render so R3F's frame loop
// runs the composer instead of a bare scene render.

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { EffectComposer }  from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass }      from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass }      from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass }      from "three/addons/postprocessing/OutputPass.js";
import { RetroCRTShader, CRT_UNIFORMS } from "./retroCRT";
import { DBG_RETRO_FX } from "@/lib/debugConfig";
import { RETRO_FLAGS } from "./retroFlags";

// Bloom resolution scale per quality level
const QUALITY_BLOOM_SCALE: Record<string, number> = {
  low: 0.25, medium: 0.5, high: 1.0,
};

// How long (ms) to animate uCurve ↔ 0 when entering/exiting lectern mode
const CURVE_ANIM_MS = 400;

// ── R3F component (mount inside <Canvas> Scene) ───────────────────────────────
export default function RetroPostFX() {
  const { gl, scene, camera, size } = useThree();

  // Refs shared between useEffect and useFrame
  const composerRef  = useRef<EffectComposer | null>(null);
  const crtPassRef   = useRef<ShaderPass | null>(null);
  const curveBaseRef = useRef(0.06);        // current "real" uCurve value
  const curveTarget  = useRef(0.06);        // lerp target (0 in lectern mode)
  const curveStart   = useRef(0.06);        // lerp start
  const curveAnimT0  = useRef(-1);          // animation start time (ms), -1 = idle

  // Build composer once when renderer/scene/camera are ready
  useEffect(() => {
    if (!RETRO_FLAGS.enabled) return;

    const w = size.width, h = size.height;
    const bloomScale = QUALITY_BLOOM_SCALE[RETRO_FLAGS.quality] ?? 0.5;

    const composer = new EffectComposer(gl);
    composer.addPass(new RenderPass(scene, camera));

    const bloom = new UnrealBloomPass(
      new THREE.Vector2(w * bloomScale, h * bloomScale),
      0.45, 0.5, 0.85,
    );
    composer.addPass(bloom);

    // Build a fresh ShaderMaterial-based ShaderPass from the CRT shader definition
    const crt = new ShaderPass({
      uniforms: {
        tDiffuse:   { value: null as THREE.Texture | null },
        uTime:      CRT_UNIFORMS.uTime,
        uRes:       CRT_UNIFORMS.uRes,
        uCurve:     CRT_UNIFORMS.uCurve,
        uScan:      CRT_UNIFORMS.uScan,
        uScanCount: CRT_UNIFORMS.uScanCount,
        uCA:        CRT_UNIFORMS.uCA,
        uGrain:     CRT_UNIFORMS.uGrain,
        uVig:       CRT_UNIFORMS.uVig,
        uWobble:    CRT_UNIFORMS.uWobble,
        uTint:      CRT_UNIFORMS.uTint,
        uLift:      CRT_UNIFORMS.uLift,
        uComfort:   CRT_UNIFORMS.uComfort,
      },
      vertexShader:   RetroCRTShader.vertexShader,
      fragmentShader: RetroCRTShader.fragmentShader,
    });
    composer.addPass(crt);
    composer.addPass(new OutputPass());

    composer.setSize(w, h);
    CRT_UNIFORMS.uRes.value.set(w * gl.getPixelRatio(), h * gl.getPixelRatio());
    gl.toneMappingExposure = DBG_RETRO_FX.toneExposure;

    composerRef.current = composer;
    crtPassRef.current  = crt;
    curveBaseRef.current = CRT_UNIFORMS.uCurve.value;

    // ── Override gl.render so R3F's frame loop drives the composer ────────────
    const origRender = gl.render.bind(gl) as typeof gl.render;
    const overriddenRender = (_scene: THREE.Scene, _camera: THREE.Camera) => {
      // Restore original for the RenderPass inside the composer
      // (avoids infinite recursion: RenderPass → gl.render → composer → …)
      gl.render = origRender;
      composerRef.current?.render();
      // Re-install override for the next frame call from R3F
      gl.render = overriddenRender;
    };
    gl.render = overriddenRender;

    return () => {
      gl.render = origRender;
      composer.dispose();
      composerRef.current = null;
      crtPassRef.current  = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, camera]);

  // Handle resize
  useEffect(() => {
    if (!composerRef.current) return;
    composerRef.current.setSize(size.width, size.height);
    const pr = gl.getPixelRatio();
    CRT_UNIFORMS.uRes.value.set(size.width * pr, size.height * pr);
  }, [size, gl]);

  // Listen for lectern mode enter/exit → animate uCurve to 0 and back
  useEffect(() => {
    const onMode = (e: Event) => {
      const mode = (e as CustomEvent).detail?.mode as string;
      const inLectern = mode !== "none";
      const now = performance.now();
      curveStart.current  = CRT_UNIFORMS.uCurve.value;
      curveTarget.current = inLectern ? 0 : curveBaseRef.current;
      curveAnimT0.current = now;
    };
    window.addEventListener("alight:lectern-mode", onMode);
    return () => window.removeEventListener("alight:lectern-mode", onMode);
  }, []);

  useFrame(({ gl: renderer, clock }) => {
    if (!RETRO_FLAGS.enabled) return;

    // Update time uniform
    CRT_UNIFORMS.uTime.value = clock.elapsedTime;

    // Comfort mode: mute wobble + CA
    CRT_UNIFORMS.uComfort.value = RETRO_FLAGS.comfortMode ? 1 : 0;

    // Live tone mapping exposure
    renderer.toneMappingExposure = DBG_RETRO_FX.toneExposure;

    // Animate uCurve for lectern mode compatibility
    if (curveAnimT0.current >= 0) {
      const t = Math.min(1, (performance.now() - curveAnimT0.current) / CURVE_ANIM_MS);
      const ease = 1 - Math.pow(1 - t, 3);
      CRT_UNIFORMS.uCurve.value = curveStart.current + (curveTarget.current - curveStart.current) * ease;
      if (t >= 1) curveAnimT0.current = -1;
    }
  });

  return null;
}
