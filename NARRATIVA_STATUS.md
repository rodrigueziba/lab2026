# NARRATIVA_STATUS.md — Auditoría M1: SILLAS path
Rama: `sillas-narrativa` · 2026-10-30 · Solo lectura, sin cambios de código.

Leyenda: **IMPLEMENTADO** · **PARCIAL** · **AUSENTE**

---

## Antes del camino

### 1. Telón rojo WebGL con física, iluminado, que se puede atravesar
**AUSENTE**
No existe ninguna referencia a telón, curtain ni cortina en el código. La escena arranca directamente con el escenario vacío y PointerLockControls activos.
→ Contradice la narrativa: no hay preludio teatral.

### 2. Estado de exploración libre y elección entre caminos (sillas / tarima)
**IMPLEMENTADO**
`ThreeScene.tsx` · `useFrame` · ~líneas 230–240
`ZONA_SILLAS = new THREE.Vector3(0, 1.6, -6)` (z = −6, a 1 m más lejos que antes, G2).
Cuando `cam.position.distanceTo(ZONA_TARIMA) < 2.5` → `alight:chose-light`; cuando `distanceTo(ZONA_SILLAS) < 2.5` → `alight:chose-chairs`.
Cada evento setea `pathRef.current` y controla qué componentes se montan (`{path !== "tarima" && <Prism />}`, etc.).

---

## Secuencia de las sillas

### 3. Se bloquea el movimiento del usuario
**AUSENTE**
Al recibir `alight:chose-chairs` se setea `seated.current = true` y `pathRef.current = "sillas"`, pero no hay bloqueo de PointerLockControls ni de las teclas WASD/flechas en ninguna rama del código revisado.
→ Requerido para que el ítem 8 ("sala activa") tenga sentido.

### 4. Baja el prisma
**IMPLEMENTADO**
`Prism.tsx` · `PRISM_Y_START = 22`, `PRISM_Y_END = TARIMA_H + PRISM_CONE_HALF + PRISM_LAND_OFFSET`
Descenso animado en `useFrame` a `DESCEND_DUR = 5.5 s`. Al llegar, despacha `alight:prism-landed`.
El descenso inicia cuando `alight:chose-chairs` se recibe (Prism escucha el evento).

### 5. Se cargan paneles con proyectos de la plataforma
**IMPLEMENTADO**
`ExperienceDome.tsx` · `buildOrbits()` · máx. 60 paneles · 9 anillos orbitales
Fetch a `${API_URL}/proyecto` y `/prestador`. Layouts calculados con `Math.random()` → disposición única por carga.
En `alight:prism-landed`: stagger-reveal de paneles, `alight:dome-revealed` después de 9 800 ms.

### 6. Aparecen haces de luz de colores
**IMPLEMENTADO**
`ExperienceDome.tsx` · panel shader + dome shell shader
7 haces rainbow parten desde el prisma, mapeados radialmente sobre cada panel OrbitRing y sobre la capa interior del domo. Controlado por `DBG_SILLAS.vizIntensity`, `vizRings`, etc.

### 7. Se iluminan los paneles que rodean al usuario
**IMPLEMENTADO**
`ExperienceDome.tsx` · `OrbitRing` · `activatedRef`
Los paneles parten invisibles y hacen stagger-reveal (demora escalonada por anillo) a partir de `alight:prism-landed`. El evento `alight:dome-revealed` se despacha tras 9 800 ms.

### 8. A los 5 s se libera el movimiento · estado «sala activa»
**AUSENTE**
El evento `alight:dome-revealed` llega a los ≈ 9 800 ms (no 5 s). No existe ningún listener de ese evento que libere restricción de movimiento, ni un estado llamado "sala activa" o equivalente en `alightStore.ts` ni en `ThreeScene.tsx`.
→ Contradice la narrativa: sin bloqueo previo (ítem 3) la liberación no tiene efecto. El tiempo además difiere.

---

## Prisma

### 9. Cambio gradual de apariencia según distancia
**IMPLEMENTADO**
`Prism.tsx` · `DBG_PRISM`
- Efectos inician a `nearM = 2.25 m` (antes 1.5 m; escala ×1.5 desde H1.2).
- Threshold de brillo (glow) a `closeM = 1.5 m`.
- Efecto máximo a `maxEffectM = 0.3 m`.
- Traslucidez: rampa desde opaco a `translucentOpacity = 0.35` en `translucentMs = 3 000 ms`.
- Fractal: shader Julia set (48 iteraciones, `uProximity`, `uTime`) sobre cono de proximidad.
- Giro: velocidad × `1 + proximity² × spinAccel` (spinAccel = 8, spinDir = −1 / CCW).

