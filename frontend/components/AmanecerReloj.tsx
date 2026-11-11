"use client";
// Z38: ÚNICO lugar donde avanza el amanecer (lib/amanecer.ts): una vez por frame, con dt y sin avanzar
// durante la pausa de Z28. Lo monta LuzLejana (siempre montado). Con DBG_AMANECER.UNIFICADO = false no
// hace nada (las máquinas viejas usan clock.elapsedTime).

import { useFrame } from "@react-three/fiber";
import { DBG_AMANECER } from "@/lib/debugConfig";
import { tickAmanecer } from "@/lib/amanecer";
import { PAUSA } from "@/lib/pausaExperiencia";

export default function AmanecerReloj() {
  useFrame((_, dt) => {
    if (DBG_AMANECER.UNIFICADO) tickAmanecer(dt, PAUSA.activa, DBG_AMANECER.AMANECER_DUR_S);
  });
  return null;
}
