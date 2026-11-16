"use client";

// C9: Debug overlay — toggle with Shift key.
// Z70: contenedor del menú reorganizado en pestañas. El estado y los efectos están en components/debug/estado.tsx
// (useDebugEstado, movidos tal cual), las secciones en components/debug/pestanas/*.tsx y su registro (pestaña, Z de
// origen y de última modificación, avanzada) en lib/debugSecciones.ts. Solo se dibujan las secciones de la pestaña
// activa (o las que coinciden con el buscador); con el menú cerrado no se dibuja nada.
// Al agregar o modificar controles: actualizar ultimoZ de la sección en lib/debugSecciones.ts y regenerar el índice del
// buscador (node scripts/debug-menu-indice.mjs).

import { createElement, useEffect, useState, type CSSProperties } from "react";
import { DEBUG_ENABLED } from "@/lib/debugConfig";
import { PANEL, ROW, NOTE, INPUT, TAB_BTN, DIVIDER } from "./debug/comun";
import { useDebugEstado } from "./debug/estado";
import { DebugCtx } from "./debug/contexto";
import { COMPONENTES_SECCION } from "./debug/mapaSecciones";
import {
  PESTANA_RECIENTES, ordenPestanas, seccionesDePestana, esNueva, tituloPestana, buscarSecciones,
  leerEstadoMenu, guardarEstadoMenu, type SeccionDebug,
} from "@/lib/debugSecciones";
import { INDICE_CONTROLES } from "@/lib/debugIndiceControles";

const MAX_RESULTADOS = 12;
const ETIQ: CSSProperties = { fontSize: 9, padding: "0 4px", borderRadius: 2, marginLeft: 4, border: "1px solid rgba(100,120,180,0.3)", color: "#7f8fb5" };
const NUEVO: CSSProperties = { ...ETIQ, color: "#ffb347", borderColor: "rgba(255,154,31,0.55)" };
const CABE: CSSProperties = { display: "flex", alignItems: "center", gap: 2, cursor: "pointer", marginBottom: 4, color: "#6f7fa6", fontSize: 10 };

/** localStorage sin romper el render del servidor ni los navegadores que lo bloquean. */
function almacen(): Storage | null {
  try { return typeof window !== "undefined" ? window.localStorage : null; } catch { return null; }
}

