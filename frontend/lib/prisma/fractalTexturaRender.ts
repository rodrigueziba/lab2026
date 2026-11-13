// Z45: recursos three del fractal en textura compartida. Se crean una vez (al montar el prisma) y se liberan
// al desmontar. El render se hace desde onBeforeRender de la malla de las caras (patrón del Reflector de three):
// así solo se calcula si la malla está visible y dentro del encuadre, y se usa el render real del renderer
// aunque RetroPostFX haya reemplazado gl.render por el composer.

import * as THREE from "three";
import { FRACTAL_JUNGLA_FRAG, FRACTAL_QUAD_VERT } from "./fractalJungla.glsl";
import { generarRuidoCelular } from "./ruidoCelular";

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
  return { rt, escena, cam, mat, geo, pendiente: true, frameHecho: -1, frame: 0, renders: 0 };
}

/** Recalcula la textura si está pendiente (una vez por frame). Llamar desde onBeforeRender. */
export function renderFractalTex(r: RecursosFractalTex, renderer: THREE.WebGLRenderer): void {
  if (!r.pendiente || r.frameHecho === r.frame) return;
  r.pendiente = false;
  r.frameHecho = r.frame;
  r.renders++;
  const previo = renderer.getRenderTarget();
  const xr = renderer.xr.enabled, sombras = renderer.shadowMap.autoUpdate;
  renderer.xr.enabled = false;
  renderer.shadowMap.autoUpdate = false;
  renderer.setRenderTarget(r.rt);
  renderer.render(r.escena, r.cam);
  renderer.xr.enabled = xr;
  renderer.shadowMap.autoUpdate = sombras;
  renderer.setRenderTarget(previo);
}

export function liberarRecursosFractalTex(r: RecursosFractalTex): void {
  r.escena.clear();
  r.mat.dispose();
  r.geo.dispose();
  r.rt.dispose();
}
