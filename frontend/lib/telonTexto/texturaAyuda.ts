// Z104: textura de la ayuda de movimiento del telón: cuatro celdas en fila (W ↑ · S ↓ · A ← · D →), letras blancas sobre
// transparente (solo importa el alfa, como el título y el crédito), con la MISMA fuente (Anton) y el mismo borde suave.
// Las flechas se dibujan como formas (trazo + triángulo) en el mismo canvas: la fuente del telón no tiene flechas y una
// fuente de reemplazo rompería la estética. Se dibuja UNA vez (al estar la fuente lista); nada por cuadro.
import * as THREE from "three";

// Z104b: la resolución de la celda es configurable (DBG_TELON_AYUDA.RES_CELDA_H, antes fija en 256). Todo el dibujo
// (tamaño de la letra, trazo y punta de la flecha, borde suave) es proporcional al alto de la celda, así que al subir la
// resolución o al agrandar la ayuda nada queda más fino ni más borroso en proporción.
export const ASPECTO_CELDA = 2, N_CELDAS = 4, RES_CELDA_MIN = 128, RES_CELDA_MAX = 512;   // tope: 4096 × 512 px (8 MB + mipmaps)
export const CELDA_H = 384, CELDA_W = CELDA_H * ASPECTO_CELDA;   // valores por defecto (antes 256 y 512)
/** Dónde está la tinta dentro de la celda (fracción del alto, desde arriba), para ubicar la ayuda por su tinta. */
export const TINTA_AYUDA_DEF = { arriba: 0.19, abajo: 0.81 };
export interface TexturaAyuda { tex: THREE.CanvasTexture; resH: number; tintaArriba: number; tintaAbajo: number }
export function resolucionCelda(h: number): number { return Math.round(Math.max(RES_CELDA_MIN, Math.min(RES_CELDA_MAX, Number.isFinite(h) ? h : CELDA_H))); }
const LETRAS = ["W", "S", "A", "D"], ANGULOS = [0, Math.PI, -Math.PI / 2, Math.PI / 2];   // arriba, abajo, izquierda, derecha

function flecha(g: CanvasRenderingContext2D, cx: number, cy: number, alto: number, ang: number): void {
  g.save();
  g.translate(cx, cy); g.rotate(ang);
  const t = alto, ancho = t * 0.16;
  g.fillRect(-ancho / 2, -t * 0.02, ancho, t * 0.5);          // trazo
  g.beginPath(); g.moveTo(0, -t * 0.5); g.lineTo(t * 0.32, -t * 0.02); g.lineTo(-t * 0.32, -t * 0.02); g.closePath(); g.fill();   // punta
  g.restore();
}
/** blurRel = borde suave relativo al alto de la letra (el mismo que usa el título). */
export function crearTexturaAyuda(familia: string, blurRel: number, anisotropia: number, resH: number = CELDA_H): TexturaAyuda {
  const H = resolucionCelda(resH), W = H * ASPECTO_CELDA;
  const c = document.createElement("canvas");
  c.width = W * N_CELDAS; c.height = H;
  const g = c.getContext("2d")!;
  const F = Math.round(H * 0.72);
  g.font = `${F}px ${familia}`;
  g.fillStyle = "#ffffff"; g.textAlign = "center"; g.textBaseline = "middle";
  const b = Math.max(0, blurRel) * F;
  if (b > 0 && "filter" in g) g.filter = `blur(${b.toFixed(2)}px)`;
  // tinta: flechas verticales de 0,19 a 0,81 del alto; la letra se mide (la más alta y la más baja de las cuatro)
  let arriba = TINTA_AYUDA_DEF.arriba, abajo = TINTA_AYUDA_DEF.abajo;
  for (let i = 0; i < N_CELDAS; i++) {
    const x0 = i * W, yL = H * 0.53;
    g.fillText(LETRAS[i], x0 + W * 0.32, yL);
    flecha(g, x0 + W * 0.70, H * 0.5, H * 0.62, ANGULOS[i]);
    const m = g.measureText(LETRAS[i]);
    if (Number.isFinite(m.actualBoundingBoxAscent) && m.actualBoundingBoxAscent > 0) {
      arriba = Math.min(arriba, (yL - m.actualBoundingBoxAscent) / H);
      abajo = Math.max(abajo, (yL + Math.max(0, m.actualBoundingBoxDescent || 0)) / H);
    }
  }
  if ("filter" in g) g.filter = "none";
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = true;
  tex.anisotropy = Math.max(1, Math.min(8, anisotropia));
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return { tex, resH: H, tintaArriba: Math.max(0, arriba), tintaAbajo: Math.min(1, abajo) };
}
