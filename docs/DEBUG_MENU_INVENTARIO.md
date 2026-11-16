# Inventario del menú de debug

Organización actual (Z73), generada con `node scripts/debug-menu-organizacion.mjs` el 2026-11-16. Datos completos en
`docs/debug-menu-inventario.json`: `organizacion` (esta foto) y `secciones` (la base de Z70: el `DebugMenu.tsx` monolítico del
commit `9470cea`, con la firma de cada control; la usa `scripts/debug-menu-test.mjs` para verificar que no se perdió ninguno).

## a) Tamaño

| | Antes (Z69) | Ahora |
|---|---|---|
| Código del menú | `DebugMenu.tsx`: 3580 líneas | 20 archivos, 4703 líneas (`DebugMenu.tsx` 157) |
| `lib/debugConfig.ts` | 1365 líneas | 1394 líneas |
| Secciones | 77 | 64 (las fusionadas cuentan como una) |
| Controles en secciones | 687 | 700 (ninguno perdido; los agregados son de Z71 a Z73) |
| Pestañas | 2 (SILLAS, TARIMA) | 17: Recientes, Favoritos, Rendimiento, Telón y entrada, Flor, prisma y tarima, Cielo y ciclo del día, Pasto y monolitos, Composición (portal y fluido), Sol y ondas, Luces y haces, Sala y movimiento, Narrativa y checkpoints, Paneles y proyectos, Visualizador y música, Camino TARIMA (atriles), Otros, Obsoletos |

Controles por tipo: numéricos 474 · interruptores 111 · botones 67 · sliders 24 · color 18 · selectores 4 · campos 1 · panel de rendimiento 1.

## b) Secciones por pestaña

Orden real: Recientes (las de los últimos 5 Z distintos), Favoritos (las fijadas con ☆), el resto por la última modificación de
sus secciones, y Obsoletos al final. Dentro de cada pestaña, por `ultimoZ` de mayor a menor.

### Rendimiento

| Sección | Controles | Origen | Última | Clase | Partes |
|---|---|---|---|---|---|
| Rendimiento Z66 | 1 | Z66 | Z72 | ocasional |  |
| Post-proceso R4 | 17 | pre-Z | pre-Z | frecuente |  |

### Telón y entrada

| Sección | Controles | Origen | Última | Clase | Partes |
|---|---|---|---|---|---|
| Texto del telón Z46 | 6 | Z46 | Z71 | frecuente |  |
| Entrada tras el telón Z59 | 5 | Z59 | Z65 | frecuente |  |
| Inicio Z24 | 2 | Z24 | Z25 | tecnica |  |
| Destello de cortina F1 | 39 | Z1 | Z1 | frecuente |  |
| Telón N6 | 7 | pre-Z | pre-Z | frecuente |  |

### Flor, prisma y tarima

| Sección | Controles | Origen | Última | Clase | Partes |
|---|---|---|---|---|---|
| Base de la flor Z67 | 5 | Z67 | Z67 | frecuente |  |
| Prisma y flor Z54 | 6 | Z54 | Z62 | frecuente |  |
| Fractal del prisma Z43 | 3 | Z43 | Z45 | frecuente |  |
| Prism proximity | 7 | pre-Z | pre-Z | tecnica |  |

### Cielo y ciclo del día

| Sección | Controles | Origen | Última | Clase | Partes |
|---|---|---|---|---|---|
| Control del día | 10 | Z73 | Z67 | ocasional |  |
| Ciclo de día Z48 | 5 | Z48 | Z55 | frecuente |  |
| Amanecer Z38 | 5 | Z38 | Z38 | tecnica |  |
| Cielo estrellado Z30 | 27 | Z30 | Z33 | frecuente |  |

### Pasto y monolitos

| Sección | Controles | Origen | Última | Clase | Partes |
|---|---|---|---|---|---|
| Pasto Z64 | 7 | Z64 | Z65 | frecuente |  |
| Monolitos N5 V1/V2/V3 | 25 | pre-Z | pre-Z | frecuente |  |

