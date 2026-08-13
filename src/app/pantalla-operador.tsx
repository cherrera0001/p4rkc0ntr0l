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

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import {
  eliminar,
  guardar,
  listar,
  purgarNoActivas,
  purgarNoFixtures,
  reconciliarActivas,
  sincronizar,
  type SesionActivaServidor,
  type SesionLocal,
} from "@/lib/cola-local";
import { esPatenteFixture } from "@/lib/fixtures";
import { validarPatente } from "@/lib/patente";
import CerrarSesion from "./cerrar-sesion";

/**
 * Cuánto se recuerda que una sesión se cerró acá (hallazgo INT-9).
 *
 * Un `GET /api/sesiones` emitido ANTES del cierre puede resolver después, y su
 * respuesta —legítima cuando salió— todavía lista el vehículo como activo: al
 * aplicarla, `reconciliarActivas` vuelve a escribir en el dispositivo una
 * patente que ya se había borrado. La guarda de orden de `refrescar` no cubre
 * este caso, porque no es una respuesta vieja pisando a una nueva sino una
 * respuesta válida que precede a un cierre local.
 *
 * Treinta segundos cubren de sobra cualquier pedido en vuelo; pasado ese plazo
 * el servidor ya conoce el cierre y su lista manda.
 */
const MEMORIA_CIERRES_MS = 30_000;

/**
 * El reloj, tomado fuera del componente.
 *
 * `Date.now()` es impuro y React lo prohíbe en el cuerpo de un componente, con
 * razón: un valor que cambia en cada render vuelve el render impredecible. Acá
 * se usa dentro de un manejador de evento, no al renderizar, pero la regla no
 * puede distinguirlo — y el módulo es el lugar honesto para el reloj de todas
 * formas.
 */
const ahoraMs = () => Date.now();

/**
 * Estado de conexión, leído del navegador en vez de duplicado en React.
 *
 * Antes era un `useState` que un efecto sincronizaba con `navigator.onLine` al
 * montar. Eso es exactamente el patrón que `useSyncExternalStore` existe para
 * reemplazar: la fuente de verdad es el navegador, no una copia que hay que
 * mantener al día.
 */
function suscribirseAConexion(alCambiar: () => void) {
  window.addEventListener("online", alCambiar);
  window.addEventListener("offline", alCambiar);
  return () => {
    window.removeEventListener("online", alCambiar);
    window.removeEventListener("offline", alCambiar);
  };
}

function duracion(desde: string): string {
  const ms = Date.now() - new Date(desde).getTime();
  const min = Math.floor(ms / 60_000);
  const h = Math.floor(min / 60);
  return h > 0 ? `${h} h ${min % 60} min` : `${min} min`;
}

