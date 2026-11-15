// Z49: escala de la composición central del domo (portal circular, montañas ilustradas, sol ilustrado, nubes,
// olas, estratos, anillos, confeti y estrellas del portal). Todo el shader dibuja la composición en las
// coordenadas del portal p = (proyección gnomónica sobre uPortalF) / uPortalTan, así que escalar uPortalTan × S
// la agranda entera alrededor de su centro (sin muestras nuevas ni cambio de costo). Para que la BASE siga apoyada
// en la misma línea del horizonte, el punto de la imagen que hoy cae en el horizonte (p.y = −tan(e0)/tan(fov))
// debe seguir ahí: tan(e) = S · tan(e0)  →  e = atan(S · tan(e0)). Puro y sin imports (se prueba en Node).

export interface EscalaPortal { elev: number; tan: number }

/** elev0: elevación del centro del portal (rad); halfFovDeg: semi-FOV horizontal (°); s: escala. Escribe en out. */
export function escalaPortal(elev0: number, halfFovDeg: number, s: number, out: EscalaPortal): EscalaPortal {
  const S = Number.isFinite(s) && s > 0.05 ? s : 1;
  out.tan = Math.tan((halfFovDeg * Math.PI) / 180) * S;
  out.elev = Math.atan(S * Math.tan(elev0));
  return out;
}

/** Elevación (rad) en la imagen del portal para p.y (eje vertical del portal), centro en elev. */
export function elevacionDeP(py: number, elev: number, tan: number): number {
  return elev + Math.atan(py * tan);
}

/** Z50: PORTAL_C del shader (app/alight/dome/dome.frag.glsl, `const vec2 PORTAL_C`): centro del círculo del portal
 *  en coordenadas de la imagen. Copiado acá para JS; scripts/ciclo-dia-test.mjs verifica que coincida con el GLSL. */
export const PORTAL_C_SHADER: readonly [number, number] = [0.0461, -0.0609];
/** Z55: SUN_C del shader (`const vec2 SUN_C`): centro del sol ilustrado y de los discos crema y rojo; el pico de la
 *  montaña central cae sobre la misma vertical (medido en pantalla). NO coincide con PORTAL_C (círculo exterior y
 *  anillos): está 0,0379 más a la izquierda (≈ 1,9° con ESCALA 1,625). scripts/ciclo-dia-test.mjs lo verifica. */
export const SUN_C_SHADER: readonly [number, number] = [0.0082, -0.0822];

export interface CentroPortal { az: number; elev: number }

/** Z50: dirección del CENTRO DEL CÍRCULO del portal, igual que el shader:
 *  cDir = normalize(F + (R·PORTAL_C.x + U·PORTAL_C.y)·tan), con F, R, U como los arma DomeSky.tsx
 *  (F = (sin az·cos e, sin e, −cos az·cos e), R = (cos az, 0, sin az), U = R × F). Azimut en la convención del
 *  domo: az = atan(d.x, −d.z). Escribe en out (sin allocations). */
export function centroPortal(azF: number, elevF: number, tan: number, out: CentroPortal, centroX: number = PORTAL_C_SHADER[0]): CentroPortal {
  const ce = Math.cos(elevF), se = Math.sin(elevF);
  const fx = Math.sin(azF) * ce, fy = se, fz = -Math.cos(azF) * ce;
  const rx = Math.cos(azF), rz = Math.sin(azF);
  const ux = -rz * fy, uy = rz * fx - rx * fz, uz = rx * fy;   // R × F con R.y = 0
  const px = centroX * tan, py = PORTAL_C_SHADER[1] * tan;   // Z57: centroX = uPortalCx (PORTAL_C.x o SUN_C.x)
  const cx = fx + rx * px + ux * py, cy = fy + uy * py, cz = fz + rz * px + uz * py;
  const L = Math.hypot(cx, cy, cz) || 1;
  out.az = Math.atan2(cx / L, -cz / L);
  out.elev = Math.asin(cy / L);
  return out;
}
