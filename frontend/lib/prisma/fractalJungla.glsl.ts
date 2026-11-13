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
//
// Z44 (uPaletaOriginal = 1, default): colores EXACTOS del original (mismas fórmulas de las dos ramas y el
// mismo rand; la región v ≤ depthCull·0,1 es negra como en el original). Encuadre del original sobre la cara:
// position = (uv.x, uv.y · ASPECTO) − offset, con uv.x = 0…1 a lo ancho de la base de la cara y uv.y en las
// mismas unidades (isótropo: el cuadro 16:9 del original ocupa la parte baja de la cara y sigue hacia la
// punta). rand sobre una grilla virtual de GRANO_RES × GRANO_RES·ASPECTO "píxeles", como gl_FragCoord.
// Salida: el composer aplica ACES (exposición) + sRGB a toda la escena en el OutputPass (el material no tiene
// tonemapping propio: toneMapped/fog del material no cambian nada acá). Para que se vea con los valores de
// pantalla del original, el color se pasa por la inversa de ACES + sRGB (uCompensar 2; 1 = solo sRGB; 0 = nada).
// El CRT (scanlines, tinte crema, lift, viñeta) y el bloom siguen actuando, como en todo el mundo; uCompTope
// limita el valor compensado (los blancos del original, que en ACES serían ∞, no encienden el bloom).
// Con uPaletaOriginal = 0 todo vuelve exactamente a la versión dorada de Z43.

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
  #define EPS_ORIG 1e-6
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
  // Z44
  uniform float uPaletaOriginal;   // 1 = colores del original; 0 = dorado de Z43
  uniform float uTintePrisma;      // 0…1 mezcla hacia el color de la cara
  uniform vec3  uColCara;          // color de la cara (sRGB, valores de pantalla)
  uniform float uOpacidadOrig;     // opacidad máxima con la paleta original
  uniform float uAspecto;          // ASPECTO_ORIGINAL (16:9 → 0,5625)
  uniform float uGranoRes;         // resolución virtual del grano (0 = continuo)
  uniform float uCaraAncho;        // ancho de la base de la cara (m)
  uniform float uCaraYBase;        // y de la base respecto del baricentro de la cara (m)
  uniform float uEncuadreY;        // corrimiento vertical del cuadro sobre la cara (m)
  uniform float uCompensar;        // 0 nada, 1 sRGB, 2 ACES + sRGB
  uniform float uExposicion;       // renderer.toneMappingExposure
  uniform float uCompTope;         // tope del valor lineal compensado (los blancos del original no disparan el bloom)

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
  float protegidoE(float s, float e) { return (s < 0.0 ? -1.0 : 1.0) * max(abs(s), e); }

  // Z44: inversa de la salida del composer (OutputPass: ACES filmic de three + sRGB).
  vec3 srgbALineal(vec3 c) {
    return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
  }
  vec3 rrtInversa(vec3 y) {
    // y = (v² + a·v − b) / (c·v² + d·v + e)  →  (y·c − 1)·v² + (y·d − a)·v + (y·e + b) = 0, raíz positiva
    vec3 A = y * 0.983729 - 1.0;
    vec3 B = y * 0.4329510 - 0.0245786;
    vec3 C = y * 0.238081 + 0.000090537;
    return (-B - sqrt(max(B * B - 4.0 * A * C, 0.0))) / (2.0 * A);
  }
  vec3 acesInversa(vec3 lin, float expo) {
    const mat3 OUT_INV = mat3(vec3(0.643038, 0.059269, 0.005962), vec3(0.311187, 0.931436, 0.063929), vec3(0.045775, 0.009295, 0.930118));
    const mat3 IN_INV  = mat3(vec3(1.764741, -0.147028, -0.036337), vec3(-0.675778, 1.160252, -0.162436), vec3(-0.088963, -0.013224, 1.198773));
    vec3 y = clamp(OUT_INV * lin, 0.0, 0.99);
    vec3 x = IN_INV * rrtInversa(y);
    return max(x, 0.0) / max(expo / 0.6, 1e-4);
  }

  void main() {
    // semilla de la cara (hoy sin efecto: uCarasDistintas = 0)
    vec4 sel = step(abs(vec4(vCara) - vec4(0.0, 1.0, 2.0, 3.0)), vec4(0.5));
    float semilla = dot(uSemilla, sel) * uCarasDistintas;
    float t = uT + semilla * 7.0;

    vec2 off = uOffset + vec2(sin(t * 0.1), cos(t * 0.1)) * 0.1 + semilla * vec2(0.37, 0.21);
    // Z44: encuadre del original (uv 0…1 a lo ancho; y isótropo) o mapeo de Z43
    vec2 uvO = vec2(vCaraUv.x / uCaraAncho + 0.5, (vCaraUv.y - uCaraYBase - uEncuadreY) / (uCaraAncho * uAspecto));
    vec2 coord = mix(vCaraUv * uEscala + uCentro, vec2(uvO.x, uvO.y * uAspecto), uPaletaOriginal);
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
      v = abs(c.x) + (c.y * c.y) / protegidoE(sin(abs(c.x) * 4.0), mix(EPS, EPS_ORIG, uPaletaOriginal));
      if (v > uBailout || dot(c, c) > mix(1e6, 1e30, uPaletaOriginal)) break;
    }
    c = clamp(c, vec2(-mix(1e3, 1e15, uPaletaOriginal)), vec2(mix(1e3, 1e15, uPaletaOriginal)));

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

    // ── Z44: paleta original (fórmulas del original sin modificar) ──
    vec2 resV = vec2(uGranoRes, uGranoRes * uAspecto);
    vec2 fcV = mix(uvO, (floor(uvO * resV) + 0.5) / max(resV, vec2(1.0)), step(0.5, uGranoRes));   // gl_FragCoord/iResolution
    float randO = mod(fract(sin(dot(2.5 * fcV, vec2(12.9898, 100.233))) * 43758.5453), 0.7) * uGrano;
    vec3 colOA = colA;                                                              // rama de escape rápido (alfa .3 en Shadertoy: se ve opaca)
    vec3 colOB = (randO + vec3(pow(max(vb + 0.46, EPS_ORIG), -0.75))) * vec3(0.1, 0.17, 0.2);   // rama principal
    vec3 colO = clamp((mA * colOA + mB * colOB) * uMusBrillo, 0.0, 1.0);           // resto: negro, como el original
    colO = mix(colO, uColCara, uTintePrisma);
    vec3 linO = srgbALineal(colO);
    colO = mix(colO, mix(linO, min(acesInversa(linO, uExposicion), vec3(uCompTope)), step(1.5, uCompensar)), step(0.5, uCompensar));
    float alfaO = uProx * uOpacidadOrig;

    col = mix(col, colO, uPaletaOriginal);
    alfa = mix(alfa, alfaO, uPaletaOriginal);
    gl_FragColor = vec4(col, clamp(alfa, 0.0, 1.0));
  }
`;
