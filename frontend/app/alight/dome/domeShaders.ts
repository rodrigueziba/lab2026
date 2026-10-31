// Generado desde dome.vert.glsl / dome.frag.glsl (importable sin configurar el bundler).
export const domeVert = `// dome.vert.glsl
// Vertex shader del domo. Se usa sobre una esfera/hemisferio con side: BackSide.
// vDir = direccion desde el centro del domo (el espectador esta en el centro).
varying vec3 vDir;

void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const domeFrag = `// dome.frag.glsl
// Visualizador 360: portal con atardecer al frente + tunel de anillos dorados + cielo nocturno alrededor.
//
// Estilo de referencia: ilustracion plana con sol en 3 discos, nubes, montanas en capas y marco de
// anillos concentricos. Las partes "fluidas" usan domain warping (Inigo Quilez, "warp", Shadertoy lsl3RH,
// licencia CC BY-NC-SA 3.0 -> uso academico/no comercial, dejar este credito).
//
// Compatible con GLSL ES 1.00 / three.js ShaderMaterial (no incluir colorspace_fragment: los colores
// estan escritos directamente en sRGB y las texturas deben usar NoColorSpace).
//
// Bandas de audio (todas 0..1, ya suavizadas): x=graves, y=medios bajos, z=medios altos, w=agudos
//   graves      -> pulso del sol + expansion de los anillos dorados
//   medios bajos-> ondulacion de las capas de montanas rayadas (franjas rojas/naranjas/azules)
//   medios altos-> flujo del cielo y nubes (intensidad del domain warp)
//   agudos      -> titileo de estrellas, confeti y destellos
//
// Mascaras (portal-masks.png, RGB sin alpha, NoColorSpace): R = siluetas negras, G = montana
// de estratos verdes/azules, B = zona de olas. Color de estratos/olas: portal-color.png.

varying vec3 vDir;

uniform float uTime;
uniform vec4  uBands;
uniform sampler2D uMasks;
uniform sampler2D uColor;
uniform vec3  uPortalF;     // direccion del centro del portal (unitario)
uniform vec3  uPortalR;     // derecha del portal
uniform vec3  uPortalU;     // arriba del portal
uniform float uPortalTan;   // tan(semi-FOV horizontal de la imagen del portal). Sugerido 0.90 = tan(42deg)
uniform float uWarp;        // 0..2, intensidad base del warp (1.0 por defecto)
uniform float uRingFlow;    // velocidad del flujo de los anillos (0.03 por defecto)
uniform float uRingScale;   // multiplicador del periodo de anillos (1.0)
uniform vec2  uRingFade;    // (inicio, fin) del desvanecimiento de anillos, en unidades "p". Sugerido (1.0, 1.6)
uniform float uStarCut;     // umbral de estrellas, 0.93..0.995 (0.965); mas alto = menos estrellas

// W2: energias por grupo y kick (valores suavizados, 0..1)
uniform vec4  uGroupEnergy; // x=SOL, y=MONTAÑAS, z=CIELO, w=LÍNEAS
uniform float uKick;        // 0..1, destello de kick (~150ms decay)
uniform float uSolAmt;      // multiplicador amplitud SOL
uniform float uMontAmt;     // multiplicador amplitud MONTAÑAS
uniform float uCieloAmt;    // multiplicador amplitud CIELO
uniform float uLinAmt;      // multiplicador amplitud LÍNEAS
uniform float uKickAmt;     // multiplicador amplitud kick

// W3: amanecer + reveal
uniform float uDawn;   // 0..1: progreso fase 1 amanecer (ease-out cúbico, calculado en JS)
uniform vec4  uReveal; // x=MONTAÑAS, y=LÍNEAS, z=SOL, w=CIELO (0..1 fase 2)

