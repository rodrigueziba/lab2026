"use client";
// Z70: pestaña "Otros" del menú de debug. Cada sección es el código movido tal cual desde DebugMenu.tsx;
// toma del contexto (useDbg) solo el estado que usa. Registro y orden: lib/debugSecciones.ts.
import { DBG_SILLAS } from "@/lib/debugConfig";
import { LABEL, ROW, INPUT, NOTE } from "../comun";
import { useDbg } from "../contexto";

// sección: debug-overlays
export function SecDebugOverlays() {
  const { sillas, setSillas } = useDbg();
  return (
    <>
          <span style={LABEL}>Overlays del prisma, audio y efectos (R1) <span style={NOTE}>(R1 — prism / audio / fx)</span></span>
          <div style={ROW}>
            <span>debugOverlays</span>
            <button style={INPUT} onClick={() => {
              const v = !sillas.debugOverlays;
              DBG_SILLAS.debugOverlays = v;
              setSillas(s => ({ ...s, debugOverlays: v }));
            }}>{sillas.debugOverlays ? "ON" : "off"}</button>
          </div>
    </>
  );
}
