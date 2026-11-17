// Z70: registro de las secciones del menú de debug (Shift). Lógica PURA (sin imports), testeable en Node
// (scripts/debug-menu-test.mjs). Cada sección es un componente en components/debug/pestanas/<pestana>.tsx
// (components/debug/mapaSecciones.ts: id → componente).
//
// MANTENIMIENTO: al agregar o modificar controles del menú, actualizar acá la entrada de su sección con
// ultimoZ = número de la tarea actual (y agregar la entrada si la sección es nueva). Con eso se ordena sola:
//   · pestañas: de la que tiene la sección modificada más recientemente a la más vieja ("Recientes" siempre primero)
//   · secciones dentro de una pestaña: ultimoZ de mayor a menor (empate: desdeZ, después el orden del registro)
//   · "Recientes": secciones de los últimos 5 valores distintos de ultimoZ
//   · marca NUEVO: secciones de los últimos 3 valores distintos de ultimoZ
// desdeZ / ultimoZ = 0: anterior a la numeración Z (códigos de letra: C, F, G, H, N, P, R, S, T, U, V, W, X, AA).
// avanzada = true: se muestra plegada por defecto. clase "obsoleta": código viejo detrás de flags (no se borra).

export type ClaseSeccion = "frecuente" | "ocasional" | "tecnica" | "obsoleta";
export interface SeccionDebug {
  id: string; titulo: string; pestana: string; desdeZ: number; ultimoZ: number;
  avanzada: boolean; clase: ClaseSeccion; descripcion: string;
  // Z73: secciones de "Obsoletos": por qué está ahí y qué flag la deja sin efecto
  etiqueta?: "sin efecto hoy" | "código viejo"; flagApaga?: string;
}

export const PESTANA_RECIENTES = "recientes";
export const PESTANA_FAVORITOS = "favoritos";   // Z73: secciones fijadas con la estrella (siempre segunda)
export const PESTANA_OBSOLETOS = "obsoletos";   // Z73: siempre última
export const PESTANAS_DEBUG: { id: string; titulo: string }[] = [
  { id: "rendimiento", titulo: "Rendimiento" },
  { id: "pasto", titulo: "Pasto y monolitos" },
  { id: "flor", titulo: "Flor, prisma y tarima" },
  { id: "cielo", titulo: "Cielo y ciclo del día" },
  { id: "sol", titulo: "Sol y ondas" },
  { id: "composicion", titulo: "Composición (portal y fluido)" },
  { id: "luces", titulo: "Luces y haces" },
  { id: "telon", titulo: "Telón y entrada" },
  { id: "sala", titulo: "Sala y movimiento" },
  { id: "narrativa", titulo: "Narrativa y checkpoints" },
  { id: "paneles", titulo: "Paneles y proyectos" },
  { id: "visualizador", titulo: "Visualizador y música" },
  { id: "tarima", titulo: "Camino TARIMA (atriles)" },
  { id: "otros", titulo: "Otros" },
  { id: "obsoletos", titulo: "Obsoletos" },   // Z73: siempre última
];

