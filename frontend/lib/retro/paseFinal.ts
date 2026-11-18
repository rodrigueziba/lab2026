// Z69: pase final fusionado (DBG_RENDIMIENTO.PASES_FUSIONADOS). Reemplaza a tres pases de pantalla completa:
//   mezcla del bloom (lee y escribe HalfFloat) → CRT (lee HF, escribe HF) → salida ACES + sRGB (lee HF, escribe pantalla)
// por uno solo que lee la escena (HF) y la textura chica del bloom, aplica el CRT, el tone mapping y sRGB, y escribe la
// pantalla (RGBA8). El código del CRT es el MISMO texto de lib/retro/retroCRT.ts, transformado al armar el material
// (main → crtMain, gl_FragColor → crtSalida, las lecturas de tDiffuse → escena + bloom [+ corrección FXAA]): si se
// edita el CRT, esto lo sigue. La salida replica OutputPass (mismos defines según renderer.toneMapping/outputColorSpace).
// FXAA (ANTIALIAS_MODO "fxaa"): se calcula una vez por píxel en el punto central del CRT y la corrección se suma a las
// tres lecturas de la aberración cromática (están a ≤ 2–3 px entre sí): no es un pase extra.
// FXAA: versión simplificada de NVIDIA FXAA (Timothy Lottes, 2009–2011), como el FXAAShader clásico de three.js (MIT).
import * as THREE from "three";
import { Pass, FullScreenQuad } from "three/addons/postprocessing/Pass.js";
import { RetroCRTShader } from "@/lib/retro/retroCRT";
import { transformarCRT } from "@/lib/retro/paseFinalTexto";
import { GLSL_TIEMPO_DETENIDO, GLSL_TIEMPO_DETENIDO_UNIFORMS, GLSL_TIEMPO_SLITSCAN, TIEMPO_UNIFORMS, TIEMPO_VISUAL } from "@/lib/retro/tiempoDetenido";   // Z84 · Z86
import { HIST_PLAN, HISTORIAL } from "@/lib/retro/historialTiempo";   // Z86

const VERT = /* glsl */`
#define attribute in
#define varying out
precision highp float;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
attribute vec3 position;
attribute vec2 uv;
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

function fragmento(crt: string): string {
  return /* glsl */`
#define varying in
out highp vec4 pc_fragColor;
#define gl_FragColor pc_fragColor
#define texture2D texture
precision highp float;
uniform sampler2D tDiffuse;
uniform sampler2D tBloom;
uniform float uBloomOn, uCrtOn, uSalidaOn;
uniform vec2 uTexel;
#include <tonemapping_pars_fragment>
#include <colorspace_pars_fragment>

${GLSL_TIEMPO_DETENIDO_UNIFORMS}
vec3 escenaBase(vec2 p) {
  vec3 c = texture2D(tDiffuse, p).rgb;
  if (uBloomOn > 0.5) c += texture2D(tBloom, p).rgb;
  return c;
}
${GLSL_TIEMPO_SLITSCAN}
// Z86: con el tiempo detenido en estilo slit-scan, la escena que lee el CRT viene del historial (k = 0: rama apagada)
vec3 escena(vec2 p) {
  if (uTiempoK > 0.0 && uTiempoSlit > 0.5) return escenaTiempoDetenido(p, uTiempoK, uTiempoT);
  return escenaBase(p);
}
vec4 escena4(vec2 p) { return vec4(escena(p), 1.0); }

