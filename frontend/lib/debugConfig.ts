// C9: Debug configuration — module-level objects mutated by DebugMenu at runtime.
// Components read from these in useFrame for live shader updates.
// Note: geometry/spotlight changes are marked as requiring scene reload.

export const DEBUG_ENABLED = true; // set to false before production build

// ── SILLAS path ───────────────────────────────────────────────────────────────
export const DBG_SPOTLIGHT = {
  color:       "#9fe6ff" as string, // R4: cool dim — was "#fff5dc"
  intensity:   1400,                // R4: 40% of 3500
  distance:    55,
  angle:       0.3,
  penumbra:    0.4,
  attenuation: 6,
  anglePower:  5,
};

// ── R4: retro post-process + scene atmosphere ─────────────────────────────────
export const DBG_RETRO_FX = {
  enabled:          true,            // RETRO_POSTFX_ENABLED
  quality:          "medium" as "low" | "medium" | "high",
  comfortMode:      false,           // disables wobble + CA
  // G2: true = TODOS los uniforms del CRT conectados (uTime, uCurve, uComfort, uRes, sliders del CRT).
  // false = solo los del destello/glare (imagen en reposo idéntica a la actual). Requiere recargar.
  crtUniformsVivos: false,
  // CRT pass tunable values (live)
  crtCurveFX:       0.06,
  crtScanFX:        0.18,
  crtScanCount:     360,
  crtCA:            0.0012,
  crtGrain:         0.045,
  crtVig:           0.38,
  crtWobble:        0.0006,
  crtLift:          0.015,
  // Bloom — U1: threshold raised to 0.92 to keep flat SVG sky colors clean
  bloomIntensity:   0.45,
  bloomThreshold:   0.92,
  // Scene atmosphere
  toneExposure:     0.8,
  hemiSkyColor:     "#1a2330" as string,
  hemiGndColor:     "#0d0a12" as string,
  hemiIntensity:    0.25,
  fogColor:         "#0b0a14" as string,
  fogDensity:       0.015,
  // Cone scanlines (R4)
  hazStripeM:       0.05,    // stripe period in metres
  hazStripeWidth:   0.22,    // lit fraction per period (0–1)
  hazStripeSpeed:   0.08,    // rise speed (m/s)
  hazStripeBoost:   2.5,     // brightness multiplier vs cone base
};

// ── F1: destello enceguecedor al atravesar el telón (CurtainFlash) — todo live ─
export const DBG_FLASH = {
  FLASH_ACTIVO:          true,   // false = sin destello; el telón vuelve al fade original de 1,2 s
  FLASH_SUBIDA_MS:       100,    // G2 (era 150) subida a blanco total
  FLASH_SOSTENIDO_MS:    2000,   // G1 (era 1800) sostenido mínimo en blanco total (se extiende si el telón no está apagado)
  FLASH_BAJADA_MS:       120,    // G2 (era 450; G1 era 2000) caída exponencial casi inmediata
  FLASH_PICO:            1.0,    // opacidad máxima del overlay (0–1)
  FLASH_BLOOM_MULT:      8.0,    // G2 (era 5; F3 era 3) — bloom en el pico = bloomIntensity × este valor
  FLASH_EXPOSICION_MULT: 5.0,    // G2 (era 3; F3 era 2) — exposición en el pico = toneExposure × este valor
  FLASH_LUZ_FADE_MS:     600,    // la luz del telón baja a 0 en este tiempo desde el disparo
  FLASH_TOPE_MS:         4000,   // tope del sostenido extendido (aviso en consola si se alcanza)
  FLASH_RM_PICO_MULT:    0.6,    // prefers-reduced-motion: pico × este valor
  FLASH_RM_SUBIDA_MS:    400,    // prefers-reduced-motion: subida mínima
  // F2: destello diegético dentro del CRT
  FLASH_OVERLAY_DOM:     false,  // true = overlay HTML anterior (F1) encima del canvas, sin CRT
  FLASH_CRT_MAX:         1.0,    // G2 (era 0.97) tope de uFlash; la textura diegética ahora la pone el blow-out
  FLASH_GLOW:            0.6,    // F3 (era 0.35) — resplandor central extra del blanco (uFlashGlow)
  // F3: límites del CRT escalados con uFlash
  FLASH_SCAN_MAX:        0.10,   // G3 (era 0; G2 era 0.06) scanlines restan como máximo esto en el pico (normal uScan 0.18)
  FLASH_VIG_ATEN:        0.4,    // G3 (era 1.0; G2 era 0.6) la viñeta se atenúa este porcentaje en el pico
  FLASH_TOPE_LUM:        1.0,    // tope de luminancia del CRT en el pico (normal 0.92)
  // G1: caída exponencial + glare residual
  FLASH_BAJADA_EXP_K:    8.0,    // G2 (era 5) curvatura de la caída exponencial (0 = lineal)
  FLASH_GLARE_INICIO:    0.35,   // uGlare al terminar la caída (0 = sin glare)
  FLASH_GLARE_MS:        2500,   // duración del glare hasta 0
  FLASH_GLARE_EXP_K:     4.0,    // curvatura del decaimiento del glare
  FLASH_GLARE_BLOOM:     0.6,    // bloom/exposición al empezar el glare = este % del boost de pico
  FLASH_GLARE_ABERRACION: 0.003, // aberración cromática extra con uGlare=1 (base uCA 0.0012)
  FLASH_RM_BAJADA_MS:    900,    // prefers-reduced-motion: caída mínima
  FLASH_RM_GLARE_MULT:   0.5,    // prefers-reduced-motion: glare inicio × este valor
  // G2: blanco enceguecedor — color, margen HDR, blow-out final y seguridad
  FLASH_COLOR:           "#FFFFFF" as string, // G2 (era #FFF3DC fijo) color base del destello
  FLASH_GLARE_COLOR:     "#FFF3DC" as string, // G2 crema solo en los bordes del velo del glare
  FLASH_HDR:             2.5,    // G3 (era 4.0) multiplicador de energía del blanco antes del CRT (satura el ACES)
  FLASH_HDR_CLAMP:       64.0,   // tope lineal del CRT (anti NaN/Inf en half-float)
  FLASH_BLOWOUT:         0.6,    // G3 (era 0.9) mezcla final hacia blanco puro tras ACES+sRGB (uBlowout = uFlash × esto)
  FLASH_BLOWOUT_TEXTURA: 0.10,   // G3 (era 0.03) scanlines + grano que asoman sobre el blow-out (fracción)
  FLASH_BLOOM_TOPE:      8.0,    // tope absoluto de bloom.strength
  FLASH_EXPOSICION_TOPE: 8.0,    // tope absoluto de toneMappingExposure
  FLASH_MEDIR_HOLD_MS:   500,    // la medición lee píxeles a estos ms de sostenido
  FLASH_AVISO_FOTOSENSIBILIDAD: false, // true = línea de aviso al inicio de la experiencia
  // G3: perilla maestra — interpola todo lo del destello entre "sin destello" (0) y el pico configurado (1)
  FLASH_INTENSIDAD:      0.65,   // escala uFlash (y con él scan, viñeta, tinte, tope, borde, blow-out), HDR, bloom y exposición
  FLASH_BORDE:           0.3,    // encendido del borde fuera de la curvatura (fracción del de G2)
};

// ── Z2: linterna del usuario sobre los paneles SILLAS — live ───────────────────
export const DBG_LINTERNA = {
  LINTERNA_ACTIVA:   true,  // false = sin linterna (órbitas y paneles como antes)
  PANEL_SELECCION_REQUIERE_LIBERACION: true, // Z13: linterna/selección recién cuando se libera el movimiento (sala_activa)
  CONO_DEG:          12,    // semiángulo del cono de luz (ilumina con caída suave hasta acá)
  ENTRA_DEG:         5,     // histéresis: un panel queda seleccionado al entrar a este ángulo
  SALE_DEG:          8,     // histéresis: el seleccionado se suelta al pasar este ángulo
  ABRIR_MS:          2000,  // luz sostenida en el mismo panel → estado 'abierto'
  LUZ_INTENSIDAD:    1.0,   // brillo de la imagen bajo la linterna (1 = como bajo un haz)
  LUZ_FADE_S:        8,     // velocidad de fundido de uLit (1/s)
  SEL_FADE_S:        10,    // velocidad de fundido del marco SEL (1/s)
  ORBITA_VEL_MULT:   1.0,   // multiplicador de la velocidad de órbita de cada panel
  MARCO_PAD_M:       0.3,   // separación de las esquinas ámbar respecto del panel (m)
};