export const SECCIONES_DEBUG: SeccionDebug[] = [
  { id: "diagonalspot", titulo: "DiagonalSpot", pestana: "luces", desdeZ: 0, ultimoZ: 0, avanzada: false, clase: "tecnica", descripcion: "Reflector diagonal de la sala (recargar)" },
  { id: "prism", titulo: "Prism", pestana: "obsoletos", desdeZ: 0, ultimoZ: 0, avanzada: true, clase: "obsoleta", descripcion: "Información del aterrizaje del prisma (solo lectura)", etiqueta: "sin efecto hoy", flagApaga: "solo lectura (landOffset se cambia en el código y al recargar)" },
  { id: "prism-proximity", titulo: "Prism proximity", pestana: "flor", desdeZ: 0, ultimoZ: 0, avanzada: false, clase: "tecnica", descripcion: "Cercanía al prisma: distancias, giro, translucidez (N2)" },
  { id: "dome-visualizer", titulo: "Dome visualizer", pestana: "composicion", desdeZ: 2, ultimoZ: 2, avanzada: false, clase: "tecnica", descripcion: "Esfera del visualizador, música, mallas grandes (F2, G1)" },
  { id: "legado", titulo: "Legado", pestana: "obsoletos", desdeZ: 0, ultimoZ: 0, avanzada: true, clase: "obsoleta", descripcion: "FloorVisualizer y SectorAudioFX desactivados (N2)", etiqueta: "sin efecto hoy", flagApaga: "LEGACY_FLOOR_TEXTURES_ENABLED y LEGACY_SECTOR_AUDIO_ENABLED = false (ExperienceDome.tsx)" },
  { id: "secuencia-sillas", titulo: "Secuencia sillas", pestana: "sala", desdeZ: 0, ultimoZ: 0, avanzada: false, clase: "ocasional", descripcion: "Secuencia SILLAS: liberación y simulación (N1)" },
  { id: "haces-n3-r2-v1", titulo: "Haces N3 R2 V1", pestana: "luces", desdeZ: 0, ultimoZ: 0, avanzada: false, clase: "frecuente", descripcion: "Haces: distancias, colores, interruptores por banda" },
  { id: "sol-n3", titulo: "Sol de la sala (N3)", pestana: "sol", desdeZ: 0, ultimoZ: 0, avanzada: false, clase: "tecnica", descripcion: "Sol de la sala (N3): intensidad y tamaño" },
  { id: "simbolos-n3", titulo: "Símbolos N3", pestana: "visualizador", desdeZ: 0, ultimoZ: 0, avanzada: false, clase: "tecnica", descripcion: "Símbolos del visualizador (N3)" },
  { id: "audio-bandas-n4", titulo: "Audio bandas N4", pestana: "visualizador", desdeZ: 0, ultimoZ: 0, avanzada: false, clase: "ocasional", descripcion: "Bandas de audio: puertas y reasignación (N4)" },
  { id: "monolitos-n5-v1-v2-v3", titulo: "Monolitos N5 V1/V2/V3", pestana: "pasto", desdeZ: 0, ultimoZ: 0, avanzada: false, clase: "frecuente", descripcion: "Monolitos de obsidiana: distancia, material, pantallas, luces" },
  { id: "telon-n6", titulo: "Telón N6", pestana: "telon", desdeZ: 0, ultimoZ: 0, avanzada: false, clase: "frecuente", descripcion: "Telón rojo: distancia, tela, color (N6)" },
  { id: "paneles-sillas", titulo: "Paneles SILLAS", pestana: "paneles", desdeZ: 1, ultimoZ: 13, avanzada: false, clase: "frecuente", descripcion: "Paneles de proyectos del camino SILLAS: paneles (P1), órbitas (Z7) y linterna (Z2) (Z73: fusionadas)" },
  { id: "acercamiento-z8", titulo: "Acercamiento Z8", pestana: "paneles", desdeZ: 8, ultimoZ: 18, avanzada: false, clase: "frecuente", descripcion: "Acercamiento a un panel y subpaneles (Z8 a Z18)" },
  { id: "prioridad-z10-proyecto-abierto-sobre-las", titulo: "Prioridad Z10 — proyecto abierto sobre las órbitas", pestana: "paneles", desdeZ: 10, ultimoZ: 10, avanzada: false, clase: "tecnica", descripcion: "Prioridad del proyecto abierto sobre las órbitas" },
  { id: "inicio-z24", titulo: "Inicio Z24", pestana: "telon", desdeZ: 24, ultimoZ: 25, avanzada: false, clase: "tecnica", descripcion: "Inicio de la experiencia (recargar)" },
  { id: "iconos-del-piso-z23", titulo: "Iconos del piso Z23", pestana: "sala", desdeZ: 23, ultimoZ: 24, avanzada: false, clase: "ocasional", descripcion: "Iconos del piso (SILLAS / LUZ)" },
  { id: "checkpoints-z40", titulo: "Checkpoints Z40", pestana: "narrativa", desdeZ: 40, ultimoZ: 40, avanzada: false, clase: "ocasional", descripcion: "Saltos a checkpoints" },
  { id: "layout-z41", titulo: "Layout Z41", pestana: "sala", desdeZ: 41, ultimoZ: 41, avanzada: false, clase: "frecuente", descripcion: "Posiciones de sillas, público y monolitos" },
  { id: "control-del-dia", titulo: "Control del día", pestana: "cielo", desdeZ: 73, ultimoZ: 67, avanzada: false, clase: "ocasional", descripcion: "tDia, velocidad, ir a una etapa, checkpoints del día y acciones de la flor (lib/controlDia.ts); los botones de Prisma y flor y Base de la flor son atajos" },
  { id: "ciclo-de-dia-z48", titulo: "Ciclo de día Z48", pestana: "cielo", desdeZ: 48, ultimoZ: 55, avanzada: false, clase: "frecuente", descripcion: "Ciclo de día: tDia, velocidad, etapas, saltos" },
  { id: "prisma-y-flor-z54", titulo: "Prisma y flor Z54", pestana: "flor", desdeZ: 54, ultimoZ: 62, avanzada: false, clase: "frecuente", descripcion: "Prisma que sube y flor del ciclo del día" },
  { id: "base-de-la-flor-z67", titulo: "Base de la flor Z67", pestana: "flor", desdeZ: 67, ultimoZ: 67, avanzada: false, clase: "frecuente", descripcion: "Hueco, grietas, astillas y pasto de la base de la flor" },
  { id: "rendimiento-z66", titulo: "Rendimiento Z66", pestana: "rendimiento", desdeZ: 66, ultimoZ: 72, avanzada: false, clase: "ocasional", descripcion: "Medición, DPR adaptativo, sistemas, pasto, benchmark, post-proceso y perfiles (Z66, Z69, Z72: poses, domo a escala, objetivo por refresco)" },
  { id: "pasto-z64", titulo: "Pasto Z64", pestana: "pasto", desdeZ: 64, ultimoZ: 74, avanzada: false, clase: "frecuente", descripcion: "Pasto bajo las 4 luces: progreso, aspecto, completar, monolitos; Z74: crece con solo estar bajo la luz" },
  { id: "pasto-extension-z74", titulo: "Extensión del pasto Z74", pestana: "pasto", desdeZ: 74, ultimoZ: 74, avanzada: false, clase: "frecuente", descripcion: "Extensión del pasto hasta el borde del círculo del piso: modo, radio, tiempos, brillo, tope de bloques y botones" },
  { id: "fluir-de-color-z61", titulo: "Fluir de color Z61", pestana: "composicion", desdeZ: 61, ultimoZ: 65, avanzada: false, clase: "frecuente", descripcion: "Fluir de color de los bloques azul y naranja" },
  { id: "ondas-por-kick-z52", titulo: "Ondas por kick Z52", pestana: "sol", desdeZ: 52, ultimoZ: 58, avanzada: false, clase: "frecuente", descripcion: "Ondas expansivas por kick desde el portal" },
  { id: "sol-nuevo-z51", titulo: "Sol del cielo (Z51)", pestana: "sol", desdeZ: 51, ultimoZ: 57, avanzada: false, clase: "frecuente", descripcion: "Sol nuevo: núcleo, rayos y destello de lente" },
  { id: "composicion-del-domo-z49", titulo: "Composición del domo Z49", pestana: "composicion", desdeZ: 49, ultimoZ: 57, avanzada: false, clase: "frecuente", descripcion: "Escala del portal y tinte del cielo" },
  { id: "texto-del-telon-z46", titulo: "Texto del telón Z46", pestana: "telon", desdeZ: 46, ultimoZ: 71, avanzada: false, clase: "frecuente", descripcion: "Texto proyectado sobre el telón y crédito con efecto de foco (Z71)" },
  { id: "fractal-del-prisma-z43", titulo: "Fractal del prisma Z43", pestana: "flor", desdeZ: 43, ultimoZ: 45, avanzada: false, clase: "frecuente", descripcion: "Fractal de las caras del prisma (Z43 a Z45, Z69)" },
  { id: "luces-del-visualizador-z42", titulo: "Luces del visualizador Z42", pestana: "luces", desdeZ: 42, ultimoZ: 42, avanzada: false, clase: "frecuente", descripcion: "Luces del visualizador: halo, cono y charco" },
  { id: "reloj-de-la-experiencia-z39", titulo: "Reloj de la experiencia Z39", pestana: "sala", desdeZ: 39, ultimoZ: 39, avanzada: false, clase: "tecnica", descripcion: "Reloj único de la experiencia (RELOJ_UNIFICADO)" },
  { id: "movimiento-z34", titulo: "Movimiento Z34", pestana: "sala", desdeZ: 34, ultimoZ: 34, avanzada: false, clase: "frecuente", descripcion: "Velocidad y movimiento WASD" },
  { id: "efectos-del-dialogo-z29", titulo: "Efectos del diálogo Z29", pestana: "narrativa", desdeZ: 29, ultimoZ: 40, avanzada: false, clase: "ocasional", descripcion: "Efectos del diálogo: alarma, premio, pruebas" },
  { id: "camino-luz-z28", titulo: "Camino LUZ Z28", pestana: "narrativa", desdeZ: 28, ultimoZ: 28, avanzada: false, clase: "frecuente", descripcion: "Luz lejana del camino LUZ" },
  { id: "cielo-estrellado-z30", titulo: "Cielo estrellado Z30", pestana: "cielo", desdeZ: 30, ultimoZ: 33, avanzada: false, clase: "frecuente", descripcion: "Cielo estrellado del camino LUZ y límites del exterior" },
  { id: "dialogo-z27", titulo: "Diálogo Z27 (terminal)", pestana: "narrativa", desdeZ: 27, ultimoZ: 35, avanzada: false, clase: "ocasional", descripcion: "Terminal de diálogo ink: probar, cerrar, tiempos" },
  { id: "video-etapa-1", titulo: "Video — etapa 1 (reproductor aparte)", pestana: "paneles", desdeZ: 23, ultimoZ: 23, avanzada: false, clase: "ocasional", descripcion: "Reproductor de video aparte" },
  { id: "foco-z19-subpanel-agrandado", titulo: "Foco Z19 — subpanel agrandado", pestana: "paneles", desdeZ: 19, ultimoZ: 21, avanzada: false, clase: "frecuente", descripcion: "Foco: subpanel agrandado" },
  { id: "subpaneles-z4-historia-galeria-ficha", titulo: "Subpaneles Z4 — HISTORIA / GALERÍA / FICHA", pestana: "paneles", desdeZ: 4, ultimoZ: 11, avanzada: false, clase: "frecuente", descripcion: "Subpaneles HISTORIA / GALERÍA / FICHA" },
  { id: "destello-de-cortina-f1", titulo: "Destello de cortina F1", pestana: "telon", desdeZ: 1, ultimoZ: 1, avanzada: false, clase: "frecuente", descripcion: "Destello al cruzar el telón (F1 a G3)" },
  { id: "entrada-tras-el-telon-z59", titulo: "Entrada tras el telón Z59", pestana: "telon", desdeZ: 59, ultimoZ: 75, avanzada: false, clase: "frecuente", descripcion: "Pose de entrada tras el telón" },
  { id: "panorama-svg", titulo: "Panorama SVG (apagado)", pestana: "obsoletos", desdeZ: 0, ultimoZ: 0, avanzada: true, clase: "obsoleta", descripcion: "Panorama de capas SVG: T2, U4 (sol, montañas, cielo, líneas), U5, U7, U10A y AA1 (Z73: fusionadas)", etiqueta: "código viejo", flagApaga: "DBG_SILLAS.usarDomoShader = true y domoOriginal = false (el shader del domo reemplaza a VizPanorama)" },
  { id: "reaccion-t3-audio", titulo: "Reacción T3 — audio", pestana: "visualizador", desdeZ: 0, ultimoZ: 0, avanzada: false, clase: "tecnica", descripcion: "Reacción al audio de los grupos (T3)" },
  { id: "u6a-anillos-en-piso", titulo: "U6A — Anillos en piso", pestana: "luces", desdeZ: 0, ultimoZ: 0, avanzada: false, clase: "ocasional", descripcion: "Anillos en el piso al entrar al haz (U6A)" },
  { id: "u6b-destello-del-haz", titulo: "U6B — Destello del haz", pestana: "luces", desdeZ: 0, ultimoZ: 0, avanzada: false, clase: "ocasional", descripcion: "Destello del haz al activar (U6B)" },
  { id: "amanecer-viejo", titulo: "Amanecer viejo", pestana: "obsoletos", desdeZ: 38, ultimoZ: 38, avanzada: true, clase: "obsoleta", descripcion: "Amanecer del panorama SVG (U9) y del shader (W3), reemplazados por el amanecer único (Z38) y el ciclo de día (Z48) (Z73: fusionadas)", etiqueta: "código viejo", flagApaga: "DBG_AMANECER.UNIFICADO = true (con false vuelven las dos máquinas viejas)" },
  { id: "amanecer-z38", titulo: "Amanecer Z38", pestana: "cielo", desdeZ: 38, ultimoZ: 38, avanzada: false, clase: "tecnica", descripcion: "Máquina única del amanecer (UNIFICADO, MONOLITOS_CAPTURA)" },
  { id: "u10b-reaccion-al-sonido", titulo: "U10B — Reacción al sonido", pestana: "visualizador", desdeZ: 0, ultimoZ: 0, avanzada: false, clase: "tecnica", descripcion: "Reacción al sonido por capa (U10B)" },
  { id: "u11-camera-feedback", titulo: "U11 — Camera feedback (haz-toggle)", pestana: "visualizador", desdeZ: 0, ultimoZ: 0, avanzada: false, clase: "tecnica", descripcion: "Respuesta de cámara al interruptor de haz (U11)" },
  { id: "shader-del-domo", titulo: "Shader del domo", pestana: "composicion", desdeZ: 0, ultimoZ: 1, avanzada: true, clase: "tecnica", descripcion: "Shader del domo: W1 (flags y escala), W2 (multiplicadores), W4 (ajustes), W5 (siluetas) y X2 (diagnóstico) (Z73: fusionadas)" },
  { id: "u2-agc-amplitudes", titulo: "U2 — AGC + amplitudes", pestana: "visualizador", desdeZ: 0, ultimoZ: 0, avanzada: false, clase: "tecnica", descripcion: "Control automático de ganancia y medidores (U2)" },
  { id: "debug-overlays", titulo: "Overlays del prisma, audio y efectos (R1)", pestana: "otros", desdeZ: 0, ultimoZ: 0, avanzada: false, clase: "tecnica", descripcion: "Overlays de diagnóstico (prisma, audio, efectos)" },
  { id: "post-proceso-r4", titulo: "Post-proceso R4", pestana: "rendimiento", desdeZ: 0, ultimoZ: 0, avanzada: false, clase: "frecuente", descripcion: "CRT y bloom: intensidades, curvatura, scanlines, exposición (R4)" },
  { id: "stars", titulo: "Stars", pestana: "tarima", desdeZ: 0, ultimoZ: 0, avanzada: false, clase: "tecnica", descripcion: "Estrellas del domo de caras" },
  { id: "dome", titulo: "Dome", pestana: "tarima", desdeZ: 0, ultimoZ: 0, avanzada: false, clase: "tecnica", descripcion: "Domo de caras" },
  { id: "sector-effects", titulo: "Sector effects", pestana: "tarima", desdeZ: 0, ultimoZ: 0, avanzada: false, clase: "tecnica", descripcion: "Efectos por sector del domo de caras" },
  { id: "lecterns", titulo: "Lecterns", pestana: "tarima", desdeZ: 0, ultimoZ: 0, avanzada: false, clase: "frecuente", descripcion: "Atriles: posiciones, cámaras, overlays de atriles (T7)" },
  { id: "retro-atriles", titulo: "Retro atriles", pestana: "tarima", desdeZ: 0, ultimoZ: 0, avanzada: false, clase: "frecuente", descripcion: "Estilo retro de los atriles (J5)" },
  { id: "face-capture", titulo: "Face capture", pestana: "tarima", desdeZ: 0, ultimoZ: 0, avanzada: false, clase: "tecnica", descripcion: "Captura de caras (recargar)" },
  { id: "audio", titulo: "Audio (T7 — read-only live)", pestana: "tarima", desdeZ: 0, ultimoZ: 0, avanzada: false, clase: "tecnica", descripcion: "Audio de los atriles (solo lectura)" },
  { id: "extra-lights", titulo: "Extra lights", pestana: "tarima", desdeZ: 0, ultimoZ: 0, avanzada: false, clase: "tecnica", descripcion: "Luces extra del panel T5 (solo lectura)" },
  { id: "controles-sin-efecto", titulo: "Controles sin efecto", pestana: "obsoletos", desdeZ: 0, ultimoZ: 0, avanzada: true, clase: "obsoleta", descripcion: "Controles que ya no hacen nada, movidos desde su sección (prismRangeScale de Prism proximity)", etiqueta: "sin efecto hoy", flagApaga: "prismRangeScale: legacy N1, ya no se aplica (la cercanía usa nearM / closeM / maxEffectM)" },
];

