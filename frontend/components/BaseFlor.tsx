"use client";
// Z67: base de la flor sobre la tarima: la flor sale de un hueco con grietas alrededor, astillas levantadas en el borde
// y una mata de pasto corto que oculta el punto de contacto del tallo. Todo nace y desaparece con la flor (FLOR.escala
// de lib/prismaFlor.ts; progresos en lib/baseFlor.ts). Cuatro mallas, un draw call cada una:
//  · hueco: paredes cortas (PROFUNDIDAD_M) + fondo, una sola geometría; degradado a negro, borde interno más claro y un
//    resplandor del color térmico de la flor. La cara superior de la tarima se descarta adentro del mismo borde
//    irregular (Tarima.tsx, onBeforeCompile con HUECO_U): es un hueco real, no un disco pintado.
//  · grietas: decal plano apenas sobre la tarima (polygonOffset), grietas procedurales quebradas con ramas (semilla fija)
//    que se propagan desde el hueco al nacer y se cierran al desaparecer.
//  · astillas: InstancedMesh con el material de la tarima, en el borde del hueco; escalan con su apertura.
//  · pasto: capas ("shells") con la textura de briznas de Pasto.tsx, centradas en el tallo, crecimiento irregular.
// Sin allocations por frame; geometrías, materiales y textura se liberan al desmontar. visible = false sin flor.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { DBG_BASE_FLOR, DBG_PASTO, DEBUG_ENABLED, DBG_RENDIMIENTO } from "@/lib/debugConfig";
import { FLOR } from "@/lib/prismaFlor";
import { DIA } from "@/lib/cicloDia";
import { RELOJ } from "@/lib/relojExperiencia";
import { BASE, HUECO_U, RADIO_HUECO_GLSL, avanzarBase, reiniciarBase, colorTermico, mBaseTallo, aleatorio } from "@/lib/baseFlor";
import { TARIMA_H, materialTarima } from "./Tarima";
import { FLOR_UNIFORMS } from "./FlorCiclo";
import { crearTexturaBriznas, RUIDO_GLSL } from "./Pasto";

const NSEG = 64;            // segmentos del borde del hueco
const MAX_ASTILLAS = 24;
const MAX_CAPAS = 16;
const TEX = 256;            // = Pasto.tsx

// ── hueco: paredes (aFondo 0) y fondo (aFondo 1) en coordenadas unitarias; el shader aplica el borde irregular ──
function crearGeoHueco(): THREE.BufferGeometry {
  const pos: number[] = [], fondo: number[] = [], idx: number[] = [];
  for (let i = 0; i <= NSEG; i++) {
    const a = (i / NSEG) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    pos.push(c, 0, s, c, -1, s); fondo.push(0, 0);
  }
  for (let i = 0; i < NSEG; i++) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  const c0 = pos.length / 3;
  pos.push(0, -1, 0); fondo.push(1);
  for (let i = 0; i <= NSEG; i++) { const a = (i / NSEG) * Math.PI * 2; pos.push(Math.cos(a), -1, Math.sin(a)); fondo.push(1); }
  for (let i = 0; i < NSEG; i++) idx.push(c0, c0 + 2 + i, c0 + 1 + i);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aFondo", new THREE.Float32BufferAttribute(fondo, 1));
  g.setIndex(idx);
  return g;
}

const U = {   // uniforms compartidos por las mallas de la base
  uHuecoR:   HUECO_U.uHuecoR, uHuecoIrr: HUECO_U.uHuecoIrr, uHuecoSemilla: HUECO_U.uHuecoSemilla,
  uProf:     { value: 0.25 },
  uBaseY:    { value: TARIMA_H },
  uGlow:     { value: new THREE.Vector3(1, 0.4, 0.08) },   // color térmico de la base del tallo (lineal)
  uGlowK:    { value: 0 },                                  // BRILLO_BORDE × escala de la flor
  uLuz:      { value: 1 },
  // grietas
  uN:        { value: 9 },
  uRg:       { value: 1.3 },
  uAncho:    { value: 0.022 },
  uIrr:      { value: 0.6 },
  uProg:     { value: 0 },
  uOverlay:  { value: 0 },
  // pasto de la base
  uPastoR:   { value: 0.6 },
  uPastoP:   { value: 0 },
  uAlto:     { value: 0.28 },
  uDens:     { value: 110 },
  uMancha:   { value: 1.2 },
  uFrente:   { value: 0.25 },
  uIrrP:     { value: 0.6 },
  uVientoA:  { value: 0.65 },
  uVientoT:  { value: 0 },
  uDark:     { value: 0.15 },
  uPuntas:   { value: 0.8 },
  uBrillo:   { value: 1 },
};

