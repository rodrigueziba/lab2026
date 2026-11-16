// Z70: análisis del menú de debug (sin dependencias). Lo usan scripts/debug-menu-inventario.mjs (inventario del
// paso 1, sobre el DebugMenu.tsx monolítico) y scripts/debug-menu-test.mjs (verifica que la reorganización no perdió
// controles). Todo es análisis de texto del código fuente: no ejecuta React.

/** Normaliza un fragmento de código para comparar (espacios colapsados). */
export const normalizar = s => s.replace(/\s+/g, ' ').trim();

/** Controles de un fragmento JSX: tipo y firma (texto normalizado del elemento). El orden es el del código. */
export function controles(texto) {
  const r = [];
  const re = /<NumField\b[\s\S]*?\/>|<ColorField\b[\s\S]*?\/>|<button\b[\s\S]*?<\/button>|<input\b[\s\S]*?\/>|<select\b[\s\S]*?<\/select>|<RendimientoPanel\s*\/>/g;
  let m;
  while ((m = re.exec(texto))) {
    const t = m[0];
    let tipo;
    if (t.startsWith('<NumField')) tipo = 'numero';
    else if (t.startsWith('<ColorField')) tipo = 'color';
    else if (t.startsWith('<select')) tipo = 'selector';
    else if (t.startsWith('<RendimientoPanel')) tipo = 'panel';
    else if (t.startsWith('<input')) tipo = /type="range"/.test(t) ? 'slider' : /type="checkbox"/.test(t) ? 'interruptor' : /type="color"/.test(t) ? 'color' : 'campo';
    else tipo = /"ON"|'ON'|\bON\b|"off"|"OFF"|✓|on\/off/.test(t) ? 'interruptor' : 'boton';
    r.push({ tipo, firma: tipo + ':' + normalizar(t) });
  }
  return r;
}

