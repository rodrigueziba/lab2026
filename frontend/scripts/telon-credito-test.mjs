// Z71: prueba del crédito del telón (lib/telonTexto/credito.ts). Uso (en frontend/): node scripts/telon-credito-test.mjs
//  · línea de tiempo del foco: orden de fases, duraciones, azar con semilla fija, sobreimpulso, sin saltos al cambiar
//    parámetros, pausa (el reloj de la experiencia no avanza), forzar desenfoque, apagado
//  · posición: alineado al borde derecho del bloque, debajo con su margen, dentro del telón; tamaño aparente a 1440×900
import { crearEstadoEnfoque, avanzarEnfoque, forzarDesenfoque, cSobreimpulso, curvaEntrada, posicionCredito,
  creditoDentroDelTelon, alturaAparentePx } from '../lib/telonTexto/credito.ts';
import { anchoZonaIluminada } from '../lib/telonTexto/lineaTiempo.ts';

let ok = 0, fallas = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓ ' + m); } else { fallas++; console.log('  ✗ ' + m); } };
const f = (n, d = 2) => Number(n).toFixed(d);
const CFG = await import('../lib/debugConfig.ts');
const D = { ...CFG.DBG_TELON_TEXTO }, S = CFG.DBG_SILLAS, I = CFG.DBG_INICIO;

console.log('\nfoco: línea de tiempo');
{
  const cfg = { ...D };
  const e = crearEstadoEnfoque(cfg.SEMILLA);
  const fases = [], durs = { enfocado: [], saliendo: [], retenido: [], entrando: [] };
  let t = 0, fase = e.fase, t0 = 0, pMin = 0, saltoMax = 0, pPrev = 0;
  for (let k = 0; k < 60 * 120; k++) {
    t += 1 / 60;
    avanzarEnfoque(e, cfg, t, true);
    if (e.fase !== fase) { durs[fase].push(t - t0); fases.push(e.fase); fase = e.fase; t0 = t; }
    if (e.fase === 'entrando') pMin = Math.min(pMin, e.p);
    saltoMax = Math.max(saltoMax, Math.abs(e.p - pPrev)); pPrev = e.p;
  }
  const orden = ['saliendo', 'retenido', 'entrando', 'enfocado'];
  check(fases.every((x, i) => x === orden[i % 4]) && fases.length >= 40, `orden enfocado → saliendo → retenido → entrando → enfocado (${fases.length / 4 | 0} ciclos en 120 s)`);
  const prom = a => a.reduce((x, y) => x + y, 0) / a.length;
  check(Math.abs(prom(durs.saliendo) - cfg.ENFOQUE_SALIDA_S) < 0.02 && Math.abs(prom(durs.retenido) - cfg.ENFOQUE_RETENCION_S) < 0.02 && Math.abs(prom(durs.entrando) - cfg.ENFOQUE_ENTRADA_S) < 0.02,
    `duraciones: salida ${f(prom(durs.saliendo))} s, retención ${f(prom(durs.retenido))} s, entrada ${f(prom(durs.entrando))} s`);
  const enf = durs.enfocado;
  check(enf.every(d => d >= cfg.ENFOQUE_INTERVALO_MIN_S - 0.02 && d <= cfg.ENFOQUE_INTERVALO_MAX_S + 0.02) && Math.max(...enf) - Math.min(...enf) > 1,
    `enfocado al azar entre ${cfg.ENFOQUE_INTERVALO_MIN_S} y ${cfg.ENFOQUE_INTERVALO_MAX_S} s (${enf.slice(0, 6).map(d => f(d, 1)).join(', ')}…)`);
  check(Math.abs(pMin + cfg.ENFOQUE_SOBREIMPULSO) < 0.01, `sobreimpulso: el foco se pasa hasta ${f(pMin, 3)} (pedido −${cfg.ENFOQUE_SOBREIMPULSO}) y vuelve a 0`);
  check(saltoMax < 0.13, `sin saltos: cambio máximo de p por cuadro a 60 FPS ${f(saltoMax, 3)} (la vuelta al foco es rápida, como un autofoco: 0,5 s)`);
  // semilla fija
  const sec = sem => { const x = crearEstadoEnfoque(sem); const c = { ...cfg, SEMILLA: sem }; const r = []; let tt = 0, ff = x.fase; for (let k = 0; k < 60 * 60; k++) { tt += 1 / 60; avanzarEnfoque(x, c, tt, true); if (x.fase !== ff && x.fase === 'saliendo') r.push(f(tt, 2)); ff = x.fase; } return r.join(); };
  check(sec(71) === sec(71) && sec(71) !== sec(72), 'azar con semilla fija: misma semilla → mismos tiempos; otra semilla → otros');
  // curva de sobreimpulso
  let okC = true;
  for (const o of [0, 0.05, 0.15, 0.3]) { const c = cSobreimpulso(o); let mn = 1; for (let x = 0; x <= 1; x += 0.001) mn = Math.min(mn, curvaEntrada(x, c)); if (Math.abs(mn + o) > 0.002 || Math.abs(curvaEntrada(0, c) - 1) > 1e-9 || Math.abs(curvaEntrada(1, c)) > 1e-9) okC = false; }
  check(okC, 'curva de vuelta: empieza en 1, termina en 0 y baja exactamente hasta −SOBREIMPULSO (0; 0,05; 0,15; 0,3)');
}

