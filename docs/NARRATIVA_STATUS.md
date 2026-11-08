# NARRATIVA_STATUS.md — Auditoría: camino SILLAS, monolitos y sesión remota
**2026-11-08** · Rama: `sillas-narrativa` (HEAD `4975825` + cambios sin commitear F3/P1) · Solo lectura, sin cambios de código.

Leyenda: **IMPLEMENTADO** · **PARCIAL** · **AUSENTE**
Rutas relativas a `frontend/`. Las líneas corresponden al estado actual del árbol de trabajo.

---

## Resumen

| Estado | Cantidad | Ítems |
|---|---|---|
| **IMPLEMENTADO** | 22 | 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 19, 20, 21, 25, 28 |
| **PARCIAL** | 5 | 18, 22, 24, 26, 27 |
| **AUSENTE** | 1 | 23 |

**Total: 28 ítems**

---

## Antes del camino

### 1. Telón rojo WebGL con física, iluminado, que se puede atravesar
**IMPLEMENTADO**
`components/Curtain.tsx:268` — tela PBD 48×32 con viento, gravedad y colisión con cápsula del jugador; `<spotLight>` propio (`DBG_SILLAS.curtainLightIntensity = 2400`).
Cruce del plano + 0,25 m → `alight:curtain-passed` (`Curtain.tsx:404`). Montado en `components/ThreeScene.tsx:459` mientras `curtainVisible`.
Estado inicial `experienceState = 'cortina'` (`lib/alightStore.ts`, `INTERACT_STATE`).

### 2. Destello enceguecedor al atravesar el telón
**IMPLEMENTADO**
- Máquina de estados: `lib/curtainFlash.ts:29` (`triggerCurtainFlash`, una vez por sesión) y `:60` (`tickCurtainFlash`). Fases subida 150 ms → sostenido 1800 ms → bajada ease-out 2000 ms.
- Condición de seguridad: la bajada espera luz del telón = 0, tela oculta y `<Curtain />` desmontado (`curtainFlash.ts:55`), con tope de 4 s y aviso en consola.
- Luz del telón a 0 en 600 ms desde el disparo y desmontaje detrás del blanco: `Curtain.tsx:388`, `:430`.
- Diegético: el blanco se mezcla dentro del pase CRT (`lib/retro/retroCRT.ts:80`); scanlines, viñeta y tope de luminancia escalados con `uFlash`. Bloom ×5 y exposición ×3 en el pico (`components/RetroPostFX.tsx`).
- Accesibilidad: reduced-motion (pico 60 %, subida 400 ms). Overlay HTML anterior detrás de `FLASH_OVERLAY_DOM` (`components/CurtainFlash.tsx`).

### 3. Exploración libre y elección entre caminos (sillas / tarima)
**IMPLEMENTADO**
`ThreeScene.tsx:246` (`curtain-passed` → `'exploracion'`) y `:368-376`: elecciones bloqueadas durante `'cortina'`; a < 2,5 m de `ZONA_LUZ` → `alight:chose-light`, de `ZONA_SILLAS` → `alight:chose-chairs` + `activar-prisma`.

---

## Secuencia de las sillas

### 4. Se bloquea el movimiento del usuario
**IMPLEMENTADO**
`ThreeScene.tsx:199-205`: `chose-chairs` → `movementLocked = true`, `experienceState = 'sillas_secuencia'`. `:346`: el movimiento WASD se corta mientras `movementLocked` (la mirada sigue libre).

### 5. Baja el prisma
**IMPLEMENTADO**
`components/Prism.tsx:118` (escucha `activar-prisma`), `:131` descenso de 22 m en `DESCEND_DUR = 5.5 s` con ease-out cúbico, `:160` → `alight:prism-landed`.

