# Mapa de diálogos — camino LUZ (generado)

> Archivo generado por `scripts/ink-build.mjs` desde `docs/dialogos/dialogo-luz.ink`. No lo edites a mano: editá el .ink (tags `# estado:`) y volvé a correr el script.

**Resumen:** 24 líneas · 9 cerradas · 15 pendientes · 3 con efecto del juego.

## Líneas

| ID | Nodo | Dice la entidad | Estado | Efecto | Opciones → destino |
|---|---|---|---|---|---|
| 1 | `n_1` | ¿No es suficiente? | ✅ cerrada | — | a) Sí. → 1.a<br>b) No. → 1.b<br>c) A veces. → 1.c<br>d) ¿Para vos sí? → 1.d |
| 1.a | `n_1_a` | Quizás la *luz* no es para vos. | ✅ cerrada | juego_alarma | — |
| 1.a.premio | `premio_otorgado` | Quizás tenés otras habilidades o mucha curiosidad. | ✅ cerrada | premio_otorgado | — |
| 1.b | `n_1_b` | ¿Qué estás buscando? | ✅ cerrada | — | a) Entretenerme. → 1.b.a<br>b) Que me entiendan. → 1.b.b<br>c) Saber más. → 1.b.c<br>d) Entender de qué va todo est… → 1.b.d |
| 1.b.a | `n_1_b_a` | — | ✅ cerrada | ir_tarima_sin_publico | — |
| 1.b.b | `n_1_b_b` | ¿Por qué crees que no te entienden? | ✅ cerrada | — | a) No están a mi altura. → 1.b.b.a<br>b) No sé expresarme. → 1.b.b.b<br>c) A veces siento que estoy en… → 1.b.b.c<br>d) ¿Por qué crees que lo sé? Y… → 1.b.b.d |
| 1.b.b.a | `p_1_b_b_a` | — | 🟧 pendiente | — | — |
| 1.b.b.b | `p_1_b_b_b` | — | 🟧 pendiente | — | — |
| 1.b.b.c | `p_1_b_b_c` | — | 🟧 pendiente | — | — |
| 1.b.b.d | `p_1_b_b_d` | — | 🟧 pendiente | — | — |
| 1.b.c | `n_1_b_c` | ¿Qué te inquieta? | ✅ cerrada | — | a) ¿Por qué estoy acá? → 1.b.c.a<br>b) ¿Qué viene después? → 1.b.c.b<br>c) ¿Qué tiene que ver con todo… → 1.b.c.c<br>d) Lo mismo que a vos. → 1.b.c.d |
| 1.b.c.a | `p_1_b_c_a` | — | 🟧 pendiente | — | — |
| 1.b.c.b | `p_1_b_c_b` | — | 🟧 pendiente | — | — |
| 1.b.c.c | `p_1_b_c_c` | — | 🟧 pendiente | — | — |
| 1.b.c.d | `p_1_b_c_d` | — | 🟧 pendiente | — | — |
| 1.b.d | `n_1_b_d` | Me gustaría saberlo también. ¿Vos qué pensas? | 🟧 pendiente | — | — |
| 1.c | `n_1_c` | ¿Crees que alguna vez va a ser suficiente? | ✅ cerrada | — | a) Si. → 1.a<br>b) No. → 1.b<br>c) No tendría por qué serlo. → 1.c.c<br>d) ¿Vos también te diste cuent… → 1.c.d |
| 1.c.c | `p_1_c_c` | — | 🟧 pendiente | — | — |
| 1.c.d | `p_1_c_d` | — | 🟧 pendiente | — | — |
| 1.d | `n_1_d` | Yo creo que nos motiva lo mismo entonces. | ✅ cerrada | — | a) No sé de qué estas hablando. → 1.d.a<br>b) Nada nunca es suficiente… → 1.d.b<br>c) ¿Para qué es todo esto? → 1.d.c<br>d) Hay que hacer algo entonces. → 1.d.d |
| 1.d.a | `p_1_d_a` | — | 🟧 pendiente | — | — |
| 1.d.b | `p_1_d_b` | — | 🟧 pendiente | — | — |
| 1.d.c | `p_1_d_c` | — | 🟧 pendiente | — | — |
| 1.d.d | `p_1_d_d` | — | 🟧 pendiente | — | — |

## Pendientes por completar

- [ ] **1.b.b.a** (`p_1_b_b_a`)
- [ ] **1.b.b.b** (`p_1_b_b_b`)
- [ ] **1.b.b.c** (`p_1_b_b_c`)
- [ ] **1.b.b.d** (`p_1_b_b_d`)
- [ ] **1.b.c.a** (`p_1_b_c_a`)
- [ ] **1.b.c.b** (`p_1_b_c_b`)
- [ ] **1.b.c.c** (`p_1_b_c_c`)
- [ ] **1.b.c.d** (`p_1_b_c_d`)
- [ ] **1.b.d** (`n_1_b_d`)
- [ ] **1.c.c** (`p_1_c_c`)
- [ ] **1.c.d** (`p_1_c_d`)
- [ ] **1.d.a** (`p_1_d_a`)
- [ ] **1.d.b** (`p_1_d_b`)
- [ ] **1.d.c** (`p_1_d_c`)
- [ ] **1.d.d** (`p_1_d_d`)

