// Z81: (A) una acción por pulsación en los botones de los atriles: réplica de setCtrl y de los flujos del
// InteractionHandler (clic, tecla Z–M, mantener apretado) con lib/atrilesClick.ts; (B) altura del pedestal de los slots.
// Uso: node scripts/atriles-click-test.mjs
import fs from 'node:fs';
import { activaAccion } from '../lib/atrilesClick.ts';
import { alturaPedestal, slotsInstrumentos } from '../lib/playTarima.ts';

const leer = f => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
const src = leer('../lib/debugConfig.ts');
const obj = n => Function(`return (${new RegExp(`export const ${n} = (\\{[\\s\\S]*?\\n\\});`).exec(src)[1].replace(/ as string \| number/g, '').replace(/ as string/g, '')});`)();
const P = obj('DBG_PLAY');
let ok = 0, fallas = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓ ' + m); } else { fallas++; console.log('  ✗ ' + m); } };

// ── réplica de LecternSystem: setCtrl + flujos del InteractionHandler, con un reloj de timers simulado ──
function banco(clickUnico) {
  const estado = {}, timers = [];
  let t = 0;
  const setCtrl = (def, v) => {
    estado[def.id] = Math.max(def.min, Math.min(def.max, v));
    if (activaAccion(def.type, estado[def.id], clickUnico)) def.onActivate(estado[def.id]);
  };
  const enMs = (ms, fn) => timers.push({ t: t + ms, fn });
  const avanzar = ms => { const fin = t + ms; for (;;) { timers.sort((a, b) => a.t - b.t); const x = timers[0]; if (!x || x.t > fin) break; timers.shift(); t = x.t; x.fn(); } t = fin; };
  // clic de botón (pointerdown → 1, 120 ms → 0) y de interruptor (alterna)
  const clic = def => {
    if (def.type === 'toggle') setCtrl(def, (estado[def.id] ?? def.initial) > 0.5 ? 0 : 1);
    else { setCtrl(def, 1); enMs(120, () => setCtrl(def, 0)); }
  };
  // mantener apretado (LUZ − / LUZ +): cada 120 ms otra subida y bajada a los 60 ms, hasta soltar
  const mantener = (def, ms) => {
    setCtrl(def, 1); enMs(120, () => setCtrl(def, 0));
    let corriendo = true;
    const rep = () => { if (!corriendo) return; setCtrl(def, 1); enMs(60, () => setCtrl(def, 0)); enMs(120, rep); };
    enMs(120, rep);
    enMs(ms, () => { corriendo = false; });
  };
  const tecla = clic;   // atajos Z–M: mismo patrón (1, y 0 a los 120 ms)
  return { estado, setCtrl, clic, mantener, tecla, avanzar };
}
const contador = (id, type = 'button', min = 0, max = 1) => { const c = { n: 0, valores: [] }; return { c, def: { id, type, min, max, initial: 0, onActivate: v => { c.n++; c.valores.push(v); } } }; };

console.log('\nbandera');
check(P.CLICK_UNICO === true, 'DBG_PLAY.CLICK_UNICO true por defecto');

console.log('\nbotones: una acción por pulsación');
for (const id of ['s_prev', 's_next', 's_lfo_wf', 's_lfo_tg', 'dom_nxt', 'dom_star']) {
  const b = banco(true), { c, def } = contador(id);
  b.clic(def); b.avanzar(500); b.clic(def); b.avanzar(500);
  check(c.n === 2 && c.valores.every(v => v === 1), `${id}: 2 clics → 2 acciones (antes 4)`);
}
{
  const b = banco(false), { c, def } = contador('s_next');
  b.clic(def); b.avanzar(500);
  check(c.n === 2, 'con CLICK_UNICO = false vuelve el doble disparo anterior (1 clic → 2 acciones)');
}
{
  // SIG.: con la lista de pistas, un clic avanza una sola pista
  let pista = 0; const b = banco(true);
  const def = { id: 's_next', type: 'button', min: 0, max: 1, initial: 0, onActivate: () => { pista = (pista + 1) % 5; } };
  b.clic(def); b.avanzar(300);
  check(pista === 1, 'SIG. salta una sola pista');
  let ondaIdx = 0; const onda = { id: 's_lfo_wf', type: 'button', min: 0, max: 1, initial: 0, onActivate: () => { ondaIdx = (ondaIdx + 1) % 4; } };
  b.clic(onda); b.avanzar(300); b.clic(onda); b.avanzar(300);
  check(ondaIdx === 2, 'ONDA del LFO: 2 clics → 2 formas de onda más (seno → triángulo → cuadrada)');
  let luces = 0; const star = { id: 'dom_star', type: 'button', min: 0, max: 1, initial: 0, onActivate: () => { luces++; } };
  b.clic(star); b.avanzar(300);
  check(luces === 1, 'LUZ * agrega una sola luz');
}
{
  const b = banco(true), { c, def } = contador('s_next');
  b.tecla(def); b.avanzar(300);
  check(c.n === 1, 'atajo de teclado (Z–M): una acción por tecla');
  check(b.estado[def.id] === 0, 'el botón vuelve a reposo (animación de soltar intacta)');
}

