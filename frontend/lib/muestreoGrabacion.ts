// Z106: grabación del SAMPLER SM-40 (MIC o MEZCLA). Lógica PURA y SIN imports (prueba: scripts/muestreo-grabacion-test.mjs).
// El motor (lib/audio/sampler.ts) le pasa las piezas del navegador (getUserMedia, MediaRecorder, Blob, decodeAudioData,
// pointer lock); acá no se toca nada del navegador directamente, así que se prueba en Node con simulaciones.
//
//   inactivo → pidiendo (solo MIC: permiso del navegador) → grabando → procesando (Blob → decodeAudioData) → listo
//                └──────────────── cualquier falla ────────────────► error (código + mensaje corto en español)
//
// Reglas (Z106, por el reporte "no graba aunque dé el permiso"):
//   · Ninguna falla es silenciosa: cada error queda en el estado (lo muestra el atril) y se avisa por consola ([SM-40]).
//   · Un segundo GRABAR mientras el navegador espera la respuesta del permiso NO cancela (antes descartaba el micrófono
//     concedido sin decir nada); se cancela solo desde el menú, al reiniciar o al desmontar.
//   · Las pistas del micrófono se detienen SIEMPRE (al terminar, con error, al cancelar o si el permiso llega tarde).
//   · El mimeType se elige con MediaRecorder.isTypeSupported; si el navegador no tiene isTypeSupported se usa el suyo.
//   · Si el puntero estaba bloqueado al pedir el permiso, se libera antes y se recupera después (el aviso del navegador
//     necesita el puntero libre).

export type FaseMuestreo = "inactivo" | "pidiendo" | "grabando" | "procesando" | "listo" | "error";
export type CodigoMuestreo = "" | "denegado" | "sin-mic" | "en-uso" | "restriccion" | "seguridad" | "formato" | "navegador"
  | "decodificar" | "vacio" | "grabador" | "mezcla" | "otro";
export type FuenteMuestreo = "MIC" | "MEZCLA";

/** Formatos en orden de preferencia (Chrome y Firefox: webm/opus; Safari: mp4). */
export const MIMES_MUESTREO = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus", "audio/ogg"] as const;
/** Mensaje corto (mayúsculas, para el display) de cada código. */
export const MENSAJES_MUESTREO: Record<CodigoMuestreo, string> = {
  "": "",
  denegado: "DENEGADO (REVISÁ EL CANDADO DEL NAVEGADOR)",
  "sin-mic": "NO HAY MICRÓFONO",
  "en-uso": "EN USO POR OTRA APP",
  restriccion: "EL MICRÓFONO NO ACEPTA EL PEDIDO",
  seguridad: "BLOQUEADO POR SEGURIDAD (HACE FALTA HTTPS)",
  formato: "FORMATO NO SOPORTADO",
  navegador: "ESTE NAVEGADOR NO PUEDE GRABAR",
  decodificar: "NO SE PUDO LEER EL AUDIO",
  vacio: "NO LLEGÓ AUDIO",
  grabador: "FALLÓ EL GRABADOR",
  mezcla: "NO HAY NADA SONANDO",
  otro: "ERROR",
};

/** Nombre de la DOMException (o del Error) → código. */
export function codigoDeError(nombre: string): CodigoMuestreo {
  switch (nombre) {
    case "NotAllowedError": case "PermissionDeniedError": return "denegado";
    case "NotFoundError": case "DevicesNotFoundError": return "sin-mic";
    case "NotReadableError": case "TrackStartError": case "AbortError": return "en-uso";
    case "OverconstrainedError": case "ConstraintNotSatisfiedError": return "restriccion";
    case "SecurityError": return "seguridad";
    case "NotSupportedError": return "formato";
    case "TypeError": return "navegador";
    case "EncodingError": return "decodificar";
    default: return "otro";
  }
}

