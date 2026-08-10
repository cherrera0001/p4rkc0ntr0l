/**
 * Convención de datos de prueba — compartida entre cliente y servidor.
 *
 * Vive en su propio módulo, sin dependencias, precisamente para que el cliente
 * pueda importarla: la barrera de datos personales tiene que poder evaluarse
 * ANTES de escribir nada en el dispositivo, no solo en el servidor.
 *
 * Ver hallazgo A-3 en `docs/revision-seguridad-2026-08-09.md`.
 */

/** Prefijo que marca una patente como dato de prueba. */
export const PREFIJO_FIXTURE = "FIXT";

/** Espera la patente ya normalizada (mayúsculas, sin separadores). */
export function esPatenteFixture(patenteNormalizada: string): boolean {
  return patenteNormalizada.startsWith(PREFIJO_FIXTURE);
}
