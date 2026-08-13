/**
 * Limpieza de fixtures como paso del propio verificador, no como disciplina.
 *
 * Por qué existe: con el espejo local que introdujo M-4, las sesiones activas
 * que quedaron de una corrida anterior se copian al dispositivo y hacen fallar
 * aserciones que cuentan registros. `verificar-op1` falló así el 2026-08-10 y
 * `verificar-m4` volvió a fallar así el 2026-08-12 (28/29) — las dos veces por
 * el estado previo, no por el código.
 *
 * Estaba anotado en `LEARNINGS.md` como "queda sin mecanizar" y en `STATE.md`
 * como una instrucción para el humano. Una precondición que depende de que
 * alguien se acuerde produce FAIL falsos, y un FAIL falso enseña a desconfiar
 * del verificador — que es peor que no tenerlo.
 *
 * Solo lo usan los verificadores de navegador. `verificar-salida.mjs` deja a
 * propósito una sesión cerrada para que `verificar-meas1.mjs` tenga qué contar;
 * por eso la limpieza va al INICIO de cada script y nunca al final.
 */

import postgres from "postgres";

/**
 * Borra las sesiones de prueba antes de empezar. Acotado al prefijo `FIXT`:
 * nunca toca datos de operación.
 *
 * @param {{ silencioso?: boolean }} [opciones]
 * @returns {Promise<number>} sesiones borradas
 */
export async function limpiarFixtures({ silencioso = false } = {}) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("FAIL · falta DATABASE_URL para limpiar los fixtures previos.");
    process.exit(1);
  }

  const sql = postgres(url, { max: 1 });
  try {
    const borradas = await sql`
      DELETE FROM sesion_vehiculo WHERE patente LIKE 'FIXT%' RETURNING id
    `;
    if (!silencioso && borradas.length > 0) {
      console.log(`      (limpieza previa: ${borradas.length} sesión/es de prueba de una corrida anterior)`);
    }
    return borradas.length;
  } finally {
    await sql.end();
  }
}
