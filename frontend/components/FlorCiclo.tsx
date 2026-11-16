"use client";
// Z54: flor del ciclo de día (siguiendo el video de referencia del usuario): tallo grueso en S que se balancea,
// cabeza con 28 pétalos ovalados en dos anillos (16 + 12) que se abren y cierran como si respirara, estambres en
// el centro que asoman al abrirse, y un degradado térmico (azul marino → rojo → naranja → lima) que recorre
// pétalos y tallo y cambia con el tiempo.
// Nace donde aterrizó el prisma (x = z = 0, base sobre la tarima) y sigue lib/prismaFlor.ts (FLOR: escala,
// apertura, tallo, cabeza), que calcula AmanecerReloj con el ciclo de día. Barato: un solo material compartido
// (ShaderMaterial, color emisivo, sin luces), el tallo es un TubeGeometry y los pétalos y estambres son
// InstancedMesh con matrices fijas; la apertura, el balanceo y el color van en el vertex/fragment shader con
// uniforms. Opaco, con profundidad normal. Sin geometría por frame ni allocations; se libera al desmontar.

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { DBG_FLOR, DEBUG_ENABLED } from "@/lib/debugConfig";
import { FLOR, crearEstadoRoll, avanzarRoll, anguloRoll } from "@/lib/prismaFlor";
import { DIA } from "@/lib/cicloDia";
import { RELOJ } from "@/lib/relojExperiencia";
import { BAND_STATE } from "@/lib/vizAudio";
import { TARIMA_H } from "./Tarima";

const N_AFUERA = 16, N_ADENTRO = 12, N_ESTAMBRES = 10;
const ALTO_TALLO = 0.8;            // fracción de ALTURA_M que es tallo (el resto, la cabeza)
const ANCHO_REF_M = 2.7;           // Z57: alto de Z54. El ancho de la S y el grosor del tallo se miden con este alto fijo:
                                   // al bajar ALTURA_M la S se comprime solo en vertical (no se angosta ni adelgaza)
const PUNTA_X = 0.03;              // x de la punta de la curva normalizada (ver CURVA)
// pétalo: elipsoide (ancho, grosor, largo) en metros para una cabeza de radio 0,9 (ESCALA 1)
const PET_W = 0.27, PET_T = 0.22, PET_L = 0.52;   // bulbosos, como el video

const UNIFORMS = {
  uT:        { value: 0 },
  uAp:       { value: 0 },          // apertura efectiva (con respiración y música)
  uBaseY:    { value: TARIMA_H },
  uAltoTallo:{ value: 2 },
  uBal:      { value: 0.12 },
  uBalW:     { value: 1 },
  uColVel:   { value: 0.08 },
  uPaleta:   { value: 0 },
  uBrillo:   { value: 1 },
  // Z60: fases acumuladas (sin saltos al cambiar velocidades), giro, ola y dorso
  uColFase:  { value: 0 },          // vueltas del degradado (COLOR_VEL acumulado)
  uTalloFase:{ value: 0 },          // vueltas del degradado en el tallo (COLOR_TALLO_VEL acumulado)
  uTalloOn:  { value: 1 },
  uRoll:     { value: 0 },          // ángulo de giro de la cabeza (rad) para el color
  uAcople:   { value: 0.7 },
  uDorso:    { value: 0.8 },
  uOlaFase:  { value: 0 },
  uOlaAmp:   { value: 0 },          // rad (× escala de la flor)
  uOlaDesf:  { value: 0.35 },       // retraso por pétalo (rad) según su distancia al frente del giro
  uGiro:     { value: 0 },          // giro lento de la cabeza (rad): ubica cada pétalo respecto del frente del giro
  uOlaCapas: { value: 1 },
};
const ROLL = crearEstadoRoll();   // Z60: fases del giro, la ola y el color (estado de módulo; persiste entre montajes)

