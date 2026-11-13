// Z43: fractal de las caras del prisma.
//
// Adaptación de "jungle fractal II" de George Toledo (2015), publicado en Shadertoy.
// Sin licencia declarada: rige la de Shadertoy por defecto, CC BY-NC-SA 3.0 (ver CREDITOS.md).
// Usa "Cellular noise (Worley noise) in 2D in GLSL", Copyright (c) Stefan Gustavson 2011-04-19,
// publicado bajo la licencia MIT (http://webstaff.itn.liu.se/~stegu/GLSL-cellular/):
//   Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
//   associated documentation files (the "Software"), to deal in the Software without restriction, including
//   without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
//   copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the
//   following conditions: The above copyright notice and this permission notice shall be included in all
//   copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY
//   KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
//   PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
//   CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF
//   OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
//
// Cambios respecto del original:
// - Sin iResolution / iTime / gl_FragCoord / mainImage. La coordenada es la de la cara en metros (atributo
//   aCaraUv, armado en Prism.tsx por cara, isótropo: no se estira) × uEscala + uCentro; el tiempo es uT
//   (tiempo propio acumulado con velocidad según la cercanía, congelado en la pausa).
// - K, Ko y JITTER fuera de la función; cmult con .x/.y en vez de p[0]/p[1].
// - División por sin(|c.x|·4) protegida con EPS; corte extra si |c| crece sin pasar el bailout (evita inf/NaN);
//   smoothstep(d.x, .1, .7) del original (bordes invertidos, indefinido en GLSL) escrito explícito.
// - Constantes (zoom, bailout, X, Y, offset, depthCull, iteraciones) como uniforms.
// - Color: del original se usa solo la intensidad (luminancia; en la región media el tinte (.1,.17,.2) pesa
//   0,157) y se pinta con la paleta del prisma (uColOscuro → uColMedio → uColClaro). Las dos regiones del
//   original se combinan con máscaras (sin if/else); la región "vacía" queda transparente.
// - Ruido celular detrás de #define CELULAR (0/1): apagarlo saca las dos búsquedas por píxel.

