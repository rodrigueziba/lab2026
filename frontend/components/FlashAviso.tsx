"use client";
// G2: aviso de fotosensibilidad al inicio de la experiencia (flag FLASH_AVISO_FOTOSENSIBILIDAD,
// false por defecto). Línea breve en pantalla ámbar; se va al atravesar el telón o a los
// AVISO_MS. pointer-events: none → no interfiere con el pointer lock.

import { useEffect, useState } from "react";
import { DBG_FLASH } from "@/lib/debugConfig";

const AVISO_MS = 8000;

export default function FlashAviso() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    const t0 = performance.now();
    let terminado = false;
    // poll liviano (4 Hz) para que el toggle del DebugMenu funcione en vivo
    const id = setInterval(() => {
      const v = !terminado && DBG_FLASH.FLASH_AVISO_FOTOSENSIBILIDAD && performance.now() - t0 < AVISO_MS;
      setOn(prev => (prev === v ? prev : v));
      if (performance.now() - t0 >= AVISO_MS) clearInterval(id);
    }, 250);
    const onPassed = () => { terminado = true; setOn(false); };
    window.addEventListener("alight:curtain-passed", onPassed);
    return () => {
      clearInterval(id);
      window.removeEventListener("alight:curtain-passed", onPassed);
    };
  }, []);

  if (!on) return null;
  return (
    <div
      role="note"
      style={{
        position: "fixed", left: "50%", bottom: 28, transform: "translateX(-50%)",
        pointerEvents: "none", zIndex: 1100,
        padding: "6px 14px",
        background: "#2A1400", color: "#FF9A1F",
        border: "1px solid #FF9A1F",
        fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12, letterSpacing: "0.08em",
        textTransform: "uppercase",
        textShadow: "0 0 6px rgba(255,154,31,0.6)",
        maxWidth: "calc(100vw - 32px)", textAlign: "center",
      }}
    >
      Aviso: al atravesar el telón hay un destello de luz intenso
    </div>
  );
}
