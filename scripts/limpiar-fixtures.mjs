/**
 * Borra las sesiones de prueba.
 *
 * Los fixtures usan patentes con prefijo `FIXT`. Ninguna patente real empieza
 * así, y el borrado se acota a ese prefijo: nunca toca datos de operación.
 *
 * Uso:  node scripts/limpiar-fixtures.mjs
 */

import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("FAIL · falta DATABASE_URL.");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

try {
  const borradas = await sql`
    DELETE FROM sesion_vehiculo WHERE patente LIKE 'FIXT%' RETURNING id
  `;
  console.log(`sesiones de prueba borradas: ${borradas.length}`);

  const [{ n }] = await sql`SELECT count(*)::int AS n FROM sesion_vehiculo`;
  console.log(`sesiones restantes en la base: ${n}`);
} finally {
  await sql.end();
}
