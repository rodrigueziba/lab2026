"use client";
// Z23: dos iconos GRABADOS en el piso entre la posición inicial y el telón: silla a la izquierda
// (camino SILLAS) y luz de teatro a la derecha (camino TARIMA), leídos derechos desde el usuario
// (la parte de arriba del dibujo apunta al telón). Decals visuales: sin colisión ni triggers.
// - Máscara: los SVG de /alight/icons rasterizados a 1024 px (R = trazo, G = trazo difuminado
//   para el halo) en una CanvasTexture (NoColorSpace, mipmaps, anisotropía máxima).
// - Aspecto: surco (oscurece el piso), bisel fino más claro abajo a la derecha, sin brillo propio.
// - Reflejo con la mirada (sin luces): factor por icono según el ángulo entre el forward de la
//   cámara y la dirección al icono (cono con histéresis + suavizado), × reflectancia rasante.
// - Visibles desde la carga (estado 'cortina' y 'exploracion'); se desvanecen al elegir camino.
// Sin allocations por frame; texturas, materiales, geometría y listeners liberados al desmontar.

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { DBG_PISO_ICONOS } from "@/lib/debugConfig";
import { anclarTelon } from "@/lib/inicioEscena";
import { INTERACT_STATE } from "@/lib/alightStore";

// Z25: parámetro de versión contra la caché del navegador (una sola ruta; timestamp de carga del módulo)
const V_ICONOS = Date.now().toString(36);
const ICONOS = [`/alight/icons/icono-silla.svg?v=${V_ICONOS}`, `/alight/icons/icono-luz.svg?v=${V_ICONOS}`] as const;
// Z24: engrosado leve por código (dilatación de la máscara en px de 1024) para que los trazos
// finos de la silla nueva (11–16 / 512) sobrevivan un nivel más de mipmap a distancia.
const DILATAR_PX = [2, 0] as const;
const TAM_TEX = 1024;
const ALTURA_M = 0.004;           // separación mínima sobre el piso (+ polygonOffset)

const VERT = /* glsl */`
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
// Mezcla premultiplicada (src = ONE, dst = ONE_MINUS_SRC_ALPHA):
//   rgb = bisel + reflejo (luz que suma), a = oscurecimiento del surco (multiplica el piso).
const FRAG = /* glsl */`
  uniform sampler2D uMask;
  uniform float uFade, uMirada, uBrillo, uSurco, uBisel, uTexel;
  uniform vec3  uColor;
  varying vec2  vUv;
  varying vec3  vWorld;
  void main() {
    vec4 t = texture2D(uMask, vUv);
    float m = t.r, halo = t.g;
    // bisel: borde del trazo del lado inferior derecho (el vecino abajo-derecha queda afuera)
    float vecino = texture2D(uMask, vUv + vec2(uTexel, -uTexel)).r;
    float bisel = clamp(m - vecino, 0.0, 1.0);
    // reflectancia rasante: más fuerte cuanto más rasante es la vista (piso pulido)
    vec3 V = normalize(cameraPosition - vWorld);
    float rasante = mix(0.35, 1.0, pow(1.0 - abs(V.y), 1.5));
    float glow = uMirada * rasante * uBrillo * (m + 0.45 * halo);
    vec3 rgb = vec3(0.86, 0.80, 0.70) * (bisel * uBisel) + uColor * glow;
    float a = m * uSurco;
    if (a + glow + bisel < 0.002) discard;
    gl_FragColor = vec4(rgb * uFade, a * uFade);
  }