// ── Z8: acercamiento del panel seleccionado hacia la cámara — live ──────────────
export const DBG_ACERC = {
  ACERC_ACTIVO:     true,    // false = el panel se abre en su órbita (Z2/Z4 sin acercamiento)
  ACERC_PANTALLA:   0.30,    // fracción máxima del ancho Y del alto del viewport que ocupa el panel
  ACERC_MS:         900,     // duración del acercamiento
  ACERC_VUELTA_MS:  900,     // duración de la vuelta a la órbita
  ACERC_EASING:     "seno" as "seno" | "suave" | "cubica", // in-out sin rebote (seno / smootherstep / cúbica)
  ACERC_ESPERA_CIERRE: true, // la vuelta empieza cuando terminaron de cerrarse los subpaneles
  ACERC_AJUSTE_S:   6,       // Z9: velocidad (1/s) con la que el panel acercado sigue un cambio de layout (resize)
  // Z12: selección latcheada — durante el viaje no cuenta el cono; el cierre se decide en pantalla
  CIERRE_MARGEN:    0.06,    // margen extra de la caja de cierre (fracción del semiviewport)
  CIERRE_MARGEN_DEG: 8,      // Z14: margen angular (yaw/pitch) de la región de cierre del conjunto cóncavo
  CIERRE_GRACIA_MS: 1200,    // fuera de la caja durante este tiempo (contado desde 'abierto') → cierra
  ESPERA_DATOS_MS:  5000,    // si los subpaneles no aparecen (datos que no llegan), se da por abierto igual
};

// ── Z10: prioridad visual del proyecto abierto sobre los paneles en órbita — live ──
export const DBG_PRIORIDAD = {
  PRIORIDAD_ACTIVA:   true,  // false = los demás paneles no cambian (comportamiento Z9)
  ATENUAR_BRILLO:     0.25,  // brillo de los demás paneles mientras hay un proyecto abierto/acercándose
  ATENUAR_MS:         600,   // fundido de atenuación / ocultamiento (ida y vuelta)
  OCULTAR_SOLAPADOS:  true,  // esconde (escala → 0) los paneles cuya proyección se solapa con el conjunto
  OCULTAR_MARGEN:     0.08,  // margen extra alrededor del conjunto (fracción del semiviewport)
  OCULTAR_PROF_M:     4.0,   // solo se esconden los que están a menos de esto DETRÁS del panel (los más lejanos los tapa la profundidad)
  RENDER_ORDER_BLOQUE: 20,   // renderOrder del conjunto abierto (los paneles en órbita usan 0)
};

// ── Z17: aislar elementos de la interfaz del domo (debug; "todo" = normal) ──
export const DBG_AISLAR_UI = {
  MODO: "todo" as "todo" | "panel" | "historia" | "galeria" | "ficha" | "sin_marco" | "sin_orbita",
};

// ── Z19: FOCO de un subpanel (HISTORIA / GALERÍA / FICHA) dentro del domo esférico — live ──
export const DBG_FOCO = {
  SUB_FOCO:            true,  // false = sin foco (comportamiento Z18)
  FOCO_DWELL_S:        1.0,   // segundos con la retícula sobre el subpanel para entrar en foco (0 = inmediato)
  FOCO_RADIO_M:        1.6,   // radio del parche en foco (más cerca → tapa al resto por profundidad)
  FOCO_PANTALLA:       0.80,  // tope de pantalla: fracción máxima del viewport (ancho y alto) mirado de frente
  FOCO_ANG_MAX_DEG:    90,    // tope angular SOLO del modo Z19 (el plano de Z21 lo limita FOCO_PANTALLA)
  FOCO_SEGUIR_MIRADA:  0.35,  // el centro se corre hacia la mirada esta fracción
  FOCO_DESPL_MAX_DEG:  15,    // máximo corrimiento del centro hacia la mirada
  FOCO_OTROS_OPACIDAD: 0.35,  // brillo del resto del conjunto mientras hay foco
  FOCO_SALIDA_MARGEN_DEG: 4,  // histéresis: margen alrededor del subpanel agrandado antes de contar la salida
  FOCO_GRACIA_S:       0.4,   // fuera del margen este tiempo → sale del foco
  FOCO_COOLDOWN_S:     0.25,  // mínimo entre transiciones (evita oscilar)
  FOCO_MS:             450,   // duración de entrada y salida
  // Z21: foco como plano casi frontal (sin abanico) y sin roll
  FOCO_PLANO:          0.85,  // 1 = plano total, 0 = esfera (curvatura residual = 1 − esto)
  FOCO_SIN_ROLL:       true,  // el "arriba" del plano en foco es el de la cámara al entrar en foco
  FOCO_MODO_Z19:       false, // true = foco viejo (parche esférico estirado, con abanico/roll)
  // Z20: robustez + feedback del dwell
  FOCO_ENTRADA_MARGEN_DEG: 2, // la región de cada subpanel se agranda esto para elegir el sujeto
  FOCO_PARPADEO_S:     0.15,  // pérdidas de hit más cortas no reinician el dwell
  FOCO_ESCALA_MIN:     0.95,  // el subpanel debe estar aparecido al menos esto para contar
  FOCO_ANILLO:         true,  // anillo de progreso alrededor de la retícula durante el dwell
  FOCO_ANILLO_COLOR:   "#FF9A1F" as string,
  FOCO_ANILLO_RADIO:   1.55,  // radio del anillo (× radio de la retícula)
  FOCO_BORDE:          true,  // brillo ámbar en el borde del subpanel apuntado
  FOCO_BORDE_COLOR:    "#FF9A1F" as string,
  FOCO_BORDE_ALFA:     0.7,   // intensidad máxima del brillo de borde
  FOCO_BORDE_ANCHO:    0.025, // ancho del borde (fracción del lado menor)
};

// ── Video (etapa 1): botón "▶ VER" en FICHA / clic en el panel → reproductor aparte (modal) ──
export const DBG_VIDEO = {
  YT_MODAL:        true,  // false = sin botón ni clic de video (como antes)
  YT_CLIC_PANEL:   true,  // clic con la retícula sobre el panel abierto también abre el video
  YT_NOCOOKIE:     true,  // reproductor desde youtube-nocookie.com
  YT_RELOCK:       true,  // al cerrar el modal se vuelve a capturar el mouse
};

// ── Z24: posición inicial del usuario (Z22) ────────────────────────────────────
export const DBG_INICIO = {
  INICIO_RETROCESO_M: 5,  // Z25: el usuario arranca curtainDistM + esto antes del telón, sobre su eje; recargar
  INICIO_PITCH_DEG:   0,  // Z25: pitch inicial (0 = horizontal; bajar la mirada corta el borde superior del telón)
};

// ── Z23: iconos grabados en el piso (silla = SILLAS a la izquierda, luz = TARIMA a la derecha) ──
export const DBG_PISO_ICONOS = {
  PISO_ICONOS:     true,  // false = sin iconos
  DIST_M:          4.0,   // Z23 (sin uso desde Z24: los iconos se ubican respecto del telón)
  MARGEN_TELON_M:  0.3,   // Z23 (sin uso desde Z24)
  DIST_TELON_M:    1.0,   // Z24: distancia del centro de los iconos al telón donde estaban en Z23
  ICONOS_ACERCAR_M: 2.0,  // Z24: se acercan al usuario (se alejan del telón) esto más
  SEP_M:           3.0,   // separación entre los centros de los dos iconos
  ICONOS_TAMANO_M: 2.0,   // Z24 (era TAM_M 1.4): lado de cada icono, para leerse desde 5 m más atrás
  BRILLO_MAX:      0.38,  // intensidad máxima del reflejo al mirarlos
  ENTRA_DEG:       12,    // cono de mirada: empieza a reflejar
  SALE_DEG:        20,    // cono de mirada: deja de reflejar (histéresis)
  SURCO:           0.52,  // oscurecimiento del piso bajo el trazo
  BISEL:           0.10,  // brillo del bisel (borde inferior derecho)
  SUAV_S:          0.3,   // suavizado temporal del reflejo
  FADE_MS:         800,   // fundido de aparición / desaparición
};

