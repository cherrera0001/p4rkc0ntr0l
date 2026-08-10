/**
 * Semilla de fixtures para M2/M3.
 *
 * Todo lo que siembra se ve como fixture a propósito (spec.md §11): nombres
 * genéricos, dominios `.invalid` (reservado por RFC 2606, nunca resoluble) y
 * montos redondos. Nada que pueda confundirse con datos de operación reales.
 *
 * No siembra ninguna patente: las sesiones las crea el operador.
 *
 * Idempotente: se puede correr las veces que haga falta.
 *
 * Uso:  npm run sembrar
 */

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../src/db/schema.ts";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("FAIL · falta DATABASE_URL.");
  process.exit(1);
}

const cliente = postgres(url, { max: 1 });
const db = drizzle(cliente, { schema });

const NOMBRE_FIXTURE = "Estacionamiento de prueba (fixture)";
const EMAIL_OPERADOR = "operador@fixture.invalid";
const EMAIL_DUENO = "duena@fixture.invalid";

try {
  let [est] = await db
    .select()
    .from(schema.estacionamiento)
    .where(eq(schema.estacionamiento.nombre, NOMBRE_FIXTURE));

  if (!est) {
    [est] = await db
      .insert(schema.estacionamiento)
      .values({
        nombre: NOMBRE_FIXTURE,
        capacidadTotal: 20,
        zonaHoraria: "America/Santiago",
      })
      .returning();
    console.log(`creado estacionamiento ${est.id}`);
  } else {
    console.log(`estacionamiento ya existía ${est.id}`);
  }

  const tarifas = await db
    .select()
    .from(schema.tarifa)
    .where(eq(schema.tarifa.estacionamientoId, est.id));

  if (tarifas.length === 0) {
    // Valores redondos, deliberadamente de fixture. La tarifa real la carga el
    // dueño; acá no se decide ningún valor de negocio (spec.md §11).
    const [t] = await db
      .insert(schema.tarifa)
      .values({
        estacionamientoId: est.id,
        valorHora: 1000,
        fraccionMinutos: 15,
        montoMinimo: 500,
        vigenteDesde: new Date("2026-01-01T00:00:00.000Z"),
      })
      .returning();
    console.log(`creada tarifa ${t.id}`);
  } else {
    console.log(`tarifa ya existía ${tarifas[0].id}`);
  }

  for (const [email, rol] of [
    [EMAIL_OPERADOR, "operador"],
    [EMAIL_DUENO, "dueño"],
  ]) {
    const [existente] = await db
      .select()
      .from(schema.usuario)
      .where(eq(schema.usuario.email, email));

    if (!existente) {
      const [u] = await db
        .insert(schema.usuario)
        .values({ email, rol, estacionamientoId: est.id })
        .returning();
      console.log(`creado usuario ${rol}: ${u.email}`);
    } else {
      console.log(`usuario ya existía ${rol}: ${existente.email}`);
    }
  }

  console.log("\nPASS · semilla de fixtures lista");
} finally {
  await cliente.end();
}
