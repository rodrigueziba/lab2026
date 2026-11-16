// Z45: recursos three del fractal en textura compartida. Se crean una vez (al montar el prisma) y se liberan
// al desmontar. El render se hace desde onBeforeRender de la malla de las caras (patrón del Reflector de three):
// así solo se calcula si la malla está visible y dentro del encuadre, y se usa el render real del renderer
// aunque RetroPostFX haya reemplazado gl.render por el composer.

import * as THREE from "three";
import { FRACTAL_JUNGLA_FRAG, FRACTAL_QUAD_VERT } from "./fractalJungla.glsl";
import { generarRuidoCelular } from "./ruidoCelular";
import { filaFranja, franjasFractal } from "./fractalTextura";         // Z69
import { E_GPU, medirIni, medirFin, contarFractal } from "@/lib/gpuPases"; // Z69

// Z69: lecturas para el panel de rendimiento (actualizaciones, franjas y tiempo de CPU por franja; el de GPU sale de
// lib/gpuPases con GPU_POR_PASE).
export const FRACTAL_PERF = { actualizaciones: 0, franjas: 1, cpuMsFranja: 0, res: 0 };

type Copiable = { copy(v: unknown): unknown; clone(): Copiable };

export interface RecursosFractalTex {
  rt: THREE.WebGLRenderTarget;
  escena: THREE.Scene;
  cam: THREE.OrthographicCamera;
  mat: THREE.ShaderMaterial;
  geo: THREE.BufferGeometry;
  pendiente: boolean;      // hay que recalcular la textura en el próximo dibujo de las caras
  frameHecho: number;      // último frame en que se recalculó (una vez por frame aunque la malla se dibuje 2 veces)
  frame: number;           // frame actual (lo avanza Prism.tsx)
  renders: number;         // contador de recálculos (diagnóstico)
  // Z69: reparto en franjas con doble textura. rt = la que se muestra; atras = la que se está armando.
  atras: THREE.WebGLRenderTarget;
  uniforms: Record<string, THREE.IUniform>;
  ciclo: boolean;          // hay una actualización a medio armar
  franja: number;          // próxima franja del ciclo
  nFranjas: number;        // franjas del ciclo en curso
  franjasPedidas: number;  // franjas para el próximo ciclo (pedirFranjas)
  urgente: boolean;        // tras cambiar de resolución: actualización completa en el mismo cuadro (sin negro)
  dtMedio: number;
  // instantánea de los uniforms al empezar el ciclo (todas las franjas de una actualización con los mismos valores)
  clavesNum: string[]; snapNum: Float64Array; vivoNum: Float64Array;
  clavesVec: string[]; snapVec: Copiable[]; vivoVec: Copiable[];
}

