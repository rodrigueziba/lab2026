import * as THREE from "three";

// Z1: tarjeta placeholder retro para paneles de proyecto sin foto (o con carga fallida).
// Beige #E8DCC4, guarda de franjas en orden de espectro, bloque de marca ficticia
// (AUSTRAL ELECTRIC) y el título del proyecto en una barra negro azulado #12101A.
// Se dibuja una vez en un canvas (no por frame); quien la crea la libera con dispose().

const W = 512, H = 304; // ≈ aspecto de la zona de imagen del panel (cover-fit igual)
const FRANJAS = ["#E5322B", "#F0742A", "#F4B62E", "#2E9E5B", "#1F7FB8"];

function partirTitulo(ctx: CanvasRenderingContext2D, txt: string, max: number): string[] {
  const palabras = txt.toUpperCase().split(/\s+/).filter(Boolean);
  const lineas: string[] = [];
  let actual = "";
  for (const p of palabras) {
    const prueba = actual ? `${actual} ${p}` : p;
    if (ctx.measureText(prueba).width <= max || !actual) actual = prueba;
    else { lineas.push(actual); actual = p; }
  }
  if (actual) lineas.push(actual);
  if (lineas.length > 2) {
    lineas.length = 2;
    lineas[1] = lineas[1].replace(/\s*\S*$/, "") + " …";
  }
  return lineas;
}

/** Z1: crea la textura placeholder. `indice` solo varía el código de modelo. */
export function createPanelPlaceholder(titulo: string, indice: number): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d");
  if (!ctx) return null;

  // base beige
  ctx.fillStyle = "#E8DCC4";
  ctx.fillRect(0, 0, W, H);

  // guarda de franjas diagonal (recortada por el borde de la pieza)
  const bw = 16;
  ctx.save();
  ctx.translate(W * 0.52, H);
  ctx.rotate(-Math.PI / 5.2);
  FRANJAS.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(-40, -(i + 1) * bw - 18, W, bw);
  });
  ctx.restore();

  // bloque de marca ficticia + serigrafía
  ctx.fillStyle = "#3A3B3C";
  ctx.font = "bold 22px ui-monospace, Menlo, monospace";
  ctx.fillText("AUSTRAL ELECTRIC", 22, 40);
  ctx.font = "13px ui-monospace, Menlo, monospace";
  ctx.fillText("SIN SEÑAL DE IMAGEN · NO SIGNAL", 22, 62);
  ctx.fillStyle = "#C0552F";
  ctx.font = "bold 46px ui-monospace, Menlo, monospace";
  const modelo = `PX-${String((indice % 99) + 1).padStart(2, "0")}`;
  ctx.fillText(modelo, W - 22 - ctx.measureText(modelo).width, 52);
  // casillas
  ctx.strokeStyle = "#3A3B3C"; ctx.lineWidth = 2;
  ctx.font = "12px ui-monospace, Menlo, monospace";
  ctx.fillStyle = "#3A3B3C";
  ["COLOR", "STEREO"].forEach((t, i) => {
    const y = 86 + i * 22;
    ctx.strokeRect(22, y - 11, 12, 12);
    ctx.fillText(t, 42, y);
  });

  // barra negro azulado con el título
  const barH = 82, barY = H - barH - 26;
  ctx.fillStyle = "#12101A";
  ctx.fillRect(0, barY, W, barH);
  ctx.fillStyle = "#E8DCC4";
  ctx.font = "bold 26px ui-monospace, Menlo, monospace";
  const lineas = partirTitulo(ctx, titulo || "SIN TÍTULO", W - 44);
  const y0 = barY + (lineas.length === 1 ? 50 : 34);
  lineas.forEach((l, i) => ctx.fillText(l, 22, y0 + i * 30));
  // filete de franjas bajo la barra (como el mockup)
  FRANJAS.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(0, barY + barH + i * 3, W, 3);
  });

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.userData.aspect = W / H;
  return tex;
}