### 10. Cartel de interacción y tecla E
**IMPLEMENTADO**
`ThreeScene.tsx` · líneas ~248–262
Prompt aparece cuando `horizDist ≤ DBG_SILLAS.prismInteractM = 1.5 m`.
Tecla E: si `pathRef === "sillas"` y prisma aterrizó y visualizador no activo → despacha `alight:visualizer-activate` (activa DomeVisualizer + FloorVisualizer + SectorAudioFX). Texto exacto del cartel: depende del HUD/overlay de ThreeScene (no se auditó el string literal aquí).

### 11. Qué pasa al tocar o atravesar el prisma
**IMPLEMENTADO**
`ThreeScene.tsx` · línea ~255
Auto-activación cuando `horizDist ≤ DBG_SILLAS.prismTouchM = 0.75 m`.
Despacha `alight:visualizer-activate` (mismo efecto que E). No hay animación especial de "atravesar".

---

## Domo y visualizador de música

### 12. Domo con visualizador al interactuar con el prisma
**PARCIAL**
`DomeVisualizer.tsx` (F2/G1): el shader de `/login` se renderiza offline en un `WebGLRenderTarget` (`vizTexSize = 2 048 px`) y se proyecta sobre una esfera exterior de `DOME_R × 1.15 = ~32 m`, BackSide, con UV polar cenital.
`ExperienceDome.tsx`: dome shell = `sphereGeometry args=[DOME_R+2, 48, 32, 0, π×2, 0, π×0.52]` → `thetaLength = 0.52π` deja una abertura inferior (`y ≈ −2 m`). El domo **no es completamente cerrado** (la apertura queda por debajo del suelo, invisible al jugador en condiciones normales, pero existe geométricamente).
Activación: en `ExperienceDome` al recibir `alight:visualizer-activate`.

### 13. División del escenario en 4 partes iguales (getSectorInfo)
**IMPLEMENTADO**
`lib/floorSectors.ts` · `getSectorInfo(x, z)`
Cruz de cuadrantes con radio interno `DBG_FLOOR.innerR = 2.6 m` y externo `outerR = 27.5 m`.
S0 = (+x, −z) / S1 = (+x, +z) / S2 = (−x, +z) / S3 = (−x, −z). Sector −1 dentro del radio interno.
Rotación ajustable con `DBG_FLOOR.rotationDeg = 0`.

### 14. Un haz de luz leve por cada parte
**AUSENTE**
No existe ningún SpotLight, PointLight ni beam geometry por sector en `FloorVisualizer.tsx`, `SectorAudioFX.tsx` ni `ThreeScene.tsx`. Los 7 haces rainbow del domo son globales, no por sector.

### 15. Símbolos en el piso bajo cada haz (círculo, triángulo, malla de puntos, líneas onduladas), área 1 m de radio
**PARCIAL**
`FloorVisualizer.tsx` (H2): 4 sectores con texturas de ruido procedural dinámicas (`N_TYPES = 4`). Los tipos son patrones de noise (no los símbolos literales circulo/triángulo/malla/ondas de la narrativa). No hay radio de 1 m; la textura cubre el sector completo. Las constantes `DBG_FLOOR.s0Type..s3Type` fuerzan el tipo por sector (−1 = auto).
→ La narrativa pide símbolos icónicos fijos; el código tiene patrones de ruido animados.

### 16. Música en 4 bandas del espectro asignadas aleatoriamente a símbolos en cada carga
**PARCIAL**
`SectorAudioFX.tsx` (H3): efectos por sector, pero **no** es asignación de bandas espectrales a símbolos.
- S0: filtro pasa-bajos (`lpEnd = 300 Hz`)
- S1: filtro pasa-altos (`hpEnd = 3 000 Hz`)
- S2: velocidad de reproducción (`rateEnd = 1.75×`)
- S3: eco + reverb (`echoFbEnd = 0.55`, `echoMixEnd = 0.70`, `reverbMixEnd = 0.70`)
La asignación es **fija por sector** (no aleatoria). No existe ruteo de bandas espectrales a símbolos visuales.

### 17. Silencio sin haz · música inicia al tocar el primero · banda sube/baja con presencia
**PARCIAL**
`SectorAudioFX.tsx`: aplica efectos de procesado al llegar a un sector. No hay silencio en sector −1 (zona interna / fuera de sectores). La música empieza con el visualizador, no al tocar el primer símbolo. No hay lógica de "banda se activa/desactiva según presencia bajo el haz".

### 18. Animación del símbolo activa hasta cerrar la experiencia
**PARCIAL**
`FloorVisualizer.tsx`: texturas de noise animadas continuamente mientras el componente esté montado (es decir, mientras `vizActive = true`). No existe un estado de "símbolo activado" por interacción; la animación siempre corre en todos los sectores a la vez.

---

## Monolitos y sesión remota

### 19. Dos monolitos negros a 3 m de la tarima, uno a cada lado
**AUSENTE**

### 20. Fade progresivo al acercarse a cada monolito
**AUSENTE**

