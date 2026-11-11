"use client";
// Z30: cielo estrellado procedural del camino LUZ (shader de lib/luz/estrellasCielo.glsl.ts, adaptado de
// "Nightsky Shader Elective" de tmoe1354, Shadertoy WcjGRz, CC BY-NC-SA 3.0; ver CREDITOS.md).
// Una esfera grande que sigue a la cámara, BackSide + aditiva, sin fog ni profundidad propia.
// uReveal = rampa por distancia a la luz (ESTRELLAS_DIST_INICIO_M → ESTRELLAS_DIST_PLENO_M, smoothstep +
// exponente) con inercia temporal; se atenúa dentro del área con el visualizador o en las secuencias
// SILLAS/TARIMA. Orden de dibujo: renderOrder 10 como la luz de Z28 (después del caparazón del domo y
// de DomeSky, que no escriben profundidad); con ESTRELLAS_DEPTH_TEST las paredes y objetos la tapan.
// Lo monta LuzLejana. uTime se escribe solo acá, una vez por frame.
//
// Z31: (1) recorte en "caja": no era el far (radio 300 < far 1000) ni las subdivisiones ni el culling; eran
// el techo (y=22) y las paredes cerradas, que escriben profundidad y con depthTest tapaban el cielo (sus
// aristas son los bordes rectos/diagonales que cambian al girar). Ahora el shader v2 dibuja el cielo en el
// plano lejano (z = w·0.9999) y, mientras el cielo está visible, techo y paredes dejan de escribir
// profundidad (ESTRELLAS_SALA_SIN_PROFUNDIDAD): cielo continuo, pero tarima, prisma, público, telón y
// piso siguen tapándolo. (2) reveal relativo al spawn: 0 en el spawn, 1 bajo la luz (revealPorDistancia).
//
// Z32: cambios de tono ("caja"): con blending aditivo el cielo se SUMABA sobre superficies de tonos
// distintos (caparazón violáceo, techo más oscuro, fondo #0a0812 en el hueco junto a las paredes
// abiertas) y cada una dejaba su tono. Ahora (ESTRELLAS_COBERTURA) la salida es premultiplicada con
// cobertura (v3) y CustomBlending One / OneMinusSrcAlpha: el cielo reemplaza lo de atrás según uReveal.
// Orden: renderOrder −0.5 → después de DomeSky (−1) y del caparazón (que pasa de 0 a −1 SOLO mientras el
// cielo es visible) y antes de todo transparente con 0 (telón, prisma, paneles, iconos) y de la luz (10).

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { DBG_LUZ } from "@/lib/debugConfig";
import { LUZ_STATE, CIELO_STATE, revealPorDistancia } from "@/lib/caminoLuz";
import { INTERACT_STATE, PANELES_SILLAS, isVizActivated } from "@/lib/alightStore";
import { PAUSA } from "@/lib/pausaExperiencia";
import { ESTRELLAS_VERT, ESTRELLAS_FRAG } from "@/lib/luz/estrellasCielo.glsl";

const CIELO_R_FAR = 0.9;   // Z31: radio = 0.9 · camera.far (era 300 fijo); el vertex v2 lo lleva al plano lejano

// uniforms de módulo (mismo patrón que CONO_UNIFORMS / DOME_SHELL_UNIFORMS)
const CIELO_UNIFORMS = {
  uTime:           { value: 0 },
  uReveal:         { value: 0 },
  uBrillo:         { value: DBG_LUZ.ESTRELLAS_U_BRILLO },
  uDensidad:       { value: DBG_LUZ.ESTRELLAS_U_DENSIDAD },
  uTwinkle:        { value: DBG_LUZ.ESTRELLAS_U_TWINKLE },
  uPan:            { value: DBG_LUZ.ESTRELLAS_U_PAN },
  uTinteHorizonte: { value: new THREE.Color(DBG_LUZ.ESTRELLAS_TINTE_HORIZONTE) },
  uCapas:          { value: DBG_LUZ.ESTRELLAS_CALIDAD },
  uTope:           { value: DBG_LUZ.ESTRELLAS_TOPE },
  uCobertura:      { value: DBG_LUZ.ESTRELLAS_COBERTURA ? 1 : 0 },   // Z32
};

const RO_CIELO_COBERTURA = -0.5;   // Z32: entre fondos (−1) y transparentes (0)
const RO_CIELO_ADITIVO   = 10;     // Z30/Z31: como la luz
const RO_CASCARON_CIELO  = -1;     // Z32: caparazón mientras el cielo es visible (igual que DomeSky; desempata por id)
const RO_CASCARON_BASE   = 0;      // valor original del caparazón (sin prop renderOrder en ExperienceDome)

