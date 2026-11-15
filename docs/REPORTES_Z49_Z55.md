# Reportes Z49 a Z55 (recuperados el 2026-11-15)

Fuente: la transcripción de la sesión de Claude Code de este proyecto (`~/.claude/projects/-Users-ezequielibarra-lab2026-lab2026/be1ef86a-….jsonl`, la única que contiene estas tareas). Los informes marcados **ORIGINAL** se copian tal cual, sin editar. Los marcados **RECONSTRUIDO** no tenían informe final en la sesión y se armaron con git, el código actual y lo que quedó registrado en la sesión.

| Tarea | Estado del informe |
|---|---|
| Z49 | ORIGINAL |
| Z50 | ORIGINAL |
| Z51 | ORIGINAL, entregado tarde: la tarea terminó sin informe y el usuario lo pidió después ("hace lo pendiente de z51, el reporte nomas") |
| Z52 | ORIGINAL |
| Z54 | RECONSTRUIDO: la implementación terminó, pero la sesión se compactó mientras corría la última captura de la flor y el informe final nunca se entregó |
| Z55 | EN CURSO, sin informe: el prompt llegó cortado (ver abajo); solo existe el ajuste 1 y está sin cerrar |

## Commits de seguridad

| Hash | Fecha | Tomado antes de | Contenido |
|---|---|---|---|
| `5a836b2` | 2026-11-13 20:16 | Z49 | Z48 ciclo de día |
| `1ccb91b` | 2026-11-13 20:41 | Z50 | Z49 sol en el eje, escala y tinte del portal |
| `46b4c26` | 2026-11-14 19:13 | Z51 | Z50 eje del sol, borde teñido, escala 1,625 |
| `3116dcb` | 2026-11-14 20:06 | Z52 | Z51 sol sobre el eje y sol nuevo; Z53 reportes recuperados |
| `cd2a270` | 2026-11-14 20:30 | Z54 | Z52 ondas por kick |
| `c27608a` | 2026-11-14 23:12 | Z55 | Z54 prisma y flor en el ciclo de día |

**Sin commit (trabajo de Z55, ajuste 1, en curso):**
- Modificados: `frontend/app/alight/dome/DomeSky.tsx`, `frontend/components/DebugMenu.tsx`, `frontend/components/ExperienceDome.tsx`, `frontend/lib/cicloDia.ts`, `frontend/lib/debugConfig.ts`, `frontend/lib/portalEscala.ts`, `frontend/scripts/ciclo-dia-test.mjs`.
- Nuevo: `frontend/components/EjeOverlay.tsx`.

## Estado actual de las constantes principales (`frontend/lib/debugConfig.ts`)

| Constante | Valor | Nota |
|---|---|---|
| `DBG_PORTAL.ESCALA` | `1.625` | desde Z50 |
| `DBG_DIA.SOL_RECORRIDO` | `"eje"` | desde Z51 |
| `DBG_DIA.SOL_EJE_IMAGEN` | `true` | nueva de Z55, sin commit |
| `DBG_DIA.SOL_EJE_CENTRO` | `"composicion"` | nueva de Z55, sin commit |
| `DBG_FLOR.ALTURA_FACTOR` | **no existe** | El ajuste "flor 33 % más baja" no llegó (el prompt de Z55 se cortó). La altura actual es `DBG_FLOR.ALTURA_M` = `2.7` |
| `DBG_ONDAS.EVIDENCIA` | **no existe** | El ajuste "ondas más evidentes" tampoco llegó. Siguen los valores de Z52: `AMPLITUD 0.6`, `BRILLO 0.25`, `BRILLO_NOCHE 0.5`, `TINTE_BANDA 0.35`, `REVELAR 0.5`, `UMBRAL 1.35` |

---

## Z49: sol sobre el eje, portal 30 % más grande, borde teñido por el cielo (ORIGINAL)

Hice las tres correcciones: el sol sale por el eje del portal, la composición es 30 % más grande y sigue apoyada en el horizonte, y el borde y los anillos toman el color del cielo. Cada una tiene su control en el menú debug. Recomiendo dejar `SOL_UNICO` en false.

- **Chequeos:** `tsc` sin errores; lint 221 / 184, sin errores nuevos; build con `--webpack` pasa.
- **Pruebas en Node:** sol y portal 16 OK, ciclo 40 OK. Las demás (checkpoints, amanecer, reloj, fractal y texto del telón) siguen pasando.
- **Commit de seguridad:** `5a836b2` (Z48). Después no hice commits.

### Geometría del portal (leída del shader y de `DBG_SILLAS`)
- **Azimut del centro:** `domePortalAzimuth` = π, o sea **180°** en la convención del domo `atan(d.x, −d.z)`, detrás de la tarima. Es la misma convención que usa el sol.
- **Elevación del centro:** 0,40 rad = **22,9°**, con semi-FOV 28°. El centro del círculo de la imagen (`PORTAL_C`) cae unos 2° a la derecha y 2° más abajo (21,1°).
- **Línea del horizonte de la composición:** la fila p.y = −0,795 de la imagen. Esa fila sigue exactamente en el horizonte con cualquier escala.

### 1. Sol sobre el eje
- **Azimut de salida:** lo toma de la misma variable que el portal; DomeSky la escribe en vivo, sin repetir el número. Sale a 180°.
- **Subida:** casi vertical, con menos de 1° de deriva en azimut hasta los 15° de altura. Recién ahí se abre hacia el mediodía (60° de altura, a 270°) y se pone en el azimut opuesto al portal. No hay saltos de 0 a 1 en todo el ciclo.
- **Orden de dibujo:** dentro del portal, el sol del mundo va delante del cielo ilustrado y **detrás de las montañas ilustradas**; fuera del portal, detrás de los anillos.

**`SOL_UNICO`:** con true, el sol ilustrado se desvanece entre tDia 0,19 y 0,22, queda atenuado hasta el crepúsculo y vuelve de noche.
- Se ve mejor con **false**, que es el default que recomiendo.
- Con true el portal pierde su sol grande, que es el centro de la composición, y lo reemplaza un disco de unos 3°.
- Con false el disco del mundo es chico y se lee como "el sol real" atravesando la ilustración, sin competir.
- Si querés usar true, haría falta agrandar `SOL_RADIO` mientras el sol está dentro del portal.

**El destello blanco:** era el halo del sol más el resplandor pasando el umbral del bloom (0,92), que se abre en blanco.
- Ahora el halo solo mira al hemisferio del sol (antes llegaba débil a todo el domo).
- La suma del halo se frena en `SOL_HALO_TOPE` = 0,88 sin cambiar el tono. Solo el disco puede brillar.

