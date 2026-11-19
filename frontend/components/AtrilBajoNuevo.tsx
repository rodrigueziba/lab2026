"use client";
// Z99: piezas del atril BAJO ÁCIDO BA-40 (layout en lib/atrilBajo.ts, motor en lib/audio/bajoAcido.ts):
//  - buildSilkscreenBajo: serigrafía (marcos, bandas de título, filas y números de la SECUENCIA, etiquetas, escalas);
//  - DisplayBajo: display ámbar de dos líneas + CURVA DEL FILTRO (respuesta calculada de CORTE, RESONANCIA y MOD. ENV.;
//    la tenue es el pico de la envolvente). Redibuja solo cuando algo cambia, ≤ VU_HZ, y solo con el atril en pantalla;
//  - el VU es VuSonido (SN-40) con la geometría y el analizador del bajo; las placas son las de SN-40 con otro texto.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { DBG_ATRIL_BAJO, DBG_BAJO } from "@/lib/debugConfig";
import { BAJO, PARAMS, analizadorBajo, bpmBajo } from "@/lib/audio/bajoAcido";
import { valorParam, qDeResonancia, curvaFiltro, aperturaNota, corteConEnvolvente, lineaBajo1 } from "@/lib/bajoAcido";
import {
  MODULOS_B, POSICIONES_B, FADER_B, VU_B, SEQ, CURVA_B, DISPLAY_TEXTO_U1, moduloB, textosB, numerosPerillaB, numerosFaderB,
  altosDisplayB, uPaso, anchoColumnaPaso, FILAS_SEQ,
} from "@/lib/atrilBajo";
import { BANDA_TITULO, DISPLAY_PAD, DISPLAY_INTERLINEA, RADIO_MARCAS_IN, RADIO_MARCAS_OUT, HUELLA, ESCALA_FADER, escalaEfectiva, tocaActualizar } from "@/lib/atrilSonido";
import { FRANJAS_PLACA } from "@/lib/marca";
import { VuSonido } from "./AtrilSonidoNuevo";

export const DISPLAY_BAJO = { texto: "", hasta: 0, version: 0 };
export function mostrarEnDisplayBajo(texto: string): void {
  DISPLAY_BAJO.texto = "» " + texto;
  DISPLAY_BAJO.hasta = performance.now() + Math.max(0.2, DBG_ATRIL_BAJO.DISPLAY_VALOR_S) * 1000;
  DISPLAY_BAJO.version++;
}
export function escalaActualBajo(): number {
  const asp = typeof window === "undefined" ? 16 / 9 : window.innerWidth / Math.max(1, window.innerHeight);
  return escalaEfectiva(DBG_ATRIL_BAJO.ETIQUETA_ESCALA, DBG_ATRIL_BAJO.ETIQUETA_AUTO_ASPECTO, asp);
}
const CREMA = "rgba(241,239,230,";

