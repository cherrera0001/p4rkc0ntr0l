/**
 * Pantalla de plataforma — alta de clientes (ADR-005 alt. 2, aceptado 2026-08-17).
 *
 * Reemplaza a `scripts/sembrar.mjs` corrido a mano con `DATABASE_URL`. La
 * operacion de mayor privilegio del sistema deja de ejercerse por el camino
 * menos auditable que hay.
 *
 * **No muestra ni una patente**, y no es un descuido: es AC-ISO-2. El rol con
 * mas poder es el que menos datos personales tiene que ver.
 */

import { countDistinct, desc, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";

import { conBase, db, estacionamiento, tarifa, usuario } from "@/db";
import { sesionActual } from "@/lib/auth";
import { destinoDe } from "@/lib/roles";
import Cabecera from "../cabecera";
import CerrarSesion from "../cerrar-sesion";
import FormularioAlta from "./formulario-alta";

export const dynamic = "force-dynamic";

/**
 * Listado de clientes — SPEC-005 §3.1, capacidad 2.
 *
 * **Lo que muestra está enumerado en la spec y no se amplía:** nombre,
 * capacidad, zona horaria, fecha de alta y **cantidad** de usuarios. Sin
 * ocupación, sin ingresos, sin patentes — SPEC-005 §3.2 excluye toda vista de
 * operación del cliente, y esa exclusión es la que mantiene a este rol fuera del
 * dato personal.
 *
 * **La cantidad de usuarios, no sus correos.** `usuario.email` también es dato
 * personal, y su plazo de retención es `{{PLAZO_RETENCION_USUARIO}}`: un
 * placeholder propuesto y sin resolver (ADR-005 §5.3). Contar no lo trata;
 * listarlo sí. La spec pide el número, así que el número es lo que se consulta.
 *
 * **Por qué se consulta acá y no por una ruta de API nueva:** es el patrón del
 * panel del dueño —consulta en el componente de servidor, ya autenticado y
 * redirigido por rol— y evita abrir una superficie JSON más sobre la tabla de
 * usuarios. Menos superficie es menos que verificar.
 *
 * `sesion_vehiculo` no se toca por ningún camino, y eso no depende de esta
 * lectura: `verificar:aislamiento` lo hace cumplir **por exclusión** sobre toda
 * la superficie de plataforma (AC-ISO-2).
 */
async function listarClientes() {
  return conBase(() =>
    db
      .select({
        id: estacionamiento.id,
        nombre: estacionamiento.nombre,
        capacidadTotal: estacionamiento.capacidadTotal,
        zonaHoraria: estacionamiento.zonaHoraria,
        creado: estacionamiento.createdAt,
        usuarios: countDistinct(usuario.id),
        // El estado de alta de SPEC-005 §3.1 capacidad 3: son las mismas tres
        // condiciones que AC-ADM-1 exige del alta, leídas de vuelta desde la
        // base. Un cliente creado por la ruta transaccional las cumple siempre;
        // el que quedó de `sembrar.mjs` a mano puede no cumplirlas, y entonces
        // se ve incompleto en vez de verse exitoso.
        duenos: sql<number>`(count(distinct ${usuario.id}) filter (where ${usuario.rol}::text = 'dueño'))::int`,
        operadores: sql<number>`(count(distinct ${usuario.id}) filter (where ${usuario.rol}::text = 'operador'))::int`,
        tarifasVigentes: sql<number>`(count(distinct ${tarifa.id}) filter (where ${tarifa.vigenteDesde} <= now()))::int`,
      })
      .from(estacionamiento)
      .leftJoin(usuario, eq(usuario.estacionamientoId, estacionamiento.id))
      .leftJoin(tarifa, eq(tarifa.estacionamientoId, estacionamiento.id))
      .groupBy(estacionamiento.id)
      .orderBy(desc(estacionamiento.createdAt)),
  );
}

/** La fecha de alta, en la zona del cliente y no en la del servidor (Vercel corre en UTC). */
function fechaDeAlta(instante: Date, zonaHoraria: string): string {
  try {
    return new Intl.DateTimeFormat("es-CL", {
      timeZone: zonaHoraria,
      dateStyle: "medium",
    }).format(instante);
  } catch {
    // Una zona que `Intl` no reconoce no puede dejar la pantalla en blanco: el
    // alta la valida contra `Intl`, pero una fila vieja pudo entrar por script.
    return new Intl.DateTimeFormat("es-CL", { dateStyle: "medium" }).format(instante);
  }
}

export default async function Plataforma() {
  const usuario = await sesionActual();
  if (!usuario) redirect("/login");
  // Cada rol trabaja donde puede: el operador registra, el dueno observa, la
  // plataforma da de alta. Un rol en la pantalla de otro se redirige, no se
  // "esconde el boton": esconder no es autorizar.
  if (usuario.rol !== "plataforma") redirect(destinoDe(usuario.rol));

  const clientes = await listarClientes();

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <Cabecera contexto="C4A · Plataforma" titulo="Alta de cliente" accion={<CerrarSesion />} />

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-5 pb-12">
        <p className="text-sm text-subtle">
          Crea un estacionamiento con su primera tarifa, un dueño y un operador. Las
          cuatro filas se escriben juntas: si algo falla, no queda un cliente a
          medio crear.
        </p>

        <FormularioAlta />

        <section className="flex flex-col gap-3" aria-labelledby="clientes-titulo">
          <h2
            id="clientes-titulo"
            className="text-[0.6875rem] font-semibold tracking-[0.16em] text-muted uppercase"
          >
            Clientes dados de alta
          </h2>

          {clientes.length === 0 ? (
            <p data-testid="clientes-vacio" className="text-sm text-subtle">
              Todavía no hay ningún cliente. El primero se crea con el formulario de arriba.
            </p>
          ) : (
            <ul data-testid="clientes" className="flex flex-col gap-3">
              {clientes.map((c) => {
                // Operativo = lo que AC-ADM-1 exige de un alta: tarifa vigente,
                // un dueño y un operador. Se nombra lo que falta; "incompleto"
                // a secas obligaría a ir a la base a averiguar qué.
                const falta = [
                  c.tarifasVigentes < 1 ? "tarifa vigente" : null,
                  c.duenos < 1 ? "dueño" : null,
                  c.operadores < 1 ? "operador" : null,
                ].filter((x): x is string => x !== null);

                return (
                  <li
                    key={c.id}
                    className="flex flex-col gap-1 rounded-2xl border border-line bg-card p-4 shadow-xs"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="font-semibold text-ink">{c.nombre}</p>
                      <span
                        className={`mono-caption ${falta.length === 0 ? "text-success" : "text-critical"}`}
                      >
                        {falta.length === 0 ? "Operativo" : "Incompleto"}
                      </span>
                    </div>
                    <p className="text-xs text-subtle tabular">
                      {c.capacidadTotal} cupos · {c.zonaHoraria} · alta{" "}
                      {fechaDeAlta(c.creado, c.zonaHoraria)}
                    </p>
                    <p className="text-xs text-faint tabular">
                      {c.usuarios} usuario{c.usuarios === 1 ? "" : "s"}
                      {falta.length > 0 && ` · falta: ${falta.join(", ")}`}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <footer className="mono-caption text-faint">
          Este rol no accede a patentes por ninguna ruta · Operación real deshabilitada
        </footer>
      </main>
    </div>
  );
}
