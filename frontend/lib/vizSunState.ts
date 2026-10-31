// U1: Session-stable random sun position for the panoramic sky.
// Both DomeVisualizer (GLSL sun dir) and VizPanorama (sprite position) import from here.
export const VIZ_SUN_AZ_DEG: number = Math.random() * 360;
export const VIZ_SUN_EL_DEG: number = 8 + Math.random() * 12; // U1: 8°–20°
