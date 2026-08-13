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

  // Hasta el 2026-08-12 este script solo volcaba el esquema y salía con 0 pasara
  // lo que pasara: el "PASS" de AC-DATA-1 lo ponía un humano mirando el volcado.
  // Un criterio que depende de que alguien mire no es un criterio verificado.
  const esperado = {
    tablas: ["estacionamiento", "sesion_vehiculo", "tarifa", "usuario"],
    enums: ["estado_sesion", "estado_sync", "rol_usuario"],
    fks: 4,
  };

  const resultados = [];
  const comprobar = (nombre, ok, detalle = "") => {
    resultados.push({ nombre, ok });
    console.log(`${ok ? "PASS" : "FAIL"} · ${nombre}${detalle ? ` · ${detalle}` : ""}`);
  };

  console.log("");
  const nombresTablas = tablas.map((t) => t.table_name).sort();
  const nombresEnums = enums.map((e) => e.typname).sort();

  comprobar(
    "AC-DATA-1 · están las cuatro tablas de spec.md §4, y ninguna más",
    nombresTablas.join(",") === esperado.tablas.join(","),
    nombresTablas.join(", "),
  );
  comprobar(
    "AC-DATA-1 · están los tres enums de spec.md §4",
    nombresEnums.join(",") === esperado.enums.join(","),
    nombresEnums.join(", "),
  );
  comprobar("AC-DATA-1 · están las cuatro claves foráneas", fks.length === esperado.fks, `${fks.length} FKs`);

  // AC-MEAS-1 depende de que estas dos columnas no aflojen: si se vuelven
  // nullable, la medición de H1 pierde su piso sin que nada falle.
  const tecleo = await sql`
    SELECT column_name, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sesion_vehiculo'
      AND column_name IN ('tecleo_inicio_at', 'tecleo_fin_at')
  `;
  comprobar(
    "AC-DATA-1 · las columnas de tecleo siguen NOT NULL",
    tecleo.length === 2 && tecleo.every((c) => c.is_nullable === "NO"),
    tecleo.map((c) => `${c.column_name}=${c.is_nullable}`).join(", "),
  );

  const fallidos = resultados.filter((r) => !r.ok);
  console.log(`\n${resultados.length - fallidos.length}/${resultados.length} comprobaciones PASS`);
  if (fallidos.length) {
    console.log("FALLARON: " + fallidos.map((f) => f.nombre).join(", "));
    process.exitCode = 1;
  } else {
    console.log("AC-DATA-1: PASS");
  }
} finally {
  await sql.end();
}
