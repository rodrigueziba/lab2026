"use client";
// Z96: piezas del atril de SONIDO rediseñado ("SONIDO SN-40"; layout y lógica pura en lib/atrilSonido.ts). Las monta
// LecternSystem (lado derecho) con DBG_ATRIL_SONIDO.DISENO_NUEVO; con false vuelve el layout anterior (J3) sin tocar nada.
//  - buildSilkscreenSonido: serigrafía del panel (marcos, bandas de título, títulos, etiquetas, escalas) en UNA textura,
//    dibujada una vez (o al cambiar ETIQUETA_ESCALA), como la de J3.
//  - DisplaySonido: display ámbar de la franja lejana (pista, tiempo, PLAY/PAUSA, loop A-B; y el control tocado durante
//    DISPLAY_VALOR_S). Se redibuja SOLO cuando cambia el contenido, a ≤ VU_HZ y solo con el atril en pantalla.
//  - VuSonido: medidor de nivel del bus maestro de la tarima (analizadorMaestro de lib/audio/nucleo.ts; NO crea otro
//    analizador). ≤ VU_HZ, solo en pantalla, búfer reutilizado, sin allocations por frame.
//  - PlacaFrenteSonido: placa crema con franjas y el nombre del equipo en la cara frontal del mueble (como la CR-80).
// Coordenadas del panel (las de CtrlDef): x = u, z = −v, y = sobre la superficie.

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { DBG_ATRIL_SONIDO } from "@/lib/debugConfig";
import { STORE } from "@/lib/alightStore";
import { PLAY_TARIMA } from "@/lib/playTarima";
import { getAudioElement } from "@/lib/audioEngine";
import { analizadorMaestro } from "@/lib/audio/nucleo";
import { NOMBRE_EMPRESA_MAYUS, FRANJAS_PLACA } from "@/lib/marca";
import {
  MODULOS, POSICIONES, VU, FADER_RAIL, FADER_V, GRANDE_ESCALA, BANDA_TITULO, BANDA_TITULO_TRANSPORTE,
  DISPLAY_PAD, DISPLAY_INTERLINEA, RADIO_MARCAS_IN, RADIO_MARCAS_OUT, altosDisplay, textos,
  // Z96b
  numerosPerilla, esPerilla, numerosFader, ESCALA_FADER, HUELLA, colorSegmento, tickPico, escalaEfectiva,
  BARRA, PLACA_BARRA, TEXTO_PLACA, LEYENDA_FILAS, BARRA_2L, lineasBarra, rotulosFila, numerosFilaMargen, MARGEN_ROTULOS, FILAS, modulo, lineasDisplay, rms, nivelVu, balistica, tocaActualizar,
  recortarLinea, DISPLAY_CHARS_1, DISPLAY_CHARS_2,   // Z97b
} from "@/lib/atrilSonido";

export const NOMBRE_EQUIPO = "SONIDO SN-40";
/** Z96b: ETIQUETA_ESCALA efectiva (con el ajuste por proporción de pantalla). */
export function escalaActual(): number {
  const asp = typeof window === "undefined" ? 16 / 9 : window.innerWidth / Math.max(1, window.innerHeight);
  return escalaEfectiva(DBG_ATRIL_SONIDO.ETIQUETA_ESCALA, DBG_ATRIL_SONIDO.ETIQUETA_AUTO_ASPECTO, asp);
}
export const DESCRIPCION_EQUIPO = "PROCESADOR DE SONIDO · 10 MÓDULOS";

/** Lo escribe setCtrl (LecternSystem) al tocar un control del atril de sonido: el display lo muestra DISPLAY_VALOR_S. */
export const DISPLAY_SONIDO = { texto: "", hasta: 0, version: 0 };
export function mostrarEnDisplay(texto: string): void {
  DISPLAY_SONIDO.texto = texto;
  DISPLAY_SONIDO.hasta = performance.now() + Math.max(0.2, DBG_ATRIL_SONIDO.DISPLAY_VALOR_S) * 1000;
  DISPLAY_SONIDO.version++;
}

