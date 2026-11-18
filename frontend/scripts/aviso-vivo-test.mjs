// Z85: prueba del aviso de la sesión en vivo (lib/avisoVivo.ts): una sola vez por sesión, cada opción, sin sesión no
// aparece, persistencia; el .ink compilado (texto exacto, 3 opciones, efectos) recorrido con el runtime de inkjs; y que
// abrir el aviso NO cuente como visita de la luz (Z76). Uso: node scripts/aviso-vivo-test.mjs
import fs from 'node:fs';
import { Story } from 'inkjs';
import {
  crearAviso, debeAbrir, marcarAbierto, aplicarDecision, reiniciarAviso, requiereAceptacion, dentroDelRadio,
  serializarAviso, restaurarAviso, EFECTO_A_DECISION,
} from '../lib/avisoVivo.ts';
import { crearEstadoHuida, registrarVisita, movimientosRestantes } from '../lib/luzHuida.ts';

const leer = f => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
const src = leer('../lib/debugConfig.ts');
const obj = n => Function(`return (${new RegExp(`export const ${n} = (\\{[\\s\\S]*?\\n\\});`).exec(src)[1].replace(/ as string \| number/g, '').replace(/ as string/g, '')});`)();
const A = obj('DBG_AVISO_VIVO'), M = obj('DBG_MONO_VIVO');
let ok = 0, fallas = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓ ' + m); } else { fallas++; console.log('  ✗ ' + m); } };
const TEXTO = 'Estás a punto de recibir una transmisión de otra conciencia creativa. ¿Querés aceptarla?';

console.log('\nconfiguración');
check(A.ACTIVO === true && A.SOLO_UNA_VEZ === true, 'ACTIVO y SOLO_UNA_VEZ en true por defecto');
check(M.REQUIERE_ACEPTACION === false, 'REQUIERE_ACEPTACION de Z82 sigue en false por defecto (el aviso la pone en true con sesión pendiente)');

console.log('\ncuándo aparece');
{
  const st = crearAviso();
  check(!debeAbrir(st, A, { haySesion: false, dentro: true, terminalOcupada: false }), 'sin sesión no aparece (la estática no es una transmisión)');
  check(!debeAbrir(st, A, { haySesion: true, dentro: false, terminalOcupada: false }), 'con sesión pero lejos de los monolitos: no aparece');
  check(debeAbrir(st, A, { haySesion: true, dentro: true, terminalOcupada: false }), 'con sesión, al entrar al radio de un monolito: aparece');
  check(!debeAbrir(crearAviso(), A, { haySesion: true, dentro: true, terminalOcupada: true }), 'si la terminal de la narrativa está abierta, espera');
  check(!debeAbrir(crearAviso(), { ...A, ACTIVO: false }, { haySesion: true, dentro: true, terminalOcupada: false }), 'ACTIVO = false: nunca (como antes)');
  check(dentroDelRadio('acercandose', 'lejos') && dentroDelRadio('lejos', 'cerca') && !dentroDelRadio('sosteniendo', 'retornando') && !dentroDelRadio('lejos', 'lejos'), 'radio: estados "acercandose" o "cerca" de cualquiera de los dos monolitos');
}

console.log('\nuna sola vez por sesión y cada opción');
for (const [d, req] of [['si', false], ['no', true], ['salir', true]]) {
  const st = crearAviso();
  debeAbrir(st, A, { haySesion: true, dentro: true, terminalOcupada: false }); marcarAbierto(st);
  check(st.abierto && !debeAbrir(st, A, { haySesion: true, dentro: true, terminalOcupada: false }), `${d}: abierto, no se reabre encima`);
  aplicarDecision(st, d);
  let otra = false;
  for (const dentro of [false, true, false, true]) if (debeAbrir(st, A, { haySesion: true, dentro, terminalOcupada: false })) otra = true;
  check(!otra, `${d}: no se vuelve a preguntar en la sesión (aunque entre y salga del radio)`);
  check(requiereAceptacion(st, A, true) === req, `${d}: la mezcla remota ${req ? 'sigue bloqueada' : 'queda habilitada'}`);
}
{
  const st = crearAviso(); marcarAbierto(st); aplicarDecision(st, 'no');
  const s2 = crearAviso(); check(restaurarAviso(s2, serializarAviso(st)) && s2.decision === 'no' && s2.mostrado, 'recargar: la decisión y "ya se mostró" vuelven de sessionStorage');
  check(!debeAbrir(s2, A, { haySesion: true, dentro: true, terminalOcupada: false }), 'tras recargar no vuelve a aparecer');
  check(!restaurarAviso(crearAviso(), '{roto') && !restaurarAviso(crearAviso(), null), 'texto vacío o roto: sin cambios');
  reiniciarAviso(s2); check(s2.decision === 'ninguna' && !s2.mostrado, '"Reiniciar decisión"');
}
{
  const st = crearAviso(), cfg = { ...A, SOLO_UNA_VEZ: false };
  let veces = 0;
  for (const dentro of [true, true, false, true, false, true]) if (debeAbrir(st, cfg, { haySesion: true, dentro, terminalOcupada: false })) { veces++; marcarAbierto(st); aplicarDecision(st, 'no'); }
  check(veces === 3, `SOLO_UNA_VEZ = false: pregunta en cada entrada al radio mientras no acepte (${veces})`);
}
check(requiereAceptacion(crearAviso(), A, false) === false, 'sin sesión no exige aceptación (la estática sigue como en Z82)');

