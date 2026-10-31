"use client";
// N3: Four spotlight beams + visible additive cones, one per sector diagonal.
// R2: Short cone from hazOriginHM down to floor, luminaria box + cable at origin height.
// Objects are added imperatively to allow dynamic position updates from DBG_SILLAS.
// No shadows. Colors and intensity live-update via DBG_SILLAS each frame.

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { DBG_SILLAS } from "@/lib/debugConfig";
import { getHazUnderUser, getHazPositionsXZ } from "@/lib/haz";
import { startVizAudio, openGate, closeGate, isPlaying } from "@/lib/vizAudio";

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
  varying float vHeightFrac;
  varying float vFresnel;
  void main() {
    float vGrad = sin(vHeightFrac * 3.14159265);
    float alpha = uOpacity * (0.15 + 0.85 * vFresnel) * vGrad;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

// Cable length above luminaria before disappearing into darkness
const CABLE_LEN = 10.0;

type ConeEntry  = { mesh: THREE.Mesh; mat: THREE.ShaderMaterial };
type LedEntry   = { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial };

export default function HazSystem() {
  const { scene }     = useThree();
  const lightsRef     = useRef<THREE.SpotLight[]>([]);
  const conesRef      = useRef<ConeEntry[]>([]);
  const boxesRef      = useRef<THREE.Mesh[]>([]);
  const cablesRef     = useRef<THREE.Mesh[]>([]);
  const ledsRef       = useRef<LedEntry[]>([]);
  const gateStateRef  = useRef([false, false, false, false]);
  // Pre-allocated Color objects — reused each frame (no per-frame allocs)
  const colorObjs     = useRef(INITIAL_COLORS.map(c => new THREE.Color(c)));
  // Pre-allocated Vector3 for LED lookAt target — avoids per-frame allocation
  const ledLookTarget = useRef(new THREE.Vector3());

  // R3: Toggle-switch semantics — entry flank fires alight:haz-toggle; exit has no gate effect.
  useEffect(() => {
    const onToggle = (e: Event) => {
      const { index, on } = (e as CustomEvent).detail as { index: number; on: boolean };
      gateStateRef.current[index] = on;
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

    const boxMat   = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.9, metalness: 0.1 });
    const cableMat = new THREE.MeshBasicMaterial({ color: 0x0a0a0a });

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
          uColor:   { value: new THREE.Color() },
          uOpacity: { value: DBG_SILLAS.hazConeOpacity },
          uHalfH:   { value: halfH },
        },
        vertexShader:   CONE_VERT,
        fragmentShader: CONE_FRAG,
        transparent:    true,
        blending:       THREE.AdditiveBlending,
        depthWrite:     false,
        side:           THREE.DoubleSide,
      });
      const coneMesh = new THREE.Mesh(coneGeo, coneMat);
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

      // LED state indicator
      const ledMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
      const led    = new THREE.Mesh(ledGeo, ledMat);
      scene.add(led);
      leds.push({ mesh: led, mat: ledMat });
    }

    lightsRef.current  = lights;
    conesRef.current   = cones;
    boxesRef.current   = boxes;
    cablesRef.current  = cables;
    ledsRef.current    = leds;

    return () => {
      lights.forEach(l => { scene.remove(l); scene.remove(l.target); });
      cones.forEach(({ mesh, mat }) => { scene.remove(mesh); mat.dispose(); });
      boxes.forEach(b => scene.remove(b));
      cables.forEach(c => scene.remove(c));
      leds.forEach(({ mesh, mat }) => { scene.remove(mesh); mat.dispose(); });
      coneGeo.dispose(); boxGeo.dispose(); cableGeo.dispose(); ledGeo.dispose();
      boxMat.dispose();  cableMat.dispose();
    };
  }, [scene]);

  useFrame(({ camera }) => {
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

    for (let i = 0; i < 4; i++) {
      const [bx, bz] = positions[i];
      const col = colorObjs.current[i];
      col.set(DBG_SILLAS[COLOR_KEYS[i]]);

      // SpotLight at origin height
      const light = lights[i];
      light.position.set(bx, originH, bz);
      light.intensity = DBG_SILLAS.hazSpotIntensity * scale;
      light.color.copy(col);
      light.target.position.set(bx, 0, bz);
      light.target.updateMatrixWorld();

      // Cone: centre at half-height, vertex at top (origin), base at floor
      const { mesh: coneMesh, mat: coneMat } = cones[i];
      coneMesh.position.set(bx, originH / 2, bz);
      coneMat.uniforms.uColor.value.copy(col);
      coneMat.uniforms.uOpacity.value = DBG_SILLAS.hazConeOpacity *
        (gateStateRef.current[i] ? DBG_SILLAS.hazOnBoost : 1.0);

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
      ledMat.color.set(gateStateRef.current[i] ? DBG_SILLAS[COLOR_KEYS[i]] : '#111111');
    }
  });

  return null;
}
