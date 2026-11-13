# Inventario del amanecer y del cielo (Z47)

Foto del código al 2026-11-13, rama `sillas-narrativa`. Solo lectura: no se abrió el navegador. Lo que solo se
puede confirmar mirando está marcado **sin verificar**. Rutas relativas a `frontend/`.

Contexto: el amanecer existe solo en el camino **SILLAS**, después de `alight:visualizer-activate`. En el camino
TARIMA no se monta `ExperienceDome` (`components/ThreeScene.tsx:513-514`: `path !== "tarima"`), así que ahí no hay
domo, ni haces, ni amanecer. Configuración por defecto que describe este informe:
`usarDomoShader = true`, `domoOriginal = false`, `domoShaderEnMalla = true` (`lib/debugConfig.ts:568-572`),
`DBG_AMANECER.UNIFICADO = true` (`lib/debugConfig.ts:882-886`).

---

## 1) Línea de tiempo real del amanecer

**Disparo**
- Al pasar por un haz, `lib/haz.ts:63` / `:89` emite `alight:haz-toggle` `{ index, on }`.
- `components/HazSystem.tsx:107`: con el primer `on` llama a `dispararAmanecer()` (`lib/amanecer.ts:37`). Solo
  tiene efecto con la máquina en `inactivo` (disparo único). HazSystem existe solo con el visualizador activo.
- `dispararAmanecer` deja `AMANECER.pendiente = true`; el próximo `tickAmanecer` lo arranca (`lib/amanecer.ts:51-55`).

**Reloj**
- `components/AmanecerReloj.tsx:17-20` (montado por LuzLejana, siempre): una vez por frame
  `tickAmanecer(dt, PAUSA.activa, DBG_AMANECER.AMANECER_DUR_S)`. Usa `dt` (tiempo de experiencia): **se congela con
  la pausa** del camino LUZ.

**Fases** (`lib/amanecer.ts:16-68`)

| Fase | Desde → hasta (T0 = frame siguiente al primer haz) | Valor que produce |
|---|---|---|
| `inactivo` | antes de T0 | `p1 = 0`, `tFin = 0` |
| `amanecer` (fase 1) | T0 → T0 + 10 s | `p1 = t / 10` **lineal** 0→1 (`:58-59`) |
| `completo` (fase 2) | T0 + 10 s → siempre | `p1 = 1`; `tFin` = s desde el fin de la fase 1 (`:65-66`) |

- `alight:dawn-complete` y su alias `alight:dome-dawn-complete` se emiten **una vez**, en el frame en que `p1` llega a
  1 (T0 + 10 s) (`lib/amanecer.ts:41-47`, `:60-63`). También los emite el checkpoint `amanecer_completo`
  (`lib/checkpointsAcciones.ts:174-180`). `skipAmanecer` no lo emite.
- No hay progreso "global" aparte de `p1`; cada consumidor aplica su curva y su propia fase 2.
- Los consumidores leen la máquina con `estadoCompat()` (`lib/amanecer.ts:89-95`), que traduce `p1` y `tFin` al formato
  viejo `{ phase, startT, completeT }` sobre su `clock.elapsedTime`.

**Por elemento (consumidores activos)**

| Consumidor | Valor | Curva | Tiempo (s de experiencia desde T0) |
|---|---|---|---|
| DomeSky (domo, `DomeVisualizer.tsx:499-522`) | `uDawn` | `easeOut3(p1)` (`lib/amanecer.ts:31-34`) | 0 → 10 |
| | `uReveal.x` MONTAÑAS (estratos) | lineal | 11 → 14 (delay 1 s, dur 3 s; `debugConfig.ts:588-592`) |
| | `uReveal.y` LÍNEAS (olas) | lineal | 12 → 15 |
| | `uReveal.z` SOL (anillos) | lineal | 13 → 16 |
| | `uReveal.w` CIELO (estrellas, warp, confeti) | lineal | 14 → 17 |
| Esfera PANORAMA_FRAG (`DomeVisualizer.tsx:796-800`) | `uDawnSkyT` | lineal `p1` | 0 → 10 (la esfera está invisible, ver §2) |
| Monolitos (`Monoliths.tsx:449-475`) | captura de envMap al `dawn-complete` | un disparo | T0 + 10, **apagada** (`MONOLITOS_CAPTURA = false`) |