export const FRACTAL_JUNGLA_VERT = /* glsl */`
  attribute vec2  aCaraUv;
  attribute float aCara;
  varying vec2  vCaraUv;
  varying float vCara;
  void main() {
    vCaraUv = aCaraUv;
    vCara   = aCara;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const FRACTAL_JUNGLA_FRAG = /* glsl */`
  #define K 0.142857142857
  #define Ko 0.428571428571
  #define JITTER 1.0
  #define EPS 1e-3
  #define MAX_ITER 32
  #ifndef CELULAR
  #define CELULAR 1
  #endif

  uniform float uT;
  uniform float uProx;
  uniform float uOpacidad;
  uniform float uAlfaOscuro;
  uniform float uBrillo;
  uniform float uBrilloProx;
  uniform float uIter;
  uniform float uZoom;
  uniform float uBailout;
  uniform vec2  uC;          // (X, Y)
  uniform vec2  uOffset;
  uniform float uDepthCull;
  uniform float uGrano;
  uniform float uEscala;
  uniform vec2  uCentro;
  uniform vec3  uColOscuro;
  uniform vec3  uColMedio;
  uniform vec3  uColClaro;
  uniform vec4  uSemilla;          // una por cara (0, 1, 2 = lados; 3 = base)
  uniform float uCarasDistintas;   // 0 = mismas caras (uSemilla sin efecto)
  uniform float uMusZoom;          // × zoom (graves)
  uniform vec2  uMusC;             // + (X, Y) (medios)
  uniform float uMusBrillo;        // × brillo (agudos)

  varying vec2  vCaraUv;
  varying float vCara;

  vec3 permute(vec3 x) { return mod((34.0 * x + 1.0) * x, 289.0); }

  // Cellular noise (Stefan Gustavson, MIT): F1 y F2 en un vec2, ventana 3×3.
  vec2 cellular(vec2 P) {
    vec2 Pi = mod(floor(P), 289.0);
    vec2 Pf = fract(P);
    vec3 oi = vec3(-1.0, 0.0, 1.0);
    vec3 of = vec3(-0.5, 0.5, 1.5);
    vec3 px = permute(Pi.x + oi);
    vec3 p = permute(px.x + Pi.y + oi);
    vec3 ox = fract(p * K) - Ko;
    vec3 oy = mod(floor(p * K), 7.0) * K - Ko;
    vec3 dx = Pf.x + 0.5 + JITTER * ox;
    vec3 dy = Pf.y - of + JITTER * oy;
    vec3 d1 = dx * dx + dy * dy;
    p = permute(px.y + Pi.y + oi);
    ox = fract(p * K) - Ko;
    oy = mod(floor(p * K), 7.0) * K - Ko;
    dx = Pf.x - 0.5 + JITTER * ox;
    dy = Pf.y - of + JITTER * oy;
    vec3 d2 = dx * dx + dy * dy;
    p = permute(px.z + Pi.y + oi);
    ox = fract(p * K) - Ko;
    oy = mod(floor(p * K), 7.0) * K - Ko;
    dx = Pf.x - 1.5 + JITTER * ox;
    dy = Pf.y - of + JITTER * oy;
    vec3 d3 = dx * dx + dy * dy;
    vec3 d1a = min(d1, d2);
    d2 = max(d1, d2);
    d2 = min(d2, d3);
    d1 = min(d1a, d2);
    d2 = max(d1a, d2);
    d1.xy = (d1.x < d1.y) ? d1.xy : d1.yx;
    d1.xz = (d1.x < d1.z) ? d1.xz : d1.zx;
    d1.yz = min(d1.yz, d2.yz);
    d1.y = min(d1.y, d1.z);
    d1.y = min(d1.y, d2.x);
    return sqrt(d1.xy);
  }

  vec2 cmult(vec2 a, vec2 b) { return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x); }

  // signo sin cero y magnitud mínima EPS (evita dividir por 0 o por casi 0)
  float protegido(float s) { return (s < 0.0 ? -1.0 : 1.0) * max(abs(s), EPS); }

  void main() {
    // semilla de la cara (hoy sin efecto: uCarasDistintas = 0)
    vec4 sel = step(abs(vec4(vCara) - vec4(0.0, 1.0, 2.0, 3.0)), vec4(0.5));
    float semilla = dot(uSemilla, sel) * uCarasDistintas;
    float t = uT + semilla * 7.0;

    vec2 off = uOffset + vec2(sin(t * 0.1), cos(t * 0.1)) * 0.1 + semilla * vec2(0.37, 0.21);
    vec2 coord = vCaraUv * uEscala + uCentro;
    vec2 position = (coord - off) * (uZoom * uMusZoom + sin(t * 0.1) * 0.2);
    vec2 c0 = vec2(uC.x + sin(t) * 0.01, uC.y + cos(t) * 0.02) + uMusC;

    vec2 c = position;
  #if CELULAR
    c += sin(t + cellular(c) * 0.1) * 0.01;
  #else
    c += sin(vec2(t)) * 0.01;
  #endif

    vec2 d = vec2(0.0);
    float v = 0.0;
    for (int i = 0; i < MAX_ITER; i++) {
      if (float(i) >= uIter) break;
      d = cmult(c, c);
      c = d + c0;
      v = abs(c.x) + (c.y * c.y) / protegido(sin(abs(c.x) * 4.0));
      if (v > uBailout || dot(c, c) > 1e6) break;
    }
    c = clamp(c, vec2(-1e3), vec2(1e3));

    float l = sin((c.y * 2.0) * 0.23);
  #if CELULAR
    c += cellular(c * 23.0);
  #endif
    c.x += sin(c.y * 2.0);
    c.y += sin(c.x * 20.0) * 0.1;
    c.x += sin(c.y * 3.0);
    c.y += sin(c.x * 5.0);

    float rnd = mod(fract(sin(dot(2.5 * coord, vec2(12.9898, 100.233))) * 43758.5453), 0.7) * uGrano;

    // región exterior (v > depthCull·100): intensidad del color original
    float den = protegido(0.1 - d.x);
    float ss = clamp((0.7 - d.x) / den, 0.0, 1.0);
    ss = ss * ss * (3.0 - 2.0 * ss);
    vec3 colA = vec3(sin(c.x * l * 10.0) * 0.6, length(-1.5 - sin(-c * 0.6)) * 0.17, sin(c.y * l) * 0.5) * ss;
    float iA = dot(max(colA, 0.0), vec3(0.2126, 0.7152, 0.0722));

    // región media (depthCull·0,1 < v < depthCull·100)
    float cx = c.x + t * 1.1;
    float vb = v
      + (sin(cx * 1.1) + sin(c.y * 2.3) + sin(cx * 3.5) + sin(c.y * 4.0) + sin(c.y * 6.0) + sin(cx * 5.0) + sin(cx * 10.0)) * 0.1
      + sin(cx * 128.0) * 0.01;
  #if CELULAR
    vb += cellular(vec2(cx, c.y)).x;
  #endif
    vb = exp(min(max(0.0, vb), 30.0)) - 1.4;
    float iB = (rnd + pow(max(vb + 0.46, EPS), -0.75)) * 0.157;

    float mA = step(uDepthCull * 100.0, v);
    float mB = (1.0 - mA) * step(uDepthCull * 0.1, v);
    float inten = mA * iA + mB * iB;

    vec3 col = mix(uColOscuro, uColMedio, smoothstep(0.0, 0.45, inten));
    col = mix(col, uColClaro, smoothstep(0.45, 1.0, inten));
    col *= uBrillo * uMusBrillo * (1.0 + uProx * uBrilloProx);

    float alfa = (mA + mB) * uProx * uOpacidad * mix(uAlfaOscuro, 1.0, clamp(inten, 0.0, 1.0));
    gl_FragColor = vec4(col, clamp(alfa, 0.0, 1.0));
  }
`;
