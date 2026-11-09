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
import { DBG_SILLAS, DBG_PANELES, DBG_ORBITAS } from "@/lib/debugConfig";
import { PRISM_CENTER_Y } from "./Prism"; // Z7: altura del origen de los haces
import { resetEffects } from "@/lib/vizAudio";
import { PANELES_SILLAS, tickPanelesSillas, installPanelesSillasListeners, panelesSillasVisibles, seleccionPanelesHabilitada } from "@/lib/alightStore";
import { createPanelPlaceholder } from "@/lib/retro/panelPlaceholder";
import { registrarPanelLinterna, tickLinterna, apagarLinterna, resetLinterna, type PanelLinterna, ORBITAS_INFO, type AnilloInfo } from "@/lib/linternaPaneles";
import PanelSelMarco from "./PanelSelMarco";
import SubpanelesProyecto from "./SubpanelesProyecto"; // Z4

// Z2: cada panel orbita con su propia fase (pivot por panel) para poder frenarse bajo la
// linterna y retomar sin saltos. false = órbita por anillo como antes (OrbitRing gira).
const Z2_FASE_POR_PANEL = true;

// N2: disable legacy floor textures and sector audio
const LEGACY_FLOOR_TEXTURES_ENABLED = false;
const LEGACY_SECTOR_AUDIO_ENABLED   = false;

const API_URL    = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
const DOME_R     = 28;
const MAX_PANELS = 60; // G5 (sin Z7); con Z7 manda DBG_ORBITAS.PANELES_MAX
// G4: PANEL_SCALE = 1.5 → Z7: ahora DBG_ORBITAS.PANEL_ESCALA (panelAncho()/panelAlto())
const CACHE_KEY  = "alight:media-items-v3"; // Z3: + proyectoId (Z1: v2 con título; antes "alight:media-urls")

// ── Minimal shapes from the project's data layer ──────────────────────────────
interface Proyecto  { id?: number; titulo?: string; foto?: string | null; galeria?: string[]; referencias?: string[] }
interface Prestador { nombre?: string; foto?: string | null }

// Z1: cada panel lleva la URL (o null si no hay foto) y el título para el placeholder
interface PanelItem { url: string | null; titulo: string; proyectoId: number | null } // Z3: id para useProyectoDetalle (null = prestador)

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
  const add = (u: string | null | undefined, titulo: string, proyectoId: number | null) => {
    const url = u?.trim();
    if (!url || seen.has(url)) return false;
    seen.add(url);
    items.push({ url, titulo, proyectoId });
    return true;
  };
  ps.forEach(p => {
    const titulo = p.titulo ?? "SIN TÍTULO";
    const pid = typeof p.id === "number" ? p.id : null;
    let alguna = add(p.foto, titulo, pid);
    p.galeria?.forEach(g => { alguna = add(g, titulo, pid) || alguna; });
    p.referencias?.forEach(r => {
      const id = getYoutubeId(r);
      if (id) alguna = add(`https://img.youtube.com/vi/${id}/hqdefault.jpg`, titulo, pid) || alguna;
    });
    if (!alguna && !p.foto && !(p.galeria?.length)) items.push({ url: null, titulo, proyectoId: pid });
  });
  pr.forEach(p => { add(p.foto, p.nombre ?? "PRESTADOR", null); });
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
  panels:  { pos: THREE.Vector3; item: PanelItem; staggerSec: number; bobAmp?: number; bobSemilla?: number }[];
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
        item:       urls[urlIdx++] ?? { url: null, titulo: "", proyectoId: null },
        staggerSec: staggerIdx++ * 0.12,
      };
    });

    return { centerY, tiltX, tiltZ, azimuth, speed, panels } as OrbitData;
  }).filter((d): d is OrbitData => d !== null);
}

// ── Z7: órbitas ordenadas ─────────────────────────────────────────────────────
// Causa del caos de G5: 9 anillos con inclinación X al azar de hasta asin((y−1)/r)
// (≈15–26°) + Z ±7°, radios 23–27 m pegados al domo y alturas fijas 7/10/13 m sin
// relación con los haces → paneles superpuestos, fuera de la luz y muy inclinados.
// Ahora: anillos horizontales (sin inclinación) concéntricos, cada uno con su altura
// dentro de la banda vertical que barre el abanico del prisma a ese radio.
const Z7_ORBITAS_ORDENADAS_DEFAULT = true; // el flag vivo es DBG_ORBITAS.ORB_ORDENADAS
const HAZ_ELEV_RAD = 0.32;                 // elevación del abanico (igual que el shader del domo)

