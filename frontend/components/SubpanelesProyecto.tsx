"use client";
// Z4: subpaneles del panel abierto (camino SILLAS): HISTORIA (izquierda), GALERÍA (derecha)
// y FICHA DEL PROYECTO (abajo), con líneas guía punteadas ámbar hacia el panel
// (docs/mockups/mockup-paneles-proyecto.png).
// - Abre con alight:panel-abierto (Z2) cuando hay datos (Z3: useProyectoDetalle) y cierra
//   con animación inversa en alight:panel-cerrado.
// - Con el panel abierto la linterna pasa a ser puntero: el centro de la pantalla apunta
//   y el clic (con pointer lock) presiona ▲▼ / ◀ ANT / SIG ▶. Mientras la mirada siga sobre
//   el conjunto, LINTERNA_STATE.retener evita que el panel se suelte.
// - CanvasTexture redibujadas solo al cambiar página / imagen / hover; sin luces nuevas;
//   texturas, geometrías y materiales liberados al desmontar. Sin allocations por frame.
// Montar dentro de ExperienceDome (grupo raíz sin transformación).

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { DBG_SUBPANELES } from "@/lib/debugConfig";
import { LINTERNA_STATE, ACERC } from "@/lib/linternaPaneles";
import { INTERACT_STATE } from "@/lib/alightStore";
import { playUIClick } from "@/lib/audioEngine";
import { useProyectoDetalle, type ProyectoDetalle } from "@/lib/proyectoDetalle";
import {
  HISTORIA_SIZE, GALERIA_SIZE, FICHA_SIZE, GALERIA_PANTALLA, HISTORIA_BOTONES, GALERIA_BOTONES,
  paginarSinopsis, dibujarHistoria, dibujarGaleria, dibujarGaleriaPantalla, dibujarFicha, dentro,
} from "@/lib/retro/subpanelCanvas";

// tamaño de cada subpanel en px del mockup (canvas = × 2)
const MOCK = {
  historia: { w: HISTORIA_SIZE.w / 2, h: HISTORIA_SIZE.h / 2 },
  galeria:  { w: GALERIA_SIZE.w / 2,  h: GALERIA_SIZE.h / 2 },
  ficha:    { w: FICHA_SIZE.w / 2,    h: FICHA_SIZE.h / 2 },
};
const LINEA_GROSOR_M = 0.05;

type Lienzo = { cv: HTMLCanvasElement; ctx: CanvasRenderingContext2D; tex: THREE.CanvasTexture };

function crearLienzo(w: number, h: number): Lienzo | null {
  if (typeof document === "undefined") return null;
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const ctx = cv.getContext("2d");
  if (!ctx) return null;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { cv, ctx, tex };
}

// ── pantalla CRT ámbar de GALERÍA ─────────────────────────────────────────────
const PANTALLA_VERT = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const PANTALLA_FRAG = /* glsl */`
  uniform sampler2D uMap, uOverlay;
  uniform float uHas, uTexAspect, uScreenAspect, uAmbar, uScan, uCurva;
  varying vec2 vUv;
  void main() {
    vec2 c = vUv * 2.0 - 1.0;
    c *= 1.0 + uCurva * dot(c, c);
    vec2 uv = c * 0.5 + 0.5;
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
    vec2 t = uv;
    float sa = uScreenAspect, ta = max(0.01, uTexAspect);
    if (ta > sa) t.x = 0.5 + (t.x - 0.5) * sa / ta; else t.y = 0.5 + (t.y - 0.5) * ta / sa;
    vec3 img = texture2D(uMap, t).rgb * uHas;
    float l = dot(img, vec3(0.299, 0.587, 0.114));
    vec3 amber = vec3(1.0, 0.604, 0.122);            // #FF9A1F
    vec3 fondo = vec3(0.165, 0.078, 0.0);            // #2A1400
    vec3 col = mix(img, mix(fondo, amber, l), uAmbar);
    float s = 0.5 + 0.5 * sin(uv.y * 240.0 * 6.28318);
    col *= 1.0 - uScan * s;                          // scanlines
    col *= 1.0 - 0.35 * dot(c, c) * 0.5;             // viñeta del tubo
    float ov = texture2D(uOverlay, uv).a;            // PLAY / T-03 / LOCACIÓN
    col = mix(col, amber * 1.15, ov);
    gl_FragColor = vec4(col, 1.0);
  }
`;

