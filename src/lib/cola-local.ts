/**
 * Cola local en IndexedDB — offline-first (spec.md §3, §5, AC-OP-1).
 *
 * El ingreso se escribe SIEMPRE acá primero, haya red o no. Recién después se
 * intenta sincronizar. Ese orden es lo que hace que el registro no dependa de la
 * señal: si la app se cae sin red, muere H1.
 *
 * **Esto es un buffer de pendientes, no un espejo de la base** (hallazgo M-4).
 * Antes acá quedaba todo para siempre: lo sincronizado, lo cerrado y lo
 * rechazado. La patente es dato personal (Ley 21.719) y el dispositivo no tiene
 * ninguna razón para conservar una que el servidor ya tiene. Invariante:
 *
 *   en IndexedDB solo hay patentes que todavía NO llegaron al servidor.
 *
 * Todo lo demás se purga: al sincronizar se borra la patente del registro, al
 * ser rechazada se borra el registro entero, y al abrir la app se borran los
 * acuses que hayan quedado. La lista de vehículos en el estacionamiento la sirve
 * el servidor (`GET /api/sesiones`), no este almacén.
 *
 * Se usa IndexedDB directo, sin librería: la cola es una tabla con cinco
 * operaciones y una dependencia más sería peso sin retorno.
 */

import { esPatenteFixture } from "./fixtures";

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
 * Borra del dispositivo todo lo que el servidor ya tiene (hallazgo M-4).
 *
 * Se ejecuta al abrir la app y cubre dos casos:
 *
 * 1. Los acuses de esta corrida: registros ya sincronizados a los que
 *    `sincronizar()` les quitó la patente. Sin esto crecerían sin límite.
 * 2. Los dispositivos que vienen de una versión anterior, donde la sesión
 *    sincronizada —patente incluida— se quedaba en IndexedDB para siempre.
 *
 * No toca la cola de pendientes: eso es lo único que el dispositivo sí necesita
 * conservar, porque todavía no existe en ningún otro lado.
 *
 * Devuelve cuántas borró.
 */
export async function purgarSincronizadas(): Promise<number> {
  const todas = await listar();
  const aBorrar = todas.filter((s) => s.syncEstado === "sincronizada");
  for (const s of aBorrar) await eliminar(s.id);
  return aBorrar.length;
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
};

/**
 * Sincroniza con el servidor todo lo que quedó pendiente.
 *
 * El `id` lo generó el cliente y viaja en el cuerpo, así que reintentar es
 * seguro: el servidor descarta el duplicado en vez de crear una sesión nueva.
 *
 * Cada salida de la cola deja el dispositivo sin la patente (M-4).
 */
export async function sincronizar(): Promise<ResultadoSincronizacion> {
  const cola = await pendientes();
  let sincronizadas = 0;
  let rechazadas = 0;

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
        }),
      });

      if (r.ok) {
        // Llegó al servidor: el dispositivo deja de necesitar la patente y se la
        // saca acá mismo (M-4). Queda el acuse —mismo id, sin dato personal—
        // para que la app pueda mostrar que la sesión ya no está pendiente
        // (AC-OP-1: `sync_estado` pasa a `sincronizada`). El acuse se borra en la
        // próxima apertura, vía `purgarSincronizadas()`.
        await actualizar(sesion.id, { syncEstado: "sincronizada", patente: "" });
        sincronizadas++;
      } else if (r.status >= 400 && r.status < 500) {
        // Rechazo del cliente (inválida, sin permiso, o bloqueada por la barrera
        // de datos reales): reintentar no lo va a arreglar. Antes se dejaba en la
        // cola "para no perderla en silencio", y eso era exactamente M-4: la
        // patente rechazada se quedaba en el dispositivo para siempre. Se borra,
        // y el aviso lo da la pantalla con `rechazadas`, no el almacén.
        console.error("El servidor rechazó una sesión de la cola:", await r.text());
        await eliminar(sesion.id);
        rechazadas++;
      }
    } catch {
      // Sin red: queda pendiente y se reintenta en la próxima reconexión.
      break;
    }
  }

  return { sincronizadas, rechazadas };
}
