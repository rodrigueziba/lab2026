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
import { DBG_RENDIMIENTO, DBG_PASTO, DBG_FRACTAL } from "@/lib/debugConfig";
import {
  crearEstadFrame, agregarFrame, resumir, crearResumen, escalonesPara, crearEstadoDpr, dprActual, reescalonar, tickDpr,
  crearEstadoBench, DPR_VIVO, iniciarBench, tickBench, cancelarBench, reporteBench, SISTEMAS, duracionBenchS, CALIENTA_S, MIDE_S,
} from "@/lib/rendimiento";
import { FLASH_STATE } from "@/lib/curtainFlash";
import { ENTRADA, bloquearMovimiento, liberarMovimiento } from "@/lib/entradaTelon";
import { PAUSA } from "@/lib/pausaExperiencia";
import { CK_STATE, irACheckpoint } from "@/lib/checkpoints";
import { PASTO } from "@/lib/pasto";
import { PASTO_RENDER } from "@/lib/pastoChunks";
import { DIA } from "@/lib/cicloDia";
// Z69: tiempo de GPU por pase, refresco por intervalos, ida y vuelta, perfiles de calidad
import { GPU_PASES, iniciarGpuPases, liberarGpuPases, finCuadroGpu, resumirGpu, textoGpuPases } from "@/lib/gpuPases";
import { estimarRefrescoIntervalos, pasosBenchIdaVuelta, combinarIdaVuelta, avisoCanvas, MAX_MUESTRAS } from "@/lib/rendimiento";
// Z72: objetivo según el refresco, escalón recordado y poses de medición
import { objetivosDpr, leerEscalon, guardarEscalon, indiceEscalon, type CfgDpr } from "@/lib/rendimiento";
import { PRISM_POS_UNIFORM } from "@/lib/prismUniforms";
import { hazPosXZEn } from "@/lib/haz";
import { leerPerfil, aplicarPerfil } from "@/lib/rendimientoPost";
import { FRACTAL_PERF } from "@/lib/prisma/fractalTexturaRender";

/** Lecturas para el panel (las actualiza este componente cada 0,5 s). */
export const RENDIMIENTO = {
  montado: false,
  fps: 0, media: 0, p95: 0, p99: 0, dpr: 1, dprDispositivo: 1, w: 0, h: 0,
  calls: 0, tris: 0, geos: 0, texs: 0, progs: 0,
  gpuNombre: "", timer: "sin medir", gpuMs: 0,
  escalon: "", escalones: "", cambios: 0, ultimoFpsEval: 0, bloqueadoPor: "",
  bench: "", benchActivo: false, reporte: "", estres: "",
  // Z69
  hz: 60, hzTexto: "", gpuPases: "", fractal: "", perfil: "", avisoCanvas: "",
  objetivo: 50, subir: 58, escalonGuardado: 0, pose: "",   // Z72
};
/** Z72: poses de medición del benchmark (botones del panel). */
export const POSES_BENCH = { aqui: "aquí (donde está la cámara)", prisma: "cerca del prisma (3 m)", luz1: "en la luz 1" } as const;
const RAZON_BENCH = "benchmark";

interface Timer { ext: { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number }; gl2: WebGL2RenderingContext; q: (WebGLQuery | null)[]; ocupada: boolean[]; i: number }