// ── Z12: log de diagnóstico de la máquina de estados del panel (apagado por defecto) ──
export const DBG_LOG_PANEL = {
  LOG_ACTIVO: false, // true = console.info en cada transición (motivo, ángulo al centro, tiempo)
};

// ── Z4: subpaneles del panel abierto (HISTORIA / GALERÍA / FICHA) — live ──────
// Medidas tomadas del mockup en px y convertidas con SUB_M_POR_PX (400 px = ancho del panel 5,4 m).
export const DBG_SUBPANELES = {
  SUB_ACTIVO:        true,   // false = el panel se abre sin subpaneles
  SUB_M_POR_PX:      0.0135, // escala mockup → metros (tamaño de los subpaneles)
  SUB_GAP_LATERAL_M: 1.28,   // separación HISTORIA/GALERÍA ↔ panel (mockup 95 px)
  SUB_GAP_ABAJO_M:   0.95,   // separación panel ↔ FICHA (mockup 70 px)
  SUB_ANIM_MS:       500,    // Z14 (era 400): salida desde el panel (escala + desplazamiento) y cierre inverso
  SUB_ADELANTE_M:    0.15,   // los subpaneles se adelantan hacia la cámara (evita cruzar el panel)
  SUB_AJUSTE_PANTALLA: true, // Z8: escala HISTORIA/GALERÍA/FICHA (y separaciones) para que entren en pantalla
  SUB_MARGEN_PANTALLA: 0.04, // Z8: margen a cada borde del viewport (fracción)
  SUB_AJUSTE_BLOQUE: true,   // Z9: bloque panel+subpaneles centrado y ajustado (incl. curvatura CRT); off = ajuste Z8
  SUB_MARGEN_SEGURIDAD: 0.06, // Z9: margen de seguridad por lado (fracción del viewport)
  SUB_ESCALA_MIN:    0.55,   // Z9: escala mínima legible de los subpaneles; por debajo se aleja el bloque
  // Z14: disposición cóncava alrededor del ojo (se gira la cámara, no hace falta A/D)
  SUB_CONCAVO:       true,   // false = bloque plano de Z9
  SUB_YAW_DEG:       34,     // yaw de HISTORIA (−) / GALERÍA (+) respecto del panel; se agranda si se superponen
  SUB_YAW_MAX_DEG:   60,     // el borde exterior de los laterales no pasa de este yaw (si no, se reduce la escala)
  SUB_PITCH_FICHA_DEG: -24,  // pitch de FICHA respecto del panel; se agranda si se superpone
  SUB_DIST_FACTOR:   1.0,    // distancia al ojo de los subpaneles = distancia del panel × esto
  // Z16: domo CERCANO en el marco rígido de la cámara del disparo (dimensionado angular)
  SUB_DOMO_CERCANO:  true,   // false = layout cóncavo de Z14
  DOMO_RADIO_M:      3.0,    // radio del domo cercano (ojo → panel y subpaneles)
  DOMO_LAT_DEG:      26,     // ancho angular de HISTORIA y GALERÍA
  DOMO_LAT_MIN_DEG:  20,     // ancho angular mínimo de los laterales (si no entran)
  DOMO_FICHA_DEG:    34,     // ancho angular de FICHA
  DOMO_SEP_DEG:      3,      // separación angular entre bordes
  DOMO_YAW_MAX_DEG:  50,     // borde exterior de los laterales (para verse sin girar en 16:9)
  DOMO_PITCH_MAX_DEG: 25,    // límite del pitch del marco capturado (evita piso/techo)
  DOMO_CAPA_UI:      true,   // Z17: el conjunto se dibuja en un pase propio (capa UI) antes del bloom/CRT, depth limpio
  DOMO_CAPA_DEPTHTEST_VIEJO: false, // Z16 (con bug): depthTest off en la escena; solo para comparar
  // Z18: domo ESFÉRICO — cada elemento es un parche de esfera de radio DOMO_RADIO_M
  SUB_DOMO_ESFERICO: true,   // false = planos del domo cercano de Z16
  ESF_PANEL_CONSERVAR_Z8: true, // true = el panel conserva su tamaño en pantalla de Z8 (ACERC_PANTALLA)
  ESF_PANEL_ANCHO_DEG: 40,   // tamaño del panel si no se conserva el de Z8
  ESF_PANEL_ALTO_DEG:  28,
  ESF_PANEL_PITCH_DEG: 2,    // pitch del panel (y de los laterales) en el marco
  ESF_LAT_ANCHO_DEG:   30,   // HISTORIA / GALERÍA
  ESF_LAT_ALTO_DEG:    36,
  ESF_LAT_YAW_DEG:     38,   // yaw mínimo de los laterales (se agranda si se superponen)
  ESF_FICHA_ANCHO_DEG: 44,
  ESF_FICHA_ALTO_DEG:  20,
  ESF_SEP_DEG:         3,    // separación entre bordes
  ESF_YAW_MAX_DEG:     53,   // borde exterior de los laterales
  ESF_SEG_U:           24,   // subdivisiones horizontales del parche
  ESF_SEG_V:           16,   // subdivisiones verticales
  ESF_LINEA_GROSOR_DEG: 0.6, // grosor angular de las líneas guía
  SUB_RETENER_PAD_M: 0.25,   // Z5 (era 1.0 sobre el conjunto): margen alrededor de cada subpanel y del panel
  SUB_LINEAS:        true,   // líneas guía punteadas ámbar hacia el panel
  SUB_PUNTERO:       true,   // Z5: retícula clara en el centro de pantalla con el panel abierto
  PUNTERO_RADIO_M:   0.21,   // Z5: radio medio de la retícula (m)
  PUNTERO_GRACIA_MS: 1200,   // Z5: espera antes de cerrar si el puntero sale (evita cerrar por un roce)
  PANEL_BLOQUEA_MOVIMIENTO: false, // Z5: true = sin WASD mientras hay un panel abierto
  // Z11: puntero estable sobre los botones
  PUNTERO_HISTERESIS: 0.12,  // el hover entra con el botón y sale con el botón agrandado este % por lado
  PUNTERO_PULSO_MS:   150,   // duración del pulso de la retícula al hacer clic
  PUNTERO_COOLDOWN_MS: 250,  // clics ignorados después de uno aceptado
  PUNTERO_ESCALA_HOVER: 1.3, // retícula sobre un botón (× radio)
  PUNTERO_ESCALA_CLIC: 0.75, // retícula durante el pulso de clic (× radio)
  PUNTERO_SUAVIZADO_S: 18,   // velocidad (1/s) con que la retícula va a su tamaño objetivo
  HISTORIA_RENGLONES: 10,    // renglones por página de la sinopsis
  GALERIA_AMBAR:     1.0,    // 1 = imagen monocroma ámbar, 0 = color original
  GALERIA_SCAN:      0.28,   // intensidad de scanlines de la pantalla CRT
  GALERIA_CURVA:     0.08,   // curvatura (barrel) de la pantalla CRT
};

// ── Z7: órbitas ordenadas de los paneles SILLAS — se aplican con "Regenerar órbitas" ──
export const DBG_ORBITAS = {
  ORB_ORDENADAS:     true,   // false = 9 anillos inclinados al azar de antes (G5)
  PANELES_MAX:       60,     // tope de paneles (los más recientes primero); se recorta a la capacidad
  ORB_ANILLOS:       4,      // anillos horizontales concéntricos
  ORB_RADIO_MIN_M:   15,     // radio del anillo interior (fuera del prisma/sillas, dentro del domo R=28)
  ORB_RADIO_MAX_M:   24,     // radio del anillo exterior
  ORB_ALTURA_ALTERNA: 0.9,   // 0 = todos al centro de la banda de luz; 1 = alternan abajo/arriba al máximo
  ORB_VAR_M:         0.25,   // variación vertical suave de cada panel (± m, reservada dentro del rango)
  ORB_VAR_FREQ:      2,      // ondulaciones por vuelta de la variación vertical
  ORB_VEL_BASE:      0.00012, // rad/frame a 60 fps del anillo interior
  ORB_VEL_PASO:      0.45,   // cada anillo hacia afuera: × (1 + paso × i); sentidos alternados
  ORB_SEP_MIN:       1.3,    // separación angular mínima = ancho angular del panel × esto
  ORB_LUZ_MIN:       0.5,    // la banda vertical usa el cono hasta donde el haz da ≥ este % de luz
  PANEL_ESCALA:      1.5,    // tamaño del panel = 3,6 × 2,4 m × esto (era PANEL_SCALE fijo)
};

