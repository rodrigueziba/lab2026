# Evaluación: instrumentos propios en el camino TARIMA (Z77)

Fecha: 2026-11-16. Rama `sillas-narrativa`. Documento de evaluación: no se cambió código.
Objetivo: que en la tarima el usuario pueda **crear sonido propio** (caja de ritmos, sintetizador, máquina de bajo tipo TB-303 y sampler) y no solo reproducir mp3 con efectos.

Las cifras de CPU, latencia y peso son **estimaciones**: hay que confirmarlas con el plan de medición (sección f).

---

## Resumen

- **Hoy hay dos motores de audio separados**, cada uno con su propio `AudioContext`:
  - `lib/vizAudio.ts` es el del visualizador de SILLAS: 4 bandas, AGC y kick.
  - `lib/audioEngine.ts` es el de los atriles de TARIMA: cadena de efectos sobre un mp3.

  Dos contextos no se pueden conectar entre sí. Por eso lo primero es **un contexto único con un bus maestro** que alimente el análisis de bandas.
- **El audio de la tarima hoy no alimenta ningún visual.** El analizador de `audioEngine` no tiene consumidores, y las bandas, el kick y las ondas solo existen en SILLAS.
- **Recomendación técnica:** Web Audio nativo con **AudioWorklet** para la 303 y la batería, sin Tone.js. Es el enfoque de `mouth-acid`.
- **Cara:** el proyecto ya usa el mismo modelo de Face Landmarker y ya tiene **los blendshapes activados**. Hay que pasarlo a modo continuo y, para llegar a 30 Hz sin tirones, moverlo a un Web Worker.
- **Costo de un primer producto mínimo** (núcleo, reloj, caja de ritmos, 303 con cara y controles en el atril): **unos 7 prompts**, 2 de ellos grandes. Los cuatro instrumentos en su versión mínima suman unos 10.

---

## a) Arquitectura de audio actual

### Motor del visualizador (SILLAS): `lib/vizAudio.ts`
| Pieza | Cómo es hoy |
|---|---|
| Fuente | `new Audio('/music.mp3')` y después la lista de reproducción (`onTrackEnded`) → `createMediaElementSource` |
| Contexto | `new AudioContext()` propio (`_vizCtx`), creado en `_buildChain` |
| Bandas | 4 en paralelo: < 80 Hz, 80–250 Hz (kick), 250 Hz–4 kHz y > 4 kHz. Cada una pasa por 2 biquads en cascada por borde → `AnalyserNode` (fftSize 256) → compuerta (`GainNode`, cerrada) → suma 0,25 |
| Salida | suma → `_musicFadeGain` (fundido por cercanía al monolito) → `_masterGain` → `_vizAnalyser` → altavoces. Ruido blanco en bucle para el monolito derecho |
| Grupos | `BAND_STATE.assignment` reparte las bandas al azar entre SOL, MONTAÑAS, CIELO y LÍNEAS ONDULANTES en cada carga. Los haces abren y cierran las compuertas (`openGate`/`closeGate`) |
| AGC | Por banda: el piso sigue al mínimo y el techo al pico. Se normaliza a 0–1 con exponente (`DBG_SILLAS.agc*`) → `BAND_STATE.normEnergy` |
| Kick | Banda 1: subida de 1,4 × sobre el valor anterior, > 0,05 y 150 ms de refractario → `BAND_STATE.kick` y el evento `alight:kick` (lo usan las ondas de Z52) |
| Lectura | `getVizBands()` por cuadro, solo desde `DomeVisualizer`. Lee `getByteTimeDomainData` y `getByteFrequencyData` |
| Autoplay | `prepareVizAudio()` y `startVizAudio()` se llaman desde el `keydown` (tecla E) para conservar el gesto del usuario y hacer `resume()` |
| Pausa | `pausarVizAudio()` y `reanudarVizAudio()` (camino LUZ, `lib/pausaExperiencia.ts`) |

