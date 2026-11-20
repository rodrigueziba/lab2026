"use client";
// Z105: modo de espera. Tras DBG_ESPERA.IDLE_S sin entrada (y con la cámara en control libre: lib/esperaCamaraLibre.ts),
// la cámara se desprende del usuario, sube y se inclina hasta plano cenital a los 9 m, sigue subiendo hasta encuadrar
// el escenario completo y se detiene; en el lugar del usuario aparece la esfera del easter egg del footer
// (lib/esferaFooter.ts). Cualquier entrada la hace bajar por la misma trayectoria hasta los ojos de la esfera; W A S D
// mueven la esfera (misma caminata y misma función de límites que el usuario). Lógica pura en lib/esperaCamara.ts.
//
// Cómo toma la cámara sin tocar a los demás sistemas (tres pasos por cuadro, con prioridades de useFrame):
//   −1  lógica: la cámara queda en los OJOS de la esfera con la orientación del despegue. Todos los sistemas que leen
//       camera.position (haces, sectores, monolitos, atriles, tarima, área del camino LUZ, pasto, telón…) ven al
//       usuario donde está la esfera, y los giros del mouse acumulados se descartan.
//   0,5 justo antes de dibujar (RendimientoHost dibuja en prioridad 1): pose elevada + niebla compensada.
//   2   después de dibujar: vuelve a la pose de la esfera (y con ESCUCHA_EN_ESFERA el oyente de audio, hijo de la
//       cámara, vuelve con ella).
// Player (ThreeScene) no mueve la cámara mientras ESPERA.modo (una línea). Sin allocations por cuadro; limpia al desmontar.
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { DBG_ESPERA, DBG_MOV, DBG_RENDIMIENTO, DBG_LAYOUT, DBG_SILLAS, DEBUG_ENABLED } from "@/lib/debugConfig";
import {
  crearEstadoEspera, reiniciarEspera, avanzarEspera, alturaDeEncuadre, alturaFinalEfectiva, poseDeCamara, crearPose,
  radioAEncuadrar, circuloEscenario, crearEsfera, avanzarEsfera, escalaEsfera, TEXTO_ESPERA_ENTRA, TEXTO_ESPERA_SALE,
  type EntradasEspera, type TeclasEsfera,
} from "@/lib/esperaCamara";
import { camaraLibre } from "@/lib/esperaCamaraLibre";
import { moverConLimites } from "@/lib/caminoLuz";
import { posicionInicial, anclarTelon } from "@/lib/inicioEscena";
import { zonaSillasEn, centroSillasEn, monolitoEn, TARIMA_CENTRO } from "@/lib/layoutSala";
import { ATRIL_BAJO } from "@/lib/atrilBajo";
import { ATRIL_SINTE } from "@/lib/atrilSinte";
import { ATRIL_SAMPLER } from "@/lib/atrilSampler";
import { ATRIL_RITMOS } from "@/lib/ritmos";
import { SPH_VERT, SPH_FRAG, SPH_REFRACTION, SPH_FRACTAL_SPEED, SPH_FRACTAL_ITER, SPH_FRACTAL_SCALE } from "@/lib/esferaFooter";
import { RENDIMIENTO } from "./RendimientoHost";

/** Estado de módulo (lo leen el menú de debug y Player). Se reinicia al montar. */
export const ESPERA = crearEstadoEspera();
export const ESPERA_DIAG = {
  motivo: "" as string, altura: 0, pitchDeg: 0, alturaEncuadre: 0, radio: 0, cx: 0, cz: 0,
  esferaX: 0, esferaZ: 0, recorrido: 0, escala: 1, msCuadro: 0, reducir: false, oculto: false,
};