// ── visibilidad (objetos de módulo: sin allocations por frame) ──
const _fr = new THREE.Frustum(), _m4 = new THREE.Matrix4(), _esf = new THREE.Sphere(new THREE.Vector3(), 0.9);
function enPantalla(obj: THREE.Object3D, cam: THREE.Camera): boolean {
  obj.getWorldPosition(_esf.center);
  _m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  _fr.setFromProjectionMatrix(_m4);
  return _fr.intersectsSphere(_esf);
}

const CREMA = "rgba(241,239,230,";
const FRANJAS = FRANJAS_PLACA;   // Z98: fuente única en lib/marca.ts

// ── serigrafía ──
export async function buildSilkscreenSonido(dims: { CW: number; CD: number; KNOB_SKIRT_R: number; THUMB_W: number }): Promise<THREE.CanvasTexture> {
  if (typeof document !== "undefined" && document.fonts) await document.fonts.ready;
  const W = 4096, H = 2048;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const c = cv.getContext("2d")!;
  const { CW, CD } = dims;
  const X = (u: number) => ((u + CW / 2) / CW) * W;
  const Y = (v: number) => ((CD / 2 - v) / CD) * H;
  const ppmX = W / CW, ppmY = H / CD;
  c.fillStyle = "#0d0d11"; c.fillRect(0, 0, W, H);

  // marcos de módulo y bandas de título
  for (const m of MODULOS) {
    if (m.fila === "display") continue;
    const x0 = X(m.rect.u0), x1 = X(m.rect.u1), y0 = Y(m.rect.v1), y1 = Y(m.rect.v0);
    const banda = (m.fila === "transporte" ? BANDA_TITULO_TRANSPORTE : BANDA_TITULO) * ppmY;
    c.fillStyle = "rgba(241,239,230,0.07)"; c.fillRect(x0, y0, x1 - x0, banda);
    c.strokeStyle = `${CREMA}0.6)`; c.lineWidth = 3; c.strokeRect(x0 + 1.5, y0 + 1.5, x1 - x0 - 3, y1 - y0 - 3);
    c.strokeStyle = `${CREMA}0.35)`; c.lineWidth = 2;
    c.beginPath(); c.moveTo(x0 + 6, y0 + banda); c.lineTo(x1 - 6, y0 + banda); c.stroke();
  }
  // franja de arcoíris fina sobre el display (como la CR-80)
  const d = modulo("display").rect;
  for (let i = 0; i < 5; i++) { c.fillStyle = FRANJAS[i]; c.fillRect(X(d.u0), Y(d.v0) + 8 + i * 6, X(d.u1) - X(d.u0), 4); }

  // títulos y etiquetas (las líneas del display las dibuja el display)
  c.fillStyle = `${CREMA}0.95)`;
  for (const t of textos(escalaActual())) {
    if (t.fila === "display") continue;
    const px = Math.round(t.alto * ppmY);
    c.font = `bold ${px}px monospace`;
    c.textBaseline = "middle";
    c.textAlign = t.alinear === "izq" ? "left" : "center";
    c.fillStyle = t.id.startsWith("t_") ? `${CREMA}0.97)` : `${CREMA}0.88)`;
    c.fillText(t.texto, X(t.u), Y(t.v));
  }

  // escalas de las perillas (11 marcas en 270°)
  for (const p of POSICIONES) {
    if (p.forma !== "normal" && p.forma !== "grande") continue;
    if (!["s_lfo_sp", "s_lfo_dp", "s_phs_sp", "s_phs_dp", "s_phs_fb", "s_pit_st", "s_pit_mx", "s_dlyA", "s_rev", "s_lp_fr", "s_hp_fr", "s_drive", "s_dist_mx"].includes(p.id)) continue;
    const esc = p.forma === "grande" ? GRANDE_ESCALA : 1;
    // marcas entre RADIO_MARCAS_IN y RADIO_MARCAS_OUT (lib/atrilSonido.ts): las de perillas vecinas no se tocan
    const rIn = RADIO_MARCAS_IN * esc;
    for (let i = 0; i <= 10; i++) {
      const a = (i / 10) * Math.PI * 1.5 - Math.PI * 0.75;
      const fin = i === 0 || i === 10;
      const rOut = (fin ? RADIO_MARCAS_OUT : RADIO_MARCAS_OUT - 0.002) * esc;
      c.strokeStyle = fin ? `${CREMA}0.85)` : `${CREMA}0.5)`; c.lineWidth = fin ? 3 : 2;
      c.beginPath();
      c.moveTo(X(p.u + Math.sin(a) * rIn), Y(p.v + Math.cos(a) * rIn));
      c.lineTo(X(p.u + Math.sin(a) * rOut), Y(p.v + Math.cos(a) * rOut));
      c.stroke();
    }
    // Z96b: mínimo y máximo impresos en los extremos ("0"/"10", o "MIN"/"MAX" en las de Hz)
    if (esPerilla(p)) for (const n of numerosPerilla(p)) {
      c.font = `bold ${Math.round(n.alto * ppmY)}px monospace`; c.textAlign = "center"; c.textBaseline = "middle";
      c.fillStyle = `${CREMA}0.9)`; c.fillText(n.texto, X(n.u), Y(n.v));
    }
  }
  // fader VOLUMEN (Z96b): escala 0…10 a la izquierda del recorrido: marcas (largas en 0, 5 y 10) y números 0, 5, 10
  const vol = POSICIONES.find(p => p.id === "s_vol")!;
  const xMarca = X(vol.u - HUELLA.FADER_U - 0.004);   // borde derecho de las marcas (no las tapa el pomo)
  for (let i = 0; i <= 10; i++) {
    const v = FADER_V - FADER_RAIL / 2 + (i / 10) * FADER_RAIL;
    const mayor = i === 0 || i === 5 || i === 10;
    const largo = (mayor ? ESCALA_FADER.marcaLarga : ESCALA_FADER.marcaCorta) * ppmX;
    c.fillStyle = mayor ? `${CREMA}0.9)` : `${CREMA}0.55)`;
    c.fillRect(xMarca - largo, Y(v) - 2, largo, 4);
  }
  c.fillStyle = `${CREMA}0.9)`; c.textAlign = "center"; c.textBaseline = "middle";
  for (const n of numerosFader()) { c.font = `bold ${Math.round(n.alto * ppmY)}px monospace`; c.fillText(n.texto, X(n.u), Y(n.v)); }
  // VU: marco y escala en dB
  c.strokeStyle = `${CREMA}0.5)`; c.lineWidth = 2;
  c.strokeRect(X(VU.u - VU.ancho / 2 - 0.004), Y(VU.v1 + 0.006), (VU.ancho + 0.008) * ppmX, (VU.v1 - VU.v0 + 0.012) * ppmY);
  c.font = "bold 30px monospace"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = `${CREMA}0.85)`;
  c.fillText("VU", X(VU.u), Y(VU.v0 - 0.022));

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.needsUpdate = true;
  return tex;
}

