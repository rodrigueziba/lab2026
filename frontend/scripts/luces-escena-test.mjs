// Z97b: luces de ESCENA del atril de imagen (lib/lucesEscena.ts, lib/lucesEscenaAcciones.ts) y textos del atril de sonido.
// (a) LUZ + y EXTRA muchas veces: el valor final y el aporte (lo que llega a las luces y, por ellas, al bloom) nunca pasan
// los topes; (b) LUZ - baja desde cualquier valor hasta LUZ_MIN; (c) EXTRA alterna y no acumula; (d) doble clic restaura;
// (e) "Restaurar luces del domo" y la carga de checkpoints restablecen todo; (f) "PLAY / PAUSA" entra con margen y ninguna
// otra textura de texto del atril de sonido se corta a ETIQUETA_ESCALA 0,7, 1,0 y 1,15. Uso: node scripts/luces-escena-test.mjs
import fs from 'node:fs';
import { register } from 'node:module';
const RAIZ = new URL('../', import.meta.url).href;
// "@/x" → frontend/x.ts y "./x" sin extensión → "./x.ts" (como resuelve Next con tsconfig)
register('data:text/javascript,' + encodeURIComponent(`const R = ${JSON.stringify(RAIZ)};
export async function resolve(s, c, n) {
  if (s.startsWith('@/')) s = R + s.slice(2);
  if ((/^\\.\\.?\\//.test(s) || s.startsWith('file:')) && !/\\.[a-z]+$/.test(s)) { try { return await n(s + '.ts', c); } catch {} }
  return n(s, c);
}`));
const L = await import('../lib/lucesEscena.ts');
const AC = await import('../lib/lucesEscenaAcciones.ts');
const { STORE } = await import('../lib/alightStore.ts');
const { DBG_ATRIL_VIDEO: C } = await import('../lib/debugConfig.ts');
const S = await import('../lib/atrilSonido.ts');

const leer = f => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
const LS = leer('../components/LecternSystem.tsx'), TS = leer('../components/ThreeScene.tsx'), CA = leer('../lib/checkpointsAcciones.ts');
const AN = leer('../components/AtrilSonidoNuevo.tsx'), LX = leer('../components/LuzExtraEscena.tsx'), TA = leer('../components/debug/pestanas/tarima.tsx');
let ok = 0, fallas = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓ ' + m); } else { fallas++; console.log('  ✗ ' + m); } };
const EPS = 1e-9;

console.log('\nconstantes');
check(C.LUZ_MIN === 0 && C.LUZ_MAX === 3 && C.LUZ_PASO === 0.2 && C.LUZ_DEFECTO === 1 && C.LUZ_TOPE_FINAL === 3 && C.EXTRA_APORTE === 0.6
  && C.EXTRA_REF_CD === 100 && C.LUZ_REPETIR_AL_MANTENER === false, 'DBG_ATRIL_VIDEO: LUZ 0…3, paso 0,2, defecto 1, tope final 3, EXTRA 0,6 (60 cd), sin repetir al mantener');

