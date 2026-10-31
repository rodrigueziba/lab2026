"use client";
// N3: Four spotlight beams + visible additive cones, one per sector diagonal.
// R2: Short cone from hazOriginHM down to floor, luminaria box + cable at origin height.
// Objects are added imperatively to allow dynamic position updates from DBG_SILLAS.
// No shadows. Colors and intensity live-update via DBG_SILLAS each frame.

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { DBG_SILLAS, DBG_RETRO_FX } from "@/lib/debugConfig";
import { getHazUnderUser, getHazPositionsXZ } from "@/lib/haz";
import { startVizAudio, openGate, closeGate, isPlaying } from "@/lib/vizAudio";
import { getDawnState, startDawnSequence } from "@/lib/alightStore";
import { createStripeBandTex } from "@/lib/retro/decals";

const R5_HAZ_RETRO = true; // R5: retro housing color + stripe decal + amber LED

const COLOR_KEYS = [
  "hazColor0", "hazColor1", "hazColor2", "hazColor3",
] as const;

const INITIAL_COLORS = [
  DBG_SILLAS.hazColor0,
  DBG_SILLAS.hazColor1,
  DBG_SILLAS.hazColor2,
  DBG_SILLAS.hazColor3,
] as const;

// ── R2: Cone shader — fresnel edge glow + vertical gradient ──────────────────
const CONE_VERT = /* glsl */`
  uniform float uHalfH;
  varying float vHeightFrac;
  varying float vFresnel;
  void main() {
    vec4 mvPos   = modelViewMatrix * vec4(position, 1.0);
    vec3 viewDir = normalize(-mvPos.xyz);
    vec3 vNorm   = normalize(normalMatrix * normal);
    vFresnel     = pow(1.0 - abs(dot(vNorm, viewDir)), 2.0);
    vHeightFrac  = (position.y + uHalfH) / (uHalfH * 2.0);
    gl_Position  = projectionMatrix * mvPos;
  }
`;
const CONE_FRAG = /* glsl */`
  uniform float uOpacity;
  uniform vec3  uColor;
  uniform float uHalfH;
  uniform float uTime;
  uniform float uStripeM;
  uniform float uStripeWidth;
  uniform float uStripeSpeed;
  uniform float uStripeBoost;
  varying float vHeightFrac;
  varying float vFresnel;
  void main() {
    float vGrad     = sin(vHeightFrac * 3.14159265);
    float baseAlpha = uOpacity * (0.15 + 0.85 * vFresnel) * vGrad;
    // R4: rising horizontal stripes — hard edges, neon boost
    float worldH    = vHeightFrac * uHalfH * 2.0;
    float sPos      = fract((worldH - uTime * uStripeSpeed) / uStripeM);
    float stripe    = step(1.0 - uStripeWidth, sPos);
    float alpha     = baseAlpha + stripe * uOpacity * uStripeBoost * vGrad;
    gl_FragColor    = vec4(uColor, alpha);
  }
`;

// Cable length above luminaria before disappearing into darkness
const CABLE_LEN = 10.0;

type ConeEntry  = { mesh: THREE.Mesh; mat: THREE.ShaderMaterial };
type LedEntry   = { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial };
// U6B: per-beam flash state
interface FlashSt { active: boolean; startT: number; wasOn: boolean; }

