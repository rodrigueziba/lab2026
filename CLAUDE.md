# lab2026 — Film Commission Tierra del Fuego (monorepo)

## Estructura
- `frontend/`: Next.js 16 (App Router), React 19, TypeScript estricto, Tailwind 4. El alias `@/*` apunta a `frontend/*` (no hay carpeta `src`).
- `backend/`: NestJS + Prisma + PostgreSQL (Supabase). No lo toques salvo que se pida explícitamente.

## Comandos (correr dentro de `frontend/`)
- `npm run dev`: servidor de desarrollo
- `npm run lint`
- `npx tsc --noEmit`: chequeo de tipos
- `npx next build --webpack`: build. `npm run build` falla porque el proyecto tiene config de webpack y Next 16 usa Turbopack por defecto.
- Una tarea no está terminada hasta que `tsc` no dé errores y `lint` no dé errores NUEVOS. El proyecto arrastra errores de lint previos (221 errores y 184 advertencias al 2026-11-08): no los arregles de paso, no los aumentes.

## Alight: qué es
Instalación interactiva que busca que el usuario reflexione sobre el rol del artista y de la audiencia. Elige si quiere consumir una experiencia (camino SILLAS: ver la luz) o producirla (camino TARIMA: ponerse bajo el reflector). Gran parte de lo que hace el ser humano, del arte y de lo audiovisual, es dirigir la luz hacia lo que debe llamar la atención, y la audiencia presta atención a eso. Quedan abiertas la responsabilidad de a qué le prestamos atención y quién elige dónde poner el foco. Para el artista, ponerse bajo el foco es exponer su trabajo, su experiencia, sus conceptos y sus ideas, y tener la chance de difundirlas, pero también mostrarse frágil ante el juicio de una audiencia.
Dónde se muestra: principalmente en PCs o notebooks con webcam y rendimiento por encima de la media. Uso académico (Trabajo de Integración Final, UNTDF).

## Alight: arquitectura
- Ruta: `frontend/app/alight/page.tsx`, que carga `components/ThreeScene.tsx` con `dynamic(..., { ssr: false })`. En `/alight` no se muestran el footer ni el tour de bienvenida (`components/HideOnAlight.tsx`, usado en `app/layout.tsx`).
- Stack 3D: three 0.183, @react-three/fiber 9, @react-three/drei 10, @react-three/postprocessing 3.
- `components/ThreeScene.tsx` es el `<Canvas>` principal y ya es muy grande. No lo hagas crecer: creá componentes nuevos y montalos con cambios mínimos.
- Estado en `lib/alightStore.ts`. Parámetros de debug en `lib/debugConfig.ts` (objetos de módulo que el `DebugMenu` modifica y los componentes leen en `useFrame`; hay objetos por área: `DBG_SILLAS`, `DBG_PRISM`, `DBG_FLOOR`, `DBG_EFFECTS`, `DBG_LECTERNS`, `DBG_AUDIO`, `DBG_FLASH`). Audio en `lib/vizAudio.ts` y `lib/audioEngine.ts`.
- Componentes clave: `Prism`, `ExperienceDome`, `DomeVisualizer`, `FloorVisualizer`, `SectorAudioFX`, `LecternSystem`, `Audience`, `Curtain`, `CurtainFlash`, `RetroPostFX`.
- Antes de escribir un shader nuevo, leé cómo cargan sus uniforms los existentes y seguí el mismo patrón.

