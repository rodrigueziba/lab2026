"use client";
// Z40: anfitrión de los checkpoints. Instala las acciones, avanza el ejecutor una vez por frame con la
// cámara actual y atiende ?checkpoint=<id> una sola vez por carga (solo con DBG_CHECKPOINTS.HABILITADOS y
// el menú de debug habilitado: DEBUG_ENABLED o premio vigente). Lo monta LuzLejana; se remonta con
// <Scene/> en cada checkpoint (HOST.montajes avisa al paso "remontar").
// Z95: también ?cp=<id> (checkpointDeUrl; desconocido o vacío → se ignora sin avisos). Si la página todavía no recibió
// ningún gesto del usuario, se muestra un botón "Entrar" (el clic habilita el audio del visualizador y de la tarima, que
// el navegador bloquea sin gesto) y el checkpoint arranca al tocarlo.

import { useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { DEBUG_ENABLED, DBG_CHECKPOINTS } from "@/lib/debugConfig";
import { instalarAcciones, irACheckpoint, tickCheckpoints, CK_STATE, checkpointDeUrl, buscarCheckpoint } from "@/lib/checkpoints";
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
      const id = checkpointDeUrl(window.location.search);
      if (id && DBG_CHECKPOINTS.HABILITADOS && (DEBUG_ENABLED || leerPremio())) {
        const activo = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive;
        if (activo) irACheckpoint(id); else botonEntrar(id);
      }
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

/** Z95: botón a pantalla completa para el primer gesto (audio y puntero); al tocarlo arranca el checkpoint. */
function botonEntrar(id: string): void {
  if (typeof document === "undefined") return;
  const d = document.createElement("div");
  d.setAttribute("data-debug-panel", "");   // el clic no captura el mouse de la cámara
  d.style.cssText = "position:fixed;inset:0;z-index:9800;background:rgba(18,16,26,0.82);display:flex;align-items:center;justify-content:center";
  const b = document.createElement("button");
  b.textContent = `ENTRAR · ${buscarCheckpoint(id)?.nombre ?? id}`;
  b.title = "El clic habilita el audio (el navegador lo exige) y arranca el checkpoint";
  b.style.cssText = "background:#2A1400;color:#FF9A1F;border:2px solid #FF9A1F;padding:14px 22px;font:700 18px ui-monospace,'SF Mono',Menlo,Consolas,monospace;letter-spacing:0.1em;cursor:pointer";
  b.addEventListener("click", e => { e.stopPropagation(); d.remove(); irACheckpoint(id); });
  d.append(b);
  document.body.appendChild(d);
}