Duraciones: `DBG_AMANECER.AMANECER_DUR_S = 10` manda en la máquina. `DBG_SILLAS.domeAmanecerDurS = 10` y
`amanecerDurS = 10` solo se usan para la conversión de formato; si se cambiaran por separado, la conversión seguiría
dando el mismo `p1` (se usan de ida y de vuelta).

---

## 2) Inventario de lo que se ve desde la sala (camino SILLAS con visualizador)

### 2.1 Domo — DomeSky (shader del portal) ✅ participa · ✅ música
- **Archivos:** `app/alight/dome/DomeSky.tsx`, `dome.frag.glsl`, `domeShaders.ts`.
  - Lo alimenta `DomeSkyAnchor` (`components/DomeVisualizer.tsx:419-571`).
  - El material va sobre la malla "domo-cielo" de `components/ExperienceDome.tsx:960-962`: semiesfera de radio 30,
    BackSide, `renderOrder −1`, transparente, sin `depthWrite`. Se aplica en `ExperienceDome.tsx:889-895`.
- **Uniforms** (`DomeSky.tsx:114-144`):
  - tiempo y portal: `uTime`, `uCameraPos`, `uBands` (siempre 0: `getBands = _zeroBands`, `DomeVisualizer.tsx:405`;
    el shader no lo usa), `uPortalF/R/U`, `uPortalTan`;
  - texturas: `uMasks`, `uColor`;
  - formas: `uWarp`, `uRingFlow`, `uRingScale`, `uRingFade`, `uStarCut`;
  - música: `uGroupEnergy` (x SOL, y MONTAÑAS, z CIELO, w LÍNEAS), `uKick`, `uSolAmt` / `uMontAmt` / `uCieloAmt` /
    `uLinAmt` / `uKickAmt`;
  - amanecer y debug: `uDawn`, `uReveal`, `uSoftEdge`, `uDebugMasks`.
- **Amanecer** (`dome.frag.glsl`):

| Qué | Valor de `uDawn = 0` → valor de `uDawn = 1` | Línea |
|---|---|---|
| Cielo del mundo (todo el domo fuera del portal) | `nightSky` → `worldSky()` (degradado por altura + fbm) | 208-209 |
| Contenido del portal | invisible → cielo del portal (`mix(col, sky, inside·uDawn)`) | 289 |
| Sol (3 discos, dentro del portal) | desplazado 0,8 abajo → posición final (`sunRiseOfs = (1−uDawn)·0,8`) | 255-257 |
| Cordillera que rodea el domo (2 capas) | altura 0 → altura final (`hFar`, `hNear` × `uDawn`) y opacidad × `uDawn` | 237-242 |
| Siluetas negras de la imagen (máscara R) y 2 destellos | ocultas → visibles (× `uDawn`) | 315, 320-321 |
| Estrellas del mundo + del portal, warp del cielo, confeti | 0 → visibles con `uReveal.w` (fase 2, 14–17 s) | 212, 247, 283-287, 328 |
| Anillos dorados del túnel | 0 → visibles con `uReveal.z` (13–16 s) | 232 |
| Olas y estratos del portal (texturas) | 0 → visibles con `uReveal.y` / `.x` | 312-313 |

- **Música** (`DomeVisualizer.tsx:533-547`): `uGroupEnergy[i] = normEnergy[assignment[i]]`.
  - Solo si la luz `i` está encendida (`getHazBandOn(i)`); si no, va a 0.
  - Ataque y caída por grupo `[15, 120, 30, 60] ms` / `[120, 600, 300, 400] ms` (`:408-409`).
  - Ganancias (`debugConfig.ts:581-585`): SOL × 1,5 · MONTAÑAS × 3 · CIELO × 2 · LÍNEAS × 3 · KICK × 1.
  - `uKick`: flanco de `BAND_STATE.kick` (banda 80–250 Hz), decae con τ 65 ms (`:544-546`).

| Grupo | Qué mueve (`dome.frag.glsl`) |
|---|---|
| SOL | Ondulación y fase de los anillos (216-219, 227); tamaño del sol (`k = 1 + 0,05·sol + 0,08·kick`); halo (258) |
| MONTAÑAS | Amplitud del desplazamiento de estratos (`a2`) y brillo +8 % (313) |
| CIELO | Warp del cielo (247-251); velocidad del warp; umbral y brillo de estrellas (211, 283); escala de nubes (267); confeti (328-331) |
| LÍNEAS | Amplitud de las olas (`a1`, 296-298); brillo +10 % (312) |
| kick | Brillo de anillos, sol, estrellas y destellos |

