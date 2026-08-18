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

import { redirect } from "next/navigation";

import { sesionActual } from "@/lib/auth";
import { destinoDe } from "@/lib/roles";
import CerrarSesion from "../cerrar-sesion";
import FormularioAlta from "./formulario-alta";

export const dynamic = "force-dynamic";

export default async function Plataforma() {
  const usuario = await sesionActual();
  if (!usuario) redirect("/login");
  // Cada rol trabaja donde puede: el operador registra, el dueno observa, la
  // plataforma da de alta. Un rol en la pantalla de otro se redirige, no se
  // "esconde el boton": esconder no es autorizar.
  if (usuario.rol !== "plataforma") redirect(destinoDe(usuario.rol));

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 p-4 pb-10">
      <header className="flex items-start justify-between gap-3 pt-1">
        <div className="flex flex-col gap-1">
          <span className="eyebrow">Plataforma</span>
          <h1 className="text-xl font-semibold">Alta de cliente</h1>
          <p className="text-sm text-subtle">{usuario.email}</p>
        </div>
        <CerrarSesion />
      </header>

      <p className="text-sm text-subtle">
        Crea un estacionamiento con su primera tarifa, un dueno y un operador. Las
        cuatro filas se escriben juntas: si algo falla, no queda un cliente a medio
        crear.
      </p>

      <FormularioAlta />

      <footer className="text-xs text-subtle">
        Este rol no accede a patentes por ninguna ruta (AC-ISO-2). El sistema opera
        solo con patentes de prueba mientras la base de licitud y el plazo de
        retencion sigan sin resolver.
      </footer>
    </main>
  );
}
