// Z91: une el consentimiento de la tarima (lib/consentTarima.ts) con los eventos de la escena, la terminal de ink
// (misma interfaz que Z85: abrirDialogo(knot, RUTA_TARIMA_EXPONERSE)), los atriles (requestLecterns, el mismo mecanismo
// de J1), la publicación de la presencia (Z89: publicarPresencia / detenerPresencia) y el indicador "● EN VIVO".
// Lo maneja components/ConsentTarimaHost.tsx (tick por cuadro), montado junto a LecternSystem (camino TARIMA): al
// desmontarse (salir de la tarima, checkpoint) corta la transmisión y olvida la elección. Recargar o cerrar la pestaña
// la corta por pagehide (lo instala publicarPresencia, Z89); la elección queda en sessionStorage para no repreguntar.
// Bloqueo de movimiento mientras la terminal está abierta: razón propia en BLOQUEO_MOV (lib/entradaTelon.ts), sin tocar
// INTERACT_STATE.movementLocked (secuencia SILLAS, camino LUZ, aviso de Z85).
// Indicador: HTML fijo arriba a la derecha, fuera del canvas (no pasa por el CRT), ámbar #FF9A1F sobre #2A1400, con el
// botón "CORTAR TRANSMISIÓN". Tecla X: corta, salvo dentro de los atriles de imagen y sonido, donde X es un atajo de
// sus controles (ahí el puntero está libre y se usa el botón). Sin contador de espectadores (no existe todavía).
// Z93a: el flujo lo arranca el tick (tickSubida) cuando las figuras emergieron (o ESPERA_FIGURAS_MAX_S después de elegir
// la tarima si no llegan) y el usuario está sobre la tarima; bajar antes de elegir lo cancela y volver a subir lo reinicia.
// Con ATRILES_TRAS_CONSENTIMIENTO, los atriles (y la caja de ritmos, que vive dentro de LecternSystem) esperan la elección.

import { DBG_CONSENT, DBG_ONDAS_TARIMA, DBG_LIVEKIT, DEBUG_ENABLED } from "@/lib/debugConfig";
import { INTERACT_STATE, requestLecterns } from "@/lib/alightStore";
import { abrirDialogo, cerrarDialogo, DIALOGO_STATE } from "@/lib/dialogo/dialogoEstado";
import { RUTA_TARIMA_EXPONERSE } from "@/lib/dialogo/dialogoInk";
import { bloquearMovimiento, liberarMovimiento } from "@/lib/entradaTelon";
import { publicarPresencia, detenerPresencia, estadoPublicador, sesionIdNavegador } from "@/lib/vivo/vivoAcciones";
import { publicarLiveKit, detenerLiveKit, estadoLiveKit } from "@/lib/vivo/publicarLiveKit";   // Z92: video y audio
import { FUENTE_TARIMA } from "@/lib/fuenteVideoTarima";
import { ZONA_TARIMA } from "@/lib/layoutSala";   // Z93a: la misma zona que dispara alight:chose-light
import { elegirFuente } from "@/lib/ondasTarima";
import {
  crearConsent, iniciarConsent, tickConsent, finTexto1, elegirConsent, cortarConsent, forzarTexto1, forzarEleccion,
  reiniciarConsent, modoSegunFuente, segundosTx, segundosRestantes, serializarConsent, leerRecordado, aplicarRecordado,
  crearSubida, tickSubida, faseConsent, atrilesPermitidos,   // Z93a
  type Eleccion, type ResultadoEleccion,
} from "@/lib/consentTarima";

export const CLAVE_CONSENT = "alight:consent-tarima";
export const CONSENT = crearConsent();
export const SUBIDA = crearSubida();   // Z93a
const RAZON = "consentimiento-tarima";
const AUX = { terminalNuestra: false, atrilesVisibles: false, ultimoError: "" };
let _cierre: ReturnType<typeof setTimeout> | null = null;