### 6. Paneles con proyectos de la plataforma, con aparición y desaparición automática
**IMPLEMENTADO** *(P1, sin commitear)*
- Datos: `components/ExperienceDome.tsx` — fetch `/proyecto` y `/prestador`, hasta 60 paneles en 9 anillos orbitantes.
- Visibilidad derivada de un único estado: `lib/alightStore.ts:180` (`panelesSillasVisibles()`: camino SILLAS ∧ prisma bajó ∧ sin interacción ∧ `sillas_secuencia | sala_activa`). Listeners en `:216`, instalados en `ExperienceDome.tsx:473`.
- Aparecen con `alight:prism-landed`, desaparecen con `alight:visualizer-activate` (E o toque del prisma); fade de 600 ms por escala.
- Ocultos: grupo `visible=false` (`ExperienceDome.tsx:549`) y `useFrame` de anillos y paneles en corte inmediato. Precompilación del shader (`:509`) y subida de texturas a GPU al cargar.
- Debug: `PANELES_AUTO`, `PANELES_FADE_IN_MS`, `PANELES_FADE_OUT_MS`, "Forzar paneles SILLAS".

### 7. Aparecen haces de luz de colores y se iluminan los paneles
**IMPLEMENTADO**
`ExperienceDome.tsx:196` — 7 haces rainbow desde el prisma en el shader de cada panel y de la capa del domo; revelado escalonado (120 ms por panel) desde `prism-landed`. `PRISM_RAINBOW_UNIFORM` sube solo con el prisma aterrizado (`Prism.tsx`).

### 8. Se libera el movimiento · estado «sala activa»
**IMPLEMENTADO**
`ExperienceDome.tsx:448` → `alight:dome-revealed` a los 9 800 ms de `prism-landed`; `ThreeScene.tsx:209-218` libera el movimiento `releaseDelayMs = 5000` ms después y pasa a `'sala_activa'` (`alight:sala-activa`). Total ≈ 14,8 s desde que aterriza el prisma.

---

## Prisma

### 9. Cambio gradual de apariencia según distancia
**IMPLEMENTADO**
`Prism.tsx:145-185` · `DBG_PRISM`: efectos desde `nearM = 5.0 m`, glow a `closeM = 3.33 m`, máximo a `maxEffectM = 0.3 m`; traslucidez a 0,35 en 3 000 ms; giro × (1 + proximidad² × 8), sentido antihorario.

### 10. Cartel de interacción y tecla E
**IMPLEMENTADO**
`ThreeScene.tsx:386` (cerca si distancia horizontal ≤ `prismInteractM = 5.0 m`), `:494` cartel "Apretar E para interactuar" solo en `'sala_activa'`; `:290-295` E → `prepareVizAudio()` + `activateVisualizerOnce()` (`alightStore.ts:64`) → `alight:visualizer-activate`.

### 11. Qué pasa al tocar o atravesar el prisma
**IMPLEMENTADO**
`ThreeScene.tsx:394-397`: a ≤ `prismTouchM = 0.75 m` en `'sala_activa'` activa el visualizador (mismo efecto que E). Sin animación propia de "atravesar".

---

## Domo, haces y bandas

### 12. Domo con shader de portal en la superficie interior
**IMPLEMENTADO**
`ExperienceDome.tsx:488-494`: con `vizActive ∧ domoShaderEnMalla ∧ !domoOriginal` el material de `app/alight/dome/DomeSky.tsx` se aplica a la malla del domo. Grupos SOL, MONTAÑAS, CIELO y LÍNEAS (`app/alight/dome/domeShaders.ts:52`). Domo original recuperable con `domoOriginal`.

### 13. Amanecer al pasar por el primer haz
**IMPLEMENTADO**
`components/DomeVisualizer.tsx:490-502`: el primer `getHazBandOn(i)` dispara `startDomeDawn`; fase 1 de `domeAmanecerDurS = 10 s`, después `alight:dome-dawn-complete`.

### 14. Esfera tipo sol en una parte del domo
**IMPLEMENTADO**
`lib/vizSunState.ts:3-4`: azimut aleatorio por sesión, elevación de 8° a 20°; grupo SOL en DomeSky (`domeShaders.ts:52-62`).

