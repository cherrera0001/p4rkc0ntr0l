/**
 * Cliente de base de datos — Postgres en Railway (ADR-003, enmienda a ADR-002).
 *
 * Driver TCP estándar (postgres-js). No se usa el driver de Neon: habla un
 * protocolo HTTP propio que un Postgres estándar no entiende.
 *
 * La cadena de conexión llega SIEMPRE por variable de entorno. Nunca se versiona
 * (spec.md §7). Drizzle emite consultas parametrizadas; no se concatena SQL.
 *
 * TLS: se exige por la cadena (`?sslmode=require`). Al exponer la base por el
 * proxy público de Railway, el tránsito no puede ir en claro.
 *
 * **Inicialización perezosa.** La conexión se abre en el primer uso real, no al
 * importar el módulo. Next importa las rutas durante el build para recolectar su
 * configuración, y en ese momento un secreto puede no estar disponible: crear el
 * cliente al evaluar el módulo hacía fallar el build entero. Además, así una
 * invocación serverless que no toca la base no abre conexión.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { exigirEnv } from "@/lib/env";
import { ErrorBaseDatos, ErrorConfiguracion } from "@/lib/errores";
import * as schema from "./schema";

type BaseDatos = ReturnType<typeof drizzle<typeof schema>>;

let instancia: BaseDatos | null = null;

function crear(): BaseDatos {
  // Se lee saneada: un BOM invisible en la variable rompía la conexión con un
  // ERR_INVALID_URL sobre una cadena que parecía correcta.
  const connectionString = exigirEnv(
    "DATABASE_URL",
    "Configurala como variable de entorno (ver .env.example). Debe apuntar al proxy " +
      "público de Railway, no a postgres.railway.internal: la red privada no resuelve " +
      "desde Vercel. No la escribas en el repo.",
  );

  // Se parsea acá, ANTES de dárselo al driver (hallazgo INT-1). Cuando la
  // cadena venía con un BOM adelante, `postgres()` la pasaba a `new URL()` y el
  // TypeError resultante llevaba la cadena entera —contraseña incluida— en su
  // mensaje y en su propiedad `input`, y de ahí a los logs de runtime de
  // Vercel. Esta comprobación falla con un mensaje que no contiene la cadena.
  try {
    new URL(connectionString);
  } catch {
    throw new ErrorConfiguracion(
      "DATABASE_URL no es una URL válida. Revisá que empiece por postgresql:// y " +
        "que no haya quedado con caracteres invisibles al copiarla. El valor no se " +
        "escribe en este mensaje a propósito.",
    );
  }

  /**
   * `max: 1` porque cada invocación serverless es un proceso efímero: un pool
   * grande por instancia agota las conexiones del servidor sin dar throughput.
   */
  const cliente = postgres(connectionString, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    /**
     * **Techo a toda consulta y a toda transacción abierta.**
     *
     * Medido contra la base real: `statement_timeout`,
     * `idle_in_transaction_session_timeout` y `lock_timeout` estaban los tres en
     * `0` —deshabilitados—, ni del lado del cliente ni del servidor. Reproducido
     * con dos procesos: uno abre `BEGIN; UPDATE …` y se congela sin cerrar; el
     * otro, corriendo el mismo `UPDATE` que usa el cierre de salida, **esperó
     * 14,6 s sin ningún error**. Si el primero nunca cierra —que es justo lo que
     * hace una instancia serverless reciclada a mitad de trabajo— el segundo
     * espera **sin techo**.
     *
     * Por qué duele acá y no en cualquier app: el camino afectado es el cierre de
     * salida, que es el que le dice al operador cuánto cobrar en efectivo, y el
     * alta de cliente, que escribe cuatro filas en una transacción. Y desde M8 la
     * base es **compartida entre clientes** (`max_connections` = 100 medido): un
     * puñado de instancias colgadas en el mismo patrón agota el pool para todos,
     * no solo para el estacionamiento afectado.
     *
     * Los valores son parámetro de ingeniería, no un `{{placeholder}}` de
     * negocio: 8 s cubre con holgura la consulta más lenta del producto —el
     * agregado por hora del panel— y 5 s es más de lo que cualquier transacción
     * del sistema necesita, ya que la más larga escribe cuatro filas.
     *
     * Efecto medido del mecanismo antes de proponerlo: la consulta abortada sale
     * con `code=57014`, que `ErrorBaseDatos` ya sanea y `respuestaDeFallo`
     * convierte en 503 con `Retry-After` — recuperable para la cola, que es el
     * comportamiento correcto para un timeout.
     */
    connection: {
      statement_timeout: 8_000,
      idle_in_transaction_session_timeout: 5_000,
    },
    // El log del driver imprimiría la consulta y sus parámetros: en esta base
    // los parámetros son patentes (dato personal, Ley 21.719).
    debug: false,
    onnotice: () => {},
  });

  return drizzle(cliente, { schema });
}

/**
 * Envoltura obligatoria de todo acceso a la base.
 *
 * Hace dos cosas que las rutas necesitaban por separado:
 *
 *  - **Sanea** (INT-1): lo que sale de acá es siempre un `ErrorBaseDatos`
 *    reconstruido, sin las propiedades del error del driver. Aunque quien llama
 *    se olvide de atraparlo y el error termine en el logger de Next, la
 *    credencial ya no viaja con él.
 *  - **Marca el punto de fallo** (INT-19): antes ningún acceso a `db` estaba
 *    dentro de un `try`, así que cualquier hipo de Railway era un 500 sin
 *    cuerpo tipado. Con esto, quien llama puede distinguir "la base falló" de
 *    "el pedido era inválido" y responder distinto.
 */
export async function conBase<T>(operacion: () => Promise<T>): Promise<T> {
  try {
    return await operacion();
  } catch (error) {
    throw ErrorBaseDatos.desde(error);
  }
}

/**
 * Se expone como Proxy para que los llamadores sigan escribiendo `db.select()`
 * sin saber nada de la inicialización diferida.
 */
export const db = new Proxy({} as BaseDatos, {
  get(_destino, propiedad, receptor) {
    instancia ??= crear();
    const valor = Reflect.get(instancia as object, propiedad, receptor);
    return typeof valor === "function" ? valor.bind(instancia) : valor;
  },
});

export * from "./schema";
