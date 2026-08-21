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
import { esTextoAlmacenable } from "@/lib/frontera";
import { destinoDe } from "@/lib/roles";
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
      error: "Demasiados intentos. Espera unos segundos antes de volver a probar.",
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

  // `esTextoAlmacenable` rechaza el byte NUL, que Postgres no admite en `text`
  // ni escapado. Un email con un NUL pasaba estas tres condiciones —es cadena y
  // mide entre 1 y 255— y reventaba recién en el driver, saliendo 503 (AC-API-1).
  // Lo encontró el corpus de `verificar:frontera`, no una lectura del código.
  if (
    typeof email !== "string" ||
    email.length === 0 ||
    email.length > 255 ||
    !esTextoAlmacenable(email)
  ) {
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

    // **Sin caché, igual que toda ruta autenticada.** Esta no pasa por
    // `rutaAutenticada` —es pública, es la que *crea* la sesión—, así que la
    // cabecera va explícita: la respuesta viaja con el `Set-Cookie` de sesión, y
    // un intermediario que la guarde entrega la sesión de un turno al siguiente.
    // El dispositivo compartido por turnos es el escenario de INT-8.
    return NextResponse.json(
      {
        rol: fila.rol,
        // Cada rol aterriza donde puede trabajar. El de plataforma no ve el
        // producto: da de alta clientes y nada mas (REQ-ISO-3 de ADR-005).
        destino: destinoDe(fila.rol),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return respuestaDeFallo("POST /api/login", error);
  }
}

export async function DELETE(request: Request) {
  if (!origenPropio(request)) return origenAjeno();

  await cerrarSesion();
  return NextResponse.json({ ok: true });
}