// ── display ámbar ──
export function DisplaySonido() {
  const grupoRef = useRef<THREE.Group>(null);
  const r = useMemo(() => {
    const d = modulo("display").rect;
    const w = d.u1 - d.u0, h = d.v1 - d.v0;
    const cw = 2048, ch = Math.round((cw * h) / w);
    const cv = document.createElement("canvas");
    cv.width = cw; cv.height = ch;
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
    const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
    const geo = new THREE.PlaneGeometry(w, h);
    const marcoGeo = new THREE.BoxGeometry(w + 0.012, 0.006, h + 0.012);
    const marcoMat = new THREE.MeshStandardMaterial({ color: "#E8DCC4", roughness: 0.85, metalness: 0 });
    return { d, w, h, cw, ch, cv, tex, mat, geo, marcoGeo, marcoMat };
  }, []);
  // último contenido dibujado (campos numéricos: comparar no crea objetos ni strings)
  const ult = useRef({ ms: -1e9, t: -2, dur: -2, son: -1, pista: -1, n: -1, a: -2, b: -2, lp: -1, val: -2, esc: -1 });

  useEffect(() => () => { r.tex.dispose(); r.mat.dispose(); r.geo.dispose(); r.marcoGeo.dispose(); r.marcoMat.dispose(); }, [r]);

  useFrame(({ camera }) => {
    const g = grupoRef.current;
    if (!g) return;
    const ahora = performance.now();
    if (!tocaActualizar(ahora, ult.current.ms, DBG_ATRIL_SONIDO.VU_HZ)) return;
    ult.current.ms = ahora;
    if (!enPantalla(g, camera)) return;
    const el = getAudioElement();
    const t = el ? Math.floor(el.currentTime || 0) : -1, dur = el && Number.isFinite(el.duration) ? Math.floor(el.duration) : -1;
    const sm = STORE.audio.sampler;
    const valor = ahora < DISPLAY_SONIDO.hasta ? DISPLAY_SONIDO.version : -1;
    // el texto se arma y se dibuja SOLO si algo cambió (≈ 1 vez por segundo)
    const u = ult.current, son = PLAY_TARIMA.sonando ? 1 : 0, a = Math.floor(sm.loopStart), b = Math.floor(sm.loopEnd), lp = sm.loopActive ? 1 : 0;
    const esc = escalaActual();
    if (u.t === t && u.dur === dur && u.son === son && u.pista === STORE.audio.trackIndex && u.n === STORE.audio.tracks.length
      && u.a === a && u.b === b && u.lp === lp && u.val === valor && u.esc === esc) return;
    u.t = t; u.dur = dur; u.son = son; u.pista = STORE.audio.trackIndex; u.n = STORE.audio.tracks.length; u.a = a; u.b = b; u.lp = lp; u.val = valor; u.esc = esc;
    const url = STORE.audio.tracks[STORE.audio.trackIndex] ?? "";
    let pista = "";
    try { pista = decodeURIComponent(url.split("/").pop() ?? ""); } catch { pista = url.split("/").pop() ?? ""; }
    const [l1, l2] = lineasDisplay({ pista, t, dur, sonando: PLAY_TARIMA.sonando, loopIn: sm.loopStart, loopOut: sm.loopEnd, loopOn: sm.loopActive });
    dibujar(r, valor >= 0 ? `» ${DISPLAY_SONIDO.texto}` : l1, valor >= 0 ? l1 : l2);
  });

  const cu = (r.d.u0 + r.d.u1) / 2, cv = (r.d.v0 + r.d.v1) / 2;
  return (
    <group ref={grupoRef} position={[cu, 0, -cv]}>
      <mesh position={[0, 0.0015, 0]} geometry={r.marcoGeo} material={r.marcoMat} />
      <mesh position={[0, 0.0050, 0]} rotation={[-Math.PI / 2, 0, 0]} geometry={r.geo} material={r.mat} />
    </group>
  );
}
/** Z97b: una línea de texto que nunca se dibuja fuera del ancho disponible (achica la fuente si hace falta). */
function linea(c: CanvasRenderingContext2D, t: string, alto: number, anchoMax: number, x: number, y: number): void {
  let px = Math.round(alto);
  c.font = `bold ${px}px monospace`;
  const a = c.measureText(t).width;
  if (a > anchoMax) { px = Math.max(8, Math.floor(px * anchoMax / a)); c.font = `bold ${px}px monospace`; }
  c.fillText(t, x, y);
}
function dibujar(r: { cv: HTMLCanvasElement; tex: THREE.CanvasTexture; cw: number; ch: number; w: number; h: number }, l1: string, l2: string): void {
  const c = r.cv.getContext("2d");
  if (!c) return;
  const ppm = r.cw / r.w, e = escalaActual();
  c.fillStyle = "#2A1400"; c.fillRect(0, 0, r.cw, r.ch);
  c.fillStyle = "rgba(255,154,31,0.07)";
  for (let y = 0; y < r.ch; y += 4) c.fillRect(0, y, r.cw, 1);   // líneas de barrido
  const [a1, a2] = altosDisplay(e);   // los mismos altos que usa la prueba de legibilidad (acotados al display)
  const h1 = a1 * ppm, h2 = a2 * ppm, pad = DISPLAY_PAD * ppm;
  c.fillStyle = "#FF9A1F"; c.shadowColor = "rgba(255,154,31,0.6)"; c.shadowBlur = 10;
  c.textAlign = "left"; c.textBaseline = "middle";
  // Z97b: recorte a los caracteres del display y, además, medición real: si el glifo es más ancho que el modelo, la
  // fuente baja hasta entrar (al tocar un control, la línea 2 muestra la línea 1, que podía pasar de 44 caracteres)
  const anchoMax = r.cw - 2 * 0.012 * ppm;
  linea(c, recortarLinea(l1, DISPLAY_CHARS_1), h1, anchoMax, 0.012 * ppm, pad + h1 / 2);
  linea(c, recortarLinea(l2, DISPLAY_CHARS_2), h2, anchoMax, 0.012 * ppm, pad + h1 + DISPLAY_INTERLINEA * ppm + h2 / 2);
  c.shadowBlur = 0;
  r.tex.needsUpdate = true;
}

