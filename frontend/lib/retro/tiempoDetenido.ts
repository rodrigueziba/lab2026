// Z84: efecto visual de "tiempo detenido" (solo la cámara propia del usuario, en el camino SILLAS). Se integra en el
// pase final fusionado de Z69 (lib/retro/paseFinal.ts): una rama `if (uTiempoK > 0.0)` después del CRT y antes del tone
// mapping (color en HDR lineal), así no hay pase extra y con k = 0 la imagen es idéntica a la de antes.
// No afecta los overlays HTML (están fuera del canvas). Con PASES_FUSIONADOS = false (pases separados) no se aplica.
//
// ── IMPLEMENTACIÓN PROVISORIA ── El usuario la va a reemplazar por su shader. Para hacerlo:
//   1. Reemplazá el cuerpo de GLSL_TIEMPO_DETENIDO respetando EXACTAMENTE esta firma:
//        vec3 efectoTiempoDetenido(vec2 uv, vec3 color, float k, float tiempo)
//      uv     = coordenadas de pantalla 0…1 (vUv)
//      color  = color del píxel después del CRT, en HDR lineal (antes de ACES y sRGB)
//      k      = intensidad 0…1 (uTiempoK; ya viene × DBG_TIEMPO.INTENSIDAD_VISUAL)
//      tiempo = segundos (uTiempoT; quieto en la pausa central)
//      Devolvé el color nuevo (HDR lineal). Podés leer la escena en otro punto con escena(p) (escena + bloom, sin CRT);
//      para que coincida con la pantalla curva, pasá antes el uv por barrel(uv, uCurve) (son del código del CRT).
//   2. Uniforms adicionales: declaralos en GLSL_TIEMPO_DETENIDO_UNIFORMS (ej. "uniform float uMiParam;"), agregá su
//      { value } en TIEMPO_UNIFORMS (abajo) y escribí su valor por cuadro en lib/tiempoDetenidoAcciones.ts.
//   3. No toques la rama de paseFinal.ts: si k = 0 no se ejecuta (costo cero).

import type * as THREE from "three";

/** Estado que lee el pase final en cada render (lo escribe lib/tiempoDetenidoAcciones.ts). */
export const TIEMPO_VISUAL = { k: 0, t: 0 };

/** Uniforms del efecto (los agrega PaseFinalPass a su material). */
export const TIEMPO_UNIFORMS: Record<string, THREE.IUniform> = {
  uTiempoK: { value: 0 },
  uTiempoT: { value: 0 },
};

export const GLSL_TIEMPO_DETENIDO_UNIFORMS = /* glsl */`
uniform float uTiempoK;   // Z84: intensidad del tiempo detenido (0 = sin efecto: la rama no se ejecuta)
uniform float uTiempoT;   // Z84: tiempo (s), quieto en la pausa central
`;

// Provisoria, tipo CRT: desaturación leve, estela horizontal (ghosting), aberración cromática pequeña, barrido y un
// rodillo vertical leve; todo escalado por k. Usa escena(p), definida antes en el pase final.
export const GLSL_TIEMPO_DETENIDO = /* glsl */`
vec3 efectoTiempoDetenido(vec2 uv, vec3 color, float k, float tiempo) {
  // misma curvatura que el CRT (barrel y uCurve vienen del código del CRT, en el mismo pase): las lecturas extra caen
  // donde las tomó el CRT y fuera de la pantalla curva no se toca nada (queda el borde negro)
  vec2 pb = uCrtOn > 0.5 ? barrel(uv, uCurve) : uv;
  if (pb.x < 0.0 || pb.x > 1.0 || pb.y < 0.0 || pb.y > 1.0) return color;
  // rodillo vertical leve: la imagen "patina" hacia abajo
  float rod = 0.012 * k * sin(tiempo * 1.7);
  vec2 p = vec2(pb.x, clamp(pb.y + rod, 0.0, 1.0));
  // estela horizontal: copias corridas hacia la izquierda, cada vez más tenues
  vec3 estela = escena(p - vec2(0.006 * k, 0.0)) * 0.5 + escena(p - vec2(0.014 * k, 0.0)) * 0.3 + escena(p - vec2(0.024 * k, 0.0)) * 0.2;
  vec3 c = mix(color, estela, 0.45 * k);
  // aberración cromática pequeña (rojo y azul separados en x)
  float ab = 0.0025 * k;
  c.r = mix(c.r, escena(p + vec2(ab, 0.0)).r, 0.6 * k);
  c.b = mix(c.b, escena(p - vec2(ab, 0.0)).b, 0.6 * k);
  // desaturación leve
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(c, vec3(l), 0.45 * k);
  // barrido: una banda clara que baja lento y líneas finas
  float banda = smoothstep(0.0, 0.04, fract(uv.y * 0.5 - tiempo * 0.15)) * (1.0 - smoothstep(0.04, 0.14, fract(uv.y * 0.5 - tiempo * 0.15)));
  c *= 1.0 - 0.12 * k * (0.5 + 0.5 * sin(uv.y * 900.0));
  c += vec3(0.05, 0.045, 0.04) * banda * k;
  return c;
}
`;