### 15. Un haz de luz por cada parte del escenario
**IMPLEMENTADO**
`components/HazSystem.tsx:2` — 4 spotlights con conos aditivos, uno por diagonal de sector, carcasa retro; posiciones en `lib/haz.ts:19` (`hazRadiusM = 15 m`).

### 16. Símbolos en el piso bajo cada haz, radio 1 m
**IMPLEMENTADO**
`components/SymbolSystem.tsx:4`: S0 dos anillos (círculo), S1 triángulo, S2 malla de puntos 7×7, S3 tres anillos ondulados; `symbolRadiusM = 1.0`.

### 17. Música en 4 bandas asignadas aleatoriamente a los símbolos en cada carga
**IMPLEMENTADO**
`lib/vizAudio.ts:331` (`_bandAssignment = shuffleArray([0,1,2,3])`), compuertas por banda en `:528` (`openGate`/`closeGate`).

### 18. Silencio sin haz · la música arranca con el primero · cada banda sube y baja según la presencia
**PARCIAL**
- Silencio inicial y arranque con el primer haz: todas las compuertas nacen cerradas (`vizAudio.ts:286`); `HazSystem.tsx:100-117` llama a `startVizAudio()` en el primer encendido.
- Diferencia: la banda **no** sigue la presencia. `lib/haz.ts:2,74` usa conmutación (al entrar se prende o se apaga, al salir no pasa nada).

### 19. Animación del símbolo activa hasta cerrar la experiencia
**IMPLEMENTADO**
`SymbolSystem.tsx:130`: revelado al primer ingreso (`getHazEnteredOnce`) y animación continua mientras el visualizador está montado.

---

## Monolitos y sesión remota

### 20. Dos monolitos de obsidiana, uno a cada lado de la tarima
**IMPLEMENTADO**
`components/Monoliths.tsx:18` (shader de obsidiana: borde fresnel, desaturación, vetas), geometría de obelisco torcido, placa "AUSTRAL ELECTRIC / KX-07M". Montados con `vizActive` (`ExperienceDome.tsx:525`), a `monolithDistM = 3.75 m` del centro, con aparición de 1 500 ms.

### 21. Efecto progresivo al acercarse a cada monolito
**IMPLEMENTADO**
`Monoliths.tsx:539-547`: proximidad lineal de 3,0 m a 0,5 m por monolito → `setMonolithProximity()`.

### 22. Monolito derecho: reemplaza el sonido por el de la tarima
**PARCIAL**
`vizAudio.ts:567-568`: la música baja hasta un 85 % y sube el ruido blanco. No hay audio de la tarima: `SESSION.getAudio()` devuelve `null` (`lib/remoteSession.ts:21`).

### 23. Monolito izquierdo: reemplaza la imagen del domo por la de la tarima
**AUSENTE**
`DomeVisualizer.tsx:773` escribe `uRemoteMix`, pero ningún shader lo usa (solo se declara en `:269` y `:334`) y no existe textura remota (`SESSION.getImage()` devuelve `null`).

### 24. Estática de TV (visualizador sin señal)
**PARCIAL**
- Pantallas de los monolitos: estática ámbar con scanlines (`Monoliths.tsx:317`). Funciona.
- En el domo: la mezcla de estática (`DomeVisualizer.tsx:315`) vive en `PANORAMA_FRAG`, cuyo `uFade` se fuerza a 0 cuando DomeSky está activo (`:766`, valor por defecto). Con la configuración actual no se ve.

### 25. Interferencia de ruido blanco (sonido)
**IMPLEMENTADO**
`vizAudio.ts:568`: ganancia de ruido = proximidad al monolito derecho × `noiseGain = 0.5`.

### 26. Sesión remota / transmisión entre usuarios
**PARCIAL** *(solo la interfaz)*
`lib/remoteSession.ts`: interfaz `RemoteSession`, `MockRemoteSession` (`:21`, siempre inactiva), esqueleto `LiveKitRemoteSession` (`:32`, sin SDK instalado). `SESSION` es el mock (`:52`). No hay transporte, señalización ni medios.

