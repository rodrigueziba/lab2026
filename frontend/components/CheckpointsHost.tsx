"use client";
// Z40: anfitrión de los checkpoints. Instala las acciones, avanza el ejecutor una vez por frame con la
// cámara actual y atiende ?checkpoint=<id> una sola vez por carga (solo con DBG_CHECKPOINTS.HABILITADOS y
// el menú de debug habilitado: DEBUG_ENABLED o premio vigente). Lo monta LuzLejana; se remonta con
// <Scene/> en cada checkpoint (HOST.montajes avisa al paso "remontar").

import { useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { DEBUG_ENABLED, DBG_CHECKPOINTS } from "@/lib/debugConfig";
import { instalarAcciones, irACheckpoint, tickCheckpoints, CK_STATE } from "@/lib/checkpoints";
import { RELOJ } from "@/lib/relojExperiencia";
import { ACCIONES_CHECKPOINT, HOST, setCamaraCheckpoints } from "@/lib/checkpointsAcciones";
import { leerPremio } from "@/lib/dialogo/efectosEstado";

let _urlAtendida = false;

export default function CheckpointsHost() {
  useEffect(() => {
    instalarAcciones(ACCIONES_CHECKPOINT);
    HOST.montajes++;
    HOST.frames = 0;
    if (!_urlAtendida) {
      _urlAtendida = true;
      const id = new URLSearchParams(window.location.search).get("checkpoint");
      if (id && DBG_CHECKPOINTS.HABILITADOS && (DEBUG_ENABLED || leerPremio())) irACheckpoint(id);
    }
  }, []);

  useFrame(({ camera }, dt) => {
    HOST.frames++;
    setCamaraCheckpoints(camera);
    tickCheckpoints(dt);
    // seguridad: si un checkpoint terminó o falló, el reloj nunca queda congelado
    if (RELOJ.congelado && CK_STATE.fase !== "aplicando") RELOJ.congelado = false;
  });
  return null;
}