### 2. Composición a escala 1,3
- **Cómo:** se multiplica por 1,3 el tamaño del portal (`uPortalTan`) y su centro sube a `atan(1,3 · tan e₀)`, en [lib/portalEscala.ts](frontend/lib/portalEscala.ts).
- **Qué escala:** todo lo que se dibuja en coordenadas del portal crece junto, sin números repetidos: círculo, montañas ilustradas, sol ilustrado, nubes, olas, estratos, anillos, confeti y estrellas.
- **Costo:** el shader no cambia de costo: solo cambia esa escala, no hay muestras nuevas.
- **Introducción:** las montañas crecen desde el azimut real de la salida del sol. Los escalones de la introducción van por tiempo y no dependen de la escala.

| | Antes (1,0) | Después (1,3) |
|---|---|---|
| Centro del círculo | 21,1° | 26,4° |
| Radio del círculo | 23,7° | 29,4° |
| Círculo de / a | −2,7° a 44,8° | −3,0° a 55,8° |
| Alcance de los anillos | hasta 65,9° | hasta 81,8° |

- No se corta, pero **los anillos llegan cerca del cénit**. Si molesta, se acorta con `domeRingFade1`.
- Tapa más cielo detrás de las luces y los monolitos; ellos se siguen viendo delante, porque son objetos 3D.

### 3. Tinte del cielo
- **Borde y anillos:** toman el color del cielo del mundo de ese mismo píxel (sin el sol) y conservan el patrón de franjas y la reacción a la música.
- **Interior:** recibe un velo suave del color de la etapa. No tiñe el sol ilustrado ni las montañas.
- **Noche:** borde y anillos quedan oscuros con el cielo, y se sigue respetando `PORTAL_NOCHE`.
- Todo en el mismo shader, sin pasadas ni texturas nuevas.

### Valores nuevos (menú Shift)
- **Ciclo de día:**
  - `SOL_ALINEAR_PORTAL` true
  - `SOL_AZ_OFFSET_DEG` 0
  - `SOL_VERTICAL_FASE` 1,0
  - `SOL_UNICO` false
  - `SOL_HALO_TOPE` 0,88
- **Composición del domo:** `ESCALA` 1,3 · `TINTE_BORDE` 0,8 · `TINTE_ANILLOS` 0,7 · `TINTE_INTERIOR` 0,25 · `BORDE_SUAVE` 0,5.

### Supuestos
- "Centro del portal" = la dirección del portal (centro de la imagen y de las montañas centrales). El círculo está 2° corrido, ajustable con `SOL_AZ_OFFSET_DEG`.
- Base apoyada = la fila de la imagen que hoy cae en el horizonte sigue ahí.
- Con el ciclo de día apagado (`DBG_DIA.NUEVO` false) el shader dibuja como antes de Z49.

### Validación en Chrome headless
- 21 capturas lado a lado (Z48 contra Z49) en `/private/tmp/claude-501/-Users-ezequielibarra-lab2026-lab2026/be1ef86a-ad10-4e1a-97e0-2bb606eb1fb2/scratchpad/z49/`: los 7 valores de `T_MANUAL` desde el spawn y desde la tarima, escala sola, tinte en atardecer, alba y noche, y `SOL_UNICO`.
- **FPS: no los medí.** Falló un paso de mi script, y con render por software tampoco servirían.

### Archivos
- **Nuevos:** [lib/portalEscala.ts](frontend/lib/portalEscala.ts), [scripts/portal-sol-test.mjs](frontend/scripts/portal-sol-test.mjs).
- **Editados:**
  - shader del domo: [dome.frag.glsl](frontend/app/alight/dome/dome.frag.glsl), `domeShaders.ts` (regenerado), [DomeSky.tsx](frontend/app/alight/dome/DomeSky.tsx), [docs/dome/SPEC.md](docs/dome/SPEC.md)
  - [lib/cicloDia.ts](frontend/lib/cicloDia.ts), [lib/debugConfig.ts](frontend/lib/debugConfig.ts), [DebugMenu.tsx](frontend/components/DebugMenu.tsx), [CicloDiaEscena.tsx](frontend/components/CicloDiaEscena.tsx) (enganche de diagnóstico solo en debug)

### Qué tenés que probar
1. Que el sol suba por el mismo eje que la composición, detrás de las montañas ilustradas.
2. Que la composición se vea 30 % más grande y apoyada en el horizonte. Mirá si los anillos cerca del cénit te molestan.
3. Que el borde y los anillos cambien de color con el día y que de noche no brillen.
4. Comparar `SOL_UNICO` en true y false.
5. FPS en una PC real.
6. Que no haya cortes ni saltos al cruzar de etapa (`VELOCIDAD 8`).

---

## Z50: diagnóstico y corrección del azimut del sol, borde exterior, escala 1,625, DEBUG_CAPAS (ORIGINAL)

Z50 quedó resuelto: el sol sube exactamente por el centro de la composición, el borde y los anillos toman el color del cielo, y la composición está a escala 1,625. Pero **a 1,625 el alcance de los anillos pasa el cénit (96,8°)**; abajo van tres alternativas, sin aplicar ninguna.

- **Chequeos:** `tsc` sin errores; lint 221 / 184, sin errores nuevos; build con `--webpack` pasa.
- **Pruebas en Node:** ciclo 45 OK (incluye el chequeo nuevo del eje), sol y portal 16 OK, checkpoints 24 OK, amanecer 16 OK, reloj 14 OK. Las de Z43–Z46 siguen pasando.
- **Commit de seguridad:** `1ccb91b` (Z49). Después no hice commits.

