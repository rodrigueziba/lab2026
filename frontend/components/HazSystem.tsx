"use client";
// N3: Four spotlight beams + visible additive cones, one per sector diagonal.
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

export default function HazSystem() {
  const { scene }    = useThree();
  const lightsRef    = useRef<THREE.SpotLight[]>([]);
  const conesRef     = useRef<THREE.Mesh[]>([]);
  // Pre-allocated Color objects — reused each frame (no per-frame allocs)
  const colorObjs    = useRef(INITIAL_COLORS.map(c => new THREE.Color(c)));

  // N4: start audio + open/close gates on beam events
  useEffect(() => {
    const onEnter = (e: Event) => {
      const { index } = (e as CustomEvent).detail as { index: number };
      if (!isPlaying()) {
        void startVizAudio().then(result => {
          if (result === "need-gesture") {
            window.dispatchEvent(new CustomEvent("alight:audio-need-gesture", { detail: { need: true } }));
          }
        });
      }
      openGate(index);
    };
    const onExit = (e: Event) => {
      const { index } = (e as CustomEvent).detail as { index: number };
      closeGate(index);
    };
    window.addEventListener("alight:haz-enter", onEnter);
    window.addEventListener("alight:haz-exit",  onExit);
    return () => {
      window.removeEventListener("alight:haz-enter", onEnter);
      window.removeEventListener("alight:haz-exit",  onExit);
      for (let i = 0; i < 4; i++) closeGate(i);
    };
  }, []);

  useEffect(() => {
    const spotH  = DBG_SILLAS.hazSpotY;
    const coneR  = spotH * Math.tan(Math.PI / 10); // ~18.4° half-angle
    const coneGeo = new THREE.CylinderGeometry(0.01, coneR, spotH, 24, 1, true);

    const lights: THREE.SpotLight[] = [];
    const cones:  THREE.Mesh[]      = [];

    for (let i = 0; i < 4; i++) {
      const light = new THREE.SpotLight(undefined, DBG_SILLAS.hazSpotIntensity);
      light.angle      = Math.PI / 10;
      light.penumbra   = 0.4;
      light.castShadow = false;
      scene.add(light);
      scene.add(light.target);
      lights.push(light);

      const mat = new THREE.MeshBasicMaterial({
        color:      new THREE.Color(),
        transparent: true,
        opacity:    DBG_SILLAS.hazConeOpacity,
        blending:   THREE.AdditiveBlending,
        depthWrite: false,
        side:       THREE.DoubleSide,
      });
      const cone = new THREE.Mesh(coneGeo, mat);
      scene.add(cone);
      cones.push(cone);
    }

    lightsRef.current = lights;
    conesRef.current  = cones;

    return () => {
      lights.forEach(l => { scene.remove(l); scene.remove(l.target); });
      cones.forEach(c => {
        scene.remove(c);
        (c.material as THREE.Material).dispose();
      });
      coneGeo.dispose();
    };
  }, [scene]);

  useFrame(({ camera }) => {
    getHazUnderUser(camera.position.x, camera.position.z);

    const positions = getHazPositionsXZ();
    const lights    = lightsRef.current;
    const cones     = conesRef.current;
    if (!lights.length) return;

    for (let i = 0; i < 4; i++) {
      const [bx, bz] = positions[i];
      const col = colorObjs.current[i];
      col.set(DBG_SILLAS[COLOR_KEYS[i]]);

      const light = lights[i];
      light.position.set(bx, DBG_SILLAS.hazSpotY, bz);
      light.intensity = DBG_SILLAS.hazSpotIntensity;
      light.color.copy(col);
      light.target.position.set(bx, 0, bz);
      light.target.updateMatrixWorld();

      const cone = cones[i];
      cone.position.set(bx, DBG_SILLAS.hazSpotY / 2, bz);
      (cone.material as THREE.MeshBasicMaterial).color.copy(col);
      (cone.material as THREE.MeshBasicMaterial).opacity = DBG_SILLAS.hazConeOpacity;
    }
  });

  return null;
}
