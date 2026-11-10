// Z17: capa propia para la interfaz del domo cercano (panel acercado + HISTORIA / GALERÍA /
// FICHA + marco SEL + líneas guía + retícula). Los objetos en CAPA_UI no los dibuja el
// RenderPass principal (la cámara solo tiene la capa 0); los dibuja CapaUIPass en
// RetroPostFX, después de la escena y ANTES del bloom y del CRT, con el depth buffer
// limpio: depthTest normal entre los elementos de la interfaz, sin mezclarse con la sala.
// Sin luces (materiales sin iluminación); sin allocations por frame.

import type * as THREE from "three";

export const CAPA_UI = 5;

/** Estado compartido: el pase solo trabaja si hay algo en la capa. */
export const CAPA_UI_ESTADO = { activa: false };

// callback fijo para traverse (sin closures por frame)
let _enCapa = false;
function fijarCapa(o: THREE.Object3D): void {
  if (_enCapa) o.layers.set(CAPA_UI);
  else o.layers.set(0);
}
/** Pone (o saca) un objeto y sus hijos de la capa de interfaz. */
export function ponerEnCapaUI(obj: THREE.Object3D, enCapa: boolean): void {
  _enCapa = enCapa;
  obj.traverse(fijarCapa);
}