### Motor de los atriles (TARIMA): `lib/audioEngine.ts`
| Pieza | Cómo es hoy |
|---|---|
| Fuente | `<audio>` + `createMediaElementSource`. Lista de reproducción desde `/api/music` (`LecternSystem.tsx`, al aparecer los atriles) |
| Contexto | **otro** `new AudioContext()` (`ctx`) |
| Cadena | pasa-bajos → pasa-altos → distorsión (seco/húmedo) → phaser (4 pasa-todo y LFO) → pitch granular (2 líneas de retardo) → delay → reverb → master → analizador (fftSize 256) → altavoces |
| "Sampler" actual | `setSamplerLoop` es un `setInterval` de 50 ms que devuelve `currentTime` del `<audio>` al inicio del loop. No es un sampler: tiene un error de unos 50 ms y no se puede tocar |
| Analizador | `getAnalyserData()` existe pero **nadie lo usa**: el audio de la tarima no mueve ningún visual |
| Panel "Audio (T7 — read-only live)" | Solo muestra `STORE.audio` (pista, pausa y valores de los efectos) |
| Sonido de UI | `playUIClick` (oscilador corto directo a la salida) |
| Autoplay | `initAudio()` corre en un `useEffect` cuando aparecen los atriles, **fuera de un gesto**. En Chrome funciona porque la página ya tuvo una interacción; en Safari puede quedar suspendido |
| Pausa | `togglePlayPause()` desde la pausa central |

### Atriles y cámaras
- **Atril SONIDO** (derecha) tiene siete secciones: REPRODUCCIÓN, FILTROS, DISTORSIÓN, LFO, PHASER, PITCH y ESPACIO, más SALIDA. Están documentadas en `docs/LECTERN_CONTROLS.md`.
- **Encuadre de la cámara** de cada atril: `DBG_CAM_SOUND` (fov 60, pitch −45) y `DBG_CAM_IMAGE` (fov 75, pitch −22). `LecternSystem.tsx` tiene más de 2000 líneas, así que los controles nuevos deben ir en componentes propios.
- **Cámara web:** `hooks/useFaceTracking.ts` (lo usa `Audience.tsx`) corre Face Landmarker en el **hilo principal**, con rAF y 12 Hz, delegado **CPU**, `outputFaceBlendshapes: true`. **Se detiene** cuando captura la mejor foto de la cara para el público.

### Latencia y autoplay
- **Salida de audio:** con `latencyHint: "interactive"` (el valor por defecto), `baseLatency` + `outputLatency` suele estar entre 10 y 40 ms según el sistema operativo y la placa. A medir.
- **Cámara → sonido:** cuadro de cámara (~33 ms a 30 fps) + inferencia (~10–25 ms en CPU) + suavizado. Total estimado de 60 a 100 ms. `mouth-acid` lo compensa con un término de anticipo sobre la velocidad.
- **Autoplay:** un `AudioContext` nuevo nace suspendido hasta un gesto. Con un contexto único alcanza con reanudarlo una vez (por ejemplo en el clic del telón o en la tecla E).

---

## b) Arquitectura propuesta

```
                ┌───────────── un solo AudioContext (lib/audio/contexto.ts) ─────────────┐
 mp3 SILLAS ────┤                                                                          │
 mp3 TARIMA ──► cadena de efectos (audioEngine) ──┐                                        │
 caja ritmos ─► canal ─┐                           ├─► BUS MAESTRO ─► análisis (4 bandas,   │
 bajo 303 ───► canal ──┼─► bus instrumentos ──────┘     AGC, kick) ─► limitador ─► salida  │
 sinte ──────► canal ──┤        (envíos: delay / reverb compartidos)                      │
 sampler ────► canal ──┘                                                                   │
                └──────────────────────────────────────────────────────────────────────────┘
 Reloj (lib/audio/reloj.ts): BPM, compás, programador con anticipación ──► eventos con tiempo exacto
 Parámetros (lib/audio/parametros.ts): registro de parámetros nombrados 1–10 ◄── menú, atril, cara, manos, cables
```