// ── P1: paneles orbitantes del camino SILLAS (ExperienceDome) — live ───────────
export const DBG_PANELES = {
  PANELES_AUTO:        true,  // false = paneles siempre visibles (comportamiento anterior)
  PANELES_FADE_IN_MS:  600,   // fade de aparición (alpha)
  PANELES_FADE_OUT_MS: 600,   // fade de desaparición (alpha)
  // Z1: marco del panel de proyecto (unidades = fracción del ANCHO del panel → margen parejo)
  PANEL_MARGEN:        0.03,  // margen beige en los 4 lados (mockup: 12 px / 400 px)
  PANEL_REGLA:         0.05,  // alto de la tira de regla ocre, dentro del margen (mockup: 20 px / 400 px)
  PANEL_PLACEHOLDER:   true,  // tarjeta retro para paneles sin foto o con carga fallida
  PANEL_PLACEHOLDER_FORZAR: false, // debug: mostrar el placeholder en todos los paneles
  PANEL_OSCURO:        0.018, // brillo de la imagen fuera de los haces del prisma (R5: 0.018 fijo)
  // Z6: reposo a oscuras — el panel no emite; solo se ve con los haces o la linterna
  PANEL_DISENO_VIEJO:  false, // true = vuelve al marco beige + regla de Z1/R5 (emisivo)
  PANEL_BRILLO_BASE:   0.004, // luz ambiente mínima sobre la foto (casi cero)
  PANEL_HAZ_INTENSIDAD: 1.4,  // ganancia de los haces del prisma sobre los paneles
  PANEL_HAZ_COS:       0.984, // coseno del semiángulo del cono (≈10°, igual que el domo)
  PANEL_HAZ_SUAVE:     0.014, // suavidad del borde del cono (en coseno; 0.014 → lleno a ≈3,6°)
  PANEL_BORDE:         0.006, // borde carbón mínimo (fracción del ancho; 0 = sin borde)
  PANEL_BORDE_INT:     0.35,  // intensidad del borde carbón (también depende de la luz)
};

export const DBG_PRISM = {
  landOffset:  0.09, // C3 hover gap (read-only, changes require code edit + reload)
  // S1
  spinDir:     -1,   // -1 = inverted (CCW from above)
  // N2: absolute radii (prismRangeScale multiplier removed)
  prismRangeScale: 1.0, // legacy N1 — no longer applied; kept for history
  nearM:       5.0,  // proximity effect starts (m)
  closeM:      3.33, // glow threshold (m)
  maxEffectM:  0.3,  // full effect at this distance (m) — unchanged
  translucentMs:      3000, // ms to ramp to translucent opacity
  translucentOpacity: 0.35, // glass opacity when player is near
  spinAccel:   8,    // spin multiplier at maxEffectM
};

// Pointer lock retry cooldown (ms) — browser blocks re-lock within ~1 s of exit
export const POINTERLOCK_RETRY_MS = 1300;

