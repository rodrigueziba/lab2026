"use client";
// Z103: piezas del atril SAMPLER SM-40 (layout en lib/atrilSampler.ts, motor en lib/audio/sampler.ts):
//  - buildSilkscreenSampler: serigrafía (marcos, bandas de título, etiquetas, escalas, ayuda);
//  - DisplaySampler: display ámbar de dos líneas + FORMA DE ONDA del pad seleccionado con INICIO y FIN. Se redibuja solo
//    cuando algo cambia (pad, recorte, audio, estado), ≤ VU_HZ y con el atril en pantalla; la onda solo se recalcula
//    cuando cambian el pad o su audio;
//  - ContadorSampler: lectura ámbar del tiempo de grabación; MarcaSeleccion: barra ámbar sobre el pad elegido;
//  - VuSampler: el VU de SN-40 con la geometría y el analizador del sampler;
//  - TecladoSampler: F G H J / V B N M tocan los pads (solo en el modo atril del SM-40; sin autorepetición).
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { DBG_ATRIL_SAMPLER, DBG_SAMPLER } from "@/lib/debugConfig";
import { INTERACT_STATE } from "@/lib/alightStore";
import { SAMPLER, EST, analizadorSampler, datosPad, lineaEstadoSampler, padAbajo, padArriba } from "@/lib/audio/sampler";
import { N_PADS, PS, valorIdx, picosOnda, generarFabrica, crearTeclasPads, teclaPadAbajo, teclaPadArriba, TEXTO_REPOSO_SAMPLER } from "@/lib/sampler";
import {
  MODULOS_M, POSICIONES_M, FADER_M, VU_M, ONDA_M, DISPLAY_TEXTO_U1, moduloM, textosM, numerosPerillaM, numerosFaderM,
  altosDisplayM, contadorM, marcaSeleccion,
} from "@/lib/atrilSampler";
import { BANDA_TITULO, DISPLAY_PAD, DISPLAY_INTERLINEA, RADIO_MARCAS_IN, RADIO_MARCAS_OUT, HUELLA, ESCALA_FADER, escalaEfectiva, tocaActualizar } from "@/lib/atrilSonido";
import { FRANJAS_PLACA } from "@/lib/marca";
import { VuSonido } from "./AtrilSonidoNuevo";

export const DISPLAY_SAMPLER = { texto: "", hasta: 0, version: 0 };
export function mostrarEnDisplaySampler(texto: string): void {
  DISPLAY_SAMPLER.texto = "» " + texto;
  DISPLAY_SAMPLER.hasta = performance.now() + Math.max(0.2, DBG_ATRIL_SAMPLER.DISPLAY_VALOR_S) * 1000;
  DISPLAY_SAMPLER.version++;
}
export function escalaActualSampler(): number {
  const asp = typeof window === "undefined" ? 16 / 9 : window.innerWidth / Math.max(1, window.innerHeight);
  return escalaEfectiva(DBG_ATRIL_SAMPLER.ETIQUETA_ESCALA, DBG_ATRIL_SAMPLER.ETIQUETA_AUTO_ASPECTO, asp);
}
const CREMA = "rgba(241,239,230,";
const AMBAR = "#FF9A1F", AMBAR_TENUE = "rgba(255,154,31,0.30)", FONDO = "#2A1400", REJILLA = "rgba(255,154,31,0.12)", BARRIDO = "rgba(255,154,31,0.07)";

