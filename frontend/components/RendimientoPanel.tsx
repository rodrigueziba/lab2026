"use client";
// Z66: sección "Rendimiento Z66" del menú debug (Shift). Lee RENDIMIENTO (components/RendimientoHost) y PASTO_RENDER
// (lib/pastoChunks) cada 0,5 s; escribe DBG_RENDIMIENTO y manda eventos al host (benchmark, DPR forzado, estrés).
import { useEffect, useState, type CSSProperties } from "react";
import { DBG_RENDIMIENTO } from "@/lib/debugConfig";
import { SISTEMAS } from "@/lib/rendimiento";
import { PASTO_RENDER } from "@/lib/pastoChunks";
import { RENDIMIENTO } from "./RendimientoHost";

const LABEL: CSSProperties = { display: "block", marginBottom: 5, color: "#8899bb" };
const ROW: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 6 };
const BTN: CSSProperties = {
  background: "rgba(255,255,255,0.07)", border: "1px solid rgba(100,120,180,0.3)", borderRadius: 3, color: "#d0d8e8",
  fontFamily: "monospace", fontSize: 11, padding: "2px 6px", cursor: "pointer",
};
const NOTE: CSSProperties = { fontSize: 9, color: "#556080", fontStyle: "italic", marginLeft: 4 };
const MONO: CSSProperties = { fontFamily: "monospace", fontSize: 10, color: "#c0c8d8", whiteSpace: "pre-wrap", lineHeight: 1.35 };
const emitir = (n: string, detail?: object) => window.dispatchEvent(new CustomEvent(n, { detail }));

const FLAGS_PASTO = ["PASTO_CHUNKS", "PASTO_CULL_PROGRESO", "PASTO_LOD", "PASTO_LEJANO", "PASTO_VIENTO_BARATO", "PASTO_DESCARTE_TEMPRANO", "PASTO_MIPMAPS"] as const;
const NUM: readonly (readonly [keyof typeof DBG_RENDIMIENTO, number, number, number, string])[] = [
  ["OBJETIVO_FPS", 20, 120, 1, "FPS"], ["DPR_MAX", 0.5, 3, 0.05, ""], ["DPR_MIN", 0.25, 1.5, 0.05, ""],
  ["CHUNK_M", 2, 12, 0.5, "m"], ["CAPAS_LEJOS", 1, 40, 1, "capas"], ["LOD_CERCA_M", 1, 40, 0.5, "m"], ["LOD_LEJOS_M", 2, 60, 0.5, "m"],
  ["LEJANO_BRILLO", 0, 3, 0.05, ""],
];

