/**
 * Crea la BASE DE DESCARTE que ADR-006 §2.3 exige para medir M-11.
 *
 * No toca la base del producto. Es una base aparte en el mismo servidor, y se
 * borra con `DROP DATABASE` cuando la medición termina.
 */
import postgres from "postgres";

const url = new URL(process.env.DATABASE_URL);
const NOMBRE = "directus_descarte";

// Conexión a la base actual sólo para emitir el CREATE DATABASE.
const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: "require" });
try {
  const existe = await sql`SELECT 1 FROM pg_database WHERE datname = ${NOMBRE}`;
  if (existe.length === 0) {
    await sql.unsafe(`CREATE DATABASE ${NOMBRE}`);
    console.log(`creada: ${NOMBRE}`);
  } else {
    console.log(`ya existía: ${NOMBRE}`);
  }
} finally {
  await sql.end();
}

// Ahora, dentro de la de descarte, el esquema propio que la prueba evalúa.
url.pathname = `/${NOMBRE}`;
const sql2 = postgres(url.toString(), { max: 1, ssl: "require" });
try {
  await sql2.unsafe(`CREATE SCHEMA IF NOT EXISTS consola`);
  const esquemas = await sql2`
    SELECT nspname FROM pg_namespace
    WHERE nspname NOT LIKE 'pg_%' AND nspname <> 'information_schema'
    ORDER BY nspname`;
  console.log("esquemas en la de descarte:", esquemas.map((e) => e.nspname).join(", "));

  const tablas = await sql2`
    SELECT table_schema, table_name FROM information_schema.tables
    WHERE table_type = 'BASE TABLE'
      AND table_schema NOT IN ('pg_catalog', 'information_schema')`;
  console.log(`tablas antes de Directus: ${tablas.length}`);
} finally {
  await sql2.end();
}

// La URL que usará Directus, sin imprimir la credencial.
console.log(`\nDirectus apuntará a la base "${NOMBRE}", esquema "consola".`);