// ── serigrafía ──
export async function buildSilkscreenSampler(dims: { CW: number; CD: number }): Promise<THREE.CanvasTexture> {
  if (typeof document !== "undefined" && document.fonts) await document.fonts.ready;
  const W = 4096, H = 2048, cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const c = cv.getContext("2d")!;
  const { CW, CD } = dims;
  const X = (u: number) => ((u + CW / 2) / CW) * W, Y = (v: number) => ((CD / 2 - v) / CD) * H;
  const ppmX = W / CW, ppmY = H / CD;
  c.fillStyle = "#0d0d11"; c.fillRect(0, 0, W, H);
  for (const m of MODULOS_M) {
    if (m.fila === "display") continue;
    const x0 = X(m.rect.u0), x1 = X(m.rect.u1), y0 = Y(m.rect.v1), y1 = Y(m.rect.v0), banda = BANDA_TITULO * ppmY;
    c.fillStyle = "rgba(241,239,230,0.07)"; c.fillRect(x0, y0, x1 - x0, banda);
    c.strokeStyle = `${CREMA}0.6)`; c.lineWidth = 3; c.strokeRect(x0 + 1.5, y0 + 1.5, x1 - x0 - 3, y1 - y0 - 3);
    c.strokeStyle = `${CREMA}0.35)`; c.lineWidth = 2;
    c.beginPath(); c.moveTo(x0 + 6, y0 + banda); c.lineTo(x1 - 6, y0 + banda); c.stroke();
  }
  const d = moduloM("display").rect;
  for (let i = 0; i < 5; i++) { c.fillStyle = FRANJAS_PLACA[i]; c.fillRect(X(d.u0), Y(d.v0) + 8 + i * 6, X(d.u1) - X(d.u0), 4); }
  // marco del contador
  const ct = contadorM();
  c.strokeStyle = `${CREMA}0.35)`; c.lineWidth = 2; c.strokeRect(X(ct.u0) - 4, Y(ct.v1) - 4, (ct.u1 - ct.u0) * ppmX + 8, (ct.v1 - ct.v0) * ppmY + 8);
  for (const t of textosM(escalaActualSampler(), DBG_ATRIL_SAMPLER.ROTULOS_FILA)) {
    if (t.fila === "display") continue;
    c.font = `bold ${Math.round(t.alto * ppmY)}px monospace`;
    c.textBaseline = "middle"; c.textAlign = t.alinear === "izq" ? "left" : "center";
    c.fillStyle = t.id.startsWith("g_") || t.id === "c_grabar" ? "rgba(255,154,31,0.95)" : t.id.startsWith("t_") ? `${CREMA}0.97)` : t.id.startsWith("c_") ? `${CREMA}0.7)` : `${CREMA}0.88)`;
    c.fillText(t.texto, X(t.u), Y(t.v));
  }
  for (const p of POSICIONES_M) {
    if (p.tipo !== "knob") continue;
    for (let i = 0; i <= 10; i++) {
      const a = (i / 10) * Math.PI * 1.5 - Math.PI * 0.75, fin = i === 0 || i === 10, s = p.escala;
      c.strokeStyle = fin ? `${CREMA}0.85)` : `${CREMA}0.5)`; c.lineWidth = fin ? 3 : 2;
      c.beginPath(); c.moveTo(X(p.u + Math.sin(a) * RADIO_MARCAS_IN * s), Y(p.v + Math.cos(a) * RADIO_MARCAS_IN * s));
      c.lineTo(X(p.u + Math.sin(a) * (fin ? RADIO_MARCAS_OUT : RADIO_MARCAS_OUT - 0.002) * s), Y(p.v + Math.cos(a) * (fin ? RADIO_MARCAS_OUT : RADIO_MARCAS_OUT - 0.002) * s)); c.stroke();
    }
    for (const n of numerosPerillaM(p)) { c.font = `bold ${Math.round(n.alto * ppmY)}px monospace`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = `${CREMA}0.9)`; c.fillText(n.texto, X(n.u), Y(n.v)); }
  }
  for (const p of POSICIONES_M) {
    if (p.tipo !== "slider") continue;
    const xM = X(p.u - HUELLA.FADER_U - 0.004);
    for (let i = 0; i <= 10; i++) {
      const v = FADER_M.v - FADER_M.rail / 2 + (i / 10) * FADER_M.rail, mayor = i === 0 || i === 5 || i === 10;
      const largo = (mayor ? ESCALA_FADER.marcaLarga : ESCALA_FADER.marcaCorta) * ppmX;
      c.fillStyle = mayor ? `${CREMA}0.9)` : `${CREMA}0.55)`; c.fillRect(xM - largo, Y(v) - 2, largo, 4);
    }
    c.fillStyle = `${CREMA}0.9)`; c.textAlign = "center"; c.textBaseline = "middle";
    for (const n of numerosFaderM(p)) { c.font = `bold ${Math.round(n.alto * ppmY)}px monospace`; c.fillText(n.texto, X(n.u), Y(n.v)); }
  }
  c.strokeStyle = `${CREMA}0.35)`; c.lineWidth = 2;
  c.strokeRect(X(VU_M.u - VU_M.ancho / 2 - 0.004), Y(VU_M.v1 + 0.006), (VU_M.ancho + 0.008) * ppmX, (VU_M.v1 - VU_M.v0 + 0.012) * ppmY);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 16; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.needsUpdate = true;
  return tex;
}

// ── visibilidad ──
const _fr = new THREE.Frustum(), _m4 = new THREE.Matrix4(), _esf = new THREE.Sphere(new THREE.Vector3(), 0.9);
function enPantalla(obj: THREE.Object3D, cam: THREE.Camera): boolean {
  obj.getWorldPosition(_esf.center);
  _m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  _fr.setFromProjectionMatrix(_m4);
  return _fr.intersectsSphere(_esf);
}