/** Textura de ruido celular (R = F1, G = F2), media precisión, repetida y con filtro lineal. */
export function crearTexturaRuido(tam: number, celdas: number): THREE.DataTexture {
  const f = generarRuidoCelular(tam, celdas);
  const h = new Uint16Array(f.length);
  for (let i = 0; i < f.length; i++) h[i] = THREE.DataUtils.toHalfFloat(f[i]);
  const tex = new THREE.DataTexture(h, tam, tam, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function crearRecursosFractalTex(
  uniforms: Record<string, THREE.IUniform>, defines: Record<string, number>, res: number,
): RecursosFractalTex {
  const rt = new THREE.WebGLRenderTarget(res, res, {
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false,
    depthBuffer: false, stencilBuffer: false, type: THREE.UnsignedByteType, format: THREE.RGBAFormat,
  });
  rt.texture.colorSpace = THREE.NoColorSpace;
  const geo = new THREE.PlaneGeometry(2, 2);
  const mat = new THREE.ShaderMaterial({
    vertexShader: FRACTAL_QUAD_VERT, fragmentShader: FRACTAL_JUNGLA_FRAG,
    uniforms, defines: { ...defines, MODO_TEXTURA: 1 },
    depthTest: false, depthWrite: false, transparent: false, blending: THREE.NoBlending,
  });
  const quad = new THREE.Mesh(geo, mat);
  quad.frustumCulled = false;
  const escena = new THREE.Scene();
  escena.add(quad);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  // Z69: segunda textura y lugar para la instantánea de los uniforms (se reserva una vez)
  const atras = rt.clone();
  atras.texture.colorSpace = THREE.NoColorSpace;
  const clavesNum: string[] = [], clavesVec: string[] = [], snapVec: Copiable[] = [], vivoVec: Copiable[] = [];
  for (const k of Object.keys(uniforms)) {
    const v = uniforms[k].value as unknown;
    if (typeof v === "number") clavesNum.push(k);
    else if (v && typeof v === "object" && !(v as { isTexture?: boolean }).isTexture && typeof (v as Copiable).copy === "function" && typeof (v as Copiable).clone === "function") {
      clavesVec.push(k); snapVec.push((v as Copiable).clone()); vivoVec.push((v as Copiable).clone());
    }
  }
  return {
    rt, escena, cam, mat, geo, pendiente: true, frameHecho: -1, frame: 0, renders: 0,
    atras, uniforms, ciclo: false, franja: 0, nFranjas: 1, franjasPedidas: 1, urgente: true, dtMedio: 0,
    clavesNum, snapNum: new Float64Array(clavesNum.length), vivoNum: new Float64Array(clavesNum.length),
    clavesVec, snapVec, vivoVec,
  };
}

/** Z69: cambia la resolución de las dos texturas (solo si cambió) y pide una actualización completa inmediata. */
export function ajustarResFractalTex(r: RecursosFractalTex, res: number): void {
  if (r.rt.width === res) return;
  r.rt.setSize(res, res); r.atras.setSize(res, res);
  r.ciclo = false; r.pendiente = true; r.urgente = true;
}
/** Z69: franjas del próximo ciclo según el ritmo de actualización y el tiempo de frame medio (una vez por frame). */
export function pedirFranjas(r: RecursosFractalTex, dt: number, texFps: number, max: number): void {
  if (dt > 0 && dt < 0.25) r.dtMedio = r.dtMedio <= 0 ? dt : r.dtMedio + (dt - r.dtMedio) * 0.05;
  r.franjasPedidas = franjasFractal(texFps, r.dtMedio, max);
}
function instantanea(r: RecursosFractalTex): void {
  const u = r.uniforms;
  for (let i = 0; i < r.clavesNum.length; i++) r.snapNum[i] = u[r.clavesNum[i]].value as number;
  for (let i = 0; i < r.clavesVec.length; i++) r.snapVec[i].copy(u[r.clavesVec[i]].value);
}
/** Pone la instantánea en los uniforms (guardando los valores vivos) o los restaura. */
function usarInstantanea(r: RecursosFractalTex, poner: boolean): void {
  const u = r.uniforms;
  for (let i = 0; i < r.clavesNum.length; i++) {
    const k = r.clavesNum[i];
    if (poner) { r.vivoNum[i] = u[k].value as number; u[k].value = r.snapNum[i]; } else u[k].value = r.vivoNum[i];
  }
  for (let i = 0; i < r.clavesVec.length; i++) {
    const v = u[r.clavesVec[i]].value as Copiable;
    if (poner) { r.vivoVec[i].copy(v); v.copy(r.snapVec[i]); } else v.copy(r.vivoVec[i]);
  }
}

/** Recalcula la textura si está pendiente (una vez por frame). Llamar desde onBeforeRender.
 *  Z69: cada actualización se arma en la textura de atrás en nFranjas franjas horizontales (una por cuadro, con los
 *  uniforms congelados al empezar) y recién completa pasa a mostrarse. Con 1 franja es como antes (mismo cuadro). */
export function renderFractalTex(r: RecursosFractalTex, renderer: THREE.WebGLRenderer): void {
  if (r.frameHecho === r.frame) return;                 // una franja por frame (la malla puede dibujarse 2 veces)
  if (!r.ciclo) {
    if (!r.pendiente) return;
    r.pendiente = false; r.ciclo = true; r.franja = 0;
    r.nFranjas = r.urgente ? 1 : Math.max(1, r.franjasPedidas);
    r.urgente = false;
    if (r.nFranjas > 1) instantanea(r);
  }
  r.frameHecho = r.frame;
  const t0 = performance.now();
  medirIni(E_GPU.fractal);
  const previo = renderer.getRenderTarget();
  const xr = renderer.xr.enabled, sombras = renderer.shadowMap.autoUpdate;
  renderer.xr.enabled = false;
  renderer.shadowMap.autoUpdate = false;
  const n = r.nFranjas, res = r.atras.height;
  if (n > 1) {
    const y0 = filaFranja(r.franja, n, res), y1 = filaFranja(r.franja + 1, n, res);
    r.atras.scissor.set(0, y0, r.atras.width, y1 - y0);
    r.atras.scissorTest = true;
    usarInstantanea(r, true);
  }
  renderer.setRenderTarget(r.atras);
  renderer.render(r.escena, r.cam);
  if (n > 1) { usarInstantanea(r, false); r.atras.scissorTest = false; }
  renderer.xr.enabled = xr;
  renderer.shadowMap.autoUpdate = sombras;
  renderer.setRenderTarget(previo);
  medirFin();
  contarFractal();
  const ms = performance.now() - t0;
  FRACTAL_PERF.cpuMsFranja += (ms - FRACTAL_PERF.cpuMsFranja) * 0.1;
  r.franja++;
  if (r.franja >= n) {                                   // completa: pasa a mostrarse
    const t = r.rt; r.rt = r.atras; r.atras = t;
    if (r.uniforms.uTex) r.uniforms.uTex.value = r.rt.texture;
    r.ciclo = false; r.renders++;
    FRACTAL_PERF.actualizaciones++; FRACTAL_PERF.franjas = n; FRACTAL_PERF.res = r.rt.width;
  }
}

export function liberarRecursosFractalTex(r: RecursosFractalTex): void {
  r.escena.clear();
  r.mat.dispose();
  r.geo.dispose();
  r.rt.dispose();
  r.atras.dispose();   // Z69
}
