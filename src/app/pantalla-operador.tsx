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
import Cabecera from "./cabecera";
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
  /** Salidas en vuelo: corta el doble toque en el mismo frame (el ref es síncrono). */
  const cerrandoSalidas = useRef(new Set<string>());
  /** Copia en estado para deshabilitar el botón; el ref manda para la carrera. */
  const [cerrando, setCerrando] = useState<Set<string>>(new Set());
  /** Ingreso en vuelo: mismo patrón que `cerrandoSalidas` (hallazgo FE-1). */
  const confirmando = useRef(false);
  /** Copia en estado para deshabilitar «Confirmar»; el ref manda para la carrera. */
  const [guardandoIngreso, setGuardandoIngreso] = useState(false);
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

    // **Guarda de reentrancia (hallazgo FE-1 del concilio), mismo patrón que
    // `cerrandoSalidas`/`registrarSalida` más abajo.** Sin esto, un doble toque
    // en «Confirmar» —el gesto real de alguien apurado— corre `confirmar()` dos
    // veces en el mismo frame; cada corrida genera su propio
    // `crypto.randomUUID()`, así que quedan DOS registros `activa` en
    // IndexedDB por un solo vehículo. El estado de React no alcanza para esto:
    // dos toques en el mismo tick leen el mismo valor viejo antes de que el
    // primer `setState` se aplique. El ref es síncrono y corta la segunda
    // corrida en el acto.
    if (confirmando.current) return;
    confirmando.current = true;
    setGuardandoIngreso(true);
    try {
      const validacion = validarPatente(patente);
      if (!validacion.valida) {
        setError(validacion.motivo);
        // Foco de vuelta al campo (hallazgo FE-5 del concilio). Antes el foco
        // quedaba en «Confirmar» tras el error, así que corregir exigía volver al
        // campo con el dedo o el tabulador. La barrera de fixtures ya lo hacía;
        // esta rama —la de validación— quedó afuera.
        campo.current?.focus();
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
          "Por ahora solo se aceptan patentes de prueba. Esta patente no se registró " +
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
    } finally {
      // Se suelta pase lo que pase —éxito, validación fallida o error de
      // red/disco—: si el guardado local fallara y la guarda no se soltara acá,
      // el botón quedaría muerto para siempre, y offline-first exige que el
      // ingreso sin red siga funcionando igual.
      confirmando.current = false;
      setGuardandoIngreso(false);
    }
  }

  async function registrarSalida(vehiculo: EnPantalla) {
    // **Guarda de vuelo (hallazgo del experto de frontend del concilio).** El
    // resto del archivo usa refs para esto —`pidiendoLista`, `sincronizando`—;
    // esta ruta quedó afuera. Sin la guarda, un doble toque —el gesto real de
    // alguien apurado— dispara DOS POST. El backend ya cierra una sola vez
    // (AC-OP-5) y el segundo devuelve el mismo monto, así que no corrompe plata;
    // pero el segundo viaje es ruido evitable, y el ref lo corta en el acto —una
    // señal de estado tiene la ventana de dos toques en el mismo frame que el ref
    // no tiene—.
    if (cerrandoSalidas.current.has(vehiculo.id)) return;
    cerrandoSalidas.current.add(vehiculo.id);
    setCerrando((previas) => new Set(previas).add(vehiculo.id));
    setError(null);
    try {
      const r = await fetch(`/api/sesiones/${vehiculo.id}/salida`, { method: "POST" });
      if (!r.ok) {
        setError("No se pudo registrar la salida. Reinténtalo.");
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
    } finally {
      // Se suelta pase lo que pase: si falló, el operador tiene que poder
      // reintentar; si cerró, la fila ya salió de la lista.
      cerrandoSalidas.current.delete(vehiculo.id);
      setCerrando((previas) => {
        const siguiente = new Set(previas);
        siguiente.delete(vehiculo.id);
        return siguiente;
      });
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

  // --- Maqueta `1l` · el ingreso se queda con la pantalla entera --------------
  //
  // La traducción de diseño la llama «la mejor expresión de H1 del set»
  // (docs/diseno-2026-08-12-traduccion.md:52). El motivo es concreto: mientras
  // se teclea una patente, la ocupación, el banner de pendientes y la lista de
  // vehículos compiten por la atención y por el pulgar, y ninguno de los tres
  // sirve para lo único que se está haciendo. Acá la captura se queda con el
  // viewport: campo, estado de red y dos botones.
  //
  // **Por qué es un modo de esta pantalla y no una ruta nueva.** Una ruta propia
  // obligaría a navegar para entrar y para salir, y esa navegación caería DENTRO
  // de la ventana que `tecleo_inicio_at` / `tecleo_fin_at` miden: H1 pasaría a
  // incluir el costo del router, que no es lo que la hipótesis compara contra el
  // cuaderno. Sin señal, además, dependería de que el service worker tuviera esa
  // ruta en caché. Como modo, comparte cola local, barrera A-3 e instrumentación
  // con el resto del archivo: no hay una segunda copia de nada.
  //
  // El botón «Confirmar» vuelve a la lista, que es el comportamiento que AC-OP-1
  // y AC-A3 ya verifican. Encadenar ingresos sin salir del modo aceleraría una
  // fila de autos, pero cambia el flujo que esos criterios miden: queda anotado
  // como decisión abierta en LEDGER.md, no resuelto acá por cuenta propia.
  if (tecleando) {
    return (
      <div
        data-testid="ingreso-pantalla-completa"
        className="flex min-h-dvh flex-col bg-canvas"
      >
        <form
          onSubmit={confirmar}
          className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 p-4 pb-8"
        >
          {/* AC-UX-1 también acá dentro. Si la señal se cae mientras el operador
              teclea, tiene que verlo sin salir del modo: el estado de red no se
              queda en la pantalla de la que vino. */}
          <div className="flex items-center justify-between gap-3">
            <span
              data-testid="estado-conexion"
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                enLinea ? "bg-success-soft text-success" : "bg-warning-soft text-warning"
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

          <label htmlFor="patente" className="eyebrow">
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
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? "error-operador" : "ayuda-patente"}
            className="patente w-full rounded-2xl border-2 border-line-strong bg-card px-4 py-7 text-center text-4xl text-ink caret-accent focus:border-accent focus:outline-none aria-[invalid]:border-critical"
          />
          {/* AC-UX-4: la normalización existe desde M2 y nunca se dijo en
              pantalla. Un operador que no lo sabe teclea el guion. */}
          <p id="ayuda-patente" className="text-center text-xs text-faint">
            Se normaliza sola. Sin guiones ni espacios.
          </p>

          {error && (
            <p
              id="error-operador"
              data-testid="error"
              role="alert"
              className="rounded-xl border border-critical/20 bg-critical-soft p-3 text-sm font-medium text-critical"
            >
              {error}
            </p>
          )}

          {/* `mt-auto` empuja los botones al borde inferior: es donde llega el
              pulgar de quien sostiene el teléfono con una mano, que es la
              postura real del operador en el patio (spec.md §5). */}
          <div className="mt-auto flex flex-col gap-2 pt-6">
            <button
              type="submit"
              data-testid="confirmar-ingreso"
              disabled={guardandoIngreso}
              className="rounded-2xl bg-accent px-4 py-6 text-xl font-semibold text-white shadow-glow transition-colors duration-200 active:bg-accent-strong disabled:opacity-60"
            >
              {guardandoIngreso ? "Guardando…" : "Confirmar"}
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
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <Cabecera contexto="Operación · terreno" titulo="ParkControl" accion={<CerrarSesion />} />

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 p-4 pb-10">
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

      {/* Banner de tranquilidad del diseño 1b. Aparece cuando hay registros sin
          subir: le dice al operador que lo que registró NO se perdió y que puede
          seguir trabajando. Es contenido de confianza, no un error —por eso el
          tono ámbar del sistema, no el crítico—, y sostiene H1: si el operador
          no confía en la app sin señal, vuelve al cuaderno. */}
      {sinSincronizar > 0 && (
        <section
          role="status"
          className="flex items-start gap-3 rounded-2xl border border-warning/25 bg-warning-soft p-4"
        >
          <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-warning" />
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-medium text-warning">
              {sinSincronizar} {sinSincronizar === 1 ? "registro espera" : "registros esperan"} red
            </p>
            <p className="text-xs leading-relaxed text-muted">
              Se guardaron en este equipo. Suben solos al reconectar; puedes seguir
              registrando.
            </p>
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={nuevoIngreso}
        data-testid="nuevo-ingreso"
        className="rounded-2xl bg-accent px-4 py-6 text-lg font-semibold text-white shadow-glow transition-colors duration-200 active:bg-accent-strong"
      >
        Nuevo ingreso
      </button>

      {error && (
        <p
          id="error-operador"
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
          <strong className="font-semibold">Datos de prueba.</strong>{" "}
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
            dispositivo: las sesiones activas y los ingresos que todavía no
            subieron. Al reconectar se completa.
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
                disabled={cerrando.has(s.id)}
                className="shrink-0 rounded-xl border border-line-strong bg-canvas-2 px-5 py-3 font-medium text-ink transition-colors duration-200 active:bg-canvas-3 disabled:opacity-50"
              >
                {cerrando.has(s.id) ? "Cerrando…" : "Salida"}
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
    </div>
  );
}
