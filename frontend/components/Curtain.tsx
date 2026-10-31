"use client";
// N6: Telón rojo de inicio — cloth simulation (PBD) with SpotLight.
// Mounted in ThreeScene while experienceState === 'cortina'.
// R1: Curtain plane computed from camera.getWorldDirection() at mount time.
// Dispatches 'alight:curtain-passed' when camera crosses the computed plane.
// Dispatches 'alight:curtain-done' after fade-out so Scene can unmount it.

import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { DBG_SILLAS } from "@/lib/debugConfig";

// ── Grid dimensions ───────────────────────────────────────────────────────────
const COLS = 48;
const ROWS = 32;
const N    = COLS * ROWS;

// Capsule (player body) dimensions
const CAP_R = 0.35;
const CAP_H = 1.7;

const FLOOR_Y    = 0.05;
const SIM_DT     = 1 / 60;   // fixed substep
const SUBSTEPS   = 2;
const ITERS      = 6;
const FADE_OUT_S = 1.2;

// Velvet sheen colour — allocated once at module level, no per-frame allocation
const SHEEN_COL = new THREE.Color("#c1001a");

// ── Simulation data ───────────────────────────────────────────────────────────
type SimData = {
  pos:        Float32Array;  // N × 3  current positions
  vel:        Float32Array;  // N × 3  velocities
  oldPos:     Float32Array;  // N × 3  saved before PBD step (for vel re-derivation)
  pin:        Uint8Array;    // N      1 = top row, pinned
  pinnedPos:  Float32Array;  // COLS × 3  initial top-row positions (invariant)
  cstA:       Int32Array;    // constraint particle-A indices
  cstB:       Int32Array;    // constraint particle-B indices
  cstR:       Float32Array;  // constraint rest lengths
  nCst:       number;
  normals:    Float32Array;  // N × 3  recomputed each frame
  posAttr:    THREE.BufferAttribute | null;
  normAttr:   THREE.BufferAttribute | null;
  curtainW:   number;
  curtainH:   number;
  // R1: plane params computed from camera direction at build time
  fwdX:         number;   // horizontal forward unit vector X
  fwdZ:         number;   // horizontal forward unit vector Z
  centerX:      number;   // curtain center world X
  centerZ:      number;   // curtain center world Z
  curtainPlaneD: number;  // dot(center, fwd) — crossing when dot(cam.pos, fwd) > planeD + 0.25
  passed:     boolean;
  fadingOut:  boolean;
  fadeStart:  number;
  opacity:    number;
};

