/**
 * Inicio y cierre de sesión (spec.md §3).
 *
 * El email identifica al usuario y su rol; la clave compartida del piloto es la
 * barrera. Ambas comprobaciones responden lo mismo ante un email inexistente y
 * ante una clave incorrecta: distinguirlos revelaría qué emails existen.
 */

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db, usuario } from "@/db";
import { cerrarSesion, claveCorrecta, iniciarSesion } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
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

  const claveOk = claveCorrecta(clave);

  const [fila] = await db
    .select()
    .from(usuario)
    .where(eq(usuario.email, email.trim().toLowerCase()));

  // Respuesta idéntica en ambos fallos: no se filtra qué emails existen.
  if (!fila || !claveOk) {
    return NextResponse.json({ error: "Email o clave incorrectos." }, { status: 401 });
  }

  await iniciarSesion({
    id: fila.id,
    email: fila.email,
    rol: fila.rol,
    estacionamientoId: fila.estacionamientoId,
  });

  return NextResponse.json({ rol: fila.rol, destino: fila.rol === "dueño" ? "/dueno" : "/" });
}

export async function DELETE() {
  await cerrarSesion();
  return NextResponse.json({ ok: true });
}