// S3: dome exterior visualizer (SILLAS path)
export const DBG_SILLAS = {
  prismInteractM:  5.0,   // horizontal distance (m) at which "Apretar E" prompt appears
  prismTouchM:     0.75,  // horizontal distance (m) at which touching auto-activates
  touchEpsM:       0.05,  // legacy surface threshold (kept for compat) — use prismTouchM
  vizTrackUrl:      '/music.mp3' as string, // G2: default track (same as /login)
  vizVolume:        1,    // G2: audio volume (0–1), live
  domeShellOpacity: 0,    // G1: shell fades to 0 (transparent) when visualizer active
  // F2/G1: exterior sky sphere
  vizTexSize:      2048,  // WebGLRenderTarget pixel size (reload to change)
  vizSphereScale:  1.15,  // exterior sphere radius = DOME_R × scale (live)
  vizThetaMax:     100,   // degrees from zenith to texture edge (live)
  vizFadeMs:       1500,  // fade-in + scale animation duration in ms (live)
  vizAngle:        0,     // G1 fix: 0 puts equator (most content) at texture center / zenith
  // G1 debug
  vizTestPattern:  false, // show θ/φ test grid instead of login shader
  vizSolidTest:    false, // Prueba A: solid magenta + depthTest=false + DoubleSide + renderOrder=10
  vizHideShell:    false, // force-hide dome shell (debug)
  showBigMeshes:   false, // Z2: escanear y mostrar meshes con bbox > 20m (diagnóstico)
  // visualizer shader params (live)
  vizIntensity:    0.72,  // R2: was 1.2 (×0.6 = −40%)
  vizGhost:        1.0,
  vizMatrix:       0.25,
  vizRings:        1.0,
  vizSpeed:        0.65,
  vizAudioReact:   1.0,
  vizTopColor:     "#0a198c" as string,
  vizBottomColor:  "#11133b" as string,
  // N1: sillas sequence timing
  releaseDelayMs: 5000,  // ms after alight:dome-revealed before movement is freed (sala_activa)
  lockLook:       false, // N1: also lock mouse-look during sillas_secuencia (not yet implemented)
  // N3: beams (haces)
  hazDistFactor:    1.25,   // V1: multiplier applied to base 12 m radius (base×factor=hazRadiusM)
  hazRadiusM:       15.0,   // beam center distance from prism XZ origin (m) — V1: 12→15 (×1.25)
  hazZoneRadiusM:   1.0,    // "under beam" trigger zone radius (m)
  hazSpotY:         22,     // legacy — no longer used as beam height; kept for reference
  hazOriginHM:      2.4,    // R2: beam origin height (m) above floor — reload to rebuild geometry
  hazConeFloorRM:   1.05,   // R2: cone base radius at floor (m) — reload to rebuild geometry
  hazSpotIntensity: 40,     // R2: SpotLight intensity (was 80, ×0.5) × globalLightScale in useFrame
  hazConeOpacity:   0.14,   // R2: max additive cone opacity
  globalLightScale: 0.55,   // R2: multiplier for all SILLAS lights — live
  hazToggleCooldownMs: 800, // R3: anti-bounce cooldown after toggle (ms) — live
  hazOnBoost:       1.35,   // R3: cone + symbol brightness multiplier when band is on — live
  hazColor0:        '#7FEFE6' as string, // R2: S0 cyan
  hazColor1:        '#34F28A' as string, // R2: S1 green
  hazColor2:        '#FFD21A' as string, // R2: S2 yellow
  hazColor3:        '#FF1A1A' as string, // R2: S3 red
  // N3: symbols
  symbolRadiusM:    1.0,    // floor symbol disc radius (m)
  symbolPeriodS:    2.5,    // animation cycle period (s)
  symbolLineWidthM: 0.04,   // trace thickness (m)
  // N3: sun
  sunIntensity:     0.35,   // base emissive brightness
  sunAngularDeg:    4.0,    // angular diameter (degrees)
  sunDriftEnabled:  false,  // slow azimuth drift (debug only)
  // N4: audio gates
  gateAttackMs:     300,    // gate open time constant (ms)
  gateReleaseMs:    600,    // gate close time constant (ms)
  showBandOverlay:  false,  // debug overlay: per-band energy + gate state
  // N5: monoliths + interference
  monolitoDistFactor:  1.25,  // V1: multiplier applied to base 3.0 m distance (base×factor=monolithDistM)
  monolithDistM:       3.75,  // V1: left/right monolith distance from center (m) — was 3.0, now 3.0×1.25
  monolithFadeMs:   1500,    // monolith appear/disappear fade duration (ms)
  monolithProxFullM:   0.5,   // distance for full proximity effect (m)
  monolithProxStartM:  3.0,   // distance where proximity effect starts (m)
  noiseGain:           0.5,   // white noise max gain (right monolith proximity)
  staticMixMax:        0.35,  // max uStaticMix value on dome (left monolith proximity)
  watcherEyeEnabled:   true,  // N5: show watcher eye disc when watchers > 0
  // S1: monolith visibility
  monolithLightIntensity: 150, // SpotLight NOT scaled by globalLightScale
  monolithRimIntensity: 0.25,  // fresnel rim brightness
  monolithRimPow: 3,           // rim exponent (higher = tighter edge)
  monolithGlowOpacity: 0.10,   // floor glow disc alpha
  monolithForceShow: false,    // debug: force monoliths visible regardless of state
  // V2: obsidian material
  monolithEnvIntensity:   1.4,  // PMREM envMapIntensity
  monolithWarmLightI:    60,    // warm PointLight intensity per monolith (V3: only when lucesPropias)
  monolithColdLightI:    28,    // cold PointLight intensity per monolith (V3: only when lucesPropias)
  monolithVeinBright:     0.02, // V3: lowered to near-zero (golden veins cause bloom sparkles)
  monolithRimV2Intensity: 0.75, // purple-brown fresnel rim (replaces S1 cyan)
  monolithDesaturation:   0.60, // 60 % desaturation of reflected light
  // V3: twisted obelisk geometry + light fix
  monolithTwistDeg:      90.0, // total twist angle of column (degrees) — reload to change geometry
  monolithTwistInicio:   0.35, // fraction of column height where twist begins (0 = all, 1 = none)
  monolithTaper:         0.92, // top side scale factor (1.0 = no taper, 0.9 = 10% narrower at top)
  monolithTopTilt:       0.06, // top cut inclination (fraction of column side per unit X)
  monolithLucesPropias:  false, // V3: enable point lights (default off — they cause bloom artifacts)
  monolithUseConchoidal: false, // V3: use V2 conchoidal fracture geometry instead of twisted obelisk
  debugOverlays:       false, // R1: show prism/audio/effects debug overlays — off by default
  // N6: red velvet curtain (reload to reposition; wind/gravity/damping/light are live)
  curtainDistM:          3.0,           // distance from player spawn to curtain plane (m)
  curtainWidthM:         14,            // curtain width (m)
  curtainHeightM:        8,             // height floor-to-pin (m)
  curtainGather:         0.85,          // horizontal gather ratio (< 1 = pleated)
  curtainWind:           0.6,           // wind amplitude (m/s²) — live
  curtainGravity:       -9.8,           // gravity Y (m/s²) — live
  curtainDamping:        0.985,         // velocity damping per substep — live
  curtainLightIntensity: 2400,          // SpotLight intensity — live
  curtainLightColor:     '#fff1dc' as string, // SpotLight color — live
  // T2: panoramic dome growth (0→1 per group, cubic-eased)
  vizGrowS:       3.0,            // group grow animation duration (s)
  vizGrowForce0:  -1 as number,   // force group 0 grow value (0–1); -1 = off
  vizGrowForce1:  -1 as number,
  vizGrowForce2:  -1 as number,
  vizGrowForce3:  -1 as number,
  // T3: audio reaction — timing
  pulseAttackMs:  300,  // gate-open ramp (ms)
  pulseDecayMs:   600,  // gate-close decay (ms)
  pulseSmoothMs:   80,  // extra energy smoothing after gating (ms)
  idleFlow:        0.015,// LÍNEAS idle base speed (rev/s) when gate off — U5: FLOW_BASE=2π so units match
  // T3: debug pulse simulators (0 = off; >0 = override energy)
  simPulse0:       0 as number,
  simPulse1:       0 as number,
  simPulse2:       0 as number,
  simPulse3:       0 as number,
  // T3: reaction intensities — live uniforms
  mtHeightBoost:   0.18,  // MONTAÑAS Y-scale per unit normEnergy (±18%)
  mtBrightBoost:   0.40,  // MONTAÑAS brightness boost
  kickExtraBoost:  0.12,  // kick extra height (only for kick-band group)
  skyBrightBoost:  0.40,  // CIELO brightness boost
  sunBrightBoost:  0.40,  // SOL overall brightness boost
  lineAmpBoost:    1.60,  // LÍNEAS amplitude boost
  lineSpeedBoost:  0.045, // LÍNEAS max extra speed at full energy (rev/s) — U5: 0.015+0.045=0.06 rev/s max
  kickDecayMs:     150,   // kick impulse decay (ms)
  showReactionOverlay: false, // T3: show haz→group→band assignment in corner
  // U2: AGC normalization (live)
  agcFloorRise:    0.5,   // floor max rise rate (energy units/s)
  agcCeilDecayS:   4.0,   // ceiling exp-decay τ (s)
  agcPow:          0.6,   // normEnergy exponent (< 1 boosts weak signals)
  agcEpsilon:      0.002, // denominator guard
  agcAttackMs:     40,    // normEnergy smoothing attack (ms)
  agcReleaseMs:    220,   // normEnergy smoothing release (ms)
  showU2Meters:    false, // U2: audio meters panel (oculto por defecto)
  // U2: VizPanorama scale effects (live)
  u2SunRingBoost:    0.12, // ring scale +% per unit normEnergy
  u2SunDiscBoost:    0.08, // disc scale +%
  u2SunCoreBoost:    0.20, // core scale +%
  u2StarScaleBoost:  1.20, // star scale boost (size × (1 + boost × energy) → max 2.2×)
  u2KickScale:       0.05, // kick flash scale boost (+5%)
  // U4: per-group attack/release envelopes (ms)
  grp0AtkMs:   15,   grp0RelMs:  120,  // SOL: golpe seco
  grp1AtkMs:  120,   grp1RelMs:  600,  // MONTAÑAS: respiración lenta
  grp2AtkMs:   30,   grp2RelMs:  300,  // CIELO: centelleo
  grp3AtkMs:   50,   grp3RelMs:  250,  // LÍNEAS
  // U4: SOL — ring phase lag + core kick brightness
  sunRingLagMs:    40,    // ms of smoothing lag added per ring (ring < disco < core)
  sunCoreKickBrt:  0.80,  // core brightness boost on kick
  // U4: MONTAÑAS — per-layer amplitude + azimuth parallax
  mt0AmpBoost:  0.20,  // fondo Y-scale amplitude (±20%)
  mt1AmpBoost:  0.15,  // medias Y-scale amplitude (±15%)
  mt2AmpBoost:  0.10,  // frente Y-scale amplitude (±10%)
  mtPhaseSpd:   0.80,  // oscillation speed (rad/s on flowRef)
  mtAzParallax: 1.00,  // max azimuth shift (degrees)
  // U4: CIELO — star twinkle
  starTwinkleAmp:  0.70,  // scale amplitude (max scale = 1 + amp ≈ 2.4× with energy)
  starTwinkleFq:   2.20,  // twinkle base frequency (rad/s)
  // U5: liquid psychedelic lines shader
  u5PsyMode:     true,   // enable domain-warp FBM + cosine palette on lines band
  u5PsyMixMin:   0.15,   // palette blend at silence
  u5PsyMixMax:   0.95,   // palette blend at full energy
  u5WaveAmp:     0.08,   // vertical wave amplitude (fraction of band height, ±)
  u5WaveFreq:    3.0,    // wave cycles across full azimuth (0–1 U)
  u5WaveSpd:     1.5,    // wave temporal speed (rad/s)
  u5FbmSpd:      0.08,   // FBM animation speed multiplier
  // U6A: floor rings on alight:haz-toggle
  u6RingCount:   6,      // rings per effect (2–7)
  u6Duration:    2.5,    // effect lifetime (s)
  u6SeqDelay:    0.25,   // activation stagger between rings (s)
  u6MinRadius:   0.3,    // innermost ring starting radius (m)
  u6MaxRadius:   2.0,    // outermost ring ending radius (m)
  u6TwinkleFq:   8.0,    // twinkle frequency (rad/s)
  u6Opacity:     1.0,    // ring opacity scale
  // U6B: beam flash surge on on-toggle
  u6FlashPeak:   3.0,    // intensity multiplier at peak (on-toggle)
  u6FlashAtkS:   0.15,   // attack time to peak (s)
  u6FlashDecS:   4.0,    // exponential decay τ back to normal (s)
  u6DimFactor:   0.7,    // off-toggle dim multiplier (< 1)
  u6DimDecS:     1.0,    // off-toggle return-to-normal τ (s)
  // U7: per-layer visibility + magenta test mode
  u7VisStars:    true,
  u7VisClouds:   true,
  u7VisSun:      true,
  u7VisSky:      true,   // CIELO warm gradient in PANORAMA_FRAG
  u7VisMtFondo:  true,
  u7VisMtMedias: true,
  u7VisMtFrente: true,
  u7VisLines:    true,
  // 0=off 1=stars 2=clouds 3=sun 4=sky 5=mt-fondo 6=mt-medias 7=mt-frente 8=lines
  u7MagentaIdx:  0,
  // U9: dawn sequence
  amanecerDurS:       10.0,  // phase 1 duration (s) — AMANECER_DURACION_S
  amanecerSectorDeg:  90.0,  // mountain sector full width (°)
  amanecerEdgeDeg:     8.0,  // soft edge width (°)
  amanecerP2StaggerS:  1.0,  // stagger between layers in phase 2 (s)
  amanecerP2GrowS:     4.0,  // phase 2 grow duration (s)
  // U10A: camera parallax per layer
  parFrenteFact:  0.93,   // frente position factor (lower → more parallax vs fondo)
  parMediasFact:  0.97,   // medias position factor
  parPitchFre:    0.04,   // V shift per radian of camera pitch (frente)
  parPitchMed:    0.02,   // V shift per radian of camera pitch (medias)
  parYawTau:      0.40,   // yaw-lag decay time constant (s)
  parYawScale:    0.50,   // yaw delta → UV offset scale
  // U10B: sound reactions
  mtWaveAmp:      0.25,   // traveling wave amplitude (UV fraction, ±)
  mtWaveFreq:     2.0,    // wave cycles across azimuth
  mtWaveSpd:      1.5,    // wave speed at full energy (cycles/s)
  mtKickShkFreDeg: 1.5,   // frente kick-shake amplitude (degrees, ±)
  mtKickShkMedDeg: 1.0,   // medias kick-shake (degrees)
  mtKickShkFonDeg: 0.5,   // fondo kick-shake (degrees)
  mtKickSpringK:  120,    // spring stiffness (1/s²)
  mtKickSpringD:   18,    // spring damping (1/s)
  mtEdgeGlow:     2.0,    // max edge-glow intensity
  mtEdgePxH:      3,      // edge-glow detection height (texture pixels / 512)
  mtEdgeColor:    '#EE8A2B' as string, // edge glow color (warm orange)
  mtSepAzDeg:     2.0,    // layer-separation max (degrees)
  mtTintMaxMix:   0.35,   // max tint blend (0–1)
  mtTintColor:    '#E07030' as string, // tint color (warm orange/red)
  mtFogFondo:     0.15,   // atmospheric fog for fondo (furthest layer)
  mtFogMedias:    0.07,   // atmospheric fog for medias
  mtFogFrente:    0.00,   // atmospheric fog for frente (none)
  mtFogColor:     '#1b1428' as string, // fog color (dark purple-black)
  // U11: camera feedback on haz-toggle (on = shake + full glare; off = dim glare only)
  u11ShakeAmpDeg:   0.6,   // shake rotation amplitude (degrees)
  u11ShakeTauS:     0.17,  // shake exponential decay τ (s) → ~0.5 s duration
  u11GlarePeakOp:   0.85,  // on-toggle glare peak opacity
  u11GlareAtkS:     0.08,  // glare attack time (s)
  u11GlareTauS:     0.22,  // glare exponential decay τ (s) → ~0.8 s visible
  u11GlareDimOp:    0.30,  // off-toggle glare peak opacity (no shake)
  u11FlareCount:    3,     // lens flare circles count (1–4)
  u11ChromaMs:      150,   // chromatic aberration duration (ms, on-toggle only)
  u11GlareRadiusFr: 0.40,  // radial glow radius as fraction of screen height
  u11StreakLenFr:   1.10,  // anamorphic streak length as fraction of screen width
  u11StreakHFr:     0.012, // anamorphic streak height as fraction of screen height
  // AA1: modo domo original — fuerza usarDomoShader=false y oculta piso en vizActive
  domoOriginal:           false,       // AA1: true = recuperar domo pre-W1 (VizPanorama + esfera PANORAMA_FRAG)
  // AA2: shader en la malla del domo (vs esfera aparte); requiere domoOriginal=false
  domoShaderEnMalla:      true,        // AA2: true = DomeSky en el mesh del domo; false = esfera DomeSkyAnchor
  // W1: dome shader sky (replaces VizPanorama when true)
  usarDomoShader:         true,        // W1: replace panorama layers with DomeSky shader
  // Z1: radio de la esfera de DomeSky. W1 usó 100 (demasiado grande — objetos se veían chicos);
  // correcto es DOME_R=28 para igualar el tamaño del domo interior. Requiere reload para surtir efecto.
  domeSkySphereR:         28,          // Z1: DomeSky sphere radius (was 100 in W1; DOME_R=28 is correct)
  domePortalAzimuth:      Math.PI,     // portal direction: behind tarima (+Z from audience)
  domePortalElevation:    0.40,        // portal elevation above horizon (rad) — AA3: 0.58→0.40
  domePortalHalfFovDeg:   28.0,        // portal half-FOV (degrees) — AA3: 42→28 (tan≈0.53)
  // W2: group energy multipliers (uniforms en DomeSky)
  // W5-P1: SOL y CIELO son los más visibles; MONTAÑAS y LÍNEAS tienen efectos sutiles → mult más alto
  domeSolAmt:             1.5,         // SOL: anillos pulsantes + halo del sol (ya muy visible)
  domeMontAmt:            3.0,         // MONTAÑAS: despl. 2% + brillo 8% (sutil → x2 default)
  domeCieloAmt:           2.0,         // CIELO: domain warp + estrellas + confeti (moderado → ×1.3)
  domeLinAmt:             3.0,         // LÍNEAS: amplitud ola 0.010UV + 10% brillo (muy sutil → x2 default)
  domeKickAmt:            1.0,         // KICK: destello de rebote
  // W3: secuencia de amanecer (DomeSky)
  domeAmanecerDurS:       10.0,        // duración fase 1 (s)
  domeRevDelayMontS:       1.0,        // delay MONTAÑAS strata tras completeT (s)
  domeRevDelayLinS:        2.0,        // delay LÍNEAS waves (s)
  domeRevDelaySolS:        3.0,        // delay SOL rings (s)
  domeRevDelayCieloS:      4.0,        // delay CIELO stars+warp+confeti (s)
  domeRevDurS:             3.0,        // duración de cada reveal (s)
  // W4: ajuste fino de shader (live vía getShaderParams — sin recrear material)
  domeWarp:               1.0,         // intensidad del domain warp (0–2)
  domeRingFlow:           0.03,        // velocidad de flujo de los anillos
  domeRingScale:          1.0,         // multiplicador del periodo de anillos
  domeRingFade0:          1.0,         // ringFade inicio (unidades p)
  domeRingFade1:          1.6,         // ringFade fin
  domeStarCut:            0.965,       // umbral de estrellas (más alto = menos)
  domeLowQuality:         false,       // menos octavas fbm (requiere remount del material)
  showDomeMeters:         false,       // W4: panel de medidores oculto por defecto
  // W5: máscaras suaves 2048×2048
  domeSiluetasSuaves:     false,       // W5: usar portal-masks-2k.png con blur + smoothstep
  domeSoftEdge:           0.35,        // W5: suavidad de bordes (0=duro, 1=muy suave)
  // X2: panel de diagnóstico (oculto por defecto)
  showDomeX2:             false,       // X2: mostrar bloque diagnóstico en DebugMenu
};

