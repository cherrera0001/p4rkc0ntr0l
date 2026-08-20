/**
 * Nueva versión de tarifa — maqueta `1e`, veredicto **DENTRO**
 * (`docs/diseno-2026-08-12-traduccion.md:45`).
 *
 * ## Qué reemplaza
 *
 * Hasta hoy los tres valores con que el sistema calcula el cobro solo se podían
 * cargar de dos formas: en el alta del cliente, o con `DATABASE_URL` en la mano.
 * `spec.md` §4 dice que son **datos de operación que carga el dueño**, y
 * `src/db/schema.ts` lo repite — pero el dueño no tenía por dónde. Es el mismo
 * hueco que ADR-005 cerró para el alta, un nivel más abajo.
 *
 * ## Versiona, no pisa — AC-UX-6
 *
 * *«Cambiar una tarifa crea una versión nueva con su `vigente_desde`. Las
 * sesiones ya cerradas conservan el valor con que se calcularon.»* Por eso acá
 * hay un **INSERT y nunca un UPDATE**: `obtenerTarifaVigente` ya resuelve la más
 * reciente cuya vigencia empezó (`src/lib/contexto.ts:57`), y el histórico es lo
 * que permite recalcular una salida vieja con la tarifa que regía entonces.
 *
 * Un UPDATE habría sido más corto y habría roto esa promesa en silencio.
 *
 * ## Lo que esta ruta NO hace, y no es olvido
 *
 * No borra ni edita versiones anteriores: el histórico es el mecanismo, no un
 * registro accesorio. No acepta tramos horarios, tarifa nocturna ni de fin de
 * semana —la propia maqueta lo dice y tiene razón: `spec.md` §4 define **tres**
 * valores y `AC-OP-2` prueba ese cálculo; agregar tramos rompe esa prueba y
 * necesita su propio ADR—.
 *
 * ## Rol
 *
 * `dueño`, no `plataforma`. La tarifa es del cliente, no de C4A:
 * `docs/SPEC-005-panel-de-administracion.md` §3.2 excluye explícitamente la
 * edición de tarifas desde plataforma.
 */

import { NextResponse } from "next/server";

import { conBase, db, tarifa } from "@/db";
import { enteroDeFrontera } from "@/lib/frontera";
import { rutaAutenticada } from "@/lib/peticion";

export const dynamic = "force-dynamic";

export const POST = rutaAutenticada<unknown, "dueño">(
  { rol: "dueño", exigirOrigen: true },
  async ({ sesion, request }) => {
    let cuerpo: unknown;
    try {
      cuerpo = await request.json();
    } catch {
      return NextResponse.json({ error: "Cuerpo JSON inválido." }, { status: 400 });
    }

    const c = (cuerpo ?? {}) as Record<string, unknown>;

    // Los mismos rangos que valida el alta de cliente, por la misma razón: son
    // las cotas que la base acepta y que el cálculo no desborda.
    const valorHora = enteroDeFrontera(c.valorHora, 0, 100_000_000);
    const fraccionMinutos = enteroDeFrontera(c.fraccionMinutos, 1, 1440);
    const montoMinimo = enteroDeFrontera(c.montoMinimo, 0, 100_000_000);

    // Se reportan todos los campos inválidos, no el primero: lo llena una
    // persona en un formulario, y un error por vez son N viajes para N problemas
    // (misma decisión que `api/plataforma/clientes`).
    const faltan = Object.entries({ valorHora, fraccionMinutos, montoMinimo })
      .filter(([, v]) => v === null)
      .map(([k]) => k);

    if (faltan.length > 0) {
      return NextResponse.json(
        { error: "Campos inválidos o faltantes.", campos: faltan },
        { status: 400 },
      );
    }

    // **La vigencia la pone el servidor, no el cliente.** Aceptarla del cuerpo
    // permitiría antedatar una versión y cambiar retroactivamente el monto de
    // salidas ya cobradas en efectivo — o postdatarla y dejar al estacionamiento
    // sin tarifa vigente, que es lo único que impide cerrar una salida.
    const creada = await conBase(() =>
      db
        .insert(tarifa)
        .values({
          // El estacionamiento sale de la sesión, releída de la base en cada
          // petición; nunca del cuerpo (aislamiento, `docs/CONTRATO-api.md` §1.3).
          estacionamientoId: sesion.estacionamientoId,
          valorHora: valorHora!,
          fraccionMinutos: fraccionMinutos!,
          montoMinimo: montoMinimo!,
          vigenteDesde: new Date(),
        })
        .returning({
          id: tarifa.id,
          valorHora: tarifa.valorHora,
          fraccionMinutos: tarifa.fraccionMinutos,
          montoMinimo: tarifa.montoMinimo,
          vigenteDesde: tarifa.vigenteDesde,
        }),
    );

    return NextResponse.json({ tarifa: creada[0] }, { status: 201 });
  },
);
