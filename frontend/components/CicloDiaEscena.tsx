"use client";
// Z48: aplica el ciclo de día (lib/cicloDia.ts → DIA) a la escena: fondo, color de la niebla, luz hemisférica
// (cielo, suelo, intensidad) y luz ambiente. Así el piso y los objetos reciben una luz que acompaña (cálida
// al salir y al ponerse el sol, neutra al mediodía, azul tenue de noche). No agrega ni quita luces (no
// recompila materiales); solo cambia color e intensidad de las que ya están en <Scene/> (ThreeScene).
// Lo monta ExperienceDome con el visualizador activo (camino SILLAS). Guarda los valores originales al montar
// y los restaura al desmontar o con DBG_DIA.NUEVO = false. Sin allocations por frame.
// La exposición (RetroPostFX) lee DIA.expo solo mientras DIA.escena es true.

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { DBG_DIA, DBG_PORTAL, DBG_SOL, DBG_FLOR, DBG_RETRO_FX, DBG_ONDAS, DBG_FLUIDO, DEBUG_ENABLED } from "@/lib/debugConfig";
import { DIA } from "@/lib/cicloDia";
import { ONDAS } from "@/lib/ondasKick"; // Z52 (diagnóstico)
import { RELOJ } from "@/lib/relojExperiencia"; // Z52 (diagnóstico)

interface Originales {
  fondo: THREE.Color | null; niebla: THREE.Color | null;
  hemi: THREE.HemisphereLight | null; hemiCielo: THREE.Color; hemiSuelo: THREE.Color; hemiInt: number;
  amb: THREE.AmbientLight | null; ambInt: number;
  fondoVal: THREE.Color; nieblaVal: THREE.Color;
}

export default function CicloDiaEscena() {
  const { scene, camera } = useThree();
  const orig = useRef<Originales | null>(null);
  const aplicado = useRef(false);

  useEffect(() => {
    // luces de <Scene/>: la primera hemisférica y la primera ambiente directamente bajo la escena
    let hemi: THREE.HemisphereLight | null = null, amb: THREE.AmbientLight | null = null;
    for (const o of scene.children) {
      if (!hemi && (o as THREE.HemisphereLight).isHemisphereLight) hemi = o as THREE.HemisphereLight;
      if (!amb && (o as THREE.AmbientLight).isAmbientLight) amb = o as THREE.AmbientLight;
    }
    const fondo = scene.background instanceof THREE.Color ? scene.background : null;
    const niebla = scene.fog ? scene.fog.color : null;
    const o: Originales = {
      fondo, niebla, hemi, amb,
      fondoVal: fondo ? fondo.clone() : new THREE.Color(), nieblaVal: niebla ? niebla.clone() : new THREE.Color(),
      hemiCielo: hemi ? hemi.color.clone() : new THREE.Color(), hemiSuelo: hemi ? hemi.groundColor.clone() : new THREE.Color(),
      hemiInt: hemi ? hemi.intensity : 0, ambInt: amb ? amb.intensity : 0,
    };
    orig.current = o;
    // diagnóstico solo en modo debug (pruebas en Chrome headless)
    const w = window as unknown as { __dia?: object; __portal?: object; __sol?: object; __ondas?: object; __fx?: object; __flor?: object; __fluido?: object };
    if (DEBUG_ENABLED) { w.__dia = { DIA, DBG_DIA, camera }; w.__portal = DBG_PORTAL; w.__sol = DBG_SOL; w.__ondas = { ONDAS, RELOJ, DBG_ONDAS }; w.__fx = DBG_RETRO_FX; w.__flor = DBG_FLOR; w.__fluido = DBG_FLUIDO; }   // Z49: + composición · Z51: + sol · Z57: + post-proceso y flor
    return () => {
      if (DEBUG_ENABLED) { delete w.__dia; delete w.__portal; delete w.__sol; delete w.__ondas; delete w.__fx; delete w.__flor; delete w.__fluido; }
      restaurar(o);
      DIA.escena = false;
      orig.current = null;
    };
  }, [scene, camera]);

  useFrame(() => {
    const o = orig.current;
    if (!o) return;
    if (!DBG_DIA.NUEVO) {
      if (aplicado.current) { restaurar(o); aplicado.current = false; }
      DIA.escena = false;
      return;
    }
    aplicado.current = true;
    DIA.escena = true;
    const S = THREE.SRGBColorSpace;   // los colores del ciclo están en sRGB
    o.fondo?.setRGB(DIA.fondo[0], DIA.fondo[1], DIA.fondo[2], S);
    o.niebla?.setRGB(DIA.niebla[0], DIA.niebla[1], DIA.niebla[2], S);
    if (o.hemi) {
      o.hemi.color.setRGB(DIA.hemiCielo[0], DIA.hemiCielo[1], DIA.hemiCielo[2], S);
      o.hemi.groundColor.setRGB(DIA.hemiSuelo[0], DIA.hemiSuelo[1], DIA.hemiSuelo[2], S);
      o.hemi.intensity = DIA.hemiInt;
    }
    if (o.amb) o.amb.intensity = DIA.ambInt;
  });

  return null;
}

function restaurar(o: Originales): void {
  o.fondo?.copy(o.fondoVal);
  o.niebla?.copy(o.nieblaVal);
  if (o.hemi) { o.hemi.color.copy(o.hemiCielo); o.hemi.groundColor.copy(o.hemiSuelo); o.hemi.intensity = o.hemiInt; }
  if (o.amb) o.amb.intensity = o.ambInt;
}