console.log('\nfoco: parámetros, pausa, forzar, apagado');
{
  const cfg = { ...D };
  const e = crearEstadoEnfoque(cfg.SEMILLA);
  let t = 0;
  avanzarEnfoque(e, cfg, t, true);
  forzarDesenfoque(e);
  check(e.fase === 'saliendo' && e.prog === 0, '"Forzar desenfoque ahora": empieza a desenfocarse desde enfocado');
  for (let k = 0; k < 27; k++) { t += 1 / 60; avanzarEnfoque(e, cfg, t, true); }   // mitad de la salida (0,45 s)
  const pAntes = e.p;
  cfg.ENFOQUE_SALIDA_S = 2.0;   // cambio en medio de la fase
  t += 1 / 60; avanzarEnfoque(e, cfg, t, true);
  check(e.fase === 'saliendo' && Math.abs(e.p - pAntes) < 0.02, `cambiar SALIDA_S a mitad de fase no salta (p ${f(pAntes, 3)} → ${f(e.p, 3)})`);
  const pPausa = e.p, fasePausa = e.fase;
  for (let k = 0; k < 300; k++) avanzarEnfoque(e, cfg, t, true);   // pausa: tExp no avanza
  check(e.p === pPausa && e.fase === fasePausa, 'pausa (reloj de la experiencia quieto): el foco no avanza');
  avanzarEnfoque(e, cfg, t + 1 / 60, false);
  check(e.nivel === 0 && e.fase === 'enfocado', 'apagado (ENFOQUE_ACTIVO off o crédito oculto): enfocado');
  const e2 = crearEstadoEnfoque(71); avanzarEnfoque(e2, { ...D }, 0, true); forzarDesenfoque(e2);
  avanzarEnfoque(e2, { ...D }, 3.0, true);   // salto de 3 s de una vez (tope 0,25 s por cuadro)
  check(e2.fase === 'saliendo' && e2.p < 0.5, 'un salto largo del reloj (pestaña oculta) avanza como mucho 0,25 s');
}