- **Un solo `AudioContext`**, compartido, en `lib/audio/contexto.ts`, con `obtenerContexto()` y `reanudarEnGesto()`. `vizAudio` y `audioEngine` lo piden en lugar de crear el suyo, detrás de un flag (`DBG_AUDIO_INSTR.CONTEXTO_UNICO`) para poder volver atrás.
- **Bus maestro con entrada de análisis:** el análisis de 4 bandas de `vizAudio` pasa a leer de un `GainNode` de entrada y no del `<audio>`. Así el visualizador y las ondas reaccionan a lo que toca el usuario. En la tarima hay que llamar a `getVizBands()` (hoy solo lo hace el domo).
- **Reloj compartido:** el patrón clásico de "A Tale of Two Clocks" (Chris Wilson):
  - un temporizador cada 25 ms programa con 100 ms de anticipación usando `ctx.currentTime`, y nunca el reloj de la experiencia;
  - BPM entre 60 y 180, swing, 16 pasos;
  - el sonido no se pausa con `PAUSA` salvo que se decida (ver preguntas).
  - Dentro del worklet de la 303, el paso también se puede contar por muestra, como hace `mouth-acid`.
- **Instrumentos como módulos:**
  - **Interfaz:** `crear(ctx, salida)`, `disparar(paso, tiempo)`, `fijar(param, valor)`, `liberar()`.
  - **Lógica pura** (patrones y mapeos) en `lib/`, testeable en Node como el resto del proyecto.
- **Parámetros nombrados de 1 a 10:**
  - **Registro:** `{ id: "bajo.corte", nombre: "CORTE", rango 1–10, curva lin | exp, unidad, defecto }`. Internamente es 0–1 y se aplica con `setTargetAtTime`, sin saltos.
  - **Fuentes:** cualquier fuente se conecta a cualquier parámetro con una cantidad. Las fuentes pueden ser el menú, una perilla del atril, `cara.jawOpen`, `manos.x` o, en el futuro, el **atril de cables** entre sonido y video (`video.brillo → bajo.corte`).
- **Patrones y sesión:**
  - **Formato:** JSON chico, `{ bpm, pasos: [{ n, acento, slide }], bateria: { kick: "x...x..." } }`.
  - **Guardado:** en `sessionStorage` con try/catch, igual que las visitas de Z76.
  - **Valores de fábrica:** constantes en `debugConfig` (`DBG_INSTR_*`) expuestas en el menú.

---

## c) Instrumentos

Costo en prompts: **chico** (1 prompt, unos pocos archivos), **mediano** (1 prompt, un módulo nuevo con pruebas) y **grande** (2 prompts o uno muy cargado: DSP propio, worklet o interfaz 3D).

### Caja de ritmos
| | |
|---|---|
| Mínimo viable | 4 voces sintetizadas (bombo, caja, hat cerrado y hat abierto) con nodos nativos programados con `start(t)`, 16 pasos, BPM y volumen por voz. Patrones de fábrica |
| Ampliado | Clap, rim y tom. Acento y probabilidad por paso, swing, kits de muestras (sampler), cadena de efectos por voz, cambio de patrón al final del compás |
| Costo | Mínimo: **mediano**. Ampliado: **mediano** |
| Riesgos | Bajos. Muchos nodos efímeros por paso (el recolector de basura de nodos es barato). Con el reloj por anticipación el tempo es estable aunque baje el FPS |
| Depende de | Contexto único y reloj |

