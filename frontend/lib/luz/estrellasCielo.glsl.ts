// Shader del cielo estrellado v2 (adaptacion de Nightsky Shader Elective, tmoe1354, Shadertoy WcjGRz, CC BY-NC-SA 3.0).
// ShaderMaterial sobre una esfera que SIGUE a la camara (solo posicion), side BackSide, transparent,
// depthWrite false, depthTest false, AdditiveBlending, fog false, frustumCulled false.
// El vertex shader fija z = w * 0.9999, asi el far de la camara nunca recorta la esfera.
// uReveal (0..1): 0 = no se dibuja nada; 1 = cielo completo (bajo la luz). Las capas aparecen por etapas.
// Z31 (alight): sobre la v2 se reincorporan uCapas (calidad 1..3) y uTope (tope por canal antes del bloom)
// de Z30. Sin colorspace_fragment ni tonemapping_fragment: salida lineal, la convierte el OutputPass.
export const ESTRELLAS_VERT = /* glsl */ `varying vec3 vDir;
void main(){
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  // z = w * 0.9999: el cielo queda SIEMPRE en el plano lejano, asi el far de la camara nunca lo recorta
  p.z = p.w * 0.9999;
  gl_Position = p;
}
`;
export const ESTRELLAS_FRAG = /* glsl */ `// Cielo estrellado procedural para alight.
// Adaptado de "Nightsky Shader Elective" por tmoe1354 (Shadertoy WcjGRz, 2025).
// Licencia original de Shadertoy: CC BY-NC-SA 3.0 (atribución, no comercial, compartir igual).
// Cambios: sin texturas ni multipass; estrellas por celdas 3D sobre la direccion de mirada,
// manchones de mayor densidad (los "spots" del original), brillo titilante, resplandor
// azul hacia el horizonte y rampa de aparicion uReveal para ligarlo a la distancia a la luz.
precision highp float;
varying vec3 vDir;
uniform float uTime;
uniform float uReveal;        // 0..1, lo conduce la cercania a la luz
uniform float uBrillo;        // ganancia global
uniform float uDensidad;      // 0..1 densidad base de estrellas
uniform float uTwinkle;       // 0..1 intensidad del titilar
uniform float uPan;           // rad/s, deriva lenta del cielo
uniform vec3  uTinteHorizonte;
uniform float uCapas;         // Z30: 3 alta, 2 media, 1 baja
uniform float uTope;          // Z30: tope por canal (que no se queme en el bloom)

float hash13(vec3 p3){
  p3 = fract(p3 * .1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}
vec3 hash33(vec3 p3){
  p3 = fract(p3 * vec3(.1031, .1030, .0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yxx) * p3.zyx);
}

// Una capa de estrellas: una celda 3D, una estrella posible por celda (sin vecinos = barato).
vec3 capa(vec3 d, float escala, float densidad, float tam, float seed){
  vec3 p  = d * escala;
  vec3 id = floor(p) + seed;
  vec3 f  = fract(p);
  float existe = hash13(id + 17.0);
  if (existe > densidad) return vec3(0.0);
  vec3 h = hash33(id);
  vec3 centro = 0.25 + 0.5 * h;          // dentro de la celda, no cruza bordes
  float dist = length(f - centro);
  float mag  = hash13(id + 3.7);          // magnitud: pocas muy brillantes
  mag = mag * mag * mag;
  float tamEst = tam * (0.6 + 0.8 * mag);
  float nucleo = smoothstep(tamEst, 0.0, dist);
  nucleo *= nucleo;
  // el halo se apaga antes de llegar al borde de la celda (el centro queda a >=0.25 de cada cara)
  float halo = exp(-dist / (tamEst * 2.5)) * 0.12 * smoothstep(0.24, 0.05, dist);
  float titila = 1.0 + uTwinkle * clamp(uReveal, 0.3, 1.0) * 0.45 * sin(uTime * (2.0 + 5.0 * h.x) + 6.2831 * h.y);
  // color: de azulado a calido segun hash (el original lo sacaba de una textura)
  vec3 col = mix(vec3(0.70, 0.82, 1.0), vec3(1.0, 0.86, 0.66), h.z);
  return col * (nucleo + halo) * (0.35 + 1.6 * mag) * titila;
}

void main(){
  vec3 d = normalize(vDir);
  // deriva lenta alrededor del eje vertical
  float a = uPan * uTime;
  float c = cos(a), s = sin(a);
  vec3 q = vec3(c * d.x - s * d.z, d.y, s * d.x + c * d.z);

  // "spots": zonas donde hay mas estrellas (5 como el original) + una banda tenue
  float cl = 1.0;
  cl = min(cl, 1.0 - dot(q, normalize(vec3( 0.70, 0.60, 0.40))));
  cl = min(cl, 1.0 - dot(q, normalize(vec3(-0.50, 0.70, 0.55))));
  cl = min(cl, 1.0 - dot(q, normalize(vec3( 0.20, 0.85,-0.50))));
  cl = min(cl, 1.0 - dot(q, normalize(vec3(-0.80, 0.35,-0.40))));
  cl = min(cl, 1.0 - dot(q, normalize(vec3( 0.55, 0.40,-0.75))));
  // aparicion por etapas segun uReveal (0 = nada, 1 = cielo completo bajo la luz)
  float r  = clamp(uReveal, 0.0, 1.0);
  float g1 = smoothstep(0.02, 0.45, r);   // primeras estrellas chicas
  float g2 = smoothstep(0.18, 0.65, r);   // capa media
  float g3 = smoothstep(0.35, 0.85, r);   // las grandes y brillantes
  float gs = smoothstep(0.50, 1.00, r);   // manchones y banda (maxima expresividad)
  float gv = smoothstep(0.25, 0.90, r);   // velo azul del horizonte
  float spots = (1.0 - smoothstep(0.0, 0.20, cl)) * gs;
  float banda = exp(-pow(dot(q, normalize(vec3(0.35, 0.55, -0.75))) * 5.0, 2.0)) * gs;
  float dens  = clamp(uDensidad + 0.35 * spots + 0.20 * banda, 0.0, 1.0);

  vec3 est = vec3(0.0);
  est += capa(q, 38.0, dens * 0.55, 0.075, 1.0) * g1;   // chicas, muchas
  if (uCapas > 1.5) est += capa(q, 22.0, dens * 0.40, 0.065, 7.0)  * g2;   // Z30: calidad
  if (uCapas > 2.5) est += capa(q, 11.0, dens * 0.30, 0.055, 13.0) * g3;  // grandes, pocas

  // horizonte: las estrellas se apagan abajo y aparece un velo azul (como el degradado del original)
  float alto = clamp(d.y, 0.0, 1.0);
  float visible = smoothstep(0.0, 0.16, d.y);
  vec3 velo = uTinteHorizonte * pow(1.0 - alto, 3.0) * 0.20 * step(0.0, d.y + 0.05) * gv;
  velo += vec3(0.010, 0.012, 0.030) * (0.4 + 0.6 * banda + 0.5 * spots) * visible * gv;

  vec3 col = (est * visible * 1.3 + velo) * uBrillo * (0.55 + 0.45 * r);
  col = min(col, vec3(uTope));          // Z30
  gl_FragColor = vec4(col, 1.0);
}
`;
export const ESTRELLAS_UNIFORMS_DEFAULT = {
  uTime: 0,
  uReveal: 0,
  uBrillo: 1.6,
  uDensidad: 0.85,
  uTwinkle: 1.0,
  uPan: 0.01,
};
export const ESTRELLAS_TINTE_HORIZONTE = '#1a2e73';
