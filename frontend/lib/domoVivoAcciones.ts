// Z83: une la proyección de la sesión en vivo en el domo (lib/domoVivo.ts + rama de dome.frag.glsl) con DomeSky, el
// monolito de video de Z82 (MONO_VIVO.video vía N5_STATE.leftProximity, que ya incluye la opacidad de los monolitos)
// y la sesión (SESSION de lib/remoteSession.ts). DomeSky llama aplicarDomoVivo(u) al final de su useFrame.
// - Peso: el de Z82 (sosteniendo = se mantiene; retornando = baja de a poco). Sin sesión → estática.
// - Video: una FuenteVideoDomo. Hoy: canvas 640×360 de la SesionPrueba (o uno propio con "Forzar video 100 %"),
//   redibujado a DBG_DOMO_VIVO.FPS y subido a la GPU SOLO mientras uRemoteMix > 0 y hace falta video. Mañana:
//   crearFuenteVideo(<video> de LiveKit) → VideoTexture, sin tocar el shader (mismo uniform uRemoteTex).
// - Pausa central: el tiempo del video y de la estática avanza con RELOJ.dtExp (0 en pausa → quietos).
// - Rendimiento: con DBG_RENDIMIENTO.SIS.videoDomo = false se fuerza uRemoteMix = 0 (fila "videoDomo" del benchmark).

import * as THREE from "three";
import { DBG_DOMO_VIVO, DBG_MONO_VIVO, DBG_RENDIMIENTO, DEBUG_ENABLED } from "@/lib/debugConfig";
import { RELOJ as RELOJ_EXP } from "@/lib/relojExperiencia";
import { SESSION, type RemoteSession } from "@/lib/remoteSession";
import { dibujarPatronVideo } from "@/lib/sesionPrueba";
import { N5_STATE } from "@/lib/vizAudio";
import { geometriaFranja, pesosDomo, TAU, type GeoFranja, type PesosDomo } from "@/lib/domoVivo";
import { RENDIMIENTO } from "@/components/RendimientoHost";   // solo para el diagnóstico (window.__domoVivo)

/** Fuente de video del domo: lo que se muestrea en uRemoteTex. */
export interface FuenteVideoDomo {
  readonly textura: THREE.Texture;
  /** Avanza el tiempo (s); si `subir`, actualiza la textura cuando hay cuadro nuevo. */
  actualizar(t: number, dt: number, subir: boolean): void;
  liberar(): void;
}

/** Canvas dibujado por una función a `fps()` cuadros por segundo. */
function fuenteCanvas(cv: HTMLCanvasElement, dibujar: (t: number) => void, fps: () => number): FuenteVideoDomo {
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.NoColorSpace;          // el shader no convierte (como las texturas del portal)
  tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  let acc = Infinity;
  return {
    textura: tex,
    actualizar(t, dt, subir) {
      if (!subir) return;
      acc += dt;
      if (acc < 1 / Math.max(1, fps())) return;
      acc = 0;
      dibujar(t);
      tex.needsUpdate = true;
    },
    liberar() { tex.dispose(); },
  };
}
/** <video> (LiveKit, más adelante): VideoTexture; three la actualiza sola mientras se usa. */
function fuenteVideo(v: HTMLVideoElement): FuenteVideoDomo {
  const tex = new THREE.VideoTexture(v);
  tex.colorSpace = THREE.NoColorSpace; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  return { textura: tex, actualizar() { /* VideoTexture se sube sola */ }, liberar() { tex.dispose(); } };
}
/** Fuente para la imagen de una sesión (canvas de prueba o video). */
export function crearFuenteVideo(s: RemoteSession): FuenteVideoDomo | null {
  const img = s.getImage();
  if (!img) return null;
  if (img instanceof HTMLVideoElement) return fuenteVideo(img);
  if (img instanceof HTMLCanvasElement) {
    const dib = (s as unknown as { dibujarVideo?: (t: number) => void }).dibujarVideo;
    return fuenteCanvas(img, t => dib?.call(s, t), () => DBG_DOMO_VIVO.FPS);
  }
  const tex = new THREE.Texture(img); tex.colorSpace = THREE.NoColorSpace; tex.needsUpdate = true;
  return { textura: tex, actualizar() {}, liberar() { tex.dispose(); } };
}

export const DOMO_VIVO = {
  geo: { rep: 6, anchoV: 1 / 6, alto: 0.5, centro: 0.3, sector: 0, az0: 0, medioSector: 0.1, borde: 0.04, aspecto: 16 / 9 } as GeoFranja,
  pesos: { mix: 0, staticMix: 1, remoteOn: 0, necesitaVideo: false } as PesosDomo,
  t: 0,
  subidas: 0,               // cuadros subidos a la GPU (diagnóstico: no sube con mix 0)
  fuente: null as FuenteVideoDomo | null,
  sesionDeFuente: null as RemoteSession | null,
  propia: null as { cv: HTMLCanvasElement; fuente: FuenteVideoDomo } | null,   // "Forzar video 100 %" sin sesión
  negro: null as THREE.DataTexture | null,
};

