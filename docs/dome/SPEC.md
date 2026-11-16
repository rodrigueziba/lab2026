# SPEC — Domo 360 "portal" reactivo a la música

Recrea la ilustración de referencia (`public/portal/reference.png`) dentro de tu domo: un portal con atardecer al frente, anillos dorados que lo envuelven como túnel y una cordillera baja alrededor del horizonte. Cada parte se anima con tu sistema de 4 bandas.

## 1. Archivos del paquete

| Archivo | Para qué sirve |
|---|---|
| `src/dome/dome.frag.glsl` / `dome.vert.glsl` | Shaders (GLSL ES 1.00, compatibles con `ShaderMaterial`) |
| `src/dome/domeShaders.ts` | Los mismos shaders como strings, para importar sin configurar el bundler |
| `src/dome/DomeSky.tsx` | Componente R3F de ejemplo: crea el material, suaviza las bandas y actualiza uniforms |
| `public/portal/portal-layers.svg` | Siluetas vectoriales (viewBox 607×608): montañas negras, montaña de estratos, zona de olas |
| `public/portal/portal-masks.png` | Las mismas siluetas rasterizadas a 1024²: R = negras, G = estratos, B = olas (sin alpha) |
| `public/portal/portal-color.png` | Referencia posterizada (colores planos) que el shader ondula dentro de las máscaras |
| `public/portal/portal-params.json` | Medidas del sol, nubes, paleta y destellos sobre la referencia |

## 2. Cómo se resuelve la deformación del domo

El shader no pinta sobre las UV de la esfera: trabaja con la **dirección de cada píxel** (`vDir`). La imagen plana del portal se proyecta con un mapeo gnomónico (como un cuadro colgado frente al espectador), así que las siluetas se ven sin estirar desde el centro del domo. Tu efecto fisheye o de lente se aplica después y deforma todo por igual, de modo que no hay que compensar nada en las siluetas.

- `uPortalF/R/U` definen hacia dónde mira el portal (azimut + elevación).
- `uPortalTan = tan(semi-FOV horizontal)` define qué tan grande se ve (valor sugerido: 42°).
- Elevación sugerida: `0.58 rad`. Con ese valor quedan visibles las franjas rojas y naranjas; las olas azules inferiores quedan bajo el horizonte.
- Debajo del horizonte el shader pinta un suelo oscuro; tu suelo real lo tapa.

## 3. Contrato de uniforms