function buildSim(
  curtainW: number, curtainH: number,
  centerX: number, centerZ: number,
  fwdX: number, fwdZ: number,
  rightX: number, rightZ: number,
): SimData {
  const pos     = new Float32Array(N * 3);
  const vel     = new Float32Array(N * 3);
  const oldPos  = new Float32Array(N * 3);
  const pin     = new Uint8Array(N);
  const normals = new Float32Array(N * 3);

  const gatherX = DBG_SILLAS.curtainGather;
  const halfW   = curtainW * 0.5;
  const nPleats = 8;
  const pleatD  = 0.15;

  for (let j = 0; j < ROWS; j++) {
    const vt = j / (ROWS - 1);
    const y  = curtainH * (1 - vt) + FLOOR_Y * vt;
    for (let i = 0; i < COLS; i++) {
      const ut   = i / (COLS - 1);
      const span = (-halfW + ut * curtainW) * gatherX;
      const pleat = Math.sin(ut * nPleats * Math.PI * 2) * pleatD;
      const idx  = (j * COLS + i) * 3;
      pos[idx]   = centerX + rightX * span + fwdX * pleat;
      pos[idx+1] = y;
      pos[idx+2] = centerZ + rightZ * span + fwdZ * pleat;
    }
  }

  // Pin top row (j = 0)
  for (let i = 0; i < COLS; i++) pin[i] = 1;

  // Store initial pinned positions (invariant reference for constraint restore)
  const pinnedPos = new Float32Array(COLS * 3);
  for (let i = 0; i < COLS; i++) {
    pinnedPos[i*3]   = pos[i*3];
    pinnedPos[i*3+1] = pos[i*3+1];
    pinnedPos[i*3+2] = pos[i*3+2];
  }

  // Build constraints into typed arrays for cache efficiency
  const maxCst = (COLS-1)*ROWS + COLS*(ROWS-1) + 2*(COLS-1)*(ROWS-1) + (COLS-2)*ROWS + COLS*(ROWS-2);
  const cstA = new Int32Array(maxCst);
  const cstB = new Int32Array(maxCst);
  const cstR = new Float32Array(maxCst);
  let nc = 0;

  const addCst = (a: number, b: number) => {
    const a3 = a * 3, b3 = b * 3;
    const dx = pos[b3] - pos[a3], dy = pos[b3+1] - pos[a3+1], dz = pos[b3+2] - pos[a3+2];
    cstA[nc] = a; cstB[nc] = b; cstR[nc] = Math.sqrt(dx*dx + dy*dy + dz*dz); nc++;
  };

  // Structural horizontal
  for (let j = 0; j < ROWS;   j++) for (let i = 0; i < COLS-1; i++) addCst(j*COLS+i,   j*COLS+i+1);
  // Structural vertical
  for (let j = 0; j < ROWS-1; j++) for (let i = 0; i < COLS;   i++) addCst(j*COLS+i,   (j+1)*COLS+i);
  // Shear (both diagonals)
  for (let j = 0; j < ROWS-1; j++) for (let i = 0; i < COLS-1; i++) {
    addCst(j*COLS+i,   (j+1)*COLS+i+1);
    addCst(j*COLS+i+1, (j+1)*COLS+i);
  }
  // Bending horizontal
  for (let j = 0; j < ROWS;   j++) for (let i = 0; i < COLS-2; i++) addCst(j*COLS+i,   j*COLS+i+2);
  // Bending vertical
  for (let j = 0; j < ROWS-2; j++) for (let i = 0; i < COLS;   i++) addCst(j*COLS+i,   (j+2)*COLS+i);

  oldPos.set(pos);

  return {
    pos, vel, oldPos, pin, pinnedPos,
    cstA, cstB, cstR, nCst: nc,
    normals,
    posAttr: null, normAttr: null,
    curtainW, curtainH,
    fwdX, fwdZ, centerX, centerZ,
    curtainPlaneD: centerX * fwdX + centerZ * fwdZ,
    passed: false, fadingOut: false, fadeStart: 0, opacity: 1,
  };
}

// ── Normal recomputation (called after each sim step) ─────────────────────────
function recomputeNormals(sim: SimData): void {
  const { pos, normals } = sim;
  normals.fill(0);
  for (let j = 0; j < ROWS-1; j++) {
    for (let i = 0; i < COLS-1; i++) {
      const i00 = (j*COLS+i)*3,     i10 = (j*COLS+i+1)*3;
      const i01 = ((j+1)*COLS+i)*3, i11 = ((j+1)*COLS+i+1)*3;

      // Triangle A: v00, v10, v11
      const ax=pos[i10]-pos[i00], ay=pos[i10+1]-pos[i00+1], az=pos[i10+2]-pos[i00+2];
      const bx=pos[i11]-pos[i00], by=pos[i11+1]-pos[i00+1], bz=pos[i11+2]-pos[i00+2];
      const nax=ay*bz-az*by, nay=az*bx-ax*bz, naz=ax*by-ay*bx;
      normals[i00]+=nax; normals[i00+1]+=nay; normals[i00+2]+=naz;
      normals[i10]+=nax; normals[i10+1]+=nay; normals[i10+2]+=naz;
      normals[i11]+=nax; normals[i11+1]+=nay; normals[i11+2]+=naz;

      // Triangle B: v00, v11, v01
      const cx=pos[i11]-pos[i00], cy=pos[i11+1]-pos[i00+1], cz=pos[i11+2]-pos[i00+2];
      const dx=pos[i01]-pos[i00], dy=pos[i01+1]-pos[i00+1], dz=pos[i01+2]-pos[i00+2];
      const nbx=cy*dz-cz*dy, nby=cz*dx-cx*dz, nbz=cx*dy-cy*dx;
      normals[i00]+=nbx; normals[i00+1]+=nby; normals[i00+2]+=nbz;
      normals[i11]+=nbx; normals[i11+1]+=nby; normals[i11+2]+=nbz;
      normals[i01]+=nbx; normals[i01+1]+=nby; normals[i01+2]+=nbz;
    }
  }
  for (let i = 0; i < N; i++) {
    const i3 = i*3;
    const len = Math.sqrt(normals[i3]*normals[i3] + normals[i3+1]*normals[i3+1] + normals[i3+2]*normals[i3+2]);
    if (len > 1e-8) { const inv=1/len; normals[i3]*=inv; normals[i3+1]*=inv; normals[i3+2]*=inv; }
  }
}

