/**
 * Ingreso al sistema. Dos roles, una pantalla (spec.md §3).
 *
 * Componente de servidor y `force-dynamic` por la CSP con nonce (hallazgo
 * INT-2): Next estampa el nonce durante el renderizado, leyéndolo de la
 * cabecera de la petición. Una página prerenderizada en el build no tiene
 * petición de la que leerlo, así que sus scripts quedarían sin nonce y el
 * navegador los bloquearía — la pantalla se vería pero el formulario no
 * andaría. El formulario en sí vive en `formulario.tsx`, del lado del cliente.
 */

import FormularioLogin from "./formulario";

export const dynamic = "force-dynamic";

export default function Login() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6">
      <div className="flex flex-col gap-2">
        <span className="eyebrow">Piloto</span>
        <h1>Estacionamiento</h1>
        <p className="text-sm text-subtle">
          Registro de entradas y salidas, y visibilidad de ocupación e ingresos.
        </p>
      </div>
      <FormularioLogin />
    </main>
  );
}
