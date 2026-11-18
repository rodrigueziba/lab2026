"use client";
// Z85: host del aviso de la sesión en vivo (lib/avisoVivoAcciones.ts) dentro del Canvas: tick por cuadro, listeners y
// "detener el render pesado" de la pantalla final (frameloop "never"; "Reiniciar decisión" lo vuelve a "always").
// Montado en ThreeScene fuera de <Scene>, así sobrevive a los remontajes de los checkpoints.
import { useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { tickAviso, instalarAviso } from "@/lib/avisoVivoAcciones";

export default function AvisoVivoHost() {
  const setFrameloop = useThree(s => s.setFrameloop);
  useEffect(() => {
    const quitar = instalarAviso();
    const onDetener = () => setFrameloop("never");
    const onReanudar = () => setFrameloop("always");
    window.addEventListener("alight:detener-render", onDetener);
    window.addEventListener("alight:reanudar-render", onReanudar);
    return () => {
      quitar();
      window.removeEventListener("alight:detener-render", onDetener);
      window.removeEventListener("alight:reanudar-render", onReanudar);
    };
  }, [setFrameloop]);
  useFrame(() => tickAviso());
  return null;
}
