# Brief visual: Cassette Futurism / Retro-futurismo 70s (three.js / WebGL)

Documento para pasarle a Claude Code. Tiene tres partes: (1) descripción precisa del estilo, (2) shaders y código base listos para adaptar, (3) recursos externos para importar.

---

## 0. Prompt resumido (pegar tal cual en Claude Code)

> Construí una capa visual en three.js con estética **cassette futurism de 1970–1985** (referencia: equipos de *Alien* 1979, Syd Mead, cartelería de cintas VHS/Beta). Hardware utilitario, voluminoso y gastado, no limpio ni cromado. Toda superficie debe llevar al menos UNO de estos elementos de identidad: (a) un **banda de franjas paralelas de color** (diagonal, curva o en chevron), (b) un **bloque de marca ficticia** (wordmark + código de modelo + "propiedad de…"), (c) **serigrafía técnica** (etiquetas en mayúsculas, casillas, rangos, números de serie). Las pantallas son CRT ámbar o verde con scanlines, curvatura, glow de fósforo y aberración cromática. Aplicá un post-proceso final tipo cinta VHS (grano, wobble, bleeding de color, viñeta). Usá solo marcas inventadas; no copies logos reales.
>
> Paleta, tipografía, materiales y reglas de composición: ver secciones 1.1 a 1.6 de este documento. Shaders base: sección 2. Antes de escribir GLSL propio, revisá la sección 3 por si ya existe algo importable.

---

## 1. Descripción del estilo

### 1.1 Concepto
"Futuro visto desde 1979": tecnología **analógica, mecánica y táctil** extrapolada hacia adelante. Es el mundo de *Alien* (la Nostromo es "ciencia ficción sucia": mantenimiento descuidado, equipos usados, tripulación obrera), no el de *2001* (limpio, pulido). Estética emparentada con *Blade Runner*, *Silent Running* y el diseño industrial japonés de los 80. Palabras clave: utilitario, voluminoso, reparable, gastado, serigrafiado, con botones físicos.

Regla de oro (la usó el equipo de *Alien: Isolation*): **no mostrar nada que no se pudiera haber construido físicamente en el set de 1979.** Nada de bordes finos, glass-morphism, degradados suaves modernos ni UI plana.

### 1.2 Forma y volumen
- Siluetas **chunky, angulares, de caja con chaflanes**; esquinas con radio chico (2–6 mm equivalente), nunca orgánicas.
- Carcasas **faceteadas**: monitor CRT en cuña o trapecio, teclado inclinado, módulos laterales acoplados (mini-monitor, lector de cinta, ranuras de disquete).
- Detalles mecánicos visibles: **tornillos Phillips/hex en las esquinas**, ranuras de ventilación horizontales, asas/anillas, antena, trabas, patas de goma.
- Controles físicos: **perilla rotativa con escala numerada**, interruptor deslizante naranja, **teclas de colores** (rojo/amarillo/verde/cian) entre teclas beige/gris, botón rojo grande tipo PTT, LEDs cuadrados amarillos.
- Low-poly con texturas pintadas a mano está bien: el volumen se lee por silueta y paneles, no por detalle de malla.

### 1.3 Paleta (aproximada, tomada de las imágenes de referencia; muestreá las imágenes para afinar)
| Rol | Color | Hex aprox. |
|---|---|---|
| Plástico base (papel/crema) | beige envejecido | `#E8DCC4` |
| Plástico base alternativo | gris cálido / blanco sucio | `#CFC8BA` |
| Carcasa utilitaria | óxido / naranja quemado | `#C0552F` |
| Carcasa oscura | gris carbón | `#3A3B3C` |
| Fondo de pantalla/negro CRT | negro azulado | `#12101A` |
| **Franja 1** | rojo | `#E5322B` |
| **Franja 2** | naranja | `#F0742A` |
| **Franja 3** | amarillo ámbar | `#F4B62E` |
| **Franja 4** | verde | `#2E9E5B` (neón: `#34F28A`) |
| **Franja 5** | azul | `#1F7FB8` (neón/cian: `#7FEFE6`) |
| Franja acento | rosa | `#F27FA5` |
| Fósforo ámbar (pantalla) | ámbar | `#FF9A1F` sobre `#2A1400` |
| Fósforo azul/cian (pantalla) | azul eléctrico | `#2B8CFF` |
| Tinta de serigrafía | casi negro / blanco hueso | `#1A1614` / `#F2EBDD` |

