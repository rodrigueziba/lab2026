// Z69: transformación de texto del fragment del CRT para el pase final fusionado (lib/retro/paseFinal.ts).
// Sin imports: se prueba en Node (scripts/rendimiento-z69-test.mjs) con el shader real de lib/retro/retroCRT.ts.

export const BLOQUE_CA = `      col.r = texture2D(tDiffuse, uv + d * effCA * 2.0).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - d * effCA * 2.0).b;`;
const BLOQUE_CA_NUEVO = `      vec3 aaC = correccionAA(uv);
      col.r = escena(uv + d * effCA * 2.0).r + aaC.r;
      col.g = escena(uv).g + aaC.g;
      col.b = escena(uv - d * effCA * 2.0).b + aaC.b;`;

/** Transforma el fragment del CRT para usarlo como función dentro del pase final. Devuelve también si encontró el
 *  bloque de la aberración cromática (sin él no hay FXAA: las lecturas se reemplazan una por una). */
export function transformarCRT(frag: string): { codigo: string; conAA: boolean } {
  let c = frag;
  const n = (s: string, sub: string) => s.split(sub).length - 1;
  if (n(c, "void main()") !== 1) throw new Error("paseFinal: el CRT no tiene un único main()");
  c = c.replace("uniform sampler2D tDiffuse;", "");          // se declara antes (lo usan las funciones de abajo)
  c = c.replace("void main()", "void crtMain()");
  c = c.split("gl_FragColor").join("crtSalida");
  const conAA = c.includes(BLOQUE_CA);
  if (conAA) c = c.replace(BLOQUE_CA, BLOQUE_CA_NUEVO);
  else c = c.split("texture2D(tDiffuse,").join("escena4(");
  return { codigo: c, conAA };
}
