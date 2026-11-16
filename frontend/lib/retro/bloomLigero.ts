// Z69: bloom liviano para el EffectComposer (reemplaza al UnrealBloomPass con DBG_RENDIMIENTO.BLOOM_OPTIMIZADO).
// Mismo umbral (LuminosityHighPass: luminancia lineal, ancho suave 0,01), misma fórmula de kernel y de composición
// (3 × intensidad × Σ peso · nivel), pero:
//  · resolución propia (BLOOM_ESCALA): setSize del composer ya no la pisa (en Z66 el Unreal corría a resolución completa)
//  · N niveles (BLOOM_NIVELES) que conservan el radio total del halo (plan en lib/rendimientoPost.ts)
//  · desenfoque separable con lecturas bilineales por pares (≈ la mitad de lecturas que el de three)
//  · targets sin depth buffer (el Unreal los crea con depth: memoria y ancho de banda de más)
//  · mezclar = false: no suma a pantalla completa; el pase final (PaseFinalPass) lee la textura del bloom.
// Sin allocations por frame: el plan, los materiales y los targets se rehacen solo al cambiar escala o niveles.
import * as THREE from "three";
import { Pass, FullScreenQuad } from "three/addons/postprocessing/Pass.js";
import { planBloom, paresKernel, type NivelBloom } from "@/lib/rendimientoPost";

const VERT = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
// 4 lecturas bilineales (cada una promedia 2×2 píxeles y cubren el bloque de un texel del primer nivel); umbral por
// lectura sobre el promedio de 2×2, como el de three. Con el primer nivel a la mitad (divisor 2) es una sola lectura:
// idéntico al LuminosityHighPass del Unreal
const FRAG_UMBRAL = /* glsl */`
  uniform sampler2D tDiffuse;
  uniform vec2 uOff;
  uniform float uUmbral, uSuave, uUna;
  varying vec2 vUv;
  vec3 hp(vec2 p) {
    vec3 c = texture2D(tDiffuse, p).rgb;
    float v = dot(c, vec3(0.2126729, 0.7151522, 0.0721750));
    return c * smoothstep(uUmbral, uUmbral + uSuave, v);
  }
  void main() {
    if (uUna > 0.5) { gl_FragColor = vec4(hp(vUv), 1.0); return; }
    vec3 s = hp(vUv + vec2(-uOff.x, -uOff.y)) + hp(vUv + vec2(uOff.x, -uOff.y))
           + hp(vUv + vec2(-uOff.x, uOff.y)) + hp(vUv + uOff);
    gl_FragColor = vec4(0.25 * s, 1.0);
  }
`;
const FRAG_BLUR = /* glsl */`
  uniform sampler2D tColor;
  uniform vec2 uInv, uDir;
  uniform float uW0;
  uniform float uW[NP];
  uniform float uO[NP];
  varying vec2 vUv;
  void main() {
    vec2 st = uDir * uInv;
    vec3 s = texture2D(tColor, vUv).rgb * uW0;
    for (int i = 0; i < NP; i++) {
      vec2 o = st * uO[i];
      s += (texture2D(tColor, vUv + o).rgb + texture2D(tColor, vUv - o).rgb) * uW[i];
    }
    gl_FragColor = vec4(s, 1.0);
  }
`;
const FRAG_COMP = /* glsl */`
  uniform sampler2D t0, t1, t2, t3, t4;
  uniform float uPeso[5];
  uniform float uFuerza;
  varying vec2 vUv;
  void main() {
    vec3 b = uPeso[0] * texture2D(t0, vUv).rgb;
    #if N > 1
    b += uPeso[1] * texture2D(t1, vUv).rgb;
    #endif
    #if N > 2
    b += uPeso[2] * texture2D(t2, vUv).rgb;
    #endif
    #if N > 3
    b += uPeso[3] * texture2D(t3, vUv).rgb;
    #endif
    #if N > 4
    b += uPeso[4] * texture2D(t4, vUv).rgb;
    #endif
    gl_FragColor = vec4(3.0 * uFuerza * b, 1.0);
  }
`;
const FRAG_COPIA = /* glsl */`
  uniform sampler2D tDiffuse;
  varying vec2 vUv;
  void main() { gl_FragColor = vec4(texture2D(tDiffuse, vUv).rgb, 1.0); }
`;

