"use client";
// Z97b: la luz EXTRA del atril de imagen nuevo: UNA luz puntual fija, siempre montada (intensidad 0 apagada), para que
// encenderla o apagarla no cambie la cantidad de luces (three.js recompilaría los materiales). Su intensidad sale de
// cdExtra (acotada por LUZ_TOPE_FINAL). En SILLAS queda en 0.
import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { STORE } from "@/lib/alightStore";
import { DBG_ATRIL_VIDEO } from "@/lib/debugConfig";
import { LUZ_ESCENA, cdExtra } from "@/lib/lucesEscena";
import { aporteViejasActual } from "@/lib/lucesEscenaAcciones";

export default function LuzExtraEscena() {
  const ref = useRef<THREE.PointLight>(null);
  const color = useRef("");
  useEffect(() => () => { ref.current?.dispose(); }, []);
  useFrame(() => {
    const l = ref.current;
    if (!l) return;
    const on = DBG_ATRIL_VIDEO.DISENO_NUEVO && LUZ_ESCENA.extra;
    l.intensity = on ? cdExtra(STORE.lights.globalIntensity, true, aporteViejasActual(), DBG_ATRIL_VIDEO) : 0;
    if (color.current !== DBG_ATRIL_VIDEO.EXTRA_COLOR) { color.current = DBG_ATRIL_VIDEO.EXTRA_COLOR; l.color.set(color.current); }
  });
  return <pointLight ref={ref} intensity={0} position={[0, 3.0, 2.0]} />;
}