/** Textura de 1×1 negra para uRemoteTex mientras no hay fuente. */
export function texturaVacia(): THREE.DataTexture {
  if (!DOMO_VIVO.negro) {
    const t = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    t.colorSpace = THREE.NoColorSpace; t.needsUpdate = true;
    DOMO_VIVO.negro = t;
  }
  return DOMO_VIVO.negro;
}

const _ent = { activo: true, benchOn: true, forzar: "ninguno", pesoVideo: 0, haySesion: false };

type U = Record<string, THREE.IUniform>;
/** Escribe los uniforms Z83 del material del domo. Llamar al final del useFrame de DomeSky (uPortalF ya actualizado). */
export function aplicarDomoVivo(u: U): void {
  if (!u.uRemoteMix) return;
  const D = DOMO_VIVO;
  const dt = RELOJ_EXP.dtExp;   // 0 en la pausa central
  _ent.activo = DBG_DOMO_VIVO.ACTIVO;
  _ent.benchOn = DBG_RENDIMIENTO.SIS.videoDomo !== false;
  _ent.forzar = DBG_DOMO_VIVO.FORZAR;
  _ent.pesoVideo = DBG_MONO_VIVO.ACTIVO ? N5_STATE.leftProximity : 0;
  _ent.haySesion = SESSION.status === "active";
  const p = pesosDomo(_ent, D.pesos);
  u.uRemoteMix.value = p.mix;
  if (p.mix <= 0) return;   // nada más que hacer: el shader saltea la rama y no se sube ninguna textura

  D.t += dt;
  const F = u.uPortalF.value as THREE.Vector3;
  const g = geometriaFranja(DBG_DOMO_VIVO, Math.atan2(F.x, -F.z) / TAU, D.geo);
  (u.uVivoGeo.value as THREE.Vector4).set(g.rep, g.anchoV, g.alto, g.centro);
  (u.uVivoCob.value as THREE.Vector3).set(g.sector, g.az0, g.medioSector);
  u.uVivoBorde.value = g.borde;
  u.uVivoFondo.value = Math.max(0, Math.min(1, DBG_DOMO_VIVO.FONDO));
  u.uVivoT.value = D.t;
  (u.uEstatica.value as THREE.Vector3).set(DBG_DOMO_VIVO.ESTATICA_INTENSIDAD, DBG_DOMO_VIVO.ESTATICA_GRANO, DBG_DOMO_VIVO.ESTATICA_VELOCIDAD);
  u.uStaticMix.value = p.staticMix;
  u.uRemoteOn.value = p.remoteOn;

  if (!p.necesitaVideo) return;
  // fuente: la de la sesión si la hay; con "Forzar video" y sin sesión, un canvas de prueba propio
  let f: FuenteVideoDomo | null = null;
  if (_ent.haySesion) {
    if (D.sesionDeFuente !== SESSION) { D.fuente?.liberar(); D.fuente = crearFuenteVideo(SESSION); D.sesionDeFuente = SESSION; }
    f = D.fuente;
  }
  if (!f) {
    if (!D.propia && typeof document !== "undefined") {
      const cv = document.createElement("canvas"); cv.width = 640; cv.height = 360;
      D.propia = { cv, fuente: fuenteCanvas(cv, t => dibujarPatronVideo(cv, t), () => DBG_DOMO_VIVO.FPS) };
    }
    f = D.propia?.fuente ?? null;
  }
  if (!f) return;
  const antes = f.textura.version;
  f.actualizar(D.t, dt, true);
  if (f.textura.version !== antes) D.subidas++;
  if (u.uRemoteTex.value !== f.textura) u.uRemoteTex.value = f.textura;
}

/** Al desmontar DomeSky: libera texturas. */
export function liberarDomoVivo(): void {
  const D = DOMO_VIVO;
  D.fuente?.liberar(); D.fuente = null; D.sesionDeFuente = null;
  D.propia?.fuente.liberar(); D.propia = null;
  D.negro?.dispose(); D.negro = null;
}

export function textoEstadoDomoVivo(): string {
  const p = DOMO_VIVO.pesos;
  return `mezcla ${p.mix.toFixed(2)} · ${p.mix <= 0 ? "visualizador intacto" : p.remoteOn ? (p.staticMix > 0.5 ? "estática sobre el video" : "VIDEO de la sesión") : "ESTÁTICA (sin sesión)"} · ${DBG_DOMO_VIVO.COBERTURA === "sector" ? `sector ${DBG_DOMO_VIVO.SECTOR_ANCHO_DEG}°` : `banda × ${DBG_DOMO_VIVO.REPETICIONES}`} · cuadros subidos ${DOMO_VIVO.subidas}${DBG_DOMO_VIVO.FORZAR !== "ninguno" ? ` · forzado: ${DBG_DOMO_VIVO.FORZAR}` : ""}`;
}

if (DEBUG_ENABLED && typeof window !== "undefined") {
  (window as unknown as { __domoVivo?: object }).__domoVivo = { DOMO_VIVO, DBG_DOMO_VIVO, DBG_RENDIMIENTO, RENDIMIENTO, textoEstadoDomoVivo };
}
