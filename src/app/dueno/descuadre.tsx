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
    <section className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4">
      <div>
        <label htmlFor="observada" className="text-sm font-medium">
          ¿Cuántos vehículos contás en el patio?
        </label>
        <p className="text-xs text-slate-500">
          Compará lo que ves con lo que el sistema tiene registrado.
        </p>
      </div>

      <input
        id="observada"
        data-testid="ocupacion-observada"
        inputMode="numeric"
        value={observada}
        onChange={(e) => setObservada(e.target.value.replace(/[^0-9]/g, ""))}
        className="rounded-xl border-2 border-slate-300 px-4 py-3 text-center text-2xl font-semibold"
      />

      {diferencia !== null && (
        <p
          data-testid="descuadre"
          data-valor={diferencia}
          className={`text-sm font-medium ${
            diferencia === 0 ? "text-emerald-700" : "text-amber-700"
          }`}
        >
          {diferencia === 0
            ? "Sin descuadre: lo contado coincide con lo registrado."
            : diferencia > 0
              ? `Descuadre: hay ${diferencia} vehículo(s) más en el patio que sesiones registradas.`
              : `Descuadre: hay ${Math.abs(diferencia)} sesión(es) registrada(s) de más respecto de lo contado.`}
        </p>
      )}
    </section>
  );
}
