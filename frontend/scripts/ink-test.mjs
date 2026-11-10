// scripts/ink-test.mjs — Z26: recorre el diálogo del camino LUZ con el RUNTIME (vía el wrapper
// lib/dialogo/dialogoInk.ts) y verifica textos, opciones y tags. Uso: npm run ink:test
// (requiere haber corrido npm run ink:build). Node ≥ 22.6 ejecuta el .ts quitando los tipos.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearDialogo } from '../lib/dialogo/dialogoInk.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const json = fs.readFileSync(path.join(root, 'public/alight/dialogo/dialogo-luz.json'), 'utf8');

let fallas = 0, ok = 0;
const check = (cond, msg) => { if (cond) { ok++; console.log('  ✓ ' + msg); } else { fallas++; console.log('  ✗ ' + msg); } };
const opcionesSon = (p, esperadas) => JSON.stringify(p.opciones.map(o => o.texto)) === JSON.stringify(esperadas);

function caso(nombre, fn) { console.log(`\n${nombre}`); fn(crearDialogo(json)); }

caso('1 → Sí (1.a, efecto juego_alarma)', d => {
  const p1 = d.iniciar();
  check(p1.texto === '¿No es suficiente?' && p1.tags.id === '1' && p1.tags.estado === 'cerrado', '1: texto y tags');
  check(opcionesSon(p1, ['Sí.', 'No.', 'A veces.', '¿Para vos sí?']), '1: cuatro opciones');
  const p = d.elegir(0);
  check(p.texto === 'Quizás la luz no es para vos.', '1.a: texto plano sin marcas');
  check(JSON.stringify(p.segmentos) === JSON.stringify([{ texto: 'Quizás la ', estilo: 'normal' }, { texto: 'luz', estilo: 'cursiva' }, { texto: ' no es para vos.', estilo: 'normal' }]), '1.a: *luz* en cursiva');
  check(p.tags.id === '1.a' && p.tags.efecto === 'juego_alarma' && p.terminado, '1.a: efecto juego_alarma y terminado');
});

caso('1 → A veces → Si (reutiliza 1.a)', d => {
  d.iniciar();
  const pc = d.elegir(2);
  check(pc.tags.id === '1.c' && pc.texto === '¿Crees que alguna vez va a ser suficiente?', '1.c: texto y tags');
  check(opcionesSon(pc, ['Si.', 'No.', 'No tendría por qué serlo.', '¿Vos también te diste cuenta, no?']), '1.c: opciones');
  const p = d.elegir(0);
  check(p.tags.id === '1.a' && p.tags.efecto === 'juego_alarma', '1.c → Si → 1.a (mismo knot)');
});

caso('1 → A veces → No (vuelve a 1.b)', d => {
  d.iniciar(); d.elegir(2);
  const p = d.elegir(1);
  check(p.tags.id === '1.b' && p.texto === '¿Qué estás buscando?', '1.c → No → 1.b');
  check(opcionesSon(p, ['Entretenerme.', 'Que me entiendan.', 'Saber más.', 'Entender de qué va todo esto.']), '1.b: opciones');
});

caso('1 → No → Entretenerme (1.b.a, efecto ir_tarima_sin_publico, sin texto)', d => {
  d.iniciar(); d.elegir(1);
  const p = d.elegir(0);
  check(p.texto === '' && p.segmentos.length === 0, '1.b.a: texto vacío');
  check(p.tags.id === '1.b.a' && p.tags.efecto === 'ir_tarima_sin_publico' && p.terminado, '1.b.a: efecto y terminado');
});

caso('1 → ¿Para vos sí? → No sé de qué estas hablando (1.d.a pendiente)', d => {
  d.iniciar();
  const pd = d.elegir(3);
  check(pd.tags.id === '1.d' && pd.texto === 'Yo creo que nos motiva lo mismo entonces.', '1.d: texto y tags');
  const neg = pd.opciones[1];
  check(neg.texto === 'Nada nunca es suficiente.' && neg.segmentos.some(s => s.estilo === 'negrita' && s.texto === 'suficiente'), '1.d: opción con **suficiente** en negrita');
  const p = d.elegir(0);
  check(p.tags.id === '1.d.a' && p.tags.estado === 'pendiente' && p.texto === '' && p.terminado, '1.d.a: pendiente, sin texto, terminado');
});

caso("irA('premio_otorgado') deja premio = true", d => {
  d.iniciar();
  check(d.leerPremio() === false, 'premio arranca en false');
  const p = d.irA('premio_otorgado');
  check(p.tags.id === '1.a.premio' && p.tags.efecto === 'premio_otorgado', 'premio_otorgado: tags');
  check(p.texto === 'Quizás tenés otras habilidades o mucha curiosidad.', 'premio_otorgado: texto');
  check(d.leerPremio() === true, 'premio = true');
  d.escribirPremio(false);
  check(d.leerPremio() === false, 'escribirPremio(false) funciona');
});

console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
