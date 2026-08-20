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

/**
 * Un entero de frontera, dentro de un rango.
 *
 * Acepta el número **como número o como texto exactamente entero**, y rechaza
 * lo que de verdad no es un entero: `NaN`, decimales, infinitos, texto.
 *
 * ## Por qué acepta el texto numérico
 *
 * Una versión anterior rechazaba `"10"` a propósito, *«para que "10" y 10 no
 * sean la misma cosa en la frontera»*. Esa pureza costó un fallo real: un
 * `<input type="number">` del navegador entrega su valor **como cadena**, y
 * cualquier camino que no convirtiera —un bundle viejo cacheado por el service
 * worker, un lector distinto— mandaba `"10"` y recibía un 400 que decía
 * *«capacidad inválida»* sobre un 10 perfectamente válido.
 *
 * Rechazar `"10"` **no tiene ningún valor de seguridad**: un entero es un entero
 * venga tipado como venga. Lo que sí importa —que no sea decimal, ni `NaN`, ni
 * texto arbitrario, ni esté fuera de rango— se sigue haciendo cumplir. Robustez
 * en la entrada, estrictez en lo que se guarda.
 *
 * ## Por qué vive acá y no en una ruta
 *
 * Nació dentro de `api/plataforma/clientes/route.ts`, y la segunda superficie
 * que necesitó exactamente lo mismo —la nueva versión de tarifa— habría sido su
 * primera copia. Dos copias de una guarda de frontera son dos oportunidades de
 * que una quede vieja, y la que quede vieja es la que deja pasar el valor malo.
 */
export function enteroDeFrontera(v: unknown, min: number, max: number): number | null {
  // El texto se acepta solo si es EXACTAMENTE un entero: `Number("10")` es 10,
  // pero `Number("10.5")`, `Number("1,000")` y `Number("")` no sobreviven la
  // prueba de `Number.isInteger`, y `"  "` tampoco. No es coerción laxa.
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  if (typeof n !== "number" || !Number.isInteger(n)) return null;
  return n < min || n > max ? null : n;
}

/**
 * Margen alrededor de ahora fuera del cual una fecha no es un dato: es basura.
 *
 * Cien años a cada lado. **No es un umbral de negocio** —no hay ningún
 * `{{placeholder}}` acá—: es la cota por debajo de la cual ningún reloj real, ni
 * ninguna corrección de desfase, produce una fecha creíble, y por encima de la
 * cual Postgres empieza a rechazar por rango.
 */
export const RANGO_FECHA_MS = 100 * 365.25 * 24 * 60 * 60_000;

/**
 * Una fecha que la base va a aceptar — no solo una que `Date` sepa parsear.
 *
 * ## El defecto que cierra, medido contra la API
 *
 * La versión anterior vivía dentro de `api/sesiones/route.ts` y solo rechazaba
 * `NaN`. Un valor extremo pero perfectamente parseable —el que produce un reloj
 * roto en un teléfono barato— atravesaba la frontera intacto y reventaba recién
 * en el driver:
 *
 *     tecleoInicioAt: "-010000-01-01T00:00:00.000Z"
 *       → HTTP 503 {"tipo":"base-datos"}
 *       → log: [22009] time zone displacement out of range
 *
 * **Y un 503 no es un error cosmético acá.** La cola local lo clasifica como
 * recuperable y además **corta el lote**. O sea: un solo registro con una fecha
 * que la base **nunca** va a aceptar bloquea la sincronización entera del turno,
 * para siempre, y con ella la evidencia de H1 —que es el producto—. Es el mismo
 * daño que este módulo ya documenta para el UUID de 36 guiones, por otra puerta.
 *
 * Rechazar acá lo convierte en **400: definitivo**, que es lo correcto para un
 * dato que no va a ser válido nunca.
 *
 * ## Por qué la cota no contradice a `tiempo.ts`
 *
 * `sanearIngreso` deja los instantes de tecleo sin recortar a propósito —*«son
 * evidencia medida, y recortarlos sería fabricar datos»*—. Esto no los recorta:
 * **rechaza la petición entera**. Recortar inventa un número; rechazar dice que
 * no hay dato. Además evita el otro borde medido, en que la propia corrección de
 * desfase desborda el rango representable de `Date` y sale como `Invalid time
 * value`, perdiendo hasta el código de Postgres que `errores.ts` distingue.
 *
 * ## Por qué vive acá y no en la ruta
 *
 * Es una guarda de frontera, y las guardas de frontera viven en este módulo:
 * `esIdValido` y `esTextoAlmacenable` ya estaban. Estando acá se puede **probar
 * con `npm test`**, sin servidor y sin base — que es lo que hacía falta, porque
 * `verificar:frontera` **no alcanza este código**: manda el mismo valor
 * degenerado en todos los campos a la vez, así que `validarPatente` rechaza con
 * 400 antes de que la fecha se parsee. Medido: con la cota quitada, ese
 * verificador seguía dando 5/5.
 */
export function fechaDeFrontera(valor: unknown): Date | null {
  if (typeof valor !== "string") return null;
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return null;
  return Math.abs(d.getTime() - Date.now()) > RANGO_FECHA_MS ? null : d;
}