const crearRT = () => new THREE.WebGLRenderTarget(1, 1, {
  type: THREE.HalfFloatType, depthBuffer: false, stencilBuffer: false, generateMipmaps: false,
  minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
});
const DIR_X = new THREE.Vector2(1, 0), DIR_Y = new THREE.Vector2(0, 1);

export class BloomLigeroPass extends Pass {
  strength: number; threshold: number; radius: number;
  /** true: suma el bloom sobre la imagen (como el Unreal); false: lo deja en `textura` para el pase final. */
  mezclar = true;
  private plan: NivelBloom[] = [];
  private escala = -1; private niveles = -1;
  private w = 1; private h = 1;
  private readonly brillo = crearRT();
  private hRT: THREE.WebGLRenderTarget[] = [];
  private vRT: THREE.WebGLRenderTarget[] = [];
  private readonly matUmbral: THREE.ShaderMaterial;
  private matBlur: THREE.ShaderMaterial[] = [];
  private matComp: THREE.ShaderMaterial | null = null;
  private readonly matMezcla: THREE.ShaderMaterial;
  private readonly matCopia: THREE.ShaderMaterial;
  private readonly fsq = new FullScreenQuad();
  private readonly colorPrevio = new THREE.Color();

  constructor(escala: number, niveles: number, strength: number, radius: number, threshold: number) {
    super();
    this.strength = strength; this.radius = radius; this.threshold = threshold;
    this.needsSwap = false;
    this.matUmbral = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, uOff: { value: new THREE.Vector2() }, uUmbral: { value: threshold }, uSuave: { value: 0.01 }, uUna: { value: 0 } },
      vertexShader: VERT, fragmentShader: FRAG_UMBRAL, depthTest: false, depthWrite: false,
    });
    this.matMezcla = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null } }, vertexShader: VERT, fragmentShader: FRAG_COPIA,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation,
      depthTest: false, depthWrite: false, transparent: true,
    });
    this.matCopia = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null } }, vertexShader: VERT, fragmentShader: FRAG_COPIA, depthTest: false, depthWrite: false,
    });
    this.configurar(escala, niveles);
  }

  /** Textura con el bloom compuesto (resolución del primer nivel). Válida después de render(). */
  get textura(): THREE.Texture { return this.hRT[0].texture; }
  get planActual(): readonly NivelBloom[] { return this.plan; }

  /** Cambia escala o niveles (barato si no cambiaron: se llama en cada frame). */
  configurar(escala: number, niveles: number): void {
    const e = Math.max(0.1, Math.min(1, Number.isFinite(escala) ? escala : 0.5));
    const n = Math.max(1, Math.min(5, Math.round(Number.isFinite(niveles) ? niveles : 3)));
    if (e === this.escala && n === this.niveles) return;
    this.escala = e; this.niveles = n;
    this.plan = planBloom(e, n, this.radius);
    for (const m of this.matBlur) m.dispose();
    this.matComp?.dispose();
    while (this.hRT.length < n) { this.hRT.push(crearRT()); this.vRT.push(crearRT()); }
    while (this.hRT.length > n) { this.hRT.pop()!.dispose(); this.vRT.pop()!.dispose(); }
    this.matBlur = this.plan.map(nv => {
      const k = paresKernel(nv.kernel);
      return new THREE.ShaderMaterial({
        defines: { NP: k.pesos.length },
        uniforms: {
          tColor: { value: null }, uInv: { value: new THREE.Vector2() }, uDir: { value: DIR_X },
          uW0: { value: k.w0 }, uW: { value: k.pesos }, uO: { value: k.offs },
        },
        vertexShader: VERT, fragmentShader: FRAG_BLUR, depthTest: false, depthWrite: false,
      });
    });
    const pesos = [0, 0, 0, 0, 0];
    this.plan.forEach((nv, i) => { pesos[i] = nv.peso; });
    this.matComp = new THREE.ShaderMaterial({
      defines: { N: n },
      uniforms: {
        t0: { value: this.vRT[0].texture }, t1: { value: this.vRT[1]?.texture ?? null }, t2: { value: this.vRT[2]?.texture ?? null },
        t3: { value: this.vRT[3]?.texture ?? null }, t4: { value: this.vRT[4]?.texture ?? null },
        uPeso: { value: pesos }, uFuerza: { value: this.strength },
      },
      vertexShader: VERT, fragmentShader: FRAG_COMP, depthTest: false, depthWrite: false,
    });
    this.ajustar();
  }

  setSize(width: number, height: number): void {
    this.w = Math.max(1, Math.round(width)); this.h = Math.max(1, Math.round(height));
    this.ajustar();
  }

  private ajustar(): void {
    if (!this.plan.length) return;
    const tam = (d: number, x: number) => Math.max(1, Math.round(x / d));
    const D0 = this.plan[0].divisor;
    this.brillo.setSize(tam(D0, this.w), tam(D0, this.h));
    // 4 lecturas a ± (D0/4) píxeles del canvas: cada una promedia 2×2 → cubren el bloque de D0×D0
    (this.matUmbral.uniforms.uOff.value as THREE.Vector2).set(D0 / 4 / this.w, D0 / 4 / this.h);
    this.matUmbral.uniforms.uUna.value = D0 < 3 ? 1 : 0;
    this.plan.forEach((nv, i) => {
      const w = tam(nv.divisor, this.w), h = tam(nv.divisor, this.h);
      this.hRT[i].setSize(w, h); this.vRT[i].setSize(w, h);
      (this.matBlur[i].uniforms.uInv.value as THREE.Vector2).set(1 / w, 1 / h);
    });
  }

  render(renderer: THREE.WebGLRenderer, _writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget): void {
    renderer.getClearColor(this.colorPrevio);
    const alfaPrevio = renderer.getClearAlpha(), autoPrevio = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setClearColor(0x000000, 0);
    const fsq = this.fsq;

    if (this.renderToScreen) {   // último pase habilitado (solo si el resto está apagado): copia la imagen primero
      this.matCopia.uniforms.tDiffuse.value = readBuffer.texture;
      fsq.material = this.matCopia;
      renderer.setRenderTarget(null); renderer.clear(); fsq.render(renderer);
    }
    // 1) zonas brillantes
    this.matUmbral.uniforms.tDiffuse.value = readBuffer.texture;
    this.matUmbral.uniforms.uUmbral.value = this.threshold;
    fsq.material = this.matUmbral;
    renderer.setRenderTarget(this.brillo); renderer.clear(); fsq.render(renderer);
    // 2) niveles: cada uno parte del anterior
    let entrada = this.brillo;
    for (let i = 0; i < this.matBlur.length; i++) {
      const m = this.matBlur[i];
      fsq.material = m;
      m.uniforms.tColor.value = entrada.texture; m.uniforms.uDir.value = DIR_X;
      renderer.setRenderTarget(this.hRT[i]); renderer.clear(); fsq.render(renderer);
      m.uniforms.tColor.value = this.hRT[i].texture; m.uniforms.uDir.value = DIR_Y;
      renderer.setRenderTarget(this.vRT[i]); renderer.clear(); fsq.render(renderer);
      entrada = this.vRT[i];
    }
    // 3) composición (en hRT[0], que ya no se usa)
    if (this.matComp) {
      this.matComp.uniforms.uFuerza.value = this.strength;
      fsq.material = this.matComp;
      renderer.setRenderTarget(this.hRT[0]); renderer.clear(); fsq.render(renderer);
    }
    // 4) suma sobre la imagen (solo sin pase final fusionado)
    if (this.mezclar || this.renderToScreen) {
      this.matMezcla.uniforms.tDiffuse.value = this.hRT[0].texture;
      fsq.material = this.matMezcla;
      renderer.setRenderTarget(this.renderToScreen ? null : readBuffer);
      fsq.render(renderer);
    }
    renderer.setClearColor(this.colorPrevio, alfaPrevio);
    renderer.autoClear = autoPrevio;
  }

  dispose(): void {
    this.brillo.dispose();
    for (const rt of this.hRT) rt.dispose();
    for (const rt of this.vRT) rt.dispose();
    for (const m of this.matBlur) m.dispose();
    this.matComp?.dispose();
    this.matUmbral.dispose(); this.matMezcla.dispose(); this.matCopia.dispose();
    this.fsq.dispose();
  }
}
