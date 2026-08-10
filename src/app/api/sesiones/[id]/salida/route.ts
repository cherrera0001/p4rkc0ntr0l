/**
 * Salida de una sesión y cálculo del monto (spec.md §5).
 *
 * El monto se calcula en el servidor con la tarifa vigente, no en el cliente:
 * el cliente puede tener una tarifa desactualizada tras estar sin red.
 *
 * El cobro es en efectivo y fuera del sistema (ADR-001). Esto devuelve el monto
 * para que el operador lo cobre; no registra ningún movimiento de dinero.
 */

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db, sesionVehiculo } from "@/db";
import { exigirRol } from "@/lib/auth";
import { obtenerTarifaVigente } from "@/lib/contexto";
import { calcularMonto } from "@/lib/tarificacion";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await exigirRol("operador"))) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { id } = await params;

  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Id de sesión inválido." }, { status: 400 });
  }

  const [sesion] = await db.select().from(sesionVehiculo).where(eq(sesionVehiculo.id, id));

  if (!sesion) {
    return NextResponse.json({ error: "La sesión no existe." }, { status: 404 });
  }

  // Cerrar dos veces devuelve lo mismo: el operador puede tocar "Salida" de
  // nuevo tras una reconexión sin que el monto cambie.
  if (sesion.estado === "cerrada") {
    return NextResponse.json({ sesion, yaCerrada: true });
  }

  const salidaAt = new Date();
  const tarifa = await obtenerTarifaVigente(sesion.estacionamientoId, salidaAt);

  const montoCalculado = calcularMonto(
    { entradaAt: sesion.entradaAt, salidaAt },
    {
      valorHora: tarifa.valorHora,
      fraccionMinutos: tarifa.fraccionMinutos,
      montoMinimo: tarifa.montoMinimo,
    },
  );

  const [cerrada] = await db
    .update(sesionVehiculo)
    .set({ salidaAt, montoCalculado, estado: "cerrada", syncEstado: "sincronizada" })
    .where(eq(sesionVehiculo.id, id))
    .returning();

  return NextResponse.json({ sesion: cerrada, yaCerrada: false });
}
