/**
 * Cola local en IndexedDB — offline-first (spec.md §3, §5, §8, AC-OP-1).
 *
 * El ingreso se escribe SIEMPRE acá primero, haya red o no. Recién después se
 * intenta sincronizar. Ese orden es lo que hace que el registro no dependa de la
 * señal: si la app se cae sin red, muere H1.
 *
 * **Invariante (hallazgo M-4):**
 *
 *   en IndexedDB solo hay lo que el operador necesita para operar AHORA:
 *   los pendientes de sincronizar y las sesiones activas en el estacionamiento.
 *
 * Lo que M-4 señala es la retención *indefinida*: antes acá quedaba todo para
 * siempre —lo sincronizado, lo cerrado y lo rechazado— sin purga, sin caducidad
 * y sin borrado al cerrar la sesión. La patente es dato personal (Ley 21.719),
 * así que sale del dispositivo apenas deja de hacer falta:
 *
 *  - se registra la salida (la sesión se cierra)  → se borra el registro;
 *  - el servidor confirma que ya no está activa   → se borra el registro;
 *  - el servidor la rechaza definitivamente       → se borra el registro;
 *  - al abrir la app se barre lo que haya quedado de versiones anteriores.
 *
 * Lo que NO se hace es borrar la patente de una sesión que sigue adentro del
 * estacionamiento. El operador la necesita para trabajar sin señal —y una
 * recarga sin cobertura lo dejaría con la pantalla en cero, sin saber quién
 * está adentro—; spec.md §8 y §11 declaran el offline-first innegociable. Una
 * app más privada que no abre sin red no es una mejora: es otra app.
 *
 * Se usa IndexedDB directo, sin librería: la cola es una tabla con un puñado de
 * operaciones y una dependencia más sería peso sin retorno.
 */

import { esPatenteFixture } from "./fixtures.ts";

const BASE = "estacionamiento";
const VERSION = 1;
const TIENDA = "sesiones";