| Uniform | Tipo | Valor inicial | Notas |
|---|---|---|---|
| `uTime` | float | segundos | `clock.elapsedTime` |
| `uBands` | vec4 | 0..1 | x graves, y medios bajos, z medios altos, w agudos (ya suavizadas) |
| `uMasks`, `uColor` | sampler2D | — | `colorSpace = NoColorSpace`, `flipY` por defecto de three |
| `uPortalF/R/U` | vec3 | ver `DomeSky.tsx` | Ortonormales |
| `uPortalTan` | float | 0.90 | Tamaño del portal |
| `uWarp` | float | 1.0 | 0..2, intensidad base del warp |
| `uRingFlow` | float | 0.03 | Velocidad del flujo de anillos |
| `uRingScale` | float | 1.0 | Periodo de anillos (más alto = franjas más gruesas) |
| `uRingFade` | vec2 | (1.0, 1.6) | Dónde empiezan y terminan de desvanecerse los anillos |
| `uStarCut` | float | 0.965 | Más alto = menos estrellas |
| `uGroupEnergy` | vec4 | 0..1 | x=SOL, y=MONTAÑAS, z=CIELO, w=LÍNEAS (suavizadas por grupo) |
| `uKick` | float | 0..1 | Destello de kick, decay exponencial ~150 ms |
| `uSolAmt` | float | 1.5 | Multiplicador amplitud SOL |
| `uMontAmt` | float | 1.5 | Multiplicador amplitud MONTAÑAS |
| `uCieloAmt` | float | 1.5 | Multiplicador amplitud CIELO |
| `uLinAmt` | float | 1.5 | Multiplicador amplitud LÍNEAS |
| `uKickAmt` | float | 1.0 | Multiplicador amplitud kick |
| `uDawn` | float | 1.0 | W3: progreso amanecer fase 1 (0→1, ease-out cúbico) |
| `uReveal` | vec4 | (1,1,1,1) | W3: x=MONTAÑAS, y=LÍNEAS, z=SOL, w=CIELO (0→1 fase 2) |
| `uDiaNuevo` | float | 0 | Z48: 1 = ciclo de día (`lib/cicloDia.ts`); 0 = amanecer viejo con `uDawn` / `uReveal` |
| `uDia` | float | 0 | Z48: tDia 0..1 (0 noche, 0,12 alba, 0,20 salida, 0,50 mediodía, 0,80 atardecer, 0,92 crepúsculo) |
| `uSolDir` | vec3 | (0,−1,0) | Z48: dirección del sol en el mundo (convención `az = atan(d.x, −d.z)`) |
| `uLuzDia` | float | 0 | Z48: luz del día 0..1 (brillo de la cordillera y del portal) |
| `uColHor`, `uColMed`, `uColCen` | vec3 | — | Z48: cielo del mundo (horizonte, medio, cénit) en sRGB, interpolados por el ciclo |
| `uColGlow`, `uBrilloSol` | vec3, float | — | Z48: resplandor hacia el azimut del sol (más intenso al salir y al ponerse) |
| `uEstrellas` | float | 1 | Z48: visibilidad de las estrellas (se apagan con la luz del día) |
| `uMontCrece`, `uMontCentro`, `uMontAncho`, `uMontSilueta` | float | 0, —, 0.12, 0.35 | Z48: la cordillera es una silueta desde el principio y crece por azimut desde la salida del sol |
| `uSolRadio` | float | 0.055 | Z48: radio angular (rad) del disco del sol del mundo (anillo rojo, crema y núcleo amarillo, como el del portal) |
| `uSolPulso`, `uNubesBrillo` | float | 0 | Z48: ganchos de música del visualizador futuro (0 = sin efecto) |
| `uPortalNoche` | float | 0.45 | Z48: brillo del portal de noche (× luz del día) |
| `uSolUnico` | float | 0 | Z49: 0..1 atenúa el sol ilustrado del portal (el disco del mundo lo reemplaza) |
| `uHaloTope` | float | 0.88 | Z49: tope del resplandor y del halo del sol (bajo el umbral del bloom) |
| `uTinteBorde`, `uTinteAnillos` | float | 0.8, 0.7 | Z49: borde del portal y anillos teñidos con el cielo del mundo de ese píxel |
| `uTinteInterior` | float | 0.25 | Z49: velo del interior con el color de la etapa (no toca sol ilustrado ni montañas) |
| `uBordeSuave` | float | 0.5 | Z49: feather del borde del portal (misma forma) |
| `uBordeAncho` | float | 0.22 | Z50: banda del contorno hacia adentro del disco (fracción del radio) que converge al color del cielo |
| `uSolNuevo` … `uSolTinteEt` | varios | ver `DomeSky.tsx` | Z51: sol nuevo (núcleo, halo y rayos al estilo de la referencia aportada por el usuario): base tangente `uSolTR`/`uSolTU`, escala `uSolTam`, `uSolIntens`, `uSolNucleo`, `uSolHalo`, `uSolRayos` (3, 9), `uSolRayosAncho`, `uSolRayosInt`, `uSolBrillo` (animado), `uSolRot`, `uSolAlcance`, `uSolPaleta`, `uSolTinteEt`. El destello de lente no está en este shader (`components/SolFlare.tsx`). |
| `uOndas[8]` | vec4[] | (0,0,0,0) | Z52: ondas por kick (`lib/ondasKick.ts`): x = edad (s, reloj de la experiencia), y = fuerza, z = luz 0..3, w = activa. Desplazan la fase de los anillos del marco (`ph`) fuera del portal |
| `uOndaCol[4]` | vec3[] | — | Z52: color de la luz de cada banda (`DBG_SILLAS.hazColor0..3`), sRGB |
| `uPortalCx` | float | 0.0461 | Z57: x del centro del círculo del portal y de los anillos (`PORTAL_C.x`; con `DBG_PORTAL.ANILLOS_EN_EJE` = `SUN_C.x` 0.0082, el eje del pico). Lo siguen el contorno, el tinte del borde y las ondas |
| `uSolTope`, `uSolTopeBrillo` | float | 0.97, 1.0 | Z51 / Z57: tope del cuerpo del sol fuera del núcleo; tope de todo el sol, núcleo incluido (1 = sin tope). Ninguno oscurece el cielo ya más brillante |
| `uFluido`, `uFlT`, `uFlE`, `uFlMez`, `uFlEsc`, `uFlWarp`, `uFlLuz`, `uFlPulso`, `uFlOct`, `uFlPalA[5]`, `uFlPalN[5]` | varios | ver `DBG_FLUIDO` | Z61: fluir de color dentro del bloque azul (estratos `m.g` + olas frías de `m.b`) y del naranja (olas cálidas de `m.b`). Tiempo acumulado y energía suavizada por bloque (`lib/fluidoBloques.ts`); implementación propia de domain warping (2 capas, 2–4 octavas de ruido de valor). Conserva la luminancia de la textura. `uFluido` 0 = como antes |
| `uOndaContraste`, `uOndaEngrosar` | float | 0 | Z58: bajo la cresta las franjas van al revés del fondo (contraste) y se engrosan. Amplitud, brillo, tinte, contraste y engrosamiento llegan ya mezclados por `DBG_ONDAS.EVIDENCIA` (`evidenciaOndas`, `lib/ondasKick.ts`) |
| `uOndaVel`, `uOndaAncho`, `uOndaDur`, `uOndaAmp`, `uOndaBrillo`, `uOndaBrilloNoche`, `uOndaTinte`, `uOndaRevelar` | float | ver `DBG_ONDAS` | Z52: velocidad (rad/s), ancho (rad), vida (s), amplitud (períodos de franja), brillo, brillo de noche, tinte de la banda y visibilidad bajo la cresta |
| `uDebugCapas` | float | 0 | Z50: 1 = capas de la composición en colores planos (disco azul, banda del contorno cian, contorno magenta, anillos verde, franja de Z49 amarilla, sol ilustrado naranja, nubes blanco, montañas rojo) |

