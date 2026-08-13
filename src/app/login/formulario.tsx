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
      <form onSubmit={entrar} className="flex flex-col gap-2">
        <label
          htmlFor="email"
          className="text-[0.6875rem] font-semibold tracking-[0.16em] text-muted uppercase"
        >
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
          className="mb-2 rounded-xl border border-line-strong bg-card px-4 py-3.5 text-ink caret-accent focus:border-accent focus:outline-none"
        />

        <label
          htmlFor="clave"
          className="text-[0.6875rem] font-semibold tracking-[0.16em] text-muted uppercase"
        >
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
          className="mb-3 rounded-xl border border-line-strong bg-card px-4 py-3.5 text-ink caret-accent focus:border-accent focus:outline-none"
        />

        <button
          type="submit"
          data-testid="entrar"
          disabled={enviando}
          className="rounded-2xl bg-accent px-4 py-4 text-lg font-semibold text-white transition-colors duration-200 active:bg-accent-strong disabled:opacity-50"
        >
          {enviando ? "Entrando..." : "Entrar"}
        </button>
      </form>

      {error && (
        <p
          data-testid="error-login"
          role="alert"
          className="rounded-xl border border-critical/20 bg-critical-soft p-3 text-sm font-medium text-critical"
        >
          {error}
        </p>
      )}
    </>
  );
}