// ── serigrafía ──
export async function buildSilkscreenBajo(dims: { CW: number; CD: number }): Promise<THREE.CanvasTexture> {
  if (typeof document !== "undefined" && document.fonts) await document.fonts.ready;
  const W = 4096, H = 2048, cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const c = cv.getContext("2d")!;
  const { CW, CD } = dims;
  const X = (u: number) => ((u + CW / 2) / CW) * W, Y = (v: number) => ((CD / 2 - v) / CD) * H;
  const ppmX = W / CW, ppmY = H / CD;
  c.fillStyle = "#0d0d11"; c.fillRect(0, 0, W, H);
  for (const m of MODULOS_B) {
    if (m.fila === "display") continue;
    const x0 = X(m.rect.u0), x1 = X(m.rect.u1), y0 = Y(m.rect.v1), y1 = Y(m.rect.v0), banda = BANDA_TITULO * ppmY;
    c.fillStyle = "rgba(241,239,230,0.07)"; c.fillRect(x0, y0, x1 - x0, banda);
    c.strokeStyle = `${CREMA}0.6)`; c.lineWidth = 3; c.strokeRect(x0 + 1.5, y0 + 1.5, x1 - x0 - 3, y1 - y0 - 3);
    c.strokeStyle = `${CREMA}0.35)`; c.lineWidth = 2;
    c.beginPath(); c.moveTo(x0 + 6, y0 + banda); c.lineTo(x1 - 6, y0 + banda); c.stroke();
  }
  // SECUENCIA: grupos de 4 pasos (pulsos) con un fondo apenas más claro y líneas finas entre filas
  const sq = moduloB("secuencia").rect, wcol = anchoColumnaPaso();
  for (let g = 0; g < 4; g++) {
    if (g % 2 === 0) continue;
    c.fillStyle = "rgba(241,239,230,0.045)";
    c.fillRect(X(uPaso(g * 4) - wcol / 2), Y(sq.v1 - BANDA_TITULO - 0.002), wcol * 4 * ppmX, (sq.v1 - BANDA_TITULO - 0.002 - sq.v0 - 0.004) * ppmY);
  }
  c.strokeStyle = `${CREMA}0.18)`; c.lineWidth = 2;
  for (let i = 1; i < FILAS_SEQ.length; i++) {
    const v = (SEQ[FILAS_SEQ[i - 1][0]] + SEQ[FILAS_SEQ[i][0]]) / 2;
    c.beginPath(); c.moveTo(X(sq.u0 + 0.012), Y(v)); c.lineTo(X(sq.u1 - 0.012), Y(v)); c.stroke();
  }
  // franjas de la marca bajo el display
  const d = moduloB("display").rect;
  for (let i = 0; i < 5; i++) { c.fillStyle = FRANJAS_PLACA[i]; c.fillRect(X(d.u0), Y(d.v0) + 8 + i * 6, X(d.u1) - X(d.u0), 4); }
  // textos
  for (const t of textosB(escalaActualBajo(), DBG_ATRIL_BAJO.ROTULOS_FILA)) {
    if (t.fila === "display") continue;
    c.font = `bold ${Math.round(t.alto * ppmY)}px monospace`;
    c.textBaseline = "middle"; c.textAlign = t.alinear === "izq" ? "left" : "center";
    c.fillStyle = t.id.startsWith("g_") ? "rgba(255,154,31,0.95)" : t.id.startsWith("t_") ? `${CREMA}0.97)` : t.id.startsWith("n_") ? `${CREMA}0.6)` : `${CREMA}0.88)`;
    c.fillText(t.texto, X(t.u), Y(t.v));
  }
  // perillas de VOZ: escala de 270° y extremos
  for (const p of POSICIONES_B) {
    if (p.tipo !== "knob" || p.escala < 0.6) continue;
    for (let i = 0; i <= 10; i++) {
      const a = (i / 10) * Math.PI * 1.5 - Math.PI * 0.75, fin = i === 0 || i === 10, s = p.escala;
      c.strokeStyle = fin ? `${CREMA}0.85)` : `${CREMA}0.5)`; c.lineWidth = fin ? 3 : 2;
      c.beginPath(); c.moveTo(X(p.u + Math.sin(a) * RADIO_MARCAS_IN * s), Y(p.v + Math.cos(a) * RADIO_MARCAS_IN * s));
      c.lineTo(X(p.u + Math.sin(a) * (fin ? RADIO_MARCAS_OUT : RADIO_MARCAS_OUT - 0.002) * s), Y(p.v + Math.cos(a) * (fin ? RADIO_MARCAS_OUT : RADIO_MARCAS_OUT - 0.002) * s)); c.stroke();
    }
    for (const n of numerosPerillaB(p)) { c.font = `bold ${Math.round(n.alto * ppmY)}px monospace`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = `${CREMA}0.9)`; c.fillText(n.texto, X(n.u), Y(n.v)); }
  }
  // mini perillas NOTA: un punto en 0 y otro en 24
  for (const p of POSICIONES_B) {
    if (p.tipo !== "knob" || p.escala >= 0.6) continue;
    const r = 0.0215 * (p.escala / 0.45);
    c.fillStyle = `${CREMA}0.6)`;
    for (const a of [-Math.PI * 0.75, Math.PI * 0.75]) { c.beginPath(); c.arc(X(p.u + Math.sin(a) * r), Y(p.v + Math.cos(a) * r), 4, 0, Math.PI * 2); c.fill(); }
  }
  // fader VOLUMEN
  for (const p of POSICIONES_B) {
    if (p.tipo !== "slider") continue;
    const xM = X(p.u - HUELLA.FADER_U - 0.004);
    for (let i = 0; i <= 10; i++) {
      const v = FADER_B.v - FADER_B.rail / 2 + (i / 10) * FADER_B.rail, mayor = i === 0 || i === 5 || i === 10;
      const largo = (mayor ? ESCALA_FADER.marcaLarga : ESCALA_FADER.marcaCorta) * ppmX;
      c.fillStyle = mayor ? `${CREMA}0.9)` : `${CREMA}0.55)`; c.fillRect(xM - largo, Y(v) - 2, largo, 4);
    }
    c.fillStyle = `${CREMA}0.9)`; c.textAlign = "center"; c.textBaseline = "middle";
    for (const n of numerosFaderB(p)) { c.font = `bold ${Math.round(n.alto * ppmY)}px monospace`; c.fillText(n.texto, X(n.u), Y(n.v)); }
  }
  // marco del VU
  c.strokeStyle = `${CREMA}0.35)`; c.lineWidth = 2;
  c.strokeRect(X(VU_B.u - VU_B.ancho / 2 - 0.004), Y(VU_B.v1 + 0.006), (VU_B.ancho + 0.008) * ppmX, (VU_B.v1 - VU_B.v0 + 0.012) * ppmY);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 16; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.needsUpdate = true;
  return tex;
}

