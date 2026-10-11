"use client";
// H3: Per-sector audio effects. Mounted only while the visualizer is active.
//
// Sector 0 → low-pass  (20 000 → lpEnd Hz, exponential by t)
// Sector 1 → high-pass (20 → hpEnd Hz, exponential by t)
// Sector 2 → playback rate (1.0 → rateEnd, linear by t)
// Sector 3 → echo + reverb (mix 0 → echoMixEnd, feedback 0 → echoFbEnd; reverb 0 → reverbMixEnd, linear)
//
// Only one sector's effect departs from neutral at a time.
// Cross-sector transitions smooth with tau ≈ 0.08 s (handled in applyEffects).

import { useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { DBG_EFFECTS } from "@/lib/debugConfig";
import { getSectorInfo } from "@/lib/floorSectors";
import { applyEffects, resetEffects, VIZ_EFFECTS_DEBUG } from "@/lib/vizAudio";

export default function SectorAudioFX() {
  const { camera } = useThree();

  // Return all effects to neutral when the visualizer is deactivated
  useEffect(() => () => { resetEffects(); }, []);

  useFrame((_, dt) => {
    // Resolve sector + t from player position or debug simulation
    const pos = DBG_EFFECTS.simEnabled
      ? getSectorInfo(
          // synthetic XZ position that yields the simulated sector and t
          // We pass a direction vector scaled by the right radius instead of using
          // getSectorInfo's internal formula — easier to just override the result:
          0, 0, // placeholder; overridden below
        )
      : getSectorInfo(camera.position.x, camera.position.z);

    const { sector, t } = DBG_EFFECTS.simEnabled
      ? { sector: DBG_EFFECTS.simSector, t: Math.max(0, Math.min(1, DBG_EFFECTS.simT)) }
      : pos;

    // Compute targets — only the active sector departs from neutral
    let lpTgt = 20000, hpTgt = 20, rateTgt = 1.0;
    let echoFbTgt = 0, echoMxTgt = 0, revMxTgt = 0;

    if (sector === 0) {
      // Exponential sweep: v = v0 * (v1/v0)^t
      lpTgt = 20000 * Math.pow(Math.max(1e-4, DBG_EFFECTS.lpEnd / 20000), t);
    } else if (sector === 1) {
      hpTgt = 20 * Math.pow(Math.max(1e-4, DBG_EFFECTS.hpEnd / 20), t);
    } else if (sector === 2) {
      rateTgt = 1.0 + (DBG_EFFECTS.rateEnd - 1.0) * t;
    } else if (sector === 3) {
      echoFbTgt = DBG_EFFECTS.echoFbEnd  * t;
      echoMxTgt = DBG_EFFECTS.echoMixEnd * t;
      revMxTgt  = DBG_EFFECTS.reverbMixEnd * t;
    }

    // Update debug state (read by EffectsDebugOverlay)
    VIZ_EFFECTS_DEBUG.sector = sector;
    VIZ_EFFECTS_DEBUG.t      = t;

    applyEffects(lpTgt, hpTgt, rateTgt, echoFbTgt, echoMxTgt, revMxTgt, dt);
  });

  return null;
}