Reglas de uso: la **base es siempre neutra y cálida**; el color vive en las franjas y en pequeños acentos (teclas, LEDs). Máximo 4–5 franjas por banda, en **orden de espectro** (rojo→naranja→amarillo→verde→azul/cian) o con **degradé cálido** (rojo→naranja→amarillo→crema). Sobre fondo negro (imagen neón de 4 franjas: cian, verde, amarillo, rojo) las franjas se vuelven **emisivas con halo** (bloom).

### 1.4 La "guarda" de franjas (elemento firma)
Es el rasgo de identidad más importante. Variantes presentes en las referencias:
1. **Diagonal recta** (Sakura Chroma T-70): 5–6 bandas paralelas a ~35–45°, de grosor uniforme, que salen del borde de la pieza y atraviesan el rótulo.
2. **Curva** (imagen neón de 4 franjas): bandas paralelas que arrancan curvas y se enderezan en diagonal; borde nítido, sin degradé interno, glow exterior.
3. **Chevron / zigzag** (Toshiba L-750): bandas que bajan y suben en "V" ancha, de amarillo a rojo oscuro, recortadas por una ventana blanca con texto girado.
4. **Escalón / quiebre a 45°** (computadora beige con franjas rojo-naranja-amarillo): las bandas recorren el lateral y doblan en ángulo recto.
5. **Línea de lissajous / espirógrafo arcoíris** (VHS negro): hilos finos de color sobre fondo negro, arriba de un marco blanco fino.

Reglas: bordes **duros** (antialias, sin blur) salvo en versión neón; bandas siempre **paralelas y equidistantes**; ancho de banda ≈ 1× el espacio entre bandas (o sin espacio); siempre **recortadas por el borde** de la pieza; es común que el texto principal las cruce o apoye encima.

### 1.5 Marca, rótulos y serigrafía ("guarda/logo/detalle")
Toda pieza lleva una **identidad corporativa ficticia**, con esta estructura:
- **Wordmark** en minúsculas o mayúsculas, sans geométrica redondeada o extendida, con un ícono simple (flor de 5 círculos, círculo cortado, etc.).
- **Código de modelo** grande, a menudo con guion: `T-70`, `L-750`, `RW-COMM-45`, `128`.
- **Descriptor técnico**: "RUGGEDIZED", "FREQ RANGE: 144–440 MHz", "70 minutes", "SUPERCASSETTE".
- **Segunda línea en katakana/kanji** (ej. 高品質ビデオカセット, 日本製) como contrapunto exótico.
- **Casillas de verificación** vacías con etiqueta (COLOR / LO-FI / STEREO / LP, N.R. ON / OFF).
- **Insignias**: sello "AS SEEN ON …", círculo con número ("70"), logos de formato (Beta β, VHS).
- **Stencil de propiedad**: `UNIT-07`, `PROPERTY OF ECHO-BASE`, números de serie.
- Marcas de escala alrededor de perillas, flechas ◄ ▲, rótulos "PWR: ON/OFF", "CHANNEL SELECT", "TX/RX".

Regla de diseño: **cada superficie importante debe llevar al menos una banda de franjas O un bloque de marca**; las pantallas llevan además un encabezado de UI tipo terminal (icono de estado, `CH: 08`, `STATUS: ONLINE`, barras de señal, `POWER: 74%`).

