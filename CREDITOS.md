# Créditos — alight

Instalación interactiva de Ezequiel Ibarra.

---

## Algoritmos y shaders de terceros

### Domain warp (cielo del domo)

El shader del cielo (`frontend/app/alight/dome/dome.frag.glsl`) adapta el
**domain warping fractal** de Iñigo Quilez:

- Título: *"warp"*
- URL: https://www.shadertoy.com/view/lsl3RH
- Autor: Iñigo Quilez ([@iquilezles](https://iquilezles.org))
- Licencia: **CC BY-NC-SA 3.0** — uso académico / no comercial; se requiere
  atribución y la misma licencia en derivados.

El algoritmo original se modificó para integrar las cuatro bandas de audio
del sistema reactivo y la secuencia de amanecer del shader.

### Cielo estrellado del camino LUZ (Z30)

- Obra: *Nightsky Shader Elective*, por **tmoe1354** (Shadertoy `WcjGRz`, 2025).
- Archivo: `frontend/lib/luz/estrellasCielo.glsl.ts` (lo usa `frontend/components/CieloEstrellado.tsx`).
- Licencia: **CC BY-NC-SA 3.0** — uso académico / no comercial; se requiere
  atribución y la misma licencia en derivados.

Cambios: sin texturas ni multipass; estrellas por celdas 3D sobre la dirección de mirada,
manchones de densidad, titilar, velo azul del horizonte, rampa `uReveal` ligada a la
distancia a la luz, calidad por capas (`uCapas`) y tope por canal (`uTope`).

### Fractal de las caras del prisma (Z43)

- Obra: *jungle fractal II*, por **George Toledo** (Shadertoy, 2015). El original no declara licencia:
  rige la de Shadertoy por defecto, **CC BY-NC-SA 3.0** (uso académico / no comercial; atribución y
  misma licencia en derivados).
- Incluye *Cellular noise ("Worley noise") in 2D in GLSL*, © **Stefan Gustavson** 2011 — **MIT**
  (texto de la licencia en el encabezado del archivo).
- Archivo: `frontend/lib/prisma/fractalJungla.glsl.ts` (lo usa `frontend/components/Prism.tsx`).

Cambios: coordenada por cara en metros (sin estirarse), tiempo propio acumulado según la cercanía,
constantes como uniforms, divisiones protegidas, solo la intensidad del original pintada con la paleta
amarilla/naranja del prisma, regiones combinadas con máscaras, ruido celular opcional y reacción a la música.
Z44: colores y encuadre del original restaurados (la paleta amarilla/naranja queda detrás de un flag).
Z45: cálculo en una textura compartida por las 3 caras; port a TypeScript del ruido celular de Gustavson
(mismo algoritmo, período ajustable) para precalcularlo en una textura opcional
(`frontend/lib/prisma/ruidoCelular.ts`, misma licencia MIT).

---

### Tipografía del texto del telón (Z46)

- **Anton**, por Vernon Adams — **SIL Open Font License 1.1**. Se carga con `next/font/google`
  (`frontend/app/alight/fuentes.ts`), que la sirve desde el propio sitio. La usa
  `frontend/components/TelonTexto.tsx` para el texto "A LIGHT FOR ATTRACTING ATTENTION" proyectado sobre el telón.

### Sol del cielo y destello de lente (Z51)

- Estilo adaptado de un shader de **Shadertoy aportado por el usuario** (sol con núcleo brillante, rayos y destello
  de lente: hash `rnd`, `regShape`, `shapes`). **Autor y URL por confirmar** (los agrega el usuario). Mientras no se
  confirme otra, rige la licencia por defecto de Shadertoy, **CC BY-NC-SA 3.0** (uso académico / no comercial).
- Archivos: `frontend/app/alight/dome/dome.frag.glsl` (cuerpo del sol, función `solMundo`) y
  `frontend/components/SolFlare.tsx` (destello de lente con sprites en pantalla).

## Herramientas

- Three.js / React Three Fiber — MIT
- Next.js — MIT
- NestJS — MIT
- Prisma — Apache 2.0
- sharp — Apache 2.0

## Pasto bajo las luces (Z64) — PENDIENTE DE CONFIRMAR
- Archivo: `frontend/components/Pasto.tsx` (y la lógica propia en `frontend/lib/pasto.ts`).
- Adaptado del **pasto** de un shader de Shadertoy aportado por el usuario. **Autor y URL: pendientes** (el usuario los va a pasar).
- Licencia asumida: CC BY-NC-SA 3.0 (la de Shadertoy por defecto). Uso académico no comercial (TIF, UNTDF); si la obra se vuelve comercial, revisar.
- Se adaptó: la técnica de capas apiladas (acá como planos 3D en lugar de capas por píxel de pantalla), la textura de briznas (máximos locales de un campo aleatorio, altura con raíz cuadrada, tres verdes), el viento proporcional a la altura, el oscurecimiento por altura y la punta rojiza. No se usaron las nubes (que el original acredita a "drift", https://www.shadertoy.com/view/4tdSWr), el cielo ni la cámara libre ("Free fly by Tempally").
- Propio de este proyecto: el crecimiento por cuartos, el umbral irregular y su ruido, la iluminación y la integración con las luces.

## Antialiasing FXAA y SMAA del post-proceso (Z69)
- Archivo: `frontend/lib/retro/paseFinal.ts` (función `correccionAA`, dentro del pase final fusionado).
- FXAA: versión simplificada del algoritmo **NVIDIA FXAA de Timothy Lottes** (2009–2011), en la forma del `FXAAShader` clásico de **three.js** (MIT). Se adaptó para calcularse una vez por píxel, sobre la escena HDR (luma con compresión l/(1+l)), y sumarse como corrección a las tres lecturas de la aberración cromática del CRT.
- SMAA (opción `ANTIALIAS_MODO: "smaa"`): `SMAAPass` de three.js (MIT), basado en SMAA de Jorge Jimenez et al. (MIT). Se usa sin cambios.

## Núcleo de audio de la tarima (Z78)
- Archivos: `frontend/lib/audio/reloj.ts` y `frontend/lib/audio/ruido.ts`.
- Reloj: patrón de programación con anticipo descrito por **Chris Wilson** en "A Tale of Two Clocks – Scheduling Web Audio with Precision" (web.dev / HTML5 Rocks, 2013): un temporizador del navegador despierta al programador y los tiempos salen del reloj de audio. Se reimplementó (sin copiar código), con pausa, cortes y oyentes sin allocations.
- Ruido rosa: filtro "refined" de **Paul Kellet** (coeficientes publicados en la lista music-dsp; sin licencia declarada, de uso muy difundido: se acredita al autor).

## Caja de ritmos circular (Z80) — referencia visual
- Archivos: `frontend/components/CajaRitmos.tsx`, `frontend/lib/ritmos.ts`, `frontend/lib/ritmosMotor.ts`, `frontend/lib/audio/ritmosVoces.ts`.
- Inspiración visual (solo referencia, sin código reutilizado): video de **@thetokenwise** de un secuenciador circular en 3D (anillos = instrumentos, ángulo = tiempo, línea radial que gira, cubitos que saltan, disco de vinilo central, barra con BPM, 4/4 y posición). Captura guardada en `docs/referencias/ritmos_referencia.png`.
- El código, la síntesis de las voces y el diseño de la interacción son propios de este proyecto.

## Tiempo detenido: retraso por filas (slit-scan) con estela de luces (Z86)
- Archivos: `frontend/lib/tiempoHistorial.ts`, `frontend/lib/retro/historialTiempo.ts`, `frontend/lib/retro/tiempoDetenido.ts`.
- Inspiración: Shadertoy de desplazamiento temporal (**autor pendiente**), que guarda un historial de cuadros en miniaturas y hace que cada fila de la imagen lea un cuadro distinto del pasado. No se reutilizó su código: la implementación es propia (historial nítido en una textura de capas de WebGL2, interpolación entre cuadros vecinos, estela por retroalimentación, desfase de color y banda de seguimiento).

## Transmisión en vivo de la tarima por LiveKit (Z92)
- Archivos: `frontend/lib/vivo/publicarLiveKit.ts`, `frontend/lib/vivo/liveKitCiclo.ts`, `frontend/lib/vivo/tokenLiveKit.ts`, `frontend/app/api/livekit/token/route.ts`.
- **livekit-client** 2.24.1 (LiveKit, Inc., licencia Apache-2.0): SDK del navegador para conectar a la sala y publicar las pistas. Se carga con `import()` dinámico solo al publicar.
- **livekit-server-sdk** 2.20.0 (LiveKit, Inc., licencia Apache-2.0): firma de los tokens de acceso en la ruta de Next (solo servidor).
- Servicio: LiveKit Cloud (plan gratuito). El código de la integración es propio.