// X2: live dome diagnostic — written by DomeSky/DomeSkyAnchor useFrame, polled by DebugMenu
export const DBG_DOME_LIVE = {
  uDawn: 0, revX: 0, revY: 0, revZ: 0, revW: 0,
  geX: 0, geY: 0, geZ: 0, geW: 0,
  kick: 0, portalTan: 0,
  phase: 'inactivo' as string,
  masksW: 0, masksH: 0, masksCS: '' as string,
  colorW: 0, colorH: 0, colorCS: '' as string,
  pFX: 0, pFY: 0, pFZ: 0,
  pRX: 0, pRY: 0, pRZ: 0,
  pUX: 0, pUY: 0, pUZ: 0,
};

// X2: force override — written by DebugMenu buttons, read by DomeSky useFrame
export const DBG_DOME_FORCE = {
  visible: false,  // 2a: forzar uDawn=1, uReveal=(1,1,1,1), uGroupEnergy=(0.6,0.6,0.6,0.6)
  masks:   false,  // 2b: pintar canales de máscara como colores de prueba (R/G/B)
};

// ── Sector audio effects (SILLAS path, H3) ────────────────────────────────────
export const DBG_EFFECTS = {
  lpEnd:       300,   // sector 0 (LP): cutoff at t=1 (Hz)
  hpEnd:       3000,  // sector 1 (HP): cutoff at t=1 (Hz)
  rateEnd:     1.75,  // sector 2: playback rate at t=1
  echoFbEnd:   0.55,  // sector 3: echo feedback at t=1
  echoMixEnd:  0.70,  // sector 3: echo wet mix at t=1
  reverbMixEnd:0.70,  // sector 3: reverb wet mix at t=1
  simEnabled:  false, // debug: simulate player position
  simSector:   -1,    // simulated sector (-1 to 3)
  simT:        0,     // simulated t (0–1)
};