const HUECO_VERT = /* glsl */`
  attribute float aFondo;
  uniform float uHuecoR, uHuecoIrr, uHuecoSemilla, uProf, uBaseY;
  varying float vT;
  varying float vFondo;
  ${RADIO_HUECO_GLSL}
  void main() {
    // el centro del fondo (x = z = 0) no tiene ángulo: atan(0, 0) no está definido
    float r = length(position.xz) < 1e-4 ? 0.0 : radioHueco(atan(position.z, position.x), uHuecoR, uHuecoIrr, uHuecoSemilla);
    vec3 p = vec3(position.x * r, uBaseY + position.y * uProf, position.z * r);
    vT = -position.y; vFondo = aFondo;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
`;
const HUECO_FRAG = /* glsl */`
  uniform vec3 uGlow;
  uniform float uGlowK, uLuz;
  varying float vT;
  varying float vFondo;
  void main() {
    // pared: marrón rojizo oscuro de la tarima arriba → negro en profundidad; borde interno un poco más claro
    vec3 madera = pow(vec3(0.29, 0.14, 0.08), vec3(2.2)) * uLuz;
    vec3 col = madera * (1.0 - smoothstep(0.0, 0.75, sqrt(vT)));
    col += madera * 0.8 * (1.0 - smoothstep(0.0, 0.07, vT));
    col += uGlow * uGlowK * pow(1.0 - vT, 3.0) * 1.4;      // resplandor del color de la flor junto al borde
    col = mix(col, vec3(0.004, 0.002, 0.002), vFondo);     // fondo casi negro
    gl_FragColor = vec4(min(col, vec3(0.9)), 1.0);
  }
`;