// ── VU ──
export function VuSonido() {
  const grupoRef = useRef<THREE.Group>(null);
  const segsRef = useRef<(THREE.Mesh | null)[]>([]);
  const r = useMemo(() => {
    const n = VU.segmentos, alto = (VU.v1 - VU.v0) / n;
    const geo = new THREE.BoxGeometry(VU.ancho, 0.004, alto * 0.72);
    const apagado = new THREE.MeshStandardMaterial({ color: "#1d120a", roughness: 0.8, metalness: 0 });
    const encendido = [
      new THREE.MeshBasicMaterial({ color: "#2E9E5B", toneMapped: false }),
      new THREE.MeshBasicMaterial({ color: "#F4B62E", toneMapped: false }),
      new THREE.MeshBasicMaterial({ color: "#E5322B", toneMapped: false }),
    ];
    return { n, alto, geo, apagado, encendido };
  }, []);
  const st = useRef({ ms: -1e9, nivel: 0, buf: null as Float32Array | null, an: null as AnalyserNode | null, lit: -1, pico: -2,
    p: { idx: -1, t: 0 }, ambar: -1, rojo: -1 });

  useEffect(() => () => { r.geo.dispose(); r.apagado.dispose(); r.encendido.forEach(m => m.dispose()); st.current.buf = null; st.current.an = null; }, [r]);

  useFrame(({ camera }) => {
    const g = grupoRef.current, s = st.current;
    if (!g) return;
    const ahora = performance.now();
    if (!tocaActualizar(ahora, s.ms, DBG_ATRIL_SONIDO.VU_HZ)) return;
    const dt = Math.min(0.2, (ahora - s.ms) / 1000);
    s.ms = ahora;
    if (!enPantalla(g, camera)) return;
    const an = analizadorMaestro();
    let x = 0;
    if (an) {
      if (s.an !== an || !s.buf || s.buf.length !== an.fftSize) { s.an = an; s.buf = new Float32Array(an.fftSize); }   // una vez por analizador
      an.getFloatTimeDomainData(s.buf as Float32Array<ArrayBuffer>);
      x = nivelVu(rms(s.buf));
    }
    s.nivel = balistica(s.nivel, x, dt);
    const lit = Math.round(s.nivel * r.n);
    // Z96b: pico con retención (VU_PICO_RETENCION_MS) que después baja de a un segmento por tick
    tickPico(s.p, lit, ahora, DBG_ATRIL_SONIDO.VU_PICO_RETENCION_MS);
    const A = DBG_ATRIL_SONIDO.VU_SEG_AMBAR_DESDE, R = DBG_ATRIL_SONIDO.VU_SEG_ROJO_DESDE;
    if (lit === s.lit && s.p.idx === s.pico && A === s.ambar && R === s.rojo) return;   // solo cambia materiales si algo cambió
    s.lit = lit; s.pico = s.p.idx; s.ambar = A; s.rojo = R;
    for (let i = 0; i < r.n; i++) {
      const m = segsRef.current[i];
      if (!m) continue;
      const mat = i < lit || i === s.p.idx ? r.encendido[colorSegmento(i, A, R)] : r.apagado;
      if (m.material !== mat) m.material = mat;
    }
  });

  return (
    <group ref={grupoRef} position={[VU.u, 0.002, 0]}>
      {Array.from({ length: r.n }, (_, i) => (
        <mesh key={i} ref={m => { segsRef.current[i] = m; }} geometry={r.geo} material={r.apagado}
          position={[0, 0, -(VU.v0 + r.alto * (i + 0.5))]} />
      ))}
    </group>
  );
}

