"use client";

import { useEffect } from "react";

import { VERSION_DEGRADADA, versionDelCliente } from "@/lib/version-app";

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
 *
 * **Y la versión vacía no vale (regresión de INT-12).** Acá había un
 * `?? "sin-version"`, que con la cadena vacía que produjo el build de producción
 * tampoco disparaba: se registraba `/sw.js?v=` y todos los deploys compartían un
 * único caché. La versión se valida en vez de asumirse, y si no sirve queda una
 * marca que se delata en vez de un valor que se ve legítimo.
 */
export function RegistrarServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const version = versionDelCliente(process.env.NEXT_PUBLIC_VERSION_APP);

    if (version === VERSION_DEGRADADA) {
      // No rompe nada hoy —el worker igual se registra y el offline sigue en
      // pie—, pero es la señal de que el build no inlineó su identidad y de que
      // este dispositivo puede quedarse con un shell viejo sin poder purgarlo.
      console.error(
        "El build no expuso NEXT_PUBLIC_VERSION_APP: los cachés del service worker no se pueden versionar (INT-12).",
      );
    }

    navigator.serviceWorker
      .register(`/sw.js?v=${encodeURIComponent(version)}`, { scope: "/" })
      .catch((error) => {
        // Un registro fallido degrada el offline, no debe romper la app.
        console.error("No se pudo registrar el service worker:", error);
      });
  }, []);

  return null;
}
