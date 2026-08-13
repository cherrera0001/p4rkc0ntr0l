"use client";

import { useEffect } from "react";

/**
 * Registra el service worker (spec.md §8, AC-PWA-1).
 *
 * No renderiza nada. Va en el layout raíz para que el registro ocurra en
 * cualquier pantalla, no solo en la de inicio.
 *
 * **La versión viaja en la query (hallazgo INT-12).** El worker toma de ahí el
 * nombre de sus cachés. Como el valor cambia en cada deploy, el navegador ve un
 * script distinto, instala un worker nuevo y su `activate` purga los cachés de
 * los deploys anteriores. Sin esto, el shell viejo era "vigente" para siempre y
 * un dispositivo sin red podía seguir ejecutando un cliente anterior a la
 * barrera de datos reales de A-3 (INT-3).
 */
export function RegistrarServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const version = process.env.NEXT_PUBLIC_VERSION_APP ?? "sin-version";

    navigator.serviceWorker
      .register(`/sw.js?v=${encodeURIComponent(version)}`, { scope: "/" })
      .catch((error) => {
        // Un registro fallido degrada el offline, no debe romper la app.
        console.error("No se pudo registrar el service worker:", error);
      });
  }, []);

  return null;
}