// ── placa frontal del mueble ──
export function PlacaFrenteSonido({ y, z, ancho, nombre = NOMBRE_EQUIPO, descripcion = DESCRIPCION_EQUIPO }: { y: number; z: number; ancho: number; nombre?: string; descripcion?: string }) {
  const r = useMemo(() => {
    const cv = document.createElement("canvas");
    cv.width = 1024; cv.height = 256;
    const c = cv.getContext("2d")!;
    c.fillStyle = "#E8DCC4"; c.fillRect(0, 0, 1024, 256);
    for (let i = 0; i < 5; i++) { c.fillStyle = FRANJAS[i]; c.fillRect(0, 150 + i * 14, 1024, 12); }
    c.fillStyle = "#3A3B3C"; c.font = "bold 64px monospace"; c.textBaseline = "alphabetic";
    c.fillText(nombre, 40, 90);
    c.font = "26px monospace"; c.fillText(`${NOMBRE_EMPRESA_MAYUS} · ${descripcion}`, 40, 132);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
    const geo = new THREE.PlaneGeometry(ancho, ancho / 4);
    return { tex, mat, geo };
  }, [ancho, nombre, descripcion]);
  useEffect(() => () => { r.tex.dispose(); r.mat.dispose(); r.geo.dispose(); }, [r]);
  return <mesh position={[0, y, z]} geometry={r.geo} material={r.mat} />;
}

