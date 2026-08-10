/**
 * Service worker — offline-first (spec.md §3, §8).
 *
 * Offline-first NO es opcional: si la app no abre sin señal, muere H1. Este
 * worker garantiza que el shell de la aplicación cargue sin red. La cola de
 * registros offline vive en IndexedDB y se implementa en M2.
 *
 * Estrategias:
 *  - Navegaciones (documentos HTML): network-first con respaldo en caché. Se
 *    prefiere lo fresco; si no hay red, se sirve la última copia guardada.
 *  - Estáticos del build (/_next/static/**): cache-first. Llevan hash en el
 *    nombre, así que nunca quedan obsoletos.
 *  - Todo lo demás: se deja pasar a la red sin intervenir.
 *
 * Nunca se interceptan métodos distintos de GET: las mutaciones no se cachean.
 */

const VERSION = "v1";
const CACHE_SHELL = `estacionamiento-shell-${VERSION}`;
const CACHE_ESTATICOS = `estacionamiento-estaticos-${VERSION}`;

/** Rutas del shell que deben existir en caché para poder abrir sin red. */
const SHELL = ["/", "/offline"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_SHELL);
      // addAll es atómico: si una ruta falla, no se instala nada. Se piden de a
      // una para que una ruta caída no deje al operador sin service worker.
      await Promise.allSettled(SHELL.map((ruta) => cache.add(ruta)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const nombres = await caches.keys();
      const vigentes = new Set([CACHE_SHELL, CACHE_ESTATICOS]);
      await Promise.all(
        nombres
          .filter((n) => n.startsWith("estacionamiento-") && !vigentes.has(n))
          .map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(navegacion(request));
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(estatico(request));
  }
});

/** Network-first: lo fresco si hay red, la última copia si no. */
async function navegacion(request) {
  const cache = await caches.open(CACHE_SHELL);
  try {
    const respuesta = await fetch(request);
    cache.put(request, respuesta.clone());
    return respuesta;
  } catch {
    const enCache = await cache.match(request);
    if (enCache) return enCache;

    const raiz = await cache.match("/");
    if (raiz) return raiz;

    return new Response(
      "<!doctype html><meta charset=utf-8><title>Sin conexión</title><p>Sin conexión y sin copia local de esta pantalla.",
      { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }
}

/** Cache-first: los estáticos del build llevan hash, no se invalidan solos. */
async function estatico(request) {
  const cache = await caches.open(CACHE_ESTATICOS);
  const enCache = await cache.match(request);
  if (enCache) return enCache;

  const respuesta = await fetch(request);
  if (respuesta.ok) cache.put(request, respuesta.clone());
  return respuesta;
}