function almacen(): Storage | null {
  if (typeof window === "undefined") return null;
  try { return window.sessionStorage; } catch { return null; }
}
function guardar(): void {
  const st = almacen(); if (!st) return;
  try {
    const v = DBG_CONSENT.RECORDAR_EN_SESION ? serializarConsent(CONSENT) : null;
    if (v) st.setItem(CLAVE_CONSENT, v); else st.removeItem(CLAVE_CONSENT);
  } catch { /* solo memoria */ }
}
function olvidar(): void { const st = almacen(); if (st) { try { st.removeItem(CLAVE_CONSENT); } catch { /* ok */ } } }

/** Modo de la presencia según la fuente de video de la tarima en este momento (Z87). */
export function modoActual(): "cara" | "privado" {
  elegirFuente(DBG_ONDAS_TARIMA.MODO, FUENTE_TARIMA.cam, FUENTE_TARIMA.eleccion);
  return modoSegunFuente(FUENTE_TARIMA.eleccion.tipo);
}

function pedirAtriles(): void { if (!AUX.atrilesVisibles) requestLecterns(); }

function aplicar(res: ResultadoEleccion): void {
  if (res.atriles) pedirAtriles();
  if (res.publicar) {
    const r = publicarPresencia({ modo: CONSENT.modo ?? "privado", consentimiento: true });
    AUX.ultimoError = r.ok ? "" : r.motivo;   // falla: la sesión sigue local y el indicador lo muestra
    // Z92: video y audio por LiveKit, con el mismo consentimiento explícito y el mismo sesionId que la presencia
    if (DBG_LIVEKIT.ACTIVO) publicarLiveKit({ consentimiento: true, modo: CONSENT.modo ?? "privado", sesionId: sesionIdNavegador() });
  }
  guardar();
}

function abrirTerminal(knot: "tx_texto1" | "tx_eleccion"): void {
  AUX.terminalNuestra = true;
  bloquearMovimiento(RAZON);
  abrirDialogo(knot, RUTA_TARIMA_EXPONERSE);
}
function terminalLiberada(): void {
  AUX.terminalNuestra = false;
  liberarMovimiento(RAZON);
}

/** Corta la transmisión ya (botón, X, tiempo, salida). */
export function cortarTransmision(motivo: "boton" | "tiempo" | "salida" = "boton"): void {
  const estaba = cortarConsent(CONSENT, Date.now(), motivo);
  detenerPresencia();   // al instante, aunque el estado no fuera "compartiendo" (no hace daño)
  detenerLiveKit();     // Z92: pistas, salida del núcleo y conexión
  if (estaba) guardar();
}

function elegir(e: Eleccion): void {
  aplicar(elegirConsent(CONSENT, e, modoActual(), Date.now()));
}

/** Z93a: ¿pueden salir los atriles ahora? (LecternSystem lo consulta al recibir alight:request-lecterns) */
export function atrilesPermitidosAhora(): boolean {
  return atrilesPermitidos(CONSENT, DBG_CONSENT.ACTIVO, DBG_CONSENT.ATRILES_TRAS_CONSENTIMIENTO);
}

/** Un cuadro (ConsentTarimaHost). x, z = posición del usuario (cámara). */
export function tickConsentTarima(x: number, z: number): void {
  const ahora = Date.now();
  // Z93a: arranque solo, cancelación al bajar de la tarima y reinicio al volver a subir
  if (DBG_CONSENT.ACTIVO) {
    const dist = Math.hypot(x - ZONA_TARIMA.x, z - ZONA_TARIMA.z);
    if (tickSubida(CONSENT, SUBIDA, DBG_CONSENT, ahora, dist, ZONA_TARIMA.radio, AUX.atrilesVisibles) === "cancelar") cancelarTerminal();
  }
  // ACTIVO apagado a mitad de la secuencia: como antes (atriles, sin publicar)
  if (!DBG_CONSENT.ACTIVO && (CONSENT.estado === "esperando" || CONSENT.estado === "esperando2")) {
    CONSENT.estado = "eligiendo"; elegir("privado");
  }
  const a = tickConsent(CONSENT, DBG_CONSENT, ahora, !DIALOGO_STATE.activo);
  if (a === "abrirTexto1") abrirTerminal("tx_texto1");
  else if (a === "abrirEleccion") abrirTerminal("tx_eleccion");
  else if (a === "cortarPorTiempo") { detenerPresencia(); detenerLiveKit(); guardar(); }
  actualizarIndicador(ahora);
}

