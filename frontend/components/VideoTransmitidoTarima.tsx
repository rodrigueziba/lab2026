"use client";
// Z94: pase plano del domo de la tarima para la transmisión (lib/vivo/videoProcesado.ts, lib/vivo/publicarLiveKit.ts).
// Solo mientras hay transmisión con FUENTE_VIDEO "procesado" (TX_PROC.activa): a TX_PROC.fps (15), con el renderer
// PRINCIPAL, dibuja el MISMO shader del domo (FaceDome: DOME_FRAG; uniforms compartidos por referencia → efectos por
// sector, rotación de glitches, SIG.EFE., brillo/contraste/saturación/zoom/psico del atril de imagen, en vivo) sobre un
// quad plano en la región 640×360 de abajo a la izquierda del framebuffer por defecto, ANTES del render de la escena
// (useFrame de prioridad 0); copia esa región con drawImage al canvas transmisible (GPU→GPU en Chrome, sin readPixels) y el
// render normal del cuadro la pisa (nunca se ve). Una sola copia plana de las 7 franjas; SILLAS repite y cubre (Z84).
// RetroPostFX reemplaza gl.render por el composer: acá se llama a WebGLRenderer.prototype.render (el original).
// Sin transmisión: no se crea nada (material y quad se liberan al cortar). Benchmark: SIS.videoTransmitidoTarima.
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { DOME_FRAG, DBG_DOME_MAT, FACE_DOME_VIS } from "./FaceDome";
import { TX_PROC, PASE_HOST } from "@/lib/vivo/publicarLiveKit";
import { DBG_LIVEKIT, DBG_RENDIMIENTO } from "@/lib/debugConfig";

const VERT = /* glsl */`
  uniform float uEspejo;
  varying vec2 vUv;
  void main() {
    vUv = vec2(mix(uv.x, 1.0 - uv.x, uEspejo), uv.y);
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;
// mismo fragment del domo + codificación sRGB opcional al final (en pantalla la hace el OutputPass)
const FRAG = DOME_FRAG.replace("uniform sampler2D uMap;", "uniform sampler2D uMap;\n  uniform float uSrgb;").replace(
  "gl_FragColor = col;",
  "vec3 c = clamp(col.rgb, 0.0, 1.0);\n    vec3 e = mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));\n    gl_FragColor = vec4(mix(c, e, uSrgb), 1.0);",
);
const RENDER = THREE.WebGLRenderer.prototype.render;
const _vp = new THREE.Vector4(), _sc = new THREE.Vector4();

interface Gpu { base: THREE.ShaderMaterial; mat: THREE.ShaderMaterial; geo: THREE.PlaneGeometry; escena: THREE.Scene; cam: THREE.Camera;
  uEspejo: { value: number }; uSrgb: { value: number } }

export default function VideoTransmitidoTarima() {
  const gl = useThree(s => s.gl);
  const gpu = useRef<Gpu | null>(null);

  useEffect(() => () => {
    const g = gpu.current;
    if (g) { g.geo.dispose(); g.mat.dispose(); gpu.current = null; }
    PASE_HOST.listo = false;
  }, []);

  useFrame(() => {
    const base = DBG_DOME_MAT.value;
    PASE_HOST.listo = FACE_DOME_VIS.value && !!base;
    if (!TX_PROC.activa) {
      const g = gpu.current;
      if (g) { g.geo.dispose(); g.mat.dispose(); gpu.current = null; }   // cortar: nada queda
      return;
    }
    if (DBG_RENDIMIENTO.SIS.videoTransmitidoTarima === false) return;   // benchmark: queda el último cuadro
    const ahora = performance.now();
    if (!TX_PROC.cadencia.toca(ahora, TX_PROC.fps)) return;
    if (!PASE_HOST.listo || !base) { TX_PROC.marcarFallo("el domo de la tarima no está en pantalla (queda el último cuadro)"); return; }
    let g = gpu.current;
    if (!g || g.base !== base) {
      if (g) { g.geo.dispose(); g.mat.dispose(); }
      const uEspejo = { value: 0 }, uSrgb = { value: 1 };
      // los IUniform del domo se comparten por referencia: lo que FaceDome y el atril escriben se ve acá sin copiar nada
      const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: { ...base.uniforms, uEspejo, uSrgb }, depthTest: false, depthWrite: false });
      const geo = new THREE.PlaneGeometry(2, 2);
      const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false;
      const escena = new THREE.Scene(); escena.add(mesh);
      g = gpu.current = { base, mat, geo, escena, cam: new THREE.Camera(), uEspejo, uSrgb };
    }
    g.uEspejo.value = DBG_LIVEKIT.PROCESADO_ESPEJO ? 1 : 0;
    g.uSrgb.value = DBG_LIVEKIT.PROCESADO_SRGB ? 1 : 0;
    const l = TX_PROC.lienzo;
    const ctx = l?.ctx as CanvasRenderingContext2D | undefined;
    const cv = gl.domElement, pr = gl.getPixelRatio() || 1;
    const w = Math.min(TX_PROC.ancho, cv.width), h = Math.min(TX_PROC.alto, cv.height);
    if (!ctx || w < 2 || h < 2) return;
    const auto = gl.autoClear, rt = gl.getRenderTarget(), scT = gl.getScissorTest();
    gl.getViewport(_vp); gl.getScissor(_sc);
    try {
      gl.setRenderTarget(null);
      gl.autoClear = false;
      gl.setViewport(0, 0, w / pr, h / pr); gl.setScissor(0, 0, w / pr, h / pr); gl.setScissorTest(true);
      RENDER.call(gl, g.escena, g.cam);
      ctx.drawImage(cv, 0, cv.height - h, w, h, 0, 0, TX_PROC.ancho, TX_PROC.alto);   // sin readPixels
      TX_PROC.cadencia.dibujado(ahora);
      if (TX_PROC.fallo) TX_PROC.fallo = "";
    } catch {
      TX_PROC.marcarFallo("falló la copia del pase (queda el último cuadro)");
    } finally {
      gl.setScissorTest(scT); gl.setScissor(_sc); gl.setViewport(_vp); gl.autoClear = auto; gl.setRenderTarget(rt);
    }
  });
  return null;
}
