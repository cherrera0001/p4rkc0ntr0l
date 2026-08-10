/**
 * Normalización y validación de patente — spec.md §5 y §7.
 *
 * La patente es DATO PERSONAL bajo la Ley 21.719. Es el único identificador de
 * vehículo del sistema, así que esta es la frontera de entrada que más importa:
 * todo lo que llegue del operador pasa por acá antes de tocar la base.
 *
 * Función pura, sin dependencias. Se usa igual en el cliente (validación
 * inmediata mientras el operador teclea) y en el servidor (validación real, la
 * que no se puede saltar). La del cliente es comodidad; la del servidor es la
 * que cuenta.
 */

/** Longitud máxima aceptada. Corta entradas absurdas antes de llegar a la base. */
const LARGO_MAXIMO = 8;
const LARGO_MINIMO = 4;

export type FormatoPatente = "antiguo" | "nuevo" | "otro";

/**
 * Deja la patente en forma canónica: mayúsculas, sin espacios, guiones ni
 * puntos. `bb.bb-12` y `BBBB12` deben ser la misma sesión, no dos.
 */
export function normalizarPatente(entrada: string): string {
  return entrada.normalize("NFKC").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Formato de la patente ya normalizada.
 *
 * - `antiguo`: 2 letras + 4 dígitos (AA1234)
 * - `nuevo`:   4 letras + 2 dígitos (BBBB12)
 * - `otro`:    cualquier otra combinación válida en largo
 *
 * `otro` no es un error: entran motos, vehículos extranjeros y placas
 * especiales. Rechazarlas frenaría al operador en la vía, que es exactamente lo
 * que H1 no puede permitirse.
 */
export function formatoPatente(patenteNormalizada: string): FormatoPatente {
  if (/^[A-Z]{2}\d{4}$/.test(patenteNormalizada)) return "antiguo";
  if (/^[A-Z]{4}\d{2}$/.test(patenteNormalizada)) return "nuevo";
  return "otro";
}

export type ResultadoValidacion =
  | { valida: true; patente: string; formato: FormatoPatente }
  | { valida: false; motivo: string };

/**
 * Valida y normaliza en un solo paso. Es la única puerta de entrada que debería
 * usarse desde una ruta de API o desde el formulario.
 */
export function validarPatente(entrada: unknown): ResultadoValidacion {
  if (typeof entrada !== "string") {
    return { valida: false, motivo: "La patente debe ser texto." };
  }

  const patente = normalizarPatente(entrada);

  if (patente.length === 0) {
    return { valida: false, motivo: "La patente no puede estar vacía." };
  }
  if (patente.length < LARGO_MINIMO) {
    return {
      valida: false,
      motivo: `La patente es demasiado corta (mínimo ${LARGO_MINIMO} caracteres).`,
    };
  }
  if (patente.length > LARGO_MAXIMO) {
    return {
      valida: false,
      motivo: `La patente es demasiado larga (máximo ${LARGO_MAXIMO} caracteres).`,
    };
  }
  if (!/\d/.test(patente)) {
    return { valida: false, motivo: "La patente debe contener al menos un dígito." };
  }

  return { valida: true, patente, formato: formatoPatente(patente) };
}
