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