console.log('\n(a) LUZ + y EXTRA muchas veces');
{ let n = C.LUZ_DEFECTO, ex = false, maxN = 0, maxA = 0, maxSpot = 0, maxCd = 0;
  for (let i = 0; i < 500; i++) {
    n = L.pasoNivel(n, 1, C);
    if (i % 3 === 0) ex = !ex;                               // EXTRA es una tecla on/off: cada pulsación alterna
    maxN = Math.max(maxN, n); maxA = Math.max(maxA, L.aporteFinal(n, ex, 0, C));
    maxSpot = Math.max(maxSpot, L.multSpot(n, ex, 0, C)); maxCd = Math.max(maxCd, L.cdExtra(n, ex, 0, C));
  }
  check(maxN <= C.LUZ_MAX + EPS && n === C.LUZ_MAX, `500 × LUZ +: el nivel se detiene en LUZ_MAX (${n})`);
  check(maxA <= C.LUZ_TOPE_FINAL + EPS, `aporte total (nivel + EXTRA) nunca pasa LUZ_TOPE_FINAL ${C.LUZ_TOPE_FINAL} (máx. ${maxA.toFixed(3)})`);
  check(maxSpot <= C.LUZ_TOPE_FINAL + EPS && maxCd <= C.EXTRA_APORTE * C.EXTRA_REF_CD + EPS, `spot ≤ ${C.LUZ_TOPE_FINAL} × base y EXTRA ≤ ${C.EXTRA_APORTE * C.EXTRA_REF_CD} cd (máx. ${maxSpot.toFixed(2)} y ${maxCd.toFixed(1)} cd)`);
  // el caso del error: 12 luces de 200 cd del diseño anterior + nivel 3 + EXTRA
  const viejas = L.aporteExtrasViejas(12 * 200, C);
  const a = L.aporteFinal(3, true, viejas, C), k = L.factorTope(3, true, viejas, C);
  check(a <= C.LUZ_TOPE_FINAL + EPS && k * 200 * 12 <= C.LUZ_TOPE_FINAL * C.EXTRA_REF_CD + EPS,
    `peor caso (nivel 3 + EXTRA + 12 luces viejas de 200 cd = ${(3 + 0.6 + viejas).toFixed(1)}): k ${k.toFixed(3)} → aporte ${a.toFixed(2)} ≤ ${C.LUZ_TOPE_FINAL}; las 12 luces suman ${(k * 2400).toFixed(0)} cd (antes 2400)`);
  check(L.multSpot(1, false, 0, C) === 1 && L.factorTope(1, false, 0, C) === 1, 'con el nivel por defecto y sin EXTRA el spot queda exactamente como antes (× 1): SILLAS no cambia');
  check(L.aporteFinal(NaN, true, Infinity, C) <= C.LUZ_TOPE_FINAL + EPS && Number.isFinite(L.multSpot(NaN, false, 0, C)), 'valores no finitos tampoco pasan el tope');
  check(/multSpot\(STORE\.lights\.globalIntensity,/.test(TS) && /intensity=\{l\.intensity \* kTope\}/.test(TS) && /cdExtra\(STORE\.lights\.globalIntensity, true, aporteViejasActual\(\), DBG_ATRIL_VIDEO\)/.test(LX),
    'el tope se aplica donde llegan las luces: DiagonalSpot, luces extra del diseño anterior y la EXTRA nueva'); }

console.log('\n(b) LUZ - baja hasta LUZ_MIN');
for (const desde of [3, 2.37, 1, 0.2, 0]) {
  let n = desde, k = 0; while (n > C.LUZ_MIN && k < 100) { n = L.pasoNivel(n, -1, C); k++; }
  check(n === C.LUZ_MIN && k <= Math.ceil((desde - C.LUZ_MIN) / C.LUZ_PASO) + 1, `desde ${desde}: ${k} pulsaciones de LUZ - → ${n}`);
}
check(L.pasoNivel(C.LUZ_MIN, -1, C) === C.LUZ_MIN, 'en el mínimo, LUZ - no baja más');
check(/dom_minus: \{ onActivate: \(\) => luzPaso\(-1\) \}/.test(LS) && /dom_plus:  \{ onActivate: \(\) => luzPaso\(1\) \}/.test(LS)
  && /ctrlState\.dom_int = STORE\.lights\.globalIntensity;/.test(LS), 'LUZ ± mueven el MISMO valor que lee el spot y la perilla INTENS. lo sigue');
check(/\(!DBG_ATRIL_VIDEO\.DISENO_NUEVO \|\| DBG_ATRIL_VIDEO\.LUZ_REPETIR_AL_MANTENER\)/.test(LS) && /if \(e\.repeat && id\.startsWith\("dom_"\)\) return;/.test(LS)
  && /if \(activaAccion\(def\.type, ctrlState\[id\], DBG_PLAY\.CLICK_UNICO\)\) def\.onActivate/.test(LS),
  'un paso por pulsación: sin repetición al mantener (ni con el mouse ni con la tecla), respetando CLICK_UNICO');

console.log('\n(c) EXTRA alterna y no acumula');
{ let ex = false; const cds = [];
  for (let i = 0; i < 25; i++) { ex = !ex; cds.push(L.cdExtra(C.LUZ_DEFECTO, ex, 0, C)); }
  check(ex === true && cds.filter((_, i) => i % 2 === 0).every(c => c === cds[0]) && cds.filter((_, i) => i % 2 === 1).every(c => c === 0),
    `25 pulsaciones: encendida/apagada alternadas, siempre ${cds[0]} cd (no suma)`);
  check(/dom_star:  \{ type: "toggle", initial: 0, onActivate: \(v\) => \{ LUZ_ESCENA\.extra = v > 0\.5;/.test(LS) && !/STORE\.lights\.extras\.push/.test(LS.split('const LUZ_NUEVO')[1].split('IMAGE_CONTROLS_NUEVO.forEach')[0]),
    'EXTRA del diseño nuevo es una tecla con luz (toggle) y ya no agrega luces al STORE');
  check(/<pointLight ref=\{ref\} intensity=\{0\}/.test(LX) && /<LuzExtraEscena \/>/.test(TS) && !/path !== "sillas" && <LuzExtraEscena/.test(TS),
    'una sola luz EXTRA siempre montada (0 apagada): encenderla no cambia la cantidad de luces ni recompila');
  check(L.textoNivel(1, false) === '1.0' && L.textoNivel(2.4, true) === '2.4+EX', 'NIVEL muestra el valor real y "+EX" con EXTRA encendida'); }

console.log('\n(d) doble clic');
{ const est = { id: '', t: -1e9 };
  check(!S.esDobleClic(est, 'lights_ind', 1000) && S.esDobleClic(est, 'lights_ind', 1300) && !S.esDobleClic(est, 'lights_ind', 2000)
    && !S.esDobleClic(est, 'lights_ind', 2400), 'doble clic de 350 ms sobre NIVEL (300 ms sí, 400 ms no)');
  check(/def\.id === "lights_ind" && DBG_ATRIL_VIDEO\.DISENO_NUEVO && esDobleClic\(_dobleClic, def\.id, performance\.now\(\)\)\) \{\s*STORE\.lights\.globalIntensity = acotarNivel\(DBG_ATRIL_VIDEO\.LUZ_DEFECTO/.test(LS)
    && /def\.id !== "lights_ind"/.test(LS), 'NIVEL recibe el clic y el doble clic restaura LUZ_DEFECTO');
  check(/dom_int:   \{ min: DBG_ATRIL_VIDEO\.LUZ_MIN, max: DBG_ATRIL_VIDEO\.LUZ_MAX, initial: DBG_ATRIL_VIDEO\.LUZ_DEFECTO,/.test(LS)
    && /DBG_ATRIL_VIDEO\.DISENO_NUEVO && _posImagen\.has\(def\.id\)\)[^\n]*\n\s*&& esDobleClic[\s\S]{0,80}setCtrl\(def\.id, def\.initial, def\)/.test(LS),
    'doble clic en INTENS. → su valor inicial, que ahora es LUZ_DEFECTO'); }

console.log('\n(e) restaurar y checkpoints');
{ STORE.lights.globalIntensity = 2.8; L.LUZ_ESCENA.extra = true;
  for (let i = 0; i < 12; i++) STORE.lights.extras.push({ color: '#fff', intensity: 200, position: [0, 3, 0] });
  let ev = 0; globalThis.window = { dispatchEvent: e => { if (e.type === 'alight:luces-restauradas') ev++; return true; } };
  globalThis.CustomEvent ??= class { constructor(t) { this.type = t; } };
  AC.restaurarLucesEscena();
  check(STORE.lights.globalIntensity === C.LUZ_DEFECTO && L.LUZ_ESCENA.extra === false && STORE.lights.extras.length === 0 && ev === 1,
    'restaurarLucesEscena: nivel 1, EXTRA apagada, sin luces extra viejas y aviso al atril (perilla y tecla)');
  delete globalThis.window; }
check(/restaurarLucesEscena\(\);   \/\/ Z97b/.test(CA.split('function limpiezaBase')[1] ?? ''), 'la limpieza base de TODOS los checkpoints llama a restaurarLucesEscena');
check(/onClick=\{ev => \{ ev\.currentTarget\.blur\(\); restaurarLucesEscena\(\); toca\(\); \}\}>Restaurar luces del domo</.test(TA), 'botón "Restaurar luces del domo" en Shift → Tarima → Atril de imagen Z97');
check(/const onLuces = \(\) => \{ ctrlState\.dom_int = STORE\.lights\.globalIntensity; ctrlState\.dom_star = 0; \};/.test(LS)
  && /window\.removeEventListener\("alight:luces-restauradas", onLuces\)/.test(LS), 'el atril sincroniza INTENS. y EXTRA al restaurar (y quita el listener)');

console.log('\n(f) textos del atril de sonido');
{ const T = S.TECLA_PLAY, texto = 'PLAY / PAUSA', porPx = 0.62 * texto.length;   // modelo de las pruebas: 0,62 × alto por carácter
  const finAntes = 270 + 112 * porPx;
  check(finAntes > T.w, `causa: antes el texto terminaba en ${finAntes.toFixed(0)} px de ${T.w} (se cortaba la "A")`);
  for (const esc of [0.7, 1, 1.15]) {   // la tecla no depende de ETIQUETA_ESCALA: el resultado debe ser el mismo
    const l = S.layoutTeclaPlay(porPx), fin = l.xTexto + l.px * porPx, m = T.w * T.margen;
    check(l.xIcono >= m - 1e-6 && fin <= T.w - m + 1e-6 && l.px >= 80, `ETIQUETA_ESCALA ${esc}: ícono desde ${l.xIcono.toFixed(0)} px, texto hasta ${fin.toFixed(0)} px (margen ${m.toFixed(0)} px por lado), fuente ${l.px} px`);
  }
  { const l = S.layoutTeclaPlay(porPx), alto = T.iconoAlto * l.s;
    check(alto <= T.h * (1 - 2 * T.margen) && l.px <= T.h * (1 - 2 * T.margen), 'ícono y texto también entran en la altura con margen'); }
  check(/while \(px > 20 && c\.measureText\(TEXTO_TECLA_PLAY\)\.width > limite\)/.test(LS), 'en el navegador se mide con measureText y la fuente baja hasta entrar');

  // display: peores casos de cada línea
  const largo = 'X'.repeat(80), [l1, l2] = S.lineasDisplay({ pista: largo, t: 5999, dur: 5999, sonando: false, loopIn: 5999, loopOut: 5999, loopOn: true });
  const valor = '» ' + S.textoValor('DISTORSIÓN MEZCLA DEL EFECTO', 'knob', 1, 0, 1);
  const casos = [[l1, S.DISPLAY_CHARS_1], [l2, S.DISPLAY_CHARS_2], [valor, S.DISPLAY_CHARS_1], [l1, S.DISPLAY_CHARS_2]];   // con un control tocado, la línea 2 muestra l1
  check(l1.length > S.DISPLAY_CHARS_2, `hallazgo: con un control tocado la línea 2 muestra la línea 1 (${l1.length} caracteres) y su lugar es de ${S.DISPLAY_CHARS_2}: se cortaba`);
  check(casos.every(([t, n]) => S.recortarLinea(t, n).length <= n), 'cada línea se recorta a sus caracteres ("…") antes de dibujarse');
  check(/linea\(c, recortarLinea\(l1, DISPLAY_CHARS_1\)/.test(AN) && /linea\(c, recortarLinea\(l2, DISPLAY_CHARS_2\)/.test(AN) && /if \(a > anchoMax\)/.test(AN),
    'y además se mide en el navegador (si el glifo real es más ancho, la fuente baja)');
  for (const esc of [0.7, 1, 1.15]) {
    const T2 = S.textos(esc), mal = [];
    for (const t of T2) {
      const r = S.rectTexto(t);
      const m = t.fila === 'display' ? S.modulo('display') : S.MODULOS.find(mm => t.id === `t_${mm.id}`) ?? S.modulo(S.pos(t.id.slice(2))?.modulo ?? 'salida');
      if (!S.dentro(r, m.rect) || !S.dentro(r, S.PANEL)) mal.push(t.id);
    }
    const [h1, h2] = S.altosDisplay(esc), d = S.modulo('display').rect, anchoD = d.u1 - d.u0 - 0.024;
    const dispOk = S.DISPLAY_CHARS_1 * S.ANCHO_CHAR * h1 <= anchoD + 1e-9 && S.DISPLAY_CHARS_2 * S.ANCHO_CHAR * h2 <= anchoD + 1e-9;
    const placa = S.lineasBarra(S.TEXTO_PLACA("IN-GO'S WAN INC.").length, true), anchoPl = S.PLACA_BARRA.ancho - 0.04 + 1e-9;
    const placaOk = S.TEXTO_PLACA("IN-GO'S WAN INC.").length * S.ANCHO_CHAR * placa.placa.alto <= anchoPl && S.LEYENDA_FILAS.length * S.ANCHO_CHAR * placa.leyenda.alto <= anchoPl;
    check(mal.length === 0 && dispOk && placaOk, `ETIQUETA_ESCALA ${esc}: títulos y etiquetas dentro de su módulo, display (${S.DISPLAY_CHARS_1}/${S.DISPLAY_CHARS_2} caracteres) y placa de la barra sin cortes${mal.length ? ': ' + mal.join(', ') : ''}`);
  } }

console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