/** Primer formato soportado. soporta = null (el navegador no tiene isTypeSupported) → "" = el del navegador. */
export function elegirMime(soporta: ((m: string) => boolean) | null, lista: readonly string[] = MIMES_MUESTREO): { mime: string; ok: boolean } {
  if (!soporta) return { mime: "", ok: true };
  for (const m of lista) { let s = false; try { s = soporta(m); } catch { s = false; } if (s) return { mime: m, ok: true }; }
  return { mime: "", ok: false };
}

export interface EstadoMuestreo {
  fase: FaseMuestreo;
  codigo: CodigoMuestreo;
  nombreError: string;   // nombre de la excepción (NotAllowedError…)
  detalle: string;       // mensaje original del navegador (para el menú y la consola)
  fuente: FuenteMuestreo;
  pad: number;           // 0…7
  t0: number;            // s (reloj que pasa el motor) al empezar a grabar
  segundos: number;      // grabados
  maxS: number;
  mime: string;          // elegido ("" = el del navegador)
  mimeReal: string;      // el que informó el grabador
  pico: number;          // pico de la última grabación (0…1, antes de normalizar)
  tFin: number;          // s en que llegó a listo o error
  version: number;       // cambia con cada transición (el atril redibuja)
}
export function crearEstadoMuestreo(): EstadoMuestreo {
  return { fase: "inactivo", codigo: "", nombreError: "", detalle: "", fuente: "MIC", pad: 0, t0: 0, segundos: 0, maxS: 8, mime: "", mimeReal: "", pico: 0, tFin: 0, version: 0 };
}
const fin = (x: number, d: number): number => (Number.isFinite(x) ? x : d);
/** Texto de estado para el atril ("" = nada que mostrar). Decimales con coma. */
export function textoMuestreo(e: EstadoMuestreo, ahora = Infinity, listoS = 6): string {
  const f = e.fuente;
  switch (e.fase) {
    case "pidiendo": return `${f}: PEDIDO DE PERMISO... (ACEPTÁ EN EL NAVEGADOR)`;
    case "grabando": return `${f}: GRABANDO ${e.segundos.toFixed(1).replace(".", ",")} / ${Math.round(e.maxS)} S`;
    case "procesando": return `${f}: PROCESANDO...`;
    case "listo": return ahora - e.tFin <= listoS ? `${f}: LISTO, PAD ${e.pad + 1}` : "";
    case "error": return `${f}: ${MENSAJES_MUESTREO[e.codigo] || MENSAJES_MUESTREO.otro}`;
    default: return "";
  }
}

// ── el navegador, inyectado ──
export interface PistaLike { stop(): void }
export interface StreamLike { getTracks(): PistaLike[] }
export interface GrabadorLike {
  state: string; mimeType?: string;
  ondataavailable: ((ev: { data: { size: number } }) => void) | null;
  onstop: (() => void) | null;
  onerror?: ((ev: unknown) => void) | null;
  start(): void; stop(): void;
}
export interface PunteroLike { bloqueado(): boolean; liberar(): void; recuperar(): void }
export interface DepsMuestreo<B> {
  pedirMic(): Promise<StreamLike>;                                      // getUserMedia (solo MIC)
  crearGrabador(stream: StreamLike, mime: string): GrabadorLike;          // new MediaRecorder(stream, { mimeType })
  soporta: ((m: string) => boolean) | null;                             // MediaRecorder.isTypeSupported (o null)
  aArrayBuffer(partes: unknown[], mime: string): Promise<ArrayBuffer>;   // new Blob(partes, { type }).arrayBuffer()
  decodificar(ab: ArrayBuffer): Promise<B>;                              // decodeAudioData (promesa o callbacks)
  ahora(): number;                                                       // s
  puntero?: PunteroLike;
  alListo(buf: B, pad: number, fuente: FuenteMuestreo): number;          // pone el audio en el pad; devuelve el pico
  alCambio(e: EstadoMuestreo): void;                                     // el motor sincroniza su estado
  avisar(nombre: string, mensaje: string): void;                         // console.warn("[SM-40] …")
}
export interface Grabacion {
  /** MIC: pide el permiso (si hace falta) y graba. MEZCLA: graba el stream dado. false si ya hay una grabación viva. */
  iniciar(fuente: FuenteMuestreo, pad: number, maxS: number, mezcla?: { stream: StreamLike; cerrar(): void } | null): boolean;
  /** PARAR: guarda lo grabado. Durante el pedido de permiso no hace nada (no se pierde el permiso). */
  parar(): void;
  /** Cancela sin guardar (menú, reinicio, desmontar): libera todo, también un permiso que llegue tarde. */
  cancelar(): void;
  /** Un cuadro: cuenta los segundos y corta al máximo. true si cortó. */
  tick(): boolean;
  viva(): boolean;
  grabador(): GrabadorLike | null;
  stream(): StreamLike | null;
}