export default function HazSystem() {
  const { scene }     = useThree();
  const lightsRef     = useRef<THREE.SpotLight[]>([]);
  const conesRef      = useRef<ConeEntry[]>([]);
  const boxesRef      = useRef<THREE.Mesh[]>([]);
  const cablesRef     = useRef<THREE.Mesh[]>([]);
  const ledsRef       = useRef<LedEntry[]>([]);
  const stripeDecalsRef = useRef<THREE.Mesh[]>([]);
  const gateStateRef    = useRef([false, false, false, false]);
  // U6B: flash state + pending (event handler sets pending; useFrame consumes it)
  const flashRef        = useRef<FlashSt[]>([
    { active: false, startT: 0, wasOn: false },
    { active: false, startT: 0, wasOn: false },
    { active: false, startT: 0, wasOn: false },
    { active: false, startT: 0, wasOn: false },
  ]);
  const flashPendingRef = useRef<Array<boolean | null>>([null, null, null, null]);
  // U9: first-haz dawn trigger — set in event handler, consumed in useFrame (needs clock.elapsedTime)
  const dawnPendingRef  = useRef(false);
  // Pre-allocated Color objects — reused each frame (no per-frame allocs)
  const colorObjs     = useRef(INITIAL_COLORS.map(c => new THREE.Color(c)));
  // Pre-allocated Vector3 for LED lookAt target — avoids per-frame allocation
  const ledLookTarget = useRef(new THREE.Vector3());

  // R3: Toggle-switch semantics — entry flank fires alight:haz-toggle; exit has no gate effect.
  useEffect(() => {
    const onToggle = (e: Event) => {
      const { index, on } = (e as CustomEvent).detail as { index: number; on: boolean };
      gateStateRef.current[index] = on;
      flashPendingRef.current[index] = on; // U6B: signal flash to useFrame
      // U9: first haz ever triggers dawn sequence (pending flag consumed in useFrame for clock access)
      if (on && getDawnState().phase === 'inactivo') dawnPendingRef.current = true;
      if (on) {
        if (!isPlaying()) {
          void startVizAudio().then(result => {
            if (result === "need-gesture") {
              window.dispatchEvent(new CustomEvent("alight:audio-need-gesture", { detail: { need: true } }));
            }
          });
        }
        openGate(index);
      } else {
        closeGate(index);
      }
    };
    window.addEventListener("alight:haz-toggle", onToggle);
    return () => {
      window.removeEventListener("alight:haz-toggle", onToggle);
      for (let i = 0; i < 4; i++) closeGate(i);
    };
  }, []);

  // R2: Build short cone (hazOriginHM tall, hazConeFloorRM base), luminaria, cable, LED
  useEffect(() => {
    const originH  = DBG_SILLAS.hazOriginHM;
    const floorR   = DBG_SILLAS.hazConeFloorRM;
    const halfH    = originH / 2;
    const spotAngle = Math.atan(floorR / originH);
    const spotDist  = originH * 3;

    // Shared geometries (all cones identical — only position differs)
    const coneGeo  = new THREE.CylinderGeometry(0, floorR, originH, 48, 1, true);
    const boxGeo   = new THREE.BoxGeometry(0.28, 0.2, 0.28);
    const cableGeo = new THREE.CylinderGeometry(0.004, 0.004, CABLE_LEN, 4, 1);
    const ledGeo   = new THREE.PlaneGeometry(0.03, 0.03);

    // R5: housing — carbon gray #3A3B3C; legacy was 0x2a2a2a
    const boxColor  = R5_HAZ_RETRO ? 0x3A3B3C : 0x2a2a2a;
    const boxMat   = new THREE.MeshStandardMaterial({ color: boxColor, roughness: 0.85, metalness: 0.15 });
    const cableMat = new THREE.MeshBasicMaterial({ color: 0x0a0a0a });

    // R5: stripe decal — one shared texture for all four housings
    const stripeTex = R5_HAZ_RETRO ? createStripeBandTex(undefined, 256, 32) : null;
    const stripeMat = stripeTex
      ? new THREE.MeshBasicMaterial({
          map: stripeTex, transparent: false,
          polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
        })
      : null;
    const stripeGeo = R5_HAZ_RETRO ? new THREE.PlaneGeometry(0.26, 0.012) : null;
    const stripeDecals: THREE.Mesh[] = [];

    const lights: THREE.SpotLight[] = [];
    const cones:  ConeEntry[]       = [];
    const boxes:  THREE.Mesh[]      = [];
    const cables: THREE.Mesh[]      = [];
    const leds:   LedEntry[]        = [];

    for (let i = 0; i < 4; i++) {
      // SpotLight: origin height, angle from cone geometry, no shadow
      const light = new THREE.SpotLight();
      light.angle      = spotAngle;
      light.penumbra   = 0.5;
      light.distance   = spotDist;
      light.decay      = 2;
      light.castShadow = false;
      scene.add(light);
      scene.add(light.target);
      lights.push(light);

      // Cone: short, additive, fresnel+gradient shader
      const coneMat = new THREE.ShaderMaterial({
        uniforms: {
          uColor:       { value: new THREE.Color() },
          uOpacity:     { value: DBG_SILLAS.hazConeOpacity },
          uHalfH:       { value: halfH },
          uTime:        { value: 0 },
          uStripeM:     { value: DBG_RETRO_FX.hazStripeM },
          uStripeWidth: { value: DBG_RETRO_FX.hazStripeWidth },
          uStripeSpeed: { value: DBG_RETRO_FX.hazStripeSpeed },
          uStripeBoost: { value: DBG_RETRO_FX.hazStripeBoost },
        },
        vertexShader:   CONE_VERT,
        fragmentShader: CONE_FRAG,
        transparent:    true,
        blending:       THREE.AdditiveBlending,
        depthWrite:     false,
        side:           THREE.DoubleSide,
      });
      const coneMesh = new THREE.Mesh(coneGeo, coneMat);
      coneMesh.renderOrder = 10; // U3: render after panorama layers (rO 0-7)
      scene.add(coneMesh);
      cones.push({ mesh: coneMesh, mat: coneMat });

      // Luminaria housing
      const box = new THREE.Mesh(boxGeo, boxMat);
      scene.add(box);
      boxes.push(box);

      // Suspension cable (rises above luminaria into darkness)
      const cable = new THREE.Mesh(cableGeo, cableMat);
      scene.add(cable);
      cables.push(cable);

      // R5: stripe decal on front face of housing
      if (R5_HAZ_RETRO && stripeMat && stripeGeo) {
        const sd = new THREE.Mesh(stripeGeo, stripeMat);
        // position at housing centre — offset set in useFrame
        scene.add(sd);
        stripeDecals.push(sd);
      }

      // LED state indicator (R5: amber; legacy: dark gray 0x111111)
      const ledMat = new THREE.MeshBasicMaterial({ color: R5_HAZ_RETRO ? 0x3A2800 : 0x111111 });
      const led    = new THREE.Mesh(ledGeo, ledMat);
      scene.add(led);
      leds.push({ mesh: led, mat: ledMat });
    }

    lightsRef.current       = lights;
    conesRef.current        = cones;
    boxesRef.current        = boxes;
    cablesRef.current       = cables;
    ledsRef.current         = leds;
    stripeDecalsRef.current = stripeDecals;

    return () => {
      lights.forEach(l => { scene.remove(l); scene.remove(l.target); });
      cones.forEach(({ mesh, mat }) => { scene.remove(mesh); mat.dispose(); });
      boxes.forEach(b => scene.remove(b));
      cables.forEach(c => scene.remove(c));
      leds.forEach(({ mesh, mat }) => { scene.remove(mesh); mat.dispose(); });
      stripeDecals.forEach(sd => { scene.remove(sd); });
      coneGeo.dispose(); boxGeo.dispose(); cableGeo.dispose(); ledGeo.dispose();
      boxMat.dispose(); cableMat.dispose();
      stripeTex?.dispose(); stripeMat?.dispose(); stripeGeo?.dispose();
    };
  }, [scene]);

  useFrame(({ camera, clock }) => {
    // U9: consume first-haz dawn trigger (clock.elapsedTime available here)
    if (dawnPendingRef.current) { dawnPendingRef.current = false; startDawnSequence(clock.elapsedTime); }
    getHazUnderUser(camera.position.x, camera.position.z);

    const positions = getHazPositionsXZ();
    const lights    = lightsRef.current;
    const cones     = conesRef.current;
    const boxes     = boxesRef.current;
    const cables    = cablesRef.current;
    const leds      = ledsRef.current;
    if (!lights.length) return;

    const originH = DBG_SILLAS.hazOriginHM;
    const scale   = DBG_SILLAS.globalLightScale;
    const now     = clock.elapsedTime;

    // U6B: consume pending flash requests
    for (let fi = 0; fi < 4; fi++) {
      const pnd = flashPendingRef.current[fi];
      if (pnd !== null) {
        flashRef.current[fi] = { active: true, startT: now, wasOn: pnd };
        flashPendingRef.current[fi] = null;
      }
    }

    for (let i = 0; i < 4; i++) {
      const [bx, bz] = positions[i];
      const col = colorObjs.current[i];
      col.set(DBG_SILLAS[COLOR_KEYS[i]]);

      // U6B: compute flash multiplier (1.0 = no flash)
      const fl = flashRef.current[i];
      let flashMult = 1.0;
      if (fl.active) {
        const fe = now - fl.startT;
        if (fl.wasOn) {
          const atkS = DBG_SILLAS.u6FlashAtkS;
          const decS = DBG_SILLAS.u6FlashDecS;
          const peak = DBG_SILLAS.u6FlashPeak;
          flashMult = fe < atkS
            ? 1.0 + (peak - 1.0) * fe / atkS
            : 1.0 + (peak - 1.0) * Math.exp(-(fe - atkS) / decS);
          if (flashMult < 1.005) { fl.active = false; flashMult = 1.0; }
        } else {
          const dimF = DBG_SILLAS.u6DimFactor;
          const decS = DBG_SILLAS.u6DimDecS;
          flashMult = dimF + (1.0 - dimF) * (1.0 - Math.exp(-fe / decS));
          if (flashMult > 0.995) { fl.active = false; flashMult = 1.0; }
        }
      }

      // SpotLight at origin height
      const light = lights[i];
      light.position.set(bx, originH, bz);
      light.intensity = DBG_SILLAS.hazSpotIntensity * scale * flashMult;
      // U6B: widen angle 15 % proportionally to peak overshoot
      const baseAngle  = Math.atan(DBG_SILLAS.hazConeFloorRM / DBG_SILLAS.hazOriginHM);
      const peakOver   = fl.active && fl.wasOn
        ? Math.max(0, (flashMult - 1.0) / Math.max(0.01, DBG_SILLAS.u6FlashPeak - 1.0))
        : 0;
      light.angle = baseAngle * (1.0 + 0.15 * peakOver);
      light.color.copy(col);
      light.target.position.set(bx, 0, bz);
      light.target.updateMatrixWorld();

      // Cone: centre at half-height, vertex at top (origin), base at floor
      const { mesh: coneMesh, mat: coneMat } = cones[i];
      coneMesh.position.set(bx, originH / 2, bz);
      coneMat.uniforms.uColor.value.copy(col);
      coneMat.uniforms.uOpacity.value     = DBG_SILLAS.hazConeOpacity *
        (gateStateRef.current[i] ? DBG_SILLAS.hazOnBoost : 1.0) * flashMult;
      coneMat.uniforms.uTime.value        = now;
      coneMat.uniforms.uStripeM.value     = DBG_RETRO_FX.hazStripeM;
      coneMat.uniforms.uStripeWidth.value = DBG_RETRO_FX.hazStripeWidth;
      coneMat.uniforms.uStripeSpeed.value = DBG_RETRO_FX.hazStripeSpeed;
      coneMat.uniforms.uStripeBoost.value = DBG_RETRO_FX.hazStripeBoost;

      // Luminaria housing centred at origin height
      boxes[i].position.set(bx, originH, bz);

      // Cable: rises from top of housing
      cables[i].position.set(bx, originH + 0.1 + CABLE_LEN / 2, bz);

      // LED indicator: face toward scene centre
      const dx = -bx, dz = -bz;
      const dlen = Math.sqrt(dx * dx + dz * dz);
      const nx = dlen > 1e-4 ? dx / dlen : 0;
      const nz = dlen > 1e-4 ? dz / dlen : -1;
      const { mesh: led, mat: ledMat } = leds[i];
      led.position.set(bx + nx * 0.141, originH, bz + nz * 0.141);
      ledLookTarget.current.set(bx + nx * 2, originH, bz + nz * 2);
      led.lookAt(ledLookTarget.current);
      // R5: amber LED — on: #F4B62E full; off: dim #3A2800; legacy: beam color / dark
      ledMat.color.set(gateStateRef.current[i]
        ? (R5_HAZ_RETRO ? '#F4B62E' : DBG_SILLAS[COLOR_KEYS[i]])
        : (R5_HAZ_RETRO ? '#3A2800' : '#111111'));

      // R5: stripe decal — positioned on the front face of the box (facing scene centre)
      const sd = stripeDecalsRef.current[i];
      if (sd) {
        sd.position.set(bx + nx * 0.141, originH, bz + nz * 0.141);
        ledLookTarget.current.set(bx + nx * 2, originH, bz + nz * 2);
        sd.lookAt(ledLookTarget.current);
      }
    }
  });

  return null;
}
