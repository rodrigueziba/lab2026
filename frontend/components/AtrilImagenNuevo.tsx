"use client";
// Z97: piezas del atril de IMAGEN rediseñado ("IMAGEN IM-40"; layout puro en lib/atrilImagen.ts, efectos del domo en
// lib/domoEfectos.ts). Las monta LecternSystem (lado izquierdo) con DBG_ATRIL_VIDEO.DISENO_NUEVO. La placa de la barra,
// la placa frontal y el margen de rótulos son los del atril de sonido (AtrilSonidoNuevo.tsx), con otros datos.
//  - buildSilkscreenImagen: serigrafía (marcos, ESCENA con borde punteado, bandas de título con "SE TRANSMITE" /
//    "SOLO PARA VOS", etiquetas, escalas de perillas y faders). Una vez, o al cambiar la escala.
//  - DisplayImagen: línea 1 = efectos (textoEfectos); línea 2 = "● EN VIVO · SE TRANSMITE" / "PRIVADO · NADA SE
//    TRANSMITE", o el control tocado durante DISPLAY_VALOR_S. Redibuja solo cuando cambia algo, ≤ 30 Hz, en pantalla.

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { DBG_ATRIL_VIDEO } from "@/lib/debugConfig";
import { CONSENT } from "@/lib/consentTarimaAcciones";
import { DOMO_EFECTOS, textoEfectos } from "@/lib/domoEfectos";
import {
  MODULOS_I, POSICIONES_I, FADER_V_I, FADER_RAIL_I, moduloI, textosI, numerosPerillaI, numerosFaderI, altosDisplayI,
  rotulosFilaI, numerosFilaMargenI,
} from "@/lib/atrilImagen";
import { BANDA_TITULO, DISPLAY_PAD, DISPLAY_INTERLINEA, RADIO_MARCAS_IN, RADIO_MARCAS_OUT, HUELLA, ESCALA_FADER, escalaEfectiva, tocaActualizar } from "@/lib/atrilSonido";
import { FRANJAS_PLACA } from "@/lib/marca";   // Z98

export const DISPLAY_IMAGEN = { texto: "", hasta: 0, version: 0 };
export function mostrarEnDisplayImagen(texto: string): void {
  DISPLAY_IMAGEN.texto = texto;
  DISPLAY_IMAGEN.hasta = performance.now() + Math.max(0.2, DBG_ATRIL_VIDEO.DISPLAY_VALOR_S) * 1000;
  DISPLAY_IMAGEN.version++;
}
export function escalaActualImagen(): number {
  const asp = typeof window === "undefined" ? 16 / 9 : window.innerWidth / Math.max(1, window.innerHeight);
  return escalaEfectiva(DBG_ATRIL_VIDEO.ETIQUETA_ESCALA, DBG_ATRIL_VIDEO.ETIQUETA_AUTO_ASPECTO, asp);
}
/** Datos estables de los rótulos (para MargenRotulos: la textura no se rehace en cada render). */
export const ROTULOS_VERTICALES_I = rotulosFilaI();
export const ROTULOS_NUMEROS_I = numerosFilaMargenI();

const CREMA = "rgba(241,239,230,";
const FRANJAS = FRANJAS_PLACA;   // Z98: fuente única en lib/marca.ts

// ── visibilidad (objetos de módulo) ──
const _fr = new THREE.Frustum(), _m4 = new THREE.Matrix4(), _esf = new THREE.Sphere(new THREE.Vector3(), 0.9);
function enPantalla(obj: THREE.Object3D, cam: THREE.Camera): boolean {
  obj.getWorldPosition(_esf.center);
  _m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  _fr.setFromProjectionMatrix(_m4);
  return _fr.intersectsSphere(_esf);
}

