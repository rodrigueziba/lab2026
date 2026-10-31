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
  // N2: absolute radii (prismRangeScale multiplier removed)
  prismRangeScale: 1.0, // legacy N1 — no longer applied; kept for history
  nearM:       5.0,  // proximity effect starts (m)
  closeM:      3.33, // glow threshold (m)
  maxEffectM:  0.3,  // full effect at this distance (m) — unchanged
  translucentMs:      3000, // ms to ramp to translucent opacity
  translucentOpacity: 0.35, // glass opacity when player is near
  spinAccel:   8,    // spin multiplier at maxEffectM
};

// Pointer lock retry cooldown (ms) — browser blocks re-lock within ~1 s of exit
export const POINTERLOCK_RETRY_MS = 1300;

// S3: dome exterior visualizer (SILLAS path)
export const DBG_SILLAS = {
  prismInteractM:  5.0,   // horizontal distance (m) at which "Apretar E" prompt appears
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
  // N1: sillas sequence timing
  releaseDelayMs: 5000,  // ms after alight:dome-revealed before movement is freed (sala_activa)
  lockLook:       false, // N1: also lock mouse-look during sillas_secuencia (not yet implemented)
  // N3: beams (haces)
  hazRadiusM:       4.0,    // beam center distance from prism XZ origin (m)
  hazZoneRadiusM:   1.0,    // "under beam" trigger zone radius (m)
  hazSpotY:         22,     // spotlight height above floor (m)
  hazSpotIntensity: 80,     // Three.js SpotLight intensity
  hazConeOpacity:   0.12,   // visible cone mesh base opacity (additive)
  hazColor0:        '#ff2d95' as string, // S0 magenta
  hazColor1:        '#25e1ff' as string, // S1 cyan
  hazColor2:        '#ffb000' as string, // S2 amber
  hazColor3:        '#3dff8a' as string, // S3 green
  // N3: symbols
  symbolRadiusM:    1.0,    // floor symbol disc radius (m)
  symbolPeriodS:    2.5,    // animation cycle period (s)
  symbolLineWidthM: 0.04,   // trace thickness (m)
  // N3: sun
  sunIntensity:     0.35,   // base emissive brightness
  sunAngularDeg:    4.0,    // angular diameter (degrees)
  sunDriftEnabled:  false,  // slow azimuth drift (debug only)
  // N4: audio gates
  gateAttackMs:     300,    // gate open time constant (ms)
  gateReleaseMs:    600,    // gate close time constant (ms)
  showBandOverlay:  false,  // debug overlay: per-band energy + gate state
  // N5: monoliths + interference
  monolithDistM:       3.0,   // left/right monolith distance from tarima center (m)
  monolithFadeMs:   1500,    // monolith appear/disappear fade duration (ms)
  monolithProxFullM:   0.5,   // distance for full proximity effect (m)
  monolithProxStartM:  3.0,   // distance where proximity effect starts (m)
  noiseGain:           0.5,   // white noise max gain (right monolith proximity)
  staticMixMax:        0.35,  // max uStaticMix value on dome (left monolith proximity)
  watcherEyeEnabled:   true,  // N5: show watcher eye disc when watchers > 0
  // N6: red velvet curtain (reload to reposition; wind/gravity/damping/light are live)
  curtainDistM:          3.0,           // distance from player spawn to curtain plane (m)
  curtainWidthM:         14,            // curtain width (m)
  curtainHeightM:        8,             // height floor-to-pin (m)
  curtainGather:         0.85,          // horizontal gather ratio (< 1 = pleated)
  curtainWind:           0.6,           // wind amplitude (m/s²) — live
  curtainGravity:       -9.8,           // gravity Y (m/s²) — live
  curtainDamping:        0.985,         // velocity damping per substep — live
  curtainLightIntensity: 8000,          // SpotLight intensity — live
  curtainLightColor:     '#fff1dc' as string, // SpotLight color — live
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

// J1: timing constants (module-level so alightStore / Audience can import them)
export const PEOPLE_MIN_DELAY_MS      = 5_000;  // min ms from stars-visible to people-visible
export const LECTERNS_AFTER_PEOPLE_MS = 10_000; // ms from people-visible to lecterns request
export const LECTERN_OUTWARD_OFFSET_M = 0.30;   // extra outward offset added to LECTERN_X

// J4: TARIMA audio-effect tuning constants (exposed in debug menu)
export const DBG_AUDIO = {
  // Phaser
  phaserBaseFreq: 1000, // allpass center frequency (Hz) — reload to apply
  phaserQ:        10,   // allpass Q — reload to apply
  // Pitch shifter
  grainDurMs:     80,   // granular grain duration (ms) — reload to apply
  // Lights
  lightStep:      0.1,  // LUZ+/LUZ- intensity step
  lightMin:       0.2,  // minimum globalIntensity
  lightMax:       3.0,  // maximum globalIntensity
  lightHoldMs:    120,  // hold-repeat interval (ms) — reload to apply
  maxExtraLights: 12,   // cap on random extra lights from LUZ*
};

// K1: per-side lectern camera debug overrides (TARIMA path)
// Set override: true to bypass fitLecternCamera and use the manual values below.
// Apply by re-entering the lectern (press Q then E).
export const DBG_CAM_IMAGE = {
  override: false,
  fov:     75,
  height:  0.90,
  dist:    0.75,
  pitch:  -22,
};

export const DBG_CAM_SOUND = {
  override: false,
  fov:     60,
  height:  0.80,
  dist:    0.80,
  pitch:  -45,
};

export const DBG_LECTERNS = {
  delayMs:          10_000, // legacy — no longer used for trigger (kept for reference)
  lightIntensity:   120,    // SpotLight per lectern (W-equivalent)
  emissiveBrightness: 0.7,  // emissiveIntensity for active buttons/knobs
  panelW:           1.50,   // J2: inner black panel width (m) — geometry reload needed
  panelD:           0.75,   // top plate depth  (m) — geometry reload needed
  yawOffsetDeg:     0,      // I1: fine-tune offset (deg) added to atan2 formula — geometry reload needed
  yawFlipLeft:      false,  // I1: debug toggle — invert left lectern 180°
  yawFlipRight:     false,  // I1: debug toggle — invert right lectern 180°
  // J1: per-side camera (re-enter mode to apply)
  camFov:           55,     // horizontal FOV (deg) — shared
  camPitchLeft:    -12,     // image lectern camera pitch (deg, negative = down)
  camPitchRight:   -25,     // sound lectern camera pitch (deg, negative = down)
  camHeightLeft:    0.45,   // image lectern camera height above plate centre (m)
  camHeightRight:   0.55,   // sound lectern camera height above plate centre (m)
  showGizmo:        false,  // J1: show I1 debug arrow gizmo
  showSections:     false,  // J3: overlay section frames + cell grid in dev mode
  knobSens:         2.5,    // knob full-range sweep as fraction of screen diagonal
  debugOverlays:    false,  // L5: show lectern status line — off by default
};

// ── J5: retro skin (cassette futurism) for TARIMA lecterns ───────────────────
export const DBG_RETRO = {
  lecterns:  true,   // J5: beige/carbón + desgaste — live (rótulos/teclas: reload)
  wear:      0.55,   // J5: edge wear + chipped paint amount (0–1) — live
  wearScale: 6,      // J5: wear noise frequency (1/m) — live
  grime:     0.35,   // J5: dirt in noise valleys (0–1) — live
  crtCurve:  0.08,   // J5: indicator CRT barrel distortion — live
  crtScan:   0.30,   // J5: indicator CRT scanline intensity — live
};