### Máquina de bajo (TB-303 acid)
| | |
|---|---|
| Mínimo viable | Una voz monofónica en **AudioWorklet**: diente de sierra o cuadrada con polyBLEP, filtro escalera de 4 polos con resonancia saturada, envolvente, acento y slide de 22 ms, más un secuenciador de 16 pasos (nota, acento, slide, silencio). Parámetros CORTE, RESONANCIA, ENVOLVENTE, DECAIMIENTO, ACENTO y DISTORSIÓN |
| Ampliado | Segundo pico de resonancia (de `mouth-acid`), delay ping-pong en corchea con puntillo, patrones de fábrica (Chicago, Deep, Minimal…), transposición y **control con la cara** |
| Costo | Mínimo: **grande** (DSP propio y worklet). Cara: **mediano** aparte |
| Riesgos | El DSP en JS dentro del worklet tiene que estar libre de allocations. Los worklets se cargan con `addModule(url)`, así que el archivo va en `public/` o empaquetado aparte (con Next y webpack hay que resolverlo). Safari soporta AudioWorklet desde la 14.1 |
| Depende de | Contexto único, reloj (o reloj interno del worklet) y registro de parámetros |

### Sintetizador
| | |
|---|---|
| Mínimo viable | Polifónico de 6 a 8 voces con nodos nativos: 2 osciladores, filtro, envolventes ADSR de amplitud y filtro, y un LFO. Se toca con el teclado de la computadora o con un patrón de acordes |
| Ampliado | Arpegiador, unísono y desafinación, matriz de modulación conectable a cables, presets y wavetable |
| Costo | Mínimo: **mediano**. Ampliado: **grande** |
| Riesgos | Conflicto con WASD: tocar con el teclado requiere un modo que bloquee el movimiento, como los atriles. La CPU es baja con nodos nativos |
| Depende de | Contexto único y parámetros. El reloj solo hace falta para arpegios y patrones |

### Sampler
| | |
|---|---|
| Mínimo viable | 8 pads con `AudioBuffer`: cargar muestras propias o **recortar un fragmento del mp3 actual** (reemplaza el loop por `setInterval`, que hoy tiene un error de 50 ms). Disparo por paso o por tecla, tono y volumen por pad |
| Ampliado | Grabar con el micrófono (permiso nuevo), cortar en rebanadas, envolvente por pad, invertir y kit para la caja de ritmos |
| Costo | Mínimo: **mediano**. Ampliado: **grande** |
| Riesgos | Para decodificar el mp3 hay que hacer `fetch` y `decodeAudioData` de toda la pista: en memoria son unos 50 MB por cada 5 minutos en estéreo a 48 kHz. Las muestras de terceros necesitan licencia (CC0) y su crédito |
| Depende de | Contexto único. Opcionalmente, el reloj |

### Común a todos
- **Controles en el atril de sonido** (3D, estilo cassette futurism): **grande**. Conviene hacer primero una página o panel por instrumento y después llevarla al atril.
- **Filas de benchmark y medición:** **chico**.

---

## d) Referencia: `mouth-acid` (Electro-Dig, MIT)

Leí `README.md`, `face-worker.js`, `worklet.js` y partes de `app.js` desde GitHub. El repositorio se actualizó por última vez el 28-10-2026 y su licencia es MIT, con copyright de Electro-Dig, 2026.

### Qué hace
- **`face-worker.js`:**
  - Face Landmarker corre en un **Worker clásico**.
  - El hilo principal deja **un solo cuadro en vuelo** y siempre manda el más reciente (`createImageBitmap`, transferido).
  - Crea los delegados GPU y CPU, mide cuál es más rápido y lo elige (en escritorio la GPU puede quedar atada al refresco, ~33 ms).
  - Calienta el modelo durante la carga.
  - Filtra solo los blendshapes que usa.
- **`worklet.js`:**
  - **Voz 303:** diente de sierra o cuadrada con polyBLEP, escalera de 4 polos con realimentación saturada (`tanh`), acento que se acumula, slide RC de 22 ms y segundo pico opcional (SVF).
  - **Batería sintetizada:** bombo, caja, rim y hats; además un pad de acordes y un drone.
  - **Delay ping-pong** en corchea con puntillo.
  - **Suavizado por muestra** de los parámetros: llegan a 30 Hz y no hacen clic.
  - **Salida 1** es el envío a la reverb por convolución, que arma el hilo principal.
