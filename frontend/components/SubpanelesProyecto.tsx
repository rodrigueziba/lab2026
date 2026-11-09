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
import { LINTERNA_STATE } from "@/lib/linternaPaneles";
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
  const anim = useRef({ t: 0, abierto: false });
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
      setEst(prev => ({ proyectoId: det.proyectoId as number, abierto: true, n: (prev?.n ?? 0) + 1 }));
    };
    const onCerrado = () => {
      anim.current.abierto = false;
      LINTERNA_STATE.retener = false;
      setEst(prev => (prev ? { ...prev, abierto: false } : prev));
    };
    window.addEventListener("alight:panel-abierto", onAbierto);
    window.addEventListener("alight:panel-cerrado", onCerrado);
    return () => {
      window.removeEventListener("alight:panel-abierto", onAbierto);
      window.removeEventListener("alight:panel-cerrado", onCerrado);
      LINTERNA_STATE.retener = false;
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
      return;
    }
    g.visible = true;
    // salida: ease-out al abrir; el cierre recorre la misma curva al revés
    const e = 1 - Math.pow(1 - A.t, 3);

    // medidas (en vivo desde debug)
    const m = D.SUB_M_POR_PX;
    const hw = MOCK.historia.w * m, hh = MOCK.historia.h * m;
    const gw = MOCK.galeria.w * m,  gh = MOCK.galeria.h * m;
    const fw = MOCK.ficha.w * m,    fh = MOCK.ficha.h * m;
    const px = panelAncho / 2, py = panelAlto / 2;
    const gapL = D.SUB_GAP_LATERAL_M, gapA = D.SUB_GAP_ABAJO_M;
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

    // ── mirada (centro de pantalla) sobre el plano del conjunto ──
    g.updateMatrixWorld(true);
    camera.getWorldPosition(_v.cam);
    camera.getWorldDirection(_v.fwd);
    _v.inv.copy(g.matrixWorld).invert();
    _v.o.copy(_v.cam).applyMatrix4(_v.inv);
    _v.d.copy(_v.cam).add(_v.fwd).applyMatrix4(_v.inv).sub(_v.o);
    let hx = 1e9, hy = 1e9;
    if (Math.abs(_v.d.z) > 1e-6) {
      const t = -_v.o.z / _v.d.z;
      if (t > 0) { hx = _v.o.x + _v.d.x * t; hy = _v.o.y + _v.d.y * t; }
    }
    const pad = D.SUB_RETENER_PAD_M;
    const xMax = px + gapL + Math.max(hw, gw) + pad;
    const yMax = Math.max(py, hh / 2, gh / 2) + pad;
    const yMin = -(py + gapA + fh) - pad;
    LINTERNA_STATE.retener = A.abierto && A.t > 0.5 && Math.abs(hx) <= xMax && hy <= yMax && hy >= yMin;

    // subpanel y botón bajo la mirada (solo con la animación completa)
    let sobre: "historia" | "galeria" | "ficha" | null = null;
    let hover: string | null = null;
    let cx = 0, cy = 0;
    const probar = (mesh: THREE.Mesh | null, id: "historia" | "galeria" | "ficha", cw: number, ch: number) => {
      if (!mesh || sobre) return;
      const u = (hx - mesh.position.x) / mesh.scale.x + 0.5;
      const v = (hy - mesh.position.y) / mesh.scale.y + 0.5;
      if (u >= 0 && u <= 1 && v >= 0 && v <= 1) { sobre = id; cx = u * cw; cy = (1 - v) * ch; }
    };
    if (A.t >= 1) {
      probar(hist, "historia", HISTORIA_SIZE.w, HISTORIA_SIZE.h);
      probar(gal, "galeria", GALERIA_SIZE.w, GALERIA_SIZE.h);
      probar(fic, "ficha", FICHA_SIZE.w, FICHA_SIZE.h);
      if (sobre === "historia") {
        if (dentro(HISTORIA_BOTONES.arriba, cx, cy)) hover = "arriba";
        else if (dentro(HISTORIA_BOTONES.abajo, cx, cy)) hover = "abajo";
      } else if (sobre === "galeria") {
        if (dentro(GALERIA_BOTONES.ant, cx, cy)) hover = "ant";
        else if (dentro(GALERIA_BOTONES.sig, cx, cy)) hover = "sig";
      }
    }
    const u = ui.current;
    if (hover !== u.hover || sobre !== u.sobre) {
      const antes = u.sobre;
      u.hover = hover; u.sobre = sobre;
      if (antes === "historia" || sobre === "historia") redibujarHistoria();
      if (antes === "galeria" || sobre === "galeria") redibujarGaleria();
    }
    const pt = punteroRef.current;
    if (pt) {
      pt.visible = D.SUB_PUNTERO && sobre !== null;
      if (pt.visible) pt.position.set(hx, hy, 0.03);
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
