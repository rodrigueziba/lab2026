"use client";
// F1: Overlay DOM del destello enceguecedor al atravesar el telón.
// Escucha 'alight:curtain-passed' (una vez por sesión) y 'alight:debug-curtain-flash'
// (botón del DebugMenu). Avanza FLASH_STATE en su propio rAF y pinta la opacidad
// directo en el estilo (sin re-render de React por frame).
// pointer-events: none → no captura el mouse ni interfiere con el pointer lock.

import { useEffect, useRef } from "react";
import { FLASH_STATE, triggerCurtainFlash, tickCurtainFlash } from "@/lib/curtainFlash";
import { DBG_FLASH } from "@/lib/debugConfig";
import { RETRO_FLAGS } from "@/lib/retro/retroFlags";

export default function CurtainFlash() {
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;

    const loop = () => {
      tickCurtainFlash(performance.now());
      const el = divRef.current;
      if (el) {
        // F2: por defecto el blanco va dentro del CRT (RetroPostFX → uFlash); el overlay DOM
        // solo con FLASH_OVERLAY_DOM o si el postproceso retro está apagado (fallback).
        const dom = DBG_FLASH.FLASH_OVERLAY_DOM || !RETRO_FLAGS.enabled;
        const on = dom && FLASH_STATE.fase !== "inactivo";
        el.style.display = on ? "block" : "none";
        el.style.opacity = on ? FLASH_STATE.opacidad.toFixed(4) : "0";
      }
      raf = FLASH_STATE.fase !== "inactivo" ? requestAnimationFrame(loop) : 0;
    };
    const start = (origen: "cortina" | "debug") => {
      if (!triggerCurtainFlash(origen)) return;
      if (!raf) raf = requestAnimationFrame(loop);
    };
    const onPassed = () => start("cortina");
    const onDebug  = () => start("debug");

    window.addEventListener("alight:curtain-passed",       onPassed);
    window.addEventListener("alight:debug-curtain-flash",  onDebug);
    return () => {
      window.removeEventListener("alight:curtain-passed",      onPassed);
      window.removeEventListener("alight:debug-curtain-flash", onDebug);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={divRef}
      aria-hidden
      style={{
        position: "fixed", inset: 0,
        display: "none", opacity: 0,
        pointerEvents: "none",
        zIndex: 9000, // sobre el canvas y el HUD (1000), debajo del DebugMenu (9999)
        // blanco cálido #FFF3DC con núcleo más intenso en el centro
        background: "radial-gradient(circle at 50% 50%, #FFFFFF 0%, #FFF9EE 28%, #FFF3DC 62%, #FFF3DC 100%)",
      }}
    />
  );
}
