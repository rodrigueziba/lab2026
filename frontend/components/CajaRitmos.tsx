"use client";
// Z80: caja de ritmos circular sobre un atril propio, en el slot DBG_RITMOS.SLOT de Z79 (detrás del atril de sonido).
// Sale del piso como los atriles (−1,6 m → 0 en 2 s, ease-out cúbica) cuando el usuario aprieta play en el atril de sonido
// (DBG_PLAY.APARECER_TRAS_PLAY) o siempre (DBG_RITMOS.MOSTRAR = "siempre").
// Z88: por defecto sale CON los atriles (APARECER_TRAS_PLAY = false; la animación arranca en el mismo instante que la de
// ellos, prop inicioRef) y va detrás de la tarima, sobre el eje sillas → tarima (DBG_RITMOS.UBICACION "detras_tarima",
// DIST_DETRAS_M del borde); "slot_atril" = ubicación de Z80.
// Interacción: el mismo mecanismo de los atriles (LecternSystem): tecla E cerca → modo "ritmos" (cámara fija sobre el
// disco, puntero suelto), clic por raycast contra window.__lecternMeshes. El disco es UNA malla de tipo "superficie":
// el punto de impacto se pasa al plano del disco y se convierte a anillo y paso en polares (lib/ritmos.ts), sin mallas
// por celda. Perillas BPM y SWING = controles "knob" (valor 1…10 del registro de parámetros de Z78); BORRAR y PLAY = botones.
// Dibujo: celdas y cubitos con InstancedMesh (una llamada de dibujo por tipo); la línea radial, la aguja y el salto de
// los cubitos salen del reloj de Z78 (posición que suena ahora). Sin allocations por frame: objetos preasignados; la
// barra de posición se redibuja solo cuando cambia el texto. Limpia todo al desmontar.

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { DBG_RITMOS, DBG_PLAY, DEBUG_ENABLED, DBG_RENDIMIENTO } from "@/lib/debugConfig";
import { INTERACT_STATE } from "@/lib/alightStore";
import { PLAY_TARIMA, alturaPedestal, cajaSaleConAtriles, type Slot } from "@/lib/playTarima";
import { slotsActuales } from "./PlayTarima";                                                  // Z88
import {
  ATRIL_RITMOS, puntoACelda, centroCelda, pistasValidas, posicionActual, textoPosicion, pasosDesde, escalaSalto,
  NOMBRE_VOZ, type Celda, type GeoDisco, type Posicion, type VozId,
} from "@/lib/ritmos";
import {
  PATRON, RITMOS, RELOJ, instalarRitmos, tocarCelda, borrarRitmos, alternarRitmos, playRitmos, pausaRitmos,
  setPerillaRitmos, valorPerilla, cargarEjemploHouse, setBpmRitmos, setSwingRitmos,
} from "@/lib/ritmosMotor";
import { contextoNucleo } from "@/lib/audio/nucleo";
import { createStripeBandTex } from "@/lib/retro/decals";
import { NOMBRE_EMPRESA_MAYUS } from "@/lib/marca";
import { sincronizarCtrlExterno } from "./LecternSystem";
import { RENDIMIENTO } from "./RendimientoHost";

// ── medidas (m) ──
const CAJA_W = 1.25, CAJA_D = 0.95, ALTO = 0.86, TAPA_T = 0.03;
const GEO: GeoDisco = { R0: 0.11, ANCHO: 0.05 };
const R_VIN = 0.095;
const DISCO_X = -0.15;
const MAX_PISTAS = 6, MAX_CELDAS = MAX_PISTAS * 32;
const APARICION_MS = 2000;
const COLOR_VOZ: Record<VozId, string> = {
  kick: "#C9E265", clap: "#F2EBDD", hatC: "#F0742A", hatA: "#7FC4E8", shaker: "#F27FA5", perc: "#F4B62E",
};
// controles (coordenadas de la tapa: x derecha, z hacia el usuario)
const PERILLA_BPM = { x: 0.46, z: -0.2 }, PERILLA_SWING = { x: 0.46, z: 0.04 };
const BTN_BORRAR = { x: 0.38, z: 0.27 }, BTN_PLAY = { x: 0.54, z: 0.27 };