/** Valores distintos de ultimoZ (> 0), de mayor a menor. */
export function zetasDistintas(secs: readonly SeccionDebug[] = SECCIONES_DEBUG): number[] {
  return [...new Set(secs.map(s => s.ultimoZ).filter(z => z > 0))].sort((a, b) => b - a);
}
/** Orden de presentación: ultimoZ desc, desdeZ desc, orden del registro. */
export function ordenarSecciones(secs: readonly SeccionDebug[], todas: readonly SeccionDebug[] = SECCIONES_DEBUG): SeccionDebug[] {
  const idx = (s: SeccionDebug) => todas.indexOf(s);
  return [...secs].sort((a, b) => b.ultimoZ - a.ultimoZ || b.desdeZ - a.desdeZ || idx(a) - idx(b));
}
export const N_RECIENTES = 5, N_NUEVO = 3;
/** Secciones de una pestaña (o de "Recientes"), ya ordenadas. */
export function seccionesDePestana(pestana: string, secs: readonly SeccionDebug[] = SECCIONES_DEBUG): SeccionDebug[] {
  if (pestana === PESTANA_RECIENTES) {
    const z = new Set(zetasDistintas(secs).slice(0, N_RECIENTES));
    return ordenarSecciones(secs.filter(s => z.has(s.ultimoZ)), secs);
  }
  return ordenarSecciones(secs.filter(s => s.pestana === pestana), secs);
}
/** Pestañas en orden: Recientes, Favoritos (Z73), después por el ultimoZ más alto de sus secciones (empate: orden de
 *  PESTANAS_DEBUG) y Obsoletos al final (Z73). */
