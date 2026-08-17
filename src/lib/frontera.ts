/**
 * Guardas de frontera de la API — AC-API-1 (`spec.md` §9).
 *
 * ## Por qué existe este módulo
 *
 * Un 5xx no es un error cosmético en este sistema: la cola local del operador lo
 * clasifica como **recuperable** (`src/lib/cola-local.ts:276-278`) y además
 * **corta el lote** (`src/lib/cola-local.ts:337-344`). Un solo registro con un
 * valor que la base nunca va a aceptar bloquea la sincronización **entera** del
 * turno, para siempre — y con ella la evidencia de H1, que es el producto.
 *
 * O sea: un valor que la frontera deja pasar y la base rechaza no produce un
 * error puntual. Produce pérdida de datos silenciosa, en el peor lugar.
 *
 * Las dos guardas de acá salieron de casos **medidos** por
 * `npm run verificar:frontera` contra el árbol, no de una revisión de código.
 */

/**
 * Un UUID de verdad.
 *
 * El guard anterior era `/^[0-9a-f-]{36}$/i`, en dos rutas. **Acepta 36
 * guiones**, que no es un UUID: pasa la validación, llega a Postgres, produce
 * `22P02` y sale como 503. Medido:
 *
 *     len 36 · /^[0-9a-f-]{36}$/i => true
 *     ERROR 22P02 invalid input syntax for type uuid: "------------------------------------"
 *
 * Contar caracteres de un alfabeto no valida una forma. Acá van las posiciones.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const esIdValido = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

/**
 * ¿El texto se puede guardar?
 *
 * Postgres **no admite el byte NUL en columnas `text`**, ni siquiera escapado.
 * Un `email` con `<NUL>` atravesaba toda la validación del login —es una cadena,
 * y mide entre 1 y 255— y reventaba recién en el driver. Medido contra la API:
 *
 *     "a<NUL>b" → HTTP 503 {"tipo":"base-datos"}
 *     "a\n b"    → HTTP 401  (el salto de línea no tiene nada de malo)
 *
 * Este caso **no lo encontró una lectura del código**: lo encontró el corpus de
 * `verificar-frontera.mjs`. Nadie sabía que estaba ahí.
 *
 * Se rechaza solo el NUL, y no «los caracteres raros»: el salto de línea, los
 * acentos y los espacios invisibles son texto legítimo que la base almacena sin
 * problema, y ampliar la guarda a ellos sería rechazar datos válidos para
 * arreglar un caso que no los incluye.
 */
export const esTextoAlmacenable = (v: unknown): v is string =>
  typeof v === "string" && !v.includes("\u0000");