// ---- geometria del portal, medida sobre la referencia (espacio p: x der, y arriba, imagen = [-1,1]) ----
const vec2  PORTAL_C = vec2(0.0461, -0.0609);
const float PORTAL_R = 0.848;
const vec2  SUN_C    = vec2(0.0082, -0.0822);
const float CREAM_R  = 0.3443;
const float RING_R   = 0.4547;
const vec2  YEL_C    = vec2(0.0082, -0.1678);
const float YEL_R    = 0.2109;
const float RING_PERIOD = 0.0264;
const float TAU = 6.28318530718;

// ------------------------------------------------------------------ ruido
const mat2 M2 = mat2(0.80, 0.60, -0.60, 0.80);

float sn(vec2 p) { return sin(p.x) * sin(p.y); }

float fbm4(vec2 p) {
  float f = 0.0;
  f += 0.5000 * sn(p); p = M2 * p * 2.02;
  f += 0.2500 * sn(p); p = M2 * p * 2.03;
  f += 0.1250 * sn(p); p = M2 * p * 2.01;
  f += 0.0625 * sn(p);
  return f / 0.9375;
}

float fbm6(vec2 p) {
  float f = 0.0;
  f += 0.500000 * (0.5 + 0.5 * sn(p)); p = M2 * p * 2.02;
  f += 0.250000 * (0.5 + 0.5 * sn(p)); p = M2 * p * 2.03;
  f += 0.125000 * (0.5 + 0.5 * sn(p)); p = M2 * p * 2.01;
  f += 0.062500 * (0.5 + 0.5 * sn(p)); p = M2 * p * 2.04;
  f += 0.031250 * (0.5 + 0.5 * sn(p)); p = M2 * p * 2.01;
  f += 0.015625 * (0.5 + 0.5 * sn(p));
  return f / 0.96875;
}

vec2 fbm4_2(vec2 p) { return vec2(fbm4(p), fbm4(p + vec2(7.8))); }
vec2 fbm6_2(vec2 p) { return vec2(fbm6(p + vec2(16.8)), fbm6(p + vec2(11.5))); }

// domain warp de IQ, sin iluminacion. amt escala cuanto se deforma el campo.
float warpField(vec2 q, float t, float amt) {
  q += 0.03 * sin(vec2(0.27, 0.23) * t + length(q) * vec2(4.1, 4.3));
  vec2 o = fbm4_2(0.9 * q);
  o += 0.04 * sin(vec2(0.12, 0.14) * t + length(o));
#ifdef LOW_QUALITY
  vec2 n = fbm4_2(3.0 * o);
#else
  vec2 n = fbm6_2(3.0 * o);
#endif
  float f = 0.5 + 0.5 * fbm4(1.8 * q + 6.0 * n * amt);
  return mix(f, f * f * f * 3.5, f * abs(n.x));
}

// ------------------------------------------------------------------ hash
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float h31(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123); }
vec3  h33(vec3 p) {
  return fract(sin(vec3(dot(p, vec3(127.1, 311.7, 74.7)),
                        dot(p, vec3(269.5, 183.3, 246.1)),
                        dot(p, vec3(113.5, 271.9, 124.6)))) * 43758.5453123);
}

// ------------------------------------------------------------------ formas
float sparkle4(vec2 p, float r) {           // estrella de 4 puntas (astroide)
  float d = pow(abs(p.x), 0.6667) + pow(abs(p.y), 0.6667);
  float rr = pow(r, 0.6667);
  return smoothstep(rr * 1.15, rr * 0.85, d);
}
float disc(vec2 p, float r) { return smoothstep(r * 1.1, r * 0.9, length(p)); }

float cloudShape(vec2 p, vec2 c, float hw, float sq) {
  vec2 u = (p - c) / hw;
  u.y /= sq;
  float base = max(abs(u.x) - 0.92, abs(u.y + 0.12) - 0.12);
  float b1 = length(u - vec2(-0.55, 0.02)) - 0.38;
  float b2 = length(u - vec2(-0.05, 0.14)) - 0.55;
  float b3 = length(u - vec2( 0.50, 0.03)) - 0.40;
  float d = min(min(base, b1), min(b2, b3));
  d = max(d, -0.24 - u.y);
  return d * hw;                              // distancia aprox en unidades p (negativa = dentro)
}