### Diagnóstico: el sol (simulación en Node con la fórmula del shader)
- **Centro del portal**, con `ESCALA` 1,625:
  - dirección del portal (F): azimut 180,00°, elevación 34,49°;
  - centro del círculo (`cDir`, con `PORTAL_C` de [dome.frag.glsl:82](frontend/app/alight/dome/dome.frag.glsl#L82)): azimut **182,67°**, elevación 31,45°.
- **Antes de corregir** (Z49, alineado), diferencia de azimut del sol contra el centro del círculo:

| tDia | 0,12 | 0,18 | 0,20 | 0,22 | 0,236 | 0,25 | 0,30 | 0,40 | 0,50 | 0,65 | 0,80 | 0,92 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Δaz | −38,0° | −11,0° | −2,0° | −2,0° | −1,9° | −1,6° | **+6,6°** | **+58,0°** | +88,0° | +133,0° | +178,0° | −128,0° |

- Sin alinear (Z48), la diferencia iba de −98° a +172°.
- **Causa real:** no era un signo, ni una convención distinta, ni el anclaje del domo. La malla del cielo no está rotada, `vDir` es la posición en el mundo menos la cámara y `uSolDir` está en el mismo espacio del mundo. Eran tres cosas de la fórmula del arco:
  1. **Antes de salir, el sol giraba en azimut** por debajo del horizonte (144° a tDia 0,12, 171° a 0,18). Eso movía de costado el resplandor del alba.
  2. **La subida casi vertical de Z49 terminaba a los ~15° de altura.** Por eso a tDia 0,30 ya iba 8,6° corrido y a 0,40, 60°: "corrido a la derecha, después muy arriba y a la derecha".
  3. **Alineaba con la dirección del portal, no con el centro visual del círculo,** que `PORTAL_C` corre ~2,7° a la derecha.
- **Después de corregir:** Δaz = **0,00°** de tDia 0,12 a 0,30 (en el test, 0 exacto entre tDia 0 y 0,30). A 0,40 va +8,8°, a 0,50 +50,8°, y se pone a 180°, sin saltos.

### Diagnóstico: el borde (modo de capas en color falso)

| Capa | Color en el mapa |
|---|---|
| Disco del portal | azul |
| Banda del contorno hacia adentro | **cian** |
| Contorno y feather | magenta |
| Franja de Z49, fuera del contorno | amarillo |
| Anillos | verde |
| Sol ilustrado | naranja |
| Nubes | blanco |
| Montañas | rojo |

- **Lo que se ve como "borde naranja"** es la banda exterior del disco, **por dentro** del contorno: el cielo ilustrado en naranja (cian en el mapa).
- **El `TINTE_BORDE` de Z49** se aplicaba a la franja **por fuera** del contorno (amarillo en el mapa). Por eso no cambiaba lo que se ve.

### Correcciones
- **Sol:** el azimut es exactamente el del centro del círculo desde tDia 0, durante toda la introducción, y mientras sube hasta 35°.
  - El centro del círculo lo calcula `centroPortal` con la misma fórmula del shader; un test verifica que `PORTAL_C` coincida con el GLSL.
  - Después de los 35° se abre con una curva suave hasta la puesta. De noche completa la otra media vuelta en la primera mitad de la noche y queda en el eje.
- **Borde:** la banda del disco, de ancho `BORDE_ANCHO` × radio hacia adentro, converge al color del cielo del mundo en ese píxel: peso 1 en el contorno.
  - Las franjas de los anillos pierden contraste junto al contorno, así queda continuo con la banda de adentro.
  - El sol ilustrado y las montañas conservan su color.
  - De noche, borde y anillos quedan en el violeta oscuro del cielo: ya no hay naranja sobre azul. Lo confirmé en captura a tDia 0,95.

### Tamaño: 1,625, pasa el cénit
- **Ángulo vertical del círculo:** 47,5° a escala 1,0; 58,8° a 1,3; **69,2° a 1,625** (de −3,1° a 66,1°). El círculo entra, con la base en el horizonte.
- **Alcance de los anillos:** 65,9° a 1,0; 81,8° a 1,3; **96,8° a 1,625**, o sea, pasa el cénit.
- **Campo de visión:** mirando de frente al centro del círculo (31° hacia arriba), el círculo entra en la captura y los anillos exteriores se salen del cuadro.

**Alternativas (no apliqué ninguna):**
- **A)** Limitar `ESCALA` a **1,47**: los anillos llegan justo a 90°.
- **B)** Bajar la base 6,8°: la composición quedaría hundida bajo el horizonte.
- **C)** Mantener 1,625 y acortar el alcance de los anillos: `domeRingFade1` de 1,6 a **1,43**. Los anillos se desvanecen antes del cénit y el círculo no cambia.

### `SOL_UNICO`
- Recomiendo **false**. Con el sol ya alineado se ve atravesando la ilustración por detrás de la montaña central.
- Con true el portal pierde su sol grande, que es el centro de la composición.

### Valores nuevos o cambiados (menú Shift)
- **Ciclo de día:** `SOL_EJE_HASTA_ELEV_DEG` 35 (−1 vuelve al modo de Z49); `SOL_ALINEAR_PORTAL` true; `SOL_AZ_OFFSET_DEG` 0.
- **Composición:**
  - `ESCALA` **1,625** (antes 1,3)
  - `TINTE_BORDE` **1,0** (antes 0,8)
  - `TINTE_ANILLOS` **0,85** (antes 0,7)
  - `TINTE_INTERIOR` 0,25
  - `BORDE_ANCHO` **0,22** (nuevo)
  - `DEBUG_CAPAS` 0
  - `OVERLAY_EJE` false: muestra el azimut del portal, el del sol, la diferencia, la altura y tDia, solo con el menú abierto.

### Supuestos
- "Centro de la composición" = el centro del círculo, no la dirección del portal (están a 2,7° de distancia). Se puede ajustar con `SOL_AZ_OFFSET_DEG`.
- En la continuidad subí la tolerancia del test de 0,002 a 0,003 por paso. El máximo es el giro de noche, con el sol bajo el horizonte; es continuo, sin saltos.

### Validación en Chrome headless
- Capturas en `/private/tmp/claude-501/-Users-ezequielibarra-lab2026-lab2026/be1ef86a-ad10-4e1a-97e0-2bb606eb1fb2/scratchpad/z50/`:
  - **Frente al portal** desde el spawn con el indicador encendido (`z50_T*_frente.png`): el menú abierto tapa gran parte de la vista, pero el indicador se lee.
  - **Mapa de capas:** `z50_capas_*.png`.
  - **Tinte 0 contra 1,0** a las 0,95, 0,18 y 0,5: `z50_tinte_*.png`.
  - **`SOL_UNICO`:** `z50_solunico_*.png`.
- **FPS: no medidos** (solo hay render por software). El shader suma algunas operaciones aritméticas, sin muestras ni pasadas nuevas.

### Archivos
- shader del domo: [dome.frag.glsl](frontend/app/alight/dome/dome.frag.glsl), `domeShaders.ts` (regenerado), [DomeSky.tsx](frontend/app/alight/dome/DomeSky.tsx) y [docs/dome/SPEC.md](docs/dome/SPEC.md)
- [lib/cicloDia.ts](frontend/lib/cicloDia.ts), [lib/portalEscala.ts](frontend/lib/portalEscala.ts), [lib/debugConfig.ts](frontend/lib/debugConfig.ts), [DebugMenu.tsx](frontend/components/DebugMenu.tsx)
- [scripts/ciclo-dia-test.mjs](frontend/scripts/ciclo-dia-test.mjs) y [scripts/portal-sol-test.mjs](frontend/scripts/portal-sol-test.mjs)

