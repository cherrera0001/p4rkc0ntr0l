"use client";

/**
 * Pantalla del operador — spec.md §5.
 *
 * Una sola pantalla, un solo estacionamiento. El operador registra de pie y con
 * una mano, así que todo lo importante entra sin scroll y los objetivos táctiles
 * son grandes.
 *
 * Instrumentación de H1 (§6): `tecleo_inicio_at` se marca al tocar "Nuevo
 * ingreso" y `tecleo_fin_at` al confirmar. Su diferencia es la métrica que el
 * piloto mide, así que no es telemetría opcional: es parte del producto.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import {
  eliminar,
  guardar,
  pendientes,
  purgarNoFixtures,
  purgarSincronizadas,
  sincronizar,
  type SesionLocal,
} from "@/lib/cola-local";
import { esPatenteFixture } from "@/lib/fixtures";
import { validarPatente } from "@/lib/patente";

function duracion(desde: string): string {
  const ms = Date.now() - new Date(desde).getTime();
  const min = Math.floor(ms / 60_000);
  const h = Math.floor(min / 60);
  return h > 0 ? `${h} h ${min % 60} min` : `${min} min`;
}

/** Sesión activa tal como la devuelve `GET /api/sesiones`. */
type SesionServidor = {
  id: string;
  patente: string;
  entradaAt: string;
};

/** Fila de la lista en pantalla, venga del servidor o de la cola local. */
type EnPantalla = {
  id: string;
  patente: string;
  entradaAt: string;
  pendiente: boolean;
};

/** Salida recién cobrada. Vive en memoria: no se persiste en el dispositivo. */
type Cobrada = {
  id: string;
  patente: string;
  montoCalculado: number | null;
};

