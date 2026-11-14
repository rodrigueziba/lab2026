# Informes finales de Z41 a Z46 (recuperados)

Recuperados el 2026-11-14 de la transcripción de sesión de Claude Code de este proyecto:
`~/.claude/projects/-Users-ezequielibarra-lab2026-lab2026/be1ef86a-ad10-4e1a-97e0-2bb606eb1fb2.jsonl`.

- Los seis informes son **originales**, copiados tal cual (ninguno es reconstruido).
- Para cada tarea se tomó el último mensaje del asistente después del prompt "Tarea Zxx".
- El de Z44 se entregó después de la pregunta "terminaste el ultimo prompt?".
- Las seis tareas se ejecutaron.

Notas de contexto (no forman parte de los informes):

- **Rutas de capturas:** las rutas a `/private/tmp/.../scratchpad/...` que mencionan los informes eran archivos temporales. El scratchpad se vació una vez entre sesiones, así que algunas capturas pueden no existir más.
- **Valores cambiados después:** algunos valores se modificaron en tareas posteriores. Por ejemplo, el encuadre del portal y el sol cambiaron en Z48 a Z50, y `DBG_PORTAL.ESCALA` quedó en 1,625. Los informes describen el estado al terminar cada tarea.
- **Commits de seguridad tomados antes de cada tarea:**
  - Z41: `85216f2`
  - Z42: `c6b3945`
  - Z43: `adff9de`
  - Z44: `c8c3e28`
  - Z45: `bb3720a`
  - Z46: `8361c87`
- **Dónde quedó el trabajo de cada tarea:** en el commit de seguridad siguiente. El de Z46 está en `24d4754`.

---

# Z41: sillas, zona SILLAS, público sentado y monolitos (DBG_LAYOUT)

*Original: transcripción, línea 6841, 2026-11-12T02:00:01.600Z (UTC).*

## Z41: sillas, zona SILLAS, público y monolitos reubicados

Las sillas, la zona SILLAS y el público están 4 m más atrás, y cada monolito está 3 m más lejos de la tarima. Los dos deslizadores funcionan en vivo y, con el flag apagado, vuelve todo exactamente a las posiciones anteriores. `tsc` no da errores, lint quedó igual que la línea base (221 / 184) y el build con webpack pasa. Pruebas en Node: layout 25 OK, checkpoints 21 OK, reloj 14 OK, amanecer 16 OK e `ink:test` 52 OK.

Commit de seguridad: `85216f2`. Después no hice commits.

