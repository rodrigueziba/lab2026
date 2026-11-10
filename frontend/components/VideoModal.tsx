"use client";
// Video (etapa 1, "lo seguro"): reproductor de YouTube APARTE, en un modal retro sobre el canvas.
// Se abre con el evento alight:ver-video { videoId, titulo } (botón "▶ VER VIDEO" de la FICHA o
// clic con la retícula sobre el panel abierto). Al abrir suelta el pointer lock; al cerrar lo
// vuelve a pedir (gesto del usuario: el clic en CERRAR). Controles normales del reproductor.
// Si el video no se puede embeber (errores 100/101/150 de la IFrame API) muestra un aviso y
// "ABRIR EN YOUTUBE ↗". El video no lleva nada encima (políticas de YouTube): el estilo retro
// va en el marco. Limpieza: player.destroy() al cerrar, con visualizer-activate y al desmontar.

import { useCallback, useEffect, useRef, useState } from "react";
import { DBG_VIDEO } from "@/lib/debugConfig";

// ── tipos mínimos de la YouTube IFrame Player API ──
interface YTPlayer { destroy(): void }
interface YTNamespace {
  Player: new (el: HTMLElement, opts: {
    host?: string; videoId: string; width?: string; height?: string;
    playerVars?: Record<string, number | string>;
    events?: { onError?: (e: { data: number }) => void };
  }) => YTPlayer;
}
declare global {
  interface Window { YT?: YTNamespace; onYouTubeIframeAPIReady?: () => void }
}

let _apiPromesa: Promise<YTNamespace> | null = null;
function cargarApiYT(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (_apiPromesa) return _apiPromesa;
  _apiPromesa = new Promise((res, rej) => {
    const previo = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { previo?.(); if (window.YT) res(window.YT); };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    s.onerror = () => { _apiPromesa = null; rej(new Error("no cargó la API de YouTube")); };
    document.head.appendChild(s);
  });
  return _apiPromesa;
}

const C = { beige: "#E8DCC4", carbon: "#3A3B3C", negro: "#12101A", ambar: "#FF9A1F", ambarFondo: "#2A1400", oxido: "#C0552F" };
const FRANJAS = ["#E5322B", "#F0742A", "#F4B62E", "#2E9E5B", "#1F7FB8"];
const MONO = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace";

type Abierto = { videoId: string; titulo: string } | null;

