// H2: Shared sector geometry module.
// getSectorInfo is reused by FloorVisualizer (H2) and H3.
// Sectors are clockwise when viewed from above, starting from the quadrant
// to the right of the line pointing toward the chairs (−Z axis).

import { DBG_FLOOR } from "./debugConfig";

export interface SectorInfo {
  sector: number; // 0–3, or −1 if inside the inner radius
  r:      number; // distance from origin (m)
  t:      number; // normalised 0=inner edge, 1=outer edge
}

export function getSectorInfo(x: number, z: number): SectorInfo {
  const r = Math.sqrt(x * x + z * z);

  if (r < DBG_FLOOR.innerR) return { sector: -1, r, t: 0 };

  const t = Math.max(0, Math.min(1,
    (r - DBG_FLOOR.innerR) / (DBG_FLOOR.outerR - DBG_FLOOR.innerR),
  ));

  const rad  = -(DBG_FLOOR.rotationDeg * Math.PI) / 180;
  const cosR = Math.cos(rad);
  const sinR = Math.sin(rad);
  const rx   = x * cosR - z * sinR;
  const rz   = x * sinR + z * cosR;

  // Clockwise from above: S0=(+rx,−rz), S1=(+rx,+rz), S2=(−rx,+rz), S3=(−rx,−rz)
  let sector: number;
  if      (rx >= 0 && rz <  0) sector = 0;
  else if (rx >  0 && rz >= 0) sector = 1;
  else if (rx <= 0 && rz >  0) sector = 2;
  else                          sector = 3;

  return { sector, r, t };
}
