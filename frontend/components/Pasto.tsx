"use client";
// Z64: pasto que crece bajo las 4 luces del escenario (secuencia SILLAS, con el visualizador activo).
// ADAPTADO DEL PASTO DE UN SHADERTOY aportado por el usuario. Autor y URL: PENDIENTES de confirmar. Licencia asumida:
// CC BY-NC-SA 3.0 (la de Shadertoy por defecto; ver CREDITOS.md). Se adaptó la técnica de capas apiladas, la textura
// de briznas (campo aleatorio donde solo los máximos locales son briznas, altura con raíz cuadrada, mezcla de tres
// verdes), el viento que crece con la altura, el oscurecimiento por altura y la punta rojiza. NO se usaron las nubes,
// el cielo ni la cámara libre. El original traza 70 capas por píxel de pantalla; acá son CAPAS planos ("shells")
// apilados sobre el suelo, uno por instancia, con descarte por alfa (sin ordenar).
//
// Lógica de crecimiento y forma: lib/pasto.ts (puro). Un InstancedMesh por cuarto (celda de Voronoi de su luz,
// recortada al rectángulo de las 4 luces + MARGEN_M), visible solo con p > 0. En el fragment shader, ANTES de leer la
// textura, se descarta lo que no está en el cuarto, lo que está en la tarima o las sillas y lo que todavía no creció
// (p ≤ u). Sin luces reales (la sala es oscura: el brillo sale del propio shader y cae con la distancia a su luz y con
// el ciclo del día). Sin allocations por frame; textura y geometría se crean una vez y se liberan al desmontar.
// También: los monolitos de esta etapa (DBG_PASTO.MONOLITOS_ACTIVO; Z65: aparecen con los 4 cuartos completos) y los
// eventos alight:pasto-cuarto y (Z65) alight:pasto-completo.
//
// Z66 (rendimiento, flags en DBG_RENDIMIENTO; lógica pura en lib/pastoChunks.ts):
//  · PASTO_CHUNKS: bloques de ~CHUNK_M por cuarto con bounding sphere (frustum culling). Z64 dibujaba, por cuarto, una
//    malla del rectángulo ENTERO: cada capa se rasterizaba 4 veces sobre todo el pasto y 3/4 se descartaba.
//  · PASTO_CULL_PROGRESO: un bloque no se dibuja mientras p ≤ su umbral mínimo (precalculado al reconstruir).
//  · PASTO_LOD: capas por distancia (instanceCount) con histéresis; las alturas están reordenadas (lib/pastoChunks
//    ordenCapas) para que cualquier prefijo cubra 0…1 parejo.
//  · PASTO_LEJANO: suelo verde medio sin textura (misma celda, umbral y caída de luz) donde el pasto ya no se dibuja;
//    el desvanecimiento por distancia va hacia ese color en vez de a negro.
//  · PASTO_VIENTO_BARATO: el viento (2 ruidos de valor) se calcula por vértice sobre una malla subdividida (~0,4 m).
//  · PASTO_DESCARTE_TEMPRANO: cotas exactas del umbral (mancha 0 y 1) antes de calcular el ruido de manchas.
//  · PASTO_MIPMAPS: cadena de mipmaps propia (color promedio, alfa = media entre promedio y máximo) + anisotropía 2.

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { DBG_PASTO, DBG_SILLAS, DBG_LAYOUT, DEBUG_ENABLED, DBG_RENDIMIENTO } from "@/lib/debugConfig";
import { PASTO, avanzarPasto, reiniciarPasto, completarCuarto, rectPasto, distMaxCuarto, NOMBRES_EV, chequearTodoCompleto,
  cuartoDe, umbralPasto, manchaPasto } from "@/lib/pasto";
import { armarChunks, umbralMinChunk, chunkConPasto, distOjoChunk, capasLod, ordenCapas, PASTO_RENDER, type Chunk, type CfgLod } from "@/lib/pastoChunks"; // Z66
import { MONO_PASTO, monolitosMontados, monolitosObjetivo, posMonolitosPasto, avanzarAparicion } from "@/lib/monolitosPasto"; // Z65
import { hazPosXZEn, getHazBandOn } from "@/lib/haz";
import { hexARgb, DIA } from "@/lib/cicloDia";
import { RELOJ } from "@/lib/relojExperiencia";
import { sillaEn, N_SILLAS, TARIMA_CENTRO } from "@/lib/layoutSala";
import { TARIMA_W, TARIMA_D } from "./Tarima";
import Monoliths, { MONOLITO_ANCHO_M } from "./Monoliths";

const MAX_CAPAS = 40;
const TEX = 256;
const COLOR_KEYS = ["hazColor0", "hazColor1", "hazColor2", "hazColor3"] as const;