#if AA_FXAA
float lumaAA(vec3 c) { float l = dot(c, vec3(0.299, 0.587, 0.114)); return sqrt(max(l, 0.0) / (1.0 + max(l, 0.0))); }
// corrección = FXAA(p) − escena sin AA en p (solo la imagen de la escena: el bloom es suave y no tiene escalones)
vec3 correccionAA(vec2 p) {
  if (uTiempoK > 0.0 && uTiempoSlit > 0.5) return vec3(0.0);   // Z86: la imagen atrasada no es la del cuadro actual
  vec3 rgbM  = texture2D(tDiffuse, p).rgb;
  vec3 rgbNW = texture2D(tDiffuse, p + vec2(-1.0, -1.0) * uTexel).rgb;
  vec3 rgbNE = texture2D(tDiffuse, p + vec2( 1.0, -1.0) * uTexel).rgb;
  vec3 rgbSW = texture2D(tDiffuse, p + vec2(-1.0,  1.0) * uTexel).rgb;
  vec3 rgbSE = texture2D(tDiffuse, p + vec2( 1.0,  1.0) * uTexel).rgb;
  float lM = lumaAA(rgbM), lNW = lumaAA(rgbNW), lNE = lumaAA(rgbNE), lSW = lumaAA(rgbSW), lSE = lumaAA(rgbSE);
  float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE)));
  float lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
  if (lMax - lMin < max(0.0312, lMax * 0.125)) return vec3(0.0);     // sin borde: nada que corregir
  vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), (lNW + lSW) - (lNE + lSE));
  float reduce = max((lNW + lNE + lSW + lSE) * (0.25 * 0.125), 1.0 / 128.0);
  float rcpMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + reduce);
  dir = clamp(dir * rcpMin, vec2(-8.0), vec2(8.0)) * uTexel;
  vec3 rgbA = 0.5 * (texture2D(tDiffuse, p + dir * (1.0 / 3.0 - 0.5)).rgb + texture2D(tDiffuse, p + dir * (2.0 / 3.0 - 0.5)).rgb);
  #if FXAA_LIGERO
  return rgbA - rgbM;   // Z72: sin la segunda pareja de lecturas (7 en vez de 9)
  #endif
  vec3 rgbB = rgbA * 0.5 + 0.25 * (texture2D(tDiffuse, p - dir * 0.5).rgb + texture2D(tDiffuse, p + dir * 0.5).rgb);
  float lB = lumaAA(rgbB);
  return ((lB < lMin || lB > lMax) ? rgbA : rgbB) - rgbM;
}
#else
vec3 correccionAA(vec2 p) { return vec3(0.0); }
#endif

vec4 crtSalida;
${crt}
${GLSL_TIEMPO_DETENIDO}

