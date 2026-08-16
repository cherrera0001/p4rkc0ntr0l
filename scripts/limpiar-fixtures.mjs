/**
 * Borra las sesiones de prueba.
 *
 * Los fixtures usan patentes con prefijo `FIXT`. Ninguna patente real empieza
 * así, y el borrado se acota a ese prefijo: nunca toca datos de operación.
 *
 * **El banco de medición de H1 (`FIXTB…`) queda excluido por defecto.** Ver
 * `PREFIJO_BANCO` en `scripts/lib/fixtures.mjs` y el fundamento junto al `WHERE`
 * de más abajo.
 *
 * Uso:  node scripts/limpiar-fixtures.mjs            (respeta el banco)
 *       node scripts/limpiar-fixtures.mjs --banco    (borra TAMBIÉN el banco)
 *       npm run limpiar:fixtures -- --banco
 */

import postgres from "postgres";
import { PREFIJO_BANCO } from "./lib/fixtures.mjs";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("FAIL · falta DATABASE_URL.");
  process.exit(1);
}

// Vaciar el banco tiene que ser un acto deliberado y no un efecto secundario.
//
// Sin esta puerta el banco sería una trampa: una sesión mal tomada —alguien
// probando a mano, un tecleo interrumpido— quedaría en la muestra para siempre y
// no habría forma de sacarla sin escribir SQL a mano contra la base. Una muestra
// que no se puede descartar no es una muestra: es un lastre.
//
// Que sea un flag explícito, y no el comportamiento por defecto, es lo que hace
// que borrar la evidencia de H1 no pueda pasar por accidente.
const incluirBanco = process.argv.includes("--banco");

const sql = postgres(url, { max: 1 });

try {
  // `AND NOT (patente LIKE 'FIXTB%' AND estado = 'cerrada')`, salvo que se pida
  // lo contrario con `--banco`. Solo el banco **cerrado** se conserva.
  //
  // **El fundamento va acá, junto al WHERE**: el proyecto entero existe para
  // probar o refutar H1, y H1 no tenía un solo dato porque esta consulta borraba
  // la evidencia en cada corrida. El banco es el espacio donde una muestra puede
  // acumularse. Sin la exclusión, medir H1 vuelve a ser imposible por
  // construcción — no por falta de ganas.
  const borradas = incluirBanco
    ? await sql`
        DELETE FROM sesion_vehiculo WHERE patente LIKE 'FIXT%' RETURNING id
        -- BORRA-BANCO-A-PROPOSITO: única rama del repo autorizada a vaciar el
        -- banco, y solo con el flag --banco. El control negativo de
        -- verificar-h1.mjs reconoce esta marca; cualquier otro borrado ancho sin
        -- la guardia lo hace fallar.
      `
    : await sql`
        DELETE FROM sesion_vehiculo
        WHERE patente LIKE 'FIXT%'
          AND NOT (patente LIKE ${PREFIJO_BANCO + "%"} AND estado = 'cerrada')
        RETURNING id
      `;

  console.log(`sesiones de prueba borradas: ${borradas.length}`);

  const [{ banco }] = await sql`
    SELECT count(*)::int AS banco
    FROM sesion_vehiculo WHERE patente LIKE ${PREFIJO_BANCO + "%"}
  `;

  if (incluirBanco) {
    console.log(`banco de H1: BORRADO TAMBIÉN (--banco). Quedan ${banco} sesión/es.`);
  } else {
    console.log(`banco de H1 conservado: ${banco} sesión/es (usá --banco para borrarlo).`);
  }

  const [{ n }] = await sql`SELECT count(*)::int AS n FROM sesion_vehiculo`;
  console.log(`sesiones restantes en la base: ${n}`);
} finally {
  await sql.end();
}