// La esfera del footer con dos agregados para el mundo 3D (el footer no cambia): (1) el fractal usa la normal del
// OBJETO, así gira con la esfera cuando rueda (con la normal de vista, una esfera que rueda se vería quieta);
// (2) uFade multiplica el alfa (aparición y retiro). El fondo refractado es el color del fondo del footer.
const VERT_ESFERA = SPH_VERT
  .replace("varying vec3 vNormal;", "varying vec3 vNormal; varying vec3 vObjN;")
  .replace("vNormal=normalize(normalMatrix*normal);", "vNormal=normalize(normalMatrix*normal); vObjN=normal;");
const FRAG_ESFERA = SPH_FRAG
  .replace("varying vec3 vNormal,vViewDir,vWorldPos;", "varying vec3 vNormal,vViewDir,vWorldPos; varying vec3 vObjN; uniform float uFade;")
  .replace("vec2 du=rot2(vNormal.xy,", "vec2 du=rot2(vObjN.xy,")
  .replace("gl_FragColor=vec4(col,clamp(al,0.,1.));", "gl_FragColor=vec4(col,clamp(al,0.,1.)*uFade);");
export const ESFERA_SHADER_OK = VERT_ESFERA.includes("vObjN=normal;") && FRAG_ESFERA.includes("rot2(vObjN.xy,") && FRAG_ESFERA.includes("*uFade);");

const _en: EntradasEspera = { entrada: false, bloqueado: false, pausado: false, oculto: false, reducir: false, forzar: false, salir: false, abortar: false };
const N_PUNTOS = 12;
// todo lo que se reutiliza por cuadro (estado de módulo, sin allocations; una sola instancia del componente)
const R = {
  pose0: crearPose(), render: crearPose(), esfera: crearEsfera(), tmp: { x: 0, z: 0 }, xz: { x: 0, z: 0 },
  circ: { cx: 0, cz: 0, r: 0 }, xs: new Float32Array(N_PUNTOS), zs: new Float32Array(N_PUNTOS),
  q0: new THREE.Quaternion(), euler: new THREE.Euler(0, 0, 0, "YXZ"), eje: new THREE.Vector3(), qr: new THREE.Quaternion(),
  spawn: [0, 0, 0] as number[], tiempo: 0, swap: false, niebla: false, densidad: 0, escala: 1,
};
const UNIF = {
  uBgTex: { value: null as THREE.Texture | null }, uRes: { value: new THREE.Vector2(1, 1) },
  uTime: { value: 0 }, uTint: { value: new THREE.Color(0.3, 0.65, 1.0) },
  uBeat: { value: 0 }, uRMS: { value: 0 }, uBass: { value: 0 }, uMid: { value: 0 }, uAir: { value: 0 }, uSub: { value: 0 },
  uRefraction: { value: SPH_REFRACTION }, uFractalSpeed: { value: SPH_FRACTAL_SPEED }, uFractalIter: { value: SPH_FRACTAL_ITER },
  uFractalIntensity: { value: DBG_ESPERA.FRACTAL }, uFractalScale: { value: SPH_FRACTAL_SCALE }, uPalette: { value: 0 },
  uFade: { value: 0 },
};
const GRACIA_FORZAR_S = 1.5;   // tras "Forzar modo de espera ahora", el mouse que vuelve del menú no cuenta

