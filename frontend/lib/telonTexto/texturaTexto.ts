// Z46: textura del texto del telón. Se dibuja UNA vez en un canvas 2D (2048 × 640, constante) con el layout
// medido (layoutTexto.ts) y se desenfoca una vez (borde suave de recorte de luz). Solo el canal alfa importa
// (letras blancas sobre transparente: cobertura). Sin redibujar por frame; se recrea solo si cambia BLUR_PX
// (o la interlínea / columnas / intensidad de ENTION).

import * as THREE from "three";
import { calcularLayout, type MedidaTexto, type LayoutBloque } from "./layoutTexto";

export const TEX_ANCHO = 2048, TEX_ALTO = 640;
export const TEX_MARGEN = 64;   // px libres alrededor del bloque (blur y viñeta del modo invertido)

export interface TexturaTexto {
  tex: THREE.CanvasTexture;
  layout: LayoutBloque;
  escala: number;                       // px de textura por unidad de layout
  bloqueU: number; bloqueV: number;     // fracción del ancho / alto de la textura que ocupa el bloque
}

export function crearTexturaTexto(
  familia: string, blurPx: number, interlinea: number, columnas: number, intensidadENTION: number, anisotropia: number,
): TexturaTexto {
  const medidor = document.createElement("canvas").getContext("2d")!;
  const medir = (texto: string, tam: number): MedidaTexto => {
    medidor.font = `${tam}px ${familia}`;
    const m = medidor.measureText(texto);
    return { avance: m.width, izq: m.actualBoundingBoxLeft, der: m.actualBoundingBoxRight, asc: m.actualBoundingBoxAscent };
  };
  const layout = calcularLayout(medir, { INTERLINEA: interlinea, COLUMNAS: columnas }, intensidadENTION);
  const escala = Math.min((TEX_ANCHO - 2 * TEX_MARGEN) / layout.ancho, (TEX_ALTO - 2 * TEX_MARGEN) / layout.alto);
  const ox = (TEX_ANCHO - layout.ancho * escala) / 2, oy = (TEX_ALTO - layout.alto * escala) / 2;

  // 1) letras nítidas
  const nitido = document.createElement("canvas");
  nitido.width = TEX_ANCHO; nitido.height = TEX_ALTO;
  const g = nitido.getContext("2d")!;
  g.fillStyle = "#ffffff";
  g.textAlign = "left"; g.textBaseline = "alphabetic";
  for (const tr of layout.trazos) {
    g.font = `${tr.tam * escala}px ${familia}`;
    g.globalAlpha = tr.intensidad;
    if (tr.letras) for (let i = 0; i < tr.texto.length; i++) g.fillText(tr.texto[i], ox + (tr.x + tr.letras[i]) * escala, oy + tr.y * escala);
    else g.fillText(tr.texto, ox + tr.x * escala, oy + tr.y * escala);
  }
  g.globalAlpha = 1;

  // 2) borde suave una sola vez: filter blur si el navegador lo soporta; si no, el truco de la sombra
  const final = document.createElement("canvas");
  final.width = TEX_ANCHO; final.height = TEX_ALTO;
  const f = final.getContext("2d")!;
  const b = Math.max(0, blurPx);
  if (b <= 0) f.drawImage(nitido, 0, 0);
  else if ("filter" in f && typeof f.filter === "string") { f.filter = `blur(${b}px)`; f.drawImage(nitido, 0, 0); f.filter = "none"; }
  else {
    // la sombra desenfocada (blur ≈ 2σ) cae en su lugar; la imagen queda fuera del canvas
    f.shadowColor = "#ffffff"; f.shadowBlur = b * 2; f.shadowOffsetX = TEX_ANCHO; f.drawImage(nitido, -TEX_ANCHO, 0);
  }

  const tex = new THREE.CanvasTexture(final);
  tex.colorSpace = THREE.NoColorSpace;   // se usa como máscara (cobertura), no como color
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = Math.max(1, Math.min(8, anisotropia));
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return { tex, layout, escala, bloqueU: (layout.ancho * escala) / TEX_ANCHO, bloqueV: (layout.alto * escala) / TEX_ALTO };
}