/** Estado de módulo (un solo atril de ritmos). */
const CR = {
  aparecio: false, t0: 0, prog: 0,
  slots: [] as Slot[], pos: { pasos: 0, compas: 0, paso: 0, frac: 0 } as Posicion, celda: { anillo: 0, paso: 0, r: 0, ang: 0 } as Celda,
  claveCeldas: -1, versionCubos: -1, nActivos: 0,
  actAnillo: new Int16Array(MAX_CELDAS), actPaso: new Int16Array(MAX_CELDAS),
  claveBarra: -1, ultBpm: -1, ultSwing: -1,
  disco: null as THREE.Object3D | null,
  barra: null as { cv: HTMLCanvasElement; tex: THREE.CanvasTexture } | null,
  ov: null as HTMLDivElement | null, ovTexto: "",
};
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _up = new THREE.Vector3(0, 1, 0);
const _dummy = new THREE.Object3D(), _xz = { x: 0, z: 0 }, _col = new THREE.Color();
const _rc = new THREE.Raycaster(), _ndc = new THREE.Vector2(), _hits: THREE.Intersection[] = [];

// ── definiciones de control para el InteractionHandler de LecternSystem ──
const DEF_DISCO = {
  id: "r_disco", type: "superficie" as const, label: "DISCO", px: 0, py: 0, min: 0, max: 1, initial: 0, onActivate: () => {},
  onPunto: (p: THREE.Vector3) => {
    if (!CR.disco) return;
    CR.disco.worldToLocal(p);
    const c = puntoACelda(p.x, p.z, GEO, pistasValidas(DBG_RITMOS.PISTAS).length, RITMOS.pasos, CR.celda);
    if (c) tocarCelda(c.anillo, c.paso);
  },
};
const DEF_BPM = { id: "r_bpm", type: "knob" as const, label: "BPM", px: 0, py: 0, min: 1, max: 10, initial: 5.5, onActivate: (v: number) => setPerillaRitmos("ritmos.bpm", v) };
const DEF_SWING = { id: "r_swing", type: "knob" as const, label: "SWING", px: 0, py: 0, min: 1, max: 10, initial: 1, onActivate: (v: number) => setPerillaRitmos("ritmos.swing", v) };
const DEF_BORRAR = { id: "r_borrar", type: "button" as const, label: "BORRAR", px: 0, py: 0, min: 0, max: 1, initial: 0, onActivate: (v: number) => { if (v > 0.5) borrarRitmos(); } };
const DEF_PLAY = { id: "r_play", type: "button" as const, label: "PLAY", px: 0, py: 0, min: 0, max: 1, initial: 0, onActivate: (v: number) => { if (v > 0.5) alternarRitmos(); } };

