// Z26: wrapper tipado del RUNTIME de ink (inkjs) para el diálogo del camino LUZ. Sin React.
// - En el navegador se importa solo el runtime ('inkjs'); el compilador ('inkjs/full') se usa
//   únicamente en scripts/ink-build.mjs (Node), que genera public/alight/dialogo/dialogo-luz.json.
// - Tags del .ink "clave: valor" → { id, estado, efecto, ... }. Los efectos los ejecuta el juego.
// - Texto con *cursiva* y **negrita** → segmentos { texto, estilo } (la interfaz no usa innerHTML).
// Fuente: docs/dialogos/dialogo-luz.ink · recompilar con `npm run ink:build`.

import { Story } from "inkjs";

export type Estilo = "normal" | "cursiva" | "negrita";
export interface Segmento { texto: string; estilo: Estilo }
export interface TagsDialogo { id?: string; estado?: string; efecto?: string; [clave: string]: string | undefined }
export interface OpcionDialogo { indice: number; texto: string; segmentos: Segmento[] }
export interface PasoDialogo {
  texto: string;            // texto plano (sin marcas * / **), líneas unidas con \n
  segmentos: Segmento[];    // el mismo texto en segmentos con estilo
  tags: TagsDialogo;
  opciones: OpcionDialogo[];
  terminado: boolean;       // sin opciones y sin más contenido (-> END)
}

export const RUTA_DIALOGO_LUZ = "/alight/dialogo/dialogo-luz.json";
// versión contra la caché del navegador: id de build si existe, si no el momento de carga del módulo
const VERSION = process.env.NEXT_PUBLIC_BUILD_ID ?? Date.now().toString(36);

/** "clave: valor" → objeto. Tags sin ":" quedan como { [tag]: "" }. */
export function parsearTags(tags: readonly string[] | null | undefined): TagsDialogo {
  const out: TagsDialogo = {};
  for (const t of tags ?? []) {
    const i = t.indexOf(":");
    if (i < 0) { out[t.trim()] = ""; continue; }
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

/** *cursiva* y **negrita** → segmentos (las marcas no quedan en el texto). */
export function segmentar(texto: string): Segmento[] {
  const out: Segmento[] = [];
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let ult = 0, m: RegExpExecArray | null;
  while ((m = re.exec(texto)) !== null) {
    if (m.index > ult) out.push({ texto: texto.slice(ult, m.index), estilo: "normal" });
    out.push(m[1] !== undefined ? { texto: m[1], estilo: "negrita" } : { texto: m[2], estilo: "cursiva" });
    ult = m.index + m[0].length;
  }
  if (ult < texto.length) out.push({ texto: texto.slice(ult), estilo: "normal" });
  return out;
}
const plano = (segs: Segmento[]) => segs.map(s => s.texto).join("");

export interface DialogoInk {
  iniciar(): PasoDialogo;
  continuar(): PasoDialogo;
  elegir(indice: number): PasoDialogo;
  irA(knot: string): PasoDialogo;
  leerPremio(): boolean;
  escribirPremio(v: boolean): void;
  story: Story;             // acceso directo por si hace falta (debug)
}

/** Crea el diálogo a partir del JSON compilado (string u objeto). */
export function crearDialogo(json: string | object): DialogoInk {
  const story = new Story(typeof json === "string" ? json : JSON.stringify(json));

  const continuar = (): PasoDialogo => {
    const lineas: string[] = [];
    const tags: TagsDialogo = {};
    while (story.canContinue) {
      const l = (story.Continue() ?? "").replace(/\n$/, "");
      Object.assign(tags, parsearTags(story.currentTags));
      if (l.length) lineas.push(l);
    }
    const crudo = lineas.join("\n");
    const segmentos = segmentar(crudo);
    const opciones = story.currentChoices.map(c => {
      const segs = segmentar(c.text);
      return { indice: c.index, texto: plano(segs), segmentos: segs };
    });
    return { texto: plano(segmentos), segmentos, tags, opciones, terminado: opciones.length === 0 && !story.canContinue };
  };

  return {
    story,
    iniciar: () => { story.ResetState(); return continuar(); },
    continuar,
    elegir: (indice: number) => { story.ChooseChoiceIndex(indice); return continuar(); },
    irA: (knot: string) => { story.ChoosePathString(knot); return continuar(); },
    leerPremio: () => story.variablesState["premio"] === true,
    escribirPremio: (v: boolean) => { story.variablesState["premio"] = v; },
  };
}

/** Navegador: carga el JSON (con ?v= contra la caché) y crea el diálogo. */
export async function cargarDialogo(url: string = RUTA_DIALOGO_LUZ): Promise<DialogoInk> {
  const sep = url.includes("?") ? "&" : "?";
  const r = await fetch(`${url}${sep}v=${VERSION}`);
  if (!r.ok) throw new Error(`[dialogoInk] no se pudo cargar ${url}: HTTP ${r.status}`);
  return crearDialogo(await r.text());
}
