import { createHmac } from "node:crypto";
const BASE = "http://localhost:3000";
const CLAVE = process.env.CLAVE_ACCESO;
const SECRET = process.env.SESSION_SECRET;
const b64url = (b) => Buffer.from(b).toString("base64url");
function forjar(payload) {
  const carga = b64url(JSON.stringify(payload));
  const firma = createHmac("sha256", SECRET).update(carga).digest().toString("base64url");
  return `${carga}.${firma}`;
}
function uuid() { return crypto.randomUUID(); }
async function req(method, path, { cookie, body, headers } = {}) {
  const h = { ...(headers||{}) };
  if (body !== undefined) h["content-type"] = "application/json";
  if (cookie) h["cookie"] = `sesion=${cookie}`;
  const r = await fetch(BASE + path, { method, headers: h, body: body!==undefined?JSON.stringify(body):undefined, redirect: "manual" });
  const text = await r.text();
  let setc = r.headers.get("set-cookie");
  let cookieVal = null;
  if (setc) { const m = setc.match(/sesion=([^;]+)/); if (m) cookieVal = m[1]; }
  return { status: r.status, text, cookie: cookieVal };
}
async function login(email) {
  const r = await req("POST", "/api/login", { body: { email, clave: CLAVE } });
  return r;
}
const log = (...a) => console.log(...a);
const sep = (t) => log("\n===== " + t + " =====");

// --- Login operador A ---
sep("LOGIN operador A");
const la = await login("operador@fixture.invalid");
log("status", la.status, la.text.slice(0,120), "cookie?", !!la.cookie);
const ckA = la.cookie;

// --- Operador A crea sesion FIXT90 ---
sep("A crea sesion FIXT90");
const now = new Date();
const sidA = uuid();
const crearA = await req("POST", "/api/sesiones", { cookie: ckA, body: {
  id: sidA, patente: "FIXT90", entradaAt: now.toISOString(),
  tecleoInicioAt: now.toISOString(), tecleoFinAt: now.toISOString(), clienteAhora: now.toISOString()
}});
log("status", crearA.status, crearA.text.slice(0,200));

// --- Login plataforma ---
sep("LOGIN plataforma");
const lp = await login("plataforma@fixture.invalid");
log("status", lp.status, lp.text.slice(0,160), "cookie?", !!lp.cookie);
const ckP = lp.cookie;

// --- plataforma crea cliente B ---
sep("plataforma crea cliente B via /api/plataforma/clientes");
const crearB = await req("POST", "/api/plataforma/clientes", { cookie: ckP, headers: {origin: BASE, host:"localhost:3000"}, body: {
  nombre: "Cliente B fixture", zonaHoraria: "America/Santiago", capacidadTotal: 10,
  valorHora: 1000, fraccionMinutos: 15, montoMinimo: 500,
  emailDueno: "duenob@fixture.invalid", emailOperador: "operadorb@fixture.invalid"
}});
log("status", crearB.status, crearB.text.slice(0,200));

// --- Login operador B ---
sep("LOGIN operador B");
const lb = await login("operadorb@fixture.invalid");
log("status", lb.status, lb.text.slice(0,120), "cookie?", !!lb.cookie);
const ckB = lb.cookie;

// --- B crea sesion FIXT91 ---
sep("B crea sesion FIXT91");
const sidB = uuid();
const crearBs = await req("POST", "/api/sesiones", { cookie: ckB, body: {
  id: sidB, patente: "FIXT91", entradaAt: now.toISOString(),
  tecleoInicioAt: now.toISOString(), tecleoFinAt: now.toISOString(), clienteAhora: now.toISOString()
}});
log("status", crearBs.status, crearBs.text.slice(0,200));

// ===== CROSS-TENANT =====
sep("CRUCE: B intenta cerrar salida de sesion de A (id directo)");
const cross1 = await req("POST", `/api/sesiones/${sidA}/salida`, { cookie: ckB, headers:{origin:BASE,host:"localhost:3000"} });
log("POST /api/sesiones/"+sidA+"/salida (cookie B) =>", cross1.status, cross1.text.slice(0,200));

sep("CRUCE: A intenta cerrar salida de sesion de B");
const cross2 = await req("POST", `/api/sesiones/${sidB}/salida`, { cookie: ckA, headers:{origin:BASE,host:"localhost:3000"} });
log("POST /api/sesiones/"+sidB+"/salida (cookie A) =>", cross2.status, cross2.text.slice(0,200));

sep("CRUCE: GET /api/sesiones con cookie B (no debe ver FIXT90 de A)");
const listB = await req("GET", "/api/sesiones", { cookie: ckB });
log("status", listB.status, listB.text.slice(0,400));

sep("CRUCE: GET /api/sesiones con cookie A (no debe ver FIXT91 de B)");
const listA = await req("GET", "/api/sesiones", { cookie: ckA });
log("status", listA.status, listA.text.slice(0,400));

// ===== ROLE ESCALATION =====
sep("ESCALADA: operador A -> POST /api/plataforma/clientes (debe 401)");
const esc1 = await req("POST", "/api/plataforma/clientes", { cookie: ckA, headers:{origin:BASE,host:"localhost:3000"}, body:{nombre:"x",zonaHoraria:"America/Santiago",capacidadTotal:1,valorHora:1,fraccionMinutos:1,montoMinimo:0,emailDueno:"a@x.invalid",emailOperador:"b@x.invalid"} });
log("=>", esc1.status, esc1.text.slice(0,160));

sep("ESCALADA: plataforma -> GET /api/sesiones (debe 401, plataforma no ve patentes)");
const esc2 = await req("GET", "/api/sesiones", { cookie: ckP });
log("=>", esc2.status, esc2.text.slice(0,160));

sep("ESCALADA: plataforma -> POST salida de sesion A (debe 401)");
const esc3 = await req("POST", `/api/sesiones/${sidA}/salida`, { cookie: ckP, headers:{origin:BASE,host:"localhost:3000"} });
log("=>", esc3.status, esc3.text.slice(0,160));

// export ids for later
console.log("\nIDS", JSON.stringify({ sidA, sidB }));
