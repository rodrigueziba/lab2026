# Evaluación: conexión en vivo TARIMA → SILLAS (Z77b)

Fecha: 2026-11-17 · Rama `sillas-narrativa` · Documento de evaluación: no cambia código.
Las cifras marcadas **(est.)** son estimaciones, no mediciones. Lo marcado **(sin verificar)** no pudo confirmarse en una fuente oficial.

---

## Diseño pedido

(Copiado tal cual del pedido del usuario.)

- Hay dos caminos independientes. SILLAS: solo ver o experimentar arte ya hecho (base de datos de proyectos; el prisma lleva al visualizador; dentro, si el usuario juega con las luces y el pasto y logra que el arte se exprese, aparecen los monolitos). TARIMA: crear, exponerse y jugar con las materias expresivas.
- Monolito de sonido: al acercarse, el audio propio del visualizador se va reemplazando de a poco, según la distancia, por el sonido que haya en la tarima (lo que suena o se crea). Si no hay usuario en la tarima, lo que se oye es ruido (estática). Si está lo bastante cerca, el reemplazo es total y se sostiene 15 segundos después de alejarse; luego el audio original vuelve de forma progresiva. En esos 15 segundos, si va al monolito de video, el audio de la tarima se mantiene; si va a cualquier otro lado, el audio original vuelve (progresivamente, de inmediato). Al volver a acercarse, el contador de 15 s se reinicia.
- Monolito de video: igual, pero con la proyección del domo: cerca, el domo proyecta lo que se proyecta en la tarima; al alejarse se sostiene 15 segundos; si en esa ventana va al monolito de sonido, el video se mantiene. Si no hay sesión en la tarima, el domo muestra estática de televisión sin señal (procedural, sin red).
- Efecto de tiempo detenido simulado: se percibe al ALEJARSE de un monolito, como consecuencia de haberse acercado (no mientras se acerca), y solo si NO hay sesión en la tarima. Se aplica al audio original del visualizador (caída de velocidad y de tono, con vuelta progresiva) y a la cámara propia del usuario (shader tipo CRT que el usuario pasará después). NO se aplica a lo que llega por streaming desde la tarima.
- Una sola sesión "en vivo" a la vez: si hay varios en la tarima, los monolitos muestran al más reciente.
- Privacidad: al elegir el camino de la tarima habrá un texto de ink.js para que el usuario decida si quiere exponerse y transmitir. Sin consentimiento no se transmite nada.

---

## Resumen

- **Ya existe un prototipo local de la idea (N5)**, sin red:
  - Al acercarse al monolito derecho, la música del visualizador baja hasta un 15 % y sube ruido blanco.
  - Al acercarse al izquierdo, el visualizador viejo mezcla estática.
  - Hay una interfaz `RemoteSession`, con un mock y un esqueleto de LiveKit sin SDK instalado.
  - Lo que hay que hacer es completar esto, no empezar de cero.
- **El domo actual no tiene entrada de video.** El estático del monolito izquierdo vive en el shader viejo de `DomeVisualizer`, no en `DomeSky`, que es el material actual del domo. Hacen falta uniforms nuevos en `dome.frag.glsl`, `DomeSky.tsx` y `SPEC.md`.
- **Despliegue:** el repo trae Docker Compose con un servidor Node para Next y otro para NestJS, así que no es serverless y se puede tener un WebSocket propio. El dominio real no está en el repo (`api.tudominio.com` es un placeholder). El frontend ya usa Supabase (`@supabase/supabase-js` 2.95.3).
- **Recomendación** (opción C, híbrida):
  - Presencia, "sesión más reciente" y parámetros por **Supabase Realtime**: ya está en el proyecto y no suma dependencias.
  - El video de la tarima, y el audio que no se pueda resintetizar, por **LiveKit Cloud**: ya hay un esqueleto y es Apache-2.0, así que se puede alojar uno mismo si hiciera falta.
  - La alternativa con más margen gratuito para medios es Cloudflare Realtime.
- **Todo funciona sin red.** Sin sesión o sin conexión, el monolito de sonido da ruido y el de video, estática procedural. Así, la mitad SILLAS del diseño (estados, mezcla, estática, tiempo detenido) se puede construir y probar antes de elegir servicio.
- **Costo:** unos 8 a 9 prompts, de los cuales 2 son grandes: publicar desde la tarima y recibir en SILLAS.

---

## a) Estado actual relevado

### Caminos y separación

