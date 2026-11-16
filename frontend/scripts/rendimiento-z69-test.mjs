// Z69: prueba de la lógica de optimización y medición. Uso (en frontend/): node scripts/rendimiento-z69-test.mjs
//  · plan del bloom liviano (con escala 1 y 5 niveles = UnrealBloomPass; perfil del halo; costo estimado)
//  · pases finales (cantidad y ancho de banda a DPR 1,5), transformación del shader del CRT para el pase fusionado
//  · tiempo de GPU por pase con un gl simulado (consultas secuenciales, fractal dentro de la escena)
//  · estimador de refresco (60, 120, 144 Hz), cuantización, ruido, ida y vuelta, aviso de canvas chico
//  · perfiles de calidad (aplicar, guardar, leer con almacenamiento bloqueado) y franjas del fractal
import { planBloom, paresKernel, sigmasUnreal, costoBloom, pasesFinales, PRESETS_BLOOM, aplicarCalidadBloom,
  PERFILES, aplicarPerfil, leerPerfil, guardarPerfil, CLAVE_PERFIL } from '../lib/rendimientoPost.ts';
import { estimarRefrescoIntervalos, cuantizacion, esRuido, pasosBench, pasosBenchIdaVuelta, combinarIdaVuelta, reporteBench,
  avisoCanvas, SISTEMAS } from '../lib/rendimiento.ts';
import { franjasFractal, filaFranja } from '../lib/prisma/fractalTextura.ts';
import { transformarCRT } from '../lib/retro/paseFinalTexto.ts';
import { RetroCRTShader } from '../lib/retro/retroCRT.ts';
import { GPU_PASES, E_GPU, iniciarGpuPases, liberarGpuPases, medirIni, medirFin, finCuadroGpu, resumirGpu, contarFractal } from '../lib/gpuPases.ts';

let ok = 0, fallas = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓ ' + m); } else { fallas++; console.log('  ✗ ' + m); } };
const f = (n, d = 2) => Number(n).toFixed(d);
const cerca = (a, b, t) => Math.abs(a - b) <= t;

