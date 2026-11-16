"use client";
// Z66: medición de rendimiento, resolución adaptativa y benchmark (dentro del <Canvas>; lógica pura en lib/rendimiento.ts).
// Toma el dibujo del cuadro (useFrame con prioridad 1: R3F deja de dibujar solo y lo hace este componente, al final de
// todos los useFrame), así puede:
//  · reiniciar renderer.info una vez por cuadro (el composer dibuja varias veces: con autoReset solo quedaba el último pase)
//  · medir el tiempo de GPU del cuadro con EXT_disjoint_timer_query_webgl2 (consultas en anillo, sin bloquear)
//  · congelar la cámara durante el benchmark (se reaplica la pose guardada antes de dibujar)
// El DPR se cambia con setDpr de R3F (el Canvas, el composer y el CRT lo siguen); nunca durante el destello, la entrada,
// la pausa, un salto de checkpoint ni el benchmark (salvo sus pasos de DPR). Sin allocations por frame.
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { DBG_RENDIMIENTO, DBG_PASTO } from "@/lib/debugConfig";
import {
  crearEstadFrame, agregarFrame, resumir, crearResumen, escalonesPara, crearEstadoDpr, dprActual, reescalonar, tickDpr,
  crearEstadoBench, pasosBench, DPR_VIVO, iniciarBench, tickBench, cancelarBench, reporteBench, SISTEMAS, duracionBenchS, CALIENTA_S, MIDE_S,
} from "@/lib/rendimiento";
import { FLASH_STATE } from "@/lib/curtainFlash";
import { ENTRADA, bloquearMovimiento, liberarMovimiento } from "@/lib/entradaTelon";
import { PAUSA } from "@/lib/pausaExperiencia";
import { CK_STATE, irACheckpoint } from "@/lib/checkpoints";
import { PASTO } from "@/lib/pasto";
import { PASTO_RENDER } from "@/lib/pastoChunks";
import { DIA } from "@/lib/cicloDia";

/** Lecturas para el panel (las actualiza este componente cada 0,5 s). */
export const RENDIMIENTO = {
  montado: false,
  fps: 0, media: 0, p95: 0, p99: 0, dpr: 1, dprDispositivo: 1, w: 0, h: 0,
  calls: 0, tris: 0, geos: 0, texs: 0, progs: 0,
  gpuNombre: "", timer: "sin medir", gpuMs: 0,
  escalon: "", escalones: "", cambios: 0, ultimoFpsEval: 0, bloqueadoPor: "",
  bench: "", benchActivo: false, reporte: "", estres: "",
};
const RAZON_BENCH = "benchmark";

interface Timer { ext: { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number }; gl2: WebGL2RenderingContext; q: (WebGLQuery | null)[]; ocupada: boolean[]; i: number }

