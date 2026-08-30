"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PRISM_POS_UNIFORM, PRISM_RAINBOW_UNIFORM } from "@/lib/prismUniforms";

const API_URL    = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
const DOME_R     = 28;
const MAX_PANELS = 60;
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
// 6 rings, each with a fixed height band, random tilt, random spin speed/direction.
// All random values come from Math.random() inside useMemo → different every page
// load, stable for the session.

interface OrbitData {
  centerY: number;                // world-Y center of this ring
  tiltX:   number;               // inclination around X (rad, constrained so panels stay above floor)
  tiltZ:   number;               // secondary tilt (rad)
  azimuth: number;               // initial rotation around Y (rad)
  speed:   number;               // rotation speed per frame (rad, signed = direction)
  panels:  { pos: THREE.Vector3; url: string; staggerSec: number }[];
}

// Height bands spread across the room (6–14 m), panel counts sum to MAX_PANELS
const ORBIT_BANDS = [
  { count: 10, centerY:  6 },
  { count: 11, centerY: 10 },
  { count: 11, centerY: 14 },
  { count:  9, centerY: 12 },
  { count: 10, centerY:  8 },
  { count:  9, centerY: 11 },
] as const;

function buildOrbits(urls: string[]): OrbitData[] {
  let urlIdx     = 0;
  let staggerIdx = 0;

  return ORBIT_BANDS.map(({ count, centerY }) => {
    const available = Math.min(count, urls.length - urlIdx);
    if (available <= 0) return null;

    const radius   = DOME_R * (0.82 + Math.random() * 0.12);        // 23–26.5 m
    // max tilt so the lowest panel stays ≥1 m above the floor
    const maxTiltX = Math.asin(Math.min(1, (centerY - 1) / radius));
    const tiltX    = Math.random() * maxTiltX;
    const tiltZ    = (Math.random() - 0.5) * 0.25;                  // ±0.12 rad
    const azimuth  = Math.random() * Math.PI * 2;
    const speed    = (Math.random() * 0.00025 + 0.00008)             // 0.00008–0.00033 rad/frame
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
// hsl2rgb: branch-free conversion via fract/clamp.
// rotAround: Rodrigues rotation — rotate v around unit axis k by angle a.
// calcRainbow: 7 ROYGBIV beams fanning out from the prism via Snell dispersion.
//   scale controls per-surface intensity (panels = 2.5, shell = 1.8).
const RAINBOW_GLSL = /* glsl */`
  vec3 hsl2rgb(float h, float s, float l) {
    vec3 p = abs(fract(h + vec3(1.0, 2.0/3.0, 1.0/3.0)) * 6.0 - 3.0);
    return l + s * (clamp(p - 1.0, 0.0, 1.0) - 0.5) * (1.0 - abs(2.0 * l - 1.0));
  }
  vec3 rotAround(vec3 v, vec3 k, float a) {
    float ca = cos(a), sa = sin(a);
    return v * ca + cross(k, v) * sa + k * dot(k, v) * (1.0 - ca);
  }
  vec3 calcRainbow(vec3 fragPos, vec3 prismPos, float strength, float scale) {
    if (strength < 0.001) return vec3(0.0);
    // Direction the spotlight beam travels (source → prism)
    vec3 inRay  = normalize(prismPos - vec3(9.0, 18.0, 10.0));
    // Horizontal axis perpendicular to the incoming ray — rainbow fans around it
    vec3 rawAx  = cross(inRay, vec3(0.0, 1.0, 0.0));
    vec3 dispAx = length(rawAx) > 0.001 ? normalize(rawAx) : vec3(1.0, 0.0, 0.0);
    vec3 toFrag = normalize(fragPos - prismPos);
    float dist  = length(fragPos - prismPos);
    float dFade = exp(-dist * 0.012);   // gentle distance falloff
    vec3 out_   = vec3(0.0);
    for (int i = 0; i < 7; i++) {
      float t     = float(i) / 6.0;          // 0 = red, 1 = violet
      float angle = mix(-0.42, 0.42, t);     // ±0.42 rad dispersion fan
      vec3  beam  = rotAround(inRay, dispAx, angle);
      float align = dot(toFrag, beam);
      float bp    = smoothstep(0.9992, 1.0, align);      // tight beam core (~2°)
      float bg    = pow(max(0.0, align), 48.0) * 0.25;   // soft glow halo
      out_       += hsl2rgb(t, 1.0, 0.55) * (bp + bg) * dFade;
    }
    return out_ * strength * scale;
  }
`;

// ── Panel shaders (texture reveal + rainbow) ───────────────────────────────────
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

// Default: nearly black.  uReveal [0→1] drives a smooth reveal.
// A brief bloom pulse fires near full reveal for a "light-ray touched" feel.
// uRainbow [0→1] sweeps the prismatic rainbow over the panels.
const FRAG = RAINBOW_GLSL + /* glsl */`
  uniform sampler2D uMap;
  uniform float     uReveal;
  uniform vec3      uPrismPos;
  uniform float     uRainbow;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  void main() {
    vec4  tex   = texture2D(uMap, vUv);
    float g     = smoothstep(0.0, 0.9, uReveal);
    float bloom = smoothstep(0.82, 1.0, uReveal) * 0.12;
    vec3  base  = mix(vec3(0.003, 0.001, 0.006), tex.rgb, g) + bloom;
    vec3  ray   = calcRainbow(vWorldPos, uPrismPos, uRainbow, 2.5);
    gl_FragColor = vec4(base + ray, 1.0);
  }
`;

// ── Dome-shell shaders (dark background + rainbow, no panel texture) ───────────
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
  varying vec3  vWorldPos;
  void main() {
    vec3 rainbow = calcRainbow(vWorldPos, uPrismPos, uRainbow, 1.8);
    gl_FragColor = vec4(vec3(0.004, 0.002, 0.010) + rainbow, 1.0);
  }
`;

// Dome shell uniforms — module-level so the reference is stable across renders.
// Three.js reads .value every frame, so mutations from Prism.tsx propagate automatically.
const DOME_SHELL_UNIFORMS = {
  uPrismPos: PRISM_POS_UNIFORM,
  uRainbow:  PRISM_RAINBOW_UNIFORM,
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
      <planeGeometry args={[3.6, 2.4]} />
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
  const [urls, setUrls] = useState<string[]>([]);
  const activatedRef    = useRef<number | null>(null);

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
  // 1) Player reaches chairs → prism starts descending immediately
  // 2) 5 s later → panels start lighting up one by one (staggered)
  // 3) After the last panel finishes revealing → "alight:dome-revealed" fires
  //    → Player.useFrame re-enables WASD movement
  //
  // Timing math: 5000ms delay + 60 panels×120ms stagger + 2600ms last-panel reveal
  //            ≈ 14 800 ms total from the "chose-chairs" event.
  useEffect(() => {
    const handle = () => {
      if (activatedRef.current !== null) return; // already activated
      setTimeout(() => { activatedRef.current = Date.now(); }, 5000);
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("alight:dome-revealed"));
      }, 14_800);
    };
    window.addEventListener("alight:chose-chairs", handle);
    return () => window.removeEventListener("alight:chose-chairs", handle);
  }, []);

  // Build orbital layout once per URL set — Math.random() inside ensures each
  // page load gets a unique arrangement of orbits, speeds, and directions.
  const orbits = useMemo(() => buildOrbits(urls.slice(0, MAX_PANELS)), [urls]);

  return (
    <group>
      {/* Dome shell — upper hemisphere, BackSide.
          thetaLength=0.52π puts the open rim at y≈-2 (below floor level) so
          the rim is never visible to the player.
          Uses a ShaderMaterial so the prism rainbow can illuminate the shell
          in the gaps between panels. */}
      <mesh>
        <sphereGeometry args={[DOME_R + 2, 48, 32, 0, Math.PI * 2, 0, Math.PI * 0.52]} />
        <shaderMaterial
          vertexShader={SHELL_VERT}
          fragmentShader={SHELL_FRAG}
          uniforms={DOME_SHELL_UNIFORMS}
          side={THREE.BackSide}
        />
      </mesh>

      {orbits.map((orb, i) => (
        <OrbitRing key={i} data={orb} activatedRef={activatedRef} />
      ))}
    </group>
  );
}