export type SesionLocal = {
  id: string;
  patente: string;
  entradaAt: string;
  tecleoInicioAt: string;
  tecleoFinAt: string;
  estado: "activa" | "cerrada";
  syncEstado: "local" | "sincronizada";
  montoCalculado: number | null;
  salidaAt: string | null;
  /**
   * ISO del último momento en que el servidor confirmó esta sesión (al aceptar
   * el POST o al listarla como activa). Lo usa `reconciliarActivas` para no
   * borrar del dispositivo algo que se confirmó DESPUÉS de que saliera el
   * pedido cuya respuesta está evaluando. Opcional: los registros escritos por
   * versiones anteriores no lo tienen.
   */
  sincronizadaAt?: string;
};

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(BASE, VERSION);
    req.onupgradeneeded = () => {
      const bd = req.result;
      if (!bd.objectStoreNames.contains(TIENDA)) {
        const tienda = bd.createObjectStore(TIENDA, { keyPath: "id" });
        tienda.createIndex("syncEstado", "syncEstado", { unique: false });
        tienda.createIndex("estado", "estado", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function conTienda<T>(
  modo: IDBTransactionMode,
  fn: (tienda: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const bd = await abrir();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = bd.transaction(TIENDA, modo);
      const req = fn(tx.objectStore(TIENDA));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    bd.close();
  }
}

export function guardar(sesion: SesionLocal): Promise<IDBValidKey> {
  return conTienda("readwrite", (t) => t.put(sesion));
}

export function listar(): Promise<SesionLocal[]> {
  return conTienda<SesionLocal[]>("readonly", (t) => t.getAll());
}

export async function pendientes(): Promise<SesionLocal[]> {
  const todas = await listar();
  return todas.filter((s) => s.syncEstado === "local");
}

export function eliminar(id: string): Promise<undefined> {
  return conTienda<undefined>("readwrite", (t) => t.delete(id));
}

/**
 * Vacía el almacén entero (hallazgo INT-8).
 *
 * Es lo que corre al cerrar sesión: el dispositivo del operador se comparte por
 * turnos, y con la invariante de M-4 IndexedDB conserva a propósito las patentes
 * de los vehículos que están adentro. Eso es correcto para operar y equivocado
 * al cambiar de turno — el operador entrante heredaría dato personal del
 * anterior sin ningún acto de entrega.
 *
 * Quien la llama tiene que haber comprobado antes que no queden pendientes: un
 * ingreso sin sincronizar existe solo acá, y borrarlo es perderlo (AC-OP-1).
 */
export function borrarTodo(): Promise<undefined> {
  return conTienda<undefined>("readwrite", (t) => t.clear());
}

/**
 * Borra del dispositivo cualquier sesión cuya patente no sea de prueba.
 *
 * Red de seguridad para el hallazgo A-3: antes de esta corrección, una patente
 * real tecleada se escribía en IndexedDB y quedaba ahí para siempre, rechazada
 * por el servidor en cada reintento. Los dispositivos que ya pasaron por eso
 * tienen datos personales guardados; esto los limpia al abrir la app.
 *
 * Devuelve cuántas borró.
 */
export async function purgarNoFixtures(): Promise<number> {
  const todas = await listar();
  const aBorrar = todas.filter((s) => !esPatenteFixture(s.patente));
  for (const s of aBorrar) await eliminar(s.id);
  return aBorrar.length;
}

/**
 * Borra del dispositivo lo que el servidor ya tiene y que además ya no está
 * adentro del estacionamiento (hallazgo M-4).
 *
 * Se ejecuta al abrir la app y cubre dos casos:
 *
 * 1. Las sesiones que se cerraron en este dispositivo y quedaron a medio
 *    limpiar (por ejemplo, si la app se cerró justo después del cobro).
 * 2. Los dispositivos que vienen de una versión anterior, donde la sesión
 *    cerrada —patente incluida— se quedaba en IndexedDB para siempre. Ese es
 *    literalmente el hallazgo M-4.
 *
 * Es una purga DIRIGIDA, y por eso el filtro pide las dos condiciones:
 *
 *  - no toca la cola de pendientes (`syncEstado === "local"`): eso todavía no
 *    existe en ningún otro lado y borrarlo sería perder el ingreso;
 *  - no toca las sesiones activas: el operador las necesita para trabajar sin
 *    red (spec.md §8).
 *
 * Devuelve cuántas borró.
 */
export async function purgarNoActivas(): Promise<number> {
  const todas = await listar();
  const aBorrar = todas.filter(
    (s) => s.syncEstado === "sincronizada" && s.estado !== "activa",
  );
  for (const s of aBorrar) await eliminar(s.id);
  return aBorrar.length;
}

/** Sesión activa tal como la devuelve `GET /api/sesiones`. */
export type SesionActivaServidor = {
  id: string;
  patente: string;
  entradaAt: string;
};

/**
 * Pone el dispositivo al día con la lista de activas del servidor.
 *
 * Hace las dos mitades de la invariante en un solo paso:
 *
 *  - **Suelta** lo que el servidor ya no reporta activo. Ese es el mecanismo de
 *    caducidad que M-4 echaba de menos: la patente no espera a que alguien
 *    cierre la sesión desde este dispositivo, se va en cuanto el servidor dice
 *    que el vehículo salió (lo haya cerrado quien lo haya cerrado).
 *  - **Conserva** lo que sí está adentro, para que una recarga sin cobertura no
 *    deje al operador con ocupación 0.
 *
 * `pedidoDesde` es el instante en que salió el `GET` cuya respuesta se está
 * aplicando. Una respuesta puede ser legítimamente anterior a una confirmación
 * que ya tenemos (el `GET` salió antes de que el `INSERT` llegara a la base), y
 * en ese caso borrar sería creerle a información vieja: por eso solo se borra lo
 * confirmado ANTES de que ese pedido saliera.
 *
 * Con `soloFixtures` (modo piloto) una patente que no sea de prueba no se
 * escribe en el dispositivo ni siquiera viniendo del servidor: la barrera de
 * A-3 vale también para lo que entra por esta puerta.
 */
export async function reconciliarActivas(
  activasServidor: SesionActivaServidor[],
  pedidoDesde: string,
  { soloFixtures = false }: { soloFixtures?: boolean } = {},
): Promise<void> {
  const activas = soloFixtures
    ? activasServidor.filter((s) => esPatenteFixture(s.patente))
    : activasServidor;
  const idsActivas = new Set(activas.map((s) => s.id));
  const locales = await listar();
  const previaPorId = new Map(locales.map((s) => [s.id, s]));

  for (const s of locales) {
    // Un pendiente no lo puede desmentir el servidor: todavía no lo vio.
    if (s.syncEstado !== "sincronizada") continue;
    if (idsActivas.has(s.id)) continue;
    if (s.sincronizadaAt && s.sincronizadaAt > pedidoDesde) continue;
    await eliminar(s.id);
  }

  const ahora = new Date().toISOString();
  for (const s of activas) {
    const previa = previaPorId.get(s.id);
    await guardar({
      id: s.id,
      patente: s.patente,
      entradaAt: s.entradaAt,
      // Los timestamps de tecleo son evidencia de H1 (§6) y solo existen en el
      // dispositivo que los midió: si ya los teníamos, no se pisan.
      tecleoInicioAt: previa?.tecleoInicioAt ?? s.entradaAt,
      tecleoFinAt: previa?.tecleoFinAt ?? s.entradaAt,
      estado: "activa",
      // El servidor la está listando: por definición ya no es solo local.
      syncEstado: "sincronizada",
      montoCalculado: null,
      salidaAt: null,
      sincronizadaAt: ahora,
    });
  }
}

export async function actualizar(
  id: string,
  cambios: Partial<SesionLocal>,
): Promise<void> {
  const actual = await conTienda<SesionLocal | undefined>("readonly", (t) => t.get(id));
  if (!actual) return;
  await guardar({ ...actual, ...cambios });
}

export type ResultadoSincronizacion = {
  /** Cuántas aceptó el servidor. */
  sincronizadas: number;
  /** Cuántas rechazó definitivamente, y por lo tanto se borraron del dispositivo. */
  rechazadas: number;
  /** Cuántas quedaron en la cola porque el servidor pidió volver más tarde. */
  diferidas: number;
};

/**
 * ¿Este 4xx dice "este dato no puede existir" o dice "ahora no puedo, volvé"?
 *
 * Antes se trataba TODO el rango 4xx como rechazo definitivo y se borraba el
 * registro del dispositivo. Es pérdida de datos: un 401 por cookie caducada
 * —o el 429 del límite de intentos previsto para el hallazgo C-1— vaciaba la
 * cola del operador y el ingreso registrado sin red no llegaba nunca. La regla
 * de decisión es asimétrica a propósito:
 *
 *  - **definitivo**, y solo entonces se borra: el servidor afirma que ese dato
 *    no puede existir. 400 (el cuerpo es inválido y reintentarlo no lo arregla)
 *    y 403 (barrera de datos reales: esa patente no se va a aceptar nunca).
 *  - **recuperable**, se deja en la cola: 401, 408, 409, 429 y cualquier otro
 *    código. Ante la duda NO se borra — equivocarse conservando cuesta una fila
 *    de más en el dispositivo; equivocarse borrando cuesta el registro.
 */
export function esRechazoDefinitivo(status: number): boolean {
  return status === 400 || status === 403;
}

/**
 * Sincroniza con el servidor todo lo que quedó pendiente.
 *
 * El `id` lo generó el cliente y viaja en el cuerpo, así que reintentar es
 * seguro: el servidor descarta el duplicado en vez de crear una sesión nueva.
 */
export async function sincronizar(): Promise<ResultadoSincronizacion> {
  const cola = await pendientes();
  let sincronizadas = 0;
  let rechazadas = 0;
  let diferidas = 0;

  for (const sesion of cola) {
    try {
      const r = await fetch("/api/sesiones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: sesion.id,
          patente: sesion.patente,
          entradaAt: sesion.entradaAt,
          tecleoInicioAt: sesion.tecleoInicioAt,
          tecleoFinAt: sesion.tecleoFinAt,
          /**
           * El "ahora" de ESTE dispositivo al sincronizar (hallazgo INT-14).
           *
           * El servidor lo compara con el suyo y así conoce el desfase del
           * reloj que midió `entradaAt`. Con eso corrige la antigüedad del
           * ingreso en vez de tener que rechazarlo — un rechazo sería un 400,
           * y un 400 borra el registro del dispositivo.
           */
          clienteAhora: new Date().toISOString(),
        }),
      });

      if (r.ok) {
        // Llegó al servidor: deja de estar pendiente (AC-OP-1: `sync_estado`
        // pasa a `sincronizada`). La patente se conserva mientras la sesión
        // siga activa, porque es lo que el operador necesita para trabajar sin
        // red; se va al cerrarse o cuando el servidor deje de listarla (M-4).
        await actualizar(sesion.id, {
          syncEstado: "sincronizada",
          sincronizadaAt: new Date().toISOString(),
        });
        sincronizadas++;
      } else if (esRechazoDefinitivo(r.status)) {
        // El servidor dice que ese dato no puede existir: reintentar no lo va a
        // arreglar y dejarlo era exactamente M-4 (la patente rechazada se
        // quedaba en el dispositivo para siempre). Se borra, y el aviso lo da la
        // pantalla con `rechazadas`, no el almacén.
        //
        // Se registra el código y no el cuerpo (PRV-obs-1): hoy los cuerpos de
        // 400 y 403 son literales sin patente, pero el log de una app que trata
        // dato personal no debería depender de que eso siga siendo cierto.
        console.error(`El servidor rechazó una sesión de la cola (HTTP ${r.status}).`);
        await eliminar(sesion.id);
        rechazadas++;
      } else {
        // "Ahora no puedo, volvé": 401, 408, 409, 429, 5xx o lo que no sepamos
        // clasificar. El registro se queda en la cola y se corta el lote:
        // insistir con el resto contra un servidor que está limitando o que
        // perdió la sesión no ayuda a nadie.
        diferidas++;
        break;
      }
    } catch {
      // Sin red: queda pendiente y se reintenta en la próxima reconexión.
      diferidas++;
      break;
    }
  }

  return { sincronizadas, rechazadas, diferidas };
}
