"use client";
// Z79: botón grande de PLAY del atril de sonido y marcadores de los slots de los atriles de instrumentos.
// PlayGrande: se monta dentro del grupo de controles del atril de sonido (coordenadas del panel: x = u, z = −v, y = 0 en
// la superficie), así que se inclina y sube del piso con el atril. Base beige con banda de franjas y una tecla óxido con
// pantalla ámbar (▶ PLAY / ❚❚ PAUSA) y LED. Se clickea con el mismo InteractionHandler de los atriles (modo atril, tecla
// E): su malla de impacto se registra en window.__lecternMeshes con una definición de botón; onActivate(1) alterna.
// SlotsAtriles: cajas translúcidas del tamaño de un atril, con una flecha hacia su frente (al centro de la tarima),
// visibles solo con DBG_PLAY.MOSTRAR_SLOTS. Sin allocations por frame; libera texturas, geometrías y materiales.

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { DBG_PLAY, DEBUG_ENABLED } from "@/lib/debugConfig";
import { PLAY_TARIMA, slotsInstrumentos, type Slot } from "@/lib/playTarima";
import { alternarPlay, playTarima, pausaTarima, estadoContextoTarima } from "@/lib/playTarimaAcciones";
import { createStripeBandTex } from "@/lib/retro/decals";
import { NOMBRE_EMPRESA_MAYUS } from "@/lib/marca";

// medidas con BOTON_ESCALA = 1 (m)
const BASE_W = 0.16, BASE_D = 0.045;
const TECLA_W = 0.13, TECLA_H = 0.014, TECLA_D = 0.032;
const HUNDIDO = 0.006, PRESION_MS = 220;

