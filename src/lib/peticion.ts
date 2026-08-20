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

import { exigirRol, type Rol, type SesionDeRecinto, type SesionUsuario } from "./auth.ts";
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

/**
 * **Envoltorio de ruta autenticada — la propiedad que faltaba: todo lo que puede
 * fallar corre dentro del `try`.**
 *
 * ## El defecto que cierra
 *
 * Las tres rutas de API llamaban a `exigirRol()` **antes** de abrir su `try`
 * (`sesiones/route.ts:43`, `:81`, `salida/route.ts:44`). Y `exigirRol` no es una
 * comprobación en memoria: baja por `sesionActual()` a **leer la fila de
 * `usuario` en la base** (`auth.ts:87-89`), y antes de eso `deserializarSesion`
 * pide `SESSION_SECRET` (`sesion-token.ts:48-51`).
 *
 * Consecuencia: con Railway caído, o con una variable de entorno faltante en el
 * despliegue, **el 100% del tráfico autenticado respondía 500 sin cuerpo** — que
 * es exactamente el defecto que INT-19/INT-20 declararon corregido y que
 * `respuestaDeFallo` existe para evitar. El 503 tipado estaba construido y no se
 * alcanzaba nunca, porque la excepción ocurría dos líneas antes del `catch`.
 *
 * ## Por qué un envoltorio y no mover tres líneas
 *
 * No es elegancia: es **verificabilidad**. *«La llamada está dentro del `try`»*
 * no se puede escanear sin parsear posiciones de bloques, así que una ruta futura
 * que se olvide no dispara nada. *«Toda ruta de `src/app/api/**` se construye con
 * el envoltorio»* **sí** se escanea, y por exclusión: se recorre el árbol y la que
 * llame a `exigirRol` por fuera falla.
 *
 * Es la misma corrección de forma que obligó a reescribir AC-SCOPE-1
 * (`CLAUDE.md` §1): una lista blanca de tres rutas no ve la cuarta.
 *
 * **Lo que este envoltorio NO hace:** no garantiza la propiedad «por
 * construcción». Es opt-in, y una ruta puede no usarlo. Lo que hace es convertir
 * una propiedad inescaneable en una escaneable, y el guard de
 * `verificar:endurecimiento` es el que la hace cumplir. Decir otra cosa sería
 * vender de más.
 *
 * ## La asimetría del origen se conserva
 *
 * `GET /api/sesiones` hoy **no** comprueba origen, y no debe empezar a hacerlo en
 * este cambio: un GET de otro sitio no lo puede leer el atacante por CORS, y
 * cambiarlo acá sería colar una decisión de seguridad dentro de un refactor. Por
 * eso `exigirOrigen` es explícito en cada ruta y no un default silencioso.
 */
export function rutaAutenticada<C = unknown, R extends Rol = Rol>(
  opciones: {
    rol: R;
    exigirOrigen: boolean;
  },
  manejador: (entrada: {
    // El rol pedido determina el tipo de la sesion: quien pide "operador" o
    // "dueno" recibe un `estacionamientoId` que NO es nulo, y por eso no
    // puede escribir por descuido una clausula de aislamiento contra `null`.
    sesion: R extends "plataforma" ? SesionUsuario : SesionDeRecinto;
    request: Request;
    contexto: C;
  }) => Promise<NextResponse>,
) {
  return async function (request: Request, contexto: C): Promise<NextResponse> {
    // El nombre se arma antes de todo, para que el log del fallo diga qué ruta
    // fue incluso si la petición revienta en la primera línea.
    let etiqueta = request.method;
    try {
      etiqueta = `${request.method} ${new URL(request.url).pathname}`;
    } catch {
      // Una URL ilegible no puede impedir que la ruta responda su 503.
    }

    /**
     * **Ninguna respuesta de una ruta autenticada se cachea. Acá, en un solo
     * lugar, y por TODOS los caminos de salida.**
     *
     * Lo que sale de estas rutas es dato personal —patentes activas— o va
     * acompañado de la cookie de sesión. Hoy el único consumidor real
     * (`pantalla-operador.tsx`) pide `cache: "no-store"` por su cuenta, así que
     * el flujo del producto no está expuesto; **pero la prohibición vivía en el
     * cliente y no en el servidor**, y eso significa que cualquier consumidor
     * futuro —otra pantalla, un `fetch` sin la opción, un proxy corporativo—
     * hereda permiso para cachear patentes por defecto.
     *
     * Es el escenario que INT-8 ya declaró real: **el dispositivo lo comparten
     * los turnos**.
     *
     * Va envolviendo **cada** `return`, no solo el del manejador: un 401 o un
     * 403 tampoco tienen por qué quedar cacheados, y dejar dos caminos con la
     * cabecera y dos sin ella es exactamente la clase de agujero por enumeración
     * que este repo viene cerrando. Es la misma decisión de forma que hizo
     * verificable a `exigirRol`: una propiedad que se cumple por construcción no
     * depende de que la próxima ruta se acuerde.
     */
    const sinCache = (respuesta: NextResponse): NextResponse => {
      respuesta.headers.set("Cache-Control", "private, no-store");
      return respuesta;
    };

    try {
      if (opciones.exigirOrigen && !origenPropio(request)) return sinCache(origenAjeno());

      const sesion = await exigirRol(opciones.rol);
      if (!sesion) return sinCache(noAutorizado());

      // **Estado imposible, no error de usuario.** La base garantiza
      // `pertenencia_por_rol`: un rol de recinto siempre tiene estacionamiento.
      // Si llegara a pasar es corrupcion del modelo, y sale por el 503 tipado —
      // nunca hacia adelante, donde filtraria contra `null` y devolveria datos
      // de todos los clientes.
      if (sesion.rol !== "plataforma" && sesion.estacionamientoId === null) {
        throw new Error("usuario de recinto sin estacionamiento: viola pertenencia_por_rol");
      }

      const respuesta = await manejador({
        sesion: sesion as R extends "plataforma" ? SesionUsuario : SesionDeRecinto,
        request,
        contexto,
      });

      return sinCache(respuesta);
    } catch (error) {
      return sinCache(respuestaDeFallo(etiqueta, error));
    }
  };
}