export default function PantallaOperador({
  operacionReal,
}: {
  /**
   * Llega del servidor, que es el único que puede leer la variable de entorno.
   * Con `false`, una patente que no sea de prueba se rechaza ANTES de tocar
   * IndexedDB (hallazgo A-3).
   */
  operacionReal: boolean;
}) {
  /**
   * Las sesiones que ya están en el servidor se leen del servidor (M-4). Antes
   * la lista salía de IndexedDB, y por eso el dispositivo tenía que conservar
   * todas las patentes para poder mostrarlas.
   */
  const [activasServidor, setActivasServidor] = useState<SesionServidor[]>([]);
  /** Cola local: lo que todavía no llegó al servidor. Es lo único que se guarda. */
  const [cola, setCola] = useState<SesionLocal[]>([]);
  const [cobradas, setCobradas] = useState<Cobrada[]>([]);
  const [listaCompleta, setListaCompleta] = useState(true);
  const [tecleando, setTecleando] = useState(false);
  const [patente, setPatente] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enLinea, setEnLinea] = useState(true);
  const [, forzarRender] = useState(0);

  const tecleoInicioAt = useRef<string | null>(null);
  const campo = useRef<HTMLInputElement>(null);

  const refrescar = useCallback(async () => {
    // Primero lo local: funciona sin red y es lo que sostiene AC-OP-1.
    setCola(await pendientes());
    try {
      const r = await fetch("/api/sesiones", { cache: "no-store" });
      if (!r.ok) {
        setListaCompleta(false);
        return;
      }
      const { sesiones } = (await r.json()) as { sesiones: SesionServidor[] };
      setActivasServidor(sesiones);
      setListaCompleta(true);
    } catch {
      // Sin red: se sigue mostrando la última lista recibida, que vive en
      // memoria y se pierde al recargar. Deliberadamente NO se guarda en disco:
      // una caché persistente de la respuesta del servidor sería la misma copia
      // local que M-4 viene a eliminar, con otro nombre.
      setListaCompleta(false);
    }
  }, []);

  const sincronizarYRefrescar = useCallback(async () => {
    const { rechazadas } = await sincronizar();
    if (rechazadas > 0) {
      setError(
        `El servidor rechazó ${rechazadas} registro(s) de la cola. Se borraron ` +
          "del dispositivo: hay que registrarlos de nuevo.",
      );
    }
    await refrescar();
  }, [refrescar]);

  useEffect(() => {
    const limpiarYRefrescar = async () => {
      // Red de seguridad de A-3: un dispositivo que usó una versión anterior
      // puede tener patentes reales atascadas en la cola. Se borran al abrir.
      if (!operacionReal) await purgarNoFixtures();
      // Purga de M-4: lo que el servidor ya tiene no se queda en el dispositivo.
      await purgarSincronizadas();
      await refrescar();
    };
    void limpiarYRefrescar();
    setEnLinea(navigator.onLine);

    const alConectar = async () => {
      setEnLinea(true);
      await sincronizarYRefrescar();
    };
    const alDesconectar = () => setEnLinea(false);

    window.addEventListener("online", alConectar);
    window.addEventListener("offline", alDesconectar);
    if (navigator.onLine) void alConectar();

    // El temporizador de permanencia (§5) tiene que avanzar solo.
    const reloj = setInterval(() => forzarRender((n) => n + 1), 30_000);

    return () => {
      window.removeEventListener("online", alConectar);
      window.removeEventListener("offline", alDesconectar);
      clearInterval(reloj);
    };
  }, [refrescar, sincronizarYRefrescar, operacionReal]);

  function nuevoIngreso() {
    tecleoInicioAt.current = new Date().toISOString();
    setTecleando(true);
    setPatente("");
    setError(null);
    queueMicrotask(() => campo.current?.focus());
  }

  function cancelar() {
    tecleoInicioAt.current = null;
    setTecleando(false);
    setPatente("");
    setError(null);
  }

  async function confirmar(evento: React.FormEvent) {
    evento.preventDefault();

    const validacion = validarPatente(patente);
    if (!validacion.valida) {
      setError(validacion.motivo);
      return;
    }

    // Barrera de datos personales, PRIMERA línea (hallazgo A-3).
    //
    // Tiene que estar acá, antes de `guardar()`. La barrera del servidor llega
    // tarde: para cuando responde 403 el dato ya se escribió en el dispositivo,
    // y bajo la Ley 21.719 recolectar y almacenar localmente ya es tratamiento.
    // Rechazar antes de persistir es la diferencia entre no tratar el dato y
    // tratarlo mal.
    if (!operacionReal && !esPatenteFixture(validacion.patente)) {
      setError(
        "El piloto solo acepta patentes de prueba. Esta patente no se registró " +
          "ni se guardó en el dispositivo.",
      );
      // Se limpia el campo: si era una patente real, tampoco tiene por qué
      // quedar a la vista. El formulario sigue abierto para volver a intentar.
      setPatente("");
      campo.current?.focus();
      return;
    }

    const ahora = new Date().toISOString();
    const sesion: SesionLocal = {
      id: crypto.randomUUID(),
      patente: validacion.patente,
      entradaAt: ahora,
      tecleoInicioAt: tecleoInicioAt.current ?? ahora,
      tecleoFinAt: ahora,
      estado: "activa",
      syncEstado: "local",
      montoCalculado: null,
      salidaAt: null,
    };

    // Primero al disco local. Recién después la red. Ese orden es el que hace
    // que el registro no dependa de la señal.
    await guardar(sesion);
    cancelar();
    await refrescar();

    void sincronizarYRefrescar();
  }

  async function registrarSalida(vehiculo: EnPantalla) {
    setError(null);
    try {
      const r = await fetch(`/api/sesiones/${vehiculo.id}/salida`, { method: "POST" });
      if (!r.ok) {
        setError("No se pudo registrar la salida. Reintentá.");
        return;
      }
      const { sesion: cerrada } = await r.json();
      // La salida quedó registrada en el servidor: la copia local ya no tiene
      // razón de existir (M-4). Si la sesión nunca fue local, esto es un no-op.
      await eliminar(vehiculo.id);
      // El monto se muestra para cobrar en efectivo (spec.md §5). Se guarda en
      // memoria mientras la pantalla siga abierta, no en el dispositivo.
      setCobradas((previas) =>
        [
          { id: vehiculo.id, patente: vehiculo.patente, montoCalculado: cerrada.montoCalculado },
          ...previas.filter((c) => c.id !== vehiculo.id),
        ].slice(0, 3),
      );
      await refrescar();
    } catch {
      setError("Sin conexión: la salida necesita red para calcular el monto.");
    }
  }

  // La lista es la unión de lo que el servidor tiene por activo y lo que todavía
  // está en la cola. Se deduplica por id: una sesión recién sincronizada puede
  // aparecer en ambos lados por un instante.
  const idsServidor = new Set(activasServidor.map((s) => s.id));
  const activas: EnPantalla[] = [
    ...activasServidor.map((s) => ({
      id: s.id,
      patente: s.patente,
      entradaAt: s.entradaAt,
      pendiente: false,
    })),
    ...cola
      .filter((s) => !idsServidor.has(s.id))
      .map((s) => ({
        id: s.id,
        patente: s.patente,
        entradaAt: s.entradaAt,
        pendiente: true,
      })),
  ].sort((a, b) => a.entradaAt.localeCompare(b.entradaAt));
  const sinSincronizar = cola.length;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Estacionamiento</h1>
        <span
          data-testid="estado-conexion"
          className={`rounded-full px-2 py-1 text-xs font-medium ${
            enLinea
              ? "bg-emerald-100 text-emerald-900"
              : "bg-amber-100 text-amber-900"
          }`}
        >
          {enLinea ? "en línea" : "sin conexión"}
        </span>
      </header>

      <p className="text-sm text-slate-600 dark:text-slate-400">
        Ocupación: <strong data-testid="ocupacion">{activas.length}</strong>
        {sinSincronizar > 0 && (
          <span data-testid="pendientes" className="ml-2 text-amber-700">
            · {sinSincronizar} sin sincronizar
          </span>
        )}
      </p>

      {!tecleando ? (
        <button
          type="button"
          onClick={nuevoIngreso}
          data-testid="nuevo-ingreso"
          className="rounded-xl bg-slate-900 px-4 py-5 text-lg font-semibold text-white active:bg-slate-700"
        >
          Nuevo ingreso
        </button>
      ) : (
        <form onSubmit={confirmar} className="flex flex-col gap-3">
          <label htmlFor="patente" className="text-sm font-medium">
            Patente
          </label>
          <input
            id="patente"
            ref={campo}
            data-testid="campo-patente"
            value={patente}
            onChange={(e) => setPatente(e.target.value.toUpperCase())}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            inputMode="text"
            maxLength={10}
            className="rounded-xl border-2 border-slate-300 px-4 py-4 text-center text-2xl font-mono tracking-widest uppercase"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              data-testid="confirmar-ingreso"
              className="flex-1 rounded-xl bg-slate-900 px-4 py-4 text-lg font-semibold text-white active:bg-slate-700"
            >
              Confirmar
            </button>
            <button
              type="button"
              onClick={cancelar}
              className="rounded-xl border-2 border-slate-300 px-4 py-4 font-medium"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {error && (
        <p data-testid="error" role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {!operacionReal && (
        <p
          data-testid="aviso-piloto"
          className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900"
        >
          <strong>Piloto con datos de prueba.</strong> Solo se aceptan patentes
          de prueba, y una patente real ni siquiera se guarda en este
          dispositivo. Para registrar vehículos reales hay que definir antes la
          base de licitud y el plazo de retención (Ley 21.719).
        </p>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-slate-500">En el estacionamiento</h2>
        {activas.length === 0 && (
          <p className="text-sm text-slate-500">Sin vehículos registrados.</p>
        )}
        {!listaCompleta && (
          <p data-testid="lista-parcial" className="text-xs text-amber-700">
            Sin conexión con el servidor: se muestra la última lista recibida más
            los ingresos que siguen en este dispositivo. Al reconectar se
            completa.
          </p>
        )}
        <ul data-testid="lista-activas" className="flex flex-col gap-2">
          {activas.map((s) => (
            <li
              key={s.id}
              data-patente={s.patente}
              data-sync={s.pendiente ? "local" : "sincronizada"}
              className="flex items-center justify-between rounded-xl border border-slate-200 p-3"
            >
              <div>
                <p className="font-mono text-lg font-semibold tracking-wider">{s.patente}</p>
                <p className="text-xs text-slate-500">
                  {duracion(s.entradaAt)}
                  {s.pendiente && " · sin sincronizar"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => registrarSalida(s)}
                className="rounded-lg bg-slate-100 px-4 py-3 font-medium active:bg-slate-200"
              >
                Salida
              </button>
            </li>
          ))}
        </ul>
      </section>

      {cobradas.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-slate-500">Últimas salidas</h2>
          <ul data-testid="lista-cerradas" className="flex flex-col gap-2">
            {cobradas.map((s) => (
              <li
                key={s.id}
                data-patente={s.patente}
                className="flex items-center justify-between rounded-xl bg-slate-50 p-3"
              >
                <span className="font-mono tracking-wider">{s.patente}</span>
                <span className="font-semibold" data-testid="monto">
                  $ {s.montoCalculado?.toLocaleString("es-CL") ?? "—"}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-500">
            El cobro es en efectivo, fuera del sistema.
          </p>
        </section>
      )}
    </main>
  );
}
