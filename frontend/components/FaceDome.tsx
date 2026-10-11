"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { LIVE_TEX_REF } from "@/lib/faceShared";
import { STORE } from "@/lib/alightStore";

const DOME_R = 28;

// ── C4: Star constants ────────────────────────────────────────────────────────
const STAR_COUNT          = 2000;
const STAR_FADE_DUR_MS    = 3_000;  // ms for uFade to go 0 → 1
const STAR_SIZE_MIN       = 0.07;   // world-relative size (×400/dist ≈ px at 26m → ~1px)
const STAR_SIZE_MAX       = 0.42;   // → ~6px at 26m
const STAR_BRIGHTNESS_MIN = 0.35;
const STAR_BRIGHTNESS_MAX = 1.0;
const STAR_TWINKLE_SPEED  = 1.0;   // global speed multiplier
const STAR_R              = DOME_R - 1.5;

// ── C8: Dome constants ────────────────────────────────────────────────────────
const DOME_DELAY_MS    = 15_000;  // ms after chose-light before face dome appears
const GLITCH_INTERVAL  = 5_000;   // ms between effect rotation
const N_SECTORS        = 7;
// Initial mapping: sector i gets effect i (all 7 effects visible from the start)
const SECTOR_INIT      = [0, 1, 2, 3, 4, 5, 6] as const;
// Effects: 0=rgb-split 1=pixelate 2=wave 3=scanlines 4=mirror 5=stretch 6=posterize

// ── C4: Star shaders ──────────────────────────────────────────────────────────
const STAR_VERT = /* glsl */`
  attribute float aSize;
  attribute float aBrightness;
  attribute float aPhase;
  uniform float uFade;
  uniform float uTime;
  uniform float uTwinkleSpeed;
  varying float vBrightness;
  varying float vFade;
  void main() {
    float tw    = 0.65 + 0.35 * sin(uTime * uTwinkleSpeed + aPhase * 6.2832);
    vBrightness = aBrightness * tw;
    vFade       = uFade;
    vec4 mv     = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * 400.0 / (-mv.z);
    gl_Position  = projectionMatrix * mv;
  }
`;
const STAR_FRAG = /* glsl */`
  varying float vBrightness;
  varying float vFade;
  void main() {
    float d     = length(gl_PointCoord - 0.5) * 2.0;
    float alpha = max(0.0, (1.0 - d) * vBrightness * vFade);
    if (alpha <= 0.0) discard;
    gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
  }
`;

// ── C8: 7-sector dome shaders ─────────────────────────────────────────────────
// uE0..uE6: effect index (0-6) for each of the 7 azimuthal sectors.
// Using separate uniforms to avoid GLSL ES 1.0 dynamic array indexing issues.
const DOME_VERT = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv         = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const DOME_FRAG = /* glsl */`
  uniform sampler2D uMap;
  uniform float     uTime;
  uniform float     uE0, uE1, uE2, uE3, uE4, uE5, uE6;
  uniform float     uBrightness, uContrast, uSaturation, uZoom, uPsych;
  varying vec2      vUv;

  float sectorEffect(float s) {
    if (s < 0.5) return uE0;
    if (s < 1.5) return uE1;
    if (s < 2.5) return uE2;
    if (s < 3.5) return uE3;
    if (s < 4.5) return uE4;
    if (s < 5.5) return uE5;
    return uE6;
  }

  vec4 applyEffect(float eff, vec2 uv) {
    vec4 col = texture2D(uMap, uv);
    if (eff < 0.5) {
      // 0: RGB chromatic split
      float sp = 0.012 * abs(sin(uTime * 1.8));
      col.r = texture2D(uMap, uv + vec2( sp, 0.0)).r;
      col.g = texture2D(uMap, uv              ).g;
      col.b = texture2D(uMap, uv - vec2( sp, 0.0)).b;
      col.a = 1.0;
    } else if (eff < 1.5) {
      // 1: Pixelation
      float sz = 0.040;
      vec2 puv = floor(uv / sz) * sz + sz * 0.5;
      col = texture2D(uMap, puv);
    } else if (eff < 2.5) {
      // 2: Wave distortion
      vec2 wuv = uv;
      wuv.x += 0.018 * sin(uv.y * 18.0 + uTime * 4.0);
      wuv.y += 0.013 * sin(uv.x * 13.0 + uTime * 3.0);
      col = texture2D(uMap, clamp(wuv, 0.001, 0.999));
    } else if (eff < 3.5) {
      // 3: Scanlines
      col = texture2D(uMap, uv);
      col.rgb *= 0.60 + 0.40 * step(0.5, fract(uv.y * 52.0));
    } else if (eff < 4.5) {
      // 4: Horizontal mirror
      col = texture2D(uMap, vec2(1.0 - uv.x, uv.y));
    } else if (eff < 5.5) {
      // 5: Vertical stretch (expand centre slice)
      float y = clamp((uv.y - 0.3) / 0.4, 0.0, 1.0);
      col = texture2D(uMap, vec2(uv.x, y));
    } else {
      // 6: Posterize (4 levels)
      col = texture2D(uMap, uv);
      col.rgb = floor(col.rgb * 4.0) / 4.0;
    }
    return col;
  }

  void main() {
    // Zoom: uZoom > 1 = zoom in (crop centre)
    vec2 zUv = (vUv - 0.5) / max(0.1, uZoom) + 0.5;
    zUv = clamp(zUv, 0.0, 1.0);

    float sector = clamp(floor(vUv.x * 7.0), 0.0, 6.0);
    float eff    = sectorEffect(sector);
    vec4  col    = applyEffect(eff, zUv);

    // Psychedelic overlay
    if (uPsych > 0.001) {
      vec2 pUv = zUv;
      pUv.x = abs(mod(pUv.x * 3.0 + uTime * 0.07, 2.0) - 1.0);
      float pEff = mod(eff + 2.0, 7.0);
      vec4  pc   = applyEffect(pEff, pUv);
      col = mix(col, pc, min(1.0, uPsych) * 0.55);
      float luma = dot(col.rgb, vec3(0.299, 0.587, 0.114));
      float hs   = uTime * 0.4 * uPsych;
      col.r = mix(col.r, 0.5 * col.b + 0.5 * luma, abs(sin(hs)));
      col.g = mix(col.g, 0.5 * col.r + 0.5 * luma, abs(cos(hs * 0.71)));
    }

    // Webcam colour adjustments from T5 panel
    col.rgb = clamp(col.rgb * uBrightness, 0.0, 1.0);
    float ct = max(0.001, uContrast);
    col.rgb  = (col.rgb - 0.5) * ct + 0.5;
    float lm = dot(col.rgb, vec3(0.299, 0.587, 0.114));
    col.rgb  = mix(vec3(lm), col.rgb, max(0.0, uSaturation));
    col.rgb  = clamp(col.rgb, 0.0, 1.0);

    gl_FragColor = col;
  }
`;