### Qué tenés que probar
1. Que el sol suba exactamente por el centro de la composición: `OVERLAY_EJE` encendido y `VELOCIDAD` 8.
2. Que el borde exterior y los anillos se parezcan al cielo de cada hora, y que de noche no quede contraste naranja.
3. El tamaño 1,625 y elegir entre A, B o C.
4. Comparar `SOL_UNICO` en true y false.
5. FPS en una PC real.

---

## Z51: sol nuevo (núcleo, rayos, destello de lente) y recorrido sobre el eje (ORIGINAL, entregado tarde)

> Nota: la tarea Z51 terminó sin informe porque la última captura quedó corriendo en segundo plano y después llegó Z53. El informe de abajo se entregó más tarde, cuando el usuario lo pidió ("hace lo pendiente de z51, el reporte nomas"). Es el último y único informe completo de Z51. El commit de seguridad `3116dcb`, tomado antes de Z52, incluye el trabajo de Z51.

Te paso el reporte de Z51 (no toqué nada; armado con lo que quedó en la sesión). Lo central: el sol sube y baja por el eje de la composición durante todo el ciclo, verificado en Node y en capturas. Lo que falta verificar es el aspecto final del sol nuevo y del destello.

## Z51: sol sobre el eje durante todo el ciclo y sol nuevo con destello de lente

- **Chequeos:** `tsc` sin errores; lint 221 / 184, sin errores nuevos. El build con `--webpack` pasó en Z52, con este código incluido.
- **Pruebas en Node:** ciclo 51 OK, sol y portal 16 OK, checkpoints 24 OK, amanecer 16 OK.
- **Commits:** el de seguridad antes de Z51 es `46b4c26`. El trabajo de Z51 quedó en `3116dcb`.

### Diagnóstico: por qué se desviaba
Lo de Z50 estaba aplicado. Con el modelo de arco, el sol queda exacto en el eje hasta los 35° de altura (`SOL_EJE_HASTA_ELEV_DEG`). Desde ahí **se abre a propósito** hacia el arco del mediodía y la puesta: esa era la deriva "a la derecha y arriba".

Diferencia de azimut entre el sol y el centro del portal (182,67°), en Node con el código de Z50:

| tDia | 0,12 | 0,20 | 0,25 | 0,30 | 0,40 | 0,50 | 0,65 | 0,80 | 0,92 |
|---|---|---|---|---|---|---|---|---|---|
| Δaz | 0,00° | 0,00° | 0,00° | 0,00° | +8,80° | +50,79° | +135,36° | −180,00° | −63,36° |

No era un problema de coordenadas. DomeSkyAnchor solo traslada el grupo con la cámara, la malla del cielo no está rotada, y `vDir` y `uSolDir` están en el mismo espacio del mundo.

### Paso 1: recorrido sobre el eje por construcción
`DBG_DIA.SOL_RECORRIDO` tiene tres modos:
- **"eje" (default):** el azimut es **siempre** el del centro del portal (más `SOL_AZ_OFFSET_DEG`). Solo cambia la altura, con la misma curva que antes:
  - sale bajo el horizonte, sube detrás de las montañas centrales y llega a `SOL_ALT_MAX_DEG` (60°) al mediodía;
  - baja por el mismo eje y se pone en el mismo lugar.
- **"meridiano":** un gran círculo vertical por el azimut del portal. Sale por el portal, pasa por el cénit al mediodía y se pone del lado opuesto.
- **"arco":** el comportamiento de Z48 a Z50.

**Pruebas en Node (agregadas a `ciclo-dia-test.mjs`):**
- En "eje", Δaz = 0 exacto de tDia 0 a 1, también en la dirección que llega al shader.
- La altura es continua (paso máximo 0,0005): 60° al mediodía, −48,6° a medianoche. Sale y se pone en el horizonte detrás de la composición, y el ciclo cierra sin saltos.
- En "meridiano": cénit al mediodía, se pone del lado opuesto y es continuo (paso ≤ 0,0008).
- Las pruebas de Z49 quedaron fijadas al modo "arco".

**Chrome headless:** el azimut quedó en 182,67° en todos los tDia (0,20, 0,24, 0,30, 0,40, 0,50, 0,65, 0,80 y 0,90), con alturas 0°, 10,4°, 25,7°, 48,6°, 60,0°, 37,8°, 0° y −25,7°. El indicador de debug mostró Δaz 0,000° en 0,24 y en 0,50.

**Qué modo se ve mejor:** recomiendo **"eje"**, porque el sol queda sobre la composición todo el día. "Meridiano" pasa por el cénit, fuera del campo de visión al mirar al portal. De "meridiano" solo hice una captura (a 0,34 y 0,40), así que la comparación es limitada.

### Paso 2: sol nuevo (`DBG_SOL.DISENO_NUEVO`, true; con false vuelve el disco anterior)
- **Cuerpo** (en el shader del domo, en la misma función que dibujaba el sol): es la referencia llevada a distancia angular. L = ángulo / `TAMANO`.
  - Rayos: `sin(a·3 + cos(a·9)) · sin(a·9)`, con exponente `RAYOS_ANCHO`.
  - Brillo de fondo de la referencia: `0,1 / (10L)^0,05`.
  - Punto brillante: `bright / √(4L)`.
  - Atenuación `exp(0,8 − L) · 0,2`, núcleo propio, y nada más allá de `ALCANCE`.
  - La base tangente para el ángulo de los rayos se calcula en JS una vez por frame. Los rayos giran (`ROTACION_RAYOS_DEG_S`) y el brillo parpadea con `sin(t) · 0,05`.
- **Música:** `MUSICA_SOL` (0 por defecto) sube el brillo del núcleo y alarga los rayos.
- **Intensidad:** × (0,5 + 0,5 · el máximo entre `brilloSol` y la luz de la etapa).
- **Destello de lente** ([SolFlare.tsx](frontend/components/SolFlare.tsx)): **no es una pasada a pantalla completa.**
  - Es una sola malla con hasta 10 quads (círculo, punto y hexágono). Usa el hash, las distancias, las posiciones y la paleta de la referencia.
  - Por frame cambian unos pocos uniforms, sin crear objetos. Es aditivo y se dibuja antes del bloom y del CRT.
  - Se ve solo con el sol en cuadro y por encima de `FLARE_ALT_MIN_DEG`, con fundido por altura, por borde del cuadro y por cercanía al centro de la pantalla.
  - No hay oclusión real por geometría: las montañas solo cuentan a través de la altura mínima.