export default function VideoModal() {
  const [abierto, setAbierto] = useState<Abierto>(null);
  const [error, setError] = useState<string | null>(null);
  const contRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);

  const destruir = useCallback(() => {
    try { playerRef.current?.destroy(); } catch { /* ya destruido */ }
    playerRef.current = null;
  }, []);

  const cerrar = useCallback((relock: boolean) => {
    destruir();
    setAbierto(null);
    setError(null);
    // gesto del usuario (clic en CERRAR) → se puede volver a capturar el mouse
    if (relock && DBG_VIDEO.YT_RELOCK) {
      const canvas = document.querySelector("canvas");
      try {
        const r = canvas?.requestPointerLock() as unknown as Promise<void> | undefined;
        r?.catch?.(() => { /* el navegador puede pedir esperar: un clic en la escena lo recupera */ });
      } catch { /* idem */ }
    }
  }, [destruir]);

  // abrir con el evento
  useEffect(() => {
    const onVer = (e: Event) => {
      if (!DBG_VIDEO.YT_MODAL) return;
      const det = (e as CustomEvent<{ videoId: string; titulo: string }>).detail;
      if (!det?.videoId) return;
      if (document.pointerLockElement) document.exitPointerLock();
      setError(null);
      setAbierto({ videoId: det.videoId, titulo: det.titulo || "" });
    };
    const onViz = () => cerrar(false);              // el visualizador cancela todo
    window.addEventListener("alight:ver-video", onVer);
    window.addEventListener("alight:visualizer-activate", onViz);
    return () => {
      window.removeEventListener("alight:ver-video", onVer);
      window.removeEventListener("alight:visualizer-activate", onViz);
      destruir();
    };
  }, [cerrar, destruir]);

  // crear el reproductor cuando el modal está abierto
  useEffect(() => {
    if (!abierto) return;
    let vivo = true;
    const el = contRef.current;
    if (!el) return;
    const destino = document.createElement("div");   // la API reemplaza este nodo por el iframe
    el.appendChild(destino);
    cargarApiYT().then(YT => {
      if (!vivo) return;
      playerRef.current = new YT.Player(destino, {
        host: DBG_VIDEO.YT_NOCOOKIE ? "https://www.youtube-nocookie.com" : "https://www.youtube.com",
        videoId: abierto.videoId, width: "100%", height: "100%",
        playerVars: { autoplay: 1, rel: 0, playsinline: 1, iv_load_policy: 3 },
        events: {
          onError: ev => {
            if (!vivo) return;
            setError(ev.data === 101 || ev.data === 150 ? "El dueño del video no permite verlo fuera de YouTube."
              : ev.data === 100 ? "El video no existe o es privado." : "No se pudo reproducir el video.");
          },
        },
      });
    }).catch(() => { if (vivo) setError("No se pudo cargar el reproductor (¿sin conexión?)."); });
    return () => { vivo = false; destruir(); if (destino.parentNode) destino.parentNode.removeChild(destino); el.innerHTML = ""; };
  }, [abierto, destruir]);

  // Esc cierra (sin relock: Esc no es un gesto válido para capturar el mouse)
  useEffect(() => {
    if (!abierto) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") cerrar(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [abierto, cerrar]);

  if (!abierto) return null;
  const urlYT = `https://www.youtube.com/watch?v=${abierto.videoId}`;
  const boton: React.CSSProperties = {
    fontFamily: MONO, fontWeight: 700, fontSize: 14, letterSpacing: "0.12em", padding: "8px 16px",
    border: `2px solid ${C.carbon}`, background: C.beige, color: C.carbon, cursor: "pointer",
    boxShadow: "3px 4px 0 rgba(0,0,0,0.35)",
  };
  return (
    <div
      role="dialog" aria-modal="true" aria-label={`Video: ${abierto.titulo}`}
      // drei PointerLockControls escucha 'click' en document y volvería a capturar el mouse con
      // cualquier clic del modal: se corta la propagación acá (los links igual navegan)
      onClick={e => { e.stopPropagation(); if (e.target === e.currentTarget) cerrar(true); }}
      style={{ position: "fixed", inset: 0, zIndex: 9500, background: "rgba(10,8,14,0.82)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div style={{ width: "min(1100px, 100%)", background: C.carbon, border: `3px solid ${C.negro}`,
        boxShadow: "0 0 0 2px #000, 0 24px 60px rgba(0,0,0,0.6)" }}>
        {/* cabecera: marca ficticia + título */}
        <div style={{ background: C.negro, padding: "12px 16px 8px", display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16 }}>
          <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 20, letterSpacing: "0.3em", color: C.beige, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            VIDEO · {abierto.titulo.toUpperCase()}
          </span>
          <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.2em", color: C.ambar, whiteSpace: "nowrap" }}>
            AUSTRAL ELECTRIC · VTR-07
          </span>
        </div>
        {/* guarda de franjas */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          {FRANJAS.map(c => <div key={c} style={{ height: 3, background: c }} />)}
        </div>
        {/* pantalla: bisel retro alrededor; el video sin nada encima */}
        <div style={{ padding: 14, background: C.carbon }}>
          <div style={{ background: "#1C1C1F", borderRadius: 14, padding: 10 }}>
            <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 9", background: "#000", borderRadius: 8, overflow: "hidden" }}>
              <div ref={contRef} style={{ position: "absolute", inset: 0 }} />
              {error && (
                <div style={{ position: "absolute", inset: 0, background: C.ambarFondo, display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", gap: 18, padding: 24, textAlign: "center" }}>
                  <span style={{ fontFamily: MONO, color: C.ambar, fontSize: 16, letterSpacing: "0.1em" }}>{error}</span>
                  <a href={urlYT} target="_blank" rel="noreferrer" style={{ ...boton, textDecoration: "none", background: C.ambarFondo, color: C.ambar, borderColor: C.ambar }}>
                    ABRIR EN YOUTUBE ↗
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
        {/* botonera */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 14px 14px", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.2em", color: "#8A8478" }}>ESC · CERRAR</span>
          <div style={{ display: "flex", gap: 10 }}>
            <a href={urlYT} target="_blank" rel="noreferrer" style={{ ...boton, textDecoration: "none" }}>ABRIR EN YOUTUBE ↗</a>
            <button type="button" onClick={() => cerrar(true)} style={{ ...boton, background: C.ambarFondo, color: C.ambar, borderColor: C.ambar }}>
              ✕ CERRAR
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
