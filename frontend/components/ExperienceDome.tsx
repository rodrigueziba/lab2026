"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

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

// ── Fibonacci panel layout ─────────────────────────────────────────────────────
// y range [0.08, 0.70] keeps panels above the player (y>1.6) and below the
// room ceiling (y<22 when DOME_R=28).  Equal y-steps = equal spherical area.
function fibDomePanels(count: number, r: number): THREE.Vector3[] {
  const pts  = [] as THREE.Vector3[];
  const phi  = Math.PI * (3 - Math.sqrt(5)); // golden angle
  const yMax = 0.70;
  const yMin = 0.08;
  for (let i = 0; i < count; i++) {
    const y  = yMax - (i / Math.max(count - 1, 1)) * (yMax - yMin);
    const rr = Math.sqrt(1 - y * y);
    const th = phi * i;
    pts.push(new THREE.Vector3(rr * Math.cos(th) * r, y * r, rr * Math.sin(th) * r));
  }
  return pts;
}

// ── GLSL ──────────────────────────────────────────────────────────────────────
const VERT = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Default: nearly black.  uReveal [0→1] drives a smooth reveal.
// A brief bloom pulse fires near full reveal for a "light-ray touched" feel.
const FRAG = /* glsl */`
  uniform sampler2D uMap;
  uniform float     uReveal;
  varying vec2 vUv;
  void main() {
    vec4  tex   = texture2D(uMap, vUv);
    float g     = smoothstep(0.0, 0.9, uReveal);
    float bloom = smoothstep(0.82, 1.0, uReveal) * 0.12;
    vec3  col   = mix(vec3(0.003, 0.001, 0.006), tex.rgb, g) + bloom;
    gl_FragColor = vec4(col, 1.0);
  }
`;

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

  // Stable uniforms — same object reference across renders so R3F won't re-apply
  const uniforms = useMemo(() => ({
    uMap:    { value: new THREE.Texture() },
    uReveal: { value: 0.0 },
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
      <planeGeometry args={[2.4, 1.6]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
      />
    </mesh>
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

  // Activation: triggered by Player when it reaches ZONA_SILLAS
  useEffect(() => {
    const handle = () => {
      if (activatedRef.current === null) activatedRef.current = Date.now();
    };
    window.addEventListener("alight:chose-chairs", handle);
    return () => window.removeEventListener("alight:chose-chairs", handle);
  }, []);

  const panels = useMemo(() => {
    const count = Math.min(urls.length, MAX_PANELS);
    return fibDomePanels(count, DOME_R).map((pos, i) => ({
      pos,
      url:        urls[i],
      staggerSec: i * 0.1,
    }));
  }, [urls]);

  return (
    <group>
      {/* Dome shell — upper hemisphere, BackSide, very dark.
          thetaLength=0.52π puts the open rim at y≈-2 (below floor level) so
          the rim is never visible to the player.
          Note: the room's ceiling plane at y=22 sits inside this sphere.
          Remove the ceiling from Room when full dome immersion is needed. */}
      <mesh>
        <sphereGeometry args={[DOME_R + 2, 48, 32, 0, Math.PI * 2, 0, Math.PI * 0.52]} />
        <meshBasicMaterial color="#010103" side={THREE.BackSide} />
      </mesh>

      {panels.map((p, i) => (
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
