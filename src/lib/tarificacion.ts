/**
 * Cálculo del monto a cobrar — spec.md §5 (AC-OP-2).
 *
 * Función pura: sin fecha "ahora", sin base de datos, sin efectos. Toda la
 * entrada es explícita, así que el mismo caso da siempre el mismo resultado y
 * la prueba unitaria no depende del reloj.
 *
 * Los tres parámetros de tarifa son datos que carga el dueño, NO constantes de
 * negocio (spec.md §11): acá no se hardcodea ninguno.
 *
 * El cobro es en efectivo y fuera del sistema. Esto solo calcula lo que el
 * operador debe cobrar; no registra ni concilia nada.
 */

export type ParametrosTarifa = {
  /** Valor por hora, en pesos. */
  valorHora: number;
  /** Unidad mínima de cobro, en minutos. La permanencia se redondea a este múltiplo. */
  fraccionMinutos: number;
  /** Piso de cobro, en pesos. */
  montoMinimo: number;
};

export type Permanencia = {
  entradaAt: Date;
  salidaAt: Date;
};

/**
 * Redondeo a peso entero. La fracción de minutos ya define la granularidad del
 * tiempo; esto solo resuelve el peso partido que queda al multiplicar.
 *
 * Se redondea al entero más cercano (no hacia arriba): a la salida el operador
 * cobra en efectivo, y medio peso a favor del local en cada salida no es una
 * decisión que corresponda tomar en silencio desde el código.
 */
function aPesosEnteros(monto: number): number {
  return Math.round(monto);
}

/**
 * Minutos efectivamente cobrados: la permanencia real redondeada HACIA ARRIBA
 * al siguiente múltiplo de `fraccionMinutos`.
 *
 * Hacia arriba porque la fracción es la unidad mínima de cobro: usar un minuto
 * de la fracción consume la fracción entera. Es la convención habitual de
 * estacionamientos y la que hace que `montoMinimo` tenga sentido.
 */
export function minutosCobrados(
  permanencia: Permanencia,
  fraccionMinutos: number,
): number {
  if (!Number.isFinite(fraccionMinutos) || fraccionMinutos <= 0) {
    throw new Error("fraccionMinutos debe ser un entero positivo.");
  }

  const ms = permanencia.salidaAt.getTime() - permanencia.entradaAt.getTime();
  if (Number.isNaN(ms)) {
    throw new Error("entradaAt y salidaAt deben ser fechas válidas.");
  }
  if (ms < 0) {
    throw new Error("salidaAt no puede ser anterior a entradaAt.");
  }

  const minutosReales = ms / 60_000;
  return Math.ceil(minutosReales / fraccionMinutos) * fraccionMinutos;
}

/**
 * Monto a cobrar, en pesos enteros.
 *
 * Nunca por debajo de `montoMinimo`: ese es el piso, incluso para una
 * permanencia de cero minutos.
 */
export function calcularMonto(
  permanencia: Permanencia,
  tarifa: ParametrosTarifa,
): number {
  const { valorHora, fraccionMinutos, montoMinimo } = tarifa;

  if (!Number.isFinite(valorHora) || valorHora < 0) {
    throw new Error("valorHora debe ser un número no negativo.");
  }
  if (!Number.isFinite(montoMinimo) || montoMinimo < 0) {
    throw new Error("montoMinimo debe ser un número no negativo.");
  }

  const minutos = minutosCobrados(permanencia, fraccionMinutos);
  const porTiempo = aPesosEnteros((minutos / 60) * valorHora);

  return Math.max(porTiempo, montoMinimo);
}
