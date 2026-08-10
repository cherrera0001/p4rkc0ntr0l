/**
 * Verificación de AC-MEAS-1 (spec.md §6, §9).
 *
 * "Toda sesión cerrada tiene ambos timestamps de tecleo no nulos.
 *  Verificación: consulta que cuente sesiones cerradas con timestamps nulos → debe ser 0."
 *
 * La medición es parte del producto: sin `tecleo_inicio_at` y `tecleo_fin_at`
 * una sesión no aporta evidencia sobre H1.
 *
 * Uso:  node scripts/verificar-meas1.mjs
 */

import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("FAIL · falta DATABASE_URL.");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

try {
  const [{ nulos }] = await sql`
    SELECT count(*)::int AS nulos
    FROM sesion_vehiculo
    WHERE estado = 'cerrada'
      AND (tecleo_inicio_at IS NULL OR tecleo_fin_at IS NULL)
  `;

  const [{ cerradas }] = await sql`
    SELECT count(*)::int AS cerradas FROM sesion_vehiculo WHERE estado = 'cerrada'
  `;

  const [{ total }] = await sql`SELECT count(*)::int AS total FROM sesion_vehiculo`;

  console.log(`sesiones totales           : ${total}`);
  console.log(`sesiones cerradas          : ${cerradas}`);
  console.log(`cerradas con tecleo nulo   : ${nulos}`);

  // El esquema declara ambas columnas NOT NULL, así que la base misma impide el
  // caso. Se comprueba igual: un cambio futuro de esquema que las afloje tiene
  // que hacer fallar esto, no pasar desapercibido.
  const [{ obligatorias }] = await sql`
    SELECT count(*)::int AS obligatorias
    FROM information_schema.columns
    WHERE table_name = 'sesion_vehiculo'
      AND column_name IN ('tecleo_inicio_at', 'tecleo_fin_at')
      AND is_nullable = 'NO'
  `;
  console.log(`columnas de tecleo NOT NULL: ${obligatorias}/2`);

  if (nulos !== 0) {
    console.log("\nAC-MEAS-1: FAIL");
    process.exit(1);
  }
  if (obligatorias !== 2) {
    console.log("\nAC-MEAS-1: FAIL · el esquema dejó de exigir los timestamps");
    process.exit(1);
  }

  console.log("\nAC-MEAS-1: PASS");
} finally {
  await sql.end();
}