### Composición (portal y fluido)

| Sección | Controles | Origen | Última | Clase | Partes |
|---|---|---|---|---|---|
| Fluir de color Z61 | 7 | Z61 | Z65 | frecuente |  |
| Composición del domo Z49 | 5 | Z49 | Z57 | frecuente |  |
| Dome visualizer | 25 | Z2 | Z2 | tecnica |  |
| Shader del domo | 23 | pre-Z | Z1 | tecnica · plegada | W1 — Domo de shader · W2 — Multiplicadores de grupo · W4 — DomeSky ajuste de shader · W5 — Siluetas suaves · X2 Domo diagnóstico |

### Sol y ondas

| Sección | Controles | Origen | Última | Clase | Partes |
|---|---|---|---|---|---|
| Ondas por kick Z52 | 6 | Z52 | Z58 | frecuente |  |
| Sol del cielo (Z51) | 2 | Z51 | Z57 | frecuente |  |
| Sol de la sala (N3) | 3 | pre-Z | pre-Z | tecnica |  |

### Luces y haces

| Sección | Controles | Origen | Última | Clase | Partes |
|---|---|---|---|---|---|
| Luces del visualizador Z42 | 3 | Z42 | Z42 | frecuente |  |
| DiagonalSpot | 7 | pre-Z | pre-Z | tecnica |  |
| Haces N3 R2 V1 | 16 | pre-Z | pre-Z | frecuente |  |
| U6A — Anillos en piso | 7 | pre-Z | pre-Z | ocasional |  |
| U6B — Destello del haz | 5 | pre-Z | pre-Z | ocasional |  |

### Sala y movimiento

| Sección | Controles | Origen | Última | Clase | Partes |
|---|---|---|---|---|---|
| Layout Z41 | 3 | Z41 | Z41 | frecuente |  |
| Reloj de la experiencia Z39 | 4 | Z39 | Z39 | tecnica |  |
| Movimiento Z34 | 5 | Z34 | Z34 | frecuente |  |
| Iconos del piso Z23 | 12 | Z23 | Z24 | ocasional |  |
| Secuencia sillas | 4 | pre-Z | pre-Z | ocasional |  |

### Narrativa y checkpoints

| Sección | Controles | Origen | Última | Clase | Partes |
|---|---|---|---|---|---|
| Checkpoints Z40 | 3 | Z40 | Z40 | ocasional |  |
| Efectos del diálogo Z29 | 20 | Z29 | Z40 | ocasional |  |
| Diálogo Z27 (terminal) | 13 | Z27 | Z35 | ocasional |  |
| Camino LUZ Z28 | 33 | Z28 | Z28 | frecuente |  |

### Paneles y proyectos

| Sección | Controles | Origen | Última | Clase | Partes |
|---|---|---|---|---|---|
| Video — etapa 1 (reproductor aparte) | 4 | Z23 | Z23 | ocasional |  |
| Foco Z19 — subpanel agrandado | 25 | Z19 | Z21 | frecuente |  |
| Acercamiento Z8 | 48 | Z8 | Z18 | frecuente |  |
| Paneles SILLAS | 41 | Z1 | Z13 | frecuente | Paneles SILLAS P1 · Órbitas Z7 — paneles SILLAS · Linterna Z2 — paneles SILLAS |
| Subpaneles Z4 — HISTORIA / GALERÍA / FICHA | 22 | Z4 | Z11 | frecuente |  |
| Prioridad Z10 — proyecto abierto sobre las órbitas | 7 | Z10 | Z10 | tecnica |  |

### Visualizador y música

| Sección | Controles | Origen | Última | Clase | Partes |
|---|---|---|---|---|---|
| Símbolos N3 | 3 | pre-Z | pre-Z | tecnica |  |
| Audio bandas N4 | 4 | pre-Z | pre-Z | ocasional |  |
| Reacción T3 — audio | 10 | pre-Z | pre-Z | tecnica |  |
| U10B — Reacción al sonido | 13 | pre-Z | pre-Z | tecnica |  |
| U11 — Camera feedback (haz-toggle) | 11 | pre-Z | pre-Z | tecnica |  |
| U2 — AGC + amplitudes | 12 | pre-Z | pre-Z | tecnica |  |

