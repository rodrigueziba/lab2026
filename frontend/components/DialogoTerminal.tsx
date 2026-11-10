"use client";
// Z27: terminal de diálogo del camino LUZ: overlay HTML sobre el canvas (no se conecta al mundo:
// eso es Z28). Se abre con 'alight:dialogo-abrir' { knot? } (botón "Probar diálogo" del menú debug)
// y se cierra con Escape o 'alight:dialogo-cerrar'.
// - La entidad tipea letra por letra (DBG_DIALOGO.VEL_CPS); Espacio o clic completa la línea.
// - Opciones numeradas 1–4, solo por teclado. La elección queda como eco "> texto".
// - Efectos: 'alight:dialogo-efecto' { efecto, id } (no ejecuta nada en el mundo).
//   Final sin opciones: 'alight:dialogo-fin' { id }. Lógica de líneas en lib/dialogo/terminalFlujo.ts.
// - Teclado: solo 1–4, Espacio y Escape, en captura y solo mientras está activa. Shift y el
//   pointer lock no se tocan. Clics del panel no llegan a document (drei re-captura el mouse ahí).
// - Sin innerHTML: cursiva/negrita son <em>/<strong> armados desde los segmentos.
// - Timers (setInterval/setTimeout) y listeners se liberan al cerrar y al desmontar.

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { DBG_DIALOGO, DEBUG_MENU_ESTADO } from "@/lib/debugConfig";
import { cargarDialogo } from "@/lib/dialogo/dialogoInk";
import type { DialogoInk, OpcionDialogo, PasoDialogo, Segmento } from "@/lib/dialogo/dialogoInk";
import { planDePaso, lineaEco, largoSegmentos } from "@/lib/dialogo/terminalFlujo";
import type { Linea, PlanPaso } from "@/lib/dialogo/terminalFlujo";
import { DIALOGO_STATE } from "@/lib/dialogo/dialogoEstado";

const C = { beige: "#E8DCC4", carbon: "#3A3B3C", negro: "#12101A", ambar: "#FF9A1F", ambarFondo: "#2A1400", oxido: "#C0552F" };
const FRANJAS = ["#E5322B", "#F0742A", "#F4B62E", "#2E9E5B", "#1F7FB8"];
const MONO = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace";
// glow de fósforo + aberración cromática leve (corrimiento rojo/azul de ±0.6 px)
const GLOW = "0 0 6px rgba(255,154,31,0.55), 0 0 14px rgba(255,120,20,0.25), 0.6px 0 0 rgba(255,60,40,0.35), -0.6px 0 0 rgba(60,140,255,0.25)";
const CSS = `
@keyframes dlgCursor { 0%,49% { opacity: 1 } 50%,100% { opacity: 0 } }
@keyframes dlgFlicker { 0% { opacity: .97 } 50% { opacity: 1 } 100% { opacity: .98 } }
`;

type Fase = "cerrado" | "cargando" | "escribiendo" | "opciones" | "fin" | "error";
interface LineaH extends Linea { k: number }

function renderSegmentos(segs: readonly Segmento[], limite: number): ReactNode[] {
  const out: ReactNode[] = [];
  let resto = limite;
  for (let i = 0; i < segs.length && resto > 0; i++) {
    const s = segs[i];
    const t = s.texto.length <= resto ? s.texto : s.texto.slice(0, resto);
    resto -= t.length;
    if (s.estilo === "cursiva") out.push(<em key={i}>{t}</em>);
    else if (s.estilo === "negrita") out.push(<strong key={i} style={{ fontWeight: 800, color: "#FFC46A" }}>{t}</strong>);
    else out.push(<span key={i}>{t}</span>);
  }
  return out;
}

const colorLinea = (l: Linea) =>
  l.tipo === "eco" ? C.beige : l.tipo === "pendiente" ? "#FF5A3C" : C.ambar;

