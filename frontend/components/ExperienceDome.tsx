"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { PRISM_POS_UNIFORM, PRISM_RAINBOW_UNIFORM, PRISM_ROT_UNIFORM } from "@/lib/prismUniforms";
import DomeVisualizer from "./DomeVisualizer";
import { DOME_SKY_MAT_EXPORT } from "@/app/alight/dome/DomeSky";
import FloorVisualizer from "./FloorVisualizer";
import SectorAudioFX from "./SectorAudioFX";
import HazSystem from "./HazSystem";
import HazRings from "./HazRings";
import SymbolSystem from "./SymbolSystem";
import Monoliths from "./Monoliths";
import { DBG_SILLAS, DBG_PANELES } from "@/lib/debugConfig";
import { resetEffects } from "@/lib/vizAudio";
import { PANELES_SILLAS, tickPanelesSillas, installPanelesSillasListeners, panelesSillasVisibles } from "@/lib/alightStore";
import { createPanelPlaceholder } from "@/lib/retro/panelPlaceholder";
import { registrarPanelLinterna, tickLinterna, apagarLinterna, resetLinterna, type PanelLinterna } from "@/lib/linternaPaneles";
import PanelSelMarco from "./PanelSelMarco";

// Z2: cada panel orbita con su propia fase (pivot por panel) para poder frenarse bajo la
// linterna y retomar sin saltos. false = órbita por anillo como antes (OrbitRing gira).
const Z2_FASE_POR_PANEL = true;

// N2: disable legacy floor textures and sector audio
const LEGACY_FLOOR_TEXTURES_ENABLED = false;
const LEGACY_SECTOR_AUDIO_ENABLED   = false;

const API_URL    = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
const DOME_R     = 28;
const MAX_PANELS = 60;
const PANEL_SCALE = 1.5; // G4: multiply panel dimensions by this factor
const CACHE_KEY  = "alight:media-items-v2"; // Z1: era "alight:media-urls" (solo URLs, sin título)

// ── Minimal shapes from the project's data layer ──────────────────────────────
interface Proyecto  { titulo?: string; foto?: string | null; galeria?: string[]; referencias?: string[] }
interface Prestador { nombre?: string; foto?: string | null }

// Z1: cada panel lleva la URL (o null si no hay foto) y el título para el placeholder
interface PanelItem { url: string | null; titulo: string }