// ── textura de briznas (lógica del Buffer A del original), generada una vez ──
function curva(x: number): number { return x * (x * x + 3); }
function rnd(x: number, y: number): number {   // rand(vec2) del original: fract(p·2,7117) → curva → fract
  const px = ((x * 2.711651661) % 1 + 1) % 1, py = ((y * 2.711651661) % 1 + 1) % 1;
  const v = curva(px + py * 0.618034) * 43758.5453;
  return v - Math.floor(v);
}
export interface TexturasBriznas { sinMip: THREE.DataTexture; conMip: THREE.DataTexture; colLejano: [number, number, number] }
/** Z67: también la usa BaseFlor (pasto de la base de la flor). */
export function crearTexturaBriznas(): TexturasBriznas {
  const data = new Uint8Array(TEX * TEX * 4);
  const r = (x: number, y: number) => rnd(((x % TEX) + TEX) % TEX, ((y % TEX) + TEX) % TEX);   // con repetición
  for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
    const m = r(x, y);
    // solo los máximos locales son briznas (como el original: N, E, S, O, NE y SO)
    let res = m > r(x, y + 1) && m > r(x + 1, y) && m > r(x, y - 1) && m > r(x - 1, y) && m > r(x + 1, y + 1) && m > r(x - 1, y - 1) ? 1 : 0;
    const h = rnd(x * 2.24722 + 31.12515, y * 7.16163 + 59.1616);
    res *= Math.sqrt(h);
    const r1 = rnd(x * 4.23236 + 61.1261661, y * 11.843583 + 22.724727), r2 = rnd(x * 7.8645 + 171.2437247, y * 3.274247 + 54.23724372);
    let c = [0.2 + (0.42 - 0.2) * r1, 1 + (0.86 - 1) * r1, 0.3 + (0.15 - 0.3) * r1];
    c = c.map((v, k) => v + ([0.05, 0.65, 0.1][k] - v) * r2 * r2);
    const i = (y * TEX + x) * 4;
    data[i] = Math.round(c[0] * 255); data[i + 1] = Math.round(c[1] * 255); data[i + 2] = Math.round(c[2] * 255); data[i + 3] = Math.round(res * 255);
  }
  const t = new THREE.DataTexture(data, TEX, TEX, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
  t.colorSpace = THREE.NoColorSpace;
  t.needsUpdate = true;
  // Z66: versión con mipmaps propios. Color = promedio; alfa = media entre promedio y máximo (con el promedio solo, las
  // briznas, que son píxeles sueltos, se borrarían lejos por el umbral de alfa; con el máximo, el pasto lejano se vería
  // más tupido que el cercano).
  const mips: { data: Uint8Array; width: number; height: number }[] = [{ data, width: TEX, height: TEX }];
  for (let lado = TEX / 2; lado >= 1; lado /= 2) {
    const ant = mips[mips.length - 1].data, la = lado * 2, d = new Uint8Array(lado * lado * 4);
    for (let y = 0; y < lado; y++) for (let x = 0; x < lado; x++) {
      const o = (y * lado + x) * 4;
      let aMax = 0, aSum = 0;
      for (let k = 0; k < 4; k++) {
        const i = (((y * 2 + (k >> 1)) * la) + (x * 2 + (k & 1))) * 4;
        aMax = Math.max(aMax, ant[i + 3]); aSum += ant[i + 3];
      }
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (let k = 0; k < 4; k++) sum += ant[(((y * 2 + (k >> 1)) * la) + (x * 2 + (k & 1))) * 4 + c];
        d[o + c] = Math.round(sum / 4);
      }
      d[o + 3] = Math.round((aMax + aSum / 4) / 2);
    }
    mips.push({ data: d, width: lado, height: lado });
  }
  const m = new THREE.DataTexture(data, TEX, TEX, THREE.RGBAFormat);
  m.mipmaps = mips as unknown as THREE.DataTexture["mipmaps"];
  m.wrapS = m.wrapT = THREE.RepeatWrapping;
  m.magFilter = THREE.LinearFilter; m.minFilter = THREE.LinearMipmapLinearFilter; m.generateMipmaps = false;
  m.anisotropy = 2;
  m.colorSpace = THREE.NoColorSpace;
  m.needsUpdate = true;
  // Z66: color del suelo lejano ≈ visto de lejos: mitad suelo oscuro (todas las celdas × DARKNESS) y mitad briznas
  let sr = 0, sg = 0, sb = 0, br = 0, bg = 0, bb = 0, nb = 0;
  for (let i = 0; i < TEX * TEX * 4; i += 4) {
    sr += data[i]; sg += data[i + 1]; sb += data[i + 2];
    if (data[i + 3] > 0) { br += data[i]; bg += data[i + 1]; bb += data[i + 2]; nb++; }
  }
  const n = TEX * TEX * 255, nbb = Math.max(1, nb) * 255, dk = 0.15;
  const colLejano: [number, number, number] = [
    0.5 * (sr / n) * dk + 0.5 * 0.7 * (br / nbb), 0.5 * (sg / n) * dk + 0.5 * 0.7 * (bg / nbb), 0.5 * (sb / n) * dk + 0.5 * 0.7 * (bb / nbb),
  ];
  return { sinMip: t, conMip: m, colLejano };
}

