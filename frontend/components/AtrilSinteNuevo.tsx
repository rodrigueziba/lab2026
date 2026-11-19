"use client";
// Z101: piezas del atril SINTETIZADOR SY-40 (layout en lib/atrilSinte.ts, motor en lib/audio/sinte.ts):
//  - buildSilkscreenSinte: serigrafía (marcos, bandas de título, rótulos, etiquetas, escalas, ayuda del piano);
//  - DisplaySinte: display ámbar de dos líneas + FORMA DE ONDA de OSC1 + CURVA DEL FILTRO (CORTE y RESONANCIA; la tenue
//    es el pico de la envolvente). Redibuja solo cuando algo cambia, ≤ VU_HZ y con el atril en pantalla;
//  - VuSinte: el VU de SN-40 con la geometría y el analizador del sinte;
//  - TecladoSinte: el piano de la computadora (solo en el modo atril del SY-40; sin autorepetición) y Web MIDI opcional
//    (DBG_SINTE.SINTE_MIDI). Al desmontar se quitan los oyentes, se sueltan las teclas y se cierra MIDI.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { DBG_ATRIL_SINTE, DBG_SINTE } from "@/lib/debugConfig";
import { INTERACT_STATE } from "@/lib/alightStore";
import { RITMOS } from "@/lib/ritmosMotor";
import { SINTE, PARAMS_SY, analizadorSinte, bpmSinte, notaAbajo, notaArriba, soltarTodasSinte, notaDeSemitono } from "@/lib/audio/sinte";
import {
  P, valorIdx, qDeResonancia, curvaFiltro, corteEnvolvente, formaOnda, lineaSinte1, lineaSinte2Reposo, nombreNota,
  crearTecladoPc, teclaAbajo, teclaArriba, leerMidi, TECLAS_PIANO,
} from "@/lib/sinte";
import {
  MODULOS_Y, POSICIONES_Y, FADER_Y, VU_Y, ONDA_Y, CURVA_Y, DISPLAY_TEXTO_U1, MOV, VK2, COL_SELECTOR, moduloY, textosY,
  numerosPerillaY, numerosFaderY, altosDisplayY,
} from "@/lib/atrilSinte";
import { BANDA_TITULO, DISPLAY_PAD, DISPLAY_INTERLINEA, RADIO_MARCAS_IN, RADIO_MARCAS_OUT, HUELLA, ESCALA_FADER, escalaEfectiva, tocaActualizar } from "@/lib/atrilSonido";
import { FRANJAS_PLACA } from "@/lib/marca";
import { VuSonido } from "./AtrilSonidoNuevo";

export const DISPLAY_SINTE = { texto: "", hasta: 0, version: 0 };
export function mostrarEnDisplaySinte(texto: string): void {
  DISPLAY_SINTE.texto = "» " + texto;
  DISPLAY_SINTE.hasta = performance.now() + Math.max(0.2, DBG_ATRIL_SINTE.DISPLAY_VALOR_S) * 1000;
  DISPLAY_SINTE.version++;
}
export function escalaActualSinte(): number {
  const asp = typeof window === "undefined" ? 16 / 9 : window.innerWidth / Math.max(1, window.innerHeight);
  return escalaEfectiva(DBG_ATRIL_SINTE.ETIQUETA_ESCALA, DBG_ATRIL_SINTE.ETIQUETA_AUTO_ASPECTO, asp);
}
const CREMA = "rgba(241,239,230,";