- **Colores:** los de la referencia por defecto: núcleo blanco azulado, punto brillante azulado, rayos blancos y fantasmas con la paleta cos. `PALETA_PROYECTO` mezcla hacia crema, amarillo, naranja y rojo del proyecto, y `TINTE_ETAPA` tiñe con el color de la etapa.
- **Créditos:** en el encabezado del shader, en `SolFlare.tsx` y en [CREDITOS.md](CREDITOS.md): shader de Shadertoy aportado por vos, **autor y URL por confirmar**, licencia CC BY-NC-SA 3.0 mientras tanto.

**Problemas encontrados y corrección (la corrección no está verificada en el navegador):**
- En la primera tanda de capturas, el cuerpo del sol casi no se veía.
  - El tope del halo (`SOL_HALO_TOPE` 0,88) no deja sumar luz sobre un cielo de día que ya está cerca de 0,9.
  - El núcleo era diminuto: 0,06 × 0,22 rad ≈ 0,8°.
- Con el sol en el centro de la pantalla, todos los fantasmas se apilaban encima: la mancha blanca que se veía era el destello, no el sol.
- **Corrección:**
  - mezcla tipo pantalla con tope propio (`TOPE` 0,97), que nunca llega a 1;
  - `NUCLEO` 0,15 (≈1,9°);
  - `FLARE_CENTRO` 0,2, que desvanece el destello cuando el sol está en el centro.
- **Estado:** las capturas para comprobarla fallaron (el menú quedaba cerrado al repetir con el mismo perfil de Chrome).
  - Evidencia indirecta en las capturas de Z52, que ya tienen esta corrección: a tDia 0,5 se ve un brillo blanco azulado arriba de la composición (el cuerpo del sol nuevo).
  - En esas mismas capturas aparece una **mancha cian grande cerca de la base de la composición**: es un fantasma del destello. Puede estar demasiado grande o brillante; probá `FLARE_TAMANO` y `FLARE_INTENSIDAD`.

**`SOL_UNICO`:** recomiendo **false**, que conserva el sol ilustrado como centro de la composición. Lo comparé en la primera tanda, antes de la corrección; no lo volví a evaluar.

### Costo estimado
- **Cuerpo del sol:** solo dentro de `ALCANCE` (0,9 rad); el resto del domo sale enseguida. Ahí son unas 10 funciones trascendentes por píxel (un atan, 4 senos y cosenos, 2 potencias, una exponencial y una raíz). Se evalúa dos veces: en el cielo y dentro del portal.
- **Destello:** 10 quads chicos, sin pasadas de pantalla completa.
- FPS no medidos.

### Valores (menú Shift: "SOL_RECORRIDO" y "Sol nuevo Z51")
- **`DBG_DIA.SOL_RECORRIDO`:** "eje".
- **Cuerpo del sol:**
  - `TAMANO` 0,22 · `INTENSIDAD` 1,0 · `NUCLEO` 0,15 · `HALO` 1,0
  - `RAYOS_N1` 3 · `RAYOS_N2` 9 · `RAYOS_ANCHO` 1,0 · `RAYOS_INT` 1,0
  - `PARPADEO` 1,0 · `ROTACION_RAYOS_DEG_S` 4 · `ALCANCE` 0,9
  - `PALETA_PROYECTO` 0 · `TINTE_ETAPA` 0,3 · `TOPE` 0,97
- **Destello:** `FLARE` true · `FLARE_INTENSIDAD` 0,6 · `FLARE_CANTIDAD` 8 · `FLARE_TAMANO` 1,0 · `FLARE_ALT_MIN_DEG` 8 · `FLARE_CENTRO` 0,2.

### Archivos
- **Nuevo:** [components/SolFlare.tsx](frontend/components/SolFlare.tsx).
- **Editados:**
  - [lib/cicloDia.ts](frontend/lib/cicloDia.ts) (modos de recorrido)
  - shader del domo: [dome.frag.glsl](frontend/app/alight/dome/dome.frag.glsl), `domeShaders.ts` (regenerado), [DomeSky.tsx](frontend/app/alight/dome/DomeSky.tsx) y [docs/dome/SPEC.md](docs/dome/SPEC.md)
  - [ExperienceDome.tsx](frontend/components/ExperienceDome.tsx) (monta el destello), [DebugMenu.tsx](frontend/components/DebugMenu.tsx) y [lib/debugConfig.ts](frontend/lib/debugConfig.ts)
  - [CicloDiaEscena.tsx](frontend/components/CicloDiaEscena.tsx): enganches de diagnóstico `__sol` y la cámara, solo en debug.
  - [CREDITOS.md](CREDITOS.md), [scripts/ciclo-dia-test.mjs](frontend/scripts/ciclo-dia-test.mjs) y [scripts/portal-sol-test.mjs](frontend/scripts/portal-sol-test.mjs).

### Qué tenés que probar
1. Que el sol suba y baje por el centro de la composición durante todo el ciclo: `VELOCIDAD` 8 y el indicador del eje.
2. Que el sol nuevo se parezca al de la referencia (núcleo, rayos, halo) y se lea de día.
3. Que el destello aparezca al mirar el sol de costado, se desvanezca al centrarlo y al bajar, y que la mancha cian no moleste.
4. Que no sature a blanco fuera del núcleo.
5. Comparar `SOL_UNICO` y los tres modos de recorrido.
6. FPS.
7. Pasarme autor y URL del shader de referencia para completar los créditos.

---

## Z52: ondas expansivas por kick (ORIGINAL)

Hice Z52: cada kick de una banda con su luz encendida lanza una onda desde el borde del portal que empuja las franjas del domo y las suelta. De noche se ve bien con el tinte de su luz; **de día se nota poco**. Con música real no lo pude probar: en headless el audio no da energía.

- **Chequeos:** `tsc` sin errores; lint 221 / 184, sin errores nuevos; build con `--webpack` pasa.
- **Pruebas en Node:** ondas 18 OK. Las otras ocho suites también pasan: ciclo 51, sol y portal 16, checkpoints 24, amanecer 16, reloj 14, fractal 28 y 22, texto del telón 30.
- **Commit de seguridad:** `3116dcb`. Incluye Z51 y el documento de Z53. Después no hice commits.

