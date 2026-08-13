import type { NextConfig } from "next";

/**
 * Identidad del build, para versionar los cachés del service worker
 * (hallazgo INT-12).
 *
 * El nombre del caché llevaba el literal `"v1"`, así que `activate` nunca tenía
 * nada que purgar y el shell de hace tres deploys seguía siendo "vigente". Con
 * red no se notaba —la navegación es network-first—; sin red se servía el HTML
 * viejo y con él un bundle que puede ser anterior a la barrera de datos reales
 * de A-3 (INT-3).
 *
 * En Vercel el valor sale del commit desplegado. Fuera de Vercel se usa el
 * instante del build: dos builds distintos no comparten caché, que es la
 * propiedad que se necesita.
 */
const VERSION_APP =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? `local-${Date.now().toString(36)}`;

/**
 * Permisos de API del navegador. Se declaran cerrados, incluidos `camera` y
 * `geolocation`: además de higiene, es coherente con el gate de alcance
 * (ADR-001), que prohíbe LPR y captura de imagen en la v1.
 */
const PERMISSIONS_POLICY = [
  "accelerometer=()",
  "autoplay=()",
  "camera=()",
  "display-capture=()",
  "geolocation=()",
  "gyroscope=()",
  "magnetometer=()",
  "microphone=()",
  "payment=()",
  "usb=()",
].join(", ");

const nextConfig: NextConfig = {
  env: {
    // Lo lee `registrar-sw.tsx` para registrar `/sw.js?v=...`.
    NEXT_PUBLIC_VERSION_APP: VERSION_APP,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          // La CSP de los documentos se pone en `src/proxy.ts`, que puede
          // generar un nonce por petición. Acá va lo que no depende del pedido.
          { key: "Permissions-Policy", value: PERMISSIONS_POLICY },
        ],
      },
      {
        // El service worker nunca se cachea: si queda uno viejo pegado, el
        // operador se queda con una versión que no sincroniza.
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self'; connect-src 'self'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