`;

/** Rasteriza un SVG a una máscara empaquetada (R = trazo, G = trazo difuminado). */
function rasterizar(url: string, dilatar = 0): Promise<THREE.CanvasTexture> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const nitido = document.createElement("canvas"); nitido.width = nitido.height = TAM_TEX;
      const cn = nitido.getContext("2d")!;
      cn.drawImage(img, 0, 0, TAM_TEX, TAM_TEX);
      // Z24: dilatación = el mismo dibujo corrido en un círculo de radio `dilatar` (solo al cargar)
      if (dilatar > 0) for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        cn.drawImage(img, Math.cos(a) * dilatar, Math.sin(a) * dilatar, TAM_TEX, TAM_TEX);
      }
      const difuso = document.createElement("canvas"); difuso.width = difuso.height = TAM_TEX;
      const cd = difuso.getContext("2d")!;
      cd.filter = "blur(14px)";                     // si el navegador no lo soporta, el halo es el trazo
      cd.drawImage(img, 0, 0, TAM_TEX, TAM_TEX);
      const a = cn.getImageData(0, 0, TAM_TEX, TAM_TEX).data, b = cd.getImageData(0, 0, TAM_TEX, TAM_TEX).data;
      const out = cn.createImageData(TAM_TEX, TAM_TEX), o = out.data;
      for (let i = 0; i < o.length; i += 4) { o[i] = a[i + 3]; o[i + 1] = b[i + 3]; o[i + 2] = 0; o[i + 3] = 255; }
      const final = document.createElement("canvas"); final.width = final.height = TAM_TEX;
      final.getContext("2d")!.putImageData(out, 0, 0);
      const tex = new THREE.CanvasTexture(final);
      tex.colorSpace = THREE.NoColorSpace;
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      res(tex);
    };
    img.onerror = () => rej(new Error(`no cargó ${url}`));
    img.src = url;
  });
}

export default function PisoIconos() {
  const { camera, gl } = useThree();
  const meshes = useRef<(THREE.Mesh | null)[]>([null, null]);
  const geo = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const mats = useMemo(() => [0, 1].map(() => new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG,
    uniforms: {
      uMask: { value: null as THREE.Texture | null }, uFade: { value: 0 }, uMirada: { value: 0 },
      uBrillo: { value: 0.38 }, uSurco: { value: 0.52 }, uBisel: { value: 0.1 },
      uTexel: { value: 2.5 / TAM_TEX }, uColor: { value: new THREE.Color("#FFE2A8") },
    },
    transparent: true, depthWrite: false, depthTest: true,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,   // sin z-fighting con el piso
    toneMapped: false, fog: false,
  })), []);

  // pose de referencia: la posición inicial y su forward horizontal (igual que el telón al montar)
  const base = useRef({ x: 0, z: 0, fx: 0, fz: -1, listo: false });
  const est = useRef({ fade: 0, elegido: false, mirada: [0, 0], on: [false, false] });
  const _f = useMemo(() => new THREE.Vector3(), []);
  const _p = useMemo(() => new THREE.Vector3(), []);

  // Z24: referencia = el ANCLA del telón (fija en el mundo), no la posición del usuario
  useEffect(() => {
    const A = anclarTelon();                                      // Z25: ancla fija (no depende de la cámara)
    base.current = { x: A.cx, z: A.cz, fx: A.fx, fz: A.fz, listo: true };
  }, [camera]);

  // máscaras (una por icono), anisotropía máxima; se liberan al desmontar
  useEffect(() => {
    let vivo = true;
    const texs: THREE.Texture[] = [];
    const aniso = gl.capabilities.getMaxAnisotropy();
    ICONOS.forEach((url, i) => {
      rasterizar(url, DILATAR_PX[i]).then(t => {
        if (!vivo) { t.dispose(); return; }
        t.anisotropy = aniso;
        texs.push(t);
        const mm = meshes.current[i];
        if (mm) (mm.material as THREE.ShaderMaterial).uniforms.uMask.value = t;
        gl.initTexture(t);
      }).catch(e => console.warn("[PisoIconos] Z23:", e));
    });
    const ms = meshes.current;
    return () => {
      vivo = false;
      for (const t of texs) t.dispose();
      for (const mm of ms) if (mm) (mm.material as THREE.ShaderMaterial).uniforms.uMask.value = null;
    };
  }, [gl]);

  // ciclo de vida: elegir camino los apaga; los reset de debug los devuelven
  useEffect(() => {
    const elegir = () => { est.current.elegido = true; };
    const reset = () => { est.current.elegido = false; };
    window.addEventListener("alight:chose-chairs", elegir);
    window.addEventListener("alight:chose-light", elegir);
    window.addEventListener("alight:debug-reset-sillas", reset);
    window.addEventListener("alight:debug-reset-curtain", reset);
    return () => {
      window.removeEventListener("alight:chose-chairs", elegir);
      window.removeEventListener("alight:chose-light", elegir);
      window.removeEventListener("alight:debug-reset-sillas", reset);
      window.removeEventListener("alight:debug-reset-curtain", reset);
    };
  }, []);

  useEffect(() => () => { geo.dispose(); for (const m of mats) m.dispose(); }, [geo, mats]);

  useFrame((_, dt) => {
    const D = DBG_PISO_ICONOS, B = base.current, E = est.current;
    if (!B.listo) return;
    const st = INTERACT_STATE.experienceState;
    const objetivo = D.PISO_ICONOS && !E.elegido && (st === "cortina" || st === "exploracion") ? 1 : 0;
    const paso = dt * 1000 / Math.max(1, D.FADE_MS);
    E.fade = objetivo > E.fade ? Math.min(1, E.fade + paso) : objetivo < E.fade ? Math.max(0, E.fade - paso) : E.fade;
    const visible = E.fade > 0.001;

    // Z24: posición respecto del telón: su centro queda DIST_TELON_M + ICONOS_ACERCAR_M antes del
    // telón (hacia el usuario). B = centro del telón; dist negativa = hacia atrás desde el telón.
    const tam = Math.max(0.1, D.ICONOS_TAMANO_M);
    const dist = -Math.max(tam / 2 + 0.1, D.DIST_TELON_M + D.ICONOS_ACERCAR_M);
    const rx = -B.fz, rz = B.fx;                                   // derecha (como en Curtain)
    const yaw = Math.atan2(-B.fx, -B.fz);

    camera.getWorldDirection(_f);
    // mirada: cono con histéresis, solo el icono más centrado puede brillar
    const ang = [180, 180];
    for (let i = 0; i < 2; i++) {
      const lado = i === 0 ? -1 : 1;                               // 0 = silla (izq.), 1 = luz (der.)
      const cx = B.x + B.fx * dist + rx * lado * D.SEP_M / 2, cz = B.z + B.fz * dist + rz * lado * D.SEP_M / 2;
      const m = meshes.current[i];
      if (m) {
        m.visible = visible;
        m.position.set(cx, ALTURA_M, cz);
        m.rotation.set(-Math.PI / 2, yaw, 0, "YXZ");              // arriba del dibujo → hacia el telón
        m.scale.set(tam, tam, 1);
      }
      _p.set(cx, 0, cz).sub(camera.position);
      const len = _p.length();
      ang[i] = len > 1e-4 ? Math.acos(THREE.MathUtils.clamp(_f.dot(_p) / len, -1, 1)) * 180 / Math.PI : 180;
      if (E.on[i] && ang[i] > D.SALE_DEG) E.on[i] = false;
      else if (!E.on[i] && ang[i] < D.ENTRA_DEG) E.on[i] = true;
    }
    if (E.on[0] && E.on[1]) { if (ang[0] <= ang[1]) E.on[1] = false; else E.on[0] = false; }
    const k = 1 - Math.exp(-dt * 3 / Math.max(0.01, D.SUAV_S));    // ~95 % en SUAV_S
    for (let i = 0; i < 2; i++) {
      // factor suave: 1 cerca del centro del cono, 0 en el ángulo de salida
      const tgt = E.on[i] ? 1 - THREE.MathUtils.smoothstep(ang[i], Math.min(D.ENTRA_DEG, D.SALE_DEG) * 0.5, Math.max(D.SALE_DEG, 0.1)) : 0;
      E.mirada[i] += (tgt - E.mirada[i]) * k;
      const mm = meshes.current[i];
      if (!mm) continue;
      const u = (mm.material as THREE.ShaderMaterial).uniforms;     // vía la ref (no se muta el valor del hook)
      u.uFade.value = E.fade; u.uMirada.value = E.mirada[i];
      u.uBrillo.value = D.BRILLO_MAX; u.uSurco.value = D.SURCO; u.uBisel.value = D.BISEL;
    }
  });

  return (
    <group>
      {[0, 1].map(i => (
        <mesh key={i} ref={el => { meshes.current[i] = el; }} geometry={geo} material={mats[i]}
          renderOrder={1} visible={false} frustumCulled={false} />
      ))}
    </group>
  );
}