float starLayer(vec3 d, float scale, float thr, float rad, float t, float tw) {
  vec3 g = d * scale;
  vec3 id = floor(g);
  float h = h31(id);
  if (h < thr) return 0.0;
  vec3 c = 0.3 + 0.4 * h33(id + 7.0);
  float dist = length(fract(g) - c);
  float sz = rad * (0.45 + 0.55 * h31(id + 3.1));
  float tws = 0.55 + 0.45 * sin(t * (1.5 + 3.0 * h) + h * 60.0);
  return smoothstep(sz, 0.0, dist) * mix(1.0, tws, tw);
}

// ------------------------------------------------------------------ paletas
vec3 skyRamp(float y) {
  vec3 c0 = vec3(0.478, 0.227, 0.208);   // #7a3a35 tope
  vec3 c1 = vec3(0.561, 0.259, 0.235);   // #8f423c
  vec3 c2 = vec3(0.749, 0.314, 0.216);   // #bf5037
  vec3 c3 = vec3(0.835, 0.365, 0.184);   // #d55d2f
  vec3 c4 = vec3(0.910, 0.545, 0.180);   // #e88b2e
  vec3 c5 = vec3(0.925, 0.541, 0.157);   // #ec8a28
  vec3 c6 = vec3(0.922, 0.635, 0.180);   // #eba22e
  vec3 c7 = vec3(0.953, 0.698, 0.188);   // #f3b230 horizonte
  vec3 c = c7;
  c = mix(c, c6, smoothstep(-0.22, -0.05, y));
  c = mix(c, c5, smoothstep(-0.05,  0.08, y));
  c = mix(c, c4, smoothstep( 0.08,  0.23, y));
  c = mix(c, c3, smoothstep( 0.23,  0.29, y));
  c = mix(c, c2, smoothstep( 0.29,  0.44, y));
  c = mix(c, c1, smoothstep( 0.44,  0.57, y));
  c = mix(c, c0, smoothstep( 0.57,  0.78, y));
  return c;
}

vec3 worldSky(vec3 d, float t) {
  float h = d.y;
  vec3 zen = vec3(0.075, 0.040, 0.090);
  vec3 mid = vec3(0.300, 0.120, 0.140);
  vec3 hor = vec3(0.800, 0.360, 0.140);
  vec3 c = mix(hor, mid, smoothstep(0.0, 0.35, h));
  c = mix(c, zen, smoothstep(0.25, 0.95, h));
  c *= 0.75 + 0.25 * (0.5 + 0.5 * fbm4(d.xz * 3.0 + t * 0.03));
  c = mix(vec3(0.04, 0.035, 0.05), c, smoothstep(-0.12, 0.02, h));
  return c;
}

float tri(float x) { return abs(fract(x) * 2.0 - 1.0); }
// altura (en seno de elevacion) de la cordillera para el azimut u en (-0.5, 0.5]
float ridgeH(float u, float seed) {
  return 0.012 + 0.050 * tri(u * 7.0 + seed) * tri(u * 3.0 + seed * 1.7)
              + 0.030 * tri(u * 17.0 + seed * 2.3) + 0.014 * tri(u * 31.0 + seed * 0.9);
}