- **`app.js`:**
  - Rasgos de la boca **geométricos**: apertura = distancia interna de los labios ÷ distancia entre los ojos; ancho = comisuras ÷ ojos. Los combina con los blendshapes.
  - **Filtro 1€** (Casiez 2012) con anticipo.
  - **Calibración** por usuario en 4 pasos: reposo, abierta, redonda y ancha. Los límites siguen adaptándose después.
  - **Gestos:** caída brusca de la mandíbula o cabeceo = acento; guiño de 120 ms o los dos ojos cerrados 0,6 s = siguiente patrón.

### Qué aprovechar y qué reimplementar
| Pieza | Propuesta |
|---|---|
| Patrón del worker de cara (un cuadro en vuelo, elección de CPU o GPU, calentamiento) | **Reimplementar** en TS dentro de `hooks/` y `workers/`, inspirado en el original |
| Voz 303 (escalera, polyBLEP, acento, slide) | **Adaptar** a TS en un worklet propio, con los parámetros 1–10 y sin el modo libre de "hablar". Es el corazón y está bien resuelto |
| Batería sintetizada del worklet | Opción para la caja de ritmos (todo en un worklet) o reimplementación con nodos nativos. Decidir en el prompt de la caja |
| Filtro 1€ y calibración | **Reimplementar** (unas 30 líneas, puro y testeable en Node) |
| `vision_bundle.mjs`, wasm y modelo locales | No copiar: el proyecto ya usa `@mediapipe/tasks-vision`. Sí conviene **fijar la versión** del wasm. Hoy `MP_WASM` apunta al CDN sin versión, lo que es un riesgo de desfase con el paquete |
| `beauty.js` e interfaz | No aplica |

### Crédito (`CREDITOS.md`, cuando se use código)
> **Mouth × Acid**, Electro-Dig (2026), https://github.com/Electro-Dig/mouth-acid, licencia MIT. Adaptación de la voz tipo TB-303 (filtro escalera, acento, slide), del patrón de inferencia de Face Landmarker en un Web Worker, del filtro 1€ con anticipo y de la calibración de la boca. Copyright (c) 2026 Electro-Dig.

- La licencia MIT exige **incluir el aviso de copyright y el texto de la licencia** si se copian partes sustanciales. Conviene guardar el texto en `CREDITOS.md` o en el encabezado del archivo adaptado.
- El comentario de `worklet.js` dice que el sonido sigue otro proyecto del mismo autor ("Acid 的八种玩法"), que no es público. Lo publicado es MIT, pero conviene **mencionarlo**.
- Si se usa el filtro 1€, citar a Casiez, Roussel y Vogel (2012).
- MediaPipe (Apache 2.0) ya es una dependencia del proyecto.

### Mapeo propuesto: cara → máquina de bajo
| Gesto (blendshape de MediaPipe) | Parámetro 303 | Nota |
|---|---|---|
| `jawOpen` (+ apertura geométrica de los labios) | CORTE | El principal. La geometría es más precisa que `jawOpen` solo (así lo hace `mouth-acid`) |
| `mouthPucker` / `mouthFunnel` (máximo) | RESONANCIA | |
| `mouthSmileLeft` / `mouthSmileRight` (promedio) | ENVOLVENTE | |
| `cheekPuff` | DISTORSIÓN | Exagerado y fácil de entender |
| Caída brusca de la mandíbula (velocidad de `jawOpen`) | ACENTO | Disparo con 220 ms de refractario |
| `browInnerUp` | ESPACIO (envío a delay y reverb) | Descontarle una parte de `jawOpen` (al abrir la boca se levantan las cejas) |
| `eyeBlinkLeft/Right` (guiño de 120 ms, o los dos ojos 0,6 s) | SIGUIENTE PATRÓN | Un parpadeo normal (0,1–0,4 s) no dispara |
| `tongueOut` | SLIDE mantenido | **Poco confiable**: el modelo da puntajes bajos y erráticos. Opcional, apagado por defecto |

