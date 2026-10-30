// N3: Beam (haz) state management.
// Tracks which of 4 beams the player is under (one per sector diagonal).
// Hysteresis: enter ≤ hazZoneRadiusM, exit > hazZoneRadiusM × 1.1.
// Positions are derived from DBG_FLOOR.rotationDeg + DBG_SILLAS.hazRadiusM at call time
// so they track live debug changes without re-mounting.

import { DBG_FLOOR, DBG_SILLAS } from "./debugConfig";

// Sector diagonal base angles in world frame (before rotation):
// S0: −π/4, S1: π/4, S2: 3π/4, S3: −3π/4
const SECTOR_BASE_ANGLES: readonly number[] = [
  -Math.PI / 4,
   Math.PI / 4,
  (3 * Math.PI) / 4,
  -(3 * Math.PI) / 4,
];

// Returns the XZ beam centres for the current debug rotation + radius.
export function getHazPositionsXZ(): readonly [number, number][] {
  const rotRad = (DBG_FLOOR.rotationDeg * Math.PI) / 180;
  return SECTOR_BASE_ANGLES.map(base => {
    const a = base + rotRad;
    return [
      DBG_SILLAS.hazRadiusM * Math.cos(a),
      DBG_SILLAS.hazRadiusM * Math.sin(a),
    ] as [number, number];
  });
}

// Module-level state — no React, polled from useFrame
const _inBeam:      boolean[] = [false, false, false, false];
const _enteredOnce: boolean[] = [false, false, false, false];

export function getHazEnteredOnce(i: number): boolean {
  return _enteredOnce[i] ?? false;
}

// Updates hysteresis state and fires alight:haz-enter / alight:haz-exit events.
export function updateHazState(px: number, pz: number): void {
  const positions = getHazPositionsXZ();
  const enterR    = DBG_SILLAS.hazZoneRadiusM;
  const exitR     = enterR * 1.1;

  for (let i = 0; i < 4; i++) {
    const [bx, bz] = positions[i];
    const dx       = px - bx;
    const dz       = pz - bz;
    const dist     = Math.sqrt(dx * dx + dz * dz);

    if (!_inBeam[i] && dist <= enterR) {
      _inBeam[i]      = true;
      _enteredOnce[i] = true;
      window.dispatchEvent(new CustomEvent("alight:haz-enter", { detail: { index: i } }));
    } else if (_inBeam[i] && dist > exitR) {
      _inBeam[i] = false;
      window.dispatchEvent(new CustomEvent("alight:haz-exit", { detail: { index: i } }));
    }
  }
}

// Returns 0–3 if under a beam, −1 otherwise. Also updates state and fires events.
export function getHazUnderUser(px: number, pz: number): number {
  updateHazState(px, pz);
  return _inBeam.findIndex(v => v);
}