void main() {
  if (uCrtOn > 0.5) crtMain();
  else crtSalida = vec4(escena(vUv) + correccionAA(vUv), 1.0);
  vec4 c = crtSalida;
  // Z84: tiempo detenido (lib/retro/tiempoDetenido.ts); con uTiempoK = 0 no se ejecuta: imagen idéntica
  if (uTiempoK > 0.0 && uTiempoSlit < 0.5) c.rgb = efectoTiempoDetenido(vUv, c.rgb, uTiempoK, uTiempoT);   // Z86: solo el estilo provisorio
  if (uSalidaOn > 0.5) {
    #ifdef LINEAR_TONE_MAPPING
      c.rgb = LinearToneMapping(c.rgb);
    #elif defined(REINHARD_TONE_MAPPING)
      c.rgb = ReinhardToneMapping(c.rgb);
    #elif defined(CINEON_TONE_MAPPING)
      c.rgb = CineonToneMapping(c.rgb);
    #elif defined(ACES_FILMIC_TONE_MAPPING)
      #if ACES_RAPIDO
      // Z72: aproximación de Narkowicz (2015) con la misma exposición; sin las dos matrices del ajuste de Hill
      vec3 xa = c.rgb * toneMappingExposure * 0.82;   // 0,82: la escala que mejor iguala los grises (1,4/255)
      c.rgb = clamp((xa * (2.51 * xa + 0.03)) / (xa * (2.43 * xa + 0.59) + 0.14), 0.0, 1.0);
      #else
      c.rgb = ACESFilmicToneMapping(c.rgb);
      #endif
    #elif defined(AGX_TONE_MAPPING)
      c.rgb = AgXToneMapping(c.rgb);
    #elif defined(NEUTRAL_TONE_MAPPING)
      c.rgb = NeutralToneMapping(c.rgb);
    #endif
    #ifdef SRGB_TRANSFER
      c = sRGBTransferOETF(c);
    #endif
  }
  gl_FragColor = c;
}
`;
}

export class PaseFinalPass extends Pass {
  readonly uniforms: Record<string, THREE.IUniform>;
  readonly material: THREE.RawShaderMaterial;
  readonly conAA: boolean;
  private readonly fsq: FullScreenQuad;
  private tm: THREE.ToneMapping | null = null;
  private cs: string | null = null;
  private aa = -1;

  /** crtUniforms: los mismos objetos { value } del pase CRT (ShaderPass), así los dos leen exactamente lo mismo. */
  constructor(crtUniforms: Record<string, THREE.IUniform>) {
    super();
    const t = transformarCRT(RetroCRTShader.fragmentShader);
    this.conAA = t.conAA;
    const u: Record<string, THREE.IUniform> = {};
    for (const k of Object.keys(crtUniforms)) if (k !== "tDiffuse") u[k] = crtUniforms[k];
    u.tDiffuse = { value: null }; u.tBloom = { value: null };
    u.uBloomOn = { value: 0 }; u.uCrtOn = { value: 1 }; u.uSalidaOn = { value: 1 };
    u.uTexel = { value: new THREE.Vector2(1, 1) };
    u.toneMappingExposure = { value: 1 };
    for (const k of Object.keys(TIEMPO_UNIFORMS)) u[k] = TIEMPO_UNIFORMS[k];   // Z84
    this.uniforms = u;
    this.material = new THREE.RawShaderMaterial({
      name: "PaseFinalZ69", glslVersion: THREE.GLSL3, uniforms: u, defines: { AA_FXAA: 0, FXAA_LIGERO: 0, ACES_RAPIDO: 0 },
      vertexShader: VERT, fragmentShader: fragmento(t.codigo), depthTest: false, depthWrite: false,
    });
    this.fsq = new FullScreenQuad(this.material);
  }

  /** Z72: variantes más baratas (evaluadas en Z72: no cumplen la diferencia ≤ 2/255; quedan para comparar). */
  fijarVariantes(acesRapido: boolean, fxaaLigero: boolean): void {
    const d = this.material.defines as Record<string, number | string>;
    const a = acesRapido ? 1 : 0, f = fxaaLigero ? 1 : 0;
    if (d.ACES_RAPIDO === a && d.FXAA_LIGERO === f) return;
    d.ACES_RAPIDO = a; d.FXAA_LIGERO = f;
    this.material.needsUpdate = true;
  }

  /** FXAA dentro del pase (recompila solo al cambiar). */
  fijarAA(fxaa: boolean): void {
    const v = fxaa && this.conAA ? 1 : 0;
    if (v === this.aa) return;
    this.aa = v;
    (this.material.defines as Record<string, number>).AA_FXAA = v;
    this.material.needsUpdate = true;
  }

  render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget): void {
    const u = this.uniforms;
    u.tDiffuse.value = readBuffer.texture;
    (u.uTexel.value as THREE.Vector2).set(1 / Math.max(1, readBuffer.width), 1 / Math.max(1, readBuffer.height));
    u.toneMappingExposure.value = renderer.toneMappingExposure;
    u.uTiempoK.value = TIEMPO_VISUAL.k; u.uTiempoT.value = TIEMPO_VISUAL.t;   // Z84
    u.uTiempoSlit.value = TIEMPO_VISUAL.slit;
    // Z86: captura al historial y estela (solo armado; presupuesto fijo: una captura y una estela por cuadro)
    if (HIST_PLAN.armado) HISTORIAL.paso(renderer, readBuffer, u);
    else if (HIST_PLAN.liberar) HISTORIAL.liberar();
    // defines de salida: misma lógica que OutputPass
    if (this.tm !== renderer.toneMapping || this.cs !== renderer.outputColorSpace) {
      this.tm = renderer.toneMapping; this.cs = renderer.outputColorSpace;
      const d = this.material.defines as Record<string, string | number>;
      for (const k of ["SRGB_TRANSFER", "LINEAR_TONE_MAPPING", "REINHARD_TONE_MAPPING", "CINEON_TONE_MAPPING", "ACES_FILMIC_TONE_MAPPING", "AGX_TONE_MAPPING", "NEUTRAL_TONE_MAPPING"]) delete d[k];
      if (THREE.ColorManagement.getTransfer(this.cs) === THREE.SRGBTransfer) d.SRGB_TRANSFER = "";
      const tm = this.tm;
      if (tm === THREE.LinearToneMapping) d.LINEAR_TONE_MAPPING = "";
      else if (tm === THREE.ReinhardToneMapping) d.REINHARD_TONE_MAPPING = "";
      else if (tm === THREE.CineonToneMapping) d.CINEON_TONE_MAPPING = "";
      else if (tm === THREE.ACESFilmicToneMapping) d.ACES_FILMIC_TONE_MAPPING = "";
      else if (tm === THREE.AgXToneMapping) d.AGX_TONE_MAPPING = "";
      else if (tm === THREE.NeutralToneMapping) d.NEUTRAL_TONE_MAPPING = "";
      this.material.needsUpdate = true;
    }
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    if (!this.renderToScreen && this.clear) renderer.clear(renderer.autoClearColor, renderer.autoClearDepth, renderer.autoClearStencil);
    this.fsq.render(renderer);
  }

  dispose(): void { this.material.dispose(); this.fsq.dispose(); HISTORIAL.liberar(); }   // Z86: libera el historial
}
