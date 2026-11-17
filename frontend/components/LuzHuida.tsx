"use client";
// Z76: la luz del camino LUZ huye cuando el usuario vuelve (lib/luzHuida.ts + lib/luzMovimiento.ts). Montado dentro de
// LuzLejana: su useFrame corre ANTES que el de LuzLejana (los hijos se suscriben primero), así que el desplazamiento
// (LUZ_DESPLAZ) ya está escrito cuando LuzLejana recalcula la posición, la activación y el visual.
// Reloj: dt REAL del frame. Cerca de la luz el usuario está fuera del área y la experiencia está en pausa (RELOJ.dtExp
// = 0), así que con el reloj de la experiencia la luz no podría moverse nunca. No corre durante un checkpoint.
// Overlay (DBG_LUZ_MOV.OVERLAY): grilla del tablero en el suelo, celda actual y un recuadro con los contadores.
// Sin allocations por frame (la grilla se rearma solo si cambia RADIO_CELDAS); limpia todo al desmontar.

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { DBG_LUZ, DBG_LUZ_MOV, DEBUG_ENABLED } from "@/lib/debugConfig";
import { LUZ_STATE, LUZ_DESPLAZ, actualizarPosLuz } from "@/lib/caminoLuz";
import { tickHuida, desplazamientoEn, movimientosRestantes } from "@/lib/luzHuida";
import { HUIDA, cargarHuida, guardarHuida, prepararCtxHuida, tamCeldaLuz, simularVisitaLuz, reiniciarVisitasLuz, moverLuzAhora, volverLuzAlOrigen } from "@/lib/luzMovimiento";
import { CK_STATE } from "@/lib/checkpoints";

