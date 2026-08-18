/**
 * Cabecera oscura — la firma visual del sistema de diseño de C4A.
 *
 * Es el bloque `--ink` que abre las tres pantallas del producto (operador,
 * dueño, plataforma), con un rótulo mono de contexto arriba y el título en
 * blanco. Antes cada pantalla escribía su propia cabecera clara; esto las
 * unifica con la maqueta del diseño y evita repetir la superficie oscura —que,
 * por AC-UI-1, no puede llevar un hex suelto en cada `.tsx`.
 *
 * `contexto` es el rótulo mono (nombre de la empresa, "hoy", el email); `titulo`
 * es el H1. `accion` es el slot de la derecha —cerrar sesión, un estado—.
 */
import type { ReactNode } from "react";

export default function Cabecera({
  contexto,
  titulo,
  accion,
}: {
  contexto: string;
  titulo: string;
  accion?: ReactNode;
}) {
  return (
    <header className="bg-ink px-5 pt-5 pb-6 text-white">
      <div className="mx-auto flex w-full max-w-md items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="mono-caption text-white/45">{contexto}</span>
          <h1 className="text-white">{titulo}</h1>
        </div>
        {accion}
      </div>
    </header>
  );
}