// ── Floor visualizer (SILLAS path, H2) ────────────────────────────────────────
// DOME_R = 28; tarima half-diagonal ≈ 2.257 m → innerR = 2.257 + 0.3 = 2.56 m
export const DBG_FLOOR = {
  innerR:      2.6,        // mask radius around tarima (m)
  outerR:      27.5,       // disk outer radius = DOME_R - 0.5 (m)
  rotationDeg: 0,          // rotation of sector dividers (deg, CW from above)
  opacity:     0.85,
  baseSpeed:   1.0,        // FLOOR_BASE_SPEED
  speedGain:   5.0,        // FLOOR_SPEED_GAIN
  speedExp:    1.2,        // FLOOR_SPEED_EXP
  speedMode:   "spatial"  as "spatial" | "user",
  typeMinS:    4,          // min seconds between auto type change
  typeMaxS:    12,
  // -1 = auto; 0-3 = forced type for that sector
  s0Type:      -1,
  s1Type:      -1,
  s2Type:      -1,
  s3Type:      -1,
};

// W4: medidores del domo — DomeSkyAnchor escribe aquí cada frame; DebugMenu lee con poll
export const DOME_METERS = {
  sol: 0, mont: 0, cielo: 0, lin: 0,
  kick: 0, dawn: 0,
  phase: 'inactivo' as string,
};

// ── TARIMA path ───────────────────────────────────────────────────────────────
export const DBG_STARS = {
  twinkleSpeed:  1.0,   // live: writes to DBG_STAR_MAT.value.uniforms.uTwinkleSpeed
  fadeDurMs:     3000,  // info only
  count:         2000,  // info only
  sizeMin:       0.07,  // info only
  sizeMax:       0.42,  // info only
  brightnessMin: 0.35,  // info only
  brightnessMax: 1.0,   // info only
};

export const DBG_DOME = {
  delayMs:          15_000, // ms before face dome appears (info only)
  glitchIntervalMs: 5_000,  // ms between effect rotation (info only)
};

export const DBG_FACE = {
  captureMs:        8_000, // T1: ms to scan for best frame before fallback
  qualityThreshold: 0.15,  // T1: score ≥ this → capture immediately
};

// J1: timing constants (module-level so alightStore / Audience can import them)
export const PEOPLE_MIN_DELAY_MS      = 5_000;  // min ms from stars-visible to people-visible
export const LECTERNS_AFTER_PEOPLE_MS = 10_000; // ms from people-visible to lecterns request
export const LECTERN_OUTWARD_OFFSET_M = 0.30;   // extra outward offset added to LECTERN_X

// J4: TARIMA audio-effect tuning constants (exposed in debug menu)
export const DBG_AUDIO = {
  // Phaser
  phaserBaseFreq: 1000, // allpass center frequency (Hz) — reload to apply
  phaserQ:        10,   // allpass Q — reload to apply
  // Pitch shifter
  grainDurMs:     80,   // granular grain duration (ms) — reload to apply
  // Lights
  lightStep:      0.1,  // LUZ+/LUZ- intensity step
  lightMin:       0.2,  // minimum globalIntensity
  lightMax:       3.0,  // maximum globalIntensity
  lightHoldMs:    120,  // hold-repeat interval (ms) — reload to apply
  maxExtraLights: 12,   // cap on random extra lights from LUZ*
};

// K1: per-side lectern camera debug overrides (TARIMA path)
// Set override: true to bypass fitLecternCamera and use the manual values below.
// Apply by re-entering the lectern (press Q then E).
export const DBG_CAM_IMAGE = {
  override: false,
  fov:     75,
  height:  0.90,
  dist:    0.75,
  pitch:  -22,
};

export const DBG_CAM_SOUND = {
  override: false,
  fov:     60,
  height:  0.80,
  dist:    0.80,
  pitch:  -45,
};

export const DBG_LECTERNS = {
  delayMs:          10_000, // legacy — no longer used for trigger (kept for reference)
  lightIntensity:   120,    // SpotLight per lectern (W-equivalent)
  emissiveBrightness: 0.7,  // emissiveIntensity for active buttons/knobs
  panelW:           1.50,   // J2: inner black panel width (m) — geometry reload needed
  panelD:           0.75,   // top plate depth  (m) — geometry reload needed
  yawOffsetDeg:     0,      // I1: fine-tune offset (deg) added to atan2 formula — geometry reload needed
  yawFlipLeft:      false,  // I1: debug toggle — invert left lectern 180°
  yawFlipRight:     false,  // I1: debug toggle — invert right lectern 180°
  // J1: per-side camera (re-enter mode to apply)
  camFov:           55,     // horizontal FOV (deg) — shared
  camPitchLeft:    -12,     // image lectern camera pitch (deg, negative = down)
  camPitchRight:   -25,     // sound lectern camera pitch (deg, negative = down)
  camHeightLeft:    0.45,   // image lectern camera height above plate centre (m)
  camHeightRight:   0.55,   // sound lectern camera height above plate centre (m)
  showGizmo:        false,  // J1: show I1 debug arrow gizmo
  showSections:     false,  // J3: overlay section frames + cell grid in dev mode
  knobSens:         2.5,    // knob full-range sweep as fraction of screen diagonal
  debugOverlays:    false,  // L5: show lectern status line — off by default
};

// ── J5: retro skin (cassette futurism) for TARIMA lecterns ───────────────────
export const DBG_RETRO = {
  lecterns:  true,   // J5: beige/carbón + desgaste — live (rótulos/teclas: reload)
  wear:      0.55,   // J5: edge wear + chipped paint amount (0–1) — live
  wearScale: 6,      // J5: wear noise frequency (1/m) — live
  grime:     0.35,   // J5: dirt in noise valleys (0–1) — live
  crtCurve:  0.08,   // J5: indicator CRT barrel distortion — live
  crtScan:   0.30,   // J5: indicator CRT scanline intensity — live
};

// ── Z27: terminal de diálogo (DialogoTerminal.tsx) ───────────────────────────
export const DBG_DIALOGO = {
  VEL_CPS:           38,     // caracteres por segundo al tipear (0 = instantáneo) — live
  PAUSA_MS:          350,    // pausa entre líneas y antes de mostrar las opciones — live
  MARCAR_PENDIENTES: false,  // con el menú debug abierto: "[LÍNEA PENDIENTE id]" en vez de fin — live
  POSICION:          "abajo" as "abajo" | "izquierda" | "derecha", // tercio inferior o costado — live
  ANCHO_VW:          46,     // ancho en % del viewport (tope 60) — live
  ALTO_VH:           34,     // alto máximo de la pantalla en % del viewport — live
  MARGEN_PX:         24,     // separación del borde de la ventana — live
  FUENTE_PX:         17,     // tamaño del texto — live
  HISTORIAL:         6,      // líneas visibles (las anteriores se atenúan) — live
};

// Z27: visibilidad del menú de debug (Shift), la escribe DebugMenu. La terminal la lee para
// decidir si marca las líneas pendientes.
export const DEBUG_MENU_ESTADO = { visible: false };

