/**
 * Reportes — maqueta `1g` del lienzo de Claude Design, veredicto **DENTRO**
 * (`docs/diseno-2026-08-12-traduccion.md:47`).
 *
 * *«Lo observado, período por período.»* Todo sale de `sesion_vehiculo`: §6 fija
 * que el panel del dueño no necesita tabla de agregados, y esto tampoco.
 *
 * ## Qué se tomó del diseño y qué no
 *
 * Se toma: el encabezado con su rango, las cuatro cifras del período, el gráfico
 * de sesiones por día y el panel de evidencia de H1.
 *
 * **No se toma, y hay que decir por qué:**
 *
 * - **«3 estacionamientos apilados»** en el gráfico. Eso es multisitio: un
 *   cliente con varios recintos. Fuera por ADR-001, mantenido fuera por ADR-004
 *   y hecho cumplir por `AC-SCOPE-4`. Acá el dueño tiene **un** recinto, así que
 *   la barra es una sola serie.
 * - **La exportación CSV.** `docs/diseno-2026-08-12-traduccion.md:272` la marca
 *   como frontera de dato personal: un CSV con `patente` saca el dato del sistema
 *   hacia el dispositivo del dueño, fuera de todo control de retención — que es
 *   justo lo que **INT-7 sigue sin resolver**. Su propia regla dice *«agregados
 *   sin patente, o no se construye hasta que `{{PLAZO_RETENCION_PATENTE}}` y
 *   `{{BASE_LICITUD}}` estén resueltos»*. Siguen sin resolver: no se construye.
 *
 * ## El «tecleo mediano» va vacío A PROPÓSITO, y el diseño lo pide así
 *
 * La maqueta muestra `—` con *«sin línea base»*, y el panel de H1 dice *«Sin
 * mediciones. H1 no está medido todavía»*. Es correcto y se respeta al pie de la
 * letra, por dos razones que no son la misma:
 *
 * 1. **Los umbrales no existen.** `{{UMBRAL_H1_SEGUNDOS}}` y
 *    `{{LINEA_BASE_CUADERNO_SEGUNDOS}}` siguen abiertos (`spec.md` §12). Medir no
 *    requiere umbral; **comparar sí**, y una cifra sola acá se leería como
 *    veredicto sobre H1.
 * 2. **La métrica de H1 tiene un solo dueño: `npm run verificar:h1`.** Calcular
 *    acá una segunda mediana crearía dos implementaciones de la misma métrica,
 *    y `AC-H1-2` —que exige que la expresión del código sea la que §6 declara—
 *    **está registrado NO VERIFICADO**. Duplicarla sería agregar una divergencia
 *    posible a un criterio que ya no se puede sostener.
 *
 * Además el instrumento separa tres poblaciones —real, banco y lo que dejan los
 * verificadores— y publicar acá una mediana sobre todo junto sería exactamente
 * el número plausible, reproducible y basura que el ledger ya documentó.
 */

import { and, count, eq, gte, sql, sum } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";

import { conBase, db, sesionVehiculo } from "@/db";
import { sesionActual } from "@/lib/auth";
import { obtenerEstacionamiento } from "@/lib/contexto";
import { destinoDe } from "@/lib/roles";
import { inicioDelDia, inicioHaceDias } from "@/lib/zona";
import Cabecera from "../../cabecera";
import CerrarSesion from "../../cerrar-sesion";

export const dynamic = "force-dynamic";

/**
 * Días del período. Siete, como la semana que muestra la maqueta.
 *
 * **No es un `{{placeholder}}`**: no es una decisión de negocio pendiente, es el
 * rango que el propio diseño dibuja. Si mañana hace falta elegirlo, eso sí es
 * una decisión y entra como tal.
 */
const DIAS = 7;

const pesos = (n: number) => `$ ${n.toLocaleString("es-CL")}`;

/** Minutos como «1 h 45» / «45 min». La misma forma que usa el temporizador. */
function comoDuracion(minutos: number): string {
  const m = Math.round(minutos);
  const h = Math.floor(m / 60);
  const resto = m % 60;
  if (h === 0) return `${resto} min`;
  return resto === 0 ? `${h} h` : `${h} h ${String(resto).padStart(2, "0")}`;
}

