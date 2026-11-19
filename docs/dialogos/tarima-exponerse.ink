// ============================================================
// tarima-exponerse.ink — Z91: consentimiento para exponerse y transmitir al elegir la TARIMA
// Proyecto alight / lab2026
//
// Mismas convenciones que dialogo-luz.ink y aviso-vivo.ink (tags id / estado / efecto; opciones * [Texto.] -> destino).
// Dos textos que abre el juego por separado (lib/consentTarimaAcciones.ts), en la misma terminal:
//   tx_texto1   → se abre ESPERA_INICIAL_S después de que las figuras están en escena (sin opciones)
//   tx_eleccion → se abre ESPERA_ENTRE_S después de que termina el primero (dos opciones)
// Los efectos los ejecuta el juego (lib/dialogo/efectosDialogo.ts → lib/consentTarimaAcciones.ts):
//   tarima_compartir → salen los atriles y se publica la presencia (sesión online)
//   tarima_privado   → salen los atriles; no se publica nada
// Cerrar la terminal sin elegir cuenta como "No compartir".
// Compilar: npm run ink:build (genera frontend/public/alight/dialogo/tarima-exponerse.json).
// ============================================================

-> tx_texto1

=== tx_texto1 ===
# id: tx.1
# estado: cerrado
La luz viene con propio peso. Exponerse y ser juzgado por uno mismo y por otros.
-> END

=== tx_eleccion ===
# id: tx.2
# estado: cerrado
Podés elegir compartir con otros tu experiencia en la luz siendo el centro de atención por un rato. Hasta ahora nada estuvo expuesto ni en línea, pero si querés podés ser el centro de atención de las personas que eligen el camino de las sillas.
* [Compartir mi sesión.] -> tx_compartir
* [No compartir.] -> tx_privado

=== tx_compartir ===
# id: tx.compartir
# estado: cerrado
# efecto: tarima_compartir
-> END

=== tx_privado ===
# id: tx.privado
# estado: cerrado
# efecto: tarima_privado
-> END