export default function RendimientoHost() {
  const { gl, scene, camera, setDpr } = useThree();
  const r = useRef({
    estad: crearEstadFrame(), res: crearResumen(), dpr: crearEstadoDpr([1]), bench: crearEstadoBench(),
    tUlt: -1, tPanel: 0, timer: null as Timer | null, gpuUlt: 0, gpuMs: new Float64Array(240), gpuN: 0, gpuI: 0,
    camPos: new THREE.Vector3(), camQ: new THREE.Quaternion(), sisPrevio: {} as Record<string, boolean>, dprPrevio: 1,
    claveEsc: "", estresPendiente: 0, aplicado: 1, calls: 0, tris: 0,
  });
  const terminarRef = useRef<(cancelado: boolean) => void>(() => {});

  // inicio: escalones, GPU, temporizador, info manual; eventos del panel
  useEffect(() => {
    const R = r.current;
    const dprDisp = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    R.dpr = crearEstadoDpr(escalonesPara(DBG_RENDIMIENTO, dprDisp));
    R.aplicado = gl.getPixelRatio(); DPR_VIVO.v = R.aplicado;
    RENDIMIENTO.dprDispositivo = dprDisp;
    const ctx = gl.getContext();
    try {
      const dbg = ctx.getExtension("WEBGL_debug_renderer_info");
      RENDIMIENTO.gpuNombre = dbg ? String(ctx.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : String(ctx.getParameter(ctx.RENDERER)) + " (nombre real oculto por el navegador)";
    } catch { RENDIMIENTO.gpuNombre = "desconocido"; }
    const esGl2 = typeof WebGL2RenderingContext !== "undefined" && ctx instanceof WebGL2RenderingContext;
    const ext = esGl2 ? ctx.getExtension("EXT_disjoint_timer_query_webgl2") : null;
    if (ext && esGl2) {
      const gl2 = ctx as WebGL2RenderingContext;
      R.timer = { ext, gl2, q: [gl2.createQuery(), gl2.createQuery(), gl2.createQuery(), gl2.createQuery()], ocupada: [false, false, false, false], i: 0 };
      RENDIMIENTO.timer = "disponible";
    } else {
      RENDIMIENTO.timer = esGl2 ? "no disponible: el navegador no expone EXT_disjoint_timer_query_webgl2 (Safari y Firefox no lo hacen; Chrome sí)" : "no disponible: sin WebGL2";
    }
    const autoPrevio = gl.info.autoReset;
    fijarAutoReset(gl, false);   // se reinicia una vez por cuadro (abajo)
    RENDIMIENTO.montado = true;

    const onBench = () => {
      const B = R.bench;
      if (B.activo) return;
      R.camPos.copy(camera.position); R.camQ.copy(camera.quaternion);
      R.sisPrevio = { ...DBG_RENDIMIENTO.SIS };
      R.dprPrevio = gl.getPixelRatio();
      bloquearMovimiento(RAZON_BENCH);
      iniciarBench(B, pasosBench(SISTEMAS), performance.now() / 1000);
      RENDIMIENTO.reporte = "";
    };
    const terminar = (cancelado: boolean) => {
      const B = R.bench;
      Object.assign(DBG_RENDIMIENTO.SIS, R.sisPrevio);
      aplicarDpr(setDpr, r.current, R.dprPrevio);
      liberarMovimiento(RAZON_BENCH);
      if (cancelado) { RENDIMIENTO.bench = "benchmark cancelado"; return; }
      // refresco del monitor: el percentil 10 de los cuadros de la línea base (sin carga, cae en el período de vsync)
      const base = B.resultados[0];
      const hz = base ? estimarRefresco(base.media) : 60;
      RENDIMIENTO.reporte = reporteBench(B.resultados, {
        gpu: RENDIMIENTO.gpuNombre, dpr: R.dprPrevio, px: `${RENDIMIENTO.w}×${RENDIMIENTO.h}`, refrescoHz: hz,
        timerGpu: R.timer !== null,
        escena: `cámara (${camera.position.x.toFixed(1)}, ${camera.position.y.toFixed(1)}, ${camera.position.z.toFixed(1)}) · pasto p [${PASTO.p.map(v => v.toFixed(2)).join(", ")}] (${PASTO_RENDER.montado ? PASTO_RENDER.modo : "no montado"}) · tDia ${DIA.dia.toFixed(2)} (${DIA.fase}) · flags pasto: chunks ${on(DBG_RENDIMIENTO.PASTO_CHUNKS)} cull ${on(DBG_RENDIMIENTO.PASTO_CULL_PROGRESO)} lod ${on(DBG_RENDIMIENTO.PASTO_LOD)} lejano ${on(DBG_RENDIMIENTO.PASTO_LEJANO)} viento ${on(DBG_RENDIMIENTO.PASTO_VIENTO_BARATO)} descarte ${on(DBG_RENDIMIENTO.PASTO_DESCARTE_TEMPRANO)} mip ${on(DBG_RENDIMIENTO.PASTO_MIPMAPS)} · DIST_MAX_M ${DBG_PASTO.DIST_MAX_M} · CAPAS ${DBG_PASTO.CAPAS}`,
      });
      RENDIMIENTO.bench = "benchmark terminado";
    };
    const onCancelar = () => { if (R.bench.activo) { cancelarBench(R.bench); terminar(true); } };
    const onForzar = (e: Event) => {
      const v = Number((e as CustomEvent).detail?.dpr ?? 0);
      R.dpr.forzado = Number.isFinite(v) && v > 0 ? v : 0;
    };
    const onEstres = () => {
      if (PASTO_RENDER.montado) { window.dispatchEvent(new CustomEvent("alight:pasto-completar")); RENDIMIENTO.estres = "4 cuartos completos"; return; }
      // el pasto vive con el visualizador: saltar al checkpoint y completar cuando esté montado
      if (irACheckpoint("visualizador")) { R.estresPendiente = 1; RENDIMIENTO.estres = "yendo al checkpoint 'visualizador'…"; }
      else RENDIMIENTO.estres = "el pasto no está montado y los checkpoints están deshabilitados: activá el visualizador primero";
    };
    window.addEventListener("alight:rend-bench", onBench);
    window.addEventListener("alight:rend-bench-cancelar", onCancelar);
    window.addEventListener("alight:rend-forzar-dpr", onForzar);
    window.addEventListener("alight:rend-estres", onEstres);
    terminarRef.current = terminar;
    return () => {
      window.removeEventListener("alight:rend-bench", onBench);
      window.removeEventListener("alight:rend-bench-cancelar", onCancelar);
      window.removeEventListener("alight:rend-forzar-dpr", onForzar);
      window.removeEventListener("alight:rend-estres", onEstres);
      if (R.bench.activo) { cancelarBench(R.bench); Object.assign(DBG_RENDIMIENTO.SIS, R.sisPrevio); }
      liberarMovimiento(RAZON_BENCH);
      if (R.timer) for (const q of R.timer.q) if (q) R.timer.gl2.deleteQuery(q);
      R.timer = null;
      fijarAutoReset(gl, autoPrevio);
      RENDIMIENTO.montado = false;
    };
  }, [gl, camera, setDpr]);

  useFrame((state) => {
    const R = r.current, ahora = performance.now(), ahoraS = ahora / 1000;
    const dtMs = R.tUlt < 0 ? 0 : ahora - R.tUlt;
    R.tUlt = ahora;
    if (dtMs > 0) agregarFrame(R.estad, dtMs, ahoraS);

    // escena de estrés pendiente (tras el salto de checkpoint: esperar a que el pasto esté montado y quieto)
    if (R.estresPendiente > 0 && CK_STATE.fase !== "aplicando" && PASTO_RENDER.montado) {
      if (++R.estresPendiente > 30) {
        R.estresPendiente = 0;
        window.dispatchEvent(new CustomEvent("alight:pasto-completar"));
        RENDIMIENTO.estres = "4 cuartos completos (checkpoint 'visualizador')";
      }
    }

    // benchmark
    const B = R.bench;
    if (B.activo) {
      const accion = tickBench(B, dtMs, R.gpuUlt, ahoraS);
      if (accion === "restaurar" || accion === "fin") {
        const prev = B.pasos[B.k - 1];
        if (prev.tipo === "sistema") DBG_RENDIMIENTO.SIS[prev.id] = R.sisPrevio[prev.id] !== false;
        if (accion === "fin") terminarRef.current(false);
      }
      if (B.activo) {
        const paso = B.pasos[B.k];
        if (paso.tipo === "sistema") DBG_RENDIMIENTO.SIS[paso.id] = false;
        const d = paso.tipo === "dpr" ? paso.dpr : R.dprPrevio;
        if (Math.abs(R.aplicado - d) > 1e-3) { aplicarDpr(setDpr, r.current, d); }
        // cámara quieta: la pose guardada se reaplica antes de dibujar
        state.camera.position.copy(R.camPos); state.camera.quaternion.copy(R.camQ);
        const total = duracionBenchS(B.pasos.length), hecho = B.k * (CALIENTA_S + MIDE_S) + Math.min(CALIENTA_S + MIDE_S, ahoraS - B.t0 + (B.fase === "midiendo" ? CALIENTA_S : 0));
        RENDIMIENTO.bench = `${paso.etiqueta} (${B.fase}) · paso ${B.k + 1}/${B.pasos.length} · ${Math.round((100 * hecho) / total)} %`;
      }
    }

    // resolución adaptativa (no durante estados bloqueados ni el benchmark)
    const D = R.dpr, cfg = DBG_RENDIMIENTO;
    const clave = `${cfg.DPR_MAX}|${cfg.DPR_MIN}`;
    if (clave !== R.claveEsc) { R.claveEsc = clave; reescalonar(D, escalonesPara(cfg, RENDIMIENTO.dprDispositivo)); }
    const bloqueo = FLASH_STATE.fase !== "inactivo" ? "destello" : ENTRADA.fase !== "inactiva" ? "entrada" : PAUSA.activa ? "pausa"
      : CK_STATE.fase === "aplicando" ? "checkpoint" : B.activo ? "benchmark" : "";
    tickDpr(D, cfg, dtMs / 1000, ahoraS, bloqueo !== "");
    if (!B.activo && (bloqueo === "" || D.forzado > 0)) {
      const objetivo = dprActual(D);
      if (Math.abs(R.aplicado - objetivo) > 1e-3) { aplicarDpr(setDpr, r.current, objetivo); }
    }

    // dibujo del cuadro: info una vez por cuadro y temporizador de GPU
    const T = R.timer;
    let q: WebGLQuery | null = null;
    if (T) {
      // recoger resultados listos (sin bloquear)
      const disjunto = T.gl2.getParameter(T.ext.GPU_DISJOINT_EXT);
      for (let k = 0; k < T.q.length; k++) {
        const qq = T.q[k];
        if (!T.ocupada[k] || !qq) continue;
        if (!T.gl2.getQueryParameter(qq, T.gl2.QUERY_RESULT_AVAILABLE)) continue;
        const ns = T.gl2.getQueryParameter(qq, T.gl2.QUERY_RESULT) as number;
        T.ocupada[k] = false;
        if (!disjunto) { R.gpuUlt = ns / 1e6; R.gpuMs[R.gpuI] = R.gpuUlt; R.gpuI = (R.gpuI + 1) % R.gpuMs.length; if (R.gpuN < R.gpuMs.length) R.gpuN++; }
      }
      for (let k = 0; k < T.q.length; k++) { const j = (T.i + k) % T.q.length; if (!T.ocupada[j]) { q = T.q[j]; T.i = (j + 1) % T.q.length; T.ocupada[j] = true; break; } }
      if (q) T.gl2.beginQuery(T.ext.TIME_ELAPSED_EXT, q);
    }
    gl.info.reset();
    gl.render(scene, state.camera);
    if (T && q) T.gl2.endQuery(T.ext.TIME_ELAPSED_EXT);
    R.calls = gl.info.render.calls; R.tris = gl.info.render.triangles;

    // lecturas del panel cada 0,5 s
    if (ahora - R.tPanel >= 500) {
      R.tPanel = ahora;
      const s = resumir(R.estad, ahoraS, 5, R.res);
      const E = RENDIMIENTO, c = gl.domElement;
      E.fps = s.fps1s; E.media = s.media; E.p95 = s.p95; E.p99 = s.p99;
      E.dpr = gl.getPixelRatio(); E.w = c.width; E.h = c.height;
      E.calls = R.calls; E.tris = R.tris; E.geos = gl.info.memory.geometries; E.texs = gl.info.memory.textures;
      E.progs = gl.info.programs?.length ?? 0;
      if (T) {
        let suma = 0; for (let k = 0; k < R.gpuN; k++) suma += R.gpuMs[k];
        E.gpuMs = R.gpuN ? suma / R.gpuN : 0;
      }
      E.escalon = D.forzado > 0 ? `forzado ${D.forzado}` : `${dprActual(D)} (${cfg.DPR_AUTO ? "auto" : "fijo"})`;
      E.escalones = D.escalones.join(" · "); E.cambios = D.cambios; E.ultimoFpsEval = D.ultimoFps; E.bloqueadoPor = bloqueo;
      E.benchActivo = B.activo;
    }
  }, 1);

  return null;
}

const on = (b: boolean) => (b ? "on" : "off");
/** Un solo lugar para cambiar el DPR: R3F (Canvas y renderer), DPR_VIVO (prop del Canvas) y el valor aplicado. */
function aplicarDpr(setDpr: (v: number) => void, R: { aplicado: number }, v: number): void {
  setDpr(v); R.aplicado = v; DPR_VIVO.v = v;
}
/** renderer.info.autoReset (fuera del componente: el renderer es estable y se configura en el lugar). */
function fijarAutoReset(r: THREE.WebGLRenderer, v: boolean): void { r.info.autoReset = v; }
/** Refresco del monitor más probable para un tiempo de frame medio (vsync: 30, 60, 75, 90, 100, 120, 144, 165, 240 Hz). */
export function estimarRefresco(mediaMs: number): number {
  const hz = mediaMs > 0 ? 1000 / mediaMs : 60, lista = [30, 60, 75, 90, 100, 120, 144, 165, 240];
  let mejor = 60; for (const h of lista) if (h >= hz * 0.97) { mejor = h; break; }
  return hz > 245 ? 240 : mejor;
}