// ── display ──
const N_COL = 160;
const _min = new Float32Array(N_COL), _max = new Float32Array(N_COL);
const _fabrica: (Float32Array | null)[] = new Array(N_PADS).fill(null);   // onda de fábrica para mostrar antes de que nazca el grafo
const _fuentes = { esc: -1, f1: "", f2: "", px1: 0, px2: 0 };
function fuentesDisplay(esc: number, ppm: number): typeof _fuentes {
  if (_fuentes.esc !== esc) {
    const [a1, a2] = altosDisplayM(esc);
    _fuentes.esc = esc; _fuentes.px1 = Math.round(a1 * ppm); _fuentes.px2 = Math.round(a2 * ppm);
    _fuentes.f1 = "bold " + _fuentes.px1 + "px monospace"; _fuentes.f2 = "bold " + _fuentes.px2 + "px monospace";
  }
  return _fuentes;
}
/** Recalcula los picos del pad (solo al cambiar de pad o de audio). */
function calcularOnda(pad: number): void {
  let x = datosPad(pad);
  if (!x) { if (!_fabrica[pad]) _fabrica[pad] = generarFabrica(pad, 12000); x = _fabrica[pad]!; }
  picosOnda(x, N_COL, _min, _max);
}
interface RecDisplay { d: { u0: number; u1: number; v0: number; v1: number }; w: number; h: number; cw: number; ch: number; cv: HTMLCanvasElement; tex: THREE.CanvasTexture }
function dibujarDisplaySampler(r: RecDisplay, l1: string, l2: string, esc: number, ini: number, fin: number): void {
  const c = r.cv.getContext("2d");
  if (!c) return;
  const ppm = r.cw / r.w, F = fuentesDisplay(esc, ppm);
  c.fillStyle = FONDO; c.fillRect(0, 0, r.cw, r.ch);
  c.fillStyle = BARRIDO; for (let y = 0; y < r.ch; y += 4) c.fillRect(0, y, r.cw, 1);
  c.fillStyle = AMBAR; c.textAlign = "left"; c.textBaseline = "middle";
  c.font = F.f1; c.fillText(l1, 0.012 * ppm, DISPLAY_PAD * ppm + F.px1 / 2, (DISPLAY_TEXTO_U1 - r.d.u0 - 0.02) * ppm);
  c.font = F.f2; c.fillText(l2, 0.012 * ppm, (DISPLAY_PAD * ppm) + F.px1 + DISPLAY_INTERLINEA * ppm + F.px2 / 2, (DISPLAY_TEXTO_U1 - r.d.u0 - 0.02) * ppm);
  // forma de onda del pad: lo que queda fuera del recorte, tenue; INICIO y FIN, líneas verticales
  const x0 = (ONDA_M.u0 - r.d.u0) * ppm, x1 = (ONDA_M.u1 - r.d.u0) * ppm, y0 = (r.d.v1 - ONDA_M.v1) * ppm, y1 = (r.d.v1 - ONDA_M.v0) * ppm;
  const ym = (y0 + y1) / 2, a = (y1 - y0) / 2 - 4, wcol = (x1 - x0) / N_COL;
  c.strokeStyle = REJILLA; c.lineWidth = 2; c.strokeRect(x0, y0, x1 - x0, y1 - y0);
  for (let k = 0; k < N_COL; k++) {
    const f = (k + 0.5) / N_COL;
    c.fillStyle = f >= ini && f <= fin ? AMBAR : AMBAR_TENUE;
    const ya = ym - _max[k] * a, yb = ym - _min[k] * a;
    c.fillRect(x0 + k * wcol, ya, Math.max(1, wcol - 1), Math.max(2, yb - ya));
  }
  c.fillStyle = AMBAR;
  c.fillRect(x0 + ini * (x1 - x0) - 2, y0, 4, y1 - y0);
  c.fillRect(x0 + fin * (x1 - x0) - 2, y0, 4, y1 - y0);
  r.tex.needsUpdate = true;
}

