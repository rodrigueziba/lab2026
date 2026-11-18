// Z91: consentimiento para exponerse y transmitir al elegir la TARIMA. Lógica PURA, sin imports, con el tiempo inyectado
// (prueba: scripts/consent-tarima-test.mjs). La une con la escena lib/consentTarimaAcciones.ts.
//
// SECUENCIA PEDIDA POR EL USUARIO (reemplaza al temporizador de los atriles de J1 con DBG_CONSENT.ACTIVO):
//   alight:people-visible (las 6 figuras en escena) → "esperando" ESPERA_INICIAL_S
//   → "texto1" (terminal: "La luz viene con propio peso…", sin opciones) hasta que el texto termina (o se cierra)
//   → "esperando2" ESPERA_ENTRE_S → "eligiendo" (terminal: texto + "Compartir mi sesión." / "No compartir.")
//   → "privado"      (No compartir, o cerrar la terminal sin elegir): salen los atriles; no se publica nada
//   → "compartiendo" (Compartir): salen los atriles y se publica la presencia UNA vez (modo cara/privado según la fuente)
//   "compartiendo" → "cortado" con el botón, la tecla X o al llegar a DURACION_MAX_S (aviso AVISO_FIN_S antes).
//   Desde "cortado" no se vuelve a transmitir hasta pasar otra vez por el consentimiento (reiniciar).
// Los atriles se piden UNA sola vez por paso por la tarima, sea cual sea la elección.
// Valor por defecto: no compartir. Nada se transmite sin elección explícita.
// Tiempos en ms de reloj real (Date.now): las esperas como el temporizador de J1, y la duración máxima porque es un
// límite de transmisión (no se detiene con la pausa central).

export interface CfgConsent {
  ACTIVO: boolean; ESPERA_INICIAL_S: number; ESPERA_ENTRE_S: number; RECORDAR_EN_SESION: boolean;
  DURACION_MAX_S: number; AVISO_FIN_S: number;
}
export type EstadoConsent = "inactivo" | "esperando" | "texto1" | "esperando2" | "eligiendo" | "compartiendo" | "privado" | "cortado";
export type Eleccion = "compartir" | "privado";
export type ModoTx = "cara" | "privado";
export type AccionTick = "ninguna" | "abrirTexto1" | "abrirEleccion" | "avisoFin" | "cortarPorTiempo";

export interface Consent {
  estado: EstadoConsent;
  t0: number;               // entrada al estado actual (ms)
  inicioTx: number;         // inicio de la transmisión (ms reales; 0 = nunca)
  finTx: number;            // fin de la última transmisión (ms; 0 = sigue o nunca)
  avisoFin: boolean;        // ya se mostró el aviso de fin
  atrilesPedidos: boolean;
  publicaciones: number;    // veces que se pidió publicar (debe ser ≤ 1 por paso por el consentimiento)
  modo: ModoTx | null;
  motivoCorte: "" | "boton" | "tiempo" | "salida";
}
export function crearConsent(): Consent {
  return { estado: "inactivo", t0: 0, inicioTx: 0, finTx: 0, avisoFin: false, atrilesPedidos: false, publicaciones: 0, modo: null, motivoCorte: "" };
}
const s = (v: number, d: number): number => Math.max(0, Number.isFinite(v) ? v : d) * 1000;

/** Las figuras están en escena: arranca la espera inicial (solo desde "inactivo"). */
export function iniciarConsent(st: Consent, ahora: number): boolean {
  if (st.estado !== "inactivo") return false;
  st.estado = "esperando"; st.t0 = ahora;
  return true;
}

/** Un paso. terminalLibre = no hay otra terminal abierta (espera si la hay). */
export function tickConsent(st: Consent, c: CfgConsent, ahora: number, terminalLibre: boolean): AccionTick {
  switch (st.estado) {
    case "esperando":
      if (ahora - st.t0 >= s(c.ESPERA_INICIAL_S, 8) && terminalLibre) { st.estado = "texto1"; st.t0 = ahora; return "abrirTexto1"; }
      return "ninguna";
    case "esperando2":
      if (ahora - st.t0 >= s(c.ESPERA_ENTRE_S, 8) && terminalLibre) { st.estado = "eligiendo"; st.t0 = ahora; return "abrirEleccion"; }
      return "ninguna";
    case "compartiendo": {
      const max = s(c.DURACION_MAX_S, 300), aviso = Math.min(max, s(c.AVISO_FIN_S, 30));
      const t = ahora - st.inicioTx;
      if (t >= max) { cortarConsent(st, ahora, "tiempo"); return "cortarPorTiempo"; }
      if (!st.avisoFin && t >= max - aviso) { st.avisoFin = true; return "avisoFin"; }
      return "ninguna";
    }
    default: return "ninguna";
  }
}

/** El primer texto terminó (fin del texto o terminal cerrada): empieza la segunda espera. */
export function finTexto1(st: Consent, ahora: number): boolean {
  if (st.estado !== "texto1") return false;
  st.estado = "esperando2"; st.t0 = ahora;
  return true;
}

export interface ResultadoEleccion { atriles: boolean; publicar: boolean }
const _res: ResultadoEleccion = { atriles: false, publicar: false };
/**
 * Aplica la elección (solo desde "eligiendo"; cerrar sin elegir = "privado"). Devuelve si hay que pedir los atriles
 * (una vez) y si hay que publicar (solo al pasar a "compartiendo"). Objeto de resultado reutilizado.
 */
