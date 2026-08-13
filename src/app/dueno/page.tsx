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
import { obtenerEstacionamiento } from "@/lib/contexto";
import CerrarSesion from "../cerrar-sesion";
import Descuadre from "./descuadre";

export const dynamic = "force-dynamic";

function inicioDelDia(zonaHoraria: string): Date {
  const ahora = new Date();
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: zonaHoraria,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ahora);
  // Medianoche local del estacionamiento, no del servidor: un servidor en UTC
  // cortaría el día del operador a las 21:00.
  const offsetMin = -new Date(`${partes}T00:00:00`).getTimezoneOffset();
  const utc = new Date(`${partes}T00:00:00Z`);
  return new Date(utc.getTime() - offsetMin * 60_000);
}

export default async function PanelDueno() {
  const usuario = await sesionActual();
  if (!usuario) redirect("/login");
  if (usuario.rol !== "dueño") redirect("/");

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
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 p-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Panel</h1>
          <span className="text-xs text-slate-500">{est.nombre}</span>
        </div>
        <CerrarSesion />
      </header>

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-medium text-slate-500">Ocupación ahora</p>
          <p data-testid="ocupacion" className="text-3xl font-semibold">
            {activas}
          </p>
          <p className="text-xs text-slate-500">
            de {est.capacidadTotal} · {libres} libres
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-medium text-slate-500">Ingresos observados hoy</p>
          <p data-testid="ingresos" className="text-3xl font-semibold">
            $ {ingresos.toLocaleString("es-CL")}
          </p>
          <p className="text-xs text-slate-500">
            <span data-testid="cerradas">{cerradasHoy}</span> salidas registradas
          </p>
        </div>
      </section>

      <Descuadre ocupacionRegistrada={activas} />

      <p className="text-xs text-slate-500">
        Los ingresos son los <strong>observados por el sistema</strong>: la suma de
        lo que se calculó al registrar cada salida. El cobro es en efectivo y
        ocurre fuera del sistema, así que esta cifra es la referencia contra la
        cual comparar la caja, no un registro de lo recaudado.
      </p>
    </main>
  );
}
