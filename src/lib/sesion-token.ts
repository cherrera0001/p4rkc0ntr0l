/**
 * El token de sesión, sin cookies y sin base de datos (hallazgo A-1).
 *
 * Vive separado de `auth.ts` por una razón concreta: `auth.ts` importa
 * `next/headers` y el cliente de Postgres, así que no se puede cargar en una
 * prueba unitaria. El vencimiento de sesión es exactamente la clase de regla que
 * no puede quedar sin prueba —falla en silencio y a favor del atacante—, así que
 * la parte que decide vive acá, donde `node --test` la alcanza.
 *
 * Formato: `base64url(json).base64url(hmac-sha256(json))`.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

import { exigirEnv } from "./env.ts";

/**
 * Vida de la sesión: un turno largo.
 *
 * Eran 30 días, y `maxAge` era además un atributo de cookie que el cliente podía
 * ignorar: nadie verificaba nada del lado del servidor. En un dispositivo
 * compartido por turnos —el escenario real del piloto, no una hipótesis— una
 * cookie de 30 días sobrevive a todos los operadores que pasen por ese teléfono.
 * Doce horas cubre un turno completo con margen.
 *
 * No rompe el registro sin red: la pantalla se sirve del caché del service
 * worker y el ingreso se escribe en IndexedDB sin consultar la sesión. Lo que
 * exige red —sincronizar, y cobrar la salida— ya exigía red antes.
 */
export const DURACION_SEGUNDOS = 12 * 60 * 60;

export type SesionUsuario = {
  id: string;
  email: string;
  rol: "operador" | "dueño";
  estacionamientoId: string;
};

/** Lo que viaja firmado dentro de la cookie. */
export type CargaSesion = SesionUsuario & {
  /** Emisión, en segundos epoch. */
  iat: number;
  /** Vencimiento, en segundos epoch. Se verifica en el servidor. */
  exp: number;
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

/**
 * Compara dos cadenas sin filtrar nada por timing, **ni siquiera el largo**
 * (hallazgo B-1).
 *
 * La versión anterior devolvía `false` de inmediato cuando los largos no
 * coincidían, así que el tiempo de respuesta revelaba el largo del valor
 * esperado. Acá se comparan las huellas HMAC y no los valores: miden siempre 32
 * bytes, así que no queda ninguna rama que dependa de la entrada.
 */
export function igualEnTiempoConstante(esperado: string, recibido: string): boolean {
  const clave = secreto();
  const a = createHmac("sha256", clave).update(esperado).digest();
  const b = createHmac("sha256", clave).update(recibido).digest();
  return timingSafeEqual(a, b);
}

export function serializarSesion(
  usuario: SesionUsuario,
  ahora: Date = new Date(),
): string {
  const iat = Math.floor(ahora.getTime() / 1000);
  const completa: CargaSesion = { ...usuario, iat, exp: iat + DURACION_SEGUNDOS };
  const carga = b64url(Buffer.from(JSON.stringify(completa), "utf8"));
  return `${carga}.${firmar(carga)}`;
}

/**
 * Devuelve la carga de un token **firmado y vigente**, o `null`.
 *
 * Que la firma sea válida no alcanza: una cookie vencida está igual de bien
 * firmada que una recién emitida.
 */
export function deserializarSesion(
  valor: string | undefined,
  ahora: Date = new Date(),
): CargaSesion | null {
  if (!valor) return null;

  const partes = valor.split(".");
  if (partes.length !== 2) return null;
  const [carga, firma] = partes;
  if (!carga || !firma) return null;
  if (!igualEnTiempoConstante(firmar(carga), firma)) return null;

  let datos: CargaSesion;
  try {
    datos = JSON.parse(Buffer.from(carga, "base64url").toString("utf8")) as CargaSesion;
  } catch {
    return null;
  }
  if (typeof datos !== "object" || datos === null) return null;

  // Un token emitido antes de A-1 no tiene `exp`. Se trata como vencido: son
  // justamente las cookies eternas que el hallazgo señala.
  if (typeof datos.exp !== "number" || !Number.isFinite(datos.exp)) return null;
  if (datos.exp * 1000 <= ahora.getTime()) return null;

  if (typeof datos.id !== "string" || typeof datos.rol !== "string") return null;

  return datos;
}
