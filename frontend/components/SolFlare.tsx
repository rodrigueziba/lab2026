"use client";
// Z51: destello de lente del sol del mundo (ghosts): círculos, puntos y hexágonos repartidos sobre la línea que va
// del sol al centro de la pantalla, cada uno con distancia, tamaño y color propios.
// Estilo adaptado de un shader de Shadertoy aportado por el usuario (autor y URL por confirmar; licencia por
// defecto de Shadertoy CC BY-NC-SA 3.0 mientras no se confirme otra; ver CREDITOS.md). De la referencia se toman
// el hash por índice rnd(w) = fract(sin(w)·1000), la distancia d = rnd(i·20)·3 − 0,3, la paleta
// 0,5 + 0,5·cos(vec3(0,44, 0,24, 0,2)·8 + d·4) y las posiciones (círculo en −m·d, punto en m·(d−1)/2, hexágono en
// −m·d − 0,18), con m = posición del sol en pantalla (unidades de alto de pantalla, centro en 0).
// NO es una pasada a pantalla completa: una sola malla con hasta 10 quads (un solo material), en coordenadas de
// pantalla; las constantes de cada elemento se calculan al crearla y por frame solo cambian 3 uniforms (posición
// del sol en pantalla, aspecto y alfa). Se dibuja al final de la escena (renderOrder alto, sin profundidad,
// aditivo), antes del bloom y del CRT. Visible solo con el sol en cuadro y sobre la altura mínima (montañas),
// con fundido por altura y por cercanía al borde del cuadro. Sin allocations por frame; se libera al desmontar.

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { DBG_SOL, DBG_DIA } from "@/lib/debugConfig";
import { DIA } from "@/lib/cicloDia";

const N_MAX = 10;
const rnd = (w: number): number => { const x = Math.sin(w) * 1000; return x - Math.floor(x); };   // hash de la referencia

const VERT = /* glsl */`
  attribute vec2 aEsquina;     // −1…1
  attribute vec4 aGhost;       // d, tamaño, tipo (0 círculo, 1 punto, 2 hexágono), índice
  attribute vec3 aColor;
  uniform vec2  uSol;          // sol en pantalla (unidades de alto, centro 0)
  uniform float uAspecto;
  uniform float uTam;
  varying vec2  vEsq;
  varying vec3  vColor;
  varying float vTipo;
  varying float vIdx;
  void main() {
    float d = aGhost.x, tipo = aGhost.z;
    vec2 c = tipo < 0.5 ? -uSol * d : (tipo < 1.5 ? uSol * (d - 1.0) * 0.5 : -uSol * d - vec2(0.18));
    vec2 pos = c + aEsquina * aGhost.y * uTam;
    gl_Position = vec4(pos.x * 2.0 / uAspecto, pos.y * 2.0, 0.0, 1.0);
    vEsq = aEsquina; vColor = aColor; vTipo = tipo; vIdx = aGhost.w;
  }
`;

const FRAG = /* glsl */`
  uniform float uAlfa;
  uniform float uPaleta;
  uniform vec3  uTinte;
  varying vec2  vEsq;
  varying vec3  vColor;
  varying float vTipo;
  varying float vIdx;
  void main() {
    float r = length(vEsq);
    float f;
    if (vTipo < 0.5) f = smoothstep(1.0, 0.72, r) * 0.45;                                  // círculo
    else if (vTipo < 1.5) f = clamp(0.06 / max(r, 0.04) - 0.06, 0.0, 1.0) * smoothstep(1.0, 0.6, r);   // punto
    else {                                                                                  // hexágono (regShape de la referencia)
      float a = atan(vEsq.x, vEsq.y) + 0.2, b = 6.28319 / 6.0;
      f = smoothstep(0.82, 0.76, cos(floor(0.5 + a / b) * b - a) * r) * 0.3;
    }
    // paleta del proyecto por índice: crema #F8EAD8, amarillo #FEBD17, naranja #F0742A, rojo #E5322B
    float k = mod(vIdx, 4.0);
    vec3 pro = k < 0.5 ? vec3(0.973, 0.918, 0.847) : (k < 1.5 ? vec3(0.996, 0.741, 0.090) : (k < 2.5 ? vec3(0.941, 0.455, 0.165) : vec3(0.898, 0.196, 0.169)));
    vec3 col = mix(vColor, pro, uPaleta) * uTinte;
    gl_FragColor = vec4(col * f * uAlfa, 1.0);
  }
`;

const UNIFORMS = {
  uSol: { value: new THREE.Vector2() },
  uAspecto: { value: 1 },
  uTam: { value: 1 },
  uAlfa: { value: 0 },
  uPaleta: { value: 0 },
  uTinte: { value: new THREE.Vector3(1, 1, 1) },
};