Importante: las marcas deben ser **originales/ficticias**. No reproducir el logo de Arc Raiders, Toshiba, Sakura, Dragon, ni ninguna marca real; usar su *gramática* (franjas + wordmark + código de modelo) con nombres propios.

### 1.6 Tipografía
- **Marca/modelo**: sans geométrica extendida, peso medio–bold. Opciones libres: *Jost* (tipo Futura), *Michroma* (tipo Eurostile), *Archivo* en ancho expandido, *Helvetica*-like.
- **Serigrafía/etiquetas**: mayúsculas, tracking amplio (+5–10 %), tamaño chico, tinta oscura sobre beige o blanco hueso sobre óxido.
- **Pantalla**: monoespaciada, bitmap o semi-bitmap (*VT323*, *IBM Plex Mono*, *Space Mono*), siempre en mayúsculas.
- **Texto girado** 20–30° dentro de la guarda de franjas (estilo Toshiba).

### 1.7 Materiales y desgaste
- **Plástico mate satinado**, levemente amarillento; no brillo especular fuerte.
- **Pintura saltada en bordes y esquinas** (edge wear) mostrando metal gris o plástico base debajo; rayones finos y direccionales; manchas de suciedad en recovecos (AO sucio); marcas de uso en teclas y perillas.
- **Etiquetas pegadas** (notas amarillas, stickers) con leve despegue.
- Los equipos están **usados**, no recién salidos de fábrica.

### 1.8 Pantallas y imagen final
- CRT de **vidrio curvo** (barrel distortion 6–12 %), esquinas redondeadas, bisel grueso.
- **Scanlines** (≈ 240–480 líneas), **máscara de fósforo** sutil, **glow/bloom** de texto, **persistencia** (afterimage), **aberración cromática** leve en bordes, jitter horizontal ocasional.
- Fósforo monocromo ámbar o azul/cian; texto con halo.
- Post-proceso global "cinta": grano fino, wobble horizontal, color bleeding, viñeta, blancos cremosos (nunca blanco puro), negros levantados.
- Iluminación: luz cálida suave desde arriba, sombras difusas; en escenas oscuras, la pantalla es la fuente de luz principal.

---

## 2. Shaders base (originales, para adaptar)

Notas: escritos para three.js moderno (r160+, `WebGLRenderer`). No los ejecuté en un navegador: probalos y ajustá. Para el glow de las franjas neón usá `UnrealBloomPass` después del `RenderPass`.

### 2.1 Banda de franjas (recta, curva o chevron)

Un solo shader cubre: diagonal recta (`uCurve=0`, `uZig=0`), curva (`uCurve≠0`) y chevron (`uZig>0`).

