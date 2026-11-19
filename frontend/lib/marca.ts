// Z68: nombre de la empresa de la ficción (antes "AUSTRAL ELECTRIC"). Cambiarlo acá lo cambia en toda la experiencia.
// Sin imports (se prueba en Node: scripts/marca-test.mjs). En JSX usalo siempre entre llaves ({NOMBRE_EMPRESA}): un
// apóstrofo recto suelto en el texto de JSX dispara react/no-unescaped-entities.
export const NOMBRE_EMPRESA = "In-Go's Wan Inc.";
/** Variante en mayúsculas para serigrafías y cabeceras (calculada una vez, al cargar el módulo). */
export const NOMBRE_EMPRESA_MAYUS = NOMBRE_EMPRESA.toUpperCase();
/**
 * Z98: colores de la banda de franjas de las placas de los atriles (SONIDO SN-40 e IMAGEN IM-40), en orden. Fuente única:
 * la usan las placas, la serigrafía y la paleta IDENTIDAD del visualizador de la tarima (lib/visualizadorTarima.ts).
 */
export const FRANJAS_PLACA = ["#E5322B", "#F0742A", "#F4B62E", "#2E9E5B", "#1F7FB8"] as const;