## Alight: flujo y eventos
- Estados (`experienceState`): `cortina`, `exploracion`, `sillas_secuencia`, `sala_activa`.
- Eventos globales (window): `alight:curtain-passed`, `alight:curtain-done`, `alight:chose-chairs`, `alight:chose-light`, `alight:prism-landed`, `alight:dome-revealed`, `alight:visualizer-activate`, `alight:visualizer-deactivate`, `alight:sala-activa`, `alight:dawn-complete`.
- Inicio: telón rojo (se atraviesa; al pasar hay un destello de luz que pasa por el CRT) → exploración libre → el usuario elige camino caminando hacia las sillas o hacia la tarima.
- Camino SILLAS: se bloquea el movimiento, baja el prisma, aparecen los paneles con proyectos (solo en este camino y solo tras `alight:prism-landed`; desaparecen al interactuar con el prisma), con la tecla E sobre el prisma se activa el visualizador del domo, el piso se divide en 4 sectores y hay 4 haces de luz con interruptor.
- Camino TARIMA: atriles de imagen (izquierda) y sonido (derecha), cámara web, audiencia. Los controles están en `docs/LECTERN_CONTROLS.md`.
- Monolitos de obsidiana a cada lado de la tarima (izquierdo: imagen; derecho: sonido). Sesión remota con LiveKit: pendiente, hoy hay un mock.
- Los haces (4) y los grupos del visualizador (SOL, MONTAÑAS, CIELO, LÍNEAS ONDULANTES) están asociados a 4 bandas de audio asignadas al azar en cada carga. Cada haz es un interruptor (`bandOn`) de la reacción de su grupo; el grupo no desaparece al volver a pasar.

## Visualizador del domo
- Shader del portal en `frontend/app/alight/dome/` (`DomeSky.tsx`, `dome.frag.glsl`, `dome.vert.glsl`, `domeShaders.ts`). Contrato de uniforms en `docs/dome/SPEC.md`: no cambies nombres de uniforms sin actualizar el shader, `DomeSky.tsx` y `SPEC.md`.
- Si editás `dome.frag.glsl`, regenerá `domeShaders.ts` con el mismo contenido.
- Sin `colorspace_fragment` ni `tonemapping_fragment` en el shader. Las texturas del portal usan `NoColorSpace`.
- El shader es el material de la superficie interior del domo original (flag `domoShaderEnMalla`). El panorama anterior de capas SVG (`public/alight/visualizer/`) queda apagado detrás de un flag y no se borra.
- Hay una secuencia de amanecer de 10 s al pasar por el primer haz.
- Las bandas llegan por una función, no por estado de React. En `useFrame` no se crean objetos.
- Fondos tipo esfera o domo: `depthWrite` false, `depthTest` true y `renderOrder` bajo; los objetos transparentes de la escena, con `renderOrder` mayor. No uses `depthTest` false con `transparent` en fondos: se pintan encima de todo.
- Quitar o agregar luces cambia la cantidad de luces y hace que three.js recompile los materiales (tirón). Preferí intensidad 0 y hacelo, si hay que cambiar luces, detrás de un momento tapado (por ejemplo el destello).

## Post-proceso y debug
- Orden de pases en `RetroPostFX.tsx`: escena → bloom → CRT → salida. Los efectos que deban sentirse parte del mundo (por ejemplo el destello) se inyectan antes del CRT, no como overlay HTML.
- Menú de debug: se abre con Shift. Los clics dentro del menú y de cualquier panel de debug (`data-debug-panel`) no deben capturar el mouse de la cámara. Los overlays de debug van ocultos por defecto.

## Convenciones
- Todo componente que use three.js lleva `"use client"` y se importa con `dynamic` + `ssr: false`.
- Los valores ajustables en vivo van en `lib/debugConfig.ts`, no hardcodeados, y quedan expuestos en el menú de debug.
- En `useFrame` no crees objetos nuevos (Vector3, Color, etc.): reutilizalos. Sin allocations por frame.
- Limpiá listeners, texturas, geometrías, luces y audio al desmontar.
- Si algo sobra, desactivalo con un flag; no lo borres.
- Mantené el estilo de comentarios existente (etiquetas tipo G2, H1.1) en el código que ya las usa.

