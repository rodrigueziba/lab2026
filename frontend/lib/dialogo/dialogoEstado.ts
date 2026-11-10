// Z27: estado de módulo de la terminal de diálogo (lo escribe DialogoTerminal, lo leen el juego y
// el menú de debug). Mismo patrón que INTERACT_STATE / LINTERNA_STATE: objeto mutable, sin React.
// Eventos (window):
//  - entrada: 'alight:dialogo-abrir' { knot?: string } · 'alight:dialogo-cerrar'
//             'alight:dialogo-config' (el menú de debug cambió DBG_DIALOGO: tamaño/posición)
//  - salida:  'alight:dialogo-efecto' { efecto, id } · 'alight:dialogo-fin' { id }
//             'alight:dialogo-cerrado'
export const DIALOGO_STATE = {
  activo: false,  // la terminal está en pantalla
  nodo: "",       // tag id del nodo actual (ej. "1.b")
};

export function abrirDialogo(knot?: string) {
  window.dispatchEvent(new CustomEvent("alight:dialogo-abrir", { detail: { knot } }));
}
export function cerrarDialogo() {
  window.dispatchEvent(new CustomEvent("alight:dialogo-cerrar"));
}