### 2.2 Esfera de panorama (PANORAMA_FRAG) ⚠ dibujada pero invisible
- **Archivo:** `components/DomeVisualizer.tsx:268-327` (shader) y `:891-903` (malla: esfera r = 28, escala hasta 1,15,
  BackSide, `renderOrder −1`, transparente).
- **Uniforms:** `uFade`, `uTime`, `uSunDir`, `uSunAngularRad`, `uSunIntensity`, `uRemoteMix`, `uStaticMix`,
  `uGrow0–3`, `uDawnSkyT`, `uPulse0–3`, `uFlow3`, `uKick`, `uMtH`, `uMtB`, `uMtK`, `uSkyB`, `uSunB`, `uLineA`,
  `uSkyVis`, `uSkyMagenta`.
- Con la configuración por defecto, `uFade = 0` (`:778-780`): se dibuja con alfa 0.
- **Amanecer:** `uDawnSkyT` lineal 0→1 abre un cielo cálido de arriba hacia abajo (`skyEdge` de 1,2 a −0,5; `:306-316`).
- **Música:** `uPulse2 × uSkyB` sobre el brillo del cielo cálido (`:309`).
- Ninguno de los dos se ve hoy.

### 2.3 Panorama SVG — VizPanorama ⛔ apagado (solo con `domoOriginal = true`)
- **Archivo:** `components/VizPanorama.tsx`. Se monta en vez de DomeSkyAnchor (`DomeVisualizer.tsx:909-912`).
- **Uniforms por capa** (frente, medias, fondo, líneas): `uReveal`, `uSectorWidth`, más `uEdgeColor #EE8A2B`,
  `uTintColor #E07030` y `uFogColor #1B1428` (`:118-122`).
- **Amanecer** (`:505-640`), con sector aleatorio por sesión (`AMANECER.sectorDeg`):
  - **Fase 1:** sector de 90°, se revela la capa frente (`t·1,2 − 0,1`); el sol se ubica en el sector + 180°.
  - **Fase 2:**
    - el sol vuelve a su azimut en 2 s;
    - estrellas en 3 s y nubes en 2 s, desde 1 s;
    - el sector se abre de 0,25 a 2,0 en 3 s;
    - las capas fondo / medias / líneas crecen en 4 s con easeOut3, escalonadas 1 s.
- **Música:** usa los `growRef` / `pulseRef` / `flowRef` / `kickRef` de DomeVisualizer.

### 2.4 Cielo estrellado de la sala — CieloEstrellado ❌ amanecer · ❌ música
- **Archivo:** `components/CieloEstrellado.tsx`, shader `lib/luz/estrellasCielo.glsl.ts`. Esfera en el plano lejano,
  `renderOrder −0,5`.
- **Uniforms** (`:38-52`): `uTime`, `uReveal`, `uBrillo`, `uDensidad`, `uTwinkle`, `uPan`, `uTinteHorizonte`
  (`#1A2E73`), `uCapas` (3), `uTope`, `uCobertura`, `uFondo` (`#0A0812`), `uCobRapida`, `uModoZ32`.
- **Visibilidad:** `uReveal` depende de la distancia a la luz lejana (0 en el spawn, 1 bajo la luz).
  - Con el visualizador o las secuencias se multiplica por `ESTRELLAS_ATENUAR_EN_VISUALIZADOR = 0,15` (`:141-153`).
  - No se dibuja con `uReveal < 0,002` (`:194-195`).
- En la sala, durante el amanecer, la cuenta da que no se dibuja (reveal ≈ 0). **Sin verificar.**

### 2.5 Fondo de escena y niebla ❌ amanecer · ❌ música
- `components/ThreeScene.tsx:490-492`: fondo `#0A0812`; `fogExp2` `#0B0A14`, densidad 0,015 (`DBG_RETRO_FX.fogDensity`).
- No cambian.

