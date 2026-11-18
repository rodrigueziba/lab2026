// Z86: GPU del tiempo detenido en estilo slit-scan. Historial = WebGLArrayRenderTarget (textura de capas de WebGL2; three
// 0.183 renderiza en una capa con setRenderTarget(rt, capa) → framebufferTextureLayer), RGBA8 a HIST_ESCALA de la
// resolución. Captura: la ENTRADA del pase final (escena HDR + bloom, antes del CRT), codificada c/(1+c) en 8 bits
// (reversible: el shader decodifica y el CRT, el tone mapping y sRGB se aplican después, igual que al cuadro en vivo).
// Se eligió RGBA8 + codificación en vez de half-float: la mitad de memoria (ver MB en el menú) con calidad suficiente
// (la codificación da más precisión en los oscuros, que es donde se nota). Estela: dos RenderTargets (ida y vuelta) con
// max(brillante actual, estela · decaimiento). Todo lo arma lib/tiempoDetenidoAcciones.ts en HIST_PLAN y lo ejecuta
// PaseFinalPass.render: una captura y una estela por cuadro como máximo (presupuesto fijo), sin allocations por cuadro.
import * as THREE from "three";
import { FullScreenQuad } from "three/addons/postprocessing/Pass.js";
import { tamHistorial, megabytes } from "@/lib/tiempoHistorial";

/** Lo que el pase final debe hacer en este cuadro (lo escribe tickTiempoDetenido). */
export const HIST_PLAN = {
  armado: false, liberar: false,
  capa: -1,                       // capa donde capturar en este cuadro (−1 = no)
  n: 2, escala: 0.5, maxAncho: 1280,
  estela: false, decaimiento: 1, umbral: 0.7,
  // uniforms del efecto (los copia el pase final)
  nueva: 0, disponibles: 0, edad: 0,
  vaciado: 0,                     // sube cuando el historial se reserva de nuevo (las acciones vacían el anillo)
};

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
const CABECERA = /* glsl */`
#define varying in
out highp vec4 pc_fragColor;
precision highp float;
varying vec2 vUv;
uniform sampler2D tDiffuse;
uniform sampler2D tBloom;
uniform float uBloomOn;
vec3 escenaHist(vec2 p) { vec3 c = texture(tDiffuse, p).rgb; if (uBloomOn > 0.5) c += texture(tBloom, p).rgb; return max(c, vec3(0.0)); }
vec3 cod(vec3 c) { return c / (1.0 + c); }
vec3 dec(vec3 e) { e = min(e, vec3(0.996)); return e / (1.0 - e); }
`;
const FRAG_CAPTURA = CABECERA + /* glsl */`
void main() { pc_fragColor = vec4(cod(escenaHist(vUv)), 1.0); }
`;
const FRAG_ESTELA = CABECERA + /* glsl */`
uniform sampler2D tPrev;
uniform float uDecae, uUmbral;
void main() {
  vec3 c = escenaHist(vUv);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  vec3 brillo = c * smoothstep(uUmbral, uUmbral * 1.4 + 0.05, l);
  vec3 prev = dec(texture(tPrev, vUv).rgb) * uDecae;
  pc_fragColor = vec4(cod(max(brillo, prev)), 1.0);
}
`;

const opcionesRT: THREE.RenderTargetOptions = {
  type: THREE.UnsignedByteType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
  depthBuffer: false, stencilBuffer: false, generateMipmaps: false,
};

