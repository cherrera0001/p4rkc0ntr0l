import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import * as schema from "./src/db/schema.ts";
const c = postgres(process.env.DATABASE_URL, { max: 1 });
const db = drizzle(c, { schema });
const email = "plataforma@fixture.invalid";
const [ex] = await db.select().from(schema.usuario).where(eq(schema.usuario.email, email));
if (ex) { console.log("plataforma ya existía", ex.id, ex.rol, ex.estacionamientoId); }
else {
  const [u] = await db.insert(schema.usuario).values({ email, rol: "plataforma", estacionamientoId: null }).returning();
  console.log("creado plataforma", u.id, u.rol, u.estacionamientoId);
}
await c.end();
