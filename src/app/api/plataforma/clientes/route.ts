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

import { inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

import { conBase, db, estacionamiento, tarifa, usuario } from "@/db";
import { ErrorBaseDatos } from "@/lib/errores";
import { enteroDeFrontera, esTextoAlmacenable } from "@/lib/frontera";
import { rutaAutenticada } from "@/lib/peticion";

export const dynamic = "force-dynamic";

/** Texto de frontera: no vacío, acotado, y almacenable por Postgres. */
function texto(v: unknown, max: number): string | null {
  if (!esTextoAlmacenable(v)) return null;
  const limpio = v.trim();
  return limpio.length === 0 || limpio.length > max ? null : limpio;
}

/**
 * Email de frontera — **normalizado igual que el login, o la cuenta nace muerta.**
 *
 * `POST /api/login` busca por `email.trim().toLowerCase()` (`login/route.ts`).
 * Si el alta guardara el email tal como se teclea, un `Dueño@Local.cl` con
 * cualquier mayúscula quedaría en la base en mayúscula y el login —que baja a
 * minúscula antes de buscar— **nunca encontraría la fila**: el cliente se
 * provisiona «operativo» (201) con una cuenta que no puede entrar jamás, y nada
 * avisa. Lo encontró el experto de seguridad del concilio, reproducido.
 *
 * Normaliza a minúscula acá, y además exige una forma de email mínima: sin esto
 * el alta aceptaba `"no soy un email"` y dejaba una cuenta basura por cliente.
 * No es una validación exhaustiva de RFC —eso es un pozo sin fondo—: es que
 * tenga una `@` con algo a cada lado y un punto en el dominio.
 */
const FORMA_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function email(v: unknown): string | null {
  const t = texto(v, 255);
  if (t === null) return null;
  const normal = t.toLowerCase();
  return FORMA_EMAIL.test(normal) ? normal : null;
}

/**
 * El entero de frontera vive en `@/lib/frontera` desde que una segunda
 * superficie —la nueva versión de tarifa— necesitó exactamente el mismo
 * validador. Su historia y el porqué de aceptar texto numérico están ahí.
 */
const entero = enteroDeFrontera;

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
    const emailDueno = email(c.emailDueno);
    const emailOperador = email(c.emailOperador);

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

    // **El 409 nombra SOLO el email que choca (hallazgo del experto de API).**
    // Antes el `catch` del 23505 devolvía `campos: [emailDueno, emailOperador]`
    // aunque colisionara uno solo, y el formulario pintaba `aria-invalid` en los
    // dos: el operador corregía también el email bueno. Se consulta cuál existe
    // antes de la transacción y se responde con el que corresponde.
    //
    // No abre un oráculo nuevo: quien llama ya tecleó esos dos correos, así que
    // el 409 no le dice nada que no supiera. Y el `catch` del 23505 se mantiene
    // como red de la carrera —dos altas simultáneas con el mismo email— porque
    // esta consulta previa no es atómica con el INSERT.
    const chocan = await conBase(() =>
      db
        .select({ email: usuario.email })
        .from(usuario)
        .where(inArray(usuario.email, [emailDueno!, emailOperador!])),
    );
    if (chocan.length > 0) {
      const existentes = new Set(chocan.map((u) => u.email));
      const campos = [
        ...(existentes.has(emailDueno!) ? ["emailDueno"] : []),
        ...(existentes.has(emailOperador!) ? ["emailOperador"] : []),
      ];
      return NextResponse.json(
        { error: "Ya existe un usuario con ese email.", campos },
        { status: 409 },
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
      // **Red de la carrera**, no el camino normal: el 409 lo emite ahora la
      // consulta previa. Acá solo cae una segunda alta que pasó la consulta y
      // perdió la carrera del INSERT contra otra simultánea. Como no se sabe cuál
      // de los dos emails chocó, se nombran ambos —es el caso raro, no el común—.
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
