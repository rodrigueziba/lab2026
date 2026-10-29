# LECTERN_STATUS — Ronda 13

Auditoría ejecutada contra el commit de seguridad `f8f6eff` (lecterns-ronda13).
Referencia de comparación: commit `34bc0de` ("avances a light", último estado committeado previo a esta ronda).

---

## ✅ YA ESTABA (13 ítems)

Presentes y funcionales antes de esta ronda (en `34bc0de` o commits K3/J5 del historial):

1. **Panel negro carbón sin manchas** — `grimeScale: 0` en cpanel/panel (wear.ts + lecternMaterials.ts); K3.
2. **Marco perimetral y barra trasera** — OUTER_W frame (NOGAL_MAT), REAR_BAR, franjas plateadas laterales; original LecternSystem.
3. **Perillas con falda, indicador blanco y escala impresa** — cilindro de falda (KNOB_SKIRT), línea de indicador (SILK_MAT), 11 marcas de escala en arco ±135°; original.
4. **Interruptores basculantes (rocker) con LED y halo** — LED (ledMatRef), halo ring aditivo (haloMatRef), overlay de brillo cuando OFF; K3.
5. **Pulsadores crema de 0.02 m de alto** — `BTN_H = 0.020`, PUSHBTN_MAT `#e8e2cf`; original.
6. **Keycaps de las teclas Z–M** — `KEY_LETTERS`, `keycapTex`, posición en esquina superior derecha del pulsador; original.
7. **Display numerado del nivel de luces elevado sobre el panel** — caja 3D (70×8×30 mm) + pantalla 2:1 con `intensity.toFixed(1)`; K3.
8. **Feedback completo al apretar** — hundimiento 18 mm + spring (200 ms), flash emissivo, anillo expansivo (260 ms), `playUIClick()`, LecternHUD 1200 ms; K3.
9. **Cámara auto-ajustada para ambos atriles** — `fitLecternCamera` (K1) para IMAGE y SOUND, resize handler; K1.
10. **Flecha verde y overlays de debug ocultos por defecto** — `showGizmo: false`, `showSections: false` en `DBG_LECTERNS`; original.
11. **Cartel «Tocar E para interactuar» solo cuando aparecen los atriles** — condición `lecternsVisible.current === true` en ThreeScene.tsx; original.
12. **Tiempos correctos** — `PEOPLE_MIN_DELAY_MS = 5_000` ms (personas: max(5 s, cara capturada)); `LECTERNS_AFTER_PEOPLE_MS = 10_000` ms (atriles tras personas); Audience.tsx + LecternSystem.tsx.
13. **Atriles 30 cm más lejos del centro de la tarima** — `LECTERN_OUTWARD_OFFSET_M = 0.30` → `LECTERN_PLACE_X = 1.60 m`; debugConfig.ts.

---

## 🔧 RESTAURADO / ARREGLADO EN ESTA RONDA (3 ítems)

Código existía pero estaba visualmente roto (z-fighting) o incompleto (iconos/subtítulos):

1. **Etiquetas de sector con subtítulo** — Causa raíz: labels de sección en `y=0.001` = superficie del cpanel → z-fighting total. Arreglo: frames subidos a `y=0.002`, labels a `y=0.003`, `polygonOffset` en todos los materiales de texto. Subtítulos añadidos en `SecDef.subtitle` + JSX segunda línea (opacidad 0.65) para las 11 secciones de IMAGE y SOUND.
2. **Etiquetas de cada control** — Misma causa raíz (z-fighting). Las etiquetas de controles están en el grupo de controles (surfY = 0.004), por lo que su y absoluto ya era ≥ 0.005; se añadió `polygonOffset` a todos para consistencia y robustez.
3. **Íconos en los botones y rockers** — La mayoría de controles carecían del campo `icon:` en `CtrlDef`. Añadidos: `power`, `spiral`, `bars4`, `dbl_chevron`, `sun_minus`, `sun_star`, `sun_plus` (IMAGE); `lp_curve`, `hp_curve`, `distort`, `phaser_icon`, `pitch_arrows`, `wave_sine`, `target_icon` (SOUND). Sliders de cámara: `cone`, `sun_plain`, `half_circle`, `drop`, `magnifier`. ONDA cicla icono en `useFrame` (wave_sine/tri/sqr/saw). DESTINO muestra sub-label dinámica (VOLUMEN/FILTRO/PITCH) bajo el botón. 22 nuevas entradas en `iconTex()` + helper `_drawSunRays()`.

---

## ❌ SIGUE AUSENTE (0 ítems)

Todos los ítems del checklist de la ronda están presentes.

> Nota: la aserción de dev para contar etiquetas esperadas vs creadas (mencionada en la especificación L1 interna, no en el checklist de ronda 13) no fue implementada. No está en la lista de verificación de esta ronda y no había implementación previa en el historial de git.

---

## Archivos modificados en esta ronda

- `frontend/components/LecternSystem.tsx` — z-fighting, subtítulos, iconos, polygonOffset, ONDA/DESTINO dinámico
- `frontend/lib/debugConfig.ts` — (sin cambios nuevos; ya tenía los valores correctos)

## Causa raíz principal encontrada

Las etiquetas (sección y control) se posicionaban en `y=0.001` dentro del grupo de controles, que es exactamente la cara superior del `cpanel` (cpanel top = PANEL_T + CPANEL_T + 0.001 − controls_group_y = 0.064 − 0.063 = 0.001). Esto producía z-fighting completo haciendo las etiquetas invisibles.

## Suposiciones tomadas

- Se trató `iconTex` como cache inmutable: los nuevos íconos se crean una vez y se reutilizan. Los íconos dinámicos (ONDA, DESTINO) actualizan el `map` del material en `useFrame` sin recrear la textura.
- El subtítulo se coloca 13 mm hacia el usuario desde el título (en coords z del panel), dentro del rango de cada sección.
- Para sliders de cámara el ícono va solo en el extremo superior (high-value, z = +rail/2 + 0.025); el slider VOLUMEN mantiene su lógica existente (volume + mute en ambos extremos).
