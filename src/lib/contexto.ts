/**
 * Contexto de operación del servidor.
 *
 * **Ya no resuelve "el" estacionamiento: resuelve EL DEL USUARIO** (hallazgos
 * M-1 y M-2). Antes esto era `select().from(estacionamiento).limit(1)` — la
 * primera fila de la tabla, sin mirar quién preguntaba. Con un solo
 * estacionamiento sembrado el resultado coincidía por casualidad, y esa
 * casualidad es toda la separación que había.
 *
 * El agravante que hacía urgente cambiarlo no es de lectura sino de escritura:
 * lo que devuelve `GET /api/sesiones` va a `reconciliarActivas`, que **persiste**
 * esas patentes en el IndexedDB del dispositivo. Con un segundo estacionamiento
 * en la tabla, el operador de B se llevaba las patentes de A guardadas en su
 * teléfono.
 *
 * La v1 sigue siendo de un solo estacionamiento (spec.md §8): esto no es
 * multitenancy ni la prepara. Es dejar de depender del orden de las filas para
 * algo que el usuario autenticado ya sabe.
 */

import { and, desc, eq, lte } from "drizzle-orm";

import { conBase, db, estacionamiento, tarifa } from "@/db";
import { ErrorConfiguracion } from "./errores.ts";

/**
 * El estacionamiento del usuario autenticado.
 *
 * Recibe el id, no lo adivina. Quien llama lo saca de la sesión, que a su vez lo
 * releyó de la tabla `usuario` (ver `auth.ts`), así que no viene del cliente.
 */
export async function obtenerEstacionamiento(estacionamientoId: string) {
  const [fila] = await conBase(() =>
    db
      .select()
      .from(estacionamiento)
      .where(eq(estacionamiento.id, estacionamientoId))
      .limit(1),
  );

  if (!fila) {
    // Configuración y no fallo de servicio: el usuario existe pero apunta a un
    // estacionamiento que no está. Reintentar no lo arregla (INT-20).
    throw new ErrorConfiguracion(
      "El usuario autenticado apunta a un estacionamiento que no existe. " +
        "Corre `npm run sembrar` o revisa los datos.",
    );
  }
  return fila;
}

/**
 * Tarifa vigente a una fecha dada: la más reciente cuyo `vigente_desde` ya pasó.
 * Guardar el histórico en vez de pisarlo permite recalcular una salida vieja con
 * la tarifa que regía entonces.
 */
export async function obtenerTarifaVigente(estacionamientoId: string, momento: Date) {
  const [fila] = await conBase(() =>
    db
      .select()
      .from(tarifa)
      .where(
        and(eq(tarifa.estacionamientoId, estacionamientoId), lte(tarifa.vigenteDesde, momento)),
      )
      .orderBy(desc(tarifa.vigenteDesde))
      .limit(1),
  );

  if (!fila) {
    throw new ErrorConfiguracion(
      "No hay tarifa vigente para este estacionamiento. Carga una antes de operar.",
    );
  }
  return fila;
}
