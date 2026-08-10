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

  /**
   * `max: 1` porque cada invocación serverless es un proceso efímero: un pool
   * grande por instancia agota las conexiones del servidor sin dar throughput.
   */
  const cliente = postgres(connectionString, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  return drizzle(cliente, { schema });
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
