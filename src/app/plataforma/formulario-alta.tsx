"use client";

/**
 * Formulario de alta de cliente.
 *
 * La validacion de verdad vive en el servidor (`api/plataforma/clientes`): esto
 * solo evita viajes obvios y muestra los campos que el servidor devolvio como
 * invalidos. **El cliente no es una frontera de seguridad**, y por eso no repite
 * las reglas: si divergieran, la del servidor manda y la de aca seria una mentira
 * mantenida en dos lugares.
 */

import { useState } from "react";

type Estado =
  | { tipo: "quieto" }
  | { tipo: "enviando" }
  | { tipo: "creado"; nombre: string }
  | { tipo: "error"; mensaje: string; campos: string[] };

const CAMPOS = [
  { id: "nombre", etiqueta: "Nombre del estacionamiento", tipo: "text" },
  { id: "zonaHoraria", etiqueta: "Zona horaria", tipo: "text", valor: "America/Santiago" },
  { id: "capacidadTotal", etiqueta: "Capacidad total", tipo: "number" },
  { id: "valorHora", etiqueta: "Valor por hora (pesos)", tipo: "number" },
  { id: "fraccionMinutos", etiqueta: "Fraccion de cobro (minutos)", tipo: "number" },
  { id: "montoMinimo", etiqueta: "Monto minimo (pesos)", tipo: "number" },
  { id: "emailDueno", etiqueta: "Email del dueno", tipo: "email" },
  { id: "emailOperador", etiqueta: "Email del operador", tipo: "email" },
] as const;

const NUMERICOS = new Set(["capacidadTotal", "valorHora", "fraccionMinutos", "montoMinimo"]);

export default function FormularioAlta() {
  const [estado, setEstado] = useState<Estado>({ tipo: "quieto" });

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const form = evento.currentTarget;
    const datos = new FormData(form);

    const cuerpo: Record<string, unknown> = {};
    for (const { id } of CAMPOS) {
      const bruto = String(datos.get(id) ?? "");
      // Los numericos van como numero: el servidor rechaza el texto numerico a
      // proposito, para que "10" y 10 no sean la misma cosa en la frontera.
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
      setEstado({
        tipo: "error",
        mensaje: respuesta?.error ?? `El alta no se pudo completar (HTTP ${r.status}).`,
        campos: Array.isArray(respuesta?.campos) ? respuesta.campos : [],
      });
    } catch {
      // Sin red no se puede dar de alta, y se dice: esta pantalla no es
      // offline-first. Lo que tiene que funcionar sin conexion es el ingreso del
      // operador (H1), no el aprovisionamiento.
      setEstado({
        tipo: "error",
        mensaje: "No hay conexion con el servidor. El alta necesita red.",
        campos: [],
      });
    }
  }

  const invalidos = estado.tipo === "error" ? estado.campos : [];

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      {CAMPOS.map(({ id, etiqueta, tipo, ...resto }) => (
        <label key={id} className="flex flex-col gap-1">
          <span className="text-sm font-medium">{etiqueta}</span>
          <input
            name={id}
            type={tipo}
            defaultValue={"valor" in resto ? resto.valor : undefined}
            aria-invalid={invalidos.includes(id) || undefined}
            className="rounded border px-3 py-2"
          />
        </label>
      ))}

      <button
        type="submit"
        disabled={estado.tipo === "enviando"}
        className="rounded bg-black px-4 py-2 font-medium text-white disabled:opacity-50"
      >
        {estado.tipo === "enviando" ? "Creando..." : "Crear cliente"}
      </button>

      {estado.tipo === "creado" && (
        <p role="status" className="text-sm">
          Cliente creado: {estado.nombre}. Ya puede operar: tiene tarifa vigente,
          dueno y operador.
        </p>
      )}
      {estado.tipo === "error" && (
        <p role="alert" className="text-sm">
          {estado.mensaje}
          {estado.campos.length > 0 && ` Revisa: ${estado.campos.join(", ")}.`}
        </p>
      )}
    </form>
  );
}