/** Grilla del tablero en celdas (unidad = 1 celda), centrada en el origen, de −r − ½ a r + ½. */
function crearGrilla(r: number): THREE.BufferGeometry {
  const n = 2 * r + 2, a = r + 0.5, pos = new Float32Array(n * 2 * 2 * 3);
  let k = 0;
  for (let i = 0; i < n; i++) {
    const v = -a + i;
    pos.set([v, 0, -a, v, 0, a, -a, 0, v, a, 0, v], k); k += 12;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  return g;
}

/** Recursos del overlay (objeto de módulo: un solo LuzHuida montado). */
const OV = { div: null as HTMLDivElement | null, geo: null as THREE.BufferGeometry | null, radio: -1, texto: "", t: 0 };

function textoContadores(): string {
  const s = HUIDA;
  return `LUZ Z76 · visitas ${s.visitas} · esta visita: ${movimientosRestantes(s)} mov. pendientes · celda (${s.col}, ${s.fila}) · `
    + `total ${s.movsTotal} · ${s.fase}${s.armada ? "" : " · sin armar"}`;
}

export default function LuzHuida() {
  const grupoRef = useRef<THREE.Group>(null);
  const celdaRef = useRef<THREE.Mesh>(null);
  const lineasRef = useRef<THREE.LineSegments>(null);
  const matLinea = useMemo(() => new THREE.LineBasicMaterial({ color: "#FF9A1F", transparent: true, opacity: 0.55, depthWrite: false }), []);
  const matCelda = useMemo(() => new THREE.MeshBasicMaterial({ color: "#FF9A1F", transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }), []);

  useEffect(() => {
    cargarHuida();
    const onSim = () => simularVisitaLuz();
    const onRei = () => reiniciarVisitasLuz();
    const onMov = () => moverLuzAhora();
    const onOri = () => volverLuzAlOrigen();
    window.addEventListener("alight:luz-simular-visita", onSim);
    window.addEventListener("alight:luz-reiniciar-visitas", onRei);
    window.addEventListener("alight:luz-mover-ahora", onMov);
    window.addEventListener("alight:luz-volver-origen", onOri);
    const w = window as unknown as { __luzHuida?: object };
    if (DEBUG_ENABLED) w.__luzHuida = { HUIDA, LUZ_STATE, LUZ_DESPLAZ, DBG_LUZ_MOV };   // diagnóstico (Chrome headless)
    return () => {
      window.removeEventListener("alight:luz-simular-visita", onSim);
      window.removeEventListener("alight:luz-reiniciar-visitas", onRei);
      window.removeEventListener("alight:luz-mover-ahora", onMov);
      window.removeEventListener("alight:luz-volver-origen", onOri);
      if (DEBUG_ENABLED) delete w.__luzHuida;
      LUZ_DESPLAZ.x = 0; LUZ_DESPLAZ.z = 0;   // sin el componente, la luz vuelve a su origen
      OV.div?.remove(); OV.div = null;
      OV.geo?.dispose(); OV.geo = null; OV.radio = -1;
      matLinea.dispose(); matCelda.dispose();
    };
  }, [matLinea, matCelda]);

  useFrame(({ camera }, dt) => {
    actualizarPosLuz();
    const on = DBG_LUZ.CAMINO_LUZ && DBG_LUZ_MOV.ACTIVO;
    if (on) {
      const libre = LUZ_STATE.fase === "libre" && CK_STATE.fase !== "aplicando";
      const ctx = prepararCtxHuida(camera.position.x, camera.position.z, libre);
      const r = CK_STATE.fase === "aplicando" ? 0 : tickHuida(HUIDA, DBG_LUZ_MOV, dt, ctx);
      if (r !== 0) guardarHuida();
      desplazamientoEn(HUIDA, ctx.tam, DBG_LUZ_MOV.TEMBLOR_M, LUZ_DESPLAZ);
    } else { LUZ_DESPLAZ.x = 0; LUZ_DESPLAZ.z = 0; }

    // ── overlay ──
    const ver = on && DBG_LUZ_MOV.OVERLAY;
    const g = grupoRef.current;
    if (g) {
      g.visible = ver;
      if (ver) {
        const tam = tamCeldaLuz();
        g.position.set(LUZ_STATE.xBase, 0.06, LUZ_STATE.zBase);
        // local x = −R (izquierda), local z = F: rotación con sen = fx, cos = fz
        g.rotation.set(0, Math.atan2(HUIDA.fx, HUIDA.fz), 0);
        g.scale.set(tam, 1, tam);
        const R = Math.max(0, Math.floor(DBG_LUZ_MOV.RADIO_CELDAS));
        const l = lineasRef.current;
        if (l && OV.radio !== R) { OV.geo?.dispose(); OV.geo = crearGrilla(R); OV.radio = R; l.geometry = OV.geo; }
        celdaRef.current?.position.set(-HUIDA.col, 0.01, HUIDA.fila);
      }
    }
    // contadores (DOM fuera del canvas, marcado como panel de debug; texto 4 veces por segundo)
    if (ver && !OV.div && typeof document !== "undefined") {
      const d = document.createElement("div");
      d.setAttribute("data-debug-panel", "");
      d.style.cssText = "position:fixed;left:12px;bottom:12px;z-index:60;font:12px monospace;color:#FF9A1F;background:#2A1400cc;padding:4px 8px;pointer-events:none";
      document.body.appendChild(d); OV.div = d; OV.texto = ""; OV.t = 1;
    } else if (!ver && OV.div) { OV.div.remove(); OV.div = null; }
    if (OV.div && (OV.t += dt) >= 0.25) {
      OV.t = 0;
      const t = textoContadores();
      if (t !== OV.texto) { OV.texto = t; OV.div.textContent = t; }
    }
  });

  return (
    <group ref={grupoRef} visible={false} renderOrder={11}>
      <lineSegments ref={lineasRef} material={matLinea} frustumCulled={false} renderOrder={11} />
      <mesh ref={celdaRef} rotation={[-Math.PI / 2, 0, 0]} material={matCelda} renderOrder={11}>
        <planeGeometry args={[0.96, 0.96]} />
      </mesh>
    </group>
  );
}
