/**
 * Lectura saneada de variables de entorno.
 *
 * Un valor de entorno pasa por muchas manos antes de llegar acá: un `.env`, la
 * consola, la CLI de un proveedor, el panel web. Cualquiera puede agregarle un
 * BOM invisible o espacios al borde, y el síntoma es desconcertante: la variable
 * se ve correcta y falla igual.
 *
 * Este proyecto ya perdió un deploy por exactamente eso: PowerShell antepuso un
 * BOM (U+FEFF) al canalizar `DATABASE_URL` hacia la CLI de Vercel, y el driver
 * de Postgres respondió `ERR_INVALID_URL` sobre una cadena que a simple vista
 * era idéntica a la correcta.
 *
 * Normalizar al leer es más barato que volver a diagnosticar eso.
 */

import { ErrorConfiguracion } from "./errores.ts";

/** Marca de orden de bytes. */
const BOM = String.fromCharCode(0xfeff);
/** Espacio de ancho cero. */
const ANCHO_CERO = String.fromCharCode(0x200b);

/**
 * Se arma desde códigos y no escribiendo los caracteres: puestos literales en el
 * fuente serían invisibles al revisar el código, que es exactamente cómo se coló
 * el problema la primera vez. Todo este archivo es ASCII legible.
 */
const INVISIBLES = new RegExp(
  `^[${BOM}${ANCHO_CERO}\\s]+|[${BOM}${ANCHO_CERO}\\s]+$`,
  "g",
);

/** Quita BOM, espacios de ancho cero y espacios de los extremos. */
export function leerEnv(nombre: string): string | undefined {
  const crudo = process.env[nombre];
  if (crudo === undefined) return undefined;

  const limpio = crudo.replace(INVISIBLES, "");
  return limpio.length > 0 ? limpio : undefined;
}

/**
 * Igual que `leerEnv`, pero falla ruidosamente si falta.
 *
 * Lanza `ErrorConfiguracion` y no un `Error` pelado: quien lo atrapa tiene que
 * poder decir "el servidor está mal configurado" en vez de "el servicio falló"
 * (hallazgo INT-20). Son dos problemas distintos y hasta ahora daban el mismo
 * 500 mudo.
 */
export function exigirEnv(nombre: string, ayuda: string): string {
  const valor = leerEnv(nombre);
  if (!valor) {
    throw new ErrorConfiguracion(`Falta ${nombre}. ${ayuda}`);
  }
  return valor;
}

/**
 * ¿Está habilitada la operación con datos personales reales?
 *
 * **Por defecto NO.** Hay que activarla explícitamente con
 * `OPERACION_REAL_HABILITADA=true`, y solo se puede activar legítimamente cuando
 * estén resueltos `{{BASE_LICITUD}}` y `{{PLAZO_RETENCION_PATENTE}}`
 * (`spec.md` §4 y §12).
 *
 * Mientras esté apagada, el sistema acepta únicamente patentes de fixture. La
 * app está pública en internet con la base productiva detrás: sin esta barrera,
 * el primer auto real que alguien registre convierte al piloto en tratamiento de
 * datos personales sin base de licitud ni plazo de retención, bajo la Ley 21.719.
 *
 * Es deliberadamente una barrera de código y no una advertencia en la
 * documentación: una advertencia depende de que alguien la lea.
 */
export function operacionRealHabilitada(): boolean {
  return leerEnv("OPERACION_REAL_HABILITADA")?.toLowerCase() === "true";
}
