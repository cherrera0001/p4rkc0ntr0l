/**
 * Cortes de día en la zona horaria del estacionamiento.
 *
 * ## Por qué existe este módulo
 *
 * Estas dos funciones vivían privadas dentro de `src/app/dueno/page.tsx`. La
 * pantalla de reportes necesita exactamente el mismo corte —y con el mismo
 * criterio, o dos pantallas del mismo dueño mostrarían días distintos—, así que
 * la segunda copia habría sido la primera oportunidad de que una quedara vieja.
 *
 * ## El defecto que estas funciones corrigen, y que hay que no reintroducir
 *
 * **El corte del día usa la zona del estacionamiento, no la del servidor.**
 * (Hallazgo crítico del experto de frontend del concilio.) La versión anterior
 * sacaba el offset de `new Date(...).getTimezoneOffset()`, que es el **del
 * proceso**: en Vercel —UTC— el «ingresos de hoy» de un estacionamiento en
 * Santiago se cortaba a las 20:00 hora local, no a medianoche. Medido: desfase
 * de −4 h en Santiago, −6 h en Pascua, +2 h en Madrid.
 *
 * Y con multicliente cada cliente elige su zona (ADR-005), así que el desfase
 * dejó de ser un borde y pasó a ser **por cliente**.
 */

/**
 * Minutos que una zona horaria adelanta a UTC en un instante dado.
 *
 * Se deriva formateando el instante EN LA ZONA y restándolo del mismo instante
 * en UTC. No usa `getTimezoneOffset()`, que devuelve el offset del proceso.
 */
export function offsetMinutos(zona: string, instante: Date): number {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: zona,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
    .formatToParts(instante)
    .reduce<Record<string, number>>((a, x) => {
      if (x.type !== "literal") a[x.type] = Number(x.value);
      return a;
    }, {});
  const comoUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second);
  return Math.round((comoUTC - instante.getTime()) / 60_000);
}

/**
 * Medianoche del día de `referencia` en la zona dada, como instante UTC.
 *
 * El offset se recalcula **sobre la medianoche candidata**, no sobre el instante
 * de referencia: es lo que clava el borde correcto aun cerca de un cambio de
 * hora de verano.
 */
export function inicioDelDia(zonaHoraria: string, referencia: Date = new Date()): Date {
  const [anio, mes, dia] = new Intl.DateTimeFormat("en-CA", {
    timeZone: zonaHoraria,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(referencia)
    .split("-")
    .map(Number);

  const ingenua = Date.UTC(anio, mes - 1, dia, 0, 0, 0);
  const off = offsetMinutos(zonaHoraria, new Date(ingenua));
  return new Date(ingenua - off * 60_000);
}

/**
 * Medianoche de hace `dias` días, en la zona del estacionamiento.
 *
 * Se resta sobre el **calendario local** —no 24 h × N milisegundos— porque un
 * día con cambio de hora dura 23 o 25 horas, y restar milisegundos correría el
 * corte una hora justo en la semana que el dueño mira.
 */
export function inicioHaceDias(zonaHoraria: string, dias: number, referencia: Date = new Date()): Date {
  const hoy = inicioDelDia(zonaHoraria, referencia);
  // Se retrocede con holgura y se vuelve a cortar: el segundo corte resuelve el
  // offset del día destino, no el del día de hoy.
  const aproximado = new Date(hoy.getTime() - dias * 24 * 60 * 60_000);
  return inicioDelDia(zonaHoraria, aproximado);
}
