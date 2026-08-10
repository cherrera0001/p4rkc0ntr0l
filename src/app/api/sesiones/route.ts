/**
 * Sesiones de vehículo — ingreso y listado (spec.md §5).
 *
 * El ingreso es idempotente por diseño: el cliente genera el `id` antes de
 * guardar en IndexedDB y lo manda al sincronizar. Si la red se cortó justo
 * después de que el servidor insertó, el reintento no duplica la sesión. Sin
 * esto, offline-first produce sesiones fantasma en cada reconexión inestable.
 */

import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db, sesionVehiculo } from "@/db";
import { exigirRol } from "@/lib/auth";
import { obtenerEstacionamiento } from "@/lib/contexto";
import { operacionRealHabilitada } from "@/lib/env";
import { esPatenteFixture } from "@/lib/fixtures";
import { validarPatente } from "@/lib/patente";

export const dynamic = "force-dynamic";

const noAutorizado = () =>
  NextResponse.json({ error: "No autorizado." }, { status: 401 });

/** Sesiones activas del estacionamiento, más antigua primero. */
export async function GET() {
  if (!(await exigirRol("operador", "dueño"))) return noAutorizado();

  const est = await obtenerEstacionamiento();

  const activas = await db
    .select()
    .from(sesionVehiculo)
    .where(
      and(
        eq(sesionVehiculo.estacionamientoId, est.id),
        eq(sesionVehiculo.estado, "activa"),
      ),
    )
    .orderBy(asc(sesionVehiculo.entradaAt));

  return NextResponse.json({ sesiones: activas });
}

function fechaValida(valor: unknown): Date | null {
  if (typeof valor !== "string") return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function POST(request: Request) {
  // Solo el operador registra ingresos. El dueño observa, no opera.
  const operador = await exigirRol("operador");
  if (!operador) return noAutorizado();

  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido." }, { status: 400 });
  }

  const { id, patente, entradaAt, tecleoInicioAt, tecleoFinAt } = (cuerpo ?? {}) as Record<
    string,
    unknown
  >;

  // Validación de frontera: la patente es dato personal (spec.md §7).
  const validacion = validarPatente(patente);
  if (!validacion.valida) {
    return NextResponse.json({ error: validacion.motivo }, { status: 400 });
  }

  // Barrera de cumplimiento, SEGUNDA línea. La primera está en el cliente, antes
  // de escribir en IndexedDB: rechazar acá solo evitaba la persistencia en la
  // base, no la recolección en el dispositivo (hallazgo A-3). Esta se mantiene
  // porque una barrera de cliente sola es eludible.
  if (!operacionRealHabilitada() && !esPatenteFixture(validacion.patente)) {
    return NextResponse.json(
      {
        error:
          "El piloto solo acepta patentes de prueba. Operar con patentes reales " +
          "exige definir antes la base de licitud y el plazo de retención " +
          "(Ley 21.719). Ver spec.md §4 y §12.",
        modo: "piloto",
      },
      { status: 403 },
    );
  }

  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Falta un id válido (uuid)." }, { status: 400 });
  }

  const entrada = fechaValida(entradaAt);
  const inicio = fechaValida(tecleoInicioAt);
  const fin = fechaValida(tecleoFinAt);

  // AC-MEAS-1: sin ambos timestamps de tecleo la sesión no aporta evidencia
  // sobre H1, así que no se acepta. La medición es parte del producto (§6).
  if (!entrada || !inicio || !fin) {
    return NextResponse.json(
      { error: "Faltan entradaAt, tecleoInicioAt o tecleoFinAt, o no son fechas válidas." },
      { status: 400 },
    );
  }
  if (fin < inicio) {
    return NextResponse.json(
      { error: "tecleoFinAt no puede ser anterior a tecleoInicioAt." },
      { status: 400 },
    );
  }

  const [creada] = await db
    .insert(sesionVehiculo)
    .values({
      id,
      // Del usuario autenticado, no del cuerpo: el cliente no elige a nombre de
      // quién queda registrada la sesión.
      estacionamientoId: operador.estacionamientoId,
      operadorId: operador.id,
      patente: validacion.patente,
      entradaAt: entrada,
      tecleoInicioAt: inicio,
      tecleoFinAt: fin,
      estado: "activa",
      // Llegó al servidor: por definición ya no es solo local.
      syncEstado: "sincronizada",
    })
    .onConflictDoNothing({ target: sesionVehiculo.id })
    .returning();

  if (creada) {
    return NextResponse.json({ sesion: creada, duplicada: false }, { status: 201 });
  }

  // Ya existía: el reintento de sincronización es un no-op, no un error.
  const [existente] = await db
    .select()
    .from(sesionVehiculo)
    .where(eq(sesionVehiculo.id, id));

  return NextResponse.json({ sesion: existente, duplicada: true }, { status: 200 });
}