export default function CieloEstrellado() {
  const { camera, scene } = useThree();
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef  = useRef<THREE.ShaderMaterial>(null);
  const st = useRef({
    t: 0,
    tinte: DBG_LUZ.ESTRELLAS_TINTE_HORIZONTE,
    techo: null as THREE.Mesh | null,
    paredes: [] as THREE.Material[],   // Z31: materiales de las 4 paredes (se buscan una vez)
    paredesBuscadas: false,
    cascaron: null as THREE.Object3D | null,   // Z32
    buscarT: 2,
    cobertura: !DBG_LUZ.ESTRELLAS_COBERTURA,   // fuerza la primera aplicación del blending
  });
  const radio = useMemo(() => CIELO_R_FAR * ((camera as THREE.PerspectiveCamera).far || 1000), [camera]);

  // al desmontar: techo y paredes vuelven a escribir profundidad
  useEffect(() => {
    const s = st.current;
    return () => {
      const m = s.techo?.material as THREE.Material | undefined;
      if (m) m.depthWrite = true;
      for (const pm of s.paredes) pm.depthWrite = true;
      if (s.cascaron) s.cascaron.renderOrder = RO_CASCARON_BASE;   // Z32
      s.cascaron = null;
      s.techo = null;
      s.paredes.length = 0;
      s.paredesBuscadas = false;
      CIELO_STATE.reveal = 0;
    };
  }, []);

  useFrame((_, dt) => {
    const s = st.current;
    // ── tiempo: un solo lugar, una vez por frame ──
    if (!(DBG_LUZ.ESTRELLAS_CONGELAR_EN_PAUSA && PAUSA.activa)) s.t += dt;
    CIELO_UNIFORMS.uTime.value = s.t;

    // ── techo y paredes (búsqueda una sola vez; la profundidad se decide al final del frame) ──
    if (!s.techo) s.techo = (scene.getObjectByName("room-ceiling") as THREE.Mesh | undefined) ?? null;
    if (!s.paredesBuscadas) {
      const g = scene.getObjectByName("room-walls");
      if (g) {
        s.paredesBuscadas = true;
        for (const c of g.children) {
          const mm = (c as THREE.Mesh).material;
          if (mm && !Array.isArray(mm)) s.paredes.push(mm);
        }
      }
    }
    const on = DBG_LUZ.CAMINO_LUZ && !DBG_LUZ.ESTRELLAS_MODO_VIEJO;

    const mesh = meshRef.current;
    if (!mesh) return;
    if (!on) {
      mesh.visible = false; CIELO_STATE.reveal = 0; CIELO_STATE.objetivo = 0;
      aplicarProfundidadSala(s, false, false);
      if (s.cascaron) s.cascaron.renderOrder = RO_CASCARON_BASE;
      return;
    }

    // ── reveal objetivo ──
    let obj: number;
    if (DBG_LUZ.ESTRELLAS_MODO_Z30) {
      // Z30: inicio absoluto
      obj = revealPorDistancia(LUZ_STATE.dLuz, DBG_LUZ.ESTRELLAS_DIST_INICIO_M, 0, DBG_LUZ.ESTRELLAS_DIST_PLENO_M,
        DBG_LUZ.ESTRELLAS_CURVA, DBG_LUZ.ESTRELLAS_REVEAL_MAX);
    } else {
      // Z31: relativo al spawn (0 en el spawn y más lejos; 1 en el radio del diálogo)
      obj = revealPorDistancia(LUZ_STATE.dLuz, LUZ_STATE.dSpawn, DBG_LUZ.ESTRELLAS_MARGEN_INICIO_M,
        DBG_LUZ.ESTRELLAS_DIST_PLENO_M, DBG_LUZ.ESTRELLAS_CURVA, DBG_LUZ.ESTRELLAS_REVEAL_MAX);
      // con el diálogo activo (giro + terminal) el cielo queda completo
      if (LUZ_STATE.fase === "girando" || LUZ_STATE.fase === "dialogo") obj = DBG_LUZ.ESTRELLAS_REVEAL_MAX;
    }
    if (DBG_LUZ.ESTRELLAS_SOLO_FUERA) {
      const borde = Math.max(Math.abs(camera.position.x), Math.abs(camera.position.z));
      obj *= THREE.MathUtils.smoothstep(borde, DBG_LUZ.SALA_MEDIA_M - 2, DBG_LUZ.SALA_MEDIA_M + 2);
    }
    CIELO_STATE.objetivo = obj;

    // ── atenuación: dentro del área con visualizador o en secuencias SILLAS/TARIMA ──
    const enSecuencia = isVizActivated()
      || PANELES_SILLAS.camino !== "none"
      || INTERACT_STATE.experienceState === "sillas_secuencia"
      || INTERACT_STATE.experienceState === "sala_activa";
    const atenObj = !LUZ_STATE.fuera && enSecuencia ? DBG_LUZ.ESTRELLAS_ATENUAR_EN_VISUALIZADOR : 1;

    // ── inercia (exponencial, independiente de los fps) ──
    CIELO_STATE.aten   += (atenObj - CIELO_STATE.aten) * (1 - Math.exp(-dt / Math.max(0.01, DBG_LUZ.ESTRELLAS_ATEN_TRANS_S)));
    CIELO_STATE.reveal += (obj - CIELO_STATE.reveal) * (1 - Math.exp(-dt / Math.max(0.01, DBG_LUZ.ESTRELLAS_INERCIA_S)));
    if (obj === 0 && CIELO_STATE.reveal < 0.002) CIELO_STATE.reveal = 0;   // Z31: vuelve a 0 exacto
    let r = CIELO_STATE.reveal * CIELO_STATE.aten;
    if (DBG_LUZ.ESTRELLAS_FORZAR_REVEAL >= 0) r = Math.min(1, DBG_LUZ.ESTRELLAS_FORZAR_REVEAL);

    // ── uniforms en vivo ──
    CIELO_UNIFORMS.uReveal.value   = r;
    CIELO_UNIFORMS.uBrillo.value   = DBG_LUZ.ESTRELLAS_U_BRILLO;
    CIELO_UNIFORMS.uDensidad.value = DBG_LUZ.ESTRELLAS_U_DENSIDAD;
    CIELO_UNIFORMS.uTwinkle.value  = DBG_LUZ.ESTRELLAS_U_TWINKLE;
    CIELO_UNIFORMS.uPan.value      = DBG_LUZ.ESTRELLAS_U_PAN;
    CIELO_UNIFORMS.uCapas.value    = DBG_LUZ.ESTRELLAS_CALIDAD;
    CIELO_UNIFORMS.uTope.value     = DBG_LUZ.ESTRELLAS_TOPE;
    if (s.tinte !== DBG_LUZ.ESTRELLAS_TINTE_HORIZONTE) {
      s.tinte = DBG_LUZ.ESTRELLAS_TINTE_HORIZONTE;
      CIELO_UNIFORMS.uTinteHorizonte.value.set(s.tinte);
    }
    const mat = matRef.current;
    if (mat && mat.depthTest !== DBG_LUZ.ESTRELLAS_DEPTH_TEST) mat.depthTest = DBG_LUZ.ESTRELLAS_DEPTH_TEST;

    // ── Z32: blending (cobertura vs aditivo) y orden de dibujo; solo escribe si cambia ──
    const cob = DBG_LUZ.ESTRELLAS_COBERTURA;
    if (mat && s.cobertura !== cob) {
      s.cobertura = cob;
      if (cob) {
        mat.blending = THREE.CustomBlending;
        mat.blendEquation = THREE.AddEquation;
        mat.blendSrc = THREE.OneFactor;
        mat.blendDst = THREE.OneMinusSrcAlphaFactor;
      } else {
        mat.blending = THREE.AdditiveBlending;
      }
      CIELO_UNIFORMS.uCobertura.value = cob ? 1 : 0;
      mesh.renderOrder = cob ? RO_CIELO_COBERTURA : RO_CIELO_ADITIVO;
    }

    const visible = r > 0.002;
    mesh.visible = visible;                 // sin cielo no se dibuja (no gasta GPU)
    // Z32: el caparazón del domo se dibuja antes que el cielo solo mientras el cielo es visible
    if (s.cascaron && !s.cascaron.parent) s.cascaron = null;   // ExperienceDome se desmontó
    s.buscarT += dt;
    if (!s.cascaron && visible && s.buscarT > 1) {   // como mucho una búsqueda por segundo (TARIMA no lo monta)
      s.buscarT = 0;
      s.cascaron = scene.getObjectByName("domo-cascaron") ?? null;
    }
    if (s.cascaron) {
      const ro = visible && cob ? RO_CASCARON_CIELO : RO_CASCARON_BASE;
      if (s.cascaron.renderOrder !== ro) s.cascaron.renderOrder = ro;
    }
    mesh.position.copy(camera.position);    // solo posición: sin rotación ni escala
    aplicarProfundidadSala(s, visible && DBG_LUZ.ESTRELLAS_SALA_SIN_PROFUNDIDAD,
      DBG_LUZ.ESTRELLAS_SOBRE_TECHO || (visible && DBG_LUZ.ESTRELLAS_SALA_SIN_PROFUNDIDAD));
  });

  return (
    <mesh ref={meshRef} name="cielo-estrellas" renderOrder={DBG_LUZ.ESTRELLAS_COBERTURA ? RO_CIELO_COBERTURA : RO_CIELO_ADITIVO} frustumCulled={false} visible={false}>
      <sphereGeometry args={[radio, 64, 32]} />
      <shaderMaterial ref={matRef} vertexShader={ESTRELLAS_VERT} fragmentShader={ESTRELLAS_FRAG}
        uniforms={CIELO_UNIFORMS} side={THREE.BackSide} transparent depthWrite={false}
        depthTest={DBG_LUZ.ESTRELLAS_DEPTH_TEST} blending={THREE.AdditiveBlending} fog={false} />
    </mesh>
  );
}

/** Z31: techo y paredes sin escritura de profundidad mientras el cielo está visible (cambiar depthWrite
 *  no recompila el material). Solo escribe si cambia. */
function aplicarProfundidadSala(
  s: { techo: THREE.Mesh | null; paredes: THREE.Material[] },
  paredesSin: boolean, techoSin: boolean,
): void {
  const tm = s.techo?.material as THREE.Material | undefined;
  if (tm && tm.depthWrite === techoSin) tm.depthWrite = !techoSin;
  for (const pm of s.paredes) if (pm.depthWrite === paredesSin) pm.depthWrite = !paredesSin;
}
