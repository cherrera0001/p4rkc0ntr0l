/**
 * Auth mínima de dos roles — spec.md §3 (ADR-002).
 *
 * Solo servidor: usa `next/headers`, que ya falla si se importa desde cliente.
 *
 * Cookie de sesión firmada con HMAC-SHA256 contra los usuarios ya sembrados.
 * Sin proveedor externo, sin OAuth, sin dependencia nueva: la v1 tiene dos roles
 * y un solo estacionamiento, y cualquier cosa más grande sería infraestructura
 * que administrar en contra del criterio rector de ADR-002.
 *
 * Qué protege y qué no:
 *  - La cookie va firmada: el cliente no puede cambiar su rol de `operador` a
 *    `dueño` editándola. Cualquier alteración invalida la firma.
 *  - `httpOnly` la deja fuera del alcance de JavaScript, así que un XSS no la
 *    puede leer.
 *  - NO es un sistema de identidad. La barrera es una clave compartida del
 *    piloto. Alcanza para separar dos roles en un estacionamiento; no alcanza
 *    para multiusuario real. Cuando el piloto lo exija, se reemplaza.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

import { exigirEnv } from "./env";

const COOKIE = "sesion";
const DURACION_DIAS = 30;

export type SesionUsuario = {
  id: string;
  email: string;
  rol: "operador" | "dueño";
  estacionamientoId: string;
};

function secreto(): string {
  return exigirEnv(
    "SESSION_SECRET",
    "Definila como variable de entorno; nunca en el repo.",
  );
}

const b64url = (b: Buffer) => b.toString("base64url");

function firmar(carga: string): string {
  return b64url(createHmac("sha256", secreto()).update(carga).digest());
}

/** Compara en tiempo constante: una comparación normal filtra la firma por timing. */
function firmaValida(carga: string, firma: string): boolean {
  const esperada = Buffer.from(firmar(carga));
  const recibida = Buffer.from(firma);
  if (esperada.length !== recibida.length) return false;
  return timingSafeEqual(esperada, recibida);
}

export function serializarSesion(usuario: SesionUsuario): string {
  const carga = b64url(Buffer.from(JSON.stringify(usuario), "utf8"));
  return `${carga}.${firmar(carga)}`;
}

export function deserializarSesion(valor: string | undefined): SesionUsuario | null {
  if (!valor) return null;
  const [carga, firma] = valor.split(".");
  if (!carga || !firma) return null;
  if (!firmaValida(carga, firma)) return null;

  try {
    return JSON.parse(Buffer.from(carga, "base64url").toString("utf8")) as SesionUsuario;
  } catch {
    return null;
  }
}

export async function iniciarSesion(usuario: SesionUsuario): Promise<void> {
  const almacen = await cookies();
  almacen.set(COOKIE, serializarSesion(usuario), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DURACION_DIAS * 24 * 60 * 60,
  });
}

export async function cerrarSesion(): Promise<void> {
  const almacen = await cookies();
  almacen.delete(COOKIE);
}

/** Usuario de la petición actual, o `null` si no hay sesión válida. */
export async function sesionActual(): Promise<SesionUsuario | null> {
  const almacen = await cookies();
  return deserializarSesion(almacen.get(COOKIE)?.value);
}

/**
 * Exige sesión con uno de los roles dados. Devuelve el usuario o `null`.
 * Quien la llama decide si redirige (páginas) o responde 401/403 (API).
 */
export async function exigirRol(
  ...roles: Array<SesionUsuario["rol"]>
): Promise<SesionUsuario | null> {
  const usuario = await sesionActual();
  if (!usuario) return null;
  return roles.includes(usuario.rol) ? usuario : null;
}

/** Verifica la clave compartida del piloto en tiempo constante. */
export function claveCorrecta(entrada: unknown): boolean {
  const esperada = exigirEnv("CLAVE_ACCESO", "Definila como variable de entorno.");
  if (typeof entrada !== "string") return false;

  const a = Buffer.from(esperada);
  const b = Buffer.from(entrada);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
