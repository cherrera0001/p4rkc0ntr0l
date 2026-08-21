/**
 * Freno de fuerza bruta para el login (hallazgo C-1).
 *
 * `CLAVE_ACCESO` es compartida y global: quien la adivine lee todas las
 * patentes. Hasta acá el login no tenía throttling, ni lockout, ni retardo, ni
 * 429 — atacarlo no costaba nada ni dejaba señal. Que la clave actual sea larga
 * es una propiedad del *valor*, no del sistema, y no sobrevive a que alguien la
 * cambie por una corta.
 *
 * **Qué protege realmente, dicho sin adornos.** Esto es un contador en memoria
 * del proceso. En Vercel cada instancia serverless tiene el suyo, y las
 * instancias van y vienen: un atacante con paciencia puede repartir intentos
 * entre instancias y ganar más margen del que sugieren los números de acá. Lo
 * que sí garantiza es que **una** ráfaga —que es la forma que toma un ataque de
 * diccionario— se frene en el primer puñado de intentos, y que la ventana de
 * ataque crezca en órdenes de magnitud. Un límite exacto exige un almacén
 * compartido; eso es una tabla o un Redis más que administrar, y ADR-002 pide
 * explícitamente no sumar infraestructura a la v1. Queda anotado como la
 * limitación que es, no como una propiedad que no tiene.
 *
 * Módulo puro y sin dependencias: el reloj entra por parámetro, así que las
 * pruebas no esperan en tiempo real.
 */

export type Veredicto =
  | { permitido: true }
  | { permitido: false; esperaSegundos: number };

export type OpcionesLimitador = {
  /** Fallos tolerados dentro de la ventana antes de empezar a frenar. */
  maxIntentos: number;
  /** Cuánto hacia atrás se miran los fallos, en ms. */
  ventanaMs: number;
  /** Espera del primer bloqueo, en ms. Se duplica con cada fallo extra. */
  esperaBaseMs: number;
  /** Techo de la espera, en ms. */
  esperaMaximaMs: number;
  /**
   * Cuántas claves distintas se recuerdan como mucho.
   *
   * Sin este techo, quien rote la IP en cada intento hace crecer el mapa sin
   * límite: el freno de fuerza bruta se convierte en el vector de agotamiento
   * de memoria. Al llegar al tope se descarta la entrada más vieja.
   */
  maxClaves: number;
};

/** Valores por defecto del piloto. Cinco intentos por cuarto de hora. */
export const OPCIONES_LOGIN: OpcionesLimitador = {
  maxIntentos: 5,
  ventanaMs: 15 * 60_000,
  esperaBaseMs: 15_000,
  esperaMaximaMs: 15 * 60_000,
  maxClaves: 10_000,
};

type Registro = {
  /** Instantes (ms epoch) de los fallos dentro de la ventana. */
  fallos: number[];
  /** Hasta cuándo está bloqueada la clave, en ms epoch. */
  bloqueadaHasta: number;
};

export class LimitadorIntentos {
  readonly #opciones: OpcionesLimitador;
  readonly #registros = new Map<string, Registro>();

  constructor(opciones: OpcionesLimitador = OPCIONES_LOGIN) {
    this.#opciones = opciones;
  }

  /** ¿Puede esta clave intentar ahora? No modifica nada. */
  consultar(clave: string, ahora: number = Date.now()): Veredicto {
    const registro = this.#registros.get(clave);
    if (!registro) return { permitido: true };

    if (registro.bloqueadaHasta > ahora) {
      return {
        permitido: false,
        // Hacia arriba: responder "esperá 0 segundos" a alguien que sigue
        // bloqueado sería mentirle.
        esperaSegundos: Math.ceil((registro.bloqueadaHasta - ahora) / 1000),
      };
    }

    return { permitido: true };
  }

