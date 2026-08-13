"use client";

/**
 * Cierre de sesión (hallazgos INT-8 y B-4).
 *
 * `DELETE /api/login` existía desde M3 y ninguna pantalla lo llamaba: en un
 * dispositivo compartido por turnos —el escenario del piloto— no había forma de
 * salir. Y aunque la hubiera habido, `cerrarSesion()` solo borra la cookie: con
 * la invariante de M-4, IndexedDB conserva a propósito las patentes de los
 * vehículos que están adentro. Eso es correcto para operar y equivocado al
 * cambiar de turno, porque el operador entrante hereda dato personal del
 * anterior sin ningún acto de entrega.
 *
 * Por eso cerrar sesión hace las dos cosas: borra la cookie **y** vacía el
 * dispositivo.
 *
 * **Salvo que haya ingresos sin sincronizar.** Ese registro existe únicamente
 * acá hasta que sube; vaciarlo sería perderlo, y AC-OP-1 dice que el ingreso
 * hecho sin red no se pierde. En ese caso no se cierra la sesión y se explica
 * por qué: primero hay que recuperar la señal.
 */

import { useState } from "react";

import { borrarTodo, pendientes } from "@/lib/cola-local";

export default function CerrarSesion() {
  const [error, setError] = useState<string | null>(null);
  const [saliendo, setSaliendo] = useState(false);

  async function salir() {
    setError(null);
    setSaliendo(true);
    try {
      const sinSubir = await pendientes();
      if (sinSubir.length > 0) {
        setError(
          `Quedan ${sinSubir.length} ingreso(s) sin sincronizar. Si cerrás sesión ` +
            "ahora se pierden: recuperá la señal y esperá a que suban.",
        );
        return;
      }

      const r = await fetch("/api/login", { method: "DELETE" });
      if (!r.ok) {
        setError("No se pudo cerrar la sesión. Reintentá.");
        return;
      }

      // Después de que el servidor confirma: si falla el DELETE, el dispositivo
      // sigue siendo el de una sesión abierta y borrarlo habría sido gratuito.
      await borrarTodo();

      // Recarga completa y no `router.push`: una navegación del cliente
      // conserva el estado en memoria de React, y ahí viven las últimas salidas
      // cobradas —con sus patentes—. Vaciar IndexedDB y dejar eso en pantalla
      // para el turno siguiente sería cerrar la puerta y abrir la ventana.
      window.location.assign(new URL("/login", window.location.origin));
    } catch {
      setError("Sin conexión: cerrar sesión necesita red.");
    } finally {
      setSaliendo(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={salir}
        disabled={saliendo}
        data-testid="cerrar-sesion"
        className="rounded-lg border border-line-strong bg-card px-3 py-1.5 text-xs font-medium text-muted transition-colors duration-200 active:bg-canvas-2 disabled:opacity-50"
      >
        {saliendo ? "Saliendo..." : "Cerrar sesión"}
      </button>
      {error && (
        <p
          data-testid="error-cerrar-sesion"
          role="alert"
          className="rounded-xl border border-critical/20 bg-critical-soft p-3 text-right text-sm font-medium text-critical"
        >
          {error}
        </p>
      )}
    </div>
  );
}
