"use client";
// Z99b: guía de debug del arco de instrumentos, en el piso: el semicírculo (radio del arco) y los 7 slots numerados
// (−3…+3; ocupados en ámbar, reservados en óxido, libres en carbón). Oculta por defecto (DBG_INSTRUMENTOS.GUIA).
// Sigue en vivo la disposición; solo reescribe los vértices cuando cambia algún parámetro (sin allocations por frame).
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { DBG_INSTRUMENTOS, DBG_ATRIL_BAJO, DBG_RITMOS, DBG_LAYOUT } from "@/lib/debugConfig";
import { ORDEN_SLOTS, INDICE_MAX, N_SLOTS_ARCO } from "@/lib/instrumentosDisposicion";
import { poseInstrumento, radioArco, enArco, indiceMaxArco, EJE_INSTRUMENTOS } from "@/lib/instrumentosPose";

const PUNTOS = 97;          // semicírculo
const Y = 0.03;             // apenas sobre el piso

function etiqueta(k: number): { texto: string; color: string } {
  const o = ORDEN_SLOTS[k];
  const n = k > 0 ? `+${k}` : k < 0 ? `−${-k}` : "0";
  const corto = o ? o.nombre.split(" (")[0] : "LIBRE";
  return { texto: `${n} · ${corto}`, color: o?.ocupado ? "#FF9A1F" : o ? "#C0552F" : "#8A8A8A" };
}
function texEtiqueta(texto: string, color: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 96;
  const g = c.getContext("2d");
  if (g) {
    g.fillStyle = "rgba(18,16,26,0.82)"; g.fillRect(0, 0, c.width, c.height);
    g.strokeStyle = color; g.lineWidth = 4; g.strokeRect(2, 2, c.width - 4, c.height - 4);
    g.fillStyle = color; g.font = "bold 44px monospace"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(texto, c.width / 2, c.height / 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// firma de los parámetros: solo se reescriben los vértices cuando cambia alguno (sin arreglos nuevos por frame)
const _firma = new Float64Array(12).fill(NaN);
let _n = 0, _cambio = false;
function firmar(v: number): void {
  if (_firma[_n] !== v) { _firma[_n] = v; _cambio = true; }
  _n++;
}

export default function GuiaArcoInstrumentos() {
  const grupoRef = useRef<THREE.Group>(null);
  const slotsRef = useRef<THREE.Group[]>([]);
  const arcoRef = useRef<THREE.Group>(null);
  const r = useMemo(() => {
    const geoArco = new THREE.BufferGeometry();
    geoArco.setAttribute("position", new THREE.BufferAttribute(new Float32Array(PUNTOS * 3), 3));
    const matArco = new THREE.LineBasicMaterial({ color: "#FF9A1F", transparent: true, opacity: 0.6, depthWrite: false });
    const arco = new THREE.Line(geoArco, matArco);
    arco.renderOrder = 12;
    const geoDisco = new THREE.CircleGeometry(0.35, 24).rotateX(-Math.PI / 2);
    const geoFlecha = new THREE.ConeGeometry(0.1, 0.3, 8).rotateX(Math.PI / 2);
    const etiquetas: { tex: THREE.CanvasTexture; matDisco: THREE.MeshBasicMaterial; matSprite: THREE.SpriteMaterial }[] = [];
    for (let k = -INDICE_MAX; k <= INDICE_MAX; k++) {
      const e = etiqueta(k);
      const tex = texEtiqueta(e.texto, e.color);
      etiquetas.push({
        tex,
        matDisco: new THREE.MeshBasicMaterial({ color: e.color, transparent: true, opacity: 0.35, depthWrite: false }),
        matSprite: new THREE.SpriteMaterial({ map: tex, depthWrite: false, depthTest: false }),
      });
    }
    return { geoArco, matArco, arco, geoDisco, geoFlecha, etiquetas };
  }, []);

  useEffect(() => () => {
    r.geoArco.dispose(); r.matArco.dispose(); r.geoDisco.dispose(); r.geoFlecha.dispose();
    for (const e of r.etiquetas) { e.tex.dispose(); e.matDisco.dispose(); e.matSprite.dispose(); }
    _firma.fill(NaN);
  }, [r]);

  const _p = useMemo(() => ({ x: 0, z: 0, yaw: 0 }), []);
  useFrame(() => {
    const g = grupoRef.current;
    if (!g) return;
    g.visible = DBG_INSTRUMENTOS.GUIA;
    if (!g.visible) return;
    const I = DBG_INSTRUMENTOS;
    const arco = enArco() ? 1 : 0;
    _n = 0; _cambio = false;
    firmar(arco); firmar(I.RADIO_M); firmar(I.SEPARACION_M); firmar(I.ARCO_MAX_GRADOS); firmar(I.INDICE_MAX); firmar(I.MIRAR_AL_CENTRO ? 1 : 0);
    firmar(DBG_RITMOS.DIST_DETRAS_M); firmar(DBG_ATRIL_BAJO.INDICE_ARCO); firmar(DBG_LAYOUT.SILLAS_OFFSET_M); firmar(DBG_LAYOUT.POSICIONES_NUEVAS ? 1 : 0);
    if (!_cambio) return;
    // semicírculo del lado opuesto a las sillas (−90°…+90° desde el eje)
    const R = radioArco(), e = EJE_INSTRUMENTOS;
    const pos = r.geoArco.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < PUNTOS; i++) {
      const phi = -Math.PI / 2 + (Math.PI * i) / (PUNTOS - 1);
      const c = Math.cos(phi), s = Math.sin(phi);
      pos.setXYZ(i, e.cx + (e.ux * c + e.uz * s) * R, Y, e.cz + (e.uz * c - e.ux * s) * R);
    }
    pos.needsUpdate = true;
    r.geoArco.computeBoundingSphere();
    if (arcoRef.current) arcoRef.current.visible = arco === 1;
    // solo los slots dentro del índice máximo vigente (con auto, ±2: más allá el arco pasaría el tope)
    const km = arco === 1 ? indiceMaxArco() : INDICE_MAX;
    for (let j = 0; j < N_SLOTS_ARCO; j++) {
      const o = slotsRef.current[j];
      if (!o) continue;
      const k = j - INDICE_MAX;
      if (k > km || -k > km) { o.visible = false; continue; }
      const ok = poseInstrumento(k, _p);
      o.visible = ok;
      if (!ok) continue;
      o.position.set(_p.x, Y, _p.z);
      o.rotation.set(0, _p.yaw, 0);
    }
  });

  return (
    <group ref={grupoRef} visible={false}>
      <group ref={arcoRef}><primitive object={r.arco} /></group>
      {r.etiquetas.map((e, j) => (
        <group key={j} ref={el => { if (el) slotsRef.current[j] = el; }}>
          <mesh geometry={r.geoDisco} material={e.matDisco} renderOrder={12} />
          {/* flecha hacia donde mira el instrumento (local +Z) */}
          <mesh geometry={r.geoFlecha} material={e.matDisco} position={[0, 0.05, 0.5]} renderOrder={12} />
          <sprite material={e.matSprite} position={[0, 1.9, 0]} scale={[1.2, 0.225, 1]} renderOrder={13} />
        </group>
      ))}
    </group>
  );
}
