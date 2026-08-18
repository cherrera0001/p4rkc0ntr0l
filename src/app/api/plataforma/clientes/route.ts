/**
 * Alta de cliente — ADR-005 alternativa 2, aceptada el 2026-08-17.
 *
 * ## Qué reemplaza
 *
 * Hasta hoy dar de alta un cliente era correr `scripts/sembrar.mjs` con
 * `DATABASE_URL` en la mano. **La operación de mayor privilegio del sistema se
 * ejercía por el camino menos auditable que existe**, y ADR-005 §2.3 la tenía
 * anotada como el actor que no existía.
 *
 * ## Multicliente, no multisitio
 *
 * Esto da de alta **N clientes con un recinto cada uno**. No crea ninguna
 * jerarquía por encima de `estacionamiento`: no hay `tenant`, ni `tenant_id`, ni
 * tabla agrupadora. Que siga siendo así lo hace cumplir `AC-SCOPE-4`, que se
 * escribió y se probó con el fallo plantado **antes** que esta ruta.
 *
 * ## Transacción de verdad, y por qué acá sí
 *
 * Un alta escribe cuatro filas —estacionamiento, tarifa, dueño y operador— y
 * ninguna sirve sola: un estacionamiento sin tarifa no puede cobrar una salida,
 * y uno sin usuarios no puede operar. Es exactamente la condición de reversión
 * que se declaró al cerrar M7: *«que aparezca una operación que deba escribir
 * dos o más filas de forma indivisible»*. Apareció, y por eso acá se usa
 * `db.transaction` y no el truco de una fila.
 *
 * `conBase` envuelve la transacción entera para que un fallo siga saliendo por
 * `ErrorBaseDatos` y el saneo de credenciales de INT-1 no se pierda.
 *
 * ## El rol de plataforma no ve patentes
 *
 * REQ-ISO-3 de ADR-005. Esta ruta no lee ni devuelve `patente` por ningún
 * camino, y `AC-ISO-2` lo hace cumplir desde afuera.
 */

import { NextResponse } from "next/server";

import { conBase, db, estacionamiento, tarifa, usuario } from "@/db";
import { ErrorBaseDatos } from "@/lib/errores";
import { esTextoAlmacenable } from "@/lib/frontera";
import { rutaAutenticada } from "@/lib/peticion";

export const dynamic = "force-dynamic";

/** Texto de frontera: no vacío, acotado, y almacenable por Postgres. */
function texto(v: unknown, max: number): string | null {
  if (!esTextoAlmacenable(v)) return null;
  const limpio = v.trim();
  return limpio.length === 0 || limpio.length > max ? null : limpio;
}

/** Entero de frontera. Rechaza `NaN`, decimales, infinitos y el texto numérico. */
function entero(v: unknown, min: number, max: number): number | null {
  if (typeof v !== "number" || !Number.isInteger(v)) return null;
  return v < min || v > max ? null : v;
}

/**
 * Una zona horaria que el runtime reconozca. No una lista blanca nuestra: se le
 * pregunta a `Intl`, que es quien después va a resolver el inicio del día del
 * panel. Una zona que el sistema acepta y `Intl` no rompería el panel del dueño
 * en su primera carga, no en el alta.
 */
function zonaValida(v: unknown): string | null {
  const z = texto(v, 64);
  if (z === null) return null;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: z });
    return z;
  } catch {
    return null;
  }
}

export const POST = rutaAutenticada<unknown, "plataforma">(
  { rol: "plataforma", exigirOrigen: true },
  async ({ request }) => {
    let cuerpo: unknown;
    try {
      cuerpo = await request.json();
    } catch {
      return NextResponse.json({ error: "Cuerpo JSON inválido." }, { status: 400 });
    }

    const c = (cuerpo ?? {}) as Record<string, unknown>;

    const nombre = texto(c.nombre, 120);
    const zonaHoraria = zonaValida(c.zonaHoraria);
    const capacidadTotal = entero(c.capacidadTotal, 1, 100_000);
    const valorHora = entero(c.valorHora, 0, 100_000_000);
    const fraccionMinutos = entero(c.fraccionMinutos, 1, 1440);
    const montoMinimo = entero(c.montoMinimo, 0, 100_000_000);
    const emailDueno = texto(c.emailDueno, 255);
    const emailOperador = texto(c.emailOperador, 255);

    // **Se reportan todos los campos inválidos, no el primero.** Un alta la hace
    // una persona llenando un formulario: devolverle un error por vez la obliga
    // a N viajes para descubrir N problemas.
    const faltan = Object.entries({
      nombre,
      zonaHoraria,
      capacidadTotal,
      valorHora,
      fraccionMinutos,
      montoMinimo,
      emailDueno,
      emailOperador,
    })
      .filter(([, v]) => v === null)
      .map(([k]) => k);

    if (faltan.length > 0) {
      return NextResponse.json(
        { error: "Campos inválidos o faltantes.", campos: faltan },
        { status: 400 },
      );
    }

    if (emailDueno === emailOperador) {
      return NextResponse.json(
        { error: "El dueño y el operador no pueden ser el mismo usuario.", campos: ["emailOperador"] },
        { status: 400 },
      );
    }

    try {
      const creado = await conBase(() =>
        db.transaction(async (tx) => {
          const [est] = await tx
            .insert(estacionamiento)
            .values({ nombre: nombre!, capacidadTotal: capacidadTotal!, zonaHoraria: zonaHoraria! })
            .returning({ id: estacionamiento.id, nombre: estacionamiento.nombre });

          await tx.insert(tarifa).values({
            estacionamientoId: est.id,
            valorHora: valorHora!,
            fraccionMinutos: fraccionMinutos!,
            montoMinimo: montoMinimo!,
            // Vigente desde ya: un estacionamiento sin tarifa vigente no puede
            // cerrar una salida, y el alta tiene que dejarlo operativo (AC-ADM-1).
            vigenteDesde: new Date(),
          });

          await tx.insert(usuario).values([
            { email: emailDueno!, rol: "dueño", estacionamientoId: est.id },
            { email: emailOperador!, rol: "operador", estacionamientoId: est.id },
          ]);

          return est;
        }),
      );

      return NextResponse.json({ cliente: creado }, { status: 201 });
    } catch (error) {
      // Email repetido: es un error del que da de alta, no del servicio. Sale
      // 409 y no 503, porque reintentarlo igual nunca va a funcionar.
      if (error instanceof ErrorBaseDatos && error.codigo === "23505") {
        return NextResponse.json(
          { error: "Ya existe un usuario con ese email.", campos: ["emailDueno", "emailOperador"] },
          { status: 409 },
        );
      }
      throw error;
    }
  },
);