| Tema | SILLAS | TARIMA |
|---|---|---|
| Elección | `alight:chose-chairs` | `alight:chose-light` |
| Audio | `lib/vizAudio.ts`, con su propio `AudioContext` | `lib/audioEngine.ts`, con otro `AudioContext` |
| Visual principal | Domo con `DomeSky` (shader del portal) | `FaceDome` (webcam en 7 sectores con efectos), atriles y público |
| Monolitos | `Monoliths.tsx` + `lib/monolitosPasto.ts` | — |
| Red | Ninguna | Ninguna (`WatcherEye` lee el mock de sesión) |

- `ThreeScene.tsx` monta `WatcherEye` solo si `path !== "sillas"`. Los dos caminos no comparten nada en tiempo real.
- Los dos `AudioContext` no pueden conectarse entre sí. Ya se señaló en `docs/EVALUACION_INSTRUMENTOS.md`, y la propuesta Z78 los unifica.

### Qué produce la tarima

| Fuente | Dónde | ¿Se puede transmitir? |
|---|---|---|
| Música mp3 (`/api/music`) | `audioEngine`: `<audio>` → efectos → analizador → salida | Sí, pero conviene **no** transmitirla: el oyente puede reproducir el mismo archivo (opción B) |
| Efectos del atril de sonido | `audioEngine` (cadena de efectos) | Como parámetros (B) o dentro del audio (A) |
| Instrumentos (futuros, Z78+) | Bus maestro del núcleo de audio | Como eventos (B) o con `MediaStreamAudioDestinationNode` (A) |
| Webcam | `hooks/useFaceTracking.ts`: `getUserMedia` → `<video>` → `VideoTexture` en `LIVE_TEX_REF` | Sí, es un `MediaStream` directo |
| Proyección de la tarima | `FaceDome.tsx`: shader con `uMap` = webcam y efectos `uE0…uE6`, brillo, contraste, saturación, zoom, psych | Hay que renderizarla a un canvas propio y capturarla (`captureStream`), o mandar la webcam más los parámetros para que el oyente aplique el mismo shader |
| Rostro capturado | `CanvasTexture` (instantánea para el público) | No hace falta |

### Qué consume el visualizador (SILLAS)

- **Audio:** `vizAudio`.
  - La cadena es `<audio>` → `createMediaElementSource` → 4 bandas con filtros, analizador y compuerta → `sumGain` → `_musicFadeGain` (N5) → `_masterGain` → `_vizAnalyser` → salida.
  - El ruido blanco de N5 entra por `_noiseGain` → `_masterGain`.
  - `applyEffects()`, llamado por `SectorAudioFX` en cada frame, escribe `playbackRate` con `preservesPitch = false`.
- **Monolitos y audio:** `Monoliths.tsx` llama `setMonolithProximity(proxL, proxR)` en cada frame.
  - La cercanía va de 0 a 1 entre `monolithProxStartM` (3,0 m) y `monolithProxFullM` (0,5 m).
  - El derecho baja la música (`1 − 0,85·prox`) y sube el ruido (`noiseGain` 0,5).
  - El izquierdo solo escribe `N5_STATE.leftProximity`, que lee el `DomeVisualizer` viejo (`uRemoteMix`, `uStaticMix`).
- **Domo:** `DomeSky` es el material del domo (`domoShaderEnMalla` true). Sus texturas son `portal-masks` y `portal-color`, y no tiene ninguna entrada de video.
- **Monolitos y pasto:** aparecen con `alight:pasto-completo` (`MONOLITOS_MODO` "pasto"). La posición sale de `posMonolitosPasto` y queda en `MONO_PASTO` (`xL`, `xR`, `z`). La aparición avanza con el reloj de la experiencia.

### Red, backend y despliegue

| Ítem | Estado |
|---|---|
| `lib/remoteSession.ts` | Interfaz `RemoteSession` (`getImage`, `getAudio(ctx)`, `setWatching`, `onWatchers`, `dispose`), `MockRemoteSession` (siempre inactiva) y un esqueleto `LiveKitRemoteSession`. No hay SDK instalado |
| Backend | NestJS 10 sobre Express, con Prisma y Supabase Postgres. No tiene `@nestjs/websockets`. **No se toca sin pedido explícito** |
| Supabase en el frontend | `@supabase/supabase-js` 2.95.3 ya se usa en páginas del sitio (subida de archivos). Realtime no se usa todavía |
| Despliegue | `docker-compose.prod.yml`: contenedor backend (puerto 3000) y contenedor frontend (`next start`, puerto 3001). Es un servidor Node persistente, no serverless. El dominio es un placeholder y el host real no consta en el repo **(sin verificar: preguntar dónde corre hoy)** |
| `README` del frontend | Es el texto genérico de Next ("Deploy on Vercel"); no indica que se use Vercel |

