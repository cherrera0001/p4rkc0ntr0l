"use client";

/**
 * Formulario de ingreso. Cliente, porque maneja estado de campos y envío.
 *
 * Vive separado de `page.tsx` para que la página pueda ser un componente de
 * servidor y declarar `dynamic = "force-dynamic"`: la CSP con nonce (INT-2)
 * exige renderizado dinámico, y una página prerenderizada en el build no tiene
 * cómo recibir el nonce de la petición — sus scripts quedarían bloqueados y el
 * formulario no hidrataría.
 */

import { useState } from "react";

export default function FormularioLogin() {
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(evento: React.FormEvent) {
    evento.preventDefault();
    setEnviando(true);
    setError(null);

    try {
      const r = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, clave }),
      });

      if (!r.ok) {
        const { error: motivo } = await r.json();
        setError(motivo ?? "No se pudo entrar.");
        return;
      }

      const { destino } = await r.json();
      // Recarga completa: el destino es un componente de servidor que necesita
      // leer la cookie recién puesta.
      window.location.href = destino;
    } catch {
      setError("Sin conexión.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <form onSubmit={entrar} className="flex flex-col gap-3">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          data-testid="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          required
          className="rounded-xl border-2 border-slate-300 px-4 py-3"
        />

        <label htmlFor="clave" className="text-sm font-medium">
          Clave
        </label>
        <input
          id="clave"
          data-testid="clave"
          type="password"
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          autoComplete="current-password"
          required
          className="rounded-xl border-2 border-slate-300 px-4 py-3"
        />

        <button
          type="submit"
          data-testid="entrar"
          disabled={enviando}
          className="rounded-xl bg-slate-900 px-4 py-4 text-lg font-semibold text-white active:bg-slate-700 disabled:opacity-50"
        >
          {enviando ? "Entrando..." : "Entrar"}
        </button>
      </form>

      {error && (
        <p data-testid="error-login" role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </>
  );
}
