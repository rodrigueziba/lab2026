// Z72: domo dibujado a escala menor (DBG_RENDIMIENTO.DOME_ESCALA < 1). El shader del portal es el más caro de la escena
// (4,3 ms a 2268 × 1291): se dibuja en un render target propio de (ancho × escala) × (alto × escala) y la MISMA malla del
// domo lo muestra con un material compositor que lo lee con muestreo bilineal en la posición de pantalla de cada
// fragmento. Así se conservan la geometría, la prueba de profundidad, el orden de dibujo (renderOrder) y el alfa bajo
// el horizonte (el target guarda color premultiplicado; el compositor mezcla con One / OneMinusSrcAlpha, que es lo
// mismo que la mezcla normal del original). El dibujo al target se hace en onBeforeRender de la malla (patrón del
// Reflector de three: cámara ya actualizada, mismo cuadro, solo si la malla está visible). Sin allocations por frame.
// Escala 1 = como estaba (material original, sin target).
import * as THREE from "three";

const VERT = /* glsl */`
  void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const FRAG = /* glsl */`
  uniform sampler2D uRT;
  uniform vec2 uInvRes;
  void main() { gl_FragColor = texture2D(uRT, gl_FragCoord.xy * uInvRes); }
`;

/** Tamaño del target para una escala (al menos 1 × 1). */
export function tamanoEscalado(w: number, h: number, escala: number): [number, number] {
  const e = Math.max(0.1, Math.min(1, Number.isFinite(escala) ? escala : 1));
  return [Math.max(1, Math.round(w * e)), Math.max(1, Math.round(h * e))];
}

export class DomoEscalado {
  readonly rt = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType, depthBuffer: false, stencilBuffer: false, generateMipmaps: false,
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
  });
  readonly compositor: THREE.ShaderMaterial;
  private readonly escena = new THREE.Scene();
  private readonly malla: THREE.Mesh;
  private readonly tam = new THREE.Vector2();
  private readonly colorPrevio = new THREE.Color();
  private escala = 1;
  private shell: THREE.Mesh | null = null;
  private original: THREE.Material | null = null;

  constructor() {
    this.compositor = new THREE.ShaderMaterial({
      name: "DomoEscaladoZ72",
      uniforms: { uRT: { value: this.rt.texture }, uInvRes: { value: new THREE.Vector2(1, 1) } },
      vertexShader: VERT, fragmentShader: FRAG,
      side: THREE.BackSide, transparent: true, depthWrite: false,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    this.malla = new THREE.Mesh(new THREE.BufferGeometry(), undefined);
    this.malla.matrixAutoUpdate = false;
    this.malla.matrixWorldAutoUpdate = false;
    this.malla.frustumCulled = false;
    this.escena.add(this.malla);
  }

  /** Aplica la escala a la malla del domo (una vez por frame; barato si no cambió nada). Escala ≥ 0,999 = original. */
  aplicar(shell: THREE.Mesh, original: THREE.Material, escala: number): void {
    const e = Math.max(0.1, Math.min(1, Number.isFinite(escala) ? escala : 1));
    this.escala = e;
    if (e >= 0.999) { this.soltar(); if (shell.material !== original) shell.material = original; return; }
    if (this.shell !== shell) { this.soltar(); this.shell = shell; shell.onBeforeRender = this.antes; }
    this.original = original;
    if (shell.material !== this.compositor) shell.material = this.compositor;
  }

  /** Devuelve la malla a su material original y quita el gancho. */
  soltar(): void {
    const s = this.shell;
    if (!s) return;
    s.onBeforeRender = () => {};
    if (this.original && s.material === this.compositor) s.material = this.original;
    this.shell = null;
  }

  // dibujo del domo al target, justo antes de que la malla se dibuje con el compositor
  private readonly antes = (renderer: THREE.WebGLRenderer, _escena: THREE.Scene, camara: THREE.Camera): void => {
    const s = this.shell, mat = this.original;
    if (!s || !mat) return;
    const previo = renderer.getRenderTarget();
    if (previo) this.tam.set(previo.width, previo.height); else renderer.getDrawingBufferSize(this.tam);
    const [w, h] = tamanoEscalado(this.tam.x, this.tam.y, this.escala);
    if (this.rt.width !== w || this.rt.height !== h) this.rt.setSize(w, h);
    (this.compositor.uniforms.uInvRes.value as THREE.Vector2).set(1 / this.tam.x, 1 / this.tam.y);
    const m = this.malla;
    m.geometry = s.geometry; m.material = mat;
    m.matrixWorld.copy(s.matrixWorld);
    renderer.getClearColor(this.colorPrevio);
    const alfa = renderer.getClearAlpha(), auto = renderer.autoClear, xr = renderer.xr.enabled, sombras = renderer.shadowMap.autoUpdate;
    renderer.xr.enabled = false; renderer.shadowMap.autoUpdate = false;
    renderer.setClearColor(0x000000, 0); renderer.autoClear = true;
    renderer.setRenderTarget(this.rt);
    renderer.render(this.escena, camara);
    renderer.setRenderTarget(previo);
    renderer.setClearColor(this.colorPrevio, alfa); renderer.autoClear = auto;
    renderer.xr.enabled = xr; renderer.shadowMap.autoUpdate = sombras;
  };

  dispose(): void {
    this.soltar();
    this.rt.dispose();
    this.compositor.dispose();
    this.escena.remove(this.malla);
  }
}

/** Instancia única (la usa ExperienceDome); se crea al primer uso con escala < 1 y se libera al desmontar. */
let _domo: DomoEscalado | null = null;
export function aplicarEscalaDomo(shell: THREE.Mesh, original: THREE.Material, escala: number): void {
  if (!_domo) { if (escala >= 0.999) { if (shell.material !== original) shell.material = original; return; } _domo = new DomoEscalado(); }
  _domo.aplicar(shell, original, escala);
}
export function liberarEscalaDomo(): void { _domo?.dispose(); _domo = null; }