---

## b) Qué transmitir

### Opciones

| | (A) Streams reales | (B) Solo eventos y parámetros | (C) Híbrido (recomendado) |
|---|---|---|---|
| Qué viaja | Audio Opus y video (VP8, VP9 o H.264) por WebRTC | Mensajes chicos: nota, parámetro, pista y posición del mp3, filtros del atril | Eventos para los instrumentos, el mp3 y los filtros; stream solo para la webcam o proyección |
| Fidelidad | Exacta, es lo que suena | Exacta solo si el oyente tiene el mismo motor y los mismos archivos | Exacta para lo sintetizable; el video es real |
| Ancho de banda por oyente | 0,4 a 1,2 Mbps (est.) | 1 a 10 kbps (est.) | 0,3 a 0,8 Mbps solo con el video activo (est.) |
| Costo del servicio | El más alto: medios por SFU | Casi nulo: canal de mensajes | Medio: medios solo cuando hay alguien frente al monolito de video |
| Complejidad | Media: SDK más token | Alta en el oyente, que necesita el motor de la tarima | Alta: las dos cosas |
| Riesgo de privacidad | La cara viaja | No viaja imagen | La cara viaja solo con consentimiento; el modo privado envía la imagen procesada |
| Sin sesión | Estática y ruido | Estática y ruido | Estática y ruido |

**Por qué C:**
- El mp3 de la tarima sale de `/api/music`. El oyente puede reproducir la misma pista sincronizada con "pista y segundo", sin transmitir audio.
- Los instrumentos de Z78 son deterministas con sus parámetros de 1 a 10.
- La webcam es lo único que no se puede resintetizar.

**Matiz:** si en Z78 hay micrófono o sampler con grabaciones del usuario, eso obliga a un stream de audio, como en A. Se puede empezar con C sin micrófono.

### Latencia, tamaño y "no hay sesión"

- **Latencia tolerable:** de 1 a 3 s está bien, porque la experiencia es atmosférica. Esto permite colas grandes y priorizar la estabilidad sobre la inmediatez.
- **Proyección en el domo:**
  - Propuesta: 640×360 a 15 fps, o 480×270 en el modo bajo. Va en el sector del portal, no en todo el domo.
  - Una resolución baja encaja con la estética de televisión con CRT.
  - Bitrate de 300 a 600 kbps (est.).
- **Detección de "no hay sesión"** (presencia con latido):
  - La tarima publica `{ sesionId, inicioMs, consentimiento: true, modo }` en un canal de presencia y renueva un latido cada **5 s**.
  - El oyente toma la sesión con mayor `inicioMs` entre las que tuvieron latido en los últimos **15 s**.
  - Sin latido durante 15 s, la sesión cuenta como inexistente y se vuelve a ruido y estática.
  - Si el stream de video no llega en 5 s pero hay presencia, se muestra la estática con un rótulo tipo "SEÑAL DÉBIL".

---

## c) Servicios de transporte

Datos de planes verificados el 2026-11-17 (fuentes al pie de cada fila). "Encaja" = con el despliegue actual de Docker con Node persistente.

### Medios (audio y video)

