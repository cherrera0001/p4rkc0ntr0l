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
 * Identidades de fixture, en un solo lugar.
 *
 * Estaban hardcodeadas en cada verificador. Al hacerlas configurables por `.env`
 * quedó una extracción a medias: `sembrar.mjs` sembraba la identidad nueva y
 * cinco verificadores seguían intentando entrar con la vieja. Media extracción
 * es peor que ninguna — la de antes fallaba igual en todos lados; esta fallaba
 * solo en algunos, que es más difícil de diagnosticar.
 *
 * Una variable presente pero vacía es una variable ausente, igual que en
 * `leerEnv()` de `src/lib/env.ts`.
 */
const leer = (nombre, pordefecto) => {
  const v = process.env[nombre];
  return typeof v === "string" && v.trim() !== "" ? v.trim() : pordefecto;
};

export const EMAIL_OPERADOR = leer("EMAIL_OPERADOR", "operador@fixture.invalid");
export const EMAIL_DUENO = leer("EMAIL_DUENO", "duena@fixture.invalid");

/**
 * Sub-prefijo reservado del **banco de medición de H1** (FASE D).
 *
 * ## Por qué el banco necesita sobrevivir a la limpieza
 *
 * El proyecto entero existe para probar o refutar H1, y H1 nunca se midió. La
 * causa mecánica es esta función: los verificadores de navegador la llaman **al
 * iniciar**, así que cada tanda borra las filas de la anterior. **Ninguna
 * acumula**, y sin acumulación no hay muestra que medir.
 *
 * El banco es el espacio que la limpieza no barre — **pero solo sus filas
 * cerradas**, que son las únicas que valen como muestra. Ver más abajo.
 *
 * ## Por qué un sub-prefijo, y no una columna
 *
 * `FIXTB…` **sigue siendo fixture para la barrera de datos personales**:
 * `esPatenteFixture()` (`src/lib/fixtures.ts:15`) compara contra `FIXT`, así que
 * la app acepta estas patentes y **`AC-PDP-1` no se toca**. Una columna
 * `es_banco` habría roto `AC-DATA-1`, que compara los 27 campos de `spec.md` §4
 * *ni de más ni de menos*: exigiría enmendar la fuente de verdad más una
 * migración, contra el principio de minimización. Costo de esta opción: **cero
 * migraciones, cero campos**.
 *
 * ## La invariante que lo mantiene libre, y que NO es "nadie lo usó todavía"
 *
 * Los verificadores usan `FIXT` + **dos dígitos**; el banco usa `FIXT` + **la
 * letra `B`**. Son dos espacios de nombres disjuntos por construcción.
 *
 * **La invariante no se sostiene enumerando patentes, y por eso acá no hay
 * lista.** Una enumeración escrita a mano queda vieja en cuanto entra un
 * verificador nuevo — la primera versión de este párrafo listaba nueve rangos y
 * ya se le habían escapado cuatro patentes. Lo que la sostiene es
 * `verificar:h1`, que **falla** si algún verificador empieza a usar una
 * `FIXTB…`. Es la misma regla que el gate de alcance aprendió: por exclusión,
 * no por enumeración.
 *
 * ## Solo sobreviven las CERRADAS, y eso no es un detalle
 *
 * La exclusión es `NOT (patente LIKE 'FIXTB%' AND estado = 'cerrada')`: una fila
 * de banco **activa se borra como cualquier otro fixture**.
 *
 * Medido el 2026-08-16, y por eso el predicado dice `AND estado = 'cerrada'`:
 * con una sola fila de banco activa presente, `verificar:op1` cae a **8/11**
 * —*«el ingreso persiste en IndexedDB sin red · 2 registro(s)»*— que es
 * exactamente el defecto descrito en el encabezado de este archivo y la razón por
 * la que `limpiarFixtures()` existe. Y `verificar:meas2` clickea el primer botón
 * de la lista de activas sin mirar la patente
 * (`scripts/verificar-meas2.mjs:170`), así que **cerraba filas de banco** y las
 * metía en el universo de H1 con un tecleo que nadie tecleó.
 *
 * El universo de H1 son las sesiones **cerradas** (`docs/SPEC-D-medicion-de-H1.md`
 * §3.1). Una de banco a medio terminar no es evidencia de nada: no hay razón para
 * protegerla, y protegerla rompía dos verificadores.
 *
 * ## Lo que este prefijo NO puede hacer, y por eso no se afirma
 *
 * **No prueba la procedencia.** Un `INSERT` con duraciones elegidas a mano entra
 * al banco igual que una persona tecleando, y ninguna columna arreglaría eso:
 * cualquiera con `DATABASE_URL` escribe lo que quiera. El banco es una
 * **convención metodológica**, y `verificar:h1` lo declara en su salida en vez de
 * fingir una garantía.
 */
export const PREFIJO_BANCO = "FIXTB";

/**
 * Borra las sesiones de prueba antes de empezar. Acotado al prefijo `FIXT`:
 * nunca toca datos de operación. **Y excluye el banco de medición de H1** — ver
 * `PREFIJO_BANCO` arriba y el fundamento junto al `WHERE`.
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
    // `AND NOT (patente LIKE 'FIXTB%' AND estado = 'cerrada')` — el banco de
    // medición de H1 no se barre, y **solo el cerrado**: una fila de banco activa
    // es un tecleo a medio terminar, no evidencia, y dejarla viva rompe `op1`.
    //
    // **El fundamento va acá, junto al WHERE, y no en el commit**: sin él, el
    // próximo lector lo va a leer como un filtro conveniente y lo va a sacar.
    //
    // El propósito del proyecto es probar o refutar H1, y H1 no tiene un solo
    // dato porque esta misma consulta borra la evidencia en cada corrida. El
    // banco es el espacio reservado para que una muestra pueda acumularse; sin
    // esta exclusión, la métrica de H1 vuelve a ser estructuralmente imposible.
    //
    // No es una excepción a la limpieza: es la razón por la que la limpieza
    // puede seguir existiendo sin impedir la medición. Para vaciar el banco a
    // propósito está `npm run limpiar:fixtures -- --banco`, que es explícito y
    // deliberado, como tiene que ser borrar una muestra.
    const borradas = await sql`
      DELETE FROM sesion_vehiculo
      WHERE patente LIKE 'FIXT%'
        AND NOT (patente LIKE ${PREFIJO_BANCO + "%"} AND estado = 'cerrada')
      RETURNING id
    `;
    if (!silencioso && borradas.length > 0) {
      console.log(`      (limpieza previa: ${borradas.length} sesión/es de prueba de una corrida anterior)`);
    }
    return borradas.length;
  } finally {
    await sql.end();
  }
}
