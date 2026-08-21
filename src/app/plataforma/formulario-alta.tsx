"use client";

/**
 * Alta de cliente — wizard de cuatro pasos (diseño 1h, adaptado a UN recinto).
 *
 * El canvas 1h muestra un stepper Empresa → Sitios → Tarifa → Operadores, con
 * «Sitios» en plural: eso es multisitio, y está fuera de alcance (ADR-001/004).
 * Acá el mismo lenguaje visual —stepper numerado, una tarjeta por paso, Atrás/
 * Continuar— sirve a un solo estacionamiento: Estacionamiento → Tarifa →
 * Usuarios → Revisar.
 *
 * ## Por qué estado controlado y no FormData
 *
 * Los pasos ocultan campos, y un `FormData` sobre inputs desmontados pierde lo
 * tecleado. Con un objeto `valores` en estado, lo tecleado sobrevive al cambio de
 * paso y el paso «Revisar» puede mostrarlo antes de enviar.
 *
 * ## El servidor sigue siendo la única frontera
 *
 * La validación de verdad vive en `api/plataforma/clientes`. El «Continuar» solo
 * comprueba que el paso no esté vacío —para no dejar avanzar sin nada—; si el
 * servidor rechaza un campo, el wizard salta al paso que lo contiene y lo enfoca.
 *
 * Accesibilidad (hallazgos del concilio): foco al primer campo con error,
 * `aria-describedby` al mensaje, `aria-live` para el resultado.
 */

import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";

type Campo = {
  id: string;
  etiqueta: string;
  tipo: "text" | "number" | "email";
  modo: "text" | "numeric" | "email";
  valor?: string;
};

const PASOS: { titulo: string; campos: Campo[] }[] = [
  {
    titulo: "Recinto",
    campos: [
      { id: "nombre", etiqueta: "Nombre", tipo: "text", modo: "text" },
      { id: "zonaHoraria", etiqueta: "Zona horaria", tipo: "text", modo: "text", valor: "America/Santiago" },
      { id: "capacidadTotal", etiqueta: "Cupos", tipo: "number", modo: "numeric" },
    ],
  },
  {
    titulo: "Tarifa",
    campos: [
      { id: "valorHora", etiqueta: "Valor por hora (pesos)", tipo: "number", modo: "numeric" },
      { id: "fraccionMinutos", etiqueta: "Fracción de cobro (minutos)", tipo: "number", modo: "numeric" },
      { id: "montoMinimo", etiqueta: "Monto mínimo (pesos)", tipo: "number", modo: "numeric" },
    ],
  },
  {
    titulo: "Usuarios",
    campos: [
      { id: "emailDueno", etiqueta: "Email del dueño", tipo: "email", modo: "email" },
      { id: "emailOperador", etiqueta: "Email del operador", tipo: "email", modo: "email" },
    ],
  },
];

const TODOS = PASOS.flatMap((p) => p.campos);
const NUMERICOS = new Set(["capacidadTotal", "valorHora", "fraccionMinutos", "montoMinimo"]);
const PASO_DE = new Map(PASOS.flatMap((p, i) => p.campos.map((c) => [c.id, i] as const)));
const N_PASOS = PASOS.length + 1; // + Revisar

const valoresIniciales = () =>
  Object.fromEntries(TODOS.map((c) => [c.id, c.valor ?? ""])) as Record<string, string>;

type Estado =
  | { tipo: "quieto" }
  | { tipo: "enviando" }
  | { tipo: "creado"; nombre: string }
  | { tipo: "error"; mensaje: string; campos: string[] };