// ── visibilidad (objetos de módulo) ──
const _fr = new THREE.Frustum(), _m4 = new THREE.Matrix4(), _esf = new THREE.Sphere(new THREE.Vector3(), 0.9);
function enPantalla(obj: THREE.Object3D, cam: THREE.Camera): boolean {
  obj.getWorldPosition(_esf.center);
  _m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  _fr.setFromProjectionMatrix(_m4);
  return _fr.intersectsSphere(_esf);
}

// ── display ──
const N_CURVA = 96;
const _curva = new Float32Array(N_CURVA), _curvaPico = new Float32Array(N_CURVA);
const AMBAR = "#FF9A1F", AMBAR_TENUE = "rgba(255,154,31,0.35)", FONDO = "#2A1400", REJILLA = "rgba(255,154,31,0.12)", BARRIDO = "rgba(255,154,31,0.07)";
const _fuentes = { esc: -1, f1: "", f2: "", px1: 0, px2: 0 };
/** Las fuentes del display solo se rearman si cambia la escala (fuera del dibujo). */
function fuentesDisplay(esc: number, ppm: number): typeof _fuentes {
  if (_fuentes.esc !== esc) {
    const [a1, a2] = altosDisplayB(esc);
    _fuentes.esc = esc; _fuentes.px1 = Math.round(a1 * ppm); _fuentes.px2 = Math.round(a2 * ppm);
    _fuentes.f1 = "bold " + _fuentes.px1 + "px monospace"; _fuentes.f2 = "bold " + _fuentes.px2 + "px monospace";
  }
  return _fuentes;
}
interface RecDisplay { d: { u0: number; u1: number; v0: number; v1: number }; w: number; h: number; cw: number; ch: number; cv: HTMLCanvasElement; tex: THREE.CanvasTexture }
function dibujarDisplayBajo(r: RecDisplay, l1: string, l2: string, esc: number): void {
  const c = r.cv.getContext("2d");
  if (!c) return;
  const ppm = r.cw / r.w, F = fuentesDisplay(esc, ppm);
  c.fillStyle = FONDO; c.fillRect(0, 0, r.cw, r.ch);
  c.fillStyle = BARRIDO; for (let y = 0; y < r.ch; y += 4) c.fillRect(0, y, r.cw, 1);
  // texto (hasta DISPLAY_TEXTO_U1)
  c.fillStyle = AMBAR; c.textAlign = "left"; c.textBaseline = "middle";
  c.font = F.f1; c.fillText(l1, 0.012 * ppm, DISPLAY_PAD * ppm + F.px1 / 2, (DISPLAY_TEXTO_U1 - r.d.u0 - 0.02) * ppm);
  c.font = F.f2; c.fillText(l2, 0.012 * ppm, (DISPLAY_PAD * ppm) + F.px1 + DISPLAY_INTERLINEA * ppm + F.px2 / 2, (DISPLAY_TEXTO_U1 - r.d.u0 - 0.02) * ppm);
  // curva del filtro (eje de frecuencia logarítmico; 0 dB marcado)
  const x0 = (CURVA_B.u0 - r.d.u0) * ppm, x1 = (CURVA_B.u1 - r.d.u0) * ppm, y0 = (r.d.v1 - CURVA_B.v1) * ppm, y1 = (r.d.v1 - CURVA_B.v0) * ppm;
  c.strokeStyle = REJILLA; c.lineWidth = 2; c.strokeRect(x0, y0, x1 - x0, y1 - y0);
  const y0db = y1 - (48 / 72) * (y1 - y0);
  c.beginPath(); c.moveTo(x0, y0db); c.lineTo(x1, y0db); c.stroke();
  trazarCurva(c, _curvaPico, x0, x1, y0, y1, AMBAR_TENUE, 3);
  trazarCurva(c, _curva, x0, x1, y0, y1, AMBAR, 5);
  r.tex.needsUpdate = true;
}
function trazarCurva(c: CanvasRenderingContext2D, k: Float32Array, x0: number, x1: number, y0: number, y1: number, color: string, ancho: number): void {
  c.strokeStyle = color; c.lineWidth = ancho; c.beginPath();
  for (let i = 0; i < N_CURVA; i++) {
    const x = x0 + (i / (N_CURVA - 1)) * (x1 - x0), y = y1 - k[i] * (y1 - y0);
    if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
  }
  c.stroke();
}
/** Recalcula las dos curvas (reposo y pico de la envolvente) en arreglos de módulo. */
function calcularCurvas(): void {
  const fc = Math.max(DBG_BAJO.FILTRO_FRECUENCIA_MIN, Math.min(DBG_BAJO.FILTRO_FRECUENCIA_MAX, valorParam(PARAMS, "corte")));
  const q = qDeResonancia(valorParam(PARAMS, "resonancia"), DBG_BAJO.RES_MAX);
  curvaFiltro(fc, q, 30, 12000, _curva, N_CURVA);
  const pico = corteConEnvolvente(fc, aperturaNota(valorParam(PARAMS, "modEnv"), false, 0), DBG_BAJO.ENV_OCTAVAS, 24000);
  curvaFiltro(pico, q, 30, 12000, _curvaPico, N_CURVA);
}

