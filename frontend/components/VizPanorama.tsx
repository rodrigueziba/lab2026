"use client";
// U1: SVG-textured panoramic layers inside the dome.
// Sphere bands: 3 mountain layers + 1 lines layer.
// Sprite billboards: 120 stars, 10 clouds, 3 concentric sun sprites.
// Reads grow/pulse refs from DomeVisualizer; no per-frame allocations.

import { useRef, useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { DBG_SILLAS } from "@/lib/debugConfig";
import { VIZ_SUN_AZ_DEG, VIZ_SUN_EL_DEG } from "@/lib/vizSunState";
import { BAND_STATE } from "@/lib/vizAudio";
import { getDawnState, finishDawnPhase1, resetDawn, skipDawnToFinal } from "@/lib/alightStore";

// ── Geometry constants ────────────────────────────────────────────────────────
const DOME_R = 28;
const DEG = Math.PI / 180;
const eo3 = (t: number) => 1 - (1 - t) ** 3;

// Mountain band: elev -5° (bottom, V=0) to +40° (top, V=1)
const MT_T0 = Math.PI / 2 - 40 * DEG;   // theta at top of band
const MT_TL = 45 * DEG;                  // span 45° (−5° to +40°)

// Lines band: elev -10° (bottom, V=0) to +12.5° (top, V=1)
const LN_T0 = Math.PI / 2 - 12.5 * DEG;
const LN_TL = 22.5 * DEG;               // span 22.5°

// ── Sphere band shader ────────────────────────────────────────────────────────
// Reveals from bottom (V=0) upward as uReveal goes from -0.1 (hidden) to 1.1 (full).
const BAND_VERT = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const BAND_FRAG = /* glsl */`
  uniform sampler2D uTex;
  uniform float uReveal;        // -0.1=nothing, 1.1=fully revealed
  uniform float uOpacity;       // global fade (0 until texture loads)
  uniform float uBright;        // audio brightness boost (1.0 = no boost)
  uniform float uOffset;        // horizontal scroll 0–1 (seamless, for lines)
  uniform float uMagenta;       // U7: 1.0 = replace with magenta test color
  uniform float uSectorCenter;  // U9: normalized azimuth 0–1 of sector center
  uniform float uSectorWidth;   // U9: normalized full width (90/360=0.25, >1.0=full circle)
  uniform float uSectorEdge;    // U9: normalized soft edge (8/360≈0.022)
  varying vec2 vUv;
  void main() {
    vec2 uv = vec2(fract(vUv.x + uOffset), vUv.y);
    vec4 c  = texture2D(uTex, uv);
    float m = 1.0 - smoothstep(uReveal - 0.06, uReveal + 0.06, uv.y);
    // U9: azimuth sector mask (halfW>0.5 → full circle, no visible seam)
    float delta = abs(fract(vUv.x - uSectorCenter + 0.5) - 0.5);
    float halfW = uSectorWidth * 0.5;
    float sectM = 1.0 - smoothstep(halfW - uSectorEdge, halfW + uSectorEdge, delta);
    if (uMagenta > 0.5) c = vec4(1.0, 0.0, 1.0, 1.0);
    gl_FragColor = vec4(c.rgb * uBright, c.a * m * sectM * uOpacity);
  }
`;

// ── Band uniform factory ──────────────────────────────────────────────────────
interface BandUni {
  [k: string]: THREE.IUniform;
  uTex:          THREE.IUniform<THREE.Texture | null>;
  uReveal:       THREE.IUniform<number>;
  uOpacity:      THREE.IUniform<number>;
  uBright:       THREE.IUniform<number>;
  uOffset:       THREE.IUniform<number>;
  uMagenta:      THREE.IUniform<number>;
  uSectorCenter: THREE.IUniform<number>;
  uSectorWidth:  THREE.IUniform<number>;
  uSectorEdge:   THREE.IUniform<number>;
}
const mkBU = (): BandUni => ({
  uTex: { value: null }, uReveal: { value: -0.1 },
  uOpacity: { value: 0 }, uBright: { value: 1 }, uOffset: { value: 0 },
  uMagenta: { value: 0 },
  uSectorCenter: { value: 0 }, uSectorWidth: { value: 2.0 }, uSectorEdge: { value: 0.022 },
});

// ── U5: liquid psychedelic lines shader ───────────────────────────────────────
const LINE_FRAG = /* glsl */`
  uniform sampler2D uTex;
  uniform float uReveal;
  uniform float uOpacity;
  uniform float uBright;
  uniform float uOffset;
  uniform float uEnergy;   // smoothed group-3 normEnergy (0–1)
  uniform float uTime;     // clock.elapsedTime
  uniform float uPsyMix;   // palette blend factor (0.15 quiet → 0.95 loud)
  uniform float uPsyMode;  // 1.0 = on, 0.0 = pass-through
  uniform float uWaveAmp;  // vertical wave amplitude (UV fraction)
  uniform float uWaveFreq; // wave cycles across azimuth
  uniform float uWaveSpd;  // wave temporal speed
  uniform float uFbmSpd;   // FBM animation speed multiplier
  uniform float uMagenta;  // U7: 1.0 = replace with magenta test color
  varying vec2 vUv;

  vec2 hash22(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p.yx + 19.19);
    return fract(vec2(p.x * p.y * 95.4307, p.x * p.y * 97.597));
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(dot(hash22(i)           * 2.0 - 1.0, f),
                   dot(hash22(i+vec2(1,0)) * 2.0 - 1.0, f - vec2(1,0)), u.x),
               mix(dot(hash22(i+vec2(0,1)) * 2.0 - 1.0, f - vec2(0,1)),
                   dot(hash22(i+vec2(1,1)) * 2.0 - 1.0, f - vec2(1,1)), u.x), u.y);
  }
  float fbm3(vec2 p) {
    return vnoise(p)*0.5 + vnoise(p*2.1)*0.25 + vnoise(p*4.3)*0.125;
  }
  // Cosine palette — retro warm (amber/rust/crema tones)
  vec3 cosPalette(float t) {
    vec3 a = vec3(0.60, 0.40, 0.25);
    vec3 b = vec3(0.45, 0.40, 0.30);
    vec3 c = vec3(1.00, 0.80, 0.85);
    vec3 d = vec3(0.00, 0.20, 0.55);
    return clamp(a + b * cos(6.28318 * (c * t + d)), 0.0, 1.0);
  }
  void main() {
    // Paso 3: vertical wave deformation before UV sampling
    float wave = uEnergy * uWaveAmp * sin(vUv.x * 6.28318 * uWaveFreq + uTime * uWaveSpd);
    vec2  uv   = vec2(fract(vUv.x + uOffset), clamp(vUv.y + wave, 0.0, 1.0));
    vec4  orig = texture2D(uTex, uv);
    float m    = 1.0 - smoothstep(uReveal - 0.06, uReveal + 0.06, uv.y);
    if (uPsyMode < 0.5) {
      gl_FragColor = vec4(orig.rgb * uBright, orig.a * m * uOpacity);
      return;
    }
    // Paso 2: domain-warped FBM + cosine palette
    float st = uTime * uFbmSpd;
    vec2  wp = uv * vec2(3.0, 1.5);
    vec2  q  = vec2(fbm3(wp + vec2(0.0, st)),
                    fbm3(wp + vec2(3.7, 1.9) + st * 0.7));
    float f  = fbm3(wp + 2.5 * q + vec2(st * 0.3, 0.0));
    vec3  pal = cosPalette(f * 0.5 + 0.5 + st * 0.05);
    vec3  rgb = mix(orig.rgb * uBright, pal * uBright, uPsyMix);
    // Paso 3: sharpen alpha → thinner dark outlines at high energy
    float aSharp = 1.0 + uEnergy * 2.5;
    float a      = pow(clamp(orig.a, 0.0, 1.0), 1.0 / aSharp);
    if (uMagenta > 0.5) { gl_FragColor = vec4(1.0, 0.0, 1.0, m * uOpacity); return; }
    gl_FragColor = vec4(rgb, a * m * uOpacity);
  }
`;
interface LineUni {
  [k: string]: THREE.IUniform;
  uTex:      THREE.IUniform<THREE.Texture | null>;
  uReveal:   THREE.IUniform<number>;
  uOpacity:  THREE.IUniform<number>;
  uBright:   THREE.IUniform<number>;
  uOffset:   THREE.IUniform<number>;
  uEnergy:   THREE.IUniform<number>;
  uTime:     THREE.IUniform<number>;
  uPsyMix:   THREE.IUniform<number>;
  uPsyMode:  THREE.IUniform<number>;
  uWaveAmp:  THREE.IUniform<number>;
  uWaveFreq: THREE.IUniform<number>;
  uWaveSpd:  THREE.IUniform<number>;
  uFbmSpd:   THREE.IUniform<number>;
  uMagenta:  THREE.IUniform<number>;
}
const mkLU = (): LineUni => ({
  uTex:     { value: null }, uReveal:  { value: -0.1 },
  uOpacity: { value: 0 },   uBright:  { value: 1 },   uOffset:  { value: 0 },
  uEnergy:  { value: 0 },   uTime:    { value: 0 },
  uPsyMix:  { value: 0.15 }, uPsyMode: { value: 1 },
  uWaveAmp: { value: 0.08 }, uWaveFreq: { value: 3.0 },
  uWaveSpd: { value: 1.5 },  uFbmSpd:  { value: 0.08 },
  uMagenta: { value: 0 },
});

// ── Seeded deterministic RNG ──────────────────────────────────────────────────
function mkRng(seed: number) {
  let v = (seed >>> 0) || 1;
  return () => { v ^= v << 13; v ^= v >>> 17; v ^= v << 5; return (v >>> 0) / 0x100000000; };
}

// ── SVG texture loader ────────────────────────────────────────────────────────
function loadSvgTex(
  url: string, w: number, h: number, aniso: number,
  onLoad: (tex: THREE.CanvasTexture) => void,
): () => void {
  const img = new Image();
  img.onload = () => {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, w, h);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace     = THREE.SRGBColorSpace;
    tex.minFilter      = THREE.LinearMipmapLinearFilter;
    tex.magFilter      = THREE.LinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy     = aniso;
    tex.needsUpdate    = true;
    onLoad(tex);
  };
  img.onerror = () => {};
  img.src = url;
  return () => { img.onload = null; };
}

