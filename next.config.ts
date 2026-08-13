import type { NextConfig } from "next";

import { resolverVersionApp, sanearVersion } from "./src/lib/version-app.ts";

/**
 * Identidad del build, para versionar los cachés del service worker
 * (hallazgo INT-12).
 *
 * Acá vivía la regresión: `process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ??
 * ...`. En los deploys por CLI esa variable llega **vacía**, no ausente, así que
 * el `??` no dispara y la versión quedaba en `""`. El porqué completo y la
 * propiedad que hay que sostener están en `src/lib/version-app.ts`, que además
 * es lo que se prueba sin levantar nada.
 */
const VERSION_APP = resolverVersionApp(process.env);

/**
 * Segunda barrera, y la que no puede pasar inadvertida: un build que no logra
 * identificarse no se publica.
 *
 * `resolverVersionApp` no puede devolver algo inservible —el último recurso es
 * el instante del build—, así que esto solo se dispara si alguien cambia el
 * resolutor y reintroduce la forma del defecto. Falla en el build, que es donde
 * se ve, y no en un dispositivo sin red tres deploys después.
 */
if (!sanearVersion(VERSION_APP)) {
  throw new Error(
    `Versión de build inservible (${JSON.stringify(VERSION_APP)}): los cachés del service worker ` +
      "quedarían con nombre fijo entre deploys y `activate` no purgaría nada (INT-12).",
  );
}

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