// ── líneas guía punteadas ámbar ───────────────────────────────────────────────
const LINEA_FRAG = /* glsl */`
  uniform float uAlpha, uLen;
  varying vec2 vUv;
  void main() {
    float d = step(0.5, fract(vUv.x * uLen / 0.22));
    float fin = step(vUv.x * uLen, 0.12) + step((1.0 - vUv.x) * uLen, 0.12); // cuadraditos en los extremos
    float a = max(d, min(1.0, fin)) * uAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(1.0, 0.604, 0.122, a);
  }
`;

// Z5: raycast analítico rayo–plano contra un plano (PlaneGeometry w × h, normal +Z local).
// Escribe u, v (0–1) en `out`; devuelve true si el impacto cae dentro del plano expandido
// por `margenU` (fracción del ancho) y deja out.dentro = impacto estricto (sin margen).
// Objetos de módulo reutilizados: sin allocations por frame.
const _rInv = new THREE.Matrix4();
const _rO = new THREE.Vector3();
const _rD = new THREE.Vector3();
const _hit = { u: 0, v: 0, cx: 0, cy: 0, dentro: false };
const _q = new THREE.Quaternion(); // Z9: pose del panel acercado (reutilizado)
function rayoUV(
  mesh: THREE.Object3D | null, w: number, h: number,
  origen: THREE.Vector3, dir: THREE.Vector3, out: typeof _hit, margenU: number,
): boolean {
  if (!mesh || !mesh.visible) return false;
  _rInv.copy(mesh.matrixWorld).invert();
  _rO.copy(origen).applyMatrix4(_rInv);
  _rD.copy(origen).add(dir).applyMatrix4(_rInv).sub(_rO);
  if (Math.abs(_rD.z) < 1e-6) return false;
  const t = -_rO.z / _rD.z;
  if (t <= 0) return false;
  const u = (_rO.x + _rD.x * t) / w + 0.5;
  const v = (_rO.y + _rD.y * t) / h + 0.5;
  const mv = margenU * w / h;
  out.u = u; out.v = v;
  out.dentro = u >= 0 && u <= 1 && v >= 0 && v <= 1;
  return u >= -margenU && u <= 1 + margenU && v >= -mv && v <= 1 + mv;
}

type Abierto = { proyectoId: number; abierto: boolean; n: number };

