/**
 * Rotación de la contraseña de Postgres.
 *
 * Cambia la contraseña del rol EN LA BASE VIVA. Esto es imprescindible: la
 * variable POSTGRES_PASSWORD del servicio solo la lee la imagen de Postgres
 * durante la inicialización, con el volumen vacío. En una base ya inicializada,
 * editar esa variable no cambia nada y además deja las variables mintiendo
 * respecto de la base real.
 *
 * Este script hace el primer paso. El segundo —dejar las variables del servicio
 * en Railway en sincronía— va aparte.
 *
 * Entrada por variables de entorno, nunca por argumento (los argumentos quedan
 * en el historial del shell y en la lista de procesos):
 *   DATABASE_URL     conexión actual, con la contraseña vigente
 *   NUEVA_PASSWORD   contraseña nueva
 *
 * No imprime la contraseña. Solo huellas SHA-256 truncadas.
 */

import { createHash } from "node:crypto";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
const nueva = process.env.NUEVA_PASSWORD;

if (!url) {
  console.error("FAIL · falta DATABASE_URL.");
  process.exit(1);
}
if (!nueva) {
  console.error("FAIL · falta NUEVA_PASSWORD.");
  process.exit(1);
}

// Se interpola en un ALTER USER, que no admite parámetros. Restringir el
// alfabeto a alfanuméricos elimina cualquier posibilidad de inyección: no hay
// comilla ni barra que pueda escapar del literal.
if (!/^[A-Za-z0-9]{24,}$/.test(nueva)) {
  console.error(
    "FAIL · NUEVA_PASSWORD debe ser alfanumérica y de al menos 24 caracteres.",
  );
  process.exit(1);
}

const huella = (s) => createHash("sha256").update(s).digest("hex").slice(0, 8);

const sql = postgres(url, { max: 1 });

try {
  const [{ current_user: usuario }] = await sql`SELECT current_user`;
  console.log(`conectado como: ${usuario}`);

  // Mismo criterio que con la contraseña: el nombre de rol se interpola, así que
  // se exige un alfabeto sin comillas ni espacios antes de tocar el SQL.
  if (!/^[A-Za-z0-9_]+$/.test(usuario)) {
    throw new Error(`Nombre de rol inesperado: ${usuario}`);
  }

  await sql.unsafe(`ALTER USER "${usuario}" WITH PASSWORD '${nueva}'`);
  console.log(`PASS · contraseña del rol '${usuario}' cambiada en la base`);
  console.log(`huella de la nueva: ${huella(nueva)}`);
} finally {
  await sql.end();
}
