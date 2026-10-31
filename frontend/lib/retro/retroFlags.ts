// R4: Retro post-process feature flags — standalone module (no Three.js deps).
// Exported from here so ThreeScene / DebugMenu can import without pulling
// the full EffectComposer/ShaderPass bundle before the canvas is ready.
export const RETRO_FLAGS = {
  enabled:     true,   // RETRO_POSTFX_ENABLED
  quality:    "medium" as "low" | "medium" | "high",
  comfortMode: false,  // disables wobble + CA
};