/** Nombres buscables de los controles de un fragmento (etiquetas, claves en listas, textos de botones y filas). */
export function nombresControles(texto) {
  const s = new Set();
  for (const m of texto.matchAll(/label="([^"]+)"/g)) s.add(m[1]);
  for (const m of texto.matchAll(/\[\s*((?:"[A-Za-z_][\w]*"\s*,?\s*)+)\]\s*as const/g)) for (const k of m[1].matchAll(/"([\w]+)"/g)) s.add(k[1]);
  for (const m of texto.matchAll(/<span>\s*([A-Za-z_][\w.()° /-]{1,40}?)\s*(?:<|\{)/g)) s.add(m[1].trim());
  for (const m of texto.matchAll(/>\s*([^<>{}\n][^<>{}\n]{1,40}?)\s*<\/button>/g)) s.add(m[1].trim());
  for (const m of texto.matchAll(/"([A-Z][A-Z0-9_]{2,})"/g)) s.add(m[1]);   // claves de DBG_* entre comillas
  return [...s].filter(x => x.length > 1);
}

/** Z mencionados en un fragmento (comentarios y etiquetas: "Z54", "Z66"). */
export function zetas(texto) {
  return [...texto.matchAll(/(?<![\w])Z(\d{1,3})(?![\d])/g)].map(m => Number(m[1])).filter(n => n > 0 && n < 1000);
}

/** Título de una sección a partir de su primer encabezado. */
export function tituloDe(texto) {
  if (/<RendimientoPanel\s*\/>/.test(texto) && !/style=\{LABEL\}/.test(texto)) return 'Rendimiento Z66';
  const m = /<span style=\{(?:LABEL|\{ \.\.\.LABEL[^}]*\})\}>([^<{]*)/.exec(texto);
  return m ? m[1].trim() : '(sin título)';
}

const balance = l => {
  const sinStr = l.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""');
  let b = 0;
  for (const c of sinStr) { if (c === '{') b++; else if (c === '}') b--; }
  b += (sinStr.match(/<>/g) || []).length - (sinStr.match(/<\/>/g) || []).length;
  return b;
};

/** Corta el contenido de una pestaña del DebugMenu monolítico en secciones (nivel superior, llaves balanceadas):
 *  nueva sección en cada divisor y en cada encabezado LABEL o <RendimientoPanel />; los comentarios que preceden a un
 *  encabezado van con él; los divisores no se guardan (el contenedor los dibuja). */
export function cortarPestana(lineas) {
  const secciones = [];
  let actual = [], pend = [], bal = 0;
  const cerrar = () => { if (actual.some(l => l.trim() && !/^\{\/\*.*\*\/\}$/.test(l.trim()))) secciones.push(actual); else if (actual.length) pend.unshift(...actual); actual = []; };
  for (const l of lineas) {
    const t = l.trim();
    const sup = /^ {10}\S/.test(l);   // nivel superior del fragmento de la pestaña (sangría de 10 espacios)
    if (bal === 0 && sup) {
      if (t === '<div style={DIVIDER} />') { cerrar(); actual = pend; pend = []; continue; }
      if (t.startsWith('<span style={LABEL}>') || t === '<RendimientoPanel />') {
        // los comentarios inmediatamente anteriores pasan a la sección nueva
        const com = [];
        while (actual.length && (/^\{\/\*.*\*\/\}$/.test(actual[actual.length - 1].trim()) || !actual[actual.length - 1].trim())) com.unshift(actual.pop());
        cerrar(); actual = [...pend, ...com]; pend = [];
      }
    }
    actual.push(l);
    bal += balance(l);
  }
  cerrar();
  const limpias = secciones.map(ls => {
    while (ls.length && !ls[ls.length - 1].trim()) ls.pop();
    while (ls.length && !ls[0].trim()) ls.shift();
    return ls;
  });
  // un trozo sin encabezado es la continuación de la sección anterior (había un divisor interno): se une con su divisor
  const r = [];
  for (const ls of limpias) {
    if (r.length && tituloDe(ls.join('\n')) === '(sin título)') r[r.length - 1].push('          <div style={DIVIDER} />', ...ls);
    else r.push(ls);
  }
  return r;
}

/** Ubica las pestañas del DebugMenu monolítico: { SILLAS: [desde, hasta], TARIMA: [...] } (índices de línea 0-based,
 *  contenido entre el fragmento de apertura y el de cierre). */
export function ubicarPestanas(src) {
  const L = src.split('\n'), r = {};
  for (const tab of ['SILLAS', 'TARIMA']) {
    const i = L.findIndex(l => l.trim() === `{tab === "${tab}" && (`);
    if (i < 0) continue;
    let j = i + 2;
    while (j < L.length && !(L[j] === '        </>' && L[j + 1] === '      )}')) j++;
    r[tab] = [i + 2, j];
  }
  return r;
}

/** Secciones del DebugMenu monolítico con su texto y líneas (1-based). */
export function seccionesMonoliticas(src) {
  const L = src.split('\n'), P = ubicarPestanas(src), out = [];
  for (const [tab, [a, b]] of Object.entries(P)) {
    const lineas = L.slice(a, b).map((l, k) => ({ l, n: a + k + 1 }));
    // cortarPestana trabaja con strings; se recuperan los números por posición
    const cortes = cortarPestana(lineas.map(x => x.l));
    let k = 0;
    for (const c of cortes) {
      while (k < lineas.length && lineas[k].l !== c[0]) k++;
      const desde = lineas[k]?.n ?? 0;
      let h = k, m = 0;
      while (h < lineas.length && m < c.length) { if (lineas[h].l === c[m]) { m++; h++; } else if (c[m].trim() === '<div style={DIVIDER} />') m++; else h++; }
      out.push({ tab, titulo: tituloDe(c.join('\n')), texto: c.join('\n'), desde, hasta: lineas[h - 1]?.n ?? desde });
      k = h;
    }
  }
  return out;
}