const GRIETAS_VERT = /* glsl */`
  varying vec2 vXZ;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vXZ = wp.xz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const GRIETAS_FRAG = /* glsl */`
  uniform float uHuecoR, uHuecoIrr, uHuecoSemilla, uN, uRg, uAncho, uIrr, uProg, uOverlay, uGlowK, uLuz;
  uniform vec3 uGlow;
  varying vec2 vXZ;
  ${RADIO_HUECO_GLSL}
  float h1(float n) { return fract(sin(n * 127.1 + uHuecoSemilla * 31.7) * 43758.5453); }
  // desvío lateral quebrado: lineal entre nudos cada 0,11 m (forma de línea quebrada, no curva)
  float zig(float r, float id) {
    float x = r / 0.11, i = floor(x);
    return mix(h1(id * 17.3 + i), h1(id * 17.3 + i + 1.0), fract(x)) * 2.0 - 1.0;
  }
  void main() {
    float r = length(vXZ), phi = atan(vXZ.y, vXZ.x);
    float rh = radioHueco(phi, uHuecoR, uHuecoIrr, uHuecoSemilla);
    if (r < rh) discard;                                   // adentro está el hueco
    float px = max(fwidth(r), 1e-4);
    float c = 0.0, borde = 0.0, oscuro = 0.0;
    for (int i = 0; i < 24; i++) {
      float fi = float(i);
      if (fi >= uN) break;
      float th = 6.2831853 * (fi + 0.4 * (h1(fi) - 0.5)) / uN;
      float largo = uRg * (0.55 + 0.45 * h1(fi + 3.0));
      float vis = rh + (largo - rh) * clamp(uProg * (1.1 - 0.25 * h1(fi + 9.0)), 0.0, 1.0);   // cada una con su ritmo
      if (r > vis) continue;
      float ang = mod(phi - th + 3.1415927, 6.2831853) - 3.1415927;
      if (abs(ang) > 1.6) continue;                        // del otro lado: lejos
      float lado = r * ang;                                // distancia lateral a la recta radial (m)
      float desv = uIrr * 0.07 * zig(r, fi) * smoothstep(0.0, 0.25, r - rh);
      float t = clamp((r - rh) / max(largo - rh, 1e-3), 0.0, 1.0);
      float w = uAncho * pow(1.0 - t, 0.8) + 0.0015;        // ancha y oscura junto al hueco, fina al alejarse
      float d = abs(lado - desv);
      float k = 1.0 - smoothstep(0.5 * w, 0.5 * w + px, d);
      c = max(c, k); oscuro = max(oscuro, k * mix(0.95, 0.6, t));
      borde = max(borde, (1.0 - smoothstep(0.5 * w + px, 0.5 * w + 0.006 + px, d)) * (1.0 - k) * (1.0 - t));
      // dos ramas por grieta: salen de un punto de la principal y se abren hacia un lado
      for (int j = 0; j < 2; j++) {
        float fj = float(j), hb = h1(fi * 3.1 + fj + 21.0);
        float rb = rh + (largo - rh) * (0.25 + 0.4 * hb), lb = (largo - rh) * (0.2 + 0.25 * h1(fi + fj * 7.0 + 31.0));
        if (r < rb || r > min(rb + lb, vis)) continue;
        float sg = fj < 0.5 ? 1.0 : -1.0;
        float desvB = uIrr * 0.07 * zig(rb, fi) + sg * (r - rb) * (0.45 + 0.5 * hb) + uIrr * 0.03 * zig(r, fi + 40.0 + fj);
        float tb = (r - rb) / max(lb, 1e-3);
        float wb = (uAncho * 0.55) * pow(1.0 - tb, 0.9) + 0.001;
        float db = abs(lado - desvB);
        float kb = 1.0 - smoothstep(0.5 * wb, 0.5 * wb + px, db);
        c = max(c, kb); oscuro = max(oscuro, kb * mix(0.85, 0.55, max(t, tb)));
      }
    }
    // resplandor de la flor junto al borde del hueco (y dentro de las grietas cercanas)
    float g = uGlowK * exp(-(r - rh) / 0.07) * (0.5 + 0.5 * c);
    vec3 col = mix(pow(vec3(0.42, 0.2, 0.12), vec3(2.2)) * uLuz, vec3(0.012, 0.006, 0.004), step(0.001, c));
    float a = max(oscuro, borde * 0.28);
    float fade = smoothstep(0.0, 0.12, uProg);
    col = col * a * fade + uGlow * g;                      // premultiplicado
    a = clamp(a * fade + g, 0.0, 1.0);
    if (uOverlay > 0.5) {
      float o = max(1.0 - smoothstep(0.0, 0.008, abs(r - rh)), 1.0 - smoothstep(0.0, 0.008, abs(r - uRg)));
      col = mix(col, vec3(0.2, 1.0, 0.6), o); a = max(a, o);
    }
    if (a < 0.002) discard;
    gl_FragColor = vec4(col, a);   // premultiplicado (blending CustomBlending ONE, ONE_MINUS_SRC_ALPHA)
  }
