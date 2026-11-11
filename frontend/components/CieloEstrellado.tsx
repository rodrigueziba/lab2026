"use client";
// Z30: cielo estrellado procedural del camino LUZ (shader de lib/luz/estrellasCielo.glsl.ts, adaptado de
// "Nightsky Shader Elective" de tmoe1354, Shadertoy WcjGRz, CC BY-NC-SA 3.0; ver CREDITOS.md).
// Una esfera grande que sigue a la cámara, BackSide + aditiva, sin fog ni profundidad propia.
// uReveal = rampa por distancia a la luz (ESTRELLAS_DIST_INICIO_M → ESTRELLAS_DIST_PLENO_M, smoothstep +
// exponente) con inercia temporal; se atenúa dentro del área con el visualizador o en las secuencias
// SILLAS/TARIMA. Orden de dibujo: renderOrder 10 como la luz de Z28 (después del caparazón del domo y
// de DomeSky, que no escriben profundidad); con ESTRELLAS_DEPTH_TEST las paredes y objetos la tapan.
// Lo monta LuzLejana. uTime se escribe solo acá, una vez por frame.

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { DBG_LUZ } from "@/lib/debugConfig";
import { LUZ_STATE, CIELO_STATE } from "@/lib/caminoLuz";
import { INTERACT_STATE, PANELES_SILLAS, isVizActivated } from "@/lib/alightStore";
import { PAUSA } from "@/lib/pausaExperiencia";
import { ESTRELLAS_VERT, ESTRELLAS_FRAG } from "@/lib/luz/estrellasCielo.glsl";

const CIELO_R = 300;   // > domo (30) y > sala (±40, techo 22); < far de la cámara (1000)

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
};

export default function CieloEstrellado() {
  const { camera, scene } = useThree();
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef  = useRef<THREE.ShaderMaterial>(null);
  const st = useRef({
    t: 0,
    tinte: DBG_LUZ.ESTRELLAS_TINTE_HORIZONTE,
    techo: null as THREE.Mesh | null,
  });

  // al desmontar: el techo vuelve a escribir profundidad
  useEffect(() => {
    const s = st.current;
    return () => {
      const m = s.techo?.material as THREE.Material | undefined;
      if (m) m.depthWrite = true;
      s.techo = null;
      CIELO_STATE.reveal = 0;
    };
  }, []);

  useFrame((_, dt) => {
    const s = st.current;
    // ── tiempo: un solo lugar, una vez por frame ──
    if (!(DBG_LUZ.ESTRELLAS_CONGELAR_EN_PAUSA && PAUSA.activa)) s.t += dt;
    CIELO_UNIFORMS.uTime.value = s.t;

    // ── techo (y = 22): deja de escribir profundidad solo con ESTRELLAS_SOBRE_TECHO ──
    if (!s.techo) s.techo = (scene.getObjectByName("room-ceiling") as THREE.Mesh | undefined) ?? null;
    const on = DBG_LUZ.CAMINO_LUZ && !DBG_LUZ.ESTRELLAS_MODO_VIEJO;
    if (s.techo) {
      const m = s.techo.material as THREE.Material;
      const dw = !(on && DBG_LUZ.ESTRELLAS_SOBRE_TECHO);
      if (m.depthWrite !== dw) m.depthWrite = dw;
    }

    const mesh = meshRef.current;
    if (!mesh) return;
    if (!on) { mesh.visible = false; CIELO_STATE.reveal = 0; CIELO_STATE.objetivo = 0; return; }

    // ── reveal objetivo: rampa por distancia a la luz ──
    const ini = DBG_LUZ.ESTRELLAS_DIST_INICIO_M, ple = DBG_LUZ.ESTRELLAS_DIST_PLENO_M;
    const t = Math.min(1, Math.max(0, (ini - LUZ_STATE.dLuz) / Math.max(1e-3, ini - ple)));
    let obj = Math.pow(t * t * (3 - 2 * t), Math.max(0.05, DBG_LUZ.ESTRELLAS_CURVA)) * DBG_LUZ.ESTRELLAS_REVEAL_MAX;
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

    mesh.visible = r > 0.002;
    mesh.position.copy(camera.position);
  });

  return (
    <mesh ref={meshRef} renderOrder={10} frustumCulled={false} visible={false}>
      <sphereGeometry args={[CIELO_R, 48, 24]} />
      <shaderMaterial ref={matRef} vertexShader={ESTRELLAS_VERT} fragmentShader={ESTRELLAS_FRAG}
        uniforms={CIELO_UNIFORMS} side={THREE.BackSide} transparent depthWrite={false}
        depthTest={DBG_LUZ.ESTRELLAS_DEPTH_TEST} blending={THREE.AdditiveBlending} fog={false} />
    </mesh>
  );
}