export function ordenPestanas(secs: readonly SeccionDebug[] = SECCIONES_DEBUG): { id: string; titulo: string; ultimoZ: number }[] {
  const conZ = PESTANAS_DEBUG.map((p, i) => ({ ...p, i, ultimoZ: Math.max(0, ...secs.filter(s => s.pestana === p.id).map(s => s.ultimoZ)) }))
    .filter(p => p.id !== PESTANA_OBSOLETOS && secs.some(s => s.pestana === p.id))
    .sort((a, b) => b.ultimoZ - a.ultimoZ || a.i - b.i)
    .map(({ id, titulo, ultimoZ }) => ({ id, titulo, ultimoZ }));
  const obs = secs.some(s => s.pestana === PESTANA_OBSOLETOS)
    ? [{ id: PESTANA_OBSOLETOS, titulo: "Obsoletos", ultimoZ: Math.max(0, ...secs.filter(s => s.pestana === PESTANA_OBSOLETOS).map(s => s.ultimoZ)) }] : [];
  return [{ id: PESTANA_RECIENTES, titulo: "Recientes", ultimoZ: zetasDistintas(secs)[0] ?? 0 },
    { id: PESTANA_FAVORITOS, titulo: "Favoritos", ultimoZ: 0 }, ...conZ, ...obs];
}
/** Modificada en los últimos N_NUEVO valores distintos de ultimoZ. */
export function esNueva(s: SeccionDebug, secs: readonly SeccionDebug[] = SECCIONES_DEBUG): boolean {
  return s.ultimoZ > 0 && zetasDistintas(secs).slice(0, N_NUEVO).includes(s.ultimoZ);
}
export function tituloPestana(id: string): string {
  return id === PESTANA_RECIENTES ? "Recientes" : id === PESTANA_FAVORITOS ? "Favoritos" : PESTANAS_DEBUG.find(p => p.id === id)?.titulo ?? id;
}
/** Z73: secciones fijadas, en el orden en que se fijaron (los ids que ya no existen se ignoran). */
export function seccionesFavoritas(ids: readonly string[], secs: readonly SeccionDebug[] = SECCIONES_DEBUG): SeccionDebug[] {
  const r: SeccionDebug[] = [];
  for (const id of ids) { const s = secs.find(x => x.id === id); if (s && !r.includes(s)) r.push(s); }
  return r;
}

