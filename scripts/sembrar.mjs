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
 * Los valores salen de `.env` (sección DATOS DE PRUEBA), no de este archivo:
 * antes estaban hardcodeados acá y duplicados en cada verificador. Los defaults
 * se conservan para que el script siga corriendo sin configurar nada.
 *
 * Uso:  node --env-file=.env scripts/sembrar.mjs
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

const entero = (nombre, pordefecto) => {
  const v = Number(process.env[nombre]);
  return Number.isInteger(v) && v > 0 ? v : pordefecto;
};

const NOMBRE_FIXTURE =
  process.env.FIXTURE_NOMBRE_ESTACIONAMIENTO ?? "Estacionamiento de prueba (fixture)";
const EMAIL_OPERADOR = process.env.EMAIL_OPERADOR ?? "operador@fixture.invalid";
const EMAIL_DUENO = process.env.EMAIL_DUENO ?? "duena@fixture.invalid";
const CAPACIDAD_TOTAL = entero("FIXTURE_CAPACIDAD_TOTAL", 20);
const ZONA_HORARIA = process.env.FIXTURE_ZONA_HORARIA ?? "America/Santiago";
const VALOR_HORA = entero("FIXTURE_VALOR_HORA", 1000);
const FRACCION_MINUTOS = entero("FIXTURE_FRACCION_MINUTOS", 15);
const MONTO_MINIMO = entero("FIXTURE_MONTO_MINIMO", 500);
const VIGENTE_DESDE = new Date(process.env.FIXTURE_VIGENTE_DESDE ?? "2026-01-01T00:00:00.000Z");

// `spec.md` §11 exige que los datos de prueba se vean como datos de prueba. Al
// mover los valores a `.env` se abrió la posibilidad de sembrar un email que
// parezca real, así que la regla pasa a ser un chequeo en vez de una convención.
// `.invalid` está reservado por RFC 2606 y nunca resuelve.
for (const email of [EMAIL_OPERADOR, EMAIL_DUENO]) {
  if (!email.endsWith(".invalid")) {
    console.error(
      `FAIL · ${email} no termina en .invalid. Los fixtures deben verse como fixtures ` +
        `(spec.md §11). Corregí EMAIL_OPERADOR / EMAIL_DUENO en .env.`,
    );
    process.exit(1);
  }
}

if (!Number.isFinite(VIGENTE_DESDE.getTime())) {
  console.error("FAIL · FIXTURE_VIGENTE_DESDE no es una fecha ISO válida.");
  process.exit(1);
}

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
        capacidadTotal: CAPACIDAD_TOTAL,
        zonaHoraria: ZONA_HORARIA,
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
        valorHora: VALOR_HORA,
        fraccionMinutos: FRACCION_MINUTOS,
        montoMinimo: MONTO_MINIMO,
        vigenteDesde: VIGENTE_DESDE,
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
