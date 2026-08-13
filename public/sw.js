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
 *
 * **Qué se guarda como shell (hallazgo INT-11).** Solo respuestas propias, con
 * estado 2xx y sin redirección. Antes se guardaba lo que viniera:
 *
 *  - un 500 transitorio en `/` quedaba como la copia offline del shell, y el
 *    operador sin red abría la app y veía la página de error;
 *  - `fetch` sigue redirecciones, así que con la cookie vencida `GET /`
 *    devuelve la pantalla de **login** y esa quedaba guardada bajo la clave
 *    `/`. A partir de ahí, abrir sin red mostraba un formulario que no puede
 *    validar nada, con vehículos adentro y sin forma de registrar.
 *
 * El segundo caso era improbable mientras la cookie no vencía nunca. Al
 * corregir A-1 pasa a ser rutinario, que es justamente por qué los dos
 * hallazgos se corrigen juntos.
 *
 * **Qué versiona el caché (hallazgo INT-12).** El nombre llevaba el literal
 * `"v1"`, así que `activate` no tenía nada que purgar: el shell de hace tres
 * deploys seguía siendo "vigente". Con red no se notaba —la navegación es
 * network-first—, pero sin red se servía el HTML viejo y con él su bundle
 * viejo. Y ese bundle puede ser anterior a la barrera de datos reales de A-3,
 * que vive en el cliente: eso es INT-3. Ahora la versión llega en la query del
 * script (`/sw.js?v=...`), que cambia en cada deploy, así que un deploy nuevo
 * instala un worker nuevo y `activate` se lleva los cachés de los anteriores.
 */

/**
 * Saneo de la versión. Espejo de `sanearVersion` en `src/lib/version-app.ts`:
 * este archivo se sirve estático y no puede importar del bundle, así que las
 * cinco líneas se repiten. `scripts/verificar-int12.mjs` extrae esta función,
 * la corre contra la del módulo sobre un corpus de entradas y falla si las dos
 * copias divergen. Si tocás una, tocá la otra: el verificador lo nota.
 *
 * Existe por la regresión de INT-12: el build de producción inlineó la versión
 * vacía, el cliente registró `/sw.js?v=` y acá el `||` la reemplazó por el
 * literal `"sin-version"`. Nombre estable entre deploys = `activate` sin nada
 * que purgar = el defecto original, con otro nombre. Una versión vacía ya no se
 * acepta como válida en ninguno de los dos extremos.
 */
function sanearVersion(valor) {
  const limpio = String(valor ?? "")
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .slice(0, 40)
    .replace(/^[-.]+/, "")
    .replace(/[-.]+$/, "");
  if (limpio.length === 0) return null;
  return ["v1", "sin-version", "degradado", "undefined", "null"].includes(limpio.toLowerCase())
    ? null
    : limpio;
}

/**
 * Versión del build. Viene de la URL con la que se registró el worker. Sin una
 * versión utilizable se sigue trabajando —quedarse sin worker es quedarse sin
 * offline, y offline no es opcional— pero bajo un nombre que se delata.
 */
const VERSION = sanearVersion(new URL(self.location.href).searchParams.get("v")) ?? "degradado";
if (VERSION === "degradado") {
  console.warn("service worker sin versión de build: los cachés no se pueden purgar (INT-12).");
}

const CACHE_SHELL = `estacionamiento-shell-${VERSION}`;
const CACHE_ESTATICOS = `estacionamiento-estaticos-${VERSION}`;

/** Rutas del shell que deben existir en caché para poder abrir sin red. */
const SHELL = ["/", "/offline"];

/** ¿Esta respuesta puede guardarse como copia offline del shell? */
function sirveComoShell(respuesta) {
  return Boolean(respuesta) && respuesta.ok && !respuesta.redirected && respuesta.type === "basic";
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_SHELL);
      // Se piden de a una y se guardan solo si sirven: `cache.addAll` es atómico
      // pero guarda cualquier respuesta, incluida la redirección al login.
      await Promise.allSettled(
        SHELL.map(async (ruta) => {
          const respuesta = await fetch(ruta, { redirect: "follow" });
          if (sirveComoShell(respuesta)) await cache.put(ruta, respuesta);
        }),
      );
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
    // Solo se guarda lo que sirve como shell. Un error del servidor o una
    // redirección al login se devuelven al navegador, pero no se guardan: la
    // copia offline tiene que seguir siendo la última pantalla buena.
    if (sirveComoShell(respuesta)) await cache.put(request, respuesta.clone());
    return respuesta;
  } catch {
    const enCache = await cache.match(request);
    if (enCache) return enCache;

    const raiz = await cache.match("/");
    if (raiz) return raiz;

    const offline = await cache.match("/offline");
    if (offline) return offline;

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
