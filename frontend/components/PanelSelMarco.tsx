"use client";
// Z2: marco de selección de la linterna — esquinas ámbar #FF9A1F + rótulo "SEL ▮▮▮▮ LOCK"
// (mockup docs/mockups/mockup-paneles-proyecto.png). UN solo plano compartido que se
// ubica sobre el panel seleccionado: sin luces, sin un objeto por panel.
// Las esquinas son procedurales (se adaptan a MARCO_PAD_M en vivo); el rótulo es un
// canvas dibujado una vez. Las 4 barras se llenan con el progreso hacia 'abierto'.
// Montar dentro de ExperienceDome (grupo raíz sin transformación → local = mundo).

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { LINTERNA_STATE, ACERC } from "@/lib/linternaPaneles";
import { DBG_LINTERNA, DBG_PRIORIDAD, DBG_SUBPANELES, DBG_AISLAR_UI } from "@/lib/debugConfig";
import { CAPA_UI } from "@/lib/retro/capaUI";
import { RETRO_FLAGS } from "@/lib/retro/retroFlags";

const LABEL_W_M = 2.2;   // ancho del rótulo en metros (canvas 512×64 → 8:1)
const LABEL_H_M = LABEL_W_M / 8;
const LABEL_GAP_M = 0.08;
const BRACKET_TH_M = 0.07;  // grosor de las esquinas
const BRACKET_LEN_M = 0.6;  // largo de cada brazo
const OFFSET_M = 0.03;      // separación hacia el centro del domo (evita z-fighting)

function crearRotulo(): { tex: THREE.CanvasTexture; u: [number, number, number] } | null {
  if (typeof document === "undefined") return null;
  const cv = document.createElement("canvas");
  cv.width = 512; cv.height = 64;
  const ctx = cv.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 34px ui-monospace, Menlo, monospace";
  ctx.textBaseline = "middle";
  let x = 4;
  ctx.fillText("SEL", x, 34);
  x += ctx.measureText("SEL").width + 18;
  const barsU0 = x / 512;
  for (let i = 0; i < 4; i++) { ctx.fillRect(x, 16, 14, 34); x += 22; }
  const barsU1 = (x - 8) / 512;
  x += 18;
  const lockU0 = x / 512;
  ctx.fillText("LOCK", x, 34);
  const tex = new THREE.CanvasTexture(cv);
  return { tex, u: [barsU0, barsU1, lockU0] };
}

