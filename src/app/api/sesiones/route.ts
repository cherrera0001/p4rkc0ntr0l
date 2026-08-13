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

import { conBase, db, sesionVehiculo } from "@/db";
import { exigirRol } from "@/lib/auth";
import { operacionRealHabilitada } from "@/lib/env";
import { ErrorBaseDatos } from "@/lib/errores";
import { esPatenteFixture } from "@/lib/fixtures";
import { validarPatente } from "@/lib/patente";
import {
  noAutorizado,
  origenAjeno,
  origenPropio,
  respuestaDeFallo,
} from "@/lib/peticion";
import { sanearIngreso } from "@/lib/tiempo";

export const dynamic = "force-dynamic";

/**
 * Sesiones activas del estacionamiento del operador, más antigua primero.
 *
 * **Solo el operador, y solo tres columnas** (hallazgo INT-4). Antes esto era
 * `select()` —todas las columnas— y lo podía llamar también el `dueño`. Las dos
 * cosas eran exposición sin propósito:
 *
 *  - el cliente consume `id`, `patente` y `entradaAt`, y nada más; `operadorId`,
 *    los instantes de tecleo y `syncEstado` viajaban de puro reflejo, contra la
 *    minimización de spec.md §7;
 *  - el panel del dueño trabaja con `count()` y `sum()`: nunca necesitó la lista
 *    de patentes. Era un permiso concedido sin caso de uso.
 */
export async function GET() {
  const operador = await exigirRol("operador");
  if (!operador) return noAutorizado();

  try {
    const activas = await conBase(() =>
      db
        .select({
          id: sesionVehiculo.id,
          patente: sesionVehiculo.patente,
          entradaAt: sesionVehiculo.entradaAt,
        })
        .from(sesionVehiculo)
        .where(
          and(
            // Del usuario autenticado, no de la primera fila de la tabla (M-2).
            eq(sesionVehiculo.estacionamientoId, operador.estacionamientoId),
            eq(sesionVehiculo.estado, "activa"),
          ),
        )
        .orderBy(asc(sesionVehiculo.entradaAt)),
    );

    return NextResponse.json({ sesiones: activas });
  } catch (error) {
    return respuestaDeFallo("GET /api/sesiones", error);
  }
}

function fechaValida(valor: unknown): Date | null {
  if (typeof valor !== "string") return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function POST(request: Request) {
  if (!origenPropio(request)) return origenAjeno();

  // Solo el operador registra ingresos. El dueño observa, no opera.
  const operador = await exigirRol("operador");
  if (!operador) return noAutorizado();

  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido." }, { status: 400 });
  }

  const { id, patente, entradaAt, tecleoInicioAt, tecleoFinAt, clienteAhora } = (cuerpo ??
    {}) as Record<string, unknown>;

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

  /**
   * Saneo del reloj del cliente (hallazgo INT-14).
   *
   * Se corrige, no se rechaza. Un 400 acá sería un rechazo definitivo para la
   * cola local, que borraría el ingreso del dispositivo: un reloj mal puesto
   * convertiría cada registro hecho sin red en un registro perdido. Ver el
   * razonamiento completo en `lib/tiempo.ts`.
   */
  const saneado = sanearIngreso(
    { entradaAt: entrada, tecleoInicioAt: inicio, tecleoFinAt: fin },
    fechaValida(clienteAhora),
    new Date(),
  );

  if (saneado.desfaseMs !== 0 || saneado.acotada) {
    console.warn(
      `POST /api/sesiones: reloj del cliente corregido en ${saneado.desfaseMs} ms` +
        `${saneado.acotada ? " (y la entrada se acotó al rango facturable)" : ""}.`,
    );
  }

  try {
    const [creada] = await conBase(() =>
      db
        .insert(sesionVehiculo)
        .values({
          id,
          // Del usuario autenticado, no del cuerpo: el cliente no elige a nombre
          // de quién queda registrada la sesión.
          estacionamientoId: operador.estacionamientoId,
          operadorId: operador.id,
          patente: validacion.patente,
          entradaAt: saneado.entradaAt,
          tecleoInicioAt: saneado.tecleoInicioAt,
          tecleoFinAt: saneado.tecleoFinAt,
          estado: "activa",
          // Llegó al servidor: por definición ya no es solo local.
          syncEstado: "sincronizada",
        })
        .onConflictDoNothing({ target: sesionVehiculo.id })
        .returning({
          id: sesionVehiculo.id,
          patente: sesionVehiculo.patente,
          entradaAt: sesionVehiculo.entradaAt,
        }),
    );

    if (creada) {
      return NextResponse.json({ sesion: creada, duplicada: false }, { status: 201 });
    }

    // Ya existía: el reintento de sincronización es un no-op, no un error.
    //
    // La relectura se acota al estacionamiento del operador y devuelve las
    // mismas tres columnas que el alta (hallazgo B-3): antes esta rama devolvía
    // la fila completa —patente incluida— para cualquier id que existiera, o
    // sea una lectura de dato personal por una ruta de escritura. Exige adivinar
    // un UUIDv4, así que el riesgo práctico era nulo; el arreglo también.
    const [existente] = await conBase(() =>
      db
        .select({
          id: sesionVehiculo.id,
          patente: sesionVehiculo.patente,
          entradaAt: sesionVehiculo.entradaAt,
        })
        .from(sesionVehiculo)
        .where(
          and(
            eq(sesionVehiculo.id, id),
            eq(sesionVehiculo.estacionamientoId, operador.estacionamientoId),
          ),
        ),
    );

    if (!existente) {
      // El id existe pero es de otro estacionamiento. Ni se confirma ni se
      // niega: el operador no tiene por qué saber nada de esa sesión.
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }

    return NextResponse.json({ sesion: existente, duplicada: true }, { status: 200 });
  } catch (error) {
    /**
     * El vehículo ya está adentro (hallazgo INT-15, cara de servidor).
     *
     * El índice único parcial `sesion_vehiculo_activa_unica` impide dos sesiones
     * activas para la misma patente. Sin este manejo, el doble toque en
     * "Confirmar" —que es lo que el índice existe para atajar— produciría un
     * 23505, y de ahí un 503: la cola local reintentaría para siempre un
     * registro que la base nunca va a aceptar.
     *
     * Se responde 200 con `duplicada`, igual que el reintento por `id`: para el
     * cliente es lo mismo, "esto ya está registrado, seguí". El vehículo no se
     * pierde —la sesión buena existe y el próximo `GET` la trae—, y el registro
     * sobrante se suelta solo en la siguiente reconciliación.
     */
    if (error instanceof ErrorBaseDatos && error.codigo === "23505") {
      const [activa] = await conBase(() =>
        db
          .select({
            id: sesionVehiculo.id,
            patente: sesionVehiculo.patente,
            entradaAt: sesionVehiculo.entradaAt,
          })
          .from(sesionVehiculo)
          .where(
            and(
              eq(sesionVehiculo.estacionamientoId, operador.estacionamientoId),
              eq(sesionVehiculo.patente, validacion.patente),
              eq(sesionVehiculo.estado, "activa"),
            ),
          ),
      ).catch(() => []);

      return NextResponse.json(
        { sesion: activa ?? null, duplicada: true, motivo: "patente-ya-activa" },
        { status: 200 },
      );
    }

    return respuestaDeFallo("POST /api/sesiones", error);
  }
}