### Paso 1: relevamiento
- **Las "líneas":** son el marco de anillos del túnel, en el shader del domo ([dome.frag.glsl](frontend/app/alight/dome/dome.frag.glsl)) que DomeSky aplica a la malla del cielo.
  - Coordenada: `s`, la distancia angular al centro del círculo del portal dividida por `atan(uPortalTan)`, más un bamboleo fbm. Con eso se arma la fase `ph = sph / (RING_PERIOD · uRingScale) − flujo`.
  - Uniforms del marco: `uRingFlow`, `uRingScale`, `uRingFade`. Desde Z50 también las tiñe el cielo (`uTinteAnillos`, `uTinteBorde`).
  - Fuera del alcance del marco se ven al 10 %.
- **Kick hoy:** solo hay uno global, `BAND_STATE.kick`, de la banda 1 (80–250 Hz) con 150 ms de refracción. **No había detección por banda.**
  - Por frame, [lib/vizAudio.ts](frontend/lib/vizAudio.ts) expone `normEnergy[4]`, `energy[4]`, `gateOpen[4]` y `assignment` (luz → banda).
  - Se actualiza una vez por frame, cuando DomeVisualizer llama a `getVizBands()`.

### Cómo funciona
- **Detector por luz** ([lib/ondasKick.ts](frontend/lib/ondasKick.ts), puro): cada luz escucha su banda. Dispara cuando se cumple todo esto:
  - la luz está encendida y su compuerta abierta;
  - la energía pasa `UMBRAL` × su media móvil, en un flanco de subida;
  - pasó el enfriamiento;
  - la energía supera un mínimo.
- **Calentamiento:** el primer frame solo inicializa la media. Sin eso, el primer sonido lanzaba una onda espuria; el test lo detectó.
- **Lista de ondas:** 8 lugares fijos; si no hay libre, reemplaza la más vieja. Usan el reloj de la experiencia, así que se congelan con la pausa. Se limpian al desmontar el visualizador.
- **Shader:** un bucle de hasta 8 ondas, solo con cuentas baratas (sin fbm ni texturas).
  - Cada onda nace en el borde del portal y avanza.
  - Corre la fase de las franjas con un perfil de campana con seno adentro: las empuja hacia afuera y vuelven.
  - Se apaga con la edad y con la distancia.
  - Bajo la cresta las franjas brillan, toman el color de su luz y se ven aunque estén fuera del alcance del marco.
  - No toca el portal, las montañas ni el piso.
- **Colores de las luces** (`DBG_SILLAS.hazColor0…3`): cian `#7FEFE6`, verde `#34F28A`, amarillo `#FFD21A` y rojo `#FF1A1A`.

### Valores (`DBG_ONDAS`, sección "Ondas por kick Z52" del menú Shift)

| Constante | Default |
|---|---|
| `ACTIVO` | true |
| `MAX` | 8 |
| `VELOCIDAD_DEG_S` | 28 |
| `ANCHO_DEG` | 9 |
| `DURACION_S` | 3,5 |
| `AMPLITUD` | 0,6 (períodos de franja) |
| `BRILLO` | 0,25 |
| `BRILLO_NOCHE` | 0,5 |
| `TINTE_BANDA` | 0,35 |
| `REVELAR` | 0,5 |
| `GANANCIA_BANDA` | [1, 1, 1, 1] (por frecuencia: < 80 Hz, bombo, medios, agudos) |
| `UMBRAL` | 1,35 |
| `COOLDOWN_MS` | 180 |
| `MEDIA_S` | 0,6 |
| `MIN_ENERGIA` | 0,1 |

El menú tiene los botones "Lanzar onda de prueba" para las luces 0 a 3. Agregué `MEDIA_S` y `MIN_ENERGIA`, que no pediste: el detector los necesita.

### Costo estimado
- **Shader:** por píxel del domo, hasta 8 vueltas cortas de unas 20 operaciones cada una (una exponencial y un seno). Las ondas inactivas se saltean, así que sin ondas el costo es casi cero.
- **CPU:** 4 detectores y llenar 8 valores por frame, sin crear objetos.
- FPS reales no medidos (solo hay render por software).

### Validación
- **Node:** el detector dispara en los 8 ataques y no en el arranque. En una meseta dispara una sola vez. Respeta el enfriamiento (100 ms → 1 onda; 250 ms → 2) y no dispara con la luz apagada, en silencio ni en una oscilación suave.
- **Lista y perfil:** máximo 8, reemplaza la más vieja y mueren a los 3,5 s. En la réplica del perfil del shader la onda empuja y después devuelve, y nace a 34,6° del centro, en el borde del portal. Cresta: 0,73 a 0,5 s, 0,48 a 1,5 s, 0,28 a 2,5 s y 0 a 3,5 s.
- **Chrome headless:** capturas de día (tDia 0,5) y de noche (0,95) sin ondas, con una onda de 0,5, 1,5 y 2,5 s, y con 4 a la vez. Están en `/private/tmp/claude-501/-Users-ezequielibarra-lab2026-lab2026/be1ef86a-ad10-4e1a-97e0-2bb606eb1fb2/scratchpad/z52/` (`z52_*.png`).
  - Para fijar las edades agregué un campo `edadFija` en cada onda, usado solo por el enganche de diagnóstico. No pude congelar el reloj, porque `CheckpointsHost` lo descongela cada frame.
- **Sin probar en el navegador:** la detección con música real, la pausa (sí probada en Node) y los checkpoints `dia_*` con ondas.

### Para revisar
- **De día la onda casi no se ve.** Si la querés visible, probá subir `TINTE_BANDA` (0,6), `AMPLITUD` (1,0) o `BRILLO`, o bajar `TINTE_ANILLOS` de Z50.
- **Sin cambios:** los efectos de las luces y el kick global de antes quedaron igual.

### Archivos
- **Nuevos:** [lib/ondasKick.ts](frontend/lib/ondasKick.ts) y [scripts/ondas-test.mjs](frontend/scripts/ondas-test.mjs).
- **Editados:**
  - shader del domo: [dome.frag.glsl](frontend/app/alight/dome/dome.frag.glsl), `domeShaders.ts` (regenerado), [DomeSky.tsx](frontend/app/alight/dome/DomeSky.tsx) y [docs/dome/SPEC.md](docs/dome/SPEC.md)
  - [DomeVisualizer.tsx](frontend/components/DomeVisualizer.tsx): el detector y el botón de prueba.
  - [lib/debugConfig.ts](frontend/lib/debugConfig.ts), [DebugMenu.tsx](frontend/components/DebugMenu.tsx) y [CicloDiaEscena.tsx](frontend/components/CicloDiaEscena.tsx) (enganche de diagnóstico).