// ── Fixed star data (module-level, computed once) ─────────────────────────────
const STAR_COUNT = 120;
const STAR_DATA = (() => {
  const rng = mkRng(0x5EA2B07F);
  return Array.from({ length: STAR_COUNT }, (_, i) => {
    const elev    = 12 + rng() * 68;
    const az      = rng() * 360;
    const sizeAng = 0.8 + rng() * 2.2;
    const sr      = DOME_R * 0.94;
    const sz      = 2 * sr * Math.tan(sizeAng * DEG / 2);
    const e = elev * DEG, a = az * DEG;
    return {
      pos: new THREE.Vector3(sr * Math.cos(e) * Math.cos(a), sr * Math.sin(e), sr * Math.cos(e) * Math.sin(a)),
      sz,
      rot: rng() * Math.PI * 2,
      type: (i % 3) as 0 | 1 | 2,   // 0=punto, 1=azul4, 2=naranja8
      t: (elev - 12) / 68,           // 0=lowest 12°, 1=highest 80°
    };
  });
})();

// ── Fixed cloud data (module-level) ──────────────────────────────────────────
const CLOUD_COUNT = 10;
const CLOUD_DATA = (() => {
  const rng = mkRng(0xC10D5CC3);
  return Array.from({ length: CLOUD_COUNT }, (_, i) => {
    const elev    = 8 + rng() * 27;
    const az      = rng() * 360;
    const sizeAng = 8 + rng() * 12;
    const sr      = DOME_R * 0.94;
    const sz      = 2 * sr * Math.tan(sizeAng * DEG / 2);
    const driftDir = rng() > 0.5 ? 1 : -1;
    return {
      az0: az,                           // initial azimuth (deg)
      el:  elev,
      sz,
      atlas: (i % 4) as 0 | 1 | 2 | 3,
      driftSpeed: (0.005 + rng() * 0.01) * driftDir,  // deg/s
      t: (elev - 8) / 27,
    };
  });
})();