export default function FormularioAlta() {
  const router = useRouter();
  const [paso, setPaso] = useState(0);
  const [valores, setValores] = useState<Record<string, string>>(valoresIniciales);
  const [estado, setEstado] = useState<Estado>({ tipo: "quieto" });
  const formRef = useRef<HTMLFormElement>(null);
  const errorId = useId();

  const invalidos = estado.tipo === "error" ? estado.campos : [];
  const enRevisar = paso === PASOS.length;
  const set = (id: string, v: string) => setValores((prev) => ({ ...prev, [id]: v }));

  function enfocar(campoId: string) {
    requestAnimationFrame(() => {
      formRef.current?.querySelector<HTMLInputElement>(`[name="${campoId}"]`)?.focus();
    });
  }

  function continuar() {
    // Piso mínimo del paso: ningún campo vacío. El servidor valida el resto.
    const vacio = PASOS[paso].campos.find((c) => valores[c.id].trim() === "");
    if (vacio) {
      setEstado({ tipo: "error", mensaje: "Completa los campos de este paso.", campos: [vacio.id] });
      enfocar(vacio.id);
      return;
    }
    setEstado({ tipo: "quieto" });
    setPaso((p) => p + 1);
  }

  async function crear() {
    const cuerpo: Record<string, unknown> = {};
    for (const { id } of TODOS) {
      const bruto = valores[id];
      cuerpo[id] = NUMERICOS.has(id) ? (bruto === "" ? null : Number(bruto)) : bruto;
    }

    setEstado({ tipo: "enviando" });
    try {
      const r = await fetch("/api/plataforma/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      const respuesta = await r.json().catch(() => ({}));

      if (r.status === 201) {
        setEstado({ tipo: "creado", nombre: respuesta?.cliente?.nombre ?? "" });
        setValores(valoresIniciales());
        setPaso(0);
        // **Sin esto la pantalla se contradice a sí misma.** `Plataforma` es un
        // componente de servidor y consulta el listado una sola vez, al
        // renderizar: el aviso decía «Cliente creado» y la lista de abajo no lo
        // mostraba hasta recargar a mano. Y el daño no era cosmético — al no
        // verlo, quien da de alta puede concluir que falló y repetirla, y el
        // servidor la acepta como un cliente distinto (no hay deduplicación por
        // nombre). Hallazgo del experto de frontend del concilio.
        router.refresh();
        return;
      }
      const campos: string[] = Array.isArray(respuesta?.campos) ? respuesta.campos : [];
      setEstado({
        tipo: "error",
        mensaje: respuesta?.error ?? `El alta no se pudo completar (HTTP ${r.status}).`,
        campos,
      });
      // Salta al paso del primer campo que el servidor rechazó y lo enfoca.
      const primero = campos.find((c) => PASO_DE.has(c));
      if (primero !== undefined) {
        setPaso(PASO_DE.get(primero)!);
        enfocar(primero);
      }
    } catch {
      setEstado({ tipo: "error", mensaje: "No hay conexión con el servidor. El alta necesita red.", campos: [] });
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        enRevisar ? crear() : continuar();
      }}
      noValidate
      className="flex flex-col gap-6"
    >
      {/* Stepper del diseño 1h: círculo lleno para hecho/actual, borde para
          pendiente; la línea entre pasos se llena al avanzar. */}
      <ol className="flex items-center gap-2" aria-label={`Paso ${paso + 1} de ${N_PASOS}`}>
        {[...PASOS.map((p) => p.titulo), "Revisar"].map((titulo, i) => (
          <li key={titulo} className="flex flex-1 items-center gap-2 last:flex-none">
            <span
              aria-current={i === paso ? "step" : undefined}
              className={`flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-xs ${
                i <= paso ? "bg-ink text-white" : "border border-line-strong text-faint"
              }`}
            >
              {i + 1}
            </span>
            <span className={`hidden text-xs sm:inline ${i === paso ? "font-medium text-ink" : "text-faint"}`}>
              {titulo}
            </span>
            {i < N_PASOS - 1 && <span className={`h-px flex-1 ${i < paso ? "bg-ink" : "bg-line"}`} />}
          </li>
        ))}
      </ol>

      {enRevisar ? (
        <section className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-5 shadow-xs">
          <h2 className="text-sm font-medium text-ink normal-case tracking-normal">Revisar y crear</h2>
          <dl className="flex flex-col gap-2">
            {TODOS.map((c) => (
              <div key={c.id} className="flex items-baseline justify-between gap-3 border-b border-line-soft pb-2 last:border-0">
                <dt className="text-xs text-faint">{c.etiqueta}</dt>
                <dd className={`text-right text-sm text-ink ${NUMERICOS.has(c.id) ? "tabular font-mono" : ""}`}>
                  {valores[c.id] || "—"}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : (
        <fieldset className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-5 shadow-xs">
          <legend className="mono-caption px-1 text-subtle">{PASOS[paso].titulo}</legend>
          {PASOS[paso].campos.map((campo) => {
            const malo = invalidos.includes(campo.id);
            return (
              <label key={campo.id} className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-muted">{campo.etiqueta}</span>
                <input
                  name={campo.id}
                  type={campo.tipo}
                  inputMode={campo.modo}
                  value={valores[campo.id]}
                  onChange={(e) => set(campo.id, e.target.value)}
                  aria-invalid={malo || undefined}
                  aria-describedby={malo ? errorId : undefined}
                  className="campo"
                />
              </label>
            );
          })}
        </fieldset>
      )}

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            setEstado({ tipo: "quieto" });
            setPaso((p) => Math.max(0, p - 1));
          }}
          disabled={paso === 0 || estado.tipo === "enviando"}
          className="rounded-full border border-line-strong bg-card px-5 py-3 font-medium text-muted disabled:opacity-40"
        >
          Atrás
        </button>
        <button type="submit" disabled={estado.tipo === "enviando"} className="btn-primario">
          {estado.tipo === "enviando"
            ? "Creando cliente…"
            : enRevisar
              ? "Crear cliente"
              : "Continuar"}
        </button>
      </div>

      <p aria-live="polite" className="min-h-5 text-sm">
        {estado.tipo === "creado" && (
          <span className="text-success">
            Cliente creado: {estado.nombre}. Ya puede operar: tiene tarifa vigente, dueño y operador.
          </span>
        )}
        {estado.tipo === "error" && (
          <span id={errorId} role="alert" className="text-critical">
            {estado.mensaje}
            {estado.campos.length > 0 && ` Revisa: ${estado.campos.join(", ")}.`}
          </span>
        )}
      </p>
    </form>
  );
}
