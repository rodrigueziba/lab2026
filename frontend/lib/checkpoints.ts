// Z40: registro ÚNICO de checkpoints de la experiencia y su ejecutor. Sin imports (se prueba en Node:
// scripts/checkpoints-test.mjs). Las acciones concretas (que tocan la escena, el audio, los stores) las
// instala lib/checkpointsAcciones.ts vía instalarAcciones(); acá solo vive el orden.
//
// Un checkpoint es una lista de PASOS ["accion", ...args]. Todos empiezan por la BASE limpia:
//   base      → limpia el estado de módulo (esperas, amanecer, audio, efectos, pausa, bloqueos, terminal…)
//   remontar  → remonta <Scene/> (key) para que cada componente vuelva a su estado inicial y libere lo suyo
//   base      → otra vez, ya con la escena nueva (lo que la vieja haya hecho en la ventana del remontaje)
//   spawn     → cámara en el spawn mirando al telón
// y después aplica lo propio REUTILIZANDO los flujos existentes (zonas del Player, eventos, efectos).
//
// irACheckpoint(id) solo ENCOLA: se aplica en el próximo tickCheckpoints() (un frame después). Así es seguro
// llamarlo desde un handler (por ejemplo un tag de ink en medio de la terminal). Un salto nuevo durante otro
// lo reemplaza: vuelve a empezar por la base (ráfagas). Al terminar: 'alight:checkpoint' { id }.
// Cada paso tiene un tope de tiempo; si vence, el checkpoint queda en "error" (sin colgar nada).

export type CheckpointId =
  | "inicio" | "exploracion" | "sillas_prisma" | "sala_activa" | "visualizador" | "amanecer_completo"
  | "tarima" | "tarima_vacia" | "luz_dialogo" | "premio"
  | "dia_mediodia" | "dia_atardecer" | "dia_noche";   // Z48

/** ["accion", ...args] */
export type Paso = readonly [string, ...(string | number)[]];

export interface Checkpoint {
  id: CheckpointId;
  nombre: string;
  descripcion: string;
  pasos: readonly Paso[];
}

/** Contexto de un paso: frames y segundos desde que empezó; primera = primera llamada del paso. */
export interface CtxPaso { frames: number; t: number; primera: boolean }

/** Devuelve true cuando el paso terminó; false para volver a llamarlo el próximo frame. */
export type Accion = (paso: Paso, ctx: CtxPaso) => boolean;

// la base se repite después del remontaje: limpia lo que la escena vieja hizo en esa ventana
const BASE: Paso[] = [["base"], ["remontar"], ["base"], ["spawn"]];
const EXPLORACION: Paso[] = [...BASE, ["cruzarTelon"], ["esperarFrames", 2]];
const SILLAS: Paso[] = [...EXPLORACION, ["irASillas"], ["esperarEvento", "alight:chose-chairs", 5]];
const SALA: Paso[] = [...SILLAS, ["adelantarHasta", "alight:sala-activa", 60]];
const VIZ: Paso[] = [...SALA, ["visualizador"], ["esperarFrames", 8]];

export const CHECKPOINTS: readonly Checkpoint[] = [
  { id: "inicio", nombre: "Inicio", pasos: BASE,
    descripcion: "Spawn mirando al telón, estado de arranque (cortina)." },
  { id: "exploracion", nombre: "Exploración", pasos: EXPLORACION,
    descripcion: "Telón ya cruzado (atajo del telón, sin destello). Exploración libre." },
  { id: "sillas_prisma", nombre: "Sillas: prisma bajando", pasos: SILLAS,
    descripcion: "SILLAS recién elegida (zona del Player): sillas_secuencia, movimiento bloqueado, prisma bajando." },
  { id: "sala_activa", nombre: "Sala activa", pasos: SALA,
    descripcion: "Secuencia SILLAS terminada (reloj adelantado): prisma en el suelo, paneles revelados, movimiento libre." },
  { id: "visualizador", nombre: "Visualizador", pasos: VIZ,
    descripcion: "Sala activa + visualizador (4 luces y 2 monolitos), sin amanecer." },
  { id: "amanecer_completo", nombre: "Amanecer completo", pasos: [...VIZ, ["amanecerFinal"], ["esperarFrames", 2]],
    descripcion: "Visualizador con el amanecer terminado (fase 1 y fase 2)." },
  // Z48: ciclo de día (con DBG_DIA.NUEVO): después del amanecer completo, ubica el día en tDia
  { id: "dia_mediodia", nombre: "Día: mediodía", pasos: [...VIZ, ["amanecerFinal"], ["diaEn", 0.5], ["esperarFrames", 2]],
    descripcion: "Visualizador con la introducción terminada y el ciclo de día en tDia 0,50 (mediodía)." },
  { id: "dia_atardecer", nombre: "Día: atardecer", pasos: [...VIZ, ["amanecerFinal"], ["diaEn", 0.8], ["esperarFrames", 2]],
    descripcion: "Visualizador con el ciclo de día en tDia 0,80 (atardecer)." },
  { id: "dia_noche", nombre: "Día: noche", pasos: [...VIZ, ["amanecerFinal"], ["diaEn", 0.97], ["esperarFrames", 2]],
    descripcion: "Visualizador con el ciclo de día en tDia 0,97 (noche, poco antes de que termine el día)." },
  { id: "tarima", nombre: "Tarima", pasos: [...EXPLORACION, ["irATarima"], ["esperarEvento", "alight:chose-light", 5]],
    descripcion: "Camino TARIMA elegido (zona del Player). Público y atriles llegan con sus tiempos reales." },
  { id: "tarima_vacia", nombre: "Tarima vacía", pasos: [...EXPLORACION, ["tarimaVacia"], ["esperarEvento", "alight:lecterns-visible", 8]],
    descripcion: "TARIMA sin público y con atriles (efecto ir_tarima_sin_publico de Z29)." },
  { id: "luz_dialogo", nombre: "Luz: diálogo", pasos: [...BASE, ["irALuz"], ["esperarDialogo", 12]],
    descripcion: "Bajo la luz lejana: giro de cámara y terminal abierta en n_1." },
  { id: "premio", nombre: "Premio", pasos: [...EXPLORACION, ["premio"], ["esperarFrames", 2]],
    descripcion: "Después de juego_alarma: premio otorgado (1 h), luces encendidas, sobre la tarima." },
];