export default function PanelSelMarco({ ancho, alto }: { ancho: number; alto: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef  = useRef<THREE.ShaderMaterial>(null);
  const rotulo = useMemo(() => crearRotulo(), []);

  const uniforms = useMemo(() => ({
    uLabel:    { value: rotulo?.tex ?? null },
    uLabelU:   { value: new THREE.Vector3(...(rotulo?.u ?? [0.2, 0.5, 0.6])) },
    uSize:     { value: new THREE.Vector2(1, 1) },   // tamaño total del plano (m, sin escala)
    uHalf:     { value: new THREE.Vector2(1, 1) },   // semitamaño del rectángulo de las esquinas
    uLabelBox: { value: new THREE.Vector4(0, 0, 1, 1) }, // x0, y0, w, h del rótulo (m)
    uTh:       { value: BRACKET_TH_M },
    uLen:      { value: BRACKET_LEN_M },
    uProgress: { value: 0 },
    uAlpha:    { value: 0 },
  }), [rotulo]);

  useEffect(() => () => { rotulo?.tex.dispose(); }, [rotulo]);

  const _pos = useMemo(() => new THREE.Vector3(), []);
  const _quat = useMemo(() => new THREE.Quaternion(), []);
  const _nrm = useMemo(() => new THREE.Vector3(), []);
  const _scl = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const mesh = meshRef.current;
    const mat  = matRef.current;
    if (!mesh || !mat) return;
    const u = mat.uniforms;
    const s = LINTERNA_STATE;
    const target = s.marco?.mesh;
    if (!target || s.selAlpha < 0.01) { mesh.visible = false; return; }
    mesh.visible = true;
    // Z17: con el domo cercano el marco va en la capa de interfaz (pase propio, depthTest normal)
    const enCapa = ACERC.layout.domo === true && ACERC.fase !== "orbita" && DBG_SUBPANELES.DOMO_CAPA_UI && RETRO_FLAGS.enabled;
    mesh.layers.set(enCapa ? CAPA_UI : 0);
    mat.depthTest = !(ACERC.layout.domo && ACERC.fase !== "orbita" && DBG_SUBPANELES.DOMO_CAPA_DEPTHTEST_VIEJO);
    // Z17: aislar (debug) — el marco solo con "todo" o "sin_orbita"
    if (DBG_AISLAR_UI.MODO !== "todo" && DBG_AISLAR_UI.MODO !== "sin_orbita") { mesh.visible = false; return; }

    // tamaño en metros (MARCO_PAD_M en vivo)
    const pad = Math.max(0, DBG_LINTERNA.MARCO_PAD_M);
    const hx = ancho / 2 + pad, hy = alto / 2 + pad;
    const top = hy + LABEL_GAP_M + LABEL_H_M;
    const W = 2 * hx, H = 2 * top;  // simétrico → el centro coincide con el del panel
    u.uSize.value.set(W, H);
    u.uHalf.value.set(hx, hy);
    u.uLabelBox.value.set(-hx, hy + LABEL_GAP_M, LABEL_W_M, LABEL_H_M);
    u.uProgress.value = s.sel === s.marco ? s.progreso : 0;
    u.uAlpha.value = s.selAlpha;

    // pose del panel seleccionado (mundo) + escala de su fade
    target.getWorldPosition(_pos);
    target.getWorldQuaternion(_quat);
    target.getWorldScale(_scl);
    _nrm.set(0, 0, 1).applyQuaternion(_quat);
    mesh.position.copy(_pos).addScaledVector(_nrm, OFFSET_M);
    mesh.quaternion.copy(_quat);
    mesh.scale.set(W * _scl.x, H * _scl.y, 1);
  });

  return (
    <mesh ref={meshRef} visible={false} renderOrder={DBG_PRIORIDAD.RENDER_ORDER_BLOQUE + 8} frustumCulled={false}> {/* Z10 (era 10) */}
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        vertexShader={/* glsl */`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={/* glsl */`
          uniform sampler2D uLabel;
          uniform vec3  uLabelU;
          uniform vec2  uSize, uHalf;
          uniform vec4  uLabelBox;
          uniform float uTh, uLen, uProgress, uAlpha;
          varying vec2  vUv;
          void main() {
            vec3 amber = vec3(1.0, 0.604, 0.122); // #FF9A1F
            vec2 q = (vUv - 0.5) * uSize;          // metros, centro del panel = 0
            vec2 a = abs(q);
            // esquinas en L (borde exterior en uHalf)
            float vert = step(uHalf.x - uTh, a.x) * step(a.x, uHalf.x) * step(uHalf.y - uLen, a.y) * step(a.y, uHalf.y);
            float hor  = step(uHalf.y - uTh, a.y) * step(a.y, uHalf.y) * step(uHalf.x - uLen, a.x) * step(a.x, uHalf.x);
            float m = max(vert, hor);
            // rótulo SEL ▮▮▮▮ LOCK arriba a la izquierda
            vec2 l = (q - uLabelBox.xy) / uLabelBox.zw;
            if (l.x >= 0.0 && l.x <= 1.0 && l.y >= 0.0 && l.y <= 1.0) {
              float t = texture2D(uLabel, l).r;
              if (l.x >= uLabelU.x && l.x <= uLabelU.y) {
                float k = floor((l.x - uLabelU.x) / (uLabelU.y - uLabelU.x) * 4.0);
                t *= (k < uProgress * 4.0 - 0.001) ? 1.0 : 0.28;   // barras: progreso a 'abierto'
              } else if (l.x >= uLabelU.z) {
                t *= uProgress >= 1.0 ? 1.0 : 0.4;                   // LOCK se enciende al abrir
              }
              m = max(m, t);
            }
            if (m < 0.01) discard;
            gl_FragColor = vec4(amber, m * uAlpha);
          }
        `}
      />
    </mesh>
  );
}
