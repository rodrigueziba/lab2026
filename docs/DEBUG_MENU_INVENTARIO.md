# Inventario del menú de debug (Z70)

Foto del menú **antes** de reorganizarlo: `DebugMenu.tsx` monolítico del commit `9470cea` (Z69). Generado con
`node scripts/debug-menu-inventario.mjs` (datos completos, con la firma de cada control y los defaults de todos los
`DBG_*`, en `docs/debug-menu-inventario.json`; los usa `scripts/debug-menu-test.mjs`). Fecha: 2026-11-16.

## a) Tamaño

| | |
|---|---|
| `components/DebugMenu.tsx` | 3580 líneas (una sola función de componente con ~130 hooks de estado) |
| `lib/debugConfig.ts` | 1365 líneas · 50 objetos `DBG_*` (57 exports en total) |
| Secciones | 77 (69 en la pestaña SILLAS y 8 en TARIMA; el bloque "Legado" cuenta como una) |
| Controles en secciones | 687 (+4 fuera de secciones: pestañas, premio y los dos campos genéricos) |

Controles por tipo: campos numéricos 474 · interruptores (ON/off) 110 · botones 58 ·
sliders 21 · selectores de color 18 · selectores (desplegables) 4 · campo de texto 1 ·
panel de rendimiento (Z66/Z69, con sus propios ~45 controles en `RendimientoPanel.tsx`) 1.
De los numéricos, 21 son de solo lectura (sin `onChange`) y 22 controles dicen "reload/recargar".

## b) Secciones

Z de origen: el del título, o el menor mencionado en el código o en `git blame` (mensaje del commit). Z de última
modificación: el mayor de esos. "pre-Z": sección con código de letra anterior a la numeración Z (C, F, G, H, J, N, P, R,
S, T, U, V, W, X, AA); no se puede ubicar en la escala Z. Líneas: posición en el `DebugMenu.tsx` viejo.

