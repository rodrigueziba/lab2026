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