export default function EsperaCamara() {
  const { camera, gl, size } = useThree();
  const esferaRef = useRef<THREE.Mesh>(null);
  const guiaRef = useRef<THREE.LineLoop>(null);
  const vivo = useRef<HTMLDivElement | null>(null);
  const I = useRef({ entrada: false, mouse: 0, forzar: false, salir: false, reducir: false, gracia: 0 });
  const teclas = useRef<TeclasEsfera>({ w: false, a: false, s: false, d: false });

  const recursos = useMemo(() => {
    const geo = new THREE.SphereGeometry(1, 48, 32);
    const fondo = new THREE.DataTexture(new Uint8Array([2, 8, 23, 255]), 1, 1, THREE.RGBAFormat);   // fondo del footer (#020817)
    fondo.needsUpdate = true;
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT_ESFERA, fragmentShader: FRAG_ESFERA,
      transparent: true, depthWrite: false, depthTest: true, blending: THREE.NormalBlending, side: THREE.FrontSide,
      uniforms: UNIF,
    });
    const pts = new Float32Array(128 * 3);
    for (let i = 0; i < 128; i++) { const a = (i / 128) * Math.PI * 2; pts[i * 3] = Math.cos(a); pts[i * 3 + 2] = Math.sin(a); }
    const guiaGeo = new THREE.BufferGeometry();
    guiaGeo.setAttribute("position", new THREE.BufferAttribute(pts, 3));
    const guiaMat = new THREE.LineBasicMaterial({ color: "#FF9A1F", transparent: true, opacity: 0.85, depthTest: false });
    return { geo, mat, fondo, guiaGeo, guiaMat };
  }, []);

  useEffect(() => { gl.getDrawingBufferSize(UNIF.uRes.value); }, [gl, size]);

  useEffect(() => {
    reiniciarEspera(ESPERA);
    const sp = posicionInicial(); R.spawn[0] = sp[0]; R.spawn[1] = sp[1]; R.spawn[2] = sp[2];
    UNIF.uBgTex.value = recursos.fondo;
    const div = document.createElement("div");
    div.setAttribute("aria-live", "polite"); div.setAttribute("role", "status");
    div.style.cssText = "position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0";
    document.body.appendChild(div); vivo.current = div;
    const enDebug = (t: EventTarget | null) => !!(t as Element | null)?.closest?.("[data-debug-panel]");
    const marca = () => { I.current.entrada = true; };
    const onMouse = (e: MouseEvent) => { I.current.mouse += Math.abs(e.movementX || 0) + Math.abs(e.movementY || 0); };
    const onClic = (e: Event) => { if (!enDebug(e.target)) marca(); };
    const onTecla = (e: KeyboardEvent) => {
      marca();
      const t = teclas.current;
      if (e.code === "KeyW") t.w = true; else if (e.code === "KeyA") t.a = true; else if (e.code === "KeyS") t.s = true; else if (e.code === "KeyD") t.d = true;
    };
    const onSuelta = (e: KeyboardEvent) => {
      const t = teclas.current;
      if (e.code === "KeyW") t.w = false; else if (e.code === "KeyA") t.a = false; else if (e.code === "KeyS") t.s = false; else if (e.code === "KeyD") t.d = false;
    };
    const onBlur = () => { const t = teclas.current; t.w = t.a = t.s = t.d = false; };
    const onForzar = () => { I.current.forzar = true; I.current.gracia = GRACIA_FORZAR_S; };
    const onSalir = () => { I.current.salir = true; };
    const mq = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    const onReducir = () => { I.current.reducir = !!mq?.matches; };
    onReducir();
    const op = { capture: true, passive: true } as const;
    window.addEventListener("mousemove", onMouse, op);
    window.addEventListener("pointerdown", onClic, op);
    window.addEventListener("wheel", onClic, op);
    window.addEventListener("touchstart", onClic, op);
    window.addEventListener("keydown", onTecla, op);
    window.addEventListener("keyup", onSuelta, op);
    window.addEventListener("blur", onBlur);
    window.addEventListener("alight:espera-forzar", onForzar);
    window.addEventListener("alight:espera-salir", onSalir);
    window.addEventListener("alight:espera-entrada", marca);
    mq?.addEventListener?.("change", onReducir);
    const w = window as unknown as { __espera?: object };
    if (DEBUG_ENABLED) w.__espera = { estado: ESPERA, diag: ESPERA_DIAG, rendimiento: RENDIMIENTO };
    return () => {
      window.removeEventListener("mousemove", onMouse, op);
      window.removeEventListener("pointerdown", onClic, op);
      window.removeEventListener("wheel", onClic, op);
      window.removeEventListener("touchstart", onClic, op);
      window.removeEventListener("keydown", onTecla, op);
      window.removeEventListener("keyup", onSuelta, op);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("alight:espera-forzar", onForzar);
      window.removeEventListener("alight:espera-salir", onSalir);
      window.removeEventListener("alight:espera-entrada", marca);
      mq?.removeEventListener?.("change", onReducir);
      if (DEBUG_ENABLED) delete w.__espera;
      div.remove(); vivo.current = null;
      // si se desmonta en pleno modo (checkpoint), la cámara queda en los ojos de la esfera (la pose de la lógica)
      if (ESPERA.modo) { camera.position.set(R.esfera.x, R.pose0.y, R.esfera.z); camera.quaternion.copy(R.q0); camera.updateMatrixWorld(true); }
      reiniciarEspera(ESPERA);
      recursos.geo.dispose(); recursos.mat.dispose(); recursos.fondo.dispose(); recursos.guiaGeo.dispose(); recursos.guiaMat.dispose();
      UNIF.uBgTex.value = null;
    };
  }, [camera, recursos]);

  // ── −1: lógica ────────────────────────────────────────────────────────────
  useFrame((state, dt) => {
    const t0 = performance.now();
    const D = DBG_ESPERA, cam = state.camera as THREE.PerspectiveCamera, In = I.current;
    const apagado = !D.ACTIVO || DBG_RENDIMIENTO.SIS.esperaCamara === false;
    const motivo = apagado ? "desactivado" : camaraLibre(D.EN_TELON, RENDIMIENTO.benchActivo);
    if (In.gracia > 0) { In.gracia -= Math.min(dt, 0.1); In.entrada = false; In.mouse = 0; }
    _en.entrada = In.entrada || In.mouse > D.UMBRAL_MOUSE_PX;
    _en.pausado = motivo === "pausa" && ESPERA.modo;
    _en.bloqueado = motivo !== "";
    _en.abortar = ESPERA.modo && motivo !== "" && motivo !== "pausa";
    _en.oculto = document.hidden || !document.hasFocus();
    _en.reducir = D.RESPETAR_REDUCIR_MOVIMIENTO && In.reducir;
    _en.forzar = In.forzar && !apagado; _en.salir = In.salir;
    In.entrada = false; In.mouse = 0; In.forzar = false; In.salir = false;
    const E = avanzarEspera(ESPERA, dt, _en, D);
    const esf = R.esfera;

    if (E.despego) {
      // pose del despegue: posición de los ojos, yaw e inclinación; la esfera aparece en el lugar del usuario
      R.pose0.x = cam.position.x; R.pose0.y = cam.position.y; R.pose0.z = cam.position.z;
      R.euler.setFromQuaternion(cam.quaternion, "YXZ");
      R.pose0.yaw = R.euler.y; R.pose0.pitch = R.euler.x;
      R.q0.setFromEuler(R.euler.set(R.pose0.pitch, R.pose0.yaw, 0, "YXZ"));
      esf.x = cam.position.x; esf.z = cam.position.z; esf.recorrido = 0;
      esferaRef.current?.quaternion.identity();
    }
    if (vivo.current && E.anunciarEntrada) vivo.current.textContent = TEXTO_ESPERA_ENTRA;
    if (vivo.current && E.anunciarSalida) vivo.current.textContent = TEXTO_ESPERA_SALE;

    // círculo del escenario: inicio, bordes del telón, tarima, sillas, monolitos e instrumentos (12 puntos)
    if (E.modo || D.GUIA) {
      const A = anclarTelon(), mitad = DBG_SILLAS.curtainWidthM / 2, xs = R.xs, zs = R.zs, xz = R.xz;
      let n = 0;
      xs[n] = R.spawn[0]; zs[n++] = R.spawn[2];
      xs[n] = A.cx - A.fz * mitad; zs[n++] = A.cz + A.fx * mitad;
      xs[n] = A.cx + A.fz * mitad; zs[n++] = A.cz - A.fx * mitad;
      xs[n] = TARIMA_CENTRO.x; zs[n++] = TARIMA_CENTRO.z;
      zonaSillasEn(DBG_LAYOUT, xz); xs[n] = xz.x; zs[n++] = xz.z;
      centroSillasEn(DBG_LAYOUT, xz); xs[n] = xz.x; zs[n++] = xz.z;
      monolitoEn(-1, DBG_SILLAS.monolithDistM, DBG_LAYOUT, xz); xs[n] = xz.x; zs[n++] = xz.z;
      monolitoEn(1, DBG_SILLAS.monolithDistM, DBG_LAYOUT, xz); xs[n] = xz.x; zs[n++] = xz.z;
      xs[n] = ATRIL_BAJO.x; zs[n++] = ATRIL_BAJO.z;
      xs[n] = ATRIL_SINTE.x; zs[n++] = ATRIL_SINTE.z;
      xs[n] = ATRIL_SAMPLER.x; zs[n++] = ATRIL_SAMPLER.z;
      if (ATRIL_RITMOS.visible) { xs[n] = ATRIL_RITMOS.x; zs[n++] = ATRIL_RITMOS.z; }
      circuloEscenario(xs, zs, n, D.RADIO_EXTRA_M, R.circ);
    }

    if (E.modo) {
      // la esfera como personaje: misma caminata y misma función de límites que el usuario
      if (!_en.pausado) {
        const paso = (DBG_MOV.POR_DELTA ? DBG_MOV.VELOCIDAD_BASE_MS * Math.min(dt, DBG_MOV.DT_MAX_S) : DBG_MOV.PASO_POR_FRAME_M) * DBG_MOV.VELOCIDAD_FACTOR;
        const d = avanzarEsfera(esf, teclas.current, R.pose0.yaw, paso, moverConLimites, R.tmp);
        const m = esferaRef.current;
        if (m && d > 0) {   // rueda: ángulo = distancia / radio, eje = arriba × dirección
          R.eje.set(esf.dz, 0, -esf.dx).normalize();
          R.qr.setFromAxisAngle(R.eje, d / Math.max(1e-3, D.RADIO_M * R.escala));
          m.quaternion.premultiply(R.qr);
        }
      }
      // pose de la lógica (los demás sistemas ven al usuario en la esfera) y pose elevada para dibujar
      cam.position.set(esf.x, R.pose0.y, esf.z); cam.quaternion.copy(R.q0);
      const fovV = THREE.MathUtils.degToRad(cam.fov || 90);
      R.xz.x = R.circ.cx; R.xz.z = R.circ.cz;   // centro del escenario
      const r = radioAEncuadrar(R.circ.r, R.xz, esf, D.CENTRAR);
      const h = alturaDeEncuadre(r, fovV, cam.aspect || 1, D.MARGEN, D.ALTURA_MAX_M);
      ESPERA_DIAG.alturaEncuadre = alturaFinalEfectiva(h, R.pose0.y, D);
      poseDeCamara(E.p, R.pose0, esf, R.xz, h, D, R.render);
    } else if (E.aterrizo) {
      cam.position.set(esf.x, R.pose0.y, esf.z); cam.quaternion.copy(R.q0);   // continuidad exacta: el control vuelve
    }

    // esfera: aparición/retiro, tamaño según la altura de la cámara, animación del footer (mismas fórmulas)
    const m = esferaRef.current;
    if (m) {
      const a = E.alfaEsfera, ve = a > 0.001 && !apagado;
      m.visible = ve;
      if (ve) {
        const alto = E.modo ? R.render.y : R.pose0.y;
        R.escala = escalaEsfera(alto, D.ESCALA_ALTURA, D.ESCALA_MAX);
        const ap = a * a * (3 - 2 * a), rad = Math.max(0.01, D.RADIO_M) * R.escala * (0.35 + 0.65 * ap);
        m.scale.setScalar(rad);
        m.position.set(esf.x, rad, esf.z);
        R.tiempo += Math.min(dt, 0.05);
        const t = R.tiempo, U = UNIF;
        const beat = Math.max(0, Math.sin(t * 2.5) * 0.5) * 0.18, rms = 0.09 + Math.sin(t * 0.75) * 0.04;
        const bass = Math.max(0, Math.sin(t * 3.1) * 0.4) * 0.14, mid = 0.07 + Math.sin(t * 1.4) * 0.03, air = 0.03 + Math.sin(t * 0.5) * 0.02;
        U.uTime.value = t; U.uBeat.value = beat; U.uRMS.value = rms; U.uBass.value = bass; U.uMid.value = mid; U.uAir.value = air; U.uSub.value = bass * 0.5;
        U.uTint.value.setRGB(0.25 + bass * 0.75, 0.40 + mid * 0.60, 0.65 + air * 0.35);
        U.uFractalIntensity.value = D.FRACTAL;
        U.uFade.value = ap;
      }
    }
    // guía (debug): círculo de encuadre en el piso
    const g = guiaRef.current;
    if (g) {
      g.visible = D.GUIA;
      if (D.GUIA) { g.position.set(R.circ.cx, 0.05, R.circ.cz); g.scale.set(R.circ.r, 1, R.circ.r); }
    }

    const Dg = ESPERA_DIAG;
    Dg.motivo = motivo; Dg.reducir = _en.reducir; Dg.oculto = _en.oculto;
    Dg.altura = E.modo ? R.render.y : cam.position.y; Dg.pitchDeg = THREE.MathUtils.radToDeg(E.modo ? R.render.pitch : 0);
    Dg.radio = R.circ.r; Dg.cx = R.circ.cx; Dg.cz = R.circ.cz; Dg.esferaX = esf.x; Dg.esferaZ = esf.z; Dg.recorrido = esf.recorrido; Dg.escala = R.escala;
    const ms = performance.now() - t0;
    Dg.msCuadro = Dg.msCuadro * 0.95 + ms * 0.05;
  }, -1);

  // ── 0,5: pose elevada justo antes de dibujar ───────────────────────────────
  useFrame(({ camera: cam, scene }) => {
    R.swap = false;
    if (!ESPERA.modo || ESPERA.p <= 0) return;
    const P = R.render;
    cam.position.set(P.x, P.y, P.z);
    cam.quaternion.setFromEuler(R.euler.set(P.pitch, P.yaw, 0, "YXZ"));
    const f = scene.fog as THREE.FogExp2 | null;
    R.niebla = false;
    if (DBG_ESPERA.NIEBLA_COMPENSAR && f && "density" in f) {
      R.densidad = f.density; R.niebla = true;
      f.density *= Math.min(1, Math.max(0, DBG_ESPERA.NIEBLA_REF_M) / Math.max(1e-3, P.y));
    }
    R.swap = true;
  }, 0.5);

  // ── 2: vuelve a la pose de la esfera después de dibujar ────────────────────
  useFrame(({ camera: cam, scene }) => {
    if (!R.swap) return;
    R.swap = false;
    cam.position.set(R.esfera.x, R.pose0.y, R.esfera.z); cam.quaternion.copy(R.q0);
    // con ESCUCHA_EN_ESFERA los hijos (el oyente de audio) vuelven con la cámara; sin él, solo la cámara
    if (DBG_ESPERA.ESCUCHA_EN_ESFERA) cam.updateMatrixWorld(true); else cam.updateWorldMatrix(false, false);
    const f = scene.fog as THREE.FogExp2 | null;
    if (R.niebla && f && "density" in f) f.density = R.densidad;
    R.niebla = false;
  }, 2);

  return (
    <>
      <mesh ref={esferaRef} geometry={recursos.geo} material={recursos.mat} visible={false} renderOrder={10} frustumCulled={false} />
      <lineLoop ref={guiaRef} geometry={recursos.guiaGeo} material={recursos.guiaMat} visible={false} renderOrder={11} frustumCulled={false} />
    </>
  );
}
