"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PRISM_POS_UNIFORM, PRISM_RAINBOW_UNIFORM, PRISM_ROT_UNIFORM } from "@/lib/prismUniforms";
import DomeVisualizer from "./DomeVisualizer";
import FloorVisualizer from "./FloorVisualizer";
import SectorAudioFX from "./SectorAudioFX";
import { DBG_SILLAS } from "@/lib/debugConfig";

const API_URL    = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
const DOME_R     = 28;
const MAX_PANELS = 60;
const PANEL_SCALE = 1.5; // G4: multiply panel dimensions by this factor
const CACHE_KEY  = "alight:media-urls";

// ── Minimal shapes from the project's data layer ──────────────────────────────
interface Proyecto  { foto?: string; galeria?: string[]; referencias?: string[] }
interface Prestador { foto?: string | null }

// ── Data helpers ──────────────────────────────────────────────────────────────
function getYoutubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([^&\n?#]{11})/);
  return m ? m[1] : null;
}

function extractUrls(ps: Proyecto[], pr: Prestador[]): string[] {
  const seen = new Set<string>();
  const add  = (u?: string | null) => { if (u) seen.add(u); };
  ps.forEach(p => {
    add(p.foto);
    p.galeria?.forEach(add);
    p.referencias?.forEach(r => {
      const id = getYoutubeId(r);
      if (id) add(`https://img.youtube.com/vi/${id}/hqdefault.jpg`);
    });
  });
  pr.forEach(p => add(p.foto));
  return [...seen];
}

// ── Orbital ring layout ────────────────────────────────────────────────────────
// G5: 9 rings in a 3×3 grid — 3 vertical heights × 3 depth radii.
// Each ring's tilt, azimuth, and spin speed/direction are randomised inside useMemo
// → different every page load, stable for the session.

interface OrbitData {
  centerY: number;
  tiltX:   number;
  tiltZ:   number;
  azimuth: number;
  speed:   number;
  panels:  { pos: THREE.Vector3; url: string; staggerSec: number }[];
}

interface OrbitBand { count: number; centerY: number; rFactor: number; }

// 3 heights (7, 10, 13 m) × 3 radii (0.82, 0.89, 0.96 × DOME_R)
// Panel counts: 7+7+6 per depth level × 3 levels = 60 total
const ORBIT_BANDS: OrbitBand[] = [
  { count: 7, centerY:  7, rFactor: 0.82 },
  { count: 7, centerY: 10, rFactor: 0.82 },
  { count: 6, centerY: 13, rFactor: 0.82 },
  { count: 7, centerY:  7, rFactor: 0.89 },
  { count: 7, centerY: 10, rFactor: 0.89 },
  { count: 6, centerY: 13, rFactor: 0.89 },
  { count: 7, centerY:  7, rFactor: 0.96 },
  { count: 7, centerY: 10, rFactor: 0.96 },
  { count: 6, centerY: 13, rFactor: 0.96 },
];

function buildOrbits(urls: string[]): OrbitData[] {
  let urlIdx     = 0;
  let staggerIdx = 0;

  return ORBIT_BANDS.map(({ count, centerY, rFactor }) => {
    const available = Math.min(count, urls.length - urlIdx);
    if (available <= 0) return null;

    const radius   = DOME_R * rFactor;
    const maxTiltX = Math.asin(Math.min(1, (centerY - 1) / radius));
    const tiltX    = Math.random() * maxTiltX;
    const tiltZ    = (Math.random() - 0.5) * 0.25;
    const azimuth  = Math.random() * Math.PI * 2;
    const speed    = (Math.random() * 0.00025 + 0.00008)
                   * (Math.random() > 0.5 ? 1 : -1);

    const panels = Array.from({ length: available }, (_, i) => {
      const angle = (i / available) * Math.PI * 2;
      return {
        pos: new THREE.Vector3(
          radius * Math.cos(angle),
          0,
          radius * Math.sin(angle),
        ),
        url:        urls[urlIdx++] ?? "",
        staggerSec: staggerIdx++ * 0.12,
      };
    });

    return { centerY, tiltX, tiltZ, azimuth, speed, panels } as OrbitData;
  }).filter((d): d is OrbitData => d !== null);
}

// ── GLSL helpers shared by panel + dome-shell shaders ─────────────────────────
const RAINBOW_GLSL = /* glsl */`
  vec3 hsl2rgb(float h, float s, float l) {
    vec3 p = abs(fract(h + vec3(1.0, 2.0/3.0, 1.0/3.0)) * 6.0 - 3.0);
    return l + s * (clamp(p - 1.0, 0.0, 1.0) - 0.5) * (1.0 - abs(2.0 * l - 1.0));
  }
  vec3 rotAround(vec3 v, vec3 k, float a) {
    float ca = cos(a), sa = sin(a);
    return v * ca + cross(k, v) * sa + k * dot(k, v) * (1.0 - ca);
  }
`;

// ── Panel shaders ──────────────────────────────────────────────────────────────
// Texture is only visible where a rainbow beam illuminates the panel.
// Dark everywhere else — creating a Pink Floyd-style projector effect.
const VERT = /* glsl */`
  varying vec2 vUv;
  varying vec3 vWorldPos;
  void main() {
    vUv = uv;
    vec4 wp   = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = RAINBOW_GLSL + /* glsl */`
  uniform sampler2D uMap;
  uniform float     uReveal;
  uniform vec3      uPrismPos;
  uniform float     uRainbow;
  uniform float     uPrismRot;
  varying vec2 vUv;
  varying vec3 vWorldPos;

  void main() {
    float gate = smoothstep(0.0, 0.05, uReveal);
    vec4  tex  = texture2D(uMap, vUv);
    vec3  col  = vec3(0.002, 0.001, 0.004);

    if (gate >= 0.01) {
      if (uRainbow < 0.005) {
        col = tex.rgb * 0.018 * gate;
      } else {
        // ── Outward radial beams ──────────────────────────────────────────────
        // 7 beams fan outward from the prism horizontally.
        // uPrismRot rotates the fan's central azimuth → beams sweep around dome.
        // el = 18° elevation so beams point toward panels at heights 6-14m, r≈25m.
        float az = uPrismRot;
        float el = 0.32;  // ~18° elevation
        vec3  centBeam = vec3(cos(el) * cos(az), sin(el), cos(el) * sin(az));

        vec3  toFrag = normalize(vWorldPos - uPrismPos);
        float dist   = length(vWorldPos - uPrismPos);
        float dFade  = exp(-dist * 0.010);

        float totalStr = 0.0;
        vec3  beamTint = vec3(0.0);
        for (int i = 0; i < 7; i++) {
          float t      = float(i) / 6.0;           // 0=red … 1=violet
          float sweep  = mix(-0.38, 0.38, t);       // ±22° horizontal dispersion
          vec3  beam   = rotAround(centBeam, vec3(0.0, 1.0, 0.0), sweep);
          float align  = dot(toFrag, beam);
          float bOuter = smoothstep(0.984, 0.998, align);
          float bInner = smoothstep(0.998, 1.000, align);
          float b      = (bOuter * 0.6 + bInner * 1.4) * dFade;
          totalStr    += b;
          beamTint    += hsl2rgb(t, 0.65, 0.65) * b;
        }
        totalStr = clamp(totalStr * uRainbow, 0.0, 1.0);
        beamTint = clamp(beamTint * uRainbow, 0.0, 1.0);

        vec3 lit  = tex.rgb + beamTint * 0.22;
        vec3 dark = tex.rgb * 0.018;
        col = mix(dark, lit, totalStr) * gate;
      }
    }

    gl_FragColor = vec4(col, 1.0);
  }
`;

// ── Dome-shell shaders (rainbow beams on dark background, no texture) ──────────
const SHELL_VERT = /* glsl */`
  varying vec3 vWorldPos;
  void main() {
    vec4 wp   = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SHELL_FRAG = RAINBOW_GLSL + /* glsl */`
  uniform vec3  uPrismPos;
  uniform float uRainbow;
  uniform float uPrismRot;
  uniform float uShellOpacity;
  varying vec3  vWorldPos;

  void main() {
    vec3 bg      = vec3(0.004, 0.002, 0.010);
    vec3 rainbow = vec3(0.0);

    if (uRainbow >= 0.005) {
      float az = uPrismRot;
      float el = 0.32;
      vec3  centBeam = vec3(cos(el) * cos(az), sin(el), cos(el) * sin(az));

      vec3  toFrag = normalize(vWorldPos - uPrismPos);
      float dist   = length(vWorldPos - uPrismPos);
      float dFade  = exp(-dist * 0.010);

      for (int i = 0; i < 7; i++) {
        float t      = float(i) / 6.0;
        float sweep  = mix(-0.38, 0.38, t);
        vec3  beam   = rotAround(centBeam, vec3(0.0, 1.0, 0.0), sweep);
        float align  = dot(toFrag, beam);
        float bOuter = smoothstep(0.984, 0.998, align);
        float bInner = smoothstep(0.998, 1.000, align);
        float b      = (bOuter * 0.6 + bInner * 1.4) * dFade;
        rainbow     += hsl2rgb(t, 1.0, 0.55) * b;
      }
      rainbow = clamp(rainbow * uRainbow * 1.8, 0.0, 1.0);
    }

    gl_FragColor = vec4(bg + rainbow, uShellOpacity);
  }
`;

// Dome shell uniforms — module-level so the reference is stable across renders.
const DOME_SHELL_UNIFORMS = {
  uPrismPos:    PRISM_POS_UNIFORM,
  uRainbow:     PRISM_RAINBOW_UNIFORM,
  uPrismRot:    PRISM_ROT_UNIFORM,
  uShellOpacity: { value: 1.0 }, // S3: fades to DBG_SILLAS.domeShellOpacity when visualizer active
};

// ── PanelMesh ─────────────────────────────────────────────────────────────────
interface PanelProps {
  position:    THREE.Vector3;
  url:         string;
  staggerSec:  number;
  activatedRef: { current: number | null };
}

const texLoader = new THREE.TextureLoader();

function PanelMesh({ position, url, staggerSec, activatedRef }: PanelProps) {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  // Rotate PlaneGeometry's +Z normal so the panel face points toward [0,0,0]
  const quaternion = useMemo(() => {
    const inward = position.clone().negate().normalize();
    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), inward);
  }, [position]);

  // Stable uniforms — same object reference across renders so R3F won't re-apply.
  // uPrismPos / uRainbow are shared module-level objects; Three.js reads their
  // .value every render, so Prism.tsx mutations propagate to all 60 panels automatically.
  const uniforms = useMemo(() => ({
    uMap:      { value: new THREE.Texture() },
    uReveal:   { value: 0.0 },
    uPrismPos: PRISM_POS_UNIFORM,
    uRainbow:  PRISM_RAINBOW_UNIFORM,
    uPrismRot: PRISM_ROT_UNIFORM,
  }), []);

  // Async texture load — only touches the uniform, never touches React state
  useEffect(() => {
    let live = true;
    texLoader.load(url, (tex) => {
      if (!live || !matRef.current) return;
      tex.colorSpace = THREE.SRGBColorSpace;
      matRef.current.uniforms.uMap.value = tex;
    });
    return () => { live = false; };
  }, [url]);

  // Reveal is driven purely in useFrame — no state, no re-renders
  useFrame(() => {
    const mat = matRef.current;
    if (!mat || activatedRef.current === null) return;
    const elapsed = (Date.now() - activatedRef.current) / 1000 - staggerSec;
    if (elapsed > 0 && mat.uniforms.uReveal.value < 1) {
      mat.uniforms.uReveal.value = Math.min(1, mat.uniforms.uReveal.value + 0.007);
    }
  });

  return (
    <mesh position={position} quaternion={quaternion}>
      <planeGeometry args={[3.6 * PANEL_SCALE, 2.4 * PANEL_SCALE]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
      />
    </mesh>
  );
}

// ── OrbitRing ─────────────────────────────────────────────────────────────────
// A group of panels orbiting at a fixed height, spinning around Y each frame.
// The initial rotation [tiltX, azimuth, tiltZ] tilts the orbital plane so panels
// spread across different elevations.  The panel quaternions (facing local [0,0,0])
// correctly track the dome center as the group rotates because the orbit is
// centered on the dome origin — group rotation preserves [0,0,0].
function OrbitRing({
  data,
  activatedRef,
}: {
  data: OrbitData;
  activatedRef: { current: number | null };
}) {
  const groupRef = useRef<THREE.Group>(null!);

  useFrame(() => {
    if (groupRef.current) groupRef.current.rotation.y += data.speed;
  });

  return (
    <group
      ref={groupRef}
      position={[0, data.centerY, 0]}
      rotation={[data.tiltX, data.azimuth, data.tiltZ]}
    >
      {data.panels.map((p, i) => (
        <PanelMesh
          key={i}
          position={p.pos}
          url={p.url}
          staggerSec={p.staggerSec}
          activatedRef={activatedRef}
        />
      ))}
    </group>
  );
}

// ── ExperienceDome ────────────────────────────────────────────────────────────
export default function ExperienceDome() {
  const [urls, setUrls]       = useState<string[]>([]);
  const [vizActive, setVizActive] = useState(false); // mounts DomeVisualizer only when true
  const activatedRef          = useRef<number | null>(null);
  const vizActiveRef          = useRef(false); // for useFrame (avoids state read per frame)

  // Fetch both endpoints; sessionStorage prevents duplicate requests when the
  // user navigated through /proyectos or /guia first (same base data).
  useEffect(() => {
    try {
      const hit = sessionStorage.getItem(CACHE_KEY);
      if (hit) { setUrls(JSON.parse(hit)); return; }
    } catch { /* SSR / restricted context */ }

    Promise.all([
      fetch(`${API_URL}/proyecto`).then(r => r.json()),
      fetch(`${API_URL}/prestador`).then(r => r.json()),
    ])
      .then(([proyectos, prestadores]: [Proyecto[], Prestador[]]) => {
        const extracted = extractUrls(proyectos, prestadores);
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(extracted)); } catch { /* ok */ }
        setUrls(extracted);
      })
      .catch(() => { /* dome renders fine with 0 panels */ });
  }, []);

  // Activation sequence:
  // 1) Prism finishes descending → "alight:prism-landed" fires
  // 2) Immediately → panels start lighting up one by one (staggered)
  // 3) After all panels reveal + dome-reveal animation → "alight:dome-revealed" fires
  //    → Player.useFrame re-enables WASD movement
  //
  // Timing math: 60 panels × 120ms stagger + ~2600ms last-panel reveal ≈ 9.8s
  useEffect(() => {
    // prism-landed → start panel reveal sequence only (NOT the visualizer)
    const onLanded = () => {
      if (activatedRef.current !== null) return;
      activatedRef.current = Date.now();
      setTimeout(() => window.dispatchEvent(new CustomEvent("alight:dome-revealed")), 9_800);
    };
    // visualizer-activate → begin shell fade + mount DomeVisualizer
    const onVizOn  = () => { vizActiveRef.current = true;  setVizActive(true); };
    const onVizOff = () => {
      vizActiveRef.current = false;
      setVizActive(false);
      // opacity fades back to 1.0 via useFrame lerp — no jump-reset here
    };
    window.addEventListener("alight:prism-landed",          onLanded);
    window.addEventListener("alight:visualizer-activate",   onVizOn);
    window.addEventListener("alight:visualizer-deactivate", onVizOff);
    return () => {
      window.removeEventListener("alight:prism-landed",          onLanded);
      window.removeEventListener("alight:visualizer-activate",   onVizOn);
      window.removeEventListener("alight:visualizer-deactivate", onVizOff);
    };
  }, []);

  const shellRef = useRef<THREE.Mesh>(null);

  // G1: animate shell opacity in both directions; hide shell when vizHideShell debug flag set
  useFrame((_, dt) => {
    if (shellRef.current) {
      shellRef.current.visible = !DBG_SILLAS.vizHideShell;
    }
    const target = vizActiveRef.current ? DBG_SILLAS.domeShellOpacity : 1.0;
    const cur    = DOME_SHELL_UNIFORMS.uShellOpacity.value;
    if (Math.abs(cur - target) > 0.001) {
      DOME_SHELL_UNIFORMS.uShellOpacity.value = THREE.MathUtils.lerp(cur, target, dt * 5);
    }
  });

  // Build orbital layout once per URL set — Math.random() inside ensures each
  // page load gets a unique arrangement of orbits, speeds, and directions.
  const orbits = useMemo(() => buildOrbits(urls.slice(0, MAX_PANELS)), [urls]);

  return (
    <group>
      {/* S3/H2: only mounted when visualizer is active */}
      {vizActive && <DomeVisualizer />}
      {vizActive && <FloorVisualizer />}
      {vizActive && <SectorAudioFX />}

      {/* Dome shell — upper hemisphere, BackSide.
          thetaLength=0.52π puts the open rim at y≈-2 (below floor level) so
          the rim is never visible to the player.
          G1: depthWrite=false prevents shell from occluding DomeVisualizer sphere.
          opacity lerps to 0 when visualizer active (domeShellOpacity default=0). */}
      <mesh ref={shellRef}>
        <sphereGeometry args={[DOME_R + 2, 48, 32, 0, Math.PI * 2, 0, Math.PI * 0.52]} />
        <shaderMaterial
          vertexShader={SHELL_VERT}
          fragmentShader={SHELL_FRAG}
          uniforms={DOME_SHELL_UNIFORMS}
          side={THREE.BackSide}
          transparent
          depthWrite={false}
        />
      </mesh>

      {orbits.map((orb, i) => (
        <OrbitRing key={i} data={orb} activatedRef={activatedRef} />
      ))}
    </group>
  );
}
