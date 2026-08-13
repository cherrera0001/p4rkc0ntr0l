import type { MetadataRoute } from "next";

import { COLOR_CANVAS } from "@/lib/marca";

/**
 * Manifiesto PWA (spec.md §8, AC-PWA-1).
 *
 * `display: standalone` importa para H1: el operador registra de pie, y una app
 * instalada en la pantalla de inicio abre sin barra de navegador ni tabs.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gestión de Estacionamiento",
    short_name: "Estacionamiento",
    description:
      "Registro de entradas y salidas de vehículos, y visibilidad de ocupación e ingresos.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: COLOR_CANVAS,
    theme_color: COLOR_CANVAS,
    lang: "es-CL",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