// ── Z96b: placa sobre la barra trasera del marco (la ve la cámara del modo atril) ──
// Crema con franja de arcoíris, estilo CR-80. Con ROTULOS_FILA y ROTULOS_MODO "barra" suma una segunda línea con la
// leyenda numerada de las filas. Se dibuja una vez por combinación (rotulos/modo); libera textura y geometría.
export function PlacaBarraSonido({ conLeyenda, texto: textoP, leyenda = LEYENDA_FILAS }: { conLeyenda: boolean; texto?: string; leyenda?: string }) {
  const r = useMemo(() => {
    const W = PLACA_BARRA.ancho, D = PLACA_BARRA.prof, cw = 4096, ch = Math.round((cw * D) / W);
    const cv = document.createElement("canvas");
    cv.width = cw; cv.height = ch;
    const c = cv.getContext("2d")!;
    const ppm = cw / W, vc = (BARRA.v0 + BARRA.v1) / 2;
    const Y = (v: number) => (vc + D / 2 - v) * ppm;
    c.fillStyle = "#E8DCC4"; c.fillRect(0, 0, cw, ch);
    const texto = textoP ?? TEXTO_PLACA(NOMBRE_EMPRESA_MAYUS);
    const l = lineasBarra(texto.length, conLeyenda, leyenda.length);
    c.fillStyle = "#3A3B3C"; c.textAlign = "center"; c.textBaseline = "middle";
    c.font = `bold ${Math.round(l.placa.alto * ppm)}px monospace`; c.fillText(texto, cw / 2, Y(l.placa.v));
    if (l.leyenda) { c.font = `bold ${Math.round(l.leyenda.alto * ppm)}px monospace`; c.fillStyle = "#5a4a3a"; c.fillText(leyenda, cw / 2, Y(l.leyenda.v)); }
    // franjas del lado del jugador
    const fr = (conLeyenda ? BARRA_2L.franjas : PLACA_BARRA.franjas) * ppm, h1 = fr / 5;
    for (let i = 0; i < 5; i++) { c.fillStyle = FRANJAS[i]; c.fillRect(0, ch - fr + i * h1, cw, h1 * 0.8); }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
    const geo = new THREE.PlaneGeometry(W, D);
    return { tex, mat, geo, vc };
  }, [conLeyenda, textoP, leyenda]);
  useEffect(() => () => { r.tex.dispose(); r.mat.dispose(); r.geo.dispose(); }, [r]);
  return <mesh position={[0, BARRA.y + 0.0008, -r.vc]} rotation={[-Math.PI / 2, 0, 0]} geometry={r.geo} material={r.mat} />;
}

