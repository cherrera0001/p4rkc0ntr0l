/**
 * Saneo de los instantes que gobiernan el dinero (hallazgo INT-14).
 *
 * `entradaAt` la pone el reloj del dispositivo del operador, y de ella sale el
 * monto que se cobra en efectivo. Hasta acá la única validación era que la fecha
 * fuera parseable. Dos fallos del mundo real, ninguno hipotético:
 *
 *  1. **Reloj adelantado** (habitual en teléfonos baratos y tras un arranque sin
 *     red): `entradaAt` queda en el futuro y `calcularMonto` lanza al cerrar la
 *     sesión → 500. La sesión **nunca** se puede cerrar, el operador no tiene
 *     otro camino en la interfaz, y como el servidor la sigue listando activa el
 *     dispositivo conserva su patente para siempre: reabre M-4 por una puerta
 *     que la corrección de M-4 no puede cerrar.
 *  2. **Reloj atrasado**: monto arbitrario que el operador cobra en efectivo, y
 *     con suficiente atraso el valor excede el `integer` de Postgres → 22003 →
 *     500 y sesión igualmente incerrable.
 *
 * **Por qué corregir y no rechazar.** Rechazar con 400 sería lo natural, y sería
 * un error: `esRechazoDefinitivo` (400 y 403) borra el registro del dispositivo,
 * así que un reloj desajustado convertiría cada ingreso registrado sin red en un
 * ingreso perdido. Sería cambiar un 500 por pérdida de datos. En cambio se
 * corrige el desfase: el cliente manda también **su** "ahora" al sincronizar, y
 * la diferencia con el reloj del servidor da el desfase de ese dispositivo.
 * Restarlo devuelve la antigüedad real del ingreso, que es lo único que importa
 * para cobrar.
 *
 * Y no estropea la métrica de H1: `tecleoFinAt - tecleoInicioAt` es una
 * *duración*, invariante al desfase del reloj que la midió.
 *
 * Módulo puro: sin reloj propio, sin base, sin red. Todo entra por parámetro.
 */

/**
 * Desfase que se acepta sin corregir. Por debajo de esto la diferencia es
 * latencia de red y no un reloj mal puesto; corregir sería agregar ruido.
 */
export const DESFASE_IGNORABLE_MS = 2_000;

/**
 * Antigüedad máxima de un ingreso, y permanencia máxima facturable.
 *
 * Treinta días es holgado para una cola offline —lo normal son minutos— y a la
 * vez acota el monto: con cualquier tarifa razonable, treinta días quedan muy por
 * debajo del `integer` de Postgres. No es una regla de negocio sobre cuánto
 * puede quedarse un auto; es el techo que impide que un reloj roto produzca una
 * cifra imposible de cobrar y una fila imposible de cerrar.
 */
export const PERMANENCIA_MAXIMA_MS = 30 * 24 * 60 * 60_000;

/** Techo del monto almacenable. `integer` de Postgres, con margen. */
export const MONTO_MAXIMO = 2_000_000_000;

export type InstantesIngreso = {
  entradaAt: Date;
  tecleoInicioAt: Date;
  tecleoFinAt: Date;
};

export type IngresoSaneado = InstantesIngreso & {
  /** Desfase detectado del reloj del cliente, en ms. Positivo = adelantado. */
  desfaseMs: number;
  /** `true` si hubo que recortar la entrada contra los límites duros. */
  acotada: boolean;
};

/**
 * Desfase del reloj del cliente respecto del servidor.
 *
 * `clienteAhora` es el "ahora" del dispositivo en el momento de sincronizar.
 * Si no viene —registros encolados por una versión anterior— el desfase es 0 y
 * queda la acotación como única red de seguridad.
 */
export function calcularDesfase(
  clienteAhora: Date | null,
  servidorAhora: Date,
): number {
  if (!clienteAhora) return 0;
  const desfase = clienteAhora.getTime() - servidorAhora.getTime();
  return Math.abs(desfase) <= DESFASE_IGNORABLE_MS ? 0 : desfase;
}

/**
 * Corrige los tres instantes por el desfase del dispositivo y acota la entrada.
 *
 * La entrada no puede quedar en el futuro (eso es lo que hace la sesión
 * incerrable) ni más vieja que `PERMANENCIA_MAXIMA_MS` (eso es lo que hace el
 * monto absurdo). Los instantes de tecleo se corrigen por el mismo desfase pero
 * **no se acotan**: son evidencia medida, y recortarlos sería fabricar datos
 * para H1 en vez de registrar lo que pasó.
 */
export function sanearIngreso(
  instantes: InstantesIngreso,
  clienteAhora: Date | null,
  servidorAhora: Date,
): IngresoSaneado {
  const desfaseMs = calcularDesfase(clienteAhora, servidorAhora);
  const correr = (d: Date) => new Date(d.getTime() - desfaseMs);

  const entradaCorregida = correr(instantes.entradaAt);
  const ahora = servidorAhora.getTime();
  const piso = ahora - PERMANENCIA_MAXIMA_MS;
  const acotado = Math.min(Math.max(entradaCorregida.getTime(), piso), ahora);

  return {
    entradaAt: new Date(acotado),
    tecleoInicioAt: correr(instantes.tecleoInicioAt),
    tecleoFinAt: correr(instantes.tecleoFinAt),
    desfaseMs,
    acotada: acotado !== entradaCorregida.getTime(),
  };
}

/**
 * Entrada que se usa para facturar una salida.
 *
 * Red de seguridad para las filas que ya están en la base desde antes de esta
 * corrección: una entrada posterior a la salida hacía lanzar a `calcularMonto` y
 * dejaba la sesión sin forma de cerrarse. Acá se recorta al rango facturable, la
 * salida se registra, y el vehículo puede irse.
 */
export function entradaFacturable(entradaAt: Date, salidaAt: Date): Date {
  const salida = salidaAt.getTime();
  const acotada = Math.min(
    Math.max(entradaAt.getTime(), salida - PERMANENCIA_MAXIMA_MS),
    salida,
  );
  return new Date(acotada);
}

/** Recorta el monto al rango que la columna `integer` puede guardar. */
export function montoAlmacenable(monto: number): number {
  if (!Number.isFinite(monto) || monto < 0) return 0;
  return Math.min(Math.round(monto), MONTO_MAXIMO);
}