### Camino TARIMA (atriles)

| Sección | Controles | Origen | Última | Clase | Partes |
|---|---|---|---|---|---|
| Stars | 7 | pre-Z | pre-Z | tecnica |  |
| Dome | 2 | pre-Z | pre-Z | tecnica |  |
| Sector effects | 1 | pre-Z | pre-Z | tecnica |  |
| Lecterns | 22 | pre-Z | pre-Z | frecuente |  |
| Retro atriles | 2 | pre-Z | pre-Z | frecuente |  |
| Face capture | 2 | pre-Z | pre-Z | tecnica |  |
| Audio (T7 — read-only live) | 6 | pre-Z | pre-Z | tecnica |  |
| Extra lights | 2 | pre-Z | pre-Z | tecnica |  |

### Otros

| Sección | Controles | Origen | Última | Clase | Partes |
|---|---|---|---|---|---|
| Overlays del prisma, audio y efectos (R1) | 1 | pre-Z | pre-Z | tecnica |  |

### Obsoletos

| Sección | Controles | Origen | Última | Clase | Partes |
|---|---|---|---|---|---|
| Amanecer viejo | 11 | Z38 | Z38 | obsoleta · plegada · código viejo | U9 — Secuencia amanecer · W3 — Amanecer DomeSky |
| Prism | 1 | pre-Z | pre-Z | obsoleta · plegada · sin efecto hoy |  |
| Legado | 21 | pre-Z | pre-Z | obsoleta · plegada · sin efecto hoy |  |
| Panorama SVG (apagado) | 38 | pre-Z | pre-Z | obsoleta · plegada · código viejo | Panorama T2 — crecimiento de grupos · U4 — SOL · U4 — MONTAÑAS · U4 — CIELO · U4 — LÍNEAS · U5 — LÍNEAS líquidas · U7 — Capas visibles · U10A — Parallax por capa · AA1 — Domo original |
| Controles sin efecto | 1 | pre-Z | pre-Z | obsoleta · plegada · sin efecto hoy |  |

Recientes hoy: Rendimiento Z66, Texto del telón Z46, Control del día, Base de la flor Z67, Pasto Z64, Fluir de color Z61, Entrada tras el telón Z59, Prisma y flor Z54 (Z 72, 71, 67, 65, 62).

## c) Clasificación

- **Frecuente (se retoca al ajustar el aspecto)**: 27.
- **Ocasional (pruebas, simulación, saltos)**: 11: Secuencia sillas, Audio bandas N4, Iconos del piso Z23, Checkpoints Z40, Control del día, Rendimiento Z66, Efectos del diálogo Z29, Diálogo Z27 (terminal), Video — etapa 1 (reproductor aparte), U6A — Anillos en piso, U6B — Destello del haz.
- **Técnica o avanzada**: 21.
- **Obsoleta (en la pestaña Obsoletos)**: 5: Prism, Legado, Panorama SVG (apagado), Amanecer viejo, Controles sin efecto.

## d) Cambios de Z73 y lo que sigue repetido

- **Movidos**: los controles de `DBG_LUZ` del final de "Cielo estrellado Z30" (EXTERIOR_RADIO_M, AREA_HIST_M, ACTIVACION_M,
  ACTIVACION_SALIDA_M, GIRO_MS, PITCH_MAX_DEG, CIERRE_DIALOGO_MS, TELEPORT_DIST_M, LUZ_COLOR) pasaron a "Camino LUZ Z28";
  `prismRangeScale` (sin efecto) pasó de "Prism proximity" a Obsoletos › Controles sin efecto.
- **Renombrados**: "Sol N3" → "Sol de la sala (N3)", "Sol nuevo Z51" → "Sol del cielo (Z51)", "Debug overlays" (R1) →
  "Overlays del prisma, audio y efectos (R1)", "Debug overlays (mode/lock/hover)" de Lecterns → "Overlays de atriles".
