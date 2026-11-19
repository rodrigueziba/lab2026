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

// ── Z96: atril de SONIDO rediseñado ("SONIDO SN-40": lib/atrilSonido.ts, components/AtrilSonidoNuevo.tsx) ──
// DISENO_NUEVO false = layout anterior (J3) tal cual. El atril de imagen no cambia.
export const DBG_ATRIL_SONIDO = {
  DISENO_NUEVO:    true,    // — live (redibuja el atril)
  PLAY_ESCALA:     1.0,     // PLAY/PAUSA grande: 1 = 32 × 8,2 cm (23 % del ancho del panel) — live
  ETIQUETA_ESCALA: 1.0,     // multiplica el alto de títulos y etiquetas (los lejanos ya son más grandes) — live (redibuja la serigrafía)
  DISPLAY_VALOR_S: 2.5,     // s que el display muestra el control tocado (nombre y valor) antes de volver al estado — live
  VU_HZ:           30,      // tope de actualización del VU y del display (solo con el atril en pantalla) — live
  // Z96b
  VU_SEG_AMBAR_DESDE:   9,      // de 14 segmentos: 0…8 verdes, 9…11 ámbar — live
  VU_SEG_ROJO_DESDE:    12,     // 12 y 13 rojos (los últimos 2) — live
  VU_PICO_RETENCION_MS: 800,    // el pico se queda arriba esto y después baja un segmento por tick — live
  ROTULOS_FILA:         true,   // rótulos de fila (EFECTOS · TONO · TRANSPORTE) — live (rehace la placa)
  ROTULOS_MODO:         "barra" as string,   // "barra" (leyenda numerada en la barra + números en el margen) | "margen" (verticales; TRANSPORTE no llega a 2 %) — live
  ETIQUETA_AUTO_ASPECTO: true,  // proporción < 1,6: ETIQUETA_ESCALA sube hasta × 1,15 (acotada por lugar) — live (rehace la serigrafía)
};

