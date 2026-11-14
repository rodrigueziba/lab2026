"use client";
// DomeSky.tsx — domo 360 con portal de atardecer, tunel de anillos y cordillera.
// Cargar con dynamic(() => import("./DomeSky"), { ssr: false }) o dentro de un <Canvas> ya en cliente.
import { useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";

// X1: pre-carga al importar el módulo → texturas en caché antes del primer mount (evita Suspense negro)
useTexture.preload([
  "/portal/portal-masks.png",
  "/portal/portal-masks-2k.png",
  "/portal/portal-color.png",
]);
import { domeVert, domeFrag } from "./domeShaders";
import { DBG_DOME_LIVE, DBG_DOME_FORCE, DBG_DIA, DBG_PORTAL, DBG_SOL } from "@/lib/debugConfig";
import { DIA, PORTAL_GEOM } from "@/lib/cicloDia"; // Z48 · Z49
import { escalaPortal, centroPortal } from "@/lib/portalEscala"; // Z49 · Z50

export type Bands = { bass: number; lowMid: number; highMid: number; treble: number }; // 0..1
// W4: parámetros de ajuste del shader (leídos cada frame vía callback — sin recrear material)
// W5: siluetasSuaves + softEdge controlan la máscara y el suavizado de bordes
export type ShaderParams = {
  warp: number; ringFlow: number; ringScale: number;
  ringFade0: number; ringFade1: number; starCut: number;
  siluetasSuaves: boolean; softEdge: number; // W5
};

// W2: energias por grupo (SOL, MONTAÑAS, CIELO, LÍNEAS) + kick impulse
// W3: dawn (0..1 fase 1) + revMont/revLin/revSol/revCielo (0..1 fase 2)
export type GroupEnergy = {
  sol: number; mont: number; cielo: number; lin: number; kick: number;
  dawn: number;      // W3: progreso amanecer fase 1 (0..1)
  revMont: number;   // W3: reveal MONTAÑAS strata (0..1)
  revLin: number;    // W3: reveal LÍNEAS waves (0..1)
  revSol: number;    // W3: reveal SOL rings (0..1)
  revCielo: number;  // W3: reveal CIELO stars+warp+confeti (0..1)
};

type Props = {
  /** Devuelve las 4 bandas ya normalizadas (0..1). Se llama una vez por frame, sin crear estado de React. */
  getBands: () => Bands;
  /** W2: Devuelve las 4 energias de grupo + kick. Si no se pasa, uGroupEnergy queda en cero. */
  getGroupEnergy?: () => GroupEnergy;
  /** W4: Devuelve warp/ringFlow/ringScale/ringFade/starCut live (sin re-crear material). */
  getShaderParams?: () => ShaderParams;
  /** W2: multiplicadores de amplitud por grupo (default 1.5 para reacción evidente) */
  solAmt?: number;
  montAmt?: number;
  cieloAmt?: number;
  linAmt?: number;
  kickAmt?: number;
  /** Giro horizontal del portal en radianes (0 = frente a -Z). */
  portalAzimuth?: number;
  /** Elevacion del centro del portal sobre el horizonte, en radianes. */
  portalElevation?: number;
  /** Semi-angulo horizontal de la imagen del portal, en grados (tan() se pasa al shader). */
  portalHalfFovDeg?: number;
  radius?: number;
  warp?: number;       // intensidad base del domain warp
  ringFlow?: number;   // velocidad de flujo de los anillos
  ringScale?: number;  // multiplicador del periodo de anillos
  ringFade?: [number, number];
  starCut?: number;    // 0.93..0.995, mas alto = menos estrellas
  /** AA2: false = solo actualiza uniforms (ExperienceDome aplica el material al mesh del domo). */
  renderSphere?: boolean;
  lowQuality?: boolean;
};

// AA2: ref module-level para que ExperienceDome acceda al material sin prop drilling
export const DOME_SKY_MAT_EXPORT: { mat: THREE.ShaderMaterial | null } = { mat: null };

// Suavizado con ataque rapido y caida lenta (se siente mejor que seguir la señal cruda).
function smooth(prev: number, target: number, dt: number) {
  const rate = target > prev ? 18 : 5;
  return prev + (target - prev) * (1 - Math.exp(-rate * dt));
}

export default function DomeSky({
  getBands,
  getGroupEnergy,
  getShaderParams,
  solAmt   = 1.5,
  montAmt  = 1.5,
  cieloAmt = 1.5,
  linAmt   = 1.5,
  kickAmt  = 1.0,
  portalAzimuth = 0,
  portalElevation = 0.58,
  portalHalfFovDeg = 42,
  radius = 100,
  warp = 1,
  ringFlow = 0.03,
  ringScale = 1,
  ringFade = [1.0, 1.6],
  starCut = 0.965,
  renderSphere = true,
  lowQuality = false,
}: Props) {
  // W5: carga ambas resoluciones; getShaderParams() decide cuál usar en useFrame
  const [masks, masks2k, color] = useTexture(["/portal/portal-masks.png", "/portal/portal-masks-2k.png", "/portal/portal-color.png"]);
  masks.colorSpace = THREE.NoColorSpace; // datos, el shader no hace conversión
  masks2k.colorSpace = THREE.NoColorSpace;
  color.colorSpace = THREE.NoColorSpace;
  masks.anisotropy = masks2k.anisotropy = color.anisotropy = 4;

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: domeVert,
        fragmentShader: domeFrag,
        side: THREE.BackSide,
        depthWrite: false,
        transparent: true,
        defines: lowQuality ? { LOW_QUALITY: "" } : {},
        uniforms: {
          uTime: { value: 0 },
          uCameraPos: { value: new THREE.Vector3() },
          uBands: { value: new THREE.Vector4() },
          uMasks: { value: masks },
          uColor: { value: color },
          uPortalF: { value: new THREE.Vector3() },
          uPortalR: { value: new THREE.Vector3() },
          uPortalU: { value: new THREE.Vector3() },
          uPortalTan: { value: 1 },
          uWarp: { value: warp },
          uRingFlow: { value: ringFlow },
          uRingScale: { value: ringScale },
          uRingFade: { value: new THREE.Vector2(...ringFade) },
          uStarCut: { value: starCut },
          // W2: group energies + kick + multipliers
          uGroupEnergy: { value: new THREE.Vector4() },
          uKick:        { value: 0 },
          uSolAmt:      { value: solAmt },
          uMontAmt:     { value: montAmt },
          uCieloAmt:    { value: cieloAmt },
          uLinAmt:      { value: linAmt },
          uKickAmt:     { value: kickAmt },
          // W3: dawn + reveal
          uDawn:        { value: 1 },  // default 1 = fully visible (dawn skipped)
          uReveal:      { value: new THREE.Vector4(1, 1, 1, 1) },
          // W5: bordes suaves
          uSoftEdge:    { value: 0 },
          // X2b: debug máscaras
          uDebugMasks:  { value: 0 },
          // Z48: ciclo de día (lib/cicloDia.ts); con uDiaNuevo = 0 el shader hace lo de siempre
          uDiaNuevo:    { value: 0 },
          uDia:         { value: 0 },
          uSolDir:      { value: new THREE.Vector3(0, -1, 0) },
          uLuzDia:      { value: 0 },
          uColHor:      { value: new THREE.Vector3() },
          uColMed:      { value: new THREE.Vector3() },
          uColCen:      { value: new THREE.Vector3() },
          uColGlow:     { value: new THREE.Vector3() },
          uBrilloSol:   { value: 0 },
          uEstrellas:   { value: 1 },
          uMontCrece:   { value: 0 },
          uMontCentro:  { value: 0 },
          uMontAncho:   { value: DBG_DIA.MONT_ANCHO },
          uMontSilueta: { value: DBG_DIA.MONT_SILUETA },
          uSolRadio:    { value: DBG_DIA.SOL_RADIO },
          uSolPulso:    { value: 0 },
          uNubesBrillo: { value: 0 },
          uPortalNoche: { value: DBG_DIA.PORTAL_NOCHE },
          // Z49
          uSolUnico:      { value: 0 },
          uHaloTope:      { value: DBG_DIA.SOL_HALO_TOPE },
          uTinteBorde:    { value: DBG_PORTAL.TINTE_BORDE },
          uTinteAnillos:  { value: DBG_PORTAL.TINTE_ANILLOS },
          uTinteInterior: { value: DBG_PORTAL.TINTE_INTERIOR },
          uBordeSuave:    { value: DBG_PORTAL.BORDE_SUAVE },
          // Z50
          uBordeAncho:    { value: DBG_PORTAL.BORDE_ANCHO },
          uDebugCapas:    { value: 0 },
          // Z51: sol nuevo
          uSolNuevo:      { value: 0 },
          uSolTR:         { value: new THREE.Vector3(1, 0, 0) },
          uSolTU:         { value: new THREE.Vector3(0, 1, 0) },
          uSolTam:        { value: DBG_SOL.TAMANO },
          uSolIntens:     { value: DBG_SOL.INTENSIDAD },
          uSolNucleo:     { value: DBG_SOL.NUCLEO },
          uSolHalo:       { value: DBG_SOL.HALO },
          uSolRayos:      { value: new THREE.Vector2(DBG_SOL.RAYOS_N1, DBG_SOL.RAYOS_N2) },
          uSolRayosAncho: { value: DBG_SOL.RAYOS_ANCHO },
          uSolRayosInt:   { value: DBG_SOL.RAYOS_INT },
          uSolBrillo:     { value: 0.2 },
          uSolRot:        { value: 0 },
          uSolAlcance:    { value: DBG_SOL.ALCANCE },
          uSolPaleta:     { value: DBG_SOL.PALETA_PROYECTO },
          uSolTinteEt:    { value: DBG_SOL.TINTE_ETAPA },
          uSolTope:       { value: DBG_SOL.TOPE },
        },
      }),
    // los uniformes sueltos se actualizan en useFrame; el material solo se recrea si cambia la calidad
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [masks, color, lowQuality]
  );

  const tmp = useMemo(() => ({ F: new THREE.Vector3(), R: new THREE.Vector3(), U: new THREE.Vector3(), b: [0, 0, 0, 0], ge: new THREE.Vector4(), rv: new THREE.Vector4(), esc: { elev: 0, tan: 1 }, cen: { az: 0, elev: 0 }, rot: 0 }), []);

  // AA2: exponer el material para que ExperienceDome lo aplique al mesh del domo
  useEffect(() => {
    DOME_SKY_MAT_EXPORT.mat = material;
    return () => { if (DOME_SKY_MAT_EXPORT.mat === material) DOME_SKY_MAT_EXPORT.mat = null; };
  }, [material]);

  useFrame((state, dt) => {
    const u = material.uniforms;
    const raw = getBands();
    const b = tmp.b;
    b[0] = smooth(b[0], raw.bass, dt);
    b[1] = smooth(b[1], raw.lowMid, dt);
    b[2] = smooth(b[2], raw.highMid, dt);
    b[3] = smooth(b[3], raw.treble, dt);
    u.uBands.value.set(b[0], b[1], b[2], b[3]);
    u.uTime.value = state.clock.elapsedTime;
    u.uCameraPos.value.copy(state.camera.position);

    const { F, R, U } = tmp;
    // Z49: composición escalada (DBG_PORTAL.ESCALA) apoyada en la misma línea del horizonte (lib/portalEscala.ts)
    escalaPortal(portalElevation, portalHalfFovDeg, DBG_PORTAL.ESCALA, tmp.esc);
    const ce = Math.cos(tmp.esc.elev), se = Math.sin(tmp.esc.elev);
    // Z50: el sol del ciclo sale en el azimut del CENTRO DEL CÍRCULO (cDir del shader, con PORTAL_C), no en F
    centroPortal(portalAzimuth, tmp.esc.elev, tmp.esc.tan, tmp.cen);
    PORTAL_GEOM.azRad = tmp.cen.az;
    PORTAL_GEOM.elevRad = tmp.cen.elev;
    F.set(Math.sin(portalAzimuth) * ce, se, -Math.cos(portalAzimuth) * ce);
    R.set(Math.cos(portalAzimuth), 0, Math.sin(portalAzimuth));
    U.crossVectors(R, F);
    u.uPortalF.value.copy(F);
    u.uPortalR.value.copy(R);
    u.uPortalU.value.copy(U);
    u.uPortalTan.value = tmp.esc.tan;   // Z49: tan(semi-FOV) × ESCALA
    u.uWarp.value = warp;
    u.uRingFlow.value = ringFlow;
    u.uRingScale.value = ringScale;
    u.uRingFade.value.set(ringFade[0], ringFade[1]);
    u.uStarCut.value = starCut;
    // W2: group energies + kick + multipliers
    if (getGroupEnergy) {
      const ge = getGroupEnergy();
      tmp.ge.set(ge.sol, ge.mont, ge.cielo, ge.lin);
      u.uGroupEnergy.value.copy(tmp.ge);
      u.uKick.value = ge.kick;
      // W3: dawn + reveal
      u.uDawn.value = ge.dawn;
      tmp.rv.set(ge.revMont, ge.revLin, ge.revSol, ge.revCielo);
      u.uReveal.value.copy(tmp.rv);
    }
    u.uSolAmt.value   = solAmt;
    u.uMontAmt.value  = montAmt;
    u.uCieloAmt.value = cieloAmt;
    u.uLinAmt.value   = linAmt;
    u.uKickAmt.value  = kickAmt;
    // W4: parámetros de shader live — sobreescriben los props si se provee el callback
    if (getShaderParams) {
      const p = getShaderParams();
      u.uWarp.value      = p.warp;
      u.uRingFlow.value  = p.ringFlow;
      u.uRingScale.value = p.ringScale;
      u.uRingFade.value.set(p.ringFade0, p.ringFade1);
      u.uStarCut.value   = p.starCut;
      // W5: máscara y suavizado de bordes
      u.uMasks.value     = p.siluetasSuaves ? masks2k : masks;
      u.uSoftEdge.value  = p.siluetasSuaves ? p.softEdge : 0;
    }
    // X2a: forzar todo visible (bypasa máquina de estados)
    if (DBG_DOME_FORCE.visible) {
      u.uDawn.value = 1;
      u.uReveal.value.set(1, 1, 1, 1);
      tmp.ge.set(0.6, 0.6, 0.6, 0.6);
      u.uGroupEnergy.value.copy(tmp.ge);
    }
    // X2b: debug máscaras
    u.uDebugMasks.value = DBG_DOME_FORCE.masks ? 1.0 : 0.0;
    // Z48: ciclo de día (los revelados de la introducción ya llegan por uDawn / uReveal desde DomeSkyAnchor)
    u.uDiaNuevo.value = DBG_DIA.NUEVO ? 1 : 0;
    if (DBG_DIA.NUEVO) {
      u.uDia.value = DIA.dia;
      u.uSolDir.value.set(DIA.solDir[0], DIA.solDir[1], DIA.solDir[2]);
      u.uLuzDia.value = DIA.luz;
      u.uColHor.value.set(DIA.hor[0], DIA.hor[1], DIA.hor[2]);
      u.uColMed.value.set(DIA.med[0], DIA.med[1], DIA.med[2]);
      u.uColCen.value.set(DIA.cen[0], DIA.cen[1], DIA.cen[2]);
      u.uColGlow.value.set(DIA.glow[0], DIA.glow[1], DIA.glow[2]);
      u.uBrilloSol.value = DIA.brilloSol;
      u.uEstrellas.value = DIA.estrellas;
      u.uMontCrece.value = DIA.montCrece;
      // centro del crecimiento = azimut de la salida del sol, en vueltas (-0,5…0,5) como el shader
      // Z49: el que calcula el ciclo (alineado al portal o el de Z48)
      const azS = (DIA.azSalida / (2 * Math.PI)) % 1;
      u.uMontCentro.value = azS > 0.5 ? azS - 1 : azS < -0.5 ? azS + 1 : azS;
      u.uMontAncho.value = DBG_DIA.MONT_ANCHO;
      u.uMontSilueta.value = DBG_DIA.MONT_SILUETA;
      u.uSolRadio.value = DBG_DIA.SOL_RADIO;
      u.uSolPulso.value = DIA.solPulso;
      u.uNubesBrillo.value = DIA.nubesBrillo;
      u.uPortalNoche.value = DBG_DIA.PORTAL_NOCHE;
      // Z49
      u.uSolUnico.value = DIA.solUnico;
      u.uHaloTope.value = DBG_DIA.SOL_HALO_TOPE;
      u.uTinteBorde.value = DBG_PORTAL.TINTE_BORDE;
      u.uTinteAnillos.value = DBG_PORTAL.TINTE_ANILLOS;
      u.uTinteInterior.value = DBG_PORTAL.TINTE_INTERIOR;
      u.uBordeSuave.value = DBG_PORTAL.BORDE_SUAVE;
      u.uBordeAncho.value = DBG_PORTAL.BORDE_ANCHO;   // Z50
      // Z51: sol nuevo. Base tangente al sol (derecha = sol × arriba, arriba = derecha × sol) para el ángulo de
      // los rayos; si el sol está en el cénit (modo meridiano) se conserva la anterior.
      u.uSolNuevo.value = DBG_SOL.DISENO_NUEVO ? 1 : 0;
      const sx = DIA.solDir[0], sy = DIA.solDir[1], sz = DIA.solDir[2];
      const lr = Math.hypot(sz, sx);
      if (lr > 1e-4) {
        u.uSolTR.value.set(-sz / lr, 0, sx / lr);
        const tr = u.uSolTR.value;
        u.uSolTU.value.set(tr.y * sz - tr.z * sy, tr.z * sx - tr.x * sz, tr.x * sy - tr.y * sx);
      }
      tmp.rot = (tmp.rot + dt * (DBG_SOL.ROTACION_RAYOS_DEG_S * Math.PI / 180)) % (Math.PI * 2);
      u.uSolRot.value = tmp.rot;
      u.uSolBrillo.value = 0.2 + Math.sin(state.clock.elapsedTime) * 0.05 * DBG_SOL.PARPADEO + 0.1 * DIA.solPulso;   // + graves (MUSICA_SOL)
      u.uSolTam.value = DBG_SOL.TAMANO;
      u.uSolIntens.value = DBG_SOL.INTENSIDAD;
      u.uSolNucleo.value = DBG_SOL.NUCLEO;
      u.uSolHalo.value = DBG_SOL.HALO;
      u.uSolRayos.value.set(DBG_SOL.RAYOS_N1, DBG_SOL.RAYOS_N2);
      u.uSolRayosAncho.value = Math.max(0.05, DBG_SOL.RAYOS_ANCHO);
      u.uSolRayosInt.value = DBG_SOL.RAYOS_INT;
      u.uSolAlcance.value = Math.max(0.01, DBG_SOL.ALCANCE);
      u.uSolPaleta.value = DBG_SOL.PALETA_PROYECTO;
      u.uSolTinteEt.value = DBG_SOL.TINTE_ETAPA;
      u.uSolTope.value = DBG_SOL.TOPE;
    }
    u.uDebugCapas.value = DBG_PORTAL.DEBUG_CAPAS > 0.5 ? 1 : 0;   // Z50 (también con el ciclo apagado)
    // X2 PASO 1: escribir valores live (sin allocations — solo asignaciones de número)
    DBG_DOME_LIVE.uDawn     = u.uDawn.value;
    DBG_DOME_LIVE.revX      = u.uReveal.value.x;
    DBG_DOME_LIVE.revY      = u.uReveal.value.y;
    DBG_DOME_LIVE.revZ      = u.uReveal.value.z;
    DBG_DOME_LIVE.revW      = u.uReveal.value.w;
    DBG_DOME_LIVE.geX       = u.uGroupEnergy.value.x;
    DBG_DOME_LIVE.geY       = u.uGroupEnergy.value.y;
    DBG_DOME_LIVE.geZ       = u.uGroupEnergy.value.z;
    DBG_DOME_LIVE.geW       = u.uGroupEnergy.value.w;
    DBG_DOME_LIVE.kick      = u.uKick.value;
    DBG_DOME_LIVE.portalTan = u.uPortalTan.value;
    DBG_DOME_LIVE.pFX       = u.uPortalF.value.x;
    DBG_DOME_LIVE.pFY       = u.uPortalF.value.y;
    DBG_DOME_LIVE.pFZ       = u.uPortalF.value.z;
    DBG_DOME_LIVE.pRX       = u.uPortalR.value.x;
    DBG_DOME_LIVE.pRY       = u.uPortalR.value.y;
    DBG_DOME_LIVE.pRZ       = u.uPortalR.value.z;
    DBG_DOME_LIVE.pUX       = u.uPortalU.value.x;
    DBG_DOME_LIVE.pUY       = u.uPortalU.value.y;
    DBG_DOME_LIVE.pUZ       = u.uPortalU.value.z;
    // X2 texturas (sin allocations)
    const mi = masks.image as (HTMLImageElement & ImageBitmap) | null;
    if (mi) {
      DBG_DOME_LIVE.masksW  = mi.naturalWidth  ?? mi.width  ?? 0;
      DBG_DOME_LIVE.masksH  = mi.naturalHeight ?? mi.height ?? 0;
      DBG_DOME_LIVE.masksCS = masks.colorSpace;
    }
    const ci = color.image as (HTMLImageElement & ImageBitmap) | null;
    if (ci) {
      DBG_DOME_LIVE.colorW  = ci.naturalWidth  ?? ci.width  ?? 0;
      DBG_DOME_LIVE.colorH  = ci.naturalHeight ?? ci.height ?? 0;
      DBG_DOME_LIVE.colorCS = color.colorSpace;
    }
  });

  // AA2: renderSphere=false → solo actualiza uniforms; ExperienceDome aplica al mesh del domo.
  if (!renderSphere) return null;
  // La esfera debe estar centrada en el espectador (la camara queda en el origen).
  return (
    <mesh material={material} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[radius, 64, 32]} />
    </mesh>
  );
}
