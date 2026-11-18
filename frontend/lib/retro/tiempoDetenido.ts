// Z86: ESTILO "slitscan" (default): retraso por filas desde un historial nítido (textura de capas), estela de luces,
// desfase de color en el tiempo y banda de seguimiento VHS. Engancha en escena(p) del pase final (la lectura de la
// escena que hace el CRT): el CRT se aplica encima de la imagen atrasada. Punto de entrada nuevo:
//   vec3 escenaTiempoDetenido(vec2 p, float k, float tiempo)   (p = uv de la escena, ya con la curvatura del CRT)
// con los uniforms del historial (uHist, uHistA), de la estela (uEstelaTex, uEstela, uEstelaTinte) y de cada efecto
// (uRetro, uOnda, uBanda). ESTILO "provisorio" = efectoTiempoDetenido de Z84, que sigue abajo sin cambios.
// Inspiración: Shadertoy de desplazamiento temporal (autor pendiente); implementación propia (ver CREDITOS.md).
//
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
export const TIEMPO_VISUAL = { k: 0, t: 0, slit: 0 };   // Z86: slit = 1 → ESTILO "slitscan" (rama en escena())

/** Uniforms del efecto (los agrega PaseFinalPass a su material). */
export const TIEMPO_UNIFORMS: Record<string, THREE.IUniform> = {
  uTiempoK: { value: 0 },
  uTiempoT: { value: 0 },
  // Z86: slit-scan (los valores los escribe PaseFinalPass desde HIST_PLAN, lib/retro/historialTiempo.ts)
  uTiempoSlit: { value: 0 },
  uHist:       { value: null },                       // WebGLArrayRenderTarget.texture (null → three liga una vacía)
  uHistA:      { value: [0, 2, 0, 0] },                // nueva, n, disponibles, edad (s)
  uEstelaTex:  { value: null },
  uRetro:      { value: [1.2, 0, 0, 1] },              // retraso máx (0 = apagado), dirección, curva, exponente
  uOnda:       { value: [0.06, 0.5, 20, 0.05] },       // amp, vel, hz del historial, desfase RGB (s; 0 = apagado)
  uBanda:      { value: [0.05, 0.04, 0.25, 0.003] },   // alto (0 = apagada), vel, salto (s), temblor
  uEstela:     { value: [1, 0.7, 0.42, 0.8] },         // tinte rgb, mezcla (0 = apagada)
  uEstelaTinte:{ value: 0.35 },
};

export const GLSL_TIEMPO_DETENIDO_UNIFORMS = /* glsl */`
uniform float uTiempoK;   // Z84: intensidad del tiempo detenido (0 = sin efecto: la rama no se ejecuta)
uniform float uTiempoT;   // Z84: tiempo (s), quieto en la pausa central
uniform float uTiempoSlit;            // Z86: 1 = slit-scan (rama en escena()), 0 = provisorio (rama después del CRT)
uniform highp sampler2DArray uHist;   // Z86: historial (capas RGBA8, color codificado c/(1+c))
uniform vec4  uHistA;                 // nueva, n, disponibles, edad de la nueva (s)
uniform sampler2D uEstelaTex;         // estela acumulada (misma codificación)
uniform vec4  uRetro;                 // retraso máx (s; 0 = apagado), dirección (0 abajo más viejo), curva (1 suave), exponente
uniform vec4  uOnda;                  // amp, vel (rad/s), hz del historial, desfase RGB (s; 0 = apagado)
uniform vec4  uBanda;                 // alto (0 = apagada), vel (vueltas/s), salto (s), temblor (fracción del ancho)
uniform vec4  uEstela;                // tinte rgb, mezcla (0 = apagada)
uniform float uEstelaTinte;
`;

// Z86: slit-scan. Va ANTES de escena() en el pase final (usa escenaBase, la lectura original). Réplica de lib/tiempoHistorial.ts.
export const GLSL_TIEMPO_SLITSCAN = /* glsl */`
vec3 tdDecodificar(vec3 e) { e = min(e, vec3(0.996)); return e / (1.0 - e); }
float tdHash(vec2 p) { return fract(sin(dot(p, vec2(41.37, 289.11))) * 43758.5453); }
float tdFraccionFila(float y) {
  float f = uRetro.y > 0.5 ? clamp(y, 0.0, 1.0) : 1.0 - clamp(y, 0.0, 1.0);
  if (uRetro.z > 0.5) f = f * f * (3.0 - 2.0 * f);
  return pow(f, max(uRetro.w, 0.05));
}
vec3 tdCapa(vec2 p, float capa) { return tdDecodificar(texture(uHist, vec3(p, capa)).rgb); }
// retraso d (s) → mezcla de las dos capas vecinas del anillo (o del cuadro en vivo con la más nueva)
vec3 tdLeer(vec2 p, float d, vec3 vivo) {
  float nueva = uHistA.x, n = uHistA.y, disp = uHistA.z, edad = uHistA.w;
  if (disp < 0.5 || d <= 0.0) return vivo;
  if (d < edad) return mix(tdCapa(p, nueva), vivo, 1.0 - d / max(edad, 1e-6));
  float x = min((d - edad) * uOnda.z, disp - 1.0);
  float i = floor(x);
  float f = i >= disp - 1.0 ? 0.0 : x - i;
  float a = mod(nueva - i + n, n), b = mod(nueva - i - 1.0 + n, n);
  return mix(tdCapa(p, a), tdCapa(p, b), f);
}
vec3 escenaTiempoDetenido(vec2 p, float k, float tiempo) {
  vec3 vivo = escenaBase(p);
  float fr = tdFraccionFila(p.y);
  float onda = uOnda.x * sin(fr * 6.2831853 + tiempo * uOnda.y);
  float d = max(0.0, k * uRetro.x * (fr + onda * fr));
  vec2 q = p;
  if (uBanda.x > 0.0) {                                    // banda de seguimiento: baja despacio, salto y temblor
    float centro = 1.0 - fract(tiempo * uBanda.y);
    float dy = abs(p.y - centro); dy = min(dy, 1.0 - dy);
    float enB = 1.0 - smoothstep(uBanda.x * 0.5, uBanda.x * 0.5 + 0.01, dy);
    d += enB * uBanda.z * k;
    q.x += enB * uBanda.w * k * (tdHash(vec2(floor(p.y * 240.0), floor(tiempo * 30.0))) - 0.5) * 2.0;
  }
  vec3 c;
  if (uOnda.w > 0.0) {                                     // desfase de color: R más viejo, B más nuevo
    float s = uOnda.w * k;
    c = vec3(tdLeer(q, d + s, vivo).r, tdLeer(q, d, vivo).g, tdLeer(q, max(0.0, d - s), vivo).b);
  } else c = tdLeer(q, d, vivo);
  if (uEstela.a > 0.0) {                                   // estela de luces (cámara vieja)
    vec3 e = tdDecodificar(texture(uEstelaTex, p).rgb);
    c += e * mix(vec3(1.0), uEstela.rgb, uEstelaTinte) * uEstela.a * k;
  }
  return c;
}
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
