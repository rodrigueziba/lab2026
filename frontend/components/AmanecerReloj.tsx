"use client";
// Z39: también avanza el reloj de la experiencia (lib/relojExperiencia.ts), una vez por frame.
// Z38: ÚNICO lugar donde avanza el amanecer (lib/amanecer.ts): una vez por frame, con dt y sin avanzar
// durante la pausa de Z28. Lo monta LuzLejana (siempre montado). Con DBG_AMANECER.UNIFICADO = false no
// hace nada (las máquinas viejas usan clock.elapsedTime).

import { useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { DBG_AMANECER, DBG_DIA, DBG_FLOR } from "@/lib/debugConfig";
import { FLOR, estadoPrismaFlor } from "@/lib/prismaFlor"; // Z54
import { tickAmanecer, emitirFin, AMANECER } from "@/lib/amanecer";
import { DIA, avanzarDia } from "@/lib/cicloDia"; // Z48
import { duracionTemaViz, idTemaViz } from "@/lib/vizAudio"; // Z48
import { PAUSA } from "@/lib/pausaExperiencia";
import { tickReloj, limpiarEsperas } from "@/lib/relojExperiencia"; // Z39

export default function AmanecerReloj() {
  // Z39: al desmontar, las esperas del reloj de la experiencia se descartan
  useEffect(() => () => limpiarEsperas(), []);
  useFrame((_, dt) => {
    tickReloj(dt, PAUSA.activa);   // Z39: reloj de la experiencia (siempre; con RELOJ_UNIFICADO=false nadie lo lee)
    // Z48: con el ciclo de día, la introducción reemplaza a la fase 1 (misma máquina: disparo, reset, skip)
    if (DBG_DIA.NUEVO) {
      avanzarDia(DIA, DBG_DIA, dt, PAUSA.activa, AMANECER, duracionTemaViz(), idTemaViz());
      if (DIA.evDawn) emitirFin();   // alight:dawn-complete (+ alias) una vez, al terminar la introducción
      if (DIA.evFin) window.dispatchEvent(new CustomEvent("alight:dia-fin"));
      if (DIA.evReinicio) window.dispatchEvent(new CustomEvent("alight:dia-reinicio"));
    } else if (DBG_AMANECER.UNIFICADO) tickAmanecer(dt, PAUSA.activa, DBG_AMANECER.AMANECER_DUR_S);
    // Z54: coreografía del prisma y la flor (solo con el ciclo nuevo en marcha, o T_MANUAL fijado)
    estadoPrismaFlor(DIA.dia, DBG_FLOR, DBG_DIA.NUEVO && DIA.escena && (DIA.fase !== "espera" || DBG_DIA.T_MANUAL >= 0), FLOR);
  });
  return null;
}
