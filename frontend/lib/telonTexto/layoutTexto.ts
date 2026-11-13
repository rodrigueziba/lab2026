// Z46: layout del bloque "A LIGHT FOR ATTRACTING ATTENTION" proyectado sobre el telón. Puro y sin imports
// (se prueba en Node con un medidor simulado: scripts/telon-texto-test.mjs). Todo sale de medir: no hay
// tamaños escritos a ojo, solo proporciones relativas (interlínea y separación de columnas).
//
//   | A |  LIGHT  | ATT | RACTING |
//   |   |  FOR    |     | E N T I O N |   ← ENTION justificada con interletra hasta el borde derecho de la G
//
// Columnas 1 y 3 ("A", "ATT") ocupan la altura de las dos líneas (su altura de mayúscula = bloque).
// Las coordenadas son de tinta (bounding box real de los glifos), en px de un tamaño de referencia, y
// crecen hacia abajo como en un canvas 2D (y = línea base).

export interface MedidaTexto {
  avance: number;   // measureText().width
  izq: number;      // actualBoundingBoxLeft (tinta a la izquierda del punto de dibujo; positivo = hacia la izquierda)
  der: number;      // actualBoundingBoxRight
  asc: number;      // actualBoundingBoxAscent
}
/** Mide un texto a un tamaño de fuente en px (canvas 2D: ctx.font + measureText). */
export type Medidor = (texto: string, tamPx: number) => MedidaTexto;

export interface CfgLayout {
  INTERLINEA: number;   // separación entre las dos líneas, relativa a la altura de mayúscula de una línea
  COLUMNAS: number;     // separación entre columnas, relativa a la altura de mayúscula de una línea
}

export interface TrazoTexto {
  texto: string;
  x: number; y: number;     // punto de dibujo (textAlign left, textBaseline alphabetic)
  tam: number;              // tamaño de fuente (px)
  intensidad: number;       // 1 = normal; ENTION ≈ 0,55
  letras?: number[];        // si está, cada letra se dibuja en x + letras[i] (interletra de justificación)
}

export interface LayoutBloque {
  trazos: TrazoTexto[];
  ancho: number; alto: number;       // caja de tinta del bloque (empieza en 0, 0)
  aspecto: number;                   // ancho / alto
  bordeG: number; bordeN: number;    // borde derecho de tinta de la G de RACTING y de la N de ENTION
  interletraENTION: number;          // px agregados entre letras de ENTION
}

export const TAM_REF = 200;   // tamaño de referencia de una línea (px); el dibujo final escala el resultado

export function calcularLayout(medir: Medidor, c: CfgLayout, intensidadENTION = 0.55): LayoutBloque {
  const s = TAM_REF;
  const capS = medir("LIGHT", s).asc;                 // altura de mayúscula de una línea
  const gap = Math.max(0, c.INTERLINEA) * capS;
  const alto = 2 * capS + gap;
  const capRefGrande = medir("ATT", s).asc;
  const S = s * alto / capRefGrande;                  // tamaño de "A" y "ATT": su mayúscula mide el bloque
  const col = Math.max(0, c.COLUMNAS) * capS;
  const y1 = capS, y2 = alto;                         // líneas base (mayúsculas sin descendente)

  const anchoTinta = (m: MedidaTexto) => m.izq + m.der;
  // columna 1: "A"
  const mA = medir("A", S);
  const xA = mA.izq;                                   // tinta izquierda en 0
  const der1 = anchoTinta(mA);
  // columna 2: LIGHT / FOR, alineadas a la izquierda por la tinta
  const izq2 = der1 + col;
  const mL = medir("LIGHT", s), mF = medir("FOR", s);
  const der2 = izq2 + Math.max(anchoTinta(mL), anchoTinta(mF));
  // columna 3: "ATT"
  const izq3 = der2 + col;
  const mT = medir("ATT", S);
  const der3 = izq3 + anchoTinta(mT);
  // columna 4: RACTING define el borde derecho; ENTION justificada a ese borde
  const izq4 = der3 + col;
  const mR = medir("RACTING", s);
  const xR = izq4 + mR.izq;
  const bordeG = xR + mR.der;
  const E = "ENTION";
  const mE0 = medir("E", s);
  const xE = izq4 + mE0.izq;
  // posición de cada letra = avance del prefijo (conserva el kerning) + i · extra
  const pref: number[] = [];
  for (let i = 0; i < E.length; i++) pref.push(i === 0 ? 0 : medir(E.slice(0, i), s).avance);
  const derN = medir(E[E.length - 1], s).der;
  const extra = (bordeG - xE - pref[E.length - 1] - derN) / (E.length - 1);
  const letras = pref.map((p, i) => p + i * extra);
  const bordeN = xE + letras[E.length - 1] + derN;

  const trazos: TrazoTexto[] = [
    { texto: "A", x: xA, y: y2, tam: S, intensidad: 1 },
    { texto: "LIGHT", x: izq2 + mL.izq, y: y1, tam: s, intensidad: 1 },
    { texto: "FOR", x: izq2 + mF.izq, y: y2, tam: s, intensidad: 1 },
    { texto: "ATT", x: izq3 + mT.izq, y: y2, tam: S, intensidad: 1 },
    { texto: "RACTING", x: xR, y: y1, tam: s, intensidad: 1 },
    { texto: E, x: xE, y: y2, tam: s, intensidad: intensidadENTION, letras },
  ];
  const ancho = Math.max(bordeG, bordeN);
  return { trazos, ancho, alto, aspecto: ancho / alto, bordeG, bordeN, interletraENTION: extra };
}