export function DisplaySampler() {
  const grupoRef = useRef<THREE.Group>(null);
  const r = useMemo(() => {
    const d = moduloM("display").rect, w = d.u1 - d.u0, h = d.v1 - d.v0;
    const cw = 2048, ch = Math.round((cw * h) / w);
    const cv = document.createElement("canvas"); cv.width = cw; cv.height = ch;
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
    const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
    const geo = new THREE.PlaneGeometry(w, h);
    const marcoGeo = new THREE.BoxGeometry(w + 0.012, 0.006, h + 0.012);
    const marcoMat = new THREE.MeshStandardMaterial({ color: "#E8DCC4", roughness: 0.85, metalness: 0 });
    return { d, w, h, cw, ch, cv, tex, mat, geo, marcoGeo, marcoMat };
  }, []);
  const ult = useRef({ ms: -1e9, ver: -1, va: -1, sel: -1, val: -2, esc: -1, est: "", ds: -1, son: -1, msj: -1, l1: "", ini: -1, fin: -1 });
  useEffect(() => () => { r.tex.dispose(); r.mat.dispose(); r.geo.dispose(); r.marcoGeo.dispose(); r.marcoMat.dispose(); }, [r]);

  useFrame(({ camera }) => {
    const g = grupoRef.current;
    if (!g) return;
    const ahora = performance.now(), u = ult.current;
    if (!tocaActualizar(ahora, u.ms, DBG_ATRIL_SAMPLER.VU_HZ)) return;
    u.ms = ahora;
    if (SAMPLER.mensajeVer !== u.msj) { u.msj = SAMPLER.mensajeVer; if (SAMPLER.mensaje) mostrarEnDisplaySampler(SAMPLER.mensaje); }
    if (!enPantalla(g, camera)) return;
    const sel = EST.sel, val = ahora < DISPLAY_SAMPLER.hasta ? DISPLAY_SAMPLER.version : -1, esc = escalaActualSampler();
    const ds = Math.floor(SAMPLER.grabS * 10), son = SAMPLER.sonando[sel], ini = valorIdx(EST, PS.inicio, sel), fin = valorIdx(EST, PS.fin, sel);
    if (u.ver === SAMPLER.version && u.va === SAMPLER.versionAudio && u.sel === sel && u.val === val && u.esc === esc && u.est === SAMPLER.estadoGrab && u.ds === ds && u.son === son && u.ini === ini && u.fin === fin) return;
    if (u.va !== SAMPLER.versionAudio || u.sel !== sel) calcularOnda(sel);
    const cambio = u.ver !== SAMPLER.version || u.sel !== sel || u.est !== SAMPLER.estadoGrab || u.ds !== ds || u.son !== son || u.va !== SAMPLER.versionAudio;
    u.ver = SAMPLER.version; u.va = SAMPLER.versionAudio; u.sel = sel; u.val = val; u.esc = esc; u.est = SAMPLER.estadoGrab; u.ds = ds; u.son = son; u.ini = ini; u.fin = fin;
    if (cambio || !u.l1) u.l1 = lineaEstadoSampler();
    dibujarDisplaySampler(r, u.l1, val >= 0 ? DISPLAY_SAMPLER.texto : TEXTO_REPOSO_SAMPLER, esc, ini, fin);
  });

  const cu = (r.d.u0 + r.d.u1) / 2, cvv = (r.d.v0 + r.d.v1) / 2;
  return (
    <group ref={grupoRef} position={[cu, 0, -cvv]}>
      <mesh position={[0, 0.0015, 0]} geometry={r.marcoGeo} material={r.marcoMat} />
      <mesh position={[0, 0.0050, 0]} rotation={[-Math.PI / 2, 0, 0]} geometry={r.geo} material={r.mat} />
    </group>
  );
}