export function elegirConsent(st: Consent, e: Eleccion, modo: ModoTx, ahora: number): ResultadoEleccion {
  _res.atriles = false; _res.publicar = false;
  if (st.estado !== "eligiendo") return _res;
  if (e === "compartir") {
    st.estado = "compartiendo"; st.inicioTx = ahora; st.finTx = 0; st.avisoFin = false; st.modo = modo; st.motivoCorte = "";
    st.publicaciones++; _res.publicar = true;
  } else {
    st.estado = "privado"; st.modo = null;
  }
  st.t0 = ahora;
  if (!st.atrilesPedidos) { st.atrilesPedidos = true; _res.atriles = true; }
  return _res;
}

/** Corta la transmisión (botón, X, tiempo o salida). true si estaba compartiendo. */
export function cortarConsent(st: Consent, ahora: number, motivo: Consent["motivoCorte"] = "boton"): boolean {
  if (st.estado !== "compartiendo") return false;
  st.estado = "cortado"; st.t0 = ahora; st.finTx = ahora; st.motivoCorte = motivo || "boton";
  return true;
}

/** Fuerza la apertura de un texto (botones de debug): devuelve true si cambió el estado. */
export function forzarTexto1(st: Consent, ahora: number): boolean {
  if (st.estado === "compartiendo") return false;
  st.estado = "texto1"; st.t0 = ahora; return true;
}
export function forzarEleccion(st: Consent, ahora: number): boolean {
  if (st.estado === "compartiendo") return false;
  st.estado = "eligiendo"; st.t0 = ahora; return true;
}

/** Vuelve a empezar (debug "Reiniciar consentimiento", o una nueva visita a la tarima). */
export function reiniciarConsent(st: Consent): void {
  st.estado = "inactivo"; st.t0 = 0; st.inicioTx = 0; st.finTx = 0; st.avisoFin = false;
  st.atrilesPedidos = false; st.publicaciones = 0; st.modo = null; st.motivoCorte = "";
}

/** Modo de la presencia según la fuente de video de la tarima (Z87): webcam → "cara"; ondas o sin cámara → "privado". */
export function modoSegunFuente(tipo: string | null | undefined): ModoTx {
  return tipo === "webcam" ? "cara" : "privado";
}

/** Segundos transmitidos (0 si nunca). */
export function segundosTx(st: Consent, ahora: number): number {
  if (!st.inicioTx) return 0;
  return Math.max(0, ((st.estado === "compartiendo" ? ahora : st.finTx || ahora) - st.inicioTx) / 1000);
}
/** Segundos que faltan para el límite (solo compartiendo). */
export function segundosRestantes(st: Consent, c: CfgConsent, ahora: number): number {
  if (st.estado !== "compartiendo") return 0;
  return Math.max(0, s(c.DURACION_MAX_S, 300) / 1000 - (ahora - st.inicioTx) / 1000);
}

// ── sessionStorage de la pestaña (solo la elección; nunca entre sesiones del navegador) ──
export interface Recordado { eleccion: Eleccion; inicioTx: number; modo: ModoTx | null }
export function serializarConsent(st: Consent): string | null {
  if (st.estado === "compartiendo") return JSON.stringify({ eleccion: "compartir", inicioTx: st.inicioTx, modo: st.modo });
  if (st.estado === "privado" || st.estado === "cortado") return JSON.stringify({ eleccion: "privado", inicioTx: 0, modo: null });
  return null;
}
export function leerRecordado(txt: string | null | undefined): Recordado | null {
  if (!txt) return null;
  try {
    const o = JSON.parse(txt) as Partial<Recordado>;
    if (o.eleccion !== "compartir" && o.eleccion !== "privado") return null;
    const inicio = typeof o.inicioTx === "number" && Number.isFinite(o.inicioTx) ? o.inicioTx : 0;
    return { eleccion: o.eleccion, inicioTx: inicio, modo: o.modo === "cara" || o.modo === "privado" ? o.modo : null };
  } catch { return null; }
}
/**
 * Al recargar dentro de la misma sesión del navegador: aplica la elección recordada sin repreguntar (desde "inactivo"
 * o "esperando"). "compartir" conserva el inicio original: si ya pasó DURACION_MAX_S, queda "cortado" (no publica).
 */
export function aplicarRecordado(st: Consent, r: Recordado, c: CfgConsent, modo: ModoTx, ahora: number): ResultadoEleccion {
  _res.atriles = false; _res.publicar = false;
  if (st.estado !== "inactivo" && st.estado !== "esperando") return _res;
  st.estado = "eligiendo";
  if (r.eleccion === "compartir" && r.inicioTx > 0 && ahora - r.inicioTx < s(c.DURACION_MAX_S, 300)) {
    const res = elegirConsent(st, "compartir", modo, ahora);
    st.inicioTx = r.inicioTx;
    st.avisoFin = false;   // si ya está dentro de la ventana del aviso, el próximo tick lo vuelve a mostrar
    return res;
  }
  const res = elegirConsent(st, "privado", modo, ahora);
  if (r.eleccion === "compartir") { st.estado = "cortado"; st.motivoCorte = "tiempo"; st.finTx = ahora; }
  return res;
}