Z49: la escala de la composición (`DBG_PORTAL.ESCALA`) no es un uniform propio: `DomeSky.tsx` multiplica `uPortalTan` por la escala y sube la elevación de `uPortalF` a `atan(ESCALA · tan(e0))` (`lib/portalEscala.ts`) para que la base siga en el horizonte.

No incluyas `colorspace_fragment`: los colores ya están en sRGB y las texturas no deben convertirse.

## 4. Qué banda mueve qué

| Banda | Elemento |
|---|---|
| Graves | Sol (escala + halo) y expansión/brillo de los anillos dorados |
| Medios bajos | Ondulación de las franjas rojas/naranjas/azules y de los estratos verdes |
| Medios altos | Flujo del cielo (domain warp), deformación del borde de anillos, respiración de nubes |
| Agudos | Titileo de estrellas y destellos, cantidad y giro del confeti |

Las montañas negras y la cordillera del horizonte son estáticas.

## 5. Pasos para Claude Code (uno por sesión, con `/clear` entre ellos)

1. **Integrar sin audio.** "Copiá `src/dome/` y `public/portal/` al proyecto. Reemplazá el material del domo actual por `DomeSky` (mismo mesh, centrado en la cámara). `getBands` devuelve ceros por ahora. Verificá con `npx tsc --noEmit` y mirá el resultado en el navegador."
2. **Conectar tus bandas.** "Leé mi sistema de bandas de sonido y devolvé `{bass, lowMid, highMid, treble}` normalizado 0..1 desde `getBands`, sin crear objetos por frame ni estado de React."
3. **Panel de ajuste.** "Agregá leva con sliders para `warp`, `ringFlow`, `ringScale`, `ringFade`, `starCut`, `portalElevation`, `portalHalfFovDeg` y `portalAzimuth`. Ocultalo con `<Leva hidden />` según una variable de entorno."
4. **Probar con música real.** "Abrí `localhost:3000` con el navegador, reproducí una pista con graves marcados y otra con agudos, y decime qué bandas casi no se notan para ajustar los multiplicadores dentro del shader."
5. **Pulido.** Subí la resolución de `portal-masks.png` si los bordes se ven duros en pantalla grande (ver límites).

## 6. Límites conocidos

- Las siluetas salen de una imagen de 607×608 px, así que los bordes tienen esa resolución. En pantalla grande pueden verse algo irregulares. Si tenés la ilustración original en mayor resolución, repetí la extracción con ella.
- Alrededor de los estratos y las olas quedan finas líneas amarillas. En parte vienen de la propia ilustración y en parte del recorte.
- Verifiqué que compila y se ve bien con three.js real en un navegador sin GPU. **No medí fps en una GPU real**; si baja de 60 en tu máquina, activá `lowQuality` (usa menos octavas de ruido).
- El shader del cielo adapta el domain warp de Iñigo Quilez (Shadertoy `lsl3RH`, CC BY-NC-SA 3.0). Dejá el crédito en el código y en los créditos de la obra; para uso académico no comercial alcanza.
