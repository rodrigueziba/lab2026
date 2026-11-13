"use client";

import { useRef, useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PRISM_POS_UNIFORM, PRISM_RAINBOW_UNIFORM, PRISM_ROT_UNIFORM } from "@/lib/prismUniforms";
import { TARIMA_H } from "./Tarima";
import { INTERACT_STATE } from "@/lib/alightStore";
import { DBG_PRISM, DBG_SECUENCIA, DBG_FRACTAL } from "@/lib/debugConfig";
import { RELOJ, ahoraExp } from "@/lib/relojExperiencia"; // Z39
// Z43: fractal nuevo de las caras ("jungle fractal II"), progresión por distancia y música
import { FRACTAL_JUNGLA_VERT, FRACTAL_JUNGLA_FRAG } from "@/lib/prisma/fractalJungla.glsl";
import { crearGeoCarasPrisma, dimCaraPrisma } from "@/lib/prisma/geoCarasPrisma";
import { RETRO_FLAGS } from "@/lib/retro/retroFlags"; // Z44
import { crearEstadoFractal, avanzarFractal } from "@/lib/prisma/fractalProgresion";
import { PAUSA } from "@/lib/pausaExperiencia";
import { isVizActivated } from "@/lib/alightStore";
import { BAND_STATE } from "@/lib/vizAudio";

const PRISM_Y_START   = 22;
const PRISM_CONE_HALF = 0.9;
// C3: prism hovers 5% of cone height above tarima surface instead of touching it
const PRISM_LAND_OFFSET = PRISM_CONE_HALF * 0.05;  // 0.09 m hover gap
const PRISM_Y_END     = TARIMA_H + PRISM_CONE_HALF + PRISM_LAND_OFFSET;
const DESCEND_DUR     = 5.5;  // seconds, cubic ease-out
const ROTATE_SPEED    = 0.004; // rad / frame

// S3: export so ThreeScene can compute touch distance
export const PRISM_CENTER_Y = PRISM_Y_END;
export const PRISM_SURF_R   = PRISM_CONE_HALF; // bounding radius

const GLASS_MAT = new THREE.MeshPhysicalMaterial({
  color:             new THREE.Color("#cce4ff"),
  emissive:          new THREE.Color("#0a1a3a"),
  emissiveIntensity: 0.35,
  transmission:      0.92,
  roughness:         0.01,
  thickness:         2.5,
  ior:               1.60,
  metalness:         0,
  side:              THREE.DoubleSide,
  transparent:       true,
  opacity:           1.0,
});

const GLOW_MAT = new THREE.MeshBasicMaterial({
  color:       new THREE.Color("#4488cc"),
  transparent: true,
  opacity:     0.07,
  side:        THREE.BackSide,
  depthWrite:  false,
});

// ── S2: proximity fractal overlay shader ─────────────────────────────────────
const PROX_VERT = /* glsl */`
  varying vec2 vUv;
  varying vec3 vWorldPos;
  void main() {
    vUv       = uv;
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const PROX_FRAG = /* glsl */`
  uniform float uProximity;
  uniform float uTime;
  varying vec2  vUv;

  vec3 hsl2rgb(float h, float s, float l) {
    vec3 p = abs(fract(h + vec3(1.0, 2.0/3.0, 1.0/3.0)) * 6.0 - 3.0);
    return l + s * (clamp(p - 1.0, 0.0, 1.0) - 0.5) * (1.0 - abs(2.0*l - 1.0));
  }

  void main() {
    float p = uProximity;
    if (p < 0.001) { gl_FragColor = vec4(0.0); return; }

    vec2 uv = vUv * 2.0 - 1.0;
    uv.x *= 1.4;

    float speed = 0.3 + p * 2.0;
    vec2 c = vec2(
      -0.7269 + sin(uTime * speed * 0.13) * 0.28 * p,
       0.1889 + cos(uTime * speed * 0.09) * 0.20 * p
    );
    vec2 z = uv;
    float trap = 1e5;
    for (int i = 0; i < 48; i++) {
      z     = vec2(z.x*z.x - z.y*z.y, 2.0*z.x*z.y) + c;
      trap  = min(trap, length(z));
      if (length(z) > 4.0) break;
    }

    float hue    = fract(1.0 - exp(-trap * 2.0) + uTime * speed * 0.04);
    vec3  col    = hsl2rgb(hue, 0.85, 0.55);
    float bright = (1.0 - exp(-trap * 1.5)) * (1.0 + p * 2.5);
    col *= bright;

    float alpha  = p * 0.80 * clamp(bright * 0.5, 0.0, 1.0);
    gl_FragColor = vec4(col, alpha);
  }