### 21. Reemplazo de sonido (dcho.) e imagen del domo (izq.) por los de tarima
**AUSENTE**

### 22. Ojo gigante intermitente en el domo del usuario de tarima
**AUSENTE**

### 23. Sesión remota / transmisión entre usuarios (LiveKit, WebRTC, WebSocket u otro)
**AUSENTE**
No existe ningún cliente WebSocket, WebRTC, LiveKit ni SignalR en el codebase revisado.

### 24. Esfera tipo sol en una parte del domo
**AUSENTE**

### 25. Interferencia de ruido blanco (sonido) y TV sin señal (visualizador)
**AUSENTE**

---

## Suelo y música actuales

### 26. Texturas dinámicas del suelo en 4 sectores
**IMPLEMENTADO**
Archivo: `frontend/components/FloorVisualizer.tsx` (H2)
Componente: `<FloorVisualizer />` montado por `ExperienceDome` cuando `vizActive = true`.
Para desactivar: despachar `alight:visualizer-deactivate` (unmount del componente en ExperienceDome) o setear `DBG_FLOOR.opacity = 0` para hacerlo invisible sin desmontarlo.

### 27. Efectos de sonido por sector
**IMPLEMENTADO**
Archivo: `frontend/components/SectorAudioFX.tsx` (H3) · usa `applyEffects` / `resetEffects` de `lib/vizAudio.ts`
Efectos: S0 = LP a 300 Hz · S1 = HP a 3 000 Hz · S2 = rate × 1.75 · S3 = eco fb 0.55 / mix 0.70 + reverb 0.70
Para desactivar: `alight:visualizer-deactivate` (unmount) o `DBG_EFFECTS.simEnabled = true` con sector fuera de rango.

### 28. Música actual: fuente, pista inicial, lista, orden y momento de inicio
**IMPLEMENTADO**
Archivo: `frontend/lib/vizAudio.ts` (G2) · `startVizAudio()`
- Fuente: `GET /api/music-list` → `{ files: string[] }` (archivos .mp3 en el servidor)
- Pista inicial: si la playlist está vacía → `DBG_SILLAS.vizTrackUrl = '/music.mp3'` como fallback
- Lista: se shufflea con Fisher-Yates al cargar; `_recentUrls` evita repetir las últimas pistas
- Orden: aleatorio por shuffle, sin repetir recientes (`pickNextTrack()`)
- Inicio: cuando se despacha `alight:visualizer-activate` (tecla E o toque del prisma a ≤ 0.75 m). La llamada a `startVizAudio()` ocurre en el keydown handler de ThreeScene para preservar el contexto de gesto del usuario.

---

## Resumen

| Estado | Cantidad | Ítems |
|---|---|---|
| **IMPLEMENTADO** | 12 | 2, 4, 5, 6, 7, 9, 10, 11, 13, 26, 27, 28 |
| **PARCIAL** | 5 | 8, 12, 15, 16, 17, 18 |
| **AUSENTE** | 11 | 1, 3, 14, 19, 20, 21, 22, 23, 24, 25 |

**Total: 28 ítems**

---

## Contradicciones entre lo implementado y la narrativa nueva

1. **Telón ausente (ítem 1)**: La experiencia empieza sin introducción teatral. El usuario entra directamente al espacio y puede moverse. La narrativa pide una cortina roja que se atraviesa como umbral.

2. **Prisma baja sin bloquear al usuario (ítems 3 + 4)**: El usuario puede caminar mientras el prisma desciende. La narrativa implica que la bajada es un momento contemplativo con movimiento suspendido.

3. **No hay "sala activa" ni liberación (ítem 8)**: No existe estado nominal de "sala activa". `alight:dome-revealed` se dispara pero nadie lo escucha para liberar restricciones. El tiempo tampoco coincide: 9 800 ms vs. 5 s.

4. **Los símbolos del suelo no son los simbolos narrativos (ítem 15)**: La narrativa pide círculo, triángulo, malla de puntos y líneas onduladas como íconos semánticos. El código tiene 4 tipos de texturas de ruido procedural animado — visualmente distintos pero sin significado icónico fijo.

5. **No hay haces de luz por sector (ítem 14)**: Los 7 haces rainbow del domo son globales y parten del prisma; no hay uno por cuadrante de `getSectorInfo`. Esto rompe la relación visual símbolo–haz–sector de los ítems 14-18.

6. **La música no está particionada en bandas por sector (ítem 16)**: SectorAudioFX aplica filtros/efectos de procesado (no es lo mismo que aislar y reproducir solo una banda espectral). La asignación es fija, no aleatoria por carga.

7. **Monolitos y sesión remota completamente ausentes (ítems 19–25)**: Este bloque entero (7 ítems) no tiene ninguna base en el código. Representa la capa de conectividad entre los dos caminos (sillas/tarima) y actualmente los caminos son completamente independientes y sin comunicación.
