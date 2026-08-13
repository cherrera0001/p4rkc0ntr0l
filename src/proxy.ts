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

export function proxy(request: NextRequest) {
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
       * Documentos, no recursos. Se excluyen las rutas de API (responden JSON,
       * donde una CSP no aporta), los estáticos del build, el manifiesto y el
       * service worker —que lleva su propia CSP desde `next.config.ts`—.
       */
      source:
        "/((?!api|_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