export default function RendimientoPanel() {
  const [, setTick] = useState(0);
  const [copiado, setCopiado] = useState("");
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 500); return () => clearInterval(id); }, []);
  const E = RENDIMIENTO, R = DBG_RENDIMIENTO, P = PASTO_RENDER;
  const tocar = () => setTick(t => t + 1);
  const copiar = async () => {
    try { await navigator.clipboard.writeText(E.reporte); setCopiado("copiado"); }
    catch { setCopiado("no se pudo copiar: seleccioná el texto a mano"); }
  };
  if (!E.montado) return <div style={ROW}><span style={NOTE}>Rendimiento Z66: el medidor no está montado</span></div>;
  return (
    <div>
      <span style={LABEL}>Rendimiento Z66 <span style={NOTE}>(lecturas cada 0,5 s)</span></span>
      <div style={MONO}>
        {`FPS ${E.fps.toFixed(1)} · frame ${E.media.toFixed(2)} ms (5 s) · p95 ${E.p95.toFixed(2)} · p99 ${E.p99.toFixed(2)}\n`}
        {`DPR ${E.dpr} (dispositivo ${E.dprDispositivo}) · canvas ${E.w}×${E.h} = ${(E.w * E.h / 1e6).toFixed(2)} Mpx\n`}
        {`draw calls ${E.calls} · triángulos ${E.tris} · geometrías ${E.geos} · texturas ${E.texs} · programas ${E.progs}\n`}
        {`GPU: ${E.gpuNombre}\n`}
        {`tiempo de GPU: ${E.timer === "disponible" ? `${E.gpuMs.toFixed(2)} ms/cuadro` : E.timer}\n`}
        {`pasto (${P.montado ? P.modo : "no montado"}): mallas ${P.chunks} · dibujadas ${P.mallasVisibles} · en cuadro ${P.enCuadro} · capas dibujadas ${P.instancias} · suelo lejano ${P.lejanas}`}
      </div>

      <span style={{ ...LABEL, marginTop: 8 }}>Resolución adaptativa</span>
      <div style={MONO}>{`escalón ${E.escalon} · escalones ${E.escalones} · cambios ${E.cambios} · última ventana ${E.ultimoFpsEval.toFixed(1)} FPS${E.bloqueadoPor ? ` · quieto por ${E.bloqueadoPor}` : ""}`}</div>
      <div style={ROW}>
        <span>DPR_AUTO</span>
        <button style={BTN} onClick={() => { R.DPR_AUTO = !R.DPR_AUTO; tocar(); }}>{R.DPR_AUTO ? "ON" : "off"}</button>
      </div>
      <div style={ROW}>
        {[1.5, 1.0, 0.7, 0.5].map(v => <button key={v} style={BTN} onClick={() => emitir("alight:rend-forzar-dpr", { dpr: v })}>Forzar DPR {v}</button>)}
        <button style={BTN} onClick={() => emitir("alight:rend-forzar-dpr", { dpr: 0 })}>auto</button>
      </div>

      <span style={{ ...LABEL, marginTop: 8 }}>Sistemas <span style={NOTE}>(apagar = sin costo de dibujo; solo para medir)</span></span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
        {SISTEMAS.map(s => (
          <button key={s.id} title={s.como} style={{ ...BTN, opacity: R.SIS[s.id] !== false ? 1 : 0.4 }}
            onClick={() => { R.SIS[s.id] = R.SIS[s.id] === false; tocar(); }}>{s.etiqueta}{R.SIS[s.id] === false ? " (off)" : ""}</button>
        ))}
      </div>

      <span style={{ ...LABEL, marginTop: 8 }}>Optimización del pasto</span>
      {FLAGS_PASTO.map(k => (
        <div key={k} style={ROW}>
          <span>{k}</span>
          <button style={BTN} onClick={() => { R[k] = !R[k]; tocar(); }}>{R[k] ? "ON" : "off"}</button>
        </div>
      ))}
      {NUM.map(([k, mn, mx, st, nota]) => (
        <div key={k} style={ROW}>
          <span>{k} <span style={NOTE}>{(R[k] as number).toFixed(st < 1 ? 2 : 0)} {nota}</span></span>
          <input type="range" min={mn} max={mx} step={st} style={{ flex: 1 }} value={R[k] as number}
            onChange={e => { (R as Record<string, unknown>)[k] = parseFloat(e.target.value); tocar(); }} />
        </div>
      ))}

      <span style={{ ...LABEL, marginTop: 8 }}>Benchmark <span style={NOTE}>(cámara quieta; ~94 s)</span></span>
      <div style={ROW}>
        <button style={BTN} onClick={() => emitir("alight:rend-estres")}>Escena de estrés</button>
        <span style={NOTE}>{E.estres}</span>
      </div>
      <div style={ROW}>
        <button style={BTN} disabled={E.benchActivo} onClick={() => { setCopiado(""); emitir("alight:rend-bench"); }}>Benchmark (aprox. 2 min)</button>
        <button style={BTN} disabled={!E.benchActivo} onClick={() => emitir("alight:rend-bench-cancelar")}>Cancelar</button>
      </div>
      {E.bench && <div style={MONO}>{E.bench}</div>}
      {E.reporte && (
        <>
          <textarea readOnly value={E.reporte} style={{ ...MONO, width: "100%", height: 220, background: "rgba(0,0,0,0.35)", border: "1px solid #334" }} />
          <div style={ROW}>
            <button style={BTN} onClick={copiar}>Copiar reporte</button>
            <span style={NOTE}>{copiado}</span>
          </div>
        </>
      )}
    </div>
  );
}