// ── serigrafía ──
export async function buildSilkscreenSinte(dims: { CW: number; CD: number }): Promise<THREE.CanvasTexture> {
  if (typeof document !== "undefined" && document.fonts) await document.fonts.ready;
  const W = 4096, H = 2048, cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const c = cv.getContext("2d")!;
  const { CW, CD } = dims;
  const X = (u: number) => ((u + CW / 2) / CW) * W, Y = (v: number) => ((CD / 2 - v) / CD) * H;
  const ppmX = W / CW, ppmY = H / CD;
  c.fillStyle = "#0d0d11"; c.fillRect(0, 0, W, H);
  for (const m of MODULOS_Y) {
    if (m.fila === "display") continue;
    const x0 = X(m.rect.u0), x1 = X(m.rect.u1), y0 = Y(m.rect.v1), y1 = Y(m.rect.v0), banda = BANDA_TITULO * ppmY;
    c.fillStyle = "rgba(241,239,230,0.07)"; c.fillRect(x0, y0, x1 - x0, banda);
    c.strokeStyle = `${CREMA}0.6)`; c.lineWidth = 3; c.strokeRect(x0 + 1.5, y0 + 1.5, x1 - x0 - 3, y1 - y0 - 3);
    c.strokeStyle = `${CREMA}0.35)`; c.lineWidth = 2;
    c.beginPath(); c.moveTo(x0 + 6, y0 + banda); c.lineTo(x1 - 6, y0 + banda); c.stroke();
  }
  // MOVIMIENTO: líneas finas entre LFO | ECO | ARPEGIADOR; FILTRO: recuadro del selector de envolvente
  const mo = moduloY("movimiento").rect, gEco = mo.u0 + 0.012 + MOV.lfo + MOV.sep, gArp = gEco + MOV.eco + MOV.sep;
  c.strokeStyle = `${CREMA}0.22)`; c.lineWidth = 2;
  for (const u of [gEco - MOV.sep / 2, gArp - MOV.sep / 2]) { c.beginPath(); c.moveTo(X(u), Y(mo.v1 - BANDA_TITULO - 0.006)); c.lineTo(X(u), Y(mo.v0 + 0.008)); c.stroke(); }
  const fi = moduloY("filtro").rect, xs0 = fi.u1 - 0.012 - COL_SELECTOR;
  c.strokeRect(X(xs0 + 0.002), Y(VK2 + 0.048), (COL_SELECTOR - 0.004) * ppmX, 0.098 * ppmY);
  // franjas de la marca bajo el display
  const d = moduloY("display").rect;
  for (let i = 0; i < 5; i++) { c.fillStyle = FRANJAS_PLACA[i]; c.fillRect(X(d.u0), Y(d.v0) + 8 + i * 6, X(d.u1) - X(d.u0), 4); }
  // textos
  for (const t of textosY(escalaActualSinte(), DBG_ATRIL_SINTE.ROTULOS_FILA)) {
    if (t.fila === "display") continue;
    c.font = `bold ${Math.round(t.alto * ppmY)}px monospace`;
    c.textBaseline = "middle"; c.textAlign = t.alinear === "izq" ? "left" : "center";
    c.fillStyle = t.id.startsWith("g_") || t.id === "c_piano" ? "rgba(255,154,31,0.95)" : t.id.startsWith("t_") ? `${CREMA}0.97)` : t.id.startsWith("c_") || t.id.startsWith("r_") ? `${CREMA}0.7)` : `${CREMA}0.88)`;
    c.fillText(t.texto, X(t.u), Y(t.v));
  }
  // perillas: escala de 270° y extremos 0 / 10
  for (const p of POSICIONES_Y) {
    if (p.tipo !== "knob") continue;
    for (let i = 0; i <= 10; i++) {
      const a = (i / 10) * Math.PI * 1.5 - Math.PI * 0.75, fin = i === 0 || i === 10, s = p.escala;
      c.strokeStyle = fin ? `${CREMA}0.85)` : `${CREMA}0.5)`; c.lineWidth = fin ? 3 : 2;
      c.beginPath(); c.moveTo(X(p.u + Math.sin(a) * RADIO_MARCAS_IN * s), Y(p.v + Math.cos(a) * RADIO_MARCAS_IN * s));
      c.lineTo(X(p.u + Math.sin(a) * (fin ? RADIO_MARCAS_OUT : RADIO_MARCAS_OUT - 0.002) * s), Y(p.v + Math.cos(a) * (fin ? RADIO_MARCAS_OUT : RADIO_MARCAS_OUT - 0.002) * s)); c.stroke();
    }
    for (const n of numerosPerillaY(p)) { c.font = `bold ${Math.round(n.alto * ppmY)}px monospace`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = `${CREMA}0.9)`; c.fillText(n.texto, X(n.u), Y(n.v)); }
  }
  // fader VOLUMEN
  for (const p of POSICIONES_Y) {
    if (p.tipo !== "slider") continue;
    const xM = X(p.u - HUELLA.FADER_U - 0.004);
    for (let i = 0; i <= 10; i++) {
      const v = FADER_Y.v - FADER_Y.rail / 2 + (i / 10) * FADER_Y.rail, mayor = i === 0 || i === 5 || i === 10;
      const largo = (mayor ? ESCALA_FADER.marcaLarga : ESCALA_FADER.marcaCorta) * ppmX;
      c.fillStyle = mayor ? `${CREMA}0.9)` : `${CREMA}0.55)`; c.fillRect(xM - largo, Y(v) - 2, largo, 4);
    }
    c.fillStyle = `${CREMA}0.9)`; c.textAlign = "center"; c.textBaseline = "middle";
    for (const n of numerosFaderY(p)) { c.font = `bold ${Math.round(n.alto * ppmY)}px monospace`; c.fillText(n.texto, X(n.u), Y(n.v)); }
  }
  // marco del VU
  c.strokeStyle = `${CREMA}0.35)`; c.lineWidth = 2;
  c.strokeRect(X(VU_Y.u - VU_Y.ancho / 2 - 0.004), Y(VU_Y.v1 + 0.006), (VU_Y.ancho + 0.008) * ppmX, (VU_Y.v1 - VU_Y.v0 + 0.012) * ppmY);
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
const N_CURVA = 96, N_ONDA = 64;
const _curva = new Float32Array(N_CURVA), _curvaPico = new Float32Array(N_CURVA), _onda = new Float32Array(N_ONDA);
const AMBAR = "#FF9A1F", AMBAR_TENUE = "rgba(255,154,31,0.35)", FONDO = "#2A1400", REJILLA = "rgba(255,154,31,0.12)", BARRIDO = "rgba(255,154,31,0.07)";
const _fuentes = { esc: -1, f1: "", f2: "", px1: 0, px2: 0 };
/** Las fuentes del display solo se rearman si cambia la escala (fuera del dibujo). */
function fuentesDisplay(esc: number, ppm: number): typeof _fuentes {
  if (_fuentes.esc !== esc) {
    const [a1, a2] = altosDisplayY(esc);
    _fuentes.esc = esc; _fuentes.px1 = Math.round(a1 * ppm); _fuentes.px2 = Math.round(a2 * ppm);
    _fuentes.f1 = "bold " + _fuentes.px1 + "px monospace"; _fuentes.f2 = "bold " + _fuentes.px2 + "px monospace";
  }
  return _fuentes;
}
interface RecDisplay { d: { u0: number; u1: number; v0: number; v1: number }; w: number; h: number; cw: number; ch: number; cv: HTMLCanvasElement; tex: THREE.CanvasTexture }
function dibujarDisplaySinte(r: RecDisplay, l1: string, l2: string, esc: number): void {
  const c = r.cv.getContext("2d");
  if (!c) return;
  const ppm = r.cw / r.w, F = fuentesDisplay(esc, ppm);
  c.fillStyle = FONDO; c.fillRect(0, 0, r.cw, r.ch);
  c.fillStyle = BARRIDO; for (let y = 0; y < r.ch; y += 4) c.fillRect(0, y, r.cw, 1);
  c.fillStyle = AMBAR; c.textAlign = "left"; c.textBaseline = "middle";
  c.font = F.f1; c.fillText(l1, 0.012 * ppm, DISPLAY_PAD * ppm + F.px1 / 2, (DISPLAY_TEXTO_U1 - r.d.u0 - 0.02) * ppm);
  c.font = F.f2; c.fillText(l2, 0.012 * ppm, (DISPLAY_PAD * ppm) + F.px1 + DISPLAY_INTERLINEA * ppm + F.px2 / 2, (DISPLAY_TEXTO_U1 - r.d.u0 - 0.02) * ppm);
  // forma de onda de OSC1 (un ciclo) y curva del filtro (eje de frecuencia logarítmico; 0 dB marcado)
  const ox0 = (ONDA_Y.u0 - r.d.u0) * ppm, ox1 = (ONDA_Y.u1 - r.d.u0) * ppm, oy0 = (r.d.v1 - ONDA_Y.v1) * ppm, oy1 = (r.d.v1 - ONDA_Y.v0) * ppm;
  c.strokeStyle = REJILLA; c.lineWidth = 2; c.strokeRect(ox0, oy0, ox1 - ox0, oy1 - oy0);
  c.beginPath(); c.moveTo(ox0, (oy0 + oy1) / 2); c.lineTo(ox1, (oy0 + oy1) / 2); c.stroke();
  trazar(c, _onda, N_ONDA, ox0, ox1, oy0 + 6, oy1 - 6, true, AMBAR, 5);
  const x0 = (CURVA_Y.u0 - r.d.u0) * ppm, x1 = (CURVA_Y.u1 - r.d.u0) * ppm, y0 = (r.d.v1 - CURVA_Y.v1) * ppm, y1 = (r.d.v1 - CURVA_Y.v0) * ppm;
  c.strokeStyle = REJILLA; c.lineWidth = 2; c.strokeRect(x0, y0, x1 - x0, y1 - y0);
  const y0db = y1 - (36 / 60) * (y1 - y0);
  c.beginPath(); c.moveTo(x0, y0db); c.lineTo(x1, y0db); c.stroke();
  trazar(c, _curvaPico, N_CURVA, x0, x1, y0, y1, false, AMBAR_TENUE, 3);
  trazar(c, _curva, N_CURVA, x0, x1, y0, y1, false, AMBAR, 5);
  r.tex.needsUpdate = true;
}
/** Traza k (0…1, o −1…1 si bipolar) en el rectángulo. Sin allocations. */
function trazar(c: CanvasRenderingContext2D, k: Float32Array, n: number, x0: number, x1: number, y0: number, y1: number, bipolar: boolean, color: string, ancho: number): void {
  c.strokeStyle = color; c.lineWidth = ancho; c.beginPath();
  for (let i = 0; i < n; i++) {
    const x = x0 + (i / (n - 1)) * (x1 - x0), t = bipolar ? (k[i] + 1) / 2 : k[i], y = y1 - t * (y1 - y0);
    if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
  }
  c.stroke();
}
/** Recalcula la onda de OSC1 y las dos curvas del filtro (reposo y pico de la envolvente) en arreglos de módulo. */
function calcularCurvas(): void {
  formaOnda(valorIdx(PARAMS_SY, P.onda1), _onda, N_ONDA);
  const fc = Math.max(DBG_SINTE.CORTE_MIN, Math.min(DBG_SINTE.CORTE_MAX, valorIdx(PARAMS_SY, P.corte)));
  const q = qDeResonancia(valorIdx(PARAMS_SY, P.resonancia), DBG_SINTE.RES_MAX);
  curvaFiltro(fc, q, 30, 16000, _curva, N_CURVA);
  curvaFiltro(corteEnvolvente(fc, valorIdx(PARAMS_SY, P.modEnv), DBG_SINTE.ENV_OCTAVAS, 1, 20000), q, 30, 16000, _curvaPico, N_CURVA);
}

export function DisplaySinte() {
  const grupoRef = useRef<THREE.Group>(null);
  const r = useMemo(() => {
    const d = moduloY("display").rect, w = d.u1 - d.u0, h = d.v1 - d.v0;
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
  const ult = useRef({ ms: -1e9, ver: -1, vc: -1, val: -2, esc: -1, son: -1, bpm: -1, oct: -1, l1: "", l2: "" });
  useEffect(() => () => { r.tex.dispose(); r.mat.dispose(); r.geo.dispose(); r.marcoGeo.dispose(); r.marcoMat.dispose(); }, [r]);

  useFrame(({ camera }) => {
    const g = grupoRef.current;
    if (!g) return;
    const ahora = performance.now(), u = ult.current;
    if (!tocaActualizar(ahora, u.ms, DBG_ATRIL_SINTE.VU_HZ)) return;
    u.ms = ahora;
    if (!enPantalla(g, camera)) return;
    const val = ahora < DISPLAY_SINTE.hasta ? DISPLAY_SINTE.version : -1, esc = escalaActualSinte();
    const son = RITMOS.sonando ? 1 : 0, bpm = Math.round(bpmSinte()), oct = DBG_SINTE.OCTAVA;
    if (u.ver === SINTE.version && u.vc === SINTE.versionCara && u.val === val && u.esc === esc && u.son === son && u.bpm === bpm && u.oct === oct) return;
    const cambioEstado = u.ver !== SINTE.version || u.son !== son || u.bpm !== bpm || u.oct !== oct;
    if (u.ver !== SINTE.version || u.vc !== SINTE.versionCara) calcularCurvas();
    u.ver = SINTE.version; u.vc = SINTE.versionCara; u.val = val; u.esc = esc; u.son = son; u.bpm = bpm; u.oct = oct;
    if (cambioEstado || !u.l1) {
      u.l1 = lineaSinte1(SINTE.sonido, SINTE.editado, DBG_SINTE.ARP_ON, DBG_SINTE.ARP_PATRON, bpm);
      u.l2 = lineaSinte2Reposo(oct, DBG_SINTE.ARP_ON && !RITMOS.sonando);
    }
    dibujarDisplaySinte(r, u.l1, val >= 0 ? DISPLAY_SINTE.texto : u.l2, esc);
  });

  const cu = (r.d.u0 + r.d.u1) / 2, cvv = (r.d.v0 + r.d.v1) / 2;
  return (
    <group ref={grupoRef} position={[cu, 0, -cvv]}>
      <mesh position={[0, 0.0015, 0]} geometry={r.marcoGeo} material={r.marcoMat} />
      <mesh position={[0, 0.0050, 0]} rotation={[-Math.PI / 2, 0, 0]} geometry={r.geo} material={r.mat} />
    </group>
  );
}

// ── VU del sinte: el de SN-40 con su geometría y su analizador (referencias estables) ──
const hzVu = () => DBG_ATRIL_SINTE.VU_HZ;
export function VuSinte() { return <VuSonido vu={VU_Y} analizador={analizadorSinte} hz={hzVu} />; }

// ── piano de la computadora y Web MIDI ──
interface AccesoMidi { inputs: Map<string, EntradaMidi>; onstatechange: ((e: unknown) => void) | null }
interface EntradaMidi { onmidimessage: ((e: { data: Uint8Array | null }) => void) | null }
/**
 * Teclas de la computadora → notas (solo en el modo atril del SY-40). Mantener una tecla sostiene la nota, soltarla la
 * libera; la autorepetición del sistema no repite (teclaAbajo). Con SINTE_MIDI, también un teclado MIDI conectado.
 */
export function TecladoSinte() {
  useEffect(() => {
    const k = crearTecladoPc();
    const notaDe = new Int16Array(TECLAS_PIANO.length).fill(-1);   // la nota con la que bajó cada tecla (la octava puede cambiar)
    let reinicios = SINTE.reinicios;
    const soltarTodo = () => {
      for (let s = 0; s < notaDe.length; s++) { if (notaDe[s] >= 0) notaArriba(notaDe[s]); notaDe[s] = -1; k.abajo[s] = 0; }
      soltarTodasSinte();
    };
    const down = (e: KeyboardEvent) => {
      if (INTERACT_STATE.mode !== "synth" || e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (reinicios !== SINTE.reinicios) { reinicios = SINTE.reinicios; k.abajo.fill(0); notaDe.fill(-1); }
      const s = teclaAbajo(k, e.code, e.repeat);
      if (s < 0) return;
      const n = notaDeSemitono(s);
      notaDe[s] = n;
      notaAbajo(n);
      mostrarEnDisplaySinte(`NOTA ${nombreNota(n)}`);
    };
    const up = (e: KeyboardEvent) => {
      const s = teclaArriba(k, e.code);
      if (s < 0) return;
      if (notaDe[s] >= 0) notaArriba(notaDe[s]);
      notaDe[s] = -1;
    };
    const onVis = () => { if (document.visibilityState !== "visible") soltarTodo(); };
    const onModo = (e: Event) => { if ((e as CustomEvent<{ mode?: string }>).detail?.mode !== "synth") soltarTodo(); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", soltarTodo);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("alight:lectern-mode", onModo);
    // Web MIDI (opcional, pide permiso): note-on / note-off de cualquier canal
    let acceso: AccesoMidi | null = null, vivo = true;
    const midi = { nota: 0, on: false };
    const onMidi = (ev: { data: Uint8Array | null }) => {
      const d = ev.data;
      if (!d || d.length < 3 || leerMidi(d[0], d[1], d[2], midi) < 0) return;
      if (midi.on) notaAbajo(midi.nota); else notaArriba(midi.nota);
    };
    const enganchar = () => { acceso?.inputs.forEach(i => { i.onmidimessage = onMidi; }); };
    const nav = navigator as unknown as { requestMIDIAccess?: () => Promise<AccesoMidi> };
    if (DBG_SINTE.SINTE_MIDI && typeof nav.requestMIDIAccess === "function") {
      nav.requestMIDIAccess().then(a => {
        if (!vivo) return;
        acceso = a; enganchar(); a.onstatechange = enganchar;
      }).catch(() => { /* sin permiso o sin MIDI: el teclado de la computadora y los pads siguen andando */ });
    }
    return () => {
      vivo = false;
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", soltarTodo);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("alight:lectern-mode", onModo);
      if (acceso) { acceso.onstatechange = null; acceso.inputs.forEach(i => { i.onmidimessage = null; }); acceso = null; }
      soltarTodo();
    };
  }, []);
  return null;
}