| Sección | Pestaña nueva | Objetos | Controles | Origen | Última | Clase | Líneas |
|---|---|---|---|---|---|---|---|
| DiagonalSpot | Luces y haces | — | 7 | pre-Z | pre-Z | tecnica | 630–646 |
| Prism | Flor, prisma y tarima | DBG_PRISM | 1 | pre-Z | pre-Z | obsoleta · avanzada | 650–651 |
| Prism proximity | Flor, prisma y tarima | DBG_PRISM | 8 | pre-Z | pre-Z | tecnica | 654–669 |
| Dome visualizer | Composición (portal y fluido) | DBG_SILLAS | 25 | Z2 | Z2 | tecnica | 672–810 |
| Legado | Visualizador y música | DBG_FLOOR, DBG_EFFECTS | 21 | pre-Z | pre-Z | obsoleta · avanzada | 813–888 |
| Secuencia sillas | Sala y movimiento | DBG_SILLAS | 4 | pre-Z | pre-Z | ocasional | 891–911 |
| Haces N3 R2 V1 | Luces y haces | DBG_SILLAS | 16 | pre-Z | pre-Z | frecuente | 914–960 |
| Sol N3 | Sol y ondas | DBG_SILLAS | 3 | pre-Z | pre-Z | tecnica | 963–975 |
| Símbolos N3 | Visualizador y música | DBG_SILLAS | 3 | pre-Z | pre-Z | tecnica | 978–984 |
| Audio bandas N4 | Visualizador y música | DBG_SILLAS | 4 | pre-Z | pre-Z | ocasional | 987–1012 |
| Monolitos N5 V1/V2/V3 | Pasto y monolitos | DBG_SILLAS | 25 | pre-Z | pre-Z | frecuente | 1015–1093 |
| Telón N6 | Telón y entrada | DBG_SILLAS | 7 | pre-Z | pre-Z | frecuente | 1096–1116 |
| Paneles SILLAS P1 | Paneles y proyectos | DBG_PANELES | 16 | Z1 | Z6 | frecuente | 1119–1186 |
| Órbitas Z7 — paneles SILLAS | Paneles y proyectos | DBG_ORBITAS | 14 | Z7 | Z7 | frecuente | 1189–1228 |
| Linterna Z2 — paneles SILLAS | Paneles y proyectos | DBG_LINTERNA | 11 | Z2 | Z13 | frecuente | 1231–1268 |
| Acercamiento Z8 | Paneles y proyectos | DBG_ACERC, DBG_SUBPANELES, DBG_AISLAR_UI, DBG_LOG_PANEL | 48 | Z8 | Z18 | frecuente | 1271–1460 |
| Prioridad Z10 — proyecto abierto sobre las órbitas | Paneles y proyectos | DBG_PRIORIDAD | 7 | Z10 | Z10 | tecnica | 1463–1489 |
| Inicio Z24 | Telón y entrada | DBG_INICIO | 2 | Z24 | Z25 | tecnica | 1492–1496 |
| Iconos del piso Z23 | Sala y movimiento | DBG_PISO_ICONOS | 12 | Z23 | Z24 | ocasional | 1498–1528 |
| Checkpoints Z40 | Narrativa y checkpoints | DBG_CHECKPOINTS | 3 | Z40 | Z40 | ocasional | 1531–1562 |
| Layout Z41 | Sala y movimiento | DBG_LAYOUT | 3 | Z41 | Z41 | frecuente | 1564–1583 |
| Ciclo de día Z48 | Cielo y ciclo del día | DBG_DIA | 5 | Z48 | Z55 | frecuente | 1585–1626 |
| Prisma y flor Z54 | Flor, prisma y tarima | DBG_FLOR, DBG_DIA | 6 | Z54 | Z62 | frecuente | 1627–1675 |
| Base de la flor Z67 | Flor, prisma y tarima | DBG_BASE_FLOR, DBG_CHECKPOINTS, DBG_DIA, DBG_FLOR | 5 | Z67 | Z67 | frecuente | 1676–1713 |
| Rendimiento Z66 | Rendimiento | — | 1 | Z66 | Z69 | ocasional | 1714–1715 |
| Pasto Z64 | Pasto y monolitos | DBG_PASTO | 7 | Z64 | Z65 | frecuente | 1716–1761 |
| Fluir de color Z61 | Composición (portal y fluido) | DBG_FLUIDO | 7 | Z61 | Z65 | frecuente | 1762–1816 |
| Ondas por kick Z52 | Sol y ondas | DBG_ONDAS | 6 | Z52 | Z58 | frecuente | 1817–1854 |
| Sol nuevo Z51 | Sol y ondas | DBG_SOL | 2 | Z51 | Z57 | frecuente | 1855–1874 |
| Composición del domo Z49 | Composición (portal y fluido) | DBG_PORTAL, DBG_DIA | 5 | Z49 | Z57 | frecuente | 1875–1916 |
| Texto del telón Z46 | Telón y entrada | DBG_TELON_TEXTO | 3 | Z46 | Z46 | frecuente | 1918–1938 |
| Fractal del prisma Z43 | Flor, prisma y tarima | DBG_FRACTAL | 3 | Z43 | Z45 | frecuente | 1940–1977 |
| Luces del visualizador Z42 | Luces y haces | DBG_LUCES | 3 | Z42 | Z42 | frecuente | 1979–2012 |
| Reloj de la experiencia Z39 | Sala y movimiento | DBG_SECUENCIA | 4 | Z39 | Z39 | tecnica | 2014–2031 |
| Movimiento Z34 | Sala y movimiento | DBG_MOV | 5 | Z34 | Z34 | frecuente | 2033–2049 |
| Efectos del diálogo Z29 | Narrativa y checkpoints | DBG_EFECTOS | 20 | Z29 | Z40 | ocasional | 2051–2096 |
| Camino LUZ Z28 | Narrativa y checkpoints | DBG_LUZ | 24 | Z28 | Z28 | frecuente | 2098–2180 |
| Cielo estrellado Z30 | Cielo y ciclo del día | DBG_LUZ | 36 | Z30 | Z33 | frecuente | 2182–2321 |
| Diálogo Z27 (terminal) | Narrativa y checkpoints | DBG_DIALOGO | 13 | Z27 | Z35 | ocasional | 2323–2370 |
| Video — etapa 1 (reproductor aparte) | Paneles y proyectos | DBG_VIDEO | 4 | Z23 | Z23 | ocasional | 2372–2404 |
| Foco Z19 — subpanel agrandado | Paneles y proyectos | DBG_FOCO | 25 | Z19 | Z21 | frecuente | 2407–2490 |
| Subpaneles Z4 — HISTORIA / GALERÍA / FICHA | Paneles y proyectos | DBG_SUBPANELES | 22 | Z4 | Z11 | frecuente | 2493–2561 |
| Destello de cortina F1 | Telón y entrada | DBG_FLASH | 39 | Z1 | Z1 | frecuente | 2564–2697 |
| Entrada tras el telón Z59 | Telón y entrada | DBG_ENTRADA | 5 | Z59 | Z65 | frecuente | 2698–2727 |
| Panorama T2 — crecimiento de grupos | Composición (portal y fluido) | DBG_SILLAS | 4 | pre-Z | pre-Z | obsoleta · avanzada | 2730–2772 |
| Reacción T3 — audio | Visualizador y música | DBG_SILLAS | 10 | pre-Z | pre-Z | tecnica | 2775–2825 |
| U4 — SOL | Composición (portal y fluido) | DBG_SILLAS | 4 | pre-Z | pre-Z | obsoleta · avanzada | 2828–2836 |
| U4 — MONTAÑAS | Composición (portal y fluido) | DBG_SILLAS | 7 | pre-Z | pre-Z | obsoleta · avanzada | 2839–2853 |
| U4 — CIELO | Composición (portal y fluido) | DBG_SILLAS | 4 | pre-Z | pre-Z | obsoleta · avanzada | 2856–2864 |
| U4 — LÍNEAS | Composición (portal y fluido) | DBG_SILLAS | 2 | pre-Z | pre-Z | obsoleta · avanzada | 2867–2871 |
| U5 — LÍNEAS líquidas | Composición (portal y fluido) | DBG_SILLAS | 7 | pre-Z | pre-Z | obsoleta · avanzada | 2874–2893 |
| U6A — Anillos en piso | Luces y haces | DBG_SILLAS | 7 | pre-Z | pre-Z | ocasional | 2896–2910 |
| U6B — Destello del haz | Luces y haces | DBG_SILLAS | 5 | pre-Z | pre-Z | ocasional | 2913–2923 |
| U7 — Capas visibles | Composición (portal y fluido) | DBG_SILLAS | 2 | pre-Z | pre-Z | obsoleta · avanzada | 2926–2948 |
| U9 — Secuencia amanecer | Cielo y ciclo del día | DBG_SILLAS | 5 | Z38 | Z38 | obsoleta · avanzada | 2951–2961 |
| Amanecer Z38 | Cielo y ciclo del día | DBG_AMANECER | 5 | Z38 | Z38 | tecnica | 2962–2994 |
| U10A — Parallax por capa | Composición (portal y fluido) | DBG_SILLAS | 6 | pre-Z | pre-Z | obsoleta · avanzada | 2997–3009 |
| U10B — Reacción al sonido | Visualizador y música | DBG_SILLAS | 13 | pre-Z | pre-Z | tecnica | 3012–3038 |
| U11 — Camera feedback (haz-toggle) | Visualizador y música | DBG_SILLAS | 11 | pre-Z | pre-Z | tecnica | 3041–3063 |
| AA1 — Domo original | Composición (portal y fluido) | DBG_SILLAS | 2 | pre-Z | pre-Z | obsoleta · avanzada | 3066–3082 |
| W1 — Domo de shader | Composición (portal y fluido) | DBG_SILLAS | 5 | Z1 | Z1 | tecnica · avanzada | 3084–3101 |
| W2 — Multiplicadores de grupo | Composición (portal y fluido) | DBG_SILLAS | 5 | pre-Z | pre-Z | tecnica | 3104–3114 |
| W3 — Amanecer DomeSky | Cielo y ciclo del día | DBG_SILLAS | 6 | Z38 | Z38 | obsoleta · avanzada | 3117–3129 |
| W4 — DomeSky ajuste de shader | Composición (portal y fluido) | DBG_SILLAS | 8 | pre-Z | pre-Z | tecnica | 3132–3183 |
| W5 — Siluetas suaves | Composición (portal y fluido) | DBG_SILLAS | 2 | pre-Z | pre-Z | tecnica · avanzada | 3186–3195 |
| X2 Domo diagnóstico | Composición (portal y fluido) | DBG_SILLAS, DBG_DOME_FORCE | 3 | pre-Z | pre-Z | tecnica · avanzada | 3198–3289 |
| U2 — AGC + amplitudes | Visualizador y música | DBG_SILLAS | 12 | pre-Z | pre-Z | tecnica | 3292–3323 |
| Debug overlays | Otros | DBG_SILLAS | 1 | pre-Z | pre-Z | tecnica | 3326–3334 |
| Post-proceso R4 | Rendimiento | DBG_RETRO_FX | 17 | pre-Z | pre-Z | frecuente | 3337–3402 |
| Stars | Camino TARIMA (atriles) | — | 7 | pre-Z | pre-Z | tecnica | 3408–3422 |
| Dome | Camino TARIMA (atriles) | DBG_DOME | 2 | pre-Z | pre-Z | tecnica | 3426–3428 |
| Sector effects | Camino TARIMA (atriles) | — | 1 | pre-Z | pre-Z | tecnica | 3431–3445 |
| Lecterns | Camino TARIMA (atriles) | DBG_LECTERNS, DBG_CAM_IMAGE, DBG_CAM_SOUND | 22 | pre-Z | pre-Z | frecuente | 3448–3532 |
| Retro atriles | Camino TARIMA (atriles) | DBG_RETRO | 2 | pre-Z | pre-Z | frecuente | 3535–3545 |
| Face capture | Camino TARIMA (atriles) | DBG_FACE | 2 | pre-Z | pre-Z | tecnica | 3548–3560 |
| Audio (T7 — read-only live) | Camino TARIMA (atriles) | — | 6 | pre-Z | pre-Z | tecnica | 3563–3569 |
| Extra lights | Camino TARIMA (atriles) | — | 2 | pre-Z | pre-Z | tecnica | 3572–3574 |

