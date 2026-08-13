/**
 * Verificación de las invariantes de datos — hallazgos INT-15 y INT-16.
 *
 * **Solo lectura.** No escribe, no borra, no migra. Sirve para dos cosas:
 *
 *  1. Antes de aplicar la migración: si alguna comprobación devuelve filas, el
 *     `CREATE UNIQUE INDEX` o el `ADD CONSTRAINT` fallarían a mitad. Mejor
 *     saberlo antes que dejar la migración aplicada por la mitad.
 *  2. Después: como verificador permanente del hallazgo. Con las restricciones
 *     puestas, estas consultas no pueden volver a devolver nada — y si devuelven
 *     algo, es que las restricciones no están.
 *
 * Uso:  node --env-file=.env scripts/verificar-invariantes.mjs
 * Sale con código 0 si todo PASA, 1 si algo FALLA.
 */

import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("FAIL · falta DATABASE_URL. Probá con: node --env-file=.env " + import.meta.filename);
  process.exit(1);
}

const sql = postgres(url, { max: 1, connect_timeout: 10 });

const resultados = [];
function comprobar(nombre, filas) {
  const ok = filas.length === 0;
  resultados.push({ nombre, ok });
  console.log(`${ok ? "PASS" : "FAIL"} · ${nombre}${ok ? "" : ` · ${filas.length} fila(s)`}`);
  if (!ok) console.log("       " + JSON.stringify(filas.slice(0, 5)));
}

try {
  comprobar(
    "INT-15 · ninguna patente con dos sesiones activas a la vez",
    await sql`
      SELECT estacionamiento_id, patente, count(*)::int AS n
      FROM sesion_vehiculo
      WHERE estado = 'activa'
      GROUP BY estacionamiento_id, patente
      HAVING count(*) > 1`,
  );

  comprobar(
    "INT-16 · tecleo_fin_at >= tecleo_inicio_at",
    await sql`SELECT id FROM sesion_vehiculo WHERE tecleo_fin_at < tecleo_inicio_at`,
  );

  comprobar(
    "INT-16 · salida_at >= entrada_at",
    await sql`
      SELECT id, entrada_at, salida_at FROM sesion_vehiculo
      WHERE salida_at IS NOT NULL AND salida_at < entrada_at`,
  );

  comprobar(
    "INT-16 · monto_calculado >= 0",
    await sql`SELECT id, monto_calculado FROM sesion_vehiculo WHERE monto_calculado < 0`,
  );

  comprobar(
    "INT-16 · capacidad_total > 0",
    await sql`SELECT id, capacidad_total FROM estacionamiento WHERE capacidad_total <= 0`,
  );

  comprobar(
    "INT-16 · tarifa dentro de rango",
    await sql`
      SELECT id FROM tarifa
      WHERE valor_hora < 0 OR fraccion_minutos <= 0 OR monto_minimo < 0`,
  );

  // Informativo, no bloqueante: una entrada en el futuro es la fila que dejaba
  // la sesión imposible de cerrar (INT-14). La corrección la vuelve cerrable,
  // pero conviene ver si quedó alguna de antes.
  const futuras = await sql`
    SELECT id, entrada_at FROM sesion_vehiculo WHERE entrada_at > now()`;
  console.log(
    `NOTA · INT-14 · sesiones con entrada_at en el futuro: ${futuras.length}` +
      (futuras.length ? " (cerrables igual desde la corrección)" : ""),
  );

  // Las restricciones tienen que EXISTIR, no solo estar satisfechas por
  // casualidad: sin esto, una base vacía daría PASS con el esquema viejo.
  const restricciones = await sql`
    SELECT conname FROM pg_constraint
    WHERE conname IN (
      'tecleo_coherente', 'salida_posterior_a_entrada', 'monto_no_negativo',
      'capacidad_positiva', 'valor_hora_no_negativo', 'fraccion_positiva',
      'monto_minimo_no_negativo'
    )`;
  const indices = await sql`
    SELECT indexname FROM pg_indexes
    WHERE indexname IN (
      'sesion_vehiculo_activa_unica', 'sesion_vehiculo_por_estado',
      'sesion_vehiculo_por_salida'
    )`;

  comprobar(
    "los 7 CHECK están declarados en la base",
    restricciones.length === 7 ? [] : [{ encontrados: restricciones.map((r) => r.conname) }],
  );
  comprobar(
    "los 3 índices están declarados en la base",
    indices.length === 3 ? [] : [{ encontrados: indices.map((i) => i.indexname) }],
  );
} finally {
  await sql.end();
}

const fallidos = resultados.filter((r) => !r.ok);
console.log(`\n${resultados.length - fallidos.length}/${resultados.length} comprobaciones PASS`);
if (fallidos.length) {
  console.log("FALLARON: " + fallidos.map((f) => f.nombre).join(", "));
  process.exit(1);
}
console.log("INT-15 / INT-16 / INT-17: PASS");
