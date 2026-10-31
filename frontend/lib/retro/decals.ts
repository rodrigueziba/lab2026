// Decal system (brief 2.5) — re-exports from brandDecal.ts for unified import path.
// Use createDecalTexture / createStripeStripTexture for canvas-based decals.
// For three.js DecalGeometry, import from 'three/addons/utils/DecalGeometry.js'.

export {
  type Brand,
  LECTERN_BRANDS,
  EQUIPMENT_BRANDS,
  createDecalTexture,
  createStripeStripTexture,
  createBasePlateTex,
  createWornPaintTex,
  createStripeBandTex,
} from "./brandDecal";
