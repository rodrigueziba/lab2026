"use client";
// N5: Procedural eye disc visible on the TARIMA dome ceiling when remote watchers > 0.
// Appears intermittently: visible for EYE_VISIBLE_S every EYE_PERIOD_S seconds.
// Mounted alongside FaceDome (path !== "sillas") in ThreeScene.

import { useRef, useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { DBG_SILLAS } from "@/lib/debugConfig";
import { SESSION } from "@/lib/remoteSession";

const DOME_R        = 28;
const EYE_PERIOD_S  = 10;    // seconds between appearances
const EYE_VISIBLE_S = 3;     // how long eye stays visible each cycle
const EYE_FADE_S    = 0.5;   // fade in/out duration

// Position on dome interior: near-zenith, slightly toward -Z (facing audience)
const EYE_POS = new THREE.Vector3(0, DOME_R * 0.82, -DOME_R * 0.28).normalize().multiplyScalar(DOME_R - 0.5);

const EYE_VERT = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const EYE_FRAG = /* glsl */`
  uniform float uTime;
  uniform float uReveal;
  uniform float uBlink;  // 0 = open, 1 = closed
  varying vec2 vUv;

  void main() {
    vec2 uv = vUv * 2.0 - 1.0;
    float r = length(uv);
    if (r > 1.0) discard;

    float alpha = smoothstep(1.0, 0.88, r);

    // sclera
    vec3 col = vec3(0.88, 0.84, 0.78);

    // iris: desaturated steel-blue, hex pattern hint
    float irisR = 0.44;
    float iris  = smoothstep(irisR + 0.04, irisR, r);
    vec3 irisCol = vec3(0.18, 0.30, 0.50);
    // radial texture on iris
    float ang = atan(uv.y, uv.x);
    float fibers = 0.5 + 0.5 * sin(ang * 14.0 + uTime * 0.3) * smoothstep(irisR, 0.1, r);
    irisCol *= 0.75 + 0.25 * fibers;
    col = mix(col, irisCol, iris);

    // pupil: near-black, slight vertical oval
    vec2 pupilUv = vec2(uv.x, uv.y * 1.18);
    float pupil = smoothstep(0.17, 0.12, length(pupilUv));
    col = mix(col, vec3(0.025, 0.018, 0.03), pupil);

    // specular catchlight
    float spec = smoothstep(0.07, 0.0, length(uv - vec2(0.09, 0.12)));
    col += vec3(0.95, 0.95, 1.0) * spec * 0.85;

    // upper & lower eyelids — blink folds down from top and up from bottom
    float lidClose = uBlink;
    float topLid   = uv.y - (1.0 - lidClose * 2.1);
    float botLid   = -uv.y - (1.0 - lidClose * 1.6);
    float eyelid   = smoothstep(0.0, 0.08, -topLid) * smoothstep(0.0, 0.08, -botLid);
    alpha *= eyelid;

    // subtle limbal ring
    float limbal = smoothstep(irisR + 0.05, irisR + 0.01, r) * (1.0 - iris);
    col = mix(col, vec3(0.06, 0.05, 0.08), limbal * 0.6);

    gl_FragColor = vec4(col, alpha * uReveal);
  }
`;

export default function WatcherEye() {
  const meshRef = useRef<THREE.Mesh>(null);

  const uniforms = useMemo(() => ({
    uTime:   { value: 0 },
    uReveal: { value: 0 },
    uBlink:  { value: 0 },
  }), []);

  const watchersRef = useRef(0);
  const revealRef   = useRef(0);
  const blinkRef    = useRef(0);

  useEffect(() => {
    if (!DBG_SILLAS.watcherEyeEnabled) return;
    const unsub = SESSION.onWatchers(n => { watchersRef.current = n; });
    return unsub;
  }, []);

  useFrame(({ clock }, dt) => {
    if (!DBG_SILLAS.watcherEyeEnabled) {
      uniforms.uReveal.value = 0;
      return;
    }

    const t = clock.elapsedTime;
    uniforms.uTime.value = t;

    if (watchersRef.current <= 0) {
      // Fade out
      revealRef.current = Math.max(0, revealRef.current - dt / EYE_FADE_S);
    } else {
      // Periodic visibility: visible for EYE_VISIBLE_S every EYE_PERIOD_S
      const phase = t % EYE_PERIOD_S;
      const wantVisible = phase < EYE_VISIBLE_S;
      const targetReveal = wantVisible ? 1 : 0;
      const fadeSpeed = dt / EYE_FADE_S;
      revealRef.current = THREE.MathUtils.clamp(
        revealRef.current + (targetReveal - revealRef.current) * Math.min(1, fadeSpeed * 5),
        0, 1,
      );
    }

    uniforms.uReveal.value = revealRef.current;

    // Slow blink: opens and closes over 3s cycle when visible
    const blinkCycle = Math.sin(t * 0.7) * 0.5 + 0.5; // 0–1
    blinkRef.current = THREE.MathUtils.lerp(blinkRef.current, blinkCycle * 0.15, dt * 2);
    uniforms.uBlink.value = blinkRef.current;
  });

  // Quaternion computed once in useMemo — no per-render allocation
  const eyeQuat = useMemo(() => {
    const lookDir  = EYE_POS.clone().negate().normalize();
    const up       = new THREE.Vector3(0, 1, 0);
    const q        = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), lookDir);
    const tiltAxis = new THREE.Vector3().crossVectors(lookDir, up).normalize();
    const tiltQ    = new THREE.Quaternion().setFromAxisAngle(tiltAxis, -0.2);
    q.premultiply(tiltQ);
    return q;
  }, []);

  return (
    <mesh
      ref={meshRef}
      position={EYE_POS}
      quaternion={eyeQuat}
      renderOrder={1}
    >
      <circleGeometry args={[1.6, 48]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={EYE_VERT}
        fragmentShader={EYE_FRAG}
        transparent
        depthWrite={false}
        side={THREE.FrontSide}
      />
    </mesh>
  );
}