export const TIMEOUT_PASO_S = 30;   // tope por paso si el paso no trae uno propio

export const CK_STATE = {
  actual: "" as CheckpointId | "",     // último checkpoint aplicado completo
  objetivo: "" as CheckpointId | "",   // el que se está aplicando
  pendiente: "" as CheckpointId | "",  // encolado, se aplica en el próximo tick
  fase: "inactivo" as "inactivo" | "aplicando" | "listo" | "error",
  paso: 0,
  pasoNombre: "",
  error: "",
  saltos: 0,
};

let _acciones: Record<string, Accion> = {};
let _pendiente: CheckpointId | null = null;
const _ctx: CtxPaso = { frames: 0, t: 0, primera: true };

export function buscarCheckpoint(id: string): Checkpoint | undefined {
  for (const c of CHECKPOINTS) if (c.id === id) return c;
  return undefined;
}

export function instalarAcciones(a: Record<string, Accion>): void { _acciones = a; }

/** Encola el salto (se aplica en el próximo tick). Devuelve false si el id no existe. */
export function irACheckpoint(id: string): boolean {
  const c = buscarCheckpoint(id);
  if (!c) { console.warn(`[checkpoints] no existe el checkpoint "${id}"`); return false; }
  _pendiente = c.id;
  CK_STATE.pendiente = c.id;
  CK_STATE.fase = "aplicando";       // el estado ya refleja el salto encolado
  return true;
}

export function checkpointActual(): CheckpointId | "" { return CK_STATE.actual; }

function resetCtx(): void { _ctx.frames = 0; _ctx.t = 0; _ctx.primera = true; }

function fallar(msg: string): void {
  CK_STATE.fase = "error";
  CK_STATE.error = msg;
  console.warn(`[checkpoints] ${CK_STATE.objetivo}: ${msg}`);
}

/** Una vez por frame (CheckpointsHost). */
export function tickCheckpoints(dt: number): void {
  if (_pendiente) {
    CK_STATE.objetivo = _pendiente;
    _pendiente = null;
    CK_STATE.pendiente = "";
    CK_STATE.fase = "aplicando";
    CK_STATE.actual = "";
    CK_STATE.paso = 0;
    CK_STATE.error = "";
    CK_STATE.saltos++;
    resetCtx();
  }
  if (CK_STATE.fase !== "aplicando") return;
  const ck = buscarCheckpoint(CK_STATE.objetivo);
  if (!ck) { fallar("checkpoint inexistente"); return; }
  // varios pasos instantáneos en el mismo frame; se corta en el primero que tenga que esperar
  for (let guard = 0; guard < 32 && CK_STATE.paso < ck.pasos.length; guard++) {
    const p = ck.pasos[CK_STATE.paso];
    CK_STATE.pasoNombre = p[0];
    const fn = _acciones[p[0]];
    if (!fn) { fallar(`acción "${p[0]}" no instalada`); return; }
    if (!_ctx.primera) { _ctx.frames++; _ctx.t += dt; }
    const listo = fn(p, _ctx);
    if (_pendiente) return;                       // la acción encoló otro salto: se atiende el próximo tick
    if (!listo) {
      _ctx.primera = false;
      const tope = p[0] === "esperarEvento" || p[0] === "adelantarHasta" || p[0] === "esperarDialogo"
        ? Number(p[p[0] === "esperarDialogo" ? 1 : 2]) || TIMEOUT_PASO_S : TIMEOUT_PASO_S;
      if (_ctx.t > tope) fallar(`el paso "${p[0]}" no terminó en ${tope} s`);
      return;
    }
    CK_STATE.paso++;
    resetCtx();
  }
  if (CK_STATE.paso >= ck.pasos.length) {
    CK_STATE.fase = "listo";
    CK_STATE.actual = ck.id;
    const w = (globalThis as { window?: { dispatchEvent(e: Event): boolean } }).window;
    if (w && typeof CustomEvent !== "undefined") w.dispatchEvent(new CustomEvent("alight:checkpoint", { detail: { id: ck.id } }));
  }
}

/** Efecto de ink "nombre:arg" → { nombre, arg } (arg "" si no hay). */
export function parsearEfecto(efecto: string): { nombre: string; arg: string } {
  const i = efecto.indexOf(":");
  return i < 0 ? { nombre: efecto.trim(), arg: "" } : { nombre: efecto.slice(0, i).trim(), arg: efecto.slice(i + 1).trim() };
}