// ── contador de grabación y marca del pad seleccionado ──
export function ContadorSampler() {
  const grupoRef = useRef<THREE.Group>(null);
  const r = useMemo(() => {
    const ct = contadorM(), w = ct.u1 - ct.u0, h = ct.v1 - ct.v0, cw = 512, ch = Math.round((cw * h) / w);
    const cv = document.createElement("canvas"); cv.width = cw; cv.height = ch;
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
    const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
    const geo = new THREE.PlaneGeometry(w, h);
    const marca = marcaSeleccion(0), marcaGeo = new THREE.BoxGeometry(marca.u1 - marca.u0, 0.003, marca.v1 - marca.v0);
    const marcaMat = new THREE.MeshBasicMaterial({ color: "#FF9A1F", toneMapped: false });
    return { ct, w, h, cw, ch, cv, tex, mat, geo, marcaGeo, marcaMat };
  }, []);
  const marcaRef = useRef<THREE.Mesh>(null);
  const ult = useRef({ ms: -1e9, ds: -2, est: "", sel: -1, max: -1 });
  useEffect(() => () => { r.tex.dispose(); r.mat.dispose(); r.geo.dispose(); r.marcaGeo.dispose(); r.marcaMat.dispose(); }, [r]);
  useFrame(({ camera }) => {
    const u = ult.current, ahora = performance.now();
    if (u.sel !== EST.sel && marcaRef.current) {   // la marca se mueve solo al cambiar de pad
      u.sel = EST.sel;
      const m = marcaSeleccion(EST.sel);
      marcaRef.current.position.set((m.u0 + m.u1) / 2, 0.003, -(m.v0 + m.v1) / 2);
    }
    if (!tocaActualizar(ahora, u.ms, DBG_ATRIL_SAMPLER.VU_HZ)) return;
    u.ms = ahora;
    if (!grupoRef.current || !enPantalla(grupoRef.current, camera)) return;
    const ds = Math.floor(SAMPLER.grabS * 10), max = DBG_SAMPLER.SAMPLER_MAX_S;
    if (ds === u.ds && SAMPLER.estadoGrab === u.est && max === u.max) return;
    u.ds = ds; u.est = SAMPLER.estadoGrab; u.max = max;
    dibujarContador(r, ds, max, SAMPLER.estadoGrab === "grabando");
  });
  const cu = (r.ct.u0 + r.ct.u1) / 2, cvv = (r.ct.v0 + r.ct.v1) / 2, m0 = marcaSeleccion(0);
  return (
    <group>
      <group ref={grupoRef} position={[cu, 0.004, -cvv]}><mesh rotation={[-Math.PI / 2, 0, 0]} geometry={r.geo} material={r.mat} /></group>
      <mesh ref={marcaRef} position={[(m0.u0 + m0.u1) / 2, 0.003, -(m0.v0 + m0.v1) / 2]} geometry={r.marcaGeo} material={r.marcaMat} />
    </group>
  );
}

/** Lectura del contador (solo cuando cambia la décima de segundo, el estado o el máximo). */
function dibujarContador(r: { cw: number; ch: number; cv: HTMLCanvasElement; tex: THREE.CanvasTexture }, ds: number, max: number, grabando: boolean): void {
  const c = r.cv.getContext("2d");
  if (!c) return;
  c.fillStyle = FONDO; c.fillRect(0, 0, r.cw, r.ch);
  c.fillStyle = BARRIDO; for (let y = 0; y < r.ch; y += 4) c.fillRect(0, y, r.cw, 1);
  c.fillStyle = grabando ? "#FF5A1F" : AMBAR; c.textBaseline = "middle"; c.textAlign = "left";
  c.font = "bold " + Math.round(r.ch * 0.62) + "px monospace";
  c.fillText((ds / 10).toFixed(1) + " S", r.cw * 0.05, r.ch * 0.52);
  c.textAlign = "right"; c.font = "bold " + Math.round(r.ch * 0.3) + "px monospace"; c.fillStyle = AMBAR_TENUE;
  c.fillText("MÁX " + max + " S", r.cw * 0.95, r.ch * 0.52);
  r.tex.needsUpdate = true;
}

// ── VU ──
const hzVu = () => DBG_ATRIL_SAMPLER.VU_HZ;
export function VuSampler() { return <VuSonido vu={VU_M} analizador={analizadorSampler} hz={hzVu} />; }

// ── teclas de la computadora ──
/** F G H J / V B N M tocan los 8 pads (solo en el modo atril del SM-40). Mantener sostiene en MIENTRAS; sin autorepetición. */
export function TecladoSampler() {
  useEffect(() => {
    const k = crearTeclasPads();
    let reinicios = SAMPLER.reinicios;
    const soltarTodo = () => { for (let p = 0; p < N_PADS; p++) if (k.abajo[p]) { k.abajo[p] = 0; padArriba(p); } };
    const down = (e: KeyboardEvent) => {
      if (INTERACT_STATE.mode !== "sampler" || e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (reinicios !== SAMPLER.reinicios) { reinicios = SAMPLER.reinicios; k.abajo.fill(0); }
      const p = teclaPadAbajo(k, e.code, e.repeat);
      if (p < 0) return;
      padAbajo(p);
    };
    const up = (e: KeyboardEvent) => { const p = teclaPadArriba(k, e.code); if (p >= 0) padArriba(p); };
    const onVis = () => { if (document.visibilityState !== "visible") soltarTodo(); };
    const onModo = (e: Event) => { if ((e as CustomEvent<{ mode?: string }>).detail?.mode !== "sampler") soltarTodo(); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", soltarTodo);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("alight:lectern-mode", onModo);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", soltarTodo);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("alight:lectern-mode", onModo);
      soltarTodo();
    };
  }, []);
  return null;
}
