# lab2026 — Film Commission Tierra del Fuego (monorepo)

## Estructura
- `frontend/`: Next.js 16 (App Router), React 19, TypeScript estricto, Tailwind 4. El alias `@/*` apunta a `frontend/*` (no hay carpeta `src`).
- `backend/`: NestJS + Prisma + PostgreSQL (Supabase). No lo toques salvo que se pida explícitamente.

## Comandos (correr dentro de `frontend/`)
- `npm run dev`: servidor de desarrollo
- `npm run lint`
- `npx tsc --noEmit`: chequeo de tipos
- `npm run build`
Una tarea no está terminada hasta que `lint` y `tsc` no den errores nuevos.

## Experiencia interactiva "alight"
- Ruta: `frontend/app/alight/page.tsx`, que carga `components/ThreeScene.tsx` con `dynamic(..., { ssr: false })`.
- Stack 3D: three 0.183, @react-three/fiber 9, @react-three/drei 10, @react-three/postprocessing 3.
- `components/ThreeScene.tsx` (~540 líneas) es el `<Canvas>` principal: sala, sillas, domo, prisma, tarima, atril, cámara en primera persona (PointerLockControls). No lo hagas crecer: creá componentes nuevos y montalos con cambios mínimos.
- Estado compartido en `lib/alightStore.ts`. Parámetros de debug en `lib/debugConfig.ts` (objetos de módulo que el `DebugMenu` modifica y los componentes leen en `useFrame`). Audio en `lib/vizAudio.ts` y `lib/audioEngine.ts`.
- Ya hay shaders propios en `components/` (Prism, Audience, DomeVisualizer, FloorVisualizer, FaceDome…). Leé cómo cargan sus uniforms antes de escribir uno nuevo y seguí el mismo patrón.

## Convenciones
- Todo componente que use three.js lleva `"use client"` y se importa con `dynamic` + `ssr: false`.
- Los valores ajustables en vivo van en `lib/debugConfig.ts`, no hardcodeados.
- En `useFrame` no crees objetos nuevos (Vector3, Color, etc.): reutilizalos.
- Mantené el estilo de comentarios existente (etiquetas tipo G2, H1.1) en el código que ya las usa.

## Estilo visual: cassette futurism / retro-futurismo 70s
Referencia: tecnología de *Alien* (1979), cartelería de cintas VHS/Beta. Hardware utilitario, voluminoso y gastado; nunca limpio ni futurista moderno.
- Todo objeto o superficie nueva lleva una banda de franjas paralelas o un bloque de marca ficticia (wordmark + código de modelo + serigrafía técnica). Nunca marcas reales.
- Paleta: base beige `#E8DCC4`, óxido `#C0552F`, carbón `#3A3B3C`, negro azulado `#12101A`. Franjas: `#E5322B` `#F0742A` `#F4B62E` `#2E9E5B` `#1F7FB8`. Pantallas: ámbar `#FF9A1F` sobre `#2A1400`.
- Pantallas CRT: scanlines, curvatura, glow de fósforo, aberración cromática leve.
- Materiales mate con desgaste en bordes; sin cromados ni brillos fuertes.
- Brief completo (leelo solo cuando trabajes en estilo visual): `docs/estilo-retro/retro-futurismo-70s-brief.md`.
- Código del estilo retro: `frontend/lib/retro/` (shaders) y `frontend/components/retro/` (componentes R3F), en TypeScript estricto y usando react-three-fiber, no un renderer propio.
- El post-proceso global usa `@react-three/postprocessing` y se activa con un flag en `debugConfig.ts` (por ejemplo `DBG_RETRO_FX`). Medí FPS antes y después de agregarlo.

## Cómo trabajar conmigo
- Un cambio chico y verificable por vez; proponé un plan antes de tocar archivos de más de ~200 líneas.
- No hagas commit ni push salvo que te lo pida.
- No leas ni modifiques archivos `.env*`.
- Si algo sobre cómo debe sentirse la experiencia es ambiguo, preguntame antes de decidir.

## Pendiente de completar (Ezequiel)
-  Qué es "alight" en una frase y para quién es. Es una instalacion interactiva que busca que el usuario reflexione sobre el rol del artista y la audiencia. Eligiendo si quiere consumir una experiencia o producirla, viendo la luz o posicionandose abajo del reflector.  Gran parte de lo que hace el ser humano, del arte y de lo audiovisual, es dirigir la luz hacia lo que debe llamar la atención, y la audiencia presta atención a eso. Quedan abiertas la responsabilidad de a qué le prestamos atención y quién elige dónde poner el foco.
Para el artista, ponerse bajo el foco es exponer su trabajo, su experiencia, sus conceptos, sus ideas y su hipótesis, y la chance de difundirlas. Pero también están las consecuencias de exponerse y mostrarse frágil ante el juicio de una audiencia.
-  Dónde se va a mostrar: principalmente en pcs o notebooks con webcams y con rendimientos arriba de la media 