// ── Data helpers ──────────────────────────────────────────────────────────────
function getYoutubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([^&\n?#]{11})/);
  return m ? m[1] : null;
}

// Z1: mismo orden y deduplicación que antes, pero con título. Un proyecto sin ninguna
// imagen aporta un item { url: null } → panel placeholder con su título.
function extractItems(ps: Proyecto[], pr: Prestador[]): PanelItem[] {
  const seen  = new Set<string>();
  const items: PanelItem[] = [];
  const add = (u: string | null | undefined, titulo: string) => {
    const url = u?.trim();
    if (!url || seen.has(url)) return false;
    seen.add(url);
    items.push({ url, titulo });
    return true;
  };
  ps.forEach(p => {
    const titulo = p.titulo ?? "SIN TÍTULO";
    let alguna = add(p.foto, titulo);
    p.galeria?.forEach(g => { alguna = add(g, titulo) || alguna; });
    p.referencias?.forEach(r => {
      const id = getYoutubeId(r);
      if (id) alguna = add(`https://img.youtube.com/vi/${id}/hqdefault.jpg`, titulo) || alguna;
    });
    if (!alguna && !p.foto && !(p.galeria?.length)) items.push({ url: null, titulo });
  });
  pr.forEach(p => { add(p.foto, p.nombre ?? "PRESTADOR"); });
  return items;
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
  panels:  { pos: THREE.Vector3; item: PanelItem; staggerSec: number }[];
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

function buildOrbits(urls: PanelItem[]): OrbitData[] {
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
        item:       urls[urlIdx++] ?? { url: null, titulo: "" },
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
// R5: CRT bezel (cream border 4% UV), scanline overlay, amber terminal header bar.
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

// R5: flag — set false to revert to original shader (no bezel)
const R5_PANEL_BEZEL = true;

// R5 bezel GLSL constants
const BEZEL_GLSL = R5_PANEL_BEZEL ? /* glsl */`
  // CRT bezel helper — cream border + header bar + scanlines
  vec3 applyBezel(vec2 uv, vec3 content, float gate) {
    float bz = 0.040;   // bezel thickness in UV
    float hdr = 0.115;  // header zone height in UV (top)
    vec3  cream  = vec3(0.910, 0.863, 0.769); // #E8DCC4
    vec3  hdrBg  = vec3(0.165, 0.078, 0.0);   // #2A1400
    vec3  amber  = vec3(1.0, 0.604, 0.122);   // #FF9A1F
    // Is this pixel in the bezel border?
    bool inBez = uv.x < bz || uv.x > 1.0 - bz || uv.y < bz || uv.y > 1.0 - bz;
    if (inBez) return cream * gate;
    // Remap to inner screen UV
    vec2 suv = (uv - bz) / (1.0 - 2.0 * bz);
    // Header bar (top hdr of screen height)
    if (suv.y > 1.0 - hdr) {
      // Scanline pattern
      float scan = 0.80 + 0.20 * sin(suv.y * 320.0 * 6.2831);
      // Blinking "STATUS" bar — 8 amber rectangles
      float segW = 1.0 / 8.0;
      float seg  = floor(suv.x / segW);
      float sOn  = step(0.05, fract(suv.x / segW)) * step(0.08, fract(suv.y / hdr));
      vec3 hdrCol = mix(hdrBg, amber * 0.75, sOn * 0.6) * scan;
      return hdrCol * gate;
    }
    // Scanline overlay on content
    float sl   = 0.88 + 0.12 * sin(suv.y * 420.0 * 6.2831);
    return content * sl;
  }
` : "";

// Z1: marco con margen UNIFORME + regla ocre dentro del margen + foto con ajuste "cover".
// Causa del margen desparejo de R5: bz = 0.04 en UV para ambos ejes, pero el plano es
// 3:2 → arriba/abajo medía 0.04 × alto (2/3 del lateral) y el encabezado quedaba pegado
// al borde; además la foto se estiraba a 3:2 y el marco la tapaba (sin cálculo de aspecto).
// Ahora todo se mide en fracciones del ANCHO. false = vuelve al bezel R5.
const Z1_PANEL_MARCO = true;

// Z1: uniforms compartidos por los 60 paneles (los escribe ExperienceDome desde DBG_PANELES)
const PANEL_LAYOUT_UNIFORMS = {
  uMargen: { value: 0.03 },
  uRegla:  { value: 0.05 },
  uAspect: { value: 1.5 },     // ancho / alto del plano (3.6 × 2.4)
  uOscuro: { value: 0.018 },   // brillo del contenido fuera de los haces (R5: 0.018 fijo)
};

const MARCO_GLSL = Z1_PANEL_MARCO ? /* glsl */`
  uniform float uMargen, uRegla, uAspect, uTexAspect;
  // coordenadas en unidades de ancho: x ∈ [0,1], y ∈ [0, 1/uAspect]
  vec4 z1Rect() {
    float H = 1.0 / uAspect;
    // (x0, y0, ancho, alto) de la zona de imagen
    return vec4(uMargen, uMargen, 1.0 - 2.0 * uMargen, max(0.001, H - 2.0 * uMargen - uRegla));
  }
  // UV de la textura con ajuste "cover" (recorta, no estira)
  vec2 z1ImageUv(vec2 uv) {
    vec2 p = vec2(uv.x, uv.y / uAspect);
    vec4 r = z1Rect();
    vec2 s = (p - r.xy) / r.zw;
    float ra = r.z / r.w;
    float ta = max(0.01, uTexAspect);
    if (ta > ra) s.x = 0.5 + (s.x - 0.5) * ra / ta;
    else         s.y = 0.5 + (s.y - 0.5) * ta / ra;
    return s;
  }
  vec3 applyMarco(vec2 uv, vec3 content, float gate) {
    vec3 cream = vec3(0.910, 0.863, 0.769); // #E8DCC4
    vec3 ocre  = vec3(0.788, 0.588, 0.227); // regla ocre (mockup)
    vec3 tinta = vec3(0.227, 0.231, 0.235); // #3A3B3C
    float H = 1.0 / uAspect;
    vec2 p = vec2(uv.x, uv.y / uAspect);
    float m = uMargen;
    // margen beige parejo en los 4 lados
    if (p.x < m || p.x > 1.0 - m || p.y < m || p.y > H - m) return cream * gate;
    // regla: franja superior dentro del margen, con marcas que cuelgan desde arriba
    float yTop = H - m;
    if (p.y > yTop - uRegla) {
      float x   = (p.x - m) / (1.0 - 2.0 * m);       // 0–1 a lo ancho de la regla
      float d   = (yTop - p.y) / max(uRegla, 0.0001); // 0 arriba → 1 abajo
      float n   = x * 50.0;                           // 50 divisiones
      float fx  = fract(n);
      bool mayor = mod(floor(n + 0.5), 5.0) < 0.5;
      float largo = mayor ? 0.62 : 0.32;
      float tick = step(fx, 0.09) + step(0.91, fx);    // trazo centrado en cada división
      float onTick = min(1.0, tick) * step(d, largo);
      return mix(ocre, tinta, onTick) * gate;
    }
    // scanlines sobre la imagen (igual que R5)
    vec4 r = z1Rect();
    float sy = (p.y - r.y) / r.w;
    float sl = 0.88 + 0.12 * sin(sy * 420.0 * 6.2831);
    return content * sl;
  }
` : "";

const FRAG = RAINBOW_GLSL + BEZEL_GLSL + MARCO_GLSL + /* glsl */`
  uniform sampler2D uMap;
  uniform float     uOscuro;
  uniform float     uLit;     // Z2: luz de la linterna del usuario (0–1, test de cono en CPU)
  uniform float     uReveal;
  uniform vec3      uPrismPos;
  uniform float     uRainbow;
  uniform float     uPrismRot;
  varying vec2 vUv;
  varying vec3 vWorldPos;

  void main() {
    float gate = smoothstep(0.0, 0.05, uReveal);
    vec4  tex  = texture2D(uMap, ${Z1_PANEL_MARCO ? "z1ImageUv(vUv)" : "vUv"});
    vec3  col  = vec3(0.002, 0.001, 0.004);

    if (gate >= 0.01) {
      if (uRainbow < 0.005) {
        col = tex.rgb * uOscuro * gate;
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
        vec3 dark = tex.rgb * uOscuro;
        col = mix(dark, lit, totalStr) * gate;
      }
    }

    // Z2: la linterna revela la imagen como un haz (nunca oscurece)
    col = max(col, tex.rgb * uLit * gate);

    // R5: apply CRT bezel (cream frame + scanlines + header)
    ${Z1_PANEL_MARCO ? "col = applyMarco(vUv, col, gate);" : R5_PANEL_BEZEL ? "col = applyBezel(vUv, col, gate);" : ""}
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
  item:        PanelItem;     // Z1: url (o null) + título para el placeholder
  indice:      number;        // Z1: varía el código de modelo del placeholder
  azimuth:     number;        // Z2: ángulo base del anillo (va en el pivot del panel)
  tiltZ:       number;        // Z2: inclinación Z del anillo (va en el pivot del panel)
  speed:       number;        // Z2: velocidad de órbita (rad/frame a 60 fps)
  staggerSec:  number;
  activatedRef: { current: number | null };
}

const texLoader = new THREE.TextureLoader();

function PanelMesh({ position, item, indice, azimuth, tiltZ, speed, staggerSec, activatedRef }: PanelProps) {
  const url = item.url;
  const matRef  = useRef<THREE.ShaderMaterial>(null);
  const meshRef = useRef<THREE.Mesh>(null);   // P1: escala del fade
  const pivotRef = useRef<THREE.Group>(null); // Z2: fase de órbita propia
  const gl      = useThree((s) => s.gl);

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
    // Z1: layout compartido + aspecto propio de la textura (cover-fit)
    uMargen:    PANEL_LAYOUT_UNIFORMS.uMargen,
    uRegla:     PANEL_LAYOUT_UNIFORMS.uRegla,
    uAspect:    PANEL_LAYOUT_UNIFORMS.uAspect,
    uOscuro:    PANEL_LAYOUT_UNIFORMS.uOscuro,
    uTexAspect: { value: 1.5 },
    uLit:       { value: 0 },   // Z2
  }), []);

  // Z2: registro en la linterna (fase propia; el tick gira el pivot)
  useEffect(() => {
    if (!Z2_FASE_POR_PANEL) return;
    const entry: PanelLinterna = {
      pivot: pivotRef.current, mesh: meshRef.current, uLit: uniforms.uLit,
      fase: 0, velocidad: speed, azimut: azimuth,
      indice, titulo: item.titulo, url: item.url, angulo: 180,
    };
    return registrarPanelLinterna(entry);
  }, [uniforms, speed, azimuth, indice, item]);

  // Z1: foto cargada (o null) + placeholder (creado solo si hace falta) + estado
  const fotoRef = useRef<{ tex: THREE.Texture | null; aspect: number; estado: "cargando" | "ok" | "sin-foto" | "error" }>(
    { tex: null, aspect: 1.5, estado: "cargando" });
  const phRef   = useRef<THREE.CanvasTexture | null>(null);

  // Async texture load — only touches the uniform, never touches React state
  useEffect(() => {
    let live = true;
    let loaded: THREE.Texture | null = null; // P1: para liberar en el cleanup
    const f = fotoRef.current;
    f.tex = null; f.estado = url ? "cargando" : "sin-foto";
    // Z1: el placeholder se dibuja y sube a la GPU acá (al cargar), no al aparecer el panel
    const prepararPh = () => {
      if (!DBG_PANELES.PANEL_PLACEHOLDER || phRef.current) return;
      phRef.current = createPanelPlaceholder(item.titulo, indice);
      if (phRef.current) gl.initTexture(phRef.current);
    };
    if (!url) prepararPh();
    if (url) {
      texLoader.load(url, (tex) => {
        if (!live || !matRef.current) { tex.dispose(); return; }
        loaded = tex;
        tex.colorSpace = THREE.SRGBColorSpace;
        // P1: subir la textura a la GPU al cargar (cortina/exploración), no al aparecer
        gl.initTexture(tex);
        // Z1: aspecto real de la imagen para el cover-fit
        const img = tex.image as { width?: number; height?: number } | undefined;
        f.aspect = img?.width && img?.height ? img.width / img.height : 1.5;
        f.tex = tex; f.estado = "ok";
      }, undefined, () => {
        // Z1: antes no había onError → el panel quedaba con una textura vacía (negro)
        if (!live) return;
        f.estado = "error";
        prepararPh();
        console.warn(`[ExperienceDome] Z1: no cargó la foto del panel "${item.titulo}": ${url}`);
      });
    }
    return () => {
      live = false;
      // P1: liberar la textura al desmontar
      loaded?.dispose();
      f.tex = null;
    };
  }, [url, gl, item.titulo, indice]);

  // Z1: liberar el placeholder al desmontar
  useEffect(() => () => { phRef.current?.dispose(); phRef.current = null; }, []);

  // Reveal is driven purely in useFrame — no state, no re-renders
  useFrame(() => {
    // P1: oculto → no se actualiza nada
    if (PANELES_SILLAS.fase === "oculto") return;
    // P1: fade por escala (smoothstep) — sin transparencia ni cambio de materiales
    const a = PANELES_SILLAS.alpha;
    if (meshRef.current) meshRef.current.scale.setScalar(Math.max(0.0001, a * a * (3 - 2 * a)));
    const mat = matRef.current;
    // Z1: foto o placeholder (el canvas se crea una sola vez, la primera vez que hace falta)
    if (mat) {
      const f = fotoRef.current;
      const falta = f.estado === "sin-foto" || f.estado === "error";
      const usarPh = DBG_PANELES.PANEL_PLACEHOLDER && (DBG_PANELES.PANEL_PLACEHOLDER_FORZAR || falta);
      if (usarPh && !phRef.current) {
        phRef.current = createPanelPlaceholder(item.titulo, indice);
        if (phRef.current) gl.initTexture(phRef.current);
      }
      const ph = usarPh ? phRef.current : null;
      const tex = ph ?? f.tex;
      if (tex && mat.uniforms.uMap.value !== tex) {
        mat.uniforms.uMap.value = tex;
        mat.uniforms.uTexAspect.value = ph ? (ph.userData.aspect as number) : f.aspect;
      }
    }
    if (!mat || activatedRef.current === null) return;
    const elapsed = (Date.now() - activatedRef.current) / 1000 - staggerSec;
    if (elapsed > 0 && mat.uniforms.uReveal.value < 1) {
      mat.uniforms.uReveal.value = Math.min(1, mat.uniforms.uReveal.value + 0.007);
    }
  });

  return (
    <group ref={pivotRef} rotation={Z2_FASE_POR_PANEL ? [0, azimuth, tiltZ] : [0, 0, 0]}>
      <mesh ref={meshRef} position={position} quaternion={quaternion}>
        <planeGeometry args={[3.6 * PANEL_SCALE, 2.4 * PANEL_SCALE]} />
        <shaderMaterial
          ref={matRef}
          vertexShader={VERT}
          fragmentShader={FRAG}
          uniforms={uniforms}
        />
      </mesh>
    </group>
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
    if (PANELES_SILLAS.fase === "oculto") return; // P1
    if (Z2_FASE_POR_PANEL) return; // Z2: cada panel gira su propio pivot (tickLinterna)
    if (groupRef.current) groupRef.current.rotation.y += data.speed;
  });

  return (
    <group
      ref={groupRef}
      position={[0, data.centerY, 0]}
      // Z2: con fase por panel, azimut y tiltZ van en el pivot de cada panel →
      // Rx(tiltX)·Ry(azimut + fase)·Rz(tiltZ), la misma composición que antes
      rotation={Z2_FASE_POR_PANEL ? [data.tiltX, 0, 0] : [data.tiltX, data.azimuth, data.tiltZ]}
    >
      {data.panels.map((p, i) => (
        <PanelMesh
          key={i}
          position={p.pos}
          item={p.item}
          indice={Math.round(p.staggerSec / 0.12)}
          azimuth={data.azimuth}
          tiltZ={data.tiltZ}
          speed={data.speed}
          staggerSec={p.staggerSec}
          activatedRef={activatedRef}
        />
      ))}
    </group>
  );
}

// ── ExperienceDome ────────────────────────────────────────────────────────────
export default function ExperienceDome() {
  const [urls, setUrls]       = useState<PanelItem[]>([]); // Z1: items con título
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
        const extracted = extractItems(proyectos, prestadores);
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
    // visualizer-activate → begin shell fade + mount DomeVisualizer; reset legacy effects (N2)
    const onVizOn  = () => { resetEffects(); apagarLinterna(); vizActiveRef.current = true;  setVizActive(true); }; // Z2: apaga la linterna
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

  const shellRef    = useRef<THREE.Mesh>(null);
  const skyShellRef = useRef<THREE.Mesh>(null);
  const panelsRef   = useRef<THREE.Group>(null); // P1: contenedor de los paneles SILLAS
  const { gl, scene, camera } = useThree();

  // P1: eventos de la narrativa → PANELES_SILLAS (store)
  useEffect(() => installPanelesSillasListeners(), []);

  // Z2: el reset de debug del camino SILLAS vuelve a habilitar la linterna; al desmontar se apaga
  useEffect(() => {
    const onReset = () => resetLinterna();
    window.addEventListener("alight:debug-reset-sillas", onReset);
    return () => {
      window.removeEventListener("alight:debug-reset-sillas", onReset);
      apagarLinterna();
      resetLinterna();
    };
  }, []);

  // G1/AA2: animate shell opacity; sky shell uses DomeSky material when vizActive+domoShaderEnMalla
  useFrame((_, dt) => {
    // P1: fade y visibilidad de los paneles SILLAS, derivados del store
    tickPanelesSillas(performance.now());
    // Z1: layout del marco desde el menú de debug (uniforms compartidos, sin allocations)
    PANEL_LAYOUT_UNIFORMS.uMargen.value = DBG_PANELES.PANEL_MARGEN;
    PANEL_LAYOUT_UNIFORMS.uRegla.value  = DBG_PANELES.PANEL_REGLA;
    PANEL_LAYOUT_UNIFORMS.uOscuro.value = DBG_PANELES.PANEL_OSCURO;
    if (panelsRef.current) panelsRef.current.visible = PANELES_SILLAS.fase !== "oculto";
    // Z2: linterna (test de cono) + fase de órbita propia de cada panel
    if (Z2_FASE_POR_PANEL) tickLinterna(camera, dt, performance.now(), panelesSillasVisibles(), PANELES_SILLAS.fase !== "oculto");
    if (shellRef.current) {
      shellRef.current.visible = !DBG_SILLAS.vizHideShell;
    }
    const target = vizActiveRef.current ? DBG_SILLAS.domeShellOpacity : 1.0;
    const cur    = DOME_SHELL_UNIFORMS.uShellOpacity.value;
    if (Math.abs(cur - target) > 0.001) {
      DOME_SHELL_UNIFORMS.uShellOpacity.value = THREE.MathUtils.lerp(cur, target, dt * 5);
    }
    // AA2: sky shell — aplica material de DomeSky al mismo mesh del domo
    const skyShell = skyShellRef.current;
    if (skyShell) {
      const useDomeSky = vizActiveRef.current && DBG_SILLAS.domoShaderEnMalla && !DBG_SILLAS.domoOriginal;
      const dmat = DOME_SKY_MAT_EXPORT.mat;
      skyShell.visible = useDomeSky && dmat !== null;
      if (dmat && skyShell.material !== dmat) skyShell.material = dmat;
    }
  });

  // Build orbital layout once per URL set — Math.random() inside ensures each
  // page load gets a unique arrangement of orbits, speeds, and directions.
  const orbits = useMemo(() => buildOrbits(urls.slice(0, MAX_PANELS)), [urls]);

  // P1: precompilar el shader de los paneles apenas se montan (oculto), para que su
  // aparición no compile programas. compile() solo recorre objetos visibles.
  useEffect(() => {
    const g = panelsRef.current;
    if (!g || orbits.length === 0) return;
    const prev = g.visible;
    g.visible = true;
    try { gl.compile(scene, camera); } catch { /* ok */ }
    g.visible = prev;
  }, [orbits, gl, scene, camera]);

  return (
    <group>
      {/* S3: DomeVisualizer always mounted when visualizer active */}
      {vizActive && <DomeVisualizer />}
      {/* N2: legacy floor + sector audio disabled; gated by flags to allow re-enable */}
      {vizActive && LEGACY_FLOOR_TEXTURES_ENABLED && <FloorVisualizer />}
      {vizActive && LEGACY_SECTOR_AUDIO_ENABLED   && <SectorAudioFX />}
      {/* N3: beams + floor symbols */}
      {vizActive && <HazSystem />}
      {vizActive && <HazRings />}
      {vizActive && <SymbolSystem />}
      {/* N5: monoliths flanking tarima path */}
      {vizActive && <Monoliths />}

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
      {/* AA2: sky shader mesh — misma geometría; DomeSky material aplicado imperativo en useFrame */}
      <mesh ref={skyShellRef} renderOrder={-1} frustumCulled={false} visible={false}>
        <sphereGeometry args={[DOME_R + 2, 48, 32, 0, Math.PI * 2, 0, Math.PI * 0.52]} />
      </mesh>

      {/* Z2: marco de selección de la linterna (un solo plano compartido) */}
      {Z2_FASE_POR_PANEL && <PanelSelMarco ancho={3.6 * PANEL_SCALE} alto={2.4 * PANEL_SCALE} />}
      {/* P1: paneles del camino SILLAS — visibles solo entre prism-landed y la E sobre el prisma */}
      <group ref={panelsRef} visible={false}>
        {orbits.map((orb, i) => (
          <OrbitRing key={i} data={orb} activatedRef={activatedRef} />
        ))}
      </group>
    </group>
  );
}