class HistorialTiempo {
  rt: THREE.WebGLArrayRenderTarget | null = null;
  estela: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget] | null = null;
  ie = 0;
  w = 0; h = 0; n = 0;
  private matCap: THREE.RawShaderMaterial | null = null;
  private matEst: THREE.RawShaderMaterial | null = null;
  private fsqCap: FullScreenQuad | null = null;
  private fsqEst: FullScreenQuad | null = null;

  /** MB reservados (historial + estela). */
  mb(): number { return this.rt ? megabytes(this.w, this.h, this.n) + megabytes(this.w, this.h, 2) : 0; }

  private materiales(): void {
    if (this.matCap) return;
    const base = { tDiffuse: { value: null }, tBloom: { value: null }, uBloomOn: { value: 0 } };
    this.matCap = new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: VERT, fragmentShader: FRAG_CAPTURA, uniforms: { ...base }, depthTest: false, depthWrite: false });
    this.matEst = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3, vertexShader: VERT, fragmentShader: FRAG_ESTELA, depthTest: false, depthWrite: false,
      uniforms: { tDiffuse: { value: null }, tBloom: { value: null }, uBloomOn: { value: 0 }, tPrev: { value: null }, uDecae: { value: 1 }, uUmbral: { value: 0.7 } },
    });
    this.fsqCap = new FullScreenQuad(this.matCap);
    this.fsqEst = new FullScreenQuad(this.matEst);
  }

  /** Reserva (perezosa) o rehace si cambió el tamaño o la cantidad de capas. Devuelve true si se reservó de nuevo. */
  asegurar(rw: number, rh: number): boolean {
    const t = tamHistorial(rw, rh, HIST_PLAN.escala, HIST_PLAN.maxAncho);
    const n = Math.max(2, HIST_PLAN.n);
    if (this.rt && this.w === t.w && this.h === t.h && this.n === n) return false;
    this.liberarTexturas();
    this.w = t.w; this.h = t.h; this.n = n;
    this.rt = new THREE.WebGLArrayRenderTarget(t.w, t.h, n, opcionesRT);
    this.estela = [new THREE.WebGLRenderTarget(t.w, t.h, opcionesRT), new THREE.WebGLRenderTarget(t.w, t.h, opcionesRT)];
    this.ie = 0;
    HIST_PLAN.vaciado++;
    return true;
  }

  /** Un cuadro armado: captura (si toca), estela (si está encendida) y uniforms del pase final. */
  paso(renderer: THREE.WebGLRenderer, readBuffer: THREE.WebGLRenderTarget, u: Record<string, THREE.IUniform>): void {
    this.materiales();
    const nuevo = this.asegurar(readBuffer.width, readBuffer.height);
    const previo = renderer.getRenderTarget();
    const bloom = u.tBloom.value, bloomOn = u.uBloomOn.value;
    if (HIST_PLAN.capa >= 0 && !nuevo && this.rt && this.fsqCap && this.matCap) {
      const cu = this.matCap.uniforms;
      cu.tDiffuse.value = readBuffer.texture; cu.tBloom.value = bloom; cu.uBloomOn.value = bloomOn;
      renderer.setRenderTarget(this.rt, HIST_PLAN.capa);
      this.fsqCap.render(renderer);
      HIST_PLAN.capa = -1;
    }
    if (HIST_PLAN.estela && this.estela && this.fsqEst && this.matEst) {
      const eu = this.matEst.uniforms;
      const prev = this.estela[this.ie], dest = this.estela[1 - this.ie];
      eu.tDiffuse.value = readBuffer.texture; eu.tBloom.value = bloom; eu.uBloomOn.value = bloomOn;
      eu.tPrev.value = prev.texture; eu.uDecae.value = HIST_PLAN.decaimiento; eu.uUmbral.value = HIST_PLAN.umbral;
      renderer.setRenderTarget(dest);
      this.fsqEst.render(renderer);
      this.ie = 1 - this.ie;
    }
    renderer.setRenderTarget(previo);
    u.uHist.value = this.rt ? this.rt.texture : null;
    u.uEstelaTex.value = this.estela ? this.estela[this.ie].texture : null;
    const a = u.uHistA.value as number[];
    a[0] = HIST_PLAN.nueva; a[1] = this.n; a[2] = nuevo ? 0 : HIST_PLAN.disponibles; a[3] = HIST_PLAN.edad;
  }

  private liberarTexturas(): void {
    this.rt?.dispose(); this.rt = null;
    this.estela?.[0].dispose(); this.estela?.[1].dispose(); this.estela = null;
    this.w = this.h = this.n = 0;
  }
  liberar(): void {
    this.liberarTexturas();
    this.fsqCap?.dispose(); this.fsqEst?.dispose(); this.matCap?.dispose(); this.matEst?.dispose();
    this.fsqCap = this.fsqEst = null; this.matCap = this.matEst = null;
    HIST_PLAN.liberar = false;
  }
}

export const HISTORIAL = new HistorialTiempo();