Todo pasa por calibración, el filtro 1€ y un mapeo a 1–10 en el registro de parámetros. Así el futuro atril de cables puede reasignar cualquier gesto a cualquier parámetro.

### ¿Se puede reutilizar `hooks/useFaceTracking.ts`?
- **Sí, en parte:** mismo modelo (`face_landmarker` float16), modo VIDEO y **blendshapes ya activados**.
- **Hay que cambiar:**
  - el hook corta el bucle al capturar la foto (hace falta un **modo continuo**);
  - corre a 12 Hz en el hilo principal (para el bajo conviene 25–30 Hz);
  - los resultados hay que publicarlos en un objeto de módulo (sin estado de React) para leerlos en `useFrame` y en el audio.
- **Recomendado:** una sola instancia del modelo para el público y para el bajo, movida a un **Worker** con el patrón de `mouth-acid`. Correr dos instancias duplica la memoria (~4 MB de modelo y el wasm) y la CPU.

---

## e) Librerías

| Opción | Peso | Licencia y mantenimiento | A favor | En contra |
|---|---|---|---|---|
| **Web Audio nativo + AudioWorklet** (recomendada) | 0 KB de dependencias | Estándar del navegador | El proyecto ya está escrito así. Control total del DSP (la 303 necesita un worklet de todos modos). Sin capas que esconder al medir | Más código propio (reloj, voces, programador) |
| **Tone.js** 15.1.22 | 5,4 MB desempaquetado en npm. En el bundle, cientos de KB minificado (medir con el build) | MIT, activo (publicación del 14-11-2026) | Transporte, `Sequence`, sintetizadores, `Sampler` y efectos listos: mínimos más rápidos | Crea su propio contexto (hay que pasarle el nuestro con `Tone.setContext`). Tiene su propio reloj. Peso. La 303 auténtica igual pide un worklet |
| Otras (WebAudioFont, Elementary, etc.) | — | Verificar antes de elegir | — | No las evalué a fondo: no aportan algo que falte en las dos opciones de arriba |

**Recomendación:** nativo. Tone.js solo si el usuario prioriza tener los cuatro instrumentos rápido sobre la calidad de la 303. Aun así, la 303 iría en un worklet propio.

---

## f) Rendimiento y plan de medición

### Presupuesto estimado (PC por encima de la media, a medir)
| Carga | Dónde corre | Estimación |
|---|---|---|
| Worklet 303 + batería | Hilo de audio | 1 a 5 % de un núcleo. No afecta al FPS |
| Sintetizador de 8 voces nativo | Hilo de audio | Bajo (los nodos nativos corren en C++) |
| Programador con anticipación | Hilo principal | < 0,1 ms cada 25 ms |
| `getVizBands()` en la tarima | Hilo principal | ~0,1–0,2 ms por cuadro (4 lecturas de 256 muestras) |
| Face Landmarker CPU a 30 Hz | **Worker** (recomendado) | 10–25 ms por inferencia: entre un 30 y un 75 % de un núcleo del worker. En el hilo principal sería un tirón por cuadro |
| Face Landmarker GPU | Worker | Compite con el render de three.js. Medir antes de elegir |
| Hand Landmarker (futuro) | Worker | Del mismo orden que la cara. Con cara y manos juntas, alternar cuadros o bajar a 15 Hz cada uno |

**Meta:** hasta +1 ms de tiempo de cuadro en el hilo principal con todo encendido y **sin cortes de audio**.