export default function DebugMenu() {
  const D = useDebugEstado();
  const { visible, setVisible, premio, avisoDesbloqueo, focusRef } = D;
  // Z70: pestaña, secciones plegadas (persisten) y buscador (no persiste)
  const [pestana, setPestana] = useState<string>(() => leerEstadoMenu(almacen())?.pestana ?? PESTANA_RECIENTES);
  const [plegadas, setPlegadas] = useState<Record<string, boolean>>(() => leerEstadoMenu(almacen())?.plegadas ?? {});
  const [busca, setBusca] = useState("");
  useEffect(() => { guardarEstadoMenu(almacen(), { pestana, plegadas }); }, [pestana, plegadas]);

  // Z29: aviso tenue de desbloqueo (también con el menú cerrado)
  const aviso = avisoDesbloqueo ? (
    <div style={{ position: "fixed", left: "50%", top: 18, transform: "translateX(-50%)", zIndex: 4000, pointerEvents: "none",
      fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11, letterSpacing: "0.22em", color: "rgba(255,154,31,0.55)",
      textShadow: "0 0 6px rgba(255,154,31,0.35)" }}>
      ▸ MENÚ DE CONTROL DESBLOQUEADO · SHIFT
    </div>
  ) : null;

  if (!(DEBUG_ENABLED || premio) || !visible) return aviso;

  // U8: stop all pointer/mouse/click/wheel events from bubbling out of the panel.
  // React SyntheticEvent.stopPropagation() also calls nativeEvent.stopPropagation(),
  // which prevents events from reaching document — where drei's PointerLockControls
  // listener lives (it adds `document.addEventListener('click', () => controls.lock())`
  // when no `selector` prop is given).
  const stopBubble = (e: React.SyntheticEvent) => e.stopPropagation();

  const pestanas = ordenPestanas();
  const enBusqueda = busca.trim().length > 0;
  const resultados = enBusqueda ? buscarSecciones(busca, INDICE_CONTROLES) : [];
  const lista: { s: SeccionDebug; co?: string[] }[] = enBusqueda
    ? resultados.slice(0, MAX_RESULTADOS).map(r => ({ s: r.seccion, co: r.coincidencias }))
    : seccionesDePestana(pestana).map(s => ({ s }));
  const mixta = enBusqueda || pestana === PESTANA_RECIENTES;

  return (
    <div
      data-debug-panel="1"
      style={PANEL}
      onFocus={() => { focusRef.current = true; }}
      onBlur={() =>  { focusRef.current = false; }}
      onPointerDown={stopBubble}
      onMouseDown={stopBubble}
      onMouseUp={stopBubble}
      onClick={stopBubble}
      onWheel={stopBubble}
    >
      <div style={{ marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ color: "#aabbd0", fontWeight: "bold", fontSize: 12 }}>⬛ Debug [Shift]</span>
        <span
          style={{ cursor: "pointer", color: "#556080", fontSize: 13, lineHeight: 1 }}
          onClick={() => setVisible(false)}
        >✕</span>
      </div>
      {aviso}

      {/* Z29: premio — opción del mapa de decisiones (todavía sin implementar) */}
      {premio && (
        <div style={ROW}>
          <span>ver mapa de decisiones <span style={NOTE}>(pendiente de implementar)</span></span>
          <button style={{ ...INPUT, opacity: 0.4, cursor: "not-allowed" }} disabled>off</button>
        </div>
      )}

      {/* Z70: buscador (filtra en todas las pestañas; vaciarlo vuelve a la pestaña) */}
      <div style={{ ...ROW, marginBottom: 8 }}>
        <input type="text" placeholder="buscar control o sección…" value={busca} data-debug-buscador="1"
          style={{ ...INPUT, width: "100%" }} onChange={e => setBusca(e.target.value)} />
        {enBusqueda && <button style={INPUT} onClick={() => setBusca("")}>✕</button>}
      </div>

      {/* Z70: pestañas (Recientes primero; el resto según la última modificación de sus secciones) */}
      {!enBusqueda && (
        <div style={{ marginBottom: 10, display: "flex", flexWrap: "wrap", gap: 4, maxWidth: 520 }}>
          {pestanas.map(p => (
            <button key={p.id} style={{ ...TAB_BTN(pestana === p.id), marginRight: 0 }} onClick={() => setPestana(p.id)}>{p.titulo}</button>
          ))}
        </div>
      )}
      {enBusqueda && (
        <div style={{ ...NOTE, marginLeft: 0, marginBottom: 8 }}>
          {resultados.length ? `${resultados.length} sección(es)${resultados.length > MAX_RESULTADOS ? ` (se muestran ${MAX_RESULTADOS})` : ""}` : "sin coincidencias"}
        </div>
      )}

      <DebugCtx.Provider value={D}>
        {lista.map(({ s, co }, i) => {
          const plegada = !enBusqueda && (plegadas[s.id] ?? s.avanzada);
          const comp = COMPONENTES_SECCION[s.id];
          return (
            <div key={s.id}>
              {i > 0 && <div style={DIVIDER} />}
              <div style={CABE} onClick={() => setPlegadas(p => ({ ...p, [s.id]: !plegada }))} title={s.descripcion}>
                <span>{plegada ? "▸" : "▾"}</span>
                {(plegada || mixta) && <span style={{ color: "#8899bb" }}>{s.titulo}</span>}
                {mixta && <span style={ETIQ}>{tituloPestana(s.pestana)}</span>}
                <span style={ETIQ}>{s.desdeZ > 0 ? `Z${s.desdeZ}` : "pre-Z"}{s.ultimoZ > s.desdeZ ? ` → Z${s.ultimoZ}` : ""}</span>
                {esNueva(s) && <span style={NUEVO}>NUEVO</span>}
                {s.clase === "obsoleta" && <span style={ETIQ}>obsoleta</span>}
                {s.avanzada && <span style={ETIQ}>avanzada</span>}
              </div>
              {co && co.length > 0 && <div style={{ ...NOTE, marginLeft: 0, marginBottom: 4 }}>coincide: {co.slice(0, 8).join(", ")}{co.length > 8 ? "…" : ""}</div>}
              {!plegada && comp && createElement(comp)}
            </div>
          );
        })}
      </DebugCtx.Provider>
    </div>
  );
}