/** Z93a: bajó de la tarima antes de elegir: cierra la terminal propia sin aplicar nada (el estado ya volvió a "inactivo"). */
function cancelarTerminal(): void {
  if (_cierre) { clearTimeout(_cierre); _cierre = null; }
  if (AUX.terminalNuestra) { if (DIALOGO_STATE.fuente === RUTA_TARIMA_EXPONERSE) cerrarDialogo(); terminalLiberada(); }
}

function alPersonas(): void {
  SUBIDA.figuras = true;             // Z93a: la secuencia de entrada empezó de verdad
  if (!DBG_CONSENT.ACTIVO) return;   // LecternSystem pide los atriles a los 10 s, como antes
  let r = DBG_CONSENT.RECORDAR_EN_SESION ? leerRecordado(almacen()?.getItem(CLAVE_CONSENT)) : null;
  if (r?.eleccion === "compartir" && !DBG_CONSENT.RECORDAR_TRANSMISION) r = null;   // Z92: una transmisión no se reanuda sola al recargar
  if (r) { aplicar(aplicarRecordado(CONSENT, r, DBG_CONSENT, modoActual(), Date.now())); return; }
  // Z93a: la espera inicial la arranca tickSubida en este mismo cuadro o el siguiente (si el usuario está sobre la tarima)
}

/** Listeners (los instala ConsentTarimaHost). Devuelve la limpieza (= salir de la tarima). */
export function instalarConsentTarima(): () => void {
  const onPeople = () => alPersonas();
  const onLight = () => { if (!SUBIDA.tEntrada) SUBIDA.tEntrada = Date.now(); };   // Z93a: subió a la tarima
  const onLecterns = () => { AUX.atrilesVisibles = true; };
  const onDecision = (e: Event) => {
    const d = (e as CustomEvent<{ eleccion?: Eleccion }>).detail?.eleccion;
    if (d === "compartir" || d === "privado") elegir(d);
  };
  const onFin = () => {
    if (!AUX.terminalNuestra || DIALOGO_STATE.fuente !== RUTA_TARIMA_EXPONERSE) return;
    const esTexto1 = CONSENT.estado === "texto1";
    if (esTexto1) finTexto1(CONSENT, Date.now());   // la segunda espera cuenta desde que el texto terminó
    if (_cierre) clearTimeout(_cierre);
    const ms = esTexto1 ? Math.max(0, DBG_CONSENT.CIERRE_TEXTO_S) * 1000 : Math.max(0, DBG_CONSENT.CIERRE_MS);
    _cierre = setTimeout(() => { _cierre = null; if (DIALOGO_STATE.fuente === RUTA_TARIMA_EXPONERSE) cerrarDialogo(); }, ms);
  };
  const onCerrado = () => {
    if (!AUX.terminalNuestra) return;   // otra terminal (camino LUZ, aviso de Z85)
    terminalLiberada();
    if (CONSENT.estado === "texto1") finTexto1(CONSENT, Date.now());   // cerrado antes de terminar: sigue la secuencia
    else if (CONSENT.estado === "eligiendo") elegir("privado");        // cerrar sin elegir = No compartir
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.code !== "KeyX" || e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
    if (CONSENT.estado !== "compartiendo") return;
    if (INTERACT_STATE.mode === "image" || INTERACT_STATE.mode === "sound") return;   // ahí X es un atajo del atril
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    cortarTransmision("boton");
  };
  window.addEventListener("alight:people-visible", onPeople);
  window.addEventListener("alight:chose-light", onLight);
  window.addEventListener("alight:lecterns-visible", onLecterns);
  window.addEventListener("alight:tarima-consent", onDecision);
  window.addEventListener("alight:dialogo-fin", onFin);
  window.addEventListener("alight:dialogo-cerrado", onCerrado);
  window.addEventListener("keydown", onKey);
  return () => {
    window.removeEventListener("alight:people-visible", onPeople);
    window.removeEventListener("alight:chose-light", onLight);
    window.removeEventListener("alight:lecterns-visible", onLecterns);
    window.removeEventListener("alight:tarima-consent", onDecision);
    window.removeEventListener("alight:dialogo-fin", onFin);
    window.removeEventListener("alight:dialogo-cerrado", onCerrado);
    window.removeEventListener("keydown", onKey);
    if (_cierre) { clearTimeout(_cierre); _cierre = null; }
    if (AUX.terminalNuestra) { if (DIALOGO_STATE.fuente === RUTA_TARIMA_EXPONERSE) cerrarDialogo(); terminalLiberada(); }
    // salir de la tarima: se corta y se olvida (la próxima vez se vuelve a preguntar)
    cortarTransmision("salida");
    reiniciarConsent(CONSENT); olvidar();
    Object.assign(SUBIDA, crearSubida());   // Z93a
    AUX.atrilesVisibles = false; AUX.ultimoError = "";
    quitarIndicador();
  };
}