// ── Star geometry factory ─────────────────────────────────────────────────────
function makeStarGeo(): THREE.BufferGeometry {
  const pos    = new Float32Array(STAR_COUNT * 3);
  const sizes  = new Float32Array(STAR_COUNT);
  const bright = new Float32Array(STAR_COUNT);
  const phases = new Float32Array(STAR_COUNT);

  for (let i = 0; i < STAR_COUNT; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(2 * Math.random() - 1);
    const r     = STAR_R + (Math.random() - 0.5) * 2;
    pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    pos[i * 3 + 2] = r * Math.cos(phi);
    sizes[i]  = STAR_SIZE_MIN + Math.random() * (STAR_SIZE_MAX - STAR_SIZE_MIN);
    bright[i] = STAR_BRIGHTNESS_MIN + Math.random() * (STAR_BRIGHTNESS_MAX - STAR_BRIGHTNESS_MIN);
    phases[i] = Math.random();
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position",    new THREE.BufferAttribute(pos,    3));
  geo.setAttribute("aSize",       new THREE.BufferAttribute(sizes,  1));
  geo.setAttribute("aBrightness", new THREE.BufferAttribute(bright, 1));
  geo.setAttribute("aPhase",      new THREE.BufferAttribute(phases, 1));
  return geo;
}

// Exported for the C9 debug menu to update shader uniforms live
export const DBG_STAR_MAT: { value: THREE.ShaderMaterial | null } = { value: null };
export const DBG_DOME_MAT: { value: THREE.ShaderMaterial | null } = { value: null };

// ── FaceDome ──────────────────────────────────────────────────────────────────
export default function FaceDome() {
  const [active,   setActive]   = useState(false);
  const [showDome, setShowDome] = useState(false);
  const [liveTex,  setLiveTex]  = useState<THREE.Texture | null>(null);

  const activeTimeRef   = useRef(0);
  const fadeDoneRef     = useRef(false);
  const glitchOffset    = useRef(0);
  const activatedOnce   = useRef(false); // guard: prevent double-fire + avoid deps=[active] cleanup bug
  const domeTimer       = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const glitchTimer     = useRef<ReturnType<typeof setInterval> | null>(null);

  const starGeo = useMemo(() => makeStarGeo(), []);

  const starUniforms = useMemo(() => ({
    uFade:         { value: 0.0 },
    uTime:         { value: 0.0 },
    uTwinkleSpeed: { value: STAR_TWINKLE_SPEED },
  }), []);

  const domeUniforms = useMemo(() => ({
    uMap:        { value: new THREE.Texture() },
    uTime:       { value: 0.0 },
    uE0:         { value: SECTOR_INIT[0] as number },
    uE1:         { value: SECTOR_INIT[1] as number },
    uE2:         { value: SECTOR_INIT[2] as number },
    uE3:         { value: SECTOR_INIT[3] as number },
    uE4:         { value: SECTOR_INIT[4] as number },
    uE5:         { value: SECTOR_INIT[5] as number },
    uE6:         { value: SECTOR_INIT[6] as number },
    // T5: webcam colour adjustments + psychedelic mode
    uBrightness: { value: 1.0 },
    uContrast:   { value: 1.0 },
    uSaturation: { value: 1.0 },
    uZoom:       { value: 1.0 },
    uPsych:      { value: 0.0 },
  }), []);

  const starMat = useMemo(() => {
    const m = new THREE.ShaderMaterial({
      vertexShader:   STAR_VERT,
      fragmentShader: STAR_FRAG,
      uniforms:       starUniforms,
      transparent:    true,
      depthWrite:     false,
    });
    DBG_STAR_MAT.value = m;
    return m;
  }, [starUniforms]);

  const domeMat = useMemo(() => {
    const m = new THREE.ShaderMaterial({
      vertexShader:   DOME_VERT,
      fragmentShader: DOME_FRAG,
      uniforms:       domeUniforms,
      side:           THREE.BackSide,
    });
    DBG_DOME_MAT.value = m;
    return m;
  }, [domeUniforms]);

  // Activate on chose-light (TARIMA path).
  // deps=[] so cleanup runs ONLY on unmount — NOT when `active` state changes.
  // If deps included `active`, the cleanup would cancel domeTimer the moment
  // setActive(true) triggers a re-render, killing the 15-second countdown.
  useEffect(() => {
    const onLight = () => {
      if (activatedOnce.current) return;
      activatedOnce.current = true;
      setActive(true);
      activeTimeRef.current = Date.now();
      domeTimer.current = setTimeout(() => setShowDome(true), DOME_DELAY_MS);
    };
    window.addEventListener("alight:chose-light", onLight);
    return () => {
      window.removeEventListener("alight:chose-light", onLight);
      if (domeTimer.current) clearTimeout(domeTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start effect rotation when dome becomes visible; signal LecternSystem
  useEffect(() => {
    if (!showDome) return;
    window.dispatchEvent(new CustomEvent("alight:dome-visible"));
    const efKeys = ["uE0","uE1","uE2","uE3","uE4","uE5","uE6"] as const;
    const rotate = () => {
      glitchOffset.current = (glitchOffset.current + 1) % N_SECTORS;
      for (let i = 0; i < N_SECTORS; i++) {
        const eff = (SECTOR_INIT[i] + glitchOffset.current) % N_SECTORS;
        domeUniforms[efKeys[i]].value = eff;
      }
    };
    glitchTimer.current = setInterval(rotate, GLITCH_INTERVAL);
    return () => { if (glitchTimer.current) clearInterval(glitchTimer.current); };
  }, [showDome, domeUniforms]);

  // Pick up live webcam texture when camera starts
  useEffect(() => {
    const onCam = () => {
      const tex = LIVE_TEX_REF.value as THREE.Texture | null;
      if (tex) setLiveTex(tex);
    };
    window.addEventListener("alight:camera-started", onCam);
    return () => window.removeEventListener("alight:camera-started", onCam);
  }, []);

  // Apply live texture to dome shader
  useEffect(() => {
    if (liveTex) domeUniforms.uMap.value = liveTex;
  }, [liveTex, domeUniforms]);

  // Per-frame: animate star fade-in, advance time uniforms, sync STORE → dome shader
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;

    if (active && !fadeDoneRef.current) {
      const progress = Math.min(1, (Date.now() - activeTimeRef.current) / STAR_FADE_DUR_MS);
      starUniforms.uFade.value = progress;
      starUniforms.uTime.value = t;
      if (progress >= 1 && !fadeDoneRef.current) {
        fadeDoneRef.current = true;
        window.dispatchEvent(new CustomEvent("alight:stars-visible"));
      }
    } else if (active) {
      starUniforms.uTime.value = t;
    }

    domeUniforms.uTime.value = t;

    // Sync T5 webcam/psychedelic controls from STORE
    if (showDome) {
      domeUniforms.uBrightness.value = STORE.webcam.brightness;
      domeUniforms.uContrast.value   = STORE.webcam.contrast;
      domeUniforms.uSaturation.value = STORE.webcam.saturation;
      domeUniforms.uZoom.value       = STORE.webcam.zoom;
      domeUniforms.uPsych.value      = STORE.dome.psychedelic ? 1.0 : 0.0;
    }
  });

  if (!active) return null;

  return (
    <group>
      {/* C4: twinkling stars — fade in over STAR_FADE_DUR_MS, visible until dome appears */}
      {!showDome && (
        <points geometry={starGeo} material={starMat} />
      )}

      {/* C8: 7-sector live-webcam dome with per-sector glitch effects */}
      {showDome && (
        <mesh>
          {/* Slightly inside ExperienceDome shell (r=30) so this occludes it */}
          <sphereGeometry args={[DOME_R - 0.5, 64, 40, 0, Math.PI * 2, 0, Math.PI * 0.52]} />
          <primitive object={domeMat} attach="material" />
        </mesh>
      )}
    </group>
  );
}