## c) Clasificación

- **Frecuente** (se retoca al ajustar el aspecto): 29 secciones.
- **Ocasional** (pruebas, botones de simulación, saltos): 10: Secuencia sillas, Audio bandas N4, Iconos del piso Z23, Checkpoints Z40, Rendimiento Z66, Efectos del diálogo Z29, Diálogo Z27 (terminal), Video — etapa 1 (reproductor aparte), U6A — Anillos en piso, U6B — Destello del haz.
- **Técnica o avanzada**: 25.
- **Obsoleta o con código viejo detrás de flags**: 13: Prism, Legado, Panorama T2 — crecimiento de grupos, U4 — SOL, U4 — MONTAÑAS, U4 — CIELO, U4 — LÍNEAS, U5 — LÍNEAS líquidas, U7 — Capas visibles, U9 — Secuencia amanecer, U10A — Parallax por capa, AA1 — Domo original, W3 — Amanecer DomeSky.

Flags de código viejo que siguen en el menú (no se tocan): `DBG_AMANECER.UNIFICADO` y `MONOLITOS_CAPTURA` (sección
Amanecer Z38), `DBG_SECUENCIA.RELOJ_UNIFICADO` (Reloj Z39), `DBG_DIA.NUEVO` (Ciclo de día Z48), los modos viejos del
cielo `ESTRELLAS_MODO_VIEJO` / `ESTRELLAS_MODO_Z30` (Cielo estrellado Z30) y el panorama SVG (T2, U4, U5, U7, U10A, AA1).

