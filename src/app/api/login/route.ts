/**
 * Inicio y cierre de sesión (spec.md §3).
 *
 * El email identifica al usuario y su rol; la clave compartida del piloto es la
 * barrera. Ambas comprobaciones responden lo mismo ante un email inexistente y
 * ante una clave incorrecta: distinguirlos revelaría qué emails existen.
 *
 * **Freno de fuerza bruta (hallazgo C-1).** Esta es la puerta única de todo el
 * sistema, expuesta a internet, y hasta acá atacarla no costaba nada ni dejaba
 * señal. Se limita por IP **y** por email: por IP frena la ráfaga de un
 * atacante, y por email evita que rotar IPs deje la cuenta sin protección.
 * El alcance real del limitador —memoria por instancia— está documentado en
 * `limite-intentos.ts` y no se vende como más de lo que es.
 */

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { conBase, db, usuario } from "@/db";
import { cerrarSesion, claveCorrecta, iniciarSesion } from "@/lib/auth";
import {
  identificarCliente,
  LimitadorIntentos,
  OPCIONES_LOGIN,
} from "@/lib/limite-intentos";
import { origenAjeno, origenPropio, respuestaDeFallo } from "@/lib/peticion";

export const dynamic = "force-dynamic";

/**
 * Vive en el módulo, no en el handler: en una instancia caliente el estado
 * sobrevive entre peticiones, que es exactamente lo que hace falta. Cuando la
 * instancia se recicla, el contador se pierde — es la limitación conocida.
 */
const limitador = new LimitadorIntentos(OPCIONES_LOGIN);

function demasiadosIntentos(esperaSegundos: number) {
  return NextResponse.json(
    {
      error: "Demasiados intentos. Esperá unos segundos antes de volver a probar.",
      esperaSegundos,
    },
    { status: 429, headers: { "Retry-After": String(esperaSegundos) } },
  );
}

export async function POST(request: Request) {
  if (!origenPropio(request)) return origenAjeno();

  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido." }, { status: 400 });
  }

  const { email, clave } = (cuerpo ?? {}) as Record<string, unknown>;

  if (typeof email !== "string" || email.length === 0 || email.length > 255) {
    return NextResponse.json({ error: "Email inválido." }, { status: 400 });
  }

  const normalizado = email.trim().toLowerCase();
  const claves = [
    `ip:${identificarCliente(request.headers)}`,
    `email:${normalizado}`,
  ];

  // Se consulta ANTES de tocar la base y antes de comparar la clave: un intento
  // frenado no debe costar ni una consulta ni dar señal de timing.
  for (const clavelimite of claves) {
    const veredicto = limitador.consultar(clavelimite);
    if (!veredicto.permitido) return demasiadosIntentos(veredicto.esperaSegundos);
  }

  try {
    const claveOk = claveCorrecta(clave);

    const [fila] = await conBase(() =>
      db.select().from(usuario).where(eq(usuario.email, normalizado)).limit(1),
    );

    // Respuesta idéntica en ambos fallos: no se filtra qué emails existen.
    if (!fila || !claveOk) {
      let espera = 0;
      for (const clavelimite of claves) {
        const veredicto = limitador.registrarFallo(clavelimite);
        if (!veredicto.permitido) espera = Math.max(espera, veredicto.esperaSegundos);
      }
      if (espera > 0) return demasiadosIntentos(espera);

      return NextResponse.json({ error: "Email o clave incorrectos." }, { status: 401 });
    }

    // Un login correcto limpia el historial: el operador que se equivocó dos
    // veces al empezar el turno no arrastra el castigo.
    for (const clavelimite of claves) limitador.registrarExito(clavelimite);

    await iniciarSesion({
      id: fila.id,
      email: fila.email,
      rol: fila.rol,
      estacionamientoId: fila.estacionamientoId,
    });

    return NextResponse.json({
      rol: fila.rol,
      destino: fila.rol === "dueño" ? "/dueno" : "/",
    });
  } catch (error) {
    return respuestaDeFallo("POST /api/login", error);
  }
}

export async function DELETE(request: Request) {
  if (!origenPropio(request)) return origenAjeno();

  await cerrarSesion();
  return NextResponse.json({ ok: true });
}
