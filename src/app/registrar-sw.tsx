"use client";

import { useEffect } from "react";

/**
 * Registra el service worker (spec.md §8, AC-PWA-1).
 *
 * No renderiza nada. Va en el layout raíz para que el registro ocurra en
 * cualquier pantalla, no solo en la de inicio.
 */
export function RegistrarServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => {
      // Un registro fallido degrada el offline, no debe romper la app.
      console.error("No se pudo registrar el service worker:", error);
    });
  }, []);

  return null;
}
