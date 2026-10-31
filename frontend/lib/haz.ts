// N3: Beam (haz) state management.
// R3: Toggle-switch semantics — entry flank toggles bandOn, exit has no effect.
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
const _inBeam:        boolean[] = [false, false, false, false];
const _enteredOnce:   boolean[] = [false, false, false, false];
// R3: toggle state + cooldown
const _bandOn:        boolean[] = [false, false, false, false];
const _lastToggleMs:  number[]  = [0, 0, 0, 0];

export function getHazEnteredOnce(i: number): boolean {
  return _enteredOnce[i] ?? false;
}

export function getHazBandOn(i: number): boolean {
  return _bandOn[i] ?? false;
}

// R3: set band state from debug menu — fires alight:haz-toggle so HazSystem reacts
export function setHazBandOn(symbolIdx: number, on: boolean): void {
  if (_bandOn[symbolIdx] === on) return;
  _bandOn[symbolIdx]       = on;
  _lastToggleMs[symbolIdx] = performance.now();
  window.dispatchEvent(new CustomEvent("alight:haz-toggle", { detail: { index: symbolIdx, on } }));
}

// R3: Updates hysteresis state. Entry flank toggles bandOn (with cooldown).
// Exit flank still fires alight:haz-exit for any consumers but does NOT change gate state.
export function updateHazState(px: number, pz: number): void {
  const positions    = getHazPositionsXZ();
  const enterR       = DBG_SILLAS.hazZoneRadiusM;
  const exitR        = enterR * 1.1;
  const cooldownMs   = DBG_SILLAS.hazToggleCooldownMs;
  const now          = performance.now();

  for (let i = 0; i < 4; i++) {
    const [bx, bz] = positions[i];
    const dx       = px - bx;
    const dz       = pz - bz;
    const dist     = Math.sqrt(dx * dx + dz * dz);

    if (!_inBeam[i] && dist <= enterR) {
      _inBeam[i]      = true;
      _enteredOnce[i] = true;
      // Toggle only if cooldown has passed
      if (now - _lastToggleMs[i] >= cooldownMs) {
        _lastToggleMs[i] = now;
        const newOn      = !_bandOn[i];
        _bandOn[i]       = newOn;
        window.dispatchEvent(new CustomEvent("alight:haz-toggle", { detail: { index: i, on: newOn } }));
        window.dispatchEvent(new CustomEvent("alight:haz-enter",  { detail: { index: i } }));
      }
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