**Corregí un error previo que no es de Z41:** en [hooks/useFaceTracking.ts:95](frontend/hooks/useFaceTracking.ts#L95), `close()` de MediaPipe no devuelve una promesa y el `.catch` hacía caer todo el árbol de React. Pasaba al desmontar `Audience` con la webcam ya iniciada. En la práctica, cualquier checkpoint que saliera de TARIMA dejaba la escena vacía y sin menú. Lo reproduje en Chrome headless con una webcam simulada. Con la corrección, TARIMA → exploración → inicio salta sin errores. Está fuera de lo pedido, pero bloqueaba la prueba de checkpoints.

### Paso 1: relevamiento (antes de editar)
- **Sillas:** 6 en una sola fila, en x = −2,5 a 2,5 cada 1 m, z = −3. El respaldo queda hacia −Z, así que miran a +Z, hacia la tarima. Asiento a 0,44 m (superficie a 0,465 m).
- **ZONA_SILLAS:** (0, 1,6, −6), radio 2,5. Está 3 m detrás de la fila.
- **ZONA_LUZ (tarima):** (0, 1,6, 0), radio 2,5. La tarima está centrada en el origen.
- **Público** ([Audience.tsx](frontend/components/Audience.tsx)): entra caminando desde z = −20 hasta el asiento, gira π para mirar a la tarima y baja la raíz a `SIT_ROOT` = −0,255, con la cadera en 0,78.
  - **Respuesta a tu pregunta:** las posiciones estaban **a medias**. La z venía de las sillas (`CHAIR_Z` importado), pero las x estaban duplicadas a mano (`CHAIR_X`).
- **Monolitos:** en (±3,75, 0), con `monolithDistM` = 3,75. El aro del piso (radio 1,2), la base, la placa, la pantalla y el spot quedaban en ±dist. La captura del reflejo se toma en el origen.
- **4 haces:** a 15 m del origen en las diagonales: (±10,6, ±10,6).

### Pasos 2 a 5: posiciones viejas y nuevas
| Elemento | Antes | Ahora (default) |
|---|---|---|
| Sillas (fila) | z = −3 | z = −7 (misma x, espaciado y orientación) |
| ZONA_SILLAS | (0, −6) | (0, −10); sigue 3 m detrás de la fila |
| Entrada del público | z = −20 | z = −24; camina los mismos 17 m |
| Público sentado | asiento z = −3 | asiento z = −7 (cadera y frente sin cambios) |
| Monolitos (con aro, base, placa, pantalla y luces) | (±3,75, 0) | (±6,75, 0) |
| Prisma, tarima, ZONA_LUZ, haces, spawn, telón | — | sin cambios |

- **Dirección del desplazamiento:** el de las sillas se calcula como centro de la tarima → centro de la fila, que hoy da (0, −1). El de los monolitos es radial desde el centro de la tarima, sumado a `monolithDistM`.
- **Cercanía a las luces:** ningún haz queda superpuesto ni cerca. El más cercano está a 11,3 m de un monolito (antes 12,6). Si se gira el piso con `rotationDeg`, el peor caso es 8,25 m.

### Sistemas que dependían de las sillas o las zonas
- **`Audience`:** asiento y entrada salen ahora de [lib/layoutSala.ts](frontend/lib/layoutSala.ts), las mismas constantes que usa `Chairs`. También siguen a la silla después de sentarse, por si movés el deslizador.
- **Zona del Player en `ThreeScene`:** se recalcula cada frame sin allocations. Los radios ahora salen de constantes.
- **Proximidad de los monolitos** (el cruce de audio de `vizAudio`): ahora se mide a la posición real de cada monolito.
- **Checkpoints de Z40:** `irASillas`, `irATarima` y `premio` ya no usan números sueltos. Usan la zona y el centro de la fila.
- **Lo revisé y no depende:** `LecternSystem` y los atriles, `FaceDome`, `WatcherEye`, `DynamicLights`, `PisoIconos`, los haces y `ArteInteractiva` (no está montado en `/alight`).

### Validación
- **Node** (`node scripts/layout-test.mjs`): sillas, zona, público y monolitos con offset 0 y con 4. Las 6 personas quedan en el centro de su asiento (desvío 0). Todo cae dentro de ±39,5 m (el máximo es |z| = 24). Con el flag apagado vuelven exactamente las posiciones anteriores.
- **Chrome headless (SwiftShader), posiciones leídas de la escena:**
  - Sillas en z = −7,00 y muslos del público a 0,51 m sobre cada asiento (a 0,465), igual que antes. Con el deslizador en 0, todo vuelve a z = −3.
  - **Zona:** la vieja (0, −6) ya no dispara; a 2,6 m de la nueva no dispara; a 2,4 m dispara un solo `chose-chairs`.
  - **Checkpoints:**
    - `sillas_prisma` coloca la cámara en (0, −10).
    - `visualizador` deja los monolitos en ±6,75 con eventos únicos.
    - `tarima` funciona.
  - **Deslizador de monolitos en 6:** quedan en ±9,75. Con `POSICIONES_NUEVAS` apagado vuelven a ±3,75.
- **Límites:** nada nuevo queda fuera de la sala. Las piezas del camino SILLAS están dentro del disco del domo (radio 28); la entrada del público en z = −24 queda fuera de él, pero solo existe en TARIMA. Nada se acerca al cielo ni a la niebla del camino LUZ.
- **Capturas:** en `/private/tmp/claude-501/-Users-ezequielibarra-lab2026-lab2026/be1ef86a-ad10-4e1a-97e0-2bb606eb1fb2/scratchpad/` (archivos `z41_*.png`).
  - El verde de fondo en las de TARIMA es la webcam simulada.
  - **Límite:** para ubicar la cámara usé un gancho de prueba desde la consola, porque en headless no hay pointer lock. No es una caminata real.

### Decisiones para revisar
- **La zona SILLAS ahora está fuera del camino natural.** Queda a 8,2 m del eje telón → tarima (antes 4,9). Es la consecuencia directa de "mismo vector que las sillas"; hay que caminar hacia ella a propósito.
- **Desde la zona nueva se ve todo más lejos.** El usuario queda sentado unos 4 m más lejos del prisma y de los paneles mientras baja el prisma.
- **La entrada del público también se corrió 4 m,** para que caminen la misma distancia en el mismo tiempo.
- **La captura del reflejo de los monolitos sigue tomándose en el origen.** Está apagada por defecto desde Z40.
- **Bug previo arreglado de paso:** la banda de franjas del respaldo ahora cuelga de cada silla. Antes se agregaba con coordenadas absolutas y en modo estricto podía no aparecer.

### Archivos
- **Nuevos:** [lib/layoutSala.ts](frontend/lib/layoutSala.ts) y [scripts/layout-test.mjs](frontend/scripts/layout-test.mjs).
- **Editados:**
  - [Chairs.tsx](frontend/components/Chairs.tsx)
  - [Audience.tsx](frontend/components/Audience.tsx)
  - [Monoliths.tsx](frontend/components/Monoliths.tsx)
  - [ThreeScene.tsx](frontend/components/ThreeScene.tsx)
  - [checkpointsAcciones.ts](frontend/lib/checkpointsAcciones.ts)
  - [debugConfig.ts](frontend/lib/debugConfig.ts): `DBG_LAYOUT` con `POSICIONES_NUEVAS` true, `SILLAS_OFFSET_M` 4 y `MONOLITOS_OFFSET_M` 3.
  - [DebugMenu.tsx](frontend/components/DebugMenu.tsx): sección "Layout Z41" con el flag y dos deslizadores.
  - [useFaceTracking.ts](frontend/hooks/useFaceTracking.ts)

### Qué tenés que probar
1. Caminar desde el telón hasta la zona SILLAS nueva y ver que se activa justo a 2,5 m de (0, −10).
2. El camino TARIMA con la webcam real: el público debería entrar y quedar sentado sobre las sillas nuevas.
3. Mover los dos deslizadores en vivo, con el público sentado y con el visualizador encendido, y apagar `POSICIONES_NUEVAS`.
4. Los checkpoints `sillas_prisma`, `sala_activa`, `visualizador`, `amanecer_completo`, `tarima` y `tarima_vacia`, y en especial salir de TARIMA con la webcam encendida (el caso que antes rompía la escena).

---

# Z42: diseño nuevo de las 4 luces tipo LuzLejana (DBG_LUCES)

*Original: transcripción, línea 7263, 2026-11-12T11:49:23.862Z (UTC).*

## Z42: las 4 luces del visualizador con el diseño de la luz de la narrativa

Las 4 luces se dibujan ahora con halo con scanlines, cono suave y charco en el piso, cada una en su color y sin carcasa, cable ni cono a franjas. El comportamiento no cambió. La luz de la narrativa se ve igual que antes; lo comparé con capturas. `tsc` no da errores, lint quedó igual que la línea base (221 / 184) y el build con webpack pasa. Pruebas en Node: layout 25 OK, checkpoints 21 OK, amanecer 16 OK, reloj 14 OK e `ink:test` 52 OK.

Commit de seguridad: `c6b3945`. Incluye los cambios de Z41, que estaban sin commitear. Después no hice commits.

### 1. Relevamiento
- **Cómo estaban hechas:** [HazSystem.tsx](frontend/components/HazSystem.tsx) armaba cada luz por código: una SpotLight real, una carcasa gris carbón, un cable de 10 m, un LED ámbar y una franja retro. El cono era un shader de fresnel con franjas horizontales que suben; eso es lo que se veía como "espiral".
- **Anillos del piso:** [HazRings.tsx](frontend/components/HazRings.tsx) dibuja los anillos que se expanden en el piso al cambiar una luz.
- **Posiciones** ([lib/haz.ts](frontend/lib/haz.ts)): a 15 m del centro, en las diagonales: (10,6, −10,6), (10,6, 10,6), (−10,6, 10,6) y (−10,6, −10,6). Altura del haz 2,4 m, radio en el piso 1,05 m.
- **Colores** (`DBG_SILLAS.hazColor0…3`), son la paleta "neón" del brief de estilo:

  | Luz | Color | Grupo del domo |
  |---|---|---|
  | 0 | cian `#7FEFE6` | SOL |
  | 1 | verde `#34F28A` | MONTAÑAS |
  | 2 | amarillo `#FFD21A` | CIELO |
  | 3 | rojo `#FF1A1A` | LÍNEAS |

- **Activación:** al entrar a 1 m de una luz (sale a 1,1 m, con 800 ms de espera entre cambios) se alterna su estado encendida/apagada y se emite `alight:haz-toggle`.
  - Ese evento abre o cierra la compuerta de audio y arranca la música.
  - La primera luz que se enciende dispara el amanecer.
  - También lo escuchan los anillos y el sacudón de cámara.
- **Música:** las lámparas viejas **no reaccionaban a las bandas**. Solo el cono se veía un 35 % más brillante encendido (`hazOnBoost`) y destellaba al cambiar de estado. La reacción a la música estaba en el domo y en los símbolos del piso.

### 2. Qué cambió
- **Shaders compartidos:** el halo, el cono y el charco pasaron sin cambios de [LuzLejana.tsx](frontend/components/LuzLejana.tsx) a [lib/luz/luzVisual.ts](frontend/lib/luz/luzVisual.ts). Verifiqué con un script que el texto de los shaders es idéntico. Comparando capturas antes y después de la luz de la narrativa, la diferencia media es 0,7 sobre 255, el mismo nivel que el grano y el titileo de las estrellas.
- **Componente nuevo:** [LucesHaz.tsx](frontend/components/LucesHaz.tsx) dibuja las 4 luces. El halo usa una variante blanca del mismo degradé, teñida con el color de cada luz.
- **Diseño viejo:** HazSystem oculta la carcasa, el cable, el LED, la franja y el cono viejo solo cuando `DBG_LUCES.DISENO_NUEVO` está encendido. No se borró nada.
- **Sin luces nuevas:** no agregué luces reales. Las 4 SpotLights que ya existían siguen igual, así que no se recompilan materiales.
- **Sin allocations por frame:** sumé `hazPosXZEn` en `lib/haz.ts` para leer las posiciones sin crear objetos.
- **Orden de dibujo:** las luces usan renderOrder 10, igual que la luz de la narrativa, sin escribir profundidad. En las capturas, el monolito y el prisma tapan correctamente las luces que quedan detrás.

### 3. Qué se conservó idéntico
- Las posiciones, la activación al pasar, el evento `alight:haz-toggle`, el audio, el amanecer y los anillos.
- El destello al cambiar de estado, con la misma curva que el cono anterior.
- **Apagada:** halo tenue (brillo 0,35) y cono y charco al 25 %. Se ve dónde está la luz sin que parezca encendida.
- **Música:** cada luz lee la energía de su propia banda, la misma que su grupo del domo, y solo cuando está encendida. Esa energía sube el brillo y el tamaño del halo y la opacidad y el radio del cono y del charco.
  - Lo medí con la música simulada del menú debug (`sim0…3`): cada banda iluminó solo su luz.
  - Luz 0: brillo +30. Luz 1: +21. Luz 2: +26. Luz 3: +11. Las demás quedaron igual dentro del ruido.

### 4. Valores nuevos (`DBG_LUCES`, sección "Luces del visualizador Z42" del menú Shift)
- `DISENO_NUEVO` true. Halo 1,8 m. Radio del cono 1,05 m. Cono 0,22 y charco 0,35 (los mismos de la narrativa).
- Brillo del halo: 1,6 encendida, 0,35 apagada. Cono y charco apagados ×0,25.
- Reacción a la música: brillo ×1,2, tamaño ×0,6, cono ×1,3, radio ×0,25. Subida 0,05 s y bajada 0,30 s.
- Multiplicadores por luz (halo, radio, cono y charco), con valor inicial 1.

### Decisiones para revisar
- **Sin franjas ni marca:** las luces ya no tienen la franja de marca que el brief pide en todo objeto. Las traté como la luz de la narrativa: una luz, no un aparato.
- **Apagada con el amanecer completo:** el halo tenue casi no se ve contra el cielo claro; se nota más el cono. Si querés que se lea mejor, subí `INT_APAGADA`.
- **Encendida de cerca:** el núcleo del halo se ve casi blanco por el bloom. El color se reconoce en el borde, el cono y el charco.

### Validación y límites
- Las capturas están en `/private/tmp/claude-501/-Users-ezequielibarra-lab2026-lab2026/be1ef86a-ad10-4e1a-97e0-2bb606eb1fb2/scratchpad/`:
  - `z42antes_*` (antes) y `z42_*` (después);
  - apagadas y encendidas, de lejos y de cerca, antes del amanecer y con el amanecer completo;
  - música por banda, orden de dibujo y diseño viejo con el flag apagado.
- **Cómo las saqué:** Chrome headless con render por software (SwiftShader), así que los FPS (8 a 10) no sirven como medida de rendimiento.
- **Música:** no probé con audio real; la reacción la validé con la música simulada.
- **Encendido de las luces:** las encendí moviendo la cámara de prueba sobre cada una, que es el mismo camino que caminar.

### Archivos
- **Nuevos:** [lib/luz/luzVisual.ts](frontend/lib/luz/luzVisual.ts) y [components/LucesHaz.tsx](frontend/components/LucesHaz.tsx).
- **Editados:**
  - [LuzLejana.tsx](frontend/components/LuzLejana.tsx): ahora importa los shaders compartidos.
  - [HazSystem.tsx](frontend/components/HazSystem.tsx): oculta lo visual viejo con el flag.
  - [ExperienceDome.tsx](frontend/components/ExperienceDome.tsx): monta `LucesHaz`.
  - [lib/haz.ts](frontend/lib/haz.ts): `hazPosXZEn`.
  - [debugConfig.ts](frontend/lib/debugConfig.ts): `DBG_LUCES`.
  - [DebugMenu.tsx](frontend/components/DebugMenu.tsx): sección nueva.

### Qué tenés que probar
1. Pasar por cada luz y ver que activa su banda (su grupo del domo reacciona), que destella y que, al volver a pasar, queda tenue.
2. Compararlas con la luz de la narrativa y confirmar que tienen el mismo estilo.
3. Con música real, ver que cada luz pulsa con su grupo del domo.
4. Medir FPS en la PC de la muestra con `DISENO_NUEVO` encendido y apagado.

---

# Z43: fractal nuevo del prisma, jungle fractal II (DBG_FRACTAL)

*Original: transcripción, línea 7502, 2026-11-13T01:04:47.905Z (UTC).*

## Z43: fractal nuevo en las caras del prisma

El fractal de las caras ahora es la adaptación de "jungle fractal II", pintada en amarillo y naranja. Aparece de a poco al acercarse y se acelera cuanto más cerca está el usuario. Con `DBG_FRACTAL.DISENO_NUEVO` en false vuelve exactamente el anterior. `tsc` no da errores, lint quedó igual que la línea base (221 / 184) y el build con webpack pasa. Pruebas en Node: fractal 28 OK, layout 25 OK, checkpoints 21 OK, amanecer 16 OK y reloj 14 OK.

Commit de seguridad: `adff9de`, que incluye lo de Z42. Después no hice commits.

**Hay algo que tenés que decidir:** el fractal anterior **no era amarillo y naranja fijo**. Su tono gira con el tiempo (`hue + uTime·speed·0,04`). Lo medí replicándolo en Node: a los 0 s domina el magenta-rojo, a los 30 s el cian, a los 60 s el rojo-naranja. En la captura de "antes" salió cian, verde y violeta. Para el diseño nuevo usé una paleta fija amarilla y naranja tomada de ese mismo shader, porque es como lo describiste:
- `#EE882B` es `hsl(0,08; 0,85; 0,55)`;
- `#EEB72B` es `hsl(0,12; 0,85; 0,55)`;
- el oscuro `#1C1005` es el naranja × 0,12.

Si en realidad querés que el color siga girando, decímelo.

### Paso 1: cómo era antes
- **Dónde:** [Prism.tsx](frontend/components/Prism.tsx), etiqueta S2. Es una capa encima del vidrio: un cono de 3 lados (1,01 × 1,81 m) con un `ShaderMaterial` transparente, sin `depthWrite`, de doble cara, `renderOrder` 0.
- **Shader:** un conjunto de Julia de 48 iteraciones con "orbit trap" y color HSL que gira con el tiempo. La parte oscura es donde el trap es chico, que además es casi transparente.
- **Uniforms:** `uProximity` y `uTime` (`clock.elapsedTime`).
- **Cercanía:** la distancia 3D del ojo al centro del prisma, lineal entre `DBG_PRISM.nearM` 5 m y `maxEffectM` 0,3 m, y solo después del aterrizaje. Se suaviza con un lerp de 0,04 por frame, que depende de los fps.
- **Qué cambia con la cercanía:** la opacidad (hasta 0,8), el brillo (×(1 + 2,5·p)), la velocidad (0,3 + 2·p) y la deformación de la constante c.
  - Defecto que encontré: el ojo nunca baja de 0,39 m del centro, así que el máximo real era 0,98.
  - Defecto que encontré: `uTime · speed` hacía saltar la animación al cambiar la velocidad.
- **Música:** no reaccionaba.
- **Prisma:**
  - Vidrio (`MeshPhysicalMaterial`): `#cce4ff`, emisivo `#0a1a3a` × 0,35, transmisión 0,92, rugosidad 0,01, grosor 2,5, IOR 1,60, opacidad que baja a 0,35 cuando el usuario está cerca.
  - Brillo exterior: `#4488cc`, opacidad 0,07 (hasta 0,42 de cerca), cara trasera.
- **Las caras:** son 3 caras laterales más la base. El UV del cono daba una sola vuelta alrededor de las 3 caras, así que la imagen quedaba estirada y cortada entre ellas.

### Pasos 2 a 7: qué cambió
- **Shader** ([lib/prisma/fractalJungla.glsl.ts](frontend/lib/prisma/fractalJungla.glsl.ts)):
  - Sin `iTime`, `iResolution`, `gl_FragCoord` ni `mainImage`. `K`, `Ko` y `JITTER` están al inicio y se usa `.x` y `.y`.
  - Divisiones protegidas con épsilon, y un corte extra si `c` crece sin pasar el bailout (evita inf y NaN).
  - El `smoothstep(d.x, .1, .7)` del original tiene los bordes invertidos, lo que en GLSL es indefinido; lo escribí explícito.
  - Las dos regiones del original se combinan con máscaras, sin if/else. De cada una se toma solo la intensidad y se pinta con la paleta.
  - El ruido celular va detrás de un `#define`, así que apagarlo saca su costo.
- **Proporciones:** [lib/prisma/geoCarasPrisma.ts](frontend/lib/prisma/geoCarasPrisma.ts) arma una coordenada en metros sobre cada cara, con la misma escala en x y en y. En las capturas el fractal no se estira.
- **Progresión** ([lib/prisma/fractalProgresion.ts](frontend/lib/prisma/fractalProgresion.ts), puro):
  - `prox` es un smoothstep entre 5 m y 1,2 m, con la misma inercia que antes (0,04 por frame a 60 fps), ahora igual a cualquier fps.
  - El tiempo se acumula: `t += dt × velocidad(prox)`, con velocidad de 0,15 lejos a 1,5 pegado. Se congela con `PAUSA.activa`.
- **Música:** solo con el visualizador activo y `prox` > 0,15.
  - Graves (menos de 250 Hz) acercan el zoom hasta un 25 %.
  - Medios (250 Hz a 4 kHz) corren X e Y hasta 0,05.
  - Agudos (más de 4 kHz) suben el brillo hasta ×2.
  - Usa las mismas bandas que el domo (`BAND_STATE.normEnergy`), sin un analizador nuevo. Entra y sale suavizada (0,6 s) y cada banda se suaviza en 0,12 s.
- **Caras:** un solo material y un solo set de uniforms para las tres. `uSemilla` (vec4, una semilla por cara) solo tiene efecto con `CARAS_DISTINTAS`.
- **Orden de dibujo:** `renderOrder` 0 y sin escribir profundidad, como el anterior. Se ordena por distancia con los paneles y los haces; el cielo (−0,5 y −1) queda detrás y el halo de las luces (10) encima. En las capturas no tapa los paneles.
- **Costo:** cuando `prox` es casi 0 la capa no se dibuja, así que lejos del prisma no cuesta nada. La geometría se libera al desmontar.

### Valores (`DBG_FRACTAL`, sección "Fractal del prisma Z43" del menú Shift)
- **Flags:** `DISENO_NUEVO` true, `CELULAR_ON` true, `CARAS_DISTINTAS` false.
- **Distancia:**
  - `DIST_INICIO_M` 5,0: igual que `nearM`, donde hoy empieza a cambiar el material.
  - `DIST_MAX_M` 1,2: pegado a la cara (radio 1 m más la diferencia de altura entre el ojo y el centro).
  - `INERCIA_60` 0,04 y `PROX_FORZADA` −1.
- **Velocidad:** `VEL_MIN` 0,15 y `VEL_MAX` 1,5.
- **Aspecto:** opacidad 0,8 (la del anterior), opacidad de la parte oscura 0,6, brillo 1, brillo por cercanía 2,5 (el del anterior), grano 1.
- **Parámetros del original:** 16 iteraciones, zoom 2, bailout 12, X −0,7, Y 0,3, offset (0; 0,4), `depthCull` 0,1.
- **Mapeo de la cara al original:** escala 0,55 y centro (0,5; 0,28).
- **Música:** `PROX_MIN_MUSICA` 0,15; graves, medios y agudos en 0,5 cada uno; suavizado 0,12 s; entrada 0,6 s.

### Validación
- **Node** (`node scripts/fractal-test.mjs`, 28 OK):
  - `prox` crece al acercarse y da lo mismo a 30, 60 y 144 fps.
  - El tiempo no salta al cambiar la velocidad (el paso máximo es 1,5·dt).
  - La pausa congela todo y al reanudar sigue desde donde estaba.
  - `PROX_FORZADA` se aplica al instante.
  - La música no actúa sin visualizador ni lejos del prisma, entra sin saltos y se va al alejarse.
  - Las entradas NaN o infinitas no rompen nada.
- **Chrome headless (SwiftShader):**
  - Capturas a 4 distancias con `PROX_FORZADA` en 0, 0,3, 0,7 y 1, con el diseño nuevo y con el anterior, más la arista, caras distintas y sin ruido celular.
  - Caminando hacia el prisma sin forzar, `prox` subió con inercia de 0,37 a 0,80.
  - Archivos `z43_*.png` en `/private/tmp/claude-501/-Users-ezequielibarra-lab2026-lab2026/be1ef86a-ad10-4e1a-97e0-2bb606eb1fb2/scratchpad/`.
- **Lo que no pude verificar:**
  - **Música:** en headless el audio no generó energía en las bandas (`musZoom` quedó en 1), así que la reacción a la música solo la validé en Node.
  - **FPS:** con render por software dan 5 a 7 en todos los casos (nuevo con 16 o 10 iteraciones, sin ruido celular, o el anterior), así que no sirven para comparar. Hay que medirlos en una PC real.
  - **Secuencia de bajada:** no capturé el checkpoint `sillas_prisma`. El código de la bajada, el aterrizaje y `prism-landed` no se tocó, y `sala_activa` funcionó con los paneles visibles.

### Supuestos y decisiones
- La parte oscura se lee como una forma oscura con opacidad 0,6 sobre el vidrio. En el anterior era casi transparente.
- Con los parámetros originales, la región "vacía" del fractal casi no aparece, así que el fractal cubre toda la cara. El prisma se ve debajo gracias a la opacidad según la cercanía (a `prox` 0,3 se ve la tarima a través).
- **Licencia:** el original no declara licencia, así que rige la de Shadertoy por defecto: CC BY-NC-SA 3.0, no comercial. Agregué la atribución en `CREDITOS.md` y en el encabezado del archivo, con la licencia MIT de Gustavson.

### Archivos
- **Nuevos:**
  - [lib/prisma/fractalJungla.glsl.ts](frontend/lib/prisma/fractalJungla.glsl.ts)
  - [lib/prisma/fractalProgresion.ts](frontend/lib/prisma/fractalProgresion.ts)
  - [lib/prisma/geoCarasPrisma.ts](frontend/lib/prisma/geoCarasPrisma.ts)
  - [scripts/fractal-test.mjs](frontend/scripts/fractal-test.mjs)
- **Editados (todos con merge sobre lo existente):**
  - [Prism.tsx](frontend/components/Prism.tsx)
  - [debugConfig.ts](frontend/lib/debugConfig.ts)
  - [DebugMenu.tsx](frontend/components/DebugMenu.tsx)
  - [CREDITOS.md](CREDITOS.md)

### Qué tenés que probar
1. Acercarte al prisma: ver que aparece de a poco desde unos 5 m y que se acelera al llegar a 1,2 m.
2. Con el visualizador activo y música, ver que reacciona solo cuando estás cerca, y que se calma al alejarte.
3. Mirar las tres caras y las aristas: que no se estire.
4. Medir FPS pegado al prisma con 16 iteraciones, con 10 a 12, y con `CELULAR_ON` apagado.
5. Confirmar si la paleta fija amarilla y naranja es lo que querés, o si el color tiene que seguir girando como antes.
6. Revisar la secuencia SILLAS completa y el checkpoint `sillas_prisma`.

---

# Z44: colores originales del fractal

*Original: transcripción, línea 7882, 2026-11-13T17:06:59.750Z (UTC).*

Sí, Z44 está terminado. El fractal vuelve a tener los colores del original: helechos verdes, ramas negras y fondo azul grisáceo con grano. Quedó una cosa sin verificar en el navegador: el tope que agregué al final para el bloom no lo pude capturar.

- **Chequeos:** `tsc` sin errores; lint 221 / 184, sin errores nuevos; `npx next build --webpack` pasa; `fractal-test` 28 OK.
- **Commit de seguridad:** `c8c3e28` (incluye Z43). Después no hice commits.

### Por qué el fondo no se leía como el original
La escena pasa por el composer, y al final el `OutputPass` aplica ACES (exposición 0,8) y conversión a sRGB a todo el cuadro.
- El fractal escribe valores de pantalla, que el `OutputPass` trata como lineales. El resultado se aclara y se lava: el promedio del original es (39, 70, 44)/255 y sin compensar sale (75, 126, 88).
- `toneMapped: false` no sirve en este caso. Cuando three dibuja a un render target, los materiales no aplican tone mapping propio; lo aplica el `OutputPass` a todo.
- La niebla y el premultiplicado no afectan este material: el `ShaderMaterial` no tiene niebla y usa blending normal.
- El CRT (scanlines, tinte crema, lift, viñeta) y el bloom siguen actuando sobre el fractal, como sobre todo el mundo.

**Arreglo:** el shader pasa el color por la inversa de ACES + sRGB. Así, después del `OutputPass`, queda el valor de pantalla del original. La ida y vuelta medida tiene un error medio de 0,02/255. Esto se controla con `COMPENSAR_SALIDA` (2 = ACES + sRGB, 1 = solo sRGB, 0 = nada) y solo actúa si el composer está activo.

### Qué cambió
- **Colores:** las dos ramas usan las fórmulas exactas del original y el mismo `rand`. Las zonas fuera de las dos ramas son negras, como en el original. La rama de escape rápido (alfa 0,3 en Shadertoy) se ve opaca, como allá.
- **Encuadre:** `position = (uv.x, uv.y · 0,5625) − offset`, con `uv.x` de 0 a 1 a lo ancho de la base de la cara (1,75 m) y la misma escala en vertical, así que no se estira.
  - El cuadro 16:9 del original ocupa la parte baja de la cara (unos 0,98 m) y hacia la punta sigue el mismo plano del fractal.
  - La cara mide 1,88 m de alto, así que el cuadro completo no entra sin estirarse.
- **Grano:** se calcula sobre una grilla virtual de `GRANO_RES` (1280) × 720 "píxeles", como el `gl_FragCoord` del original.
- **Bordes y protecciones:** con la paleta original, épsilon 1e-6 y corte por desborde en 1e30, para no alterar píxeles respecto del original. En la versión dorada siguen los valores de Z43.
- **Se mantiene de Z43:** la opacidad según la cercanía (entra gradualmente, sin salto de color), la aceleración, la música y `DISENO_NUEVO`. El brillo por cercanía solo actúa en la versión dorada.

**Valores nuevos en `DBG_FRACTAL`** (menú Shift, sección "Fractal del prisma"):

| Constante | Default |
|---|---|
| `PALETA_ORIGINAL` | true (false vuelve a la versión dorada de Z43) |
| `TINTE_PRISMA` | 0 |
| `OPACIDAD_ORIGINAL` | 1 |
| `ASPECTO_ORIGINAL` | 0,5625 |
| `GRANO_RES` | 1280 |
| `ENCUADRE_Y_M` | 0 |
| `COMPENSAR_SALIDA` | 2 |
| `COMP_TOPE_LINEAL` | 1,5 |

### Comparación con el original (harness en Chrome headless, fuera del repo)
Rendericé el original y el adaptado a 1280 × 720 con el mismo tiempo (t = 10 s y t = 37 s).
- **Colores:** el promedio es idéntico: (39,2; 70,0; 43,5) contra (39,2; 70,1; 43,5).
- **En bloques de 16 px:** diferencia media de 0,8/255, máxima de 8 a 10.
- **Píxel a píxel:** el 16 % difiere en más de 2/255. Hay dos motivos:
  - El `rand` amplifica errores de redondeo (`× 43758`): el patrón del grano es otro, pero con la misma estadística.
  - El detalle fino de los helechos es caótico: una diferencia de 1e-7 en la coordenada cambia el píxel. A simple vista no se distingue.

### Diferencias que quedan en la escena
- **Blancos:** el original llega a 255 en los puntos más claros, pero con la compensación esos puntos quedarían enormes y encenderían el bloom (en las capturas se ven puntos cian brillantes). Para eso agregué `COMP_TOPE_LINEAL` 1,5, que limita esos puntos a 232/255.
- **Grano:** depende de la distancia. A 1280 por cara, de lejos queda más fino que un píxel de pantalla.
- **Bordes:** el CRT y el brillo azul que rodea al prisma (`GLOW_MAT`) siguen encima.

### Capturas
Las imágenes del harness están en `/private/tmp/claude-501/-Users-ezequielibarra-lab2026-lab2026/be1ef86a-ad10-4e1a-97e0-2bb606eb1fb2/scratchpad/z44/`:
- `lado_original_vs_adaptado_T10.png` y `lado_original_vs_dorado_T10.png`: comparaciones lado a lado.
- `diff_T10.png`: la diferencia × 4.
- `cara_completa_T10.png`: la cara completa.

Las capturas en escena están en la misma carpeta:
- `z44_orig_p03.png`, `z44_orig_p07.png`, `z44_orig_p1.png`: paleta original con cercanía forzada a 0,3, 0,7 y 1.
- `z44_dorada_p1.png`: la versión dorada a 1.
- `z44_orig_p1_sin_compensar.png`: evidencia de la causa del lavado.
- `z44_orig_p1_tinte05.png` y `z44_orig_arista.png`.

**Lo que quedó sin capturar:**
- Esas capturas son de antes de agregar `COMP_TOPE_LINEAL`, así que todavía muestran los puntos cian con bloom. La segunda corrida falló porque el servidor de desarrollo dejó de servir la página bien.
- No hice una captura lado a lado en escena de la paleta original contra la dorada: solo hay capturas separadas a prox 1, y la lado a lado es del harness.
- Lo del tope solo lo verifiqué leyendo el código y con `tsc` y el build.

### Archivos
- [fractalJungla.glsl.ts](frontend/lib/prisma/fractalJungla.glsl.ts)
- [geoCarasPrisma.ts](frontend/lib/prisma/geoCarasPrisma.ts) (`dimCaraPrisma`)
- [Prism.tsx](frontend/components/Prism.tsx)
- [debugConfig.ts](frontend/lib/debugConfig.ts)
- [DebugMenu.tsx](frontend/components/DebugMenu.tsx)

### Qué tenés que probar
1. Que se vea verde y azul grisáceo como el original, con el fondo oscuro legible. Si los blancos te parecen apagados, subí `COMP_TOPE_LINEAL`, a costa de más bloom.
2. La aparición gradual al acercarte y la aceleración.
3. La música con el visualizador activo (sigue validada solo en Node).
4. `PALETA_ORIGINAL` en false: tiene que volver la versión dorada.
5. `TINTE_PRISMA` y los FPS en una PC real.

---

# Z45: optimización del fractal: render a textura y calidad adaptativa

*Original: transcripción, línea 8232, 2026-11-13T21:02:11.144Z (UTC).*

Z45 está terminado: el fractal se calcula una vez por actualización en una textura que comparten las tres caras, y el aspecto se mantiene. Ganancia y nitidez en una PC real no las pude medir: Chrome headless solo da render por software (SwiftShader).

- **Chequeos:** `tsc` sin errores; lint 221 / 184, sin errores nuevos; build con `--webpack` pasa; `fractal-tex-test` 22 OK; `fractal-test` 28 OK.
- **Commit de seguridad:** `bb3720a` (incluye Z44). Después no hice commits.

### Paso 1: mediciones
- **Estimación del peor caso (1920 × 1080, prisma llenando la pantalla):**
  - Hoy (por píxel): las caras son de doble cara y transparentes, así que three las dibuja dos veces. Son hasta unos 4 millones de evaluaciones del shader pesado por frame (16 iteraciones más 3 ruidos celulares cada una).
  - Con textura: 1024² ≈ 1 millón de evaluaciones por actualización, a 30 Hz (unas 0,5 M por frame a 60 fps); con 512, unas 0,13 M por frame. El material de la cara es liviano.
- **Harness (shader solo, a 1280 × 720, render por CPU):**

| Caso | Costo |
|---|---|
| Por píxel | 36 ms |
| Textura 512 | 7 ms la textura + 7 ms la cara |
| Textura 1024 | 33 ms la textura, solo 30 veces por segundo |
| Ruido precalculado | 36 → 29–33 ms |

- **Escena real (Chrome headless, 1280 × 720, prisma de frente a 1,25 m):**

| prox | Por píxel | Textura |
|---|---|---|
| 0,7 | 1,9 fps | 2,6 fps (512) |
| 1 | 0,7 fps | 2,8 fps (1024) |

  - Sirve como tendencia: el resto de la escena domina y hay mucho ruido entre corridas. Con prox 0 dio 4,1 fps en una corrida y 1,9 en otra, siendo la misma escena.
  - Con el diseño anterior: 6 fps de frente.
  - La vista "arriba" no quedó realmente desde arriba, así que no tengo la medición con las tres caras a la vista.
  - Los FPS reales hay que medirlos en una PC con GPU.

### Qué cambió
- **Textura compartida (`USAR_TEXTURA`, true por defecto):**
  - El render target, el quad y la cámara se crean una vez y se liberan al desmontar.
  - La textura se recalcula justo antes de dibujar las caras, así que no se calcula si el prisma está fuera de cuadro.
  - Ese render llama al render real de three: el `gl.render` de la escena está reemplazado por el composer.
  - Filtro lineal, sin mipmaps, 8 bits.
  - El grano, la música (brillo), el tinte, la compensación de salida y la opacidad se aplican en la cara a resolución completa. Zoom y X/Y de la música se aplican en la textura (30 Hz).
- **Resolución dinámica:**
  - 512 por defecto y 1024 con prox por encima de 0,75; vuelve a 512 por debajo de 0,65.
  - En escena: 0,6 → 512, 0,8 → 1024, 0,72 y 0,68 → sigue en 1024, 0,6 → 512. El tiempo `t` siguió sin saltos.
- **Prox 0:** las dos mallas quedan invisibles y no se evalúa ningún shader del fractal (verificado en escena).
- **Ruido precalculado (`RUIDO_TEXTURA`, queda en false):**
  - Es el mismo algoritmo de Gustavson, repetido cada 32 celdas: dentro de la repetición da idéntico.
  - Los helechos salen iguales, pero cambian las volutas del fondo azul grisáceo (dibujo distinto, mismo estilo). Probé también con 16 y 8 celdas y pasa lo mismo.
  - El ahorro es chico (10–20 % en el harness). No lo recomiendo por defecto.
- **Calidad adaptativa (`ADAPTATIVO`, false):**
  - Baja un escalón si el frame tarda más de 20 ms durante 1 s seguido: resolución 1024 → 512 → 384 → 256, después iteraciones 16 → 12 → 10.
  - Sube uno tras 3 s por debajo de 14 ms.
  - Alternar lento y rápido cada 0,5 s no cambia nada. El aviso sale por consola solo con `DEBUG_ENABLED`.

### Diferencias visuales
- **1024:** muy cerca del cálculo por píxel; se pierde algo del detalle más fino.
- **512:** se nota más blando si la cara llena la pantalla. Por eso de cerca sube a 1024.
- **Cómo compensar:**
  - Si 1024 se ve blando de cerca, subí `TEX_RES_CERCA` a 1536 o 2048.
  - Si el movimiento se ve entrecortado, subí `TEX_FPS` (0 = cada frame).

**Constantes nuevas en `DBG_FRACTAL` (menú Shift):**

| Constante | Default |
|---|---|
| `USAR_TEXTURA` | true |
| `TEX_RES` | 512 |
| `TEX_FPS` | 30 |
| `TEX_RES_DINAMICA` | true |
| `TEX_RES_CERCA` | 1024 |
| `TEX_UMBRAL_CERCA` | 0,7 |
| `TEX_HISTERESIS` | 0,05 |
| `RUIDO_TEXTURA` | false |
| `RUIDO_CELDAS` | 32 (se fija al montar) |
| `ADAPTATIVO` | false |
| `MS_MAX` | 20 |
| `ADAPT_MARGEN` | 0,7 |
| `ADAPT_BAJAR_S` | 1 |
| `ADAPT_SUBIR_S` | 3 |

### Supuestos y decisiones para revisar
- Con `CARAS_DISTINTAS` activado se usa siempre el cálculo por píxel, porque una sola textura no alcanza para tres caras distintas.
- La textura es cuadrada y cubre la cara de 1,75 × 1,88 m, así que los texeles quedan apenas más altos que anchos.
- La base del prisma no se ve desde la altura del ojo. Con textura, ahí el fractal queda estirado desde el borde.
- En la versión dorada, el grano va dentro de la textura y por eso queda a la resolución de la textura.
- En pausa la textura no se recalcula, salvo si cambia la resolución.

**Lo que no verifiqué en el navegador:**
- La reacción a la música (el audio no genera energía en headless).
- La secuencia SILLAS completa y el checkpoint `sillas_prisma` (usé el salto a `sala_activa`). El código de la bajada no se tocó.

### Archivos
- **Nuevos:**
  - [lib/prisma/fractalTextura.ts](frontend/lib/prisma/fractalTextura.ts)
  - [lib/prisma/fractalTexturaRender.ts](frontend/lib/prisma/fractalTexturaRender.ts)
  - [lib/prisma/ruidoCelular.ts](frontend/lib/prisma/ruidoCelular.ts)
  - [scripts/fractal-tex-test.mjs](frontend/scripts/fractal-tex-test.mjs)
- **Editados:**
  - [fractalJungla.glsl.ts](frontend/lib/prisma/fractalJungla.glsl.ts)
  - [Prism.tsx](frontend/components/Prism.tsx)
  - [debugConfig.ts](frontend/lib/debugConfig.ts)
  - [DebugMenu.tsx](frontend/components/DebugMenu.tsx)
  - [CREDITOS.md](CREDITOS.md)

Capturas y harness en `/private/tmp/claude-501/-Users-ezequielibarra-lab2026-lab2026/be1ef86a-ad10-4e1a-97e0-2bb606eb1fb2/scratchpad/z45/`. Las imágenes del harness están como archivos separados (`pix`, `tex512`, `tex1024`, `pix_ruidoTex`), no compuestas lado a lado; las de la escena son `escena_*.png`.

### Qué tenés que probar
1. Acercarte con las caras a la vista y comparar FPS con `USAR_TEXTURA` encendido y apagado.
2. Que de cerca (1024) no se vea más borroso de lo aceptable.
3. Que la música siga reaccionando con el visualizador activo.
4. Que no haya parpadeo al cruzar prox 0,7 en las dos direcciones.
5. Opcional: `ADAPTATIVO` en una PC más lenta.

---

# Z46: texto A LIGHT FOR ATTRACTING ATTENTION sobre el telón (DBG_TELON_TEXTO)

*Original: transcripción, línea 8519, 2026-11-13T21:16:33.468Z (UTC).*

El texto aparece al empezar sobre el telón iluminado, en modo gobo, y se desvanece; queda una decisión tuya pendiente sobre la proporción del bloque.

- **Chequeos:** `tsc` sin errores; lint 221 / 184, sin errores nuevos; build con `--webpack` pasa; prueba del texto 30 OK. Las pruebas del fractal (28 y 22 OK) siguen pasando.
- **Commit de seguridad:** `8361c87` (incluye Z45). Después no hice commits.

**Decisión pendiente: la proporción del bloque.** Con Anton real el bloque mide **4,79:1**, no 3–3,5:1.
- La G y la N sí quedan alineadas exactamente: borde derecho en 1792,79 px en las dos, con 21,4 px de interletra agregada en ENTION.
- La causa es la fuente: "A" y "ATT" ocupan la altura de las dos líneas, así que también duplican su ancho, y Anton no es tan angosta como la de tu referencia.
- No estiré nada. Hay tres caminos:
  - Una fuente más angosta (League Gothic o Six Caps, también en Google Fonts).
  - Un factor de compresión horizontal del bloque entero, que deforma las letras.
  - Dejarlo así.

### Paso 1: relevamiento
- **Telón ([Curtain.tsx](frontend/components/Curtain.tsx)):**
  - Es una tela simulada (PBD, 48 × 32 puntos), no un shader de pliegues: los pliegues salen de la posición inicial, 8 pliegues de ±0,15 m.
  - Material `MeshPhysicalMaterial` `#990000`, con brillo de terciopelo `#cc0000`, transparente, sin `depthWrite`, doble cara.
  - Mide 14 m × 0,85 de fruncido ≈ 11,9 m de ancho por 8 m de alto. Está a 8 m del spawn, mirando al usuario.
- **Zona iluminada:** la da el `spotLight` del propio Curtain.tsx, no `CurtainFlash.tsx` (ese es el destello del cruce).
  - Está 5 m delante del telón y a 9 m de alto, apunta a 4 m de altura, con ángulo 0,6 rad y penumbra 0,7.
  - A media intensidad la zona mide **6,66 m** de ancho, así que el bloque al 60 % mide 4,0 m.
- **Tipografía:**
  - Había VT323, Geist e Inter cargadas con next/font. Anton solo aparecía en el footer, con `@import` de Google.
  - **Agregué Anton** con `next/font/google` en [app/alight/fuentes.ts](frontend/app/alight/fuentes.ts). Atribución (SIL OFL) en [CREDITOS.md](CREDITOS.md).

### Cómo está hecho
- **Layout:** sale de medir cada segmento con `measureText`, sin tamaños a ojo.
  - La interlínea y la separación de columnas son proporciones de la altura de mayúscula.
  - ENTION se justifica con interletra y conserva el kerning entre letras.
- **Textura:** canvas de 2048 × 640 dibujado una sola vez, después de esperar `document.fonts.load` y `document.fonts.ready`.
  - El desenfoque se aplica una vez (`BLUR_PX` 6). Si el navegador no soporta `filter`, usa el truco de la sombra.
  - Se usa como máscara (`NoColorSpace`), con mipmaps y anisotropía hasta 8.
  - Solo se recrea al cambiar `BLUR_PX` (o la interlínea o las columnas).
- **Proyección:** un plano a 3 cm delante de los pliegues, con `renderOrder` 1 y sin escribir profundidad.
  - No hay z-fighting porque el telón tampoco escribe profundidad.
  - Sigue el mismo patrón de pliegues del telón, escalado por `PLIEGUE` (0,3).
- **Mezcla elegida: multiplicativa.**
  - Gobo: el telón × `#1A0606` en las letras, así se ven en sombra y conservan los pliegues y la luz debajo.
  - Invertido: oscurece alrededor del bloque con una viñeta suave y aclara las letras × 1,8.
- **Aparición y salida:** usa el reloj de la experiencia, así que se congela en pausa.
  - Arranca a los 0,3 s, con 4 destellos de reflector en 0,6 s y un fundido de 2,5 s.
  - Se va con un fundido de 2 s a los 25 s, si te alejás más de 12 m del telón, o si cruzás el telón o empieza el camino LUZ.
  - Después el plano deja de dibujarse, y la textura se libera cuando se desmonta junto con el telón.
- **Para que no reaparezca:** el estado vive en el módulo, así que no vuelve al remontar el telón ni al volver de la luz. Con un checkpoint pedido o aplicándose queda terminado.
  - Lo probé en el navegador: el salto a Exploración desmonta el telón y el texto con él; el salto a Inicio vuelve a montar el telón, pero el texto queda terminado; "Reproducir texto" lo vuelve a mostrar.

### Constantes (`DBG_TELON_TEXTO`, sección "Texto del telón Z46" del menú Shift)

| Constante | Default |
|---|---|
| `ACTIVO` | true |
| `INVERTIDO` | false |
| `TAMANO` | 0,6 |
| `OFFSET_X_M` / `OFFSET_Y_M` | 0 / 0 |
| `SEPARACION_M` | 0,03 |
| `OPACIDAD` | 0,85 |
| `TINTE_SOMBRA` | `#1A0606` |
| `OSCURO_INV` | 0,25 |
| `BRILLO_INV` | 0,8 |
| `BLUR_PX` | 6 |
| `INTERLINEA` | 0,16 |
| `COLUMNAS` | 0,13 |
| `INTENSIDAD_ENTION` | 0,55 |
| `PLIEGUE` | 0,3 |
| `FADE_IN_S` | 2,5 |
| `FADE_OUT_S` | 2 |
| `FLICKER_S` | 0,6 |
| `FLICKER_N` | 4 |
| `FLICKER_PICO` | 0,7 |
| `DURACION_S` | 25 |
| `DIST_OCULTAR_M` | 12 |

El menú también tiene el botón "Reproducir texto".

### Supuestos y cosas para revisar
- `DURACION_S` cuenta desde que aparece el texto.
- El checkpoint Inicio tampoco reproduce el texto; solo el botón lo hace.
- Las medidas del reflector están copiadas de Curtain.tsx para no tocar ese archivo. Si cambiás el reflector, hay que actualizarlas en [TelonTexto.tsx](frontend/components/TelonTexto.tsx).
- En modo gobo, ENTION al 55 % × opacidad 0,85 queda muy tenue en la captura.
- El texto sigue la forma inicial de los pliegues, no el movimiento del viento de la tela.
- Dejé `window.__telonTexto` como enganche de diagnóstico, solo con `DEBUG_ENABLED`.

**Capturas:** en `/private/tmp/claude-501/-Users-ezequielibarra-lab2026-lab2026/be1ef86a-ad10-4e1a-97e0-2bb606eb1fb2/scratchpad/z46/`: `z46_gobo_spawn.png`, `z46_invertido_spawn.png`, `z46_mitad_fundido.png` y `z46_textura.png`.
- La textura se ve en blanco porque son letras blancas sobre transparente; es la imagen que te apareció arriba.
- No medí FPS: con un solo plano y una textura fija el costo debería ser despreciable, pero hay que confirmarlo.

**Para el servidor de desarrollo:** al principio la página no cargaba ("Next.js (stale)"). Lo atribuyo al `.next` que dejó el build de Z45, pero no lo confirmé. Lo arreglé borrando `.next`. Como acabo de correr el build otra vez, si `npm run dev` vuelve a fallar, borrá `.next` y reiniciá.

### Archivos
- **Nuevos:**
  - [components/TelonTexto.tsx](frontend/components/TelonTexto.tsx)
  - [lib/telonTexto/layoutTexto.ts](frontend/lib/telonTexto/layoutTexto.ts)
  - [lib/telonTexto/lineaTiempo.ts](frontend/lib/telonTexto/lineaTiempo.ts)
  - [lib/telonTexto/texturaTexto.ts](frontend/lib/telonTexto/texturaTexto.ts)
  - [app/alight/fuentes.ts](frontend/app/alight/fuentes.ts)
  - [scripts/telon-texto-test.mjs](frontend/scripts/telon-texto-test.mjs)
- **Editados:**
  - [app/alight/layout.tsx](frontend/app/alight/layout.tsx)
  - [ThreeScene.tsx](frontend/components/ThreeScene.tsx) (una línea de montaje y el import)
  - [debugConfig.ts](frontend/lib/debugConfig.ts)
  - [DebugMenu.tsx](frontend/components/DebugMenu.tsx)
  - [CREDITOS.md](CREDITOS.md)

### Qué tenés que probar
1. La forma del bloque (G y N alineadas) y decidir qué hacemos con la proporción.
2. Que se lea sobre el telón sin tapar la luz: probá `TAMANO`, `OPACIDAD` y `BLUR_PX`.
3. Que aparezca al empezar con el parpadeo y se desvanezca a los 25 s o al alejarte.
4. Que no consuma FPS.
5. Que no reaparezca al volver de la luz ni de un checkpoint.

---
