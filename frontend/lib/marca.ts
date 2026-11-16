// Z68: nombre de la empresa de la ficción (antes "AUSTRAL ELECTRIC"). Cambiarlo acá lo cambia en toda la experiencia.
// Sin imports (se prueba en Node: scripts/marca-test.mjs). En JSX usalo siempre entre llaves ({NOMBRE_EMPRESA}): un
// apóstrofo recto suelto en el texto de JSX dispara react/no-unescaped-entities.
export const NOMBRE_EMPRESA = "In-Go's Wan Inc.";
/** Variante en mayúsculas para serigrafías y cabeceras (calculada una vez, al cargar el módulo). */
export const NOMBRE_EMPRESA_MAYUS = NOMBRE_EMPRESA.toUpperCase();