function panelAncho(): number { return 3.6 * DBG_ORBITAS.PANEL_ESCALA; }
function panelAlto():  number { return 2.4 * DBG_ORBITAS.PANEL_ESCALA; }

function buildOrbitsZ7(items: PanelItem[], version: number): OrbitData[] {
  const O = DBG_ORBITAS;
  const W = panelAncho(), H = panelAlto();
  const n = Math.max(1, Math.round(O.ORB_ANILLOS));
  // banda útil del haz: hasta donde da ≥ ORB_LUZ_MIN de luz (smoothstep del shader)
  const cosBorde = DBG_PANELES.PANEL_HAZ_COS, suave = DBG_PANELES.PANEL_HAZ_SUAVE;
  const f = THREE.MathUtils.clamp(O.ORB_LUZ_MIN, 0, 1);
  // inversa de smoothstep: t con 3t² − 2t³ = f
  const tInv = 0.5 - Math.sin(Math.asin(1 - 2 * f) / 3);
  const cosUtil = Math.min(0.999999, cosBorde + suave * tInv);
  const theta = Math.acos(cosUtil);
  const y0 = PRISM_CENTER_Y;
  const varM = Math.max(0, O.ORB_VAR_M);

  const anillos: AnilloInfo[] = [];
  for (let i = 0; i < n; i++) {
    const r = n === 1 ? O.ORB_RADIO_MIN_M : O.ORB_RADIO_MIN_M + (O.ORB_RADIO_MAX_M - O.ORB_RADIO_MIN_M) * (i / (n - 1));
    const yMin = y0 + r * Math.tan(HAZ_ELEV_RAD - theta);
    const yMax = y0 + r * Math.tan(HAZ_ELEV_RAD + theta);
    const cLo = yMin + H / 2 + varM, cHi = yMax - H / 2 - varM;
    const entra = cLo <= cHi;
    const mid = entra ? (cLo + cHi) / 2 : (yMin + yMax) / 2;
    const signo = i % 2 === 0 ? -1 : 1;                       // abajo / arriba alternados
    const altura = entra ? mid + signo * O.ORB_ALTURA_ALTERNA * (cHi - cLo) / 2 : mid;
    const wAng = 2 * Math.atan(W / 2 / r);
    const capacidad = Math.max(1, Math.floor((Math.PI * 2) / (Math.max(1, O.ORB_SEP_MIN) * wAng)));
    const vel = O.ORB_VEL_BASE * (1 + O.ORB_VEL_PASO * i) * (i % 2 === 0 ? 1 : -1);
    anillos.push({ radio: r, altura, yMin, yMax, vel, cantidad: 0, capacidad, entra });
  }

  // reparto proporcional a la capacidad (el anillo interior recibe los más recientes)
  const capTotal = anillos.reduce((a, b) => a + b.capacidad, 0);
  const N = Math.min(Math.max(0, Math.round(O.PANELES_MAX)), items.length, capTotal);
  let asignados = 0;
  for (const a of anillos) { a.cantidad = Math.min(a.capacidad, Math.floor(N * a.capacidad / capTotal)); asignados += a.cantidad; }
  while (asignados < N) {
    const libre = anillos.filter(a => a.cantidad < a.capacidad).sort((x, y) => (y.capacidad - y.cantidad) - (x.capacidad - x.cantidad))[0];
    if (!libre) break;
    libre.cantidad++; asignados++;
  }

  ORBITAS_INFO.anillos = anillos; ORBITAS_INFO.total = asignados;
  ORBITAS_INFO.pedidos = Math.min(Math.round(O.PANELES_MAX), items.length); ORBITAS_INFO.yHaz = y0;
  ORBITAS_INFO.version = version;
  if (anillos.some(a => !a.entra)) console.warn("[ExperienceDome] Z7: algún anillo no entra en la banda de los haces con este tamaño de panel");
  if (asignados < ORBITAS_INFO.pedidos) console.warn(`[ExperienceDome] Z7: entran ${asignados} de ${ORBITAS_INFO.pedidos} paneles con ORB_SEP_MIN=${O.ORB_SEP_MIN}`);

  let idx = 0, stagger = 0;
  return anillos.filter(a => a.cantidad > 0).map((a, i) => {
    const desfase = (i * 0.61803398875 * Math.PI * 2) % (Math.PI * 2); // intercalado entre anillos
    const panels = Array.from({ length: a.cantidad }, (_, k) => {
      const ang = (k / a.cantidad) * Math.PI * 2;
      return {
        pos: new THREE.Vector3(a.radio * Math.cos(ang), 0, a.radio * Math.sin(ang)),
        item: items[idx++] ?? { url: null, titulo: "", proyectoId: null },
        staggerSec: stagger++ * 0.12,
        bobAmp: varM,
        bobSemilla: k * 2.399963,                                   // ángulo áureo: fases distintas
      };
    });
    return { centerY: a.altura, tiltX: 0, tiltZ: 0, azimuth: desfase, speed: a.vel, panels } as OrbitData;
  });
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
  // Z6: foto a ras de la geometría (sin margen ni regla), cover-fit sobre todo el plano
  vec2 z6ImageUv(vec2 uv) {
    float ta = max(0.01, uTexAspect);
    vec2 s = uv;
    if (ta > uAspect) s.x = 0.5 + (s.x - 0.5) * uAspect / ta;
    else              s.y = 0.5 + (s.y - 0.5) * ta / uAspect;
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

// Z6: haces que iluminan los paneles. Hoy la fuente es el abanico del prisma (7 haces
// que giran con uPrismRot, los mismos que dibuja el domo); los 4 haces de HazSystem son
// spots verticales al piso que existen recién con el visualizador (paneles ya ocultos).
// Arrays de uniforms compartidos por los 60 paneles; se escriben en useFrame sin allocations.
const HAZ_MAX = 7;
function hslRaw(h: number, s: number, l: number): THREE.Vector3 {
  // misma fórmula que hsl2rgb del shader (valores crudos, sin conversión de color space)
  const f = (o: number) => {
    const p = Math.abs(((h + o) % 1) * 6 - 3);
    return l + s * (Math.min(1, Math.max(0, p - 1)) - 0.5) * (1 - Math.abs(2 * l - 1));
  };
  return new THREE.Vector3(f(1), f(2 / 3), f(1 / 3));
}
const PANEL_HAZ_UNIFORMS = {
  uHazO:       { value: Array.from({ length: HAZ_MAX }, () => new THREE.Vector3()) },
  uHazD:       { value: Array.from({ length: HAZ_MAX }, () => new THREE.Vector3(1, 0, 0)) },
  uHazColor:   { value: Array.from({ length: HAZ_MAX }, (_, i) => hslRaw(i / (HAZ_MAX - 1), 0.65, 0.65)) },
  uHazCos:     { value: new Array<number>(HAZ_MAX).fill(0.984) },
  uHazInt:     { value: new Array<number>(HAZ_MAX).fill(0) },
  uHazN:       { value: HAZ_MAX },
  uHazSuave:   { value: 0.014 },
  uHazGain:    { value: 1.4 },
  uBrilloBase: { value: 0.004 },
  uBorde:      { value: 0.006 },
  uBordeInt:   { value: 0.35 },
  uViejo:      { value: 0 },
  uLitColor:   { value: new THREE.Vector3(1.0, 0.890, 0.659) }, // #FFE3A8 (crudo)
};

/** Z6: actualiza los haces desde el prisma (posición, giro, intensidad del arcoíris). */
function actualizarHacesPanel(): void {
  const U = PANEL_HAZ_UNIFORMS;
  const D = DBG_PANELES;
  const az = PRISM_ROT_UNIFORM.value as number;
  const el = 0.32;                                   // ~18°, igual que el shader del domo
  const ce = Math.cos(el), se = Math.sin(el);
  const intens = PRISM_RAINBOW_UNIFORM.value as number;
  const pos = PRISM_POS_UNIFORM.value as THREE.Vector3;
  for (let i = 0; i < HAZ_MAX; i++) {
    const sweep = -0.38 + 0.76 * (i / (HAZ_MAX - 1)); // ±22°, mismo abanico que el domo
    const a = az - sweep;                             // rotAround(Y, sweep) = azimut − sweep
    U.uHazO.value[i].copy(pos);
    U.uHazD.value[i].set(ce * Math.cos(a), se, ce * Math.sin(a));
    U.uHazCos.value[i] = D.PANEL_HAZ_COS;
    U.uHazInt.value[i] = intens;
  }
  U.uHazSuave.value   = D.PANEL_HAZ_SUAVE;
  U.uHazGain.value    = D.PANEL_HAZ_INTENSIDAD;
  U.uBrilloBase.value = D.PANEL_BRILLO_BASE;
  U.uBorde.value      = D.PANEL_BORDE;
  U.uBordeInt.value   = D.PANEL_BORDE_INT;
  U.uViejo.value      = D.PANEL_DISENO_VIEJO ? 1 : 0;
}

const FRAG = RAINBOW_GLSL + BEZEL_GLSL + MARCO_GLSL + /* glsl */`
  uniform sampler2D uMap;
  uniform float     uOscuro;
  uniform float     uLit;     // Z2: luz de la linterna del usuario (0–1, test de cono en CPU)
  uniform float     uReveal;
  uniform vec3      uPrismPos;
  uniform float     uRainbow;
  uniform float     uPrismRot;
  // Z6: haces que iluminan el panel (calculados en CPU cada frame; sin luces de escena)
  uniform vec3      uHazO[${HAZ_MAX}];
  uniform vec3      uHazD[${HAZ_MAX}];
  uniform vec3      uHazColor[${HAZ_MAX}];
  uniform float     uHazCos[${HAZ_MAX}];
  uniform float     uHazInt[${HAZ_MAX}];
  uniform int       uHazN;
  uniform float     uHazSuave, uHazGain, uBrilloBase, uBorde, uBordeInt, uViejo;
  uniform vec3      uLitColor;
  uniform float     uAtenua;  // Z10: brillo relativo mientras otro proyecto está abierto (1 = normal)
  varying vec2 vUv;
  varying vec3 vWorldPos;

  void main() {
    // Z6: false/0 = diseño en reposo a oscuras; 1 = diseño viejo (R5/Z1: marco beige + regla)
    if (uViejo > 0.5) {
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
      gl_FragColor = vec4(col * uAtenua, 1.0);
      return;
    }

    // ── Z6: el panel no emite: color = albedo (foto o placeholder) × luz recibida ──
    float gate = smoothstep(0.0, 0.05, uReveal);
    vec4  tex  = texture2D(uMap, ${Z1_PANEL_MARCO ? "z6ImageUv(vUv)" : "vUv"});
    vec3  luz  = vec3(uBrilloBase);
    for (int i = 0; i < ${HAZ_MAX}; i++) {
      if (i >= uHazN) break;
      vec3  toFrag = vWorldPos - uHazO[i];
      float dist   = length(toFrag);
      float align  = dot(toFrag / max(dist, 1e-4), uHazD[i]);
      // cono con borde suave: 0 en el borde (uHazCos), 1 hacia el eje
      float m      = smoothstep(uHazCos[i], min(1.0, uHazCos[i] + uHazSuave), align);
      luz += uHazColor[i] * (m * uHazInt[i] * uHazGain * exp(-dist * 0.010));
    }
    luz += uLitColor * uLit;                         // linterna del usuario (Z2), luz cálida
    vec3 col = tex.rgb * luz;
    // borde mínimo carbón, también iluminado (solo se ve con luz: ayuda a leer la forma)
    ${Z1_PANEL_MARCO ? `vec2 pb = vec2(vUv.x, vUv.y / uAspect);
    float db = min(min(pb.x, 1.0 - pb.x), min(pb.y, 1.0 / uAspect - pb.y));
    if (db < uBorde) col = vec3(0.227, 0.231, 0.235) * luz * uBordeInt;` : ""}
    gl_FragColor = vec4(col * gate * uAtenua, 1.0);
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
  bobAmp?:     number;        // Z7: variación vertical suave (± m)
  bobSemilla?: number;        // Z7: fase propia de esa variación
  staggerSec:  number;
  activatedRef: { current: number | null };
}

const texLoader = new THREE.TextureLoader();

function PanelMesh({ position, item, indice, azimuth, tiltZ, speed, bobAmp = 0, bobSemilla = 0, staggerSec, activatedRef }: PanelProps) {
  const url = item.url;
  const matRef  = useRef<THREE.ShaderMaterial>(null);
  const meshRef = useRef<THREE.Mesh>(null);   // P1: escala del fade
  const pivotRef = useRef<THREE.Group>(null); // Z2: fase de órbita propia
  const entryRef = useRef<PanelLinterna | null>(null); // Z10
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
    uAtenua:    { value: 1 },   // Z10
    ...PANEL_HAZ_UNIFORMS,      // Z6: haces + brillo base + flag del diseño viejo (objetos compartidos)
  }), []);

  // Z2: registro en la linterna (fase propia; el tick gira el pivot)
  useEffect(() => {
    if (!Z2_FASE_POR_PANEL) return;
    const entry: PanelLinterna = {
      uAtenua: uniforms.uAtenua, oculta: 1, // Z10
      pivot: pivotRef.current, mesh: meshRef.current, uLit: uniforms.uLit,
      fase: 0, velocidad: speed, azimut: azimuth, bobAmp, bobSemilla, // Z7
      indice, titulo: item.titulo, url: item.url, proyectoId: item.proyectoId, angulo: 180,
    };
    entryRef.current = entry; // Z10: PanelMesh lee entry.oculta en useFrame
    const quitar = registrarPanelLinterna(entry);
    return () => { quitar(); entryRef.current = null; };
  }, [uniforms, speed, azimuth, indice, item, bobAmp, bobSemilla]);

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
    // Z10: × entry.oculta (los que se solapan con el proyecto abierto se esconden con fundido)
    const oc = entryRef.current?.oculta ?? 1;
    if (meshRef.current) meshRef.current.scale.setScalar(Math.max(0.0001, a * a * (3 - 2 * a) * oc));
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
        <planeGeometry args={[panelAncho(), panelAlto()]} /> {/* Z7: escala desde debug */}
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
          bobAmp={p.bobAmp}
          bobSemilla={p.bobSemilla}
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
    actualizarHacesPanel(); // Z6
    if (panelsRef.current) panelsRef.current.visible = PANELES_SILLAS.fase !== "oculto";
    // Z2: linterna (test de cono) + fase de órbita propia de cada panel
    // Z13: + selección habilitada recién con la liberación del movimiento
    if (Z2_FASE_POR_PANEL) tickLinterna(camera, dt, performance.now(), panelesSillasVisibles(), PANELES_SILLAS.fase !== "oculto", seleccionPanelesHabilitada());
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
  // Z7: órbitas ordenadas (flag ORB_ORDENADAS); "Regenerar órbitas" en debug recalcula todo
  const [regen, setRegen] = useState(0);
  useEffect(() => {
    const on = () => setRegen(n => n + 1);
    window.addEventListener("alight:debug-regenerar-orbitas", on);
    return () => window.removeEventListener("alight:debug-regenerar-orbitas", on);
  }, []);
  const orbits = useMemo(
    () => (DBG_ORBITAS.ORB_ORDENADAS && Z7_ORBITAS_ORDENADAS_DEFAULT ? buildOrbitsZ7(urls, regen) : buildOrbits(urls.slice(0, MAX_PANELS))),
    // regen fuerza el recálculo con los valores actuales de DBG_ORBITAS
    [urls, regen]);

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
      {Z2_FASE_POR_PANEL && <PanelSelMarco ancho={panelAncho()} alto={panelAlto()} />}
      {/* Z4: HISTORIA / GALERÍA / FICHA alrededor del panel abierto */}
      {Z2_FASE_POR_PANEL && <SubpanelesProyecto panelAncho={panelAncho()} panelAlto={panelAlto()} />}
      {/* P1: paneles del camino SILLAS — visibles solo entre prism-landed y la E sobre el prisma */}
      <group ref={panelsRef} visible={false}>
        {orbits.map((orb, i) => (
          <OrbitRing key={i} data={orb} activatedRef={activatedRef} />
        ))}
      </group>
    </group>
  );
}