// ── indicador "● EN VIVO" (HTML, fuera del CRT) ──
let _ind: HTMLDivElement | null = null, _txt: HTMLDivElement | null = null, _aviso: HTMLDivElement | null = null;
let _clave = "";
function crearIndicador(): void {
  if (_ind || typeof document === "undefined") return;
  const d = document.createElement("div");
  d.setAttribute("role", "status");
  d.setAttribute("data-debug-panel", "");   // los clics no capturan el mouse de la cámara
  d.style.cssText = "position:fixed;top:14px;right:14px;z-index:9500;background:#2A1400;color:#FF9A1F;border:2px solid #FF9A1F;"
    + "padding:8px 12px;font:600 15px ui-monospace,'SF Mono',Menlo,Consolas,monospace;letter-spacing:0.08em;"
    + "text-shadow:0 0 6px rgba(255,154,31,0.45);box-shadow:0 0 12px rgba(255,154,31,0.25);display:flex;flex-direction:column;gap:6px;min-width:220px";
  const t = document.createElement("div");
  const av = document.createElement("div");
  av.style.cssText = "font-size:13px;color:#F4B62E;display:none";
  const b = document.createElement("button");
  b.textContent = "CORTAR TRANSMISIÓN";
  b.title = "Corta la transmisión ya (tecla X)";
  b.style.cssText = "background:#FF9A1F;color:#2A1400;border:none;padding:6px 10px;font:700 13px ui-monospace,'SF Mono',Menlo,Consolas,monospace;letter-spacing:0.08em;cursor:pointer";
  const parar = (e: Event) => e.stopPropagation();
  b.addEventListener("mousedown", parar);
  b.addEventListener("click", e => { e.stopPropagation(); cortarTransmision("boton"); b.blur(); });
  d.append(t, av, b);
  document.body.appendChild(d);
  _ind = d; _txt = t; _aviso = av; _clave = "";
}
function quitarIndicador(): void { _ind?.remove(); _ind = null; _txt = null; _aviso = null; _clave = ""; }
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