// ── Z97: atril de IMAGEN rediseñado ("IMAGEN IM-40": lib/atrilImagen.ts, lib/domoEfectos.ts, components/AtrilImagenNuevo.tsx) ──
// DISENO_NUEVO false = atril de imagen anterior (J3) tal cual, con la rotación fija de 5 s. El atril de sonido no cambia.
export const DBG_ATRIL_VIDEO = {
  DISENO_NUEVO:          true,    // — live (redibuja el atril)
  ETIQUETA_ESCALA:       1.0,     // multiplica títulos y etiquetas — live (rehace la serigrafía)
  ETIQUETA_AUTO_ASPECTO: true,    // proporción < 1,6: hasta × 1,15 (acotado por lugar) — live
  DISPLAY_VALOR_S:       2.5,     // s que el display muestra el control tocado — live
  VELOC_MIN_S:           1,       // rango de VELOC. (s entre pasos de la rotación AUTO) — live
  VELOC_MAX_S:           10,      // — live
  VELOC_DEFECTO_S:       5,       // como la rotación de hoy (vale al cargar) — live
  ROTULOS_FILA:          true,    // rótulos de fila DOMO · IMAGEN — live
  ROTULOS_MODO:          "margen" as string,   // "margen" (verticales) | "barra" (leyenda numerada en la placa) — live
  PADS_INICIO:           0x7f,    // pads encendidos al cargar (bit i = efecto i; 0x7f = los 7, como hoy) — vale al cargar
  // Cámara de la tecla E: "panel" = mira el panel (texto lejano ≥ 2,5 %; el domo queda fuera de cuadro) · "domo" = la de
  // hoy (el domo ocupa ~10 % de arriba de la pantalla, texto lejano 1,4 %). Vale al entrar con E.
  CAMARA:                "panel" as string,
  // Z97b: luces de ESCENA (lib/lucesEscena.ts). Nivel = STORE.lights.globalIntensity (multiplica el DiagonalSpot).
  LUZ_MIN:               0,       // nivel mínimo (LUZ -, INTENS.) — live
  LUZ_MAX:               3,       // nivel máximo (LUZ +, INTENS.; el rango que ya tenía la perilla) — live
  LUZ_PASO:              0.2,     // cuánto mueve cada pulsación de LUZ - / LUZ + — live
  LUZ_DEFECTO:           1.0,     // valor al cargar, con doble clic, en checkpoints y con "Restaurar luces del domo" — live
  LUZ_TOPE_FINAL:        3.0,     // tope del aporte total (nivel + EXTRA + luces extra del diseño anterior): ninguna combinación lo pasa — live
  EXTRA_APORTE:          0.6,     // cuánto suma la tecla EXTRA encendida (una sola luz fija; no acumula) — live
  EXTRA_REF_CD:          100,     // candelas de luz puntual que equivalen a 1 de aporte (EXTRA = 60 cd; antes 200 cd × hasta 12) — live
  EXTRA_COLOR:           "#FFB060" as string,   // luz cálida, sobre la tarima — live
  LUZ_REPETIR_AL_MANTENER: false, // true = LUZ ± repiten cada 120 ms mientras se mantienen apretadas (como antes) — live
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
  CURSOR_PARPADEO_S: 1.1,    // Z35: período del parpadeo suave del cursor ">" de la opción resaltada — live
  RESALTADO_INVERTIDO: true, // Z35: fila resaltada invertida (ámbar de fondo); false = solo el cursor ">" — live
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

// ── Z29: efectos del diálogo (lib/dialogo/efectosDialogo.ts) — todo live ──
export const DBG_EFECTOS = {
  EFECTOS_DIALOGO:       true,   // false = los tags "# efecto:" no ejecutan nada (comportamiento Z28)
  // juego_alarma
  ALARMA_VOLUMEN:        0.8,    // ganancia de alarm.mp3
  ALARMA_REF_M:          4,      // distancia de referencia del panner (volumen pleno hasta acá)
  ALARMA_MAX_M:          90,     // distancia máxima del panner
  ALARMA_ROLLOFF:        1.0,    // caída con la distancia (modelo "inverse")
  ALARMA_ALTURA_M:       0.8,    // altura de la fuente sobre el centro de la tarima
  FUNDIDO_APAGAR_MS:     1200,   // luces → LUCES_MIN
  FUNDIDO_ENCENDER_MS:   2000,   // luces → 1 al tocar la tarima
  LUCES_MIN:             0,      // multiplicador de intensidad con las luces apagadas
  TOQUE_MARGEN_M:        0.35,   // "tocar la tarima" = entrar a su planta + este margen
  ZONA_REARME_M:         3.5,    // tras el premio, la zona TARIMA se rearma al alejarse a más de esto del centro
  CIERRE_PREMIO_MS:      4000,   // tras el fin de la línea del premio se cierra la terminal
  PREMIO_DURACION_S:     3600,   // vigencia del premio en localStorage
  // ir_tarima_sin_publico
  ATRILES_DELAY_MS:      800,    // tras elegir TARIMA, se piden los atriles (alight:request-lecterns)
  AVISO_DESBLOQUEO_MS:   6000,   // aviso tenue "menú desbloqueado"
};

// ── Z34: velocidad de caminata (WASD) — Player de ThreeScene, único lugar donde se camina ──
export const DBG_MOV = {
  VELOCIDAD_FACTOR:  0.5,   // multiplica la caminata (1.0 = velocidad anterior) — live
  POR_DELTA:         true,  // true = m/s × delta de tiempo (igual a 30 o 144 fps); false = paso fijo por frame (Z33 y antes) — live
  VELOCIDAD_BASE_MS: 7.2,   // m/s con factor 1 (= 0.12 m/frame × 60 fps, el valor anterior a 60 fps) — live
  PASO_POR_FRAME_M:  0.12,  // paso por frame del modo anterior (POR_DELTA false) — live
  DT_MAX_S:          0.1,   // tope del delta: un tirón de frames no se convierte en un salto — live
};

// ── Z38: máquina única del amanecer (lib/amanecer.ts) ──
export const DBG_AMANECER = {
  UNIFICADO:          true,   // false = las dos máquinas viejas (U9 alightStore + W3) exactamente como antes — live
  AMANECER_DUR_S:     10,     // duración de la fase 1 (única). amanecerDurS / domeAmanecerDurS quedan para el modo viejo — live
  MONOLITOS_CAPTURA:  false,  // Z40: false (era true) — la captura produce 1–3 s de colores falsos en toda la pantalla al completarse el amanecer — live
};

// ── Z39: reloj único de la experiencia y secuencia SILLAS por eventos (lib/relojExperiencia.ts,
// lib/secuenciaSillas.ts) ──
export const DBG_SECUENCIA = {
  RELOJ_UNIFICADO:  true,   // false = exactamente lo anterior (clock.elapsedTime, setTimeout, Date.now, performance.now) — live
  TOPE_REVELADO_S:  14,     // tope de seguridad: dome-revealed igual a los N s de experiencia desde prism-landed — live
  REVELADO_MIN_S:   9.8,    // dome-revealed nunca antes que esto (= el setTimeout de 9_800 ms de antes) — live
  REVELADO_POR_S:   0.42,   // avance de uReveal por segundo (= 0.007 por frame × 60 fps) — live
};

// ── Z40: checkpoints de la experiencia (lib/checkpoints.ts) ──
export const DBG_CHECKPOINTS = {
  HABILITADOS:    true,   // false = el menú y ?checkpoint= no hacen nada (el efecto de ink ir_checkpoint sigue) — live
  ADELANTO_S:     1.0,    // s de reloj de la experiencia que se adelantan por frame para llegar a sala_activa — live
  RECIBIR_DIST_M: 5,      // Z95: "sillas_recibir": distancia al monolito de sonido (fuera de RADIO_INICIO_M = 3 m) — live
};

// ── Z41: layout de sillas, zona SILLAS, público y monolitos (lib/layoutSala.ts) ──
// ── Z61: fluir de color dentro de los dos bloques de la composición central del domo (lib/fluidoBloques.ts y
// dome.frag.glsl, implementación propia de la técnica general de domain warping). AZUL = cordilleras del centro
// (grupo MONTAÑAS); NARANJA = olas/estratos cálidos de abajo (grupo LÍNEAS). Las siluetas y líneas no cambian. ──
export const DBG_FLUIDO = {
  ACTIVO:          true,   // false = exactamente como antes de Z61 — live
  MEZCLA_AZUL:     0.9,    // Z63 (Z61 0,6): cuánto del color fluido se aplica al bloque azul — live
  MEZCLA_NARANJA:  0.9,    // Z63 (Z61 0,6): ídem bloque naranja — live
  ESCALA:          2.2,    // Z63 (Z61 3,0): manchas en uv × ESCALA… ver ESCALA_Y — live
  ESCALA_Y:        4.0,    // Z63: el bloque es bajo y ancho: estira el ruido en vertical para que entren varias manchas — live
  VEL_BASE:        0.08,   // Z63 (Z61 0,05): deriva sin música — live
  ACELERA:         4,      // Z63 (Z61 2,5): la energía multiplica la velocidad por (1 + ACELERA·e) — live
  WARP:            1.6,    // Z63 (Z61 1,2): cuánto distorsiona el campo (con música sube hasta × 2,5) — live
  LUZ_FLUJO:       0.35,   // Z63 (Z61 0,25; pedido 0,5: con 0,5 el azul pálido quemaba a blanco): variación de luminosidad del fluido — live
  PULSO_LUZ:       0.6,    // Z63 (Z61 0,35): cuánto sube la luminosidad con la música — live
  MUSICA_AZUL:     1.0,    // ganancia de la energía del grupo MONTAÑAS — live
  MUSICA_NARANJA:  1.0,    // ganancia de la energía del grupo LÍNEAS — live
  SUAVIZADO_S:     0.3,    // bajada de la energía (s) — live
  ATAQUE_S:        0.05,   // Z63: subida de la energía (s): los golpes llegan arriba — live
  CALIDAD:         3,      // octavas del ruido (2…4) — live
  // Z63: el campo se normaliza al rango observado del fbm distorsionado (p3–p97 medido en Node) y pasa por una curva
  RANGO_MIN:       0.35,   // — live
  RANGO_MAX:       0.72,   // — live
  // Z63: la textura es solo detalle: luminancia del píxel / luminancia media del bloque, con límites; la paleta va a brillo completo
  LUM_MEDIA_AZUL:  0.207,  // medida en portal-color.png (estratos + olas frías) — live
  LUM_MEDIA_NARANJA: 0.328,// medida en portal-color.png (olas cálidas) — live
  DETALLE_MIN:     0.3,    // las líneas oscuras siguen oscuras — live
  DETALLE_MAX:     1.2,    // — live
  TOPE:            0.55,   // Z65 (Z63 0,7): tope del color fluido: con el tonemapping ACES y la exposición de día (1,19), 0,85 ya se veía blanco — live
  TOPE_MODO:       "tono" as string,   // Z65: "tono" = escala el color entero hasta que su canal mayor toque TOPE (conserva tono y variación) · "canal" = min(color, TOPE) por canal, como Z63 (fijaba el rojo del naranja en TOPE y volvía gris el celeste pálido) — live
  DIA_ATENUA:      0.5,    // Z65: con luz de día (uLuzDia) comprime la luminosidad de la paleta hacia los medios: los pálidos bajan (×0,6·k) más de lo que suben los oscuros (×0,25·k). 0 = como Z63; de noche no actúa — live
  // Z63: energía: banda de cada bloque y ganancia automática
  BANDA_AZUL:      "auto" as string,   // "auto" (la más activa) · "grupo" (la de MONTAÑAS, al azar en cada carga, como Z61) · "0"…"3" — live
  BANDA_NARANJA:   "auto" as string,   // "auto" (la más activa que no use el azul) · "grupo" (la de LÍNEAS) · "0"…"3" — live
  MAX_S:           8,      // bajada del máximo móvil y subida del mínimo móvil (s) — live
  PISO:            0.02,   // piso del máximo (silencio: no amplifica ruido) — live
  SIMULAR_AZUL:    false,  // música simulada (pulsos tipo bombo) para el bloque azul — live
  SIMULAR_NARANJA: false,  // ídem bloque naranja — live
  PALETA_AZUL:     ["#16294A", "#1F4E8C", "#2A9D9A", "#7CC6E0", "#D2E8F0"] as string[],   // marino, azul profundo, turquesa, celeste, azul pálido — live
  PALETA_NARANJA:  ["#6A1209", "#B8361A", "#E8781E", "#F2BC32", "#F4E3BC"] as string[],   // Z65: rojo profundo, naranja, ámbar, amarillo, crema (Z63: #C8402A #F0742A #F4A23A #F4CE4A #F3E6C8) — live
};

// ── Z64: pasto que crece bajo las 4 luces del escenario (lib/pasto.ts, components/Pasto.tsx). Técnica de capas
// ("shells"), textura de briznas y viento adaptadas del pasto de un Shadertoy (autor y URL pendientes; CC BY-NC-SA 3.0
// asumida; ver CREDITOS.md). ──
export const DBG_PASTO = {
  ACTIVO:           true,   // false = sin pasto — live
  MONOLITOS_ACTIVO: true,   // Z65 (Z64 false): interruptor maestro: false = nunca aparecen (ni se montan, como Z64) — live
  MONOLITOS_MODO:   "pasto" as string,   // Z65: "pasto" = aparecen al completar los 4 cuartos (alight:pasto-completo) · "siempre" · "nunca" — live
  MONOLITOS_APARICION_S: 3, // Z65: suben desde el suelo (y se funden) en estos segundos, con el reloj de la experiencia — live
  MONOLITOS_BAJADA_S: 0,    // Z65: al reiniciarse el pasto (checkpoint) se hunden en estos segundos; 0 = desaparecen junto con él — live
  MONOLITO_SEP_M:   1.0,    // Z65: metros libres entre el borde del pasto y la cara más cercana de cada monolito (base 1,334 m) — live
  MARGEN_M:         2.0,    // el área = rectángulo de las 4 luces + este margen; cuartos = celdas de Voronoi — live
  RADIO_LUZ_M:      1.2,    // "bajo la luz" (histéresis +0,3 m al salir) — live
  CRECE_S:          14,     // segundos bajo la luz para llenar el cuarto — live
  DECAE_S:          7,      // segundos fuera de la luz para que se retire del todo — live
  IRREGULARIDAD:    0.6,    // 0 = círculo desde la luz · 1 = solo manchones — live
  ESCALA_MANCHA_M:  1.2,    // tamaño de los manchones (m) — live
  FRENTE_ANCHO:     0.25,   // franja del frente donde las briznas crecen desde el suelo (en unidades de p) — live
  CAPAS:            20,     // capas apiladas (8…40) — live
  ALTURA_M:         0.35,   // altura máxima de las briznas — live
  DENSIDAD:         110,    // texels de la textura de briznas por metro (más = briznas más finas y juntas) — live
  VIENTO_AMP:       0.65,   // desplazamiento de la punta (texels × 3) — live
  VIENTO_VEL:       0.35,   // velocidad del viento — live
  DARKNESS:         0.15,   // oscurecimiento abajo (falsa oclusión, como el original) — live
  PUNTAS_TINTE:     0.8,    // punta rojiza (× vec3(16; 1,5; 2,8) del original) — live
  BRILLO:           1.0,    // — live
  TINTE_LUZ:        0,      // 0 = verdes originales · 1 = teñido del color de la luz de su cuarto — live
  CAIDA_LUZ_M:      6,      // el brillo cae con la distancia a la luz de su cuarto (m) — live
  DIST_MAX_M:       28,     // desvanecimiento con la distancia a la cámara (m) — live
  OVERLAY:          false,  // celdas de cada cuarto, radios de las luces y p en el menú — live
  SIMULAR:          -1,     // −1 o 0…3: como si el usuario estuviera bajo esa luz (pruebas) — live
  // Z74: el pasto crece siempre que el usuario esté bajo la luz. Antes (Z64) además exigía la luz encendida, y como entrar
  // a la luz la enciende o la apaga (interruptor de las bandas, R3), crecía una vez sí y otra no
  REQUIERE_LUZ_ENCENDIDA: false,   // true = como antes (presencia Y luz encendida) — live
  // Z74: extensión hasta el borde del círculo del piso (lib/pastoExt.ts, components/PastoExtension.tsx)
  EXT_ACTIVO:       true,   // false = no hay extensión — live
  EXT_MODO:         "auto" as string,   // "auto" = arranca sola tras los monolitos · "manual" = solo con el botón — live
  EXT_RADIO_M:      "auto" as string | number,   // "auto" = radio del disco del piso (28 m) · o un número — live
  EXT_ARRANQUE_S:   2,      // s después de terminar la aparición de los monolitos — live
  EXT_DURACION_S:   25,     // s que tarda el frente en llegar al borde — live
  EXT_IRREGULARIDAD: 0.6,   // 0 = frente parejo · 1 = solo manchones — live
  EXT_BRILLO_MIN:   0.45,   // brillo ambiente de la extensión (× luz del día), lejos de las luces — live
  EXT_MAX_BLOQUES:  60,     // tope de bloques con capas dibujados a la vez (los más cercanos) — live
  EXT_OVERLAY:      false,  // radio, bloques activos y progreso (debug) — live
};

// ── Z66: rendimiento (lib/rendimiento.ts, components/RendimientoHost.tsx, components/RendimientoPanel.tsx,
// lib/pastoChunks.ts). Medición, interruptores por sistema (solo debug), resolución adaptativa y optimización del pasto. ──
export const DBG_RENDIMIENTO = {
  // resolución adaptativa (DPR del Canvas; el postproceso y el CRT lo siguen)
  DPR_MAX:        1.5,    // tope (Retina = 2: con 1,5 se dibuja el 56 % de los píxeles) — live
  DPR_MIN:        0.5,    // piso — live
  DPR_AUTO:       true,   // false = DPR fijo (el último escalón o el forzado) — live
  OBJETIVO_FPS:   50,     // si el promedio de una ventana queda por debajo, baja un escalón — live
  SUBIR_FPS:      58,     // si se sostiene por encima SUBIR_S, sube un escalón — live
  EVAL_S:         1.5,    // ventana de evaluación — live
  SUBIR_S:        4,      // segundos sostenidos por encima de SUBIR_FPS para subir — live
  ENTRE_CAMBIOS_S: 3,     // mínimo entre dos cambios (histéresis) — live
  REBOTE_S:       10,     // si tras subir hay que bajar antes de esto, ese escalón queda vedado REBOTE_VEDA_S — live
  REBOTE_VEDA_S:  30,     // — live
  // optimizaciones del pasto (cada una comparable con su flag) — live
  PASTO_CHUNKS:        true,   // bloques de ~CHUNK_M con frustum culling (Z64: una malla del rectángulo entero por cuarto)
  PASTO_CULL_PROGRESO: true,   // un bloque no se dibuja si p del cuarto ≤ el umbral mínimo de sus puntos (requiere CHUNKS)
  PASTO_LOD:           true,   // capas por distancia: CAPAS hasta LOD_CERCA_M, CAPAS_LEJOS desde LOD_LEJOS_M (requiere CHUNKS)
  PASTO_LEJANO:        true,   // suelo verde medio barato donde el pasto ya no se dibuja (en vez del negro de Z64)
  PASTO_VIENTO_BARATO: true,   // viento calculado por vértice (malla subdividida) en vez de por fragmento
  PASTO_DESCARTE_TEMPRANO: true, // cotas exactas del umbral antes del ruido de manchas (mismo resultado, menos cálculo)
  PASTO_MIPMAPS:       true,   // mipmaps de la textura de briznas (alfa por máximo: las briznas no desaparecen lejos) + anisotropía 2
  CHUNK_M:             4,      // lado aproximado de cada bloque (m)
  CAPAS_LEJOS:         6,      // capas a LOD_LEJOS_M o más
  LOD_CERCA_M:         8,      // hasta acá, CAPAS completas
  LOD_LEJOS_M:         20,     // desde acá, CAPAS_LEJOS
  LOD_HISTERESIS_M:    0.75,   // banda para no saltar de capas al moverse en el borde
  LEJANO_BRILLO:       1.0,    // brillo del suelo lejano respecto del color medio de las briznas
  // Z69: bloom (components/RetroPostFX + lib/retro/bloomLigero.ts; plan de niveles en lib/rendimientoPost.ts) — live
  BLOOM_OPTIMIZADO:    true,   // false = UnrealBloomPass como estaba (5 niveles desde la mitad de la resolución)
  BLOOM_CALIDAD:       "media" as string,   // "alta" (1 · 5 niveles = como estaba) | "media" (0,5 · 4) | "baja" (0,35 · 3): fija los dos de abajo
  BLOOM_ESCALA:        0.5,    // resolución del bloom respecto del canvas (1 = como estaba: su primer nivel a la mitad)
  BLOOM_NIVELES:       4,      // niveles de desenfoque (1…5); el radio total del halo se conserva. Se pidió 3: con 3 el halo
                               // cambia a la vista (disco marcado alrededor del sol); con 4 casi no cambia y cuesta < 1/3 del original
  // Z69: pases finales — live
  PASES_FUSIONADOS:    true,   // CRT + salida (ACES + sRGB) + suma del bloom + antialiasing en un único pase a pantalla
  ANTIALIAS_MODO:      "fxaa" as string,   // "ninguno" | "fxaa" (dentro del pase final; requiere PASES_FUSIONADOS) | "smaa" (pase aparte)
  ANTIALIAS_CONTEXTO:  false,  // MSAA del contexto WebGL (antes true: no actuaba sobre la escena, que se dibuja en targets sin MSAA). Requiere recargar
  // Z69: medición — live
  GPU_POR_PASE:        false,  // temporizador de GPU por pase (escena, fractal, bloom, AA, final) en vez de uno por cuadro
  LUCES_MONOLITO_DIFERIDAS: true, // las 2 SpotLights de los monolitos solo cuentan cuando se ven (precompiladas con compileAsync)
  // Z72: domo a escala (lib/domoEscala.ts): el shader del portal se dibuja en un target de escala × resolución — live
  DOME_ESCALA:         1,      // 1 = como estaba; perfiles media 0,75 y baja 0,5
  // Z72: objetivo de la resolución adaptativa según el refresco detectado (lib/rendimiento.ts, objetivosDpr)
  OBJETIVO_POR_REFRESCO: true, // con refresco ≥ 100 Hz: objetivo = refresco / 2 − MARGEN_ALTO_HZ (57 a 120 Hz); con 60 Hz, OBJETIVO_FPS
  MARGEN_ALTO_HZ:      3,
  SUBIR_FRACCION_ALTO: 0.75,   // con refresco ≥ 100 Hz, subir de escalón si se sostiene por encima de refresco × esto (90 a 120 Hz)
  RECORDAR_ESCALON:    true,   // guarda el último escalón estable (localStorage) y arranca ahí la próxima vez
  // Z72: pase final (evaluadas: no cumplen la diferencia ≤ 2/255; quedan apagadas para comparar)
  ACES_RAPIDO:         false,  // aproximación de ACES de Narkowicz en vez de la de three (RRT+ODT de Hill)
  FXAA_LIGERO:         false,  // FXAA sin la segunda pareja de lecturas (7 en vez de 9)
  // interruptores por sistema (solo debug; true = activo). Apagar quita el costo de dibujo (ver el reporte de Z66)
  SIS: {
    pasto: true, fractal: true, domo: true, anillos: true, flare: true, bloom: true, crt: true, salida: true,
    luces: true, flor: true, monolitos: true, telonTexto: true, estrellas: true,
    // Z72: sub-sistemas del shader del domo (uniforms uPerf* de dome.frag.glsl)
    domoFluido: true, domoSol: true, domoOndas: true, domoEstrellas: true, domoPortal: true, domoSiluetas: true,
    ritmos: true, videoDomo: true,   // Z80 caja de ritmos · Z83 video en el domo
    tiempoDetenido: true,            // Z86: historial, estela y efecto del tiempo detenido
    ondasTarima: true,               // Z87: dibujo del canvas de ondas de la tarima
    visualizadorTarima: true,        // Z98: visualizador retro (cascada / XY) del canvas de la tarima (false = queda el último cuadro)
    transmisionTarima: true,         // Z92: subida a LiveKit (false = pauseUpstream: sin codificar ni enviar)
    videoTransmitidoTarima: true,    // Z94: pase plano del domo + copia al canvas transmisible (false = queda el último cuadro)
    recepcionTarima:   true,         // Z93: recepción en SILLAS (false = des-suscribe audio y video sin desconectar)
    caraBajo:          true,         // Z100: lector de cara del BA-40 (false = no manda cuadros al worker)
  } as Record<string, boolean>,
};

// ── Z59: entrada fija después de cruzar el telón (lib/entradaTelon.ts, components/EntradaTelon.tsx) ──
// ── Z76: la luz del camino LUZ huye cuando el usuario vuelve (lib/luzHuida.ts, lib/luzMovimiento.ts, LuzHuida.tsx) ──
// Visita = apertura de la terminal bajo la luz. En la visita k la luz se mueve k − 1 veces, una celda (tablero de
// celdas = diámetro del haz, centrado en su origen) cada vez que el usuario se acerca a menos de DIST_HUIDA_M.
export const DBG_LUZ_MOV = {
  ACTIVO:           true,   // false = como antes de Z76 (la luz no se mueve; vuelve al origen) — live
  DIST_HUIDA_M:     5,      // huye si el usuario está a menos de esto (ACTIVACION_M 2 + 3) — live
  MOVER_S:          0.4,    // duración del deslizamiento (s) — live
  ANTICIPO_S:       0.12,   // temblor antes de moverse (s; 0 = sin anticipo) — live
  TEMBLOR_M:        0.15,   // amplitud del temblor del anticipo (m) — live
  ESPERA_S:         0.8,    // espera entre movimientos (s) — live
  RADIO_CELDAS:     3,      // nunca más de esto del origen (distancia de tablero: max(|col|, |fila|)) — live
  DIAGONALES:       true,   // movimientos al azar también en diagonal — live
  SEMILLA:          "auto" as string | number, // "auto" = aleatoria por sesión; un número = reproducible (aplica al reiniciar visitas)
  RESET_POR_VISITA: false,  // true = la luz vuelve al origen al empezar cada visita (al rearmar); false = acumulativa — live
  PERSISTENCIA:     "sesion" as string, // "sesion" = sessionStorage (sobrevive a recargar) · "memoria" = se pierde al recargar — live
  TAM_CELDA_M:      "auto" as string | number, // "auto" = diámetro total del haz (2 × 1,5 × CONO_RADIO_M = 7,2 m) — live
  REARME_M:         8,      // después de una visita, hay que alejarse más que esto para que vuelva a huir — live
  CORREDOR_M:       4,      // la celda solo vale si el disco caminable de la luz sigue tocando la sala con este margen — live
  OVERLAY:          false,  // dibuja la grilla, la celda actual y los contadores — live
};

export const DBG_ENTRADA = {
  ACTIVO:                 true,   // false = como antes de Z59 (el usuario queda donde cruzó el telón) — live
  POS_X:                  -7.4,   // pose de entrada (m); la altura de ojos es la de siempre (1,6) — live
  POS_Z:                  0.5,
  YAW_DEG:                -86.1,  // mirando al centro de la tarima (0, 0) desde (−7,4, 0,5): de frente a su lado −X, sillas (z = −7) a la izquierda — live
  PITCH_DEG:              0,      // — live
  BLOQUEO_EXTRA_S:        0.3,    // WASD sigue bloqueado esto después del fin del destello — live
  TOPE_S:                 12,     // seguridad: pase lo que pase, libera el movimiento a los TOPE_S del cruce — live
  DESTELLO_EN_REPETICION: true,   // si se cruza otra vez (telón repuesto desde debug), un destello de debug tapa el salto — live
  DESPLAZ_IZQ_M:          5,      // Z65: se suma a la pose: metros hacia la izquierda de la mirada (perpendicular al yaw, en el suelo); 0 = pose de Z59 — live
  MIRAR_TARIMA:           false,  // Z65: true = después del desplazamiento el yaw apunta al centro de la tarima (pitch igual); false = mismo yaw y pitch — live
  // Z75: modo de la pose. "linea_sillas" = POS_X/POS_Z/YAW como base y se corre a la izquierda de la mirada hasta el borde
  // exterior de la fila de sillas + MARGEN_LINEA_SILLAS_M (calculado desde layoutSala) · "desplazamiento" = Z65
  // (DESPLAZ_IZQ_M) · "manual" = POS_X, POS_Z y YAW tal cual (como los deja "Guardar pose actual como entrada") — live
  MODO:                   "linea_sillas" as string,
  MARGEN_LINEA_SILLAS_M:  1.0,    // Z75: metros más allá del borde exterior de la fila (hacia la izquierda de la mirada) — live
  DIST_MIN_OBJETOS_M:     0.6,    // Z75: distancia mínima a la tarima, a las sillas y a las zonas SILLAS/TARIMA (si no, se ajusta lo mínimo) — live
  YAW_EXTRA_DEG:          30,     // Z88: giro final hacia la DERECHA del usuario (+ = horario visto desde arriba); la posición se calcula con YAW_DEG; no aplica en "manual" — live
};

export const DBG_LAYOUT = {
  POSICIONES_NUEVAS:  true,   // false = exactamente las posiciones anteriores (offsets ignorados) — live
  SILLAS_OFFSET_M:    4,      // sillas + ZONA_SILLAS + público se alejan de la tarima (dirección tarima → sillas) — live
  MONOLITOS_OFFSET_M: 3,      // cada monolito se aleja de la tarima en dirección radial (sobre monolithDistM). Z65: ya no se usa con los monolitos del pasto (DBG_PASTO.MONOLITO_SEP_M) — live
};

// ── Z42: diseño de las 4 luces del visualizador (components/LucesHaz.tsx), estilo luz de la narrativa ──
// Halo (sprite) a la altura del origen del haz (DBG_SILLAS.hazOriginHM), cono hasta el piso y charco.
// Color de cada una = DBG_SILLAS.hazColor0…3. Reacción a su banda (la misma que su grupo del domo).
export const DBG_LUCES = {
  DISENO_NUEVO:     true,   // false = lámpara colgada + cono a franjas (HazSystem, diseño anterior) — live
  HALO_M:           1.8,    // diámetro del halo (m) — live
  CONO_RADIO_M:     1.05,   // radio del cono / charco en el piso (= hazConeFloorRM; la zona que activa es 1 m) — live
  CONO_OPACIDAD:    0.22,   // opacidad del cono encendido (la luz de la narrativa usa 0,22) — live
  POZO_OPACIDAD:    0.35,   // opacidad del charco encendido (narrativa 0,35) — live
  INT_ENCENDIDA:    1.6,    // brillo del halo encendido, sin música — live
  INT_APAGADA:      0.35,   // brillo del halo apagado (tenue: se ve dónde está la luz) — live
  APAGADA_CONO:     0.25,   // cono y charco apagados = este factor × encendidos — live
  // reacción a la música (energía 0–1 de la banda de esa luz; solo encendida, como su grupo del domo)
  REACT_INT:        1.2,    // brillo del halo: × (1 + REACT_INT · e) — live
  REACT_HALO:       0.6,    // tamaño del halo: × (1 + REACT_HALO · e) — live
  REACT_CONO:       1.3,    // opacidad del cono y del charco: × (1 + REACT_CONO · e) — live
  REACT_RADIO:      0.25,   // radio del cono y del charco: × (1 + REACT_RADIO · e) — live
  ATAQUE_S:         0.05,   // suavizado de subida de la energía (s) — live
  CAIDA_S:          0.30,   // suavizado de bajada (s) — live
  // ajuste por luz (multiplicadores sobre los globales; índice = haz 0…3)
  HALO_X:     [1, 1, 1, 1] as number[],
  RADIO_X:    [1, 1, 1, 1] as number[],
  CONO_X:     [1, 1, 1, 1] as number[],
  POZO_X:     [1, 1, 1, 1] as number[],
};

// ── Z43: fractal de las caras del prisma ("jungle fractal II", George Toledo 2015; lib/prisma/fractalJungla.glsl.ts) ──
// Progresión pura en lib/prisma/fractalProgresion.ts (prueba: scripts/fractal-test.mjs). Todo live.
export const DBG_FRACTAL = {
  DISENO_NUEVO:     true,   // false = exactamente el fractal anterior (S2, Julia con tono que gira)
  // progresión por distancia (distancia 3D del ojo al centro del prisma, como el S2 anterior)
  DIST_INICIO_M:    5.0,    // empieza a verse (= DBG_PRISM.nearM, donde hoy empieza a cambiar el material)
  DIST_MAX_M:       1.2,    // máximo (pegado a la cara: radio 1 m + diferencia de altura ojo/centro ≈ 0,4 m)
  INERCIA_60:       0.04,   // fracción por frame a 60 fps hacia el objetivo (= lerp 0,04 del S2), sin depender de los fps
  PROX_FORZADA:     -1,     // -1 = desactivado; 0…1 fuerza prox (ver el efecto sin caminar; ignora el aterrizaje)
  VEL_MIN:          0.15,   // velocidad de animación lejos (prox 0)
  VEL_MAX:          1.5,    // velocidad pegado (prox 1)
  OPACIDAD:         0.8,    // opacidad máxima (el S2 usaba 0,8)
  ALFA_OSCURO:      0.6,    // opacidad de la parte oscura respecto de la clara (se lee como forma oscura sobre el vidrio)
  BRILLO:           1.0,    // brillo base de la paleta
  BRILLO_PROX:      2.5,    // × (1 + prox · BRILLO_PROX), como el S2 (alimenta el bloom de cerca)
  // paleta (del S2: hsl(tono, 0,85, 0,55) en los tonos amarillo/naranja; oscuro = naranja × 0,12)
  COLOR_OSCURO:     "#1C1005" as string,
  COLOR_MEDIO:      "#EE882B" as string,   // hsl(0,08, 0,85, 0,55)
  COLOR_CLARO:      "#EEB72B" as string,   // hsl(0,12, 0,85, 0,55)
  // parámetros originales del shader
  ITERACIONES:      16,     // 1…32 (probar 10–12 si el costo es alto)
  CELULAR_ON:       true,   // ruido celular de Gustavson (2 búsquedas extra por píxel); cambiarlo recompila el material
  ZOOM:             2.0,
  BAILOUT:          12.0,
  X:                -0.7,
  Y:                0.3,
  OFFSET_X:         0.0,
  OFFSET_Y:         0.4,
  DEPTH_CULL:       0.1,
  GRANO:            1.0,    // el "rand" del original (grano fijo sobre la cara); 0 = sin grano
  // mapeo cara → coordenada del original (metros de la cara × ESCALA + CENTRO; la cara mide 1,75 × 1,88 m)
  ESCALA:           0.55,
  CENTRO_X:         0.5,
  CENTRO_Y:         0.28,
  // música (solo con el visualizador activo y prox > PROX_MIN_MUSICA; 0 apaga cada una)
  PROX_MIN_MUSICA:  0.15,
  MUSICA_GRAVES:    0.5,    // graves (< 250 Hz) → zoom
  MUSICA_MEDIOS:    0.5,    // medios (250 Hz – 4 kHz) → desplazamiento pequeño de X e Y
  MUSICA_AGUDOS:    0.5,    // agudos (> 4 kHz) → brillo
  MUSICA_SUAVE_S:   0.12,   // suavizado de cada banda (s)
  MUSICA_ENTRADA_S: 0.6,    // entrada/salida de la reacción al acercarse/alejarse (s)
  // caras
  CARAS_DISTINTAS:  false,  // true = uSemilla distinta por cara (hoy las tres iguales)
  // Z44: aspecto del original (jungle fractal II tal cual)
  PALETA_ORIGINAL:  true,   // colores exactos del original; false = versión dorada de Z43 (paleta de arriba)
  TINTE_PRISMA:     0.0,    // 0…1: mezcla el resultado hacia el color de la cara del prisma
  OPACIDAD_ORIGINAL: 1.0,   // opacidad máxima con la paleta original (1 = no se tiñe con el vidrio de atrás)
  ASPECTO_ORIGINAL: 0.5625, // alto/ancho del cuadro del original (16:9): position = (uv.x, uv.y · ASPECTO) − offset
  GRANO_RES:        1280,   // resolución virtual del rand (gl_FragCoord del original); 0 = continuo
  ENCUADRE_Y_M:     0.0,    // corre el cuadro del original hacia la punta de la cara (m); 0 = apoyado en la base
  COMPENSAR_SALIDA: 2,      // 2 = inversa de ACES + sRGB del OutputPass (valores de pantalla del original); 1 = solo sRGB; 0 = nada
  COMP_TOPE_LINEAL: 1.5,    // tope del valor compensado: 1,5 → máx. 232/255 en pantalla (el original llega a 255); más alto = blancos más fieles pero con bloom
  // Z45: rendimiento. El fractal se calcula una vez por actualización en una textura que comparten las 3 caras
  USAR_TEXTURA:     true,   // false = cálculo por píxel en cada cara (Z44). Con CARAS_DISTINTAS se usa siempre por píxel
  TEX_RES:          512,    // resolución de la textura (cuadrada; cubre la cara de 1,75 × 1,88 m)
  TEX_FPS:          30,     // actualizaciones por segundo de la textura; 0 = cada frame
  TEX_RES_DINAMICA: true,   // usar TEX_RES_CERCA cuando prox supera TEX_UMBRAL_CERCA
  TEX_RES_CERCA:    1024,
  TEX_UMBRAL_CERCA: 0.7,
  TEX_HISTERESIS:   0.05,   // sube a TEX_RES_CERCA con prox > umbral + h y vuelve con prox < umbral − h
  // Z69: reparto del cálculo de cada actualización en franjas, una por cuadro (doble textura: se muestra la anterior
  // hasta que la nueva está completa). Franjas = min(TEX_REPARTIR, cuadros por actualización). 1 = como estaba
  TEX_REPARTIR:     4,
  RUIDO_TEXTURA:    false,  // ruido celular desde una textura precalculada (256 × 256) en vez de calcularlo
  RUIDO_CELDAS:     32,     // celdas por repetición de la textura de ruido (se fija al montar)
  ADAPTATIVO:       false,  // baja resolución/iteraciones si el frame tarda más de MS_MAX
  MS_MAX:           20,     // ms
  ADAPT_MARGEN:     0.7,    // vuelve a subir con el frame por debajo de MS_MAX × ADAPT_MARGEN
  ADAPT_BAJAR_S:    1.0,    // segundos seguidos por encima de MS_MAX para bajar un escalón
  ADAPT_SUBIR_S:    3.0,    // segundos seguidos con margen para subir un escalón
};

// ── Z46: texto proyectado sobre el telón ("A LIGHT FOR ATTRACTING ATTENTION", recorte del reflector) ──
export const DBG_TELON_TEXTO = {
  ACTIVO:          true,    // false = no se crea nada (ni textura ni plano)
  INVERTIDO:       false,   // false = gobo (letras en sombra); true = letras iluminadas y el telón oscurecido alrededor
  TAMANO:          0.6,     // ancho del bloque / ancho de la zona iluminada por el reflector (a media intensidad)
  OFFSET_X_M:      0.0,     // corrimiento horizontal sobre el telón (m, + = derecha vista desde el público)
  OFFSET_Y_M:      0.0,     // corrimiento vertical respecto del punto apuntado por el reflector (y = 4 m)
  SEPARACION_M:    0.03,    // distancia del plano al frente de los pliegues (m)
  OPACIDAD:        0.85,
  TINTE_SOMBRA:    "#1A0606" as string,   // gobo: color de la sombra (casi negro rojizo), multiplica al telón
  OSCURO_INV:      0.25,    // invertido: cuánto queda del telón alrededor del bloque (0 = negro)
  BRILLO_INV:      0.8,     // invertido: brillo extra de las letras (× (1 + este valor))
  BLUR_PX:         6,       // borde suave sobre 2048 px de ancho (recrea la textura solo al cambiarlo)
  INTERLINEA:      0.16,    // separación entre las dos líneas / altura de mayúscula
  COLUMNAS:        0.13,    // separación entre columnas / altura de mayúscula
  INTENSIDAD_ENTION: 0.55,
  PLIEGUE:         0.3,     // 0…1: el plano sigue los pliegues del telón (mismo patrón: 8 pliegues de 0,15 m); 0 = plano
  FADE_IN_S:       2.5,
  FADE_OUT_S:      2.0,
  FLICKER_S:       0.6,     // parpadeo de reflector al encenderse
  FLICKER_N:       4,       // destellos
  FLICKER_PICO:    0.7,     // opacidad de cada destello
  DURACION_S:      25,      // s de experiencia desde que aparece
  DIST_OCULTAR_M:  12,      // se desvanece si el usuario se aleja más que esto del telón (el spawn está a 8 m)
  // Z71: crédito "An IN-GO'S WAN INC. Simulation" debajo del bloque, alineado a su borde derecho, con efecto de foco
  CREDITO_ACTIVO:   true,    // false = como estaba (sin crédito)
  CREDITO_TAMANO:   0.2,     // altura de mayúscula del crédito / alto del bloque. Se pidió 0,05–0,08: desde el inicio (8 m)
                             // el bloque mide ~45 px a 1440×900 y eso daría 2–4 px; con 0,2 son ~9 px (un quinto del título)
  CREDITO_MARGEN:   0.12,    // separación entre el bloque y el crédito / alto del bloque
  CREDITO_OPACIDAD: 0.75,
  CREDITO_TRACKING: 0.08,    // espaciado entre letras (fracción del tamaño de la fuente; recrea la textura)
  ENFOQUE_ACTIVO:   true,    // false = siempre enfocado
  ENFOQUE_DESENFOQUE_MAX: 0.3,    // radio del desenfoque en el máximo / alto del texto (0,22 casi no se nota; con 0,45 el texto chico se borra)
  ENFOQUE_INTERVALO_MIN_S: 3,     // enfocado entre MIN y MAX s (al azar con SEMILLA)
  ENFOQUE_INTERVALO_MAX_S: 8,
  ENFOQUE_SALIDA_S:  0.9,   // se desenfoca (suavizado)
  ENFOQUE_RETENCION_S: 0.4, // se mantiene borroso
  ENFOQUE_ENTRADA_S: 0.5,   // vuelve a enfocar
  ENFOQUE_SOBREIMPULSO: 0.15, // se pasa de foco hacia el otro lado (fracción del máximo) y se acomoda
  ENFOQUE_DOBLE:     0.3,   // imagen doble o halo durante el desenfoque (0 = no)
  SEMILLA:           71,
};

// ── Z48: ciclo de día (lib/cicloDia.ts) atado a la duración del tema, con introducción lenta de amanecer ──
// Colores en sRGB (el shader del domo escribe sRGB directo). La etapa "noche" usa los valores actuales de la
// escena (fondo, niebla, hemisférica y ambiente), así antes de la primera luz no cambia nada fuera del domo.
export const DBG_DIA = {
  NUEVO:                true,   // false = amanecer de una sola mezcla de 10 s (Z38), como antes — live
  INTRO_S:              60,     // introducción de amanecer (40…90 s): montañas → sol → resto — live
  DURACION_FALLBACK_S:  180,    // duración del día si no se puede leer la del tema (o sin sincronizar) — live
  SINCRONIZAR_CON_TEMA: true,   // el día dura lo que dura el tema que suena — live
  LOOP:                 true,   // al terminar el día (o cambiar / repetirse el tema) empieza otro — live
  T_MANUAL:             -1,     // 0…1 fija tDia (recorrer el día a mano; revela todo); −1 = el reloj sigue solo — live
  VELOCIDAD:            1,      // multiplicador del tiempo del día (8 para probar) — live
  DIA_MIN_S:            30,     // mínimo del tramo posterior a la introducción (temas muy cortos) — live
  RESINCRO_MIN_S:       8,      // no reiniciar por cambio de tema si el día recién se reinició (s) — live
  OCULTAR_INVISIBLES:   true,   // no dibujar la esfera de panorama ni el caparazón cuando son invisibles (alfa 0) — live
  KEYS: { ALBA: 0.12, SALIDA: 0.20, MEDIODIA: 0.50, ATARDECER: 0.80, CREPUSCULO: 0.92 },
  SOL_AZ_SALIDA_DEG:    120,    // azimut de la salida del sol (convención del domo: 180 = detrás de la tarima, centro del portal) — live
  SOL_ALT_MAX_DEG:      60,     // altura del sol al mediodía — live
  SOL_RADIO:            0.055,  // radio angular del disco del sol (rad) — live
  // Z49: sol sobre el eje del portal
  SOL_ALINEAR_PORTAL:   true,   // la salida del sol en el azimut del portal (DBG_SILLAS.domePortalAzimuth); false = SOL_AZ_SALIDA_DEG (Z48) — live
  SOL_AZ_OFFSET_DEG:    0,      // ajuste fino del azimut de salida respecto del portal (°) — live
  SOL_VERTICAL_FASE:    1.0,    // tramo del arco (rad de fase) en que el sol sube casi vertical (< 1° de deriva hasta 15° de altura) antes de abrirse — live
  SOL_UNICO:            false,  // true = el sol ilustrado del portal se atenúa y el del mundo lo reemplaza — live
  SOL_EJE_HASTA_ELEV_DEG: 35,   // Z50: azimut EXACTO del centro del portal hasta esta altura (toda la intro); < 0 = modo Z49 — live
  SOL_EJE_CENTRO:       "composicion" as string,   // Z55: vertical del eje: "composicion" (SUN_C: pico de la montaña central, sol ilustrado, discos crema y rojo) · "portal" (PORTAL_C: círculo exterior y anillos, 1,9° a la derecha; el de Z50) — live
  SOL_EJE_IMAGEN:       true,   // Z55: en "eje", el sol va sobre la recta vertical de la composición (pico y centro de los anillos); false = azimut constante del centro del círculo (Z51) — live
  SOL_RECORRIDO:        "eje" as string,   // Z51: "eje" (azimut del portal siempre, solo cambia la altura) · "meridiano" (pasa por el cénit) · "arco" (Z48–Z50) — live
  SOL_HALO_TOPE:        0.88,   // tope del resplandor y del halo (bajo el umbral del bloom 0,92: sin destello blanco) — live
  MONT_SILUETA:         0.35,   // altura de la cordillera antes de crecer (fracción) — silueta oscura desde el principio — live
  MONT_ANCHO:           0.12,   // ancho del frente de crecimiento (fracción de vuelta) — live
  PORTAL_NOCHE:         0.45,   // brillo del portal de noche (× luz del día) — live
  // tramos de la introducción (fracción de INTRO_S)
  INTRO_U_ALBA:         0.35,   // fin del crecimiento de montañas = primeras luces (tDia = KEYS.ALBA)
  INTRO_U_SOL:          0.70,   // el sol ya asomó sobre las montañas
  INTRO_TDIA_SOL:       0.23,   // tDia en INTRO_U_SOL (el sol a ~8° sobre el horizonte)
  INTRO_TDIA_FIN:       0.27,   // tDia al terminar la introducción
  INTRO_MONT_FIN:       0.35,   // las montañas terminan de crecer
  INTRO_RESTO_INI:      0.70,   // empieza el resto: portal y nubes
  INTRO_RESTO_PASO:     0.05,   // escalón entre portal → olas/estratos → anillos → cielo (warp, confeti)
  INTRO_RESTO_DUR:      0.15,   // duración de cada uno (el último termina en 1,0)
  // ganchos del visualizador futuro (0 = sin efecto)
  MUSICA_SOL:           0,      // pulso del halo del sol con los graves — live
  MUSICA_NUBES:         0,      // brillo de las nubes con los medios — live
  ETAPAS: {
    noche:      { hor: "#141826", med: "#0A0D18", cen: "#04050B", glow: "#1A2238", fondo: "#0A0812", niebla: "#0B0A14", hemiCielo: "#1A2330", hemiSuelo: "#0D0A12", luz: 0.00, estrellas: 1.00, brilloSol: 0.00, hemiInt: 0.25, ambInt: 0.020, expo: 1.00 },
    alba:       { hor: "#4A5A8C", med: "#26305A", cen: "#0C1028", glow: "#8A6A9A", fondo: "#0E0E1C", niebla: "#141A2C", hemiCielo: "#34406A", hemiSuelo: "#120E18", luz: 0.12, estrellas: 0.75, brilloSol: 0.25, hemiInt: 0.27, ambInt: 0.022, expo: 1.00 },
    salida:     { hor: "#F2A04A", med: "#C8705A", cen: "#3A3E78", glow: "#FFB060", fondo: "#24161C", niebla: "#3A2628", hemiCielo: "#E8A070", hemiSuelo: "#2A1A16", luz: 0.45, estrellas: 0.10, brilloSol: 0.55, hemiInt: 0.34, ambInt: 0.028, expo: 1.05 },
    mediodia:   { hor: "#F3D9A4", med: "#EBB46A", cen: "#6F8FB8", glow: "#FFE7B0", fondo: "#2E2A34", niebla: "#4A4450", hemiCielo: "#E8E2D4", hemiSuelo: "#3A2E26", luz: 1.00, estrellas: 0.00, brilloSol: 0.20, hemiInt: 0.50, ambInt: 0.045, expo: 1.19 },
    atardecer:  { hor: "#F3B230", med: "#D55D2F", cen: "#7A3A35", glow: "#FF9A3A", fondo: "#26121A", niebla: "#3E2020", hemiCielo: "#F08850", hemiSuelo: "#2A1410", hemiInt: 0.36, ambInt: 0.028, luz: 0.50, estrellas: 0.05, brilloSol: 0.55, expo: 1.08 },
    crepusculo: { hor: "#8A3A48", med: "#3A2048", cen: "#120C24", glow: "#C05060", fondo: "#0E0A16", niebla: "#161222", hemiCielo: "#4A3460", hemiSuelo: "#0E0A12", luz: 0.12, estrellas: 0.60, brilloSol: 0.30, hemiInt: 0.26, ambInt: 0.021, expo: 1.00 },
  },
};

// ── Z49: composición central del domo (portal, montañas ilustradas, anillos, confeti) ──
export const DBG_PORTAL = {
  ESCALA:          1.625, // Z50: 1,3 × 1,25 (Z49 1,3). Escala lineal de toda la composición, apoyada en el horizonte (1 = original) — live
  TINTE_BORDE:     1.0,   // Z50 (Z49 0,8): contorno del disco del portal → color del cielo del mundo en ese píxel (0 = color fijo) — live
  TINTE_ANILLOS:   0.85,  // Z50 (Z49 0,7): anillos del marco teñidos con el cielo del mundo — live
  TINTE_INTERIOR:  0.25,  // velo del interior con el color de la etapa (no toca sol ilustrado ni montañas) — live
  BORDE_SUAVE:     0.5,   // feather del borde del portal (misma forma) — live
  BORDE_ANCHO:     0.22,  // Z50: banda del contorno hacia ADENTRO del disco (fracción del radio) que converge al cielo — live
  DEBUG_CAPAS:     0,     // Z50: 1 = cada capa de la composición en un color plano (diagnóstico) — live
  ANILLOS_EN_EJE:  false, // Z57: el círculo exterior del portal y los anillos se centran en el eje de la composición (SUN_C.x, pico de la montaña central) en vez de PORTAL_C.x (≈ 13 px a la derecha). Lo siguen el tinte del borde (Z50) y las ondas (Z52) — live
  OVERLAY_EJE:     false, // Z50: con el menú abierto (Shift), muestra azimut del portal, del sol, diferencia, altura y tDia. Z55: además, cruz en el centro del círculo, recta del eje y marca del sol en pantalla (components/EjeOverlay.tsx) — live
};

// ── Z51: sol nuevo (núcleo, halo, rayos y destello de lente). Estilo adaptado de un shader de Shadertoy aportado
// por el usuario (autor y URL por confirmar; licencia por defecto de Shadertoy CC BY-NC-SA 3.0, ver CREDITOS.md) ──
export const DBG_SOL = {
  DISENO_NUEVO:         true,   // false = disco anterior (anillo rojo, crema y núcleo amarillo, Z48) — live
  TAMANO:               0.22,   // rad del cielo por "unidad" de la referencia (escala del sol) — live
  INTENSIDAD:           1.0,    // cuerpo del sol (× 0,5 + 0,5 · máx(brilloSol, luz) de la etapa) — live
  NUCLEO:               0.15,   // radio del núcleo (unidades de la referencia; 0,15 × 0,22 rad ≈ 1,9°) — live
  HALO:                 1.0,    // punto brillante / halo (× bright/√(4L) de la referencia) — live
  RAYOS_N1:             3,      // el 3 de sin(a·3 + cos(a·9)) — live
  RAYOS_N2:             9,      // el 9 — live
  RAYOS_ANCHO:          1.0,    // exponente de los rayos (1 = referencia; más alto = más finos) — live
  RAYOS_INT:            1.0,    // intensidad de los rayos — live
  PARPADEO:             1.0,    // brillo animado 0,2 + sin(t)·0,05·PARPADEO (referencia) — live
  ROTACION_RAYOS_DEG_S: 4,      // giro lento de los rayos — live
  ALCANCE:              0.9,    // hasta dónde llega el cuerpo del sol (rad); afuera el shader no lo calcula — live
  PALETA_PROYECTO:      0,      // 0 = colores de la referencia; 1 = crema #F8EAD8, amarillo #FEBD17, naranja #F0742A, rojo #E5322B — live
  TINTE_ETAPA:          0.3,    // tinte con el color de la etapa (cálido al salir y al ponerse, neutro de día) — live
  TOPE_BRILLO:          1.0,    // Z57: tope de TODO el sol (núcleo incluido) por canal; nunca oscurece el cielo que ya era más brillante. 1 = sin cambio (como hasta Z56) — live
  TOPE:                 0.97,   // tope del cuerpo del sol fuera del núcleo (mezcla tipo pantalla) — live
  // destello de lente (sprites en pantalla, components/SolFlare.tsx)
  FLARE:                true,   // — live
  FLARE_INTENSIDAD:     0.6,    // — live
  FLARE_CANTIDAD:       8,      // elementos (1…10; círculo, punto y hexágono alternados) — live
  FLARE_TAMANO:         1.0,    // escala de los elementos — live
  FLARE_ALT_MIN_DEG:    8,      // por debajo no se ve (montañas); aparece entre esta altura y +4° — live
  FLARE_CENTRO:         0.2,    // se desvanece con el sol cerca del centro de la pantalla (los fantasmas se apilan sobre él) — live
};

// ── Z52: ondas expansivas por kick de cada luz/banda (lib/ondasKick.ts + shader del domo) ──
export const DBG_ONDAS = {
  ACTIVO:          true,   // — live
  MAX:             8,      // ondas simultáneas (1…8) — live
  VELOCIDAD_DEG_S: 22,     // Z58 (Z52 28): avance del anillo (°/s), desde el borde del portal hacia afuera; más lenta y legible — live
  ANCHO_DEG:       14,     // Z58 (Z52 9): ancho del perfil de campana (°) — live
  DURACION_S:      5,      // Z58 (Z52 3,5): vida de cada onda (se apaga con la edad y con la distancia); llega más lejos — live
  AMPLITUD:        1.5,    // Z58 (Z52 0,6, × 2,5): desplazamiento de las franjas (en períodos de franja), cresta y valle — live
  BRILLO:          0.7,    // Z58 (Z52 0,25): brillo bajo la cresta; sobre fondo claro oscurece en vez de sumar luz (sin blanco) — live
  BRILLO_NOCHE:    0.5,    // brillo extra de la cresta de noche (× (1 − luz del día)) — live
  TINTE_BANDA:     0.6,    // Z58 (Z52 0,35): huella del color de la luz de la banda bajo la cresta (0 = sin color propio) — live
  CONTRASTE:       0.5,    // Z58: bajo la cresta las franjas se aclaran (fondo oscuro) u oscurecen (fondo claro) — live
  ENGROSAR:        0.35,   // Z58: engrosamiento de las franjas bajo la cresta — live
  EVIDENCIA:       1.0,    // Z58: 0 = aspecto de Z52 · 1 = estos valores · 2 = el doble (escala amplitud, brillo, contraste, tinte y engrosamiento; ver lib/ondasKick.ts) — live
  REVELAR:         0.5,    // bajo la cresta las franjas se ven aunque estén fuera del alcance del marco (que queda al 10 %) — live
  GANANCIA_BANDA:  [1, 1, 1, 1] as number[],   // por banda de frecuencia: 0 < 80 Hz · 1 80–250 Hz (bombo) · 2 250 Hz–4 kHz · 3 > 4 kHz — live
  UMBRAL:          1.35,   // dispara cuando la energía supera UMBRAL × su media móvil (flanco de subida) — live
  COOLDOWN_MS:     180,    // enfriamiento por luz — live
  MEDIA_S:         0.6,    // constante de la media móvil (s) — live
  MIN_ENERGIA:     0.1,    // energía normalizada mínima para disparar — live
};

// ── Z54: prisma y flor dentro del ciclo de día (lib/prismaFlor.ts, components/FlorCiclo.tsx) ──
export const DBG_FLOR = {
  ACTIVO:          true,   // false = el prisma queda como hoy (apoyado) y no hay flor — live
  // puntos clave (fracciones del ciclo, tDia)
  SUBE_INICIO:     0.25,
  SUBE_FIN:        0.37,
  NACE_INICIO:     0.29,   // el prisma ya se despegó del suelo
  NACE_FIN:        0.42,   // flor completa y abierta
  ACHICA_INICIO:   0.66,
  ACHICA_FIN:      0.75,   // desaparece justo al terminar el tercer cuarto
  BAJA_INICIO:     0.75,
  BAJA_FIN:        1.0,    // lento: todo el último cuarto
  // flor
  ESCALA:          1.0,    // tamaño de la cabeza (1 = diámetro ≈ ancho de la base del prisma, 1,75 m) — live
  ALTURA_M:        1.8,    // Z57 (Z54 2,7): altura total, 33 % más baja; el valor efectivo es ALTURA_M × ALTURA_FACTOR — live
  ALTURA_FACTOR:   1.0,    // Z57: multiplica ALTURA_M en vivo (0,3…1,5; 1,5 = la altura de Z54) — live
  ESCALA_CABEZA:   0.67,   // Z60 (Z57 1,0): diámetro de la cabeza (× ESCALA), un tercio menos para equilibrar con la altura de Z57 — live
  GROSOR_TALLO:    0.6,    // Z62 (Z60 1,0): grosor del tallo; con la cabeza en 0,67 el tallo de 1,0 quedaba grueso frente al video — live
  // Z60: la cabeza rueda hacia adelante (eje horizontal por su centro, en la punta del tallo)
  ROLL_CABEZA_ACTIVO:    false, // Z62 (Z60 true): la cabeza entera no rota; disponible — live
  ROLL_CABEZA_PERIODO_S: 4.2,   // una vuelta completa (360°) — live
  ROLL_CABEZA_AMP_DEG:   360,   // 360 = vuelta completa; menos = se mece ±AMP/2 — live
  ROLL_CABEZA_SENTIDO:   -1,    // −1 (como el video, ver Z60) = la cara sube y se aleja del observador y vuelve por abajo; 1 = al revés (la parte de arriba viene hacia el observador) — live
  ROLL_CABEZA_EJE_DEG:   0,     // orientación del eje (°, alrededor de la vertical): 0 = rueda hacia las sillas (−Z); 90 = hacia la entrada (−X) — live
  // Z62: cada pétalo se voltea sobre su base (eje tangente al anillo), en ola; reemplaza la ola de Z60
  PETALO_ROLL_ACTIVO:    true,  // false = pétalos como Z54 (solo abren y cierran) — live
  PETALO_ROLL_MODO:      "completo" as string,   // "completo" (vuelta de 360°, hacia adelante) · "vaiven" (oscila ±AMP/2) — live
  PETALO_ROLL_PERIODO_S: 4.2,   // una vuelta del volteo — live
  PETALO_ROLL_AMP_DEG:   150,   // amplitud total del vaivén — live
  PETALO_ROLL_DESFASE:   0.02,  // vueltas de retraso por pétalo: con OLA "frente", por pétalo de distancia al frente (0,02 → atrás 0,16 vuelta ≈ 58°); con "anillo", entre vecinos, redondeado a olas enteras (0,0625 = 1/16 = una ola) — live
  PETALO_ROLL_OLA:       "frente" as string,   // "frente" (el frente adelanta, los dos lados retrasados igual, sin costura; como el video) · "anillo" (ola por índice que da la vuelta) — live
  PETALO_ROLL_FRENTE_DEG: -90,  // azimut del frente (−90 = hacia −X, la pose de entrada de Z59; 180 = hacia las sillas, −Z) — live
  PETALO_ROLL_CAPAS:     true,  // la capa interior en contrafase — live
  PETALO_ROLL_SENTIDO:   1,     // 1 = hacia adelante (la punta sale hacia afuera y baja); −1 = al revés — live
  PETALO_ROLL_BASE_DEG:  60,    // ángulo desde la vertical con giro 0 (copa abierta) — live
  PETALO_ACORTAR:        0.45,  // se acorta al apuntar hacia adentro (no atraviesa tallo ni centro) — live
  // Z62: forma (elipsoides ≈ 2:1 separados, como el video; Z54–Z60 eran 0,27 × 0,22 × 0,52, más anchos que largos)
  PETALO_ANCHO:          0.16,  // semiancho (m, cabeza de referencia) — live
  PETALO_GROSOR:         0.08,  // semigrosor (aplanado: corte elíptico, no un dedo) — live
  PETALO_LARGO:          0.62,  // largo — live
  ANILLO_R:              0.26,  // radio del anillo de bases (Z54–Z60: 0,2) — live
  // Z60: color
  COLOR_ACOPLE:          0.7,   // cuánto sigue el degradado al giro de la cabeza y a la ola — live
  COLOR_LINEAL:          true,  // Z62: la paleta pasa de sRGB a lineal (sin ella sale lavanda y rosa) — live
  DORSO_AZUL:            0.8,   // el dorso de los pétalos tira a azul marino (como el video) — live
  COLOR_TALLO_ACTIVO:    true,  // bandas de color que suben por el tallo — live
  COLOR_TALLO_VEL:       0.15,  // vueltas del degradado por segundo en el tallo — live
  MUSICA_ROLL:           0,     // graves → giro más rápido (0 = sin efecto) — live
  RESPIRACION_S:   7,      // período del abrir y cerrar de los pétalos — live
  RESPIRACION_AMP: 0.18,   // cuánto respira la apertura — live
  BALANCEO_M:      0.12,   // balanceo del tallo (m en la punta) — live
  BALANCEO_S:      5.5,    // período del balanceo — live
  GIRO_DEG_S:      6,      // giro lento de la cabeza — live
  INCLINACION_DEG: 9,      // inclinación de la cabeza — live
  COLOR_VEL:       0.08,   // velocidad del degradado térmico — live
  PALETA_PROYECTO: 0,      // 0 = colores del video (azul marino, rojo, naranja, lima); 1 = paleta retro del proyecto — live
  BRILLO:          1.0,    // limita el brillo (bloom 0,92) — live
  MUSICA_APERTURA: 0.0,    // graves → apertura (0 = sin efecto) — live
  PROX_USA_BASE:   false,  // true = el fractal del prisma calcula su cercanía con la posición apoyada (aunque esté arriba) — live
};

// ── Z67: base de la flor sobre la tarima (lib/baseFlor.ts, components/BaseFlor.tsx): hueco por donde sale el tallo,
// grietas alrededor, astillas y pasto corto en la base. Nace y desaparece con la flor (FLOR.escala, lib/prismaFlor.ts). ──
export const DBG_BASE_FLOR = {
  ACTIVO:          true,   // false = como antes (el tallo apoyado sobre la tarima, sin hueco) — live
  RADIO_HUECO_M:   0.2,    // radio del hueco (borde irregular) — live
  PROFUNDIDAD_M:   0.25,   // profundidad de las paredes del hueco (la tarima mide 0,267 m) — live
  BRILLO_BORDE:    0.25,   // resplandor del color térmico de la flor en el borde (× escala de la flor) — live
  N_GRIETAS:       9,      // grietas principales (cada una con 2 ramas) — live
  RADIO_GRIETAS_M: 1.3,    // largo máximo de las grietas desde el centro — live
  ANCHO_GRIETA:    0.022,  // ancho de las grietas junto al hueco (m); se afinan al alejarse — live
  IRREGULARIDAD:   0.6,    // quiebre de las grietas y del borde del hueco (0 = rectas / círculo) — live
  ASTILLAS:        8,      // fragmentos levantados en el borde del hueco (0…24) — live
  PASTO_ACTIVO:    true,   // pasto corto alrededor del tallo — live
  PASTO_RADIO_M:   0.6,    // radio de la mata — live
  PASTO_ALTURA_M:  0.28,   // — live
  PASTO_CAPAS:     10,     // capas del pasto de la base (técnica de Pasto.tsx) — live
  SEMILLA:         7,      // grietas y astillas siempre iguales para la misma semilla — live
  OVERLAY:         false,  // anillos del radio del hueco y de las grietas — live
};

// ── Z78: núcleo de audio de la tarima (lib/audio/nucleo.ts: contexto único, bus maestro, reloj, ruido) ──
// ACTIVO lo lee audioEngine al crear su contexto (recargar para cambiar): true = el audio de los atriles usa el
// contexto del núcleo y sale por su bus maestro (ganancia → limitador suave → analizador → salida); false = como antes.
// El resto se aplica en vivo desde el menú (sección audio-nucleo-z78).
export const DBG_AUDIO_NUCLEO = {
  ACTIVO:            true,    // se lee al arrancar el audio de los atriles (initAudio): cambiarlo antes, o acá y recargar
  SILLAS_EN_NUCLEO:  false,   // PENDIENTE (tarea aparte): vizAudio usaría el contexto del núcleo. Hoy no hace nada
  GANANCIA_MAESTRA:  1.0,     // 0…2 (1 = igual que antes) — live
  LIMITADOR:         true,    // limitador suave del bus (identidad bajo el umbral) — live
  LIMITADOR_UMBRAL:  0.9,     // 0,5…0,99 de escala completa — live
  BPM:               120,     // 20…300 — live
  PASOS_POR_COMPAS:  16,      // al iniciar el reloj
  PASOS_POR_PULSO:   4,       // 4 = semicorcheas — al iniciar el reloj
  ANTICIPO_S:        0.1,     // lookahead del programador — live
  INTERVALO_MS:      25,      // cada cuánto despierta el programador — al iniciar el reloj
  METRONOMO:         false,   // clic corto en cada paso (prueba) — live
  METRONOMO_VOL:     0.3,     // — live
  RUIDO:             false,   // "Probar ruido" (fuente de lib/audio/ruido.ts en el bus) — live
  RUIDO_TIPO:        "rosa" as string,   // "rosa" | "blanco" — live (recrea la fuente)
  RUIDO_GANANCIA:    0.15,    // — live
  OVERLAY_NIVEL:     false,   // medidor del analizador maestro (abajo a la derecha) — live
};

// ── Z79: PLAY del atril de sonido (lib/playTarima.ts, lib/playTarimaAcciones.ts, components/PlayTarima.tsx) ──
// La música del atril de sonido no arranca sola: hay que apretar el botón grande del centro del atril (o el PLAY/PAUSA
// chico de REPRODUCCIÓN). AUTOPLAY = true restaura el arranque automático anterior (código viejo intacto).
// Botón: posición en coordenadas del panel (u = derecha, v como los controles del atril: −v = hacia el frente), m.
export const DBG_PLAY = {
  AUTOPLAY:            false,   // se lee al aparecer los atriles (cambiarlo antes de entrar a la tarima) — live
  BOTON_ESCALA:        1.0,     // tamaño del botón grande (1 = 16 × 4,5 cm) — live
  BOTON_U:             0.0,     // posición sobre el panel (m) — live
  BOTON_V:             0.0,     // 0 = franja libre entre las dos bandas de controles — live
  BOTON_ELEV:          0.012,   // alto de la base sobre el panel (m) — live
  MOSTRAR_SLOTS:       false,   // marcadores de debug de los slots de los atriles de instrumentos — live
  APARECER_TRAS_PLAY:  false,   // Z88 (antes true): false = la caja de ritmos (y los futuros instrumentos) salen con los atriles; true = al apretar play (Z80) — live
  // Z88: con DBG_RITMOS.UBICACION "detras_tarima" los slots van en línea detrás de la tarima (eje sillas → tarima), el
  // de la caja en el centro; SLOTS_DIST_M y SLOTS_ARCO_GRADOS solo valen con "slot_atril"
  SLOTS_N:             4,       // cantidad de slots — live
  SLOTS_DIST_M:        2.0,     // distancia detrás del atril de sonido (m) — live (Z80: 1,4 → 2,0: con 1,4 quedaba un pasillo de 0,5 m entre atriles)
  SLOTS_SEP_M:         1.7,     // separación entre slots (m) — live
  SLOTS_ARCO_GRADOS:   0,       // 0 = en línea; > 0 = en arco alrededor del atril de sonido — live
  SLOTS_PEDESTAL:      true,    // Z81: base bajo los atriles de instrumentos (los slots caen en el piso, fuera de la tarima) — live
  SLOTS_PEDESTAL_ALTURA_M: "auto" as string | number,   // Z81: "auto" = altura de la tarima − altura del slot (0,267 m en el piso) — live
  CLICK_UNICO:         true,    // Z81: los botones de los atriles actúan una vez por pulsación (false = doble disparo anterior) — live
};

// ── Z80: caja de ritmos circular (lib/ritmos.ts, lib/ritmosMotor.ts, lib/audio/ritmosVoces.ts, components/CajaRitmos.tsx) ──
// Primer instrumento propio de la tarima: anillos = instrumentos (de adentro hacia afuera, PISTAS), ángulo = tiempo
// (una vuelta = un compás de 4/4 en PASOS pasos). Sale del piso en el slot SLOT de Z79 al apretar play del atril de sonido.
export const DBG_RITMOS = {
  ACTIVO:            true,     // false = no se monta ni suena — live
  MOSTRAR:           "tras_play" as string,   // "tras_play" (con DBG_PLAY.APARECER_TRAS_PLAY) | "siempre" — live
  SLOT:              1,        // slot de Z79 (0…SLOTS_N − 1); Z88: en "detras_tarima" este slot va al centro, sobre el eje — live
  UBICACION:         "detras_tarima" as string,   // Z88: "detras_tarima" (eje sillas → tarima, del lado opuesto) | "slot_atril" (Z80: detrás del atril de sonido) — live
  DIST_DETRAS_M:     2.0,      // Z88: metros desde el borde de la tarima opuesto a las sillas (detras_tarima) — live
  PASOS:             16,       // 8 | 12 | 16 | 32 por vuelta (= un compás) — live (reinicia el reloj)
  PISTAS:            ["kick", "clap", "hatC", "hatA", "shaker", "perc"] as string[],   // anillos de adentro hacia afuera
  BPM:               120,      // 60…180 (parámetro ritmos.bpm de Z78) — live
  SWING:             0,        // 0…60 % (parámetro ritmos.swing) — live
  SEGUIR_PLAY_ATRIL: true,     // el play/pausa del atril de sonido arranca y detiene la caja (además de su botón propio)
  VOLUMEN:           0.9,      // ganancia general de la caja — live
  VOZ: {                       // por voz: TONO (Hz), DECAY (s), VOL (0…1), MUTE, SWING (si le aplica el swing) — live
    kick:   { TONO: 50,   DECAY: 0.45, VOL: 0.9,  MUTE: false, SWING: false },
    clap:   { TONO: 1200, DECAY: 0.2,  VOL: 0.55, MUTE: false, SWING: false },
    hatC:   { TONO: 7500, DECAY: 0.05, VOL: 0.35, MUTE: false, SWING: true },
    hatA:   { TONO: 7000, DECAY: 0.4,  VOL: 0.3,  MUTE: false, SWING: true },
    shaker: { TONO: 5500, DECAY: 0.09, VOL: 0.3,  MUTE: false, SWING: true },
    perc:   { TONO: 140,  DECAY: 0.3,  VOL: 0.6,  MUTE: false, SWING: false },
  } as Record<string, { TONO: number; DECAY: number; VOL: number; MUTE: boolean; SWING: boolean }>,
  LUZ:               2,        // intensidad del reflector propio (tenue; con 6 el bloom ya encandila) — live
  SALTO_AMP:         0.7,      // salto de los cubitos al pasar la línea (escala extra) — live
  SALTO_TAU_S:       0.09,     // vuelta del salto (s) — live
  MOSTRAR_BARRA:     true,     // barra de posición (play · BPM · 4/4 · compás.pulso.sub) — live
  OVERLAY_CELDA:     false,    // depuración: celda bajo el mouse — live
  PERSISTENCIA:      true,     // patrón, PASOS, BPM y swing en sessionStorage (alight:ritmos)
};

// ── Z82: monolitos frente a la sesión en vivo de la tarima, solo local (lib/monolitosVivo.ts, lib/monolitosVivoAcciones.ts) ──
// ACTIVO = false → prototipo N5 como estaba (monolito derecho baja la música 85 % y sube ruido blanco).
export const DBG_MONO_VIVO = {
  ACTIVO:              true,    // — live
  RADIO_INICIO_M:      3.0,     // empieza el reemplazo (= monolithProxStartM de N5) — live
  RADIO_TOTAL_M:       1.0,     // reemplazo total (N5: 0,5) — live
  SOSTENER_S:          15,      // sostén al alejarse — live
  RETORNO_S:           6,       // vuelta progresiva al audio propio — live
  CANCELAR_S:          0.6,     // alejarse de los dos durante esto cancela el sostén — live
  UMBRAL_VEL_MS:       0.15,    // m/s mínimos para contar "acercarse" o "alejarse" (quieto no cuenta) — live
  RUIDO_GANANCIA:      0.5,     // nivel de la estática con peso 1 (= noiseGain de N5) — live
  RUIDO_TIPO:          "blanco" as string,   // "blanco" | "rosa" (se recrea al cambiar) — live
  SESION_GANANCIA:     1.0,     // nivel del audio de la sesión con peso 1 — live
  REQUIERE_ACEPTACION: false,   // true: sin mezcla remota hasta que el espectador acepte (aceptarTransmision()) — live
  OVERLAY:             false,   // estados, pesos y contadores (abajo a la izquierda) — live
};

// ── Z89: presencia de la sesión en vivo con Supabase Realtime (lib/vivo/presencia.ts, canalSupabase.ts, vivoAcciones.ts) ──
// Sin medios: solo "hay alguien en la tarima". FUENTE "mock" = Z82–Z86 tal cual; "supabase" = MONO_VIVO.haySesion sale
// de la presencia (audio y video = patrones de prueba mientras no haya medios). Canal público con la clave anónima.
export const DBG_VIVO = {
  // Z93 (antes "mock"): "auto" = "livekit" si hay variables de Supabase (presencia); si el token de LiveKit da 503, cae a
  // "mock" por el resto de la página. "livekit" = presencia + audio y video REALES de la tarima (lib/vivo/recibirLiveKit.ts).
  FUENTE:           "auto" as string,   // "auto" | "livekit" | "supabase" | "mock" — live
  CANAL:            "alight-tarima-v1" as string,   // nombre del canal de Realtime (vale al conectar) — live
  LATIDO_S:         5,       // el publicador sube su contador cada esto — live
  TIMEOUT_S:        15,      // el oyente deja de contar una sesión sin cambio de latido durante esto (reloj local) — live
  REINTENTO_S:      1,       // Z95 (antes 2): primera espera tras un error; se duplica en cada intento (1, 2, 4, 8, 15) — live
  REINTENTO_MAX_S:  15,      // Z95 (antes 60): tope de la espera entre reintentos — live
  MAX_REINTENTOS:   8,       // Z95: reintentos seguidos (cada uno con un canal NUEVO); después "agotado" hasta "Reintentar presencia" — live
  CIERRE_SIN_USO_S: 10,      // el oyente cierra el canal tras esto sin que haga falta (monolitos fuera) — live
};

// ── Z83: el domo de SILLAS muestra la sesión en vivo de la tarima o estática (lib/domoVivo.ts, lib/domoVivoAcciones.ts) ──
// uRemoteMix = peso del monolito de video (Z82). ACTIVO = false → domo como estaba (la rama del shader no se ejecuta).
export const DBG_DOMO_VIVO = {
  ACTIVO:              true,    // — live
  REPETICIONES:        6,       // imágenes alrededor de la franja (modo banda) — live
  COBERTURA:           "banda" as string,   // "banda" (toda la franja de 360°) | "sector" — live
  SECTOR_ANCHO_DEG:    70,      // ancho del sector (modo sector) — live
  SECTOR_DESPLAZ_DEG:  0,       // giro del centro respecto del azimut del portal — live
  ASPECTO:             16 / 9,  // proporción del video — live
  ELEV_CENTRO_DEG:     18,      // elevación del centro de la franja — live
  BORDE:               0.04,    // borde suave entre repeticiones (fracción del ancho) — live
  FONDO:               0.9,     // cuánto se apaga el visualizador alrededor de la imagen (× peso) — live
  FPS:                 15,      // cuadros por segundo del video de prueba — live
  ESTATICA_INTENSIDAD: 0.85,    // — live
  ESTATICA_GRANO:      140,     // filas de grano por imagen — live
  ESTATICA_VELOCIDAD:  24,      // cuadros de ruido por segundo — live
  FORZAR:              "ninguno" as string,   // "ninguno" (monolito) | "video" | "estatica" | "apagar" — live
};

// ── Z84: tiempo detenido simulado (lib/tiempoDetenido.ts, lib/tiempoDetenidoAcciones.ts, lib/retro/tiempoDetenido.ts) ──
// Al alejarse de un monolito (tras haber estado cerca) y sin sesión: el mp3 propio se frena como una cinta y la cámara
// propia toma un efecto tipo CRT (provisorio). Nunca afecta la sesión remota ni la estática.
export const DBG_TIEMPO = {
  ACTIVO:            true,    // — live
  DURACION_S:        6,       // bajada de k a 0 (= RETORNO_S de los monolitos) — live
  CORTE_S:           1,       // bajada si aparece una sesión o se vuelve a "cerca" — live
  ATAQUE_S:          0.35,    // subida de la cinta (sin saltos de tono ni clics) — live
  RATE_MIN:          0.5,     // velocidad mínima del mp3 con k = 1 — live
  INTENSIDAD_AUDIO:  1,       // × k para el audio — live
  INTENSIDAD_VISUAL: 1,       // × k para el shader (uTiempoK) — live
  DISPARO_PARCIAL:   false,   // también al alejarse sin haber llegado a "cerca" (k = acercamiento máximo) — live
  // ── Z86: efecto visual de retraso por filas (slit-scan) con estela de luces (lib/tiempoHistorial.ts, lib/retro/historialTiempo.ts) ──
  ESTILO:            "slitscan" as string,   // "slitscan" (Z86) | "provisorio" (CRT de Z84) — live
  RETRASO:           true,    // 1) retraso por filas — live
  RETRASO_MAX_S:     1.2,     // retraso de la última fila con k = 1 (s) — live (el anillo se recalcula al rearmar)
  DIRECCION:         "abajo_mas_viejo" as string,   // "abajo_mas_viejo" (arriba lo más reciente) | "arriba_mas_viejo" — live
  CURVA:             "lineal" as string,   // "lineal" | "suave" — live
  EXPONENTE:         1,       // ^ sobre la curva (> 1: el retraso se concentra abajo) — live
  ONDA_AMP:          0.06,    // ondulación lenta del retraso (fracción) — live
  ONDA_VEL:          0.5,     // rad/s — live
  ESTELA:            true,    // 2) estela de luces (persistencia de cámara vieja) — live
  PERSISTENCIA_S:    0.35,    // vida de la cola — live
  ESTELA_UMBRAL:     0.7,     // brillo (luminancia HDR) desde el que deja cola — live
  ESTELA_MEZCLA:     0.8,     // cuánto de la cola se suma — live
  ESTELA_TINTE:      "#FFB36B" as string,   // color de la cola (cámara vieja: cálido) — live
  ESTELA_TINTE_MEZCLA: 0.35,  // 0 = color original de la luz, 1 = tinte — live
  DESFASE:           true,    // 3) desfase de color en el tiempo — live
  DESFASE_RGB_S:     0.05,    // R y B leen ± esto respecto de G (× k) — live
  BANDA:             true,    // 4) banda de error de seguimiento tipo VHS — live
  BANDA_ALTO:        0.05,    // alto de la franja (fracción de la pantalla) — live
  BANDA_VEL:         0.04,    // vueltas por segundo (baja despacio) — live
  BANDA_SALTO_S:     0.25,    // retraso extra dentro de la franja — live
  BANDA_TEMBLOR:     0.003,   // temblor horizontal (fracción del ancho) — live
  HIST_HZ:           20,      // capturas por segundo del historial — al rearmar
  HIST_ESCALA:       0.5,     // resolución del historial y de la estela (× la del render) — al rearmar
  HIST_MAX_ANCHO:    1280,    // tope de ancho del historial (px) — al rearmar
  HIST_N:            "auto" as string | number,   // capas del anillo; "auto" = ceil(RETRASO_MAX_S · HIST_HZ) + 2 — al rearmar
  PRE_ROLL:          "al_acercarse" as string,    // "al_acercarse" (se arma al entrar al radio sin sesión) | "al_disparar" — live
  DESARMAR_S:        2,       // se desarma esto después de que k llega a 0 — live
  LIBERAR_AL_DESARMAR: false, // true = libera la memoria del historial al desarmar (al rearmar se reserva otra vez) — live
};

// ── Z85: aviso al espectador antes de recibir la transmisión en vivo (lib/avisoVivo.ts, lib/avisoVivoAcciones.ts) ──
// Texto: docs/dialogos/aviso-vivo.ink (npm run ink:build). Usa la terminal de diálogo de la narrativa.
// ── Z93: recepción de la tarima en SILLAS por LiveKit (lib/vivo/recibirCiclo.ts, lib/vivo/recibirLiveKit.ts) ──
// Conecta solo con aviso aceptado + sesión viva (presencia) + fuente real, y con algún monolito pidiendo medios.
export const DBG_LIVEKIT_RECIBIR = {
  ESPERA_DESUSCRIBIR_S:    2,      // peso en 0 durante esto → des-suscribe la pista (y sin ninguna, desconecta) — live
  SENAL_DEBIL_S:           5,      // suscrito sin medios durante esto → "señal débil" — live
  DEBIL_MEZCLA:            0.3,    // en señal débil: estática a este nivel sobre lo propio (audio y domo), sin cortar lo propio — live
  CONTORNO_ELEMENTO_AUDIO: true,   // Chrome: la pista remota también en un <audio> SILENCIADO para que fluya por Web Audio (vale al suscribir) — live
  REINTENTO_BASE_S:        1,      // primera espera tras perder la conexión; se duplica en cada intento — live
  REINTENTO_MAX_S:         15,     // tope de la espera — live
  MAX_REINTENTOS:          6,      // después → "error" hasta que la sesión o la aceptación cambien — live
};

export const DBG_AVISO_VIVO = {
  ACTIVO:            true,    // false = como antes, sin aviso — live
  SOLO_UNA_VEZ:      true,    // una vez por sesión del navegador (sessionStorage alight:aviso-vivo) — live
  CIERRE_MS:         600,     // tras elegir, la terminal se cierra — live
  ESPERA_CIERRE_MS:  300,     // "Prefiero salir de acá": si la pestaña no se cerró en este tiempo, pantalla final — live
};

// ── Z91: consentimiento para exponerse y transmitir al elegir la tarima (lib/consentTarima.ts, lib/consentTarimaAcciones.ts,
// docs/dialogos/tarima-exponerse.ink). ACTIVO = false → como antes: atriles a LECTERNS_AFTER_PEOPLE_MS sin preguntas ni publicar. ──
export const DBG_CONSENT = {
  ACTIVO:             true,   // se lee al aparecer las figuras (alight:people-visible) — live
  ESPERA_INICIAL_S:   8,      // figuras en escena → primer texto — live
  ESPERA_ENTRE_S:     8,      // fin del primer texto → texto con la elección — live
  CIERRE_TEXTO_S:     3,      // el primer texto queda en la terminal esto después de terminar de escribirse — live
  CIERRE_MS:          600,    // tras elegir, la terminal se cierra — live
  RECORDAR_EN_SESION: false,  // Z93a (antes true): true = la elección se recuerda en sessionStorage y al recargar NO repregunta
                              // (los atriles salen con las figuras, sin textos: era la causa del reporte de Z93a) — live
  RECORDAR_TRANSMISION: false, // Z92: al recargar, una transmisión NO se reanuda sola (se vuelve a preguntar); true = Z91 — live
  DURACION_MAX_S:     300,    // límite de la transmisión (reloj real: no se detiene con la pausa central) — live
  AVISO_FIN_S:        30,     // aviso "La transmisión termina en N s" antes del límite — live
  // Z93a: orden de la tarima (lib/consentTarima.ts tickSubida)
  ATRILES_TRAS_CONSENTIMIENTO: true, // atriles y caja de ritmos SOLO tras la elección; false = como antes (J1: a LECTERNS_AFTER_PEOPLE_MS de las figuras) — live
  ESPERA_FIGURAS_MAX_S: 30,   // si las figuras no salen (permiso de cámara sin responder), el flujo arranca igual esto después de elegir la tarima — live
  SALIDA_EXTRA_M:     0.5,    // bajar de la tarima = alejarse más que el radio de la zona + esto (histéresis); cancela antes de elegir — live
};

// ── Z92: video y audio de la tarima por LiveKit Cloud tras "Compartir mi sesión." (lib/vivo/publicarLiveKit.ts,
// lib/vivo/liveKitCiclo.ts, app/api/livekit/token/route.ts). ACTIVO = false → como Z91 (solo presencia). ──
export const DBG_LIVEKIT = {
  ACTIVO:     true,                // — live (vale al elegir compartir)
  SALA:       "alight-tarima-v1",  // SOLO informativo: la sala la fija el servidor (LIVEKIT_SALA o este valor)
  VIDEO_FPS:  15,                  // captureStream del canvas de ondas / tope de la webcam (vale al publicar)
  VIDEO_KBPS: 500,                 // bitrate máximo del video (vale al publicar)
  AUDIO_KBPS: 64,                  // bitrate del audio estéreo (vale al publicar)
  // Z94: qué video se publica. "procesado" = la imagen del domo de la tarima con sus efectos y el atril de imagen
  // (components/VideoTransmitidoTarima.tsx); "cruda" = Z92 (clon de la webcam u ondas); "ondas" = canvas de ondas (pruebas).
  // Si el pase procesado no está disponible al iniciar, cae a "cruda" y lo dice la línea de estado.
  FUENTE_VIDEO:       "procesado" as string,   // "procesado" | "cruda" | "ondas" (vale al publicar)
  PROCESADO_ANCHO:    640,         // canvas transmisible (vale al publicar)
  PROCESADO_ALTO:     360,
  PROCESADO_ESPEJO:   false,       // espeja en horizontal la copia plana (el domo se ve desde adentro) — live
  PROCESADO_TIMEOUT_S: 3,          // Z94b: sin lecturas en esto desde el inicio, o sin cuadros nuevos esto seguido → "cruda" en caliente — live
  PROCESADO_REINTENTO_S: 10,       // Z94c: en "cruda", cada esto se prueba el procesado en segundo plano — live
  PROCESADO_MAX_REINTENTOS: 5,     // Z94c: tope de pruebas por transmisión; después queda en "cruda" — live
  PROCESADO_CONFIRMAR_S: 2,        // Z94c: la prueba debe dar cuadros esto seguido para volver a "procesado" — live
  PROCESADO_LECTURA_MAX_MS: 1000,  // Z94c: una lectura asíncrona que tarda más se da por colgada (y se libera el turno) — live
  PROCESADO_SRGB:     true,        // codifica a sRGB (en pantalla lo hace el OutputPass; acá el pase va directo al canvas) — live
};

// ── Z99: BAJO ÁCIDO (motor lib/audio/bajoAcido.ts, lógica lib/bajoAcido.ts) y su atril BA-40 (lib/atrilBajo.ts) ──
export const DBG_BAJO = {
  ACTIVO:                 true,     // false = sin bajo (no se suscribe al reloj ni crea la voz) — vale al montar
  RAIZ_MIDI:              36,       // C2: nota 0 de los pasos (0…24 semitonos encima) — live
  TEMPO_HEREDADO:         true,     // true = reloj y tempo de la caja de ritmos (núcleo); false = reloj propio con BPM — live
  BPM:                    124,      // solo con TEMPO_HEREDADO false — live
  LOOKAHEAD_S:            0.1,      // reloj propio: anticipo de programación (s) — live
  INTERVALO_S:            0.025,    // reloj propio: cada cuánto despierta el programador (s) — vale al arrancar
  FILTRO_FRECUENCIA_MIN:  60,       // Hz (rango de CORTE) — live
  FILTRO_FRECUENCIA_MAX:  6000,     // Hz — live
  RES_MAX:                18,       // Q máximo de la etapa resonante — live
  ENV_OCTAVAS:            4,        // cuánto sube el corte con MOD. ENV. al máximo (octavas) — live
  GATE:                   0.55,     // fracción del paso que dura una nota sin desliz — live
  ONDA:                   "sierra" as string,   // "sierra" | "cuadrada" (defecto) — live
  ON:                     true,     // ON del módulo SALIDA (silencia sin parar el reloj) — live
  PATRON_INICIAL:         "CHICAGO" as string,  // vale al cargar
  PATRON_APLICA_VOZ:      true,     // Z102: FUNK y DISCO traen su seteo de voz (onda, CORTE, RESONANCIA…) y lo aplican al cargarse — live
  // valores por defecto de cada parámetro (los rangos están en PARAMS_BAJO de lib/bajoAcido.ts)
  AFINACION:              0,        // semitonos
  CORTE:                  420,      // Hz
  RESONANCIA:             0.6,      // 0…1
  MOD_ENV:                0.6,      // 0…1
  DECAY:                  0.3,      // s
  ACENTO:                 0.6,      // 0…1
  DESLIZ:                 0.06,     // s
  DISTORSION:             0.15,     // 0…1
  VOLUMEN:                0.7,      // 0…1
};
// ── Z99b: disposición de los instrumentos detrás de la tarima (lib/instrumentosDisposicion.ts, lib/instrumentosPose.ts) ──
// "arco": todos a la misma distancia del centro de la tarima (la de la caja de ritmos), mirando al centro; la caja en el
// medio del arco, donde la dejó Z88. "linea": la línea de Z88 (vuelve atrás sin borrar nada). Solo con
// DBG_RITMOS.UBICACION "detras_tarima" (con "slot_atril" sigue Z79).
export const DBG_INSTRUMENTOS = {
  DISPOSICION:      "arco" as string,   // "arco" | "linea" — live
  RADIO_M:          0,        // 0 = automático: distancia de la caja al centro de la tarima (3,596 m hoy) — live (la caja no se mueve)
  SEPARACION_M:     2.0,      // distancia en línea recta entre vecinos (> 1,8 m: rango de la tecla E) — live
  ARCO_MAX_GRADOS:  150,      // tope del arco total; si se pasa, se reduce la separación proporcionalmente — live
  INDICE_MAX:       0,        // 0 = auto (el mayor |índice| ocupado o reservado: hoy 2); 1…3 = fijo — live
  MIRAR_AL_CENTRO:  true,     // false = todos con el yaw de la caja (de frente a la tarima) — live
  GUIA:             false,    // guía de debug en el piso con los slots numerados (oculta por defecto) — live
};
export const DBG_ATRIL_BAJO = {
  INDICE_ARCO:            1,        // Z99b: índice en el arco (0 = caja; +1 = al lado, lado del atril de sonido) — live (con "arco")
  SLOT:                   0,        // slot de instrumentos detrás de la tarima (Z88; 0 = el de al lado de la caja, lado del atril de sonido) — live (con "linea")
  ETIQUETA_ESCALA:        1.0,      // multiplica títulos y etiquetas — live (rehace la serigrafía)
  ETIQUETA_AUTO_ASPECTO:  true,     // proporción < 1,6: hasta × 1,15 — live
  DISPLAY_VALOR_S:        2.5,      // s que el display muestra el control tocado — live
  VU_HZ:                  30,       // tope de actualización del VU y del display — live
  ROTULOS_FILA:           true,     // leyenda "1 SECUENCIA · 2 VOZ · 3 SALIDA" en la placa y números en los títulos — live
  ROTULOS_MODO:           "barra" as string,   // "barra" (leyenda en la placa de la barra) — live
  ESCALA_PASOS:           1.0,      // tamaño de las teclas PASO (0,8…1,2) — vale al remontar
  MODULO_CARA:            true,     // Z100: módulo 4 CARA en la fila de abajo (false = layout de Z99) — vale al recargar
};

// ── Z100: tocar el BA-40 con la cara (lib/cara.ts puro, lib/caraBajo.ts, lib/caraWorker.ts, MediaPipe Face Landmarker) ──
// El video de la cara NO sale de la máquina: se reduce a 320×240, lo procesa un Web Worker local y vuelve solo un arreglo
// de 9 números (7 blendshapes, inclinación y presencia). Lo que viaja a SILLAS sigue siendo el audio del bus y la imagen
// procesada del domo (Z94), como antes.
export const DBG_CARA = {
  FPS_CARA:                   20,      // cuadros por segundo que se mandan al worker (uno en vuelo a la vez) — live
  ANCHO_CUADRO:               320,     // px del cuadro reducido que se manda al worker — live
  ALTO_CUADRO:                240,
  ACTIVO_SOLO_EN_ATRIL:       true,    // se apaga al salir del modo atril del BA-40 — live
  CARA_PRIORIDAD_MANUAL:      true,    // arrastrar una perilla tomada manda sobre la cara solo mientras se arrastra — live
  CARA_MINCUTOFF:             1.2,     // filtro 1 euro: corte en reposo (Hz). Más bajo = más suave quieto — live
  CARA_BETA:                  0.6,     // filtro 1 euro: cuánto sube el corte con la velocidad (menos retraso) — live
  CARA_DCUTOFF:               1.0,     // filtro 1 euro: corte de la medición de velocidad (Hz) — live
  CARA_RANGO_MIN:             0.08,    // rango mínimo de un gesto calibrado (no divide por casi cero) — live
  CARA_ACENTO_UMBRAL:         1.6,     // cabeceo: velocidad del pitch (rad/s) que dispara el acento forzado — live
  CARA_ACENTO_REFRACTARIO_MS: 300,     // cabeceo: ms sin volver a disparar — live
  CARA_GUINO_CERRADO:         0.6,     // guiño: un ojo por encima de esto… — live
  CARA_GUINO_ABIERTO:         0.3,     // …y el otro por debajo de esto — live
  CARA_GUINO_MIN_MS:          120,     // guiño: sostenido al menos esto — live
  CARA_GUINO_REFRACTARIO_MS:  800,     // guiño: ms sin volver a cambiar de patrón — live
  CARA_MEDIDOR_CAIDA:         0.85,    // caída por cuadro del medidor CABECEO (se ve el golpe) — live
  CAL_PASO_S:                 2,       // segundos por paso de la calibración — live
  SIN_CALIBRAR:               false,   // true = usa los límites por defecto aunque haya calibración guardada — live
  MODELO_LOCAL:               true,    // busca primero /alight/mediapipe/ (modelo y wasm locales); si no están, el CDN — vale al encender
  // Mapa gesto → parámetro (tabla de datos; gesto: 0 BOCA, 1 O, 2 SONRISA, 3 CEJAS). salMin/salMax: rango 0…1 del
  // parámetro (CORTE va con su curva exponencial de 60 a 6000 Hz). Solo parámetros modulables (Z99) — live
  MAPA: [
    { gesto: 0, param: "corte",      salMin: 0.15, salMax: 1,    activo: true },
    { gesto: 1, param: "resonancia", salMin: 0.2,  salMax: 0.95, activo: true },
    { gesto: 2, param: "decay",      salMin: 0.1,  salMax: 0.9,  activo: true },
    { gesto: 3, param: "distorsion", salMin: 0,    salMax: 0.8,  activo: true },
  ],
  CABECEO_ACENTO:             true,    // cabeceo → acento forzado de la próxima nota — live
  GUINO_PATRON:               true,    // guiño → siguiente patrón de fábrica — live
  // Simulación sin cámara (menú): alimenta el mismo camino desde los blendshapes, sin worker. Apagada por defecto.
  SIMULAR:                    false,
  SIM_BOCA: 0, SIM_O: 0, SIM_SONRISA: 0, SIM_CEJAS: 0, SIM_CABECEO: 0, SIM_GUINO: 0,   // 0…1 (CABECEO = pitch 0…0,6 rad)
};

// ── Z101: SINTETIZADOR SY-40 (motor lib/audio/sinte.ts, lógica pura lib/sinte.ts, atril lib/atrilSinte.ts) ──
// Los rangos de cada parámetro están en PARAMS_SINTE (lib/sinte.ts); acá van los valores por defecto (los del sonido
// inicial si el sonido no lo fija) y los topes que aplica el motor.
export const DBG_SINTE = {
  ACTIVO:                 true,     // false = sin sinte (no crea voces ni se suscribe al reloj) — vale al montar
  SINTE_VOCES:            6,        // voces preasignadas (polifonía); al cambiarlo se rehacen al próximo silencio — vale al reiniciar
  SINTE_MIDI:             false,    // Web MIDI (navigator.requestMIDIAccess): pide permiso al montar el atril — vale al montar
  LOOKAHEAD_S:            0.01,     // margen de programación de las notas en vivo (s): suenan en ahora + esto (el arpegiador usa la anticipación del reloj del núcleo) — live
  ON:                     true,     // ON del módulo TECLADO Y SALIDA (silencia sin soltar las voces) — live
  SONIDO_INICIAL:         "DRON" as string,  // Z102: el dron sostenido y etéreo (antes PAD) — vale al cargar
  OCTAVA:                 4,        // octava de la tecla DO del teclado (DO4 = MIDI 60) — live
  OCTAVA_MIN:             1,
  OCTAVA_MAX:             7,
  // topes del motor
  CORTE_MIN:              40,       // Hz
  CORTE_MAX:              12000,    // Hz
  RES_MAX:                14,       // Q máximo del filtro (RESONANCIA 1)
  ENV_OCTAVAS:            5,        // cuánto abre el corte MOD. ENV. al máximo (octavas)
  RUIDO_MAX:              0.45,     // nivel del ruido con RUIDO 1 (relativo a un oscilador)
  LFO_AFIN_CENTS:         60,       // vibrato con PROFUNDIDAD 1 (centésimas, ±)
  LFO_CORTE_CENTS:        2400,     // barrido del corte con PROFUNDIDAD 1 (centésimas, ±: 2 octavas)
  LFO_VOL_MAX:            0.8,      // trémolo con PROFUNDIDAD 1 (fracción del volumen)
  ECO_REALIM_MAX:         0.85,     // tope de la realimentación del eco (no se descontrola)
  ECO_FILTRO_HZ:          3200,     // filtro suave (pasa-bajos) dentro del lazo del eco
  ECO_MAX_S:              2.0,      // tiempo máximo del eco (s)
  NIVEL_VOZ:              0.15,     // pico de cada voz (6 voces con SUB y VOLUMEN 7 no saturan el bus)
  ARP_GATE:               0.8,      // fracción del paso del arpegiador que suena cada nota
  ARP_SEMILLA:            0xA21,    // semilla del patrón AZAR (fija: determinista)
  ARP_ON:                 false,    // ARPEGIADOR — live
  ARP_PATRON:             0,        // 0 ARRIBA, 1 ABAJO, 2 IDA Y VUELTA, 3 AZAR — live
  ARP_VELOCIDAD:          0,        // 0 = 1/16, 1 = 1/8, 2 = 1/4 — live
  ARP_OCTAVAS:            1,        // 1…3 — live
  // valores por defecto de cada parámetro (PARAMS_SINTE: id → clave)
  ONDA1:                  2,        // 0 SENO, 1 TRIÁNGULO, 2 SIERRA, 3 CUADRADA
  ONDA2:                  2,
  DESAFINE:               8,        // centésimas entre OSC1 y OSC2
  MEZCLA:                 0.5,      // 0 = solo OSC1 · 1 = solo OSC2
  SUB:                    0.3,
  SUB_ONDA:               0,        // 0 CUADRADA, 1 SENO
  RUIDO:                  0,
  CORTE:                  2400,     // Hz
  RESONANCIA:             0.25,
  MOD_ENV:                0.35,
  SEGUIMIENTO:            0.5,      // seguimiento de tecla del corte (1 = el corte sube una octava por octava)
  ATAQUE:                 0.01,     // s (envolvente de amplitud)
  DECAY:                  0.3,      // s
  SOSTENIDO:              0.7,      // 0…1
  RELEASE:                0.4,      // s
  F_ATAQUE:               0.01,     // s (envolvente del filtro)
  F_DECAY:                0.4,
  F_SOSTENIDO:            0.3,
  F_RELEASE:              0.4,
  LFO_VELOCIDAD:          5,        // Hz
  LFO_PROFUNDIDAD:        0,
  LFO_DESTINO:            0,        // 0 AFINACIÓN, 1 CORTE, 2 VOLUMEN
  ECO_TIEMPO:             1,        // 0 = 1/8, 1 = 1/4, 2 = 1/4 con puntillo (sincronizado con el BPM de la caja)
  ECO_REALIM:             0.35,
  ECO_MEZCLA:             0,
  ESPACIO:                0,        // Z102: mezcla de la reverberación (0 = no procesa)
  VOLUMEN:                0.7,
  ESPACIO_DUR_S:          2.8,      // Z102: largo de la respuesta al impulso (se genera una vez al nacer el grafo)
  ESPACIO_SECO:           0.3,      // Z102: cuánto baja el seco con ESPACIO al máximo
};
export const DBG_ATRIL_SINTE = {
  ETIQUETA_ESCALA:        1.0,      // multiplica títulos y etiquetas — live (rehace la serigrafía)
  ETIQUETA_AUTO_ASPECTO:  true,     // proporción < 1,6: hasta × 1,15 — live
  DISPLAY_VALOR_S:        2.5,      // s que el display muestra el control tocado — live
  VU_HZ:                  30,       // tope de actualización del VU y del display — live
  ROTULOS_FILA:           true,     // leyenda "1 SONIDOS · 2 TIMBRE · …" en la placa y números en los títulos — live
  ROTULOS_MODO:           "barra" as string,   // "barra" (leyenda en la placa de la barra) — live
};

// ── Z103: SAMPLER SM-40 (motor lib/audio/sampler.ts, lógica pura lib/sampler.ts, atril lib/atrilSampler.ts) ──
export const DBG_SAMPLER = {
  ACTIVO:                  true,     // false = sin sampler (no crea el grafo ni se suscribe al reloj) — vale al montar
  SAMPLER_VOCES:           8,        // ranuras base preasignadas (una por pad); el grupo es max(VOCES, MAX_SIMULTANEAS) — vale al reiniciar
  SAMPLER_MAX_SIMULTANEAS: 12,       // tope de fuentes vivas a la vez (la nueva roba la más antigua con ~8 ms de caída) — live
  SAMPLER_MAX_S:           8,        // duración máxima de una grabación (corte automático) — live
  QUANT:                   0,        // 0 OFF, 1 = 1/16, 2 = 1/4, 3 = COMPÁS (solo con la caja sonando) — live
  ON:                      true,     // ON del módulo SALIDA — live
  CORTE_MIN:               200,      // Hz (rango del filtro de salida)
  CORTE_MAX:               16000,    // Hz
  RES_MAX:                 4,        // Q máximo del filtro de salida (suave: oscurece sin silbar)
  ROBO_S:                  0.008,    // caída de una fuente robada o soltada (s)
  LOOKAHEAD_S:             0.005,    // margen de los disparos inmediatos (s)
  FUENTE_GRAB:             0,        // 0 MIC, 1 MEZCLA — live
  // valores por defecto (PARAMS_SAMPLER: id → clave); los por pad valen para los 8 (el DRON de fábrica arranca con LOOP)
  CORTE:                   7000,     // Hz
  RESONANCIA:              0.15,
  VOLUMEN:                 0.75,
  AFINACION:               0,        // semitonos
  INICIO:                  0,
  FIN:                     1,
  VOL_PAD:                 0.8,
  LOOP:                    0,
  REVERSA:                 0,
  MODO:                    0,        // 0 DISPARO, 1 MIENTRAS
};
export const DBG_ATRIL_SAMPLER = {
  ETIQUETA_ESCALA:        1.0,      // multiplica títulos y etiquetas — live (rehace la serigrafía)
  ETIQUETA_AUTO_ASPECTO:  true,     // proporción < 1,6: hasta × 1,15 — live
  DISPLAY_VALOR_S:        2.5,      // s que el display muestra el control tocado — live
  VU_HZ:                  30,       // tope de actualización del VU, el display y las luces — live
  ROTULOS_FILA:           true,     // leyenda "1 PADS · 2 GRABAR · 3 EDITAR PAD · 4 SALIDA" en la placa y números en los títulos — live
  ROTULOS_MODO:           "barra" as string,   // "barra" (leyenda en la placa de la barra) — live
};

// ── Z87: fuente de video de la tarima y visualizador de ondas sin webcam (lib/ondasTarima.ts, lib/fuenteVideoTarima.ts) ──
// (DBG_ONDAS ya existe: son las ondas por kick del domo de SILLAS, Z52; por eso este se llama DBG_ONDAS_TARIMA.)
export const DBG_ONDAS_TARIMA = {
  MODO:          "auto" as string,     // "auto" (sin webcam → ondas) | "webcam" | "ondas" (forzar) — live
  FPS:           30,                   // cuadros por segundo del canvas de ondas — live
  // Z98: visualizador nuevo: "cascada" | "xy" (los de Z87 "onda" | "espectro" | "ambos" siguen funcionando) — live
  ESTILO:        "cascada" as string,
  // Z98: "ambar" | "fosforo" | "identidad" (franjas de las placas, lib/marca.ts); Z87: "verde" | "cian" — live
  PALETA:        "ambar" as string,
  GROSOR:        3,                    // px del trazo (canvas de 640×360) — live
  PERSISTENCIA:  0.82,                 // estela: cuánto queda del cuadro anterior (0 = sin estela) — live
  SENSIBILIDAD:  2.5,                  // ganancia sobre el analizador maestro — live
  PUNTOS:        256,                  // puntos de la forma de onda — live
  BARRAS:        48,                   // barras del espectro — live
  // ── Z98: visualizador retro (lib/visualizadorTarima.ts y visualizadorTarimaDibujo.ts) ──
  VISUALIZADOR_NUEVO: true,            // false = el dibujo de Z87 tal cual (onda / espectro) — live
  LINEAS:        24,                   // CASCADA: líneas del historial (vale al cambiar: rehace el buffer) — live
  COLUMNAS:      96,                   // CASCADA: puntos por línea (frecuencias) — live
  SUBIDA:        0.6,                  // suavizado: cuánto sube por cuadro hacia un valor mayor (0…1) — live
  BAJADA:        0.12,                 // suavizado: cuánto baja por cuadro (lento) — live
  FREC_MIN:      0.006,                // fracción del espectro donde empieza el eje (≈ 140 Hz con fft 2048 a 48 kHz) — live
  FREC_SUAVE:    0.75,                 // 0 = eje lineal · 1 = logarítmico — live
  XY_MODO:       "auto" as string,     // "auto" (estéreo si los canales difieren; si no, retardo) | "estereo" | "retardo" — live
  XY_RETARDO:    10,                   // muestras de retardo para Y en mono (8…12) — live
  XY_PUNTOS:     512,                  // puntos de la figura — live
  XY_PERSISTENCIA: 0.86,               // estela de fósforo del XY (0 = sin estela) — live
  COLOR_VELOC:   0.15,                 // IDENTIDAD: ciclos por segundo de los colores sobre las ondas — live
  ROTULO:        true,                 // rótulo de esquina "CASCADA · ÁMBAR" — live
};