### 27. Ojo gigante intermitente en el domo del usuario de tarima
**PARCIAL**
`components/WatcherEye.tsx:2`: disco procedural con parpadeo, visible 3 s cada 10 s si hay espectadores remotos (`:105`). Depende de `SESSION.onWatchers` (`:93`); con el mock nunca hay espectadores, así que en la práctica no aparece. Solo existe el flag `watcherEyeEnabled`, sin forzado de debug.

### 28. Música: fuente, lista y orden
**IMPLEMENTADO**
`vizAudio.ts:214`: `GET /api/music-list`, mezcla Fisher-Yates y sin repetir pistas recientes; respaldo `/music.mp3`.

---

## Legado desactivado (no cuenta en el resumen)
- `components/FloorVisualizer.tsx` (texturas de ruido por sector) y `components/SectorAudioFX.tsx` (LP/HP/velocidad/eco por sector): apagados por `LEGACY_FLOOR_TEXTURES_ENABLED` y `LEGACY_SECTOR_AUDIO_ENABLED` (`ExperienceDome.tsx:20-21`). Los reemplazan los ítems 15-19.

---

## Pendiente (ordenado por importancia)

1. **Sesión remota real (26)**: transporte (LiveKit u otro), presencia y medios. Bloquea los ítems 22, 23 y 27; sin esto, los dos caminos no se comunican.
2. **Imagen de la tarima en el domo con el monolito izquierdo (23)**: textura remota + uso de `uRemoteMix` en el shader activo (DomeSky).
3. **Estática de TV en el domo (24)**: llevar la estática al shader de DomeSky o dejar de forzar `uFade = 0` en `PANORAMA_FRAG`; hoy la interferencia del monolito izquierdo no se ve.
4. **Sonido de la tarima con el monolito derecho (22)**: conectar `SESSION.getAudio()` en lugar de solo bajar la música y subir el ruido.
5. **Ojo gigante (27)**: depende del ítem 1; mientras tanto, falta un forzado de debug para poder probarlo.
6. **Bandas según presencia (18)**: decidir si la conmutación (R3) reemplaza a la narrativa o si se vuelve a "sube al entrar, baja al salir".
7. **Commit de F3 y P1**: los ítems 2 (intensidad y duración nuevas) y 6 están en el árbol de trabajo sin commitear.

---

## Contradicciones con la narrativa

1. **Conmutación en lugar de presencia (18)**: la narrativa dice que la banda sube y baja según si el usuario está bajo el haz; el código la prende o la apaga al entrar (`haz.ts:2`). Salir del haz no cambia nada.
2. **El monolito izquierdo no afecta lo que se ve (23, 24)**: su proximidad mueve `uRemoteMix` y `uStaticMix`, pero ninguno de los dos llega a la pantalla con DomeSky activo. El usuario no recibe respuesta visual en el domo.
3. **Distancia de los monolitos (20)**: la narrativa pide 3 m de la tarima; el código usa 3,75 m del centro (`monolitoDistFactor = 1.25`), unos 1,5 m del borde de la tarima.
4. **Liberación más tardía (8)**: el movimiento se libera unos 14,8 s después de que aterriza el prisma (9,8 s de revelado + 5 s), no a los 5 s.
5. **Dos máquinas de amanecer (13)**: `HazSystem.tsx:105,245` (U9, panorama) y `DomeVisualizer.tsx:493` (W3, domo) se disparan con el mismo primer haz y tienen duraciones independientes (`amanecerDurS` y `domeAmanecerDurS`, ambas 10 s). Hoy coinciden, pero se pueden desincronizar.
6. **Ojo sin espectadores posibles (27)**: el componente está montado en el camino tarima, pero con el mock nunca se muestra; la narrativa lo presenta como presencia visible de la audiencia.