// ── Z28: camino LUZ (luz lejana, estrellas, salida de la sala, diálogo) ──────
export const DBG_LUZ = {
  CAMINO_LUZ:          true,   // false = sin luz, sin estrellas, sin límites nuevos ni pausa (comportamiento previo)
  // posición: LUZ_DISTANCIA_M desde el spawn (Z25), en sentido opuesto al telón; o manual
  LUZ_DISTANCIA_M:     40,     // m desde el punto de inicio — live
  LUZ_POS_MANUAL:      false,  // true = usar LUZ_POS_X / LUZ_POS_Z — live
  LUZ_POS_X:           -46.9,  // m (solo con LUZ_POS_MANUAL)
  LUZ_POS_Z:           -32.8,  // m (solo con LUZ_POS_MANUAL)
  LUZ_ALTURA_M:        4.5,    // altura del centro de la luz — live
  LUZ_COLOR:           "#FFE2A8" as string,
  LUZ_HALO_M:          3.2,    // diámetro del halo (sprite) — live
  // intensidad según cercanía: lejos → cerca, k = t^LUZ_CURVA
  LUZ_INT_LEJOS:       0.45,   // tenue a lo lejos — live
  LUZ_INT_CERCA:       2.2,    // debajo — live
  LUZ_D_LEJOS_M:       45,     // a partir de acá intensidad mínima — live
  LUZ_D_CERCA_M:       2,      // a partir de acá intensidad máxima — live
  LUZ_CURVA:           2.0,    // exponente de la curva (1 = lineal, >1 sube al final) — live
  // cono de luz sobre el suelo
  CONO_RADIO_M:        2.4,    // radio del cono en el suelo — live
  CONO_OPACIDAD:       0.22,   // opacidad máxima del cono — live
  CONO_D_INICIO_M:     16,     // el cono empieza a verse a esta distancia — live
  POZO_OPACIDAD:       0.35,   // charco de luz en el suelo — live
  // estrellas (un solo Points)
  ESTRELLAS_N:         1400,   // cantidad (recargar)
  ESTRELLAS_MAX:       0.85,   // opacidad máxima — live
  ESTRELLAS_D_LEJOS_M: 40,     // empiezan a encenderse a esta distancia de la luz — live
  ESTRELLAS_D_CERCA_M: 4,      // brillo máximo — live
  ESTRELLAS_TAM_PX:    2.2,    // tamaño base en px — live
  // Z30: cielo estrellado procedural (lib/estrellasCielo.glsl.ts, CieloEstrellado.tsx)
  ESTRELLAS_MODO_VIEJO:    false,  // true = vuelve el Points de Z28 (y se apaga el cielo shader) — live
  ESTRELLAS_SOLO_FUERA:    false,  // true = solo fuera de la sala (como Z28) — live
  ESTRELLAS_MODO_Z30:      false,  // Z31: true = rampa vieja de Z30 (inicio absoluto ESTRELLAS_DIST_INICIO_M) — live
  ESTRELLAS_DIST_INICIO_M: 75,     // Z30 (solo con ESTRELLAS_MODO_Z30): distancia absoluta de inicio — live
  ESTRELLAS_MARGEN_INICIO_M: 1.5,  // Z31: el reveal empieza en dSpawn − margen (0 en el spawn) — live
  ESTRELLAS_DIST_PLENO_M:  2,      // Z31 (era 6): reveal = 1 a esta distancia o menos (= radio de activación) — live
  ESTRELLAS_CURVA:         1.3,    // Z31 (era 1.6): exponente sobre el smoothstep — live
  ESTRELLAS_REVEAL_MAX:    1,      // tope de uReveal — live
  ESTRELLAS_INERCIA_S:     0.5,    // Z31 (era 0.6): constante de tiempo del suavizado del reveal — live
  ESTRELLAS_ATENUAR_EN_VISUALIZADOR: 0.15, // factor dentro del área con visualizador o secuencias SILLAS/TARIMA — live
  ESTRELLAS_ATEN_TRANS_S:  1.2,    // constante de tiempo de esa atenuación — live
  ESTRELLAS_FORZAR_REVEAL: -1,     // −1 = automático; 0..1 fuerza uReveal (probar sin caminar) — live
  ESTRELLAS_CALIDAD:       3,      // capas por píxel: 3 alta · 2 media · 1 baja — live
  ESTRELLAS_DEPTH_TEST:    true,   // true = paredes, tarima y objetos tapan el cielo; false = encima de todo — live
  ESTRELLAS_SOBRE_TECHO:   false,  // true = el techo (y=22) deja de escribir profundidad siempre (Z30) — live
  ESTRELLAS_COBERTURA:     true,   // Z32: el cielo CUBRE lo de atrás (premultiplicado, renderOrder −0.5); false = aditivo de Z31 (renderOrder 10) — live
  ESTRELLAS_COBERTURA_RAPIDA: 0.12, // Z33: reveal con el que la cobertura llega a 1 (desacoplada del brillo) — live
  ESTRELLAS_FONDO_COLOR:   "#0a0812" as string, // Z33: color de fondo que usa la cobertura (= scene.background) — live
  ESTRELLAS_COB_MODO_Z32:  false,  // Z33: true = cobertura de Z32 (cob = gv), para comparar — live
  ESTRELLAS_SALA_SIN_PROFUNDIDAD: true, // Z31: con el cielo visible, techo y paredes no escriben profundidad → cielo continuo — live
  ESTRELLAS_CONGELAR_EN_PAUSA: false, // true = el titilar y la deriva se congelan con la pausa Z28 — live
  ESTRELLAS_TOPE:          1.0,    // tope por canal de la salida (bloom threshold 0.92: solo los núcleos más fuertes brillan) — live
  ESTRELLAS_U_BRILLO:      1.6,    // uBrillo — live
  ESTRELLAS_U_DENSIDAD:    0.85,   // uDensidad — live
  ESTRELLAS_U_TWINKLE:     1.0,    // uTwinkle — live
  ESTRELLAS_U_PAN:         0.01,   // uPan (rad/s) — live
  ESTRELLAS_TINTE_HORIZONTE: "#1a2e73" as string, // uTinteHorizonte — live
  // sala y salida
  SALA_MEDIA_M:        40,     // media del cuadrado de la sala (paredes a ±40)
  SALA_MARGEN_M:       0.5,    // no se camina a menos de esto de una pared cerrada
  PAREDES_ABIERTAS:    true,   // oculta las paredes oeste (x=−40) y sur (z=−40), las del lado de la luz — live
  LIMITES:             true,   // límites de movimiento: sala ∪ exterior alrededor de la luz — live
  EXTERIOR_RADIO_M:    26,     // radio caminable (y del suelo exterior) alrededor de la luz — live
  AREA_HIST_M:         1,      // histéresis de salir/volver al área (pausa) — live
  // activación del diálogo
  ACTIVACION_M:        2,      // radio horizontal bajo la luz — live
  ACTIVACION_SALIDA_M: 3,      // hay que salir de este radio para rearmar — live
  GIRO_MS:             1500,   // giro de cámara hacia la luz — live
  PITCH_MAX_DEG:       55,     // tope de mirada hacia arriba — live
  CIERRE_DIALOGO_MS:   2500,   // tras alight:dialogo-fin, se cierra la terminal — live
  TELEPORT_DIST_M:     4,      // botón "Teletransportar a la luz": queda a esta distancia, mirándola
  PAUSA:               true,   // pausar la experiencia al salir del área — live
};

// ── Z32: diagnóstico TEMPORAL del cielo estrellado (panel plegado en el DebugMenu) ──
// Con ACTIVO false no hace nada. Oculta superficies con material.visible (no pelea con los useFrame que
// manejan object.visible) y publica una tabla de colores / renderOrder / transparencia / profundidad.
export const DBG_DIAG_CIELO = {
  ACTIVO:               false,
  OCULTAR_CASCARON:     false,  // caparazón del domo original (domo-cascaron)
  OCULTAR_CIELO_DOMO:   false,  // cielo/arte interior del domo (domo-cielo, DomeSky)
  OCULTAR_TECHO:        false,  // room-ceiling
  OCULTAR_PAREDES:      false,  // room-walls (las 4, incluidas las abiertas)
  OCULTAR_PISO:         false,  // room-floor
  OCULTAR_SUELO_EXT:    false,  // luz-suelo-exterior
  SIN_FOG:              false,  // scene.fog = null (recompila materiales: solo para diagnóstico)
  FONDO_TESTIGO:        false,  // scene.background magenta: muestra dónde se ve el fondo
};
