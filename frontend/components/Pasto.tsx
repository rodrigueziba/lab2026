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
// También: los monolitos de esta etapa (DBG_PASTO.MONOLITOS_ACTIVO) y el evento alight:pasto-cuarto.

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { DBG_PASTO, DBG_SILLAS, DBG_LAYOUT, DEBUG_ENABLED } from "@/lib/debugConfig";
import { PASTO, avanzarPasto, reiniciarPasto, completarCuarto, rectPasto, distMaxCuarto, NOMBRES_EV } from "@/lib/pasto";
import { hazPosXZEn, getHazBandOn } from "@/lib/haz";
import { hexARgb, DIA } from "@/lib/cicloDia";
import { RELOJ } from "@/lib/relojExperiencia";
import { sillaEn, N_SILLAS } from "@/lib/layoutSala";
import { TARIMA_W, TARIMA_D } from "./Tarima";
import Monoliths from "./Monoliths";

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
function crearTexturaBriznas(): THREE.DataTexture {
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
  return t;
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
};

const VERT = /* glsl */`
  attribute float aH;          // altura relativa de la capa (0…1)
  uniform float uAlto;
  varying vec2  vXZ;
  varying float vH;
  varying float vDist;
  void main() {
    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    wp.y += aH * uAlto;
    vXZ = wp.xz; vH = aH;
    vDist = distance(wp.xyz, cameraPosition);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const FRAG = /* glsl */`
  uniform sampler2D uBriznas;
  uniform vec4  uP, uLuzX, uLuzZ, uDmax, uRect, uSillas;
  uniform vec3  uCol[4];
  uniform vec2  uTarima;
  uniform float uCuarto, uCapas, uIrr, uMancha, uFrente, uDens, uVientoA, uVientoT, uDark, uPuntas, uBrillo, uTinte,
                uCaida, uDistMax, uLuzDia, uOverlay, uRadio;
  varying vec2  vXZ;
  varying float vH;
  varying float vDist;
  // ruido de valor propio (réplica exacta de lib/pasto.ts: hashPasto / ruidoPasto / manchaPasto)
  float hashP(vec2 p) {
    float a = fract(p.x * 0.1271 + p.y * 0.3113), b = fract(p.y * 0.2177 + p.x * 0.0719);
    return fract((a + b + a * b * 61.7) * 43.13 + a * 17.9);
  }
  float ruidoP(vec2 p) {
    vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
    float a = hashP(i), b = hashP(i + vec2(1.0, 0.0)), c = hashP(i + vec2(0.0, 1.0)), d = hashP(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
  float elegir(vec4 v, float i) { return i < 0.5 ? v.x : (i < 1.5 ? v.y : (i < 2.5 ? v.z : v.w)); }
  void main() {
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
    // overlay de debug: borde de la celda y radio de la luz (en la capa de abajo)
    if (uOverlay > 0.5 && vH < 0.001) {
      float borde = 0.0;
      for (int k = 0; k < 4; k++) { if (float(k) == uCuarto) continue; float o = d2[k]; borde = max(borde, 1.0 - smoothstep(0.0, 1.2, o - mio)); }
      float anillo = 1.0 - smoothstep(0.0, 0.06, abs(dist - uRadio));
      if (borde > 0.1 || anillo > 0.1) { gl_FragColor = vec4(mix(vec3(1.0), uCol[int(uCuarto)], 0.5), 1.0); return; }
    }
    // 3) umbral (descarte temprano, antes de leer la textura): visible cuando p > u
    float p = elegir(uP, uCuarto);
    float dn = clamp(dist / max(elegir(uDmax, uCuarto), 0.01), 0.0, 1.0);
    float e = max(uMancha, 0.05);
    float mancha = 0.65 * ruidoP(vXZ / e) + 0.35 * ruidoP(vXZ / (e * 0.45) + vec2(7.3, 2.1));
    float irr = clamp(uIrr, 0.0, 1.0) * min(1.0, dn / 0.25);
    float u = mix(dn, clamp(mancha, 0.0, 1.0), irr) * (1.0 - clamp(uFrente, 0.0, 1.0));
    float g = clamp((p - u) / max(uFrente, 1e-3), 0.0, 1.0);
    if (g <= 0.0) discard;
    float crece = g * g * (3.0 - 2.0 * g);              // altura relativa: las briznas nacen desde el suelo
    float hh = vH / max(crece, 1e-3);                     // altura de esta capa respecto de la brizna crecida
    if (hh > 1.0) discard;
    // 4) brizna (textura) con viento: el desplazamiento crece con la altura (la punta se mueve más)
    vec2 uv = vXZ * uDens / ${TEX.toFixed(1)};
    vec2 w = vec2(ruidoP(vXZ * 0.35 + vec2(uVientoT, 0.37 * uVientoT)), ruidoP(vXZ * 0.35 + vec2(5.2 - 0.6 * uVientoT, 1.3 + uVientoT))) - vec2(0.25);
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
    // 5) luz: la sala es oscura; brilla cerca de su luz y con el día; se apaga con la distancia a la cámara
    col = mix(col, col * uCol[int(uCuarto)] * 1.6, clamp(uTinte, 0.0, 1.0));
    float luz = uBrillo * (0.35 + 0.65 * uLuzDia) * (0.25 + 0.75 * exp(-max(dist - uRadio, 0.0) / max(uCaida, 0.1)));
    float lejos = 1.0 - smoothstep(uDistMax * 0.6, uDistMax, vDist);
    if (lejos <= 0.0) discard;
    col = pow(col, vec3(2.2)) * luz * lejos;               // sRGB → lineal (el compositor vuelve a sRGB al final)
    gl_FragColor = vec4(min(col, vec3(0.9)), 1.0);
  }
`;

/** Monolitos de esta etapa: solo con DBG_PASTO.MONOLITOS_ACTIVO (se revisa por frame, re-render solo al cambiar). */
export function MonolitosPasto() {
  const [on, setOn] = useState(DBG_PASTO.MONOLITOS_ACTIVO);
  const ref = useRef(on);
  useFrame(() => { if (DBG_PASTO.MONOLITOS_ACTIVO !== ref.current) { ref.current = DBG_PASTO.MONOLITOS_ACTIVO; setOn(ref.current); } });
  return on ? <Monoliths /> : null;
}

export default function Pasto() {
  const mallas = useRef<(THREE.InstancedMesh | null)[]>([null, null, null, null]);
  const tmp = useRef({ capasHechas: -1, p: { x: 0, z: 0 }, lx: [0, 0, 0, 0], lz: [0, 0, 0, 0], on: [false, false, false, false], rect: [0, 0, 0, 0], clave: "", s: { x: 0, z: 0 } });

  const recursos = useMemo(() => {
    const tex = crearTexturaBriznas();
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    geo.setAttribute("aH", new THREE.InstancedBufferAttribute(new Float32Array(MAX_CAPAS), 1));
    const mats = [0, 1, 2, 3].map(i => new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide,
      uniforms: { ...COMUN, uBriznas: { value: tex }, uCuarto: { value: i } },
    }));
    return { tex, geo, mats };
  }, []);
  useEffect(() => () => { recursos.tex.dispose(); recursos.geo.dispose(); recursos.mats.forEach(m => m.dispose()); }, [recursos]);

  // botones del menú debug
  useEffect(() => {
    const onCrecer = (e: Event) => completarCuarto(PASTO, Number((e as CustomEvent).detail?.cuarto ?? -1));
    const onTodo = () => { for (let i = 0; i < 4; i++) completarCuarto(PASTO, i); };
    const onReset = () => reiniciarPasto(PASTO);
    window.addEventListener("alight:pasto-crecer", onCrecer);
    window.addEventListener("alight:pasto-completar", onTodo);
    window.addEventListener("alight:pasto-reiniciar", onReset);
    const w = window as unknown as { __pasto?: object };
    if (DEBUG_ENABLED) w.__pasto = { PASTO, DBG_PASTO };
    return () => {
      window.removeEventListener("alight:pasto-crecer", onCrecer);
      window.removeEventListener("alight:pasto-completar", onTodo);
      window.removeEventListener("alight:pasto-reiniciar", onReset);
      if (DEBUG_ENABLED) delete w.__pasto;
    };
  }, []);

  useFrame((state) => {
    const D = DBG_PASTO, T = tmp.current, U = COMUN;
    for (let i = 0; i < 4; i++) { hazPosXZEn(i, T.p); T.lx[i] = T.p.x; T.lz[i] = T.p.z; T.on[i] = getHazBandOn(i); }
    // estado (reloj de la experiencia: quieto en pausa; dt acotado en lib/pasto.ts)
    avanzarPasto(PASTO, D, RELOJ.dtExp, state.camera.position.x, state.camera.position.z, T.lx, T.lz, T.on);
    for (let i = 0; i < 4; i++) if (PASTO.ev[i]) window.dispatchEvent(new CustomEvent("alight:pasto-cuarto", { detail: { cuarto: i, estado: NOMBRES_EV[PASTO.ev[i]] } }));
    // geometría de los cuartos: solo cuando cambian las luces o el margen (no por frame)
    rectPasto(T.lx, T.lz, D.MARGEN_M, T.rect);
    const clave = `${T.rect.join(",")}`;
    if (clave !== T.clave) {
      T.clave = clave;
      const dm = [0, 1, 2, 3].map(i => distMaxCuarto(i, T.lx, T.lz, T.rect));
      U.uDmax.value.set(dm[0], dm[1], dm[2], dm[3]);
      U.uRect.value.set(T.rect[0], T.rect[1], T.rect[2], T.rect[3]);
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
    // mallas: un InstancedMesh por cuarto, del tamaño del rectángulo (el shader recorta la celda); visible con p > 0
    for (let i = 0; i < 4; i++) {
      const m = mallas.current[i]; if (!m) continue;
      m.visible = D.ACTIVO && (PASTO.p[i] > 0 || D.OVERLAY);
      if (!m.visible) continue;
      m.count = capas;
      m.position.set((T.rect[0] + T.rect[2]) / 2, 0.006, (T.rect[1] + T.rect[3]) / 2);
      m.scale.set(T.rect[2] - T.rect[0], 1, T.rect[3] - T.rect[1]);
    }
    // capas: alturas (solo si cambió la cantidad)
    if (T.capasHechas !== capas) {
      T.capasHechas = capas;
      const aH = recursos.geo.getAttribute("aH") as THREE.InstancedBufferAttribute;
      for (let k = 0; k < MAX_CAPAS; k++) (aH.array as Float32Array)[k] = k < capas ? k / (capas - 1) : 1;
      aH.needsUpdate = true;
    }
  });

  return (
    <>
      {[0, 1, 2, 3].map(i => (
        <instancedMesh key={i} ref={el => { mallas.current[i] = el; }} args={[recursos.geo, recursos.mats[i], MAX_CAPAS]}
          frustumCulled={false} renderOrder={2} visible={false} />
      ))}
    </>
  );
}