// uniforms compartidos por los 4 materiales (mismos objetos; cada material tiene su uCuarto)
const COMUN = {
  uP:       { value: new THREE.Vector4() },
  uLuzX:    { value: new THREE.Vector4() },
  uLuzZ:    { value: new THREE.Vector4() },
  uDmax:    { value: new THREE.Vector4(1, 1, 1, 1) },
  uCol:     { value: Array.from({ length: 4 }, () => new THREE.Vector3(1, 1, 1)) },
  uRect:    { value: new THREE.Vector4() },
  uTarima:  { value: new THREE.Vector2(1.8, 1.8) },
  uSillas:  { value: new THREE.Vector4() },   // xmin, zmin, xmax, zmax
  uAlto:    { value: 0.35 },
  uCapas:   { value: 20 },
  uIrr:     { value: 0.6 },
  uMancha:  { value: 1.2 },
  uFrente:  { value: 0.25 },
  uDens:    { value: 110 },
  uVientoA: { value: 0.65 },
  uVientoT: { value: 0 },
  uDark:    { value: 0.15 },
  uPuntas:  { value: 0.8 },
  uBrillo:  { value: 1 },
  uTinte:   { value: 0 },
  uCaida:   { value: 6 },
  uDistMax: { value: 28 },
  uLuzDia:  { value: 1 },
  uOverlay: { value: 0 },
  uRadio:   { value: 1.2 },
  uLejano:  { value: 1 },                          // Z66: 1 = el desvanecimiento va al color lejano (no a negro)
  uColLejano: { value: new THREE.Vector3(0.1, 0.25, 0.08) },   // Z66: color medio de las briznas (sRGB, como la textura)
  uLejanoBrillo: { value: 1 },                     // Z66
};

// Z66: ruido de valor compartido por los dos shaders (réplica exacta de lib/pasto.ts: hashPasto / ruidoPasto)
export const RUIDO_GLSL = /* glsl */`
  float hashP(vec2 p) {
    float a = fract(p.x * 0.1271 + p.y * 0.3113), b = fract(p.y * 0.2177 + p.x * 0.0719);
    return fract((a + b + a * b * 61.7) * 43.13 + a * 17.9);
  }
  float ruidoP(vec2 p) {
    vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
    float a = hashP(i), b = hashP(i + vec2(1.0, 0.0)), c = hashP(i + vec2(0.0, 1.0)), d = hashP(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
  // viento: el mismo campo que Z64 (desplazamiento de la punta en texels, antes de escalar por la altura)
  vec2 vientoP(vec2 xz, float t) {
    return vec2(ruidoP(xz * 0.35 + vec2(t, 0.37 * t)), ruidoP(xz * 0.35 + vec2(5.2 - 0.6 * t, 1.3 + t))) - vec2(0.25);
  }
`;