function crearGeometria(): THREE.BufferGeometry {
  const esq = new Float32Array(N_MAX * 4 * 2), gh = new Float32Array(N_MAX * 4 * 4), co = new Float32Array(N_MAX * 4 * 3);
  const pos = new Float32Array(N_MAX * 4 * 3), idx = new Uint16Array(N_MAX * 6);
  const ESQ = [-1, -1, 1, -1, 1, 1, -1, 1];
  for (let i = 0; i < N_MAX; i++) {
    const d = rnd(i * 20) * 3 + 0.2 - 0.5;                    // distancia (referencia)
    const tam = 0.035 + 0.09 * rnd(i * 100 + 7);              // tamaño (alto de pantalla)
    const tipo = i % 3;
    const c = [0.44, 0.24, 0.2].map(v => 0.5 + 0.5 * Math.cos(v * 8 + d * 4));   // paleta de la referencia
    for (let v = 0; v < 4; v++) {
      const k = i * 4 + v;
      esq[k * 2] = ESQ[v * 2]; esq[k * 2 + 1] = ESQ[v * 2 + 1];
      gh[k * 4] = d; gh[k * 4 + 1] = tam; gh[k * 4 + 2] = tipo; gh[k * 4 + 3] = i;
      co[k * 3] = c[0]; co[k * 3 + 1] = c[1]; co[k * 3 + 2] = c[2];
    }
    idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));   // no se usa (la posición sale de los atributos)
  g.setAttribute("aEsquina", new THREE.BufferAttribute(esq, 2));
  g.setAttribute("aGhost", new THREE.BufferAttribute(gh, 4));
  g.setAttribute("aColor", new THREE.BufferAttribute(co, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

export default function SolFlare() {
  const { camera } = useThree();
  const meshRef = useRef<THREE.Mesh>(null);
  const geoRef = useRef<THREE.BufferGeometry | null>(null);
  const _v = useRef(new THREE.Vector3());
  const _f = useRef(new THREE.Vector3());

  useEffect(() => {
    const g = crearGeometria();
    geoRef.current = g;
    if (meshRef.current) meshRef.current.geometry = g;
    return () => { geoRef.current = null; g.dispose(); };
  }, []);

  useFrame(() => {
    const mesh = meshRef.current, g = geoRef.current;
    if (!mesh || !g) return;
    if (mesh.geometry !== g) mesh.geometry = g;
    const on = DBG_SOL.FLARE && DBG_SOL.DISENO_NUEVO && DBG_DIA.NUEVO && DIA.escena;
    if (!on) { mesh.visible = false; return; }
    // sol en pantalla: un punto lejano en su dirección, proyectado (objetos reutilizados)
    const v = _v.current, f = _f.current;
    camera.getWorldDirection(f);
    const delante = f.x * DIA.solDir[0] + f.y * DIA.solDir[1] + f.z * DIA.solDir[2];
    v.set(DIA.solDir[0], DIA.solDir[1], DIA.solDir[2]).multiplyScalar(50).add(camera.position).project(camera);
    const borde = Math.max(Math.abs(v.x), Math.abs(v.y));
    const altMin = (DBG_SOL.FLARE_ALT_MIN_DEG * Math.PI) / 180;
    const fAlt = THREE.MathUtils.smoothstep(DIA.solAlt, altMin, altMin + (4 * Math.PI) / 180);
    const fBorde = 1 - THREE.MathUtils.smoothstep(borde, 0.85, 1.15);
    // con el sol cerca del centro de la pantalla los fantasmas se apilan sobre él (m ≈ 0): se desvanece
    const asp0 = (camera as THREE.PerspectiveCamera).aspect || 1;
    const dc = Math.hypot(v.x * asp0 * 0.5, v.y * 0.5);
    const fCentro = THREE.MathUtils.smoothstep(dc, Math.max(0, DBG_SOL.FLARE_CENTRO) * 0.25, Math.max(1e-3, DBG_SOL.FLARE_CENTRO));
    const alfa = delante > 0 ? Math.max(0, DBG_SOL.FLARE_INTENSIDAD) * fAlt * fBorde * fCentro : 0;
    mesh.visible = alfa > 0.001;
    if (!mesh.visible) return;
    const asp = (camera as THREE.PerspectiveCamera).aspect || 1;
    UNIFORMS.uSol.value.set(v.x * asp * 0.5, v.y * 0.5);
    UNIFORMS.uAspecto.value = asp;
    UNIFORMS.uTam.value = Math.max(0.1, DBG_SOL.FLARE_TAMANO);
    UNIFORMS.uAlfa.value = alfa;
    UNIFORMS.uPaleta.value = DBG_SOL.PALETA_PROYECTO;
    // tinte de la etapa (resplandor del cielo normalizado al canal más alto)
    const gl0 = DIA.glow[0], gl1 = DIA.glow[1], gl2 = DIA.glow[2], m = Math.max(gl0, gl1, gl2, 1e-3), k = DBG_SOL.TINTE_ETAPA;
    UNIFORMS.uTinte.value.set(1 + (gl0 / m - 1) * k, 1 + (gl1 / m - 1) * k, 1 + (gl2 / m - 1) * k);
    g.setDrawRange(0, Math.max(1, Math.min(N_MAX, Math.round(DBG_SOL.FLARE_CANTIDAD))) * 6);
  });

  return (
    <mesh ref={meshRef} visible={false} frustumCulled={false} renderOrder={1000}>
      <shaderMaterial
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={UNIFORMS}
        transparent
        depthTest={false}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}