  /** Cuenta un intento fallido y devuelve el veredicto para el siguiente. */
  registrarFallo(clave: string, ahora: number = Date.now()): Veredicto {
    const { maxIntentos, ventanaMs, esperaBaseMs, esperaMaximaMs } = this.#opciones;

    this.#podar(ahora);

    const registro = this.#registros.get(clave) ?? { fallos: [], bloqueadaHasta: 0 };
    registro.fallos = registro.fallos.filter((t) => t > ahora - ventanaMs);
    registro.fallos.push(ahora);

    if (registro.fallos.length > maxIntentos) {
      const excedente = registro.fallos.length - maxIntentos;
      const espera = Math.min(esperaBaseMs * 2 ** (excedente - 1), esperaMaximaMs);
      registro.bloqueadaHasta = ahora + espera;
    }

    // Se reinserta para que el orden del Map refleje el uso reciente: la poda
    // por tamaño descarta lo más viejo.
    this.#registros.delete(clave);
    this.#registros.set(clave, registro);

    return this.consultar(clave, ahora);
  }

  /** Un login correcto borra el historial de esa clave. */
  registrarExito(clave: string): void {
    this.#registros.delete(clave);
  }

  /** Solo para pruebas y diagnóstico. */
  get tamano(): number {
    return this.#registros.size;
  }

  #podar(ahora: number): void {
    const { ventanaMs, maxClaves } = this.#opciones;

    for (const [clave, registro] of this.#registros) {
      const vivo =
        registro.bloqueadaHasta > ahora ||
        registro.fallos.some((t) => t > ahora - ventanaMs);
      if (!vivo) this.#registros.delete(clave);
    }

    // Si aun así no entra, se descarta lo menos reciente. Perder un contador
    // libera a esa clave, no bloquea a otra: el error va del lado seguro para
    // el usuario legítimo, que es el único lado en el que puede ir sin un
    // almacén compartido.
    while (this.#registros.size >= maxClaves) {
      const masVieja = this.#registros.keys().next();
      if (masVieja.done) break;
      this.#registros.delete(masVieja.value);
    }
  }
}

/**
 * Identifica al cliente para contarle los intentos.
 *
 * **`x-forwarded-for` no se lee, y esa es la corrección (SEG-2).** Antes se
 * tomaba su primer elemento. Esa cabecera la puede escribir quien pide: los
 * proxies *agregan* al final, así que el primer elemento es texto del cliente.
 * Con eso, el limitador se evadía rotando un valor inventado —un contador nuevo
 * por petición— y dejaba de existir como límite. Encender la nube naranja el
 * 2026-08-20 puso un proxy delante y volvió el defecto explotable en vivo.
 *
 * El orden es por quién escribe la cabecera, no por preferencia:
 *
 *  1. `cf-connecting-ip` — la pone Cloudflare y **pisa** lo que mandara el
 *     cliente. Va primera porque con la nube naranja las otras dos traen la IP
 *     del borde de Cloudflare, no la del conductor: usarlas metería a todo el
 *     tráfico en un puñado de contadores y bloquearía a operadores legítimos.
 *  2. `x-vercel-forwarded-for` — la pone el borde de Vercel, también pisando al
 *     cliente. Es la buena cuando se entra por `*.vercel.app`, sin Cloudflare.
 *  3. `x-real-ip` — misma familia, respaldo.
 *  4. Clave fija. Sin ninguna cabecera de confianza —desarrollo local— es peor
 *     para distinguir clientes, pero frena la ráfaga. Preferirla a un valor que
 *     el cliente controla es deliberado: un contador compartido limita de más;
 *     uno falsificable no limita nada.
 *
 * **Riesgo residual, declarado y no cerrado:** mientras
 * `estacionamiento-three.vercel.app` siga accesible en directo, esa ruta no pasa
 * por Cloudflare y por ahí `cf-connecting-ip` la escribe el cliente. Cerrar el
 * acceso directo es lo que la vuelve infalsificable, y es decisión pendiente
 * porque hoy los verificadores miden contra esa URL.
 */
const CABECERAS_DE_CONFIANZA = [
  "cf-connecting-ip",
  "x-vercel-forwarded-for",
  "x-real-ip",
] as const;

export function identificarCliente(cabeceras: Headers): string {
  for (const nombre of CABECERAS_DE_CONFIANZA) {
    // Se toma el primer elemento sólo dentro de una cabecera que el borde
    // escribe él mismo; ahí la lista no lleva texto del cliente.
    const ip = cabeceras.get(nombre)?.split(",")[0]?.trim();
    if (ip && ip.length > 0) return ip;
  }
  return "sin-ip";
}
