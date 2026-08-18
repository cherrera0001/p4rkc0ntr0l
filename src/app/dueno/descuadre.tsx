"use client";

/**
 * Indicador de descuadre — spec.md §6.
 *
 * "Diferencia entre ocupación observada y sesiones registradas (hace visible,
 * sin impedirlo, que un vehículo se cobre por fuera)."
 *
 * La ocupación observada es lo que el dueño cuenta con los ojos en el patio: el
 * sistema no puede saberla, así que la ingresa él. No se persiste —§6 dice
 * explícitamente que el panel no requiere tabla adicional— y esa es también la
 * decisión correcta en minimización: es una comparación puntual, no un registro
 * que haya que conservar.
 *
 * El panel hace visible la diferencia y no la impide: registrar la sospecha como
 * un hecho sería inventar evidencia sobre una persona.
 */

import { useState } from "react";

export default function Descuadre({
  ocupacionRegistrada,
}: {
  ocupacionRegistrada: number;
}) {
  const [observada, setObservada] = useState("");

  const valor = observada.trim() === "" ? null : Number(observada);
  const valido = valor !== null && Number.isInteger(valor) && valor >= 0;
  const diferencia = valido ? valor - ocupacionRegistrada : null;

  return (
    // La card oscura del diseño (canvas 1n): es la pregunta que el panel le hace
    // al dueño, y por eso rompe el ritmo claro de las stat cards.
    <section className="flex flex-col gap-4 rounded-2xl bg-ink p-6 text-white shadow-md">
      <span className="mono-caption text-white/50">Descuadre</span>
      <label htmlFor="observada" className="text-lg font-medium text-white">
        ¿Cuántos vehículos contás en el patio ahora mismo?
      </label>

      <div className="flex items-stretch gap-2">
        <input
          id="observada"
          data-testid="ocupacion-observada"
          inputMode="numeric"
          value={observada}
          onChange={(e) => setObservada(e.target.value.replace(/[^0-9]/g, ""))}
          aria-describedby={diferencia !== null ? "descuadre-resultado" : undefined}
          className="tabular min-w-0 flex-1 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3 text-center text-2xl font-semibold text-white caret-accent placeholder:text-white/30 focus:border-accent focus:outline-none"
          placeholder="—"
        />
      </div>

      {diferencia !== null && (
        <p
          id="descuadre-resultado"
          data-testid="descuadre"
          data-valor={diferencia}
          className={`rounded-xl border p-4 text-sm font-medium ${
            diferencia === 0
              ? "border-success/30 bg-success/10 text-success-soft"
              : "border-warning/30 bg-warning/10 text-warning-soft"
          }`}
        >
          {diferencia === 0
            ? "Sin descuadre: lo contado coincide con lo registrado."
            : diferencia > 0
              ? `Hay ${diferencia} vehículo(s) más en el patio que sesiones registradas. El sistema hace visible la diferencia; no la impide.`
              : `Hay ${Math.abs(diferencia)} sesión(es) registrada(s) de más respecto de lo contado.`}
        </p>
      )}
    </section>
  );
}
