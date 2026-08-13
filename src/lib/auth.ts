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
 * El formato del token y su vencimiento viven en `sesion-token.ts`, que no
 * depende de Next ni de la base y por eso tiene pruebas unitarias. Acá queda lo
 * que sí necesita el entorno: la cookie y la relectura del usuario.
 *
 * Qué protege y qué no:
 *  - La cookie va firmada: el cliente no puede cambiar su rol de `operador` a
 *    `dueño` editándola. Cualquier alteración invalida la firma.
 *  - `httpOnly` la deja fuera del alcance de JavaScript, así que un XSS no la
 *    puede leer.
 *  - NO es un sistema de identidad. La barrera es una clave compartida del
 *    piloto. Alcanza para separar dos roles en un estacionamiento; no alcanza
 *    para multiusuario real. Cuando el piloto lo exija, se reemplaza.
 *
 * **Vencimiento y revocación (hallazgo A-1).** Antes la firma era lo único que
 * se comprobaba: una cookie robada valía para siempre, `maxAge` era un atributo
 * que el cliente podía ignorar, y ninguna ruta volvía a mirar la tabla `usuario`
 * después del login. Ahora la carga lleva `iat`/`exp` firmados y verificados en
 * el servidor, y el rol y el estacionamiento se releen de la base en cada
 * petición. Eso último absorbe M-3: el rol ya no queda congelado en la cookie.
 *
 * No hay `jti` ni lista de revocación, y es deliberado: una lista de tokens
 * revocados es otra tabla que administrar, y la revocación que el piloto
 * necesita —dar de baja a alguien, o cambiarle el rol— la da la relectura de
 * `usuario`. Rotar `SESSION_SECRET` sigue invalidando de golpe todo lo emitido.
 */

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";

import { conBase, db, usuario } from "@/db";
import { exigirEnv } from "./env.ts";
import {
  deserializarSesion,
  DURACION_SEGUNDOS,
  igualEnTiempoConstante,
  serializarSesion,
  type SesionUsuario,
} from "./sesion-token.ts";

const COOKIE = "sesion";

export type { SesionUsuario };
export { deserializarSesion, serializarSesion };

export async function iniciarSesion(usuarioSesion: SesionUsuario): Promise<void> {
  const almacen = await cookies();
  almacen.set(COOKIE, serializarSesion(usuarioSesion), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // Coincide con el `exp` firmado. El atributo le ahorra al navegador mandar
    // una cookie que igual se va a rechazar; la verificación real es el `exp`.
    maxAge: DURACION_SEGUNDOS,
  });
}

export async function cerrarSesion(): Promise<void> {
  const almacen = await cookies();
  almacen.delete(COOKIE);
}

/**
 * Usuario de la petición actual, o `null` si no hay sesión válida.
 *
 * Comprueba firma y vencimiento, **y relee la fila del usuario**: si lo dieron
 * de baja, o le cambiaron el rol o el estacionamiento, la cookie deja de valer
 * en la petición siguiente sin esperar a que caduque. Lo que devuelve sale de la
 * base, no de la cookie: la cookie dice quién dice ser, la base dice qué puede
 * hacer.
 */
export async function sesionActual(): Promise<SesionUsuario | null> {
  const almacen = await cookies();
  const carga = deserializarSesion(almacen.get(COOKIE)?.value);
  if (!carga) return null;

  const [fila] = await conBase(() =>
    db.select().from(usuario).where(eq(usuario.id, carga.id)).limit(1),
  );
  if (!fila) return null;

  return {
    id: fila.id,
    email: fila.email,
    rol: fila.rol,
    estacionamientoId: fila.estacionamientoId,
  };
}

/**
 * Exige sesión con uno de los roles dados. Devuelve el usuario o `null`.
 * Quien la llama decide si redirige (páginas) o responde 401/403 (API).
 */
export async function exigirRol(
  ...roles: Array<SesionUsuario["rol"]>
): Promise<SesionUsuario | null> {
  const usuarioSesion = await sesionActual();
  if (!usuarioSesion) return null;
  return roles.includes(usuarioSesion.rol) ? usuarioSesion : null;
}

/** Verifica la clave compartida del piloto en tiempo constante (ver B-1). */
export function claveCorrecta(entrada: unknown): boolean {
  const esperada = exigirEnv("CLAVE_ACCESO", "Definila como variable de entorno.");
  if (typeof entrada !== "string") return false;
  return igualEnTiempoConstante(esperada, entrada);
}
