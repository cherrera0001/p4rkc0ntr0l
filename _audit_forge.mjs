import { createHmac } from "node:crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import * as schema from "./src/db/schema.ts";
const BASE = "http://localhost:3000";
const SECRET = process.env.SESSION_SECRET;
const b64url = (b) => Buffer.from(b).toString("base64url");
function forjar(payload) {
  const carga = b64url(JSON.stringify(payload));
  const firma = createHmac("sha256", SECRET).update(carga).digest().toString("base64url");
  return `${carga}.${firma}`;
}
async function req(method, path, { cookie, headers } = {}) {
  const h = { ...(headers||{}) };
  if (cookie) h["cookie"] = `sesion=${cookie}`;
  const r = await fetch(BASE + path, { method, headers: h, redirect: "manual" });
  return { status: r.status, text: await r.text() };
}
const c = postgres(process.env.DATABASE_URL, { max: 1 });
const db = drizzle(c, { schema });
const us = await db.select().from(schema.usuario);
const A = us.find(u => u.email === "operador@fixture.invalid");
const B = us.find(u => u.email === "operadorb@fixture.invalid");
const P = us.find(u => u.email === "plataforma@fixture.invalid");
const nowS = Math.floor(Date.now()/1000);
const exp = nowS + 3600;
const log = (...a)=>console.log(...a);
const sep=(t)=>log("\n===== "+t+" =====");

sep("A: token válido de referencia (operador A) GET /api/sesiones");
const tokA = forjar({ id:A.id, email:A.email, rol:"operador", estacionamientoId:A.estacionamientoId, iat:nowS, exp });
log("=>", (await req("GET","/api/sesiones",{cookie:tokA})).status);

sep("FORJA 1: payload rol='plataforma' pero id=operador A -> POST /api/plataforma/clientes");
const tok1 = forjar({ id:A.id, email:A.email, rol:"plataforma", estacionamientoId:null, iat:nowS, exp });
const r1 = await req("POST","/api/plataforma/clientes",{cookie:tok1, headers:{origin:BASE,host:"localhost:3000"}});
log("=>", r1.status, r1.text.slice(0,120), "(rol se relee de la base: A es operador -> 401 esperado)");

sep("FORJA 2: payload estacionamientoId = B, pero id=operador A -> GET /api/sesiones (¿ve patentes de B?)");
const tok2 = forjar({ id:A.id, email:A.email, rol:"operador", estacionamientoId:B.estacionamientoId, iat:nowS, exp });
const r2 = await req("GET","/api/sesiones",{cookie:tok2});
log("=>", r2.status, r2.text.slice(0,300), "(debe traer FIXT90 de A, NO FIXT91 de B)");

sep("FORJA 3: firma inválida (payload válido, firma alterada) -> GET /api/sesiones");
const badsig = tokA.split(".")[0] + ".AAAA" + tokA.split(".")[1].slice(4);
const r3 = await req("GET","/api/sesiones",{cookie:badsig});
log("=>", r3.status, r3.text.slice(0,120), "(401 esperado)");

sep("FORJA 4: token EXPIRADO (exp en el pasado), bien firmado -> GET /api/sesiones");
const tokExp = forjar({ id:A.id, email:A.email, rol:"operador", estacionamientoId:A.estacionamientoId, iat:nowS-100000, exp:nowS-10 });
const r4 = await req("GET","/api/sesiones",{cookie:tokExp});
log("=>", r4.status, r4.text.slice(0,120), "(401 esperado)");

sep("FORJA 5: token SIN exp (estilo pre-A1), bien firmado -> GET /api/sesiones");
const tok5 = forjar({ id:A.id, email:A.email, rol:"operador", estacionamientoId:A.estacionamientoId, iat:nowS });
const r5 = await req("GET","/api/sesiones",{cookie:tok5});
log("=>", r5.status, r5.text.slice(0,120), "(401 esperado: sin exp = vencido)");

sep("FORJA 6: id inexistente (uuid random) bien firmado -> GET /api/sesiones");
const tok6 = forjar({ id:crypto.randomUUID(), email:"x@x.invalid", rol:"operador", estacionamientoId:A.estacionamientoId, iat:nowS, exp });
const r6 = await req("GET","/api/sesiones",{cookie:tok6});
log("=>", r6.status, r6.text.slice(0,120), "(401 esperado: fila no existe)");

sep("FORJA 7: plataforma real pero payload con estacionamientoId de A -> GET /api/sesiones");
const tok7 = forjar({ id:P.id, email:P.email, rol:"operador", estacionamientoId:A.estacionamientoId, iat:nowS, exp });
const r7 = await req("GET","/api/sesiones",{cookie:tok7});
log("=>", r7.status, r7.text.slice(0,200), "(P es plataforma en la base -> exigirRol(operador) 401)");

await c.end();