- **Fusionados** (cada parte conserva su título como subtítulo): Panorama SVG (apagado), Shader del domo, Amanecer viejo,
  Paneles SILLAS.
- **Control del día** (nuevo): T_MANUAL, VELOCIDAD, ir a una etapa, checkpoints del día y las acciones de la flor, todo en
  `lib/controlDia.ts`. Los botones de "Prisma y flor" y "Base de la flor" quedaron como atajos a esas mismas funciones.
- **Sigue repetido a propósito**: T_MANUAL y VELOCIDAD también están en la lista de "Ciclo de día" (no se quita ningún control);
  VELOCIDAD de "Movimiento" es otro objeto (`DBG_MOV`). Los saltos a checkpoints del día también están en "Checkpoints Z40".
- **Indicadores**: ⟳ en los controles que piden recargar o remontar; los de solo lectura van sin caja, punteados y en gris.

## e) Costo del menú

- Antes de Z70: ~640 controles dibujados de una vez, ~20 renders por segundo con el menú abierto y ~16 actualizaciones de
  estado por segundo con el menú cerrado.
- Desde Z70: solo se dibuja la pestaña activa (o los resultados del buscador); con el menú cerrado no corre ningún intervalo.

## f) Candidatas a borrar más adelante (no se borró nada)

| Candidata | Qué la deja sin efecto | De qué depende |
|---|---|---|
| Legado (FloorVisualizer, SectorAudioFX) | `LEGACY_FLOOR_TEXTURES_ENABLED`, `LEGACY_SECTOR_AUDIO_ENABLED` = false | `components/FloorVisualizer.tsx`, `SectorAudioFX.tsx`, `DBG_FLOOR`, `DBG_EFFECTS`; montaje en `ExperienceDome.tsx` |
| Panorama SVG (T2, U4, U5, U7, U10A, AA1) | `DBG_SILLAS.usarDomoShader` true y `domoOriginal` false | `components/VizPanorama.tsx`, `public/alight/visualizer/*.svg`, campos `viz*` y `u4*`…`u10*` de `DBG_SILLAS`; `domoOriginal` lo vuelve a encender (AA1) |
| Amanecer viejo (U9, W3) | `DBG_AMANECER.UNIFICADO` = true | máquinas viejas de `alightStore` (U9) y de `DomeSky` (W3); con `UNIFICADO` false vuelven. Sus fases 2 y paletas todavía se leen |
| Prism (info) | solo lectura | `DBG_PRISM.landOffset` (se usa en Prism.tsx: no borrar el campo) |
| `prismRangeScale` | legacy N1, ya no se aplica | campo de `DBG_PRISM`; buscar usos antes de quitarlo |
| Reloj de la experiencia: `RELOJ_UNIFICADO` false | camino viejo de tiempos | `lib/relojExperiencia.ts`, `Prism`, `ExperienceDome`, `linternaPaneles`, `ThreeScene` |
| Ciclo de día: `DBG_DIA.NUEVO` false | amanecer de 10 s de Z38 | `lib/cicloDia.ts`, `DomeSky` (uDiaNuevo), `CicloDiaEscena` |
| Cielo estrellado: `ESTRELLAS_MODO_VIEJO`, `ESTRELLAS_MODO_Z30` | modos anteriores del cielo | `components/CieloEstrellado.tsx`, `lib/luz/estrellasCielo.glsl.ts` |
| `MONOLITOS_CAPTURA` (Amanecer Z38) | false por defecto (colores falsos al completar) | captura del reflejo en `Monoliths.tsx` |
| Bloom Unreal (`BLOOM_OPTIMIZADO` false), pases separados (`PASES_FUSIONADOS` false), `ACES_RAPIDO`, `FXAA_LIGERO` | flags de comparación de Z69 y Z72 | `components/RetroPostFX.tsx`, `lib/retro/paseFinal.ts` |

