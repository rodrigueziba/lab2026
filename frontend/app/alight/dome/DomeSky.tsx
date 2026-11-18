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
import { DBG_DOME_LIVE, DBG_DOME_FORCE, DBG_DIA, DBG_PORTAL, DBG_SOL, DBG_ONDAS, DBG_SILLAS, DBG_FLUIDO, DBG_RENDIMIENTO } from "@/lib/debugConfig";
import { FLUIDO } from "@/lib/fluidoBloques"; // Z61
import { ONDAS, MAX_ONDAS, edad, evidenciaOndas } from "@/lib/ondasKick"; // Z52 · Z58

const EVID = { amp: 0, brillo: 0, tinte: 0, contraste: 0, engrosar: 0 };   // Z58: valores efectivos (se reescriben, sin allocations)
import { RELOJ } from "@/lib/relojExperiencia"; // Z52
import { aplicarDomoVivo, liberarDomoVivo, texturaVacia } from "@/lib/domoVivoAcciones"; // Z83
import { hexARgb } from "@/lib/cicloDia"; // Z52
import { DIA, PORTAL_GEOM } from "@/lib/cicloDia"; // Z48 · Z49
import { escalaPortal, centroPortal, PORTAL_C_SHADER, SUN_C_SHADER } from "@/lib/portalEscala"; // Z49 · Z50 · Z55

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
          uSolTopeBrillo: { value: DBG_SOL.TOPE_BRILLO },   // Z57
          uPortalCx:      { value: PORTAL_C_SHADER[0] },    // Z57
          // Z52: ondas por kick (edad, fuerza, luz, activa) y color de la luz de cada banda
          uOndas:           { value: Array.from({ length: MAX_ONDAS }, () => new THREE.Vector4()) },
          uOndaCol:         { value: Array.from({ length: 4 }, () => new THREE.Vector3(1, 1, 1)) },
          uOndaVel:         { value: 0 },
          uOndaAncho:       { value: 0.1 },
          uOndaDur:         { value: 3.5 },
          uOndaAmp:         { value: 0 },
          uOndaBrillo:      { value: 0 },
          uOndaBrilloNoche: { value: 0 },
          uOndaTinte:       { value: 0 },
          uOndaRevelar:     { value: 0 },
          uOndaContraste:   { value: 0 },   // Z58
          // Z61: fluir de color de los bloques azul (MONTAÑAS) y naranja (LÍNEAS)
          uFluido:  { value: 0 },
          uFlT:     { value: new THREE.Vector2(0, 0) },
          uFlE:     { value: new THREE.Vector2(0, 0) },
          uFlMez:   { value: new THREE.Vector2(0.6, 0.6) },
          uFlEsc:   { value: 3 },
          uFlWarp:  { value: 1.2 },
          uFlLuz:   { value: 0.25 },
          uFlPulso: { value: 0.35 },
          uFlOct:   { value: 3 },
          uFlRango: { value: new THREE.Vector2(0.35, 0.72) },   // Z63
          uFlLum:   { value: new THREE.Vector2(0.207, 0.328) }, // Z63
          uFlDet:   { value: new THREE.Vector2(0.3, 1.5) },     // Z63
          uFlEscY:  { value: 4 },                               // Z63
          uFlTope:  { value: 0.85 },                            // Z63
          uFlTopeModo: { value: 1 },                            // Z65
          uFlDiaAt: { value: 0.5 },                             // Z65
          uPerfAnillos: { value: 1 },                           // Z66
          // Z72: precalculados en la CPU, ondas vivas e interruptores por sub-sistema del panel de rendimiento
          uOndasN:        { value: 0 },
          uPortalCDir:    { value: new THREE.Vector3(0, 0, -1) },
          uPortalAtan:    { value: 1 },
          uPerfFluido:    { value: 1 },
          uPerfSol:       { value: 1 },
          uPerfOndas:     { value: 1 },
          uPerfEstrellas: { value: 1 },
          uPerfPortal:    { value: 1 },
          uPerfSiluetas:  { value: 1 },
          uFlPalA:  { value: Array.from({ length: 5 }, () => new THREE.Vector3(1, 1, 1)) },
          uFlPalN:  { value: Array.from({ length: 5 }, () => new THREE.Vector3(1, 1, 1)) },
          uOndaEngrosar:    { value: 0 },   // Z58
          // Z83: sesión en vivo de la tarima en la franja (lib/domoVivoAcciones.ts); uRemoteMix = 0 → rama apagada
          uRemoteTex:  { value: texturaVacia() },
          uRemoteMix:  { value: 0 },
          uStaticMix:  { value: 1 },
          uRemoteOn:   { value: 0 },
          uVivoGeo:    { value: new THREE.Vector4(6, 1 / 6, 0.59, 0.32) },
          uVivoCob:    { value: new THREE.Vector3(0, 0, 0.1) },
          uVivoBorde:  { value: 0.04 },
          uVivoFondo:  { value: 0.9 },
          uVivoT:      { value: 0 },
          uEstatica:   { value: new THREE.Vector3(0.85, 140, 24) },
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
    return () => {
      if (DOME_SKY_MAT_EXPORT.mat === material) DOME_SKY_MAT_EXPORT.mat = null;
      liberarDomoVivo();   // Z83
    };
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
    // Z57: centro del círculo y de los anillos (PORTAL_C.x, o SUN_C.x con ANILLOS_EN_EJE)
    const cxAnillos = DBG_PORTAL.ANILLOS_EN_EJE ? SUN_C_SHADER[0] : PORTAL_C_SHADER[0];
    u.uPortalCx.value = cxAnillos;
    centroPortal(portalAzimuth, tmp.esc.elev, tmp.esc.tan, tmp.cen, cxAnillos);
    PORTAL_GEOM.azRad = tmp.cen.az;
    PORTAL_GEOM.elevRad = tmp.cen.elev;
    F.set(Math.sin(portalAzimuth) * ce, se, -Math.cos(portalAzimuth) * ce);
    R.set(Math.cos(portalAzimuth), 0, Math.sin(portalAzimuth));
    U.crossVectors(R, F);
    // Z55: recta vertical de la composición por el centro elegido (SOL_EJE_CENTRO): el sol "eje" va sobre ella
    {
      const C = DBG_DIA.SOL_EJE_CENTRO === "portal" ? PORTAL_C_SHADER : SUN_C_SHADER;
      const k = (DBG_DIA.SOL_EJE_CENTRO === "portal" ? cxAnillos : C[0]) * tmp.esc.tan, m = C[1] * tmp.esc.tan;   // Z57: "portal" sigue a los anillos
      const cy = F.y + R.y * k + U.y * m;
      PORTAL_GEOM.ejeElevCentro = Math.asin(cy / (Math.hypot(F.x + R.x * k + U.x * m, cy, F.z + R.z * k + U.z * m) || 1));
      const px = F.x + R.x * k, py = F.y + R.y * k, pz = F.z + R.z * k, L = Math.hypot(px, py, pz) || 1;
      const P = PORTAL_GEOM.ejeP, Ue = PORTAL_GEOM.ejeU;
      P[0] = px / L; P[1] = py / L; P[2] = pz / L;
      Ue[0] = U.x; Ue[1] = U.y; Ue[2] = U.z;
    }
    u.uPortalF.value.copy(F);
    u.uPortalR.value.copy(R);
    u.uPortalU.value.copy(U);
    u.uPortalTan.value = tmp.esc.tan;   // Z49: tan(semi-FOV) × ESCALA
    // Z72: lo que el shader calculaba igual en cada píxel: centro del círculo (pc = (uPortalCx, PORTAL_C.y)) y atan(tan)
    (u.uPortalCDir.value as THREE.Vector3).copy(F).addScaledVector(R, cxAnillos * tmp.esc.tan).addScaledVector(U, PORTAL_C_SHADER[1] * tmp.esc.tan).normalize();
    u.uPortalAtan.value = Math.atan(tmp.esc.tan);
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
      // Z61/Z63: FLUIDO lo avanza DomeSkyAnchor (DomeVisualizer) con las bandas crudas y la luz de cada grupo
    }
    // Z61: fluir de color (tiempo acumulado propio por bloque: sin saltos al cambiar la velocidad; quieto en pausa)
    u.uPerfAnillos.value = DBG_RENDIMIENTO.SIS.anillos !== false ? 1 : 0;   // Z66: interruptor de rendimiento
    { // Z72: sub-sistemas del domo (solo para medir; true = activo)
      const SIS = DBG_RENDIMIENTO.SIS;
      u.uPerfFluido.value = SIS.domoFluido !== false ? 1 : 0;
      u.uPerfSol.value = SIS.domoSol !== false ? 1 : 0;
      u.uPerfOndas.value = SIS.domoOndas !== false ? 1 : 0;
      u.uPerfEstrellas.value = SIS.domoEstrellas !== false ? 1 : 0;
      u.uPerfPortal.value = SIS.domoPortal !== false ? 1 : 0;
      u.uPerfSiluetas.value = SIS.domoSiluetas !== false ? 1 : 0;
    }
    u.uFluido.value = DBG_FLUIDO.ACTIVO ? 1 : 0;
    if (DBG_FLUIDO.ACTIVO) {
      u.uFlT.value.set(FLUIDO.tA, FLUIDO.tN);
      u.uFlE.value.set(FLUIDO.eA, FLUIDO.eN);
      u.uFlMez.value.set(DBG_FLUIDO.MEZCLA_AZUL, DBG_FLUIDO.MEZCLA_NARANJA);
      u.uFlEsc.value = Math.max(0.2, DBG_FLUIDO.ESCALA);
      u.uFlWarp.value = Math.max(0, DBG_FLUIDO.WARP);
      u.uFlLuz.value = DBG_FLUIDO.LUZ_FLUJO;
      u.uFlPulso.value = DBG_FLUIDO.PULSO_LUZ;
      u.uFlOct.value = Math.max(2, Math.min(4, Math.round(DBG_FLUIDO.CALIDAD)));
      u.uFlRango.value.set(DBG_FLUIDO.RANGO_MIN, Math.max(DBG_FLUIDO.RANGO_MIN + 0.01, DBG_FLUIDO.RANGO_MAX));
      u.uFlLum.value.set(Math.max(0.02, DBG_FLUIDO.LUM_MEDIA_AZUL), Math.max(0.02, DBG_FLUIDO.LUM_MEDIA_NARANJA));
      u.uFlDet.value.set(DBG_FLUIDO.DETALLE_MIN, DBG_FLUIDO.DETALLE_MAX);
      u.uFlEscY.value = Math.max(0.2, DBG_FLUIDO.ESCALA_Y);
      u.uFlTope.value = DBG_FLUIDO.TOPE;
      u.uFlTopeModo.value = DBG_FLUIDO.TOPE_MODO === "canal" ? 0 : 1;   // Z65
      u.uFlDiaAt.value = Math.max(0, Math.min(1, DBG_FLUIDO.DIA_ATENUA));  // Z65
      const pa = u.uFlPalA.value as THREE.Vector3[], pn = u.uFlPalN.value as THREE.Vector3[];
      for (let i = 0; i < 5; i++) {   // hexARgb tiene caché por texto: sin allocations por frame
        let c = hexARgb(DBG_FLUIDO.PALETA_AZUL[i] ?? "#FFFFFF"); pa[i].set(c[0], c[1], c[2]);
        c = hexARgb(DBG_FLUIDO.PALETA_NARANJA[i] ?? "#FFFFFF"); pn[i].set(c[0], c[1], c[2]);
      }
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
      u.uSolTopeBrillo.value = DBG_SOL.TOPE_BRILLO;   // Z57
    }
    u.uDebugCapas.value = DBG_PORTAL.DEBUG_CAPAS > 0.5 ? 1 : 0;   // Z50 (también con el ciclo apagado)
    // Z52: ondas (lib/ondasKick.ts; las detecta DomeSkyAnchor). Edad con el reloj de la experiencia (pausa = quietas)
    {
      const tOnda = RELOJ.tExp, arr = u.uOndas.value as THREE.Vector4[];
      // Z72: las ondas vivas van juntas al principio y uOndasN dice cuántas son (el shader solo recorre esas)
      let vivas = 0;
      for (let i = 0; i < MAX_ONDAS; i++) {
        const w = ONDAS.lista[i];
        if (w.activa && DBG_ONDAS.ACTIVO) arr[vivas++].set(edad(w, tOnda), w.fuerza, w.luz, 1);
      }
      for (let i = vivas; i < MAX_ONDAS; i++) arr[i].set(0, 0, 0, 0);
      u.uOndasN.value = vivas;
      const cols = u.uOndaCol.value as THREE.Vector3[];
      // sin arrays por frame: hexARgb tiene caché por texto
      let c = hexARgb(DBG_SILLAS.hazColor0); cols[0].set(c[0], c[1], c[2]);
      c = hexARgb(DBG_SILLAS.hazColor1); cols[1].set(c[0], c[1], c[2]);
      c = hexARgb(DBG_SILLAS.hazColor2); cols[2].set(c[0], c[1], c[2]);
      c = hexARgb(DBG_SILLAS.hazColor3); cols[3].set(c[0], c[1], c[2]);
      u.uOndaVel.value = (DBG_ONDAS.VELOCIDAD_DEG_S * Math.PI) / 180;
      u.uOndaAncho.value = (Math.max(0.5, DBG_ONDAS.ANCHO_DEG) * Math.PI) / 180;
      u.uOndaDur.value = Math.max(0.05, DBG_ONDAS.DURACION_S);
      // Z58: amplitud, brillo, tinte, contraste y engrosamiento pasan por EVIDENCIA (lib/ondasKick.ts)
      const ev = evidenciaOndas(DBG_ONDAS, EVID);
      u.uOndaAmp.value = ev.amp;
      u.uOndaBrillo.value = ev.brillo;
      u.uOndaBrilloNoche.value = DBG_ONDAS.BRILLO_NOCHE;
      u.uOndaTinte.value = ev.tinte;
      u.uOndaContraste.value = ev.contraste;
      u.uOndaEngrosar.value = ev.engrosar;
      u.uOndaRevelar.value = DBG_ONDAS.REVELAR;
    }
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
    aplicarDomoVivo(material.uniforms);   // Z83: al final (uPortalF ya está al día)
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
