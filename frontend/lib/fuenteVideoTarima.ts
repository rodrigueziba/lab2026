// Z87: fuente de video de la TARIMA con interfaz común. Las 7 proyecciones del domo de caras (FaceDome) y, más adelante,
// la transmisión en vivo consumen `texturaTarima()` sin saber si es la webcam o las ondas.
//   webcam: la VideoTexture de useFaceTracking (LIVE_TEX_REF), sin cambios.
//   ondas:  canvas 640×360 tipo osciloscopio de fósforo, dibujado a DBG_ONDAS_TARIMA.FPS con el analizador del bus
//           maestro del núcleo de audio (Z78): reacciona al mp3, a la caja de ritmos y a lo que suene en la tarima.
// Se dibuja solo mientras alguien la consume (FaceDome visible llama tickFuenteTarima) y con el reloj de la experiencia
// (pausa central: quieto). Sin allocations por cuadro (arreglos y canvas reutilizados).
// Cámara: useFaceTracking informa disponible/motivo (marcarCamara*). Si el permiso cambia a "concedido" o se conecta un
// dispositivo, se reintenta solo (evento alight:camara-reintentar); también con el botón "Reintentar permiso".

import * as THREE from "three";
import { DBG_ONDAS_TARIMA, DBG_RENDIMIENTO, DEBUG_ENABLED } from "@/lib/debugConfig";
import { LIVE_TEX_REF } from "@/lib/faceShared";
import { analizadorMaestro } from "@/lib/audio/nucleo";
import { RELOJ as RELOJ_EXP } from "@/lib/relojExperiencia";
import {
  elegirFuente, reintentoAutomatico, ondaAPuntos, espectroABarras, enSilencio, PALETAS,
  type EstadoCamara, type Eleccion, type MotivoCamara,
} from "@/lib/ondasTarima";

export const ANCHO = 640, ALTO = 360;
const MAX_PUNTOS = 1024, MAX_BARRAS = 128;

export const FUENTE_TARIMA = {
  cam: { disponible: false, motivo: "esperando" } as EstadoCamara,
  eleccion: { tipo: "ondas", motivo: "esperando" } as Eleccion,
  cuadros: 0,
  ondas: null as { cv: HTMLCanvasElement; c: CanvasRenderingContext2D; tex: THREE.CanvasTexture } | null,
  acc: 0, t: 0,
};
const _onda = new Float32Array(2048), _espectro = new Uint8Array(1024);
const _puntos = new Float32Array(2 * MAX_PUNTOS), _barras = new Float32Array(MAX_BARRAS);

// ── cámara (la llama useFaceTracking) ──
export function marcarCamaraOk(): void { FUENTE_TARIMA.cam.disponible = true; FUENTE_TARIMA.cam.motivo = ""; }
export function marcarCamaraFallo(m: MotivoCamara): void { FUENTE_TARIMA.cam.disponible = false; FUENTE_TARIMA.cam.motivo = m; }
export function reintentarCamara(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("alight:camara-reintentar"));
}

function asegurarCanvas(): NonNullable<typeof FUENTE_TARIMA.ondas> | null {
  if (FUENTE_TARIMA.ondas || typeof document === "undefined") return FUENTE_TARIMA.ondas;
  const cv = document.createElement("canvas"); cv.width = ANCHO; cv.height = ALTO;
  const c = cv.getContext("2d");
  if (!c) return null;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  FUENTE_TARIMA.ondas = { cv, c, tex };
  return FUENTE_TARIMA.ondas;
}

/** Textura que debe proyectar la tarima (null = ninguna todavía). */
export function texturaTarima(): THREE.Texture | null {
  elegirFuente(DBG_ONDAS_TARIMA.MODO, FUENTE_TARIMA.cam, FUENTE_TARIMA.eleccion);
  if (FUENTE_TARIMA.eleccion.tipo === "webcam") return (LIVE_TEX_REF.value as THREE.Texture | null) ?? null;
  return asegurarCanvas()?.tex ?? null;
}

/** Un cuadro (FaceDome visible). Dibuja las ondas a FPS si son la fuente elegida. */
export function tickFuenteTarima(): void {
  const F = FUENTE_TARIMA;
  if (F.eleccion.tipo !== "ondas" || DBG_RENDIMIENTO.SIS.ondasTarima === false) return;
  const dt = RELOJ_EXP.dtExp;
  if (dt <= 0 && F.cuadros > 0) return;   // pausa central: quieto
  F.t += dt; F.acc += dt;
  if (F.acc < 1 / Math.max(1, DBG_ONDAS_TARIMA.FPS) && F.cuadros > 0) return;
  F.acc = 0;
  const o = asegurarCanvas();
  if (!o) return;
  dibujar(o.c, F.t);
  o.tex.needsUpdate = true;
  F.cuadros++;
}

