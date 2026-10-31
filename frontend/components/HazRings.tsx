"use client";
// U6A: Concentric floor rings triggered by alight:haz-toggle.
// Pool of POOL_SIZE effect slots; each holds RING_COUNT_MAX ring meshes.
// Shared RingGeometry (immutable); per-ring MeshBasicMaterial for independent opacity.
// No per-frame allocations — all objects pre-created in useEffect.

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { DBG_SILLAS } from "@/lib/debugConfig";
import { getHazPositionsXZ } from "@/lib/haz";

const POOL_SIZE      = 4;
const RING_COUNT_MAX = 7;
const FLOOR_Y        = 0.008; // slightly above floor (floor symbols at 0.006)

const HAZ_COLOR_KEYS = [
  "hazColor0", "hazColor1", "hazColor2", "hazColor3",
] as const;

interface RingEffect {
  active:  boolean;
  startT:  number;
  bx:      number;
  bz:      number;
  cr:      number; cg: number; cb: number; // color components — avoids per-frame Color alloc
  meshes:  THREE.Mesh[];
  mats:    THREE.MeshBasicMaterial[];
}

export default function HazRings() {
  const { scene } = useThree();
  const poolRef   = useRef<RingEffect[]>([]);
  const nowRef    = useRef(0); // latest elapsedTime from useFrame

  useEffect(() => {
    // Thin ring in XY plane, rotated flat onto XZ.
    // inner=0.92, outer=1.0 → 8 % thick; scale by radius to place.
    const ringGeo = new THREE.RingGeometry(0.92, 1.0, 64);
    ringGeo.rotateX(-Math.PI / 2);

    const tmpColor = new THREE.Color();
    const pool: RingEffect[] = [];

    for (let e = 0; e < POOL_SIZE; e++) {
      const meshes: THREE.Mesh[]              = [];
      const mats:   THREE.MeshBasicMaterial[] = [];
      for (let r = 0; r < RING_COUNT_MAX; r++) {
        const mat = new THREE.MeshBasicMaterial({
          color:       new THREE.Color(1, 1, 1),
          transparent: true,
          opacity:     0,
          blending:    THREE.AdditiveBlending,
          depthWrite:  false,
          side:        THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(ringGeo, mat);
        mesh.renderOrder   = 8; // after panorama layers (rO 0-7), before floor symbols (rO 10)
        mesh.frustumCulled = false;
        mesh.visible       = false;
        scene.add(mesh);
        meshes.push(mesh);
        mats.push(mat);
      }
      pool.push({
        active: false, startT: 0,
        bx: 0, bz: 0,
        cr: 1, cg: 1, cb: 1,
        meshes, mats,
      });
    }
    poolRef.current = pool;

    const onToggle = (e: Event) => {
      const { index } = (e as CustomEvent).detail as { index: number; on: boolean };
      const positions  = getHazPositionsXZ();
      const [bx, bz]   = positions[index];

      // find a free slot; if all busy, reuse the oldest
      let slot = pool.find(s => !s.active);
      if (!slot) slot = pool.reduce((a, b) => (a.startT < b.startT ? a : b));

      tmpColor.set(DBG_SILLAS[HAZ_COLOR_KEYS[index]]);
      slot.active = true;
      slot.startT = nowRef.current;
      slot.bx     = bx;
      slot.bz     = bz;
      slot.cr     = tmpColor.r;
      slot.cg     = tmpColor.g;
      slot.cb     = tmpColor.b;
      for (const m of slot.meshes) m.visible = false;
    };

    window.addEventListener("alight:haz-toggle", onToggle);
    return () => {
      window.removeEventListener("alight:haz-toggle", onToggle);
      pool.forEach(s => s.meshes.forEach(m => scene.remove(m)));
      pool.forEach(s => s.mats.forEach(mat => mat.dispose()));
      ringGeo.dispose();
    };
  }, [scene]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    nowRef.current = t;
    const pool = poolRef.current;
    if (!pool.length) return;

    const ringCount = Math.min(RING_COUNT_MAX, Math.max(2, Math.round(DBG_SILLAS.u6RingCount)));
    const totalDur  = DBG_SILLAS.u6Duration;
    const seqDelay  = DBG_SILLAS.u6SeqDelay;
    const minR      = DBG_SILLAS.u6MinRadius;
    const maxR      = DBG_SILLAS.u6MaxRadius;
    const twinkFq   = DBG_SILLAS.u6TwinkleFq;
    const opScale   = DBG_SILLAS.u6Opacity;

    for (let e = 0; e < POOL_SIZE; e++) {
      const fx = pool[e];
      if (!fx.active) {
        for (let r = 0; r < RING_COUNT_MAX; r++) fx.meshes[r].visible = false;
        continue;
      }

      const elapsed = t - fx.startT;
      if (elapsed >= totalDur) {
        fx.active = false;
        for (let r = 0; r < RING_COUNT_MAX; r++) fx.meshes[r].visible = false;
        continue;
      }

      for (let r = 0; r < RING_COUNT_MAX; r++) {
        const mesh = fx.meshes[r];
        const mat  = fx.mats[r];

        if (r >= ringCount) { mesh.visible = false; continue; }

        const rStart = r * seqDelay;
        if (elapsed < rStart) { mesh.visible = false; continue; }

        const rElapsed  = elapsed - rStart;
        const rLifetime = totalDur - rStart;
        if (rLifetime <= 0) { mesh.visible = false; continue; }

        const p         = Math.min(1.0, rElapsed / rLifetime);
        const radius    = minR + p * (maxR - minR);
        // innermost ring (r=0) fully bright; outermost fades to 30 %
        const baseAlpha = ringCount > 1 ? 1.0 - (r / (ringCount - 1)) * 0.7 : 1.0;
        const twinkle   = 0.5 + 0.5 * Math.sin(elapsed * twinkFq + r * Math.PI);
        const fade      = 1.0 - p * p; // quad ease-out fade
        const opacity   = Math.max(0, baseAlpha * twinkle * fade * opScale);

        mesh.visible = true;
        mesh.position.set(fx.bx, FLOOR_Y, fx.bz);
        mesh.scale.setScalar(radius);
        mat.color.setRGB(fx.cr, fx.cg, fx.cb);
        mat.opacity = opacity;
      }
    }
  });

  return null;
}