console.log('\nmantener apretado (LUZ − / LUZ +)');
{
  const b = banco(true), { c, def } = contador('dom_plus');
  b.mantener(def, 1000); b.avanzar(1500);
  check(c.n === 9, `mantener 1 s: 1 al apretar + 8 repeticiones = ${c.n} pasos (antes ${9 * 2})`);
  const b2 = banco(false), x = contador('dom_plus');
  b2.mantener(x.def, 1000); b2.avanzar(1500);
  check(x.c.n === 18, 'con CLICK_UNICO = false: el doble anterior (18)');
}

console.log('\ncontroles que necesitan cada cambio (sin cambios)');
{
  const b = banco(true), tog = contador('s_lp_on', 'toggle');
  b.clic(tog.def); b.clic(tog.def); b.clic(tog.def);
  check(tog.c.n === 3 && tog.c.valores.join(',') === '1,0,1', 'interruptor: cada clic actúa con su valor nuevo (1, 0, 1)');
  const k = contador('s_lp_fr', 'knob', 200, 20000);
  for (let i = 0; i < 10; i++) b.setCtrl(k.def, 200 + i * 1000);
  check(k.c.n === 10 && k.c.valores[0] === 200, 'perilla: cada paso del arrastre actúa (10 de 10), incluido el mínimo');
  const s = contador('s_vol', 'slider', 0, 1);
  for (const v of [0.8, 0.5, 0, 0.3]) b.setCtrl(s.def, v);
  check(s.c.n === 4 && s.c.valores.includes(0), 'deslizador: cada valor actúa, también el 0 (volumen a cero)');
  const sup = contador('r_disco', 'superficie');
  b.setCtrl(sup.def, 0);
  check(sup.c.n === 1, 'otros tipos (superficie de la caja de ritmos): sin cambios');
}

console.log('\nlugar común (LecternSystem.setCtrl) y botones que ya filtraban');
{
  const ls = leer('../components/LecternSystem.tsx');
  check(/if \(activaAccion\(def\.type, ctrlState\[id\], DBG_PLAY\.CLICK_UNICO\)\) def\.onActivate\(ctrlState\[id\]\);/.test(ls), 'setCtrl filtra con activaAccion (un solo lugar, no botón por botón)');
  check((ls.match(/def\.onActivate\(/g) || []).length === 1, 'no hay otras llamadas directas a onActivate');
  const pt = leer('../components/PlayTarima.tsx'), cr = leer('../components/CajaRitmos.tsx');
  check(/onActivate: \(v: number\) => \{ if \(v > 0\.5\)/.test(pt) && /onActivate: \(v: number\) => \{ if \(v > 0\.5\) borrarRitmos/.test(cr), 'PLAY grande (Z79) y BORRAR/PLAY de la caja (Z80) siguen correctos con la regla');
}

console.log('\npedestal de los slots');
{
  const H = 0.267, MEDIA = 3.192 / 2, ATRIL_X = 1.3 + 0.30;
  check(P.SLOTS_PEDESTAL === true && P.SLOTS_PEDESTAL_ALTURA_M === 'auto', 'SLOTS_PEDESTAL true y altura "auto" por defecto');
  const slots = slotsInstrumentos(P, ATRIL_X, MEDIA, H);
  const ped = alturaPedestal(P, slots[0].y, H);
  check(!slots[0].sobreTarima && slots[0].y === 0 && Math.abs(ped - H) < 1e-12, `slot en el piso: pedestal de ${(ped * 100).toFixed(1)} cm (= alto de la tarima)`);
  check(Math.abs(slots[0].y + ped - H) < 1e-12, 'el atril sobre el pedestal queda a la misma altura que el atril de sonido sobre la tarima');
  check(alturaPedestal(P, H, H) === 0, 'slot sobre la tarima: sin pedestal');
  check(alturaPedestal({ ...P, SLOTS_PEDESTAL: false }, 0, H) === 0, 'SLOTS_PEDESTAL = false: sin pedestal (como Z79/Z80)');
  check(alturaPedestal({ ...P, SLOTS_PEDESTAL_ALTURA_M: 0.4 }, 0, H) === 0.4 && alturaPedestal({ ...P, SLOTS_PEDESTAL_ALTURA_M: -1 }, 0, H) === 0 && alturaPedestal({ ...P, SLOTS_PEDESTAL_ALTURA_M: 9 }, 0, H) === 1.5, 'altura fija en metros, acotada a 0…1,5');
  // salida del piso de la caja de ritmos: y = slot.y + ped + lerp(−1,6 − ped, 0, ease): arranca 1,6 m bajo el piso y termina sobre el pedestal
  const yCaja = e => slots[1].y + ped + (-1.6 - ped) * (1 - e);
  check(Math.abs(yCaja(0) - (slots[1].y - 1.6)) < 1e-12 && Math.abs(yCaja(1) - H) < 1e-12, 'la caja de ritmos sale del piso desde −1,6 m (como los atriles) y termina a la altura de la tarima');
  const cr = leer('../components/CajaRitmos.tsx');
  check(cr.includes('raiz.position.set(slot.x, slot.y + ped + THREE.MathUtils.lerp(-1.6 - ped, 0, ease), slot.z)'), 'CajaRitmos usa esa fórmula y el pedestal va dentro del cuerpo que sube');
}

console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