export default async function Reportes() {
  const usuario = await sesionActual();
  if (!usuario) redirect("/login");
  if (usuario.rol !== "dueño") redirect(destinoDe(usuario.rol));
  // La base garantiza `pertenencia_por_rol`; se comprueba igual, porque sin esto
  // la cláusula de aislamiento compararía contra null y el reporte mezclaría
  // clientes.
  if (usuario.estacionamientoId === null) redirect("/login");

  const est = await obtenerEstacionamiento(usuario.estacionamientoId);

  // El período va de la medianoche de hace 6 días hasta ahora: siete días
  // calendario incluyendo hoy, cortados en la zona del estacionamiento.
  const desde = inicioHaceDias(est.zonaHoraria, DIAS - 1);
  const hoy = inicioDelDia(est.zonaHoraria);

  const [agregado] = await conBase(() =>
    db
      .select({
        sesiones: count(),
        ingresos: sum(sesionVehiculo.montoCalculado),
        // Permanencia media en minutos. Derivable sin ningún campo nuevo:
        // `salida_at − entrada_at` sobre las cerradas del período.
        permanenciaMin: sql<
          number | null
        >`avg(extract(epoch from (${sesionVehiculo.salidaAt} - ${sesionVehiculo.entradaAt})) / 60)`,
      })
      .from(sesionVehiculo)
      .where(
        and(
          eq(sesionVehiculo.estacionamientoId, est.id),
          eq(sesionVehiculo.estado, "cerrada"),
          gte(sesionVehiculo.salidaAt, desde),
        ),
      ),
  );

  // Sesiones por día, agrupadas por la fecha local del estacionamiento — no por
  // la del servidor, que en Vercel es UTC.
  const filasPorDia = await conBase(() =>
    db
      .select({
        dia: sql<string>`to_char((${sesionVehiculo.salidaAt} AT TIME ZONE ${est.zonaHoraria})::date, 'YYYY-MM-DD')`,
        n: sql<number>`count(*)::int`,
      })
      .from(sesionVehiculo)
      .where(
        and(
          eq(sesionVehiculo.estacionamientoId, est.id),
          eq(sesionVehiculo.estado, "cerrada"),
          gte(sesionVehiculo.salidaAt, desde),
        ),
      )
      .groupBy(sql`1`),
  );

  const porDia = new Map(filasPorDia.map((f) => [f.dia, Number(f.n)]));

  // Los siete días del período, existan o no filas: un día sin salidas es un
  // dato —cero— y omitirlo del eje haría que la semana se lea más llena de lo
  // que estuvo.
  const dias = Array.from({ length: DIAS }, (_, i) => {
    const corte = inicioHaceDias(est.zonaHoraria, DIAS - 1 - i);
    const clave = new Intl.DateTimeFormat("en-CA", {
      timeZone: est.zonaHoraria,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(corte);
    const etiqueta = new Intl.DateTimeFormat("es-CL", {
      timeZone: est.zonaHoraria,
      weekday: "short",
    })
      .format(corte)
      .replace(".", "")
      .toUpperCase();
    return { clave, etiqueta, n: porDia.get(clave) ?? 0, esHoy: corte.getTime() === hoy.getTime() };
  });

  const sesiones = agregado?.sesiones ?? 0;
  const ingresos = Number(agregado?.ingresos ?? 0);
  const permanencia = agregado?.permanenciaMin === null ? null : Number(agregado?.permanenciaMin);
  const maximo = Math.max(1, ...dias.map((d) => d.n));

  const rango = `${new Intl.DateTimeFormat("es-CL", { timeZone: est.zonaHoraria, day: "numeric", month: "short" }).format(desde)} a ${new Intl.DateTimeFormat("es-CL", { timeZone: est.zonaHoraria, day: "numeric", month: "short" }).format(new Date())}`;

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <Cabecera contexto={est.nombre} titulo="Reportes" accion={<CerrarSesion />} />

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 p-4 pb-10">
        <header className="flex flex-col gap-2">
          <span className="eyebrow">Reportes</span>
          <h2 className="text-xl font-medium tracking-tight text-ink">
            Lo observado, período por período
          </h2>
          <p className="mono-caption" data-testid="rango">
            {rango}
          </p>
        </header>

        <section className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line">
          <div className="flex flex-col gap-1 bg-card p-4">
            <p className="mono-caption">Sesiones</p>
            <p data-testid="sesiones" className="text-xl font-medium tabular text-ink">
              {sesiones}
            </p>
            <p className="text-[0.6875rem] text-faint">salidas registradas</p>
          </div>

          <div className="flex flex-col gap-1 bg-card p-4">
            <p className="mono-caption">Ingresos obs.</p>
            <p data-testid="ingresos-periodo" className="text-xl font-medium tabular text-ink">
              {pesos(ingresos)}
            </p>
            <p className="text-[0.6875rem] text-faint">no recaudado: observado</p>
          </div>

          <div className="flex flex-col gap-1 bg-card p-4">
            <p className="mono-caption">Permanencia media</p>
            <p data-testid="permanencia" className="text-xl font-medium tabular text-ink">
              {permanencia === null ? "—" : comoDuracion(permanencia)}
            </p>
            <p className="text-[0.6875rem] text-faint">
              {permanencia === null ? "sin salidas en el período" : "salida menos entrada"}
            </p>
          </div>

          {/* Vacío a propósito — ver el encabezado del archivo. El diseño lo
              muestra así, y las dos razones son distintas: faltan los umbrales, y
              la métrica de H1 tiene un solo dueño, que es `verificar:h1`. */}
          <div className="flex flex-col gap-1 bg-card p-4">
            <p className="mono-caption">Tecleo mediano</p>
            <p data-testid="tecleo" className="text-xl font-medium tabular text-subtle">
              —
            </p>
            <p className="text-[0.6875rem] text-faint">sin línea base</p>
          </div>
        </section>

        <section className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4 shadow-xs">
          <h3 className="text-sm font-medium text-ink">Sesiones por día</h3>

          {sesiones === 0 ? (
            <p data-testid="sin-sesiones" className="text-xs leading-relaxed text-subtle">
              No hay salidas registradas en estos {DIAS} días. El gráfico aparece cuando
              el operador cierre la primera.
            </p>
          ) : (
            <ul data-testid="por-dia" className="flex h-32 items-end gap-1.5">
              {dias.map((d) => (
                <li key={d.clave} className="flex flex-1 flex-col items-center gap-1.5">
                  <span className="text-[0.625rem] tabular text-faint">{d.n || ""}</span>
                  <span
                    aria-hidden
                    data-dia={d.clave}
                    data-n={d.n}
                    className={`w-full rounded-t ${d.esHoy ? "bg-accent" : "bg-accent/35"}`}
                    style={{ height: `${Math.max(2, (d.n / maximo) * 100)}%` }}
                  />
                  <span className="mono-caption text-[0.5625rem]">{d.etiqueta}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Evidencia de H1 — el panel que la maqueta dibuja vacío, y con razón. */}
        <section className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-4 shadow-xs">
          <h3 className="text-sm font-medium text-ink">Evidencia de H1</h3>
          <p className="text-xs leading-relaxed text-subtle">
            La distribución del tiempo de tecleo se calcula con{" "}
            <code className="font-mono text-[0.6875rem]">tecleo_fin_at − tecleo_inicio_at</code>.
          </p>
          <div
            data-testid="h1-vacio"
            className="flex items-center justify-center rounded-xl border border-dashed border-line-strong bg-canvas p-5"
          >
            <p className="text-center text-xs leading-relaxed text-muted">
              Sin mediciones publicadas acá. H1 se mide con su propio instrumento, que
              separa la operación real del banco de prueba y{" "}
              <strong className="font-medium text-ink">falla si no hay muestra</strong>.
            </p>
          </div>
          <p className="text-[0.6875rem] leading-relaxed text-faint">
            No se publica un número sin su umbral: medir no requiere umbral, comparar sí.
          </p>
        </section>

        <Link
          href="/dueno"
          className="flex items-center gap-2 rounded-2xl border border-line bg-card p-4 text-sm font-medium text-ink shadow-xs"
        >
          <span aria-hidden className="text-subtle">
            ←
          </span>
          Volver al panel
        </Link>
      </main>
    </div>
  );
}
