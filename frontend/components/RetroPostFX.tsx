"use client";
// R4: Post-proceso retro. Componente R3F — montar dentro del <Canvas>.
// La lógica de composer vive aquí; lib/retro/composer.ts queda como legado.

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { EffectComposer }  from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass }      from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass }      from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass }      from "three/addons/postprocessing/OutputPass.js";
import { RetroCRTShader, CRT_UNIFORMS } from "@/lib/retro/retroCRT";
import { DBG_RETRO_FX, DBG_FLASH } from "@/lib/debugConfig";
import { flashBoost, FLASH_STATE } from "@/lib/curtainFlash";
import { RETRO_FLAGS } from "@/lib/retro/retroFlags";

const QUALITY_BLOOM_SCALE: Record<string, number> = {
  low: 0.25, medium: 0.5, high: 1.0,
};
const CURVE_ANIM_MS = 400;

export default function RetroPostFX() {
  const { gl, scene, camera, size } = useThree();

  const composerRef  = useRef<EffectComposer | null>(null);
  const crtPassRef   = useRef<ShaderPass | null>(null);
  const bloomRef     = useRef<UnrealBloomPass | null>(null);
  const curveBaseRef = useRef(0.06);
  const curveTarget  = useRef(0.06);
  const curveStart   = useRef(0.06);
  const curveAnimT0  = useRef(-1);

  useEffect(() => {
    if (!RETRO_FLAGS.enabled) return;

    const w = size.width, h = size.height;
    const bloomScale = QUALITY_BLOOM_SCALE[RETRO_FLAGS.quality] ?? 0.5;

    const composer = new EffectComposer(gl);
    composer.addPass(new RenderPass(scene, camera));

    const bloom = new UnrealBloomPass(
      new THREE.Vector2(w * bloomScale, h * bloomScale),
      DBG_RETRO_FX.bloomIntensity, 0.5, DBG_RETRO_FX.bloomThreshold,
    );
    composer.addPass(bloom);
    bloomRef.current = bloom;

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
        uFlash:      CRT_UNIFORMS.uFlash,      // F2
        uFlashColor: CRT_UNIFORMS.uFlashColor, // F2
        uFlashGlow:  CRT_UNIFORMS.uFlashGlow,  // F2
        uFlashScanMax: CRT_UNIFORMS.uFlashScanMax, // F3
        uFlashVigAten: CRT_UNIFORMS.uFlashVigAten, // F3
        uFlashCapMax:  CRT_UNIFORMS.uFlashCapMax,  // F3
        uGlare:        CRT_UNIFORMS.uGlare,        // G1
        uGlareCA:      CRT_UNIFORMS.uGlareCA,      // G1
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

    const origRender = gl.render.bind(gl) as typeof gl.render;
    const overriddenRender = (_scene: THREE.Scene, _camera: THREE.Camera) => {
      gl.render = origRender;
      composerRef.current?.render();
      gl.render = overriddenRender;
    };
    gl.render = overriddenRender;

    return () => {
      gl.render = origRender;
      composer.dispose();
      composerRef.current = null;
      crtPassRef.current  = null;
      bloomRef.current    = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, camera]);

  useEffect(() => {
    if (!composerRef.current) return;
    composerRef.current.setSize(size.width, size.height);
    const pr = gl.getPixelRatio();
    CRT_UNIFORMS.uRes.value.set(size.width * pr, size.height * pr);
  }, [size, gl]);

  useEffect(() => {
    const onMode = (e: Event) => {
      const mode = (e as CustomEvent).detail?.mode as string;
      const inLectern = mode !== "none";
      curveStart.current  = CRT_UNIFORMS.uCurve.value;
      curveTarget.current = inLectern ? 0 : curveBaseRef.current;
      curveAnimT0.current = performance.now();
    };
    window.addEventListener("alight:lectern-mode", onMode);
    return () => window.removeEventListener("alight:lectern-mode", onMode);
  }, []);

  useFrame(({ gl: renderer, clock }) => {
    if (!RETRO_FLAGS.enabled) return;
    CRT_UNIFORMS.uTime.value = clock.elapsedTime;
    CRT_UNIFORMS.uComfort.value = RETRO_FLAGS.comfortMode ? 1 : 0;
    // F1: boost temporal de exposición + bloom durante el destello del telón (b=0 → valores normales)
    const b = flashBoost();
    // F2: destello diegético dentro del CRT (tope < 1 para que se vea grano/scanlines sobre el blanco)
    // G1: uFlash sale de la opacidad (el boost de bloom/exposición ya no es igual a ella)
    const op = FLASH_STATE.fase === "inactivo" ? 0 : FLASH_STATE.opacidad;
    CRT_UNIFORMS.uFlash.value     = DBG_FLASH.FLASH_OVERLAY_DOM ? 0 : Math.min(op, DBG_FLASH.FLASH_CRT_MAX);
    CRT_UNIFORMS.uGlare.value     = DBG_FLASH.FLASH_OVERLAY_DOM ? 0 : FLASH_STATE.glare; // G1
    CRT_UNIFORMS.uGlareCA.value   = DBG_FLASH.FLASH_GLARE_ABERRACION;                   // G1
    CRT_UNIFORMS.uFlashGlow.value = DBG_FLASH.FLASH_GLOW;
    CRT_UNIFORMS.uFlashScanMax.value = DBG_FLASH.FLASH_SCAN_MAX;  // F3
    CRT_UNIFORMS.uFlashVigAten.value = DBG_FLASH.FLASH_VIG_ATEN;  // F3
    CRT_UNIFORMS.uFlashCapMax.value  = DBG_FLASH.FLASH_TOPE_LUM;  // F3
    renderer.toneMappingExposure = DBG_RETRO_FX.toneExposure * (1 + (DBG_FLASH.FLASH_EXPOSICION_MULT - 1) * b);
    if (bloomRef.current) {
      bloomRef.current.threshold = DBG_RETRO_FX.bloomThreshold;
      bloomRef.current.strength  = DBG_RETRO_FX.bloomIntensity * (1 + (DBG_FLASH.FLASH_BLOOM_MULT - 1) * b);
    }

    if (curveAnimT0.current >= 0) {
      const t = Math.min(1, (performance.now() - curveAnimT0.current) / CURVE_ANIM_MS);
      const ease = 1 - Math.pow(1 - t, 3);
      CRT_UNIFORMS.uCurve.value = curveStart.current + (curveTarget.current - curveStart.current) * ease;
      if (t >= 1) curveAnimT0.current = -1;
    }
  });

  return null;
}
