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
// Las identidades de fixture viven en un solo lugar: si `sembrar` sembrara una
// y los verificadores intentaran entrar con otra, fallarían cinco de ellos.
import { EMAIL_DUENO, EMAIL_OPERADOR, EMAIL_PLATAFORMA } from "./lib/fixtures.mjs";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("FAIL · falta DATABASE_URL.");
  process.exit(1);
}

const cliente = postgres(url, { max: 1 });
const db = drizzle(cliente, { schema });

/**
 * Igual que `leerEnv()` de `src/lib/env.ts`: una variable **presente pero
 * vacía** es una variable ausente, no un valor.
 *
 * Es el mismo defecto que INT-12 costó dos ciclos: `??` solo dispara ante
 * nullish, así que `FIXTURE_ZONA_HORARIA=` en `.env` daba `""` —una zona IANA
 * inválida que se propaga al corte del día del panel del dueño—, y
 * `FIXTURE_NOMBRE_ESTACIONAMIENTO=` sembraba un estacionamiento sin nombre y
 * rompía la idempotencia, porque la búsqueda por `eq(nombre, "")` ya no
 * encuentra la fila anterior. `.env.example` distribuye estas claves, así que
 * el caso no es hipotético: dejarlas en blanco es lo primero que alguien hace.
 */
const texto = (nombre, pordefecto) => {
  const v = process.env[nombre];
  return typeof v === "string" && v.trim() !== "" ? v.trim() : pordefecto;
};

/**
 * Entero de configuración. **Falla en vez de sustituir en silencio.**
 *
 * Antes devolvía el default ante cualquier valor no válido, así que un
 * `FIXTURE_VALOR_HORA=100O` (con letra O) sembraba 1000 y
 * `verificar-salida.mjs` seguía dando su `$1500` esperado: la configuración que
 * el operador escribió nunca se aplicaba y nada lo decía. Se acepta `0` cuando
 * tiene sentido —un `monto_minimo` de cero es una tarifa legítima— y se rechaza
 * lo que no es un entero.
 */
const entero = (nombre, pordefecto, { minimo = 1 } = {}) => {
  const crudo = process.env[nombre];
  if (typeof crudo !== "string" || crudo.trim() === "") return pordefecto;
  const v = Number(crudo.trim());
  if (!Number.isInteger(v) || v < minimo) {
    console.error(
      `FAIL · ${nombre}=${crudo} no es un entero >= ${minimo}. ` +
        "Corregilo en .env o quitá la variable para usar el valor por defecto.",
    );
    process.exit(1);
  }
  return v;
};

const NOMBRE_FIXTURE = texto(
  "FIXTURE_NOMBRE_ESTACIONAMIENTO",
  "Estacionamiento de prueba (fixture)",
);
const CAPACIDAD_TOTAL = entero("FIXTURE_CAPACIDAD_TOTAL", 20);
const ZONA_HORARIA = texto("FIXTURE_ZONA_HORARIA", "America/Santiago");
const VALOR_HORA = entero("FIXTURE_VALOR_HORA", 1000);
const FRACCION_MINUTOS = entero("FIXTURE_FRACCION_MINUTOS", 15);
// Un mínimo de cero es una tarifa válida: se cobra solo lo que corresponde por
// tiempo. Por eso este acepta 0 y los otros no.
const MONTO_MINIMO = entero("FIXTURE_MONTO_MINIMO", 500, { minimo: 0 });
const VIGENTE_DESDE = new Date(texto("FIXTURE_VIGENTE_DESDE", "2026-01-01T00:00:00.000Z"));

// La zona horaria alimenta el corte del día del panel del dueño. Una zona
// inválida no rompe nada visible: corre el día unas horas y nadie se entera.
try {
  new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_HORARIA });
} catch {
  console.error(
    `FAIL · FIXTURE_ZONA_HORARIA=${ZONA_HORARIA} no es una zona IANA válida ` +
      "(ej. America/Santiago). El corte del día del panel depende de esto.",
  );
  process.exit(1);
}

// `spec.md` §11 exige que los datos de prueba se vean como datos de prueba. Al
// mover los valores a `.env` se abrió la posibilidad de sembrar un email que
// parezca real, así que la regla pasa a ser un chequeo en vez de una convención.
// `.invalid` está reservado por RFC 2606 y nunca resuelve.
for (const email of [EMAIL_OPERADOR, EMAIL_DUENO, EMAIL_PLATAFORMA]) {
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

  // **El usuario de plataforma — el bootstrap que faltaba (hallazgo FE-3).**
  //
  // Sin esto, un deploy limpio quedaba sin nadie que pudiera dar de alta el
  // primer cliente: la pantalla `/plataforma` es inalcanzable sin una sesión de
  // ese rol, y crearlo a mano con un INSERT es exactamente el camino que ADR-005
  // vino a eliminar. Va SIN estacionamiento: la invariante `pertenencia_por_rol`
  // de la base exige que el rol `plataforma` tenga `estacionamiento_id` nulo.
  const [plataforma] = await db
    .select()
    .from(schema.usuario)
    .where(eq(schema.usuario.email, EMAIL_PLATAFORMA));
  if (!plataforma) {
    const [u] = await db
      .insert(schema.usuario)
      .values({ email: EMAIL_PLATAFORMA, rol: "plataforma", estacionamientoId: null })
      .returning();
    console.log(`creado usuario plataforma: ${u.email}`);
  } else {
    console.log(`usuario ya existía plataforma: ${plataforma.email}`);
  }

  console.log("\nPASS · semilla de fixtures lista");
} finally {
  await cliente.end();
}
