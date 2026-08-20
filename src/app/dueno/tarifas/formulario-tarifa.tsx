"use client";

/**
 * Nueva versión de tarifa — el botón «Nueva versión de tarifa» de la maqueta `1e`.
 *
 * ## Por qué un formulario y no un modal
 *
 * La maqueta muestra un botón que abre algo que el lienzo no dibuja. Acá es un
 * formulario en la misma página: el dueño necesita ver los valores vigentes y el
 * simulador **mientras** decide los nuevos, y un modal los tapa.
 *
 * ## El servidor es la única frontera
 *
 * La validación de verdad vive en `api/tarifas`. Lo de acá es para que el campo
 * no viaje vacío; si el servidor rechaza un campo, se enfoca el que corresponde.
 *
 * Accesibilidad, con los mismos hallazgos que el concilio dejó en el alta: foco
 * al primer campo con error, `aria-describedby` al mensaje y `aria-live` para el
 * resultado.
 */

import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";

const CAMPOS = [
  { id: "valorHora", etiqueta: "Valor por hora (pesos)" },
  { id: "fraccionMinutos", etiqueta: "Fracción de cobro (minutos)" },
  { id: "montoMinimo", etiqueta: "Monto mínimo (pesos)" },
] as const;

type Estado =
  | { tipo: "quieto" }
  | { tipo: "enviando" }
  | { tipo: "creada" }
  | { tipo: "error"; mensaje: string; campos: string[] };

export default function FormularioTarifa() {
  const router = useRouter();
  const errorId = useId();
  const [valores, setValores] = useState<Record<string, string>>({
    valorHora: "",
    fraccionMinutos: "",
    montoMinimo: "",
  });
  const [estado, setEstado] = useState<Estado>({ tipo: "quieto" });
  const refs = useRef<Record<string, HTMLInputElement | null>>({});

  const invalidos = estado.tipo === "error" ? estado.campos : [];

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (estado.tipo === "enviando") return;

    const vacios = CAMPOS.filter((c) => valores[c.id].trim() === "").map((c) => c.id);
    if (vacios.length > 0) {
      setEstado({ tipo: "error", mensaje: "Completá los tres valores.", campos: vacios });
      refs.current[vacios[0]]?.focus();
      return;
    }

    setEstado({ tipo: "enviando" });
    try {
      const r = await fetch("/api/tarifas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(valores),
      });
      const cuerpo = await r.json().catch(() => null);

      if (r.status === 201) {
        setEstado({ tipo: "creada" });
        setValores({ valorHora: "", fraccionMinutos: "", montoMinimo: "" });
        // La página es de servidor: se le pide que vuelva a consultar, así el
        // simulador y el histórico muestran la versión recién creada sin que el
        // dueño tenga que recargar a mano.
        router.refresh();
        return;
      }

      const campos: string[] = Array.isArray(cuerpo?.campos) ? cuerpo.campos : [];
      setEstado({
        tipo: "error",
        mensaje: cuerpo?.error ?? "No se pudo guardar la tarifa.",
        campos,
      });
      if (campos[0]) refs.current[campos[0]]?.focus();
    } catch {
      // Sin red no se guarda, y se dice: a diferencia del ingreso del operador,
      // esto no tiene cola local ni debe tenerla. Una tarifa a medio sincronizar
      // cambiaría el monto que se cobra en efectivo sin que nadie lo sepa.
      setEstado({
        tipo: "error",
        mensaje: "Sin conexión. La tarifa no se guardó; probá de nuevo al reconectar.",
        campos: [],
      });
    }
  }

  return (
    <form
      onSubmit={enviar}
      className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-4 shadow-xs"
    >
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-medium text-ink">Nueva versión de tarifa</h3>
        <p className="text-xs leading-relaxed text-subtle">
          Empieza a regir apenas se guarda. La versión anterior queda en el histórico.
        </p>
      </div>

      {CAMPOS.map((c) => (
        <label key={c.id} className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted">{c.etiqueta}</span>
          <input
            ref={(el) => {
              refs.current[c.id] = el;
            }}
            name={c.id}
            type="number"
            inputMode="numeric"
            value={valores[c.id]}
            onChange={(e) => setValores((v) => ({ ...v, [c.id]: e.target.value }))}
            aria-invalid={invalidos.includes(c.id) || undefined}
            aria-describedby={estado.tipo === "error" ? errorId : undefined}
            disabled={estado.tipo === "enviando"}
            className="campo"
          />
        </label>
      ))}

      <button type="submit" disabled={estado.tipo === "enviando"} className="btn-primario">
        {estado.tipo === "enviando" ? "Guardando…" : "Guardar nueva versión"}
      </button>

      <p aria-live="polite" className="min-h-5 text-sm">
        {estado.tipo === "creada" && (
          <span data-testid="tarifa-creada" className="text-success">
            Versión guardada. Ya rige para las próximas salidas.
          </span>
        )}
        {estado.tipo === "error" && (
          <span id={errorId} role="alert" className="text-critical">
            {estado.mensaje}
            {estado.campos.length > 0 && ` Revisá: ${estado.campos.join(", ")}.`}
          </span>
        )}
      </p>
    </form>
  );
}