function canvasTex(w: number, h: number, dibujar: (c: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  dibujar(cv.getContext("2d")!);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function dibujarBarra(c: CanvasRenderingContext2D, w: number, h: number, sonando: boolean, bpm: number, pos: string, swing: number): void {
  c.fillStyle = "#2A1400"; c.fillRect(0, 0, w, h);
  c.fillStyle = "rgba(255,154,31,0.07)";
  for (let y = 0; y < h; y += 4) c.fillRect(0, y, w, 1);
  c.strokeStyle = "rgba(255,154,31,0.5)"; c.lineWidth = 3; c.strokeRect(4, 4, w - 8, h - 8);
  c.fillStyle = "#FF9A1F";
  if (sonando) { c.fillRect(34, 36, 14, 56); c.fillRect(56, 36, 14, 56); }
  else { c.beginPath(); c.moveTo(36, 34); c.lineTo(76, 64); c.lineTo(36, 94); c.closePath(); c.fill(); }
  c.font = "bold 46px monospace"; c.textBaseline = "middle";
  c.fillText(`${bpm} BPM`, 110, 66);
  c.fillText("4/4", 420, 66);
  c.fillStyle = "#C9E265"; c.fillText(pos, 560, 66);
  c.fillStyle = "rgba(255,154,31,0.75)"; c.font = "28px monospace";
  c.fillText(`SW ${swing}%`, 800, 66);
}

export default function CajaRitmos({ atrilX, tarimaMedia, tarimaH, inicioRef }: {
  atrilX: number; tarimaMedia: number; tarimaH: number;
  inicioRef?: { readonly current: number };   // Z88: Date.now() de la aparición de los atriles (LecternSystem.appearStart)
}) {
  const raizRef = useRef<THREE.Group>(null);
  const discoRef = useRef<THREE.Group>(null);
  const discoHitRef = useRef<THREE.Mesh>(null);
  const radarRef = useRef<THREE.Group>(null);
  const cuerpoRef = useRef<THREE.Group>(null);
  const blancoRef = useRef<THREE.Object3D>(null);
  const agujaRef = useRef<THREE.Group>(null);
  const celdasRef = useRef<THREE.InstancedMesh>(null);
  const cubosRef = useRef<THREE.InstancedMesh>(null);
  const anillosRef = useRef<THREE.LineSegments>(null);
  const barraRef = useRef<THREE.Mesh>(null);
  const bpmRef = useRef<THREE.Group>(null);
  const swingRef = useRef<THREE.Group>(null);
  const bpmHitRef = useRef<THREE.Mesh>(null);
  const swingHitRef = useRef<THREE.Mesh>(null);
  const borrarRef = useRef<THREE.Mesh>(null);
  const playRef = useRef<THREE.Mesh>(null);
  const ledPlayRef = useRef<THREE.MeshStandardMaterial>(null);
  const spotRef = useRef<THREE.SpotLight>(null);
  const pedestalRef = useRef<THREE.Group>(null);   // Z81

  const res = useMemo(() => {
    const geoCelda = new THREE.BoxGeometry(1, 1, 1);
    const geoCubo = new THREE.BoxGeometry(1, 1, 1);
    const matCelda = new THREE.MeshStandardMaterial({ color: "#2B2B30", roughness: 0.9, metalness: 0 });
    const matCubo = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.65, metalness: 0, emissive: "#151515" });
    const matAnillo = new THREE.LineBasicMaterial({ color: "#FF9A1F", transparent: true, opacity: 0.22, depthWrite: false });
    const texFrente = canvasTex(1024, 256, c => {
      c.fillStyle = "#E8DCC4"; c.fillRect(0, 0, 1024, 256);
      const fr = ["#E5322B", "#F0742A", "#F4B62E", "#2E9E5B", "#1F7FB8"];
      for (let i = 0; i < 5; i++) { c.fillStyle = fr[i]; c.fillRect(0, 150 + i * 14, 1024, 12); }
      c.fillStyle = "#3A3B3C"; c.font = "bold 64px monospace"; c.textBaseline = "alphabetic";
      c.fillText("RITMOS CR-80", 40, 90);
      c.font = "26px monospace"; c.fillText(`${NOMBRE_EMPRESA_MAYUS} · SECUENCIADOR CIRCULAR · 16 PASOS · 6 VOCES`, 40, 132);
    });
    const texPanel = canvasTex(512, 1024, c => {
      c.fillStyle = "#1A1816"; c.fillRect(0, 0, 512, 1024);
      c.strokeStyle = "rgba(241,239,230,0.55)"; c.lineWidth = 3; c.strokeRect(8, 8, 496, 1008);
      c.fillStyle = "rgba(241,239,230,0.92)"; c.font = "bold 40px monospace"; c.textAlign = "center";
      // posiciones en el canvas: x = (x_tapa − 0.30) / 0.32 · 512 ; y = (z_tapa + 0.46) / 0.92 · 1024
      const X = (x: number) => ((x - 0.3) / 0.32) * 512, Y = (z: number) => ((z + 0.46) / 0.92) * 1024;
      c.fillText("TEMPO", X(PERILLA_BPM.x), Y(PERILLA_BPM.z - 0.085));
      c.fillText("SWING", X(PERILLA_SWING.x), Y(PERILLA_SWING.z - 0.085));
      c.font = "bold 30px monospace";
      c.fillText("BORRAR", X(BTN_BORRAR.x), Y(BTN_BORRAR.z + 0.07));
      c.fillText("PLAY", X(BTN_PLAY.x), Y(BTN_PLAY.z + 0.07));
      c.font = "22px monospace"; c.fillStyle = "rgba(241,239,230,0.6)";
      c.fillText("60 ··· 180", X(PERILLA_BPM.x), Y(PERILLA_BPM.z + 0.08));
      c.fillText("0 ··· 60 %", X(PERILLA_SWING.x), Y(PERILLA_SWING.z + 0.08));
      const fr = ["#E5322B", "#F0742A", "#F4B62E", "#2E9E5B", "#1F7FB8"];
      for (let i = 0; i < 5; i++) { c.fillStyle = fr[i]; c.fillRect(30, 40 + i * 10, 452, 7); }
    });
    const texFranja = createStripeBandTex();
    const cvBarra = document.createElement("canvas");
    cvBarra.width = 1024; cvBarra.height = 128;
    const texBarra = new THREE.CanvasTexture(cvBarra);
    texBarra.colorSpace = THREE.SRGBColorSpace;
    return { geoCelda, geoCubo, matCelda, matCubo, matAnillo, texFrente, texPanel, texFranja, cvBarra, texBarra };
  }, []);

  useEffect(() => {
    instalarRitmos();
    if (spotRef.current && blancoRef.current) spotRef.current.target = blancoRef.current;
    const lineas = anillosRef.current;
    CR.disco = discoRef.current;
    CR.barra = { cv: res.cvBarra, tex: res.texBarra };
    CR.claveCeldas = -1; CR.versionCubos = -1; CR.claveBarra = -1; CR.ultBpm = -1; CR.ultSwing = -1;
    const w = window as unknown as { __lecternMeshes?: THREE.Mesh[]; __cajaRitmos?: object };
    if (!w.__lecternMeshes) w.__lecternMeshes = [];
    const pares: [THREE.Mesh | null, object][] = [
      [discoHitRef.current, DEF_DISCO], [bpmHitRef.current, DEF_BPM], [swingHitRef.current, DEF_SWING],
      [borrarRef.current, DEF_BORRAR], [playRef.current, DEF_PLAY],
    ];
    const registradas: THREE.Mesh[] = [];
    for (const [m, def] of pares) {
      if (!m) continue;
      const d = def as { id: string; type: string };
      m.userData.controlId = d.id; m.userData.controlType = d.type; m.userData.controlDef = def;
      w.__lecternMeshes.push(m); registradas.push(m);
    }
    if (DEBUG_ENABLED) w.__cajaRitmos = { RITMOS, PATRON, CR, ATRIL_RITMOS, DBG_RITMOS, RENDIMIENTO, DBG_RENDIMIENTO, playRitmos, pausaRitmos, cargarEjemploHouse, tocarCelda, borrarRitmos, setBpmRitmos, setSwingRitmos, RELOJ };
    return () => {
      const arr = w.__lecternMeshes;
      if (arr) for (const m of registradas) { const i = arr.indexOf(m); if (i >= 0) arr.splice(i, 1); }
      if (DEBUG_ENABLED) delete w.__cajaRitmos;
      ATRIL_RITMOS.visible = false;
      CR.aparecio = false; CR.disco = null; CR.barra = null;
      CR.ov?.remove(); CR.ov = null;
      res.geoCelda.dispose(); res.geoCubo.dispose(); res.matCelda.dispose(); res.matCubo.dispose(); res.matAnillo.dispose();
      res.texFrente.dispose(); res.texPanel.dispose(); res.texFranja.dispose(); res.texBarra.dispose();
      lineas?.geometry.dispose();
    };
  }, [res]);

  useFrame(({ camera }) => {
    const raiz = raizRef.current;
    if (!raiz) return;
    // ── aparición ──
    const quiere = DBG_RITMOS.ACTIVO && (DBG_RITMOS.MOSTRAR === "siempre" || !DBG_PLAY.APARECER_TRAS_PLAY || PLAY_TARIMA.sonando);
    if (quiere && !CR.aparecio) {
      CR.aparecio = true;
      // Z88: si sale con los atriles, su animación arranca con la de ellos (no con el primer frame de este componente)
      // (si la de ellos ya terminó, p. ej. ACTIVO reactivado desde el menú, la caja hace su propia animación completa)
      const ahora = Date.now(), ini = inicioRef ? inicioRef.current : 0;
      const conAtriles = cajaSaleConAtriles(DBG_PLAY.APARECER_TRAS_PLAY, DBG_RITMOS.MOSTRAR) && ini > 0 && ahora - ini < APARICION_MS;
      CR.t0 = conAtriles ? Math.min(ahora, ini) : ahora;
      if (PLAY_TARIMA.sonando && DBG_RITMOS.SEGUIR_PLAY_ATRIL && !RITMOS.sonando) playRitmos(); }
    if (!DBG_RITMOS.ACTIVO) { CR.aparecio = false; if (RITMOS.sonando) pausaRitmos(); }
    ATRIL_RITMOS.visible = false;
    const s = slotsActuales(atrilX, tarimaMedia, tarimaH, CR.slots);   // Z88: detrás de la tarima (o slot_atril)
    const slot = s[Math.max(0, Math.min(s.length - 1, Math.floor(DBG_RITMOS.SLOT)))];
    const cuerpo = cuerpoRef.current;
    if (cuerpo) cuerpo.visible = CR.aparecio && !!slot;
    if (!CR.aparecio || !slot) { if (spotRef.current) spotRef.current.intensity = 0; return; }
    CR.prog = Math.min(1, (Date.now() - CR.t0) / APARICION_MS);
    const ease = 1 - Math.pow(1 - CR.prog, 3);
    // Z81: pedestal bajo el atril (sale del piso con él): el atril sube su altura para quedar como el de sonido
    const ped = alturaPedestal(DBG_PLAY, slot.y, tarimaH);
    const pg = pedestalRef.current;
    if (pg) { pg.visible = ped > 0.001; pg.scale.set(1, Math.max(0.001, ped), 1); }
    raiz.position.set(slot.x, slot.y + ped + THREE.MathUtils.lerp(-1.6 - ped, 0, ease), slot.z);
    raiz.rotation.set(0, slot.yaw, 0);
    if (spotRef.current) spotRef.current.intensity = Math.max(0, DBG_RITMOS.LUZ) * ease;   // luz tenue propia (la de los atriles satura de cerca)

    // ── pose de la cámara para la tecla E (frente del atril, mirando el disco desde arriba) ──
    const disco = discoRef.current;
    if (disco && CR.prog >= 1) {
      raiz.updateMatrixWorld();
      disco.getWorldPosition(_v);
      const fx = Math.sin(slot.yaw), fz = Math.cos(slot.yaw);
      _v2.set(_v.x + fx * 0.62, _v.y + 0.78, _v.z + fz * 0.62);
      _m.lookAt(_v2, _v, _up); _q.setFromRotationMatrix(_m);
      ATRIL_RITMOS.camPos[0] = _v2.x; ATRIL_RITMOS.camPos[1] = _v2.y; ATRIL_RITMOS.camPos[2] = _v2.z;
      ATRIL_RITMOS.camQuat[0] = _q.x; ATRIL_RITMOS.camQuat[1] = _q.y; ATRIL_RITMOS.camQuat[2] = _q.z; ATRIL_RITMOS.camQuat[3] = _q.w;
      ATRIL_RITMOS.x = slot.x; ATRIL_RITMOS.z = slot.z; ATRIL_RITMOS.visible = true;
    }

    const pistas = pistasValidas(DBG_RITMOS.PISTAS);
    const nP = Math.min(MAX_PISTAS, pistas.length), pasos = RITMOS.pasos;
    // ── celdas (solo al cambiar pasos o pistas) ──
    const celdas = celdasRef.current;
    const clave = nP * 100 + pasos;
    if (celdas && clave !== CR.claveCeldas) {
      CR.claveCeldas = clave;
      let k = 0;
      for (let a = 0; a < nP; a++) {
        const r = GEO.R0 + (a + 0.5) * GEO.ANCHO, arco = (2 * Math.PI * r) / pasos;
        const lado = Math.min(GEO.ANCHO, arco) * 0.78;
        for (let p = 0; p < pasos; p++) {
          centroCelda(a, p, GEO, pasos, _xz);
          _dummy.position.set(_xz.x, 0.002, _xz.z);
          _dummy.rotation.set(0, -(p / pasos) * Math.PI * 2, 0);
          _dummy.scale.set(lado, 0.004, lado);
          _dummy.updateMatrix(); celdas.setMatrixAt(k++, _dummy.matrix);
        }
      }
      celdas.count = k; celdas.instanceMatrix.needsUpdate = true;
      // guías de los anillos (se rehace solo acá)
      const lin = anillosRef.current;
      if (lin) {
        const SEG = 96, pos = new Float32Array((nP + 1) * SEG * 6);
        let j = 0;
        for (let a = 0; a <= nP; a++) {
          const r = GEO.R0 + a * GEO.ANCHO;
          for (let i = 0; i < SEG; i++) {
            const a0 = (i / SEG) * Math.PI * 2, a1 = ((i + 1) / SEG) * Math.PI * 2;
            pos.set([Math.sin(a0) * r, 0.003, -Math.cos(a0) * r, Math.sin(a1) * r, 0.003, -Math.cos(a1) * r], j); j += 6;
          }
        }
        lin.geometry.dispose();
        const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        lin.geometry = g;
      }
      CR.versionCubos = -1;
    }
    // ── lista de cubitos activos y sus colores (solo al cambiar el patrón) ──
    const cubos = cubosRef.current;
    if (cubos && RITMOS.version !== CR.versionCubos) {
      CR.versionCubos = RITMOS.version;
      let n = 0;
      for (let a = 0; a < nP; a++) {
        const fila = PATRON[pistas[a]];
        for (let p = 0; p < pasos; p++) if (fila[p]) {
          CR.actAnillo[n] = a; CR.actPaso[n] = p;
          _col.set(COLOR_VOZ[pistas[a]]); cubos.setColorAt(n, _col);
          n++;
        }
      }
      CR.nActivos = n; cubos.count = n;
      if (cubos.instanceColor) cubos.instanceColor.needsUpdate = true;
    }
    // ── posición que suena, línea radial, aguja y salto ──
    const ctx = contextoNucleo();
    const pos = posicionActual(RELOJ, ctx ? ctx.currentTime : 0, CR.pos);
    const ang = (pos.pasos / pasos) * Math.PI * 2;
    if (radarRef.current) { radarRef.current.rotation.y = -ang; radarRef.current.visible = RELOJ.estado !== "detenido"; }
    if (agujaRef.current) agujaRef.current.rotation.y = -ang;
    if (cubos) {
      const dur = 60 / Math.max(1, RELOJ.bpm) / Math.max(1, RELOJ.pasosPorPulso);
      const corriendo = RELOJ.estado === "corriendo" && RITMOS.sonando;
      for (let i = 0; i < CR.nActivos; i++) {
        const a = CR.actAnillo[i], p = CR.actPaso[i];
        const r = GEO.R0 + (a + 0.5) * GEO.ANCHO, arco = (2 * Math.PI * r) / pasos;
        const lado = Math.min(GEO.ANCHO, arco) * 0.6;
        const esc = corriendo ? escalaSalto(pasosDesde(pos.pasos, p, pasos) * dur, DBG_RITMOS.SALTO_AMP, DBG_RITMOS.SALTO_TAU_S) : 1;
        centroCelda(a, p, GEO, pasos, _xz);
        const h = lado * esc;
        _dummy.position.set(_xz.x, 0.004 + h / 2, _xz.z);
        _dummy.rotation.set(0, -(p / pasos) * Math.PI * 2, 0);
        _dummy.scale.set(lado * (0.85 + 0.15 * esc), h, lado * (0.85 + 0.15 * esc));
        _dummy.updateMatrix(); cubos.setMatrixAt(i, _dummy.matrix);
      }
      cubos.instanceMatrix.needsUpdate = CR.nActivos > 0;
    }
    // ── perillas y LED ──
    const vb = valorPerilla("ritmos.bpm"), vs = valorPerilla("ritmos.swing");
    if (bpmRef.current) bpmRef.current.rotation.y = Math.PI * 0.75 - ((vb - 1) / 9) * Math.PI * 1.5;
    if (swingRef.current) swingRef.current.rotation.y = Math.PI * 0.75 - ((vs - 1) / 9) * Math.PI * 1.5;
    if (vb !== CR.ultBpm) { CR.ultBpm = vb; DEF_BPM.initial = vb; sincronizarCtrlExterno(DEF_BPM.id, vb); }
    if (vs !== CR.ultSwing) { CR.ultSwing = vs; DEF_SWING.initial = vs; sincronizarCtrlExterno(DEF_SWING.id, vs); }
    if (ledPlayRef.current) ledPlayRef.current.emissiveIntensity = RITMOS.sonando ? 2.2 : 0.1;
    // ── barra de posición (redibujo solo al cambiar) ──
    const barra = barraRef.current;
    if (barra) {
      barra.visible = DBG_RITMOS.MOSTRAR_BARRA;
      const claveB = ((((pos.compas % 99) * 64 + pos.paso) * 2 + (RITMOS.sonando ? 1 : 0)) * 400 + DBG_RITMOS.BPM) * 100 + DBG_RITMOS.SWING;
      if (barra.visible && CR.barra && claveB !== CR.claveBarra) {
        CR.claveBarra = claveB;
        dibujarBarra(CR.barra.cv.getContext("2d")!, 1024, 128, RITMOS.sonando, DBG_RITMOS.BPM, textoPosicion(pos, pasos), DBG_RITMOS.SWING);
        CR.barra.tex.needsUpdate = true;
      }
    }
    // ── overlay de depuración: celda bajo el mouse ──
    const verOv = DBG_RITMOS.OVERLAY_CELDA && INTERACT_STATE.mode === "ritmos";
    if (verOv && !CR.ov && typeof document !== "undefined") {
      const d = document.createElement("div");
      d.setAttribute("data-debug-panel", "");
      d.style.cssText = "position:fixed;left:12px;bottom:40px;z-index:60;font:12px monospace;color:#FF9A1F;background:#2A1400cc;padding:4px 8px;pointer-events:none";
      document.body.appendChild(d); CR.ov = d; CR.ovTexto = "";
    } else if (!verOv && CR.ov) { CR.ov.remove(); CR.ov = null; }
    if (CR.ov && discoHitRef.current && disco) {
      _ndc.set(INTERACT_STATE.mouseNDC.x, INTERACT_STATE.mouseNDC.y);
      _rc.setFromCamera(_ndc, camera);
      _hits.length = 0;
      discoHitRef.current.raycast(_rc, _hits);
      let t = "fuera del disco";
      if (_hits.length) {
        _v.copy(_hits[0].point); disco.worldToLocal(_v);
        const c = puntoACelda(_v.x, _v.z, GEO, nP, pasos, CR.celda);
        if (c) t = `RITMOS · anillo ${c.anillo} (${NOMBRE_VOZ[pistas[c.anillo]]}) · paso ${c.paso + 1}/${pasos} · ${PATRON[pistas[c.anillo]][c.paso] ? "ocupada" : "libre"} · r ${c.r.toFixed(3)} m · ${(c.ang * 180 / Math.PI).toFixed(0)}°`;
      }
      if (t !== CR.ovTexto) { CR.ovTexto = t; CR.ov.textContent = t; }
    }
  });

  const rOut = GEO.R0 + MAX_PISTAS * GEO.ANCHO;
  return (
    <group ref={raizRef}>
      {/* luz tenue siempre montada (intensidad 0 hasta salir): sumar o quitar luces recompila los materiales */}
      <spotLight ref={spotRef} position={[0, 1.6, 0.55]} color="#ffe3b0" intensity={0}
        angle={0.5} penumbra={0.85} distance={2.6} castShadow={false} />
      <object3D ref={blancoRef} position={[0, ALTO, 0]} />
      <group ref={cuerpoRef} visible={false}>
      {/* Z81: pedestal (alto 1 escalado en y a la altura calculada; su techo coincide con el piso del atril) */}
      <group ref={pedestalRef} visible={false}>
        <mesh position={[0, -0.5, 0]}>
          <boxGeometry args={[CAJA_W + 0.1, 1, CAJA_D + 0.1]} />
          <meshStandardMaterial color="#3A3B3C" roughness={0.9} metalness={0.05} />
        </mesh>
        <mesh position={[0, -0.5, (CAJA_D + 0.1) / 2 + 0.001]} scale={[1, 0.28, 1]}>
          <planeGeometry args={[CAJA_W + 0.1, 1]} />
          <meshBasicMaterial map={res.texFranja} />
        </mesh>
        <mesh position={[0, -0.97, 0]}>
          <boxGeometry args={[CAJA_W + 0.14, 0.06, CAJA_D + 0.14]} />
          <meshStandardMaterial color="#C0552F" roughness={0.85} metalness={0} />
        </mesh>
      </group>
      {/* gabinete beige con frente de marca y franjas */}
      <mesh position={[0, ALTO / 2, 0]}>
        <boxGeometry args={[CAJA_W, ALTO, CAJA_D]} />
        <meshStandardMaterial color="#E8DCC4" roughness={0.88} metalness={0} />
      </mesh>
      <mesh position={[0, ALTO * 0.62, CAJA_D / 2 + 0.001]}>
        <planeGeometry args={[CAJA_W * 0.92, CAJA_W * 0.92 / 4]} />
        <meshBasicMaterial map={res.texFrente} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.06, CAJA_D / 2 + 0.001]}>
        <planeGeometry args={[CAJA_W, 0.05]} />
        <meshBasicMaterial map={res.texFranja} />
      </mesh>
      {/* tapa de carbón */}
      <group position={[0, ALTO, 0]}>
        <mesh position={[0, TAPA_T / 2, 0]}>
          <boxGeometry args={[CAJA_W + 0.02, TAPA_T, CAJA_D + 0.02]} />
          <meshStandardMaterial color="#3A3B3C" roughness={0.85} metalness={0.05} />
        </mesh>
        <group position={[0, TAPA_T, 0]}>
          {/* panel de controles (serigrafía) */}
          <mesh position={[0.46, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.32, 0.92]} />
            <meshBasicMaterial map={res.texPanel} toneMapped={false} />
          </mesh>
          {/* disco */}
          <group ref={discoRef} position={[DISCO_X, 0, 0]}>
            <mesh ref={discoHitRef} position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[rOut + 0.012, 96]} />
              <meshStandardMaterial color="#121014" roughness={0.95} metalness={0} />
            </mesh>
            <lineSegments ref={anillosRef} material={res.matAnillo} />
            <instancedMesh ref={celdasRef} args={[res.geoCelda, res.matCelda, MAX_CELDAS]} frustumCulled={false} />
            <instancedMesh ref={cubosRef} args={[res.geoCubo, res.matCubo, MAX_CELDAS]} frustumCulled={false} />
            {/* vinilo con etiqueta lima y aguja */}
            <mesh position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[R_VIN, 64]} />
              <meshStandardMaterial color="#0B0A0C" roughness={0.35} metalness={0.1} />
            </mesh>
            <mesh position={[0, 0.0075, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.042, 48]} />
              <meshStandardMaterial color="#C9E265" roughness={0.7} emissive="#C9E265" emissiveIntensity={0.25} />
            </mesh>
            <group ref={agujaRef} position={[0, 0.009, 0]}>
              <mesh position={[0, 0, -0.016]}>
                <boxGeometry args={[0.004, 0.002, 0.034]} />
                <meshBasicMaterial color="#12101A" />
              </mesh>
            </group>
            {/* línea radial (radar) */}
            <group ref={radarRef} position={[0, 0.012, 0]}>
              <mesh position={[0, 0, -(R_VIN + rOut) / 2]}>
                <boxGeometry args={[0.003, 0.002, rOut - R_VIN]} />
                <meshBasicMaterial color="#E4F58A" transparent opacity={0.85} toneMapped={false} />
              </mesh>
            </group>
          </group>
          {/* perillas (giran con el valor 1…10) */}
          {([[PERILLA_BPM, bpmRef, bpmHitRef], [PERILLA_SWING, swingRef, swingHitRef]] as const).map(([p, ref, hit], i) => (
            <group key={i} position={[p.x, 0, p.z]}>
              <mesh ref={hit} position={[0, 0.02, 0]}>
                <cylinderGeometry args={[0.042, 0.046, 0.04, 28]} />
                <meshStandardMaterial color="#3A3B3C" roughness={0.6} metalness={0.15} />
              </mesh>
              <group ref={ref} position={[0, 0.041, 0]}>
                <mesh position={[0, 0, -0.026]}>
                  <boxGeometry args={[0.006, 0.003, 0.03]} />
                  <meshStandardMaterial color="#F4B62E" emissive="#F4B62E" emissiveIntensity={0.4} />
                </mesh>
              </group>
            </group>
          ))}
          {/* botones BORRAR y PLAY */}
          <mesh ref={borrarRef} position={[BTN_BORRAR.x, 0.012, BTN_BORRAR.z]}>
            <boxGeometry args={[0.07, 0.024, 0.06]} />
            <meshStandardMaterial color="#E8DCC4" roughness={0.8} />
          </mesh>
          <mesh ref={playRef} position={[BTN_PLAY.x, 0.012, BTN_PLAY.z]}>
            <boxGeometry args={[0.07, 0.024, 0.06]} />
            <meshStandardMaterial color="#C0552F" roughness={0.75} />
          </mesh>
          <mesh position={[BTN_PLAY.x + 0.025, 0.026, BTN_PLAY.z - 0.02]}>
            <boxGeometry args={[0.008, 0.004, 0.008]} />
            <meshStandardMaterial ref={ledPlayRef} color="#3A1A00" emissive="#FF9A1F" emissiveIntensity={0.1} />
          </mesh>
          {/* barra de posición sobre el borde de atrás, mirando al usuario */}
          <mesh ref={barraRef} position={[DISCO_X, 0.09, -CAJA_D / 2 + 0.02]} rotation={[-0.35, 0, 0]}>
            <planeGeometry args={[0.6, 0.075]} />
            <meshBasicMaterial map={res.texBarra} toneMapped={false} />
          </mesh>
        </group>
      </group>
      </group>
    </group>
  );
}