// ── Z96b: margen izquierdo de la placa: rótulos de fila verticales ("margen") o números de fila 1·2·3 ("barra") ──
type ItemRotulo = { texto: string; v: number; alto: number };
export function MargenRotulos({ modo, verticales, numeros }: { modo: string; verticales?: ItemRotulo[]; numeros?: ItemRotulo[] }) {
  const r = useMemo(() => {
    const W = MARGEN_ROTULOS.u1 - MARGEN_ROTULOS.u0, v0 = FILAS.transporte.v0, v1 = FILAS.display.v1, D = v1 - v0;
    const ch = 2048, cw = Math.max(32, Math.round((ch * W) / D));
    const cv = document.createElement("canvas");
    cv.width = cw; cv.height = ch;
    const c = cv.getContext("2d")!;
    const ppm = ch / D, Y = (v: number) => (v1 - v) * ppm;
    c.clearRect(0, 0, cw, ch);
    c.fillStyle = `${CREMA}0.92)`; c.textAlign = "center"; c.textBaseline = "middle";
    if (modo === "margen") {
      for (const t of verticales ?? rotulosFila()) {
        c.save(); c.translate(cw / 2, Y(t.v)); c.rotate(-Math.PI / 2);   // se lee de abajo hacia arriba
        c.font = `bold ${Math.round(t.alto * ppm)}px monospace`; c.fillText(t.texto, 0, 0); c.restore();
      }
    } else {
      for (const n of numeros ?? numerosFilaMargen()) { c.font = `bold ${Math.round(n.alto * ppm)}px monospace`; c.fillText(n.texto, cw / 2, Y(n.v)); }
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const geo = new THREE.PlaneGeometry(W, D);
    return { tex, mat, geo, uc: (MARGEN_ROTULOS.u0 + MARGEN_ROTULOS.u1) / 2, vc: (v0 + v1) / 2 };
  }, [modo, verticales, numeros]);
  useEffect(() => () => { r.tex.dispose(); r.mat.dispose(); r.geo.dispose(); }, [r]);
  return <mesh position={[r.uc, 0.0006, -r.vc]} rotation={[-Math.PI / 2, 0, 0]} geometry={r.geo} material={r.mat} />;
}