// ── bloom ──
console.log('\nbloom');
{
  const S = sigmasUnreal();
  console.log(`    σ acumulado del Unreal (px): ${S.map(v => f(v, 1)).join(', ')}`);
  const alta = planBloom(1, 5, 0.5);
  check(alta.map(n => n.kernel).join() === '6,10,14,18,22' && alta.map(n => n.divisor).join() === '2,4,8,16,32',
    'escala 1 · 5 niveles = UnrealBloomPass (kernels 6…22, divisores 2…32)');
  check(alta.every(n => cerca(n.peso, 0.6, 1e-9)), 'pesos del Unreal con radio 0,5: 0,6 cada nivel');
  for (const [nombre, p] of Object.entries(PRESETS_BLOOM)) {
    const pl = planBloom(p.escala, p.niveles, 0.5);
    const suma = pl.reduce((a, n) => a + n.peso, 0);
    console.log(`    ${nombre}: ${pl.map(n => `÷${f(n.divisor, 1)} K${n.kernel} σ${f(n.sigmaPx, 0)}px w${f(n.peso)}`).join(' | ')}`);
    check(cerca(suma, 3, 1e-9), `${nombre}: la suma de pesos (energía del halo) se conserva (${f(suma)})`);
    check(pl.every((n, i) => i === 0 || n.divisor >= pl[i - 1].divisor) && pl.every(n => n.kernel >= 2 && n.kernel <= 24),
      `${nombre}: divisores crecientes y kernels entre 2 y 24`);
  }
  // perfil radial del halo (suma de gaussianas 2D normalizadas): diferencia relativa respecto del Unreal
  const perfil = (pl, r) => pl.reduce((a, n) => a + n.peso * Math.exp(-r * r / (2 * n.sigmaPx ** 2)) / (2 * Math.PI * n.sigmaPx ** 2), 0);
  const ref = alta;
  for (const [nombre, esc, niv, tope] of [['0,5 · 3 niveles (lo pedido)', 0.5, 3, 0.4], ['baja (0,35 · 3)', 0.35, 3, 0.4], ['media (0,5 · 4, default)', 0.5, 4, 0.15]]) {
    const pl = planBloom(esc, niv, 0.5);
    let num = 0, den = 0, maxRel = 0;
    for (let r = 0; r <= 600; r += 1) {
      const a = perfil(ref, r) * r, b = perfil(pl, r) * r;   // × r: peso del anillo
      num += Math.abs(a - b); den += a;
      if (r >= 2 && r <= 300) maxRel = Math.max(maxRel, Math.abs(perfil(pl, r) / perfil(ref, r) - 1));
    }
    console.log(`    ${nombre}: diferencia del halo (L1 por anillos) ${f(100 * num / den, 1)} % · máx. local entre 2 y 300 px ${f(100 * maxRel, 0)} %`);
    check(num / den < tope, `${nombre}: diferencia del halo menor que ${tope * 100} % (con 3 niveles no baja de ~28 % ni optimizando posiciones y pesos; con 4, ~12 %)`);
  }
  const cU = costoBloom(null, 1, false);
  const cM = costoBloom(planBloom(0.5, 4, 0.5), 0.5, true), cMs = costoBloom(planBloom(0.5, 4, 0.5), 0.5, false);
  const cB = costoBloom(planBloom(0.35, 3, 0.5), 0.35, true), c4 = costoBloom(planBloom(0.5, 3, 0.5), 0.5, true);
  console.log(`    costo por píxel del canvas — Unreal: ${f(cU.lecturas)} lecturas, ${f(cU.fragmentos)} fragmentos, ${cU.pases} pases`);
  console.log(`                                 media fusionado: ${f(cM.lecturas)} lecturas (3 en el pase final), ${f(cM.fragmentos, 3)} fragmentos, ${cM.pases} pases`);
  console.log(`                                 media separado: ${f(cMs.lecturas)} lecturas, ${f(cMs.fragmentos, 3)} fragmentos · baja fusionado: ${f(cB.lecturas)} / ${f(cB.fragmentos, 3)} · 0,5 · 3 niveles fusionado: ${f(c4.lecturas)} / ${f(c4.fragmentos, 3)}, ${c4.pases} pases`);
  check(cMs.lecturas < 0.5 * cU.lecturas && cM.fragmentos < 0.5 * cU.fragmentos, 'media: menos de la mitad de lecturas y de fragmentos que el Unreal');
  // kernel por pares: misma suma de pesos y mismo primer momento que las lecturas de a una
  for (const K of [2, 3, 6, 15, 22, 24]) {
    const p = paresKernel(K), sigma = K / 3;
    const c = Array.from({ length: K }, (_, i) => 0.39894 * Math.exp(-0.5 * i * i / (sigma * sigma)) / sigma);
    const s1 = c.slice(1).reduce((a, b) => a + b, 0), m1 = c.reduce((a, v, i) => a + v * i, 0);
    const s2 = p.pesos.reduce((a, b) => a + b, 0), m2 = p.pesos.reduce((a, w, i) => a + w * p.offs[i], 0);
    if (!(cerca(s1, s2, 1e-12) && cerca(m1, m2, 1e-9) && cerca(p.w0, c[0], 1e-12))) { check(false, `pares del kernel ${K}`); }
  }
  check(true, 'kernel por pares: mismos pesos y desplazamientos equivalentes (K 2…24); lecturas 1 + 2·pares');
  const cfg = { BLOOM_CALIDAD: 'media', BLOOM_ESCALA: 0.5, BLOOM_NIVELES: 3 };
  check(aplicarCalidadBloom(cfg, 'alta') && cfg.BLOOM_ESCALA === 1 && cfg.BLOOM_NIVELES === 5 && !aplicarCalidadBloom(cfg, 'xx'), 'presets alta/media/baja fijan escala y niveles');
}

