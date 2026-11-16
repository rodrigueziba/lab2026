// Z71: textura del crédito del telón. Se dibuja UNA vez (al montar, cuando la fuente está lista, y al cambiar el
// tracking) en un canvas chico: letras blancas sobre transparente (solo importa el alfa, como el título), con el mismo
// borde suave proporcional que el título y margen libre alrededor para el desenfoque del shader. Sin redibujar por frame.
import * as THREE from "three";
import type { MedidasCredito } from "./credito";

export const CREDITO_FUENTE_PX = 96;   // tamaño de dibujo (la escala final la da CREDITO_TAMANO)

export interface TexturaCredito { tex: THREE.CanvasTexture; medidas: MedidasCredito }

export function crearTexturaCredito(familia: string, texto: string, tracking: number, blurRelativo: number, anisotropia: number): TexturaCredito {
  const F = CREDITO_FUENTE_PX;
  const c = document.createElement("canvas");
  const g = c.getContext("2d")!;
  const fuente = `${F}px ${familia}`;
  const esp = Math.max(0, tracking) * F;
  const conTracking = (ctx: CanvasRenderingContext2D) => { ctx.font = fuente; if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${esp}px`; };
  conTracking(g);
  const m = g.measureText(texto);
  const cap = g.measureText("AN").actualBoundingBoxAscent;
  const asc = m.actualBoundingBoxAscent, desc = Math.max(0, m.actualBoundingBoxDescent);
  const izq = m.actualBoundingBoxLeft, der = m.actualBoundingBoxRight;
  const pad = Math.ceil(F * 1.0);   // margen para el desenfoque (radio 0,45 × alto + imagen doble corrida 1,6 × radio) y el borde suave
  const W = Math.ceil(izq + der + 2 * pad), H = Math.ceil(asc + desc + 2 * pad);
  c.width = W; c.height = H;
  conTracking(g);   // cambiar el tamaño del canvas reinicia el contexto
  g.fillStyle = "#ffffff"; g.textAlign = "left"; g.textBaseline = "alphabetic";
  const x = pad + izq, y = pad + asc;
  // borde suave como el del título (BLUR_PX sobre 2048 px de ancho ≈ blurRelativo × alto de letra)
  const b = Math.max(0, blurRelativo) * F;
  if (b > 0 && "filter" in g) g.filter = `blur(${b.toFixed(2)}px)`;
  g.fillText(texto, x, y);
  if ("filter" in g) g.filter = "none";

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = Math.max(1, Math.min(8, anisotropia));
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  // tinta: borde derecho = x + der (el tracking deja espacio después de la última letra: no cuenta)
  return { tex, medidas: { texW: W, texH: H, inkDer: x + der, inkArriba: y - asc, inkAbajo: y + desc, capPx: cap } };
}