`;

const PASTO_VERT = /* glsl */`
  attribute float aH;
  uniform float uAlto, uBaseY;
  varying vec2 vXZ;
  varying float vH;
  void main() {
    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    wp.y = uBaseY + 0.004 + aH * uAlto;
    vXZ = wp.xz; vH = aH;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
// réplica de la forma del pasto de los cuartos (umbral = mezcla de distancia y manchas, briznas, viento, punta
// rojiza, oscurecimiento abajo), con el centro en el tallo en vez de en una luz
const PASTO_FRAG = /* glsl */`
  uniform sampler2D uBriznas;
  uniform float uHuecoR, uHuecoIrr, uHuecoSemilla, uPastoR, uPastoP, uDens, uMancha, uFrente, uIrrP, uVientoA, uVientoT,
                uDark, uPuntas, uBrillo, uLuz;
  varying vec2 vXZ;
  varying float vH;
  ${RUIDO_GLSL}
  ${RADIO_HUECO_GLSL}
  void main() {
    float r = length(vXZ);
    if (r > uPastoR * 1.2) discard;
    float rh = radioHueco(atan(vXZ.y, vXZ.x), uHuecoR, uHuecoIrr, uHuecoSemilla);
    if (r < rh * (vH < 0.001 ? 1.0 : 0.7)) discard;       // el suelo no tapa el hueco; las briznas asoman por el borde
    float dn = clamp((r - rh * 0.7) / max(uPastoR - rh * 0.7, 0.05), 0.0, 1.0);
    float e = max(uMancha, 0.05);
    float mancha = 0.65 * ruidoP(vXZ / e + vec2(3.1, 8.7)) + 0.35 * ruidoP(vXZ / (e * 0.45) + vec2(7.3, 2.1));
    float irr = clamp(uIrrP, 0.0, 1.0) * min(1.0, dn / 0.25);
    float u = mix(dn, clamp(mancha, 0.0, 1.0), irr) * (1.0 - clamp(uFrente, 0.0, 1.0));
    if (dn >= 1.0) discard;
    float g = clamp((uPastoP - u) / max(uFrente, 1e-3), 0.0, 1.0);
    if (g <= 0.0) discard;
    float crece = g * g * (3.0 - 2.0 * g);
    float hh = vH / max(crece, 1e-3);
    if (hh > 1.0) discard;
    vec2 uv = vXZ * uDens / ${TEX.toFixed(1)};
    uv += uVientoA * 3.0 * vientoP(vXZ, uVientoT) * hh * (hh * 0.7 + 0.3) / ${TEX.toFixed(1)};
    vec4 s = texture2D(uBriznas, uv);
    vec3 col;
    if (vH < 0.001) {
      col = s.rgb * uDark;
    } else {
      float tip = min(1.0, hh + 0.2);
      s.rgb = mix(s.rgb, min(vec3(1.0), s.rgb * vec3(16.0, 1.5, 2.8)), uPuntas * pow(tip, 6.0));
      float a = s.a * (1.0 - hh);
      if (smoothstep(0.12, 0.2, a) < 0.5) discard;
      col = s.rgb * mix(hh, 1.0, uDark);
    }
    col = pow(col, vec3(2.2)) * uBrillo * uLuz;
    gl_FragColor = vec4(min(col, vec3(0.9)), 1.0);
  }
`;

export default function BaseFlor() {
  const hueco = useRef<THREE.Mesh>(null);
  const grietas = useRef<THREE.Mesh>(null);
  const astillas = useRef<THREE.InstancedMesh>(null);
  const pasto = useRef<THREE.InstancedMesh>(null);
  const tmp = useRef({ clave: "", capas: -1, col: [0, 0, 0], m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), p: new THREE.Vector3(), s: new THREE.Vector3() });

  const recursos = useMemo(() => {
    const geoHueco = crearGeoHueco();
    const matHueco = new THREE.ShaderMaterial({ vertexShader: HUECO_VERT, fragmentShader: HUECO_FRAG, uniforms: U, side: THREE.DoubleSide });
    const geoGrietas = new THREE.PlaneGeometry(2, 2);
    geoGrietas.rotateX(-Math.PI / 2);
    const matGrietas = new THREE.ShaderMaterial({
      vertexShader: GRIETAS_VERT, fragmentShader: GRIETAS_FRAG, uniforms: U, transparent: true, depthWrite: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    const geoAstilla = new THREE.BoxGeometry(0.1, 0.1, 0.1);   // chica: nunca llega a la cara superior del descarte del hueco
    const tex = crearTexturaBriznas();
    const geoPasto = new THREE.PlaneGeometry(1, 1);
    geoPasto.rotateX(-Math.PI / 2);
    geoPasto.setAttribute("aH", new THREE.InstancedBufferAttribute(new Float32Array(MAX_CAPAS), 1));
    const matPasto = new THREE.ShaderMaterial({
      vertexShader: PASTO_VERT, fragmentShader: PASTO_FRAG, side: THREE.DoubleSide,
      uniforms: { ...U, uBriznas: { value: tex.conMip } },
    });
    return { geoHueco, matHueco, geoGrietas, matGrietas, geoAstilla, tex, geoPasto, matPasto };
  }, []);
  useEffect(() => () => {
    const R = recursos;
    R.geoHueco.dispose(); R.matHueco.dispose(); R.geoGrietas.dispose(); R.matGrietas.dispose(); R.geoAstilla.dispose();
    R.tex.sinMip.dispose(); R.tex.conMip.dispose(); R.geoPasto.dispose(); R.matPasto.dispose();
    HUECO_U.uHuecoR.value = 0;   // la tarima vuelve a ser entera
    reiniciarBase(BASE);
  }, [recursos]);
  useEffect(() => {
    const onReiniciar = () => reiniciarBase(BASE);
    window.addEventListener("alight:base-flor-reiniciar", onReiniciar);
    const w = window as unknown as { __baseFlor?: object };
    if (DEBUG_ENABLED) w.__baseFlor = { BASE, HUECO_U, DBG_BASE_FLOR };
    return () => { window.removeEventListener("alight:base-flor-reiniciar", onReiniciar); if (DEBUG_ENABLED) delete w.__baseFlor; };
  }, []);

  useFrame(() => {
    const D = DBG_BASE_FLOR, T = tmp.current;
    // (con la flor apagada en el panel de rendimiento tampoco hay hueco: si no, la tarima quedaría abierta)
    const hay = D.ACTIVO && FLOR.activo && DIA.escena && FLOR.escala > 0.001 && DBG_RENDIMIENTO.SIS.flor !== false;
    avanzarBase(BASE, hay ? FLOR.escala : 0, RELOJ.dtExp);
    const H = hueco.current, G = grietas.current, A = astillas.current, P = pasto.current;
    if (!H || !G || !A || !P) return;
    if (!hay) {
      H.visible = G.visible = A.visible = P.visible = false;
      HUECO_U.uHuecoR.value = 0;
      return;
    }
    // hueco (también lo usa la tarima para descartar su cara de arriba)
    const rh = Math.max(0, D.RADIO_HUECO_M) * BASE.hueco;
    HUECO_U.uHuecoR.value = rh; HUECO_U.uHuecoIrr.value = D.IRREGULARIDAD; HUECO_U.uHuecoSemilla.value = D.SEMILLA;
    U.uProf.value = Math.max(0.01, D.PROFUNDIDAD_M);
    U.uLuz.value = 0.35 + 0.65 * (DIA.escena ? DIA.luz : 1);
    // resplandor: color de la base del tallo (fase de color del tallo, como el shader de la flor), en lineal
    const FU = FLOR_UNIFORMS;
    const fase = FU.uTalloOn.value > 0.5 ? FU.uTalloFase.value : FU.uColFase.value;
    colorTermico(mBaseTallo(fase), FU.uPaleta.value, T.col);
    const lin = FU.uLineal.value > 0.5;
    U.uGlow.value.set(lin ? T.col[0] ** 2.2 : T.col[0], lin ? T.col[1] ** 2.2 : T.col[1], lin ? T.col[2] ** 2.2 : T.col[2]);
    U.uGlowK.value = Math.max(0, D.BRILLO_BORDE) * FLOR.escala;
    H.visible = rh > 0.001;
    // grietas
    const rg = Math.max(0.1, D.RADIO_GRIETAS_M);
    U.uN.value = Math.max(0, Math.min(24, Math.round(D.N_GRIETAS))); U.uRg.value = rg; U.uAncho.value = Math.max(0, D.ANCHO_GRIETA);
    U.uIrr.value = D.IRREGULARIDAD; U.uProg.value = BASE.grietas; U.uOverlay.value = D.OVERLAY ? 1 : 0;
    G.visible = BASE.grietas > 0.001 || D.OVERLAY;
    G.position.set(0, TARIMA_H + 0.002, 0); G.scale.set(rg * 1.05, 1, rg * 1.05);
    // astillas: matrices solo al cambiar la cantidad o la semilla (para un hueco de radio 1; el grupo escala con el hueco)
    const n = Math.max(0, Math.min(MAX_ASTILLAS, Math.round(D.ASTILLAS)));
    const clave = `${n}|${D.SEMILLA}`;
    if (clave !== T.clave) {
      T.clave = clave;
      const rnd = aleatorio(D.SEMILLA);
      for (let i = 0; i < n; i++) {
        const a = (i / Math.max(1, n)) * Math.PI * 2 + (rnd() - 0.5) * 0.6, rr = 1.05 + rnd() * 0.35;
        T.p.set(Math.cos(a) * rr, 0.08 + rnd() * 0.12, Math.sin(a) * rr);
        T.e.set((0.25 + rnd() * 0.45) * (rnd() < 0.5 ? 1 : -1), -a + (rnd() - 0.5) * 0.8, (rnd() - 0.5) * 0.5, "YXZ");
        T.q.setFromEuler(T.e);
        T.s.set(2.5 + rnd() * 2.5, 0.5 + rnd() * 0.6, 1.2 + rnd() * 1.4);   // × geometría de 0,1 (en radios del hueco)
        A.setMatrixAt(i, T.m.compose(T.p, T.q, T.s));
      }
      A.count = n;
      A.instanceMatrix.needsUpdate = true;
    }
    A.visible = n > 0 && rh > 0.01;
    A.position.set(0, TARIMA_H, 0); A.scale.setScalar(Math.max(1e-3, rh));
    // pasto de la base
    const capas = Math.max(2, Math.min(MAX_CAPAS, Math.round(D.PASTO_CAPAS)));
    if (capas !== T.capas) {
      T.capas = capas;
      const aH = recursos.geoPasto.getAttribute("aH") as THREE.InstancedBufferAttribute;
      for (let k = 0; k < MAX_CAPAS; k++) (aH.array as Float32Array)[k] = k < capas ? k / (capas - 1) : 1;
      aH.needsUpdate = true;
    }
    const Pr = Math.max(0.1, D.PASTO_RADIO_M);
    U.uPastoR.value = Pr; U.uPastoP.value = BASE.pasto; U.uAlto.value = Math.max(0.02, D.PASTO_ALTURA_M);
    const DP = DBG_PASTO;   // mismo aspecto que el pasto de los cuartos
    U.uDens.value = DP.DENSIDAD; U.uMancha.value = Math.min(DP.ESCALA_MANCHA_M, Pr); U.uFrente.value = DP.FRENTE_ANCHO; U.uIrrP.value = DP.IRREGULARIDAD;
    U.uVientoA.value = DP.VIENTO_AMP; U.uVientoT.value = (U.uVientoT.value + RELOJ.dtExp * DP.VIENTO_VEL) % 1000;
    U.uDark.value = DP.DARKNESS; U.uPuntas.value = DP.PUNTAS_TINTE; U.uBrillo.value = DP.BRILLO;
    P.visible = D.PASTO_ACTIVO && BASE.pasto > 0.001;
    P.count = capas;
    P.position.set(0, 0, 0); P.scale.set(Pr * 2.4, 1, Pr * 2.4);
  });

  return (
    <>
      <mesh ref={hueco} geometry={recursos.geoHueco} material={recursos.matHueco} frustumCulled={false} visible={false} />
      <mesh ref={grietas} geometry={recursos.geoGrietas} material={recursos.matGrietas} renderOrder={3} visible={false} />
      <instancedMesh ref={astillas} args={[recursos.geoAstilla, materialTarima(), MAX_ASTILLAS]} visible={false} />
      <instancedMesh ref={pasto} args={[recursos.geoPasto, recursos.matPasto, MAX_CAPAS]} frustumCulled={false} renderOrder={2} visible={false} />
    </>
  );
}