### Qué tenés que probar
1. Con música real, que cada kick lance una onda desde la composición, y que las líneas se muevan y vuelvan.
2. Que cada banda tenga su ritmo y su tinte (ajustá `UMBRAL` y `GANANCIA_BANDA`).
3. Que no sature ni parpadee, de día y de noche.
4. FPS.

**Pendiente de Z51:** quedó en el commit de seguridad, pero no te pasé su reporte. La última corrección (mezcla del sol, núcleo más grande, fundido del destello en el centro) no la verifiqué en el navegador, porque las capturas fallaron. Si querés, armo el reporte de Z51 y repito esas capturas.

---

## Z54: prisma que sube, flor que nace y prisma que baja, atados al ciclo de día (RECONSTRUIDO)

> **RECONSTRUIDO, no es el informe original.** La implementación terminó y quedó en el commit `c27608a`, tomado como commit de seguridad antes de Z55. El informe final no se entregó: la sesión se compactó mientras corría la recaptura de primeros planos de la flor. Esa recaptura salió rota (la página no había terminado de cargar) y no se repitió. Fuentes de esta reconstrucción: `git show c27608a`, el código actual y lo registrado en la sesión.

**Qué hace:**
- **Prisma:** sube de vuelta a su altura inicial entre tDia 0,25 y 0,37, queda arriba y baja despacio entre 0,75 y 1,0.
- **Flor:** nace donde estaba apoyado el prisma, entre 0,29 y 0,42. Primero crece el tallo y después se abre la cabeza. Entre 0,66 y 0,75 se cierra y se achica hasta desaparecer justo en 0,75.
- **Bordes del ciclo:** tDia 0 y tDia 1 dan el mismo estado (prisma apoyado, sin flor), así que con LOOP el día nuevo empieza igual.
- **Curvas:** son smoothstep. La coreografía solo corre con el ciclo nuevo en marcha (`DBG_DIA.NUEVO`, la escena del día activa y, si no, `T_MANUAL` fijado).

**Archivos nuevos:**
- `frontend/lib/prismaFlor.ts`: función pura `estadoPrismaFlor(dia, cfg, activo, out)` y estado compartido `FLOR` {activo, altura, escala, apertura, tallo, cabeza}, sin allocations.
- `frontend/components/FlorCiclo.tsx`: la flor, con un solo `ShaderMaterial` y uniforms de módulo.
  - Tallo: `TubeGeometry` sobre una CatmullRom en S.
  - Pétalos: `InstancedMesh` de esferas deformadas, 16 exteriores y 12 interiores.
  - Estambres: 10 cilindros.
  - Color: degradado térmico (azul marino, rojo, naranja, verde lima) con mezcla opcional a la paleta del proyecto.
  - Movimiento: respiración, balanceo y giro.
  - Visible solo con `FLOR.activo` y escala mayor que 0,001.
- `frontend/scripts/prisma-flor-test.mjs`: 14 chequeos.

**Archivos modificados:**
- `AmanecerReloj.tsx`: calcula `estadoPrismaFlor` una vez por frame, después de avanzar el ciclo.
- `Prism.tsx`: con `FLOR.activo` y el prisma ya aterrizado, la altura es `lerp(PRISM_Y_END, PRISM_Y_START, FLOR.altura)`. La proximidad usa la altura real, o la base con `PROX_USA_BASE`.
- `ExperienceDome.tsx`: monta `{vizActive && <FlorCiclo />}`.
- `checkpoints.ts`: agrega `dia_prisma_sube` (0,31), `dia_flor` (0,50) y `dia_prisma_baja` (0,88). `checkpoints-test.mjs` ahora espera 16.
- `DebugMenu.tsx`: sección "Prisma y flor Z54" con toggles y sliders, botón "Probar flor" (VELOCIDAD 24, `T_MANUAL` −1 y, si hace falta, posiciona el día en 0,2), botón "velocidad 1" e indicador en vivo de prisma, flor y apertura.
- `debugConfig.ts`: agrega `DBG_FLOR`.

**Constantes `DBG_FLOR` (defaults):**
- Flags: `ACTIVO true`, `PROX_USA_BASE false`.
- Tramos del ciclo: `SUBE_INICIO 0.25`, `SUBE_FIN 0.37`, `NACE_INICIO 0.29`, `NACE_FIN 0.42`, `ACHICA_INICIO 0.66`, `ACHICA_FIN 0.75`, `BAJA_INICIO 0.75`, `BAJA_FIN 1.0`.
- Forma y movimiento: `ESCALA 1.0`, `ALTURA_M 2.7`, `RESPIRACION_S 7`, `RESPIRACION_AMP 0.18`, `BALANCEO_M 0.12`, `BALANCEO_S 5.5`, `GIRO_DEG_S 6`, `INCLINACION_DEG 9`.
- Color: `COLOR_VEL 0.08`, `PALETA_PROYECTO 0`, `BRILLO 1.0`.
- Música: `MUSICA_APERTURA 0`.

**Valores de la prueba en Node (14 OK, 0 fallas):**
- tDia 0,29: prisma 0,259.
- tDia 0,31: prisma 0,5.
- tDia 0,37: prisma 1, flor 0,67.
- tDia 0,42: flor 1.
- tDia 0,70: flor 0,89, apertura 0,034.
- tDia 0,75: flor 0.
- tDia 0,80: prisma 0,896.
- tDia 0,90: prisma 0,352.
- tDia 1,0: prisma 0.
- Monótona y continua (paso máximo 0,0033 por 1e-4 de tDia), 0 igual a 1, congelada con la pausa, apagada con `ACTIVO false` o sin ciclo.

**Decisiones sobre los sistemas que dependían de la posición del prisma:**
- Tecla E y pasar por encima: protegidos por `!isVizActivated()`, así que con el prisma arriba no se vuelven a disparar.
- Haces de los paneles y arcoíris del caparazón: usan `PRISM_POS_UNIFORM`, pero paneles y caparazón están ocultos con el visualizador activo. No se tocaron.
- Luces, HazRings y monolitos: tienen posiciones fijas e independientes.
- `prism-landed`: se emite una sola vez y no se vuelve a emitir.
- Fractal del prisma: usa la distancia real, así que se desvanece con el prisma arriba. Se agregó el flag `PROX_USA_BASE` para medir desde la base si se prefiere.
- Decisión para revisar: la flor se dibuja con `vizActive` y con el ciclo nuevo; no hay versión para el ciclo viejo.

