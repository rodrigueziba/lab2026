// Z104: textura de la ayuda de movimiento del telón: cuatro celdas en fila (W ↑ · S ↓ · A ← · D →), letras blancas sobre
// transparente (solo importa el alfa, como el título y el crédito), con la MISMA fuente (Anton) y el mismo borde suave.
// Las flechas se dibujan como formas (trazo + triángulo) en el mismo canvas: la fuente del telón no tiene flechas y una
// fuente de reemplazo rompería la estética. Se dibuja UNA vez (al estar la fuente lista); nada por cuadro.
import * as THREE from "three";

export const CELDA_W = 512, CELDA_H = 256, N_CELDAS = 4;
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
export function crearTexturaAyuda(familia: string, blurRel: number, anisotropia: number): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = CELDA_W * N_CELDAS; c.height = CELDA_H;
  const g = c.getContext("2d")!;
  const F = Math.round(CELDA_H * 0.72);
  g.font = `${F}px ${familia}`;
  g.fillStyle = "#ffffff"; g.textAlign = "center"; g.textBaseline = "middle";
  const b = Math.max(0, blurRel) * F;
  if (b > 0 && "filter" in g) g.filter = `blur(${b.toFixed(2)}px)`;
  for (let i = 0; i < N_CELDAS; i++) {
    const x0 = i * CELDA_W;
    g.fillText(LETRAS[i], x0 + CELDA_W * 0.32, CELDA_H * 0.53);
    flecha(g, x0 + CELDA_W * 0.70, CELDA_H * 0.5, CELDA_H * 0.62, ANGULOS[i]);
  }
  if ("filter" in g) g.filter = "none";
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = true;
  tex.anisotropy = Math.max(1, Math.min(8, anisotropia));
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}