```js
import * as THREE from 'three';

export function createStripeMaterial({
  colors = ['#E5322B', '#F0742A', '#F4B62E', '#2E9E5B', '#1F7FB8'],
  angle = Math.PI * 0.2,   // inclinación de la banda
  width = 0.06,            // ancho de cada franja (espacio UV)
  gap = 0.0,               // espacio entre franjas
  curve = 0.0,             // curvatura (signo = dirección)
  zig = 0.0,               // amplitud de chevron
  zigFreq = 1.5,           // frecuencia del chevron
  soft = 0.0015,           // suavidad de borde (0 = duro)
  emissive = 1.0,          // >1 para alimentar bloom en versión neón
} = {}) {
  const cols = colors.map((c) => new THREE.Color(c));
  return new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      uColors: { value: cols },
      uCount: { value: cols.length },
      uAngle: { value: angle },
      uWidth: { value: width },
      uGap: { value: gap },
      uCurve: { value: curve },
      uZig: { value: zig },
      uZigFreq: { value: zigFreq },
      uSoft: { value: soft },
      uEmissive: { value: emissive },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      uniform vec3 uColors[8];
      uniform int uCount;
      uniform float uAngle, uWidth, uGap, uCurve, uZig, uZigFreq, uSoft, uEmissive;

      void main() {
        vec2 p = vUv - 0.5;
        vec2 dir = vec2(cos(uAngle), sin(uAngle));
        vec2 nrm = vec2(-dir.y, dir.x);

        float along  = dot(p, dir);
        float across = dot(p, nrm);

        // curva (parábola) y chevron (onda triangular)
        across += uCurve * along * along;
        across += uZig * (abs(fract(along * uZigFreq) - 0.5) * 2.0);

        float pitch = uWidth + uGap;
        float total = pitch * float(uCount);
        across += total * 0.5;                 // centrar el paquete de franjas

        float id = floor(across / pitch);
        float f  = across - id * pitch;        // posición dentro del paso

        if (id < 0.0 || id >= float(uCount)) discard;

        float inBand = smoothstep(0.0, uSoft, f) *
                       (1.0 - smoothstep(uWidth - uSoft, uWidth, f));
        if (inBand < 0.001) discard;

        vec3 col = uColors[int(id)] * uEmissive;
        gl_FragColor = vec4(col, inBand);
      }
    `,
  });
}
```

Presets sugeridos:
- **Sakura/VHS**: `angle ≈ 0.62 rad`, `width 0.05`, `gap 0`, 6 colores (`#F27FA5 #E5322B #F0742A #F4B62E #2E9E5B #1F7FB8`).
- **Neón curvo**: `colors ['#7FEFE6','#34F28A','#FFD21A','#FF1A1A']`, `curve ≈ -1.2`, `soft 0.004`, `emissive 2.0` + bloom.
- **Toshiba chevron**: `zig 0.12`, `zigFreq 0.8`, 4 colores cálidos (`#F4D21A #F4A31A #F0742A #E5322B`), sobre plano blanco.

### 2.2 Post-proceso "CRT + cinta VHS" (ShaderPass)

```js
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const RetroCRTShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uCurve: { value: 0.10 },       // barrel distortion
    uScan: { value: 0.22 },        // intensidad de scanlines
    uScanCount: { value: 360.0 },
    uCA: { value: 0.0016 },        // aberración cromática
    uGrain: { value: 0.05 },
    uVig: { value: 0.30 },
    uWobble: { value: 0.0012 },    // jitter horizontal de cinta
    uTint: { value: new THREE.Color(1.0, 0.96, 0.88) }, // blancos cremosos
    uLift: { value: 0.02 },        // negros levantados
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uRes;
    uniform float uTime, uCurve, uScan, uScanCount, uCA, uGrain, uVig, uWobble, uLift;
    uniform vec3 uTint;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }
    vec2 barrel(vec2 uv, float k) {
      vec2 c = uv * 2.0 - 1.0;
      c *= 1.0 + k * dot(c, c);
      return c * 0.5 + 0.5;
    }

    void main() {
      vec2 uv = barrel(vUv, uCurve);
      if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
      }

      // wobble de cinta (jitter horizontal por bandas, a saltos)
      float band = floor(uv.y * 48.0);
      float jit = (hash(vec2(band, floor(uTime * 8.0))) - 0.5) * uWobble * 2.0;
      uv.x += jit + sin(uv.y * 30.0 + uTime * 2.0) * uWobble * 0.3;

      // aberración cromática radial
      vec2 d = (uv - 0.5);
      vec3 col;
      col.r = texture2D(tDiffuse, uv + d * uCA * 2.0).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - d * uCA * 2.0).b;

      // scanlines
      float s = 0.5 - 0.5 * cos(uv.y * uScanCount * 6.28318);
      col *= 1.0 - uScan * s;

      // grano
      col += (hash(uv * uRes + uTime) - 0.5) * uGrain;

      // viñeta
      vec2 c = vUv * 2.0 - 1.0;
      col *= 1.0 - uVig * smoothstep(0.4, 1.4, dot(c, c));

      // blancos cremosos / negros levantados
      col = col * uTint + uLift;

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export function createRetroComposer(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.6, 0.5, 0.85));
  const crt = new ShaderPass(RetroCRTShader);
  composer.addPass(crt);
  composer.addPass(new OutputPass());

  composer.onResize = (w, h) => {
    composer.setSize(w, h);
    crt.uniforms.uRes.value.set(w, h);
  };
  composer.onResize(innerWidth, innerHeight);
  composer.tick = (t) => { crt.uniforms.uTime.value = t; };
  return composer;
}
```