console.log('\nel .ink del aviso (runtime de inkjs)');
{
  const json = leer('../public/alight/dialogo/aviso-vivo.json');
  const recorrer = i => { const s = new Story(json); let txt = ''; while (s.canContinue) txt += s.Continue(); const ops = s.currentChoices.map(c => c.text); s.ChooseChoiceIndex(i); let tags = []; while (s.canContinue) { s.Continue(); tags = tags.concat(s.currentTags); } return { txt: txt.trim(), ops, tags, fin: !s.canContinue && s.currentChoices.length === 0 }; };
  const r = recorrer(0);
  check(r.txt === TEXTO, 'texto exacto');
  check(r.ops.join(' | ') === 'Sí. | No. | Prefiero salir de acá.', `tres opciones: ${r.ops.join(' | ')}`);
  const efectos = [0, 1, 2].map(i => recorrer(i).tags.find(t => t.startsWith('efecto:'))?.split(':')[1].trim());
  check(efectos.join(',') === 'aviso_vivo_si,aviso_vivo_no,aviso_vivo_salir' && efectos.every(e => EFECTO_A_DECISION[e]), 'cada opción emite su efecto (aviso_vivo_si / no / salir)');
  check([0, 1, 2].every(i => recorrer(i).fin), 'cada opción termina el diálogo');
  const ef = leer('../lib/dialogo/efectosDialogo.ts');
  check(['aviso_vivo_si', 'aviso_vivo_no', 'aviso_vivo_salir'].every(n => ef.includes(`${n}:`)), 'los tres efectos están en el mapa de efectosDialogo (sin "efecto sin acción" en consola)');
}

console.log('\nno cuenta como visita de la luz (Z76)');
{
  const aviso = leer('../lib/avisoVivoAcciones.ts'), luz = leer('../components/LuzLejana.tsx');
  check(!/registrarVisitaLuz|registrarVisita\(|luzMovimiento/.test(aviso.replace(/\/\/.*$/gm, '')), 'el aviso no llama a registrarVisitaLuz ni toca el estado de la huida');
  check((luz.match(/registrarVisitaLuz\(\)/g) || []).length === 1 && /abrirDialogo\(\);\s*\/\/[^\n]*\n\s*registrarVisitaLuz\(\);/.test(luz), 'la visita solo se registra en LuzLejana al abrir SU terminal (fase "girando" → "dialogo")');
  check(/if \(LUZ_STATE\.fase !== "dialogo"\) return;/.test(luz) && /if \(LUZ_STATE\.fase !== "girando" && LUZ_STATE\.fase !== "dialogo"\) return;/.test(luz), 'los listeners de fin/cierre de la luz ignoran otras terminales (luz en fase "libre")');
  // simulación: abrir y cerrar el aviso 5 veces no cambia el contador; una visita real sí
  const H = crearEstadoHuida(1); const cfg = obj('DBG_LUZ_MOV');
  const st = crearAviso();
  for (let i = 0; i < 5; i++) { marcarAbierto(st); aplicarDecision(st, 'no'); reiniciarAviso(st); }
  check(H.visitas === 0 && movimientosRestantes(H) === 0, 'abrir el aviso 5 veces: visitas de la luz siguen en 0');
  registrarVisita(H, cfg);
  check(H.visitas === 1, 'control: una visita real a la luz sí suma');
  const term = leer('../components/DialogoTerminal.tsx');
  check(/abrir\(d\?\.knot, d\?\.fuente \|\| RUTA_DIALOGO_LUZ\)/.test(term), 'la terminal sigue abriendo el diálogo de la luz por defecto (sin fuente)');
}

console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
