/**
 * Contexto de operación del servidor.
 *
 * La v1 es de un solo estacionamiento (spec.md §8): no hay multitenancy ni
 * selector de sucursal. Estas funciones resuelven ese único contexto.
 *
 * En M2 el operador se resuelve como el único usuario con rol `operador` del
 * estacionamiento. La auth mínima de dos roles llega en M3; hasta entonces esto
 * NO es autenticación y no se declara como tal.
 */

import { and, desc, eq, lte } from "drizzle-orm";

import { db, estacionamiento, tarifa, usuario } from "@/db";

export async function obtenerEstacionamiento() {
  const [fila] = await db.select().from(estacionamiento).limit(1);
  if (!fila) {
    throw new Error(
      "No hay estacionamiento configurado. Corré `npm run sembrar` para cargar los fixtures.",
    );
  }
  return fila;
}

export async function obtenerOperador(estacionamientoId: string) {
  const [fila] = await db
    .select()
    .from(usuario)
    .where(and(eq(usuario.estacionamientoId, estacionamientoId), eq(usuario.rol, "operador")))
    .limit(1);

  if (!fila) {
    throw new Error("No hay usuario con rol operador. Corré `npm run sembrar`.");
  }
  return fila;
}

/**
 * Tarifa vigente a una fecha dada: la más reciente cuyo `vigente_desde` ya pasó.
 * Guardar el histórico en vez de pisarlo permite recalcular una salida vieja con
 * la tarifa que regía entonces.
 */
export async function obtenerTarifaVigente(estacionamientoId: string, momento: Date) {
  const [fila] = await db
    .select()
    .from(tarifa)
    .where(
      and(eq(tarifa.estacionamientoId, estacionamientoId), lte(tarifa.vigenteDesde, momento)),
    )
    .orderBy(desc(tarifa.vigenteDesde))
    .limit(1);

  if (!fila) {
    throw new Error("No hay tarifa vigente para este estacionamiento.");
  }
  return fila;
}
