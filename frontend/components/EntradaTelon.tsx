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
import { ENTRADA, BLOQUEO_MOV, iniciarEntrada, tickEntrada, cancelarEntrada, poseEntrada, POSE_ENTRADA, type RectXZ, type ZonaXZ } from "@/lib/entradaTelon";
import { sillaEn, N_SILLAS, TARIMA_CENTRO, ASIENTO_MEDIO, zonaSillasEn, ZONA_SILLAS_BASE, ZONA_TARIMA } from "@/lib/layoutSala"; // Z65 · Z75
import { TARIMA_W, TARIMA_D } from "./Tarima"; // Z65
import { FLASH_STATE } from "@/lib/curtainFlash";
import { CK_STATE } from "@/lib/checkpoints";
import { INICIO_BASE } from "@/lib/inicioEscena";

/** Última pose guardada con el botón de debug (texto para el panel). */
export const ENTRADA_POSE = { texto: "" };

/** Z65: obstáculos de la entrada (tarima y fila de sillas, con margen) y pose final con DESPLAZ_IZQ_M / MIRAR_TARIMA.
 *  Z75: huella real de cada silla (layoutSala: sillaEn + ASIENTO_MEDIO, acompaña a DBG_LAYOUT) para la regla
 *  "linea_sillas"; obstáculos = huellas + DIST_MIN_OBJETOS_M; zonas que disparan un camino (ZONA_SILLAS, ZONA_TARIMA).
 *  Se calcula solo en el instante del salto (y al probar / en el menú), no por frame. */
const _obst: RectXZ[] = [{ x0: 0, z0: 0, x1: 0, z1: 0 }, { x0: 0, z0: 0, x1: 0, z1: 0 }];
const _sillas: RectXZ[] = Array.from({ length: N_SILLAS }, () => ({ x0: 0, z0: 0, x1: 0, z1: 0 }));
const _zonas: ZonaXZ[] = [{ x: 0, z: 0, radio: 0 }, { x: 0, z: 0, radio: 0 }];
const _s = { x: 0, z: 0 };
export function calcularPoseEntrada(): typeof POSE_ENTRADA {
  const m = Math.max(0, Number.isFinite(DBG_ENTRADA.DIST_MIN_OBJETOS_M) ? DBG_ENTRADA.DIST_MIN_OBJETOS_M : 0.6);
  const t = _obst[0];
  t.x0 = TARIMA_CENTRO.x - TARIMA_W / 2 - m; t.x1 = TARIMA_CENTRO.x + TARIMA_W / 2 + m;
  t.z0 = TARIMA_CENTRO.z - TARIMA_D / 2 - m; t.z1 = TARIMA_CENTRO.z + TARIMA_D / 2 + m;
  const sl = _obst[1]; sl.x0 = Infinity; sl.z0 = Infinity; sl.x1 = -Infinity; sl.z1 = -Infinity;
  for (let i = 0; i < N_SILLAS; i++) {
    sillaEn(i, DBG_LAYOUT, _s);
    const r = _sillas[i];
    r.x0 = _s.x - ASIENTO_MEDIO.x; r.x1 = _s.x + ASIENTO_MEDIO.x; r.z0 = _s.z - ASIENTO_MEDIO.z; r.z1 = _s.z + ASIENTO_MEDIO.z;
    sl.x0 = Math.min(sl.x0, r.x0 - m); sl.x1 = Math.max(sl.x1, r.x1 + m); sl.z0 = Math.min(sl.z0, r.z0 - m); sl.z1 = Math.max(sl.z1, r.z1 + m);
  }
  zonaSillasEn(DBG_LAYOUT, _s);
  _zonas[0].x = _s.x; _zonas[0].z = _s.z; _zonas[0].radio = ZONA_SILLAS_BASE.radio + m;
  _zonas[1].x = ZONA_TARIMA.x; _zonas[1].z = ZONA_TARIMA.z; _zonas[1].radio = ZONA_TARIMA.radio + m;
  return poseEntrada(DBG_ENTRADA, DBG_LUZ.SALA_MEDIA_M - DBG_LUZ.SALA_MARGEN_M, _obst, TARIMA_CENTRO, POSE_ENTRADA, _sillas, _zonas);
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
      DBG_ENTRADA.MODO = "manual";   // Z75: la pose guardada se usa tal cual (si no, linea_sillas la volvería a correr)
      ENTRADA_POSE.texto = `POS_X: ${DBG_ENTRADA.POS_X}, POS_Z: ${DBG_ENTRADA.POS_Z}, YAW_DEG: ${DBG_ENTRADA.YAW_DEG}, PITCH_DEG: ${DBG_ENTRADA.PITCH_DEG}, MODO: manual`;
      console.log(`[Z59] pose de entrada → ${ENTRADA_POSE.texto}`);
    };
    window.addEventListener("alight:curtain-passed", onPassed);
    window.addEventListener("alight:entrada-probar", onProbar);
    window.addEventListener("alight:entrada-guardar", onGuardar);
    const w = window as unknown as { __entrada?: object };
    if (DEBUG_ENABLED) w.__entrada = { ENTRADA, BLOQUEO_MOV, FLASH_STATE, camera, DBG_ENTRADA, POSE_ENTRADA };   // diagnóstico (Chrome headless) · Z75: + config y pose
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
      const P = calcularPoseEntrada();   // Z65/Z75: según DBG_ENTRADA.MODO (linea_sillas · desplazamiento · manual) y MIRAR_TARIMA
      camera.position.set(P.x, INICIO_BASE.y, P.z);   // altura de ojos de siempre
      camera.rotation.order = "YXZ";   // como PointerLockControls y aplicarSpawn
      camera.rotation.set((P.pitchDeg * Math.PI) / 180, (P.yawDeg * Math.PI) / 180, 0);
    }
  });

  return null;
}