`;

// ── Z43: uniforms del fractal nuevo (módulo, un solo set compartido por las 3 caras; patrón de LuzLejana) ──
const FRACTAL_UNIFORMS = {
  uT:              { value: 0 },
  uProx:           { value: 0 },
  uOpacidad:       { value: DBG_FRACTAL.OPACIDAD },
  uAlfaOscuro:     { value: DBG_FRACTAL.ALFA_OSCURO },
  uBrillo:         { value: DBG_FRACTAL.BRILLO },
  uBrilloProx:     { value: DBG_FRACTAL.BRILLO_PROX },
  uIter:           { value: DBG_FRACTAL.ITERACIONES },
  uZoom:           { value: DBG_FRACTAL.ZOOM },
  uBailout:        { value: DBG_FRACTAL.BAILOUT },
  uC:              { value: new THREE.Vector2(DBG_FRACTAL.X, DBG_FRACTAL.Y) },
  uOffset:         { value: new THREE.Vector2(DBG_FRACTAL.OFFSET_X, DBG_FRACTAL.OFFSET_Y) },
  uDepthCull:      { value: DBG_FRACTAL.DEPTH_CULL },
  uGrano:          { value: DBG_FRACTAL.GRANO },
  uEscala:         { value: DBG_FRACTAL.ESCALA },
  uCentro:         { value: new THREE.Vector2(DBG_FRACTAL.CENTRO_X, DBG_FRACTAL.CENTRO_Y) },
  uColOscuro:      { value: new THREE.Color(DBG_FRACTAL.COLOR_OSCURO) },
  uColMedio:       { value: new THREE.Color(DBG_FRACTAL.COLOR_MEDIO) },
  uColClaro:       { value: new THREE.Color(DBG_FRACTAL.COLOR_CLARO) },
  uSemilla:        { value: new THREE.Vector4(0, 1.3, 2.6, 3.9) },   // una por cara (0, 1, 2) y la base (3)
  uCarasDistintas: { value: 0 },
  uMusZoom:        { value: 1 },
  uMusC:           { value: new THREE.Vector2(0, 0) },
  uMusBrillo:      { value: 1 },
  // Z44: paleta y encuadre del original
  uPaletaOriginal: { value: DBG_FRACTAL.PALETA_ORIGINAL ? 1 : 0 },
  uTintePrisma:    { value: DBG_FRACTAL.TINTE_PRISMA },
  uColCara:        { value: new THREE.Color(1, 1, 1) },   // color de la cara en sRGB (se copia del vidrio)
  uOpacidadOrig:   { value: DBG_FRACTAL.OPACIDAD_ORIGINAL },
  uAspecto:        { value: DBG_FRACTAL.ASPECTO_ORIGINAL },
  uGranoRes:       { value: DBG_FRACTAL.GRANO_RES },
  uCaraAncho:      { value: dimCaraPrisma(1.01, 1.81, 3).ancho },   // mismas medidas que geoFractal
  uCaraYBase:      { value: dimCaraPrisma(1.01, 1.81, 3).yBase },
  uEncuadreY:      { value: DBG_FRACTAL.ENCUADRE_Y_M },
  uCompensar:      { value: DBG_FRACTAL.COMPENSAR_SALIDA },
  uExposicion:     { value: 1 },
  uCompTope:       { value: DBG_FRACTAL.COMP_TOPE_LINEAL },
};
const FRACTAL_DEFINES = { CELULAR: DBG_FRACTAL.CELULAR_ON ? 1 : 0 };

export default function Prism() {
  const groupRef    = useRef<THREE.Group>(null!);
  const proxRef     = useRef<THREE.ShaderMaterial>(null!);
  const active      = useRef(false);
  const needStart   = useRef(false);
  const startClock  = useRef(0);
  const startExp    = useRef(0);   // Z39: inicio de la bajada en el reloj de la experiencia (s)
  const landedRef   = useRef(false);
  // S2: time-tracking for translucency ramp-up
  const nearSince   = useRef<number | null>(null);
  // Z43: fractal nuevo
  const oldOverlayRef = useRef<THREE.Mesh>(null!);
  const fracMeshRef   = useRef<THREE.Mesh>(null!);
  const fracMatRef    = useRef<THREE.ShaderMaterial>(null!);
  const fracEstado    = useRef(crearEstadoFractal());
  const fracColores   = useRef(["", "", ""]);
  const geoFractal    = useMemo(() => crearGeoCarasPrisma(1.01, 1.81, 3), []);
  useEffect(() => () => geoFractal.dispose(), [geoFractal]);
  useEffect(() => { fracEstado.current = crearEstadoFractal(); FRACTAL_UNIFORMS.uProx.value = 0; }, []);

  const proxUniforms = useMemo(() => ({
    uProximity: { value: 0.0 },
    uTime:      { value: 0.0 },
  }), []);

  useEffect(() => {
    const handler = () => {
      active.current    = true;
      needStart.current = true;
      landedRef.current = false;
      nearSince.current = null;
    };
    window.addEventListener("activar-prisma", handler);
    return () => window.removeEventListener("activar-prisma", handler);
  }, []);

  useFrame(({ clock, gl }, dt) => {
    if (!groupRef.current || !active.current) return;

    if (needStart.current) {
      startClock.current = clock.elapsedTime;
      startExp.current   = RELOJ.tExp;   // Z39
      needStart.current  = false;
    }

    // Z39: con RELOJ_UNIFICADO la bajada se mide con el reloj de la experiencia (se congela en la pausa)
    const elapsed = DBG_SECUENCIA.RELOJ_UNIFICADO ? RELOJ.tExp - startExp.current : clock.elapsedTime - startClock.current;
    const prog    = Math.min(1, elapsed / DESCEND_DUR);
    const ease    = 1 - Math.pow(1 - prog, 3);

    const y = THREE.MathUtils.lerp(PRISM_Y_START, PRISM_Y_END, ease);
    groupRef.current.position.y = y;

    // ── S1: inverted spin ────────────────────────────────────────────────────
    const pp       = INTERACT_STATE.playerPos;
    const px       = pp.x - groupRef.current.position.x;
    const pz       = pp.z - groupRef.current.position.z;
    const py       = pp.y - groupRef.current.position.y;
    const dist     = Math.sqrt(px*px + py*py + pz*pz);

    // S2: proximity (0=far, 1=at maxEffectM)
    const nearM  = DBG_PRISM.nearM;
    const maxEfM = DBG_PRISM.maxEffectM;
    const proximity = landedRef.current
      ? Math.max(0, Math.min(1, (nearM - Math.max(maxEfM, dist)) / (nearM - maxEfM)))
      : 0;

    const spinMult = 1 + proximity * proximity * DBG_PRISM.spinAccel;
    groupRef.current.rotation.y += ROTATE_SPEED * DBG_PRISM.spinDir * spinMult;

    PRISM_POS_UNIFORM.value.set(0, y, 0);
    PRISM_ROT_UNIFORM.value = groupRef.current.rotation.y;

    // C6: dispatch prism-landed once, exactly when descent completes
    if (prog >= 1 && !landedRef.current) {
      landedRef.current = true;
      window.dispatchEvent(new CustomEvent("alight:prism-landed"));
    }

    // C6: rainbow beams only activate after the prism has fully landed
    const rainbowTarget = landedRef.current ? 1 : 0;
    PRISM_RAINBOW_UNIFORM.value = THREE.MathUtils.lerp(
      PRISM_RAINBOW_UNIFORM.value,
      rainbowTarget,
      0.015,
    );

    // ── S2: proximity effects ────────────────────────────────────────────────
    if (proxRef.current) {
      proxRef.current.uniforms.uProximity.value = THREE.MathUtils.lerp(
        proxRef.current.uniforms.uProximity.value,
        proximity,
        0.04,
      );
      proxRef.current.uniforms.uTime.value = clock.elapsedTime;
    }

    // ── Z43: fractal nuevo (una vez por frame; sin allocations) ─────────────────
    const nuevo = DBG_FRACTAL.DISENO_NUEVO;
    if (oldOverlayRef.current) oldOverlayRef.current.visible = !nuevo;
    if (nuevo) {
      const ne = BAND_STATE.normEnergy;
      const fe = avanzarFractal(fracEstado.current, DBG_FRACTAL, dt, dist, landedRef.current, PAUSA.activa,
        isVizActivated(), Math.max(ne[0] ?? 0, ne[1] ?? 0), ne[2] ?? 0, ne[3] ?? 0);
      const U = FRACTAL_UNIFORMS;
      U.uT.value = fe.t;
      U.uProx.value = fe.prox;
      U.uOpacidad.value = DBG_FRACTAL.OPACIDAD;
      U.uAlfaOscuro.value = DBG_FRACTAL.ALFA_OSCURO;
      U.uBrillo.value = DBG_FRACTAL.BRILLO;
      U.uBrilloProx.value = DBG_FRACTAL.BRILLO_PROX;
      U.uIter.value = Math.max(1, Math.min(32, Math.round(DBG_FRACTAL.ITERACIONES)));
      U.uZoom.value = DBG_FRACTAL.ZOOM;
      U.uBailout.value = DBG_FRACTAL.BAILOUT;
      U.uC.value.set(DBG_FRACTAL.X, DBG_FRACTAL.Y);
      U.uOffset.value.set(DBG_FRACTAL.OFFSET_X, DBG_FRACTAL.OFFSET_Y);
      U.uDepthCull.value = DBG_FRACTAL.DEPTH_CULL;
      U.uGrano.value = DBG_FRACTAL.GRANO;
      U.uEscala.value = DBG_FRACTAL.ESCALA;
      U.uCentro.value.set(DBG_FRACTAL.CENTRO_X, DBG_FRACTAL.CENTRO_Y);
      U.uCarasDistintas.value = DBG_FRACTAL.CARAS_DISTINTAS ? 1 : 0;
      U.uMusZoom.value = fe.musZoom;
      U.uMusC.value.set(fe.musCx, fe.musCy);
      U.uMusBrillo.value = fe.musBrillo;
      // Z44: paleta original. La compensación de salida solo tiene sentido si la escena pasa por el composer
      // (OutputPass = ACES + sRGB); sin composer el shader escribe directo en pantalla (sin conversión).
      U.uPaletaOriginal.value = DBG_FRACTAL.PALETA_ORIGINAL ? 1 : 0;
      U.uTintePrisma.value = Math.max(0, Math.min(1, DBG_FRACTAL.TINTE_PRISMA));
      U.uColCara.value.copy(GLASS_MAT.color).convertLinearToSRGB();
      U.uOpacidadOrig.value = DBG_FRACTAL.OPACIDAD_ORIGINAL;
      U.uAspecto.value = Math.max(0.05, DBG_FRACTAL.ASPECTO_ORIGINAL);
      U.uGranoRes.value = Math.max(0, DBG_FRACTAL.GRANO_RES);
      U.uEncuadreY.value = DBG_FRACTAL.ENCUADRE_Y_M;
      const comp = RETRO_FLAGS.enabled ? Math.round(DBG_FRACTAL.COMPENSAR_SALIDA) : 0;
      U.uCompensar.value = comp >= 2 && gl.toneMapping !== THREE.ACESFilmicToneMapping ? 1 : comp;
      U.uExposicion.value = gl.toneMappingExposure;
      U.uCompTope.value = Math.max(0.05, DBG_FRACTAL.COMP_TOPE_LINEAL);
      const cols = fracColores.current;
      if (cols[0] !== DBG_FRACTAL.COLOR_OSCURO) { cols[0] = DBG_FRACTAL.COLOR_OSCURO; U.uColOscuro.value.set(cols[0]); }
      if (cols[1] !== DBG_FRACTAL.COLOR_MEDIO)  { cols[1] = DBG_FRACTAL.COLOR_MEDIO;  U.uColMedio.value.set(cols[1]); }
      if (cols[2] !== DBG_FRACTAL.COLOR_CLARO)  { cols[2] = DBG_FRACTAL.COLOR_CLARO;  U.uColClaro.value.set(cols[2]); }
      // ruido celular: es un #define (sin rama en el fragment); cambiarlo recompila solo este material
      const mat = fracMatRef.current;
      const cel = DBG_FRACTAL.CELULAR_ON ? 1 : 0;
      if (mat && mat.defines && mat.defines.CELULAR !== cel) { mat.defines.CELULAR = cel; mat.needsUpdate = true; }
    }
    // invisible (prox ≈ 0 o diseño anterior) → no se dibuja: costo 0 lejos del prisma
    if (fracMeshRef.current) fracMeshRef.current.visible = nuevo && FRACTAL_UNIFORMS.uProx.value > 0.001;

    // Glass translucency ramp (PRISM_TRANSLUCENT_MS)
    if (dist < nearM && landedRef.current) {
      const ahoraP = DBG_SECUENCIA.RELOJ_UNIFICADO ? ahoraExp() : performance.now();   // Z39
      if (nearSince.current === null) nearSince.current = ahoraP;
      const frac   = Math.min(1, (ahoraP - nearSince.current) / DBG_PRISM.translucentMs);
      GLASS_MAT.opacity = 1.0 - frac * (1.0 - DBG_PRISM.translucentOpacity);
    } else {
      nearSince.current = null;
      GLASS_MAT.opacity = THREE.MathUtils.lerp(GLASS_MAT.opacity, 1.0, 0.02);
    }

    // Glow brightens at CLOSE distance
    if (dist < DBG_PRISM.closeM && landedRef.current) {
      const gp = Math.min(1, (DBG_PRISM.closeM - dist) / DBG_PRISM.closeM);
      GLOW_MAT.opacity = THREE.MathUtils.lerp(GLOW_MAT.opacity, 0.07 + gp * 0.35, 0.05);
    } else {
      GLOW_MAT.opacity = THREE.MathUtils.lerp(GLOW_MAT.opacity, 0.07, 0.03);
    }
  });

  return (
    <group ref={groupRef} position={[0, PRISM_Y_START, 0]}>
      <mesh castShadow receiveShadow>
        <coneGeometry args={[1.0, 1.8, 3, 1]} />
        <primitive object={GLASS_MAT} attach="material" />
      </mesh>
      {/* S2: fractal proximity overlay (Z43: oculto con DBG_FRACTAL.DISENO_NUEVO) */}
      <mesh ref={oldOverlayRef}>
        <coneGeometry args={[1.01, 1.81, 3, 1]} />
        <shaderMaterial
          ref={proxRef}
          vertexShader={PROX_VERT}
          fragmentShader={PROX_FRAG}
          uniforms={proxUniforms}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Z43: fractal nuevo — mismo tamaño que el S2; un material y un set de uniforms para las 3 caras.
          renderOrder 0 y sin depthWrite, como el S2: se ordena por distancia con paneles y haces y no tapa nada
          de lo que está delante; el cielo (−0,5 / −1) queda detrás y el halo de las luces (10) encima. */}
      <mesh ref={fracMeshRef} geometry={geoFractal} visible={false}>
        <shaderMaterial
          ref={fracMatRef}
          vertexShader={FRACTAL_JUNGLA_VERT}
          fragmentShader={FRACTAL_JUNGLA_FRAG}
          uniforms={FRACTAL_UNIFORMS}
          defines={FRACTAL_DEFINES}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh>
        <coneGeometry args={[1.18, 1.88, 3, 1]} />
        <primitive object={GLOW_MAT} attach="material" />
      </mesh>
    </group>
  );
}