### 2.6 Luces ambientales y direccionales ❌ amanecer · ❌ música
- `ThreeScene.tsx:493-499`: `ambientLight` 0,02 y `hemisphereLight` cielo `#1A2330` / suelo `#0D0A12` a 0,25
  (`debugConfig.ts:40-42`).
- `DiagonalSpot` (`ThreeScene.tsx:162-178`): SpotLight en (9, 18, 10), intensidad `DBG_SPOTLIGHT.intensity × globalLightScale`.
- No hay luz direccional ni luz del sol. Nada de esto cambia con el amanecer.

### 2.7 Suelo ❌ amanecer · ❌ música
- `ThreeScene.tsx:124-132`: con el visualizador activo se ve el disco de r = 28, `meshStandardMaterial #0D0D0F`, rugosidad 0,95.
- Las paredes y el techo se ocultan (`:111-121`).
- El shader del domo tiene alfa 0 bajo el horizonte (`dome.frag.glsl:342`): el piso real se ve a través.
- El piso no cambia con el amanecer: solo lo iluminan las luces fijas y los SpotLights de los haces.

### 2.8 Montañas y horizonte
- Las montañas existen solo dentro del shader del domo:
  - la cordillera que rodea (2 capas planas `#22303A` y `#191A22`, `dome.frag.glsl:237-242`, crecen con `uDawn`);
  - las montañas de la imagen del portal (texturas `portal-masks.png` / `portal-color.png`, `:296-315`).
- No hay geometría de montañas ni un plano de horizonte aparte. El horizonte es el corte de alfa del domo en `d.y ≈ 0` (`:342`).

### 2.9 Sol / disco
- Solo dentro del portal (3 discos: rojo, crema y amarillo, `dome.frag.glsl:254-264`). Sube 0,8 unidades del portal durante la fase 1.
- La esfera emisiva vieja y su halo están apagados (`SUN_SPHERE_ENABLED = false`, `DomeVisualizer.tsx:25`).

### 2.10 Nubes
- Solo dentro del portal: 2 nubes naranjas y 3 crema, formas fijas que se desplazan con `sin(t·0,05)`
  (`dome.frag.glsl:266-279`).
- Música: escala `1 + 0,08·cielo`. Amanecer: aparecen con el portal (`uDawn`); no tienen fase propia.

### 2.11 Monolitos ⚠ amanecer (apagado) · ❌ música
- `components/Monoliths.tsx`: obsidiana `MeshPhysicalMaterial` con envMap procedural "pre-dawn" (`:254`), más 2 SpotLights (`:520-521`).
- Al `dawn-complete` capturarían el reflejo con un CubeCamera (`:449-475`), pero está apagado por defecto (`MONOLITOS_CAPTURA = false`).
- No leen bandas de audio.
- La cercanía al monolito izquierdo mueve `uRemoteMix` / `uStaticMix` de la esfera PANORAMA, que hoy es invisible.

### 2.12 Haces (HazSystem) ❌ amanecer · ⚠ música (solo destello)
- `components/HazSystem.tsx`: 4 SpotLights reales (`:159-167`, `:301-310`), intensidad `hazSpotIntensity 40 × globalLightScale 0,55`.
- Colores: `#7FEFE6`, `#34F28A`, `#FFD21A`, `#FF1A1A` (`debugConfig.ts:377-380`).
- Al encender o apagar tienen un destello (U6B). No reaccionan a las bandas.
- El cono a franjas y la lámpara viejos están ocultos (`DBG_LUCES.DISENO_NUEVO`).
- Abren las compuertas de audio y disparan el amanecer.

### 2.13 Halo, cono y charco de las 4 luces (LucesHaz, Z42) ❌ amanecer · ✅ música
- `components/LucesHaz.tsx`. Energía `normEnergy[assignment[i]]` solo con la luz encendida, con ataque de 0,05 s y caída
  de 0,30 s (`:102-133`).
- Ganancias (`debugConfig.ts:923-926`):
  - brillo del halo × (1 + 1,2·e);
  - tamaño del halo × (1 + 0,6·e);
  - opacidad de cono y charco × (1 + 1,3·e);
  - radio × (1 + 0,25·e).

### 2.14 Símbolos del piso (SymbolSystem) ❌ amanecer · ✅ música
- `components/SymbolSystem.tsx:123-125`: `uEnergy = BAND_STATE.energy[assignment[i]]` (energía cruda, sin AGC) y
  `uBoost = hazOnBoost` si la compuerta está abierta.

