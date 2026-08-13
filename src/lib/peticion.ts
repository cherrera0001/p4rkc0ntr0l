/**
 * Piezas comunes de las rutas de API: comprobación de origen y respuestas de
 * fallo.
 *
 * Cubre dos hallazgos que aparecían repetidos en las cuatro rutas:
 *
 *  - **B-2** — no había ni token CSRF ni verificación de `Origin`. `SameSite=Lax`
 *    era la única defensa, y `Lax` deja pasar navegaciones de nivel superior.
 *  - **INT-19 / INT-20** — ningún acceso a la base estaba dentro de un `try`, así
 *    que cualquier hipo de Railway era un 500 sin cuerpo, indistinguible de un
 *    despliegue al que le falta una variable de entorno.
 */

import { NextResponse } from "next/server";

import { describirParaLog, ErrorConfiguracion } from "./errores.ts";

export const noAutorizado = () =>
  NextResponse.json({ error: "No autorizado." }, { status: 401 });

/**
 * ¿La petición viene de esta misma aplicación? (hallazgo B-2)
 *
 * Regla deliberadamente asimétrica:
 *
 *  - si el navegador dice de dónde viene (`Origin`, o `Sec-Fetch-Site`), tiene
 *    que decir que viene de acá;
 *  - si no lo dice, se acepta. Los navegadores mandan `Origin` en toda petición
 *    con método distinto de GET, así que la ausencia significa un cliente que no
 *    es un navegador —los verificadores de `scripts/`, por ejemplo— y ese cliente
 *    no es a quien el CSRF ataca.
 *
 * Rechazar la ausencia no agregaría seguridad y rompería la verificación.
 */
export function origenPropio(request: Request): boolean {
  const sitio = request.headers.get("sec-fetch-site");
  if (sitio && sitio !== "same-origin" && sitio !== "none") return false;

  const origen = request.headers.get("origin");
  if (!origen) return true;

  try {
    return new URL(origen).host === request.headers.get("host");
  } catch {
    return false;
  }
}

export const origenAjeno = () =>
  NextResponse.json(
    { error: "Origen no permitido." },
    // 403 y no 400: para la cola local un 403 es definitivo, pero este caso no
    // puede venir de la cola —que siempre postea desde la propia app—, y dejarlo
    // como recuperable haría reintentar para siempre una petición que nunca va a
    // ser aceptada.
    { status: 403 },
  );

/**
 * Traduce un fallo del servidor a una respuesta, distinguiendo "mal
 * configurado" de "el servicio de datos no está" (hallazgo INT-20).
 *
 * Siempre 503 y nunca 500: para la cola local del operador, un 5xx es
 * recuperable y el ingreso se queda en el dispositivo esperando el siguiente
 * intento (ver `esRechazoDefinitivo`). Un 500 tenía la misma propiedad, pero
 * 503 además dice la verdad —el servicio no está disponible— y admite
 * `Retry-After`.
 *
 * El log sale por `describirParaLog`, que redacta credenciales (INT-1).
 */
export function respuestaDeFallo(contexto: string, error: unknown): NextResponse {
  console.error(describirParaLog(contexto, error));

  if (error instanceof ErrorConfiguracion) {
    return NextResponse.json(
      {
        error:
          "El servidor está mal configurado y no puede atender esta petición. " +
          "Revisá las variables de entorno del despliegue.",
        tipo: "configuracion",
      },
      { status: 503 },
    );
  }

  return NextResponse.json(
    {
      error: "El servicio de datos no está disponible. Reintentá en un momento.",
      tipo: "base-datos",
    },
    { status: 503, headers: { "Retry-After": "5" } },
  );
}
