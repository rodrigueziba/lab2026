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

---

## Herramientas

- Three.js / React Three Fiber — MIT
- Next.js — MIT
- NestJS — MIT
- Prisma — Apache 2.0
- sharp — Apache 2.0
