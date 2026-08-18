"use client";

/**
 * Formulario de alta de cliente.
 *
 * La validacion de verdad vive en el servidor (`api/plataforma/clientes`): esto
 * solo evita viajes obvios y muestra los campos que el servidor devolvio como
 * invalidos. **El cliente no es una frontera de seguridad**, y por eso no repite
 * las reglas: si divergieran, la del servidor manda.
 *
 * Accesibilidad, por los hallazgos del experto de frontend del concilio: el
 * foco va al primer campo con error, cada campo invalido lleva `aria-describedby`
 * al mensaje, el `<form>` es `noValidate` (la validacion real es del servidor, y
 * la burbuja nativa dejaba la pantalla muda), y el estado se anuncia por
 * `aria-live`.
 */

import { useId, useRef, useState } from "react";

type Estado =
  | { tipo: "quieto" }
  | { tipo: "enviando" }
  | { tipo: "creado"; nombre: string }
  | { tipo: "error"; mensaje: string; campos: string[] };

type Campo = {
  id: string;
  etiqueta: string;
  tipo: "text" | "number" | "email";
  modo: "text" | "numeric" | "email";
  valor?: string;
};

const GRUPOS: { titulo: string; campos: Campo[] }[] = [
  {
    titulo: "Estacionamiento",
    campos: [
      { id: "nombre", etiqueta: "Nombre", tipo: "text", modo: "text" },
      { id: "zonaHoraria", etiqueta: "Zona horaria", tipo: "text", modo: "text", valor: "America/Santiago" },
      { id: "capacidadTotal", etiqueta: "Cupos", tipo: "number", modo: "numeric" },
    ],
  },
  {
    titulo: "Tarifa vigente",
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

const CAMPOS = GRUPOS.flatMap((g) => g.campos);
const NUMERICOS = new Set(["capacidadTotal", "valorHora", "fraccionMinutos", "montoMinimo"]);

export default function FormularioAlta() {
  const [estado, setEstado] = useState<Estado>({ tipo: "quieto" });
  const formRef = useRef<HTMLFormElement>(null);
  const errorId = useId();

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const form = evento.currentTarget;
    const datos = new FormData(form);

    const cuerpo: Record<string, unknown> = {};
    for (const { id } of CAMPOS) {
      const bruto = String(datos.get(id) ?? "");
      // Los numericos van como numero; el servidor igual acepta el texto numerico.
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
        form.reset();
        return;
      }
      const campos = Array.isArray(respuesta?.campos) ? respuesta.campos : [];
      setEstado({
        tipo: "error",
        mensaje: respuesta?.error ?? `El alta no se pudo completar (HTTP ${r.status}).`,
        campos,
      });
      // Foco al primer campo con error: quien usa teclado o lector no tiene que
      // recorrer ocho campos para encontrar cuál falló.
      const primero = campos[0] ?? CAMPOS[0]?.id;
      form.querySelector<HTMLInputElement>(`[name="${primero}"]`)?.focus();
    } catch {
      setEstado({
        tipo: "error",
        mensaje: "No hay conexión con el servidor. El alta necesita red.",
        campos: [],
      });
    }
  }

  const invalidos = estado.tipo === "error" ? estado.campos : [];

  return (
    <form ref={formRef} onSubmit={enviar} noValidate className="flex flex-col gap-6">
      {GRUPOS.map((grupo) => (
        <fieldset key={grupo.titulo} className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-5 shadow-xs">
          <legend className="mono-caption px-1 text-subtle">{grupo.titulo}</legend>
          {grupo.campos.map((campo) => {
            const malo = invalidos.includes(campo.id);
            return (
              <label key={campo.id} className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-muted">{campo.etiqueta}</span>
                <input
                  name={campo.id}
                  type={campo.tipo}
                  inputMode={campo.modo as "text" | "numeric" | "email"}
                  defaultValue={"valor" in campo ? campo.valor : undefined}
                  required
                  aria-invalid={malo || undefined}
                  aria-describedby={malo ? errorId : undefined}
                  className="campo"
                />
              </label>
            );
          })}
        </fieldset>
      ))}

      <button type="submit" disabled={estado.tipo === "enviando"} className="btn-primario w-full">
        {estado.tipo === "enviando" ? "Creando cliente…" : "Crear cliente"}
      </button>

      {/* Región viva permanente: anuncia la espera y el resultado sin depender de
          que aparezca un nodo nuevo, que un lector puede no leer. */}
      <p aria-live="polite" className="min-h-5 text-sm">
        {estado.tipo === "enviando" && <span className="text-subtle">Creando cliente…</span>}
        {estado.tipo === "creado" && (
          <span className="text-success">
            Cliente creado: {estado.nombre}. Ya puede operar: tiene tarifa vigente, dueño y operador.
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
