"use client";
// Z55: overlay de depuración del eje de la composición (oculto por defecto: DBG_PORTAL.OVERLAY_EJE).
// Dibuja en pantalla, sobre el canvas: la RECTA VERTICAL de la composición por el centro elegido en
// DBG_DIA.SOL_EJE_CENTRO (gran círculo PORTAL_GEOM.ejeP / ejeU), una cruz en ese centro y un anillo en la posición del sol del ciclo (DIA.solDir). Escribe los píxeles en EJE_PANT
// (window.__eje con el menú debug habilitado) para medir la diferencia horizontal sol ↔ eje a la altura del sol.
// Es HTML encima del canvas a propósito: es una marca de medición, no parte del mundo (no pasa por el CRT).
// Con el overlay apagado no hace nada por frame; encendido actualiza atributos de un SVG (solo depuración).

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { DBG_PORTAL, DEBUG_ENABLED } from "@/lib/debugConfig";
import { DIA, PORTAL_GEOM, solSobreEje } from "@/lib/cicloDia";

/** Píxeles (CSS, origen arriba a la izquierda del canvas) de las marcas; NaN si no están delante de la cámara. */
export const EJE_PANT = { solX: NaN, solY: NaN, ejeX: NaN, ejeY: NaN, centroX: NaN, centroY: NaN, difPx: NaN, difDeg: NaN, w: 0, h: 0 };

const N_EJE = 13;
const SVGNS = "http://www.w3.org/2000/svg";

export default function EjeOverlay() {
  const { camera, gl } = useThree();
  const els = useRef<{ root: SVGSVGElement; linea: SVGPolylineElement; cruz: SVGPathElement; sol: SVGCircleElement; ejeSol: SVGPathElement } | null>(null);
  const tmp = useRef({ v: new THREE.Vector3(), d: [0, 0, 0], pts: new Float32Array(N_EJE * 2) });

  useEffect(() => {
    const parent = gl.domElement.parentElement;
    if (!parent) return;
    const root = document.createElementNS(SVGNS, "svg");
    root.setAttribute("data-debug-panel", "eje");
    Object.assign(root.style, { position: "absolute", left: "0", top: "0", width: "100%", height: "100%", pointerEvents: "none", zIndex: "40", display: "none" });
    const mk = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string>): SVGElementTagNameMap[K] => {
      const e = document.createElementNS(SVGNS, tag) as SVGElementTagNameMap[K];
      for (const k in attrs) e.setAttribute(k, attrs[k]);
      root.appendChild(e);
      return e;
    };
    const linea = mk("polyline", { fill: "none", stroke: "#00FFFF", "stroke-width": "1", "stroke-dasharray": "4 3" });
    const cruz = mk("path", { stroke: "#00FFFF", "stroke-width": "1.5", fill: "none" });
    const ejeSol = mk("path", { stroke: "#FF00FF", "stroke-width": "1", fill: "none" });
    const sol = mk("circle", { r: "6", stroke: "#FF00FF", "stroke-width": "1.5", fill: "none" });
    parent.appendChild(root);
    els.current = { root, linea, cruz, sol, ejeSol };
    const w = window as unknown as { __eje?: object };
    if (DEBUG_ENABLED) w.__eje = EJE_PANT;
    return () => { root.remove(); els.current = null; if (DEBUG_ENABLED) delete w.__eje; };
  }, [gl]);

  useFrame(() => {
    const e = els.current;
    if (!e) return;
    const on = DBG_PORTAL.OVERLAY_EJE && Number.isFinite(PORTAL_GEOM.ejeP[0]);
    e.root.style.display = on ? "block" : "none";
    if (!on) return;
    const { v, d, pts } = tmp.current;
    const W = gl.domElement.clientWidth, H = gl.domElement.clientHeight;
    EJE_PANT.w = W; EJE_PANT.h = H;
    // proyecta una dirección (desde la cámara) a píxeles; false si queda detrás
    const proyectar = (dx: number, dy: number, dz: number): boolean => {
      v.set(dx, dy, dz).multiplyScalar(50).add(camera.position).project(camera);
      if (v.z > 1) return false;
      v.x = (v.x + 1) * 0.5 * W; v.y = (1 - v.y) * 0.5 * H;
      return true;
    };
    const P = PORTAL_GEOM.ejeP, U = PORTAL_GEOM.ejeU;
    // recta del eje: altura −10° … 80° sobre el gran círculo
    let n = 0;
    for (let i = 0; i < N_EJE; i++) {
      solSobreEje(P, U, ((-10 + (90 * i) / (N_EJE - 1)) * Math.PI) / 180, d);
      if (proyectar(d[0], d[1], d[2])) { pts[n * 2] = v.x; pts[n * 2 + 1] = v.y; n++; }
    }
    let s = "";
    for (let i = 0; i < n; i++) s += `${pts[i * 2].toFixed(1)},${pts[i * 2 + 1].toFixed(1)} `;
    e.linea.setAttribute("points", s);
    // cruz en el centro elegido (DBG_DIA.SOL_EJE_CENTRO)
    solSobreEje(P, U, PORTAL_GEOM.ejeElevCentro, d);
    if (proyectar(d[0], d[1], d[2])) {
      EJE_PANT.centroX = v.x; EJE_PANT.centroY = v.y;
      e.cruz.setAttribute("d", `M${v.x - 14},${v.y}H${v.x + 14}M${v.x},${v.y - 14}V${v.y + 14}`);
    }
    // sol y punto del eje a la MISMA altura que el sol
    const sd = DIA.solDir;
    if (proyectar(sd[0], sd[1], sd[2])) {
      EJE_PANT.solX = v.x; EJE_PANT.solY = v.y;
      e.sol.setAttribute("cx", v.x.toFixed(1)); e.sol.setAttribute("cy", v.y.toFixed(1));
    } else { EJE_PANT.solX = NaN; EJE_PANT.solY = NaN; }
    solSobreEje(P, U, Math.asin(Math.max(-1, Math.min(1, sd[1]))), d);
    const azEje = Math.atan2(d[0], -d[2]);
    if (proyectar(d[0], d[1], d[2])) {
      EJE_PANT.ejeX = v.x; EJE_PANT.ejeY = v.y;
      e.ejeSol.setAttribute("d", `M${v.x},${v.y - 10}V${v.y + 10}`);
    }
    EJE_PANT.difPx = EJE_PANT.solX - EJE_PANT.ejeX;
    const dAz = ((((DIA.solAz - azEje) * 180) / Math.PI) % 360 + 540) % 360 - 180;
    EJE_PANT.difDeg = dAz;
  });

  return null;
}
