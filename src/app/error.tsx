"use client";

/**
 * Contención de errores de renderizado (hallazgo INT-19).
 *
 * Sin este archivo, un fallo transitorio de Railway durante el render del panel
 * del dueño tiraba la página entera: pantalla en blanco, sin explicación y sin
 * forma de reintentar que no fuera recargar a mano.
 *
 * No muestra el error. El mensaje de un fallo del driver puede arrastrar la
 * cadena de conexión (INT-1) y esta pantalla la ve el usuario: lo que se
 * necesita saber ya está en los logs del servidor, redactado.
 */

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // El `digest` es el identificador que Next deja también en el log del
    // servidor: es lo que permite cruzar esta pantalla con el error real.
    console.error("Fallo al renderizar la pantalla.", error.digest ?? "");
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 p-6">
      <h1 className="text-lg font-semibold">No se pudo cargar la pantalla</h1>
      <p className="text-sm text-slate-600">
        Puede ser una caída momentánea del servicio de datos. Reintentá; si
        sigue igual, avisá con el código de abajo.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-xl bg-slate-900 px-4 py-4 text-lg font-semibold text-white active:bg-slate-700"
      >
        Reintentar
      </button>
      {error.digest && (
        <p className="text-xs text-slate-500">
          Código: <span className="font-mono">{error.digest}</span>
        </p>
      )}
    </main>
  );
}