function etiquetaTex(sonando: boolean): THREE.CanvasTexture {
  const w = 512, h = 128, cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const c = cv.getContext("2d")!;
  c.fillStyle = "#2A1400"; c.fillRect(0, 0, w, h);
  c.fillStyle = "rgba(255,154,31,0.08)";
  for (let y = 0; y < h; y += 4) c.fillRect(0, y, w, 1);              // líneas de barrido
  c.fillStyle = "#FF9A1F";
  if (sonando) { c.fillRect(54, 30, 22, 62); c.fillRect(90, 30, 22, 62); }
  else { c.beginPath(); c.moveTo(58, 28); c.lineTo(118, 61); c.lineTo(58, 94); c.closePath(); c.fill(); }
  c.font = "bold 64px monospace"; c.textBaseline = "middle"; c.textAlign = "left";
  c.fillText(sonando ? "PAUSA" : "PLAY", 150, 58);
  c.font = "18px monospace"; c.fillStyle = "rgba(255,154,31,0.65)";
  c.fillText(`${NOMBRE_EMPRESA_MAYUS} · TRANSPORTE PT-79`, 150, 106);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const DEF_ID = "s_play_grande";
let _presionMs = -1e9;
/** Definición de botón que entiende el InteractionHandler de LecternSystem (setCtrl → onActivate(1), luego (0)).
 *  Objeto de módulo: hay un solo atril de sonido. */
const DEF_PLAY = {
  id: DEF_ID, type: "button" as const, label: "PLAY", px: 0, py: 0, min: 0, max: 1, initial: 0,
  onActivate: (v: number) => { if (v > 0.5) { _presionMs = performance.now(); alternarPlay(); } },
};
const EST = { sonando: false };

export function PlayGrande() {
  const grupoRef = useRef<THREE.Group>(null);
  const baseRef = useRef<THREE.Mesh>(null);
  const franjaRef = useRef<THREE.Mesh>(null);
  const teclaRef = useRef<THREE.Group>(null);
  const hitRef = useRef<THREE.Mesh>(null);
  const ledRef = useRef<THREE.MeshStandardMaterial>(null);
  const etiquetaRef = useRef<THREE.Mesh>(null);
  const r = useMemo(() => {
    const texPlay = etiquetaTex(false), texPausa = etiquetaTex(true), texFranja = createStripeBandTex();
    return {
      texPlay, texPausa, texFranja,
      matBase: new THREE.MeshStandardMaterial({ color: "#E8DCC4", roughness: 0.85, metalness: 0 }),
      matTecla: new THREE.MeshStandardMaterial({ color: "#C0552F", roughness: 0.75, metalness: 0 }),
      matEtiqueta: new THREE.MeshBasicMaterial({ map: texPlay, toneMapped: false }),
      matFranja: new THREE.MeshBasicMaterial({ map: texFranja }),
      matHit: new THREE.MeshBasicMaterial({ visible: false }),
    };
  }, []);

  useEffect(() => {
    EST.sonando = !PLAY_TARIMA.sonando;   // fuerza a sincronizar la etiqueta en el primer frame
    const hit = hitRef.current;
    const w = window as unknown as { __lecternMeshes?: THREE.Mesh[] };
    if (hit) {
      hit.userData.controlId = DEF_ID; hit.userData.controlType = "button"; hit.userData.controlDef = DEF_PLAY;
      if (!w.__lecternMeshes) w.__lecternMeshes = [];
      if (!w.__lecternMeshes.includes(hit)) w.__lecternMeshes.push(hit);
    }
    const wd = window as unknown as { __playTarima?: object };
    if (DEBUG_ENABLED) wd.__playTarima = { PLAY_TARIMA, alternarPlay, playTarima, pausaTarima, estadoContextoTarima, DBG_PLAY };   // diagnóstico (Chrome headless)
    return () => {
      if (DEBUG_ENABLED) delete wd.__playTarima;
      const arr = w.__lecternMeshes;
      if (arr && hit) { const i = arr.indexOf(hit); if (i >= 0) arr.splice(i, 1); }
      r.texPlay.dispose(); r.texPausa.dispose(); r.texFranja.dispose();
      r.matBase.dispose(); r.matTecla.dispose(); r.matEtiqueta.dispose(); r.matFranja.dispose(); r.matHit.dispose();
    };
  }, [r]);

  useFrame(() => {
    const g = grupoRef.current;
    if (!g) return;
    const esc = Math.max(0.2, DBG_PLAY.BOTON_ESCALA);
    const elev = Math.max(0.002, DBG_PLAY.BOTON_ELEV);
    g.position.set(DBG_PLAY.BOTON_U, 0, -DBG_PLAY.BOTON_V);
    g.scale.setScalar(esc);
    DEF_PLAY.px = DBG_PLAY.BOTON_U; DEF_PLAY.py = DBG_PLAY.BOTON_V;
    if (baseRef.current) { baseRef.current.scale.y = elev; baseRef.current.position.y = elev / 2; }
    if (franjaRef.current) { const fh = Math.min(elev * 0.7, 0.008); franjaRef.current.scale.y = fh; franjaRef.current.position.y = elev / 2; }
    if (hitRef.current) { hitRef.current.scale.y = elev + TECLA_H; hitRef.current.position.y = (elev + TECLA_H) / 2; }
    // tecla: hundido con rebote al apretar
    const ms = performance.now() - _presionMs;
    let hund = 0;
    if (ms < PRESION_MS) { const t = ms / PRESION_MS; hund = t < 0.2 ? HUNDIDO * t / 0.2 : HUNDIDO * Math.max(0, Math.exp(-6 * (t - 0.2)) * Math.cos(Math.PI * 2 * (t - 0.2))); }
    if (teclaRef.current) teclaRef.current.position.y = elev + TECLA_H / 2 - hund;
    // estado: etiqueta y LED (solo al cambiar)
    const s = PLAY_TARIMA.sonando;
    const et = etiquetaRef.current;
    if (et && (s !== EST.sonando || !(et.material as THREE.MeshBasicMaterial).map)) {
      EST.sonando = s;
      const m = et.material as THREE.MeshBasicMaterial;
      m.map = s ? et.userData.texPausa : et.userData.texPlay; m.needsUpdate = true;
    }
    if (ledRef.current) ledRef.current.emissiveIntensity = s ? 2.2 : 0.15;
  });

  return (
    <group ref={grupoRef}>
      {/* base beige (alto 1 escalado a BOTON_ELEV) */}
      <mesh ref={baseRef} material={r.matBase}>
        <boxGeometry args={[BASE_W, 1, BASE_D]} />
      </mesh>
      {/* banda de franjas en la cara hacia el usuario */}
      <mesh ref={franjaRef} position={[0, 0, BASE_D / 2 + 0.0005]} material={r.matFranja}>
        <planeGeometry args={[BASE_W * 0.96, 1]} />
      </mesh>
      {/* LED de estado */}
      <mesh position={[-BASE_W / 2 + 0.008, 0.004, BASE_D / 2 - 0.006]}>
        <boxGeometry args={[0.006, 0.004, 0.006]} />
        <meshStandardMaterial ref={ledRef} color="#3A1A00" emissive="#FF9A1F" emissiveIntensity={0.15} roughness={0.6} />
      </mesh>
      {/* tecla óxido con pantalla ámbar */}
      <group ref={teclaRef}>
        <mesh material={r.matTecla}>
          <boxGeometry args={[TECLA_W, TECLA_H, TECLA_D]} />
        </mesh>
        <mesh ref={etiquetaRef} position={[0, TECLA_H / 2 + 0.0006, 0]} rotation={[-Math.PI / 2, 0, 0]} material={r.matEtiqueta}
          userData={{ texPlay: r.texPlay, texPausa: r.texPausa }}>
          <planeGeometry args={[TECLA_W * 0.92, TECLA_D * 0.82]} />
        </mesh>
      </group>
      {/* malla de impacto (invisible) */}
      <mesh ref={hitRef} material={r.matHit}>
        <boxGeometry args={[BASE_W, 1, BASE_D]} />
      </mesh>
    </group>
  );
}

const MAX_SLOTS = 12;

/** Marcadores de los slots (espacio de LecternSystem). anchoM/profM = huella de un atril. */
export function SlotsAtriles({ atrilX, tarimaMedia, tarimaH, anchoM, profM }: {
  atrilX: number; tarimaMedia: number; tarimaH: number; anchoM: number; profM: number;
}) {
  const grupoRef = useRef<THREE.Group>(null);
  const slotsRef = useRef<THREE.Group[]>([]);
  const r = useMemo(() => ({
    slots: [] as Slot[],
    geoCaja: new THREE.BoxGeometry(anchoM, 1.0, profM),
    geoFlecha: new THREE.ConeGeometry(0.08, 0.25, 8),
    mat: new THREE.MeshBasicMaterial({ color: "#FF9A1F", transparent: true, opacity: 0.22, depthWrite: false }),
    matFuera: new THREE.MeshBasicMaterial({ color: "#C0552F", transparent: true, opacity: 0.22, depthWrite: false }),
    matFlecha: new THREE.MeshBasicMaterial({ color: "#FF9A1F" }),
  }), [anchoM, profM]);

  useEffect(() => () => { r.geoCaja.dispose(); r.geoFlecha.dispose(); r.mat.dispose(); r.matFuera.dispose(); r.matFlecha.dispose(); }, [r]);

  useFrame(() => {
    const g = grupoRef.current;
    if (!g) return;
    g.visible = DBG_PLAY.MOSTRAR_SLOTS;
    if (!g.visible) return;
    const s = slotsInstrumentos(DBG_PLAY, atrilX, tarimaMedia, tarimaH, r.slots);
    for (let i = 0; i < MAX_SLOTS; i++) {
      const o = slotsRef.current[i];
      if (!o) continue;
      const sl = s[i];
      o.visible = !!sl;
      if (!sl) continue;
      o.position.set(sl.x, sl.y, sl.z);
      o.rotation.set(0, sl.yaw, 0);
      const caja = o.children[0] as THREE.Mesh;
      caja.material = sl.sobreTarima ? r.mat : r.matFuera;
    }
  });

  return (
    <group ref={grupoRef} visible={false}>
      {Array.from({ length: MAX_SLOTS }, (_, i) => (
        <group key={i} ref={el => { if (el) slotsRef.current[i] = el; }} visible={false}>
          <mesh geometry={r.geoCaja} material={r.mat} position={[0, 0.5, 0]} renderOrder={11} />
          {/* flecha hacia el frente del atril (local +Z) */}
          <mesh geometry={r.geoFlecha} material={r.matFlecha} position={[0, 1.15, profM / 2 + 0.1]} rotation={[Math.PI / 2, 0, 0]} />
        </group>
      ))}
    </group>
  );
}
