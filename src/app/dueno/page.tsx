/**
 * Panel del dueño — spec.md §6 (AC-MEAS-2).
 *
 * Responde H2: mostrar ocupación e ingresos que hoy el dueño no puede verificar.
 * Todo sale de `sesion_vehiculo`; no hay tabla de agregados, tal como fija §6.
 *
 * Los ingresos son OBSERVADOS, no recaudados: el cobro es en efectivo y fuera
 * del sistema (ADR-001). La diferencia entre lo observado y lo que el dueño
 * cuenta en caja es justamente la señal que el panel busca hacer visible.
 */

import { and, count, eq, gte, sum } from "drizzle-orm";
import { redirect } from "next/navigation";

import { conBase, db, sesionVehiculo } from "@/db";
import { sesionActual } from "@/lib/auth";
import { destinoDe } from "@/lib/roles";
import { obtenerEstacionamiento } from "@/lib/contexto";
import Cabecera from "../cabecera";
import CerrarSesion from "../cerrar-sesion";
import Descuadre from "./descuadre";

export const dynamic = "force-dynamic";

/**
 * Minutos que una zona horaria adelanta a UTC en un instante dado.
 *
 * Se deriva formateando el instante EN LA ZONA y restándolo del mismo instante
 * en UTC. No usa `getTimezoneOffset()`, que devuelve el offset **del proceso** —y
 * Vercel corre en UTC—, no el de la zona que se pide.
 */
function offsetMinutos(zona: string, instante: Date): number {
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
 * Medianoche de HOY en la zona del estacionamiento, como instante UTC.
 *
 * **El corte del día del dueño usa la zona del estacionamiento, no la del
 * servidor.** (Hallazgo crítico del experto de frontend del concilio.) La versión
 * anterior sacaba el offset de `new Date(...).getTimezoneOffset()`, que es el del
 * proceso: en Vercel —UTC— el «ingresos de hoy» de un estacionamiento en Santiago
 * se cortaba a las 20:00 hora local, no a medianoche. Medido: desfase de −4 h en
 * Santiago, −6 h en Pascua, +2 h en Madrid. `verificar:meas2` no lo veía porque
 * la máquina de desarrollo está en la misma zona que el fixture.
 *
 * Y con multicliente cada cliente elige su zona (ADR-005), así que el desfase
 * dejó de ser un borde y pasó a ser por cliente.
 */
function inicioDelDia(zonaHoraria: string): Date {
  const ahora = new Date();
  const [anio, mes, dia] = new Intl.DateTimeFormat("en-CA", {
    timeZone: zonaHoraria,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(ahora)
    .split("-")
    .map(Number);

  // La medianoche local, tratada primero como si fuera UTC, y después corrida por
  // el offset real de la zona en ese instante. Se recalcula el offset sobre la
  // medianoche candidata para clavar el borde correcto aun cerca de un cambio de
  // hora de verano.
  const ingenua = Date.UTC(anio, mes - 1, dia, 0, 0, 0);
  const off = offsetMinutos(zonaHoraria, new Date(ingenua));
  return new Date(ingenua - off * 60_000);
}

export default async function PanelDueno() {
  const usuario = await sesionActual();
  if (!usuario) redirect("/login");
  if (usuario.rol !== "dueño") redirect(destinoDe(usuario.rol));
  // La base garantiza que un rol de recinto tiene estacionamiento
  // (pertenencia_por_rol). Se comprueba igual: sin esto el filtro de aislamiento
  // compararia contra null y el panel mostraria datos de todos los clientes.
  if (usuario.estacionamientoId === null) redirect("/login");

  // El estacionamiento del dueño autenticado, no la primera fila de la tabla
  // (hallazgo M-2). Con un solo estacionamiento sembrado daban lo mismo, y esa
  // coincidencia era toda la separación que había.
  const est = await obtenerEstacionamiento(usuario.estacionamientoId);
  const desde = inicioDelDia(est.zonaHoraria);

  const [{ activas }] = await conBase(() =>
    db
      .select({ activas: count() })
      .from(sesionVehiculo)
      .where(
        and(
          eq(sesionVehiculo.estacionamientoId, est.id),
          eq(sesionVehiculo.estado, "activa"),
        ),
      ),
  );

  const [agregado] = await conBase(() =>
    db
      .select({ cerradas: count(), ingresos: sum(sesionVehiculo.montoCalculado) })
      .from(sesionVehiculo)
      .where(
        and(
          eq(sesionVehiculo.estacionamientoId, est.id),
          eq(sesionVehiculo.estado, "cerrada"),
          gte(sesionVehiculo.salidaAt, desde),
        ),
      ),
  );

  const ingresos = Number(agregado?.ingresos ?? 0);
  const cerradasHoy = agregado?.cerradas ?? 0;
  const libres = est.capacidadTotal - activas;

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <Cabecera contexto={`${est.nombre} · hoy`} titulo="Panel" accion={<CerrarSesion />} />

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 p-4 pb-10">
      <section className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1 rounded-2xl border border-line bg-card p-4 shadow-xs">
          <p className="text-[0.6875rem] font-semibold tracking-[0.16em] text-muted uppercase">
            Ocupación ahora
          </p>
          <p data-testid="ocupacion" className="cifra tabular">
            {activas}
          </p>
          <p className="text-xs text-faint tabular">
            de {est.capacidadTotal} · {libres} libres
          </p>
        </div>

        <div className="flex flex-col gap-1 rounded-2xl border border-line bg-card p-4 shadow-xs">
          <p className="text-[0.6875rem] font-semibold tracking-[0.16em] text-muted uppercase">
            Ingresos observados hoy
          </p>
          <p data-testid="ingresos" className="cifra tabular text-[2rem] leading-10">
            $ {ingresos.toLocaleString("es-CL")}
          </p>
          <p className="text-xs text-faint tabular">
            <span data-testid="cerradas">{cerradasHoy}</span> salidas registradas
          </p>
        </div>
      </section>

      <Descuadre ocupacionRegistrada={activas} />

      <p className="text-xs leading-relaxed text-subtle">
        Los ingresos son los <strong className="font-semibold text-muted">observados
        por el sistema</strong>: la suma de lo que se calculó al registrar cada
        salida. El cobro es en efectivo y ocurre fuera del sistema, así que esta
        cifra es la referencia contra la cual comparar la caja, no un registro de
        lo recaudado.
      </p>
      </main>
    </div>
  );
}
