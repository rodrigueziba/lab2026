"use client";
// Z74: extensión del pasto hasta el borde del círculo del piso (lógica pura: lib/pastoExt.ts). Se monta junto a Pasto
// (ExperienceDome, con el visualizador activo) y usa EXACTAMENTE su shader (FRAG_PASTO con el define EXT), su textura de
// briznas, su viento y sus uniforms comunes (COMUN de Pasto.tsx): sin costura en el borde del rectángulo.
//  · bloques de ~CHUNK_M (lib/pastoExt armarBloquesExt) que tocan la zona: cada uno un InstancedMesh con capas, pero
//    solo se dibujan los elegibles (con pasto por progreso, dentro de DIST_MAX_M y en cuadro), como mucho
//    EXT_MAX_BLOQUES y primero los más cercanos (seleccionarBloques, arreglos preasignados), con el LOD de Z66;
//  · más allá, un único suelo lejano barato (sin capas, con ruido) hasta el borde del círculo, con el mismo frente.
// Estado en PASTO.ext / extFase (lib/pasto.ts: reiniciarPasto la vuelve a 0) y evento alight:pasto-extendido.
// Sin allocations por frame; materiales, textura y geometrías se crean una vez y se liberan al desmontar.

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { DBG_PASTO, DBG_RENDIMIENTO, DEBUG_ENABLED } from "@/lib/debugConfig";
import { PASTO, completarCuarto, rectPasto, umbralPasto, manchaPasto } from "@/lib/pasto";
import { capasLod, ordenCapas, type CfgLod } from "@/lib/pastoChunks";
import { avanzarExtension, extenderAhora, reiniciarExtension, radioExt, armarBloquesExt, umbralMinBloqueExt,
  seleccionarBloques, radioRecorteMonolito, type BloqueExt } from "@/lib/pastoExt";
import { MONO_PASTO, monolitosMontados } from "@/lib/monolitosPasto";
import { hazPosXZEn } from "@/lib/haz";
import { RELOJ } from "@/lib/relojExperiencia";
import { MONOLITO_ANCHO_M } from "./Monoliths";
import { crearTexturaBriznas, VERT_PASTO, FRAG_PASTO, COMUN, definesPasto, esferaBloque, MAX_CAPAS, SEG_CHUNK, Y_PASTO, Y_LEJANO } from "./Pasto";

/** Lecturas para el panel de rendimiento y el overlay. */
export const PASTO_EXT_RENDER = { montado: false, bloques: 0, elegibles: 0, dibujados: 0, instancias: 0, lejano: false, radio: 0 };
const MAX_BLOQUES_TOPE = 200;

const EXT_U = {
  uPExt: { value: 0 }, uExtR: { value: 28 }, uExtBrillo: { value: 0.45 }, uExtOverlay: { value: 0 },
  uMonoR: { value: 1.24 }, uMono: { value: new THREE.Vector4(1e4, 1e4, 1e4, 1e4) },
  uIrr: { value: 0.6 },   // la extensión usa EXT_IRREGULARIDAD (los cuartos, IRREGULARIDAD)
};

function aplicarDefinesExt(mats: THREE.ShaderMaterial[], lejano: boolean[]): void {
  mats.forEach((m, i) => { m.defines = { ...definesPasto(lejano[i]), EXT: "" }; m.needsUpdate = true; });
}
/** Textura con o sin mipmaps (fuera del componente: el material es estable y se muta en el lugar). */
function fijarTextura(m: THREE.ShaderMaterial, t: THREE.Texture): void { if (m.uniforms.uBriznas.value !== t) m.uniforms.uBriznas.value = t; }
function marcarCapas(aH: THREE.InstancedBufferAttribute, capas: number): void { ordenCapas(capas, aH.array as Float32Array); aH.needsUpdate = true; }

