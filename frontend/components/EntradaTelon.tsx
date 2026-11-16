"use client";
// Z59: entrada fija después de cruzar el telón (lib/entradaTelon.ts). Al cruzar (alight:curtain-passed) bloquea
// WASD con una razón propia, teletransporta la cámara a la pose de DBG_ENTRADA en el pico del destello (blanco
// total: no se ve el salto) y libera el movimiento BLOQUEO_EXTRA_S después del fin del destello. La mirada con el
// mouse sigue libre todo el tiempo (solo se fija la orientación en el instante del salto).
// Debug: alight:entrada-probar (repite el cruce: destello de debug + entrada) y alight:entrada-guardar (lee la
// pose actual de la cámara, la copia a DBG_ENTRADA y la deja en ENTRADA_POSE.texto y en la consola).
// No crea objetos por frame; limpia listeners y su bloqueo al desmontar.

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { DBG_ENTRADA, DBG_LUZ, DBG_LAYOUT, DEBUG_ENABLED } from "@/lib/debugConfig";
import { ENTRADA, BLOQUEO_MOV, iniciarEntrada, tickEntrada, cancelarEntrada, poseEntrada, POSE_ENTRADA, type RectXZ } from "@/lib/entradaTelon";
import { sillaEn, N_SILLAS, TARIMA_CENTRO } from "@/lib/layoutSala"; // Z65
import { TARIMA_W, TARIMA_D } from "./Tarima"; // Z65
import { FLASH_STATE } from "@/lib/curtainFlash";
import { CK_STATE } from "@/lib/checkpoints";
import { INICIO_BASE } from "@/lib/inicioEscena";

/** Última pose guardada con el botón de debug (texto para el panel). */
export const ENTRADA_POSE = { texto: "" };

/** Z65: obstáculos de la entrada (tarima y fila de sillas, con margen) y pose final con DESPLAZ_IZQ_M / MIRAR_TARIMA.
 *  Se calcula solo en el instante del salto (y al probar), no por frame. */
const _obst: RectXZ[] = [{ x0: 0, z0: 0, x1: 0, z1: 0 }, { x0: 0, z0: 0, x1: 0, z1: 0 }];
const _s = { x: 0, z: 0 };
export function calcularPoseEntrada(): typeof POSE_ENTRADA {
  const t = _obst[0], m = 0.6;
  t.x0 = TARIMA_CENTRO.x - TARIMA_W / 2 - m; t.x1 = TARIMA_CENTRO.x + TARIMA_W / 2 + m;
  t.z0 = TARIMA_CENTRO.z - TARIMA_D / 2 - m; t.z1 = TARIMA_CENTRO.z + TARIMA_D / 2 + m;
  sillaEn(0, DBG_LAYOUT, _s); const x0 = _s.x, z = _s.z; sillaEn(N_SILLAS - 1, DBG_LAYOUT, _s);
  const sl = _obst[1]; sl.x0 = Math.min(x0, _s.x) - 0.8; sl.x1 = Math.max(x0, _s.x) + 0.8; sl.z0 = z - 0.9; sl.z1 = z + 0.9;
  return poseEntrada(DBG_ENTRADA, DBG_LUZ.SALA_MEDIA_M - DBG_LUZ.SALA_MARGEN_M, _obst, TARIMA_CENTRO, POSE_ENTRADA);
}

export default function EntradaTelon() {
  const { camera } = useThree();
  const eul = useRef(new THREE.Euler(0, 0, 0, "YXZ"));

  useEffect(() => {
    const onPassed = () => {
      // un checkpoint teletransporta la cámara a través del plano del telón: no es un cruce (igual que CurtainFlash)
      if (CK_STATE.fase === "aplicando") return;
      iniciarEntrada(ENTRADA, DBG_ENTRADA, performance.now());
      // si el destello de la cortina ya se usó en esta sesión (telón repuesto desde debug), uno de debug tapa el salto
      if (DBG_ENTRADA.ACTIVO && DBG_ENTRADA.DESTELLO_EN_REPETICION && FLASH_STATE.fase === "inactivo" && FLASH_STATE.disparado) {
        window.dispatchEvent(new CustomEvent("alight:debug-curtain-flash"));
      }
    };
    const onProbar = () => {
      if (!iniciarEntrada(ENTRADA, DBG_ENTRADA, performance.now())) return;
      window.dispatchEvent(new CustomEvent("alight:debug-curtain-flash"));
    };
    const onGuardar = () => {
      const e = eul.current.setFromQuaternion(camera.quaternion, "YXZ");
      DBG_ENTRADA.POS_X = +camera.position.x.toFixed(2);
      DBG_ENTRADA.POS_Z = +camera.position.z.toFixed(2);
      DBG_ENTRADA.YAW_DEG = +((e.y * 180) / Math.PI).toFixed(1);
      DBG_ENTRADA.PITCH_DEG = +((e.x * 180) / Math.PI).toFixed(1);
      ENTRADA_POSE.texto = `POS_X: ${DBG_ENTRADA.POS_X}, POS_Z: ${DBG_ENTRADA.POS_Z}, YAW_DEG: ${DBG_ENTRADA.YAW_DEG}, PITCH_DEG: ${DBG_ENTRADA.PITCH_DEG}`;
      console.log(`[Z59] pose de entrada → ${ENTRADA_POSE.texto}`);
    };
    window.addEventListener("alight:curtain-passed", onPassed);
    window.addEventListener("alight:entrada-probar", onProbar);
    window.addEventListener("alight:entrada-guardar", onGuardar);
    const w = window as unknown as { __entrada?: object };
    if (DEBUG_ENABLED) w.__entrada = { ENTRADA, BLOQUEO_MOV, FLASH_STATE, camera };   // diagnóstico (Chrome headless)
    return () => {
      if (DEBUG_ENABLED) delete w.__entrada;
      window.removeEventListener("alight:curtain-passed", onPassed);
      window.removeEventListener("alight:entrada-probar", onProbar);
      window.removeEventListener("alight:entrada-guardar", onGuardar);
      cancelarEntrada(ENTRADA);   // no deja el WASD bloqueado al desmontar
    };
  }, [camera]);

  useFrame((state) => {
    if (ENTRADA.fase === "inactiva") return;
    const camera = state.camera;   // la cámara del frame (no la del hook: react-hooks/immutability)
    if (tickEntrada(ENTRADA, DBG_ENTRADA, FLASH_STATE.fase, performance.now(), CK_STATE.fase === "aplicando")) {
      const P = calcularPoseEntrada();   // Z65: + DESPLAZ_IZQ_M a la izquierda de la mirada (y MIRAR_TARIMA)
      camera.position.set(P.x, INICIO_BASE.y, P.z);   // altura de ojos de siempre
      camera.rotation.order = "YXZ";   // como PointerLockControls y aplicarSpawn
      camera.rotation.set((P.pitchDeg * Math.PI) / 180, (P.yawDeg * Math.PI) / 180, 0);
    }
  });

  return null;
}
