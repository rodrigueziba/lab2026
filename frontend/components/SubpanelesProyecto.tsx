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
import { DBG_SUBPANELES, DBG_PRIORIDAD, DBG_AISLAR_UI } from "@/lib/debugConfig";
import { ponerEnCapaUI, CAPA_UI_ESTADO } from "@/lib/retro/capaUI";
import { crearParche, actualizarParche, uvDeParche, UV_PARCHE, type ParamsParche } from "@/lib/retro/parcheEsferico";
import { FOCO, resetFoco, easingFoco, calcularFocoObjetivo, type FocoId } from "@/lib/focoSubpanel";
import { DBG_FOCO } from "@/lib/debugConfig";
import { RETRO_FLAGS } from "@/lib/retro/retroFlags";
import { CRT_UNIFORMS } from "@/lib/retro/retroCRT";

// Z10: el conjunto se dibuja después de los paneles en órbita (renderOrder 0)
const RO = DBG_PRIORIDAD.RENDER_ORDER_BLOQUE;
import { LINTERNA_STATE, ACERC } from "@/lib/linternaPaneles";
import { INTERACT_STATE } from "@/lib/alightStore";
import { playUIClick } from "@/lib/audioEngine";
import { useProyectoDetalle, type ProyectoDetalle } from "@/lib/proyectoDetalle";
import {
  HISTORIA_SIZE, GALERIA_SIZE, FICHA_SIZE, GALERIA_PANTALLA, HISTORIA_BOTONES, GALERIA_BOTONES,
  paginarSinopsis, dibujarHistoria, dibujarGaleria, dibujarGaleriaPantalla, dibujarFicha, dentro, dentroAmpliado,
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
  uniform float uAtenua; // Z19: brillo relativo mientras otro subpanel está en foco
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
    gl_FragColor = vec4(col * uAtenua, 1.0);
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
const _hit = { u: 0, v: 0, cx: 0, cy: 0, dentro: false, t: 0 }; // Z14: t = distancia al impacto (m)
const _q = new THREE.Quaternion(); // Z9: pose del panel acercado (reutilizado)
// Z14: poses cóncavas (reutilizados, sin allocations por frame)
const _Y = new THREE.Vector3(0, 1, 0);
const _Z = new THREE.Vector3(0, 0, 1);
const _cV = new THREE.Vector3();      // panel − ojo
const _rH = new THREE.Vector3();      // eje horizontal derecho del panel (para el pitch de FICHA)
const _tp = new THREE.Vector3();      // posición objetivo (mundo)
const _tq = new THREE.Quaternion();   // orientación objetivo (mundo)
const _gqi = new THREE.Quaternion();  // inversa de la orientación del grupo
const _ax = new THREE.Vector3(), _ay = new THREE.Vector3(), _az = new THREE.Vector3();
const _la = new THREE.Vector3(), _lb = new THREE.Vector3(), _ojoL = new THREE.Vector3();
const _mb = new THREE.Matrix4();
const _PI2 = Math.PI / 2;
const _gq2 = new THREE.Quaternion();  // Z16
// Z18: parámetros reutilizados de los parches y raycast contra la esfera
const _pp: ParamsParche = { yaw: 0, pitch: 0, ancho: 0.1, alto: 0.1, R: 3, curva: 1, vertical: false };
const _qfi = new THREE.Quaternion();
const _eo = new THREE.Vector3(), _ed = new THREE.Vector3();
const _box = { yaw: 0, pitch: 0, ancho: 0, alto: 0 };
// Z19: parámetros EFECTIVOS (aparición + foco) de cada subpanel: los usan la geometría y el raycast
type EF = { yaw: number; pitch: number; ancho: number; alto: number; R: number };
const _efH: EF = { yaw: 0, pitch: 0, ancho: 0, alto: 0, R: 3 };
const _efG: EF = { yaw: 0, pitch: 0, ancho: 0, alto: 0, R: 3 };
const _efF: EF = { yaw: 0, pitch: 0, ancho: 0, alto: 0, R: 3 };
const _qCamM = new THREE.Quaternion();
const ORDEN_H: FocoId[] = ["historia", "galeria", "ficha"];   // orden de prueba del raycast (el de foco primero)
const ORDEN_G: FocoId[] = ["galeria", "historia", "ficha"];
const ORDEN_F: FocoId[] = ["ficha", "historia", "galeria"];
function efDe(id: FocoId): EF { return id === "historia" ? _efH : id === "galeria" ? _efG : _efF; }
/** base → (si está en foco) mezcla hacia el objetivo del foco. */
function ponerEF(ef: EF, id: FocoId, yaw: number, pitch: number, ancho: number, alto: number, R: number): void {
  const k = FOCO.id === id ? FOCO.fEase : 0;
  ef.yaw = yaw + (FOCO.yaw - yaw) * k; ef.pitch = pitch + (FOCO.pitch - pitch) * k;
  ef.ancho = ancho + (FOCO.ancho - ancho) * k; ef.alto = alto + (FOCO.alto - alto) * k;
  ef.R = R + (FOCO.R - R) * k;
}
/** Intersección del rayo (en el marco) con la esfera de radio R centrada en el ojo → yaw/pitch. */
const _hitEsf = { ok: false, t: 0, yaw: 0, pitch: 0 };
function rayoEsfera(o: THREE.Vector3, d: THREE.Vector3, R: number): void {
  const b = o.dot(d), c = o.lengthSq() - R * R, disc = b * b - c;
  _hitEsf.ok = false;
  if (disc < 0) return;
  const t = -b + Math.sqrt(disc);
  if (t <= 0) return;
  const hx = o.x + d.x * t, hy = o.y + d.y * t, hz = o.z + d.z * t;
  _hitEsf.ok = true; _hitEsf.t = t;
  _hitEsf.yaw = Math.atan2(hx, -hz); _hitEsf.pitch = Math.asin(THREE.MathUtils.clamp(hy / R, -1, 1));
}
function ponerParche(geo: THREE.BufferGeometry, yaw: number, pitch: number, ancho: number, alto: number, R: number, curva: number, vertical: boolean): void {
  _pp.yaw = yaw; _pp.pitch = pitch; _pp.ancho = Math.max(1e-4, ancho); _pp.alto = Math.max(1e-4, alto);
  _pp.R = R; _pp.curva = curva; _pp.vertical = vertical;
  actualizarParche(geo, _pp);
}
// Z16: fija depthTest en los materiales del grupo (callback fijo → traverse sin allocations)
let _depthTestDe = true;
function fijarDepthTest(o: THREE.Object3D): void {
  const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
  if (!m) return;
  if (Array.isArray(m)) { for (const x of m) x.depthTest = _depthTestDe; }
  else m.depthTest = _depthTestDe;
}

/** Z14: lleva `mesh` (hijo del grupo `g`, sin padre transformado) a una pose de mundo
 *  interpolada entre la del panel (inicio) y la objetivo, con escala w×h·s. */
function posarDesdePanel(
  mesh: THREE.Object3D, g: THREE.Object3D, pPos: THREE.Vector3, pQuat: THREE.Quaternion,
  tPos: THREE.Vector3, tQuat: THREE.Quaternion, e: number, w: number, h: number, s: number,
): void {
  mesh.position.lerpVectors(pPos, tPos, e);
  g.worldToLocal(mesh.position);
  mesh.quaternion.slerpQuaternions(pQuat, tQuat, e).premultiply(_gqi);
  mesh.scale.set(w * s, h * s, 1);
}

/** Z14: línea guía (plano fino) entre dos puntos de MUNDO, mirando al ojo. */
function ponerLinea(mesh: THREE.Object3D, g: THREE.Object3D, aW: THREE.Vector3, bW: THREE.Vector3, ojoW: THREE.Vector3, grosor: number): void {
  _la.copy(aW); g.worldToLocal(_la);
  _lb.copy(bW); g.worldToLocal(_lb);
  _ojoL.copy(ojoW); g.worldToLocal(_ojoL);
  _ax.subVectors(_lb, _la);
  const len = Math.max(1e-4, _ax.length());
  _ax.multiplyScalar(1 / len);
  mesh.position.addVectors(_la, _lb).multiplyScalar(0.5);
  _az.subVectors(_ojoL, mesh.position);
  _az.addScaledVector(_ax, -_ax.dot(_az)).normalize();   // normal hacia el ojo, ⟂ a la línea
  _ay.crossVectors(_az, _ax);
  _mb.makeBasis(_ax, _ay, _az);
  mesh.quaternion.setFromRotationMatrix(_mb);
  mesh.scale.set(len, grosor, 1);
}
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
  out.u = u; out.v = v; out.t = t;  // t: parámetro afín → distancia en mundo sobre `dir` unitario
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
  // Z18: domo esférico — grupo en el ojo (marco capturado) y parches
  const domoRef  = useRef<THREE.Group>(null);
  const pPanel = useRef<THREE.Mesh>(null), pHist = useRef<THREE.Mesh>(null), pGal = useRef<THREE.Mesh>(null);
  const pFic = useRef<THREE.Mesh>(null), pPant = useRef<THREE.Mesh>(null);
  const pLinL = useRef<THREE.Mesh>(null), pLinR = useRef<THREE.Mesh>(null), pLinB = useRef<THREE.Mesh>(null);
  const geos = useMemo(() => {
    const su = DBG_SUBPANELES.ESF_SEG_U, sv = DBG_SUBPANELES.ESF_SEG_V;
    return {
      panel: crearParche(su, sv), hist: crearParche(su, sv), gal: crearParche(su, sv), fic: crearParche(su, sv),
      pant: crearParche(su, sv), linL: crearParche(su, 1), linR: crearParche(su, 1), linB: crearParche(su, 1),
    };
  }, []);
  useEffect(() => () => { for (const g of Object.values(geos)) g.dispose(); }, [geos]); // Z18: liberar geometrías
  // Z18: los parches comparten los materiales de los planos (texturas de canvas, pantalla CRT, líneas).
  // Se libera el material por defecto que three crea para cada Mesh sin material.
  useEffect(() => {
    const pares: [THREE.Mesh | null, THREE.Material | null][] = [
      [pHist.current, histMatRef.current], [pGal.current, galMatRef.current], [pFic.current, fichaMatRef.current],
      [pPant.current, pantMatRef.current], [pLinL.current, lineaMatRef.current],
      [pLinR.current, lineaMatRef.current], [pLinB.current, lineaMatRef.current],
    ];
    for (const [mesh, mat] of pares) {
      if (!mesh || !mat || mesh.material === mat) continue;
      (mesh.material as THREE.Material).dispose();
      mesh.material = mat;
    }
    const pp = pPanel.current;                    // el del panel se reemplaza al abrir (material del panel real)
    return () => { if (pp && !(pp.material as THREE.ShaderMaterial).isShaderMaterial) (pp.material as THREE.Material).dispose(); };
  }, []);

  // estado de animación / interacción (refs: sin re-render por frame)
  const anim = useRef({ t: 0, abierto: false, tDentro: 0, escala: 1, avisoEscala: false, capaUI: false, dtViejo: false, esfVersion: -1, esfT: -1, panelOculto: false, focoK: -1, focoId: "" as string }); // Z5…Z19
  const ui = useRef({
    pagina: 0, paginas: [[""]] as string[][], indice: 0,
    hover: null as string | null, sobre: null as "historia" | "galeria" | "ficha" | null,
    // Z11: estado de la retícula (refs, nunca setState): escala actual + último clic aceptado
    escalaPuntero: 1, tClic: -1e9,
  });
  const lienzos = useRef<{ historia: Lienzo | null; galeria: Lienzo | null; pantalla: Lienzo | null; ficha: Lienzo | null; datos: ProyectoDetalle | null }>(
    { historia: null, galeria: null, pantalla: null, ficha: null, datos: null });
  const imagenes = useRef(new Map<string, THREE.Texture>());
  const cargando = useRef(new Set<string>()); // Z11: precargas en curso
  const loader = useMemo(() => new THREE.TextureLoader(), []);

  // texturas vacías para que los materiales compilen con USE_MAP desde el inicio (sin recompilar al abrir)
  const vacia = useMemo(() => new THREE.Texture(), []);
  const uniformsPantalla = useMemo(() => ({
    uMap: { value: vacia as THREE.Texture }, uOverlay: { value: vacia as THREE.Texture },
    uHas: { value: 0 }, uTexAspect: { value: 1.5 }, uScreenAspect: { value: GALERIA_PANTALLA.w / GALERIA_PANTALLA.h },
    uAmbar: { value: 1 }, uScan: { value: 0.28 }, uCurva: { value: 0.08 },
    uAtenua: { value: 1 }, // Z19
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
    const onViz = () => { resetFoco(); }; // Z19: visualizer-activate cancela el foco
    window.addEventListener("alight:visualizer-activate", onViz);
    window.addEventListener("alight:panel-abierto", onAbierto);
    window.addEventListener("alight:panel-cerrado", onCerrado);
    return () => {
      window.removeEventListener("alight:visualizer-activate", onViz);
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
    // Z11: no se apaga la pantalla al cambiar: queda la imagen anterior hasta que llega la nueva
    if (!url) { mat.uniforms.uHas.value = 0; return; }
    const hit = imagenes.current.get(url);
    const aplicar = (tex: THREE.Texture) => {
      const img = tex.image as { width?: number; height?: number } | undefined;
      mat.uniforms.uMap.value = tex;
      mat.uniforms.uTexAspect.value = img?.width && img?.height ? img.width / img.height : 1.5;
      mat.uniforms.uHas.value = 1;
    };
    if (hit) { aplicar(hit); precargarVecinas(); return; }
    loader.load(url, tex => {
      tex.colorSpace = THREE.SRGBColorSpace;
      if (lienzos.current.datos !== d) { tex.dispose(); return; }  // cambió el proyecto mientras cargaba
      imagenes.current.set(url, tex);
      gl.initTexture(tex);
      if ((d.galeria[ui.current.indice] ?? d.foto) === url) { aplicar(tex); precargarVecinas(); }
    }, undefined, () => console.warn(`[Subpaneles] Z4: no cargó la imagen de galería ${url}`));
  };
  // Z11: precarga la anterior y la siguiente para que ANT / SIG no esperen la red
  const precargarVecinas = () => {
    const d = lienzos.current.datos;
    if (!d || d.galeria.length < 2) return;
    const n = d.galeria.length;
    for (const j of [(ui.current.indice + 1) % n, (ui.current.indice - 1 + n) % n]) {
      const u = d.galeria[j];
      if (!u || imagenes.current.has(u) || cargando.current.has(u)) continue;
      cargando.current.add(u);
      loader.load(u, tex => {
        cargando.current.delete(u);
        tex.colorSpace = THREE.SRGBColorSpace;
        if (lienzos.current.datos !== d) { tex.dispose(); return; }
        imagenes.current.set(u, tex);
        gl.initTexture(tex);
      }, undefined, () => cargando.current.delete(u));
    }
  };

  // ── lienzos por proyecto (se crean al llegar los datos, se liberan al cambiar/desmontar) ──
  useEffect(() => {
    if (!data) return;
    const h = crearLienzo(HISTORIA_SIZE.w, HISTORIA_SIZE.h);
    const g = crearLienzo(GALERIA_SIZE.w, GALERIA_SIZE.h);
    const p = crearLienzo(GALERIA_PANTALLA.w, GALERIA_PANTALLA.h);
    const f = crearLienzo(FICHA_SIZE.w, FICHA_SIZE.h);
    const imgs = imagenes.current;
    const carg = cargando.current; // Z11
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
      carg.clear(); // Z11: las precargas que lleguen tarde se descartan (datos distintos)
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
      // Z19: durante la entrada/salida del foco el botón se mueve bajo la retícula → se ignora
      if (FOCO.fase === "entrando" || FOCO.fase === "saliendo") return;
      // Z11: cooldown — no se reentra mientras dura el clic anterior
      const ahora = performance.now();
      if (ahora - u.tClic < DBG_SUBPANELES.PUNTERO_COOLDOWN_MS) return;
      u.tClic = ahora;                // dispara el pulso de la retícula (duración fija)
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
      if (A.capaUI) { A.capaUI = false; ponerEnCapaUI(g, false); if (domoRef.current) ponerEnCapaUI(domoRef.current, false); } // Z17
      // Z18: domo esférico oculto y panel real visible otra vez (vuelve a su órbita)
      if (domoRef.current && domoRef.current.visible) domoRef.current.visible = false;
      if (A.panelOculto) { A.panelOculto = false; if (ACERC.panel?.mesh) ACERC.panel.mesh.visible = true; }
      A.esfT = -1;
      // Z19: sin conjunto no hay foco; brillos de vuelta a 1
      if (FOCO.fase !== "nada" || FOCO.atenua !== 1) {
        resetFoco(); FOCO.atenua = 1;
        histMatRef.current?.color.setScalar(1); galMatRef.current?.color.setScalar(1); fichaMatRef.current?.color.setScalar(1);
        if (pantMatRef.current) pantMatRef.current.uniforms.uAtenua.value = 1;
        if (ACERC.panel?.uAtenua) ACERC.panel.uAtenua.value = 1;
      }
      LINTERNA_STATE.retener = false;
      if (INTERACT_STATE.panelBloqueo) INTERACT_STATE.panelBloqueo = false; // Z5
      return;
    }
    g.visible = true;
    // Z12: avisa a la linterna que el bloque terminó de aparecer (recién ahí 'abierto' y cuenta la gracia)
    if (A.t >= 1 && A.abierto && ACERC.panel && !ACERC.bloqueListo) ACERC.bloqueListo = true;
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
    const bloque = D.SUB_AJUSTE_BLOQUE && ACERC.panel !== null && (ACERC.fase === "cerca" || ACERC.fase === "abierto") // Z12
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
    let hw = MOCK.historia.w * m, hh = MOCK.historia.h * m;
    let gw = MOCK.galeria.w * m,  gh = MOCK.galeria.h * m;
    let fw = MOCK.ficha.w * m,    fh = MOCK.ficha.h * m;
    // Z16: domo cercano → tamaños angulares del layout (metros a DOMO_RADIO_M)
    const domo = bloque && D.SUB_CONCAVO && D.SUB_DOMO_CERCANO && !!ACERC.layout.domo;
    if (domo) {
      const Ld = ACERC.layout;
      hw = gw = Ld.latW ?? hw; hh = gh = Ld.latH ?? hh;
      fw = Ld.fichaW ?? fw;    fh = Ld.fichaH ?? fh;
    }
    // Z17: capa de interfaz = pase propio (capa CAPA_UI) con depth limpio; depthTest normal.
    // El modo de Z16 (depthTest off en la escena) queda solo detrás de DOMO_CAPA_DEPTHTEST_VIEJO.
    const capaUI = domo && D.DOMO_CAPA_UI && RETRO_FLAGS.enabled;
    if (capaUI !== A.capaUI) {
      A.capaUI = capaUI; ponerEnCapaUI(g, capaUI);
      if (domoRef.current) ponerEnCapaUI(domoRef.current, capaUI);  // Z18
      if (capaUI) CAPA_UI_ESTADO.activa = true;
    }
    const dtViejo = domo && D.DOMO_CAPA_DEPTHTEST_VIEJO;
    if (dtViejo !== A.dtViejo) { A.dtViejo = dtViejo; _depthTestDe = !dtViejo; g.traverse(fijarDepthTest); }
    const s = Math.max(0.001, e);

    const hist = historiaRef.current, gal = galeriaRef.current, fic = fichaRef.current;
    const li = lineaIzq.current, ld = lineaDer.current, lb = lineaAbajo.current;
    // líneas guía (aparecen en la segunda mitad de la animación)
    const la = D.SUB_LINEAS ? Math.max(0, (e - 0.5) * 2) : 0;
    const lm = lineaMatRef.current;
    // Z14: conjunto cóncavo alrededor del ojo del disparo (solo con el panel acercado)
    const concavo = bloque && D.SUB_CONCAVO && !!ACERC.layout.concavo;
    if (concavo) {
      const Lc = ACERC.layout, ojo = ACERC.camPos0, fac = Math.max(0.3, D.SUB_DIST_FACTOR);
      const yaw = Lc.yaw ?? 0, pitch = Lc.pitch ?? 0;
      g.updateMatrixWorld(true);
      _gqi.copy(g.quaternion).invert();
      _cV.subVectors(_v.pos, ojo);                                   // panel − ojo
      if (domo) {
        // Z16: marco RÍGIDO capturado — laterales giran sobre su UP (verticales en el marco,
        // arriba = UP del marco → sin roll aparente), FICHA gira sobre su RIGHT; todo a radio R.
        const R = Lc.d, ep = Lc.elevPanel ?? 0;
        _tq.setFromAxisAngle(ACERC.rF, ep);
        _ojoL.copy(ACERC.fF).applyQuaternion(_tq);                  // dirección del panel (elevación ep)
        for (let i = 0; i < 2; i++) {
          const mesh = i === 0 ? hist : gal;
          if (!mesh) continue;
          const sg = i === 0 ? 1 : -1;                               // HISTORIA +yaw (izq.), GALERÍA −yaw
          _gq2.setFromAxisAngle(ACERC.uF, sg * yaw);
          _tp.copy(_ojoL).applyQuaternion(_gq2).multiplyScalar(R).add(ojo);
          _tq.copy(_gq2).multiply(ACERC.qF);                         // vertical en el marco, de frente en yaw
          posarDesdePanel(mesh, g, _v.pos, _q, _tp, _tq, e, i === 0 ? hw : gw, i === 0 ? hh : gh, s);
        }
        if (fic) {
          _gq2.setFromAxisAngle(ACERC.rF, pitch);
          _tp.copy(ACERC.fF).applyQuaternion(_gq2).multiplyScalar(R).add(ojo);
          _tq.copy(ACERC.qF);                                        // vertical en el marco (arriba = UP): sin keystone
          posarDesdePanel(fic, g, _v.pos, _q, _tp, _tq, e, fw, fh, s);
        }
      }
      // HISTORIA: +yaw (izquierda) sobre la vertical del mundo, mirando al ojo
      if (hist && !domo) {
        _tp.copy(_cV).applyAxisAngle(_Y, yaw).multiplyScalar(fac).add(ojo);
        _tq.setFromRotationMatrix(_mb.lookAt(ojo, _tp, _Y));          // normal (+Z) exacta hacia el ojo, sin rolido
        posarDesdePanel(hist, g, _v.pos, _q, _tp, _tq, e, hw, hh, s);
      }
      if (gal && !domo) {
        _tp.copy(_cV).applyAxisAngle(_Y, -yaw).multiplyScalar(fac).add(ojo);
        _tq.setFromRotationMatrix(_mb.lookAt(ojo, _tp, _Y));
        posarDesdePanel(gal, g, _v.pos, _q, _tp, _tq, e, gw, gh, s);
      }
      // FICHA: pitch alrededor del eje horizontal derecho del panel
      if (fic && !domo) {
        _rH.crossVectors(_cV, _Y).normalize();
        _tp.copy(_cV).applyAxisAngle(_rH, pitch).multiplyScalar(fac).add(ojo);
        _tq.setFromRotationMatrix(_mb.lookAt(ojo, _tp, _Y));
        posarDesdePanel(fic, g, _v.pos, _q, _tp, _tq, e, fw, fh, s);
      }
      // líneas guía: del borde del panel al borde interior de cada subpanel (cuerda del arco)
      if (lm) { lm.uniforms.uAlpha.value = la; lm.uniforms.uLen.value = Math.max(gapL, gapA); }
      const vis = la > 0.01;
      if (li) li.visible = vis;
      if (ld) ld.visible = vis;
      if (lb) lb.visible = vis;
      // Z16: semiancho / semialto REALES del panel (en el domo cercano está escalado)
      const pxW = px * (domo ? (ACERC.panel?.escalaAcerc ?? 1) : 1), pyW = py * (domo ? (ACERC.panel?.escalaAcerc ?? 1) : 1);
      if (vis) {
        _ax.set(1, 0, 0).applyQuaternion(_q);                        // derecha del panel (mundo)
        if (li && hist) {
          _tp.copy(_v.pos).addScaledVector(_ax, -pxW);
          hist.getWorldPosition(_cV); _ay.set(1, 0, 0).applyQuaternion(hist.getWorldQuaternion(_tq));
          _cV.addScaledVector(_ay, hw * s / 2);
          ponerLinea(li, g, _tp, _cV, ojo, LINEA_GROSOR_M);
        }
        if (ld && gal) {
          _ax.set(1, 0, 0).applyQuaternion(_q);
          _tp.copy(_v.pos).addScaledVector(_ax, pxW);
          gal.getWorldPosition(_cV); _ay.set(1, 0, 0).applyQuaternion(gal.getWorldQuaternion(_tq));
          _cV.addScaledVector(_ay, -gw * s / 2);
          ponerLinea(ld, g, _tp, _cV, ojo, LINEA_GROSOR_M);
        }
        if (lb && fic) {
          _ay.set(0, 1, 0).applyQuaternion(_q);                      // arriba del panel
          _tp.copy(_v.pos).addScaledVector(_ay, -pyW);
          fic.getWorldPosition(_cV); _az.set(0, 1, 0).applyQuaternion(fic.getWorldQuaternion(_tq));
          _cV.addScaledVector(_az, fh * s / 2);
          ponerLinea(lb, g, _tp, _cV, ojo, LINEA_GROSOR_M);
        }
      }
    } else {
      // Z9 / Z8: bloque plano (orientaciones planas restauradas por si antes estuvo cóncavo)
      if (hist) { hist.position.set(-(px + gapL + hw / 2) * e, 0, 0); hist.quaternion.identity(); hist.scale.set(hw * s, hh * s, 1); }
      if (gal)  { gal.position.set((px + gapL + gw / 2) * e, 0, 0);   gal.quaternion.identity();  gal.scale.set(gw * s, gh * s, 1); }
      if (fic)  { fic.position.set(0, -(py + gapA + fh / 2) * e, 0);  fic.quaternion.identity();  fic.scale.set(fw * s, fh * s, 1); }
      if (lm) { lm.uniforms.uAlpha.value = la; lm.uniforms.uLen.value = Math.max(gapL, gapA); }
      if (li) { li.visible = la > 0.01; li.position.set(-(px + gapL / 2), 0, 0.01); li.quaternion.identity(); li.scale.set(gapL, LINEA_GROSOR_M, 1); }
      if (ld) { ld.visible = la > 0.01; ld.position.set(px + gapL / 2, 0, 0.01);    ld.quaternion.identity(); ld.scale.set(gapL, LINEA_GROSOR_M, 1); }
      if (lb) { lb.visible = la > 0.01; lb.position.set(0, -(py + gapA / 2), 0.01); lb.quaternion.setFromAxisAngle(_Z, _PI2); lb.scale.set(gapA, LINEA_GROSOR_M, 1); }
    }

    // Z17: aislar elementos (debug). "todo" = normal.
    {
      const M = DBG_AISLAR_UI.MODO;
      const todos = M === "todo" || M === "sin_marco" || M === "sin_orbita";
      if (hist) hist.visible = todos || M === "historia";
      if (gal)  gal.visible  = todos || M === "galeria";
      if (fic)  fic.visible  = todos || M === "ficha";
      const pm0 = ACERC.panel?.mesh;
      if (pm0) pm0.visible = todos || M === "panel";
      if (M !== "todo" && M !== "sin_orbita") { if (li) li.visible = false; if (ld) ld.visible = false; if (lb) lb.visible = false; }
    }

    // ── Z18: domo ESFÉRICO — parches de esfera de radio R alrededor del ojo, en el marco capturado ──
    const esferico = concavo && domo && D.SUB_DOMO_ESFERICO && !!ACERC.layout.esferico;
    const dg = domoRef.current;
    if (dg) dg.visible = esferico;
    if (esferico && dg) {
      const L = ACERC.layout, R = L.d;
      dg.position.copy(ACERC.camPos0); dg.quaternion.copy(ACERC.qF);
      // los planos de Z4/Z16 no se dibujan; el panel real se oculta mientras está su parche
      if (hist) hist.visible = false;
      if (gal) gal.visible = false;
      if (fic) fic.visible = false;
      if (li) li.visible = false;
      if (ld) ld.visible = false;
      if (lb) lb.visible = false;
      const pmReal = ACERC.panel?.mesh as THREE.Mesh | undefined;
      if (pmReal) { pmReal.visible = false; A.panelOculto = true; }
      // material del panel: el mismo ShaderMaterial del panel real (uLit, uReveal, haces…)
      const pPm = pPanel.current;
      if (pPm && pmReal && pPm.material !== pmReal.material) pPm.material = pmReal.material;
      // aislar (debug)
      const M = DBG_AISLAR_UI.MODO;
      const todos = M === "todo" || M === "sin_marco" || M === "sin_orbita";
      if (pPm) pPm.visible = todos || M === "panel";
      if (pHist.current) pHist.current.visible = todos || M === "historia";
      if (pGal.current)  pGal.current.visible  = todos || M === "galeria";
      if (pPant.current) pPant.current.visible = todos || M === "galeria";
      if (pFic.current)  pFic.current.visible  = todos || M === "ficha";
      const verLineas = (M === "todo" || M === "sin_orbita") && la > 0.01;
      if (pLinL.current) pLinL.current.visible = verLineas;
      if (pLinR.current) pLinR.current.visible = verLineas;
      if (pLinB.current) pLinB.current.visible = verLineas;
      // geometría: solo mientras anima o si cambió el layout (resize)
      // Z19: parámetros efectivos de cada subpanel (aparición desde el panel + mezcla de foco)
      const pY = L.pYaw ?? 0, pP = L.pPitch ?? 0, pA = L.pAncho ?? 0.8, pH = L.pAlto ?? 0.5;
      {
        const k0 = 0.12;                                           // tamaño inicial relativo (sale del panel)
        const lY = L.lYaw ?? 0, lP = L.lPitch ?? 0, lA = L.lAncho ?? 0.5, lH = L.lAlto ?? 0.6;
        const fY = L.fYaw ?? 0, fP = L.fPitch ?? 0, fA = L.fAncho ?? 0.7, fH = L.fAlto ?? 0.35;
        const ka = k0 + (1 - k0) * e;
        ponerEF(_efH, "historia", pY + (-lY - pY) * e, pP + (lP - pP) * e, lA * ka, lH * ka, R);
        ponerEF(_efG, "galeria",  pY + ( lY - pY) * e, pP + (lP - pP) * e, lA * ka, lH * ka, R);
        ponerEF(_efF, "ficha",    pY + (fY - pY) * e, pP + (fP - pP) * e, fA * ka, fH * ka, R);
      }
      const focoK = FOCO.fEase, focoId = FOCO.id ?? "";
      if (A.esfT !== e || A.esfVersion !== ACERC.layoutVersion || A.focoK !== focoK || A.focoId !== focoId) {
        A.esfT = e; A.esfVersion = ACERC.layoutVersion; A.focoK = focoK; A.focoId = focoId;
        // panel: del plano tangente (igual al panel real que llegó) a la esfera
        ponerParche(geos.panel, pY, pP, pA, pH, R, e, false);
        ponerParche(geos.hist, _efH.yaw, _efH.pitch, _efH.ancho, _efH.alto, _efH.R, 1, false);
        ponerParche(geos.gal,  _efG.yaw, _efG.pitch, _efG.ancho, _efG.alto, _efG.R, 1, false);
        // pantalla CRT de GALERÍA: sub-parche (rect. GALERIA_PANTALLA) apenas delante de GALERÍA
        {
          const ux = (GALERIA_PANTALLA.x + GALERIA_PANTALLA.w / 2) / GALERIA_SIZE.w - 0.5;
          const vy = 0.5 - (GALERIA_PANTALLA.y + GALERIA_PANTALLA.h / 2) / GALERIA_SIZE.h;
          ponerParche(geos.pant, _efG.yaw + ux * _efG.ancho, _efG.pitch + vy * _efG.alto,
            _efG.ancho * GALERIA_PANTALLA.w / GALERIA_SIZE.w, _efG.alto * GALERIA_PANTALLA.h / GALERIA_SIZE.h, _efG.R * 0.998, 1, false);
        }
        ponerParche(geos.fic, _efF.yaw, _efF.pitch, _efF.ancho, _efF.alto, _efF.R, 1, false);
        // líneas guía: arcos sobre la esfera entre bordes (un poco delante)
        const gr = Math.max(0.05, D.ESF_LINEA_GROSOR_DEG) * Math.PI / 180, sep = L.sep ?? 0.05;
        ponerParche(geos.linL, pY - pA / 2 - sep / 2, pP, sep, gr, R - 0.01, 1, false);
        ponerParche(geos.linR, pY + pA / 2 + sep / 2, pP, sep, gr, R - 0.01, 1, false);
        ponerParche(geos.linB, pY, pP - pH / 2 - sep / 2, gr, sep, R - 0.01, 1, true);
        if (lm) lm.uniforms.uLen.value = Math.max(0.05, R * sep);
      }
      if (lm) lm.uniforms.uAlpha.value = la * FOCO.atenua;           // Z19: atenuadas con foco
      // Z19: prioridad (renderOrder único superior + radio menor) y atenuación del resto
      const fid = FOCO.fase !== "nada" ? FOCO.id : null;
      if (pHist.current) pHist.current.renderOrder = fid === "historia" ? RO + 10 : RO + 1;
      if (pGal.current)  pGal.current.renderOrder  = fid === "galeria"  ? RO + 10 : RO + 2;
      if (pPant.current) pPant.current.renderOrder = fid === "galeria"  ? RO + 11 : RO + 3;
      if (pFic.current)  pFic.current.renderOrder  = fid === "ficha"    ? RO + 10 : RO + 4;
      const at = FOCO.atenua;
      histMatRef.current?.color.setScalar(fid === "historia" ? 1 : at);
      galMatRef.current?.color.setScalar(fid === "galeria" ? 1 : at);
      fichaMatRef.current?.color.setScalar(fid === "ficha" ? 1 : at);
      if (pantMatRef.current) pantMatRef.current.uniforms.uAtenua.value = fid === "galeria" ? 1 : at;
      if (ACERC.panel?.uAtenua) ACERC.panel.uAtenua.value = at;     // el panel central (Z10 no lo toca)
    } else if (A.panelOculto && ACERC.panel?.mesh) {
      // se apagó el modo esférico con el panel abierto: el panel real vuelve a verse
      A.panelOculto = false; ACERC.panel.mesh.visible = true;
    }

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
    let tMin = 1e9;                                   // Z14: distancia al primer impacto (retícula)
    const pad = Math.max(0, D.SUB_RETENER_PAD_M);
    // Z18/Z19: rayo–esfera (centrada en el ojo) por radio y la inversa del mapeo de cada parche,
    // con los parámetros EFECTIVOS (pose animada real, incluido el foco). El de foco va primero.
    if (esferico) {
      const L = ACERC.layout;
      _qfi.copy(ACERC.qF).invert();
      _eo.copy(_v.cam).sub(ACERC.camPos0).applyQuaternion(_qfi);   // ojo actual en el marco
      _ed.copy(_v.fwd).applyQuaternion(_qfi);
      const mAng = pad / Math.max(0.5, L.d);
      const orden: FocoId[] = FOCO.id === "galeria" ? ORDEN_G : FOCO.id === "ficha" ? ORDEN_F : ORDEN_H;
      for (const id of orden) {
        const ef = efDe(id);
        rayoEsfera(_eo, _ed, ef.R);
        if (!_hitEsf.ok) continue;
        _box.yaw = ef.yaw; _box.pitch = ef.pitch; _box.ancho = ef.ancho; _box.alto = ef.alto;
        if (!uvDeParche(_hitEsf.yaw, _hitEsf.pitch, _box, mAng / Math.max(1e-3, ef.ancho))) continue;
        dentroAlgo = true; tMin = Math.min(tMin, _hitEsf.t);
        if (listo && UV_PARCHE.u >= 0 && UV_PARCHE.u <= 1 && UV_PARCHE.v >= 0 && UV_PARCHE.v <= 1) {
          sobre = id;
          if (id === "historia") { _hit.cx = UV_PARCHE.u * HISTORIA_SIZE.w; _hit.cy = UV_PARCHE.v * HISTORIA_SIZE.h; }
          if (id === "galeria")  { _hit.cx = UV_PARCHE.u * GALERIA_SIZE.w;  _hit.cy = UV_PARCHE.v * GALERIA_SIZE.h; }
          break;
        }
      }
      // panel central (cuenta como "dentro")
      rayoEsfera(_eo, _ed, L.d);
      if (_hitEsf.ok) {
        _box.yaw = L.pYaw ?? 0; _box.pitch = L.pPitch ?? 0; _box.ancho = L.pAncho ?? 0; _box.alto = L.pAlto ?? 0;
        if (uvDeParche(_hitEsf.yaw, _hitEsf.pitch, _box, mAng / Math.max(1e-3, _box.ancho))) { dentroAlgo = true; tMin = Math.min(tMin, _hitEsf.t); }
      }
    } else
    // subpaneles: planos unitarios escalados → UV directo (con margen `pad` solo para retener)
    if (rayoUV(hist, 1, 1, _v.cam, _v.fwd, _hit, pad / Math.max(0.001, hw))) {
      dentroAlgo = true; if (_hit.dentro) tMin = Math.min(tMin, _hit.t);
      if (listo && _hit.dentro) { sobre = "historia"; _hit.cx = _hit.u * HISTORIA_SIZE.w; _hit.cy = (1 - _hit.v) * HISTORIA_SIZE.h; }
    }
    if (!sobre && rayoUV(gal, 1, 1, _v.cam, _v.fwd, _hit, pad / Math.max(0.001, gw))) {
      dentroAlgo = true; if (_hit.dentro) tMin = Math.min(tMin, _hit.t);
      if (listo && _hit.dentro) { sobre = "galeria"; _hit.cx = _hit.u * GALERIA_SIZE.w; _hit.cy = (1 - _hit.v) * GALERIA_SIZE.h; }
    }
    if (!sobre && rayoUV(fic, 1, 1, _v.cam, _v.fwd, _hit, pad / Math.max(0.001, fw))) {
      dentroAlgo = true; if (_hit.dentro) tMin = Math.min(tMin, _hit.t);
      if (listo && _hit.dentro) sobre = "ficha";
    }
    // el panel abierto también cuenta como "dentro" (su geometría mide panelAncho × panelAlto)
    if (!dentroAlgo && rayoUV(LINTERNA_STATE.sel?.mesh ?? null, panelAncho, panelAlto, _v.cam, _v.fwd, _hit, pad / panelAncho)) dentroAlgo = true;
    // Z11: zonas de hit FIJAS en UV del canvas (no dependen del dibujo ni de la retícula), con
    // histéresis: el botón ya señalado se suelta recién al salir de su rectángulo agrandado.
    const hPrev = ui.current.hover, mH = Math.max(0, D.PUNTERO_HISTERESIS);
    if (sobre === "historia") {
      if (hPrev === "arriba" && ui.current.sobre === "historia" && dentroAmpliado(HISTORIA_BOTONES.arriba, _hit.cx, _hit.cy, mH)) hover = "arriba";
      else if (hPrev === "abajo" && ui.current.sobre === "historia" && dentroAmpliado(HISTORIA_BOTONES.abajo, _hit.cx, _hit.cy, mH)) hover = "abajo";
      else if (dentro(HISTORIA_BOTONES.arriba, _hit.cx, _hit.cy)) hover = "arriba";
      else if (dentro(HISTORIA_BOTONES.abajo, _hit.cx, _hit.cy)) hover = "abajo";
    } else if (sobre === "galeria") {
      if (hPrev === "ant" && ui.current.sobre === "galeria" && dentroAmpliado(GALERIA_BOTONES.ant, _hit.cx, _hit.cy, mH)) hover = "ant";
      else if (hPrev === "sig" && ui.current.sobre === "galeria" && dentroAmpliado(GALERIA_BOTONES.sig, _hit.cx, _hit.cy, mH)) hover = "sig";
      else if (dentro(GALERIA_BOTONES.ant, _hit.cx, _hit.cy)) hover = "ant";
      else if (dentro(GALERIA_BOTONES.sig, _hit.cx, _hit.cy)) hover = "sig";
    }

    // ── Z19: FOCO de un subpanel (dwell → entrando → foco → saliendo), con histéresis y cooldown ──
    {
      const F = DBG_FOCO;
      const dur = Math.max(1, F.FOCO_MS);
      const activo = F.SUB_FOCO && esferico && A.abierto && listo;
      if (FOCO.fase === "entrando") { FOCO.f = Math.min(1, FOCO.f + dt * 1000 / dur); if (FOCO.f >= 1) FOCO.fase = "foco"; }
      else if (FOCO.fase === "saliendo") { FOCO.f = Math.max(0, FOCO.f - dt * 1000 / dur); if (FOCO.f <= 0) { FOCO.fase = "nada"; FOCO.id = null; } }
      FOCO.fEase = easingFoco(FOCO.f);
      const objAt = FOCO.fase === "entrando" || FOCO.fase === "foco" ? THREE.MathUtils.clamp(F.FOCO_OTROS_OPACIDAD, 0, 1) : 1;
      FOCO.atenua += (objAt - FOCO.atenua) * (1 - Math.exp(-dt * 3000 / dur));
      const cooldownOk = now - FOCO.tUltima >= F.FOCO_COOLDOWN_S * 1000;
      if (!activo) {
        if (FOCO.fase === "entrando" || FOCO.fase === "foco") { FOCO.fase = "saliendo"; FOCO.tUltima = now; }
        FOCO.candidato = null;
      } else if (FOCO.fase === "nada") {
        // dwell sobre un subpanel (estricto, sin margen)
        if (sobre) {
          if (FOCO.candidato !== sobre) { FOCO.candidato = sobre; FOCO.tCand = now; }
          if (now - FOCO.tCand >= F.FOCO_DWELL_S * 1000 && cooldownOk) {
            const L = ACERC.layout, id = sobre as FocoId;
            const yc = id === "historia" ? -(L.lYaw ?? 0) : id === "galeria" ? (L.lYaw ?? 0) : (L.fYaw ?? 0);
            const pc = id === "ficha" ? (L.fPitch ?? 0) : (L.lPitch ?? 0);
            const w = id === "ficha" ? (L.fAncho ?? 0.7) : (L.lAncho ?? 0.5), h = id === "ficha" ? (L.fAlto ?? 0.35) : (L.lAlto ?? 0.6);
            camera.getWorldQuaternion(_tq);
            _qCamM.copy(_qfi).multiply(_tq);                         // cámara actual en el marco
            const pcam = camera as THREE.PerspectiveCamera;
            calcularFocoObjetivo(yc, pc, w, h, _qCamM, pcam.isPerspectiveCamera ? pcam.fov : 60,
              pcam.isPerspectiveCamera ? pcam.aspect : 16 / 9, RETRO_FLAGS.enabled ? (CRT_UNIFORMS.uCurve.value as number) : 0);
            FOCO.id = id; FOCO.fase = "entrando"; FOCO.f = 0; FOCO.tUltima = now; FOCO.tFuera = 0; FOCO.candidato = null;
          }
        } else FOCO.candidato = null;
      } else if ((FOCO.fase === "entrando" || FOCO.fase === "foco") && FOCO.id) {
        // salida con histéresis: margen alrededor del subpanel agrandado + gracia + cooldown
        const ef = efDe(FOCO.id);
        rayoEsfera(_eo, _ed, ef.R);
        _box.yaw = ef.yaw; _box.pitch = ef.pitch; _box.ancho = ef.ancho; _box.alto = ef.alto;
        const m = Math.max(0, F.FOCO_SALIDA_MARGEN_DEG) * Math.PI / 180;
        const dentroFoco = _hitEsf.ok && uvDeParche(_hitEsf.yaw, _hitEsf.pitch, _box, m / Math.max(1e-3, Math.min(ef.ancho, ef.alto)));
        if (dentroFoco) FOCO.tFuera = 0;
        else {
          if (FOCO.tFuera === 0) FOCO.tFuera = now;
          if (now - FOCO.tFuera >= F.FOCO_GRACIA_S * 1000 && cooldownOk) { FOCO.fase = "saliendo"; FOCO.tUltima = now; FOCO.tFuera = 0; }
        }
      }
    }

    // Z5: gracia — si el puntero sale, espera PUNTERO_GRACIA_MS antes de soltar el panel
    if (dentroAlgo || A.tDentro === 0) A.tDentro = now;
    const enGracia = now - A.tDentro <= D.PUNTERO_GRACIA_MS;
    LINTERNA_STATE.retener = A.abierto && A.t > 0.5 && (dentroAlgo || enGracia);
    // Z5: bloqueo opcional del movimiento mientras hay un panel abierto
    INTERACT_STATE.panelBloqueo = D.PANEL_BLOQUEA_MOVIMIENTO && A.abierto;

    const u = ui.current;
    if (hover !== u.hover || sobre !== u.sobre) {
      // Z11: se redibuja un canvas solo si cambió el botón señalado EN ese subpanel
      const hHistAntes = u.sobre === "historia" ? u.hover : null, hHist = sobre === "historia" ? hover : null;
      const hGalAntes  = u.sobre === "galeria"  ? u.hover : null, hGal  = sobre === "galeria"  ? hover : null;
      u.hover = hover; u.sobre = sobre;
      if (hHistAntes !== hHist) redibujarHistoria();
      if (hGalAntes !== hGal)   redibujarGaleria();
    }

    // Z5: retícula clara en el centro de pantalla, sobre el plano del conjunto
    const pt = punteroRef.current;
    if (pt) {
      let ver = D.SUB_PUNTERO && A.abierto && A.t > 0.5;
      if (ver && concavo) {
        // Z14: retícula en el centro de pantalla, justo delante de lo que se mira, de frente a la cámara
        const dist = tMin < 1e8 ? tMin * 0.97 : (ACERC.layout.dLat ?? ACERC.layout.d) * 0.97;
        pt.position.copy(_v.cam).addScaledVector(_v.fwd, dist);
        g.worldToLocal(pt.position);
        camera.getWorldQuaternion(_tq);
        pt.quaternion.copy(_tq).premultiply(_gqi);
        const pulso = now - u.tClic < D.PUNTERO_PULSO_MS;
        const objetivo = pulso ? D.PUNTERO_ESCALA_CLIC : hover ? D.PUNTERO_ESCALA_HOVER : 1;
        u.escalaPuntero += (objetivo - u.escalaPuntero) * (1 - Math.exp(-Math.max(0.1, D.PUNTERO_SUAVIZADO_S) * dt));
        const r = D.PUNTERO_RADIO_M / 0.21 * u.escalaPuntero * (dist / Math.max(0.1, ACERC.layout.d)); // tamaño en pantalla constante
        pt.scale.set(r, r, 1);
      } else if (ver) {
        pt.quaternion.identity();
        _v.inv.copy(g.matrixWorld).invert();
        _v.o.copy(_v.cam).applyMatrix4(_v.inv);
        _v.d.copy(_v.cam).add(_v.fwd).applyMatrix4(_v.inv).sub(_v.o);
        const t = Math.abs(_v.d.z) > 1e-6 ? -_v.o.z / _v.d.z : -1;
        ver = t > 0;
        if (ver) {
          pt.position.set(_v.o.x + _v.d.x * t, _v.o.y + _v.d.y * t, 0.03);
          // Z11: un único objetivo (pulso de clic > hover > normal) e interpolación suave
          const pulso = now - u.tClic < D.PUNTERO_PULSO_MS;
          const objetivo = pulso ? D.PUNTERO_ESCALA_CLIC : hover ? D.PUNTERO_ESCALA_HOVER : 1;
          u.escalaPuntero += (objetivo - u.escalaPuntero) * (1 - Math.exp(-Math.max(0.1, D.PUNTERO_SUAVIZADO_S) * dt));
          const r = D.PUNTERO_RADIO_M / 0.21 * u.escalaPuntero;   // geometría base: radio medio 0.21 m
          pt.scale.set(r, r, 1);
        }
      }
      pt.visible = ver;
    }
  });

  return (
    <>
    <group ref={groupRef} visible={false}>
      <mesh ref={historiaRef} renderOrder={RO + 1}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial ref={histMatRef} map={vacia} toneMapped={false} fog={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={galeriaRef} renderOrder={RO + 1}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial ref={galMatRef} map={vacia} toneMapped={false} fog={false} side={THREE.DoubleSide} />
        {/* pantalla CRT: hija del marco, en coordenadas normalizadas del canvas */}
        <mesh
          renderOrder={RO + 2}
          position={[
            (GALERIA_PANTALLA.x + GALERIA_PANTALLA.w / 2) / GALERIA_SIZE.w - 0.5,
            0.5 - (GALERIA_PANTALLA.y + GALERIA_PANTALLA.h / 2) / GALERIA_SIZE.h,
            0.004,
          ]}
          scale={[GALERIA_PANTALLA.w / GALERIA_SIZE.w, GALERIA_PANTALLA.h / GALERIA_SIZE.h, 1]}
        >
          <planeGeometry args={[1, 1]} />
          <shaderMaterial ref={pantMatRef} uniforms={uniformsPantalla} vertexShader={PANTALLA_VERT} fragmentShader={PANTALLA_FRAG} side={THREE.DoubleSide} />
        </mesh>
      </mesh>
      <mesh ref={fichaRef} renderOrder={RO + 1}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial ref={fichaMatRef} map={vacia} toneMapped={false} fog={false} side={THREE.DoubleSide} />
      </mesh>
      {/* líneas guía: un material compartido */}
      <mesh ref={lineaIzq} renderOrder={RO + 3}>
        <planeGeometry args={[1, 1]} />
        <shaderMaterial ref={lineaMatRef} uniforms={uniformsLinea} vertexShader={PANTALLA_VERT} fragmentShader={LINEA_FRAG} transparent depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={lineaDer} renderOrder={RO + 3}>
        <planeGeometry args={[1, 1]} />
        <shaderMaterial uniforms={uniformsLinea} vertexShader={PANTALLA_VERT} fragmentShader={LINEA_FRAG} transparent depthWrite={false} />
      </mesh>
      <mesh ref={lineaAbajo} renderOrder={RO + 3} rotation={[0, 0, Math.PI / 2]}>
        <planeGeometry args={[1, 1]} />
        <shaderMaterial uniforms={uniformsLinea} vertexShader={PANTALLA_VERT} fragmentShader={LINEA_FRAG} transparent depthWrite={false} />
      </mesh>
      {/* puntero: aro claro donde apunta la mirada (mockup: círculo sobre SIG ▶) */}
      <mesh ref={punteroRef} renderOrder={RO + 12} visible={false}> {/* Z19: encima del subpanel en foco (era RO + 9) */}
        <ringGeometry args={[0.18, 0.24, 32]} />
        <meshBasicMaterial color="#FFF3DC" transparent opacity={0.85} depthWrite={false} toneMapped={false} fog={false} />
      </mesh>
    </group>
    {/* Z18: domo esférico — parches de esfera en el marco capturado (grupo en el ojo, renderOrder 0).
        Comparten materiales con los planos (dispose={null}: los libera su dueño). renderOrder únicos y
        crecientes: panel < HISTORIA < GALERÍA < pantalla < FICHA < líneas (< marco SEL < retícula). */}
    <group ref={domoRef} visible={false}>
      <mesh ref={pPanel} geometry={geos.panel} renderOrder={RO + 0} frustumCulled={false} dispose={null} />
      <mesh ref={pHist}  geometry={geos.hist}  renderOrder={RO + 1} frustumCulled={false} dispose={null} />
      <mesh ref={pGal}   geometry={geos.gal}   renderOrder={RO + 2} frustumCulled={false} dispose={null} />
      <mesh ref={pPant}  geometry={geos.pant}  renderOrder={RO + 3} frustumCulled={false} dispose={null} />
      <mesh ref={pFic}   geometry={geos.fic}   renderOrder={RO + 4} frustumCulled={false} dispose={null} />
      <mesh ref={pLinL}  geometry={geos.linL}  renderOrder={RO + 5} frustumCulled={false} dispose={null} />
      <mesh ref={pLinR}  geometry={geos.linR}  renderOrder={RO + 5} frustumCulled={false} dispose={null} />
      <mesh ref={pLinB}  geometry={geos.linB}  renderOrder={RO + 5} frustumCulled={false} dispose={null} />
    </group>
    </>
  );
}