### Filas nuevas del benchmark de Z66 (`lib/rendimiento.ts`, `SistemaPerf`)
- **`instrumentos`**: desconecta los instrumentos del bus. Mide el costo del hilo principal: programador y mensajes al worklet.
- **`analisisAudio`**: no llama a `getVizBands()` en la tarima.
- **`caraMP`**: detiene la detección continua de la cara.
- **`manosMP`**: lo mismo para las manos, cuando existan.
- **Métricas extra en el reporte:**
  - inferencia promedio y p95 (ms);
  - frecuencia real de detección (Hz);
  - latencia de cuadro a parámetro (ms);
  - `baseLatency` + `outputLatency`;
  - cantidad de cortes de audio. Se miden en el panel **WebAudio** de Chrome DevTools ("render capacity") o con un contador de huecos que publique el worklet.

---

## g) Orden recomendado

| # | Prompt | Alcance | Tamaño |
|---|---|---|---|
| 1 | Núcleo de audio | Contexto único con flag, bus maestro, entrada de análisis y `getVizBands()` en la tarima. Sin cambio audible. Filas `analisisAudio` e `instrumentos` | mediano |
| 2 | Reloj y parámetros | Programador con anticipación, BPM y swing, registro de parámetros 1–10, patrones en `sessionStorage`. Pruebas en Node | mediano |
| 3 | Caja de ritmos mínima | 4 voces, 16 pasos, patrones de fábrica y panel de debug (Shift). El visualizador reacciona | mediano |
| 4 | 303 en AudioWorklet | Voz, secuenciador, 6 parámetros, crédito en `CREDITOS.md`, carga del worklet con Next y webpack | grande |
| 5 | Controles en el atril de sonido | Sección nueva (o atril aparte) para la caja y la 303, estilo cassette futurism | grande |
| 6 | Cara → 303 | Modo continuo y Worker para Face Landmarker, versión del wasm fijada, filtro 1€, calibración, mapeo, fila `caraMP` | mediano |
| 7 | Sintetizador mínimo | 6–8 voces, ADSR, LFO y modo de teclado | mediano |
| 8 | Sampler mínimo | 8 pads, recorte del mp3 (reemplaza el loop de `setInterval`) | mediano |
| 9 | Medición | Benchmark en la PC de la muestra, ajuste de presupuesto y calidad | chico |
| 10+ | Ampliados | Cables entre atriles, manos (`manosMP`), micrófono, kits, arpegiador | a definir |

### Riesgos principales
- **Unificar los contextos toca SILLAS**, que ya está aprobado. Por eso va detrás de un flag y con prueba de regresión del visualizador.
- **Autoplay en Safari:** hay que reanudar el contexto en un gesto (hoy `initAudio` corre en un efecto).
- **Carga del AudioWorklet con Next y webpack** (`addModule` necesita una URL): resolverlo al principio del prompt 4.
- **CPU de la cara en el hilo principal:** se resuelve con el Worker. Hoy el bucle es de solo 12 Hz y se apaga.
- **Licencias de muestras y crédito de `mouth-acid`.**

### Decisiones que debe tomar el usuario antes de empezar
1. ¿El mp3 de la tarima **sigue sonando** con los instrumentos? ¿Los instrumentos se ajustan a su tempo (habría que detectar el BPM) o tienen un BPM propio y el mp3 pasa a ser opcional?
2. ¿**Contexto único también para SILLAS** o solo para la tarima? Lo primero permite que el domo reaccione a los instrumentos, pero toca código aprobado.
3. ¿**Dónde viven los controles**: en el atril de sonido actual, en un tercer atril o en un panel? ¿Y qué pasa con los efectos actuales?
4. ¿Los instrumentos se **pausan** con la pausa central (camino LUZ) o siguen sonando?
5. ¿**Cámara siempre encendida** en la tarima para controlar con la cara? Hoy se apaga después de capturar la foto para el público.
6. ¿Muestras: solo **sintetizadas y propias**, o kits de terceros (CC0, con crédito)? ¿Micrófono sí o no?
7. ¿**Nativo o Tone.js**? La recomendación es nativo.
8. ¿Prioridad: **303 con cara primero** (el más vistoso y alineado con "ponerse bajo el foco") o caja de ritmos primero (la más simple)?