Uso: en el loop, `composer.tick(clock.getElapsedTime()); composer.render();`.

### 2.3 Panel con pintura gastada (edge wear + rayones)

Pensado para generar la **textura de un panel** (render a canvas/RenderTarget y usarla como `map`) o aplicarlo directo en un plano. Para integrarlo con luces PBR, hornear a textura y usar `MeshStandardMaterial`.

```js
export const WornPaintShader = {
  uniforms: {
    uPaint: { value: new THREE.Color('#C0552F') },  // pintura
    uBase:  { value: new THREE.Color('#6B6E70') },  // metal/plástico que asoma
    uDirt:  { value: new THREE.Color('#2A1A12') },
    uWear:  { value: 0.55 },
    uScale: { value: 6.0 },
    uSeed:  { value: 1.0 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: /* glsl */ `
    varying vec2 vUv;
    uniform vec3 uPaint, uBase, uDirt;
    uniform float uWear, uScale, uSeed;

    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed) * 43758.5453); }
    float vnoise(vec2 p){
      vec2 i = floor(p), f = fract(p);
      f = f*f*(3.0-2.0*f);
      return mix(mix(hash(i), hash(i+vec2(1,0)), f.x),
                 mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
    }
    float fbm(vec2 p){
      float a = 0.5, s = 0.0;
      for (int i = 0; i < 5; i++){ s += a * vnoise(p); p *= 2.03; a *= 0.5; }
      return s;
    }

    void main(){
      vec2 uv = vUv;

      // máscara de bordes (cerca del contorno del panel)
      vec2 e = min(uv, 1.0 - uv);
      float edge = 1.0 - smoothstep(0.0, 0.07, min(e.x, e.y));

      // desgaste = bordes + ruido
      float n = fbm(uv * uScale);
      float wear = smoothstep(1.0 - uWear, 1.0, edge * 0.8 + n * 0.55);

      // rayones finos direccionales
      float sc = fbm(vec2(uv.x * 220.0, uv.y * 3.0));
      float scratch = smoothstep(0.78, 0.9, sc) * 0.6;

      // suciedad en zonas bajas de ruido
      float dirt = smoothstep(0.55, 0.9, fbm(uv * uScale * 0.7 + 7.0)) * 0.35;

      vec3 col = uPaint;
      col = mix(col, uDirt, dirt);
      col = mix(col, uBase, max(wear, scratch));
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
```

### 2.4 Superficie de pantalla con UI tipo terminal

Patrón recomendado en lugar de un shader único:
1. Dibujar la UI en un **`CanvasTexture`** (2D canvas: encabezado con iconos, `CH: 08`, barras de señal, `POWER: 74%`, fuente monoespaciada ámbar sobre `#2A1400`).
2. Usarla como `map` + `emissiveMap` de un plano con `MeshBasicMaterial`.
3. Pasar la escena por `RetroCRTShader` (curvatura + scanlines + CA) y `UnrealBloomPass`.
4. Opcional: `AfterimagePass` de three.js para persistencia de fósforo.

### 2.5 Decal de marca (logo + guarda + serigrafía)

No es shader sino **textura**; patrón recomendado:
- Generar un atlas de decals con `canvas` (o SVG rasterizado): wordmark ficticio, código de modelo, katakana secundario, casillas, sello redondo, stencil de unidad.
- Aplicarlos como `DecalGeometry` (three.js addons) o como planos con `polygonOffset` sobre cada panel.
- Insertar siempre una banda de franjas (2.1) detrás o debajo del texto principal.
- Parametrizar: `brandName`, `modelCode`, `unitId`, `paletteStripes`, `owner` → así Claude Code puede generar variantes para distintos equipos.

---

## 3. Recursos para importar o copiar

Verificá la **licencia** de cada uno antes de usar en la obra.

**three.js / WebGL directos**
- three.js (oficial), post-procesado con `EffectComposer`: `FilmPass` (grano + scanlines), `HalftonePass`, `GlitchPass`, `UnrealBloomPass`, `RenderPixelatedPass`, `AfterimagePass`. https://threejs.org/manual/en/how-to-use-post-processing.html
- **pmndrs/postprocessing** (`npm i postprocessing`): Chromatic Aberration, Noise, Scanline, Vignette, Bloom, LUT, etc. https://github.com/pmndrs/postprocessing  (en React: `@react-three/postprocessing`)
- **hetalhouse/cathode** (MIT): lente de barril/curvatura con three.js, temas fósforo verde/ámbar. https://github.com/hetalhouse/cathode
- **glitchGL** (módulos CRT, Pixelation, Glitch sobre three.js): **licencia dual, uso comercial requiere licencia**. https://github.com/naughtyduk/glitchGL
- **mikedaley/web-a2e**: shader CRT de una pasada (`public/shaders/crt.glsl`) con curvatura, scanlines, máscara, glow, flicker, jitter, NTSC, bordes redondeados. Es GLSL/WebGL listo para leer y portar. https://github.com/mikedaley/web-a2e/wiki/Display-Settings
- **Franjas RGB suaves** (three.js forum, shader de bandas con mezcla coseno): https://discourse.threejs.org/t/seamless-rgb-stripes-shader-glass-sphere/88865

**Shaders de Shadertoy/RetroArch (portables a three.js casi 1:1 en GLSL)**
- **Shadertoy VCR distortion (FMS_Cat)**: https://www.shadertoy.com/view/MdffD7
- **crt-lottes** (Shadertoy): https://www.shadertoy.com/view/ls2SRD
- **RSRetroArch** (colección: crt-geom, crt-lottes, crt-hyllian, VHS, zfast_crt, MetaCRT…): https://github.com/Matsilagi/RSRetroArch
- **GodotRetro** (CC0 en su mayoría; ports de VHS, CRT, NTSC, grano, dithering, lente): https://github.com/ahopness/GodotRetro  (sintaxis Godot, pero la lógica pasa a GLSL con cambios menores)

**Para que Claude Code genere mejor**
- **cloudai-x/threejs-skills**: skills para Claude Code (`threejs-shaders`, `threejs-postprocessing`, `threejs-materials`…). Instalar: `npx skills add cloudai-x/threejs-skills`. https://github.com/CloudAI-X/threejs-skills

**Referencia de estilo**
- Cassette futurism (definición): https://cari.institute/aesthetics/cassette-futurism
- Alien: Isolation y su regla "nada que no pudiera existir en 1979": https://www.hudsandguis.com/home/2014/06/04/alien-isolation
- Dirección de arte de ARC Raiders (retrofuturismo, estética tardía 70s/80s, tecnología utilitaria de la Guerra Fría): https://tahirtanis.artstation.com/projects/0lx6ry

---

## 4. Estructura de proyecto sugerida

```
/src
  /shaders
    stripes.js        # 2.1
    retroCRT.js       # 2.2
    wornPaint.js      # 2.3
  /decals
    brand.config.js   # brandName, modelCode, unitId, stripes
    decalAtlas.js     # genera textura con canvas (2.5)
  /screens
    terminalUI.js     # CanvasTexture de pantalla (2.4)
  /scene
    composer.js       # RenderPass → Bloom → RetroCRT → Output
```

Criterio de aceptación visual: una captura de cualquier equipo debe mostrar (1) silueta chunky con tornillos y controles físicos, (2) al menos una banda de franjas y un bloque de marca ficticia, (3) desgaste en bordes, (4) pantalla CRT con scanlines/curvatura/glow, (5) grano y viñeta globales.