export default function PastoExtension() {
  const mallas = useRef<(THREE.InstancedMesh | null)[]>([]);
  const lejanoRef = useRef<THREE.InstancedMesh>(null);
  const [bloques, setBloques] = useState<BloqueExt[]>([]);
  const T = useRef({
    p: { x: 0, z: 0 }, lx: [0, 0, 0, 0], lz: [0, 0, 0, 0], rect: [0, 0, 0, 0], clave: "", claveDef: "", capasHechas: -1,
    dist: new Float32Array(MAX_BLOQUES_TOPE), elegible: new Uint8Array(MAX_BLOQUES_TOPE), capas: new Int16Array(MAX_BLOQUES_TOPE).fill(-1),
    sel: new Int32Array(MAX_BLOQUES_TOPE), selDist: new Float32Array(MAX_BLOQUES_TOPE), marca: new Uint8Array(MAX_BLOQUES_TOPE),
    lod: { CAPAS: 20, CAPAS_LEJOS: 6, LOD_CERCA_M: 8, LOD_LEJOS_M: 20, DIST_MAX_M: 28 } as CfgLod,
    mat: new THREE.Matrix4(), frustum: new THREE.Frustum(), esfera: new THREE.Sphere(),
  });

  const recursos = useMemo(() => {
    const tex = crearTexturaBriznas();
    const aH = new THREE.InstancedBufferAttribute(new Float32Array(MAX_CAPAS), 1);
    const geo = new THREE.PlaneGeometry(1, 1, SEG_CHUNK, SEG_CHUNK); geo.rotateX(-Math.PI / 2); geo.setAttribute("aH", aH);
    const geoLejano = new THREE.PlaneGeometry(1, 1, 32, 32); geoLejano.rotateX(-Math.PI / 2);
    geoLejano.setAttribute("aH", new THREE.InstancedBufferAttribute(new Float32Array([0]), 1));   // una sola capa (suelo)
    const mk = (lejano: boolean) => new THREE.ShaderMaterial({
      vertexShader: VERT_PASTO, fragmentShader: FRAG_PASTO, side: THREE.DoubleSide, defines: { ...definesPasto(lejano), EXT: "" },
      uniforms: { ...COMUN, ...EXT_U, uBriznas: { value: tex.conMip }, uCuarto: { value: 0 } },
    });
    return { tex, aH, geo, geoLejano, mat: mk(false), matLejano: mk(true) };
  }, []);
  useEffect(() => () => {
    recursos.tex.sinMip.dispose(); recursos.tex.conMip.dispose(); recursos.geo.dispose(); recursos.geoLejano.dispose();
    recursos.mat.dispose(); recursos.matLejano.dispose();
  }, [recursos]);

  // botones del menú y del panel de rendimiento
  useEffect(() => {
    const onAhora = () => { if (extenderAhora(PASTO)) window.dispatchEvent(new CustomEvent("alight:pasto-extendido", { detail: { estado: "crece" } })); };
    const onReiniciar = () => reiniciarExtension(PASTO);
    // completar los 4 cuartos y extender ya (peor caso para el benchmark); los monolitos aparecen como siempre
    const onTodo = () => {
      for (let i = 0; i < 4; i++) completarCuarto(PASTO, i);
      if (extenderAhora(PASTO)) window.dispatchEvent(new CustomEvent("alight:pasto-extendido", { detail: { estado: "crece" } }));
    };
    window.addEventListener("alight:pasto-extender", onAhora);
    window.addEventListener("alight:pasto-ext-reiniciar", onReiniciar);
    window.addEventListener("alight:pasto-completar-extender", onTodo);
    PASTO_EXT_RENDER.montado = true;
    const w = window as unknown as { __pastoExt?: object };
    if (DEBUG_ENABLED) w.__pastoExt = { PASTO, PASTO_EXT_RENDER };
    return () => {
      window.removeEventListener("alight:pasto-extender", onAhora);
      window.removeEventListener("alight:pasto-ext-reiniciar", onReiniciar);
      window.removeEventListener("alight:pasto-completar-extender", onTodo);
      PASTO_EXT_RENDER.montado = false;
      if (DEBUG_ENABLED) delete w.__pastoExt;
    };
  }, []);

  useFrame((state) => {
    const D = DBG_PASTO, R = DBG_RENDIMIENTO, t = T.current, cam = state.camera;
    // estado: con los 4 cuartos completos y los monolitos ya arriba (o sin monolitos en esta etapa)
    const sinMonolitos = !monolitosMontados(D);
    const listo = PASTO.todoEmitido && (sinMonolitos || MONO_PASTO.k >= 1);
    const ev = avanzarExtension(PASTO, D, RELOJ.dtExp, listo);
    if (ev) window.dispatchEvent(new CustomEvent("alight:pasto-extendido", { detail: { estado: ev === 1 ? "crece" : "completo" } }));

    // layout (solo al cambiar luces, margen, radio, bloque o forma del umbral)
    for (let i = 0; i < 4; i++) { hazPosXZEn(i, t.p); t.lx[i] = t.p.x; t.lz[i] = t.p.z; }
    rectPasto(t.lx, t.lz, D.MARGEN_M, t.rect);
    const Rext = radioExt(D.EXT_RADIO_M);
    const clave = `${t.rect.join(",")}|${Rext}|${R.CHUNK_M}|${D.EXT_IRREGULARIDAD}|${D.FRENTE_ANCHO}|${D.ESCALA_MANCHA_M}`;
    if (clave !== t.clave) {
      t.clave = clave;
      const rect = t.rect.slice(), cfg = { IRREGULARIDAD: D.EXT_IRREGULARIDAD, FRENTE_ANCHO: D.FRENTE_ANCHO };
      const lista = armarBloquesExt(rect, Rext, R.CHUNK_M).slice(0, MAX_BLOQUES_TOPE);
      for (const b of lista) b.uMin = umbralMinBloqueExt(b, rect, Rext, (x, z, dn) => umbralPasto(dn, manchaPasto(x, z, D.ESCALA_MANCHA_M), cfg));
      mallas.current = []; t.capas.fill(-1);
      setBloques(lista);
      PASTO_EXT_RENDER.bloques = lista.length; PASTO_EXT_RENDER.radio = Rext;
    }
    // defines (los mismos flags de Z66 que el pasto de los cuartos)
    const cd = `${R.PASTO_VIENTO_BARATO ? 1 : 0}${R.PASTO_DESCARTE_TEMPRANO ? 1 : 0}`;
    if (cd !== t.claveDef) { t.claveDef = cd; aplicarDefinesExt([recursos.mat, recursos.matLejano], [false, true]); }
    fijarTextura(recursos.mat, R.PASTO_MIPMAPS ? recursos.tex.conMip : recursos.tex.sinMip);
    // uniforms propios (los comunes los actualiza Pasto.tsx: mismos objetos)
    const U = EXT_U;
    U.uPExt.value = PASTO.ext; U.uExtR.value = Rext; U.uExtBrillo.value = D.EXT_BRILLO_MIN; U.uExtOverlay.value = D.EXT_OVERLAY ? 1 : 0;
    U.uMonoR.value = radioRecorteMonolito(MONOLITO_ANCHO_M);
    if (MONO_PASTO.usar && !sinMonolitos) U.uMono.value.set(MONO_PASTO.xL, MONO_PASTO.z, MONO_PASTO.xR, MONO_PASTO.z);
    else U.uMono.value.set(1e4, 1e4, 1e4, 1e4);
    U.uIrr.value = D.EXT_IRREGULARIDAD;   // la extensión no lleva TINTE_LUZ (el shader lo saltea con EXT)
    const capas = Math.max(8, Math.min(MAX_CAPAS, Math.round(D.CAPAS)));
    if (t.capasHechas !== capas) { t.capasHechas = capas; marcarCapas(recursos.aH, capas); }

    // selección de bloques: elegibles (con pasto, cerca y en cuadro), los más cercanos hasta el tope
    const sisOn = R.SIS.pasto !== false, activo = sisOn && D.ACTIVO && D.EXT_ACTIVO && PASTO.ext > 0;
    const n = Math.min(bloques.length, MAX_BLOQUES_TOPE);
    t.mat.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); t.frustum.setFromProjectionMatrix(t.mat);
    const ex = cam.position.x, ey = cam.position.y, ez = cam.position.z;
    let elegibles = 0;
    for (let k = 0; k < n; k++) {
      const b = bloques[k];
      const dx = Math.max(b.x0 - ex, 0, ex - b.x1), dz = Math.max(b.z0 - ez, 0, ez - b.z1), dy = Math.max(0 - ey, 0, ey - D.ALTURA_M);
      const d = Math.hypot(dx, dy, dz);
      t.dist[k] = d;
      let ok = activo && PASTO.ext > b.uMin && d < D.DIST_MAX_M;
      if (ok) {
        t.esfera.center.set(b.cx, D.ALTURA_M / 2, b.cz); t.esfera.radius = Math.hypot(b.w / 2, b.d / 2, D.ALTURA_M);
        ok = t.frustum.intersectsSphere(t.esfera);
      }
      t.elegible[k] = ok ? 1 : 0;
      if (ok) elegibles++;
    }
    const nSel = seleccionarBloques(t.dist, t.elegible, n, Math.min(MAX_BLOQUES_TOPE, D.EXT_MAX_BLOQUES), t.sel, t.selDist);
    t.marca.fill(0, 0, n);
    for (let i = 0; i < nSel; i++) t.marca[t.sel[i]] = 1;
    const L = t.lod;
    L.CAPAS = capas; L.CAPAS_LEJOS = R.CAPAS_LEJOS; L.LOD_CERCA_M = R.LOD_CERCA_M; L.LOD_LEJOS_M = R.LOD_LEJOS_M; L.DIST_MAX_M = D.DIST_MAX_M;
    let instancias = 0, dibujados = 0;
    for (let k = 0; k < n; k++) {
      const m = mallas.current[k];
      if (!m) continue;
      if (!t.marca[k]) { m.visible = false; continue; }
      const prev = t.capas[k];
      const nc = !R.PASTO_LOD ? capas : capasLod(t.dist[k], prev < 0 ? capas : prev, L, R.LOD_HISTERESIS_M);
      t.capas[k] = nc;
      m.visible = nc > 0;
      if (m.visible) { m.count = nc; instancias += nc; dibujados++; }
    }
    // suelo lejano de la extensión: una malla del cuadrado del círculo (el shader recorta), mismo frente
    const lj = lejanoRef.current;
    if (lj) {
      lj.visible = activo && R.PASTO_LEJANO;
      lj.scale.set(2 * Rext, 1, 2 * Rext);
    }
    PASTO_EXT_RENDER.elegibles = elegibles; PASTO_EXT_RENDER.dibujados = dibujados; PASTO_EXT_RENDER.instancias = instancias;
    PASTO_EXT_RENDER.lejano = !!lj?.visible;
  });

  return (
    <>
      {bloques.map((b, k) => (
        <instancedMesh key={`e${k}`} args={[recursos.geo, recursos.mat, MAX_CAPAS]}
          ref={el => { mallas.current[k] = el; if (el) esferaBloque(el, b.w, b.d); }}
          position={[b.cx, Y_PASTO, b.cz]} scale={[b.w, 1, b.d]} renderOrder={2} visible={false} />
      ))}
      <instancedMesh ref={lejanoRef} args={[recursos.geoLejano, recursos.matLejano, 1]} position={[0, Y_LEJANO, 0]}
        frustumCulled={false} renderOrder={1} visible={false} />
    </>
  );
}