export function DisplayBajo() {
  const grupoRef = useRef<THREE.Group>(null);
  const r = useMemo(() => {
    const d = moduloB("display").rect, w = d.u1 - d.u0, h = d.v1 - d.v0;
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
  const ult = useRef({ ms: -1e9, ver: -1, val: -2, esc: -1, son: -1, on: -1, bpm: -1, l1: "" });
  useEffect(() => () => { r.tex.dispose(); r.mat.dispose(); r.geo.dispose(); r.marcoGeo.dispose(); r.marcoMat.dispose(); }, [r]);

  useFrame(({ camera }) => {
    const g = grupoRef.current;
    if (!g) return;
    const ahora = performance.now(), u = ult.current;
    if (!tocaActualizar(ahora, u.ms, DBG_ATRIL_BAJO.VU_HZ)) return;
    u.ms = ahora;
    if (!enPantalla(g, camera)) return;
    const val = ahora < DISPLAY_BAJO.hasta ? DISPLAY_BAJO.version : -1, esc = escalaActualBajo();
    const son = BAJO.sonando ? 1 : 0, on = DBG_BAJO.ON ? 1 : 0, bpm = Math.round(bpmBajo());
    if (u.ver === BAJO.version && u.val === val && u.esc === esc && u.son === son && u.on === on && u.bpm === bpm) return;
    const cambioEstado = u.ver !== BAJO.version || u.son !== son || u.on !== on || u.bpm !== bpm;
    if (u.ver !== BAJO.version) calcularCurvas();
    u.ver = BAJO.version; u.val = val; u.esc = esc; u.son = son; u.on = on; u.bpm = bpm;
    if (cambioEstado || !u.l1) u.l1 = lineaBajo1(BAJO.patron, BAJO.editado, bpm, !on ? "silencio" : son ? "sonando" : "parado");
    dibujarDisplayBajo(r, u.l1, val >= 0 ? DISPLAY_BAJO.texto : TEXTO_REPOSO, esc);
  });

  const cu = (r.d.u0 + r.d.u1) / 2, cvv = (r.d.v0 + r.d.v1) / 2;
  return (
    <group ref={grupoRef} position={[cu, 0, -cvv]}>
      <mesh position={[0, 0.0015, 0]} geometry={r.marcoGeo} material={r.marcoMat} />
      <mesh position={[0, 0.0050, 0]} rotation={[-Math.PI / 2, 0, 0]} geometry={r.geo} material={r.mat} />
    </group>
  );
}
const TEXTO_REPOSO = "PLAY: EN LA CAJA DE RITMOS · Q SALE";

// ── VU del bajo: el de SN-40 con su geometría y su analizador (referencias estables) ──
const hzVu = () => DBG_ATRIL_BAJO.VU_HZ;
export function VuBajo() { return <VuSonido vu={VU_B} analizador={analizadorBajo} hz={hzVu} />; }