function dibujar(c: CanvasRenderingContext2D, t: number): void {
  const D = DBG_ONDAS_TARIMA, pal = PALETAS[D.PALETA] ?? PALETAS.ambar;
  const an = analizadorMaestro();
  // estela: el cuadro anterior se desvanece hacia el fondo
  c.globalCompositeOperation = "source-over";
  c.globalAlpha = 1 - Math.max(0, Math.min(0.97, D.PERSISTENCIA));
  c.fillStyle = pal.fondo; c.fillRect(0, 0, ANCHO, ALTO);
  c.globalAlpha = 1;
  // retícula tenue de osciloscopio
  c.strokeStyle = pal.trazo; c.globalAlpha = 0.08; c.lineWidth = 1;
  c.beginPath();
  for (let x = 0; x <= ANCHO; x += ANCHO / 10) { c.moveTo(x, 0); c.lineTo(x, ALTO); }
  for (let y = 0; y <= ALTO; y += ALTO / 6) { c.moveTo(0, y); c.lineTo(ANCHO, y); }
  c.stroke(); c.globalAlpha = 1;

  let rms = 0;
  if (an) {
    const n = Math.min(an.fftSize, _onda.length);
    an.getFloatTimeDomainData(_onda.subarray(0, n) as Float32Array<ArrayBuffer>);
    const nPts = Math.max(16, Math.min(MAX_PUNTOS, Math.floor(D.PUNTOS)));
    rms = ondaAPuntos(_onda.subarray(0, n), nPts, ANCHO, ALTO, D.SENSIBILIDAD, 18, _puntos);
  }
  const silencio = enSilencio(rms);
  const nPts = Math.max(16, Math.min(MAX_PUNTOS, Math.floor(D.PUNTOS)));
  if (!an || silencio) {
    // línea plana viva: ruido leve y parpadeo sutil
    for (let i = 0; i < nPts; i++) {
      _puntos[2 * i] = (i * ANCHO) / (nPts - 1);
      _puntos[2 * i + 1] = ALTO / 2 + (Math.sin(i * 12.9898 + t * 37.0) * 43758.5453 % 1) * 1.6;
    }
  }
  // espectro (barras desde abajo)
  if (an && (D.ESTILO === "espectro" || D.ESTILO === "ambos")) {
    const nB = Math.max(4, Math.min(MAX_BARRAS, Math.floor(D.BARRAS)));
    an.getByteFrequencyData(_espectro.subarray(0, an.frequencyBinCount) as Uint8Array<ArrayBuffer>);
    espectroABarras(_espectro.subarray(0, an.frequencyBinCount), nB, D.SENSIBILIDAD * 0.6, _barras);
    const bw = ANCHO / nB;
    c.fillStyle = pal.trazo; c.globalAlpha = D.ESTILO === "ambos" ? 0.35 : 0.85;
    for (let b = 0; b < nB; b++) { const hgt = _barras[b] * ALTO * 0.45; c.fillRect(b * bw + 1, ALTO - hgt, bw - 2, hgt); }
    c.globalAlpha = 1;
  }
  // forma de onda con glow de fósforo
  if (D.ESTILO !== "espectro" || silencio || !an) {
    const parp = silencio ? 0.75 + 0.25 * Math.abs(Math.sin(t * 2.3)) : 1;
    c.lineJoin = "round"; c.lineCap = "round";
    c.strokeStyle = pal.trazo; c.globalAlpha = 0.35 * parp; c.lineWidth = Math.max(1, D.GROSOR) * 3.2;
    trazo(c, nPts);
    c.strokeStyle = pal.brillo; c.globalAlpha = 0.95 * parp; c.lineWidth = Math.max(1, D.GROSOR);
    trazo(c, nPts);
    c.globalAlpha = 1;
  }
}
function trazo(c: CanvasRenderingContext2D, n: number): void {
  c.beginPath();
  c.moveTo(_puntos[0], _puntos[1]);
  for (let i = 1; i < n; i++) c.lineTo(_puntos[2 * i], _puntos[2 * i + 1]);
  c.stroke();
}

/** Permisos y dispositivos: reintento automático (lo instala FaceDome; devuelve la limpieza). */
export function instalarFuenteTarima(): () => void {
  if (typeof window === "undefined") return () => {};
  let permiso: PermissionStatus | null = null;
  const onPermiso = () => {
    if (permiso?.state === "granted" && reintentoAutomatico(DBG_ONDAS_TARIMA.MODO, FUENTE_TARIMA.cam.motivo, "permiso_concedido")) reintentarCamara();
  };
  const onDispositivo = () => {
    if (reintentoAutomatico(DBG_ONDAS_TARIMA.MODO, FUENTE_TARIMA.cam.motivo, "dispositivo")) reintentarCamara();
  };
  let vivo = true;
  try {
    navigator.permissions?.query({ name: "camera" as PermissionName }).then(p => {
      if (!vivo) return;
      permiso = p; p.addEventListener("change", onPermiso);
    }).catch(() => { /* el navegador no permite consultar "camera" */ });
  } catch { /* sin Permissions API */ }
  try { navigator.mediaDevices?.addEventListener("devicechange", onDispositivo); } catch { /* sin mediaDevices */ }
  return () => {
    vivo = false;
    permiso?.removeEventListener("change", onPermiso);
    try { navigator.mediaDevices?.removeEventListener("devicechange", onDispositivo); } catch { /* ok */ }
  };
}

/** Al desmontar la tarima: libera el canvas de ondas. */
export function liberarFuenteTarima(): void {
  FUENTE_TARIMA.ondas?.tex.dispose();
  FUENTE_TARIMA.ondas = null;
}

export function textoEstadoFuente(): string {
  const F = FUENTE_TARIMA, e = F.eleccion;
  const motivos: Record<string, string> = { "": "", esperando: "esperando la cámara", sin_dispositivo: "sin dispositivo", denegado: "permiso denegado", sin_soporte: "sin soporte", error: "error de la cámara", forzado: "forzado" };
  return `fuente: ${e.tipo.toUpperCase()}${e.motivo ? ` (${motivos[e.motivo] ?? e.motivo})` : ""} · cámara ${F.cam.disponible ? "disponible" : motivos[F.cam.motivo] || "no disponible"} · cuadros de ondas ${F.cuadros} · modo ${DBG_ONDAS_TARIMA.MODO}`;
}

if (DEBUG_ENABLED && typeof window !== "undefined") {
  (window as unknown as { __fuenteTarima?: object }).__fuenteTarima = { FUENTE_TARIMA, DBG_ONDAS_TARIMA, reintentarCamara, textoEstadoFuente, texturaTarima };
}
