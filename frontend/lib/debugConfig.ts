// C9: Debug configuration — module-level objects mutated by DebugMenu at runtime.
// Components read from these in useFrame for live shader updates.
// Note: geometry/spotlight changes are marked as requiring scene reload.

export const DEBUG_ENABLED = true; // set to false before production build

// ── SILLAS path ───────────────────────────────────────────────────────────────
export const DBG_SPOTLIGHT = {
  color:       "#fff5dc" as string,
  intensity:   3500,
  distance:    55,
  angle:       0.3,
  penumbra:    0.4,
  attenuation: 6,
  anglePower:  5,
};

export const DBG_PRISM = {
  landOffset:  0.09, // C3 hover gap (read-only, changes require code edit + reload)
  // S1
  spinDir:     -1,   // -1 = inverted (CCW from above)
  // S2 / H1.3: PRISM_RANGE_SCALE = 1.5 × original (nearM 1.5→2.25, closeM 1.0→1.5)
  prismRangeScale: 1.5, // H1: multiplier applied to nearM and closeM at startup
  nearM:       2.25, // proximity effect starts (m)  was 1.5
  closeM:      1.5,  // glow threshold (m)            was 1.0
  maxEffectM:  0.3,  // full effect at this distance (m) — unchanged
  translucentMs:      3000, // ms to ramp to translucent opacity
  translucentOpacity: 0.35, // glass opacity when player is near
  spinAccel:   8,    // spin multiplier at maxEffectM
};

// Pointer lock retry cooldown (ms) — browser blocks re-lock within ~1 s of exit
export const POINTERLOCK_RETRY_MS = 1300;

// S3: dome exterior visualizer (SILLAS path)
export const DBG_SILLAS = {
  prismInteractM:  1.5,   // horizontal distance (m) at which "Tocar E" prompt appears
  prismTouchM:     0.75,  // horizontal distance (m) at which touching auto-activates
  touchEpsM:       0.05,  // legacy surface threshold (kept for compat) — use prismTouchM
  vizTrackUrl:      '/music.mp3' as string, // G2: default track (same as /login)
  vizVolume:        1,    // G2: audio volume (0–1), live
  domeShellOpacity: 0,    // G1: shell fades to 0 (transparent) when visualizer active
  // F2/G1: exterior sky sphere
  vizTexSize:      2048,  // WebGLRenderTarget pixel size (reload to change)
  vizSphereScale:  1.15,  // exterior sphere radius = DOME_R × scale (live)
  vizThetaMax:     100,   // degrees from zenith to texture edge (live)
  vizFadeMs:       1500,  // fade-in + scale animation duration in ms (live)
  vizAngle:        0,     // G1 fix: 0 puts equator (most content) at texture center / zenith
  // G1 debug
  vizTestPattern:  false, // show θ/φ test grid instead of login shader
  vizSolidTest:    false, // Prueba A: solid magenta + depthTest=false + DoubleSide + renderOrder=10
  vizHideShell:    false, // force-hide dome shell (debug)
  // visualizer shader params (live)
  vizIntensity:    1.2,
  vizGhost:        1.0,
  vizMatrix:       0.25,
  vizRings:        1.0,
  vizSpeed:        0.65,
  vizAudioReact:   1.0,
  vizTopColor:     "#0a198c" as string,
  vizBottomColor:  "#11133b" as string,
};

// ── Sector audio effects (SILLAS path, H3) ────────────────────────────────────
export const DBG_EFFECTS = {
  lpEnd:       300,   // sector 0 (LP): cutoff at t=1 (Hz)
  hpEnd:       3000,  // sector 1 (HP): cutoff at t=1 (Hz)
  rateEnd:     1.75,  // sector 2: playback rate at t=1
  echoFbEnd:   0.55,  // sector 3: echo feedback at t=1
  echoMixEnd:  0.70,  // sector 3: echo wet mix at t=1
  reverbMixEnd:0.70,  // sector 3: reverb wet mix at t=1
  simEnabled:  false, // debug: simulate player position
  simSector:   -1,    // simulated sector (-1 to 3)
  simT:        0,     // simulated t (0–1)
};

// ── Floor visualizer (SILLAS path, H2) ────────────────────────────────────────
// DOME_R = 28; tarima half-diagonal ≈ 2.257 m → innerR = 2.257 + 0.3 = 2.56 m
export const DBG_FLOOR = {
  innerR:      2.6,        // mask radius around tarima (m)
  outerR:      27.5,       // disk outer radius = DOME_R - 0.5 (m)
  rotationDeg: 0,          // rotation of sector dividers (deg, CW from above)
  opacity:     0.85,
  baseSpeed:   1.0,        // FLOOR_BASE_SPEED
  speedGain:   5.0,        // FLOOR_SPEED_GAIN
  speedExp:    1.2,        // FLOOR_SPEED_EXP
  speedMode:   "spatial"  as "spatial" | "user",
  typeMinS:    4,          // min seconds between auto type change
  typeMaxS:    12,
  // -1 = auto; 0-3 = forced type for that sector
  s0Type:      -1,
  s1Type:      -1,
  s2Type:      -1,
  s3Type:      -1,
};

// ── TARIMA path ───────────────────────────────────────────────────────────────
export const DBG_STARS = {
  twinkleSpeed:  1.0,   // live: writes to DBG_STAR_MAT.value.uniforms.uTwinkleSpeed
  fadeDurMs:     3000,  // info only
  count:         2000,  // info only
  sizeMin:       0.07,  // info only
  sizeMax:       0.42,  // info only
  brightnessMin: 0.35,  // info only
  brightnessMax: 1.0,   // info only
};

export const DBG_DOME = {
  delayMs:          15_000, // ms before face dome appears (info only)
  glitchIntervalMs: 5_000,  // ms between effect rotation (info only)
};

export const DBG_FACE = {
  captureMs:        8_000, // T1: ms to scan for best frame before fallback
  qualityThreshold: 0.15,  // T1: score ≥ this → capture immediately
};

export const DBG_LECTERNS = {
  delayMs:          10_000, // T3: ms after dome-visible before lecterns appear
  lightIntensity:   120,    // SpotLight per lectern (W-equivalent)
  emissiveBrightness: 0.7,  // emissiveIntensity for active buttons/knobs
  panelW:           1.20,   // top plate width  (m) — geometry reload needed
  panelD:           0.70,   // top plate depth  (m) — geometry reload needed
  yawOffsetDeg:     15,     // E1: additional inward yaw beyond 90° base — geometry reload needed
  // E3: lectern camera (re-enter mode to apply)
  camFov:           55,     // horizontal FOV (deg)
  camHeight:        1.15,   // camera height above plate centre (m)
  camLookUpM:       0.35,   // look-at offset above plate centre (m), for dome framing
  knobSens:         2.5,    // knob full-range sweep as fraction of screen diagonal
};
