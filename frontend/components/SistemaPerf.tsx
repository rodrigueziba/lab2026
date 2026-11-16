"use client";
// Z66: envoltorio de un sistema para el panel de rendimiento. Un <group> que queda invisible cuando
// DBG_RENDIMIENTO.SIS[id] es false: three no recorre ese subárbol (no lo dibuja ni cuenta sus luces), así que se quita
// el costo de GPU real. La lógica por frame de los hijos (useFrame) sigue corriendo. Solo para objetos que viven dentro
// del subárbol (los que hacen scene.add no quedan cubiertos: ver SISTEMAS en lib/rendimiento.ts).
import { useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import { DBG_RENDIMIENTO } from "@/lib/debugConfig";

export default function SistemaPerf({ id, children }: { id: string; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    const v = DBG_RENDIMIENTO.SIS[id] !== false;
    if (ref.current && ref.current.visible !== v) ref.current.visible = v;
  });
  return <group ref={ref}>{children}</group>;
}