/** Fila de la lista en pantalla, venga del servidor o del dispositivo. */
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
  /** Lo que el servidor tiene por activo. Manda cuando hay red. */
  const [activasServidor, setActivasServidor] = useState<SesionActivaServidor[]>([]);
  /**
   * Lo que hay en el dispositivo: los pendientes de sincronizar más el espejo
   * de las sesiones activas (ver la invariante en `cola-local.ts`). Es lo que
   * sostiene la pantalla cuando no hay red, y también lo que impide que un
   * `GET` que vuelve corto deje la lista en cero teniendo vehículos adentro.
   */
  const [locales, setLocales] = useState<SesionLocal[]>([]);
  const [cobradas, setCobradas] = useState<Cobrada[]>([]);
  const [listaCompleta, setListaCompleta] = useState(true);
  const [tecleando, setTecleando] = useState(false);
  const [patente, setPatente] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [, forzarRender] = useState(0);

  // En el servidor no hay `navigator`: se asume en línea, que es el estado que
  // la pantalla mostraba antes de hidratar de todos modos.
  const enLinea = useSyncExternalStore(
    suscribirseAConexion,
    () => navigator.onLine,
    () => true,
  );

  const tecleoInicioAt = useRef<string | null>(null);
  const campo = useRef<HTMLInputElement>(null);
  const pidiendoLista = useRef(false);
  const listaPedidaDeNuevo = useRef(false);
  const secuenciaLista = useRef(0);
  const sincronizando = useRef(false);
  const sincronizarDeNuevo = useRef(false);
  /** Sesiones cerradas en este dispositivo hace poco, con el instante del cierre. */
  const cierresRecientes = useRef(new Map<string, number>());

  /** Lo del dispositivo: instantáneo y sin red. Es lo que sostiene AC-OP-1. */
  const refrescarLocales = useCallback(async () => {
    setLocales(await listar());
  }, []);

  /**
   * Trae del servidor las sesiones activas y pone el dispositivo al día.
   *
   * Se pide de a una: el servidor abre UNA conexión a Postgres (`src/db`), así
   * que dos lecturas en paralelo no van más rápido — se encolan, y encima dejan
   * esperando al POST de salida, que es lo que el operador sí está mirando. Si
   * llega un pedido mientras hay otro en vuelo, se marca para repetir al final:
   * nunca se pierde la última actualización.
   *
   * Y sobre eso va una guarda de orden. Un `GET` emitido durante una ráfaga de
   * ingresos puede salir antes de que el `INSERT` llegue a la base y volver
   * corto; si resuelve último, pisa la lista buena y el operador se queda
   * mirando ocupación 0 con el estacionamiento lleno. Solo la respuesta al
   * pedido más reciente puede escribir el estado.
   */
  const refrescar = useCallback(async () => {
    await refrescarLocales();
    if (pidiendoLista.current) {
      listaPedidaDeNuevo.current = true;
      return;
    }
    pidiendoLista.current = true;
    try {
      do {
        listaPedidaDeNuevo.current = false;
        const mio = ++secuenciaLista.current;
        const pedidoDesde = new Date().toISOString();
        try {
          const r = await fetch("/api/sesiones", { cache: "no-store" });
          if (mio !== secuenciaLista.current) continue;
          if (!r.ok) {
            setListaCompleta(false);
            continue;
          }
          const { sesiones } = (await r.json()) as { sesiones: SesionActivaServidor[] };
          if (mio !== secuenciaLista.current) continue;

          // Una respuesta emitida antes de un cierre local todavía lista el
          // vehículo como activo. Aplicarla tal cual volvería a persistir en el
          // dispositivo una patente que ya se borró (hallazgo INT-9): se
          // descuentan los cierres recientes antes de creerle a la lista.
          const limite = ahoraMs() - MEMORIA_CIERRES_MS;
          for (const [id, cuando] of cierresRecientes.current) {
            if (cuando < limite) cierresRecientes.current.delete(id);
          }
          const vigentes = sesiones.filter((s) => !cierresRecientes.current.has(s.id));

          setActivasServidor(vigentes);
          setListaCompleta(true);
          // El dispositivo se queda con lo que está adentro del estacionamiento
          // y suelta lo que el servidor ya no lista (spec.md §8 + M-4).
          await reconciliarActivas(vigentes, pedidoDesde, { soloFixtures: !operacionReal });
          await refrescarLocales();
        } catch {
          // Sin red se sigue mostrando lo que hay en el dispositivo, que ahora
          // incluye las activas: por eso una recarga sin cobertura ya no deja
          // la pantalla en cero.
          setListaCompleta(false);
        }
      } while (listaPedidaDeNuevo.current);
    } finally {
      pidiendoLista.current = false;
    }
  }, [refrescarLocales, operacionReal]);

  /**
   * Sube la cola y repinta. Uno a la vez: sin esta guarda, cada ingreso lanzaba
   * su propia sincronización y todas re-posteaban la cola entera (una misma
   * patente llegó a postearse cuatro veces). Si llega un pedido mientras hay
   * uno en curso se repite al final, así que el ingreso recién guardado nunca
   * se queda sin su intento.
   */
  const sincronizarYRefrescar = useCallback(async () => {
    if (sincronizando.current) {
      sincronizarDeNuevo.current = true;
      return;
    }
    sincronizando.current = true;
    try {
      do {
        sincronizarDeNuevo.current = false;
        const { rechazadas } = await sincronizar();
        if (rechazadas > 0) {
          setError(
            `El servidor rechazó ${rechazadas} registro(s) de la cola. Se borraron ` +
              "del dispositivo: hay que registrarlos de nuevo.",
          );
        }
        await refrescar();
      } while (sincronizarDeNuevo.current);
    } finally {
      sincronizando.current = false;
    }
  }, [refrescar]);

  useEffect(() => {
    // Solo el efecto de sincronizar. Pintar el estado de conexión lo resuelve
    // `useSyncExternalStore`, arriba.
    const alConectar = async () => {
      await sincronizarYRefrescar();
    };

    const arrancar = async () => {
      // Red de seguridad de A-3: un dispositivo que usó una versión anterior
      // puede tener patentes reales atascadas en la cola. Se borran al abrir.
      if (!operacionReal) await purgarNoFixtures();
      // Purga de M-4: lo cerrado no se queda en el dispositivo. Dirigida: no
      // toca los pendientes ni las sesiones que siguen adentro.
      await purgarNoActivas();
      // Se pinta lo que hay en el dispositivo ANTES de tocar la red: con o sin
      // cobertura, el operador ve el estacionamiento apenas abre.
      await refrescarLocales();
      if (navigator.onLine) await alConectar();
    };
    void arrancar();

    window.addEventListener("online", alConectar);

    // El temporizador de permanencia (§5) tiene que avanzar solo. De paso se
    // vuelve a pedir la lista y se reintenta la cola: sin refetch periódico,
    // una lista que quedó corta —o un pendiente diferido por un 429— se queda
    // así hasta que el operador toque algo.
    const reloj = setInterval(() => {
      forzarRender((n) => n + 1);
      if (navigator.onLine) void sincronizarYRefrescar();
    }, 30_000);

    return () => {
      window.removeEventListener("online", alConectar);
      clearInterval(reloj);
    };
  }, [refrescarLocales, sincronizarYRefrescar, operacionReal]);

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
    // La fila aparece con lo local, sin esperar al servidor: el operador ve el
    // ingreso al instante, haya red o no.
    await refrescarLocales();

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
      // Se anota ANTES de borrar: si un `GET` en vuelo resuelve entremedio, ya
      // encuentra el cierre anotado y no vuelve a escribir la patente (INT-9).
      cierresRecientes.current.set(vehiculo.id, ahoraMs());
      // La salida quedó registrada en el servidor: el vehículo ya no está
      // adentro, así que el dispositivo suelta la patente en el acto (M-4).
      await eliminar(vehiculo.id);
      // El monto se muestra para cobrar en efectivo (spec.md §5). Se guarda en
      // memoria mientras la pantalla siga abierta, no en el dispositivo.
      setCobradas((previas) =>
        [
          { id: vehiculo.id, patente: vehiculo.patente, montoCalculado: cerrada.montoCalculado },
          ...previas.filter((c) => c.id !== vehiculo.id),
        ].slice(0, 3),
      );
      // La respuesta ya dice que quedó cerrada: se saca de la lista sin volver a
      // preguntarle al servidor. Un viaje menos por cada salida.
      setActivasServidor((previas) => previas.filter((s) => s.id !== vehiculo.id));
      await refrescarLocales();
    } catch {
      setError("Sin conexión: la salida necesita red para calcular el monto.");
    }
  }

  // La lista es la unión de lo que el dispositivo tiene por activo y lo que el
  // servidor tiene por activo, deduplicada por id. El orden importa: el
  // servidor va segundo porque es la fuente autoritativa cuando hay red. El
  // dispositivo aporta las dos cosas que el servidor no puede dar — los
  // ingresos que todavía no subieron, y la lista entera cuando no hay señal.
  const porId = new Map<string, EnPantalla>();
  for (const s of locales) {
    if (s.estado !== "activa" || !s.patente) continue;
    porId.set(s.id, {
      id: s.id,
      patente: s.patente,
      entradaAt: s.entradaAt,
      pendiente: s.syncEstado === "local",
    });
  }
  for (const s of activasServidor) {
    porId.set(s.id, {
      id: s.id,
      patente: s.patente,
      entradaAt: s.entradaAt,
      pendiente: false,
    });
  }
  const activas: EnPantalla[] = [...porId.values()].sort((a, b) =>
    a.entradaAt.localeCompare(b.entradaAt),
  );
  const sinSincronizar = locales.filter((s) => s.syncEstado === "local").length;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 p-4 pb-10">
      <header className="flex items-start justify-between gap-3 pt-1">
        <div className="flex flex-col gap-1">
          <span className="eyebrow">Operación</span>
          <h1>Estacionamiento</h1>
        </div>
        <CerrarSesion />
      </header>

      {/* AC-UX-1 — el estado de red es contenido de primer nivel, no un ícono.
          El operador tiene que saber sin preguntar si lo que registró ya subió;
          de eso depende que confíe en la app cuando la señal se corta. */}
      <section
        className={`flex items-center gap-4 rounded-2xl border p-4 shadow-xs ${
          enLinea ? "border-line bg-card" : "border-warning/25 bg-warning-soft"
        }`}
      >
        <div className="flex flex-1 flex-col">
          <span className="text-[0.6875rem] font-semibold tracking-[0.16em] text-muted uppercase">
            Ocupación
          </span>
          <span className="cifra tabular" data-testid="ocupacion">
            {activas.length}
          </span>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span
            data-testid="estado-conexion"
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
              enLinea ? "bg-success-soft text-success" : "bg-card text-warning"
            }`}
          >
            <span
              aria-hidden
              className={`size-1.5 rounded-full ${enLinea ? "bg-success" : "bg-warning"}`}
            />
            {enLinea ? "en línea" : "sin conexión"}
          </span>
          {sinSincronizar > 0 && (
            <span data-testid="pendientes" className="text-xs font-medium text-warning">
              {sinSincronizar} esperando red
            </span>
          )}
        </div>
      </section>

      {!tecleando ? (
        <button
          type="button"
          onClick={nuevoIngreso}
          data-testid="nuevo-ingreso"
          className="rounded-2xl bg-accent px-4 py-6 text-lg font-semibold text-white shadow-glow transition-colors duration-200 active:bg-accent-strong"
        >
          Nuevo ingreso
        </button>
      ) : (
        <form onSubmit={confirmar} className="flex flex-col gap-3">
          <label
            htmlFor="patente"
            className="text-[0.6875rem] font-semibold tracking-[0.16em] text-muted uppercase"
          >
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
            className="patente rounded-2xl border-2 border-line-strong bg-card px-4 py-5 text-center text-3xl text-ink caret-accent focus:border-accent focus:outline-none"
          />
          {/* AC-UX-4 — la normalización existe desde M2 y nunca se dijo en
              pantalla. Un operador que no lo sabe teclea el guion. */}
          <p className="text-xs text-faint">Se normaliza sola. Sin guiones ni espacios.</p>
          <div className="flex gap-2">
            <button
              type="submit"
              data-testid="confirmar-ingreso"
              className="flex-1 rounded-2xl bg-accent px-4 py-4 text-lg font-semibold text-white transition-colors duration-200 active:bg-accent-strong"
            >
              Confirmar
            </button>
            <button
              type="button"
              onClick={cancelar}
              className="rounded-2xl border border-line-strong bg-card px-5 py-4 font-medium text-muted transition-colors duration-200 active:bg-canvas-2"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {error && (
        <p
          data-testid="error"
          role="alert"
          className="rounded-xl border border-critical/20 bg-critical-soft p-3 text-sm font-medium text-critical"
        >
          {error}
        </p>
      )}

      {!operacionReal && (
        <p
          data-testid="aviso-piloto"
          className="rounded-xl border border-warning/20 bg-warning-soft p-3 text-xs leading-relaxed text-warning"
        >
          <strong className="font-semibold">Piloto con datos de prueba.</strong>{" "}
          Solo se aceptan patentes de prueba, y una patente real ni siquiera se
          guarda en este dispositivo. Para registrar vehículos reales hay que
          definir antes la base de licitud y el plazo de retención (Ley 21.719).
        </p>
      )}

      <section className="flex flex-col gap-2.5">
        <h2 className="eyebrow">En el estacionamiento</h2>
        {activas.length === 0 && (
          <p className="rounded-xl border border-dashed border-line-strong p-6 text-center text-sm text-faint">
            Sin vehículos registrados.
          </p>
        )}
        {!listaCompleta && (
          <p
            data-testid="lista-parcial"
            className="rounded-xl bg-canvas-2 p-3 text-xs leading-relaxed text-subtle"
          >
            Sin conexión con el servidor: se muestra lo que hay guardado en este
            dispositivo —las sesiones activas y los ingresos que todavía no
            subieron—. Al reconectar se completa.
          </p>
        )}
        <ul data-testid="lista-activas" className="flex flex-col gap-2">
          {activas.map((s) => (
            <li
              key={s.id}
              data-patente={s.patente}
              data-sync={s.pendiente ? "local" : "sincronizada"}
              className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-card p-3 pl-4 shadow-xs"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="patente text-lg font-semibold text-ink">{s.patente}</p>
                <p className="text-xs text-faint tabular">
                  {duracion(s.entradaAt)}
                  {s.pendiente && (
                    <span className="text-warning"> · sin sincronizar</span>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => registrarSalida(s)}
                className="shrink-0 rounded-xl border border-line-strong bg-canvas-2 px-5 py-3 font-medium text-ink transition-colors duration-200 active:bg-canvas-3"
              >
                Salida
              </button>
            </li>
          ))}
        </ul>
      </section>

      {cobradas.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <h2 className="eyebrow">Últimas salidas</h2>
          <ul data-testid="lista-cerradas" className="flex flex-col gap-2">
            {cobradas.map((s) => (
              <li
                key={s.id}
                data-patente={s.patente}
                className="flex items-center justify-between gap-3 rounded-2xl border border-success/20 bg-success-soft p-3 pl-4"
              >
                <span className="patente font-medium text-ink">{s.patente}</span>
                <span
                  className="cifra tabular text-2xl leading-none"
                  data-testid="monto"
                >
                  $ {s.montoCalculado?.toLocaleString("es-CL") ?? "—"}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-faint">
            El cobro es en efectivo, fuera del sistema.
          </p>
        </section>
      )}
    </main>
  );
}