## d) Duplicados, solapamientos y controles sin efecto

- **Tres "sol"**: Sol N3 (sol de la sala), Sol nuevo Z51 (cielo) y U4 — SOL (panorama SVG apagado). Nombres confusos.
- **Tres "amanecer"**: Amanecer Z38 (el único activo), U9 — Secuencia amanecer y W3 — Amanecer DomeSky (consumidores
  viejos; con `UNIFICADO` en true solo conservan su fase 2 y paleta).
- **Dos "Debug overlays"**: el de R1 (prisma, audio, efectos) y el de los atriles (modo, bloqueo, hover) dentro de
  Lecterns: mismo nombre, cosas distintas.
- **El camino LUZ está partido**: los controles `EXTERIOR_RADIO_M`, `ACTIVACION_M`, `GIRO_MS`, `TELEPORT_DIST_M`,
  `LUZ_COLOR` (de `DBG_LUZ`) están al final de "Cielo estrellado Z30" y no en "Camino LUZ Z28". Candidatas a fusionar.
- **`DBG_DIA.T_MANUAL` y `VELOCIDAD` se tocan desde tres secciones** (Ciclo de día, Prisma y flor, Base de la flor):
  botones de prueba parecidos ("ir a tDia", "Mostrar base con flor", "Animar nacimiento"). Y `VELOCIDAD` también en
  Movimiento (pero ahí es `DBG_MOV`: mismo nombre, otro objeto).
- **Saltos a checkpoints** desde Checkpoints Z40 y desde Base de la flor Z67 (botón "Mostrar base con flor").
- **Sin efecto hoy**: `prismRangeScale` (Prism proximity: "legacy N1, no longer applied"), la sección Prism (solo
  lectura), Legado (FloorVisualizer y SectorAudioFX desactivados), las secciones del panorama SVG (T2, U4, U5, U7,
  U10A, AA1: el panorama está apagado detrás de un flag), y los 21 campos de solo lectura (Stars, Audio, Extra lights,
  Lecterns, Dome visualizer).
- **Requieren recargar** (22 controles): DiagonalSpot, `vizTexSize`, origen y radio del cono de los haces, geometría de
  los monolitos, Inicio Z24, Face capture.
- **Podrían fusionarse**: U4 — SOL / MONTAÑAS / CIELO / LÍNEAS (cuatro secciones chicas del mismo panorama); W1 a W5
  (shader del domo); Paneles P1 + Órbitas Z7 + Linterna Z2 (los tres son "paneles SILLAS").

