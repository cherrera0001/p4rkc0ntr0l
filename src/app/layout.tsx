import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { COLOR_CANVAS } from "@/lib/marca";
import "./globals.css";
import { RegistrarServiceWorker } from "./registrar-sw";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gestión de Estacionamiento",
  description:
    "Registro de entradas y salidas de vehículos, y visibilidad de ocupación e ingresos.",
  appleWebApp: {
    capable: true,
    title: "Estacionamiento",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: COLOR_CANVAS,
  width: "device-width",
  initialScale: 1,
  // El operador registra de pie y con una mano: que un doble toque no haga zoom
  // sobre el teclado de patente.
  maximumScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es-CL"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <RegistrarServiceWorker />
        {children}
      </body>
    </html>
  );
}