const VERT = /* glsl */`
  uniform float uT, uAp, uBaseY, uAltoTallo, uBal, uBalW;
  uniform float uOlaFase, uOlaAmp, uOlaCapas, uOlaDesf, uGiro;
  varying vec3  vN;
  varying vec3  vV;
  varying float vU;
  varying float vTallo;    // Z60: 1 en el tallo
  varying float vCara;     // Z60: > 0 cara del pétalo (adentro de la copa), < 0 dorso
  varying float vOla;      // Z60: ola de este pétalo (−1…1)
#ifdef USE_INSTANCING
  attribute float aCapa;   // 0 pétalo de afuera, 1 de adentro, 2 estambre
  attribute float aFase;
  attribute float aK;      // Z60: índice del pétalo dentro de su anillo (0…n−1)
#endif
  void main() {
    vec3 p = position;
    vec3 n = normal;
    vTallo = 0.0; vCara = 1.0; vOla = 0.0;
#ifdef USE_INSTANCING
    if (aCapa < 1.5) {
      // pétalo: esfera unidad → elipsoide con la base en el origen, a lo largo de +z
      float W = ${PET_W.toFixed(3)} * (aCapa > 0.5 ? 0.8 : 1.0), T = ${PET_T.toFixed(3)}, L = ${PET_L.toFixed(3)} * (aCapa > 0.5 ? 0.78 : 1.0);
      float lz = (p.z + 1.0) * 0.5;
      vCara = n.y;   // Z60: la cara +y de la esfera queda hacia adentro de la copa (arriba con el pétalo abierto)
      vU = lz * 0.55 + aFase * 0.12 + aCapa * 0.18;
      p = vec3(p.x * W, p.y * T, lz * L);
      n = normalize(vec3(n.x / W, n.y / T, n.z / (0.5 * L)));
      // apertura: ángulo desde la vertical (cerrado ≈ hacia arriba, abierto ≈ casi horizontal)
      float phi = aCapa > 0.5 ? mix(0.10, 0.80, uAp) : mix(0.28, 1.15, uAp);   // copa: abierta ≈ 66° desde la vertical
      // Z60: ola de apertura atada al giro: cos(fase) abre (cara arriba, plana) y cierra (cara abajo, copa); cada
      // pétalo se retrasa DESFASE por pétalo de distancia al frente del giro (la ola va del frente hacia atrás por
      // los dos lados del anillo, sin costura); la capa interior en contrafase (PETALO_OLA_CAPAS)
      float nAn = aCapa > 0.5 ? ${N_ADENTRO.toFixed(1)} : ${N_AFUERA.toFixed(1)};
      float azK = aK / nAn * 6.2831853 + (aCapa > 0.5 ? 3.14159265 / nAn : 0.0) + uGiro;
      float dAz = abs(mod(azK, 6.2831853) - 3.14159265);   // distancia angular al frente (az = π → −Z del giro)
      vOla = cos(uOlaFase - uOlaDesf * dAz * nAn / 6.2831853 + aCapa * 3.14159265 * uOlaCapas);
      phi = clamp(phi + uOlaAmp * vOla, 0.04, 1.62);
      float a = phi - 1.5707963;
      float ca = cos(a), sa = sin(a);
      p = vec3(p.x, ca * p.y - sa * p.z, sa * p.y + ca * p.z);
      n = vec3(n.x, ca * n.y - sa * n.z, sa * n.y + ca * n.z);
    } else {
      // estambre: cilindro de y ∈ [0, 1], asoma con la apertura
      vU = (p.y + 0.5) * 0.4 + 0.75;
      p = vec3(p.x, (p.y + 0.5) * 0.34 * (0.25 + 0.75 * uAp), p.z);
      float a = -0.35 * uAp, ca = cos(a), sa = sin(a);
      p = vec3(p.x, ca * p.y - sa * p.z, sa * p.y + ca * p.z);
    }
    vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.0);
    vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * n);
#else
    // tallo: balanceo en el mundo, más fuerte hacia la punta
    vec4 wp = modelMatrix * vec4(p, 1.0);
    float yN = clamp((wp.y - uBaseY) / max(uAltoTallo, 1e-3), 0.0, 1.0);
    vU = yN * 1.3;
    vTallo = 1.0;
    float s = yN * yN;
    wp.x += uBal * sin(uT * uBalW) * s;
    wp.z += uBal * 0.6 * cos(uT * uBalW * 0.7) * s;
    vN = normalize(mat3(modelMatrix) * n);
#endif
    vV = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const FRAG = /* glsl */`
  uniform float uT, uColVel, uPaleta, uBrillo;
  uniform float uColFase, uTalloFase, uTalloOn, uRoll, uAcople, uDorso;
  varying vec3  vN;
  varying vec3  vV;
  varying float vU;
  varying float vTallo;
  varying float vCara;
  varying float vOla;
  // degradado térmico del video: azul marino → rojo → naranja → lima (y de vuelta), y la paleta del proyecto
  vec3 termico(float m) {
    vec3 a = mix(vec3(0.07, 0.08, 0.36), vec3(0.122, 0.498, 0.722), uPaleta);   // azul marino · #1F7FB8
    vec3 b = mix(vec3(0.95, 0.07, 0.03), vec3(0.753, 0.333, 0.184), uPaleta);   // rojo · óxido #C0552F
    vec3 c = mix(vec3(1.00, 0.40, 0.08), vec3(0.941, 0.455, 0.165), uPaleta);   // naranja · #F0742A
    vec3 d = mix(vec3(0.72, 0.86, 0.24), vec3(0.957, 0.714, 0.180), uPaleta);   // lima · amarillo #F4B62E
    vec3 col = mix(a, b, smoothstep(0.0, 0.35, m));
    col = mix(col, c, smoothstep(0.35, 0.65, m));
    return mix(col, d, smoothstep(0.65, 1.0, m));
  }
  void main() {
    // Z60: fases acumuladas (antes uT·uColVel). En el tallo, bandas que suben (COLOR_TALLO_VEL); en la cabeza el
    // degradado sigue al giro y a la ola (COLOR_ACOPLE) y el dorso de los pétalos tira a azul marino (DORSO_AZUL)
    float fase = vTallo > 0.5 ? mix(uColFase, uTalloFase, uTalloOn) : uColFase - uAcople * (uRoll / 6.2831853 + 0.12 * vOla);
    float x = fract(vU - fase);
    float m = 1.0 - abs(2.0 * x - 1.0);
    float dorso = (1.0 - vTallo) * smoothstep(0.15, -0.45, vCara) * uDorso;
    m = mix(m, m * 0.18, dorso);
    vec3 col = termico(m);
    // volumen suave: más oscuro hacia los bordes (como el video), sin luces reales
    float nv = max(dot(normalize(vN), normalize(vV)), 0.0);
    col *= 0.35 + 0.65 * pow(nv, 0.6);
    gl_FragColor = vec4(min(col * uBrillo, vec3(0.9)), 1.0);
  }