### 2.15 Paneles (60 proyectos) ❌ amanecer · ❌ música
- `components/ExperienceDome.tsx`. Con el visualizador activo se ocultan (al interactuar con el prisma). No leen ni el amanecer ni las bandas.

### 2.16 Caparazón del domo (domo-cascaron) ❌ amanecer · ❌ música
- `ExperienceDome.tsx:945-958`: SHELL_FRAG, color base `#010003`.
- Con el visualizador su opacidad baja a 0 (`domeShellOpacity = 0`, `:882-886`), pero sigue visible (`visible = !vizHideShell`).
- Tiene un arcoíris del prisma (loop de 7 haces si `uRainbow ≥ 0,005`, `:526-540`).

### 2.17 Prisma (fractal, Z43–Z45) ❌ amanecer · ✅ música
- No es cielo. Reacciona a las bandas solo con el visualizador activo y el usuario cerca.

---

## 3) Lo que NO reacciona

**Estáticos durante el amanecer:**

| Elemento | Parámetros ya disponibles para animarlo |
|---|---|
| Fondo de escena `#0A0812` y niebla `#0B0A14` | `scene.background`, `scene.fog.color`, `fog.density` |
| `hemisphereLight` (cielo, suelo, intensidad) y `ambientLight` | `color`, `groundColor`, `intensity` (sin recompilar si no se agregan ni quitan luces) |
| DiagonalSpot | `intensity`, `color` |
| SpotLights de los haces | `intensity`, `color` (los escribe HazSystem cada frame) |
| Piso (disco r = 28) | `color` / `emissive` del `meshStandardMaterial` |
| Monolitos | `envMapIntensity`, `uObsRimIntensity`, `uObsDesaturation`, `uObsVeinBright` (`Monoliths.tsx:42-50`); captura `MONOLITOS_CAPTURA` |
| Halo, cono y charco de las luces (LucesHaz) | `uColor`, `uOpacidad`, escala del halo |
| CieloEstrellado | `uReveal`, `uBrillo`, `uTinteHorizonte`, `uFondo` |
| Caparazón del domo | `uShellOpacity` |
| Post-proceso | `renderer.toneMappingExposure` (0,8), bloom (`strength`, `threshold`), CRT (`uTint`, `uLift`, `uVig`) |
| Dentro de DomeSky | Los colores de `worldSky()` y `skyRamp()` son constantes; solo se mezclan con `uDawn`. No hay uniform de color ni de posición del horizonte o del sol del mundo. |

**Sin música:**
- fondo, niebla, luces ambientales, DiagonalSpot y SpotLights de los haces;
- piso, monolitos, CieloEstrellado, caparazón y paneles;
- dentro del domo: el degradado `worldSky()` del mundo y la cordillera.

Uniforms existentes que podrían recibir música sin tocar el shader:
- en DomeSky: `uWarp` y `uStarCut` (hoy los escribe el menú);
- en CieloEstrellado: `uBrillo` y `uTwinkle`;
- en los monolitos: `uObs*`.

---

## 4) Colores (noche → amanecer completo)

Todos en sRGB (el shader del domo escribe sRGB directo; ver CLAUDE.md).