// ── pases finales y shader fusionado ──
console.log('\npases finales');
{
  const sep = pasesFinales(false, 2160, 1350), fus = pasesFinales(true, 2160, 1350);
  console.log(`    DPR 1,5 en 1440×900 (2160×1350): separados ${sep.pases} pases, ${sep.bytesPx} B/px, ${f(sep.mbCuadro, 1)} MB/cuadro · fusionado ${fus.pases}, ${fus.bytesPx} B/px, ${f(fus.mbCuadro, 1)} MB/cuadro`);
  console.log(`    ahorro: ${sep.pases - fus.pases} pases de pantalla completa, ${f(sep.mbCuadro - fus.mbCuadro, 1)} MB/cuadro (${f((sep.mbCuadro - fus.mbCuadro) * 60 / 1000, 1)} GB/s a 60 FPS)`);
  check(fus.pases === 1 && sep.pases === 3 && fus.mbCuadro < sep.mbCuadro / 3, 'fusionado: 1 pase en vez de 3 y menos de un tercio del ancho de banda');
  const t = transformarCRT(RetroCRTShader.fragmentShader);
  check(t.conAA, 'el shader del CRT tiene el bloque de aberración cromática esperado (FXAA dentro del pase)');
  check(!t.codigo.includes('void main()') && t.codigo.includes('void crtMain()') && !t.codigo.includes('gl_FragColor') && !t.codigo.includes('texture2D(tDiffuse'),
    'transformación: main → crtMain, gl_FragColor → crtSalida, sin lecturas directas de tDiffuse');
  check((t.codigo.match(/escena\(/g) || []).length === 3 && t.codigo.includes('correccionAA(uv)'), '3 lecturas por escena() + corrección AA en el centro');
  // el resto del CRT queda idéntico (mismas operaciones de color)
  const quitar = s => s.replace(/\s+/g, ' ');
  const resto = quitar(RetroCRTShader.fragmentShader).split('col.b = texture2D(tDiffuse, uv - d * effCA * 2.0).b;')[1];
  check(quitar(t.codigo).includes(resto.trim().slice(0, 400)), 'después de las lecturas, el código del CRT queda idéntico (colores sin cambios)');
}

// ── GPU por pase (gl simulado) ──
console.log('\nGPU por pase');
{
  let reloj = 0, abierta = null; const res = new Map(); let disj = false, errores = 0;
  const gl = {
    QUERY_RESULT_AVAILABLE: 1, QUERY_RESULT: 2,
    createQuery: () => ({ id: Math.random() }), deleteQuery() {},
    beginQuery(_t, q) { if (abierta) errores++; abierta = { q, t0: reloj }; },
    endQuery() { if (!abierta) { errores++; return; } res.set(abierta.q, (reloj - abierta.t0) * 1e6); abierta = null; },
    getQueryParameter(q, p) { return p === 1 ? res.has(q) : res.get(q); },
    getParameter() { return disj; },
  };
  iniciarGpuPases(gl, { TIME_ELAPSED_EXT: 9, GPU_DISJOINT_EXT: 10 });
  GPU_PASES.activo = true;
  for (let c = 0; c < 10; c++) {
    medirIni(E_GPU.escena); reloj += 2;           // escena 2 ms
    medirIni(E_GPU.fractal); reloj += 0.5; medirFin(); contarFractal();   // fractal 0,5 ms en medio
    reloj += 1;                                   // escena 1 ms más
    medirFin();
    medirIni(E_GPU.bloom); reloj += 1.5; medirFin();
    medirIni(E_GPU.final); reloj += 0.7; medirFin();
    finCuadroGpu();
  }
  resumirGpu();
  check(errores === 0, 'nunca hay dos consultas abiertas a la vez (WebGL no permite anidarlas)');
  check(cerca(GPU_PASES.ms[E_GPU.escena], 3, 1e-9) && cerca(GPU_PASES.ms[E_GPU.fractal], 0.5, 1e-9), 'la escena suma sus dos tramos (3 ms) y el fractal se mide aparte (0,5 ms)');
  check(cerca(GPU_PASES.total, 5.7, 1e-9) && cerca(GPU_PASES.fractalPorActualizacion, 0.5, 1e-9), `suma por cuadro ${f(GPU_PASES.total)} ms = tiempo real; fractal 0,5 ms por actualización`);
  disj = true; medirIni(E_GPU.bloom); reloj += 9; medirFin(); finCuadroGpu(); resumirGpu();
  check(GPU_PASES.ms[E_GPU.bloom] === 0 && GPU_PASES.disjuntos === 1, 'cuadro disjunto: se descarta');
  GPU_PASES.activo = false; disj = false; medirIni(E_GPU.bloom); check(abierta === null, 'apagado: no abre consultas');
  liberarGpuPases();
}

// ── refresco ──
console.log('\nrefresco');
{
  const tmp = new Float64Array(4096);
  let s = 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const gen = (n, fn) => Float64Array.from({ length: n }, fn);
  const jit = () => (rnd() - 0.5) * 0.8;
  const casos = [
    ['60 Hz, cuadros de 16,7 ms con algunos de 33', gen(600, () => (rnd() < 0.9 ? 16.667 : 33.333) + jit()), 60],
    ['120 Hz con la escena a ~59 FPS (16,7 ms y algunos de 8,3 y 25)', gen(600, () => { const u = rnd(); return (u < 0.8 ? 16.667 : u < 0.9 ? 8.333 : 25) + jit(); }), 120],
    ['120 Hz con DPR 0,5 (112 FPS: 8,3 y algunos de 16,7)', gen(600, () => (rnd() < 0.93 ? 8.333 : 16.667) + jit()), 120],
    ['144 Hz', gen(600, () => (rnd() < 0.9 ? 6.944 : 13.889) + jit() * 0.5), 144],
  ];
  for (const [nombre, ms, esperado] of casos) {
    const e = estimarRefrescoIntervalos(ms, ms.length, tmp);
    check(e.hz === esperado, `${nombre}: ${e.hz} Hz (grilla ${e.grilla}, mínimos ${e.minimos})`);
  }
  const ambiguo = gen(600, () => 16.667 + jit());
  const ea = estimarRefrescoIntervalos(ambiguo, ambiguo.length, tmp);
  console.log(`    120 Hz con TODOS los cuadros a 16,7 ms no se distingue de 60 Hz: estima ${ea.hz} (por eso el host guarda el mayor de la sesión)`);
  check(cuantizacion(120).join() === '120,60,40,30' && cuantizacion(60).join() === '60,30,20,15', 'cuantización: 120 → 120, 60, 40, 30 FPS; 60 → 60, 30, 20, 15');
  check(estimarRefrescoIntervalos(new Float64Array(10), 10, tmp).hz === 60, 'pocas muestras: 60 por defecto');
}

// ── benchmark: ida y vuelta, ruido, reporte ──
console.log('\nbenchmark');
{
  const ida = pasosBench(SISTEMAS), iv = pasosBenchIdaVuelta(SISTEMAS);
  check(iv.length === 2 * ida.length && iv[0].id === 'base' && iv[iv.length - 1].id === 'base' && iv[ida.length].id === ida[ida.length - 1].id,
    `ida y vuelta: ${iv.length} pasos (la vuelta en orden inverso; la base al principio y al final)`);
  const mk = (id, tipo, media, gpu) => ({ paso: { tipo, id, etiqueta: id === 'base' ? 'línea base' : `sin ${id}`, dpr: 0 }, media, p95: media + 3, fps: 1000 / media, gpu, n: 200 });
  const res = [mk('base', 'base', 16.8, 26.4), mk('bloom', 'sistema', 16.7, 13.2), mk('flare', 'sistema', 16.75, 26.3), mk('flare', 'sistema', 16.65, 26.1), mk('bloom', 'sistema', 16.6, 13.4), mk('base', 'base', 16.9, 26.2)];
  const comb = combinarIdaVuelta(res);
  check(comb.length === 3 && cerca(comb[0].media, 16.85, 1e-9) && cerca(comb[1].dif, 0.1, 1e-9) && comb[1].vueltas === 2, 'combinar: promedia ida y vuelta y guarda la diferencia');
  check(esRuido(0.3) && !esRuido(0.5) && esRuido(-0.2), 'ruido: |diferencia| < 0,4 ms');
  const txt = reporteBench(comb, { gpu: 'Apple M3', dpr: 1.5, px: '756×430', refrescoHz: 120, timerGpu: true, escena: 'prueba', canvasW: 756, canvasH: 430, metodoRefresco: 'prueba', gpuPases: 'escena 3 · bloom 1' });
  console.log(txt.split('\n').map(l => '    | ' + l).join('\n'));
  const lineaFlare = txt.split('\n').find(l => l.startsWith('sin flare')), lineaBloom = txt.split('\n').find(l => l.startsWith('sin bloom'));
  // Z72: la GPU es secundaria; si su ganancia difiere más de 3× de la de rAF se marca "GPU no fiable" (antes "GPU sí")
  check(lineaFlare.endsWith(' ruido') && !lineaFlare.includes('no fiable') && lineaBloom.includes('GPU no fiable'), 'reporte: el flare (0,15 ms y 0,1 GPU) es ruido; el bloom (0,2 ms de rAF y 13 de GPU) marca "GPU no fiable" (Z72)');
  check(txt.includes('120, 60, 40, 30') && txt.includes('AVISO: el canvas medido') && !txt.includes('vsync)'), 'reporte: cuantización a 120 Hz, aviso de canvas chico y sin el aviso de vsync equivocado');
  check(avisoCanvas(1920, 1080) === '' && avisoCanvas(756, 430) !== '', 'aviso de canvas: < 1 Mpx');
}

// ── perfiles y franjas ──
console.log('\nperfiles de calidad');
{
  const rend = { DPR_MAX: 1.5, BLOOM_CALIDAD: 'media', BLOOM_ESCALA: 0.5, BLOOM_NIVELES: 3, ANTIALIAS_MODO: 'fxaa' };
  const pasto = { CAPAS: 20 }, fractal = { TEX_FPS: 30 };
  for (const [n, p] of Object.entries(PERFILES)) {
    aplicarPerfil(n, rend, pasto, fractal);
    check(rend.DPR_MAX === p.DPR_MAX && pasto.CAPAS === p.CAPAS && fractal.TEX_FPS === p.TEX_FPS && rend.BLOOM_CALIDAD === p.BLOOM_CALIDAD
      && rend.BLOOM_ESCALA === PRESETS_BLOOM[p.BLOOM_CALIDAD].escala && rend.ANTIALIAS_MODO === p.ANTIALIAS_MODO,
      `perfil ${n}: DPR_MAX ${p.DPR_MAX} · capas ${p.CAPAS} · bloom ${p.BLOOM_CALIDAD} · fractal ${p.TEX_FPS} FPS · AA ${p.ANTIALIAS_MODO}`);
  }
  check(!aplicarPerfil('ultra', rend, pasto, fractal), 'perfil inexistente: no cambia nada');
  const mem = {}; const st = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = v; } };
  check(leerPerfil(st) === null && guardarPerfil(st, 'media') && leerPerfil(st) === 'media' && mem[CLAVE_PERFIL] === 'media', 'guardar y leer (sin nada guardado → null: quedan los valores por defecto)');
  const roto = { getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('bloqueado'); } };
  check(leerPerfil(roto) === null && guardarPerfil(roto, 'alta') === false && leerPerfil(null) === null, 'almacenamiento bloqueado o ausente: sin errores');
  mem[CLAVE_PERFIL] = 'cualquiera'; check(leerPerfil(st) === null, 'valor guardado inválido: se ignora');
}
console.log('\nfractal en franjas');
{
  check(franjasFractal(30, 1 / 120, 4) === 4 && franjasFractal(30, 1 / 60, 4) === 2 && franjasFractal(30, 1 / 118, 4) === 4,
    '30 act./s: 4 franjas a 120 Hz, 2 a 60 Hz (cabe en el período)');
  check(franjasFractal(0, 1 / 120, 4) === 1 && franjasFractal(30, 1 / 120, 1) === 1 && franjasFractal(30, 0, 4) === 1 && franjasFractal(20, 1 / 120, 8) === 6,
    'TEX_FPS 0 o TEX_REPARTIR 1: una franja (como antes); 20 act./s a 120 Hz: hasta 6');
  let okF = true;
  for (const [n, res] of [[1, 512], [3, 1024], [4, 1024], [6, 768], [7, 100]]) {
    let prev = 0;
    for (let i = 0; i < n; i++) { const a = filaFranja(i, n, res), b = filaFranja(i + 1, n, res); if (a !== prev || b <= a) okF = false; prev = b; }
    if (prev !== res) okF = false;
  }
  check(okF, 'las franjas cubren todas las filas sin huecos ni solapes');
}

console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
