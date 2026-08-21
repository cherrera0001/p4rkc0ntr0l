/**
 * Un solo host sirve el producto en producción. El resto se redirige.
 *
 * **Por qué existe, y son dos problemas que resultaron ser el mismo.**
 *
 * `estacionamiento-three.vercel.app` responde en directo, sin pasar por
 * Cloudflare. Por ese camino:
 *
 *  - **el limitador de intentos no corta** —medido: 30 intentos, 0 cortes—, así
 *    que la fuerza bruta contra `/api/login` no tiene freno (M-10);
 *  - **el gasto no tiene techo**: cada petición es una invocación que se factura,
 *    y nadie puede limitar lo que no ve.
 *
 * Cerrar ese camino arregla los dos. Y se cierra **redirigiendo**, no bloqueando:
 * un 403 dejaría la app inalcanzable si el dominio propio fallara, mientras que
 * un 308 sigue resolviendo y además conserva método y cuerpo, así que un `POST`
 * de la cola offline no se pierde: llega al host canónico, detrás de Cloudflare.
 *
 * Quien ataque puede ignorar la redirección, pero entonces **no obtiene
 * procesamiento**: la petición no llega a la ruta. Que es el punto.
 */

/** Hosts que sirven el producto. El apex ya redirige a `www` en el borde. */
const POR_DEFECTO = ["www.parkcontrol.cl", "parkcontrol.cl"];

export const HOST_DESTINO = "www.parkcontrol.cl";

/**
 * Se puede sobreescribir por entorno sin tocar código —al mudar de dominio—,
 * pero **tiene un valor por defecto a propósito**: si dependiera de una variable
 * que alguien tiene que acordarse de poner, el día que falte la protección
 * desaparece en silencio. Un control que se apaga solo no es un control.
 */
export function hostsCanonicos(crudo?: string): string[] {
  const limpio = crudo?.trim();
  if (!limpio) return POR_DEFECTO;
  return limpio
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

/** `localhost:3000` y `127.0.0.1:3000` son el mismo host sin puerto. */
function sinPuerto(host: string): string {
  return host.toLowerCase().split(":")[0] ?? "";
}

const LOCALES = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/**
 * ¿Hay que redirigir esta petición, y a dónde?
 *
 * Devuelve `null` cuando no. Los casos en que **nunca** se redirige, cada uno
 * por su motivo:
 *
 *  - `entornoVercel !== "production"` — las vistas previas se sirven por su URL
 *    de `*.vercel.app` y redirigirlas a producción las volvería imposibles de
 *    probar, que es justamente para lo que existen;
 *  - host local — desarrollo y los verificadores contra `npm start`;
 *  - sin cabecera `host` — no se inventa un destino a partir de nada.
 */
export function destinoCanonico(
  host: string | null,
  rutaConBusqueda: string,
  entornoVercel: string | undefined,
  hostsConfigurados?: string,
): string | null {
  if (entornoVercel !== "production") return null;
  if (!host) return null;

  const limpio = sinPuerto(host);
  if (LOCALES.has(limpio)) return null;
  if (hostsCanonicos(hostsConfigurados).includes(limpio)) return null;

  return `https://${HOST_DESTINO}${rutaConBusqueda}`;
}