export default function RendimientoHost() {
  const { gl, scene, camera, setDpr } = useThree();
  const r = useRef({
    estad: crearEstadFrame(), res: crearResumen(), dpr: crearEstadoDpr([1]), bench: crearEstadoBench(),
    tUlt: -1, tPanel: 0, timer: null as Timer | null, gpuUlt: 0, gpuMs: new Float64Array(240), gpuN: 0, gpuI: 0,
    camPos: new THREE.Vector3(), camQ: new THREE.Quaternion(), sisPrevio: {} as Record<string, boolean>, dprPrevio: 1,
    claveEsc: "", estresPendiente: 0, aplicado: 1, calls: 0, tris: 0,
    // Z69: refresco (el mayor estimado en la sesión), buffer para ordenar, lista por pase de la línea base
    hzSesion: 0, tmpHz: new Float64Array(MAX_MUESTRAS), estHz: { hz: 60, grilla: 0, minimos: 0, n: 0, meseta: 0, fpsMeseta: 0 }, gpuPasesBase: "", fracAct: 0,
    // Z72: pose original (se restaura al terminar), configuración efectiva del DPR adaptativo y escalón guardado
    camPosOrig: new THREE.Vector3(), camQOrig: new THREE.Quaternion(), pose: "", xz: { x: 0, z: 0 },
    cfgEf: { ...DBG_RENDIMIENTO } as CfgDpr, obj: { objetivo: 50, subir: 58 }, escGuardado: 0,
    estresExtender: false,   // Z74
  });
  const terminarRef = useRef<(cancelado: boolean) => void>(() => {});

  // inicio: escalones, GPU, temporizador, info manual; eventos del panel
  useEffect(() => {
    const R = r.current;
    const dprDisp = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    R.dpr = crearEstadoDpr(escalonesPara(DBG_RENDIMIENTO, dprDisp));
    // Z72: arrancar en el último escalón estable guardado
    if (DBG_RENDIMIENTO.RECORDAR_ESCALON) {
      const g = leerEscalon(almacenLocal());
      if (g !== null) { R.dpr.idx = indiceEscalon(R.dpr.escalones, g); R.escGuardado = g; RENDIMIENTO.escalonGuardado = g; }
    }
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
      iniciarGpuPases(gl2, ext);   // Z69: cola aparte para la medición por pase
    } else {
      RENDIMIENTO.timer = esGl2 ? "no disponible: el navegador no expone EXT_disjoint_timer_query_webgl2 (Safari y Firefox no lo hacen; Chrome sí)" : "no disponible: sin WebGL2";
    }
    // Z69: perfil de calidad guardado (sin nada guardado quedan los valores de debugConfig)
    let almacen: Storage | null = null;
    try { almacen = window.localStorage; } catch { almacen = null; }
    const perfil = leerPerfil(almacen);
    if (perfil) aplicarPerfil(perfil, DBG_RENDIMIENTO, DBG_PASTO, DBG_FRACTAL);
    RENDIMIENTO.perfil = perfil ?? "";
    const autoPrevio = gl.info.autoReset;
    fijarAutoReset(gl, false);   // se reinicia una vez por cuadro (abajo)
    RENDIMIENTO.montado = true;

    const onBench = (e: Event) => {
      const B = R.bench;
      if (B.activo) return;
      // Z72: pose de medición (aquí, cerca del prisma o en la luz 1); la original se restaura al terminar
      R.camPosOrig.copy(camera.position); R.camQOrig.copy(camera.quaternion);
      const pose = ((e as CustomEvent).detail?.pose ?? "aqui") as keyof typeof POSES_BENCH;
      const pp = PRISM_POS_UNIFORM.value;
      if (pose === "prisma") { camera.position.set(0.3, 1.6, -2.9); camera.lookAt(pp.x, pp.y, pp.z); }
      else if (pose === "luz1") { hazPosXZEn(0, R.xz); camera.position.set(R.xz.x, 1.6, R.xz.z); camera.lookAt(pp.x, pp.y, pp.z); }
      R.pose = `${POSES_BENCH[pose] ?? POSES_BENCH.aqui} · cámara (${camera.position.x.toFixed(2)}, ${camera.position.y.toFixed(2)}, ${camera.position.z.toFixed(2)})${pose !== "aqui" ? ` mirando al prisma (${pp.x.toFixed(2)}, ${pp.y.toFixed(2)}, ${pp.z.toFixed(2)})` : ""}`;
      RENDIMIENTO.pose = R.pose;
      R.camPos.copy(camera.position); R.camQ.copy(camera.quaternion);
      R.sisPrevio = { ...DBG_RENDIMIENTO.SIS };
      R.dprPrevio = gl.getPixelRatio();
      bloquearMovimiento(RAZON_BENCH);
      iniciarBench(B, pasosBenchIdaVuelta(SISTEMAS), performance.now() / 1000);   // Z69: ida y vuelta
      R.gpuPasesBase = "";
      RENDIMIENTO.reporte = "";
    };
    const terminar = (cancelado: boolean) => {
      const B = R.bench;
      Object.assign(DBG_RENDIMIENTO.SIS, R.sisPrevio);
      aplicarDpr(setDpr, r.current, R.dprPrevio);
      camera.position.copy(R.camPosOrig); camera.quaternion.copy(R.camQOrig);   // Z72: vuelve a donde estaba
      liberarMovimiento(RAZON_BENCH);
      if (cancelado) { RENDIMIENTO.bench = "benchmark cancelado"; return; }
      // Z69: refresco = el mayor estimado en la sesión a partir de los intervalos de rAF (grilla de vsync y mínimos);
      // antes salía del tiempo medio de la línea base, que con carga da 60 en un monitor de 120 Hz
      const hz = R.hzSesion > 0 ? R.hzSesion : 60;
      const RD = DBG_RENDIMIENTO;
      RENDIMIENTO.reporte = reporteBench(combinarIdaVuelta(B.resultados), {
        gpu: RENDIMIENTO.gpuNombre, dpr: R.dprPrevio, px: `${RENDIMIENTO.w}×${RENDIMIENTO.h}`, refrescoHz: hz,
        timerGpu: R.timer !== null, canvasW: RENDIMIENTO.w, canvasH: RENDIMIENTO.h,
        metodoRefresco: `intervalos de rAF: meseta ${R.estHz.meseta || "-"} Hz (${(R.estHz.fpsMeseta ?? 0).toFixed(1)} FPS en las mejores ventanas), grilla ${R.estHz.grilla || "-"} Hz; el mayor de la sesión`,
        pose: R.pose,
        gpuPases: R.gpuPasesBase || undefined,
        config: `perfil ${RENDIMIENTO.perfil || "sin guardar"} · bloom ${RD.BLOOM_OPTIMIZADO ? `liviano ${RD.BLOOM_CALIDAD} (escala ${RD.BLOOM_ESCALA}, ${RD.BLOOM_NIVELES} niveles)` : "Unreal (como estaba)"} · pases ${RD.PASES_FUSIONADOS ? "fusionados" : "separados"} · AA ${RD.ANTIALIAS_MODO} · fractal ${DBG_FRACTAL.TEX_RES}/${DBG_FRACTAL.TEX_RES_CERCA} a ${DBG_FRACTAL.TEX_FPS} FPS en ≤ ${DBG_FRACTAL.TEX_REPARTIR} franjas · GPU ${RD.GPU_POR_PASE ? "por pase" : "por cuadro"}`,
        escena: `cámara (${camera.position.x.toFixed(1)}, ${camera.position.y.toFixed(1)}, ${camera.position.z.toFixed(1)}) · pasto p [${PASTO.p.map(v => v.toFixed(2)).join(", ")}] (${PASTO_RENDER.montado ? PASTO_RENDER.modo : "no montado"}) · tDia ${DIA.dia.toFixed(2)} (${DIA.fase}) · flags pasto: chunks ${on(DBG_RENDIMIENTO.PASTO_CHUNKS)} cull ${on(DBG_RENDIMIENTO.PASTO_CULL_PROGRESO)} lod ${on(DBG_RENDIMIENTO.PASTO_LOD)} lejano ${on(DBG_RENDIMIENTO.PASTO_LEJANO)} viento ${on(DBG_RENDIMIENTO.PASTO_VIENTO_BARATO)} descarte ${on(DBG_RENDIMIENTO.PASTO_DESCARTE_TEMPRANO)} mip ${on(DBG_RENDIMIENTO.PASTO_MIPMAPS)} · DIST_MAX_M ${DBG_PASTO.DIST_MAX_M} · CAPAS ${DBG_PASTO.CAPAS} · extensión ${PASTO.ext.toFixed(2)} (${PASTO.extFase})`,
      });
      RENDIMIENTO.bench = "benchmark terminado";
    };
    const onCancelar = () => { if (R.bench.activo) { cancelarBench(R.bench); terminar(true); } };
    const onForzar = (e: Event) => {
      const v = Number((e as CustomEvent).detail?.dpr ?? 0);
      R.dpr.forzado = Number.isFinite(v) && v > 0 ? v : 0;
    };
    const onEstres = (e: Event) => {
      // Z74: con detail.extender, además extiende el pasto hasta el borde del círculo (peor caso de la extensión)
      R.estresExtender = !!(e as CustomEvent).detail?.extender;
      const ev = R.estresExtender ? "alight:pasto-completar-extender" : "alight:pasto-completar";
      if (PASTO_RENDER.montado) { window.dispatchEvent(new CustomEvent(ev)); RENDIMIENTO.estres = R.estresExtender ? "4 cuartos completos + extensión" : "4 cuartos completos"; return; }
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
      liberarGpuPases();   // Z69
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
        window.dispatchEvent(new CustomEvent(R.estresExtender ? "alight:pasto-completar-extender" : "alight:pasto-completar"));
        RENDIMIENTO.estres = `4 cuartos completos${R.estresExtender ? " + extensión" : ""} (checkpoint 'visualizador')`;
      }
    }

    // benchmark
    const B = R.bench;
    if (B.activo) {
      const accion = tickBench(B, dtMs, R.gpuUlt, ahoraS);
      if (accion === "restaurar" || accion === "fin") {
        const prev = B.pasos[B.k - 1];
        if (prev.tipo === "sistema") DBG_RENDIMIENTO.SIS[prev.id] = R.sisPrevio[prev.id] !== false;
        if (prev.tipo === "base" && !R.gpuPasesBase && GPU_PASES.activo) R.gpuPasesBase = textoGpuPases();   // Z69
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
    // Z72: objetivo y umbral de subida según el refresco detectado (120 Hz → 57 y 90 FPS; 60 Hz → los de siempre)
    objetivosDpr(RENDIMIENTO.hz, cfg, R.obj);
    copiarCfgDpr(cfg, R.cfgEf, R.obj.objetivo, R.obj.subir);
    tickDpr(D, R.cfgEf, dtMs / 1000, ahoraS, bloqueo !== "");
    if (!B.activo && (bloqueo === "" || D.forzado > 0)) {
      const objetivo = dprActual(D);
      if (Math.abs(R.aplicado - objetivo) > 1e-3) { aplicarDpr(setDpr, r.current, objetivo); }
    }

    // dibujo del cuadro: info una vez por cuadro y temporizador de GPU
    // Z69: con GPU_POR_PASE la medición la hacen los pases (lib/gpuPases); la del cuadro entero queda apagada
    GPU_PASES.activo = DBG_RENDIMIENTO.GPU_POR_PASE && GPU_PASES.disponible;
    const T = R.timer, porCuadro = !GPU_PASES.activo;
    let q: WebGLQuery | null = null;
    if (T && porCuadro) {
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
    finCuadroGpu();   // Z69: recoge las consultas por pase listas (y cierra cualquier pase abierto)
    if (GPU_PASES.activo) R.gpuUlt = GPU_PASES.total;   // el benchmark usa la suma de los pases
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
      // Z69: por pase, refresco, aviso de canvas chico y fractal (textos cada 0,5 s, no por frame)
      resumirGpu();
      if (GPU_PASES.activo) { E.gpuPases = textoGpuPases(); E.gpuMs = GPU_PASES.total; } else E.gpuPases = "";
      estimarRefrescoIntervalos(R.estad.ms, R.estad.n, R.tmpHz, R.estHz, (R.estad.i - R.estad.n + MAX_MUESTRAS) % MAX_MUESTRAS);   // Z72: en orden
      if (R.estHz.n >= 30 && R.estHz.hz > R.hzSesion) R.hzSesion = R.estHz.hz;
      E.hz = R.hzSesion || R.estHz.hz;
      E.hzTexto = `${E.hz} Hz (meseta ${R.estHz.meseta || "-"} · ${(R.estHz.fpsMeseta ?? 0).toFixed(1)} FPS, grilla ${R.estHz.grilla || "-"}; cuadros a ${E.hz}, ${(E.hz / 2).toFixed(0)}, ${(E.hz / 3).toFixed(0)}, ${(E.hz / 4).toFixed(0)} FPS)`;
      E.objetivo = R.obj.objetivo; E.subir = R.obj.subir;
      // Z72: guardar el escalón cuando lleva 20 s sin cambiar (no forzado, sin benchmark)
      if (cfg.RECORDAR_ESCALON && cfg.DPR_AUTO && D.forzado <= 0 && !B.activo && ahoraS - D.tCambio > 20) {
        const v = dprActual(D);
        if (v !== R.escGuardado && guardarEscalon(almacenLocal(), v)) { R.escGuardado = v; E.escalonGuardado = v; }
      }
      E.avisoCanvas = avisoCanvas(c.width, c.height);
      const F = FRACTAL_PERF, act = F.actualizaciones - R.fracAct;
      R.fracAct = F.actualizaciones;
      E.fractal = `${(act * 2).toFixed(0)} act./s · ${F.franjas} franja(s) · res ${F.res} · CPU ${F.cpuMsFranja.toFixed(2)} ms/franja${GPU_PASES.activo ? ` · GPU ${GPU_PASES.fractalPorActualizacion.toFixed(2)} ms/franja` : ""}`;
      E.escalon = D.forzado > 0 ? `forzado ${D.forzado}` : `${dprActual(D)} (${cfg.DPR_AUTO ? "auto" : "fijo"})`;
      E.escalones = D.escalones.join(" · "); E.cambios = D.cambios; E.ultimoFpsEval = D.ultimoFps; E.bloqueadoPor = bloqueo;
      E.benchActivo = B.activo;
    }
  }, 1);

  return null;
}

const on = (b: boolean) => (b ? "on" : "off");
/** Z72: localStorage sin romper el render del servidor ni navegadores que lo bloquean. */
function almacenLocal(): Storage | null { try { return typeof window !== "undefined" ? window.localStorage : null; } catch { return null; } }
/** Z72: copia la configuración del DPR adaptativo con el objetivo y el umbral de subida efectivos (sin allocations). */
function copiarCfgDpr(src: CfgDpr, dst: CfgDpr, objetivo: number, subir: number): void {
  dst.DPR_MAX = src.DPR_MAX; dst.DPR_MIN = src.DPR_MIN; dst.DPR_AUTO = src.DPR_AUTO; dst.EVAL_S = src.EVAL_S; dst.SUBIR_S = src.SUBIR_S;
  dst.ENTRE_CAMBIOS_S = src.ENTRE_CAMBIOS_S; dst.REBOTE_S = src.REBOTE_S; dst.REBOTE_VEDA_S = src.REBOTE_VEDA_S;
  dst.OBJETIVO_FPS = objetivo; dst.SUBIR_FPS = subir;
}
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