| Servicio | Plan gratuito | Licencia | Encaja | Complejidad | Notas |
|---|---|---|---|---|---|
| **LiveKit Cloud** | Plan Build: 100 participantes simultáneos ([docs oficiales](https://docs.livekit.io/deploy/admin/quotas-and-limits/)). Minutos WebRTC: unos 5.000 al mes según terceros ([forasoft](https://www.forasoft.com/blog/article/livekit-vs-agora-cost-analysis), [apicostcalc](https://apicostcalc.com/livekit.html)) **(sin verificar en livekit.com/pricing)** | Servidor Apache-2.0 ([pkg.go.dev](https://pkg.go.dev/github.com/livekit/livekit-server@v1.9.4)); `livekit-client` 2.24.1, Apache-2.0 (registro npm) | Sí: el token se firma en una ruta de Next (`app/api/...`), sin tocar el backend | Baja a media | Ya hay esqueleto e interfaz. Se puede alojar uno mismo si se pasa del cupo |
| **Cloudflare Realtime (SFU)** | 1.000 GB de salida al mes gratis, compartidos con TURN; después USD 0,05 por GB. Solo se cobra lo que sale hacia los clientes ([docs oficiales](https://developers.cloudflare.com/realtime/sfu/platform/pricing/)) | Servicio propietario (protocolo WebRTC estándar) | Sí: requiere un secreto del lado del servidor (ruta de Next) | Media a alta: API de bajo nivel, sin "salas" | Es el cupo más generoso: unas 4.400 horas de espectador a 0,5 Mbps (est.) |
| **WebRTC P2P + señalización** | Gratis; TURN aparte (Cloudflare lo incluye en el cupo de arriba) | — | Sí: la señalización puede ir por Supabase Realtime | Alta: hay que resolver ICE, reconexión y TURN | Una tarima a N oyentes en malla sube N streams: no escala más allá de 3 o 4 oyentes (est.) |

### Mensajes, presencia y señalización

| Servicio | Plan gratuito | Licencia | Encaja | Notas |
|---|---|---|---|---|
| **Supabase Realtime** (presencia y broadcast) | 200 conexiones simultáneas y 100 mensajes/s ([límites oficiales](https://supabase.com/docs/guides/realtime/limits)); unos 2 millones de mensajes al mes según terceros **(sin verificar)** | Cliente MIT (`@supabase/supabase-js` 2.119.0 en npm; el proyecto usa 2.95.3) | Sí, ya está en el proyecto | **Recomendado** para presencia y eventos. Ojo: el proyecto gratuito de Supabase se pausa tras inactividad **(sin verificar para este proyecto)** |
| **Ably** | 6 millones de mensajes al mes, 200 conexiones, 200 canales y 500 mensajes/s ([docs oficiales](https://ably.com/docs/platform/pricing/free)) | SDK Apache-2.0 (`ably` 2.30.0); servicio propietario | Sí | Muy sólido, pero suma una cuenta y una dependencia |
| **PartyKit / Durable Objects** | Durable Objects con SQLite están en el plan gratuito de Workers, con límites ([docs de Cloudflare](https://developers.cloudflare.com/durable-objects/platform/pricing)); cupos exactos **(sin verificar)** | `partysocket` 1.3.0, MIT | Sí: corre en Cloudflare, aparte del despliegue | Bueno si se elige Cloudflare Realtime para medios |
| **Liveblocks** | 500 salas activas al mes ([docs oficiales](https://liveblocks.io/docs/pricing/plans/free)); uso comercial ambiguo en el plan gratuito | Propietario | Sí | Pensado para documentos colaborativos: no aporta nada frente a Supabase |
| **WebSocket propio** | Gratis (el servidor ya existe) | — | Sí, en el servidor Node. **Requiere tocar el backend** (`@nestjs/websockets`) o sumar un servicio | Control total, pero hay que mantenerlo. En Vercel, los WebSockets están en beta y se cortan a los 5 min por defecto ([Vercel KB](https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections)), por si algún día se migra |

### Qué pasa si falla

En todos los casos, el estado de la sesión pasa a `error` o `idle` y se comporta como si no hubiera sesión: el monolito de sonido da ruido y el de video, estática.
- **Supabase caído:** no hay presencia, así que no hay sesión.
- **Servicio de medios caído con presencia viva:** "SEÑAL DÉBIL", con la estática y el audio resintetizado si existe.
- **El tiempo detenido no se aplica** cuando la ausencia se debe a una falla de red: solo si de verdad no hay sesión. Esto es decisión del usuario (ver i).

---

## d) Lado SILLAS

### Máquina de estados (una por monolito, más el acople entre los dos)

| Estado | Entra cuando | Mezcla (`k` = 0 original … 1 remoto) |
|---|---|---|
| `lejos` | `d > R_INICIO` y sin sostén | `k = 0` |
| `acercandose` | `R_TOTAL < d ≤ R_INICIO` | `k = curva((R_INICIO − d) / (R_INICIO − R_TOTAL))` |
| `cerca` | `d ≤ R_TOTAL` | `k = 1`. Al entrar, el reloj de sostén vuelve a 15 s |
| `sosteniendo` | Salió de `cerca` hacia afuera | `k = 1` hasta 15 s, salvo cancelación |
| `retornando` | Terminaron los 15 s o se canceló | `k` baja en `RETORNO_S`; si vuelve a `acercandose`, se retoma desde el `k` actual |

**Regla cruzada (lectura propuesta, a confirmar):**
- Mientras A está en `sosteniendo`, si la distancia al monolito B **baja** (el usuario va hacia B) o está dentro de `R_INICIO` de B, el reloj de A **se congela**: no descuenta.
- Si el usuario se aleja de los dos (las distancias a A y a B crecen durante más de `CANCELA_S`), A pasa a `retornando` enseguida.
- Al llegar a `cerca` de B, A queda sostenido mientras B esté en `cerca` o `sosteniendo`.
- Resultado: se puede tener audio y video de la tarima a la vez, yendo de un monolito al otro.

**Tiempo detenido:**
- Se dispara al pasar de `cerca` o `sosteniendo` a `retornando`, solo si `sesion = ninguna`.
- No se dispara en `acercandose`.

**Constantes propuestas** (`DBG_MONO_VIVO`, en `lib/debugConfig.ts` y en el menú Shift):

| Constante | Valor inicial | Qué es |
|---|---|---|
| `R_INICIO_M` | 3,0 | Empieza el reemplazo (= `monolithProxStartM` actual) |
| `R_TOTAL_M` | 1,0 | Reemplazo total (hoy 0,5; con 1,0 es más fácil quedarse "cerca") |
| `SOSTEN_S` | 15 | Ventana de sostén |
| `RETORNO_S` | 4 | Vuelta progresiva al original |
| `CANCELA_S` | 0,6 | Cuánto tiempo alejándose de los dos cancela el sostén |
| `CURVA` | "suave" | Rampa `smoothstep` (o "lineal") |
| `RUIDO_GAIN` | 0,5 | Ruido sin sesión (= `noiseGain`) |
| `ESTATICA_MAX` | 1,0 | Estática en el domo con `k = 1` y sin sesión |
| `LATIDO_S` / `TIMEOUT_S` | 5 / 15 | Presencia |
| `VIDEO_RES` | "640x360" | "480x270", "640x360" o "854x480" |
| `TIEMPO_DET_*` | ver f) | Efecto de tiempo detenido |

**Implementación:**
- Lógica pura en `lib/monolitosVivo.ts`, sin imports, con un test en Node, igual que `luzHuida.ts`.
- `Monoliths.tsx` solo cambia la llamada `setMonolithProximity`: pasa `kSonido` y `kVideo` en lugar de la cercanía cruda.
- Con el flag `DBG_MONO_VIVO.ACTIVO` en false queda el N5 actual.

### Fuente remota en `vizAudio` (tocando lo mínimo)

- Ya existe el punto de mezcla: `_musicFadeGain` (original) y `_noiseGain` (ruido) convergen en `_masterGain`.
- Hay que agregar un tercer nodo `_remotoGain`, alimentado por:
  - **A:** `ctx.createMediaStreamSource(streamRemoto)`. **(sin verificar en la versión actual)** Chrome tiene un problema conocido: el audio WebRTC remoto no fluye a Web Audio si el stream no está también en un `<audio muted>`.
  - **B y C:** el motor resintetizado de la tarima, instanciado en el contexto de `vizAudio`.
- Con sesión, `remoto = k` y `original = 1 − k`; sin sesión, `ruido = k·RUIDO_GAIN`. El `setTargetAtTime` con `tau` 0,12 s ya da la progresión.
- **El remoto no pasa por `playbackRate`:** el tiempo detenido no lo afecta, como pide el diseño.
- **Decisión:** si `_remotoGain` entra antes de `_masterGain`, el analizador del domo (kick, AGC) también reacciona al audio de la tarima. Las 4 bandas no, porque se analizan sobre la fuente original. ¿Que el visual reaccione a lo remoto?
- API nueva en `vizAudio`: `setFuenteRemota(nodo | null)` y `setMezclaMonolitos(kSonido, haySesion)`. Es un archivo, unas 40 líneas (est.).

### Video remoto como textura del domo

- `VideoTexture` sobre un `<video>` oculto con el `MediaStream` remoto. Se crea una vez por sesión y se libera al cambiar de sesión o al desmontar.
- Formato `NoColorSpace`, igual que las texturas del portal, porque el shader no convierte el espacio de color.
- Uniforms nuevos en `dome.frag.glsl`: `uRemoteTex` (sampler2D), `uRemoteMix` (0…1 = `kVideo`), `uStaticMix` (estática sin señal) y `uRemoteOn` (0 sin textura válida).
  - Hay que actualizar `domeShaders.ts`, `DomeSky.tsx` y `docs/dome/SPEC.md`, como pide CLAUDE.md.
  - Se proyecta en las coordenadas del portal (`uPortalF`, `uPortalR`, `uPortalU`, `uPortalTan`), o sea, dentro del recorte del portal y no en todo el domo.
- **Estática de televisión:** procedural en el mismo shader (hash por píxel × tiempo cuantizado a unos 30 Hz, barras de rodado, bandas horizontales y algo de color fantasma). Sin texturas ni red.
- **Costo (est.):**
  - Subir 640×360 a 15 fps a la GPU: unos 0,2 a 0,4 ms por frame con video nuevo.
  - Decodificar VP8 con hardware: 1 a 3 % de CPU.
  - La estática: menos de 0,1 ms de GPU.
- Sin video llegando, `uRemoteOn = 0` y no se muestrea la textura.

---

## e) Lado TARIMA

### Qué se captura

| Elemento | Cómo |
|---|---|
| Audio de los instrumentos (Z78) | El bus maestro del núcleo expone un `MediaStreamAudioDestinationNode`. En C, además o en lugar de eso, se publican los eventos del reloj |
| mp3 de la tarima | En C: solo `{ pistaId, segundo, rate }` cada 2 s y en cada cambio |
| Efectos del atril de sonido | Parámetros (C) o dentro del stream (A) |
| Proyección | Opción 1: webcam cruda + parámetros de `FaceDome` (`uE0…6`, brillo, contraste, saturación, zoom, psych); el oyente aplica el shader. Opción 2: render de la proyección a un canvas propio de 640×360 → `canvas.captureStream(15)` |

**Recomendación:** opción 2 para el modo privado (lo que viaja ya está procesado) y opción 1 solo si el usuario consiente mostrar la cara.

### Flujo de consentimiento (ink.js)

1. **Elegir TARIMA → knot nuevo de ink** (por ejemplo `tarima_exponerse`) con dos o tres opciones:
   - "Transmitir con mi imagen"
   - "Transmitir sin mostrar mi cara"
   - "No transmitir"
2. **Efectos:** `# efecto: transmitir:cara`, `transmitir:privado` y `transmitir:no`, mapeados en `efectosDialogo.ts`.
3. **Valor por defecto: no transmitir.** Si se cierra el diálogo sin elegir, no se transmite.
4. **El consentimiento no se recuerda entre sesiones.** Se pregunta cada vez que se elige la tarima, salvo que se decida otra cosa.

### Indicador y corte

- **Rótulo fijo "● EN VIVO":** pantalla ámbar `#FF9A1F` sobre `#2A1400`, con la marca ficticia del proyecto, en un borde de la pantalla y fuera del CRT (tiene que ser legible siempre).
- **Botón y tecla "CORTAR TRANSMISIÓN"** (por ejemplo `X`): corta medios y presencia al instante y no se reanuda sin volver a pasar por el consentimiento.
- **Contador de espectadores:** reutilizar `onWatchers` (hoy alimenta `WatcherEye`).
- **Al salir de la tarima, recargar o cerrar la pestaña:** desconexión explícita en `pagehide`. Si falla, el latido vence a los 15 s.

### Modo de privacidad

- Transmite solo la proyección procesada: efectos fuertes (psych, posterizado o pixelado), sin la webcam cruda.
- Opcional: con la malla del Face Landmarker, tapar o desenfocar la región de la cara antes de capturar.
- El audio no tiene modo privado. Si hubiera micrófono, sería un consentimiento aparte.

---

## f) Efecto de tiempo detenido

| Dónde | Cómo | Costo (est.) |
|---|---|---|
| Audio original del visualizador | `playbackRate` del `<audio>` de `vizAudio` con `preservesPitch = false` (baja velocidad y tono, como un tocadiscos que se frena). **Ojo:** `applyEffects()` lo pisa en cada frame, así que hay que agregar un multiplicador `RATE_TIEMPO` que `applyEffects` aplique sobre `_rateCur` | Despreciable |
| Alternativa de audio | AudioWorklet de *tape stop* (buffer con lectura variable) | Más fiel pero más trabajo; reservar para después |
| Cámara del usuario | Pase de post-proceso nuevo `PaseTiempoDetenido` en `RetroPostFX`, **antes del CRT** (regla de CLAUDE.md), con `uTiempo` (0…1) y `uTiempoT` | 0,1 a 0,3 ms de GPU en 1080p (est.); con `uTiempo = 0` el pase se saltea (`enabled = false`) |

**Curva propuesta:**
- Caída de la velocidad de 1 a `TIEMPO_DET_MIN` (0,35) en `TIEMPO_DET_CAIDA_S` (1,2 s).
- Pausa casi detenida de `TIEMPO_DET_PAUSA_S` (0,5 s).
- Vuelta en `TIEMPO_DET_VUELTA_S` (3 s).
- Todo en `DBG_MONO_VIVO` y en el menú.

**Punto de enganche para el shader del usuario:**
- Archivo `lib/retro/tiempoDetenido.glsl.ts` con una función `vec3 tiempoDetenido(vec2 uv, sampler2D tDiffuse, float t, float k)`.
- La implementación inicial es un placeholder simple: desaturar, bajar el temblor de scanlines y congelar el ruido.
- El usuario reemplaza solo el cuerpo de esa función.
- El pase ya pasa `uTiempo`, `uResolution` y `uTime` con el patrón de uniforms de `RetroPostFX` (ShaderPass clona los uniforms: escribirlos en `pass.uniforms`, comentario G2).

**Exclusiones:**
- No se aplica a la textura remota, porque el pase de cámara afecta todo el frame. Si hay sesión, el efecto no se dispara, así que no hay conflicto.
- Si en el futuro se quisiera el efecto con sesión, habría que excluir el portal con una máscara.

---

## g) Riesgos

| Riesgo | Mitigación propuesta |
|---|---|
| **Abuso y moderación** (imagen o sonido para desconocidos, menores) | Consentimiento explícito; modo privado sugerido; sala única; duración máxima por sesión (por ejemplo 10 min); sin grabación; interruptor remoto de apagado (una fila en Supabase, `transmision_habilitada`, que el cliente consulta); aviso al oyente ("contenido en vivo de otra persona"). Al ser uso académico, conviene que la cátedra o la UNTDF confirme si hace falta un aviso legal |
| **Desconexiones** | Reconexión automática del SDK; tras 15 s sin latido, "sin sesión"; el oyente nunca queda en negro (estática o ruido) |
| **Safari** | `captureStream` de canvas y `createMediaStreamSource` funcionan en las versiones recientes **(sin verificar)**. `MediaElementSource` más `playbackRate` sin `preservesPitch` puede comportarse distinto. Hay que probarlo a mano en Safari (la PC objetivo es Chrome, según CLAUDE.md) |
| **Autoplay** | El oyente de SILLAS ya tiene el `AudioContext` desbloqueado por gestos previos. El `<video>` remoto va silenciado, porque el audio entra por Web Audio. Si `ctx.state` es `suspended`, se reintenta `resume()` en el próximo gesto |
| **Costo si crece** | LiveKit Build cubre una muestra académica. Pasado el cupo: Cloudflare (1.000 GB gratis) o LiveKit propio. Con C, el video solo se suscribe cuando `kVideo > 0` (se desuscribe en `lejos`), lo que reduce mucho el consumo |
| **Conexión lenta** | Calidad adaptativa del SFU (simulcast 270p/360p); bajo el umbral, rótulo "SEÑAL DÉBIL" con estática al 30 % sobre la imagen; el audio prioriza la versión resintetizada (C) |
| **Secretos** | Las claves de LiveKit y Cloudflare van en el servidor (ruta de Next), no en `NEXT_PUBLIC_*`. Configurarlas es tarea del usuario: Claude Code no lee `.env*` |
| **Supabase gratuito pausado** | Si el proyecto queda inactivo, no hay presencia y todo cae al modo sin sesión, de forma segura **(sin verificar la política actual)** |

---

## h) Filas nuevas para el benchmark (Z66)

Se agregan a los sistemas de `lib/rendimiento.ts` con el mismo patrón de interruptor y medición.

| id | Mide | Presupuesto (est.) |
|---|---|---|
| `streamRecibido` | Decodificación y recepción (CPU del hilo principal, jitter, fps recibidos) | ≤ 3 % de CPU, ≥ 12 fps |
| `texturaVideoDomo` | Subida de `VideoTexture` y muestreo en `DomeSky` | ≤ 0,4 ms de GPU por frame |
| `estaticaDomo` | Estática procedural | ≤ 0,1 ms de GPU |
| `mezclaRemota` | Nodos nuevos de `vizAudio` (latencia de salida, *underruns*) | Despreciable; 0 cortes |
| `transmisionTarima` | Del lado de la tarima: render de la proyección a 640×360 y codificación | ≤ 1 ms de GPU y ≤ 8 % de CPU |
| `tiempoDetenido` | Pase de post-proceso | ≤ 0,3 ms de GPU |

**Presupuesto total en SILLAS con todo activo (est.):** de 0,6 a 0,8 ms de GPU y de 3 a 5 % de CPU por encima de lo actual. Hay que medirlo en la PC objetivo con GPU.

---

## i) Plan de prompts recomendado

Los números Z son tentativos y van después de Z78 (núcleo de audio). Los pasos 1 a 3 no necesitan red ni cuentas: se pueden hacer ya.

| # | Alcance | Riesgo | Tamaño |
|---|---|---|---|
| 1 | `lib/monolitosVivo.ts` puro (estados, sostén, regla cruzada, disparo del tiempo detenido) con test en Node; `DBG_MONO_VIVO` y menú; `Monoliths.tsx` y `vizAudio` usan `k`. Sin sesión: ruido | Bajo | Medio |
| 2 | Estática de televisión y entrada de video en `DomeSky` (uniforms, `SPEC.md`, `domeShaders.ts`), probada con un video local como sesión simulada | Medio (shader del domo) | Medio |
| 3 | Tiempo detenido: multiplicador de rate en `vizAudio` y pase `PaseTiempoDetenido` con el placeholder del shader | Bajo | Chico |
| 4 | Presencia y "sesión más reciente" con el servicio elegido (Supabase Realtime): latido, timeout e implementación de `RemoteSession` solo con presencia; el mock sigue de respaldo | Medio (cuenta y claves) | Medio |
| 5 | Consentimiento en ink (knot, efectos `transmitir:*`), indicador EN VIVO y corte | Bajo | Medio |
| 6 | Publicar desde la tarima: token en una ruta de Next, SDK de medios, captura de la proyección (canvas) y del bus Z78, modo privado | Alto | Grande |
| 7 | Recibir en SILLAS: suscripción condicionada a `kVideo` y `kSonido`, `_remotoGain`, `VideoTexture` real, resíntesis C del mp3 y los parámetros | Alto | Grande |
| 8 | Robustez: reconexión, SEÑAL DÉBIL, duración máxima, interruptor remoto, filas del benchmark | Medio | Medio |
| 9 | Pruebas en Safari y en red lenta; ajuste fino de radios y tiempos con el usuario | Bajo | Chico |

### Decisiones del usuario antes de empezar

1. **Dónde corre hoy el sitio** (VPS con Docker, Vercel u otro) y si se puede crear una cuenta en un servicio externo (LiveKit Cloud o Cloudflare) con claves en el servidor.
2. **Opción A, B o C.** Recomendada: C, empezando sin micrófono.
3. **Regla cruzada:** ¿se acepta "ir hacia el otro monolito = la distancia baja o entra en su radio" y "alejarse de los dos durante 0,6 s = cancelar"?
4. **¿El visual del domo reacciona al audio de la tarima** cuando está reemplazado (kick y AGC), o solo al original?
5. **Consentimiento:** ¿tres opciones (cara, privado, no) o dos? ¿Se pregunta cada vez?
6. **¿Duración máxima de transmisión** y aviso al oyente? ¿Hace falta validación institucional?
7. **¿El tiempo detenido** se dispara también cuando la falta de sesión se debe a una falla de red, o solo cuando de verdad no hay nadie?
8. **Shader del usuario:** ¿cuándo llega? Mientras tanto queda el placeholder.
9. **¿El área del domo** donde se proyecta es solo el portal o todo el domo?

---

### Fuentes consultadas (2026-11-17)

- LiveKit, cuotas y límites: https://docs.livekit.io/deploy/admin/quotas-and-limits/
- LiveKit, precios según terceros: https://www.forasoft.com/blog/article/livekit-vs-agora-cost-analysis · https://apicostcalc.com/livekit.html
- LiveKit server, licencia: https://pkg.go.dev/github.com/livekit/livekit-server@v1.9.4
- Cloudflare Realtime SFU, precios: https://developers.cloudflare.com/realtime/sfu/platform/pricing/
- Cloudflare Durable Objects, precios: https://developers.cloudflare.com/durable-objects/platform/pricing
- Supabase Realtime, límites: https://supabase.com/docs/guides/realtime/limits
- Ably, plan gratuito: https://ably.com/docs/platform/pricing/free
- Liveblocks, plan gratuito: https://liveblocks.io/docs/pricing/plans/free
- Vercel y WebSockets: https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections
- Versiones y licencias npm (registry.npmjs.org, consultado hoy): `livekit-client` 2.24.1 Apache-2.0 · `@supabase/supabase-js` 2.119.0 MIT · `ably` 2.30.0 Apache-2.0 · `partysocket` 1.3.0 MIT
