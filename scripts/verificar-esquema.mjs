/**
 * Verificación de AC-DATA-1 contra la base real (spec.md §9).
 *
 * Lista tablas, columnas y enums efectivamente creados, para contrastarlos con
 * el modelo de datos de spec.md §4. No inserta ni modifica nada: es solo
 * lectura del catálogo, no toca datos personales.
 *
 * Uso:  node scripts/verificar-esquema.mjs
 */

import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL en el entorno.");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

try {
  const tablas = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `;

  console.log("=== TABLAS ===");
  for (const { table_name } of tablas) {
    const columnas = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${table_name}
      ORDER BY ordinal_position
    `;
    console.log(`\n${table_name}  (${columnas.length} columnas)`);
    for (const c of columnas) {
      const nulo = c.is_nullable === "YES" ? "NULL" : "NOT NULL";
      console.log(`  ${c.column_name.padEnd(20)} ${c.data_type.padEnd(28)} ${nulo}`);
    }
  }

  const enums = await sql`
    SELECT t.typname, string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) AS valores
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    GROUP BY t.typname
    ORDER BY t.typname
  `;

  console.log("\n=== ENUMS ===");
  for (const e of enums) {
    console.log(`  ${e.typname.padEnd(16)} = ${e.valores}`);
  }

  const fks = await sql`
    SELECT tc.table_name, kcu.column_name, ccu.table_name AS referencia
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
    ORDER BY tc.table_name, kcu.column_name
  `;

  console.log("\n=== CLAVES FORÁNEAS ===");
  for (const f of fks) {
    console.log(`  ${f.table_name}.${f.column_name} -> ${f.referencia}`);
  }

  console.log(`\nTotal: ${tablas.length} tablas, ${enums.length} enums, ${fks.length} FKs`);
} finally {
  await sql.end();
}