export default function DialogoTerminal() {
  const [fase, setFase] = useState<Fase>("cerrado");
  const [hist, setHist] = useState<LineaH[]>([]);
  const [actual, setActual] = useState<LineaH | null>(null);
  const [mostrados, setMostrados] = useState(0);
  const [opciones, setOpciones] = useState<OpcionDialogo[]>([]);
  const [nodo, setNodo] = useState("");
  const [cfg, setCfg] = useState(() => ({ ...DBG_DIALOGO }));

  // Toda la máquina vive en este efecto: variables locales del closure (no refs ni estado de
  // React para lo que no se pinta). Se registra una vez; los listeners salen al desmontar.
  useEffect(() => {
    let dlg: DialogoInk | null = null;
    let cargaPend: Promise<DialogoInk> | null = null;
    let activo = false;
    let faseL: Fase = "cerrado";
    let cola: Linea[] = [];
    let plan: PlanPaso | null = null;
    let lineaAct: LineaH | null = null;
    let total = 0;
    let t0 = 0;
    let k = 0;
    let sesion = 0;                                   // invalida cargas/timers de una apertura previa
    let intervalo: ReturnType<typeof setInterval> | null = null;
    let pausa: ReturnType<typeof setTimeout> | null = null;

    const ponerFase = (f: Fase) => { faseL = f; setFase(f); };
    const limpiarTimers = () => {
      if (intervalo !== null) { clearInterval(intervalo); intervalo = null; }
      if (pausa !== null) { clearTimeout(pausa); pausa = null; }
    };
    const pushHist = (l: Linea) => {
      const h: LineaH = { ...l, k: k++ };
      setHist(prev => {
        const max = Math.max(1, Math.round(DBG_DIALOGO.HISTORIAL));
        const next = prev.length >= max ? prev.slice(prev.length - max + 1) : prev.slice();
        next.push(h);
        return next;
      });
    };

    const terminarLinea = () => {
      if (intervalo !== null) { clearInterval(intervalo); intervalo = null; }
      if (lineaAct) pushHist(lineaAct);
      lineaAct = null;
      setActual(null);
      setMostrados(0);
      const s = sesion;
      pausa = setTimeout(() => { pausa = null; if (s === sesion) siguiente(); }, Math.max(0, DBG_DIALOGO.PAUSA_MS));
    };

    const siguiente = () => {
      const l = cola.shift();
      if (l) {
        lineaAct = { ...l, k: k++ };
        total = largoSegmentos(l.segmentos);
        t0 = performance.now();
        setActual(lineaAct);
        setMostrados(0);
        ponerFase("escribiendo");
        if (DBG_DIALOGO.VEL_CPS <= 0 || total === 0) { terminarLinea(); return; }
        intervalo = setInterval(() => {
          const cps = DBG_DIALOGO.VEL_CPS;        // live: se puede cambiar a mitad de línea
          const n = cps <= 0 ? total : Math.floor(((performance.now() - t0) * cps) / 1000);
          if (n >= total) terminarLinea();
          else setMostrados(n);
        }, 16);
        return;
      }
      if (!plan || plan.fin) {
        ponerFase("fin");
        setOpciones([]);
        window.dispatchEvent(new CustomEvent("alight:dialogo-fin", { detail: { id: plan?.id ?? "" } }));
        return;
      }
      setOpciones(plan.opciones);
      ponerFase("opciones");
    };

    const aplicarPaso = (paso: PasoDialogo) => {
      plan = planDePaso(paso, DEBUG_MENU_ESTADO.visible && DBG_DIALOGO.MARCAR_PENDIENTES);
      DIALOGO_STATE.nodo = plan.id;
      setNodo(plan.id);
      if (plan.efecto) {
        window.dispatchEvent(new CustomEvent("alight:dialogo-efecto", { detail: { efecto: plan.efecto, id: plan.id } }));
      }
      cola = plan.lineas.slice();
      siguiente();
    };

    const completar = () => {
      if (faseL !== "escribiendo" || !lineaAct) return;
      terminarLinea();
    };

    const elegir = (i: number) => {
      if (faseL !== "opciones" || !plan || !dlg) return;
      const op = plan.opciones[i];
      if (!op) return;
      pushHist(lineaEco(op));
      setOpciones([]);
      aplicarPaso(dlg.elegir(op.indice));
    };

    const cerrar = () => {
      if (!activo) return;
      activo = false;
      sesion++;
      limpiarTimers();
      cola = []; plan = null; lineaAct = null;
      DIALOGO_STATE.activo = false;
      DIALOGO_STATE.nodo = "";
      ponerFase("cerrado");
      setHist([]); setActual(null); setOpciones([]); setNodo("");
      window.dispatchEvent(new CustomEvent("alight:dialogo-cerrado"));
    };

    const abrir = (knot?: string) => {
      sesion++;
      limpiarTimers();
      const s = sesion;
      activo = true;
      DIALOGO_STATE.activo = true;
      cola = []; plan = null; lineaAct = null;
      setHist([]); setActual(null); setOpciones([]); setMostrados(0);
      setCfg({ ...DBG_DIALOGO });
      ponerFase("cargando");
      if (!cargaPend) cargaPend = cargarDialogo();
      cargaPend.then(d => {
        if (s !== sesion || !activo) return;
        dlg = d;
        try {
          aplicarPaso(knot ? d.irA(knot) : d.iniciar());
        } catch (err) {
          console.error("[DialogoTerminal]", err);
          ponerFase("error");
        }
      }).catch(err => {
        cargaPend = null;                                 // permitir reintentar
        console.error("[DialogoTerminal]", err);
        if (s === sesion) ponerFase("error");
      });
    };

    const onAbrir = (e: Event) => abrir((e as CustomEvent<{ knot?: string } | undefined>).detail?.knot);
    const onCerrar = () => cerrar();
    const onConfig = () => setCfg({ ...DBG_DIALOGO });

    // Captura en window: corre antes que cualquier otro keydown de la app. Solo 1–4, Espacio y
    // Escape, solo con la terminal activa y nunca con el foco en un campo de texto (menú debug).
    const onKey = (e: KeyboardEvent) => {
      if (!activo) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (e.key === "Escape") { e.stopPropagation(); cerrar(); return; }
      if (e.code === "Space" || e.key === " ") {
        e.preventDefault(); e.stopPropagation();
        if (!e.repeat) completar();
        return;
      }
      const m = /^(?:Digit|Numpad)([1-4])$/.exec(e.code);
      const num = m ? Number(m[1]) : (e.key >= "1" && e.key <= "4" && e.key.length === 1 ? Number(e.key) : 0);
      if (num) {
        e.preventDefault(); e.stopPropagation();
        if (!e.repeat) elegir(num - 1);
      }
    };
    // Con el mouse capturado (pointer lock) los clics van al canvas: un clic izquierdo también
    // completa la línea. No se corta la propagación (el juego sigue recibiendo el clic).
    const onMouseDown = (e: MouseEvent) => {
      if (activo && e.button === 0 && document.pointerLockElement) completar();
    };
    const onCompletar = () => completar();
    // Espacio sobre un botón con foco lo "clickea" al soltar: también se consume el keyup
    const onKeyUp = (e: KeyboardEvent) => {
      if (activo && (e.code === "Space" || e.key === " ")) { e.preventDefault(); e.stopPropagation(); }
    };

    window.addEventListener("alight:dialogo-abrir", onAbrir);
    window.addEventListener("alight:dialogo-cerrar", onCerrar);
    window.addEventListener("alight:dialogo-config", onConfig);
    window.addEventListener("alight:dialogo-completar", onCompletar);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("mousedown", onMouseDown);
    return () => {
      sesion++;
      limpiarTimers();
      window.removeEventListener("alight:dialogo-abrir", onAbrir);
      window.removeEventListener("alight:dialogo-cerrar", onCerrar);
      window.removeEventListener("alight:dialogo-config", onConfig);
      window.removeEventListener("alight:dialogo-completar", onCompletar);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("mousedown", onMouseDown);
      DIALOGO_STATE.activo = false;
      DIALOGO_STATE.nodo = "";
    };
  }, []);

  if (fase === "cerrado") return null;

  // clics dentro del panel: no llegan a document (drei PointerLockControls) y completan la línea
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  const ancho = `${Math.min(60, Math.max(20, cfg.ANCHO_VW))}vw`;
  const pos: React.CSSProperties =
    cfg.POSICION === "izquierda" ? { left: cfg.MARGEN_PX, bottom: cfg.MARGEN_PX }
    : cfg.POSICION === "derecha" ? { right: cfg.MARGEN_PX, bottom: cfg.MARGEN_PX }
    : { left: "50%", bottom: cfg.MARGEN_PX, transform: "translateX(-50%)" };
  const fs = cfg.FUENTE_PX;
  const n = hist.length;

  return (
    <div
      role="dialog" aria-label="Terminal de diálogo" aria-live="polite"
      onPointerDown={stop} onMouseDown={stop} onMouseUp={stop} onWheel={stop}
      onClick={e => { e.stopPropagation(); window.dispatchEvent(new CustomEvent("alight:dialogo-completar")); }}
      style={{ position: "fixed", zIndex: 3500, width: ancho, maxWidth: "60vw", ...pos,
        background: C.carbon, border: `3px solid ${C.negro}`, borderRadius: 6,
        boxShadow: "0 0 0 2px #000, 0 18px 40px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(232,220,196,0.08)",
        fontFamily: MONO, userSelect: "none", cursor: "default" }}
    >
      <style>{CSS}</style>
      {/* cabecera: bloque de marca ficticia + serigrafía técnica */}
      <div style={{ background: C.negro, padding: "7px 12px 5px", display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: "0.32em", color: C.beige, whiteSpace: "nowrap" }}>
          AUSTRAL ELECTRIC
        </span>
        <span style={{ fontSize: 10, letterSpacing: "0.18em", color: "#8A8478", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          ENLACE DE VOZ · 9600 BD · CANAL {nodo || "--"}
        </span>
        <span style={{ fontWeight: 700, fontSize: 11, letterSpacing: "0.2em", color: C.ambar, whiteSpace: "nowrap" }}>KX-07M</span>
      </div>
      {/* guarda de franjas */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {FRANJAS.map(c => <div key={c} style={{ height: 3, background: c }} />)}
      </div>
      {/* bisel + pantalla CRT */}
      <div style={{ padding: 10 }}>
        <div style={{ background: "#1C1C1F", borderRadius: 16, padding: 7, boxShadow: "inset 0 2px 6px rgba(0,0,0,0.7)" }}>
          <div style={{ position: "relative", background: C.ambarFondo, borderRadius: "22px / 18px", overflow: "hidden",
            maxHeight: `${cfg.ALTO_VH}vh`, minHeight: fs * 5.5, display: "flex", flexDirection: "column", justifyContent: "flex-end",
            padding: "14px 20px 12px", boxShadow: "inset 0 0 38px rgba(0,0,0,0.85), inset 0 0 90px rgba(0,0,0,0.45)",
            animation: "dlgFlicker 0.12s infinite alternate" }}>
            <div style={{ fontSize: fs, lineHeight: 1.45, color: C.ambar, textShadow: GLOW, letterSpacing: "0.02em" }}>
              {fase === "cargando" && <div style={{ opacity: 0.6 }}>ESTABLECIENDO ENLACE…</div>}
              {fase === "error" && <div style={{ color: "#FF5A3C" }}>[ SIN SEÑAL: no se pudo cargar el diálogo ]</div>}
              {hist.map((l, i) => (
                <div key={l.k} style={{ color: colorLinea(l), whiteSpace: "pre-wrap",
                  // las anteriores, atenuadas: la más vieja ~0.3, la última ~0.75
                  opacity: (l.tipo === "fin" ? 0.5 : 1) * (0.3 + 0.45 * ((i + 1) / Math.max(1, n))) }}>
                  {renderSegmentos(l.segmentos, Number.MAX_SAFE_INTEGER)}
                </div>
              ))}
              {actual && (
                <div style={{ color: colorLinea(actual), whiteSpace: "pre-wrap", opacity: actual.tipo === "fin" ? 0.55 : 1 }}>
                  {renderSegmentos(actual.segmentos, mostrados)}
                  <span style={{ animation: "dlgCursor 0.9s steps(1) infinite" }}>▮</span>
                </div>
              )}
              {fase === "opciones" && (
                <div style={{ marginTop: fs * 0.5 }}>
                  {opciones.map((o, i) => (
                    <div key={o.indice} style={{ whiteSpace: "pre-wrap" }}>
                      <span style={{ display: "inline-block", minWidth: fs * 2.2, color: C.beige, fontWeight: 700 }}>{i + 1}.</span>
                      {renderSegmentos(o.segmentos, Number.MAX_SAFE_INTEGER)}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* scanlines + viñeta de vidrio curvo (el texto queda debajo, sin eventos) */}
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none",
              background: "repeating-linear-gradient(to bottom, rgba(0,0,0,0.28) 0px, rgba(0,0,0,0.28) 1px, transparent 1px, transparent 3px)" }} />
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none",
              background: "radial-gradient(ellipse at 50% 45%, rgba(255,170,60,0.07) 0%, transparent 55%, rgba(0,0,0,0.45) 100%)" }} />
          </div>
        </div>
      </div>
      {/* pie: serigrafía de controles */}
      <div style={{ display: "flex", justifyContent: "space-between", padding: "0 12px 8px", gap: 10,
        fontSize: 10, letterSpacing: "0.18em", color: "#8A8478", whiteSpace: "nowrap", overflow: "hidden" }}>
        <span>1–4 · RESPONDER</span>
        <span>ESPACIO · COMPLETAR</span>
        <span>ESC · CORTAR</span>
      </div>
    </div>
  );
}
