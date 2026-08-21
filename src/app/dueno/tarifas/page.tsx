/**
 * Tarifas — maqueta `1e` del lienzo de Claude Design, veredicto **DENTRO**
 * (`docs/diseno-2026-08-12-traduccion.md:45`).
 *
 * ## Qué se tomó del diseño y qué no
 *
 * Se toma: el encabezado con su promesa de versionado, la tarjeta de tres
 * valores con su rótulo mono (`valor_hora`, `fraccion_minutos`, `monto_minimo`),
 * el pie con la vigencia y la acción, el **simulador**, y el aviso de que no hay
 * tramos horarios.
 *
 * **No se toma, y hay que decir por qué:**
 *
 * - **Los chips de tres estacionamientos** («Los Leones», «Providencia Sur»,
 *   «Prat 1240»). Eso es multisitio: un cliente con varios recintos. Está fuera
 *   por ADR-001 y ADR-004 lo mantuvo fuera; `AC-SCOPE-4` lo hace cumplir por
 *   comando. Acá el dueño tiene **un** recinto y no hay nada que conmutar.
 * - **«aplicada a 1.412 salidas»**. No es derivable: `sesion_vehiculo` no
 *   referencia la tarifa con que se calculó cada monto
 *   (`docs/diseno-2026-08-12-traduccion.md:158`). Escribir un número acá sería
 *   inventarlo, que es lo que `spec.md` §11 prohíbe. Para que fuera cierto hace
 *   falta `sesion_vehiculo.tarifa_id`, que rompe `AC-DATA-1` —27 campos exactos—
 *   y por lo tanto **va por ADR**.
 *
 * ## El simulador NO tiene números escritos a mano
 *
 * Corre `calcularMonto`, la misma función pura que usa la salida y que `AC-OP-2`
 * prueba. Es la única forma de que la promesa del diseño —*«es el mismo cálculo
 * que corre a la salida»*— sea cierta y no una leyenda. Cuando la maqueta se
 * tradujo, sus cinco casos discrepaban con el sistema en uno
 * (`docs/diseno-2026-08-12-traduccion.md:208`); derivarlos elimina la clase
 * entera de ese defecto.
 */

import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { conBase, db, tarifa } from "@/db";
import { sesionActual } from "@/lib/auth";
import { obtenerEstacionamiento } from "@/lib/contexto";
import { destinoDe } from "@/lib/roles";
import { calcularMonto, minutosCobrados } from "@/lib/tarificacion";
import Cabecera from "../../cabecera";
import CerrarSesion from "../../cerrar-sesion";
import FormularioTarifa from "./formulario-tarifa";

export const dynamic = "force-dynamic";

/**
 * Las permanencias del simulador, en minutos. Son los cinco casos de la maqueta:
 * uno por debajo del mínimo, uno de fracción exacta, uno que cruza la hora, uno
 * redondo y uno largo. **Los minutos son del diseño; los montos NO** — esos los
 * calcula el sistema.
 */
const CASOS_SIMULADOR = [12, 45, 113, 240, 560];

const pesos = (n: number) => `$ ${n.toLocaleString("es-CL")}`;