| Capa | Noche (`uDawn = 0`) | Amanecer completo (`uDawn = 1`) | Dónde se interpola |
|---|---|---|---|
| Cielo del mundo (fuera del portal) | `#060509` (`nightSky`) | Degradado: horizonte `#CC5C24` → medio `#4D1F24` → cénit `#130A17`, × (0,75…1,0) por fbm; bajo el horizonte `#0A090D` | `dome.frag.glsl:209` (`mix` por `uDawn`); degradado en `worldSky()` `:169-179` |
| Cielo del portal | (invisible: se ve el cielo del mundo) | 8 paradas de `skyRamp()`: tope `#7A3A35`, `#8F423C`, `#BF5037`, `#D55D2F`, `#E88B2E`, `#EC8A28`, `#EBA22E`, horizonte `#F3B230` | `:289` (`inside·uDawn`); rampa `:149-166` |
| Sol (portal) | Desplazado hacia abajo, mismo color | Anillo rojo `#E55C29` → `#E4322B`; crema `#F8EAD8` → `#E5C7A3`; disco amarillo `#FEBD17`; brillo `(0,9; 0,35; 0,1)·0,22` | Posición `:255-257` (por `uDawn`); colores fijos `:258-264` |
| Nubes (portal) | Invisibles | Naranja `#F09E33` (85 %) y crema `#F4E9D4` | Con el portal `:289` |
| Cordillera lejana | Altura 0 (oculta) | `#22303A` | `:237, 241` (altura y opacidad × `uDawn`) |
| Cordillera cercana | Altura 0 (oculta) | `#191A22` | `:238, 242` |
| Siluetas de la imagen | Ocultas | `#191A22` | `:315` (× `uDawn`) |
| Anillos del túnel | Ocultos | Oscuro `#21120D` → `#5C2E1C`; dorado `#A36330` → `#E58C2E`; rojo `#D64F30` | `:225-232` (× `uReveal.z`, fase 2) |
| Estrellas del mundo y del portal | Ocultas | `(1,0; 0,92; 0,80)` y `(1,0; 0,95; 0,85)` | `:212, 283` (× `uReveal.w`, fase 2) |
| Panorama cálido (invisible hoy) | Oscuro: cénit `#0A0812`, horizonte `#1B1426` | Cénit `#B5432A`, medio `#E2702A`, horizonte `#F5B83A` | `DomeVisualizer.tsx:296-316` (`uDawnSkyT`) |
| Fondo / niebla / hemisférica / piso | `#0A0812` / `#0B0A14` / `#1A2330` y `#0D0A12` / `#0D0D0F` | Igual | No se interpolan |

---

## 5) Qué falta para que se lea como un amanecer real (hechos del código)

1. **El cielo del mundo no tiene dirección.** `worldSky()` depende solo de la altura (`d.y`) y de fbm
   (`dome.frag.glsl:169-179`): el resplandor del horizonte es igual en los 360°. No es más claro hacia el sol.
2. **El degradado no "sube".** Todo el cielo del mundo pasa de `nightSky` a `worldSky` con un solo `mix` uniforme
   (`:209`); no hay un frente de luz que avance desde el horizonte (el panorama viejo sí lo tenía con `skyEdge`).
3. **El sol existe solo dentro del portal** y sube 0,8 unidades del portal (`:255`). Fuera del portal no hay disco de
   sol ni dirección de sol en el mundo.
4. **Las estrellas aparecen con el amanecer en vez de apagarse.** Las del mundo y las del portal entran con
   `uReveal.w` en la fase 2 (`:212, 283`), a los 14–17 s. Antes del amanecer no hay estrellas en el domo.
5. **La iluminación de la escena no acompaña.** Fondo, niebla, hemisférica, ambiente, DiagonalSpot, piso y SpotLights
   no cambian (§3); el piso y los objetos siguen con luz de noche bajo un cielo cálido.
6. **No hay luz direccional ni luz del sol** que proyecte sombras o tiña la escena.
7. **La cordillera "crece" desde el horizonte** (altura × `uDawn`, `:237-238`) en lugar de existir de noche como
   silueta y aclararse.
8. **La exposición y el post-proceso no cambian** (`toneMappingExposure` fijo 0,8; bloom y CRT fijos).
9. **El cielo estrellado de la sala no participa** (reveal ≈ 0 en la sala y × 0,15 durante el visualizador).
   Sin verificar.
10. **Los monolitos no reflejan el amanecer** (captura apagada por un artefacto de 1–3 s; envMap fijo "pre-dawn").
11. **La curva es una sola.** `easeOut3` en 10 s: arranca rápido y frena; no hay etapas distintas (azul de antes
    del alba, rosa, dorado).
12. Detalle técnico: `uBands` de DomeSky siempre vale 0 (`_zeroBands`) y el shader no lo usa.

---

## 6) Costos

Activos a la vez durante el amanecer (SILLAS, visualizador activo, valores por defecto):