/** Buscador: secciones cuyo título, descripción o controles (índice de nombres) contienen el texto (sin distinguir
 *  mayúsculas ni tildes). Devuelve la sección y los nombres de controles que coinciden. */
export function buscarSecciones(texto: string, indice: Record<string, readonly string[]>, secs: readonly SeccionDebug[] = SECCIONES_DEBUG):
  { seccion: SeccionDebug; coincidencias: string[] }[] {
  const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const q = norm(texto.trim());
  if (!q) return [];
  const r: { seccion: SeccionDebug; coincidencias: string[] }[] = [];
  for (const s of ordenarSecciones(secs, secs)) {
    const co = (indice[s.id] ?? []).filter(n => norm(n).includes(q));
    if (co.length || norm(s.titulo).includes(q) || norm(s.descripcion).includes(q)) r.push({ seccion: s, coincidencias: co });
  }
  return r;
}

// ── estado persistente (localStorage; el texto del buscador no se guarda) ──
export const CLAVE_MENU = "alight:debug-menu";
export interface EstadoMenu { pestana: string; plegadas: Record<string, boolean> }
type Almacen = { getItem(k: string): string | null; setItem(k: string, v: string): void } | null | undefined;
export function leerEstadoMenu(s: Almacen): EstadoMenu | null {
  try {
    const v = s ? s.getItem(CLAVE_MENU) : null;
    if (!v) return null;
    const o = JSON.parse(v) as Partial<EstadoMenu>;
    const pestana = typeof o.pestana === "string" && (o.pestana === PESTANA_RECIENTES || o.pestana === PESTANA_FAVORITOS || PESTANAS_DEBUG.some(p => p.id === o.pestana)) ? o.pestana : PESTANA_RECIENTES;
    const plegadas: Record<string, boolean> = {};
    if (o.plegadas && typeof o.plegadas === "object") for (const [k, b] of Object.entries(o.plegadas)) if (typeof b === "boolean") plegadas[k] = b;
    return { pestana, plegadas };
  } catch { return null; }
}
export function guardarEstadoMenu(s: Almacen, e: EstadoMenu): boolean {
  try { if (!s) return false; s.setItem(CLAVE_MENU, JSON.stringify(e)); return true; } catch { return false; }
}

// ── Z73: favoritos (clave propia; solo ids de sección: el estado de los controles no se duplica) ──
export const CLAVE_FAVORITOS = "alight:debug-favoritos";
export function leerFavoritos(s: Almacen): string[] {
  try {
    const v = s ? s.getItem(CLAVE_FAVORITOS) : null;
    const o = v ? (JSON.parse(v) as unknown) : null;
    return Array.isArray(o) ? o.filter((x): x is string => typeof x === "string" && SECCIONES_DEBUG.some(sec => sec.id === x)) : [];
  } catch { return []; }
}
export function guardarFavoritos(s: Almacen, ids: readonly string[]): boolean {
  try { if (!s) return false; s.setItem(CLAVE_FAVORITOS, JSON.stringify(ids)); return true; } catch { return false; }
}
/** Agrega o quita una sección de favoritos (devuelve un arreglo nuevo: se llama al hacer clic, no por frame). */
export function alternarFavorito(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id];
}
