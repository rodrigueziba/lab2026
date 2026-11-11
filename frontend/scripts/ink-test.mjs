// scripts/ink-test.mjs — Z26: recorre el diálogo del camino LUZ con el RUNTIME (vía el wrapper
// lib/dialogo/dialogoInk.ts) y verifica textos, opciones y tags. Uso: npm run ink:test
// (requiere haber corrido npm run ink:build). Node ≥ 22.6 ejecuta el .ts quitando los tipos.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearDialogo } from '../lib/dialogo/dialogoInk.ts';
import { planDePaso, lineaEco, TEXTO_FIN, accionTecla, moverSel } from '../lib/dialogo/terminalFlujo.ts'; // Z27 · Z35

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

// ── Z27: lógica de la terminal (lib/dialogo/terminalFlujo.ts) ──
const textoLinea = l => l.segmentos.map(x => x.texto).join('');
caso('Z27 terminal: 1 → A veces → No (eco y vuelta a 1.b)', d => {
  const p1 = planDePaso(d.iniciar(), false);
  check(p1.lineas.length === 1 && p1.lineas[0].tipo === 'entidad' && !p1.fin && p1.opciones.length === 4, '1: una línea de entidad y 4 opciones');
  const eco = lineaEco(p1.opciones[2]);
  check(eco.tipo === 'eco' && textoLinea(eco) === '> A veces.', 'eco "> A veces."');
  const pc = planDePaso(d.elegir(p1.opciones[2].indice), false);
  check(pc.id === '1.c' && pc.opciones[1].texto === 'No.', '1.c con opción 2 = No.');
  const pb = planDePaso(d.elegir(pc.opciones[1].indice), false);
  check(pb.id === '1.b' && textoLinea(pb.lineas[0]) === '¿Qué estás buscando?' && !pb.fin, 'vuelve a 1.b');
});
caso('Z27 terminal: pendiente 1.d.a sin y con MARCAR_PENDIENTES', d => {
  d.iniciar(); d.elegir(3);
  const paso = d.elegir(0);
  const sin = planDePaso(paso, false);
  check(sin.fin && sin.lineas.length === 1 && sin.lineas[0].tipo === 'fin' && textoLinea(sin.lineas[0]) === TEXTO_FIN, 'sin marca: "[ fin de la transmisión ]" y fin');
  const con = planDePaso(paso, true);
  check(con.fin && con.lineas.length === 1 && textoLinea(con.lineas[0]) === '[LÍNEA PENDIENTE 1.d.a]', 'con marca: "[LÍNEA PENDIENTE 1.d.a]" y fin');
});
caso('Z27 terminal: 1.b.d pendiente CON texto (texto primero, después el cierre)', d => {
  d.iniciar(); d.elegir(1);
  const pl = planDePaso(d.elegir(3), false);
  check(pl.id === '1.b.d' && pl.lineas.length === 2 && pl.lineas[0].tipo === 'entidad' && pl.lineas[1].tipo === 'fin' && pl.fin, '1.b.d: entidad + fin');
});
caso('Z27 terminal: 1.b.a efecto sin texto', d => {
  d.iniciar(); d.elegir(1);
  const pl = planDePaso(d.elegir(0), false);
  check(pl.efecto === 'ir_tarima_sin_publico' && pl.id === '1.b.a' && pl.fin && pl.lineas.length === 1 && pl.lineas[0].tipo === 'fin', '1.b.a: efecto, fin, solo línea de cierre');
});
caso('Z27 terminal: 1.a efecto con texto en cursiva', d => {
  d.iniciar();
  const pl = planDePaso(d.elegir(0), false);
  check(pl.efecto === 'juego_alarma' && pl.lineas[0].segmentos.some(x => x.estilo === 'cursiva' && x.texto === 'luz') && pl.fin, '1.a: efecto juego_alarma, *luz*, fin');
});

// ── Z35: teclado de la terminal (terminalFlujo.accionTecla) ──
console.log('\nZ35 terminal: teclado');
const T = (code, key = '', repeat = false) => ({ code, key, repeat });
const A = (t, fase, n, sel) => accionTecla(t, fase, n, sel);
check(moverSel(0, -1, 4) === 3 && moverSel(3, 1, 4) === 0 && moverSel(1, 1, 4) === 2, 'moverSel: vuelta 1→última y última→1');
check(A(T('ArrowUp'), 'opciones', 4, 0).sel === 3, '↑ en la opción 1 → la última (índice 3)');
check(A(T('ArrowDown'), 'opciones', 4, 3).sel === 0, '↓ en la última → la primera');
check(A(T('KeyW', 'w'), 'opciones', 4, 2).sel === 1 && A(T('KeyS', 's'), 'opciones', 4, 2).sel === 3, 'W sube y S baja');
check(A(T('ArrowDown'), 'opciones', 2, 1).sel === 0, 'con 2 opciones también hay vuelta');
const enterEscr = A(T('Enter', 'Enter'), 'escribiendo', 0, 0);
check(enterEscr.tipo === 'completar' && enterEscr.consumir, 'Enter mientras se escribe → completar');
const enterOpc = A(T('Enter', 'Enter'), 'opciones', 4, 2);
check(enterOpc.tipo === 'elegir' && enterOpc.indice === 2, 'Enter con opciones → elige la resaltada (3)');
check(A(T('NumpadEnter', 'Enter'), 'opciones', 4, 1).indice === 1, 'Enter del teclado numérico también');
check(A(T('Enter', 'Enter'), 'fin', 0, 0).tipo === 'nada' && A(T('Enter', 'Enter'), 'fin', 0, 0).consumir, 'Enter en el fin: nada, pero se consume (no activa la navbar)');
const rep = ['ArrowUp', 'KeyS', 'Enter', 'Space', 'Digit2'].map(c => A(T(c, c === 'Space' ? ' ' : '', true), 'opciones', 4, 0));
check(rep.every(a => a.tipo === 'nada' && a.consumir), 'e.repeat: ninguna tecla repetida hace algo (y se consume)');
check(A(T('Digit1', '1'), 'opciones', 4, 3).indice === 0 && A(T('Numpad4', '4'), 'opciones', 4, 0).indice === 3, '1–4 directo (fila y numérico)');
check(A(T('Digit4', '4'), 'opciones', 3, 0).tipo === 'nada', '4 con 3 opciones: nada');
check(A(T('Digit2', '2'), 'escribiendo', 0, 0).tipo === 'nada', '1–4 mientras se escribe: nada');
const esp = A(T('Space', ' '), 'escribiendo', 0, 0);
check(esp.tipo === 'salir' && esp.consumir && A(T('Space', ' '), 'opciones', 4, 1).tipo === 'salir', 'Espacio sale (escribiendo y con opciones)');
const esc = A(T('Escape', 'Escape'), 'opciones', 4, 0);
check(esc.tipo === 'nada' && !esc.consumir, 'Escape: no hace nada y NO se intercepta (pointer lock nativo)');
const sh = A(T('ShiftLeft', 'Shift'), 'opciones', 4, 0);
check(sh.tipo === 'nada' && !sh.consumir, 'Shift: no se intercepta (menú debug)');
check(A(T('KeyW', 'w'), 'escribiendo', 0, 0).consumir && A(T('ArrowDown'), 'cargando', 0, 0).consumir, 'W/flechas se consumen aunque no haya opciones (no mueven ni scrollean)');
check(!A(T('KeyA', 'a'), 'opciones', 4, 0).consumir && !A(T('KeyD', 'd'), 'opciones', 4, 0).consumir, 'A y D no se interceptan');

console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
