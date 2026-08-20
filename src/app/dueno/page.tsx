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

import { and, count, eq, gte, sql, sum } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";

import { conBase, db, sesionVehiculo } from "@/db";
import { sesionActual } from "@/lib/auth";
import { destinoDe } from "@/lib/roles";
import { obtenerEstacionamiento } from "@/lib/contexto";
import { inicioDelDia } from "@/lib/zona";
import Cabecera from "../cabecera";
import CerrarSesion from "../cerrar-sesion";
import Descuadre from "./descuadre";
import IngresosPorHora from "./ingresos-por-hora";

export const dynamic = "force-dynamic";

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

  // Ingresos por hora del día, en la zona del estacionamiento (data-driven, el
  // gráfico del diseño 1n). La hora se extrae de `salida_at` convertida a la zona
  // local: el corte y la agrupación usan la misma referencia horaria que el resto
  // del panel, no la del servidor.
  const filasPorHora = await conBase(() =>
    db
      .select({
        hora: sql<number>`date_part('hour', ${sesionVehiculo.salidaAt} AT TIME ZONE ${est.zonaHoraria})::int`,
        monto: sql<number>`coalesce(sum(${sesionVehiculo.montoCalculado}), 0)::int`,
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
  const porHora = new Map(filasPorHora.map((f) => [Number(f.hora), Number(f.monto)]));

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

      <IngresosPorHora porHora={porHora} />

      {/* Maqueta `1g`: el panel muestra HOY; los reportes muestran el período. */}
      <Link
        href="/dueno/reportes"
        className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-card p-4 shadow-xs"
      >
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-ink">Reportes</span>
          <span className="text-xs text-subtle">Lo observado, período por período</span>
        </span>
        <span aria-hidden className="text-subtle">
          →
        </span>
      </Link>

      {/* Los tres valores con que se calcula cada monto son datos que carga el
          dueño (spec.md §4), y hasta ahora no tenía por dónde. Maqueta `1e`. */}
      <Link
        href="/dueno/tarifas"
        className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-card p-4 shadow-xs"
      >
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-ink">Tarifas</span>
          <span className="text-xs text-subtle">
            Los valores con que el sistema calcula cada cobro
          </span>
        </span>
        <span aria-hidden className="text-subtle">
          →
        </span>
      </Link>

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