## Estilo visual: cassette futurism / retro-futurismo 70s
Referencia: tecnología de *Alien* (1979), cartelería de cintas VHS/Beta. Hardware utilitario, voluminoso y gastado; nunca limpio ni futurista moderno.
- Todo objeto o superficie nueva lleva una banda de franjas paralelas o un bloque de marca ficticia (wordmark + código de modelo + serigrafía técnica). Nunca marcas reales.
- Paleta: base beige `#E8DCC4`, óxido `#C0552F`, carbón `#3A3B3C`, negro azulado `#12101A`. Franjas: `#E5322B` `#F0742A` `#F4B62E` `#2E9E5B` `#1F7FB8`. Pantallas: ámbar `#FF9A1F` sobre `#2A1400`.
- Telón: rojo `#990000`.
- Pantallas CRT: scanlines, curvatura, glow de fósforo, aberración cromática leve.
- Materiales mate con desgaste en bordes; sin cromados ni brillos fuertes.
- Excepciones deliberadas: los monolitos son de obsidiana pulida y brillante (forma de obelisco torcido sobre base cuadrada, sin luces propias, brillo por reflejos del entorno); y el visualizador del domo es una ilustración vectorial plana de atardecer (colores planos, estilo de la imagen de referencia), no hardware de los 70.
- Brief completo (leelo solo cuando trabajes en estilo visual): `docs/estilo-retro/retro-futurismo-70s-brief.md`.
- Código del estilo retro: `frontend/lib/retro/` (shaders) y `frontend/components/retro/` (componentes R3F), en TypeScript estricto y usando react-three-fiber, no un renderer propio.
- El post-proceso global se activa con un flag en `debugConfig.ts` (por ejemplo `DBG_RETRO_FX`). Medí FPS antes y después de agregarlo.

## Cómo trabajar conmigo
- Trabajá por etapas y escribí directo en los archivos, sin pegar código largo en la respuesta (límite de 32000 tokens de salida). Un cambio verificable por vez; si el archivo tiene más de ~200 líneas, proponé un plan antes.
- Rama de trabajo: `sillas-narrativa`. Antes de una tarea que toque varios archivos, hacé un commit de seguridad. Después no commitees ni hagas push salvo que te lo pida.
- Prohibido `git reset --hard`, `git checkout .` y `git clean`. Para mirar versiones viejas usá `git show` o `git worktree`.
- Ediciones quirúrgicas con Edit. No reescribas archivos enteros ni toques lo que no se pidió.
- No leas ni modifiques archivos `.env*`.
- Si no podés abrir el navegador para verificar (en algunas PCs no hay Playwright con WebGL), decilo en el reporte y validá leyendo el código; no afirmes que "se ve bien".
- Reporte final: archivos tocados, causa (con evidencia), valores anteriores y nuevos, decisiones tuyas que yo deba revisar, supuestos, y qué tengo que probar yo.
- Si algo sobre cómo debe sentirse la experiencia es ambiguo, preguntame antes de decidir. Si trabajás sin que yo esté mirando, tomá la lectura más razonable y decí cuál tomaste.

## Diálogos (ink)
- Fuente: `docs/dialogos/dialogo-luz.ink` (diálogo del camino LUZ). Es el único archivo que se edita.
- Recompilar: `npm run ink:build` (en `frontend/`). Genera `frontend/public/alight/dialogo/dialogo-luz.json` (lo lee el runtime) y regenera `docs/dialogos/MAPA_DIALOGOS.md` y `docs/dialogos/mapa.mmd`.
- Probar: `npm run ink:test` (recorre caminos con el runtime y verifica textos, opciones y tags).
- Tags al inicio de cada knot: `# id: 1.b.c`, `# estado: cerrado | pendiente`, `# efecto: <nombre>` (lo ejecuta el juego, no ink). Opciones `* [Texto.] -> knot`. Cursiva `*texto*`, negrita `**texto**`.
- `MAPA_DIALOGOS.md` y `mapa.mmd` son GENERADOS: no los edites a mano.
- En el navegador se usa solo el runtime (`inkjs`) vía `lib/dialogo/dialogoInk.ts`; el compilador (`inkjs/full`) solo en `scripts/ink-build.mjs`.

## Documentos de referencia (leer solo cuando haga falta)
- `docs/estilo-retro/retro-futurismo-70s-brief.md`: estilo visual.
- `docs/dome/SPEC.md`: contrato de uniforms del visualizador.
- `docs/LECTERN_CONTROLS.md` y `docs/LECTERN_STATUS.md`: atriles del camino TARIMA.
- `docs/NARRATIVA_STATUS.md`: auditoría de la narrativa del camino SILLAS. Es una foto con fecha: puede estar desactualizada; si te pido una auditoría nueva, regenerala.
- `CREDITOS.md`: atribuciones de terceros. Si usás código o ideas de terceros, agregá la atribución.