// ── PBD cloth step (2 substeps × 6 iterations, fixed dt = 1/60 s) ─────────────
function stepSim(sim: SimData, elapsedTime: number, camX: number, camZ: number): void {
  const { pos, vel, oldPos, pin, pinnedPos, cstA, cstB, cstR, nCst } = sim;
  const gravity = DBG_SILLAS.curtainGravity;
  const damping = DBG_SILLAS.curtainDamping;
  const windAmp = DBG_SILLAS.curtainWind;
  const windF   = windAmp * Math.sin(elapsedTime * 0.3) * (1 + 0.4 * Math.sin(elapsedTime * 1.7 + 0.9));

  for (let sub = 0; sub < SUBSTEPS; sub++) {
    const dt = SIM_DT;
    oldPos.set(pos);

    // Integrate: forces → velocity → position
    // Wind pushes curtain toward audience (−fwd direction)
    for (let i = 0; i < N; i++) {
      if (pin[i]) continue;
      const i3 = i * 3;
      vel[i3+1] += gravity * dt;
      vel[i3]   -= windF * sim.fwdX * dt;
      vel[i3+2] -= windF * sim.fwdZ * dt;
      vel[i3]   *= damping; vel[i3+1] *= damping; vel[i3+2] *= damping;
      pos[i3]   += vel[i3]   * dt;
      pos[i3+1] += vel[i3+1] * dt;
      pos[i3+2] += vel[i3+2] * dt;
    }

    // Iterative constraint + collision projection
    for (let iter = 0; iter < ITERS; iter++) {
      // Distance constraints
      for (let c = 0; c < nCst; c++) {
        const a=cstA[c], b=cstB[c], a3=a*3, b3=b*3;
        const dx=pos[b3]-pos[a3], dy=pos[b3+1]-pos[a3+1], dz=pos[b3+2]-pos[a3+2];
        const d2=dx*dx+dy*dy+dz*dz;
        if (d2 < 1e-8) continue;
        const d    = Math.sqrt(d2);
        const corr = (d - cstR[c]) / d;
        const aPin = pin[a], bPin = pin[b];
        if (!aPin && !bPin) {
          const half = corr * 0.5;
          pos[a3]  +=dx*half; pos[a3+1]+=dy*half; pos[a3+2]+=dz*half;
          pos[b3]  -=dx*half; pos[b3+1]-=dy*half; pos[b3+2]-=dz*half;
        } else if (!aPin) {
          pos[a3]  +=dx*corr; pos[a3+1]+=dy*corr; pos[a3+2]+=dz*corr;
        } else if (!bPin) {
          pos[b3]  -=dx*corr; pos[b3+1]-=dy*corr; pos[b3+2]-=dz*corr;
        }
      }

      // Floor
      for (let i = 0; i < N; i++) {
        if (pin[i]) continue;
        if (pos[i*3+1] < FLOOR_Y) pos[i*3+1] = FLOOR_Y;
      }

      // Capsule (player body): closest point on vertical segment (camX, 0..CAP_H, camZ)
      for (let i = 0; i < N; i++) {
        if (pin[i]) continue;
        const i3 = i*3;
        const px=pos[i3], py=pos[i3+1], pz=pos[i3+2];
        const cy=Math.max(0, Math.min(CAP_H, py));
        const dx=px-camX, dy2=py-cy, dz=pz-camZ;
        const d2=dx*dx+dy2*dy2+dz*dz;
        if (d2 < CAP_R*CAP_R && d2 > 1e-8) {
          const d=Math.sqrt(d2), push=(CAP_R-d)/d;
          pos[i3]  +=dx*push; pos[i3+1]+=dy2*push; pos[i3+2]+=dz*push;
        }
      }

      // Restore pinned (top row) — read from invariant pinnedPos
      for (let i = 0; i < COLS; i++) {
        const i3=i*3;
        pos[i3]=pinnedPos[i3]; pos[i3+1]=pinnedPos[i3+1]; pos[i3+2]=pinnedPos[i3+2];
      }
    }

    // Re-derive velocity from position change
    const invDt = 1 / dt;
    for (let i = 0; i < N; i++) {
      if (pin[i]) continue;
      const i3 = i*3;
      vel[i3]  =(pos[i3]  -oldPos[i3])  *invDt;
      vel[i3+1]=(pos[i3+1]-oldPos[i3+1])*invDt;
      vel[i3+2]=(pos[i3+2]-oldPos[i3+2])*invDt;
    }
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Curtain() {
  const { camera, scene } = useThree();
  // All mutable data in refs — exempt from react-hooks/immutability
  const meshRef  = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.SpotLight>(null);
  const simRef   = useRef<SimData | null>(null);
  const geoRef   = useRef<THREE.BufferGeometry | null>(null);

  // R1: Build simulation + geometry + spotlight imperatively from camera direction.
  // Combined into one effect so camera forward is read once and shared.
  useEffect(() => {
    // Compute forward direction from camera (horizontal projection)
    const fwdVec = new THREE.Vector3();
    camera.getWorldDirection(fwdVec);
    fwdVec.y = 0;
    const fwdLen = Math.sqrt(fwdVec.x * fwdVec.x + fwdVec.z * fwdVec.z);
    if (fwdLen > 1e-5) { fwdVec.x /= fwdLen; fwdVec.z /= fwdLen; }
    else               { fwdVec.x  = 0;       fwdVec.z  = -1; }

    const fwdX   = fwdVec.x;
    const fwdZ   = fwdVec.z;
    const rightX = -fwdZ;  // 90° CW in XZ plane
    const rightZ =  fwdX;

    const distM   = DBG_SILLAS.curtainDistM;
    const centerX = camera.position.x + fwdX * distM;
    const centerZ = camera.position.z + fwdZ * distM;

    const s = buildSim(
      DBG_SILLAS.curtainWidthM, DBG_SILLAS.curtainHeightM,
      centerX, centerZ, fwdX, fwdZ, rightX, rightZ,
    );
    recomputeNormals(s);

    const posAttr  = new THREE.BufferAttribute(s.pos,     3);
    const normAttr = new THREE.BufferAttribute(s.normals, 3);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    normAttr.setUsage(THREE.DynamicDrawUsage);
    s.posAttr  = posAttr;
    s.normAttr = normAttr;

    const uvArr = new Float32Array(N * 2);
    for (let j = 0; j < ROWS; j++)
      for (let i = 0; i < COLS; i++) {
        const k = j*COLS+i;
        uvArr[k*2]   = i / (COLS-1);
        uvArr[k*2+1] = 1 - j / (ROWS-1);
      }

    const idxArr = new Uint32Array((COLS-1)*(ROWS-1)*6);
    let ii = 0;
    for (let j = 0; j < ROWS-1; j++)
      for (let i = 0; i < COLS-1; i++) {
        const v00=j*COLS+i, v10=j*COLS+i+1, v01=(j+1)*COLS+i, v11=(j+1)*COLS+i+1;
        idxArr[ii++]=v00; idxArr[ii++]=v10; idxArr[ii++]=v11;
        idxArr[ii++]=v00; idxArr[ii++]=v11; idxArr[ii++]=v01;
      }

    const g = new THREE.BufferGeometry();
    g.setIndex(new THREE.BufferAttribute(idxArr, 1));
    g.setAttribute("position", posAttr);
    g.setAttribute("normal",   normAttr);
    g.setAttribute("uv",       new THREE.BufferAttribute(uvArr, 2));

    simRef.current = s;
    geoRef.current = g;
    if (meshRef.current) meshRef.current.geometry = g;

    // SpotLight: on player's side of curtain (-fwd), 9 m high, target at curtain center 4 m up
    const lightX = centerX - fwdX * 5;
    const lightZ = centerZ - fwdZ * 5;
    const target = new THREE.Object3D();
    target.position.set(centerX, 4, centerZ);
    scene.add(target);
    if (lightRef.current) {
      lightRef.current.position.set(lightX, 9, lightZ);
      lightRef.current.target = target;
    }

    return () => {
      g.dispose();
      simRef.current = null;
      geoRef.current = null;
      scene.remove(target);
    };
  }, [scene, camera]); // stable in R3F — runs once on mount

  useFrame(({ clock: cl }) => {
    const sim = simRef.current;
    if (!sim || !meshRef.current) return;

    // Attach geometry on first frame if useEffect ran after initial useFrame
    if (geoRef.current && meshRef.current.geometry !== geoRef.current) {
      meshRef.current.geometry = geoRef.current;
    }

    const camX = camera.position.x;
    const camZ = camera.position.z;

    stepSim(sim, cl.elapsedTime, camX, camZ);
    recomputeNormals(sim);
    sim.posAttr!.needsUpdate  = true;
    sim.normAttr!.needsUpdate = true;

    // Live spotlight updates
    if (lightRef.current) {
      lightRef.current.intensity = DBG_SILLAS.curtainLightIntensity;
      lightRef.current.color.set(DBG_SILLAS.curtainLightColor);
    }

    // Crossing detection: camera has moved 0.25 m past the curtain plane
    const camDot = camera.position.x * sim.fwdX + camera.position.z * sim.fwdZ;
    if (!sim.passed && camDot > sim.curtainPlaneD + 0.25) {
      sim.passed    = true;
      sim.fadingOut = true;
      sim.fadeStart = cl.elapsedTime;
      window.dispatchEvent(new CustomEvent("alight:curtain-passed"));
    }

    // Fade out after crossing
    if (sim.fadingOut) {
      const elapsed = cl.elapsedTime - sim.fadeStart;
      sim.opacity = Math.max(0, 1 - elapsed / FADE_OUT_S);
      const mat = meshRef.current.material as THREE.MeshPhysicalMaterial;
      mat.opacity = sim.opacity;
      if (sim.opacity <= 0 && sim.fadingOut) {
        sim.fadingOut = false; // prevent re-firing
        window.dispatchEvent(new CustomEvent("alight:curtain-done"));
      }
    }
  });

  return (
    <>
      {/* Mesh rendered always; geometry is wired imperatively in useEffect */}
      <mesh ref={meshRef}>
        <meshPhysicalMaterial
          color="#7a0d14"
          roughness={0.9}
          metalness={0}
          sheen={0.6}
          sheenColor={SHEEN_COL}
          sheenRoughness={0.7}
          side={THREE.DoubleSide}
          transparent
          opacity={1}
          depthWrite={false}
        />
      </mesh>
      {/* R1: position overridden imperatively in useEffect from camera direction */}
      <spotLight
        ref={lightRef}
        position={[0, 9, 0]}
        intensity={DBG_SILLAS.curtainLightIntensity}
        color={DBG_SILLAS.curtainLightColor}
        angle={0.6}
        penumbra={0.7}
        distance={30}
        decay={2}
        castShadow={false}
      />
    </>
  );
}
