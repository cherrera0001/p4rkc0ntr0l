/**
 * Ingresos por hora — el gráfico del diseño (canvas 1n), con **dato real**.
 *
 * ## Data-driven, no maqueta
 *
 * La maqueta pinta barras de altura fija; esto grafica la suma real de
 * `monto_calculado` por hora del día, del estacionamiento del dueño, cortado en
 * su zona horaria. Si no hubo salidas, no inventa barras: lo dice.
 *
 * ## Por qué las alturas no son `style` inline
 *
 * La CSP de INT-2 no lleva `'unsafe-inline'` en `style-src`, así que un
 * `style={{ height }}` sería una violación —y la maqueta lo usa, pero la maqueta
 * no corre bajo esta CSP—. Las alturas salen de un set fijo de clases que
 * Tailwind ve estáticamente, y cada barra se mapea al escalón más cercano. Se
 * pierde algo de precisión visual; se gana no relajar la CSP por un gráfico.
 *
 * ## Ejes
 *
 * Se muestran las horas de operación (08–20), que es lo que la maqueta enseña y
 * lo que el dueño mira. Una salida fuera de esa franja igual suma al total del
 * panel; acá se grafica la franja legible.
 */

// Once escalones de 0 a 100 %. Strings literales para que Tailwind los genere.
const ALTURAS = [
  "h-0",
  "h-[10%]",
  "h-[20%]",
  "h-[30%]",
  "h-[40%]",
  "h-[50%]",
  "h-[60%]",
  "h-[70%]",
  "h-[80%]",
  "h-[90%]",
  "h-full",
];

const HORA_INICIO = 8;
const HORA_FIN = 20;

export default function IngresosPorHora({
  porHora,
}: {
  /** Mapa hora-del-día (0–23) → monto sumado en esa hora. */
  porHora: Map<number, number>;
}) {
  const horas = Array.from({ length: HORA_FIN - HORA_INICIO + 1 }, (_, i) => HORA_INICIO + i);
  const montos = horas.map((h) => porHora.get(h) ?? 0);
  const max = Math.max(...montos, 0);
  const hayDatos = max > 0;

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-5 shadow-xs">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-ink normal-case tracking-normal">Ingresos por hora</h2>
        <span className="text-xs text-faint">hoy</span>
      </div>

      {hayDatos ? (
        <>
          <div className="flex h-32 items-end gap-1" aria-hidden>
            {horas.map((h, i) => {
              const escalon = Math.round((montos[i] / max) * 10);
              // El pico va en acento; el resto en la línea del sistema. Una barra
              // con algo de monto nunca baja de un escalón, o desaparecería.
              const color = montos[i] === max ? "bg-accent" : montos[i] > 0 ? "bg-accent/40" : "bg-line";
              const alto = montos[i] > 0 ? ALTURAS[Math.max(1, escalon)] : "h-[2%]";
              return <div key={h} className={`flex-1 rounded-t ${alto} ${color}`} />;
            })}
          </div>
          <div className="flex justify-between font-mono text-[11px] tracking-[0.1em] text-faint">
            <span>08</span>
            <span>12</span>
            <span>16</span>
            <span>20</span>
          </div>
          {/* La cifra que el gráfico resume, para lectores y para quien no ve el color. */}
          <p className="sr-only">
            Pico de ingresos a las {horas[montos.indexOf(max)]} horas: $ {max.toLocaleString("es-CL")}.
          </p>
        </>
      ) : (
        <p className="py-6 text-center text-sm text-faint">
          Todavía no hay salidas registradas hoy. El gráfico aparece con el primer cobro.
        </p>
      )}
    </section>
  );
}