export default function SubpanelesProyecto({ panelAncho, panelAlto }: { panelAncho: number; panelAlto: number }) {
  const { camera, gl, scene } = useThree();
  const [est, setEst] = useState<Abierto | null>(null);
  const { data } = useProyectoDetalle(est?.proyectoId ?? null);

  const groupRef    = useRef<THREE.Group>(null);
  const historiaRef = useRef<THREE.Mesh>(null);
  const galeriaRef  = useRef<THREE.Mesh>(null);
  const fichaRef    = useRef<THREE.Mesh>(null);
  const lineaIzq    = useRef<THREE.Mesh>(null);
  const lineaDer    = useRef<THREE.Mesh>(null);
  const lineaAbajo  = useRef<THREE.Mesh>(null);
  const punteroRef  = useRef<THREE.Mesh>(null);
  const histMatRef  = useRef<THREE.MeshBasicMaterial>(null);
  const galMatRef   = useRef<THREE.MeshBasicMaterial>(null);
  const fichaMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const pantMatRef  = useRef<THREE.ShaderMaterial>(null);
  const lineaMatRef = useRef<THREE.ShaderMaterial>(null);

  // estado de animación / interacción (refs: sin re-render por frame)
  const anim = useRef({ t: 0, abierto: false, tDentro: 0, escala: 1, avisoEscala: false }); // Z5: tDentro; Z8: escala de ajuste
  const ui = useRef({
    pagina: 0, paginas: [[""]] as string[][], indice: 0,
    hover: null as string | null, sobre: null as "historia" | "galeria" | "ficha" | null,
  });
  const lienzos = useRef<{ historia: Lienzo | null; galeria: Lienzo | null; pantalla: Lienzo | null; ficha: Lienzo | null; datos: ProyectoDetalle | null }>(
    { historia: null, galeria: null, pantalla: null, ficha: null, datos: null });
  const imagenes = useRef(new Map<string, THREE.Texture>());
  const loader = useMemo(() => new THREE.TextureLoader(), []);

  // texturas vacías para que los materiales compilen con USE_MAP desde el inicio (sin recompilar al abrir)
  const vacia = useMemo(() => new THREE.Texture(), []);
  const uniformsPantalla = useMemo(() => ({
    uMap: { value: vacia as THREE.Texture }, uOverlay: { value: vacia as THREE.Texture },
    uHas: { value: 0 }, uTexAspect: { value: 1.5 }, uScreenAspect: { value: GALERIA_PANTALLA.w / GALERIA_PANTALLA.h },
    uAmbar: { value: 1 }, uScan: { value: 0.28 }, uCurva: { value: 0.08 },
  }), [vacia]);
  const uniformsLinea = useMemo(() => ({ uAlpha: { value: 0 }, uLen: { value: 1 } }), []);

  // reutilizables
  const _v = useMemo(() => ({
    pos: new THREE.Vector3(), cam: new THREE.Vector3(), fwd: new THREE.Vector3(),
    o: new THREE.Vector3(), d: new THREE.Vector3(), inv: new THREE.Matrix4(),
  }), []);

  // ── eventos de la linterna (Z2) ──
  useEffect(() => {
    const onAbierto = (e: Event) => {
      const det = (e as CustomEvent<{ proyectoId: number | null }>).detail;
      if (!det || det.proyectoId === null || !DBG_SUBPANELES.SUB_ACTIVO) return; // prestador: sin subpaneles
      // pose fija del conjunto: sobre el panel, adelantado hacia la cámara y mirándola
      const g = groupRef.current, panel = LINTERNA_STATE.sel?.mesh;
      if (g && panel) {
        panel.getWorldPosition(_v.pos);
        camera.getWorldPosition(_v.cam);
        _v.d.copy(_v.cam).sub(_v.pos).normalize();
        g.position.copy(_v.pos).addScaledVector(_v.d, DBG_SUBPANELES.SUB_ADELANTE_M);
        g.lookAt(_v.cam);
        g.updateMatrixWorld(true);
      }
      anim.current.abierto = true;
      anim.current.tDentro = performance.now(); // Z5: la gracia arranca al abrir
      anim.current.avisoEscala = false;         // Z8
      setEst(prev => ({ proyectoId: det.proyectoId as number, abierto: true, n: (prev?.n ?? 0) + 1 }));
    };
    const onCerrado = () => {
      anim.current.abierto = false;
      LINTERNA_STATE.retener = false;
      INTERACT_STATE.panelBloqueo = false; // Z5
      setEst(prev => (prev ? { ...prev, abierto: false } : prev));
    };
    window.addEventListener("alight:panel-abierto", onAbierto);
    window.addEventListener("alight:panel-cerrado", onCerrado);
    return () => {
      window.removeEventListener("alight:panel-abierto", onAbierto);
      window.removeEventListener("alight:panel-cerrado", onCerrado);
      LINTERNA_STATE.retener = false;
      INTERACT_STATE.panelBloqueo = false; // Z5
    };
  }, [camera, _v]);

  // ── redibujos (solo ante cambios) ──
  const redibujarHistoria = () => {
    const L = lienzos.current.historia; if (!L) return;
    dibujarHistoria(L.ctx, ui.current.paginas, ui.current.pagina, DBG_SUBPANELES.HISTORIA_RENGLONES,
      ui.current.sobre === "historia" ? ui.current.hover : null);
    L.tex.needsUpdate = true;
  };
  const redibujarGaleria = () => {
    const L = lienzos.current.galeria, P = lienzos.current.pantalla, d = lienzos.current.datos;
    if (!L || !d) return;
    const total = Math.max(1, d.galeria.length);
    dibujarGaleria(L.ctx, ui.current.indice, total, ui.current.sobre === "galeria" ? ui.current.hover : null);
    L.tex.needsUpdate = true;
    if (P) { dibujarGaleriaPantalla(P.ctx, ui.current.indice, d.ficha.ciudad); P.tex.needsUpdate = true; }
  };
  const mostrarImagen = () => {
    const d = lienzos.current.datos, mat = pantMatRef.current;
    if (!d || !mat) return;
    const url = d.galeria[ui.current.indice] ?? d.foto;
    mat.uniforms.uHas.value = 0;
    if (!url) return;
    const hit = imagenes.current.get(url);
    const aplicar = (tex: THREE.Texture) => {
      const img = tex.image as { width?: number; height?: number } | undefined;
      mat.uniforms.uMap.value = tex;
      mat.uniforms.uTexAspect.value = img?.width && img?.height ? img.width / img.height : 1.5;
      mat.uniforms.uHas.value = 1;
    };
    if (hit) { aplicar(hit); return; }
    loader.load(url, tex => {
      tex.colorSpace = THREE.SRGBColorSpace;
      if (lienzos.current.datos !== d) { tex.dispose(); return; }  // cambió el proyecto mientras cargaba
      imagenes.current.set(url, tex);
      gl.initTexture(tex);
      if ((d.galeria[ui.current.indice] ?? d.foto) === url) aplicar(tex);
    }, undefined, () => console.warn(`[Subpaneles] Z4: no cargó la imagen de galería ${url}`));
  };

  // ── lienzos por proyecto (se crean al llegar los datos, se liberan al cambiar/desmontar) ──
  useEffect(() => {
    if (!data) return;
    const h = crearLienzo(HISTORIA_SIZE.w, HISTORIA_SIZE.h);
    const g = crearLienzo(GALERIA_SIZE.w, GALERIA_SIZE.h);
    const p = crearLienzo(GALERIA_PANTALLA.w, GALERIA_PANTALLA.h);
    const f = crearLienzo(FICHA_SIZE.w, FICHA_SIZE.h);
    const imgs = imagenes.current;
    lienzos.current = { historia: h, galeria: g, pantalla: p, ficha: f, datos: data };
    ui.current.pagina = 0; ui.current.indice = 0; ui.current.hover = null; ui.current.sobre = null;
    if (h) ui.current.paginas = paginarSinopsis(h.ctx, data.sinopsis, DBG_SUBPANELES.HISTORIA_RENGLONES);
    redibujarHistoria();
    redibujarGaleria();
    if (f) { dibujarFicha(f.ctx, data); f.tex.needsUpdate = true; }
    const hm = histMatRef.current, gm = galMatRef.current, fm = fichaMatRef.current, pm = pantMatRef.current;
    if (hm && h) hm.map = h.tex;
    if (gm && g) gm.map = g.tex;
    if (fm && f) fm.map = f.tex;
    if (pm && p) pm.uniforms.uOverlay.value = p.tex;
    for (const L of [h, g, p, f]) if (L) gl.initTexture(L.tex);
    mostrarImagen();
    return () => {
      for (const L of [h, g, p, f]) L?.tex.dispose();
      for (const t of imgs.values()) t.dispose();
      imgs.clear();
      if (hm) hm.map = vacia;
      if (gm) gm.map = vacia;
      if (fm) fm.map = vacia;
      if (pm) { pm.uniforms.uOverlay.value = vacia; pm.uniforms.uMap.value = vacia; pm.uniforms.uHas.value = 0; }
      lienzos.current = { historia: null, galeria: null, pantalla: null, ficha: null, datos: null };
    };
    // los redibujos leen refs; solo dependen de los datos
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, gl, vacia]);

  // ── clic = presionar el botón bajo la mirada ──
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (e.button !== 0 || !document.pointerLockElement || !anim.current.abierto || anim.current.t < 0.95) return;
      const u = ui.current, d = lienzos.current.datos;
      if (!u.hover || !d) return;
      playUIClick(); // Z5
      if (u.sobre === "historia") {
        const n = u.paginas.length;
        const prev = u.pagina;
        if (u.hover === "arriba") u.pagina = Math.max(0, u.pagina - 1);
        if (u.hover === "abajo")  u.pagina = Math.min(n - 1, u.pagina + 1);
        if (u.pagina !== prev) redibujarHistoria();
      } else if (u.sobre === "galeria") {
        const n = Math.max(1, d.galeria.length);
        if (u.hover === "ant") u.indice = (u.indice - 1 + n) % n;
        if (u.hover === "sig") u.indice = (u.indice + 1) % n;
        redibujarGaleria();
        mostrarImagen();
      }
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── precompilar los materiales al montar (oculto), como P1 ──
  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    g.visible = true;
    try { gl.compile(scene, camera); } catch { /* ok */ }
    g.visible = false;
  }, [gl, scene, camera]);

  // liberar texturas propias al desmontar (geometrías/materiales los libera R3F)
  useEffect(() => () => { vacia.dispose(); }, [vacia]);

  useFrame((_, dt) => {
    const g = groupRef.current;
    if (!g) return;
    const D = DBG_SUBPANELES;
    const A = anim.current;
    const hayDatos = !!lienzos.current.datos;
    const objetivo = A.abierto && hayDatos && D.SUB_ACTIVO ? 1 : 0;
    const paso = dt * 1000 / Math.max(1, D.SUB_ANIM_MS);
    A.t = objetivo > A.t ? Math.min(1, A.t + paso) : Math.max(0, A.t - paso);
    if (A.t <= 0) {
      if (g.visible) g.visible = false;
      LINTERNA_STATE.retener = false;
      if (INTERACT_STATE.panelBloqueo) INTERACT_STATE.panelBloqueo = false; // Z5
      return;
    }
    g.visible = true;
    // salida: ease-out al abrir; el cierre recorre la misma curva al revés
    const e = 1 - Math.pow(1 - A.t, 3);

    // medidas (en vivo desde debug)
    // Z8: relativas al tamaño del panel (SUB_M_POR_PX y las separaciones están calibradas para 5,4 m)
    const rel = panelAncho / 5.4;
    let m = D.SUB_M_POR_PX * rel;
    let gapL = D.SUB_GAP_LATERAL_M * rel, gapA = D.SUB_GAP_ABAJO_M * rel;
    const px = panelAncho / 2, py = panelAlto / 2;
    // Z8: si el conjunto no entra en el viewport a esta distancia, se reduce todo
    // (subpaneles + separaciones) en la misma proporción; el panel no cambia.
    let k = 1;
    const pc = camera as THREE.PerspectiveCamera;
    // Z9: con el panel acercado, el bloque lo resuelve calcularLayoutBloque (linterna): misma k,
    // y el conjunto sigue la pose real del panel (que ya quedó desplazado para centrar el bloque)
    const bloque = D.SUB_AJUSTE_BLOQUE && ACERC.panel !== null && ACERC.fase === "cerca"
      && LINTERNA_STATE.sel === ACERC.panel && !!ACERC.panel.mesh;
    if (bloque) {
      const pm = ACERC.panel!.mesh!;
      pm.getWorldPosition(_v.pos);
      pm.getWorldQuaternion(_q);
      _v.d.set(0, 0, 1).applyQuaternion(_q);                     // normal del panel → hacia la cámara
      g.position.copy(_v.pos).addScaledVector(_v.d, D.SUB_ADELANTE_M);
      g.quaternion.copy(_q);
      k = ACERC.layout.k;
      m *= k; gapL *= k; gapA *= k;
    } else if (D.SUB_AJUSTE_PANTALLA && pc.isPerspectiveCamera) {
      camera.getWorldPosition(_v.cam);
      const dist = Math.max(0.1, _v.cam.distanceTo(g.position));
      const marg = 1 - 2 * THREE.MathUtils.clamp(D.SUB_MARGEN_PANTALLA, 0, 0.3);
      const hy = dist * Math.tan(THREE.MathUtils.degToRad(pc.fov) / 2) * marg;
      const hx = hy * pc.aspect;
      const kx  = (hx - px) / (gapL + Math.max(MOCK.historia.w, MOCK.galeria.w) * m);
      const ky1 = (hy - py) / (gapA + MOCK.ficha.h * m);
      const ky2 = hy / (Math.max(MOCK.historia.h, MOCK.galeria.h) * m / 2);
      k = THREE.MathUtils.clamp(Math.min(1, kx, ky1, ky2), 0.15, 1);
      m *= k; gapL *= k; gapA *= k;
    }
    if (k < 0.999 && !A.avisoEscala && A.t >= 1) {
      A.avisoEscala = true;
      console.info(`[Subpaneles] ${bloque ? "Z9" : "Z8"}: HISTORIA/GALERÍA/FICHA reducidos a ${(k * 100).toFixed(0)} % para entrar en pantalla`
        + (bloque && ACERC.layout.alejado ? ` y bloque alejado a ${ACERC.layout.d.toFixed(2)} m (escala mínima alcanzada)` : ""));
    }
    A.escala = k;
    ACERC.escalaSub = k; // Z8: para el menú de debug
    const hw = MOCK.historia.w * m, hh = MOCK.historia.h * m;
    const gw = MOCK.galeria.w * m,  gh = MOCK.galeria.h * m;
    const fw = MOCK.ficha.w * m,    fh = MOCK.ficha.h * m;
    const s = Math.max(0.001, e);

    const hist = historiaRef.current, gal = galeriaRef.current, fic = fichaRef.current;
    if (hist) { hist.position.set(-(px + gapL + hw / 2) * e, 0, 0); hist.scale.set(hw * s, hh * s, 1); }
    if (gal)  { gal.position.set((px + gapL + gw / 2) * e, 0, 0);   gal.scale.set(gw * s, gh * s, 1); }
    if (fic)  { fic.position.set(0, -(py + gapA + fh / 2) * e, 0);  fic.scale.set(fw * s, fh * s, 1); }

    // líneas guía (aparecen en la segunda mitad de la animación)
    const la = D.SUB_LINEAS ? Math.max(0, (e - 0.5) * 2) : 0;
    const lm = lineaMatRef.current;
    if (lm) { lm.uniforms.uAlpha.value = la; lm.uniforms.uLen.value = Math.max(gapL, gapA); }
    const li = lineaIzq.current, ld = lineaDer.current, lb = lineaAbajo.current;
    if (li) { li.visible = la > 0.01; li.position.set(-(px + gapL / 2), 0, 0.01); li.scale.set(gapL, LINEA_GROSOR_M, 1); }
    if (ld) { ld.visible = la > 0.01; ld.position.set(px + gapL / 2, 0, 0.01);    ld.scale.set(gapL, LINEA_GROSOR_M, 1); }
    if (lb) { lb.visible = la > 0.01; lb.position.set(0, -(py + gapA / 2), 0.01); lb.scale.set(gapA, LINEA_GROSOR_M, 1); }

    // pantalla CRT
    const pm = pantMatRef.current;
    if (pm) { pm.uniforms.uAmbar.value = D.GALERIA_AMBAR; pm.uniforms.uScan.value = D.GALERIA_SCAN; pm.uniforms.uCurva.value = D.GALERIA_CURVA; }

    // ── Z5: modo puntero — raycast desde el centro de cámara contra los 3 subpaneles y el panel ──
    camera.getWorldPosition(_v.cam);
    camera.getWorldDirection(_v.fwd);
    g.updateMatrixWorld(true);
    const now = performance.now();
    const listo = A.t >= 1;
    let sobre: "historia" | "galeria" | "ficha" | null = null;
    let hover: string | null = null;
    let dentroAlgo = false;
    const pad = Math.max(0, D.SUB_RETENER_PAD_M);
    // subpaneles: planos unitarios escalados → UV directo (con margen `pad` solo para retener)
    if (rayoUV(hist, 1, 1, _v.cam, _v.fwd, _hit, pad / Math.max(0.001, hw))) {
      dentroAlgo = true;
      if (listo && _hit.dentro) { sobre = "historia"; _hit.cx = _hit.u * HISTORIA_SIZE.w; _hit.cy = (1 - _hit.v) * HISTORIA_SIZE.h; }
    }
    if (!sobre && rayoUV(gal, 1, 1, _v.cam, _v.fwd, _hit, pad / Math.max(0.001, gw))) {
      dentroAlgo = true;
      if (listo && _hit.dentro) { sobre = "galeria"; _hit.cx = _hit.u * GALERIA_SIZE.w; _hit.cy = (1 - _hit.v) * GALERIA_SIZE.h; }
    }
    if (!sobre && rayoUV(fic, 1, 1, _v.cam, _v.fwd, _hit, pad / Math.max(0.001, fw))) {
      dentroAlgo = true;
      if (listo && _hit.dentro) sobre = "ficha";
    }
    // el panel abierto también cuenta como "dentro" (su geometría mide panelAncho × panelAlto)
    if (!dentroAlgo && rayoUV(LINTERNA_STATE.sel?.mesh ?? null, panelAncho, panelAlto, _v.cam, _v.fwd, _hit, pad / panelAncho)) dentroAlgo = true;
    if (sobre === "historia") {
      if (dentro(HISTORIA_BOTONES.arriba, _hit.cx, _hit.cy)) hover = "arriba";
      else if (dentro(HISTORIA_BOTONES.abajo, _hit.cx, _hit.cy)) hover = "abajo";
    } else if (sobre === "galeria") {
      if (dentro(GALERIA_BOTONES.ant, _hit.cx, _hit.cy)) hover = "ant";
      else if (dentro(GALERIA_BOTONES.sig, _hit.cx, _hit.cy)) hover = "sig";
    }

    // Z5: gracia — si el puntero sale, espera PUNTERO_GRACIA_MS antes de soltar el panel
    if (dentroAlgo || A.tDentro === 0) A.tDentro = now;
    const enGracia = now - A.tDentro <= D.PUNTERO_GRACIA_MS;
    LINTERNA_STATE.retener = A.abierto && A.t > 0.5 && (dentroAlgo || enGracia);
    // Z5: bloqueo opcional del movimiento mientras hay un panel abierto
    INTERACT_STATE.panelBloqueo = D.PANEL_BLOQUEA_MOVIMIENTO && A.abierto;

    const u = ui.current;
    if (hover !== u.hover || sobre !== u.sobre) {
      const antes = u.sobre;
      u.hover = hover; u.sobre = sobre;
      if (antes === "historia" || sobre === "historia") redibujarHistoria();
      if (antes === "galeria" || sobre === "galeria") redibujarGaleria();
    }

    // Z5: retícula clara en el centro de pantalla, sobre el plano del conjunto
    const pt = punteroRef.current;
    if (pt) {
      let ver = D.SUB_PUNTERO && A.abierto && A.t > 0.5;
      if (ver) {
        _v.inv.copy(g.matrixWorld).invert();
        _v.o.copy(_v.cam).applyMatrix4(_v.inv);
        _v.d.copy(_v.cam).add(_v.fwd).applyMatrix4(_v.inv).sub(_v.o);
        const t = Math.abs(_v.d.z) > 1e-6 ? -_v.o.z / _v.d.z : -1;
        ver = t > 0;
        if (ver) {
          pt.position.set(_v.o.x + _v.d.x * t, _v.o.y + _v.d.y * t, 0.03);
          const r = D.PUNTERO_RADIO_M / 0.21 * (hover ? 1.3 : 1);   // geometría base: radio medio 0.21 m
          pt.scale.set(r, r, 1);
        }
      }
      pt.visible = ver;
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      <mesh ref={historiaRef} renderOrder={5}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial ref={histMatRef} map={vacia} toneMapped={false} fog={false} />
      </mesh>
      <mesh ref={galeriaRef} renderOrder={5}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial ref={galMatRef} map={vacia} toneMapped={false} fog={false} />
        {/* pantalla CRT: hija del marco, en coordenadas normalizadas del canvas */}
        <mesh
          renderOrder={6}
          position={[
            (GALERIA_PANTALLA.x + GALERIA_PANTALLA.w / 2) / GALERIA_SIZE.w - 0.5,
            0.5 - (GALERIA_PANTALLA.y + GALERIA_PANTALLA.h / 2) / GALERIA_SIZE.h,
            0.004,
          ]}
          scale={[GALERIA_PANTALLA.w / GALERIA_SIZE.w, GALERIA_PANTALLA.h / GALERIA_SIZE.h, 1]}
        >
          <planeGeometry args={[1, 1]} />
          <shaderMaterial ref={pantMatRef} uniforms={uniformsPantalla} vertexShader={PANTALLA_VERT} fragmentShader={PANTALLA_FRAG} />
        </mesh>
      </mesh>
      <mesh ref={fichaRef} renderOrder={5}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial ref={fichaMatRef} map={vacia} toneMapped={false} fog={false} />
      </mesh>
      {/* líneas guía: un material compartido */}
      <mesh ref={lineaIzq} renderOrder={4}>
        <planeGeometry args={[1, 1]} />
        <shaderMaterial ref={lineaMatRef} uniforms={uniformsLinea} vertexShader={PANTALLA_VERT} fragmentShader={LINEA_FRAG} transparent depthWrite={false} />
      </mesh>
      <mesh ref={lineaDer} renderOrder={4}>
        <planeGeometry args={[1, 1]} />
        <shaderMaterial uniforms={uniformsLinea} vertexShader={PANTALLA_VERT} fragmentShader={LINEA_FRAG} transparent depthWrite={false} />
      </mesh>
      <mesh ref={lineaAbajo} renderOrder={4} rotation={[0, 0, Math.PI / 2]}>
        <planeGeometry args={[1, 1]} />
        <shaderMaterial uniforms={uniformsLinea} vertexShader={PANTALLA_VERT} fragmentShader={LINEA_FRAG} transparent depthWrite={false} />
      </mesh>
      {/* puntero: aro claro donde apunta la mirada (mockup: círculo sobre SIG ▶) */}
      <mesh ref={punteroRef} renderOrder={7} visible={false}>
        <ringGeometry args={[0.18, 0.24, 32]} />
        <meshBasicMaterial color="#FFF3DC" transparent opacity={0.85} depthWrite={false} toneMapped={false} fog={false} />
      </mesh>
    </group>
  );
}
