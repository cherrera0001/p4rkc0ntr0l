/**
 * Puerta de la pantalla del operador.
 *
 * Componente de servidor: la comprobación de rol ocurre antes de enviar nada al
 * navegador. El dueño que entre acá se va a su panel; quien no tenga sesión, al
 * login.
 */

import { redirect } from "next/navigation";

import { sesionActual } from "@/lib/auth";
import { operacionRealHabilitada } from "@/lib/env";
import PantallaOperador from "./pantalla-operador";

export const dynamic = "force-dynamic";

export default async function Home() {
  const usuario = await sesionActual();

  if (!usuario) redirect("/login");
  if (usuario.rol === "dueño") redirect("/dueno");

  // La variable de entorno solo la puede leer el servidor. Se pasa como prop
  // para que el cliente pueda aplicar la barrera antes de escribir en
  // IndexedDB (hallazgo A-3).
  return <PantallaOperador operacionReal={operacionRealHabilitada()} />;
}