function comoDuracion(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m} MIN`;
  return m === 0 ? `${h} H` : `${h} H ${String(m).padStart(2, "0")}`;
}

export default async function Tarifas() {
  const usuario = await sesionActual();
  if (!usuario) redirect("/login");
  if (usuario.rol !== "dueño") redirect(destinoDe(usuario.rol));
  // La base garantiza `pertenencia_por_rol`; se comprueba igual, porque sin esto
  // la cláusula de aislamiento compararía contra null.
  if (usuario.estacionamientoId === null) redirect("/login");

  const est = await obtenerEstacionamiento(usuario.estacionamientoId);

  // El histórico completo, del más reciente al más viejo. La primera fila cuya
  // vigencia ya empezó es la que usa la salida — el mismo criterio que
  // `obtenerTarifaVigente`, resuelto acá sobre la lista que ya se trajo.
  const versiones = await conBase(() =>
    db
      .select()
      .from(tarifa)
      .where(eq(tarifa.estacionamientoId, est.id))
      .orderBy(desc(tarifa.vigenteDesde)),
  );

  const ahora = new Date();
  const vigente = versiones.find((v) => v.vigenteDesde <= ahora) ?? null;
  const anteriores = versiones.filter((v) => v !== vigente);

  const fecha = (d: Date) =>
    new Intl.DateTimeFormat("es-CL", {
      timeZone: est.zonaHoraria,
      dateStyle: "short",
    }).format(d);

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <Cabecera contexto={est.nombre} titulo="Tarifas" accion={<CerrarSesion />} />

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 p-4 pb-10">
        <header className="flex flex-col gap-2">
          <span className="eyebrow">Tarifas</span>
          <h2 className="text-xl font-medium tracking-tight text-ink">
            Los valores que el sistema usa para calcular
          </h2>
          <p className="text-sm leading-relaxed text-subtle">
            Cambiar una tarifa crea una <strong className="font-medium text-muted">versión
            nueva</strong> con su fecha de vigencia. Las sesiones ya cerradas conservan el
            valor con que se calcularon.
          </p>
        </header>

        {vigente === null ? (
          // Estado vacío real: sin tarifa vigente no se puede cerrar una salida.
          // Se dice lo que pasa y qué hacer, no una tarjeta en blanco.
          <section
            role="status"
            className="flex flex-col gap-1 rounded-2xl border border-critical/25 bg-card p-4"
          >
            <p className="text-sm font-medium text-critical">
              Este estacionamiento no tiene tarifa vigente.
            </p>
            <p className="text-xs leading-relaxed text-muted">
              Sin ella el operador no puede cerrar una salida: el monto se calcula en el
              servidor con la tarifa vigente. Carga una abajo.
            </p>
          </section>
        ) : (
          <section className="overflow-hidden rounded-2xl border border-line bg-card shadow-xs">
            <div className="grid grid-cols-3 gap-px bg-line">
              <div className="flex flex-col gap-1 bg-card p-4">
                <p className="mono-caption">valor_hora</p>
                <p data-testid="valor-hora" className="text-lg font-medium tabular text-ink">
                  {pesos(vigente.valorHora)}
                </p>
                <p className="text-[0.6875rem] text-faint">por hora completa</p>
              </div>
              <div className="flex flex-col gap-1 bg-card p-4">
                <p className="mono-caption">fraccion_minutos</p>
                <p data-testid="fraccion" className="text-lg font-medium tabular text-ink">
                  {vigente.fraccionMinutos}
                </p>
                <p className="text-[0.6875rem] text-faint">unidad mínima de cobro</p>
              </div>
              <div className="flex flex-col gap-1 bg-card p-4">
                <p className="mono-caption">monto_minimo</p>
                <p data-testid="monto-minimo" className="text-lg font-medium tabular text-ink">
                  {pesos(vigente.montoMinimo)}
                </p>
                <p className="text-[0.6875rem] text-faint">piso de cobro</p>
              </div>
            </div>
            <div className="border-t border-line bg-canvas px-4 py-3">
              <p className="text-xs text-subtle tabular">
                Vigente desde <span className="font-mono">{fecha(vigente.vigenteDesde)}</span>
              </p>
            </div>
          </section>
        )}

        {/* Simulador — los montos los calcula `calcularMonto`, no la maqueta. */}
        {vigente !== null && (
          <section className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4 shadow-xs">
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-medium text-ink">Simulador</h3>
              <p className="text-xs leading-relaxed text-subtle">
                Cómo queda el cobro con estos tres valores. Es el mismo cálculo que corre a
                la salida.
              </p>
            </div>
            <ul data-testid="simulador" className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line">
              {CASOS_SIMULADOR.map((minutos) => {
                const entradaAt = new Date(0);
                const salidaAt = new Date(minutos * 60_000);
                const monto = calcularMonto(
                  { entradaAt, salidaAt },
                  {
                    valorHora: vigente.valorHora,
                    fraccionMinutos: vigente.fraccionMinutos,
                    montoMinimo: vigente.montoMinimo,
                  },
                );
                const cobrados = minutosCobrados({ entradaAt, salidaAt }, vigente.fraccionMinutos);
                return (
                  <li key={minutos} className="flex flex-col gap-1 bg-canvas p-3">
                    <p className="mono-caption">{comoDuracion(minutos)}</p>
                    <p className="font-mono text-sm font-medium text-ink tabular">
                      {pesos(monto)}
                    </p>
                    <p className="font-mono text-[0.625rem] text-faint tabular">
                      {cobrados} min cobrados
                    </p>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <FormularioTarifa />

        {anteriores.length > 0 && (
          <section className="flex flex-col gap-2" aria-labelledby="historico-titulo">
            <h3 id="historico-titulo" className="mono-caption">
              Versiones anteriores
            </h3>
            <ul data-testid="historico" className="flex flex-col gap-2">
              {anteriores.map((v) => (
                <li
                  key={v.id}
                  className="flex items-baseline justify-between gap-3 rounded-xl border border-line bg-card px-4 py-3"
                >
                  <span className="text-xs text-subtle tabular">
                    {pesos(v.valorHora)} · {v.fraccionMinutos} min · mín {pesos(v.montoMinimo)}
                  </span>
                  <span className="font-mono text-[0.6875rem] text-faint">
                    {fecha(v.vigenteDesde)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs leading-relaxed text-subtle">
              No se borran: una salida vieja se puede recalcular con la tarifa que regía
              entonces.
            </p>
          </section>
        )}

        {/* El aviso del diseño, que además es correcto sobre el alcance. */}
        <aside className="flex gap-3 rounded-2xl border border-line bg-card p-4">
          <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-line-strong" />
          <p className="text-xs leading-relaxed text-muted">
            No hay tarifa nocturna, de fin de semana ni por tramos. La spec define tres
            valores y el cálculo está cubierto por AC-OP-2; agregar tramos rompe esa prueba
            y necesita su propio ADR.
          </p>
        </aside>
      </main>
    </div>
  );
}