export async function buildSilkscreenImagen(dims: { CW: number; CD: number }): Promise<THREE.CanvasTexture> {
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

  for (const m of MODULOS_I) {
    if (m.fila === "display") continue;
    const x0 = X(m.rect.u0), x1 = X(m.rect.u1), y0 = Y(m.rect.v1), y1 = Y(m.rect.v0), banda = BANDA_TITULO * ppmY;
    c.fillStyle = "rgba(241,239,230,0.07)"; c.fillRect(x0, y0, x1 - x0, banda);
    c.strokeStyle = `${CREMA}0.6)`; c.lineWidth = 3;
    if (m.punteado) c.setLineDash([22, 14]);   // ESCENA: solo para vos
    c.strokeRect(x0 + 1.5, y0 + 1.5, x1 - x0 - 3, y1 - y0 - 3);
    c.setLineDash([]);
    c.strokeStyle = `${CREMA}0.35)`; c.lineWidth = 2;
    c.beginPath(); c.moveTo(x0 + 6, y0 + banda); c.lineTo(x1 - 6, y0 + banda); c.stroke();
  }
  const d = moduloI("display").rect;
  for (let i = 0; i < 5; i++) { c.fillStyle = FRANJAS[i]; c.fillRect(X(d.u0), Y(d.v0) + 8 + i * 6, X(d.u1) - X(d.u0), 4); }

  for (const t of textosI(escalaActualImagen())) {
    if (t.fila === "display") continue;
    c.font = `bold ${Math.round(t.alto * ppmY)}px monospace`;
    c.textBaseline = "middle"; c.textAlign = t.alinear === "izq" ? "left" : "center";
    c.fillStyle = t.id.startsWith("g_") ? (t.texto.includes("TRANSMITE") ? "rgba(255,154,31,0.95)" : `${CREMA}0.7)`) : t.id.startsWith("t_") ? `${CREMA}0.97)` : `${CREMA}0.88)`;
    c.fillText(t.texto, X(t.u), Y(t.v));
  }
  // perillas: escala de 270° y mínimo/máximo
  for (const p of POSICIONES_I) {
    if (p.tipo !== "knob") continue;
    for (let i = 0; i <= 10; i++) {
      const a = (i / 10) * Math.PI * 1.5 - Math.PI * 0.75, fin = i === 0 || i === 10;
      const rOut = fin ? RADIO_MARCAS_OUT : RADIO_MARCAS_OUT - 0.002;
      c.strokeStyle = fin ? `${CREMA}0.85)` : `${CREMA}0.5)`; c.lineWidth = fin ? 3 : 2;
      c.beginPath(); c.moveTo(X(p.u + Math.sin(a) * RADIO_MARCAS_IN), Y(p.v + Math.cos(a) * RADIO_MARCAS_IN));
      c.lineTo(X(p.u + Math.sin(a) * rOut), Y(p.v + Math.cos(a) * rOut)); c.stroke();
    }
    for (const n of numerosPerillaI(p)) { c.font = `bold ${Math.round(n.alto * ppmY)}px monospace`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = `${CREMA}0.9)`; c.fillText(n.texto, X(n.u), Y(n.v)); }
  }
  // faders de IMAGEN: marcas cada 10 % y números 0, 5, 10
  for (const p of POSICIONES_I) {
    if (p.tipo !== "slider") continue;
    const xM = X(p.u - HUELLA.FADER_U - 0.004);
    for (let i = 0; i <= 10; i++) {
      const v = FADER_V_I - FADER_RAIL_I / 2 + (i / 10) * FADER_RAIL_I, mayor = i === 0 || i === 5 || i === 10;
      const largo = (mayor ? ESCALA_FADER.marcaLarga : ESCALA_FADER.marcaCorta) * ppmX;
      c.fillStyle = mayor ? `${CREMA}0.9)` : `${CREMA}0.55)`; c.fillRect(xM - largo, Y(v) - 2, largo, 4);
    }
    c.fillStyle = `${CREMA}0.9)`; c.textAlign = "center"; c.textBaseline = "middle";
    for (const n of numerosFaderI(p)) { c.font = `bold ${Math.round(n.alto * ppmY)}px monospace`; c.fillText(n.texto, X(n.u), Y(n.v)); }
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 16;
  tex.minFilter = THREE.LinearMipmapLinearFilter; tex.needsUpdate = true;
  return tex;
}

/** Dibuja las dos líneas del display (fuera del componente: así el compilador de React no la toma como mutación de estado). */
function dibujarDisplayImagen(r: { cv: HTMLCanvasElement; tex: THREE.CanvasTexture; cw: number; ch: number; w: number }, l1: string, l2: string, esc: number): void {
  const c = r.cv.getContext("2d");
  if (!c) return;
  const ppm = r.cw / r.w, [a1, a2] = altosDisplayI(esc);
  c.fillStyle = "#2A1400"; c.fillRect(0, 0, r.cw, r.ch);
  c.fillStyle = "rgba(255,154,31,0.07)"; for (let y = 0; y < r.ch; y += 4) c.fillRect(0, y, r.cw, 1);
  c.fillStyle = "#FF9A1F"; c.shadowColor = "rgba(255,154,31,0.6)"; c.shadowBlur = 10; c.textAlign = "left"; c.textBaseline = "middle";
  c.font = `bold ${Math.round(a1 * ppm)}px monospace`; c.fillText(l1, 0.012 * ppm, DISPLAY_PAD * ppm + (a1 * ppm) / 2);
  c.font = `bold ${Math.round(a2 * ppm)}px monospace`; c.fillText(l2, 0.012 * ppm, (DISPLAY_PAD + a1 + DISPLAY_INTERLINEA) * ppm + (a2 * ppm) / 2);
  c.shadowBlur = 0;
  r.tex.needsUpdate = true;
}

export function DisplayImagen() {
  const grupoRef = useRef<THREE.Group>(null);
  const r = useMemo(() => {
    const d = moduloI("display").rect, w = d.u1 - d.u0, h = d.v1 - d.v0;
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
  // último contenido dibujado (campos simples: comparar no crea objetos)
  const ult = useRef({ ms: -1e9, ver: -1, estado: "", val: -2, esc: -1 });
  useEffect(() => () => { r.tex.dispose(); r.mat.dispose(); r.geo.dispose(); r.marcoGeo.dispose(); r.marcoMat.dispose(); }, [r]);

  useFrame(({ camera }) => {
    const g = grupoRef.current;
    if (!g) return;
    const ahora = performance.now(), u = ult.current;
    if (!tocaActualizar(ahora, u.ms, 30)) return;
    u.ms = ahora;
    if (!enPantalla(g, camera)) return;
    const val = ahora < DISPLAY_IMAGEN.hasta ? DISPLAY_IMAGEN.version : -1, esc = escalaActualImagen();
    if (u.ver === DOMO_EFECTOS.version && u.estado === CONSENT.estado && u.val === val && u.esc === esc) return;
    u.ver = DOMO_EFECTOS.version; u.estado = CONSENT.estado; u.val = val; u.esc = esc;
    const l1 = textoEfectos(DOMO_EFECTOS);
    const l2 = val >= 0 ? `» ${DISPLAY_IMAGEN.texto}` : CONSENT.estado === "compartiendo" ? "● EN VIVO · SE TRANSMITE" : "PRIVADO · NADA SE TRANSMITE";
    dibujarDisplayImagen(r, l1, l2, esc);
  });

  const cu = (r.d.u0 + r.d.u1) / 2, cvv = (r.d.v0 + r.d.v1) / 2;
  return (
    <group ref={grupoRef} position={[cu, 0, -cvv]}>
      <mesh position={[0, 0.0015, 0]} geometry={r.marcoGeo} material={r.marcoMat} />
      <mesh position={[0, 0.0050, 0]} rotation={[-Math.PI / 2, 0, 0]} geometry={r.geo} material={r.mat} />
    </group>
  );
}
