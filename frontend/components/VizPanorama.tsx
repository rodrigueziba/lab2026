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
  uniform float uReveal;  // -0.1=nothing, 1.1=fully revealed
  uniform float uOpacity; // global fade (0 until texture loads)
  uniform float uBright;  // audio brightness boost (1.0 = no boost)
  uniform float uOffset;  // horizontal scroll 0–1 (seamless, for lines)
  varying vec2 vUv;
  void main() {
    vec2 uv = vec2(fract(vUv.x + uOffset), vUv.y);
    vec4 c  = texture2D(uTex, uv);
    float m = 1.0 - smoothstep(uReveal - 0.06, uReveal + 0.06, uv.y);
    gl_FragColor = vec4(c.rgb * uBright, c.a * m * uOpacity);
  }
`;

// ── Band uniform factory ──────────────────────────────────────────────────────
interface BandUni {
  [k: string]: THREE.IUniform;
  uTex:     THREE.IUniform<THREE.Texture | null>;
  uReveal:  THREE.IUniform<number>;
  uOpacity: THREE.IUniform<number>;
  uBright:  THREE.IUniform<number>;
  uOffset:  THREE.IUniform<number>;
}
const mkBU = (): BandUni => ({
  uTex: { value: null }, uReveal: { value: -0.1 },
  uOpacity: { value: 0 }, uBright: { value: 1 }, uOffset: { value: 0 },
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
  pulseRef: React.MutableRefObject<number[]>;
  flowRef:  React.MutableRefObject<number>;
  kickRef:  React.MutableRefObject<number>;
}

export default function VizPanorama({ growRef, pulseRef, flowRef, kickRef }: VizPanoramaProps) {
  const { gl } = useThree();
  const maxAniso = useMemo(() => gl.capabilities.getMaxAnisotropy(), [gl]);

  // ── Band uniforms — lazy-init null pattern (same as DomeVisualizer skyUniformsRef)
  // Avoids react-hooks/refs and react-hooks/immutability while keeping objects stable.
  const fondoURef  = useRef<BandUni | null>(null);
  const mediasURef = useRef<BandUni | null>(null);
  const frenteURef = useRef<BandUni | null>(null);
  const lineURef   = useRef<BandUni | null>(null);
  if (fondoURef.current == null)  fondoURef.current  = mkBU();
  if (mediasURef.current == null) mediasURef.current = mkBU();
  if (frenteURef.current == null) frenteURef.current = mkBU();
  if (lineURef.current == null)   lineURef.current   = mkBU();
  const fondoU  = fondoURef.current;
  const mediasU = mediasURef.current;
  const frenteU = frenteURef.current;
  const lineU   = lineURef.current;

  // ── Mountain mesh refs (for Y scale in useFrame) ─────────────────────────
  const fondoMeshRef  = useRef<THREE.Mesh | null>(null);
  const mediasMeshRef = useRef<THREE.Mesh | null>(null);
  const frenteMeshRef = useRef<THREE.Mesh | null>(null);

  // ── Cloud current azimuths (mutable, no React state) ─────────────────────
  const cloudAzRef = useRef(CLOUD_DATA.map(c => c.az0));

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
  useFrame((_, dt) => {
    const gr   = growRef.current;
    const pu   = pulseRef.current;
    const kick = kickRef.current;

    // Eased grow values (respect debug force overrides)
    const g0 = eo3(DBG_SILLAS.vizGrowForce0 >= 0 ? DBG_SILLAS.vizGrowForce0 : gr[0]);
    const g1 = eo3(DBG_SILLAS.vizGrowForce1 >= 0 ? DBG_SILLAS.vizGrowForce1 : gr[1]);
    const g2 = eo3(DBG_SILLAS.vizGrowForce2 >= 0 ? DBG_SILLAS.vizGrowForce2 : gr[2]);
    const g3 = eo3(DBG_SILLAS.vizGrowForce3 >= 0 ? DBG_SILLAS.vizGrowForce3 : gr[3]);

    // ── Mountains (group 1) — staggered bottom-to-top reveal + Y scale ─
    // uReveal = -0.1 (nothing) … 1.1 (fully revealed)
    const p1 = pu[1];
    const mtBright = 1 + p1 * DBG_SILLAS.mtBrightBoost + kick * DBG_SILLAS.kickExtraBoost;
    const mtSc     = 1 + p1 * DBG_SILLAS.mtHeightBoost  + kick * DBG_SILLAS.u2KickScale;
    fondoU.uReveal.value  = eo3(Math.min(1, g1 / 0.6))                     * 1.2 - 0.1;
    fondoU.uBright.value  = mtBright;
    mediasU.uReveal.value = eo3(Math.max(0, Math.min(1, (g1 - 0.2) / 0.6))) * 1.2 - 0.1;
    mediasU.uBright.value = mtBright;
    frenteU.uReveal.value = eo3(Math.max(0, Math.min(1, (g1 - 0.4) / 0.6))) * 1.2 - 0.1;
    frenteU.uBright.value = mtBright;
    if (fondoMeshRef.current)  fondoMeshRef.current.scale.y  = mtSc;
    if (mediasMeshRef.current) mediasMeshRef.current.scale.y = mtSc;
    if (frenteMeshRef.current) frenteMeshRef.current.scale.y = mtSc;

    // ── Lines (group 3) — scroll + amplitude brightness ─────────────────
    lineU.uReveal.value  = g3 * 1.2 - 0.1;
    lineU.uBright.value  = 1 + pu[3] * DBG_SILLAS.lineAmpBoost + kick * DBG_SILLAS.kickExtraBoost;
    lineU.uOffset.value  = flowRef.current / (Math.PI * 2);

    // ── Stars (group 2) — top-down reveal + scale + brightness ──────────
    const p2 = pu[2];
    for (let i = 0; i < STAR_COUNT; i++) {
      const sp = starSpritesRef.current[i];
      if (!sp) continue;
      const t   = STAR_DATA[i].t;
      const rev = THREE.MathUtils.smoothstep(1 - t, 1 - t + 0.1, g2);
      sp.material.opacity = Math.min(1, rev * (1 + p2 * 0.6 + kick * 0.3));
      sp.scale.setScalar(STAR_DATA[i].sz * (1 + p2 * DBG_SILLAS.u2StarScaleBoost + kick * DBG_SILLAS.u2KickScale));
    }

    // ── Clouds (group 2) — drift + reveal ────────────────────────────────
    for (let i = 0; i < CLOUD_COUNT; i++) {
      const sp = cloudSpritesRef.current[i];
      if (!sp) continue;
      cloudAzRef.current[i] += CLOUD_DATA[i].driftSpeed * dt;
      const az = cloudAzRef.current[i] * DEG;
      const el = CLOUD_DATA[i].el * DEG;
      const sr = DOME_R * 0.94;
      sp.position.set(sr * Math.cos(el) * Math.cos(az), sr * Math.sin(el), sr * Math.cos(el) * Math.sin(az));
      const ct = CLOUD_DATA[i].t;
      sp.material.opacity = THREE.MathUtils.smoothstep(1 - ct, 1 - ct + 0.15, g2) * 0.85;
    }

    // ── Sun (group 0) — rises from horizon + scale pulse ─────────────────
    const p0  = pu[0];
    const sunEl  = VIZ_SUN_EL_DEG * g0 * DEG;
    const sunAz  = SUN_AZ_RAD;
    const sunPX  = SUN_R * Math.cos(sunEl) * Math.cos(sunAz);
    const sunPY  = SUN_R * Math.sin(sunEl);
    const sunPZ  = SUN_R * Math.cos(sunEl) * Math.sin(sunAz);
    const sunOp  = Math.min(1, THREE.MathUtils.smoothstep(0, 0.15, g0) * (1 + p0 * DBG_SILLAS.sunBrightBoost + kick * 0.3));
    const ringSz = SUN_RING_SZ   * (1 + p0 * DBG_SILLAS.u2SunRingBoost  + kick * DBG_SILLAS.u2KickScale);
    const discSz = SUN_DISCO_SZ  * (1 + p0 * DBG_SILLAS.u2SunDiscBoost  + kick * DBG_SILLAS.u2KickScale * 0.8);
    const coreSz = SUN_NUCLEO_SZ * (1 + p0 * DBG_SILLAS.u2SunCoreBoost  + kick * DBG_SILLAS.u2KickScale * 1.2);
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
      sunNucleoRef.current.material.opacity = sunOp;
      sunNucleoRef.current.scale.set(coreSz, coreSz, 1);
    }
  });

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Mountain bands: fondo (bg) < medias < frente (fg) */}
      <mesh ref={fondoMeshRef} frustumCulled={false} renderOrder={2}>
        <sphereGeometry args={[DOME_R * 0.98, 256, 32, 0, Math.PI * 2, MT_T0, MT_TL]} />
        <shaderMaterial vertexShader={BAND_VERT} fragmentShader={BAND_FRAG}
          uniforms={fondoU}
          side={THREE.BackSide} transparent depthTest={false} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={mediasMeshRef} frustumCulled={false} renderOrder={3}>
        <sphereGeometry args={[DOME_R * 0.98, 256, 32, 0, Math.PI * 2, MT_T0, MT_TL]} />
        <shaderMaterial vertexShader={BAND_VERT} fragmentShader={BAND_FRAG}
          uniforms={mediasU}
          side={THREE.BackSide} transparent depthTest={false} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={frenteMeshRef} frustumCulled={false} renderOrder={4}>
        <sphereGeometry args={[DOME_R * 0.98, 256, 32, 0, Math.PI * 2, MT_T0, MT_TL]} />
        <shaderMaterial vertexShader={BAND_VERT} fragmentShader={BAND_FRAG}
          uniforms={frenteU}
          side={THREE.BackSide} transparent depthTest={false} depthWrite={false} toneMapped={false} />
      </mesh>

      {/* Lines band */}
      <mesh frustumCulled={false} renderOrder={5}>
        <sphereGeometry args={[DOME_R * 0.98, 256, 16, 0, Math.PI * 2, LN_T0, LN_TL]} />
        <shaderMaterial vertexShader={BAND_VERT} fragmentShader={BAND_FRAG}
          uniforms={lineU}
          side={THREE.BackSide} transparent depthTest={false} depthWrite={false} toneMapped={false} />
      </mesh>

      {/* Stars: 120 sprites (initially invisible, texture loaded async) */}
      {STAR_DATA.map((s, i) => (
        <sprite key={`star-${i}`}
          ref={(sp: THREE.Sprite | null) => { if (sp) starSpritesRef.current[i] = sp; }}
          position={s.pos}
          scale={[s.sz, s.sz, 1]}
          renderOrder={0}
          frustumCulled={false}
        >
          <spriteMaterial transparent opacity={0}
            depthTest={false} depthWrite={false} toneMapped={false} rotation={s.rot} />
        </sprite>
      ))}

      {/* Clouds: 10 sprites (position updated in useFrame) */}
      {CLOUD_DATA.map((c, i) => {
        const e = c.el * DEG, a = c.az0 * DEG, sr = DOME_R * 0.94;
        return (
          <sprite key={`cloud-${i}`}
            ref={(sp: THREE.Sprite | null) => { if (sp) cloudSpritesRef.current[i] = sp; }}
            position={[sr * Math.cos(e) * Math.cos(a), sr * Math.sin(e), sr * Math.cos(e) * Math.sin(a)]}
            scale={[c.sz, c.sz, 1]}
            renderOrder={0}
            frustumCulled={false}
          >
            <spriteMaterial transparent opacity={0}
              depthTest={false} depthWrite={false} toneMapped={false} />
          </sprite>
        );
      })}

      {/* Sun: 3 concentric sprites (position updated in useFrame) */}
      <sprite ref={sunAnilloRef} scale={[SUN_RING_SZ,   SUN_RING_SZ,   1]} renderOrder={1} frustumCulled={false}>
        <spriteMaterial transparent opacity={0} depthTest={false} depthWrite={false} toneMapped={false} />
      </sprite>
      <sprite ref={sunDiscoRef}  scale={[SUN_DISCO_SZ,  SUN_DISCO_SZ,  1]} renderOrder={1} frustumCulled={false}>
        <spriteMaterial transparent opacity={0} depthTest={false} depthWrite={false} toneMapped={false} />
      </sprite>
      <sprite ref={sunNucleoRef} scale={[SUN_NUCLEO_SZ, SUN_NUCLEO_SZ, 1]} renderOrder={1} frustumCulled={false}>
        <spriteMaterial transparent opacity={0} depthTest={false} depthWrite={false} toneMapped={false} />
      </sprite>
    </>
  );
}
