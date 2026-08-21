/**
 * Content-Security-Policy con nonce por petición (hallazgo INT-2).
 *
 * Antes la única CSP del proyecto estaba en `/sw.js`. La pantalla que renderiza
 * dato personal —la del operador— no tenía ninguna. La cookie es `httpOnly`, así
 * que un XSS no la roba; pero sí puede leer IndexedDB, que es donde vive el
 * espejo de las patentes activas, y mandarlo afuera. `connect-src 'self'` es lo
 * que corta esa exfiltración.
 *
 * **Por qué nonce y no `'unsafe-inline'`.** Next inyecta scripts en línea para
 * hidratar; permitirlos a todos con `'unsafe-inline'` deja la CSP como
 * decoración. El nonce exige renderizado dinámico, y acá no cuesta nada: las
 * cuatro páginas ya son `force-dynamic` porque todas leen cookie o base.
 *
 * En Next 16 esto va en `proxy.ts`; `middleware.ts` es el nombre viejo y está
 * deprecado (ver `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`).
 */

import { NextResponse, type NextRequest } from "next/server";

import { destinoCanonico } from "./lib/host-canonico.ts";

/**
 * Rutas que no llevan CSP: la API responde JSON —donde una CSP no aporta— y el
 * service worker trae la suya desde `next.config.ts`.
 *
 * Antes esta lista vivía en el `matcher`, y por eso **el middleware no corría
 * para `/api`**. Ahora el matcher cubre todo, porque el corte por host tiene que
 * alcanzar a la API: ahí es donde está la fuerza bruta y donde cada petición se
 * factura. La CSP se sigue aplicando solo a documentos, pero eso ya se decide
 * acá adentro y no dejando rutas fuera del middleware.
 */
function llevaCSP(ruta: string): boolean {
  return !(
    ruta.startsWith("/api") ||
    ruta.startsWith("/_next/") ||
    ruta === "/favicon.ico" ||
    ruta === "/sw.js" ||
    ruta === "/manifest.webmanifest"
  );
}

export function proxy(request: NextRequest) {
  // Primero el host, antes de cualquier trabajo: una petición que va a ser
  // redirigida no debe costar ni un ciclo más del necesario. Es la mitad del
  // motivo por el que esto existe.
  const destino = destinoCanonico(
    request.headers.get("host"),
    request.nextUrl.pathname + request.nextUrl.search,
    process.env.VERCEL_ENV,
    process.env.HOSTS_CANONICOS,
  );
  if (destino) {
    // 308 y no 302: conserva el método y el cuerpo, así que un POST de la cola
    // offline llega al host canónico en vez de convertirse en GET y perderse.
    return NextResponse.redirect(destino, 308);
  }

  if (!llevaCSP(request.nextUrl.pathname)) return NextResponse.next();

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const enDesarrollo = process.env.NODE_ENV === "development";

  const directivas = [
    "default-src 'self'",
    // 'strict-dynamic' hace que los scripts cargados por uno con nonce hereden
    // la confianza: es lo que permite que los chunks de Next carguen sin
    // enumerarlos. En desarrollo React usa `eval` para reconstruir stacks.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${enDesarrollo ? " 'unsafe-eval'" : ""}`,
    // En desarrollo el CSS se inyecta en línea sin pasar por el nonce de Next.
    `style-src 'self' ${enDesarrollo ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    "img-src 'self' blob: data:",
    "font-src 'self'",
    // La app no habla con ningún tercero. Es la directiva que impide que un XSS
    // se lleve las patentes de IndexedDB a otro servidor.
    "connect-src 'self'",
    // 'strict-dynamic' anula el 'self' de script-src para los workers, así que
    // el permiso del service worker se declara aparte o no se registra.
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];

  // Fuera de producción la app corre en http://localhost y forzar https rompería
  // la carga de sus propios recursos.
  if (!enDesarrollo) directivas.push("upgrade-insecure-requests");

  const csp = directivas.join("; ");

  // Next lee el nonce de la CSP de la petición para estampárselo a sus propios
  // scripts; el `x-nonce` queda disponible por si alguna pantalla necesita
  // leerlo. Los dos tienen que llevar el mismo valor.
  const cabecerasPeticion = new Headers(request.headers);
  cabecerasPeticion.set("x-nonce", nonce);
  cabecerasPeticion.set("Content-Security-Policy", csp);

  const respuesta = NextResponse.next({ request: { headers: cabecerasPeticion } });
  respuesta.headers.set("Content-Security-Policy", csp);
  return respuesta;
}

export const config = {
  matcher: [
    {
      /**
       * **Todo**, incluida la API. Antes se excluía `/api` porque el único
       * trabajo de este middleware era la CSP; hoy también corta por host, y
       * dejar la API afuera dejaba abierto justo el camino que importa: el de
       * `/api/login`, donde la fuerza bruta no encontraba freno y cada intento
       * se facturaba.
       *
       * Se siguen excluyendo los estáticos del build: los sirve el CDN, no
       * ejecutan nada y hacerlos pasar por acá es gasto sin contrapartida.
       */
      source: "/((?!_next/static|_next/image).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