console.log('\nposición y tamaño');
{
  const zona = anchoZonaIluminada(Math.hypot(5, 9 - 4), 0.6, 0.7);
  const anchoBloque = D.TAMANO * zona, aspecto = 4.79, altoBloque = anchoBloque / aspecto;   // aspecto medido en Z46 (Anton)
  // medidas de la textura del crédito con Anton a 96 px (medidas en Chrome: se reemplazan por las reales si cambian)
  const M = { texW: 1481, texH: 273, inkDer: 1385, inkArriba: 96, inkAbajo: 177, capPx: 81 };
  const P = posicionCredito(anchoBloque, altoBloque, M, D.CREDITO_TAMANO, D.CREDITO_MARGEN);
  const anchoTinta = (M.inkDer - 96) * (P.alto / M.texH);
  check(Math.abs(P.inkDerX - anchoBloque / 2) < 1e-9, `alineado al borde derecho del bloque (x ${f(P.inkDerX, 3)} m = mitad del ancho ${f(anchoBloque / 2, 3)} m)`);
  check(Math.abs(P.inkArribaY - (-altoBloque / 2 - D.CREDITO_MARGEN * altoBloque)) < 1e-9, `debajo del bloque con margen ${D.CREDITO_MARGEN} × alto (${f(D.CREDITO_MARGEN * altoBloque, 3)} m)`);
  check(Math.abs((P.cx + P.ancho / 2) - (P.inkDerX + (M.texW - M.inkDer) * P.alto / M.texH)) < 1e-9, 'el plano incluye el margen de la textura (desenfoque) a la derecha de la tinta');
  const P2 = posicionCredito(anchoBloque * 1.3, altoBloque * 1.3, M, D.CREDITO_TAMANO, D.CREDITO_MARGEN);
  check(Math.abs(P2.inkDerX / P.inkDerX - 1.3) < 1e-9 && Math.abs(P2.inkAltoM / P.inkAltoM - 1.3) < 1e-9, 'acompaña al bloque: si el bloque crece 30 %, el crédito y su posición también');
  check(creditoDentroDelTelon(P, 4 + D.OFFSET_Y_M, D.OFFSET_X_M, S.curtainWidthM, S.curtainHeightM, anchoTinta), `dentro del telón (${S.curtainWidthM} × ${S.curtainHeightM} m): tinta de x ${f(P.inkDerX - anchoTinta)} a ${f(P.inkDerX)} m, y ${f(4 + P.inkAbajoY)} a ${f(4 + P.inkArribaY)} m`);
  const P3 = posicionCredito(anchoBloque, altoBloque, M, 0.4, 0.5);
  check(creditoDentroDelTelon(P3, 4, 0, S.curtainWidthM, S.curtainHeightM, (M.inkDer - 96) * (P3.alto / M.texH)), 'también con los máximos del menú (tamaño 0,4, margen 0,5)');
  // tamaño aparente desde el inicio (spawn: curtainDistM + INICIO_RETROCESO_M del telón, ojos a 1,6 m) a 1440 × 900, fov 90
  const dist = Math.hypot(S.curtainDistM + I.INICIO_RETROCESO_M, 4 - 1.6);
  const pxBloque = alturaAparentePx(altoBloque, dist, 90, 900), pxCap = alturaAparentePx(D.CREDITO_TAMANO * altoBloque, dist, 90, 900);
  console.log(`    desde el inicio (${f(dist)} m): bloque ${f(anchoBloque)} × ${f(altoBloque)} m → ${f(pxBloque, 1)} px de alto; crédito: mayúscula ${f(pxCap, 1)} px, tinta ${f(alturaAparentePx(P.inkAltoM, dist, 90, 900), 1)} px`);
  console.log(`    con lo pedido (5–8 % del bloque) la mayúscula mediría ${f(alturaAparentePx(0.05 * altoBloque, dist, 90, 900), 1)}–${f(alturaAparentePx(0.08 * altoBloque, dist, 90, 900), 1)} px`);
  check(pxCap >= 8 && pxCap <= 0.3 * pxBloque, `se lee sin competir: mayúscula ≥ 8 px y ≤ 30 % del alto del título (${f(pxCap, 1)} de ${f(pxBloque, 1)} px)`);
}

console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
