"use client";
// Z91: host del consentimiento de la tarima (lib/consentTarimaAcciones.ts) dentro del Canvas: listeners y tick por
// cuadro. Montado en ThreeScene junto a LecternSystem (camino TARIMA): al desmontarse (salir de la tarima o un
// checkpoint) corta la transmisión, olvida la elección y quita el indicador "● EN VIVO".
import { useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { instalarConsentTarima, tickConsentTarima } from "@/lib/consentTarimaAcciones";

export default function ConsentTarimaHost() {
  useEffect(() => instalarConsentTarima(), []);
  useFrame(({ camera }) => tickConsentTarima(camera.position.x, camera.position.z));   // Z93a: posición para bajar/subir de la tarima
  return null;
}
