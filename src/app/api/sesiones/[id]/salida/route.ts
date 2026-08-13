/**
 * Salida de una sesión y cálculo del monto (spec.md §5).
 *
 * El monto se calcula en el servidor con la tarifa vigente, no en el cliente:
 * el cliente puede tener una tarifa desactualizada tras estar sin red.
 *
 * El cobro es en efectivo y fuera del sistema (ADR-001). Esto devuelve el monto
 * para que el operador lo cobre; no registra ningún movimiento de dinero.
 */

import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { conBase, db, sesionVehiculo } from "@/db";
import { exigirRol } from "@/lib/auth";
import { obtenerTarifaVigente } from "@/lib/contexto";
import {
  noAutorizado,
  origenAjeno,
  origenPropio,
  respuestaDeFallo,
} from "@/lib/peticion";
import { calcularMonto } from "@/lib/tarificacion";
import { entradaFacturable, montoAlmacenable } from "@/lib/tiempo";

export const dynamic = "force-dynamic";

/** Lo que el cliente necesita de una salida. Nada más (minimización, §7). */
const COLUMNAS_SALIDA = {
  id: sesionVehiculo.id,
  patente: sesionVehiculo.patente,
  entradaAt: sesionVehiculo.entradaAt,
  salidaAt: sesionVehiculo.salidaAt,
  montoCalculado: sesionVehiculo.montoCalculado,
  estado: sesionVehiculo.estado,
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!origenPropio(request)) return origenAjeno();

  const operador = await exigirRol("operador");
  if (!operador) return noAutorizado();

  const { id } = await params;

  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Id de sesión inválido." }, { status: 400 });
  }

  try {
    // **Pertenencia, no solo rol** (hallazgo M-1). Antes se comprobaba que
    // quien pedía fuera operador y después se buscaba la sesión por id a secas:
    // cualquier operador podía cerrar la sesión de cualquier estacionamiento con
    // solo conocer su id. El POST de ingreso ya derivaba el estacionamiento del
    // usuario autenticado; esta ruta no.
    const [sesion] = await conBase(() =>
      db
        .select(COLUMNAS_SALIDA)
        .from(sesionVehiculo)
        .where(
          and(
            eq(sesionVehiculo.id, id),
            eq(sesionVehiculo.estacionamientoId, operador.estacionamientoId),
          ),
        ),
    );

    // Un id de otro estacionamiento responde igual que un id inexistente: la
    // diferencia entre "no existe" y "no es tuyo" ya es información.
    if (!sesion) {
      return NextResponse.json({ error: "La sesión no existe." }, { status: 404 });
    }

    // Cerrar dos veces devuelve lo mismo: el operador puede tocar "Salida" de
    // nuevo tras una reconexión sin que el monto cambie.
    if (sesion.estado === "cerrada") {
      return NextResponse.json({ sesion, yaCerrada: true });
    }

    const salidaAt = new Date();
    const tarifa = await obtenerTarifaVigente(operador.estacionamientoId, salidaAt);

    /**
     * Entrada acotada al rango facturable (hallazgo INT-14).
     *
     * `calcularMonto` lanza si la entrada es posterior a la salida, y esta ruta
     * no capturaba nada: una sesión con `entradaAt` en el futuro —un teléfono
     * con el reloj adelantado— daba 500 en cada intento y **no había forma de
     * cerrarla desde la interfaz**. El vehículo no podía irse y su patente
     * quedaba retenida para siempre en la base y en el dispositivo, reabriendo
     * M-4 por una puerta que la corrección de M-4 no puede cerrar.
     *
     * El ingreso ya se sanea al entrar, así que esto cubre las filas que
     * quedaron escritas antes de aquella corrección.
     */
    const entrada = entradaFacturable(sesion.entradaAt, salidaAt);

    const montoCalculado = montoAlmacenable(
      calcularMonto(
        { entradaAt: entrada, salidaAt },
        {
          valorHora: tarifa.valorHora,
          fraccionMinutos: tarifa.fraccionMinutos,
          montoMinimo: tarifa.montoMinimo,
        },
      ),
    );

    const [cerrada] = await conBase(() =>
      db
        .update(sesionVehiculo)
        .set({ salidaAt, montoCalculado, estado: "cerrada", syncEstado: "sincronizada" })
        .where(
          and(
            eq(sesionVehiculo.id, id),
            eq(sesionVehiculo.estacionamientoId, operador.estacionamientoId),
          ),
        )
        .returning(COLUMNAS_SALIDA),
    );

    return NextResponse.json({ sesion: cerrada, yaCerrada: false });
  } catch (error) {
    return respuestaDeFallo(`POST /api/sesiones/${id}/salida`, error);
  }
}
