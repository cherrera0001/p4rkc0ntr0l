/**
 * Clasificación y saneo de errores del servidor.
 *
 * **Por qué existe este módulo (hallazgo INT-1).** El gate terminal A-2 se
 * levantó rotando la credencial de Postgres, no arreglando lo que la expuso: un
 * fallo de conexión que imprime la cadena entera —contraseña incluida— en los
 * logs de runtime. El formato exacto quedó registrado en `LEDGER.md`:
 *
 *   TypeError: Invalid URL
 *   input: '<U+FEFF>postgresql://...@autorack.proxy.rlwy.net:55464/railway?...'
 *
 * Esa contraseña es la única barrera de una base publicada en internet por el
 * proxy TCP de Railway. Mientras el código pueda volver a escribirla en un log,
 * el gate se reabre solo, sin que nadie toque una línea. Así que:
 *
 *  - ningún error del driver sale de acá tal cual: se reconstruye uno nuevo,
 *    con el mensaje redactado y **sin** las propiedades del original (`input`,
 *    `cause`, `query`, `parameters`), que es donde postgres-js guarda la cadena;
 *  - el saneo no confía en conocer todos los formatos: redacta por patrón
 *    (credenciales embebidas en cualquier URI) **y** por valor (la coincidencia
 *    literal de los secretos del entorno).
 *
 * **Y por qué distingue configuración de servicio (hallazgo INT-20).** Un
 * despliegue sin `CLAVE_ACCESO` y un Railway caído dan hoy el mismo 500 mudo.
 * En un piloto que opera una sola persona, esa diferencia son treinta minutos de
 * diagnóstico. Se separan en el tipo, no en un comentario.
 *
 * Sin dependencias a propósito: se prueba con `node --test` sin levantar nada.
 */

/**
 * Credenciales embebidas en una URI: `esquema://usuario:clave@host`.
 *
 * Redacta usuario y clave. El host se conserva: sirve para diagnosticar y no es
 * secreto (está en la configuración del proyecto, no en el vault).
 */
const CREDENCIAL_EN_URI = /\b([a-z][a-z0-9+.\-]*:\/\/)[^\s/@]+@/gi;

/** Variables cuyo valor literal no puede aparecer nunca en un log. */
const NOMBRES_SECRETOS = ["DATABASE_URL", "SESSION_SECRET", "CLAVE_ACCESO"] as const;

/**
 * Un valor más corto que esto no se redacta por coincidencia literal: sería
 * ruido —y con un secreto de dos letras, redactar por valor mutila el mensaje
 * entero sin proteger nada—. El patrón de URI sigue cubriendo el caso.
 */
const LARGO_MINIMO_REDACTABLE = 8;

function valoresSensibles(): string[] {
  const valores: string[] = [];

  const agregar = (valor: string | undefined) => {
    if (!valor) return;
    const limpio = valor.trim();
    if (limpio.length >= LARGO_MINIMO_REDACTABLE) valores.push(limpio);
  };

  for (const nombre of NOMBRES_SECRETOS) {
    const crudo = process.env[nombre];
    agregar(crudo);

    // La contraseña sola, además de la cadena entera: el driver la reimprime
    // suelta en algunos errores de autenticación, sin el resto de la URI.
    if (nombre === "DATABASE_URL" && crudo) {
      try {
        const { password } = new URL(crudo.trim());
        agregar(password);
        agregar(decodeURIComponent(password));
      } catch {
        // Si no parsea como URL no hay componente que extraer. El patrón de URI
        // y la coincidencia con la cadena completa siguen aplicando.
      }
    }
  }

  // Primero los más largos: redactar la cadena completa antes que la
  // contraseña sola evita dejar el resto de la URI a la vista.
  return valores.sort((a, b) => b.length - a.length);
}

/** Quita de un texto cualquier credencial, venga por patrón o por valor. */
export function redactarSecretos(texto: string): string {
  let salida = texto.replace(CREDENCIAL_EN_URI, "$1[credencial redactada]@");
  for (const valor of valoresSensibles()) {
    salida = salida.split(valor).join("[secreto redactado]");
  }
  return salida;
}