export function crearGrabacion<B>(e: EstadoMuestreo, d: DepsMuestreo<B>): Grabacion {
  let rec: GrabadorLike | null = null, stream: StreamLike | null = null, cerrarExtra: (() => void) | null = null;
  let turno = 0;   // cada intento tiene su número: lo que llega de un intento viejo (cancelado) se descarta y se libera
  const cambiar = (f: FaseMuestreo) => { e.fase = f; if (f === "listo" || f === "error") e.tFin = d.ahora(); e.version++; d.alCambio(e); };
  const soltarEntradas = () => {
    const s = stream; stream = null;
    if (s) { try { s.getTracks().forEach(t => { try { t.stop(); } catch { /* ya parada */ } }); } catch { /* sin pistas */ } }
    const c = cerrarExtra; cerrarExtra = null;
    if (c) { try { c(); } catch { /* ya cerrado */ } }
  };
  const fallar = (nombre: string, mensaje: string, codigo?: CodigoMuestreo) => {
    soltarEntradas();
    if (rec) { rec.ondataavailable = null; rec.onstop = null; if (rec.onerror !== undefined) rec.onerror = null; try { if (rec.state !== "inactive") rec.stop(); } catch { /* ya parado */ } rec = null; }
    e.codigo = codigo ?? codigoDeError(nombre); e.nombreError = nombre || "Error"; e.detalle = mensaje || "";
    d.avisar(e.nombreError, `${e.fuente}: ${MENSAJES_MUESTREO[e.codigo]}${e.detalle ? " · " + e.detalle : ""}`);
    cambiar("error");
  };
  const empezar = (s: StreamLike, pad: number, fuente: FuenteMuestreo, miTurno: number) => {
    const m = elegirMime(d.soporta);
    if (!m.ok) { stream = s; fallar("NotSupportedError", "ningún formato de audio soportado por MediaRecorder", "formato"); return; }
    e.mime = m.mime;
    let r: GrabadorLike;
    try { r = d.crearGrabador(s, m.mime); } catch (err) { stream = s; const x = err as { name?: string; message?: string }; fallar(x?.name || "NotSupportedError", x?.message || "", x?.name ? undefined : "formato"); return; }
    rec = r; stream = s;
    const partes: unknown[] = [];
    r.ondataavailable = ev => { if (ev && ev.data && ev.data.size) partes.push(ev.data); };
    r.onerror = ev => { if (miTurno !== turno) return; const x = (ev as { error?: { name?: string; message?: string } })?.error; fallar(x?.name || "Error", x?.message || "error del grabador", "grabador"); };
    r.onstop = () => {
      if (miTurno !== turno) return;
      soltarEntradas();
      e.mimeReal = r.mimeType || m.mime;
      rec = null;
      if (!partes.length) { fallar("Error", "el grabador no entregó audio", "vacio"); return; }
      cambiar("procesando");
      d.aArrayBuffer(partes, e.mimeReal || "audio/webm")
        .then(ab => d.decodificar(ab))
        .then(buf => { if (miTurno !== turno) return; e.pico = d.alListo(buf, pad, fuente); cambiar("listo"); })
        .catch(err => { if (miTurno !== turno) return; const x = err as { name?: string; message?: string }; fallar(x?.name || "EncodingError", x?.message || "", "decodificar"); });
    };
    try { r.start(); } catch (err) { const x = err as { name?: string; message?: string }; fallar(x?.name || "Error", x?.message || "", "grabador"); return; }
    e.t0 = d.ahora(); e.segundos = 0;
    cambiar("grabando");
  };

  const g: Grabacion = {
    iniciar(fuente, pad, maxS, mezcla) {
      if (e.fase === "pidiendo" || e.fase === "grabando" || e.fase === "procesando") return false;
      const miTurno = ++turno;
      e.fuente = fuente; e.pad = pad; e.maxS = Math.max(0.5, fin(maxS, 8)); e.segundos = 0;
      e.codigo = ""; e.nombreError = ""; e.detalle = ""; e.mime = ""; e.mimeReal = "";
      if (fuente === "MEZCLA") {
        if (!mezcla) { fallar("Error", "el bus de la tarima no está armado", "mezcla"); return false; }
        cerrarExtra = mezcla.cerrar;
        empezar(mezcla.stream, pad, fuente, miTurno);
        return (e.fase as FaseMuestreo) === "grabando";   // empezar() la cambia
      }
      // MIC: con el puntero bloqueado, el aviso de permiso del navegador no se puede contestar → se libera antes
      const p = d.puntero, soltado = !!p && p.bloqueado();
      if (soltado) p!.liberar();
      cambiar("pidiendo");
      let pedido: Promise<StreamLike>;
      try { pedido = d.pedirMic(); } catch (err) { pedido = Promise.reject(err); }
      pedido.then(s => {
        if (soltado) p!.recuperar();
        if (miTurno !== turno || e.fase !== "pidiendo") { try { s.getTracks().forEach(t => t.stop()); } catch { /* sin pistas */ } return; }
        empezar(s, pad, fuente, miTurno);
      }, err => {
        if (soltado) p!.recuperar();
        if (miTurno !== turno) return;
        const x = err as { name?: string; message?: string };
        fallar(x?.name || "Error", x?.message || String(err ?? ""));
      });
      return true;
    },
    parar() {
      if (e.fase !== "grabando" || !rec) return;   // durante el pedido de permiso no se cancela (Z106)
      try { rec.stop(); } catch (err) { const x = err as { name?: string; message?: string }; fallar(x?.name || "Error", x?.message || "", "grabador"); }
    },
    cancelar() {
      turno++;   // lo que llegue del intento en curso (permiso, onstop, decodificación) se descarta y se libera
      if (rec) { rec.ondataavailable = null; rec.onstop = null; try { if (rec.state !== "inactive") rec.stop(); } catch { /* ya parado */ } rec = null; }
      soltarEntradas();
      if (e.fase !== "inactivo") { e.fase = "inactivo"; e.segundos = 0; e.version++; d.alCambio(e); }
    },
    tick() {
      if (e.fase !== "grabando") return false;
      e.segundos = Math.max(0, Math.min(e.maxS, d.ahora() - e.t0));
      if (d.ahora() - e.t0 >= e.maxS) { g.parar(); return true; }
      return false;
    },
    viva() { return e.fase === "pidiendo" || e.fase === "grabando" || e.fase === "procesando"; },
    grabador() { return rec; },
    stream() { return stream; },
  };
  return g;
}

/** Ganancia para normalizar lo grabado a `pico` (solo sube, con tope para no inflar el ruido de un silencio). */
export function gananciaNormalizar(picoActual: number, pico: number, maxGanancia: number): number {
  if (!(picoActual > 1e-9)) return 1;
  return Math.max(1, Math.min(Math.max(1, maxGanancia), pico / picoActual));
}