function actualizarIndicador(ahora: number): void {
  if (CONSENT.estado !== "compartiendo") { if (_ind) quitarIndicador(); return; }
  crearIndicador();
  if (!_txt || !_aviso) return;
  const p = estadoPublicador();
  const presRed = AUX.ultimoError || !p || p.estado === "error" ? "SIN CONEXIÓN · solo local"
    : p.estado === "connecting" ? "CONECTANDO…" : p.estado === "active" ? "" : "SIN CONEXIÓN · solo local";
  // Z92: con LiveKit, el rótulo sigue su estado real (la presencia sola, como Z91, si está apagado)
  const lk = estadoLiveKit().estado;
  const red = !DBG_LIVEKIT.ACTIVO ? presRed
    : lk === "publicando" ? (presRed ? "SIN PRESENCIA" : "")
    : lk === "pidiendo" || lk === "conectando" ? "CONECTANDO…"
    : lk === "reconectando" ? "RECONECTANDO…" : "SIN CONEXIÓN · solo local";
  const seg = Math.floor(segundosTx(CONSENT, ahora));
  const resta = Math.ceil(segundosRestantes(CONSENT, DBG_CONSENT, ahora));
  const avisar = CONSENT.avisoFin && resta > 0;
  const clave = `${seg}|${red}|${avisar ? resta : -1}`;
  if (clave === _clave) return;   // el DOM solo cambia una vez por segundo
  _clave = clave;
  _txt.textContent = `● EN VIVO  ${mmss(seg)}${red ? `  ·  ${red}` : ""}`;
  _aviso.style.display = avisar ? "block" : "none";
  if (avisar) _aviso.textContent = `La transmisión termina en ${resta} s`;
}

// ── menú de debug ──
export function mostrarTexto1Ahora(): void {
  if (_cierre) { clearTimeout(_cierre); _cierre = null; }
  if (forzarTexto1(CONSENT, Date.now())) abrirTerminal("tx_texto1");
}
export function mostrarEleccionAhora(): void {
  if (_cierre) { clearTimeout(_cierre); _cierre = null; }
  if (forzarEleccion(CONSENT, Date.now())) abrirTerminal("tx_eleccion");
}
/** Vuelve a empezar: corta, olvida la elección y arranca la espera inicial (los atriles que ya salieron no se repiten). */
export function reiniciarConsentimiento(): void {
  cortarTransmision("boton");
  if (AUX.terminalNuestra && DIALOGO_STATE.fuente === RUTA_TARIMA_EXPONERSE) cerrarDialogo();
  terminalLiberada();
  reiniciarConsent(CONSENT); olvidar(); AUX.ultimoError = "";
  quitarIndicador();
  iniciarConsent(CONSENT, Date.now());
}
export function textoEstadoConsent(): string {
  const ahora = Date.now(), p = estadoPublicador();
  const f = faseConsent(CONSENT, SUBIDA, DBG_CONSENT, ahora, AUX.atrilesVisibles);   // Z93a
  const fase = `fase: ${f.fase}${f.faltan >= 0 ? ` · faltan ${f.faltan.toFixed(1)} s` : ""} · figuras ${SUBIDA.figuras ? "sí" : "no"} · sobre la tarima ${SUBIDA.sobre ? "sí" : "no"} · cancelaciones ${SUBIDA.cancelaciones}\n`;
  const tx = CONSENT.inicioTx ? ` · transmitido ${mmss(segundosTx(CONSENT, ahora))}` : "";
  const modo = CONSENT.modo ? ` · modo ${CONSENT.modo}` : ` · modo si se comparte ahora: ${modoActual()}`;
  const corte = CONSENT.motivoCorte ? ` · corte: ${CONSENT.motivoCorte}` : "";
  const pub = p ? ` · presencia ${p.publicando ? p.estado : "detenida"}${p.ultimoError ? ` (${p.ultimoError})` : ""}` : "";
  return `${fase}${CONSENT.estado}${tx}${modo}${corte}${pub}${AUX.ultimoError ? ` · error: ${AUX.ultimoError}` : ""} · publicaciones ${CONSENT.publicaciones} · atriles ${AUX.atrilesVisibles ? "afuera" : "abajo"}`;
}

if (DEBUG_ENABLED && typeof window !== "undefined") {
  (window as unknown as { __consent?: object }).__consent = { CONSENT, DBG_CONSENT, mostrarTexto1Ahora, mostrarEleccionAhora, cortarTransmision, reiniciarConsentimiento, textoEstadoConsent };
}
