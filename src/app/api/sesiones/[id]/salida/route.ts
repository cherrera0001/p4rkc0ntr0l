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
import { esIdValido } from "@/lib/frontera";
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

  if (!esIdValido(id)) {
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

    /**
     * **`estado = 'activa'` en el WHERE: es lo que hace que se cierre UNA vez.**
     * (AC-OP-5, `spec.md` §9.)
     *
     * Entre el SELECT de arriba (`:59`) y este UPDATE hay dos `await` más —la
     * tarifa vigente y el cálculo—, así que la ventana no es de microsegundos:
     * es un viaje de ida y vuelta a Railway. Dos toques en «Salida», o un
     * reintento de la cola con el primero en vuelo, la atraviesan.
     *
     * Reproducido antes de corregir, con ocho salidas simultáneas contra la API:
     *
     *     8 de 8 respuestas con yaCerrada:false · ocho salida_at distintos
     *
     * Las ocho escribieron, y la última pisó la hora y el monto de las anteriores.
     * El operador cobra en efectivo contra un número que la app ya cambió.
     *
     * **Por qué esto alcanza y no es solo achicar la ventana.** En READ
     * COMMITTED —el default— el segundo UPDATE se bloquea en el lock de fila del
     * primero y, al despertar, **re-evalúa su WHERE contra la versión nueva**.
     * Con `estado = 'activa'` la fila ya no matchea: cero filas. No hay orden de
     * intercalado que produzca dos cierres. La atomicidad la da la fila, no una
     * transacción — y por eso no se trae un primitivo que este repo no tiene.
     */
    const [cerrada] = await conBase(() =>
      db
        .update(sesionVehiculo)
        .set({ salidaAt, montoCalculado, estado: "cerrada", syncEstado: "sincronizada" })
        .where(
          and(
            eq(sesionVehiculo.id, id),
            eq(sesionVehiculo.estacionamientoId, operador.estacionamientoId),
            eq(sesionVehiculo.estado, "activa"),
          ),
        )
        .returning(COLUMNAS_SALIDA),
    );

    /**
     * Cero filas = otro pedido ganó la carrera mientras éste calculaba.
     *
     * Se relee y se responde igual que el camino de `:79`: **200 con
     * `yaCerrada:true`**, con el monto y la hora del ganador. No se inventa un
     * 409: para la cola local un 4xx es definitivo (`cola-local.ts:276-278`) y
     * el registro se borraría del dispositivo; y un 5xx haría reintentar en
     * bucle. El contrato idempotente que el cliente ya presupone se mantiene
     * exactamente igual — desde afuera, perder la carrera y llegar segundo por
     * una reconexión son el mismo evento.
     */
    if (!cerrada) {
      const [ganadora] = await conBase(() =>
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
      if (!ganadora) {
        return NextResponse.json({ error: "La sesión no existe." }, { status: 404 });
      }
      return NextResponse.json({ sesion: ganadora, yaCerrada: true });
    }

    return NextResponse.json({ sesion: cerrada, yaCerrada: false });
  } catch (error) {
    return respuestaDeFallo(`POST /api/sesiones/${id}/salida`, error);
  }
}
