// ============================================================
// dialogo-luz.ink — Diálogo bajo la luz lejana (camino LUZ)
// Proyecto alight / lab2026
//
// CONVENCIONES (el script scripts/ink-build.mjs depende de esto):
//  - Un knot por línea del árbol. Nombre = n_<id con guion bajo> (ej: n_1_b_c).
//    Las líneas sin continuación llevan prefijo p_ (ej: p_1_b_b_a).
//  - Tags al inicio de cada knot:
//      # id: 1.b.c          -> el número del árbol original
//      # estado: cerrado | pendiente
//      # efecto: <nombre>   -> acción que ejecuta el JUEGO (ink no la ejecuta)
//  - Las opciones del usuario van entre corchetes: * [Texto.] -> destino
//    La interfaz muestra la opción elegida como eco del usuario.
//  - Cursiva: *texto*    Negrita: **texto**   (lo interpreta la interfaz)
//  - Para cambiar un destino, editá solo el "-> knot" de la opción.
// ============================================================

VAR premio = false   // el juego la persiste 1 hora (localStorage)

-> n_1

// ---------- 1 ----------
=== n_1 ===
# id: 1
# estado: cerrado
¿No es suficiente?
* [Sí.] -> n_1_a
* [No.] -> n_1_b
* [A veces.] -> n_1_c
* [¿Para vos sí?] -> n_1_d

// ---------- 1.a (también destino de 1.c.a) ----------
=== n_1_a ===
# id: 1.a
# estado: cerrado
# efecto: juego_alarma
// El juego: apaga las luces, emite alarm.mp3 desde el centro de la tarima y
// espera a que el usuario toque la tarima. Al tocarla llama a premio_otorgado.
Quizás la *luz* no es para vos.
-> END

=== premio_otorgado ===
# id: 1.a.premio
# estado: cerrado
# efecto: premio_otorgado
// Lo invoca el juego al tocar la tarima: enciende las luces, guarda premio=true
// por 1 hora y habilita en el menú debug (Shift) "ver mapa de decisiones".
~ premio = true
Quizás tenés otras habilidades o mucha curiosidad.
-> END

// ---------- 1.b ----------
=== n_1_b ===
# id: 1.b
# estado: cerrado
¿Qué estás buscando?
* [Entretenerme.] -> n_1_b_a
* [Que me entiendan.] -> n_1_b_b
* [Saber más.] -> n_1_b_c
* [Entender de qué va todo esto.] -> n_1_b_d

=== n_1_b_a ===
# id: 1.b.a
# estado: cerrado
# efecto: ir_tarima_sin_publico
// El juego envía al usuario al camino TARIMA, sin personas en las sillas y con
// los atriles desbloqueados.
-> END

=== n_1_b_b ===
# id: 1.b.b
# estado: cerrado
¿Por qué crees que no te entienden?
* [No están a mi altura.] -> p_1_b_b_a
* [No sé expresarme.] -> p_1_b_b_b
* [A veces siento que estoy en el lugar y tiempo incorrecto.] -> p_1_b_b_c
* [¿Por qué crees que lo sé? Y si lo supiera ¿Por qué te lo diria?] -> p_1_b_b_d

=== n_1_b_c ===
# id: 1.b.c
# estado: cerrado
¿Qué te inquieta?
* [¿Por qué estoy acá?] -> p_1_b_c_a
* [¿Qué viene después?] -> p_1_b_c_b
* [¿Qué tiene que ver con todo ésto?] -> p_1_b_c_c
* [Lo mismo que a vos.] -> p_1_b_c_d

=== n_1_b_d ===
# id: 1.b.d
# estado: pendiente
Me gustaría saberlo también. ¿Vos qué pensas?
-> END

// ---------- 1.c ----------
=== n_1_c ===
# id: 1.c
# estado: cerrado
¿Crees que alguna vez va a ser suficiente?
* [Si.] -> n_1_a
* [No.] -> n_1_b
* [No tendría por qué serlo.] -> p_1_c_c
* [¿Vos también te diste cuenta, no?] -> p_1_c_d

// ---------- 1.d ----------
=== n_1_d ===
# id: 1.d
# estado: cerrado
Yo creo que nos motiva lo mismo entonces.
* [No sé de qué estas hablando.] -> p_1_d_a
* [Nada nunca es **suficiente**.] -> p_1_d_b
* [¿Para qué es todo esto?] -> p_1_d_c
* [Hay que hacer algo entonces.] -> p_1_d_d

// ---------- LÍNEAS PENDIENTES (sin continuación escrita todavía) ----------
=== p_1_b_b_a ===
# id: 1.b.b.a
# estado: pendiente
-> END
=== p_1_b_b_b ===
# id: 1.b.b.b
# estado: pendiente
-> END
=== p_1_b_b_c ===
# id: 1.b.b.c
# estado: pendiente
-> END
=== p_1_b_b_d ===
# id: 1.b.b.d
# estado: pendiente
-> END
=== p_1_b_c_a ===
# id: 1.b.c.a
# estado: pendiente
-> END
=== p_1_b_c_b ===
# id: 1.b.c.b
# estado: pendiente
-> END
=== p_1_b_c_c ===
# id: 1.b.c.c
# estado: pendiente
-> END
=== p_1_b_c_d ===
# id: 1.b.c.d
# estado: pendiente
-> END
=== p_1_c_c ===
# id: 1.c.c
# estado: pendiente
-> END
=== p_1_c_d ===
# id: 1.c.d
# estado: pendiente
-> END
=== p_1_d_a ===
# id: 1.d.a
# estado: pendiente
-> END
=== p_1_d_b ===
# id: 1.d.b
# estado: pendiente
-> END
=== p_1_d_c ===
# id: 1.d.c
# estado: pendiente
-> END
=== p_1_d_d ===
# id: 1.d.d
# estado: pendiente
-> END