const VERT = /* glsl */`
  attribute float aH;          // altura relativa de la capa (0…1)
  uniform float uAlto;
  uniform float uVientoT;
  varying vec2  vXZ;
  varying float vH;
  varying float vDist;
  varying vec2  vViento;       // Z66: con VIENTO_VERTICE el campo de viento se interpola desde los vértices
  ${RUIDO_GLSL}
  void main() {
    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    wp.y += aH * uAlto;
    vXZ = wp.xz; vH = aH;
    vDist = distance(wp.xyz, cameraPosition);
  #ifdef VIENTO_VERTICE
    vViento = vientoP(wp.xz, uVientoT);
  #else
    vViento = vec2(0.0);
  #endif
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const FRAG = /* glsl */`
  uniform sampler2D uBriznas;
  uniform vec4  uP, uLuzX, uLuzZ, uDmax, uRect, uSillas;
  uniform vec3  uCol[4];
  uniform vec2  uTarima;
  uniform float uCuarto, uCapas, uIrr, uMancha, uFrente, uDens, uVientoA, uVientoT, uDark, uPuntas, uBrillo, uTinte,
                uCaida, uDistMax, uLuzDia, uOverlay, uRadio, uLejano, uLejanoBrillo;
  uniform vec3  uColLejano;
  varying vec2  vXZ;
  varying float vH;
  varying float vDist;
  varying vec2  vViento;
  ${RUIDO_GLSL}
  float elegir(vec4 v, float i) { return i < 0.5 ? v.x : (i < 1.5 ? v.y : (i < 2.5 ? v.z : v.w)); }
  // brillo del pasto: la sala es oscura; brilla cerca de su luz y con el día
  float luzPasto(float dist) {
    return uBrillo * (0.35 + 0.65 * uLuzDia) * (0.25 + 0.75 * exp(-max(dist - uRadio, 0.0) / max(uCaida, 0.1)));
  }
  void main() {
  #ifdef LEJANO
    if (vDist < uDistMax * 0.55) discard;                 // Z66: de cerca lo tapa el pasto (descarte barato primero)
  #endif
    // 1) en el rectángulo y en SU cuarto (celda de Voronoi): si otra luz está más cerca, no es de este cuarto
    if (vXZ.x < uRect.x || vXZ.y < uRect.y || vXZ.x > uRect.z || vXZ.y > uRect.w) discard;
    vec4 dx = vec4(vXZ.x) - uLuzX, dz = vec4(vXZ.y) - uLuzZ;
    vec4 d2 = dx * dx + dz * dz;
    float mio = elegir(d2, uCuarto);
    if (mio > min(min(d2.x, d2.y), min(d2.z, d2.w)) + 1e-4) discard;
    // 2) ni la tarima ni las sillas
    if (abs(vXZ.x) < uTarima.x && abs(vXZ.y) < uTarima.y) discard;
    if (vXZ.x > uSillas.x && vXZ.x < uSillas.z && vXZ.y > uSillas.y && vXZ.y < uSillas.w) discard;
    float dist = sqrt(mio);
  #ifndef LEJANO
    // overlay de debug: borde de la celda y radio de la luz (en la capa de abajo)
    if (uOverlay > 0.5 && vH < 0.001) {
      float borde = 0.0;
      for (int k = 0; k < 4; k++) { if (float(k) == uCuarto) continue; float o = d2[k]; borde = max(borde, 1.0 - smoothstep(0.0, 1.2, o - mio)); }
      float anillo = 1.0 - smoothstep(0.0, 0.06, abs(dist - uRadio));
      if (borde > 0.1 || anillo > 0.1) { gl_FragColor = vec4(mix(vec3(1.0), uCol[int(uCuarto)], 0.5), 1.0); return; }
    }
  #endif
    // 3) umbral (descarte temprano, antes de leer la textura): visible cuando p > u
    float p = elegir(uP, uCuarto);
    float dn = clamp(dist / max(elegir(uDmax, uCuarto), 0.01), 0.0, 1.0);
    float irr = clamp(uIrr, 0.0, 1.0) * min(1.0, dn / 0.25);
    float kF = 1.0 - clamp(uFrente, 0.0, 1.0);
    float g;
  #ifdef DESCARTE_TEMPRANO
    // Z66: u = mix(dn, mancha, irr)·kF con mancha en 0…1 → u ∈ [dn(1−irr)kF, (dn(1−irr)+irr)kF]. Fuera de esa franja
    // el resultado no depende del ruido: se descarta o se da por crecido sin calcularlo (resultado idéntico).
    float uLo = dn * (1.0 - irr) * kF, uHi = (dn * (1.0 - irr) + irr) * kF;
    if (p <= uLo) discard;
    if (p >= uHi + max(uFrente, 1e-3)) g = 1.0;
    else {
  #endif
      float e = max(uMancha, 0.05);
      float mancha = 0.65 * ruidoP(vXZ / e) + 0.35 * ruidoP(vXZ / (e * 0.45) + vec2(7.3, 2.1));
      float u = mix(dn, clamp(mancha, 0.0, 1.0), irr) * kF;
      g = clamp((p - u) / max(uFrente, 1e-3), 0.0, 1.0);
  #ifdef DESCARTE_TEMPRANO
    }
  #endif
    if (g <= 0.0) discard;
    float luz = luzPasto(dist);
    vec3 lejanoCol = pow(uColLejano, vec3(2.2)) * luz * uLejanoBrillo;
  #ifdef LEJANO
    gl_FragColor = vec4(min(lejanoCol, vec3(0.9)), 1.0);   // Z66: suelo lejano: sin capas ni textura
    return;
  #endif
    float crece = g * g * (3.0 - 2.0 * g);              // altura relativa: las briznas nacen desde el suelo
    float hh = vH / max(crece, 1e-3);                     // altura de esta capa respecto de la brizna crecida
    if (hh > 1.0) discard;
    float lejos = 1.0 - smoothstep(uDistMax * 0.6, uDistMax, vDist);
    if (lejos <= 0.0) discard;
    // 4) brizna (textura) con viento: el desplazamiento crece con la altura (la punta se mueve más)
    vec2 uv = vXZ * uDens / ${TEX.toFixed(1)};
  #ifdef VIENTO_VERTICE
    vec2 w = vViento;
  #else
    vec2 w = vientoP(vXZ, uVientoT);
  #endif
    uv += uVientoA * 3.0 * w * hh * (hh * 0.7 + 0.3) / ${TEX.toFixed(1)};
    vec4 s = texture2D(uBriznas, uv);
    vec3 col;
    if (vH < 0.001) {
      col = s.rgb * uDark;                                 // suelo: la capa de abajo, oscura (como el original)
    } else {
      float tip = min(1.0, hh + 0.2);
      s.rgb = mix(s.rgb, min(vec3(1.0), s.rgb * vec3(16.0, 1.5, 2.8)), uPuntas * pow(tip, 6.0));   // punta rojiza
      float a = s.a * (1.0 - hh);                          // la brizna se afina hacia la punta
      if (smoothstep(0.12, 0.2, a) < 0.5) discard;
      col = s.rgb * mix(hh, 1.0, uDark);                   // oscurece abajo (falsa oclusión)
    }
    // 5) luz y desvanecimiento con la distancia a la cámara (Z66: hacia el color lejano en vez de a negro)
    col = mix(col, col * uCol[int(uCuarto)] * 1.6, clamp(uTinte, 0.0, 1.0));
    col = pow(col, vec3(2.2)) * luz;                       // sRGB → lineal (el compositor vuelve a sRGB al final)
    col = uLejano > 0.5 ? mix(lejanoCol, col, lejos) : col * lejos;
    gl_FragColor = vec4(min(col, vec3(0.9)), 1.0);
  }
