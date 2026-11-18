"use client";
// Z94/Z94b: pase plano del domo de la tarima para la transmisión (lib/vivo/videoProcesado.ts, lib/vivo/publicarLiveKit.ts).
// Solo mientras hay transmisión con video "procesado" (TX_PROC.activa), a TX_PROC.fps (15):
//  1. dibuja el MISMO shader del domo (FaceDome: DOME_FRAG; uniforms compartidos por referencia → efectos por sector,
//     rotación de glitches, SIG.EFE., brillo/contraste/saturación/zoom/psico del atril, en vivo) en un quad plano hacia un
//     WebGLRenderTarget propio de 640×360 (RGBA, UnsignedByte, sin mipmaps), con el render ORIGINAL del renderer
//     (RetroPostFX lo reemplaza por el composer: RENDER_ORIGINAL; three 0.183 define render en el constructor, por eso
//     WebGLRenderer.prototype.render de Z94 era undefined y la copia fallaba siempre);
//  2. lo lee con readRenderTargetPixelsAsync (PBO + fence: no bloquea la GPU) en el Uint8Array único del lienzo;
//  3. al completarse, TX_PROC.alLeer → putImageData + requestFrame (lib/vivo/publicarLiveKit.ts).
// Nunca más de una lectura en vuelo (se saltea el cuadro). La lectura de WebGL viene de abajo hacia arriba: el vertex
// invierte v, así la fila 0 leída es la de arriba (sin trabajo extra). Sin transmisión no se crea nada; al cortar se
// liberan render target, material y quad. Benchmark: SIS.videoTransmitidoTarima.
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { DOME_FRAG, DBG_DOME_MAT, FACE_DOME_VIS } from "./FaceDome";
import { RENDER_ORIGINAL } from "./RetroPostFX";
import { TX_PROC, PASE_HOST } from "@/lib/vivo/publicarLiveKit";
import { DBG_LIVEKIT, DBG_RENDIMIENTO } from "@/lib/debugConfig";

const VERT = /* glsl */`
  uniform float uEspejo;
  varying vec2 vUv;
  void main() {
    vUv = vec2(mix(uv.x, 1.0 - uv.x, uEspejo), 1.0 - uv.y);   // Z94b: v invertida (readPixels lee de abajo hacia arriba)
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;
// mismo fragment del domo + codificación sRGB opcional al final (en pantalla la hace el OutputPass)
const FRAG = DOME_FRAG.replace("uniform sampler2D uMap;", "uniform sampler2D uMap;\n  uniform float uSrgb;").replace(
  "gl_FragColor = col;",
  "vec3 c = clamp(col.rgb, 0.0, 1.0);\n    vec3 e = mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));\n    gl_FragColor = vec4(mix(c, e, uSrgb), 1.0);",
);

interface Gpu { base: THREE.ShaderMaterial; mat: THREE.ShaderMaterial; geo: THREE.PlaneGeometry; escena: THREE.Scene; cam: THREE.Camera;
  rt: THREE.WebGLRenderTarget }
// uniforms propios del pase (de módulo: hay un solo host; se escriben por cuadro sin allocations)
const U_ESPEJO = { value: 0 }, U_SRGB = { value: 1 };

function soltar(g: Gpu | null): void { if (g) { g.geo.dispose(); g.mat.dispose(); g.rt.dispose(); } }

export default function VideoTransmitidoTarima() {
  const gl = useThree(s => s.gl);
  const gpu = useRef<Gpu | null>(null);

  useEffect(() => () => { soltar(gpu.current); gpu.current = null; PASE_HOST.listo = false; }, []);

  useFrame(() => {
    const base = DBG_DOME_MAT.value;
    PASE_HOST.listo = FACE_DOME_VIS.value && !!base;
    const T = TX_PROC;
    if (!T.activa) { if (gpu.current) { soltar(gpu.current); gpu.current = null; } return; }   // cortar: nada queda
    if (DBG_RENDIMIENTO.SIS.videoTransmitidoTarima === false) return;   // benchmark: queda el último cuadro
    const ahora = performance.now();
    if (!T.cadencia.toca(ahora, T.fps)) return;
    if (!PASE_HOST.listo || !base) { T.marcarFallo("el domo de la tarima no está en pantalla"); return; }
    const l = T.lienzo;
    if (!l) return;
    let g = gpu.current;
    if (!g || g.base !== base || g.rt.width !== T.ancho || g.rt.height !== T.alto) {
      soltar(g);
      // los IUniform del domo se comparten por referencia: lo que FaceDome y el atril escriben se ve acá sin copiar nada
      const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: { ...base.uniforms, uEspejo: U_ESPEJO, uSrgb: U_SRGB }, depthTest: false, depthWrite: false });
      const geo = new THREE.PlaneGeometry(2, 2);
      const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false;
      const escena = new THREE.Scene(); escena.add(mesh);
      const rt = new THREE.WebGLRenderTarget(T.ancho, T.alto, {
        format: THREE.RGBAFormat, type: THREE.UnsignedByteType, generateMipmaps: false, depthBuffer: false,
        minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      });
      g = gpu.current = { base, mat, geo, escena, cam: new THREE.Camera(), rt };
    }
    if (!T.empezarLectura(ahora)) return;   // ya hay una lectura en vuelo: se saltea este cuadro
    U_ESPEJO.value = DBG_LIVEKIT.PROCESADO_ESPEJO ? 1 : 0;
    U_SRGB.value = DBG_LIVEKIT.PROCESADO_SRGB ? 1 : 0;
    const previo = gl.getRenderTarget();
    try {
      gl.setRenderTarget(g.rt);
      const r = RENDER_ORIGINAL.fn;
      if (r) r(g.escena, g.cam); else gl.render(g.escena, g.cam);
      gl.setRenderTarget(previo);
      gl.readRenderTargetPixelsAsync(g.rt, 0, 0, T.ancho, T.alto, l.buffer).then(T.alLeer, T.alFallar);
    } catch (e) {
      gl.setRenderTarget(previo);
      T.alFallar(e);
    }
  });
  return null;
}