/**
 * El servidor está mal configurado: falta una variable, o tiene un valor que no
 * se puede usar. No es un fallo transitorio y reintentar no lo arregla.
 */
export class ErrorConfiguracion extends Error {
  constructor(mensaje: string) {
    super(redactarSecretos(mensaje));
    this.name = "ErrorConfiguracion";
  }
}

/**
 * Cadena de causas de un error, de la más externa a la más interna.
 *
 * Drizzle envuelve el error del driver en un `DrizzleQueryError` cuyo mensaje
 * incluye la consulta **y sus parámetros** — y en esta base los parámetros son
 * patentes, o sea dato personal (Ley 21.719). Por eso el mensaje que se conserva
 * es el de la causa más interna (el del driver, del estilo `duplicate key value
 * violates unique constraint "…"`), no el del envoltorio.
 *
 * El `Set` corta las cadenas circulares, que un `cause` mal armado puede formar.
 */
function cadenaDeCausas(error: unknown): unknown[] {
  const cadena: unknown[] = [];
  const vistos = new Set<unknown>();
  let actual = error;

  while (actual != null && !vistos.has(actual)) {
    vistos.add(actual);
    cadena.push(actual);
    actual =
      typeof actual === "object" && "cause" in actual
        ? (actual as { cause: unknown }).cause
        : null;
  }

  return cadena;
}

/**
 * Fallo al hablar con Postgres.
 *
 * Se construye SIEMPRE con `desde()`, que descarta el error original entero: de
 * él solo sobreviven el código y el mensaje redactado. Es deliberado que no haya
 * `cause` — encadenar el original devolvería al log exactamente lo que este
 * módulo existe para sacar.
 */
export class ErrorBaseDatos extends Error {
  /** Código del driver (`ECONNREFUSED`, `28P01`, `22003`, …) o `desconocido`. */
  readonly codigo: string;

  private constructor(codigo: string, mensaje: string) {
    super(mensaje);
    this.name = "ErrorBaseDatos";
    this.codigo = codigo;
  }

  static desde(causa: unknown): ErrorBaseDatos | ErrorConfiguracion {
    // Un fallo de configuración no se disfraza de fallo de servicio: es
    // justamente la distinción de INT-20.
    if (causa instanceof ErrorConfiguracion) return causa;

    const cadena = cadenaDeCausas(causa);
    // Una `ErrorConfiguracion` envuelta sigue siendo un problema de
    // configuración: `exigirEnv` puede lanzar dentro de una consulta.
    const configuracion = cadena.find((e) => e instanceof ErrorConfiguracion);
    if (configuracion) return configuracion as ErrorConfiguracion;

    // El código del driver: el más interno que lo declare. Drizzle no pone
    // `code` en su envoltorio, así que sin mirar la cadena todo error de
    // consulta quedaba como `desconocido` — y con él, un 23505 (patente ya
    // adentro, INT-15) era indistinguible de una caída de Railway.
    const conCodigo = [...cadena]
      .reverse()
      .find((e) => typeof e === "object" && e !== null && "code" in e);
    const codigo = conCodigo
      ? String((conCodigo as { code: unknown }).code)
      : "desconocido";

    // El mensaje del más interno: el del envoltorio de drizzle arrastra la
    // consulta y sus parámetros, y ahí viajan las patentes.
    const raiz = cadena.at(-1);
    const mensaje = raiz instanceof Error ? raiz.message : String(raiz ?? causa);

    return new ErrorBaseDatos(codigo, redactarSecretos(mensaje));
  }
}

/**
 * Línea de log segura para un error, con el contexto de dónde ocurrió.
 *
 * Devuelve un string y no el error: `console.error(objeto)` imprime también las
 * propiedades propias, y en un error de postgres-js ahí es donde vive la cadena
 * de conexión.
 */
export function describirParaLog(contexto: string, error: unknown): string {
  if (error instanceof ErrorBaseDatos) {
    return `${contexto}: fallo de base de datos [${error.codigo}] ${error.message}`;
  }
  if (error instanceof ErrorConfiguracion) {
    return `${contexto}: configuración inválida: ${error.message}`;
  }
  const mensaje = error instanceof Error ? error.message : String(error);
  return `${contexto}: ${redactarSecretos(mensaje)}`;
}