## e) Costo del menú (antes de Z70)

- **Todo de golpe**: al abrirlo se dibujaba la pestaña SILLAS entera: ~640 controles y ~2800 líneas de JSX en cada
  render (TARIMA aparte, ~48).
- **Re-render con el menú abierto**: un intervalo de 100 ms (destello) crea un objeto nuevo cada vez → el menú entero se
  vuelve a dibujar unas 10 veces por segundo, más los de 150 ms (fluido), 200 ms (pasto) y 250 ms (eje del sol, día):
  ~20 renders por segundo de ~640 controles.
- **Con el menú cerrado**: los intervalos del pasto, el fluido, el eje y el día seguían corriendo (no dependían de que
  el menú estuviera abierto): ~16 actualizaciones de estado por segundo que re-ejecutaban el componente (con sus ~130
  hooks) aunque devolviera nada. No era trabajo por frame de three.js, pero sí trabajo de React en el hilo principal.
- **FPS**: no se pudo medir en una GPU real (solo Chrome headless con render por software, donde la medición varía
  demasiado). Estimación: con el menú abierto, decenas de miles de nodos del DOM recalculados ~20 veces por segundo
  pueden costar varios ms de CPU por segundo y producir tirones; cerrado, el costo era chico.

## f) Agrupación propuesta (aplicada en Z70)

Pestañas (el orden real se calcula por `ultimoZ`; "Recientes" va siempre primero):

- **Luces y haces**: DiagonalSpot, Haces N3 R2 V1, Luces del visualizador Z42, U6A — Anillos en piso, U6B — Destello del haz
- **Flor, prisma y tarima**: Prism, Prism proximity, Prisma y flor Z54, Base de la flor Z67, Fractal del prisma Z43
- **Composición (portal y fluido)**: Dome visualizer, Fluir de color Z61, Composición del domo Z49, Panorama T2 — crecimiento de grupos, U4 — SOL, U4 — MONTAÑAS, U4 — CIELO, U4 — LÍNEAS, U5 — LÍNEAS líquidas, U7 — Capas visibles, U10A — Parallax por capa, AA1 — Domo original, W1 — Domo de shader, W2 — Multiplicadores de grupo, W4 — DomeSky ajuste de shader, W5 — Siluetas suaves, X2 Domo diagnóstico
- **Visualizador y música**: Legado, Símbolos N3, Audio bandas N4, Reacción T3 — audio, U10B — Reacción al sonido, U11 — Camera feedback (haz-toggle), U2 — AGC + amplitudes
- **Sala y movimiento**: Secuencia sillas, Iconos del piso Z23, Layout Z41, Reloj de la experiencia Z39, Movimiento Z34
- **Sol y ondas**: Sol N3, Ondas por kick Z52, Sol nuevo Z51
- **Pasto y monolitos**: Monolitos N5 V1/V2/V3, Pasto Z64
- **Telón y entrada**: Telón N6, Inicio Z24, Texto del telón Z46, Destello de cortina F1, Entrada tras el telón Z59
- **Paneles y proyectos**: Paneles SILLAS P1, Órbitas Z7 — paneles SILLAS, Linterna Z2 — paneles SILLAS, Acercamiento Z8, Prioridad Z10 — proyecto abierto sobre las órbitas, Video — etapa 1 (reproductor aparte), Foco Z19 — subpanel agrandado, Subpaneles Z4 — HISTORIA / GALERÍA / FICHA
- **Narrativa y checkpoints**: Checkpoints Z40, Efectos del diálogo Z29, Camino LUZ Z28, Diálogo Z27 (terminal)
- **Cielo y ciclo del día**: Ciclo de día Z48, Cielo estrellado Z30, U9 — Secuencia amanecer, Amanecer Z38, W3 — Amanecer DomeSky
- **Rendimiento**: Rendimiento Z66, Post-proceso R4
- **Otros**: Debug overlays
- **Camino TARIMA (atriles)**: Stars, Dome, Sector effects, Lecterns, Retro atriles, Face capture, Audio (T7 — read-only live), Extra lights

**A "Avanzado"** (plegadas por defecto, sin borrar nada): Legado, Prism (info), U9 y W3 (amanecer viejo), AA1, T2,
U4 (×4), U5, U7, U10A (panorama SVG), W1, W5 y X2 (shader del domo y diagnóstico).

**Candidatas a retirar más adelante** (no se retiran): Legado; las secciones del panorama SVG si el flag del panorama
queda apagado definitivamente; U9 y W3 cuando se borren las máquinas viejas del amanecer; Prism (info);
`prismRangeScale`.