// ── Sun sprite sizes (angular diameter in world units) ────────────────────────
// Sprites at DOME_R*0.90; ring=24°, disc=20°, core=15°
const SUN_R = DOME_R * 0.90;
const SUN_AZ_RAD = VIZ_SUN_AZ_DEG * DEG;
const SUN_RING_SZ   = 2 * SUN_R * Math.tan(24 * DEG / 2);
const SUN_DISCO_SZ  = 2 * SUN_R * Math.tan(20 * DEG / 2);
const SUN_NUCLEO_SZ = 2 * SUN_R * Math.tan(15 * DEG / 2);

// ── Component ─────────────────────────────────────────────────────────────────
export interface VizPanoramaProps {
  growRef:  React.MutableRefObject<number[]>;
  pulseRef?: React.MutableRefObject<number[]>; // U4: VizPanorama reads BAND_STATE directly now
  flowRef:  React.MutableRefObject<number>;
  kickRef:  React.MutableRefObject<number>;
}

export default function VizPanorama({ growRef, flowRef, kickRef }: VizPanoramaProps) {
  const { gl } = useThree();
  const maxAniso = useMemo(() => gl.capabilities.getMaxAnisotropy(), [gl]);

  // ── Band uniforms — lazy-init null pattern (same as DomeVisualizer skyUniformsRef)
  // Avoids react-hooks/refs and react-hooks/immutability while keeping objects stable.
  const fondoURef  = useRef<BandUni | null>(null);
  const mediasURef = useRef<BandUni | null>(null);
  const frenteURef = useRef<BandUni | null>(null);
  const lineURef   = useRef<LineUni | null>(null);
  if (fondoURef.current == null)  fondoURef.current  = mkBU();
  if (mediasURef.current == null) mediasURef.current = mkBU();
  if (frenteURef.current == null) frenteURef.current = mkBU();
  if (lineURef.current == null)   lineURef.current   = mkLU();
  const fondoU  = fondoURef.current;
  const mediasU = mediasURef.current;
  const frenteU = frenteURef.current;
  const lineU   = lineURef.current;

  // ── Mountain mesh refs (for Y scale in useFrame) ─────────────────────────
  const fondoMeshRef  = useRef<THREE.Mesh | null>(null);
  const mediasMeshRef = useRef<THREE.Mesh | null>(null);
  const frenteMeshRef = useRef<THREE.Mesh | null>(null);

  // ── U4: per-group envelope smooth state (no per-frame alloc) ────────────
  const grpPulseRef = useRef([0, 0, 0, 0]);  // smoothed normEnergy per group
  const sunSmoRef   = useRef([0, 0, 0]);      // smoothed per ring (anillo, disco, nucleo)

  // ── Cloud current azimuths (mutable, no React state) ─────────────────────
  const cloudAzRef = useRef(CLOUD_DATA.map(c => c.az0));

  // U9: dawn debug button signals — set by event handlers, consumed in useFrame
  const dawnResetRef = useRef(false);
  const dawnSkipRef  = useRef(false);

  // U9: dawn debug event listeners
  useEffect(() => {
    const onReset = () => { dawnResetRef.current = true; };
    const onSkip  = () => { dawnSkipRef.current  = true; };
    window.addEventListener('alight:dawn-reset', onReset);
    window.addEventListener('alight:dawn-skip',  onSkip);
    return () => {
      window.removeEventListener('alight:dawn-reset', onReset);
      window.removeEventListener('alight:dawn-skip',  onSkip);
    };
  }, []);

  // ── Sprite refs (populated via callback refs in JSX) ──────────────────────
  const starSpritesRef   = useRef<THREE.Sprite[]>([]);
  const cloudSpritesRef  = useRef<THREE.Sprite[]>([]);
  const sunAnilloRef     = useRef<THREE.Sprite | null>(null);
  const sunDiscoRef      = useRef<THREE.Sprite | null>(null);
  const sunNucleoRef     = useRef<THREE.Sprite | null>(null);

  // ── Texture loading ───────────────────────────────────────────────────────
  // Mountain textures (4096×512 seamless strips)
  useEffect(() => {
    const fU = fondoU, mU = mediasU, eU = frenteU;
    const defs: Array<[string, BandUni]> = [
      ["/visualizer/montanas-fondo.svg",  fU],
      ["/visualizer/montanas-medias.svg", mU],
      ["/visualizer/montanas-frente.svg", eU],
    ];
    const cleanups = defs.map(([url, uni]) =>
      loadSvgTex(url, 4096, 512, maxAniso, (tex) => {
        uni.uTex.value     = tex;
        uni.uOpacity.value = 1;
      }),
    );
    return () => {
      cleanups.forEach(fn => fn());
      fU.uTex.value?.dispose();
      mU.uTex.value?.dispose();
      eU.uTex.value?.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxAniso]);  // fondoU/mediasU/frenteU are stable (lazy-init once)

  // Lines texture (4096×256, animated scroll)
  useEffect(() => {
    const lU = lineU;
    const cleanup = loadSvgTex("/visualizer/lineas-ondulantes.svg", 4096, 256, maxAniso, (tex) => {
      lU.uTex.value     = tex;
      lU.uOpacity.value = 1;
    });
    return () => { cleanup(); lU.uTex.value?.dispose(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxAniso]);  // lineU is stable (lazy-init once)

  // Star textures (256×256 each)
  useEffect(() => {
    const defs: Array<[string, 0 | 1 | 2]> = [
      ["/visualizer/estrella-punto.svg",     0],
      ["/visualizer/estrella-azul-4.svg",    1],
      ["/visualizer/estrella-naranja-8.svg", 2],
    ];
    const cleanups = defs.map(([url, typeIdx]) =>
      loadSvgTex(url, 256, 256, maxAniso, (tex) => {
        starSpritesRef.current.forEach((sp, i) => {
          if (STAR_DATA[i].type === typeIdx) {
            sp.material.map = tex;
            sp.material.needsUpdate = true;
          }
        });
      }),
    );
    return () => cleanups.forEach(fn => fn());
  }, [maxAniso]);

  // Cloud atlas 2048×512 → 4 crops of 512×512
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      for (let idx = 0; idx < 4; idx++) {
        const c = document.createElement("canvas");
        c.width = c.height = 512;
        const ctx = c.getContext("2d");
        if (!ctx) continue;
        ctx.drawImage(img, idx * 512, 0, 512, 512, 0, 0, 512, 512);
        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace      = THREE.SRGBColorSpace;
        tex.minFilter       = THREE.LinearMipmapLinearFilter;
        tex.magFilter       = THREE.LinearFilter;
        tex.generateMipmaps = true;
        tex.anisotropy      = maxAniso;
        tex.needsUpdate     = true;
        const ai = idx as 0 | 1 | 2 | 3;
        cloudSpritesRef.current.forEach((sp, i) => {
          if (CLOUD_DATA[i].atlas === ai) {
            sp.material.map = tex;
            sp.material.needsUpdate = true;
          }
        });
      }
    };
    img.onerror = () => {};
    img.src = "/visualizer/nubes-atlas.svg";
    return () => { img.onload = null; };
  }, [maxAniso]);

  // Sun textures (1024×1024 each)
  useEffect(() => {
    const defs: Array<[string, React.MutableRefObject<THREE.Sprite | null>]> = [
      ["/visualizer/sol-anillo-rojo.svg",     sunAnilloRef],
      ["/visualizer/sol-disco-crema.svg",     sunDiscoRef],
      ["/visualizer/sol-nucleo-amarillo.svg", sunNucleoRef],
    ];
    const cleanups = defs.map(([url, ref]) =>
      loadSvgTex(url, 1024, 1024, maxAniso, (tex) => {
        if (ref.current) { ref.current.material.map = tex; ref.current.material.needsUpdate = true; }
      }),
    );
    return () => cleanups.forEach(fn => fn());
  }, [maxAniso]);

  // ── Per-frame updates ─────────────────────────────────────────────────────
  useFrame(({ clock }, dt) => {
    const gr   = growRef.current;
    const kick = kickRef.current;
    const t_s  = clock.elapsedTime;    // seconds, for oscillators

    // ── Eased grow values (respect debug force overrides) ─────────────────
    const g0 = eo3(DBG_SILLAS.vizGrowForce0 >= 0 ? DBG_SILLAS.vizGrowForce0 : gr[0]);
    const g1 = eo3(DBG_SILLAS.vizGrowForce1 >= 0 ? DBG_SILLAS.vizGrowForce1 : gr[1]);
    const g2 = eo3(DBG_SILLAS.vizGrowForce2 >= 0 ? DBG_SILLAS.vizGrowForce2 : gr[2]);
    const g3 = eo3(DBG_SILLAS.vizGrowForce3 >= 0 ? DBG_SILLAS.vizGrowForce3 : gr[3]);

    // ── U4: per-group envelope (attack/release from BAND_STATE directly) ──
    const assign = BAND_STATE.assignment;
    const norm   = BAND_STATE.normEnergy;
    const gp     = grpPulseRef.current;
    const atkMs  = [DBG_SILLAS.grp0AtkMs, DBG_SILLAS.grp1AtkMs, DBG_SILLAS.grp2AtkMs, DBG_SILLAS.grp3AtkMs];
    const relMs  = [DBG_SILLAS.grp0RelMs, DBG_SILLAS.grp1RelMs, DBG_SILLAS.grp2RelMs, DBG_SILLAS.grp3RelMs];
    for (let i = 0; i < 4; i++) {
      const raw  = norm[assign[i]] ?? 0;
      const prev = gp[i];
      const af   = 1 - Math.exp(-dt / (atkMs[i] / 1000));
      const rf   = 1 - Math.exp(-dt / (relMs[i] / 1000));
      gp[i]      = raw > prev ? prev + (raw - prev) * af : prev + (raw - prev) * rf;
    }
    const p0 = gp[0];  // SOL
    const p1 = gp[1];  // MONTAÑAS
    const p2 = gp[2];  // CIELO
    const p3 = gp[3];  // LÍNEAS

    // ── U9: dawn sequence overrides — all local floats, no allocations ───────
    if (dawnResetRef.current) { dawnResetRef.current = false; resetDawn(); }
    if (dawnSkipRef.current)  { dawnSkipRef.current  = false; skipDawnToFinal(t_s); }
    const dawn      = getDawnState();
    const DEG_NORM  = 1 / 360;  // normalizing factor (degrees → 0–1)
    let effG0       = g0;
    let effG2       = g2;
    let effSunAz    = SUN_AZ_RAD;
    let dawnStarSc  = 1.0;
    let dawnCloudSc = 1.0;
    let dawnFrW     = 2.0;      // uSectorWidth — 2.0 = full circle (halfW=1.0>any delta)
    const dawnFrC   = dawn.sectorDeg * DEG_NORM;
    let dawnFrenteRev = 1.1;
    let dawnFondoRev  = 1.1;
    let dawnMediasRev = 1.1;
    let dawnLineRev   = 1.1;
    let overRev     = false;
    const dawnEdge  = DBG_SILLAS.amanecerEdgeDeg * DEG_NORM;

    if (dawn.phase === 'inactivo') {
      effG0 = 0; effG2 = 0;
      dawnStarSc = 0; dawnCloudSc = 0;
      dawnFrenteRev = dawnFondoRev = dawnMediasRev = dawnLineRev = -0.1;
      overRev = true;
    } else if (dawn.phase === 'amanecer') {
      const rawT = THREE.MathUtils.clamp((t_s - dawn.startT) / DBG_SILLAS.amanecerDurS, 0, 1);
      const t    = eo3(rawT);
      effG0      = t; effG2 = 0;
      effSunAz   = ((dawn.sectorDeg + 180) % 360) * DEG;
      dawnStarSc = 0; dawnCloudSc = 0;
      dawnFrW    = DBG_SILLAS.amanecerSectorDeg * DEG_NORM;
      dawnFrenteRev = t * 1.2 - 0.1;
      dawnFondoRev  = dawnMediasRev = dawnLineRev = -0.1;
      overRev    = true;
      if (rawT >= 1.0) finishDawnPhase1(t_s);
    } else {
      // completo — phase 2 staggered reveals
      const p2T  = t_s - dawn.completeT;
      const stS  = DBG_SILLAS.amanecerP2StaggerS;
      const grS  = DBG_SILLAS.amanecerP2GrowS;
      effG0 = 1; effG2 = 1;
      const sunAzDawn = ((dawn.sectorDeg + 180) % 360) * DEG;
      effSunAz    = sunAzDawn + (SUN_AZ_RAD - sunAzDawn) * THREE.MathUtils.clamp(p2T / 2, 0, 1);
      dawnStarSc  = THREE.MathUtils.clamp(p2T / 3, 0, 1);
      dawnCloudSc = THREE.MathUtils.clamp((p2T - 1) / 2, 0, 1);
      dawnFrW     = 0.25 + 1.75 * THREE.MathUtils.clamp(p2T / 3, 0, 1);  // 0.25→2.0 over 3 s
      dawnFrenteRev  = 1.1;
      dawnFondoRev   = eo3(THREE.MathUtils.clamp(p2T / grS, 0, 1)) * 1.2 - 0.1;
      dawnMediasRev  = eo3(THREE.MathUtils.clamp((p2T - stS) / grS, 0, 1)) * 1.2 - 0.1;
      dawnLineRev    = eo3(THREE.MathUtils.clamp((p2T - stS * 2) / grS, 0, 1)) * 1.2 - 0.1;
      overRev = true;
    }

    // ── SOL (group 0) — golpe seco, 3 rings desfasados 40ms ──────────────
    const ss   = sunSmoRef.current;
    const b0   = assign[0];
    const raw0 = norm[b0] ?? 0;
    const lagMs = DBG_SILLAS.sunRingLagMs;
    for (let r = 0; r < 3; r++) {
      const effAtk = DBG_SILLAS.grp0AtkMs + r * lagMs;
      const effRel = DBG_SILLAS.grp0RelMs + r * lagMs * 0.5;
      const af     = 1 - Math.exp(-dt / (effAtk / 1000));
      const rf     = 1 - Math.exp(-dt / (effRel / 1000));
      const prev   = ss[r];
      ss[r]        = raw0 > prev ? prev + (raw0 - prev) * af : prev + (raw0 - prev) * rf;
    }
    const sunEl  = VIZ_SUN_EL_DEG * effG0 * DEG;
    const sunAz  = effSunAz;
    const sunPX  = SUN_R * Math.cos(sunEl) * Math.cos(sunAz);
    const sunPY  = SUN_R * Math.sin(sunEl);
    const sunPZ  = SUN_R * Math.cos(sunEl) * Math.sin(sunAz);
    const sunOp  = Math.min(1, THREE.MathUtils.smoothstep(0, 0.15, effG0) * (1 + p0 * DBG_SILLAS.sunBrightBoost));
    const ringSz = SUN_RING_SZ   * (1 + ss[0] * DBG_SILLAS.u2SunRingBoost + kick * DBG_SILLAS.u2KickScale);
    const discSz = SUN_DISCO_SZ  * (1 + ss[1] * DBG_SILLAS.u2SunDiscBoost + kick * DBG_SILLAS.u2KickScale * 0.8);
    const coreSz = SUN_NUCLEO_SZ * (1 + ss[2] * DBG_SILLAS.u2SunCoreBoost + kick * DBG_SILLAS.u2KickScale * 1.2);
    const coreOp = Math.min(1, sunOp * (1 + kick * DBG_SILLAS.sunCoreKickBrt)); // core blinks on kick
    if (sunAnilloRef.current)  {
      sunAnilloRef.current.position.set(sunPX, sunPY, sunPZ);
      sunAnilloRef.current.material.opacity = sunOp;
      sunAnilloRef.current.scale.set(ringSz, ringSz, 1);
    }
    if (sunDiscoRef.current)   {
      sunDiscoRef.current.position.set(sunPX, sunPY, sunPZ);
      sunDiscoRef.current.material.opacity = sunOp;
      sunDiscoRef.current.scale.set(discSz, discSz, 1);
    }
    if (sunNucleoRef.current)  {
      sunNucleoRef.current.position.set(sunPX, sunPY, sunPZ);
      sunNucleoRef.current.material.opacity = coreOp;
      sunNucleoRef.current.scale.set(coreSz, coreSz, 1);
    }

    // ── MONTAÑAS (group 1) — respiración lenta, per-layer phase + parallax
    const mtBright = 1 + p1 * DBG_SILLAS.mtBrightBoost + kick * DBG_SILLAS.kickExtraBoost;
    const phSpd    = DBG_SILLAS.mtPhaseSpd;
    const mt0Sc = 1 + p1 * DBG_SILLAS.mt0AmpBoost * Math.sin(t_s * phSpd);
    const mt1Sc = 1 + p1 * DBG_SILLAS.mt1AmpBoost * Math.sin(t_s * phSpd + 2.094); // +120°
    const mt2Sc = 1 + p1 * DBG_SILLAS.mt2AmpBoost * Math.sin(t_s * phSpd + 4.189); // +240°
    const azPar = p1 * DBG_SILLAS.mtAzParallax * DEG;
    fondoU.uReveal.value  = eo3(Math.min(1, g1 / 0.6))                     * 1.2 - 0.1;
    fondoU.uBright.value  = mtBright;
    mediasU.uReveal.value = eo3(Math.max(0, Math.min(1, (g1 - 0.2) / 0.6))) * 1.2 - 0.1;
    mediasU.uBright.value = mtBright;
    frenteU.uReveal.value = eo3(Math.max(0, Math.min(1, (g1 - 0.4) / 0.6))) * 1.2 - 0.1;
    frenteU.uBright.value = mtBright;
    if (fondoMeshRef.current)  { fondoMeshRef.current.scale.y  = mt0Sc; fondoMeshRef.current.rotation.y  = azPar * 0.4; }
    if (mediasMeshRef.current) { mediasMeshRef.current.scale.y = mt1Sc; mediasMeshRef.current.rotation.y = azPar * 0.7; }
    if (frenteMeshRef.current) { frenteMeshRef.current.scale.y = mt2Sc; frenteMeshRef.current.rotation.y = azPar; }

    // ── LÍNEAS (group 3) — U5: liquid shader + wave deformation ────────────
    lineU.uReveal.value   = g3 * 1.2 - 0.1;
    lineU.uBright.value   = 1 + p3 * DBG_SILLAS.lineAmpBoost + kick * DBG_SILLAS.kickExtraBoost;
    lineU.uOffset.value   = flowRef.current / (Math.PI * 2);
    lineU.uEnergy.value   = p3;
    lineU.uTime.value     = t_s;
    lineU.uPsyMix.value   = DBG_SILLAS.u5PsyMixMin + p3 * (DBG_SILLAS.u5PsyMixMax - DBG_SILLAS.u5PsyMixMin);
    lineU.uPsyMode.value  = DBG_SILLAS.u5PsyMode ? 1.0 : 0.0;
    lineU.uWaveAmp.value  = DBG_SILLAS.u5WaveAmp;
    lineU.uWaveFreq.value = DBG_SILLAS.u5WaveFreq;
    lineU.uWaveSpd.value  = DBG_SILLAS.u5WaveSpd;
    lineU.uFbmSpd.value   = DBG_SILLAS.u5FbmSpd;

    // ── U9: apply dawn reveal + sector overrides ────────────────────────────
    if (overRev) {
      frenteU.uReveal.value       = dawnFrenteRev;
      mediasU.uReveal.value       = dawnMediasRev;
      fondoU.uReveal.value        = dawnFondoRev;
      lineU.uReveal.value         = dawnLineRev;
      frenteU.uSectorWidth.value  = dawnFrW;
      frenteU.uSectorCenter.value = dawnFrC;
      frenteU.uSectorEdge.value   = dawnEdge;
    }

    // ── U7: visibility flags and magenta mode ─────────────────────────────
    const mgIdx = DBG_SILLAS.u7MagentaIdx;
    fondoU.uMagenta.value  = mgIdx === 5 ? 1 : 0;
    mediasU.uMagenta.value = mgIdx === 6 ? 1 : 0;
    frenteU.uMagenta.value = mgIdx === 7 ? 1 : 0;
    lineU.uMagenta.value   = mgIdx === 8 ? 1 : 0;
    // Visibility: override uOpacity (texture load sets 1; we restore when re-enabled)
    if (!DBG_SILLAS.u7VisMtFondo)  fondoU.uOpacity.value  = 0;
    else if (fondoU.uTex.value)    fondoU.uOpacity.value  = 1;
    if (!DBG_SILLAS.u7VisMtMedias) mediasU.uOpacity.value = 0;
    else if (mediasU.uTex.value)   mediasU.uOpacity.value = 1;
    if (!DBG_SILLAS.u7VisMtFrente) frenteU.uOpacity.value = 0;
    else if (frenteU.uTex.value)   frenteU.uOpacity.value = 1;
    if (!DBG_SILLAS.u7VisLines)    lineU.uOpacity.value   = 0;
    else if (lineU.uTex.value)     lineU.uOpacity.value   = 1;

    // ── CIELO stars (group 2) — centelleo con fase propia ────────────────
    const twFq  = DBG_SILLAS.starTwinkleFq;
    const twAmp = DBG_SILLAS.starTwinkleAmp;
    const starMag = mgIdx === 1;
    for (let i = 0; i < STAR_COUNT; i++) {
      const sp = starSpritesRef.current[i];
      if (!sp) continue;
      if (!DBG_SILLAS.u7VisStars) { sp.material.opacity = 0; continue; }
      const t     = STAR_DATA[i].t;
      const ph    = STAR_DATA[i].rot;
      const freq  = twFq * (0.7 + t * 0.6);
      const osc   = 0.5 + 0.5 * Math.sin(t_s * freq + ph);
      const rev   = THREE.MathUtils.smoothstep(1 - t, 1 - t + 0.1, effG2);
      sp.material.opacity = Math.min(1, rev * (1 + p2 * 0.5 * osc + kick * 0.3)) * dawnStarSc;
      sp.scale.setScalar(STAR_DATA[i].sz * (1 + p2 * twAmp * osc + kick * DBG_SILLAS.u2KickScale));
      sp.material.color.setHex(starMag ? 0xFF00FF : 0xFFFFFF);
    }

    // ── CIELO clouds (group 2) — drift faster with energy ─────────────────
    const cloudMag = mgIdx === 2;
    for (let i = 0; i < CLOUD_COUNT; i++) {
      const sp = cloudSpritesRef.current[i];
      if (!sp) continue;
      if (!DBG_SILLAS.u7VisClouds) { sp.material.opacity = 0; continue; }
      cloudAzRef.current[i] += CLOUD_DATA[i].driftSpeed * (1 + p2 * 3) * dt;
      const az = cloudAzRef.current[i] * DEG;
      const el = CLOUD_DATA[i].el * DEG;
      const sr = DOME_R * 0.94;
      sp.position.set(sr * Math.cos(el) * Math.cos(az), sr * Math.sin(el), sr * Math.cos(el) * Math.sin(az));
      const ct = CLOUD_DATA[i].t;
      sp.material.opacity = THREE.MathUtils.smoothstep(1 - ct, 1 - ct + 0.15, effG2) * (0.75 + p2 * 0.25) * dawnCloudSc;
      sp.material.color.setHex(cloudMag ? 0xFF00FF : 0xFFFFFF);
    }

    // ── U7: sol visibility / magenta ──────────────────────────────────────
    const sunMag = mgIdx === 3;
    if (!DBG_SILLAS.u7VisSun) {
      if (sunAnilloRef.current)  sunAnilloRef.current.material.opacity  = 0;
      if (sunDiscoRef.current)   sunDiscoRef.current.material.opacity   = 0;
      if (sunNucleoRef.current)  sunNucleoRef.current.material.opacity  = 0;
    } else if (sunMag) {
      if (sunAnilloRef.current)  { sunAnilloRef.current.material.color.setHex(0xFF00FF);  sunAnilloRef.current.material.opacity  = sunOp; }
      if (sunDiscoRef.current)   { sunDiscoRef.current.material.color.setHex(0xFF00FF);   sunDiscoRef.current.material.opacity   = sunOp; }
      if (sunNucleoRef.current)  { sunNucleoRef.current.material.color.setHex(0xFF00FF);  sunNucleoRef.current.material.opacity  = coreOp; }
    } else {
      if (sunAnilloRef.current)  sunAnilloRef.current.material.color.setHex(0xFFFFFF);
      if (sunDiscoRef.current)   sunDiscoRef.current.material.color.setHex(0xFFFFFF);
      if (sunNucleoRef.current)  sunNucleoRef.current.material.color.setHex(0xFFFFFF);
    }
  });

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Mountain bands: fondo (bg) < medias < frente (fg) */}
      {/* U3: depthTest=true so panorama is occluded by opaque room geometry.
          renderOrder hierarchy: sky(DomeViz=-1) < stars(0) < clouds(1) < sol(2-3) < mts(4-6) < lines(7).
          Opaque objects (sillas, tarima, piso) write depth → panorama depth-tests against them correctly.
          Transparent 3D objects (haces, floor symbols) must have renderOrder>7. */}

      {/* Stars: 120 sprites — behind mountains (lower rO) */}
      {STAR_DATA.map((s, i) => (
        <sprite key={`star-${i}`}
          ref={(sp: THREE.Sprite | null) => { if (sp) starSpritesRef.current[i] = sp; }}
          position={s.pos}
          scale={[s.sz, s.sz, 1]}
          renderOrder={0}
          frustumCulled={false}
        >
          <spriteMaterial transparent opacity={0}
            depthTest={true} depthWrite={false} toneMapped={false} rotation={s.rot} />
        </sprite>
      ))}

      {/* Clouds: 10 sprites — above stars, below mountains */}
      {CLOUD_DATA.map((c, i) => {
        const e = c.el * DEG, a = c.az0 * DEG, sr = DOME_R * 0.94;
        return (
          <sprite key={`cloud-${i}`}
            ref={(sp: THREE.Sprite | null) => { if (sp) cloudSpritesRef.current[i] = sp; }}
            position={[sr * Math.cos(e) * Math.cos(a), sr * Math.sin(e), sr * Math.cos(e) * Math.sin(a)]}
            scale={[c.sz, c.sz, 1]}
            renderOrder={1}
            frustumCulled={false}
          >
            <spriteMaterial transparent opacity={0}
              depthTest={true} depthWrite={false} toneMapped={false} />
          </sprite>
        );
      })}

      {/* Sun: 3 concentric sprites — above clouds, below mountains (partial occlusion OK) */}
      <sprite ref={sunAnilloRef} scale={[SUN_RING_SZ,   SUN_RING_SZ,   1]} renderOrder={2} frustumCulled={false}>
        <spriteMaterial transparent opacity={0} depthTest={true} depthWrite={false} toneMapped={false} />
      </sprite>
      <sprite ref={sunDiscoRef}  scale={[SUN_DISCO_SZ,  SUN_DISCO_SZ,  1]} renderOrder={2} frustumCulled={false}>
        <spriteMaterial transparent opacity={0} depthTest={true} depthWrite={false} toneMapped={false} />
      </sprite>
      <sprite ref={sunNucleoRef} scale={[SUN_NUCLEO_SZ, SUN_NUCLEO_SZ, 1]} renderOrder={3} frustumCulled={false}>
        <spriteMaterial transparent opacity={0} depthTest={true} depthWrite={false} toneMapped={false} />
      </sprite>

      {/* Mountain bands: fondo (bg) < medias < frente (fg) */}
      <mesh ref={fondoMeshRef} frustumCulled={false} renderOrder={4}>
        <sphereGeometry args={[DOME_R * 0.98, 256, 32, 0, Math.PI * 2, MT_T0, MT_TL]} />
        <shaderMaterial vertexShader={BAND_VERT} fragmentShader={BAND_FRAG}
          uniforms={fondoU}
          side={THREE.BackSide} transparent depthTest={true} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={mediasMeshRef} frustumCulled={false} renderOrder={5}>
        <sphereGeometry args={[DOME_R * 0.98, 256, 32, 0, Math.PI * 2, MT_T0, MT_TL]} />
        <shaderMaterial vertexShader={BAND_VERT} fragmentShader={BAND_FRAG}
          uniforms={mediasU}
          side={THREE.BackSide} transparent depthTest={true} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={frenteMeshRef} frustumCulled={false} renderOrder={6}>
        <sphereGeometry args={[DOME_R * 0.98, 256, 32, 0, Math.PI * 2, MT_T0, MT_TL]} />
        <shaderMaterial vertexShader={BAND_VERT} fragmentShader={BAND_FRAG}
          uniforms={frenteU}
          side={THREE.BackSide} transparent depthTest={true} depthWrite={false} toneMapped={false} />
      </mesh>

      {/* Lines band — U5: liquid psychedelic shader */}
      <mesh frustumCulled={false} renderOrder={7}>
        <sphereGeometry args={[DOME_R * 0.98, 256, 16, 0, Math.PI * 2, LN_T0, LN_TL]} />
        <shaderMaterial vertexShader={BAND_VERT} fragmentShader={LINE_FRAG}
          uniforms={lineU}
          side={THREE.BackSide} transparent depthTest={true} depthWrite={false} toneMapped={false} />
      </mesh>
    </>
  );
}
