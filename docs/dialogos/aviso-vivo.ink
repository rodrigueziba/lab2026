// ============================================================
// aviso-vivo.ink — Z85: aviso al espectador antes de recibir una transmisión en vivo de la tarima
// Proyecto alight / lab2026
//
// Mismas convenciones que dialogo-luz.ink (tags id / estado / efecto; opciones * [Texto.] -> destino).
// Los efectos los ejecuta el juego (lib/dialogo/efectosDialogo.ts → lib/avisoVivoAcciones.ts):
//   aviso_vivo_si    → acepta la transmisión (mezcla remota habilitada en esta sesión del navegador)
//   aviso_vivo_no    → no se vuelve a preguntar; sigue con audio y visual propios
//   aviso_vivo_salir → intenta cerrar la pestaña; si el navegador no lo permite, pantalla final
// Compilar: npm run ink:build (genera frontend/public/alight/dialogo/aviso-vivo.json).
// ============================================================

-> aviso

=== aviso ===
# id: av
# estado: cerrado
Estás a punto de recibir una transmisión de otra conciencia creativa. ¿Querés aceptarla?
* [Sí.] -> aviso_si
* [No.] -> aviso_no
* [Prefiero salir de acá.] -> aviso_salir

=== aviso_si ===
# id: av.si
# estado: cerrado
# efecto: aviso_vivo_si
-> END

=== aviso_no ===
# id: av.no
# estado: cerrado
# efecto: aviso_vivo_no
-> END

=== aviso_salir ===
# id: av.salir
# estado: cerrado
# efecto: aviso_vivo_salir
-> END