**Qué se verificó:**
- `tsc` sin errores. Lint igual que la base en ese momento.
- Prueba en Node de la coreografía y prueba de checkpoints (27 OK).
- Capturas en Chrome headless (SwiftShader) en T_MANUAL 0,20 a 0,95: el prisma sube, se ve alto en 0,34 y 0,5 y baja en 0,8; la flor aparece sobre la tarima con tallo en S y colores térmicos.
- En la primera captura de cerca la cabeza parecía un sombrero de hongo plano y más chica de lo pedido. Se retocaron los pétalos:
  - `PET_W 0.27`, `PET_T 0.22`, `PET_L 0.52`.
  - Copa con phi exterior `mix(0.28, 1.15)` e interior `mix(0.10, 0.80)`.
  - Radios de anillo 0,2 y 0,1.
  - Cabeza × 1,45.
- **Sin verificar:** el aspecto después de ese retoque (la recaptura salió en blanco), los FPS y el build de webpack de Z54.

**Qué tenés que probar a mano (con el tema real):**
- El prisma sube desde el primer cuarto del ciclo.
- La flor nace donde estaba el prisma y desaparece justo al terminar el tercer cuarto.
- El prisma baja despacio durante el último cuarto.
- Un día nuevo con LOOP empieza con el prisma apoyado.
- La pausa congela todo.
- Los tres checkpoints nuevos funcionan.
- La interacción con el prisma no se rompe.
- El aspecto de la flor, comparado con el video.
- Los FPS.

---

## Z55: sol centrado (medido en píxeles), flor 33 % más baja, ondas más evidentes (EN CURSO, sin informe)

> **No hay informe: la tarea no terminó.** El prompt de Z55 llegó **cortado**. Termina a mitad de oración, en "Requisito: la diferencia horizontal entre el centro del sol y el eje de la". Solo llegó el AJUSTE 1 (sol centrado), sin el umbral del requisito. Los AJUSTES 2 (flor 33 % más baja) y 3 (ondas más evidentes) **no llegaron y no se hicieron**: por eso no existen `DBG_FLOR.ALTURA_FACTOR` ni `DBG_ONDAS.EVIDENCIA`. Reenviá el prompt completo.

**Estado del ajuste 1 (sin commit, todavía sin el informe final):**

**Causas encontradas (evidencia: prueba en Node y capturas en Chrome headless):**

- **Causa principal, el candidato (a):** el sol apuntaba a `PORTAL_C` = (0,0461; −0,0609), que es el centro del círculo exterior y de los anillos concéntricos. El sol ilustrado, los discos crema y rojo y el pico de la montaña central están sobre `SUN_C.x` = 0,0082. La diferencia es 0,0379 en coordenadas del portal: unos 1,9° a 2,3° de azimut, y en la vista de prueba unos 13 px. En el primer plano capturado el disco y el pico quedan en x ≈ 627 px y la cruz de `PORTAL_C` en x ≈ 640 px.
- **Causa secundaria, el candidato (b):**
  - El modo "eje" ponía el sol a azimut constante. La vertical de la composición es una recta en el plano inclinado del portal (elevación de unos 34°), no un meridiano, así que su azimut cambia con la altura: −0,79° en el horizonte y +1,45° a 60°, respecto del centro.
  - Por eso el desvío dependía de tDia. Cerca del mediodía las dos causas se compensan en parte, lo que explica que "en otros momentos casi coincide".
- **Descartados:**
  - (c): el shader del domo y `SolFlare` usan direcciones relativas a la cámara, sin rotación propia.
  - (d) y (e): todavía no hay medición limpia.

**Corrección implementada:**
- `cicloDia.ts`:
  - `solSobreEje(P, U, alt, out)` pone el sol sobre el gran círculo de la recta vertical de la composición, a la altura que ya calculaba el ciclo. La altura no cambia, solo el azimut.
  - `PORTAL_GEOM` suma `ejeP`, `ejeU` y `ejeElevCentro`.
  - `SOL_AZ_OFFSET_DEG` sigue funcionando: gira el resultado alrededor de la vertical.
- `DomeSky.tsx`: escribe `ejeP`, `ejeU` y `ejeElevCentro` según `DBG_DIA.SOL_EJE_CENTRO`.
- `portalEscala.ts`: agrega `SUN_C_SHADER`; la prueba verifica que coincida con el GLSL.
- Flags nuevos:
  - `DBG_DIA.SOL_EJE_IMAGEN` (default `true`; `false` vuelve a Z51).
  - `DBG_DIA.SOL_EJE_CENTRO` (default `"composicion"` = `SUN_C`; `"portal"` = `PORTAL_C`, el de Z50).
- `EjeOverlay.tsx` (nuevo): con `DBG_PORTAL.OVERLAY_EJE`, que ya existía desde Z50 y está oculto por defecto, dibuja tres marcas y expone `window.__eje` con los píxeles.
  - La recta del eje.
  - Una cruz en el centro elegido.
  - Un anillo en el sol.
- `DebugMenu.tsx`: botones para los dos flags y diferencia en px y grados en el indicador del eje.
- `ciclo-dia-test.mjs`: 57 OK, con la sección Z55. El sol queda sobre la recta `SUN_C.x` en todo el ciclo con error menor a 1e-17, con la misma altura que antes, continuo, el ciclo cierra y el desplazamiento funciona.

**Δaz del sol de antes (Z51) respecto del eje nuevo, por tDia:**

| tDia | 0,20 | 0,22 | 0,25 | 0,30 | 0,40 | 0,50 | 0,65 | 0,80 |
|---|---|---|---|---|---|---|---|---|
| Δaz | 2,34° | 2,32° | 2,28° | 2,23° | 2,08° | 1,94° | 2,16° | 2,34° |

**Pendiente:**
- Cerrar la medición en píxeles antes y después. La primera, por centroide de brillo y por diferencia de imágenes, dio ruido de unos ±5 px por el cielo brillante, el confeti y los anillos animados. Se estaba repitiendo, promediada y sin rayos, cuando llegó Z56.
- Revisar (d), los rayos.
- Build con webpack.
- El informe final.
- Ajustes 2 y 3, cuando llegue el prompt completo.

**Para que decidas:** los anillos concéntricos y el círculo exterior están centrados en `PORTAL_C`, unos 13 px a la derecha del pico. Con el default nuevo, el sol se alinea con el pico y los discos, no con los anillos. Si preferís el centro de los anillos, cambiá a `SOL_EJE_CENTRO "portal"`. Otra opción, en una tarea aparte, es mover los anillos al eje del pico.
