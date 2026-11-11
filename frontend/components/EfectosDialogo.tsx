"use client";
// Z29: monta lib/dialogo/efectosDialogo.ts (listeners, hooks de render de las luces, audio posicional)
// y llama a tickEfectos() una vez por frame. Lo monta LuzLejana. Toda la limpieza la hace la función
// que devuelve instalarEfectos() al desmontar.

import { useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { instalarEfectos, tickEfectos } from "@/lib/dialogo/efectosDialogo";

export default function EfectosDialogo() {
  const { scene, camera } = useThree();
  useEffect(() => instalarEfectos(scene, camera), [scene, camera]);
  useFrame((_, dt) => tickEfectos(dt));
  return null;
}
