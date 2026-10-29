import * as THREE from "three";
import { DBG_RETRO } from "@/lib/debugConfig";
import { injectWear, RETRO_WEAR, type WearOptions } from "./wear";
import { RETRO_CRT } from "./crtScreen";

// J5: retro reskin for the TARIMA lecterns. The materials stay owned by
// LecternSystem.tsx; this module mutates them in place (beige/carbón, matte,
// worn) and can restore the originals for A/B comparison.

type MatKey =
  | "legs" | "frame" | "panel" | "cpanel" | "strip" | "track" | "thumb"
  | "knob" | "knobAccent" | "pushbtn" | "rockerA" | "rockerB" | "rockerBase" | "silk";

interface Look {
  color: string;
  roughness: number;
  metalness: number;
  emissive?: string;
  emissiveIntensity?: number;
}

const RETRO_LOOK: Record<MatKey, Look & { wear: WearOptions }> = {
  legs:       { color: "#3A3B3C", roughness: 0.85, metalness: 0, wear: { under: "#7A7C7E" } },
  frame:      { color: "#E8DCC4", roughness: 0.80, metalness: 0, wear: { under: "#6B6E70" } },
  panel:      { color: "#3A3B3C", roughness: 0.90, metalness: 0, wear: { under: "#5A5C5E", grimeScale: 0 } },
  cpanel:     { color: "#2B2C2D", roughness: 0.92, metalness: 0, wear: { under: "#4A4B4D", grimeScale: 0 } },
  strip:      { color: "#C0552F", roughness: 0.75, metalness: 0, wear: { under: "#6B6E70" } },
  track:      { color: "#12101A", roughness: 0.95, metalness: 0, wear: {} },
  thumb:      { color: "#C0552F", roughness: 0.70, metalness: 0, wear: { under: "#E8DCC4", fingerWear: 0.4 } },
  knob:       { color: "#1A1614", roughness: 0.80, metalness: 0, wear: { under: "#4A4B4D" } },
  knobAccent: { color: "#F4B62E", roughness: 0.70, metalness: 0, wear: { under: "#8A7A5A" } },
  pushbtn:    { color: "#E8DCC4", roughness: 0.75, metalness: 0, wear: { under: "#CFC8BA", fingerWear: 0.6 } },
  rockerA:    { color: "#F0742A", roughness: 0.70, metalness: 0, wear: { under: "#E8DCC4", fingerWear: 0.4 } },
  rockerB:    { color: "#1F7FB8", roughness: 0.70, metalness: 0, wear: { under: "#E8DCC4", fingerWear: 0.4 } },
  rockerBase: { color: "#12101A", roughness: 0.90, metalness: 0, wear: {} },
  silk:       { color: "#F2EBDD", roughness: 0.90, metalness: 0, emissive: "#F2EBDD", emissiveIntensity: 0.08, wear: {} },
};

const _mats = new Map<MatKey, THREE.MeshStandardMaterial>();
const _orig = new Map<MatKey, Look & { envMapIntensity: number }>();

/** J5: register LecternSystem's shared materials (call once at module load). */
export function registerLecternMats(mats: Record<MatKey, THREE.MeshStandardMaterial>): void {
  (Object.keys(mats) as MatKey[]).forEach(k => {
    const m = mats[k];
    _mats.set(k, m);
    _orig.set(k, {
      color: `#${m.color.getHexString()}`, roughness: m.roughness, metalness: m.metalness,
      emissive: `#${m.emissive.getHexString()}`, emissiveIntensity: m.emissiveIntensity,
      envMapIntensity: m.envMapIntensity,
    });
    injectWear(m, RETRO_LOOK[k].wear);
  });
  setLecternRetro(DBG_RETRO.lecterns);
}

/** J5: switch the lectern look live (no shader recompile). */
export function setLecternRetro(on: boolean): void {
  DBG_RETRO.lecterns = on;
  _mats.forEach((m, k) => {
    const look = on ? RETRO_LOOK[k] : _orig.get(k)!;
    m.color.set(look.color);
    m.roughness = look.roughness;
    m.metalness = look.metalness;
    if (look.emissive !== undefined) m.emissive.set(look.emissive);
    if (look.emissiveIntensity !== undefined) m.emissiveIntensity = look.emissiveIntensity;
    m.envMapIntensity = on ? 0 : _orig.get(k)!.envMapIntensity;
  });
  syncRetroUniforms();
}

/** J5: copy DBG_RETRO tunables into the shared shader uniforms. */
export function syncRetroUniforms(): void {
  RETRO_WEAR.uWearAmt.value   = DBG_RETRO.lecterns ? DBG_RETRO.wear : 0;
  RETRO_WEAR.uWearScale.value = DBG_RETRO.wearScale;
  RETRO_WEAR.uGrime.value     = DBG_RETRO.grime;
  RETRO_CRT.uCurve.value      = DBG_RETRO.crtCurve;
  RETRO_CRT.uScan.value       = DBG_RETRO.crtScan;
}

/** J5: ink/background colours for the lectern canvas textures (read at creation — reload to apply). */
export function lecternPalette() {
  return DBG_RETRO.lecterns
    ? {
        label: "#F2EBDD", zoneTitle: "rgba(242,235,221,0.8)", tracking: 2,
        keyBg: "#E8DCC4", keyInk: "#1A1614",
        indBg: "#2A1400", indFg: "#FF9A1F",
        ledToggle: "#FF9A1F", ledButton: "#E5322B",
      }
    : {
        label: "#f1efe6", zoneTitle: "rgba(241,239,230,0.75)", tracking: 0,
        keyBg: "#e8e2cf", keyInk: "#0a0a0a",
        indBg: "#001530", indFg: "#00ccff",
        ledToggle: "#ff6600", ledButton: "#ff2200",
      };
}