## Efectos del juego (los ejecuta el código, no ink)

- **1.a** → `juego_alarma`
- **1.a.premio** → `premio_otorgado`
- **1.b.a** → `ir_tarima_sin_publico`

## Diagrama

Verde = cerrada · Amarillo = pendiente · Azul = dispara un efecto del juego.

```mermaid
flowchart TD
  N_n_1["1<br/>¿No es suficiente?"]:::cerrado
  N_n_1_a["1.a<br/>Quizás la luz no es para vos."]:::efecto
  N_premio_otorgado["1.a.premio<br/>Quizás tenés otras habilidades o …"]:::efecto
  N_n_1_b["1.b<br/>¿Qué estás buscando?"]:::cerrado
  N_n_1_b_a["1.b.a<br/>⚙ ir_tarima_sin_publico"]:::efecto
  N_n_1_b_b["1.b.b<br/>¿Por qué crees que no te entiende…"]:::cerrado
  N_p_1_b_b_a["1.b.b.a<br/>(sin texto)"]:::pendiente
  N_p_1_b_b_b["1.b.b.b<br/>(sin texto)"]:::pendiente
  N_p_1_b_b_c["1.b.b.c<br/>(sin texto)"]:::pendiente
  N_p_1_b_b_d["1.b.b.d<br/>(sin texto)"]:::pendiente
  N_n_1_b_c["1.b.c<br/>¿Qué te inquieta?"]:::cerrado
  N_p_1_b_c_a["1.b.c.a<br/>(sin texto)"]:::pendiente
  N_p_1_b_c_b["1.b.c.b<br/>(sin texto)"]:::pendiente
  N_p_1_b_c_c["1.b.c.c<br/>(sin texto)"]:::pendiente
  N_p_1_b_c_d["1.b.c.d<br/>(sin texto)"]:::pendiente
  N_n_1_b_d["1.b.d<br/>Me gustaría saberlo también. ¿Vos…"]:::pendiente
  N_n_1_c["1.c<br/>¿Crees que alguna vez va a ser su…"]:::cerrado
  N_p_1_c_c["1.c.c<br/>(sin texto)"]:::pendiente
  N_p_1_c_d["1.c.d<br/>(sin texto)"]:::pendiente
  N_n_1_d["1.d<br/>Yo creo que nos motiva lo mismo e…"]:::cerrado
  N_p_1_d_a["1.d.a<br/>(sin texto)"]:::pendiente
  N_p_1_d_b["1.d.b<br/>(sin texto)"]:::pendiente
  N_p_1_d_c["1.d.c<br/>(sin texto)"]:::pendiente
  N_p_1_d_d["1.d.d<br/>(sin texto)"]:::pendiente
  N_n_1 -->|"Sí."| N_n_1_a
  N_n_1 -->|"No."| N_n_1_b
  N_n_1 -->|"A veces."| N_n_1_c
  N_n_1 -->|"¿Para vos sí?"| N_n_1_d
  N_n_1_b -->|"Entretenerme."| N_n_1_b_a
  N_n_1_b -->|"Que me entiendan."| N_n_1_b_b
  N_n_1_b -->|"Saber más."| N_n_1_b_c
  N_n_1_b -->|"Entender de qué va to…"| N_n_1_b_d
  N_n_1_b_b -->|"No están a mi altura."| N_p_1_b_b_a
  N_n_1_b_b -->|"No sé expresarme."| N_p_1_b_b_b
  N_n_1_b_b -->|"A veces siento que es…"| N_p_1_b_b_c
  N_n_1_b_b -->|"¿Por qué crees que lo…"| N_p_1_b_b_d
  N_n_1_b_c -->|"¿Por qué estoy acá?"| N_p_1_b_c_a
  N_n_1_b_c -->|"¿Qué viene después?"| N_p_1_b_c_b
  N_n_1_b_c -->|"¿Qué tiene que ver co…"| N_p_1_b_c_c
  N_n_1_b_c -->|"Lo mismo que a vos."| N_p_1_b_c_d
  N_n_1_c -->|"Si."| N_n_1_a
  N_n_1_c -->|"No."| N_n_1_b
  N_n_1_c -->|"No tendría por qué se…"| N_p_1_c_c
  N_n_1_c -->|"¿Vos también te diste…"| N_p_1_c_d
  N_n_1_d -->|"No sé de qué estas ha…"| N_p_1_d_a
  N_n_1_d -->|"Nada nunca es sufic…"| N_p_1_d_b
  N_n_1_d -->|"¿Para qué es todo est…"| N_p_1_d_c
  N_n_1_d -->|"Hay que hacer algo en…"| N_p_1_d_d
  classDef cerrado fill:#2E9E5B,stroke:#12101A,color:#fff;
  classDef pendiente fill:#F4B62E,stroke:#12101A,color:#12101A;
  classDef efecto fill:#1F7FB8,stroke:#12101A,color:#fff;
```