`;

/** Monolitos de esta etapa. Z64: solo con DBG_PASTO.MONOLITOS_ACTIVO. Z65: se montan con el visualizador (como antes
 *  de Z64: así la cantidad de luces y los materiales ya están listos y no hay tirón al aparecer) pero quedan bajo el
 *  suelo, invisibles y sin efecto de audio hasta que los 4 cuartos están completos (MONOLITOS_MODO "pasto"); entonces
 *  suben en MONOLITOS_APARICION_S con el reloj de la experiencia. Posición en la línea de la tarima, a MONOLITO_SEP_M del
 *  borde del pasto (lib/monolitosPasto.ts), recalculada cada frame. Se revisa por frame; re-render solo al cambiar. */
export function MonolitosPasto() {
  const [on, setOn] = useState(() => monolitosMontados(DBG_PASTO));
  const ref = useRef(on);
  const T = useRef({ p: { x: 0, z: 0 }, lx: [0, 0, 0, 0], lz: [0, 0, 0, 0], rect: [0, 0, 0, 0] });
  useEffect(() => () => { MONO_PASTO.k = 0; MONO_PASTO.objetivo = false; }, []);   // al desmontar: ocultos (el próximo montaje arranca abajo)
  useFrame(() => {
    const m = monolitosMontados(DBG_PASTO);
    if (m !== ref.current) { ref.current = m; setOn(m); }
    if (!m) { MONO_PASTO.k = 0; MONO_PASTO.objetivo = false; return; }
    const t = T.current;
    for (let i = 0; i < 4; i++) { hazPosXZEn(i, t.p); t.lx[i] = t.p.x; t.lz[i] = t.p.z; }
    rectPasto(t.lx, t.lz, DBG_PASTO.MARGEN_M, t.rect);
    posMonolitosPasto(t.rect, DBG_PASTO.MONOLITO_SEP_M, MONOLITO_ANCHO_M, TARIMA_CENTRO.z, MONO_PASTO);
    MONO_PASTO.objetivo = monolitosObjetivo(DBG_PASTO, PASTO.completo);
    MONO_PASTO.k = avanzarAparicion(MONO_PASTO.k, MONO_PASTO.objetivo, RELOJ.dtExp, DBG_PASTO);
  });
  return on ? <Monoliths pasto /> : null;
}

// Z66: geometría subdividida (viento por vértice cada ~0,4 m): bloque ~4 m → 10 segmentos; rectángulo de Z64 → 64
const SEG_CHUNK = 10, SEG_RECT = 64;
const Y_PASTO = 0.006, Y_LEJANO = 0.0035;   // el suelo lejano queda debajo de la capa de suelo del pasto
const ALTO_MAX_ESFERA = 1.2;                // altura máxima de las briznas (tope del menú) para la bounding sphere

function definesPasto(lejano: boolean): Record<string, string> {
  const R = DBG_RENDIMIENTO, d: Record<string, string> = {};
  if (R.PASTO_VIENTO_BARATO) d.VIENTO_VERTICE = "";
  if (R.PASTO_DESCARTE_TEMPRANO) d.DESCARTE_TEMPRANO = "";
  if (lejano) d.LEJANO = "";
  return d;
}
function claveDefines(): string {
  const R = DBG_RENDIMIENTO;
  return `${R.PASTO_VIENTO_BARATO ? 1 : 0}${R.PASTO_DESCARTE_TEMPRANO ? 1 : 0}`;
}
/** Defines y textura de los materiales (fuera del componente: los materiales son estables, se mutan en el lugar). */
function aplicarDefines(mats: THREE.ShaderMaterial[], lejano: boolean): void {
  for (const m of mats) { m.defines = definesPasto(lejano); m.needsUpdate = true; }
}
function aplicarTextura(mats: THREE.ShaderMaterial[], t: THREE.Texture): void {
  for (const m of mats) m.uniforms.uBriznas.value = t;
}
function marcarCapas(aH: THREE.InstancedBufferAttribute, capas: number): void {
  ordenCapas(capas, aH.array as Float32Array);
  aH.needsUpdate = true;
}
/** Bounding sphere en coordenadas locales de una malla escalada (w, 1, d): three la escala por el mayor eje. */
function esferaBloque(m: THREE.InstancedMesh, w: number, d: number): void {
  const R = Math.hypot(w / 2, d / 2, ALTO_MAX_ESFERA / 2), esc = Math.max(w, d, 1);
  if (!m.boundingSphere) m.boundingSphere = new THREE.Sphere();
  m.boundingSphere.center.set(0, ALTO_MAX_ESFERA / 2, 0);
  m.boundingSphere.radius = R / esc;
}

export default function Pasto() {
  const mallas = useRef<(THREE.InstancedMesh | null)[]>([null, null, null, null]);
  const lejanasRect = useRef<(THREE.InstancedMesh | null)[]>([null, null, null, null]);   // Z66: suelo lejano (modo Z64)
  const mallasChunk = useRef<(THREE.InstancedMesh | null)[]>([]);                        // Z66
  const lejanasChunk = useRef<(THREE.InstancedMesh | null)[]>([]);                       // Z66
  const [chunks, setChunks] = useState<Chunk[]>([]);                                     // Z66: se rearma solo al cambiar el layout
  const capasChunk = useRef<number[]>([]);                                               // Z66: LOD actual de cada bloque
  const tmp = useRef({
    capasHechas: -1, p: { x: 0, z: 0 }, lx: [0, 0, 0, 0], lz: [0, 0, 0, 0], on: [false, false, false, false], rect: [0, 0, 0, 0],
    clave: "", s: { x: 0, z: 0 }, dm: [1, 1, 1, 1],
    claveChunks: "", claveDef: "", texMip: -1,
    lod: { CAPAS: 20, CAPAS_LEJOS: 6, LOD_CERCA_M: 8, LOD_LEJOS_M: 20, DIST_MAX_M: 28 } as CfgLod,
    mat: new THREE.Matrix4(), frustum: new THREE.Frustum(),
  });

  const recursos = useMemo(() => {
    const tex = crearTexturaBriznas();
    const aH = new THREE.InstancedBufferAttribute(new Float32Array(MAX_CAPAS), 1);
    const plano = (seg: number) => {
      const g = new THREE.PlaneGeometry(1, 1, seg, seg);
      g.rotateX(-Math.PI / 2);
      g.setAttribute("aH", aH);   // el mismo atributo en las dos geometrías (orden de capas único)
      return g;
    };
    const geo = plano(SEG_RECT), geoChunk = plano(SEG_CHUNK);
    const mk = (i: number, lejano: boolean) => new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide, defines: definesPasto(lejano),
      uniforms: { ...COMUN, uBriznas: { value: tex.conMip }, uCuarto: { value: i } },
    });
    const mats = [0, 1, 2, 3].map(i => mk(i, false));
    const matsLejano = [0, 1, 2, 3].map(i => mk(i, true));
    COMUN.uColLejano.value.set(tex.colLejano[0], tex.colLejano[1], tex.colLejano[2]);
    return { tex, aH, geo, geoChunk, mats, matsLejano };
  }, []);
  useEffect(() => () => {
    recursos.tex.sinMip.dispose(); recursos.tex.conMip.dispose(); recursos.geo.dispose(); recursos.geoChunk.dispose();
    recursos.mats.forEach(m => m.dispose()); recursos.matsLejano.forEach(m => m.dispose());
  }, [recursos]);

  // botones del menú debug
  useEffect(() => {
    const onCrecer = (e: Event) => completarCuarto(PASTO, Number((e as CustomEvent).detail?.cuarto ?? -1));
    const onTodo = () => { for (let i = 0; i < 4; i++) completarCuarto(PASTO, i); };
    const onReset = () => reiniciarPasto(PASTO);
    window.addEventListener("alight:pasto-crecer", onCrecer);
    window.addEventListener("alight:pasto-completar", onTodo);
    window.addEventListener("alight:pasto-reiniciar", onReset);
    const w = window as unknown as { __pasto?: object };
    if (DEBUG_ENABLED) w.__pasto = { PASTO, DBG_PASTO, PASTO_RENDER };
    PASTO_RENDER.montado = true;   // Z66: lo lee el panel de rendimiento ("Escena de estrés")
    return () => {
      window.removeEventListener("alight:pasto-crecer", onCrecer);
      window.removeEventListener("alight:pasto-completar", onTodo);
      window.removeEventListener("alight:pasto-reiniciar", onReset);
      if (DEBUG_ENABLED) delete w.__pasto;
      PASTO_RENDER.montado = false;
    };
  }, []);

  useFrame((state) => {
    const D = DBG_PASTO, R = DBG_RENDIMIENTO, T = tmp.current, U = COMUN, cam = state.camera;
    for (let i = 0; i < 4; i++) { hazPosXZEn(i, T.p); T.lx[i] = T.p.x; T.lz[i] = T.p.z; T.on[i] = getHazBandOn(i); }
    // estado (reloj de la experiencia: quieto en pausa; dt acotado en lib/pasto.ts)
    avanzarPasto(PASTO, D, RELOJ.dtExp, cam.position.x, cam.position.z, T.lx, T.lz, T.on);
    for (let i = 0; i < 4; i++) if (PASTO.ev[i]) window.dispatchEvent(new CustomEvent("alight:pasto-cuarto", { detail: { cuarto: i, estado: NOMBRES_EV[PASTO.ev[i]] } }));
    // Z65: los 4 cuartos completos → una sola vez (se rearma al reiniciar el pasto)
    if (chequearTodoCompleto(PASTO)) window.dispatchEvent(new CustomEvent("alight:pasto-completo"));
    // geometría de los cuartos: solo cuando cambian las luces o el margen (no por frame)
    rectPasto(T.lx, T.lz, D.MARGEN_M, T.rect);
    const clave = `${T.rect.join(",")}`;
    if (clave !== T.clave) {
      T.clave = clave;
      for (let i = 0; i < 4; i++) T.dm[i] = distMaxCuarto(i, T.lx, T.lz, T.rect);
      U.uDmax.value.set(T.dm[0], T.dm[1], T.dm[2], T.dm[3]);
      U.uRect.value.set(T.rect[0], T.rect[1], T.rect[2], T.rect[3]);
    }
    // Z66: bloques (solo al cambiar el layout o la forma del umbral; el texto se arma solo si cambió algo de eso)
    if (R.PASTO_CHUNKS) {
      const cc = `${clave}|${R.CHUNK_M}|${D.IRREGULARIDAD}|${D.FRENTE_ANCHO}|${D.ESCALA_MANCHA_M}`;
      if (cc !== T.claveChunks) {
        T.claveChunks = cc;
        const lx = T.lx.slice(), lz = T.lz.slice(), dm = T.dm.slice();
        const cuartoEn = (x: number, z: number) => cuartoDe(x, z, lx, lz);
        const lista = armarChunks(T.rect, cuartoEn, R.CHUNK_M);
        for (const ch of lista) {
          const q = ch.cuarto;
          ch.uMin = umbralMinChunk(ch, lx, lz, dm[q], cuartoEn, (x, z, dn) => umbralPasto(dn, manchaPasto(x, z, D.ESCALA_MANCHA_M), D));
        }
        mallasChunk.current = []; lejanasChunk.current = []; capasChunk.current = lista.map(() => -1);
        setChunks(lista);
      }
    }
    // Z66: defines (viento por vértice, descarte temprano) y textura con o sin mipmaps: solo al cambiar
    const cd = claveDefines();
    if (cd !== T.claveDef) {
      T.claveDef = cd;
      aplicarDefines(recursos.mats, false);
      aplicarDefines(recursos.matsLejano, true);
    }
    const texMip = R.PASTO_MIPMAPS ? 1 : 0;
    if (texMip !== T.texMip) {
      T.texMip = texMip;
      const t = texMip ? recursos.tex.conMip : recursos.tex.sinMip;
      aplicarTextura(recursos.mats, t);
    }
    U.uLuzX.value.set(T.lx[0], T.lx[1], T.lx[2], T.lx[3]);
    U.uLuzZ.value.set(T.lz[0], T.lz[1], T.lz[2], T.lz[3]);
    U.uP.value.set(PASTO.p[0], PASTO.p[1], PASTO.p[2], PASTO.p[3]);
    for (let i = 0; i < 4; i++) { const c = hexARgb(DBG_SILLAS[COLOR_KEYS[i]]); U.uCol.value[i].set(c[0], c[1], c[2]); }
    // tarima y sillas: el pasto no las atraviesa (margen 0,2 m)
    U.uTarima.value.set(TARIMA_W / 2 + 0.2, TARIMA_D / 2 + 0.2);
    sillaEn(0, DBG_LAYOUT, T.s); const sx0 = T.s.x, sz = T.s.z; sillaEn(N_SILLAS - 1, DBG_LAYOUT, T.s);
    U.uSillas.value.set(Math.min(sx0, T.s.x) - 0.5, sz - 0.6, Math.max(sx0, T.s.x) + 0.5, sz + 0.6);
    const capas = Math.max(8, Math.min(MAX_CAPAS, Math.round(D.CAPAS)));
    U.uAlto.value = D.ALTURA_M; U.uCapas.value = capas; U.uIrr.value = D.IRREGULARIDAD; U.uMancha.value = D.ESCALA_MANCHA_M;
    U.uFrente.value = D.FRENTE_ANCHO; U.uDens.value = D.DENSIDAD; U.uVientoA.value = D.VIENTO_AMP;
    U.uVientoT.value = (U.uVientoT.value + RELOJ.dtExp * D.VIENTO_VEL) % 1000;   // tiempo propio: quieto en pausa
    U.uDark.value = D.DARKNESS; U.uPuntas.value = D.PUNTAS_TINTE; U.uBrillo.value = D.BRILLO; U.uTinte.value = D.TINTE_LUZ;
    U.uCaida.value = D.CAIDA_LUZ_M; U.uDistMax.value = D.DIST_MAX_M; U.uLuzDia.value = DIA.escena ? DIA.luz : 1;
    U.uOverlay.value = D.OVERLAY ? 1 : 0; U.uRadio.value = D.RADIO_LUZ_M;
    U.uLejano.value = R.PASTO_LEJANO ? 1 : 0; U.uLejanoBrillo.value = R.LEJANO_BRILLO;
    // capas: alturas en orden de prefijo parejo (Z66), solo si cambió la cantidad
    if (T.capasHechas !== capas) {
      T.capasHechas = capas;
      marcarCapas(recursos.aH, capas);
    }
    const sisOn = DBG_RENDIMIENTO.SIS.pasto !== false;   // Z66: interruptor del panel de rendimiento
    let visibles = 0, instancias = 0, lejanas = 0, enCuadro = 0;
    T.mat.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); T.frustum.setFromProjectionMatrix(T.mat);
    // modo Z64: un InstancedMesh por cuarto, del tamaño del rectángulo (el shader recorta la celda); visible con p > 0
    const modoChunks = R.PASTO_CHUNKS;
    for (let i = 0; i < 4; i++) {
      const m = mallas.current[i], ml = lejanasRect.current[i];
      const on = !modoChunks && sisOn && D.ACTIVO && (PASTO.p[i] > 0 || D.OVERLAY);
      if (m) {
        m.visible = on;
        if (on) {
          m.count = capas; visibles++; instancias += capas;
          m.position.set((T.rect[0] + T.rect[2]) / 2, Y_PASTO, (T.rect[1] + T.rect[3]) / 2);
          m.scale.set(T.rect[2] - T.rect[0], 1, T.rect[3] - T.rect[1]);
          enCuadro++;   // frustumCulled = false: siempre se dibuja
        }
      }
      if (ml) {
        ml.visible = on && R.PASTO_LEJANO && PASTO.p[i] > 0;
        if (ml.visible) {
          ml.count = 1; lejanas++;
          ml.position.set((T.rect[0] + T.rect[2]) / 2, Y_LEJANO, (T.rect[1] + T.rect[3]) / 2);
          ml.scale.set(T.rect[2] - T.rect[0], 1, T.rect[3] - T.rect[1]);
        }
      }
    }
    // Z66: bloques: culling por progreso, LOD por distancia (histéresis) y suelo lejano
    if (modoChunks) {
      const L = T.lod;
      L.CAPAS = capas; L.CAPAS_LEJOS = R.CAPAS_LEJOS; L.LOD_CERCA_M = R.LOD_CERCA_M; L.LOD_LEJOS_M = R.LOD_LEJOS_M; L.DIST_MAX_M = D.DIST_MAX_M;
      const ex = cam.position.x, ey = cam.position.y, ez = cam.position.z;
      for (let k = 0; k < chunks.length; k++) {
        const ch = chunks[k], m = mallasChunk.current[k], ml = lejanasChunk.current[k];
        const p = PASTO.p[ch.cuarto];
        const con = sisOn && D.ACTIVO && (D.OVERLAY || (p > 0 && (!R.PASTO_CULL_PROGRESO || chunkConPasto(p, ch.uMin))));
        const d = distOjoChunk(ch, ex, ey, ez, D.ALTURA_M);
        const prev = capasChunk.current[k] ?? -1;
        const nc = !R.PASTO_LOD ? capas : capasLod(d, prev < 0 ? capas : prev, L, R.LOD_HISTERESIS_M);
        capasChunk.current[k] = nc;
        if (m) {
          m.visible = con && nc > 0;
          if (m.visible) {
            m.count = nc; visibles++; instancias += nc;
            if (T.frustum.intersectsObject(m)) enCuadro++;
          }
        }
        if (ml) {
          // el suelo lejano solo hace falta en bloques que llegan a la zona de desvanecimiento
          const dLejos = Math.hypot(Math.max(Math.abs(ex - ch.x0), Math.abs(ex - ch.x1)), Math.max(Math.abs(ez - ch.z0), Math.abs(ez - ch.z1)));
          ml.visible = con && R.PASTO_LEJANO && p > 0 && dLejos > D.DIST_MAX_M * 0.55;
          if (ml.visible) { ml.count = 1; lejanas++; }
        }
      }
    }
    PASTO_RENDER.modo = modoChunks ? "bloques" : "Z64";
    PASTO_RENDER.chunks = modoChunks ? chunks.length : 4;
    PASTO_RENDER.mallasVisibles = visibles; PASTO_RENDER.instancias = instancias; PASTO_RENDER.enCuadro = enCuadro; PASTO_RENDER.lejanas = lejanas;
  });

  return (
    <>
      {[0, 1, 2, 3].map(i => (
        <instancedMesh key={i} ref={el => { mallas.current[i] = el; }} args={[recursos.geo, recursos.mats[i], MAX_CAPAS]}
          frustumCulled={false} renderOrder={2} visible={false} />
      ))}
      {[0, 1, 2, 3].map(i => (
        <instancedMesh key={`l${i}`} ref={el => { lejanasRect.current[i] = el; }} args={[recursos.geo, recursos.matsLejano[i], 1]}
          frustumCulled={false} renderOrder={1} visible={false} />
      ))}
      {/* Z66: bloques (uno por bloque y cuarto) con su bounding sphere: el frustum culling de three los saltea */}
      {chunks.map((ch, k) => (
        <instancedMesh key={`c${k}`} args={[recursos.geoChunk, recursos.mats[ch.cuarto], MAX_CAPAS]}
          ref={el => { mallasChunk.current[k] = el; if (el) esferaBloque(el, ch.w, ch.d); }}
          position={[ch.cx, Y_PASTO, ch.cz]} scale={[ch.w, 1, ch.d]} renderOrder={2} visible={false} />
      ))}
      {chunks.map((ch, k) => (
        <instancedMesh key={`cl${k}`} args={[recursos.geoChunk, recursos.matsLejano[ch.cuarto], 1]}
          ref={el => { lejanasChunk.current[k] = el; if (el) esferaBloque(el, ch.w, ch.d); }}
          position={[ch.cx, Y_LEJANO, ch.cz]} scale={[ch.w, 1, ch.d]} renderOrder={1} visible={false} />
      ))}
    </>
  );
}