`;

// curva del tallo normalizada (alto 1, forma de S)
const CURVA = [[0, 0], [0.10, 0.18], [0.07, 0.38], [-0.06, 0.58], [-0.04, 0.78], [PUNTA_X, 1.0]] as const;

export default function FlorCiclo() {
  const grupo = useRef<THREE.Group>(null);
  const tallo = useRef<THREE.Mesh>(null);
  const cabeza = useRef<THREE.Group>(null);
  const rodar = useRef<THREE.Group>(null);   // Z60: padre de la cabeza; gira sobre un eje horizontal por su centro
  const petalos = useRef<THREE.InstancedMesh>(null);
  const estambres = useRef<THREE.InstancedMesh>(null);
  const giro = useRef(0);

  const recursos = useMemo(() => {
    const curva = new THREE.CatmullRomCurve3(CURVA.map(([x, y]) => new THREE.Vector3(x, y, 0)));
    const geoTallo = new THREE.TubeGeometry(curva, 64, 0.07, 14, false);
    const geoPetalo = new THREE.SphereGeometry(1, 18, 12);
    geoPetalo.setAttribute("aCapa", new THREE.InstancedBufferAttribute(new Float32Array(N_AFUERA + N_ADENTRO).map((_, i) => (i < N_AFUERA ? 0 : 1)), 1));
    geoPetalo.setAttribute("aFase", new THREE.InstancedBufferAttribute(new Float32Array(N_AFUERA + N_ADENTRO).map((_, i) => (i * 0.618) % 1), 1));
    geoPetalo.setAttribute("aK", new THREE.InstancedBufferAttribute(new Float32Array(N_AFUERA + N_ADENTRO).map((_, i) => (i < N_AFUERA ? i : i - N_AFUERA)), 1));   // Z60
    const geoEstambre = new THREE.CylinderGeometry(0.02, 0.012, 1, 6);
    geoEstambre.setAttribute("aCapa", new THREE.InstancedBufferAttribute(new Float32Array(N_ESTAMBRES).fill(2), 1));
    geoEstambre.setAttribute("aFase", new THREE.InstancedBufferAttribute(new Float32Array(N_ESTAMBRES), 1));
    geoEstambre.setAttribute("aK", new THREE.InstancedBufferAttribute(new Float32Array(N_ESTAMBRES), 1));   // Z60
    const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: UNIFORMS });
    return { geoTallo, geoPetalo, geoEstambre, mat };
  }, []);
  useEffect(() => () => {
    recursos.geoTallo.dispose(); recursos.geoPetalo.dispose(); recursos.geoEstambre.dispose(); recursos.mat.dispose();
  }, [recursos]);
  // Z60: diagnóstico (Chrome headless): fases del giro, solo con el menú debug habilitado
  useEffect(() => {
    const w = window as unknown as { __florRoll?: object };
    if (DEBUG_ENABLED) w.__florRoll = ROLL;
    return () => { if (DEBUG_ENABLED) delete w.__florRoll; };
  }, []);

  // matrices fijas de pétalos (anillos) y estambres (una vez)
  useEffect(() => {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), t = new THREE.Vector3(), y = new THREE.Vector3(0, 1, 0);
    const P = petalos.current, E = estambres.current;
    if (P) {
      for (let i = 0; i < N_AFUERA + N_ADENTRO; i++) {
        const afuera = i < N_AFUERA, k = afuera ? i : i - N_AFUERA, n = afuera ? N_AFUERA : N_ADENTRO;
        const az = (k / n) * Math.PI * 2 + (afuera ? 0 : Math.PI / n);
        const r = afuera ? 0.2 : 0.1;
        q.setFromAxisAngle(y, az);
        t.set(Math.sin(az) * r, afuera ? 0 : 0.04, Math.cos(az) * r);
        P.setMatrixAt(i, m.compose(t, q, s));
      }
      P.instanceMatrix.needsUpdate = true;
    }
    if (E) {
      for (let i = 0; i < N_ESTAMBRES; i++) {
        const az = (i / N_ESTAMBRES) * Math.PI * 2;
        q.setFromAxisAngle(y, az);
        t.set(Math.sin(az) * 0.05, 0.02, Math.cos(az) * 0.05);
        E.setMatrixAt(i, m.compose(t, q, s));
      }
      E.instanceMatrix.needsUpdate = true;
    }
  }, []);

  useFrame(() => {
    const g = grupo.current, T = tallo.current, C = cabeza.current, Rd = rodar.current;
    if (!g || !T || !C || !Rd) return;
    const vis = FLOR.activo && DIA.escena && FLOR.escala > 0.001;
    g.visible = vis;
    if (!vis) return;
    const D = DBG_FLOR;
    const t = RELOJ.tExp;   // reloj de la experiencia: con la pausa la flor queda quieta
    const H = Math.max(0.2, D.ALTURA_M * D.ALTURA_FACTOR) * FLOR.escala;   // Z57: alto efectivo = ALTURA_M × ALTURA_FACTOR
    const HA = ANCHO_REF_M * FLOR.escala;                                     // Z57: ancho de la S y grosor del tallo
    const altoTallo = H * ALTO_TALLO * Math.max(0.001, FLOR.tallo);
    const U = UNIFORMS;
    U.uT.value = t;
    U.uBaseY.value = TARIMA_H;
    U.uAltoTallo.value = altoTallo;
    U.uBal.value = D.BALANCEO_M * FLOR.escala;
    U.uBalW.value = (Math.PI * 2) / Math.max(0.5, D.BALANCEO_S);
    U.uColVel.value = D.COLOR_VEL;
    U.uPaleta.value = D.PALETA_PROYECTO;
    U.uBrillo.value = D.BRILLO;
    // Z60: giro, ola y color (fases acumuladas con el reloj de la experiencia: quietas en pausa; × escala)
    avanzarRoll(ROLL, D, RELOJ.dtExp, FLOR.escala, Math.max(BAND_STATE.normEnergy[0] ?? 0, BAND_STATE.normEnergy[1] ?? 0));
    const roll = anguloRoll(ROLL, D);
    U.uColFase.value = ROLL.color;
    U.uTalloFase.value = ROLL.tallo;
    U.uTalloOn.value = D.COLOR_TALLO_ACTIVO ? 1 : 0;
    U.uRoll.value = roll;
    U.uAcople.value = D.COLOR_ACOPLE;
    U.uDorso.value = D.DORSO_AZUL;
    // la ola sigue al ángulo de giro (abierta con la cara arriba, copa con la cara abajo); sin giro, su propia fase
    U.uOlaFase.value = D.ROLL_CABEZA_ACTIVO ? roll : ROLL.ola;
    U.uOlaAmp.value = D.PETALO_OLA_ACTIVO ? ((D.PETALO_OLA_AMP_DEG * Math.PI) / 180) * FLOR.escala : 0;
    U.uOlaDesf.value = D.PETALO_OLA_DESFASE;
    U.uOlaCapas.value = D.PETALO_OLA_CAPAS ? 1 : 0;
    // apertura: la de la línea de tiempo × respiración + graves (gancho, 0 por defecto)
    const resp = 1 - D.RESPIRACION_AMP * (0.5 + 0.5 * Math.sin((t * Math.PI * 2) / Math.max(0.5, D.RESPIRACION_S)));
    const graves = Math.max(BAND_STATE.normEnergy[0] ?? 0, BAND_STATE.normEnergy[1] ?? 0);
    U.uAp.value = Math.min(1, FLOR.apertura * resp + D.MUSICA_APERTURA * graves * FLOR.apertura);
    // tallo: escala (sin recrear geometría); x/z con el ancho de referencia (no con el alto: Z57) para que la S no se
    // aplaste al crecer ni se angoste al bajar la altura
    T.position.set(0, TARIMA_H, 0);
    const grosor = Math.max(0.2, D.GROSOR_TALLO);   // Z60: el grosor escala x/z (la S se angosta con él)
    T.scale.set(HA * ALTO_TALLO * grosor, altoTallo, HA * ALTO_TALLO * grosor);
    // cabeza en la punta del tallo, con el mismo balanceo que el shader (yN = 1)
    const w = U.uBalW.value;
    Rd.position.set(PUNTA_X * HA * ALTO_TALLO * grosor + U.uBal.value * Math.sin(t * w), TARIMA_H + altoTallo, U.uBal.value * 0.6 * Math.cos(t * w * 0.7));
    // diámetro de la cabeza abierta (copa) ≈ 1,2 m × 1,45 ≈ 1,75 m (ancho de la base del prisma) con ESCALA 1
    C.scale.setScalar(Math.max(1e-4, 1.45 * Math.max(0.1, D.ESCALA) * Math.max(0.1, D.ESCALA_CABEZA) * FLOR.escala * Math.max(0.001, FLOR.cabeza)));
    giro.current += RELOJ.dtExp * (D.GIRO_DEG_S * Math.PI) / 180;   // reloj de la experiencia: quieto en pausa
    U.uGiro.value = giro.current % (Math.PI * 2);   // Z60: la ola se mide desde el frente del giro
    // Z60: la cabeza rueda: una sola rotación del padre (orden YXZ: Y orienta el eje, X es el giro). Signo −: con
    // SENTIDO 1 la parte de arriba va hacia −Z (las sillas) con EJE 0
    Rd.rotation.set(-roll, (D.ROLL_CABEZA_EJE_DEG * Math.PI) / 180, 0);
    C.rotation.set(Math.sin(t * 0.3) * (D.INCLINACION_DEG * Math.PI) / 180, giro.current, Math.cos(t * 0.23) * (D.INCLINACION_DEG * Math.PI) / 360);
  });

  return (
    <group ref={grupo} visible={false}>
      <mesh ref={tallo} geometry={recursos.geoTallo} material={recursos.mat} frustumCulled={false} />
      <group ref={rodar} rotation-order="YXZ">
        <group ref={cabeza}>
          <instancedMesh ref={petalos} args={[recursos.geoPetalo, recursos.mat, N_AFUERA + N_ADENTRO]} frustumCulled={false} />
          <instancedMesh ref={estambres} args={[recursos.geoEstambre, recursos.mat, N_ESTAMBRES]} frustumCulled={false} />
        </group>
      </group>
    </group>
  );
}
