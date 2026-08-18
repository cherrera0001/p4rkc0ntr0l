/**
 * Puerta de la pantalla del operador.
 *
 * Componente de servidor: la comprobación de rol ocurre antes de enviar nada al
 * navegador. El dueño que entre acá se va a su panel; quien no tenga sesión, al
 * login.
 */

import { redirect } from "next/navigation";

import { sesionActual } from "@/lib/auth";
import { destinoDe } from "@/lib/roles";
import { operacionRealHabilitada } from "@/lib/env";
import PantallaOperador from "./pantalla-operador";

export const dynamic = "force-dynamic";

export default async function Home() {
  const usuario = await sesionActual();

  if (!usuario) redirect("/login");
  // Cada rol a su pantalla, desde una sola tabla (`src/lib/roles.ts`). Antes
  // esta regla estaba escrita en cuatro archivos, y un rol nuevo dejaba a
  // alguien viendo la pantalla equivocada.
  if (usuario.rol !== "operador") redirect(destinoDe(usuario.rol));

  // La variable de entorno solo la puede leer el servidor. Se pasa como prop
  // para que el cliente pueda aplicar la barrera antes de escribir en
  // IndexedDB (hallazgo A-3).
  return <PantallaOperador operacionReal={operacionRealHabilitada()} />;
}