| # | Shader | Cobertura | Costo por píxel (lectura del código) |
|---|---|---|---|
| 1 | **DomeSky** (`dome.frag.glsl`) en "domo-cielo" | Casi toda la pantalla sobre el horizonte | **El más caro.** En todo el domo: 6 `fbm4` (1 en `worldSky`, 5 en el marco: `wob`, `wob2`, `thick`, `hv`, `redw`) + 1 capa de estrellas con hash. Dentro del portal además: `warpField` (2 `fbm4`, 2 `fbm6` (o 2 `fbm4` con `LOW_QUALITY`) y 1 `fbm4`), 1 `fbm4` del sol, 5 `cloudShape`, otra capa de estrellas, 2–3 lecturas de textura. Cada `fbm4` = 4 productos de senos; `fbm6` = 6. |
| 2 | PANORAMA_FRAG (esfera, `DomeVisualizer.tsx`) | Toda la esfera | Barato por píxel, pero se dibuja con alfa 0: es una pasada de pantalla completa que no se ve. Sin verificar si three la descarta (no lo hace por alfa). |
| 3 | SHELL_FRAG (caparazón) | Toda la semiesfera | Barato si `uRainbow < 0,005`; con arcoíris, loop de 7 haces. Opacidad 0 pero visible. |
| 4 | CieloEstrellado | Pantalla completa (plano lejano) | 1–3 capas de estrellas; no se dibuja con reveal ≈ 0. Sin verificar en la sala. |

Además, fuera del cielo y en pantalla completa: bloom (UnrealBloomPass, varias resoluciones), CRT y OutputPass
(`RetroPostFX.tsx`). Elementos chicos: halos, conos y charcos de LucesHaz, símbolos, anillos de los haces y el
fractal del prisma (Z45, en textura) si el usuario está cerca.

**En total: 3 pasadas de cielo a pantalla completa por frame** (DomeSky, la esfera PANORAMA invisible y el caparazón
invisible), más la del cielo estrellado si se revelara. FPS reales: sin verificar.

---

## 7) Datos de música

- **Analizador único:** `lib/vizAudio.ts`. El audio pasa por 4 cadenas de filtros biquad de 2.º orden
  (`BAND_DEFS`, `:252-256`); cada cadena tiene un `AnalyserNode` (fftSize 256) antes de su compuerta de ganancia.
  - Banda 0: < 80 Hz (graves).
  - Banda 1: 80–250 Hz (kick).
  - Banda 2: 250 Hz – 4 kHz (medios).
  - Banda 3: > 4 kHz (agudos).
  - Las compuertas suenan solo con la luz correspondiente encendida, pero el análisis es previo a la compuerta.
- **Además:** `_vizAnalyser` (fftSize 256) con espectro de 8 bandas en `getVizBands()` (`:467-497`): `sub` (20–60),
  `bass` (60–250), `lowMid` (250–500), `mid` (500–2 k), `highMid` (2–4 k), `presence` (4–6 k), `brilliance` (6–12 k),
  `air` (12–20 k), más `rms` y `beat`.
- **Frecuencia de actualización:** una vez por frame, cuando DomeVisualizer llama a `getVizBands()`
  (`DomeVisualizer.tsx:738`). `getVizBands()` actualiza también `BAND_STATE` (`_updateBandEnergy`, `vizAudio.ts:122-176`).
  - Solo corre con el visualizador montado.
  - RMS de cada banda sobre 256 muestras, con ataque de 40 ms y caída de 200 ms.
  - AGC (`debugConfig.ts:460-465`): piso y techo adaptativos, exponente 0,6, ataque 40 ms, caída 220 ms.
  - Kick: banda 1 sube × 1,4 y supera 0,05, con 150 ms refractarios; emite `alight:kick`.
- **Disponibles para el cielo sin crear otro analizador** (`BAND_STATE`, `vizAudio.ts:42-49`):

| Campo | Qué es |
|---|---|
| `energy[4]` | RMS suavizado por banda, sin normalizar |
| `normEnergy[4]` | 0–1 con AGC, el que usan el domo, las luces y el prisma |
| `gateOpen[4]` | Estado de las compuertas |
| `assignment[4]` | Luz o grupo → banda; aleatorio por carga (`shuffleArray`, `:331`) |
| `domeEnergy` | Máximo de las bandas con compuerta abierta |
| `kick` | `true` un frame |

  También el espectro de 8 bandas que devuelve `getVizBands()`: hoy solo lo consume el shader de login apagado. Llamarlo
  una segunda vez por frame actualizaría dos veces las bandas: para leerlo hay que guardarlo, no volver a llamarlo.