void main() {
  vec3 d = normalize(vDir);
  float t = uTime;
  // W2: group energies replace raw frequency bands
  float sol   = uGroupEnergy.x * uSolAmt;
  float mont  = uGroupEnergy.y * uMontAmt;
  float cielo = uGroupEnergy.z * uCieloAmt;
  float lin   = uGroupEnergy.w * uLinAmt;
  float kick  = uKick * uKickAmt;

  // ---- coordenadas del portal ----
  float fz = dot(d, uPortalF);
  vec2 tp = vec2(dot(d, uPortalR), dot(d, uPortalU)) / uPortalTan;     // continuo en todo el domo
  vec2 p  = tp / max(fz, 0.02);                                         // imagen del portal (proyeccion gnomonica)
  vec3 cDir = normalize(uPortalF + (uPortalR * PORTAL_C.x + uPortalU * PORTAL_C.y) * uPortalTan);
  float s = acos(clamp(dot(d, cDir), -1.0, 1.0)) / atan(uPortalTan);    // radio angular ~ unidades p
  vec2 q = tp - PORTAL_C;

  // ---- mundo alrededor ----
  // W3: antes del amanecer (uDawn=0) el cielo es violeta oscuro; se abre al atardecer con uDawn
  vec3 nightSky = vec3(0.025, 0.018, 0.035);
  vec3 col = mix(nightSky, worldSky(d, t), uDawn);
  float worldStars = starLayer(d, 58.0, uStarCut - 0.02 * cielo, 0.20, t, 0.6 + 0.4 * cielo);
  // W3: estrellas del mundo solo después del amanecer + fase 2 CIELO
  col += vec3(1.0, 0.92, 0.80) * worldStars * (0.7 + 0.9 * cielo + 0.5 * kick) * smoothstep(0.02, 0.45, d.y) * uReveal.w;

  // ---- marco de anillos (tunel) ----
  float wob  = fbm4(q * 2.2 + vec2(0.0, t * 0.04));
  float wob2 = fbm4(q * 1.1 + vec2(5.0, t * 0.03));
  float sw = s + 0.040 * wob * (0.6 + 0.4 * sol);
  float inside = 1.0 - smoothstep(PORTAL_R - 0.012, PORTAL_R + 0.012, sw);
  float sph = s + 0.050 * wob + 0.130 * wob2 * (0.7 + 0.5 * sol);
  float ph = sph / (RING_PERIOD * uRingScale) - uRingFlow * t * 12.0 - sol * 0.6;
  float thick = 0.12 * fbm4(q * 5.0 + vec2(2.0, 7.0));
  float band = smoothstep(0.34 + thick, 0.60 + thick, 0.5 + 0.5 * sin(TAU * ph));
  float hv = 0.5 + 0.5 * fbm4(q * 1.4 + vec2(3.0, 1.0));
  float redw = smoothstep(0.55, 0.85, 0.5 + 0.5 * fbm4(q * 1.1 + vec2(-4.0, 2.0)) - 0.25 * q.x + 0.15 * q.y);
  vec3 gold = mix(vec3(0.64, 0.39, 0.18), vec3(0.90, 0.55, 0.18), hv);
  gold = mix(gold, vec3(0.84, 0.31, 0.19), redw);
  vec3 dark = mix(vec3(0.13, 0.07, 0.05), vec3(0.36, 0.18, 0.11), hv);
  vec3 ringCol = mix(dark, gold, band) * (0.85 + 0.35 * sol * band + 0.20 * kick * band);
  float reach = 1.0 - smoothstep(uRingFade.x, uRingFade.y, s);
  float ringA = max(reach, 0.10);
  // W3: anillos (SOL) aparecen en fase 2
  col = mix(col, ringCol, ringA * (1.0 - inside) * uReveal.z);

  // cordillera que rodea el domo: capa lejana azul oscuro + capa cercana negra
  // W3: la cordillera crece desde el horizonte durante la fase 1 (escala por uDawn)
  float az = atan(d.x, -d.z) / TAU;
  float hFar = 1.25 * ridgeH(az, 0.31) * uDawn;
  float hNear = 0.70 * ridgeH(az + 0.17, 0.77) * uDawn;
  col = mix(col, vec3(0.133, 0.188, 0.227), smoothstep(0.0015, -0.0015, d.y - hFar) * (1.0 - inside));
  col = mix(col, vec3(0.098, 0.102, 0.133), smoothstep(0.0015, -0.0015, d.y - hNear) * (1.0 - inside));

  // ---- cielo del portal ----
  if (inside > 0.001) {
    // W3: el warp del cielo (CIELO) solo aparece en fase 2; en fase 1 es skyRamp plano
    float amt = uWarp * (0.35 + 0.9 * cielo) * uReveal.w;
    float f = warpField(p * 1.1, t * (0.6 + cielo), max(amt, 0.001));
    float yy = p.y + 0.10 * (f - 0.5) * amt;
    vec3 sky = skyRamp(yy);
    sky += (f - 0.5) * 0.14 * amt * vec3(1.0, 0.6, 0.25);

    // sol en 3 discos
    // W3: el sol sube desde abajo durante fase 1 (sunRiseOfs = 0.8 cuando dawn=0, 0 cuando dawn=1)
    float sunRiseOfs = (1.0 - uDawn) * 0.8;
    float k = 1.0 + 0.05 * sol + 0.08 * kick;
    float rs = length(p - SUN_C + vec2(0.0, sunRiseOfs)) / k + 0.010 * cielo * fbm4(p * 6.0 + t * 0.2);
    sky += vec3(0.9, 0.35, 0.1) * 0.22 * (0.5 + sol + 0.3 * kick) * exp(-5.0 * max(rs - RING_R, 0.0));
    vec3 ringRed = mix(vec3(0.898, 0.361, 0.161), vec3(0.894, 0.196, 0.169), smoothstep(-0.1, 0.4, p.y));
    sky = mix(sky, ringRed, smoothstep(RING_R + 0.004, RING_R - 0.004, rs));
    float ry = length(p - YEL_C) / k;
    vec3 cream = mix(vec3(0.973, 0.918, 0.847), vec3(0.898, 0.780, 0.639), smoothstep(YEL_R + 0.14, YEL_R, ry));
    sky = mix(sky, cream, smoothstep(CREAM_R + 0.004, CREAM_R - 0.004, rs));
    sky = mix(sky, vec3(0.996, 0.741, 0.090), smoothstep(YEL_R + 0.004, YEL_R - 0.004, ry));

    // nubes (se desplazan con el tiempo y respiran con los medios altos)
    float dr = 0.03 * sin(t * 0.05);
    float sc = 1.0 + 0.08 * cielo;
    float ob1 = cloudShape(p, vec2(-0.52 - dr, 0.22), 0.22 * sc, 0.55);
    float ob2 = cloudShape(p, vec2( 0.66 + dr, 0.28), 0.24 * sc, 0.55);
    sky = mix(sky, vec3(0.94, 0.62, 0.20), 0.85 * smoothstep(0.004, -0.004, ob1));
    sky = mix(sky, vec3(0.94, 0.62, 0.20), 0.85 * smoothstep(0.004, -0.004, ob2));
    float c1 = cloudShape(p, vec2(-0.5585 + dr, 0.1579), 0.125 * sc, 0.70);
    float c2 = cloudShape(p, vec2( 0.6770 - dr, 0.1382), 0.208 * sc, 0.70);
    float c3 = cloudShape(p, vec2( 0.4596 + dr, 0.3487), 0.053 * sc, 0.70);
    vec3 cloudCol = vec3(0.957, 0.914, 0.831);
    sky = mix(sky, cloudCol, smoothstep(0.004, -0.004, c1));
    sky = mix(sky, cloudCol, smoothstep(0.004, -0.004, c2));
    sky = mix(sky, cloudCol, smoothstep(0.004, -0.004, c3));

    // estrellas y destellos fijos de la referencia — W3: solo en fase 2 CIELO
    float tw = 0.75 + 0.25 * sin(t * 3.0) + 0.6 * cielo + 0.4 * kick;
    sky += vec3(1.0, 0.95, 0.85) * starLayer(d, 70.0, uStarCut - 0.03 * cielo, 0.22, t, 0.7) * smoothstep(-0.1, 0.5, p.y) * (0.7 + cielo + 0.5 * kick) * uReveal.w;
    sky = mix(sky, vec3(0.30, 0.45, 0.83), sparkle4(p - vec2(-0.3740, 0.3651), 0.040 * tw) * uReveal.w);
    sky = mix(sky, vec3(0.91, 0.32, 0.18), sparkle4(p - vec2( 0.0214, 0.7105), 0.036 * tw) * uReveal.w);
    sky = mix(sky, vec3(0.96, 0.92, 0.82), disc(p - vec2( 0.3245, 0.4836), 0.022) * uReveal.w);
    sky = mix(sky, vec3(0.95, 0.60, 0.18), disc(p - vec2(-0.1500, 0.6974), 0.014) * uReveal.w);
    // W3: el portal se funde en con el progreso del amanecer (fase 1)
    col = mix(col, sky, inside * uDawn);
  }

  // ---- montanas (mascaras + color posterizado) ----
  vec2 uv = p * 0.5 + 0.5;
  float inImg = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0) * step(0.02, fz);
  if (inImg > 0.5) {
    float a1 = 0.0015 + 0.010 * lin;
    vec2 uvw = uv + vec2(a1 * sin(uv.y * 38.0 + t * 1.3) + 0.5 * a1 * sin(uv.y * 71.0 - t * 0.9),
                         0.0010 * lin * sin(uv.x * 22.0 + t * 1.1));
    vec3 waveCol = texture2D(uColor, uvw).rgb;
    float a2 = 0.0008 + 0.004 * mont;
    vec2 uvs = uv + vec2(a2 * sin(uv.y * 45.0 + t * 1.1), 0.0);
    vec3 strataCol = texture2D(uColor, uvs).rgb;
    // W2: montañas negras respiran con despl. vertical (~2%) + rebote de kick
    float blackDispY = 0.020 * mont * sin(uv.x * 9.0 + t * 0.6) + 0.008 * kick;
    vec3 m = texture2D(uMasks, uv + vec2(0.0, blackDispY)).rgb;
    // W3: olas (LÍNEAS) y estratos (MONTAÑAS) aparecen en fase 2
    col = mix(col, waveCol * (1.0 + 0.10 * lin), m.b * uReveal.y);
    col = mix(col, strataCol * (1.0 + 0.08 * mont), m.g * uReveal.x);
    col = mix(col, vec3(0.098, 0.102, 0.133), m.r);
    // destellos sobre las montanas
    float tw2 = 0.75 + 0.25 * sin(t * 2.3 + 1.0) + 0.7 * kick;
    col = mix(col, vec3(0.91, 0.54, 0.18), sparkle4(p - vec2(-0.6800, -0.7830), 0.040 * tw2));
    col = mix(col, vec3(0.99, 0.95, 0.88), sparkle4(p - vec2( 0.8616, -0.3224), 0.040 * tw2));
  }

  // ---- confeti en el marco ----
  vec2 cq = q * 14.0;
  vec2 cid = floor(cq);
  float hh = h21(cid);
  float show = step(0.89 - 0.05 * cielo, hh) * (1.0 - inside) * reach * uReveal.w;
  if (show > 0.5) {
    float ang = hh * 20.0 + t * (hh - 0.5) * (1.0 + 4.0 * cielo);
    float ca = cos(ang), sa = sin(ang);
    vec2 cf = fract(cq) - 0.5 - (vec2(h21(cid + 3.3), h21(cid + 8.8)) - 0.5) * 0.3;
    vec2 rp = mat2(ca, -sa, sa, ca) * cf;
    vec2 bd = abs(rp) - vec2(0.20, 0.08);
    float sdf = length(max(bd, 0.0)) + min(max(bd.x, bd.y), 0.0);
    float pick = h21(cid + 1.7);
    vec3 cc = pick < 0.25 ? vec3(0.95, 0.88, 0.75) : (pick < 0.5 ? vec3(0.24, 0.55, 0.54) : (pick < 0.75 ? vec3(0.84, 0.31, 0.19) : vec3(0.96, 0.70, 0.19)));
    col = mix(col, cc, smoothstep(0.03, -0.03, sdf));
  }

  // suelo oscuro bajo el horizonte (tu escena ya tiene su propio suelo, esto solo evita ver el fondo del domo)
  col = mix(vec3(0.043, 0.039, 0.063), col, smoothstep(-0.004, 0.004, d.y));

  gl_FragColor = vec4(col, 1.0);
}
`;
