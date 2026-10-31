// Retro palette constants — section 1.3 of the visual brief.
// Base is always warm-neutral; color lives in stripes and small accents.

export const RETRO = {
  // ── Base plastics ─────────────────────────────────────────────────────────
  BEIGE:    "#E8DCC4",  // aged cream plastic (base surface)
  WARM_GRY: "#CFC8BA",  // warm grey / dirty white (alternate base)
  RUST:     "#C0552F",  // utility housing / accent stripe
  CARBON:   "#3A3B3C",  // dark carbon grey housing
  CRT_BG:   "#12101A",  // CRT screen background (blue-black)

  // ── Stripe palette (spectrum order R→G→B) ─────────────────────────────────
  STRIPE_RED:    "#E5322B",
  STRIPE_ORANGE: "#F0742A",
  STRIPE_AMBER:  "#F4B62E",
  STRIPE_GREEN:  "#2E9E5B",
  STRIPE_BLUE:   "#1F7FB8",
  STRIPE_PINK:   "#F27FA5",

  // ── Neon (emissive) variants for bloom ────────────────────────────────────
  NEON_CYAN:   "#7FEFE6",
  NEON_GREEN:  "#34F28A",
  NEON_YELLOW: "#FFD21A",
  NEON_RED:    "#FF1A1A",

  // ── Phosphor (screen) ────────────────────────────────────────────────────
  PHOSPHOR_AMBER: "#FF9A1F",  // amber phosphor foreground
  PHOSPHOR_BG:    "#2A1400",  // dark brown CRT background
  PHOSPHOR_BLUE:  "#2B8CFF",  // blue phosphor variant

  // ── Silkscreen ink ────────────────────────────────────────────────────────
  INK_DARK:  "#1A1614",
  INK_LIGHT: "#F2EBDD",

  // ── Atmosphere / scene (R4) ───────────────────────────────────────────────
  SKY_ZENITH:  "#0a0812",  // dome sky zenith
  SKY_HORIZON: "#1b1426",  // dome sky horizon
  SKY_GLOW:    "#2A1400",  // warm glow band near horizon (15% opacity)
  FOG_COLOR:   "#0b0a14",  // FogExp2 color
  HEMI_SKY:    "#1a2330",  // HemisphereLight sky
  HEMI_GND:    "#0d0a12",  // HemisphereLight ground
  MAIN_LIGHT:  "#9fe6ff",  // main spotlight (cool, dim)
} as const;

export type RetroPaletteKey = keyof typeof RETRO;

// Default 5-stripe sequence (spectrum order, for createStripeMaterial)
export const DEFAULT_STRIPES: readonly string[] = [
  RETRO.STRIPE_RED,
  RETRO.STRIPE_ORANGE,
  RETRO.STRIPE_AMBER,
  RETRO.STRIPE_GREEN,
  RETRO.STRIPE_BLUE,
];

// Neon stripe sequence (for HazSystem cones + bloom)
export const NEON_STRIPES: readonly string[] = [
  RETRO.NEON_CYAN,
  RETRO.NEON_GREEN,
  RETRO.NEON_YELLOW,
  RETRO.NEON_RED,
];
