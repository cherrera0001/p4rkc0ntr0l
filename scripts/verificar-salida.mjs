/**
 * Ejercita el ciclo completo de una sesión contra la API real: ingreso, salida y
 * cálculo del monto (spec.md §5).
 *
 * Complementa a la prueba unitaria de AC-OP-2: aquella verifica la fórmula
 * aislada, esta verifica que la ruta use la tarifa vigente de la base y persista
 * el resultado.
 *
 * Deja la sesión CERRADA a propósito, para que verificar-meas1.mjs tenga algo
 * real que contar. La limpieza va después, con limpiar-fixtures.mjs.
 *
 * Uso:  node scripts/verificar-salida.mjs [url]
 */

import postgres from "postgres";
import { leerJson } from "./lib/respuesta.mjs";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const PATENTE_FIXTURE = "FIXT01";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("FAIL · falta DATABASE_URL.");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });
const resultados = [];
const comprobar = (nombre, ok, detalle) => {
  resultados.push({ nombre, ok });
  console.log(`${ok ? "PASS" : "FAIL"} · ${nombre}${detalle ? ` · ${detalle}` : ""}`);
};

/** Cookie de sesión del operador: la API exige rol desde M3. */
async function entrarComoOperador() {
  const r = await fetch(`${URL_BASE}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "operador@fixture.invalid",
      clave: process.env.CLAVE_ACCESO ?? "",
    }),
  });
  if (!r.ok) throw new Error(`No se pudo iniciar sesión: HTTP ${r.status}`);
  const cookie = r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  return { "Content-Type": "application/json", Cookie: cookie };
}

let cabeceras;

try {
  await sql`DELETE FROM sesion_vehiculo WHERE patente = ${PATENTE_FIXTURE}`;

  cabeceras = await entrarComoOperador();
  comprobar("el operador obtiene sesión", Boolean(cabeceras.Cookie));

  const rSinSesion = await fetch(`${URL_BASE}/api/sesiones`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: crypto.randomUUID(), patente: "FIXT09" }),
  });
  comprobar(
    "la API rechaza un ingreso sin sesión",
    rSinSesion.status === 401,
    `HTTP ${rSinSesion.status}`,
  );

  // 89 minutos: con fracción de 15 redondea a 90, y deja margen para que los
  // milisegundos de la corrida no empujen a la fracción siguiente.
  const entrada = new Date(Date.now() - 89 * 60_000);
  const id = crypto.randomUUID();

  const rIngreso = await fetch(`${URL_BASE}/api/sesiones`, {
    method: "POST",
    headers: cabeceras,
    body: JSON.stringify({
      id,
      patente: PATENTE_FIXTURE,
      entradaAt: entrada.toISOString(),
      tecleoInicioAt: new Date(entrada.getTime() - 4000).toISOString(),
      tecleoFinAt: entrada.toISOString(),
    }),
  });
  comprobar("el ingreso responde 201", rIngreso.status === 201, `HTTP ${rIngreso.status}`);

  const rDuplicado = await fetch(`${URL_BASE}/api/sesiones`, {
    method: "POST",
    headers: cabeceras,
    body: JSON.stringify({
      id,
      patente: PATENTE_FIXTURE,
      entradaAt: entrada.toISOString(),
      tecleoInicioAt: new Date(entrada.getTime() - 4000).toISOString(),
      tecleoFinAt: entrada.toISOString(),
    }),
  });
  const cuerpoDup = await leerJson(rDuplicado);
  comprobar(
    "reenviar el mismo id no crea otra sesión",
    rDuplicado.status === 200 && cuerpoDup.duplicada === true,
    `HTTP ${rDuplicado.status}`,
  );

  const rSalida = await fetch(`${URL_BASE}/api/sesiones/${id}/salida`, {
    method: "POST",
    headers: cabeceras,
  });
  const { sesion } = await leerJson(rSalida);
  comprobar("la salida responde 200", rSalida.status === 200, `HTTP ${rSalida.status}`);
  comprobar("la sesión queda cerrada", sesion?.estado === "cerrada", sesion?.estado);

  // Tarifa fixture: 1000/hora, fracción 15, mínimo 500.
  // 89 min -> 90 min -> 90/60 * 1000 = 1500
  comprobar(
    "el monto usa la tarifa vigente de la base",
    sesion?.montoCalculado === 1500,
    `$ ${sesion?.montoCalculado}`,
  );

  const rRepetida = await fetch(`${URL_BASE}/api/sesiones/${id}/salida`, {
    method: "POST",
    headers: cabeceras,
  });
  const repetida = await leerJson(rRepetida);
  comprobar(
    "cerrar dos veces no cambia el monto",
    repetida.yaCerrada === true && repetida.sesion?.montoCalculado === 1500,
    `$ ${repetida.sesion?.montoCalculado}`,
  );

  // Validación de frontera: la patente es dato personal (spec.md §7).
  const rInvalida = await fetch(`${URL_BASE}/api/sesiones`, {
    method: "POST",
    headers: cabeceras,
    body: JSON.stringify({
      id: crypto.randomUUID(),
      patente: "'; DROP TABLE sesion_vehiculo; --",
      entradaAt: new Date().toISOString(),
      tecleoInicioAt: new Date().toISOString(),
      tecleoFinAt: new Date().toISOString(),
    }),
  });
  comprobar("la API rechaza una patente inválida", rInvalida.status === 400, `HTTP ${rInvalida.status}`);

  const rSinTecleo = await fetch(`${URL_BASE}/api/sesiones`, {
    method: "POST",
    headers: cabeceras,
    body: JSON.stringify({
      id: crypto.randomUUID(),
      patente: "FIXT02",
      entradaAt: new Date().toISOString(),
    }),
  });
  comprobar(
    "la API rechaza un ingreso sin timestamps de tecleo",
    rSinTecleo.status === 400,
    `HTTP ${rSinTecleo.status}`,
  );

  const [tablaViva] = await sql`SELECT count(*)::int AS n FROM sesion_vehiculo`;
  comprobar("la tabla sigue existiendo tras el intento de inyección", tablaViva.n >= 1);
} finally {
  await sql.end();
}

const fallidos = resultados.filter((r) => !r.ok);
console.log(`\n${resultados.length - fallidos.length}/${resultados.length} comprobaciones PASS`);
if (fallidos.length) {
  console.log("FALLARON: " + fallidos.map((f) => f.nombre).join(", "));
  process.exit(1);
}
console.log("Ciclo ingreso/salida: PASS");
